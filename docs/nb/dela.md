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

**Filene.** Et datasett med filer viser hvor store de er, og du kan la dem bli igjen for å gjøre pakken mindre. Radene følger med. Uten filene viser en bildesamling bare opplysningene om bildene, og et dokument teksten sin.

## GitHub

Arbeidsområdet som en mappe i et GitHub-repository, helst privat. Angi repository (`eier/navn`), gren og mappe, og
et finkornet tilgangstoken som bare får lese og skrive innholdet i det repositoryet. Tokenet brukes i økten eller
lagres kryptert; ingenting sendes før du trykker *Send til GitHub* eller *Hent fra GitHub*. Bare endrede filer sendes,
i én commit med meldingen din. Ved henting velger du, som for pakker, om datasett som allerede finnes, skal erstattes
(din egen versjon lagres under *Versjoner*). Første gang spør appen om lov til å kontakte GitHub (se *Internettilgang*
i [anvandarguide.md](anvandarguide.md)).

## Samarbeide via GitHub

Når du henter fra GitHub, sammenlignes det som allerede er her, med det hentede etter historikken deres. Dialogen sier for hvert
datasett hvem som har endret hva, og kommentarer og notater fra begge sider beholdes alltid.

- Har bare den andre siden endret data, tas den versjonen inn, og din lagres som en versjon å gå tilbake til.
- Har bare du endret data, beholdes din versjon.
- Har begge endret, velger du: behold begge, med den hentede som et eget datasett, behold din eller ta den hentede. Å beholde
  begge er forvalgt, så ingenting forsvinner.

Kommentarer fra andre som du ikke har lest, vises i statuslinjen. Et klikk åpner dem, og navnet på den som har skrevet, står ved
hver kommentar. Navnet er det personen selv har oppgitt.

## Enheter

Direkte overføring til telefoner, nettbrett og andre datamaskiner over det lokale nettverket, uten server.
Datamaskinen viser en QR-kode; telefonen skanner den med kameraet og åpner Dataspatium Mobil, som tar imot pakker
og filer, viser tabellene og kan sende dem videre eller levere dem til en annen datamaskin. Første gang viser
telefonen en kode som skrives inn på datamaskinen, og enhetene pares; deretter holder det med én skanning. Begge
enhetene viser samme kontrollkode, og mottakeren godkjenner før noe tas imot. To datamaskiner kobler til med koder
som limes inn. Hele flyten, krav og feilsøking finnes i [mobil.md](mobil.md). Knappen *QR-kode til mobilsiden*
viser adressen som skannes for å åpne mobilsiden første gang.

## Gjennomgang før deling

Alt som forlater appen via pakker, enheter eller delingsmenyen, gjennomgås først, og gjennomgangen gjelder hele filen. Appen leter etter identitetsnumre, e-postadresser og telefonnumre, både i
hele kolonner og inne i løpende tekst, og viser det som ellers følger med uten å synes i tabellen. For hver del velger du hva som skal skje i kopien.

| Del | Valg |
|---|---|
| Kolonne med identitetsnumre, e-post eller telefon | Behold, pseudonymiser eller fjern. Pseudonymiser betyr at samme verdi gir samme kode, men at verdien ikke kan leses |
| Løpende tekst, for eksempel dokumentenes avsnitt | Behold, masker treffene eller fjern kolonnen |
| Grafens kanter og modellens egenskaper | Behold, masker treffene eller fjern i kopien |
| Originalfiler | Behold eller fjern. De kan ikke pseudonymiseres, så det foreslås å fjerne dem når noe annet endres |
| Bilder | Behold eller fjern. Posisjonen fjernes for seg, både fra tabellen og fra bildefilen |
| Kommentarer og forfattere i dokumentenes metadata | Behold eller fjern |
| Innsamlede rader | Hvem som samlet inn, kan pseudonymiseres, og posisjonen kan fjernes |

Bare kopien som deles, endres, og datasettet i appen forblir som det er. Endrer du noe, følger verken endringsloggen eller resepten med, siden de kan inneholde de opprinnelige verdiene. Pakker
renses også for rester av fjernede verdier i selve filen.

Gjennomgangen ser ikke alt. Navn, adresser og innholdet i originalfiler og bilder må du vurdere selv. En pakke tar bare med diagrammer, dashbord og notatbøker for de valgte datasettene.
Personopplysninger i dem, i maler og skript, i notatbøkenes lagrede utdata og i datasettenes navn og filnavn vises under *Det som følger med
pakken* og maskeres i kopien hvis du ikke velger å beholde dem, fjerne utdata eller utelate filen.

En synkronisering til **GitHub** må kunne hentes tilbake slik den var, så der kan ingenting pseudonymiseres. Appen viser i stedet hva som kan være personopplysninger før du sender. **Publiser** lager en
HTML-side med verdiene diagrammene viser, så kontroller dem før du legger ut siden.

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

**Et datasett som egen side.** Under Datasett blir et datasett en side i sin egen form: en tekst å lese, bilder å bla i, et kart, et nettverk eller en tabell å filtrere. Siden henter ingenting fra nettet og kan sendes som én fil. Den går gjennom gjennomgangen først og viser høyst 2 000 rader eller 100 bilder.

## Publisere et arbeidsområde

*Publiser arbeidsområdet* lager et nettsted av hele arbeidsområdet eller et utvalg, til et intranett eller å sende. Det blir en
ZIP med en startside og en side for hvert datasett, dashboard og dokument, med søk i tabeller og en kodebok under hvert datasett.
Sidene kan bare leses, henger sammen med relative lenker og henter ingenting fra nettet.

Datasettene går gjennom kontrollen og vises fra kopier. Dashboards og dokumenter tegnes ut fra datasettene slik de er, så der får
du vite hva de inneholder, og velger selv om de skal være med.

## Til CDE

Fanen *Til CDE* sender et datasett til et prosjekt på en OpenCDE-server som Dataregium. Velg server, logg inn og velg prosjekt;
velg så om datasettet skal skrives i et filformat eller om originalfilen skal sendes, og om det skal gå gjennom Documents API,
der serverens egen side spør om tittel, versjon og prosjekt og filen deretter lastes opp i deler, eller som BCF-dokument, som
bare tar filen. Datasettet skrives fra en kopi som har vært gjennom kontrollen, og originalfiler får samme advarsel som i
pakkene. Et datasett hentet fra serveren kan sendes som en ny versjon av dokumentet sitt, og kortet *Fra CDE* i Håndter vet det
deretter. Hver sending noteres i datasettets historikk.

*Arbeidsområdepakke* sender en pakke i stedet for et datasett: pakkedialogen velger datasett og innhold som vanlig, kontrollen
gjøres, og filen går opp som dokument. Mottakeren ser pakken i kildens filliste i Hent og tar den imot med ett klikk.

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
