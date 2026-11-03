# Brugervejledning

Denne vejledning beskriver, hvordan du arbejder i Dataspatium fra første fil til færdig rapport. Den forudsætter, at du
har åbnet appen som beskrevet i [kom-igang.md](kom-igang.md). Detaljer om hver tilstand findes i [lagen.md](lagen.md),
om filformater i [format.md](format.md), om API'er i [api-konfiguration.md](api-konfiguration.md), om bearbejdning i
[bearbeta.md](bearbeta.md), om R i [r-guide.md](r-guide.md), om diagrammer i [visualisera.md](visualisera.md) og om
dokumenter i [dokumentmallar.md](dokumentmallar.md). Almindelige spørgsmål besvares i [faq.md](faq.md).

## Arbejdsområdet

Skærmen ser ens ud i alle tilstande. Øverst skifter du tilstand (Hent, Håndter, Bearbejd, Analysér, Visualisér,
Eksportér; Alt+1 til Alt+6 virker også) og ser arbejdsområdets status (gemt eller ugemt), kommandopaletten
(forstørrelsesglasset eller Ctrl+K), sprogknappen, tema (lyst eller mørkt) og hjælpeknappen med versionsnummer og *Søg
efter opdateringer*. Kommandopaletten er den hurtigste vej til det meste: skriv nogle bogstaver for at skifte tilstand,
åbne et datasæt, et diagram eller et dashboard eller køre en handling på det valgte datasæt. Til venstre findes
tilstandens objekter (datasæt, kilder, diagrammer, skabeloner), i midten arbejdsfladen og til højre inspektøren med
egenskaber og statistik. Nederst ligger loggen, hvor hver handling, advarsel og fejl skrives; det er den, du læser, når
noget ikke bliver, som du havde tænkt.

Alt, hvad du opretter, gemmes automatisk i browserens database på din computer. Intet sendes nogen steder, medmindre du
selv henter fra et API, søger efter opdateringer eller eksporterer.

## En arbejdsgang fra fil til rapport

### 1. Hent data (Hent)

Slip en fil på fladen, indsæt en tabel, eller hent en fil fra en webadresse (serveren skal tillade CORS; en delt
Dataspatium-konfiguration tilføjes direkte). Kontrollér forhåndsvisningen: tegnkodning, skilletegn, overskriftsrække og
decimaltegn gættes, men kan ændres. I kolonnetrinnet får hver kolonne en type; koder med foranstillede nuller
(kommunekoder, personnumre) bevares som tekst. Giv datasættet et navn, og importér. Knapperne under fladen tilføjer data,
der følger med appen: eksempeldataene *Befolkning pr. kommune 2024 (Sverige)* og SCB's svenske kommune- og
länsgrænser til kort.

Under *Åbne API'er* findes forudindstillinger for statistikbureauerne og flere andre myndigheder i Danmark, Norge,
Finland og Island, de selvstyrende områder, Nordic Statistics, Eurostat og de svenske myndigheder (SCB,
Folkhälsomyndigheten, Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, Lantmäteriet, Sveriges dataportal samt Boverket
for dem, der har nøgler). Landeknapperne over listen vælger, hvilke landes kilder der vises. Gennemse eller søg en
tabel frem, vælg variabler, forhåndsvis, og hent til et nyt datasæt, eller tilføj til et eksisterende. Et hentet datasæt
husker sin forespørgsel, så det kan hentes igen fra Håndter, når kilden er opdateret.

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

## Hold orden (Håndter)

Hvert datasæt har en oversigt (kilde, størrelse, beskrivelse), en kolonneliste med typer, etiketter, beskrivelser og
enheder (sættes under Bearbejd med *Etiket, beskrivelse og enhed*), historik over alt, hvad der er gjort, og versioner.
Omdøb og ændr kortnavn, slet, eller hent igen fra API. Under *Arbejdsområde* ser du, hvor meget lager der bruges, beder om
vedvarende lager, tager backup som ZIP og gendanner. Appen minder dig ved start, når der er gået længere tid end det valgte
antal dage siden seneste backup (30 dage som standard; ændres eller slås fra i samme kort). I Edge og Chrome kan
arbejdsområdet desuden spejles til en portabel mappe på disken, automatisk ved hver ændring.

## Del med andre

- Et udvalg: *Del pakke* under Håndter giver en ZIP med valgte datasæt, diagrammer, dashboards, skabeloner og notesbøger.
  Modtageren indlæser den under *Gendan fra ZIP*; det, der allerede findes, springes over.
- Hele arbejdsområdet: backuppen (ZIP) gendannes under Håndter på en anden computer.
- Ét datasæt: eksportér som SQLite (alt følger med) eller Parquet.
- API-konfigurationer (`.api.json`), diagrammer og dokumentskabeloner (JSON) og recepter (JSON, R eller SQL) eksporteres
  og indlæses som filer. Nøgler følger aldrig med.

## Tastatur

Alt+1 til Alt+6 skifter tilstand, og Ctrl+K åbner kommandopaletten. Første tryk på Tab på siden viser linket *Spring til
indhold*, der flytter fokus forbi tilstandsvælgeren og objektpanelet. Alt kan nås med Tab og Enter; dialoger lukkes med
Esc. I tabellen flytter piletasterne mellem celler, og Enter redigerer. Appen følger systemindstillingen for reduceret
bevægelse.

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
