#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Build the example data that ships with the app (presets/exempeldata/, Inhämta: Exempeldata; PLAN 12 f, F128 a).

The examples lie in one place on purpose: a building inside a detailed plan inside a comprehensive plan, all in Lomma (Skåne).

- lomma-op-2020.geojson: Lomma's Översiktsplan 2020, Plankarta 2030 (Lomma kommun, open data, CC0), read from the municipality's
  GeoPackage and written as the national specification's exchange model for comprehensive plans (Översiktsplan 2.0), with
  each of Lomma's layers placed in a category of Boverket's ÖP catalogue (2.3) by this script, and Lomma's boundary from SCB's
  Digitala gränser (CC0, presets/geo/kommuner.geojson) as the plan geometry.
- lomma-dp-bjorreds-vangar.geojson: the plan area, name, purpose, case number and consultation date of Lomma's detailed plan
  for Björreds vångar, stage I (Lomma kommun, open data, CC0), as Detaljplan 4.1; its uses and provisions are an example drawn
  by this script inside the real plan area, not the plan proposal.
- bjorreds-vangar-hus.ifc: buildingSMART's sample house (Sample-Test-Files, Simple-Scene, Building-Architecture, IFC4,
  CC BY 4.0) placed on a lot in the plan area with an IfcMapConversion to SWEREF 99 13 30, as the app's set_site writes it,
  and its owner history made neutral (no person's name).
- befolkning-kommuner-2024.csv: SCB's population of the 290 municipalities at the end of 2024 with their land area
  (Statistikdatabasen, CC0).
- fardigstallda-lagenheter-2024.json: SCB's answer in JSON-stat 2.0 for the dwellings completed in new buildings per
  municipality and type of building in 2024 (Statistikdatabasen, CC0), as the API gives it without the contact.
- kommungrannar.cypher: which of Sweden's municipalities share a border (a common stretch, not a single point), computed from
  presets/geo/kommuner.geojson and written as a Cypher script in APOC's export style that Neo4j and the app read.

Usage:
    python -I tools/build_examples.py <download folder>

The sources are fetched into the download folder (an empty folder of its own outside the repository) when they are not
there; they are read and never run. Afterwards run `python -I tools/wrap_local.py`.
"""
import hashlib
import json
import math
import re
import pathlib
import sqlite3
import struct
import sys
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "presets" / "exempeldata"
KOMMUNER = ROOT / "presets" / "geo" / "kommuner.geojson"
SOURCES = {
    "op.gpkg": "https://catalog.lomma.se/store/1/resource/164",
    "dp.gpkg": "https://catalog.lomma.se/store/1/resource/201",
    "house.ifc": "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/8832bddc04d8597d69e6a414e5f67a65e8b3b626/IFC%204.0.2.1%20(IFC%204%20ADD2%20TC1)/Simple-Scene/Building-Architecture.ifc",
}
# The files as they were read on 2026-11-28; a source that has changed since is reported, and the examples are then checked anew.
SHA256 = {
    "op.gpkg": "eae62e88fabe9fedff587f211e5725217931866a156c7e49bf767c2735188b53",
    "dp.gpkg": "60692fc82925a40d20256d68bc12a1fbdab1d1c75129993d845b868f21244906",
    "house.ifc": "8790a1e193e82b8e7e7f337ec2633cd40f2120590317a1443503a25b079e2e80",
}
USER_AGENT = "Dataspatium example builder"

# ---- SWEREF 99 (GRS 80, Transverse Mercator; Lantmäteriet's Gauss-Krüger formulas) --------------------------------------
A = 6378137.0
F = 1 / 298.257222101
ZONES = {3006: (15.0, 0.9996, 500000.0), 3008: (13.5, 1.0, 150000.0)}


def to_wgs84(x, y, code):
    """SWEREF 99 easting/northing (metres) in `code` -> (longitude, latitude) in degrees."""
    lon0, k0, fe = ZONES[code]
    e2 = F * (2 - F)
    n = F / (2 - F)
    a_hat = A / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64)
    xi = y / (k0 * a_hat)
    eta = (x - fe) / (k0 * a_hat)
    d1 = n / 2 - 2 * n ** 2 / 3 + 37 * n ** 3 / 96 - n ** 4 / 360
    d2 = n ** 2 / 48 + n ** 3 / 15 - 437 * n ** 4 / 1440
    d3 = 17 * n ** 3 / 480 - 37 * n ** 4 / 840
    d4 = 4397 * n ** 4 / 161280
    xi_p = (xi - d1 * math.sin(2 * xi) * math.cosh(2 * eta) - d2 * math.sin(4 * xi) * math.cosh(4 * eta)
            - d3 * math.sin(6 * xi) * math.cosh(6 * eta) - d4 * math.sin(8 * xi) * math.cosh(8 * eta))
    eta_p = (eta - d1 * math.cos(2 * xi) * math.sinh(2 * eta) - d2 * math.cos(4 * xi) * math.sinh(4 * eta)
             - d3 * math.cos(6 * xi) * math.sinh(6 * eta) - d4 * math.cos(8 * xi) * math.sinh(8 * eta))
    phi_star = math.asin(math.sin(xi_p) / math.cosh(eta_p))
    dlon = math.atan(math.sinh(eta_p) / math.cos(xi_p))
    a_s = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4
    b_s = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6
    c_s = (224 * e2 ** 3 + 889 * e2 ** 4) / 120
    d_s = -(4279 * e2 ** 4) / 1260
    s = math.sin(phi_star)
    phi = phi_star + s * math.cos(phi_star) * (a_s + b_s * s ** 2 + c_s * s ** 4 + d_s * s ** 6)
    return lon0 + math.degrees(dlon), math.degrees(phi)


def from_wgs84(lon, lat, code):
    """(longitude, latitude) in degrees -> SWEREF 99 easting/northing in `code`."""
    lon0, k0, fe = ZONES[code]
    e2 = F * (2 - F)
    n = F / (2 - F)
    a_hat = A / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64)
    phi = math.radians(lat)
    b_c = (5 * e2 ** 2 - e2 ** 3) / 6
    c_c = (104 * e2 ** 3 - 45 * e2 ** 4) / 120
    d_c = (1237 * e2 ** 4) / 1260
    s = math.sin(phi)
    phi_star = phi - s * math.cos(phi) * (e2 + b_c * s ** 2 + c_c * s ** 4 + d_c * s ** 6)
    dlon = math.radians(lon - lon0)
    xi_p = math.atan(math.tan(phi_star) / math.cos(dlon))
    eta_p = math.atanh(math.cos(phi_star) * math.sin(dlon))
    b1 = n / 2 - 2 * n ** 2 / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180
    b2 = 13 * n ** 2 / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440
    b3 = 61 * n ** 3 / 240 - 103 * n ** 4 / 140
    b4 = 49561 * n ** 4 / 161280
    north = k0 * a_hat * (xi_p + b1 * math.sin(2 * xi_p) * math.cosh(2 * eta_p) + b2 * math.sin(4 * xi_p) * math.cosh(4 * eta_p)
                          + b3 * math.sin(6 * xi_p) * math.cosh(6 * eta_p) + b4 * math.sin(8 * xi_p) * math.cosh(8 * eta_p))
    east = k0 * a_hat * (eta_p + b1 * math.cos(2 * xi_p) * math.sinh(2 * eta_p) + b2 * math.cos(4 * xi_p) * math.sinh(4 * eta_p)
                         + b3 * math.cos(6 * xi_p) * math.sinh(6 * eta_p) + b4 * math.cos(8 * xi_p) * math.sinh(8 * eta_p)) + fe
    return east, north


# ---- geometry ------------------------------------------------------------------------------------------------------------
def gpkg_geometry(blob):
    """A GeoPackage geometry blob -> GeoJSON geometry (2D; Z and M dropped)."""
    if not blob or blob[:2] != b"GP":
        return None
    flags = blob[3]
    envelope = (0, 32, 48, 48, 64)[(flags >> 1) & 7]
    geometry, _ = wkb(blob, 8 + envelope)
    return geometry


def wkb(data, pos):
    """Well-known binary at `pos` -> (GeoJSON geometry, next position)."""
    order = "<" if data[pos] == 1 else ">"
    code = struct.unpack(order + "I", data[pos + 1:pos + 5])[0]
    pos += 5
    dims = 2
    if code & 0x80000000:
        dims += 1
    if code & 0x40000000:
        dims += 1
    if code & 0x20000000:
        pos += 4
    code &= 0x0FFFFFFF
    if code >= 3000:
        dims, code = 4, code - 3000
    elif code >= 2000:
        dims, code = 3, code - 2000
    elif code >= 1000:
        dims, code = 3, code - 1000

    def point():
        nonlocal pos
        v = struct.unpack(order + "%dd" % dims, data[pos:pos + 8 * dims])
        pos += 8 * dims
        return [v[0], v[1]]

    def count():
        nonlocal pos
        c = struct.unpack(order + "I", data[pos:pos + 4])[0]
        pos += 4
        return c

    if code == 1:
        return {"type": "Point", "coordinates": point()}, pos
    if code == 2:
        return {"type": "LineString", "coordinates": [point() for _ in range(count())]}, pos
    if code == 3:
        return {"type": "Polygon", "coordinates": [[point() for _ in range(count())] for _ in range(count())]}, pos
    if code in (4, 5, 6):
        parts = []
        for _ in range(count()):
            g, pos = wkb(data, pos)
            parts.append(g["coordinates"])
        return {"type": {4: "MultiPoint", 5: "MultiLineString", 6: "MultiPolygon"}[code], "coordinates": parts}, pos
    raise SystemExit(f"WKB type {code} is not read")


def map_coords(g, fn):
    """A geometry with every position mapped by fn([x, y])."""
    def walk(c):
        return fn(c) if isinstance(c[0], (int, float)) else [walk(x) for x in c]
    return {"type": g["type"], "coordinates": walk(g["coordinates"])}


def positions(g):
    """Every position of a geometry."""
    out = []

    def walk(c):
        if isinstance(c[0], (int, float)):
            out.append(c)
        else:
            for x in c:
                walk(x)
    walk(g["coordinates"])
    return out


def simplify(points, tolerance):
    """Douglas-Peucker on a list of positions (the ends kept)."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        (x1, y1), (x2, y2) = points[i][:2], points[j][:2]
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        best, index = -1.0, -1
        for k in range(i + 1, j):
            px, py = points[k][:2]
            d = math.hypot(px - x1, py - y1) if length == 0 else abs(dy * px - dx * py + x2 * y1 - y2 * x1) / length
            if d > best:
                best, index = d, k
        if best > tolerance:
            keep[index] = True
            stack += [(i, index), (index, j)]
    return [p for p, k in zip(points, keep) if k]


def simplified(g, tolerance):
    """A geometry in metres simplified per line and ring; a ring keeps at least four positions, or is dropped."""
    t = g["type"]
    if t in ("Point", "MultiPoint"):
        return g
    if t == "LineString":
        return {"type": t, "coordinates": simplify(g["coordinates"], tolerance)}
    if t == "MultiLineString":
        return {"type": t, "coordinates": [simplify(line, tolerance) for line in g["coordinates"]]}

    def polygon(rings):
        out = []
        for ring in rings:
            s = simplify(ring, tolerance)
            out.append(s if len(s) >= 4 else ring)
        return out
    if t == "Polygon":
        return {"type": t, "coordinates": polygon(g["coordinates"])}
    return {"type": t, "coordinates": [polygon(p) for p in g["coordinates"]]}


def rounded(g, decimals):
    return map_coords(g, lambda c: [round(c[0], decimals), round(c[1], decimals)])


def ring_area(ring):
    return sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1)) / 2


