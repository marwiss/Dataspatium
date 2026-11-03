# De åtte modusene

Dataspatium er delt inn i åtte moduser som følger arbeidets gang, i samme ånd som statistikkproduksjonens samle
inn, bearbeide, analysere og formidle: Hent, Håndter, Søk, Bearbeid, Analyser, Visualiser, Eksporter, Del. Alle
moduser har samme skjelett: modusvelgeren øverst, objektpanelet til venstre, arbeidsflaten i midten, inspektøren til
høyre og statuslinjen nederst, med loggen foldet inn over den. Panelene bytter aldri plass. Alt+1 til Alt+8 bytter
modus. Et tomt arbeidsområde åpnes i Hent, et arbeidsområde med datasett i Håndter. Knappene øverst til høyre åpner
kommandopaletten, bytter språk, bytter tema (lyst, mørkt, følg systemet) og åpner hjelpen.

**Statuslinjen** viser lagringsstatus, hvor mye lagring arbeidsområdet bruker, det valgte datasettet (navn, rader og
kolonner; et klikk åpner det i Håndter), R-motorens tilstand (av, starter, klar, opptatt; et klikk starter den),
pågående internettkall (et klikk viser loggen over kall), knappene som folder objektpanelet, inspektøren og loggen
inn og ut, samt antall linjer i loggen.

**Panelenes bredde** endres ved å dra i kanten mellom panel og arbeidsflate; dobbeltklikk nullstiller, og med
tastaturet flytter piltastene kanten (Skift for større steg, Home og End for minste og største bredde). Breddene
lagres. I smalere vinduer (under 1 100 px) viser modusvelgeren bare ikoner, med tekst på den aktive modusen, og
inspektøren åpnes som et ark over arbeidsflaten; under 760 px gjør objektpanelet det samme. Et ark lukkes med Esc
eller et klikk på arbeidsflaten.

**Tips** vises for alle knapper når musepekeren hviler på dem eller når de får fokus med tastaturet; på
berøringsskjerm ved å holde fingeren på knappen.

Kommandopaletten (Ctrl+K eller forstørrelsesglasset øverst) når alt fra ett søkefelt: bytt modus, åpne et datasett,
et diagram eller et dashbord, kjør en bearbeidingshandling på det valgte datasettet, eksporter, åpne arbeidsområdet,
søk i data, lag en pakke, bytt tema eller se etter oppdateringer. Pil opp og ned velger, Enter kjører og Esc lukker;
de sist kjørte kommandoene ligger øverst.

## Hent

