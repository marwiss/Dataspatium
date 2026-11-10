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

Valið **Gagnagrunnsuppspretta** undir *Bæta við uppsprettum* í Sækja býr til venjulega API-uppsprettu úr
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

### Neo4j yfir Bolt

Valið **Neo4j** undir *Bæta við uppsprettum* (fjölskyldan **Neo4j (Bolt)**, sem er einnig í *Gagnagrunnsuppspretta*) tengist Neo4j Aura eða eigin þjóni með rekli Neo4j yfir
WebSocket (`neo4j+s://…`, gagnagrunnur, notandanafn og lykilorð; lykilorðið er aldrei vistað í hreinum texta).
Uppsprettan opnar Cypher-ritil: niðurstaðan verður tafla, eða netgagnasafn þegar svarið inniheldur hnúta og vensl;
fyrirspurnir má vista á uppsprettunni. Tengingin krefst samþykkis (tilgangurinn Neo4j) og fellur ekki undir CORS; eigin
þjónn án TLS (`bolt://`) næst aðeins frá síðu yfir http://. Sjá [grafer.md](grafer.md#neo4j-sem-uppspretta).

### OpenCDE-þjónn (BCF og Documents API)

Valið **OpenCDE** undir *Bæta við uppsprettum* (fjölskyldan **OpenCDE (BCF, Documents)**, sem er einnig í *Gagnagrunnsuppspretta*) tengist þjóni sem fylgir OpenCDE-skilum
buildingSMART, til dæmis [Dataregium](https://github.com/marwiss/Dataregium). Sláðu inn vistfang þjónsins. Skildu biðlaraauðkennið eftir autt þegar þjónninn leyfir forritinu að skrá sig sjálft (sjá neðar), annars
biðlaraauðkennið sem stjórnandi þjónsins skráði fyrir Dataspatium (opinber biðlari með endurbeiningarvistfangið
`http://127.0.0.1:8080/oauth-callback.html` eða samsvarandi fyrir vistfangið sem forritið er þjónað frá). Uppsprettan
opnar sýn þar sem þú skráir þig inn á þjóninn (OAuth2 með PKCE í sprettiglugga; frá file:// límir þú inn vistfangið sem
þú lendir á eftir innskráningu), velur verkefni og sækir mál, athugasemdir, sjónarhornseiningar (ein IFC-eining á röð),
atburði og skrár sem töflur. *Sækja skjöl* opnar skjalavalssíðu þjónsins sjálfs (Documents API); völdu skrárnar eru
sóttar og fluttar inn eins og þeim hefði verið sleppt í forritið, svo IFC-líkan verður líkansgagnasafn. Aðgangstókar eru
aðeins í setunni og eru aldrei fluttir út með uppsprettunni. Tengingin krefst samþykkis (tilgangurinn OpenCDE-þjónn) og
þjóns sem leyfir köll úr vafranum (CORS).

Forritið talar BCF API 3.0 og 2.1. Það velur nýjustu útgáfuna sem þjónninn býður, og þjónn með aðeins 2.1 virkar líka: slíkan þjón vantar oft Foundation API og
Documents API, svo forritið les útgáfuna úr `/bcf/versions` og innskráningarvistföngin úr `/bcf/2.1/auth` og sleppir *Sækja skjöl*. Undir *Fleiri valkostir* í glugganum
geturðu valið útgáfu sjálfur, og ef þjónninn býður fleiri geturðu skipt í sýn uppsprettunnar. Í 2.1 listar *Skrár í verkefninu* aðeins BCF-skjölin, mál hafa ekki
raðnúmer þjónsins og ekki er hægt að eyða sjónarhorni. Á móti getur athugasemd verið svar við annarri: hnappurinn *Svara* í spjaldinu *Mál*.

Spjaldið *Meðlimir verkefnisins* birtist þegar þjónninn hefur verkefnastjórnun (viðbót Dataregium). Ábyrgðarmaður verkefnis
(manager), sem þarf ekki að vera stjórnandi þjónsins, skráir sig inn með *Skrá inn sem ábyrgðarmaður verkefnis* og sér verkefni sín og
meðlimi þeirra með hlutverkum: lesandi, þátttakandi, ritstjóri eða ábyrgðarmaður. Þú bætir við manneskju með nákvæmu notandanafni
hennar á þjóninum, breytir hlutverki, fjarlægir meðlim og endurnefnir verkefnið; hver breyting er staðfest fyrst. Þjónninn leyfir ekki
að verkefnið sé án ábyrgðarmanns og segir frá því; verkefnum er ekki eytt héðan, og stjórnandi stofnar nýja aðganga.

Mál eru sótt í síðum með 500. Listi sem þjónninn hefur stytt (Dataregium styttir við 1.000 færslur) er lesinn til enda með
Link-haus þjónsins með rel="next", en aðeins á sama þjóni, svo að táknið þitt fer aldrei annað.

Spjaldið *IFC-LPG* birtist þegar þjónninn hefur net, sjá [grafer.md](grafer.md#ifc-lpg-á-dataregium-þjóni).

Undir *Skrár í verkefninu* telur gagnalindin upp líkönin og skjölin sem þjónninn hefur fyrir verkefnið. *Sækja* býr til
gagnasafn af tegund skrárinnar, svo IFC-skrá verður líkan og CSV-skrá tafla, og gagnasafnið man frá hvaða þjóni, verkefni og
útgáfu það kom. Í Umsjón sýnir kortið *Frá CDE* þetta, og *Leita að nýrri útgáfu* spyr þjóninn hvort skjalið hafi nýrri
útgáfu; hún er þá sótt sem eigið gagnasafn við hlið hins gamla. Gagnalindin segir einnig hvað þú mátt gera í verkefninu,
til dæmis búa til mál eða hlaða upp skjölum. Þegar gagnalindin er búin til spyr glugginn þjóninn hvar skráð er inn; svari
þjónninn ekki þá spyr forritið aftur við fyrstu innskráningu.

Meðan eigin síða þjónsins er opin í sprettiglugga (innskráning, val skjala, upphleðsla) sýnir forritið hnappinn *Hætta við*, svo að þú getir hætt að bíða ef glugginn var lokaður eða týndist.

Leyfi þjónninn það skráir forritið sig sjálft sem biðlara þegar þú lætur biðlaraauðkennið vera autt, svo enginn stjórnandi þarf
að afhenda neitt. Gagnasöfn geta einnig farið aftur til þjónsins: flipinn *Til CDE* í Deila sendir gagnasafn á hvaða sniði sem er,
eða upprunalegu skrána, í verkefni, annaðhvort í gegnum Documents API, þar sem eigin síða þjónsins spyr um titil og útgáfu, eða sem
BCF-skjal. Gagnasafn sem sótt var frá þjóninum má senda sem nýja útgáfu af skjali sínu.

Fyrir IFC-graf Dataregium er upphafskóði í sýninni: líkönin í grafinu og nýjasta fullgerða á hvert skjal, byggingarhlutar eftir flokki, GTIN veggjanna, mál eftir stöðu,
mál og byggingarhlutar þeirra, mál sem varða byggingarhluta og graf af málum, viewpoints og íhlutum. Veldu fyrirspurn, breyttu og
keyrðu. Það krefst þess að sá sem rekur þjóninn hafi gert Bolt aðgengilegt; þróunarstaflinn gerir það, framleiðsluþjónn sjaldan.

Vinnusvæðispakki getur einnig farið í gegnum þjóninn: flipinn *Til CDE* sendir hann sem skjal, og kortið með skrám verkefnisins sýnir
hnappinn *Taka á móti* fyrir pakkaskrár, sem tekur á móti pakkanum alveg eins og þegar skránni er sleppt í Sækja.

Kortið *Skrá* neðst í sýn uppsprettunnar sýnir allt sem forritið hefur sent þjóninum í lotunni: tíma, aðferð, API (Foundation,
BCF eða Documents) og aðgerð samkvæmt forskriftinni, stöðu og tíma. Smellur á línu sýnir hausana (tókar og vefkökur faldar),
skýringu á því hvað aðgerðin gerir með tengli á forskriftina, og hnappinn *Afrita sem curl*. Kveiktu á *Vista innihald* til að sjá
einnig innihald beiðni og svars (texti, mest 64 kB; aldrei tókakall). Skráin er aðeins í minni og er aldrei send; hana má vista sem
JSON eða sem gagnasafn. Forritið setur hausinn X-Request-Id á hvert kall svo að eigin skrá þjónsins megi para við skrá forritsins;
hafni þjónn hausnum er slökkt á honum fyrir þá uppsprettu.

Hlið þjónsins er lýst í skjölum Dataregium: [client-guide.md](https://github.com/marwiss/Dataregium/blob/main/docs/is/client-guide.md) (hvernig biðlari tengist) og [deploy/local.md](https://github.com/marwiss/Dataregium/blob/main/docs/is/deploy/local.md) (þróunarstaflinn og hvernig forritið er prófað gegn honum).

Dataregium lýsir viðbótum sínum í `GET /.well-known/dataregium`; forritið les skjalið þegar uppsprettan er opnuð og skrifar undir
fyrirsögnina hver þjónninn er og hvaða viðbætur hann hefur (sjálfskráning, beiðnaskrá, stjórnun, IFC-LPG, graffyrirspurnir). Þjónn
án skjalsins hefur engar viðbætur, og allt samkvæmt forskriftunum virkar þó. Villukóðar þjónsins (`code` í svarinu, til dæmis
`reauthentication_required`) birtast á þínu tungumáli; óþekktir kóðar sýna eigin texta þjónsins. Tengillinn *Opna í Dataspatium* á
síðum þjónsins hefur formið `index.html#/inhamta/opencde?server=https://…` og opnar gluggann fyrir nýja uppsprettu með slóðina
útfyllta. Sé þjónninn þegar uppspretta opnast hann beint. Tengillinn getur einnig bent á verkefni og skjal
(`&project=…&document=…&version=…`): verkefnið er valið og skjalið sótt sem gagnasafn þegar þú ert innskráður. Síður sem Dataregium
opnar í sprettiglugga (innskráning, upphal, val skjala) birtast á tungumáli forritsins.

**Stjórnun.** Ef þú ert stjórnandi á Dataregium-þjóni sýnir sýn uppsprettunnar spjaldið *Stjórnun* (þegar getuskjal þjónsins segir að stjórnunarforritaskilin séu virk). Hnappurinn *Skrá inn sem stjórnandi* biður um réttindin `admin`; síðan koma fliparnir Yfirlit, Notendur (stofna, breyta, gera óvirkan, endurstilla lykilorð, eyða), Verkefni (stofna, endurnefna, þátttakendur og hlutverk, eyða), Biðlarar (skrá, breyta, skipta um leyndarmál, afturkalla tóka, eyða), Setur (ljúka einni eða öllum setum notanda), Atvikaskrá, Stillingar og Heilsa, auk Graffyrirspurnar þegar þjónninn leyfir lesandi Cypher gegn IFC-grafinu. Hættulegar aðgerðir krefjast nýlegrar innskráningar: þjónninn svarar `reauthentication_required`, forritið opnar innskráninguna aftur og endurtekur kallið. Einnota gildi (fyrsta lykilorð, biðlaraleyndarmál) eru sýnd einu sinni með hnappinum Afrita og aldrei skrifuð í atvikaskrána. Hvern lista má vista sem gagnasafn og sækja aftur úr Hantera.

## Opin landupplýsingagögn

Glugginn fyrir *Landupplýsingauppsprettu* undir *Bæta við uppsprettum* hefst á lista yfir **tilbúnar landupplýsingauppsprettur**: opnar WFS-,
OGC API Features- og ArcGIS-þjónustur frá norrænum stofnunum og sveitarfélögum (SCB, SGU, Naturvårdsverket, SLU Artdatabanken, Riksantikvarieämbetet, Skogsstyrelsen, Kartverket, Miljødirektoratet, Riksantikvaren, Hagstofa Finnlands, SYKE,
Helsinki, Väylävirasto, Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands og fleiri), allar
staðfestar til að virka úr vafranum. Forstillt uppspretta opnast, öðrum er bætt við með einum smelli og lögin lesin úr
þjónustunni; síaðu eftir heiti, landi eða innihaldi. Listinn er í `presets/geodata/services.json`. Undir listanum eru

Þrjár uppsprettur sækja skipulag: *Plandata.dk (WFS)* og *Skipulagsgögn Skipulagsstofnunar (ArcGIS)* hafa hnappinn
**Sækja skipulag**, sem les heilt staðbundið skipulag eða deiliskipulag (öll lög) með skipulagsnúmeri og vistar það sem
skipulag, og *Ryhti kaavatiedot (OGC API Features)* gefur skipulagsskrá Finnlands. Sjá [planer.md](planer.md#skipulag-frá-öðrum-norðurlöndum).
reitirnir fyrir eigin þjónustu. Planbestämmelsekatalog Boverket er venjuleg API-uppspretta (*Boverket
Planbestämmelsekatalogen*), sjá [planer.md](planer.md).

Valið **Landupplýsingauppspretta** undir *Bæta við uppsprettum* í Safna gerir venjulega API-uppsprettu úr vistfangi
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
Lantmäteriet (deiliskipulag, byggingar, strandvernd, menningarsögulegar minjar og mörk fjallaskóga) er á stigi 2 með Bearer-lykli frá tengdri stofnun.

**NVDB hjá Trafikverket** (*Trafikverket NVDB: vegagögn*) gefur 45 hlutategundir úr sænska landsvegagagnagrunninum, eins og
hámarkshraða, vegnúmer, burðarþol, fjölda akreina, götuheiti, gatnamót og áningarstaði, með einum endapunkti fyrir hverja
hlutategund. Hann krefst ókeypis lykils frá [data.trafikverket.se](https://data.trafikverket.se/), sem er sendur í meginmáli
beiðninnar og aldrei í vistfanginu. Tilgreindu svæðið í WGS 84 eins og fyrir hinar uppspretturnar; forritið umreiknar það í
SWEREF 99 TM, og án svæðis er allt landið sótt. Svörin eru lesin í síðum með 5.000 hlutum, og rúmfræðin er umreiknuð í WGS 84
svo að gagnasafnið opnast sem kort. Gögnin eru CC0.

**STAC hjá Lantmäteriet með lykli** (*Landupplýsingar Lantmäteriet með lykli (STAC)*) leitar í fjórum skrám Lantmäteriet:
vigurgögn (byggingar, landþekja, örnefni, fasteignaskipting og heimilisföng), réttmyndir, hæðargögn (landlíkanið og
leysigögn) og kort. Veldu safn og tilgreindu svæði; niðurstaðan er fletir skránna sem kort með vistföngum skránna. Spjaldið
**Skrár í uppsprettunni** í Umsjón sækir síðan skrárnar með lyklinum: vigurskrárnar eru lesnar inn sem gagnasöfn (ZIP er
afþjappað og GeoPackage gefur eitt gagnasafn fyrir hvert lag), og rastagögn, punktský og aðrar skrár sem forritið les ekki
eru vistaðar á tölvunni, mest 20 í einu. Lykillinn er neytendalykillinn og neytendaleyndarmálið af ókeypis aðgangi í
[Geotorget](https://geotorget.lantmateriet.se/); forritið sækir aðgangstákn með þeim, og það er aðeins sent til API
Lantmäteriet og skráaþjónsins dl1.lantmateriet.se.

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
auðkenni). Hún er ætluð fyrir streymandi vefþjónustur; engar forstillingar nota hana enn. Neo4j fer um Bolt með eigin rekli.

## Takmarkanir

- Brúin keyrir á tölvunni þar sem forritið er notað; fjartengdir gagnagrunnar nást um rekla eða DSN á þeirri tölvu.
- Mest 100 000 raðir í hverri sókn um brúna nema `-MaxRows` sé hækkað; stórar töflur eru best afmarkaðar með SQL.
- Access-skrár í vafranum: engar fyrirspurnir, tengdar töflur eða lykilorð; mjög stórar skrár taka minni.
- Elasticsearch skilar mest 10 000 niðurstöðum í hverri leit (`from` + `size`).
- Allar HTTP-uppsprettur krefjast CORS; það verður ekki sniðgengið úr vafranum.
