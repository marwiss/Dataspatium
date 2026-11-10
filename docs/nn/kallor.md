# Kjelder: databasar, brua og lenkja filer

I tillegg til filer, innlimt tekst, nettadresser og dei førehandsinnstilte opne API-a (sjå
[api-konfiguration.md](api-konfiguration.md)) kan Dataspatium hente data frå databasar på tre måtar:
**Access-filer** blir lesne rett i nettlesaren, **databasar på di eiga datamaskin eller i nettverket** blir nådde gjennom ei
lita lokal bru, og **databasetenester over HTTP** (PostgREST, OData, GraphQL med fleire) blir vanlege kjelder i
Hent. Filer som er valde med filveljaren på datamaskina, kan dessutan **lenkjast**, slik at datasettet blir lese inn
igjen frå disken med eitt klikk. Alt skjer i nettlesaren; ingenting blir sendt nokon annan stad enn til databasen du
sjølv oppgjev.

## Access-filer (mdb, accdb)

Slepp fila på flata i Hent som ei kva som helst fil. Fila blir lesen av mdb-reader rett i nettlesaren, utan
at Access treng finnast på datamaskina: tabellane blir lista i steget *Innstillingar*, du vel éin og får
kolonnane med typane Access oppgjev (tekst, tal, datoar, ja/nei). Spørjingar (queries), lenkja tabellar og
passordverna filer kan ikkje lesast på denne måten; bruk då brua nedanfor. dBase-filer (.dbf) blir lesne via
reknearkimporten.

## Databasebrua

Brua er eit lite skript som du startar på datamaskina når du treng det, i same ånd som ein lokal webtenar.
Ho lyttar berre på di eiga datamaskin (127.0.0.1), krev eit token som blir vist i vindauget og er skriveverna om
du ikkje startar henne med skriving tillaten. Appen hentar tabellar gjennom brua; ingenting forlèt datamaskina.

### Starte brua

- **Windows**: opne PowerShell i mappa til appen og køyr `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  Brua snakkar ODBC, OLE DB og SqlClient og når dermed Access (mdb og accdb via Microsoft ACE), Excel, SQL
  Server (òg LocalDB og Express), Oracle, PostgreSQL, MySQL/MariaDB, Paradox, dBase og alle ODBC-datakjelder
  (DSN) på datamaskina. Ingen administratorrettar trengst.
- **macOS og Linux** (og Windows utan PowerShell): `python tools/db_bridge.py` (Python 3, standardbiblioteket).
  SQLite-filer verkar alltid; med `pyodbc` installert (`pip install pyodbc`) òg ODBC-kjelder.

Vindauget viser adressa (`http://127.0.0.1:<port>/`) og tokenet. Val: `-Port` eller `--port` vel port,
`-AllowWrite` eller `--allow-write` tillèt endringar, `-MaxRows` eller `--max-rows` avgrensar talet på rader per
henting (standard 100 000), og `-AllowOrigins` eller `--allow-origin` oppgjev kva appadresser som får kalle
brua. Ei side opna frå mappa har opphavet `null`, som er tillate, i likskap med `localhost` og adressa til appen
på GitHub Pages. Lukk vindauget, eller trykk Ctrl+C, for å stoppe.

### Bruke brua i appen

1. Vel *Database via brua* under *Databasar* i Hent, lim inn adressa og tokenet og trykk på **Kople til**.
   Tokenet gjeld for sesjonen; *Lagre kryptert* lagrar det med same passfrase som API-nøklane.
2. Skildra kjelda: Access- eller Excel-fil (sti på datamaskina), SQL Server (tenar, database og brukar, eller
   Windows-pålogging), ODBC-datakjelde (vel blant DSN-ane på datamaskina) eller ein tilkoplingsstreng. Trykk på
   **Hent tabellar**.
3. Vel ein tabell, sjå dei første hundre radene og trykk på **Importer**. Kolonnetypane kjem frå databasen.
4. **Eigen SQL** køyrer ei spørjing i den eigne dialekten til databasen og importerer resultatet. SELECT blir vist direkte; andre
   setningar krev at brua er starta med skriving tillaten, og blir godkjende éi om gongen i ein dialog som viser
   setninga.

