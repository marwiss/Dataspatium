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
| Python (Pyodide, CPython og pakker som numpy, pandas og matplotlib; hentes efter behov, ikke i mappen) | MPL-2.0 (Pyodide, micropip), PSF-2.0 (CPython), BSD-3-Clause (numpy, pandas), matplotlib-licensen (PSF-baseret), MIT og lignende for de øvrige | Hentes uændrede fra jsDelivr og gemmes i browseren; kildekoden findes hos Pyodide-projektet og på PyPI i de versioner, appens katalog angiver (Pyodide 314.0.7) |
| pdf.js 3.11 (læser PDF-filer) med standardskrifttyper | Apache-2.0 (pdf.js), BSD-3-Clause (Foxits skrifttyper), SIL Open Font License 1.1 (Liberation Sans) | Frie at bruge og udbrede med licenstekst og notitser; skrifttyperne må indlejres |
| plotly.js (hentes efter behov til plotly-diagrammer), seaborn og plotly (Python-hjul fra PyPI, hentes efter behov) | MIT (plotly.js, plotly), BSD-3-Clause (seaborn) | Hentes uændrede fra jsDelivr og PyPI, låst til version og kontrolsum, og gemmes i browseren |

Dataspatiums kode linker ikke mod R. R kører som en separat fortolker i en worker og udveksler R-kode, SQLite-filer og
billeder med appen via meddelelser; det er den slags samdistribution ("mere aggregation"), som GPL tillader, og R-delene
beholder alle deres GPL-rettigheder for dig som bruger. Eksempeldata i `presets/` kommer fra åbne kilder og beholder deres
oprindelige licenser (CC0 eller CC BY efter den enkelte myndighed). De svenske kommune- og länsgrænser i `presets/geo/` er
SCB's *Digitala gränser* under CC0 1.0, omregnet til længde- og breddegrad. De danske grænser er DAGI 1:500 000 fra
Geodatastyrelsen (nu Klimadatastyrelsen), frie data, der må bruges og deles med kildeangivelse; de norske kommer fra
Kartverkets N1000 Kartdata og de finske fra Statistikcentralen, begge under CC BY 4.0 (kildeangivelse "© Kartverket"
og "Tilastokeskus / Statistikcentralen"). Se `presets/geo/KALLA.md`. Data, der hentes fra
de åbne API'er, er omfattet af den enkelte udgivers licens, som vises sammen med kilden i appen.
