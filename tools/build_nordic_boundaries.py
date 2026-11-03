#!/usr/bin/env python3
"""Build the bundled Nordic boundary files in presets/geo: municipalities and regions of Denmark, Norway and
Finland for thematic maps, from national open data (see presets/geo/KALLA.md).

  dk  DAGI 1:500 000 from Geodatastyrelsen (now Klimadatastyrelsen), free data with attribution, as converted to
      WGS 84 GeoJSON in github.com/Neogeografen/dagi (February 2014; the 98 municipalities and five regions have
      not changed since 2007). Christiansø, outside the municipal division, is kept as in DAGI.
  no  N1000 Kartdata from Kartverket (CC BY 4.0), ordered through Geonorge's download API. Norwegian municipal
      areas reach out to the territorial border at sea; they are cut along the coastline (Kystkontur, and
      HavElvSperre at river mouths) and only the land is kept (the sea is the Havflate areas). Counties are the
      union of their municipalities.
  fi  Statistics Finland's municipality-based statistical units 1:1 000 000 (kunta1000k and maakunta1000k),
      CC BY 4.0, from the WFS at geo.stat.fi.

Shared boundaries are simplified once (Douglas-Peucker on the arcs between junctions), so neighbouring areas
stay gap-free; small islands are dropped except the largest part of each area. Outer rings are written clockwise
like the SCB files, which is what d3-geo and Vega expect for spherical polygons. Standard library only.

Usage:
    python tools/build_nordic_boundaries.py [dk] [no] [fi] [--year 2026] [--cache DIR]

Downloads are kept in --cache (default: a folder in the system's temporary directory), so a rebuild with other
settings does not download again. Afterwards run `python tools/wrap_local.py` to refresh the embedded copies the
app loads via file://.
"""
import argparse
import collections
import io
import json
import math
import pathlib
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "presets" / "geo"
Q = 1_000_000  # coordinates are handled as integer microdegrees
DECIMALS = 5  # about one metre in the written files
DK_BASE = "https://raw.githubusercontent.com/Neogeografen/dagi/master/geojson/"
GEONORGE_ORDER = "https://nedlasting.geonorge.no/api/order"
N1000_UUID = "aee42bb6-d0e9-4d70-86fe-6ea76c381055"
FI_WFS = ("https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=2.0.0&request=GetFeature"
          "&typeName=tilastointialueet:{layer}&outputFormat=application/json&srsName=EPSG:4326")
# Douglas-Peucker tolerance in degrees of latitude and the smallest extra island kept, in km², per country.
SETTINGS = {"dk": (0.0015, 3.0), "no": (0.005, 20.0), "fi": (0.0035, 8.0)}


# ---- downloads ----------------------------------------------------------------------------------------------
def fetch(url, cache, name, data=None, headers=None):
    path = cache / name
    if path.exists():
        return path.read_bytes()
    req = urllib.request.Request(url, data=data, headers=dict({"User-Agent": "Dataspatium-build"}, **(headers or {})))
    with urllib.request.urlopen(req, timeout=600) as res:
        body = res.read()
    path.write_bytes(body)
    print(f"  downloaded {name} ({len(body) // 1024} kB)")
    return body


def geonorge(uuid, cache, name):
    """Order a national download from Geonorge (no account needed) and return the zip archive."""
    path = cache / name
    if path.exists():
        return path.read_bytes()
    order = {"email": "", "orderLines": [{"metadataUuid": uuid,
             "areas": [{"code": "0000", "name": "Hele landet", "type": "landsdekkende"}],
             "projections": [{"code": "4258", "codespace": "http://www.opengis.net/def/crs/EPSG/0/4258"}],
             "formats": [{"name": "GML"}]}]}
    res = json.loads(fetch(GEONORGE_ORDER, cache, name + ".order.json", json.dumps(order).encode("utf-8"),
                           {"Content-Type": "application/json"}))
    (cache / (name + ".order.json")).unlink()
    url = res["files"][0]["downloadUrl"]
    return fetch(url, cache, name)


