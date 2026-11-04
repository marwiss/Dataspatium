# Licenser

Det här är en förklaring på svenska. Den fullständiga licenstexten i [LICENSE](../LICENSE) gäller. Texten är ingen
juridisk rådgivning.

## Dataspatiums egen kod

Dataspatiums egen kod, dokumentation och förinställningar (allt utom mappen `vendor/`) är licensierade under
**PolyForm Strict 1.0.0** (<https://polyformproject.org/licenses/strict/1.0.0>). Licensgivare är Dataspatiums
upphovsperson, som nås via GitHub-kontot [marwiss](https://github.com/marwiss).

Det får du göra:

- Ladda ned och använda appen för icke-kommersiella ändamål: privat, för studier, forskning, utbildning och
  välgörenhet samt inom myndigheter, kommuner, regioner och andra offentliga institutioner, oavsett hur
  verksamheten finansieras.
- Använda appen på så många datorer du vill inom din organisation.
- Skapa egna datamängder, recept, diagram, R-skript, API-konfigurationer och dokumentmallar med appen och dela dem
  hur du vill. De är dina egna verk, inte en del av appen.

Det får du inte göra utan skriftligt tillstånd från licensgivaren:

- Använda appen i kommersiell verksamhet, till exempel i konsultuppdrag eller som del av en produkt eller tjänst.
- Sprida appen vidare, helt eller delvis, eller publicera egna kopior. (GitHubs användarvillkor tillåter att repot
  forkas på GitHub; det ger inga rättigheter utöver det.)
- Ändra koden eller bygga egna verk på den.

Vill du använda Dataspatium på andra villkor, öppna ett ärende (issue) i repot eller kontakta licensgivaren där.

## Tredjepartskomponenter

Allt under `vendor/` är tredjepartskod med egna licenser som inte påverkas av Dataspatiums licens. Varje bibliotek,
dess version och licens finns i [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md), tillsammans med
licenstexterna.

| Komponent | Licens | Vad det innebär |
|---|---|---|
| JavaScript-bibliotek (sql.js, Dexie, D3, Vega, PapaParse, SheetJS, docx, jsPDF, fflate, CodeMirror med flera) | MIT, BSD-3-Clause, Apache-2.0, ISC | Fria att använda och sprida så länge licenstext och notiser följer med |
| Typsnittet Inter | SIL Open Font License 1.1 | Får bäddas in i appen; får inte säljas för sig |
| webR (JavaScript-delen) | MIT | Som ovan |
| R (R.wasm med flera) | GPL-2 eller GPL-3 | Fri programvara. Distribueras oförändrad i binär form; källkoden finns hos R-projektet och webR-projektet i de versioner som anges |
| R-paket i `vendor/webr-repo` | Mest MIT; även LGPL (DBI, RSQLite), MPL-2.0 (data.table), GPL (Rcpp, pxR, knitr, svglite med flera) | Distribueras oförändrade; källkoden finns på CRAN i de versioner som anges |
| Python (Pyodide, CPython och paket som numpy, pandas och matplotlib; hämtas vid behov, ingår inte i mappen) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-licensen (PSF-baserad), MIT och liknande för övriga | Hämtas oförändrade från jsDelivr och lagras i webbläsaren; källkoden finns hos Pyodide-projektet och på PyPI i de versioner som anges i appens katalog (Pyodide 314.0.7) |
| pdf.js 3.11 (läser PDF-filer) med standardtypsnitt | Apache-2.0 (pdf.js), BSD-3-Clause (Foxits typsnitt), SIL Open Font License 1.1 (Liberation Sans) | Fria att använda och sprida med licenstext och notiser; typsnitten får bäddas in |
| Leaflet 1.9 (kartor) och Turf 7 (geoverktyg) | BSD-2-Clause (Leaflet), MIT (Turf) | Fria att använda och sprida med licenstext och notiser |
| Cytoscape 3.34 med fcose, dagre och expand-collapse, sigma 3 och graphology (grafer) | MIT | Fria att använda och sprida med licenstext och notiser |
| neo4j-driver-lite 6.3 (Neo4j över Bolt) | Apache-2.0 | Fri att använda och sprida med licenstext och notiser |
| Boverkets Planbestämmelsekatalog (inbäddad kopia, `presets/plan/`) | Öppna data från Boverket | Fri att använda och sprida; Boverket och Planbestämmelsekatalogen ska anges som källa |
| plotly.js (hämtas vid behov för plotly-diagram), seaborn och plotly (Python-hjul från PyPI, hämtas vid behov) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Hämtas oförändrade från jsDelivr respektive PyPI, låsta till version och kontrollsumma, och lagras i webbläsaren |

Dataspatiums kod länkar inte mot R. R körs som en separat tolk i en worker och utbyter R-kod, SQLite-filer och
bilder med appen via meddelanden; det är sådan samdistribution ("mere aggregation") som GPL tillåter, och
R-delarna behåller alla sina GPL-rättigheter för dig som användare. Exempeldata i `presets/` kommer från öppna
källor och behåller sina ursprungslicenser (CC0 eller CC BY enligt respektive myndighet). Kommun- och
länsgränserna i `presets/geo/` är SCB:s *Digitala gränser* under CC0 1.0, omräknade till longitud och latitud.
De danska gränserna är DAGI 1:500 000 från Geodatastyrelsen (nu Klimadatastyrelsen), fria data som får användas
och spridas med källangivelse; de norska kommer ur Kartverkets N1000 Kartdata och de finska från Statistikcentralen,
båda under CC BY 4.0 (källangivelse "© Kartverket" respektive "Tilastokeskus / Statistikcentralen"). Se
`presets/geo/KALLA.md`.
