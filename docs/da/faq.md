# Ofte stillede spørgsmål

## Hvor gemmes mine data?

I browserens egen database (IndexedDB) på den computer og i den browserprofil, du bruger. Intet sendes nogen steder.
Rydder du webstedsdata, skifter profil eller afinstallerer browseren, forsvinder data. Tag derfor backup under *Håndter →
Arbejdsområde*, eller brug en portabel mappe i Edge og Chrome, så arbejdsområdet også ligger som almindelige filer på
disken (se [kom-igang.md](kom-igang.md)).

## Har jeg brug for internet?

Nej. Internet kræves kun, når du henter data fra et API, synkroniserer med GitHub eller klikker på *Søg efter opdateringer*. Alt andet, også R,
fungerer uden netværk.

## Hvorfor tager det tid første gang, jeg bruger R?

R indlæses som WebAssembly (omkring 50 MB) og starter på nogle sekunder. Pakker som ggplot2 installeres i R-sessionen,
første gang du bruger dem, hvilket tager yderligere nogle sekunder. R-sessionen starter forfra, når du genindlæser siden,
men dine datasæt og scripts er der stadig.

## Kan jeg afbryde R-kode, der hænger?

Nej. Under file:// tillader browseren ikke den mekanisme, der kræves for at afbryde R midt i en beregning. Brug *Genstart
R* i Analysér; datasættene påvirkes ikke.

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

Ja. Læg mappen uændret på en vilkårlig statisk webserver. Der kræves ingen serverfunktioner.

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
kommandoen *Sprog* i paletten det samme valg. Svensk, dansk, norsk (bokmål), finsk, islandsk og engelsk findes. Appen
genindlæses på det valgte sprog, når ugemte ændringer er gemt. Valget gemmes i browseren, så hver computer og profil har
sit eget. Dokumentationen findes på de samme sprog i mappen `docs`.

## Findes der kilder fra andre nordiske lande?

Ja. Under *Åbne API'er* i Hent findes statistikbureauerne i Danmark, Norge, Finland, Island, Grønland, Færøerne og Åland,
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

Nemmest med *Del pakke* under *Håndter → Arbejdsområde*: vælg datasæt, og om diagrammer, dashboards, skabeloner og
notesbøger skal med, skriv en besked, og send ZIP-filen. Kollegaen slipper den på *Gendan fra ZIP*, ser din besked og hvad
der er ændret og kan erstatte sine egne versioner. Kommentarer til datasæt og kolonner følger med. Arbejder I med samme
arbejdsområde, kan I også bruge et fælles GitHub-repository (*GitHub* under *Håndter → Arbejdsområde*). Du kan også
eksportere et enkelt datasæt som SQLite (bevarer typer, etiketter, kommentarer og historik) eller tage backup af hele
arbejdsområdet. Diagrammer og dokumentskabeloner kan eksporteres som JSON-filer, API-konfigurationer som `.api.json` og
recepter som JSON, R eller SQL.

## Hvordan åbner jeg grundkurset igen?

Klik på spørgsmålstegnet øverst til højre, og vælg *Åbn grundkurset*, eller tryk Ctrl+K, og skriv *grundkurs*.
Kurset fortsætter, hvor du slap; har du gennemført det, begynder det forfra. Det findes på alle seks sprog.

## Finder du ikke svaret her?

Læs [anvandarguide.md](anvandarguide.md), eller opret et issue på GitHub (se [CONTRIBUTING.md](../../CONTRIBUTING.md)).
