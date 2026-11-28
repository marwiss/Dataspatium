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
| Projected coordinates | Converted to WGS 84 by the file's coordinate system, or as SWEREF 99 TM when the file names none (see [Coordinate systems](#coordinate-systems)) |

Datasets with a geometry column or columns named longitude and latitude open as a map at once; for other coordinate
columns (such as `x` and `y`) choose *Show as map* in the table's toolbar.

Geodata can also be fetched straight from open services: *Add geodata source* in Acquire makes a source of a WFS, OGC
API Features or ArcGIS service, and the source *Geodataportalen* finds services in the national catalogue. The answers
get a geometry column and open as maps. See [kallor.md](kallor.md#open-geodata).

Names are not enough. The app also checks the values: a geometry column must hold a geometry, and coordinates must lie in degrees or in a projected system. Columns called only x and y count as coordinates when the values are projected, since small numbers under those names are usually something else. A table with coordinates can be exported as GeoJSON with points.

If the coordinates are in another system than SWEREF 99 TM, you choose it when you import, for example RT 90 or a UTM zone. The app then adds columns in degrees and keeps the originals.

## The map in Process

The map shows the dataset's features in the app's colour. Zoom with the wheel or the buttons, pan by dragging (the scale bar at the bottom left gives the distance in metres), and
click a feature to see its attributes in the inspector; *Edit in the table* takes you to the row in the table. The
toolbar has the background map (none, OpenStreetMap or an [orthophoto](#orthophotos)), *Zoom to all*, *Save as map view* (saves the map with its
layers and current view as a chart in Visualise) and *Show as table*. Everything you do in the table (filter,
correct, remove rows) shows on the map.

The map remembers the background map for each dataset, as do the plan map (with its WMS service and coordinate system) and
the map of the place of a new building: switch to another dataset and back, and the same background map is chosen again, also
after a reload. After a reload a background map from the net is shown only if you gave the consent to background maps for
good, and an orthophoto with a key only when its key is already unlocked; otherwise the map starts without a background map
and asks nothing. A map that came as a file (a viz file, a bundle, a workspace or GitHub) asks for each host of its own image,
WMS and tile addresses, also when background maps are allowed, and the answer is kept per host under Internet access;
OpenStreetMap and the orthophotos are the app's own and ask as before.

Large datasets are drawn on a canvas; 10 000 polygons pan smoothly. More than 50 000 features per layer are not
drawn (the limit can be raised per layer in the map view).

Picture collections with positions have the button *Show on the map*. Click a place and the inspector shows the picture. A table whose rows name pictures shows them the same way. *Use what shows* turns what the map shows right now into a selection that follows to the other modes. In a map view in Visualise, picture collections, plans and rasters (georeferenced images, see [raster.md](raster.md)) can be layers.

### Several datasets on the map

A digital comprehensive plan can be shown together with other geodata: shapefiles, layers from a GeoPackage, KML,
orthophotos and other rasters, tables with coordinates and other plans. While Process shows a map (a table's map, a plan map
or map layers), every other dataset in the list on the left that can be drawn on a map has an eye, *Show on the map*. Click
the eye and the dataset is drawn over the map, and click again to take it off; the dataset itself does not change. Several
datasets can be shown at once.

The eye is beside

- tables with a geometry column or coordinates (imported GeoJSON, shapefile, GeoPackage, KML and GPX files and more), when
  the values are places;
- plans, map layers and rasters with a place, such as an orthophoto saved as a raster.

The map's own dataset and datasets without places have no eye, and there are no eyes while the table shows.

How they show:

- Rasters and orthophotos lie under every feature and above the background map.
- Each dataset is a group of its own under *More datasets on the map* in the inspector, with its own colour from the app's
  palette and its own symbols, and has its layers in the legend. The layers are shown and hidden as in the plan view (*Show
  all*, *Hide all*, *Show only this*). On a table's map, the map's own dataset is the first group.
- A plan keeps Boverket's colours where the plan gives them.
- The map zooms to everything shown, and *Zoom to all* does the same.
- Click a feature and the inspector shows its attributes under *Selected feature in* and the dataset's name. *Open the
  dataset* shows it in Process.

The map remembers which datasets are shown over it, for each dataset whose map it is, also after a reload. What is shown are
the workspace's own datasets, so nothing is fetched from the net and nothing is asked when the map opens again or a link is
opened at start. A dataset that is removed leaves the map, and one that changes is drawn again. Large datasets are read and
drawn in rounds, so that the app responds meanwhile; at most 50 000 features are drawn per table and 20 000 per plan or map
layers. A map with several layers to keep, for dashboards and publishing, is made as a map view in Visualise.

## A new map layer

*New map layer* among the sources in Import (under *Create sources*) makes an empty layer to draw in. The form has:

- the name;
- the geometry: points, lines or areas. A layer has one kind of geometry;
- the coordinate system: SWEREF 99 TM unless another is chosen, one of the local SWEREF 99 zones, or WGS 84. The coordinates
  are kept in that system, in metres or degrees;
- the columns, one per line: `species` or `count: integer`, as for *New table*.

The layer is a table with the columns and a geometry column, `geometri`. It opens as a map in Process. *Draw in the layer* in
the toolbar shows the drawing bar, and *Done* closes it:

- *Draw point*, *Draw line* or *Draw area* (the layer's kind) draws with Leaflet-Geoman: click on the map for a point, or click
  the points and finish on the last one (a line), on the first one (an area) or with *Finish the shape*;
- click a feature to change its values (*Save*), *Edit the shape* (drag the corners), *Move* (drag the whole feature, a point
  too; *Save the shape*) or *Remove the feature*;
- every change is a step in the dataset's log: a new feature, a new shape or place, a changed value and a removed feature are
  undone with *Undo* in the drawing bar, one at a time.

The values can also be filled in in the table. The drawing tools apply to layers made with *New map layer*. The layer needs
the tier BIM and GIS, as the map view does.

## Map views in Visualise

*New chart → Map* creates a map view with the selected dataset as its first layer. The settings on the left:

- **Background map**: none (default), OpenStreetMap, an [orthophoto](#orthophotos), or your own map server with an address template such as
  `https://…/{z}/{x}/{y}.png` and an attribution, or a **WMS service** (address, layers, image format and transparency; *Read layers* fetches the
  service's layer list), or **map tiles** from an OGC API – Tiles service (see below). Background maps are fetched from the net and ask for consent the
  first time (the purpose *Background maps* under Manage → Internet access). The address template must be an http(s) address, and the
  attribution of your own map server or a WMS service is shown in the map's corner as plain text.
- **Layers**: add more datasets or the bundled boundaries (counties and municipalities of Sweden, Denmark, Norway and
  Finland), a **WMS layer** (images from a map service drawn under the features with a chosen opacity; it has no
  legend entry and is left out of export to SVG, PNG and PDF) or **map tiles** from OGC API – Tiles, drawn the same
  way. Every layer has a name, visibility, order, colour, fill, line width and point size, geometry or coordinate
  columns, colour by column (categories with the app's palette or classes with a sequential scale, number of classes),
  a label (shown as plain text when the pointer rests on a feature) and a maximum number of features. A map view that comes from
  elsewhere (an imported chart file, a package, a dashboard) keeps only colours that are colours and numbers that are numbers; anything
  else is drawn in the app's colours.
- **View**: *Save current view* locks the map's centre and zoom; otherwise the map fits the layers. The legend and the
  height can be changed.

**Map tiles from OGC API – Tiles** (for example GeoServer, ldproxy or pygeoapi): choose *Map tiles (OGC API – Tiles)* as
background map or under *Add layer*. Give the service's landing page (a collection's address works too) and press *Read
service*; the app reads the landing page, `/collections` and the service's tile sets after consent to background maps.
Then choose a collection (or the whole service, when it has tiles of its own) and a tile set. The map is drawn in Web
Mercator, so the tile set shown is WebMercatorQuad or another one with the same grid (the app reads its definition under
`/tileMatrixSets`). Tiles are fetched at the zoom levels the service has and enlarged beyond them. Image tiles (PNG, JPEG,
WebP) are shown; vector tiles (Mapbox Vector Tiles) and tile sets in other coordinate systems, such as SWEREF 99 TM, are
listed but cannot be shown, and the dialog says why. The service's attribution is filled in and shown in the map's corner
as plain text. Services that need a login or a key are not supported yet. On a plan shown in its own system the background
can only come from a WMS service.

The inspector shows the legend and the feature you clicked. A map view exports to SVG, PNG and PDF, runs in batch per
group, becomes PowerPoint and can be placed in document templates with `{{diagram "Name"}}`. Exports draw the layers
without the background map. In dashboards, presentations and published HTML the map is interactive; published HTML
gets Leaflet embedded and the features as GeoJSON, and the background map is then fetched by the reader's browser.

## Orthophotos

An orthophoto is an aerial photograph corrected so that it lies like a map. Four open orthophotos are in the choice of background map
in Process, in the map views in Visualise, on the plan map and under the place of a new building (see [cad-bim.md](cad-bim.md)):

| Orthophoto | Provider and service | Coordinate systems | Licence and attribution | Key |
|---|---|---|---|---|
| Denmark: GeoDanmark ortofoto forår | Klimadatastyrelsen, WMS at `wms.datafordeler.dk` | Web Mercator, ETRS89 / UTM 32N (25832) | CC BY 4.0, "GeoDanmark ortofoto forår © Klimadatastyrelsen" | Free API key from Datafordeleren: create a user with your e-mail address at portal.datafordeler.dk, then an API key (valid for two years) |
| Finland: Ortokuva | Maanmittauslaitos, WMTS at `avoin-karttakuva.maanmittauslaitos.fi` | Web Mercator | CC BY 4.0, "Ortokuva © Maanmittauslaitos" | Free API key from Maanmittauslaitos: create an account in Oma tili (omatili.maanmittauslaitos.fi), then a new API key |
| Iceland: Grunnkort – Loftmynd | Náttúrufræðistofnun, WMS at `gis.natt.is` | Web Mercator, ISN93 (3057) | CC BY 4.0, "Grunnkort – Loftmynd © Náttúrufræðistofnun" | None |
| Sweden: Ortofoto (STAC) | Lantmäteriet, cloud-optimised GeoTIFF files in the STAC catalogue at `api.lantmateriet.se/stac-bild`, the files at `dl1.lantmateriet.se` | Web Mercator (converted), SWEREF 99 TM (3006) | CC BY 4.0, "Ortofoto © Lantmäteriet (year)", processed for the map | Consumer key and consumer secret from a free account in Geotorget (geotorget.lantmateriet.se) in which Ortofoto Nedladdning has been ordered; the same key as for the height model |

- The attribution and the licence stand in the corner of the map as long as the orthophoto is shown.
- The images are fetched only when you choose an orthophoto, after consent for *Background maps*; the question names the service's host.
- When an orthophoto needs a key, the app asks for it when you choose it. The key holds for the session or is saved encrypted with a
  passphrase like the app's other keys, goes only to its own service in the addresses of the images, and is never saved in the map view.
  Published HTML includes only orthophotos that need no key.
- On the plan map in the plan's own coordinate system, the orthophotos whose service offers that system are listed (Denmark in UTM 32N,
  Iceland in ISN93).
- Iceland's mosaic does not yet cover the whole country and grows every year. Finland's open service gives the images up to zoom level 16
  and enlarges them beyond it.
- Norway has no open orthophoto service: Norge i bilder is open only to the members of Norge digitalt. Sweden has no open service with
  tiles (Lantmäteriet's Ortofoto Visning carries a licence fee), but Lantmäteriet's orthophotos are open data as files, and the app
  reads those for one view at a time (below).

### Sweden: Lantmäteriet's orthophotos

- Choose *Orthophoto – Lantmäteriet (STAC)*. It is in the choice of background map in Process, in the map views in Visualise, on the
  plan map (in Web Mercator or SWEREF 99 TM) and, when the place is in Sweden, under the place of a new building.
- The app searches Lantmäteriet's image catalogue (STAC, the collections `orto-<area>-<year>`) for the newest colour images over what
  the map shows and reads only the part it needs from the files. The files are squares of 2.5 × 2.5 km in SWEREF 99 TM with 16 cm per
  pixel since 2019 (25 or 50 cm before); a larger view is read from a coarser overview in the file. Where the newest flight ends, the
  next newest fills in.
- The image holds for the view you fetched it for, at most 1 km² (for the place of a new building, the place and 250 m around it). Its
  longest side is at most 2,048 pixels and never finer than the file. When you move the map, the button *Fetch orthophoto for the view*
  fetches the image for the new view; a map drawn again over the same view uses the image already fetched. A larger view gives a message
  to zoom in.
- On a map in Web Mercator the image is converted pixel by pixel from SWEREF 99 TM, so that it lies right (less than a pixel off); on
  the plan map in SWEREF 99 TM it lies as in the file.
- The files need a key: the consumer key and consumer secret of a free account in Geotorget in which the product Ortofoto Nedladdning
  has been ordered (Lantmäteriet reviews the order, and its terms must be accepted). It is the same key that the source *Lantmäteriet
  geodata with a key (STAC)* and the height model use; when it is missing, the app asks for it when you choose the orthophoto, with a
  link to Geotorget. With the key the app gets an access token from `apimanager.lantmateriet.se`, and the token goes only to
  `dl1.lantmateriet.se`. The search in the catalogue needs no key.
- If `dl1.lantmateriet.se` does not accept the token (the answer 401), the app asks once for your Geotorget login, which Lantmäteriet
  also accepts for the download: your user name and password, or for an organisation the system account that has ordered Ortofoto
  Nedladdning. You enter it in the same key panel under *Login for the file server*. It holds for the session or is saved encrypted with
  the key, and it goes only to `dl1.lantmateriet.se`, as a Basic login. If you cancel, the app does not ask again during the session;
  the message then has the button *Enter login*.
- Nothing is fetched until you choose the orthophoto or press the button. Then the app asks once for consent to *API fetches* and names
  the hosts. A saved map view fetches nothing when it is opened; it shows the button.
- The attribution in the corner of the map follows Lantmäteriet's terms: "Ortofoto © Lantmäteriet (year), processed for the map (CC BY
  4.0)". The image is not included in export (SVG, PNG, PDF), saved map views or published HTML.
- *Save the orthophoto* beside the button saves the image shown as a dataset of the kind raster, with the attribution and the licence
  but without the key. Nothing is fetched again, and the raster is then shown without the net, for example under the place of a new
  building. See [raster.md](raster.md#save-the-orthophoto).
- The tiles are decoded, put together and converted in a thread of their own (a worker), so that the page does not freeze. The page
  fetches only the bytes the thread asks for, with the same key and consent, and receives the finished image; the key and the login
  stay on the page. A view of 1 km² takes a few seconds.

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

## Map layers: a GeoPackage with all its layers

A GeoPackage with several layers can be imported whole as one dataset of the kind *map layers*. Choose **The whole
GeoPackage as one dataset (layers chosen afterwards)** in Import, instead of one table. This works for any GeoPackage, not
only plans. A GeoPackage in the ÖP model still becomes a plan with the choice *The whole comprehensive plan as a plan*;
switched off, both other choices are there.

The dataset has one object per row: `lager` (the table in the file), `fil`, `objektid` (the object's id in its layer),
`geometrityp`, `geometri` (GeoJSON in WGS 84), `egenskaper` (all the object's attributes as JSON) and `ordning`. The layers
are the tables with the `data_type` *features* in `gpkg_contents`, with their names from there; value lists and other
attribute tables are no layers. Empty layers are left out, but counted in the dataset's facts in Manage. The original file
is kept in the dataset. Which layers are shown on the map is chosen afterwards.

In Process every layer
is drawn on the same map, each with its symbol, and under *Layers* in the inspector they are listed per file: show and hide them
one by one, all at once or just one (*Show only this*). The legend shows the layers that show. The list, the symbols and the
legend are the same as in the plan view, see [Plans](planer.md#the-layers). Click a feature and the inspector shows its
attributes. Which layers show is kept per dataset, and the table is one button away.

## QGIS projects

Drop a project file (`.qgs` or `.qgz`) in Import, preferably together with the data files (GeoPackage, GeoJSON,
Shapefile as ZIP). Dataspatium reads the layer order, visibility and symbols (single symbol, categories or classes
with their colours, line widths and point sizes) and matches every layer to a dataset with the same file name (and
layer name for GeoPackage); bundled files that are missing are imported first. The result is a map view in Visualise.
Raster layers, labels, effects and rule-based symbols beyond the first rule are left out.

## Coordinate systems

A GeoPackage file, a shapefile (with `.prj`) and a GeoJSON file with `crs` name their coordinate system. The app uses it
when the map is drawn, when spatial search looks for places and when the dataset is exported with geometry; the
coordinates in the table stay as the file has them. When a file names no system, projected coordinates are taken as
SWEREF 99 TM. The app converts these systems:

| System | EPSG |
|---|---|
| SWEREF 99 TM and its twelve local zones (SWEREF 99 12 00 to 23 15) | 3006, 3007–3018 |
| RT 90 2.5 gon V, by Lantmäteriet's direct projection | 3021 |
| ETRS89 and WGS 84 / UTM 32–35 (Denmark, Norway, Finland) | 25832–25835, 32632–32635 |
| ETRS-TM35FIN and the Finnish GK zones | 3067, 3873–3885 |
| ISN93 / Lambert 1993 (Iceland) | 3057 |
| Web Mercator | 3857 |
| WGS 84 and ETRS89 in degrees | 4326, 4258 |

The conversion agrees with PROJ (which QGIS uses) within a millimetre; RT 90 2.5 gon V within two decimetres, since the
direct projection is a simplification. When a file names another system, for example RT 90 in another zone or an old
local municipal system, Import says so and the map does not draw the places rather than drawing them in the wrong place;
convert the file to SWEREF 99 first, for example in QGIS. The maps here are drawn in Web Mercator with north up; a plan can
also be shown in its own system (see [planer.md](planer.md#coordinate-and-height-systems)).

## Limitations

- Background maps and published HTML with a background map need the net; the app itself makes no requests without
  consent.
- Coordinate systems: those listed under [Coordinate systems](#coordinate-systems). Others must be converted before import (in QGIS, for
  example); the app says so and does not draw them.
- Exports draw the layers, not the background map, WMS layers or map tiles.
- Rasters over a plan map in the plan's own coordinate system are not shown; they are drawn in Web Mercator only.
- Map tiles from OGC API – Tiles are shown only as images in Web Mercator; vector tiles need a library the app does not have.
- Buffers and overlays are planar computations on WGS 84 coordinates through Turf; at kilometre scale in the Nordic
  countries the error is small, for very large areas noticeable.
