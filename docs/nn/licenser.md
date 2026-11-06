# Lisensar

Dette er ei forklaring på nynorsk. Den fullstendige lisensteksten i [LICENSE](../../LICENSE) gjeld. Teksten er ikkje juridisk
rådgjeving.

## Den eigne koden i Dataspatium

Den eigne koden, dokumentasjonen og førehandsinnstillingane i Dataspatium (alt unnateke mappa `vendor/`) er lisensierte under
**PolyForm Strict 1.0.0** (<https://polyformproject.org/licenses/strict/1.0.0>). Lisensgjevar er opphavspersonen til Dataspatium,
som kan kontaktast via GitHub-kontoen [marwiss](https://github.com/marwiss).

Dette kan du gjere:

- Laste ned og bruke appen til ikkje-kommersielle føremål: privat, til studium, forsking, utdanning og velgjerd og dessutan i
  offentlege etatar, kommunar, regionar og andre offentlege institusjonar, uansett korleis verksemda blir finansiert.
- Bruke appen på så mange datamaskiner du vil i organisasjonen din.
- Lage eigne datasett, oppskrifter, diagram, R-skript, API-konfigurasjonar og dokumentmalar med appen og dele dei som du
  vil. Dei er dine eigne verk, ikkje ein del av appen.

Dette kan du ikkje gjere utan skriftleg løyve frå lisensgjevaren:

- Bruke appen i kommersiell verksemd, til dømes i konsulentoppdrag eller som del av eit produkt eller ei teneste.
- Distribuere appen vidare, heilt eller delvis, eller publisere eigne kopiar. (Brukarvilkåra til GitHub tillèt at
  repositoriet blir forka på GitHub; det gjev ingen rettar utover det.)
- Endre koden eller byggje eigne verk på han.

Vil du bruke Dataspatium på andre vilkår, kan du opprette eit issue i repositoriet eller kontakte lisensgjevaren der.

## Tredjepartskomponentar

Alt under `vendor/` er tredjepartskode med eigne lisensar som ikkje blir påverka av lisensen til Dataspatium. Kvart bibliotek, versjonen
og lisensen finst i [THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md) saman med lisenstekstane.

| Komponent | Lisens | Kva det tyder |
|---|---|---|
| JavaScript-bibliotek (sql.js, Dexie, D3, Vega, PapaParse, SheetJS, docx, jsPDF, fflate, CodeMirror med fleire) | MIT, BSD-3-Clause, Apache-2.0, ISC | Frie å bruke og distribuere så lenge lisenstekst og merknader følgjer med |
| Skrifttypen Inter | SIL Open Font License 1.1 | Kan byggjast inn i appen; kan ikkje seljast for seg sjølv |
| Lucide-ikon (òg merket og faviconet til appen) | ISC | Som over |
| webR (JavaScript-delen) | MIT | Som over |
| R (R.wasm med fleire) | GPL-2 eller GPL-3 | Fri programvare. Blir distribuert uendra i binær form; kjeldekoden finst hos R-prosjektet og webR-prosjektet i dei oppgjevne versjonane |
| R-pakkar i `vendor/webr-repo` | Mest MIT; òg LGPL (DBI, RSQLite), MPL-2.0 (data.table), GPL (Rcpp, pxR, knitr, svglite med fleire) | Blir distribuerte uendra; kjeldekoden finst på CRAN i dei oppgjevne versjonane |
| Python (Pyodide, CPython og pakkar som numpy, pandas og matplotlib; blir henta ved behov, ikkje i mappa) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-lisensen (PSF-basert), MIT og liknande for dei andre | Blir henta uendra frå jsDelivr og lagra i nettlesaren; kjeldekoden finst hos Pyodide-prosjektet og på PyPI i dei versjonane katalogen til appen oppgjev (Pyodide 314.0.7) |
| pdf.js 3.11 (les PDF-filer) med standardskrifter | Apache-2.0 (pdf.js), BSD-3-Clause (skriftene frå Foxit), SIL Open Font License 1.1 (Liberation Sans) | Frie å bruke og spreie med lisenstekst og notisar; skriftene kan byggjast inn |
| Leaflet 1.9 (kart) og Turf 7 (geoverktøy) | BSD-2-Clause (Leaflet), MIT (Turf) | Frie å bruke og spreie med lisenstekst og notisar |
| Cytoscape 3.34 med fcose, dagre og expand-collapse, sigma 3 og graphology (grafar) | MIT | Frie å bruke og spreie med lisenstekst og notisar |
| neo4j-driver-lite 6.3 (Neo4j over Bolt) | Apache-2.0 | Fri å bruke og spreie med lisenstekst og notisar |
| web-ifc 0.0.78 (geometri frå IFC; uendra filer, kjeldekode på https://github.com/ThatOpen/engine_web-ifc) | MPL-2.0 | Fri å bruke og spreie; endringar i dei eigne filene til biblioteket blir delte under same lisens |
| three.js 0.187 (3D-teikning), dxf-parser 1.1 (DXF) | MIT | Frie å bruke og spreie med lisenstekst og notisar |
| Planbestämmelsekatalogen frå Boverket (innebygd kopi, `presets/plan/`) | Opne data frå Boverket | Fri å bruke og spreie; Boverket og Planbestämmelsekatalogen skal oppgjevast som kjelde |
| Tesseract og tesseract.js-core (les tekst i bilete; blir henta ved behov, er ikkje i mappa), språkdata frå tessdata_best | Apache-2.0 (Tesseract, tesseract.js-core, språkdata) | Blir henta uendra frå jsDelivr, låst til versjon og kontrollsum, og lagra i nettlesaren |
| plotly.js (blir henta ved behov for plotly-diagram), seaborn og plotly (Python-hjul frå PyPI, blir henta ved behov) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Blir henta uendra frå jsDelivr og PyPI, låst til versjon og kontrollsum, og lagra i nettlesaren |
| IfcOpenShell 0.9.1 (les, kontrollerer og endrar IFC-modellar i Python; blir henta ved behov som WebAssembly-wheels frå IfcOpenShell si eiga oversikt, ikkje i mappa) med OpenCASCADE-kjernen og lark og isodate | LGPL-3.0 (IfcOpenShell; kjeldekode på https://github.com/IfcOpenShell/IfcOpenShell), LGPL-2.1 med unntak (OpenCASCADE), MIT (lark), BSD-3-Clause (isodate) | Blir henta uendra, låst til versjon og kontrollsum, og lagra i nettlesaren. IfcOpenShell køyrer som ein frittståande Python-pakke i ein worker og kan bytast mot ein annan versjon; koden i appen lenkjer ikkje mot det |

Koden i Dataspatium lenkjer ikkje mot R. R køyrer som ein separat tolk i ein worker og utvekslar R-kode, SQLite-filer og bilete
med appen via meldingar; det er den typen samdistribusjon («mere aggregation») som GPL tillèt, og R-delane held på alle
GPL-rettane sine for deg som brukar. Dømedata i `presets/` kjem frå opne kjelder og held på dei opphavlege
lisensane sine (CC0 eller CC BY etter den einskilde etaten). Dei svenske kommune- og länsgrensene i `presets/geo/` er *Digitala
gränser* frå SCB under CC0 1.0, rekna om til lengde- og breiddegrad. Dei danske grensene er DAGI 1:500 000 frå Geodatastyrelsen
(no Klimadatastyrelsen), frie data som kan brukast og delast med kjeldetilvising; dei norske kjem frå N1000 Kartdata frå Kartverket
og dei finske frå Statistikcentralen, begge under CC BY 4.0 (kjeldetilvising «© Kartverket» og «Tilastokeskus /
Statistikcentralen»). Sjå `presets/geo/KALLA.md`. Data som blir henta frå dei opne
API-a, er omfatta av lisensen til den einskilde utgjevaren, som blir vist saman med kjelda i appen.

## Kontroll og Dataspatium

[Kontroll OpenCDE server](https://github.com/marwiss/Kontroll) er eit eige verk under AGPL-3.0 og ingen del av Dataspatium. Same person har opphavsretten til begge verka og har 2026-11-05 tillate to ting mellom dei: Kontroll gjev att utsjånaden til Dataspatium (designvariablane i `src/ui/design/tokens.css` og stilane til komponentane er skrivne av der under AGPL, slik at dei to ser ut som eitt produkt), og Dataspatium får bruke kode og ressursar frå Kontroll, til dømes testfiler, dømetekstar og API-skildringar. Lisensane for kvart verk gjeld elles uendra; alt anna dei har felles (ordliste, README-struktur, feilkodar, kapabilitetsdokument), blir skapt på nytt som fakta i kvart repositorium.
