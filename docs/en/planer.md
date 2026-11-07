# Plans: digital detailed plans and comprehensive plans

Dataspatium opens digital plans as plans: a Swedish detailed development plan (detaljplan) is drawn as a plan map
with Boverket's colours and designations, its provisions are listed and looked up in Boverket's catalogue of plan
provisions (Planbestämmelsekatalogen), and a comprehensive plan (översiktsplan) is shown theme by theme. The plan is
a dataset of kind *plan*: one plan object per row (the plan area and every provision or content object) with
geometry in WGS 84, the plan's facts in the metadata and the original file kept in the dataset. The table is always
one click away.

## Formats read

| Format | Recognised by | Contents |
|---|---|---|
| National specification Detaljplan (Lantmäteriet, version 4.1) | GeoJSON with `feature:mediatyp application/vnd.lm.detaljplan.v4+json` or `feature:typ` (detaljplan, användningsbestämmelse, egenskapsbestämmelse, administrativ bestämmelse; also written without å, ä and ö) | Plan area, provisions with catalogue reference, formulation, values and motive, geometries as areas, lines, points and bodies (with height in RH 2000), decision information (started, adopted, legal force, implementation period, case number) and the plan description's name |
| Reference objects from the national geodata platform | STAC items with `properties.detaljplan` and `properties.planbestammelse` (the answer of Lantmäteriet's detailed-plan API) | The plan's facts, the provisions' formulation, catalogue reference, category and value |
| National specification Översiktsplan (Lantmäteriet, version 2.0, test version 4) | GeoJSON with `feature:mediatyp application/vnd.lm.oversiktsplan.v2+json` or `feature:typ` oversiktsplan, innehallOP, beslutOP | The plan's facts and decision (taken, legal force), content objects with content type, theme by the ÖP catalogue's category, name, specification, plan event, level of connection and links, also content described only in text |
| Boverket's ÖP model (GeoPackage, database model 0.4) | Tables `innehall_op_<theme>_<geometry type>` and `oversiktsplan` | Every content layer as one plan with a theme per layer, the plan's decision (`beslut_op`), links between content and the plan document's sections (bookmarks) |
| Detailed development plan in GeoPackage | The tables `detaljplan`, `bestammelse` and `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` with the national specification's field names | The plan as the planning tool saves it: plan area, areas, lines and points with their provisions, designations, colours, motives and heights, decision information and documents; areas without a provision yet are shown as drawn |

Coordinates in SWEREF 99 TM and the local SWEREF 99 zones (EPSG:3006–3018, read from `koordinatsystemPlan`) as well
as Web Mercator are converted to WGS 84. A GeoJSON file is recognised by its contents, not its extension: drop it in
Acquire and the plan's facts appear with the button *Import*. A GeoPackage in the ÖP model gets the choice *The
whole comprehensive plan as a plan*; switched off, one table at a time is imported as before. A detailed development plan in GeoPackage gets the choice *The whole plan as a plan*. The coordinate system of a GeoPackage is read from the file, also when it is given only by name (for example *SWEREF99 15 00*).

## The plan map in Process

A plan opens as a plan map: use provisions filled with Boverket's colours (housing yellow, centre brown, industry
blue-grey, street light grey, park light green, water blue and so on per the general advice to BFS 2020:5; the shades
are the app's), property provisions as blue dashed outlines, administrative provisions as purple dotted ones, the plan
boundary in black and the designations as labels. Click an object and the inspector shows its facts and what the
catalogue says about the provision: code, type, validity and the catalogue's formulation. Layers are switched on and
off per type, a background map appears after consent, and the buttons give *Plan provisions* (the list as Markdown) and *Show as table*.

A comprehensive plan is drawn per theme: land and water use filled per content type, other themes with one colour
per theme and switchable visibility. The inspector shows the area per land and water use.

Lines (no-exit lines, fences, development directions) and points (for example the height of the ground) are drawn as they are. A provision limited in height is drawn by its footprint, and the inspector shows the height in the plan's height system (RH 2000 in plans to NGP): lower limit, upper limit or both. The inspector also shows the plan's decision (adopted, legal force, appealed, implementation period, case number, type of decision), the plan description's name and the documents, and for the chosen object other facts such as the period of validity, a secondary property boundary, which use provisions a property provision regulates, the level of connection, what the content touches and where in the plan document it is described. Content described only in text, without a place on the map, is listed under *objects without a place on the map* and can be chosen there.

## Coordinate and height systems

Detailed development plans to NGP are made in SWEREF 99 TM or in the municipality's local SWEREF 99 zone with heights in
RH 2000, and the file names both (`koordinatsystemPlan` and `hojdsystem`). Comprehensive plans are usually in SWEREF 99 TM.
The inspector shows the plan's coordinate system and, for a plan with heights, the height system; a GeoPackage file names no
height system, and the inspector then says so.

The plan map is drawn as a web map (Web Mercator with north up, where OpenStreetMap can be the background) or in the plan's
own system: choose it in the toolbar, for example *SWEREF 99 16 30*. The grid's north is then up as on the plan map, and
every object lies at its coordinates. The background can then come from a WMS service that offers the same system: choose
*WMS service* as background map and give the address and layer (*Read layers* fetches the service's layer list and says
when the layer lacks the system). OpenStreetMap exists as a web map only. The background is fetched after consent, like
other background maps.

A plan in a coordinate system the app cannot convert is read with all its objects, but the objects are not drawn, since
they would land in the wrong place: Import and the inspector say which system the file names, and the objects are listed
under *objects without a place on the map*. The app converts SWEREF 99 TM and its twelve local zones, RT 90 2.5 gon V, the Nordic UTM and TM grids, ISN93 and Web
Mercator; the conversion agrees with PROJ (which QGIS uses) within a millimetre, RT 90 within two decimetres.

## Plans from planning tools

Plans drawn in a planning tool are read like all plans of the same kind, whichever tool made them. One example is [Rita Detaljplan and Rita Översiktsplan](https://github.com/ritaplan), plug-ins for QGIS. What they save and deliver opens like this:

| File | Opens as |
|---|---|
| The detailed plan's delivery file to NGP (JSON, Detaljplan 4.1) | Plan map with designations and colours from the catalogue |
| Detailed development plan in GeoPackage with the national specification's field names | Plan map with the plan's own designations and colours, the motives and the heights |
| The comprehensive plan's delivery file to NGP (JSON, Översiktsplan 2.0) | Comprehensive plan per theme with its decision |
| Comprehensive plan in GeoPackage (Boverket's database model 0.4) | Comprehensive plan per theme with decision, links and the plan document's sections |
| Archive package (folder or ZIP file with `metadata/PREMIS.xml`) | The plan from the folder `content` with the documents, and the check of the files |

Drop the file in Import, or fetch it with *From web address* when it is on the web (for example a plan the municipality publishes); a file without an extension is recognised by its content type. An archive package is dropped as a folder or as a ZIP file: the app reads the plan from the folder `content` (the GeoPackage first, else the delivery file), keeps the package's files with the plan and compares each file with its checksum (SHA-256) in `PREMIS.xml`. The inspector shows under *Archive package* whether the files match, which have changed or are missing, and opens the documents (plan map and plan description) in a new tab. A place that points outside the package is not checked and never read.

## The Plan tab in Analyse

A plan gets the tab **Plan** after Regex:

- **Summary**: the plan's facts, the number of objects per type, the state of the catalogue references and the plan's use area.
- **Provisions**: every provision as a table with designation, formulation, category, value, code and catalogue
  state; can be saved as a dataset or downloaded as Markdown. For a comprehensive plan: the contents per theme.
- **Areas**: area per use (sum of the polygons, computed in SWEREF 99 TM) and share of the plan's use area.
- **Catalogue check**: every catalogue reference is looked up in the catalogue: in force, replaced (and by what),
  expired, unknown or missing, and whether the formulation follows the catalogue's template.
- **Search the catalogue**: free-text search among the catalogue's 3,700 provisions filtered by type, use form and
  validity; the result can be saved as a dataset.

## The catalogue of plan provisions

The app ships an embedded copy of Boverket's Planbestämmelsekatalogen (open data; release 20251201) so that lookups,
colours and the catalogue check work without the net. The source must be named: Boverket and
Planbestämmelsekatalogen. The catalogue is also a source in Acquire (*Boverket Planbestämmelsekatalogen*): look up a
provision by its UUID, list releases, colours, use forms, categories and symbols through Boverket's open API. The copy
is refreshed with `python tools/plan_catalog.py` before a new release.

## Limitations

- Boverket's colours are named in the regulations; the shades in the app are its own. Symbol designations (dotted
  land, crossed land and others) are drawn as outlines with the designation, not with Boverket's symbols.
- Provision descriptions, planning materials and decision documents come along only as text (motives) or as facts in
  the plan's metadata; the documents are not fetched.
- Areas are planar computations in SWEREF 99 TM; for plans in local zones the error is negligible.
