# Åpne API-er og API-konfigurasjoner

Dataspatium henter data direkte fra åpne API-er til nettleseren din. Ingenting går via noen server: kallene går fra
datamaskinen din til etatens tjeneste, og svaret blir et datasett i arbeidsområdet. Det forutsetter at tjenesten tillater
kall fra nettlesere (CORS); alle forhåndsinnstillingene nedenfor er kontrollert for det.

## Forhåndsinnstilte kilder

Listen i Hent er gruppert etter land. Landknappene over den (Sverige, Danmark, Norge, Finland, Island, Færøyene, Grønland,
Åland, Norden, EU, Internasjonalt) velger hvilke lands kilder som vises; valget lagres i nettleseren. Kildenes navn og beskrivelser følger
appens språk, og PxWeb-tjenester som finnes på flere språk (SCB, SSB, Statistikcentralen, Hagstofa, Grønlands Statistik,
ÅSUB), blas på appens språk når tjenesten har det. Alle kildene nedenfor er kontrollert for CORS i november 2026, og bare de
to siste svenske krever nøkkel.

### Sverige og EU

| Land | Kilde | Hva | Slik henter du |
|---|---|---|---|
| EU | Eurostat | EU-statistikk | Angi datasettets kode og filtre |
| EU | Den europeiske sentralbanken (ECB) | Valutakurser og ECBs statistikk (SDMX) | Velg valutaer og frekvens for valutakursene, eller angi dataflyt og serienøkkel |
| Internasjonalt | OECD | Arbeidsledighet, BNP-vekst og OECDs øvrige statistikk (SDMX) | Velg land, eller angi dataflyt og serienøkkel |
| Sverige | SCB Statistikdatabasen (API v1 og v2) | Offisiell statistikk | Bla eller søk, velg verdier |
| Sverige | Folkhälsomyndigheten, Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, Lantmäteriets geodatakatalog, Sveriges dataportal | Folkehelse, helse, nøkkeltall for kommuner, vær, luftkvalitet, verneområder, geodata | Se den svenske veiledningen |
| Sverige | Lantmäteriet Direkt, Boverket, Trafikverket NVDB, Lantmäteriet STAC | Stedsnavn, energiattester, vegdata, geodatafiler | Krever nøkkel |
| Sverige, internasjonalt | Riksbanken (SWEA), Verdensbanken | Renter, valutakurser, utviklingsindikatorer | Bare via broen |

### Resten av Norden

| Land | Kilde | Hva | Slik henter du |
|---|---|---|---|
| Norge | SSB Statistikkbanken (API v1 og v2) | Offisiell statistikk, norsk og engelsk | Bla i emnetreet eller søk tabell, velg verdier; 800 000 celler per kall |
| Norge | FHI Statistikk | Folkehelsestatistikk fra Folkehelseinstituttets registre og statistikkbanker | Velg kilde, tabell og verdier per dimensjon (målene i MEASURE_TYPE) |
| Norge | Enhetsregisteret (Brønnøysundregistrene) | Foretak og organisasjoner | Søk på navn, kommune, organisasjonsform eller næringskode |
| Norge | Kartverket kommuneinfo | Kommuner og fylker | Hent listene, også kommuner per fylke |
| Norge | MET Norway Locationforecast | Værvarsel per koordinat | Angi bredde- og lengdegrad |
| Danmark | Danmarks Statistik Statistikbanken | Offisiell statistikk (api.statbank.dk) | Bla i emnetreet, velg tabell og verdier per variabel; variabler som ikke velges, summeres bort |
| Danmark | Open Data DK | Danske kommuners og regioners dataportal | Søk datasett, én rad per fil, importer filen via Fra nettadresse |
| Finland | Statistikcentralen StatFin | Offisiell statistikk, finsk, svensk og engelsk | Bla i emnetreet, velg verdier; 100 000 celler per kall |
| Finland | Kommunenes nøkkeltall (Statistikcentralen) | Nøkkeltall per kommune og velferdsområde | Bla, velg verdier |
| Finland | Sotkanet (THL) | Indikatorer for helse og velferd | Hent indikatorer og regioner, deretter verdier for en indikator og år |
| Finland | YTJ foretaksregister (PRH) | Foretak | Søk på navn, sted, FO-nummer eller bransje |
| Finland | Digitraffic veivær (Fintraffic) | Veiværstasjoner og målinger | Hent stasjoner (punktkart) og siste målinger |
| Finland | Meteorologisk institutt FMI | Værobservasjoner per sted eller stasjon | Angi sted eller stasjons-id, parametere og periode |
| Finland | Avoindata.fi | Finlands dataportal | Søk datasett, én rad per fil |
| Island | Hagstofa Íslands | Offisiell statistikk, islandsk og engelsk | Bla i databasene, velg verdier; 10 000 celler per kall |
| Island | Veðurstofa Íslands | Værobservasjoner per stasjon | Angi stasjonsnumre |
| Grønland | Grønlands Statistik | Offisiell statistikk, dansk og engelsk | Bla, velg verdier |
| Færøyene | Hagstova Føroya | Offisiell statistikk, engelsk | Bla, velg verdier |
| Åland | ÅSUB | Offisiell statistikk, svensk og engelsk | Bla, velg verdier |
| Norden | Nordic Statistics database | Sammenlignbar nordisk statistikk, engelsk | Bla, velg verdier |

