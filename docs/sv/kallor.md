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

### Hämta via bryggan

En tjänst som inte låter webbläsaren läsa sitt svar (ingen CORS) går inte att nå från appen, varken från en mapp eller från
webben. Bryggan kan hämta åt appen i stället. Det är ditt val och av som förval: slå på **Hämta via bryggan** under
*Internetåtkomst* i Hantera, och starta bryggan med de värdar den får hämta från:

```
python tools/db_bridge.py --allow-host api.exempel.se
powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1 -AllowHosts api.exempel.se
```

När en hämtning misslyckas som ett nätverksfel och en brygga är ansluten skickar appen samma begäran till bryggan (`POST
/fetch`), som hämtar den och lämnar tillbaka svaret. Bryggan hämtar bara över https och bara från de värdar du angett; sidan
kan aldrig lägga till någon. Den vägrar adresser som pekar på den egna datorn eller det lokala nätet, skickar bara några få
rubriker och inga kakor, följer högst tre omdirigeringar till tillåtna värdar och stannar vid `--max-fetch-mb` (50 MB som
förval). Bryggans logg visar värden och sökvägen, aldrig frågan, rubrikerna eller kroppen. Samtycket för ändamålet gäller som
förut.
Två förinställningar nås bara så: *Riksbanken räntor och valutakurser (SWEA)* och *Världsbanken: indikatorer*. Källistan
märker dem *Kräver bryggan*; starta bryggan med `--allow-host api.riksbank.se --allow-host api.worldbank.org` för att hämta
från dem.

### Styra appen utifrån

Program på datorn kan köra appens kommandon genom bryggan: samma kommandon som flödena och AI-assistenten använder (läsa
datamängder, åtgärder i Bearbeta, export, R, Python, flöden). Det är av vid varje start och kräver två steg: starta bryggan med
`--allow-commands` (`-AllowCommands`) och slå på **Låt program på datorn styra appen via bryggan** under *Internetåtkomst* i Hantera,
där du bekräftar en gång för sessionen. Kommandon som bara läser körs direkt; allt som ändrar något visas i en dialog med kommandot och
dess argument och körs bara om du godkänner det. Statusraden visar en terminalikon medan styrningen är på.

Kommandoraden `tools/dataspatium.py` (Python 3, standardbiblioteket) använder bryggans adress och token (`--bridge` och `--token`, eller
`DATASPATIUM_BRIDGE` och `DATASPATIUM_TOKEN`):

```
python tools/dataspatium.py list
python tools/dataspatium.py run read_rows --args '{"dataset": "Befolkning", "limit": 5}'
python tools/dataspatium.py plan manadsrapport.json
python tools/dataspatium.py cancel c3-1a2b3c4d
python tools/dataspatium.py mcp
```

`list` visar kommandona med sina parametrar, `run` kör ett och skriver svaret som JSON, `plan` kör en flödesfil (samma form som
*Exportera* under Flöden ger) som en plan du godkänner en gång, och `mcp` gör kommandona till verktyg för ett AI-program på datorn
genom Model Context Protocol (över standardströmmarna). Bryggan håller kön i minnet, och ett kommando väntar på appen tills du
godkänt eller det gått fem minuter.
`cancel` avbryter ett kommando som väntar i kön eller körs i appen (Ctrl+C under `run` gör detsamma), och `POST /commands/<id>/cancel`
är vägen för andra program.
`python tools/check_bridge.py` prövar kön, kommandoraden och MCP utan webbläsare.

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

Valet **Databaskälla** under *Lägg till källor* i Inhämta skapar en vanlig API-källa av en adress och en
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

Valet **Neo4j** under *Lägg till källor* (familjen **Neo4j (Bolt)**, som också finns i *Databaskälla*) ansluter till Neo4j Aura eller en egen server med Neo4j:s
drivrutin över WebSocket (`neo4j+s://…`, databas, användarnamn och lösenord; lösenordet sparas aldrig i klartext). Källan
öppnar en Cypher-redigerare: resultatet blir en tabell, eller en grafdatamängd när svaret innehåller noder och
relationer; frågor kan sparas på källan. Anslutningen kräver samtycke (ändamålet Neo4j) och omfattas inte av CORS; en
egen server utan TLS (`bolt://`) nås bara från en sida över http://. Se [grafer.md](grafer.md#neo4j-som-källa).

### OpenCDE-server (BCF och Documents API)

