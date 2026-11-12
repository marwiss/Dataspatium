# CAD and BIM: building models and drawings

Dataspatium opens building models in IFC and drawings in DXF as a kind of dataset of their own. The model is drawn in 3D,
the building elements become a table, and properties and quantities can be searched, counted and exported. Everything
happens in the browser: the file never leaves the computer. The original file is kept in the dataset and travels with
bundles and backups.

## Opening a model

Drop an `.ifc`, `.ifczip` or `.dxf` file in Import. The facts of the file are shown (schema, project, program, storeys and
counts per type), and *Import* creates the dataset. IFC2X3, IFC4 and IFC4X3 in STEP format are supported. A model of about
50 MB takes around a quarter of a minute to import and then opens in a few seconds.

## Large models from the server

A model too large to read in the browser can be fetched from Dataregium without the IFC file. In the source's file list under
*Import → OpenCDE*, a model has the button **Large model** when the server has the geometry API (`ifc_geometry`). Choose the level
of detail: *The whole geometry* gives the elements' meshes, *Boxes per element* just a box each for a quick overview. The app fetches the
geometry as binary glTF, reads it in a background thread and makes a model dataset with a row per element (id, GlobalId, class, name
and storey from the server's named queries). The geometry is kept with the dataset, so the 3D view, highlighting, selections and issues
work as for a model from a file. Properties and quantities do not come along, and what needs the IFC file, such as the clash check in
the app and the export of the original, is missing; the server's clash test and queries work as usual. The card in Manage shows
*Geometry: From the server*.

## The model in Process

The model opens as a 3D view with a table of the building elements below it. Drag to turn, scroll to zoom towards the
pointer, and drag with the right button or with Shift to move; on a touch screen one finger turns, and two pinch and move.
Double-click an element to turn about that very point. The frame button shows everything shown; the odd object far from the
building is not counted. More ways to look at the model are under [Views and the keyboard](#views-and-the-keyboard).

- **Select**: click an element in the model or a row in the table. The selection follows, and the inspector shows the
  type, storey, material, classification, properties and quantities, and the surface and volume measured on the geometry.
- **Filter**: choose a type or a storey, or search for a name, material or property. The table and the model show the same selection.
- **Show as table**: every column as an ordinary table with all the tools of Process.
- **Save as chart**: the view with its filter and camera angle becomes a chart in Visualise.

The geometry is computed from the original file the first time the model opens in a session, and it is used only for
drawing and measuring. The tables remain even if the computer has no WebGL, and a message then replaces the 3D view.

### Views and the keyboard

- **The view cube** in the corner turns with the model. Click a face to see the model from above, the front, the right, the
  back, the left or below, and the button under the cube to see it from above at an angle. The front view looks along the
  model's Y axis, that is north when the model is drawn with north up. The views show what the filter shows.
- **Orthographic view**: the button with the square switches between perspective and an orthographic view, where elements do
  not shrink with distance. The view from above becomes a plan and the front view an elevation. A chart and a viewpoint keep
  which view it was.
- **Section**: the button with the layers opens the section in the inspector. Drag the sliders for east–west, south–north and
  height to cut away what lies outside a box, or choose a storey under *Section at storey* to see it from its floor up to 1.2 m as
  a plan. *Remove the section* shows everything again. The section goes along with a chart and a viewpoint, and a viewpoint from
  another program shows its section.
- **Zoom to marked** shows the marked elements, and **Show only marked** hides everything else so that you can turn around
  them; click again to show everything.
- **The keyboard** works when the 3D view has focus: click in it or go there with Tab.

| Key | Does |
|---|---|
| Arrows | move the view |
| Ctrl or Shift and the arrows | turn |
| + and − | zoom |
| F | zooms to the marked |
| Home | shows everything |
| 1–7 | from above, front, right, back, left, below, from above at an angle |
| O | switches the orthographic view |

## Issues from a CDE

A model fetched from an OpenCDE server, or any model when such a server is a source, can show its issues: the button
*Issues* in the model view opens a panel in the inspector with the project's BCF topics. Those that point at elements in
this model come first, with their status and the number of elements. Click an issue and the elements are marked in the 3D
view, and the panel shows the description, the snapshot and the comments. The issues are fetched when you ask and are not
stored in the dataset; to count on them, save them as a table in Import. When the issue has a viewpoint with a camera, the view goes there, in perspective or orthographic and with its section.

With the rights for it, you can also write. *New issue* creates an issue on the server with title, type, status and labels
from the project's lists, and the view goes along as the viewpoint: the camera (perspective or orthographic) with the section, a snapshot and the marked elements as components.
In a chosen issue you can write a comment, change the status and add the current view as a new viewpoint. *Save as BCF* gives all
the project's issues with comments, viewpoints and snapshots as a BCF file, which tools without an API can open. A BCF file can
also be read in Import: the issues become a table, comments and components tables beside it.

*Colour by status* gives the elements the colour of their most open issue: red for open, amber for in progress, green for closed,
with a legend under the list. *Save as table* gives the project's issues as a table with one row per issue and element (type, name
and storey come along), which Manage recognises as issues: the card *Issues* shows how they stand and creates the dashboard *Issue
status* with status, type, assignee, priority and month behind shared filters, and the button *Show in the model* goes back to the
panel. The tool *Issues* in the Quantities tab of Analyse counts issues, open issues and elements per status, type, priority,
assignee, element type or storey from such a table, and the SQL starters get queries for the join. *Save as chart* saves the view
with its colours as a model chart, which dashboards, documents and Publish show with a legend.

The model's graph on the server is drawn and queried from *Import*, and the button *IFC-LPG* takes you there, see [grafer.md](grafer.md#ifc-lpg-on-a-dataregium-server).

The graph's model, relations and the queries from Dataspatium's side are in Dataregium's [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/en/ifc-lpg.md).

## The tables

| Table | Contents |
|---|---|
| `data` | One row per building element, room and storey: id, guid, typ (type), kategori (byggdel, rum, struktur), namn (name), beskrivning (description), objekttyp, tagg, vaning (storey), typnamn, material, klassificering, egenskaper (properties) and mangder (quantities) as JSON |
| `_properties` | One row per property: id, uppsattning (set), namn, varde (value), tal (number), enhet (unit), kalla (objekt or typ) |
| `_quantities` | One row per quantity in SI units: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | The file's non-geometric entities with raw attributes: id, typ, attribut |

Properties found only on the element's type are included and marked `typ`. Quantities are converted to metres, square
metres, cubic metres and kilograms with the project's units. Openings and connection ports are not building elements and
are found only in `_entities`.

The tables can be queried with SQL in Analyse:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

In R and Python `dm_read()` gives the elements, `dm_read_properties()` the properties and `dm_read_quantities()` the quantities.

## The Quantities tab in Analyse

- **Summary**: the facts and contents of the file.
- **Quantities**: count, length, area, volume and weight grouped by type, storey, material, type name or classification.
  The source *The file's quantities* takes one value per element and kind: net before others and gross last, so that a
  wall is not counted twice. The source *Measured on the geometry* counts on the triangles and works when the file has no
  quantities. The surface is then the whole surface around the element, not for example a wall's side area.
- **Quantity list**: every quantity name in the file per type, with a sum. Here you see exactly what the file states.
- **Properties**: which values a property has, and on how many elements of each type.
- **Entities**: how many entities of each kind the file consists of.
- **Climate declaration**: a preliminary climate declaration from the model per category and layer, see *Preliminary climate declaration* below.
- **Material inventory**: a basis for the waste management plan from the model, with the building products that can be reused, the
  waste per fraction and layer and the hazardous substances the model names, see *Material inventory for the waste management plan*
  below.

Every result can be saved as a dataset.

## IfcOpenShell in the app

The app reads, checks and changes IFC models with IfcOpenShell, the library Dataregium is built on. It runs in Python
in the browser, is fetched the first time it is used (about 13 MB, after your consent for components) and is then kept in the
browser. Nothing is sent anywhere; the model does not leave the computer.

**In Analyse, the Quantities tab**, an IFC model has five more tools:

- **Validation** checks the model against its IFC schema: attributes, types and references, optionally the schema's rules too.
  The findings can be saved as a dataset.
- **Spatial structure** shows project, site, building, storeys and spaces as a tree with the number of elements per part.
- **Property sets** gives every property set of an element type as one wide table: a row per element, a column per property
  (`Set.Property`), optionally the quantity sets too.
- **IFC selection** fetches elements with IfcOpenShell's selector language, for example `IfcWall, Pset_WallCommon.FireRating=EI60`
  or `IfcElement, material=Concrete`.
- **Geometry measures** measures volume, surface and bounding box per element on the geometry (OpenCASCADE). Slow for big
  models.
- **IDS check** checks the model against an IDS file (buildingSMART Information Delivery Specification) with
  ifctester, IfcOpenShell's own checker: choose the .ids file and you get a row per requirement and element with passed, failed
  or not applicable and the reason, plus a tally. The file stays in the browser. ifctester travels with the app without its web
  app, so nothing is fetched beyond Python itself.
  Under *IDS in the app* you choose one of the app's own IDS files instead, for instance *Avfallshantering* (see *Material inventory
  for the waste management plan*), which is checked the same way; *Save the IDS file* saves the chosen one on the computer.

