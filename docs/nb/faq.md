# Vanlige spørsmål

## Hvor lagres dataene mine?

I nettleserens egen database (IndexedDB) på den datamaskinen og i den nettleserprofilen du bruker. Ingenting sendes noe
sted. Sletter du nettstedsdata, bytter profil eller avinstallerer nettleseren, forsvinner dataene. Ta derfor
sikkerhetskopier under *Håndter → Arbeidsområde*, eller bruk en portabel mappe i Edge og Chrome, slik at arbeidsområdet også
ligger som vanlige filer på disken (se [kom-igang.md](kom-igang.md)).

## Trenger jeg internett?

Nei. Internett trengs bare når du henter data fra et API, sender til eller henter fra GitHub, klikker på *Se etter
oppdateringer* eller bruker noe som ikke følger med i mappen: enkelte komponenter (for eksempel bakgrunnskart) og
R-pakker utenfor det innebygde utvalget hentes når de trengs, og lagres deretter lokalt. Første gang appen trenger
internett for et formål, spør den om lov; svaret kan lagres og endres under *Håndter → Arbeidsområde →
Internettilgang*, der også loggen over kall finnes. Alt annet, også R, fungerer uten nettverk.

## Hvorfor tar det tid første gang jeg bruker R?

R lastes som WebAssembly (rundt 50 MB) og starter på noen sekunder. Pakker som ggplot2 installeres i R-sesjonen første gang
du bruker dem, noe som tar ytterligere noen sekunder. R-sesjonen starter på nytt når du laster siden på nytt, men datasettene
og skriptene dine finnes fortsatt.

Ingenting av dette lastes når appen starter, bare når det brukes: R ligger i appens mappe og pakkes ut i nettleseren første gang
fanen R åpnes, Python hentes som komponenter første gang du trykker Start Python, og 3D-modeller, PDF og kart lastes på samme måte når de
trengs. I mellomtiden står det i statuslinjen hva som lastes, og R-konsollen viser hvilken fil den venter på.

