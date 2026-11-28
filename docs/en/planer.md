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
| National specification Översiktsplan (Lantmäteriet, version 2.0, test version 5 of 2026-10-23) | GeoJSON with `feature:mediatyp application/vnd.lm.oversiktsplan.v2+json` or `feature:typ` oversiktsplan, innehallOP, beslutOP | The plan's facts and decision (taken, legal force), content objects with content type, theme by the ÖP catalogue's category, name, specification, plan event, level of connection and links, also content described only in text |
| Boverket's ÖP model (GeoPackage, database model 0.4) | Tables `innehall_op_<theme>_<geometry type>` and `oversiktsplan` | Every content layer as one plan with a theme per layer, the plan's decision (`beslut_op`), planning data and documents, links between content and the text document's sections (bookmarks), also to the whole plan; with the text document, see [A digital comprehensive plan in several files](#a-digital-comprehensive-plan-in-several-files) |
| Detailed development plan in GeoPackage | The tables `detaljplan`, `bestammelse` and `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` with the national specification's field names | The plan as the planning tool saves it: plan area, areas, lines and points with their provisions, designations, colours, motives and heights, decision information and documents; areas without a provision yet are shown as drawn |

Coordinates in SWEREF 99 TM and the local SWEREF 99 zones (EPSG:3006–3018, read from `koordinatsystemPlan`) as well
as Web Mercator are converted to WGS 84. A GeoJSON file is recognised by its contents, not its extension: drop it in
Acquire and the plan's facts appear with the button *Import*. A GeoPackage in the ÖP model gets the choice *The
whole comprehensive plan as a plan*; switched off, one table at a time is imported as before. A detailed development plan in GeoPackage gets the choice *The whole plan as a plan*. The coordinate system of a GeoPackage is read from the file, also when it is given only by name (for example *SWEREF99 15 00*).

From Lantmäteriet's detailed-plan API (the source *Lantmäteriet geodataplattformen: detaljplaner*, a key from a
connected organisation required) an answer is saved as a plan with the button *Save as plan* instead of as a table.

## The plan map in Process

A plan opens as a plan map: use provisions filled with Boverket's colours (housing yellow, centre brown, industry
blue-grey, street light grey, park light green, water blue and so on per the general advice to BFS 2020:5; the shades
are the app's), property provisions as blue dashed outlines, administrative provisions as purple dotted ones, the plan
boundary in black and the designations as labels. Click an object and the inspector shows its facts and what the
catalogue says about the provision: code, type, validity and the catalogue's formulation. Layers are switched on and
off per type, a background map appears after consent, and the buttons give *Save as map view* (for Visualise,
dashboards and Publish), *Plan provisions* (the list as Markdown) and *Show as table*.

A comprehensive plan is drawn layer by layer: land and water use filled per content type in Boverket's colours, the other
layers in Boverket's colours where the plan gives them and otherwise each in a colour of its own (see [The
layers](#the-layers)). The legend in the inspector shows the area per land and water use.

Lines (no-exit lines, fences, development directions) and points (for example the height of the ground) are drawn as they are. A provision limited in height is drawn by its footprint, and the inspector shows the height in the plan's height system (RH 2000 in plans to NGP): lower limit, upper limit or both. The inspector also shows the plan's identity (its objektidentitet, without braces), a comprehensive plan's planhändelse (plan event) with its date, the plan's decision (adopted, legal force, appealed, implementation period, case number, type of decision), the plan description's name and the documents, and for the chosen object other facts such as the period of validity, a secondary property boundary, which use provisions a property provision regulates, the level of connection, what the content touches and where in the plan document it is described. Content described only in text, without a place on the map, is listed under *objects without a place on the map* and can be chosen there.

## A digital comprehensive plan: layers, positions and files

A digital comprehensive plan is delivered as one or more GeoPackage files in Boverket's ÖP model, the plan description (the
comprehensive plan's text document) as DOCX and sometimes the files `manifest.xml` and `metadata.xml`. The whole delivery is one
dataset of the kind plan, and the plan view in Process shows it together: the map with its layers, the plan description's
positions (ställningstaganden) and the delivery's files. A single DOCX file is still a document collection and a single layer a
table, as before.

### The layers

Under *Layers* in the inspector the layers are listed per GeoPackage file and then layer by layer, one for each table in the file
(for example land and water use, development direction as areas and as lines, national interests). An older plan without its
source layers has one layer per theme. Each layer has a switch, its number of objects and its symbol.

- Every layer shows at the start, and several can show at once.
- *Show all* and *Hide all* at the top apply to every layer the filter shows. Each file has buttons of its own to show and hide its
  layers, and the eye beside a layer (*Show only this*) shows only that layer.
- A plan with more than twelve layers has a filter that narrows the list by the layer's or the file's name.
- Which layers are hidden is kept per dataset and applies again when you come back to the plan, also after a reload.

The symbols tell the layers apart. Boverket's colours always come first, in new and older plans and for every theme and
object type: land and water use keeps Boverket's colours per use, so that the land use map looks like Boverket's, and an
object whose row gives a colour (the column `farg`, with the colour names of Planbestämmelsekatalogen) is drawn in it. When
every object in a layer has a colour the layer is drawn object by object and the legend shows one line per category and
colour; when only some have one they are drawn in their colour and the rest in the layer's own. Areas are filled with the
colour, lines and outlines are drawn in it. A detailed plan is drawn as before: the uses in Boverket's colours and the other
provisions as the plan map's outlines. The plan boundary is a dark outline and the areas a dashed one. The other layers each
get a colour from the app's colour-blind safe palette: areas are filled with an outline, lines are drawn as lines (dashed
when two line layers would otherwise share a colour) and points with a marker shape of their own (circle, square, triangle
or diamond). The legend in the inspector lists only the layers that show, grouped as the list and with the same symbols, and
land and water use with its uses and their area in hectares.

