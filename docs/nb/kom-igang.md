# Kom i gang med Dataspatium

Denne veiledningen tar deg fra nedlasting til første eksport. Den forutsetter ikke noe annet enn en moderne nettleser.

## 1. Last ned og pakk ut

Hent den siste utgivelsen fra <https://github.com/marwiss/Dataspatium/releases/latest>: ZIP-filen
`dataspatium-<versjon>.zip` under *Assets*. Pakk den ut i en mappe du selv velger, for eksempel `Dokumenter\Dataspatium`.
Mappen inneholder `index.html`, mappene `src`, `vendor` og `docs` med mer. Ikke flytt eller gi nytt navn til filer inne i
mappen; hele mappen kan derimot flyttes fritt, også til en minnepinne.

## 2. Åpne appen

Dobbeltklikk på `index.html`. Nettleseren åpner appen fra datamaskinen din (adressen begynner med `file:///`). Virker ikke
dobbeltklikket, høyreklikker du og velger *Åpne med* og nettleseren din, eller drar filen til et åpent nettleservindu.

Første gang spør appen hvilket språk du vil bruke: svensk, dansk, norsk, finsk, islandsk eller engelsk. Valget lagres i
nettleseren og kan endres når som helst med språkknappen (ikonet med bokstaver) øverst til høyre eller via
kommandopaletten. Skrifttyper og ikoner lastes fra mappen; det tar et øyeblikk. Ingenting hentes fra internett.

### Grunnkurset

Etter språkvalget starter **grunnkurset**, en interaktiv gjennomgang i et panel nederst til høyre. Det tar omtrent ti
minutter og følger eksempelet *Befolkning per kommune 2024 (Sverige)* gjennom alle seks moduser: hent data, se på
datasettet, beregn en kolonne, spør med SQL, regn med R, lag et diagram og eksporter. Hvert trinn forklarer et begrep og
gir en oppgave. En ramme viser hvor du skal klikke, og trinnet hukes av når du har gjort det. *Gjør det for meg* utfører
trinnet for deg hvis du heller vil se hvordan det gjøres.

Kurset kan minimeres og lukkes, og det kan åpnes igjen når som helst fra hjelpen (spørsmålstegnet øverst til høyre)
eller fra kommandopaletten (Ctrl+K, *Åpne grunnkurset*). Det fortsetter der du slapp.

## 3. Modusene

Øverst finnes seks moduser. Panelet til venstre viser objekter (datasett og kilder), midten er arbeidsflaten, panelet til
høyre viser egenskaper og statistikk, og nederst er det en logg. Panelene kan felles inn med knappene øverst til høyre.
Alt+1 til Alt+6 bytter modus med tastaturet.

| Modus | Hva du gjør der |
|---|---|
| Hent | Importerer filer, limer inn tabeller og henter fra åpne API-er i Norden, som SSB, Danmarks Statistik, Statistikcentralen, Hagstofa Íslands, SCB og Eurostat ([api-konfiguration.md](api-konfiguration.md)) |
| Håndter | Ser datasettene dine, gir nytt navn, sletter, lagrer versjoner, sikkerhetskopierer og gjenoppretter arbeidsområdet |
| Bearbeid | Redigerer celler, sorterer og filtrerer, renser og setter typer, beregner kolonner, pivoterer, kobler datasett; alt med angre, versjoner og oppskrifter ([bearbeta.md](bearbeta.md)) |
| Analyser | R-konsoll med ggplot2 og tidyverse, lagrede skript og diagrameksport; SQL-konsoll mot det valgte datasettet |
| Visualiser | Lager diagrammer med Vega-Lite, D3-maler eller R-skript, lagrer, eksporterer og lager dem i batch ([visualisera.md](visualisera.md)) |
| Eksporter | Laster ned data som CSV, Excel, JSON eller SQLite, lagrede diagrammer som SVG, PNG eller PDF og dokumenter fra maler som HTML, Word, PDF, Markdown eller LaTeX ([dokumentmallar.md](dokumentmallar.md)) |

## 4. Importer en fil

1. Gå til *Hent*, og slipp en fil på det stiplede feltet (eller klikk og velg en fil). Støttede filformater: CSV, TSV og
   andre avgrensede tekstfiler, Excel (xlsx, xls, xlsm, xlsb), ODS, JSON, NDJSON, JSON-stat, GeoJSON, XML, SQLite,
   GeoPackage, shapefile (ZIP med shp og dbf), tekst med fast bredde samt statistikkfiler fra SPSS (sav), Stata (dta), SAS
   (sas7bdat, xpt), PX-formatet, Parquet og R (rds, RData). Filer kan også hentes direkte fra en nettadresse under *Fra
   nettadresse*. Statistikkformatene leses av R og importeres i ett trinn uten forhåndsvisning; første gang tar det noen
   sekunder mens R starter. Se [format.md](format.md).
