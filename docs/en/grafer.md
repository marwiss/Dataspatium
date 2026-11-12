# Graphs: nodes, edges and Cypher

Dataspatium handles graphs (networks of nodes and edges) as a dataset kind of their own. A graph is imported from
GraphML, GEXF, JSON with nodes and edges or a Cypher script, or built from two tables. The nodes are the dataset's rows
(id, label, name and properties as JSON), the edges live in the dataset's own table `_edges` (id, kalla = source,
mal = target, typ = type, egenskaper = properties) and the node positions in `_layout`. The graph opens as a graph
view in Process and gets the tabs **Cypher** (after SQL) and **Graph** (after Regex) in Analyse. The node table is
always one click away.

## Formats read and written

| Format | Extension | Read | Written | Note |
|---|---|---|---|---|
| GraphML | .graphml | yes | yes | The attribute `labels` (or `label`) gives the node label, the edge `label` its type, as in Neo4j's export |
| GEXF 1.2/1.3 | .gexf | yes | yes | Gephi's format; the node attribute `labels` or `type` gives the label |
| JSON with nodes and edges | .json | yes | yes | `{nodes: [...], edges|links: [...]}` as in D3 and networkx, Cytoscape's `{elements: {nodes, edges}}`, Neo4j's `{nodes, relationships}` |
| Cypher script | .cypher, .cql | yes | yes | As APOC exports: `CREATE (:Label {…, \`UNIQUE IMPORT ID\`: 1});` and `MATCH … CREATE (n1)-[:TYPE {…}]->(n2);`, plain `CREATE` scripts too |

JSON and XML files are recognised by their contents, so drop the file in Acquire: the graph's facts (nodes, edges,
labels, relationship types) appear and *Import* creates the graph. Export happens in Export, where a graph gets the
formats GraphML, GEXF, JSON and Cypher script besides the table formats for the nodes.

## Graph from two tables

The button **Make graph from tables** in Manage (on a table) opens a dialog: choose the edge table with the columns for
the edge's start and end (and preferably the relationship type), and if you like a node table with id, label and
name. The other columns become properties. Nodes that only appear in the edges are created automatically. Directed or
undirected is chosen in the dialog.

## The graph view in Process

The graph view is drawn with Cytoscape and never shows more than the current view (a few thousand elements at most),
while the graph itself may have hundreds of thousands of edges.

- **Overview per label**: every label is a collapsed group with a count; double-click to open the group. Large graphs
  show the groups with the number of edges between them; a double-click opens the label's nodes in focus.
- **Focus**: a subgraph that grows step by step. Search for a node (name, id or property) or click a label in the
  legend, double-click a node or press *Show neighbours* to fetch the neighbourhood. At most 2,000 nodes.
- **Whole graph**: WebGL drawing with sigma for tens to hundreds of thousands of elements; labels appear when zoomed
  in. The positions are kept in the dataset so the graph opens quickly next time.
- Layouts: force-directed (fCoSE), hierarchical (dagre), grid, circle and concentric. *Save layout* keeps the
  positions. Click a node or edge for its properties in the inspector.

## Cypher in Analyse

The Cypher tab takes a query in a Cypher subset, translates it to SQL over the dataset's tables (nodes in `data`,
edges in `_edges`, properties through `json_extract`) and shows both the result and the SQL. The result can be saved
as a dataset or downloaded as CSV.

