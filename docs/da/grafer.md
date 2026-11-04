# Grafer: knuder, kanter og Cypher

Dataspatium håndterer grafer (netværk af knuder og kanter) som en egen type datasæt. En graf importeres fra GraphML,
GEXF, JSON med knuder og kanter eller et Cypher-script, eller bygges af to tabeller. Knuderne er datasættets rækker (id,
etiket, navn og egenskaber som JSON), kanterne ligger i datasættets egen tabel `_edges` (id, kalla = fra, mal = til, typ,
egenskaper) og knudernes positioner i `_layout`. Grafen åbnes som grafvisning i Bearbejd og får fanerne **Cypher** (efter
SQL) og **Graf** (efter Regex) i Analysér. Tabellen med knuderne er altid ét klik væk.

## Formater der læses og skrives

| Format | Filtype | Læses | Skrives | Bemærkning |
|---|---|---|---|---|
| GraphML | .graphml | ja | ja | Attributten `labels` (eller `label`) giver knudens etiket, kantens `label` dens type, som i Neo4j's eksport |
| GEXF 1.2/1.3 | .gexf | ja | ja | Gephis format; knudeattributten `labels` eller `type` giver etiketten |
| JSON med knuder og kanter | .json | ja | ja | `{nodes: [...], edges|links: [...]}` som i D3 og networkx, Cytoscapes `{elements: {nodes, edges}}`, Neo4j's `{nodes, relationships}` |
| Cypher-script | .cypher, .cql | ja | ja | Som APOC eksporterer: `CREATE (:Etiket {…, \`UNIQUE IMPORT ID\`: 1});` og `MATCH … CREATE (n1)-[:TYPE {…}]->(n2);`, også almindelige `CREATE`-scripts |

JSON- og XML-filer genkendes på indholdet, så slip filen i Indsaml: grafens oplysninger (knuder, kanter, etiketter,
relationstyper) vises, og *Importér* opretter grafen. Eksport sker i Eksportér, hvor en graf får formaterne GraphML,
GEXF, JSON og Cypher-script ud over tabelformaterne for knuderne.

## Graf af to tabeller

Knappen **Lav graf af tabeller** i Håndter (på en tabel) åbner en dialog: vælg kanttabellen med kolonnerne for kantens
begyndelse og slutning (og gerne relationstype), og hvis du vil en knudetabel med id, etiket og navn. De øvrige kolonner
bliver egenskaber. Knuder, der kun optræder i kanterne, oprettes automatisk. Rettet eller urettet vælges i dialogen.

## Grafvisningen i Bearbejd

Grafvisningen tegnes med Cytoscape og viser aldrig mere end den aktuelle visning (højst nogle tusinde elementer), mens
grafen selv kan have hundredtusinder af kanter.

- **Oversigt pr. etiket**: hver etiket er en sammenfoldet gruppe med antal; dobbeltklik for at folde gruppen ud. Store
  grafer viser grupperne med antal kanter imellem dem; dobbeltklik åbner etikettens knuder i fokus.
- **Fokus**: en delgraf, der vokser trin for trin. Søg en knude (navn, id eller egenskab) eller klik på en etiket i
  signaturforklaringen, dobbeltklik på en knude eller tryk *Vis naboer* for at hente naboskabet. Højst 2.000 knuder.
- **Hele grafen**: WebGL-tegning med sigma for titusinder til hundredtusinder af elementer; etiketter vises ved
  indzoomning. Positionerne gemmes i datasættet, så grafen åbnes hurtigt næste gang.
- Layouts: kraftbaseret (fCoSE), hierarkisk (dagre), gitter, cirkel og koncentrisk. *Gem layout* gemmer positionerne.
  Klik på en knude eller kant for dens egenskaber i inspektøren.

## Cypher i Analysér

