# Formater og import

## Understøttede filformater

| Format | Import | Eksport | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med skilletegn | Ja | Ja | Skilletegn, tegnkodning og overskriftsrække genkendes automatisk og kan ændres |
| Tekst med fast kolonnebredde | Ja | Nej | Vælg formatet i importtrinnet (filer med navnet .fwf eller .prn genkendes). Kolonnestarterne findes ud fra mellemrum, der findes i alle rækker, eller angives som positioner |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Vælg ark; datoer og ja/nej bliver rigtige typer |
| ODS (LibreOffice) | Ja | Ja | Samme typehåndtering som Excel |
| JSON | Ja | Ja | Liste af objekter, et objekt, der indeholder en liste (sti kan angives), liste af lister |
| NDJSON, JSON Lines | Ja | Nej | Ét objekt pr. linje |
| JSON-stat | Ja | Nej | Genkendes automatisk (`class: dataset`); én række pr. celle med koder, tekster og værdi |
| GeoJSON | Ja | Ja | Én række pr. feature; egenskaberne bliver kolonner, geometrien en tekstkolonne med GeoJSON, som kortdiagrammet tegner (kortet læser også WKT-tekst i en kolonne, for eksempel fra CSV). Ved eksport bliver geometrikolonnen (GeoJSON eller WKT) hver features geometri og de øvrige kolonner dens egenskaber |
| Shapefile (ZIP med shp, dbf, prj, cpg eller kun shp) | Ja | Nej | Attributterne bliver typede kolonner efter dbf-skemaet, geometrien GeoJSON i kolonnen `geometry`. Vælg lag, hvis ZIP-filen har flere, og forenkl geometrien med en tolerance i kortenheder. Koordinaterne bevares |
| XML | Ja | Ja | Én række pr. gentaget element (vælges i importtrinnet); attributter og underelementer bliver kolonner, indlejrede elementer får punktnavne som `lage.lan` |
| SQLite | Ja | Ja | Dataspatiums egen fil gendannes med typer, etiketter og historik; i andre databaser vælger du tabel, og typerne tages fra skemaet |
| GeoPackage (gpkg) | Ja | Nej | Lagene (feature- og attributtabeller) vælges som tabeller; geometrikolonnen bliver GeoJSON, som kortdiagrammet tegner, referencesystemet vises |
| SPSS sav, zsav, por | Ja | sav | Via R-pakken haven. Variabeletiketter bliver kolonneetiketter, værdietiketter bliver tekst |
| Stata dta | Ja | dta | Via haven. Ved eksport forkortes kolonnenavnene efter Statas regler (32 tegn, ASCII) |
| SAS sas7bdat, xpt | Ja | Nej | Via haven |
| PX (PC-Axis, bruges af de nordiske statistikbureauer) | Ja | Nej | Via R-pakken pxR; tegnkodningen læses fra filens CODEPAGE eller CHARSET. Resultatet er en lang tabel med én værdikolonne |
| Parquet | Ja | Ja | Via R-pakken nanoparquet; bevarer typer nøjagtigt |
| RDS, RData | Ja | rds | R-objekter; en RData-fil skal indeholde en data.frame |
| Indsat tekst | Ja | | Tabulator-, semikolon- eller kommasepareret |

Afgrænsede tekstfiler på 64 MB eller mere læses i bidder: forhåndsvisningen viser de første rækker som normalt, og ved
importen skrives rækkerne til datasættet, mens filen læses, så hele teksten aldrig behøver at ligge i hukommelsen.
Kolonnetyperne tages fra kolonnetrinnet eller gættes ud fra den første bid. Forløbet vises som antal læste rækker.

Alle filformater kan også hentes fra en webadresse under *Fra webadresse* i Hent, hvis serveren tillader forespørgsler
fra browseren (CORS). Dataspatiums egne konfigurationsfiler (API-kilde, diagram, dashboard, dokumentskabelon, notesbog)
genkendes på feltet `format` og tilføjes direkte.

Formaterne, der går via R, starter R-sessionen ved behov (nogle sekunder første gang) og har ingen forhåndsvisning: filen
læses af R og overdrages med `dm_write()`, så kolonnetyperne kommer fra R. Ja/nej bliver til 0/1 i SPSS og Stata, der
mangler en logisk type.

