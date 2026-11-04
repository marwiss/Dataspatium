# Brugervejledning

Denne vejledning beskriver, hvordan du arbejder i Dataspatium fra første fil til færdig rapport. Den forudsætter, at du
har åbnet appen som beskrevet i [kom-igang.md](kom-igang.md). Detaljer om hver tilstand findes i [lagen.md](lagen.md),
om filformater i [format.md](format.md), om API'er i [api-konfiguration.md](api-konfiguration.md), om bearbejdning i
[bearbeta.md](bearbeta.md), om R i [r-guide.md](r-guide.md), om Python i [python.md](python.md), om diagrammer i [visualisera.md](visualisera.md) og om
dokumenter i [dokumentmallar.md](dokumentmallar.md). Almindelige spørgsmål besvares i [faq.md](faq.md).

## Arbejdsområdet

Skærmen ser ens ud i alle tilstande. Øverst skifter du tilstand (Hent, Håndter, Søg, Bearbejd, Analysér, Visualisér,
Eksportér, Del; Alt+1 til Alt+8 virker også) og når kommandopaletten (forstørrelsesglasset eller Ctrl+K),
sprogknappen, tema (lyst eller mørkt) og hjælpeknappen med versionsnummer og *Søg efter opdateringer*.
Kommandopaletten er den hurtigste vej til det meste: skriv nogle bogstaver for at skifte tilstand, åbne et datasæt,
et diagram eller et dashboard, søge i data eller køre en handling på det valgte datasæt. Til venstre findes
tilstandens objekter (datasæt, kilder, diagrammer, skabeloner), i midten arbejdsfladen og til højre inspektøren med
egenskaber og statistik. Nederst ligger statuslinjen: gemmestatus, lager, det valgte datasæt, R-motoren,
igangværende internetkald og knapperne, der folder panelerne ind og åbner loggen, hvor hver handling, advarsel og
fejl skrives; det er den, du læser, når noget ikke bliver, som du havde tænkt. Panelernes bredde ændres ved at
trække i kanten mod arbejdsfladen, og i smalle vinduer åbnes panelerne som ark over arbejdsfladen (se
[lagen.md](lagen.md)).

Alt, hvad du opretter, gemmes automatisk i browserens database på din computer. Intet sendes nogen steder, medmindre
du selv henter fra et API, søger efter opdateringer, sender til GitHub eller deler. Første gang appen har brug for
internettet til et formål, spørger den om lov, og svaret kan gemmes; under *Håndter → Arbejdsområde →
Internetadgang* ser du, hvad der er tilladt, og hvilke kald der er foretaget. Dele af appen, der ikke følger med i
mappen (visse komponenter og R-pakker), hentes på samme måde, når der er brug for dem, og gemmes derefter lokalt.

## Grundkurset

Grundkurset er en god måde at lære appen at kende på. Det starter efter sprogvalget første gang, appen åbnes, og
ellers fra hjælpen (spørgsmålstegnet øverst til højre) eller med kommandoen *Åbn grundkurset* i kommandopaletten.
Kurset vises i et panel nederst til højre, mens du arbejder i den rigtige app, og det følger eksemplet *Befolkning pr.
kommune 2024 (Sverige)* i ni trin:

1. Velkommen: hvad appen gør, og hvordan skærmen er indrettet.
2. Hent: importér eksempeldata, og hvad et datasæt er.
3. Håndter: navn og kortnavn, kilde, kolonner, versioner og backup.
4. Bearbejd: tabellen, kolonneprofiler og en beregnet kolonne, der bliver et trin i receptet.
5. Analysér med SQL: folketallet pr. län, og hvordan kortnavne forbinder datasæt.
6. Analysér med R: `dm_read()`, en opsummering og et histogram med ggplot2.
7. Visualisér: et liggende søjlediagram over folketallet pr. län.
8. Eksportér: data, diagrammer og dokumenter.
9. Færdig: hvor du går videre.

Hvert trin forklarer et begreb og giver en opgave. En ramme markerer knappen, du skal klikke på, og trinnet bliver
krydset af, når appen ser, at opgaven er løst. *Gør det for mig* (eller *Vis mig*) udfører trinnet, så du kan følge med
uden at skrive noget. Kurset kan minimeres med pilen og lukkes med krydset; næste gang fortsætter det, hvor du slap.
Det opretter eksempeldatasættet, en kolonne i det og et diagram, som du sletter som sædvanligt, når du ikke længere har
brug for dem.

