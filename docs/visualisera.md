# Visualisera

Läget Visualisera gör diagram av datamängderna med tre motorer som alla använder appens palett, typsnitt och
talformat: en diagrambyggare (Vega-Lite), färdiga D3-mallar och R-skript (ggplot2). Diagram sparas i
arbetsytan, kan exporteras som SVG, PNG och PDF, delas som filer och skapas i batch per grupp.

## Skapa ett diagram

1. Välj en datamängd i objektpanelen och tryck **Nytt diagram**.
2. Välj motor: **Diagrambyggare**, **D3-mall** eller **R-skript**.
3. Ge diagrammet ett namn i rubrikfältet och tryck **Spara**. Sparade diagram listas under Diagram i objektpanelen
   och i galleriet.

Förhandsgranskningen uppdateras medan du ändrar. Under diagrammet står hur många rader som användes; stora
datamängder aggregeras i SQL när diagrammet bara behöver summor, medelvärden eller antal, annars begränsas
antalet rader (standard 50 000, ändras under Fler alternativ).

## Diagrambyggaren (Vega-Lite)

| Diagramtyp | Används för |
|---|---|
| Staplar, Liggande staplar | Jämföra kategorier, med valfri färguppdelning och stapling |
| Linje, Yta | Utveckling över tid eller ordnade kategorier |
| Punkter | Samband mellan två tal, färg och storlek som extra dimensioner |
| Histogram | Fördelning av ett tal i intervall |
| Värmekarta | Två kategorier med ett värde som färg |
| Låddiagram | Spridning per kategori |
| Cirkel | Andelar av en helhet (få kategorier) |
| Karta | Ytor färgade efter ett värde (koropletkarta) ur en geometrikolumn, se *Kartor* nedan |
| Punktkarta | Punkter ur longitud och latitud (eller SWEREF 99 TM) med storlek och färg efter värden, över kommun- eller länsgränser |

För varje kanal (X, Y, Färg, Storlek, Småbilder) väljer du kolumn, hur den ska tolkas (tal, kategori, ordnad
kategori, tid), beräkning (summa, medel, median, minsta, största, antal, antal unika), sortering, tidsenhet
och axelrubrik. Övriga inställningar: rubrik och underrubrik, talformat, höjd, förklaringens placering, stapling
(staplade, procent, överlappande), värdeetiketter på staplar och punkter på linjer. **Filter** begränsar raderna
med villkor på kolumner. Under **Fler alternativ** finns radgräns, färgskala (sekventiell eller divergerande)
och **Egen Vega-Lite-specifikation**: JSON-specifikationen kan redigeras direkt för allt som byggaren inte
täcker; data läggs in från datamängden när diagrammet renderas.

Diagrammet sparas som byggarens tillstånd (eller den egna specifikationen) tillsammans med datamängdens namn, så
det kan återskapas på nya data med samma kolumner.

## D3-mallar

- **Rangordning**: en rad per kategori sorterad efter värde, med punkt och linje. Välj kategori, värde,
  beräkning, antal och ordning.
- **Lutningsdiagram**: två perioder per kategori med en linje emellan; gröna linjer ökar, röda minskar.
- **Befolkningspyramid**: grupper (åldrar) som staplar åt två håll, till exempel kvinnor och män.

Mallarna är skrivna i D3 med appens stilmodul och ger vektorgrafik som exporteras oförändrad.

## R-skript

Skriptet körs i R-sessionen med datamängden inläst som `df`. Rita med ggplot2 eller basgrafik;
`theme_dataspatium()` och `dm_palette()` ger appens utseende. Det senaste diagrammet visas och sparas med skriptet.
Export sker via R (svglite för SVG, `png()` och `pdf()`), och batchkörningar kör skriptet en gång per grupp med
`df` filtrerat. Ctrl+Enter kör skriptet.

## Exportera

**Exportera** öppnar en dialog med format (PNG, SVG, PDF, PowerPoint), bredd, höjd, skala för PNG och filnamn.
PNG ritas i webbläsaren med appens typsnitt. SVG innehåller typsnittet inbäddat så att filen ser likadan ut på
andra datorer. PDF är vektorgrafik (jsPDF och svg2pdf.js); text sätts med PDF-standardtypsnittet Helvetica.
PowerPoint (pptx, via PptxGenJS) ger en presentation med en titelbild och diagrammet som bild i hög upplösning; i
läget Exportera finns dessutom **Alla diagram som PowerPoint**, en bild per sparat diagram. Diagrammen kan också
exporteras från läget Exportera, där alla sparade diagram listas.

## Batch per grupp

**Batch per grupp** skapar diagrammet en gång per värde i en grupperingskolumn (till exempel varje kommun eller
år), filtrerat på värdet och med värdet i rubriken, och packar alla filer i en ZIP tillsammans med `manifest.json`.
Välj kolumn, format (ett eller flera), filnamnsmönster (`{diagram}` och `{grupp}` ersätts), bredd och högsta
antal grupper. Körningen kan avbrytas. Grupper som misslyckas listas i manifestet. Formatet PowerPoint ger i
stället för en ZIP en enda presentation med en bild per grupp.

## Galleri och panel

**Galleri** visar alla sparade diagram som kort med miniatyr, datamängd och tidpunkt. Välj antal kolumner, och
tryck **Rendera alla (panel)** för att rita diagrammen live sida vid sida. Härifrån öppnas, exporteras och tas
diagram bort.

## Kartor

