# R i Dataspatium

Modusen *Analyser* inneholder en R-konsoll. R kjører i nettleseren med WebR (R 4.5), helt uten installasjon. Alt du trenger,
ligger i appmappen: R, et utvalg pakker og Dataspatiums hjelpefunksjoner.

## Kom i gang

1. Åpne *Analyser*. R starter automatisk; det tar et par sekunder første gang.
2. Skriv kode i editoren, og trykk Ctrl+Enter (Cmd+Enter på Mac). Hele skriptet kjøres; er tekst markert, kjøres bare
   markeringen. Utdata, meldinger, feil og diagrammer vises under editoren.
3. Lagre skript med *Lagre skript*. Lagrede skript ligger i panelet til venstre og følger med i sikkerhetskopier.

## Dataspatiums funksjoner

| Funksjon | Gjør |
|---|---|
| `dm_list()` | Viser datasettene i sesjonen: navn, kortnavn, rader, kolonner, endret, id. |
| `dm_read("kortnavn")` | Leser et datasett som `data.frame` med riktige typer: datoer blir `Date`, dato og tid `POSIXct`, ja/nei `logical`, heltall `integer`. Argumentet er helst kortnavnet (for eksempel `dm_read("befolkning_2024")`, som er det knappen *Sett inn dm_read()* skriver), men kan også være id, det nøyaktige navnet, navnet uavhengig av store og små bokstaver eller et entydig prefiks; `dm_list()` viser kortnavnene. |
| `dm_read("kortnavn", columns = c("a", "b"), where = "a > 10", n = 1000)` | Leser bare enkelte kolonner, rader som oppfyller en SQL-betingelse, eller et begrenset antall rader. |
| `attr(df$kolonne, "label")`, `"description"`, `"unit"` | Kolonnens etikett, beskrivelse og enhet fra appen følger med som attributter (når de er satt); `dm_write()` tar dem med tilbake, eller via argumentene `labels`, `descriptions` og `units`. |
| `dm_value_labels(x, c("Mann" = 1, "Kvinne" = 2), to = "labels")` | Verdietiketter. En kolonne med koder og etiketter blir `haven::labelled` i `dm_read()` (en kolonne som allerede har etikettene som tekst, beholder kodene i attributtet `value_labels`), og `dm_write()` lagrer dem. `dm_value_labels()` setter etiketter (`to = NULL`), bytter koder mot etiketter (`"labels"`) eller tilbake (`"codes"`); uten etiketter fjernes de. |
| `dm_write(df, "Nytt navn", description = "…")` | Sender en `data.frame` til appen som nytt datasett. Det dukker opp i listen når kommandoen er ferdig. |
| `theme_dataspatium()` | ggplot2-tema med appens utseende. Settes automatisk når `library(ggplot2)` kjøres. |
| `dm_palette()` | Appens fargepalett (Okabe-Ito, fargeblindvennlig). `scale_colour_dataspatium()` og `scale_fill_dataspatium()` finnes også. |

Eksempel (de medfølgende eksempeldataene, der kolonnene har svenske navn):

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
  labs(title = "Befolkning per län 2024", x = NULL, y = "Tusener")
```

## Diagrammer

Diagrammer tegnes på et lerret og vises i konsollen. Under hvert diagram finnes knapper for eksport til SVG (vektor, bra
for Word og nett), PNG og PDF. Eksporten bruker samme kode som tegnet diagrammet, så ggplot2-diagrammer blir skarpe i alle
formater. Standardstørrelsen er 7 × 5 tommer; PNG eksporteres med 150 dpi.

## Pakker

Følgende pakker følger med i appmappen og kan lastes med `library()` uten internett: ggplot2, dplyr, tidyr, readr, stringr,
lubridate, forcats, data.table, haven (SPSS, Stata, SAS), readxl, writexl, nanoparquet (Parquet), svglite, jsonlite,
RSQLite, DBI og knitr samt avhengighetene deres (blant annet tibble, purrr, rlang, cli, stringi). `library(pakke)`
installerer pakken fra det innebygde arkivet første gang den brukes.

Andre CRAN-pakker kan ikke installeres, fordi appen ikke henter noe fra internett. Trenger du flere pakker, kan du opprette
et issue, så kan de legges til i neste utgivelse.

## Slik flyttes data mellom appen og R

Datasettene er SQLite-filer. Når du kjører kode, kopierer appen datasettene som koden viser til med `dm_read()`, til R sitt
virtuelle filsystem under `/data`, sammen med en indeks. `dm_read()` leser filen med RSQLite og gjenoppretter kolonnetypene
fra tabellen `_columns`. `dm_write()` skriver en ny SQLite-fil i `/data/out` som appen henter og legger til i arbeidsområdet
når kommandoen er ferdig. Vil du bruke RSQLite direkte, går det fint: `DBI::dbConnect(RSQLite::SQLite(), "/data/<id>.sqlite")`,
der id vises av `dm_list()`.

Datasett større enn 50 MB speiles bare når det vises til dem i koden.

## Språk

Meldinger fra `dm_list()`, `dm_read()` og `dm_write()` følger appens språk (svensk, dansk, norsk, finsk, islandsk eller
engelsk); kolonnenavnene i `dm_list()` er derimot alltid de samme (`namn`, `kortnamn`, `rader`, `kolumner`, `ändrad`, `id`),
så skript fungerer uavhengig av språk.

## Begrensninger

- R-kode kan ikke avbrytes mens den kjører (nettleseren mangler den funksjonen når appen åpnes fra en mappe). Hvis noe
  henger: *Start R på nytt*. Lagrede skript påvirkes ikke, men objekter i R-sesjonen forsvinner.
- Minnet begrenses av nettleseren og WebAssembly; hold datasett i R under noen hundre megabyte.
- Inndata under kjøring (`readline()`, `menu()`) fungerer ikke.
- Grafikkvinduer, systemkommandoer, nettverkskall og filer utenfor det virtuelle filsystemet er ikke tilgjengelige.
- Hjelpesider er med: `?dplyr::mutate` skriver hjelpeteksten i konsollen.
