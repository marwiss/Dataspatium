# Open APIs and API configurations

Dataspatium fetches data straight from open APIs into your browser. Nothing goes through any server: the requests go
from your computer to the agency's service, and the response becomes a dataset in the workspace. That requires the
service to allow requests from browsers (CORS); all presets below have been checked for it.

## Preset sources

The list in Import is grouped by country. The country buttons above it (Sweden, Denmark, Norway, Finland, Iceland,
Faroe Islands, Greenland, Åland, Nordic region, EU, International) choose which countries' sources are shown; the choice is stored
in the browser. The sources' names and descriptions follow the app's language, and PxWeb services available in
several languages (SCB, Statistics Norway, Statistics Finland, Statistics Iceland, Statistics Greenland, ÅSUB) are
browsed in the app's language when the service has it.

### Sweden and the EU

| Source | What | Key | How to fetch |
|---|---|---|---|
| SCB Statistical Database | Official statistics, the whole subject tree | No | Browse to a table, choose values per variable, Fetch |
| SCB Statistical Database (API v2, beta) | The same statistics through SCB's new API | No | Search for a table, choose values, Fetch |
| Public Health Agency of Sweden (Folkhälsodata) | Public health surveys, communicable diseases, vaccinations and more | No | Browse, choose values, Fetch |
| Kolada | Key figures for municipalities and regions | No | Search for key figures (id), fetch values per year or per municipality |
| Eurostat | EU statistics | No | Give the dataset code and filters |
| European Central Bank (ECB) | Exchange rates and the ECB's statistics (SDMX) | No | Choose currencies and frequency for the exchange rates, or give the dataflow and series key |
| OECD | Unemployment, GDP growth and the OECD's other statistics (SDMX) | No | Choose countries, or give the dataflow and series key |
| National Board of Health and Welfare | Causes of death, diagnoses, medicines, operations and more | No | Choose subject, choose values per variable, Fetch |
| SMHI meteorological observations | The weather stations' measurements | No | Choose parameter, station and period |
| Air quality (Swedish EPA data host) | Air pollutants per measuring station | No | List time series, fetch values for a time series |
| Nature Conservation Register (Swedish EPA) | Protected areas (WFS) | No | Choose layer, Fetch |
| Lantmäteriet open geodata (catalogue) | Products and download files | No | List products and files, download, import as a file |
| Sweden's data portal | Search the datasets of all agencies | No | Search, read the table, download and import as a file |
| Lantmäteriet Direkt (place names) | Place name search | Yes, account in Geotorget (OAuth2) | Give client id and client secret, search |
| Boverket energy performance certificates | Energy performance certificates for buildings | Yes, key from Boverket's API portal | Give the key, call according to the portal's documentation |
| Trafikverket NVDB | Road data: speed limits, road numbers, bearing capacity and 42 more object types, as a map | Yes, free key from data.trafikverket.se | Choose an object type, give an area, Fetch |

### The other Nordic countries

All have been checked for CORS (requests with an `Origin` header) in November 2026 and need no key.

| Country | Source | What | How to fetch |
|---|---|---|---|
| Denmark | Statistics Denmark StatBank | Official statistics (api.statbank.dk) | Browse the subject tree, choose a table and values per variable; variables left out are summed away |
| Denmark | Open Data DK | The data portal of Danish municipalities and regions | Search datasets, one row per file, import the file through From web address |
| Norway | Statistics Norway StatBank (API v1 and v2) | Official statistics, Norwegian and English | Browse the subject tree or search for a table, choose values; 800,000 cells per request |
| Norway | FHI Statistics | Public health statistics from the Norwegian Institute of Public Health's registers and statistics banks | Choose source, table and values per dimension (the measures in MEASURE_TYPE) |
| Norway | Central Coordinating Register for Legal Entities (Brønnøysund) | Companies and organisations | Search by name, municipality, organisation form or industry code |
| Norway | Norwegian Mapping Authority municipality info | Municipalities and counties | Fetch the lists, also municipalities per county |
| Norway | MET Norway Locationforecast | Weather forecast per coordinate | Give latitude and longitude |
| Finland | Statistics Finland StatFin | Official statistics, Finnish, Swedish and English | Browse the subject tree, choose values; 100,000 cells per request |
| Finland | Municipal key figures (Statistics Finland) | Key figures per municipality and wellbeing services county | Browse, choose values |
| Finland | Sotkanet (THL) | Indicators for health and welfare | Fetch indicators and regions, then values for an indicator and years |
| Finland | YTJ company register (PRH) | Companies | Search by name, location, business ID or line of business |
| Finland | Digitraffic road weather (Fintraffic) | Road weather stations and measurements | Fetch stations (point map) and the latest measurements |
| Finland | Finnish Meteorological Institute | Weather observations per place or station | Give place or station id, parameters and period |
| Finland | Avoindata.fi | Finland's data portal | Search datasets, one row per file |
| Iceland | Statistics Iceland | Official statistics, Icelandic and English | Browse the databases, choose values; 10,000 cells per request |
| Iceland | Icelandic Met Office | Weather observations per station | Give station numbers |
| Greenland | Statistics Greenland | Official statistics, Danish and English | Browse, choose values |
| Faroe Islands | Statistics Faroe Islands | Official statistics, English | Browse, choose values |
| Åland | ÅSUB | Official statistics, Swedish and English | Browse, choose values |
| Nordic region | Nordic Statistics database | Comparable Nordic statistics, English | Browse, choose values |

