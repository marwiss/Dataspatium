# Verkot: solmut, särmät ja Cypher

Dataspatium käsittelee verkkoja (solmujen ja särmien muodostamia verkostoja) omana aineistotyyppinään. Verkko tuodaan
GraphML-, GEXF-, solmu-särmä-JSON- tai Cypher-skriptitiedostosta tai rakennetaan kahdesta taulukosta. Solmut ovat
aineiston rivejä (id, tunniste, nimi ja ominaisuudet JSON-muodossa), särmät ovat aineiston omassa taulussa `_edges`
(id, kalla = mistä, mal = mihin, typ = tyyppi, egenskaper = ominaisuudet) ja solmujen sijainnit taulussa `_layout`.
Verkko avautuu verkkonäkymänä Muokkaa-tilassa ja saa välilehdet **Cypher** (SQL:n jälkeen) ja **Verkko** (Regexin
jälkeen) Analysoi-tilassa. Solmutaulukko on aina yhden napsautuksen päässä.

## Luettavat ja kirjoitettavat muodot

| Muoto | Pääte | Luetaan | Kirjoitetaan | Huomautus |
|---|---|---|---|---|
| GraphML | .graphml | kyllä | kyllä | Attribuutti `labels` (tai `label`) antaa solmun tunnisteen, särmän `label` sen tyypin, kuten Neo4j:n viennissä |
| GEXF 1.2/1.3 | .gexf | kyllä | kyllä | Gephin muoto; solmuattribuutti `labels` tai `type` antaa tunnisteen |
| JSON solmuilla ja särmillä | .json | kyllä | kyllä | `{nodes: [...], edges|links: [...]}` kuten D3:ssa ja networkx:ssä, Cytoscapen `{elements: {nodes, edges}}`, Neo4j:n `{nodes, relationships}` |
| Cypher-skripti | .cypher, .cql | kyllä | kyllä | Kuten APOC vie: `CREATE (:Tunniste {…, \`UNIQUE IMPORT ID\`: 1});` ja `MATCH … CREATE (n1)-[:TYPE {…}]->(n2);`, myös tavalliset `CREATE`-skriptit |

JSON- ja XML-tiedostot tunnistetaan sisällöstä, joten pudota tiedosto Nouda-tilaan: verkon tiedot (solmut, särmät,
tunnisteet, suhdetyypit) näytetään ja *Tuo* luo verkon. Vienti tapahtuu Vie-tilassa, jossa verkko saa muodot GraphML,
GEXF, JSON ja Cypher-skripti solmujen taulukkomuotojen lisäksi.

## Verkko kahdesta taulukosta

Painike **Tee verkko taulukoista** Hallitse-tilassa (taulukolla) avaa valintaikkunan: valitse särmätaulukko sarakkeilla
särmän alulle ja lopulle (ja mieluiten suhdetyyppi) ja halutessasi solmutaulukko tunnuksella, tunnisteella ja nimellä.
Muista sarakkeista tulee ominaisuuksia. Vain särmissä esiintyvät solmut luodaan automaattisesti. Suunnattu tai
suuntaamaton valitaan ikkunassa.

## Verkkonäkymä Muokkaa-tilassa

Verkkonäkymä piirretään Cytoscapella eikä se näytä koskaan enempää kuin nykyisen näkymän (enintään muutama tuhat
elementtiä), kun taas verkossa itsessään voi olla satoja tuhansia särmiä.

- **Yleiskuva tunnisteittain**: jokainen tunniste on kokoon taitettu ryhmä lukumäärällä; kaksoisnapsauta avataksesi
  ryhmän. Suuret verkot näyttävät ryhmät ja niiden välisten särmien määrät; kaksoisnapsautus avaa tunnisteen solmut
  keskitykseen.
- **Keskitys**: aliverkko, joka kasvaa askel kerrallaan. Hae solmu (nimi, tunnus tai ominaisuus) tai napsauta
  tunnistetta selitteessä, kaksoisnapsauta solmua tai paina *Näytä naapurit* noutaaksesi naapuruston. Enintään 2 000 solmua.
- **Koko verkko**: WebGL-piirros sigmalla kymmenille tai sadoille tuhansille elementeille; nimiöt näkyvät lähennettäessä.
  Sijainnit tallennetaan aineistoon, jotta verkko avautuu nopeasti seuraavalla kerralla.
- Asettelut: voimapohjainen (fCoSE), hierarkkinen (dagre), ruudukko, ympyrä ja samankeskinen. *Tallenna asettelu*
  tallentaa sijainnit. Napsauta solmua tai särmää nähdäksesi ominaisuudet tarkastimessa.