Två diagramtyper ritar kartor, båda utan kartserver: **Karta** (koropletkarta: ytor färgade efter ett värde)
och **Punktkarta** (punkter på koordinater, med storlek och färg efter värden). SCB:s kommun- och länsgränser
följer med appen, så en karta över Sveriges kommuner eller län kräver ingen nedladdning.

![Koropletkarta över folkmängd per kommun och punktkarta över mätstationer i en dashboard](images/kartor.png)

### Koropletkarta (Karta)

1. Hämta gränserna: klicka på **Kommungränser (SCB)** eller **Länsgränser (SCB)** i Inhämta. De blir
   datamängder med kommunkod eller länskod, namn och en geometrikolumn (`geometry`, GeoJSON i longitud och
   latitud). Egna gränser importeras från GeoJSON, shapefile (till exempel SCB:s *Digitala gränser* i
   SWEREF 99 TM; förenkla gärna med toleransen 100 meter) eller GeoPackage.
2. Koppla värdena till gränserna i Bearbeta (*Koppla*) på kommunkoden eller länskoden, så att datamängden får
   både `geometry` och det värde som ska färgläggas. Alternativt har värdena redan importerats tillsammans med
   geometrin.
3. Välj *Karta* i diagrambyggaren. Geometrikolumnen hittas automatiskt (kolumnen `geometry`), etiketten är en
   textkolumn som visas när du pekar på en yta, och värdet styr färgen med appens sekventiella skala (välj
   divergerande under *Fler alternativ* för avvikelser kring ett mittvärde).

Geometrikolumnen får innehålla GeoJSON eller WKT (`POLYGON((...))`, `POINT(...)` med flera, även med
`SRID=...;`-prefix), så att exporter från GeoPackage, PostGIS och kalkylblad fungerar direkt.

### Punktkarta

Välj *Punktkarta* för en datamängd med koordinater, till exempel SMHI:s mätstationer eller adresser med
longitud och latitud. Kolumnerna hittas på namn (`longitude`/`latitude`, `lon`/`lat`, `x`/`y`, `öst`/`norr`)
och kan bytas. Koordinater i meter (SWEREF 99 TM) känns igen och räknas om till longitud och latitud.
**Storlek** och **Färg** tar värdekolumner (eller en kategori för färgen), **Etikett** visas när du pekar på en
punkt och **Bakgrund** väljer länsgränser, kommungränser eller ingen bakgrund. Har datamängden ytor i stället
för punkter (till exempel kommuner) ger *Bearbeta > Geodata > Mittpunkt ur geometri* longitud och latitud för
varje yta, så att värden kan ritas som bubblor per kommun.

### Projektion och gränser

Projektionen väljs av koordinaterna: meter (SWEREF 99 TM) ritas som de är, longitud och latitud inom Europa
genom en transversal Mercator kring 15° öst (samma utseende som SWEREF 99 TM) och övriga genom Mercator. De
medföljande gränserna är SCB:s förenklade kommun- och länsgränser för tematiska kartor (CC0, version februari
2026), omräknade till longitud och latitud; de är inte avsedda för exakta gränsdragningar (se
`presets/geo/KALLA.md`). Kartor exporteras, delas, läggs i dashboards och körs i batch som alla andra diagram
i byggaren; filter i dashboards fungerar också på kartor. En datamängd med geometri kan exporteras som GeoJSON
från Exportera.

## Dashboards

En dashboard är ett namngivet urval av sparade diagram i ett rutnät med gemensamma filter. Skapa en med **Ny
dashboard** i objektpanelen, ge den ett namn och klicka på **Lägg till diagram** för att välja bland de sparade
diagrammen. Varje kort kan göras bredare (en, två eller tre kolumner), flyttas upp eller ned, öppnas i byggaren
eller tas bort från dashboarden; antal kolumner i rutnätet och en beskrivning sätts i egenskapspanelen. Alla
ändringar sparas automatiskt.

**Filter** visar de kolumner som finns i alla datamängder som dashboardens diagram använder (text, heltal, datum
och ja/nej). Varje valt filter blir en väljare ovanför diagrammen, och valet gäller alla Vega- och D3-diagram
samtidigt (R-diagram visas som sparad bild). Filtren läggs till diagrammens egna filter.

Dashboarden exporteras som fristående **HTML** (diagrammen som inbäddad SVG, med de aktiva filtren angivna), som
**PowerPoint** (titelbild plus en bild per diagram) eller delas som `*.dash.json`, en fil som innehåller
diagrammens definitioner. Vid import kopplas diagrammen till befintliga diagram med samma namn och datamängd; de
som saknas återskapas ur filen. Säkerhetskopian och den portabla mappen innehåller alla dashboards. Dashboards kan
också öppnas via kommandopaletten (Ctrl+K) och exporteras från läget Exportera.

## Dela diagram

**Exportera konfiguration** laddar ned diagrammet som `*.viz.json` utan data. En annan användare lägger till filen
med **Importera diagram (fil)**; diagrammet kopplas till en datamängd med samma namn i den arbetsytan.
Säkerhetskopian av arbetsytan (Hantera) innehåller alla diagram som sådana filer.

## Begränsningar

- Diagrammen lever i webbläsaren; mycket stora datamängder utan aggregering begränsas till radgränsen.
- PDF använder Helvetica, inte Inter, för text.
- R-diagram kräver att R-sessionen är startad och exporteras därför bara från Visualisera.
- De medföljande kommun- och länsgränserna är SCB:s förenklade gränser för tematiska kartor, inte exakta gränser;
  hämta exakta gränser från Lantmäteriet och importera dem som GeoPackage eller shapefile.
- PowerPoint-export använder bilder (PNG) av diagrammen, inte redigerbara PowerPoint-diagram.