Fanen Cypher tager en forespørgsel i en Cypher-delmængde, oversætter den til SQL mod datasættets tabeller (knuder i
`data`, kanter i `_edges`, egenskaber med `json_extract`) og viser både resultatet og SQL'en. Resultatet kan gemmes som
datasæt eller hentes som CSV.

Delmængden: `MATCH` og `OPTIONAL MATCH` med knude- og relationsmønstre (etiketter, typer med `|`, egenskabskort,
retning, variabel længde `*1..5` med højst 10 trin), `WHERE` med sammenligninger, `AND`/`OR`/`NOT`, `IN`, `IS NULL`,
`STARTS WITH`, `ENDS WITH`, `CONTAINS` og aritmetik, `RETURN` med `DISTINCT`, aliasser og aggregaterne `count`, `sum`,
`avg`, `min`, `max`, `collect` (med Cyphers implicitte gruppering), `ORDER BY`, `SKIP`, `LIMIT` samt funktionerne `id()`,
`labels()`, `type()`, `toLower()`, `toUpper()`, `size()`, `coalesce()`, `exists()`, `keys()`. Egenskaber nås som
`n.egenskab`; `n.name` giver knudens navn, også når det ikke er en egenskab. Skrivende sætninger (`CREATE`, `MERGE`,
`SET`, `DELETE`), `WITH`, `UNWIND`, `shortestPath` og regulære udtryk indgår ikke; korteste vej findes som værktøj i fanen Graf.

Eksempler:

```cypher
MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, type(r), b.name LIMIT 50
MATCH (a)-[r]->(b) RETURN labels(a) AS fra, type(r) AS relation, labels(b) AS til, count(*) AS antal ORDER BY antal DESC
MATCH (p:Person)-[*1..3]-(q:Person) WHERE p.name = 'Anna' RETURN DISTINCT q.name
```

## Fanen Graf

- **Oversigt**: knuder, kanter, tæthed, gennemsnits- og maksgrad, isolerede knuder, selvkanter, komponenter,
  gradfordeling og de mest forbundne knuder.
- **Grad**: ud-, ind- og samlet grad pr. knude.
- **Komponenter**: svagt sammenhængende komponenter og deres størrelse.
- **Korteste vej**: mellem to knuder (id eller navn), med eller uden hensyn til retning.
- **Delgraf**: vælg etiketter og relationstyper og gem udvalget som en ny graf.
- **Tabeller**: knuderne og kanterne som almindelige tabeller med egenskaberne som kolonner.

Målene beregnes i en baggrundstråd på hele grafen (kompakte kantlister), så en graf med en million kanter får grad og
komponenter på få sekunder.

## R og Python

Grafens SQLite-fil spejles til R og Python som alle datasæt. `dm_read("Graf")` giver knuderne; `dm_read_nodes()` og
`dm_read_edges()` giver knuder henholdsvis kanter med egenskaberne som kolonner:

```r
knuder <- dm_read_nodes("Graf")
kanter <- dm_read_edges("Graf")
library(igraph)
g <- graph_from_data_frame(kanter[, c("kalla", "mal", setdiff(names(kanter), c("id", "kalla", "mal", "typ")))], vertices = knuder)
degree(g)
```

```python
import networkx as nx
knuder = dm_read_nodes("Graf"); kanter = dm_read_edges("Graf")
g = nx.from_pandas_edgelist(kanter, "kalla", "mal", edge_attr=True, create_using=nx.DiGraph)
nx.pagerank(g)
```

## Begrænsninger

- Cypher-delmængden er læsende; redigering af grafer (tilføj, fjern, slå sammen, træk kanter) kommer i en senere
  udgave sammen med Neo4j-forbindelse, PageRank og fællesskaber.
- Oversigten med udfoldelige grupper gælder grafer op til 5.000 elementer; større grafer vises som grupper med antal og
  i fokus- og helgrafvisningen.
- Egenskaber gemmes som JSON-tekst; tal sammenlignes som tal i Cypher, men sorteres som tekst i knudetabellen.
