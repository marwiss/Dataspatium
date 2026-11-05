# Grafar: nodar, kantar og Cypher

Dataspatium handterer grafar (nettverk av nodar og kantar) som ein eigen type datasett. Ein graf blir importert frå GraphML,
GEXF, JSON med nodar og kantar eller eit Cypher-skript, eller bygd av to tabellar. Nodane er radene i datasettet (id,
etikett, namn og eigenskapar som JSON), kantane ligg i den eigne tabellen `_edges` til datasettet (id, kalla = frå, mal = til,
typ, egenskaper) og posisjonane til nodane i `_layout`. Grafen blir opna som grafvising i Bearbeid og får fanene **Cypher**
(etter SQL) og **Graf** (etter Regex) i Analyser. Tabellen med nodane er alltid eitt klikk unna.

## Format som blir lesne og skrivne

| Format | Filending | Blir lese | Blir skrive | Merknad |
|---|---|---|---|---|
| GraphML | .graphml | ja | ja | Attributtet `labels` (eller `label`) gjev etiketten til noden, `label` på kanten typen hans, som i eksporten frå Neo4j |
| GEXF 1.2/1.3 | .gexf | ja | ja | Formatet til Gephi; nodeattributtet `labels` eller `type` gjev etiketten |
| JSON med nodar og kantar | .json | ja | ja | `{nodes: [...], edges|links: [...]}` som i D3 og networkx, `{elements: {nodes, edges}}` frå Cytoscape, `{nodes, relationships}` frå Neo4j |
| Cypher-skript | .cypher, .cql | ja | ja | Som APOC eksporterer: `CREATE (:Etikett {…, \`UNIQUE IMPORT ID\`: 1});` og `MATCH … CREATE (n1)-[:TYPE {…}]->(n2);`, òg vanlege `CREATE`-skript |

JSON- og XML-filer blir kjende att på innhaldet, så slepp fila i Hent: opplysningane om grafen (nodar, kantar, etikettar,
relasjonstypar) blir viste, og *Importer* lagar grafen. Eksport skjer i Eksporter, der ein graf får formata GraphML, GEXF,
JSON og Cypher-skript i tillegg til tabellformata for nodane.

## Graf av to tabellar

Knappen **Lag graf av tabellar** i Handter (på ein tabell) opnar ein dialog: vel kanttabellen med kolonnane for start
og slutt på kanten (og gjerne relasjonstype), og om du vil ein nodetabell med id, etikett og namn. Dei andre kolonnane blir
eigenskapar. Nodar som berre finst i kantane, blir laga automatisk. Retta eller uretta vel du i dialogen.

## Grafvisinga i Bearbeid

Grafvisinga blir teikna med Cytoscape og viser aldri meir enn den aktuelle visinga (høgst nokre tusen element), medan
grafen sjølv kan ha hundretusenvis av kantar.

- **Oversyn per etikett**: kvar etikett er ei samanfalda gruppe med tal; dobbeltklikk for å falde ut gruppa. Store
  grafar viser gruppene med tal på kantar mellom dei; dobbeltklikk opnar nodane til etiketten i fokus.
- **Fokus**: ein delgraf som veks steg for steg. Søk ein node (namn, id eller eigenskap) eller klikk på ein etikett i
  teiknforklaringa, dobbeltklikk på ein node eller trykk *Vis naboar* for å hente nabolaget. Høgst 2 000 nodar.
- **Heile grafen**: WebGL-teikning med sigma for titusenvis til hundretusenvis av element; etikettar blir viste ved innzooming.
  Posisjonane blir lagra i datasettet slik at grafen blir opna raskt neste gong.
- Layoutar: kraftbasert (fCoSE), hierarkisk (dagre), rutenett, sirkel og konsentrisk. *Lagre layout* lagrar posisjonane.
  Klikk på ein node eller kant for eigenskapane i inspektøren.

## Cypher i Analyser

