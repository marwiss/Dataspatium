# Öppna API:er och API-konfigurationer

Dataspatium hämtar data direkt från öppna API:er till din webbläsare. Inget går via någon server: anropen
går från din dator till myndighetens tjänst, och svaret blir en datamängd i arbetsytan. Det förutsätter att
tjänsten tillåter anrop från webbläsare (CORS); alla förinställningar nedan är kontrollerade för det.

## Förinställda källor

| Källa | Vad | Nyckel | Så hämtar du |
|---|---|---|---|
| SCB Statistikdatabasen | Officiell statistik, hela ämnesträdet | Nej | Bläddra till en tabell, välj värden per variabel, Hämta |
| SCB Statistikdatabasen (API v2, beta) | Samma statistik via SCB:s nya API | Nej | Sök tabell, välj värden, Hämta |
| Folkhälsomyndigheten Folkhälsodata | Folkhälsoenkäter, smittsamma sjukdomar, vaccinationer m.m. | Nej | Bläddra, välj värden, Hämta |
| Kolada | Nyckeltal för kommuner och regioner | Nej | Sök nyckeltal (id), hämta värden per år eller per kommun |
| Eurostat | EU-statistik | Nej | Ange datamängdens kod och filter |
| Socialstyrelsen Statistikdatabasen | Dödsorsaker, diagnoser, läkemedel, operationer m.m. | Nej | Välj ämne, välj värden per variabel, Hämta |
| SMHI meteorologiska observationer | Väderstationernas mätvärden | Nej | Välj parameter, station och tidsutsnitt |
| Luftkvalitet (Naturvårdsverkets datavärdskap) | Luftföroreningar per mätstation | Nej | Lista tidsserier, hämta värden för en tidsserie |
| Naturvårdsregistret (Naturvårdsverket) | Skyddade områden (WFS) | Nej | Välj lager, Hämta |
| Lantmäteriet öppna geodata (katalog) | Produkter och nedladdningsfiler | Nej | Lista produkter och filer, ladda ned, importera som fil |
| Sveriges dataportal | Sök datamängder hos alla myndigheter | Nej | Sök, läs tabellen, ladda ned och importera som fil |
| Lantmäteriet Direkt (Ortnamn) | Ortnamnssökning | Ja, konto i Geotorget (OAuth2) | Ange klient-id och klienthemlighet, sök |
| Boverket energideklarationer | Energideklarationer för byggnader | Ja, nyckel från Boverkets API-portal | Ange nyckel, anropa enligt portalens dokumentation |

Källor utan CORS, till exempel Riksbanken och Världsbanken, kan inte nås direkt från webbläsaren. För dem
behövs en egen proxy, se nedan. Myndigheten för civilt försvar (MCF, tidigare MSB) har inget dokumenterat
öppet API; deras statistik importeras som filer.

## Så här gör du

1. Öppna läget **Inhämta** och välj en källa under **Öppna API:er** i objektpanelen.
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

Datamängder som kommer från ett API minns sitt urval. I **Hantera** finns knappen **Hämta igen** som gör om
hämtningen och antingen lägger till raderna eller ersätter alla rader. Recept som gjorts på datamängden kan sedan
köras igen från **Bearbeta › Recept**.

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
| `baseUrl` | Adress som endpointernas sökvägar läggs till efter |
| `headers` | Standardheaders för alla anrop |
| `auth` | `none`, `apiKey` (`in`: `header` eller `query`, `name`, valfritt `prefix`), `basic`, `bearer`, `oauth2_client_credentials` (`tokenUrl`, valfritt `scope`); `help` och `signupUrl` visas vid nyckelfältet |
| `rateLimit` | `requests` per `perSeconds`; anrop köas så att gränsen hålls, och 429-svar väntas ut |
| `family` | Särskild bläddrare: `{ "type": "pxweb", "version": 1 eller 2, "lang", "maxCells" }` eller `{ "type": "socialstyrelsen" }` |
| `endpoints` | Lista över anrop (se nedan) |

### Endpoint

| Fält | Betydelse |
|---|---|
| `id`, `name`, `description` | Identitet och text i formuläret |
| `method` | `GET` eller `POST` |
| `path` | Sökväg efter `baseUrl`; `{namn}` ersätts med parametervärden. Tomma valfria platshållare tas bort |
| `headers` | Extra headers |
| `params` | Parametrar, se nedan |
| `body`, `bodyType` | Kropp för POST: JSON-mall där `"{namn}"` byts mot värdet (`json`, standard), `form` eller `text` |
| `pagination` | `none`, `page` (`param`, `start`, `sizeParam`, `size`, `totalPagesPath`), `offset` (`param`, `sizeParam`, `size`, `totalPath`), `next-url` (`path` till nästa adress i svaret), `cursor` (`path`, `param`), `link-header` (`rel`), `link-rel` (`path` till en länklista, `rel`); `maxPages` begränsar antalet anrop |
| `response` | `format`: `json` (`path` till posterna, `explode` för nästlad lista), `jsonstat`, `csv` (`options.delimiter`, `options.skipUntil`, `options.decimal`), `geojson` (`options.geometry`), `xml` (`recordTag`), `entryscape`, `text`. Gemensamt: `constants` (kolumn: sökväg i rotdokumentet), `convert` (`epoch-ms`, `epoch-s`, `number`), `rename`, `drop` |
| `dataset` | `name` med platshållare, `keys` för dubblettkontroll vid Lägg till rader |

### Parameter

| Fält | Betydelse |
|---|---|
| `name` | Namn i sökväg, fråga eller header |
| `in` | `path`, `query`, `header`, `body`, `template` (används bara av andra parametrars mallar), `option` (skickas till tolken, t.ex. geometri av eller på) |
| `type` | `string`, `number`, `boolean`, `date`, `enum` (`options`), `multi` (flera värden, `join` eller `style: "repeat"`), `text`, `querylines` (rader `namn=värde` som blir frågeparametrar) |
| `label`, `help`, `example`, `required`, `default`, `hidden` | Formulär och standardvärden |
| `raw` | Koda inte värdet i sökvägen (för kommaseparerade listor) |
| `template` | Värdet byggs av andra parametrar, till exempel `"title:\"{q}\""` |
| `optionsFrom` | Hämta alternativen från en annan endpoint: `{ "endpoint": "stationer", "value": "kolumn", "label": "kolumn", "params": { "parameter": "{parameter}" } }` |

### Tabellen som skapas

JSON-poster plattas ut (nästlade objekt blir kolumner med punkt i namnet, listor blir JSON-text). JSON-stat ger en
rad per cell med kod- och etikettkolumn per dimension, tidskolumn och en värdekolumn per mått. Kolumnnamn
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

- SDMX-JSON stöds inte ännu; använd JSON-stat där tjänsten erbjuder det (SCB, Eurostat, Folkhälsomyndigheten).
- PX-filer tolkas inte i JavaScript; hämta JSON-stat eller använd paketet pxR i R.
- Stora svar (hundratusentals rader) tar tid att tolka i webbläsaren. Begränsa urvalet eller använd `maxPages`.
- Anrop sker bara när du trycker Hämta eller öppnar ett fält med alternativ från tjänsten.
