# Del

Modusen Del samler det som handler om å gi data til andre mennesker og enheter. Eksporter handler om filer til din
egen datamaskin; Del om pakker, GitHub, enheter, delingsmenyen, publisering og mottak. Før datasett forlater appen,
går de gjennom en gjennomgang av personopplysninger (se nedenfor).

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

## Enheter

Direkte overføring til telefoner, nettbrett og andre datamaskiner over det lokale nettverket, uten server.
Datamaskinen viser en QR-kode; telefonen skanner den med kameraet og åpner Dataspatium Mobil, som tar imot pakker
og filer, viser tabellene og kan sende dem videre eller levere dem til en annen datamaskin. Første gang viser
telefonen en kode som skrives inn på datamaskinen, og enhetene pares; deretter holder det med én skanning. Begge
enhetene viser samme kontrollkode, og mottakeren godkjenner før noe tas imot. To datamaskiner kobler til med koder
som limes inn. Hele flyten, krav og feilsøking finnes i [mobil.md](mobil.md). Knappen *QR-kode til mobilsiden*
viser adressen som skannes for å åpne mobilsiden første gang.

## Gjennomgang før deling

Når datasett pakkes, sendes til en enhet eller deles via delingsmenyen, søker appen gjennom kolonnene etter
identitetsnumre (svenske, danske, norske, finske og islandske), e-postadresser og telefonnumre, på kolonnenavn og
verdier. Finnes noe, vises en dialog der du for hver kolonne velger *Behold*, *Pseudonymiser* (samme verdi gir
samme kode, men verdien kan ikke leses) eller *Fjern kolonnen*. Bare kopien som deles, endres; datasettet i appen
forblir som det er, og pakkens manifest angir hvilke kolonner som er endret. Gjennomgangen ser ikke alt: navn,
adresser og fritekst må du vurdere selv.

## Delingsmeny

Datamaskinens eller telefonens egen delingsmeny: send en fil til e-post, Teams, meldingsapper eller andre apper. Velg
om det valgte datasettet skal deles som fil (CSV, Excel, ODS eller JSON) eller om alle datasett skal deles som en
pakke, og trykk på *Del*. Delingsmenyen for filer finnes i Edge og Chrome på Windows og på mobil; i andre nettlesere
(Firefox) lagres filen i stedet, og knappen heter da *Lagre fil*. På en telefon med Dataspatium Mobil installert kan
filer også deles *til* Dataspatium fra andre apper; de havner under *Mottatt* på mobilsiden.

## Publiser

En frittstående HTML-fil som fungerer uten Dataspatium og kan legges på et intranett eller sendes: dashbord (med
diagrammene innebygd) og dokumenter fra maler, fylt med det valgte datasettet. Publiserte filer inneholder data og
diagrammer i klartekst; del dem bare med dem som får se opplysningene.

## Motta

Åpne en pakke fra en fil (slipp den på flaten) eller fra en nettadresse. Avsender, melding og endringer vises først;
datasett som allerede finnes, kan erstattes med pakkens versjon, ellers hoppes de over. En sikkerhetskopi (ZIP fra
*Sikkerhetskopier arbeidsområdet*) kan også åpnes her, men hører hjemme under Håndter, Arbeidsområde.

## Hva som ikke går

En nettleser kan ikke være server, så andre kan ikke hente data fra datamaskinen din når den er av, eller når de
ikke er på samme nettverk; da passerer en fil eller en pakke via delingsmenyen, en skymappe (den portable mappen
under Håndter kan ligge i OneDrive eller Dropbox) eller GitHub. På samme nettverk går overføringen direkte mellom
enhetene (fanen Enheter). `mailto:`-lenker kan ikke bære vedlegg; bruk delingsmenyen eller lagre filen og legg den
ved.