Her kommer data inn: filer som slippes på flaten, innlimt tekst, nettadresser og åpne API-er. Filimporten går i
trinn: fil, innstillinger med forhåndsvisning, kolonner med typer, ferdig. Formater: CSV og annen avgrenset tekst,
tekst med faste kolonnebredder, Excel, ODS, JSON (også JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile samt
via R: SPSS, Stata, SAS, PX, Parquet, RDS og RData (se [format.md](format.md)); R-formatene importeres i ett trinn
uten forhåndsvisning. Under Åpne API-er finnes forhåndsinnstillinger for SSB, Folkehelseinstituttet, Kartverket og de
øvrige nordiske landenes statistikkbyråer og etater, SCB (bla i emnetreet eller søk etter en tabell), Eurostat,
Nordic Statistics med flere, samt kilder som krever nøkler; landknappene over listen velger hvilke lands kilder som
vises. Egne konfigurasjoner legges til fra fil og kan deles. *Lagrede hentinger* viser datasettene som har kommet fra
et API, og oppdaterer dem med ett klikk, ett om gangen eller alle. Første gang appen skal kontakte internett for et
formål (API-er, nettadresser, GitHub, komponenter) spør den om lov; svaret kan lagres. Se
[api-konfiguration.md](api-konfiguration.md).

## Håndter

Datasettenes hjem. Objektpanelet er et tre: datasett kan ligge i mapper med undermapper (`Økonomi/2026`) og ha
tagger; et filterfelt søker på navn, kortnavn, tagg og mappe, og listen kan sorteres etter endret, navn eller rader.
Mapper foldes sammen og ut, og datasett kan dras til en mappe. Avkrysningsboksene velger flere datasett (Skift velger
et spenn), og knappen *Handlinger (n)* åpner batchhandlingene: ordne (mappe og tagger), pakke, eksportere som ZIP med
CSV-filer, hente igjen fra API, kjøre en oppskrift og slette. Mappe og tagger følger datasettet i filen dens, i pakker
og i sikkerhetskopier.

Oversikten for et datasett viser metadata, kolonneliste, kommentarer, historikk over det som er gjort med datasettet,
og versjoner, og her gir du nytt navn og kortnavn (kortnavnet brukes i SQL, R og diagramfiler), ordner, sletter og
henter igjen fra API. Under *Arbeidsområde* finnes hvor mye lagring som brukes, vedvarende lagring,
sikkerhetskopiering til ZIP og gjenoppretting, i Edge og Chrome en portabel mappe (arbeidsområdet lagres som vanlige
filer i en mappe du velger, automatisk etter hver endring om du vil, og kan lastes inn på en annen datamaskin),
*Internettilgang* (hvilke formål som får kontakte internett, med logg over kall) og *Komponenter* (deler av appen og
R-pakker som hentes når de trengs, med størrelse, kilde og knapper for å hente på forhånd eller fjerne). Pakker og
GitHub har flyttet til modusen Del.

## Søk

Finn og list uten kode. Fanen *Søk* søker i alle kolonner i ett eller alle datasett; hvert ord må finnes på raden,
uavhengig av store og små bokstaver. Treffene vises per datasett med antall, fasetter (de vanligste verdiene i
kolonner med få ulike verdier, som avgrenser søket med ett klikk) og en tabell der en rad åpner hele posten i
inspektøren. Et søk kan lagres som liste, bli et nytt datasett eller åpnes i Bearbeid. Fanen *Lister* samler lagrede
søk per datasett og kjører dem igjen på dagens data. Se [soka.md](soka.md).

## Bearbeid

Alt man gjør med tabellen via knapper og dialoger: rediger celler direkte i tabellen, sorter, filtrer og se
kolonnestatistikk; handlinger for rensing (søk og erstatt med regulære uttrykk, trim, store og små bokstaver,
reparasjon av tegnkoding, erstatt verdi, fyll manglende, duplikater, kategorirensing), typer (tall, dato, ja/nei),
struktur (beregnede kolonner, del og kombiner, slett rader, pivoter) og nye datasett (grupper og aggreger, koble,
legg sammen). Datakvalitetsprofilen peker på hva som bør rettes, og kvalitetsregler (må ikke mangle, unik, intervall,
liste, mønster, lengde, SQL-betingelse) kontrollerer dataene på forespørsel med rapport og feilende rader som eget
datasett. Alt logges som en oppskrift som kan angres, spilles av på et annet datasett og eksporteres som R- eller
SQL-kode. Versjoner lagrer øyeblikksbilder å gå tilbake til. Se [bearbeta.md](bearbeta.md).

## Analyser

Kode og statistikk. Verktøyene ligger i fast rekkefølge: R, SQL, Regex og sist notatboken, som føyer sammen deler
fra de andre; Python legges til etter R i en kommende versjon. R-konsollen har ggplot2, dplyr, tidyr og andre pakker,
lagrede skript, diagrammer med eksport til SVG, PNG og PDF, og `dm_read()`/`dm_write()` for å flytte data mellom
appen og R (se [r-guide.md](r-guide.md)); pakker som ikke følger med appen, hentes fra webR sitt pakkearkiv når koden
trenger dem, etter at du har gitt lov. SQL-konsollen arbeider mot det valgte datasettet (`data`), der andre datasett
nås med kortnavnene sine slik at en spørring kan gjøre join over flere datasett; spørringer viser resultater som kan
lagres som nytt datasett, endrende setninger logges som oppskriftstrinn (se [bearbeta.md](bearbeta.md)). Fanen Regex
prøver regulære uttrykk på en kolonne med treffene markert og bruker dem til å filtrere, hente ut, erstatte, dele
opp, markere, telle eller lage en kvalitetsregel, med en mønsterprofil og et bibliotek med nordiske mønstre (se
[regex.md](regex.md)). Notatboken blander tekst (Markdown), R og SQL i celler som kjøres i rekkefølge og blir en
rapport i HTML, Word, PDF, Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)). Senere: statistiske
modeller.

## Visualiser

Diagrammer med tre motorer og ett utseende: diagrambyggeren (Vega-Lite) med stolper, linjer, flater, punkter,
histogrammer, varmekart, boksplott, sektorer og kart (koroplettkart fra GeoJSON- eller shapefile-data); D3-maler for
rangering, helningsdiagram og befolkningspyramide; og R-skript med ggplot2. Lagrede diagrammer kan eksporteres som
SVG, PNG, PDF og PowerPoint, deles som viz-filer, vises i et galleri og lages i batch per gruppe. Dashbord samler
lagrede diagrammer i et rutenett med felles filtre og eksporteres som HTML eller PowerPoint. Se
[visualisera.md](visualisera.md).

## Eksporter

Filer til din egen datamaskin, i tre faner. **Data**: CSV (Excel-tilpasset eller standard), Excel, ODS, JSON, XML,
SQLite samt via R: Parquet, SPSS, Stata og RDS. **Diagrammer**: lagrede diagrammer og dashbord (også alle diagrammer
som én PowerPoint) som SVG, PNG og PDF, enkeltvis eller i batch per gruppe til ZIP. **Dokumenter**: rapporter,
kodebøker og sammenstillinger fra maler i Markdown med plassholdere, som HTML, Word, PDF, Markdown eller LaTeX,
enkeltvis eller i batch per gruppe (se [dokumentmallar.md](dokumentmallar.md)). Det som skal til andre mennesker,
finnes i Del.

## Del

Gi data til andre. **Pakke**: en ZIP med valgte datasett, diagrammer, dashbord, maler, notatbøker og skript, en
melding og en endringslogg, som mottakeren åpner under *Motta* og kan erstatte sine versjoner med. **GitHub**:
arbeidsområdet som en mappe i et repository, send og hent, med et tilgangstoken som lagres kryptert.
**Delingsmeny**: datamaskinens eller telefonens egen delingsmeny for en fil eller en pakke (e-post, Teams,
meldingsapper). **Publiser**: dashbord og dokumenter som frittstående HTML-filer. **Motta**: pakker fra fil eller
nettadresse, med avsender og endringer synlige før noe tas inn. Direkte overføring mellom enheter kommer i en senere
versjon. Se [dela.md](dela.md).
