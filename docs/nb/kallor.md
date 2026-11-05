# Kilder: databaser, broen og lenkede filer

I tillegg til filer, innlimt tekst, nettadresser og de forhåndsinnstilte åpne API-ene (se
[api-konfiguration.md](api-konfiguration.md)) kan Dataspatium hente data fra databaser på tre måter:
**Access-filer** leses rett i nettleseren, **databaser på din egen datamaskin eller i nettverket** nås gjennom en
liten lokal bro, og **databasetjenester over HTTP** (PostgREST, OData, GraphQL med flere) blir vanlige kilder i
Hent inn. Filer som er valgt med datamaskinens filvelger, kan dessuten **lenkes**, slik at datasettet leses inn
igjen fra disken med ett klikk. Alt skjer i nettleseren; ingenting sendes noe annet sted enn til databasen du
selv oppgir.

## Access-filer (mdb, accdb)

Slipp filen på flaten i Hent inn som en hvilken som helst fil. Filen leses av mdb-reader rett i nettleseren, uten
at Access trenger å finnes på datamaskinen: tabellene listes i trinnet *Innstillinger*, du velger én og får
kolonnene med typene Access oppgir (tekst, tall, datoer, ja/nei). Spørringer (queries), lenkede tabeller og
passordbeskyttede filer kan ikke leses på denne måten; bruk da broen nedenfor. dBase-filer (.dbf) leses via
regnearkimporten.

## Databasebroen

Broen er et lite skript som du starter på datamaskinen når du trenger det, i samme ånd som en lokal webserver.
Den lytter bare på din egen datamaskin (127.0.0.1), krever et token som vises i vinduet og er skrivebeskyttet om
du ikke starter den med skriving tillatt. Appen henter tabeller gjennom broen; ingenting forlater datamaskinen.

### Starte broen

- **Windows**: åpne PowerShell i appens mappe og kjør `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  Broen snakker ODBC, OLE DB og SqlClient og når dermed Access (mdb og accdb via Microsoft ACE), Excel, SQL
  Server (også LocalDB og Express), Oracle, PostgreSQL, MySQL/MariaDB, Paradox, dBase og alle ODBC-datakilder
  (DSN) på datamaskinen. Ingen administratorrettigheter trengs.
- **macOS og Linux** (og Windows uten PowerShell): `python tools/db_bridge.py` (Python 3, standardbiblioteket).
  SQLite-filer virker alltid; med `pyodbc` installert (`pip install pyodbc`) også ODBC-kilder.

Vinduet viser adressen (`http://127.0.0.1:<port>/`) og tokenet. Valg: `-Port` eller `--port` velger port,
`-AllowWrite` eller `--allow-write` tillater endringer, `-MaxRows` eller `--max-rows` begrenser antall rader per
henting (standard 100 000), og `-AllowOrigins` eller `--allow-origin` oppgir hvilke appadresser som får kalle
broen. En side åpnet fra mappen har opphavet `null`, som er tillatt, i likhet med `localhost` og appens adresse
på GitHub Pages. Lukk vinduet, eller trykk Ctrl+C, for å stoppe.

### Bruke broen i appen

1. Velg *Database via broen* under *Databaser* i Hent inn, lim inn adressen og tokenet og trykk på **Koble til**.
   Tokenet gjelder for økten; *Lagre kryptert* lagrer det med samme passfrase som API-nøklene.
2. Beskriv kilden: Access- eller Excel-fil (sti på datamaskinen), SQL Server (server, database og bruker, eller
   Windows-pålogging), ODBC-datakilde (velg blant datamaskinens DSN-er) eller en tilkoblingsstreng. Trykk på
   **Hent tabeller**.
3. Velg en tabell, se de første hundre radene og trykk på **Importer**. Kolonnetypene kommer fra databasen.
4. **Egen SQL** kjører en spørring i databasens egen dialekt og importerer resultatet. SELECT vises direkte; andre
   setninger krever at broen er startet med skriving tillatt, og godkjennes én om gangen i en dialog som viser
   setningen.

