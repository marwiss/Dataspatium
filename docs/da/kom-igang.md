# Kom i gang med Dataspatium

Denne vejledning tager dig fra download til første eksport. Den forudsætter ikke andet end en moderne browser.

## 1. Download og pak ud

Hent den seneste udgivelse fra <https://github.com/marwiss/Dataspatium/releases/latest>: ZIP-filen
`dataspatium-<version>.zip` under *Assets*. Pak den ud i en mappe, du selv vælger, for eksempel
`Dokumenter\Dataspatium`. Mappen indeholder `index.html`, mapperne `src`, `vendor` og `docs` med mere. Flyt eller omdøb
ikke filer inde i mappen; hele mappen kan derimod flyttes frit, også til en USB-nøgle.

## 2. Åbn appen

Dobbeltklik på `index.html`. Browseren åbner appen fra din computer (adressen begynder med `file:///`). Virker
dobbeltklikket ikke, så højreklik, og vælg *Åbn med* og din browser, eller træk filen til et åbent browservindue.

Første gang spørger appen, hvilket sprog du vil bruge: svensk, dansk, norsk, finsk, islandsk eller engelsk. Valget
gemmes i browseren og kan ændres når som helst med sprogknappen (ikonet med bogstaver) øverst til højre eller via
kommandopaletten. Skrifttyper og ikoner indlæses fra mappen; det tager et øjeblik. Intet hentes fra internettet.

### Grundkurset

Efter sprogvalget starter **grundkurset**, en interaktiv gennemgang i et panel nederst til højre. Det tager omkring ti
minutter og følger eksemplet *Befolkning pr. kommune 2024 (Sverige)* gennem alle seks tilstande: hent data, se på
datasættet, beregn en kolonne, spørg med SQL, regn med R, lav et diagram og eksportér. Hvert trin forklarer et begreb
og giver en opgave. En ramme viser, hvor du skal klikke, og trinnet bliver krydset af, når du har gjort det. *Gør det
for mig* udfører trinnet for dig, hvis du hellere vil se, hvordan det gøres.

Kurset kan minimeres og lukkes, og det kan åbnes igen når som helst fra hjælpen (spørgsmålstegnet øverst til højre)
eller fra kommandopaletten (Ctrl+K, *Åbn grundkurset*). Det fortsætter, hvor du slap.

## 3. Tilstandene

Øverst findes seks tilstande. Panelet til venstre viser objekter (datasæt og kilder), midten er arbejdsfladen,
panelet til højre viser egenskaber og statistik, og nederst er der en log. Panelerne kan foldes ind med knapperne
øverst til højre. Alt+1 til Alt+6 skifter tilstand med tastaturet.

| Tilstand | Hvad du gør der |
|---|---|
| Hent | Importerer filer, indsætter tabeller og henter fra åbne API'er i Norden, som Danmarks Statistik, SSB, Statistikcentralen, Hagstofa Íslands, SCB og Eurostat ([api-konfiguration.md](api-konfiguration.md)) |
| Håndter | Ser dine datasæt, omdøber, sletter, gemmer versioner, tager backup af og gendanner arbejdsområdet |
| Bearbejd | Redigerer celler, sorterer og filtrerer, renser og sætter typer, beregner kolonner, pivoterer, sammenkobler datasæt; alt med fortryd, versioner og recepter ([bearbeta.md](bearbeta.md)) |
| Analysér | R-konsol med ggplot2 og tidyverse, gemte scripts og diagrameksport; SQL-konsol mod det valgte datasæt |
| Visualisér | Bygger diagrammer med Vega-Lite, D3-skabeloner eller R-scripts, gemmer, eksporterer og opretter dem i batch ([visualisera.md](visualisera.md)) |
| Eksportér | Downloader data som CSV, Excel, JSON eller SQLite, gemte diagrammer som SVG, PNG eller PDF og dokumenter fra skabeloner som HTML, Word, PDF, Markdown eller LaTeX ([dokumentmallar.md](dokumentmallar.md)) |

## 4. Importér en fil

1. Gå til *Hent*, og slip en fil på det stiplede felt (eller klik, og vælg en fil). Understøttede filformater: CSV,
   TSV og andre afgrænsede tekstfiler, Excel (xlsx, xls, xlsm, xlsb), ODS, JSON, NDJSON, JSON-stat, GeoJSON, XML,
   SQLite, GeoPackage, shapefile (ZIP med shp og dbf), tekst med fast bredde samt statistikfiler fra SPSS (sav), Stata
   (dta), SAS (sas7bdat, xpt), PX-formatet, Parquet og R (rds, RData). Filer kan også hentes direkte fra en webadresse
   under *Fra webadresse*. Statistikformaterne læses af R og importeres i ét trin uden forhåndsvisning; første gang
   tager det nogle sekunder, mens R starter. Se [format.md](format.md).
