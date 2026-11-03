#!/usr/bin/env python3
"""Build the bundled county and municipality boundaries (presets/geo/*.geojson) from SCB's open
boundary files ("Digitala gränser", licence CC0).

SCB publishes simplified county and municipality polygons for thematic mapping as shapefiles in
SWEREF 99 TM. This script reads the shapefiles with the standard library only, converts the
coordinates to WGS 84 longitude/latitude (Gauss-Krüger inverse with Lantmäteriet's formulas,
millimetre accuracy) and writes compact GeoJSON FeatureCollections. Ring orientation is kept as in
the shapefile (outer rings clockwise), which is what d3-geo and Vega expect for spherical polygons.

Usage:
    python tools/build_boundaries.py [path/to/shape_svenska_YYMMDD.zip]

Without an argument the current archive is downloaded from SCB. Afterwards run
`python tools/wrap_local.py` to refresh the embedded copies the app loads via file://.
"""
import io
import json
import math
import pathlib
import struct
import sys
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "presets" / "geo"
SCB_URL = "https://www.scb.se/contentassets/3443fea3fa6640f7a57ea15d9a372d33/shape_svenska_260225.zip"
SCB_PAGE = "https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/digitala-granser/"
DECIMALS = 5  # about one metre

# GRS 80 ellipsoid and the SWEREF 99 TM projection (EPSG:3006).
A = 6378137.0
F = 1 / 298.257222101
K0 = 0.9996
LON0 = math.radians(15.0)
FALSE_N = 0.0
FALSE_E = 500000.0


def sweref_to_wgs84(x, y):
    """SWEREF 99 TM easting/northing (metres) -> (longitude, latitude) in degrees."""
    e2 = F * (2 - F)
    n = F / (2 - F)
    a_hat = A / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64)
    xi = (y - FALSE_N) / (K0 * a_hat)
    eta = (x - FALSE_E) / (K0 * a_hat)
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
    return math.degrees(LON0 + dlon), math.degrees(phi)


def wgs84_to_sweref(lon, lat):
    """(longitude, latitude) in degrees -> SWEREF 99 TM easting/northing; used to check the inverse."""
    e2 = F * (2 - F)
    n = F / (2 - F)
    a_hat = A / (1 + n) * (1 + n ** 2 / 4 + n ** 4 / 64)
    phi = math.radians(lat)
    a_c = e2
    b_c = (5 * e2 ** 2 - e2 ** 3) / 6
    c_c = (104 * e2 ** 3 - 45 * e2 ** 4) / 120
    d_c = (1237 * e2 ** 4) / 1260
    s = math.sin(phi)
    phi_star = phi - s * math.cos(phi) * (a_c + b_c * s ** 2 + c_c * s ** 4 + d_c * s ** 6)
    dlon = math.radians(lon) - LON0
    xi_p = math.atan(math.tan(phi_star) / math.cos(dlon))
    eta_p = math.atanh(math.cos(phi_star) * math.sin(dlon))
    b1 = n / 2 - 2 * n ** 2 / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180
    b2 = 13 * n ** 2 / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440
    b3 = 61 * n ** 3 / 240 - 103 * n ** 4 / 140
    b4 = 49561 * n ** 4 / 161280
    north = K0 * a_hat * (xi_p + b1 * math.sin(2 * xi_p) * math.cosh(2 * eta_p) + b2 * math.sin(4 * xi_p) * math.cosh(4 * eta_p)
                          + b3 * math.sin(6 * xi_p) * math.cosh(6 * eta_p) + b4 * math.sin(8 * xi_p) * math.cosh(8 * eta_p)) + FALSE_N
    east = K0 * a_hat * (eta_p + b1 * math.cos(2 * xi_p) * math.sinh(2 * eta_p) + b2 * math.cos(4 * xi_p) * math.sinh(4 * eta_p)
                         + b3 * math.cos(6 * xi_p) * math.sinh(6 * eta_p) + b4 * math.cos(8 * xi_p) * math.sinh(8 * eta_p)) + FALSE_E
    return east, north


def read_shp(data):
    """Polygon shapefile (type 5) -> per record a list of rings, each a list of (x, y)."""
    if struct.unpack(">i", data[:4])[0] != 9994:
        raise SystemExit("not a shapefile")
    shape_type = struct.unpack("<i", data[32:36])[0]
    if shape_type not in (5, 15, 25):
        raise SystemExit(f"unsupported shape type {shape_type}")
    pos, records = 100, []
    while pos + 8 <= len(data):
        content_len = struct.unpack(">i", data[pos + 4:pos + 8])[0] * 2
        rec = data[pos + 8:pos + 8 + content_len]
        pos += 8 + content_len
        if struct.unpack("<i", rec[:4])[0] == 0:
            records.append([])
            continue
        num_parts, num_points = struct.unpack("<ii", rec[36:44])
        parts = struct.unpack("<%di" % num_parts, rec[44:44 + 4 * num_parts])
        off = 44 + 4 * num_parts
        flat = struct.unpack("<%dd" % (2 * num_points), rec[off:off + 16 * num_points])
        coords = [(flat[2 * i], flat[2 * i + 1]) for i in range(num_points)]
        records.append([coords[parts[i]:(parts[i + 1] if i + 1 < num_parts else num_points)] for i in range(num_parts)])
    return records


