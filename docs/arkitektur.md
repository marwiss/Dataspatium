# Arkitektur

## Grundförutsättning: file://

Dataspatium ska fungera när `index.html` öppnas direkt från en mapp. Det ger fyra hårda regler som bekräftats med
headless-tester i Edge och Firefox (se [fas0-spik.md](fas0-spik.md)):

1. All egen kod är klassiska skript. Inga ES-modulfiler (`<script type="module" src>`), ingen `import`/`export`.
   Moduler registreras med `Dataspatium.define(name, deps, factory)` och hämtas med `Dataspatium.require(name)`.
   Laddordningen står i `src/boot.js`.
2. Ingen `fetch()`, `XMLHttpRequest`, `new Worker(url)` eller `import(url)` mot egna filer. Binärer och ESM-text
   bäddas in som JavaScript i `vendor/` och nås via `Dataspatium.assets`.
3. Workers är klassiska Blob-workers med inbäddad kod och ett shim som gör att kod inuti workern kan fortsätta
   använda `fetch`, `XMLHttpRequest` och `importScripts` mot resurser med schemat `dataspatium-asset://`.
4. OPFS, SharedArrayBuffer, File System Access och service workers får inte förutsättas; `Dataspatium.capabilities`
   talar om vad som finns.

Samma kod fungerar oförändrad från en vanlig webbserver. Över https eller localhost registrerar `src/boot.js` service
workern `sw-coi.js` innan skripten laddas. Den lägger till `Cross-Origin-Opener-Policy: same-origin` och
`Cross-Origin-Embedder-Policy: credentialless` på appens egna svar (anrop till andra webbplatser passerar orörda), och
sidan laddas om en gång när den tar över. Sidan blir då cross-origin isolated, `Dataspatium.capabilities` rapporterar
SharedArrayBuffer och R kan avbrytas (se R nedan). Under file:// händer inget av detta.

## Lager

```
UI               src/ui: design (tokens, tema, typsnitt, ikoner), components (dm-*), shell, modes, i18n
Tjänster         src/data (datamängder, typer, kodning, arbetsyta), src/io (importers, exporters)
Motorer          src/engines/sqlite (sql.js i worker), src/engines/r (WebR), src/engines/python (Pyodide, komponent)
Plattform        src/platform: registry, assets, net-shim, workers + worker-shim, capabilities, storage, consent, components
```

## Resurser och shims

- `vendor/manifest.js` listar alla inbäddade resurser: namn (`webr/R.wasm`), fil, kodning, storlek, hash.
  Wrapperfilerna anropar `Dataspatium.assets.register(name, encoding, payload)` när de laddas med en injicerad
  `<script>`-tagg. Kodningar: `text`, `base64`, `gzip+base64` (packas upp med `DecompressionStream`).
- `src/platform/net-shim.js` ersätter `fetch` och `XMLHttpRequest` på huvudtråden så att URL:er med schemat
  `dataspatium-asset://` besvaras ur resurskartan. Allt annat passerar orört. Under Firefox på file:// patchas även
  `URL` eftersom `location.origin` är `"null"`.
- `src/platform/worker-shim.js` innehåller två fristående funktioner som serialiseras med `toString()` och sätts
  före den kod som ska köras i en worker. Shimmet tar emot resurser via `postMessage` (protokollet `__dm`), köar
  meddelanden till den inbäddade koden tills resurserna är på plats och implementerar `fetch`, synkron och
  asynkron `XMLHttpRequest` (inklusive HEAD och Range), `importScripts` och `WebAssembly.instantiateStreaming`.
- `src/platform/workers.js` ersätter den globala `Worker` med en underklass som filtrerar bort shimmets
  kontrollmeddelanden och besvarar dem med resurser från en "provider" per namnrymd (`webr`, `sqljs`, `pyodide`).
  Binära resurser överförs (transfer) till workern och tas ur minnet på huvudtråden (`assets.take`); ber två workers
  om samma resurs samtidigt (två SQLite-motorer som öppnas i samma ögonblick) avkodas en ny kopia åt den andra,
  eftersom den första överföringen kopplar loss bufferten. Wrapperfilen injiceras då på nytt.

## Motorer

- SQLite: sql.js (SQLite i WebAssembly) i en worker. `SqliteEngine` är klienten med `open`, `exec`, `run`,
  `insertRows` (förberedd sats i en transaktion), `updateRows`, `execMany` (flera satser i en savepoint) och
  `export`. En instans per öppen datamängd. Workern registrerar egna SQL-funktioner (`regexp`,
  `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`, `dm_title`, `dm_squish`,
  `dm_fingerprint` med flera) och registrerar dem på nytt efter `export`, eftersom sql.js då öppnar
  anslutningen igen.
- R: WebR 0.5.9 (R 4.5.1), under file:// med PostMessage-kanalen. Eftersom basadressen `dataspatium-asset://webr/` har ett annat
  ursprung hämtar WebR sin worker-kod med XMLHttpRequest och skapar en Blob-worker av svaret; vårt nätverks-shim
  svarar med "worker-shim + webr-worker.js". Paketrepot är inbäddat under `webr-repo/` och installeras med
  `webr::install()`. R och JS delar data genom SQLite-filer i WebR:s virtuella filsystem (RSQLite). WebR 0.5.9
  gör om varje fil som skrivs till en vanlig array (`Object.values`), vilket slår i taket för arraylängd nära
  128 MB; `writeFile` i `src/engines/r/r-engine.js` skriver därför större filer i delar om 16 MB som R fogar ihop.
  På en cross-origin isolated sida används i stället SharedArrayBuffer-kanalen, och `interrupt()` stoppar körande kod
  (knappen *Avbryt* i Analysera). Med den kanalen väntar webR:s worker på R-anrop och läser inga fler meddelanden,
  så paket som behövs efter starten skrivs med `webR.FS.writeFile` till `/dataspatium-assets/` i R:s filsystem, där
  worker-shimmen letar efter resurser den saknar.