**In Process** the model has two actions under *Actions* (the button is in the model view and in the table view), in the group
*Model*:

- **Write a table into the model** writes a table's values into the model. Rows are matched on GUID; the columns `Name`,
  `Description`, `ObjectType` and `Tag` (or `namn`, `beskrivning`, `objekttyp`, `tagg`) become attributes, and columns like
  `Pset_WallCommon.FireRating` become properties (the set is created when missing). The workflow: save *Property sets* as a
  dataset, edit it in Process and write it back.
- **Python on the model** runs a function `step(model)` with IfcOpenShell's API on the whole model.

Both are steps in the recipe: the changed model becomes the dataset's new content (the original file is replaced and the tables
rebuilt), the step is logged and can be undone, and the original file is always the current version when you export the model
or send it to a CDE.

**In Python** (the Python tab in Analyse and code cells in the notebook) `dm_ifc("name")` opens the model as an
`ifcopenshell.file`. The helpers `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` and
`dm_ifc_geometry` give tables, `dm_ifc_set(model, df)` writes a table into the model and `dm_ifc_write(model, "name")` sends the
model to the app as a new dataset; see [Python in Dataspatium](python.md). The tools in Analyse and Python never change the
dataset; only the actions in Process make a new version.

IfcOpenShell is LGPL-3.0 and is fetched unchanged as pinned wheels from IfcOpenShell's own index, see [Licences](licenser.md).

## Validate the model

The card **Validate the model** in Manage gathers the checks of an IFC model, with the latest result of each.

- **The server's check** is there for a model fetched as a document version from a CDE. Dataregium (from 3.0.0) checks every
  uploaded IFC file against the IFC schema and, when the server has them installed, against buildingSMART's rules
  (ifc-gherkin-rules), and puts the result in the version's metadata. *Fetch the server's check* reads it: no findings, findings that
  are only warnings, findings with errors, waiting to be checked or could not be checked, and when and with which rules. The app asks
  the server only when you press the button. When there are findings, *Show the findings* shows the server's report: the number of
  findings and errors, which checks were made and which rules could not run, and every finding with its rule, its instance (`#123`)
  and the element's GlobalId. *Mark in the model* then marks the elements in the model view in Process, and *Save as table* saves the
  findings as a table with the columns `kind`, `rule`, `severity`, `message`, `step_id`, `global_id` and `attribute`. The report is fetched with the same sign-in from an address the app
  builds itself on the same server; an address from the metadata is never followed.
- **The project's IDS files**: when the server also checks the file against the project's IDS documents (the latest version of every
  document whose name ends in `.ids`), the report shows how many specifications passed, failed or did not apply to the file, and which
  failed, with the document's name and the number of findings. An IDS document that could not be read is among the rules that could not
  run.
- **What no GlobalId reaches**: when the server’s check graph finds instances that nothing with a GlobalId reaches, the report
  shows the button *Remove what no GlobalId reaches*. The server then proposes, after your confirmation, a change set that removes
  them; the proposal becomes a topic that is tried and approved like others, and the version keeps everything.
- **Checks here** shows the latest *Validation*, *IDS check* and clash check run in the app, and the buttons open them in Analyse.
  The results are kept in the app's settings, not in the dataset.

The findings concern the file as it was uploaded, and the server never stops a file for them. A file whose findings are all warnings
counts as valid with buildingSMART's validation service. When the server has no such check, the card says that the server has not
checked the version.

## Project profile