The subset: `MATCH` and `OPTIONAL MATCH` with node and relationship patterns (labels, types with `|`, property maps,
direction, variable length `*1..5` with at most 10 steps), `WHERE` with comparisons, `AND`/`OR`/`NOT`, `IN`,
`IS NULL`, `STARTS WITH`, `ENDS WITH`, `CONTAINS` and arithmetic, `RETURN` with `DISTINCT`, aliases and the aggregates
`count`, `sum`, `avg`, `min`, `max`, `collect` (with Cypher's implicit grouping), `ORDER BY`, `SKIP`, `LIMIT`, and the
functions `id()`, `labels()`, `type()`, `toLower()`, `toUpper()`, `size()`, `coalesce()`, `exists()`, `keys()`.
Properties are reached as `n.property`; `n.name` gives the node's name even when it is not a property. Writing
clauses (`CREATE`, `MERGE`, `SET`, `REMOVE`, `DELETE`) become recipe steps, see *Editing the graph*. `WITH`, `UNWIND`,
`shortestPath` and regular expressions are not included; the shortest path is a tool in the Graph tab.

Examples:

```cypher
MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, type(r), b.name LIMIT 50
MATCH (a)-[r]->(b) RETURN labels(a) AS fran, type(r) AS relation, labels(b) AS till, count(*) AS antal ORDER BY antal DESC
MATCH (p:Person)-[*1..3]-(q:Person) WHERE p.name = 'Anna' RETURN DISTINCT q.name
```

## The Graph tab

- **Summary**: nodes, edges, density, average and maximum degree, isolated nodes, self-loops, components, degree
  distribution and the most connected nodes.
- **Degree**: out-, in- and total degree per node.
- **Components**: weakly connected components and their sizes.
- **Shortest path**: between two nodes (id or name), with or without regard to direction.
- **Subgraph**: choose labels and relationship types and save the selection as a new graph.
- **Tables**: the nodes and edges as ordinary tables with the properties as columns.

The measures are computed in a background thread on the whole graph (compact adjacency lists), so a graph with a
million edges gets degrees and components in a few seconds.

## R and Python

The graph's SQLite file is mirrored to R and Python like every dataset. `dm_read("Graph")` gives the nodes;
`dm_read_nodes()` and `dm_read_edges()` give nodes and edges with the properties as columns:

```r
nodes <- dm_read_nodes("Graph")
edges <- dm_read_edges("Graph")
library(igraph)
g <- graph_from_data_frame(edges[, c("kalla", "mal", setdiff(names(edges), c("id", "kalla", "mal", "typ")))], vertices = nodes)
degree(g)
```

```python
import networkx as nx
nodes = dm_read_nodes("Graph"); edges = dm_read_edges("Graph")
g = nx.from_pandas_edgelist(edges, "kalla", "mal", edge_attr=True, create_using=nx.DiGraph)
nx.pagerank(g)
```

## Editing the graph

The graph view edits the graph with the buttons under *Edit* in the inspector: **Add node** (id, label, name and
properties as `key: value` per line), **Edit** and **Remove** for the selected node or edge, **Pick as start** followed by
**Connect** to draw an edge between two nodes, and **Merge**, which moves the edges of the picked nodes to the selected
one and fills in missing properties. Every change is a recipe step (group Graph: add node, change nodes, remove nodes,
merge nodes, add edge, change edges, remove edges) that is logged, can be undone and replays on a new version of the
graph; the recipe's SQL and R show what was done.

The same steps come from writing Cypher in the Cypher tab: `CREATE (a:Person {id: 'p9', name: 'Xenia'}),
(a)-[:KNOWS {since: 2020}]->(b)`, `MERGE (c:City {id: 'c2', name: 'Göteborg'})`, `MATCH (n:Person) WHERE n.age > 40
SET n.senior = true, n:Senior`, `MATCH (n {id: 'p1'}) REMOVE n.age`, `MATCH (a)-[r:KNOWS]->(b) DELETE r` and
`MATCH (n {id: 'c1'}) DETACH DELETE n`. The reading part (MATCH … WHERE) decides which nodes and edges are touched, the
writing part becomes steps; values are literals.

## Neo4j as a source

*Neo4j* under *Add sources* in Acquire (the family **Neo4j (Bolt)**, also in *Database source*): address (`neo4j+s://…databases.neo4j.io` for Aura or an
own server), database, user name and password (never stored in clear text). The source opens a Cypher editor; *Run*
connects with Neo4j's driver over WebSocket after your consent (purpose Neo4j) and shows the result as a table where
nodes and relationships are flattened to their properties. When the answer holds nodes and relationships, **Save as
graph** keeps them as a graph dataset; otherwise *Save as dataset*. **Keep query** stores the query on the source so it
runs again with one click. Bolt over WebSocket is not subject to CORS; an own server without TLS (`bolt://`) is reached
only from a page over http://. When the answer holds nodes, they are drawn as a graph as well.

## IFC-LPG on a Dataregium server

Dataregium turns every uploaded IFC file into a graph: one node per entity, with its class and all its supertypes as labels and
the IFC attributes as properties, and relationships named after the attributes (`IS_DEFINED_BY`, `RELATED_OBJECTS`,
`HAS_PROPERTIES`). The graph lives on the server and can be far larger than is reasonable to fetch. So it is drawn and queried
directly from *Import*, and nothing is saved until you ask for it.

There are two ways to the graph, and both give the same view:

- **The card IFC-LPG in the OpenCDE source.** The queries go through the server's read-only graph query, which needs you to
  sign in as an administrator and the server to have `OPENCDE_GRAPH_QUERY_ENABLED=true`. This is the way in production: no
  database port has to be open, the server limits rows and time, removes stored hashes and logs every query.
- **A Neo4j source.** Bolt with the database's address, user name and password, for example `bolt://127.0.0.1:7697` on a
  development stack. Bolt gives access to the whole database, so the app always reads in a read session and removes stored
  hashes from the answers. In production Bolt is closed unless whoever runs the server has opened it; the card then shows the address.

**Show models** lists the models in the graph, the newest version of each document first. Choose a model and a view:

| View | Shows |
|---|---|
| Spatial structure | Project, site, building and storeys, with the relationships between them |
| Elements per storey | Which elements each storey contains |
| Elements and types | The elements and their types |
| Elements and materials | The elements and their materials |
| Properties and quantities | The elements' property sets and quantities |
| Issues and elements | BCF issues, their viewpoints and components, and the elements they point at; the component and the element share a GUID, and the app draws the line `IFC_GUID` between them itself |
| The whole model | Up to 1,000 relationships in the model |
| Count per class | A table of the number of entities per class |
| Geometry per class | A table of the number of geometry nodes per class: representations, solids, profiles, placements, styles and layers |

From Dataregium 3.0.0 the geometry is stored as a skeleton: representations, solids, profiles, placements, contexts, styles,
colours and layers are nodes, while points, meshes and curves lie as STEP text in blocks. The views The whole model and
Count per class leave the skeleton's nodes out so that the elements show; Geometry per class counts them, and Neighbours on
an element shows its shape and placement. The list of models says which form a model has (skeleton, blocks or nodes). A
point list, when all geometry is nodes, shows as coordinates `x y z`.

The answer is drawn with Cytoscape, with the table under it. Nodes are coloured by what they are: spatial structure, element,
relationship, type, property or quantity, material and other. Layout and labels change without asking the server.

Click a node and the inspector shows its attributes. **Neighbours**, or a double click on the node, fetches its neighbours from
the server and adds them to the picture. An element also has **Properties**, **Issues** and **Show in the model**, which opens
the element in 3D if the model is in the workspace.

In the box you write your own Cypher, all the server understands, but only reading. If you ask only for nodes (`RETURN c, w`), the
app also fetches the relationships between them, as Neo4j Browser does. The app says when an answer has reached the query's
`LIMIT` or was cut, and reading stops at 20,000 rows. Answers with more than 1,500 nodes are not drawn here, but can be saved and
opened as an overview in Process. The graph from Dataregium 3.0.0 also holds what it takes to write the file back (`<attribute>__type`, `<attribute>__step` and `StepBlock` nodes with their text). It stays out when a node is shown or saved, and can be asked for by name.

**Save as graph** makes what you see an ordinary graph dataset: the graph view in Process, the tabs Cypher and Graph in Analyse and
graph charts in Visualise. The class becomes the node's label and all labels stay, so `MATCH (w:IfcWall)` also finds an
`IfcWallStandardCase` in the copy. In the Cypher tab you can turn on **Run on the server** for a graph saved from here, and the
server then answers with all of Cypher against the whole graph, instead of the subset against the copy.

An IFC model fetched from Dataregium has the button **IFC-LPG** in Manage, and for a chosen element in Process. It opens the model's
graph in Import, in a Neo4j source on the same machine if there is one, otherwise in the OpenCDE source.

From IFC-LPG `d042134` the server can compute a box per product in project coordinates (metres): `bbox_min`, `bbox_max` and
`bbox_centre` as points on the product's node, and the model node says when the boxes were computed (`spatial_at`), for how many
products (`spatial_products`) and how many failed (`spatial_failed`). The boxes exist only where the server has run the computation,
so query with `bbox_centre IS NOT NULL`. The example *Products near a product* in the Neo4j source lists what lies within 1.2 m of a
product's centre with `point.distance`, the same in Neo4j and Memgraph.

The server states in its capabilities document which database holds the graph (`graph_store`: `neo4j` or `memgraph`, later `grafeo`
or `postgresql`). In a database other than Neo4j and Memgraph, such as Grafeo, the boxes are lists of numbers and not points: the card
IFC-LPG then leaves out the examples that need points, such as *Products near a product*, and a box still reads as `x y z`, just like a point.

## More tools in the Graph tab

- **PageRank** (damping 0.85), **Communities** (label propagation, numbered by size) and **Centrality** (harmonic
  closeness and betweenness per Brandes, estimated from a sample of start nodes in large graphs), all computed in the
  background thread and saveable as datasets.
- **Pattern**: a query without code: from label, relationship, to label, direction and one condition on the from node's
  property. The query is built as Cypher, shown under the result and can be copied to the Cypher tab.
- **Layout**: force-directed layout of the whole graph in the background (Fruchterman–Reingold with a grid); the
  positions are kept and used by the whole-graph view.

## Graph charts in Visualise

**Save as chart** in the graph view, or *New chart* → *Graph* in Visualise, gives a graph chart: graph dataset, view
(overview, focus with searched nodes, whole graph), layout and labels. The chart exports as SVG, PNG and PDF (own SVG
drawing from the node positions), joins dashboards and published pages as inline SVG, and batch runs and document
templates like other charts.

## Limitations

- Cypher lacks `WITH`, `UNWIND` and `shortestPath` in the local subset (*Run on the server* has them for a graph from a server); the Neo4j source is read-only (writing happens in the app's own graphs).
- The overview with expandable groups applies to graphs up to 5,000 elements; larger graphs are shown as groups with
  counts and in the focus and whole-graph views.
- Properties are stored as JSON text; numbers compare as numbers in Cypher but sort as text in the node table.
