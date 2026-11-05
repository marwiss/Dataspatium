[Svenska](../../README.md) · **Dansk** · [Norsk](../nb/README.md) · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · [English](../en/README.md)

# Dataspatium

Dataspatium er en webapp til data fra kilde til rapport: hent data fra filer og åbne API'er, gem og håndter
datasæt, gennemgå og ret værdier, analysér med R, visualisér og eksportér. Alt kører i din egen browser. Ingen
server, ingen installation, ingen konti. Dine data forlader aldrig computeren, medmindre du selv eksporterer dem.

![Dataspatium i tilstanden Bearbejd med en tabel over svenske kommuner](../images/bearbeta.png)

Brugerfladen findes på svensk, dansk, norsk, finsk, islandsk og engelsk. Skærmbillederne i dokumentationen viser
appen på svensk.

## Download og kom i gang

1. **Download.** Gå til den [seneste udgivelse](https://github.com/marwiss/Dataspatium/releases/latest), og hent
   ZIP-filen under *Assets* (`dataspatium-<version>.zip`, omkring 100 MB; R og alle R-pakker er med).
2. **Pak ud.** Højreklik på ZIP-filen, og vælg *Udpak alle* (Windows), eller dobbeltklik på den (macOS). Læg mappen,
   hvor du vil have den, for eksempel i Dokumenter. Appen fungerer ikke direkte inde i ZIP-filen.
3. **Åbn.** Dobbeltklik på `index.html` i mappen, eller træk filen til et browservindue. Hvis Windows spørger, hvilken
   app der skal bruges, vælger du Edge, Chrome eller Firefox. Første gang spørger appen, hvilket sprog du vil have
   (det kan ændres med sprogknappen øverst til højre), og starter derefter **grundkurset**, en interaktiv gennemgang
   af alle tilstande med eksempeldata, som tager omkring ti minutter. Åbn det igen fra hjælpen (?).
4. **Importér.** I tilstanden *Hent* slipper du en fil på fladen (eller klikker på *Prøv med eksempeldata*),
   kontrollerer kolonnernes typer og klikker på *Importér*. Datasættet gemmes i browseren på din computer.
5. **Arbejd videre.** Skift tilstand øverst: *Håndter* viser dine datasæt og arbejdsområdet, *Søg* finder rækker i
   dem, *Bearbejd* viser tabellen med sortering, filtre og handlinger, *Analysér* åbner R- og SQL-konsollen,
   *Visualisér* bygger diagrammer, *Eksportér* downloader data, diagrammer og dokumenter, og *Del* giver dem til andre.

Data gemmes i browserens egen database. Rydder du webstedsdata, forsvinder de, så tag backup regelmæssigt under
*Håndter > Arbejdsområde*. Backuppen er en ZIP-fil, der kan gendannes på samme eller en anden computer. Trin for trin
med flere detaljer: [kom-igang.md](kom-igang.md).

Appen findes også direkte på nettet, uden download: <https://marwiss.github.io/Dataspatium/>. Fra en webserver kan
den installeres som en selvstændig app (Edge og Chrome: *Installér* i adresselinjen) og fungerer derefter også uden
netværk. Webversionen og mappeversionen har adskilte arbejdsområder; flyt data mellem dem med en backup eller en pakke.

## Hvad der kræves

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (version 120 eller nyere) eller Firefox (version 128 eller nyere). Safari
  understøttes ikke.
- Omkring 300 MB ledig plads til appmappen og mindst 4 GB hukommelse (8 GB anbefales til store datasæt). Der kræves
  ingen administratorrettigheder.
- Internet kræves kun, når du henter data fra åbne API'er, sender til GitHub, søger efter opdateringer eller henter
  en komponent eller en R-pakke, der ikke følger med i mappen; appen spørger om lov først.

## Hvad du kan

- **Hente**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, SDMX-JSON-, GeoJSON-, XML-, SQLite-, GeoPackage- og shapefile-filer, tabeller i HTML-, Markdown-, Word- og LaTeX-dokumenter, kortfiler i KML, KMZ, GPX og TopoJSON, SQL-scripts, ældre regnearksformater (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), tekst
  med fast kolonnebredde, statistikfiler fra SPSS, Stata og SAS (med værdietiketter) og PX-formatet samt Parquet og RDS (via R), indsat
  tekst, filer fra webadresser og data direkte fra åbne API'er hos Danmarks Statistik, Open Data DK, SSB,
  Folkehelseinstituttet, Brønnøysundregistrene, Kartverket, MET Norway, Statistikcentralen, THL, PRH, Fintraffic,
  Meteorologiska institutet, Hagstofa Íslands, Veðurstofa Íslands, Grønlands Statistik, Hagstova Føroya, ÅSUB,
  Nordic Statistics, Eurostat, ECB, OECD og svenske myndigheder som SCB, Kolada og SMHI, med landefilter og gemte
  hentninger, der opdateres med ét klik og afspiller deres opskrifter (se [api-konfiguration.md](api-konfiguration.md)).
  Eksempeldata og kommune- og regionsgrænser for Sverige, Danmark, Norge og Finland følger med.
- **Databaser**: Access-filer læses direkte i browseren; databaser på computeren eller i netværket (SQL Server, ODBC,
  Excel, SQLite) nås gennem en lokal bro, og PostgREST/Supabase, OData, GraphQL, CouchDB, ClickHouse, Elasticsearch,
  SPARQL, InfluxDB, Google Sheets og Airtable bliver kilder med ét klik. Filer kan linkes og indlæses igen fra disken
  (se [kallor.md](kallor.md)).
- **Dokumenter og billeder**: PDF, Word, OpenDocument, Markdown og tekst bliver dokumentsamlinger, der læses i en læsevisning, side for
  side eller i deres helhed; billeder bliver en billedsamling med EXIF-oplysninger og galleri. Værktøjerne Tekst
  (ordfrekvens, nøgleord i kontekst, samforekomster) og Billeder (overblik, dubletter) fungerer uden kode (se [dokument.md](dokument.md)).
- **Bearbejde**: gennemse, sortere og filtrere store tabeller, redigere celler, rense, sætte typer, omkode, inddele i klasser, rangordne, beregne andele, løbende summer og ændringer, pivotere
  og sammenkoble data, kontrollere datakvalitet med profil og regler (blandt andet formater, nordiske identitetsnumre, referencer til andre datasæt og afvigende værdier), pseudonymisere personnumre før deling, med
  fortryd, versioner og recepter, der kan eksporteres som R eller SQL (se [bearbeta.md](bearbeta.md)).
- **Analysere**: en indbygget R-konsol med ggplot2 og tidyverse (se [r-guide.md](r-guide.md)), en Python-konsol med
  pandas og matplotlib, der hentes første gang (se [python.md](python.md)), en SQL-konsol, hvor
  datasæt kobles sammen med join via deres kortnavne, og notesbøger med tekst-, R- og SQL-celler, der bliver til
  rapporter i HTML, Word, PDF, Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)), og en Regex-fane, hvor regulære udtryk afprøves på en kolonne og bruges til at filtrere, udtrække, erstatte og opdele (se [regex.md](regex.md)), helt i browseren.
