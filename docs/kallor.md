# Källor: databaser, bryggan och länkade filer

Förutom filer, inklistrad text, webbadresser och de förinställda öppna API:erna (se
[api-konfiguration.md](api-konfiguration.md)) kan Dataspatium hämta data från databaser på tre sätt:
**Access-filer** läses direkt i webbläsaren, **databaser på den egna datorn eller i nätverket** nås genom en liten
lokal brygga, och **databastjänster över HTTP** (PostgREST, OData, GraphQL med flera) blir vanliga källor i
Inhämta. Filer som valts med datorns filväljare kan dessutom **länkas**, så att datamängden läses in igen från
disken med ett klick. Allt sker i webbläsaren; inget skickas någon annanstans än till den databas du själv anger.

## Access-filer (mdb, accdb)

Släpp filen på ytan i Inhämta som vilken fil som helst. Filen läses av mdb-reader direkt i webbläsaren, utan att
Access behöver finnas på datorn: tabellerna listas i steget *Inställningar*, du väljer en och får kolumnerna med de
typer Access anger (text, tal, datum, ja/nej). Frågor (queries), länkade tabeller och lösenordsskyddade filer kan
inte läsas på det här sättet; använd då bryggan nedan. dBase-filer (.dbf) läses via kalkylbladsimporten.

## Databasbryggan

Bryggan är ett litet skript som du startar på datorn när du behöver det, i samma anda som en lokal webbserver. Den
lyssnar bara på den egna datorn (127.0.0.1), kräver en token som visas i fönstret och är skrivskyddad om du inte
startar den med skrivning tillåten. Appen hämtar tabeller genom bryggan; inget lämnar datorn.

### Starta bryggan

- **Windows**: öppna PowerShell i appens mapp och kör `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  Bryggan talar ODBC, OLE DB och SqlClient och når därmed Access (mdb och accdb via Microsoft ACE), Excel, SQL
  Server (även LocalDB och Express), Oracle, PostgreSQL, MySQL/MariaDB, Paradox, dBase och alla ODBC-datakällor
  (DSN) som finns på datorn. Inga administratörsrättigheter behövs.
- **macOS och Linux** (och Windows utan PowerShell): `python tools/db_bridge.py` (Python 3, standardbiblioteket).
  SQLite-filer går alltid; med `pyodbc` installerat (`pip install pyodbc`) även ODBC-källor.

Fönstret visar adressen (`http://127.0.0.1:<port>/`) och token. Tillval: `-Port` respektive `--port` väljer port,
`-AllowWrite` respektive `--allow-write` tillåter ändringar, `-MaxRows` respektive `--max-rows` begränsar antalet
rader per hämtning (standard 100 000) och `-AllowOrigins` respektive `--allow-origin` anger vilka appadresser som
får anropa bryggan. En sida öppnad från mappen har ursprunget `null`, som är tillåtet, liksom `localhost` och
appens adress på GitHub Pages. Stäng fönstret, eller tryck Ctrl+C, för att stoppa.

### Använda bryggan i appen

1. Välj *Databas via bryggan* under *Databaser* i Inhämta, klistra in adressen och token och tryck på **Anslut**.
   Token gäller för sessionen; *Spara krypterat* lagrar den med samma lösenfras som API-nycklarna.
2. Beskriv källan: Access- eller Excel-fil (sökväg på datorn), SQL Server (server, databas och användare, eller
   Windows-inloggning), ODBC-datakälla (välj bland datorns DSN) eller en anslutningssträng. Tryck på
   **Hämta tabeller**.
3. Välj en tabell, se de första hundra raderna och tryck på **Importera**. Kolumntyperna kommer från databasen.
4. **Egen SQL** kör en fråga i databasens egen dialekt och importerar resultatet. SELECT visas direkt; andra satser
   kräver att bryggan startats med skrivning tillåten och godkänns en i taget i en dialog som visar satsen.

Importerade datamängder minns källan: *Uppdatera* i Hantera, eller *Sparade hämtningar* i Inhämta, hämtar om
tabellen eller frågan och spelar upp receptet. Lösenord sparas aldrig med datamängden; efter en omstart ber appen
dig öppna källan igen innan den uppdateras. Fliken SQL i Analysera kan köra direkt mot den källa som senast
öppnades i bryggan (*Kör mot*).

### Säkerhet

