#!/usr/bin/env python3
"""Download the pinned third-party components listed in vendor/vendor.json.

Originals are stored in vendor-src/<lib>/ (git-ignored). Files marked "wrap": false and
LICENSE files are copied to vendor/<lib>/ so the app can load them with <script src>.
Everything else is embedded by tools/wrap_assets.py.

Usage:
    python tools/fetch_vendor.py [--force] [--only lib1,lib2]

Standard library only; no node.js required.
"""
import argparse
import concurrent.futures
import gzip
import hashlib
import json
import pathlib
import re
import shutil
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = ROOT / "vendor" / "vendor.json"
SRC = ROOT / "vendor-src"
OUT = ROOT / "vendor"
USER_AGENT = "Dataspatium-fetch-vendor/1.0"
JSDELIVR_FILE = "https://cdn.jsdelivr.net/npm/{pkg}@{ver}/{path}"
JSDELIVR_LIST = "https://data.jsdelivr.com/v1/package/npm/{pkg}@{ver}/flat"
LICENSE_CANDIDATES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "license.md", "LICENSE-MIT", "LICENCE"]
R_BASE_PACKAGES = set("R base stats utils methods grDevices graphics grid tools parallel splines stats4 tcltk compiler datasets".split())


def http_get(url, retries=3, timeout=120):
    """GET a URL and return its bytes, retrying on transient failures."""
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001 - retry on anything transient
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to download {url}: {last}")


def sha256_of(data):
    return hashlib.sha256(data).hexdigest()


def list_npm_files(pkg, ver):
    """Return all file paths (without leading slash) of an npm package via the jsDelivr API."""
    data = json.loads(http_get(JSDELIVR_LIST.format(pkg=pkg, ver=ver)))
    return [f["name"].lstrip("/") for f in data["files"]]


def expand_entries(lib, cfg):
    """Yield dicts {url, as, wrap, bundle} for every file a library wants."""
    pkg, ver = cfg.get("npm"), cfg.get("version")
    for entry in cfg.get("files", []):
        wrap = entry.get("wrap", "auto")
        bundle = entry.get("bundle")
        if "glob" in entry:
            glob = entry["glob"]
            strip = entry.get("strip", "")
            if not glob.endswith("/**"):
                raise ValueError(f"{lib}: only 'prefix/**' globs are supported, got {glob}")
            prefix = glob[:-2]
            for name in list_npm_files(pkg, ver):
                if name.startswith(prefix):
                    as_name = name[len(strip):] if name.startswith(strip) else name
                    yield {"url": JSDELIVR_FILE.format(pkg=pkg, ver=ver, path=name), "as": as_name, "wrap": wrap, "bundle": bundle}
        elif "url" in entry:
            yield {"url": entry["url"], "as": entry["as"], "wrap": wrap, "bundle": bundle}
        else:
            as_name = entry.get("as", entry["path"].rsplit("/", 1)[-1])
            yield {"url": JSDELIVR_FILE.format(pkg=pkg, ver=ver, path=entry["path"]), "as": as_name, "wrap": wrap, "bundle": bundle}


def fetch_license(lib, cfg):
    """Store the library LICENSE text in vendor/<lib>/LICENSE."""
    target = OUT / lib / "LICENSE"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    candidates = []
    if cfg.get("licenseUrl"):
        candidates.append(cfg["licenseUrl"])
    if cfg.get("npm"):
        candidates += [JSDELIVR_FILE.format(pkg=cfg["npm"], ver=cfg["version"], path=c) for c in LICENSE_CANDIDATES]
    for url in candidates:
        try:
            target.write_bytes(http_get(url, retries=1, timeout=30))
            print(f"  license  {lib} <- {url}")
            return
        except Exception:  # noqa: BLE001
            continue
    print(f"  WARNING: no LICENSE found for {lib}; add licenseUrl to vendor.json", file=sys.stderr)


