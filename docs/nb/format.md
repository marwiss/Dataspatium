# Formater og import

## Støttede filformater

| Format | Import | Eksport | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med skilletegn | Ja | Ja | Skilletegn, tegnkoding og overskriftsrad gjenkjennes automatisk og kan endres |
| Tekst med fast kolonnebredde | Ja | Nei | Velg formatet i importtrinnet (filer med navnet .fwf eller .prn gjenkjennes). Kolonnestartene finnes ut fra mellomrom som finnes på alle rader, eller angis som posisjoner |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Velg ark; datoer og ja/nei blir ekte typer |
| ODS og FODS (LibreOffice) | Ja | ods | Samme typehåndtering som Excel |
| Eldre regnearkformater: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Ja | Nei | Leses av samme regnearkleser som Excel; velg ark. Excel 2003 XML gjenkjennes på innholdet, også når filen heter .xml |
| Tabeller i dokumenter: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Ja | Nei | Alle tabeller i filen vises i en liste med overskrift eller bildetekst og antall rader og kolonner. Sammenslåtte celler (colspan og rowspan, Words sammenslåtte celler, `\multicolumn`) fylles ut i alle radene og kolonnene de dekker. Overskriftsraden hentes fra `th`, `thead`, Markdowns skillelinje, Words overskriftsrad eller `booktabs` (`\midrule`) |
| KML og KMZ (Google Earth) | Ja | Ja | Én rad per sted med navn, beskrivelse, mappesti, tid og utvidede data som kolonner; punkter, linjer, polygoner og sammensatte geometrier blir GeoJSON |
| GPX (GPS-spor) | Ja | Ja | Velg lag: veipunkter, ruter, spor (med antall punkter og lengde i km) eller sporpunkter (én rad per punkt med tid og høyde) |
| TopoJSON | Ja | Nei | Hvert objekt i topologien er et lag; buene dekodes til vanlige GeoJSON-geometrier. Gjenkjennes på innholdet, også når filen heter .json |
| JSON | Ja | Ja | Liste med objekter, et objekt som inneholder en liste (sti kan angis), liste med lister |
| NDJSON, JSON Lines | Ja | Nei | Ett objekt per linje |
| JSON-stat | Ja | Nei | Gjenkjennes automatisk (`class: dataset`); én rad per celle med koder, tekster og verdi |
| SDMX-JSON | Ja | Nei | Datameldinger i SDMX-JSON 1.0 og 2.0 (for eksempel fra ECB og OECD) gjenkjennes automatisk; én rad per observasjon med kode- og tekstkolonne per dimensjon, tidsperiode, verdi og attributter |
| GeoJSON | Ja | Ja | Én rad per feature; egenskapene blir kolonner, geometrien en tekstkolonne med GeoJSON som kartdiagrammet tegner (kartet leser også WKT-tekst i en kolonne, for eksempel fra CSV). Ved eksport blir geometrikolonnen (GeoJSON eller WKT) hver features geometri og de øvrige kolonnene egenskapene |
| Shapefile (ZIP med shp, dbf, prj, cpg eller bare shp) | Ja | Nei | Attributtene blir typede kolonner etter dbf-skjemaet, geometrien GeoJSON i kolonnen `geometry`. Velg lag hvis ZIP-filen har flere, og forenkle geometrien med en toleranse i kartenheter. Koordinatene beholdes |
| XML | Ja | Ja | Én rad per gjentatt element (velges i importtrinnet); attributter og underelementer blir kolonner, nestede elementer får punktnavn som `lage.lan` |
| SQLite | Ja | Ja | Dataspatiums egen fil gjenopprettes med typer, etiketter og historikk; i andre databaser velger du tabell, og typene hentes fra skjemaet |
| SQL-skript (sql) | Ja | Nei | Et skript med `CREATE TABLE` og `INSERT`, for eksempel en databasedump, kjøres i en tom SQLite-database, og tabellene vises for valg. MySQL-spesifikke linjer (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` og tabellvalg som `ENGINE=`) fjernes først; andre dialekter fungerer så langt de følger SQLites syntaks |
| GeoPackage (gpkg) | Ja | Ja | Lagene (feature- og attributtabeller) velges som tabeller; geometrikolonnen blir GeoJSON som kartdiagrammet tegner, referansesystemet vises |
| Access (mdb, accdb) | Ja | Nei | Leses rett i nettleseren med mdb-reader; tabellen velges i trinnet Innstillinger, og typene kommer fra Access. Spørringer, lenkede tabeller og passord krever [databasebroen](kallor.md). |
| Dokumenter: PDF, Word (docx), OpenDocument (odt), Markdown (md), tekst (txt) | Ja | Nei | Blir en dokumentsamling med ett avsnitt per rad (dokument, side, avsnitt, type, tekst, tegn); flere filer på én gang blir én samling, og originalene følger med. Se [dokument.md](dokument.md) |
| Bilder: JPEG, PNG, WebP, GIF, BMP, AVIF | Ja | Nei | Blir en bildesamling med én rad per bilde (mål, størrelse, dato, kamera og posisjon fra EXIF); en forhåndsvisning og en miniatyr lagres, ikke originalene. Se [dokument.md](dokument.md) |
| BCF (bcf, bcfzip) | Ja | Ja | BCF-XML 3.0. Sakene blir en tabell, kommentarer og viewpoint-komponenter tabeller ved siden av; øyeblikksbilder følger ikke med inn. Eksport av et prosjekts saker fra modellvisningens panel Saker |
| QGIS-projekt (qgs, qgz) | Ja | Nei | Blir en kartvisning i Visualiser med prosjektets lagrekkefølge, synlighet og symboler (farger, linjebredder, punktstørrelser); lagene kobles til datasett med samme filnavn, og medfølgende datafiler importeres. Se [kartor.md](kartor.md) |
| SPSS sav, zsav, por | Ja | sav | Via R-pakken haven. Variabeletiketter blir kolonneetiketter og verdietiketter kolonnemetadata (se nedenfor) |
| Stata dta | Ja | dta | Via haven. Verdietiketter som for SPSS. Ved eksport forkortes kolonnenavnene etter Statas regler (32 tegn, ASCII) |
| SAS sas7bdat, xpt | Ja | Nei | Via haven |
| PX (PC-Axis, brukes av de nordiske statistikkbyråene) | Ja | Nei | Via R-pakken pxR; tegnkodingen leses fra filens CODEPAGE eller CHARSET. Resultatet er en lang tabell med én verdikolonne |
| Parquet | Ja | Ja | Via R-pakken nanoparquet; beholder typer nøyaktig |
| RDS, RData | Ja | rds | R-objekter; en RData-fil må inneholde en data.frame |
| Innlimt tekst | Ja | | Tabulator-, semikolon- eller kommaseparert |

Avgrensede tekstfiler på 64 MB eller mer leses i biter: forhåndsvisningen viser de første radene som vanlig, og ved
importen skrives radene til datasettet mens filen leses, slik at hele teksten aldri trenger å ligge i minnet. Kolonnetypene
hentes fra kolonnetrinnet eller gjettes ut fra den første biten. Framdriften vises som antall leste rader.

Alle filformater kan også hentes fra en nettadresse under *Fra nettadresse* i Hent, hvis serveren tillater forespørsler fra
nettleseren (CORS). Dataspatiums egne konfigurasjonsfiler (API-kilde, diagram, dashbord, dokumentmal, notatbok) gjenkjennes
på feltet `format` og legges til direkte.

Formatene som går via R, starter R-sesjonen ved behov (noen sekunder første gang) og har ingen forhåndsvisning: filen leses
av R og overleveres med `dm_write()`, så kolonnetypene kommer fra R. Ja/nei blir 0/1 i SPSS og Stata, som mangler en logisk
type.

Verdietiketter (koder med navn, som `1 = Mann` og `2 = Kvinne`) følger kolonnen som metadata i SQLite-filen
(`_columns.value_labels`). Ved import av SPSS, Stata og SAS velger du i innstillingstrinnet om kolonnen skal vise
etikettene som tekst (standard) eller beholde kodene; etikettene lagres i begge tilfeller. De kan settes, endres og byttes
mot kodene i Bearbeid, vises i kodeboken, når R som `haven::labelled` og skrives til .sav og .dta, der en kolonne med
etikettene som tekst får kodene sine tilbake.

Med appen følger også data som legges til i Hent: eksempeldataene *Befolkning per kommune 2024 (Sverige)* og grenser for
kart som GeoJSON i lengde- og breddegrad: kommuner og län i Sverige (SCB, CC0), kommuner og regioner i Danmark (DAGI),
kommuner og fylker i Norge (Kartverket, CC BY 4.0) samt kommuner og landskap i Finland (Statistikcentralen, CC BY 4.0).
Kilder og lisenser står i `presets/geo/KALLA.md`. Ingenting hentes fra nettet.

**Digitale planer** (typen plan): svenske detaljplaner etter Lantmäteriets nasjonale spesifikasjon (GeoJSON,
`feature:typ`), referanseobjekter fra den nasjonale geodataplattformen, kommuneplaner etter spesifikasjonens
testversjon (GeoJSON) og Boverkets ÖP-modell (GeoPackage med `innehall_op_*`). Gjenkjennes på innholdet og åpnes som
plankart; se [planer.md](planer.md).

**Nordiske planer** (typen plan): Plandata.dk-GeoJSON (lokalplaner, delområder, byggefelt, kommuneplanrammer), Finlands
plandatamodell (Ryhti-JSON), Skipulagsstofnuns stafrænt skipulag (GeoJSON eller GeoPackage-malen) og norske
reguleringsplaner/kommuneplaner som GeoPackage (Rp-/Kp-tabeller). Gjenkjennes på innholdet; GeoPackage-filer får valget
*Hele planen som plan*. Se [planer.md](planer.md).

**Grafer** (typen graf): GraphML, GEXF, JSON med noder og kanter (D3, networkx, Cytoscape, Neo4j) og Cypher-skript
(APOC-eksport). Leses og skrives; gjenkjennes på innholdet. Se [grafer.md](grafer.md).

**Bygningsmodeller og tegninger** (typen modell): IFC (`.ifc`, `.ifczip`; IFC2X3, IFC4, IFC4X3) og DXF. Originalfilen lagres;
bygningsdeler, egenskaper og mengder blir tabeller, og DXF-tegningen blir SVG. Se [cad-bim.md](cad-bim.md).

## Tegnkoding

Tekstfiler kontrolleres i denne rekkefølgen: byte order mark (UTF-8, UTF-16), UTF-16 uten BOM (mange nullbyte), ren ASCII,
streng UTF-8-validering av den første megabyten, ellers Windows-1252. Windows-1252 er vanlig for filer lagret fra eldre
nordiske Excel-versjoner. Du kan alltid bytte koding i importtrinnet.

## Skilletegn og desimaltegn

Skilletegnet gjettes blant semikolon, komma, tabulator og loddrett strek. Nordiske CSV-filer bruker oftest semikolon fordi
komma er desimaltegn. Desimaltegnet avgjøres per kolonne: er kommadesimaler minst like vanlige som punktumdesimaler, velges
komma. Tusenskilletegn (mellomrom, hardt mellomrom, punktum ved kommadesimaler) fjernes.

## Kolonnetyper

| Type | Gjenkjennes som | Lagres som |
|---|---|---|
| Tekst | Alt som ikke passer noe annet, og alle tall med innledende null (kommunenumre, postnumre, personnumre) | TEXT |
| Heltall | `12`, `-3`, `1 234` | INTEGER |
| Desimaltall | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Dato | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `ÅÅÅÅ-MM-DD` |
| Dato og tid | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel-datoer med klokkeslett | TEXT, `ÅÅÅÅ-MM-DD TT:MM:SS` |
| Ja/nei | `ja`, `nej`, `true`, `false`, `yes`, `no`, `sant`, `falskt`, `j`, `n` | INTEGER 0/1 |

En kolonne får bare en type hvis alle utfylte verdier i utvalget passer. Tomme verdier blir alltid «tom» (NULL). Verdier som
ikke kan tolkes med typen du velger manuelt, blir også tomme.

## Datasettets fil

Hvert datasett er en SQLite-fil med tabellene `data` (radene), `_columns` (navn, type, etikett, opprinnelig navn,
beskrivelse, enhet og verdietiketter; de tre siste legges til når en eldre fil åpnes), `_meta` (navn, kortnavn,
beskrivelse, tidsstempler, kilde, importinnstillinger), `_log` (alt som er gjort med datasettet) og, når noen har
kommentert, `_comments` (tid, navn, tekst, kolonne og om kommentaren er løst). Filen kan åpnes i R med RSQLite, i DB
Browser for SQLite og i de fleste andre verktøy.

## Arbeidsområdets filer

Sikkerhetskopien (ZIP), den portable mappen (Edge og Chrome) og mappen i et GitHub-repository har samme oppbygning:
`manifest.json` med en liste over innholdet, `datasets/<id>.sqlite` per datasett, `charts/<id>.viz.json` per lagret
diagram, `documents/<id>.doc.json` per egen dokumentmal, `dashboards/<id>.dash.json` per dashbord,
`notebooks/<id>.nb.json` per notatbok og `scripts/<id>.script.json` per lagret R-skript, SQL-skript eller regex-mønster.
En pakke (*Pakke* i modusen Del) har samme oppbygning, men inneholder bare det du har valgt. Manifestet har
`kind: bundle`, avsenderens navn (`author`), meldingen (`message`) og endringene i hvert datasett siden det sist ble delt
eller mottatt (`changes`), og pakken har dessuten `CHANGELOG.md` med det samme og de uløste kommentarene i lesbar form.
Når en pakke lastes inn, vises meldingen og endringene, og alt som allerede finnes, hoppes over (datasett med samme id,
diagrammer, dashbord, maler og notatbøker med samme navn), unntatt datasettene du velger å erstatte med pakkens versjon;
din versjon lagres da under *Versjoner*. Med automatisk lagring slått på skrives endrede datasett til den portable mappen
kort etter hver lagring, og filer for slettede datasett fjernes. Mappen kan lastes inn på en annen datamaskin på samme
måte som en pakke.

Manifestet har `format: 2` siden versjon 2.0: hvert datasett i listen har i tillegg til `id`, `name` og `shortName`
også `folder` (mappen, som `Økonomi/2026`, eller tom) og `tags` (en liste). Eldre pakker og sikkerhetskopier (uten
`format`) leses som før. Mappe og tagger ligger også i datasettets egen fil (`_meta`), så de følger med uansett hvor
filen havner, i likhet med `kind` (`table`, `graph`, `document`, `images`, `model`); i 2.0 er alle datasett tabeller.

Radene i `_log` har tidsstempel, handlingstype og detaljer som JSON. Handlingstypene er blant andre `import`, `op` (et trinn
i oppskriften med `op`, `params`, `result` og `description`; det er disse radene som utgjør oppskriften), `undo`,
`snapshot`, `restore`, `comment` (en ny kommentar), `shared` og `received` (når datasettet ble delt eller mottatt i en
pakke eller fra GitHub; endringsloggen i neste pakke begynner etter den siste av dem). Håndter viser radene som lesbar
tekst. Oppskriftens eksport i Bearbeid bygger på `op`-radene, se [bearbeta.md](bearbeta.md).