- Bryggan svarar bara på 127.0.0.1, kräver token i varje anrop och tillåter CORS bara för appens egna adresser.
- Skrivskyddad som standard: bara SELECT släpps igenom. Med skrivning tillåten krävs ändå ditt godkännande per
  sats; bryggan svarar 428 tills appen skickar godkännandet.
- Bryggan loggar de senaste anropen (`GET /log`) och stannar när fönstret stängs.
- Token och lösenord lagras bara i sessionen eller krypterat med lösenfras, aldrig i klartext och aldrig i delade
  konfigurationer.

### Felsökning

- *Provider cannot be found* eller *Dataleverantören hittades inte*: installera Microsoft Access Database Engine
  (ACE) i 64-bitarsversion, eller använd ett ODBC-DSN med 64-bitarsdrivrutin. Bryggan är 64-bitars när PowerShell är det.
- *Fel eller saknad token*: kopiera token från bryggans fönster igen; den byts vid varje start om du inte anger `-Token`.
- *Bryggan svarar inte*: kontrollera att fönstret är öppet och att adressen stämmer; prova en annan port.
- Körpolicy: skriptet startas med `-ExecutionPolicy Bypass`, precis som appens testverktyg, så inga inställningar
  behöver ändras.
- IT-avdelningen kan granska skriptet (`tools/db-bridge.ps1`, omkring 200 rader) och starta det med fast port och token.

## Databaskällor över HTTP

Knappen **Lägg till databaskälla** under *Databaser* i Inhämta skapar en vanlig API-källa av en adress och en
nyckel. Appen frågar tjänsten efter dess tabeller (schemaupptäckt) och lägger en ändpunkt per tabell plus en allmän
där du anger tabellen själv. Källan fungerar sedan som de förinställda API:erna: parametrar, förhandsgranskning,
sidor som följs automatiskt och sparade hämtningar som uppdateras med ett klick.

| Familj | Autentisering | Upptäckt | Hämtning | CORS |
|---|---|---|---|---|
| PostgREST / Supabase | `apikey`-huvud (valfritt) | OpenAPI-roten | `select`, `order`, filter per rad; sidor med `limit`/`offset` | Tillåtet som standard |
| OData v4 | Basic (valfritt) | Tjänstedokumentet | `$select`, `$filter`, `$orderby`, `$top`; `@odata.nextLink` följs | Beror på tjänsten |
| GraphQL | Bearer (valfritt) | Ingen | Du skriver frågan; första listan under `data` blir tabellen | Beror på servern |
| CouchDB | Basic (valfritt) | `_all_dbs` | `_all_docs` med dokumenten; `skip`/`limit` | Slås på i CouchDB |
| ClickHouse | Basic (valfritt) | `SHOW TABLES` | SQL per tabell med `FORMAT JSON`; `add_http_cors_header=1` skickas | Via inställningen |
| Elasticsearch / OpenSearch | API-nyckel (valfritt) | `_cat/indices` | `_search` med `q`; `from`/`size`, högst 10 000 träffar | `http.cors.*` |
| SPARQL | Ingen | Ingen | Frågan som parameter; variablerna blir kolumner | Offentliga ändpunkter tillåter |
| InfluxDB v2 | Token | Hinkar | Flux-fråga; kommenterad CSV | Kontrollera servern |
| Google Sheets | Ingen | Ingen | Publicerat eller länkdelat ark som CSV | Google |
| Airtable | Personlig token | Metadata-API | Poster med `offset`; fälten blir kolumner | Tillåtet |

CORS betyder att databasens server måste tillåta anrop från webbläsaren. En sida öppnad från mappen skickar
ursprunget `null`; i serverläge appens adress. Hur det slås på står i respektive dokumentation (länk i dialogen).
Går det inte att ändra på servern återstår proxyinställningen (se [api-konfiguration.md](api-konfiguration.md))
eller bryggan via ODBC.

Nycklar och lösenord stannar i sessionen eller sparas krypterat; konfigurationen som skapas kan exporteras och
delas utan dem. Svarsformaten `graphql`, `sparql` och `influx-csv` samt `lift` (lyfta upp ett nästlat objekt till
kolumner) beskrivs i [api-konfiguration.md](api-konfiguration.md) och kan användas i egna konfigurationer.

## Öppna geodata

