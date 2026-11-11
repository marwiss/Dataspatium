# Dei ni modusane

Dataspatium er delt inn i ni modusar som følgjer gangen i arbeidet, i same ånd som samle inn, bearbeide,
analysere og formidle i statistikkproduksjonen: Hent, Handter, Søk, Bearbeid, Kontroller, Analyser, Visualiser, Eksporter, Del. Alle
modusar har same skjelett: modusveljaren øvst, objektpanelet til venstre (med den eigne overskrifta til modusen i panelhovudet: Kjelder i Hent, Datasett i dei andre), arbeidsflata i midten, inspektøren til
høgre og statuslinja nedst, med loggen falda inn over henne. Panela byter aldri plass. Alt+1 til Alt+9 byter
modus. Eit tomt arbeidsområde blir opna i Hent, eit arbeidsområde med datasett i Handter. Knappane øvst til høgre opnar
kommandopaletten, byter språk, byter tema (lyst, mørkt, følg systemet) og opnar hjelpa.

**Statuslinja** viser lagringsstatus, kor mykje lagring arbeidsområdet brukar, det valde datasettet (namn, rader og
kolonnar; eit klikk opnar det i Handter), tilstanden til R-motoren (av, startar, klar, oppteken; eit klikk startar han),
pågåande internettkall (eit klikk viser loggen over kall), knappane som faldar objektpanelet, inspektøren og loggen
inn og ut, og dessutan tal på linjer i loggen.

**Breidda på panela** blir endra ved å dra i kanten mellom panel og arbeidsflate; dobbeltklikk nullstiller, og med
tastaturet flyttar piltastane kanten (Skift for større steg, Home og End for minste og største breidd). Breiddene
blir lagra. I smalare vindauge (under 1 100 px) viser modusveljaren berre ikon, med tekst på den aktive modusen, og
inspektøren blir opna som eit ark over arbeidsflata; under 760 px gjer objektpanelet det same. Eit ark blir lukka med Esc
eller eit klikk på arbeidsflata.

**Tips** blir viste for alle knappar når musepeikaren kviler på dei eller når dei får fokus med tastaturet; på
berøringsskjerm ved å halde fingeren på knappen.

Kommandopaletten (Ctrl+K eller forstørringsglaset øvst) når alt frå eitt søkjefelt: byt modus, opne eit datasett,
eit diagram eller eit dashbord, køyr ei bearbeidingshandling på det valde datasettet, eksporter, opne arbeidsområdet,
søk i data, lag ein pakke, kopier ei lenkje hit, byt tema eller sjå etter oppdateringar. Lenkjer har forma
`index.html#/<modus>/<kortnamn>` (eller namnet på eit diagram i Visualiser, ein søkjetekst i Søk) og verkar òg frå ei
mappe. Pil opp og ned vel, Enter køyrer og Esc lukkar;
dei sist køyrde kommandoane ligg øvst.

Du endrar høgda på loggpanelet ved å dra i overkanten, eller med piltastane når kanten har fokus. Dobbeltklikk tilbakestiller høgda, og høgda blir lagra.

## Hent

