# De åtte modusene

Dataspatium er delt inn i åtte moduser som følger arbeidets gang, i samme ånd som statistikkproduksjonens samle
inn, bearbeide, analysere og formidle: Hent, Håndter, Søk, Bearbeid, Analyser, Visualiser, Eksporter, Del. Alle
moduser har samme skjelett: modusvelgeren øverst, objektpanelet til venstre, arbeidsflaten i midten, inspektøren til
høyre og statuslinjen nederst, med loggen foldet inn over den. Panelene bytter aldri plass. Alt+1 til Alt+8 bytter
modus. Et tomt arbeidsområde åpnes i Hent, et arbeidsområde med datasett i Håndter. Knappene øverst til høyre åpner
kommandopaletten, bytter språk, bytter tema (lyst, mørkt, følg systemet) og åpner hjelpen.

**Statuslinjen** viser lagringsstatus, hvor mye lagring arbeidsområdet bruker, det valgte datasettet (navn, rader og
kolonner; et klikk åpner det i Håndter), R-motorens tilstand (av, starter, klar, opptatt; et klikk starter den),
pågående internettkall (et klikk viser loggen over kall), knappene som folder objektpanelet, inspektøren og loggen
inn og ut, samt antall linjer i loggen.

**Panelenes bredde** endres ved å dra i kanten mellom panel og arbeidsflate; dobbeltklikk nullstiller, og med
tastaturet flytter piltastene kanten (Skift for større steg, Home og End for minste og største bredde). Breddene
lagres. I smalere vinduer (under 1 100 px) viser modusvelgeren bare ikoner, med tekst på den aktive modusen, og
inspektøren åpnes som et ark over arbeidsflaten; under 760 px gjør objektpanelet det samme. Et ark lukkes med Esc
eller et klikk på arbeidsflaten.

**Tips** vises for alle knapper når musepekeren hviler på dem eller når de får fokus med tastaturet; på
berøringsskjerm ved å holde fingeren på knappen.

Kommandopaletten (Ctrl+K eller forstørrelsesglasset øverst) når alt fra ett søkefelt: bytt modus, åpne et datasett,
et diagram eller et dashbord, kjør en bearbeidingshandling på det valgte datasettet, eksporter, åpne arbeidsområdet,
søk i data, lag en pakke, kopier en lenke hit, bytt tema eller se etter oppdateringer. Lenker har formen
`index.html#/<modus>/<kortnavn>` (eller et diagrams navn i Visualiser, en søketekst i Søk) og virker også fra en
mappe. Pil opp og ned velger, Enter kjører og Esc lukker;
de sist kjørte kommandoene ligger øverst.

Du endrer høyden på loggpanelet ved å dra i overkanten, eller med piltastene når kanten har fokus. Dobbeltklikk tilbakestiller høyden, og høyden lagres.

## Hent

