# Dokument og bilete

Dataspatium les inn dokument som **dokumentsamlingar** og bilete som **biletsamlingar**. Ei dokumentsamling blir opna
som ei lesevising og ei biletsamling som eit galleri. Under overflata er begge datasett av eigne slag, med eitt avsnitt
og eitt bilete per rad og filene sjølve i datasettet, slik at alt som gjeld for tabellar òg gjeld her:
filter, Søk, reglar, oppskrifter, SQL, R og Python, eksport, pakkar og deling. I tillegg kjem verktøya **Tekst**
og **Bilete** i Analyser, som fungerer utan kode.

## Dokumentsamlingar

| Format | Blir kjent att på | Avsnitt | Overskrifter | Sider |
|---|---|---|---|---|
| PDF | .pdf | Tekstlinjer blir samla til avsnitt etter linjeavstand | Linjer med klart større skriftstorleik enn teksten på sida | Ekte sider |
| Word | .docx | Avsnitt og tabellrader | Avsnittsstilar med namn som Heading, Rubrik, Title | Sideskift og dei lagra sideskifta i Word |
| OpenDocument | .odt | Avsnitt, lister og tabellrader | `text:h`-element | Mjuke sideskift |
| Markdown | .md, .markdown | Blokker skilde av ei tom linje; punktlister på éi linje | Linjer som byrjar med `#` | Alt er side 1 |
| Tekst | .txt (vel formatet *Dokument*) | Blokker skilde av ei tom linje | Ingen | Alt er side 1 |

Kvar dokumentsamling har kolonnane `dokument` (filnamn), `sida` (side), `stycke` (løpenummer i
dokumentet), `typ` (`rubrik`, `stycke` eller `tabell`), `text` og `tecken` (teikn). Rader frå tabellar får cellene
skilde med ` | `. Originalfilene blir lagra i datasettet, slik at PDF-sider kan visast og filene hentast igjen; dei blir rekna
med i storleiken på datasettet under Handter.

PDF-filer blir lesne med pdf.js i ein bakgrunnstråd, så appen svarar medan ein lang rapport blir lesen inn; 200 sider tek om lag
eitt sekund. Skanna PDF-filer utan tekstlag gjev ingen avsnitt før du les dei, sjå *Lese tekst i bilete* nedanfor.

### Importere

Slepp éi eller fleire filer i Hent. Fleire dokument på éin gong blir **eitt** datasett med alle avsnitt, og
innstillingssteget viser fillista, namnet og ein framdriftsindikator fil for fil (side for side i PDF). Eitt enkelt
Word- eller Markdown-dokument blir òg lese som dokument; vil du heller ha tabellane i det, vel du formatet *Tabellar
i dokument*. Ei tekstfil blir lesen som CSV til du vel *Dokument*. Kolonnesteget blir hoppa over fordi kolonnane er
gjevne. Dokument kan òg hentast frå ei nettadresse (Hent > Nettadresse) på same måte.

## Dokumentvisinga i Bearbeid

Ei dokumentsamling blir opna i Bearbeid som lesevising, og frå Handter med knappen *Les*; oversynsfana der listar
dokumenta, og eit klikk på eitt av dei opnar nettopp det. Vel dokument og vising: *Side for side*, *Heile
dokumentet* (løpande tekst med sidemerke, teikna i omgangar slik at sjølv ein lang rapport blir opna straks) eller,
for PDF, *Sida som bilete*. Overskrifter blir viste som overskrifter og tabellrader med fast breidd. Klikk på eit avsnitt,
så viser inspektøren side, nummer, type og tal på teikn med ein knapp for å kopiere teksten; øvst i inspektøren står
tittelen, forfattaren, sidene, avsnitta og orda til dokumentet med knappen *Hent originalen*.

