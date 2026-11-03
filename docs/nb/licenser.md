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

Dataspatiums kode lenker ikke mot R. R kjører som en separat tolk i en worker og utveksler R-kode, SQLite-filer og bilder
med appen via meldinger; det er den typen samdistribusjon («mere aggregation») som GPL tillater, og R-delene beholder alle
sine GPL-rettigheter for deg som bruker. Eksempeldata i `presets/` kommer fra åpne kilder og beholder sine opprinnelige
lisenser (CC0 eller CC BY etter den enkelte etaten). De svenske kommune- og länsgrensene i `presets/geo/` er SCBs *Digitala
gränser* under CC0 1.0, omregnet til lengde- og breddegrad; se `presets/geo/KALLA.md`. Data som hentes fra de åpne
API-ene, omfattes av den enkelte utgiverens lisens, som vises sammen med kilden i appen.
