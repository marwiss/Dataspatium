# Lisenser

Dette er en forklaring på norsk. Den fullstendige lisensteksten i [LICENSE](../../LICENSE) gjelder. Teksten er ikke juridisk
rådgivning.

## Dataspatiums egen kode

Dataspatiums egen kode, dokumentasjon og forhåndsinnstillinger (alt unntatt mappen `vendor/`) er lisensiert under
**PolyForm Strict 1.0.0** (<https://polyformproject.org/licenses/strict/1.0.0>). Lisensgiver er Dataspatiums opphavsperson,
som kan kontaktes via GitHub-kontoen [marwiss](https://github.com/marwiss).

Dette kan du gjøre:

- Laste ned og bruke appen til ikke-kommersielle formål: privat, til studier, forskning, utdanning og veldedighet samt i
  offentlige etater, kommuner, regioner og andre offentlige institusjoner, uansett hvordan virksomheten finansieres.
- Bruke appen på så mange datamaskiner du vil i organisasjonen din.
- Lage egne datasett, oppskrifter, diagrammer, R-skript, API-konfigurasjoner og dokumentmaler med appen og dele dem som du
  vil. De er dine egne verk, ikke en del av appen.

Dette kan du ikke gjøre uten skriftlig tillatelse fra lisensgiveren:

- Bruke appen i kommersiell virksomhet, for eksempel i konsulentoppdrag eller som del av et produkt eller en tjeneste.
- Distribuere appen videre, helt eller delvis, eller publisere egne kopier. (GitHubs brukervilkår tillater at
  repositoriet forkes på GitHub; det gir ingen rettigheter utover det.)
- Endre koden eller bygge egne verk på den.

Vil du bruke Dataspatium på andre vilkår, kan du opprette et issue i repositoriet eller kontakte lisensgiveren der.

## Tredjepartskomponenter

Alt under `vendor/` er tredjepartskode med egne lisenser som ikke påvirkes av Dataspatiums lisens. Hvert bibliotek, dets
versjon og lisens finnes i [THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md) sammen med lisenstekstene.

| Komponent | Lisens | Hva det betyr |
|---|---|---|
| JavaScript-biblioteker (sql.js, Dexie, D3, Vega, PapaParse, SheetJS, docx, jsPDF, fflate, CodeMirror med flere) | MIT, BSD-3-Clause, Apache-2.0, ISC | Frie å bruke og distribuere så lenge lisenstekst og merknader følger med |
| Skrifttypen Inter | SIL Open Font License 1.1 | Kan bygges inn i appen; kan ikke selges for seg selv |
| Lucide-ikoner (også appens merke og favicon) | ISC | Som over |
| webR (JavaScript-delen) | MIT | Som over |
| R (R.wasm med flere) | GPL-2 eller GPL-3 | Fri programvare. Distribueres uendret i binær form; kildekoden finnes hos R-prosjektet og webR-prosjektet i de oppgitte versjonene |
| R-pakker i `vendor/webr-repo` | Mest MIT; også LGPL (DBI, RSQLite), MPL-2.0 (data.table), GPL (Rcpp, pxR, knitr, svglite med flere) | Distribueres uendret; kildekoden finnes på CRAN i de oppgitte versjonene |
| Python (Pyodide, CPython og pakker som numpy, pandas og matplotlib; hentes ved behov, ikke i mappen) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-lisensen (PSF-basert), MIT og lignende for de øvrige | Hentes uendret fra jsDelivr og lagres i nettleseren; kildekoden finnes hos Pyodide-prosjektet og på PyPI i de versjonene appens katalog angir (Pyodide 314.0.7) |
| pdf.js 3.11 (leser PDF-filer) med standardskrifter | Apache-2.0 (pdf.js), BSD-3-Clause (Foxits skrifter), SIL Open Font License 1.1 (Liberation Sans) | Frie å bruke og spre med lisenstekst og notiser; skriftene kan bygges inn |
| Leaflet 1.9 (kart) og Turf 7 (geoverktøy) | BSD-2-Clause (Leaflet), MIT (Turf) | Frie å bruke og spre med lisenstekst og notiser |
| plotly.js (hentes ved behov for plotly-diagrammer), seaborn og plotly (Python-hjul fra PyPI, hentes ved behov) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Hentes uendret fra jsDelivr og PyPI, låst til versjon og kontrollsum, og lagres i nettleseren |

Dataspatiums kode lenker ikke mot R. R kjører som en separat tolk i en worker og utveksler R-kode, SQLite-filer og bilder
med appen via meldinger; det er den typen samdistribusjon («mere aggregation») som GPL tillater, og R-delene beholder alle
sine GPL-rettigheter for deg som bruker. Eksempeldata i `presets/` kommer fra åpne kilder og beholder sine opprinnelige
lisenser (CC0 eller CC BY etter den enkelte etaten). De svenske kommune- og länsgrensene i `presets/geo/` er SCBs *Digitala
gränser* under CC0 1.0, omregnet til lengde- og breddegrad. De danske grensene er DAGI 1:500 000 fra Geodatastyrelsen
(nå Klimadatastyrelsen), frie data som kan brukes og deles med kildeangivelse; de norske kommer fra Kartverkets N1000
Kartdata og de finske fra Statistikcentralen, begge under CC BY 4.0 (kildeangivelse «© Kartverket» og «Tilastokeskus /
Statistikcentralen»). Se `presets/geo/KALLA.md`. Data som hentes fra de åpne
API-ene, omfattes av den enkelte utgiverens lisens, som vises sammen med kilden i appen.