Her kommer data inn: filer som slippes på flaten, innlimt tekst, nettadresser og åpne API-er. Filimporten går i
trinn: fil, innstillinger med forhåndsvisning, kolonner med typer, ferdig. Formater: CSV og annen avgrenset tekst,
tekst med faste kolonnebredder, Excel, ODS, JSON (også JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile samt
via R: SPSS, Stata, SAS, PX, Parquet, RDS og RData (se [format.md](format.md)); R-formatene importeres i ett trinn
uten forhåndsvisning. Under Åpne API-er finnes forhåndsinnstillinger for SSB, Folkehelseinstituttet, Kartverket og de
øvrige nordiske landenes statistikkbyråer og etater, SCB (bla i emnetreet eller søk etter en tabell), Eurostat,
Nordic Statistics med flere, samt kilder som krever nøkler; landknappene over listen velger hvilke lands kilder som
vises. Egne konfigurasjoner legges til fra fil og kan deles. *Lagrede hentinger* viser datasettene som har kommet fra
et API, og oppdaterer dem med ett klikk, ett om gangen eller alle. Første gang appen skal kontakte internett for et
formål (API-er, nettadresser, GitHub, komponenter) spør den om lov; svaret kan lagres. Se
[api-konfiguration.md](api-konfiguration.md).

Under *Databaser* finnes to veier inn: *Database via broen* (Access, Excel, SQL Server, SQLite og ODBC-kilder på
datamaskinen gjennom et lite lokalt skript) og *Legg til databasekilde* (PostgREST, OData, GraphQL, CouchDB,
ClickHouse, Elasticsearch, SPARQL, InfluxDB, Google Sheets og Airtable over HTTP). Access-filer leses dessuten rett
som filer, og i Chrome og Edge kan en fil lenkes slik at datasettet leses inn igjen fra disken. Se
[kallor.md](kallor.md).

QGIS-prosjekter (.qgs, .qgz) blir kartvisninger: lagrekkefølge, synlighet og symboler følger med, lagene kobles til datasett med samme filnavn, og datafiler som slippes sammen med prosjektet importeres først (se [kartor.md](kartor.md)).

Under *Databaser* finnes også *Legg til geodatakilde*: en WFS-, OGC API Features- eller ArcGIS-tjeneste blir en kilde der
lagene hentes som GeoJSON og åpnes som kart, og kilden *Geodataportalen (sök geodata)* søker i den svenske nasjonale
geodatakatalogen og legger til tjenester med ett klikk. Forhåndsinnstilte geodatakilder finnes for SCB, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen, Kartverket, Statistikcentralen og SYKE samt Lantmäteriets
geodataplattform for den som har nøkkel. Se [kallor.md](kallor.md#åpne-geodata).

Digitale planer importeres som planer: en svensk detaljplan etter den nasjonale spesifikasjonen (GeoJSON) eller
Lantmäteriets referanseobjekter, en kommuneplan etter spesifikasjonen eller Boverkets ÖP-modell (GeoPackage, valget
*Hele kommuneplanen som plan*). Filen gjenkjennes på innholdet, planens opplysninger vises, og planen åpnes som
plankart i Bearbeid med Boverkets farger (se [planer.md](planer.md)).

Grafer (nettverk av noder og kanter) importeres som grafer fra GraphML, GEXF, JSON med noder og kanter eller
Cypher-skript; filen gjenkjennes på innholdet, grafens opplysninger vises, og grafen åpnes som grafvisning i Bearbeid
(se [grafer.md](grafer.md)). To tabeller blir en graf med knappen *Lag graf av tabeller* i Håndter.

Bygningsmodeller i IFC og tegninger i DXF blir datasett av typen modell. Filens opplysninger vises, og modellen åpnes i 3D eller
som tegning i Bearbeid (se [cad-bim.md](cad-bim.md)).

**Innsamling i felt** i kildelisten bygger et skjema på et datasetts kolonner og regler og sender det til telefonen. Radene kommer tilbake som en ny
versjon (se [insamling.md](insamling.md)).

Alle kilder i listen ser like ut, med et symbol for typen og en linje under navnet. *Legg til kilde* samler alle måter å legge til en kilde på: en konfigurasjonsfil, en database eller en geodatatjeneste.

**Appen sier først hva filen er**, for eksempel en tabell med steder, en graf eller en bygningsmodell, og viser den i sin egen form: et kart, bildene, en skisse av grafen, tegningen eller første side. Er noe verdt å spørre om, spør den: koordinater som ser ut til å ha byttet plass, hvilket koordinatsystem de er i, og om en liste med koblinger skal leses som en graf. Ingenting endres før du har svart, og kartet viser hva svaret gjør.

**Flere ulike filer** sorteres etter hva de er: bilder blir én samling, dokumenter en annen, og hver annen fil et eget datasett. Du ser listen først og kan velge bort noe. Du kan også slippe en hel mappe eller velge den med *Velg en mappe*. En fil som ikke kan leses, stopper ikke de andre.

**Guider.** Under Guider finnes fire korte veier fra spørsmål til resultat med ekte data: sammenlign kommuner via Kolada, en befolkningspyramide via SCB, vær over lang tid via SMHI og prisutvikling via Den europeiske sentralbanken. En guide henter, renser og lagrer et diagram. Du får tabellen, diagrammet og stegene å bygge videre på. Den henter fra nettet bare når du trykker på *Kjør guiden*.

**Datapakker.** En ZIP-fil med `datapackage.json` (Frictionless Data Package) leses inn med typene og titlene fra skjemaet, og hver tabell blir et datasett.

**Filer fra et CDE.** En OpenCDE-kilde lister prosjektets modeller og dokumenter, og *Hent* lager et datasett av filens eget slag som husker hvor det kom fra. Se [kallor.md](kallor.md).

**BCF-filer.** En BCF-fil (bcf, bcfzip) blir en tabell med saker, med kommentarer og komponenter ved siden av. Se [format.md](format.md).

## Håndter

Datasettenes hjem. Objektpanelet er et tre: datasett kan ligge i mapper med undermapper (`Økonomi/2026`) og ha
tagger; et filterfelt søker på navn, kortnavn, tagg og mappe, og listen kan sorteres etter endret, navn eller rader.
Mapper foldes sammen og ut, og datasett kan dras til en mappe. Avkrysningsboksene velger flere datasett (Skift velger
et spenn), og knappen *Handlinger (n)* åpner batchhandlingene: ordne (mappe og tagger), pakke, eksportere som ZIP med
CSV-filer, hente igjen fra API, kjøre en oppskrift og slette. Mappe og tagger følger datasettet i filen dens, i pakker
og i sikkerhetskopier.

Oversikten for et datasett viser metadata, kolonneliste, kommentarer, historikk over det som er gjort med datasettet,
og versjoner, og her gir du nytt navn og kortnavn (kortnavnet brukes i SQL, R og diagramfiler), ordner, sletter og
henter igjen fra API. Under *Arbeidsområde* finnes hvor mye lagring som brukes, vedvarende lagring,
sikkerhetskopiering til ZIP og gjenoppretting, i Edge og Chrome en portabel mappe (arbeidsområdet lagres som vanlige
filer i en mappe du velger, automatisk etter hver endring om du vil, og kan lastes inn på en annen datamaskin),
*Internettilgang* (hvilke formål som får kontakte internett, med logg over kall) og *Komponenter* (deler av appen og
R-pakker som hentes når de trengs, med størrelse, kilde og knapper for å hente på forhånd eller fjerne). Pakker og
GitHub har flyttet til modusen Del.

En dokument- eller bildesamling vises med antall dokumenter og sider respektive bilder, med dokumentlisten eller de
første miniatyrene på oversiktsfanen, og med knappen *Les* eller *Vis bilder* som åpner lesevisningen respektive
galleriet i Bearbeid (se [dokument.md](dokument.md)).

**Flyter og overvåking** finnes i objektpanelet: lagrede kjeder som kjøres med ett klikk eller ved start, og kilder som sier fra når de
har nye data (se [floden.md](floden.md)).

**Hva appen ser.** Oversikten viser hva datasettet også kan brukes som: steder på et kart, en tidsserie, regioner som kan farges, et nettverk eller løpende tekst. Hver linje sier hvorfor, og du kan slå av det som ikke stemmer, eller slå på det appen overså. Valget lagres i datasettet, og modusene følger det. Under det står **Verdt å se på** med det datatypen trenger: sider uten tekst, bilder uten posisjon, kanter som peker på noder som ikke finnes, elementer uten mengder eller rader uten sted.

**Utvalg.** Knappen *Bruk som utvalg* finnes i Søk og i Bearbeids visninger. Det du ser, følger deretter med mellom modusene og står i statuslinjen. I Bearbeid viser du det via listevalget, i Eksporter velger du om bare utvalget skal med, og i pakker kan du sende bare utvalget. Fra statuslinjen lagrer du det som en liste, gjør det til et datasett eller rydder det. Endres radene i datasettet, forsvinner utvalget, siden det ikke lenger ville bety det samme.

**Bilde.** Oversikten viser et bilde av datasettet: første side, et kart over stedene, en skisse av grafen, tegningen, hva modellen består av, eller en linje over tid. En vanlig tabell har ikke noe bilde.

**Flere datasett.** Har du valgt flere, viser *Dette kan de gjøre sammen* hva som er mulig: samme kart når alle har steder, én tabell når alle har samme kolonner, og én samling når alle er bilder eller alle er dokumenter. De valgte endres ikke. Ved eksport får hvert sin egen form, for eksempel bilder som ZIP og grafer som GraphML.

**Versjoner** sier hva de inneholder i datasettets egne enheter, og sammenligningen viser hvilke bilder, dokumenter, noder, kanter eller elementer som har kommet til og forsvunnet.

**Kodelister.** Kolonner med koder fra en kjent liste vises på oversikten: SNI, SSYK, NACE, ISCED, COFOG, NUTS, de nordiske motstykkene, land og kommuner. Et klikk legger til navnene som verdietiketter, og verdiene endres ikke. En kort kode teller bare når kolonnens navn stemmer. Listene følger med appen, og kildene og lisensene deres står i `presets/kodlistor/KALLA.md`.

**Beskrivelse.** Fanen Beskrivelse inneholder det en dataportal vil vite etter DCAT-AP-SE: tittel, utgiver, kontakt, tema, lisens og periode. Beskrivelsen følger datasettet, sier hva som mangler, og kan lagres som RDF/XML eller leses inn fra en slik fil. Ingenting sendes herfra.

**Opprinnelse.** Fanen Opprinnelse viser hvor et datasett kommer fra og hva det har blitt til: kilden, datasettene det ble laget av, oppskriften og versjonene, og datasettene, diagrammene, dashboardene, dokumentene, notatbøkene, listene, flytene og delingene som bygger på det. Et klikk åpner det du klikker på, og *Hent som tekst* gir det samme til en rapport.

**Bibliotek.** Under Bibliotek finnes ferdige oppskrifter, maler, skript og notatbøker, hver med sin lisens. Du ser hva noe gjør før du legger det til. Flere biblioteker hentes fra en nettadresse, og *Lagre egne som biblioteksfil* lager en fil av det du selv har laget, til et GitHub-repo eller hvor som helst.

**Fra CDE.** Et datasett hentet fra en OpenCDE-server viser server, prosjekt og versjon, kan spørre etter en nyere versjon og åpne modellens saker.

## Søk

Finn og list uten kode. Fanen *Søk* søker i alle kolonner i ett eller alle datasett; hvert ord må finnes på raden,
uavhengig av store og små bokstaver. Treffene vises per datasett med antall, fasetter (de vanligste verdiene i
kolonner med få ulike verdier, som avgrenser søket med ett klikk) og en tabell der en rad åpner hele posten i
inspektøren. Et søk kan lagres som liste, bli et nytt datasett eller åpnes i Bearbeid. Fanen *Spørring* bygger en
spørring over ett eller flere datasett (kolonner, beregninger, betingelser, sortering) uten kode og viser SQL-koden
som lages; den kan åpnes i Analyser, lagres som liste eller bli et datasett. Fanen *Lister* samler lagrede søk og
spørringer per datasett og kjører dem igjen på dagens data; lister avgrenser også tabellen i Bearbeid og radene i
diagrammer. Se [soka.md](soka.md).

## Bearbeid

Alt man gjør med tabellen via knapper og dialoger: rediger celler direkte i tabellen, sorter, filtrer og se
kolonnestatistikk; handlinger for rensing (søk og erstatt med regulære uttrykk, trim, store og små bokstaver,
reparasjon av tegnkoding, erstatt verdi, fyll manglende, duplikater, kategorirensing), typer (tall, dato, ja/nei),
struktur (beregnede kolonner, del og kombiner, slett rader, pivoter) og nye datasett (grupper og aggreger, koble,
legg sammen). Datakvalitetsprofilen peker på hva som bør rettes, og kvalitetsregler (må ikke mangle, unik, intervall,
liste, mønster, lengde, SQL-betingelse) kontrollerer dataene på forespørsel med rapport og feilende rader som eget
datasett. Alt logges som en oppskrift som kan angres, spilles av på et annet datasett og eksporteres som R- eller
SQL-kode. Versjoner lagrer øyeblikksbilder å gå tilbake til. Se [bearbeta.md](bearbeta.md).

**Dokumentsamlinger** (PDF, Word, OpenDocument, Markdown, tekst) åpnes som lesevisning: velg dokument, bla
side for side, vis PDF-siden som bilde, søk i hele samlingen og hent originalen. **Bildesamlinger** åpnes
som galleri med miniatyrer, filter, sortering og bildets EXIF-opplysninger i inspektøren, der beskrivelsen kan
endres. *Vis som tabell* gir i begge tilfeller den vanlige tabellen med alle handlinger. Se [dokument.md](dokument.md).

Datasett med geometri eller koordinater åpnes som et **kart** å zoome og panorere i; klikk på et objekt viser attributtene, bakgrunnskart etter samtykke, *Lagre som kartvisning* for Visualiser. *Vis som tabell* gir tabellen (se [kartor.md](kartor.md)).

Et utvalg fra Søk markeres i 3D-modellen, og kameraet rettes mot det.

**Lese tekst i bilder.** Sider i en skannet PDF og bilder i et galleri kan leses med tekstgjenkjenning, som kjører i nettleseren. Se [dokument.md](dokument.md).

**Saker.** Modellvisningen viser prosjektets BCF-saker fra et CDE og markerer bygningsdelene de peker på. Se [cad-bim.md](cad-bim.md).

**Skrive saker.** Modellvisningen oppretter saker fra markeringen med visningen som viewpoint, kommenterer og bytter status, og lagrer prosjektets saker som BCF-fil. Se [cad-bim.md](cad-bim.md).

## Analyser

Kode og statistikk. Verktøyene ligger i fast rekkefølge: R, Python, SQL, Regex og sist notatboken, som føyer sammen deler
fra de andre. Python-konsollen har pandas, matplotlib, seaborn og plotly og hentes som komponent første gang du starter den (se
[python.md](python.md)). R-konsollen har ggplot2, dplyr, tidyr og andre pakker,
lagrede skript, diagrammer med eksport til SVG, PNG og PDF, og `dm_read()`/`dm_write()` for å flytte data mellom
appen og R (se [r-guide.md](r-guide.md)); pakker som ikke følger med appen, hentes fra webR sitt pakkearkiv når koden
trenger dem, etter at du har gitt lov. SQL-konsollen arbeider mot det valgte datasettet (`data`), der andre datasett
nås med kortnavnene sine slik at en spørring kan gjøre join over flere datasett; spørringer viser resultater som kan
lagres som nytt datasett, endrende setninger logges som oppskriftstrinn (se [bearbeta.md](bearbeta.md)). Fanen Regex
prøver regulære uttrykk på en kolonne med treffene markert og bruker dem til å filtrere, hente ut, erstatte, dele
opp, markere, telle eller lage en kvalitetsregel, med en mønsterprofil og et bibliotek med nordiske mønstre (se
[regex.md](regex.md)). Notatboken blander tekst (Markdown), R og SQL i celler som kjøres i rekkefølge og blir en
rapport i HTML, Word, PDF, Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)). Senere: statistiske
modeller.