def in_ring(x, y, ring):
    inside = False
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i][:2], ring[i + 1][:2]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def in_polygon(x, y, g):
    """True when (x, y) lies in a Polygon or MultiPolygon (holes respected)."""
    polygons = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
    for rings in polygons:
        if rings and in_ring(x, y, rings[0]) and not any(in_ring(x, y, hole) for hole in rings[1:]):
            return True
    return False


# ---- sources -------------------------------------------------------------------------------------------------------------
SCB = "https://api.scb.se/OV0104/v1/doris/sv/ssd/START/"
CSV = OUT / "befolkning-kommuner-2024.csv"


def municipality_codes():
    """The 290 municipality codes of the population table."""
    lines = CSV.read_text(encoding="utf-8").splitlines()
    return [line.split(";")[0] for line in lines[1:] if line.strip()]


def scb_queries():
    """{file: (table, body)}: the land area per municipality on 1 January 2025 and the dwellings completed in 2024."""
    region = {"code": "Region", "selection": {"filter": "item", "values": municipality_codes()}}
    item = lambda code, values: {"code": code, "selection": {"filter": "item", "values": values}}  # noqa: E731
    return {
        "areal.json": ("MI/MI0802/Areal2025", {"query": [region, item("ArealTyp", ["01"]), item("ContentsCode", ["000007DY"]), item("Tid", ["2025"])], "response": {"format": "json"}}),
        "lagenheter.json": ("BO/BO0101/BO0101A/LghReHustypAr", {"query": [region, item("Hustyp", ["FLERBO", "SMÅHUS"]), item("ContentsCode", ["BO0101A5"]), item("Tid", ["2024"])], "response": {"format": "json-stat2"}}),
    }


