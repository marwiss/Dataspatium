# Grafer: noder, kanter og Cypher

Dataspatium håndterer grafer (nettverk av noder og kanter) som en egen type datasett. En graf importeres fra GraphML,
GEXF, JSON med noder og kanter eller et Cypher-skript, eller bygges av to tabeller. Nodene er datasettets rader (id,
etikett, navn og egenskaper som JSON), kantene ligger i datasettets egen tabell `_edges` (id, kalla = fra, mal = til,
typ, egenskaper) og nodenes posisjoner i `_layout`. Grafen åpnes som grafvisning i Bearbeid og får fanene **Cypher**
(etter SQL) og **Graf** (etter Regex) i Analyser. Tabellen med nodene er alltid ett klikk unna.

## Formater som leses og skrives

| Format | Filendelse | Leses | Skrives | Merknad |
|---|---|---|---|---|
| GraphML | .graphml | ja | ja | Attributtet `labels` (eller `label`) gir nodens etikett, kantens `label` dens type, som i Neo4js eksport |
| GEXF 1.2/1.3 | .gexf | ja | ja | Gephis format; nodeattributtet `labels` eller `type` gir etiketten |
| JSON med noder og kanter | .json | ja | ja | `{nodes: [...], edges|links: [...]}` som i D3 og networkx, Cytoscapes `{elements: {nodes, edges}}`, Neo4js `{nodes, relationships}` |
| Cypher-skript | .cypher, .cql | ja | ja | Som APOC eksporterer: `CREATE (:Etikett {…, \`UNIQUE IMPORT ID\`: 1});` og `MATCH … CREATE (n1)-[:TYPE {…}]->(n2);`, også vanlige `CREATE`-skript |

JSON- og XML-filer gjenkjennes på innholdet, så slipp filen i Hent inn: grafens opplysninger (noder, kanter, etiketter,
relasjonstyper) vises, og *Importer* lager grafen. Eksport skjer i Eksporter, der en graf får formatene GraphML, GEXF,
JSON og Cypher-skript i tillegg til tabellformatene for nodene.

## Graf av to tabeller

Knappen **Lag graf av tabeller** i Håndter (på en tabell) åpner en dialog: velg kanttabellen med kolonnene for kantens
start og slutt (og gjerne relasjonstype), og om du vil en nodetabell med id, etikett og navn. De øvrige kolonnene blir
egenskaper. Noder som bare finnes i kantene, lages automatisk. Rettet eller urettet velges i dialogen.

## Grafvisningen i Bearbeid

Grafvisningen tegnes med Cytoscape og viser aldri mer enn den aktuelle visningen (høyst noen tusen elementer), mens
grafen selv kan ha hundretusener av kanter.

- **Oversikt per etikett**: hver etikett er en sammenfoldet gruppe med antall; dobbeltklikk for å folde ut gruppen. Store
  grafer viser gruppene med antall kanter mellom dem; dobbeltklikk åpner etikettens noder i fokus.
- **Fokus**: en delgraf som vokser steg for steg. Søk en node (navn, id eller egenskap) eller klikk på en etikett i
  tegnforklaringen, dobbeltklikk på en node eller trykk *Vis naboer* for å hente nabolaget. Høyst 2 000 noder.
- **Hele grafen**: WebGL-tegning med sigma for titusener til hundretusener av elementer; etiketter vises ved innzooming.
  Posisjonene lagres i datasettet slik at grafen åpnes raskt neste gang.
- Layouter: kraftbasert (fCoSE), hierarkisk (dagre), rutenett, sirkel og konsentrisk. *Lagre layout* lagrer posisjonene.
  Klikk på en node eller kant for egenskapene i inspektøren.

## Cypher i Analyser

Fanen Cypher tar en spørring i en Cypher-delmengde, oversetter den til SQL mot datasettets tabeller (noder i `data`,
kanter i `_edges`, egenskaper med `json_extract`) og viser både resultatet og SQL-en. Resultatet kan lagres som datasett
eller lastes ned som CSV.

Delmengden: `MATCH` og `OPTIONAL MATCH` med node- og relasjonsmønstre (etiketter, typer med `|`, egenskapskart, retning,
variabel lengde `*1..5` med høyst 10 steg), `WHERE` med sammenligninger, `AND`/`OR`/`NOT`, `IN`, `IS NULL`,
`STARTS WITH`, `ENDS WITH`, `CONTAINS` og aritmetikk, `RETURN` med `DISTINCT`, alias og aggregatene `count`, `sum`,
`avg`, `min`, `max`, `collect` (med Cyphers implisitte gruppering), `ORDER BY`, `SKIP`, `LIMIT` samt funksjonene `id()`,
`labels()`, `type()`, `toLower()`, `toUpper()`, `size()`, `coalesce()`, `exists()`, `keys()`. Egenskaper nås som
`n.egenskap`; `n.name` gir nodens navn også når det ikke er en egenskap. Skrivende setninger (`CREATE`, `MERGE`, `SET`,
`DELETE`), `WITH`, `UNWIND`, `shortestPath` og regulære uttrykk inngår ikke; korteste vei finnes som verktøy i fanen Graf.

Eksempler:

```cypher
MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, type(r), b.name LIMIT 50
MATCH (a)-[r]->(b) RETURN labels(a) AS fra, type(r) AS relasjon, labels(b) AS til, count(*) AS antall ORDER BY antall DESC
MATCH (p:Person)-[*1..3]-(q:Person) WHERE p.name = 'Anna' RETURN DISTINCT q.name
```

## Fanen Graf

- **Sammendrag**: noder, kanter, tetthet, gjennomsnitts- og maksgrad, isolerte noder, selvkanter, komponenter,
  gradfordeling og de mest forbundne nodene.
- **Grad**: ut-, inn- og total grad per node.
- **Komponenter**: svakt sammenhengende komponenter og deres størrelse.
- **Korteste vei**: mellom to noder (id eller navn), med eller uten hensyn til retning.
- **Delgraf**: velg etiketter og relasjonstyper og lagre utvalget som en ny graf.
- **Tabeller**: nodene og kantene som vanlige tabeller med egenskapene som kolonner.

Målene beregnes i en bakgrunnstråd på hele grafen (kompakte kantlister), så en graf med en million kanter får grad og
komponenter på noen sekunder.

## R og Python

Grafens SQLite-fil speiles til R og Python som alle datasett. `dm_read("Graf")` gir nodene; `dm_read_nodes()` og
`dm_read_edges()` gir noder respektive kanter med egenskapene som kolonner:

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

## Begrensninger

- Cypher-delmengden er lesende; redigering av grafer (legg til, fjern, slå sammen, dra kanter) kommer i en senere
  utgave sammen med Neo4j-tilkobling, PageRank og fellesskap.
- Oversikten med utfoldbare grupper gjelder grafer opptil 5 000 elementer; større grafer vises som grupper med antall og
  i fokus- og helgrafvisningen.
- Egenskaper lagres som JSON-tekst; tall sammenlignes som tall i Cypher, men sorteres som tekst i nodetabellen.
