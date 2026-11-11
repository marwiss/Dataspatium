# De ni tilstande

Dataspatium er delt op i ni tilstande, der følger arbejdets gang, i samme ånd som statistikproduktionens indsaml,
bearbejd, analysér og formidl: Hent, Håndter, Søg, Bearbejd, Kontrollér, Analysér, Visualisér, Eksportér, Del. Alle tilstande
har samme skelet: tilstandsvælgeren øverst, objektpanelet til venstre (med tilstandens egen overskrift i panelhovedet: Kilder i Hent, Datasæt i de øvrige), arbejdsfladen i midten, inspektøren til højre
og statuslinjen nederst, med loggen foldet ind over den. Panelerne skifter aldrig plads. Alt+1 til Alt+9 skifter
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

Du ændrer logpanelets højde ved at trække i dets overkant eller med piletasterne, når kanten har fokus. Dobbeltklik nulstiller højden, og højden gemmes.

## Hent

Her kommer data ind: filer, der slippes på fladen, indsat tekst, webadresser og åbne API'er. Filimporten går i trin:
fil, indstillinger med forhåndsvisning, kolonner med typer, færdig. Formater: CSV og anden afgrænset tekst, tekst
med faste kolonnebredder, Excel, ODS, JSON (også JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile samt via R:
SPSS, Stata, SAS, PX, Parquet, RDS og RData (se [format.md](format.md)); R-formaterne importeres i ét trin uden
forhåndsvisning. Venstre kolonne, med overskriften *Kilder* i panelhovedet, har fire grupper. *Almindelige kilder*: Filer, Indsæt og Fra webadresse. *Tilføj kilder*: Database via broen, Åbne API'er, API fra fil, Databasekilde, OpenCDE, Neo4j og Geodatakilde. *Tilføjede kilder*: det, du har tilføjet, hver række med en fjern-knap; fra start ligger SCB's og Boverkets åbne API'er der. *Øvrige kilder*: Gemte hentninger, Indsamling i felten og Guider. *Åbne API'er* viser fortegnelsen over forudindstillinger for Danmarks Statistik, Open Data DK og de øvrige
nordiske landes statistikbureauer og myndigheder, SCB (gennemse emnetræet eller søg efter en tabel), Eurostat,
Nordic Statistics med flere, samt kilder, der kræver nøgler i arbejdsfladen, med landeknapper og søgning. *Tilføj* flytter en forudindstilling til Tilføjede kilder og åbner den; fjerner du den der, går den tilbage til fortegnelsen og kan tilføjes igen. Egne konfigurationer tilføjes med *API fra fil* og kan deles; en egen kilde, der fjernes, slettes med sine gemte nøgler. *Gemte hentninger* viser de datasæt, der er kommet
fra et API, og opdaterer dem med ét klik, ét ad gangen eller alle. Første gang appen skal kontakte internettet til
et formål (API'er, webadresser, GitHub, komponenter) spørger den om lov; svaret kan gemmes. Se
[api-konfiguration.md](api-konfiguration.md).

*Database via broen* åbner brovisningen (Access, Excel, SQL Server, SQLite og ODBC-kilder på
computeren gennem et lille lokalt script); hver database, du forbinder, dukker op under Tilføjede kilder og åbner brovisningen igen med den database valgt. *Databasekilde* laver en kilde af en adresse og en nøgle (PostgREST, OData, GraphQL, CouchDB, ClickHouse,
Elasticsearch, SPARQL, InfluxDB, Google Sheets og Airtable over HTTP; også OpenCDE og Neo4j, som desuden har egne valg på listen). Access-filer læses desuden direkte som filer,
og i Chrome og Edge kan en fil linkes, så datasættet indlæses igen fra disken. Se [kallor.md](kallor.md).

QGIS-projekter (.qgs, .qgz) bliver kortvisninger: lagrækkefølge, synlighed og symboler følger med, lagene kobles til datasæt med samme filnavn, og datafiler, der slippes sammen med projektet, importeres først (se [kartor.md](kartor.md)).

*Geodatakilde* under Tilføj kilder: en WFS-, OGC API Features- eller ArcGIS-tjeneste bliver en kilde, hvis
lag hentes som GeoJSON og åbnes som kort, og kilden *Geodataportalen (sök geodata)* søger i det svenske nationale
geodatakatalog og tilføjer tjenester med ét klik. Forudindstillede geodatakilder findes for SCB, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen, Kartverket, Statistikcentralen og SYKE samt Lantmäteriets
geodataplatform for den, der har en nøgle. Se [kallor.md](kallor.md#åbne-geodata).

Digitale planer importeres som planer: en svensk detaljplan efter den nationale specifikation (GeoJSON) eller
Lantmäteriets referenceobjekter, en kommuneplan efter specifikationen eller Boverkets ÖP-model (GeoPackage, valget
*Hele kommuneplanen som plan*). Filen genkendes på indholdet, planens oplysninger vises, og planen åbnes som plankort
i Bearbejd med Boverkets farver (se [planer.md](planer.md)).

Grafer (netværk af knuder og kanter) importeres som grafer fra GraphML, GEXF, JSON med knuder og kanter eller
Cypher-scripts; filen genkendes på indholdet, grafens oplysninger vises, og grafen åbnes som grafvisning i Bearbejd
(se [grafer.md](grafer.md)). To tabeller bliver en graf med knappen *Lav graf af tabeller* i Håndter.

Bygningsmodeller i IFC og tegninger i DXF bliver datasæt af typen model. Filens oplysninger vises, og modellen åbnes i 3D eller
som tegning i Bearbejd (se [cad-bim.md](cad-bim.md)).

**Indsamling i felten** i kildelisten bygger en formular på et datasæts kolonner og regler og sender den til telefonen. Rækkerne kommer tilbage som en ny
version (se [insamling.md](insamling.md)).

Alle kilder på listen ser ens ud med et symbol for deres type og en linje under navnet.

**Appen siger først, hvad filen er**, for eksempel en tabel med steder, en graf eller en bygningsmodel, og viser den i sin egen form: et kort, billederne, en skitse af grafen, tegningen eller den første side. Er noget værd at spørge om, spørger den: koordinater, der ser ud til at have byttet plads, hvilket koordinatsystem de er i, og om en liste med forbindelser skal læses som en graf. Intet ændres, før du har svaret, og kortet viser, hvad svaret gør.

**Flere forskellige filer** sorteres efter, hvad de er: billeder bliver til én samling, dokumenter til en anden, og hver anden fil til sit eget datasæt. Du ser listen først og kan fravælge noget. Du kan også slippe en hel mappe eller vælge den med *Vælg en mappe*. En fil, der ikke kan læses, stopper ikke de andre.

**Guider.** Under Guider er der fire korte veje fra spørgsmål til resultat med rigtige data: sammenlign kommuner via Kolada, en befolkningspyramide via SCB, vejr over lang tid via SMHI og prisudvikling via Den Europæiske Centralbank. En guide henter, renser og gemmer et diagram. Du får tabellen, diagrammet og trinnene at bygge videre på. Den henter fra nettet, kun når du trykker på *Kør guiden*.

**Datapakker.** En ZIP-fil med `datapackage.json` (Frictionless Data Package) læses ind med typerne og titlerne fra dens skema, og hver tabel bliver til et datasæt.

**Filer fra et CDE.** En OpenCDE-kilde viser projektets modeller og dokumenter, og *Hent* laver et datasæt af filens egen slags, som husker, hvor det kom fra. Se [kallor.md](kallor.md).

**BCF-filer.** En BCF-fil (bcf, bcfzip) bliver en tabel med sager, med kommentarer og komponenter ved siden af. Se [format.md](format.md).

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

En dokument- eller billedsamling vises med antal dokumenter og sider henholdsvis billeder, med dokumentlisten eller de
første miniaturer på oversigtsfanen, og med knappen *Læs* eller *Vis billeder*, som åbner læsevisningen henholdsvis
galleriet i Bearbejd (se [dokument.md](dokument.md)).

**Flows og overvågning** findes i objektpanelet: gemte kæder, der køres med ét klik eller ved start, og kilder, der siger til, når de
har nye data (se [floden.md](floden.md)).

**Hvad appen ser.** Oversigten viser, hvad datasættet også kan bruges som: steder på et kort, en tidsserie, regioner, der kan farves, et netværk eller løbende tekst. Hver linje siger hvorfor, og du kan slå det fra, der ikke passer, eller slå det til, appen overså. Valget gemmes i datasættet, og tilstandene følger det. Under det står **Værd at se på** med det, datatypen kræver: sider uden tekst, billeder uden position, kanter, der peger på noder, der ikke findes, elementer uden mængder eller rækker uden sted.

**Udvalg.** Knappen *Brug som udvalg* findes i Søg og i Bearbejds visninger. Det, du ser, følger derefter med mellem tilstandene og står i statuslinjen. I Bearbejd viser du det via listevalget, i Eksportér vælger du, om kun udvalget skal med, og i pakker kan du sende kun udvalget. Fra statuslinjen gemmer du det som en liste, gør det til et datasæt eller rydder det. Ændres rækkerne i datasættet, forsvinder udvalget, da det ikke længere ville betyde det samme.

**Billede.** Oversigten viser et billede af datasættet: den første side, et kort over stederne, en skitse af grafen, tegningen, hvad modellen består af, eller en linje over tid. En almindelig tabel har intet billede.

**Flere datasæt.** Har du valgt flere, viser *Det kan de gøre sammen*, hvad der er muligt: samme kort, når alle har steder, én tabel, når alle har samme kolonner, og én samling, når alle er billeder eller alle er dokumenter. De valgte ændres ikke. Ved eksport får hver sin egen form, for eksempel billeder som ZIP og grafer som GraphML.

**Versioner** siger, hvad de indeholder i datasættets egne enheder, og sammenligningen viser, hvilke billeder, dokumenter, knuder, kanter eller elementer der er kommet til og forsvundet.

**Kodelister.** Kolonner med koder fra en kendt liste vises på oversigten: SNI, SSYK, NACE, ISCED, COFOG, NUTS, de nordiske modstykker, lande og kommuner. Et klik tilføjer navnene som værdietiketter, og værdierne ændres ikke. En kort kode tæller kun, når kolonnens navn passer. Listerne følger med appen, og deres kilder og licenser står i `presets/kodlistor/KALLA.md`.

**Beskrivelse.** Fanen Beskrivelse indeholder det, en dataportal vil vide efter DCAT-AP-SE: titel, udgiver, kontakt, tema, licens og periode. Beskrivelsen følger datasættet, siger, hvad der mangler, og kan gemmes som RDF/XML eller læses ind fra en sådan fil. Intet sendes herfra.

**Oprindelse.** Fanen Oprindelse viser, hvor et datasæt kommer fra, og hvad det er blevet til: kilden, de datasæt, det blev lavet af, opskriften og versionerne samt de datasæt, diagrammer, dashboards, dokumenter, notesbøger, lister, flows og delinger, der bygger på det. Et klik åbner det, du klikker på, og *Hent som tekst* giver det samme til en rapport.

**Bibliotek.** Under Bibliotek findes færdige opskrifter, skabeloner, scripts og notesbøger, hver med sin licens. Du ser, hvad noget gør, før du tilføjer det. Flere biblioteker hentes fra en webadresse, og *Gem egne som biblioteksfil* laver en fil af det, du selv har lavet, til et GitHub-repo eller hvor som helst.

**Fra CDE.** Et datasæt hentet fra en OpenCDE-server viser server, projekt og version, kan spørge efter en nyere version og åbne
modellens sager. *Offentliggørelse* viser, om en version er offentliggjort på serveren, og den projektansvarlige kan offentliggøre
den én gang efter en bekræftelse; arkivet med sin kontrolsum kan derefter hentes. For en model åbner *Før en bygning ind* en
dialog, hvor serveren fører en bygning fra en anden model ind som næste version: rapporten viser, hvad der følger med, og hvilke
objekter begge har, du vælger A’s, B’s eller begge for det, der er forskelligt, en model med andet skema eller anden længdeenhed
forberedes først, og den projektansvarlige starter sammenlægningen.

**Sager.** En tabel med sager fra et CDE får kortet Sager: status per status, dashboardet Sagsstatus og vejen til modellen. Se [cad-bim.md](cad-bim.md).

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

**Dokumentsamlinger** (PDF, Word, OpenDocument, Markdown, tekst) åbnes som læsevisning: vælg dokument,
bladr side for side, vis PDF-siden som billede, søg i hele samlingen og hent originalen. **Billedsamlinger** åbnes som galleri med miniaturer, filter, sortering og billedets EXIF-oplysninger i inspektøren, hvor
beskrivelsen kan ændres. *Vis som tabel* giver i begge tilfælde den almindelige tabel med alle handlinger. Se
[dokument.md](dokument.md).

Datasæt med geometri eller koordinater åbnes som et **kort**, der kan zoomes og panoreres; klik på et objekt viser attributterne, baggrundskort efter samtykke, *Gem som kortvisning* til Visualisér. *Vis som tabel* giver tabellen (se [kartor.md](kartor.md)).

Et udvalg fra Søg markeres i 3D-modellen, og kameraet rettes mod det.

**Læse tekst i billeder.** Sider i en skannet PDF og billeder i et galleri kan læses med tekstgenkendelse, som kører i browseren. Se [dokument.md](dokument.md).

**Sager.** Modelvisningen viser projektets BCF-sager fra et CDE og markerer de bygningsdele, de peger på. Se [cad-bim.md](cad-bim.md).

**Skrive sager.** Modelvisningen opretter sager fra markeringen med visningen som viewpoint, kommenterer og skifter status, og gemmer projektets sager som BCF-fil. Se [cad-bim.md](cad-bim.md).

## Kontrollér

Prøv data mod krav. En tabel prøves mod enkle regler: hver kolonnes type og antal tomme værdier (manglende eller kun
mellemrum) og antallet af dubletter blandt rækkerne. En lille tabel kontrolleres, så snart den vælges, en tabel med 10 000
rækker eller flere først, når du trykker på *Kør kontrollen*. Inspektøren viser det valgte fund med dets andel af rækkerne, og
*Åbn i Bearbejd* fører dig derhen for at rette det. En IFC-model viser kortet *Valider modellen* og panelet *Sammenlign
versioner* (se [cad-bim.md](cad-bim.md)); andre slags har endnu ingen kontroller. AI-panelet får en fjerde tilstand,
*Kontrollér*, til fotos af skader (planlagt).
Kortet *Topologi* læser modellens vægge med *Kontrollér topologien* (appens Python starter første gang) og viser pr. etage, hvor mange
rum væggene lukker om, om etagen er lukket, vægender der står løse, og ydervæggene pr. verdenshjørne.

## Analysér

Kode og statistik. Værktøjerne ligger i fast rækkefølge: R, Python, SQL, Regex og til sidst notesbogen, der samler dele fra
de andre. Python-konsollen har pandas, matplotlib, seaborn og plotly og hentes som komponent, første gang du starter den (se
[python.md](python.md)). R-konsollen har ggplot2, dplyr, tidyr og andre pakker, gemte
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

Når en dokumentsamling er valgt, findes fanen **Tekst** (ordfrekvens med stopord, nøgleord i kontekst,
samforekomster og et overblik pr. dokument), og når en billedsamling er valgt, fanen **Billeder** (overblik pr. type,
kamera, år eller måned og dubletter via billedhash). Begge ligger efter Regex og før Notesbogen, og hvert resultat
kan gemmes som et nyt datasæt. Se [dokument.md](dokument.md).

For datasæt med geometri findes fanen **Geo** (efter Regex): mål, punkter i områder, nærmeste, buffer, overlejring, sammenlægning og forenkling med Turf i browseren; resultaterne bliver datasæt, der åbnes som kort.

Grafer får fanen **Cypher** lige efter SQL (en Cypher-delmængde oversat til SQL med SQL'en vist) og fanen **Graf** efter
Regex (oversigt, grad, komponenter, korteste vej, delgraf, knuder og kanter som tabeller).

Fanen **Statistik** efter Regex laver almindelige analyser med formularer, der skriver og viser koden (se [statistik.md](statistik.md)).

Modeller og tegninger får fanen **Mængder** efter Regex (antal, længde, areal og volumen pr. type, etage og materiale, fra filen
eller målt på geometrien).

Analysér åbner i det værktøj, der passer til datasættet: Tekst for dokumenter, Billeder for billedsamlinger, Graf for grafer, Mængder for modeller, Plan for planer, Geo for tabeller med steder og ellers Statistik. Vælger du selv en fane, bliver du der. R starter først, når du åbner fanen R.

**Kode at starte fra.** I R, Python og SQL er der en liste med kode skrevet til det valgte datasæt: en grafs kanter, en models mængder, billeder pr. måned, sum pr. periode eller stederne som punkter. Valget indsætter koden, hvor markøren står. En ny notesbog starter på samme måde. I SQL vises sidetabellerne med deres kolonner, og et klik skriver en forespørgsel om tabellen.

**Trend.** Statistik har værktøjet *Trend*, som giver én værdi pr. periode og en ret linje gennem dem og siger, hvor meget værdien ændrer sig pr. periode. Et datasæt, der er en tidsserie, åbner der.

**Tæl pr. område.** Under Geo tæller *Punkter i områder* steder pr. område, med areal og antal pr. kvadratkilometer. Stederne kan være billeder med position, og områderne kan være en plan, en tabel med flader eller de kommune- og regionsgrænser, der følger med appen.

**Sager.** Værktøjet Sager i fanen Mængder tæller sager og bygningsdele per status, type, bygningsdelstype eller etage. Se [cad-bim.md](cad-bim.md).

## Visualisér

Diagrammer med tre motorer og ét udseende: diagrambyggeren (Vega-Lite) med søjler, linjer, arealer, punkter,
histogrammer, varmekort, boksplot, cirkler og kort (koropletkort ud fra GeoJSON- eller shapefile-data); D3-skabeloner
til rangordning, hældningsdiagrammer og befolkningspyramider; og R-scripts med ggplot2. Gemte diagrammer kan
eksporteres som SVG, PNG, PDF og PowerPoint, deles som viz-filer, vises i et galleri og oprettes i batch pr. gruppe.
Dashboards samler gemte diagrammer i et gitter med fælles filtre og eksporteres som HTML eller PowerPoint. Se
[visualisera.md](visualisera.md).

Diagramtypen **Kort** er en kortvisning med flere lag fra datasæt med geometri eller koordinater og de medfølgende grænser, farve efter kategori eller klasse, etiketter, gemt visning og baggrundskort efter samtykke; interaktiv i dashboards, præsentationer og publiceret HTML, eksporteret til SVG, PNG og PDF uden baggrundskort (se [kartor.md](kartor.md)).

**Sagsstatus.** Dashboardet Sagsstatus oprettes fra en sagstabel, og et modeldiagram kan bære farver efter sagsstatus. Se [cad-bim.md](cad-bim.md).

## Eksportér

Filer til din egen computer, i tre faner. **Data**: CSV (Excel-tilpasset eller standard), Excel, ODS, JSON, XML,
SQLite samt via R: Parquet, SPSS, Stata og RDS. **Diagrammer**: gemte diagrammer og dashboards (også alle diagrammer
som én PowerPoint) som SVG, PNG og PDF, enkeltvis eller i batch pr. gruppe til ZIP. **Dokumenter**: rapporter,
kodebøger og sammenstillinger ud fra skabeloner i Markdown med pladsholdere, som HTML, Word, PDF, Markdown eller
LaTeX, enkeltvis eller i batch pr. gruppe (se [dokumentmallar.md](dokumentmallar.md)). Det, der skal til andre
mennesker, findes i Del.

Et datasæt, der er mere end en tabel, deler formaterne op i **Hele datasættet** og **Kun tabellen** og siger, hvad der ikke følger med. Dokumenter kan hentes som originalfiler eller ren tekst, billeder som en ZIP og grafer som to CSV-filer.

**Efter datasættets slags.** Tabeller med steder kan gemmes som KML, GPX og GeoPackage, i grader. I GPX bliver punkter til waypoints, og linjer og fladers konturer bliver til spor. Billedsamlinger kan blive til et kontaktark i PDF med billeder og navne. En plan kan blive til et plankort i PDF med signaturforklaring, planbestemmelserne i Word og originalfilen, hvis planen kom fra en fil. En IFC-model kan give mængderne i Excel, med summer pr. type og alle værdier, og geometrien som glTF. En DXF-tegning kan blive til PDF. Eksporterer du flere datasæt i Håndter, får hvert sin egen form.

**Batch pr. etage eller dokument.** Batch pr. gruppe virker med enhver kolonne. En model deles på kolonnen `vaning`, og billedet af modellen viser så kun den etage. Et dokument deles på kolonnen `dokument`.

**Andre værktøjer.** *Datapakke* giver en ZIP med CSV-filer og `datapackage.json`, som mange værktøjer kan læse. En grafs kanter og en models egenskaber følger med som egne tabeller. *Kvalitetsdeklaration* giver et Word-dokument i den form, SCB bruger, udfyldt fra profil, regler, kommentarer, ændringer og beskrivelse, med steder at skrive det, kun et menneske kan sige.

## Del

Giv data til andre. **Pakke**: en ZIP med valgte datasæt, diagrammer, dashboards, skabeloner, notesbøger og scripts,
en besked og en ændringslog, som modtageren åbner under *Modtag* og kan erstatte sine versioner med. **GitHub**:
arbejdsområdet som en mappe i et repository, send og hent, med et adgangstoken, der gemmes krypteret.
**Delingsmenu**: computerens eller telefonens egen delingsmenu til en fil eller en pakke (e-mail, Teams,
beskedapps). **Udgiv**: dashboards og dokumenter som selvstændige HTML-filer. **Enheder**: direkte overførsel til telefoner og andre computere på samme netværk med QR-kode, kontrolkode og
parring, og Dataspatium Mobil på telefonen (se [mobil.md](mobil.md)). **Modtag**: pakker fra fil eller webadresse,
med afsender og ændringer synlige, før noget tages ind. Datasæt, der forlader appen, gennemgås først for
personoplysninger. Se [dela.md](dela.md).

**Til CDE.** Et datasæt eller dets originalfil til et projekt på en OpenCDE-server, gennem Documents API eller som BCF-dokument. Se [dela.md](dela.md).

**Arbejdsområdepakke via CDE.** Fanen Til CDE sender en pakke som dokument; modtageren modtager den i kildens filliste. Se [dela.md](dela.md).
