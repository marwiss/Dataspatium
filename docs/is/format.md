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
| KML og KMZ (Google Earth) | Já | Nei | Ein röð fyrir hvern stað með heiti, lýsingu, möppuslóð, tíma og viðbótargögnum sem dálkum; punktar, línur, marghyrningar og samsettar rúmfræðir verða GeoJSON |
| GPX (GPS-ferlar) | Já | Nei | Veldu lag: leiðarpunkta, leiðir, ferla (með fjölda punkta og lengd í km) eða ferilpunkta (ein röð fyrir hvern punkt með tíma og hæð) |
| TopoJSON | Já | Nei | Hver hlutur í grannfræðinni (topology) er lag; bogarnir eru afkóðaðir í venjulegar GeoJSON-rúmfræðir. Þekkist á innihaldinu þótt skráin heiti .json |
| JSON | Já | Já | Listi af hlutum, hlutur sem inniheldur lista (gefa má upp slóð), listi af listum |
| NDJSON, JSON Lines | Já | Nei | Einn hlutur í hverri línu |
| JSON-stat | Já | Nei | Greint sjálfkrafa (`class: dataset`); ein röð fyrir hvern reit með kóðum, textum og gildi |
| GeoJSON | Já | Já | Ein röð fyrir hvert feature; eiginleikarnir verða dálkar, rúmfræðin textadálkur með GeoJSON sem kortamyndritið teiknar (kortið les líka WKT-texta í dálki, til dæmis úr CSV). Við útflutning verður rúmfræðidálkurinn (GeoJSON eða WKT) rúmfræði hvers features og hinir dálkarnir eiginleikar þess |
| Shapefile (ZIP með shp, dbf, prj, cpg, eða aðeins shp) | Já | Nei | Eigindirnar verða dálkar með gerðum samkvæmt dbf-skemanu, rúmfræðin GeoJSON í dálkinum `geometry`. Veldu lag ef ZIP-skráin hefur fleiri en eitt, og einfaldaðu rúmfræðina með þoli í einingum kortsins. Hnitunum er haldið |
| XML | Já | Já | Ein röð fyrir hvert endurtekið stak (valið í innflutningsskrefinu); eigindir og undirstök verða dálkar, hreiðruð stök fá punktaheiti eins og `lage.lan` |
| SQLite | Já | Já | Eigin skrá Dataspatium er endurheimt með gerðum, merkimiðum og sögu; í öðrum gagnagrunnum velurðu töflu og gerðirnar eru teknar úr skemanu |
| SQL-skrifta (sql) | Já | Nei | Skrifta með `CREATE TABLE` og `INSERT`, til dæmis afrit úr gagnagrunni, er keyrð í tómum SQLite-gagnagrunni og töflurnar boðnar til vals. MySQL-sértækar línur (`SET`, `LOCK TABLES`, `USE`, `/*!…*/` og töfluvalkostir eins og `ENGINE=`) eru fjarlægðar fyrst; aðrar mállýskur virka að því marki sem þær fylgja málskipan SQLite |
| GeoPackage (gpkg) | Já | Nei | Lögin (feature- og eigindatöflur) eru valin sem töflur; rúmfræðidálkurinn verður GeoJSON sem kortamyndritið teiknar, hnitakerfið er sýnt |
| SPSS sav, zsav, por | Já | sav | Gegnum R-pakkann haven. Breytumerkimiðar verða dálkamerkimiðar, gildismerkimiðar verða texti |
| Stata dta | Já | dta | Gegnum haven. Við útflutning eru dálkaheitin stytt samkvæmt reglum Stata (32 stafir, ASCII) |
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

Með forritinu fylgja líka gögn sem bætt er við með hnappi í Sækja: sýnigögnin *Mannfjöldi eftir sveitarfélögum 2024 (Svíþjóð)*
og sænsk sveitarfélaga- og lénamörk SCB (*Digitala gränser*, CC0) sem GeoJSON í lengd og breidd, sjá `presets/geo/KALLA.md`.
Ekkert er sótt af netinu.

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

Hvert gagnasafn er SQLite-skrá með fjórum töflum: `data` (raðirnar), `_columns` (heiti, gerð, merkimiði, upprunalegt heiti,
lýsing og eining; tveimur síðustu er bætt við þegar eldri skrá er opnuð), `_meta` (heiti, stuttheiti, lýsing, tímastimplar,
uppruni, innflutningsstillingar) og `_log` (allt sem gert hefur verið við gagnasafnið). Skrána má opna í R með RSQLite, í DB
Browser for SQLite og í flestum öðrum verkfærum.

## Skrár vinnusvæðisins

Afritið (ZIP) og færanlega mappan (Edge og Chrome) hafa sömu uppbyggingu: `manifest.json` með lista yfir innihaldið,
`datasets/<id>.sqlite` fyrir hvert gagnasafn, `charts/<id>.viz.json` fyrir hvert vistað myndrit, `documents/<id>.doc.json` fyrir
hvert eigið skjalasnið, `dashboards/<id>.dash.json` fyrir hvert mælaborð og `notebooks/<id>.nb.json` fyrir hverja minnisbók og `scripts/<id>.script.json` fyrir hverja vistaða R-skriftu, SQL-skriftu eða regex-mynstur.
Pakki (*Deila pakka* undir Umsjón) hefur sömu uppbyggingu en inniheldur aðeins það sem þú valdir og hefur `kind: bundle` í
skráarlistanum; þegar honum er hlaðið inn er öllu sem þegar er til sleppt (gagnasöfnum með sama auðkenni og myndritum,
mælaborðum, sniðum og minnisbókum með sama heiti). Með sjálfvirka vistun á eru breytt gagnasöfn skrifuð í möppuna stuttu eftir
hverja vistun og skrár eyddra gagnasafna fjarlægðar. Möppunni má hlaða inn á annarri tölvu; gagnasöfnum sem þegar eru til
(sama auðkenni) og myndritum eða sniðum með sama heiti er sleppt.

Raðirnar í `_log` hafa tímastimpil, gerð aðgerðar og nánari upplýsingar sem JSON. Aðgerðagerðirnar eru meðal annars `import`,
`op` (skref í uppskrift með `op`, `params`, `result` og `description`; það eru þessar raðir sem mynda uppskriftina), `undo`,
`snapshot` og `restore`. Útflutningur uppskriftar í Vinna byggir á `op`-röðunum, sjá [bearbeta.md](bearbeta.md).