Importerte datasett hugsar kjelda: *Oppdater* i Handter, eller *Lagra hentingar* i Hent, hentar tabellen
eller spørjinga på nytt og spelar av oppskrifta. Passord blir aldri lagra med datasettet; etter ein omstart ber
appen deg opne kjelda igjen før ho blir oppdatert. Fana SQL i Analyser kan køyre direkte mot kjelda som sist vart
opna i brua (*Køyr mot*).

### Tryggleik

- Brua svarar berre på 127.0.0.1, krev token i kvart kall og tillèt CORS berre for dei eigne adressene til appen.
- Skriveverna som standard: berre SELECT slepp gjennom. Med skriving tillaten krevst likevel godkjenninga di
  per setning; brua svarar 428 til appen sender godkjenninga.
- Brua loggar dei siste kalla (`GET /log`) og stoppar når vindauget blir lukka.
- Token og passord blir berre lagra i sesjonen eller kryptert med passfrase, aldri i klartekst og aldri i delte
  konfigurasjonar.

### Feilsøking

- *Provider cannot be found*: installer Microsoft Access Database Engine (ACE) i 64-bitsversjon, eller bruk ein
  ODBC-DSN med 64-bitsdrivar. Brua er 64-bits når PowerShell er det.
- *Feil eller manglande token*: kopier tokenet frå vindauget til brua igjen; det blir bytt ved kvar start om du ikkje
  oppgjev `-Token`.
- *Brua svarar ikkje*: kontroller at vindauget er ope og at adressa stemmer; prøv ein annan port.
- Køyrepolicy: skriptet blir starta med `-ExecutionPolicy Bypass`, akkurat som testverktøya til appen, så ingen
  innstillingar må endrast.
- IT-avdelinga kan gå gjennom skriptet (`tools/db-bridge.ps1`, rundt 200 linjer) og starte det med fast port og token.

## Databasekjelder over HTTP

Valet **Databasekjelde** under *Legg til kjelder* i Hent lagar ei vanleg API-kjelde av ei adresse og ein
nøkkel. Appen spør tenesta etter tabellane (skjemaoppdaging) og legg til eitt endepunkt per tabell pluss eit
generelt der du oppgjev tabellen sjølv. Kjelda fungerer deretter som dei førehandsinnstilte API-a: parametrar,
førehandsvising, sider som blir følgde automatisk og lagra hentingar som blir oppdaterte med eitt klikk.

| Familie | Autentisering | Oppdaging | Henting | CORS |
|---|---|---|---|---|
| PostgREST / Supabase | `apikey`-hovud (valfritt) | OpenAPI-rota | `select`, `order`, filter per linje; sider med `limit`/`offset` | Tillate som standard |
| OData v4 | Basic (valfritt) | Tenestedokumentet | `$select`, `$filter`, `$orderby`, `$top`; `@odata.nextLink` blir følgd | Avheng av tenesta |
| GraphQL | Bearer (valfritt) | Inga | Du skriv spørjinga; første liste under `data` blir tabellen | Avheng av tenaren |
| CouchDB | Basic (valfritt) | `_all_dbs` | `_all_docs` med dokumenta; `skip`/`limit` | Blir slått på i CouchDB |
| ClickHouse | Basic (valfritt) | `SHOW TABLES` | SQL per tabell med `FORMAT JSON`; `add_http_cors_header=1` blir sendt | Via innstillinga |
| Elasticsearch / OpenSearch | API-nøkkel (valfritt) | `_cat/indices` | `_search` med `q`; `from`/`size`, høgst 10 000 treff | `http.cors.*` |
| SPARQL | Inga | Inga | Spørjinga som parameter; variablane blir kolonnar | Offentlege endepunkt tillèt |
| InfluxDB v2 | Token | Bøtter | Flux-spørjing; annotert CSV | Kontroller tenaren |
| Google Sheets | Inga | Inga | Publisert eller lenkjedelt ark som CSV | Google |
| Airtable | Personleg token | Metadata-API | Postar med `offset`; felta blir kolonnar | Tillate |

CORS tyder at tenaren til databasen må tillate kall frå nettlesaren. Ei side opna frå mappa sender opphavet `null`;
i tenarmodus adressa til appen. Korleis det blir slått på, står i den einskilde dokumentasjonen (lenkje i dialogen). Kan
tenaren ikkje endrast, står proxyinnstillinga att (sjå [api-konfiguration.md](api-konfiguration.md)) eller brua
via ODBC.

