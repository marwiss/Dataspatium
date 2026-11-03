# De sex lägena

Dataspatium är uppdelat i sex lägen som följer arbetets gång, i samma anda som statistikproduktionens
samla in, bearbeta, analysera och sprida: Inhämta, Hantera, Bearbeta, Analysera, Visualisera, Exportera. Alla
lägen har samma skelett: lägesväxlaren högst upp, objektpanelen till vänster, arbetsytan i mitten,
egenskapspanelen till höger och loggen längst ned. Panelerna byter aldrig plats. Alt+1 till Alt+6 växlar läge.
En tom arbetsyta öppnas i Inhämta, en arbetsyta med datamängder i Hantera.

Kommandopaletten (Ctrl+K eller förstoringsglaset högst upp) når allt från ett sökfält: växla läge, öppna en
datamängd, ett diagram eller en dashboard, köra en bearbetningsåtgärd på den valda datamängden, exportera, öppna
arbetsytan, byta tema eller söka efter uppdatering. Pil upp och ned väljer, Enter kör och Esc stänger; de senast
körda kommandona ligger överst.

## Inhämta

Här kommer data in: filer som släpps på ytan, inklistrad text, webbadresser och öppna API:er. Filimporten går i
steg: fil, inställningar med förhandsgranskning, kolumner med typer, klart. Format: CSV och annan avgränsad text,
text med fasta kolumnbredder, Excel, ODS, JSON (även JSON-stat och GeoJSON), XML, SQLite, GeoPackage, shapefile
samt via R: SPSS, Stata, SAS, PX, Parquet, RDS och RData (se
[format.md](format.md)); R-formaten importeras i ett steg utan förhandsgranskning. Under Öppna API:er finns förinställningar för
SCB (bläddra i ämnesträdet eller sök tabell), Folkhälsomyndigheten, Socialstyrelsen, Kolada, Eurostat, SMHI,
luftkvalitetsdata, Naturvårdsregistret, Lantmäteriets geodatakatalog och Sveriges dataportal, samt Boverket och
Lantmäteriet Direkt för den som har nycklar. Egna konfigurationer läggs till från fil och kan delas. Se
[api-konfiguration.md](api-konfiguration.md).

## Hantera

Datamängdernas hem. Översikt med metadata, kolumnlista, historik över det som gjorts med datamängden, versioner,
byt namn, ta bort, hämta igen från API (en datamängd eller alla på en gång). Här finns också arbetsytan: hur mycket lagring som används, beständig lagring,
säkerhetskopiering till ZIP och återställning samt, i Edge och Chrome, en portabel mapp: arbetsytan sparas som
vanliga filer i en mapp du väljer, automatiskt efter varje ändring om du vill, och kan läsas in på en annan dator.
*Dela paket* skapar en ZIP med valda datamängder, diagram, dashboards, mallar och anteckningsböcker för en
kollega, som läser in den under *Återställ från ZIP*.

## Bearbeta

Allt man gör med tabellen via knappar och dialoger: redigera celler direkt i tabellen, sortera, filtrera och se
kolumnstatistik; åtgärder för rensning (sök och ersätt med reguljära uttryck, trimma, skiftläge,
teckenkodningsreparation, ersätt värde, fyll saknade, dubbletter, kategorirensning), typer (tal, datum, ja/nej),
struktur (beräknade kolumner, dela och kombinera, ta bort rader, pivotera) och nya datamängder (gruppera och
aggregera, koppla, lägg ihop). Datakvalitetsprofilen pekar på vad som bör rättas, och kvalitetsregler (får inte
saknas, unik, intervall, lista, mönster, längd, SQL-villkor) kontrollerar datan på begäran med rapport och felande
rader som egen datamängd. Allt loggas som recept som
kan ångras, spelas upp på en annan datamängd och exporteras som R- eller SQL-kod. Versioner sparar
ögonblicksbilder att gå tillbaka till. Se [bearbeta.md](bearbeta.md).

## Analysera

Kod och statistik. R-konsol med ggplot2, dplyr, tidyr och andra paket, sparade skript, diagram med export till
SVG, PNG och PDF, och `dm_read()`/`dm_write()` för att flytta data mellan appen och R (se
[r-guide.md](r-guide.md)). SQL-konsol mot den valda datamängden: frågor visar resultat som kan sparas som ny
datamängd, ändrande satser loggas som receptsteg (se [bearbeta.md](bearbeta.md)). Anteckningsboken blandar
text (Markdown), R och SQL i celler som körs i ordning och blir en rapport i HTML, Word, PDF, Markdown eller
LaTeX (se [anteckningsbok.md](anteckningsbok.md)). Senare: statistiska modeller och eventuellt Python.

## Visualisera

Diagram med tre motorer och ett utseende: diagrambyggaren (Vega-Lite) med staplar, linjer, ytor, punkter,
histogram, värmekartor, låddiagram, cirklar och kartor (koropletkartor ur GeoJSON- eller shapefile-data); D3-mallar
för rangordning, lutningsdiagram och
befolkningspyramid; och R-skript med ggplot2. Sparade diagram kan exporteras som SVG, PNG, PDF och PowerPoint,
delas som viz-filer, visas i ett galleri och skapas i batch per grupp. Dashboards samlar sparade diagram i ett
rutnät med gemensamma filter och exporteras som HTML eller PowerPoint. Se [visualisera.md](visualisera.md).

## Exportera

Tre flikar. **Data**: CSV (Excel-anpassad eller standard), Excel, ODS, JSON, XML, SQLite samt via R: Parquet,
SPSS, Stata och RDS. **Diagram**: sparade diagram och dashboards (även alla diagram som en PowerPoint) som
SVG, PNG och PDF, enstaka eller i batch per grupp till ZIP. **Dokument**: rapporter, kodböcker och sammanställningar
ur mallar i Markdown med platshållare, som HTML, Word, PDF, Markdown eller LaTeX, enstaka eller i batch per grupp
(se [dokumentmallar.md](dokumentmallar.md)). Senare: Dataspatium-paket för delning av hela arbetsytor.
