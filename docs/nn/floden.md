# Flytar og vakting

Ein **flyt** er ei lagra kjede av steg som blir køyrd med eitt klikk eller når appen startar: hent nye data, bearbeid, teikn diagram,
skriv dokument og eksporter. Det er månadsrapporten på éin knapp. Ei **vakting** held greie på om kjelda til eit datasett er
endra, og seier frå i statuslinja. Begge finst under *Flytar og vakting* i objektpanelet i Handter.

## Lag ein flyt

Trykk på *Ny flyt*, gje han eit namn og legg til steg. Stega blir køyrde ovanfrå og ned, og du flyttar dei med pilene.

| Steg | Kva det gjer |
|---|---|
| Hent nye data | Les kjelda igjen og spelar av oppskrifta til datasettet, for eitt datasett eller alle henta |
| Spel av ei oppskrift | Utfører den same bearbeidinga på eit anna datasett |
| Køyr eit R- eller Python-skript | Køyrer eit lagra skript frå Analyser; det som blir skrive med `dm_write`, blir datasett |
| Lagre ei liste som datasett | Køyrer ei lagra liste eller spørjing frå Søk; neste køyring oppdaterer same datasett, så diagram på det framleis verkar |
| Eksporter eit diagram | Teiknar eit lagra diagram som PNG, SVG eller PDF; med ein grupperingskolonne eitt diagram per verdi |
| Eksporter eit dashbord | Skriv dashbordet som ei frittståande HTML-fil |
| Lag eit dokument | Fyller ein dokumentmal; med ein grupperingskolonne eitt dokument per verdi |
| Eksporter eit datasett | Skriv datasettet som ei fil |
| Køyr ein kommando | Køyrer ein av kommandoane i appen med argument som JSON; svaret er dataa til kommandoen |

Eit diagram eller dokument som byggjer på eit datasett, blir teikna med dei dataa som finst når steget blir køyrt, så legg dei etter
stega som hentar og bearbeider.

## Vilkår, løkker og spørsmål

Ein flyt kan velje veg etter det tidlegare steg gav. Gje eit steg eit *Namn på svaret*, så når seinare steg svaret som
`{{namn.felt}}` i argument, spørsmål og meldingar og som `namn.felt` i vilkår. *Køyr ein kommando* køyrer ein av kommandoane
som AI-en i appen òg brukar, med argumenta som JSON. Heiter steget `tal` og køyrer `run_sql` med
`{"dataset": "Folketal", "sql": "select count(*) from data"}`, er talet `tal.rows[0][0]`.

Kommandoane som berre les, er `list_datasets`, `describe_dataset`, `read_rows`, `column_stats`, `run_sql`, `list_operations`, `describe_operation`, `list_items`, `list_files`. Dei som endrar noko eller lagar filer, er `apply_operation`, `undo`, `refresh_dataset`, `replay_recipe`, `run_script`, `list_to_dataset`, `render_chart`, `dashboard_html`, `generate_document`, `export_dataset`, `run_flow`, `run_r`, `run_python`. `run_sql` køyrer berre éi
setning som les.

| Steg | Slik verkar det |
|---|---|
| Viss eit vilkår held | Køyrer stega under *Då* viss vilkåret held, elles stega under *Elles* |
| For kvar verdi i ei liste | Køyrer stega éin gong for kvar verdi i eit tidlegare svar, til dømes `kommunar.rows`; verdien når ein som `{{item}}`, og eit tal n gjev rundane 1 til n; eit datasett i staden for lista gjev éi rad per runde med kolonnane som felt (`{{item.kommune}}`) |
| Gjenta til eit vilkår held | Køyrer stega og prøver vilkåret etter kvar runde, med ein pause mellom rundane; runden når ein som `{{round}}` |
| Spør meg | Viser eit spørsmål med svaralternativ, eitt per line, og ventar på svaret, som ein når som `{{namn.answer}}` |
| Avslutt flyten | Avsluttar flyten med ei melding i loggen; det vert ikkje rekna som ein feil |

Eit vilkår vert skrive med samanlikningane `=`, `!=`, `<`, `<=`, `>`, `>=` og `contains`, orda `and`, `or` og `not`, parentesar,
tal, tekst i hermeteikn og tilvisingar til svar, til dømes `tal.rows[0][0] > 0 and namn = 'Ale'`. Appen les vilkåret sjølv og
køyrer det aldri som kode. Eit svar som manglar, vert rekna som tomt, og eit vilkår som ikkje kan lesast, vert vist med ein gong i
redigeringa.

