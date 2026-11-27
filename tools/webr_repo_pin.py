#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Print the pin of webR's package index for INDEX_PINS in src/engines/r/remote-packages.js.

The app fetches R packages that are not bundled from webR's repository (repo.r-wasm.org) after consent and checks them
against the MD5 sums in the repository's PACKAGES index, which is itself pinned by SHA-256. Run this when webR moves to
another R version (the contrib folder under vendor/webr-repo) and paste the printed line into INDEX_PINS. The index of an
R version stops changing once the next R version is out; the tool says when the file last changed and whether every
package in it has a sum.

Usage:
    python tools/webr_repo_pin.py [<R version>]      (default: the bundled one, e.g. 4.5)
"""
import hashlib
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def bundled_version():
    contrib = os.path.join(ROOT, 'vendor', 'webr-repo', 'bin', 'emscripten', 'contrib')
    names = sorted(n for n in os.listdir(contrib) if re.match(r'^\d+\.\d+$', n))
    if not names:
        sys.exit('No R version under ' + contrib)
    return names[-1]


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else bundled_version()
    url = 'https://repo.r-wasm.org/bin/emscripten/contrib/%s/PACKAGES' % version
    with urllib.request.urlopen(url, timeout=120) as res:
        data = res.read()
        changed = res.headers.get('Last-Modified', '?')
    text = data.decode('utf-8', 'replace')
    blocks = [b for b in re.split(r'\n\s*\n', text) if re.search(r'^Package:', b, re.M)]
    without = [re.search(r'^Package:\s*(\S+)', b, re.M).group(1) for b in blocks if not re.search(r'^MD5sum:\s*[0-9a-fA-F]{32}\s*$', b, re.M)]
    print('%s: %d packages, last changed %s' % (url, len(blocks), changed))
    if without:
        print('without MD5sum (refused by the app): ' + ', '.join(without[:20]) + (' ...' if len(without) > 20 else ''))
    print("      '%s': Object.freeze({ sha256: '%s', size: %d })," % (version, hashlib.sha256(data).hexdigest(), len(data)))


if __name__ == '__main__':
    main()
