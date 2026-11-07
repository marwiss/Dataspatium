# Ofte stillede spørgsmål

## Hvor gemmes mine data?

I browserens egen database (IndexedDB) på den computer og i den browserprofil, du bruger. Intet sendes nogen steder.
Rydder du webstedsdata, skifter profil eller afinstallerer browseren, forsvinder data. Tag derfor backup under *Håndter →
Arbejdsområde*, eller brug en portabel mappe i Edge og Chrome, så arbejdsområdet også ligger som almindelige filer på
disken (se [kom-igang.md](kom-igang.md)).

## Har jeg brug for internet?

Nej. Internet kræves kun, når du henter data fra et API, sender til eller henter fra GitHub, klikker på *Søg efter
opdateringer* eller bruger noget, der ikke følger med i mappen: visse komponenter (for eksempel baggrundskort) og
R-pakker uden for det indbyggede udvalg hentes, når der er brug for dem, og gemmes derefter lokalt. Første gang appen
har brug for internettet til et formål, spørger den om lov; svaret kan gemmes og ændres under *Håndter →
Arbejdsområde → Internetadgang*, hvor også loggen over kald findes. Alt andet, også R, fungerer uden netværk.

## Hvorfor tager det tid første gang, jeg bruger R?

R indlæses som WebAssembly (omkring 50 MB) og starter på nogle sekunder. Pakker som ggplot2 installeres i R-sessionen,
første gang du bruger dem, hvilket tager yderligere nogle sekunder. R-sessionen starter forfra, når du genindlæser siden,
men dine datasæt og scripts er der stadig.

Intet af dette indlæses, når appen starter, kun når det bruges: R ligger i appens mappe og pakkes ud i browseren, første gang fanen R
åbnes, Python hentes som komponenter, første gang du trykker Start Python, og 3D-modeller, PDF og kort indlæses på samme måde, når der
er brug for dem. I mellemtiden står der i statuslinjen, hvad der indlæses, og R-konsollen viser, hvilken fil den venter på.

