# Flows og overvågning

Et **flow** er en gemt kæde af trin, der køres med ét klik eller når appen starter: hent nye data, bearbejd, tegn diagrammer,
skriv dokumenter og eksportér. Det er månedsrapporten på én knap. En **overvågning** holder styr på, om kilden til et datasæt
er ændret, og siger til i statuslinjen. Begge findes under *Flows og overvågning* i objektpanelet i Håndter.

## Opret et flow

Tryk på *Nyt flow*, giv det et navn, og tilføj trin. Trinnene køres oppefra og ned, og du flytter dem med pilene.

| Trin | Hvad det gør |
|---|---|
| Hent nye data | Læser kilden igen og afspiller datasættets recept, for ét datasæt eller alle hentede |
| Afspil en recept | Udfører den samme bearbejdning på et andet datasæt |
| Kør et R- eller Python-script | Kører et gemt script fra Analysér; det, der skrives med `dm_write`, bliver datasæt |
| Gem en liste som datasæt | Kører en gemt liste eller forespørgsel fra Søg; næste kørsel opdaterer samme datasæt, så diagrammer på det fortsat virker |
| Eksportér et diagram | Tegner et gemt diagram som PNG, SVG eller PDF; med en grupperingskolonne ét diagram pr. værdi |
| Eksportér et dashboard | Skriver dashboardet som en selvstændig HTML-fil |
| Opret et dokument | Fylder en dokumentskabelon; med en grupperingskolonne ét dokument pr. værdi |
| Eksportér et datasæt | Skriver datasættet som en fil |
| Kør en kommando | Kører en af appens kommandoer med argumenter som JSON; svaret er kommandoens data |

Et diagram eller dokument, der bygger på et datasæt, tegnes med de data, der findes, når trinnet køres, så læg dem efter de
trin, der henter og bearbejder.

## Betingelser, løkker og spørgsmål

Et flow kan vælge vej efter det, tidligere trin gav. Giv et trin et *Navn på svaret*, så når senere trin svaret som
`{{navn.felt}}` i argumenter, spørgsmål og meddelelser og som `navn.felt` i betingelser. *Kør en kommando* kører en af de
kommandoer, som AI'en i appen også bruger, med argumenterne som JSON. Hedder trinnet `antal` og kører `run_sql` med
`{"dataset": "Befolkning", "sql": "select count(*) from data"}`, er antallet `antal.rows[0][0]`.

Kommandoerne, der kun læser, er `list_datasets`, `describe_dataset`, `read_rows`, `column_stats`, `run_sql`, `list_operations`, `describe_operation`, `list_items`, `list_files`. Dem, der ændrer noget eller laver filer, er `apply_operation`, `undo`, `refresh_dataset`, `replay_recipe`, `run_script`, `list_to_dataset`, `render_chart`, `dashboard_html`, `generate_document`, `export_dataset`, `run_flow`, `run_r`, `run_python`. `run_sql` kører kun én
sætning, der læser.

| Trin | Sådan virker det |
|---|---|
| Hvis en betingelse holder | Kører trinnene under *Så*, hvis betingelsen holder, ellers trinnene under *Ellers* |
| For hver værdi i en liste | Kører trinnene én gang for hver værdi i et tidligere svar, for eksempel `kommuner.rows`; værdien nås som `{{item}}`, og et tal n giver omgangene 1 til n |
| Gentag, indtil en betingelse holder | Kører trinnene og prøver betingelsen efter hver omgang, med en pause mellem omgangene; omgangen nås som `{{round}}` |
| Spørg mig | Viser et spørgsmål med svarmuligheder, én pr. linje, og venter på svaret, som nås som `{{navn.answer}}` |
| Afslut flowet | Afslutter flowet med en meddelelse i loggen; det tæller ikke som en fejl |

En betingelse skrives med sammenligningerne `=`, `!=`, `<`, `<=`, `>`, `>=` og `contains`, ordene `and`, `or` og `not`, parenteser,
tal, tekst i anførselstegn og henvisninger til svar, for eksempel `antal.rows[0][0] > 0 and navn = 'Ale'`. Appen læser selv
betingelsen og kører den aldrig som kode. Et svar, der mangler, regnes som tomt, og en betingelse, der ikke kan læses, vises
straks i redigeringen.

