# Fas 0: teknisk spik, resultat

Datum: 2 november 2026. Syfte: bevisa att hela kedjan fungerar när `index.html` öppnas direkt via file:// i Edge och
Firefox, utan server, innan appen byggs.

## Resultat

Alla tretton kontroller i spiksidan (`index.html?autorun=1`) är gröna i både Edge 156 och Firefox 159.

| Kontroll | Edge | Firefox | Kommentar |
|---|---|---|---|
| Förmågor | file:, säker kontext, IndexedDB | file:, säker kontext, IndexedDB, OPFS | Ingen SharedArrayBuffer i någon av dem |
| Resursavkodning | sql-wasm.wasm 685 kB på 35 ms | 12 ms | base64 + gzip via `Uint8Array.fromBase64` och `DecompressionStream` |
| SQLite i worker | 3.54.0, export + återöppning, IndexedDB-rundtur | samma | sql.js med `wasmBinary`, ingen fetch |
| D3, Vega-Lite, docx, CodeMirror | laddas och renderar | samma | UMD via `<script>`; CodeMirror som ESM-text via Blob-import |
| R startar | R 4.5.1 på 1,4 s | 2,2 s | WebR via PostMessage-kanal, hela runtimen ur inbäddade filer |
| `plot(1:10)` | bild 840×840 | samma | canvas-enheten skickar bitmap till sidan |
| ggplot2 | installation 0,5 s, bild | 0,7 s | paket ur lokalt repo, mountas som filsystemsavbild |
| svglite | SVG 9,8 kB | samma | vektorexport |
| pdf() | PDF 4,9 kB | samma | |
| RSQLite | läser SQLite-filen som JS skapade | samma | samma fil delas mellan sql.js och R |

Enhetstesterna (`tests/index.html`) är gröna i båda webbläsarna: modulregister, avkodning, nätverks-shim, worker-shim
(importScripts, fetch, synkron XHR, HEAD, Range, saknade resurser, meddelandekö), SQLite och R.

## Beslut som spiken ledde till

1. **WebR pinnas till 0.5.9 (R 4.5.1), inte 0.6.0.** Med webR 0.6.0 och paketrepot för R 4.6 går det inte att ladda
   RSQLite, nanoparquet, jsonlite och fastmap (`could not load dynamic lib … TypeError: Cannot read properties of
   undefined (reading 'value')`). Felet reproducerades mot webR:s officiella CDN och repo, så det ligger uppströms
   (jämför r-wasm/webr nr 621 och 633). Med 0.5.9 och repot för R 4.5 fungerar allt. Bytet görs i
   `vendor/vendor.json` när 0.6-serien stabiliserats.
2. **WebR:s webbläsarbygge är `dist/webr.js` i npm-paketet**, inte `dist/webr.mjs` (som börjar med Node-importer).
   Filen är identisk med `webr.mjs` på webR:s CDN.
3. **WebR behöver inte ändras.** Eftersom basadressen `dataspatium-asset://webr/` har ett annat ursprung hämtar WebR sin
   worker-kod med XMLHttpRequest och skapar en Blob-worker av svaret. Vårt XHR-shim på huvudtråden svarar med
   "worker-shim + webr-worker.js", och den globala `Worker`-underklassen skickar alla `webr/*`- och
   `webr-repo/*`-resurser till workern innan WebR:s init-meddelande släpps fram.
4. **R:s `available.packages()` provar `PACKAGES.rds` och `PACKAGES.gz` före `PACKAGES`.** Shimmet svarar 404 på de två
   första, vilket ger två harmlösa varningar i R-konsolen. Åtgärd i fas 2: leverera `PACKAGES.gz` och tysta varningen i
   `webr::install`-anropet.

## Så kör du spiken

- Dubbelklicka på `index.html` och tryck "Kör alla kontroller", eller öppna `index.html?autorun=1`.
- Headless i båda webbläsarna: `powershell -File tools/run-tests.ps1 -Url "index.html?autorun=1" -TimeoutSec 480`.
- Enhetstester: `powershell -File tools/run-tests.ps1`.

## Mått att komma ihåg

- `vendor/` är 98 MB (WebR 51 MB, R-paket 36 MB, övrigt 11 MB). Alla binärer ligger inbäddade som JavaScript.
- Första start av R från kalla filer: 1,4 s (Edge) och 2,2 s (Firefox) på utvecklingsdatorn.
- Hela spiken, inklusive ggplot2, svglite, pdf och RSQLite: ca 7 s (Edge) och 8 s (Firefox).