- **Kort**: geodatasæt åbnes som kort, der kan zoomes, kortvisninger med flere lag og baggrundskort efter samtykke
  bliver dashboards og publiceret HTML, geoværktøjerne beregner areal, punkter i områder, nærmeste, buffer og
  overlejring uden kode, og QGIS-projekter bliver kortvisninger (se [kartor.md](kartor.md)).
- **Åbne geodata**: WFS-, OGC API Features- og ArcGIS-tjenester bliver kilder, hvis lag hentes som kort, med
  forudindstillinger for SCB, SGU, HaV, RAÄ, Skogsstyrelsen, Kartverket, Statistikcentralen og SYKE, søgning i
  Geodataportalen og WMS-tjenester som baggrundskort eller lag (se [kallor.md](kallor.md)).
- **Planer**: digitale svenske lokalplaner (den nationale specifikation, Lantmäteriets geodataplatform) åbnes som
  plankort med Boverkets farver og betegnelser, bestemmelserne slås op i Boverkets Planbestämmelsekatalog (indbygget
  kopi), og kommuneplaner (specifikationen eller Boverkets ÖP-model) vises tema for tema (se [planer.md](planer.md)).
- **Nordiske planer**: Danmarks lokalplaner og kommuneplanrammer (Plandata.dk), Finlands plandatamodel og planindeks
  (Ryhti), Islands digitale lokal- og kommuneplaner (Skipulagsstofnun) og Norges reguleringsplaner (GeoPackage) åbnes som
  planer med hvert lands farver; en hel plan hentes med sit nummer fra Plandata og Skipulagsstofnun.
- **Grafer**: GraphML, GEXF, JSON med knuder og kanter og Cypher-scripts åbnes som grafer med oversigt pr. etiket, fokus og
  helgrafvisning (Cytoscape og sigma), en Cypher-delmængde oversat til SQL, grafmål i baggrunden og eksport i alle fire
  formater; to tabeller bliver en graf (se [grafer.md](grafer.md)).
  Grafen redigeres i Bearbejd og med skrivende Cypher (recepttrin), Neo4j er en kilde via Bolt, fanen Graf har PageRank,
  fællesskaber, centralitet, mønsterforespørgsler og layout, og grafer bliver diagrammer i Visualisér, dashboards og Publicér.