Importerte datasett husker kilden: *Oppdater* i Håndter, eller *Lagrede hentinger* i Hent inn, henter tabellen
eller spørringen på nytt og spiller av oppskriften. Passord lagres aldri med datasettet; etter en omstart ber
appen deg åpne kilden igjen før den oppdateres. Fanen SQL i Analyser kan kjøre direkte mot kilden som sist ble
åpnet i broen (*Kjør mot*).

### Sikkerhet

- Broen svarer bare på 127.0.0.1, krever token i hvert kall og tillater CORS bare for appens egne adresser.
- Skrivebeskyttet som standard: bare SELECT slipper gjennom. Med skriving tillatt kreves likevel din godkjenning
  per setning; broen svarer 428 til appen sender godkjenningen.
- Broen logger de siste kallene (`GET /log`) og stopper når vinduet lukkes.
- Token og passord lagres bare i økten eller kryptert med passfrase, aldri i klartekst og aldri i delte
  konfigurasjoner.

### Feilsøking

- *Provider cannot be found*: installer Microsoft Access Database Engine (ACE) i 64-bitersversjon, eller bruk en
  ODBC-DSN med 64-bitersdriver. Broen er 64-biters når PowerShell er det.
- *Feil eller manglende token*: kopier tokenet fra broens vindu igjen; det byttes ved hver start om du ikke
  oppgir `-Token`.
- *Broen svarer ikke*: kontroller at vinduet er åpent og at adressen stemmer; prøv en annen port.
- Kjørepolicy: skriptet startes med `-ExecutionPolicy Bypass`, akkurat som appens testverktøy, så ingen
  innstillinger må endres.
- IT-avdelingen kan gå gjennom skriptet (`tools/db-bridge.ps1`, rundt 200 linjer) og starte det med fast port og token.

## Databasekilder over HTTP

Knappen **Legg til databasekilde** under *Databaser* i Hent inn lager en vanlig API-kilde av en adresse og en
nøkkel. Appen spør tjenesten etter tabellene (skjemaoppdagelse) og legger til ett endepunkt per tabell pluss et
generelt der du oppgir tabellen selv. Kilden fungerer deretter som de forhåndsinnstilte API-ene: parametere,
forhåndsvisning, sider som følges automatisk og lagrede hentinger som oppdateres med ett klikk.

| Familie | Autentisering | Oppdagelse | Henting | CORS |
|---|---|---|---|---|
| PostgREST / Supabase | `apikey`-hode (valgfritt) | OpenAPI-roten | `select`, `order`, filtre per linje; sider med `limit`/`offset` | Tillatt som standard |
| OData v4 | Basic (valgfritt) | Tjenestedokumentet | `$select`, `$filter`, `$orderby`, `$top`; `@odata.nextLink` følges | Avhenger av tjenesten |
| GraphQL | Bearer (valgfritt) | Ingen | Du skriver spørringen; første liste under `data` blir tabellen | Avhenger av serveren |
| CouchDB | Basic (valgfritt) | `_all_dbs` | `_all_docs` med dokumentene; `skip`/`limit` | Slås på i CouchDB |
| ClickHouse | Basic (valgfritt) | `SHOW TABLES` | SQL per tabell med `FORMAT JSON`; `add_http_cors_header=1` sendes | Via innstillingen |
| Elasticsearch / OpenSearch | API-nøkkel (valgfritt) | `_cat/indices` | `_search` med `q`; `from`/`size`, høyst 10 000 treff | `http.cors.*` |
| SPARQL | Ingen | Ingen | Spørringen som parameter; variablene blir kolonner | Offentlige endepunkter tillater |
| InfluxDB v2 | Token | Bøtter | Flux-spørring; annotert CSV | Kontroller serveren |
| Google Sheets | Ingen | Ingen | Publisert eller lenkedelt ark som CSV | Google |
| Airtable | Personlig token | Metadata-API | Poster med `offset`; feltene blir kolonner | Tillatt |

CORS betyr at databasens server må tillate kall fra nettleseren. En side åpnet fra mappen sender opphavet `null`;
i servermodus appens adresse. Hvordan det slås på, står i den enkelte dokumentasjonen (lenke i dialogen). Kan
serveren ikke endres, gjenstår proxyinnstillingen (se [api-konfiguration.md](api-konfiguration.md)) eller broen
via ODBC.

