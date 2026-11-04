# Dokumenter og billeder

Dataspatium læser dokumenter ind som **dokumentsamlinger** og billeder som **billedsamlinger**. En dokumentsamling
åbnes som en læsevisning og en billedsamling som et galleri. Under overfladen er begge datasæt af deres egen slags,
med ét afsnit henholdsvis ét billede pr. række og filerne selv i datasættet, så alt, der gælder for tabeller, også
gælder her: filtre, Søg, regler, recepter, SQL, R og Python, eksport, pakker og deling. Dertil kommer værktøjerne
**Tekst** og **Billeder** i Analysér, som fungerer uden kode.

## Dokumentsamlinger

| Format | Genkendes på | Afsnit | Overskrifter | Sider |
|---|---|---|---|---|
| PDF | .pdf | Tekstlinjer samles til afsnit efter linjeafstand | Linjer med klart større skriftstørrelse end sidens tekst | Rigtige sider |
| Word | .docx | Afsnit og tabelrækker | Afsnitsformater med navne som Heading, Rubrik, Title | Sideskift og Words gemte sideskift |
| OpenDocument | .odt | Afsnit, lister og tabelrækker | `text:h`-elementer | Bløde sideskift |
| Markdown | .md, .markdown | Blokke adskilt af en tom linje; punktlister på én linje | Linjer, der begynder med `#` | Alt er side 1 |
| Tekst | .txt (vælg formatet *Dokumenter*) | Blokke adskilt af en tom linje | Ingen | Alt er side 1 |

Hver dokumentsamling har kolonnerne `dokument` (filnavn), `sida` (side), `stycke` (løbenummer i
dokumentet), `typ` (`rubrik`, `stycke` eller `tabell`), `text` og `tecken` (tegn). Rækker fra tabeller får cellerne
adskilt med ` | `. Originalfilerne gemmes i datasættet, så PDF-sider kan vises og filerne hentes igen; de tælles med
i datasættets størrelse under Håndter.

PDF-filer læses med pdf.js i en baggrundstråd, så appen svarer, mens en lang rapport læses ind; 200 sider tager cirka
et sekund. Skannede PDF-filer uden tekstlag giver ingen afsnit (tekstgenkendelse kommer i en senere version).

### Importere

Slip en eller flere filer i Hent. Flere dokumenter på én gang bliver **ét** datasæt med alle afsnit, og
indstillingstrinnet viser fillisten, navnet og en fremdriftsindikator fil for fil (side for side i PDF). Et enkelt
Word- eller Markdown-dokument læses også som dokument; vil du i stedet have tabellerne i det, vælger du formatet
*Tabeller i dokumenter*. En tekstfil læses som CSV, indtil du vælger *Dokumenter*. Kolonnetrinnet springes over,
fordi kolonnerne er givne. Dokumenter kan også hentes fra en webadresse (Hent > Webadresse) på samme måde.

## Dokumentvisningen i Bearbejd

En dokumentsamling åbnes i Bearbejd som læsevisning, og fra Håndter med knappen *Læs*; oversigtsfanen dér lister
dokumenterne, og et klik på et af dem åbner netop det. Vælg dokument og visning: *Side for side*, *Hele dokumentet*
(løbende tekst med sidemarkeringer, tegnet i omgange, så selv en lang rapport åbnes straks) eller, for PDF, *Siden som
billede*. Overskrifter vises som overskrifter og tabelrækker med fast bredde. Klik på et afsnit, så viser inspektøren
side, nummer, type og antal tegn med en knap til at kopiere teksten; øverst i inspektøren står dokumentets titel,
forfatter, sider, afsnit og ord med knappen *Hent originalen*.

Søgefeltet søger i hele samlingen og lister fundene med sammenhæng (nøgleord i kontekst); klik på et fund for at
springe til siden. *Vis som tabel* giver den almindelige tabel med alle handlinger i Bearbejd, og *Vis som dokument*
fører dig tilbage. Datasættet i sig selv er altid tabellen: det, du gør i tabellen (filtrere, rette, slette rækker),
ses også i læsevisningen.

## Værktøjet Tekst i Analysér

Når en dokumentsamling er valgt, får Analysér fanen **Tekst** (efter Regex, før Notesbogen) med fire værktøjer. Alle
resultater kan gemmes som et nyt datasæt med knappen *Opret datasæt*, og ét dokument kan vælges i stedet for hele
samlingen.

| Værktøj | Hvad det gør | Indstillinger |
|---|---|---|
| Overblik | Sider, afsnit, overskrifter, tabelrækker, ord, tegn, forskellige ord og ordvariation (type/token-forhold) pr. dokument | |
| Ordfrekvens | De hyppigste ord med antal, andel og antal dokumenter | Sprog for stopord (svensk, dansk, norsk, finsk, islandsk, engelsk), egne stopord, mindste ordlængde, tæl tal, antal at vise |
| Nøgleord i kontekst | Alle forekomster af et ord eller udtryk med teksten før og efter, dokument og side | Hele ord, skeln mellem store og små bogstaver, regulært udtryk |
| Samforekomster | Ordpar, der forekommer sammen i samme afsnit eller inden for nogle få ords afstand | Vindue, stopord, mindste ordlængde |