Når en dokumentsamling er valgt, finnes fanen **Tekst** (ordfrekvens med stoppord, nøkkelord i kontekst,
samforekomster og en oversikt per dokument), og når en bildesamling er valgt, fanen **Bilder** (oversikt per type,
kamera, år eller måned og duplikater via bildehash). Begge ligger etter Regex og før Notatboken, og hvert resultat kan
lagres som et nytt datasett. Se [dokument.md](dokument.md).

For datasett med geometri finnes fanen **Geo** (etter Regex): mål, punkter i områder, nærmeste, buffer, overlagring, sammenslåing og forenkling med Turf i nettleseren; resultatene blir datasett som åpnes som kart.

Grafer får fanen **Cypher** rett etter SQL (en Cypher-delmengde oversatt til SQL med SQL-en vist) og fanen **Graf** etter
Regex (sammendrag, grad, komponenter, korteste vei, delgraf, noder og kanter som tabeller).

Fanen **Statistikk** etter Regex gjør vanlige analyser med skjemaer som skriver og viser koden (se [statistik.md](statistik.md)).

Modeller og tegninger får fanen **Mengder** etter Regex (antall, lengde, areal og volum per type, etasje og materiale, fra filen
eller målt på geometrien).

Analyser åpner i verktøyet som passer datasettet: Tekst for dokumenter, Bilder for bildesamlinger, Graf for grafer, Mengder for modeller, Plan for planer, Geo for tabeller med steder og ellers Statistikk. Velger du en fane selv, blir du der. R starter først når du åpner fanen R.

