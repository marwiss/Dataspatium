# Kom i gang med Dataspatium

Denne rettleiinga tek deg frå nedlasting til første eksport. Ho føreset ikkje noko anna enn ein moderne nettlesar.

## 1. Last ned og pakk ut

Hent den siste utgjevinga frå <https://github.com/marwiss/Dataspatium/releases/latest>: ZIP-fila
`dataspatium-<versjon>.zip` under *Assets*. Pakk henne ut i ei mappe du sjølv vel, til dømes `Dokument\Dataspatium`.
Mappa inneheld `index.html`, mappene `src`, `vendor` og `docs` med meir. Ikkje flytt eller gje nytt namn til filer inne i
mappa; heile mappa kan derimot flyttast fritt, òg til ein minnepinne.

## 2. Opne appen

Dobbeltklikk på `index.html`. Nettlesaren opnar appen frå datamaskina di (adressa byrjar med `file:///`). Verkar ikkje
dobbeltklikket, høgreklikkar du og vel *Opne med* og nettlesaren din, eller dreg fila til eit ope nettlesarvindauge.

Første gongen spør appen kva språk du vil bruke: svensk, dansk, norsk bokmål, norsk nynorsk, finsk, islandsk eller engelsk. Valet blir lagra i
nettlesaren og kan endrast når som helst med språkknappen (ikonet med bokstavar) øvst til høgre eller via
kommandopaletten. Skrifttypar og ikon blir lasta frå mappa; det tek ei augneblink. Ingenting blir henta frå internett.

### Grunnkurset

Etter språkvalet startar **grunnkurset**, ein interaktiv gjennomgang i eit panel nedst til høgre. Det tek om lag ti
minutt og følgjer dømet *Folketal per kommune 2024 (Sverige)* gjennom alle åtte modusane: hent data, sjå på
datasettet, søk, rekn ut ein kolonne, spør med SQL, rekn med R, lag eit diagram, eksporter og del. Kvart steg forklarar eit omgrep og
gjev ei oppgåve. Ei ramme viser kvar du skal klikke, og steget blir kryssa av når du har gjort det. *Gjer det for meg* utfører
steget for deg om du heller vil sjå korleis det blir gjort.

Kurset kan minimerast og lukkast, og det kan opnast igjen når som helst frå hjelpa (spørsmålsteiknet øvst til høgre)
eller frå kommandopaletten (Ctrl+K, *Opne grunnkurset*). Det held fram der du slapp.

## 3. Modusane

Øvst finst åtte modusar. Panelet til venstre viser objekt (datasett og kjelder), midten er arbeidsflata, panelet
til høgre viser eigenskapar og statistikk, og nedst finst statuslinja med lagringsstatus, lagring, det valde
datasettet, R-motoren og knappane som faldar panela inn og opnar loggen. Breidda på panela blir endra ved å dra i kanten
mot arbeidsflata. Alt+1 til Alt+8 byter modus med tastaturet.

| Modus | Kva du gjer der |
|---|---|
| Hent | Importerer filer, limer inn tabellar og hentar frå opne API-ar i Norden, som SSB, Danmarks Statistik, Statistikcentralen, Hagstofa Íslands, SCB og Eurostat ([api-konfiguration.md](api-konfiguration.md)) |
| Handter | Ser datasetta dine i mapper med taggar, gjev nytt namn, slettar, lagrar versjonar, køyrer batchhandlingar på fleire datasett, tek tryggingskopi av og gjenopprettar arbeidsområdet |
| Søk | Søkjer i alle kolonnar i eitt eller alle datasett, avgrensar med fasettar og lagrar søk som lister ([soka.md](soka.md)) |
| Bearbeid | Redigerer celler, sorterer og filtrerer, reinsar og set typar, reknar ut kolonnar, pivoterer, koplar datasett; alt med angre, versjonar og oppskrifter ([bearbeta.md](bearbeta.md)) |
| Analyser | R-konsoll med ggplot2 og tidyverse, lagra skript og diagrameksport; Python-konsoll med pandas og matplotlib; SQL-konsoll mot det valde datasettet; regulære uttrykk; notatbok som blir rapport |
| Visualiser | Lagar diagram med Vega-Lite, D3-malar eller R-skript, lagrar, eksporterer og lagar dei i batch ([visualisera.md](visualisera.md)) |
| Eksporter | Lastar ned data som CSV, Excel, JSON eller SQLite, lagra diagram som SVG, PNG eller PDF og dokument frå malar som HTML, Word, PDF, Markdown eller LaTeX ([dokumentmallar.md](dokumentmallar.md)) |
| Del | Pakkar datasett med diagram og malar for kollegaer, sender dei direkte til telefonar og andre datamaskiner med QR-kode ([mobil.md](mobil.md)), sender arbeidsområdet til GitHub, deler via delingsmenyen på datamaskina og publiserer dashbord som HTML ([dela.md](dela.md)) |

## 4. Importer ei fil

1. Gå til *Hent*, og slepp ei fil på det stipla feltet (eller klikk og vel ei fil). Støtta filformat: CSV, TSV og
   andre avgrensa tekstfiler, Excel (xlsx, xls, xlsm, xlsb), ODS, JSON, NDJSON, JSON-stat, GeoJSON, XML, SQLite,
   GeoPackage, shapefile (ZIP med shp og dbf), tekst med fast breidd og dessutan statistikkfiler frå SPSS (sav), Stata (dta), SAS
   (sas7bdat, xpt), PX-formatet, Parquet og R (rds, RData). Filer kan òg hentast direkte frå ei nettadresse under *Frå
   nettadresse*. Statistikkformata blir lesne av R og importerte i eitt steg utan førehandsvising; første gongen tek det nokre
   sekund medan R startar. Sjå [format.md](format.md).