### The plan description beside the map

When the plan has the plan description's sections or the delivery's files, the map and the plan description share the work
area: the map on the left and the text on the right, with a divider between them. Drag the divider, or use the arrow keys when
it has the focus, to change the width. The width is kept for every plan, and a double click resets it. Below 1,100 px the text
is below the map. The plan description and *Files* are tabs above the text. The panels around the work area stay as they were.

The plan description shows the sections with heading and text:

- *Applies to the whole plan* at the top: sections linked to the plan as a whole.
- Then the positions (the section type Ställningstagande) and last the other sections, such as descriptions and consequences.
- The text always shows as text, never as HTML.
- *Show 3 areas on the map* (with the section's number) marks every area the section concerns, in the accent colour and even
  when their layers are hidden, and zooms the map to them. The section is marked in the text, and the inspector shows it with its
  areas, *Show in the plan description* and *Unmark*.

### Areas and their positions

Click an area on the map and the inspector lists at the top, under *In the plan description*, the positions and other sections
that concern the area, the positions first. Several areas are chosen in two ways:

- **Shift-click** adds an area, or removes it again.
- **Select area** in the toolbar: then drag a rectangle on the map, and every shown area the rectangle touches is chosen. The
  plan boundary does not count. Shift and drag does the same without the button and adds the areas to those already chosen.
  Esc cancels.

With several areas chosen the inspector lists them under *Chosen areas* and below them every position and section that concerns
any of them, one section at a time with the chosen areas it concerns (*Applies to Trossö, Lyckeby*). *Show in the plan
description* scrolls the text beside the map to the section and marks it. *Clear the areas* empties the choice.

A link found only in the text, because the text names the area but the files do not link them, is shown as *Named in the text*
(see [How the links are read](#how-the-links-are-read)). When the inspector cannot list anything it says why: the area has no
object identity, no section concerns the area, or the plan has no links at all between the map and the text.

### Files

The *Files* tab first shows how the plan's links between map and text were read: how many and from where, how many areas and
positions have no link and, when there is none, why. *Read the links again* reads them anew from the plan's files, in every way
the app knows now, for example for a plan imported with an older version. Then it lists the delivery's files with their role
(plan map, background material, text document, appendix, manifest, metadata or other) and size, and the warnings the delivery
was read with. Files the delivery names but that were not kept are listed apart.

- Only a PDF or a picture (PNG or JPEG) whose contents agree with its file extension opens in a new tab. Every other file is
  downloaded, so that a file that claims to be something else is never shown in the app.
- *Add a file to the plan* keeps files from the computer with the plan, for example a review statement.

A GeoPackage with many layers that is not a plan can be one dataset in the same way, see
[Map layers](kartor.md#map-layers-a-geopackage-with-many-layers).

## A new comprehensive plan

*New comprehensive plan* among the sources in Import makes an empty digital comprehensive plan to build with AI or by hand, the way
*New building model* does for buildings. The form has:

- the plan's name (else *Comprehensive plan* and the municipality's name);
- the municipality, from the municipal boundaries that ship with the app. With *The whole municipality as the plan area* the
  municipal boundary becomes the plan's plan geometry, so that the map shows the plan area from the start;
- the coordinate system: SWEREF 99 TM unless another is chosen, or one of the local SWEREF 99 zones. It is the system the AI reads
  and writes coordinates in; the delivery is always written in SWEREF 99 TM;
- a description for the AI, which is kept with the plan.

*Create the plan* makes a plan in Boverket's ÖP model with a new objektidentitet, empty tables for the plan description and the
links and, with a municipality chosen, the plan geometry. Nothing is fetched from the net. The plan opens in the plan view as a
delivered plan does: it can be edited, built with AI and exported as a delivery. *Build the plan with AI* opens it with the AI
panel in the mode *Build from brief* and the description filled in.

## A new detailed plan

*New detailed plan* among the sources in Import makes an empty digital detailed plan per the national specification, in the
same form as the detailed plans the app reads. The form has:

- the plan's name (else *New detailed plan*) and its designation at the municipality, for example DP 2026:4;
- the municipality, from the municipal boundaries that ship with the app. The municipality's code goes with the plan and the
  export;
- the coordinate system: SWEREF 99 TM unless another is chosen, or one of the local SWEREF 99 zones. The plan is exported in it;
- the plan's purpose.

*Create the plan* makes a plan with a new object identity and today's date as begun, without objects. Nothing is fetched from
the network. *Draw the plan* opens it in the plan view with *Edit the plan* on.

In edit mode the bar above the map chooses what is drawn: *Plan boundary*, *Use area* or *Property area*.

- The plan boundary and the use areas are areas; a property area can also be a line (an exit ban, for example) or a point. The
  plan has one plan boundary: drawn again, the one there is gets the new shape.
- For a use or property area the provision is chosen from Boverket's catalogue of plan provisions (BFS 2020:5). The list has the
  most common provisions first: the uses of kvartersmark, allmän plats and water (B, C, D, E, H, J, K, P, S, T, Z, W, GATA, TORG,
  PARK, NATUR) and the properties prickmark, korsmark, largest building area, highest ridge and total height, largest roof
  angle, smallest plot size, exit ban and lifted shore protection. *Search the catalogue* searches every provision in force.
- The catalogue ships with the app (release 2025-12-01), so all of this works without the network. A newer release can be read
  from Boverket with the source *Boverket Planbestämmelsekatalogen* under Import, after consent.

A new area gets a new object identity and the provision's catalogue reference, code, category, use form, designation and
colour. Click an area to change it in the inspector:

- choose another provision;
- fill in the provision's values, for example the height in *Högsta nockhöjd är [höjd] meter*. The formulation is filled in
  with the value, and the template is kept with the area;
- change the designation on the plan map (e1, for example) and write the motive;
- *Edit the shape*, *Move* and *Remove the area*, as for a comprehensive plan.

Every change is a step in the dataset's log and is undone with *Undo* in the edit bar.

*Export as detailed plan* in the toolbar, and the format *Detailed plan: national specification (GeoJSON)* in Export, save
the plan as the exchange model in GeoJSON (`application/vnd.lm.detaljplan.v4+json`):

- one object `detaljplan` with the plan's facts, the plan boundary and the decision information;
- one object per provision with the catalogue reference, the formulation and its values, the motive and the geometry.

The geometry is written in the plan's coordinate system to the millimetre. The file reads back as the same plan, with the same
objects, provisions and values. The municipality's name then comes from the municipal boundaries, since the specification
gives only its code. A plan without a plan boundary is not exported. Detailed plans read from a file can be edited and exported
the same way, except plans from the other Nordic countries.

## Edit the plan

A digital comprehensive plan can be edited in the plan view: the plan description's sections, the areas on the plan map and
the links between them. Choose *Edit the plan* in the toolbar; *Done* leaves editing. Each change is saved at once as a step in
the dataset's log and can be undone with *Undo* in the edit bar, one change at a time. Versions work as for other datasets.

### Sections and positions

In edit mode each section of the plan description has the buttons *Edit*, *Link the selected areas*, *Unlink the selected
areas* and *Delete*.

- *Edit* makes the heading, the text and the section type editable where the section stands. The text is plain text: each line
  is a paragraph, empty lines and double spaces are removed, and no formatting or HTML is kept.
- *New position* and *New section* at the top add a section at the end of the text document. It gets a bookmark made from its
  heading, for example `op_verksamheter_vid_hamnen`, which follows the exchange model's rule: a letter, then at most 39 letters
  (a–z), digits or underscores. The bookmark can be changed under *More options* and must be unique in the plan. When areas are
  chosen, the new section can be linked to them at once.
- *Delete* removes the section and all its links, after a question.

### Areas

The edit bar above the map chooses where new objects go: a layer of the plan or a theme of the ÖP model. *Draw an area*, *Draw
a line* and *Draw a point* draw on the map with Leaflet-Geoman: click the corners and finish on the first corner, or with
*Finish the shape*. A layer takes only its own kind of geometry, and the themes Area and Plan geometry only areas. The new area
gets a new objektidentitet (UUID) and goes into the theme's table in the plan map's GeoPackage file, for example
`innehall_op_lis_point`, when the plan has no such layer yet.

Click an area and the inspector can change it:

- the content type from the list (the ÖP catalogue's values from the plan's GeoPackage file, Boverket's land uses and the types
  the plan already has) or another one under *More options*, the name and the precision; *Save* saves them;
- *Edit the shape* shows the corners, which can be dragged, added and removed, and *Move* drags the whole shape; *Save the
  shape* saves and *Cancel* drops the change;
- *Remove the area* removes the area and its links, after a question.

The plan's counts of objects per theme and per layer are kept up to date.

### Links

Areas are chosen as elsewhere in the plan view: a click, Shift-click, *Select area* or Shift and drag. With areas chosen in edit
mode the inspector has *Link to a position*, which links them to the position or section chosen in the list. From the section's
side *Link the selected areas* does the same, and *Unlink the selected areas* removes the chosen areas' links to the section.
In the inspector's list of the sections that concern the chosen areas, *Remove the link* removes the link.

A link made here is kept in `_section_links` with the section's type and the source `redigerad`. *Read the links again* and *Add
a file to the plan* keep the links and sections made here, but text changed in a section that a Word file has is read from the
file again. Export the plan as a delivery first when the changes are to be in the files.

### With AI

*Ask AI* in the plan view's toolbar opens the AI panel in the inspector, with the same providers and policy as for building models
(see [Ask AI about the model](cad-bim.md#ask-ai-about-the-model)). The panel has three modes:

- *Ask*: the AI reads the plan with tools and answers. It reads the plan's facts, the plan description's sections in order, the
  areas with their theme, content type, name and place, the links, what you have chosen on the map and the features of other
  datasets shown on the map. *Choose n areas on the map* chooses the areas the answer rests on. The AI cannot change anything.
- *Change*: the AI proposes changes to the sections, the areas and the links.
- *Build from brief*: the AI plans and builds the plan from the description, with sections such as the plan's purpose and
  positions, areas on the plan map and the links between them. When something essential is missing it asks in the panel.

The AI never changes the plan itself. In the modes *Change* and *Build from brief* it fills a change set of the plan's own edits,
the same as above. The panel lists the steps, with the text of the new and changed sections under *Show the text*.

- *Preview* tries the changes on a copy of the plan and draws the areas on the map: new green, changed yellow and removed red and
  dashed. A step that cannot be made is shown with its error, and the change set cannot then be approved.
- *Approve* makes the changes one step of the dataset's log, with the provider, the model and the questions. *Undo* in the edit
  bar, or in the message shown, removes them at once.
- *Reject* drops the change set without touching the plan.

A change set that removes areas or sections is confirmed once more, and the AI may only remove something when you have asked for
it. The areas' shapes are given in the plan's coordinate system. The AI can also copy the shape of a feature of another dataset
shown on the map (the eye in the list of datasets), for example a detailed plan or a map layer, or of another area of the plan.
The shapes the AI draws itself are drafts: adjust them with *Edit the shape* and *Move*.

What goes to the AI provider is the plan's facts, texts, names and places and the features of other datasets shown on the map that
the AI reads, after consent for the provider's host. The AI panel belongs to the tier BIM and GIS.

### Export as a delivery

*Export as a delivery* in the toolbar, and the format *Delivery: GeoPackage and plan description (ZIP)* in Export, download a
ZIP file with:

- the plan map as a GeoPackage file in Boverket's ÖP model 0.4: a content table per theme and geometry
  (`innehall_op_<tema>_polygon`, `_line` or `_point`, the area and the plan geometry in tables of their own) with Boverket's
  column names in SWEREF 99 TM, and the tables `oversiktsplan` (with the decision when it is known), `dokumentavsnitt` (a row
  per bookmark and object; a link to the whole plan points to the plan's objektidentitet), `avsnittsbokmärke`,
  `dokumentreferens_op` and `innehall_op_beror_annat_innehall`. Every link is written, whatever its source;
- the plan description as a Word file, one per document the sections are in: each section is a heading and its paragraphs
  inside a Word bookmark with the section's name;
- the plan's other files as they came, for example appendices, background material and metadata. The GeoPackage file the plan
  was read from is replaced, and the manifest is left out, since its checksums no longer hold.

The delivery can be imported again in Import and gives the same areas, sections and links.

## Coordinate and height systems

Detailed development plans to NGP are made in SWEREF 99 TM or in the municipality's local SWEREF 99 zone with heights in
RH 2000, and the file names both (`koordinatsystemPlan` and `hojdsystem`). Comprehensive plans are usually in SWEREF 99 TM.
The inspector shows the plan's coordinate system and, for a plan with heights, the height system; a GeoPackage file names no
height system, and the inspector then says so.

The plan map is drawn as a web map (Web Mercator with north up, where OpenStreetMap or map tiles from OGC API – Tiles can be the background) or in the plan's
own system: choose it in the toolbar, for example *SWEREF 99 16 30*. The grid's north is then up as on the plan map, and
every object lies at its coordinates. The background can then come from a WMS service that offers the same system: choose
*WMS service* as background map and give the address and layer (*Read layers* fetches the service's layer list and says
when the layer lacks the system). OpenStreetMap exists as a web map only. The background is fetched after consent, like
other background maps, and *Save as map view* saves a web map.

A plan in a coordinate system the app cannot convert is read with all its objects, but the objects are not drawn, since
they would land in the wrong place: Import and the inspector say which system the file names, and the objects are listed
under *objects without a place on the map*. Which systems the app converts is listed in [kartor.md](kartor.md#coordinate-systems).

## Plans from planning tools

Plans drawn in a planning tool are read like all plans of the same kind, whichever tool made them. One example is [Rita Detaljplan and Rita Översiktsplan](https://github.com/ritaplan), plug-ins for QGIS. What they save and deliver opens like this:

| File | Opens as |
|---|---|
| The detailed plan's delivery file to NGP (JSON, Detaljplan 4.1) | Plan map with designations and colours from the catalogue |
| Detailed development plan in GeoPackage with the national specification's field names | Plan map with the plan's own designations and colours, the motives and the heights |
| The comprehensive plan's delivery file to NGP (JSON, Översiktsplan 2.0) | Comprehensive plan per theme with its decision |
| Comprehensive plan in GeoPackage (Boverket's database model 0.4) | Comprehensive plan per theme with decision, links and the plan document's sections |
| Archive package (folder or ZIP file with `metadata/PREMIS.xml`) | The plan from the folder `content` with the documents, and the check of the files |

Drop the file in Import, or fetch it with *Web address* when it is on the web (for example a plan the municipality publishes); a file without an extension is recognised by its content type. An archive package is dropped as a folder or as a ZIP file: the app reads the plan from the folder `content` (the GeoPackage first, else the delivery file), keeps the package's files with the plan and compares each file with its checksum (SHA-256) in `PREMIS.xml`. The inspector shows under *Archive package* whether the files match, which have changed or are missing, and opens the documents (plan map and plan description) in a new tab. Only PDF files and pictures (PNG, JPEG) whose extension and content agree open in a tab; other files in the package, such as XML, HTML and SVG, are downloaded instead. A place that points outside the package is not checked and never read. An ordinary folder with the plan's GeoPackage and text document can become one plan (see below); switched off, the documents are opened on their own, as documents.

## A digital comprehensive plan in several files

A digital comprehensive plan is often delivered as a folder, a ZIP file or a few files: one or more GeoPackages (the plan
map in Boverket's ÖP model and perhaps planning data), one or more Word files (the text document and appendices) and
sometimes a `manifest.xml` and a `metadata.xml`. Drop the folder, the ZIP file or the files in Import. The step that sorts
the files then has the choice **Digital comprehensive plan (all files as one plan)**. It is on when a GeoPackage follows
the ÖP model or links its objects to the text in another way (see [How the links are read](#how-the-links-are-read)); off, each
file is imported on its own as before.

On, all the files become one dataset of the kind plan:

- **The files are recognised by their contents**, not their names: a GeoPackage by its SQLite header and its tables, a
  Word file by its parts in the ZIP file and a manifest or metadata file by its root element. Each file is kept in the plan
  with its role: *plan map* (the GeoPackage in the ÖP model, else the one that links its objects to the text), *planning data*
  (other GeoPackages), *text document* (the Word file the GeoPackage refers to by name or link, else the only one or the one
  with most of the plan's bookmarks), *appendix* (other Word
  files and PDF files), *manifest*, *metadata* and *other*.
- **Every layer with objects** becomes rows of the plan. The column `lager` says which table of the GeoPackage the row
  comes from and `fil` which file. The layers are recognised by `gpkg_contents` (value lists and link tables are no layers),
  with their names from there. Empty layers are left out. Layers with the endings `_point`, `_line` and `_polygon` are read,
  and so are `_punkt` and `_linje`.
- **The text document's sections**: every bookmark in the Word files becomes a section with its text, also when the
  bookmark spans several paragraphs, and the nearest heading before it. The GeoPackage links the bookmarks to the objects on
  the map, see [How the links are read](#how-the-links-are-read). A ställningstagande (the municipality's position) can
  concern several areas, and an area can have several sections. A section can also concern the whole plan. The section type
  (for example *Ställningstagande*) is read from the GeoPackage, by the ÖP catalogue's id or by its name.
- **Manifest and metadata** have no formal role in an ÖP delivery. They are read when present and never required. The
  plan's facts are always read from the GeoPackage. Checksums in the files (SHA-1, SHA-256, SHA-384 and SHA-512) are
  compared with the files; other algorithms, such as MD5, are said not to be checked.
- **Warnings** are kept with the plan and shown in Import before the import. Examples are a bookmark the GeoPackage names
  but the text document lacks, a text document the GeoPackage refers to but that was not delivered, a checksum that does
  not match and bookmarks whose names do not follow the exchange model's rule. Such a bookmark is read all the same. The
  warnings also say how many links were read, see below.

### How the links are read

Boverket's model links an object to a bookmark in the table `dokumentavsnitt`. Files from other tools, or written by hand or by
an AI, do it in other ways. The app reads the links in this order, and a weaker source only adds links for objects that no
stronger source has linked:

1. **The ÖP model's `dokumentavsnitt`**, also when its columns have other names, for example `objekt_id`, `omrade_id` or
   `objektidentitet_omrade` for the object and `bokmarke` for the bookmark.
2. **Another table of links**: a table with a column for the object's id and one for the bookmark or section, for example
   `objektreferens` with `objekt_id` and `identitet_i_dokument`.
3. **Columns on the areas** that name their bookmarks or positions, for example `bokmarke`, `stallning_id`,
   `stallningstaganden` or `avsnitt`, with one or more values separated by commas or semicolons.
4. **The text**: areas a section names, such as "Kopplade områden: Trossö, Lyckeby" or "gäller områdena A2 och A3". Only
   sections that no other source links are read this way. These links are inferred and shown as *Named in the text*, never as
   links from the files.

Ids are compared without braces, quotes and spaces and regardless of case. An object is found by its id, its other id columns,
`<layer>:<fid>` or a table that gives the layer and feature of each id (such as `kartobjekt`). An object without an object
identity gets `<layer>:<fid>` as its id. A bookmark is found by its name, regardless of case, without a prefix such as `op_`, or
by its heading. A table of the positions' text (such as `stallningstagande` with bookmark and text) makes the sections positions
and gives their text when the Word file is missing, and a table of keys and values (such as `planmetadata`) gives the plan's id,
municipality and status.

The plan's warnings and the *Files* tab say how many links were read and from where, how many areas and positions have no link
and, when the plan has none, why: no text document, no table of links, no columns on the areas, no names in the text, or ids
that no area has.

### The tables and files added later

The sections are in the table `_sections` (avsnitt, dokument, rubrik, text, typ, ordning) and the links in `_section_links`
(avsnitt, objektid, dokument, typ, kalla). An empty objektid is the whole plan, and kalla says where the link was read: modell,
tabell, attribut or text. Both can be read with SQL in Analyse. A GeoPackage in the ÖP model imported on its own with *The whole comprehensive plan as a plan* gets the same tables,
with the headings from the GeoPackage, and a warning that the text document is missing. A text document added to the plan
later is read the same way, and the sections and links are made anew; one with the name of a document in the plan replaces it.

Nothing in the files runs and nothing is fetched. Macros in a Word file are never run, links to other places are not
followed, and the text is only ever shown as text. An XML file with a document type declaration (DOCTYPE) is not read. Nor
is a part of a Word file that unpacks to more than 64 MB.

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

## Plans from the other Nordic countries

The app also reads the neighbours' digital plans and draws them as plans in each country's map colours (the shades
are the app's; the column `farg` carries the colour name). Boverket's catalogue applies to Swedish plans only, so the
Plan tab shows summary, provisions and areas for these.

| Country | Detailed plan / comprehensive plan | How to get them |
|---|---|---|
| Denmark | lokalplan (sub-areas, building fields) / kommuneplanrammer | The source *Plandata.dk (WFS)*: **Fetch plan** with a planid or plan number fetches the local plan with its sub-areas and building fields; a layer (such as kommuneplanrammer) is fetched as a map and kept with *Save as plan*. GeoJSON files from Plandata are recognised by their contents. Colour per general use: housing yellow, business purple, centre brown, recreation green, public purposes blue, technical facilities grey, summer houses orange, rural light green. |
| Finland | asemakaava / yleiskaava | A plan in the national plan data model (Ryhti JSON with `planObjects` and `planRegulationGroups`) is imported as a file: the plan objects' use regulations get the map letter (AK, VP …) from the code list RY_Kaavamaarayslaji (embedded copy) and the Finnish plan map colours; other regulations become property provisions. The source *Ryhti kaavatiedot* gives the plan index (valid and pending plans with links to the documents) as table and map; Helsinki's avoindata WFS has the city's plan index and plan units. |
| Iceland | deiliskipulag / aðalskipulag | The source *Skipulagsstofnun skipulagsgögn (ArcGIS)*: **Fetch plan** with the plan number fetches boundary, lots, building rights, restrictions and transport (five layers); `ask:` before the number fetches a master plan with its land-use classes (ÍB, M, VÞ …). A GeoPackage per Skipulagsstofnun's template is imported whole with *The whole plan as a plan*. |
| Norway | reguleringsplan / kommuneplan | Vector data needs a Norge digitalt agreement: download the plan as GeoPackage from Geonorge and import it whole (the tables RpOmråde, RpArealformålOmråde, RpBestemmelseOmråde, consideration zones and more); the arealformål codes get names from the embedded code list and colours per main purpose (buildings yellow, centre brown, business purple, transport light grey, green structure green, LNFR light green, sea blue). DiBK's WMS `https://nap.ft.dibk.no/services/wms/reguleringsplaner/` can be a background in the map view. |

Coordinates in ETRS89 UTM 32–35, ETRS-TM35FIN, the Finnish GK zones and ISN93 are converted to WGS 84. Limits: Ryhti
holds plans approved from 2024 (nationwide from 2029); Icelandic plans before 2025 have only a boundary; Plandata stores
provisions as codes and numbers, not as text.

## Limitations

- Boverket's colours are named in the regulations; the shades in the app are its own. Symbol designations (dotted
  land, crossed land and others) are drawn as outlines with the designation, not with Boverket's symbols.
- Provision descriptions, planning materials and decision documents come along only as text (motives) or as facts in
  the plan's metadata; the documents are not fetched.
- Areas are planar computations in SWEREF 99 TM; for plans in local zones the error is negligible.
- Lantmäteriet's detailed-plan API requires a key; the app is tested against the documented model with its own test data.
- A section without a link gets no section type in an exported GeoPackage file, since the ÖP model keeps the type on the link;
  its heading and text are in the Word file.
- The export writes the sections one after another; sections whose bookmarks overlapped in the original document then repeat text.
- Decision documents, background material and external references in the original GeoPackage file are not exported, only the
  decision's diary number and dates.
