# Opne API-ar og API-konfigurasjonar

Dataspatium hentar data direkte frå opne API-ar til nettlesaren din. Ingenting går via nokon tenar: kalla går frå
datamaskina di til tenesta til etaten, og svaret blir eit datasett i arbeidsområdet. Det føreset at tenesta tillèt
kall frå nettlesarar (CORS); alle førehandsinnstillingane nedanfor er kontrollerte for det.

## Førehandsinnstilte kjelder

Lista i Hent er gruppert etter land. Landknappane over henne (Sverige, Danmark, Noreg, Finland, Island, Færøyane, Grønland,
Åland, Norden, EU, Internasjonalt) vel kva lands kjelder som blir viste; valet blir lagra i nettlesaren. Namna og skildringane til kjeldene følgjer
språket i appen, og PxWeb-tenester som finst på fleire språk (SCB, SSB, Statistikcentralen, Hagstofa, Grønlands Statistik,
ÅSUB), blir blaa på språket i appen når tenesta har det. Alle kjeldene nedanfor er kontrollerte for CORS i november 2026, og berre dei
to siste svenske krev nøkkel.

### Sverige og EU

| Land | Kjelde | Kva | Slik hentar du |
|---|---|---|---|
| EU | Eurostat | EU-statistikk | Oppgje koden til datasettet og filter |
| EU | Den europeiske sentralbanken (ECB) | Valutakursar og statistikken til ECB (SDMX) | Vel valutaer og frekvens for valutakursane, eller oppgje dataflyt og serienøkkel |
| Internasjonalt | OECD | Arbeidsløyse, BNP-vekst og den andre statistikken til OECD (SDMX) | Vel land, eller oppgje dataflyt og serienøkkel |
| Sverige | SCB Statistikdatabasen (API v1 og v2) | Offisiell statistikk | Bla eller søk, vel verdiar |
| Sverige | Folkhälsomyndigheten, Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, geodatakatalogen til Lantmäteriet, Sveriges dataportal | Folkehelse, helse, nøkkeltal for kommunar, vêr, luftkvalitet, verneområde, geodata | Sjå den svenske rettleiinga |
| Sverige | Lantmäteriet Direkt, Boverket, Trafikverket NVDB, Lantmäteriet STAC | Stadnamn, energiattestar, vegdata, geodatafiler | Krev nøkkel |
| Sverige | Klimadatabasen til Boverket | Generiske klimadata for byggjevarer (GWP for A1–A5), utan nøkkel | Hent siste versjon og ressursane; verktøyet Klimaerklæring for modellar brukar dei same dataa |
| Sverige, internasjonalt | Riksbanken (SWEA), Verdsbanken | Renter, valutakursar, utviklingsindikatorar | Berre via brua |

### Resten av Norden

