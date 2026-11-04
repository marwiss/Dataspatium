[Svenska](../../README.md) · [Dansk](../da/README.md) · **Norsk** · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · [English](../en/README.md)

# Dataspatium

Dataspatium er en nettapp for data fra kilde til rapport: hent data fra filer og åpne API-er, lagre og håndter datasett,
gå gjennom og rett verdier, analyser med R, visualiser og eksporter. Alt kjører i din egen nettleser. Ingen server, ingen
installasjon, ingen kontoer. Dataene dine forlater aldri datamaskinen med mindre du selv eksporterer dem.

![Dataspatium i modusen Bearbeid med en tabell over svenske kommuner](../images/bearbeta.png)

Brukergrensesnittet finnes på svensk, dansk, norsk, finsk, islandsk og engelsk. Skjermbildene i dokumentasjonen viser
appen på svensk.

## Last ned og kom i gang

1. **Last ned.** Gå til den [siste utgivelsen](https://github.com/marwiss/Dataspatium/releases/latest), og hent ZIP-filen
   under *Assets* (`dataspatium-<versjon>.zip`, rundt 100 MB; R og alle R-pakker er med).
2. **Pakk ut.** Høyreklikk på ZIP-filen, og velg *Pakk ut alle* (Windows), eller dobbeltklikk på den (macOS). Legg mappen
   der du vil ha den, for eksempel i Dokumenter. Appen fungerer ikke direkte inne i ZIP-filen.
3. **Åpne.** Dobbeltklikk på `index.html` i mappen, eller dra filen til et nettleservindu. Hvis Windows spør hvilken app som
   skal brukes, velger du Edge, Chrome eller Firefox. Første gang spør appen hvilket språk du vil ha (det kan endres med
   språkknappen øverst til høyre), og starter deretter **grunnkurset**, en interaktiv gjennomgang av alle moduser med
   eksempeldata som tar omtrent ti minutter. Åpne det igjen fra hjelpen (?).
4. **Importer.** I modusen *Hent* slipper du en fil på flaten (eller klikker på *Prøv med eksempeldata*), kontrollerer
   kolonnetypene og klikker på *Importer*. Datasettet lagres i nettleseren på datamaskinen din.
5. **Arbeid videre.** Bytt modus øverst: *Håndter* viser datasettene dine og arbeidsområdet, *Søk* finner rader i dem,
   *Bearbeid* viser tabellen med sortering, filtre og handlinger, *Analyser* åpner R- og SQL-konsollen, *Visualiser*
   lager diagrammer, *Eksporter* laster ned data, diagrammer og dokumenter, og *Del* gir dem til andre.

Data lagres i nettleserens egen database. Sletter du nettstedsdata, forsvinner de, så ta sikkerhetskopi regelmessig under
*Håndter > Arbeidsområde*. Sikkerhetskopien er en ZIP-fil som kan gjenopprettes på samme eller en annen datamaskin. Trinn
for trinn med flere detaljer: [kom-igang.md](kom-igang.md).

Appen finnes også direkte på nettet, uten nedlasting: <https://marwiss.github.io/Dataspatium/>. Fra en nettserver kan
den installeres som egen app (Edge og Chrome: *Installer* i adressefeltet) og fungerer deretter også uten nettverk.
Nettversjonen og mappeversjonen har atskilte arbeidsområder; flytt data mellom dem med en sikkerhetskopi eller en pakke.

## Hva som kreves

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (versjon 120 eller nyere) eller Firefox (versjon 128 eller nyere). Safari støttes ikke.
- Rundt 300 MB ledig plass til appmappen og minst 4 GB minne (8 GB anbefales for store datasett). Det kreves ingen
  administratorrettigheter.
- Internett trengs bare når du henter data fra åpne API-er, sender til GitHub, ser etter oppdateringer eller henter en
  komponent eller en R-pakke som ikke følger med i mappen; appen spør om lov først.

## Hva du kan gjøre

- **Hente**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, SDMX-JSON-, GeoJSON-, XML-, SQLite-, GeoPackage- og shapefile-filer, tabeller i HTML-, Markdown-, Word- og LaTeX-dokumenter, kartfiler i KML, KMZ, GPX og TopoJSON, SQL-skript, eldre regnearkformater (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), tekst med fast
  kolonnebredde, statistikkfiler fra SPSS, Stata og SAS (med verdietiketter) og PX-formatet samt Parquet og RDS (via R), innlimt tekst, filer fra
  nettadresser og data direkte fra åpne API-er hos SSB, Folkehelseinstituttet, Brønnøysundregistrene, Kartverket, MET
  Norway, Danmarks Statistik, Open Data DK, Statistikcentralen, THL, PRH, Fintraffic, Meteorologiska institutet, Hagstofa
  Íslands, Veðurstofa Íslands, Grønlands Statistik, Hagstova Føroya, ÅSUB, Nordic Statistics, Eurostat, ECB, OECD og svenske
  etater som SCB, Kolada og SMHI, med landfilter og lagrede hentinger som oppdateres med ett klikk og spiller av
  oppskriftene sine (se [api-konfiguration.md](api-konfiguration.md)). Eksempeldata og kommune- og regiongrenser for
  Sverige, Danmark, Norge og Finland følger med.
- **Databaser**: Access-filer leses rett i nettleseren; databaser på datamaskinen eller i nettverket (SQL Server, ODBC,
  Excel, SQLite) nås gjennom en lokal bro, og PostgREST/Supabase, OData, GraphQL, CouchDB, ClickHouse, Elasticsearch,
  SPARQL, InfluxDB, Google Sheets og Airtable blir kilder med ett klikk. Filer kan lenkes og leses inn igjen fra disken
  (se [kallor.md](kallor.md)).
- **Bearbeide**: bla gjennom, sortere og filtrere store tabeller, redigere celler, rense, sette typer, omkode, dele inn i klasser, rangere, beregne andeler, løpende summer og endringer, pivotere og
  koble data, kontrollere datakvalitet med profil og regler (blant annet formater, nordiske identitetsnumre, referanser til andre datasett og avvikende verdier), pseudonymisere personnumre før deling, med angre, versjoner og
  oppskrifter som kan eksporteres som R eller SQL (se [bearbeta.md](bearbeta.md)).
- **Analysere**: en innebygd R-konsoll med ggplot2 og tidyverse (se [r-guide.md](r-guide.md)), en SQL-konsoll der datasett
  kobles med join via kortnavnene sine, og notatbøker med tekst-, R- og SQL-celler som blir rapporter i HTML, Word, PDF,
  Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)), og en Regex-fane der regulære uttrykk prøves på en kolonne og brukes til å filtrere, hente ut, erstatte og dele opp (se [regex.md](regex.md)), helt i nettleseren.
