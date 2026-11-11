# Visualiser

Modusen Visualiser lagar diagram av datasetta med tre motorar som alle brukar paletten, skrifttypen og talformatet til appen:
ein diagrambyggjar (Vega-Lite), ferdige D3-malar, R-skript (ggplot2) og Python-skript (matplotlib, plotly). Diagram blir lagra i arbeidsområdet, kan eksporterast
som SVG, PNG og PDF, delast som filer og lagast i batch per gruppe.

## Lag eit diagram

1. Vel eit datasett i objektpanelet, og trykk **Nytt diagram**.
2. Vel motor: **Diagrambyggjar**, **D3-mal**, **R-skript** eller **Python-skript**.
3. Gje diagrammet eit namn i tittelfeltet, og trykk **Lagre**. Lagra diagram blir viste under Diagram i objektpanelet og i
   galleriet.

Førehandsvisinga blir oppdatert medan du endrar. Under diagrammet står kor mange rader som vart brukte; store datasett
blir aggregerte i SQL når diagrammet berre treng summar, gjennomsnitt eller tal, elles blir talet på rader avgrensa (standard
50 000, blir endra under Fleire alternativ).

Det som passar datasettet, står først i dialogen. Ein diagramtype som ikkje kan fungere, er grå og seier kva som trengst, til dømes ein graf.

Ein graf kan teiknast ut frå kantane og ein modell ut frå eigenskapane eller mengdene. Vel *Tabell* i overskrifta til diagrammet, så byter byggjaren kolonnar.

Øvst i dialogen blir **forslag** for det valde datasettet viste som ekte bilete: ei linje for ein tidsserie, eit kart for stader, stolpar for det som kan teljast, nettverket i ein graf eller mengdene i ein modell. Klikk på eit forslag for å opne det og arbeide vidare.

## Diagrambyggjaren (Vega-Lite)

| Diagramtype | Blir brukt til |
|---|---|
| Stolpar, Liggjande stolpar | Å samanlikne kategoriar, med valfri fargeoppdeling og stabling |
| Linje, Areal | Utvikling over tid eller ordna kategoriar |
| Punkt | Samanheng mellom to tal, farge og storleik som ekstra dimensjonar |
| Histogram | Fordeling av eit tal i intervall |
| Varmekart | To kategoriar med ein verdi som farge |
| Boksplott | Spreiing per kategori |
| Sektor | Andelar av ein heilskap (få kategoriar) |
| Kart | Område farga etter ein verdi (koroplettkart) frå ein geometrikolonne, sjå *Kart* nedanfor |
| Punktkart | Punkt frå lengde- og breiddegrad (eller SWEREF 99 TM) med storleik og farge etter verdiar, over kommune- eller länsgrenser |

For kvar kanal (X, Y, Farge, Storleik, Små panel) vel du kolonne, korleis han skal tolkast (tal, kategori, ordna
kategori, tid), utrekning (sum, gjennomsnitt, median, minste, største, tal, tal på unike), sortering, tidseining og
aksetittel. Andre innstillingar: tittel og undertittel, talformat, høgd, plasseringa av forklaringa, stabling (stabla,
prosent, overlappande), verdietikettar på stolpar og punkt på linjer. **Filter** avgrensar radene med vilkår på
kolonnar. Under **Fleire alternativ** finst radgrense, fargeskala (sekvensiell eller divergerande) og **Eigen
Vega-Lite-spesifikasjon**: JSON-spesifikasjonen kan redigerast direkte for alt byggjaren ikkje dekkjer; data blir sette inn frå
datasettet når diagrammet blir teikna.

Diagrammet blir lagra som tilstanden til byggjaren (eller den eigne spesifikasjonen) saman med namnet og kortnamnet til datasettet, slik at
det kan gjenskapast på nye data med dei same kolonnane.

### Aksar og linjer

Avsnittet **Aksar og linjer** (alle diagramtypar unnateke sektor og kart) styrer aksane og legg til linjer. Tomme
felt gjev automatiske verdiar.

