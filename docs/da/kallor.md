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

Knappen **Tilføj databasekilde** under *Databaser* i Hent laver en almindelig API-kilde af en adresse og en nøgle.
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

## Linkede filer

I Chrome og Edge findes knappen **Link en fil på computeren** i Hent. Filen vælges med computerens filvælger og
importeres som sædvanligt, men datasættet beholder et link til filen: **Opdatér fra disken** i Håndter læser filen
igen med samme indstillinger, udskifter rækkerne og afspiller opskriften (oprydninger, nye kolonner og koblinger
gøres om). Browseren kan bede om lov til at læse filen igen efter en genstart. Firefox mangler funktionen; dér
importerer du filen på ny. Formater, der læses via R (SPSS, Stata, SAS, PX, RDS, Parquet), kan ikke linkes.

## WebSocket

Appen har en forbindelsesmåde for WebSocket (samtykke pr. formål, JSON-rammer, forespørgsel og svar parret på id).
Den bruges af kommende kilder som Neo4j (Bolt over WebSocket, planlagt til 2.9) og strømmende API'er; ingen
forudindstillinger bruger den endnu.

## Begrænsninger

- Broen kører på den computer, hvor appen bruges; fjerndatabaser nås via drivere eller DSN'er på den computer.
- Højst 100.000 rækker pr. hentning gennem broen, medmindre `-MaxRows` hæves; store tabeller afgrænses bedst med SQL.
- Access-filer i browseren: ingen forespørgsler, linkede tabeller eller adgangskoder; meget store filer tager hukommelse.
- Elasticsearch giver højst 10.000 hits pr. søgning (`from` + `size`).
- Alle HTTP-kilder kræver CORS; det kan ikke omgås fra browseren.