def fetch(folder):
    """The sources in `folder`, fetched when missing."""
    folder.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        target = folder / name
        if target.exists():
            continue
        print(f"  fetching {url}")
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=120) as r:
            target.write_bytes(r.read())
    for name, digest in SHA256.items():
        if hashlib.sha256((folder / name).read_bytes()).hexdigest() != digest:
            print(f"  NOTE: {name} differs from the file read on 2026-11-28")
    for name, (table, body) in scb_queries().items():
        target = folder / name
        if target.exists():
            continue
        print(f"  fetching SCB {table}")
        req = urllib.request.Request(SCB + table, data=json.dumps(body).encode("utf-8"), headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            target.write_bytes(r.read())


def gpkg_layers(path):
    """{table: [(properties, geometry)]} of a GeoPackage's feature tables, opened read only."""
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    out = {}
    for (table,) in con.execute("select table_name from gpkg_contents where data_type = 'features'"):
        geom = con.execute("select column_name from gpkg_geometry_columns where table_name = ?", (table,)).fetchone()[0]
        cols = [r[1] for r in con.execute(f'pragma table_info("{table}")')]
        rows = []
        for r in con.execute(f'select * from "{table}"'):
            props = {c: v for c, v in zip(cols, r) if c != geom}
            rows.append((props, gpkg_geometry(r[cols.index(geom)])))
        out[table] = rows
    con.close()
    return out


def kommun(code):
    """A municipality's feature in presets/geo/kommuner.geojson (WGS 84)."""
    data = json.loads(KOMMUNER.read_text(encoding="utf-8"))
    return next(f for f in data["features"] if str(f["properties"].get("kommunkod")) == code)


def ident(*parts):
    """A stable UUID for an object of the examples."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "https://github.com/marwiss/Dataspatium/presets/exempeldata/" + "/".join(str(p) for p in parts)))


def write_json(name, data):
    path = OUT / name
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"  wrote {path.relative_to(ROOT).as_posix()} ({path.stat().st_size} bytes)")


GEOMETRY_TYPES = {"Point": "punkt", "MultiPoint": "multipunkt", "LineString": "linje", "MultiLineString": "multilinje", "Polygon": "yta", "MultiPolygon": "multiyta"}
LOMMA_BOX = (110000, 6160000, 135000, 6190000)  # SWEREF 99 13 30; a position outside is a fault in the source


def described(g, code=3008):
    """A geometry in metres as Lantmäteriet's geometry description (geometri 2.0)."""
    return {"typ": GEOMETRY_TYPES[g["type"]], "position": g, "koordinatsystemPlan": f"EPSG:{code}", "dimension": 2}


# ---- Översiktsplan 2020, Lomma --------------------------------------------------------------------------------------------
# Boverket's ÖP catalogue 2.3: the categories (grupp) and values the examples use, with their ids.
OP_GROUPS = {
    "Mark- och vattenanvändning": "70f1021e-cf01-4537-b5b2-715986f16259", "Kompletterande mark- och vattenanvändning": "41c782fd-69c7-43db-9822-fd367b695dd8",
    "Utvecklingsinriktning": "18a5af9e-9d90-486d-a621-655beef034d5", "Klimatrelaterade risker": "2c944baa-28be-4a8b-80f8-99721744c0d9",
    "Plangeometri": "aa96e31c-3a39-40d7-9b9f-fb85521884ae", "Planhändelse": "68ac20f6-636d-4670-a526-61099b91596d",
}
OP_VALUES = {
    "Bostadsbebyggelse": "2b17bfa0-235d-49ac-8c7d-24afb9f22b8b", "Verksamheter": "4bfe4481-f0ba-40a1-8c21-431e8b482b6b", "Vattenbruk": "93392734-2c68-4d92-a2d4-b50e7fc6c298",
    "Friluftsliv och rekreation": "963659ac-a995-46dc-9aaf-01c2b0ffc25c", "Natur- och kulturlandskap": "87284180-0252-452d-8a6f-d07609774dd3", "Landsbygd": "480de539-fd3c-45e1-b4fc-76b6832cec0e",
    "Vatten": "04c5c35b-2c04-4d94-96c4-d9360670bdb0", "Teknisk infrastruktur": "4a6f0666-6bf2-4d10-b9e6-700e0307f69f", "Järnväg": "7f68b049-6a98-4120-8a51-1448ee467349",
    "Grön- och blåstruktur": "d3c30c5a-e02c-4061-b95a-9b8e4cf16478", "Kommunikation": "a6a710f6-d8cb-44f7-8cda-f3f910371a45", "Risk för översvämning": "1e0c2483-741b-4c6b-b3fc-a131738dc270",
    "Idrotts- och sportanläggning": "0ab3d49d-6454-48c5-a264-63aa8d7824e2", "Naturmiljö": "7d48ec36-0d7a-46df-b0fc-417d5aa48d6a", "Badplats": "37f8d402-8135-47e2-8caf-fa2c528e1fb2",
    "Dagvattenhantering": "da267dba-12a5-4e54-af98-9f443db760b6", "Avloppshantering": "40b0700a-5012-43ce-9fa8-a095a418c9dc", "Resecentrum": "abd9f721-8590-4cc8-ae73-64fc61fbee10",
    "Materialåtervinning": "cedcdcc7-4598-435c-aeb3-6b9772cff025", "Plangeometri": "aa96e31c-3a39-40d7-9b9f-fb85521884ae", "Antagen": "fa5ec73a-b691-409f-b088-6e0ec1488fda",
}
MOV = "Mark- och vattenanvändning"
# Lomma's layers -> (category, value, complementary use, name). The placing in the catalogue is the example's, not Lomma's.
OP_LAYERS = {
    "Utbyggnadsomrade_bostader": (MOV, "Bostadsbebyggelse", None, "Utbyggnadsområde för bostäder"),
    "Verksamhetsomrade": (MOV, "Verksamheter", None, "Nytt verksamhetsområde"),
    "Nytt_verksamhetsomrade_grona_naringar": (MOV, "Verksamheter", None, "Nytt verksamhetsområde, gröna näringar"),
    "Nytt_verksamhetsomrade_bla_naringar": (MOV, "Vattenbruk", None, "Nytt verksamhetsområde, blå näringar"),
    "Omvandling_till_ej_miljostorande_verksamhet": (MOV, "Verksamheter", None, "Omvandling till lättare industri"),
    "Idrottsplats": (MOV, "Friluftsliv och rekreation", "Idrotts- och sportanläggning", "Idrottsplats"),
    "Naturreservat": (MOV, "Natur- och kulturlandskap", "Naturmiljö", "Naturreservat"),
    "Hansynsomrade_landsbygd": (MOV, "Landsbygd", None, "Respekt landsbygd"),
    "Sarskilt_vardefullt_havsomrade": (MOV, "Vatten", "Naturmiljö", "Särskilt värdefullt havsområde"),
    "Hansynsomrade_Bad_och_friluftsliv": (MOV, "Vatten", "Badplats", "Hänsynsområde, bad och friluftsliv"),
    "Hansynsomrade_Hoga_marina_naturvarden": (MOV, "Vatten", "Naturmiljö", "Hänsynsområde, höga marina naturvärden"),
    "Fordrojningsdamm": (MOV, "Teknisk infrastruktur", "Dagvattenhantering", "Fördröjningsdamm"),
    "Skyddsomrade_avloppsreningsverk": (MOV, "Teknisk infrastruktur", "Avloppshantering", "Skyddsområde kring avloppsreningsverk"),
    "Tagstation": (MOV, "Järnväg", "Resecentrum", "Tågstation"),
    "Plats_for_tillfalligt_upplag": (MOV, "Teknisk infrastruktur", "Materialåtervinning", "Plats för tillfälligt upplag"),
    "Plats_for_upplag": (MOV, "Teknisk infrastruktur", "Materialåtervinning", "Plats för upplag"),
    "Respekt_kustzon": ("Utvecklingsinriktning", "Grön- och blåstruktur", None, "Respekt kustzon"),
    "Ekologisk_korridor": ("Utvecklingsinriktning", "Grön- och blåstruktur", None, "Ekologisk korridor"),
    "Kompensationsomraden": ("Utvecklingsinriktning", "Grön- och blåstruktur", None, "Kompensationsområde"),
    "Forbindelse": ("Utvecklingsinriktning", "Kommunikation", None, "Förbindelse"),
    "Supercykelstrak": ("Utvecklingsinriktning", "Kommunikation", None, "Supercykelstråk"),
    "Oversvamningsomrade": ("Klimatrelaterade risker", "Risk för översvämning", None, "Översvämningsområde"),
    "Reservat_for_skyddsvall": ("Klimatrelaterade risker", "Risk för översvämning", None, "Reservat för skyddsvall"),
}
OP_TITLE = "Översiktsplan 2020 för Lomma kommun, Plankarta 2030"


def catalogue(group, value):
    return {"varde": value, "vardereferens": OP_VALUES[value], "grupp": group, "gruppreferens": OP_GROUPS[group]}


def inside_box(c):
    return LOMMA_BOX[0] <= c[0] <= LOMMA_BOX[2] and LOMMA_BOX[1] <= c[1] <= LOMMA_BOX[3]


def merged(geometries):
    """Geometries of one kind as one (multi)geometry; parts with positions outside Lomma are left out."""
    parts = {"Point": [], "LineString": [], "Polygon": []}
    for g in geometries:
        if g is None:
            continue
        single = g["type"].replace("Multi", "")
        for part in (g["coordinates"] if g["type"].startswith("Multi") else [g["coordinates"]]):
            if all(inside_box(c) for c in positions({"type": single, "coordinates": part})):
                parts[single].append(part)
    kinds = [k for k, v in parts.items() if v]
    if len(kinds) != 1:
        raise SystemExit(f"mixed or no geometry: {kinds}")
    kind = kinds[0]
    found = parts[kind]
    return {"type": kind, "coordinates": found[0]} if len(found) == 1 else {"type": "Multi" + kind, "coordinates": found}


def build_op(folder):
    """Lomma's Översiktsplan 2020 (Plankarta 2030) as Översiktsplan 2.0 GeoJSON; returns its plan geometry in SWEREF 99 13 30."""
    layers = gpkg_layers(folder / "op.gpkg")
    missing = sorted(set(layers) - set(OP_LAYERS))
    if missing:
        raise SystemExit(f"layers without a category: {missing}")
    plan_id = ident("lomma-op-2020")
    when = "2022-03-01T00:00:00+01:00"
    antagen = catalogue("Planhändelse", "Antagen")
    boundary = kommun("1262")["geometry"]
    boundary = rounded(map_coords(boundary, lambda c: list(from_wgs84(c[0], c[1], 3008))), 1)
    features = [{"type": "Feature", "geometry": None, "properties": {
        "feature:typ": "oversiktsplan", "objektidentitet": plan_id, "versionGiltigFran": when, "kommunkod": "1262", "kommunnamn": "Lomma",
        "planhandelse": antagen, "planensTitel": OP_TITLE, "digitaltUrsprung": False}}]
    features.append({"type": "Feature", "geometry": None, "properties": {
        "feature:typ": "innehallOP", "objektidentitet": ident("lomma-op-2020", "plangeometri"), "versionGiltigFran": when, "oversiktsplan": plan_id,
        "innehallstyp": catalogue("Plangeometri", "Plangeometri"), "planhandelse": antagen, "namn": "Lomma kommun",
        "precisering": "Kommungränsen ur SCB:s Digitala gränser (CC0), förenklad för tematiska kartor.", "geometri": described(boundary)}})
    for layer in sorted(layers, key=lambda k: list(OP_LAYERS).index(k)):
        group, value, extra, label = OP_LAYERS[layer]
        # One object per layer and text: Lomma repeats the same statement on every part of a layer.
        groups = {}
        for props, g in layers[layer]:
            own = str(props.get("name") or props.get("typ") or props.get("type") or "").strip()
            name = own if own and own.lower() != label.lower() and layer not in ("Hansynsomrade_Bad_och_friluftsliv", "Hansynsomrade_Hoga_marina_naturvarden", "Sarskilt_vardefullt_havsomrade", "Oversvamningsomrade", "Tagstation", "Plats_for_tillfalligt_upplag", "Plats_for_upplag") else label
            if layer == "Kompensationsomraden":
                name = str(props.get("layer") or label)
            key = (name, str(props.get("info") or "").strip(), str(props.get("development") or "").strip())
            groups.setdefault(key, []).append(g)
        for n, ((name, info, development), geoms) in enumerate(sorted(groups.items())):
            g = rounded(simplified(merged(geoms), 1.0), 1)
            p = {"feature:typ": "innehallOP", "objektidentitet": ident("lomma-op-2020", layer, n), "versionGiltigFran": when, "oversiktsplan": plan_id,
                 "innehallstyp": catalogue(group, value)}
            if extra:
                p["kompletterandeInnehallstyp"] = catalogue("Kompletterande mark- och vattenanvändning", extra)
            p.update({"planhandelse": antagen, "illustrativaGranser": True, "namn": name})
            if info:
                p["precisering"] = info
            if development:
                p["utbyggnadsordning"] = development
            p["geometri"] = described(g)
            features.append({"type": "Feature", "geometry": None, "properties": p})
    write_json("lomma-op-2020.geojson", {"type": "FeatureCollection", "feature:mediatyp": "application/vnd.lm.oversiktsplan.v2+json", "features": features})
    return {"plan": boundary, "bostader": [merged([g]) for _, g in layers["Utbyggnadsomrade_bostader"]]}


# ---- Detaljplan för Björreds vångar etapp I --------------------------------------------------------------------------------
def clip(ring, axis, value, above):
    """Sutherland-Hodgman: the part of a closed ring on one side of the line coordinate[axis] = value."""
    inside = (lambda p: p[axis] >= value) if above else (lambda p: p[axis] < value)
    out = []
    pts = ring[:-1]
    for i, cur in enumerate(pts):
        prev = pts[i - 1]
        if inside(cur):
            if not inside(prev):
                out.append(cross(prev, cur, axis, value))
            out.append(cur)
        elif inside(prev):
            out.append(cross(prev, cur, axis, value))
    return out + out[:1] if len(out) >= 3 else []


def cross(a, b, axis, value):
    t = (value - a[axis]) / (b[axis] - a[axis])
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]


