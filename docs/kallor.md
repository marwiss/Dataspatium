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

### Neo4j över Bolt

Familjen **Neo4j (Bolt)** i *Lägg till databaskälla* ansluter till Neo4j Aura eller en egen server med Neo4j:s
drivrutin över WebSocket (`neo4j+s://…`, databas, användarnamn och lösenord; lösenordet sparas aldrig i klartext). Källan
öppnar en Cypher-redigerare: resultatet blir en tabell, eller en grafdatamängd när svaret innehåller noder och
relationer; frågor kan sparas på källan. Anslutningen kräver samtycke (ändamålet Neo4j) och omfattas inte av CORS; en
egen server utan TLS (`bolt://`) nås bara från en sida över http://. Se [grafer.md](grafer.md#neo4j-som-källa).

### OpenCDE-server (BCF och Documents API)

Familjen **OpenCDE (BCF, Documents)** i *Lägg till databaskälla* ansluter till en server som följer buildingSMARTs
OpenCDE-API:er, till exempel [Kontroll](https://github.com/marwiss/Kontroll). Ange serverns adress och det klient-id som
serverns administratör har registrerat för Dataspatium (en publik klient med omdirigeringsadressen
`http://127.0.0.1:8080/oauth-callback.html`, eller motsvarande för den adress appen servas på). Källan öppnar en vy där
du loggar in på servern (OAuth2 med PKCE i ett popup-fönster; från file:// klistrar du in adressen du hamnar på efter
inloggningen), väljer projekt och hämtar ärenden, kommentarer, viewpoint-komponenter (ett IFC-element per rad), händelser
och filer som tabeller. *Hämta dokument* öppnar serverns egen sida för dokumentval (Documents API); de valda filerna
hämtas och importeras som om du släppt dem i appen, så en IFC-modell blir en modelldatamängd. Åtkomsttoken finns bara i
sessionen och exporteras aldrig med källan. Anslutningen kräver samtycke (ändamålet OpenCDE-server) och att servern
tillåter anrop från webbläsaren (CORS).

Under *Filer i projektet* listar källan de modeller och dokument som servern har för projektet. *Hämta* gör en datamängd av
filens eget slag, så en IFC-fil blir en modell och en CSV-fil en tabell, och datamängden minns vilken server, vilket projekt
och vilken version den kom från. I Hantera visar kortet *Från CDE* detta, och *Sök ny version* frågar servern om dokumentet
har en nyare version; den hämtas då som en egen datamängd bredvid den gamla. Källan säger också vad du får göra i projektet,
till exempel skapa ärenden eller ladda upp dokument. När källan skapas frågar dialogen servern var man loggar in; svarar
servern inte då, frågar appen igen vid första inloggningen.

Tillåter servern det, registrerar appen sig själv som klient när du lämnar klient-id tomt, så ingen administratör behöver
dela ut något. Datamängder kan också gå tillbaka till servern: fliken *Till CDE* i Dela skickar en datamängd i valfritt format,
eller originalfilen, till ett projekt, antingen genom Documents API, där serverns egen sida frågar efter titel och version,
eller som BCF-dokument. En datamängd som hämtats från servern kan skickas som en ny version av sitt dokument.

För Kontrolls IFC-graf finns startkod i vyn: modellerna i grafen och den senaste färdiga per dokument, byggdelar per klass, väggarnas GTIN, ärenden per status,
ärenden och deras byggdelar, ärenden som rör en byggdel och en graf av ärenden, viewpoints och komponenter. Välj en fråga, ändra
och kör. Det förutsätter att den som driver servern har gjort Bolt åtkomlig; utvecklingsstacken gör det, en produktionsserver
gör det sällan.

Ett arbetsytepaket kan också gå genom servern: fliken *Till CDE* skickar det som dokument, och kortet med projektets filer visar
knappen *Ta emot* för paketfiler, som tar emot paketet precis som när filen släpps i Inhämta.

Kortet *Logg* längst ned i källans vy visar allt appen skickat till servern under sessionen: tid, metod, API (Foundation,
BCF eller Documents) och operation enligt specifikationen, status och tid. Ett klick på en rad visar rubrikerna (tokens och kakor
dolda), en förklaring av vad operationen gör med länk till specifikationen, och knappen *Kopiera som curl*. Slå på *Spara kroppar*
för att även se begärans och svarets innehåll (text, högst 64 kB; aldrig token-anrop). Loggen finns bara i minnet och skickas
aldrig; den kan sparas som JSON eller som en datamängd. Appen sätter rubriken X-Request-Id på varje anrop så att serverns egen
logg kan paras ihop med appens; nekar en server rubriken stängs den av för den källan.

Serverns sida beskrivs i Kontrolls dokumentation: [client-guide.md](https://github.com/marwiss/Kontroll/blob/main/docs/client-guide.md) (hur en klient ansluter), [acceptance.md](https://github.com/marwiss/Kontroll/blob/main/docs/acceptance.md) (parets provkörningar) och [deploy/local.md](https://github.com/marwiss/Kontroll/blob/main/docs/deploy/local.md) (utvecklingsstacken och hur appen provas mot den).

Kontroll beskriver sina tillägg i `GET /.well-known/kontroll`; appen läser dokumentet när källan öppnas och skriver under rubriken
vilken server det är och vilka tillägg den har (självregistrering, begärandelogg, administration, IFC-graf, graffrågor). En server
utan dokumentet har inga tillägg, och allt enligt specifikationerna fungerar ändå. Serverns felkoder (`code` i svaret, till exempel
`reauthentication_required`) visas på ditt språk; okända koder visar serverns egen text. Länken *Öppna i Dataspatium* på serverns
sidor har formen `index.html#/inhamta/opencde?server=https://…` och öppnar dialogen för en ny källa med adressen ifylld. Finns servern redan som källa öppnas den direkt. Länken kan också peka ut ett projekt och ett dokument
(`&project=…&document=…&version=…`): projektet väljs och dokumentet hämtas som datamängd när du är inloggad. Sidor som Kontroll
öppnar i popup (inloggning, uppladdning, val av dokument) visas på appens språk.

## Öppna geodata

Dialogen *Lägg till geodatakälla* börjar med en lista över **färdiga geodatakällor**: öppna WFS-, OGC API Features-
och ArcGIS-tjänster från nordiska myndigheter och kommuner (SCB, SGU, Naturvårdsverket, Riksantikvarieämbetet,
Skogsstyrelsen, Kartverket, Miljødirektoratet, Riksantikvaren, Statistikcentralen, SYKE, Helsingfors, Väylävirasto,
Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands med flera), alla kontrollerade att
fungera från webbläsaren. En förinställd källa öppnas, övriga läggs till med ett klick och lagren läses från
tjänsten; filtrera på namn, land eller innehåll. Listan ligger i `presets/geodata/services.json`. Under listan finns

Tre källor hämtar planer: *Plandata.dk (WFS)* och *Skipulagsstofnun skipulagsgögn (ArcGIS)* har knappen **Hämta plan**
som läser en hel lokalplan respektive ett deiliskipulag (alla lager) med planens nummer och sparar den som plan, och
*Ryhti kaavatiedot (OGC API Features)* ger Finlands planindex. Se [planer.md](planer.md#planer-från-andra-nordiska-länder).
fälten för en egen tjänst. Boverkets Planbestämmelsekatalog finns som vanlig API-källa (*Boverket
Planbestämmelsekatalogen*), se [planer.md](planer.md).

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