Fana Cypher tek ei spørjing i ei Cypher-delmengd, set henne om til SQL mot tabellane i datasettet (nodar i `data`,
kantar i `_edges`, eigenskapar med `json_extract`) og viser både resultatet og SQL-en. Resultatet kan lagrast som datasett
eller lastast ned som CSV.

Delmengda: `MATCH` og `OPTIONAL MATCH` med node- og relasjonsmønster (etikettar, typar med `|`, eigenskapskart, retning,
variabel lengd `*1..5` med høgst 10 steg), `WHERE` med samanlikningar, `AND`/`OR`/`NOT`, `IN`, `IS NULL`,
`STARTS WITH`, `ENDS WITH`, `CONTAINS` og aritmetikk, `RETURN` med `DISTINCT`, alias og aggregata `count`, `sum`,
`avg`, `min`, `max`, `collect` (med den implisitte grupperinga i Cypher), `ORDER BY`, `SKIP`, `LIMIT` og dessutan funksjonane `id()`,
`labels()`, `type()`, `toLower()`, `toUpper()`, `size()`, `coalesce()`, `exists()`, `keys()`. Eigenskapar blir nådde som
`n.eigenskap`; `n.name` gjev namnet på noden òg når det ikkje er ein eigenskap. Skrivande setningar (`CREATE`, `MERGE`, `SET`,
`REMOVE`, `DELETE`) blir oppskriftssteg, sjå *Rediger grafen*. `WITH`, `UNWIND`, `shortestPath` og regulære uttrykk er ikkje
med; kortaste veg finst som verktøy i fana Graf.

Døme:

```cypher
MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, type(r), b.name LIMIT 50
MATCH (a)-[r]->(b) RETURN labels(a) AS fra, type(r) AS relasjon, labels(b) AS til, count(*) AS tal ORDER BY tal DESC
MATCH (p:Person)-[*1..3]-(q:Person) WHERE p.name = 'Anna' RETURN DISTINCT q.name
```

## Fana Graf

- **Samandrag**: nodar, kantar, tettleik, gjennomsnitts- og maksgrad, isolerte nodar, sjølvkantar, komponentar,
  gradfordeling og dei mest samanbundne nodane.
- **Grad**: ut-, inn- og total grad per node.
- **Komponentar**: svakt samanhengande komponentar og storleiken deira.
- **Kortaste veg**: mellom to nodar (id eller namn), med eller utan omsyn til retning.
- **Delgraf**: vel etikettar og relasjonstypar og lagre utvalet som ein ny graf.
- **Tabellar**: nodane og kantane som vanlege tabellar med eigenskapane som kolonnar.

Måla blir rekna ut i ein bakgrunnstråd på heile grafen (kompakte kantlister), så ein graf med ein million kantar får grad og
komponentar på nokre sekund.

## R og Python

SQLite-fila til grafen blir spegla til R og Python som alle datasett. `dm_read("Graf")` gjev nodane; `dm_read_nodes()` og
`dm_read_edges()` gjev nodar og kantar med eigenskapane som kolonnar:

```r
noder <- dm_read_nodes("Graf")
kanter <- dm_read_edges("Graf")
library(igraph)
g <- graph_from_data_frame(kanter[, c("kalla", "mal", setdiff(names(kanter), c("id", "kalla", "mal", "typ")))], vertices = noder)
degree(g)
```

```python
import networkx as nx
noder = dm_read_nodes("Graf"); kanter = dm_read_edges("Graf")
g = nx.from_pandas_edgelist(kanter, "kalla", "mal", edge_attr=True, create_using=nx.DiGraph)
nx.pagerank(g)
```

## Rediger grafen

Grafvisinga redigerer grafen med knappane under *Rediger* i inspektøren: **Legg til node** (id, etikett, namn og
eigenskapar som `nøkkel: verdi` per linje), **Endre** og **Fjern** for den merkte noden eller kanten, **Vel som start**
følgt av **Kople** for å trekkje ein kant mellom to nodar, og **Slå saman**, som flyttar kantane frå dei valde nodane til
den merkte og fyller inn eigenskapar som manglar. Kvar endring er eit oppskriftssteg (gruppa Graf: legg til node, endre
nodar, fjern nodar, slå saman nodar, legg til kant, endre kantar, fjern kantar) som blir logga, kan angrast og spelast av på
ein ny versjon av grafen; SQL-en og R-koden til oppskrifta viser kva som vart gjort.

