# Åbne API'er og API-konfigurationer

Dataspatium henter data direkte fra åbne API'er til din browser. Intet går gennem nogen server: kaldene går fra din
computer til myndighedens tjeneste, og svaret bliver et datasæt i arbejdsområdet. Det forudsætter, at tjenesten tillader
kald fra browsere (CORS); alle forudindstillinger nedenfor er kontrolleret for det.

## Forudindstillede kilder

Listen i Hent er grupperet efter land. Landeknapperne over den (Sverige, Danmark, Norge, Finland, Island, Færøerne,
Grønland, Åland, Norden, EU, Internationalt) vælger, hvilke landes kilder der vises; valget gemmes i browseren. Kildernes navne og
beskrivelser følger appens sprog, og PxWeb-tjenester, der findes på flere sprog (SCB, SSB, Statistikcentralen, Hagstofa,
Grønlands Statistik, ÅSUB), gennemses på appens sprog, når tjenesten har det. Alle nedenstående kilder er kontrolleret for
CORS i november 2026, og kun de to sidste svenske kræver nøgle.

### Sverige og EU

| Land | Kilde | Hvad | Sådan henter du |
|---|---|---|---|
| EU | Eurostat | EU-statistik | Angiv datasættets kode og filtre |
| EU | Den Europæiske Centralbank (ECB) | Valutakurser og ECB's statistik (SDMX) | Vælg valutaer og frekvens for valutakurserne, eller angiv dataflow og serienøgle |
| Internationalt | OECD | Arbejdsløshed, BNP-vækst og OECD's øvrige statistik (SDMX) | Vælg lande, eller angiv dataflow og serienøgle |
| Sverige | SCB Statistikdatabasen (API v1 og v2) | Officiel statistik | Gennemse eller søg, vælg værdier |
| Sverige | Folkhälsomyndigheten, Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, Lantmäteriets geodatakatalog, Sveriges dataportal | Folkesundhed, sundhed, nøgletal for kommuner, vejr, luftkvalitet, beskyttede områder, geodata | Se den svenske vejledning |
| Sverige | Lantmäteriet Direkt, Boverket | Stednavne, energimærker | Kræver nøgle |

### Øvrige Norden

| Land | Kilde | Hvad | Sådan henter du |
|---|---|---|---|
| Danmark | Danmarks Statistik Statistikbanken | Officiel statistik (api.statbank.dk) | Gennemse emnetræet, vælg tabel og værdier pr. variabel; variabler, der ikke vælges, summeres væk |
| Danmark | Open Data DK | Danske kommuners og regioners dataportal | Søg datasæt, én række pr. fil, importér filen via Fra webadresse |
| Norge | SSB Statistikkbanken (API v1 og v2) | Officiel statistik, norsk og engelsk | Gennemse emnetræet, eller søg tabel, vælg værdier; 800 000 celler pr. kald |
| Norge | FHI Statistikk | Folkesundhedsstatistik fra Folkehelseinstituttets registre og statistikbanker | Vælg kilde, tabel og værdier pr. dimension (målene i MEASURE_TYPE) |
| Norge | Enhetsregisteret (Brønnøysundregistrene) | Virksomheder og organisationer | Søg på navn, kommune, organisationsform eller branchekode |
| Norge | Kartverket kommuneinfo | Kommuner og fylker | Hent listerne, også kommuner pr. fylke |
| Norge | MET Norway Locationforecast | Vejrudsigt pr. koordinat | Angiv bredde- og længdegrad |
| Finland | Statistikcentralen StatFin | Officiel statistik, finsk, svensk og engelsk | Gennemse emnetræet, vælg værdier; 100 000 celler pr. kald |
| Finland | Kommunernes nøgletal (Statistikcentralen) | Nøgletal pr. kommune og velfærdsområde | Gennemse, vælg værdier |
| Finland | Sotkanet (THL) | Indikatorer for sundhed og velfærd | Hent indikatorer og regioner, derefter værdier for en indikator og år |
| Finland | YTJ virksomhedsregister (PRH) | Virksomheder | Søg på navn, by, FO-nummer eller branche |
| Finland | Digitraffic vejvejr (Fintraffic) | Vejvejrstationer og målinger | Hent stationer (punktkort) og seneste målinger |
| Finland | Meteorologisk institut FMI | Vejrobservationer pr. by eller station | Angiv by eller stations-id, parametre og periode |
| Finland | Avoindata.fi | Finlands dataportal | Søg datasæt, én række pr. fil |
| Island | Hagstofa Íslands | Officiel statistik, islandsk og engelsk | Gennemse databaserne, vælg værdier; 10 000 celler pr. kald |
| Island | Veðurstofa Íslands | Vejrobservationer pr. station | Angiv stationsnumre |
| Grønland | Grønlands Statistik | Officiel statistik, dansk og engelsk | Gennemse, vælg værdier |
| Færøerne | Hagstova Føroya | Officiel statistik, engelsk | Gennemse, vælg værdier |
| Åland | ÅSUB | Officiel statistik, svensk og engelsk | Gennemse, vælg værdier |
| Norden | Nordic Statistics database | Sammenlignelig nordisk statistik, engelsk | Gennemse, vælg værdier |