Når noe hentes over nettet, det vil si appens egne filer når den kjøres fra en webserver, og komponenter som Python, IfcOpenShell og
OCR, viser statuslinjen hvor mye som er hentet av det hele, hastigheten og omtrent hvor lang tid som er igjen i det tempoet, med en knapp
for å avbryte. Det som ventet på hentingen får da en melding om at den ble avbrutt, og kan startes igjen senere. Fra mappen (file://)
hentes ingenting; filene ligger på disken.

## Kan jeg avbryte R-kode som har hengt seg?

Ja, når appen kjører fra en nettserver (for eksempel `python -m http.server 8080` på din egen datamaskin eller https på
et intranett): da finnes knappen *Avbryt* ved siden av *Kjør* i R-fanen, og R-økten med objektene beholdes. Når appen
åpnes fra en mappe (file://), tillater ikke nettleseren mekanismen som kreves; bruk da *Start R på nytt* i Analyser.
Datasettene påvirkes ikke.

## Hvordan fungerer Python i appen?

Python (Pyodide) følger ikke med i mappen. Første gang du trykker *Start Python* eller *Kjør* i fanen Python, spør appen
om lov til å hente komponenter og laster ned Python med numpy og pandas (cirka 22 MB) fra jsDelivr, kontrollert mot
kjente kontrollsummer. Deretter lagres alt i nettleseren, og Python starter uten internett. Pakker som koden
importerer (matplotlib, scipy, scikit-learn og de øvrige i Pyodides utvalg), hentes på samme måte når de trengs. Se
[python.md](python.md).

## Hvorfor virker ikke et API?

Oftest mangler API-et CORS-støtte, det vil si at nettleseren ikke får lese svaret. Da kan Dataspatium bare nå det via en
proxy som du selv drifter (innstilling under Hent). Noen API-er krever dessuten en nøkkel. Se
[api-konfiguration.md](api-konfiguration.md), som også beskriver hvordan du skaffer nøkler.

## Hvordan lagres API-nøkler?

Enten bare i minnet under sesjonen eller kryptert med en passordfrase du velger. Aldri i klartekst, og de følger aldri med
når du deler en konfigurasjon.

## Hvor store datasett klarer appen?

Et par millioner rader i Edge og Chrome, noe færre i Firefox; nettleserens minne setter grensen. Målte tider for en million
rader finnes i [utveckling.md](../utveckling.md) (svensk). Tekstfiler på 64 MB eller mer leses i biter, så selve innlastingen
ikke krever at hele filen får plass i minnet som tekst.

## Hva skiller Firefox fra Edge og Chrome?

Utseende og funksjoner er de samme, men Firefox mangler mappetilgang, så den portable mappen finnes ikke der. Sikkerhetskopi
som ZIP fungerer overalt.

## Kan appen kjøres fra en nettserver eller et intranett?

Ja. Legg mappen uendret på en vilkårlig statisk nettserver; det trengs ingen serverfunksjoner. Over https, og på din egen
datamaskin over `http://localhost`, registrerer appen en service worker (`sw-coi.js`) som gjør siden *cross-origin
isolated*, og da kan R-kode avbrytes. Første gang lastes siden inn på nytt én gang når den tar over. Over vanlig http på
et intranett tillater ikke nettleseren service workers, men en server som selv sender hodene
`Cross-Origin-Opener-Policy: same-origin` og `Cross-Origin-Embedder-Policy: credentialless`, gir det samme. Alt annet
fungerer som fra mappen. Nettleseren lagrer data per adresse, så arbeidsområdet i mappen og det på serveren er atskilt;
flytt mellom dem med sikkerhetskopi eller pakke.

Fra en nettserver, også <https://marwiss.github.io/Dataspatium/>, kan appen installeres som en egen app: i Edge og
Chrome via ikonet *Installer* i adressefeltet eller nettleserens meny. Den får da sitt eget vindu og sitt eget ikon,
filene lagres i nettleseren slik at den fungerer uten nettverk, og lagringen blir vedvarende. Nye versjoner hentes når
appen åpnes igjen med nettverk.

## Kan jeg åpne index.html direkte i ZIP-filen?

Nei. Pakk ut ZIP-filen først (høyreklikk og velg *Pakk ut alle* i Windows), og åpne deretter `index.html` i den utpakkede
mappen.

## Hvordan oppdaterer jeg?

Last ned den nye versjonen, og pakk den ut i en ny mappe. Dataene dine ligger i nettleseren, ikke i mappen, så de finnes
fortsatt når du åpner den nye versjonens `index.html` på samme datamaskin og i samme nettleser. Under hjelpeknappen finnes
*Se etter oppdateringer*, som sammenligner versjonen din med den siste utgivelsen på GitHub. Kontrollen gjøres bare når du
klikker.

## Kan jeg bytte språk?

Ja. Første gang appen åpnes, velger du språk; deretter åpner språkknappen øverst til høyre (ikonet med bokstaver) eller
kommandoen *Språk* i paletten det samme valget. Svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og engelsk finnes. Appen
lastes på nytt på det valgte språket når ulagrede endringer er lagret. Valget lagres i nettleseren, så hver datamaskin og
profil har sitt eget. Dokumentasjonen finnes på de samme språkene i mappen `docs`.

## Finnes det kilder fra andre nordiske land?

Ja. Under *Legg til kilder* → *Åpne API-er* i Hent finnes statistikkbyråene i Norge, Danmark, Finland, Island, Grønland, Færøyene og Åland,
Nordic Statistics, Folkehelseinstituttet, Brønnøysundregistrene, Kartverket, MET Norway, THLs Sotkanet, PRHs
foretaksregister, Digitraffic, Meteorologisk institutt i Finland, Veðurstofa Íslands og de danske og finske dataportalene.
Landknappene over listen velger hvilke lands kilder som vises; valget lagres i nettleseren. Alle kildene er kontrollert for
CORS og krever ingen nøkkel. Se [api-konfiguration.md](api-konfiguration.md).

## Kan jeg ha appen åpen i flere faner?

Ja. Fanene deler samme arbeidsområde og holder hverandre oppdatert: lagrer eller sletter du noe i én fane, laster de andre
listene sine på nytt og logger hva som skjedde. Ikke rediger likevel samme datasett i to faner samtidig; har begge ulagrede
endringer, vinner den som lagrer sist.

## Kan en annen lokal HTML-fil lese dataene mine?

I Edge og Chrome deler alle filer som åpnes via file://, samme lagring. Åpne derfor ikke ukjente HTML-filer lokalt mens du
har sensitive data i appen. Nøkler lagres aldri i klartekst. Firefox holder lokale filer atskilt.

## Får jeg bruke appen på jobben?

Ja, hvis arbeidsgiveren er en offentlig etat, kommune, region, skole, et lærested eller en ideell organisasjon, det vil si
ikke-kommersiell bruk. Kommersiell bruk krever tillatelse fra lisensgiveren. Se [licenser.md](licenser.md).

## Hvordan lager jeg et kart?

For Sverige: klikk på *Svenske kommunegrenser (SCB)* eller *Svenske länsgrenser (SCB)* i Hent; grensene følger med appen.
For andre land importerer du grenser fra GeoJSON, shapefile eller GeoPackage. Koble deretter verdiene dine til grensene på
koden i Bearbeid (*Koble datasett*), og velg diagramtypen *Kart* i Visualiser. Punkter med lengde- og breddegrad (for
eksempel målestasjoner) tegnes med *Punktkart*. Se [visualisera.md](visualisera.md).

## Hvordan finner jeg kommune eller fylke ut fra koordinater?

Velg *Geodata > Kommune og fylke ut fra koordinater* i Bearbeid (via Handlinger eller paletten). Handlingen slår opp hvert punkts
kommune og fylke i SCB:s medfølgende grenser og legger til kolonnene kommunkod, kommun, lanskod og lan; koordinater i SWEREF 99
TM gjenkjennes. Grensene dekker landarealet, så punkter i vann blir tomme. Samme gruppe har midtpunkt og areal ut fra geometri
samt omregning mellom SWEREF 99 TM og WGS 84. Se [bearbeta.md](bearbeta.md).



## Hvordan kombinerer jeg flere datasett i én SQL-spørring?

Hvert datasett har et kortnavn (vises under navnet i objektpanelet, endres under Håndter > Gi nytt navn). I SQL-fanen under
Analyser heter det valgte datasettet `data`, men nås også med kortnavnet sitt, og alle andre datasett nås med kortnavnene
sine: `select k.kommun, b.folkmangd from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. Resultatet
kan lagres som nytt datasett. I R leser `dm_read("kortnavn")` samme datasett. Se [bearbeta.md](bearbeta.md).

## Hvordan kontrollerer jeg at dataene holder mål?

*Datakvalitet* i Bearbeid profilerer alle kolonner og foreslår handlinger. *Regler* lar deg skrive ned krav (må ikke mangle,
unik, intervall, liste, mønster, lengde eller en SQL-betingelse) og kjøre dem etter hver import; feilende rader kan lagres
som eget datasett og resultatet lastes ned som rapport. Reglene lagres i datasettet og følger med når du deler det. Se
[bearbeta.md](bearbeta.md).

## Kan jeg fjerne personnumre før jeg deler et datasett?

Ja. Handlingen *Pseudonymiser* i Bearbeid erstatter identifikatorer med saltede hashverdier, maskerte verdier eller
løpenumre, og datakvalitetsprofilen foreslår den når en kolonne ser ut til å inneholde personnumre. Det er
pseudonymisering, ikke anonymisering: andre kolonner kan fortsatt peke ut personer, så gå gjennom hele datasettet før du
deler det. Se [bearbeta.md](bearbeta.md).

## Hvordan deler jeg data med en kollega?

Enklest i modusen *Del*: under *Pakke* velger du datasett og om diagrammer, dashbord, maler, notatbøker og skript skal
være med, skriver en melding og sender ZIP-filen, for eksempel via fanen *Delingsmeny* (e-post, Teams og andre
apper). Kollegaen åpner den under *Motta*, ser meldingen din og hva som er endret, og kan erstatte sine egne
versjoner. Kommentarer, mapper og tagger følger med. Er dere på samme nettverk, går pakken direkte mellom datamaskinene eller via
telefonen (fanen *Enheter*, se [mobil.md](mobil.md)). Arbeider dere med samme arbeidsområde, kan dere også bruke et
felles GitHub-repository (fanen *GitHub*). Før noe forlater appen, gjennomgås datasettene for personopplysninger,
som kan pseudonymiseres eller fjernes i kopien. Dashbord og dokumenter kan publiseres som frittstående HTML-filer (fanen
*Publiser*). Du kan også eksportere ett enkelt datasett som SQLite (beholder typer, etiketter, kommentarer og
historikk) eller ta en sikkerhetskopi av hele arbeidsområdet. Diagrammer og dokumentmaler kan eksporteres som
JSON-filer, API-konfigurasjoner som `.api.json` og oppskrifter som JSON, R eller SQL. Se [dela.md](dela.md).

## Hvordan åpner jeg grunnkurset igjen?

Klikk på spørsmålstegnet øverst til høyre og velg *Åpne grunnkurset*, eller trykk Ctrl+K og skriv *grunnkurs*. Kurset
fortsetter der du slapp; har du fullført det, begynner det på nytt. Det finnes på alle sju språk.

## Hvordan holder jeg orden på mange datasett?

Gi dem mapper og tagger: *Ordne* i Håndter, eller dra et datasett til en mappe i objektpanelet. Mapper kan ha
undermapper (`Økonomi/2026`), filterfeltet søker på navn, tagg og mappe, og avkrysningsboksene velger flere datasett
for batchhandlinger. Mappe og tagger følger med datasettet i pakker og sikkerhetskopier, og i R viser `dm_list()`
mappen.

## Hva er komponenter?

Deler av appen som ikke følger med i mappen, for å holde den liten: for eksempel bakgrunnskart og R-pakker utenfor
det innebygde utvalget. De hentes fra en fast adresse når noe trenger dem, etter at du har gitt lov, og kontrolleres
mot en kjent kontrollsum der en slik finnes. Deretter lagres de i nettleseren og trenger ikke hentes igjen. Under
*Håndter → Arbeidsområde → Komponenter* ser du hvilke som finnes, og hvor store de er, og kan hente dem på forhånd
eller fjerne dem.

## Kan jeg bruke appen på telefonen?

Hele appen er laget for datamaskiner, men telefonen kan være med: Dataspatium Mobil
(<https://marwiss.github.io/Dataspatium/m/>) tar imot pakker og filer fra datamaskinen over det lokale nettverket,
viser tabellene, sender dem videre og leverer dem til en annen datamaskin. Åpne *Del → Enheter* på datamaskinen og
skann QR-koden; se [mobil.md](mobil.md). På nettbrett i servermodus kan hele appen brukes: i smale vinduer viser
modusvelgeren ikoner, og panelene åpnes som ark over arbeidsflaten.

## Hvordan overfører jeg data til en telefon uten internett?

Datamaskinen og telefonen trenger bare samme lokale nettverk; overføringen går direkte mellom dem med WebRTC og
passerer ingen server. Første gang må telefonen hente mobilsiden fra nettet (eller fra en egen nettserver på
intranettet); deretter ligger den i hurtigbufferen. Finnes det ikke noe felles nettverk: slå på internettdeling på
telefonen og koble datamaskinen til den. Se [mobil.md](mobil.md).

## Hvor er hjelpen?

I appen: knappen **?** øverst til høyre eller F1 åpner håndboken ved kapittelet for modusen du står i, med søk i
alle avsnitt og lenker mellom dokumentene. De samme tekstene finnes i [docs/](anvandarguide.md) på GitHub.
Grunnkurset åpnes fra håndboken eller med Ctrl+K.

## Kan jeg vise et dashbord på en stor skjerm?

Ja. Åpne dashbordet i Visualiser og klikk på **Presenter**: dashbordet fyller vinduet, piltastene går ett diagram om
gangen, F gir fullskjerm, og Esc avslutter. De felles filtrene blir værende øverst. Se
[visualisera.md](visualisera.md).

## Kan jeg lese en Access-database eller en SQL Server-tabell?

Ja. Access-filer (mdb, accdb) slippes på flaten i Hent inn og leses rett i nettleseren. SQL Server, ODBC-kilder,
Excel og Access-spørringer nås gjennom databasebroen, et lite skript du starter på datamaskinen; tjenester som
PostgREST, OData og GraphQL legges til som kilder med en adresse. Se [kallor.md](kallor.md).

## Kan jeg lese inn PDF-filer, Word-dokumenter og bilder?

Ja. Slipp dem i Hent: dokumenter (PDF, Word, OpenDocument, Markdown, tekst) blir en dokumentsamling med ett avsnitt per rad,
bilder en bildesamling med én rad per bilde og EXIF-opplysninger. Flere filer på én gang blir en samling. I Bearbeid vises
de som lesevisning respektive galleri, og i Analyser finnes verktøyene Tekst og Bilder uten kode. Skannede PDF-filer
uten tekstlag kan leses med tekstgjenkjenning. Se [dokument.md](dokument.md).

## Kan jeg vise kart og regne på geodata?

Ja. Et datasett med geometri (GeoJSON, Shapefile, GeoPackage, KML, GPX) eller lengde- og breddegrad åpnes som et kart i
Bearbeid. I Visualiser lager diagramtypen *Kart* kartvisninger med flere lag og bakgrunnskart for dashboards og
publisering, og i Analyser regner fanen *Geo* areal, punkter i områder, nærmeste, buffer og overlagring uten kode.
QGIS-prosjekter kan slippes i Hent. Bakgrunnskart hentes bare etter ditt samtykke. Se [kartor.md](kartor.md).

## Hvordan ser jeg hva appen sender til en OpenCDE-server?

Åpne kilden i Hent og fold ut kortet *Logg* nederst. Der står hvert kall med API, operasjon, status og tid, og et klikk viser
headere, en forklaring og en curl-linje å kopiere. Loggen finnes bare i minnet under sesjonen og forlater aldri datamaskinen med
mindre du selv lagrer den som JSON eller datasett. Se [kallor.md](kallor.md).


## Finner du ikke svaret her?

Les [anvandarguide.md](anvandarguide.md), eller opprett et issue på GitHub (se [CONTRIBUTING.md](../../CONTRIBUTING.md)).