## En arbejdsgang fra fil til rapport

### 1. Hent data (Hent)

Slip en fil på fladen, indsæt en tabel, eller hent en fil fra en webadresse (serveren skal tillade CORS; en delt
Dataspatium-konfiguration tilføjes direkte). Kontrollér forhåndsvisningen: tegnkodning, skilletegn, overskriftsrække og
decimaltegn gættes, men kan ændres. I kolonnetrinnet får hver kolonne en type; koder med foranstillede nuller
(kommunekoder, personnumre) bevares som tekst. Giv datasættet et navn, og importér. Under fladen findes data,
der følger med appen: knappen til eksempeldataene *Befolkning pr. kommune 2024 (Sverige)* og listen *Grænser til kort*
med kommune- og regionsgrænser for Sverige, Danmark, Norge og Finland.

Under *Åbne API'er* findes forudindstillinger for statistikbureauerne og flere andre myndigheder i Danmark, Norge,
Finland og Island, de selvstyrende områder, Nordic Statistics, Eurostat og de svenske myndigheder (SCB,
Folkhälsomyndigheten, Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, Lantmäteriet, Sveriges dataportal samt Boverket
for dem, der har nøgler). Landeknapperne over listen vælger, hvilke landes kilder der vises. Gennemse eller søg en
tabel frem, vælg variabler, forhåndsvis, og hent til et nyt datasæt, eller tilføj til et eksisterende. Et hentet datasæt
husker sin forespørgsel, så det kan hentes igen fra Håndter, når kilden er opdateret, og *Gemte hentninger* i Hent
opdaterer sådanne datasæt med ét klik og afspiller deres opskrifter.

Databaser: Access-filer slippes på fladen som andre filer; databaser på computeren (SQL Server, ODBC, Excel, SQLite)
nås gennem *Database via broen* og tjenester over HTTP (PostgREST, OData, GraphQL med flere) gennem *Tilføj
databasekilde*. I Chrome og Edge kan en fil linkes og indlæses igen fra disken. Se [kallor.md](kallor.md).

### 2. Gennemse og ret (Bearbejd)

Tabellen viser datasættet række for række, selv når det har hundredtusinder af rækker. Klik på en overskrift for at
sortere og se kolonnens statistik til højre: antal, manglende, unikke, mindste, største, gennemsnit og hyppigste værdier.
Filtrér med søgefeltet. Dobbeltklik på en celle for at ændre den.

*Datakvalitet* gennemgår alle kolonner og peger på problemer (tal gemt som tekst, blandede datoformater, dubletter,
kodningsfejl, afvigende kategorier) med en knap, der udfører den rigtige handling. *Regler* lader dig skrive ned, hvad der
skal gælde (må ikke mangle, unik, interval, liste, mønster, længde, SQL-betingelse), køre kontrollen når som helst, gemme
fejlende rækker som eget datasæt og downloade en rapport. Alle handlinger findes også i paletten: fjern tomme rækker,
fjern mellemrum, store og små bogstaver, søg og erstat med regulære udtryk, skift type, fortolk datoer og tal, udfyld
manglende værdier, dubletter, klyng lignende kategorier og mere. Hver handling logges som et trin i recepten og kan
fortrydes. Før deling kan identifikatorer som personnumre pseudonymiseres med saltede hashværdier, maskering eller
løbenumre; saltet gemmes aldrig i recepten.

### 3. Kombinér og omform (Bearbejd)

Beregnede kolonner, opdel og kombinér kolonner, filtrér rækker fra, omdøb og omordn, pivotér mellem bred og lang form,
gruppér og aggregér, sammenkobl to datasæt på en nøgle, og sammenlæg datasæt med de samme kolonner. Aggregeringer,
sammenkoblinger og sammenlægninger bliver nye datasæt, så originalen bevares. Gruppen *Geodata* giver centroide og areal
fra geometrier, omregning mellem SWEREF 99 TM og WGS 84 samt svensk kommune og län fra koordinater med de medfølgende
grænser.