Ord er følger af bogstaver og tal med bindestreger og apostroffer indeni (`e-mail`, `don't`) og tælles med små
bogstaver. Stopordslisterne er korte lister med formord; slå kontakten fra for at tælle alle ord. De samme tekster
kan analyseres videre i R og Python: `dm_read("navn")` giver afsnitstabellen som data.frame henholdsvis DataFrame.

## Billedsamlinger

Billeder (JPEG, PNG, WebP, GIF, BMP og AVIF, hvor browseren kan læse dem) bliver en billedsamling med
én række pr. billede: `fil`, `typ`, `storlek` (byte), `bredd`, `hojd`, `datum`, `kamera`, `lon`, `lat`, `altitud` og
`beskrivning`. Dato, kamera, position og beskrivelse læses fra EXIF i JPEG-filer; andre formater får kun mål og
størrelse. En forhåndsvisning (lang side højst 1600 px) og en miniature (320 px) gemmes i datasættet; originalerne
gemmes ikke, så en samling med hundredvis af billeder forbliver håndterbar i browseren. Slip alle billederne på én
gang i Hent, så bliver de én samling.

Positionerne kan tegnes på kortdiagrammet i Visualisér (lon og lat som koordinater), og datoerne fungerer som alle
andre datoer i filtre, Forespørgsel og diagrammer.

## Galleriet i Bearbejd

En billedsamling åbnes i Bearbejd som galleri med miniaturer, filter og sortering (filnavn, dato, størrelse), og fra
Håndter med knappen *Vis billeder*; oversigtsfanen dér viser de første miniaturer, og et klik på en af dem åbner den i
galleriet. Klik på et billede, så viser inspektøren en større forhåndsvisning, type, størrelse, mål, dato, kamera,
position og højde samt beskrivelsen, som kan ændres og gemmes: ændringen logges som receptskridt som alle andre
celleændringer og kan fortrydes. Dobbeltklik for at se billedet stort, eller hent forhåndsvisningen til computeren.
*Vis som tabel* giver tabellen med alle handlinger.

## Værktøjet Billeder i Analysér

Når en billedsamling er valgt, får Analysér fanen **Billeder** med to værktøjer:

- **Overblik**: antal, størrelse, billedpunkter, hvor mange billeder der har dato, kamera og position, periode, og en
  fordeling på type, kamera, år eller måned, som kan gemmes som datasæt.
- **Dubletter**: hver miniature laves om til et gråtonebillede på 8 × 8 felter; felter lysere end middelværdien
  bliver ettaller og giver en hash på 64 bit. Billeder, hvis hashes afviger i højst det valgte antal bit, grupperes:
  0 bit giver kun nøjagtige kopier, 5 bit almindelige dubletter (anden størrelse, anden komprimering), 12 bit også
  beskårne eller farvejusterede varianter med flere falske fund. Grupperne vises med miniaturer og kan gemmes som et
  datasæt med fil, gruppe, afstand og hash.

## Billeder i dokumentskabeloner

I dokumentskabeloner (Eksportér > Dokumenter) indsætter tagget `{{bild "fil.jpg" | bredd: 400}}` et billede fra en
billedsamling. Billedet søges først i skabelonens datasæt og derefter i alle billedsamlinger; forhåndsvisningen
bruges og skaleres til den angivne bredde (`bredd`, standard højst 720 px; `hojd` kan også angives). Tagget virker i
Word, PDF, HTML, Markdown og LaTeX ligesom `{{diagram}}`, også i batchkørsler.

## Dele og eksportere

Dokument- og billedsamlinger er almindelige datasæt: de indgår i pakker, kan lægges på GitHub og sendes til en anden
enhed med filerne intakte. Gennemgangen før deling gælder tabellen (teksten i `text`, beskrivelser) som for andre
datasæt. Eksport til CSV, Excel og de andre tabelformater giver afsnits- henholdsvis billedtabellen uden filerne;
Dataspatiums SQLite-fil og pakkerne tager filerne med.

## Begrænsninger

- Skannede PDF-filer uden tekstlag giver ingen afsnit.
- Sidetallene i Word og OpenDocument følger sideskiftene i filen og kan afvige fra, hvad et tekstbehandlingsprogram
  viser.
- EXIF læses kun fra JPEG. HEIC-billeder fra telefoner skal konverteres først, fordi browseren ikke kan afkode dem.
- Meget store samlinger (tusindvis af billeder eller titusindvis af sider) tager tid at læse ind og plads i
  browserens lager; del dem op i flere datasæt.
