# Grafer: noder, kanter och Cypher

Dataspatium hanterar grafer (nätverk av noder och kanter) som ett eget slag av datamängd. En graf importeras från
GraphML, GEXF, JSON med noder och kanter eller ett Cypher-skript, eller byggs av två tabeller. Noderna är datamängdens
rader (id, etikett, namn och egenskaper som JSON), kanterna sparas i datamängdens egen tabell `_edges` (id, kalla, mal,
typ, egenskaper) och nodernas positioner i `_layout`. Grafen öppnas som grafvy i Bearbeta och får flikarna **Cypher**
(efter SQL) och **Graf** (efter Regex) i Analysera. Tabellen med noderna är alltid en knapp bort.

## Format som läses och skrivs

| Format | Filändelse | Läses | Skrivs | Anmärkning |
|---|---|---|---|---|
| GraphML | .graphml | ja | ja | Attributet `labels` (eller `label`) ger nodens etikett, kantens `label` dess typ, som i Neo4j:s export |
| GEXF 1.2/1.3 | .gexf | ja | ja | Gephis format; nodattributet `labels` eller `type` ger etiketten |
| JSON med noder och kanter | .json | ja | ja | `{nodes: [...], edges|links: [...]}` som i D3 och networkx, Cytoscapes `{elements: {nodes, edges}}`, Neo4j:s `{nodes, relationships}` |
| Cypher-skript | .cypher, .cql | ja | ja | Som APOC exporterar: `CREATE (:Etikett {…, \`UNIQUE IMPORT ID\`: 1});` och `MATCH … CREATE (n1)-[:TYP {…}]->(n2);`, även vanliga `CREATE`-skript |

JSON- och XML-filer känns igen på innehållet, så släpp filen i Inhämta: grafens uppgifter (noder, kanter, etiketter,
relationstyper) visas och knappen *Importera* skapar grafen. Export sker i Exportera, där en graf får formaten
GraphML, GEXF, JSON och Cypher-skript utöver tabellformaten för noderna.

## Graf av två tabeller

Knappen **Gör graf av tabeller** i Hantera (på en tabell) öppnar en dialog: välj kanttabellen med kolumnerna för
kantens början och slut (och gärna relationstyp), och om du vill en nodtabell med id, etikett och namn. Övriga kolumner
blir egenskaper. Noder som bara förekommer i kanterna skapas automatiskt. Riktad eller oriktad väljs i dialogen.

## Grafvyn i Bearbeta

Grafvyn ritas med Cytoscape och visar aldrig mer än den aktuella vyn (högst några tusen element), medan grafen själv
kan ha hundratusentals kanter.

- **Översikt per etikett**: varje etikett är en ihopfälld grupp med antal; dubbelklicka för att fälla ut gruppen. Stora
  grafer visar grupperna med antal kanter mellan dem; dubbelklick öppnar etikettens noder i fokus.
- **Fokus**: en delgraf som växer steg för steg. Sök en nod (namn, id eller egenskap) eller klicka på en etikett i
  teckenförklaringen, dubbelklicka på en nod eller tryck *Visa grannar* för att hämta grannskapet. Högst 2 000 noder.
- **Hela grafen**: WebGL-ritning med sigma för tiotusentals till hundratusentals element; etiketter visas vid
  inzoomning. Positionerna sparas i datamängden så att grafen öppnas snabbt nästa gång.
- Layouter: kraftbaserad (fCoSE), hierarkisk (dagre), rutnät, cirkel och koncentrisk. *Spara layout* sparar
  positionerna. Klicka på en nod eller kant för dess egenskaper i inspektören.

## Cypher i Analysera

Fliken Cypher tar en fråga i en Cypher-delmängd, översätter den till SQL mot datamängdens tabeller (noder i `data`,
kanter i `_edges`, egenskaper med `json_extract`) och visar både resultatet och SQL:en. Resultatet kan sparas som
datamängd eller hämtas som CSV.

