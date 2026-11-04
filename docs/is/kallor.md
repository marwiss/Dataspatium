# Uppsprettur: gagnagrunnar, brúin og tengdar skrár

Auk skráa, límds texta, vefslóða og forstilltu opnu vefþjónustanna (sjá [api-konfiguration.md](api-konfiguration.md))
getur Dataspatium sótt gögn úr gagnagrunnum á þrjá vegu: **Access-skrár** eru lesnar beint í vafranum,
**gagnagrunnar á eigin tölvu eða í netinu** nást í gegnum litla staðbundna brú, og **gagnagrunnsþjónustur um HTTP**
(PostgREST, OData, GraphQL og fleiri) verða venjulegar uppsprettur í Sækja. Skrár sem valdar eru með skráaveljara
tölvunnar má auk þess **tengja**, svo gagnasafnið sé lesið aftur af diski með einum smelli. Allt gerist í
vafranum; ekkert er sent annað en til gagnagrunnsins sem þú tilgreinir sjálf.

## Access-skrár (mdb, accdb)

Slepptu skránni á flötinn í Sækja eins og hverri annarri skrá. mdb-reader les hana beint í vafranum án þess að
Access þurfi að vera á tölvunni: töflurnar eru taldar upp í skrefinu *Stillingar*, þú velur eina og færð dálkana
með gerðunum sem Access tilgreinir (texti, tölur, dagsetningar, já/nei). Fyrirspurnir, tengdar töflur og skrár
varðar með lykilorði er ekki hægt að lesa svona; notaðu þá brúna hér að neðan. dBase-skrár (.dbf) eru lesnar með
töflureiknisinnflutningnum.

## Gagnagrunnsbrúin

Brúin er lítil skrifta sem þú ræsir á tölvunni þegar þörf er á, í sama anda og staðbundinn vefþjónn. Hún hlustar
aðeins á eigin tölvu (127.0.0.1), krefst tákns sem birtist í glugganum og er skrifvarin nema þú ræsir hana með
skrif leyfð. Forritið sækir töflur í gegnum brúna; ekkert fer af tölvunni.

### Ræsa brúna

- **Windows**: opnaðu PowerShell í möppu forritsins og keyrðu `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  Brúin talar ODBC, OLE DB og SqlClient og nær þannig til Access (mdb og accdb um Microsoft ACE), Excel, SQL
  Server (líka LocalDB og Express), Oracle, PostgreSQL, MySQL/MariaDB, Paradox, dBase og allra ODBC-gagnalinda
  (DSN) á tölvunni. Engin stjórnandaréttindi þarf.
- **macOS og Linux** (og Windows án PowerShell): `python tools/db_bridge.py` (Python 3, staðalsafnið).
  SQLite-skrár virka alltaf; með `pyodbc` uppsett (`pip install pyodbc`) líka ODBC-uppsprettur.

Glugginn sýnir vistfangið (`http://127.0.0.1:<port>/`) og táknið. Valkostir: `-Port` eða `--port` velur port,
`-AllowWrite` eða `--allow-write` leyfir breytingar, `-MaxRows` eða `--max-rows` takmarkar fjölda raða í hverri
sókn (sjálfgefið 100 000) og `-AllowOrigins` eða `--allow-origin` tilgreinir hvaða vistföng forritsins mega kalla
á brúna. Síða opnuð úr möppu hefur upprunann `null`, sem er leyfður, eins og `localhost` og vistfang forritsins á
GitHub Pages. Lokaðu glugganum, eða ýttu á Ctrl+C, til að stöðva.

### Nota brúna í forritinu

1. Veldu *Gagnagrunnur um brúna* undir *Gagnagrunnar* í Sækja, límdu inn vistfangið og táknið og ýttu á
   **Tengjast**. Táknið gildir fyrir setuna; *Vista dulkóðað* geymir það með sömu lykilsetningu og API-lyklana.
2. Lýstu uppsprettunni: Access- eða Excel-skrá (slóð á tölvunni), SQL Server (þjónn, gagnagrunnur og notandi eða
   Windows-innskráning), ODBC-gagnalind (veldu úr DSN tölvunnar) eða tengistrengur. Ýttu á **Sækja töflur**.
