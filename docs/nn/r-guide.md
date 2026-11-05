# R i Dataspatium

Modusen *Analyser* inneheld ein R-konsoll. R køyrer i nettlesaren med WebR (R 4.5), heilt utan installasjon. Alt du treng,
ligg i appmappa: R, eit utval pakkar og hjelpefunksjonane i Dataspatium.

## Kom i gang

1. Opne *Analyser*. R startar automatisk; det tek eit par sekund første gongen.
2. Skriv kode i editoren, og trykk Ctrl+Enter (Cmd+Enter på Mac). Heile skriptet blir køyrt; er tekst merkt, blir berre
   merkinga køyrd. Utdata, meldingar, feil og diagram blir viste under editoren.
3. Lagre skript med *Lagre skript*. Lagra skript ligg i panelet til venstre og følgjer med i tryggingskopiar.

## Funksjonane i Dataspatium

| Funksjon | Gjer |
|---|---|
| `dm_list()` | Viser datasetta i sesjonen: namn, kortnamn, mappe, rader, kolonnar, endra, id. |
| `dm_read("kortnamn")` | Les eit datasett som `data.frame` med rette typar: datoar blir `Date`, dato og tid `POSIXct`, ja/nei `logical`, heiltal `integer`. Argumentet er helst kortnamnet (til dømes `dm_read("befolkning_2024")`, som er det knappen *Set inn dm_read()* skriv), men kan òg vere id, det nøyaktige namnet, namnet uavhengig av store og små bokstavar eller eit eintydig prefiks; `dm_list()` viser kortnamna. Ligg datasettet i ei mappe, verkar òg `dm_read("Mappe/Namn")` og `dm_read("Mappe/kortnamn")`. |
| `dm_read("kortnamn", columns = c("a", "b"), where = "a > 10", n = 1000)` | Les berre somme kolonnar, rader som oppfyller eit SQL-vilkår, eller eit avgrensa tal på rader. |
| `attr(df$kolonne, "label")`, `"description"`, `"unit"` | Etiketten, skildringa og eininga til kolonnen frå appen følgjer med som attributt (når dei er sette); `dm_write()` tek dei med tilbake, eller via argumenta `labels`, `descriptions` og `units`. |
| `dm_value_labels(x, c("Mann" = 1, "Kvinne" = 2), to = "labels")` | Verdietikettar. Ein kolonne med kodar og etikettar blir `haven::labelled` i `dm_read()` (ein kolonne som allereie har etikettane som tekst, held på kodane i attributtet `value_labels`), og `dm_write()` lagrar dei. `dm_value_labels()` set etikettar (`to = NULL`), byter kodar mot etikettar (`"labels"`) eller tilbake (`"codes"`); utan etikettar blir dei fjerna. |
| `dm_write(df, "Nytt namn", description = "…")` | Sender ein `data.frame` til appen som nytt datasett. Det dukkar opp i lista når kommandoen er ferdig. |
| `theme_dataspatium()` | ggplot2-tema med utsjånaden til appen. Blir sett automatisk når `library(ggplot2)` blir køyrd. |
| `dm_palette()` | Fargepaletten til appen (Okabe-Ito, fargeblindvenleg). `scale_colour_dataspatium()` og `scale_fill_dataspatium()` finst òg. |

Døme (dømedataa som følgjer med, der kolonnane har svenske namn):

```r
df <- dm_read("befolkning_2024")
library(dplyr)
per_lan <- df |>
  group_by(lan) |>
  summarise(folkmangd = sum(folkmangd), kommuner = n()) |>
  arrange(desc(folkmangd))
per_lan
dm_write(per_lan, "Befolkning per län 2024")

library(ggplot2)
ggplot(per_lan, aes(x = reorder(lan, folkmangd), y = folkmangd / 1000)) +
  geom_col(fill = dm_palette()[1]) +
  coord_flip() +
  labs(title = "Befolkning per län 2024", x = NULL, y = "Tusen")
```

## Diagram

Diagram blir teikna på eit lerret og viste i konsollen. Under kvart diagram finst knappar for eksport til SVG (vektor, bra
for Word og nett), PNG og PDF. Eksporten brukar same kode som teikna diagrammet, så ggplot2-diagram blir skarpe i alle
format. Standardstorleiken er 7 × 5 tommar; PNG blir eksportert med 150 dpi.

