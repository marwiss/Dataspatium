# Del

Modusen Del samler det som handler om å gi data til andre mennesker og enheter. Eksporter handler om filer til din
egen datamaskin; Del om pakker, GitHub, delingsmenyen, publisering og mottak. Fanen Enheter, direkte overføring
mellom datamaskiner og telefoner, kommer i 2.1.

## Pakke

En pakke er en ZIP-fil med valgte datasett og det som hører til dem: diagrammer, dashbord, maler, notatbøker og
skript, sammen med en melding, avsenderens navn og en endringslogg over det som er gjort med hvert datasett siden det
sist ble delt. *Lag pakke* åpner dialogen med alle datasett forhåndsvalgt; med et datasett valgt finnes også *Pakk
bare det*. Mottakeren åpner pakken under *Motta* og ser melding og endringer før noe tas inn. Inspektøren viser hvor
mye som finnes å dele. Se også [format.md](format.md) om pakkens oppbygning.

## GitHub

Arbeidsområdet som en mappe i et GitHub-repository, helst privat. Angi repository (`eier/navn`), gren og mappe, og
et finkornet tilgangstoken som bare får lese og skrive innholdet i det repositoryet. Tokenet brukes i økten eller
lagres kryptert; ingenting sendes før du trykker *Send til GitHub* eller *Hent fra GitHub*. Bare endrede filer sendes,
i én commit med meldingen din. Ved henting velger du, som for pakker, om datasett som allerede finnes, skal erstattes
(din egen versjon lagres under *Versjoner*). Første gang spør appen om lov til å kontakte GitHub (se *Internettilgang*
i [anvandarguide.md](anvandarguide.md)).

## Delingsmeny

Datamaskinens eller telefonens egen delingsmeny: send en fil til e-post, Teams, meldingsapper eller andre apper. Velg
om det valgte datasettet skal deles som fil (CSV, Excel, ODS eller JSON) eller om alle datasett skal deles som en
pakke, og trykk på *Del*. Delingsmenyen for filer finnes i Edge og Chrome på Windows og på mobil; i andre nettlesere
(Firefox) lagres filen i stedet, og knappen heter da *Lagre fil*.

## Publiser

En frittstående HTML-fil som fungerer uten Dataspatium og kan legges på et intranett eller sendes: dashbord (med
diagrammene innebygd) og dokumenter fra maler, fylt med det valgte datasettet. Publiserte filer inneholder data og
diagrammer i klartekst; del dem bare med dem som får se opplysningene.

## Motta

Åpne en pakke fra en fil (slipp den på flaten) eller fra en nettadresse. Avsender, melding og endringer vises først;
datasett som allerede finnes, kan erstattes med pakkens versjon, ellers hoppes de over. En sikkerhetskopi (ZIP fra
*Sikkerhetskopier arbeidsområdet*) kan også åpnes her, men hører hjemme under Håndter, Arbeidsområde.

## Hva som ikke går

En nettleser kan ikke være server, så andre kan ikke hente data direkte fra din datamaskin uten at en fil eller en
pakke passerer: via delingsmenyen, en skymappe (den portable mappen under Håndter kan ligge i OneDrive eller
Dropbox), GitHub eller, fra 2.1, direkte mellom enheter med WebRTC. `mailto:`-lenker kan ikke bære vedlegg; bruk
delingsmenyen eller lagre filen og legg den ved.