| Innstilling | Kva ho gjer |
|---|---|
| Minste og største verdi på verdiaksen | Faste grenser for verdiaksen (Y, eller X i liggjande stolpar), til dømes 0–100 for prosent eller same skala i fleire diagram. Det som hamnar utanfor grensene, blir klipt bort |
| Minste og største verdi på x-aksen | Blir vist når x-aksen er eit tal (punkt og linjer), til dømes for å zoome inn på eit intervall |
| Skala på verdiaksen | Lineær, logaritmisk (for verdiar som spenner over fleire tiarpotensar; krev positive verdiar) eller kvadratrot |
| Start verdiaksen på null | På som standard; slå av for å la aksen byrje nær den minste verdien, til dømes for temperaturar |
| Vinkelen på etikettane | Automatisk, 0°, 45° eller 90° for kategoriar med lange namn |
| Rutenett | Rutenettet bak diagrammet, på som standard |
| Referanselinje ved verdien | Ei stipla linje ved ein verdi på verdiaksen, til dømes eit mål eller eit landsgjennomsnitt, med valfri tekst |
| Trendlinje | Punkt og linjer med eit tal på x-aksen: rett linje (lineær regresjon) eller utjamna kurve (loess), éi per fargegruppe |
| Dekning | Kor ugjennomsiktige punkt, flater og stolpar er (0,05–1), til dømes ved mange overlappande punkt |

Referanse- og trendlinjer blir ikkje teikna i diagram med små panel. Innstillingane blir lagra med diagrammet og følgjer
med i delte diagramfiler og batchkøyringar.

**Liste** under filtera vel eit lagra søk frå Søk som radene i diagrammet blir henta frå (valet blir berre vist når
datasettet har lister). Lista blir køyrd igjen kvar gong diagrammet blir teikna, så diagrammet følgjer dagens data, og
filtera blir lagde oppå. Valet blir lagra med diagrammet og gjeld òg i dashbord og eksportar.

## D3-malar

- **Rangering**: éi rad per kategori sortert etter verdi, med prikk og strek. Vel kategori, verdi, utrekning, tal og
  rekkjefølgje.
- **Hellingsdiagram**: to periodar per kategori med ein strek imellom; grøne strekar aukar, raude minkar.
- **Befolkningspyramide**: grupper (aldrar) som stolpar i to retningar, til dømes kvinner og menn.

Malane er skrivne i D3 med stilmodulen til appen og gjev vektorgrafikk som blir eksportert uendra.

## R-skript

Skriptet blir køyrt i R-sesjonen med datasettet lese inn som `df` (lese med kortnamnet). Teikn med ggplot2 eller basisgrafikk;
`theme_dataspatium()` og `dm_palette()` gjev utsjånaden til appen. Det siste diagrammet blir vist og lagra med skriptet. Eksport skjer
via R (svglite for SVG, `png()` og `pdf()`), og batchkøyringar køyrer skriptet éin gong per gruppe med `df` filtrert.
Ctrl+Enter køyrer skriptet.

## Python-skript

Skriptet blir køyrt i Python-sesjonen med datasettet lasta inn som `df` (pandas). Teikn med matplotlib (`fig, ax =
plt.subplots()`) eller plotly (`fig.show()`); `theme_dataspatium()` blir sett automatisk. Det siste diagrammet blir vist og
lagra med skriptet; eit plotly-diagram blir dessutan lagra som figur og vist interaktivt i dashbord og publisert HTML.
Python startar med *Start Python* eller *Køyr* (blir henta første gongen, sjå [python.md](python.md)). Eksport og batch per
gruppe fungerer som for R-skript.

## Eksporter

**Eksporter** opnar ein dialog med format (PNG, SVG, PDF, PowerPoint), breidd, høgd, skala for PNG og filnamn. PNG blir teikna i
nettlesaren med skrifttypen til appen. SVG har skrifttypen innebygd, så fila ser lik ut på andre datamaskiner. PDF er
vektorgrafikk (jsPDF og svg2pdf.js); tekst blir sett med PDF-standardskrifttypen Helvetica. PowerPoint (pptx, via PptxGenJS)
gjev ein presentasjon med eit tittellysbilete og diagrammet som bilete i høg oppløysing; i modusen Eksporter finst dessutan
**Alle diagram som PowerPoint**, eitt lysbilete per lagra diagram. Diagramma kan òg eksporterast frå modusen
Eksporter, der alle lagra diagram blir viste.

## Batch per gruppe

**Batch per gruppe** lagar diagrammet éin gong per verdi i ein grupperingskolonne (til dømes kvar kommune eller kvart år),
filtrert på verdien og med verdien i tittelen, og pakkar alle filer i ei ZIP-fil saman med `manifest.json`. Vel kolonne,
format (eitt eller fleire), mønster for filnamn (`{diagram}` og `{grupp}` blir erstatta), breidd og høgste tal på grupper.
Køyringa kan avbrytast. Grupper som mislukkast, blir viste i manifestet. Formatet PowerPoint gjev i staden for ei ZIP-fil éin
presentasjon med eitt lysbilete per gruppe.

## Galleri og panel