Søkjefeltet søkjer i heile samlinga og listar treffa med samanheng (nøkkelord i kontekst); klikk på eit treff for å
hoppe til sida. *Vis som tabell* gjev den vanlege tabellen med alle handlingar i Bearbeid, og *Vis som dokument* tek
deg tilbake. Datasettet i seg sjølv er alltid tabellen: det du gjer i tabellen (filtrere, rette, slette rader) blir
òg vist i lesevisinga.

## Verktøyet Tekst i Analyser

Når ei dokumentsamling er vald, får Analyser fana **Tekst** (etter Regex, før Notatboka) med fire verktøy. Alle
resultat kan lagrast som eit nytt datasett med knappen *Opprett datasett*, og eitt dokument kan veljast i staden for
heile samlinga.

| Verktøy | Kva det gjer | Innstillingar |
|---|---|---|
| Oversyn | Sider, avsnitt, overskrifter, tabellrader, ord, teikn, ulike ord og ordvariasjon (type/token-forhold) per dokument | |
| Ordfrekvens | Dei vanlegaste orda med tal, andel og tal på dokument | Språk for stoppord (svensk, dansk, norsk, finsk, islandsk, engelsk), eigne stoppord, minste ordlengd, tel tal, tal å vise |
| Nøkkelord i kontekst | Alle førekomstar av eit ord eller uttrykk med teksten før og etter, dokument og side | Heile ord, skil mellom store og små bokstavar, regulært uttrykk |
| Samførekomstar | Ordpar som førekjem saman i same avsnitt eller innanfor nokre få ords avstand | Vindauge, stoppord, minste ordlengd |

Ord er følgjer av bokstavar og tal med bindestrekar og apostrofar inni (`e-post`, `don't`) og blir telde med små
bokstavar. Stoppordlistene er korte lister med funksjonsord; slå av brytaren for å telje alle ord. Dei same tekstane
kan analyserast vidare i R og Python: `dm_read("namn")` gjev avsnittstabellen som data.frame og DataFrame.

## Biletsamlingar

Bilete (JPEG, PNG, WebP, GIF, BMP og AVIF der nettlesaren kan lese dei) blir ei biletsamling med éi rad
per bilete: `fil`, `typ`, `storlek` (byte), `bredd`, `hojd`, `datum`, `kamera`, `lon`, `lat`, `altitud` og
`beskrivning`. Dato, kamera, posisjon og skildring blir lesne frå EXIF i JPEG-filer; andre format får berre mål og
storleik. Ei førehandsvising (langside høgst 1600 px) og ein miniatyr (320 px) blir lagra i datasettet; originalane
blir ikkje lagra, slik at ei samling med hundrevis av bilete blir handterleg i nettlesaren. Slepp alle bileta på éin
gong i Hent, så blir dei éi samling.

Posisjonane kan teiknast på kartdiagrammet i Visualiser (lon og lat som koordinatar), og datoane fungerer som alle
andre datoar i filter, Spørjing og diagram.

## Galleriet i Bearbeid

Ei biletsamling blir opna i Bearbeid som galleri med miniatyrar, filter og sortering (filnamn, dato, storleik), og frå
Handter med knappen *Vis bilete*; oversynsfana der viser dei første miniatyrane, og eit klikk på ein av dei opnar han i
galleriet. Klikk på eit bilete, så viser inspektøren ei større førehandsvising, type, storleik, mål, dato, kamera,
posisjon og høgd og dessutan skildringa, som kan endrast og lagrast: endringa blir logga som oppskriftssteg som alle andre
celleendringar og kan angrast. Dobbeltklikk for å sjå biletet stort, eller hent førehandsvisinga til datamaskina. *Vis
som tabell* gjev tabellen med alle handlingar.

## Verktøyet Bilete i Analyser

Når ei biletsamling er vald, får Analyser fana **Bilete** med to verktøy:

- **Oversyn**: tal, storleik, biletpunkt, kor mange bilete som har dato, kamera og posisjon, periode, og ei
  fordeling på type, kamera, år eller månad som kan lagrast som datasett.
