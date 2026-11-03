[Svenska](../../README.md) · **Dansk** · [Norsk](../nb/README.md) · [Suomi](../fi/README.md) · [Íslenska](../is/README.md) · [English](../en/README.md)

# Dataspatium

Dataspatium er en webapp til data fra kilde til rapport: hent data fra filer og åbne API'er, gem og håndter
datasæt, gennemgå og ret værdier, analysér med R, visualisér og eksportér. Alt kører i din egen browser. Ingen
server, ingen installation, ingen konti. Dine data forlader aldrig computeren, medmindre du selv eksporterer dem.

![Dataspatium i tilstanden Bearbejd med en tabel over svenske kommuner](../images/bearbeta.png)

Brugerfladen findes på svensk, dansk, norsk, finsk, islandsk og engelsk. Skærmbillederne i dokumentationen viser
appen på svensk.

## Download og kom i gang

1. **Download.** Gå til den [seneste udgivelse](https://github.com/marwiss/Dataspatium/releases/latest), og hent
   ZIP-filen under *Assets* (`dataspatium-<version>.zip`, omkring 100 MB; R og alle R-pakker er med).
2. **Pak ud.** Højreklik på ZIP-filen, og vælg *Udpak alle* (Windows), eller dobbeltklik på den (macOS). Læg mappen,
   hvor du vil have den, for eksempel i Dokumenter. Appen fungerer ikke direkte inde i ZIP-filen.
3. **Åbn.** Dobbeltklik på `index.html` i mappen, eller træk filen til et browservindue. Hvis Windows spørger, hvilken
   app der skal bruges, vælger du Edge, Chrome eller Firefox. Første gang spørger appen, hvilket sprog du vil have
   (det kan ændres med sprogknappen øverst til højre), og starter derefter **grundkurset**, en interaktiv gennemgang
   af alle tilstande med eksempeldata, som tager omkring ti minutter. Åbn det igen fra hjælpen (?).
4. **Importér.** I tilstanden *Hent* slipper du en fil på fladen (eller klikker på *Prøv med eksempeldata*),
   kontrollerer kolonnernes typer og klikker på *Importér*. Datasættet gemmes i browseren på din computer.
5. **Arbejd videre.** Skift tilstand øverst: *Håndter* viser dine datasæt og arbejdsområdet, *Bearbejd* viser
   tabellen med sortering, filtre og handlinger, *Analysér* åbner R- og SQL-konsollen, *Visualisér* bygger diagrammer,
   og *Eksportér* downloader data, diagrammer og dokumenter.

Data gemmes i browserens egen database. Rydder du webstedsdata, forsvinder de, så tag backup regelmæssigt under
*Håndter > Arbejdsområde*. Backuppen er en ZIP-fil, der kan gendannes på samme eller en anden computer. Trin for trin
med flere detaljer: [kom-igang.md](kom-igang.md).

## Hvad der kræves

- Windows, macOS eller Linux.
- Microsoft Edge eller Google Chrome (version 120 eller nyere) eller Firefox (version 128 eller nyere). Safari
  understøttes ikke.
- Omkring 300 MB ledig plads til appmappen og mindst 4 GB hukommelse (8 GB anbefales til store datasæt). Der kræves
  ingen administratorrettigheder.
- Internet kræves kun, når du henter data fra åbne API'er, synkroniserer med GitHub eller søger efter opdateringer.

## Hvad du kan

- **Hente**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, SDMX-JSON-, GeoJSON-, XML-, SQLite-, GeoPackage- og shapefile-filer, tabeller i HTML-, Markdown-, Word- og LaTeX-dokumenter, kortfiler i KML, KMZ, GPX og TopoJSON, SQL-scripts, ældre regnearksformater (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), tekst
  med fast kolonnebredde, statistikfiler fra SPSS, Stata og SAS (med værdietiketter) og PX-formatet samt Parquet og RDS (via R), indsat
  tekst, filer fra webadresser og data direkte fra åbne API'er hos Danmarks Statistik, Open Data DK, SSB,
  Folkehelseinstituttet, Brønnøysundregistrene, Kartverket, MET Norway, Statistikcentralen, THL, PRH, Fintraffic,
  Meteorologiska institutet, Hagstofa Íslands, Veðurstofa Íslands, Grønlands Statistik, Hagstova Føroya, ÅSUB,
  Nordic Statistics, Eurostat, ECB, OECD og svenske myndigheder som SCB, Kolada og SMHI, med landefilter og gemte
  hentninger, der opdateres med ét klik og afspiller deres opskrifter (se [api-konfiguration.md](api-konfiguration.md)).
  Eksempeldata og kommune- og regionsgrænser for Sverige, Danmark, Norge og Finland følger med.
- **Bearbejde**: gennemse, sortere og filtrere store tabeller, redigere celler, rense, sætte typer, omkode, inddele i klasser, rangordne, beregne andele, løbende summer og ændringer, pivotere
  og sammenkoble data, kontrollere datakvalitet med profil og regler (blandt andet formater, nordiske identitetsnumre, referencer til andre datasæt og afvigende værdier), pseudonymisere personnumre før deling, med
  fortryd, versioner og recepter, der kan eksporteres som R eller SQL (se [bearbeta.md](bearbeta.md)).
- **Analysere**: en indbygget R-konsol med ggplot2 og tidyverse (se [r-guide.md](r-guide.md)), en SQL-konsol, hvor
  datasæt kobles sammen med join via deres kortnavne, og notesbøger med tekst-, R- og SQL-celler, der bliver til
  rapporter i HTML, Word, PDF, Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)), og en Regex-fane, hvor regulære udtryk afprøves på en kolonne og bruges til at filtrere, udtrække, erstatte og opdele (se [regex.md](regex.md)), helt i browseren.
