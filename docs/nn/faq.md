# Vanlege spørsmål

## Kvar blir dataa mine lagra?

I den eigne databasen til nettlesaren (IndexedDB) på den datamaskina og i den nettlesarprofilen du brukar. Ingenting blir sendt nokon
stad. Slettar du nettstaddata, byter profil eller avinstallerer nettlesaren, forsvinn dataa. Ta difor
tryggingskopiar under *Handter → Arbeidsområde*, eller bruk ei portabel mappe i Edge og Chrome, slik at arbeidsområdet òg
ligg som vanlege filer på disken (sjå [kom-igang.md](kom-igang.md)).

## Treng eg internett?

Nei. Internett trengst berre når du hentar data frå eit API, sender til eller hentar frå GitHub, klikkar på *Sjå etter
oppdateringar* eller brukar noko som ikkje følgjer med i mappa: somme komponentar (til dømes bakgrunnskart) og
R-pakkar utanfor det innebygde utvalet blir henta når dei trengst, og lagra deretter lokalt. Første gongen appen treng
internett for eit føremål, spør han om løyve; svaret kan lagrast og endrast under *Handter → Arbeidsområde →
Internettilgang*, der òg loggen over kall finst. Alt anna, òg R, fungerer utan nettverk.

## Kvifor tek det tid første gongen eg brukar R?

R blir lasta som WebAssembly (rundt 50 MB) og startar på nokre sekund. Pakkar som ggplot2 blir installerte i R-sesjonen første gongen
du brukar dei, noko som tek ytterlegare nokre sekund. R-sesjonen startar på nytt når du lastar sida på nytt, men datasetta
og skripta dine finst framleis.

Ingenting av dette blir lasta når appen startar, berre når det blir brukt: R ligg i mappa til appen og blir pakka ut i nettlesaren første gongen
fana R blir opna, Python blir henta som komponentar første gongen du trykkjer Start Python, og 3D-modellar, PDF og kart blir lasta på same måte når dei
trengst. I mellomtida står det i statuslinja kva som blir lasta, og R-konsollen viser kva fil han ventar på.

