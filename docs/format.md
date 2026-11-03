# Format och import

## Filformat som stöds

| Format | Import | Export | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med avgränsare | Ja | Ja | Avgränsare, teckenkodning och rubrikrad identifieras automatiskt och kan ändras |
| Text med fasta kolumnbredder | Ja | Nej | Välj formatet i importsteget (filer som heter .fwf eller .prn känns igen). Kolumnstarterna hittas ur mellanslag som finns på alla rader, eller anges som positioner |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Välj blad; datum och ja/nej blir riktiga typer |
| ODS (LibreOffice) | Ja | Ja | Samma typhantering som Excel |
| JSON | Ja | Ja | Lista med objekt, objekt som innehåller en lista (sökväg kan anges), lista med listor |
| NDJSON, JSON Lines | Ja | Nej | Ett objekt per rad |
| JSON-stat | Ja | Nej | Känns igen automatiskt (`class: dataset`, version 2.0); en rad per cell med koder, texter och värde |
| GeoJSON | Ja | Ja | En rad per feature; egenskaperna blir kolumner, geometrin en textkolumn med GeoJSON som kartdiagrammet ritar (kartan läser även WKT-text i en kolumn, till exempel från CSV). Vid export blir geometrikolumnen (GeoJSON eller WKT) varje features geometri och övriga kolumner dess egenskaper |
| Shapefile (ZIP med shp, dbf, prj, cpg, eller bara shp) | Ja | Nej | Attributen blir typade kolumner enligt dbf-schemat, geometrin GeoJSON i kolumnen `geometry`. Välj lager om ZIP-filen har flera, och förenkla geometrin med en tolerans i kartenheter. Koordinaterna behålls (SWEREF99 TM eller longitud/latitud) |
| XML | Ja | Ja | En rad per upprepat element (väljs i importsteget); attribut och underelement blir kolumner, nästlade element får punktnamn som `lage.lan` |
| SQLite | Ja | Ja | Dataspatiums egen fil återställs med typer, etiketter och historik; i andra databaser väljer du tabell och typerna tas från schemat |
| GeoPackage (gpkg) | Ja | Nej | Lagren (feature- och attributtabeller) väljs som tabeller; geometrikolumnen blir GeoJSON som kartdiagrammet ritar, referenssystemet visas |
| SPSS sav, zsav, por | Ja | sav | Via R-paketet haven. Variabeletiketter blir kolumnetiketter, värdeetiketter blir text |
| Stata dta | Ja | dta | Via haven. Vid export kortas kolumnnamnen till Statas regler (32 tecken, ASCII) |
| SAS sas7bdat, xpt | Ja | Nej | Via haven |
| PX (PC-Axis, SCB) | Ja | Nej | Via R-paketet pxR; teckenkodningen läses ur filens CODEPAGE eller CHARSET. Resultatet är en lång tabell med en värdekolumn |
| Parquet | Ja | Ja | Via R-paketet nanoparquet; behåller typer exakt |
| RDS, RData | Ja | rds | R-objekt; en RData-fil måste innehålla en data.frame |
| Inklistrad text | Ja | | Tabb-, semikolon- eller kommaavgränsad |

Textfiler med avgränsare som är 64 MB eller större läses in i omgångar: förhandsgranskningen visar de första
raderna som vanligt, och vid importen skrivs raderna till datamängden medan filen läses, så att hela texten
aldrig behöver ligga i minnet. Kolumntyperna tas från kolumnsteget eller gissas ur den första omgången.
Förloppet visas i raderna som lästs in.

Alla filformat kan också hämtas från en webbadress under *Från webbadress* i Inhämta, om servern tillåter
anrop från webbläsaren (CORS). Dataspatiums egna konfigurationsfiler (API-källa, diagram, dashboard, dokumentmall,
anteckningsbok) känns igen på fältet `format` och läggs till direkt.