- **Visualisere**: diagrammer med Vega-Lite (herunder koropletkort og punktkort, faste aksegrænser, logaritmisk skala, referencelinjer og trendlinjer), D3-skabeloner eller R, eksporteret
  som SVG, PNG, PDF og PowerPoint, også i batch pr. gruppe, og dashboards med fælles filtre, der bliver til HTML eller
  PowerPoint (se [visualisera.md](visualisera.md)).
- **Dokumentere**: rapporter og kodebøger fra skabeloner som HTML, Word, PDF, Markdown eller LaTeX, også ét dokument
  pr. kommune eller år (se [dokumentmallar.md](dokumentmallar.md)).
- **Eksportere og dele**: data til CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata og RDS; pakker
  med valgte datasæt og objekter, en besked og en ændringslog, kommentarer til datasæt og kolonner, backup af
  arbejdsområdet som ZIP, synkronisering med et GitHub-repository og, i Edge og Chrome, en portabel mappe med
  almindelige filer.
- **Finde hurtigt**: kommandopaletten (Ctrl+K) skifter tilstand, åbner datasæt, diagrammer og dashboards og kører
  handlinger fra ét søgefelt.
- **Seks sprog**: brugerflade, meddelelser og dokumentation på svensk, dansk, norsk (bokmål), finsk, islandsk og
  engelsk.
- **Grundkursus**: en interaktiv gennemgang af alle seks tilstande med eksempeldata på alle seks sprog. Det vises første
  gang, appen åbnes, og kan åbnes når som helst fra hjælpen eller kommandopaletten.

## Lær mere

Filnavnene er de samme på alle sprog (de svenske originaler), så links virker ens overalt.

- **Grundkurset** i appen: en interaktiv gennemgang af alle tilstande med eksempeldata; åbn det fra hjælpen (?) eller
  med Ctrl+K.
