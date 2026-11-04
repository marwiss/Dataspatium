# Net: hnútar, leggir og Cypher

Dataspatium meðhöndlar net (hnúta og leggi) sem eigin tegund gagnasafns. Net er flutt inn úr GraphML, GEXF, JSON með
hnútum og leggjum eða Cypher-skriftu, eða byggt úr tveimur töflum. Hnútarnir eru raðir gagnasafnsins (auðkenni,
merkimiði, heiti og eiginleikar sem JSON), leggirnir eru í eigin töflu gagnasafnsins `_edges` (id, kalla = frá, mal =
til, typ = tegund, egenskaper = eiginleikar) og staðsetningar hnúta í `_layout`. Netið opnast sem netsýn í Vinna og
fær flipana **Cypher** (eftir SQL) og **Net** (eftir Regex) í Greina. Hnútataflan er alltaf einum smelli frá.

## Snið sem eru lesin og skrifuð

| Snið | Ending | Lesið | Skrifað | Athugasemd |
|---|---|---|---|---|
| GraphML | .graphml | já | já | Eigindið `labels` (eða `label`) gefur merkimiða hnútsins, `label` leggjar tegund hans, eins og í útflutningi Neo4j |
| GEXF 1.2/1.3 | .gexf | já | já | Snið Gephi; hnútaeigindið `labels` eða `type` gefur merkimiðann |
| JSON með hnútum og leggjum | .json | já | já | `{nodes: [...], edges|links: [...]}` eins og í D3 og networkx, `{elements: {nodes, edges}}` Cytoscape, `{nodes, relationships}` Neo4j |
| Cypher-skrifta | .cypher, .cql | já | já | Eins og APOC flytur út: `CREATE (:Merkimiði {…, \`UNIQUE IMPORT ID\`: 1});` og `MATCH … CREATE (n1)-[:TYPE {…}]->(n2);`, einnig venjulegar `CREATE`-skriftur |

JSON- og XML-skrár þekkjast á innihaldinu, svo slepptu skránni í Safna: upplýsingar netsins (hnútar, leggir,
merkimiðar, venslategundir) birtast og *Flytja inn* býr til netið. Útflutningur fer fram í Flytja út, þar sem net fær
sniðin GraphML, GEXF, JSON og Cypher-skriftu auk töflusniðanna fyrir hnútana.

## Net úr tveimur töflum

Hnappurinn **Gera net úr töflum** í Umsjón (á töflu) opnar glugga: veldu leggjatöfluna með dálkum fyrir upphaf og enda
leggjar (og helst venslategund) og, ef þú vilt, hnútatöflu með auðkenni, merkimiða og heiti. Aðrir dálkar verða
eiginleikar. Hnútar sem koma aðeins fyrir í leggjunum eru búnir til sjálfkrafa. Stefnt eða óstefnt er valið í glugganum.

## Netsýnin í Vinna

Netsýnin er teiknuð með Cytoscape og sýnir aldrei meira en núverandi sýn (mest nokkur þúsund fitjur), meðan netið
sjálft getur haft hundruð þúsunda leggja.

- **Yfirlit eftir merkimiða**: hver merkimiði er samanfelldur hópur með fjölda; tvísmelltu til að opna hópinn. Stór net
  sýna hópana með fjölda leggja á milli þeirra; tvísmellur opnar hnúta merkimiðans í fókus.
- **Fókus**: hlutnet sem vex skref fyrir skref. Leitaðu að hnút (heiti, auðkenni eða eiginleiki) eða smelltu á merkimiða
  í skýringunum, tvísmelltu á hnút eða ýttu á *Sýna nágranna* til að sækja nágrennið. Mest 2 000 hnútar.
- **Allt netið**: WebGL-teikning með sigma fyrir tugþúsundir til hundruð þúsunda fitja; merki birtast þegar þysjað er
  inn. Staðsetningar eru vistaðar í gagnasafninu svo netið opnist hratt næst.
- Uppröðun: kraftbyggð (fCoSE), stigskipt (dagre), rist, hringur og sammiðja. *Vista uppröðun* vistar staðsetningarnar.
  Smelltu á hnút eða legg fyrir eiginleika hans í skoðaranum.

## Cypher í Greina

