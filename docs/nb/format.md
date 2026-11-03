# Formater og import

## Støttede filformater

| Format | Import | Eksport | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med skilletegn | Ja | Ja | Skilletegn, tegnkoding og overskriftsrad gjenkjennes automatisk og kan endres |
| Tekst med fast kolonnebredde | Ja | Nei | Velg formatet i importtrinnet (filer med navnet .fwf eller .prn gjenkjennes). Kolonnestartene finnes ut fra mellomrom som finnes på alle rader, eller angis som posisjoner |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Velg ark; datoer og ja/nei blir ekte typer |
| ODS og FODS (LibreOffice) | Ja | ods | Samme typehåndtering som Excel |
| Eldre regnearkformater: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Ja | Nei | Leses av samme regnearkleser som Excel; velg ark. Excel 2003 XML gjenkjennes på innholdet, også når filen heter .xml |
| Tabeller i dokumenter: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Ja | Nei | Alle tabeller i filen vises i en liste med overskrift eller bildetekst og antall rader og kolonner. Sammenslåtte celler (colspan og rowspan, Words sammenslåtte celler, `\multicolumn`) fylles ut i alle radene og kolonnene de dekker. Overskriftsraden hentes fra `th`, `thead`, Markdowns skillelinje, Words overskriftsrad eller `booktabs` (`\midrule`) |
| KML og KMZ (Google Earth) | Ja | Nei | Én rad per sted med navn, beskrivelse, mappesti, tid og utvidede data som kolonner; punkter, linjer, polygoner og sammensatte geometrier blir GeoJSON |
| GPX (GPS-spor) | Ja | Nei | Velg lag: veipunkter, ruter, spor (med antall punkter og lengde i km) eller sporpunkter (én rad per punkt med tid og høyde) |
| TopoJSON | Ja | Nei | Hvert objekt i topologien er et lag; buene dekodes til vanlige GeoJSON-geometrier. Gjenkjennes på innholdet, også når filen heter .json |
| JSON | Ja | Ja | Liste med objekter, et objekt som inneholder en liste (sti kan angis), liste med lister |
| NDJSON, JSON Lines | Ja | Nei | Ett objekt per linje |
| JSON-stat | Ja | Nei | Gjenkjennes automatisk (`class: dataset`); én rad per celle med koder, tekster og verdi |
| GeoJSON | Ja | Ja | Én rad per feature; egenskapene blir kolonner, geometrien en tekstkolonne med GeoJSON som kartdiagrammet tegner (kartet leser også WKT-tekst i en kolonne, for eksempel fra CSV). Ved eksport blir geometrikolonnen (GeoJSON eller WKT) hver features geometri og de øvrige kolonnene egenskapene |
| Shapefile (ZIP med shp, dbf, prj, cpg eller bare shp) | Ja | Nei | Attributtene blir typede kolonner etter dbf-skjemaet, geometrien GeoJSON i kolonnen `geometry`. Velg lag hvis ZIP-filen har flere, og forenkle geometrien med en toleranse i kartenheter. Koordinatene beholdes |
| XML | Ja | Ja | Én rad per gjentatt element (velges i importtrinnet); attributter og underelementer blir kolonner, nestede elementer får punktnavn som `lage.lan` |
| SQLite | Ja | Ja | Dataspatiums egen fil gjenopprettes med typer, etiketter og historikk; i andre databaser velger du tabell, og typene hentes fra skjemaet |
| SQL-skript (sql) | Ja | Nei | Et skript med `CREATE TABLE` og `INSERT`, for eksempel en databasedump, kjøres i en tom SQLite-database, og tabellene vises for valg. MySQL-spesifikke linjer (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` og tabellvalg som `ENGINE=`) fjernes først; andre dialekter fungerer så langt de følger SQLites syntaks |
| GeoPackage (gpkg) | Ja | Nei | Lagene (feature- og attributtabeller) velges som tabeller; geometrikolonnen blir GeoJSON som kartdiagrammet tegner, referansesystemet vises |
| SPSS sav, zsav, por | Ja | sav | Via R-pakken haven. Variabeletiketter blir kolonneetiketter, verdietiketter blir tekst |
| Stata dta | Ja | dta | Via haven. Ved eksport forkortes kolonnenavnene etter Statas regler (32 tegn, ASCII) |
| SAS sas7bdat, xpt | Ja | Nei | Via haven |
| PX (PC-Axis, brukes av de nordiske statistikkbyråene) | Ja | Nei | Via R-pakken pxR; tegnkodingen leses fra filens CODEPAGE eller CHARSET. Resultatet er en lang tabell med én verdikolonne |
| Parquet | Ja | Ja | Via R-pakken nanoparquet; beholder typer nøyaktig |
| RDS, RData | Ja | rds | R-objekter; en RData-fil må inneholde en data.frame |
| Innlimt tekst | Ja | | Tabulator-, semikolon- eller kommaseparert |

Avgrensede tekstfiler på 64 MB eller mer leses i biter: forhåndsvisningen viser de første radene som vanlig, og ved
importen skrives radene til datasettet mens filen leses, slik at hele teksten aldri trenger å ligge i minnet. Kolonnetypene
hentes fra kolonnetrinnet eller gjettes ut fra den første biten. Framdriften vises som antall leste rader.

Alle filformater kan også hentes fra en nettadresse under *Fra nettadresse* i Hent, hvis serveren tillater forespørsler fra
nettleseren (CORS). Dataspatiums egne konfigurasjonsfiler (API-kilde, diagram, dashbord, dokumentmal, notatbok) gjenkjennes
på feltet `format` og legges til direkte.

Formatene som går via R, starter R-sesjonen ved behov (noen sekunder første gang) og har ingen forhåndsvisning: filen leses
av R og overleveres med `dm_write()`, så kolonnetypene kommer fra R. Ja/nei blir 0/1 i SPSS og Stata, som mangler en logisk
type.

Med appen følger også data som legges til med en knapp i Hent: eksempeldataene *Befolkning per kommune 2024 (Sverige)* og
SCBs svenske kommune- og länsgrenser (*Digitala gränser*, CC0) som GeoJSON i lengde- og breddegrad, se `presets/geo/KALLA.md`.
Ingenting hentes fra nettet.

## Tegnkoding

Tekstfiler kontrolleres i denne rekkefølgen: byte order mark (UTF-8, UTF-16), UTF-16 uten BOM (mange nullbyte), ren ASCII,
streng UTF-8-validering av den første megabyten, ellers Windows-1252. Windows-1252 er vanlig for filer lagret fra eldre
nordiske Excel-versjoner. Du kan alltid bytte koding i importtrinnet.

## Skilletegn og desimaltegn

Skilletegnet gjettes blant semikolon, komma, tabulator og loddrett strek. Nordiske CSV-filer bruker oftest semikolon fordi
komma er desimaltegn. Desimaltegnet avgjøres per kolonne: er kommadesimaler minst like vanlige som punktumdesimaler, velges
komma. Tusenskilletegn (mellomrom, hardt mellomrom, punktum ved kommadesimaler) fjernes.

## Kolonnetyper

| Type | Gjenkjennes som | Lagres som |
|---|---|---|
| Tekst | Alt som ikke passer noe annet, og alle tall med innledende null (kommunenumre, postnumre, personnumre) | TEXT |
| Heltall | `12`, `-3`, `1 234` | INTEGER |
| Desimaltall | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Dato | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `ÅÅÅÅ-MM-DD` |
| Dato og tid | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel-datoer med klokkeslett | TEXT, `ÅÅÅÅ-MM-DD TT:MM:SS` |
| Ja/nei | `ja`, `nej`, `true`, `false`, `yes`, `no`, `sant`, `falskt`, `j`, `n` | INTEGER 0/1 |

En kolonne får bare en type hvis alle utfylte verdier i utvalget passer. Tomme verdier blir alltid «tom» (NULL). Verdier som
ikke kan tolkes med typen du velger manuelt, blir også tomme.

## Datasettets fil

Hvert datasett er en SQLite-fil med fire tabeller: `data` (radene), `_columns` (navn, type, etikett, opprinnelig navn,
beskrivelse og enhet; de to siste legges til når en eldre fil åpnes), `_meta` (navn, kortnavn, beskrivelse, tidsstempler,
kilde, importinnstillinger) og `_log` (alt som er gjort med datasettet). Filen kan åpnes i R med RSQLite, i DB Browser for
SQLite og i de fleste andre verktøy.

## Arbeidsområdets filer

Sikkerhetskopien (ZIP) og den portable mappen (Edge og Chrome) har samme oppbygning: `manifest.json` med en liste over
innholdet, `datasets/<id>.sqlite` per datasett, `charts/<id>.viz.json` per lagret diagram, `documents/<id>.doc.json` per egen
dokumentmal, `dashboards/<id>.dash.json` per dashbord og `notebooks/<id>.nb.json` per notatbok og `scripts/<id>.script.json` per lagret R-skript, SQL-skript eller regex-mønster. En pakke (*Del pakke* under
Håndter) har samme oppbygning, men inneholder bare det du har valgt, og har `kind: bundle` i manifestet; når den lastes inn,
hoppes alt som allerede finnes over (datasett med samme id, diagrammer, dashbord, maler og notatbøker med samme navn). Med
automatisk lagring slått på skrives endrede datasett til mappen kort etter hver lagring, og filer for slettede datasett
fjernes. Mappen kan lastes inn på en annen datamaskin; datasett som allerede finnes (samme id), og diagrammer eller maler
med samme navn hoppes over.

Radene i `_log` har tidsstempel, handlingstype og detaljer som JSON. Handlingstypene er blant andre `import`, `op` (et trinn
i oppskriften med `op`, `params`, `result` og `description`; det er disse radene som utgjør oppskriften), `undo`, `snapshot`
og `restore`. Oppskriftens eksport i Bearbeid bygger på `op`-radene, se [bearbeta.md](bearbeta.md).