Dei same stega kjem frå skrivande Cypher i fana Cypher: `CREATE (a:Person {id: 'p9', name: 'Xenia'}),
(a)-[:KNOWS {since: 2020}]->(b)`, `MERGE (c:City {id: 'c2', name: 'Göteborg'})`, `MATCH (n:Person) WHERE n.age > 40
SET n.senior = true, n:Senior`, `MATCH (n {id: 'p1'}) REMOVE n.age`, `MATCH (a)-[r:KNOWS]->(b) DELETE r` og
`MATCH (n {id: 'c1'}) DETACH DELETE n`. Den lesande delen (MATCH … WHERE) avgjer kva nodar og kantar som blir råka, den
skrivande delen blir steg; verdiar er literalar.

## Neo4j som kjelde

*Neo4j* under *Legg til kjelder* i Hent (familien **Neo4j (Bolt)**, som òg finst i *Databasekjelde*): adresse (`neo4j+s://…databases.neo4j.io` for Aura
eller ein eigen tenar), database, brukarnamn og passord (blir aldri lagra i klartekst). Kjelda opnar ein Cypher-editor;
*Køyr* koplar til med drivaren frå Neo4j over WebSocket etter samtykket ditt (føremålet Neo4j) og viser resultatet som tabell
der nodar og relasjonar blir flata ut til eigenskapane sine. Inneheld svaret nodar og relasjonar, lagrar **Lagre som graf**
dei som eit grafdatasett; elles *Lagre som datasett*. **Lagre spørjinga** legg spørjinga på kjelda slik at ho kan
køyrast igjen med eitt klikk. Bolt over WebSocket er ikkje omfatta av CORS; ein eigen tenar utan TLS (`bolt://`) blir berre nådd frå
ei side over http://.

## Fleire verktøy i fana Graf

- **PageRank** (demping 0,85), **Fellesskap** (etikettspreiing, nummererte etter storleik) og **Sentralitet** (harmonisk
  nærleik og mellomliggjande sentralitet etter Brandes, estimert frå eit utval startnodar i store grafar), alle rekna ut i
  bakgrunnstråden og kan lagrast som datasett.
- **Mønster**: spørjing utan kode: frå-etikett, relasjon, til-etikett, retning og eit vilkår på eigenskapen til frå-noden.
  Spørjinga blir bygd som Cypher, vist under resultatet og kan kopierast til fana Cypher.
- **Layout**: kraftbasert layout av heile grafen i bakgrunnen (Fruchterman–Reingold med rutenett); posisjonane blir lagra og
  brukte av visinga Heile grafen.

## Grafdiagram i Visualiser

**Lagre som diagram** i grafvisinga, eller *Nytt diagram* → *Graf* i Visualiser, gjev eit grafdiagram: grafdatasett,
vising (oversyn, fokus med søkte nodar, heile grafen), layout og etikettar. Diagrammet blir eksportert som SVG, PNG og PDF
(eiga SVG-teikning frå posisjonane til nodane), inngår i dashbord og publiserte sider som innebygd SVG, og i batchkøyringar
og dokumentmalar som andre diagram.

## Avgrensingar

- Cypher manglar `WITH`, `UNWIND` og `shortestPath`; Neo4j-kjelda er lesande (skriving skjer i dei eigne grafane til appen).
- Oversynet med utfaldbare grupper gjeld grafar opptil 5 000 element; større grafar blir viste som grupper med tal og
  i fokus- og heilgrafvisinga.
- Eigenskapar blir lagra som JSON-tekst; tal blir samanlikna som tal i Cypher, men sorterte som tekst i nodetabellen.