Ikke med: Danmarks DMI og Norges Frost (MET) kræver nøgle; Energi Data Service og data.norge.no mangler CORS; opingogn.is
har ikke længere et søge-API. Kilder uden CORS kan ikke nås direkte fra browseren; de kræver en egen proxy, se nedenfor.

Geodatakilder (familien `geodata` med `kind` `wfs`, `ogcapi` eller `arcgis`) leveres uden endepunkter: lagene læses fra
tjenesten, når kilden åbnes, og gemmes i din kopi af konfigurationen. Forudindstillede: SCB åbne geodata, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen (ArcGIS), Kartverket (administrative enheder, ejendomskort),
Statistikcentralen, SYKE (ArcGIS) og, med nøgle, Lantmäteriets geodataplatform (lokalplaner). Kilden *Geodataportalen (sök
geodata)* (familien `geoportal`, svarformatet `geonetwork`) søger i det svenske nationale katalog. Se
[kallor.md](kallor.md#åbne-geodata).

## Sådan gør du

1. Åbn tilstanden **Hent**, og vælg en kilde under **Åbne API'er** i objektpanelet. Landeknapperne over listen begrænser
   den til valgte lande.
2. Kræver kilden en nøgle, så angiv den under **Godkendelse**. Vælg **Brug i denne session** (glemmes, når siden lukkes)
   eller **Gem krypteret** med en adgangssætning.
3. Gennemse eller søg det frem, du vil have. For PxWeb-tjenesterne (SCB, de nordiske statistikbureauer,
   Folkhälsomyndigheten), Danmarks Statistik, FHI og Socialstyrelsen vælger du værdier pr. variabel; antallet af celler
   vises, og udvalg over tjenestens grænse opdeles automatisk i flere kald. For de øvrige kilder udfylder du kaldets
   parametre. Lister (stationer, kommuner, produkter) hentes fra tjenesten, når du åbner feltet.
4. Tryk **Hent**. Forløbet vises og kan afbrydes. **Forhåndsvis første side** henter kun ét kald.
5. Gennemse tabellen, og tryk **Gem som datasæt**, eller tilføj rækkerne til et eksisterende datasæt (tilføj eller
   erstat). Datasættet får kilden i sin beskrivelse: udgiver, tabel, adresse og licens.

Egenskabspanelet viser udgiver, licens, hastighedsgrænse og de seneste kald med status og svartid.

## Opdatér et hentet datasæt

Datasæt, der kommer fra et API, husker kilden og udvalget. Under **Gemte hentninger** i Hent vises de med kilde, seneste
hentning og antal rækker. **Opdatér** henter de samme data igen, erstatter rækkerne og afspiller datasættets opskrift, så
rensninger og beregnede kolonner kommer tilbage; **Opdatér alle** gør det for dem alle efter tur, og kommandopaletten og
Håndter tilbyder det samme som **Hent API-datasæt igen**. Mislykkes hentningen eller et opskriftstrin, forbliver
datasættet, som det var, og fejlen vises. Et opskriftstrin, der kræver en hemmelighed (for eksempel en nøgle til
pseudonymisering), kan ikke afspilles automatisk. I **Håndter** findes også **Hent igen**, hvor du vælger mellem at
opdatere og at lægge de nye rækker sidst uden at køre opskriften.

## Nøgler og sikkerhed

- Nøgler gemmes aldrig i klartekst. Som standard findes de kun i hukommelsen under sessionen.
- **Gem krypteret** krypterer nøglen med en adgangssætning (PBKDF2 og AES-GCM) i browserens database. Samme adgangssætning
  gælder for alle gemte nøgler. Adgangssætningen gemmes ikke; glemmer du den, skal du angive nøglerne igen.
- Når appen åbnes igen, er gemte nøgler låst, indtil du angiver adgangssætningen (**Lås gemte nøgler op**).
- Nøgler sendes kun til den adresse, konfigurationen angiver, og følger aldrig med, når en konfiguration eksporteres, eller
  der tages backup af arbejdsområdet.
- Under file:// deler alle lokalt åbnede HTML-sider lager i Chromium. Derfor er kryptering standard for gemte nøgler.

### Skaf nøgler

- **Boverket**: registrér dig i [Boverkets API-portal](https://api-portal.boverket.se/), abonnér på API'et for energimærker
  og kopiér abonnementsnøglen. Dataspatium sender den i headeren `Ocp-Apim-Subscription-Key`. Boverket tillader 10 kald pr.
  2 sekunder og 1 500 pr. døgn.
- **Lantmäteriet Direkt**: opret en konto i [Geotorget](https://geotorget.lantmateriet.se/), tilføj produktet Ortnamn Direkt
  (åbne data, gratis) og opret API-nøgler. Angiv klient-id (consumer key) og klienthemmelighed (consumer secret); Dataspatium
  henter en adgangstoken fra `https://api.lantmateriet.se/token` og fornyer den, når den udløber.

## Proxy til tjenester uden CORS

Under **Flere indstillinger** i egenskabspanelet kan du angive adressen på en proxy, du selv driver, for eksempel
`https://min-proxy.eksempel/?url={url}`. `{url}` erstattes med den kodede måladresse; mangler `{url}`, tilføjes
måladressen til sidst. Dataspatium leverer ingen proxy og sender aldrig noget til en anden server end den, du selv
angiver.

## Konfigurationsformat

En kilde beskrives af en JSON-fil med endelsen `.api.json`. Egne konfigurationer tilføjes med **Tilføj API fra fil** og kan
eksporteres med **Eksportér konfiguration** for at blive delt. Forudindstillingerne ligger i `presets/api/` i appmappen og
er gode at tage udgangspunkt i. Filens grundsprog er svensk; oversættelser lægges i feltet `i18n` pr. sprog, og appen viser
teksterne på sit eget sprog. Formatet er beskrevet fuldt ud i den [engelske vejledning](../en/api-konfiguration.md) og den
[svenske](../sv/api-konfiguration.md).

### Felter på topniveau

Felterne på topniveau er `format`, `id`, `name`, `publisher`, `description`, `docs`, `license`, `notes`, `level` (1 = ingen nøgle, 2 = nøgle), `country` (`SE`, `DK`, `NO`, `FI`, `IS`, `FO`, `GL`, `AX`, `NORDIC`, `EU`, `INT`), `i18n`, `baseUrl`, `headers`, `auth`, `rateLimit`, `cors`, `family` (`pxweb`, `statbank`, `fhi`, `socialstyrelsen`) og `endpoints`.

### Endpoint

Et endpoint har `id`, `name`, `description`, `method`, `path`, `headers`, `params`, `body`, `bodyType`, `pagination`, `response`, `dataset`.

### Parameter

En parameter har `name`, `in`, `type`, `label`, `help`, `example`, `required`, `default`, `hidden`, `raw`, `template`, `optionsFrom`.

### Tabellen, der oprettes

JSON-poster fladgøres (indlejrede objekter bliver kolonner med punktum i navnet, lister bliver JSON-tekst). JSON-stat giver
én række pr. celle med en kode- og en tekstkolonne pr. dimension, en tidskolonne og én værdikolonne pr. mål. SDMX-JSON giver
én række pr. observation: for hver dimension en kodekolonne (`<navn>_kod`) og en tekstkolonne, når koderne har tekster,
tidsperioden, værdien (`varde`) og de serie- og observationsattributter, der har værdier. Kolonnenavne renses som ved
filimport (å, ä, ö bliver a, a, o), og typer udledes med decimalpunktum; koder med foranstillede nuller forbliver tekst.

## Skriv en egen konfiguration

1. Læs tjenestens dokumentation, og prøv et kald i browseren eller med `curl`.
2. Kontrollér CORS: `curl -s -D - -o /dev/null -H "Origin: null" "https://api.eksempel.dk/..."` skal vise
   `Access-Control-Allow-Origin: *` (eller `null`). Mangler linjen, fungerer tjenesten kun via proxy.
3. Tag udgangspunkt i en forudindstilling i `presets/api/`, ændr den, og gem som `min-tjeneste.api.json`.
4. Tilføj filen i Hent. Fejl i konfigurationen vises med feltnavne; formatet kontrolleres mod et skema
   (`src/api/schema.js`).
5. Del filen. Den indeholder aldrig nøgler.

## Begrænsninger

- MET Norways vilkår kræver, at kaldende programmer identificerer sig med en User-Agent. Browsere sender deres egen
  identifikation, som tjenesten accepterer i dag; hold antallet af kald lavt.
- SDMX læses som SDMX-JSON 1.0 eller 2.0 (datameddelelser; ECB og OECD sender det med parameteren `format=jsondata`
  eller en `Accept`-header). SDMX-ML og SDMX-CSV fortolkes ikke. JSON-stat 1.x (Danmarks Statistik) og 2.0 læses begge.
- PX-filer fortolkes ikke i JavaScript; hent JSON-stat, eller brug pakken pxR i R.
- Store svar (hundredtusinder af rækker) tager tid at fortolke i browseren. Begræns udvalget, eller brug `maxPages`.
- Kald foretages kun, når du trykker Hent eller åbner et felt med valgmuligheder fra tjenesten.