Knappen **Lägg till geodatakälla** under *Databaser* i Inhämta gör en vanlig API-källa av adressen till en geodatatjänst,
på samma sätt som databaskällorna. Appen läser tjänstens lager och lägger en ändpunkt per lager plus en allmän där du
anger lagret själv. Svaren är GeoJSON i WGS 84: datamängden får en geometrikolumn och öppnas som karta i Bearbeta (se
[kartor.md](kartor.md)). Källan visar lagren som en lista att filtrera i; välj ett lager, begränsa gärna med ett område
(bbox) och hämta. Förhandsgranskningen visar svaret som en liten karta ovanför tabellen, och *Öppna som karta* tar dig
till den sparade datamängden.

| Familj | Upptäckt | Hämtning | Nyckel |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, Deegree) | GetCapabilities | GetFeature med `outputFormat=application/json` och `srsName=EPSG:4326`; område (bbox), CQL-filter, kolumner; sidor med `startIndex`/`count` | Bearer (valfritt) |
| OGC API Features | `/collections` | `/collections/{id}/items` med bbox, datetime och filter; next-länkar följs | Bearer (valfritt; krävs av Lantmäteriets geodataplattform) |
| ArcGIS REST (FeatureServer, MapServer) | Tjänstens beskrivning eller hela katalogen | `/{lager}/query` med where, område, `f=geojson` och `outSR=4326`; sidor med `resultOffset` | Token (valfritt) |

Förinställda geodatakällor utan nyckel (CORS verifierat): SCB öppna geodata, SGU, Havs- och vattenmyndigheten,
Riksantikvarieämbetets fornlämningar, Skogsstyrelsen, Kartverkets administrativa enheter och fastighetskarta (Norge)
samt Statistikcentralen och SYKE (Finland). Lagren läses från tjänsten första gången källan öppnas och kan läsas om med
*Läs om lagren*; listan sparas i din kopia av källan. Lantmäteriets geodataplattform (detaljplaner) finns som nivå 2 med
Bearer-nyckel från en ansluten organisation. Boverkets digitala planer får egna funktioner i en kommande version.

**Geodataportalen** (geodata.se) är den nationella katalogen över myndigheters, regioners och kommuners geodata. Källan
*Geodataportalen (sök geodata)* söker i katalogen och visar en post per träff med titel, organisation, beskrivning och
tjänster: en WFS-, OGC API- eller ArcGIS-tjänst läggs till som geodatakälla med ett klick och öppnas direkt, en
WMS-adress kopieras för att användas som bakgrundskarta eller WMS-lager i en kartvy, och nedladdningsfiler och metadata
öppnas i en ny flik. Träfflistan kan också hämtas som tabell under fliken *Ändpunkter*.

Geodatatjänster svarar ofta med många objekt: begränsa med ett område eller ett filter, och höj *Högsta antal sidor*
under *Fler alternativ* bara när det behövs. En egen tjänst måste tillåta anrop från webbläsaren (CORS) på samma sätt som
databaskällorna; de flesta myndigheters GeoServer och ArcGIS Server gör det.
## Länkade filer

I Chrome och Edge finns knappen **Länka en fil på datorn** i Inhämta. Filen väljs med datorns filväljare och
importeras som vanligt, men datamängden behåller en länk till filen: **Uppdatera från disken** i Hantera läser
filen igen med samma inställningar, byter ut raderna och spelar upp receptet (rensningar, nya kolumner och
kopplingar görs om). Webbläsaren kan fråga om lov att läsa filen igen efter en omstart. Firefox saknar funktionen;
där importerar du filen på nytt. Format som läses via R (SPSS, Stata, SAS, PX, RDS, Parquet) kan inte länkas.

## WebSocket

Appen har ett anslutningssätt för WebSocket (samtycke per ändamål, JSON-ramar, fråga och svar parade på id). Det
används av kommande källor som Neo4j (Bolt över WebSocket, planerat till 2.9) och strömmande API:er; inga
förinställningar använder det ännu.

## Begränsningar

- Bryggan körs på datorn där appen används; fjärrdatabaser nås via drivrutiner eller DSN på den datorn.
- Högst 100 000 rader per hämtning genom bryggan om inte `-MaxRows` höjs; stora tabeller avgränsas bäst med SQL.
- Access-filer i webbläsaren: inga frågor, länkade tabeller eller lösenord; mycket stora filer tar minne.
- Elasticsearch ger högst 10 000 träffar per sökning (`from` + `size`).
- Alla HTTP-källor kräver CORS; det kan inte kringgås från webbläsaren.
