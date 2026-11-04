# Maps

A dataset with geometry or coordinates is a map. In Process it opens as a map to zoom and pan in, in Visualise it
becomes a saved **map view** with several layers for dashboards, presentations and publishing, and in Analyse the tab
**Geo** offers geographic tools without code. Maps are drawn with Leaflet; geometry is computed with Turf. Nothing is
fetched from the net until you choose a background map and give your consent.

## What counts as geodata

| Geodata | Recognised by |
|---|---|
| Geometry column | A text column with GeoJSON or WKT, usually `geometry` (the importers for GeoJSON, Shapefile, GeoPackage, KML, GPX and TopoJSON produce it) |
| Coordinate columns | Two numeric columns for longitude and latitude (`lon`/`lat`, `longitude`/`latitude`, `x`/`y` and others) |
| SWEREF 99 TM | Recognised by the values and converted to WGS 84 when drawn |

Datasets with a geometry column or columns named longitude and latitude open as a map at once; for other coordinate
columns (such as `x` and `y`) choose *Show as map* in the table's toolbar.

Geodata can also be fetched straight from open services: *Add geodata source* in Acquire makes a source of a WFS, OGC
API Features or ArcGIS service, and the source *Geodataportalen* finds services in the national catalogue. The answers
get a geometry column and open as maps. See [kallor.md](kallor.md#open-geodata).

Names are not enough. The app also checks the values: a geometry column must hold a geometry, and coordinates must lie in degrees or in a projected system. Columns called only x and y count as coordinates when the values are projected, since small numbers under those names are usually something else. A table with coordinates can be exported as GeoJSON with points.

## The map in Process

The map shows the dataset's features in the app's colour. Zoom with the wheel or the buttons, pan by dragging, and
click a feature to see its attributes in the inspector; *Edit in the table* takes you to the row in the table. The
toolbar has the background map (none or OpenStreetMap), *Zoom to all*, *Save as map view* (saves the map with its
layers and current view as a chart in Visualise) and *Show as table*. Everything you do in the table (filter,
correct, remove rows) shows on the map.

Large datasets are drawn on a canvas; 10 000 polygons pan smoothly. More than 50 000 features per layer are not
drawn (the limit can be raised per layer in the map view).

## Map views in Visualise

*New chart → Map* creates a map view with the selected dataset as its first layer. The settings on the left:

- **Background map**: none (default), OpenStreetMap, or your own map server with an address template such as
  `https://…/{z}/{x}/{y}.png` and an attribution, or a **WMS service** (address, layers, image format and transparency; *Read layers* fetches the
  service's layer list). Background maps are fetched from the net and ask for consent the
  first time (the purpose *Background maps* under Manage → Internet access).
- **Layers**: add more datasets or the bundled boundaries (counties and municipalities of Sweden, Denmark, Norway and
  Finland), or a **WMS layer** (images from a map service drawn under the features with a chosen opacity; it has no
  legend entry and is left out of export to SVG, PNG and PDF). Every layer has a name, visibility, order, colour, fill, line width and point size, geometry or coordinate
  columns, colour by column (categories with the app's palette or classes with a sequential scale, number of classes),
  a label (shown when the pointer rests on a feature) and a maximum number of features.
- **View**: *Save current view* locks the map's centre and zoom; otherwise the map fits the layers. The legend and the
  height can be changed.

The inspector shows the legend and the feature you clicked. A map view exports to SVG, PNG and PDF, runs in batch per
group, becomes PowerPoint and can be placed in document templates with `{{diagram "Name"}}`. Exports draw the layers
without the background map. In dashboards, presentations and published HTML the map is interactive; published HTML
gets Leaflet embedded and the features as GeoJSON, and the background map is then fetched by the reader's browser.

## Geo tools in Analyse

When a dataset with geometry is selected, Analyse gets the tab **Geo** (after Regex). Every result is a table with a
`geometry` column that can be saved as a dataset with *Create dataset* and opened as a map.

| Tool | What it does |
|---|---|
| Measures | Area (km²), length (km), centroid (longitude, latitude) and extent of every feature |
| Points in areas | Counts points per area (and sums a value column), or gives every point the area's attributes |
| Nearest | For every feature the nearest feature in another dataset with the distance in km |
| Buffer | Zones at a chosen distance in metres around every feature |
| Overlay | Intersection of two area datasets (one feature per overlapping pair with both sets of attributes and the common area) or difference (what remains of the first layer) |
| Dissolve | Merges areas with the same value in a column (or all of them) into one feature with count and area |
| Simplify | Simplifies geometries with a chosen tolerance in metres and shows the number of points before and after |

The tools work in the browser without the net and in chunks so the page stays responsive; very large datasets (tens
of thousands of complex polygons) take time. Measures and coordinate conversion also exist as recipe steps in Process
(the Geodata group).

## QGIS projects

Drop a project file (`.qgs` or `.qgz`) in Import, preferably together with the data files (GeoPackage, GeoJSON,
Shapefile as ZIP). Dataspatium reads the layer order, visibility and symbols (single symbol, categories or classes
with their colours, line widths and point sizes) and matches every layer to a dataset with the same file name (and
layer name for GeoPackage); bundled files that are missing are imported first. The result is a map view in Visualise.
Raster layers, labels, effects and rule-based symbols beyond the first rule are left out.

## Limitations

- Background maps and published HTML with a background map need the net; the app itself makes no requests without
  consent.
- Projections: WGS 84 and SWEREF 99 TM. Other reference systems must be converted before import (in QGIS, for
  example).
- Exports draw the layers, not the background map or WMS layers.
- Buffers and overlays are planar computations on WGS 84 coordinates through Turf; at kilometre scale in the Nordic
  countries the error is small, for very large areas noticeable.