- Python: Pyodide 314.0.7 (Python 3.14) i en egen klassisk Blob-worker med shimmen (`src/engines/python/python-engine.js`).
  Python följer inte med i ZIP:en: `src/engines/python/catalog.js` pinnar körtidens fem filer med SHA-256 och läser
  `pyodide-lock.json` (själv pinnad) för hjulens summor, beroenden och importnamn; filerna hämtas som komponenter från
  jsDelivr efter samtycke (`components`), tillhandahålls som resurser `pyodide/<fil>` och skickas till workern, som
  laddar dem via `dataspatium-asset://pyodide/`. Pyodides laddare vill `import()`-a sin ES-modullimfil och vägrar
  klassiska workers; workern byter ut `import()`-anropet mot en shim-funktion, gör limfilen klassisk (tar bort
  `export default`, ersätter `import.meta.url`) och tar bort spärren, allt i minnet (filerna ändras inte). Protokollet
  mot workern är meddelanden med id (`init`, `run`, `eval`, `packages`, `fs`); stdout och stderr strömmar som
  `stream`, och när Python-kod vill nå internet (micropip) frågar workern huvudtråden (`net`), som tillämpar samtycket.
  `data/python-bridge.js` är R-bryggans motsvarighet: speglar datamängder som SQLite till `/data`, hämtar och skickar
  de hjul koden importerar (`catalog.referenced`), kör koden, samlar matplotlib-figurer (Agg, SVG + PNG, kvar i Python
  för export till SVG, PNG och PDF) och läser `dm_write()`-filer från `/data/out`. `python/dataspatium.py` bäddas in av
  `tools/wrap_local.py` och ger `dm_list`, `dm_read` (pandas, typer ur `_columns`, metadata i `df.attrs`),
  `dm_write`, `dm_value_labels`, `theme_dataspatium` och `dm_palette`. Avbryt fungerar som för R via SharedArrayBuffer
  (`setInterruptBuffer`) i serverläget. Python startar bara på användarens åtgärd (Starta Python eller Kör), inte när
  fliken öppnas, eftersom första starten hämtar cirka 22 MB.

## Datamodell

En datamängd är en SQLite-fil med tabellerna `data`, `_columns`, `_meta` och `_log` (se [format.md](format.md)).
`_columns` fick kolumnerna `description` och `unit` i 1.9; `readColumns` lägger till dem med `alter table` när en
äldre fil (eller en fil från `dm_write()` i R) öppnas, så att alla kodvägar kan räkna med dem. I 1.15 tillkom
`value_labels`: värdeetiketter som JSON, `{"values": "codes" | "labels", "labels": [[kod, "etikett"], ...]}`, där
`values` säger om kolumnen har koderna eller redan etiketterna som text. `r/dataspatium.R` gör dem till
`haven::labelled` i `dm_read()`, läser tillbaka dem i `dm_write()` och skriver koderna till .sav och .dta.
Kommentarer ligger i tabellen `_comments` (`src/data/comments.js`, skapas vid första kommentaren) och följer därmed
med filen överallt. `src/data/changelog.js` gör `_log`-raderna läsbara och plockar ut stegen sedan senaste `shared`
eller `received` för paketens ändringslogg.

Varje datamängd har ett kortnamn (`_meta.shortName`, även i IndexedDB-posten): en SQL-säker identifierare som
`datasets.shortNameFrom` härleder ur namnet (translitterering, `[a-z0-9_]`, högst 32 tecken, reserverade ord och
dubbletter får suffix) och som användaren kan ändra under Hantera. `src/data/query.js` låter en SQL-sats mot den
valda datamängden nämna andra datamängder med kortnamn: satsens identifierare matchas mot kortnamnen, de
datamängderna "monteras" i den valda datamängdens worker (deras SQLite-bytes öppnas som egna sql.js-databaser, så
att filerna finns i workerns virtuella filsystem) och ATTACH:as som `<kortnamn>__db` med en temporär vy per
kortnamn; den valda datamängden får också en vy med sitt eget kortnamn på `main.data`. Före varje fråga jämförs
`pragma database_list` med de kortnamn satsen nämner, så att ATTACH görs om efter att anslutningen öppnats om
(sparning och ångra gör det), medan monteringarna ligger kvar och förnyas bara när `datasets.version(id)`
(sparningstid plus ett revisionsnummer för osparade ändringar) ändrats. Ändrande
receptsteg av typen `sql` kopplar in kortnamnen i `prepare`, efter ångra-ögonblicksbilden. R-bryggans index
(`/data/index.tsv`) har kolumnen `shortName`, så `dm_read()` och `dm_find()` i R löser kortnamn, och diagram- och
anteckningsboksfiler bär `datasetShort` som andra matchning vid import.
Filen lagras i IndexedDB i bitar om 4 MB (`src/platform/storage/idb-store.js`), som skrivs och läses en i taget så att huvudtråden aldrig kopierar hela filen i ett svep, tillsammans med en metadatapost.
`src/data/datasets.js` är den enda vägen till datamängderna: skapa, lista, fråga (sidvis med sortering och
filter), statistik, logg, spara, byt namn, ta bort, exportera bytes, importera bytes, versioner
(ögonblicksbilder som egna blobbar i IndexedDB) och `createFromQuery` för härledda datamängder. Arbetsytan kan
säkerhetskopieras som ZIP och, i Chromium, speglas till en portabel mapp (`src/data/workspace.js`): `collect`
samlar manifest, datamängder, diagram och mallar som sökväg-till-bytes, `backup` zippar dem (och noterar tiden i
inställningen `backup.lastAt`; `backupStatus`/`isBackupDue` avgör mot `backup.remindDays`, standard 30, om skalet
ska påminna vid start), `saveToFolder`
skriver ändrade datamängder och rensar borttagna, `loadFromFolder` läser in det som saknas och `setAutoSave`
prenumererar på datamängdshändelser med fördröjd sparning. Mappåtkomsten (File System Access: välja mapp, minnas
handtaget i IndexedDB, fråga om lov igen efter omstart, läsa, skriva, lista, ta bort) ligger i
`src/platform/storage/folder-store.js` och tar rotkatalogen som argument, så att tester kan skicka in en
minnesbaserad ersättning. `bundle` bygger ett delningspaket med samma filer för ett urval (manifestets `kind` är
`bundle`, med `author`, `message` och `changes`, plus `CHANGELOG.md`) och loggar `shared` i datamängderna;
`inspect` läser ett paket utan att ändra något och `restore` hoppar över det som redan finns, utom `replaceIds`, som
får paketets fil efter en ögonblicksbild av den egna, och loggar `received`. GitHub-synken
(`src/platform/storage/github-store.js`) skickar samma filer med GitHubs Git Data API: blobbar för filer vars
git-hash skiljer sig från repots, ett träd ovanpå det nuvarande (`sha: null` tar bort filer som inte längre finns),
en commit och en snabbspolning av grenen (422 betyder att repot ändrats sedan senaste hämtningen). Ett tomt repo får
sin första commit via contents-API:t. Hämtning läser trädet och blobbarna (`application/vnd.github.raw+json`) och går
via samma `restoreEntries`. Klienten tar emot `fetch` som argument, så testerna kör mot en låtsas-GitHub i minnet;
nyckeln lagras av `api/secrets` och skickas bara till api.github.com.

