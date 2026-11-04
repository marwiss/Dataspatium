# Stilguide

Målbild: rent, praktiskt, tydligt, fräscht, användarvänligt och väldigt enhetligt. Hela appen ska kännas som en
enda sak, "one look". Stilguiden är bindande för all UI-kod.

## Designvariabler

Alla färger, mått, typsnitt, radier och skuggor finns som CSS-variabler i `src/ui/design/tokens.css`. Inga
literala värden i komponenter eller vyer. Ljust och mörkt tema definieras på samma ställe; användarens val sparas
i webbläsaren (`src/ui/design/theme.js`).

- Typsnitt: Inter (inbäddat, laddas via FontFace API), monospace för kod och identifierare. Tabellsiffror
  (`tabular-nums`) i alla talkolumner.
- Textstorlekar: xs 12, sm 13, md 15, lg 17, xl 20, 2xl 24 px. Brödtext är md, gränssnittstext sm.
- Avstånd: 4 px-skala (`--dm-s-1` till `--dm-s-12`).
- Radier: 6 px (fält, knappar) och 10 px (kort, dialoger).
- Färger: en neutral gråskala, en accentfärg (blå) för primära åtgärder och markeringar, tre statusfärger (ok,
  varning, fel) och en datapalett (Okabe-Ito, färgblindsäker) som används av ggplot2, Vega-Lite och D3.
- Kontrast: all text, även den dämpade (`--dm-text-muted`) och den svaga (`--dm-text-faint`), statusfärgerna och
  accentfärgen har minst 4,5:1 mot `--dm-bg`, `--dm-surface` och `--dm-surface-2` i båda teman. Kanten på fält och
  växlar (`--dm-border-input`) har minst 3:1 mot alla ytor; `--dm-border` och `--dm-border-strong` är för
  avdelare och kort, där kanten inte bär information. `tests/a11y.test.js` räknar ut kvoterna, så en ändrad färg
  som inte klarar kraven syns direkt.

## Komponenter

Allt gränssnitt byggs av komponenterna i `src/ui/components/` (prefix `dm-`): `dm-button`, `dm-input`,
`dm-select`, `dm-switch`, `dm-tabs`, `dm-panel`, `dm-empty-state`, `dm-stepper`, `dm-kv`, `dm-badge`,
`dm-progress`, `dm-dropzone`, `dm-table`, `dm-icon` samt dialoger, toaster och den flytande panelen från
`ui/overlays`. Den flytande panelen (`overlays.floating`, `.dm-floating`) är icke-modal, ligger nere till höger
över egenskapspanelen och ovanför loggen och används av Grundkursen; den kan minimeras till sin rubrik, och
toaster visas till vänster om den medan den är öppen. Kursen markerar knappen användaren ska
klicka på med klassen `.dm-course-target` (en ram i accentfärgen) och hittar knappar via attributet `data-course`. Rader av
växlingsknappar (landsfiltret i Inhämta) använder `.dm-chips` och `.dm-chip` med `aria-pressed`. Saknas något:
lägg till en komponent, aldrig en engångslösning i en vy. Ikoner kommer från Lucide via `dm-icon`. Appens märke är en egen
ikon i samma stil, `dm-icon name="dataspatium"` (`OWN` i `src/ui/design/icons.js`): tre staplade ark vars vänstra hörn är
kapat, så att de tillsammans bildar ett D. I accentfärgen är det också favicon (`src/ui/design/favicon.svg`).

## Layout

Samma skelett i alla åtta lägen: lägesväxlare högst upp, objektpanel till vänster (280 px som standard, 200 till
560 px med avdelaren `dm-splitter`), arbetsyta i mitten, inspektör till höger (320 px som standard), logglåda
ovanför statusraden längst ned (`--dm-statusbar-h`). Statusraden visar sparstatus, lagring, vald datamängd,
R-motorn, nätverksaktivitet och knapparna som fäller in panelerna och loggen; överst till höger finns bara
kommandopaletten, språk, tema och hjälp. Panelerna byter aldrig plats. Under 1 100 px visar lägesväxlaren bara
ikoner (text på det aktiva läget) och inspektören blir ett flak (`data-right="sheet"`, bredd `--dm-sheet-w`) över
arbetsytan; under 760 px blir också objektpanelen ett flak och de valfria delarna av statusraden döljs. Flak
stängs med Esc eller klick i arbetsytan, och pekytor är minst 44 px i de smala lägena. Vyer i arbetsytan börjar
med `.dm-page-head` (rubrik med ikon till vänster, åtgärder till höger) och använder kort (`.dm-card`) för
grupperat innehåll.

**Dataspatium Mobil** (`m/index.html`, `src/mobile/`) har ett eget, enklare skelett med samma tokens och
komponenter: en rubrikrad (tillbaka, titel, inställningar), en kolumn med kort (`.dm-m-card`), knappar i full bredd
med minst 48 px höjd (`.dm-m-actions`) och tabeller med fast rubrikrad och fast första kolumn (`.dm-m-table`).
Inga hover-beroenden; allt nås med tryck.

## Regler

- Högst en primärknapp per vy. Primärknappen är den åtgärd användaren oftast vill göra.
- Avancerade val göms under "Fler alternativ".
- Farliga åtgärder (ta bort) har variant `danger` och kräver bekräftelse i dialog.
- Tomma tillstånd (`dm-empty-state`) förklarar vad som visas här och erbjuder nästa steg.
- Alla texter hämtas med `t('nyckel')` och finns på alla sex språk (svenska är grundspråket); inga hårdkodade
  strängar i komponenter eller vyer.
