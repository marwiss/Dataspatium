# R in Dataspatium

*Analyse* mode contains an R console. R runs in the browser with WebR (R 4.5), entirely without installation.
Everything you need is in the app folder: R, a selection of packages and Dataspatium's helper functions.

## Getting started

1. Open *Analyse*. R starts automatically; it takes a couple of seconds the first time.
2. Write code in the editor and press Ctrl+Enter (Cmd+Enter on a Mac). The whole script runs; if text is selected,
   only the selection runs. Output, messages, errors and charts are shown below the editor.
3. Save scripts with *Save script*. Saved scripts are in the panel on the left and come along in backups.

## Dataspatium's functions

| Function | Does |
|---|---|
| `dm_list()` | Shows the datasets in the session: name, short name, folder, rows, columns, changed, id. |
| `dm_read("shortname")` | Reads a dataset as a `data.frame` with the right types: dates become `Date`, date and time `POSIXct`, yes/no `logical`, integers `integer`. The argument is preferably the short name (for example `dm_read("befolkning_2024")`, which is what the button *Insert dm_read()* writes) but can also be the id, the exact name, the name regardless of case or an unambiguous prefix; `dm_list()` shows the short names. If the dataset is in a folder, `dm_read("Folder/Name")` and `dm_read("Folder/shortname")` work too. |
| `dm_read("shortname", columns = c("a", "b"), where = "a > 10", n = 1000)` | Reads only some columns, rows meeting an SQL condition, or a limited number of rows. |
| `attr(df$column, "label")`, `"description"`, `"unit"` | The column's label, description and unit from the app come along as attributes (when set); `dm_write()` takes them back, or through the arguments `labels`, `descriptions` and `units`. |
| `dm_value_labels(x, c("Man" = 1, "Woman" = 2), to = "labels")` | Value labels. A column with codes and labels becomes `haven::labelled` in `dm_read()` (a column that already holds the labels as text keeps the codes in the attribute `value_labels`), and `dm_write()` keeps them. `dm_value_labels()` sets labels (`to = NULL`), swaps codes for labels (`"labels"`) or back (`"codes"`); without labels they are removed. |
| `dm_write(df, "New name", description = "…")` | Sends a `data.frame` to the app as a new dataset. It appears in the list when the command has finished. |
| `theme_dataspatium()` | ggplot2 theme with the app's look. Set automatically when `library(ggplot2)` runs. |
| `dm_palette()` | The app's colour palette (Okabe-Ito, colour-blind safe). `scale_colour_dataspatium()` and `scale_fill_dataspatium()` exist too. |

Example (the bundled example data, whose columns have Swedish names):

```r
df <- dm_read("befolkning_2024")
library(dplyr)
per_lan <- df |>
  group_by(lan) |>
  summarise(folkmangd = sum(folkmangd), kommuner = n()) |>
  arrange(desc(folkmangd))
per_lan
dm_write(per_lan, "Population per county 2024")

library(ggplot2)
ggplot(per_lan, aes(x = reorder(lan, folkmangd), y = folkmangd / 1000)) +
  geom_col(fill = dm_palette()[1]) +
  coord_flip() +
  labs(title = "Population per county 2024", x = NULL, y = "Thousands")
```

## Charts

Charts are drawn to a canvas and shown in the console. Below each chart there are buttons for export to SVG (vector,
good for Word and the web), PNG and PDF. The export uses the same code that drew the chart, so ggplot2 charts are
sharp in every format. The default size is 7 × 5 inches; PNG is exported at 150 dpi.

## Packages

The following packages ship in the app folder and can be loaded with `library()` without internet: ggplot2, dplyr,
tidyr, readr, stringr, lubridate, forcats, data.table, haven (SPSS, Stata, SAS), readxl, writexl, nanoparquet
(Parquet), svglite, jsonlite, RSQLite, DBI and knitr, plus their dependencies (among them tibble, purrr, rlang, cli,
stringi). `library(package)` installs the package from the built-in repository the first time it is used.

Other packages are fetched when needed from webR's package repository (repo.r-wasm.org, more than 20,000 CRAN
packages built for the browser): when the code calls `library()`, `require()` or `package::` for a package outside
the selection, it is fetched with its dependencies before the code runs. The first time, the app asks for permission
to contact the internet for components; the packages are then stored in the browser, remain at the next start and are
shown under *Manage → Workspace → Components*, where they can also be removed. Without a network, or if you say no,
the code gets the usual error that the package is missing. Packages that need system libraries not available in the
browser may be missing from the repository.

## How data moves between the app and R

The datasets are SQLite files. When you run code, the app copies the datasets that the code refers to with
`dm_read()` into R's virtual file system under `/data`, together with an index. `dm_read()` reads the file with
RSQLite and restores the column types from the table `_columns`. `dm_write()` writes a new SQLite file in
`/data/out` that the app picks up and adds to the workspace when the command has finished. If you want to use
RSQLite directly, that works: `DBI::dbConnect(RSQLite::SQLite(), "/data/<id>.sqlite")` where the id is shown by
`dm_list()`.

Datasets larger than 50 MB are mirrored only when they are referred to in the code.

## Language

Messages from `dm_list()`, `dm_read()` and `dm_write()` follow the app's language (Swedish, Danish, Norwegian,
Finnish, Icelandic or English); the column names in `dm_list()`, however, are always the same (`namn`, `kortnamn`, `mapp`,
`rader`, `kolumner`, `ändrad`, `id`) so that scripts work regardless of language.

## Limitations

- When the app is opened from a folder (file://), R code cannot be stopped while it runs. If something hangs:
  *Restart R*. Saved scripts are not affected, but objects in the R session disappear. When the app runs from a web
  server (localhost or https), the button *Stop* stops the code and keeps the session (see [faq.md](faq.md)).
- Memory is limited by the browser and WebAssembly; keep datasets in R below a few hundred megabytes.
- Input during a run (`readline()`, `menu()`) does not work.
- Graphics windows, system commands, network calls and files outside the virtual file system are not available.
- Help pages are included: `?dplyr::mutate` prints the help text in the console.