3. Veldu töflu, skoðaðu fyrstu hundrað raðirnar og ýttu á **Flytja inn**. Dálkagerðirnar koma úr gagnagrunninum.
4. **Eigin SQL** keyrir fyrirspurn á mállýsku gagnagrunnsins og flytur niðurstöðuna inn. SELECT birtist beint;
   aðrar setningar krefjast þess að brúin hafi verið ræst með skrif leyfð og eru samþykktar ein í einu í glugga sem
   sýnir setninguna.

Innflutt gagnasöfn muna uppsprettuna: *Uppfæra* í Umsjón, eða *Vistaðar sóknir* í Sækja, sækir töfluna eða
fyrirspurnina aftur og endurspilar uppskriftina. Lykilorð eru aldrei vistuð með gagnasafninu; eftir endurræsingu
biður forritið þig um að opna uppsprettuna aftur áður en uppfært er. SQL-flipinn í Greina getur keyrt beint á
uppsprettuna sem síðast var opnuð í brúnni (*Keyra á*).

### Öryggi

- Brúin svarar aðeins á 127.0.0.1, krefst tákns í hverju kalli og leyfir CORS aðeins fyrir eigin vistföng forritsins.
- Skrifvarin sjálfgefið: aðeins SELECT kemst í gegn. Með skrif leyfð þarf samt samþykki þitt fyrir hverja setningu;
  brúin svarar 428 þar til forritið sendir samþykkið.
- Brúin skráir nýjustu köllin (`GET /log`) og stöðvast þegar glugganum er lokað.
- Tákn og lykilorð eru aðeins geymd í setunni eða dulkóðuð með lykilsetningu, aldrei í hreinum texta og aldrei í
  deildum stillingum.

### Bilanaleit

- *Provider cannot be found*: settu upp Microsoft Access Database Engine (ACE) í 64-bita útgáfu, eða notaðu
  ODBC-DSN með 64-bita rekli. Brúin er 64-bita þegar PowerShell er það.
- *Rangt eða vantar tákn*: afritaðu táknið aftur úr glugga brúarinnar; það breytist við hverja ræsingu nema þú
  gefir upp `-Token`.
- *Brúin svarar ekki*: athugaðu að glugginn sé opinn og vistfangið rétt; prófaðu annað port.
- Keyrslustefna: skriftan er ræst með `-ExecutionPolicy Bypass`, rétt eins og prófunartól forritsins, svo engum
  stillingum þarf að breyta.
- Tölvudeild getur farið yfir skriftuna (`tools/db-bridge.ps1`, um 200 línur) og ræst hana með föstu porti og tákni.

## Gagnagrunnsuppsprettur um HTTP

Hnappurinn **Bæta við gagnagrunnsuppsprettu** undir *Gagnagrunnar* í Sækja býr til venjulega API-uppsprettu úr
vistfangi og lykli. Forritið spyr þjónustuna um töflur hennar (skemauppgötvun) og bætir við einum endapunkti fyrir
hverja töflu auk almenns endapunkts þar sem þú gefur upp töfluna sjálf. Uppsprettan virkar síðan eins og forstilltu
vefþjónusturnar: stikur, forskoðun, síður sem er fylgt sjálfkrafa og vistaðar sóknir sem eru uppfærðar með einum smelli.

| Fjölskylda | Auðkenning | Uppgötvun | Sókn | CORS |
|---|---|---|---|---|
| PostgREST / Supabase | `apikey`-haus (valfrjálst) | OpenAPI-rótin | `select`, `order`, síur í línum; síður með `limit`/`offset` | Leyft sjálfgefið |
| OData v4 | Basic (valfrjálst) | Þjónustuskjalið | `$select`, `$filter`, `$orderby`, `$top`; `@odata.nextLink` fylgt | Fer eftir þjónustunni |
| GraphQL | Bearer (valfrjálst) | Engin | Þú skrifar fyrirspurnina; fyrsti listinn undir `data` verður taflan | Fer eftir þjóninum |
| CouchDB | Basic (valfrjálst) | `_all_dbs` | `_all_docs` með skjölunum; `skip`/`limit` | Kveikt á í CouchDB |
| ClickHouse | Basic (valfrjálst) | `SHOW TABLES` | SQL fyrir hverja töflu með `FORMAT JSON`; `add_http_cors_header=1` sent | Um stillinguna |
| Elasticsearch / OpenSearch | API-lykill (valfrjálst) | `_cat/indices` | `_search` með `q`; `from`/`size`, mest 10 000 niðurstöður | `http.cors.*` |
| SPARQL | Engin | Engin | Fyrirspurnin sem stika; breyturnar verða dálkar | Opinberir endapunktar leyfa |
| InfluxDB v2 | Tákn | Fötur | Flux-fyrirspurn; CSV með athugasemdum | Athugaðu þjóninn |
| Google Sheets | Engin | Engin | Birtur eða tengladeildur töflureiknir sem CSV | Google |
| Airtable | Persónulegt tákn | Lýsigagna-API | Færslur með `offset`; reitirnir verða dálkar | Leyft |