Nøkler og passord blir i økten eller lagres kryptert; konfigurasjonen som opprettes, kan eksporteres og deles
uten dem. Svarformatene `graphql`, `sparql` og `influx-csv` samt `lift` (løfte et nestet objekt opp til kolonner)
er beskrevet i [api-konfiguration.md](api-konfiguration.md) og kan brukes i egne konfigurasjoner.

### Neo4j over Bolt

Familien **Neo4j (Bolt)** i *Legg til databasekilde* kobler til Neo4j Aura eller en egen server med Neo4js driver over
WebSocket (`neo4j+s://…`, database, brukernavn og passord; passordet lagres aldri i klartekst). Kilden åpner en
Cypher-redigerer: resultatet blir en tabell, eller et grafdatasett når svaret inneholder noder og relasjoner; spørringer
kan lagres på kilden. Tilkoblingen krever samtykke (formålet Neo4j) og omfattes ikke av CORS; en egen server uten TLS
(`bolt://`) nås bare fra en side over http://. Se [grafer.md](grafer.md#neo4j-som-kilde).

### OpenCDE-server (BCF og Documents API)

Familien **OpenCDE (BCF, Documents)** i *Legg til databasekilde* kobler til en server som følger buildingSMARTs
OpenCDE-API-er, for eksempel [Kontroll](https://github.com/marwiss/Kontroll). Oppgi serverens adresse og klient-id-en
som serverens administrator har registrert for Dataspatium (en offentlig klient med omdirigeringsadressen
`http://127.0.0.1:8080/oauth-callback.html`, eller tilsvarende for adressen appen serveres fra). Kilden åpner en visning
der du logger inn på serveren (OAuth2 med PKCE i et popup-vindu; fra file:// limer du inn adressen du ender på etter
innloggingen), velger prosjekt og henter saker, kommentarer, viewpoint-komponenter (ett IFC-element per rad), hendelser
og filer som tabeller. *Hent dokumenter* åpner serverens egen side for dokumentvalg (Documents API); de valgte filene
hentes og importeres som om du hadde sluppet dem i appen, så en IFC-modell blir et modelldatasett. Tilgangstokener
finnes bare i sesjonen og eksporteres aldri med kilden. Tilkoblingen krever samtykke (formålet OpenCDE-server) og at
serveren tillater kall fra nettleseren (CORS).

## Åpne geodata

Dialogen *Legg til geodatakilde* begynner med en liste over **ferdige geodatakilder**: åpne WFS-, OGC API Features- og
ArcGIS-tjenester fra nordiske etater og kommuner (SCB, SGU, Naturvårdsverket, Riksantikvarieämbetet, Skogsstyrelsen,
Kartverket, Miljødirektoratet, Riksantikvaren, Statistikcentralen, SYKE, Helsingfors, Väylävirasto, Danmarks
Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands med flere), alle kontrollert å virke fra
nettleseren. En forhåndsinnstilt kilde åpnes, de øvrige legges til med ett klikk, og lagene leses fra tjenesten;
filtrer på navn, land eller innhold. Listen ligger i `presets/geodata/services.json`. Under listen finnes feltene for en

Tre kilder henter planer: *Plandata.dk (WFS)* og *Skipulagsstofnun skipulagsgögn (ArcGIS)* har knappen **Hent plan**,
som leser en hel lokalplan respektive et deiliskipulag (alle lag) med planens nummer og lagrer den som plan, og
*Ryhti kaavatiedot (OGC API Features)* gir Finlands planindeks. Se [planer.md](planer.md#planer-fra-de-andre-nordiske-landene).
egen tjeneste. Boverkets Planbestämmelsekatalog finnes som vanlig API-kilde (*Boverket Planbestämmelsekatalogen*), se
[planer.md](planer.md).

Knappen **Legg til geodatakilde** under *Databaser* i Hent inn gjør en vanlig API-kilde av adressen til en geodatatjeneste,
på samme måte som databasekildene. Appen leser tjenestens lag og legger et endepunkt per lag pluss et allment der du
oppgir laget selv. Svarene er GeoJSON i WGS 84: datasettet får en geometrikolonne og åpnes som kart i Bearbeid (se
[kartor.md](kartor.md)). Kilden viser lagene som en liste som kan filtreres; velg et lag, begrens gjerne med et område
(bbox) og hent. Forhåndsvisningen viser svaret som et lite kart over tabellen, og *Åpne som kart* tar deg til det lagrede
datasettet.

| Familie | Oppdagelse | Henting | Nøkkel |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, Deegree) | GetCapabilities | GetFeature med `outputFormat=application/json` og `srsName=EPSG:4326`; område (bbox), CQL-filter, kolonner; sider med `startIndex`/`count` | Bearer (valgfritt) |
| OGC API Features | `/collections` | `/collections/{id}/items` med bbox, datetime og filter; next-lenker følges | Bearer (valgfritt; kreves av Lantmäteriets geodataplattform) |
| ArcGIS REST (FeatureServer, MapServer) | Tjenestens beskrivelse eller hele katalogen | `/{lag}/query` med where, område, `f=geojson` og `outSR=4326`; sider med `resultOffset` | Token (valgfritt) |

Forhåndsinnstilte geodatakilder uten nøkkel (CORS verifisert): SCB åpne geodata, SGU, Havs- och vattenmyndigheten,
Riksantikvarieämbetets kulturminner, Skogsstyrelsen, Kartverkets administrative enheter og eiendomskart (Norge) samt
Statistikcentralen og SYKE (Finland). Lagene leses fra tjenesten første gang kilden åpnes og kan leses på nytt med *Les
lagene på nytt*; listen lagres i din kopi av kilden. Lantmäteriets geodataplattform (reguleringsplaner) finnes som nivå 2
med Bearer-nøkkel fra en tilknyttet organisasjon.

**Geodataportalen** (geodata.se) er Sveriges nasjonale katalog over etaters, regioners og kommuners geodata. Kilden
*Geodataportalen (sök geodata)* søker i katalogen og viser en post per treff med tittel, organisasjon, beskrivelse og
tjenester: en WFS-, OGC API- eller ArcGIS-tjeneste legges til som geodatakilde med ett klikk og åpnes straks, en
WMS-adresse kopieres for bruk som bakgrunnskart eller WMS-lag i en kartvisning, og nedlastingsfiler og metadata åpnes i
en ny fane. Trefflisten kan også hentes som tabell under fanen *Endepunkter*.

Geodatatjenester svarer ofte med mange objekter: begrens med et område eller et filter, og hev *Høyeste antall sider*
under *Flere valg* bare når det trengs. En egen tjeneste må tillate kall fra nettleseren (CORS) på samme måte som
databasekildene; de fleste etaters GeoServer og ArcGIS Server gjør det.
## Lenkede filer

I Chrome og Edge finnes knappen **Lenk en fil på datamaskinen** i Hent inn. Filen velges med datamaskinens
filvelger og importeres som vanlig, men datasettet beholder en lenke til filen: **Oppdater fra disken** i Håndter
leser filen igjen med samme innstillinger, bytter ut radene og spiller av oppskriften (opprydding, nye kolonner og
koblinger gjøres om). Nettleseren kan be om lov til å lese filen igjen etter en omstart. Firefox mangler
funksjonen; der importerer du filen på nytt. Formater som leses via R (SPSS, Stata, SAS, PX, RDS, Parquet), kan
ikke lenkes.

## WebSocket

Appen har en tilkoblingsmåte for WebSocket (samtykke per formål, JSON-rammer, spørring og svar paret på id). Den
brukes av kommende kilder som Neo4j (Bolt over WebSocket, planlagt til 2.9) og strømmende API-er; ingen
forhåndsinnstillinger bruker den ennå.

## Begrensninger

- Broen kjører på datamaskinen der appen brukes; fjerndatabaser nås via drivere eller DSN-er på den datamaskinen.
- Høyst 100 000 rader per henting gjennom broen om ikke `-MaxRows` økes; store tabeller avgrenses best med SQL.
- Access-filer i nettleseren: ingen spørringer, lenkede tabeller eller passord; svært store filer tar minne.
- Elasticsearch gir høyst 10 000 treff per søk (`from` + `size`).
- Alle HTTP-kilder krever CORS; det kan ikke omgås fra nettleseren.
