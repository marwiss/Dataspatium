# De seks tilstande

Dataspatium er opdelt i seks tilstande, der følger arbejdets gang i samme ånd som statistikproduktionens indsamle,
bearbejde, analysere og formidle: Hent, Håndter, Bearbejd, Analysér, Visualisér, Eksportér. Alle tilstande har samme
skelet: tilstandsvælgeren øverst, objektpanelet til venstre, arbejdsfladen i midten, egenskabspanelet til højre og
loggen nederst. Panelerne bytter aldrig plads. Alt+1 til Alt+6 skifter tilstand. Et tomt arbejdsområde åbnes i Hent,
et arbejdsområde med datasæt i Håndter. Knapperne øverst til højre folder panelerne ind, skifter tema (lyst, mørkt,
følg systemet), skifter sprog og åbner hjælpen.

Kommandopaletten (Ctrl+K eller forstørrelsesglasset øverst) når alt fra ét søgefelt: skift tilstand, åbn et datasæt,
et diagram eller et dashboard, kør en handling på det valgte datasæt, eksportér, åbn arbejdsområdet, skift tema eller
søg efter opdateringer. Pil op og ned vælger, Enter kører, og Esc lukker; de senest kørte kommandoer ligger øverst.

## Hent

Her kommer data ind: filer, der slippes på fladen, indsat tekst, webadresser og åbne API'er. Filimporten går i trin:
fil, indstillinger med forhåndsvisning, kolonner med typer, færdig. Formater: CSV og anden afgrænset tekst, tekst med
fast bredde, Excel, ODS, JSON (også JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile samt via R: SPSS, Stata,
SAS, PX, Parquet, RDS og RData (se [format.md](format.md)); R-formaterne importeres i ét trin uden forhåndsvisning.
Under Åbne API'er findes forudindstillinger for statistikbureauerne og flere andre myndigheder i Danmark, Norge,
Finland, Island, Grønland, Færøerne, Åland og Sverige, Nordic Statistics og Eurostat; landeknapperne over listen
vælger, hvilke landes kilder der vises. Egne konfigurationer tilføjes fra fil og kan deles. *Gemte hentninger* viser de datasæt, der er kommet fra et API,
og opdaterer dem med ét klik, ét ad gangen eller alle. Se
[api-konfiguration.md](api-konfiguration.md).

## Håndter

Datasættenes hjem. Oversigt med metadata, kolonneliste, kommentarer, historik over det, der er gjort med datasættet, versioner,
omdøb og kortnavn (kortnavnet bruges i SQL, R og diagramfiler), slet, hent igen fra API (ét datasæt eller alle på én
gang). Her findes også arbejdsområdet: hvor meget lager der bruges, vedvarende lager, backup til ZIP og gendannelse
samt, i Edge og Chrome, en portabel mappe: arbejdsområdet gemmes som almindelige filer i en mappe, du vælger,
automatisk efter hver ændring, hvis du vil, og kan indlæses på en anden computer. *Del pakke* opretter en ZIP med
valgte datasæt, diagrammer, dashboards, skabeloner og notesbøger, en besked og en ændringslog til en kollega, der
indlæser den under *Gendan fra ZIP* og kan erstatte sine versioner af datasættene. *GitHub* sender arbejdsområdet til et
repository og henter det derfra, med et adgangstoken, der gemmes krypteret.

## Bearbejd

Alt, hvad man gør med tabellen via knapper og dialoger: redigere celler direkte i tabellen, sortere, filtrere og se
kolonnestatistik; handlinger til rensning (søg og erstat med regulære udtryk, fjern mellemrum, store og små bogstaver,
reparation af tegnkodning, erstat værdi, udfyld manglende, dubletter, rensning af kategorier), typer (tal, datoer,
ja/nej), struktur (beregnede kolonner, opdel og kombinér, slet rækker, pivotér) og nye datasæt (gruppér og aggregér,
sammenkobl, sammenlæg). Datakvalitetsprofilen peger på det, der bør rettes, og kvalitetsregler (må ikke mangle, unik,
interval, liste, mønster, længde, SQL-betingelse) kontrollerer data efter behov med rapport og fejlende rækker som eget
datasæt. Alt logges som recepter, der kan fortrydes, afspilles på et andet datasæt og eksporteres som R- eller SQL-kode.
Versioner gemmer øjebliksbilleder at gå tilbage til. Se [bearbeta.md](bearbeta.md).

## Analysér

Kode og statistik. R-konsol med ggplot2, dplyr, tidyr og andre pakker, gemte scripts, diagrammer med eksport til SVG,
PNG og PDF og `dm_read()`/`dm_write()` til at flytte data mellem appen og R (se [r-guide.md](r-guide.md)). SQL-konsol
mod det valgte datasæt (`data`), hvor andre datasæt nås med deres kortnavne, så én forespørgsel kan lave join over flere
datasæt; forespørgsler viser resultater, der kan gemmes som nyt datasæt, og ændrende sætninger logges som trin i
recepten (se [bearbeta.md](bearbeta.md)). Notesbogen blander tekst (Markdown), R og SQL i celler, der køres i
rækkefølge og bliver til en rapport i HTML, Word, PDF, Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)).
Fanen Regex afprøver regulære udtryk på en kolonne med træfferne markeret og bruger dem til at filtrere,
udtrække, erstatte, opdele, markere, tælle eller oprette en kvalitetsregel, med en mønsterprofil og et bibliotek
med nordiske mønstre (se [regex.md](regex.md)). Senere: statistiske modeller.

## Visualisér

Diagrammer med tre motorer og ét udseende: diagrambyggeren (Vega-Lite) med søjler, linjer, arealer, punkter,
histogrammer, varmekort, boksplot, cirkler og kort (koropletkort fra GeoJSON- eller shapefile-data); D3-skabeloner til
rangering, hældningsdiagrammer og befolkningspyramider; og R-scripts med ggplot2. Gemte diagrammer kan eksporteres som
SVG, PNG, PDF og PowerPoint, deles som viz-filer, vises i et galleri og oprettes i batch pr. gruppe. Dashboards samler
gemte diagrammer i et gitter med fælles filtre og eksporteres som HTML eller PowerPoint. Se
[visualisera.md](visualisera.md).

## Eksportér

Tre faner. **Data**: CSV (tilpasset Excel eller standard), Excel, ODS, JSON, XML, SQLite samt via R: Parquet, SPSS, Stata
og RDS. **Diagrammer**: gemte diagrammer og dashboards (også alle diagrammer som én PowerPoint) som SVG, PNG og PDF,
enkeltvis eller i batch pr. gruppe til ZIP. **Dokumenter**: rapporter, kodebøger og sammenfatninger fra skabeloner i
Markdown med pladsholdere, som HTML, Word, PDF, Markdown eller LaTeX, enkeltvis eller i batch pr. gruppe (se
[dokumentmallar.md](dokumentmallar.md)).