The card **Project profile** in the source's view under *Import → OpenCDE* shows the chosen project's profile: the project's IDS
documents (files ending in `.ids` among the project's files) and the bSDD dictionaries you have chosen for the project, kept in this
browser per server and project.

- **Write IDS with AI** writes an Information Delivery Specification from a description in words. Choose the provider, the model the
  requirements are checked against, and describe the requirements. The AI hands the file to the app, which checks it (the structure
  first, then with ifctester against the model, in Python in the browser) and answers with the error to fix or the outcome per
  specification. It goes round by round until the file runs, at most four rounds, and the requirements are never softened to pass.
  The result can be saved as an `.ids` file or uploaded to the project as a document.
- **Search bSDD** looks up classes in the buildingSMART Data Dictionary after the consent for the host `api.bsdd.buildingsmart.org`,
  in the chosen dictionaries or all; *Dictionaries* lists the dictionaries so that you can add them to the profile. In *Change with
  AI* the AI can search with the tool `search_bsdd` and classify elements with `set_classification`, written as an
  `IfcClassificationReference` in the change set you approve.
  `search_bsdd` searches only free dictionaries whose licence has been read (IFC 4.3, Uniclass 2015 and ETIM 10.1) and answers each
  class with its dictionary and licence, and `set_classification` writes the system's edition, publisher and address on its
  `IfcClassification`.

The server's buildingSMART rules show on the card *Validate the model* in Manage; choose a rule in the list beside *Mark in the model* to
mark only the elements that rule hits.

## Clash check

The tool **Clashes** in Analyse (the tab Quantities) finds building parts that run into each other or come too close to each other. It
works on the same triangles the 3D view shows, in a thread of its own, and needs neither Python nor the network.

- **Set A and set B** are all building parts or one type, for example ducts against beams. B can be in the same model or in another
  model of the same project, and the models must then share a coordinate system. Openings do not count.
- **On the server**: for a model from Dataregium (from 3.0.0, when the server has its clash check turned on) *Where* chooses
  whether the app does the work or the server checks the versions the same way. The server works through a queue; the app waits
  and shows the report as its own, with the same table, marking and BCF file, and *Send as issues* lets the server make the issues
  with a viewpoint each. The other model must then be a version in the same project.
- **Intersection** counts pairs where one element reaches into the other deeper than the tolerance (2 mm unless set otherwise). The
  depth is how far corners and edges reach into the other element, so faces that only meet do not count. *Containment* is an element
  that lies wholly inside another.
- **Clearance** counts pairs closer to each other than the distance (50 mm unless set otherwise), intersections included.

The result is a table with the id, GlobalId, type and name of both elements, the kind, the depth or distance in millimetres and a
point in the model's own coordinates. From there:

- *Mark in the model* marks the elements in the model view in Process.
- *Save as BCF* saves one issue per clash in a BCF file, with a view that looks at the point and both elements selected and coloured.
  Camera and point are in the model's coordinates with Z up, so other BCF tools show the same place.
- *Send as issues* creates the issues directly in the project on the server through the BCF API, for a model fetched from a CDE. There
  every client sees them, Bonsai for example.
- *Create dataset* saves the table.

The latest result shows on the card Validate the model in Manage, and whether the app or the server did it. The measuring assumes closed surfaces: an element with open or
broken surfaces can give uncertain depths. Curved surfaces are split into triangles, so a tolerance below a millimetre is uncertain. Elements the 3D view cannot draw take no part, and the result says how many there are; in a sample model from Tekla that was every reinforcing bar.

## Preliminary climate declaration

The tool **Climate declaration** in Analyse (the tab Quantities) works out a preliminary climate declaration from the model: the climate
impact for A1–A3, A4 and A5 in kg CO₂e per category and per layer of the building. It supports the design work; it is not a
declaration to register with Boverket.

**Category and layer.** Every building element gets one of Boverket's four categories (load-bearing parts – foundation, load-bearing
parts – other, building envelope, interior walls) or *Not included*, and one of the six layers of a building from Boverket's report
2024:26: 1 site and foundation, 2 frame and other load-bearing structures, 3 envelope, roof and facade, 4 building services, 5 ceilings,
interior walls and interior surface layers, 6 fixed furnishings. The rules read only the IFC class, the PredefinedType (the element's or
its type's) and LoadBearing and IsExternal in Pset_*Common; no classification is read. They follow Boverket's list of the parts that
are included: piles, groundworks, services, fixed furnishings, movable interior walls, interior surface layers and shading are not;
stairs, ramps and railings are load-bearing; ceilings, suspended ceilings and interior doors belong to the interior walls. The column
*Rule* shows what decided.

- **Uncertain**: the element is included but its category is uncertain, for example an interior wall without LoadBearing or a door
  without IsExternal. It counts in the category shown and is listed under *To settle*. An external wall is envelope whatever
  LoadBearing says.
- **Cannot be decided**: the rules cannot say whether the element is included, for example a proxy element or solar cells (which are
  included only when integrated in the roof or facade). It does not count until you have settled it.
- **Derived IsExternal**: when the file does not give IsExternal, a door or a window takes the value of the wall it sits in. *Derive
  IsExternal* reads the building's topology with the app's Python, which starts then (the first time its components are fetched with
  your consent): the walls along a storey's outer boundary are external, and on a closed storey the rooms' other walls are internal.
  The rule says when a value is derived.
- A composite element, for example a roof made of roof slabs, is counted in its parts, and a part the rules cannot decide takes the
  category of its whole.

Under **To settle** you choose the category for a whole group of elements with the same class, type and rule. The choice is kept per
element (GlobalId) in the browser until you let the rules decide again.

**Quantities.** Volume, area and weight come from the file's quantity sets, net before gross and a wall's side area. When the file has
no quantities, the volume is counted from the geometry when the element is a simple extrusion: the profile's area times the depth
(rectangle, circle, I-profile, polyline and more), also through the type's representation and before a clipping. Openings are then
not deducted, and the column *Source of the quantity* says so. Doors and windows are counted per square metre from their size. An
element with material layers is split per material by the layers' thickness. Otherwise the row has no quantity and is not counted.

**Climate data.** *Fetch the climate database* fetches Boverket's climate database (about 0.9 MB) from api.boverket.se with your
consent for API fetches and keeps it in the browser; nothing about the model is sent. Under *Materials and resources* you choose a
resource for every material. The proposals rest first on the material's category in IFC (IfcMaterial.Category, for example concrete,
steel, wood, glass or gypsum) and then on its name; doors and windows are proposed by their type's name. *Accept the proposals* keeps
the proposals as your choices, which apply to every model. The climate impact is the mass (the volume times the density, or the area
times the weight per square metre) times the database's values for A1–A3, A4 and A5 (waste). Boverket states that its climate data for
building products are set conservatively, about 25 per cent above the average; the tool counts with the conservative value and shows
the typical one when asked.

Every view can be saved as a dataset. Source: Boverket, the climate database (open data, see [licenser.md](licenser.md)).

## Material inventory for the waste management plan

The tool **Material inventory** in Analyse (the Quantities tab) gathers what the model knows as a basis for the waste management
plan (avfallshanteringsplan). Under the Swedish PBL 10 kap. 8 a §, in force since 1 July 2026, the developer must make sure there is
a waste management plan stating

1. which building products can be reused and how they are taken care of, and
2. which waste the measure can give rise to and how it is taken care of, in particular how the developer intends to make possible a)
   high-quality material recycling and b) the safe handling and removal of hazardous substances.

No plan is needed when it is obviously not needed, and the certified inspector (kontrollansvarig) has the same task for it as for
the control plan. Boverket proposed the plan in its report 2024:26 under the name resource management plan. The tool gives the
basis; the plan and the assessments are the developer's. The views follow the provision's two points.

**1. Building products that can be reused.** The elements with a type, those with product data first: the manufacturer
(Manufacturer), the model (ModelLabel) and the GTIN (GlobalTradeItemNumber) from Pset_ManufacturerTypeInformation, preferably on the
type, and the serial number (SerialNumber) and barcode (BarCode) from Pset_ManufacturerOccurrence on the element. The GTIN's check
digit is checked by GS1's rule; an error is shown but never mended. Every row has the layer of the building, the materials, the
fractions and the hazardous substances the model names. IFC2X3 has no GTIN.