def band(ring, low, high):
    """The part of a ring with low <= northing < high."""
    part = clip(ring, 1, low, True) if low is not None else ring
    return clip(part, 1, high, False) if part and high is not None else part


# Boverket's Planbestämmelsekatalog (presets/plan/planbestammelsekatalogen.json, release 20251201): the provisions the example uses.
DP_PROVISIONS = {
    "B": {"ref": "f9e056a6-cda8-4b92-a15d-dc70d61dfa36", "typ": "användningsbestämmelse", "kod": "DP_KM_B2", "beteckning": "B", "kategori": "Bostäder", "form": "Kvartersmark", "formulering": "Bostäder", "farg": "Gul"},
    "GATA": {"ref": "7f46c19a-343d-433e-9ff8-59679eed36d8", "typ": "användningsbestämmelse", "kod": "DP_AP_Gata", "beteckning": "GATA", "kategori": "Gata", "form": "Allmän plats", "formulering": "Gata", "farg": "Ljusgrå"},
    "NATUR": {"ref": "494ba693-e059-4557-8004-2a53363ea080", "typ": "användningsbestämmelse", "kod": "DP_AP_Natur", "beteckning": "NATUR", "kategori": "Natur", "form": "Allmän plats", "formulering": "Natur", "farg": "Ljusgrön"},
    "h": {"ref": "ee5f8de3-89b0-479a-a5cb-7439d40623e8", "typ": "egenskapsbestämmelse", "kod": "DP_KM_Eg_Hojd_HogstaHojd_Nockhojd", "beteckning": "h1", "kategori": "Höjd på byggnadsverk", "underkategori": "Högsta höjd på byggnadsverk", "form": "Kvartersmark", "formulering": "Högsta nockhöjd är [höjd:decimaltal] meter.", "varde": [{"datatyp": "decimaltal", "variabelvarde": 9.0, "beskrivning": "höjd", "vardetyp": "max", "enhet": "meter"}]},
    "e": {"ref": "4d971f5d-eb6f-4ca0-b20d-8d7005a9c617", "typ": "egenskapsbestämmelse", "kod": "DP_KM_Eg_Utnytt_StorstaAreaKvm_ByggnadsareaFastigh", "beteckning": "e1", "kategori": "Utnyttjandegrad", "underkategori": "Största area i kvm", "form": "Kvartersmark", "formulering": "Största byggnadsarea är [exploatering:decimaltal] m² per fastighet.", "varde": [{"datatyp": "decimaltal", "variabelvarde": 250.0, "beskrivning": "exploatering", "vardetyp": "max", "enhet": "m²"}]},
    "prick": {"ref": "f63321f7-04a1-4e2c-9ab1-467a2f24a9bb", "typ": "egenskapsbestämmelse", "kod": "DP_KM_Eg_BegransningAvMarkensUtnyttjande_EjByggnadsverk_Prickmark", "beteckning": "", "kategori": "Begränsning av markens utnyttjande", "underkategori": "Marken får inte förses med byggnadsverk", "form": "Kvartersmark", "formulering": "Marken får inte förses med byggnad."},
}
DP_MOTIVES = {
    "B": "Exempel: bostäder i den norra delen av planområdet, i enlighet med översiktsplanens utbyggnadsområde för Björreds vångar.",
    "GATA": "Exempel: en lokalgata som skiljer bostäderna från naturmarken.",
    "NATUR": "Exempel: naturmark i planområdets södra del för dagvatten och rekreation.",
    "h": "Exempel: en- och tvåbostadshus i två våningar.",
    "e": "Exempel: småhustomter med plats för trädgård.",
    "prick": "Exempel: förgårdsmark mot gatan.",
}


