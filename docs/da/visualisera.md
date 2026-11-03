# Visualisér

Tilstanden Visualisér laver diagrammer af datasættene med tre motorer, der alle bruger appens palet, skrifttype og
talformat: en diagrambygger (Vega-Lite), færdige D3-skabeloner og R-scripts (ggplot2). Diagrammer gemmes i
arbejdsområdet, kan eksporteres som SVG, PNG og PDF, deles som filer og oprettes i batch pr. gruppe.

## Opret et diagram

1. Vælg et datasæt i objektpanelet, og tryk **Nyt diagram**.
2. Vælg motor: **Diagrambygger**, **D3-skabelon** eller **R-script**.
3. Giv diagrammet et navn i titelfeltet, og tryk **Gem**. Gemte diagrammer vises under Diagrammer i objektpanelet og i
   galleriet.

Forhåndsvisningen opdateres, mens du ændrer. Under diagrammet står, hvor mange rækker der blev brugt; store datasæt
aggregeres i SQL, når diagrammet kun behøver summer, gennemsnit eller antal, ellers begrænses antallet af rækker
(standard 50 000, ændres under Flere indstillinger).

## Diagrambyggeren (Vega-Lite)

| Diagramtype | Bruges til |
|---|---|
| Søjler, Liggende søjler | At sammenligne kategorier, med valgfri farveopdeling og stabling |
| Linje, Areal | Udvikling over tid eller ordnede kategorier |
| Punkter | Sammenhæng mellem to tal, farve og størrelse som ekstra dimensioner |
| Histogram | Fordeling af et tal i intervaller |
| Varmekort | To kategorier med en værdi som farve |
| Boksplot | Spredning pr. kategori |
| Cirkel | Andele af en helhed (få kategorier) |
| Kort | Områder farvet efter en værdi (koropletkort) fra en geometrikolonne, se *Kort* nedenfor |
| Punktkort | Punkter fra længde- og breddegrad (eller SWEREF 99 TM) med størrelse og farve efter værdier, over kommune- eller länsgrænser |

For hver kanal (X, Y, Farve, Størrelse, Små paneler) vælger du kolonne, hvordan den skal fortolkes (tal, kategori, ordnet
kategori, tid), beregning (sum, gennemsnit, median, mindste, største, antal, antal unikke), sortering, tidsenhed og
aksetitel. Øvrige indstillinger: titel og undertitel, talformat, højde, forklaringens placering, stabling (stablet,
procent, overlappende), værdietiketter på søjler og punkter på linjer. **Filtre** begrænser rækkerne med betingelser på
kolonner. Under **Flere indstillinger** findes rækkegrænse, farveskala (sekventiel eller divergerende) og **Egen
Vega-Lite-specifikation**: JSON-specifikationen kan redigeres direkte for alt, hvad byggeren ikke dækker; data indsættes
fra datasættet, når diagrammet gengives.

Diagrammet gemmes som byggerens tilstand (eller den egne specifikation) sammen med datasættets navn og kortnavn, så det kan
genskabes på nye data med de samme kolonner.

### Akser og linjer

Afsnittet **Akser og linjer** (alle diagramtyper undtagen cirkel og kort) styrer akserne og tilføjer linjer. Tomme
felter giver automatiske værdier.

| Indstilling | Hvad den gør |
|---|---|
| Værdiaksens mindste og største værdi | Faste grænser for værdiaksen (Y, eller X i liggende søjler), for eksempel 0–100 for procent eller samme skala i flere diagrammer. Det, der falder uden for grænserne, klippes væk |
| X-aksens mindste og største værdi | Vises, når x-aksen er et tal (punkter og linjer), for eksempel for at zoome ind på et interval |
| Skala på værdiaksen | Lineær, logaritmisk (for værdier, der spænder over flere tierpotenser; kræver positive værdier) eller kvadratrod |
| Begynd værdiaksen ved nul | Slået til som standard; slå fra for at lade aksen begynde nær den mindste værdi, for eksempel for temperaturer |
| Etiketternes vinkel | Automatisk, 0°, 45° eller 90° for kategorier med lange navne |
| Gitterlinjer | Gitteret bag diagrammet, slået til som standard |
| Referencelinje ved værdien | En stiplet linje ved en værdi på værdiaksen, for eksempel et mål eller et landsgennemsnit, med valgfri tekst |
| Trendlinje | Punkter og linjer med et tal på x-aksen: ret linje (lineær regression) eller udjævnet kurve (loess), én pr. farvegruppe |
| Dækning | Hvor uigennemsigtige punkter, flader og søjler er (0,05–1), for eksempel ved mange overlappende punkter |