- Tal visas med det valda språkets format (på svenska mellanslag som tusentalsavgränsare och decimalkomma) och
  högerställda.
- Datum visas som `ÅÅÅÅ-MM-DD` och tid som `HH:MM` på alla språk.
- Kortvariga meddelanden som toaster, bestående information i loggen.
- Varje knapp har ett tips: `title` på `dm-button` blir tipset (`data-tip`), som visas efter 400 ms när pekaren
  vilar, direkt vid tangentbordsfokus och vid långtryck på pekskärm. Knappar med bara ikon har alltid tips och
  `aria-label`; knappar med text får tips bara när tipset säger mer än texten. Inga egna tooltip-lösningar.
- Inga nätverksanrop utan användarens åtgärd och samtycke per ändamål (`platform/consent`: api, url, github,
  components, basemaps, databases med flera); komponenter hämtas från fasta adresser och kontrolleras mot SHA-256
  när summan är känd.
- Analysverktygen ligger i fast ordning: R, Python, SQL, Regex och sist Anteckningsboken, som fogar ihop delar
  från de andra. Verktyg för andra slags datamängder (grafer, bilder, text, modeller) läggs efter SQL respektive
  Regex, aldrig efter anteckningsboken.
- Allt ska gå att nå med tangentbord; fokus syns alltid; kontrast enligt WCAG AA. Flikar byts med piltangenterna,
  Home och End, och fokus följer den aktiva fliken. Alla knappar, fält och kodredigerare har ett namn som
  skärmläsare läser upp (`label` på `dm-code`, `aria-label` på knappar med bara ikon), och varje dialog läses upp
  med sin egen rubrik.
- Inga animationer utöver korta övergångar; respektera `prefers-reduced-motion`.

## Ordlista

Samma ord för samma sak i hela appen och dokumentationen.

| Använd | Använd inte |
|---|---|
| Datamängd | Dataset, tabell (om det inte är själva vyn), fil |
| Kortnamn (datamängdens identifierare i SQL och R) | Alias, slug, tabellnamn |
| Etikett, beskrivning, enhet (kolumnmetadata) | Label, rubrik |
| Värdeetikett (namn på en kod, som `1 = Man`), kod | Värdelabel, kodtext |
| Inhämta, Importera | Ladda upp, hämta in |
| Hämta (från API) | Ladda ned (från API) |
| Exportera, Ladda ned | Spara som, exportera ut |
| Ta bort | Radera, delete |
| Byt namn | Döp om |
| Ångra | Återställ (reserverat för säkerhetskopior) |
| Säkerhetskopiera, Återställ | Backup, restore |
| Kolumn, rad, värde | Fält, post (utom i API-sammanhang), cell |
| Tom (värde saknas) | null, NA, saknas (i gränssnittet) |
| Arbetsyta | Workspace, projekt |
| Läge | Vy, flik, sida (för de åtta lägena) |
| Mapp, tagg (ordning bland datamängder) | Katalog, folder, etikett (som är kolumnmetadata) |
| Paket (delningspaket i Dela) | Bundle, exportpaket |
| Lista (sparad sökning i Söka) | Urval, filter, sparad sökning |
| Fråga (fliken i Söka), villkor, koppling, beräkning | Query, filter (för villkor), join, aggregat (i gränssnittet) |
| Handbok (hjälpen i appen) | Hjälpcenter, manual, dokumentation (i gränssnittet) |
| Presentera, presentation (dashboard i hela fönstret) | Bildspel, helskärmsläge, kiosk |
| Brygga, databasbryggan (det lokala skriptet för databaser) | Proxy, agent, tjänst |
| Länkad fil (datamängd som kan läsas in igen från disken) | Synkad fil, bevakad fil |
| Databaskälla (anslutning till PostgREST, OData …) | Connector, koppling (som är join) |
| Flak (panel som läggs över arbetsytan i smala fönster) | Sheet, drawer, sidopanel |
| Komponent (del av appen som hämtas vid behov) | Plugin, modul, tillägg |
| Tips (text som visas när pekaren vilar på en knapp) | Tooltip, verktygstips |
| Statusrad (raden längst ned) | Fot, footer, statusfält |
| Enhet (telefon, surfplatta eller dator i Enheter), para, parad | Device, peer, koppla ihop |
| Kontrollkod (sex siffror som båda enheterna visar) | Verifieringskod, PIN |
| Mobilsidan, Dataspatium Mobil | Mobilappen, lättversionen |
| Granskning före delning | Delningsgranskning, PII-kontroll |
| Språk | Locale, lokalisering (i gränssnittet) |
| Land (filtret för API-källor) | Region, område |
| Grundkurs (den interaktiva genomgången), steg, uppgift | Guide, tur, tutorial, lektion |
| Reguljärt uttryck, mönster, träff; fliken heter Regex | Regexp, sökmönster, match (i löpande text) |

Skrivsätt: korta meningar, verb först i knappar ("Importera", "Spara"), inga utropstecken, inga versaler i
löpande ord utom namn. Felmeddelanden säger vad som hände och vad användaren kan göra.
