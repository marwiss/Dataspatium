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
only from a page over http://.

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

- Cypher lacks `WITH`, `UNWIND` and `shortestPath`; the Neo4j source is read-only (writing happens in the app's own graphs).- The overview with expandable groups applies to graphs up to 5,000 elements; larger graphs are shown as groups with
  counts and in the focus and whole-graph views.
- Properties are stored as JSON text; numbers compare as numbers in Cypher but sort as text in the node table.