CORS þýðir að þjónn gagnagrunnsins verður að leyfa köll úr vafranum. Síða opnuð úr möppu sendir upprunann `null`;
í þjónsham vistfang forritsins. Hvernig kveikt er á því stendur í skjölun hverrar þjónustu (tengill í glugganum).
Sé ekki hægt að breyta þjóninum standa eftir milliþjónsstillingin (sjá [api-konfiguration.md](api-konfiguration.md))
eða brúin um ODBC.

Lyklar og lykilorð haldast í setunni eða eru vistuð dulkóðuð; stillinguna sem verður til má flytja út og deila án
þeirra. Svarsniðunum `graphql`, `sparql` og `influx-csv` ásamt `lift` (lyfta hreiðruðum hlut upp í dálka) er lýst í
[api-konfiguration.md](api-konfiguration.md) og má nota í eigin stillingum.

## Opin landupplýsingagögn

Glugginn *Bæta við landupplýsingauppsprettu* hefst á lista yfir **tilbúnar landupplýsingauppsprettur**: opnar WFS-,
OGC API Features- og ArcGIS-þjónustur frá norrænum stofnunum og sveitarfélögum (SCB, SGU, Naturvårdsverket,
Riksantikvarieämbetet, Skogsstyrelsen, Kartverket, Miljødirektoratet, Riksantikvaren, Hagstofa Finnlands, SYKE,
Helsinki, Väylävirasto, Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands og fleiri), allar
staðfestar til að virka úr vafranum. Forstillt uppspretta opnast, öðrum er bætt við með einum smelli og lögin lesin úr
þjónustunni; síaðu eftir heiti, landi eða innihaldi. Listinn er í `presets/geodata/services.json`. Undir listanum eru

Þrjár uppsprettur sækja skipulag: *Plandata.dk (WFS)* og *Skipulagsgögn Skipulagsstofnunar (ArcGIS)* hafa hnappinn
**Sækja skipulag**, sem les heilt staðbundið skipulag eða deiliskipulag (öll lög) með skipulagsnúmeri og vistar það sem
skipulag, og *Ryhti kaavatiedot (OGC API Features)* gefur skipulagsskrá Finnlands. Sjá [planer.md](planer.md#skipulag-frá-öðrum-norðurlöndum).
reitirnir fyrir eigin þjónustu. Planbestämmelsekatalog Boverket er venjuleg API-uppspretta (*Boverket
Planbestämmelsekatalogen*), sjá [planer.md](planer.md).

Hnappurinn **Bæta við landupplýsingauppsprettu** undir *Gagnagrunnar* í Safna gerir venjulega API-uppsprettu úr vistfangi
landupplýsingaþjónustu, á sama hátt sem gagnagrunnsuppspretturnar. Forritið les lög þjónustunnar og setur einn endapunkt á
hvert lag auk almenns þar sem þú tilgreinir lagið sjálf. Svörin eru GeoJSON í WGS 84: gagnasafnið fær rúmfræðidálk og
opnast sem kort í Vinna (sjá [kartor.md](kartor.md)). Uppsprettan sýnir lögin sem lista sem hægt er að sía; veldu lag,
takmarkaðu gjarnan við svæði (bbox) og sæktu. Forskoðunin sýnir svarið sem lítið kort ofan við töfluna, og *Opna sem kort*
fer með þig í vistaða gagnasafnið.

| Fjölskylda | Uppgötvun | Sókn | Lykill |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, Deegree) | GetCapabilities | GetFeature með `outputFormat=application/json` og `srsName=EPSG:4326`; svæði (bbox), CQL-sía, dálkar; síður með `startIndex`/`count` | Bearer (valfrjálst) |
| OGC API Features | `/collections` | `/collections/{id}/items` með bbox, datetime og filter; next-tenglum fylgt | Bearer (valfrjálst; krafist af landupplýsingavettvangi Lantmäteriet) |
| ArcGIS REST (FeatureServer, MapServer) | Lýsing þjónustunnar eða öll skráin | `/{lag}/query` með where, svæði, `f=geojson` og `outSR=4326`; síður með `resultOffset` | Token (valfrjálst) |

