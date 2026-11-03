# Fas 0 inför Dataspatium 2: spikar och resultat

Spikarna avgör det som inte går att bedöma från skrivbordet innan 2.0 påbörjas. Alla kördes 2026-11-03 headless i
Edge 156 och Firefox 159 från file:// på en Windows 11-dator, om inget annat anges. Sondfilerna ligger utanför repot;
det som behövs i appen byggs om ordentligt i respektive fas.

## Resultat

| Nr | Spik | Resultat | Beslut |
|---|---|---|---|
| 1 | WebRTC mellan riktiga enheter (Android, iPhone, andra datorer) | Väntar på enheter. Loopback från file:// fungerar i båda webbläsarna med mDNS-kandidater; "en skanning" efter parning verifierad (Edge 5 ms, Firefox 3,1 s) | Testsida för enheter publiceras i fas 2 och körs på Martins Android-telefon och -surfplatta |
| 2 | Android med en HTML-fil där allt är inbäddat | Väntar på enhet | Reservväg, inte huvudväg |
| 3 | GitHub Pages vid repots rot | Påslaget 2026-11-03 (`https://marwiss.github.io/Dataspatium/`). Hela testsviten (195 tester) grön i Edge från Pages över https, inklusive avbrott av R via SharedArrayBuffer | Pages vid roten är värd för serverläget och mobilsidan; installation och delning på telefon testas i fas 2 |
| 4 | Komponenter vid behov | Wrapper (1,7 MB) hämtad från `raw.githubusercontent.com` på 0,4–0,7 s, SHA-256 lika med manifestets, manipulerad byte upptäckt, IndexedDB-rundtur 24–33 ms, webR-repot (`PACKAGES` 5,3 MB, paket) nåbart med CORS | Går. Källor pinnas till appens version, jsDelivr som reserv |
| 5 | Pyodide i shimmad Blob-worker under file:// | Går i båda webbläsarna: klar 1,3–1,8 s efter resursöverföring (30 MB), numpy+pandas+matplotlib på 0,9 s, Python 3.14.2, `sqlite3` 3.39 i standardbiblioteket, SVG via Agg, SQLite-fil fram och tillbaka via Emscriptens FS | Går. Pyodide 314 laddar limfilen `pyodide.asm.mjs` med `import()` och vägrar klassiska workers; laddaren byter vid körning ut `import()`-anropet mot shimmen, gör limfilen till klassiskt skript (tar bort `export default`, ersätter `import.meta.url`) och tar bort spärren. Inga filer i leveransen ändras |
| 6 | Modulgrafladdare för ES-moduler med beroenden | mdb-reader från esm.sh: 135 moduler (934 kB) importerade på 91–151 ms; Access-filen (.accdb) läses med rätt typer. Import map fungerar i Edge men Firefox tillåter bara en import map per sida, och specifierare som börjar med `/` kan inte lösas mot en blob-bas | Går, utan import map: importerna skrivs om till blob-URL:er i topologisk ordning; `tools/fetch_vendor.py` hämtar grafen (följer även relativa importer; filnamn måste vara injektiva) och vägrar cykliska grafer |
| 7 | web-ifc under file:// | ES-modulen (5,8 MB) via Blob-import, wasm via `Init(locateFile)`: initiering 30 ms, AC20-FZK-Haus.ifc (2,5 MB, IFC4) öppnad på 40–50 ms, 83 meshar och 21 722 trianglar på 220–280 ms, egenskapsuppsättningar hämtade | Går. I appen körs web-ifc i en worker via shimmen |
| 8 | Cytoscape med 10 000 element, expand-collapse, sigma | Init 1,7–2,5 s, fcose (utkast, 500 iterationer) 4–6 s, fäll ihop alla 50 grupper 4,5–7 s, fäll ut en grupp 0,1–0,3 s, PNG 0,5–0,8 s, redigering 1 ms. sigma med 100 000 noder hängde i headless mjukvaru-WebGL | Cytoscape håller för vyer upp till 5 000–10 000 element. Översikten byggs som en egen förminskad graf (gruppnoder och viktade kanter beräknade i worker), inte med expand-collapse över hela grafen; expand-collapse används för enskilda grupper. sigma verifieras på riktig GPU senare |
| 9 | Databasbryggan | `HttpListener` på 127.0.0.1 fungerar utan administratörsrättigheter; Access (.accdb via ACE OLE DB, 64-bitars drivrutiner med Office x64) listas och frågas med typer från både curl och en file://-sida i Edge och Firefox (CORS med `Origin: null`, token, 401 utan token, 403 för UPDATE i skrivskyddat läge). SQL Server LocalDB saknas på testdatorn | Går. Skrivning kräver `-AllowWrite` och godkännande per sats i appen |
| 10 | Layoutprototyp med statusrad och brytpunkter | 1366×768: åtta lägen med text, statusrad och logg nederst, tre kolumner. 1024×768: ikoner i lägesväxlaren, inspektören som ark. 768×1024: båda panelerna som ark, statusraden visar färre poster. Inga nya tokens | Går. Skelettet i 2.0 byggs enligt prototypen |

## Mätningar att komma ihåg

- Ett Pyodide-paket laddas av `loadPackage` via shimmad `fetch`, så alla hjul som kan behövas måste finnas i
  resurskartan eller levereras via `asset-request`; Pyodides beroendeupplösning (`pyodide-lock.json`) ger 14 hjul för
  numpy, pandas och matplotlib (cirka 30 MB).
- `python_stdlib.zip` innehåller `sqlite3`; C-delen ligger i körtiden (verifierat genom att `sqlite3.connect` fungerar).
- esm.sh-grafer innehåller stubbar för versionsintervall (`^`, `~`) som pekar på samma fil; vendringsverktyget måste
  ge varje specifierare ett eget filnamn.
- Cytoscape-tillägget cytoscape-svg är GPL-3.0 och används inte; PNG kommer från Cytoscape självt.
- Bryggans `tables`-svar måste tvingas till en array i PowerShell (`@(...)`), annars blir ett enda tabellnamn en sträng.

## Kvar att göra med enheter

1. Android-telefon och -surfplatta mot en testsida på Pages: WebRTC mot datorn på samma Wi-Fi och via surfdelning,
   parning, 50 MB överförda; installation på hemskärmen; delningsmenyn med ZIP.
2. Android med `dataspatium-mobil.html` med allt inbäddat, öppnad från Hämtade filer.
3. iPhone när det passar: samma som punkt 1.

Testsidan publiceras i fas 2 tillsammans med mobilsidan, så att samma kod används för testet och för funktionen.
