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
| Python (Pyodide, CPython og pakker som numpy, pandas og matplotlib; hentes ved behov, ikke i mappen) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-lisensen (PSF-basert), MIT og lignende for de øvrige | Hentes uendret fra jsDelivr og lagres i nettleseren; kildekoden finnes hos Pyodide-prosjektet og på PyPI i de versjonene appens katalog angir (Pyodide 0.29.5) |
| pdf.js 3.11 (leser PDF-filer) med standardskrifter | Apache-2.0 (pdf.js), BSD-3-Clause (Foxits skrifter), SIL Open Font License 1.1 (Liberation Sans) | Frie å bruke og spre med lisenstekst og notiser; skriftene kan bygges inn |
| Leaflet 1.9 (kart) og Turf 7 (geoverktøy) | BSD-2-Clause (Leaflet), MIT (Turf) | Frie å bruke og spre med lisenstekst og notiser |
| proj4js 2.22 og Proj4Leaflet 1.0 (plankartet i planens eget koordinatsystem) | MIT (proj4js), BSD-2-Clause (Proj4Leaflet) | Frie å bruke og spre med lisenstekst og notiser |
| Cytoscape 3.34 med fcose, dagre og expand-collapse, sigma 3 og graphology (grafer) | MIT | Frie å bruke og spre med lisenstekst og notiser |
| neo4j-driver-lite 6.3 (Neo4j over Bolt) | Apache-2.0 | Fri å bruke og spre med lisenstekst og notiser |
| web-ifc 0.0.78 (geometri fra IFC; uendrede filer, kildekode på https://github.com/ThatOpen/engine_web-ifc) | MPL-2.0 | Fri å bruke og spre; endringer i bibliotekets egne filer deles under samme lisens |
| three.js 0.187 (3D-tegning), dxf-parser 1.1 (DXF) | MIT | Frie å bruke og spre med lisenstekst og notiser |
| Boverkets Planbestämmelsekatalog (innebygd kopi, `presets/plan/`) | Åpne data fra Boverket | Fri å bruke og spre; Boverket og Planbestämmelsekatalogen skal oppgis som kilde |
| Boverkets klimadatabase (hentes ved behov fra api.boverket.se, ikke i mappen) | Åpne data etter Boverkets bruksvilkår (dnr 5913/2024, bygger på Svensk API-lisens) | Fri å bruke; Boverket og klimadatabasen skal oppgis som kilde, varemerket bare i kildehenvisningen, og dataene brukes på egen risiko |
| Tesseract og tesseract.js-core (leser tekst i bilder; hentes ved behov, er ikke i mappen), språkdata fra tessdata_best | Apache-2.0 (Tesseract, tesseract.js-core, språkdata) | Hentes uendret fra jsDelivr, låst til versjon og kontrollsum, og lagres i nettleseren |
| plotly.js (hentes ved behov for plotly-diagrammer), seaborn og plotly (Python-hjul fra PyPI, hentes ved behov) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Hentes uendret fra jsDelivr og PyPI, låst til versjon og kontrollsum, og lagres i nettleseren |
| IfcOpenShell 0.9.1 (leser, kontrollerer og endrer IFC-modeller i Python; hentes ved behov som WebAssembly-wheels fra IfcOpenShells egen fortegnelse, ikke i mappen) med OpenCASCADE-kjernen samt lark og isodate | LGPL-3.0 (IfcOpenShell; kildekode på https://github.com/IfcOpenShell/IfcOpenShell), LGPL-2.1 med unntak (OpenCASCADE), MIT (lark), BSD-3-Clause (isodate) | Hentes uendret, låst til versjon og kontrollsum, og lagres i nettleseren. IfcOpenShell kjører som en frittstående Python-pakke i en worker og kan byttes mot en annen versjon; appens kode lenker ikke mot det |
| ifctester 0.9.0 (IDS-kontroll fra IfcOpenShell; i mappen under `vendor/ifctester/` med webappen `ifctester/webapp` fjernet fra wheel-filen av Dataspatium 2026-11-06), med xmlschema 4.3.2 og elementpath 5.1.4 | LGPL-3.0 (ifctester; kildekode på https://github.com/IfcOpenShell/IfcOpenShell/tree/v0.9.0/src/ifctester), MIT (xmlschema, elementpath) | ifctester er et endret LGPL-verk: endringen (bare fjerningen av webappen, RECORD omskrevet) angis her og i vendor/vendor.json, lisenstekstene følger med, og kilden er filene i wheel-filen; originalens kontrollsum står i vendor-src. Kjører som frittstående Python-pakke i en worker og kan byttes ut; appens kode lenker ikke mot den |

Dataspatiums kode lenker ikke mot R. R kjører som en separat tolk i en worker og utveksler R-kode, SQLite-filer og bilder
med appen via meldinger; det er den typen samdistribusjon («mere aggregation») som GPL tillater, og R-delene beholder alle
sine GPL-rettigheter for deg som bruker. Eksempeldata i `presets/` kommer fra åpne kilder og beholder sine opprinnelige
lisenser (CC0 eller CC BY etter den enkelte etaten). De svenske kommune- og länsgrensene i `presets/geo/` er SCBs *Digitala
gränser* under CC0 1.0, omregnet til lengde- og breddegrad. De danske grensene er DAGI 1:500 000 fra Geodatastyrelsen
(nå Klimadatastyrelsen), frie data som kan brukes og deles med kildeangivelse; de norske kommer fra Kartverkets N1000
Kartdata og de finske fra Statistikcentralen, begge under CC BY 4.0 (kildeangivelse «© Kartverket» og «Tilastokeskus /
Statistikcentralen»). Se `presets/geo/KALLA.md`. Data som hentes fra de åpne
API-ene, omfattes av den enkelte utgiverens lisens, som vises sammen med kilden i appen.

## Dataregium og Dataspatium

[Dataregium OpenCDE server](https://github.com/marwiss/Dataregium) er et eget verk under AGPL-3.0 og ingen del av Dataspatium. Samme person har opphavsretten til begge verkene og har 2026-11-05 tillatt to ting mellom dem: Dataregium gjengir Dataspatiums utseende (designvariablene i `src/ui/design/tokens.css` og komponentenes stiler er skrevet av der under AGPL, slik at de to ser ut som ett produkt), og Dataspatium får bruke kode og ressurser fra Dataregium, for eksempel testfiler, eksempeltekster og API-beskrivelser. Lisensene for hvert verk gjelder for øvrig uendret; alt annet de har felles (ordliste, README-struktur, feilkoder, kapabilitetsdokument), gjenskapes som fakta i hvert repositorium.
