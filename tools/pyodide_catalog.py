#!/usr/bin/env python3
"""Print the pinned Pyodide runtime catalog for src/engines/python/catalog.js.

Python is not shipped in the ZIP: the app fetches Pyodide's runtime files and wheels from jsDelivr on demand
(platform/components) and checks every file against a SHA-256. The runtime files are pinned here; the wheels are
verified with the digests in pyodide-lock.json, which is itself pinned. Run this when upgrading Pyodide and paste
the printed RUNTIME block into catalog.js (check that the three loader patch sites still exist, see
tools/pyodide_patches.md in docs/utveckling.md).

Usage:
    python tools/pyodide_catalog.py <version> [<download dir>] [package ...]
Example:
    python tools/pyodide_catalog.py 314.0.7 %TEMP%/pyodide numpy pandas matplotlib micropip
"""
import hashlib
import json
import os
import sys
import urllib.request

RUNTIME_FILES = ["pyodide.js", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    version = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ.get("TEMP", "."), "pyodide-" + version)
    want = sys.argv[3:] or ["numpy", "pandas", "matplotlib", "micropip"]
    base = f"https://cdn.jsdelivr.net/pyodide/v{version}/full/"
    os.makedirs(out, exist_ok=True)
    print(f"// Pyodide {version} from {base}")
    print("const RUNTIME = [")
    for name in RUNTIME_FILES:
        path = os.path.join(out, name)
        if not os.path.exists(path):
            urllib.request.urlretrieve(base + name, path)
        data = open(path, "rb").read()
        print(f"  {{ file: '{name}', sha256: '{hashlib.sha256(data).hexdigest()}', size: {len(data)} }},")
    print("];")
    lock = json.load(open(os.path.join(out, "pyodide-lock.json"), encoding="utf-8"))
    packages = lock["packages"]
    print(f"// lock: Python {lock['info'].get('python')}, {len(packages)} packages")
    seen = []

    def add(name):
        if name in seen or name not in packages:
            return
        seen.append(name)
        for dep in packages[name].get("depends", []):
            add(dep)

    for w in want:
        add(w)
    total = 0
    for name in sorted(seen):
        p = packages[name]
        path = os.path.join(out, p["file_name"])
        if not os.path.exists(path):
            urllib.request.urlretrieve(base + p["file_name"], path)
        data = open(path, "rb").read()
        digest = hashlib.sha256(data).hexdigest()
        ok = "ok" if digest == p["sha256"] else "MISMATCH"
        total += len(data)
        print(f"// {name} {p['version']}: {p['file_name']} {len(data)} bytes, lock sha256 {ok}")
    print(f"// closure of {', '.join(want)}: {len(seen)} wheels, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