- **CAD og BIM**: IFC-modeller åbnes i 3D (web-ifc og three.js) over en tabel med bygningsdelene, og udvalget følger med begge veje.
  Egenskaber og mængder bliver tabeller, fanen Mængder beregner pr. type, etage og materiale, og DXF-tegninger vises som SVG med
  lag (se [cad-bim.md](cad-bim.md)).
- **Flows og overvågning**: en gemt kæde (hent, recepter, scripts, lister, diagrammer, dashboards, dokumenter, eksport) køres med ét klik
  eller ved start, og overvågede kilder siger til i statuslinjen, når de har nye data (se [floden.md](floden.md)).
- **Statistik uden kode**: fanen Statistik laver beskrivende statistik, krydstabeller, korrelation, hypotesetest, regression og klyngeanalyse
  med formularer, der skriver og viser R- eller Python-koden. Tidsserieoperationer i Bearbejd (perioder, ændring, indeks, glidende gennemsnit,
  sæsonkorrektion), og en regression kan gemmes og bruges som recepttrinnet Prædiktion (se [statistik.md](statistik.md)).
- **Indsamling i felten**: en formular bygget på et datasæts kolonner og regler sendes til Dataspatium Mobil. Telefonen indsamler rækker uden net, med foto og
  position, og rækkerne kommer tilbage som en ny version. Fotoene bliver en billedsamling, og positionerne havner på kortet (se [insamling.md](insamling.md)).
- **Gennemgang af hele filen**: det, der deles, gennemgås i sin helhed, med løbende tekst, originalfiler, billeders positioner, grafers kanter og kommentarer. Tilstandene følger også datasættets type bedre: søgefund
  åbnes, hvor de er, og kort tilbydes kun, når værdierne virkelig er koordinater (se [dela.md](dela.md)).
- **Tilstandene følger datasættet**: appen viser, hvad et datasæt også kan bruges som, og siger hvorfor, åbner Analysér i det rigtige værktøj og viser, hvad der er værd at se på. Et udvalg følger med mellem tilstandene, og eksporten siger, hvad der følger med (se [lagen.md](lagen.md)).
- **Søg og tegn efter datasættets indhold**: søg efter sted, find knuder via deres kanter og elementer via deres egenskaber, se billeder på kortet og tegn diagrammer ud fra kanter, egenskaber og mængder (se [soka.md](soka.md)).
- **Hent og Håndter følger filen**: appen siger, hvad en fil er, viser den i sin form og spørger om koordinater, koordinatsystem og forbindelser. Blandede mapper sorteres, og Håndter viser et billede pr. datasæt (se [lagen.md](lagen.md)).
- **Bearbejd følger datasættet**: kommentér en side, et billede, en knude eller et sted, ret tekst, giv billeder et sted, reparér geometrier, find dubletter i grafer, og klassificér elementer (se [bearbeta.md](bearbeta.md)).
- **Søg og Analysér følger datasættet**: spørg om en egenskab, en nabo eller et sted, start fra kode skrevet til datasættet, se trenden i en tidsserie, og tæl steder pr. område (se [soka.md](soka.md)).
- **Visualisér følger datasættet**: forslag med rigtige billeder til hver slags, krydsfiltre i dashboards og skabelonord, der indsætter et kort, en graf, en model eller en plan i et dokument (se [visualisera.md](visualisera.md)).
- **Eksportér følger datasættet**: KML, GPX og GeoPackage til steder, kontaktark til billeder, plankort og planbestemmelser til planer, mængder i Excel og glTF til modeller, PDF til tegninger (se [lagen.md](lagen.md)).
- **Del følger datasættet**: vælg, om filerne skal følge med i en pakke, gør et datasæt til sin egen side at sende, og se hver slags i sin egen form på telefonen (se [dela.md](dela.md)).
- **Kodelister, beskrivelser og guider**: etiketter fra SNI, SSYK, NACE og andre lister med et klik, datapakker, DCAT-AP-SE, kvalitetsdeklaration og fire guider med rigtige data (se [lagen.md](lagen.md)).
- **Tekst fra billeder**: skannede PDF-filer, billeder og billeder af tabeller læses med tekstgenkendelse i browseren, på alle seks sprog.
- **Oprindelse, samarbejde og bibliotek**: se, hvor et datasæt kommer fra, og hvad det er blevet til, arbejd sammen via GitHub, uden at noget forsvinder, hent opskrifter og skabeloner med licens, og publicér arbejdsområdet som et websted.
- **Kontroll som CDE, del 1**: hent modeller og dokumenter fra en OpenCDE-servers projekt, se, når en nyere version findes, og se de sager, der peger på bygningsdelene i modellen.
- **Kontroll som CDE, del 2**: opret sager fra markeringen i modellen med visningen som viewpoint, kommentér og skift status, send datasæt og filer til serveren, BCF-filer ind og ud, og selvregistrering mod servere, der tillader det.
- **Visualisere**: diagrammer med Vega-Lite (herunder koropletkort og punktkort, faste aksegrænser, logaritmisk skala, referencelinjer og trendlinjer), D3-skabeloner eller R, eksporteret
  som SVG, PNG, PDF og PowerPoint, også i batch pr. gruppe, og dashboards med fælles filtre, der bliver til HTML eller
  PowerPoint (se [visualisera.md](visualisera.md)).