| Land | Kjelde | Kva | Slik hentar du |
|---|---|---|---|
| Noreg | SSB Statistikkbanken (API v1 og v2) | Offisiell statistikk, norsk og engelsk | Bla i emnetreet eller søk tabell, vel verdiar; 800 000 celler per kall |
| Noreg | FHI Statistikk | Folkehelsestatistikk frå registera og statistikkbankane til Folkehelseinstituttet | Vel kjelde, tabell og verdiar per dimensjon (måla i MEASURE_TYPE) |
| Noreg | Einingsregisteret (Brønnøysundregistera) | Føretak og organisasjonar | Søk på namn, kommune, organisasjonsform eller næringskode |
| Noreg | Kartverket kommuneinfo | Kommunar og fylke | Hent listene, òg kommunar per fylke |
| Noreg | MET Norway Locationforecast | Vêrvarsel per koordinat | Oppgje breidde- og lengdegrad |
| Danmark | Danmarks Statistik Statistikbanken | Offisiell statistikk (api.statbank.dk) | Bla i emnetreet, vel tabell og verdiar per variabel; variablar som ikkje blir valde, blir summerte bort |
| Danmark | Open Data DK | Dataportalen til danske kommunar og regionar | Søk datasett, éi rad per fil, importer fila via Frå nettadresse |
| Finland | Statistikcentralen StatFin | Offisiell statistikk, finsk, svensk og engelsk | Bla i emnetreet, vel verdiar; 100 000 celler per kall |
| Finland | Nøkkeltala for kommunane (Statistikcentralen) | Nøkkeltal per kommune og velferdsområde | Bla, vel verdiar |
| Finland | Sotkanet (THL) | Indikatorar for helse og velferd | Hent indikatorar og regionar, deretter verdiar for ein indikator og år |
| Finland | YTJ føretaksregister (PRH) | Føretak | Søk på namn, stad, FO-nummer eller bransje |
| Finland | Digitraffic vegvêr (Fintraffic) | Vegvêrstasjonar og målingar | Hent stasjonar (punktkart) og siste målingar |
| Finland | Meteorologisk institutt FMI | Vêrobservasjonar per stad eller stasjon | Oppgje stad eller stasjons-id, parametrar og periode |
| Finland | Avoindata.fi | Dataportalen til Finland | Søk datasett, éi rad per fil |
| Island | Hagstofa Íslands | Offisiell statistikk, islandsk og engelsk | Bla i databasane, vel verdiar; 10 000 celler per kall |
| Island | Veðurstofa Íslands | Vêrobservasjonar per stasjon | Oppgje stasjonsnummer |
| Grønland | Grønlands Statistik | Offisiell statistikk, dansk og engelsk | Bla, vel verdiar |
| Færøyane | Hagstova Føroya | Offisiell statistikk, engelsk | Bla, vel verdiar |
| Åland | ÅSUB | Offisiell statistikk, svensk og engelsk | Bla, vel verdiar |
| Norden | Nordic Statistics database | Samanliknbar nordisk statistikk, engelsk | Bla, vel verdiar |

Ikkje med: Frost (MET) i Noreg og DMI i Danmark krev nøkkel; data.norge.no og Energi Data Service manglar CORS; opingogn.is
har ikkje lenger eit søkje-API. Kjelder utan CORS kan ikkje nåast direkte frå nettlesaren; dei krev ein eigen proxy, sjå nedanfor.

