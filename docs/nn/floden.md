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

Eit diagram eller dokument som byggjer på eit datasett, blir teikna med dei dataa som finst når steget blir køyrt, så legg dei etter
stega som hentar og bearbeider.

## Køyr ein flyt

*Køyr* startar flyten. Statuslinja viser kva steg som blir køyrt, og loggen får éi linje per steg. *Avbryt* stoppar flyten før
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
- Eit steg kan ikkje bruke resultatet av eit anna utover det som hamnar i datasetta.
- Oppdatering av fleire datasett i eitt steg blir ikkje avbroten midt i ei henting.
