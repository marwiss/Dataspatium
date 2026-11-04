# Del

Tilstanden Del samler det, der handler om at give data til andre mennesker og enheder. Eksportér handler om filer
til din egen computer; Del om pakker, GitHub, enheder, delingsmenuen, udgivelse og modtagelse. Før datasæt forlader
appen, går de gennem en gennemgang af personoplysninger (se nedenfor).

## Pakke

En pakke er en ZIP-fil med valgte datasæt og det, der hører til dem: diagrammer, dashboards, skabeloner, notesbøger
og scripts, sammen med en besked, afsenderens navn og en ændringslog over det, der er gjort med hvert datasæt, siden
det sidst blev delt. *Opret pakke* åbner dialogen med alle datasæt forvalgt; med et datasæt valgt findes også *Pak kun
det*. Modtageren åbner pakken under *Modtag* og ser besked og ændringer, før noget tages ind. Inspektøren viser, hvor
meget der er at dele. Se også [format.md](format.md) om pakkens opbygning.

## GitHub

Arbejdsområdet som en mappe i et GitHub-repository, helst privat. Angiv repository (`ejer/navn`), gren og mappe og et
finkornet adgangstoken, der kun må læse og skrive indholdet i det repository. Tokenet bruges i sessionen eller gemmes
krypteret; intet sendes, før du trykker *Send til GitHub* eller *Hent fra GitHub*. Kun ændrede filer sendes, i én
commit med din besked. Ved hentning vælger du, som for pakker, om datasæt, der allerede findes, skal erstattes (din
egen version gemmes under *Versioner*). Første gang spørger appen om lov til at kontakte GitHub (se *Internetadgang* i
[anvandarguide.md](anvandarguide.md)).

## Enheder

Direkte overførsel til telefoner, tablets og andre computere over det lokale netværk, uden server. Computeren
viser en QR-kode; telefonen scanner den med kameraet og åbner Dataspatium Mobil, der modtager pakker og filer,
viser tabellerne og kan sende dem videre eller aflevere dem til en anden computer. Første gang viser telefonen en
kode, der skrives ind på computeren, og enhederne parres; derefter er én scanning nok. Begge enheder viser samme
kontrolkode, og modtageren godkender, før noget modtages. To computere forbinder med koder, der indsættes. Hele
flowet, krav og fejlfinding findes i [mobil.md](mobil.md). Knappen *QR-kode til mobilsiden* viser adressen, der
scannes for at åbne mobilsiden første gang.

## Gennemgang før deling

Når datasæt pakkes, sendes til en enhed eller deles via delingsmenuen, gennemsøger appen kolonnerne efter
identitetsnumre (svenske, danske, norske, finske og islandske), e-mailadresser og telefonnumre, på kolonnenavne og
værdier. Findes der noget, vises en dialog, hvor du for hver kolonne vælger *Behold*, *Pseudonymisér* (samme værdi
giver samme kode, men værdien kan ikke læses) eller *Fjern kolonnen*. Kun kopien, der deles, ændres; datasættet i
appen forbliver, som det er, og pakkens manifest angiver, hvilke kolonner der er ændret. Gennemgangen ser ikke alt:
navne, adresser og fritekst må du selv vurdere.

## Delingsmenu

Computerens eller telefonens egen delingsmenu: send en fil til e-mail, Teams, beskedapps eller andre apps. Vælg, om
det valgte datasæt skal deles som fil (CSV, Excel, ODS eller JSON), eller om alle datasæt skal deles som en pakke, og
tryk på *Del*. Delingsmenuen for filer findes i Edge og Chrome på Windows og på mobil; i andre browsere (Firefox)
gemmes filen i stedet, og knappen hedder så *Gem fil*. På en telefon med Dataspatium Mobil installeret kan filer
også deles *til* Dataspatium fra andre apps; de havner under *Modtaget* på mobilsiden.

## Udgiv

En selvstændig HTML-fil, der fungerer uden Dataspatium og kan lægges på et intranet eller sendes: dashboards (med
diagrammerne indlejret) og dokumenter fra skabeloner, udfyldt med det valgte datasæt. Udgivne filer indeholder data
og diagrammer i klartekst; del dem kun med dem, der må se oplysningerne.

## Modtag

Åbn en pakke fra en fil (slip den på fladen) eller fra en webadresse. Afsender, besked og ændringer vises først;
datasæt, der allerede findes, kan erstattes med pakkens version, ellers springes de over. En backup (ZIP fra *Tag
backup af arbejdsområdet*) kan også åbnes her, men hører hjemme under Håndter, Arbejdsområde.

## Hvad der ikke kan lade sig gøre

En browser kan ikke være server, så andre kan ikke hente data fra din computer, når den er slukket, eller når de
ikke er på samme netværk; så passerer en fil eller en pakke via delingsmenuen, en cloudmappe (den portable mappe
under Håndter kan ligge i OneDrive eller Dropbox) eller GitHub. På samme netværk går overførslen direkte mellem
enhederne (fanen Enheder). `mailto:`-links kan ikke bære vedhæftninger; brug delingsmenuen, eller gem filen og
vedhæft den.
