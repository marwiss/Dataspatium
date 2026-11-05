# Visualiser

Modusen Visualiser lager diagrammer av datasettene med tre motorer som alle bruker appens palett, skrifttype og tallformat:
en diagrambygger (Vega-Lite), ferdige D3-maler, R-skript (ggplot2) og Python-skript (matplotlib, plotly). Diagrammer lagres i arbeidsområdet, kan eksporteres
som SVG, PNG og PDF, deles som filer og lages i batch per gruppe.

## Lag et diagram

1. Velg et datasett i objektpanelet, og trykk **Nytt diagram**.
2. Velg motor: **Diagrambygger**, **D3-mal**, **R-skript** eller **Python-skript**.
3. Gi diagrammet et navn i tittelfeltet, og trykk **Lagre**. Lagrede diagrammer vises under Diagrammer i objektpanelet og i
   galleriet.

Forhåndsvisningen oppdateres mens du endrer. Under diagrammet står hvor mange rader som ble brukt; store datasett
aggregeres i SQL når diagrammet bare trenger summer, gjennomsnitt eller antall, ellers begrenses antallet rader (standard
50 000, endres under Flere alternativer).

Det som passer datasettet, står først i dialogen. En diagramtype som ikke kan fungere, er grå og sier hva som trengs, for eksempel en graf.

En graf kan tegnes ut fra kantene og en modell ut fra egenskapene eller mengdene. Velg *Tabell* i diagrammets overskrift, så bytter byggeren kolonner.

Øverst i dialogen vises **forslag** for det valgte datasettet som ekte bilder: en linje for en tidsserie, et kart for steder, stolper for det som kan telles, en grafs nettverk eller en modells mengder. Klikk på et forslag for å åpne det og arbeide videre.

## Diagrambyggeren (Vega-Lite)

| Diagramtype | Brukes til |
|---|---|
| Stolper, Liggende stolper | Å sammenligne kategorier, med valgfri fargeoppdeling og stabling |
| Linje, Areal | Utvikling over tid eller ordnede kategorier |
| Punkter | Sammenheng mellom to tall, farge og størrelse som ekstra dimensjoner |
| Histogram | Fordeling av et tall i intervaller |
| Varmekart | To kategorier med en verdi som farge |
| Boksplott | Spredning per kategori |
| Sektor | Andeler av en helhet (få kategorier) |
| Kart | Områder farget etter en verdi (koroplettkart) fra en geometrikolonne, se *Kart* nedenfor |
| Punktkart | Punkter fra lengde- og breddegrad (eller SWEREF 99 TM) med størrelse og farge etter verdier, over kommune- eller länsgrenser |

For hver kanal (X, Y, Farge, Størrelse, Små paneler) velger du kolonne, hvordan den skal tolkes (tall, kategori, ordnet
kategori, tid), beregning (sum, gjennomsnitt, median, minste, største, antall, antall unike), sortering, tidsenhet og
aksetittel. Øvrige innstillinger: tittel og undertittel, tallformat, høyde, forklaringens plassering, stabling (stablet,
prosent, overlappende), verdietiketter på stolper og punkter på linjer. **Filtre** begrenser radene med betingelser på
kolonner. Under **Flere alternativer** finnes radgrense, fargeskala (sekvensiell eller divergerende) og **Egen
Vega-Lite-spesifikasjon**: JSON-spesifikasjonen kan redigeres direkte for alt byggeren ikke dekker; data settes inn fra
datasettet når diagrammet gjengis.

Diagrammet lagres som byggerens tilstand (eller den egne spesifikasjonen) sammen med datasettets navn og kortnavn, slik at
det kan gjenskapes på nye data med de samme kolonnene.

### Akser og linjer

Avsnittet **Akser og linjer** (alle diagramtyper unntatt sektor og kart) styrer aksene og legger til linjer. Tomme
felt gir automatiske verdier.