**2 a. Waste per fraction and per layer and fraction.** Every material of every element gets a waste fraction of the Swedish Waste
Ordinance (avfallsförordningen 3 kap. 10 §), which, besides hazardous waste, requires wood, mineral (concrete, brick, clinker,
ceramics and stone), metal, glass, plastic and gypsum to be sorted out. The fraction comes first from the material's category in IFC
(IfcMaterial.Category, for instance concrete, steel, wood, glass, gypsum or plastic) and otherwise from the material's name
(concrete, glulam, plasterboard, insulating glass and the like, in the Nordic languages and English). Mineral wool, glass wool and
stone wool belong to neither mineral nor glass, and composites such as glass-fibre reinforced plastic, names that name several
fractions (wood/aluminium) or none, and elements without a material become *Other / to decide*. The column *Rule* shows what
decided. The sums give elements, rows, volume, area and mass per fraction, and per layer of the building (the climate declaration's
six layers) and fraction. No classification is read.

**2 b. Hazardous substances.** Only what a property in the model says: a property whose name or set is about hazardous substances or
hazardous waste (for instance Pset_EnvironmentalImpactValues.HazardousWaste, or an own set with asbestos or PCB) and whose value
says yes, on the element, the type or the material. The app never guesses. When the model names no hazardous substances the tool
says so, and an inventory of hazardous substances is still needed.

**All elements and materials** are the rows behind the sums: the quantity, the material's category, the thickness, the fraction with
its rule, the layer, the density and the mass.

**Quantities and mass.** The quantities are the climate declaration's: the file's quantities, otherwise the geometry of simple
extrusions, and an element with material layers is split by the layers' thickness; doors and windows are counted per material here.
The mass is the file's weight, otherwise the volume times the material's density (Pset_MaterialCommon.MassDensity in kg/m³). Without
a density the row has no mass, and the note says how many rows that is.

**IDS for waste management.** *IDS waste management* opens the IDS check with the app's IDS file
`SE-Dataspatium_Avfallshantering.ids` and checks the model against it in the app's Python: a material with one of IFC's recommended
categories on every element; the base quantity for volume on walls, slabs, beams, columns, members and plates, footings and stair
flights, and for area on doors, windows, coverings, roofs and curtain walls; the manufacturer and the model on doors, windows and
installations, and a GTIN of the right form when there is one. The file is for IFC4 and IFC4.3, since IFC2X3 has no material
category, no templates for base quantities and no GTIN. ifctester passes the material requirement when at least one of the element's
materials has a category, and composed elements (roofs, stairs, ramps and curtain walls) are checked in their parts.

Every view can be saved as a dataset. Nothing is fetched from the network.

## DXF drawings

A DXF file becomes a table with one drawing object per row (type, layer, colour, length, area, text and position) and an
SVG drawing. The drawing opens in Process, where you zoom with the wheel or by pinching and pan by dragging; when the drawing has focus the arrows move, + and − zoom, Home shows everything and F zooms to the marked object. A row in the table zooms to its object. Layers are turned on and off
in the inspector, and a click selects the object and its row. The Quantities tab gives count, length and area per layer and type.

Lines, polylines with arcs, circles, arcs, ellipses, splines, points, texts, solids, 3D faces, blocks and the blocks of
dimensions are drawn. Hatching (HATCH) is not drawn.

## Export

Export gives the original file, the properties and quantities as CSV (one row per value) and the drawing as SVG, in
addition to the usual table formats for `data`. Charts of models are exported as PNG, SVG and PDF; a 3D model then becomes a picture.

## Limitations

- The tables cannot be edited directly. The model is changed with the IfcOpenShell recipe steps and with *Change with AI*, which
  write a new version of the IFC file.
- A model is drawn again from the original file in each new session. The 57 MB model the app was tried with takes 4–6 seconds.
- The first drawing of a very large model can lock the page for a moment while the graphics card takes in the triangles.
- The quantities are not a take-off under any set of rules. Check them against the source before relying on them.
- DXF is read in two dimensions. DWG must first be saved as DXF.

## New model

A new, empty model is created in Import with *New building model*. Choose the schema (IFC4X3_ADD2 is the default; IFC4 and IFC2X3
are there for programs that do not read the newest) and the names of the project, site, building and first storey. The app writes
the model with IfcOpenShell in the app's Python, in metres and with the model's contexts, and the model passes the schema check. The
first time, Python and IfcOpenShell are fetched after consent.

The model becomes an ordinary model dataset. Open it in Process and build in it with *Change with AI*, for example "two storeys and
a 6×4 m grid with external walls along the grid". It can be exported as IFC and published to a Dataregium like other models.

### Designations, numbers and place

Under *Designations and ids* in the form, fill in what you know; only that is written to the file:
- *Property designation* becomes the site's name (IfcSite.Name) and its land id (Pset_LandRegistration.LandID); what you wrote
  under *Site* then becomes the site's long name.
- *Building number* becomes the building's name (IfcBuilding.Name) and *Building name* its long name (LongName).
- *National building id* is written to Pset_BuildingCommon.BuildingID with IsPermanentID, so that the model and the registers mean
  the same building.
- *First storey's description* becomes the storey's Description, for example that it is the entrance level.
- *Author* and *Organisation* are written to the IFC file's header only if you fill them in; a name is personal data.

The model also gets the Axis context for the walls' axes from the start, and the report reminds you that the model has no
coordinate reference system (buildingSMART rule GRF003) until `set_site` has given it one.

The AI numbers the storeys in order of height for the whole project (Plan 1, Plan 2 …) and writes the entrance level in the
storey's description; `create_storeys_and_grid` takes `description` and `long_name` per storey. `create_spaces` takes a `number`
per room, unique in the building: the number becomes the room's Name, the room name its LongName and `long_name` its description,
and a room type (`room_type`) is written as ObjectType with PredefinedType USERDEFINED. Without a number the names work as before.

`set_site` knows the compound EPSG codes for SWEREF 99 with heights in RH 2000: 5845 for SWEREF 99 TM and 5846–5857 for the twelve
local zones in the same order as 3007–3018 (for example 5850 for SWEREF 99 18 00 + RH 2000). For a building in Sweden the AI
prefers the local zone when the coordinates are in it; it never converts coordinates itself. The coordinate reference system
(IfcProjectedCRS) gets a description in plain words and, when the code does not give the height system, RH 2000 as VerticalDatum
(another one with `vertical_datum`). The map unit is always the metre and the conversion's Scale the file's length unit in metres
(GRF005), so a model in millimetres gets Scale 0.001. Every parent context (Model, Plan) gets its own IfcMapConversion with the same
values (GRF001). The building's height above sea level is the conversion's OrthogonalHeight; in IFC4 and IFC2X3 also
IfcBuilding.ElevationOfRefHeight, which IFC4X3 has deprecated.