Formaten som går via R startar R-sessionen vid behov (några sekunder första gången) och saknar
förhandsgranskning: filen läses av R och lämnas över med `dm_write()`, så kolumntyperna kommer från R. Ja/nej
blir 0/1 i SPSS och Stata, som saknar logisk typ.

Med appen följer också data som läggs till med en knapp i Inhämta: exempeldatan *Befolkning per kommun 2024*
samt SCB:s kommun- och länsgränser (*Digitala gränser*, CC0) som GeoJSON i longitud och latitud, se
`presets/geo/KALLA.md`. Ingenting hämtas från nätet.

## Teckenkodning

Textfiler kontrolleras i denna ordning: byte order mark (UTF-8, UTF-16), UTF-16 utan BOM (många nollbytes),
ren ASCII, strikt UTF-8-validering av det första megabytet, annars Windows-1252. Windows-1252 är det vanliga för
filer som sparats från äldre svenska Excel-versioner. Du kan alltid byta kodning i importsteget.

## Avgränsare och decimaltecken

Avgränsaren gissas bland semikolon, komma, tabb och lodstreck. Svenska CSV-filer använder oftast semikolon
eftersom komma är decimaltecken. Decimaltecknet avgörs per kolumn: om kommadecimaler är minst lika vanliga som
punktdecimaler väljs komma. Tusentalsavgränsare (mellanslag, hårt mellanslag, punkt vid kommadecimal) tas bort.

## Kolumntyper

| Typ | Känns igen som | Lagras som |
|---|---|---|
| Text | Allt som inte passar något annat, och alla tal med inledande nolla (kommunkoder, postnummer, personnummer) | TEXT |
| Heltal | `12`, `-3`, `1 234` | INTEGER |
| Decimaltal | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Datum | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `ÅÅÅÅ-MM-DD` |
| Datum och tid | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel-datum med klockslag | TEXT, `ÅÅÅÅ-MM-DD HH:MM:SS` |
| Ja/nej | `ja`, `nej`, `true`, `false`, `sant`, `falskt`, `j`, `n` | INTEGER 0/1 |

En kolumn får en typ bara om alla ifyllda värden i urvalet passar. Tomma värden blir alltid "tom" (NULL).
Värden som inte går att tolka med den typ du väljer manuellt blir också tomma.

## Datamängdens fil

Varje datamängd är en SQLite-fil med fyra tabeller: `data` (raderna), `_columns` (namn, typ, etikett,
ursprungsnamn), `_meta` (namn, beskrivning, tidsstämplar, källa, importinställningar) och `_log` (allt som gjorts
med datamängden). Filen går att öppna i R med RSQLite, i DB Browser for SQLite och i de flesta andra verktyg.

## Arbetsytans filer

Säkerhetskopian (ZIP) och den portabla mappen (Edge och Chrome) har samma uppbyggnad: `manifest.json` med en
lista över innehållet, `datasets/<id>.sqlite` per datamängd, `charts/<id>.viz.json` per sparat diagram,
`documents/<id>.doc.json` per egen dokumentmall, `dashboards/<id>.dash.json` per dashboard och
`notebooks/<id>.nb.json` per anteckningsbok. Ett delningspaket (*Dela paket* under Hantera) har samma uppbyggnad
men innehåller bara det du valt och har `kind: bundle` i manifestet; när det läses in hoppas allt som redan finns
över (datamängder med samma id, diagram, dashboards, mallar och anteckningsböcker med samma namn). Med automatisk sparning på skrivs ändrade datamängder till mappen
strax efter varje sparning och filer för borttagna datamängder tas bort. Mappen kan läsas in på en annan dator;
datamängder som redan finns (samma id) och diagram eller mallar med samma namn hoppas över.

Raderna i `_log` har tidsstämpel, åtgärdstyp och detaljer som JSON. Åtgärdstyperna är bland andra `import`, `op`
(ett receptsteg med `op`, `params`, `result` och `description`; det är dessa rader som utgör receptet), `undo`,
`snapshot` och `restore`. Receptexporten i Bearbeta bygger på `op`-raderna, se [bearbeta.md](bearbeta.md).