def read_dbf(data):
    """dBASE attribute table -> list of dicts (strings, trimmed). UTF-8 when valid, else Windows-1252."""
    count = struct.unpack("<I", data[4:8])[0]
    header_len, record_len = struct.unpack("<HH", data[8:12])
    fields, pos = [], 32
    while data[pos] != 0x0D:
        fd = data[pos:pos + 32]
        fields.append((fd[:11].split(b"\x00")[0].decode("latin-1"), fd[16]))
        pos += 32
    body = data[header_len:header_len + count * record_len]
    try:
        body.decode("utf-8")
        encoding = "utf-8"
    except UnicodeDecodeError:
        encoding = "cp1252"
    rows = []
    for r in range(count):
        rec = body[r * record_len:(r + 1) * record_len]
        if rec[:1] == b"*":
            continue
        off, row = 1, {}
        for name, length in fields:
            row[name] = rec[off:off + length].decode(encoding).strip()
            off += length
        rows.append(row)
    return rows


def signed_area(ring):
    return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1])) / 2


def to_geometry(rings):
    """Shapefile rings (outer clockwise, holes counter-clockwise) -> GeoJSON Polygon/MultiPolygon in WGS 84."""
    polygons = []
    for ring in rings:
        pts = []
        for x, y in ring:
            lon, lat = sweref_to_wgs84(x, y)
            p = [round(lon, DECIMALS), round(lat, DECIMALS)]
            if not pts or pts[-1] != p:
                pts.append(p)
        if pts[0] != pts[-1]:
            pts.append(pts[0])
        if len(pts) < 4:
            continue
        if signed_area(ring) < 0 or not polygons:  # clockwise in east/north = outer ring
            polygons.append([pts])
        else:
            polygons[-1].append(pts)
    if not polygons:
        return None
    return {"type": "Polygon", "coordinates": polygons[0]} if len(polygons) == 1 else {"type": "MultiPolygon", "coordinates": polygons}


def load_layer(outer, inner_name):
    inner = zipfile.ZipFile(io.BytesIO(outer.read(inner_name)))
    shp = next(n for n in inner.namelist() if n.lower().endswith(".shp"))
    dbf = next(n for n in inner.namelist() if n.lower().endswith(".dbf"))
    return read_shp(inner.read(shp)), read_dbf(inner.read(dbf))


def write_collection(path, features, name):
    fc = {"type": "FeatureCollection", "name": name, "features": features}
    text = json.dumps(fc, ensure_ascii=False, separators=(",", ":")) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"  wrote {path.relative_to(ROOT).as_posix()} ({len(features)} features, {len(text.encode('utf-8')) // 1024} kB)")


def main(argv):
    if len(argv) > 1:
        archive = pathlib.Path(argv[1]).read_bytes()
        source = argv[1]
    else:
        print(f"  downloading {SCB_URL}")
        with urllib.request.urlopen(SCB_URL) as resp:
            archive = resp.read()
        source = SCB_URL
    outer = zipfile.ZipFile(io.BytesIO(archive))
    names = outer.namelist()
    lan_zip = next(n for n in names if n.lower().startswith("lan"))
    kommun_zip = next(n for n in names if n.lower().startswith("kommun"))
    version = "".join(ch for ch in pathlib.Path(source).stem if ch.isdigit())

    # Self-check of the projection formulas: the central meridian maps to the false easting and the
    # inverse undoes the forward transformation to better than a millimetre.
    e, n = wgs84_to_sweref(15.0, 60.0)
    assert abs(e - FALSE_E) < 1e-6, e
    lon, lat = sweref_to_wgs84(674000.0, 6580000.0)
    e2, n2 = wgs84_to_sweref(lon, lat)
    assert abs(e2 - 674000.0) < 1e-3 and abs(n2 - 6580000.0) < 1e-3, (e2, n2)

    OUT.mkdir(parents=True, exist_ok=True)
    lan_shapes, lan_rows = load_layer(outer, lan_zip)
    # SCB's attribute table says "Stockholms"; statistics tables say "Stockholms län", so joins by name work.
    full_name = lambda s: s if s.endswith("län") else s + " län"
    lan_name = {r["LnKod"]: full_name(r["LnNamn"]) for r in lan_rows}
    lan_features = []
    for rings, row in zip(lan_shapes, lan_rows):
        geom = to_geometry(rings)
        if geom:
            lan_features.append({"type": "Feature", "properties": {"lanskod": row["LnKod"], "lan": full_name(row["LnNamn"])}, "geometry": geom})
    write_collection(OUT / "lan.geojson", lan_features, "Länsgränser (SCB)")

    kommun_shapes, kommun_rows = load_layer(outer, kommun_zip)
    kommun_features = []
    for rings, row in zip(kommun_shapes, kommun_rows):
        geom = to_geometry(rings)
        if geom:
            code = row["KnKod"]
            kommun_features.append({"type": "Feature", "properties": {"kommunkod": code, "kommun": row["KnNamn"], "lanskod": code[:2], "lan": lan_name.get(code[:2], "")}, "geometry": geom})
    write_collection(OUT / "kommuner.geojson", kommun_features, "Kommungränser (SCB)")

    (OUT / "KALLA.md").write_text(
        "# Kommun- och länsgränser\n\n"
        f"Källa: SCB, *Digitala gränser* ({SCB_PAGE}), arkiv `{pathlib.Path(source).name}` (version {version}), "
        "koordinatsystem SWEREF 99 TM i originalet.\n\n"
        "Licens: CC0 1.0. SCB: \"Vi använder licensen CC0 för dessa data, vilket innebär att du får använda och sprida "
        "eller tillgängliggöra sådana data utan krav på att ange källa.\" Gränserna är förenklade för tematiska kartor "
        "och inte avsedda för analyser av exakta gränser.\n\n"
        "Filerna här är omräknade till WGS 84 (longitud, latitud; fem decimaler) och skrivna som GeoJSON av "
        "`tools/build_boundaries.py`. Yttre ringar är medurs som i shapefilen.\n",
        encoding="utf-8", newline="\n")
    print("  wrote presets/geo/KALLA.md")


if __name__ == "__main__":
    main(sys.argv)
