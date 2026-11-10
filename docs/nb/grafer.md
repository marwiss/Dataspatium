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
`REMOVE`, `DELETE`) blir reseptsteg, se *Rediger grafen*. `WITH`, `UNWIND`, `shortestPath` og regulære uttrykk inngår
ikke; korteste vei finnes som verktøy i fanen Graf.

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

## Rediger grafen

Grafvisningen redigerer grafen med knappene under *Rediger* i inspektøren: **Legg til node** (id, etikett, navn og
egenskaper som `nøkkel: verdi` per linje), **Endre** og **Fjern** for den markerte noden eller kanten, **Velg som start**
fulgt av **Koble** for å trekke en kant mellom to noder, og **Slå sammen**, som flytter kantene fra de valgte nodene til
den markerte og fyller inn egenskaper som mangler. Hver endring er et reseptsteg (gruppen Graf: legg til node, endre
noder, fjern noder, slå sammen noder, legg til kant, endre kanter, fjern kanter) som logges, kan angres og spilles av på
en ny versjon av grafen; reseptens SQL og R viser hva som ble gjort.

De samme stegene kommer fra skrivende Cypher i fanen Cypher: `CREATE (a:Person {id: 'p9', name: 'Xenia'}),
(a)-[:KNOWS {since: 2020}]->(b)`, `MERGE (c:City {id: 'c2', name: 'Göteborg'})`, `MATCH (n:Person) WHERE n.age > 40
SET n.senior = true, n:Senior`, `MATCH (n {id: 'p1'}) REMOVE n.age`, `MATCH (a)-[r:KNOWS]->(b) DELETE r` og
`MATCH (n {id: 'c1'}) DETACH DELETE n`. Den lesende delen (MATCH … WHERE) avgjør hvilke noder og kanter som berøres, den
skrivende delen blir steg; verdier er literaler.

## Neo4j som kilde

*Neo4j* under *Legg til kilder* i Hent inn (familien **Neo4j (Bolt)**, som også finnes i *Databasekilde*): adresse (`neo4j+s://…databases.neo4j.io` for Aura
eller en egen server), database, brukernavn og passord (lagres aldri i klartekst). Kilden åpner en Cypher-redigerer;
*Kjør* kobler til med Neo4js driver over WebSocket etter ditt samtykke (formålet Neo4j) og viser resultatet som tabell
der noder og relasjoner flates ut til egenskapene sine. Inneholder svaret noder og relasjoner, lagrer **Lagre som graf**
dem som et grafdatasett; ellers *Lagre som datasett*. **Lagre spørringen** legger spørringen på kilden slik at den kan
kjøres igjen med ett klikk. Bolt over WebSocket omfattes ikke av CORS; en egen server uten TLS (`bolt://`) nås bare fra
en side over http://. Inneholder svaret noder, tegnes de også som en graf.

## IFC-LPG på en Dataregium-server

Dataregium gjør hver opplastet IFC-fil til en graf: én node per entitet, med klassen og alle dens overklasser som etiketter og
IFC-attributtene som egenskaper, og relasjoner som heter som attributtene (`IS_DEFINED_BY`, `RELATED_OBJECTS`, `HAS_PROPERTIES`).
Grafen ligger på serveren og kan være langt større enn det er rimelig å hente hjem. Derfor tegnes og spørres den direkte fra
*Hent*, og ingenting lagres før du ber om det.

Det finnes to veier til grafen, og begge gir samme visning:

- **Kortet IFC-LPG i OpenCDE-kilden.** Spørringene går gjennom serverens lesende grafspørring, som krever at du logger inn som
  administrator, og at serveren har `OPENCDE_GRAPH_QUERY_ENABLED=true`. Det er veien i drift: ingen databaseport må være åpen,
  serveren setter grenser for rader og tid, fjerner lagrede hashverdier og logger hver spørring.
- **En Neo4j-kilde.** Bolt med databasens adresse, brukernavn og passord, for eksempel `bolt://127.0.0.1:7697` på en
  utviklingsstakk. Bolt gir tilgang til hele databasen, så appen leser alltid i en lesesesjon og fjerner lagrede hashverdier fra
  svarene. I drift er Bolt lukket med mindre den som driver serveren, har åpnet det; da viser kortet adressen.

**Vis modeller** viser modellene i grafen, den nyeste versjonen av hvert dokument først. Velg en modell og en visning:

| Visning | Viser |
|---|---|
| Romlig struktur | Prosjekt, tomt, bygning og etasjer, med relasjonene mellom dem |
| Bygningsdeler per etasje | Hvilke bygningsdeler hver etasje inneholder |
| Bygningsdeler og typer | Bygningsdelene og typene deres |
| Bygningsdeler og materialer | Bygningsdelene og materialene deres |
| Egenskaper og mengder | Bygningsdelenes egenskapssett og mengder |
| Saker og bygningsdeler | BCF-saker, viewpointene og komponentene deres, og bygningsdelene de peker på |
| Hele modellen | Opptil 1 000 relasjoner i modellen |
| Antall per klasse | En tabell med antall entiteter per klasse |
| Geometri per klasse | En tabell med antall geometrinoder per klasse: representasjoner, solider, profiler, plasseringer, stiler og lag |

