# De otte tilstande

Dataspatium er delt op i otte tilstande, der følger arbejdets gang, i samme ånd som statistikproduktionens indsaml,
bearbejd, analysér og formidl: Hent, Håndter, Søg, Bearbejd, Analysér, Visualisér, Eksportér, Del. Alle tilstande
har samme skelet: tilstandsvælgeren øverst, objektpanelet til venstre, arbejdsfladen i midten, inspektøren til højre
og statuslinjen nederst, med loggen foldet ind over den. Panelerne skifter aldrig plads. Alt+1 til Alt+8 skifter
tilstand. Et tomt arbejdsområde åbnes i Hent, et arbejdsområde med datasæt i Håndter. Knapperne øverst til højre
åbner kommandopaletten, skifter sprog, skifter tema (lyst, mørkt, følg systemet) og åbner hjælpen.

**Statuslinjen** viser gemmestatus, hvor meget lager arbejdsområdet bruger, det valgte datasæt (navn, rækker og
kolonner; et klik åbner det i Håndter), R-motorens tilstand (slukket, starter, klar, optaget; et klik starter den),
igangværende internetkald (et klik viser loggen over kald), knapperne, der folder objektpanelet, inspektøren og
loggen ind og ud, samt antallet af linjer i loggen.

**Panelernes bredde** ændres ved at trække i kanten mellem panel og arbejdsflade; dobbeltklik nulstiller, og med
tastaturet flytter piletasterne kanten (Skift for større trin, Home og End for mindste og største bredde).
Bredderne gemmes. I smallere vinduer (under 1.100 px) viser tilstandsvælgeren kun ikoner, med tekst på den aktive
tilstand, og inspektøren åbnes som et ark over arbejdsfladen; under 760 px gør objektpanelet det samme. Et ark lukkes
med Esc eller et klik på arbejdsfladen.

**Tips** vises for alle knapper, når musen hviler på dem, eller når de får fokus med tastaturet; på berøringsskærm
ved at holde fingeren på knappen.

Kommandopaletten (Ctrl+K eller forstørrelsesglasset øverst) når alt fra ét søgefelt: skift tilstand, åbn et datasæt,
et diagram eller et dashboard, kør en bearbejdningshandling på det valgte datasæt, eksportér, åbn arbejdsområdet, søg
i data, opret en pakke, kopiér et link hertil, skift tema eller søg efter opdateringer. Links har formen
`index.html#/<tilstand>/<kortnavn>` (eller et diagrams navn i Visualisér, en søgetekst i Søg) og virker også fra en
mappe. Pil op og ned vælger, Enter kører og Esc lukker; de
senest kørte kommandoer ligger øverst.

## Hent

