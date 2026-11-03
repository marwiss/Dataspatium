# De seks modusene

Dataspatium er delt inn i seks moduser som følger arbeidet, i samme ånd som statistikkproduksjonens samle inn, bearbeide,
analysere og formidle: Hent, Håndter, Bearbeid, Analyser, Visualiser, Eksporter. Alle moduser har samme skjelett:
modusvelgeren øverst, objektpanelet til venstre, arbeidsflaten i midten, egenskapspanelet til høyre og loggen nederst.
Panelene bytter aldri plass. Alt+1 til Alt+6 bytter modus. Et tomt arbeidsområde åpnes i Hent, et arbeidsområde med
datasett i Håndter. Knappene øverst til høyre feller inn panelene, bytter tema (lyst, mørkt, følg systemet), bytter språk og
åpner hjelpen.

Kommandopaletten (Ctrl+K eller forstørrelsesglasset øverst) når alt fra ett søkefelt: bytt modus, åpne et datasett, et
diagram eller et dashbord, kjør en handling på det valgte datasettet, eksporter, åpne arbeidsområdet, bytt tema eller se
etter oppdateringer. Pil opp og ned velger, Enter kjører og Esc lukker; de sist kjørte kommandoene ligger øverst.

## Hent

Her kommer data inn: filer som slippes på flaten, innlimt tekst, nettadresser og åpne API-er. Filimporten går i trinn:
fil, innstillinger med forhåndsvisning, kolonner med typer, ferdig. Formater: CSV og annen avgrenset tekst, tekst med fast
bredde, Excel, ODS, JSON (også JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile samt via R: SPSS, Stata, SAS, PX,
Parquet, RDS og RData (se [format.md](format.md)); R-formatene importeres i ett trinn uten forhåndsvisning. Under Åpne API-er
finnes forhåndsinnstillinger for statistikkbyråene og flere andre etater i Norge, Danmark, Finland, Island, Grønland,
Færøyene, Åland og Sverige, Nordic Statistics og Eurostat; landknappene over listen velger hvilke lands kilder som vises.
Egne konfigurasjoner legges til fra fil og kan deles. Se [api-konfiguration.md](api-konfiguration.md).

## Håndter

Datasettenes hjem. Oversikt med metadata, kolonneliste, historikk over det som er gjort med datasettet, versjoner, nytt navn
og kortnavn (kortnavnet brukes i SQL, R og diagramfiler), slett, hent igjen fra API (ett datasett eller alle på en gang). Her
finnes også arbeidsområdet: hvor mye lagring som brukes, vedvarende lagring, sikkerhetskopi til ZIP og gjenoppretting samt,
i Edge og Chrome, en portabel mappe: arbeidsområdet lagres som vanlige filer i en mappe du velger, automatisk etter hver
endring om du vil, og kan lastes inn på en annen datamaskin. *Del pakke* lager en ZIP med valgte datasett, diagrammer,
dashbord, maler og notatbøker til en kollega, som laster den inn under *Gjenopprett fra ZIP*.

## Bearbeid

Alt man gjør med tabellen via knapper og dialoger: redigere celler direkte i tabellen, sortere, filtrere og se
kolonnestatistikk; handlinger for rensing (søk og erstatt med regulære uttrykk, fjern mellomrom, store og små bokstaver,
reparasjon av tegnkoding, erstatt verdi, fyll inn manglende, duplikater, rensing av kategorier), typer (tall, datoer,
ja/nei), struktur (beregnede kolonner, del opp og kombiner, slett rader, pivoter) og nye datasett (grupper og aggreger, koble,
slå sammen). Datakvalitetsprofilen peker på det som bør rettes, og kvalitetsregler (må ikke mangle, unik, intervall, liste,
mønster, lengde, SQL-betingelse) kontrollerer dataene ved behov med rapport og feilende rader som eget datasett. Alt logges
som oppskrifter som kan angres, spilles av på et annet datasett og eksporteres som R- eller SQL-kode. Versjoner lagrer
øyeblikksbilder å gå tilbake til. Se [bearbeta.md](bearbeta.md).

## Analyser

Kode og statistikk. R-konsoll med ggplot2, dplyr, tidyr og andre pakker, lagrede skript, diagrammer med eksport til SVG, PNG
og PDF og `dm_read()`/`dm_write()` for å flytte data mellom appen og R (se [r-guide.md](r-guide.md)). SQL-konsoll mot det
valgte datasettet (`data`), der andre datasett nås med kortnavnene sine, slik at én spørring kan gjøre join over flere
datasett; spørringer viser resultater som kan lagres som nytt datasett, og endrende setninger logges som trinn i oppskriften
(se [bearbeta.md](bearbeta.md)). Notatboken blander tekst (Markdown), R og SQL i celler som kjøres i rekkefølge og blir en
rapport i HTML, Word, PDF, Markdown eller LaTeX (se [anteckningsbok.md](anteckningsbok.md)). Fanen Regex prøver regulære uttrykk på en kolonne med treffene markert og bruker dem til å filtrere, hente ut,
erstatte, dele opp, markere, telle eller lage en kvalitetsregel, med en mønsterprofil og et bibliotek med
nordiske mønstre (se [regex.md](regex.md)). Senere: statistiske modeller.

## Visualiser

Diagrammer med tre motorer og ett utseende: diagrambyggeren (Vega-Lite) med stolper, linjer, arealer, punkter,
histogrammer, varmekart, boksplott, sektordiagrammer og kart (koroplettkart fra GeoJSON- eller shapefile-data); D3-maler for
rangering, helningsdiagrammer og befolkningspyramider; og R-skript med ggplot2. Lagrede diagrammer kan eksporteres som SVG,
PNG, PDF og PowerPoint, deles som viz-filer, vises i et galleri og lages i batch per gruppe. Dashbord samler lagrede
diagrammer i et rutenett med felles filtre og eksporteres som HTML eller PowerPoint. Se [visualisera.md](visualisera.md).

## Eksporter

Tre faner. **Data**: CSV (tilpasset Excel eller standard), Excel, ODS, JSON, XML, SQLite samt via R: Parquet, SPSS, Stata og
RDS. **Diagrammer**: lagrede diagrammer og dashbord (også alle diagrammer som én PowerPoint) som SVG, PNG og PDF, enkeltvis
eller i batch per gruppe til ZIP. **Dokumenter**: rapporter, kodebøker og sammendrag fra maler i Markdown med plassholdere,
som HTML, Word, PDF, Markdown eller LaTeX, enkeltvis eller i batch per gruppe (se [dokumentmallar.md](dokumentmallar.md)).
