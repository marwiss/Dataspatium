# Dokumenter og bilder

Dataspatium leser inn dokumenter og bilder som datasett av egne slag. Et dokument blir en tabell med ett avsnitt per
rad, en bildesamling en tabell med ett bilde per rad, og filene selv følger med datasettet. Alt som gjelder for
tabeller gjelder også her: filtre, Søk, regler, oppskrifter, SQL, R og Python, eksport, pakker og deling. I tillegg
kommer en dokumentvisning og et galleri i Bearbeid samt verktøyene **Tekst** og **Bilder** i Analyser, som fungerer
uten kode.

## Dokumenter som datasett

| Format | Gjenkjennes på | Avsnitt | Overskrifter | Sider |
|---|---|---|---|---|
| PDF | .pdf | Tekstlinjer samles til avsnitt etter linjeavstand | Linjer med klart større skriftstørrelse enn sidens tekst | Ekte sider |
| Word | .docx | Avsnitt og tabellrader | Avsnittsstiler med navn som Heading, Rubrik, Title | Sideskift og Words lagrede sideskift |
| OpenDocument | .odt | Avsnitt, lister og tabellrader | `text:h`-elementer | Myke sideskift |
| Markdown | .md, .markdown | Blokker atskilt av en tom linje; punktlister på én linje | Linjer som begynner med `#` | Alt er side 1 |
| Tekst | .txt (velg formatet *Dokumenter*) | Blokker atskilt av en tom linje | Ingen | Alt er side 1 |

Hvert datasett av slaget dokumenter har kolonnene `dokument` (filnavn), `sida` (side), `stycke` (løpenummer i
dokumentet), `typ` (`rubrik`, `stycke` eller `tabell`), `text` og `tecken` (tegn). Rader fra tabeller får cellene
atskilt med ` | `. Originalfilene lagres i datasettet, slik at PDF-sider kan vises og filene hentes igjen; de regnes
med i datasettets størrelse under Håndter.

PDF-filer leses med pdf.js i en bakgrunnstråd, så appen svarer mens en lang rapport leses inn; 200 sider tar omtrent
ett sekund. Skannede PDF-filer uten tekstlag gir ingen avsnitt (tekstgjenkjenning kommer i en senere versjon).

### Importere

Slipp én eller flere filer i Hent. Flere dokumenter på én gang blir **ett** datasett med alle avsnitt, og
innstillingssteget viser fillisten, navnet og en fremdriftsindikator fil for fil (side for side i PDF). Ett enkelt
Word- eller Markdown-dokument leses også som dokument; vil du heller ha tabellene i det, velger du formatet *Tabeller
i dokumenter*. En tekstfil leses som CSV til du velger *Dokumenter*. Kolonnesteget hoppes over fordi kolonnene er
gitt. Dokumenter kan også hentes fra en nettadresse (Hent > Nettadresse) på samme måte.

## Dokumentvisningen i Bearbeid

Et datasett av slaget dokumenter åpnes i Bearbeid som lesevisning: velg dokument, bla side for side, og bytt for PDF
mellom teksten og siden som bilde. Overskrifter vises som overskrifter og tabellrader med fast bredde. Klikk på et
avsnitt, så viser inspektøren side, nummer, type og antall tegn med en knapp for å kopiere teksten; øverst i
inspektøren står dokumentets tittel, forfatter, sider, avsnitt og ord med knappen *Hent originalen*.

Søkefeltet søker i hele samlingen og lister treffene med sammenheng (nøkkelord i kontekst); klikk på et treff for å
hoppe til siden. *Vis som tabell* gir den vanlige tabellen med alle handlinger i Bearbeid, og *Vis som dokument* tar
deg tilbake. Datasettet i seg selv er alltid tabellen: det du gjør i tabellen (filtrere, rette, slette rader) vises
også i lesevisningen.

## Verktøyet Tekst i Analyser

Når en dokumentsamling er valgt, får Analyser fanen **Tekst** (etter Regex, før Notatboken) med fire verktøy. Alle
resultater kan lagres som et nytt datasett med knappen *Opprett datasett*, og ett dokument kan velges i stedet for
hele samlingen.

| Verktøy | Hva det gjør | Innstillinger |
|---|---|---|
| Oversikt | Sider, avsnitt, overskrifter, tabellrader, ord, tegn, ulike ord og ordvariasjon (type/token-forhold) per dokument | |
| Ordfrekvens | De vanligste ordene med antall, andel og antall dokumenter | Språk for stoppord (svensk, dansk, norsk, finsk, islandsk, engelsk), egne stoppord, minste ordlengde, tell tall, antall å vise |
| Nøkkelord i kontekst | Alle forekomster av et ord eller uttrykk med teksten før og etter, dokument og side | Hele ord, skill mellom store og små bokstaver, regulært uttrykk |
| Samforekomster | Ordpar som forekommer sammen i samme avsnitt eller innenfor noen få ords avstand | Vindu, stoppord, minste ordlengde |

