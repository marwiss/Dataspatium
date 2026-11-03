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

## Komponenter

Allt gränssnitt byggs av komponenterna i `src/ui/components/` (prefix `dm-`): `dm-button`, `dm-input`,
`dm-select`, `dm-switch`, `dm-tabs`, `dm-panel`, `dm-empty-state`, `dm-stepper`, `dm-kv`, `dm-badge`,
`dm-progress`, `dm-dropzone`, `dm-table`, `dm-icon` samt dialoger, toaster och den flytande panelen från
`ui/overlays`. Den flytande panelen (`overlays.floating`, `.dm-floating`) är icke-modal, ligger nere till höger
över egenskapspanelen och ovanför loggen och används av Grundkursen; den kan minimeras till sin rubrik, och
toaster visas till vänster om den medan den är öppen. Kursen markerar knappen användaren ska
klicka på med klassen `.dm-course-target` (en ram i accentfärgen) och hittar knappar via attributet `data-course`. Rader av
växlingsknappar (landsfiltret i Inhämta) använder `.dm-chips` och `.dm-chip` med `aria-pressed`. Saknas något:
lägg till en komponent, aldrig en engångslösning i en vy. Ikoner kommer från Lucide via `dm-icon`; appens märke är
Lucide-ikonen *layers* i accentfärgen, som också är favicon (`src/ui/design/favicon.svg`).

## Layout

Samma skelett i alla sex lägen: lägesväxlare högst upp, objektpanel till vänster (280 px), arbetsyta i mitten,
egenskapspanel till höger (320 px), logglåda längst ned. Panelerna kan fällas in men byter aldrig plats. Vyer i
arbetsytan börjar med `.dm-page-head` (rubrik med ikon till vänster, åtgärder till höger) och använder kort
(`.dm-card`) för grupperat innehåll.

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
- Allt ska gå att nå med tangentbord; fokus syns alltid; kontrast enligt WCAG AA.
- Inga animationer utöver korta övergångar; respektera `prefers-reduced-motion`.

## Ordlista

Samma ord för samma sak i hela appen och dokumentationen.

| Använd | Använd inte |
|---|---|
| Datamängd | Dataset, tabell (om det inte är själva vyn), fil |
| Kortnamn (datamängdens identifierare i SQL och R) | Alias, slug, tabellnamn |
| Etikett, beskrivning, enhet (kolumnmetadata) | Label, rubrik |
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
| Läge | Vy, flik, sida (för de sex lägena) |
| Språk | Locale, lokalisering (i gränssnittet) |
| Land (filtret för API-källor) | Region, område |
| Grundkurs (den interaktiva genomgången), steg, uppgift | Guide, tur, tutorial, lektion |

Skrivsätt: korta meningar, verb först i knappar ("Importera", "Spara"), inga utropstecken, inga versaler i
löpande ord utom namn. Felmeddelanden säger vad som hände och vad användaren kan göra.
