# Utveckling

Den här sidan beskriver hur man arbetar med Dataspatiums kodbas. Arkitekturen beskrivs i [arkitektur.md](arkitektur.md),
utseendet i [stilguide.md](stilguide.md) och resultatet av den tekniska spiken i [fas0-spik.md](fas0-spik.md).

## Förutsättningar
- Edge eller Chrome och Firefox för tester.
- Python 3 (standardbiblioteket räcker) för underhållsverktygen i `tools/`.
- PowerShell för testköraren. Inget node.js, inget byggsteg.

## Köra appen
Öppna `index.html` direkt i webbläsaren (file://). Allt ska fungera där. Vid behov går det också att serva mappen med
`python -m http.server 8080` och öppna `http://localhost:8080/`.

## Tredjepartskomponenter
1. Lägg till eller ändra posten i `vendor/vendor.json` (pinnad version, licens, filer, inbäddningssätt).
2. `python tools/fetch_vendor.py` hämtar originalen till `vendor-src/` (git-ignorerad) och kopierar direkt laddbara
   filer och LICENSE till `vendor/<lib>/`.
3. `python tools/wrap_assets.py` skriver inbäddade JavaScript-wrappers, `vendor/manifest.js` och
   `THIRD_PARTY_LICENSES.md`.

Resurser nås i koden som `dataspatium-asset://<lib>/<sökväg>`, t.ex. `dataspatium-asset://webr/R.wasm`, både på huvudtråden
och i workers. Se `src/platform/assets.js`, `net-shim.js` och `worker-shim.js`.

## Egna inbäddade filer

R-hjälpfunktionerna i `r/dataspatium.R`, exempeldata i `presets/exempeldata/` och gränserna i `presets/geo/`
måste också bäddas in som JavaScript för att kunna läsas via file://. Kör `python tools/wrap_local.py` efter
ändringar; den skriver `<fil>.js` bredvid originalet och `presets/local-assets.js`.

Kommun- och länsgränserna byggs av `python tools/build_boundaries.py [arkiv.zip]` ur SCB:s *Digitala gränser*
(shapefiler i SWEREF 99 TM, CC0): skriptet läser shapefilerna med standardbiblioteket, räknar om koordinaterna
till WGS 84 med Lantmäteriets Gauss-Krüger-formler och skriver `presets/geo/lan.geojson`,
`presets/geo/kommuner.geojson` och `presets/geo/KALLA.md`. Utan argument hämtas det aktuella arkivet från SCB.
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

Lägga till ett språk: skapa `src/ui/i18n/<kod>.js` med alla nycklar, lägg till filen i `src/boot.js` före
`i18n.js`, lägg till posten i `LANGUAGES` i `src/ui/i18n/i18n.js`, lägg till meddelandena i `r/dataspatium.R`
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
- API-testerna kör mot en låtsastjänst (virtuella `dataspatium-asset://`-adresser via `Dataspatium.net.virtual`) och
  behöver inget nätverk. `powershell -File tools/run-tests.ps1 -Browsers edge -Url "tests/index.html?live=1"` kör
  dessutom ett röktest mot SCB, Kolada, SMHI, Eurostat, dataportalen och Socialstyrelsen; det kräver nätverk och
  kan störas av tjänsternas anropsgränser.
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

## Felsökning
- Loggar från den senaste testkörningen ligger i `%TEMP%\dataspatium-tests\` (`edge.log`, `firefox.log`, `firefox.err`).
- `index.html?debug=1` slår på `Dataspatium.log(...)`-utskrifter i webbläsarkonsolen.
- Om något fungerar via http men inte via file:// har en av file://-reglerna i [arkitektur.md](arkitektur.md) brutits
  (fetch av lokal fil, ES-modul, modul-worker eller Blob-URL inuti worker).

## Prestanda
- `tests/perf.html` skapar en datamängd med en miljon rader och tjugo kolumner i omgångar om 50 000, och mäter
  bläddring djupt in i tabellen (osorterat, sorterat, textfilter), en SQL-aggregering över alla rader och
  `dm_read()` av hela tabellen i R. Kör med
  `powershell -File tools/run-tests.ps1 -Browsers edge -Url tests/perf.html -TimeoutSec 900`
  (`tests/perf.html?rows=200000` ger en snabbare körning). Målen från planen rapporteras i resultatraden.
- Uppmätt 2026-11-02, Edge 156, Windows 11: se tabellen nedan.

| Mätning | Mål | Resultat |
|---|---|---|
| Skapa 1 000 000 rader × 20 kolumner inkl. sparning | 60 s | 21,9 s (SQLite-filen blir 126 MB) |
| Sida om 100 rader från mitten av tabellen | 0,2 s | under 0,1 s osorterat; 5,8 s sorterad på en kolumn utan index; 2,4 s med textfilter |
| SQL-aggregering över alla rader (290 grupper) | 2 s | 0,7 s |
| `dm_read()` av hela tabellen i R, inkl. spegling | 30 s | 21,7 s (plus 2,8 s R-start) |

Känd begränsning: sortering och textfilter körs om för varje sida i en tabell med en miljon rader, så bläddring i
sorterat läge tar några sekunder per sida på så stora tabeller. Ett index per sorterad kolumn på begäran står på
backloggen; det kräver att typbyten (som bygger om kolumnen) först tar bort indexet.

## Release
1. Kör alla tester i båda webbläsarna och sätt versionsnumret i `src/platform/registry.js` (`Dataspatium.version`).
2. Checka in och tagga: `git tag -a v1.0.0 -m "Dataspatium 1.0.0"` följt av `git push origin main --tags`.
   Taggen måste heta `v<version>`, eftersom uppdateringskontrollen i appen (hjälpknappen, `src/platform/updates.js`)
   jämför `tag_name` i `https://api.github.com/repos/marwiss/Dataspatium/releases/latest` med `Dataspatium.version`.
3. Bygg ZIP-filen ur taggen så att bara spårade filer följer med:
   `git archive --format=zip --prefix=dataspatium-1.0.0/ -o dataspatium-1.0.0.zip v1.0.0`.
4. Kontrollera utgåvan som en ny användare: packa upp ZIP-filen i en tom mapp, öppna `index.html` via file:// och
   kör testerna därifrån med en fullständig file-adress (relativa sökvägar tolkas mot repots rot):
   `powershell -File tools/run-tests.ps1 -Browsers edge -Url "file:///C:/Temp/dataspatium-1.0.0/tests/index.html"`.
5. Skapa utgåvan: `gh release create v1.0.0 dataspatium-1.0.0.zip --title "Dataspatium 1.0.0" --notes-file notes.md`,
   där noten inleds med Kom igång-stegen från README.
