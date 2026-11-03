# Visualise

Visualise mode turns datasets into charts with three engines that all use the app's palette, font and number
format: a chart builder (Vega-Lite), ready-made D3 templates and R scripts (ggplot2). Charts are saved in the
workspace, can be exported as SVG, PNG and PDF, shared as files and created in batch per group.

## Create a chart

1. Choose a dataset in the object panel and press **New chart**.
2. Choose an engine: **Chart builder**, **D3 template** or **R script**.
3. Give the chart a name in the title field and press **Save**. Saved charts are listed under Charts in the object
   panel and in the gallery.

The preview updates as you make changes. Below the chart it says how many rows were used; large datasets are
aggregated in SQL when the chart only needs sums, means or counts, otherwise the number of rows is limited (default
50,000, changed under More options).

## The chart builder (Vega-Lite)

| Chart type | Used for |
|---|---|
| Bars, Horizontal bars | Comparing categories, with optional colour split and stacking |
| Line, Area | Development over time or ordered categories |
| Points | Relationship between two numbers, colour and size as extra dimensions |
| Histogram | Distribution of a number in bins |
| Heat map | Two categories with a value as colour |
| Box plot | Spread per category |
| Pie | Shares of a whole (few categories) |
| Map | Areas coloured by a value (choropleth map) from a geometry column, see *Maps* below |
| Point map | Points from longitude and latitude (or SWEREF 99 TM) with size and colour by values, over municipality or county boundaries |

For each channel (X, Y, Colour, Size, Small multiples) you choose a column, how it should be interpreted (number,
category, ordered category, time), calculation (sum, mean, median, minimum, maximum, count, distinct count),
sorting, time unit and axis title. Other settings: title and subtitle, number format, height, legend position,
stacking (stacked, percent, overlapping), value labels on bars and points on lines. **Filters** limit the rows with
conditions on columns. Under **More options** there are the row limit, colour scale (sequential or diverging) and
**Custom Vega-Lite specification**: the JSON specification can be edited directly for anything the builder does not
cover; data is inserted from the dataset when the chart is rendered.

The chart is saved as the builder's state (or the custom specification) together with the dataset's name and short
name, so it can be recreated on new data with the same columns.

### Axes and lines

The **Axes and lines** section (all chart types except pie and maps) controls the axes and adds lines. Empty fields
give automatic values.

| Setting | What it does |
|---|---|
| Value axis minimum and maximum | Fixed limits for the value axis (Y, or X in horizontal bars), for example 0–100 for percentages or the same scale in several charts. Whatever falls outside the limits is clipped |
| X axis minimum and maximum | Shown when the X axis is a number (points and lines), for example to zoom in on an interval |
| Value axis scale | Linear, logarithmic (for values spanning several powers of ten; requires positive values) or square root |
| Start the value axis at zero | On by default; turn it off to let the axis start near the smallest value, for example for temperatures |
| Label angle | Automatic, 0°, 45° or 90° for categories with long names |
| Gridlines | The grid behind the chart, on by default |
| Reference line at value | A dashed line at a value on the value axis, for example a target or a national average, with optional text |
| Trend line | Points and lines with a number on the X axis: straight line (linear regression) or smoothed curve (loess), one per colour group |
| Opacity | How opaque points, areas and bars are (0.05–1), for example for many overlapping points |

Reference and trend lines are not drawn in charts with small multiples. The settings are saved with the chart and
travel with shared chart files and batch runs.

## D3 templates

- **Ranking**: one row per category sorted by value, with a dot and a line. Choose category, value, calculation,
  number and order.
- **Slope chart**: two periods per category with a line between them; green lines increase, red decrease.
- **Population pyramid**: groups (ages) as bars in two directions, for example women and men.

The templates are written in D3 with the app's style module and produce vector graphics that are exported unchanged.

## R scripts

The script runs in the R session with the dataset loaded as `df` (read by its short name). Draw with ggplot2 or base
graphics; `theme_dataspatium()` and `dm_palette()` give the app's look. The latest chart is shown and saved with the
script. Export goes through R (svglite for SVG, `png()` and `pdf()`), and batch runs run the script once per group
with `df` filtered. Ctrl+Enter runs the script.

## Export

**Export** opens a dialog with format (PNG, SVG, PDF, PowerPoint), width, height, scale for PNG and file name. PNG is
drawn in the browser with the app's font. SVG contains the font embedded so that the file looks the same on other
computers. PDF is vector graphics (jsPDF and svg2pdf.js); text is set in the PDF standard font Helvetica. PowerPoint
(pptx, through PptxGenJS) gives a presentation with a title slide and the chart as a high-resolution image; in Export
mode there is also **All charts as PowerPoint**, one slide per saved chart. Charts can also be exported from Export
mode, where all saved charts are listed.

## Batch per group

**Batch per group** creates the chart once per value in a grouping column (for example each municipality or year),
filtered on the value and with the value in the title, and packs all files into a ZIP together with `manifest.json`.
Choose column, format (one or more), file name pattern (`{diagram}` and `{grupp}` are replaced by the chart name and
the group value), width and the maximum number of groups. The run can be cancelled. Groups that fail are listed in
the manifest. The PowerPoint format gives a single presentation with one slide per group instead of a ZIP.

