# Öppna API:er och API-konfigurationer

Dataspatium hämtar data direkt från öppna API:er till din webbläsare. Inget går via någon server: anropen
går från din dator till myndighetens tjänst, och svaret blir en datamängd i arbetsytan. Det förutsätter att
tjänsten tillåter anrop från webbläsare (CORS); alla förinställningar nedan är kontrollerade för det.

## Förinställda källor

### Sverige och EU

| Källa | Vad | Nyckel | Så hämtar du |
|---|---|---|---|
| SCB Statistikdatabasen | Officiell statistik, hela ämnesträdet | Nej | Bläddra till en tabell, välj värden per variabel, Hämta |
| SCB Statistikdatabasen (API v2, beta) | Samma statistik via SCB:s nya API | Nej | Sök tabell, välj värden, Hämta |
| Folkhälsomyndigheten Folkhälsodata | Folkhälsoenkäter, smittsamma sjukdomar, vaccinationer m.m. | Nej | Bläddra, välj värden, Hämta |
| Kolada | Nyckeltal för kommuner och regioner | Nej | Sök nyckeltal (id), hämta värden per år eller per kommun |
| Eurostat | EU-statistik | Nej | Ange datamängdens kod och filter |
| Europeiska centralbanken (ECB) | Valutakurser och ECB:s statistik (SDMX) | Nej | Välj valutor och frekvens för växelkurserna, eller ange dataflöde och serienyckel |
| OECD | Arbetslöshet, BNP-tillväxt och OECD:s övriga statistik (SDMX) | Nej | Välj länder, eller ange dataflöde och serienyckel |
| Socialstyrelsen Statistikdatabasen | Dödsorsaker, diagnoser, läkemedel, operationer m.m. | Nej | Välj ämne, välj värden per variabel, Hämta |
| SMHI meteorologiska observationer | Väderstationernas mätvärden | Nej | Välj parameter, station och tidsutsnitt |
| Luftkvalitet (Naturvårdsverkets datavärdskap) | Luftföroreningar per mätstation | Nej | Lista tidsserier, hämta värden för en tidsserie |
| Naturvårdsregistret (Naturvårdsverket) | Skyddade områden (WFS) | Nej | Välj lager, Hämta |
| Lantmäteriet öppna geodata (katalog) | Produkter och nedladdningsfiler | Nej | Lista produkter och filer, ladda ned, importera som fil |
| Sveriges dataportal | Sök datamängder hos alla myndigheter | Nej | Sök, läs tabellen, ladda ned och importera som fil |
| Lantmäteriet Direkt (Ortnamn) | Ortnamnssökning | Ja, konto i Geotorget (OAuth2) | Ange klient-id och klienthemlighet, sök |
| Boverket energideklarationer | Energideklarationer för byggnader | Ja, nyckel från Boverkets API-portal | Ange nyckel, anropa enligt portalens dokumentation |
| Boverkets klimatdatabas | Generiska klimatdata för byggprodukter (GWP för A1–A5) | Nej | Hämta senaste version och dess resurser; verktyget Klimatdeklaration för modeller använder samma data |
| Trafikverket NVDB | Vägdata: hastighetsgränser, vägnummer, bärighet och 42 objekttyper till, som karta | Ja, kostnadsfri nyckel från data.trafikverket.se | Välj objekttyp, ange område, Hämta |
| Lantmäteriet geodata med nyckel (STAC) | Vektordata, ortofoton, höjddata och kartor som filer | Ja, konto i Geotorget (OAuth2) | Välj samling, ange område, Hämta; filerna hämtas i Hantera med *Filer i källan* |
| Riksbanken räntor och valutakurser (SWEA) | Styrräntan, marknadsräntor och valutakurser | Nej, men nås bara via bryggan | Välj serie och period, Hämta |
| Världsbanken: indikatorer | Folkmängd, BNP, utsläpp och andra indikatorer per land och år | Nej, men nås bara via bryggan | Ange länder, indikator och år, Hämta |