Valet **OpenCDE** under *Lägg till källor* (familjen **OpenCDE (BCF, Documents)**, som också finns i *Databaskälla*) ansluter till en server som följer buildingSMARTs
OpenCDE-API:er, till exempel [Dataregium](https://github.com/marwiss/Dataregium). Ange serverns adress. Lämna klient-id tomt när servern låter appen registrera sig själv (se nedan), annars det klient-id som
serverns administratör har registrerat för Dataspatium (en publik klient med omdirigeringsadressen
`http://127.0.0.1:8080/oauth-callback.html`, eller motsvarande för den adress appen servas på). Källan öppnar en vy där
du loggar in på servern (OAuth2 med PKCE i ett popup-fönster; från file:// klistrar du in adressen du hamnar på efter
inloggningen), väljer projekt och hämtar ärenden, kommentarer, viewpoint-komponenter (ett IFC-element per rad), händelser
och filer som tabeller. *Hämta dokument* öppnar serverns egen sida för dokumentval (Documents API); de valda filerna
hämtas och importeras som om du släppt dem i appen, så en IFC-modell blir en modelldatamängd. Åtkomsttoken finns bara i
sessionen och exporteras aldrig med källan. Anslutningen kräver samtycke (ändamålet OpenCDE-server) och att servern
tillåter anrop från webbläsaren (CORS).

En **lokal Dataregium** på den egna datorn (serverns on premise-läge, `opencde init --local`) svarar på `http://127.0.0.1:8000`.
Ange den adressen och lämna klient-id tomt: den lokala servern låter appen registrera sig själv, tillåter anrop från appen öppnad från
file:// och från `http://127.0.0.1:8080`, kräver PKCE som vanligt och svarar bara när adressen i anropet är den egna datorns. Appen ser
på adressen att servern är lokal; allt annat fungerar som mot en server på nätet.

Appen talar BCF API 3.0 och 2.1. Den väljer den nyaste version som servern erbjuder, och en server med bara 2.1 fungerar också: en sådan
saknar ofta Foundation API och Documents API, så appen läser versionen ur `/bcf/versions` och inloggningsadresserna ur `/bcf/2.1/auth`, och
lämnar bort *Hämta dokument*. Under *Fler alternativ* i dialogen kan du välja version själv, och erbjuder servern flera kan du byta i källans vy.
I 2.1 listar *Filer i projektet* bara BCF-dokumenten, ärenden saknar serverns löpnummer och en viewpoint går inte att ta bort. I gengäld kan en
kommentar vara ett svar på en annan: knappen *Svara* i panelen *Ärenden*.

Kortet *Projektets medlemmar* visas när servern har projektadministration (Dataregiums tillägg). Den som är projektansvarig
(manager) i ett projekt, utan att vara serveradministratör, loggar in med *Logga in som projektansvarig* och ser sina projekt och
deras medlemmar med roll: läsare, bidragsgivare, redaktör eller projektansvarig. Du lägger till en person med det exakta
användarnamnet på servern, ändrar en roll, tar bort en medlem och byter projektets namn; varje ändring bekräftas först. Servern låter
inte projektet bli utan projektansvarig och säger till; projekt tas inte bort härifrån, och nya konton skapar en administratör.

Har projektet team visar kortet också dem: namn, ansvarig, medlemmar och det IDS-dokument vars specifikationer avgränsar
teamets del av modellen. Du lägger till ett team med namn, ansvarig (en redaktör eller projektansvarig), medlemmarnas användarnamn
och IDS-dokumentet, som väljs bland projektets filer eller anges med sitt id, och tar bort ett team; servern kontrollerar att de
angivna finns i projektet. En ändring som bara rör ett teams del godkänns av teamets ansvarige, inte av en projektansvarig (se
*Ändra med AI* i CAD och BIM).

Ärenden hämtas i sidor om 500. En lista som servern har kapat (Dataregium kapar vid 1 000 poster) läses till slut genom
serverns rubrik Link med rel="next", men bara på samma server, så att din token aldrig går någon annanstans.

Kortet *IFC-LPG* visas när servern har en graf, se [grafer.md](grafer.md#ifc-lpg-på-en-dataregium-server).

Under *Filer i projektet* listar källan de modeller och dokument som servern har för projektet. *Hämta* gör en datamängd av
filens eget slag, så en IFC-fil blir en modell och en CSV-fil en tabell, och datamängden minns vilken server, vilket projekt
och vilken version den kom från. I Hantera visar kortet *Från CDE* detta, och *Sök ny version* frågar servern om dokumentet
har en nyare version; den hämtas då som en egen datamängd bredvid den gamla. Källan säger också vad du får göra i projektet,
till exempel skapa ärenden eller ladda upp dokument. När källan skapas frågar dialogen servern var man loggar in; svarar
servern inte då, frågar appen igen vid första inloggningen.

Medan serverns egen sida är öppen i ett popup-fönster (inloggning, dokumentval, uppladdning) visar appen knappen *Avbryt*, så att du kan sluta vänta om fönstret stängts eller kommit bort.

Medan serverns egen sida är öppen i ett popup-fönster (inloggning, dokumentval, uppladdning) visar appen knappen *Avbryt*, så att du kan sluta vänta om fönstret stängts eller kommit bort.

Tillåter servern det, registrerar appen sig själv som klient när du lämnar klient-id tomt, så ingen administratör behöver
dela ut något. Datamängder kan också gå tillbaka till servern: fliken *Till CDE* i Dela skickar en datamängd i valfritt format,
eller originalfilen, till ett projekt, antingen genom Documents API, där serverns egen sida frågar efter titel och version,
eller som BCF-dokument. En datamängd som hämtats från servern kan skickas som en ny version av sitt dokument.

För Dataregiums IFC-graf finns startkod i vyn: modellerna i grafen och den senaste färdiga per dokument, byggdelar per klass, väggarnas GTIN, ärenden per status,
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

Serverns sida beskrivs i Dataregiums dokumentation: [client-guide.md](https://github.com/marwiss/Dataregium/blob/main/docs/sv/client-guide.md) (hur en klient ansluter) och [deploy/local.md](https://github.com/marwiss/Dataregium/blob/main/docs/sv/deploy/local.md) (utvecklingsstacken och hur appen provas mot den).

Dataregium beskriver sina tillägg i `GET /.well-known/dataregium`; appen läser dokumentet när källan öppnas och skriver under rubriken
vilken server det är och vilka tillägg den har (självregistrering, begärandelogg, administration, IFC-LPG, graffrågor). En server
utan dokumentet har inga tillägg, och allt enligt specifikationerna fungerar ändå. Serverns felkoder (`code` i svaret, till exempel
`reauthentication_required`) visas på ditt språk; okända koder visar serverns egen text. Länken *Öppna i Dataspatium* på serverns
sidor har formen `index.html#/inhamta/opencde?server=https://…` och öppnar dialogen för en ny källa med adressen ifylld. Finns servern redan som källa öppnas den direkt. Länken kan också peka ut ett projekt och ett dokument
(`&project=…&document=…&version=…`): projektet väljs och dokumentet hämtas som datamängd när du är inloggad. Sidor som Dataregium
öppnar i popup (inloggning, uppladdning, val av dokument) visas på appens språk.

**Administration.** Är du administratör på en Dataregium-server visar källans vy kortet *Administration* (när serverns kapabilitetsdokument säger att administrations-API:t är på). Knappen *Logga in som administratör* begär behörigheten `admin`; sedan finns flikarna Översikt (antal och serverns tillstånd), Användare (skapa, ändra, inaktivera, återställa lösenord, ta bort), Projekt (skapa, byta namn, medlemmar och roller, ta bort), Klienter (registrera, ändra, rotera hemlighet, återkalla token, ta bort), Sessioner (avsluta en eller alla för en användare), Revision, Inställningar och Hälsa, samt Graffråga när servern tillåter läsande Cypher mot IFC-grafen. Farliga handlingar kräver en färsk inloggning: servern svarar `reauthentication_required`, appen öppnar inloggningen igen och upprepar anropet. Engångsvärden (ett första lösenord, en klienthemlighet) visas en gång med knappen Kopiera och skrivs aldrig i loggen. Varje lista kan sparas som datamängd och hämtas igen från Hantera.

## Öppna geodata

Dialogen för *Geodatakälla* under *Lägg till källor* börjar med en lista över **färdiga geodatakällor**: öppna WFS-, OGC API Features-
och ArcGIS-tjänster från nordiska myndigheter och kommuner (SCB, SGU, Naturvårdsverket, SLU Artdatabanken, Riksantikvarieämbetet,
Skogsstyrelsen, Sundsvalls kommun, Kartverket, Miljødirektoratet, Riksantikvaren, Statistikcentralen, SYKE, Helsingfors, Väylävirasto,
Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands med flera), alla kontrollerade att
fungera från webbläsaren. En förinställd källa öppnas, övriga läggs till med ett klick och lagren läses från
tjänsten; filtrera på namn, land eller innehåll. Listan ligger i `presets/geodata/services.json`. Under listan finns

Tre källor hämtar planer: *Plandata.dk (WFS)* och *Skipulagsstofnun skipulagsgögn (ArcGIS)* har knappen **Hämta plan**
som läser en hel lokalplan respektive ett deiliskipulag (alla lager) med planens nummer och sparar den som plan, och
*Ryhti kaavatiedot (OGC API Features)* ger Finlands planindex. Se [planer.md](planer.md#planer-från-andra-nordiska-länder).
fälten för en egen tjänst. Boverkets Planbestämmelsekatalog finns som vanlig API-källa (*Boverket
Planbestämmelsekatalogen*), se [planer.md](planer.md).

Valet **Geodatakälla** under *Lägg till källor* i Inhämta gör en vanlig API-källa av adressen till en geodatatjänst,
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
*Läs om lagren*; listan sparas i din kopia av källan. Lantmäteriets geodataplattform (detaljplaner, byggnader, strandskydd, kulturhistoriska lämningar och gränsen för fjällnära skog) finns som nivå 2 med
Bearer-nyckel från en ansluten organisation. Boverkets digitala planer får egna funktioner i en kommande version.

**Trafikverkets NVDB** (*Trafikverket NVDB: vägdata*) ger 45 objekttyper ur Nationella vägdatabasen, som hastighetsgränser,
vägnummer, bärighet, antal körfält, gatunamn, korsningar och rastplatser, med en ändpunkt per objekttyp. Den kräver en
kostnadsfri nyckel från [data.trafikverket.se](https://data.trafikverket.se/), som skickas i begärans kropp och aldrig i
adressen. Ange området i WGS 84 som för de andra källorna; appen räknar om det till SWEREF 99 TM, och utan område hämtas hela
landet. Svaren läses i sidor om 5 000 objekt, och geometrin räknas om till WGS 84 så att datamängden öppnas som karta. Data
är CC0.

**Lantmäteriets STAC med nyckel** (*Lantmäteriet geodata med nyckel (STAC)*) söker i Lantmäteriets fyra kataloger: vektordata
(byggnader, marktäcke, ortnamn, fastighetsindelning och adresser), ortofoton, höjddata (markhöjdmodellen och laserdata) och
kartor. Välj samling och ange ett område; resultatet är filernas ytor som karta med adresserna till filerna. Kortet **Filer i
källan** i Hantera hämtar sedan filerna med nyckeln: vektorfilerna läses in som datamängder (en ZIP packas upp och en
GeoPackage ger en datamängd per lager), och raster, punktmoln och andra filer som appen inte läser sparas på datorn, högst 20
åt gången. Höjder i punkter ger åtgärden *Höjd ur markhöjdmodellen* i Bearbeta, som läser markhöjdmodellens rutor direkt.
Nyckeln är konsumentnyckeln och konsumenthemligheten från ett kostnadsfritt konto i
[Geotorget](https://geotorget.lantmateriet.se/); appen hämtar en åtkomsttoken med dem, och den skickas bara till
Lantmäteriets API och filservern dl1.lantmateriet.se.
En höjdprofil längs en linje ritar Visualisera (*Nytt diagram* → *Höjdprofil längs en linje*).

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

Appen har ett anslutningssätt för WebSocket (samtycke per ändamål, JSON-ramar, fråga och svar parade på id). Det är tänkt för strömmande API:er; inga förinställningar använder det ännu. Neo4j går över Bolt med sin egen drivrutin.

## Begränsningar

- Bryggan körs på datorn där appen används; fjärrdatabaser nås via drivrutiner eller DSN på den datorn.
- Högst 100 000 rader per hämtning genom bryggan om inte `-MaxRows` höjs; stora tabeller avgränsas bäst med SQL.
- Access-filer i webbläsaren: inga frågor, länkade tabeller eller lösenord; mycket stora filer tar minne.
- Elasticsearch ger högst 10 000 träffar per sökning (`from` + `size`).
- Alla HTTP-källor kräver CORS; det kan inte kringgås från webbläsaren.