## Gallery and panel

**Gallery** shows all saved charts as cards with thumbnail, dataset and time. Choose the number of columns, and press
**Render all (panel)** to draw the charts live side by side. From here charts are opened, exported and deleted.

## Maps

Two chart types draw maps, both without a map server: **Map** (choropleth: areas coloured by a value) and **Point
map** (points at coordinates, with size and colour by values). SCB's municipality and county boundaries for Sweden
ship with the app, so a map of Sweden's municipalities or counties needs no download. Boundaries for other countries
are imported from GeoJSON, shapefile or GeoPackage.

![Choropleth map of population per municipality and point map of measuring stations in a dashboard](../images/kartor.png)

### Choropleth map (Map)

1. Get the boundaries: click **Swedish municipality boundaries (SCB)** or **Swedish county boundaries (SCB)** in Import. They become
   datasets with municipality or county code, name and a geometry column (`geometry`, GeoJSON in longitude and
   latitude). Your own boundaries are imported from GeoJSON, shapefile (for example SCB's *Digitala gränser* in
   SWEREF 99 TM; simplify with a tolerance of 100 metres) or GeoPackage.
2. Join the values to the boundaries in Process (*Join*) on the municipality or county code, so that the dataset has
   both `geometry` and the value to colour. Alternatively, the values were already imported together with the
   geometry.
3. Choose *Map* in the chart builder. The geometry column is found automatically (the column `geometry`), the label
   is a text column shown when you point at an area, and the value controls the colour with the app's sequential
   scale (choose diverging under *More options* for deviations around a midpoint).

The geometry column may contain GeoJSON or WKT (`POLYGON((...))`, `POINT(...)` and others, also with a `SRID=...;`
prefix), so that exports from GeoPackage, PostGIS and spreadsheets work directly.

### Point map

Choose *Point map* for a dataset with coordinates, for example weather stations or addresses with longitude and
latitude. The columns are found by name (`longitude`/`latitude`, `lon`/`lat`, `x`/`y`, `öst`/`norr`) and can be
changed. Coordinates in metres (SWEREF 99 TM) are recognised and converted to longitude and latitude. **Size** and
**Colour** take value columns (or a category for the colour), **Label** is shown when you point at a point and
**Background** chooses county boundaries, municipality boundaries or no background. If the dataset has areas instead
of points (for example municipalities), *Process > Geodata > Centroid from geometry* gives longitude and latitude for
each area, so that values can be drawn as bubbles per municipality.

### Projection and boundaries

The projection is chosen from the coordinates: metres (SWEREF 99 TM) are drawn as they are, longitude and latitude
within Europe through a transverse Mercator around 15° east (the same look as SWEREF 99 TM) and others through
Mercator. The bundled boundaries are SCB's simplified municipality and county boundaries for thematic maps (CC0,
version February 2026), converted to longitude and latitude; they are not intended for exact boundary work (see
`presets/geo/KALLA.md`). Maps are exported, shared, placed in dashboards and run in batch like every other chart in
the builder; filters in dashboards work on maps too. A dataset with geometry can be exported as GeoJSON from Export.

## Dashboards

A dashboard is a named selection of saved charts in a grid with shared filters. Create one with **New dashboard** in
the object panel, give it a name and click **Add chart** to choose among the saved charts. Each card can be made
wider (one, two or three columns), moved up or down, opened in the builder or removed from the dashboard; the number
of grid columns and a description are set in the properties panel. All changes are saved automatically.

**Filters** shows the columns that exist in every dataset the dashboard's charts use (text, integer, date and
yes/no). Each chosen filter becomes a selector above the charts, and the choice applies to all Vega and D3 charts at
once (R charts are shown as saved images). The filters are added to the charts' own filters.

The dashboard is exported as standalone **HTML** (the charts as embedded SVG, with the active filters stated), as
**PowerPoint** (title slide plus one slide per chart) or shared as `*.dash.json`, a file that contains the charts'
definitions. At import the charts are linked to existing charts with the same name and dataset; those missing are
recreated from the file. The backup and the portable folder contain all dashboards. Dashboards can also be opened
through the command palette (Ctrl+K) and exported from Export mode.

## Sharing charts

**Export configuration** downloads the chart as `*.viz.json` without data. Another user adds the file with **Import
chart (file)**; the chart is linked to a dataset with the same short name or name in that workspace. The workspace
backup (Manage) contains all charts as such files.

## Limitations

- The charts live in the browser; very large datasets without aggregation are limited to the row limit.
- PDF uses Helvetica, not Inter, for text.
- R charts require the R session to be started and are therefore exported only from Visualise.
- The bundled municipality and county boundaries are SCB's simplified boundaries for thematic maps, not exact
  boundaries; fetch exact boundaries from Lantmäteriet and import them as GeoPackage or shapefile.
- PowerPoint export uses images (PNG) of the charts, not editable PowerPoint charts.
