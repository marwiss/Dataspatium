# Notebook

A notebook mixes text, R code, Python code and SQL in cells that run in order, with the output saved under each cell. It is
the third tab in Analyse mode and is the way from analysis to finished report without leaving the app.

## Create and work

Click the plus sign next to *Notebooks* in the object panel (or choose *New notebook* in the command palette),
give the notebook a name and start in the first cell. A new notebook gets a heading cell, an R cell that reads the
selected dataset by its short name and an SQL cell. The dataset the SQL cells run against is chosen in the
properties panel on the right.

Each cell has a type (Text, R or SQL) that can be changed, buttons to run, move up or down and delete, and a result
area. Ctrl+Enter runs the cell you are in; *Run all* runs the notebook from top to bottom. Cells are added at the
bottom with the buttons *Text*, *R*, *Python* and *SQL*. Everything is saved automatically, output included.

- **Text cells** are written in Markdown (headings with `#`, lists with `-`, `**bold**`, `*italic*`, links and
  tables) and shown formatted below the editing field.
- **R cells** run in the same R session as the R console, so variables live on between cells and runs until R is
  restarted. Printed output, errors, charts and datasets created with `dm_write()` are gathered below the cell.
  Charts are saved as PNG.
- **Python cells** run in the same Python session as the Python console (Python is fetched the first time, see
  [python.md](python.md)). Output, errors, matplotlib charts and datasets from `dm_write()` are collected under the cell.
- **SQL cells** run against the table `data` in the notebook's dataset. SELECT queries show up to 1,000 rows (the
  first 50 in the view); UPDATE, DELETE and other modifying statements are performed as a recipe step in the
  dataset and logged there.

## Export and share

*Export* creates a document from the whole notebook: HTML (standalone page), Word, PDF, Markdown (with figures in a
ZIP when charts are included) or LaTeX (ZIP with `main.tex` and figures). Text cells become body text, code becomes
code blocks (can be left out), tables become tables and charts become images. The same builders are used as for
the document templates (see [dokumentmallar.md](dokumentmallar.md)).

*Share (file)* downloads the notebook as `*.nb.json` with cells and saved output; another user loads the file with
*Import notebook (file)*, and the dataset is linked by its short name or name. Notebooks also travel in the backup,
in bundles and in the portable folder.

## Limitations

- R code cannot be interrupted under file://; use *Restart R* in the R tab if a cell hangs. When the app runs from a
  web server, the button *Stop* in the R tab also stops a running cell.
- Output is stored in the browser together with the notebook. Many large charts make the notebook larger.
- The text editing field has no syntax highlighting for Markdown.