Riksbanken och Världsbanken tillåter inte anrop från webbläsaren (ingen CORS); de nås via bryggan (se
[Hämta via bryggan](kallor.md#hämta-via-bryggan)) eller via en egen proxy, se nedan. Myndigheten för civilt försvar (MCF, tidigare MSB) har inget dokumenterat
öppet API; deras statistik importeras som filer.

### Övriga Norden

Statistikbyråerna och flera andra myndigheter i Danmark, Norge, Finland och Island, de självstyrande områdena
och Nordic Statistics ingår också. Alla är kontrollerade för CORS (anrop med `Origin`-header) i november 2026
och kräver ingen nyckel. Landsknapparna ovanför listan i Inhämta väljer vilka länders källor som visas
(Sverige, Danmark, Norge, Finland, Island, Färöarna, Grönland, Åland, Norden, EU, Internationellt); valet sparas i
webbläsaren.
Källornas namn och beskrivningar följer appens språk, och PxWeb-tjänster som finns på flera språk (SCB, SSB,
Statistikcentralen, Hagstofa, Grønlands Statistik, ÅSUB) bläddras på appens språk när tjänsten har det.

| Land | Källa | Vad | Så hämtar du |
|---|---|---|---|
| Danmark | Danmarks Statistik Statistikbanken | Officiell statistik (api.statbank.dk) | Bläddra i ämnesträdet, välj tabell och värden per variabel; variabler som inte väljs summeras bort |
| Danmark | Open Data DK | Danska kommuners och regioners dataportal | Sök datamängder, en rad per fil, importera filen via Från webbadress |
| Norge | SSB Statistikkbanken (API v1 och v2) | Officiell statistik, norska och engelska | Bläddra i ämnesträdet eller sök tabell, välj värden; 800 000 celler per anrop |
| Norge | FHI Statistikk | Folkhälsostatistik från Folkehelseinstituttets register och statistikbanker | Välj källa, tabell och värden per dimension (måtten i MEASURE_TYPE) |
| Norge | Enhetsregisteret (Brønnøysundregistrene) | Företag och organisationer | Sök på namn, kommun, organisationsform eller näringsgrenskod |
| Norge | Kartverket kommuneinfo | Kommuner och fylken | Hämta listorna, även kommuner per fylke |
| Norge | MET Norway Locationforecast | Väderprognos per koordinat | Ange latitud och longitud |
| Finland | Statistikcentralen StatFin | Officiell statistik, finska, svenska och engelska | Bläddra i ämnesträdet, välj värden; 100 000 celler per anrop |
| Finland | Kommunernas nyckeltal (Statistikcentralen) | Nyckeltal per kommun och välfärdsområde | Bläddra, välj värden |
| Finland | Sotkanet (THL) | Indikatorer för hälsa och välfärd | Hämta indikatorer och regioner, sedan värden för en indikator och år |
| Finland | YTJ företagsregister (PRH) | Företag | Sök på namn, ort, FO-nummer eller bransch |
| Finland | Digitraffic vägväder (Fintraffic) | Vägväderstationer och mätvärden | Hämta stationer (punktkarta) och senaste mätvärden |
| Finland | Meteorologiska institutet FMI | Väderobservationer per ort eller station | Ange ort eller stations-id, parametrar och period |
| Finland | Avoindata.fi | Finlands dataportal | Sök datamängder, en rad per fil |
| Island | Hagstofa Íslands | Officiell statistik, isländska och engelska | Bläddra bland databaserna, välj värden; 10 000 celler per anrop |
| Island | Veðurstofa Íslands | Väderobservationer per station | Ange stationsnummer |
| Grönland | Grønlands Statistik | Officiell statistik, danska och engelska | Bläddra, välj värden |
| Färöarna | Hagstova Føroya | Officiell statistik, engelska | Bläddra, välj värden |
| Åland | ÅSUB | Officiell statistik, svenska och engelska | Bläddra, välj värden |
| Norden | Nordic Statistics database | Jämförbar nordisk statistik, engelska | Bläddra, välj värden |

Inte med: Danmarks DMI och Norges Frost (MET) kräver nyckel; Energi Data Service och data.norge.no saknar
CORS; opingogn.is har inget sök-API längre. Egna konfigurationer för sådana tjänster kan läggas till med en
proxy eller nyckel enligt nedan.

Geodatakällor (familjen `geodata` med `kind` `wfs`, `ogcapi` eller `arcgis`) levereras utan ändpunkter: lagren läses från
tjänsten när källan öppnas och sparas i din kopia av konfigurationen. Förinställda: SCB öppna geodata, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen (ArcGIS), Kartverket (administrativa enheter, fastighetskarta),
Statistikcentralen, SYKE (ArcGIS) och, med nyckel, Lantmäteriets geodataplattform (detaljplaner). Källan *Geodataportalen
(sök geodata)* (familjen `geoportal`, svarsformatet `geonetwork`) söker i den nationella katalogen. Se
[kallor.md](kallor.md#öppna-geodata).

## Så här gör du

1. Öppna läget **Inhämta** och välj en källa under **Öppna API:er** i objektpanelen. Landsknapparna ovanför
   listan begränsar den till valda länder.
2. Kräver källan nyckel: ange den under **Autentisering**. Välj **Använd i den här sessionen** (glöms när sidan
   stängs) eller **Spara krypterat** med en lösenfras.
3. Bläddra eller sök fram det du vill ha. För SCB, Folkhälsomyndigheten och Socialstyrelsen väljer du värden per
   variabel; antalet celler visas, och urval över tjänstens gräns delas upp i flera anrop automatiskt. För övriga
   källor fyller du i anropets parametrar. Listor (stationer, kommuner, produkter) hämtas från tjänsten när du
   öppnar fältet.
4. Tryck **Hämta**. Förloppet visas och kan avbrytas. **Förhandsgranska första sidan** hämtar bara ett anrop.
5. Granska tabellen och tryck **Spara som datamängd**, eller lägg till raderna i en befintlig datamängd (lägg till
   eller ersätt). Datamängden får källan i sin beskrivning: utgivare, tabell, adress och licens.

Egenskapspanelen visar utgivare, licens, anropsgräns och de senaste anropen med status och svarstid.

## Uppdatera en hämtad datamängd

Datamängder som kommer från ett API minns källan och urvalet. Under **Sparade hämtningar** i Inhämta listas de med
källa, senaste hämtning och antal rader. **Uppdatera** hämtar samma uppgifter igen, ersätter raderna och spelar upp
datamängdens recept, så att rensningar och beräknade kolumner kommer tillbaka; **Uppdatera alla** gör det för alla
i tur och ordning, och kommandopaletten och Hantera har samma sak som **Hämta om API-datamängder**. Misslyckas
hämtningen eller ett receptsteg lämnas datamängden som den var och felet visas. Ett receptsteg som behöver en
hemlighet (till exempel en nyckel för pseudonymisering) kan inte spelas upp automatiskt. I **Hantera** finns också
**Hämta igen**, där du väljer mellan att uppdatera och att lägga de nya raderna sist utan att köra receptet.

## Nycklar och säkerhet

- Nycklar lagras aldrig i klartext. Standard är att de bara finns i minnet under sessionen.
- **Spara krypterat** krypterar nyckeln med en lösenfras (PBKDF2 och AES-GCM) i webbläsarens databas. Samma
  lösenfras gäller alla sparade nycklar. Lösenfrasen sparas inte; glömmer du den får du ange nycklarna igen.
- När appen öppnas igen är sparade nycklar låsta tills du anger lösenfrasen (**Lås upp sparade nycklar**).
- Nycklar skickas bara till den adress som konfigurationen anger och följer aldrig med när en konfiguration
  exporteras eller arbetsytan säkerhetskopieras.
- Under file:// delar alla lokalt öppnade HTML-sidor lagringsutrymme i Chromium. Det är därför kryptering är
  standard för sparade nycklar.

### Skaffa nycklar

- **Boverket**: registrera dig i [Boverkets API-portal](https://api-portal.boverket.se/), prenumerera på API:et
  för energideklarationer och kopiera prenumerationsnyckeln. Dataspatium skickar den i headern
  `Ocp-Apim-Subscription-Key`. Boverket tillåter 10 anrop per 2 sekunder och 1 500 per dag.
- **Lantmäteriet Direkt**: skapa ett konto i [Geotorget](https://geotorget.lantmateriet.se/), lägg till
  produkten Ortnamn Direkt (öppna data, kostnadsfritt) och skapa API-nycklar. Ange klient-id (consumer key) och
  klienthemlighet (consumer secret); Dataspatium hämtar en åtkomsttoken från `https://api.lantmateriet.se/token`
  och förnyar den när den går ut.
- **Trafikverket**: skapa ett kostnadsfritt konto på [data.trafikverket.se](https://data.trafikverket.se/) och kopiera
  nyckeln. Dataspatium skickar den i XML-kroppen (`<LOGIN authenticationkey="…"/>`), aldrig i adressen.

## Proxy för tjänster utan CORS

Under **Fler alternativ** i egenskapspanelen kan du ange adressen till en proxy som du själv driver, till exempel
`https://min-proxy.example/?url={url}`. `{url}` ersätts med den kodade måladressen; saknas `{url}` läggs
måladressen till sist. Dataspatium levererar ingen proxy och skickar aldrig något till någon annan server än den
du själv anger.

## Konfigurationsformat

En källa beskrivs av en JSON-fil med ändelsen `.api.json`. Egna konfigurationer läggs till med **Lägg till API
från fil** och kan exporteras med **Exportera konfiguration** för att delas. Förinställningarna ligger i
`presets/api/` i appmappen och är bra att utgå från.

```json
{
  "format": "dataspatium-api/1",
  "id": "min-tjanst",
  "name": "Min tjänst",
  "publisher": "Myndigheten",
  "description": "Vad tjänsten innehåller.",
  "docs": "https://exempel.se/api-dokumentation",
  "license": { "name": "CC0 1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/" },
  "level": 1,
  "baseUrl": "https://api.exempel.se/v1",
  "auth": { "type": "none" },
  "rateLimit": { "requests": 10, "perSeconds": 1 },
  "endpoints": [
    {
      "id": "lista",
      "name": "Lista poster",
      "method": "GET",
      "path": "/poster/{typ}",
      "params": [
        { "name": "typ", "in": "path", "label": "Typ", "type": "enum", "required": true,
          "options": [{ "value": "a", "label": "Typ A" }, { "value": "b", "label": "Typ B" }] },
        { "name": "fran", "in": "query", "label": "Från datum", "type": "date" },
        { "name": "per_page", "in": "query", "type": "number", "default": 500, "hidden": true }
      ],
      "pagination": { "type": "next-url", "path": "next_url", "maxPages": 50 },
      "response": { "format": "json", "path": "values", "rename": { "value": "varde" } },
      "dataset": { "name": "Min tjänst {typ}", "keys": ["id"] }
    }
  ]
}
```

### Fält på toppnivå

| Fält | Betydelse |
|---|---|
| `format` | Alltid `dataspatium-api/1` |
| `id` | Unikt id, små bokstäver, siffror, bindestreck |
| `name`, `publisher`, `description`, `docs`, `license`, `notes` | Visas i appen |
| `level` | 1 = ingen nyckel, 2 = nyckel krävs |
| `country` | Land eller område för landsfiltret: `SE`, `DK`, `NO`, `FI`, `IS`, `FO`, `GL`, `AX`, `NORDIC`, `EU` eller `INT` |
| `i18n` | Översättningar per språk (`sv` är grundspråket i filen): `{ "en": { "name", "publisher", "description", "notes", "auth": { "help" }, "endpoints": { "<id>": { "name", "description", "params": { "<namn>": { "label", "help", "example", "options": { "<värde>": "etikett" } } } } }, "dataset": { "<id>": "namnmall" } } }`. Appen visar texterna för sitt språk; exporten innehåller alla |
| `baseUrl` | Adress som endpointernas sökvägar läggs till efter |
| `headers` | Standardheaders för alla anrop |
| `auth` | `none`, `apiKey` (`in`: `header`, `query` eller `body`, där platshållaren `{name}` i kroppen fylls med nyckeln först när begäran skickas; `name`, valfritt `prefix`), `basic`, `bearer`, `oauth2_client_credentials` (`tokenUrl`, valfritt `scope`); `help` och `signupUrl` visas vid nyckelfältet |
| `rateLimit` | `requests` per `perSeconds`; anrop köas så att gränsen hålls, och 429-svar väntas ut |
| `files` | Filadresser i resultatet: `{ "column": "asset_data", "hosts": ["dl1.lantmateriet.se"] }` ger kortet *Filer i källan* i Hantera, och nyckeln följer bara med till värdarna i `hosts` |
| `cors` | Vad som har uppmätts för tjänstens CORS: `{ "file": false }` betyder att den inte nås från en mapp, `{ "web": false }` att den inte nås från webbversionen; källistan visar då var den fungerar, eller att den kräver bryggan |
| `family` | Särskild bläddrare: `{ "type": "pxweb", "version": 1 eller 2, "lang", "maxCells", "urls", "langs" }`, `{ "type": "statbank" }` (Danmarks Statistik), `{ "type": "fhi" }` (Folkehelseinstituttet) eller `{ "type": "socialstyrelsen" }`. `urls` ger en rot per appspråk för PxWeb v1 (`{ "sv": "...", "en": "..." }`); `langs` anger vilka appspråk tjänstens `lang`-parameter förstår, som lista eller som karta från appens kod till tjänstens (`{ "nb": "no" }`) |
| `endpoints` | Lista över anrop (se nedan) |

### Endpoint

| Fält | Betydelse |
|---|---|
| `id`, `name`, `description` | Identitet och text i formuläret |
| `method` | `GET` eller `POST` |
| `path` | Sökväg efter `baseUrl`; `{namn}` ersätts med parametervärden. Tomma valfria platshållare tas bort |
| `headers` | Extra headers |
| `params` | Parametrar, se nedan |
| `body`, `bodyType` | Kropp för POST: JSON-mall där `"{namn}"` byts mot värdet (`json`, standard), `form`, `text` eller `xml` (textmall där värdena escapas, utom för parametrar med `raw`, och tomma platshållare tas bort) |
| `pagination` | `none`, `page` (`param`, `start`, `sizeParam`, `size`, `totalPagesPath`), `offset` (`param`, `sizeParam`, `size`, `totalPath`; `in: "body"` lägger förskjutningen och storleken i kroppen), `next-url` (`path` till nästa adress i svaret), `cursor` (`path`, `param`), `link-header` (`rel`), `link-rel` (`path` till en länklista, `rel`); `maxPages` begränsar antalet anrop |
| `response` | `format`: `json` (`path` till posterna, `explode` för nästlad lista), `jsonstat`, `sdmx` (SDMX-JSON 1.0 och 2.0), `csv` (`options.delimiter`, `options.skipUntil`, `options.decimal`), `geojson` (`options.geometry`), `xml` (`recordTag`), `entryscape`, `text`, `graphql` (första listan under `data` blir tabellen; fel i svaret rapporteras), `sparql` (frågans variabler blir kolumner), `influx-csv` (kommenterad CSV från InfluxDB). `lift` lyfter upp ett nästlat objekts fält till kolumner (CouchDB `doc`, Elasticsearch `_source`, Airtable `fields`), och en `path` som är en nyckel med punkter (`@odata.nextLink`) slås upp hel. `geometry` (`path` till geometrin som WKT och `crs`) ger kolumnerna `geometri_typ` och `geometri` i WGS 84, och `errorPath` pekar på tjänstens felmeddelande i ett svar som annars är data. Gemensamt: `constants` (kolumn: sökväg i rotdokumentet), `convert` (`epoch-ms`, `epoch-s`, `number`), `rename`, `drop` |
| `dataset` | `name` med platshållare, `keys` för dubblettkontroll vid Lägg till rader |

### Parameter

| Fält | Betydelse |
|---|---|
| `name` | Namn i sökväg, fråga eller header |
| `in` | `path`, `query`, `header`, `body`, `template` (används bara av andra parametrars mallar), `option` (skickas till tolken, t.ex. geometri av eller på) |
| `type` | `string`, `number`, `boolean`, `date`, `enum` (`options`), `multi` (flera värden, `join` eller `style: "repeat"`), `text`, `querylines` (rader `namn=värde` som blir frågeparametrar), `bbox` (område i WGS 84; med `crs: "EPSG:3006"` skickas det i SWEREF 99 TM och med `bboxFormat: "pairs"` som `x1 y1, x2 y2`) |
| `label`, `help`, `example`, `required`, `default`, `hidden` | Formulär och standardvärden |
| `raw` | Koda inte värdet i sökvägen (för kommaseparerade listor) |
| `template` | Värdet byggs av andra parametrar, till exempel `"title:\"{q}\""` |
| `optionsFrom` | Hämta alternativen från en annan endpoint: `{ "endpoint": "stationer", "value": "kolumn", "label": "kolumn", "params": { "parameter": "{parameter}" } }` |

### Tabellen som skapas

JSON-poster plattas ut (nästlade objekt blir kolumner med punkt i namnet, listor blir JSON-text). JSON-stat ger en
rad per cell med kod- och etikettkolumn per dimension, tidskolumn och en värdekolumn per mått. SDMX-JSON ger en
rad per observation: för varje dimension en kodkolumn (`<namn>_kod`) och en textkolumn när koderna har texter,
tidsperioden, värdet (`varde`) och serie- och observationsattributen som har värden. Kolumnnamn
städas som vid filimport (å, ä, ö blir a, a, o) och typer härleds med decimalpunkt; koder med inledande nollor
förblir text.

## Skriva en egen konfiguration

1. Läs tjänstens dokumentation och prova ett anrop i webbläsaren eller med `curl`.
2. Kontrollera CORS: `curl -s -D - -o /dev/null -H "Origin: null" "https://api.exempel.se/..."` ska visa
   `Access-Control-Allow-Origin: *` (eller `null`). Saknas raden fungerar tjänsten bara via proxy.
3. Utgå från en förinställning i `presets/api/`, ändra och spara som `min-tjanst.api.json`.
4. Lägg till filen i Inhämta. Fel i konfigurationen visas med fältnamn; formatet kontrolleras mot ett schema
   (`src/api/schema.js`).
5. Dela filen. Den innehåller aldrig nycklar.

## Begränsningar

- MET Norways villkor kräver att anropande program identifierar sig med en User-Agent. Webbläsare skickar sin
  egen identifiering, som tjänsten i dag accepterar; håll antalet anrop lågt och räkna med att tjänsten kan
  strypa anonyma anrop.
- SDMX läses som SDMX-JSON 1.0 eller 2.0 (datameddelanden; ECB och OECD skickar det med parametern
  `format=jsondata` eller `Accept`-header). SDMX-ML och SDMX-CSV tolkas inte. JSON-stat 1.x (Danmarks Statistik)
  och 2.0 läses båda.
- PX-filer tolkas inte i JavaScript; hämta JSON-stat eller använd paketet pxR i R.
- Stora svar (hundratusentals rader) tar tid att tolka i webbläsaren. Begränsa urvalet eller använd `maxPages`.
- Anrop sker bara när du trycker Hämta eller öppnar ett fält med alternativ från tjänsten.