## Pakkar

Følgjande pakkar følgjer med i appmappa og kan lastast med `library()` utan internett: ggplot2, dplyr, tidyr, readr, stringr,
lubridate, forcats, data.table, haven (SPSS, Stata, SAS), readxl, writexl, nanoparquet (Parquet), svglite, jsonlite,
RSQLite, DBI og knitr og dessutan avhengnadene deira (mellom anna tibble, purrr, rlang, cli, stringi). `library(pakke)`
installerer pakken frå det innebygde arkivet første gongen han blir brukt.

Andre pakkar blir henta ved behov frå pakkearkivet til webR (repo.r-wasm.org, over 20 000 CRAN-pakkar bygde for
nettlesaren): kallar koden `library()`, `require()` eller `pakke::` for ein pakke utanfor utvalet, blir han henta med
avhengnadene sine før koden blir køyrd. Første gongen spør appen om løyve til å kontakte internett for komponentar;
deretter blir pakkane lagra i nettlesaren, finst framleis ved neste oppstart og blir viste under *Handter → Arbeidsområde →
Komponentar*, der dei òg kan fjernast. Utan nettverk, eller om du svarar nei, får koden den vanlege feilen om at
pakken manglar. Pakkar som krev systembibliotek som ikkje finst i nettlesaren, kan mangle i arkivet.

## R-steg i oppskrifter

I Bearbeid finst handlinga **R-steg** (gruppa Kode): ein funksjon `function(df) { ... }` blir køyrd på heile tabellen,
og det han returnerer, blir den nye tabellen med typar frå resultatet. Steget blir logga i oppskrifta med koden sin, kan
angrast, spelast av på eit anna datasett og eksporterast som R-kode (`df <- (function(df) {...})(df)`). *Førehandsvis*
køyrer funksjonen på dei første 200 radene. Pakkar som koden brukar, blir henta som i konsollen. R-diagram i Visualiser
blir no òg eksporterte frå Eksporter, i batch og i dokumentmalar utan at R-fana er open: appen køyrer skriptet i
R-sesjonen når det trengst.

## Slik blir data flytta mellom appen og R

Datasetta er SQLite-filer. Når du køyrer kode, kopierer appen datasetta som koden viser til med `dm_read()`, til det
virtuelle filsystemet til R under `/data`, saman med ein indeks. `dm_read()` les fila med RSQLite og gjenopprettar kolonnetypane
frå tabellen `_columns`. `dm_write()` skriv ei ny SQLite-fil i `/data/out` som appen hentar og legg til i arbeidsområdet
når kommandoen er ferdig. Vil du bruke RSQLite direkte, går det fint: `DBI::dbConnect(RSQLite::SQLite(), "/data/<id>.sqlite")`,
der id blir vist av `dm_list()`.

Datasett større enn 50 MB blir berre spegla når det blir vist til dei i koden.

## Språk

Meldingar frå `dm_list()`, `dm_read()` og `dm_write()` følgjer språket i appen (svensk, dansk, norsk bokmål eller nynorsk, finsk, islandsk eller
engelsk); kolonnenamna i `dm_list()` er derimot alltid dei same (`namn`, `kortnamn`, `mapp`, `rader`, `kolumner`, `ändrad`, `id`),
så skript fungerer uavhengig av språk.

## Avgrensingar

- Når appen blir opna frå ei mappe (file://), kan R-kode ikkje avbrytast medan han køyrer. Om noko heng: *Start R på nytt*.
  Lagra skript blir ikkje påverka, men objekt i R-sesjonen forsvinn. Køyrer appen frå ein webtenar (localhost eller
  https), finst knappen *Avbryt*, som stoppar koden og held på sesjonen (sjå [faq.md](faq.md)).
- Minnet er avgrensa av nettlesaren og WebAssembly; hald datasett i R under nokre hundre megabyte.
- Inndata under køyring (`readline()`, `menu()`) fungerer ikkje.
- Grafikkvindauge, systemkommandoar, nettverkskall og filer utanfor det virtuelle filsystemet er ikkje tilgjengelege.
- Hjelpesider er med: `?dplyr::mutate` skriv hjelpeteksten i konsollen.