**Kode å starte fra.** I R, Python og SQL finnes en liste med kode skrevet for det valgte datasettet: en grafs kanter, en modells mengder, bilder per måned, sum per periode eller stedene som punkter. Valget limer inn koden der markøren står. En ny notatbok starter på samme måte. I SQL vises sidetabellene med kolonnene sine, og et klikk skriver en spørring om tabellen.

**Trend.** Statistikk har verktøyet *Trend*, som gir én verdi per periode og en rett linje gjennom dem og sier hvor mye verdien endres per periode. Et datasett som er en tidsserie, åpner der.

**Tell per område.** Under Geo teller *Punkter i områder* steder per område, med areal og antall per kvadratkilometer. Stedene kan være bilder med posisjon, og områdene kan være en plan, en tabell med flater eller kommune- og fylkesgrensene som følger med appen.

## Visualiser

Diagrammer med tre motorer og ett utseende: diagrambyggeren (Vega-Lite) med stolper, linjer, flater, punkter,
histogrammer, varmekart, boksplott, sektorer og kart (koroplettkart fra GeoJSON- eller shapefile-data); D3-maler for
rangering, helningsdiagram og befolkningspyramide; og R-skript med ggplot2. Lagrede diagrammer kan eksporteres som
SVG, PNG, PDF og PowerPoint, deles som viz-filer, vises i et galleri og lages i batch per gruppe. Dashbord samler
lagrede diagrammer i et rutenett med felles filtre og eksporteres som HTML eller PowerPoint. Se
[visualisera.md](visualisera.md).