2. Kontroller innstillingene. Dataspatium gjetter tegnkoding (UTF-8 eller Windows-1252), skilletegn, om første rad er
   overskrifter, og om desimaltegnet er komma eller punktum. Forhåndsvisningen viser de første 100 radene.
3. Kontroller kolonnene. Hver kolonne får en type: tekst, heltall, desimaltall, dato, dato og tid eller ja/nei. Koder med
   innledende nuller (kommunenumre, postnumre) beholdes som tekst. Endre navn eller type ved behov, og fjern avmerkingen på
   kolonner du ikke vil ha med.
4. Gi datasettet et navn, og klikk på *Importer*. Du kan deretter åpne det direkte i *Bearbeid*.

Tips: du kan også lime inn en tabell fra Excel eller en nettside via *Lim inn* i panelet til venstre.

## 5. Bla gjennom og kontroller

I *Bearbeid* vises tabellen. Klikk på en kolonneoverskrift for å sortere (stigende, fallende, usortert) og for å se
kolonnens statistikk til høyre: antall, manglende, unike, minste, største, gjennomsnitt, sum og vanligste verdier. Skriv i
filterfeltet for bare å vise rader som inneholder teksten. Store tabeller vises rad for rad etter hvert som du ruller, så
selv hundretusener av rader kan blas gjennom.

## 6. Eksporter

I *Eksporter* velger du format og filnavn og klikker på *Eksporter og last ned*.

- CSV med profilen *Tilpasset Excel i Norden* bruker semikolon, desimalkomma og UTF-8 med BOM, slik at Excel med nordiske
  innstillinger åpner filen riktig med en gang. Profilen *Standard* gir komma og desimalpunktum.
- Excel (xlsx) og ODS beholder tall, datoer og ja/nei som ekte typer.
- JSON gir en liste med objekter, XML en fil med ett element per rad.
- SQLite gir datasettets egen fil, som også kan leses i R, DB Browser for SQLite og mange andre verktøy.
- Parquet, SPSS (sav), Stata (dta) og RDS skrives av R og starter R-sesjonen ved behov.

Alle formater kan importeres igjen i Dataspatium.

## 7. Ta sikkerhetskopi

Datasettene ligger i nettleserens database på denne datamaskinen. De forsvinner hvis du sletter nettstedsdata, bytter
nettleserprofil eller avinstallerer nettleseren. Gå til *Håndter*, velg *Arbeidsområde*, og klikk på *Sikkerhetskopier
arbeidsområdet*. Du får en ZIP-fil med alle datasett. Gjenopprett ved å slippe ZIP-filen på feltet *Gjenopprett fra ZIP*.

I Edge og Chrome kan du dessuten velge en *portabel mappe*: arbeidsområdet lagres som vanlige filer (én SQLite-fil per
datasett samt diagrammer og maler) i en mappe du velger, for eksempel på en minnepinne eller i en synkronisert mappe. Slå på
*Lagre automatisk ved endringer*, så holdes mappen oppdatert. På en annen datamaskin velger du samme mappe og klikker på
*Last inn fra mappen*. Etter en omstart av nettleseren spør den én gang om lov til å bruke mappen igjen; klikk på *Koble til
igjen*.

Vil du sende et utvalg til en kollega, bruker du *Del pakke* på samme side: velg datasett, og om diagrammer, dashbord, maler
og notatbøker skal være med. Kollegaen slipper pakken på *Gjenopprett fra ZIP*; det som allerede finnes i arbeidsområdet
hennes eller hans, hoppes over.

## Vanlige spørsmål

**Siden er tom eller viser bare «Dataspatium starter».** Kontroller at hele mappen er pakket ut (ikke bare `index.html`), og
at du bruker en aktuell versjon av Edge, Chrome eller Firefox. Åpne nettleserens konsoll (F12), og se etter røde feil;
rapporter dem gjerne som et issue.

**Æ, ø og å ble til rare tegn.** Bytt tegnkoding i importtrinnet *Innstillinger*, oftest mellom UTF-8 og Windows-1252.

**Tall ble tekst.** Kolonnen inneholdt en verdi som ikke kunne tolkes som tall, eller tall med innledende nuller. Endre
typen i trinnet *Kolonner* for å tvinge fram en tolkning; verdier som ikke kan tolkes, blir tomme.

**Kan jeg dele data med en kollega?** Ja, eksporter datasettet (SQLite eller CSV), eller ta en sikkerhetskopi av
arbeidsområdet og send ZIP-filen. Kollegaen importerer eller gjenoppretter i sin Dataspatium.

**Hvorfor ingen server eller skytjeneste?** For at dataene dine skal bli hos deg, og for at appen skal fungere uten
installasjon, kontoer og internett.

Flere spørsmål og svar finnes i [faq.md](faq.md). Når du vil videre fra de første trinnene, beskriver
[anvandarguide.md](anvandarguide.md) hele arbeidsflyten fra fil til rapport.