**Galleri** viser alle lagra diagram som kort med miniatyr, datasett og tidspunkt. Vel tal på kolonnar, og trykk
**Teikn alle (panel)** for å teikne diagramma live side om side. Herifrå blir diagram opna, eksporterte og sletta.

## Kart
I tillegg til koroplettkartet og punktkartet nedanfor finst diagramtypen **Kart**: ei kartvising med Leaflet, fleire lag, bakgrunnskart og zoom. Ho er skildra i [kartor.md](kartor.md).

To diagramtypar teiknar kart, begge utan karttenar: **Kart** (koroplettkart: område farga etter ein verdi) og **Punktkart**
(punkt på koordinatar med storleik og farge etter verdiar). Kommune- og regiongrenser for Sverige, Danmark, Noreg og
Finland følgjer med appen; grenser for andre land blir importerte frå GeoJSON, shapefile eller GeoPackage.

![Koroplettkart over folketal per kommune og punktkart over målestasjonar i eit dashbord](../images/kartor.png)

### Koroplettkart (Kart)

1. Hent grensene: vel til dømes **Norske kommunegrenser (Kartverket)** eller **Svenske kommunegrenser (SCB)** i
   lista *Grenser for kart* i Hent, og trykk **Importer grenser**, eller importer eigne grenser frå GeoJSON, shapefile
   eller GeoPackage. Dei blir datasett med kode, namn og ein geometrikolonne (`geometry`, GeoJSON i lengde- og breiddegrad).
   Kodane er dei offisielle: firesifra kommunenummer i Sverige, Danmark (DAGI, som `0101`; Danmarks Statistik skriv
   `101`) og Noreg, tresifra i Finland (som `091`; StatFin skriv `KU091`). Avvik kodane i statistikken, kan dei
   tilpassast i Bearbeid med *Fyll ut med innleiande nullar* eller *Søk og erstatt*.
2. Kople verdiane til grensene i Bearbeid (*Kople datasett*) på koden, slik at datasettet har både `geometry` og verdien som
   skal fargeleggjast. Alternativt er verdiane allereie importerte saman med geometrien.
3. Vel *Kart* i diagrambyggjaren. Geometrikolonnen blir funnen automatisk (kolonnen `geometry`), etiketten er ein tekstkolonne
   som blir vist når du peikar på eit område, og verdien styrer fargen med den sekvensielle skalaen til appen (vel divergerande under
   *Fleire alternativ* for avvik rundt ein midtverdi).

Geometrikolonnen kan innehalde GeoJSON eller WKT (`POLYGON((...))`, `POINT(...)` med fleire, òg med `SRID=...;`-prefiks),
slik at eksportar frå GeoPackage, PostGIS og rekneark fungerer direkte.

### Punktkart

Vel *Punktkart* for eit datasett med koordinatar, til dømes vêrstasjonar eller adresser med lengde- og breiddegrad.
Kolonnane blir funne på namn (`longitude`/`latitude`, `lon`/`lat`, `x`/`y`, `öst`/`norr`) og kan bytast. Koordinatar i meter
(SWEREF 99 TM) blir kjende att og rekna om til lengde- og breiddegrad. **Storleik** og **Farge** tek verdikolonnar (eller ein
kategori for fargen), **Etikett** blir vist når du peikar på eit punkt, og **Bakgrunn** vel ei av grensene som følgjer med
eller ingen bakgrunn. Har datasettet område i staden for punkt, gjev *Bearbeid > Geodata > Sentroide frå geometri* lengde-
og breiddegrad for kvart område, slik at verdiar kan teiknast som bobler.

### Projeksjon og grenser

Projeksjonen blir vald ut frå koordinatane: meter (SWEREF 99 TM) blir teikna som dei er, lengde- og breiddegrad innanfor Europa
gjennom ein transversal Mercator rundt rutenettmeridianen i landet der dataa ligg (9° aust for Danmark, 15° aust for
Sverige og Noreg, 27° aust for Finland), og andre gjennom Mercator. Grensene som følgjer med er forenkla for tematiske
kart og ikkje meinte for nøyaktige grensedragingar: kommune- og länsgrensene frå SCB (CC0, versjon februar 2026), DAGI
1:500 000 for Danmark, N1000 frå Kartverket for Noreg (klipt langs kysten, sidan norske kommunar elles strekkjer seg ut i
havet) og inndelinga 1:1 000 000 frå Statistikcentralen for Finland (sjå `presets/geo/KALLA.md`). Kart blir eksporterte, delte,
lagde i dashbord og køyrde i batch som alle andre diagram i byggjaren; filter i dashbord verkar òg på kart. Eit
datasett med geometri kan eksporterast som GeoJSON frå Eksporter.

