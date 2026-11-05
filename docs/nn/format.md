# Format og import

## Støtta filformat

| Format | Import | Eksport | Kommentar |
|---|---|---|---|
| CSV, TSV, TXT med skiljeteikn | Ja | Ja | Skiljeteikn, teiknkoding og overskriftsrad blir kjende att automatisk og kan endrast |
| Tekst med fast kolonnebreidd | Ja | Nei | Vel formatet i importsteget (filer med namnet .fwf eller .prn blir kjende att). Kolonnestartane blir funne ut frå mellomrom som finst på alle rader, eller oppgjevne som posisjonar |
| Excel xlsx, xlsm, xls, xlsb | Ja | xlsx | Vel ark; datoar og ja/nei blir ekte typar |
| ODS og FODS (LibreOffice) | Ja | ods | Same typehandtering som Excel |
| Eldre reknearkformat: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Ja | Nei | Blir lesne av same reknearklesar som Excel; vel ark. Excel 2003 XML blir kjent att på innhaldet, òg når fila heiter .xml |
| Tabellar i dokument: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Ja | Nei | Alle tabellar i fila blir viste i ei liste med overskrift eller bilettekst og tal på rader og kolonnar. Samanslegne celler (colspan og rowspan, dei samanslegne cellene i Word, `\multicolumn`) blir fylte ut i alle radene og kolonnane dei dekkjer. Overskriftsrada blir henta frå `th`, `thead`, skiljelinja i Markdown, overskriftsrada i Word eller `booktabs` (`\midrule`) |
| KML og KMZ (Google Earth) | Ja | Ja | Éi rad per stad med namn, skildring, mappesti, tid og utvida data som kolonnar; punkt, linjer, polygon og samansette geometriar blir GeoJSON |
| GPX (GPS-spor) | Ja | Ja | Vel lag: vegpunkt, ruter, spor (med tal på punkt og lengd i km) eller sporpunkt (éi rad per punkt med tid og høgd) |
| TopoJSON | Ja | Nei | Kvart objekt i topologien er eit lag; bogane blir dekoda til vanlege GeoJSON-geometriar. Blir kjent att på innhaldet, òg når fila heiter .json |
| JSON | Ja | Ja | Liste med objekt, eit objekt som inneheld ei liste (sti kan oppgjevast), liste med lister |
| NDJSON, JSON Lines | Ja | Nei | Eitt objekt per linje |
| JSON-stat | Ja | Nei | Blir kjent att automatisk (`class: dataset`); éi rad per celle med kodar, tekstar og verdi |
| SDMX-JSON | Ja | Nei | Datameldingar i SDMX-JSON 1.0 og 2.0 (til dømes frå ECB og OECD) blir kjende att automatisk; éi rad per observasjon med kode- og tekstkolonne per dimensjon, tidsperiode, verdi og attributt |
| GeoJSON | Ja | Ja | Éi rad per feature; eigenskapane blir kolonnar, geometrien ein tekstkolonne med GeoJSON som kartdiagrammet teiknar (kartet les òg WKT-tekst i ein kolonne, til dømes frå CSV). Ved eksport blir geometrikolonnen (GeoJSON eller WKT) geometrien til kvar feature og dei andre kolonnane eigenskapane |
| Shapefile (ZIP med shp, dbf, prj, cpg eller berre shp) | Ja | Nei | Attributta blir typa kolonnar etter dbf-skjemaet, geometrien GeoJSON i kolonnen `geometry`. Vel lag om ZIP-fila har fleire, og forenkle geometrien med ein toleranse i karteiningar. Koordinatane blir haldne |
| XML | Ja | Ja | Éi rad per gjenteke element (blir valt i importsteget); attributt og underelement blir kolonnar, nøsta element får punktnamn som `lage.lan` |
| SQLite | Ja | Ja | Den eigne fila til Dataspatium blir gjenoppretta med typar, etikettar og historikk; i andre databasar vel du tabell, og typane blir henta frå skjemaet |
| SQL-skript (sql) | Ja | Nei | Eit skript med `CREATE TABLE` og `INSERT`, til dømes ein databasedump, blir køyrt i ein tom SQLite-database, og tabellane blir viste for val. MySQL-spesifikke linjer (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` og tabellval som `ENGINE=`) blir fjerna først; andre dialektar fungerer så langt dei følgjer syntaksen i SQLite |
| GeoPackage (gpkg) | Ja | Ja | Laga (feature- og attributtabellar) blir valde som tabellar; geometrikolonnen blir GeoJSON som kartdiagrammet teiknar, referansesystemet blir vist |
| Access (mdb, accdb) | Ja | Nei | Blir lese rett i nettlesaren med mdb-reader; tabellen blir vald i steget Innstillingar, og typane kjem frå Access. Spørjingar, lenkja tabellar og passord krev [databasebrua](kallor.md). |
| Dokument: PDF, Word (docx), OpenDocument (odt), Markdown (md), tekst (txt) | Ja | Nei | Blir ei dokumentsamling med eitt avsnitt per rad (dokument, side, avsnitt, type, tekst, teikn); fleire filer på éin gong blir éi samling, og originalane følgjer med. Sjå [dokument.md](dokument.md) |
| Bilete: JPEG, PNG, WebP, GIF, BMP, AVIF | Ja | Nei | Blir ei biletsamling med éi rad per bilete (mål, storleik, dato, kamera og posisjon frå EXIF); ei førehandsvising og ein miniatyr blir lagra, ikkje originalane. Sjå [dokument.md](dokument.md) |
| BCF (bcf, bcfzip) | Ja | Ja | BCF-XML 3.0. Sakene blir ein tabell, kommentarar og viewpoint-komponentar tabellar ved sida av; augneblinksbilete følgjer ikkje med inn. Eksport av sakene i eit prosjekt frå panelet Saker i modellvisinga |
| QGIS-prosjekt (qgs, qgz) | Ja | Nei | Blir ei kartvising i Visualiser med lagrekkjefølgja, synlegheita og symbola (fargar, linjebreidder, punktstorleikar) i prosjektet; laga blir kopla til datasett med same filnamn, og datafiler som følgjer med blir importerte. Sjå [kartor.md](kartor.md) |
| SPSS sav, zsav, por | Ja | sav | Via R-pakken haven. Variabeletikettar blir kolonneetikettar og verdietikettar kolonnemetadata (sjå nedanfor) |
| Stata dta | Ja | dta | Via haven. Verdietikettar som for SPSS. Ved eksport blir kolonnenamna korta etter reglane i Stata (32 teikn, ASCII) |
| SAS sas7bdat, xpt | Ja | Nei | Via haven |
| PX (PC-Axis, brukt av dei nordiske statistikkbyråa) | Ja | Nei | Via R-pakken pxR; teiknkodinga blir lesen frå CODEPAGE eller CHARSET i fila. Resultatet er ein lang tabell med éin verdikolonne |
| Parquet | Ja | Ja | Via R-pakken nanoparquet; held på typar nøyaktig |
| RDS, RData | Ja | rds | R-objekt; ei RData-fil må innehalde ein data.frame |
| Innlimt tekst | Ja | | Tabulator-, semikolon- eller kommaseparert |

Avgrensa tekstfiler på 64 MB eller meir blir lesne i bitar: førehandsvisinga viser dei første radene som vanleg, og ved
importen blir radene skrivne til datasettet medan fila blir lesen, slik at heile teksten aldri treng liggje i minnet. Kolonnetypane
blir henta frå kolonnesteget eller gjetta ut frå den første biten. Framdrifta blir vist som tal på lesne rader.

Alle filformat kan òg hentast frå ei nettadresse under *Frå nettadresse* i Hent, om tenaren tillèt førespurnader frå
nettlesaren (CORS). Dei eigne konfigurasjonsfilene til Dataspatium (API-kjelde, diagram, dashbord, dokumentmal, notatbok) blir kjende att
på feltet `format` og lagde til direkte.

Formata som går via R, startar R-sesjonen ved behov (nokre sekund første gongen) og har inga førehandsvising: fila blir lesen
av R og overlevert med `dm_write()`, så kolonnetypane kjem frå R. Ja/nei blir 0/1 i SPSS og Stata, som manglar ein logisk
type.

Verdietikettar (kodar med namn, som `1 = Mann` og `2 = Kvinne`) følgjer kolonnen som metadata i SQLite-fila
(`_columns.value_labels`). Ved import av SPSS, Stata og SAS vel du i innstillingssteget om kolonnen skal vise
etikettane som tekst (standard) eller halde på kodane; etikettane blir lagra i begge tilfelle. Dei kan setjast, endrast og bytast
mot kodane i Bearbeid, blir viste i kodeboka, når R som `haven::labelled` og blir skrivne til .sav og .dta, der ein kolonne med
etikettane som tekst får kodane sine tilbake.

Med appen følgjer òg data som blir lagde til i Hent: dømedataa *Folketal per kommune 2024 (Sverige)* og grenser for
kart som GeoJSON i lengde- og breiddegrad: kommunar og län i Sverige (SCB, CC0), kommunar og regionar i Danmark (DAGI),
kommunar og fylke i Noreg (Kartverket, CC BY 4.0) og dessutan kommunar og landskap i Finland (Statistikcentralen, CC BY 4.0).
Kjelder og lisensar står i `presets/geo/KALLA.md`. Ingenting blir henta frå nettet.

**Digitale planar** (typen plan): svenske detaljplanar etter den nasjonale spesifikasjonen frå Lantmäteriet (GeoJSON,
`feature:typ`), referanseobjekt frå den nasjonale geodataplattforma, kommuneplanar etter testversjonen av spesifikasjonen
(GeoJSON) og ÖP-modellen frå Boverket (GeoPackage med `innehall_op_*`). Blir kjende att på innhaldet og opna som
plankart; sjå [planer.md](planer.md).

**Nordiske planar** (typen plan): Plandata.dk-GeoJSON (lokalplanar, delområde, byggjefelt, kommuneplanrammer), plandatamodellen
i Finland (Ryhti-JSON), stafrænt skipulag frå Skipulagsstofnun (GeoJSON eller GeoPackage-malen) og norske
reguleringsplanar/kommuneplanar som GeoPackage (Rp-/Kp-tabellar). Blir kjende att på innhaldet; GeoPackage-filer får valet
*Heile planen som plan*. Sjå [planer.md](planer.md).

**Grafar** (typen graf): GraphML, GEXF, JSON med nodar og kantar (D3, networkx, Cytoscape, Neo4j) og Cypher-skript
(APOC-eksport). Blir lesne og skrivne; blir kjende att på innhaldet. Sjå [grafer.md](grafer.md).

**Bygningsmodellar og teikningar** (typen modell): IFC (`.ifc`, `.ifczip`; IFC2X3, IFC4, IFC4X3) og DXF. Originalfila blir lagra;
bygningsdelar, eigenskapar og mengder blir tabellar, og DXF-teikninga blir SVG. Sjå [cad-bim.md](cad-bim.md).

## Teiknkoding

Tekstfiler blir kontrollerte i denne rekkjefølgja: byte order mark (UTF-8, UTF-16), UTF-16 utan BOM (mange nullbyte), rein ASCII,
streng UTF-8-validering av den første megabyten, elles Windows-1252. Windows-1252 er vanleg for filer lagra frå eldre
nordiske Excel-versjonar. Du kan alltid byte koding i importsteget.

## Skiljeteikn og desimalteikn

Skiljeteiknet blir gjetta blant semikolon, komma, tabulator og loddrett strek. Nordiske CSV-filer brukar oftast semikolon fordi
komma er desimalteikn. Desimalteiknet blir avgjort per kolonne: er kommadesimalar minst like vanlege som punktumdesimalar, blir
komma valt. Tusenskiljeteikn (mellomrom, hardt mellomrom, punktum ved kommadesimalar) blir fjerna.

## Kolonnetypar

| Type | Blir kjent att som | Blir lagra som |
|---|---|---|
| Tekst | Alt som ikkje passar noko anna, og alle tal med innleiande null (kommunenummer, postnummer, personnummer) | TEXT |
| Heiltal | `12`, `-3`, `1 234` | INTEGER |
| Desimaltal | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Dato | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `ÅÅÅÅ-MM-DD` |
| Dato og tid | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel-datoar med klokkeslett | TEXT, `ÅÅÅÅ-MM-DD TT:MM:SS` |
| Ja/nei | `ja`, `nej`, `true`, `false`, `yes`, `no`, `sant`, `falskt`, `j`, `n` | INTEGER 0/1 |

Ein kolonne får berre ein type om alle utfylte verdiar i utvalet passar. Tomme verdiar blir alltid «tom» (NULL). Verdiar som
ikkje kan tolkast med typen du vel manuelt, blir òg tomme.

## Fila til datasettet

Kvart datasett er ei SQLite-fil med tabellane `data` (radene), `_columns` (namn, type, etikett, opphavleg namn,
skildring, eining og verdietikettar; dei tre siste blir lagde til når ei eldre fil blir opna), `_meta` (namn, kortnamn,
skildring, tidsstempel, kjelde, importinnstillingar), `_log` (alt som er gjort med datasettet) og, når nokon har
kommentert, `_comments` (tid, namn, tekst, kolonne og om kommentaren er løyst). Fila kan opnast i R med RSQLite, i DB
Browser for SQLite og i dei fleste andre verktøy.

## Filene i arbeidsområdet

Tryggingskopien (ZIP), den portable mappa (Edge og Chrome) og mappa i eit GitHub-repositorium har same oppbygging:
`manifest.json` med ei liste over innhaldet, `datasets/<id>.sqlite` per datasett, `charts/<id>.viz.json` per lagra
diagram, `documents/<id>.doc.json` per eigen dokumentmal, `dashboards/<id>.dash.json` per dashbord,
`notebooks/<id>.nb.json` per notatbok og `scripts/<id>.script.json` per lagra R-skript, SQL-skript eller regex-mønster.
Ein pakke (*Pakke* i modusen Del) har same oppbygging, men inneheld berre det du har valt. Manifestet har
`kind: bundle`, namnet på avsendaren (`author`), meldinga (`message`) og endringane i kvart datasett sidan det sist vart delt
eller motteke (`changes`), og pakken har dessutan `CHANGELOG.md` med det same og dei uløyste kommentarane i lesbar form.
Når ein pakke blir lasta inn, blir meldinga og endringane viste, og alt som allereie finst, blir hoppa over (datasett med same id,
diagram, dashbord, malar og notatbøker med same namn), unnateke datasetta du vel å erstatte med versjonen i pakken;
din versjon blir då lagra under *Versjonar*. Med automatisk lagring slått på blir endra datasett skrivne til den portable mappa
kort etter kvar lagring, og filer for sletta datasett blir fjerna. Mappa kan lastast inn på ei anna datamaskin på same
måte som ein pakke.

Manifestet har `format: 2` sidan versjon 2.0: kvart datasett i lista har i tillegg til `id`, `name` og `shortName`
òg `folder` (mappa, som `Økonomi/2026`, eller tom) og `tags` (ei liste). Eldre pakkar og tryggingskopiar (utan
`format`) blir lesne som før. Mappe og taggar ligg òg i den eigne fila til datasettet (`_meta`), så dei følgjer med uansett kvar
fila hamnar, i likskap med `kind` (`table`, `graph`, `document`, `images`, `model`); i 2.0 er alle datasett tabellar.

Radene i `_log` har tidsstempel, handlingstype og detaljar som JSON. Handlingstypane er mellom andre `import`, `op` (eit steg
i oppskrifta med `op`, `params`, `result` og `description`; det er desse radene som utgjer oppskrifta), `undo`,
`snapshot`, `restore`, `comment` (ein ny kommentar), `shared` og `received` (når datasettet vart delt eller motteke i ein
pakke eller frå GitHub; endringsloggen i neste pakke byrjar etter den siste av dei). Handter viser radene som lesbar
tekst. Eksporten av oppskrifta i Bearbeid byggjer på `op`-radene, sjå [bearbeta.md](bearbeta.md).
