#!/usr/bin/env python3
"""Embed third-party binaries and ESM text as JavaScript asset wrappers.

Reads vendor/vendor.json and vendor-src/<lib>/files.json (written by fetch_vendor.py) and writes:
  vendor/<lib>/<file>.js        one wrapper per file, or vendor/<lib>/<bundle>.bundle.js for bundled globs
  vendor/manifest.js            asset index (name -> wrapper file, encoding, size, sha256, library)
  THIRD_PARTY_LICENSES.md       licence summary with full licence texts

Why: pages opened via file:// cannot fetch() local files, but they can load <script> files.
Each wrapper calls Dataspatium.assets.register(name, encoding, payload).

Usage:
    python tools/wrap_assets.py [--only lib1,lib2]
"""
import argparse
import base64
import gzip
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = ROOT / "vendor" / "vendor.json"
SRC = ROOT / "vendor-src"
OUT = ROOT / "vendor"

TEXT_EXT = {".js", ".mjs", ".cjs", ".json", ".metadata", ".conf", ".pem", ".txt", ".md", ".tag", ".r", ".csv",
            ".svg", ".css", ".html", ".map"}
TEXT_NAMES = {"DESCRIPTION", "PACKAGES", "CACHEDIR.TAG"}
PRECOMPRESSED_EXT = {".gz", ".tgz", ".zip", ".woff2", ".png", ".jpg", ".jpeg", ".webp"}
WRAP_TO_ENCODING = {"text": "text", "base64": "base64", "gzip": "gzip+base64", "gzip+base64": "gzip+base64"}


def auto_encoding(name):
    base = name.rsplit("/", 1)[-1]
    ext = ("." + base.rsplit(".", 1)[-1]).lower() if "." in base else ""
    if base in TEXT_NAMES or ext in TEXT_EXT:
        return "text"
    if ext in PRECOMPRESSED_EXT:
        return "base64"
    return "gzip+base64"


def encode(data, encoding):
    """Return a JavaScript string literal holding the payload."""
    if encoding == "text":
        return json.dumps(data.decode("utf-8"), ensure_ascii=False)
    if encoding == "base64":
        return '"' + base64.b64encode(data).decode("ascii") + '"'
    if encoding == "gzip+base64":
        return '"' + base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode("ascii") + '"'
    raise ValueError(encoding)


def wrapper_line(name, encoding, payload):
    return f"Dataspatium.assets.register({json.dumps(name)},{json.dumps(encoding)},{payload});\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", default="", help="comma-separated library names to (re)wrap; manifest always covers all")
    args = parser.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    manifest = {"generated": "tools/wrap_assets.py", "assets": {}, "libraries": {}}
    license_sections = []
    for lib, cfg in config["libraries"].items():
        files_json = SRC / lib / "files.json"
        if not files_json.exists():
            print(f"skipping {lib}: run fetch_vendor.py first", file=sys.stderr)
            continue
        files = json.loads(files_json.read_text(encoding="utf-8"))
        lib_out = OUT / lib
        lib_out.mkdir(parents=True, exist_ok=True)
        bundles = {}
        direct = []
        for f in files:
            name = f"{lib}/{f['as']}"
            wrap = f["wrap"]
            if wrap is False:
                direct.append(f["as"])
                continue
            encoding = auto_encoding(name) if wrap == "auto" else WRAP_TO_ENCODING[wrap]
            bundle = f.get("bundle")
            target = (lib_out / f"{bundle}.bundle.js") if bundle else (lib_out / (f["as"] + ".js"))
            manifest["assets"][name] = {"file": target.relative_to(ROOT).as_posix(), "encoding": encoding,
                                        "size": f["size"], "sha256": f["sha256"], "library": lib}
            if not only or lib in only:
                data = (SRC / lib / f["as"]).read_bytes()
                line = wrapper_line(name, encoding, encode(data, encoding))
                if bundle:
                    bundles.setdefault(target, []).append(line)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(line, encoding="utf-8", newline="\n")
                    print(f"  wrote {target.relative_to(ROOT).as_posix()} ({target.stat().st_size / 1e6:.2f} MB)")
        for target, lines in bundles.items():
            target.write_text("".join(lines), encoding="utf-8", newline="\n")
            print(f"  wrote {target.relative_to(ROOT).as_posix()} ({target.stat().st_size / 1e6:.2f} MB, {len(lines)} assets)")
        meta = {"version": cfg.get("version", ""), "license": cfg.get("license", ""), "homepage": cfg.get("homepage", ""),
                "direct": sorted(direct),
                "assets": len([n for n in manifest["assets"] if manifest["assets"][n]["library"] == lib])}
        if cfg.get("notes"):
            meta["notes"] = cfg["notes"]
        manifest["libraries"][lib] = meta
        section = [f"## {lib} {meta['version']}".rstrip(), "", f"- Licens: {meta['license']}", f"- Webbplats: {meta['homepage']}"]
        if cfg.get("notes"):
            section.append(f"- Not: {cfg['notes']}")
        pkgs = SRC / lib / "packages.json"
        if pkgs.exists():
            section += ["", "| R-paket | Version | Licens | Källkod |", "|---|---|---|---|"]
            for p, info in json.loads(pkgs.read_text(encoding="utf-8")).items():
                section.append(f"| {p} | {info['version']} | {info['license']} | <https://cran.r-project.org/package={p}> |")
        lic = lib_out / "LICENSE"
        if lic.exists():
            section += ["", "```text", lic.read_text(encoding="utf-8", errors="replace").strip(), "```"]
        # Dependencies of a module graph (type "esm-graph") carry their own licences.
        for extra in sorted(lib_out.glob("LICENSE-*.txt")):
            section += ["", f"### {extra.stem[len('LICENSE-'):].replace('__', '/')}", "", "```text", extra.read_text(encoding="utf-8", errors="replace").strip(), "```"]
        license_sections.append("\n".join(section))
    manifest_js = ("// Generated by tools/wrap_assets.py. Do not edit by hand.\n"
                   "Dataspatium.assets.manifest(" + json.dumps(manifest, indent=1, ensure_ascii=False) + ");\n")
    (OUT / "manifest.js").write_text(manifest_js, encoding="utf-8", newline="\n")
    header = ("# Tredjepartslicenser\n\n"
              "Dataspatium levereras med följande komponenter från tredje part, oförändrade och under sina egna licenser.\n"
              "Binärer och ESM-moduler är inbäddade som JavaScript-filer i `vendor/` (se `vendor/manifest.js`); det ändrar\n"
              "inte licensvillkoren. Filen genereras av `tools/wrap_assets.py` från `vendor/vendor.json`.\n"
              "Dataspatiums egen kod är licensierad under PolyForm Strict 1.0.0 (se `LICENSE` och `docs/sv/licenser.md`);\n"
              "det påverkar inte komponenterna nedan.\n\n")
    (ROOT / "THIRD_PARTY_LICENSES.md").write_text(header + "\n\n".join(license_sections) + "\n", encoding="utf-8", newline="\n")
    print(f"manifest: {len(manifest['assets'])} assets, {len(manifest['libraries'])} libraries")


if __name__ == "__main__":
    main()