# ---- geometry helpers ---------------------------------------------------------------------------------------
def clean_ring(points):
    """Integer ring without repeated points and without the closing point; None when degenerate."""
    ring = []
    for p in points:
        if not ring or ring[-1] != p:
            ring.append(p)
    if len(ring) > 1 and ring[0] == ring[-1]:
        ring.pop()
    return ring if len(ring) >= 3 else None


def geojson_polygons(geometry):
    parts = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    polys = []
    for part in parts:
        rings = [r for r in (clean_ring([(round(c[0] * Q), round(c[1] * Q)) for c in ring]) for ring in part) if r]
        if rings:
            polys.append(rings)
    return polys


def area2(ring):
    """Twice the signed area (positive when counter-clockwise with latitude up)."""
    s = 0
    x0, y0 = ring[-1]
    for x1, y1 in ring:
        s += x0 * y1 - x1 * y0
        x0, y0 = x1, y1
    return s


def km2(ring):
    lat = sum(p[1] for p in ring) / len(ring) / Q
    return abs(area2(ring)) / 2 / Q / Q * 111.2 * 111.2 * math.cos(math.radians(lat))


def bbox(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def in_ring(x, y, ring):
    inside = False
    xj, yj = ring[-1]
    for xi, yi in ring:
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        xj, yj = xi, yi
    return inside


class Areas:
    """Labelled polygons (even-odd over their rings) with a grid for point lookups."""

    def __init__(self, items, cell=200_000):
        self.cell = cell
        self.items = []
        self.grid = collections.defaultdict(list)
        for label, rings in items:
            box = bbox([p for r in rings for p in r])
            idx = len(self.items)
            self.items.append((label, rings, box, [bbox(r) for r in rings]))
            for gx in range(box[0] // cell, box[2] // cell + 1):
                for gy in range(box[1] // cell, box[3] // cell + 1):
                    self.grid[(gx, gy)].append(idx)

    def find(self, x, y):
        for idx in self.grid.get((int(x) // self.cell, int(y) // self.cell), ()):
            label, rings, box, boxes = self.items[idx]
            if not (box[0] <= x <= box[2] and box[1] <= y <= box[3]):
                continue
            inside = False
            for ring, b in zip(rings, boxes):
                if b[0] <= x <= b[2] and b[1] <= y <= b[3] and in_ring(x, y, ring):
                    inside = not inside
            if inside:
                return label
        return None


def interior_point(rings):
    """A point inside a polygon: the middle of the widest inside stretch along a horizontal line."""
    x0, y0, x1, y1 = bbox(rings[0])
    best = None
    for frac in (0.5, 0.37, 0.63, 0.25, 0.75):
        y = y0 + (y1 - y0) * frac + 0.5
        xs = []
        for ring in rings:
            xj, yj = ring[-1]
            for xi, yi in ring:
                if (yi > y) != (yj > y):
                    xs.append(xi + (y - yi) * (xj - xi) / (yj - yi))
                xj, yj = xi, yi
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            if best is None or b - a > best[0]:
                best = (b - a, (a + b) / 2, y)
    return (best[1], best[2]) if best else (float(rings[0][0][0]), float(rings[0][0][1]))


def left_point(ring):
    """A point just to the left of the ring's longest edge."""
    n = len(ring)
    i = max(range(n), key=lambda k: (ring[(k + 1) % n][0] - ring[k][0]) ** 2 + (ring[(k + 1) % n][1] - ring[k][1]) ** 2)
    (ax, ay), (bx, by) = ring[i], ring[(i + 1) % n]
    length = math.hypot(bx - ax, by - ay)
    d = min(length * 0.1, 200.0)
    return (ax + bx) / 2 - (by - ay) / length * d, (ay + by) / 2 + (bx - ax) / length * d


# ---- planar graph: cutting along lines and dissolving -------------------------------------------------------
SNAP = 20  # an end point this close to the other segment (2 m) meets it


def near_end(p, a, b):
    """Position along a-b where the point p lies within SNAP of the segment's interior, else None."""
    rx, ry = b[0] - a[0], b[1] - a[1]
    ll = rx * rx + ry * ry
    if ll == 0:
        return None
    t = ((p[0] - a[0]) * rx + (p[1] - a[1]) * ry) / ll
    if not 0 < t < 1:
        return None
    return t if math.hypot(p[0] - a[0] - t * rx, p[1] - a[1] - t * ry) <= SNAP else None


def crossings(s1, s2):
    """Intersections of two integer segments as (t on s1 or None, u on s2 or None, point). An end point of one
    segment that ends just short of (or just past) the other also counts, at the end point."""
    (ax, ay), (bx, by) = s1
    (cx, cy), (dx, dy) = s2
    hits = []
    for u, p in ((0.0, s2[0]), (1.0, s2[1])):
        t = near_end(p, s1[0], s1[1])
        if t is not None:
            hits.append((t, u, p))
    for t, p in ((0.0, s1[0]), (1.0, s1[1])):
        u = near_end(p, s2[0], s2[1])
        if u is not None:
            hits.append((t, u, p))
    if hits:
        return hits
    rx, ry, sx, sy = bx - ax, by - ay, dx - cx, dy - cy
    qx, qy = cx - ax, cy - ay
    den = rx * sy - ry * sx
    if den == 0:
        if qx * ry - qy * rx != 0:
            return []
        out = []
        rr, ss = rx * rx + ry * ry, sx * sx + sy * sy
        for p in ((cx, cy), (dx, dy)):
            t = (p[0] - ax) * rx + (p[1] - ay) * ry
            if 0 < t < rr:
                out.append((t / rr, None, p))
        for p in ((ax, ay), (bx, by)):
            u = (p[0] - cx) * sx + (p[1] - cy) * sy
            if 0 < u < ss:
                out.append((None, u / ss, p))
        return out
    t_num, u_num = qx * sy - qy * sx, qx * ry - qy * rx
    if den < 0:
        den, t_num, u_num = -den, -t_num, -u_num
    if t_num < 0 or t_num > den or u_num < 0 or u_num > den:
        return []
    if u_num == 0:
        p = (cx, cy)
    elif u_num == den:
        p = (dx, dy)
    elif t_num == 0:
        p = (ax, ay)
    elif t_num == den:
        p = (bx, by)
    else:
        p = (round(ax + t_num * rx / den), round(ay + t_num * ry / den))
    return [(t_num / den, u_num / den, p)]


def segments_of(rings_or_lines, closed):
    segs = set()
    for pts in rings_or_lines:
        pairs = zip(pts, pts[1:] + pts[:1]) if closed else zip(pts, pts[1:])
        for a, b in pairs:
            if a != b:
                segs.add((a, b) if a < b else (b, a))
    return list(segs)


def node(seg_a, seg_b, cell=20_000):
    """Undirected edges of two segment sets split where a segment of one meets a segment of the other."""
    def cells(s):
        (x1, y1), (x2, y2) = s
        for gx in range(min(x1, x2) // cell, max(x1, x2) // cell + 1):
            for gy in range(min(y1, y2) // cell, max(y1, y2) // cell + 1):
                yield gx, gy
    grid = collections.defaultdict(list)
    for j, s in enumerate(seg_b):
        for c in cells(s):
            grid[c].append(j)
    split_a, split_b = collections.defaultdict(list), collections.defaultdict(list)
    for i, s in enumerate(seg_a):
        seen = set()
        for c in cells(s):
            for j in grid.get(c, ()):
                if j in seen:
                    continue
                seen.add(j)
                for t, u, p in crossings(s, seg_b[j]):
                    if t is not None:
                        split_a[i].append((t, p))
                    if u is not None:
                        split_b[j].append((u, p))
    edges = set()
    for segs, splits in ((seg_a, split_a), (seg_b, split_b)):
        for i, (p, q) in enumerate(segs):
            pts = [p] + [pt for _t, pt in sorted(splits.get(i, ()))] + [q]
            for a, b in zip(pts, pts[1:]):
                if a != b:
                    edges.add((a, b) if a < b else (b, a))
    return edges


class Graph:
    """Planar graph with the face cycles of its half-edges (the face lies to the left of each half-edge)."""

    def __init__(self, edges):
        nbrs = collections.defaultdict(list)
        for a, b in edges:
            nbrs[a].append(b)
            nbrs[b].append(a)
        self.order, self.pos = {}, {}
        for v, ns in nbrs.items():
            ns.sort(key=lambda w: math.atan2(w[1] - v[1], w[0] - v[0]))
            self.order[v] = ns
            for i, w in enumerate(ns):
                self.pos[(v, w)] = i
        self.cycle_of, self.cycles = {}, []
        for v, ns in self.order.items():
            for w in ns:
                if (v, w) in self.cycle_of:
                    continue
                cid, cyc = len(self.cycles), []
                a, b = v, w
                while (a, b) not in self.cycle_of:
                    self.cycle_of[(a, b)] = cid
                    cyc.append((a, b))
                    nb = self.order[b]
                    a, b = b, nb[(self.pos[(b, a)] - 1) % len(nb)]
                self.cycles.append(cyc)

    def samples(self, cid, k=3):
        """Points just to the left of the longest edges of a face cycle."""
        out = []
        for (a, b) in sorted(self.cycles[cid], key=lambda e: -((e[1][0] - e[0][0]) ** 2 + (e[1][1] - e[0][1]) ** 2))[:k]:
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dx, dy)
            d = min(length * 0.1, 200.0)
            out.append(((a[0] + b[0]) / 2 - dy / length * d, (a[1] + b[1]) / 2 + dx / length * d))
        return out

    def dissolve(self, labels):
        """Polygons of the union of the faces with each label: {label: [[outer, hole, ...], ...]}."""
        lab = self.cycle_of
        boundary = collections.defaultdict(list)
        for (a, b), cid in lab.items():
            la = labels[cid]
            if la is not None and la != labels[lab[(b, a)]]:
                boundary[la].append((a, b))
        result = {}
        for name, half_edges in boundary.items():
            used, rings = set(), []
            for start in half_edges:
                if start in used:
                    continue
                ring, (a, b) = [], start
                while (a, b) not in used:
                    used.add((a, b))
                    ring.append(a)
                    nb, i = self.order[b], self.pos[(b, a)]
                    for step in range(1, len(nb) + 1):
                        c = nb[(i - step) % len(nb)]
                        if labels[lab[(b, c)]] == name and labels[lab[(c, b)]] != name:
                            break
                    a, b = b, c
                ring = clean_ring(ring)
                if ring:
                    rings.append(ring)
            result[name] = assemble(rings)
        return result


def assemble(rings):
    """Counter-clockwise outer rings with their clockwise holes."""
    polys = [[r] for r in sorted((r for r in rings if area2(r) > 0), key=area2)]
    for hole in (r for r in rings if area2(r) < 0):
        x, y = left_point(hole)
        for poly in polys:  # smallest outer ring first
            if in_ring(x, y, poly[0]):
                poly.append(hole)
                break
    return polys


# ---- simplification on shared arcs --------------------------------------------------------------------------
def simplify(features, tolerance, min_km2):
    """Douglas-Peucker on the arcs between junctions, so that shared boundaries stay shared.
    features: {key: [[ring, ...], ...]} with integer rings; returns the same shape with closed rings, outer rings
    clockwise and holes counter-clockwise."""
    nbrs = collections.defaultdict(set)
    for polys in features.values():
        for poly in polys:
            for ring in poly:
                for a, b in zip(ring, ring[1:] + ring[:1]):
                    nbrs[a].add(b)
                    nbrs[b].add(a)
    junction = {v for v, s in nbrs.items() if len(s) != 2}
    for polys in features.values():
        for poly in polys:
            for ring in poly:
                if not any(p in junction for p in ring):
                    junction.add(min(ring))
    tol = tolerance * Q
    cache = {}

    def dp(pts):
        if len(pts) <= 2:
            return list(pts)
        cos = math.cos(math.radians(sum(p[1] for p in pts) / len(pts) / Q))
        xy = [(p[0] * cos, p[1]) for p in pts]
        keep = [False] * len(pts)
        keep[0] = keep[-1] = True
        stack = [(0, len(pts) - 1)]
        if pts[0] == pts[-1]:
            far = max(range(1, len(pts) - 1), key=lambda i: (xy[i][0] - xy[0][0]) ** 2 + (xy[i][1] - xy[0][1]) ** 2)
            keep[far] = True
            stack = [(0, far), (far, len(pts) - 1)]
        while stack:
            s, e = stack.pop()
            (x1, y1), (x2, y2) = xy[s], xy[e]
            dx, dy = x2 - x1, y2 - y1
            ll = dx * dx + dy * dy
            best, idx = -1.0, -1
            for i in range(s + 1, e):
                px, py = xy[i]
                t = 0.0 if ll == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / ll))
                d = (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2
                if d > best:
                    best, idx = d, i
            if idx > 0 and best > tol * tol:
                keep[idx] = True
                stack += [(s, idx), (idx, e)]
        return [p for p, k in zip(pts, keep) if k]

    def arc(part):
        # Both sides of a shared arc simplify the same (canonical) direction of it.
        key = tuple(part)
        rev = key[::-1]
        canon = min(key, rev)
        if canon not in cache:
            cache[canon] = dp(list(canon))
        return cache[canon] if canon == key else cache[canon][::-1]

    def rebuild(ring):
        k = next(i for i, p in enumerate(ring) if p in junction)
        r = ring[k:] + ring[:k] + [ring[k]]
        cuts = [i for i, p in enumerate(r) if p in junction]
        out = []
        for s, e in zip(cuts, cuts[1:]):
            out.extend(arc(r[s:e + 1])[:-1])
        return out

    result = {}
    for key, polys in features.items():
        parts = []
        for poly in polys:
            rings = []
            for i, ring in enumerate(poly):
                r = clean_ring(rebuild(ring)) or (ring if i == 0 else None)
                if r and (i == 0 or area2(r) != 0):
                    rings.append(r)
            if rings:
                parts.append(rings)
        parts.sort(key=lambda p: -km2(p[0]))
        parts = parts[:1] + [p for p in parts[1:] if km2(p[0]) >= min_km2]
        result[key] = [[orient(r, i == 0) for i, r in enumerate(p)] for p in parts]
    return result


def orient(ring, outer):
    clockwise = area2(ring) < 0
    r = ring if clockwise == outer else ring[::-1]
    return r + r[:1]


# ---- output -------------------------------------------------------------------------------------------------
def geometry(polys):
    coords = []
    for poly in polys:
        rings = []
        for ring in poly:
            pts = []
            for x, y in ring:
                p = [round(x / Q, DECIMALS), round(y / Q, DECIMALS)]
                if not pts or pts[-1] != p:
                    pts.append(p)
            if len(pts) >= 4:
                rings.append(pts)
        if rings:
            coords.append(rings)
    return {"type": "Polygon", "coordinates": coords[0]} if len(coords) == 1 else {"type": "MultiPolygon", "coordinates": coords}


def write(name, title, rows):
    """rows: [(properties, polygons)], sorted by the first property."""
    features = [{"type": "Feature", "properties": props, "geometry": geometry(polys)} for props, polys in sorted(rows, key=lambda r: list(r[0].values())[0])]
    text = json.dumps({"type": "FeatureCollection", "name": title, "features": features}, ensure_ascii=False, separators=(",", ":")) + "\n"
    (OUT / name).write_text(text, encoding="utf-8", newline="\n")
    points = sum(len(r) for f in features for p in ([f["geometry"]["coordinates"]] if f["geometry"]["type"] == "Polygon" else f["geometry"]["coordinates"]) for r in p)
    print(f"  wrote presets/geo/{name}: {len(features)} areas, {points} points, {len(text.encode('utf-8')) // 1024} kB")


def largest(polys):
    return max(polys, key=lambda p: km2(p[0]))


# ---- countries ----------------------------------------------------------------------------------------------
def build_dk(cache, tolerance, min_km2):
    kom = json.loads(fetch(DK_BASE + "kommuner.geojson", cache, "dk-kommuner.geojson"))
    reg = json.loads(fetch(DK_BASE + "regioner.geojson", cache, "dk-regioner.geojson"))
    regions, region_names, region_polys = [], {}, collections.defaultdict(list)
    for f in reg["features"]:
        code, name = f["properties"]["REGIONKODE"], f["properties"]["REGIONNAVN"]
        region_names[code] = name
        for poly in geojson_polygons(f["geometry"]):
            regions.append((code, poly))
            region_polys[code].append(poly)
    lookup = Areas(regions)
    names, polys = {}, collections.defaultdict(list)
    for f in kom["features"]:
        code = f["properties"]["KOMKODE"]
        names[code] = f["properties"]["KOMNAVN"]
        polys[code].extend(geojson_polygons(f["geometry"]))
    region_of = {code: lookup.find(*interior_point(largest(p))) for code, p in polys.items()}
    kommuner = simplify(polys, tolerance, min_km2)
    write("kommuner-dk.geojson", "Kommuner (DAGI)", [({"kommunekode": c, "kommune": names[c], "regionskode": region_of[c] or "",
          "region": region_names.get(region_of[c], "")}, p) for c, p in kommuner.items()])
    regioner = simplify(region_polys, tolerance, min_km2)
    write("regioner-dk.geojson", "Regioner (DAGI)", [({"regionskode": c, "region": region_names[c]}, p) for c, p in regioner.items()])


def local(tag):
    return tag.rsplit("}", 1)[-1]


def gml_points(el):
    v = el.text.split()
    return [(round(float(v[i + 1]) * Q), round(float(v[i]) * Q)) for i in range(0, len(v) - 1, 2)]  # EPSG:4258 is latitude first


def gml_polygons(el):
    polys = []
    for patch in el.iter():
        if local(patch.tag) not in ("PolygonPatch", "Polygon"):
            continue
        rings = []
        for part in patch:
            if local(part.tag) in ("exterior", "interior"):
                pl = next((x for x in part.iter() if local(x.tag) == "posList"), None)
                ring = clean_ring(gml_points(pl)) if pl is not None else None
                if ring:
                    rings.append(ring)
        if rings:
            polys.append(rings)
    return polys


def gml_features(data, wanted):
    """The features of the wanted types, one at a time (each member is cleared afterwards)."""
    for _event, el in ET.iterparse(io.BytesIO(data), events=("end",)):
        if local(el.tag) == "featureMember":
            for child in el:
                if local(child.tag) in wanted:
                    yield local(child.tag), child
            el.clear()


def text_of(el, name):
    found = next((x for x in el.iter() if local(x.tag) == name), None)
    return (found.text or "").strip() if found is not None else ""


def build_no(cache, tolerance, min_km2):
    archive = zipfile.ZipFile(io.BytesIO(geonorge(N1000_UUID, cache, "no-n1000.zip")))
    member = lambda part: next(n for n in archive.namelist() if n.endswith(part + "_GML.gml"))
    kommuner, fylke_of, names, fylke_names = [], {}, {}, {}
    for _name, el in gml_features(archive.read(member("AdministrativeOmrader")), {"Kommune"}):
        code = text_of(el, "kommunenummer")
        names[code], fylke_of[code] = text_of(el, "kommunenavn"), text_of(el, "fylkesnummer")
        fylke_names[fylke_of[code]] = text_of(el, "fylkesnavn")
        kommuner += [(code, poly) for poly in gml_polygons(el)]
    coast, sea = [], []
    # The sea ends at the coastline and, at river mouths, at the sea-river barrier lines.
    for name, el in gml_features(archive.read(member("Arealdekke")), {"Kystkontur", "HavElvSperre", "Havflate"}):
        if name == "Havflate":
            sea += [(True, poly) for poly in gml_polygons(el)]
        else:
            coast += [gml_points(pl) for pl in el.iter() if local(pl.tag) == "posList"]
    print(f"  {len(kommuner)} municipal areas, {len(coast)} coastlines, {len(sea)} sea areas")
    edges = node(segments_of([r for _c, poly in kommuner for r in poly], True), segments_of(coast, False))
    graph = Graph(edges)
    lookup, water = Areas(kommuner), Areas(sea)
    labels = []
    for cid in range(len(graph.cycles)):
        votes = collections.Counter()
        for x, y in graph.samples(cid):
            code = lookup.find(x, y)
            votes[code if code is not None and water.find(x, y) is None else None] += 1
        labels.append(votes.most_common(1)[0][0])
    print(f"  {len(edges)} edges, {len(graph.cycles)} faces, {sum(1 for x in labels if x)} on land")
    land = graph.dissolve(labels)
    for code in sorted(set(names) - set(land)):
        print(f"  warning: no land found for {code} {names[code]}; kept with its sea area as in N1000")
        land[code] = [p for c, p in kommuner if c == code]
    fylker = graph.dissolve([fylke_of.get(x) if x else None for x in labels])
    rows = simplify(land, tolerance, min_km2)
    write("kommuner-no.geojson", "Kommuner (Kartverket)", [({"kommunenummer": c, "kommune": names[c], "fylkesnummer": fylke_of[c],
          "fylke": fylke_names[fylke_of[c]]}, p) for c, p in rows.items()])
    rows = simplify(fylker, tolerance, min_km2)
    write("fylker-no.geojson", "Fylker (Kartverket)", [({"fylkesnummer": c, "fylke": fylke_names[c]}, p) for c, p in rows.items()])


def build_fi(cache, tolerance, min_km2, year):
    kunnat = json.loads(fetch(FI_WFS.format(layer=f"kunta1000k_{year}"), cache, f"fi-kunta1000k_{year}.json"))
    maakunnat = json.loads(fetch(FI_WFS.format(layer=f"maakunta1000k_{year}"), cache, f"fi-maakunta1000k_{year}.json"))
    regions, region_props, region_polys = [], {}, collections.defaultdict(list)
    for f in maakunnat["features"]:
        p = f["properties"]
        region_props[p["maakunta"]] = (p["nimi"], p["namn"])
        for poly in geojson_polygons(f["geometry"]):
            regions.append((p["maakunta"], poly))
            region_polys[p["maakunta"]].append(poly)
    lookup = Areas(regions)
    names, polys = {}, collections.defaultdict(list)
    for f in kunnat["features"]:
        p = f["properties"]
        names[p["kunta"]] = (p["nimi"], p["namn"])
        polys[p["kunta"]].extend(geojson_polygons(f["geometry"]))
    region_of = {code: lookup.find(*interior_point(largest(p))) for code, p in polys.items()}
    rows = simplify(polys, tolerance, min_km2)
    write("kunnat-fi.geojson", "Kunnat (Tilastokeskus)", [({"kuntakoodi": c, "kunta": names[c][0], "kommun": names[c][1], "maakuntakoodi": region_of[c] or "",
          "maakunta": region_props.get(region_of[c], ("", ""))[0], "landskap": region_props.get(region_of[c], ("", ""))[1]}, p) for c, p in rows.items()])
    rows = simplify(region_polys, tolerance, min_km2)
    write("maakunnat-fi.geojson", "Maakunnat (Tilastokeskus)", [({"maakuntakoodi": c, "maakunta": region_props[c][0], "landskap": region_props[c][1]}, p) for c, p in rows.items()])


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("countries", nargs="*", choices=["dk", "no", "fi"], default=None)
    parser.add_argument("--year", default="2026", help="year of Statistics Finland's division (default 2026)")
    parser.add_argument("--cache", default=None, help="folder for the downloads")
    args = parser.parse_args(argv)
    cache = pathlib.Path(args.cache) if args.cache else pathlib.Path(tempfile.gettempdir()) / "dataspatium-boundaries"
    cache.mkdir(parents=True, exist_ok=True)
    for country in args.countries or ["dk", "no", "fi"]:
        print(country)
        tolerance, min_km2 = SETTINGS[country]
        if country == "dk":
            build_dk(cache, tolerance, min_km2)
        elif country == "no":
            build_no(cache, tolerance, min_km2)
        else:
            build_fi(cache, tolerance, min_km2, args.year)


if __name__ == "__main__":
    main(sys.argv[1:])
