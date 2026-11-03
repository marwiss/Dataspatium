# R i Dataspatium

Läget *Analysera* innehåller en R-konsol. R körs i webbläsaren med WebR (R 4.5), helt utan installation. Allt du
behöver finns i appmappen: R, ett urval paket och Dataspatiums hjälpfunktioner.

## Kom igång

1. Öppna *Analysera*. R startar automatiskt; det tar ett par sekunder första gången.
2. Skriv kod i redigeraren och tryck Ctrl+Enter (Cmd+Enter på Mac). Hela skriptet körs; är text markerad körs
   bara markeringen. Utdata, meddelanden, fel och diagram visas under redigeraren.
3. Spara skript med *Spara skript*. Sparade skript ligger i panelen till vänster och följer med i säkerhetskopior.

## Dataspatiums funktioner

| Funktion | Gör |
|---|---|
| `dm_list()` | Visar datamängderna i sessionen: namn, rader, kolumner, ändrad, id. |
| `dm_read("Namn")` | Läser in en datamängd som `data.frame` med rätt typer: datum blir `Date`, datum och tid `POSIXct`, ja/nej `logical`, heltal `integer`. Namnet kan vara id, exakt namn, namn oavsett skiftläge eller ett entydigt prefix. |
| `dm_read("Namn", columns = c("a", "b"), where = "a > 10", n = 1000)` | Läser bara vissa kolumner, rader som uppfyller ett SQL-villkor, eller ett begränsat antal rader. |
| `attr(df$kolumn, "label")`, `"description"`, `"unit"` | Kolumnens etikett, beskrivning och enhet från appen följer med som attribut (när de är satta); `dm_write()` tar dem tillbaka, eller via argumenten `labels`, `descriptions` och `units`. |
| `dm_write(df, "Nytt namn", description = "…")` | Skickar en `data.frame` till appen som en ny datamängd. Den dyker upp i listan när kommandot är klart. |
| `theme_dataspatium()` | ggplot2-tema med appens utseende. Sätts automatiskt när `library(ggplot2)` körs. |
| `dm_palette()` | Appens färgpalett (Okabe-Ito, färgblindsäker). `scale_colour_dataspatium()` och `scale_fill_dataspatium()` finns också. |

Exempel:

```r
df <- dm_read("Befolkning per kommun 2024")
library(dplyr)
per_lan <- df |>
  group_by(lan) |>
  summarise(folkmangd = sum(folkmangd), kommuner = n()) |>
  arrange(desc(folkmangd))
per_lan
dm_write(per_lan, "Folkmängd per län 2024")

library(ggplot2)
ggplot(per_lan, aes(x = reorder(lan, folkmangd), y = folkmangd / 1000)) +
  geom_col(fill = dm_palette()[1]) +
  coord_flip() +
  labs(title = "Folkmängd per län 2024", x = NULL, y = "Tusental")
```

## Diagram

Diagram ritas till en canvas och visas i konsolen. Under varje diagram finns knappar för export till SVG (vektor,
bra för Word och webb), PNG och PDF. Exporten använder samma kod som ritade diagrammet, så ggplot2-diagram blir
skarpa i alla format. Standardstorlek är 7 × 5 tum; PNG exporteras med 150 dpi.

## Paket

Följande paket följer med i appmappen och kan laddas med `library()` utan internet: ggplot2, dplyr, tidyr,
readr, stringr, lubridate, forcats, data.table, haven (SPSS, Stata, SAS), readxl, writexl, nanoparquet (Parquet),
svglite, jsonlite, RSQLite, DBI och knitr, samt deras beroenden (bland annat tibble, purrr, rlang, cli, stringi).
`library(paket)` installerar paketet från det inbyggda repot första gången det används.

Andra CRAN-paket kan inte installeras eftersom appen inte hämtar något från internet. Behöver du fler paket:
skriv ett ärende så kan de läggas till i nästa utgåva.

## Hur data flyttas mellan appen och R

Datamängderna är SQLite-filer. När du kör kod kopierar appen de datamängder som koden refererar med `dm_read()`
till R:s virtuella filsystem under `/data`, tillsammans med ett index. `dm_read()` läser filen med RSQLite och
återställer kolumntyperna från tabellen `_columns`. `dm_write()` skriver en ny SQLite-fil i `/data/out` som appen
hämtar och lägger till i arbetsytan när kommandot är klart. Vill du använda RSQLite direkt går det bra:
`DBI::dbConnect(RSQLite::SQLite(), "/data/<id>.sqlite")` där id visas av `dm_list()`.

Datamängder större än 50 MB speglas bara när de refereras i koden.

## Begränsningar

- R-kod kan inte avbrytas när den körs (webbläsaren saknar den funktionen när appen öppnas från en mapp). Om
  något hänger sig: *Starta om R*. Sparade skript påverkas inte, men objekt i R-sessionen försvinner.
- Minnet begränsas av webbläsaren och WebAssembly; håll datamängder under några hundra megabyte i R.
- Inmatning under körning (`readline()`, `menu()`) fungerar inte.
- Grafikfönster, systemkommandon, nätverksanrop och filer utanför det virtuella filsystemet är inte tillgängliga.
- Hjälpsidor finns med: `?dplyr::mutate` skriver ut hjälptexten i konsolen.