Recepten (alle trin i rækkefølge) kan vises, afspilles på en ny version af data og eksporteres som JSON, R-kode eller
SQL. Versioner tages ved import, før massehandlinger og efter ønske; to versioner kan sammenlignes og en ældre gendannes.

### 4. Analysér med R og SQL (Analysér)

R-konsollen kører rigtig R (WebR) i browseren. `dm_list()` viser datasættene, `dm_read("kortnavn")` læser et som
data.frame med de rigtige typer, `dm_write(df, "Nyt navn")` sender en data.frame tilbage som nyt datasæt.
`theme_dataspatium()` og `dm_palette()` giver ggplot2 appens udseende. Diagrammer vises i panelet og eksporteres som SVG,
PNG eller PDF. Pakker som ggplot2, dplyr, tidyr, data.table, haven og readxl følger med og installeres i sessionen første
gang, de bruges. Scripts kan gemmes og køres igen. Første start tager nogle sekunder.

SQL-fanen forespørger datasættets tabel `data` direkte med SQLite. Andre datasæt nås med deres kortnavne (vises under
navnet i objektpanelet), så én forespørgsel kan lave join over flere datasæt, for eksempel
`select ... from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. SELECT-forespørgsler viser
resultatet (op til 5 000 rækker) og kan gemmes som nyt datasæt; UPDATE, DELETE og ALTER logges som trin i recepten.
Knappen *Indsæt dm_read()* og R-eksemplerne i inspektøren bruger også kortnavnet.

Fanen *Notesbog* samler tekst (Markdown), R og SQL i celler, der køres i rækkefølge og gemmer deres output. En færdig
notesbog eksporteres som HTML, Word, PDF, Markdown eller LaTeX, med eller uden koden. Se
[anteckningsbok.md](anteckningsbok.md).

Fanen *Regex* afprøver et regulært udtryk på en kolonne, mens du skriver: de hyppigste værdier vises med træfferne
markeret, og de matchende rækker tælles. Samme mønster kan derefter filtrere rækker, udtrække grupper til nye
kolonner, erstatte, opdele, markere eller tælle træffere eller blive en kvalitetsregel. *Mønsterprofil* viser
værdiernes former (for eksempel `9999-99-99` og `99/99/9999` for datoer), og biblioteket til venstre har færdige
mønstre for blandt andet personnumre, postnumre og datoer. Se [regex.md](regex.md).

### 5. Visualisér (Visualisér)

Diagrambyggeren laver søjle-, linje-, areal-, punkt-, cirkel- og andre diagrammer fra et datasæt: vælg kolonner til akser,
farve og små paneler, aggregering, sortering og titler. D3-skabeloner giver specialdiagrammer (lollipop,
hældningsdiagram, befolkningspyramide), og R-diagrammer kan gemmes med deres kode. Alle motorer bruger samme farver og
skrifttyper. Gemte diagrammer samles i galleriet og eksporteres som SVG, PNG, PDF eller PowerPoint, enkeltvis eller ét
pr. gruppe (for eksempel pr. kommune) til en ZIP eller en præsentation. Kort tegnes med diagramtypen *Kort* fra et
datasæt med geometri (de medfølgende svenske kommune- eller länsgrænser eller egne fra GeoJSON, shapefile og GeoPackage)
koblet til værdier pr. kode, og med *Punktkort* fra længde- og breddegrad med grænserne som baggrund. Et dashboard samler
flere gemte diagrammer i et gitter med fælles filtre, for eksempel län eller år, og eksporteres som selvstændig HTML
eller PowerPoint.

### 6. Dokumenter (Eksportér, fanen Dokumenter)

Dokumentskabeloner skrives i Markdown med pladsholdere: `{{datamangd}}`, `{{antal_rader}}`, `{{#tabell}}…{{/tabell}}` til
rækker, `{{diagram "Navn"}}` til et gemt diagram, `{{sidbrytning}}` og nøgletal som `{{summor.kolumn}}`. Rapport, kodebog
og gruppesammenfatning er indbygget. Generér som HTML, Word, PDF, Markdown eller LaTeX, enkeltvis eller ét dokument pr.
gruppe.

### 7. Eksportér data (Eksportér, fanen Data)

CSV (tilpasset Excel i Norden eller standard), Excel, ODS, JSON, GeoJSON (til datasæt med geometri), XML, SQLite samt via
R: Parquet, SPSS, Stata og RDS. SQLite og Parquet bevarer typerne nøjagtigt; alle formater kan importeres igen.

## Find i data (Søg)

Søg finder rækker uden kode. Skriv et eller flere ord, vælg alle datasæt eller kun det valgte, og tryk på *Søg*.
Resultaterne vises pr. datasæt; facetterne (de hyppigste værdier i kolonner med få forskellige værdier) indsnævrer
med et klik, og en række i tabellen viser hele posten i inspektøren. Søgningen kan gemmes som liste, blive til et nyt
datasæt eller åbnes i Bearbejd med datasættet valgt. Fanen *Forespørgsel* bygger en forespørgsel over et eller flere
datasæt med kolonner, beregninger, betingelser og sortering uden kode og viser den SQL, der laves; gemte lister
indsnævrer tabellen i Bearbejd og rækkerne i diagrammer. Se [soka.md](soka.md).

## Hold orden (Håndter)

Hvert datasæt har en oversigt (kilde, størrelse, beskrivelse, mappe og tags), en kolonneliste med typer, etiketter,
beskrivelser og enheder (sættes under Bearbejd med *Etiket, beskrivelse og enhed*), kommentarer, en læsbar historik
over alt, hvad der er gjort, og versioner. Omdøb og ændr kortnavn, ordn, slet, eller hent igen fra API (opdatér med
opskriften, eller tilføj rækker). Under *Arbejdsområde* ser du, hvor meget lager der bruges, beder om vedvarende
lager, tager backup som ZIP og gendanner. Appen minder dig ved start, når der er gået længere tid end det valgte
antal dage siden seneste backup (30 dage som standard; ændres eller slås fra i samme kort). I Edge og Chrome kan
arbejdsområdet desuden spejles til en portabel mappe på disken, automatisk ved hver ændring.

Objektpanelet i Håndter er et træ. *Ordn* giver et datasæt en mappe (med undermapper, som `Økonomi/2026`) og tags;
mapper kan foldes sammen, og et datasæt kan trækkes til en anden mappe. Filterfeltet søger på navn, kortnavn, tag og
mappe, og listen kan sorteres efter ændret, navn eller rækker. Afkrydsningsfelterne vælger flere datasæt (Skift
vælger et interval), og knappen *Handlinger (n)* gør det samme med alle på én gang: ordn, pak, eksportér som ZIP med
CSV-filer, hent igen fra API, kør en opskrift eller slet. Mappe og tags gemmes i datasættets fil og følger med i
pakker, backupper og GitHub; i R viser `dm_list()` mappen, og `dm_read("Mappe/Navn")` læser et datasæt i en mappe.

## Del med andre

Alt, hvad der skal til andre mennesker, findes i tilstanden *Del* (se [dela.md](dela.md)):

- Et udvalg: *Pakke* giver en ZIP med valgte datasæt, diagrammer, dashboards, skabeloner, notesbøger og scripts, en
  besked og en ændringslog: det, der er gjort med hvert datasæt, siden det sidst blev delt, og de kommentarer, der
  ikke er løst. Modtageren åbner den under *Modtag*, ser beskeden og ændringerne og vælger for datasæt, der allerede
  findes, om de skal erstattes med pakkens version (den egen gemmes under *Versioner*); resten springes over. Under
  Håndter gør *Handlinger* på flere valgte datasæt det samme.
- Kommentarer: hvert datasæt har fanen *Kommentarer* i Håndter, og i Bearbejd kommenterer du en kolonne fra inspektøren.
  Kommentarerne ligger i datasættets fil og følger med i pakker, backupper, den portable mappe og GitHub. Navnet, der
  vises, angiver du selv; det gemmes kun i browseren.
- Hele arbejdsområdet: backuppen (ZIP) gendannes under Håndter på en anden computer.
- Mellem computere via GitHub: fanen *GitHub* sender arbejdsområdet til et GitHub-repository (helst privat) og henter
  det på en anden computer. Det kræver et finkornet adgangstoken (fine-grained personal access token), der kun må læse
  og skrive indholdet i netop det repository. Tokenet bruges i sessionen eller gemmes krypteret, og intet sendes, før
  du trykker *Send til GitHub* eller *Hent fra GitHub*. Kun ændrede filer sendes, i én commit med din besked; ved
  hentning vælger du, som for pakker, om eksisterende datasæt skal erstattes.
- Direkte til en telefon eller en anden computer på samme netværk: fanen *Enheder* viser en QR-kode, som telefonen
  scanner; Dataspatium Mobil modtager, viser og sender videre (se [mobil.md](mobil.md)). Begge enheder viser samme
  kontrolkode, og efter en parring er én scanning nok.
- Via computerens eller telefonens delingsmenu: fanen *Delingsmenu* sender et datasæt som CSV, Excel, ODS eller JSON,
  eller alle datasæt som pakke, til e-mail, Teams og andre apps (Edge og Chrome; Firefox gemmer filen).
- Gennemgang først: når datasæt pakkes eller sendes, søger appen efter identitetsnumre, e-mail og telefonnumre og
  lader dig pseudonymisere eller fjerne kolonnerne i kopien.
- Som færdig webside: fanen *Udgiv* gør et dashboard eller et dokument til en selvstændig HTML-fil.
- Ét datasæt: eksportér som SQLite (alt følger med) eller Parquet under Eksportér.
- API-konfigurationer (`.api.json`), diagrammer og dokumentskabeloner (JSON) og opskrifter (JSON, R eller SQL)
  eksporteres og indlæses som filer. Nøgler følger aldrig med.

## Hjælp i appen

Hele håndbogen findes i appen: knappen **?** øverst til højre, tasten **F1** eller kommandoen *Hjælp* i
kommandopaletten åbner den ved kapitlet for den tilstand, du står i. Til venstre er indholdet, ovenover et søgefelt,
der søger i alle afsnit, og links mellem dokumenterne følges inde i håndbogen. Dialoger med en **?**-knap åbner det
rette afsnit direkte. Håndbogen følger appens sprog og kræver intet netværk; nederst findes versionen, *Søg efter
opdateringer* og linket til dokumentationen på GitHub.

## Tastatur

Alt+1 til Alt+8 skifter tilstand, Ctrl+K åbner kommandopaletten, og F1 åbner håndbogen. Kanten mellem et panel og arbejdsfladen kan få
fokus med Tab og flyttes med piletasterne (Skift for større trin, Home og End for mindste og største bredde). Første tryk på Tab på siden viser linket *Spring til
indhold*, der flytter fokus forbi tilstandsvælgeren og objektpanelet. Alt kan nås med Tab og Enter; dialoger lukkes med
Esc. I tabellen flytter piletasterne mellem celler, og Enter redigerer. Appen følger systemindstillingen for reduceret
bevægelse.

Faner skiftes med venstre og højre piletast, Home og End. Alle knapper, felter og kodeeditorer har navne, som
skærmlæsere læser op, dialoger læses op med deres overskrift, og siden har landemærker for tilstandsvælgeren,
objektpanelet, arbejdsfladen og inspektøren. Tekst og feltkanter har kontrast efter WCAG AA i både lyst og mørkt
tema. Diagrammer fra diagrambyggeren beskrives for skærmlæsere af Vega; for R-diagrammer og D3-skabeloner findes
tallene i tabellen i Bearbejd.

## Sprog

Brugerfladen findes på svensk, dansk, norsk (bokmål), finsk, islandsk og engelsk. Første gang appen åbnes, vælger du
sprog; sprogknappen øverst til højre (eller kommandoen *Sprog* i paletten) skifter det senere. Valget gemmes i browseren,
så hver computer og browserprofil har sit eget. Tal i brugerfladen følger sprogets konventioner; selve data ændres aldrig.
R's meddelelser følger samme valg, mens skabelonernes pladsholdere som `{{datamangd}}` og tabelnøgleordene `kolumner`,
`sortera`, `topp`, `filter` og `rubrik` er en del af skabelonsproget og er ens på alle sprog. Dokumentationen findes på
alle seks sprog under `docs/` (svensk i `docs/`, de øvrige i `docs/<sprog>/`).

## Når noget går galt

Læs loggen nederst: fejl, du kan rette, beskrives på dit sprog med forslag. Hvis R hænger, så brug *Genstart R*;
datasættene påvirkes ikke. Tag backup, før du rydder browserdata. Fejl rapporteres som issues på GitHub, se
[CONTRIBUTING.md](../../CONTRIBUTING.md).
