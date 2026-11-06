# Python in Dataspatium

The *Analyse* mode has a Python console next to the R console. Python runs in the browser with Pyodide (Python 3.13),
with nothing to install. Unlike R, Python does not ship in the app folder: the runtime and the packages are fetched
from jsDelivr the first time you use them, after you allow it, and are then kept in the browser as components.

## Getting started

1. Open *Analyse* and the *Python* tab. Press *Start Python* or *Run*. The first time, the app asks for permission to
   fetch components and downloads Python with numpy and pandas (about 22 MB); that takes half a minute on an ordinary
   connection. The next time Python starts in a couple of seconds without the internet.
2. Write code in the editor and press Ctrl+Enter (Cmd+Enter on a Mac). The whole script runs; if text is selected, only
   the selection runs. Output, errors and charts appear below the editor, and the value of the last line is printed
   as in a Python console.
3. Save scripts with *Save script*. Saved scripts are listed in the panel on the left and travel with backups.

## Dataspatium's functions

The functions have the same names as in R and are available directly in the session (`from dataspatium import *` runs
at start).

| Function | Does |
|---|---|
| `dm_list()` | Shows the datasets in the session as a `DataFrame` with the columns namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("shortname")` | Reads a dataset as a pandas `DataFrame` with the right types: dates and date-times become `datetime64`, yes/no `boolean`, integers `int64` (or `Int64` when values are missing), numbers `float64`, text `str`. The argument is preferably the short name (what the *Insert dm_read()* button writes) but can also be the id, the exact name, the name regardless of case or a unique prefix. |
| `dm_read("Name", columns=["a", "b"], where="a > 10", n=1000)` | Reads only certain columns, rows that meet an SQL condition, or a limited number of rows. |
| `df.attrs["dataspatium"]` | The columns' labels, descriptions, units, types and value labels from the app (`labels`, `descriptions`, `units`, `types`, `value_labels`). `dm_write()` takes them back, or through the arguments `labels`, `descriptions` and `units`. |
| `dm_value_labels(df, "sex", {1: "Man", 2: "Woman"}, to="labels")` | Value labels for one column, as a dict from code to label. `to="labels"` replaces codes with labels, `to="codes"` goes back, `to=None` only sets the labels, and `labels=None` removes them. The table is changed in place and `dm_write()` keeps the labels. |
| `dm_write(df, "New name", description="…")` | Sends a `DataFrame` to the app as a new dataset. It appears in the list when the command has finished. Without a name, the variable's name is used. |
| `theme_dataspatium()` | matplotlib style with the app's look and palette. Applied automatically the first time matplotlib is used in the session. |
| `dm_palette()` | The app's colour palette (Okabe-Ito, colour-blind safe) as a list; `dm_palette(n)` gives n colours. |

Example:

```python
df = dm_read("population_2024")
per_county = (df.groupby("county", as_index=False)
    .agg(population=("population", "sum"), municipalities=("municipality", "count"))
    .sort_values("population", ascending=False))