- **Duplikat**: kvar miniatyr blir gjord om til eit gråtonebilete på 8 × 8 ruter; ruter lysare enn gjennomsnittet blir
  einarar og gjev ein hash på 64 bit. Bilete der hashane skil seg i høgst det valde talet på bit, blir grupperte:
  0 bit gjev berre nøyaktige kopiar, 5 bit vanlege duplikat (annan storleik, anna komprimering), 12 bit òg
  beskorne eller fargejusterte variantar med fleire falske treff. Gruppene blir viste med miniatyrar og kan lagrast som eit
  datasett med fil, gruppe, avstand og hash.

## Lese tekst i bilete

Ein skanna PDF har ingen tekst og gjev difor ingen avsnitt. Dokumentvisinga seier kor mange sider det gjeld, og knappen
*Les tekst i bileta* les dei med tekstgjenkjenning. Vel språket i bileta; engelsk blir alltid lese med, fordi namn og fagord
ofte er på engelsk. Teksten blir vanlege avsnitt i tabellen til dokumentet, så han kan søkjast i, teljast og eksporterast, og
handlinga kan angrast. Avbryt du, blir sidene som allereie er lesne, haldne.

Maskinlesen tekst kan innehalde feil. Difor står det *Maskinlesen tekst* og vissa i lesinga på sida, med ein knapp som
viser sida som bilete.

I galleriet lagar *Les tekst i bileta* ei ny dokumentsamling av bileta som blir viste, eitt dokument per bilete. Biletsamlinga
blir ikkje endra. *Les tekst i biletet* i inspektøren legg teksten i skildringa av biletet, der du kan rette han før du lagrar.

Eit bilete av ein tabell kan òg importerast. Vel *Lim inn* i Hent og deretter *Les tabell frå bilete*, eller lim inn biletet
direkte i feltet. Teksten hamnar i feltet med semikolon mellom kolonnane. Rett han der, så går han deretter gjennom den vanlege
importen.

Lesinga skjer heilt i nettlesaren, og ingenting blir sendt nokon stad. Lesemotoren Tesseract og språkdata følgjer ikkje med appen: dei
blir henta første gongen, etter samtykket ditt, frå faste adresser og kontrollerte mot kontrollsummar. Deretter ligg dei i nettlesaren
og blir viste under Komponentar i Handter.

## Bilete i dokumentmalar

I dokumentmalar (Eksporter > Dokument) set taggen `{{bild "fil.jpg" | bredd: 400}}` inn eit bilete frå ei
biletsamling. Biletet blir søkt først i datasettet til malen og deretter i alle biletsamlingar; førehandsvisinga blir brukt og
skalert til oppgjeven breidd (`bredd`, standard høgst 720 px; `hojd` kan òg oppgjevast). Taggen verkar i Word, PDF, HTML,
Markdown og LaTeX på same måte som `{{diagram}}`, òg i batchkøyringar.

## Dele og eksportere

Dokument- og biletsamlingar er vanlege datasett: dei inngår i pakkar, kan leggjast på GitHub og sendast til ei anna eining
med filene intakte. Gjennomgangen før deling gjeld tabellen (teksten i `text`, skildringar) som for andre
datasett. Eksport til CSV, Excel og dei andre tabellformata gjev avsnitts- og bilettabellen utan filene;
SQLite-fila til Dataspatium og pakkane tek filene med.

## Avgrensingar

- Maskinlesen tekst kan innehalde feil, særleg i tabellar, handskrift og dårlege skanningar.
- Sidetala i Word og OpenDocument følgjer sideskifta i fila og kan avvike frå det eit tekstbehandlingsprogram
  viser.
- EXIF blir berre lese frå JPEG. HEIC-bilete frå telefonar må konverterast først, sidan nettlesaren ikkje kan dekode dei.
- Svært store samlingar (tusenvis av bilete eller titusenvis av sider) tek tid å lese inn og plass i lagringa til
  nettlesaren; del dei opp i fleire datasett.
