# R i Dataspatium

Tilstanden *Analysér* indeholder en R-konsol. R kører i browseren med WebR (R 4.5), helt uden installation. Alt, hvad du
har brug for, ligger i appmappen: R, et udvalg af pakker og Dataspatiums hjælpefunktioner.

## Kom i gang

1. Åbn *Analysér*. R starter automatisk; det tager et par sekunder første gang.
2. Skriv kode i editoren, og tryk Ctrl+Enter (Cmd+Enter på Mac). Hele scriptet køres; er tekst markeret, køres kun
   markeringen. Output, meddelelser, fejl og diagrammer vises under editoren.
3. Gem scripts med *Gem script*. Gemte scripts ligger i panelet til venstre og følger med i backup.

## Dataspatiums funktioner

| Funktion | Gør |
|---|---|
| `dm_list()` | Viser datasættene i sessionen: navn, kortnavn, rækker, kolonner, ændret, id. |
| `dm_read("kortnavn")` | Læser et datasæt som `data.frame` med de rigtige typer: datoer bliver `Date`, dato og tid `POSIXct`, ja/nej `logical`, heltal `integer`. Argumentet er helst kortnavnet (for eksempel `dm_read("befolkning_2024")`, som er det, knappen *Indsæt dm_read()* skriver), men kan også være id, det nøjagtige navn, navnet uanset store og små bogstaver eller et entydigt præfiks; `dm_list()` viser kortnavnene. |
| `dm_read("kortnavn", columns = c("a", "b"), where = "a > 10", n = 1000)` | Læser kun visse kolonner, rækker, der opfylder en SQL-betingelse, eller et begrænset antal rækker. |
| `attr(df$kolonne, "label")`, `"description"`, `"unit"` | Kolonnens etiket, beskrivelse og enhed fra appen følger med som attributter (når de er sat); `dm_write()` tager dem med tilbage, eller via argumenterne `labels`, `descriptions` og `units`. |
| `dm_write(df, "Nyt navn", description = "…")` | Sender en `data.frame` til appen som nyt datasæt. Det dukker op i listen, når kommandoen er færdig. |
| `theme_dataspatium()` | ggplot2-tema med appens udseende. Sættes automatisk, når `library(ggplot2)` køres. |
| `dm_palette()` | Appens farvepalet (Okabe-Ito, farveblindvenlig). `scale_colour_dataspatium()` og `scale_fill_dataspatium()` findes også. |

Eksempel (de medfølgende eksempeldata, hvis kolonner har svenske navne):

```r
df <- dm_read("befolkning_2024")
library(dplyr)
per_lan <- df |>
  group_by(lan) |>
  summarise(folkmangd = sum(folkmangd), kommuner = n()) |>
  arrange(desc(folkmangd))
per_lan
dm_write(per_lan, "Befolkning pr. län 2024")

library(ggplot2)
ggplot(per_lan, aes(x = reorder(lan, folkmangd), y = folkmangd / 1000)) +
  geom_col(fill = dm_palette()[1]) +
  coord_flip() +
  labs(title = "Befolkning pr. län 2024", x = NULL, y = "Tusinder")
```

## Diagrammer

Diagrammer tegnes på et lærred og vises i konsollen. Under hvert diagram findes knapper til eksport som SVG (vektor, godt
til Word og web), PNG og PDF. Eksporten bruger samme kode, som tegnede diagrammet, så ggplot2-diagrammer bliver skarpe i
alle formater. Standardstørrelsen er 7 × 5 tommer; PNG eksporteres med 150 dpi.

## Pakker

Følgende pakker følger med i appmappen og kan indlæses med `library()` uden internet: ggplot2, dplyr, tidyr, readr,
stringr, lubridate, forcats, data.table, haven (SPSS, Stata, SAS), readxl, writexl, nanoparquet (Parquet), svglite,
jsonlite, RSQLite, DBI og knitr samt deres afhængigheder (blandt andet tibble, purrr, rlang, cli, stringi).
`library(pakke)` installerer pakken fra det indbyggede arkiv, første gang den bruges.

Andre CRAN-pakker kan ikke installeres, fordi appen ikke henter noget fra internettet. Har du brug for flere pakker, så
opret et issue, så kan de tilføjes i næste udgivelse.

## Sådan flyttes data mellem appen og R

Datasættene er SQLite-filer. Når du kører kode, kopierer appen de datasæt, koden henviser til med `dm_read()`, til R's
virtuelle filsystem under `/data` sammen med et indeks. `dm_read()` læser filen med RSQLite og genskaber kolonnetyperne
fra tabellen `_columns`. `dm_write()` skriver en ny SQLite-fil i `/data/out`, som appen henter og tilføjer til
arbejdsområdet, når kommandoen er færdig. Vil du bruge RSQLite direkte, går det fint:
`DBI::dbConnect(RSQLite::SQLite(), "/data/<id>.sqlite")`, hvor id vises af `dm_list()`.

Datasæt større end 50 MB spejles kun, når der henvises til dem i koden.

## Sprog

Meddelelser fra `dm_list()`, `dm_read()` og `dm_write()` følger appens sprog (svensk, dansk, norsk, finsk, islandsk eller
engelsk); kolonnenavnene i `dm_list()` er derimod altid de samme (`namn`, `kortnamn`, `rader`, `kolumner`, `ändrad`, `id`),
så scripts fungerer uanset sprog.

## Begrænsninger

- R-kode kan ikke afbrydes, mens den kører (browseren mangler den funktion, når appen åbnes fra en mappe). Hvis noget
  hænger: *Genstart R*. Gemte scripts påvirkes ikke, men objekter i R-sessionen forsvinder.
- Hukommelsen begrænses af browseren og WebAssembly; hold datasæt i R under nogle hundrede megabyte.
- Input under kørsel (`readline()`, `menu()`) fungerer ikke.
- Grafikvinduer, systemkommandoer, netværkskald og filer uden for det virtuelle filsystem er ikke tilgængelige.
- Hjælpesider er med: `?dplyr::mutate` skriver hjælpeteksten i konsollen.
