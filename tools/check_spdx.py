#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Check the licence line of the app's own files (decision F74 a).

Every hand-written file of Dataspatium's own code (src/, tests/, tools/, r/, python/, m/ and the JavaScript files beside
index.html) names its licence in an SPDX line among its first five lines: PolyForm Strict 1.0.0, except the deployment file
dataspatium.config.js, which is 0BSD so that whoever deploys the app may change and share their version. Generated wrappers
(*.json.js, *.R.js, *.py.js, docs/help/) and vendor/ are not checked. Exit code 0 when every file is right.

Usage: python -I tools/check_spdx.py [repository root]
"""
import re
import subprocess
import sys
from pathlib import Path

OWN = "LicenseRef-PolyForm-Strict-1.0.0"
# The deployment file (F74 a), and third-party test data that keeps its own licence (buildingSMART's BCF schemas).
EXCEPTIONS = {"dataspatium.config.js": "0BSD", "tests/fixtures/bcf-schemas/schemas.js": "CC-BY-ND-4.0"}
FOLDERS = ("src/", "tests/", "tools/", "r/", "python/", "m/")
SUFFIXES = (".js", ".py", ".ps1", ".R", ".css")
GENERATED = re.compile(r"(\.json\.js|\.R\.js|\.py\.js)$|^docs/help/")
LINE = re.compile(r"SPDX-License-Identifier:\s*(\S+)")


def wanted(path: str) -> bool:
    if not path.endswith(SUFFIXES) or GENERATED.search(path):
        return False
    return path.startswith(FOLDERS) or ("/" not in path and path.endswith(".js"))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    files = subprocess.run(["git", "ls-files"], cwd=root, capture_output=True, text=True, check=True).stdout.split("\n")
    wrong = []
    checked = 0
    for path in filter(wanted, files):
        checked += 1
        head = (root / path).read_text(encoding="utf-8", errors="replace").splitlines()[:5]
        found = next((m.group(1) for line in head for m in [LINE.search(line)] if m), None)
        expected = EXCEPTIONS.get(path, OWN)
        if found != expected:
            wrong.append(f"{path}: {found or 'no SPDX line'} (expected {expected})")
    for path in EXCEPTIONS:
        if path not in files:
            wrong.append(f"{path}: missing")
    for line in wrong:
        print(line)
    print(f"spdx: {checked} files, {len(wrong)} wrong")
    return 1 if wrong else 0


if __name__ == "__main__":
    sys.exit(main())