Forstilltar landupplýsingauppsprettur án lykils (CORS staðfest): opin landupplýsingagögn SCB, SGU, Havs- och
vattenmyndigheten, fornminjar Riksantikvarieämbetet, Skogsstyrelsen, stjórnsýslueiningar og fasteignakort Kartverket
(Noregur) auk Hagstofu Finnlands og SYKE (Finnland). Lögin eru lesin úr þjónustunni þegar uppsprettan er opnuð í fyrsta
sinn og má lesa aftur með *Lesa lögin aftur*; listinn er vistaður í þínu eintaki af uppsprettunni. Landupplýsingavettvangur
Lantmäteriet (deiliskipulag) er á stigi 2 með Bearer-lykli frá tengdri stofnun.

**Geodataportalen** (geodata.se) er sænska landsskráin yfir landupplýsingar stofnana, landshluta og sveitarfélaga.
Uppsprettan *Geodataportalen (sök geodata)* leitar í skránni og sýnir eina færslu á hverja niðurstöðu með titli, stofnun,
lýsingu og þjónustum: WFS-, OGC API- eða ArcGIS-þjónustu er bætt við sem landupplýsingauppsprettu með einum smelli og
opnuð strax, WMS-vistfang er afritað til notkunar sem bakgrunnskort eða WMS-lag í kortasýn, og niðurhalsskrár og
lýsigögn opnast í nýjum flipa. Niðurstöðulistann má einnig sækja sem töflu undir flipanum *Endapunktar*.

Landupplýsingaþjónustur svara oft með mörgum fitjum: takmarkaðu við svæði eða síu og hækkaðu *Hámarksfjölda síðna* undir
*Fleiri valkostir* aðeins þegar þörf er á. Eigin þjónusta þarf að leyfa köll úr vafranum (CORS) eins og
gagnagrunnsuppspretturnar; GeoServer og ArcGIS Server flestra stofnana gera það.
## Tengdar skrár

Í Chrome og Edge er hnappurinn **Tengja skrá á tölvunni** í Sækja. Skráin er valin með skráaveljara tölvunnar og
flutt inn eins og venjulega, en gagnasafnið heldur tengli við skrána: **Uppfæra af diski** í Umsjón les skrána
aftur með sömu stillingum, skiptir út röðunum og endurspilar uppskriftina (hreinsanir, nýir dálkar og tengingar
eru gerðar aftur). Vafrinn getur beðið um leyfi til að lesa skrána aftur eftir endurræsingu. Firefox hefur ekki
þennan eiginleika; þar flytur þú skrána inn að nýju. Snið sem eru lesin um R (SPSS, Stata, SAS, PX, RDS, Parquet)
er ekki hægt að tengja.

## WebSocket

Forritið hefur tengiaðferð fyrir WebSocket (samþykki eftir tilgangi, JSON-rammar, fyrirspurn og svar pöruð á
auðkenni). Hana nota komandi uppsprettur eins og Neo4j (Bolt um WebSocket, áætlað í 2.9) og streymandi
vefþjónustur; engar forstillingar nota hana enn.

## Takmarkanir

- Brúin keyrir á tölvunni þar sem forritið er notað; fjartengdir gagnagrunnar nást um rekla eða DSN á þeirri tölvu.
- Mest 100 000 raðir í hverri sókn um brúna nema `-MaxRows` sé hækkað; stórar töflur eru best afmarkaðar með SQL.
- Access-skrár í vafranum: engar fyrirspurnir, tengdar töflur eða lykilorð; mjög stórar skrár taka minni.
- Elasticsearch skilar mest 10 000 niðurstöðum í hverri leit (`from` + `size`).
- Allar HTTP-uppsprettur krefjast CORS; það verður ekki sniðgengið úr vafranum.