Not included: Denmark's DMI and Norway's Frost (MET) require a key; Energi Data Service and data.norge.no lack CORS;
opingogn.is no longer has a search API. Sources without CORS, for example the Riksbank and the World Bank, cannot be
reached directly from the browser; they need your own proxy, see below. The Swedish Civil Defence and Resilience
Agency (MCF, formerly MSB) has no documented open API; its statistics are imported as files.

Geodata sources (the family `geodata` with `kind` `wfs`, `ogcapi` or `arcgis`) ship without endpoints: the layers are read
from the service when the source is opened and kept in your copy of the configuration. Presets: SCB open geodata, SGU, the
Agency for Marine and Water Management, the National Heritage Board, the Forest Agency (ArcGIS), Kartverket (administrative
units, cadastral map), Statistics Finland, SYKE (ArcGIS) and, with a key, Lantmäteriet's geodata platform (detailed
plans). The source *Geodataportalen (sök geodata)* (the family `geoportal`, response format `geonetwork`) searches the
Swedish national catalogue. See [kallor.md](kallor.md#open-geodata).

## How to do it

1. Open **Import** mode and choose a source under **Open APIs** in the object panel. The country buttons above the
   list limit it to chosen countries.
2. If the source requires a key: give it under **Authentication**. Choose **Use in this session** (forgotten when the
   page closes) or **Save encrypted** with a passphrase.
3. Browse or search for what you want. For the PxWeb services (SCB, the Nordic statistics offices, the Public Health
   Agency), Statistics Denmark, FHI and the National Board of Health and Welfare you choose values per variable; the
   number of cells is shown, and selections above the service's limit are split into several requests
   automatically. For the other sources you fill in the request's parameters. Lists (stations, municipalities,
   products) are fetched from the service when you open the field.
4. Press **Fetch**. Progress is shown and can be cancelled. **Preview the first page** fetches only one request.
5. Review the table and press **Save as dataset**, or add the rows to an existing dataset (append or replace). The
   dataset gets the source in its description: publisher, table, address and licence.

The properties panel shows publisher, licence, rate limit and the latest requests with status and response time.

## Updating a fetched dataset

Datasets that come from an API remember their source and selection. Under **Saved fetches** in Import they are
listed with source, last fetch and number of rows. **Update** fetches the same data again, replaces the rows and
replays the dataset's recipe, so that cleaning and computed columns come back; **Update all** does it for all of them
in turn, and the command palette and Manage offer the same as **Re-fetch API datasets**. If the fetch or a recipe
step fails, the dataset is left as it was and the error is shown. A recipe step that needs a secret (for example a
key for pseudonymisation) cannot be replayed automatically. **Manage** also has **Fetch again**, where you choose
between updating and putting the new rows last without running the recipe.

## Keys and security

- Keys are never stored in clear text. By default they exist only in memory during the session.
- **Save encrypted** encrypts the key with a passphrase (PBKDF2 and AES-GCM) in the browser's database. The same
  passphrase applies to all saved keys. The passphrase is not stored; if you forget it you must enter the keys again.
- When the app is opened again, saved keys are locked until you give the passphrase (**Unlock saved keys**).
- Keys are sent only to the address the configuration states and never come along when a configuration is exported or
  the workspace is backed up.
- Under file:// all locally opened HTML pages share storage in Chromium. That is why encryption is the default for
  saved keys.

### Getting keys

