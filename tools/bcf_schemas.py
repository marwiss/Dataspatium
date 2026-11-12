#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Wrap buildingSMART's BCF XSD files for the browser tests:  python tools/bcf_schemas.py

The tests run from file://, where a page cannot read a file beside it, so the XSD files under tests/fixtures/bcf-schemas/<version>/
are written, byte for byte as JSON strings, into tests/fixtures/bcf-schemas/schemas.js. The XSD files themselves are buildingSMART's
(CC BY-ND 4.0) and are never changed; the folder's README names the source and the commit. The folder is left out of the release
ZIP (.gitattributes, export-ignore). Run again after the XSD files are replaced.
"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FOLDER = os.path.join(ROOT, 'tests', 'fixtures', 'bcf-schemas')
VERSIONS = ('3.0', '2.1')


def main():
    schemas = {}
    for version in VERSIONS:
        folder = os.path.join(FOLDER, version)
        schemas[version] = {}
        for name in sorted(os.listdir(folder)):
            if name.endswith('.xsd'):
                with open(os.path.join(folder, name), 'rb') as f:
                    schemas[version][name] = f.read().decode('utf-8')
    body = json.dumps(schemas, ensure_ascii=True, indent=1, sort_keys=True)
    out = (
        '// @ts-check\n'
        '// SPDX-License-Identifier: CC-BY-ND-4.0\n'
        '/**\n'
        ' * buildingSMART\'s BCF-XML schemas (XSD) for BCF 3.0 and 2.1, (c) buildingSMART International Ltd., CC BY-ND 4.0\n'
        ' * (http://creativecommons.org/licenses/by-nd/4.0/). The files beside this one, unchanged, as JSON strings so that the tests can\n'
        ' * read them from file://; written by tools/bcf_schemas.py. Source and commit: README.md in this folder. Only for the tests;\n'
        ' * not part of the app or the release ZIP.\n'
        ' */\n'
        '(function () {\n'
        "  'use strict';\n"
        "  globalThis.Dataspatium.define('tests/fixtures/bcf-schemas', [], () => (" + body + '));\n'
        '})();\n'
    )
    with open(os.path.join(FOLDER, 'schemas.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    print('wrote', os.path.relpath(os.path.join(FOLDER, 'schemas.js'), ROOT), sum(len(v) for v in schemas.values()), 'schemas')


if __name__ == '__main__':
    main()
