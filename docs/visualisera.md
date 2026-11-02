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

**Exportera** öppnar en dialog med format (PNG, SVG, PDF), bredd, höjd, skala för PNG och filnamn. PNG ritas i
webbläsaren med appens typsnitt. SVG innehåller typsnittet inbäddat så att filen ser likadan ut på andra datorer.
PDF är vektorgrafik (jsPDF och svg2pdf.js); text sätts med PDF-standardtypsnittet Helvetica. Diagrammen kan
också exporteras från läget Exportera, där alla sparade diagram listas.

## Batch per grupp

**Batch per grupp** skapar diagrammet en gång per värde i en grupperingskolumn (till exempel varje kommun eller
år), filtrerat på värdet och med värdet i rubriken, och packar alla filer i en ZIP tillsammans med `manifest.json`.
Välj kolumn, format (ett eller flera), filnamnsmönster (`{diagram}` och `{grupp}` ersätts), bredd och högsta
antal grupper. Körningen kan avbrytas. Grupper som misslyckas listas i manifestet.

## Galleri och panel

**Galleri** visar alla sparade diagram som kort med miniatyr, datamängd och tidpunkt. Välj antal kolumner, och
tryck **Rendera alla (panel)** för att rita diagrammen live sida vid sida. Härifrån öppnas, exporteras och tas
diagram bort.

## Dela diagram

**Exportera konfiguration** laddar ned diagrammet som `*.viz.json` utan data. En annan användare lägger till filen
med **Importera diagram (fil)**; diagrammet kopplas till en datamängd med samma namn i den arbetsytan.
Säkerhetskopian av arbetsytan (Hantera) innehåller alla diagram som sådana filer.

## Begränsningar

- Diagrammen lever i webbläsaren; mycket stora datamängder utan aggregering begränsas till radgränsen.
- PDF använder Helvetica, inte Inter, för text.
- R-diagram kräver att R-sessionen är startad och exporteras därför bara från Visualisera.
- Kartor med kommungränser och interaktiva paneler med gemensamma filter kommer i en senare fas.