- [Kom i gang](kom-igang.md): trin for trin med almindelige spørgsmål.
- [Brugervejledning](anvandarguide.md): hele arbejdsgangen fra fil til rapport.
- [Ofte stillede spørgsmål](faq.md): lager, sikkerhed, R, API'er og opdateringer.
- [De seks tilstande](lagen.md): hvad der findes hvor og hvorfor.
- [Notesbog](anteckningsbok.md): tekst, R og SQL i celler, der bliver til en rapport.
- [Regulære udtryk](regex.md): mønstre til at analysere, rette og opdele tekst i datasæt.
- [Formater og import](format.md): filformater, tegnkodning, decimaltegn, datoer og kolonnetyper.
- [Åbne API'er](api-konfiguration.md): de forudindstillede kilder, nøgler og egne konfigurationer.
- [R i Dataspatium](r-guide.md): R-konsollen, `dm_read()`, `dm_write()` og de medfølgende pakker.
- [Visualisér](visualisera.md): diagrambyggeren, D3-skabeloner, R-diagrammer, kort og dashboards.
- [Dokumenter og skabeloner](dokumentmallar.md): skabelonsproget og outputformaterne.
- [Licenser](licenser.md): hvad du må med appen, og hvilke licenser tredjepartskomponenterne har.
- [Udvikling](../utveckling.md), [Arkitektur](../arkitektur.md) og [Stilguide](../stilguide.md) for dem, der vil
  forstå koden (på svensk); hvordan bidrag modtages, står i [CONTRIBUTING.md](../../CONTRIBUTING.md) (svensk).
- Eksterne ressourcer: [WebR](https://docs.r-wasm.org/webr/latest/), [R for begyndere](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [Danmarks Statistiks API](https://www.dst.dk/da/Statistik/brug-statistikken/muligheder-i-statistikbanken/api).

## Begrænsninger i korte træk

- Appen skal åbnes fra en udpakket mappe (file://) eller en almindelig webserver; den fungerer ikke direkte inde i en
  ZIP-fil.
- API'er uden CORS-understøttelse (for eksempel Energi Data Service) kan ikke kaldes direkte fra browseren.
- Et datasæt bør holde sig under et par millioner rækker; browserens hukommelse sætter grænsen.
- Når appen åbnes fra en mappe, kan R-kode ikke afbrydes midt i en beregning; brug *Genstart R*. Fra en webserver
  (localhost eller https) findes knappen *Afbryd*.
- Flere faner fungerer og holder hinanden orienteret, men redigér ikke samme datasæt i to faner samtidig: den, der
  gemmer sidst, vinder.
- Den portable mappe kræver Edge eller Chrome; Firefox mangler mappeadgang (File System Access). Backup som ZIP
  fungerer overalt.
- Safari og mobile browsere understøttes ikke.
- De medfølgende eksempeldata og kortgrænser er svenske; selve appen fungerer med data fra hvor som helst.

## Fejl og forslag

Rapportér fejl eller ønsker som *Issues* her på GitHub. Beskriv browser, version af Dataspatium (vises under
hjælpeknappen), og hvad du gjorde. Se [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Udvikling

- Intet byggetrin, ingen node.js. Åbn `index.html` direkte, eller servér mappen med `python -m http.server 8080`.
- Tredjepartskomponenter: `python tools/fetch_vendor.py` efterfulgt af `python tools/wrap_assets.py`.
- Test: `powershell -File tools/run-tests.ps1` (headless Edge og Firefox). Se [utveckling.md](../utveckling.md)
  (svensk).

## Licens

Dataspatiums egen kode, dokumentation og forudindstillinger (alt undtagen `vendor/`) er licenseret under
[PolyForm Strict 1.0.0](../../LICENSE): fri at downloade og bruge til ikke-kommercielle formål, også i myndigheder og
andre offentlige institutioner, men ikke at ændre, bygge videre på eller videredistribuere uden skriftlig
tilladelse. Licensgiver er Dataspatiums ophavsperson, der kan kontaktes via GitHub-kontoen
[marwiss](https://github.com/marwiss); opret et issue for andre vilkår. Hvad licensen betyder i praksis, forklares i
[licenser.md](licenser.md).

Tredjepartskomponenter i `vendor/` har deres egne licenser (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), se
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og de GPL-licenserede R-pakker distribueres uændret;
kildekoden findes hos [R-projektet](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr)
og [CRAN](https://cran.r-project.org/) i de versioner, der angives der.