def download_entry(lib, entry, force):
    """Download one file into vendor-src/<lib>/<as> and return its record."""
    dest = SRC / lib / entry["as"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists() or force:
        data = http_get(entry["url"])
        dest.write_bytes(data)
        status = "fetched "
    else:
        data = dest.read_bytes()
        status = "cached  "
    print(f"  {status} {lib}/{entry['as']} ({len(data) / 1e6:.2f} MB)")
    if entry["wrap"] is False:
        out = OUT / lib / entry["as"]
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(dest, out)
    return {"as": entry["as"], "url": entry["url"], "wrap": entry["wrap"], "bundle": entry.get("bundle"),
            "size": len(data), "sha256": sha256_of(data)}


ESM_SPEC_RE = re.compile(r"""(?:^|[;\s}])(?:import|export)\s*(?:[^"';]*?\s*from\s*)?["']([^"']+)["']""")
ESM_DYN_RE = re.compile(r"""import\(\s*["']([^"']+)["']\s*\)""")
ESM_BARREL_RE = re.compile(r"""^\s*(?:/\*[\s\S]*?\*/\s*)*(?:export\s*(?:\*|\{[^}]*\})\s*from\s*["'][^"']+["']\s*;?\s*)+$""")
ESM_SELF_IMPORT_RE = re.compile(r"""import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']\s*;?""")


def esm_file_name(spec):
    """Injective file name for a module spec: every character outside [A-Za-z0-9._-] becomes %XX."""
    return re.sub(r"[^A-Za-z0-9._-]", lambda m: "%%%02X" % ord(m.group()), spec.strip("/"))


def esm_resolve(spec, literal):
    """Absolute esm.sh path of an import literal found in `spec` (absolute or relative; bare names are errors)."""
    if literal.startswith("/"):
        return literal
    if literal.startswith("./") or literal.startswith("../"):
        base = spec.split("?")[0].rsplit("/", 1)[0]
        parts = []
        for p in (base + "/" + literal).split("/"):
            if p == "..":
                parts.pop()
            elif p not in ("", "."):
                parts.append(p)
        return "/" + "/".join(parts)
    return None  # a bare name: esm.sh resolves real imports to absolute paths, so this is text, not an import


def esm_exports(text):
    """Map exported name -> local name from `export { a as b, c }` lists and exported declarations."""
    out = {}
    for body in re.findall(r"export\s*\{([^}]*)\}(?!\s*from)", text):
        for part in body.split(","):
            part = part.strip()
            if not part:
                continue
            m = re.match(r"^(\S+)\s+as\s+(\S+)$", part)
            if m:
                out[m.group(2)] = m.group(1)
            else:
                out[part] = part
    for m in re.finditer(r"export\s+(?:const|let|var|function\*?|class|async\s+function)\s+([A-Za-z_$][\w$]*)", text):
        out[m.group(1)] = m.group(1)
    return out


def fetch_esm_graph(lib, cfg, force):
    """Fetch an ES module graph from esm.sh: the entry and, recursively, everything it imports (type "esm-graph").

    Re-export barrels are inlined and a module's imports of its own exports (through such a barrel) become local
    aliases, so that the graph is acyclic and Dataspatium.assets.importGraph can create blob: URLs in dependency
    order without import maps. The texts are kept as fetched; the aliases are rewrite instructions in index.json.
    Returns the files.json records (the texts are bundled as vendor/<lib>/graph.bundle.js by wrap_assets.py)."""
    host = cfg.get("host", "https://esm.sh")
    entry = cfg["entry"]
    gdir = SRC / lib / "graph"
    gdir.mkdir(parents=True, exist_ok=True)
    modules = {}
    queue = [entry]
    while queue:
        spec = queue.pop()
        if spec in modules:
            continue
        dest = gdir / esm_file_name(spec)
        if dest.exists() and not force:
            data = dest.read_bytes()
        else:
            data = http_get(host + spec)
            dest.write_bytes(data)
            print(f"  fetched  {lib}{spec} ({len(data) / 1e3:.1f} kB)")
        text = data.decode("utf-8")
        deps = {}
        for lit in ESM_SPEC_RE.findall(text) + ESM_DYN_RE.findall(text):
            target = esm_resolve(spec, lit)
            if target:
                deps[lit] = target
        modules[spec] = {"file": esm_file_name(spec), "deps": deps, "text": text, "size": len(data), "sha256": sha256_of(data), "url": host + spec}
        queue.extend(d for d in set(deps.values()) if d not in modules)
    # Barrels: modules that only re-export one other module; their importers go straight to the source.
    barrels = {}
    for spec, m in modules.items():
        if ESM_BARREL_RE.match(m["text"]):
            sources = set(re.findall(r"""from\s*["']([^"']+)["']""", m["text"]))
            if len(sources) == 1:
                barrels[spec] = m["deps"].get(next(iter(sources)))

    def resolve(target):
        seen = set()
        while target in barrels and target not in seen:
            seen.add(target)
            target = barrels[target]
        return target

    for m in modules.values():
        m["deps"] = {lit: resolve(t) for lit, t in m["deps"].items()}
    # Self-imports (a module importing its own exports through a barrel) become local aliases.
    for spec, m in modules.items():
        selfs = [lit for lit, t in m["deps"].items() if t == spec]
        if not selfs:
            continue
        exports = esm_exports(m["text"])
        rewrites = []
        for lit in selfs:
            found = False
            for sm in ESM_SELF_IMPORT_RE.finditer(m["text"]):
                if sm.group(2) != lit:
                    continue
                aliases = []
                for part in sm.group(1).split(","):
                    part = part.strip()
                    if not part:
                        continue
                    am = re.match(r"^(\S+)\s+as\s+(\S+)$", part)
                    imported, local = (am.group(1), am.group(2)) if am else (part, part)
                    if imported not in exports:
                        raise ValueError(f"{lib}: {spec} imports {imported} from itself but does not export it")
                    if exports[imported] != local:
                        aliases.append(f"const {local}={exports[imported]};")
                # The import statement goes; the aliases come last, after every declaration of the (minified) module.
                rewrites.append([sm.group(0), ""])
                m["append"] = m.get("append", "") + "".join(aliases)
                found = True
            if not found:
                raise ValueError(f"{lib}: cannot rewrite the self-import {lit!r} in {spec}")
            del m["deps"][lit]
        m["rewrites"] = rewrites
        print(f"  self-import in {spec}: {len(rewrites)} statement(s) become local aliases at the end of the module")
    # Reachable modules from the entry (barrels drop out), then the cycle check.
    entry_resolved = resolve(entry)
    reach = {}
    stack = [entry_resolved]
    while stack:
        s = stack.pop()
        if s in reach:
            continue
        reach[s] = modules[s]
        stack.extend(modules[s]["deps"].values())
    state = {}

    def dfs(s, path):
        state[s] = 1
        for d in set(reach[s]["deps"].values()):
            if state.get(d) == 1:
                raise ValueError(f"{lib}: cyclic module graph: {' -> '.join(path + [s, d])}")
            if d not in state:
                dfs(d, path + [s])
        state[s] = 2

    for s in reach:
        if s not in state:
            dfs(s, [])
    packages = {}
    for s in reach:
        pm = re.match(r"^/((?:@[^/]+/)?[^/@]+)@(\d[^/]*)/", s)
        if pm:
            packages[pm.group(1)] = pm.group(2)
    index = {"entry": entry_resolved, "host": host, "packages": packages,
             "modules": {s: dict({"file": m["file"], "deps": m["deps"]}, **({"rewrites": m["rewrites"]} if m.get("rewrites") else {}), **({"append": m["append"]} if m.get("append") else {})) for s, m in reach.items()}}
    index_text = json.dumps(index, indent=1, ensure_ascii=False)
    (gdir / "index.json").write_text(index_text, encoding="utf-8", newline="\n")
    files = [{"as": "graph/index.json", "url": host + entry, "wrap": "text", "bundle": "graph",
              "size": len(index_text.encode("utf-8")), "sha256": sha256_of(index_text.encode("utf-8"))}]
    for s, m in reach.items():
        files.append({"as": "graph/" + m["file"], "url": m["url"], "wrap": "text", "bundle": "graph", "size": m["size"], "sha256": m["sha256"]})
    print(f"  graph: {len(reach)} modules, {sum(m['size'] for m in reach.values()) / 1e3:.0f} kB, packages: {', '.join(sorted(packages))}")
    fetch_license(lib, cfg)
    fetch_graph_licenses(lib, packages)
    return files


def fetch_graph_licenses(lib, packages):
    """LICENSE of every package in a module graph as vendor/<lib>/LICENSE-<pkg>.txt (jsDelivr serves the npm files)."""
    for pkg, ver in sorted(packages.items()):
        target = OUT / lib / ("LICENSE-" + pkg.replace("/", "__") + ".txt")
        if target.exists():
            continue
        for cand in LICENSE_CANDIDATES:
            try:
                target.write_bytes(http_get(JSDELIVR_FILE.format(pkg=pkg, ver=ver, path=cand), retries=1, timeout=30))
                print(f"  license  {pkg}@{ver}")
                break
            except Exception:  # noqa: BLE001
                continue
        else:
            # No licence file in the package: record the licence declared in package.json instead.
            try:
                meta = json.loads(http_get(JSDELIVR_FILE.format(pkg=pkg, ver=ver, path="package.json"), retries=1, timeout=30))
                declared = meta.get("license") or meta.get("licenses") or "unknown"
                target.write_text(f"{pkg} {ver}: the package ships no licence file; package.json declares the licence {json.dumps(declared)}.\n", encoding="utf-8", newline="\n")
                print(f"  license  {pkg}@{ver} (declared in package.json: {declared})")
            except Exception:  # noqa: BLE001
                print(f"  WARNING: no LICENSE found for {pkg}@{ver}", file=sys.stderr)


def parse_packages(text):
    """Parse an R PACKAGES file (Debian control format) into {name: fields}."""
    records = {}
    for block in re.split(r"\n\s*\n", text):
        fields, key = {}, None
        for line in block.splitlines():
            if line[:1] in (" ", "\t") and key:
                fields[key] += " " + line.strip()
            elif ":" in line:
                key, _, value = line.partition(":")
                key = key.strip()
                fields[key] = value.strip()
        if "Package" in fields:
            fields["_raw"] = block.strip()
            records[fields["Package"]] = fields
    return records


def dependency_closure(records, targets):
    """Return the set of packages needed to install the targets (Depends, Imports, LinkingTo)."""
    def deps(pkg):
        out = set()
        for field in ("Depends", "Imports", "LinkingTo"):
            for dep in records.get(pkg, {}).get(field, "").split(","):
                dep = re.sub(r"\(.*?\)", "", dep).strip()
                if dep and dep not in R_BASE_PACKAGES:
                    out.add(dep)
        return out

    seen, stack = set(), list(targets)
    while stack:
        pkg = stack.pop()
        if pkg in seen:
            continue
        if pkg not in records:
            raise RuntimeError(f"R package not available in the webR repository: {pkg}")
        seen.add(pkg)
        stack.extend(deps(pkg) - seen)
    return seen


def fetch_r_repo(lib, cfg, force):
    """Mirror the needed subset of the webR binary package repository."""
    rver = cfg["rVersion"]
    contrib = f"bin/emscripten/contrib/{rver}"
    base = f"{cfg['repo'].rstrip('/')}/{contrib}"
    records = parse_packages(http_get(f"{base}/PACKAGES").decode("utf-8", "replace"))
    closure = sorted(dependency_closure(records, cfg["packages"]))
    print(f"  {lib}: {len(closure)} packages for {cfg['packages']}")
    files = []
    # Filtered PACKAGES index so that R only sees what we actually bundle.
    pkg_dir = SRC / lib / contrib
    pkg_dir.mkdir(parents=True, exist_ok=True)
    index_text = "\n\n".join(records[p]["_raw"] for p in closure) + "\n"
    (pkg_dir / "PACKAGES").write_text(index_text, encoding="utf-8", newline="\n")
    index_bytes = index_text.encode("utf-8")
    files.append({"as": f"{contrib}/PACKAGES", "url": f"{base}/PACKAGES", "wrap": "text", "bundle": None,
                  "size": len(index_bytes), "sha256": sha256_of(index_bytes)})
    # R's available.packages() asks for PACKAGES.gz before PACKAGES; serving it avoids a warning.
    gz_bytes = gzip.compress(index_bytes, mtime=0)
    (pkg_dir / "PACKAGES.gz").write_bytes(gz_bytes)
    files.append({"as": f"{contrib}/PACKAGES.gz", "url": f"{base}/PACKAGES.gz", "wrap": "base64", "bundle": None,
                  "size": len(gz_bytes), "sha256": sha256_of(gz_bytes)})
    entries = [{"url": f"{base}/{p}_{records[p]['Version']}.tgz", "as": f"{contrib}/{p}_{records[p]['Version']}.tgz",
                "wrap": "base64", "bundle": None} for p in closure]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        files += list(pool.map(lambda e: download_entry(lib, e, force), entries))
    packages_meta = {p: {"version": records[p]["Version"], "license": records[p].get("License", "unknown"),
                         "title": records[p].get("Title", "")} for p in closure}
    (SRC / lib / "packages.json").write_text(json.dumps(packages_meta, indent=2, ensure_ascii=False), encoding="utf-8", newline="\n")
    (OUT / lib).mkdir(parents=True, exist_ok=True)
    (OUT / lib / "LICENSE").write_text(
        "The R packages in this directory are redistributed unchanged from https://repo.r-wasm.org/ (built by the webR\n"
        "project from CRAN sources). Each package keeps its own license, listed in THIRD_PARTY_LICENSES.md.\n"
        "Sources: https://cran.r-project.org/web/packages/\n", encoding="utf-8")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-download even if cached in vendor-src/")
    parser.add_argument("--only", default="", help="comma-separated library names to process")
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    for lib, cfg in config["libraries"].items():
        if only and lib not in only:
            continue
        print(f"[{lib}]")
        if cfg.get("type") == "r-repo":
            files = fetch_r_repo(lib, cfg, args.force)
        elif cfg.get("type") == "esm-graph":
            files = fetch_esm_graph(lib, cfg, args.force)
        else:
            entries = list(expand_entries(lib, cfg))
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                files = list(pool.map(lambda e: download_entry(lib, e, args.force), entries))
            fetch_license(lib, cfg)
        (SRC / lib).mkdir(parents=True, exist_ok=True)
        (SRC / lib / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8", newline="\n")
    print("done")


if __name__ == "__main__":
    main()