Delmängden: `MATCH` och `OPTIONAL MATCH` med nod- och relationsmönster (etiketter, typer med `|`, egenskapskartor,
riktning, variabel längd `*1..5` med högst 10 steg), `WHERE` med jämförelser, `AND`/`OR`/`NOT`, `IN`, `IS NULL`,
`STARTS WITH`, `ENDS WITH`, `CONTAINS` och aritmetik, `RETURN` med `DISTINCT`, alias och aggregaten `count`, `sum`,
`avg`, `min`, `max`, `collect` (med Cyphers implicita gruppering), `ORDER BY`, `SKIP`, `LIMIT` samt funktionerna `id()`,
`labels()`, `type()`, `toLower()`, `toUpper()`, `size()`, `coalesce()`, `exists()`, `keys()`. Egenskaper nås som
`n.egenskap`; `n.name` ger nodens namn även när det inte är en egenskap. Skrivande satser (`CREATE`, `MERGE`, `SET`,
`REMOVE`, `DELETE`) blir receptsteg, se *Redigera grafen*. `WITH`, `UNWIND`, `shortestPath` och reguljära uttryck ingår inte;
kortaste väg finns som verktyg i fliken Graf.

Exempel:

```cypher
MATCH (a:Person)-[r:KNOWS]->(b) RETURN a.name, type(r), b.name LIMIT 50
MATCH (a)-[r]->(b) RETURN labels(a) AS fran, type(r) AS relation, labels(b) AS till, count(*) AS antal ORDER BY antal DESC
MATCH (p:Person)-[*1..3]-(q:Person) WHERE p.name = 'Anna' RETURN DISTINCT q.name
```

## Fliken Graf

- **Sammanfattning**: noder, kanter, täthet, medel- och maxgrad, isolerade noder, självkanter, komponenter, gradfördelning
  och de mest förbundna noderna.
- **Grad**: ut-, in- och total grad per nod.
- **Komponenter**: svagt sammanhängande komponenter och deras storlek.
- **Kortaste väg**: mellan två noder (id eller namn), med eller utan hänsyn till riktning.
- **Delgraf**: välj etiketter och relationstyper och spara urvalet som en ny graf.
- **Tabeller**: noderna och kanterna som vanliga tabeller med egenskaperna som kolumner.

Måtten beräknas i en bakgrundstråd på hela grafen (kompakta kantlistor), så en graf med en miljon kanter får grad och
komponenter på några sekunder.

## R och Python

Grafens SQLite-fil speglas till R och Python som alla datamängder. `dm_read("Graf")` ger noderna; `dm_read_nodes()`
och `dm_read_edges()` ger noder respektive kanter med egenskaperna som kolumner:

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

## Redigera grafen

Grafvyn redigerar grafen med knapparna under *Redigera* i inspektören: **Lägg till nod** (id, etikett, namn och
egenskaper som `nyckel: värde` per rad), **Ändra** och **Ta bort** för den markerade noden eller kanten, **Välj som start**
följt av **Koppla** för att dra en kant mellan två noder, och **Slå ihop** som för över kanterna från de valda noderna till
den markerade och fyller i egenskaper som saknas. Varje ändring är ett receptsteg (gruppen Graf: lägg till nod, ändra
noder, ta bort noder, slå ihop noder, lägg till kant, ändra kanter, ta bort kanter) som loggas, kan ångras och spelas
upp på en ny version av grafen; receptets SQL och R visar vad som gjordes.

Samma steg skapas av skrivande Cypher i fliken Cypher: `CREATE (a:Person {id: 'p9', name: 'Xenia'}),
(a)-[:KNOWS {since: 2020}]->(b)`, `MERGE (c:City {id: 'c2', name: 'Göteborg'})`, `MATCH (n:Person) WHERE n.age > 40
SET n.senior = true, n:Senior`, `MATCH (n {id: 'p1'}) REMOVE n.age`, `MATCH (a)-[r:KNOWS]->(b) DELETE r` och
`MATCH (n {id: 'c1'}) DETACH DELETE n`. Den läsande delen (MATCH … WHERE) avgör vilka noder och kanter som berörs, den
skrivande delen blir steg; värden är literaler.

## Neo4j som källa