Sortering av stora tabeller använder index på begäran: första sorterade sidan i en tabell med minst
`datasets.indexing.threshold` rader (200 000) skapar `_idx_<kolumn>` i SQLite-filen, och `recipes.apply` tar
bort alla sådana index innan en åtgärd körs, eftersom typbyten bygger om kolumner med `ALTER TABLE DROP COLUMN`.

Bearbetning bygger på fyra moduler:

- `src/data/operations.js`: registret över åtgärder. Varje åtgärd har `id`, `params` (schema som dialogerna
  genereras ur), `apply(ctx, params)` som kör SQL mot `data`, `toSQL` och `toR` för receptexport och, där det
  går, `preview`. Typändringar bygger om kolumnen (ny kolumn, uppdatera, ta bort, byt namn) eftersom SQLite
  inte låter en kolumns typ ändras på plats. `edit_cell` har dessutom `inverse` för billig ångra.
  `src/data/operations-extra.js` registrerar fler åtgärder i samma register (kopiera kolumn, städa kolumnnamn,
  avrunda, fyll ut, ta bort tecken, koda om, sortera, behåll översta, slumpmässigt urval, ta bort tomma, del av
  text, datumdel, tid mellan datum, klassindela, andel av summan, rangordna, löpande summa, förändring mot
  föregående, standardisera). Beräkningar som behöver fönsterfunktioner skriver resultatet till en temporär tabell
  `__dm_calc (rid integer primary key, v)` med `rowid` som nyckel och uppdaterar sedan `data`, så att även
  miljontals rader går i en sats; avrundning, utfyllnad, datumdelar, datumskillnader och identitetsnummer är
  SQL-funktioner i SQLite-workern (`dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff`, `dm_valid_id`).
- `src/data/recipes.js`: `apply` kör en åtgärd i en savepoint, loggar steget i `_log` (action `op`),
  uppdaterar `_columns` och schemalägger sparning. Ångra-stacken håller tio steg per datamängd som
  ögonblicksbild eller omvänd åtgärd. `steps`, `replay`, `toSQL`, `toR` och `exportJson` ger recepten.
- `src/data/derive.js`: aggregering, koppling och sammanslagning till nya datamängder (den andra datamängdens
  rader kopieras till en temporär tabell eftersom sql.js inte kan ATTACH-a filer) samt kategoriklustring på
  fingeravtryck.
- `src/data/profile.js`: datakvalitetsprofil per kolumn med varningar som pekar på en åtgärd.
- `src/data/rules.js`: kvalitetsregler per datamängd (`_meta.rules`, så att de följer med filen). Varje regeltyp
  översätts till ett SQL-villkor för de rader som bryter mot regeln (`violation`), körningen räknar och tar
  exempel, loggar `validate` och kan skapa en datamängd av de felande raderna via `createFromQuery`; `suggest`
  härleder regler ur profilen och `toMarkdown` ger rapporten som dokumentbyggarna gör till HTML. Regler som
  behöver mer än ett villkor per rad förbereds asynkront i `prepare`: referensregeln kopierar den andra
  datamängdens nyckelvärden till en temporär tabell, och regeln för avvikande värden räknar ut gränserna
  (kvartiler eller medelvärde och standardavvikelse) innan villkoret ställs. Andelen ifyllda värden gäller hela
  kolumnen och avgörs av `passes` i stället för per rad.

## Import och export

Varje importformat är en adapter i `src/io/importers/` med `detect(file)`, `preview(file, options)` och
`parse(file, options)`; `src/io/import.js` väljer adapter (Excel, tabeller i dokument, kartfiler, JSON, XML,
SQLite, shapefile, R-format, fast bredd, annars CSV) med `resolveImporter`, som också läser de första 64 kB för
att känna igen TopoJSON i en .json-fil och Excel 2003 XML i en .xml-fil, rensar
kolumnnamn, härleder typer ur förhandsgranskningen (deklarerade typer från ett SQLite-schema vinner) och skapar
datamängden. Avgränsade textfiler på 64 MB eller mer (eller `options.stream`) går i stället genom `runStream`:
`csv.parseStream` låter PapaParse läsa filen bit för bit (512 kB i taget med ett uppehåll före typningen, FileReader med den upptäckta
teckenkodningen, paus/återupptagning som mottryck), varje omgång typas med `materialize` och skrivs med
`datasets.appendImportRows` till en datamängd som `datasets.createEmpty` skapat utan rader; `finishImport`
räknar rader, loggar, sparar och sänder `created` (`abortImport` kastar allt vid fel). Två adaptrar avviker: SQLite-filer som är Dataspatium-datamängder återställs via
`datasets.importBytes` med metadata och historik, och R-formaten (`r-formats.js`, `viaR: true`) saknar `parse`:
`importViaR` skriver filen till R:s filsystem, kör rätt läsfunktion (haven, pxR, nanoparquet, base R), gör
etikettkolumner till text och lämnar över med `dm_write()`, som bevarar variabeletiketter som kolumnetiketter.
PX-filer avkodas i JS enligt CODEPAGE/CHARSET och skrivs som UTF-8 innan pxR läser dem. JSON-stat upptäcks i
JSON-adaptern och tabelleras med `api/jsonstat`; SDMX-JSON 1.0 och 2.0 (datameddelanden) på samma sätt med
`api/sdmx`. Shapefile-adaptern (`shapefile.js`) läser .shp (punkt, linje,
polygon, multipunkt, med eller utan Z/M; yttre ringar medurs enligt shapefile-konventionen behålls eftersom
d3-geo förväntar sig samma riktning), .dbf (typer C, N, F, D, L; teckenkodning från .cpg eller UTF-8-prov) och
namnet i .prj, kan förenkla geometrin med Douglas-Peucker och ger samma kolumner som GeoJSON-importen
(`geometry_type`, `geometry` med GeoJSON som text).