Begge løkker har en grænse, *Højst antal omgange* (standard 100, højst 1.000) og *Højst antal sekunder*, og den grænse, der nås
først, gælder. Løkkens svar siger, hvor mange omgange den gik (`rounds`), og hvorfor den sluttede (`reason`: `done`, `until`,
`rounds` eller `time`), så en senere betingelse kan vælge efter det.

*Stop*, i flowvisningen og i statuslinjen, stopper flowet før næste trin og efter hver omgang, og en igangværende pause afbrydes
straks. Et trin, der allerede er begyndt, køres færdigt. Loggen siger, hvor flowet blev stoppet, for eksempel *Stoppet af dig i
omgang 37 af 250*, og det, der nåede at blive gjort, kan fortrydes som sædvanligt.

## Kør et flow

*Kør* starter flowet. Statuslinjen viser, hvilket trin der køres, og loggen får én linje pr. trin. *Stop* stopper flowet før
næste trin. Et flow stopper ved første fejl, medmindre du har slået *Fortsæt med næste trin efter en fejl* til. Kørslen tæller
så stadig som mislykket. Inspektøren viser den seneste kørsel trin for trin med fejlen, hvor den opstod.

Filerne fra en kørsel bliver liggende, til du henter dem med *Hent resultatet* eller lukker appen. Én fil kommer, som den er, og
flere bliver en ZIP-fil.

Et flow sender aldrig noget ud af appen. Det, du vil dele med andre, går gennem tilstanden Del, hvor personoplysninger gennemgås først.

## Kør ved start

Med *Kør når appen starter* køres flowet kort efter, at appen er åbnet. Det køres kun, hvis det ikke skal spørge om noget:

- Trin, der henter fra nettet, kræver, at samtykket allerede er givet.
- Trin, der læser gennem databasebroen, køres ikke ved start, da broen forbindes manuelt.
- Python-scripts kræver, at Python allerede er hentet.
- Et flow, der spørger dig (*Spørg mig*), køres aldrig ved start.

Ellers springes flowet over, og loggen siger hvorfor. Intet køres, mens appen er lukket.

## Overvåg en kilde

Overvågning gælder datasæt hentet fra et API eller en database og sammenkædede filer. Slå den til med *Overvåg kilden* på
datasættets side i Håndter eller på fanen *Overvågning*.

*Kontrollér nu* læser alle overvågede kilder. Appen sammenligner rækkerne med, hvordan de så ud, da datasættet sidst blev
opdateret. De samme rækker i en anden rækkefølge er ingen nyhed. Er noget ændret, viser statuslinjen *Nye data*, og fanen
fortæller, hvor mange rækker kilden har nu, hvor mange der er nye eller ændrede, og hvilke kolonner der er kommet til eller forsvundet.

En ændret række tæller både som ny og som væk, da appen ikke ved, hvilke kolonner der identificerer en række.

Datasættet ændres ikke, før du trykker på *Opdatér*. Så hentes de nye data, og recepten afspilles, og overvågningen
sammenligner derefter med den nye version. Det gælder også, når du opdaterer på anden måde, for eksempel i et flow.

Med *Kontrollér når appen starter* sker kontrollen ved start, men kun for kilder, du allerede har givet samtykke til.
Sammenkædede filer kontrolleres så kun, hvis browseren stadig har din tilladelse; ellers står der *Ikke kontrolleret*.

## Sikkerhedskopier

Flows følger med i sikkerhedskopier og den portable mappe, men ikke i pakker til andre, da de peger på datasæt i dit
arbejdsområde. Et flow fra en sikkerhedskopi starter aldrig af sig selv, før du har slået det til igen.

## Begrænsninger

- Kontrollen henter hele svaret fra kilden. Store kilder tager lige så lang tid som en almindelig hentning.
- Kun ét flow køres ad gangen.
- Kun trin med et navn giver svar, som senere trin kan læse: en kommando giver sine data, en løkke `rounds` og `reason`, et
  spørgsmål `answer`, og andre trin deres meddelelse og filer.
- Opdatering af flere datasæt i ét trin afbrydes ikke midt i en hentning.
