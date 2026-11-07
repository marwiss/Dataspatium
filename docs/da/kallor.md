# Kilder: databaser, broen og linkede filer

Ud over filer, indsat tekst, webadresser og de forudindstillede åbne API'er (se
[api-konfiguration.md](api-konfiguration.md)) kan Dataspatium hente data fra databaser på tre måder:
**Access-filer** læses direkte i browseren, **databaser på din egen computer eller i netværket** nås gennem en
lille lokal bro, og **databasetjenester over HTTP** (PostgREST, OData, GraphQL med flere) bliver almindelige kilder
i Hent. Filer, der er valgt med computerens filvælger, kan desuden **linkes**, så datasættet indlæses igen fra
disken med ét klik. Alt sker i browseren; intet sendes andre steder hen end til den database, du selv angiver.

## Access-filer (mdb, accdb)

Slip filen på fladen i Hent som en hvilken som helst fil. Filen læses af mdb-reader direkte i browseren, uden at
Access behøver være på computeren: tabellerne vises i trinnet *Indstillinger*, du vælger én og får kolonnerne med
de typer, Access angiver (tekst, tal, datoer, ja/nej). Forespørgsler (queries), linkede tabeller og
adgangskodebeskyttede filer kan ikke læses på denne måde; brug i så fald broen nedenfor. dBase-filer (.dbf) læses
via regnearksimporten.

## Databasebroen

Broen er et lille script, som du starter på computeren, når du har brug for det, i samme ånd som en lokal
webserver. Den lytter kun på din egen computer (127.0.0.1), kræver en token, som vises i vinduet, og er
skrivebeskyttet, medmindre du starter den med skrivning tilladt. Appen henter tabeller gennem broen; intet
forlader computeren.

### Start broen

- **Windows**: åbn PowerShell i appens mappe, og kør `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  Broen taler ODBC, OLE DB og SqlClient og når dermed Access (mdb og accdb via Microsoft ACE), Excel, SQL Server
  (også LocalDB og Express), Oracle, PostgreSQL, MySQL/MariaDB, Paradox, dBase og alle ODBC-datakilder (DSN) på
  computeren. Der kræves ingen administratorrettigheder.
- **macOS og Linux** (og Windows uden PowerShell): `python tools/db_bridge.py` (Python 3, standardbiblioteket).
  SQLite-filer virker altid; med `pyodbc` installeret (`pip install pyodbc`) også ODBC-kilder.

Vinduet viser adressen (`http://127.0.0.1:<port>/`) og token. Tilvalg: `-Port` henholdsvis `--port` vælger port,
`-AllowWrite` henholdsvis `--allow-write` tillader ændringer, `-MaxRows` henholdsvis `--max-rows` begrænser antallet
af rækker pr. hentning (standard 100.000), og `-AllowOrigins` henholdsvis `--allow-origin` angiver, hvilke
appadresser der må kalde broen. En side åbnet fra mappen har oprindelsen `null`, som er tilladt, ligesom
`localhost` og appens adresse på GitHub Pages. Luk vinduet, eller tryk Ctrl+C, for at stoppe.

### Brug broen i appen

1. Vælg *Database via broen* under *Databaser* i Hent, indsæt adressen og token, og tryk på **Forbind**. Token
   gælder for sessionen; *Gem krypteret* gemmer den med samme løsenfrase som API-nøglerne.