SQLite-adaptern känner igen GeoPackage (tabellerna `gpkg_contents` och `gpkg_geometry_columns`): lagren listas som
tabeller, geometriblobbar (GPB-huvud följt av WKB, även Z/M och EWKB) tolkas till GeoJSON-text och referenssystemets
namn hämtas ur `gpkg_spatial_ref_sys`. `fixed-width.js` läser text med fasta kolumnbredder; kolumnstarter hittas ur
mellanslag som alla rader delar eller anges av användaren. `src/io/url-import.js` hämtar en webbadress som File
för guiden eller lägger till en Dataspatium-konfiguration direkt via modulen som formatfältet pekar ut.

`tables.js` hittar tabeller i dokument och erbjuder dem med namn som tabeller att välja: HTML via `DOMParser`
(närmaste rubrik eller `caption` som namn), Markdown-tabeller med avgränsningsrad, Word via `word/document.xml` i
ZIP-filen (`w:tbl`, `gridSpan` och `vMerge`) och LaTeX-miljöerna `tabular`, `tabularx`, `longtable` med flera
(`\multicolumn`, `\\` som radslut, `booktabs`-regler som rubrikmarkering). Sammanslagna celler upprepas i alla
rutor de täcker (`grid`). `geo.js` läser KML och KMZ (platsmärken med mappsökväg, tid och `ExtendedData`),
GPX (vägpunkter, rutter, spår och spårpunkter som lager, längd med haversine) och TopoJSON (deltaavkodade,
kvantiserade bågar, ett lager per objekt) och ger samma kolumner som GeoJSON-importen. Excel-adaptern lämnar de
äldre kalkylformaten till SheetJS, och SQLite-adaptern kör `.sql`-skript i en tom databas efter att ha tagit bort
MySQL-specifika rader.

Geometrihjälpen `src/data/geo.js` tolkar geometriceller (GeoJSON-objekt eller -text, Feature, WKT med Z/M och
`SRID=`-prefix), avgör om koordinater är projicerade, beräknar utbredning och räknar om mellan SWEREF 99 TM
(EPSG:3006) och WGS 84 med Lantmäteriets Gauss-Krüger-serier (`swerefToWgs84`, `wgs84ToSweref`, `toWgs84`).

Axlar och linjer i `viz/vega-builder.js`: `applyAxes` lägger byggarens gränser och val på värdeaxelns skala
(`domainMin`, `domainMax`, `type` log eller sqrt, `zero`), på X-skalan när X är ett tal, på axlarna (`labelAngle`,
`grid`) och på märket (`clip` när en gräns är satt, `opacity`). `guideLayers` ger extra lager: en streckad `rule`
med `datum` på värdeaxeln och en `text` för referenslinjen, och en `regression`- eller `loess`-transform (med
`groupby` på färgkolumnen) för trendlinjen. När det finns sådana lager flyttas kodningen in i ett eget lager så att
huvudmärket och linjerna delar skalor.

Kartorna är två diagramtyper i `viz/vega-builder.js` (`geo: true`). Koropletkartan `map`: x bär geometrikolumnen,
y etiketten och color värdet; `toSpec` tolkar geometritexten, väljer projektion (`identity` med `reflectY` för
projicerade meter; för longitud/latitud `transverseMercator` kring 15° öst inom Europa, annars `mercator`) och
ritar med `geoshape`. Punktkartan `pointmap` (`points: true`): x och y bär longitud- och latitudkolumner (meter
känns igen och räknas om till grader), size och color värden, facet etiketten och `state.basemap` en medföljande
bakgrund; specifikationen blir ett `layer` med gränserna (`geoshape`) under punkterna (`circle`).
`data/boundaries.js` läser och cachar gränserna ur `presets/geo/*.geojson` (SCB:s *Digitala gränser*, CC0,
omräknade till WGS 84 av `tools/build_boundaries.py`, och de danska, norska och finska från
`tools/build_nordic_boundaries.py`); `viz/render.js` hämtar dem före `toSpec` när
`builder.basemapOf(state)` pekar ut en, och geodataåtgärderna i Bearbeta använder dem för uppslag av kommun
och län. Geodataåtgärderna (`geo_centroid`, `geo_area`, `geo_reproject` och `geo_region` i
`data/operations.js`) är vanliga receptsteg som kör SQL mot funktionerna `dm_geo_lon`, `dm_geo_lat`,
`dm_geo_area`, `dm_to_lon`/`dm_to_lat`/`dm_to_east`/`dm_to_north` och `dm_region` i `sqlite-worker.js`;
workern har egna kopior av WKT-tolkningen och Gauss-Krüger-formlerna (den kan inte läsa `data/geo`), och
gränspolygonerna skickas till den med meddelandet `regions` och slås upp med bbox-filter och ray casting. Samma filer är förinställningar i Inhämta (`format: 'geojson'` i
`presets/presets.js`, importerade via JSON-importerarens FeatureCollection-väg). Kartor aggregeras aldrig i SQL.

Exporten (`src/io/export.js`) har CSV, xlsx och ods (SheetJS), JSON, GeoJSON (geometrikolumnen hittas på namn
eller genom att första värdet tolkas; övriga kolumner blir egenskaper), XML, SQLite samt R-formaten Parquet, sav,
dta och rds: `toViaR` speglar datamängden till R, kör skrivfunktionen och läser tillbaka filen via
`r-bridge` (`writeFile`, `readFile`, `mkdir`, `removeFile`).

Access-filer (`io/importers/access.js`) läses med mdb-reader, som levereras som en modulgraf från esm.sh (se
utveckling.md) och importeras med `Dataspatium.assets.importGraph('mdb-reader')`; Buffer-polyfillen tas ur samma
graf. Länkade filer (`data/linked`, Chromium) sparar filhandtaget från `showOpenFilePicker` i minnet och i
inställningslagret (`linked:<id>`); datamängdens `source` får `linked: true`, och `api/runner.refreshDataset` läser
filen igen via `io/import.parse` med de sparade importinställningarna innan receptet spelas upp.