The file header: every IFC file the app writes or saves gets FILE_DESCRIPTION with the view definition and the level 2;1, and
FILE_NAME with the file's name, the time in ISO 8601, the preprocessor (Dataspatium and IfcOpenShell with their versions) and the
originating system in the form *Dataspatium - Dataspatium - version*. The view definition is CoordinationView_V2.0 for IFC2X3 and
ReferenceView_V1.2 for IFC4. IFC4X3 has no official view for a model in the full schema (the Reference View leaves out extruded
solids among others), so the header says `notYetAssigned` instead of a view the file does not follow; buildingSMART's validation
service flags it, and a recipient who requires a view names it. A file the app changes keeps its own author, organisation and
originating system, and its view when the validation service accepts it.

## A new building from a brief

Write a brief in the form *New building model* ("a two-storey house 12 × 8 m with a gable roof, brick façade, entrance to the south …")
and choose *Build from the brief with AI* once the model is made: it opens in Process with the AI panel in the mode **Build from
brief**. There you can attach photos and scanned drawings (JPEG, PNG or PDF; a plan drawing gives the real dimensions, a photo the
look, the materials and how the parts relate) or add the pictures of an image collection, for example those taken with Dataspatium
Mobile. The AI reads the empty model, says its plan, asks in the panel when the brief leaves something essential open (footprint,
number of storeys, storey height, wall thicknesses, materials) and then builds in groups with the same tools as *Change*: storeys
and grid, walls per storey, slabs, openings, properties and materials, with a preview and corrections after each group. Nothing is
written into the model until you preview and approve the change set as usual, and you can add to it with a new brief in the same
mode. The pictures go to the provider with the brief, after the consent for the provider's host; a local model that sees pictures
keeps everything on the computer.
With *Facts from a dataset* rows of a table go into the brief as text: a building footprint fetched from the map (Open geodata) becomes
corners in metres from the south-west corner, so that the walls get real dimensions, and measurements and notes from a field form
in Dataspatium Mobile become rows; a round with the phone can then give more pictures and measurements, and the brief is added to
in the same mode.
The brief and the pictures can also be put on the server as the model's material when the model was fetched from a CDE: the topic
*Material* in the model's project gets the brief as a text document and every picture as a document, so that others who work on the
model in clients of their own see what it was built from. The button is *Put the material on the server*.
At the top of the panel stand *The building's facts* (which building, storeys, length, width, height, foundation, roof) and *Level of
detail* (sketch, main features or detailed): fill in what you know, it opens the brief and the AI asks about the rest. The words are
plain, but behind them lie ISO 19650's information requirements and level of information need, and the model is meant as the building's
asset information model. Each picture is attached as a photo, the north, east, south or west façade, the inside or a drawing, and a
photo whose file carries a position and a time (EXIF) gets them in its caption, so that the AI knows what it sees. The facts from a
dataset also give the footprint's south-west corner on the map, so that the AI places the model with `set_site` (position, height and
SWEREF 99 TM), and with *With the ground height at the corners*, shown when Lantmäteriet's source is added, the ground height at every
corner from the terrain model: a network call with your key after consent.
After the walls of each storey the preview reads the building's topology: the walls' centrelines become rooms, and the storey is closed
when the walls enclose at least one room and no wall end is left open; the AI mends open ends by moving or adding walls before it lays
the slabs. The external walls with their compass directions let the AI match a photo of the south façade to the right walls (the read
tool `get_topology`), and the same topology is shown on the card *Topology* in Check.

### Purpose, stage and requirements

*The building's facts* also hold *Purpose*, *Stage* and *Requirements (IDS)*. The purpose is what the model is for, and it picks the
level of detail and the requirements, which you can change afterwards:

| Purpose | Level of detail | Requirements |
|---|---|---|
| Massing study | Sketch | SE-Dataspatium_Grund |
| Building permit | Main features | SE-Dataspatium_Grund |
| Climate declaration | Main features | SE-Dataspatium_Klimatdeklaration |
| Facility management | Detailed | SE-Dataspatium_Grund |
| Waste management plan | Detailed | SE-Dataspatium_Avfallshantering |
| Other (with your own text) | Main features | none |

The stage says where in the building's life the model belongs: feasibility study, proposal, construction documents, under construction
or existing building. Purpose, stage and requirements open the brief. With requirements, every preview, the AI's own and yours, tries
the candidate against the IDS file, and the AI gets the specifications that are not met so that it can mend them. The requirements do
not stop the approval; the panel shows how many specifications are met and which are not.

The level of detail follows the level of information need of ISO 7817-1 (section 6), which divides it into geometry, alphanumeric
information and documentation. In the app's own words, the three levels mean this per facet:

| Facet | Sketch | Main features | Detailed |
|---|---|---|---|
| Detail | storeys, outer walls and slabs as plain solids, no openings | every wall with its type's thickness, slabs, the roof's shape and openings of plausible size | layers per type, doors and windows with frame and sash, walls that meet at the corners |
| Dimensionality | solids in 3D and the wall's axis | as the sketch | as the sketch; plan symbols may come later |
| Location | the storeys' heights, the grid and the site when known | measures from a drawing or the brief, georeferenced when the facts are there | surveyed or dimensioned positions, openings exactly placed |
| Appearance | default colours | colour by the material's category | a surface style per material, apart from the material |
| Parametric behaviour | extrusions whose measures can change | types (change the type and all change) and layers | connections that recompute the corners, doors and windows with parameters |
| Identification | name, IFC class with PredefinedType and GlobalId | named types, rooms with number and name | parts and space classes, Tag on doors and windows |
| Information content | storeys and heights | IsExternal, LoadBearing and materials on the types, base quantities | fire, U-value and climate data per type or material, the condition of an existing building |
| Documentation | the brief | the brief and the pictures as the model's material | EPD references and product sheets |

## Check with AI

The mode **Check** in the AI panel tries an existing building's model against photos of damage and wear, taken with Dataspatium
Mobile, a camera or a drone, and against measurements from a field form. Attach the photos in the panel, labelled with their façade or
the inside, or add the pictures of an image collection you imported in Import; a photo whose file carries a position and a time (EXIF)
gets them in its caption, and *Facts from a dataset* puts measurements and notes from a field form into the question. The AI reads the
model with the same tools as in *Ask*, finds the element each photo shows and writes a finding for each defect with a title, a
description, the condition (good, fair, poor or critical), the priority (low, medium, high or urgent) and the recommended action; a
photo without visible damage gives no finding. The element's condition goes into the property set Pset_Condition (assessment date,
condition and a short description) in a change set that you preview and approve as in *Change*, and no elements are created, moved or
deleted. The findings are listed under the answer, and *Save the findings as a table* makes a new dataset with one finding per row:
photo, element, title, description, condition, priority, action, date and the photo's position. *Export as BCF* downloads a BCF file
with one issue per finding, with the photo as the viewpoint's snapshot and the element marked, and for a model fetched from a server
you are signed in to, *Create issues on the server* creates the same issues in the model's project after a confirmation. The photos go
to the provider with the question after the consent for the provider's host, and they leave the computer again only when you create
issues on the server yourself.

