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

Samma kod fungerar oförändrad från en vanlig webbserver.

## Lager

```
UI               src/ui: design (tokens, tema, typsnitt, ikoner), components (dm-*), shell, modes, i18n
Tjänster         src/data (datamängder, typer, kodning, arbetsyta), src/io (importers, exporters)
Motorer          src/engines/sqlite (sql.js i worker), src/engines/r (WebR)
Plattform        src/platform: registry, assets, net-shim, workers + worker-shim, capabilities, storage
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
  kontrollmeddelanden och besvarar dem med resurser från en "provider" per namnrymd (`webr`, `sqljs`).

## Motorer

- SQLite: sql.js (SQLite i WebAssembly) i en worker. `SqliteEngine` är klienten med `open`, `exec`, `run`,
  `insertRows` (förberedd sats i en transaktion), `updateRows`, `execMany` (flera satser i en savepoint) och
  `export`. En instans per öppen datamängd. Workern registrerar egna SQL-funktioner (`regexp`,
  `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`, `dm_title`, `dm_squish`,
  `dm_fingerprint` med flera) och registrerar dem på nytt efter `export`, eftersom sql.js då öppnar
  anslutningen igen.
- R: WebR 0.5.9 (R 4.5.1) med PostMessage-kanalen. Eftersom basadressen `dataspatium-asset://webr/` har ett annat
  ursprung hämtar WebR sin worker-kod med XMLHttpRequest och skapar en Blob-worker av svaret; vårt nätverks-shim
  svarar med "worker-shim + webr-worker.js". Paketrepot är inbäddat under `webr-repo/` och installeras med
  `webr::install()`. R och JS delar data genom SQLite-filer i WebR:s virtuella filsystem (RSQLite).

## Datamodell

En datamängd är en SQLite-fil med tabellerna `data`, `_columns`, `_meta` och `_log` (se [format.md](format.md)).
Filen lagras i IndexedDB i bitar om 8 MB (`src/platform/storage/idb-store.js`), tillsammans med en metadatapost.
`src/data/datasets.js` är den enda vägen till datamängderna: skapa, lista, fråga (sidvis med sortering och
filter), statistik, logg, spara, byt namn, ta bort, exportera bytes, importera bytes, versioner
(ögonblicksbilder som egna blobbar i IndexedDB) och `createFromQuery` för härledda datamängder. Arbetsytan kan
säkerhetskopieras som ZIP och, i Chromium, speglas till en portabel mapp (`src/data/workspace.js`): `collect`
samlar manifest, datamängder, diagram och mallar som sökväg-till-bytes, `backup` zippar dem, `saveToFolder`
skriver ändrade datamängder och rensar borttagna, `loadFromFolder` läser in det som saknas och `setAutoSave`
prenumererar på datamängdshändelser med fördröjd sparning. Mappåtkomsten (File System Access: välja mapp, minnas
handtaget i IndexedDB, fråga om lov igen efter omstart, läsa, skriva, lista, ta bort) ligger i
`src/platform/storage/folder-store.js` och tar rotkatalogen som argument, så att tester kan skicka in en
minnesbaserad ersättning. `bundle` bygger ett delningspaket med samma filer för ett urval (manifestets `kind` är
`bundle`), och `restore` hoppar över det som redan finns när ett paket läses in.

Sortering av stora tabeller använder index på begäran: första sorterade sidan i en tabell med minst
`datasets.indexing.threshold` rader (200 000) skapar `_idx_<kolumn>` i SQLite-filen, och `recipes.apply` tar
bort alla sådana index innan en åtgärd körs, eftersom typbyten bygger om kolumner med `ALTER TABLE DROP COLUMN`.

Bearbetning bygger på fyra moduler:

- `src/data/operations.js`: registret över åtgärder. Varje åtgärd har `id`, `params` (schema som dialogerna
  genereras ur), `apply(ctx, params)` som kör SQL mot `data`, `toSQL` och `toR` för receptexport och, där det
  går, `preview`. Typändringar bygger om kolumnen (ny kolumn, uppdatera, ta bort, byt namn) eftersom SQLite
  inte låter en kolumns typ ändras på plats. `edit_cell` har dessutom `inverse` för billig ångra.
- `src/data/recipes.js`: `apply` kör en åtgärd i en savepoint, loggar steget i `_log` (action `op`),
  uppdaterar `_columns` och schemalägger sparning. Ångra-stacken håller tio steg per datamängd som
  ögonblicksbild eller omvänd åtgärd. `steps`, `replay`, `toSQL`, `toR` och `exportJson` ger recepten.
- `src/data/derive.js`: aggregering, koppling och sammanslagning till nya datamängder (den andra datamängdens
  rader kopieras till en temporär tabell eftersom sql.js inte kan ATTACH-a filer) samt kategoriklustring på
  fingeravtryck.
- `src/data/profile.js`: datakvalitetsprofil per kolumn med varningar som pekar på en åtgärd.

## Import och export