Ikke med: Norges Frost (MET) og Danmarks DMI krever nøkkel; data.norge.no og Energi Data Service mangler CORS; opingogn.is
har ikke lenger et søke-API. Kilder uten CORS kan ikke nås direkte fra nettleseren; de krever en egen proxy, se nedenfor.

Geodatakilder (familien `geodata` med `kind` `wfs`, `ogcapi` eller `arcgis`) leveres uten endepunkter: lagene leses fra
tjenesten når kilden åpnes og lagres i din kopi av konfigurasjonen. Forhåndsinnstilte: SCB åpne geodata, SGU, Havs- och
vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen (ArcGIS), Kartverket (administrative enheter, eiendomskart),
Statistikcentralen, SYKE (ArcGIS) og, med nøkkel, Lantmäteriets geodataplattform (reguleringsplaner). Kilden
*Geodataportalen (sök geodata)* (familien `geoportal`, svarformatet `geonetwork`) søker i den svenske nasjonale katalogen.
Se [kallor.md](kallor.md#åpne-geodata).

## Slik gjør du

1. Åpne modusen **Hent**, og velg en kilde under **Åpne API-er** i objektpanelet. Landknappene over listen begrenser den til
   valgte land.
2. Krever kilden en nøkkel, angir du den under **Autentisering**. Velg **Bruk i denne sesjonen** (glemmes når siden lukkes)
   eller **Lagre kryptert** med en passordfrase.
3. Bla eller søk fram det du vil ha. For PxWeb-tjenestene (SSB, SCB, de andre nordiske statistikkbyråene,
   Folkhälsomyndigheten), Danmarks Statistik, FHI og Socialstyrelsen velger du verdier per variabel; antallet celler vises,
   og utvalg over tjenestens grense deles automatisk opp i flere kall. For de øvrige kildene fyller du inn kallets
   parametere. Lister (stasjoner, kommuner, produkter) hentes fra tjenesten når du åpner feltet.
4. Trykk **Hent**. Framdriften vises og kan avbrytes. **Forhåndsvis første side** henter bare ett kall.
5. Gå gjennom tabellen, og trykk **Lagre som datasett**, eller legg radene til i et eksisterende datasett (legg til eller
   erstatt). Datasettet får kilden i beskrivelsen sin: utgiver, tabell, adresse og lisens.

Egenskapspanelet viser utgiver, lisens, hastighetsgrense og de siste kallene med status og svartid.

## Oppdater et hentet datasett

Datasett som kommer fra et API, husker kilden og utvalget. Under **Lagrede hentinger** i Hent vises de med kilde, siste
henting og antall rader. **Oppdater** henter de samme dataene igjen, erstatter radene og spiller av datasettets oppskrift,
slik at rensinger og beregnede kolonner kommer tilbake; **Oppdater alle** gjør det for alle etter tur, og kommandopaletten
og Håndter tilbyr det samme som **Hent API-datasett igjen**. Mislykkes hentingen eller et oppskriftssteg, blir datasettet
stående som det var, og feilen vises. Et oppskriftssteg som trenger en hemmelighet (for eksempel en nøkkel for
pseudonymisering), kan ikke spilles av automatisk. I **Håndter** finnes også **Hent igjen**, der du velger mellom å
oppdatere og å legge de nye radene sist uten å kjøre oppskriften.

## Nøkler og sikkerhet

- Nøkler lagres aldri i klartekst. Som standard finnes de bare i minnet under sesjonen.
- **Lagre kryptert** krypterer nøkkelen med en passordfrase (PBKDF2 og AES-GCM) i nettleserens database. Samme passordfrase
  gjelder for alle lagrede nøkler. Passordfrasen lagres ikke; glemmer du den, må du angi nøklene på nytt.
- Når appen åpnes igjen, er lagrede nøkler låst til du angir passordfrasen (**Lås opp lagrede nøkler**).
- Nøkler sendes bare til adressen som konfigurasjonen angir, og følger aldri med når en konfigurasjon eksporteres eller
  arbeidsområdet sikkerhetskopieres.
- Under file:// deler alle lokalt åpnede HTML-sider lagring i Chromium. Derfor er kryptering standard for lagrede nøkler.

### Skaffe nøkler

- **Boverket**: registrer deg i [Boverkets API-portal](https://api-portal.boverket.se/), abonner på API-et for energiattester
  og kopier abonnementsnøkkelen. Dataspatium sender den i headeren `Ocp-Apim-Subscription-Key`. Boverket tillater 10 kall per
  2 sekunder og 1 500 per døgn.
- **Lantmäteriet Direkt**: opprett en konto i [Geotorget](https://geotorget.lantmateriet.se/), legg til produktet Ortnamn
  Direkt (åpne data, gratis) og opprett API-nøkler. Oppgi klient-id (consumer key) og klienthemmelighet (consumer secret);
  Dataspatium henter et tilgangstoken fra `https://api.lantmateriet.se/token` og fornyer det når det utløper.
- **Trafikverket**: opprett en gratis konto på [data.trafikverket.se](https://data.trafikverket.se/) og kopier nøkkelen.
  Dataspatium sender den i XML-kroppen (`<LOGIN authenticationkey="…"/>`), aldri i adressen.

## Proxy for tjenester uten CORS

Under **Flere alternativer** i egenskapspanelet kan du angi adressen til en proxy som du selv drifter, for eksempel
`https://min-proxy.eksempel/?url={url}`. `{url}` erstattes med den kodede måladressen; mangler `{url}`, legges måladressen
til sist. Dataspatium leverer ingen proxy og sender aldri noe til en annen server enn den du selv angir.

## Konfigurasjonsformat

En kilde beskrives av en JSON-fil med endelsen `.api.json`. Egne konfigurasjoner legges til med **Legg til API fra fil** og
kan eksporteres med **Eksporter konfigurasjon** for å deles. Forhåndsinnstillingene ligger i `presets/api/` i appmappen og er
gode å ta utgangspunkt i. Filens grunnspråk er svensk; oversettelser legges i feltet `i18n` per språk, og appen viser
tekstene på sitt eget språk. Formatet er beskrevet i sin helhet i den [engelske veiledningen](../en/api-konfiguration.md) og
den [svenske](../sv/api-konfiguration.md).

### Felt på toppnivå

Feltene på toppnivå er `format`, `id`, `name`, `publisher`, `description`, `docs`, `license`, `notes`, `level` (1 = ingen nøkkel, 2 = nøkkel), `country` (`SE`, `DK`, `NO`, `FI`, `IS`, `FO`, `GL`, `AX`, `NORDIC`, `EU`, `INT`), `i18n`, `baseUrl`, `headers`, `auth`, `rateLimit`, `cors`, `family` (`pxweb`, `statbank`, `fhi`, `socialstyrelsen`) og `endpoints`.

### Endpoint

Et endpoint har `id`, `name`, `description`, `method`, `path`, `headers`, `params`, `body`, `bodyType`, `pagination`, `response`, `dataset`.

### Parameter

En parameter har `name`, `in`, `type`, `label`, `help`, `example`, `required`, `default`, `hidden`, `raw`, `template`, `optionsFrom`.

### Tabellen som opprettes

JSON-poster flates ut (nestede objekter blir kolonner med punktum i navnet, lister blir JSON-tekst). JSON-stat gir én rad per
celle med en kode- og en tekstkolonne per dimensjon, en tidskolonne og én verdikolonne per mål. SDMX-JSON gir én rad per
observasjon: for hver dimensjon en kodekolonne (`<navn>_kod`) og en tekstkolonne når kodene har tekster, tidsperioden, verdien
(`varde`) og serie- og observasjonsattributtene som har verdier. Kolonnenavn renses som ved filimport (å, ä, ö blir a, a, o), og
typer utledes med desimalpunktum; koder med innledende nuller forblir tekst.

## Skriv en egen konfigurasjon

1. Les tjenestens dokumentasjon, og prøv et kall i nettleseren eller med `curl`.
2. Kontroller CORS: `curl -s -D - -o /dev/null -H "Origin: null" "https://api.eksempel.no/..."` skal vise
   `Access-Control-Allow-Origin: *` (eller `null`). Mangler linjen, fungerer tjenesten bare via proxy.
3. Ta utgangspunkt i en forhåndsinnstilling i `presets/api/`, endre den, og lagre som `min-tjeneste.api.json`.
4. Legg til filen i Hent. Feil i konfigurasjonen vises med feltnavn; formatet kontrolleres mot et skjema
   (`src/api/schema.js`).
5. Del filen. Den inneholder aldri nøkler.

## Begrensninger

- MET Norways vilkår krever at kallende programmer identifiserer seg med en User-Agent. Nettlesere sender sin egen
  identifikasjon, som tjenesten godtar i dag; hold antallet kall lavt.
- SDMX leses som SDMX-JSON 1.0 eller 2.0 (datameldinger; ECB og OECD sender det med parameteren `format=jsondata`
  eller en `Accept`-header). SDMX-ML og SDMX-CSV tolkes ikke. JSON-stat 1.x (Danmarks Statistik) og 2.0 leses begge.
- PX-filer tolkes ikke i JavaScript; hent JSON-stat, eller bruk pakken pxR i R.
- Store svar (hundretusener av rader) tar tid å tolke i nettleseren. Begrens utvalget, eller bruk `maxPages`.
- Kall gjøres bare når du trykker Hent eller åpner et felt med alternativer fra tjenesten.
