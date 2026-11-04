# Licences

This is an explanation in English. The full licence text in [LICENSE](../../LICENSE) applies. This text is not legal
advice.

## Dataspatium's own code

Dataspatium's own code, documentation and presets (everything except the folder `vendor/`) are licensed under
**PolyForm Strict 1.0.0** (<https://polyformproject.org/licenses/strict/1.0.0>). The licensor is Dataspatium's
author, who can be reached through the GitHub account [marwiss](https://github.com/marwiss).

What you may do:

- Download and use the app for non-commercial purposes: privately, for study, research, education and charity, and
  within public authorities, municipalities, regions and other public institutions, however the activity is funded.
- Use the app on as many computers as you like within your organisation.
- Create your own datasets, recipes, charts, R scripts, API configurations and document templates with the app and
  share them as you like. They are your own works, not part of the app.

What you may not do without written permission from the licensor:

- Use the app in commercial activity, for example in consulting assignments or as part of a product or service.
- Redistribute the app, in whole or in part, or publish your own copies. (GitHub's terms of service allow the
  repository to be forked on GitHub; that gives no rights beyond it.)
- Modify the code or build your own works on it.

If you want to use Dataspatium on other terms, open an issue in the repository or contact the licensor there.

## Third-party components

Everything under `vendor/` is third-party code with its own licences, which are not affected by Dataspatium's
licence. Each library, its version and licence are listed in
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md), together with the licence texts.

| Component | Licence | What it means |
|---|---|---|
| JavaScript libraries (sql.js, Dexie, D3, Vega, PapaParse, SheetJS, docx, jsPDF, fflate, CodeMirror and others) | MIT, BSD-3-Clause, Apache-2.0, ISC | Free to use and distribute as long as the licence text and notices come along |
| The font Inter | SIL Open Font License 1.1 | May be embedded in the app; may not be sold on its own |
| Lucide icons (also the app's mark and favicon) | ISC | As above |
| webR (the JavaScript part) | MIT | As above |
| R (R.wasm and others) | GPL-2 or GPL-3 | Free software. Distributed unchanged in binary form; the source code is available from the R project and the webR project in the stated versions |
| R packages in `vendor/webr-repo` | Mostly MIT; also LGPL (DBI, RSQLite), MPL-2.0 (data.table), GPL (Rcpp, pxR, knitr, svglite and others) | Distributed unchanged; the source code is available on CRAN in the stated versions |
| Python (Pyodide, CPython and packages such as numpy, pandas and matplotlib; fetched on demand, not in the folder) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), the matplotlib licence (PSF-based), MIT and similar for the rest | Fetched unchanged from jsDelivr and kept in the browser; the source code is with the Pyodide project and on PyPI in the versions named in the app's catalogue (Pyodide 314.0.7) |

Dataspatium's code does not link against R. R runs as a separate interpreter in a worker and exchanges R code, SQLite
files and images with the app through messages; that is the kind of co-distribution ("mere aggregation") the GPL
allows, and the R parts keep all their GPL rights for you as a user. Example data in `presets/` comes from open
sources and keeps its original licences (CC0 or CC BY according to each agency). The municipality and county
boundaries in `presets/geo/` are SCB's *Digitala gränser* under CC0 1.0, converted to longitude and latitude. The
Danish boundaries are DAGI 1:500 000 from Geodatastyrelsen (now Klimadatastyrelsen), free data that may be used and
shared with attribution; the Norwegian ones come from Kartverket's N1000 Kartdata and the Finnish ones from Statistics
Finland, both under CC BY 4.0 (attribution "© Kartverket" and "Tilastokeskus / Statistics Finland"). See
`presets/geo/KALLA.md`. Data fetched from the open APIs is covered by each publisher's licence, which is shown
with the source in the app.
