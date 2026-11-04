# Utveckling

Den här sidan beskriver hur man arbetar med Dataspatiums kodbas. Arkitekturen beskrivs i [arkitektur.md](arkitektur.md),
utseendet i [stilguide.md](stilguide.md) och resultatet av den tekniska spiken i [fas0-spik.md](fas0-spik.md).

## Förutsättningar
- Edge eller Chrome och Firefox för tester.
- Python 3 (standardbiblioteket räcker) för underhållsverktygen i `tools/`.
- PowerShell för testköraren. Inget node.js, inget byggsteg.

## Köra appen
Öppna `index.html` direkt i webbläsaren (file://). Allt ska fungera där. Vid behov går det också att serva mappen med
`python -m http.server 8080` och öppna `http://localhost:8080/`. Då registrerar `src/boot.js` service workern
`sw-coi.js`, som lägger till COOP- och COEP-huvuden så att sidan blir cross-origin isolated (sidan laddas om en gång
när den tar över). R använder då webR:s SharedArrayBuffer-kanal och kan avbrytas. Testerna körs på samma sätt med
`powershell -File tools/run-tests.ps1 -Url http://localhost:8080/tests/index.html`; testet för avbrott i
`tests/r.test.js` gör sin kontroll bara där.

## Tredjepartskomponenter
1. Lägg till eller ändra posten i `vendor/vendor.json` (pinnad version, licens, filer, inbäddningssätt).
2. `python tools/fetch_vendor.py` hämtar originalen till `vendor-src/` (git-ignorerad) och kopierar direkt laddbara
   filer och LICENSE till `vendor/<lib>/`.
3. `python tools/wrap_assets.py` skriver inbäddade JavaScript-wrappers, `vendor/manifest.js` och
   `THIRD_PARTY_LICENSES.md`.
ES-moduler med egna beroenden (mdb-reader) hämtas som en **modulgraf** från esm.sh: posten i `vendor.json` har
`"type": "esm-graph"` och `entry` (esm.sh-sökvägen till huvudmodulen). `fetch_vendor.py` följer importerna, sparar
varje modul som textresurs under `vendor-src/<lib>/graph/`, lägger ihop rena vidareexporter (barrels), gör om en
moduls import av sina egna exporter till lokala alias (instruktioner i `graph/index.json`; texterna lämnas orörda),
vägrar cykliska grafer och hämtar varje pakets LICENSE från jsDelivr (`LICENSE-<paket>.txt`, med i
`THIRD_PARTY_LICENSES.md`). `wrap_assets.py` buntar grafen till `vendor/<lib>/graph.bundle.js`, och
`Dataspatium.assets.importGraph('<lib>')` skapar blob-URL:er i beroendeordning utan import maps, i både Edge och
Firefox under file://.

Databasbryggan (`tools/db-bridge.ps1`, `tools/db_bridge.py`) ingår inte i testsviten, som kör klienten mot en
inbyggd låtsasbrygga (`tests/bridge.test.js`). Prova den riktiga bryggan med curl: starta den med fast port och
token, anropa `/`, `/tables` och `/rows` med `Authorization: Bearer <token>` och `Origin: null`, och kontrollera att
`/query` med en UPDATE ger 403 utan skrivning tillåten. PowerShell-skriptet sparas med UTF-8 BOM så att PowerShell
5.1 läser de svenska texterna rätt.

Resurser nås i koden som `dataspatium-asset://<lib>/<sökväg>`, t.ex. `dataspatium-asset://webr/R.wasm`, både på huvudtråden
och i workers. Se `src/platform/assets.js`, `net-shim.js` och `worker-shim.js`.

Python levereras inte i ZIP:en. `src/engines/python/catalog.js` pinnar Pyodide-versionen och SHA-256 för körtidens
fem filer; hjulen kontrolleras mot `pyodide-lock.json`. Vid uppgradering: kör `python tools/pyodide_catalog.py
<version>` (hämtar filerna från jsDelivr och skriver RUNTIME-blocket), klistra in blocket i `catalog.js`, kontrollera
att laddarens tre textändringar i `src/engines/python/python-engine.js` fortfarande hittar sina ställen i
`pyodide.js` och `pyodide.asm.mjs` (workern kastar annars ett tydligt fel), och kör testsviten med `?python=1`.

## Egna inbäddade filer

R-hjälpfunktionerna i `r/dataspatium.R`, Python-hjälpfunktionerna i `python/dataspatium.py`, exempeldata i `presets/exempeldata/` och gränserna i `presets/geo/`
måste också bäddas in som JavaScript för att kunna läsas via file://. Kör `python tools/wrap_local.py` efter
ändringar; den skriver `<fil>.js` bredvid originalet och `presets/local-assets.js`. Samma skript bäddar in handboken
för hjälpen i appen (`ui/help`): användardokumenten i `HELP_DOCS` (svenska i `docs/`, övriga språk i
`docs/<språk>/`) skrivs som `docs/help/<språk>.js` och registreras som resurserna `docs/<språk>/<fil>.md`. Ett nytt
användardokument läggs till i `HELP_DOCS` i `tools/wrap_local.py` och i `DOCS` i `src/ui/help/help-panel.js`, i
samma ordning, och skrivs på alla sex språk; kör skriptet igen efter varje ändring i docs/.

Kommun- och länsgränserna byggs av `python tools/build_boundaries.py [arkiv.zip]` ur SCB:s *Digitala gränser*
(shapefiler i SWEREF 99 TM, CC0): skriptet läser shapefilerna med standardbiblioteket, räknar om koordinaterna
till WGS 84 med Lantmäteriets Gauss-Krüger-formler och skriver `presets/geo/lan.geojson`,
`presets/geo/kommuner.geojson` och `presets/geo/KALLA.md`. Utan argument hämtas det aktuella arkivet från SCB.

Gränserna för Danmark, Norge och Finland byggs av `python tools/build_nordic_boundaries.py [dk] [no] [fi]`
(standardbiblioteket): DAGI 1:500 000 från en kopia på GitHub (Dataforsyningen kräver numera inloggning),
Kartverkets N1000 via Geonorges nedladdnings-API och Statistikcentralens WFS. De norska kommunerna klipps längs
kusten i en plan graf, och gemensamma gränser förenklas en gång per båge så att grannytor inte får glipor.
Nedladdningarna sparas i `--cache`; `SETTINGS` i skriptet styr toleransen och minsta ö. Källorna står i
`presets/geo/KALLA.md` (avsnittet om Sverige skrivs om av `build_boundaries.py`, de andra lämnas orörda).
Kör sedan `python tools/wrap_local.py`.

## Språk och översättningar

Alla texter i gränssnittet hämtas med `t('nyckel')` (`Dataspatium.t` utanför UI-lagret) ur ordböckerna i
`src/ui/i18n/`: `sv.js` är grundspråket och `da.js`, `nb.js`, `fi.js`, `is.js` och `en.js` har exakt samma
nycklar. Saknas en nyckel i det valda språket används den svenska texten; saknas den helt visas nyckeln och en
rad loggas. Platshållare skrivs `{namn}`. Testet `tests/i18n.test.js` kontrollerar att alla sex ordböcker har
samma nycklar, att inga texter är tomma och att platshållarna stämmer, så en ny text läggs till i alla sex filer
på en gång.

- Språkvalet sparas i `localStorage` under `dataspatium.lang`. Första starten (ingen sparad nyckel) visar
  språkvalet innan något annat; `index.html?lang=en` väljer och sparar ett språk, vilket skärmbildsverktyget
  och testerna använder (`tests/index.html` låser svenska eftersom testerna kontrollerar svenska texter).
- Vid start laddas bara `sv.js` och det valda språket (`chosenLanguages()` i `src/boot.js`; alla sex innan ett
  språk valts). Byte av språk laddar ordboken med `i18n.loadLanguage(kod)`, som också tester som jämför alla
  språk anropar först.
- Tal formateras med `Intl.NumberFormat` i språkets locale (`i18n.formatNumber`); Vega och D3 får samma
  avgränsare via `src/viz/locale.js`. Datum skrivs alltid `ÅÅÅÅ-MM-DD`.
- R-meddelandena i `r/dataspatium.R` finns i samma sex språk (`.dm_msg`) och väljs med `dm_setup(lang)`.
- API-förinställningarna i `presets/api/` har svenska texter och ett `i18n`-block per språk; `connectors.list()`
  returnerar kopior på appens språk, exporten skriver originalet. PxWeb-rötter per språk anges i `family.urls`.
- Dokumentationen: svenska i `docs/`, övriga språk i `docs/<kod>/` med samma filnamn.
- Även kommentarer i genererad R- och SQL-kod (*Kopiera som R/SQL*, nycklarna `code.*`), receptsteg, regelbeskrivningar,
  standardnamn, filnamn för säkerhetskopior och paket samt felmeddelanden från data- och API-lagret går genom
  ordböckerna. Lika på alla språk är mallarnas platshållare (`{{datamangd}}` …), XML-exportens element och
  attribut, API-parametrar och reservnamn i operationer (till exempel `variabel`/`varde` när ett äldre recept
  saknar namnen).

Lägga till ett språk: skapa `src/ui/i18n/<kod>.js` med alla nycklar, lägg till koden i `LANGUAGES` i
`src/boot.js` och posten i `LANGUAGES` i `src/ui/i18n/i18n.js`, lägg till meddelandena i `r/dataspatium.R`
och i förinställningarnas `i18n`-block, översätt `docs/` till `docs/<kod>/` och kör testerna.

## Skärmbilder

`powershell -File tools/screenshot.ps1 -Url "index.html#/bearbeta" -Out shots/bearbeta.png -Theme light` tar en
skärmbild med headless Edge efter att appen hunnit starta. `-Eval` eller `-EvalFile` kör JavaScript i sidan innan
bilden tas (till exempel importera exempeldata och klicka på en knapp); skriptets returvärde skrivs ut, vilket gör
verktyget användbart även för mätningar. Skalinstansen finns som `Dataspatium.shell` i sidan, så ett skript kan
välja datamängd och läge med `Dataspatium.shell.store.set({ selectedId })` och `Dataspatium.shell.activate('bearbeta')`,
och dialogerna kan öppnas direkt via `Dataspatium.require('ui/dialogs')`.

Grundkursen öppnas automatiskt i en ny profil eller erbjuds i en toast; lägg till `course=off` i adressen
(`index.html?course=off#/inhamta`) för skärmbilder utan kurs, eller `course=on` för att öppna den.
`Dataspatium.shell.course.open(4)` visar ett visst steg och `await Dataspatium.shell.course.perform('sql')` gör
steget som *Gör det åt mig*.

## Tester
- `powershell -File tools/run-tests.ps1` kör `tests/index.html` headless i Edge och Firefox och skriver ut varje
  testrad. Exit-kod 0 betyder grönt, 1 fel, 2 timeout eller saknad webbläsare.
- `-Width` och `-Height` (standard 1400 × 1000) sätter fönstrets storlek. Kör också sviten i surfplattestorlek,
  `-Width 768 -Height 1024`, när skalet eller ett läges layout ändrats, så att flaken och lägesväxlarens ikonläge
  testas.
- Testsidan ger samtycke till alla internetändamål i förväg (`localStorage` `dataspatium.consent = granted`), så
  att samtyckesdialogen inte stoppar tester; `tests/consent.test.js` tar bort nyckeln medan den testar dialogen.
- Appen laddar bara svenska och det valda språket vid start; tester som läser alla språk anropar
  `i18n.loadLanguage(kod)` först.
- `tests/p2p.test.js`, `devices.test.js` och `mobile.test.js` kör båda ändarna av en WebRTC-överföring i samma sida
  (loopback med egna certifikat); de behöver ingen annan enhet. Riktiga telefoner provas manuellt enligt listan i
  [mobil.md](mobil.md).
- Mobilsidan startas från mappen med `m/index.html`; `tools/screenshot.ps1 -Url "m/index.html" -Width 412 -Height 915`
  ger en skärmbild i telefonstorlek.
- API-testerna kör mot en låtsastjänst (virtuella `dataspatium-asset://`-adresser via `Dataspatium.net.virtual`) och
  behöver inget nätverk. `powershell -File tools/run-tests.ps1 -Browsers edge -Url "tests/index.html?live=1"` kör
  dessutom ett röktest mot SCB, Kolada, SMHI, Eurostat, dataportalen och Socialstyrelsen; det kräver nätverk och
  kan störas av tjänsternas anropsgränser.
- `tests/python.test.js` kör Pyodide bara när komponenterna redan finns i webbläsaren eller sidan öppnas med
  `?python=1` (hämtar cirka 22 MB från jsDelivr); annars rapporteras testet som överhoppat, och den övriga
  Python-logiken testas med en låtsasmotor. Kör sviten en gång med `-Url "tests/index.html?python=1"` i varje
  webbläsare inför en release.
- Nya inspelade API-svar för fixturer hämtas med `curl -H "Origin: null"` och trimmas innan de läggs i
  `tests/fixtures/api-fixtures.js`.
- `-Url "index.html?autorun=1" -TimeoutSec 480` kör spiksidan.
- Nya tester läggs i `tests/*.test.js` och listas i `tests/index.html`.
- `tests/index.html?only=viz:,formats3` kör bara de tester vars namn innehåller något av de kommaseparerade
  orden, till exempel medan ett test felsöks:
  `powershell -File tools/run-tests.ps1 -Browsers edge -Url "tests/index.html?only=viz:"`. `-Browsers` tar en
  webbläsare åt gången.
- Testsidan låser språket till svenska och sparar Grundkursen som stängd innan appen startar, så att testerna som
  startar skalet inte får språkdialogen eller kurspanelen. `tests/course.test.js` sätter själv kursens tillstånd
  och återställer det efteråt.
- Testsidor skriver rader `DATASPATIUM-LOG: OK|FAIL | namn :: detalj` och avslutar med `DATASPATIUM-TESTS: pass=N fail=M`.
- `tests/flows.test.js` klickar igenom appen: varje åtgärd i Bearbetas palett, verktygsdialogerna i Bearbeta och
  Hantera, diagrambyggaren, källorna i Inhämta, kommandopaletten, hjälpen och språkväljaren. Varje dialog ska gå att
  öppna och stänga utan fel i konsolen och klara tillgänglighetskontrollen. Testerna förutsätter tidigare tester på
  samma sida och ska därför köras i hela sviten, inte ensamma med `?only=`.
- `tests/a11y.js` är en egen tillgänglighetskontroll (axe-core har licensen MPL-2.0, som inte är tillåten här):
  alla knappar, länkar, flikar och fält har ett tillgängligt namn, id är unika och de id som ARIA-attribut pekar på
  finns, dialoger har namn, roller är giltiga, ingen positiv `tabindex`, inga interaktiva element i varandra och
  inga tomma rubriker. `tests/a11y.test.js` kör kontrollen i alla åtta lägen och deras flikar, kontrollerar
  landmärken, länken *Hoppa till innehållet*, tangentbordsnavigering i flikar och att designtokens klarar WCAG AA:
  4,5:1 för text och 3:1 för kanter på fält och växlar, i både ljust och mörkt tema.

## Felsökning
- Loggar från den senaste testkörningen ligger i `%TEMP%\dataspatium-tests\` (`edge.log`, `firefox.log`, `firefox.err`).
- `index.html?debug=1` slår på `Dataspatium.log(...)`-utskrifter i webbläsarkonsolen.
- Om något fungerar via http men inte via file:// har en av file://-reglerna i [arkitektur.md](arkitektur.md) brutits
  (fetch av lokal fil, ES-modul, modul-worker eller Blob-URL inuti worker).

## Prestanda
- `tests/perf.html` importerar först en CSV-fil med en miljon rader och tjugo kolumner, skapar sedan en lika stor
  datamängd i omgångar om 50 000 och mäter bläddring djupt in i tabellen (osorterat, sorterat, textfilter), en
  SQL-aggregering över alla rader, `dm_read()` av hela tabellen i R och sex åtgärder i Bearbeta (rangordna, andel
  av summan per grupp, klassindela, räkna och extrahera med reguljärt uttryck, sortera). För import och åtgärder
  mäts också den längsta tiden huvudtråden var blockerad (en timer på 10 ms; målet är högst 50 ms). Kör med
  `powershell -File tools/run-tests.ps1 -Browsers edge -Url tests/perf.html -TimeoutSec 3000`
  (`tests/perf.html?rows=200000` ger en snabbare körning). Målen rapporteras i resultatraden.
- Uppmätt 2026-11-03, Edge, Windows 11: se tabellen nedan.

| Mätning | Mål | Resultat |
|---|---|---|
| Importera en CSV-fil, 1 000 000 rader × 20 kolumner (115 MB) | 60 s, blockering 50 ms | 5,7 s, längsta blockering 25 ms |
| Skapa 1 000 000 rader × 20 kolumner inkl. sparning | 60 s | 9,5 s (SQLite-filen blir 126 MB) |
| Sida om 100 rader från mitten av tabellen | 0,2 s | under 0,1 s osorterat; 0,9 s sorterad (index skapas vid första sorteringen); 1,5 s med textfilter |
| SQL-aggregering över alla rader (290 grupper) | 2 s | 0,5 s |
| `dm_read()` av hela tabellen i R, inkl. spegling | 30 s | 9,4 s (plus 1,4 s R-start) |
| Rangordna, andel av summan per kommun, klassindela | blockering 50 ms | 3,5 s, 4,5 s och 1,9 s; längsta blockering 8 ms |
| Reguljära uttryck: räkna träffar, extrahera | blockering 50 ms | 0,6 s och 2,9 s; längsta blockering 9 ms |
| Sortera raderna permanent | blockering 50 ms | 2,7 s; längsta blockering 7 ms |

Lärdomar från mätningarna: webR 0.5.9 gör om en fil som skrivs till R:s filsystem till en vanlig array, vilket
slår i JavaScript-motorns gräns för arraylängd nära 128 MB; `engines/r` skriver därför större filer i delar om
16 MB som R fogar ihop. IndexedDB kopierar det som skrivs på huvudtråden, så stora filer sparas och läses en del
om 4 MB i taget. Stora CSV-filer tolkas i bitar om 512 kB med ett uppehåll mellan tolkning och typning.

## Release
1. Kör alla tester i båda webbläsarna och sätt versionsnumret i `src/platform/registry.js` (`Dataspatium.version`)
   och i `sw-coi.js` (`CACHE`), så att installerade appar hämtar de nya filerna.
2. Checka in och tagga: `git tag -a v1.0.0 -m "Dataspatium 1.0.0"` följt av `git push origin main --tags`.
   Taggen måste heta `v<version>`, eftersom uppdateringskontrollen i appen (hjälpknappen, `src/platform/updates.js`)
   jämför `tag_name` i `https://api.github.com/repos/marwiss/Dataspatium/releases/latest` med `Dataspatium.version`.
3. Bygg ZIP-filen ur taggen så att bara spårade filer följer med:
   `git archive --format=zip --prefix=dataspatium-1.0.0/ -o dataspatium-1.0.0.zip v1.0.0`.
4. Kontrollera utgåvan som en ny användare: packa upp ZIP-filen i en tom mapp, öppna `index.html` via file:// och
   kör testerna därifrån med en fullständig file-adress (relativa sökvägar tolkas mot repots rot):
   `powershell -File tools/run-tests.ps1 -Browsers edge -Url "file:///C:/Temp/dataspatium-1.0.0/tests/index.html"`.
5. Räkna ut ZIP-filens SHA-256 (`Get-FileHash dataspatium-1.0.0.zip -Algorithm SHA256` eller `sha256sum`) och
   lägg den sist i noten under *Kontrollsumma*, med kommandon för att kontrollera den i Windows, macOS och Linux.
6. Skapa utgåvan: `gh release create v1.0.0 dataspatium-1.0.0.zip --title "Dataspatium 1.0.0" --notes-file notes.md`,
   där noten inleds med Kom igång-stegen från README. Kontrollera efteråt att GitHubs egen kontrollsumma för
   filen (`gh release view v1.0.0 --json assets`, fältet `digest`) är densamma som den i noten.
7. GitHub Pages bygger från `main` och publicerar appen på <https://marwiss.github.io/Dataspatium/> några minuter
   efter pushen. Öppna adressen, kontrollera versionsnumret under hjälpen och kör sviten därifrån:
   `powershell -File tools/run-tests.ps1 -Browsers edge -Url "https://marwiss.github.io/Dataspatium/tests/index.html"`.