2. Kontroller innstillingane. Dataspatium gjettar teiknkoding (UTF-8 eller Windows-1252), skiljeteikn, om første rad er
   overskrifter, og om desimalteiknet er komma eller punktum. Førehandsvisinga viser dei første 100 radene.
3. Kontroller kolonnane. Kvar kolonne får ein type: tekst, heiltal, desimaltal, dato, dato og tid eller ja/nei. Kodar med
   innleiande nullar (kommunenummer, postnummer) blir haldne som tekst. Endre namn eller type ved behov, og fjern avmerkinga på
   kolonnar du ikkje vil ha med.
4. Gje datasettet eit namn, og klikk på *Importer*. Du kan deretter opne det direkte i *Bearbeid*.

Tips: du kan òg lime inn ein tabell frå Excel eller ei nettside via *Lim inn* i panelet til venstre.

## 5. Bla gjennom og kontroller

I *Bearbeid* blir tabellen vist. Klikk på ei kolonneoverskrift for å sortere (stigande, fallande, usortert) og for å sjå
statistikken for kolonnen til høgre: tal, manglande, unike, minste, største, gjennomsnitt, sum og vanlegaste verdiar. Skriv i
filterfeltet for berre å vise rader som inneheld teksten. Store tabellar blir viste rad for rad etter kvart som du rullar, så
sjølv hundretusenvis av rader kan blaast gjennom.

## 6. Eksporter

I *Eksporter* vel du format og filnamn og klikkar på *Eksporter og last ned*.

- CSV med profilen *Tilpassa Excel i Norden* brukar semikolon, desimalkomma og UTF-8 med BOM, slik at Excel med nordiske
  innstillingar opnar fila rett med ein gong. Profilen *Standard* gjev komma og desimalpunktum.
- Excel (xlsx) og ODS held på tal, datoar og ja/nei som ekte typar.
- JSON gjev ei liste med objekt, XML ei fil med eitt element per rad.
- SQLite gjev den eigne fila til datasettet, som òg kan lesast i R, DB Browser for SQLite og mange andre verktøy.
- Parquet, SPSS (sav), Stata (dta) og RDS blir skrivne av R og startar R-sesjonen ved behov.

Alle format kan importerast igjen i Dataspatium.

## 7. Ta tryggingskopi

Datasetta ligg i databasen til nettlesaren på denne datamaskina. Dei forsvinn om du slettar nettstaddata, byter
nettlesarprofil eller avinstallerer nettlesaren. Gå til *Handter*, vel *Arbeidsområde*, og klikk på *Ta tryggingskopi av
arbeidsområdet*. Du får ei ZIP-fil med alle datasett. Gjenopprett ved å sleppe ZIP-fila på feltet *Gjenopprett frå ZIP*.

I Edge og Chrome kan du dessutan velje ei *portabel mappe*: arbeidsområdet blir lagra som vanlege filer (éi SQLite-fil per
datasett og dessutan diagram og malar) i ei mappe du vel, til dømes på ein minnepinne eller i ei synkronisert mappe. Slå på
*Lagre automatisk ved endringar*, så blir mappa halden oppdatert. På ei anna datamaskin vel du same mappe og klikkar på
*Last inn frå mappa*. Etter ein omstart av nettlesaren spør han éin gong om løyve til å bruke mappa igjen; klikk på *Kople til
igjen*.

Vil du sende eit utval til ein kollega, går du til modusen *Del* og fana *Pakke*: vel datasett, og om diagram,
dashbord, malar, notatbøker og skript skal vere med. Kollegaen opnar pakken under *Ta imot* i same modus; det som
allereie finst i arbeidsområdet hennar eller hans, blir hoppa over.

## Vanlege spørsmål

**Sida er tom eller viser berre «Dataspatium startar».** Kontroller at heile mappa er pakka ut (ikkje berre `index.html`), og
at du brukar ein aktuell versjon av Edge, Chrome eller Firefox. Opne konsollen i nettlesaren (F12), og sjå etter raude feil;
rapporter dei gjerne som eit issue.

**Æ, ø og å vart til rare teikn.** Byt teiknkoding i importsteget *Innstillingar*, oftast mellom UTF-8 og Windows-1252.

**Tal vart tekst.** Kolonnen inneheldt ein verdi som ikkje kunne tolkast som tal, eller tal med innleiande nullar. Endre
typen i steget *Kolonnar* for å tvinge fram ei tolking; verdiar som ikkje kan tolkast, blir tomme.

**Kan eg dele data med ein kollega?** Ja, eksporter datasettet (SQLite eller CSV), eller ta ein tryggingskopi av
arbeidsområdet og send ZIP-fila. Kollegaen importerer eller gjenopprettar i sin Dataspatium.

**Kvifor ingen tenar eller skyteneste?** For at dataa dine skal bli hos deg, og for at appen skal fungere utan
installasjon, kontoar og internett.

Fleire spørsmål og svar finst i [faq.md](faq.md). Når du vil vidare frå dei første stega, skildrar
[anvandarguide.md](anvandarguide.md) heile arbeidsflyten frå fil til rapport.
