#!/usr/bin/env python3
"""Print the pinned IfcOpenShell wheel set for src/engines/python/catalog.js (IFC_WHEELS).

IfcOpenShell is not shipped in the ZIP: the app fetches its modular WebAssembly wheels from the index at
https://ifcopenshell.github.io/wasm-wheels/ on first use (after consent) and checks each file against the SHA-256 pinned
in catalog.js. Run this when upgrading: it downloads the wheels of a build into a folder, prints the IFC_WHEELS block
with digests and sizes, and leaves the order as upstream's demo installs them (the core, a schema parser and its
geometry mapping per schema, the pure-Python part, the geometry kernel). Paste the block and the version into catalog.js
and run the suite with ?python=1.

Usage:
    python tools/ifcopenshell_catalog.py <build> [<download dir>] [<kernel>]
Example:
    python tools/ifcopenshell_catalog.py 0.9.1+a963c38 %TEMP%/ifcopenshell opencascade
"""
import hashlib
import os
import sys
import urllib.parse
import urllib.request

TAG = "cp313-cp313-pyemscripten_2025_0_wasm32"
SCHEMAS = ["ifc2x3", "ifc4", "ifc4x3_add2"]


def wheels(kernel):
    names = ["ifcopenshell"]
    for schema in SCHEMAS:
        names += ["ifcopenshell_parse_schema_" + schema, "ifcopenshell_geometry_mapping_" + schema]
    names += ["ifcopenshell_pure_python", "ifcopenshell_geometry_kernel_" + kernel]
    return names


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    build = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ.get("TEMP", "."), "ifcopenshell-" + build)
    kernel = sys.argv[3] if len(sys.argv) > 3 else "opencascade"
    base = "https://ifcopenshell.github.io/wasm-wheels/modular/%s/" % urllib.parse.quote(build, safe="")
    os.makedirs(out, exist_ok=True)
    print("// IfcOpenShell %s from %s" % (build, base))
    print("const IFC_VERSION = '%s';" % build)
    print("const IFC_WHEELS = [")
    total = 0
    for name in wheels(kernel):
        pure = name == "ifcopenshell_pure_python"
        file = "%s-%s-%s.whl" % (name, build, "py3-none-any" if pure else TAG)
        path = os.path.join(out, file)
        if not os.path.exists(path):
            urllib.request.urlretrieve(base + urllib.parse.quote(file, safe=""), path)
        data = open(path, "rb").read()
        total += len(data)
        extra = ", pure: true" if pure else ""
        print("  { name: '%s', sha256: '%s', size: %d%s }," % (name.replace("_", "-"), hashlib.sha256(data).hexdigest(), len(data), extra))
    print("];")
    print("// %d wheels, %.1f MB" % (len(wheels(kernel)), total / 1e6))


if __name__ == "__main__":
    main()