| Innstilling | Hva den gjør |
|---|---|
| Verdiaksens minste og største verdi | Faste grenser for verdiaksen (Y, eller X i liggende stolper), for eksempel 0–100 for prosent eller samme skala i flere diagrammer. Det som havner utenfor grensene, klippes bort |
| X-aksens minste og største verdi | Vises når x-aksen er et tall (punkter og linjer), for eksempel for å zoome inn på et intervall |
| Skala på verdiaksen | Lineær, logaritmisk (for verdier som spenner over flere tierpotenser; krever positive verdier) eller kvadratrot |
| Start verdiaksen på null | På som standard; slå av for å la aksen begynne nær den minste verdien, for eksempel for temperaturer |
| Etikettenes vinkel | Automatisk, 0°, 45° eller 90° for kategorier med lange navn |
| Rutenett | Rutenettet bak diagrammet, på som standard |
| Referanselinje ved verdien | En stiplet linje ved en verdi på verdiaksen, for eksempel et mål eller et landsgjennomsnitt, med valgfri tekst |
| Trendlinje | Punkter og linjer med et tall på x-aksen: rett linje (lineær regresjon) eller utjevnet kurve (loess), én per fargegruppe |
| Dekning | Hvor ugjennomsiktige punkter, flater og stolper er (0,05–1), for eksempel ved mange overlappende punkter |

Referanse- og trendlinjer tegnes ikke i diagrammer med små paneler. Innstillingene lagres med diagrammet og følger
med i delte diagramfiler og batchkjøringer.

**Liste** under filtrene velger et lagret søk fra Søk som diagrammets rader hentes fra (valget vises bare når
datasettet har lister). Listen kjøres igjen hver gang diagrammet tegnes, så diagrammet følger dagens data, og
filtrene legges oppå. Valget lagres med diagrammet og gjelder også i dashbord og eksporter.

## D3-maler

- **Rangering**: én rad per kategori sortert etter verdi, med prikk og strek. Velg kategori, verdi, beregning, antall og
  rekkefølge.
- **Helningsdiagram**: to perioder per kategori med en strek imellom; grønne streker øker, røde synker.
- **Befolkningspyramide**: grupper (aldre) som stolper i to retninger, for eksempel kvinner og menn.

Malene er skrevet i D3 med appens stilmodul og gir vektorgrafikk som eksporteres uendret.

## R-skript

Skriptet kjøres i R-sesjonen med datasettet lest inn som `df` (lest med kortnavnet). Tegn med ggplot2 eller basisgrafikk;
`theme_dataspatium()` og `dm_palette()` gir appens utseende. Det siste diagrammet vises og lagres med skriptet. Eksport skjer
via R (svglite for SVG, `png()` og `pdf()`), og batchkjøringer kjører skriptet én gang per gruppe med `df` filtrert.
Ctrl+Enter kjører skriptet.

## Python-skript

Skriptet kjøres i Python-sesjonen med datasettet lastet inn som `df` (pandas). Tegn med matplotlib (`fig, ax =
plt.subplots()`) eller plotly (`fig.show()`); `theme_dataspatium()` settes automatisk. Det siste diagrammet vises og
lagres med skriptet; et plotly-diagram lagres dessuten som figur og vises interaktivt i dashbord og publisert HTML.
Python starter med *Start Python* eller *Kjør* (hentes første gang, se [python.md](python.md)). Eksport og batch per
gruppe fungerer som for R-skript.

## Eksporter

**Eksporter** åpner en dialog med format (PNG, SVG, PDF, PowerPoint), bredde, høyde, skala for PNG og filnavn. PNG tegnes i
nettleseren med appens skrifttype. SVG har skrifttypen innebygd, så filen ser lik ut på andre datamaskiner. PDF er
vektorgrafikk (jsPDF og svg2pdf.js); tekst settes med PDF-standardskrifttypen Helvetica. PowerPoint (pptx, via PptxGenJS)
gir en presentasjon med et tittellysbilde og diagrammet som bilde i høy oppløsning; i modusen Eksporter finnes dessuten
**Alle diagrammer som PowerPoint**, ett lysbilde per lagret diagram. Diagrammene kan også eksporteres fra modusen
Eksporter, der alle lagrede diagrammer vises.

## Batch per gruppe