## Høgdeprofil langs ei linje

*Nytt diagram* tilbyr **Høgdeprofil langs ei linje** for eit datasett med ein geometrikolonne. Vel kolonnen, korleis linjene skal
namngjevast, kor mange rader frå toppen som skal teiknast (høgst 50) og steget i meter (10 som standard). Appen tek eitt punkt per
steg langs kvar linje, hentar høgda frå Lantmäteriets terrengmodell med nøkkelen i kjelda *Lantmäteriet STAC* (sjå
[kallor.md](kallor.md)) og lagrar resultatet som eit nytt datasett med kolonnane `linje`, `avstand_m`, `hojd_m`, `ost` og `nord`
(SWEREF 99 TM) og som eit linjediagram med avstanden på x-aksen og høgda på y-aksen, éi linje per rad. Punkt utanfor modellen får
inga høgd, og til saman vert høgst 5 000 punkt henta om gongen. Diagrammet og datasettet er vanlege: dei kan endrast i
diagrambyggjaren, leggjast på eit dashbord og eksporterast.

## Dashbord

Eit dashbord er eit namngjeve utval av lagra diagram i eit rutenett med felles filter. Lag eitt med **Nytt dashbord** i
objektpanelet, gje det eit namn, og klikk på **Legg til diagram** for å velje blant dei lagra diagramma. Kvart kort kan gjerast
breiare (éin, to eller tre kolonnar), flyttast opp eller ned, opnast i byggjaren eller fjernast frå dashbordet; tal på kolonnar i
rutenettet og ei skildring blir sette i eigenskapspanelet. Alle endringar blir lagra automatisk.

**Filter** viser kolonnane som finst i alle datasett diagramma i dashbordet brukar (tekst, heiltal, dato og ja/nei). Kvart
valt filter blir ein veljar over diagramma, og valet gjeld alle Vega- og D3-diagram samtidig (R- og Python-diagram blir viste som
lagra bilete). Filtera blir lagde til dei eigne filtera til diagramma.

Dashbordet blir eksportert som frittståande **HTML** (diagramma som innebygd SVG, med dei aktive filtera oppgjevne), som
**PowerPoint** (tittellysbilete pluss eitt lysbilete per diagram) eller delt som `*.dash.json`, ei fil som inneheld
definisjonane til diagramma. Ved import blir diagramma kopla til eksisterande diagram med same namn og datasett; dei som
manglar, blir gjenskapte frå fila. Tryggingskopien og den portable mappa inneheld alle dashbord. Dashbord kan òg opnast via
kommandopaletten (Ctrl+K) og eksporterast frå modusen Eksporter.

**Presenter** viser dashbordet i heile vindauget, på ein stor skjerm eller ein projektor: knappen finst i tittelrada til dashbordet
og kommandoen *Presenter: namn* i kommandopaletten. Oversynet viser alle diagram; høgre- og venstrepil
(eller mellomrom og Page Up/Page Down) går eitt diagram om gongen i stor storleik, Home viser oversynet igjen, F
vekslar fullskjerm der nettlesaren tillèt det, og Esc avsluttar. Dei felles filtera blir verande i rada øvst og
gjeld alle diagram. Ingenting blir endra i dashbordet under presentasjonen.

**Krossfilter.** Klikk på ein stolpe i eit diagram, så viser dei andre diagramma berre den verdien, om dei har kolonnen. Diagrammet du klikka i, blir halde heilt, slik at du kan velje ein annan stolpe. Filteret står over diagramma og blir fjerna med eit klikk. Eksporterer du dashbordet, følgjer filteret med.

## Del diagram

**Eksporter konfigurasjon** lastar ned diagrammet som `*.viz.json` utan data. Ein annan brukar legg til fila med
**Importer diagram (fil)**; diagrammet blir kopla til eit datasett med same kortnamn eller namn i det arbeidsområdet.
Tryggingskopien av arbeidsområdet (Handter) inneheld alle diagram som slike filer.

## Avgrensingar

- Diagramma lever i nettlesaren; svært store datasett utan aggregering blir avgrensa til radgrensa.
- PDF brukar Helvetica, ikkje Inter, for tekst.
- R- og Python-diagram blir køyrde i motoren sin ved eksport, batch, dokument og PowerPoint; det tek nokre sekund per diagram, og Python blir henta første gongen.
- Grensene som følgjer med er forenkla for tematiske kart, ikkje nøyaktige grenser.
- PowerPoint-eksport brukar bilete (PNG) av diagramma, ikkje redigerbare PowerPoint-diagram.
