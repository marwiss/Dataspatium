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
| National specification Detaljplan (Lantmäteriet, version 4) | GeoJSON with `feature:typ` (detaljplan, anvandningsbestammelse, egenskapsbestammelse, administrativBestammelse, beslutsinformation, planbestammelsebeskrivning) or `feature:mediatyp application/vnd.lm.detaljplan.v4+json` | Plan area, provisions with catalogue reference, formulation and value, decision facts (started, adopted, legal force, implementation period), motives |
| Reference objects from the national geodata platform | STAC items with `properties.detaljplan` and `properties.planbestammelse` (the answer of Lantmäteriet's detailed-plan API) | The plan's facts, the provisions' formulation, catalogue reference, category and value |
| National specification Översiktsplan (test version 1.0) | GeoJSON with `feature:typ` oversiktsplan, innehallOP, beslutOP | The plan's facts and content objects with content type, name, specification and plan event |
| Boverket's ÖP model (GeoPackage) | Tables `innehall_op_<theme>_<geometry type>` and `oversiktsplan` | Every content layer as one plan with a theme per layer |

Coordinates in SWEREF 99 TM and the local SWEREF 99 zones (EPSG:3006–3018, read from `koordinatsystemPlan`) as well
as Web Mercator are converted to WGS 84. A GeoJSON file is recognised by its contents, not its extension: drop it in
Acquire and the plan's facts appear with the button *Import*. A GeoPackage in the ÖP model gets the choice *The
whole comprehensive plan as a plan*; switched off, one table at a time is imported as before.

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

A comprehensive plan is drawn per theme: land and water use filled per content type, other themes with one colour
per theme and switchable visibility. The inspector shows the area per land and water use.

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
- Lantmäteriet's detailed-plan API requires a key; the app is tested against the documented model with its own test data.
