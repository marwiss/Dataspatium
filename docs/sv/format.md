# Format och import

## Filer och mappar i Inhämta

Under *Filer* i Inhämta släpper du en eller flera filer på ytan, eller klickar på den för att välja. Du kan också släppa en
eller flera **mappar**: appen läser då alla filer i dem, också i mapparna längre ned, och sorterar dem efter vad de är (se
*Flera olika filer* i [lagen.md](lagen.md)). Knappen *Välj en mapp* under *Fler alternativ* gör detsamma med tangentbordet.
En shapefil i en mapp läses tillsammans med filerna bredvid den med samma namn: attributen i `.dbf`, koordinatsystemet i
`.prj` och teckentabellen i `.cpg`; indexfilerna (`.shx` och liknande) behövs inte och visas inte som filer appen inte läser.

Under ytan står formaten som appen läser, grupperade efter vad de används till:

- **Byggnadsmodeller och ritningar**: IFC, IFCZIP och DXF (slaget modell) och BCF-ärenden (en tabell med ärenden).
- **Planer**: detaljplaner och översiktsplaner i GeoJSON och GeoPackage, arkivpaket med plan och en översiktsplan i flera filer
  (slaget plan).
- **Geodata och kartor**: GeoJSON, GeoJSON Lines, TopoJSON, KML, KMZ, GPX, GML, shapefile och GeoPackage (tabeller med geometri som
  ritas på kartan), GeoTIFF (slaget raster) och QGIS-projekt (blir en kartvy i Visualisera).
- **Tabeller**: CSV och annan avgränsad text, TSV, text med fasta kolumnbredder, Excel, ODS, FODS, Excel 2003 XML, äldre
  kalkylblad, JSON, JSON Lines, XML, tabeller i HTML och LaTeX, Parquet och datapaket.
- **Databaser**: SQLite, SQL-skript och Access.
- **Statistik**: SPSS, Stata, SAS, PC-Axis (PX), R (RDS, RData), JSON-stat och SDMX-JSON.
- **Dokument**: PDF, Word, OpenDocument och Markdown (slaget dokument).
- **Bilder**: JPEG, PNG, WebP, GIF, BMP och AVIF (slaget bilder).
- **Grafer**: GraphML, GEXF, Cypher och JSON med noder och kanter (slaget graf).

Listan och filväljarens filter kommer ur samma tabell i appen som importen använder, så att de aldrig skiljer sig. Tabellen nedan
säger mer om varje format.

## Filformat som stöds