## API-modul

`src/api/` hämtar data från öppna API:er direkt i webbläsaren (se [api-konfiguration.md](api-konfiguration.md)):

- `schema.js`: formatet `dataspatium-api/1` som JSON-schema-liknande objekt och en validerare med svenska fel.
- `connectors.js`: register över förinställningar (inbäddade `presets/api/*.api.json` via `tools/wrap_local.py`)
  och användarens egna konfigurationer (inställningen `api:connectors`), import och export.
- `secrets.js`: nycklar i minnet för sessionen eller krypterade (PBKDF2, AES-GCM) under `api:secret:<id>`,
  med en gemensam lösenfras som verifieras mot `api:secretcheck`.
- `http.js`: `fetch` med hastighetsbegränsning per konfiguration, timeout, omförsök vid 429 och 503, valfri
  proxy och felmeddelanden som förklarar CORS och statuskoder.
- `auth.js`: API-nyckel i header eller fråga, Basic, Bearer och OAuth2 client credentials med tokencache.
- `request.js`, `pagination.js`, `parsers.js`, `jsonstat.js`: bygger anrop ur parameterscheman, bläddrar
  sidor (sida, offset, nästa-URL, cursor, Link-header, länklistor) och tolkar JSON, JSON-stat 2, SDMX-JSON
  (`sdmx.js`), CSV, GeoJSON, XML och dataportalens EntryScape-svar till tabeller. GET-anrop försöks igen även
  vid 500, 502 och 504.
- `runner.js`: kör en endpoint sida för sida till en tabell, skapar datamängder (`toDataset`), lägger till eller
  ersätter rader (`intoDataset` via `datasets.appendRows`), hämtar om en datamängd från källan i dess metadata
  (`refetch`) och levererar alternativ till fält med `optionsFrom`.
- `families/pxweb.js` och `families/socialstyrelsen.js`: särskilda bläddrare med egna anropsmönster (mappträd
  eller tabellsök, variabelval, uppdelning av stora urval, sidindelade resultat med id-till-text-koppling).

UI:t ligger i `src/ui/api/`: `variable-picker.js` (komponenten `dm-variable-picker`), `auth-panel.js`,
`endpoint-form.js`, `pxweb-view.js`, `sos-view.js` och `api-view.js`, som Inhämta monterar per vald källa.
Tester kör mot en låtsastjänst via virtuella `dataspatium-asset://`-adresser i nätverks-shimmen, så att ingen
nätverkstrafik behövs; `tests/index.html?live=1` kör dessutom ett röktest mot de riktiga tjänsterna.

`api/runner.refreshDataset` uppdaterar en datamängd med `source.kind === 'api'`: hämtar om källan, bygger om
tabellen `data` med samma kolumnmetadata (`datasets.rebuild`), spelar upp receptet (stegen i `_log`) utan
ångra- och loggposter och återställer filen om något steg misslyckas. `refreshAll` gör det för alla i tur och
ordning, med injicerbar hämtfunktion för tester; Inhämta (*Sparade hämtningar*), Hantera och kommandopaletten
använder dem.

Databasbryggan (`api/bridge`) talar med `tools/db-bridge.ps1` eller `tools/db_bridge.py` på 127.0.0.1: adress och
token ligger i sessionen via `api/secrets` (id `__bridge`), varje anrop kräver samtycket `databases`, lösenord hålls
i sessionen per källsignatur och hamnar aldrig i datamängdens `source` (`sanitize`). Datamängder från bryggan har
`source.kind = 'bridge'` och uppdateras av `api/runner` som API-datamängder; SQL-konsolen kan köra mot bryggans
aktuella källa. HTTP-familjerna (`api/families/databases`) bygger vanliga anslutningar av en adress: `build`,
`discover` (schemaupptäckt) och `endpoints` per familj, hemligheter till `api/secrets`; de nya svarsformaten
`graphql`, `sparql` och `influx-csv` samt `lift` finns i `api/parsers`, och `resolvePath` slår upp nycklar med
punkter hela. `api/websocket` är en generell socket-transport (samtycke, JSON-ramar, svar parade på id) för Neo4j
i 2.9.

## Visualisering

`src/viz/` ger alla diagram samma utseende och exportvägar (se [visualisera.md](visualisera.md)):

- `locale.js` och `theme.js`: svensk tal- och tidslocale samt en Vega-konfiguration och ett D3-stilobjekt som
  läses ur designtokens vid varje rendering (därför följer diagrammen ljust och mörkt tema). Färgskalorna
  `dataspatium-seq` och `dataspatium-div` registreras i Vega ur tokens.
- `data.js`: rader för diagram med filter som SQL och gruppering i SQLite när diagrammet bara behöver aggregat.
- `vega-builder.js`: diagramtyper, byggartillstånd och översättning till Vega-Lite-specifikation, inklusive beslutet
  om aggregering i SQL. `vega-render.js` laddar Vega, Vega-Lite och vega-embed från `vendor/` och renderar i DOM
  eller headless (export, batch).
- `d3-templates.js`: mallar med parameterschema som ritar SVG med D3.
- `export.js`: SVG med inbäddat typsnitt, PNG via canvas och PDF via jsPDF och svg2pdf.js (laddas vid behov).
- `charts.js`: sparade diagram i IndexedDB-tabellen `charts` och viz-filer (`dataspatium-viz/1`); `render.js`
  renderar vilket sparat diagram som helst (med `extraFilters` för dashboards och batch); `batch.js` skapar ett
  diagram per gruppvärde till en ZIP eller, med `deck`, en PowerPoint med en bild per grupp.
- `pptx.js`: PowerPoint via PptxGenJS (laddas vid behov): titelbild och en bild per diagram, renderade headless
  till PNG.
- `dashboards.js`: dashboards i IndexedDB-tabellen `dashboards` (Dexie version 5): diagram i ordning med
  kolumnbredd, gemensamma filterkolumner (`sharedColumns` är snittet av de ingående datamängdernas kolumner),
  dash-filer (`dataspatium-dash/1`) med diagramdefinitionerna inbäddade, samt export till fristående HTML och
  PowerPoint. Vyn är `src/ui/viz/dashboard-view.js`; den sparar ändringar automatiskt.