Flipinn Cypher tekur fyrirspurn í Cypher-hlutmengi, þýðir hana í SQL á töflur gagnasafnsins (hnútar í `data`, leggir í
`_edges`, eiginleikar með `json_extract`) og sýnir bæði niðurstöðuna og SQL-ið. Niðurstöðuna má vista sem gagnasafn
eða sækja sem CSV.

Hlutmengið: `MATCH` og `OPTIONAL MATCH` með hnúta- og venslamynstrum (merkimiðar, tegundir með `|`, eiginleikakort,
stefna, breytileg lengd `*1..5` með mest 10 skrefum), `WHERE` með samanburði, `AND`/`OR`/`NOT`, `IN`, `IS NULL`,
`STARTS WITH`, `ENDS WITH`, `CONTAINS` og reikningi, `RETURN` með `DISTINCT`, samheitum og samantektunum `count`,
`sum`, `avg`, `min`, `max`, `collect` (með óbeinni hópun Cypher), `ORDER BY`, `SKIP`, `LIMIT` auk fallanna `id()`,
`labels()`, `type()`, `toLower()`, `toUpper()`, `size()`, `coalesce()`, `exists()`, `keys()`. Eiginleikar eru sóttir
sem `n.eiginleiki`; `n.name` gefur heiti hnútsins jafnvel þegar það er ekki eiginleiki. Skrifandi setningar (`CREATE`,
`MERGE`, `SET`, `REMOVE`, `DELETE`) verða uppskriftarskref, sjá *Breyta netinu*. `WITH`, `UNWIND`, `shortestPath` og
regluleg segð eru ekki með; stysta leið er tól í flipanum Net.

Dæmi:

```cypher
MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, type(r), b.name LIMIT 50
MATCH (a)-[r]->(b) RETURN labels(a) AS fra, type(r) AS vensl, labels(b) AS til, count(*) AS fjoldi ORDER BY fjoldi DESC
MATCH (p:Person)-[*1..3]-(q:Person) WHERE p.name = 'Anna' RETURN DISTINCT q.name
```

## Flipinn Net

- **Samantekt**: hnútar, leggir, þéttleiki, meðal- og hámarksgráða, einangraðir hnútar, sjálfleggir, samhangandi hlutar,
  gráðudreifing og tengdustu hnútarnir.
- **Gráða**: út-, inn- og heildargráða á hnút.
- **Samhangandi hlutar**: veikt samhangandi hlutar og stærð þeirra.
- **Stysta leið**: milli tveggja hnúta (auðkenni eða heiti), með eða án tillits til stefnu.
- **Hlutnet**: veldu merkimiða og venslategundir og vistaðu valið sem nýtt net.
- **Töflur**: hnútar og leggir sem venjulegar töflur með eiginleikana sem dálka.

Mælingarnar eru reiknaðar í bakgrunnsþræði á öllu netinu (þjappaðir leggjalistar), svo net með milljón leggjum fær
gráðu og samhangandi hluta á nokkrum sekúndum.

## R og Python

SQLite-skrá netsins er spegluð til R og Python eins og öll gagnasöfn. `dm_read("Net")` gefur hnútana; `dm_read_nodes()`
og `dm_read_edges()` gefa hnúta og leggi með eiginleikana sem dálka:

```r
hnutar <- dm_read_nodes("Net")
leggir <- dm_read_edges("Net")
library(igraph)
g <- graph_from_data_frame(leggir[, c("kalla", "mal", setdiff(names(leggir), c("id", "kalla", "mal", "typ")))], vertices = hnutar)
degree(g)
```

```python
import networkx as nx
hnutar = dm_read_nodes("Net"); leggir = dm_read_edges("Net")
g = nx.from_pandas_edgelist(leggir, "kalla", "mal", edge_attr=True, create_using=nx.DiGraph)
nx.pagerank(g)
```

## Breyta netinu

Netsýnin breytir netinu með hnöppunum undir *Breyta* í skoðaranum: **Bæta við hnút** (auðkenni, merkimiði, heiti og
eiginleikar sem `lykill: gildi` á línu), **Breyta** og **Fjarlægja** fyrir valinn hnút eða legg, **Velja sem upphaf** og
síðan **Tengja** til að draga legg milli tveggja hnúta, og **Sameina**, sem flytur leggi valdra hnúta yfir á merkta hnútinn
og fyllir inn eiginleika sem vantar. Hver breyting er uppskriftarskref (hópurinn Net: bæta við hnút, breyta hnútum,
fjarlægja hnúta, sameina hnúta, bæta við legg, breyta leggjum, fjarlægja leggi) sem er skráð, má afturkalla og endurspila
á nýrri útgáfu netsins; SQL og R uppskriftarinnar sýna hvað var gert.

