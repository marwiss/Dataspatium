# Licenser

Dette er en forklaring på dansk. Den fulde licenstekst i [LICENSE](../../LICENSE) gælder. Teksten er ikke juridisk
rådgivning.

## Dataspatiums egen kode

Dataspatiums egen kode, dokumentation og forudindstillinger (alt undtagen mappen `vendor/`) er licenseret under
**PolyForm Strict 1.0.0** (<https://polyformproject.org/licenses/strict/1.0.0>). Licensgiver er Dataspatiums
ophavsperson, der kan kontaktes via GitHub-kontoen [marwiss](https://github.com/marwiss).

Det må du:

- Downloade og bruge appen til ikke-kommercielle formål: privat, til studier, forskning, uddannelse og velgørenhed samt i
  myndigheder, kommuner, regioner og andre offentlige institutioner, uanset hvordan virksomheden finansieres.
- Bruge appen på så mange computere, du vil, i din organisation.
- Oprette egne datasæt, recepter, diagrammer, R-scripts, API-konfigurationer og dokumentskabeloner med appen og dele dem,
  som du vil. De er dine egne værker, ikke en del af appen.

Det må du ikke uden skriftlig tilladelse fra licensgiveren:

- Bruge appen i kommerciel virksomhed, for eksempel i konsulentopgaver eller som del af et produkt eller en tjeneste.
- Videredistribuere appen, helt eller delvist, eller offentliggøre egne kopier. (GitHubs brugsvilkår tillader, at
  repositoriet forkes på GitHub; det giver ingen rettigheder ud over det.)
- Ændre koden eller bygge egne værker på den.

Vil du bruge Dataspatium på andre vilkår, så opret et issue i repositoriet, eller kontakt licensgiveren der.

## Tredjepartskomponenter

Alt under `vendor/` er tredjepartskode med egne licenser, der ikke påvirkes af Dataspatiums licens. Hvert bibliotek, dets
version og licens findes i [THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md) sammen med licensteksterne.

| Komponent | Licens | Hvad det betyder |
|---|---|---|
| JavaScript-biblioteker (sql.js, Dexie, D3, Vega, PapaParse, SheetJS, docx, jsPDF, fflate, CodeMirror med flere) | MIT, BSD-3-Clause, Apache-2.0, ISC | Frie at bruge og distribuere, så længe licenstekst og meddelelser følger med |
| Skrifttypen Inter | SIL Open Font License 1.1 | Må indlejres i appen; må ikke sælges for sig selv |
| Lucide-ikoner (også appens mærke og favicon) | ISC | Som ovenfor |
| webR (JavaScript-delen) | MIT | Som ovenfor |
| R (R.wasm med flere) | GPL-2 eller GPL-3 | Fri software. Distribueres uændret i binær form; kildekoden findes hos R-projektet og webR-projektet i de angivne versioner |
| R-pakker i `vendor/webr-repo` | Mest MIT; også LGPL (DBI, RSQLite), MPL-2.0 (data.table), GPL (Rcpp, pxR, knitr, svglite med flere) | Distribueres uændret; kildekoden findes på CRAN i de angivne versioner |
| Python (Pyodide, CPython og pakker som numpy, pandas og matplotlib; hentes efter behov, ikke i mappen) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-licensen (PSF-baseret), MIT og lignende for de øvrige | Hentes uændrede fra jsDelivr og gemmes i browseren; kildekoden findes hos Pyodide-projektet og på PyPI i de versioner, appens katalog angiver (Pyodide 0.29.5) |
| pdf.js 3.11 (læser PDF-filer) med standardskrifttyper | Apache-2.0 (pdf.js), BSD-3-Clause (Foxits skrifttyper), SIL Open Font License 1.1 (Liberation Sans) | Frie at bruge og udbrede med licenstekst og notitser; skrifttyperne må indlejres |
| Leaflet 1.9 (kort) og Turf 7 (geoværktøjer) | BSD-2-Clause (Leaflet), MIT (Turf) | Frie at bruge og udbrede med licenstekst og notitser |
| proj4js 2.22 og Proj4Leaflet 1.0 (plankortet i planens eget koordinatsystem) | MIT (proj4js), BSD-2-Clause (Proj4Leaflet) | Frie at bruge og udbrede med licenstekst og notitser |
| Cytoscape 3.34 med fcose, dagre og expand-collapse, sigma 3 og graphology (grafer) | MIT | Frie at bruge og udbrede med licenstekst og notitser |
| neo4j-driver-lite 6.3 (Neo4j over Bolt) | Apache-2.0 | Fri at bruge og udbrede med licenstekst og notitser |
| web-ifc 0.0.78 (geometri fra IFC; uændrede filer, kildekode på https://github.com/ThatOpen/engine_web-ifc) | MPL-2.0 | Fri at bruge og udbrede; ændringer i bibliotekets egne filer deles under samme licens |
| buildingSMART's skemaer for BCF-XML 3.0 og 2.1 (XSD; kun i testene under `tests/fixtures/bcf-schemas/`, ikke i mappen) | CC BY-ND 4.0, © buildingSMART International Ltd. | Kopieret uændret med kilde og licens og bruges kun til at teste appens BCF-filer; appen selv bruger dem ikke. Ændrede skemaer må ikke udbredes |
| three.js 0.187 (3D-tegning), dxf-parser 1.1 (DXF) | MIT | Frie at bruge og udbrede med licenstekst og notitser |
| Boverkets Planbestämmelsekatalog (indbygget kopi, `presets/plan/`) | Åbne data fra Boverket | Fri at bruge og udbrede; Boverket og Planbestämmelsekatalogen skal angives som kilde |
| Boverkets klimadatabase (hentes efter behov fra api.boverket.se, ikke i mappen) | Åbne data efter Boverkets brugsvilkår (dnr 5913/2024, bygger på Svensk API-licens) | Fri at bruge; Boverket og klimadatabasen skal angives som kilde, varemærket kun i kildehenvisningen, og data bruges på egen risiko |
| Tesseract og tesseract.js-core (læser tekst i billeder; hentes efter behov, er ikke i mappen), sprogdata fra tessdata_best | Apache-2.0 (Tesseract, tesseract.js-core, sprogdata) | Hentes uændret fra jsDelivr, låst til version og kontrolsum, og gemmes i browseren |
| plotly.js (hentes efter behov til plotly-diagrammer), seaborn og plotly (Python-hjul fra PyPI, hentes efter behov) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Hentes uændrede fra jsDelivr og PyPI, låst til version og kontrolsum, og gemmes i browseren |
| IfcOpenShell 0.9.1 (læser, kontrollerer og ændrer IFC-modeller i Python; hentes efter behov som WebAssembly-wheels fra IfcOpenShells egen fortegnelse, ikke i mappen) med OpenCASCADE-kernen samt lark og isodate | LGPL-3.0 (IfcOpenShell; kildekode på https://github.com/IfcOpenShell/IfcOpenShell), LGPL-2.1 med undtagelse (OpenCASCADE), MIT (lark), BSD-3-Clause (isodate) | Hentes uændrede, låst til version og kontrolsum, og gemmes i browseren. IfcOpenShell kører som en selvstændig Python-pakke i en worker og kan udskiftes med en anden version; appens kode linker ikke mod det |
| ifctester 0.9.0 (IDS-kontrol fra IfcOpenShell; i mappen under `vendor/ifctester/` med webappen `ifctester/webapp` fjernet fra wheel-filen af Dataspatium 2026-11-06), med xmlschema 4.3.2 og elementpath 5.1.4 | LGPL-3.0 (ifctester; kildekode på https://github.com/IfcOpenShell/IfcOpenShell/tree/v0.9.0/src/ifctester), MIT (xmlschema, elementpath) | ifctester er et ændret LGPL-værk: ændringen (kun fjernelsen af webappen, RECORD omskrevet) angives her og i vendor/vendor.json, licensteksterne følger med, og kilden er filerne i wheel-filen; originalens kontrolsum står i vendor-src. Kører som selvstændig Python-pakke i en worker og kan udskiftes; appens kode linker ikke mod den |
| buildingSMART's regler, ifc-gherkin-rules (et udvalg overført til appens Python i `python/dataspatium.py`) | MIT, Copyright (c) buildingSMART International Ltd | Frie at bruge og ændre; ophavsretsnotitsen og licensteksten står ved koden i filen |

Kortet Grundoplysninger bygger på reglerne i BIM Alliances vejledning Praxi, gengivet med egne ord; ingen tekster, værdilister eller skabeloner fra Praxi indgår i appen. Appens IDS-filer i `presets/ids/` er skrevet af Dataspatium og er omfattet af appens licens.

Dataspatiums kode linker ikke mod R. R kører som en separat fortolker i en worker og udveksler R-kode, SQLite-filer og
billeder med appen via meddelelser; det er den slags samdistribution ("mere aggregation"), som GPL tillader, og R-delene
beholder alle deres GPL-rettigheder for dig som bruger. Eksempeldata i `presets/` kommer fra åbne kilder og beholder deres
oprindelige licenser (CC0 eller CC BY efter den enkelte myndighed). De svenske kommune- og länsgrænser i `presets/geo/` er
SCB's *Digitala gränser* under CC0 1.0, omregnet til længde- og breddegrad. De danske grænser er DAGI 1:500 000 fra
Geodatastyrelsen (nu Klimadatastyrelsen), frie data, der må bruges og deles med kildeangivelse; de norske kommer fra
Kartverkets N1000 Kartdata og de finske fra Statistikcentralen, begge under CC BY 4.0 (kildeangivelse "© Kartverket"
og "Tilastokeskus / Statistikcentralen"). Se `presets/geo/KALLA.md`. Data, der hentes fra
de åbne API'er, er omfattet af den enkelte udgivers licens, som vises sammen med kilden i appen.

Ortofotoene i valget af baggrundskort følger ikke med appen: din browser henter billederne fra udgivernes tjenester, når du vælger
dem, efter samtykke. Alle tre er CC BY 4.0: GeoDanmark ortofoto forår fra Klimadatastyrelsen (kildeangivelse "GeoDanmark ortofoto
forår © Klimadatastyrelsen"), Ortokuva fra Maanmittauslaitos ("Ortokuva © Maanmittauslaitos") og Grunnkort – Loftmynd fra
Náttúrufræðistofnun ("Grunnkort – Loftmynd © Náttúrufræðistofnun"). Kildeangivelsen og licensen vises i kortets hjørne og skal følge
med et billede af kortet, som du bruger videre. Forindstillingerne står i `presets/geodata/orthophotos.json`; se
[kartor.md](kartor.md#ortofotos).

## Dataregium og Dataspatium

[Dataregium OpenCDE server](https://github.com/marwiss/Dataregium) er et selvstændigt værk under AGPL-3.0 og ingen del af Dataspatium. Samme person ejer ophavsretten til begge værker og har den 2026-11-05 tilladt to ting mellem dem: Dataregium gengiver Dataspatiums udseende (designvariablerne i `src/ui/design/tokens.css` og komponenternes stilarter er skrevet af der under AGPL, så de to ser ud som ét produkt), og Dataspatium må bruge kode og ressourcer fra Dataregium, for eksempel testfiler, eksempeltekster og API-beskrivelser. Licenserne for hvert værk gælder i øvrigt uændret; alt andet, de har fælles (ordliste, README-struktur, fejlkoder, kapabilitetsdokument), genskabes som fakta i hvert repositorium.