**Batch per gruppe** lager diagrammet én gang per verdi i en grupperingskolonne (for eksempel hver kommune eller hvert år),
filtrert på verdien og med verdien i tittelen, og pakker alle filer i en ZIP sammen med `manifest.json`. Velg kolonne,
format (ett eller flere), mønster for filnavn (`{diagram}` og `{grupp}` erstattes), bredde og høyeste antall grupper.
Kjøringen kan avbrytes. Grupper som mislykkes, vises i manifestet. Formatet PowerPoint gir i stedet for en ZIP én
presentasjon med ett lysbilde per gruppe.

## Galleri og panel

**Galleri** viser alle lagrede diagrammer som kort med miniatyr, datasett og tidspunkt. Velg antall kolonner, og trykk
**Gjengi alle (panel)** for å tegne diagrammene live side ved side. Herfra åpnes, eksporteres og slettes diagrammer.

## Kart
I tillegg til koroplettkartet og punktkartet nedenfor finnes diagramtypen **Kart**: en kartvisning med Leaflet, flere lag, bakgrunnskart og zoom. Den beskrives i [kartor.md](kartor.md).

To diagramtyper tegner kart, begge uten kartserver: **Kart** (koroplettkart: områder farget etter en verdi) og **Punktkart**
(punkter på koordinater med størrelse og farge etter verdier). Kommune- og regiongrenser for Sverige, Danmark, Norge og
Finland følger med appen; grenser for andre land importeres fra GeoJSON, shapefile eller GeoPackage.

![Koroplettkart over befolkning per kommune og punktkart over målestasjoner i et dashbord](../images/kartor.png)

### Koroplettkart (Kart)

1. Hent grensene: velg for eksempel **Norske kommunegrenser (Kartverket)** eller **Svenske kommunegrenser (SCB)** i
   listen *Grenser for kart* i Hent, og trykk **Importer grenser**, eller importer egne grenser fra GeoJSON, shapefile
   eller GeoPackage. De blir datasett med kode, navn og en geometrikolonne (`geometry`, GeoJSON i lengde- og breddegrad).
   Kodene er de offisielle: firesifrede kommunenumre i Sverige, Danmark (DAGI, som `0101`; Danmarks Statistik skriver
   `101`) og Norge, tresifrede i Finland (som `091`; StatFin skriver `KU091`). Avviker kodene i statistikken, kan de
   tilpasses i Bearbeid med *Fyll ut med innledende nuller* eller *Søk og erstatt*.
2. Koble verdiene til grensene i Bearbeid (*Koble datasett*) på koden, slik at datasettet har både `geometry` og verdien som
   skal fargelegges. Alternativt er verdiene allerede importert sammen med geometrien.
3. Velg *Kart* i diagrambyggeren. Geometrikolonnen finnes automatisk (kolonnen `geometry`), etiketten er en tekstkolonne
   som vises når du peker på et område, og verdien styrer fargen med appens sekvensielle skala (velg divergerende under
   *Flere alternativer* for avvik rundt en midtverdi).

Geometrikolonnen kan inneholde GeoJSON eller WKT (`POLYGON((...))`, `POINT(...)` med flere, også med `SRID=...;`-prefiks),
slik at eksporter fra GeoPackage, PostGIS og regneark fungerer direkte.

### Punktkart

Velg *Punktkart* for et datasett med koordinater, for eksempel værstasjoner eller adresser med lengde- og breddegrad.
Kolonnene finnes på navn (`longitude`/`latitude`, `lon`/`lat`, `x`/`y`, `öst`/`norr`) og kan byttes. Koordinater i meter
(SWEREF 99 TM) gjenkjennes og regnes om til lengde- og breddegrad. **Størrelse** og **Farge** tar verdikolonner (eller en
kategori for fargen), **Etikett** vises når du peker på et punkt, og **Bakgrunn** velger en av de medfølgende grensene
eller ingen bakgrunn. Har datasettet områder i stedet for punkter, gir *Bearbeid > Geodata > Sentroide fra geometri* lengde-
og breddegrad for hvert område, slik at verdier kan tegnes som bobler.

### Projeksjon og grenser

