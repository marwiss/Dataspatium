# CAD and BIM: building models and drawings

Dataspatium opens building models in IFC and drawings in DXF as a kind of dataset of their own. The model is drawn in 3D,
the building elements become a table, and properties and quantities can be searched, counted and exported. Everything
happens in the browser: the file never leaves the computer. The original file is kept in the dataset and travels with
bundles and backups.

## Opening a model

Drop an `.ifc`, `.ifczip` or `.dxf` file in Import. The facts of the file are shown (schema, project, program, storeys and
counts per type), and *Import* creates the dataset. IFC2X3, IFC4 and IFC4X3 in STEP format are supported. A model of about
50 MB takes around a quarter of a minute to import and then opens in a few seconds.

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

- The model cannot be edited, and no new IFC file is written. Changes in the tables do not affect the original file.
- A model is drawn again from the original file in each new session. The 57 MB model the app was tried with takes 4–6 seconds.
- The first drawing of a very large model can lock the page for a moment while the graphics card takes in the triangles.
- The quantities are not a take-off under any set of rules. Check them against the source before relying on them.
- DXF is read in two dimensions. DWG must first be saved as DXF.