## Ask AI about the model

The button *Ask AI* in the model view opens a panel in the inspector where you ask a question about the open IFC model, for example
"which doors lack a fire rating on storey 2?". The AI model reads with tools (the model's overview, the storeys, elements by class, storey,
name and property, one element with all its properties, what you marked in the 3D view and, for a model fetched from Dataregium, the
server's named queries) and answers with the elements it rests on.
*Mark n elements* puts the answer's elements in the selection, which the 3D view, the table and the other modes follow. The panel shows
every tool call and the tokens spent. The AI can only read: nothing is changed, saved or published, and the next question continues the
conversation.

*Providers* adds a cloud service or a local model: Anthropic Messages or an OpenAI-compatible API (OpenAI, Gemini, Ollama, vLLM,
llama.cpp and others), with address, model and API key. The key is kept in the session or encrypted with your passphrase, never in clear
text and never in the question. *Policy* decides what may be called: *Ask* asks for consent per provider the first time, *Cloud* allows
cloud services, and *Local only* allows only models on your own computer. What is sent is your question and the tool answers the model
asks for; the tool answers are data from the model, never instructions, and are cut when large.

## Change with AI

The mode *Change* in the same panel lets the AI propose changes to the model, for example "create two storeys and a 6×4 m grid, external
walls along the grid, one slab per storey and a door in every wall on storey 1". The AI reads the model with the same tools as in Ask
and writes with tools for storeys and a grid, walls, slabs, openings with a door or a window, properties, materials, moves and
deletions. The tool `set_site` sets the model's place on earth: the site's latitude, longitude and height, and with an EPSG code such as
3006 for SWEREF 99 TM also the map conversion, that is the model's origin in eastings and northings and its rotation (not in IFC2X3,
which lacks it). The tool `create_roof` puts a gable, hip, shed or flat roof with a pitch, an overhang and a thickness on a storey's
walls (the top storey when none is named): an IfcRoof of roof slabs (IfcSlab of the type ROOF), one per roof face, over the bounding
box of the walls or a given rectangle (another outline is replaced by its bounding box for now). The tool `create_spaces` makes the
rooms the walls enclose into spaces (IfcSpace) with names from the room programme, chosen by a point inside or their number in the
topology, with the height up to the next storey, room areas (Qto_SpaceBaseQuantities) and boundaries to the walls and their doors and
windows. The tools change nothing: they fill a change set that the panel lists step by step (lengths in metres; new elements get the
refs new-1, new-2 … until the file has given them ids).

The tool `define_type` makes a wall, slab or roof type (IfcWallType, IfcSlabType, or IfcSlabType ROOF for the roof slabs) with its
material layers in metres, for a wall from its right side to its left as seen from its start toward its end, and for a slab or a roof
from the top down. Each layer can carry its material's category (IFC's recommended ones: concrete, steel, aluminium, block, brick,
stone, wood, glass, gypsum, plastic and earth) and its role (load-bearing, insulation, inner or outer finish), but only when they are
known. `create_wall`, `create_slab` and `create_roof` take the type: the element gets the type (IfcRelDefinesByType), its thickness from
the layers and the layers laid on it (IfcMaterialLayerSetUsage: a wall's centred on its line, a slab's downward from its top at the
storey's level and the roof slabs' upward from their undersides), and its PredefinedType stays on the type. Materials and shared
properties belong to the type, and the AI defines the types first. When the change set runs, the walls it creates are joined to the
walls they meet (IfcRelConnectsPathElements): at a corner the thicker wall (for equal thickness the longer) reaches past the corner and
the other stops against it, and a wall that ends on another's line stops at its side, so that corners have neither gaps nor overlaps
and no volume is counted twice. The walls' centrelines stay as drawn, and corners at other than right angles are joined as drawn.
Finally the walls, slabs, roofs, doors and windows the change set created or changed get base quantities (Qto_WallBaseQuantities,
Qto_SlabBaseQuantities, Qto_RoofBaseQuantities, Qto_DoorBaseQuantities and Qto_WindowBaseQuantities) computed from their dimensions,
with the openings deducted and with the names of the schema's templates.

The tool `create_element` makes the building elements that have no tool of their own, of the most specific IFC class and never as
IfcBuildingElementProxy: columns (IfcColumn), beams (IfcBeam), members such as studs and rafters (IfcMember), footings (IfcFooting),
piles (IfcPile), coverings such as flooring, ceilings, cladding, roofing and insulation (IfcCovering), railings (IfcRailing), chimneys
(IfcChimney), shading devices (IfcShadingDevice), sanitary terminals (IfcSanitaryTerminal), furniture (IfcFurniture,
IfcFurnishingElement in IFC2X3) and straight stairs (IfcStair). The class and its PredefinedType are checked against the model's schema
as in the other tools. The body is an extruded profile: a rectangle, a circle or an outline in the storey's plane, standing up from a
height above the storey (columns, footings, coverings, furniture) or lying in a direction (beams, members and railings). The element
lies in the storey, or is a part of a whole (`part_of`), such as a railing of a stair, and then lies in the whole and on its storey but
not directly in the storey. A covering can name what it covers (`host`): a building element (IfcRelCoversBldgElements) or a space
(IfcRelCoversSpaces). A straight stair (STRAIGHT_RUN_STAIR) is a sloped flight (IfcStairFlight, STRAIGHT) with the number of risers,
the riser height, the tread length and the width as attributes and in Pset_StairFlightCommon, and on request a landing (IfcSlab,
LANDING) at the top; the last riser is the front edge of the landing or of the floor above.