Når noget hentes over nettet, det vil sige appens egne filer, når den kører fra en webserver, og komponenter som Python, IfcOpenShell
og OCR, viser statuslinjen, hvor meget der er hentet af det hele, hastigheden og omtrent hvor lang tid der er tilbage i det tempo, med
en knap til at afbryde. Det, der ventede på hentningen, får så en besked om, at den blev afbrudt, og kan startes igen senere. Fra
mappen (file://) hentes intet; filerne ligger på disken.

## Kan jeg afbryde R-kode, der hænger?

Ja, når appen kører fra en webserver (for eksempel `python -m http.server 8080` på din egen computer eller https på et
intranet): så findes knappen *Afbryd* ved siden af *Kør* i R-fanen, og R-sessionen med dens objekter bevares. Når appen
åbnes fra en mappe (file://), tillader browseren ikke den mekanisme, der kræves; brug så *Genstart R* i Analysér.
Datasættene påvirkes ikke.

## Hvordan virker Python i appen?

Python (Pyodide) følger ikke med i mappen. Første gang du trykker *Start Python* eller *Kør* i fanen Python, spørger
appen om lov til at hente komponenter og downloader Python med numpy og pandas (cirka 22 MB) fra jsDelivr, kontrolleret
mod kendte kontrolsummer. Derefter gemmes alt i browseren, og Python starter uden internet. Pakker, som koden
importerer (matplotlib, scipy, scikit-learn og de øvrige i Pyodides udvalg), hentes på samme måde, når de skal bruges.
Se [python.md](python.md).

## Hvorfor virker et API ikke?

Oftest mangler API'et CORS-understøttelse, det vil sige, at browseren ikke må læse svaret. Så kan Dataspatium kun nå det
via en proxy, som du selv driver (indstilling under Hent). Nogle API'er kræver desuden en nøgle. Se
[api-konfiguration.md](api-konfiguration.md), der også beskriver, hvordan du får nøgler.

## Hvordan gemmes API-nøgler?

Enten kun i hukommelsen under sessionen eller krypteret med en adgangssætning, du vælger. Aldrig i klartekst, og de følger
aldrig med, når du deler en konfiguration.

## Hvor store datasæt klarer appen?

Et par millioner rækker i Edge og Chrome, lidt færre i Firefox; browserens hukommelse sætter grænsen. Målte tider for en
million rækker findes i [utveckling.md](../utveckling.md) (svensk). Tekstfiler på 64 MB eller mere læses i bidder, så
selve indlæsningen ikke kræver, at hele filen kan være i hukommelsen som tekst.

## Hvad adskiller Firefox fra Edge og Chrome?

Udseende og funktioner er de samme, men Firefox mangler mappeadgang, så den portable mappe findes ikke der. Backup som ZIP
fungerer overalt.

## Kan appen køre fra en webserver eller et intranet?

Ja. Læg mappen uændret på en vilkårlig statisk webserver; der kræves ingen serverfunktioner. Over https, og på din egen
computer over `http://localhost`, registrerer appen en service worker (`sw-coi.js`), der gør siden *cross-origin
isolated*, og så kan R-kode afbrydes. Første gang genindlæses siden én gang, når den tager over. Over almindelig http på
et intranet tillader browseren ingen service workers, men en server, der selv sender headerne
`Cross-Origin-Opener-Policy: same-origin` og `Cross-Origin-Embedder-Policy: credentialless`, giver det samme. Alt andet
virker som fra mappen. Browseren gemmer data pr. adresse, så arbejdsområdet i mappen og det på serveren er adskilte;
flyt mellem dem med backup eller en pakke.

Fra en webserver, også <https://marwiss.github.io/Dataspatium/>, kan appen installeres som en selvstændig app: i Edge
og Chrome via ikonet *Installér* i adresselinjen eller browserens menu. Den får så sit eget vindue og sit eget ikon,
filerne gemmes i browseren, så den fungerer uden netværk, og lageret bliver vedvarende. Nye versioner hentes, når
appen åbnes igen med netværk.

## Kan jeg åbne index.html direkte i ZIP-filen?

Nej. Pak ZIP-filen ud først (højreklik, og vælg *Udpak alle* i Windows), og åbn derefter `index.html` i den udpakkede
mappe.

## Hvordan opdaterer jeg?

Download den nye version, og pak den ud i en ny mappe. Dine data ligger i browseren, ikke i mappen, så de er der stadig,
når du åbner den nye versions `index.html` på samme computer og i samme browser. Under hjælpeknappen findes *Søg efter
opdateringer*, der sammenligner din version med den seneste udgivelse på GitHub. Kontrollen foretages kun, når du
klikker.

## Kan jeg skifte sprog?

Ja. Første gang appen åbnes, vælger du sprog; derefter åbner sprogknappen øverst til højre (ikonet med bogstaver) eller
kommandoen *Sprog* i paletten det samme valg. Svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og engelsk findes. Appen
genindlæses på det valgte sprog, når ugemte ændringer er gemt. Valget gemmes i browseren, så hver computer og profil har
sit eget. Dokumentationen findes på de samme sprog i mappen `docs`.

## Findes der kilder fra andre nordiske lande?

Ja. Under *Tilføj kilder* → *Åbne API'er* i Hent findes statistikbureauerne i Danmark, Norge, Finland, Island, Grønland, Færøerne og Åland,
Nordic Statistics, Folkehelseinstituttet, Brønnøysundregistrene, Kartverket, MET Norway, THL's Sotkanet, PRH's
virksomhedsregister, Digitraffic, Meteorologisk institut i Finland, Veðurstofa Íslands og de danske og finske
dataportaler. Landeknapperne over listen vælger, hvilke landes kilder der vises; valget gemmes i browseren. Alle kilder er
kontrolleret for CORS og kræver ingen nøgle. Se [api-konfiguration.md](api-konfiguration.md).

## Kan jeg have appen åben i flere faner?

Ja. Fanerne deler samme arbejdsområde og holder hinanden orienteret: gemmer eller sletter du noget i én fane, genindlæser
de andre deres lister og logger, hvad der skete. Redigér alligevel ikke samme datasæt i to faner samtidig; har begge
ugemte ændringer, vinder den, der gemmer sidst.

## Kan en anden lokal HTML-fil læse mine data?

I Edge og Chrome deler alle filer, der åbnes via file://, samme lager. Åbn derfor ikke ukendte HTML-filer lokalt, mens du
har følsomme data i appen. Nøgler gemmes aldrig i klartekst. Firefox holder lokale filer adskilt.

## Må jeg bruge appen på arbejdet?

Ja, hvis arbejdsgiveren er en myndighed, kommune, region, skole, et lærested eller en almennyttig organisation, det vil
sige ikke-kommerciel brug. Kommerciel brug kræver tilladelse fra licensgiveren. Se [licenser.md](licenser.md).

## Hvordan laver jeg et kort?

For Sverige: klik på *Svenske kommunegrænser (SCB)* eller *Svenske länsgrænser (SCB)* i Hent; grænserne følger med
appen. For andre lande importerer du grænser fra GeoJSON, shapefile eller GeoPackage. Kobl derefter dine værdier til
grænserne på koden i Bearbejd (*Sammenkobl datasæt*), og vælg diagramtypen *Kort* i Visualisér. Punkter med længde- og
breddegrad (for eksempel målestationer) tegnes med *Punktkort*. Se [visualisera.md](visualisera.md).

## Hvordan finder jeg kommune eller region ud fra koordinater?

Vælg *Geodata > Kommune og region ud fra koordinater* i Bearbejd (via Handlinger eller paletten). Handlingen slår hver punkts
kommune og region op i SCB's medfølgende grænser og tilføjer kolonnerne kommunkod, kommun, lanskod og lan; koordinater i
SWEREF 99 TM genkendes. Grænserne dækker landarealet, så punkter i vand bliver tomme. Samme gruppe har midtpunkt og areal ud
fra geometri samt omregning mellem SWEREF 99 TM og WGS 84. Se [bearbeta.md](bearbeta.md).



## Hvordan kombinerer jeg flere datasæt i én SQL-forespørgsel?

Hvert datasæt har et kortnavn (vises under navnet i objektpanelet, ændres under Håndter > Omdøb). I SQL-fanen under
Analysér hedder det valgte datasæt `data`, men nås også med sit kortnavn, og alle andre datasæt nås med deres kortnavne:
`select k.kommun, b.folkmangd from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. Resultatet kan
gemmes som nyt datasæt. I R læser `dm_read("kortnavn")` samme datasæt. Se [bearbeta.md](bearbeta.md).

## Hvordan kontrollerer jeg, at data holder mål?

*Datakvalitet* i Bearbejd profilerer alle kolonner og foreslår handlinger. *Regler* lader dig skrive krav ned (må ikke
mangle, unik, interval, liste, mønster, længde eller en SQL-betingelse) og køre dem efter hver import; fejlende rækker kan
gemmes som eget datasæt, og resultatet downloades som rapport. Reglerne gemmes i datasættet og følger med, når du deler
det. Se [bearbeta.md](bearbeta.md).

## Kan jeg fjerne personnumre, før jeg deler et datasæt?

Ja. Handlingen *Pseudonymisér* i Bearbejd erstatter identifikatorer med saltede hashværdier, maskerede værdier eller
løbenumre, og datakvalitetsprofilen foreslår den, når en kolonne ser ud til at indeholde personnumre. Det er
pseudonymisering, ikke anonymisering: andre kolonner kan stadig udpege personer, så gennemgå hele datasættet, før du deler
det. Se [bearbeta.md](bearbeta.md).

## Hvordan deler jeg data med en kollega?

Nemmest i tilstanden *Del*: under *Pakke* vælger du datasæt, og om diagrammer, dashboards, skabeloner, notesbøger og
scripts skal med, skriver en besked og sender ZIP-filen, for eksempel via fanen *Delingsmenu* (e-mail, Teams og andre
apps). Kollegaen åbner den under *Modtag*, ser din besked og hvad der er ændret og kan erstatte sine egne versioner.
Kommentarer, mapper og tags følger med. Er I på samme netværk, går pakken direkte mellem computerne eller via telefonen
(fanen *Enheder*, se [mobil.md](mobil.md)). Arbejder I med samme arbejdsområde, kan I også bruge et fælles
GitHub-repository (fanen *GitHub*). Før noget forlader appen, gennemgås datasættene for personoplysninger, som kan
pseudonymiseres eller fjernes i kopien. Dashboards og dokumenter kan udgives som selvstændige HTML-filer (fanen *Udgiv*).
Du kan også eksportere et enkelt datasæt som SQLite (bevarer typer, etiketter, kommentarer og historik) eller tage
backup af hele arbejdsområdet. Diagrammer og dokumentskabeloner kan eksporteres som JSON-filer, API-konfigurationer
som `.api.json` og opskrifter som JSON, R eller SQL. Se [dela.md](dela.md).

## Hvordan åbner jeg grundkurset igen?

Klik på spørgsmålstegnet øverst til højre, og vælg *Åbn grundkurset*, eller tryk Ctrl+K, og skriv *grundkurs*.
Kurset fortsætter, hvor du slap; har du gennemført det, begynder det forfra. Det findes på alle syv sprog.

## Hvordan holder jeg orden på mange datasæt?

Giv dem mapper og tags: *Ordn* i Håndter, eller træk et datasæt til en mappe i objektpanelet. Mapper kan have
undermapper (`Økonomi/2026`), filterfeltet søger på navn, tag og mappe, og afkrydsningsfelterne vælger flere datasæt
til batchhandlinger. Mappe og tags følger med datasættet i pakker og backupper, og i R viser `dm_list()` mappen.

## Hvad er komponenter?

Dele af appen, der ikke følger med i mappen, for at holde den lille: for eksempel baggrundskort og R-pakker uden for
det indbyggede udvalg. De hentes fra en fast adresse, når noget har brug for dem, efter at du har givet lov, og
kontrolleres mod en kendt kontrolsum, hvor en sådan findes. Derefter gemmes de i browseren og behøver ikke at blive
hentet igen. Under *Håndter → Arbejdsområde → Komponenter* ser du, hvilke der findes, og hvor store de er, og kan
hente dem på forhånd eller fjerne dem.

## Kan jeg bruge appen på telefonen?

Hele appen er lavet til computere, men telefonen kan være med: Dataspatium Mobil
(<https://marwiss.github.io/Dataspatium/m/>) modtager pakker og filer fra computeren over det lokale netværk, viser
tabellerne, sender dem videre og afleverer dem til en anden computer. Åbn *Del → Enheder* på computeren, og scan
QR-koden; se [mobil.md](mobil.md). På tablets i servertilstand kan hele appen bruges: i smalle vinduer viser
tilstandsvælgeren ikoner, og panelerne åbnes som ark over arbejdsfladen.

## Hvordan overfører jeg data til en telefon uden internet?

Computeren og telefonen behøver kun samme lokale netværk; overførslen går direkte mellem dem med WebRTC og passerer
ingen server. Første gang skal telefonen hente mobilsiden fra nettet (eller fra en egen webserver på intranettet);
derefter ligger den i cachen. Er der intet fælles netværk: slå internetdeling til på telefonen, og forbind computeren
til den. Se [mobil.md](mobil.md).

## Hvor er hjælpen?

I appen: knappen **?** øverst til højre eller F1 åbner håndbogen ved kapitlet for den tilstand, du står i, med
søgning i alle afsnit og links mellem dokumenterne. De samme tekster findes i [docs/](anvandarguide.md) på GitHub.
Grundkurset åbnes fra håndbogen eller med Ctrl+K.

## Kan jeg vise et dashboard på en stor skærm?

Ja. Åbn dashboardet i Visualisér, og klik på **Præsentér**: dashboardet fylder vinduet, piletasterne går ét diagram
ad gangen, F giver fuld skærm, og Esc afslutter. De fælles filtre bliver øverst. Se
[visualisera.md](visualisera.md).

## Kan jeg læse en Access-database eller en SQL Server-tabel?

Ja. Access-filer (mdb, accdb) slippes på fladen i Hent og læses direkte i browseren. SQL Server, ODBC-kilder, Excel
og Access-forespørgsler nås gennem databasebroen, et lille script, du starter på computeren; tjenester som
PostgREST, OData og GraphQL tilføjes som kilder med en adresse. Se [kallor.md](kallor.md).

## Kan jeg indlæse PDF-filer, Word-dokumenter og billeder?

Ja. Slip dem i Hent: dokumenter (PDF, Word, OpenDocument, Markdown, tekst) bliver en dokumentsamling med ét afsnit pr. række,
billeder en billedsamling med én række pr. billede og EXIF-oplysninger. Flere filer på én gang bliver en samling. I Bearbejd
vises de som læsevisning henholdsvis galleri, og i Analysér findes værktøjerne Tekst og Billeder uden kode. Skannede
PDF-filer uden tekstlag kan læses med tekstgenkendelse. Se [dokument.md](dokument.md).

## Kan jeg vise kort og regne på geodata?

Ja. Et datasæt med geometri (GeoJSON, Shapefile, GeoPackage, KML, GPX) eller længde- og breddegrad åbnes som et kort
i Bearbejd. I Visualisér laver diagramtypen *Kort* kortvisninger med flere lag og baggrundskort til dashboards og
publicering, og i Analysér beregner fanen *Geo* areal, punkter i områder, nærmeste, buffer og overlejring uden kode.
QGIS-projekter kan slippes i Hent. Baggrundskort hentes kun efter dit samtykke. Se [kartor.md](kartor.md).

## Hvordan ser jeg, hvad appen sender til en OpenCDE-server?

Åbn kilden i Hent og fold kortet *Log* nederst ud. Der står hvert kald med API, operation, status og tid, og et klik viser headere,
en forklaring og en curl-linje at kopiere. Loggen findes kun i hukommelsen under sessionen og forlader aldrig computeren, medmindre
du selv gemmer den som JSON eller datasæt. Se [kallor.md](kallor.md).


## Kan jeg se en models IFC-graf og forespørge den med Cypher?

Ja, hvis modellen findes på en Kontroll-server. Åbn kilden i Hent, kortet *IFC-graf* eller en Neo4j-kilde, og vælg model og visning.
Knuder og relationer tegnes, du henter naboer med et dobbeltklik og skriver din egen Cypher i feltet. Se [grafer.md](grafer.md).

## Virker appen mod en server, der kun har BCF API 2.1?

Ja. Appen vælger den nyeste version, serveren tilbyder, og klarer sig uden Foundation API, så du tilføjer serveren som sædvanlig. Se [kallor.md](kallor.md).

## Finder du ikke svaret her?

Læs [anvandarguide.md](anvandarguide.md), eller opret et issue på GitHub (se [CONTRIBUTING.md](../../CONTRIBUTING.md)).
