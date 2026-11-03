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
| `dm_list()` | Visar datamängderna i sessionen: namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("kortnamn")` | Läser in en datamängd som `data.frame` med rätt typer: datum blir `Date`, datum och tid `POSIXct`, ja/nej `logical`, heltal `integer`. Argumentet är helst kortnamnet (till exempel `dm_read("befolkning_2024")`, det som knappen *Infoga dm_read()* skriver) men kan också vara id, exakt namn, namn oavsett skiftläge eller ett entydigt prefix; `dm_list()` visar kortnamnen. Ligger datamängden i en mapp går också `dm_read("Mapp/Namn")` och `dm_read("Mapp/kortnamn")`. |
| `dm_read("Namn", columns = c("a", "b"), where = "a > 10", n = 1000)` | Läser bara vissa kolumner, rader som uppfyller ett SQL-villkor, eller ett begränsat antal rader. |
| `attr(df$kolumn, "label")`, `"description"`, `"unit"` | Kolumnens etikett, beskrivning och enhet från appen följer med som attribut (när de är satta); `dm_write()` tar dem tillbaka, eller via argumenten `labels`, `descriptions` och `units`. |
| `dm_value_labels(x, c("Man" = 1, "Kvinna" = 2), to = "labels")` | Värdeetiketter. En kolumn med koder och etiketter blir `haven::labelled` i `dm_read()` (en kolumn som redan har etiketterna som text behåller koderna i attributet `value_labels`), och `dm_write()` sparar dem. `dm_value_labels()` sätter etiketter (`to = NULL`), byter koder mot etiketter (`"labels"`) eller tillbaka (`"codes"`); utan etiketter tas de bort. |
| `dm_write(df, "Nytt namn", description = "…")` | Skickar en `data.frame` till appen som en ny datamängd. Den dyker upp i listan när kommandot är klart. |
| `theme_dataspatium()` | ggplot2-tema med appens utseende. Sätts automatiskt när `library(ggplot2)` körs. |
| `dm_palette()` | Appens färgpalett (Okabe-Ito, färgblindsäker). `scale_colour_dataspatium()` och `scale_fill_dataspatium()` finns också. |

Exempel:

```r
df <- dm_read("befolkning_2024")
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

Andra paket hämtas vid behov från webR:s paketförråd (repo.r-wasm.org, över 20 000 CRAN-paket byggda för
webbläsaren): anropar koden `library()`, `require()` eller `paket::` för ett paket utanför urvalet hämtas det med
sina beroenden innan koden körs. Första gången frågar appen om lov att kontakta internet för komponenter; sedan
sparas paketen i webbläsaren, finns kvar vid nästa start och visas under *Hantera → Arbetsyta → Komponenter*, där
de också kan tas bort. Utan nätverk, eller om du svarar nej, får koden det vanliga felet att paketet saknas. Paket
som kräver systembibliotek som inte finns i webbläsaren kan saknas i förrådet.

## Hur data flyttas mellan appen och R

Datamängderna är SQLite-filer. När du kör kod kopierar appen de datamängder som koden refererar med `dm_read()`
till R:s virtuella filsystem under `/data`, tillsammans med ett index. `dm_read()` läser filen med RSQLite och
återställer kolumntyperna från tabellen `_columns`. `dm_write()` skriver en ny SQLite-fil i `/data/out` som appen
hämtar och lägger till i arbetsytan när kommandot är klart. Vill du använda RSQLite direkt går det bra:
`DBI::dbConnect(RSQLite::SQLite(), "/data/<id>.sqlite")` där id visas av `dm_list()`.

Datamängder större än 50 MB speglas bara när de refereras i koden.

## Språk

Meddelanden från `dm_list()`, `dm_read()` och `dm_write()` följer appens språk (svenska, danska, norska, finska,
isländska eller engelska); kolumnnamnen i `dm_list()` är däremot alltid desamma (`namn`, `kortnamn`, `mapp`, `rader`,
`kolumner`, `ändrad`, `id`) så att skript fungerar oavsett språk.

## Begränsningar

- När appen öppnas från en mapp (file://) kan R-kod inte avbrytas medan den körs. Om något hänger sig: *Starta om R*.
  Sparade skript påverkas inte, men objekt i R-sessionen försvinner. Körs appen från en webbserver (localhost eller
  https) finns knappen *Avbryt*, som stoppar koden och behåller sessionen (se [faq.md](faq.md)).
- Minnet begränsas av webbläsaren och WebAssembly; håll datamängder under några hundra megabyte i R.
- Inmatning under körning (`readline()`, `menu()`) fungerar inte.
- Grafikfönster, systemkommandon, nätverksanrop och filer utanför det virtuella filsystemet är inte tillgängliga.
- Hjälpsidor finns med: `?dplyr::mutate` skriver ut hjälptexten i konsolen.