Her kommer data ind: filer, der slippes på fladen, indsat tekst, webadresser og åbne API'er. Filimporten går i trin:
fil, indstillinger med forhåndsvisning, kolonner med typer, færdig. Formater: CSV og anden afgrænset tekst, tekst
med faste kolonnebredder, Excel, ODS, JSON (også JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile samt via R:
SPSS, Stata, SAS, PX, Parquet, RDS og RData (se [format.md](format.md)); R-formaterne importeres i ét trin uden
forhåndsvisning. Under Åbne API'er findes forudindstillinger for Danmarks Statistik, Open Data DK og de øvrige
nordiske landes statistikbureauer og myndigheder, SCB (gennemse emnetræet eller søg efter en tabel), Eurostat,
Nordic Statistics med flere, samt kilder, der kræver nøgler; landeknapperne over listen vælger, hvilke landes kilder
der vises. Egne konfigurationer tilføjes fra fil og kan deles. *Gemte hentninger* viser de datasæt, der er kommet
fra et API, og opdaterer dem med ét klik, ét ad gangen eller alle. Første gang appen skal kontakte internettet til
et formål (API'er, webadresser, GitHub, komponenter) spørger den om lov; svaret kan gemmes. Se
[api-konfiguration.md](api-konfiguration.md).

Under *Databaser* er der to veje ind: *Database via broen* (Access, Excel, SQL Server, SQLite og ODBC-kilder på
computeren gennem et lille lokalt script) og *Tilføj databasekilde* (PostgREST, OData, GraphQL, CouchDB, ClickHouse,
Elasticsearch, SPARQL, InfluxDB, Google Sheets og Airtable over HTTP). Access-filer læses desuden direkte som filer,
og i Chrome og Edge kan en fil linkes, så datasættet indlæses igen fra disken. Se [kallor.md](kallor.md).

## Håndter

Datasættenes hjem. Objektpanelet er et træ: datasæt kan ligge i mapper med undermapper (`Økonomi/2026`) og have tags;
et filterfelt søger på navn, kortnavn, tag og mappe, og listen kan sorteres efter ændret, navn eller rækker. Mapper
foldes sammen og ud, og datasæt kan trækkes til en mappe. Afkrydsningsfelterne vælger flere datasæt (Skift vælger et
interval), og knappen *Handlinger (n)* åbner batchhandlingerne: ordn (mappe og tags), pak, eksportér som ZIP med
CSV-filer, hent igen fra API, kør en opskrift og slet. Mappe og tags følger datasættet i dets fil, i pakker og i
backupper.

Oversigten for et datasæt viser metadata, kolonneliste, kommentarer, historik over det, der er gjort med datasættet,
og versioner, og her omdøber du og ændrer kortnavn (kortnavnet bruges i SQL, R og diagramfiler), ordner, sletter og
henter igen fra API. Under *Arbejdsområde* findes, hvor meget lager der bruges, vedvarende lager, backup til ZIP og
gendannelse, i Edge og Chrome en portabel mappe (arbejdsområdet gemmes som almindelige filer i en mappe, du vælger,
automatisk efter hver ændring, hvis du vil, og kan indlæses på en anden computer), *Internetadgang* (hvilke formål,
der må kontakte internettet, med log over kald) og *Komponenter* (dele af appen og R-pakker, der hentes, når der er
brug for dem, med størrelse, kilde og knapper til at hente på forhånd eller fjerne). Pakker og GitHub er flyttet til
tilstanden Del.

## Søg

Find og list uden kode. Fanen *Søg* søger i alle kolonner i ét eller alle datasæt; hvert ord skal findes på rækken,
uanset store og små bogstaver. Resultaterne vises pr. datasæt med antal, facetter (de hyppigste værdier i kolonner
med få forskellige værdier, som indsnævrer søgningen med ét klik) og en tabel, hvor en række åbner hele posten i
inspektøren. En søgning kan gemmes som liste, blive til et nyt datasæt eller åbnes i Bearbejd. Fanen *Forespørgsel*
bygger en forespørgsel over et eller flere datasæt (kolonner, beregninger, betingelser, sortering) uden kode og
viser den SQL, der laves; den kan åbnes i Analysér, gemmes som liste eller blive til et datasæt. Fanen *Lister*
samler gemte søgninger og forespørgsler pr. datasæt og kører dem igen på dagens data; lister indsnævrer også tabellen
i Bearbejd og rækkerne i diagrammer. Se [soka.md](soka.md).

## Bearbejd

Alt, hvad man gør med tabellen via knapper og dialoger: redigér celler direkte i tabellen, sortér, filtrér og se
kolonnestatistik; handlinger til rensning (søg og erstat med regulære udtryk, trim, store og små bogstaver,
reparation af tegnkodning, erstat værdi, udfyld manglende, dubletter, kategorirensning), typer (tal, dato, ja/nej),
struktur (beregnede kolonner, opdel og kombinér, slet rækker, pivotér) og nye datasæt (gruppér og aggregér,
sammenkobl, læg sammen). Datakvalitetsprofilen peger på, hvad der bør rettes, og kvalitetsregler (må ikke mangle,
unik, interval, liste, mønster, længde, SQL-betingelse) kontrollerer data på forlangende med rapport og fejlende
rækker som eget datasæt. Alt logges som en opskrift, der kan fortrydes, afspilles på et andet datasæt og eksporteres
som R- eller SQL-kode. Versioner gemmer øjebliksbilleder at gå tilbage til. Se [bearbeta.md](bearbeta.md).

## Analysér

Kode og statistik. Værktøjerne ligger i fast rækkefølge: R, SQL, Regex og til sidst notesbogen, der samler dele fra
de andre; Python tilføjes efter R i en kommende version. R-konsollen har ggplot2, dplyr, tidyr og andre pakker, gemte
scripts, diagrammer med eksport til SVG, PNG og PDF og `dm_read()`/`dm_write()` til at flytte data mellem appen og R
(se [r-guide.md](r-guide.md)); pakker, der ikke følger med appen, hentes fra webR's pakkearkiv, når koden har brug
for dem, efter at du har givet lov. SQL-konsollen arbejder mod det valgte datasæt (`data`), hvor andre datasæt nås
med deres kortnavne, så en forespørgsel kan lave join over flere datasæt; forespørgsler viser resultater, der kan
gemmes som nyt datasæt, ændrende sætninger logges som opskriftstrin (se [bearbeta.md](bearbeta.md)). Fanen Regex
afprøver regulære udtryk på en kolonne med resultaterne markeret og bruger dem til at filtrere, udtrække, erstatte,
opdele, markere, tælle eller oprette en kvalitetsregel, med en mønsterprofil og et bibliotek med nordiske mønstre (se
[regex.md](regex.md)). Notesbogen blander tekst (Markdown), R og SQL i celler, der køres i rækkefølge og bliver til en
rapport i HTML, Word, PDF, Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)). Senere: statistiske
modeller.