2. Kontrollér indstillingerne. Dataspatium gætter tegnkodning (UTF-8 eller Windows-1252), skilletegn, om første række
   er overskrifter, og om decimaltegnet er komma eller punktum. Forhåndsvisningen viser de første 100 rækker.
3. Kontrollér kolonnerne. Hver kolonne får en type: tekst, heltal, decimaltal, dato, dato og tid eller ja/nej. Koder med
   foranstillede nuller (kommunekoder, postnumre) bevares som tekst. Ændr navn eller type efter behov, og fravælg
   kolonner, du ikke vil have med.
4. Giv datasættet et navn, og klik på *Importér*. Du kan derefter åbne det direkte i *Bearbejd*.

Tip: du kan også indsætte en tabel fra Excel eller en webside via *Indsæt* i panelet til venstre.

## 5. Gennemse og kontrollér

I *Bearbejd* vises tabellen. Klik på en kolonneoverskrift for at sortere (stigende, faldende, usorteret) og for at se
kolonnens statistik til højre: antal, manglende, unikke, mindste, største, gennemsnit, sum og hyppigste værdier. Skriv
i filterfeltet for kun at vise rækker, der indeholder teksten. Store tabeller vises række for række, efterhånden som
du ruller, så selv hundredtusinder af rækker kan gennemses.

## 6. Eksportér

I *Eksportér* vælger du format og filnavn og klikker på *Eksportér og download*.

- CSV med profilen *Tilpasset Excel i Norden* bruger semikolon, decimalkomma og UTF-8 med BOM, så Excel med nordiske
  indstillinger åbner filen korrekt med det samme. Profilen *Standard* giver komma og decimalpunktum.
- Excel (xlsx) og ODS bevarer tal, datoer og ja/nej som rigtige typer.
- JSON giver en liste af objekter, XML en fil med ét element pr. række.
- SQLite giver datasættets egen fil, som også kan læses i R, DB Browser for SQLite og mange andre værktøjer.
- Parquet, SPSS (sav), Stata (dta) og RDS skrives af R og starter R-sessionen ved behov.

Alle formater kan importeres igen i Dataspatium.

## 7. Tag backup

Datasættene ligger i browserens database på denne computer. De forsvinder, hvis du rydder webstedsdata, skifter
browserprofil eller afinstallerer browseren. Gå til *Håndter*, vælg *Arbejdsområde*, og klik på *Tag backup af
arbejdsområdet*. Du får en ZIP-fil med alle datasæt. Gendan ved at slippe ZIP-filen på feltet *Gendan fra ZIP*.

I Edge og Chrome kan du desuden vælge en *portabel mappe*: arbejdsområdet gemmes som almindelige filer (én SQLite-fil
pr. datasæt samt diagrammer og skabeloner) i en mappe, du vælger, for eksempel på en USB-nøgle eller i en
synkroniseret mappe. Slå *Gem automatisk ved ændringer* til, så holdes mappen opdateret. På en anden computer vælger
du samme mappe og klikker på *Indlæs fra mappen*. Efter en genstart af browseren spørger den én gang om lov til at
bruge mappen igen; klik på *Tilslut igen*.

Vil du sende et udvalg til en kollega, så brug *Del pakke* på samme side: vælg datasæt, og om diagrammer, dashboards,
skabeloner og notesbøger skal med. Kollegaen slipper pakken på *Gendan fra ZIP*; det, der allerede findes i
vedkommendes arbejdsområde, springes over.

## Almindelige spørgsmål

**Siden er tom eller viser kun "Dataspatium starter".** Kontrollér, at hele mappen er pakket ud (ikke kun
`index.html`), og at du bruger en aktuel version af Edge, Chrome eller Firefox. Åbn browserens konsol (F12), og se
efter røde fejl; rapportér dem gerne som et issue.

**Mine æ, ø og å blev til mærkelige tegn.** Skift tegnkodning i importtrinnet *Indstillinger*, oftest mellem UTF-8 og
Windows-1252.

**Tal blev til tekst.** Kolonnen indeholdt en værdi, der ikke kunne fortolkes som tal, eller tal med foranstillede
nuller. Ændr typen i trinnet *Kolonner* for at gennemtvinge en fortolkning; værdier, der ikke kan fortolkes, bliver
tomme.

**Kan jeg dele data med en kollega?** Ja, eksportér datasættet (SQLite eller CSV), eller tag backup af arbejdsområdet,
og send ZIP-filen. Kollegaen importerer eller gendanner i sin Dataspatium.

**Hvorfor ingen server eller cloudtjeneste?** For at dine data bliver hos dig, og for at appen fungerer uden
installation, konti og internet.

Flere spørgsmål og svar findes i [faq.md](faq.md). Når du vil videre fra de første trin, beskriver
[anvandarguide.md](anvandarguide.md) hele arbejdsgangen fra fil til rapport.
