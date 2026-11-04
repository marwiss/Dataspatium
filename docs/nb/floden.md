# Flyter og overvåking

En **flyt** er en lagret kjede av steg som kjøres med ett klikk eller når appen starter: hent nye data, bearbeid, tegn diagrammer,
skriv dokumenter og eksporter. Det er månedsrapporten på én knapp. En **overvåking** holder rede på om kilden til et datasett er
endret, og sier fra i statuslinjen. Begge finnes under *Flyter og overvåking* i objektpanelet i Håndter.

## Lag en flyt

Trykk på *Ny flyt*, gi den et navn og legg til steg. Stegene kjøres ovenfra og ned, og du flytter dem med pilene.

| Steg | Hva det gjør |
|---|---|
| Hent nye data | Leser kilden igjen og spiller av datasettets resept, for ett datasett eller alle hentede |
| Spill av en resept | Utfører den samme bearbeidingen på et annet datasett |
| Kjør et R- eller Python-skript | Kjører et lagret skript fra Analyser; det som skrives med `dm_write`, blir datasett |
| Lagre en liste som datasett | Kjører en lagret liste eller spørring fra Søk; neste kjøring oppdaterer samme datasett, så diagrammer på det fortsatt virker |
| Eksporter et diagram | Tegner et lagret diagram som PNG, SVG eller PDF; med en grupperingskolonne ett diagram per verdi |
| Eksporter et dashboard | Skriver dashboardet som en frittstående HTML-fil |
| Lag et dokument | Fyller en dokumentmal; med en grupperingskolonne ett dokument per verdi |
| Eksporter et datasett | Skriver datasettet som en fil |

Et diagram eller dokument som bygger på et datasett, tegnes med de dataene som finnes når steget kjøres, så legg dem etter
stegene som henter og bearbeider.

## Kjør en flyt

*Kjør* starter flyten. Statuslinjen viser hvilket steg som kjøres, og loggen får én linje per steg. *Avbryt* stopper flyten før
neste steg. En flyt stopper ved første feil, med mindre du har slått på *Fortsett med neste steg etter en feil*. Kjøringen
teller da fortsatt som mislykket. Inspektøren viser den siste kjøringen steg for steg, med feilen der den oppsto.

Filene fra en kjøring blir liggende til du laster dem ned med *Last ned resultatet* eller lukker appen. Én fil kommer som den er,
og flere blir en ZIP-fil.

En flyt sender aldri noe ut av appen. Det du vil dele med andre, går gjennom modusen Del, der personopplysninger gjennomgås først.

## Kjør ved start

Med *Kjør når appen starter* kjøres flyten kort tid etter at appen er åpnet. Den kjøres bare hvis den ikke må spørre om noe:

- Steg som henter fra nettet, krever at samtykket allerede er gitt.
- Steg som leser gjennom databasebroen, kjøres ikke ved start, siden broen kobles til manuelt.
- Python-skript krever at Python allerede er hentet.

Ellers hoppes flyten over, og loggen sier hvorfor. Ingenting kjøres mens appen er lukket.

## Overvåk en kilde

Overvåking gjelder datasett hentet fra et API eller en database, og lenkede filer. Slå den på med *Overvåk kilden* på datasettets
side i Håndter eller på fanen *Overvåking*.

*Kontroller nå* leser alle overvåkede kilder. Appen sammenligner radene med hvordan de så ut da datasettet sist ble oppdatert. De
samme radene i en annen rekkefølge er ingen nyhet. Er noe endret, viser statuslinjen *Nye data*, og fanen forteller hvor mange
rader kilden har nå, hvor mange som er nye eller endrede, og hvilke kolonner som er kommet til eller forsvunnet.

En endret rad teller både som ny og som borte, siden appen ikke vet hvilke kolonner som identifiserer en rad.

Datasettet endres ikke før du trykker på *Oppdater*. Da hentes de nye dataene og resepten spilles av, og overvåkingen
sammenligner deretter med den nye versjonen. Det gjelder også når du oppdaterer på annen måte, for eksempel i en flyt.

Med *Kontroller når appen starter* skjer kontrollen ved start, men bare for kilder du allerede har gitt samtykke til. Lenkede
filer kontrolleres da bare hvis nettleseren fortsatt har tillatelsen din; ellers står det *Ikke kontrollert*.

## Sikkerhetskopier

Flyter følger med i sikkerhetskopier og den portable mappen, men ikke i pakker til andre, siden de peker på datasett i
arbeidsområdet ditt. En flyt fra en sikkerhetskopi starter aldri av seg selv før du har slått det på igjen.

## Begrensninger

- Kontrollen henter hele svaret fra kilden. Store kilder tar like lang tid som en vanlig henting.
- Bare én flyt kjøres om gangen.
- Et steg kan ikke bruke resultatet av et annet utover det som havner i datasettene.
- Oppdatering av flere datasett i ett steg avbrytes ikke midt i en henting.
