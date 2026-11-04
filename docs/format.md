# Format och import

## Filformat som stöds

| Format | Import | Export | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med avgränsare | Ja | Ja | Avgränsare, teckenkodning och rubrikrad identifieras automatiskt och kan ändras |
| Text med fasta kolumnbredder | Ja | Nej | Välj formatet i importsteget (filer som heter .fwf eller .prn känns igen). Kolumnstarterna hittas ur mellanslag som finns på alla rader, eller anges som positioner |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Välj blad; datum och ja/nej blir riktiga typer |
| ODS och FODS (LibreOffice) | Ja | ods | Samma typhantering som Excel |
| Äldre kalkylformat: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Ja | Nej | Läses av samma kalkylbladsläsare som Excel; välj blad. Excel 2003 XML känns igen på innehållet även om filen heter .xml |
| Tabeller i dokument: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Ja | Nej | Alla tabeller i filen visas i en lista med rubrik eller bildtext, antal rader och kolumner. Sammanslagna celler (colspan och rowspan, Words sammanfogade celler, `\multicolumn`) fylls i på alla rader och kolumner de täcker. Rubrikraden tas från `th`, `thead`, Markdowns avgränsningsrad, Words rubrikrad eller `booktabs` (`\midrule`) |
| KML och KMZ (Google Earth) | Ja | Nej | En rad per plats med namn, beskrivning, mappsökväg, tid och utökade data som kolumner; punkter, linjer, polygoner och sammansatta geometrier blir GeoJSON |
| GPX (GPS-spår) | Ja | Nej | Välj lager: vägpunkter, rutter, spår (med antal punkter och längd i km) eller spårpunkter (en rad per punkt med tid och höjd) |
| TopoJSON | Ja | Nej | Varje objekt i topologin är ett lager; bågarna avkodas till vanliga GeoJSON-geometrier. Känns igen på innehållet även om filen heter .json |
| JSON | Ja | Ja | Lista med objekt, objekt som innehåller en lista (sökväg kan anges), lista med listor |
| NDJSON, JSON Lines | Ja | Nej | Ett objekt per rad |
| JSON-stat | Ja | Nej | Känns igen automatiskt (`class: dataset`, version 2.0); en rad per cell med koder, texter och värde |
| SDMX-JSON | Ja | Nej | Datameddelanden i SDMX-JSON 1.0 och 2.0 (till exempel från ECB och OECD) känns igen automatiskt; en rad per observation med kod- och textkolumn per dimension, tidsperiod, värde och attribut |
| GeoJSON | Ja | Ja | En rad per feature; egenskaperna blir kolumner, geometrin en textkolumn med GeoJSON som kartdiagrammet ritar (kartan läser även WKT-text i en kolumn, till exempel från CSV). Vid export blir geometrikolumnen (GeoJSON eller WKT) varje features geometri och övriga kolumner dess egenskaper |
| Shapefile (ZIP med shp, dbf, prj, cpg, eller bara shp) | Ja | Nej | Attributen blir typade kolumner enligt dbf-schemat, geometrin GeoJSON i kolumnen `geometry`. Välj lager om ZIP-filen har flera, och förenkla geometrin med en tolerans i kartenheter. Koordinaterna behålls (SWEREF99 TM eller longitud/latitud) |
| XML | Ja | Ja | En rad per upprepat element (väljs i importsteget); attribut och underelement blir kolumner, nästlade element får punktnamn som `lage.lan` |
| SQLite | Ja | Ja | Dataspatiums egen fil återställs med typer, etiketter och historik; i andra databaser väljer du tabell och typerna tas från schemat |
| SQL-skript (sql) | Ja | Nej | Ett skript med `CREATE TABLE` och `INSERT`, till exempel en databasdump, körs i en tom SQLite-databas och tabellerna visas för val. MySQL-specifika rader (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` och tabellval som `ENGINE=`) tas bort först; andra dialekter fungerar så långt de följer SQLite:s syntax |
| GeoPackage (gpkg) | Ja | Nej | Lagren (feature- och attributtabeller) väljs som tabeller; geometrikolumnen blir GeoJSON som kartdiagrammet ritar, referenssystemet visas |
| Access (mdb, accdb) | Ja | Nej | Läses direkt i webbläsaren med mdb-reader; tabellen väljs i steget Inställningar och typerna kommer från Access. Frågor, länkade tabeller och lösenord kräver [databasbryggan](kallor.md). |
| Dokument: PDF, Word (docx), OpenDocument (odt), Markdown (md), text (txt) | Ja | Nej | Blir en dokumentsamling med ett stycke per rad (dokument, sida, stycke, typ, text, tecken); flera filer på en gång blir en samling och originalen följer med. Se [dokument.md](dokument.md) |
| Bilder: JPEG, PNG, WebP, GIF, BMP, AVIF | Ja | Nej | Blir en bildsamling med en rad per bild (mått, storlek, datum, kamera och position ur EXIF); en förhandsvisning och en miniatyr sparas, inte originalen. Se [dokument.md](dokument.md) |
| QGIS-projekt (qgs, qgz) | Ja | Nej | Blir en kartvy i Visualisera med projektets lagerordning, synlighet och symboler (färger, linjebredder, punktstorlekar); lagren kopplas till datamängder med samma filnamn och medföljande datafiler importeras. Se [kartor.md](kartor.md) |
| SPSS sav, zsav, por | Ja | sav | Via R-paketet haven. Variabeletiketter blir kolumnetiketter och värdeetiketter kolumnmetadata (se nedan) |
| Stata dta | Ja | dta | Via haven. Värdeetiketter som för SPSS. Vid export kortas kolumnnamnen till Statas regler (32 tecken, ASCII) |
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

Värdeetiketter (koder med namn, som `1 = Man` och `2 = Kvinna`) följer kolumnen som metadata i SQLite-filen
(`_columns.value_labels`). Vid import av SPSS, Stata och SAS väljer du i inställningssteget om kolumnen ska visa
etiketterna som text (standard) eller behålla koderna; etiketterna sparas i båda fallen. De kan sättas, ändras och
bytas mot koderna i Bearbeta, visas i kodboken, följer med till R som `haven::labelled` och skrivs till .sav och
.dta, där en kolumn med etiketterna som text får tillbaka sina koder.

Med appen följer också data som läggs till i Inhämta: exempeldatan *Befolkning per kommun 2024* och gränser för
kartor som GeoJSON i longitud och latitud: kommuner och län i Sverige (SCB, CC0), kommuner och regioner i Danmark
(DAGI), kommuner och fylken i Norge (Kartverket, CC BY 4.0) samt kommuner och landskap i Finland
(Statistikcentralen, CC BY 4.0). Källor och licenser står i `presets/geo/KALLA.md`. Ingenting hämtas från nätet.

**Digitala planer** (slaget plan): detaljplaner enligt Lantmäteriets nationella specifikation (GeoJSON, `feature:typ`),
referensobjekt från Nationella geodataplattformen, översiktsplaner enligt specifikationens testversion (GeoJSON) och
Boverkets ÖP-modell (GeoPackage med `innehall_op_*`). Känns igen på innehållet och öppnas som plankarta; se
[planer.md](planer.md).

**Nordiska planer** (slaget plan): Plandata.dk-GeoJSON (lokalplaner, delområder, byggefelter, kommuneplanrammer), Finlands
kaavatietomalli (Ryhti-JSON), Skipulagsstofnuns stafrænt skipulag (GeoJSON eller GeoPackage-mallen) och norska
reguleringsplaner/kommuneplaner som GeoPackage (Rp-/Kp-tabeller). Känns igen på innehållet; GeoPackage-filer får valet
*Hela planen som plan*. Se [planer.md](planer.md).

**Grafer** (slaget graf): GraphML, GEXF, JSON med noder och kanter (D3, networkx, Cytoscape, Neo4j) och Cypher-skript
(APOC-export). Läses och skrivs; känns igen på innehållet. Se [grafer.md](grafer.md).

**Byggnadsmodeller och ritningar** (slaget modell): IFC (`.ifc`, `.ifczip`; IFC2X3, IFC4, IFC4X3) och DXF. Originalfilen
sparas; byggdelar, egenskaper och mängder blir tabeller, och DXF-ritningen blir SVG. Se [cad-bim.md](cad-bim.md).

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

Varje datamängd är en SQLite-fil med tabellerna `data` (raderna), `_columns` (namn, typ, etikett, ursprungsnamn,
beskrivning, enhet och värdeetiketter; de tre sista läggs till när en äldre fil öppnas), `_meta` (namn, kortnamn,
beskrivning, tidsstämplar, källa, importinställningar), `_log` (allt som gjorts med datamängden) och, när någon har
kommenterat, `_comments` (tid, namn, text, kolumn och om kommentaren är löst). Filen går att öppna i R med RSQLite,
i DB Browser for SQLite och i de flesta andra verktyg.

## Arbetsytans filer

Säkerhetskopian (ZIP), den portabla mappen (Edge och Chrome) och mappen i ett GitHub-repo har samma uppbyggnad:
`manifest.json` med en lista över innehållet, `datasets/<id>.sqlite` per datamängd, `charts/<id>.viz.json` per
sparat diagram, `documents/<id>.doc.json` per egen dokumentmall, `dashboards/<id>.dash.json` per dashboard,
`notebooks/<id>.nb.json` per anteckningsbok och `scripts/<id>.script.json` per sparat R-skript, SQL-skript eller
regexmönster. Ett delningspaket (*Paket* i läget Dela) har samma uppbyggnad men innehåller bara det du valt.
Dess manifest har `kind: bundle`, avsändarens namn (`author`), meddelandet (`message`) och ändringarna i varje
datamängd sedan den senast delades eller togs emot (`changes`), och paketet har dessutom `CHANGELOG.md` med samma
sak och de olösta kommentarerna i läsbar form. När ett paket läses in visas meddelandet och ändringarna, och allt
som redan finns hoppas över (datamängder med samma id, diagram, dashboards, mallar och anteckningsböcker med samma
namn), utom de datamängder du väljer att ersätta med paketets version; din version sparas då under *Versioner*.
Med automatisk sparning på skrivs ändrade datamängder till den portabla mappen strax efter varje sparning och filer
för borttagna datamängder tas bort. Mappen kan läsas in på en annan dator på samma sätt som ett paket.

Manifestet har `format: 2` sedan version 2.0: varje datamängd i listan har förutom `id`, `name` och `shortName`
även `folder` (mappen, som `Ekonomi/2026`, eller tom) och `tags` (en lista). Äldre paket och säkerhetskopior (utan
`format`) läses som förut. Mapp och taggar ligger också i datamängdens egen fil (`_meta`), så de följer med var
filen än hamnar, liksom `kind` (`table`, `graph`, `document`, `images`, `model`); i 2.0 är alla datamängder
tabeller.

Raderna i `_log` har tidsstämpel, åtgärdstyp och detaljer som JSON. Åtgärdstyperna är bland andra `import`, `op`
(ett receptsteg med `op`, `params`, `result` och `description`; det är dessa rader som utgör receptet), `undo`,
`snapshot`, `restore`, `comment` (en ny kommentar), `shared` och `received` (när datamängden delades eller togs emot i
ett paket eller från GitHub; ändringsloggen i nästa paket börjar efter den senaste av dem). Hantera visar raderna som
läsbar text. Receptexporten i Bearbeta bygger på `op`-raderna, se [bearbeta.md](bearbeta.md).
