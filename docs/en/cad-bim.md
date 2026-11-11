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

When the project has teams (the card *The project's members* in Manage) the panel shows which teams the change touches. When it
touches one team's part, that team's responsible approves, even with the role editor, and the server refuses (403) a manager; when it
touches the parts of several teams, or of none, a manager approves as before. When an IDS document gets a new version the server
checks the project's latest IFC versions again, and their reports stand as pending meanwhile.

When the server gives the values per collision, the panel shows for each the value in the base, what came between and your proposal,
and you choose per collision to keep your proposal or take what came between. *Propose again with my choices* sends the proposal
against the latest version, with the kept changes and without the dropped ones, and the server tries it again before it can be
approved. The merge happens on the server; the browser handles only the collisions themselves.

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
