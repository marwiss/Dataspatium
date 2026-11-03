# Formater og import

## Understøttede filformater

| Format | Import | Eksport | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med skilletegn | Ja | Ja | Skilletegn, tegnkodning og overskriftsrække genkendes automatisk og kan ændres |
| Tekst med fast kolonnebredde | Ja | Nej | Vælg formatet i importtrinnet (filer med navnet .fwf eller .prn genkendes). Kolonnestarterne findes ud fra mellemrum, der findes i alle rækker, eller angives som positioner |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Vælg ark; datoer og ja/nej bliver rigtige typer |
| ODS og FODS (LibreOffice) | Ja | ods | Samme typehåndtering som Excel |
| Ældre regnearksformater: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Ja | Nej | Læses af samme regnearkslæser som Excel; vælg ark. Excel 2003 XML genkendes på indholdet, også når filen hedder .xml |
| Tabeller i dokumenter: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Ja | Nej | Alle tabeller i filen vises i en liste med overskrift eller billedtekst og antal rækker og kolonner. Flettede celler (colspan og rowspan, Words flettede celler, `\multicolumn`) udfyldes i alle de rækker og kolonner, de dækker. Overskriftsrækken tages fra `th`, `thead`, Markdowns skillelinje, Words overskriftsrække eller `booktabs` (`\midrule`) |
| KML og KMZ (Google Earth) | Ja | Nej | Én række pr. sted med navn, beskrivelse, mappesti, tid og udvidede data som kolonner; punkter, linjer, polygoner og sammensatte geometrier bliver GeoJSON |
| GPX (GPS-spor) | Ja | Nej | Vælg lag: waypoints, ruter, spor (med antal punkter og længde i km) eller sporpunkter (én række pr. punkt med tid og højde) |
| TopoJSON | Ja | Nej | Hvert objekt i topologien er et lag; buerne afkodes til almindelige GeoJSON-geometrier. Genkendes på indholdet, også når filen hedder .json |
| JSON | Ja | Ja | Liste af objekter, et objekt, der indeholder en liste (sti kan angives), liste af lister |
| NDJSON, JSON Lines | Ja | Nej | Ét objekt pr. linje |
| JSON-stat | Ja | Nej | Genkendes automatisk (`class: dataset`); én række pr. celle med koder, tekster og værdi |
| SDMX-JSON | Ja | Nej | Datameddelelser i SDMX-JSON 1.0 og 2.0 (for eksempel fra ECB og OECD) genkendes automatisk; én række pr. observation med kode- og tekstkolonne pr. dimension, tidsperiode, værdi og attributter |
| GeoJSON | Ja | Ja | Én række pr. feature; egenskaberne bliver kolonner, geometrien en tekstkolonne med GeoJSON, som kortdiagrammet tegner (kortet læser også WKT-tekst i en kolonne, for eksempel fra CSV). Ved eksport bliver geometrikolonnen (GeoJSON eller WKT) hver features geometri og de øvrige kolonner dens egenskaber |
| Shapefile (ZIP med shp, dbf, prj, cpg eller kun shp) | Ja | Nej | Attributterne bliver typede kolonner efter dbf-skemaet, geometrien GeoJSON i kolonnen `geometry`. Vælg lag, hvis ZIP-filen har flere, og forenkl geometrien med en tolerance i kortenheder. Koordinaterne bevares |
| XML | Ja | Ja | Én række pr. gentaget element (vælges i importtrinnet); attributter og underelementer bliver kolonner, indlejrede elementer får punktnavne som `lage.lan` |
| SQLite | Ja | Ja | Dataspatiums egen fil gendannes med typer, etiketter og historik; i andre databaser vælger du tabel, og typerne tages fra skemaet |
| SQL-script (sql) | Ja | Nej | Et script med `CREATE TABLE` og `INSERT`, for eksempel et databasedump, køres i en tom SQLite-database, og tabellerne vises til valg. MySQL-specifikke linjer (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` og tabelvalg som `ENGINE=`) fjernes først; andre dialekter fungerer, så længe de følger SQLites syntaks |
| GeoPackage (gpkg) | Ja | Nej | Lagene (feature- og attributtabeller) vælges som tabeller; geometrikolonnen bliver GeoJSON, som kortdiagrammet tegner, referencesystemet vises |
| SPSS sav, zsav, por | Ja | sav | Via R-pakken haven. Variabeletiketter bliver kolonneetiketter og værdietiketter kolonnemetadata (se nedenfor) |
| Stata dta | Ja | dta | Via haven. Værdietiketter som for SPSS. Ved eksport forkortes kolonnenavnene efter Statas regler (32 tegn, ASCII) |
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

Værdietiketter (koder med navne, som `1 = Mand` og `2 = Kvinde`) følger kolonnen som metadata i SQLite-filen
(`_columns.value_labels`). Ved import af SPSS, Stata og SAS vælger du i indstillingstrinnet, om kolonnen skal vise
etiketterne som tekst (standard) eller beholde koderne; etiketterne gemmes i begge tilfælde. De kan sættes, ændres og
skiftes ud med koderne i Bearbejd, vises i kodebogen, når R som `haven::labelled` og skrives til .sav og .dta, hvor en
kolonne med etiketterne som tekst får sine koder tilbage.

Med appen følger også data, der tilføjes i Hent: eksempeldataene *Befolkning pr. kommune 2024 (Sverige)* og grænser til
kort som GeoJSON i længde- og breddegrad: kommuner og län i Sverige (SCB, CC0), kommuner og regioner i Danmark (DAGI),
kommuner og fylker i Norge (Kartverket, CC BY 4.0) samt kommuner og landskaber i Finland (Statistikcentralen,
CC BY 4.0). Kilder og licenser står i `presets/geo/KALLA.md`. Intet hentes fra nettet.

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

Hvert datasæt er en SQLite-fil med tabellerne `data` (rækkerne), `_columns` (navn, type, etiket, oprindeligt navn,
beskrivelse, enhed og værdietiketter; de tre sidste tilføjes, når en ældre fil åbnes), `_meta` (navn, kortnavn,
beskrivelse, tidsstempler, kilde, importindstillinger), `_log` (alt, hvad der er gjort med datasættet) og, når nogen har
kommenteret, `_comments` (tid, navn, tekst, kolonne og om kommentaren er løst). Filen kan åbnes i R med RSQLite, i DB
Browser for SQLite og i de fleste andre værktøjer.

## Arbejdsområdets filer

Backuppen (ZIP), den portable mappe (Edge og Chrome) og mappen i et GitHub-repository har samme opbygning:
`manifest.json` med en liste over indholdet, `datasets/<id>.sqlite` pr. datasæt, `charts/<id>.viz.json` pr. gemt
diagram, `documents/<id>.doc.json` pr. egen dokumentskabelon, `dashboards/<id>.dash.json` pr. dashboard,
`notebooks/<id>.nb.json` pr. notesbog og `scripts/<id>.script.json` pr. gemt R-script, SQL-script eller regex-mønster. En
pakke (*Del pakke* under Håndter) har samme opbygning, men indeholder kun det, du har valgt. Dens manifest har
`kind: bundle`, afsenderens navn (`author`), beskeden (`message`) og ændringerne i hvert datasæt, siden det sidst blev
delt eller modtaget (`changes`), og pakken har desuden `CHANGELOG.md` med det samme og de uløste kommentarer i læsbar
form. Når en pakke indlæses, vises beskeden og ændringerne, og alt, der allerede findes, springes over (datasæt med samme
id, diagrammer, dashboards, skabeloner og notesbøger med samme navn), undtagen de datasæt, du vælger at erstatte med
pakkens version; din version gemmes så under *Versioner*. Med automatisk gemning slået til skrives ændrede datasæt til den
portable mappe kort efter hver gemning, og filer for slettede datasæt fjernes. Mappen kan indlæses på en anden computer
på samme måde som en pakke.

Rækkerne i `_log` har tidsstempel, handlingstype og detaljer som JSON. Handlingstyperne er blandt andre `import`, `op` (et
trin i recepten med `op`, `params`, `result` og `description`; det er disse rækker, der udgør recepten), `undo`,
`snapshot`, `restore`, `comment` (en ny kommentar), `shared` og `received` (når datasættet blev delt eller modtaget i en
pakke eller fra GitHub; ændringsloggen i den næste pakke begynder efter den seneste af dem). Håndter viser rækkerne som
læsbar tekst. Receptens eksport i Bearbejd bygger på `op`-rækkerne, se [bearbeta.md](bearbeta.md).