*Neo4j* under *Lägg till källor* i Inhämta (familjen **Neo4j (Bolt)**, som också finns i *Databaskälla*): adress (`neo4j+s://…databases.neo4j.io` för Aura
eller en egen server), databas, användarnamn och lösenord (sparas aldrig i klartext). Källan öppnar en Cypher-redigerare;
*Kör* ansluter med Neo4j:s drivrutin över WebSocket efter ditt samtycke (ändamålet Neo4j) och visar resultatet som
tabell där noder och relationer plattas ut till sina egenskaper. Innehåller svaret noder och relationer sparar **Spara som
graf** dem som en grafdatamängd; annars *Spara som datamängd*. **Spara frågan** lägger frågan på källan så att den kan
köras igen med ett klick. Bolt över WebSocket omfattas inte av CORS; en egen server utan TLS (`bolt://`) nås bara från
en sida över http://. Innehåller svaret noder ritas de också som en graf.

## IFC-LPG på en Dataregium-server

Dataregium gör varje uppladdad IFC-fil till en graf: en nod per entitet, med klassen och alla dess överklasser som etiketter och
IFC-attributen som egenskaper, och relationer som heter som attributen (`IS_DEFINED_BY`, `RELATED_OBJECTS`, `HAS_PROPERTIES`).
Grafen finns på servern och kan vara mycket större än vad som är rimligt att hämta hem. Därför ritas och frågas den direkt från
*Inhämta*, och inget sparas förrän du ber om det.

Det finns två vägar till grafen, och båda ger samma vy:

- **Kortet IFC-LPG i OpenCDE-källan.** Frågorna går genom serverns läsande graffråga, som kräver att du loggar in som
  administratör och att servern har `OPENCDE_GRAPH_QUERY_ENABLED=true`. Det är vägen i drift: ingen databasport behöver vara
  öppen, servern sätter tak för rader och tid, tar bort lagrade hashvärden och loggar varje fråga.
- **En Neo4j-källa.** Bolt med databasens adress, användarnamn och lösenord, till exempel `bolt://127.0.0.1:7697` på en
  utvecklingsstack. Bolt ger tillgång till hela databasen, så appen läser alltid i en lässession och tar bort lagrade hashvärden
  ur svaren. I drift är Bolt stängt om inte den som driver servern har öppnat det; då visar kortet adressen.

**Visa modeller** listar modellerna i grafen, den senaste versionen av varje dokument först. Välj en modell och en vy:

| Vy | Visar |
|---|---|
| Rumslig struktur | Projekt, tomt, byggnad och våningar, med relationerna mellan dem |
| Byggdelar per våning | Vilka byggdelar varje våning innehåller |
| Byggdelar och typer | Byggdelarna och deras typer |
| Byggdelar och material | Byggdelarna och deras material |
| Egenskaper och mängder | Byggdelarnas egenskapsuppsättningar och mängder |
| Ärenden och byggdelar | BCF-ärenden, deras viewpoints och komponenter, och de byggdelar de pekar på |
| Hela modellen | Upp till 1 000 relationer i modellen |
| Antal per klass | En tabell med antalet entiteter per klass |
| Geometri per klass | En tabell med antalet geometrinoder per klass: representationer, solider, profiler, placeringar, stilar och lager |

Från Dataregium 3.0.0 lagras geometrin som ett skelett: representationer, solider, profiler, placeringar, kontexter, stilar, färger
och lager är noder, medan punkter, mesher och kurvor ligger som STEP-text i block. Vyerna Hela modellen och Antal per klass
utelämnar skelettets noder så att byggdelarna syns; Geometri per klass räknar dem, och Grannar på en byggdel visar dess form
och placering. Modellistan anger vilken form modellen har (skelett, block eller noder). En punktlista, när all geometri är
noder, visas som koordinater `x y z`.

Svaret ritas med Cytoscape, med tabellen under. Noderna färgas efter vad de är: rumslig struktur, byggdel, relation, typ,
egenskap eller mängd, material och övrigt. Layout och etiketter ändras utan att servern tillfrågas.

Klicka på en nod så visar inspektören dess attribut. **Grannar**, eller ett dubbelklick på noden, hämtar grannarna från servern
och lägger till dem i bilden. På en byggdel finns också **Egenskaper**, **Ärenden** och **Visa i modellen**, som öppnar byggdelen
i 3D om modellen finns i arbetsytan.

