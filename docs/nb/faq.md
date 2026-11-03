# Vanlige spørsmål

## Hvor lagres dataene mine?

I nettleserens egen database (IndexedDB) på den datamaskinen og i den nettleserprofilen du bruker. Ingenting sendes noe
sted. Sletter du nettstedsdata, bytter profil eller avinstallerer nettleseren, forsvinner dataene. Ta derfor
sikkerhetskopier under *Håndter → Arbeidsområde*, eller bruk en portabel mappe i Edge og Chrome, slik at arbeidsområdet også
ligger som vanlige filer på disken (se [kom-igang.md](kom-igang.md)).

## Trenger jeg internett?

Nei. Internett trengs bare når du henter data fra et API, synkroniserer med GitHub eller klikker på *Se etter oppdateringer*. Alt annet, også R,
fungerer uten nettverk.

## Hvorfor tar det tid første gang jeg bruker R?

R lastes som WebAssembly (rundt 50 MB) og starter på noen sekunder. Pakker som ggplot2 installeres i R-sesjonen første gang
du bruker dem, noe som tar ytterligere noen sekunder. R-sesjonen starter på nytt når du laster siden på nytt, men datasettene
og skriptene dine finnes fortsatt.

## Kan jeg avbryte R-kode som har hengt seg?

Nei. Under file:// tillater ikke nettleseren mekanismen som kreves for å avbryte R midt i en beregning. Bruk *Start R på
nytt* i Analyser; datasettene påvirkes ikke.

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

Ja. Legg mappen uendret på en vilkårlig statisk nettserver. Det trengs ingen serverfunksjoner.

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
kommandoen *Språk* i paletten det samme valget. Svensk, dansk, norsk (bokmål), finsk, islandsk og engelsk finnes. Appen
lastes på nytt på det valgte språket når ulagrede endringer er lagret. Valget lagres i nettleseren, så hver datamaskin og
profil har sitt eget. Dokumentasjonen finnes på de samme språkene i mappen `docs`.

## Finnes det kilder fra andre nordiske land?

Ja. Under *Åpne API-er* i Hent finnes statistikkbyråene i Norge, Danmark, Finland, Island, Grønland, Færøyene og Åland,
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

Enklest med *Del pakke* under *Håndter → Arbeidsområde*: velg datasett, og om diagrammer, dashbord, maler og notatbøker skal
være med, skriv en melding og send ZIP-filen. Kollegaen slipper den på *Gjenopprett fra ZIP*, ser meldingen din og hva som
er endret, og kan erstatte sine egne versjoner. Kommentarer til datasett og kolonner følger med. Arbeider dere med samme
arbeidsområde, kan dere også bruke et felles GitHub-repository (*GitHub* under *Håndter → Arbeidsområde*). Du kan også
eksportere ett enkelt datasett som SQLite (beholder typer, etiketter, kommentarer og historikk) eller ta en
sikkerhetskopi av hele arbeidsområdet. Diagrammer og dokumentmaler kan eksporteres som JSON-filer, API-konfigurasjoner som
`.api.json` og oppskrifter som JSON, R eller SQL.

## Hvordan åpner jeg grunnkurset igjen?

Klikk på spørsmålstegnet øverst til høyre og velg *Åpne grunnkurset*, eller trykk Ctrl+K og skriv *grunnkurs*. Kurset
fortsetter der du slapp; har du fullført det, begynner det på nytt. Det finnes på alle seks språk.

## Finner du ikke svaret her?

Les [anvandarguide.md](anvandarguide.md), eller opprett et issue på GitHub (se [CONTRIBUTING.md](../../CONTRIBUTING.md)).