Geodatakjelder (familien `geodata` med `kind` `wfs`, `ogcapi` eller `arcgis`) blir leverte utan endepunkt: laga blir lesne frå
tenesta når kjelda blir opna og lagra i din kopi av konfigurasjonen. Førehandsinnstilte: SCB opne geodata, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen (ArcGIS), Kartverket (administrative einingar, eigedomskart),
Statistikcentralen, SYKE (ArcGIS) og, med nøkkel, geodataplattforma til Lantmäteriet (reguleringsplanar). Kjelda
*Geodataportalen (sök geodata)* (familien `geoportal`, svarformatet `geonetwork`) søkjer i den svenske nasjonale katalogen.
Sjå [kallor.md](kallor.md#opne-geodata).

## Slik gjer du

1. Opne modusen **Hent**, og vel ei kjelde under **Opne API-ar** i objektpanelet. Landknappane over lista avgrensar henne til
   valde land.
2. Krev kjelda ein nøkkel, oppgjev du han under **Autentisering**. Vel **Bruk i denne sesjonen** (blir gløymd når sida blir lukka)
   eller **Lagre kryptert** med ein passordfrase.
3. Bla eller søk fram det du vil ha. For PxWeb-tenestene (SSB, SCB, dei andre nordiske statistikkbyråa,
   Folkhälsomyndigheten), Danmarks Statistik, FHI og Socialstyrelsen vel du verdiar per variabel; talet på celler blir vist,
   og utval over grensa til tenesta blir automatisk delte opp i fleire kall. For dei andre kjeldene fyller du inn parametrane
   til kallet. Lister (stasjonar, kommunar, produkt) blir henta frå tenesta når du opnar feltet.
4. Trykk **Hent**. Framdrifta blir vist og kan avbrytast. **Førehandsvis første side** hentar berre eitt kall.
5. Gå gjennom tabellen, og trykk **Lagre som datasett**, eller legg radene til i eit eksisterande datasett (legg til eller
   erstatt). Datasettet får kjelda i skildringa si: utgjevar, tabell, adresse og lisens.

Eigenskapspanelet viser utgjevar, lisens, fartsgrense og dei siste kalla med status og svartid.

## Oppdater eit henta datasett

Datasett som kjem frå eit API, hugsar kjelda og utvalet. Under **Lagra hentingar** i Hent blir dei viste med kjelde, siste
henting og tal på rader. **Oppdater** hentar dei same dataa igjen, erstattar radene og spelar av oppskrifta til datasettet,
slik at reinsingar og utrekna kolonnar kjem tilbake; **Oppdater alle** gjer det for alle etter tur, og kommandopaletten
og Handter tilbyr det same som **Hent API-datasett igjen**. Mislukkast hentinga eller eit oppskriftssteg, blir datasettet
ståande som det var, og feilen blir vist. Eit oppskriftssteg som treng ein løyndom (til dømes ein nøkkel for
pseudonymisering), kan ikkje spelast av automatisk. I **Handter** finst òg **Hent igjen**, der du vel mellom å
oppdatere og å leggje dei nye radene sist utan å køyre oppskrifta.

## Nøklar og tryggleik

- Nøklar blir aldri lagra i klartekst. Som standard finst dei berre i minnet under sesjonen.
- **Lagre kryptert** krypterer nøkkelen med ein passordfrase (PBKDF2 og AES-GCM) i databasen til nettlesaren. Same passordfrase
  gjeld for alle lagra nøklar. Passordfrasen blir ikkje lagra; gløymer du han, må du oppgje nøklane på nytt.
- Når appen blir opna igjen, er lagra nøklar låste til du oppgjev passordfrasen (**Lås opp lagra nøklar**).
- Nøklar blir berre sende til adressa som konfigurasjonen oppgjev, og følgjer aldri med når ein konfigurasjon blir eksportert eller
  arbeidsområdet tryggingskopiert.
- Under file:// deler alle lokalt opna HTML-sider lagring i Chromium. Difor er kryptering standard for lagra nøklar.

### Skaffe nøklar

- **Boverket**: registrer deg i [API-portalen til Boverket](https://api-portal.boverket.se/), abonner på API-et for
  energiattestar og kopier abonnementsnøkkelen. Dataspatium sender han i headeren `Ocp-Apim-Subscription-Key`. Boverket tillèt
  10 kall per 2 sekund og 1 500 per døgn.
- **Lantmäteriet Direkt**: opprett ein konto i [Geotorget](https://geotorget.lantmateriet.se/), legg til produktet Ortnamn
  Direkt (opne data, gratis) og opprett API-nøklar. Oppgje klient-id (consumer key) og klientløyndom (consumer secret);
  Dataspatium hentar eit tilgangstoken frå `https://api.lantmateriet.se/token` og fornyar det når det går ut.
- **Trafikverket**: opprett ein gratis konto på [data.trafikverket.se](https://data.trafikverket.se/) og kopier nøkkelen.
  Dataspatium sender han i XML-kroppen (`<LOGIN authenticationkey="…"/>`), aldri i adressa.

## Proxy for tenester utan CORS

Under **Fleire alternativ** i eigenskapspanelet kan du oppgje adressa til ein proxy som du sjølv driftar, til dømes
`https://min-proxy.døme/?url={url}`. `{url}` blir erstatta med den koda måladressa; manglar `{url}`, blir måladressa
lagd til sist. Dataspatium leverer ingen proxy og sender aldri noko til ein annan tenar enn den du sjølv oppgjev.

## Konfigurasjonsformat

Ei kjelde blir skildra av ei JSON-fil med endinga `.api.json`. Eigne konfigurasjonar blir lagde til med **Legg til API frå fil** og
kan eksporterast med **Eksporter konfigurasjon** for å delast. Førehandsinnstillingane ligg i `presets/api/` i appmappa og er
gode å ta utgangspunkt i. Grunnspråket i fila er svensk; omsetjingar blir lagde i feltet `i18n` per språk, og appen viser
tekstane på sitt eige språk. Formatet er skildra i heilskap i den [engelske rettleiinga](../en/api-konfiguration.md) og
den [svenske](../sv/api-konfiguration.md).

### Felt på toppnivå

Felta på toppnivå er `format`, `id`, `name`, `publisher`, `description`, `docs`, `license`, `notes`, `level` (1 = ingen nøkkel, 2 = nøkkel), `country` (`SE`, `DK`, `NO`, `FI`, `IS`, `FO`, `GL`, `AX`, `NORDIC`, `EU`, `INT`), `i18n`, `baseUrl`, `headers`, `auth`, `rateLimit`, `cors`, `family` (`pxweb`, `statbank`, `fhi`, `socialstyrelsen`) og `endpoints`.

### Endpoint

Eit endpoint har `id`, `name`, `description`, `method`, `path`, `headers`, `params`, `body`, `bodyType`, `pagination`, `response`, `dataset`.

### Parameter

Ein parameter har `name`, `in`, `type`, `label`, `help`, `example`, `required`, `default`, `hidden`, `raw`, `template`, `optionsFrom`.

### Tabellen som blir laga

JSON-postar blir flata ut (nøsta objekt blir kolonnar med punktum i namnet, lister blir JSON-tekst). JSON-stat gjev éi rad per
celle med ein kode- og ein tekstkolonne per dimensjon, ein tidskolonne og éin verdikolonne per mål. SDMX-JSON gjev éi rad per
observasjon: for kvar dimensjon ein kodekolonne (`<namn>_kod`) og ein tekstkolonne når kodane har tekstar, tidsperioden, verdien
(`varde`) og serie- og observasjonsattributta som har verdiar. Kolonnenamn blir reinsa som ved filimport (å, ä, ö blir a, a, o),
og typar blir utleidde med desimalpunktum; kodar med innleiande nullar blir verande tekst.

## Skriv ein eigen konfigurasjon

1. Les dokumentasjonen til tenesta, og prøv eit kall i nettlesaren eller med `curl`.
2. Kontroller CORS: `curl -s -D - -o /dev/null -H "Origin: null" "https://api.døme.no/..."` skal vise
   `Access-Control-Allow-Origin: *` (eller `null`). Manglar linja, fungerer tenesta berre via proxy.
3. Ta utgangspunkt i ei førehandsinnstilling i `presets/api/`, endre henne, og lagre som `mi-teneste.api.json`.
4. Legg til fila i Hent. Feil i konfigurasjonen blir viste med feltnamn; formatet blir kontrollert mot eit skjema
   (`src/api/schema.js`).
5. Del fila. Ho inneheld aldri nøklar.

## Avgrensingar

- Vilkåra til MET Norway krev at kallande program identifiserer seg med ein User-Agent. Nettlesarar sender sin eigen
  identifikasjon, som tenesta godtek i dag; hald talet på kall lågt.
- SDMX blir lese som SDMX-JSON 1.0 eller 2.0 (datameldingar; ECB og OECD sender det med parameteren `format=jsondata`
  eller ein `Accept`-header). SDMX-ML og SDMX-CSV blir ikkje tolka. JSON-stat 1.x (Danmarks Statistik) og 2.0 blir begge lesne.
- PX-filer blir ikkje tolka i JavaScript; hent JSON-stat, eller bruk pakken pxR i R.
- Store svar (hundretusenvis av rader) tek tid å tolke i nettlesaren. Avgrens utvalet, eller bruk `maxPages`.
- Kall blir berre gjorde når du trykkjer Hent eller opnar eit felt med alternativ frå tenesta.
