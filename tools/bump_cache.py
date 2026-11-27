#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Give the service worker's cache a new name (sw-coi.js `CACHE`), from the app's version and the time.

The service worker serves vendor/, presets/, src/, r/ and python/ from its cache once fetched, so an installed app or a returning
visitor (GitHub Pages, a web server) keeps the files it has until the cache name changes; if the name stays while files change,
the app could also mix old files from the cache with new ones fetched later (a group loaded on demand). Run this in every push
that changes such files; .claude's matrix.ps1 refuses a gate where they changed and the name did not.

Usage: python -I tools/bump_cache.py [repository root]   (prints the new name)
"""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    version = re.search(r"Dataspatium\.version\s*=\s*'([^']+)'", (root / "src/platform/registry.js").read_text(encoding="utf-8"))
    if not version:
        print("no version in src/platform/registry.js")
        return 1
    name = f"dataspatium-{version.group(1)}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"
    path = root / "sw-coi.js"
    raw = path.read_bytes().decode("utf-8")
    new, n = re.subn(r"const CACHE = '[^']*';", f"const CACHE = '{name}';", raw, count=1)
    if n != 1:
        print("no CACHE line in sw-coi.js")
        return 1
    path.write_bytes(new.encode("utf-8"))
    print(name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
