"""Build the compact copy of Boverket's Planbestämmelsekatalogen that ships with the app.

Boverket publishes the catalogue as open data (terms: name Boverket and Planbestämmelsekatalogen as the source) in
an Excel workbook with one sheet per provision type. This tool reads that workbook with the standard library only and
writes presets/plan/planbestammelsekatalogen.json: one compact row per provision with the fields the app needs for
looking up a plan's catalogue references (text, designation, category, colour, validity). The long explanations are
left out. Run tools/wrap_local.py afterwards so the JSON is embedded (gzip+base64) for file://.

Usage: python -I tools/plan_catalog.py [<workbook.xlsx or URL>]
Default source: the current workbook linked from https://www.boverket.se/sv/om-boverket/oppna-data/planbestammelser/
"""
import io
import json
import os
import re
import sys
import urllib.request
import zipfile

DEFAULT_URL = "https://www.boverket.se/contentassets/eaeaa4e5e1a84e5ebff1ba563e87916d/planbestammelsekatalogen-2025-12-01.xlsx"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "presets", "plan", "planbestammelsekatalogen.json")
TYPES = {
    "Användningsbestämmelser": "anvandning",
    "Egenskapsbestämmelser": "egenskap",
    "Administrativa bestämmelser": "administrativ",
    "Övergångsbestämmelser": "overgang",
}
FIELDS = ["uuid", "typ", "status", "form", "kategori", "underkategori", "beteckning", "symbol", "kod", "formulering",
          "farg", "geometri", "start", "slut", "ersattsAv", "huvudmannaskap", "varde", "tolkning"]
COLUMNS = {
    "uuid": "UUID", "status": "Status", "form": "Användningsform", "kategori": "Kategori", "underkategori": "Underkategori",
    "beteckning": "Textbeteckning", "symbol": "Symbolbeteckning", "kod": "Bestämmelsekod", "formulering": "Bestämmelseformulering",
    "farg": "Färg", "geometri": "Geometrityp", "start": "Börjar gälla", "slut": "Slutar gälla", "ersattsAv": "Ersätts av",
    "huvudmannaskap": "Huvudmannaskap", "varde": "Uttryckt värde", "tolkning": "Tolkningsbestämmelse",
}


def cell_text(inner, attrs, strings):
    mv = re.search(r"<(?:x:)?v>(.*?)</(?:x:)?v>", inner, re.S)
    mt = re.search(r"<(?:x:)?t[^>]*>(.*?)</(?:x:)?t>", inner, re.S)
    v = mv.group(1) if mv else (mt.group(1) if mt else None)
    if v is not None and 't="s"' in attrs:
        v = strings[int(v)]
    return v


def read_workbook(data):
    """Sheets of an .xlsx as {name: [ {column letter: text} ]} without external libraries."""
    z = zipfile.ZipFile(io.BytesIO(data))
    wb = z.read("xl/workbook.xml").decode("utf8")
    sheets = [(re.search(r'name="([^"]+)"', s).group(1), re.search(r'r:id="([^"]+)"', s).group(1)) for s in re.findall(r"<(?:x:)?sheet [^>]*/?>", wb)]
    rels = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', z.read("xl/_rels/workbook.xml.rels").decode("utf8")))
    ss = z.read("xl/sharedStrings.xml").decode("utf8") if "xl/sharedStrings.xml" in z.namelist() else ""
    strings = [unescape(re.sub(r"<[^>]+>", "", s)) for s in re.findall(r"<(?:x:)?si>(.*?)</(?:x:)?si>", ss, re.S)]
    out = {}
    for name, rid in sheets:
        target = rels[rid]
        path = target.lstrip("/") if target.startswith("/") else "xl/" + target
        sheet = z.read(path).decode("utf8")
        rows = []
        for r in re.findall(r"<(?:x:)?row[^>]*>(.*?)</(?:x:)?row>", sheet, re.S):
            vals = {}
            for m in re.finditer(r'<(?:x:)?c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</(?:x:)?c>)', r, re.S):
                col, attrs, inner = m.groups()
                vals[col] = cell_text(inner, attrs, strings) if inner else None
            rows.append(vals)
        out[unescape(name)] = rows
    return out


def unescape(s):
    return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'").replace("&#10;", "\n").replace("&#13;", "")


def clean(v):
    if v is None:
        return ""
    v = str(v).replace("\r\n", "\n").replace("\r", "\n").strip()
    return re.sub(r"\n{3,}", "\n\n", v)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    if re.match(r"^https?://", src):
        req = urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0 (Dataspatium plan_catalog)"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
    else:
        with open(src, "rb") as fh:
            data = fh.read()
    book = read_workbook(data)
    info = {}
    for key in book:
        if key.startswith("Katalog"):
            for r in book[key]:
                if r.get("A") and r.get("B"):
                    info[clean(r["A"])] = clean(r["B"])
    rows = []
    counts = {}
    for sheet, typ in TYPES.items():
        if sheet not in book:
            sys.exit(f"sheet missing: {sheet} (have {list(book)})")
        data_rows = book[sheet]
        header = {clean(v): k for k, v in data_rows[0].items() if v}
        for r in data_rows[1:]:
            get = lambda name: clean(r.get(header.get(name, ""), "")) if name in header else ""
            if not get("UUID"):
                continue
            row = []
            for f in FIELDS:
                if f == "typ":
                    row.append(typ)
                    continue
                v = get(COLUMNS[f])
                if f == "ersattsAv":
                    v = re.sub(r"[{}]", "", v.split(",")[0]).strip().lower() if v else ""
                if f == "uuid":
                    v = v.lower()
                if f == "tolkning":
                    v = "ja" if v.lower() == "ja" else ""
                row.append(v)
            rows.append(row)
            counts[typ] = counts.get(typ, 0) + 1
    rows.sort(key=lambda r: (r[1], r[3], r[4], r[6], r[0]))
    out = {
        "format": "dataspatium-plan-catalog/1",
        "source": "Boverket, Planbestämmelsekatalogen",
        "license": "Öppna data från Boverket; ange Boverket och Planbestämmelsekatalogen som källa.",
        "url": "https://www.boverket.se/sv/om-boverket/oppna-data/planbestammelser/",
        "release": info.get("Release - Version", ""),
        "published": info.get("Release - Publicerad", ""),
        "counts": counts,
        "fields": FIELDS,
        "rows": rows,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"wrote {os.path.relpath(OUT, ROOT)}: {len(rows)} provisions, release {out['release']}, {os.path.getsize(OUT)} bytes")


if __name__ == "__main__":
    main()
