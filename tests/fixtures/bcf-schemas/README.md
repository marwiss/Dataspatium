# BCF-XML schemas for the tests

buildingSMART International's XML schemas (XSD) for BCF-XML, copied unchanged so that the tests can check every BCF file the app
writes against them (decision F47 a). They are used only by the tests (`tests/bcf-schema-check.js`, `tests/bcf-xml.test.js`), never
by the app, and they are left out of the release ZIP (`.gitattributes`: `export-ignore`).

| Folder | Source | Tag | Commit |
|---|---|---|---|
| `3.0/` | https://github.com/buildingSMART/BCF-XML/tree/v3.0/Schemas | `v3.0` | `5834466b2477ac700d7a61990b4e67ec1005cc68` |
| `2.1/` | https://github.com/buildingSMART/BCF-XML/tree/v2.1/Schemas | `v2.1` | `a0fbab777706b5ac282105f724979e1f8e271e51` |

- `3.0/`: `documents.xsd`, `extensions.xsd`, `markup.xsd`, `project.xsd`, `shared-types.xsd`, `version.xsd`, `visinfo.xsd`.
- `2.1/`: `markup.xsd`, `project.xsd`, `version.xsd`, `visinfo.xsd` (the sample `extensions.xsd` of 2.1 is not copied).
- Each file has the same Git blob hash as in the source at that tag. They were fetched with
  `gh api "repos/buildingSMART/BCF-XML/contents/Schemas/<file>?ref=<tag>" -H "Accept: application/vnd.github.raw"`.
- `schemas.js` holds the same files as JSON strings, because a page opened from file:// cannot read a file beside it. It is
  written by `python tools/bcf_schemas.py`; run it again whenever the XSD files are replaced.

## Licence

© buildingSMART International Ltd. The schemas are licensed under the Creative Commons Attribution-NoDerivatives 4.0 International
License (CC BY-ND 4.0): https://creativecommons.org/licenses/by-nd/4.0/. `LICENSE` in this folder is the repository's own licence
file, unchanged, from commit `bc48611d0d7a1587f028a2b69677a1aafd5cd0a8` (branch `release_3_0`); it covers the whole repository.

The licence allows copying and sharing the files unchanged, with this attribution. Do not edit them: a changed schema may not be
shared. PolyForm Strict, the licence of Dataspatium's own code, does not apply to the files in this folder.
