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
| Kjør en kommando | Kjører en av appens kommandoer med argumenter som JSON; svaret er kommandoens data |

Et diagram eller dokument som bygger på et datasett, tegnes med de dataene som finnes når steget kjøres, så legg dem etter
stegene som henter og bearbeider.

## Betingelser, løkker og spørsmål

En flyt kan velge vei etter det tidligere steg ga. Gi et steg et *Navn på svaret*, så når senere steg svaret som
`{{navn.felt}}` i argumenter, spørsmål og meldinger og som `navn.felt` i betingelser. *Kjør en kommando* kjører en av
kommandoene som AI-en i appen også bruker, med argumentene som JSON. Heter steget `antall` og kjører `run_sql` med
`{"dataset": "Befolkning", "sql": "select count(*) from data"}`, er antallet `antall.rows[0][0]`.

Kommandoene som bare leser, er `list_datasets`, `describe_dataset`, `read_rows`, `column_stats`, `run_sql`, `list_operations`, `describe_operation`, `list_items`, `list_files`. De som endrer noe eller lager filer, er `apply_operation`, `undo`, `refresh_dataset`, `replay_recipe`, `run_script`, `list_to_dataset`, `render_chart`, `dashboard_html`, `generate_document`, `export_dataset`, `run_flow`, `run_r`, `run_python`. `run_sql` kjører bare én
setning som leser.

| Steg | Slik virker det |
|---|---|
| Hvis en betingelse holder | Kjører stegene under *Da* hvis betingelsen holder, ellers stegene under *Ellers* |
| For hver verdi i en liste | Kjører stegene én gang for hver verdi i et tidligere svar, for eksempel `kommuner.rows`; verdien nås som `{{item}}`, og et tall n gir rundene 1 til n; et datasett i stedet for listen gir én rad per runde med kolonnene som felt (`{{item.kommune}}`) |
| Gjenta til en betingelse holder | Kjører stegene og prøver betingelsen etter hver runde, med en pause mellom rundene; runden nås som `{{round}}` |
| Spør meg | Viser et spørsmål med svaralternativer, ett per linje, og venter på svaret, som nås som `{{navn.answer}}` |
| Avslutt flyten | Avslutter flyten med en melding i loggen; det regnes ikke som en feil |

En betingelse skrives med sammenligningene `=`, `!=`, `<`, `<=`, `>`, `>=` og `contains`, ordene `and`, `or` og `not`, parenteser,
tall, tekst i anførselstegn og henvisninger til svar, for eksempel `antall.rows[0][0] > 0 and navn = 'Ale'`. Appen leser
betingelsen selv og kjører den aldri som kode. Et svar som mangler, regnes som tomt, og en betingelse som ikke kan leses, vises
straks i redigeringen.

Begge løkkene har en grense, *Høyst antall runder* (standard 100, høyst 1 000) og *Høyst antall sekunder*, og grensen som nås
først, gjelder. Løkkens svar sier hvor mange runder den gikk (`rounds`), og hvorfor den sluttet (`reason`: `done`, `until`,
`rounds` eller `time`), så en senere betingelse kan velge etter det.

*Stopp*, i flytvisningen og i statuslinjen, stopper flyten før neste steg og etter hver runde, og en pause som pågår, avbrytes
straks. Et steg som allerede har begynt, kjøres ferdig. Loggen sier hvor flyten ble stoppet, for eksempel *Stoppet av deg i runde
37 av 250*, og det som rakk å bli gjort, kan angres som vanlig.

## Kjør en flyt

*Kjør* starter flyten. Statuslinjen viser hvilket steg som kjøres, og loggen får én linje per steg. *Stopp* stopper flyten før
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
- En flyt som spør deg (*Spør meg*), kjøres aldri ved start.

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
- Bare steg med et navn gir svar som senere steg kan lese: en kommando gir sine data, en løkke `rounds` og `reason`, et
  spørsmål `answer`, og andre steg sin melding og sine filer.
- Oppdatering av flere datasett i ett steg avbrytes ikke midt i en henting.