I rutan skriver du egen Cypher, allt som servern förstår, men bara läsande. Frågar du bara efter noder (`RETURN c, w`) hämtar
appen också relationerna mellan dem, som Neo4j Browser gör. Appen säger till när ett svar nått frågans `LIMIT` eller klippts, och
läsningen avbryts vid 20 000 rader. Svar med mer än 1 500 noder ritas inte här, men kan sparas och öppnas som översikt i Bearbeta. Grafen från Dataregium 3.0.0 bär också det som behövs för att skriva tillbaka filen (`<attribut>__type`, `<attribut>__step` och `StepBlock`-noder med sin text). Det lämnas ute när en nod visas eller sparas, men går att fråga efter med namn.

**Spara som graf** gör det du ser till en vanlig grafdatamängd: grafvyn i Bearbeta, flikarna Cypher och Graf i Analysera och
grafdiagram i Visualisera. Klassen blir nodens etikett och alla etiketter följer med, så `MATCH (w:IfcWall)` hittar också en
`IfcWallStandardCase` i kopian. I fliken Cypher kan du slå på **Kör på servern** för en graf som sparats härifrån, och då svarar
servern med all Cypher mot hela grafen i stället för delmängden mot kopian.

En IFC-modell som hämtats från Dataregium har knappen **IFC-LPG** i Hantera, och för en vald byggdel i Bearbeta. Den öppnar
modellens graf i Inhämta, i en Neo4j-källa på samma dator om det finns någon, annars i OpenCDE-källan.

Från IFC-LPG `d042134` kan servern räkna ut en låda per byggdel i projektkoordinater (meter): `bbox_min`, `bbox_max` och
`bbox_centre` som punkter på byggdelens nod, och modellnoden anger när lådorna räknades (`spatial_at`), för hur många byggdelar
(`spatial_products`) och hur många som inte gick (`spatial_failed`). Lådorna finns bara när servern har kört beräkningen, så fråga med
`bbox_centre IS NOT NULL`. Exemplet *Byggdelar nära en byggdel* i Neo4j-källan listar det som ligger inom 1,2 m av en byggdels mitt
med `point.distance`, lika i Neo4j och Memgraph.

## Fler verktyg i fliken Graf

- **PageRank** (dämpning 0,85), **Samhällen** (etikettspridning, numrerade efter storlek) och **Centralitet** (harmonisk
  närhet och mellanliggandecentralitet enligt Brandes, uppskattad från ett urval startnoder i stora grafer), alla
  beräknade i bakgrundstråden och sparbara som datamängder.
- **Mönster**: fråga utan kod: från-etikett, relation, till-etikett, riktning och ett villkor på från-nodens egenskap.
  Frågan byggs som Cypher, visas under resultatet och kan kopieras till fliken Cypher.
- **Layout**: kraftbaserad layout av hela grafen i bakgrunden (Fruchterman–Reingold med rutnät); positionerna sparas
  och används av visningen Hela grafen.

## Grafdiagram i Visualisera

**Spara som diagram** i grafvyn, eller *Nytt diagram* → *Graf* i Visualisera, ger ett grafdiagram: grafdatamängd,
visning (översikt, fokus med sökta noder, hela grafen), layout och etiketter. Diagrammet exporteras som SVG, PNG och
PDF (egen SVG-ritning från nodernas positioner), ingår i dashboards och i publicerade sidor som inbäddad SVG, och i
batchkörningar och dokumentmallar som andra diagram.

## Begränsningar

- Cypher saknar `WITH`, `UNWIND` och `shortestPath` i den egna delmängden (*Kör på servern* har dem för en graf från en server); Neo4j-källan är läsande (skrivning sker i appens egna grafer).
- Översikten med utfällbara grupper gäller grafer upp till 5 000 element; större grafer visas som grupper med antal och
  i fokus- och helgrafsvisningen.
- Egenskaper lagras som JSON-text; tal jämförs som tal i Cypher, men sorteras som text i nodtabellen.
