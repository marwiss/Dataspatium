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
   skal brukes, velger du Edge, Chrome eller Firefox. Første gang spør appen hvilket språk du vil ha; valget kan endres når
   som helst med språkknappen øverst til høyre.
4. **Importer.** I modusen *Hent* slipper du en fil på flaten (eller klikker på *Prøv med eksempeldata*), kontrollerer
   kolonnetypene og klikker på *Importer*. Datasettet lagres i nettleseren på datamaskinen din.
5. **Arbeid videre.** Bytt modus øverst: *Håndter* viser datasettene dine og arbeidsområdet, *Bearbeid* viser tabellen med
   sortering, filtre og handlinger, *Analyser* åpner R- og SQL-konsollen, *Visualiser* lager diagrammer, og *Eksporter*
   laster ned data, diagrammer og dokumenter.

Data lagres i nettleserens egen database. Sletter du nettstedsdata, forsvinner de, så ta sikkerhetskopi regelmessig under
*Håndter > Arbeidsområde*. Sikkerhetskopien er en ZIP-fil som kan gjenopprettes på samme eller en annen datamaskin. Trinn
for trinn med flere detaljer: [kom-igang.md](kom-igang.md).

## Hva som kreves

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (versjon 120 eller nyere) eller Firefox (versjon 128 eller nyere). Safari støttes ikke.
- Rundt 300 MB ledig plass til appmappen og minst 4 GB minne (8 GB anbefales for store datasett). Det kreves ingen
  administratorrettigheter.
- Internett trengs bare når du henter data fra åpne API-er eller ser etter oppdateringer.

## Hva du kan gjøre

- **Hente**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, GeoJSON-, XML-, SQLite-, GeoPackage- og shapefile-filer, tekst med fast
  kolonnebredde, statistikkfiler fra SPSS, Stata, SAS og PX-formatet samt Parquet og RDS (via R), innlimt tekst, filer fra
  nettadresser og data direkte fra åpne API-er hos SSB, Folkehelseinstituttet, Brønnøysundregistrene, Kartverket, MET
  Norway, Danmarks Statistik, Open Data DK, Statistikcentralen, THL, PRH, Fintraffic, Meteorologiska institutet, Hagstofa
  Íslands, Veðurstofa Íslands, Grønlands Statistik, Hagstova Føroya, ÅSUB, Nordic Statistics, Eurostat og svenske etater som
  SCB, Kolada og SMHI, med landfilter og ny henting av alle API-datasett med ett trykk (se
  [api-konfiguration.md](api-konfiguration.md)). Eksempeldata og SCBs svenske kommune- og länsgrenser følger med.
- **Bearbeide**: bla gjennom, sortere og filtrere store tabeller, redigere celler, rense, sette typer, beregne, pivotere og
  koble data, kontrollere datakvalitet med profil og regler, pseudonymisere personnumre før deling, med angre, versjoner og
  oppskrifter som kan eksporteres som R eller SQL (se [bearbeta.md](bearbeta.md)).
- **Analysere**: en innebygd R-konsoll med ggplot2 og tidyverse (se [r-guide.md](r-guide.md)), en SQL-konsoll der datasett
  kobles med join via kortnavnene sine, og notatbøker med tekst-, R- og SQL-celler som blir rapporter i HTML, Word, PDF,
  Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)), helt i nettleseren.
- **Visualisere**: diagrammer med Vega-Lite (inkludert koroplettkart og punktkart), D3-maler eller R, eksportert som SVG,
  PNG, PDF og PowerPoint, også i batch per gruppe, og dashbord med felles filtre som blir HTML eller PowerPoint (se
  [visualisera.md](visualisera.md)).
- **Dokumentere**: rapporter og kodebøker fra maler som HTML, Word, PDF, Markdown eller LaTeX, også ett dokument per kommune
  eller år (se [dokumentmallar.md](dokumentmallar.md)).
- **Eksportere og dele**: data til CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata og RDS; pakker med
  valgte datasett og objekter, sikkerhetskopi av arbeidsområdet som ZIP og, i Edge og Chrome, en portabel mappe med vanlige
  filer.
- **Finne raskt**: kommandopaletten (Ctrl+K) bytter modus, åpner datasett, diagrammer og dashbord og kjører handlinger fra
  ett søkefelt.
- **Seks språk**: brukergrensesnitt, meldinger og dokumentasjon på svensk, dansk, norsk (bokmål), finsk, islandsk og
  engelsk.

## Lær mer

Filnavnene er de samme på alle språk (de svenske originalene), så lenkene virker likt overalt.

- [Kom i gang](kom-igang.md): trinn for trinn med vanlige spørsmål.
- [Brukerveiledning](anvandarguide.md): hele arbeidsflyten fra fil til rapport.
- [Vanlige spørsmål](faq.md): lagring, sikkerhet, R, API-er og oppdateringer.
- [De seks modusene](lagen.md): hva som finnes hvor og hvorfor.
- [Notatbok](anteckningsbok.md): tekst, R og SQL i celler som blir en rapport.
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
- R-kode kan ikke avbrytes midt i en beregning; bruk *Start R på nytt*.
- Flere faner fungerer og holder hverandre oppdatert, men ikke rediger samme datasett i to faner samtidig: den som lagrer
  sist, vinner.
- Den portable mappen krever Edge eller Chrome; Firefox mangler mappetilgang (File System Access). Sikkerhetskopi som ZIP
  fungerer overalt.
- Safari og mobile nettlesere støttes ikke.
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