per_county
dm_write(per_county, "Population per county 2024")

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.barh(per_county["county"][::-1], per_county["population"][::-1] / 1000, color=dm_palette()[0])
ax.set_title("Population per county 2024")
ax.set_xlabel("Thousands")
```

### Building models (IFC) with IfcOpenShell

| Function | Does |
|---|---|
| `dm_ifc("model")` | Opens an IFC model (a dataset of kind model) with IfcOpenShell and returns an `ifcopenshell.file`. The wheels are fetched the first time (about 13 MB, after consent). |
| `dm_ifc_elements(model, "IfcWall")` | The elements as a `DataFrame`: guid, typ, namn, beskrivning, objekttyp, tagg, vaning, typnamn, material, id. |
| `dm_ifc_psets(model, "IfcWall", qtos=True)` | The property sets as one wide table, a column per `Set.Property`; `qtos=True` includes the quantity sets. |
| `dm_ifc_tree(model)` | The spatial structure: level, guid, type, name, parent, number of elements. |
| `dm_ifc_validate(model, express=True)` | Findings of the schema check: level, type, id, guid, attribute, message. `express=True` runs the schema's rules too. |
| `dm_ifc_select(model, "IfcWall, Pset_WallCommon.FireRating=EI60")` | Elements by IfcOpenShell's selector language, as `dm_ifc_elements()` lists them. |
| `dm_ifc_geometry(model, "IfcWall")` | Volume, surface and bounding box per element, measured on the geometry (metres). |
| `dm_ifc_set(model, df, key="guid")` | Writes the table's values into the model (attributes and `Set.Property` columns) and returns the number of elements changed. |
| `dm_ifc_write(model, "New name")` | Sends the model to the app as a new model dataset. The original dataset is not changed. |

The whole IfcOpenShell API is available: `model.by_type("IfcWall")`, `ifcopenshell.util.element.get_psets(e)`, `ifcopenshell.api` and more. The step *Python on the model* in Process runs the same kind of code as a function `step(model)` and makes the result a new version of the dataset; see [CAD and BIM](cad-bim.md).

## Charts

matplotlib draws without a screen (Agg) and every open figure is shown in the console as SVG when the command has
finished; the figures are then closed, so a new command starts with a clean slate. Below every chart there are
buttons for export to SVG (vector, good for Word and the web), PNG and PDF, at 7 × 5 inches and 150 dpi for PNG. In
the notebook, charts are saved as PNG.

## Packages

numpy, pandas and micropip are fetched at start. Pyodide has packages built for the browser, more than 350 of
them: matplotlib, scipy, statsmodels, scikit-learn, networkx, shapely, geopandas, sympy, pillow, lxml, openpyxl, xlrd,
sqlalchemy, pyarrow, duckdb, bokeh, altair and others. When the code imports a package that is not in the session, the
app fetches the wheel with its dependencies before the code runs, checks it against the digest in Pyodide's package
list and keeps it in the browser; it is listed under *Manage → Workspace → Components*, where components can also be
removed. Pure Python packages from PyPI that are not part of Pyodide are installed with
`import micropip; await micropip.install("package")`; the app asks for permission before Python reaches the internet.

Digests: the runtime files are pinned to Pyodide 0.29.5 with SHA-256 in the app; the packages are checked against
`pyodide-lock.json`, which is in turn pinned by its digest. A file with the wrong digest is not used.

## Code steps in recipes

Process has the action **Python step** (the Code group in the palette): a function `def step(df): ... return df` runs
on the whole table with pandas, and what the function returns becomes the new table, with types from the result.
The step is logged in the recipe with its code, can be undone, replayed on another dataset and travels with the
exported recipe (as comments in the SQL and R code). The *Preview* button runs the function on the first 200 rows
and shows the result's columns and a few rows before you apply. Import what you need in the code; `pd` and `np` are
already there. The matching **R step** takes a function `function(df) { ... }` (see [r-guide.md](r-guide.md)).

## seaborn and plotly

seaborn and plotly are not part of Pyodide's distribution; the app pins their wheels from PyPI with digests and
fetches them as components when the code imports them (`import seaborn as sns`, `import plotly.express as px`).
seaborn draws through matplotlib and is shown like other figures. plotly figures are interactive: `fig.show()`, or
`fig` as the last line, hands the figure to the app, which draws it with plotly.js (fetched as a component the first
time, 4.8 MB) and the app's theme, and exports it to SVG, PNG and PDF. In the notebook, plotly figures are saved as
PNG, with the interactive view kept as long as plotly.js is available.

## Python charts in Visualise

In Visualise a chart can be a **Python script**: the dataset is `df`, and the latest chart (matplotlib or plotly) is
shown and saved with the script. Python charts export to SVG, PNG, PDF and PowerPoint, run in batches per group
(the script runs once per value with `df` filtered) and can be placed in document templates with
`{{diagram "Name"}}`; the same now goes for R charts. In dashboards and published HTML a saved plotly chart is
interactive, other Python and R charts are shown as their saved image.

## How data moves between the app and Python

Datasets are SQLite files. When you run code, the app copies the datasets the code refers to with `dm_read()` into
Python's virtual file system under `/data`, together with an index. `dm_read()` reads the file with the `sqlite3`
module and `pandas.read_sql_query` and restores the column types from the `_columns` table. `dm_write()` writes a new
SQLite file in `/data/out` which the app picks up and adds to the workspace when the command has finished. You can
use `sqlite3` directly: `sqlite3.connect("/data/<id>.sqlite")` where the id is shown by `dm_list()`.

Datasets larger than 50 MB are only mirrored when the code refers to them. Data moves between R and Python through
datasets: `dm_write()` in one language, `dm_read()` in the other.

## Language

Messages from `dm_list()`, `dm_read()` and `dm_write()` follow the app's language (Swedish, Danish, Norwegian,
Finnish, Icelandic or English); the column names in `dm_list()` are always the same, so that scripts work regardless
of language.

## Limitations

- When the app is opened from a folder (file://), Python code cannot be interrupted while it runs. If something hangs:
  *Restart Python*. Saved scripts are not affected, but objects in the session are lost. When the app runs from a web
  server (localhost or https) there is a *Stop* button that stops the code and keeps the session (see [faq.md](faq.md)).
- Memory is limited by the browser and WebAssembly; keep datasets below a few hundred megabytes in Python.
- Input while running (`input()`) does not work, nor do threads, processes or files outside the virtual file system.
  Network calls from Python (for example `micropip` and `pyodide.http`) require that you have allowed components.
- There are no interactive windows; matplotlib draws to SVG and PNG. plotly is drawn with plotly.js in the app and seaborn comes along as a package.