Nøklar og passord blir i sesjonen eller lagra kryptert; konfigurasjonen som blir oppretta, kan eksporterast og delast
utan dei. Svarformata `graphql`, `sparql` og `influx-csv` og dessutan `lift` (lyfte eit nøsta objekt opp til kolonnar)
er skildra i [api-konfiguration.md](api-konfiguration.md) og kan brukast i eigne konfigurasjonar.

### Neo4j over Bolt

Valet **Neo4j** under *Legg til kjelder* (familien **Neo4j (Bolt)**, som òg finst i *Databasekjelde*) koplar til Neo4j Aura eller ein eigen tenar med drivaren frå Neo4j over
WebSocket (`neo4j+s://…`, database, brukarnamn og passord; passordet blir aldri lagra i klartekst). Kjelda opnar ein
Cypher-editor: resultatet blir ein tabell, eller eit grafdatasett når svaret inneheld nodar og relasjonar; spørjingar
kan lagrast på kjelda. Tilkoplinga krev samtykke (føremålet Neo4j) og er ikkje omfatta av CORS; ein eigen tenar utan TLS
(`bolt://`) blir berre nådd frå ei side over http://. Sjå [grafer.md](grafer.md#neo4j-som-kjelde).

### OpenCDE-tenar (BCF og Documents API)