Når noko blir henta over nettet, det vil seie appen sine eigne filer når han køyrer frå ein webserver, og komponentar som Python,
IfcOpenShell og OCR, viser statuslinja kor mykje som er henta av det heile, farten og om lag kor lang tid som er att i det tempoet, med
ein knapp for å avbryte. Det som venta på hentinga får då ei melding om at ho vart avbroten, og kan startast att seinare. Frå mappa
(file://) blir ingenting henta; filene ligg på disken.

Kor lang tid appen sjølv brukar på å starte, viser startprofilen. Legg til `?profil=start` i adressa (`index.html?profil=start`, eller
`m/index.html?profil=start` for Dataspatium Mobil), så skriv appen i konsollen i nettlesaren ein tabell over skripta med tida frå
kvart vart lagt inn til det hadde køyrt og den delen av starten det åleine stod for, tida per mappe, tida til klar og til første
teikning, lange oppgåver over 50 ms (i Edge og Chrome) og, når appen køyrer frå ein webserver, storleiken på kvar fil; utan
parameteren blir ingenting målt. Med `&profil-exit=1` blir målinga avslutta som ein test, slik at ho kan køyrast utan vindauge frå
mappa: `powershell -File tools/run-tests.ps1 -Browsers edge -Url "index.html?lang=sv&profil=start&profil-exit=1"`, og med
`-Url "m/index.html?lang=sv&profil=start&profil-exit=1"` for mobilsida (`-Browsers firefox` for Firefox). Mot ein webserver
(`python -m http.server 8092 --bind 127.0.0.1` i mappa) blir adressa
`http://127.0.0.1:8092/index.html?lang=sv&profil=start&profil-exit=1`. `lang=sv` (eller `lang=nn`) vel språket på førehand, sidan den
aller første starten lastar alle sju språka og ventar på språkvalet.

## Kan eg avbryte R-kode som har hengt seg?

Ja, når appen køyrer frå ein webtenar (til dømes `python -m http.server 8080` på di eiga datamaskin eller https på
eit intranett): då finst knappen *Avbryt* ved sida av *Køyr* i R-fana, og R-sesjonen med objekta blir halden. Når appen
blir opna frå ei mappe (file://), tillèt ikkje nettlesaren mekanismen som krevst; bruk då *Start R på nytt* i Analyser.
Datasetta blir ikkje påverka.

## Korleis fungerer Python i appen?

Python (Pyodide) følgjer ikkje med i mappa. Første gongen du trykkjer *Start Python* eller *Køyr* i fana Python, spør appen
om løyve til å hente komponentar og lastar ned Python med numpy og pandas (om lag 22 MB) frå jsDelivr, kontrollert mot
kjende kontrollsummar. Deretter blir alt lagra i nettlesaren, og Python startar utan internett. Pakkar som koden
importerer (matplotlib, scipy, scikit-learn og dei andre i utvalet til Pyodide), blir henta på same måte når dei trengst. Sjå
[python.md](python.md).

## Kvifor verkar ikkje eit API?

Oftast manglar API-et CORS-støtte, det vil seie at nettlesaren ikkje får lese svaret. Då kan Dataspatium berre nå det via ein
proxy som du sjølv driftar (innstilling under Hent). Nokre API krev dessutan ein nøkkel. Sjå
[api-konfiguration.md](api-konfiguration.md), som òg skildrar korleis du skaffar nøklar.

## Korleis blir API-nøklar lagra?

Anten berre i minnet under sesjonen eller kryptert med ein passordfrase du vel. Aldri i klartekst, og dei følgjer aldri med
når du deler ein konfigurasjon.

## Kor store datasett klarer appen?

Eit par millionar rader i Edge og Chrome, noko færre i Firefox; minnet i nettlesaren set grensa. Tekstfiler på 64 MB eller meir blir lesne i bitar, så sjølve innlastinga
ikkje krev at heile fila får plass i minnet som tekst.

## Kva skil Firefox frå Edge og Chrome?

Utsjånad og funksjonar er dei same, men Firefox manglar mappetilgang, så den portable mappa finst ikkje der. Tryggingskopi
som ZIP fungerer overalt.

## Kan appen køyrast frå ein webtenar eller eit intranett?

Ja. Legg mappa uendra på ein vilkårleg statisk webtenar; det trengst ingen tenarfunksjonar. Over https, og på di eiga
datamaskin over `http://localhost`, registrerer appen ein service worker (`sw-coi.js`) som gjer sida *cross-origin
isolated*, og då kan R-kode avbrytast. Første gongen blir sida lasta inn på nytt éin gong når han tek over. Over vanleg http på
eit intranett tillèt ikkje nettlesaren service workers, men ein tenar som sjølv sender hovuda
`Cross-Origin-Opener-Policy: same-origin` og `Cross-Origin-Embedder-Policy: credentialless`, gjev det same. Alt anna
fungerer som frå mappa. Nettlesaren lagrar data per adresse, så arbeidsområdet i mappa og det på tenaren er skilde;
flytt mellom dei med tryggingskopi eller pakke.

Frå ein webtenar, òg <https://marwiss.github.io/Dataspatium/>, kan appen installerast som ein eigen app: i Edge og
Chrome via ikonet *Installer* i adressefeltet eller menyen i nettlesaren. Han får då sitt eige vindauge og sitt eige ikon,
filene blir lagra i nettlesaren slik at han fungerer utan nettverk, og lagringa blir varig. Nye versjonar blir henta når
appen blir opna igjen med nettverk.

## Kan eg opne index.html direkte i ZIP-fila?

Nei. Pakk ut ZIP-fila først (høgreklikk og vel *Pakk ut alle* i Windows), og opne deretter `index.html` i den utpakka
mappa.

## Korleis oppdaterer eg?

Last ned den nye versjonen, og pakk henne ut i ei ny mappe. Dataa dine ligg i nettlesaren, ikkje i mappa, så dei finst
framleis når du opnar `index.html` i den nye versjonen på same datamaskin og i same nettlesar. Under hjelpeknappen finst
*Sjå etter oppdateringar*, som samanliknar versjonen din med den siste utgjevinga på GitHub. Kontrollen blir berre gjord når du
klikkar.

## Kan eg byte språk?

Ja. Første gongen appen blir opna, vel du språk; deretter opnar språkknappen øvst til høgre (ikonet med bokstavar) eller
kommandoen *Språk* i paletten det same valet. Svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og engelsk finst. Appen
blir lasta på nytt på det valde språket når ulagra endringar er lagra. Valet blir lagra i nettlesaren, så kvar datamaskin og
profil har sitt eige. Dokumentasjonen finst på dei same språka i mappa `docs`.

## Finst det kjelder frå andre nordiske land?

Ja. Under *Legg til kjelder* → *Opne API-ar* i Hent finst statistikkbyråa i Noreg, Danmark, Finland, Island, Grønland, Færøyane og Åland,
Nordic Statistics, Folkehelseinstituttet, Brønnøysundregistera, Kartverket, MET Norway, Sotkanet frå THL, føretaksregisteret
frå PRH, Digitraffic, Meteorologisk institutt i Finland, Veðurstofa Íslands og dei danske og finske dataportalane.
Landknappane over lista vel kva lands kjelder som blir viste; valet blir lagra i nettlesaren. Alle kjeldene er kontrollerte for
CORS og krev ingen nøkkel. Sjå [api-konfiguration.md](api-konfiguration.md).

## Kan eg ha appen open i fleire faner?

Ja. Fanene deler same arbeidsområde og held kvarandre oppdaterte: lagrar eller slettar du noko i éi fane, lastar dei andre
listene sine på nytt og loggar kva som skjedde. Ikkje rediger likevel same datasett i to faner samtidig; har begge ulagra
endringar, vinn den som lagrar sist.

## Kan ei anna lokal HTML-fil lese dataa mine?

I Edge og Chrome deler alle filer som blir opna via file://, same lagring. Opne difor ikkje ukjende HTML-filer lokalt medan du
har sensitive data i appen. Nøklar blir aldri lagra i klartekst. Firefox held lokale filer skilde.

## Får eg bruke appen på jobben?

Ja, om arbeidsgjevaren er ein offentleg etat, kommune, region, skule, ein lærestad eller ein ideell organisasjon, det vil seie
ikkje-kommersiell bruk. Kommersiell bruk krev løyve frå lisensgjevaren. Sjå [licenser.md](licenser.md).

## Korleis lagar eg eit kart?

For Sverige: klikk på *Svenske kommunegrenser (SCB)* eller *Svenske länsgrenser (SCB)* i Hent; grensene følgjer med appen.
For andre land importerer du grenser frå GeoJSON, shapefile eller GeoPackage. Kople deretter verdiane dine til grensene på
koden i Bearbeid (*Kople datasett*), og vel diagramtypen *Kart* i Visualiser. Punkt med lengde- og breiddegrad (til
dømes målestasjonar) blir teikna med *Punktkart*. Sjå [visualisera.md](visualisera.md).

## Korleis finn eg kommune eller fylke ut frå koordinatar?

Vel *Geodata > Kommune og fylke ut frå koordinatar* i Bearbeid (via Handlingar eller paletten). Handlinga slår opp kommunen og fylket
til kvart punkt i grensene frå SCB som følgjer med og legg til kolonnane kommunkod, kommun, lanskod og lan; koordinatar i SWEREF 99
TM blir kjende att. Grensene dekkjer landarealet, så punkt i vatn blir tomme. Same gruppe har midtpunkt og areal ut frå geometri
og dessutan omrekning mellom SWEREF 99 TM og WGS 84. Sjå [bearbeta.md](bearbeta.md).

## Korleis kombinerer eg fleire datasett i éi SQL-spørjing?

Kvart datasett har eit kortnamn (blir vist under namnet i objektpanelet, blir endra under Handter > Gje nytt namn). I SQL-fana under
Analyser heiter det valde datasettet `data`, men blir òg nådd med kortnamnet sitt, og alle andre datasett blir nådde med kortnamna
sine: `select k.kommun, b.folkmangd from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. Resultatet
kan lagrast som nytt datasett. I R les `dm_read("kortnamn")` same datasett. Sjå [bearbeta.md](bearbeta.md).

## Korleis kontrollerer eg at dataa held mål?

*Datakvalitet* i Bearbeid profilerer alle kolonnar og føreslår handlingar. *Reglar* lèt deg skrive ned krav (må ikkje mangle,
unik, intervall, liste, mønster, lengd eller eit SQL-vilkår) og køyre dei etter kvar import; feilande rader kan lagrast
som eige datasett og resultatet lastast ned som rapport. Reglane blir lagra i datasettet og følgjer med når du deler det. Sjå
[bearbeta.md](bearbeta.md).

## Kan eg fjerne personnummer før eg deler eit datasett?

Ja. Handlinga *Pseudonymiser* i Bearbeid erstattar identifikatorar med salta hashverdiar, maskerte verdiar eller
løpenummer, og datakvalitetsprofilen føreslår henne når ein kolonne ser ut til å innehalde personnummer. Det er
pseudonymisering, ikkje anonymisering: andre kolonnar kan framleis peike ut personar, så gå gjennom heile datasettet før du
deler det. Sjå [bearbeta.md](bearbeta.md).

## Korleis deler eg data med ein kollega?

Enklast i modusen *Del*: under *Pakke* vel du datasett og om diagram, dashbord, malar, notatbøker og skript skal
vere med, skriv ei melding og sender ZIP-fila, til dømes via fana *Delingsmeny* (e-post, Teams og andre
appar). Kollegaen opnar henne under *Ta imot*, ser meldinga di og kva som er endra, og kan erstatte sine eigne
versjonar. Kommentarar, mapper og taggar følgjer med. Er de på same nettverk, går pakken direkte mellom datamaskinene eller via
telefonen (fana *Einingar*, sjå [mobil.md](mobil.md)). Arbeider de med same arbeidsområde, kan de òg bruke eit
felles GitHub-repositorium (fana *GitHub*). Før noko forlèt appen, blir datasetta gjennomgådde for personopplysningar,
som kan pseudonymiserast eller fjernast i kopien. Dashbord og dokument kan publiserast som frittståande HTML-filer (fana
*Publiser*). Du kan òg eksportere eitt enkelt datasett som SQLite (held på typar, etikettar, kommentarar og
historikk) eller ta ein tryggingskopi av heile arbeidsområdet. Diagram og dokumentmalar kan eksporterast som
JSON-filer, API-konfigurasjonar som `.api.json` og oppskrifter som JSON, R eller SQL. Sjå [dela.md](dela.md).

## Korleis opnar eg grunnkurset igjen?

Klikk på spørsmålsteiknet øvst til høgre og vel *Opne grunnkurset*, eller trykk Ctrl+K og skriv *grunnkurs*. Kurset
held fram der du slapp; har du fullført det, byrjar det på nytt. Det finst på alle sju språka.

## Korleis held eg orden på mange datasett?

Gje dei mapper og taggar: *Ordne* i Handter, eller dra eit datasett til ei mappe i objektpanelet. Mapper kan ha
undermapper (`Økonomi/2026`), filterfeltet søkjer på namn, tagg og mappe, og avkryssingsboksane vel fleire datasett
for batchhandlingar. Mappe og taggar følgjer med datasettet i pakkar og tryggingskopiar, og i R viser `dm_list()`
mappa.

## Kva er komponentar?

Delar av appen som ikkje følgjer med i mappa, for å halde henne lita: til dømes bakgrunnskart og R-pakkar utanfor
det innebygde utvalet. Dei blir henta frå ei fast adresse når noko treng dei, etter at du har gjeve løyve, og kontrollerte
mot ein kjend kontrollsum der ein slik finst. Deretter blir dei lagra i nettlesaren og treng ikkje hentast igjen. Under
*Handter → Arbeidsområde → Komponentar* ser du kva for nokre som finst, og kor store dei er, og kan hente dei på førehand
eller fjerne dei.

## Kan eg bruke appen på telefonen?

Heile appen er laga for datamaskiner, men telefonen kan vere med: Dataspatium Mobil
(<https://marwiss.github.io/Dataspatium/m/>) tek imot pakkar og filer frå datamaskina over det lokale nettverket,
viser tabellane, sender dei vidare og leverer dei til ei anna datamaskin. Opne *Del → Einingar* på datamaskina og
skann QR-koden; sjå [mobil.md](mobil.md). På nettbrett i tenarmodus kan heile appen brukast: i smale vindauge viser
modusveljaren ikon, og panela blir opna som ark over arbeidsflata.

## Korleis overfører eg data til ein telefon utan internett?

Datamaskina og telefonen treng berre same lokale nettverk; overføringa går direkte mellom dei med WebRTC og
passerer ingen tenar. Første gongen må telefonen hente mobilsida frå nettet (eller frå ein eigen webtenar på
intranettet); deretter ligg ho i hurtigbufferen. Finst det ikkje noko felles nettverk: slå på internettdeling på
telefonen og kople datamaskina til han. Sjå [mobil.md](mobil.md).

## Kvar er hjelpa?

I appen: knappen **?** øvst til høgre eller F1 opnar handboka ved kapittelet for modusen du står i, med søk i
alle avsnitt og lenkjer mellom dokumenta. Dei same tekstane finst i [docs/](anvandarguide.md) på GitHub.
Grunnkurset blir opna frå handboka eller med Ctrl+K.

## Kan eg vise eit dashbord på ein stor skjerm?

Ja. Opne dashbordet i Visualiser og klikk på **Presenter**: dashbordet fyller vindauget, piltastane går eitt diagram om
gongen, F gjev fullskjerm, og Esc avsluttar. Dei felles filtera blir verande øvst. Sjå
[visualisera.md](visualisera.md).

## Kan eg lese ein Access-database eller ein SQL Server-tabell?

Ja. Access-filer (mdb, accdb) blir sleppte på flata i Hent og lesne rett i nettlesaren. SQL Server, ODBC-kjelder,
Excel og Access-spørjingar blir nådde gjennom databasebrua, eit lite skript du startar på datamaskina; tenester som
PostgREST, OData og GraphQL blir lagde til som kjelder med ei adresse. Sjå [kallor.md](kallor.md).

## Kan eg lese inn PDF-filer, Word-dokument og bilete?

Ja. Slepp dei i Hent: dokument (PDF, Word, OpenDocument, Markdown, tekst) blir ei dokumentsamling med eitt avsnitt per rad,
bilete ei biletsamling med éi rad per bilete og EXIF-opplysningar. Fleire filer på éin gong blir ei samling. I Bearbeid blir
dei viste som lesevising og galleri, og i Analyser finst verktøya Tekst og Bilete utan kode. Skanna PDF-filer
utan tekstlag kan lesast med tekstgjenkjenning. Sjå [dokument.md](dokument.md).

## Kan eg vise kart og rekne på geodata?

Ja. Eit datasett med geometri (GeoJSON, Shapefile, GeoPackage, KML, GPX) eller lengde- og breiddegrad blir opna som eit kart i
Bearbeid. I Visualiser lagar diagramtypen *Kart* kartvisingar med fleire lag og bakgrunnskart for dashbord og
publisering, og i Analyser reknar fana *Geo* areal, punkt i område, nærmaste, buffer og overlagring utan kode.
QGIS-prosjekt kan sleppast i Hent. Bakgrunnskart blir berre henta etter samtykket ditt. Sjå [kartor.md](kartor.md).

## Korleis ser eg kva appen sender til ein OpenCDE-tenar?

Opne kjelda i Hent og fald ut kortet *Logg* nedst. Der står kvart kall med API, operasjon, status og tid, og eit klikk viser
hovud, ei forklaring og ei curl-linje å kopiere. Loggen finst berre i minnet under sesjonen og forlèt aldri datamaskina med
mindre du sjølv lagrar han som JSON eller datasett. Sjå [kallor.md](kallor.md).

## Kan eg sjå IFC-grafen til ein modell og spørje han med Cypher?

Ja, viss modellen finst på ein Dataregium-tenar. Opne kjelda i Hent, kortet *IFC-LPG* eller ei Neo4j-kjelde, og vel modell og vising.
Nodar og relasjonar blir teikna, du hentar naboar med eit dobbeltklikk og skriv din eigen Cypher i feltet. Sjå [grafer.md](grafer.md).

## Verkar appen mot ein tenar som berre har BCF API 2.1?

Ja. Appen vel den nyaste versjonen tenaren tilbyr, og klarer seg utan Foundation API, så du legg til tenaren som vanleg. Sjå [kallor.md](kallor.md).

## Finn du ikkje svaret her?

Les [anvandarguide.md](anvandarguide.md), eller opprett eit issue på GitHub (sjå [CONTRIBUTING.md](../../CONTRIBUTING.md)).