Begge løkkene har ei grense, *Høgst tal på rundar* (standard 100, høgst 1 000) og *Høgst tal på sekund*, og grensa som vert nådd
først, gjeld. Svaret frå løkka seier kor mange rundar ho gjekk (`rounds`), og kvifor ho slutta (`reason`: `done`, `until`,
`rounds` eller `time`), så eit seinare vilkår kan velje etter det.

*Stopp*, i flytvisinga og i statuslinja, stoppar flyten før neste steg og etter kvar runde, og ein pause som går føre seg, vert
avbroten med ein gong. Eit steg som alt har byrja, vert køyrt ferdig. Loggen seier kvar flyten vart stoppa, til dømes *Stoppa av
deg i runde 37 av 250*, og det som rakk å bli gjort, kan angrast som vanleg.

## Køyr ein flyt

*Køyr* startar flyten. Statuslinja viser kva steg som blir køyrt, og loggen får éi linje per steg. *Stopp* stoppar flyten før
neste steg. Ein flyt stoppar ved første feil, med mindre du har slått på *Hald fram med neste steg etter ein feil*. Køyringa
tel då framleis som mislukka. Inspektøren viser den siste køyringa steg for steg, med feilen der han oppstod.

Filene frå ei køyring blir liggjande til du lastar dei ned med *Last ned resultatet* eller lukkar appen. Éi fil kjem som ho er,
og fleire blir ei ZIP-fil.

Ein flyt sender aldri noko ut av appen. Det du vil dele med andre, går gjennom modusen Del, der personopplysningar blir gjennomgådde først.

## Køyr ved start

Med *Køyr når appen startar* blir flyten køyrd kort tid etter at appen er opna. Han blir berre køyrd om han ikkje må spørje om noko:

- Steg som hentar frå nettet, krev at samtykket allereie er gjeve.
- Steg som les gjennom databasebrua, blir ikkje køyrde ved start, sidan brua blir kopla til manuelt.
- Python-skript krev at Python allereie er henta.
- Ein flyt som spør deg (*Spør meg*), vert aldri køyrd ved start.

Elles blir flyten hoppa over, og loggen seier kvifor. Ingenting blir køyrt medan appen er lukka.

## Vakt ei kjelde

Vakting gjeld datasett henta frå eit API eller ein database, og lenkja filer. Slå henne på med *Vakt kjelda* på sida til datasettet
i Handter eller på fana *Vakting*.

*Kontroller no* les alle vakta kjelder. Appen samanliknar radene med korleis dei såg ut då datasettet sist vart oppdatert. Dei
same radene i ei anna rekkjefølgje er inga nyheit. Er noko endra, viser statuslinja *Nye data*, og fana fortel kor mange
rader kjelda har no, kor mange som er nye eller endra, og kva kolonnar som er komne til eller forsvunne.

Ei endra rad tel både som ny og som borte, sidan appen ikkje veit kva kolonnar som identifiserer ei rad.

Datasettet blir ikkje endra før du trykkjer på *Oppdater*. Då blir dei nye dataa henta og oppskrifta spela av, og vaktinga
samanliknar deretter med den nye versjonen. Det gjeld òg når du oppdaterer på annan måte, til dømes i ein flyt.

Med *Kontroller når appen startar* skjer kontrollen ved start, men berre for kjelder du allereie har gjeve samtykke til. Lenkja
filer blir då berre kontrollerte om nettlesaren framleis har løyvet ditt; elles står det *Ikkje kontrollert*.

## Tryggingskopiar

Flytar følgjer med i tryggingskopiar og den portable mappa, men ikkje i pakkar til andre, sidan dei peikar på datasett i
arbeidsområdet ditt. Ein flyt frå ein tryggingskopi startar aldri av seg sjølv før du har slått det på igjen.

## Avgrensingar

- Kontrollen hentar heile svaret frå kjelda. Store kjelder tek like lang tid som ei vanleg henting.
- Berre éin flyt blir køyrd om gongen.
- Berre steg med eit namn gjev svar som seinare steg kan lese: ein kommando gjev data sine, ei løkke `rounds` og `reason`, eit
  spørsmål `answer`, og andre steg meldinga og filene sine.
- Oppdatering av fleire datasett i eitt steg blir ikkje avbroten midt i ei henting.
