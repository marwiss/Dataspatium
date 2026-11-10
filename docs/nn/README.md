[Svenska](../../README.md) · [Dansk](../da/README.md) · [Norsk bokmål](../nb/README.md) · **Norsk nynorsk** · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · [English](../en/README.md)

<img src="../../src/ui/design/icon-192.png" alt="" width="64" height="64" align="left">

# Dataspatium OpenCDE-klient

Dataspatium er ein nettapp for data frå kjelde til rapport: hent data frå filer og opne API-ar, lagre og handter datasett,
gå gjennom og rett verdiar, analyser med R, visualiser og eksporter. Alt køyrer i din eigen nettlesar. Ingen tenar, ingen
installasjon, ingen kontoar. Dataa dine forlèt aldri datamaskina med mindre du sjølv eksporterer dei. Tryggleiken er det første kravet: ingen nettverkskall utan di handling og ditt samtykke, løyndomar berre krypterte, komponentar låste og kontrollerte, og alt som blir delt, blir gått gjennom først.

![Dataspatium i modusen Bearbeid med ein tabell over svenske kommunar](../images/bearbeta.png)

**Innhald**

- [Last ned og kom i gang](#last-ned-og-kom-i-gang)
- [Kva som krevst](#kva-som-krevst)
- [Kva du kan gjere](#kva-du-kan-gjere)
- [OpenCDE-API-ane og klientane deira](#opencde-api-ane-og-klientane-deira)
- [Dataspatium og Dataregium](#dataspatium-og-dataregium)
- [Lær meir](#lær-meir)
- [Avgrensingar i korte trekk](#avgrensingar-i-korte-trekk)
- [Personopplysningar](#personopplysningar)
- [Neste i 3-serien](#neste-i-3-serien)
- [Feil og framlegg](#feil-og-framlegg)
- [Utvikling](#utvikling)
- [Lisens](#lisens)

Brukargrensesnittet finst på svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og engelsk. Skjermbileta i
dokumentasjonen viser appen på svensk.

## Last ned og kom i gang

1. **Last ned.** Gå til den [siste utgåva](https://github.com/marwiss/Dataspatium/releases/latest), og hent ZIP-fila
   under *Assets* (`dataspatium-<versjon>.zip`, om lag 100 MB; R og alle R-pakkane er med).
2. **Pakk ut.** Høgreklikk på ZIP-fila, og vel *Pakk ut alle* (Windows), eller dobbeltklikk på henne (macOS). Legg mappa
   der du vil ha henne, til dømes i Dokument. Appen fungerer ikkje direkte inne i ZIP-fila.
3. **Opne.** Dobbeltklikk på `index.html` i mappa, eller dra fila til eit nettlesarvindauge. Om Windows spør kva app som
   skal brukast, vel du Edge, Chrome eller Firefox. Første gongen spør appen kva språk du vil ha (det kan endrast med
   språkknappen øvst til høgre), og startar deretter **grunnkurset**, ein interaktiv gjennomgang av alle modusar med
   dømedata som tek om lag ti minutt. Opne det igjen frå hjelpa (?).
4. **Importer.** I modusen *Hent* slepper du ei fil på flata (eller klikkar på *Prøv med dømedata*), kontrollerer
   kolonnetypane og klikkar på *Importer*. Datasettet blir lagra i nettlesaren på datamaskina di.
5. **Arbeid vidare.** Byt modus øvst: *Handter* viser datasetta dine og arbeidsområdet, *Søk* finn rader i dei,
   *Bearbeid* viser tabellen med sortering, filter og handlingar, *Analyser* opnar R- og SQL-konsollen, *Visualiser*
   lagar diagram, *Eksporter* lastar ned data, diagram og dokument, og *Del* gjev dei til andre.

Data blir lagra i den eigne databasen til nettlesaren. Slettar du nettstaddata, forsvinn dei, så ta tryggingskopi
regelmessig under *Handter > Arbeidsområde*. Tryggingskopien er ei ZIP-fil som kan gjenopprettast på same eller ei anna
datamaskin. Steg for steg med fleire detaljar: [kom-igang.md](kom-igang.md).

Appen finst òg direkte på nettet, utan nedlasting: <https://marwiss.github.io/Dataspatium/>. Frå ein nettenar kan han
installerast som eigen app (Edge og Chrome: *Installer* i adressefeltet) og fungerer deretter òg utan nettverk.
Nettversjonen og mappeversjonen har skilde arbeidsområde; flytt data mellom dei med ein tryggingskopi eller ein pakke.

## Kva som krevst

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (versjon 120 eller nyare) eller Firefox (versjon 128 eller nyare). Safari blir ikkje støtta.
- Om lag 300 MB ledig plass til appmappa og minst 4 GB minne (8 GB er tilrådd for store datasett). Det krevst ingen
  administratorrettar.
- Internett trengst berre når du hentar data frå opne API-ar, sender til GitHub, ser etter oppdateringar eller hentar ein
  komponent eller ein R-pakke som ikkje følgjer med i mappa; appen spør om løyve først.

## Kva du kan gjere

Det som verkar i versjon 1, verkar også i versjon 2, og det som verkar i versjon 2, verkar også i versjon 3. Dataspatium og
Dataregium med same hovudnummer høyrer saman.

### Versjon 1 (med Dataregium 1)

- **Hente**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, SDMX-JSON-, GeoJSON-, XML-, SQLite-, GeoPackage- og shapefile-filer, tabellar i HTML-, Markdown-, Word- og LaTeX-dokument, kartfiler i KML, KMZ, GPX og TopoJSON, SQL-skript, eldre reknearkformat (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), tekst med fast
  kolonnebreidd, statistikkfiler frå SPSS, Stata og SAS (med verdietikettar) og PX-formatet og dessutan Parquet og RDS (via R), innlimd tekst, filer frå
  nettadresser og data direkte frå opne API-ar hos SSB, Folkehelseinstituttet, Brønnøysundregistera, Kartverket, MET
  Norway, Danmarks Statistik, Open Data DK, Statistikcentralen, THL, PRH, Fintraffic, Meteorologiska institutet, Hagstofa
  Íslands, Veðurstofa Íslands, Grønlands Statistik, Hagstova Føroya, ÅSUB, Nordic Statistics, Eurostat, ECB, OECD og svenske
  etatar som SCB, Kolada og SMHI, med landfilter og lagra hentingar som blir oppdaterte med eitt klikk og spelar av
  oppskriftene sine (sjå [api-konfiguration.md](api-konfiguration.md)). Dømedata og kommune- og regiongrenser for
  Sverige, Danmark, Noreg og Finland følgjer med.
- **Bearbeide**: bla gjennom, sortere og filtrere store tabellar, redigere celler, rense, setje typar, omkode, dele inn i klassar, rangere, rekne ut andelar, løpande summar og endringar, pivotere og
  kople data, kontrollere datakvalitet med profil og reglar (mellom anna format, nordiske identitetsnummer, referansar til andre datasett og avvikande verdiar), pseudonymisere personnummer før deling, med angre, versjonar og
  oppskrifter som kan eksporterast som R eller SQL (sjå [bearbeta.md](bearbeta.md)).
- **Analysere**: ein innebygd R-konsoll med ggplot2 og tidyverse (sjå [r-guide.md](r-guide.md)), ein SQL-konsoll der datasett
  blir kopla med join via kortnamna sine, og notatbøker med tekst-, R- og SQL-celler som blir rapportar i HTML, Word, PDF,
  Markdown eller LaTeX (sjå [anteckningsbok.md](anteckningsbok.md)), og ei Regex-fane der regulære uttrykk blir prøvde på ein kolonne og brukte til å filtrere, hente ut, erstatte og dele opp (sjå [regex.md](regex.md)), heilt i nettlesaren.
- **Planar**: svenske digitale reguleringsplanar (den nasjonale spesifikasjonen, Lantmäteriets geodataplattform) blir opna
  som plankart med Boverkets fargar og nemningar, føresegnene blir slegne opp i Boverkets Planbestämmelsekatalog (innebygd
  kopi), og kommuneplanar (spesifikasjonen eller Boverkets ÖP-modell) blir viste tema for tema (sjå [planer.md](planer.md)).
- **Visualisere**: diagram med Vega-Lite (medrekna koroplettkart og punktkart, faste aksegrenser, logaritmisk skala, referanselinjer og trendlinjer), D3-malar eller R, eksporterte som SVG,
  PNG, PDF og PowerPoint, òg i batch per gruppe, og dashbord med felles filter som blir HTML eller PowerPoint (sjå
  [visualisera.md](visualisera.md)).
- **Dokumentere**: rapportar og kodebøker frå malar som HTML, Word, PDF, Markdown eller LaTeX, òg eitt dokument per kommune
  eller år (sjå [dokumentmallar.md](dokumentmallar.md)).
- **Eksportere og dele**: data til CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata og RDS; pakkar med
  valde datasett og objekt, ei melding og ein endringslogg, kommentarar til datasett og kolonnar, tryggingskopi av
  arbeidsområdet som ZIP, synkronisering med eit GitHub-repositorium og, i Edge og Chrome, ei portabel mappe med vanlege
  filer.
- **Finne raskt**: kommandopaletten (Ctrl+K) byter modus, opnar datasett, diagram og dashbord og køyrer handlingar frå
  eitt søkjefelt.
- **Dataregium som kjelde**: ein OpenCDE-tenar som [Dataregium](https://github.com/marwiss/Dataregium) blir ei kjelde i Hent med
  innlogging via OAuth2 med PKCE og sjølvregistrering der tenaren tillèt det; dokument blir valde på sida til tenaren og henta som
  datasett, og datasett og filer blir sende tilbake som nye dokument eller versjonar (Documents API).
- **Seks språk**: brukargrensesnitt, meldingar og dokumentasjon på svensk, dansk, norsk (bokmål), finsk, islandsk og
  engelsk.
- **Grunnkurs**: ein interaktiv gjennomgang av alle dei seks modusane med eksempeldata, på alle dei seks språka. Han blir
  vist første gongen appen blir opna, og kan opnast når som helst frå hjelpa eller kommandopaletten.

### Også i versjon 2 (med Dataregium 2)

- **Python**: ein Python-konsoll med pandas og matplotlib som blir henta første gongen, ved sida av R og SQL i Analyser (sjå
  [python.md](python.md)).
- **Databasar**: Access-filer blir lesne rett i nettlesaren; databasar på datamaskina eller i nettverket (SQL Server, ODBC,
  Excel, SQLite) blir nådde gjennom ei lokal bru, og PostgREST/Supabase, OData, GraphQL, CouchDB, ClickHouse, Elasticsearch,
  SPARQL, InfluxDB, Google Sheets og Airtable blir kjelder med eitt klikk. Filer kan lenkjast og lesast inn igjen frå disken
  (sjå [kallor.md](kallor.md)).
- **Dokument og bilete**: PDF, Word, OpenDocument, Markdown og tekst blir dokumentsamlingar som blir lesne i ei lesevising, side for
  side eller i sin heilskap; bilete blir ei biletsamling med EXIF-opplysningar og galleri. Verktøya Tekst (ordfrekvens,
  nøkkelord i kontekst, samførekomstar) og Bilete (oversyn, duplikat) fungerer utan kode (sjå [dokument.md](dokument.md)).
- **Kart**: geodatasett blir opna som kart å zoome i, kartvisingar med fleire lag og bakgrunnskart etter samtykke blir
  dashbord og publisert HTML, geoverktøya reknar areal, punkt i område, nærmaste, buffer og overlagring utan
  kode, og QGIS-prosjekt blir kartvisingar (sjå [kartor.md](kartor.md)).
- **Opne geodata**: WFS-, OGC API Features- og ArcGIS-tenester blir kjelder der laga blir henta som kart, med
  førehandsinnstillingar for SCB, SGU, HaV, RAÄ, Skogsstyrelsen, Kartverket, Statistikcentralen og SYKE, søk i
  Geodataportalen og WMS-tenester som bakgrunnskart eller lag (sjå [kallor.md](kallor.md)).
- **Nordiske planar**: Danmarks lokalplanar og kommuneplanrammer (Plandata.dk), Finlands plandatamodell og planindeks
  (Ryhti), Islands digitale regulerings- og kommuneplanar (Skipulagsstofnun) og Noregs reguleringsplanar (GeoPackage) blir opna
  som planar med fargane til kvart land; ein heil plan blir henta med nummeret sitt frå Plandata og Skipulagsstofnun.
- **Grafar**: GraphML, GEXF, JSON med nodar og kantar og Cypher-skript blir opna som grafar med oversyn per etikett, fokus og
  heilgrafvising (Cytoscape og sigma), ei Cypher-delmengd omsett til SQL, grafmål i bakgrunnen og eksport i alle fire
  format; to tabellar blir ein graf (sjå [grafer.md](grafer.md)).
  Grafen blir redigert i Bearbeid og med skrivande Cypher (oppskriftssteg), Neo4j er ei kjelde via Bolt, fana Graf har PageRank,
  fellesskap, sentralitet, mønsterspørjingar og layout, og grafar blir diagram i Visualiser, dashbord og Publiser.
- **CAD og BIM**: IFC-modellar blir opna i 3D (web-ifc og three.js) over ein tabell med bygningsdelane, og utvalet følgjer med begge vegar.
  Eigenskapar og mengder blir tabellar, fana Mengder reknar per type, etasje og materiale, og DXF-teikningar blir viste som SVG med
  lag (sjå [cad-bim.md](cad-bim.md)).
- **Flytar og overvaking**: ei lagra kjede (hent, oppskrifter, skript, lister, diagram, dashbord, dokument, eksport) blir køyrd med eitt
  klikk eller ved start, og overvaka kjelder seier frå i statuslinja når dei har nye data (sjå [floden.md](floden.md)).
- **Statistikk utan kode**: fana Statistikk gjer skildrande statistikk, krysstabellar, korrelasjon, hypotesetestar, regresjon og klyngeanalyse
  med skjema som skriv og viser R- eller Python-koden. Tidsserieoperasjonar i Bearbeid (periodar, endring, indeks, glidande gjennomsnitt,
  sesongjustering), og ein regresjon kan lagrast og brukast som oppskriftssteget Prediksjon (sjå [statistik.md](statistik.md)).
- **Innsamling i felt**: eit skjema bygd på kolonnane og reglane til eit datasett blir sendt til Dataspatium Mobil. Telefonen samlar inn rader utan nett, med bilete og
  posisjon, og radene kjem tilbake som ein ny versjon. Bileta blir ei biletsamling, og posisjonane hamnar på kartet (sjå [insamling.md](insamling.md)).
- **Modusane følgjer typen til datasettet**: appen seier kva ei fil er og kva eit datasett òg kan brukast som, spør om koordinatar, koordinatsystem og koplingar ved innlesing, sorterer blanda mapper og viser eit bilete per datasett i Handter. Søkjetreff blir opna der dei finst (side, bilete, node, bygningsdel, planobjekt eller stad), du kan søkje etter stad, finne nodar via kantane deira og bygningsdelar via eigenskapane deira, kommentere ei side, eit bilete, ein node eller ein stad, rette tekst, setje stad på bilete, reparere geometriar, finne duplikat i grafar og klassifisere bygningsdelar. Analyser opnar i rett verktøy med startkode skriven for datasettet, viser trenden i ein tidsserie og tel stader per område, og eit utval følgjer med mellom modusane (sjå [lagen.md](lagen.md)).
- **Visualiser, Eksporter og Del følgjer typen**: diagramframlegg med ekte bilete for kvar type, kryssfilter i dashbord og malord som legg inn eit kart, ein graf, ein modell eller ein plan i eit dokument; KML, GPX og GeoPackage for stader, kontaktkart for bilete, plankart og planføresegner for planar, mengder i Excel og glTF for modellar og PDF for teikningar; i Del vel du om filene skal følgje med i pakken, gjer eit datasett til ei eiga side å sende, og ser kvar type i si eiga form på telefonen (sjå [visualisera.md](visualisera.md) og [dela.md](dela.md)).
- **Gjennomgang før deling**: alt som forlèt appen, blir gått gjennom i sin heilskap, med kolonnar, løpande tekst, sidetabellar, originalfiler, posisjonane til bilete, kantane til grafar, kommentarar og forfattarar; personopplysningar kan haldast, pseudonymiserast eller fjernast i kopien, og datasettet blir aldri endra (sjå [dela.md](dela.md)).
- **Kodelister, skildringar og guidar**: etikettar frå SNI, SSYK, NACE og andre lister med eit klikk, datapakkar, DCAT-AP-SE, kvalitetsfråsegn og fire guidar med ekte data (sjå [lagen.md](lagen.md)).
- **Tekst frå bilete**: skanna PDF-filer, bilete og bilete av tabellar blir lesne med tekstattkjenning i nettlesaren, på alle sju språka.
- **Opphav, samarbeid og bibliotek**: sjå kvar eit datasett kjem frå og kva det har blitt til, samarbeid via GitHub utan at noko forsvinn, hent oppskrifter og malar med lisens, og publiser arbeidsområdet som ein nettstad.
- **Dataregium og OpenCDE**: ein OpenCDE-tenar som [Dataregium](https://github.com/marwiss/Dataregium) blir ei kjelde i Hent med innlogging via OAuth2 og sjølvregistrering der tenaren tillèt det. Appen hentar modellane og dokumenta til prosjektet og seier til når ein nyare versjon finst, viser sakene som peikar på bygningsdelane, opprettar saker frå markeringa i 3D-visinga med visinga som viewpoint, kommenterer og byter status, fargar modellen etter sakstatus, lagrar sakene som tabell med verktøyet Saker og dashbordet Sakstatus, les og skriv BCF-filer, sender datasett, filer og arbeidsområdepakkar til tenaren, spør IFC-grafen til tenaren med Cypher, les kva tenaren tilbyr og forklarar feilkodane hans, og loggar kvart kall med ein X-Request-Id som blir para med førespurnadsloggen til tenaren, og administrerer tenaren (brukarar, prosjekt, klientar, sesjonar, revisjon, innstillingar, helse og grafspørjingar) frå kortet Administrasjon når du er administrator (sjå avsnittet [Dataspatium og Dataregium](#dataspatium-og-dataregium) nedanfor).
- **Lett start**: store delar som R og Python blir lasta først når dei blir brukte, og statuslinja viser kva som blir lasta i mellomtida.
- **Samordning med Dataregium, steg 1**: appen les kapabilitetsdokumentet til tenaren, set om feilkodane, ber ei felles ordliste på sju språk og opnar ei kjelde frå lenkja Opne i Dataspatium.
- **Del**: modusen *Del* med pakkar, delingsmenyen til datamaskina og publisering av dashbord og dokument som frittståande HTML (sjå
  [dela.md](dela.md)); direkte overføring til telefonar og andre datamaskiner på same nettverk med QR-kode og kontrollkode, og
  *Dataspatium Mobil*, som tek imot, viser og sender vidare på telefonen (sjå [mobil.md](mobil.md)).
- **Halde orden**: mapper og taggar for datasett, filter og sortering, og massehandlingar på fleire datasett på éin gong
  (ordne, pakke, eksportere, hente igjen, køyre oppskrift, slette).
- **Søk**: modusen *Søk* leitar i alle kolonnar i eitt eller alle datasett, med fasettar som avgrensar, og lagra
  lister (sjå [soka.md](soka.md)).
- **Spør utan kode**: fana *Spørjing* i Søk koplar datasett, vel kolonnar og utrekningar, set vilkår og
  viser SQL-koden som blir laga; lagra lister avgrensar tabellen i Bearbeid og radene i diagram.
- **Hjelp i appen og presentasjon**: heile handboka med søk blir opna med ? eller F1 ved kapittelet for modusen du står
  i, og **Presenter** viser eit dashbord i heile vindauget eitt diagram om gongen.
- **Sju språk**: brukargrensesnitt, meldingar og dokumentasjon på svensk, dansk, norsk (bokmål og nynorsk), finsk, islandsk og
  engelsk.
- **Grunnkurs**: ein interaktiv gjennomgang av alle åtte modusane med dømedata, på alle sju språka. Det blir vist første
  gongen appen blir opna og kan opnast når som helst frå hjelpa eller kommandopaletten.

### Også i versjon 3 (med Dataregium 3)

- **Valider modellen og kollisjonskontroll**: kortet *Valider modellen* samlar kontrollen til tenaren (IFC-skjemaet, reglane til buildingSMART og IDS-filene til prosjektet) og kontrollane i appen,
  og *Kollisjonskontroll* finn bygningsdelar som går inn i kvarandre eller ligg for tett, og kan sende dei som BCF-saker (sjå [cad-bim.md](cad-bim.md)).
- **AI-modellering og versjonar**: panelet *Spør AI om modellen* lèt ein språkmodell (Anthropic eller eit OpenAI-kompatibelt API, med din
  eigen nøkkel lagra kryptert) svare på spørsmål om ein IFC-modell gjennom verktøy som les tabellane til modellen og, for ein modell
  frå Dataregium, dei namngjevne spørjingane til tenaren. I modusen *Endre* føreslår AI-en eit endringssett (etasjar, rutenett, veggar,
  dekke, opningar, eigenskapar, flyttingar) som vert førehandsvist i 3D, kontrollert lokalt og av førehandskontrollen til tenaren og
  brukt som eit oppskriftssteg fyrst når du godkjenner; AI-en kan aldri lagre eller publisere. Eit endringssett kan sendast til
  Dataregium som endringsframlegg, prøvast der mot basisversjonen og godkjennast av ein *manager* til neste versjon av dokumentet, med
  kollisjonar lista når dokumentet har gått vidare. *Samanlikn versjonar* viser kva som er nytt, borte og endra mellom ein modell og
  eit augneblinksbilete, ein annan modell, endringssettet til tenaren per versjon eller diffen til tenaren, markert i 3D. Ein modell
  frå Dataregium vert publisert med basisversjonen sin, slik at tenaren avviser når nokon har kome fyrst.
- **Dataregium 3**: ein modell frå Dataregium blir publisert med basisversjonen sin, og tenaren avviser (412) når nokon har kome først,
  og (422) når prosjektet ikkje tek imot filer med valideringsfeil; førehandskontrollen til tenaren prøver ein kandidat utan å lagre han;
  IFC-grafen til tenaren blir teikna i skjelettform med opphavet og formversjonen til modellen; ein lokal Dataregium på di eiga datamaskin verkar som kjelde også frå file://; BCF-kamera blir skrivne i
  koordinatane til modellen.
- **Opne geodata**: WFS-en til Sundsvall kommune blant dei ferdige geodatakjeldene, mellom anna med detaljplanar.

## OpenCDE-API-ane og klientane deira

OpenCDE er buildingSMART Internationals familie av opne web-API-ar for eit felles datamiljø, staden der eit prosjekt deler modellane,
dokumenta og sakene sine. Ein klient og ein tenar som følgjer dei same spesifikasjonane, kan arbeide saman, same kven som har bygd
dei. Dataspatium brukar alle tre:

| API | Kva appen gjer med det | Spesifikasjon |
|---|---|---|
| Foundation API 1.0 | Les kva API-ar tenaren tilbyr, kvar ein loggar inn og kven brukaren er; registrerer appen som klient når tenaren tillèt det | [foundation-API](https://github.com/buildingSMART/foundation-API) |
| BCF API 3.0 og 2.1 | Les og skriv saker om ein modell, med kommentarar og viewpoints (kamera, komponentar og bilete) frå 3D-visinga; vel den nyaste versjonen tenaren tilbyr | [BCF-API](https://github.com/buildingSMART/BCF-API) |
| Documents API 1.0 | Vel og hentar dokument og versjonar via tenaren sine eigne sider, slik at ein IFC-modell vert eit datasett, og lastar opp nye versjonar, datasett og pakkar | [documents-API](https://github.com/buildingSMART/documents-API) |

**Dataregium er éin tenar, ikkje den einaste.** Appen skal kunne kople til kvar tenar som følgjer spesifikasjonane: ingenting i
appen er avhengig av Dataregium, og utvidingane til Dataregium utanfor spesifikasjonane (kapabilitetsdokumentet, dei namngjevne
grafspørjingane, førehandskontrollen, basisversjonen, endringsframlegga og diffen mellom versjonar) vert berre viste når tenaren
sjølv seier frå om dei. Appen treng tre ting av ein tenar:

- at tenaren tillèt kall frå nettlesaren (CORS) frå adressa til appen: `null` når appen vert opna frå file://, `http://127.0.0.1:8080`
  frå ein lokal webtenar og `https://marwiss.github.io` frå nettet, med hovuda Authorization, Content-Type og X-Request-ID;
- ei klientregistrering, gjord av administratoren til tenaren (ein offentleg klient med omdirigeringsadressa
  `http://127.0.0.1:8080/oauth-callback.html`, eller tilsvarande for adressa appen vert servert frå) eller av appen sjølv når tenaren
  tillèt det, og innlogging med OAuth2 authorization code med PKCE `S256`; frå file:// limer du inn adressa du hamnar på etter
  innlogginga;
- BCF API 3.0 eller 2.1; Documents API er valfritt, men utan det kan appen verken hente eller publisere dokument.

Så langt er det vist mot Dataregium: live-suiten vert køyrd mot tenaren i begge versjonane av BCF API, og ein tenar med berre 2.1
fungerer. Andre tenarar er ikkje prøvde; fortel korleis det gjekk under [Feil og framlegg](#feil-og-framlegg). Når appen og ein
spesifikasjon ikkje stemmer overeins, avgjer spesifikasjonen. Sida til tenaren er skildra i Dataregiums README og klientguide; sida
til appen i [kallor.md](kallor.md).

## Dataspatium og Dataregium

*Dataregium heitte Kontroll fram til 8. november 2026.*

Dataspatium (appen i nettlesaren) og [Dataregium](https://github.com/marwiss/Dataregium) (ein tenar for buildingSMARTs OpenCDE-API-ar Foundation, BCF og
Documents) er utvikla for å fungere saman som klient og tenar. Appen legg til tenaren som kjelde i Hent, loggar inn med OAuth2 og
registrerer seg sjølv som klient når tenaren tillèt det, hentar modellane og dokumenta til prosjektet, les og skriv saker med
viewpoints frå 3D-visinga, sender datasett, filer og arbeidsområdepakkar tilbake gjennom Documents API, spør IFC-grafen til tenaren med
Cypher og loggar kvart kall med same X-Request-Id som tenaren skriv i førespurnadsloggen sin. Spørjingane mot grafen og administrasjonen er tillegg utanfor spesifikasjonane; alt anna går gjennom dei tre OpenCDE-API-ane, så
andre OpenCDE-klientar fungerer òg. Tenaren trengst ikkje for resten av appen: utan tenar fungerer alt anna som før. Dataregiums README og `docs/client-guide.md` skildrar samarbeidet frå tenaren si side;
her blir det skildra i [kallor.md](kallor.md) og [cad-bim.md](cad-bim.md).

Appen snakkar BCF API 3.0 og 2.1, så han også koplar seg til tenarar som berre har 2.1, og han teiknar og spør IFC-grafen til tenaren direkte frå Hent.

Dataspatium 3.0.0 fungerer med Dataregium 3.0.0. Begge får same utgåvenummer, så same nummer høyrer saman. Snøggstarten
[snabbstart.md](snabbstart.md) tek paret frå ingenting til ei sak på tjue minutt.

### Utgjevingane 1, 2 og 3

Det finst éi utgjeving per hovudnummer, og Dataspatium og Dataregium med same nummer høyrer saman:

| Dataspatium | Kva ho har | Høyrer saman med |
|---|---|---|
| 1.0.0 | Heile 1-serien: datainnhenting, handsaming, R, Python, kart, diagram, dokument og deling, og planar. Mot ein tenar berre Documents API: hent dokument som datasett, og send datasett og filer tilbake. Ingen saker og ingen modellar | Dataregium 1.0.0 (berre Documents API) |
| 2.0.0 | Heile 2-serien: IFC-modellar i 3D med tabellar, eigenskapar og mengder, saker med viewpoints (BCF API 3.0 og 2.1), IFC-grafen til tenaren (IFC-LPG) teikna og spurd, og planar frå planleggingsverktøy fullt ut | Dataregium 2.0.0 |
| 3.0.0 | 3-serien: kortet *Valider modellen*, kollisjonskontroll i nettlesaren, BCF-kamera i koordinatane til modellen, grafen i skjelettform, Spør AI og Endre med AI, Samanlikn versjonar, publisering med basisversjon og førehandskontroll, endringsframlegg som vert prøvde og godkjende på tenaren | Dataregium 3.0.0 |

Ei ny utgjeving i same hovudnummer erstattar den førre; berre den nyaste i kvar serie vert retta. Oppdateringskontrollen i appen
tilbyr neste hovudnummer, og datasett, lister, diagram, malar og skript følgjer med når du opnar `index.html` i den nye versjonen.

## Lær meir

Filnamna er dei same på alle språk (dei svenske originalane), så lenkjene verkar likt overalt.

- **Handboka** i appen: den same dokumentasjonen som her, med søk; opne henne med ? øvst til høgre eller F1.
- **Grunnkurset** i appen: ein interaktiv gjennomgang av alle modusar med dømedata; opne det frå hjelpa (?) eller
  med Ctrl+K.
- [Kom i gang](kom-igang.md): steg for steg med vanlege spørsmål.
- [Snøggstart med Dataregium](snabbstart.md): tjue minutt frå ingenting til ei sak oppretta i 3D-visinga og synleg på serveren.
- [Brukarrettleiing](anvandarguide.md): heile arbeidsflyten frå fil til rapport.
- [Vanlege spørsmål](faq.md): lagring, tryggleik, R, API-ar og oppdateringar.
- [Dei åtte modusane](lagen.md): kva som finst kvar og kvifor.
- [Søk](soka.md) og [Del](dela.md): finn utan kode, og gje data til andre.
- [Dataspatium Mobil](mobil.md): telefonen som kurér, mottakar og visar; overføring mellom einingar.
- [Notatbok](anteckningsbok.md): tekst, R og SQL i celler som blir ein rapport.
- [Dokument og bilete](dokument.md): PDF, Word, OpenDocument, Markdown og bilete som datasett; dokumentvising, galleri og verktøya Tekst og Bilete.
- [Kart](kartor.md): kartet i Bearbeid, kartvisingar i Visualiser, geoverktøya og QGIS-prosjekt.
- [Regulære uttrykk](regex.md): mønster for å analysere, rette og dele opp tekst i datasett.
- [Format og import](format.md): filformat, teiknkoding, desimalteikn, datoar og kolonnetypar.
- [Opne API-ar](api-konfiguration.md): dei førehandsinnstilte kjeldene, nøklar og eigne konfigurasjonar.
- [R i Dataspatium](r-guide.md): R-konsollen, `dm_read()`, `dm_write()` og pakkane som følgjer med.
- [Python i Dataspatium](python.md): Python-konsollen, `dm_read()`, `dm_write()` og pakkar som blir henta ved behov.
- [Visualiser](visualisera.md): diagrambyggjaren, D3-malar, R-diagram, kart og dashbord.
- [Dokument og malar](dokumentmallar.md): malspråket og utdataformata.
- [Tryggleik](sakerhet.md): trugsmålsmodell, kontrollane og prova som viser dei, personopplysningar og lagring, og korleis ein sårbarheit blir rapportert.
- [Lisensar](licenser.md): kva du kan gjere med appen, og kva lisensar tredjepartskomponentane har.
- Korleis bidrag blir tekne imot, står i [CONTRIBUTING.md](../../CONTRIBUTING.md) (svensk).

### Vidare lesing

- [BCF API](https://github.com/buildingSMART/BCF-API), [Foundation API](https://github.com/buildingSMART/foundation-API) og [Documents API](https://github.com/buildingSMART/documents-API): spesifikasjonane appen følgjer mot ein tenar.
- [IFC](https://github.com/buildingSMART/IFC4.x-development): filformatet for bygningsmodellar, og [IDS](https://github.com/buildingSMART/IDS): kravspesifikasjonar som modellar vert kontrollerte mot.
- Eksterne ressursar: [WebR](https://docs.r-wasm.org/webr/latest/), [R for nybegynnarar](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [SSBs API](https://www.ssb.no/api).

## Avgrensingar i korte trekk

- Appen må opnast frå ei utpakka mappe (file://) eller ein vanleg nettenar; han fungerer ikkje direkte inne i ei ZIP-fil.
- API-ar utan CORS-støtte (til dømes data.norge.no) kan ikkje kallast direkte frå nettlesaren.
- Eit datasett bør halde seg under eit par millionar rader; minnet til nettlesaren set grensa.
- Når appen blir opna frå ei mappe, kan R-kode ikkje avbrytast midt i ei utrekning; bruk *Start R på nytt*. Frå ein
  nettenar (localhost eller https) finst knappen *Avbryt*.
- Fleire faner fungerer og held kvarandre oppdaterte, men ikkje rediger same datasett i to faner samtidig: den som lagrar
  sist, vinn.
- Den portable mappa krev Edge eller Chrome; Firefox manglar mappetilgang (File System Access). Tryggingskopi som ZIP
  fungerer overalt.
- Heile appen er laga for datamaskiner; på telefonar og nettbrett blir Dataspatium Mobil brukt
  (<https://marwiss.github.io/Dataspatium/m/>), som tek imot, viser og sender vidare. Safari blir ikkje støtta for heile
  appen. I smale vindauge blir panela opna som ark over arbeidsflata.
- Dømedataa og kartgrensene som følgjer med, er svenske; sjølve appen fungerer med data frå kvar som helst.

## Personopplysningar

Dataspatium køyrer i nettlesaren din, og du er sjølv ansvarleg for opplysningane du legg inn. Alt appen lagrar (datasett og
versjonane deira, lister, diagram, dokument, notatbøker, kommentarar og innstillingar) ligg i lageret til nettlesaren på di
datamaskin og forlèt ho berre når du eksporterer, deler eller publiserer; då vert alt gått gjennom i sin heilskap fyrst, og
personopplysningar kan haldast, pseudonymiserast eller fjernast i kopien. Til ein Dataregium-tenar vert innlogginga di send (token
vert halde i økta eller kryptert med passfrasen din, aldri i klartekst), sakene, kommentarane, framlegga og filene du opprettar under
namnet ditt på tenaren, og ein X-Request-ID per kall; den eigne handsaminga til tenaren står i Dataregiums README. Til ein
AI-leverandør vert berre det du spør om sendt, og svara verktøya hentar frå modellen, etter samtykke til føremålet AI, med din eigen
nøkkel lagra kryptert; policyen til prosjektet kan avgrense til lokale modellar. Kommentarar og pakkar ber namnet du sjølv oppgjev.
Kontrollane og prøvene som viser dei står i [sakerhet.md](sakerhet.md).

## Neste i 3-serien

3.0.0 er den fyrste utgjevinga i 3-serien, laga saman med Dataregium 3.0.0: kontrollen av modellar, kollisjonskontrollen, AI-stega
og versjonssamanlikninga, som [Kva du kan gjere](#kva-du-kan-gjere) skildrar. Som kvart hovudnummer har serien éi utgjeving, som vert
gjeven ut på nytt når ho veks. Det som følgjer, gjer appen til klienten som redigerer modellen til tenaren og viser versjonane hans:
AI-en føreslår, mennesket går gjennom og godkjenner, tenaren prøver og flettar saman. Dette avsnittet seier kva som er avgjort, for
den, menneske eller AI-agent, som fører ein del av det vidare; sida til tenaren står i Dataregiums README under same overskrift.

### Avgjort

- **Modelleringa skjer i appen, ikkje på tenaren.** Modelleringshjulet (skriveverktøya og IfcOpenShell i Python i appen) er
  Dataspatiums eige, under Dataspatiums lisens, og ber ingen kode frå IFC-LPG; tenaren når det berre gjennom API-ane.
- **AI-en føreslår, mennesket godkjenner.** Eit endringssett vert førehandsvist i 3D, kontrollert lokalt og av førehandskontrollen
  til tenaren, og brukt fyrst når du godkjenner; sletting vert stadfesta éin gong til; publisering og framlegg til tenaren er knappar,
  aldri verktøy AI-en kan kalle. Bygd i 3.0.0.
- **Versjonsmodellen.** Eit endringssett vert sendt til tenaren som ei BCF-sak med ein snippet i forma til tenaren (GlobalId og sti
  som nøkkel), tenaren prøver det mot basisversjonen, og ein *manager* godkjenner det til neste versjon; ei publisering med utdatert
  basis vert avvist (412), og kollisjonane vert viste. Bygd i 3.0.0. Neste: trevegs samanfletting i appen ved kollisjon,
  versjonshistorikken per dokument og ei BCF-sak per godkjent endringssett.
- **Samanlikn versjonar** frå tre kjelder: augneblinksbilete og andre modellar i appen, endringssettet til tenaren per versjon og
  diffen til tenaren mellom versjonar. Bygd i 3.0.0.
- **Forvaltaren av prosjektet** får ei side i appen når API-et til Dataregium for medlemmer og roller finst.
- **Steg 4 og 5, etter steg 3:** repomodus per prosjekt med ein lokal Dataregium på eiga datamaskin og hent og publiser mellom den
  lokale og den fjerne; store modellar teikna frå geometri-API-et til tenaren når nettlesaren ikkje strekk til; prosjektprofilar med
  IDS og bSDD, IDS skrivne av AI-en og buildingSMART-reglar knytte til element.
- **Opne format** gjeld utvekslingsformat og lagra data, ikkje AI-API-ar; AI-leverandør vel brukaren med eigen nøkkel, lagra
  kryptert, og policyen til prosjektet kan avgrense til lokale modellar.

## Feil og framlegg

Rapporter feil eller ønske som *Issues* her på GitHub. Skildre nettlesar, versjon av Dataspatium (blir vist under
hjelpeknappen) og kva du gjorde. Sjå [CONTRIBUTING.md](../../CONTRIBUTING.md). Legg ikkje ved personopplysningar eller løyndomar. For ei
tryggleikssårbarheit, følg [SECURITY.md](../../SECURITY.md) i staden for å opne eit issue.

## Utvikling

- Ingen byggjesteg, ingen node.js. Opne `index.html` direkte, eller server mappa med `python -m http.server 8080`.
- Arkitektur i korte trekk: all eigen kode er klassiske skript som blir registrerte med `Dataspatium.define` i rekkjefølgja i `src/boot.js`; `src/platform` ber alt som er spesifikt for file:// (ressursar, shims, workers, lagring, samtykke); motorane SQLite, R (WebR) og Python (Pyodide) køyrer i workers; `src/ui` har designvariablane, komponentane (`dm-*`), skalet og éin modus per fil. Alt som blir teikna blir escapa, og ingenting blir henta frå nettet utan handlinga og samtykket ditt.
- Tredjepartskomponentar: `python tools/fetch_vendor.py` følgt av `python tools/wrap_assets.py`.
- Testar: `powershell -File tools/run-tests.ps1` eller `tools/run-tests.sh` (headless Edge og Firefox).
- Tryggleik: prova for samtykke, løyndomar, gjennomgang før deling, OAuth2 (PKCE, state, tilbakekall) og maskeringa i loggen er med i suiten; sjå [sakerhet.md](sakerhet.md).

## Lisens

Dataspatiums eigen kode, dokumentasjon og førehandsinnstillingar (alt unnateke `vendor/`) er lisensiert under
[PolyForm Strict 1.0.0](../../LICENSE): fri å laste ned og bruke til ikkje-kommersielle føremål, òg i offentlege etatar og
andre offentlege institusjonar, men ikkje å endre, byggje vidare på eller distribuere vidare utan skriftleg løyve.
Lisensgjevar er opphavspersonen til Dataspatium, som kan kontaktast via GitHub-kontoen [marwiss](https://github.com/marwiss); opprett
eit issue for andre vilkår. Kva lisensen tyder i praksis, blir forklart i [licenser.md](licenser.md).

Tredjepartskomponentar i `vendor/` har eigne lisensar (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), sjå
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og dei GPL-lisensierte R-pakkane blir distribuerte uendra; kjeldekoden
finst hos [R-prosjektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr) og
[CRAN](https://cran.r-project.org/) i versjonane som er oppgjevne der. Sjå [SECURITY.md](../../SECURITY.md) for korleis ei sårbarheit blir rapportert,
og kva prosjektet gjer for å halde seg trygt.