- **Dokumentere**: rapporter og kodebøger fra skabeloner som HTML, Word, PDF, Markdown eller LaTeX, også ét dokument
  pr. kommune eller år (se [dokumentmallar.md](dokumentmallar.md)).
- **Eksportere og dele**: data til CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata og RDS; i
  tilstanden *Del* pakker med valgte datasæt og objekter, en besked og en ændringslog, synkronisering med et
  GitHub-repository, computerens delingsmenu og udgivelse af dashboards og dokumenter som selvstændig HTML (se
  [dela.md](dela.md)); direkte overførsel til telefoner og andre computere på samme netværk med QR-kode og
  kontrolkode, og *Dataspatium Mobil*, der modtager, viser og sender videre på telefonen (se [mobil.md](mobil.md));
  gennemgang af personoplysninger, før noget deles; kommentarer til datasæt og kolonner, backup af arbejdsområdet
  som ZIP og, i Edge og Chrome, en portabel mappe med almindelige filer.
- **Holde orden**: mapper og tags til datasæt, filter og sortering, og batchhandlinger på flere datasæt på én gang
  (ordn, pak, eksportér, hent igen, kør opskrift, slet).
- **Finde hurtigt**: tilstanden *Søg* leder i alle kolonner i ét eller alle datasæt, med facetter, der indsnævrer, og
  gemte lister (se [soka.md](soka.md)); kommandopaletten (Ctrl+K) skifter tilstand, åbner datasæt, diagrammer og
  dashboards og kører handlinger fra ét søgefelt.
- **Forespørg uden kode**: fanen *Forespørgsel* i Søg kobler datasæt, vælger kolonner og beregninger, sætter
  betingelser og viser den SQL, der laves; gemte lister indsnævrer tabellen i Bearbejd og rækkerne i diagrammer.
- **Hjælp i appen og præsentation**: hele håndbogen med søgning åbnes med ? eller F1 ved kapitlet for den tilstand,
  du står i, og **Præsentér** viser et dashboard i hele vinduet ét diagram ad gangen.
- **Seks sprog**: brugerflade, meddelelser og dokumentation på svensk, dansk, norsk (bokmål), finsk, islandsk og
  engelsk.
- **Grundkursus**: en interaktiv gennemgang af alle otte tilstande med eksempeldata på alle seks sprog. Det vises første
  gang, appen åbnes, og kan åbnes når som helst fra hjælpen eller kommandopaletten.

## Lær mere

Filnavnene er de samme på alle sprog (de svenske originaler), så links virker ens overalt.

- **Håndbogen** i appen: den samme dokumentation som her, med søgning; åbn den med ? øverst til højre eller F1.
- **Grundkurset** i appen: en interaktiv gennemgang af alle tilstande med eksempeldata; åbn det fra hjælpen (?) eller
  med Ctrl+K.