Valet **OpenCDE** under *Legg til kjelder* (familien **OpenCDE (BCF, Documents)**, som òg finst i *Databasekjelde*) koplar til ein tenar som følgjer OpenCDE-API-a frå
buildingSMART, til dømes [Dataregium](https://github.com/marwiss/Dataregium). Oppgje adressa til tenaren og klient-id-en
som administratoren av tenaren har registrert for Dataspatium (ein offentleg klient med omdirigeringsadressa
`http://127.0.0.1:8080/oauth-callback.html`, eller tilsvarande for adressa appen blir servert frå). Kjelda opnar ei vising
der du loggar inn på tenaren (OAuth2 med PKCE i eit popup-vindauge; frå file:// limer du inn adressa du endar på etter
innlogginga), vel prosjekt og hentar saker, kommentarar, viewpoint-komponentar (eitt IFC-element per rad), hendingar
og filer som tabellar. *Hent dokument* opnar den eigne sida til tenaren for dokumentval (Documents API); dei valde filene
blir henta og importerte som om du hadde sleppt dei i appen, så ein IFC-modell blir eit modelldatasett. Tilgangstokens
finst berre i sesjonen og blir aldri eksporterte med kjelda. Tilkoplinga krev samtykke (føremålet OpenCDE-tenar) og at
tenaren tillèt kall frå nettlesaren (CORS).

Appen snakkar BCF API 3.0 og 2.1. Han vel den nyaste versjonen tenaren tilbyr, og ein tenar med berre 2.1 verkar òg: ein slik tenar manglar ofte
Foundation API og Documents API, så appen les versjonen frå `/bcf/versions` og innloggingsadressene frå `/bcf/2.1/auth` og utelèt *Hent dokument*.
Under *Fleire alternativ* i dialogen kan du velje versjon sjølv, og tilbyr tenaren fleire, kan du byte i visinga til kjelda. I 2.1 viser *Filer i prosjektet*
berre BCF-dokumenta, saker har ikkje løpenummeret til tenaren, og eit viewpoint kan ikkje slettast. Til gjengjeld kan ein kommentar vere svar på ein annan:
knappen *Svar* i panelet *Saker*.

Kortet *Medlemmene i prosjektet* vert vist når tenaren har prosjektadministrasjon (ei Dataregium-utviding). Den ansvarlege i
prosjektet (manager), som ikkje treng å vere tenaradministrator, loggar inn med *Logg inn som prosjektansvarleg* og ser prosjekta sine
og medlemmene med rolle: lesar, bidragsytar, redaktør eller prosjektansvarleg. Du legg til ein person med det nøyaktige brukarnamnet på
tenaren, endrar ei rolle, fjernar eit medlem og gjev prosjektet nytt namn; kvar endring vert stadfesta først. Tenaren lèt ikkje
prosjektet stå utan prosjektansvarleg og seier frå; prosjekt vert ikkje sletta herifrå, og nye kontoar opprettar ein administrator.

Saker blir henta i sider på 500. Ei liste som tenaren har korta av (Dataregium kortar av ved 1 000 postar), blir lesen til
endes gjennom Link-headeren til tenaren med rel="next", men berre på same tenar, slik at tokenet ditt aldri går andre stader.

Kortet *IFC-LPG* blir vist når tenaren har ein graf, sjå [grafer.md](grafer.md#ifc-lpg-på-ein-dataregium-tenar).

Under *Filer i prosjektet* listar kjelda modellane og dokumenta tenaren har for prosjektet. *Hent* lagar eit datasett av
det eige slaget til fila, så ei IFC-fil blir ein modell og ei CSV-fil ein tabell, og datasettet hugsar kva tenar, kva prosjekt
og kva versjon det kom frå. I Handter viser kortet *Frå CDE* dette, og *Søk ny versjon* spør tenaren om dokumentet
har ein nyare versjon; han blir då henta som eit eige datasett ved sida av det gamle. Kjelda seier òg kva du får gjere i
prosjektet, til dømes opprette saker eller laste opp dokument. Når kjelda blir oppretta, spør dialogen tenaren kvar ein
loggar inn; svarar ikkje tenaren då, spør appen igjen ved første innlogging.

Medan tenaren si eiga side er open i eit popup-vindauge (innlogging, val av dokument, opplasting), viser appen knappen *Avbryt*, så du kan slutte å vente om vindauget vart lukka eller kom bort.

Tillèt tenaren det, registrerer appen seg sjølv som klient når du lèt klient-id stå tom, så ingen administrator treng å
dele ut noko. Datasett kan òg gå tilbake til tenaren: fana *Til CDE* i Del sender eit datasett i eit valfritt format, eller
originalfila, til eit prosjekt, anten gjennom Documents API, der den eigne sida til tenaren spør om tittel og versjon, eller som
BCF-dokument. Eit datasett henta frå tenaren kan sendast som ein ny versjon av dokumentet sitt.

For IFC-grafen i Dataregium finst startkode i visinga: modellane i grafen og den siste ferdige per dokument, bygningsdelar per klasse, GTIN for veggene, saker per status,
saker og bygningsdelane deira, saker som gjeld ein bygningsdel, og ein graf av saker, viewpoints og komponentar. Vel ei spørjing,
endre og køyr. Det føreset at den som driftar tenaren har gjort Bolt tilgjengeleg; utviklingsstakken gjer det, ein
produksjonstenar gjer det sjeldan.

Ein arbeidsområdepakke kan òg gå gjennom tenaren: fana *Til CDE* sender han som dokument, og kortet med filene i prosjektet viser
knappen *Ta imot* for pakkefiler, som tek imot pakken akkurat som når fila blir sleppt i Hent.

Kortet *Logg* nedst i visinga til kjelda viser alt appen har sendt til tenaren i sesjonen: tid, metode, API (Foundation, BCF
eller Documents) og operasjon etter spesifikasjonen, status og tid. Eit klikk på ei rad viser hovuda (tokens og informasjonskapslar
gøymde), ei forklaring av kva operasjonen gjer med lenkje til spesifikasjonen, og knappen *Kopier som curl*. Slå på *Lagre innhald*
for òg å sjå innhaldet i førespurnaden og svaret (tekst, høgst 64 kB; aldri token-kall). Loggen finst berre i minnet og blir
aldri send; han kan lagrast som JSON eller som eit datasett. Appen set hovudet X-Request-Id på kvart kall, så den eigne loggen til tenaren kan
parast med loggen i appen; avviser ein tenar hovudet, blir det slått av for den kjelda.

Tenarsida er skildra i dokumentasjonen til Dataregium: [client-guide.md](https://github.com/marwiss/Dataregium/blob/main/docs/nn/client-guide.md) (korleis ein klient koplar seg til) og [deploy/local.md](https://github.com/marwiss/Dataregium/blob/main/docs/nn/deploy/local.md) (utviklingsstakken og korleis appen blir testa mot han).

Dataregium skildrar tillegga sine i `GET /.well-known/dataregium`; appen les dokumentet når kjelda blir opna og skriv under
overskrifta kva tenar det er og kva tillegg han har (sjølvregistrering, førespurnadslogg, administrasjon, IFC-LPG,
grafspørjingar). Ein tenar utan dokumentet har ingen tillegg, og alt etter spesifikasjonane fungerer likevel. Feilkodane til tenaren
(`code` i svaret, til dømes `reauthentication_required`) blir viste på ditt språk; ukjende kodar viser den eigne teksten til tenaren. Lenkja
*Opne i Dataspatium* på sidene til tenaren har forma `index.html#/inhamta/opencde?server=https://…` og opnar dialogen for ei ny kjelde
med adressa utfylt. Finst tenaren alt som kjelde, blir han opna direkte. Lenkja kan òg peike ut eit prosjekt og eit dokument
(`&project=…&document=…&version=…`): prosjektet blir valt og dokumentet henta som datasett når du er innlogga. Sider som Dataregium
opnar i popup (innlogging, opplasting, val av dokument), blir viste på språket til appen.

**Administrasjon.** Er du administrator på ein Dataregium-tenar, viser visinga til kjelda kortet *Administrasjon* (når kapabilitetsdokumentet til tenaren seier at administrasjons-API-et er på). Knappen *Logg inn som administrator* ber om retten `admin`; deretter finst fanene Oversyn, Brukarar (opprett, endre, deaktiver, still passordet tilbake, slett), Prosjekt (opprett, gje nytt namn, medlemmer og roller, slett), Klientar (registrer, endre, roter løyndom, kall tilbake token, slett), Sesjonar (avslutt éin eller alle for ein brukar), Revisjon, Innstillingar og Helse, og dessutan Grafspørjing når tenaren tillèt lesande Cypher mot IFC-grafen. Farlege handlingar krev ei fersk innlogging: tenaren svarar `reauthentication_required`, appen opnar innlogginga igjen og gjer kallet om att. Eingangsverdiar (eit første passord, ein klientløyndom) blir viste éin gong med knappen Kopier og aldri skrivne i loggen. Kvar liste kan lagrast som datasett og hentast igjen frå Handter.

## Opne geodata

Dialogen for *Geodatakjelde* under *Legg til kjelder* byrjar med ei liste over **ferdige geodatakjelder**: opne WFS-, OGC API Features- og
ArcGIS-tenester frå nordiske etatar og kommunar (SCB, SGU, Naturvårdsverket, SLU Artdatabanken, Riksantikvarieämbetet, Skogsstyrelsen,
Kartverket, Miljødirektoratet, Riksantikvaren, Statistikcentralen, SYKE, Helsingfors, Väylävirasto, Danmarks
Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands med fleire), alle kontrollerte å verke frå
nettlesaren. Ei førehandsinnstilt kjelde blir opna, dei andre blir lagde til med eitt klikk, og laga blir lesne frå tenesta;
filtrer på namn, land eller innhald. Lista ligg i `presets/geodata/services.json`. Under lista finst felta for ei
eiga teneste. Planbestämmelsekatalogen frå Boverket finst som vanleg API-kjelde (*Boverket Planbestämmelsekatalogen*), sjå
[planer.md](planer.md).

Tre kjelder hentar planar: *Plandata.dk (WFS)* og *Skipulagsstofnun skipulagsgögn (ArcGIS)* har knappen **Hent plan**,
som les ein heil lokalplan og eit deiliskipulag (alle lag) med nummeret til planen og lagrar han som plan, og
*Ryhti kaavatiedot (OGC API Features)* gjev planindeksen i Finland. Sjå [planer.md](planer.md#planar-frå-dei-andre-nordiske-landa).

Valet **Geodatakjelde** under *Legg til kjelder* i Hent gjer ei vanleg API-kjelde av adressa til ei geodatateneste,
på same måte som databasekjeldene. Appen les laga til tenesta og legg eit endepunkt per lag pluss eit allment der du
oppgjev laget sjølv. Svara er GeoJSON i WGS 84: datasettet får ein geometrikolonne og blir opna som kart i Bearbeid (sjå
[kartor.md](kartor.md)). Kjelda viser laga som ei liste som kan filtrerast; vel eit lag, avgrens gjerne med eit område
(bbox) og hent. Førehandsvisinga viser svaret som eit lite kart over tabellen, og *Opne som kart* tek deg til det lagra
datasettet.

| Familie | Oppdaging | Henting | Nøkkel |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, Deegree) | GetCapabilities | GetFeature med `outputFormat=application/json` og `srsName=EPSG:4326`; område (bbox), CQL-filter, kolonnar; sider med `startIndex`/`count` | Bearer (valfritt) |
| OGC API Features | `/collections` | `/collections/{id}/items` med bbox, datetime og filter; next-lenkjer blir følgde | Bearer (valfritt; kravd av geodataplattforma til Lantmäteriet) |
| ArcGIS REST (FeatureServer, MapServer) | Skildringa av tenesta eller heile katalogen | `/{lag}/query` med where, område, `f=geojson` og `outSR=4326`; sider med `resultOffset` | Token (valfritt) |

Førehandsinnstilte geodatakjelder utan nøkkel (CORS verifisert): SCB opne geodata, SGU, Havs- och vattenmyndigheten,
kulturminna til Riksantikvarieämbetet, Skogsstyrelsen, dei administrative einingane og eigedomskartet frå Kartverket (Noreg) og dessutan
Statistikcentralen og SYKE (Finland). Laga blir lesne frå tenesta første gongen kjelda blir opna og kan lesast på nytt med *Les
laga på nytt*; lista blir lagra i din kopi av kjelda. Geodataplattforma til Lantmäteriet (reguleringsplanar, bygningar, strandvern, kulturhistoriske leivningar og grensa for fjellnær skog) finst som nivå 2
med Bearer-nøkkel frå ein tilknytt organisasjon.

**Trafikverkets NVDB** (*Trafikverket NVDB: vegdata*) gjev 45 objekttypar frå den svenske nasjonale vegdatabasen, som
fartsgrenser, vegnummer, bereevne, tal på køyrefelt, gatenamn, kryss og rasteplassar, med eitt endepunkt per objekttype. Han
krev ein gratis nøkkel frå [data.trafikverket.se](https://data.trafikverket.se/), som blir send i kroppen i førespurnaden og
aldri i adressa. Gje området i WGS 84 som for dei andre kjeldene; appen reknar det om til SWEREF 99 TM, og utan område blir
heile landet henta. Svara blir lesne i sider på 5 000 objekt, og geometrien blir rekna om til WGS 84 slik at datasettet blir
opna som kart. Dataa er CC0.

**Geodataportalen** (geodata.se) er den nasjonale katalogen i Sverige over geodata frå etatar, regionar og kommunar. Kjelda
*Geodataportalen (sök geodata)* søkjer i katalogen og viser ein post per treff med tittel, organisasjon, skildring og
tenester: ei WFS-, OGC API- eller ArcGIS-teneste blir lagd til som geodatakjelde med eitt klikk og opna straks, ei
WMS-adresse blir kopiert for bruk som bakgrunnskart eller WMS-lag i ei kartvising, og nedlastingsfiler og metadata blir opna i
ei ny fane. Trefflista kan òg hentast som tabell under fana *Endepunkt*.

Geodatatenester svarar ofte med mange objekt: avgrens med eit område eller eit filter, og hev *Høgste tal på sider*
under *Fleire val* berre når det trengst. Ei eiga teneste må tillate kall frå nettlesaren (CORS) på same måte som
databasekjeldene; GeoServer og ArcGIS Server hos dei fleste etatane gjer det.

## Lenkja filer

I Chrome og Edge finst knappen **Lenk ei fil på datamaskina** i Hent. Fila blir vald med filveljaren på datamaskina
og importert som vanleg, men datasettet held på ei lenkje til fila: **Oppdater frå disken** i Handter
les fila igjen med same innstillingar, byter ut radene og spelar av oppskrifta (opprydding, nye kolonnar og
koplingar blir gjorde om). Nettlesaren kan be om løyve til å lese fila igjen etter ein omstart. Firefox manglar
funksjonen; der importerer du fila på nytt. Format som blir lesne via R (SPSS, Stata, SAS, PX, RDS, Parquet), kan
ikkje lenkjast.

## WebSocket

Appen har ein tilkoplingsmåte for WebSocket (samtykke per føremål, JSON-rammer, spørjing og svar para på id). Han er tenkt for strøymande API; ingen førehandsinnstillingar brukar han enno. Neo4j går over Bolt med sin eigen drivar.

## Avgrensingar

- Brua køyrer på datamaskina der appen blir brukt; fjerndatabasar blir nådde via drivarar eller DSN-ar på den datamaskina.
- Høgst 100 000 rader per henting gjennom brua om ikkje `-MaxRows` blir auka; store tabellar blir best avgrensa med SQL.
- Access-filer i nettlesaren: ingen spørjingar, lenkja tabellar eller passord; svært store filer tek minne.
- Elasticsearch gjev høgst 10 000 treff per søk (`from` + `size`).
- Alle HTTP-kjelder krev CORS; det kan ikkje omgåast frå nettlesaren.