UI:t ligger i `src/ui/viz/` (byggarens kontroller, D3-formulär, R-panel, galleri, export- och batchdialog) och
monteras av läget Visualisera; Exportera återanvänder dialogerna.

## Dokument

`src/docgen/` gör dokument av mallar (se [dokumentmallar.md](dokumentmallar.md)):

- `template.js`: bygger mallens kontext ur en datamängd (formaterade rader, summor, kolumner, grupp, kodboksprofil
  via `data/profile`), löser Dataspatiums egna taggar (`{{#tabell}}`, `{{diagram}}`, `{{sidbrytning}}`) till block
  innan Mustache körs med HTML-escaping avstängd.
- `markdown.js`: ett Markdown-urval till en dokumentmodell (rubrik, stycke, lista, tabell, bild, linje,
  sidbrytning med inline-körningar för fet, kursiv, kod och länk).
- `builders.js` (HTML och DOM-förhandsgranskning, Markdown, LaTeX) och `builders-office.js` (DOCX med docx,
  PDF med jsPDF och jspdf-autotable): varje byggare escapar för sitt format.
- `documents.js`: inbyggda mallar och användarens mallar i IndexedDB-tabellen `documents`, delbara som
  `dataspatium-doc/1`-filer. `generate.js`: ett dokument i valt format, förhandsgranskning och batch per grupp till
  ZIP (LaTeX och Markdown med figurer som en mapp per grupp).

UI:t är `src/ui/docs/document-panel.js` i Exporteras flik Dokument. Arbetsytans säkerhetskopia tar med egna mallar.

Anteckningsböcker (`src/analysis/notebooks.js`, UI i `src/ui/analysis/notebook-panel.js` som tredje flik i
Analysera) lagras i IndexedDB-tabellen `notebooks` (Dexie version 6) med celler `{type, source, outputs}`.
`runCell` kör R- och Python-celler genom `data/r-bridge` respektive `data/python-bridge` (utdata, fel, diagram som PNG-dataadresser och skapade datamängder)
och SQL-celler mot bokens datamängd (SELECT via motorn, ändrande satser som receptsteget `sql`). `toAst`
översätter boken till dokumentmodellen, som fått blocktypen `code` (kod och textutdata) i alla byggare, så att
exporten återanvänder HTML-, DOCX-, PDF-, Markdown- och LaTeX-byggarna.

Reguljära uttryck är JavaScript-mönster (ECMAScript) med samma regler överallt: en inledande grupp som `(?i)` blir
flaggor och Unicode-flaggan läggs till när mönstret tillåter det. `src/data/regex-syntax.js` (utan beroenden) har
`compile`, gruppnamn, mönster ur en form i mönsterprofilen, mönsterbiblioteket och R-formen av mönster och
ersättningar (stringr/ICU, `$1` blir `\\1`). SQLite-workern har samma regler i `regex()` och funktionerna
`dm_regex_test`, `dm_regex_extract`, `dm_regex_all`, `dm_regex_count`, `dm_regex_split` och `dm_shape`.
`src/analysis/regex.js` kör mönster i en egen Blob-worker med tidsgräns (`run`), eftersom JavaScript inte kan
avbryta ett mönster som backtrackar katastrofalt; workern avslutas när tiden går ut och skapas igen vid nästa
anrop. `stats` räknar träffar över de vanligaste olika värdena, `profile` grupperar former med `dm_shape` och
`guard` prövar varje värde i en kolumn (i rowid-ordning, 5 000 åt gången) innan ett receptsteg kör samma mönster i
SQLite. Receptstegen finns i `src/data/operations-regex.js` (`regex_filter`, `regex_extract`, `regex_flag`,
`regex_count`, `regex_split`; ersättning går genom `replace_text` med `regex: true`, som också anropar `guard`).
Fliken är `src/ui/analysis/regex-panel.js` som fjärde flik i Analysera; sparade mönster är skript med språket
`regex` i IndexedDB-tabellen `scripts` och följer med i säkerhetskopior och paket som `scripts/<id>.script.json`.

## Flera flikar

`src/platform/sync.js` håller flikar i samma arbetsyta i takt: en `BroadcastChannel` (`dataspatium-sync`) bär
ändringsbesked för datamängder, diagram, dashboards, anteckningsböcker och mallar, och `withLock` serialiserar
skrivningar av samma datamängdsfil med Web Locks. Datamodulerna sänder efter `save` och `remove`; när ett besked
kommer från en annan flik stänger `data/datasets` sin minneskopia av den berörda datamängden (om fliken inte själv
har osparade ändringar; då vinner den sista sparningen) och sänder händelsen `remote`, varpå skalet läser om listan
och loggar en rad. Övriga moduler vidarebefordrar beskedet som händelsen `remote` till sina prenumeranter, som läser
om sina listor. Utan BroadcastChannel eller Web Locks fungerar allt som förut.

## UI-skal och lägen

`src/ui/shell/shell.js` bygger skelettet, äger tillståndet (`createStore`: läge, datamängder, vald datamängd,
valda datamängder för batch, sparstatus och överlämningar som `pendingCode`, `openChartId` och `pendingSearch`)
och ger varje läge samma tre ytor (vänster, mitten, höger) och samma tjänster. Ett läge är ett objekt
`{ id, activate(slots), deactivate() }` som skapas av `createMode(ctx)` i `src/ui/modes/`; de åtta lägena
registreras i `src/app.js`, och `MODES` i skalet avgör ordningen och Alt+1 till Alt+8. Läget prenumererar själv
på tillståndet medan det är aktivt. Statusraden (`footer.dm-statusbar`) visar sparstatus (datamängdernas händelser
`dirty`, `saving` och `saved`), lagring, vald datamängd, R-motorns tillstånd (`shell.setEngine`), nätverksaktivitet
(`D.net.onActivity` från net-shimmen, som räknar pågående http-anrop och för en logg över dem) och knapparna för
panelerna och loggen. Panelbredderna sätts av `dm-splitter` (komponenten i `layout.js`) via CSS-variablerna
`--dm-panel-w` och `--dm-inspector-w` och sparas i inställningarna `ui.panel.left` och `ui.panel.right`;
brytpunkterna 1099 px (inspektören som flak, `data-right="sheet"`) och 759 px (objektpanelen) hanteras med
`matchMedia` i skalet och regler i `shell.css`. Tips ritas av en enda `div#dm-tooltip` (`ui/tooltip`, installeras
av `ui/components`) ur attributet `data-tip`, som `dm-button` fyller från `title`.