`define_type` also makes types for coverings (with layers, as a slab type), columns, beams, footings, railings, doors and windows
(IfcCoveringType, IfcColumnType, IfcBeamType, IfcFootingType, IfcRailingType, IfcDoorType and IfcWindowType; IfcDoorStyle and
IfcWindowStyle in IFC2X3), with their material. A door type has its operation (OperationType, such as SINGLE_SWING_LEFT, with the
hinges on the left as seen in the direction the door opens), a window type its partitioning (PartitioningType, such as SINGLE_PANEL or
DOUBLE_PANEL_VERTICAL), and both a width, a height and a lining depth. The geometry, with the lining, the door panels or the window
frames and glazing, is drawn by IfcOpenShell once on the type and reused by every door and window of the type (mapped geometry), and
the type gets the properties of its lining and door panels (IfcDoorLiningProperties, IfcDoorPanelProperties,
IfcWindowLiningProperties). `create_opening` takes the type: the door or window gets the type's size and geometry and stands flush with
the wall's left face, seen from the wall's start toward its end (the inside of an outer wall drawn counter-clockwise), and a door opens
toward that side, a LEFT door with its hinges at the side of the opening nearest the wall's start. With `side: right` it is turned
around: flush with the right face and opening toward it. A lining as deep as the wall is thick fills the whole reveal.
The tool `edit_element` changes an existing element in place, so that it keeps its GlobalId for its whole life: a wall's start, end,
thickness, height and type, a slab's outline, thickness and type, an opening's position, width, height and sill together with its door
or window, a roof's pitch, overhang and eaves height, and any element's name. The measures are read from the element's own geometry
(the wall's start and end from its axis), and the body, the axis, the layers, the base quantities and the wall joins are made anew. The
read tool `get_parameters` shows the AI the measures `edit_element` changes, read the same way, so that it can change an element it did
not create itself. The wall's openings keep their place along it as long as it keeps its direction (otherwise their distance from its
start) and must fit within it, and the roof keeps its rectangle. A typed wall or slab takes its thickness from its type, so a thicker
wall gets another type. An element not drawn the way the write tools draw it can only be renamed, and the answer says what the AI can
do instead. The AI therefore changes elements instead of deleting and recreating them, and deletes only when you ask it to. A move with
`transform_elements` happens in the storey's plane: a door or window moves with its opening, a moved wall is joined with the walls it
meets, no point is left unused, and the site, the building and the storeys are never moved, since their place and heights belong to the
whole project and change only by agreement.
The AI writes product identities only when you give them, and never invents them: the GTIN (GlobalTradeItemNumber), the manufacturer
(Manufacturer) and the model (ModelLabel) in Pset_ManufacturerTypeInformation on the type, and the serial number (SerialNumber) and
barcode (BarCode) in Pset_ManufacturerOccurrence on the element. IFC2X3 has no GTIN.
**Load-bearing, status and properties.** `create_wall` and `create_slab` take `load_bearing` (load-bearing or not), and they and
`create_roof` take `status` (NEW, EXISTING, DEMOLISH or TEMPORARY), but only when the brief or you say so: the AI never guesses, and a
digital twin of an existing building gets EXISTING. The values are written as LoadBearing and Status in Pset_WallCommon,
Pset_SlabCommon and Pset_RoofCommon, on the type when every element of the type says the same and on the element otherwise; IFC2X3 has
no Status, and the report says so. When the change set runs, the app sets IsExternal itself from the topology on the walls it created
or changed: true along the storey's outer boundary and false inside the building, and the doors and windows in the walls take their
wall's value. Roofs and roof slabs are external. A storey whose walls do not close gets no IsExternal, and the report and the AI's
preview say why; a value the model had already is kept. LoadBearing and IsExternal are what the climate declaration tells its
categories apart by.
`set_properties` checks a property set named Pset_… or Qto_… against IfcOpenShell's templates for the model's schema: a set or
property the template lacks is refused with the nearest names, true and false, measures and enumerations must have the right type, and
a number with its unit written in the value ("40 dB") is refused. Give the number only, lengths in metres, areas in m², volumes in m³
and angles in degrees, and the app writes them in the file's units. A set named Qto_… becomes a quantity set (IfcElementQuantity). A
property set of your own must not start with Pset_ or Qto_, and the AI is advised to name it country-origin-project_Name, for example
SE-ACME-42_Acoustics, with property names in PascalCase without å, ä and ö. The properties go in the element's own set, never in its
type's. `assign` takes the material's category (IfcMaterial.Category, the same eleven as in `define_type`).

*Preview* runs the change set on a copy of the model with IfcOpenShell in the app's Python (the components are fetched after consent the
first time), draws the result in 3D with new elements green and changed ones yellow, and shows what is created, changed and deleted
together with the schema check's findings. *Approve* makes the changes the recipe step *AI change*: the model gets a new version in the
workspace, the tables are rebuilt, and the step can be undone exactly. The step carries the provenance (provider, model and the
questions). A change set with schema errors cannot be approved, deletions are confirmed once more, and *Reject* drops the change set
without touching the model. The AI can never save or publish: you do that with the buttons.

The preview also checks the model's relationships: an opening without a wall, a door or window without an opening, an element outside
the storeys and a relationship with nothing in it count as errors, but only when the change set caused them; what was already in the
model blocks nothing. When a wall is deleted, its doors and windows go with it. When the app's Python is already running, the AI
previews its change set itself before you see it and mends what the wheel finds, at most twice; the approval is still yours.

A model fetched from Dataregium is published as a new version in Share with the document's base version, the version you fetched. If
the document has got a newer version meanwhile, the server refuses the publish (412 version_conflict); fetch the newest version, redo
the changes and publish again. For a model fetched from Dataregium, *Preview* also asks the server's precheck of the candidate (the
schema, buildingSMART's rules and the project's IDS) when the source is signed in, and a project that does not accept files with
validation errors refuses the publish (422) with the server's findings in the message and on the card Validate the model.

*Propose on the server* sends a previewed change set to Dataregium as a change proposal instead of publishing it: a BCF topic in
the project with the changes attached in the server's form (the snippet type DataregiumIfcChangeSet, which the server holds to its
schema). The form names changes of existing instances, one per attribute: property values, placements, the storey an element belongs
to and the like, with the document's base version, your name on the server and the AI model as provenance. New elements, deletions and
new relationships cannot be said in the form yet; the panel counts them and they go into the topic's description. The button appears
for a model fetched from Dataregium when the server announces the capability `ifc_changes`, and the proposal does not change the model. When the server tries proposals
(Dataregium with the IFC-LPG module on) the panel shows the trial's outcome under the topic: how many changes could be applied to
the base version, new findings against the base, and every change that could not be applied with its reason (a finding of the kind
proposal), for instance that a value is no longer the one the proposal started from. When the trial is clean a *manager* of the project can
press *Approve on the server*: the server makes the proposal the document's next version (with the base version, the proposer and
the approver in the version's metadata) and closes the topic. The model in the app is not changed by that; fetch the new version from
Dataregium to go on working on it. When the document has got newer versions since the base, the server tries the proposal again on
the latest in the same step and approves against it when the trial is clean; when the changes collide with what came between, the
server refuses (412) and the panel lists the colliding keys (instance and attribute), or says that anything may have changed when a
whole file was uploaded in between. Fetch the newest version then, redo the changes and propose again.
The card *Change proposals on the server* in the model view shows, for a model fetched from Dataregium, every proposal against the
document when the server states the capability `ifc_proposals_url`: title, state, who proposed it, how many changes and against which
version; *Approve* makes a tried proposal the next version for those allowed to approve, so that several people with their own clients
can work on the same model. A server that states the form `ops_form` (`dataspatium-tools/1`) also gets the write tools' operations, so
that new elements, deletions and relationships are part of the proposal: the server builds them on the base version with the same code
as the app, and a colliding key you give up is sent along as `keep_theirs`.