| Format | Import | Export | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med avgränsare | Ja | Ja | Avgränsare, teckenkodning och rubrikrad identifieras automatiskt och kan ändras |
| Text med fasta kolumnbredder | Ja | Nej | Välj formatet i importsteget (filer som heter .fwf eller .prn känns igen). Kolumnstarterna hittas ur mellanslag som finns på alla rader, eller anges som positioner |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Välj blad; datum och ja/nej blir riktiga typer |
| ODS och FODS (LibreOffice) | Ja | ods | Samma typhantering som Excel |
| Äldre kalkylformat: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Ja | Nej | Läses av samma kalkylbladsläsare som Excel; välj blad. Excel 2003 XML känns igen på innehållet även om filen heter .xml |
| Tabeller i dokument: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Ja | Nej | Alla tabeller i filen visas i en lista med rubrik eller bildtext, antal rader och kolumner. Sammanslagna celler (colspan och rowspan, Words sammanfogade celler, `\multicolumn`) fylls i på alla rader och kolumner de täcker. Rubrikraden tas från `th`, `thead`, Markdowns avgränsningsrad, Words rubrikrad eller `booktabs` (`\midrule`) |
| KML och KMZ (Google Earth) | Ja | Ja | En rad per plats med namn, beskrivning, mappsökväg, tid och utökade data som kolumner; punkter, linjer, polygoner och sammansatta geometrier blir GeoJSON |
| GPX (GPS-spår) | Ja | Ja | Välj lager: vägpunkter, rutter, spår (med antal punkter och längd i km) eller spårpunkter (en rad per punkt med tid och höjd) |
| GML (gml; GML 3.2, 3.1.1 och 2.1.2, till exempel ett svar från en WFS) | Ja | Nej | En rad per objekt med egenskaperna som kolumner (en egenskap med ett objekt i ger namn med punkt) och geometrin som GeoJSON: punkter, linjer, ytor, multigeometrier och förenklade kurvor. Välj objekttyp när filen har flera. Koordinatsystemet behålls och axelordningen följer `srsName` (se [kallor.md](kallor.md#öppna-geodata)). Känns igen på innehållet även om filen heter .xml |
| TopoJSON | Ja | Nej | Varje objekt i topologin är ett lager; bågarna avkodas till vanliga GeoJSON-geometrier. Känns igen på innehållet även om filen heter .json |
| JSON | Ja | Ja | Lista med objekt, objekt som innehåller en lista (sökväg kan anges), lista med listor |
| NDJSON, JSON Lines | Ja | Nej | Ett objekt per rad. GeoJSON Lines (`.geojsonl`, `.geojsons`, `.geojsonseq`), med en feature per rad eller med postavskiljare enligt RFC 8142, blir en rad per feature med geometrin som GeoJSON |
| JSON-stat | Ja | Nej | Känns igen automatiskt (`class: dataset`, version 2.0); en rad per cell med koder, texter och värde |
| SDMX-JSON | Ja | Nej | Datameddelanden i SDMX-JSON 1.0 och 2.0 (till exempel från ECB och OECD) känns igen automatiskt; en rad per observation med kod- och textkolumn per dimension, tidsperiod, värde och attribut |
| GeoJSON | Ja | Ja | En rad per feature; egenskaperna blir kolumner, geometrin en textkolumn med GeoJSON som kartdiagrammet ritar (kartan läser även WKT-text i en kolumn, till exempel från CSV). Vid export blir geometrikolumnen (GeoJSON eller WKT) varje features geometri och övriga kolumner dess egenskaper |
| Shapefile (ZIP med shp, dbf, prj, cpg, shp med de andra filerna bredvid i en mapp eller ett val av filer, eller bara shp) | Ja | Nej | Attributen blir typade kolumner enligt dbf-schemat, geometrin GeoJSON i kolumnen `geometry`. Välj lager om ZIP-filen har flera, och förenkla geometrin med en tolerans i kartenheter. Koordinaterna behålls (SWEREF99 TM eller longitud/latitud) |
| XML | Ja | Ja | En rad per upprepat element (väljs i importsteget); attribut och underelement blir kolumner, nästlade element får punktnamn som `lage.lan` |
| SQLite | Ja | Ja | Dataspatiums egen fil återställs med typer, etiketter och historik; i andra databaser väljer du tabell och typerna tas från schemat |
| SQL-skript (sql) | Ja | Nej | Ett skript med `CREATE TABLE` och `INSERT`, till exempel en databasdump, körs i en tom SQLite-databas och tabellerna visas för val. MySQL-specifika rader (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` och tabellval som `ENGINE=`) tas bort först; andra dialekter fungerar så långt de följer SQLite:s syntax |
| GeoPackage (gpkg) | Ja | Ja | Lagren (feature- och attributtabeller) väljs som tabeller; geometrikolumnen blir GeoJSON som kartdiagrammet ritar, referenssystemet visas. Hela filen kan också bli en datamängd av slaget kartlager ([kartor.md](kartor.md#kartlager-en-geopackage-fil-med-alla-lager)), och tillsammans med sitt textdokument en digital översiktsplan ([planer.md](planer.md#digital-översiktsplan-i-flera-filer)) |
| Access (mdb, accdb) | Ja | Nej | Läses direkt i webbläsaren med mdb-reader; tabellen väljs i steget Inställningar och typerna kommer från Access. Frågor, länkade tabeller och lösenord kräver [databasbryggan](kallor.md). |
| Dokument: PDF, Word (docx), OpenDocument (odt), Markdown (md), text (txt) | Ja | Nej | Blir en dokumentsamling med ett stycke per rad (dokument, sida, stycke, typ, text, tecken); flera filer på en gång blir en samling och originalen följer med. Se [dokument.md](dokument.md) |
| Bilder: JPEG, PNG, WebP, GIF, BMP, AVIF | Ja | Nej | Blir en bildsamling med en rad per bild (mått, storlek, datum, kamera och position ur EXIF); en förhandsvisning och en miniatyr sparas, inte originalen. Se [dokument.md](dokument.md) |
| GeoTIFF och molnoptimerad GeoTIFF (tif, tiff) | Ja | Ja | Blir ett raster med en rad per fil (bildpunkter, band, datatyp, upplösning, koordinatsystem och utbredning); en förhandsvisning i Web Mercator och en miniatyr sparas, och originalen när vart och ett är högst 32 MB och alla tillsammans högst 40 MB. Exporteras som originalfilen eller som bilden på kartan i Web Mercator med `kreditering.txt`. Se [raster.md](raster.md) |
| BCF (bcf, bcfzip) | Ja | Ja | BCF-XML 3.0 och 2.1, även från andra program. Ärendena blir en tabell, kommentarer och viewpoint-komponenter tabeller bredvid, och filen sparas med ärendena så att viewpoints, ögonblicksbilder och dokument finns kvar. Export enligt BCF 3.0 av ett projekts ärenden från modellvyns panel Ärenden, av kollisioner och av AI-kontrollens fynd; se [cad-bim.md](cad-bim.md#bcf-filer) |
| QGIS-projekt (qgs, qgz) | Ja | Nej | Blir en kartvy i Visualisera med projektets lagerordning, synlighet och symboler (färger, linjebredder, punktstorlekar); lagren kopplas till datamängder med samma filnamn och medföljande datafiler importeras. Se [kartor.md](kartor.md) |
| SPSS sav, zsav, por | Ja | sav | Via R-paketet haven. Variabeletiketter blir kolumnetiketter och värdeetiketter kolumnmetadata (se nedan) |
| Stata dta | Ja | dta | Via haven. Värdeetiketter som för SPSS. Vid export kortas kolumnnamnen till Statas regler (32 tecken, ASCII) |
| SAS sas7bdat, xpt | Ja | Nej | Via haven |
| PX (PC-Axis, SCB) | Ja | Nej | Via R-paketet pxR; teckenkodningen läses ur filens CODEPAGE eller CHARSET. Resultatet är en lång tabell med en värdekolumn |
| Parquet | Ja | Ja | Via R-paketet nanoparquet; behåller typer exakt |
| RDS, RData | Ja | rds | R-objekt; en RData-fil måste innehålla en data.frame |
| Inklistrad text | Ja | | Formatet känns igen som för en fil utan filändelse; se [Inklistrad text](#inklistrad-text) |

Textfiler med avgränsare som är 64 MB eller större läses in i omgångar: förhandsgranskningen visar de första
raderna som vanligt, och vid importen skrivs raderna till datamängden medan filen läses, så att hela texten
aldrig behöver ligga i minnet. Kolumntyperna tas från kolumnsteget eller gissas ur den första omgången.
Förloppet visas i raderna som lästs in.

Alla filformat kan också hämtas från en webbadress under *Webbadress* i Inhämta, om servern tillåter
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

Med appen följer också data som läggs till i Inhämta: exempeldatan (en tabell, en översiktsplan, en detaljplan, en
byggnadsmodell, en JSON-fil och en graf, se [kallor.md](kallor.md#exempeldata) och `presets/exempeldata/KALLA.md`) och gränser för
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

## Filer utan känd filändelse

Filändelsen avgör som förut vilken läsare som tar filen. Saknas den, eller känner appen inte till den (en fil som heter
`export` eller `rapport.bin`), läses filens början, högst 16 kB (för en ZIP-fil även förteckningen i slutet), och filen
känns igen på innehållet när kännetecknet är säkert. Formaten prövas i denna ordning:

| Format | Känns igen på | Blir |
|---|---|---|
| SQLite, GeoPackage | `SQLite format 3`; GeoPackage på sitt application_id `GPKG` | `.sqlite`, `.gpkg` |
| ZIP | Filerna i arkivet: Excel (`xl/workbook.xml`), Word (`word/document.xml`), ODS och ODT (`mimetype`), datapaket, arkivpaket och ÖP-leverans, shapefiler, BCF, QGIS-projekt, IFC och KML. En annan ZIP-fil känns inte igen | `.xlsx`, `.docx`, `.ods`, `.odt`, `.zip`, `.bcfzip`, `.qgz`, `.ifczip`, `.kmz` |
| PDF, TIFF och bilder | `%PDF-`; `II*` eller `MM*` (blir ett raster); PNG, JPEG, GIF, WebP, BMP och AVIF på sina första byte | `.pdf`, `.tif`, bildens ändelse |
| Excel 97–2003, Access, shapefil | En OLE2-fil med strömmen `Workbook`; `Standard Jet DB` eller `Standard ACE DB`; filkod 9994 med version 1000 | `.xls`, `.mdb`, `.accdb`, `.shp` |
| SPSS, Stata, SAS, Parquet, RData | `$FL2`, `<stata_dta>`, SAS-filens kännetecken, `HEADER RECORD` (transportfil), `PAR1` i båda ändar, `RDX3` | formatets ändelse |
| IFC, DXF | `ISO-10303-21;` med en `FILE_SCHEMA` som är IFC; `0 SECTION 2 HEADER` (eller en annan sektion) | `.ifc`, `.dxf` |
| JSON | `{` eller `[` som håller som JSON i hela den lästa början; GeoJSON, TopoJSON, JSON Lines och appens egna format (fältet `format`, till exempel `dataspatium-viz/1`) | `.json`, `.geojson`, `.topojson`, `.ndjson` |
| XML, HTML | Rotelementet: KML, GPX, GraphML, GEXF, QGIS, HTML, FODS och Excel 2003 XML; GML med objekt (en FeatureCollection eller objekt med `gml:id`); annan XML med XML-deklaration eller namnrymd (IDS nämns vid namn) | formatets ändelse (`.gml` för GML), annars `.xml` |
| SQL, LaTeX, PC-Axis, Cypher | `CREATE TABLE` (efter `PRAGMA`, `BEGIN` och liknande), `\documentclass`, `CHARSET=` med `STUB=` eller `HEADING=`, `CREATE (:…)` | `.sql`, `.tex`, `.px`, `.cypher` |
| Markdown | En tabell med lodstreck och en rad med streck, ett kodblock inom tre grav-accenter, en rubrik (`# …`) först med en tom rad eller ett annat Markdown-tecken efter, eller tre slags tecken (rubriker, listor, citat, länkar, fetstil) | `.md` |
| CSV, TSV (sist) | Samma antal av en avgränsare (tabb, semikolon, komma eller lodstreck) på varje rad, på minst tre rader eller med minst två avgränsare; med tabb räcker två rader | `.csv`, `.tsv` |

Filen får ändelsen i appen (`export` blir `export.gpkg`), och förhandsgranskningen säger *Känd igen på innehållet som …*;
filen på datorn ändras inte. Namnet ändras bara när formatet är säkert. En text som inget kännetecken passar, inte heller CSV
eller TSV, läses som ett textdokument, stycke för stycke, och får ändelsen `.txt`; förhandsgranskningen säger det, och
formatet kan väljas i importsteget. En fil som varken är text eller ett känt format läses inte, och appen ber dig byta
namn på filen med rätt ändelse; i ett val av flera filer står den bland dem som appen inte läser. En fil från en
webbadress utan ändelse får en ändelse bara när servern anger formatet (JSON, CSV, XML, ZIP, Excel eller GeoPackage), annars
avgör innehållet. I filväljaren visas filer utan ändelse under *Alla filer*; att dra filen till ytan går alltid.

## Inklistrad text

Under *Klistra in* i Inhämta går det att klistra in vilken text som helst. Formatet känns igen på samma sätt som för en fil utan
filändelse (se ovan), och vyn räknar upp vad appen känner igen, grupperat som listan under filytan och ur samma tabell som
igenkänningen använder:

- **Byggnadsmodeller och ritningar**: IFC (STEP-text med en `FILE_SCHEMA` som är IFC) och DXF.
- **Planer**: detaljplaner och översiktsplaner i GeoJSON.
- **Geodata och kartor**: GeoJSON, TopoJSON, KML, GPX, GML och QGIS-projekt.
- **Tabeller**: CSV, TSV, FODS, Excel 2003 XML, JSON, JSON Lines, XML (också IDS, som läses som XML), tabeller i HTML och
  LaTeX.
- **Databaser**: SQL-skript.
- **Statistik**: PC-Axis (PX), JSON-stat och SDMX-JSON.
- **Dokument**: Markdown.
- **Grafer**: GraphML, GEXF, Cypher och JSON med noder och kanter.

Inställningssteget säger *Texten känns igen som …*, och formatet kan bytas där. En tabell (CSV eller TSV) läses som förut, med
valet av avgränsare, och en text som inget av formaten passar blir ett textdokument, stycke för stycke. En inklistrad tabell, JSON
eller XML får källan *Klistra in*; en modell, ett dokument eller en graf blir en datamängd av sitt slag som om texten vore en fil
med namnet *Inklistrat*.

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
i DB Browser for SQLite och i de flesta andra verktyg. Ett raster har dessutom tabellen `_files` med varje fils original,
förhandsvisning (`preview`) och miniatyr (`thumb`) under filens namn, och `_meta.raster` med filernas uppgifter: koordinatsystem,
utbredning, upplösning, band, vad som blev av originalet, kreditering och licens.

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
filen än hamnar, liksom `kind` (`table`, `graph`, `document`, `images`, `model`, `plan`, `raster`).

Raderna i `_log` har tidsstämpel, åtgärdstyp och detaljer som JSON. Åtgärdstyperna är bland andra `import`, `op`
(ett receptsteg med `op`, `params`, `result` och `description`; det är dessa rader som utgör receptet), `undo`,
`snapshot`, `restore`, `comment` (en ny kommentar), `shared` och `received` (när datamängden delades eller togs emot i
ett paket eller från GitHub; ändringsloggen i nästa paket börjar efter den senaste av dem). Hantera visar raderna som
läsbar text. Receptexporten i Bearbeta bygger på `op`-raderna, se [bearbeta.md](bearbeta.md).
