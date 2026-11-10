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

The model opens as a 3D view with a table of the building elements below it. Drag to turn, scroll to zoom and drag with
the right button to move. The frame button shows the whole model; the odd object far from the building is not counted.

- **Select**: click an element in the model or a row in the table. The selection follows, and the inspector shows the
  type, storey, material, classification, properties and quantities, and the surface and volume measured on the geometry.
- **Filter**: choose a type or a storey, or search for a name, material or property. The table and the model show the same selection.
- **Show as table**: every column as an ordinary table with all the tools of Process.
- **Save as chart**: the view with its filter and camera angle becomes a chart in Visualise.

The geometry is computed from the original file the first time the model opens in a session, and it is used only for
drawing and measuring. The tables remain even if the computer has no WebGL, and a message then replaces the 3D view.

## Issues from a CDE

A model fetched from an OpenCDE server, or any model when such a server is a source, can show its issues: the button
*Issues* in the model view opens a panel in the inspector with the project's BCF topics. Those that point at elements in
this model come first, with their status and the number of elements. Click an issue and the elements are marked in the 3D
view, and the panel shows the description, the snapshot and the comments. The issues are fetched when you ask and are not
stored in the dataset; to count on them, save them as a table in Import. This is reading; creating and changing issues
comes in the next release.

With the rights for it, you can also write. *New issue* creates an issue on the server with title, type, status and labels
from the project's lists, and the view goes along as the viewpoint: the camera, a snapshot and the marked elements as components.
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
- **Checks here** shows the latest *Validation*, *IDS check* and clash check run in the app, and the buttons open them in Analyse.
  The results are kept in the app's settings, not in the dataset.

The findings concern the file as it was uploaded, and the server never stops a file for them. A file whose findings are all warnings
counts as valid with buildingSMART's validation service. When the server has no such check, the card says that the server has not
checked the version.

## Clash check

The tool **Clashes** in Analyse (the tab Quantities) finds building parts that run into each other or come too close to each other. It
works on the same triangles the 3D view shows, in a thread of its own, and needs neither Python nor the network.

- **Set A and set B** are all building parts or one type, for example ducts against beams. B can be in the same model or in another
  model of the same project, and the models must then share a coordinate system. Openings do not count.
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

The latest result shows on the card Validate the model in Manage. The measuring assumes closed surfaces: an element with open or
broken surfaces can give uncertain depths. Curved surfaces are split into triangles, so a tolerance below a millimetre is uncertain. Elements the 3D view cannot draw take no part, and the result says how many there are; in a sample model from Tekla that was every reinforcing bar.

## DXF drawings

A DXF file becomes a table with one drawing object per row (type, layer, colour, length, area, text and position) and an
SVG drawing. The drawing opens in Process, where you zoom with the wheel and pan by dragging. Layers are turned on and off
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

The mode *Change* in the same panel lets the AI propose changes to the model, for example "create two storeys and a 6×4 m grid,
external walls along the grid, one slab per storey and a door in every wall on storey 1". The AI reads the model with the same tools
as in Ask and writes with tools for storeys and a grid, walls, slabs, openings with a door or a window, properties, materials, moves and
deletions. The tools change nothing: they fill a change set that the panel lists step by step (lengths in metres; new elements get the
refs new-1, new-2 … until the file has given them ids).

*Preview* runs the change set on a copy of the model with IfcOpenShell in the app's Python (the components are fetched after consent the
first time), draws the result in 3D with new elements green and changed ones yellow, and shows what is created, changed and deleted
together with the schema check's findings. *Approve* makes the changes the recipe step *AI change*: the model gets a new version in the
workspace, the tables are rebuilt, and the step can be undone exactly. The step carries the provenance (provider, model and the
questions). A change set with schema errors cannot be approved, deletions are confirmed once more, and *Reject* drops the change set
without touching the model. The AI can never save or publish: you do that with the buttons.

A model fetched from Dataregium is published as a new version in Share with the document's base version, the version you fetched. If
the document has got a newer version meanwhile, the server refuses the publish (412 version_conflict); fetch the newest version, redo
the changes and publish again.

## Compare versions

The button *Compare* in the model view compares the open model with a saved version of the same dataset (Versions in Process) or with
another IFC model in the workspace, for example a newer version fetched from a CDE. Elements are matched on GlobalId; the panel lists
what is only here, only in the other and what changed, attribute by attribute and property by property. In 3D what is only here is
green and what changed yellow; *Show the other version* draws the other file instead, with what is only there red. *Mark* puts the
differences in the selection. Nothing is changed; the same comparison will later take Dataregium's diff API as a source.