Diagramtypen **Kart** er en kartvisning med flere lag fra datasett med geometri eller koordinater og de medfølgende grensene, farge etter kategori eller klasse, etiketter, lagret visning og bakgrunnskart etter samtykke; interaktiv i dashboards, presentasjoner og publisert HTML, eksportert til SVG, PNG og PDF uten bakgrunnskart (se [kartor.md](kartor.md)).

## Eksporter

Filer til din egen datamaskin, i tre faner. **Data**: CSV (Excel-tilpasset eller standard), Excel, ODS, JSON, XML,
SQLite samt via R: Parquet, SPSS, Stata og RDS. **Diagrammer**: lagrede diagrammer og dashbord (også alle diagrammer
som én PowerPoint) som SVG, PNG og PDF, enkeltvis eller i batch per gruppe til ZIP. **Dokumenter**: rapporter,
kodebøker og sammenstillinger fra maler i Markdown med plassholdere, som HTML, Word, PDF, Markdown eller LaTeX,
enkeltvis eller i batch per gruppe (se [dokumentmallar.md](dokumentmallar.md)). Det som skal til andre mennesker,
finnes i Del.

Et datasett som er mer enn en tabell, deler formatene inn i **Hele datasettet** og **Bare tabellen** og sier hva som ikke følger med. Dokumenter kan hentes som originalfiler eller ren tekst, bilder som en ZIP og grafer som to CSV-filer.