When the project has teams (the card *The project's members* in Manage) the panel shows which teams the change touches. When it
touches one team's part, that team's responsible approves, even with the role editor, and the server refuses (403) a manager; when it
touches the parts of several teams, or of none, a manager approves as before. When an IDS document gets a new version the server
checks the project's latest IFC versions again, and their reports stand as pending meanwhile.

When the server gives the values per collision, the panel shows for each the value in the base, what came between and your proposal,
and you choose per collision to keep your proposal or take what came between. *Propose again with my choices* sends the proposal
against the latest version, with the kept changes and without the dropped ones, and the server tries it again before it can be
approved. The merge happens on the server; the browser handles only the collisions themselves.

## The right IFC class

In IFC the class is the first classification: the most specific class with its PredefinedType, an ObjectType only when the
PredefinedType is USERDEFINED, and a type object; other classification systems come on top. The AI looks up the class for a thing with
the read tool `search_ifc_class`, in English IFC words such as *sink* or *handrail*, in the documentation of the model's schema that
comes with IfcOpenShell, and the change set takes only classes that exist and are not abstract in the model's schema, and
PredefinedTypes from the class's list. The card *IFC classes* in Check (and the read tool `get_class_report`) counts proxy elements
(IfcBuildingElementProxy), USERDEFINED without a name, elements without a type, PredefinedType on both type and element (rule OJT001)
and elements outside the spatial structure (SPS007), with examples.

## buildingSMART's rules in the preview

The preview also tries what the change set creates or changes against a selection of buildingSMART's normative rules, the rules that
buildingSMART's validation service uses (ifc-gherkin-rules), ported to the app's own Python:

- **IFC102**: no deprecated entities, attributes or values of the file's schema, such as IfcWallStandardCase, the wall STANDARD or
  IfcBuildingStorey.Elevation in IFC 4.3;
- **GEM111**: no repeated points in polylines and polyloops, and a closed polyline ends on its own first point;
- **SWE001**: profiles that do not cross themselves (tried with shapely);
- **PSE001** and **PSE002**: a standard set (Pset_) has the name, properties, types and classes of the schema's template, and a set of
  your own does not start like Pset;
- **QTY001**: a quantity set (Qto_) follows its template and has MethodOfMeasurement BaseQuantities;
- **GRF001**, **GRF003** and **GRF005**: every context has the same coordinate operation, a model with a building has a coordinate
  system, and the map conversion's scale fits the units;
- **SPS007**: building elements lie in the spatial structure, and a part of an element does not also lie in a storey;
- **OJT001**: the PredefinedType is on the type or on the element, not both, and USERDEFINED has a name;
- **PJS003**: every GlobalId has 22 allowed characters and starts with 0–3, and no GlobalId is used twice.

Every finding carries its rule's code. What buildingSMART counts as agreements gives errors, which stop the approval just as schema
errors do; industry practice (PSE002, GRF003 and GRF005) gives warnings, which stand apart. Only what the change set causes counts:
what the model had already blocks nothing. The AI gets the rules that fail after every preview and mends them, as it does with the
topology. The app does not have the whole suite: GRF005 knows a coordinate system's unit for the Nordic codes the app writes or from
its MapUnit, and SWE001 follows polylines, indexed curves and composite curves of them. The whole suite belongs on the server.

That is also why the app itself does not write what IFC102 deprecates. In IFC4 and later a covering with a `host` becomes a part
of the element it covers (IfcRelAggregates) or lies in the space, instead of IfcRelCoversBldgElements and IfcRelCoversSpaces, and the
stair's number of steps and measures stand in Pset_StairFlightCommon only. In IFC 4.3 the properties of the lining and the door panels
stand in Pset_DoorLiningProperties, Pset_DoorPanelProperties and Pset_WindowLiningProperties, which replace IfcDoorLiningProperties and
the others.

*Approve* also runs the schema's EXPRESS rules (WHERE rules and functions) with IfcOpenShell; pytest is fetched for them as a component
the first time. A change set that breaks a rule the model met before is not approved, and the message names the rule; ask the AI to
mend the change set and approve again. In a model of more than 300,000 instances the EXPRESS rules are left out, and the log says so.

## Basic requirements

The card **Basic requirements** in Check tries a model against the basic rules of Praxi, BIM Alliance's guidance for IFC, here in the
app's own words; no text, value list or template of Praxi comes with the app. The card reads the model when you press its button:

- the file header names the view (MVD), the program that wrote the file, the preprocessor and the time (author and organisation are not
  shown);
- the model has a projected coordinate system with a single EPSG code, a map conversion and a height system;
- the project, the site, the building and the storeys have names, the building also a long name and the storeys a description;
- every room has a number in Name, and no number is used twice in one building;
- a property set of your own does not start like IFC's (Pset_, Qto_), starts with a country code (SE-…), has only A–Z, digits, - and _,
  and names its properties in PascalCase without å, ä and ö;
- no value carries its unit: 40, not "40 dB".

Each check is shown as met, to look at or an error, with the first examples. IDS cannot try the file header or that something is
unique, which is why this is a card of its own.

## The app's IDS files

The app has IDS files of its own in `presets/ids/`, written from open rules:

- **SE-Dataspatium_Grund.ids**: names on the site, the building, the storeys and the rooms, no proxy elements, and a PredefinedType on
  slabs, roofs, doors, windows and coverings (USERDEFINED passes with a name).
- **SE-Dataspatium_Klimatdeklaration.ids**: LoadBearing on walls, slabs, roofs, columns and beams, IsExternal on walls, doors and
  windows, materials on the building elements, a category on every material and base quantities: what the preliminary climate
  declaration reads.

IDS names a class without its subclasses, so the IFC4 classes …StandardCase have specifications of their own, and a specification
applies only to the IFC versions it names. The brief picks a file by its purpose, and the IDS check in Analyse can run them.

## Compare versions

The button *Compare* in the model view compares the open model with a saved version of the same dataset (Versions in Process) or with
another IFC model in the workspace, for example a newer version fetched from a CDE. Elements are matched on GlobalId; the panel lists
what is only here, only in the other and what changed, attribute by attribute and property by property. In 3D what is only here is
green and what changed yellow; *Show the other version* draws the other file instead, with what is only there red. *Mark* puts the
differences in the selection. Nothing is changed; the same comparison will later take Dataregium's diff API as a source.

For a model fetched from Dataregium the panel also shows *The server's change set*: the changes that gave the fetched version on the
server, when it was approved from a change proposal, with the topic, who proposed and approved it, the base version (the version the
proposal was tried against) and every change with instance, attribute, old and new value. *Mark* marks the instances in the model. A
version uploaded as a whole file has no change set. It is a third source beside the snapshots and the other models.

*The server's versions* fetches the document's other versions on Dataregium as choices in *Compare with*. When you choose one, the
comparison is computed by the server (its diff between versions, by GlobalId and attribute, with placement, shape, container and type
as fields of their own) and shown as the same lists and colours here, but without the other version in 3D; fetch that version to see it.