def build_dp(folder):
    """The plan area of Björreds vångar etapp I with example provisions as Detaljplan 4.1 GeoJSON; returns its parts in metres."""
    props, g = next((p, g) for p, g in gpkg_layers(folder / "dp.gpkg")["pagaende_detaljplaner_lomma"] if "etapp I)" in str(p.get("Namn")))
    area = rounded(map_coords(g, lambda c: list(from_wgs84(c[0], c[1], 3008))), 3)
    ring = area["coordinates"][0]
    south = min(p[1] for p in ring)
    street_low, street_high = south + 130.0, south + 142.0
    parts = {
        "NATUR": band(ring, None, street_low), "GATA": band(ring, street_low, street_high), "B": band(ring, street_high, None),
        "prick": band(ring, street_high, street_high + 6.0),
    }
    parts["h"] = parts["e"] = parts["B"]
    plan_id = ident("lomma-dp-bjorreds-vangar")
    when = "2022-12-22T00:00:00+01:00"
    own = lambda key: {"objektidentitet": ident("lomma-dp-bjorreds-vangar", key), "objektversion": 1, "versionGiltigFran": when}  # noqa: E731
    order = ["B", "GATA", "NATUR", "h", "e", "prick"]
    plan = {"feature:typ": "detaljplan", "objektidentitet": plan_id, "objektversion": 1, "versionGiltigFran": when, "kommun": "1262",
            "beteckning": "", "namn": "Detaljplan för del av Björred 9:1 m.fl. i Björred (Björreds vångar etapp I)",
            "syfte": str(props.get("Syfte") or "").strip(), "status": "samråd", "typ": "detaljplan", "datumStatusforandring": "2022-12-22",
            "plangeometri": [{"geometri": described(area)}],
            "beslutsinformation": [{"diarienummerKommun": str(props.get("Diarienummer") or "").strip(), "planbestammelse": [own(k)["objektidentitet"] for k in order]}]}
    features = [{"type": "Feature", "id": plan_id, "geometry": None, "properties": plan}]
    for key in order:
        d = DP_PROVISIONS[key]
        p = {"feature:typ": d["typ"], "detaljplan": plan_id}
        p.update(own(key))
        p.update({"planbestammelsekatalogreferens": d["ref"], "bestammelseformulering": d["formulering"], "bestammelsekod": d["kod"]})
        if d["beteckning"]:
            p["beteckning"] = d["beteckning"]
        p["kategori"] = d["kategori"]
        if d.get("underkategori"):
            p["underkategori"] = d["underkategori"]
        p["anvandningsform"] = d["form"]
        if d.get("farg"):
            p["farg"] = d["farg"]
        if d.get("varde"):
            p["bestammelsevarde"] = d["varde"]
        p["bestammelsegeometri"] = [{"geometri": described(rounded({"type": "Polygon", "coordinates": [parts[key]]}, 3))}]
        p["planbestammelsebeskrivning"] = {"motiv": DP_MOTIVES[key]}
        features.append({"type": "Feature", "id": p["objektidentitet"], "geometry": None, "properties": p})
    write_json("lomma-dp-bjorreds-vangar.geojson", {"type": "FeatureCollection", "feature:mediatyp": "application/vnd.lm.detaljplan.v4+json", "features": features})
    return {"area": area, "B": {"type": "Polygon", "coordinates": [parts["B"]]}, "prick": {"type": "Polygon", "coordinates": [parts["prick"]]}}