- **Visualisere**: diagrammer med Vega-Lite (inkludert koroplettkart og punktkart, faste aksegrenser, logaritmisk skala, referanselinjer og trendlinjer), D3-maler eller R, eksportert som SVG,
  PNG, PDF og PowerPoint, også i batch per gruppe, og dashbord med felles filtre som blir HTML eller PowerPoint (se
  [visualisera.md](visualisera.md)).
- **Dokumentere**: rapporter og kodebøker fra maler som HTML, Word, PDF, Markdown eller LaTeX, også ett dokument per kommune
  eller år (se [dokumentmallar.md](dokumentmallar.md)).
- **Eksportere og dele**: data til CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata og RDS; i modusen
  *Del* pakker med valgte datasett og objekter, en melding og en endringslogg, synkronisering med et GitHub-repository,
  datamaskinens delingsmeny og publisering av dashbord og dokumenter som frittstående HTML (se [dela.md](dela.md));
  direkte overføring til telefoner og andre datamaskiner på samme nettverk med QR-kode og kontrollkode, og
  *Dataspatium Mobil*, som tar imot, viser og sender videre på telefonen (se [mobil.md](mobil.md)); gjennomgang av
  personopplysninger før noe deles; kommentarer til datasett og kolonner, sikkerhetskopi av arbeidsområdet som ZIP
  og, i Edge og Chrome, en portabel mappe med vanlige filer.
- **Holde orden**: mapper og tagger for datasett, filter og sortering, og batchhandlinger på flere datasett på én gang
  (ordne, pakke, eksportere, hente igjen, kjøre oppskrift, slette).
- **Finne raskt**: modusen *Søk* leter i alle kolonner i ett eller alle datasett, med fasetter som avgrenser, og lagrede
  lister (se [soka.md](soka.md)); kommandopaletten (Ctrl+K) bytter modus, åpner datasett, diagrammer og dashbord og
  kjører handlinger fra ett søkefelt.
- **Spør uten kode**: fanen *Spørring* i Søk kobler datasett, velger kolonner og beregninger, setter betingelser og
  viser SQL-koden som lages; lagrede lister avgrenser tabellen i Bearbeid og radene i diagrammer.
- **Hjelp i appen og presentasjon**: hele håndboken med søk åpnes med ? eller F1 ved kapittelet for modusen du står
  i, og **Presenter** viser et dashbord i hele vinduet ett diagram om gangen.
- **Seks språk**: brukergrensesnitt, meldinger og dokumentasjon på svensk, dansk, norsk (bokmål), finsk, islandsk og
  engelsk.
- **Grunnkurs**: en interaktiv gjennomgang av alle åtte moduser med eksempeldata, på alle seks språk. Det vises første
  gang appen åpnes og kan åpnes når som helst fra hjelpen eller kommandopaletten.

## Lær mer

Filnavnene er de samme på alle språk (de svenske originalene), så lenkene virker likt overalt.

- **Håndboken** i appen: den samme dokumentasjonen som her, med søk; åpne den med ? øverst til høyre eller F1.
- **Grunnkurset** i appen: en interaktiv gjennomgang av alle moduser med eksempeldata; åpne det fra hjelpen (?) eller
  med Ctrl+K.