2. Beskriv kilden: Access- eller Excel-fil (sti på computeren), SQL Server (server, database og bruger, eller
   Windows-login), ODBC-datakilde (vælg blandt computerens DSN'er) eller en forbindelsesstreng. Tryk på
   **Hent tabeller**.
3. Vælg en tabel, se de første hundrede rækker, og tryk på **Importér**. Kolonnetyperne kommer fra databasen.
4. **Egen SQL** kører en forespørgsel i databasens egen dialekt og importerer resultatet. SELECT vises direkte;
   andre sætninger kræver, at broen er startet med skrivning tilladt, og godkendes én ad gangen i en dialog, der
   viser sætningen.

Importerede datasæt husker kilden: *Opdatér* i Håndter, eller *Gemte hentninger* i Hent, henter tabellen eller
forespørgslen igen og afspiller opskriften. Adgangskoder gemmes aldrig med datasættet; efter en genstart beder
appen dig åbne kilden igen, før den opdateres. Fanen SQL i Analysér kan køre direkte mod den kilde, der senest
blev åbnet i broen (*Kør mod*).

### Sikkerhed

- Broen svarer kun på 127.0.0.1, kræver token i hvert kald og tillader kun CORS for appens egne adresser.
- Skrivebeskyttet som standard: kun SELECT slipper igennem. Med skrivning tilladt kræves stadig din godkendelse
  pr. sætning; broen svarer 428, indtil appen sender godkendelsen.
- Broen logger de seneste kald (`GET /log`) og stopper, når vinduet lukkes.
- Token og adgangskoder gemmes kun i sessionen eller krypteret med løsenfrase, aldrig i klartekst og aldrig i
  delte konfigurationer.

### Fejlfinding

- *Provider cannot be found*: installér Microsoft Access Database Engine (ACE) i 64-bit-versionen, eller brug et
  ODBC-DSN med 64-bit-driver. Broen er 64-bit, når PowerShell er det.
- *Forkert eller manglende token*: kopiér token fra broens vindue igen; den skifter ved hver start, medmindre du
  angiver `-Token`.
- *Broen svarer ikke*: kontrollér, at vinduet er åbent, og at adressen er rigtig; prøv en anden port.
- Kørselspolitik: scriptet startes med `-ExecutionPolicy Bypass`, ligesom appens testværktøjer, så ingen
  indstillinger skal ændres.
- IT-afdelingen kan gennemgå scriptet (`tools/db-bridge.ps1`, omkring 200 linjer) og starte det med fast port og token.

## Databasekilder over HTTP

Valget **Databasekilde** under *Tilføj kilder* i Hent laver en almindelig API-kilde af en adresse og en nøgle.
Appen spørger tjenesten om dens tabeller (skemaopdagelse) og tilføjer et endepunkt pr. tabel plus et generelt,
hvor du selv angiver tabellen. Kilden fungerer derefter som de forudindstillede API'er: parametre,
forhåndsvisning, sider, der følges automatisk, og gemte hentninger, der opdateres med ét klik.

| Familie | Godkendelse | Opdagelse | Hentning | CORS |
|---|---|---|---|---|
| PostgREST / Supabase | `apikey`-header (valgfri) | OpenAPI-roden | `select`, `order`, filtre pr. linje; sider med `limit`/`offset` | Tilladt som standard |
| OData v4 | Basic (valgfri) | Tjenestedokumentet | `$select`, `$filter`, `$orderby`, `$top`; `@odata.nextLink` følges | Afhænger af tjenesten |
| GraphQL | Bearer (valgfri) | Ingen | Du skriver forespørgslen; første liste under `data` bliver tabellen | Afhænger af serveren |
| CouchDB | Basic (valgfri) | `_all_dbs` | `_all_docs` med dokumenterne; `skip`/`limit` | Slås til i CouchDB |
| ClickHouse | Basic (valgfri) | `SHOW TABLES` | SQL pr. tabel med `FORMAT JSON`; `add_http_cors_header=1` sendes | Via indstillingen |
| Elasticsearch / OpenSearch | API-nøgle (valgfri) | `_cat/indices` | `_search` med `q`; `from`/`size`, højst 10.000 hits | `http.cors.*` |
| SPARQL | Ingen | Ingen | Forespørgslen som parameter; variablerne bliver kolonner | Offentlige endepunkter tillader |
| InfluxDB v2 | Token | Buckets | Flux-forespørgsel; annoteret CSV | Kontrollér serveren |
| Google Sheets | Ingen | Ingen | Udgivet eller linkdelt ark som CSV | Google |
| Airtable | Personligt token | Metadata-API | Poster med `offset`; felterne bliver kolonner | Tilladt |

CORS betyder, at databasens server skal tillade kald fra browseren. En side åbnet fra mappen sender oprindelsen
`null`; i servertilstand appens adresse. Hvordan det slås til, står i den enkelte dokumentation (link i dialogen).
Kan serveren ikke ændres, er proxyindstillingen (se [api-konfiguration.md](api-konfiguration.md)) eller broen via
ODBC tilbage.

Nøgler og adgangskoder bliver i sessionen eller gemmes krypteret; den konfiguration, der oprettes, kan eksporteres
og deles uden dem. Svarformaterne `graphql`, `sparql` og `influx-csv` samt `lift` (løft et indlejret objekt op til
kolonner) er beskrevet i [api-konfiguration.md](api-konfiguration.md) og kan bruges i egne konfigurationer.

### Neo4j over Bolt

Valget **Neo4j** under *Tilføj kilder* (familien **Neo4j (Bolt)**, som også findes i *Databasekilde*) forbinder til Neo4j Aura eller en egen server med Neo4j's driver over
WebSocket (`neo4j+s://…`, database, brugernavn og adgangskode; adgangskoden gemmes aldrig i klartekst). Kilden åbner en
Cypher-editor: resultatet bliver en tabel, eller et grafdatasæt når svaret indeholder knuder og relationer; forespørgsler
kan gemmes på kilden. Forbindelsen kræver samtykke (formålet Neo4j) og er ikke omfattet af CORS; en egen server uden TLS
(`bolt://`) nås kun fra en side over http://. Se [grafer.md](grafer.md#neo4j-som-kilde).

### OpenCDE-server (BCF og Documents API)

Valget **OpenCDE** under *Tilføj kilder* (familien **OpenCDE (BCF, Documents)**, som også findes i *Databasekilde*) forbinder til en server, der følger buildingSMARTs
OpenCDE-API'er, for eksempel [Kontroll](https://github.com/marwiss/Kontroll). Angiv serverens adresse og det klient-id,
som serverens administrator har registreret til Dataspatium (en offentlig klient med omdirigeringsadressen
`http://127.0.0.1:8080/oauth-callback.html` eller det tilsvarende for den adresse, appen serveres fra). Kilden åbner en
visning, hvor du logger ind på serveren (OAuth2 med PKCE i et pop op-vindue; fra file:// indsætter du den adresse, du
lander på efter login), vælger projekt og henter sager, kommentarer, viewpoint-komponenter (ét IFC-element pr. række),
hændelser og filer som tabeller. *Hent dokumenter* åbner serverens egen side til dokumentvalg (Documents API); de valgte
filer hentes og importeres, som om du havde sluppet dem i appen, så en IFC-model bliver et modeldatasæt. Adgangstokens
findes kun i sessionen og eksporteres aldrig med kilden. Forbindelsen kræver samtykke (formålet OpenCDE-server), og
serveren skal tillade kald fra browseren (CORS).

Appen taler BCF API 3.0 og 2.1. Den vælger den nyeste version, serveren tilbyder, og en server med kun 2.1 virker også: sådan en mangler ofte
Foundation API og Documents API, så appen læser versionen fra `/bcf/versions` og loginadresserne fra `/bcf/2.1/auth` og udelader *Hent dokumenter*.
Under *Flere indstillinger* i dialogen kan du selv vælge version, og tilbyder serveren flere, kan du skifte i kildens visning. I 2.1 viser *Filer i projektet*
kun BCF-dokumenterne, sager har ikke serverens løbenummer, og et viewpoint kan ikke slettes. Til gengæld kan en kommentar være svar på en anden: knappen
*Svar* i panelet *Sager*.

Kortet *IFC-LPG* vises, når serveren har en graf, se [grafer.md](grafer.md#ifc-lpg-på-en-kontroll-server).

Under *Filer i projektet* viser kilden de modeller og dokumenter, serveren har for projektet. *Hent* laver et datasæt af
filens egen slags, så en IFC-fil bliver en model og en CSV-fil en tabel, og datasættet husker, hvilken server, hvilket
projekt og hvilken version det kom fra. I Håndter viser kortet *Fra CDE* dette, og *Søg ny version* spørger serveren, om
dokumentet har en nyere version; den hentes så som et eget datasæt ved siden af det gamle. Kilden siger også, hvad du må
gøre i projektet, for eksempel oprette sager eller uploade dokumenter. Når kilden oprettes, spørger dialogen serveren,
hvor man logger ind; svarer serveren ikke da, spørger appen igen ved første login.

Tillader serveren det, registrerer appen sig selv som klient, når du lader klient-id stå tomt, så ingen administrator behøver
at udlevere noget. Datasæt kan også gå tilbage til serveren: fanen *Til CDE* i Del sender et datasæt i et vilkårligt format,
eller originalfilen, til et projekt, enten gennem Documents API, hvor serverens egen side spørger om titel og version, eller som
BCF-dokument. Et datasæt hentet fra serveren kan sendes som en ny version af sit dokument.

Til Kontrolls IFC-graf findes startkode i visningen: modellerne i grafen og den seneste færdige per dokument, bygningsdele per klasse, væggenes GTIN, sager per status,
sager og deres bygningsdele, sager der vedrører en bygningsdel, og en graf af sager, viewpoints og komponenter. Vælg en
forespørgsel, ret og kør. Det forudsætter, at den, der driver serveren, har gjort Bolt tilgængelig; udviklingsstakken gør det, en
produktionsserver gør det sjældent.

En arbejdsområdepakke kan også gå gennem serveren: fanen *Til CDE* sender den som dokument, og kortet med projektets filer viser
knappen *Modtag* for pakkefiler, som modtager pakken præcis som når filen slippes i Hent.

Kortet *Log* nederst i kildens visning viser alt, appen har sendt til serveren i sessionen: tid, metode, API (Foundation, BCF
eller Documents) og operation ifølge specifikationen, status og tid. Et klik på en række viser headerne (tokens og cookies skjult),
en forklaring af, hvad operationen gør, med link til specifikationen, og knappen *Kopiér som curl*. Slå *Gem indhold* til for også
at se forespørgslens og svarets indhold (tekst, højst 64 kB; aldrig token-kald). Loggen findes kun i hukommelsen og sendes aldrig;
den kan gemmes som JSON eller som et datasæt. Appen sætter headeren X-Request-Id på hvert kald, så serverens egen log kan parres
med appens; afviser en server headeren, slås den fra for den kilde.

Serverens side beskrives i Kontrolls dokumentation: [client-guide.md](https://github.com/marwiss/Kontroll/blob/main/docs/da/client-guide.md) (hvordan en klient forbinder), [acceptance.md](https://github.com/marwiss/Kontroll/blob/main/docs/acceptance.md) (parrets testkørsler) og [deploy/local.md](https://github.com/marwiss/Kontroll/blob/main/docs/da/deploy/local.md) (udviklingsstakken og hvordan appen testes mod den).

Kontroll beskriver sine tilføjelser i `GET /.well-known/kontroll`; appen læser dokumentet, når kilden åbnes, og skriver under
overskriften, hvilken server det er, og hvilke tilføjelser den har (selvregistrering, forespørgselslog, administration, IFC-LPG,
grafforespørgsler). En server uden dokumentet har ingen tilføjelser, og alt ifølge specifikationerne fungerer alligevel. Serverens
fejlkoder (`code` i svaret, for eksempel `reauthentication_required`) vises på dit sprog; ukendte koder viser serverens egen tekst.
Linket *Åbn i Dataspatium* på serverens sider har formen `index.html#/inhamta/opencde?server=https://…` og åbner dialogen for en ny
kilde med adressen udfyldt. Findes serveren allerede som kilde, åbnes den direkte. Linket kan også udpege et projekt og et dokument
(`&project=…&document=…&version=…`): projektet vælges, og dokumentet hentes som datasæt, når du er logget ind. Sider, som Kontroll
åbner i popup (login, upload, valg af dokumenter), vises på appens sprog.

**Administration.** Er du administrator på en Kontroll-server, viser kildens visning kortet *Administration* (når serverens kapabilitetsdokument siger, at administrations-API'et er slået til). Knappen *Log ind som administrator* beder om rettigheden `admin`; derefter findes fanerne Oversigt, Brugere (opret, ændr, deaktivér, nulstil kodeord, slet), Projekter (opret, omdøb, medlemmer og roller, slet), Klienter (registrér, ændr, rotér hemmelighed, tilbagekald tokens, slet), Sessioner (afslut én eller alle for en bruger), Revision, Indstillinger og Helbred samt Grafforespørgsel, når serveren tillader læsende Cypher mod IFC-grafen. Farlige handlinger kræver et friskt login: serveren svarer `reauthentication_required`, appen åbner login igen og gentager kaldet. Engangsværdier (et første kodeord, en klienthemmelighed) vises én gang med knappen Kopiér og skrives aldrig i loggen. Hver liste kan gemmes som datasæt og hentes igen fra Håndtér.

## Åbne geodata

Dialogen for *Geodatakilde* under *Tilføj kilder* begynder med en liste over **færdige geodatakilder**: åbne WFS-, OGC API Features- og
ArcGIS-tjenester fra nordiske myndigheder og kommuner (SCB, SGU, Naturvårdsverket, Riksantikvarieämbetet,
Skogsstyrelsen, Kartverket, Miljødirektoratet, Riksantikvaren, Statistikcentralen, SYKE, Helsinki, Väylävirasto,
Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands med flere), alle kontrolleret til at virke
fra browseren. En forudindstillet kilde åbnes, de øvrige tilføjes med ét klik, og lagene læses fra tjenesten; filtrér
på navn, land eller indhold. Listen ligger i `presets/geodata/services.json`. Under listen findes felterne til en egen

Tre kilder henter planer: *Plandata.dk (WFS)* og *Skipulagsstofnun skipulagsgögn (ArcGIS)* har knappen **Hent plan**,
som læser en hel lokalplan henholdsvis et deiliskipulag (alle lag) med planens nummer og gemmer den som plan, og
*Ryhti kaavatiedot (OGC API Features)* giver Finlands planindeks. Se [planer.md](planer.md#planer-fra-de-andre-nordiske-lande).
tjeneste. Boverkets Planbestämmelsekatalog findes som almindelig API-kilde (*Boverket Planbestämmelsekatalogen*), se
[planer.md](planer.md).

Valget **Geodatakilde** under *Tilføj kilder* i Indsaml gør en almindelig API-kilde af adressen til en geodatatjeneste,
på samme måde som databasekilderne. Appen læser tjenestens lag og lægger et endepunkt pr. lag plus et alment, hvor du
angiver laget selv. Svarene er GeoJSON i WGS 84: datasættet får en geometrikolonne og åbnes som kort i Bearbejd (se
[kartor.md](kartor.md)). Kilden viser lagene som en liste, der kan filtreres; vælg et lag, begræns gerne med et område
(bbox) og hent. Forhåndsvisningen viser svaret som et lille kort over tabellen, og *Åbn som kort* fører til det gemte
datasæt.

| Familie | Opdagelse | Hentning | Nøgle |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, Deegree) | GetCapabilities | GetFeature med `outputFormat=application/json` og `srsName=EPSG:4326`; område (bbox), CQL-filter, kolonner; sider med `startIndex`/`count` | Bearer (valgfrit) |
| OGC API Features | `/collections` | `/collections/{id}/items` med bbox, datetime og filter; next-links følges | Bearer (valgfrit; kræves af Lantmäteriets geodataplatform) |
| ArcGIS REST (FeatureServer, MapServer) | Tjenestens beskrivelse eller hele kataloget | `/{lag}/query` med where, område, `f=geojson` og `outSR=4326`; sider med `resultOffset` | Token (valgfrit) |

Forudindstillede geodatakilder uden nøgle (CORS verificeret): SCB åbne geodata, SGU, Havs- och vattenmyndigheten,
Riksantikvarieämbetets fortidsminder, Skogsstyrelsen, Kartverkets administrative enheder og ejendomskort (Norge) samt
Statistikcentralen og SYKE (Finland). Lagene læses fra tjenesten, første gang kilden åbnes, og kan genlæses med *Genlæs
lagene*; listen gemmes i din kopi af kilden. Lantmäteriets geodataplatform (lokalplaner) findes som niveau 2 med
Bearer-nøgle fra en tilsluttet organisation.

**Geodataportalen** (geodata.se) er Sveriges nationale katalog over myndigheders, regioners og kommuners geodata. Kilden
*Geodataportalen (sök geodata)* søger i kataloget og viser en post pr. resultat med titel, organisation, beskrivelse og
tjenester: en WFS-, OGC API- eller ArcGIS-tjeneste tilføjes som geodatakilde med ét klik og åbnes straks, en WMS-adresse
kopieres til brug som baggrundskort eller WMS-lag i en kortvisning, og downloadfiler og metadata åbnes i en ny fane.
Resultatlisten kan også hentes som tabel under fanen *Endepunkter*.

Geodatatjenester svarer ofte med mange objekter: begræns med et område eller et filter, og hæv kun *Højeste antal sider*
under *Flere valg*, når det er nødvendigt. En egen tjeneste skal tillade kald fra browseren (CORS) ligesom databasekilderne;
de fleste myndigheders GeoServer og ArcGIS Server gør det.
## Linkede filer

I Chrome og Edge findes knappen **Link en fil på computeren** i Hent. Filen vælges med computerens filvælger og
importeres som sædvanligt, men datasættet beholder et link til filen: **Opdatér fra disken** i Håndter læser filen
igen med samme indstillinger, udskifter rækkerne og afspiller opskriften (oprydninger, nye kolonner og koblinger
gøres om). Browseren kan bede om lov til at læse filen igen efter en genstart. Firefox mangler funktionen; dér
importerer du filen på ny. Formater, der læses via R (SPSS, Stata, SAS, PX, RDS, Parquet), kan ikke linkes.

## WebSocket

Appen har en forbindelsesmåde for WebSocket (samtykke pr. formål, JSON-rammer, forespørgsel og svar parret på id).
Den er tænkt til strømmende API'er; ingen forudindstillinger bruger den endnu. Neo4j går over Bolt med sin egen driver.

## Begrænsninger

- Broen kører på den computer, hvor appen bruges; fjerndatabaser nås via drivere eller DSN'er på den computer.
- Højst 100.000 rækker pr. hentning gennem broen, medmindre `-MaxRows` hæves; store tabeller afgrænses bedst med SQL.
- Access-filer i browseren: ingen forespørgsler, linkede tabeller eller adgangskoder; meget store filer tager hukommelse.
- Elasticsearch giver højst 10.000 hits pr. søgning (`from` + `size`).
- Alle HTTP-kilder kræver CORS; det kan ikke omgås fra browseren.