Projeksjonen velges ut fra koordinatene: meter (SWEREF 99 TM) tegnes som de er, lengde- og breddegrad innenfor Europa
gjennom en transversal Mercator rundt rutenettmeridianen i landet der dataene ligger (9° øst for Danmark, 15° øst for
Sverige og Norge, 27° øst for Finland), og øvrige gjennom Mercator. De medfølgende grensene er forenklede for tematiske
kart og ikke ment for nøyaktige grensedragninger: SCBs kommune- og länsgrenser (CC0, versjon februar 2026), DAGI
1:500 000 for Danmark, Kartverkets N1000 for Norge (klippet langs kysten, siden norske kommuner ellers strekker seg ut i
havet) og Statistikcentralens inndeling 1:1 000 000 for Finland (se `presets/geo/KALLA.md`). Kart eksporteres, deles,
legges i dashbord og kjøres i batch som alle andre diagrammer i byggeren; filtre i dashbord virker også på kart. Et
datasett med geometri kan eksporteres som GeoJSON fra Eksporter.

## Dashbord

Et dashbord er et navngitt utvalg av lagrede diagrammer i et rutenett med felles filtre. Lag et med **Nytt dashbord** i
objektpanelet, gi det et navn, og klikk på **Legg til diagram** for å velge blant de lagrede diagrammene. Hvert kort kan gjøres
bredere (én, to eller tre kolonner), flyttes opp eller ned, åpnes i byggeren eller fjernes fra dashbordet; antall kolonner i
rutenettet og en beskrivelse settes i egenskapspanelet. Alle endringer lagres automatisk.

**Filtre** viser kolonnene som finnes i alle datasett dashbordets diagrammer bruker (tekst, heltall, dato og ja/nei). Hvert
valgt filter blir en velger over diagrammene, og valget gjelder alle Vega- og D3-diagrammer samtidig (R- og Python-diagrammer vises som
lagret bilde). Filtrene legges til diagrammenes egne filtre.

Dashbordet eksporteres som frittstående **HTML** (diagrammene som innebygd SVG, med de aktive filtrene oppgitt), som
**PowerPoint** (tittellysbilde pluss ett lysbilde per diagram) eller deles som `*.dash.json`, en fil som inneholder
diagrammenes definisjoner. Ved import kobles diagrammene til eksisterende diagrammer med samme navn og datasett; de som
mangler, gjenskapes fra filen. Sikkerhetskopien og den portable mappen inneholder alle dashbord. Dashbord kan også åpnes via
kommandopaletten (Ctrl+K) og eksporteres fra modusen Eksporter.

**Presenter** viser dashbordet i hele vinduet, på en stor skjerm eller en projektor: knappen finnes i dashbordets
tittelrad og kommandoen *Presenter: navn* i kommandopaletten. Oversikten viser alle diagrammer; høyre- og venstrepil
(eller mellomrom og Page Up/Page Down) går ett diagram om gangen i stor størrelse, Home viser oversikten igjen, F
veksler fullskjerm der nettleseren tillater det, og Esc avslutter. De felles filtrene blir værende i raden øverst og
gjelder alle diagrammer. Ingenting endres i dashbordet under presentasjonen.

**Kryssfilter.** Klikk på en stolpe i et diagram, så viser de andre diagrammene bare den verdien, hvis de har kolonnen. Diagrammet du klikket i, beholdes helt, slik at du kan velge en annen stolpe. Filteret står over diagrammene og fjernes med et klikk. Eksporterer du dashbordet, følger filteret med.

## Del diagrammer

**Eksporter konfigurasjon** laster ned diagrammet som `*.viz.json` uten data. En annen bruker legger til filen med
**Importer diagram (fil)**; diagrammet kobles til et datasett med samme kortnavn eller navn i det arbeidsområdet.
Sikkerhetskopien av arbeidsområdet (Håndter) inneholder alle diagrammer som slike filer.

## Begrensninger

- Diagrammene lever i nettleseren; svært store datasett uten aggregering begrenses til radgrensen.
- PDF bruker Helvetica, ikke Inter, for tekst.
- R- og Python-diagrammer kjøres i motoren sin ved eksport, batch, dokumenter og PowerPoint; det tar noen sekunder per diagram, og Python hentes første gang.
- De medfølgende grensene er forenklede for tematiske kart, ikke nøyaktige grenser.
- PowerPoint-eksport bruker bilder (PNG) av diagrammene, ikke redigerbare PowerPoint-diagrammer.
