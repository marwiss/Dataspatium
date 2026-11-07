# Snið og innflutningur

## Studd skráarsnið

| Snið | Innflutningur | Útflutningur | Athugasemd |
|---|---|---|---|
| CSV, TSV, TXT með aðgreinum | Já | Já | Aðgreinir, stafakóðun og fyrirsagnaröð eru greind sjálfkrafa og má breyta |
| Texti með fastri dálkbreidd | Já | Nei | Veldu sniðið í innflutningsskrefinu (skrár sem enda á .fwf eða .prn eru greindar). Upphaf dálka finnst út frá bilum sem eru í öllum línum, eða er gefið upp sem stöður |
| Excel xlsx, xlsm, xls, xlsb | Já | xlsx | Veldu blað; dagsetningar og já/nei verða raunverulegar gerðir |
| ODS og FODS (LibreOffice) | Já | ods | Sama meðferð gerða og í Excel |
| Eldri töflureiknissnið: Excel 2003 XML, SYLK (slk), DIF, dBase (dbf), Lotus 1-2-3 (wk1, wk3, wk4, wks), Quattro Pro (wq1, wq2, wb1, wb2, wb3, qpw) | Já | Nei | Lesin með sama töflureiknislesara og Excel; veldu blað. Excel 2003 XML þekkist á innihaldinu þótt skráin heiti .xml |
| Töflur í skjölum: HTML (html, htm, xhtml), Markdown (md), Word (docx), LaTeX (tex) | Já | Nei | Allar töflur skrárinnar birtast í lista með fyrirsögn eða myndatexta og fjölda raða og dálka. Sameinaðir reitir (colspan og rowspan, sameinaðir reitir í Word, `\multicolumn`) eru fylltir út í öllum röðum og dálkum sem þeir ná yfir. Fyrirsagnarlínan er tekin úr `th`, `thead`, aðgreiningarlínu Markdown, fyrirsagnarlínu Word eða `booktabs` (`\midrule`) |
| KML og KMZ (Google Earth) | Já | Já | Ein röð fyrir hvern stað með heiti, lýsingu, möppuslóð, tíma og viðbótargögnum sem dálkum; punktar, línur, marghyrningar og samsettar rúmfræðir verða GeoJSON |
| GPX (GPS-ferlar) | Já | Já | Veldu lag: leiðarpunkta, leiðir, ferla (með fjölda punkta og lengd í km) eða ferilpunkta (ein röð fyrir hvern punkt með tíma og hæð) |
| TopoJSON | Já | Nei | Hver hlutur í grannfræðinni (topology) er lag; bogarnir eru afkóðaðir í venjulegar GeoJSON-rúmfræðir. Þekkist á innihaldinu þótt skráin heiti .json |
| JSON | Já | Já | Listi af hlutum, hlutur sem inniheldur lista (gefa má upp slóð), listi af listum |
| NDJSON, JSON Lines | Já | Nei | Einn hlutur í hverri línu |
| JSON-stat | Já | Nei | Greint sjálfkrafa (`class: dataset`); ein röð fyrir hvern reit með kóðum, textum og gildi |
| SDMX-JSON | Já | Nei | Gagnaskeyti í SDMX-JSON 1.0 og 2.0 (til dæmis frá Seðlabanka Evrópu og OECD) eru greind sjálfkrafa; ein röð fyrir hverja athugun með kóða- og textadálki fyrir hverja vídd, tímabili, gildi og eigindum |
| GeoJSON | Já | Já | Ein röð fyrir hvert feature; eiginleikarnir verða dálkar, rúmfræðin textadálkur með GeoJSON sem kortamyndritið teiknar (kortið les líka WKT-texta í dálki, til dæmis úr CSV). Við útflutning verður rúmfræðidálkurinn (GeoJSON eða WKT) rúmfræði hvers features og hinir dálkarnir eiginleikar þess |
| Shapefile (ZIP með shp, dbf, prj, cpg, eða aðeins shp) | Já | Nei | Eigindirnar verða dálkar með gerðum samkvæmt dbf-skemanu, rúmfræðin GeoJSON í dálkinum `geometry`. Veldu lag ef ZIP-skráin hefur fleiri en eitt, og einfaldaðu rúmfræðina með þoli í einingum kortsins. Hnitunum er haldið |
| XML | Já | Já | Ein röð fyrir hvert endurtekið stak (valið í innflutningsskrefinu); eigindir og undirstök verða dálkar, hreiðruð stök fá punktaheiti eins og `lage.lan` |
| SQLite | Já | Já | Eigin skrá Dataspatium er endurheimt með gerðum, merkimiðum og sögu; í öðrum gagnagrunnum velurðu töflu og gerðirnar eru teknar úr skemanu |
| SQL-skrifta (sql) | Já | Nei | Skrifta með `CREATE TABLE` og `INSERT`, til dæmis afrit úr gagnagrunni, er keyrð í tómum SQLite-gagnagrunni og töflurnar boðnar til vals. MySQL-sértækar línur (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` og töfluvalkostir eins og `ENGINE=`) eru fjarlægðar fyrst; aðrar mállýskur virka að því marki sem þær fylgja málskipan SQLite |
| GeoPackage (gpkg) | Já | Já | Lögin (feature- og eigindatöflur) eru valin sem töflur; rúmfræðidálkurinn verður GeoJSON sem kortamyndritið teiknar, hnitakerfið er sýnt |
| Access (mdb, accdb) | Já | Nei | Lesið beint í vafranum með mdb-reader; taflan er valin í skrefinu Stillingar og gerðirnar koma úr Access. Fyrirspurnir, tengdar töflur og lykilorð krefjast [gagnagrunnsbrúarinnar](kallor.md). |
| Skjöl: PDF, Word (docx), OpenDocument (odt), Markdown (md), texti (txt) | Já | Nei | Verður skjalasafn með einni málsgrein í hverri röð (skjal, síða, málsgrein, tegund, texti, stafir); margar skrár í einu verða eitt safn og frumritin fylgja með. Sjá [dokument.md](dokument.md) |
| Myndir: JPEG, PNG, WebP, GIF, BMP, AVIF | Já | Nei | Verður myndasafn með einni röð fyrir hverja mynd (stærð, mál, dagsetning, myndavél og staðsetning úr EXIF); forskoðun og smámynd eru vistaðar, ekki frumritin. Sjá [dokument.md](dokument.md) |
| BCF (bcf, bcfzip) | Já | Já | BCF-XML 3.0. Málin verða tafla, athugasemdir og viewpoint-íhlutir töflur við hliðina; skyndimyndir fylgja ekki með inn. Útflutningur mála verkefnis úr spjaldinu Mál í líkansýninni |
| QGIS-verkefni (qgs, qgz) | Já | Nei | Verður kortasýn í Myndgera með lagaröð, sýnileika og táknum verkefnisins (litir, línubreiddir, punktastærðir); lögin eru pöruð við gagnasöfn með sama skráarheiti og meðfylgjandi gagnaskrár eru fluttar inn. Sjá [kartor.md](kartor.md) |
| SPSS sav, zsav, por | Já | sav | Gegnum R-pakkann haven. Breytumerkimiðar verða dálkamerkimiðar og gildismerkimiðar lýsigögn dálksins (sjá neðar) |
| Stata dta | Já | dta | Gegnum haven. Gildismerkimiðar eins og fyrir SPSS. Við útflutning eru dálkaheitin stytt samkvæmt reglum Stata (32 stafir, ASCII) |
| SAS sas7bdat, xpt | Já | Nei | Gegnum haven |
| PX (PC-Axis, notað af norrænu hagstofunum) | Já | Nei | Gegnum R-pakkann pxR; stafakóðunin er lesin úr CODEPAGE eða CHARSET skrárinnar. Niðurstaðan er löng tafla með einum gildisdálki |
| Parquet | Já | Já | Gegnum R-pakkann nanoparquet; heldur gerðum nákvæmlega |
| RDS, RData | Já | rds | R-hlutir; RData-skrá þarf að innihalda data.frame |
| Límdur texti | Já | | Aðgreindur með dálkstöfum, semikommum eða kommum |

Aðgreindar textaskrár sem eru 64 MB eða stærri eru lesnar í bútum: forskoðunin sýnir fyrstu raðirnar eins og venjulega, og við
innflutning eru raðirnar skrifaðar í gagnasafnið meðan skráin er lesin, svo allur textinn þurfi aldrei að vera í minni.
Dálkgerðirnar eru teknar úr dálkaskrefinu eða giskað á þær út frá fyrsta bútnum. Framvindan sést sem fjöldi lesinna raða.

Öll skráarsnið má líka sækja af vefslóð undir *Af vefslóð* í Sækja, ef þjónninn leyfir beiðnir frá vafranum (CORS). Eigin
uppsetningarskrár Dataspatium (API-uppruni, myndrit, mælaborð, skjalasnið, minnisbók) eru greindar á reitnum `format` og þeim er
bætt við beint.

Sniðin sem fara gegnum R ræsa R-setuna þegar þörf krefur (nokkrar sekúndur í fyrsta skipti) og hafa enga forskoðun: R les
skrána og afhendir hana með `dm_write()`, svo dálkgerðirnar koma frá R. Já/nei verður 0/1 í SPSS og Stata, sem hafa ekki
rökgerð.

Gildismerkimiðar (kóðar með heitum, eins og `1 = Karl` og `2 = Kona`) fylgja dálkinum sem lýsigögn í SQLite-skránni
(`_columns.value_labels`). Við innflutning SPSS, Stata og SAS velur þú í stillingaskrefinu hvort dálkurinn sýni merkimiðana
sem texta (sjálfgefið) eða haldi kóðunum; merkimiðarnir eru vistaðir í báðum tilvikum. Þá má stilla, breyta og skipta út
fyrir kóðana í Vinna, þeir birtast í kóðabókinni, ná til R sem `haven::labelled` og eru skrifaðir í .sav og .dta, þar sem
dálkur með merkimiðunum sem texta fær kóðana sína aftur.

Með forritinu fylgja líka gögn sem bætt er við í Sækja: sýnigögnin *Mannfjöldi eftir sveitarfélögum 2024 (Svíþjóð)* og mörk
fyrir kort sem GeoJSON í lengd og breidd: sveitarfélög og lén í Svíþjóð (SCB, CC0), sveitarfélög og svæði í Danmörku (DAGI),
sveitarfélög og fylki í Noregi (Kartverket, CC BY 4.0) og sveitarfélög og héruð í Finnlandi (Hagstofa Finnlands, CC BY 4.0).
Heimildir og leyfi eru í `presets/geo/KALLA.md`. Ekkert er sótt af netinu.

**Stafrænt skipulag** (tegundin skipulag): sænskt deiliskipulag samkvæmt landsforskrift Lantmäteriet (GeoJSON,
`feature:typ`), tilvísunarfitjur af landsvettvangi landupplýsinga, aðalskipulag samkvæmt prófunarútgáfu forskriftarinnar
(GeoJSON) og ÖP-líkan Boverket (GeoPackage með `innehall_op_*`). Þekkist á innihaldinu og opnast sem skipulagskort; sjá
[planer.md](planer.md).

**Norrænt skipulag** (tegundin skipulag): Plandata.dk-GeoJSON (staðbundið skipulag, undirsvæði, byggingarreitir, rammar
sveitarfélagsskipulags), finnska skipulagsgagnalíkanið (Ryhti-JSON), stafrænt skipulag Skipulagsstofnunar (GeoJSON eða
GeoPackage-sniðmátið) og norskt reguleringsplan/kommuneplan sem GeoPackage (Rp-/Kp-töflur). Þekkist á innihaldinu;
GeoPackage-skrár fá valið *Allt skipulagið sem skipulag*. Sjá [planer.md](planer.md).

**Net** (tegundin net): GraphML, GEXF, JSON með hnútum og leggjum (D3, networkx, Cytoscape, Neo4j) og Cypher-skriftur
(APOC-útflutningur). Lesið og skrifað; þekkist á innihaldinu. Sjá [grafer.md](grafer.md).

**Byggingarlíkön og teikningar** (tegundin líkan): IFC (`.ifc`, `.ifczip`; IFC2X3, IFC4, IFC4X3) og DXF. Upprunalega skráin er
vistuð; byggingarhlutar, eiginleikar og magn verða að töflum og DXF-teikningin að SVG. Sjá [cad-bim.md](cad-bim.md).

## Stafakóðun

Textaskrár eru athugaðar í þessari röð: bætaröðunarmerki (UTF-8, UTF-16), UTF-16 án BOM (mörg núllbæti), hreint ASCII, ströng
UTF-8-sannprófun á fyrsta megabætinu, annars Windows-1252. Windows-1252 er algengt fyrir skrár sem vistaðar voru úr eldri
norrænum útgáfum af Excel. Þú getur alltaf skipt um kóðun í innflutningsskrefinu.

## Aðgreinar og tugabrotstákn

Giskað er á aðgreininn meðal semikommu, kommu, dálkstafs og lóðstriks. Norrænar CSV-skrár nota oftast semikommu þar sem komma er
tugabrotstákn. Tugabrotstáknið er ákveðið fyrir hvern dálk: ef tugakommur eru að minnsta kosti jafn algengar og tugapunktar er
komma valin. Þúsundaskil (bil, óbrjótanlegt bil, punktur með tugakommu) eru fjarlægð.

## Dálkgerðir

| Gerð | Greint sem | Geymt sem |
|---|---|---|
| Texti | Allt sem passar ekki við annað, og allar tölur með núlli fremst (sveitarfélagakóðar, póstnúmer, kennitölur) | TEXT |
| Heiltala | `12`, `-3`, `1 234` | INTEGER |
| Tugabrot | `1 234,5`, `1.5`, `2,0`, `1.5e3` | REAL |
| Dagsetning | `2024-01-31`, `31/12/2024`, `31.12.2024`, `31-12-2024` | TEXT, ISO 8601 `ÁÁÁÁ-MM-DD` |
| Dagsetning og tími | `2024-01-31 10:05`, `2024-01-31T10:05:00Z`, Excel-dagsetningar með tíma | TEXT, `ÁÁÁÁ-MM-DD KK:MM:SS` |
| Já/nei | `ja`, `nej`, `true`, `false`, `yes`, `no`, `sant`, `falskt`, `j`, `n` | INTEGER 0/1 |

Dálkur fær aðeins gerð ef öll útfyllt gildi í úrtakinu passa. Tóm gildi verða alltaf „tómt“ (NULL). Gildi sem ekki er hægt að
túlka með gerðinni sem þú velur handvirkt verða líka tóm.

## Skrá gagnasafnsins

Hvert gagnasafn er SQLite-skrá með töflunum `data` (raðirnar), `_columns` (heiti, gerð, merkimiði, upprunalegt heiti,
lýsing, eining og gildismerkimiðar; þremur síðustu er bætt við þegar eldri skrá er opnuð), `_meta` (heiti, stuttheiti,
lýsing, tímastimplar, uppruni, innflutningsstillingar), `_log` (allt sem gert hefur verið við gagnasafnið) og, þegar
einhver hefur gert athugasemd, `_comments` (tími, nafn, texti, dálkur og hvort athugasemdin er leyst). Skrána má opna í R
með RSQLite, í DB Browser for SQLite og í flestum öðrum verkfærum.

## Skrár vinnusvæðisins

Afritið (ZIP), færanlega mappan (Edge og Chrome) og mappan í GitHub-safni hafa sömu uppbyggingu: `manifest.json` með
lista yfir innihaldið, `datasets/<id>.sqlite` fyrir hvert gagnasafn, `charts/<id>.viz.json` fyrir hvert vistað myndrit,
`documents/<id>.doc.json` fyrir hvert eigið skjalasnið, `dashboards/<id>.dash.json` fyrir hvert mælaborð,
`notebooks/<id>.nb.json` fyrir hverja minnisbók og `scripts/<id>.script.json` fyrir hverja vistaða R-skriftu, SQL-skriftu
eða regex-mynstur. Pakki (*Pakki* í hamnum Deila) hefur sömu uppbyggingu en inniheldur aðeins það sem þú valdir.
Skráarlisti hans hefur `kind: bundle`, nafn sendanda (`author`), skilaboðin (`message`) og breytingarnar á hverju
gagnasafni síðan því var síðast deilt eða það móttekið (`changes`), og pakkinn hefur auk þess `CHANGELOG.md` með því sama
og óleystum athugasemdum á læsilegu formi. Þegar pakka er hlaðið inn birtast skilaboðin og breytingarnar, og öllu sem
þegar er til er sleppt (gagnasöfnum með sama auðkenni og myndritum, mælaborðum, sniðum og minnisbókum með sama heiti),
nema þeim gagnasöfnum sem þú velur að skipta út fyrir útgáfu pakkans; þín útgáfa er þá vistuð undir *Útgáfur*. Með
sjálfvirka vistun á eru breytt gagnasöfn skrifuð í færanlegu möppuna stuttu eftir hverja vistun og skrár eyddra
gagnasafna fjarlægðar. Möppunni má hlaða inn á annarri tölvu á sama hátt og pakka.

Skráarlistinn hefur `format: 2` síðan útgáfu 2.0: hvert gagnasafn í listanum hefur auk `id`, `name` og `shortName`
einnig `folder` (möppuna, eins og `Fjármál/2026`, eða tómt) og `tags` (lista). Eldri pakkar og afrit (án `format`)
eru lesin eins og áður. Mappa og merki eru líka í eigin skrá gagnasafnsins (`_meta`), svo þau fylgja hvert sem skráin
fer, eins og `kind` (`table`, `graph`, `document`, `images`, `model`).

Raðirnar í `_log` hafa tímastimpil, gerð aðgerðar og nánari upplýsingar sem JSON. Aðgerðagerðirnar eru meðal annars
`import`, `op` (skref í uppskrift með `op`, `params`, `result` og `description`; það eru þessar raðir sem mynda
uppskriftina), `undo`, `snapshot`, `restore`, `comment` (ný athugasemd), `shared` og `received` (þegar gagnasafninu var
deilt eða það móttekið í pakka eða frá GitHub; breytingaskrá næsta pakka hefst á eftir því síðasta af þeim). Umsjón sýnir
raðirnar sem læsilegan texta. Útflutningur uppskriftar í Vinna byggir á `op`-röðunum, sjá [bearbeta.md](bearbeta.md).
