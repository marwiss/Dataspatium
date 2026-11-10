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
`SET`, `REMOVE`, `DELETE`) bliver recepttrin, se *Redigér grafen*. `WITH`, `UNWIND`, `shortestPath` og regulære udtryk
indgår ikke; korteste vej findes som værktøj i fanen Graf.

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

## Redigér grafen

Grafvisningen redigerer grafen med knapperne under *Redigér* i inspektøren: **Tilføj knude** (id, etiket, navn og
egenskaber som `nøgle: værdi` pr. linje), **Ændr** og **Fjern** for den markerede knude eller kant, **Vælg som start**
fulgt af **Forbind** for at trække en kant mellem to knuder, og **Slå sammen**, som flytter kanterne fra de valgte knuder
til den markerede og udfylder manglende egenskaber. Hver ændring er et recepttrin (gruppen Graf: tilføj knude, ændr
knuder, fjern knuder, slå knuder sammen, tilføj kant, ændr kanter, fjern kanter), der logges, kan fortrydes og afspilles
på en ny version af grafen; receptens SQL og R viser, hvad der blev gjort.

De samme trin kommer fra skrivende Cypher i fanen Cypher: `CREATE (a:Person {id: 'p9', name: 'Xenia'}),
(a)-[:KNOWS {since: 2020}]->(b)`, `MERGE (c:City {id: 'c2', name: 'Göteborg'})`, `MATCH (n:Person) WHERE n.age > 40
SET n.senior = true, n:Senior`, `MATCH (n {id: 'p1'}) REMOVE n.age`, `MATCH (a)-[r:KNOWS]->(b) DELETE r` og
`MATCH (n {id: 'c1'}) DETACH DELETE n`. Den læsende del (MATCH … WHERE) afgør, hvilke knuder og kanter der berøres, den
skrivende del bliver trin; værdier er literaler.

## Neo4j som kilde

*Neo4j* under *Tilføj kilder* i Indsaml (familien **Neo4j (Bolt)**, som også findes i *Databasekilde*): adresse (`neo4j+s://…databases.neo4j.io` for Aura eller
en egen server), database, brugernavn og adgangskode (gemmes aldrig i klartekst). Kilden åbner en Cypher-editor; *Kør*
forbinder med Neo4j's driver over WebSocket efter dit samtykke (formålet Neo4j) og viser resultatet som tabel, hvor
knuder og relationer fladgøres til deres egenskaber. Indeholder svaret knuder og relationer, gemmer **Gem som graf** dem
som et grafdatasæt; ellers *Gem som datasæt*. **Gem forespørgslen** lægger forespørgslen på kilden, så den kan køres igen
med ét klik. Bolt over WebSocket er ikke omfattet af CORS; en egen server uden TLS (`bolt://`) nås kun fra en side over http://. Indeholder svaret knuder, tegnes de også som en graf.

## IFC-LPG på en Dataregium-server

Dataregium gør hver uploadet IFC-fil til en graf: én knude per entitet, med klassen og alle dens overklasser som etiketter og
IFC-attributterne som egenskaber, og relationer, der hedder som attributterne (`IS_DEFINED_BY`, `RELATED_OBJECTS`,
`HAS_PROPERTIES`). Grafen ligger på serveren og kan være langt større, end det er rimeligt at hente hjem. Derfor tegnes og
forespørges den direkte fra *Hent*, og intet gemmes, før du beder om det.

Der er to veje til grafen, og begge giver samme visning:

- **Kortet IFC-LPG i OpenCDE-kilden.** Forespørgslerne går gennem serverens læsende grafforespørgsel, som kræver, at du logger
  ind som administrator, og at serveren har `OPENCDE_GRAPH_QUERY_ENABLED=true`. Det er vejen i drift: ingen databaseport behøver
  at være åben, serveren sætter grænser for rækker og tid, fjerner lagrede hashværdier og logger hver forespørgsel.
- **En Neo4j-kilde.** Bolt med databasens adresse, brugernavn og adgangskode, for eksempel `bolt://127.0.0.1:7697` på en
  udviklingsstak. Bolt giver adgang til hele databasen, så appen læser altid i en læsesession og fjerner lagrede hashværdier fra
  svarene. I drift er Bolt lukket, medmindre den, der driver serveren, har åbnet det; så viser kortet adressen.

**Vis modeller** viser modellerne i grafen, den nyeste version af hvert dokument først. Vælg en model og en visning:

| Visning | Viser |
|---|---|
| Rumlig struktur | Projekt, grund, bygning og etager, med relationerne mellem dem |
| Bygningsdele per etage | Hvilke bygningsdele hver etage indeholder |
| Bygningsdele og typer | Bygningsdelene og deres typer |
| Bygningsdele og materialer | Bygningsdelene og deres materialer |
| Egenskaber og mængder | Bygningsdelenes egenskabssæt og mængder |
| Sager og bygningsdele | BCF-sager, deres viewpoints og komponenter, og de bygningsdele, de peger på |
| Hele modellen | Op til 1.000 relationer i modellen |
| Antal per klasse | En tabel med antallet af entiteter per klasse |

Svaret tegnes med Cytoscape, med tabellen nedenunder. Knuderne farves efter, hvad de er: rumlig struktur, bygningsdel, relation,
type, egenskab eller mængde, materiale og øvrigt. Layout og etiketter ændres uden at spørge serveren.

Klik på en knude, så viser inspektøren dens attributter. **Naboer**, eller et dobbeltklik på knuden, henter naboerne fra serveren
og føjer dem til billedet. En bygningsdel har også **Egenskaber**, **Sager** og **Vis i modellen**, som åbner bygningsdelen i 3D,
hvis modellen findes i arbejdsområdet.

I feltet skriver du din egen Cypher, alt hvad serveren forstår, men kun læsende. Spørger du kun efter knuder (`RETURN c, w`), henter
appen også relationerne mellem dem, som Neo4j Browser gør. Appen siger til, når et svar har nået forespørgslens `LIMIT` eller er
klippet, og læsningen stopper ved 20.000 rækker. Svar med mere end 1.500 knuder tegnes ikke her, men kan gemmes og åbnes som oversigt
i Bearbejd.

**Gem som graf** gør det, du ser, til et almindeligt grafdatasæt: grafvisningen i Bearbejd, fanerne Cypher og Graf i Analysér og
grafdiagrammer i Visualisér. Klassen bliver knudens etiket, og alle etiketter følger med, så `MATCH (w:IfcWall)` også finder en
`IfcWallStandardCase` i kopien. I fanen Cypher kan du slå **Kør på serveren** til for en graf, der er gemt herfra, og så svarer serveren
med al Cypher mod hele grafen i stedet for delmængden mod kopien.

En IFC-model hentet fra Dataregium har knappen **IFC-LPG** i Håndter, og for en valgt bygningsdel i Bearbejd. Den åbner modellens graf i
Hent, i en Neo4j-kilde på samme computer, hvis der er en, ellers i OpenCDE-kilden.

## Flere værktøjer i fanen Graf

- **PageRank** (dæmpning 0,85), **Fællesskaber** (etiketudbredelse, nummereret efter størrelse) og **Centralitet**
  (harmonisk nærhed og mellemliggendecentralitet efter Brandes, estimeret ud fra et udvalg af startknuder i store grafer),
  alle beregnet i baggrundstråden og gemmes som datasæt.
- **Mønster**: forespørgsel uden kode: fra-etiket, relation, til-etiket, retning og en betingelse på fra-knudens egenskab.
  Forespørgslen bygges som Cypher, vises under resultatet og kan kopieres til fanen Cypher.
- **Layout**: kraftbaseret layout af hele grafen i baggrunden (Fruchterman–Reingold med gitter); positionerne gemmes og
  bruges af visningen Hele grafen.

## Grafdiagrammer i Visualisér

**Gem som diagram** i grafvisningen, eller *Nyt diagram* → *Graf* i Visualisér, giver et grafdiagram: grafdatasæt,
visning (oversigt, fokus med søgte knuder, hele grafen), layout og etiketter. Diagrammet eksporteres som SVG, PNG og PDF
(egen SVG-tegning ud fra knudernes positioner), indgår i dashboards og publicerede sider som indlejret SVG og i
batchkørsler og dokumentskabeloner som andre diagrammer.

## Begrænsninger

- Cypher mangler `WITH`, `UNWIND` og `shortestPath` i den lokale delmængde (*Kør på serveren* har dem for en graf fra en server); Neo4j-kilden er læsende (skrivning sker i appens egne grafer).
- Oversigten med udfoldelige grupper gælder grafer op til 5.000 elementer; større grafer vises som grupper med antal og
  i fokus- og helgrafvisningen.
- Egenskaber gemmes som JSON-tekst; tal sammenlignes som tal i Cypher, men sorteres som tekst i knudetabellen.