Reference- og trendlinjer tegnes ikke i diagrammer med små paneler. Indstillingerne gemmes med diagrammet og følger
med i delte diagramfiler og batchkørsler.

## D3-skabeloner

- **Rangering**: én række pr. kategori sorteret efter værdi, med prik og streg. Vælg kategori, værdi, beregning, antal og
  rækkefølge.
- **Hældningsdiagram**: to perioder pr. kategori med en streg imellem; grønne streger stiger, røde falder.
- **Befolkningspyramide**: grupper (aldre) som søjler i to retninger, for eksempel kvinder og mænd.

Skabelonerne er skrevet i D3 med appens stilmodul og giver vektorgrafik, der eksporteres uændret.

## R-scripts

Scriptet køres i R-sessionen med datasættet indlæst som `df` (læst med dets kortnavn). Tegn med ggplot2 eller basisgrafik;
`theme_dataspatium()` og `dm_palette()` giver appens udseende. Det seneste diagram vises og gemmes med scriptet. Eksport sker
via R (svglite til SVG, `png()` og `pdf()`), og batchkørsler kører scriptet én gang pr. gruppe med `df` filtreret.
Ctrl+Enter kører scriptet.

## Eksportér

**Eksportér** åbner en dialog med format (PNG, SVG, PDF, PowerPoint), bredde, højde, skala for PNG og filnavn. PNG tegnes i
browseren med appens skrifttype. SVG indeholder skrifttypen indlejret, så filen ser ens ud på andre computere. PDF er
vektorgrafik (jsPDF og svg2pdf.js); tekst sættes med PDF-standardskrifttypen Helvetica. PowerPoint (pptx, via PptxGenJS)
giver en præsentation med et titeldias og diagrammet som billede i høj opløsning; i tilstanden Eksportér findes desuden
**Alle diagrammer som PowerPoint**, ét dias pr. gemt diagram. Diagrammerne kan også eksporteres fra tilstanden Eksportér,
hvor alle gemte diagrammer vises.

## Batch pr. gruppe

**Batch pr. gruppe** opretter diagrammet én gang pr. værdi i en grupperingskolonne (for eksempel hver kommune eller hvert
år), filtreret på værdien og med værdien i titlen, og pakker alle filer i en ZIP sammen med `manifest.json`. Vælg kolonne,
format (et eller flere), mønster for filnavn (`{diagram}` og `{grupp}` erstattes), bredde og højeste antal grupper. Kørslen
kan afbrydes. Grupper, der mislykkes, vises i manifestet. Formatet PowerPoint giver i stedet for en ZIP én præsentation med
ét dias pr. gruppe.

## Galleri og panel

**Galleri** viser alle gemte diagrammer som kort med miniature, datasæt og tidspunkt. Vælg antal kolonner, og tryk
**Gengiv alle (panel)** for at tegne diagrammerne live side om side. Herfra åbnes, eksporteres og slettes diagrammer.

## Kort

To diagramtyper tegner kort, begge uden kortserver: **Kort** (koropletkort: områder farvet efter en værdi) og **Punktkort**
(punkter på koordinater med størrelse og farve efter værdier). Kommune- og regionsgrænser for Sverige, Danmark, Norge og
Finland følger med appen; grænser for andre lande importeres fra GeoJSON, shapefile eller GeoPackage.

![Koropletkort over befolkning pr. kommune og punktkort over målestationer i et dashboard](../images/kartor.png)

### Koropletkort (Kort)

1. Hent grænserne: vælg for eksempel **Danske kommunegrænser (DAGI)** eller **Svenske kommunegrænser (SCB)** i listen
   *Grænser til kort* i Hent, og tryk **Importér grænser**, eller importér egne grænser fra GeoJSON, shapefile eller
   GeoPackage. De bliver datasæt med kode, navn og en geometrikolonne (`geometry`, GeoJSON i længde- og breddegrad).
   Koderne er de officielle: firecifrede kommunekoder i Sverige, Danmark (DAGI, som `0101`; Danmarks Statistik skriver
   `101`) og Norge, trecifrede i Finland (som `091`; StatFin skriver `KU091`). Afviger koderne i statistikken, kan de
   tilpasses i Bearbejd med *Udfyld med foranstillede nuller* eller *Søg og erstat*.
2. Kobl værdierne til grænserne i Bearbejd (*Sammenkobl datasæt*) på koden, så datasættet har både `geometry` og den værdi,
   der skal farvelægges. Alternativt er værdierne allerede importeret sammen med geometrien.
3. Vælg *Kort* i diagrambyggeren. Geometrikolonnen findes automatisk (kolonnen `geometry`), etiketten er en tekstkolonne,
   der vises, når du peger på et område, og værdien styrer farven med appens sekventielle skala (vælg divergerende under
   *Flere indstillinger* for afvigelser omkring en midterværdi).