## Visualisér

Diagrammer med tre motorer og ét udseende: diagrambyggeren (Vega-Lite) med søjler, linjer, arealer, punkter,
histogrammer, varmekort, boksplot, cirkler og kort (koropletkort ud fra GeoJSON- eller shapefile-data); D3-skabeloner
til rangordning, hældningsdiagrammer og befolkningspyramider; og R-scripts med ggplot2. Gemte diagrammer kan
eksporteres som SVG, PNG, PDF og PowerPoint, deles som viz-filer, vises i et galleri og oprettes i batch pr. gruppe.
Dashboards samler gemte diagrammer i et gitter med fælles filtre og eksporteres som HTML eller PowerPoint. Se
[visualisera.md](visualisera.md).

## Eksportér

Filer til din egen computer, i tre faner. **Data**: CSV (Excel-tilpasset eller standard), Excel, ODS, JSON, XML,
SQLite samt via R: Parquet, SPSS, Stata og RDS. **Diagrammer**: gemte diagrammer og dashboards (også alle diagrammer
som én PowerPoint) som SVG, PNG og PDF, enkeltvis eller i batch pr. gruppe til ZIP. **Dokumenter**: rapporter,
kodebøger og sammenstillinger ud fra skabeloner i Markdown med pladsholdere, som HTML, Word, PDF, Markdown eller
LaTeX, enkeltvis eller i batch pr. gruppe (se [dokumentmallar.md](dokumentmallar.md)). Det, der skal til andre
mennesker, findes i Del.

## Del

Giv data til andre. **Pakke**: en ZIP med valgte datasæt, diagrammer, dashboards, skabeloner, notesbøger og scripts,
en besked og en ændringslog, som modtageren åbner under *Modtag* og kan erstatte sine versioner med. **GitHub**:
arbejdsområdet som en mappe i et repository, send og hent, med et adgangstoken, der gemmes krypteret.
**Delingsmenu**: computerens eller telefonens egen delingsmenu til en fil eller en pakke (e-mail, Teams,
beskedapps). **Udgiv**: dashboards og dokumenter som selvstændige HTML-filer. **Enheder**: direkte overførsel til telefoner og andre computere på samme netværk med QR-kode, kontrolkode og
parring, og Dataspatium Mobil på telefonen (se [mobil.md](mobil.md)). **Modtag**: pakker fra fil eller webadresse,
med afsender og ændringer synlige, før noget tages ind. Datasæt, der forlader appen, gennemgås først for
personoplysninger. Se [dela.md](dela.md).
