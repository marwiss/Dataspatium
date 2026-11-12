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
ei side over http://. Inneheld svaret nodar, blir dei òg teikna som ein graf.

## IFC–DB på ein Dataregium-tenar

Dataregium gjer kvar opplasta IFC-fil til ein graf med biblioteket IFC–DB (tidlegare IFC-LPG): éin node per entitet, med klassen og alle overklassene hennar som etikettar og
IFC-attributta som eigenskapar, og relasjonar som heiter som attributta (`IS_DEFINED_BY`, `RELATED_OBJECTS`, `HAS_PROPERTIES`).
Grafen ligg på tenaren og kan vere langt større enn det er rimeleg å hente heim. Difor blir han teikna og spurd direkte frå *Hent*,
og ingenting blir lagra før du ber om det.

Det finst to vegar til grafen, og begge gir same vising:

- **Kortet IFC–DB i OpenCDE-kjelda.** Spørjingane går gjennom den lesande grafspørjinga til tenaren, som krev at du loggar inn
  som administrator, og at tenaren har `OPENCDE_GRAPH_QUERY_ENABLED=true`. Det er vegen i drift: ingen databaseport må vere open,
  tenaren set grenser for rader og tid, fjernar lagra hashverdiar og loggar kvar spørjing.
- **Ei Neo4j-kjelde.** Bolt med adressa, brukarnamnet og passordet til databasen, til dømes `bolt://127.0.0.1:7697` på ein
  utviklingsstabel. Bolt gir tilgang til heile databasen, så appen les alltid i ei lesesesjon og fjernar lagra hashverdiar frå
  svara. I drift er Bolt stengd med mindre den som driv tenaren, har opna det; då viser kortet adressa.

**Vis modellar** viser modellane i grafen, den nyaste versjonen av kvart dokument først. Vel ein modell og ei vising:

| Vising | Viser |
|---|---|
| Romleg struktur | Prosjekt, tomt, bygning og etasjar, med relasjonane mellom dei |
| Bygningsdelar per etasje | Kva bygningsdelar kvar etasje inneheld |
| Bygningsdelar og typar | Bygningsdelane og typane deira |
| Bygningsdelar og material | Bygningsdelane og materiala deira |
| Eigenskapar og mengder | Eigenskapssetta og mengdene til bygningsdelane |
| Saker og bygningsdelar | BCF-saker, viewpointa og komponentane deira, og bygningsdelane dei peikar på; komponenten og bygningsdelen har same GUID, og lina `IFC_GUID` mellom dei teiknar appen sjølv |
| Heile modellen | Opptil 1 000 relasjonar i modellen |
| Tal per klasse | Ein tabell med talet på entitetar per klasse |
| Geometri per klasse | Ein tabell med talet på geometrinodar per klasse: representasjonar, solidar, profilar, plasseringar, stilar og lag |

Frå Dataregium 3.0.0 vert geometrien lagra som eit skjelett: representasjonar, solidar, profilar, plasseringar, kontekstar, stilar,
fargar og lag er nodar, medan punkt, meshar og kurver ligg som STEP-tekst i blokker. Visingane Heile modellen og Tal per klasse
utelèt nodane i skjelettet, slik at bygningsdelane vert synlege; Geometri per klasse tel dei, og Naboar på ein bygningsdel
viser forma og plasseringa. Modellista seier kva form modellen har (skjelett, blokker eller nodar). Ei punktliste, når all
geometri er nodar, vert vist som koordinatar `x y z`.

Svaret blir teikna med Cytoscape, med tabellen under. Nodane blir farga etter kva dei er: romleg struktur, bygningsdel, relasjon,
type, eigenskap eller mengd, materiale og anna. Layout og etikettar blir endra utan å spørje tenaren.

Klikk på ein node, så viser inspektøren attributta. **Naboar**, eller eit dobbeltklikk på noden, hentar naboane frå tenaren og legg
dei til i biletet. Ein bygningsdel har òg **Eigenskapar**, **Saker** og **Vis i modellen**, som opnar bygningsdelen i 3D viss modellen
finst i arbeidsområdet.

I feltet skriv du din eigen Cypher, alt tenaren forstår, men berre lesande. Spør du berre etter nodar (`RETURN c, w`), hentar appen òg
relasjonane mellom dei, slik Neo4j Browser gjer. Appen seier frå når eit svar har nådd `LIMIT` i spørjinga eller er klipt, og lesinga
stoppar ved 20 000 rader. Svar med meir enn 1 500 nodar blir ikkje teikna her, men kan lagrast og opnast som oversikt i Bearbeid. Grafen frå Dataregium 3.0.0 ber òg det som trengst for å skrive fila tilbake (`<attributt>__type`, `<attributt>__step` og `StepBlock`-nodar med teksten sin). Det blir utelate når ein node blir vist eller lagra, men kan spørjast etter med namn.

**Lagre som graf** gjer det du ser, til eit vanleg grafdatasett: grafvisinga i Bearbeid, fanene Cypher og Graf i Analyser og grafdiagram
i Visualiser. Klassen blir etiketten til noden og alle etikettar følgjer med, så `MATCH (w:IfcWall)` òg finn ein `IfcWallStandardCase`
i kopien. I fana Cypher kan du slå på **Køyr på tenaren** for ein graf som er lagra herfrå, og då svarer tenaren med all Cypher mot heile
grafen i staden for delmengda mot kopien.

Ein IFC-modell henta frå Dataregium har knappen **IFC–DB** i Handter, og for ein vald bygningsdel i Bearbeid. Han opnar grafen til
modellen i Hent, i ei Neo4j-kjelde på same datamaskin viss det finst ei, elles i OpenCDE-kjelda.

Frå IFC–DB `d042134` kan tenaren rekne ut ein boks per bygningsdel i prosjektkoordinatar (meter): `bbox_min`, `bbox_max` og
`bbox_centre` som punkt på noden til bygningsdelen, og modellnoden seier når boksane vart rekna ut (`spatial_at`), for kor mange
bygningsdelar (`spatial_products`) og kor mange som mislukkast (`spatial_failed`). Boksane finst berre der tenaren har køyrt
utrekninga, så spør med `bbox_centre IS NOT NULL`. Dømet *Bygningsdelar nær ein bygningsdel* i Neo4j-kjelda listar det som ligg innan
1,2 m frå midten av ein bygningsdel, med `point.distance`, likt i Neo4j og Memgraph.

Tenaren oppgir i kapabilitetsdokumentet sitt kva database som held grafen (`graph_store`: `neo4j` eller `memgraph`, seinare `grafeo`
eller `postgresql`). I ein annan database enn Neo4j og Memgraph, som Grafeo, er boksane lister med tal og ikkje punkt: då utelèt
kortet IFC–DB døma som treng punkt, som *Bygningsdelar nær ein bygningsdel*, og ein boks blir likevel vist som `x y z`, akkurat som
eit punkt.

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

- Cypher manglar `WITH`, `UNWIND` og `shortestPath` i den lokale delmengda (*Køyr på tenaren* har dei for ein graf frå ein tenar); Neo4j-kjelda er lesande (skriving skjer i dei eigne grafane til appen).
- Oversynet med utfaldbare grupper gjeld grafar opptil 5 000 element; større grafar blir viste som grupper med tal og
  i fokus- og heilgrafvisinga.
- Eigenskapar blir lagra som JSON-tekst; tal blir samanlikna som tal i Cypher, men sorterte som tekst i nodetabellen.