Kommandopaletten (`src/ui/shell/command-palette.js`, Ctrl+K) samlar kommandon från leverantörer: skalet bidrar
med lägen, datamängder, arbetsyta, tema och hjälp, och varje läge registrerar sina egna via `ctx.palette.register`
(Bearbeta alla åtgärder på den valda datamängden, Visualisera diagram och dashboards, Exportera dataexport). Ett
kommando är `{id, label, hint, group, icon, keywords, run}`; träffar poängsätts (prefix, ordstart, delsträng,
nyckelord) och senast körda kommandon sparas i inställningen `palette:recent`.

Hjälpen i appen (`src/ui/help/help-panel.js`, modulen `ui/help`) visar handboken: dokumenten läses som textresurser
(`docs/<språk>/<fil>.md` ur `docs/help/<språk>.js`, genererade av `tools/wrap_local.py`), tolkas med
`docgen/markdown` (kodblock, bildrader och citatmarkeringar hanteras i panelen) och ritas som DOM utan innerHTML.
Rubrikerna får slugs, sökningen går över avsnittens text, och interna länkar följs i panelen medan andra öppnas på
GitHub. `help: 'dokument#avsnitt'` på `overlays.dialog.open` ger dialogen en ?-knapp; avsnittet anges med sin
svenska slug och hittas i andra språk via rubrikens position (översättningarna delar struktur). ?-knappen i skalet,
F1 och paletten öppnar kapitlet för aktivt läge (`openForMode`); paletten listar dessutom dokumenten.

Presentationsläget (`src/ui/viz/present.js`, modulen `ui/viz/present`) ritar en dashboard i ett fast lager över hela
fönstret med `viz/render.renderInto`, i stegen översikt och ett diagram i taget, med dashboardens gemensamma filter
(`dashboards.toExtraFilters`), tangentbord och `requestFullscreen` där webbläsaren tillåter det. Dashboarden ändras
inte; knappen finns i dashboardvyn och kommandot *Presentera* i paletten.

Grundkursen (`src/ui/shell/course.js`, modulen `ui/course`) är en styrenhet per skal (`shell.course`) som visar
elva steg i den flytande panelen `overlays.floating`. Varje steg har ett läge, en markerad kontroll (attributet
`data-course` i läget), en kontroll av om uppgiften är gjord och en åtgärd för *Gör det åt mig*. Kursen arbetar
bara genom vanliga API:er (`io/import`, `data/recipes`, `viz/charts`) och tillståndet: den lämnar kod till Analysera
i `pendingCode`, ett diagram till Visualisera i `openChartId` och en sökning till Söka i `pendingSearch`, och
Analysera, Exportera och Söka rapporterar `lastRun`, `lastExport` och `lastSearch`. Kontrollerna körs varje sekund och direkt när läget eller de nycklarna ändras.
Framstegen sparas i `localStorage` (`dataspatium.course`): `open` återupptas vid start, `closed` och `done` visas
inte automatiskt, och en arbetsyta utan kursnyckel får kursen öppnad (tom) eller erbjuden i en toast (befintlig).

Dialogerna i Bearbeta ligger i `src/ui/op-dialog.js` (formulär genererat ur en åtgärds parameterschema, med
förhandsgranskning) och `src/ui/dialogs.js` (palett, datakvalitet, versioner, recept, kategorier, aggregera,
koppla, lägg ihop). Tabellkomponenten `dm-table` stöder cellredigering (`editable`, händelsen
`dm-cell-commit`) och `updateData` som laddar om utan att tappa rullningsläge och markering.

## Samtycke, komponenter och språk

`platform/consent` håller samtycke per ändamål (`api`, `url`, `github`, `components`, `basemaps`, `databases`,
`neo4j`, `stun`): `require(purpose, info)` frågar via skalets dialog första gången och sparar svaret i
inställningen `consent.<ändamål>` när användaren vill; utan registrerad frågare (tester, skript) tillåts anropet
och loggas. Testsidan sätter `localStorage` `dataspatium.consent = granted`. Anropen går genom `api/http.js` (alla
adresser utom `dataspatium-asset://`), `io/url-import.js` och `platform/storage/github-store.js`.

`platform/components` hämtar delar av appen som inte följer med i mappen: en komponent har id, storlek, en eller
flera källadresser och, när den är känd, SHA-256; den begär samtycke, hämtar, kontrollerar summan, sparar binären i
IndexedDB (`component:<id>`) med metadata i inställningarna och gör den tillgänglig som resurs med
`D.assets.provide(name, kind, data)`. `engines/r/remote-packages` använder samma väg för R-paket utanför det
inbyggda urvalet: webR:s paketindex hämtas och cachas i sju dagar, beroendeslutningen räknas ut utan de inbyggda
paketen, paketens tgz-filer levereras som resurser och ett utökat `PACKAGES`-index skickas till R-workern
(`engine.shipAssets`); `r-bridge.ensureRemote(names)` körs efter `ensurePackages` innan användarkod körs.

`engines/python/catalog` använder samma komponentväg för Python: körtiden (`pyodide:<fil>`) och hjulen hämtas med
`components.ensure`, `D.assets.provide` gör dem till resurser och `engine.shipAssets` skickar dem till workern;
hjul som workern ber om själv (`asset-request`, en import som kodskanningen inte såg) hämtas av `catalog.provideFile`.
`components.ensure` tar `onProgress` och läser då svaret i delar, så att statusraden kan visa hur långt hämtningen
kommit.

Språk laddas vid behov: `boot.js` läser in svenska och det valda språket (alla sex vid första start, innan valet
gjorts) och `i18n.loadLanguage(kod)` injicerar `src/ui/i18n/<kod>.js` när användaren byter språk. Tester som
jämför alla språk anropar `loadLanguage` först.

