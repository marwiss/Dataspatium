[Svenska](../../README.md) · [Dansk](../da/README.md) · **Norsk** · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · [English](../en/README.md)

<img src="../../src/ui/design/favicon.svg" alt="" width="64" height="64" align="left">

# Dataspatium OpenCDE-klient

*Dette er README for Dataspatium 1.0.0. Den siste utgivelsen, 3.0.0, beskrives i [README på main](https://github.com/marwiss/Dataspatium/blob/main/docs/nb/README.md).*

Dataspatium er et program for å arbeide med data, som du åpner i den vanlige nettleseren din. Du henter inn en tabell, et kart, en plan
eller statistikk fra en myndighet, retter og regner på den, lager diagrammer og rapporter og sender resultatet videre. Alt skjer på din egen
datamaskin: ingen installasjon, ingen konto og ingen server. Ingenting forlater datamaskinen med mindre du selv eksporterer eller deler
det, og appen spør alltid før den bruker internett.

Dataspatium kan også hente dokumenter fra [Dataregium](https://github.com/marwiss/Dataregium), en server der et byggeprosjekt samler
dokumentene sine, og sende datasett og filer tilbake som nye versjoner. Uten Dataregium fungerer alt annet akkurat som før.

**For den teknisk kyndige:** en statisk nettapp uten byggesteg som kjører fra `file://` i Edge, Chrome og Firefox eller fra hvilken som
helst statisk nettserver. Hvert datasett er en SQLite-fil (sql.js) i IndexedDB, og R kjører i WebR 0.5.9 i en worker. Mot en server er
appen en OpenCDE-klient for Foundation API 1.0, med OAuth2 authorization code og PKCE, og Documents API 1.0. Ingen nettverkskall skjer uten
samtykke per formål, og hemmeligheter lagres bare kryptert (AES-GCM).

![Dataspatium i modusen Bearbeid med en tabell over Sveriges kommuner](../images/bearbeta.png)

**Innhold**

- [Last ned og kom i gang](#last-ned-og-kom-i-gang)
- [Hva som kreves](#hva-som-kreves)
- [Ord du bør kjenne](#ord-du-bør-kjenne)
- [Hva du kan gjøre](#hva-du-kan-gjøre)
- [OpenCDE-API-ene og klientene deres](#opencde-api-ene-og-klientene-deres)
- [Dataspatium og Dataregium](#dataspatium-og-dataregium)
- [Lær mer](#lær-mer)
- [Begrensninger i korte trekk](#begrensninger-i-korte-trekk)
- [Personopplysninger](#personopplysninger)
- [Nyere utgivelser](#nyere-utgivelser)
- [Feil og forslag](#feil-og-forslag)
- [Utvikling](#utvikling)
- [Lisens](#lisens)

## Last ned og kom i gang

1. **Last ned.** Gå til [utgivelse 1.0.0](https://github.com/marwiss/Dataspatium/releases/tag/v1.0.0) og hent ZIP-filen under *Assets*
   (`dataspatium-1.0.0.zip`, omtrent 95 MB; R og de vanligste R-pakkene følger med).
2. **Pakk ut.** Høyreklikk på ZIP-filen og velg *Pakk ut alle* (Windows), eller dobbeltklikk på den (macOS). Legg mappen der du vil ha
   den, for eksempel i Dokumenter. Appen virker ikke direkte inne i ZIP-filen.
3. **Åpne.** Dobbeltklikk på `index.html` i mappen, eller dra filen inn i et nettleservindu. Hvis Windows spør hvilken app som skal brukes,
   velger du Edge, Chrome eller Firefox. Første gang velger du språk, og deretter tilbys **grunnkurset**: en gjennomgang av alle seks
   moduser med eksempeldata som tar omtrent ti minutter og kan åpnes igjen fra hjelpen (?).
4. **Hent inn data.** I modusen *Hent* slipper du en fil på flaten, eller klikker på *Prøv med eksempeldata*. Appen viser hva filen
   inneholder; klikk på *Importer*. Datasettet lagres i nettleseren på datamaskinen din.
5. **Arbeid videre.** Modusene øverst er stegene i arbeidet: *Håndter* holder orden på datasettene dine, *Bearbeid* viser tabellen med
   knapper for å rette og regne, *Analyser* har R, SQL og regulære uttrykk, *Visualiser* lager diagrammer og kart, og *Eksporter* lagrer
   filer på datamaskinen og delingspakker til andre.

Det du lagrer, ligger i nettleserens egen database på datamaskinen. Sletter du nettleserens nettstedsdata, forsvinner det, så ta jevnlig en
sikkerhetskopi under *Håndter > Arbeidsområde*. Sikkerhetskopien er en ZIP-fil som kan gjenopprettes på samme eller en annen datamaskin.
Steg for steg med flere detaljer: [kom-igang.md](kom-igang.md).

Nettversjonen på <https://marwiss.github.io/Dataspatium/> er alltid den siste utgivelsen, nå 3.0.0.

### For den teknisk kyndige

- **Kjør:** pakk ut ZIP-filen og åpne `index.html` (file://), eller server mappen: `python -m http.server 8080 --bind 127.0.0.1` og åpne
  <http://127.0.0.1:8080/>. Fra en nettserver finnes service worker, en app som kan installeres, og R som kan avbrytes.
- **Kontroller ZIP-filen:** sammenlign SHA-256 med den i utgivelsens tekst (`Get-FileHash` i PowerShell, `shasum -a 256` på macOS og
  Linux).
- **Med en server:** start Dataregium 1.0.0 med Docker eller Podman, slik README-en dens beskriver, server Dataspatium på port 8080 og legg
  til serveren med *Hent > Legg til OpenCDE-server*. Klient-id kan stå tomt når serveren tillater selvregistrering.
- **Prøver:** `powershell -File tools/run-tests.ps1` kjører hele suiten i headless Edge og Firefox.

## Hva som kreves

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (versjon 120 eller nyere), eller Firefox (versjon 128 eller nyere). Safari støttes ikke.
- Omtrent 300 MB ledig plass til appmappen og minst 4 GB minne (8 GB anbefales for store datasett). Ingen administratorrettigheter trengs.
- Internett trengs bare når du selv velger noe som krever det, og appen spør om lov først for hvert formål: hente data fra åpne API-er og
  bakgrunnskart, koble til en Dataregium-server eller GitHub, se etter oppdatering eller hente R-pakker utover de vanligste.
- Dataregium trenger en server. Å kjøre din egen krever Docker eller Podman; det beskriver Dataregiums README.

## Ord du bør kjenne

Du trenger ikke kunne ordene nedenfor for å bruke appen, men de forekommer i teksten.

- **API**: en måte for programmer å hente data fra hverandre over nettet. Appen henter statistikk fra myndigheters API-er og snakker med
  Dataregium gjennom dens API-er.
- **Datasett**: det appen lagrer når du henter inn noe: en tabell, et kart eller en plan.
- **Oppskrift**: listen over alt du har gjort med et datasett, steg for steg, slik at det kan angres eller gjentas på nye data.
- **R og SQL**: språk for å analysere data. Appen har dem innebygd, men det meste gjøres med knapper.
- **OpenCDE**: buildingSMARTs åpne regler for hvordan programmer deler et byggeprosjekts modeller, dokumenter og saker, slik at programmer
  fra ulike produsenter fungerer sammen.
- **Server**: et program som andre kobler seg til over nettet. Dataregium er en server; Dataspatium trenger ingen.
- **Container**: et ferdigpakket program som startes med Docker eller Podman uten at delene installeres hver for seg. Dataregium kjører
  slik; Dataspatium trenger ingen containere.
- **OAuth2-pålogging**: den vanlige måten å logge på en tjeneste fra en annen app uten at appen ser passordet ditt.
- **file:// og CORS**: file:// betyr at appen åpnes direkte fra en mappe. CORS er nettleserens regel for hvilke nettjenester en nettapp får
  hente data fra; en tjeneste uten CORS kan ikke nås direkte.

## Hva du kan gjøre

Det som virker i én versjon, virker også i den neste. Hver versjon hører sammen med samme versjon av Dataregium.

### Versjon 1 (med Dataregium 1)

- **Hent inn data**: filer i rundt førti formater, fra Excel og CSV til statistikkfiler, geodata og tabeller i Word og nettsider, og
  statistikk fra myndigheter i Sverige, Norden og Europa med ett klikk (se [Åpne API-er](api-konfiguration.md)). *Teknisk:* tegnkoding og
  kolonnetyper gjenkjennes; SPSS, Stata, SAS, PX, Parquet og RDS via R; egne kilder som `*.api.json`.
- **Rett og regn**: rundt femti handlinger med knapper, som å rense, bytte type, omkode, regne andeler, pivotere og koble tabeller, med
  kvalitetsregler, pseudonymisering av personnumre, angre og versjoner (se [Bearbeid](bearbeta.md)). *Teknisk:* hvert steg lagres i en
  oppskrift som kan eksporteres som R- eller SQL-kode.
- **Analyser**: R med ggplot2 og tidyverse, SQL på tvers av datasett, regulære uttrykk og notatbøker som blir rapporter, helt i
  nettleseren (se [R](r-guide.md) og [Regulære uttrykk](regex.md)).
- **Planer**: svenske detaljplaner og oversiktsplaner som plankart med Boverkets farger og tegnforklaringer, i planens eget koordinatsystem
  (se [Planer](planer.md)).
- **Diagrammer, kart og dokumenter**: diagrammer og kart med Vega-Lite, D3 eller R, dashboards og rapporter fra maler som HTML, Word, PDF,
  PowerPoint, Markdown eller LaTeX (se [Visualiser](visualisera.md)).
- **Lagre og dele**: data i rundt ti formater, delingspakker, kommentarer, sikkerhetskopi, synkronisering med GitHub og en bærbar mappe.
- **Dataregium som dokumentarkiv**: hent dokumenter fra serveren som datasett, og send datasett og filer tilbake som nye versjoner.
  *Teknisk:* Foundation API og Documents API.
- **Seks språk og et grunnkurs**: svensk, dansk, norsk (bokmål), finsk, islandsk og engelsk, og kommandopaletten (Ctrl+K) som finner alt.

## OpenCDE-API-ene og klientene deres

OpenCDE er buildingSMART Internationals åpne regler for hvordan programmer deler et byggeprosjekts modeller, dokumenter og saker. Et program
som følger reglene, kan arbeide med hver server som også gjør det, uansett hvem som har laget dem. Dataspatium 1.0.0 er et slikt program,
en klient, og bruker to av API-ene:

| API | Hva appen gjør med det | Spesifikasjon |
|---|---|---|
| Foundation API 1.0 | Leser hvilke API-er serveren tilbyr, hvor man logger på og hvem brukeren er; registrerer appen som klient når serveren tillater det | [foundation-API](https://github.com/buildingSMART/foundation-API) |
| Documents API 1.0 | Velger og henter dokumenter og versjoner via serverens egne sider, slik at et dokument blir et datasett, og laster opp nye versjoner, datasett og filer | [documents-API](https://github.com/buildingSMART/documents-API) |

Saker gjennom BCF API og bygningsmodeller kom i versjon 2. **Dataregium er én server, ikke den eneste.** Ingenting i appen avhenger av
Dataregium; kapabilitetsdokumentet, Dataregiums utvidelse, brukes bare når serveren selv oppgir det.

**For den teknisk kyndige:** av en server trenger appen tre ting:

- CORS fra appens opprinnelse: `null` fra file://, `http://127.0.0.1:8080` fra en lokal nettserver og `https://marwiss.github.io` fra
  nettet, med hodene Authorization, Content-Type og X-Request-ID;
- en klientregistrering, gjort av serverens administrator (en offentlig klient med omdirigeringsadressen
  `http://127.0.0.1:8080/oauth-callback.html`, eller tilsvarende for appens adresse) eller av appen selv (RFC 7591) når serveren tillater
  det, og OAuth2 authorization code med PKCE `S256`; fra file:// limer du inn adressen du havner på etter påloggingen;
- Documents API 1.0.

Når appen og en spesifikasjon ikke stemmer overens, avgjør spesifikasjonen. Serverens side beskrives i Dataregiums README.

## Dataspatium og Dataregium

*Dataregium het Kontroll fram til 8. november 2026.*

Dataspatium er appen du arbeider i, og [Dataregium](https://github.com/marwiss/Dataregium) er serveren der et prosjekt samler dokumentene
sine. Du legger til serveren som kilde i *Hent* og logger på; deretter velger du dokumenter på serverens side, får dem som datasett og
sender datasett og filer tilbake som nye dokumenter eller versjoner. Uten server virker resten av appen som vanlig.

**For den teknisk kyndige:** alt går gjennom Foundation API og Documents API. Hvert kall bærer en `X-Request-Id` som serveren skriver i
forespørselsloggen sin, slik at loggen i appen og serverens logg kan pares.

Slik henger de sammen:

```mermaid
flowchart LR
    subgraph app ["Dataspatium, i nettleseren"]
        source["Kilde og pålogging"]
        files["Dokumenter og datasett"]
        log["Loggen i appen"]
    end
    subgraph server ["Dataregium, serveren"]
        foundation["Foundation API, OAuth2"]
        documents["Documents API"]
        requests["Forespørselslogg"]
    end
    source <--> foundation
    files <--> documents
    log <-- "X-Request-ID" --> requests
```

Dataspatium 1.0.0 fungerer med Dataregium 1.0.0. Samme nummer hører sammen.

### Utgivelsene 1, 2 og 3

Det finnes én utgivelse per hovednummer, og Dataspatium og Dataregium med samme nummer hører sammen:

| Dataspatium | Hva den har | Hører sammen med |
|---|---|---|
| 1.0.0 | Data fra filer og åpne API-er, bearbeiding, R, SQL og regulære uttrykk, svenske planer, diagrammer og kart i diagrammer, dashboards, dokumenter, eksport og deling. Mot en server bare Documents API: hent dokumenter som datasett og send datasett og filer tilbake. Ingen saker, ingen modeller og ingen Python | Dataregium 1.0.0 (bare Documents API) |
| 2.0.0 | Alt i 1.0.0 og dessuten modusene Søk og Del, Python og statistikk uten kode, flere kilder, kartvisninger, nordiske planer, grafer, IFC-modeller i 3D med kontroll mot IDS, flyter, Dataspatium Mobil, saker med viewpoints (BCF API 3.0 og 2.1), serverens IFC-graf, kortet *Administrasjon* og kortet *Prosjektets medlemmer* | Dataregium 2.0.0 |
| 3.0.0 | Alt i 2.0.0 og dessuten kortet *Valider modellen*, kollisjonskontroll, Spør AI og Endre med AI, nye tomme modeller i valgfritt skjema, Sammenlign versjoner, publisering med basisversjon og forhåndskontroll, endringsforslag som prøves og godkjennes på serveren med valg ved konflikter, og grafen i en lettere form | Dataregium 3.0.0 |

En ny utgivelse med samme hovednummer erstatter den forrige; bare den siste i hver serie rettes. Appens oppdateringskontroll tilbyr neste
hovednummer, og datasett, lister, diagrammer, maler og skript følger med når du åpner den nye versjonens `index.html`.

## Lær mer

Filnavnene er de samme på alle språk (de er de svenske originalene), så lenker virker likt overalt.

**Begynn her**

- **Grunnkurset** i appen: en gjennomgang av alle moduser med eksempeldata; åpne det fra hjelpen (?) eller med Ctrl+K.
- [Kom i gang](kom-igang.md): steg for steg med vanlige spørsmål.
- [Brukerveiledning](anvandarguide.md): hele arbeidsflyten fra fil til rapport.
- [De seks modusene](lagen.md): hva som finnes hvor, og hvorfor.
- [Vanlige spørsmål](faq.md): lagring, sikkerhet, R, API-er og oppdateringer.

**Etter område**

- [Formater og import](format.md) og [Åpne API-er](api-konfiguration.md): filformater, tegnkoding, de forhåndsinnstilte kildene, nøkler,
  egne konfigurasjoner og OpenCDE-servere.
- [Bearbeid](bearbeta.md) og [Regulære uttrykk](regex.md): rett, regn og finn.
- [R i Dataspatium](r-guide.md) og [Notatbok](anteckningsbok.md): analyse med kode.
- [Visualiser](visualisera.md) og [Dokumenter og maler](dokumentmallar.md): diagrammer, kart, dashboards og rapporter.
- [Planer](planer.md): detaljplaner og oversiktsplaner.
- [Lisenser](licenser.md): hva du får gjøre med appen, og hvilke lisenser tredjepartskomponentene har.
- [Utvikling](../utveckling.md), [Arkitektur](../arkitektur.md) og [Stilguide](../stilguide.md) for den som vil forstå koden (på svensk);
  hvordan bidrag tas imot, står i [CONTRIBUTING.md](../../CONTRIBUTING.md).

### Videre lesning

- [Foundation API](https://github.com/buildingSMART/foundation-API) og [Documents API](https://github.com/buildingSMART/documents-API): spesifikasjonene appen følger mot en server.
- Eksterne ressurser: [WebR](https://docs.r-wasm.org/webr/latest/), [Vega-Lite](https://vega.github.io/vega-lite/),
  [SCBs API](https://www.scb.se/en/services/open-data-api/).

## Begrensninger i korte trekk

- Appen må åpnes fra en utpakket mappe eller en vanlig nettserver; den virker ikke direkte inne i ZIP-filen.
- Nettjenester som ikke tillater kall fra nettlesere (mangler CORS, for eksempel den svenske Riksbanken), kan ikke nås direkte; en egen
  proxy kan oppgis.
- Et datasett bør holde seg under et par millioner rader; minnet i nettleseren setter grensen.
- Når appen åpnes fra en mappe, kan R-kode ikke avbrytes midt i en beregning; bruk *Start R på nytt*. Fra en nettserver finnes knappen
  *Avbryt*.
- Flere faner virker og holder hverandre orientert, men ikke rediger samme datasett i to faner samtidig: den som lagrer sist, vinner.
- Den bærbare mappen krever Edge eller Chrome; Firefox mangler mappetilgang. Sikkerhetskopi som ZIP virker overalt.
- Appen er laget for datamaskiner; telefoner og nettbrett støttes ikke i versjon 1.
- Eksempeldata og kartgrenser som følger med, dekker Sverige, Danmark, Norge og Finland, og de forhåndsinnstilte kildene er nordiske og
  europeiske; data fra andre land kan du like gjerne hente inn selv.

## Personopplysninger

Dataspatium kjører i nettleseren din, og du er selv ansvarlig for opplysningene du legger inn. Alt appen lagrer (datasett og versjonene
deres, diagrammer, dokumenter, notatbøker, kommentarer og innstillinger) ligger i nettleserens lager på datamaskinen din og forlater den
bare når du eksporterer eller deler. Til en Dataregium-server sendes innloggingen din (token holdes i økten eller kryptert med passfrasen
din, aldri i klartekst), datasettene og filene du sender, og en X-Request-ID per kall; serverens egen behandling står i Dataregiums README.
Kommentarer og pakker bærer navnet du selv oppgir.

## Nyere utgivelser

Dataspatium 2.0.0 legger til modusene Søk og Del, Python, kartvisninger, grafer, bygningsmodeller i 3D og saker mot Dataregium, og 3.0.0
dessuten kontroll av modeller, Spør AI og Endre med AI og versjoner på serveren. Den siste hentes fra
[siste utgivelse](https://github.com/marwiss/Dataspatium/releases/latest) og beskrives i
[README på main](https://github.com/marwiss/Dataspatium/blob/main/docs/nb/README.md). Datasett, lister, diagrammer, maler og skript følger
med når du åpner den nye versjonens `index.html`.

## Feil og forslag

Rapporter feil eller ønsker som *Issues* her på GitHub. Beskriv nettleseren, versjonen av Dataspatium (vises under hjelpeknappen) og hva du
gjorde. Se [CONTRIBUTING.md](../../CONTRIBUTING.md). Legg ikke ved personopplysninger eller hemmeligheter.

## Utvikling

- Intet byggesteg, ingen node.js. Åpne `index.html` direkte, eller server mappen med `python -m http.server 8080`.
- Arkitektur i korte trekk: all egen kode er klassiske skript som registreres med `Dataspatium.define` i rekkefølgen i `src/boot.js`;
  `src/platform` bærer alt som er spesifikt for file://; motorene SQLite og R (WebR) kjører i workers; `src/ui` har designvariablene,
  komponentene (`dm-*`), skallet og én modus per fil. Se [arkitektur.md](../arkitektur.md).
- Tredjepartskomponenter: `python tools/fetch_vendor.py` fulgt av `python tools/wrap_assets.py`.
- Prøver: `powershell -File tools/run-tests.ps1` (headless Edge og Firefox). Prøvene går aldri mot nettet. Se
  [utveckling.md](../utveckling.md).

## Lisens

Dataspatiums egen kode, dokumentasjon og forhåndsinnstillinger (alt unntatt `vendor/`) er lisensiert under
[PolyForm Strict 1.0.0](../../LICENSE): fri å laste ned og bruke til ikke-kommersielle formål, også i myndigheter og andre offentlige
institusjoner, men ikke å endre, bygge videre på eller videredistribuere uten skriftlig tillatelse. Lisensgiver er Dataspatiums
opphavsperson, som kan nås via GitHub-kontoen [marwiss](https://github.com/marwiss); opprett et issue for andre vilkår. Hva lisensen betyr
i praksis, forklares i [licenser.md](licenser.md).

Tredjepartskomponenter i `vendor/` har sine egne lisenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), se
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og de GPL-lisensierte R-pakkene distribueres uendret; kildekoden finnes hos
[R-prosjektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr) og [CRAN](https://cran.r-project.org/) i
versjonene som oppgis der.