Fra Dataregium 3.0.0 lagres geometrien som et skjelett: representasjoner, solider, profiler, plasseringer, kontekster, stiler,
farger og lag er noder, mens punkter, mesher og kurver ligger som STEP-tekst i blokker. Visningene Hele modellen og Antall per
klasse utelater skjelettets noder, slik at bygningsdelene vises; Geometri per klasse teller dem, og Naboer på en bygningsdel
viser formen og plasseringen dens. Modellisten sier hvilken form modellen har (skjelett, blokker eller noder). En punktliste,
når all geometri er noder, vises som koordinater `x y z`.

Svaret tegnes med Cytoscape, med tabellen under. Nodene farges etter hva de er: romlig struktur, bygningsdel, relasjon, type,
egenskap eller mengde, materiale og øvrig. Layout og etiketter endres uten å spørre serveren.

Klikk på en node, så viser inspektøren attributtene. **Naboer**, eller et dobbeltklikk på noden, henter naboene fra serveren og
legger dem til i bildet. En bygningsdel har også **Egenskaper**, **Saker** og **Vis i modellen**, som åpner bygningsdelen i 3D hvis
modellen finnes i arbeidsområdet.

I feltet skriver du din egen Cypher, alt serveren forstår, men bare lesende. Spør du bare etter noder (`RETURN c, w`), henter appen
også relasjonene mellom dem, slik Neo4j Browser gjør. Appen sier fra når et svar har nådd spørringens `LIMIT` eller er klippet, og
lesingen stopper ved 20 000 rader. Svar med mer enn 1 500 noder tegnes ikke her, men kan lagres og åpnes som oversikt i Bearbeid. Grafen fra Dataregium 3.0.0 bærer også det som trengs for å skrive filen tilbake (`<attributt>__type`, `<attributt>__step` og `StepBlock`-noder med teksten sin). Det utelates når en node vises eller lagres, men kan spørres etter med navn.

**Lagre som graf** gjør det du ser, til et vanlig grafdatasett: grafvisningen i Bearbeid, fanene Cypher og Graf i Analyser og
grafdiagrammer i Visualiser. Klassen blir nodens etikett og alle etiketter følger med, så `MATCH (w:IfcWall)` også finner en
`IfcWallStandardCase` i kopien. I fanen Cypher kan du slå på **Kjør på serveren** for en graf som er lagret herfra, og da svarer
serveren med all Cypher mot hele grafen i stedet for delmengden mot kopien.

En IFC-modell hentet fra Dataregium har knappen **IFC-LPG** i Håndter, og for en valgt bygningsdel i Bearbeid. Den åpner modellens
graf i Hent, i en Neo4j-kilde på samme datamaskin hvis det finnes en, ellers i OpenCDE-kilden.

## Flere verktøy i fanen Graf

- **PageRank** (demping 0,85), **Fellesskap** (etikettspredning, nummerert etter størrelse) og **Sentralitet** (harmonisk
  nærhet og mellomliggende sentralitet etter Brandes, anslått fra et utvalg startnoder i store grafer), alle beregnet i
  bakgrunnstråden og kan lagres som datasett.
- **Mønster**: spørring uten kode: fra-etikett, relasjon, til-etikett, retning og et vilkår på fra-nodens egenskap.
  Spørringen bygges som Cypher, vises under resultatet og kan kopieres til fanen Cypher.
- **Layout**: kraftbasert layout av hele grafen i bakgrunnen (Fruchterman–Reingold med rutenett); posisjonene lagres og
  brukes av visningen Hele grafen.

## Grafdiagrammer i Visualiser

**Lagre som diagram** i grafvisningen, eller *Nytt diagram* → *Graf* i Visualiser, gir et grafdiagram: grafdatasett,
visning (oversikt, fokus med søkte noder, hele grafen), layout og etiketter. Diagrammet eksporteres som SVG, PNG og PDF
(egen SVG-tegning fra nodenes posisjoner), inngår i dashboards og publiserte sider som innebygd SVG, og i batchkjøringer
og dokumentmaler som andre diagrammer.

## Begrensninger

- Cypher mangler `WITH`, `UNWIND` og `shortestPath` i den lokale delmengden (*Kjør på serveren* har dem for en graf fra en server); Neo4j-kilden er lesende (skriving skjer i appens egne grafer).
- Oversikten med utfoldbare grupper gjelder grafer opptil 5 000 elementer; større grafer vises som grupper med antall og
  i fokus- og helgrafvisningen.
- Egenskaper lagres som JSON-tekst; tall sammenlignes som tall i Cypher, men sorteres som tekst i nodetabellen.