Med appen følger også data, der tilføjes med en knap i Hent: eksempeldataene *Befolkning pr. kommune 2024 (Sverige)* og
SCB's svenske kommune- og länsgrænser (*Digitala gränser*, CC0) som GeoJSON i længde- og breddegrad, se
`presets/geo/KALLA.md`. Intet hentes fra nettet.

## Tegnkodning

Tekstfiler kontrolleres i denne rækkefølge: byte order mark (UTF-8, UTF-16), UTF-16 uden BOM (mange nulbytes), ren
ASCII, streng UTF-8-validering af den første megabyte, ellers Windows-1252. Windows-1252 er almindeligt for filer gemt fra
ældre nordiske Excel-versioner. Du kan altid skifte kodning i importtrinnet.

## Skilletegn og decimaltegn

Skilletegnet gættes blandt semikolon, komma, tabulator og lodret streg. Nordiske CSV-filer bruger oftest semikolon, fordi
komma er decimaltegn. Decimaltegnet afgøres pr. kolonne: er kommadecimaler mindst lige så almindelige som
punktumdecimaler, vælges komma. Tusindtalsseparatorer (mellemrum, hårdt mellemrum, punktum ved kommadecimaler) fjernes.

## Kolonnetyper

| Type | Genkendes som | Gemmes som |
|---|---|---|
| Tekst | Alt, der ikke passer til andet, og alle tal med foranstillet nul (kommunekoder, postnumre, personnumre) | TEXT |
| Heltal | `12`, `-3`, `1 234` | INTEGER |
| Decimaltal | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Dato | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `ÅÅÅÅ-MM-DD` |
| Dato og tid | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel-datoer med klokkeslæt | TEXT, `ÅÅÅÅ-MM-DD TT:MM:SS` |
| Ja/nej | `ja`, `nej`, `true`, `false`, `yes`, `no`, `sant`, `falskt`, `j`, `n` | INTEGER 0/1 |

En kolonne får kun en type, hvis alle udfyldte værdier i udsnittet passer. Tomme værdier bliver altid "tom" (NULL).
Værdier, der ikke kan fortolkes med den type, du vælger manuelt, bliver også tomme.

## Datasættets fil

Hvert datasæt er en SQLite-fil med fire tabeller: `data` (rækkerne), `_columns` (navn, type, etiket, oprindeligt navn,
beskrivelse og enhed; de to sidste tilføjes, når en ældre fil åbnes), `_meta` (navn, kortnavn, beskrivelse, tidsstempler,
kilde, importindstillinger) og `_log` (alt, hvad der er gjort med datasættet). Filen kan åbnes i R med RSQLite, i DB
Browser for SQLite og i de fleste andre værktøjer.

## Arbejdsområdets filer

Backuppen (ZIP) og den portable mappe (Edge og Chrome) har samme opbygning: `manifest.json` med en liste over indholdet,
`datasets/<id>.sqlite` pr. datasæt, `charts/<id>.viz.json` pr. gemt diagram, `documents/<id>.doc.json` pr. egen
dokumentskabelon, `dashboards/<id>.dash.json` pr. dashboard og `notebooks/<id>.nb.json` pr. notesbog. En pakke (*Del pakke*
under Håndter) har samme opbygning, men indeholder kun det, du har valgt, og har `kind: bundle` i manifestet; når den
indlæses, springes alt, der allerede findes, over (datasæt med samme id, diagrammer, dashboards, skabeloner og notesbøger
med samme navn). Med automatisk gemning slået til skrives ændrede datasæt til mappen kort efter hver gemning, og filer for
slettede datasæt fjernes. Mappen kan indlæses på en anden computer; datasæt, der allerede findes (samme id), og diagrammer
eller skabeloner med samme navn springes over.

Rækkerne i `_log` har tidsstempel, handlingstype og detaljer som JSON. Handlingstyperne er blandt andre `import`, `op` (et
trin i recepten med `op`, `params`, `result` og `description`; det er disse rækker, der udgør recepten), `undo`, `snapshot`
og `restore`. Receptens eksport i Bearbejd bygger på `op`-rækkerne, se [bearbeta.md](bearbeta.md).