- [Kom i gang](kom-igang.md): trinn for trinn med vanlige spørsmål.
- [Brukerveiledning](anvandarguide.md): hele arbeidsflyten fra fil til rapport.
- [Vanlige spørsmål](faq.md): lagring, sikkerhet, R, API-er og oppdateringer.
- [De åtte modusene](lagen.md): hva som finnes hvor og hvorfor.
- [Søk](soka.md) og [Del](dela.md): finn uten kode, og gi data til andre.
- [Dataspatium Mobil](mobil.md): telefonen som kurer, mottaker og viser; overføring mellom enheter.
- [Notatbok](anteckningsbok.md): tekst, R og SQL i celler som blir en rapport.
- [Regulære uttrykk](regex.md): mønstre for å analysere, rette og dele opp tekst i datasett.
- [Formater og import](format.md): filformater, tegnkoding, desimaltegn, datoer og kolonnetyper.
- [Åpne API-er](api-konfiguration.md): de forhåndsinnstilte kildene, nøkler og egne konfigurasjoner.
- [R i Dataspatium](r-guide.md): R-konsollen, `dm_read()`, `dm_write()` og de medfølgende pakkene.
- [Visualiser](visualisera.md): diagrambyggeren, D3-maler, R-diagrammer, kart og dashbord.
- [Dokumenter og maler](dokumentmallar.md): malspråket og utdataformatene.
- [Lisenser](licenser.md): hva du kan gjøre med appen, og hvilke lisenser tredjepartskomponentene har.
- [Utvikling](../utveckling.md), [Arkitektur](../arkitektur.md) og [Stilguide](../stilguide.md) for dem som vil forstå
  koden (på svensk); hvordan bidrag tas imot, står i [CONTRIBUTING.md](../../CONTRIBUTING.md) (svensk).
- Eksterne ressurser: [WebR](https://docs.r-wasm.org/webr/latest/), [R for nybegynnere](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [SSBs API](https://www.ssb.no/api).

## Begrensninger i korte trekk

- Appen må åpnes fra en utpakket mappe (file://) eller en vanlig nettserver; den fungerer ikke direkte inne i en ZIP-fil.
- API-er uten CORS-støtte (for eksempel data.norge.no) kan ikke kalles direkte fra nettleseren.
- Et datasett bør holde seg under et par millioner rader; nettleserens minne setter grensen.
- Når appen åpnes fra en mappe, kan R-kode ikke avbrytes midt i en beregning; bruk *Start R på nytt*. Fra en
  nettserver (localhost eller https) finnes knappen *Avbryt*.
- Flere faner fungerer og holder hverandre oppdatert, men ikke rediger samme datasett i to faner samtidig: den som lagrer
  sist, vinner.
- Den portable mappen krever Edge eller Chrome; Firefox mangler mappetilgang (File System Access). Sikkerhetskopi som ZIP
  fungerer overalt.
- Hele appen er laget for datamaskiner; på telefoner og nettbrett brukes Dataspatium Mobil
  (<https://marwiss.github.io/Dataspatium/m/>), som tar imot, viser og sender videre. Safari støttes ikke for hele
  appen. I smale vinduer åpnes panelene som ark over arbeidsflaten.
- De medfølgende eksempeldataene og kartgrensene er svenske; selve appen fungerer med data fra hvor som helst.

## Feil og forslag

Rapporter feil eller ønsker som *Issues* her på GitHub. Beskriv nettleser, versjon av Dataspatium (vises under
hjelpeknappen) og hva du gjorde. Se [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Utvikling

- Ingen byggetrinn, ingen node.js. Åpne `index.html` direkte, eller server mappen med `python -m http.server 8080`.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` etterfulgt av `python tools/wrap_assets.py`.
- Tester: `powershell -File tools/run-tests.ps1` (headless Edge og Firefox). Se [utveckling.md](../utveckling.md) (svensk).

## Lisens

Dataspatiums egen kode, dokumentasjon og forhåndsinnstillinger (alt unntatt `vendor/`) er lisensiert under
[PolyForm Strict 1.0.0](../../LICENSE): fri å laste ned og bruke til ikke-kommersielle formål, også i offentlige etater og
andre offentlige institusjoner, men ikke å endre, bygge videre på eller distribuere videre uten skriftlig tillatelse.
Lisensgiver er Dataspatiums opphavsperson, som kan kontaktes via GitHub-kontoen [marwiss](https://github.com/marwiss); opprett
et issue for andre vilkår. Hva lisensen betyr i praksis, forklares i [licenser.md](licenser.md).

Tredjepartskomponenter i `vendor/` har egne lisenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), se
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og de GPL-lisensierte R-pakkene distribueres uendret; kildekoden
finnes hos [R-prosjektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr) og
[CRAN](https://cran.r-project.org/) i versjonene som er oppgitt der.