- [Kom i gang](kom-igang.md): trin for trin med almindelige spørgsmål.
- [Brugervejledning](anvandarguide.md): hele arbejdsgangen fra fil til rapport.
- [Ofte stillede spørgsmål](faq.md): lager, sikkerhed, R, API'er og opdateringer.
- [De otte tilstande](lagen.md): hvad der findes hvor og hvorfor.
- [Søg](soka.md) og [Del](dela.md): find uden kode, og giv data til andre.
- [Dataspatium Mobil](mobil.md): telefonen som kurer, modtager og fremviser; overførsel mellem enheder.
- [Notesbog](anteckningsbok.md): tekst, R og SQL i celler, der bliver til en rapport.
- [Dokumenter og billeder](dokument.md): PDF, Word, OpenDocument, Markdown og billeder som datasæt; dokumentvisning, galleri og værktøjerne Tekst og Billeder.
- [Kort](kartor.md): kortet i Bearbejd, kortvisninger i Visualisér, geoværktøjerne og QGIS-projekter.
- [Regulære udtryk](regex.md): mønstre til at analysere, rette og opdele tekst i datasæt.
- [Formater og import](format.md): filformater, tegnkodning, decimaltegn, datoer og kolonnetyper.
- [Åbne API'er](api-konfiguration.md): de forudindstillede kilder, nøgler og egne konfigurationer.
- [R i Dataspatium](r-guide.md): R-konsollen, `dm_read()`, `dm_write()` og de medfølgende pakker.
- [Python i Dataspatium](python.md): Python-konsollen, `dm_read()`, `dm_write()` og pakker, der hentes efter behov.
- [Visualisér](visualisera.md): diagrambyggeren, D3-skabeloner, R-diagrammer, kort og dashboards.
- [Dokumenter og skabeloner](dokumentmallar.md): skabelonsproget og outputformaterne.
- [Licenser](licenser.md): hvad du må med appen, og hvilke licenser tredjepartskomponenterne har.
- [Udvikling](../utveckling.md), [Arkitektur](../arkitektur.md) og [Stilguide](../stilguide.md) for dem, der vil
  forstå koden (på svensk); hvordan bidrag modtages, står i [CONTRIBUTING.md](../../CONTRIBUTING.md) (svensk).
- Eksterne ressourcer: [WebR](https://docs.r-wasm.org/webr/latest/), [R for begyndere](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [Danmarks Statistiks API](https://www.dst.dk/da/Statistik/brug-statistikken/muligheder-i-statistikbanken/api).

## Begrænsninger i korte træk

- Appen skal åbnes fra en udpakket mappe (file://) eller en almindelig webserver; den fungerer ikke direkte inde i en
  ZIP-fil.
- API'er uden CORS-understøttelse (for eksempel Energi Data Service) kan ikke kaldes direkte fra browseren.
- Et datasæt bør holde sig under et par millioner rækker; browserens hukommelse sætter grænsen.
- Når appen åbnes fra en mappe, kan R-kode ikke afbrydes midt i en beregning; brug *Genstart R*. Fra en webserver
  (localhost eller https) findes knappen *Afbryd*.
- Flere faner fungerer og holder hinanden orienteret, men redigér ikke samme datasæt i to faner samtidig: den, der
  gemmer sidst, vinder.
- Den portable mappe kræver Edge eller Chrome; Firefox mangler mappeadgang (File System Access). Backup som ZIP
  fungerer overalt.
- Hele appen er lavet til computere; på telefoner og tablets bruges Dataspatium Mobil
  (<https://marwiss.github.io/Dataspatium/m/>), der modtager, viser og sender videre. Safari understøttes ikke for
  hele appen. I smalle vinduer åbnes panelerne som ark over arbejdsfladen.
- De medfølgende eksempeldata og kortgrænser er svenske; selve appen fungerer med data fra hvor som helst.

## Fejl og forslag

Rapportér fejl eller ønsker som *Issues* her på GitHub. Beskriv browser, version af Dataspatium (vises under
hjælpeknappen), og hvad du gjorde. Se [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Udvikling

- Intet byggetrin, ingen node.js. Åbn `index.html` direkte, eller servér mappen med `python -m http.server 8080`.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` efterfulgt af `python tools/wrap_assets.py`.
- Test: `powershell -File tools/run-tests.ps1` (headless Edge og Firefox). Se [utveckling.md](../utveckling.md)
  (svensk).

## Licens

Dataspatiums egen kode, dokumentation og forudindstillinger (alt undtagen `vendor/`) er licenseret under
[PolyForm Strict 1.0.0](../../LICENSE): fri at downloade og bruge til ikke-kommercielle formål, også i myndigheder og
andre offentlige institutioner, men ikke at ændre, bygge videre på eller videredistribuere uden skriftlig
tilladelse. Licensgiver er Dataspatiums ophavsperson, der kan kontaktes via GitHub-kontoen
[marwiss](https://github.com/marwiss); opret et issue for andre vilkår. Hvad licensen betyder i praksis, forklares i
[licenser.md](licenser.md).

Tredjepartskomponenter i `vendor/` har deres egne licenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), se
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og de GPL-licenserede R-pakker distribueres uændret;
kildekoden findes hos [R-projektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr)
og [CRAN](https://cran.r-project.org/) i de versioner, der angives der.