Her kjem data inn: filer som blir sleppte på flata, innlimt tekst, nettadresser og opne API-ar. Filimporten går i
steg: fil, innstillingar med førehandsvising, kolonnar med typar, ferdig. Format: CSV og annan avgrensa tekst,
tekst med faste kolonnebreidder, Excel, ODS, JSON (òg JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile og dessutan
via R: SPSS, Stata, SAS, PX, Parquet, RDS og RData (sjå [format.md](format.md)); R-formata blir importerte i eitt steg
utan førehandsvising. Venstre kolonne, med overskrifta *Kjelder* i panelhovudet, har fire grupper. *Vanlege kjelder*: Filer, Lim inn og Frå nettadresse. *Legg til kjelder*: Database via brua, Opne API-ar, API frå fil, Databasekjelde, OpenCDE, Neo4j og Geodatakjelde. *Tillagde kjelder*: det du har lagt til, kvar rad med ein fjern-knapp; frå start ligg SCBs og Boverkets opne API-ar der. *Andre kjelder*: Lagra hentingar, Innsamling i felt og Guidar. *Opne API-ar* viser oversynet over førehandsinnstillingar for SSB, Folkehelseinstituttet, Kartverket og
statistikkbyråa og etatane i dei andre nordiske landa, SCB (bla i emnetreet eller søk etter ein tabell), Eurostat,
Nordic Statistics med fleire, og dessutan kjelder som krev nøklar i arbeidsflata, med landknappar og søk. *Legg til* flyttar ei førehandsinnstilling til Tillagde kjelder og opnar henne; fjernar du henne der, går ho tilbake til oversynet og kan leggjast til igjen. Eigne konfigurasjonar blir lagde til med *API frå fil* og kan delast; ei eiga kjelde som blir fjerna, blir sletta med dei lagra nøklane sine. *Lagra hentingar* viser datasetta som har kome frå
eit API, og oppdaterer dei med eitt klikk, eitt om gongen eller alle. Første gongen appen skal kontakte internett for eit
føremål (API-ar, nettadresser, GitHub, komponentar) spør han om løyve; svaret kan lagrast. Sjå
[api-konfiguration.md](api-konfiguration.md).

*Database via brua* opnar bruvisinga (Access, Excel, SQL Server, SQLite og ODBC-kjelder på
datamaskina gjennom eit lite lokalt skript); kvar database du koplar til, dukkar opp under Tillagde kjelder og opnar bruvisinga igjen med den databasen vald. *Databasekjelde* lagar ei kjelde av ei adresse og ein nøkkel (PostgREST, OData, GraphQL, CouchDB,
ClickHouse, Elasticsearch, SPARQL, InfluxDB, Google Sheets og Airtable over HTTP; òg OpenCDE og Neo4j, som dessutan har eigne val i lista). Access-filer blir dessutan lesne rett
som filer, og i Chrome og Edge kan ei fil lenkjast slik at datasettet blir lese inn igjen frå disken. Sjå
[kallor.md](kallor.md).

QGIS-prosjekt (.qgs, .qgz) blir kartvisingar: lagrekkjefølgje, synlegheit og symbol følgjer med, laga blir kopla til datasett med same filnamn, og datafiler som blir sleppte saman med prosjektet blir importerte først (sjå [kartor.md](kartor.md)).

*Geodatakjelde* under Legg til kjelder: ei WFS-, OGC API Features- eller ArcGIS-teneste blir ei kjelde der
laga blir henta som GeoJSON og opna som kart, og kjelda *Geodataportalen (sök geodata)* søkjer i den svenske nasjonale
geodatakatalogen og legg til tenester med eitt klikk. Førehandsinnstilte geodatakjelder finst for SCB, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen, Kartverket, Statistikcentralen og SYKE og dessutan geodataplattforma
til Lantmäteriet for den som har nøkkel. Sjå [kallor.md](kallor.md#opne-geodata).

Digitale planar blir importerte som planar: ein svensk detaljplan etter den nasjonale spesifikasjonen (GeoJSON) eller
referanseobjekta frå Lantmäteriet, ein kommuneplan etter spesifikasjonen eller ÖP-modellen frå Boverket (GeoPackage, valet
*Heile kommuneplanen som plan*). Fila blir kjend att på innhaldet, opplysningane om planen blir viste, og planen blir opna som
plankart i Bearbeid med fargane frå Boverket (sjå [planer.md](planer.md)).

Grafar (nettverk av nodar og kantar) blir importerte som grafar frå GraphML, GEXF, JSON med nodar og kantar eller
Cypher-skript; fila blir kjend att på innhaldet, opplysningane om grafen blir viste, og grafen blir opna som grafvising i Bearbeid
(sjå [grafer.md](grafer.md)). To tabellar blir ein graf med knappen *Lag graf av tabellar* i Handter.

Bygningsmodellar i IFC og teikningar i DXF blir datasett av typen modell. Opplysningane om fila blir viste, og modellen blir opna i 3D eller
som teikning i Bearbeid (sjå [cad-bim.md](cad-bim.md)).

**Innsamling i felt** i kjeldelista byggjer eit skjema på kolonnane og reglane i eit datasett og sender det til telefonen. Radene kjem tilbake som ein ny
versjon (sjå [insamling.md](insamling.md)).

Alle kjelder i lista ser like ut, med eit symbol for typen og ei linje under namnet.

**Appen seier først kva fila er**, til dømes ein tabell med stader, ein graf eller ein bygningsmodell, og viser henne i si eiga form: eit kart, bileta, ei skisse av grafen, teikninga eller første side. Er noko verdt å spørje om, spør han: koordinatar som ser ut til å ha bytt plass, kva koordinatsystem dei er i, og om ei liste med koplingar skal lesast som ein graf. Ingenting blir endra før du har svara, og kartet viser kva svaret gjer.

**Fleire ulike filer** blir sorterte etter kva dei er: bilete blir éi samling, dokument ei anna, og kvar anna fil eit eige datasett. Du ser lista først og kan velje bort noko. Du kan òg sleppe ei heil mappe eller velje henne med *Vel ei mappe*. Ei fil som ikkje kan lesast, stoppar ikkje dei andre.

**Guidar.** Under Guidar finst fire korte vegar frå spørsmål til resultat med ekte data: samanlikn kommunar via Kolada, ein befolkningspyramide via SCB, vêr over lang tid via SMHI og prisutvikling via Den europeiske sentralbanken. Ein guide hentar, reinsar og lagrar eit diagram. Du får tabellen, diagrammet og stega å byggje vidare på. Han hentar frå nettet berre når du trykkjer på *Køyr guiden*.

**Datapakkar.** Ei ZIP-fil med `datapackage.json` (Frictionless Data Package) blir lesen inn med typane og titlane frå skjemaet, og kvar tabell blir eit datasett.

**Filer frå eit CDE.** Ei OpenCDE-kjelde listar modellane og dokumenta i prosjektet, og *Hent* lagar eit datasett av det eige slaget til fila som hugsar kvar det kom frå. Sjå [kallor.md](kallor.md).

**BCF-filer.** Ei BCF-fil (bcf, bcfzip) blir ein tabell med saker, med kommentarar og komponentar ved sida av. Sjå [format.md](format.md).

## Handter

Heimen til datasetta. Objektpanelet er eit tre: datasett kan liggje i mapper med undermapper (`Økonomi/2026`) og ha
taggar; eit filterfelt søkjer på namn, kortnamn, tagg og mappe, og lista kan sorterast etter endra, namn eller rader.
Mapper blir falda saman og ut, og datasett kan dragast til ei mappe. Avkryssingsboksane vel fleire datasett (Skift vel
eit spenn), og knappen *Handlingar (n)* opnar batchhandlingane: ordne (mappe og taggar), pakke, eksportere som ZIP med
CSV-filer, hente igjen frå API, køyre ei oppskrift og slette. Mappe og taggar følgjer datasettet i fila hans, i pakkar
og i tryggingskopiar.

Oversynet for eit datasett viser metadata, kolonneliste, kommentarar, historikk over det som er gjort med datasettet,
og versjonar, og her gjev du nytt namn og kortnamn (kortnamnet blir brukt i SQL, R og diagramfiler), ordnar, slettar og
hentar igjen frå API. Under *Arbeidsområde* finst kor mykje lagring som blir brukt, varig lagring,
tryggingskopiering til ZIP og gjenoppretting, i Edge og Chrome ei portabel mappe (arbeidsområdet blir lagra som vanlege
filer i ei mappe du vel, automatisk etter kvar endring om du vil, og kan lastast inn på ei anna datamaskin),
*Internettilgang* (kva føremål som får kontakte internett, med logg over kall) og *Komponentar* (delar av appen og
R-pakkar som blir henta når dei trengst, med storleik, kjelde og knappar for å hente på førehand eller fjerne). Pakkar og
GitHub har flytta til modusen Del.

Ei dokument- eller biletsamling blir vist med tal på dokument og sider og bilete, med dokumentlista eller dei
første miniatyrane på oversynsfana, og med knappen *Les* eller *Vis bilete* som opnar lesevisinga og
galleriet i Bearbeid (sjå [dokument.md](dokument.md)).

**Flytar og vakting** finst i objektpanelet: lagra kjeder som blir køyrde med eitt klikk eller ved start, og kjelder som seier frå når dei
har nye data (sjå [floden.md](floden.md)).

**Kva appen ser.** Oversynet viser kva datasettet òg kan brukast som: stader på eit kart, ein tidsserie, regionar som kan fargast, eit nettverk eller løpande tekst. Kvar linje seier kvifor, og du kan slå av det som ikkje stemmer, eller slå på det appen oversåg. Valet blir lagra i datasettet, og modusane følgjer det. Under det står **Verdt å sjå på** med det datatypen treng: sider utan tekst, bilete utan posisjon, kantar som peikar på nodar som ikkje finst, element utan mengder eller rader utan stad.

**Utval.** Knappen *Bruk som utval* finst i Søk og i visingane i Bearbeid. Det du ser, følgjer deretter med mellom modusane og står i statuslinja. I Bearbeid viser du det via listevalet, i Eksporter vel du om berre utvalet skal med, og i pakkar kan du sende berre utvalet. Frå statuslinja lagrar du det som ei liste, gjer det til eit datasett eller ryddar det. Blir radene i datasettet endra, forsvinn utvalet, sidan det ikkje lenger ville tyde det same.

**Bilete.** Oversynet viser eit bilete av datasettet: første side, eit kart over stadene, ei skisse av grafen, teikninga, kva modellen består av, eller ei linje over tid. Ein vanleg tabell har ikkje noko bilete.

**Fleire datasett.** Har du valt fleire, viser *Dette kan dei gjere saman* kva som er mogleg: same kart når alle har stader, éin tabell når alle har same kolonnar, og éi samling når alle er bilete eller alle er dokument. Dei valde blir ikkje endra. Ved eksport får kvart si eiga form, til dømes bilete som ZIP og grafar som GraphML.

**Versjonar** seier kva dei inneheld i dei eigne einingane til datasettet, og samanlikninga viser kva bilete, dokument, nodar, kantar eller element som har kome til og forsvunne.

**Kodelister.** Kolonnar med kodar frå ei kjend liste blir viste på oversynet: SNI, SSYK, NACE, ISCED, COFOG, NUTS, dei nordiske motstykka, land og kommunar. Eit klikk legg til namna som verdietikettar, og verdiane blir ikkje endra. Ein kort kode tel berre når namnet på kolonnen stemmer. Listene følgjer med appen, og kjeldene og lisensane deira står i `presets/kodlistor/KALLA.md`.

**Skildring.** Fana Skildring inneheld det ein dataportal vil vite etter DCAT-AP-SE: tittel, utgjevar, kontakt, tema, lisens og periode. Skildringa følgjer datasettet, seier kva som manglar, og kan lagrast som RDF/XML eller lesast inn frå ei slik fil. Ingenting blir sendt herifrå.

**Opphav.** Fana Opphav viser kvar eit datasett kjem frå og kva det har blitt til: kjelda, datasetta det vart laga av, oppskrifta og versjonane, og datasetta, diagramma, dashborda, dokumenta, notatbøkene, listene, flytane og delingane som byggjer på det. Eit klikk opnar det du klikkar på, og *Hent som tekst* gjev det same til ein rapport.

**Bibliotek.** Under Bibliotek finst ferdige oppskrifter, malar, skript og notatbøker, kvar med sin lisens. Du ser kva noko gjer før du legg det til. Fleire bibliotek blir henta frå ei nettadresse, og *Lagre eigne som biblioteksfil* lagar ei fil av det du sjølv har laga, til eit GitHub-repositorium eller kvar som helst.

**Frå CDE.** Eit datasett henta frå ein OpenCDE-tenar viser tenar, prosjekt og versjon, kan spørje etter ein nyare versjon og opne
sakene til modellen. *Publisering* viser om ein versjon er publisert på tenaren, og den prosjektansvarlege kan publisere han éin
gong etter ei stadfesting; arkivet med kontrollsummen kan så hentast. For ein modell opnar *Før inn ein bygning* ein dialog der
tenaren fører inn ein bygning frå ein annan modell som neste versjon: rapporten viser kva som følgjer med og kva objekt begge har,
du vel As, Bs eller begge for det som er ulikt, ein modell med anna skjema eller anna lengdeeining blir førebudd først, og den
prosjektansvarlege startar samanslåinga.

**Saker.** Ein tabell med saker frå eit CDE får kortet Saker: status per status, dashbordet Sakstatus og vegen til modellen. Sjå [cad-bim.md](cad-bim.md).

## Søk

Finn og list utan kode. Fana *Søk* søkjer i alle kolonnar i eitt eller alle datasett; kvart ord må finnast på rada,
uavhengig av store og små bokstavar. Treffa blir viste per datasett med tal, fasettar (dei vanlegaste verdiane i
kolonnar med få ulike verdiar, som avgrensar søket med eitt klikk) og ein tabell der ei rad opnar heile posten i
inspektøren. Eit søk kan lagrast som liste, bli eit nytt datasett eller opnast i Bearbeid. Fana *Spørjing* byggjer ei
spørjing over eitt eller fleire datasett (kolonnar, utrekningar, vilkår, sortering) utan kode og viser SQL-koden
som blir laga; ho kan opnast i Analyser, lagrast som liste eller bli eit datasett. Fana *Lister* samlar lagra søk og
spørjingar per datasett og køyrer dei igjen på dagens data; lister avgrensar òg tabellen i Bearbeid og radene i
diagram. Sjå [soka.md](soka.md).

## Bearbeid

Alt ein gjer med tabellen via knappar og dialogar: rediger celler direkte i tabellen, sorter, filtrer og sjå
kolonnestatistikk; handlingar for reinsing (søk og erstatt med regulære uttrykk, trim, store og små bokstavar,
reparasjon av teiknkoding, erstatt verdi, fyll manglande, duplikat, kategorireinsing), typar (tal, dato, ja/nei),
struktur (utrekna kolonnar, del og kombiner, slett rader, pivoter) og nye datasett (grupper og aggreger, kople,
legg saman). Datakvalitetsprofilen peikar på kva som bør rettast, og kvalitetsreglar (må ikkje mangle, unik, intervall,
liste, mønster, lengd, SQL-vilkår) kontrollerer dataa på førespurnad med rapport og feilande rader som eige
datasett. Alt blir logga som ei oppskrift som kan angrast, spelast av på eit anna datasett og eksporterast som R- eller
SQL-kode. Versjonar lagrar augneblinksbilete å gå tilbake til. Sjå [bearbeta.md](bearbeta.md).

**Dokumentsamlingar** (PDF, Word, OpenDocument, Markdown, tekst) blir opna som lesevising: vel dokument, bla
side for side, vis PDF-sida som bilete, søk i heile samlinga og hent originalen. **Biletsamlingar** blir opna
som galleri med miniatyrar, filter, sortering og EXIF-opplysningane til biletet i inspektøren, der skildringa kan
endrast. *Vis som tabell* gjev i begge tilfelle den vanlege tabellen med alle handlingar. Sjå [dokument.md](dokument.md).

Datasett med geometri eller koordinatar blir opna som eit **kart** å zoome og panorere i; klikk på eit objekt viser attributta, bakgrunnskart etter samtykke, *Lagre som kartvising* for Visualiser. *Vis som tabell* gjev tabellen (sjå [kartor.md](kartor.md)).

Eit utval frå Søk blir merkt i 3D-modellen, og kameraet blir retta mot det.

**Lese tekst i bilete.** Sider i ein skanna PDF og bilete i eit galleri kan lesast med tekstgjenkjenning, som køyrer i nettlesaren. Sjå [dokument.md](dokument.md).

**Saker.** Modellvisinga viser BCF-sakene i prosjektet frå eit CDE og merkjer bygningsdelane dei peikar på. Sjå [cad-bim.md](cad-bim.md).

**Skrive saker.** Modellvisinga opprettar saker frå merkinga med visinga som viewpoint, kommenterer og byter status, og lagrar sakene i prosjektet som BCF-fil. Sjå [cad-bim.md](cad-bim.md).

## Kontroller

Prøv data mot krav. Ein tabell blir prøvd mot enkle reglar: typen og talet på tomme verdiar (manglande eller berre mellomrom)
for kvar kolonne og talet på duplikat blant radene. Ein liten tabell blir kontrollert så snart han blir vald, ein tabell med
10 000 rader eller fleire først når du trykkjer på *Køyr kontrollen*. Inspektøren viser det valde funnet med delen av radene,
og *Opne i Bearbeid* tek deg dit for å rette det. Ein IFC-modell viser kortet *Valider modellen* og panelet *Samanlikn
versjonar* (sjå [cad-bim.md](cad-bim.md)); andre slag har ingen kontrollar enno. AI-panelet får ein fjerde modus,
*Kontroller*, for foto av skadar (planlagt).

## Analyser

Kode og statistikk. Verktøya ligg i fast rekkjefølgje: R, Python, SQL, Regex og sist notatboka, som føyer saman delar
frå dei andre. Python-konsollen har pandas, matplotlib, seaborn og plotly og blir henta som komponent første gongen du startar han (sjå
[python.md](python.md)). R-konsollen har ggplot2, dplyr, tidyr og andre pakkar,
lagra skript, diagram med eksport til SVG, PNG og PDF, og `dm_read()`/`dm_write()` for å flytte data mellom
appen og R (sjå [r-guide.md](r-guide.md)); pakkar som ikkje følgjer med appen, blir henta frå pakkearkivet til webR når koden
treng dei, etter at du har gjeve løyve. SQL-konsollen arbeider mot det valde datasettet (`data`), der andre datasett
blir nådde med kortnamna sine slik at ei spørjing kan gjere join over fleire datasett; spørjingar viser resultat som kan
lagrast som nytt datasett, endrande setningar blir logga som oppskriftssteg (sjå [bearbeta.md](bearbeta.md)). Fana Regex
prøver regulære uttrykk på ein kolonne med treffa merkte og brukar dei til å filtrere, hente ut, erstatte, dele
opp, markere, telje eller lage ein kvalitetsregel, med ein mønsterprofil og eit bibliotek med nordiske mønster (sjå
[regex.md](regex.md)). Notatboka blandar tekst (Markdown), R og SQL i celler som blir køyrde i rekkjefølgje og blir ein
rapport i HTML, Word, PDF, Markdown eller LaTeX (sjå [anteckningsbok.md](anteckningsbok.md)). Seinare: statistiske
modellar.

Når ei dokumentsamling er vald, finst fana **Tekst** (ordfrekvens med stoppord, nøkkelord i kontekst,
samførekomstar og eit oversyn per dokument), og når ei biletsamling er vald, fana **Bilete** (oversyn per type,
kamera, år eller månad og duplikat via bilethash). Begge ligg etter Regex og før Notatboka, og kvart resultat kan
lagrast som eit nytt datasett. Sjå [dokument.md](dokument.md).

For datasett med geometri finst fana **Geo** (etter Regex): mål, punkt i område, nærmaste, buffer, overlagring, samanslåing og forenkling med Turf i nettlesaren; resultata blir datasett som blir opna som kart.

Grafar får fana **Cypher** rett etter SQL (ei Cypher-delmengd sett om til SQL med SQL-en vist) og fana **Graf** etter
Regex (samandrag, grad, komponentar, kortaste veg, delgraf, nodar og kantar som tabellar).

Fana **Statistikk** etter Regex gjer vanlege analysar med skjema som skriv og viser koden (sjå [statistik.md](statistik.md)).

Modellar og teikningar får fana **Mengder** etter Regex (tal, lengd, areal og volum per type, etasje og materiale, frå fila
eller målt på geometrien).

Analyser opnar i verktøyet som passar datasettet: Tekst for dokument, Bilete for biletsamlingar, Graf for grafar, Mengder for modellar, Plan for planar, Geo for tabellar med stader og elles Statistikk. Vel du ei fane sjølv, blir du der. R startar først når du opnar fana R.

**Kode å starte frå.** I R, Python og SQL finst ei liste med kode skriven for det valde datasettet: kantane i ein graf, mengdene i ein modell, bilete per månad, sum per periode eller stadene som punkt. Valet limer inn koden der markøren står. Ei ny notatbok startar på same måte. I SQL blir sidetabellane viste med kolonnane sine, og eit klikk skriv ei spørjing om tabellen.

**Trend.** Statistikk har verktøyet *Trend*, som gjev éin verdi per periode og ei rett linje gjennom dei og seier kor mykje verdien endrar seg per periode. Eit datasett som er ein tidsserie, opnar der.

**Tel per område.** Under Geo tel *Punkt i område* stader per område, med areal og tal per kvadratkilometer. Stadene kan vere bilete med posisjon, og områda kan vere ein plan, ein tabell med flater eller kommune- og fylkesgrensene som følgjer med appen.

**Saker.** Verktøyet Saker i fana Mengder tel saker og bygningsdelar per status, type, bygningsdelstype eller etasje. Sjå [cad-bim.md](cad-bim.md).

## Visualiser

Diagram med tre motorar og éin utsjånad: diagrambyggjaren (Vega-Lite) med stolpar, linjer, flater, punkt,
histogram, varmekart, boksplott, sektorar og kart (koroplettkart frå GeoJSON- eller shapefile-data); D3-malar for
rangering, hellingsdiagram og befolkningspyramide; og R-skript med ggplot2. Lagra diagram kan eksporterast som
SVG, PNG, PDF og PowerPoint, delast som viz-filer, visast i eit galleri og lagast i batch per gruppe. Dashbord samlar
lagra diagram i eit rutenett med felles filter og blir eksporterte som HTML eller PowerPoint. Sjå
[visualisera.md](visualisera.md).

Diagramtypen **Kart** er ei kartvising med fleire lag frå datasett med geometri eller koordinatar og grensene som følgjer med, farge etter kategori eller klasse, etikettar, lagra vising og bakgrunnskart etter samtykke; interaktiv i dashbord, presentasjonar og publisert HTML, eksportert til SVG, PNG og PDF utan bakgrunnskart (sjå [kartor.md](kartor.md)).

**Sakstatus.** Dashbordet Sakstatus blir oppretta frå ein sakstabell, og eit modelldiagram kan bere fargar etter sakstatus. Sjå [cad-bim.md](cad-bim.md).

## Eksporter

Filer til di eiga datamaskin, i tre faner. **Data**: CSV (Excel-tilpassa eller standard), Excel, ODS, JSON, XML,
SQLite og dessutan via R: Parquet, SPSS, Stata og RDS. **Diagram**: lagra diagram og dashbord (òg alle diagram
som éin PowerPoint) som SVG, PNG og PDF, enkeltvis eller i batch per gruppe til ZIP. **Dokument**: rapportar,
kodebøker og samanstillingar frå malar i Markdown med plasshaldarar, som HTML, Word, PDF, Markdown eller LaTeX,
enkeltvis eller i batch per gruppe (sjå [dokumentmallar.md](dokumentmallar.md)). Det som skal til andre menneske,
finst i Del.

Eit datasett som er meir enn ein tabell, deler formata inn i **Heile datasettet** og **Berre tabellen** og seier kva som ikkje følgjer med. Dokument kan hentast som originalfiler eller rein tekst, bilete som ei ZIP-fil og grafar som to CSV-filer.

**Etter slaget til datasettet.** Tabellar med stader kan lagrast som KML, GPX og GeoPackage, i grader. I GPX blir punkt til waypoints, og linjer og konturane til flater blir til spor. Biletsamlingar kan bli eit kontaktark i PDF med bilete og namn. Ein plan kan bli eit plankart i PDF med teiknforklaring, planføresegnene i Word og originalfila om planen kom frå ei fil. Ein IFC-modell kan gje mengdene i Excel, med summar per type og alle verdiar, og geometrien som glTF. Ei DXF-teikning kan bli PDF. Eksporterer du fleire datasett i Handter, får kvart si eiga form.

**Batch per etasje eller dokument.** Batch per gruppe fungerer med kva kolonne som helst. Ein modell blir delt på kolonnen `vaning`, og biletet av modellen viser då berre den etasjen. Eit dokument blir delt på kolonnen `dokument`.

**Andre verktøy.** *Datapakke* gjev ei ZIP-fil med CSV-filer og `datapackage.json`, som mange verktøy kan lese. Kantane i ein graf og eigenskapane i ein modell følgjer med som eigne tabellar. *Kvalitetserklæring* gjev eit Word-dokument i den forma SCB brukar, fylt ut frå profil, reglar, kommentarar, endringar og skildring, med stader å skrive det berre eit menneske kan seie.

## Del

Gje data til andre. **Pakke**: ei ZIP-fil med valde datasett, diagram, dashbord, malar, notatbøker og skript, ei
melding og ein endringslogg, som mottakaren opnar under *Ta imot* og kan erstatte versjonane sine med. **GitHub**:
arbeidsområdet som ei mappe i eit repositorium, send og hent, med eit tilgangstoken som blir lagra kryptert.
**Delingsmeny**: den eigne delingsmenyen til datamaskina eller telefonen for ei fil eller ein pakke (e-post, Teams,
meldingsappar). **Publiser**: dashbord og dokument som frittståande HTML-filer. **Einingar**: direkte overføring til telefonar og andre datamaskiner på same nettverk med QR-kode, kontrollkode
og paring, og Dataspatium Mobil på telefonen (sjå [mobil.md](mobil.md)). **Ta imot**: pakkar frå fil eller
nettadresse, med avsendar og endringar synlege før noko blir teke inn. Datasett som forlèt appen, blir gjennomgådde først for
personopplysningar. Sjå [dela.md](dela.md).

**Til CDE.** Eit datasett eller originalfila til eit prosjekt på ein OpenCDE-tenar, gjennom Documents API eller som BCF-dokument. Sjå [dela.md](dela.md).

**Arbeidsområdepakke via CDE.** Fana Til CDE sender ein pakke som dokument; mottakaren tek han imot i fillista til kjelda. Sjå [dela.md](dela.md).