# ---- the house -------------------------------------------------------------------------------------------------------------
def step_entities(text):
    """{id: (TYPE, argument text)} of a STEP file's data section (single-line entities, as the sample file writes them)."""
    out = {}
    for line in text.splitlines():
        if line.startswith("#") and "=" in line:
            ref, rest = line.split("=", 1)
            rest = rest.strip().rstrip(";")
            kind, args = rest.split("(", 1)
            out[int(ref[1:])] = (kind.strip(), args[:-1])
    return out


def split_args(args):
    """The top-level arguments of a STEP entity's argument text (commas inside strings and lists kept)."""
    out, depth, quoted, cur = [], 0, False, ""
    for ch in args:
        if ch == "'":
            quoted = not quoted
        elif not quoted and ch == "(":
            depth += 1
        elif not quoted and ch == ")":
            depth -= 1
        elif not quoted and depth == 0 and ch == ",":
            out.append(cur)
            cur = ""
            continue
        cur += ch
    return out + [cur]


def numbers(args):
    return [float(x) for x in args.strip("()").split(",")]


def frame(entities, placement):
    """The 2D frame (origin x, y, z and the x axis's angle) of an IfcLocalPlacement in the model's coordinates, in file units."""
    kind, args = entities[placement]
    if kind != "IFCLOCALPLACEMENT":
        raise SystemExit(f"#{placement} is no IfcLocalPlacement")
    parent, axis = [a.strip() for a in split_args(args)]
    _, a2 = entities[int(axis[1:])]
    loc, _z, ref = [a.strip() for a in split_args(a2)]
    x, y, z = numbers(entities[int(loc[1:])][1])
    angle = 0.0
    if ref != "$":
        dx, dy, _ = numbers(entities[int(ref[1:])][1])
        angle = math.atan2(dy, dx)
    if parent == "$":
        return x, y, z, angle
    px, py, pz, pa = frame(entities, int(parent[1:]))
    return px + x * math.cos(pa) - y * math.sin(pa), py + x * math.sin(pa) + y * math.cos(pa), pz + z, pa + angle