Ord er følger av bokstaver og tall med bindestreker og apostrofer inni (`e-post`, `don't`) og telles med små
bokstaver. Stoppordlistene er korte lister med funksjonsord; slå av bryteren for å telle alle ord. De samme tekstene
kan analyseres videre i R og Python: `dm_read("navn")` gir avsnittstabellen som data.frame respektive DataFrame.

## Bilder som datasett

Bilder (JPEG, PNG, WebP, GIF, BMP og AVIF der nettleseren kan lese dem) blir et datasett av slaget bilder med én rad
per bilde: `fil`, `typ`, `storlek` (byte), `bredd`, `hojd`, `datum`, `kamera`, `lon`, `lat`, `altitud` og
`beskrivning`. Dato, kamera, posisjon og beskrivelse leses fra EXIF i JPEG-filer; andre formater får bare mål og
størrelse. En forhåndsvisning (langside høyst 1600 px) og en miniatyr (320 px) lagres i datasettet; originalene
lagres ikke, slik at en samling med hundrevis av bilder forblir håndterlig i nettleseren. Slipp alle bildene på én
gang i Hent, så blir de én samling.

Posisjonene kan tegnes på kartdiagrammet i Visualiser (lon og lat som koordinater), og datoene fungerer som alle
andre datoer i filtre, Spørring og diagrammer.

## Galleriet i Bearbeid

En bildesamling åpnes i Bearbeid som galleri med miniatyrer, filter og sortering (filnavn, dato, størrelse). Klikk på
et bilde, så viser inspektøren en større forhåndsvisning, type, størrelse, mål, dato, kamera, posisjon og høyde samt
beskrivelsen, som kan endres og lagres: endringen logges som oppskriftssteg som alle andre celleendringer og kan
angres. Dobbeltklikk for å se bildet stort, eller hent forhåndsvisningen til datamaskinen. *Vis som tabell* gir
tabellen med alle handlinger.

## Verktøyet Bilder i Analyser

Når en bildesamling er valgt, får Analyser fanen **Bilder** med to verktøy:

- **Oversikt**: antall, størrelse, bildepunkter, hvor mange bilder som har dato, kamera og posisjon, periode, og en
  fordeling på type, kamera, år eller måned som kan lagres som datasett.
- **Duplikater**: hver miniatyr gjøres om til et gråtonebilde på 8 × 8 ruter; ruter lysere enn gjennomsnittet blir
  enere og gir en hash på 64 biter. Bilder hvis hasher skiller seg i høyst det valgte antallet biter, grupperes:
  0 biter gir bare nøyaktige kopier, 5 biter vanlige duplikater (annen størrelse, annen komprimering), 12 biter også
  beskårne eller fargejusterte varianter med flere falske treff. Gruppene vises med miniatyrer og kan lagres som et
  datasett med fil, gruppe, avstand og hash.

## Bilder i dokumentmaler

I dokumentmaler (Eksporter > Dokumenter) setter taggen `{{bild "fil.jpg" | bredd: 400}}` inn et bilde fra en
bildesamling. Bildet søkes først i malens datasett og deretter i alle bildesamlinger; forhåndsvisningen brukes og
skaleres til angitt bredde (`bredd`, standard høyst 720 px; `hojd` kan også angis). Taggen virker i Word, PDF, HTML,
Markdown og LaTeX på samme måte som `{{diagram}}`, også i batchkjøringer.

## Dele og eksportere

Dokument- og bildesamlinger er vanlige datasett: de inngår i pakker, kan legges på GitHub og sendes til en annen enhet
med filene intakte. Gjennomgangen før deling gjelder tabellen (teksten i `text`, beskrivelser) som for andre
datasett. Eksport til CSV, Excel og de andre tabellformatene gir avsnitts- respektive bildetabellen uten filene;
Dataspatiums SQLite-fil og pakkene tar filene med.

## Begrensninger

- Skannede PDF-filer uten tekstlag gir ingen avsnitt.
- Sidetallene i Word og OpenDocument følger sideskiftene i filen og kan avvike fra det et tekstbehandlingsprogram
  viser.
- EXIF leses bare fra JPEG. HEIC-bilder fra telefoner må konverteres først, siden nettleseren ikke kan dekode dem.
- Svært store samlinger (tusenvis av bilder eller titusenvis av sider) tar tid å lese inn og plass i nettleserens
  lagring; del dem opp i flere datasett.