Varje importformat är en adapter i `src/io/importers/` med `detect(file)`, `preview(file, options)` och
`parse(file, options)`; `src/io/import.js` väljer adapter (Excel, JSON, XML, SQLite, R-format, annars CSV), rensar
kolumnnamn, härleder typer ur förhandsgranskningen (deklarerade typer från ett SQLite-schema vinner) och skapar
datamängden. Två adaptrar avviker: SQLite-filer som är Dataspatium-datamängder återställs via
`datasets.importBytes` med metadata och historik, och R-formaten (`r-formats.js`, `viaR: true`) saknar `parse`:
`importViaR` skriver filen till R:s filsystem, kör rätt läsfunktion (haven, pxR, nanoparquet, base R), gör
etikettkolumner till text och lämnar över med `dm_write()`, som bevarar variabeletiketter som kolumnetiketter.
PX-filer avkodas i JS enligt CODEPAGE/CHARSET och skrivs som UTF-8 innan pxR läser dem. JSON-stat upptäcks i
JSON-adaptern och tabelleras med `api/jsonstat`.

Exporten (`src/io/export.js`) har CSV, xlsx och ods (SheetJS), JSON, XML, SQLite samt R-formaten Parquet, sav,
dta och rds: `toViaR` speglar datamängden till R, kör skrivfunktionen och läser tillbaka filen via
`r-bridge` (`writeFile`, `readFile`, `mkdir`, `removeFile`).

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
  sidor (sida, offset, nästa-URL, cursor, Link-header, länklistor) och tolkar JSON, JSON-stat 2, CSV, GeoJSON,
  XML och dataportalens EntryScape-svar till tabeller.
- `runner.js`: kör en endpoint sida för sida till en tabell, skapar datamängder (`toDataset`), lägger till eller
  ersätter rader (`intoDataset` via `datasets.appendRows`), hämtar om en datamängd från källan i dess metadata
  (`refetch`) och levererar alternativ till fält med `optionsFrom`.
- `families/pxweb.js` och `families/socialstyrelsen.js`: särskilda bläddrare med egna anropsmönster (mappträd
  eller tabellsök, variabelval, uppdelning av stora urval, sidindelade resultat med id-till-text-koppling).

UI:t ligger i `src/ui/api/`: `variable-picker.js` (komponenten `dm-variable-picker`), `auth-panel.js`,
`endpoint-form.js`, `pxweb-view.js`, `sos-view.js` och `api-view.js`, som Inhämta monterar per vald källa.
Tester kör mot en låtsastjänst via virtuella `dataspatium-asset://`-adresser i nätverks-shimmen, så att ingen
nätverkstrafik behövs; `tests/index.html?live=1` kör dessutom ett röktest mot de riktiga tjänsterna.

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
`runCell` kör R-celler genom `data/r-bridge` (utdata, fel, diagram som PNG-dataadresser och skapade datamängder)
och SQL-celler mot bokens datamängd (SELECT via motorn, ändrande satser som receptsteget `sql`). `toAst`
översätter boken till dokumentmodellen, som fått blocktypen `code` (kod och textutdata) i alla byggare, så att
exporten återanvänder HTML-, DOCX-, PDF-, Markdown- och LaTeX-byggarna.

## UI-skal och lägen

`src/ui/shell/shell.js` bygger skelettet, äger tillståndet (`createStore`: läge, datamängder, vald datamängd,
sparstatus) och ger varje läge samma tre ytor (vänster, mitten, höger) och samma tjänster. Ett läge är ett objekt
`{ id, activate(slots), deactivate() }` som skapas av `createMode(ctx)` i `src/ui/modes/`. Läget prenumererar
själv på tillståndet medan det är aktivt. Skalet lyssnar på datamängdernas händelser `dirty`, `saving` och
`saved` och visar sparstatusen i övre raden.

Kommandopaletten (`src/ui/shell/command-palette.js`, Ctrl+K) samlar kommandon från leverantörer: skalet bidrar
med lägen, datamängder, arbetsyta, tema och hjälp, och varje läge registrerar sina egna via `ctx.palette.register`
(Bearbeta alla åtgärder på den valda datamängden, Visualisera diagram och dashboards, Exportera dataexport). Ett
kommando är `{id, label, hint, group, icon, keywords, run}`; träffar poängsätts (prefix, ordstart, delsträng,
nyckelord) och senast körda kommandon sparas i inställningen `palette:recent`.

Dialogerna i Bearbeta ligger i `src/ui/op-dialog.js` (formulär genererat ur en åtgärds parameterschema, med
förhandsgranskning) och `src/ui/dialogs.js` (palett, datakvalitet, versioner, recept, kategorier, aggregera,
koppla, lägg ihop). Tabellkomponenten `dm-table` stöder cellredigering (`editable`, händelsen
`dm-cell-commit`) och `updateData` som laddar om utan att tappa rullningsläge och markering.

## Tester

`tests/index.html` kör enhetstester i webbläsaren och skriver `DATASPATIUM-LOG`-rader; `tools/run-tests.ps1` kör
sidan headless i Edge och Firefox. `spike.html` innehåller den tekniska spiken från fas 0 som också kan köras
headless (`-Url "spike.html?autorun=1"`).