def compound(degrees):
    """An IfcCompoundPlaneAngleMeasure as STEP text, every part with the sign (as set_site writes it)."""
    sign = -1 if degrees < 0 else 1
    micro = int(round(abs(degrees) * 3600.0 * 1000000.0))
    d, micro = divmod(micro, 3600 * 1000000)
    m, micro = divmod(micro, 60 * 1000000)
    s, micro = divmod(micro, 1000000)
    return "(%d,%d,%d,%d)" % (sign * d, sign * m, sign * s, sign * micro)


HEIGHT = 10.0  # the ground floor's height above sea level in metres (RH 2000), about that of the fields at Björred


def lot(dp, housing):
    """A place for the house: the point of the residential area, outside the front yard and in the ÖP's area for housing, farthest
    from the residential area's edges, on a 2 m grid."""
    b, prick = dp["B"], dp["prick"]
    pts = b["coordinates"][0]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    edges = list(zip(pts, pts[1:]))

    def distance(x, y):
        best = float("inf")
        for (x1, y1), (x2, y2) in edges:
            dx, dy = x2 - x1, y2 - y1
            t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy or 1)))
            best = min(best, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
        return best
    best = (-1.0, None)
    y = min(ys)
    while y <= max(ys):
        x = min(xs)
        while x <= max(xs):
            if in_polygon(x, y, b) and not in_polygon(x, y, prick) and any(in_polygon(x, y, g) for g in housing):
                d = distance(x, y)
                if d > best[0]:
                    best = (d, (x, y))
            x += 2.0
        y += 2.0
    return best[1]


def build_house(folder, dp, housing):
    """buildingSMART's sample house placed on a lot in the plan area; returns the house's place."""
    text = (folder / "house.ifc").read_text(encoding="utf-8")
    entities = step_entities(text)
    if "FILE_SCHEMA(('IFC4'))" not in text:
        raise SystemExit("the sample house is not IFC4")
    scale = 0.001  # the file's length unit is the millimetre
    # The house's middle in the model: the building's placement and half its walls' extent (5.6 m by 6.2 m).
    bx, by, bz, ba = frame(entities, 40)
    mx = bx + (2800 * math.cos(ba) - 3000 * math.sin(ba))
    my = by + (2800 * math.sin(ba) + 3000 * math.cos(ba))
    lx, ly = lot(dp, housing)
    # The map conversion without rotation: model x east, model y north.
    eastings, northings = lx - mx * scale, ly - my * scale
    to_map = lambda x, y: (eastings + x * scale, northings + y * scale)  # noqa: E731
    replaced = {
        3: "IFCPERSON('user','User',$,$,$,$,$,$)",
        18: "IFCPROJECTEDCRS('EPSG:3008','SWEREF 99 13 30 + RH 2000','SWEREF99','RH 2000','Transverse Mercator','13 30',#19)",
        20: "IFCMAPCONVERSION(#11,#18,%.3f,%.3f,%.3f,1.,0.,0.001)" % (eastings, northings, HEIGHT),
    }
    for site in (21, 28):
        kind, args = entities[site]
        parts = split_args(args)
        sx, sy, sz, _ = frame(entities, int(parts[5].strip()[1:]))
        lon, lat = to_wgs84(*to_map(sx, sy), 3008)
        head = ",".join(parts[:9])
        tail = ",".join(parts[12:])
        replaced[site] = "IFCSITE(%s,%s,%s,%.1f,%s)" % (head, compound(lat), compound(lon), HEIGHT * 1000 + sz, tail)
    parts = split_args(entities[35][1])
    if parts[9:] != ["$", "$", "$"]:
        raise SystemExit("the building's elevation is already set")
    replaced[35] = "IFCBUILDING(%s,%.1f,$,$)" % (",".join(parts[:9]), HEIGHT * 1000 + bz)
    lines = []
    for line in text.splitlines():
        if line.startswith("FILE_NAME("):
            line = line.replace("'Building-Architecture.ifc'", "'bjorreds-vangar-hus.ifc'", 1)
        if line.startswith("#") and "=" in line:
            ref = int(line.split("=", 1)[0][1:])
            if ref in replaced:
                line = "#%d=%s;" % (ref, replaced[ref])
        lines.append(line)
    out = "\n".join(lines) + "\n"
    if "Jan B." in out:
        raise SystemExit("a person's name is left in the house")
    path = OUT / "bjorreds-vangar-hus.ifc"
    path.write_text(out, encoding="utf-8", newline="\n")
    print(f"  wrote {path.relative_to(ROOT).as_posix()} ({path.stat().st_size} bytes)")
    middle = to_wgs84(lx, ly, 3008)
    return {"lot": (lx, ly), "wgs84": middle, "origin": (eastings, northings)}


# ---- SCB -------------------------------------------------------------------------------------------------------------------
def build_tables(folder):
    """The population table with the land area added, and SCB's JSON-stat answer for the completed dwellings."""
    area = json.loads((folder / "areal.json").read_text(encoding="utf-8-sig"))
    km2 = {row["key"][0]: row["values"][0] for row in area["data"]}
    lines = CSV.read_text(encoding="utf-8").splitlines()
    header = lines[0].split(";")
    if "landareal_km2" not in header:
        header.append("landareal_km2")
    out = [";".join(header)]
    for line in lines[1:]:
        cells = line.split(";")[:6]
        value = km2.get(cells[0])
        if value is None or not re.fullmatch(r"\d+(\.\d+)?", value):
            raise SystemExit(f"no land area for {cells[0]}")
        out.append(";".join(cells + [value]))
    CSV.write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    print(f"  wrote {CSV.relative_to(ROOT).as_posix()} ({len(out) - 1} municipalities)")
    stat = json.loads((folder / "lagenheter.json").read_text(encoding="utf-8-sig"))
    if stat.get("class") != "dataset" or stat.get("version") != "2.0" or len(stat.get("value", [])) != 580:
        raise SystemExit("SCB's answer is not the JSON-stat 2.0 dataset asked for")
    # The answer names the statistics unit to contact; the example keeps the statistics and its notes, not the contact.
    stat.get("extension", {}).pop("contact", None)
    write_json("fardigstallda-lagenheter-2024.json", stat)


# ---- the municipalities' neighbours ----------------------------------------------------------------------------------------
def neighbours():
    """{(code, code): shared border in km} of the municipalities that share a stretch of border (not a single point)."""
    data = json.loads(KOMMUNER.read_text(encoding="utf-8"))
    segments = {}
    for f in data["features"]:
        code = f["properties"]["kommunkod"]
        g = f["geometry"]
        for rings in ([g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]):
            for ring in rings:
                for a, b in zip(ring, ring[1:]):
                    a, b = tuple(a), tuple(b)
                    if a != b:
                        segments.setdefault((a, b) if a < b else (b, a), set()).add(code)
    pairs = {}
    for ((x1, y1), (x2, y2)), codes in segments.items():
        if len(codes) == 2:
            key = tuple(sorted(codes))
            km = math.hypot((x2 - x1) * 111.32 * math.cos(math.radians((y1 + y2) / 2)), (y2 - y1) * 110.57)
            pairs[key] = pairs.get(key, 0.0) + km
    return data["features"], pairs


def cypher_text(v):
    return json.dumps(v, ensure_ascii=False)


def build_graph():
    features, pairs = neighbours()
    lines = [
        "// Sveriges kommuner och vilka som gränsar till varandra (en gemensam gräns, inte bara en punkt), i APOC:s exportform för Neo4j.",
        "// Uträknat av Dataspatium ur SCB:s Digitala gränser (CC0), förenklade för tematiska kartor; öar utan landgräns får inga grannar.",
        "CREATE CONSTRAINT UNIQUE_IMPORT_NAME FOR (node:`UNIQUE IMPORT LABEL`) REQUIRE (node.`UNIQUE IMPORT ID`) IS UNIQUE;",
    ]
    for f in sorted(features, key=lambda f: f["properties"]["kommunkod"]):
        p = f["properties"]
        lines.append("CREATE (:Kommun:`UNIQUE IMPORT LABEL` {kommunkod: %s, namn: %s, lanskod: %s, lan: %s, `UNIQUE IMPORT ID`: %s});" % (
            cypher_text(p["kommunkod"]), cypher_text(p["kommun"]), cypher_text(p["lanskod"]), cypher_text(p["lan"]), cypher_text(p["kommunkod"])))
    for (a, b), km in sorted(pairs.items()):
        lines.append("MATCH (n1:`UNIQUE IMPORT LABEL` {`UNIQUE IMPORT ID`: %s}), (n2:`UNIQUE IMPORT LABEL` {`UNIQUE IMPORT ID`: %s}) CREATE (n1)-[:GRANSAR_TILL {gemensam_grans_km: %.1f}]->(n2);" % (cypher_text(a), cypher_text(b), km))
    lines += [
        "MATCH (n:`UNIQUE IMPORT LABEL`) WITH n LIMIT 20000 REMOVE n:`UNIQUE IMPORT LABEL` REMOVE n.`UNIQUE IMPORT ID`;",
        "DROP CONSTRAINT UNIQUE_IMPORT_NAME;",
    ]
    path = OUT / "kommungrannar.cypher"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(f"  wrote {path.relative_to(ROOT).as_posix()} ({len(features)} municipalities, {len(pairs)} borders, {path.stat().st_size} bytes)")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    folder = pathlib.Path(sys.argv[1]).resolve()
    if ROOT in folder.parents or folder == ROOT:
        raise SystemExit("the download folder must lie outside the repository")
    fetch(folder)
    op = build_op(folder)
    dp = build_dp(folder)
    house = build_house(folder, dp, op["bostader"])
    # The chain the examples promise: the house in the residential area and in the ÖP's area for housing, the plan area in the ÖP.
    lx, ly = house["lot"]
    ring = dp["area"]["coordinates"][0]
    checks = {
        "house in B": in_polygon(lx, ly, dp["B"]),
        "plan area in Lomma": all(in_polygon(x, y, op["plan"]) for x, y in ring),
        "house in the ÖP's housing area": any(in_polygon(lx, ly, g) for g in op["bostader"]),
    }
    print("  checks:", checks, "house at", ["%.6f" % v for v in house["wgs84"]])
    if not all(checks.values()):
        raise SystemExit("the examples do not lie inside each other")
    build_tables(folder)
    build_graph()


if __name__ == "__main__":
    main()