## Cypher Analysoi-tilassa

Cypher-välilehti ottaa kyselyn Cypher-osajoukossa, kääntää sen SQL:ksi aineiston tauluja vastaan (solmut taulussa
`data`, särmät taulussa `_edges`, ominaisuudet `json_extract`-funktiolla) ja näyttää sekä tuloksen että SQL:n. Tuloksen
voi tallentaa aineistona tai ladata CSV:nä.

Osajoukko: `MATCH` ja `OPTIONAL MATCH` solmu- ja suhdekuvioilla (tunnisteet, tyypit `|`-merkillä, ominaisuuskartat,
suunta, vaihteleva pituus `*1..5`, enintään 10 askelta), `WHERE` vertailuilla, `AND`/`OR`/`NOT`, `IN`, `IS NULL`,
`STARTS WITH`, `ENDS WITH`, `CONTAINS` ja aritmetiikka, `RETURN` `DISTINCT`-määreellä, aliaksilla ja koosteilla `count`,
`sum`, `avg`, `min`, `max`, `collect` (Cypherin implisiittisellä ryhmittelyllä), `ORDER BY`, `SKIP`, `LIMIT` sekä
funktiot `id()`, `labels()`, `type()`, `toLower()`, `toUpper()`, `size()`, `coalesce()`, `exists()`, `keys()`.
Ominaisuuksiin viitataan `n.ominaisuus`; `n.name` antaa solmun nimen, vaikka se ei olisi ominaisuus. Kirjoittavat lauseet
(`CREATE`, `MERGE`, `SET`, `DELETE`), `WITH`, `UNWIND`, `shortestPath` ja säännölliset lausekkeet eivät sisälly; lyhin
polku on työkalu Verkko-välilehdellä.

Esimerkkejä:

```cypher
MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, type(r), b.name LIMIT 50
MATCH (a)-[r]->(b) RETURN labels(a) AS mista, type(r) AS suhde, labels(b) AS mihin, count(*) AS maara ORDER BY maara DESC
MATCH (p:Person)-[*1..3]-(q:Person) WHERE p.name = 'Anna' RETURN DISTINCT q.name
```

## Verkko-välilehti

- **Yhteenveto**: solmut, särmät, tiheys, keski- ja maksimiaste, eristetyt solmut, itsesilmukat, komponentit,
  astejakauma ja kytketyimmät solmut.
- **Aste**: lähtö-, tulo- ja kokonaisaste solmua kohden.
- **Komponentit**: heikosti yhtenäiset komponentit ja niiden koot.
- **Lyhin polku**: kahden solmun välillä (tunnus tai nimi), suunnan huomioiden tai ilman.
- **Aliverkko**: valitse tunnisteet ja suhdetyypit ja tallenna valinta uutena verkkona.
- **Taulukot**: solmut ja särmät tavallisina taulukkoina ominaisuudet sarakkeina.

Mitat lasketaan taustasäikeessä koko verkolle (tiiviit vieruslistat), joten miljoonan särmän verkko saa asteet ja
komponentit muutamassa sekunnissa.

## R ja Python

Verkon SQLite-tiedosto peilataan R:lle ja Pythonille kuten kaikki aineistot. `dm_read("Verkko")` antaa solmut;
`dm_read_nodes()` ja `dm_read_edges()` antavat solmut ja särmät ominaisuudet sarakkeina:

```r
solmut <- dm_read_nodes("Verkko")
sarmat <- dm_read_edges("Verkko")
library(igraph)
g <- graph_from_data_frame(sarmat[, c("kalla", "mal", setdiff(names(sarmat), c("id", "kalla", "mal", "typ")))], vertices = solmut)
degree(g)
```

```python
import networkx as nx
solmut = dm_read_nodes("Verkko"); sarmat = dm_read_edges("Verkko")
g = nx.from_pandas_edgelist(sarmat, "kalla", "mal", edge_attr=True, create_using=nx.DiGraph)
nx.pagerank(g)
```

## Rajoitukset

- Cypher-osajoukko on vain lukeva; verkkojen muokkaus (lisää, poista, yhdistä, vedä särmiä) tulee myöhemmässä
  julkaisussa yhdessä Neo4j-yhteyden, PageRankin ja yhteisöjen kanssa.
- Avattavien ryhmien yleiskuva koskee enintään 5 000 elementin verkkoja; suuremmat verkot näytetään ryhminä lukumäärineen
  sekä keskitys- ja koko verkko -näkymissä.
- Ominaisuudet tallennetaan JSON-tekstinä; luvut vertaillaan lukuina Cypherissä mutta lajitellaan tekstinä solmutaulukossa.