Datamängder har `kind` i `_meta` (`table`, `graph`, `document`, `images`, `model`; `datasets.KINDS`) som
förberedelse för fler slags datamängder; 2.0 skapar bara `table`. Mapp (`folder`) och taggar (`tags`) ligger också
i `_meta` och i manifestets lista (`format: 2`). Dexie-schemat är version 7 med indexet `folder` och lagret `lists`
för sparade sökningar (`data/lists`); `analysis/search` söker med `dm_regex_test` i SQL-workern och räknar fasetter
för kolumner med få olika värden.

`analysis/querybuilder` (fliken Fråga, `ui/soka/query`) gör en frågespecifikation (`from`, `joins`, `columns` med
beräkningar, `where` i grupper, `orderBy`, `limit`) till SQL över `data t0` med de kopplade datamängderna som
`t1`, `t2` … under sina kortnamn (`compile`, `validate`, `run`, `toDataset`, `describe`); sparade frågor är listor av
slaget `query` och körs via `data/lists.run`. Listor av slaget `search` används också som `where` i Bearbetas
tabell (`datasets.count/query`) och som `listId` i diagrammens dataförfrågningar (`viz/data.fetchRows`, satt i
diagrammets Vega-tillstånd och i `viz/render`).

I serverläge (http och https) registrerar `index.html` `sw-coi.js`, som förutom cross-origin isolation cachar
appens filer (`CACHE = 'dataspatium-<version>'`; cache först för `vendor/`, `presets/`, `src/` och `r/`, nätverk
först för resten, gamla cachar tas bort vid aktivering) och gör sidan installerbar via `manifest.webmanifest`;
beständig lagring begärs när appen körs fristående. Från file:// finns inga service workers och inget av detta
används.

## Enheter, mobilsidan, granskning och djuplänkar

`platform/p2p` kopplar ihop två enheter med WebRTC-datakanaler utan signaleringsserver. Den erbjudande sidan
(datorn) visar en kompakt nyttolast (base64url-JSON): session-id, egna ICE-uppgifter (ufrag och pwd som appen
själv väljer och mungar in i SDP:n), DTLS-fingeravtryck, värdkandidater (mDNS-namn) och, för en ny enhet, en
engångshemlighet. Den svarande sidan bygger en fullständig SDP ur en mall (`buildSdp`), härleder sina ICE-uppgifter
ur hemligheten och session-id (HMAC-SHA-256, `deriveCredentials`) och svarar. Den erbjudande sidan sätter ett
syntetiskt svar utan kandidater (fingeravtryck + härledda uppgifter) och hittar motparten via peer-reflexiva
kandidater; för en ny enhet måste bara fingeravtrycket färdas tillbaka (52 tecken base32 eller QR). Parade enheter
(`p2p.peers`, inställning `p2p.peers`) delar en hemlighet som sänts över den krypterade kanalen; certifikatet
(`p2p.certificate`, ett år) ligger i IndexedDB. Protokollet över kanalen: `hello`, `offer` med objekt (namn,
storlek, SHA-256, slag), `accept` med redan mottagna byte per objekt (återupptagning ur `partials`), `begin`,
binära block om 16 KiB med mottryck (`bufferedamountlow`), `end`, `done` (kontrollsumma), `paired`, `bye`.
Kontrollkoden är sex siffror ur SHA-256 av båda fingeravtrycken och session-id.

`ui/share/devices` är fliken Enheter i Dela (QR via `ui/qr` på qrcode-generator, kod för en annan dator,
anslutning med svarskod, kontrollkod, parning, skicka paket eller filer, mottagningsdialog, förlopp) och
`mobile/app` är Dataspatium Mobil: `m/index.html` sätter `DATASPATIUM_PROFILE = 'mobile'` så att `src/boot.js`
laddar den korta listan `MOBILE` (plattform, SQLite, komponenter, p2p, qr, mobilappen; 35 skript). Mobilsidan
lagrar mottagna filer som blobbar (`mbundle:<id>`) med en lista i inställningen `mobile.bundles`, läser paketens
`manifest.json` med fflate och öppnar datamängder för visning med en egen `SqliteEngine` (`_columns`, `data`,
sidor om 50 rader). Web Share Target: `m/manifest.webmanifest` anmäler `./share`, `sw-coi.js` tar emot POST:en,
parkerar filerna i cachen `dataspatium-inbox` och skickar sidan till `m/?inbox=1`, där `drainInbox()` hämtar dem.
Datorns QR-kod pekar på `p2p.mobileUrl()`: Pages-adressen från file://, annars `m/` på samma värd (inställningen
`p2p.mobileUrl` kan peka på en intranätkopia).

`ui/share/review` är granskningen före delning: `rules.suggest()` ger identitetsnummer- och e-postkolumner, ett
namnmönster telefonnummer; dialogen ger per kolumn behåll, pseudonymisera eller ta bort, och
`datasets.exportBytesTransformed(id, {hash, drop, salt})` tillämpar valen på en kopia av filen (dm_hash i en
tillfällig motor, `alter table drop column`, `_columns` uppdateras). `workspace.collect()` tar `transform` per
datamängd och skriver `review` i manifestets datamängdspost.

Djuplänkar: `shell.parseRoute()` läser `#/<läge>/<objekt>`, `openRoute()` väljer datamängd (kortnamn, id eller
namn), öppnar ett diagram (`openChartId`) eller lämnar en sökning (`pendingSearch`), och `shell.link(mode,
object)` bygger adressen; paletten har *Kopiera länk hit*.

## Tester

`tests/index.html` kör enhetstester i webbläsaren och skriver `DATASPATIUM-LOG`-rader; `tools/run-tests.ps1` kör
sidan headless i Edge och Firefox. `spike.html` innehåller den tekniska spiken från fas 0 som också kan köras
headless (`-Url "spike.html?autorun=1"`). `tests/a11y.js` är en egen tillgänglighetskontroll (tillgängliga namn,
unika id och giltiga ARIA-referenser, roller, dialognamn, kontrast) som `tests/a11y.test.js` kör i alla lägen och
`tests/flows.test.js` i varje dialog som klicktesterna öppnar. `tests/perf.html` mäter tider och blockering av
huvudtråden med en miljon rader (se [utveckling.md](utveckling.md)).