Geometrikolonnen må indeholde GeoJSON eller WKT (`POLYGON((...))`, `POINT(...)` med flere, også med `SRID=...;`-præfiks),
så eksporter fra GeoPackage, PostGIS og regneark fungerer direkte.

### Punktkort

Vælg *Punktkort* til et datasæt med koordinater, for eksempel vejrstationer eller adresser med længde- og breddegrad.
Kolonnerne findes på navn (`longitude`/`latitude`, `lon`/`lat`, `x`/`y`, `öst`/`norr`) og kan skiftes. Koordinater i meter
(SWEREF 99 TM) genkendes og omregnes til længde- og breddegrad. **Størrelse** og **Farve** tager værdikolonner (eller en
kategori til farven), **Etiket** vises, når du peger på et punkt, og **Baggrund** vælger en af de
medfølgende grænser eller ingen baggrund. Har datasættet områder i stedet for punkter, giver *Bearbejd > Geodata > Centroide
fra geometri* længde- og breddegrad for hvert område, så værdier kan tegnes som bobler.

### Projektion og grænser

Projektionen vælges ud fra koordinaterne: meter (SWEREF 99 TM) tegnes, som de er, længde- og breddegrad inden for Europa
gennem en transversal Mercator omkring gittermeridianen i det land, hvor dataene ligger (9° øst for Danmark, 15° øst for
Sverige og Norge, 27° øst for Finland), og øvrige gennem Mercator. De medfølgende grænser er forenklede til tematiske kort
og ikke beregnet til nøjagtige grænsedragninger: SCB's kommune- og länsgrænser (CC0, version februar 2026), DAGI
1:500 000 for Danmark, Kartverkets N1000 for Norge (skåret langs kysten, da norske kommuner ellers rækker ud i havet) og
Statistikcentralens inddeling 1:1 000 000 for Finland (se `presets/geo/KALLA.md`). Kort eksporteres, deles, lægges i
dashboards og køres i batch som alle andre diagrammer i byggeren; filtre i dashboards virker også på kort. Et datasæt med
geometri kan eksporteres som GeoJSON fra Eksportér.

## Dashboards

Et dashboard er et navngivet udvalg af gemte diagrammer i et gitter med fælles filtre. Opret et med **Nyt dashboard** i
objektpanelet, giv det et navn, og klik på **Tilføj diagram** for at vælge blandt de gemte diagrammer. Hvert kort kan gøres
bredere (en, to eller tre kolonner), flyttes op eller ned, åbnes i byggeren eller fjernes fra dashboardet; antal kolonner i
gitteret og en beskrivelse sættes i egenskabspanelet. Alle ændringer gemmes automatisk.

**Filtre** viser de kolonner, der findes i alle datasæt, dashboardets diagrammer bruger (tekst, heltal, dato og ja/nej).
Hvert valgt filter bliver en vælger over diagrammerne, og valget gælder alle Vega- og D3-diagrammer på én gang
(R-diagrammer vises som gemt billede). Filtrene lægges til diagrammernes egne filtre.

Dashboardet eksporteres som selvstændig **HTML** (diagrammerne som indlejret SVG, med de aktive filtre angivet), som
**PowerPoint** (titeldias plus ét dias pr. diagram) eller deles som `*.dash.json`, en fil, der indeholder diagrammernes
definitioner. Ved import kobles diagrammerne til eksisterende diagrammer med samme navn og datasæt; de manglende genskabes
fra filen. Backuppen og den portable mappe indeholder alle dashboards. Dashboards kan også åbnes via kommandopaletten
(Ctrl+K) og eksporteres fra tilstanden Eksportér.

## Del diagrammer

**Eksportér konfiguration** downloader diagrammet som `*.viz.json` uden data. En anden bruger tilføjer filen med
**Importér diagram (fil)**; diagrammet kobles til et datasæt med samme kortnavn eller navn i det arbejdsområde. Backuppen af
arbejdsområdet (Håndter) indeholder alle diagrammer som sådanne filer.

## Begrænsninger

- Diagrammerne lever i browseren; meget store datasæt uden aggregering begrænses til rækkegrænsen.
- PDF bruger Helvetica, ikke Inter, til tekst.
- R-diagrammer kræver, at R-sessionen er startet, og eksporteres derfor kun fra Visualisér.
- De medfølgende grænser er forenklede til tematiske kort, ikke nøjagtige grænser.
- PowerPoint-eksport bruger billeder (PNG) af diagrammerne, ikke redigerbare PowerPoint-diagrammer.