Sömu skref koma úr skrifandi Cypher í flipanum Cypher: `CREATE (a:Person {id: 'p9', name: 'Xenia'}),
(a)-[:KNOWS {since: 2020}]->(b)`, `MERGE (c:City {id: 'c2', name: 'Göteborg'})`, `MATCH (n:Person) WHERE n.age > 40
SET n.senior = true, n:Senior`, `MATCH (n {id: 'p1'}) REMOVE n.age`, `MATCH (a)-[r:KNOWS]->(b) DELETE r` og
`MATCH (n {id: 'c1'}) DETACH DELETE n`. Lesandi hlutinn (MATCH … WHERE) ræður hverja hnúta og leggi er snert, skrifandi
hlutinn verður skref; gildi eru fastar.

## Neo4j sem uppspretta

*Bæta við gagnagrunnsuppsprettu* í Safna hefur fjölskylduna **Neo4j (Bolt)**: vistfang (`neo4j+s://…databases.neo4j.io`
fyrir Aura eða eigin þjónn), gagnagrunnur, notandanafn og lykilorð (aldrei vistað í hreinum texta). Uppsprettan opnar
Cypher-ritil; *Keyra* tengist með rekli Neo4j yfir WebSocket eftir samþykki þitt (tilgangurinn Neo4j) og sýnir
niðurstöðuna sem töflu þar sem hnútar og vensl eru flött niður í eiginleika sína. Innihaldi svarið hnúta og vensl vistar
**Vista sem net** þau sem netgagnasafn; annars *Vista sem gagnasafn*. **Vista fyrirspurn** setur fyrirspurnina á
uppsprettuna svo hana megi keyra aftur með einum smelli. Bolt yfir WebSocket fellur ekki undir CORS; eigin þjónn án TLS
(`bolt://`) næst aðeins frá síðu yfir http://.

## Fleiri tól í flipanum Net

- **PageRank** (deyfing 0,85), **Samfélög** (merkimiðadreifing, númeruð eftir stærð) og **Miðlægni** (harmónísk nálægð
  og millilegumiðlægni samkvæmt Brandes, metin út frá úrtaki upphafshnúta í stórum netum), öll reiknuð í bakgrunnsþræði
  og vistanleg sem gagnasöfn.
- **Mynstur**: fyrirspurn án kóða: frá-merkimiði, vensl, til-merkimiði, stefna og eitt skilyrði á eiginleika frá-hnútsins.
  Fyrirspurnin er byggð sem Cypher, sýnd undir niðurstöðunni og má afrita í flipann Cypher.
- **Uppröðun**: kraftbyggð uppröðun alls netsins í bakgrunni (Fruchterman–Reingold með rist); staðsetningar eru vistaðar
  og notaðar í sýninni Allt netið.

## Netmyndir í Myndgera

**Vista sem mynd** í netsýninni, eða *Ný mynd* → *Net* í Myndgera, gefur netmynd: netgagnasafn, sýn (yfirlit, fókus með
leituðum hnútum, allt netið), uppröðun og merki. Myndin er flutt út sem SVG, PNG og PDF (eigin SVG-teikning úr
staðsetningum hnúta), er með í mælaborðum og birtum síðum sem innfelld SVG og í keyrslum og skjalasniðmátum eins og
aðrar myndir.

## Takmarkanir

- Cypher vantar `WITH`, `UNWIND` og `shortestPath`; Neo4j-uppsprettan er aðeins lesandi (skrifað er í eigin net forritsins).- Yfirlitið með opnanlegum hópum gildir fyrir net með allt að 5 000 fitjum; stærri net eru sýnd sem hópar með fjölda og í
  fókus- og heildarsýn.
- Eiginleikar eru vistaðir sem JSON-texti; tölur eru bornar saman sem tölur í Cypher en raðað sem texta í hnútatöflunni.