**Etter datasettets slag.** Tabeller med steder kan lagres som KML, GPX og GeoPackage, i grader. I GPX blir punkter til waypoints, og linjer og flaters konturer blir til spor. Bildesamlinger kan bli et kontaktark i PDF med bilder og navn. En plan kan bli et plankart i PDF med tegnforklaring, planbestemmelsene i Word og originalfilen hvis planen kom fra en fil. En IFC-modell kan gi mengdene i Excel, med summer per type og alle verdier, og geometrien som glTF. En DXF-tegning kan bli PDF. Eksporterer du flere datasett i Håndter, får hvert sin egen form.

**Batch per etasje eller dokument.** Batch per gruppe fungerer med hvilken som helst kolonne. En modell deles på kolonnen `vaning`, og bildet av modellen viser da bare den etasjen. Et dokument deles på kolonnen `dokument`.

**Andre verktøy.** *Datapakke* gir en ZIP med CSV-filer og `datapackage.json`, som mange verktøy kan lese. En grafs kanter og en modells egenskaper følger med som egne tabeller. *Kvalitetserklæring* gir et Word-dokument i den formen SCB bruker, fylt ut fra profil, regler, kommentarer, endringer og beskrivelse, med steder å skrive det bare et menneske kan si.

## Del

Gi data til andre. **Pakke**: en ZIP med valgte datasett, diagrammer, dashbord, maler, notatbøker og skript, en
melding og en endringslogg, som mottakeren åpner under *Motta* og kan erstatte sine versjoner med. **GitHub**:
arbeidsområdet som en mappe i et repository, send og hent, med et tilgangstoken som lagres kryptert.
**Delingsmeny**: datamaskinens eller telefonens egen delingsmeny for en fil eller en pakke (e-post, Teams,
meldingsapper). **Publiser**: dashbord og dokumenter som frittstående HTML-filer. **Enheter**: direkte overføring til telefoner og andre datamaskiner på samme nettverk med QR-kode, kontrollkode
og paring, og Dataspatium Mobil på telefonen (se [mobil.md](mobil.md)). **Motta**: pakker fra fil eller
nettadresse, med avsender og endringer synlige før noe tas inn. Datasett som forlater appen, gjennomgås først for
personopplysninger. Se [dela.md](dela.md).

**Til CDE.** Et datasett eller originalfilen til et prosjekt på en OpenCDE-server, gjennom Documents API eller som BCF-dokument. Se [dela.md](dela.md).