- **Boverket**: register in [Boverket's API portal](https://api-portal.boverket.se/), subscribe to the API for energy
  performance certificates and copy the subscription key. Dataspatium sends it in the header
  `Ocp-Apim-Subscription-Key`. Boverket allows 10 requests per 2 seconds and 1,500 per day.
- **Lantmäteriet Direkt**: create an account in [Geotorget](https://geotorget.lantmateriet.se/), add the product
  Ortnamn Direkt (open data, free of charge) and create API keys. Give the client id (consumer key) and client secret
  (consumer secret); Dataspatium fetches an access token from `https://api.lantmateriet.se/token` and renews it when
  it expires.
- **Trafikverket**: create a free account at [data.trafikverket.se](https://data.trafikverket.se/) and copy the key.
  Dataspatium sends it in the XML body (`<LOGIN authenticationkey="…"/>`), never in the address.

## Proxy for services without CORS

Under **More options** in the properties panel you can give the address of a proxy that you run yourself, for example
`https://my-proxy.example/?url={url}`. `{url}` is replaced by the encoded target address; if `{url}` is missing the
target address is appended at the end. Dataspatium ships no proxy and never sends anything to any server other than
the one you give.

## Configuration format

A source is described by a JSON file with the extension `.api.json`. Your own configurations are added with **Add API
from file** and can be exported with **Export configuration** to be shared. The presets are in `presets/api/` in the
app folder and are good starting points.

```json
{
  "format": "dataspatium-api/1",
  "id": "my-service",
  "name": "Min tjänst",
  "publisher": "The agency",
  "description": "What the service contains (Swedish is the base language of the file).",
  "docs": "https://example.org/api-documentation",
  "license": { "name": "CC0 1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/" },
  "level": 1,
  "country": "SE",
  "baseUrl": "https://api.example.org/v1",
  "auth": { "type": "none" },
  "rateLimit": { "requests": 10, "perSeconds": 1 },
  "endpoints": [
    {
      "id": "list",
      "name": "Lista poster",
      "method": "GET",
      "path": "/records/{kind}",
      "params": [
        { "name": "kind", "in": "path", "label": "Typ", "type": "enum", "required": true,
          "options": [{ "value": "a", "label": "Typ A" }, { "value": "b", "label": "Typ B" }] },
        { "name": "from", "in": "query", "label": "Från datum", "type": "date" },
        { "name": "per_page", "in": "query", "type": "number", "default": 500, "hidden": true }
      ],
      "pagination": { "type": "next-url", "path": "next_url", "maxPages": 50 },
      "response": { "format": "json", "path": "values", "rename": { "value": "varde" } },
      "dataset": { "name": "My service {kind}", "keys": ["id"] }
    }
  ],
  "i18n": {
    "en": { "name": "My service", "endpoints": { "list": { "name": "List records", "params": { "kind": { "label": "Kind", "options": { "a": "Kind A", "b": "Kind B" } }, "from": { "label": "From date" } } } } }
  }
}
```

### Top-level fields

| Field | Meaning |
|---|---|
| `format` | Always `dataspatium-api/1` |
| `id` | Unique id, lower-case letters, digits, hyphens |
| `name`, `publisher`, `description`, `docs`, `license`, `notes` | Shown in the app |
| `level` | 1 = no key, 2 = key required |
| `country` | Country or area for the country filter: `SE`, `DK`, `NO`, `FI`, `IS`, `FO`, `GL`, `AX`, `NORDIC`, `EU` or `INT` |
| `i18n` | Translations per language (Swedish is the file's base language): `{ "en": { "name", "publisher", "description", "notes", "auth": { "help" }, "endpoints": { "<id>": { "name", "description", "params": { "<name>": { "label", "help", "example", "options": { "<value>": "label" } } } } }, "dataset": { "<id>": "name template" } } }`. The app shows the texts of its language; the export contains all of them |
| `baseUrl` | Address that the endpoints' paths are appended to |
| `headers` | Default headers for all requests |
| `auth` | `none`, `apiKey` (`in`: `header`, `query` or `body`, where the placeholder `{name}` in the body is filled with the key only when the request is sent; `name`, optional `prefix`), `basic`, `bearer`, `oauth2_client_credentials` (`tokenUrl`, optional `scope`); `help` and `signupUrl` are shown by the key field |
| `rateLimit` | `requests` per `perSeconds`; requests are queued so that the limit holds, and 429 responses are waited out |
| `family` | Special browser: `{ "type": "pxweb", "version": 1 or 2, "lang", "maxCells", "urls", "langs" }`, `{ "type": "statbank" }` (Statistics Denmark), `{ "type": "fhi" }` (Norwegian Institute of Public Health) or `{ "type": "socialstyrelsen" }`. `urls` gives one root per app language for PxWeb v1 (`{ "sv": "...", "en": "..." }`); `langs` states which app languages the service's `lang` parameter understands, as a list or as a map from the app's code to the service's (`{ "nb": "no" }`) |
| `endpoints` | List of requests (see below) |

### Endpoint

| Field | Meaning |
|---|---|
| `id`, `name`, `description` | Identity and text in the form |
| `method` | `GET` or `POST` |
| `path` | Path after `baseUrl`; `{name}` is replaced by parameter values. Empty optional placeholders are removed |
| `headers` | Extra headers |
| `params` | Parameters, see below |
| `body`, `bodyType` | Body for POST: a JSON template where `"{name}"` is replaced by the value (`json`, default), `form`, `text` or `xml` (a text template whose values are escaped, except for parameters with `raw`, and whose empty placeholders are removed) |
| `pagination` | `none`, `page` (`param`, `start`, `sizeParam`, `size`, `totalPagesPath`), `offset` (`param`, `sizeParam`, `size`, `totalPath`; `in: "body"` puts the offset and the size in the body), `next-url` (`path` to the next address in the response), `cursor` (`path`, `param`), `link-header` (`rel`), `link-rel` (`path` to a list of links, `rel`); `maxPages` limits the number of requests |
| `response` | `format`: `json` (`path` to the records, `explode` for a nested list), `jsonstat`, `sdmx` (SDMX-JSON 1.0 and 2.0), `csv` (`options.delimiter`, `options.skipUntil`, `options.decimal`), `geojson` (`options.geometry`), `xml` (`recordTag`), `entryscape`, `text`, `graphql` (the first list under `data` becomes the table; errors in the response are reported), `sparql` (the query variables become columns), `influx-csv` (annotated CSV from InfluxDB). `lift` lifts the fields of a nested object into columns (CouchDB `doc`, Elasticsearch `_source`, Airtable `fields`), and a `path` that is a key with dots (`@odata.nextLink`) is looked up whole. `geometry` (`path` to the geometry as WKT and `crs`) gives the columns `geometri_typ` and `geometri` in WGS 84, and `errorPath` points to the service's error message in an answer that is otherwise data. Common: `constants` (column: path in the root document), `convert` (`epoch-ms`, `epoch-s`, `number`), `rename`, `drop` |
| `dataset` | `name` with placeholders, `keys` for the duplicate check when appending rows |

### Parameter

| Field | Meaning |
|---|---|
| `name` | Name in path, query or header |
| `in` | `path`, `query`, `header`, `body`, `template` (used only by other parameters' templates), `option` (sent to the parser, e.g. geometry on or off) |
| `type` | `string`, `number`, `boolean`, `date`, `enum` (`options`), `multi` (several values, `join` or `style: "repeat"`), `text`, `querylines` (lines `name=value` that become query parameters), `bbox` (an area in WGS 84; with `crs: "EPSG:3006"` it is sent in SWEREF 99 TM and with `bboxFormat: "pairs"` as `x1 y1, x2 y2`) |
| `label`, `help`, `example`, `required`, `default`, `hidden` | Form and default values |
| `raw` | Do not encode the value in the path (for comma-separated lists) |
| `template` | The value is built from other parameters, for example `"title:\"{q}\""` |
| `optionsFrom` | Fetch the options from another endpoint: `{ "endpoint": "stations", "value": "column", "label": "column", "params": { "parameter": "{parameter}" } }` |

### The table that is created

JSON records are flattened (nested objects become columns with a dot in the name, lists become JSON text). JSON-stat
gives one row per cell with a code and label column per dimension, a time column and one value column per measure.
SDMX-JSON gives one row per observation: for each dimension a code column (`<name>_kod`) and a text column when the
codes have texts, the time period, the value (`varde`) and the series and observation attributes that have values.
Column names are cleaned as at file import (å, ä, ö become a, a, o) and types are derived with a decimal point; codes
with leading zeros remain text.

## Writing your own configuration

1. Read the service's documentation and try a request in the browser or with `curl`.
2. Check CORS: `curl -s -D - -o /dev/null -H "Origin: null" "https://api.example.org/..."` should show
   `Access-Control-Allow-Origin: *` (or `null`). Without that line the service works only through a proxy.
3. Start from a preset in `presets/api/`, change it and save it as `my-service.api.json`.
4. Add the file in Import. Errors in the configuration are shown with field names; the format is checked against a
   schema (`src/api/schema.js`).
5. Share the file. It never contains keys.

## Limitations

- MET Norway's terms require calling programs to identify themselves with a User-Agent. Browsers send their own
  identification, which the service accepts today; keep the number of requests low and expect that the service may
  throttle anonymous requests.
- SDMX is read as SDMX-JSON 1.0 or 2.0 (data messages; the ECB and the OECD send it with the parameter
  `format=jsondata` or an `Accept` header). SDMX-ML and SDMX-CSV are not parsed. JSON-stat 1.x (Statistics Denmark)
  and 2.0 are both read.
- PX files are not parsed in JavaScript; fetch JSON-stat or use the package pxR in R.
- Large responses (hundreds of thousands of rows) take time to parse in the browser. Limit the selection or use
  `maxPages`.
- Requests are made only when you press Fetch or open a field with options from the service.
