# Hamirnir átta

Dataspatium er skipt í átta hami sem fylgja gangi vinnunnar, í sama anda og hagskýrslugerðin safna, vinna, greina
og miðla: Sækja, Umsjón, Leita, Vinna, Greina, Myndgera, Flytja út, Deila. Allir hamir hafa sömu beinagrind:
hamavalið efst, hlutaspjaldið til vinstri, vinnuflötinn í miðjunni, eiginleikaspjaldið til hægri og stöðustikuna
neðst, með dagbókina fellda inn fyrir ofan hana. Spjöldin skipta aldrei um stað. Alt+1 til Alt+8 skipta um ham. Tómt
vinnusvæði opnast í Sækja, vinnusvæði með gagnasöfnum í Umsjón. Hnapparnir efst til hægri opna skipanaspjaldið,
skipta um tungumál, skipta um þema (ljóst, dökkt, fylgja kerfinu) og opna hjálpina.

**Stöðustikan** sýnir vistunarstöðu, hversu mikla geymslu vinnusvæðið notar, valda gagnasafnið (heiti, raðir og
dálkar; smellur opnar það í Umsjón), stöðu R-vélarinnar (slökkt, ræsist, tilbúin, upptekin; smellur ræsir hana),
netköll í gangi (smellur sýnir dagbók yfir köll), hnappana sem fella hlutaspjaldið, eiginleikaspjaldið og dagbókina
inn og út, og fjölda lína í dagbókinni.

**Breidd spjaldanna** er breytt með því að draga brúnina milli spjalds og vinnuflatar; tvísmellur endurstillir, og
með lyklaborðinu færa örvalyklarnir brúnina (Shift fyrir stærri skref, Home og End fyrir minnstu og mestu breidd).
Breiddirnar eru vistaðar. Í þrengri gluggum (undir 1 100 px) sýnir hamavalið aðeins tákn, með texta á virka hamnum,
og eiginleikaspjaldið opnast sem yfirlagsspjald yfir vinnuflötinn; undir 760 px gerir hlutaspjaldið það sama.
Yfirlagsspjaldi er lokað með Esc eða smelli á vinnuflötinn.

**Ábendingar** birtast fyrir alla hnappa þegar bendillinn hvílir á þeim eða þegar þeir fá fókus með lyklaborðinu; á
snertiskjá með því að halda fingri á hnappnum.

Skipanaspjaldið (Ctrl+K eða stækkunarglerið efst) nær öllu úr einum leitarreit: skipta um ham, opna gagnasafn,
myndrit eða mælaborð, keyra vinnsluaðgerð á valda gagnasafnið, flytja út, opna vinnusvæðið, leita í gögnum, búa til
pakka, afrita tengil hingað, skipta um þema eða leita að uppfærslum. Tenglar eru á forminu
`index.html#/<hamur>/<stuttheiti>` (eða heiti myndrits í Myndgera, leitartexti í Leita) og virka líka úr möppu. Ör upp og niður velja, Enter keyrir og Esc lokar; síðast keyrðu
skipanirnar eru efst.

Þú breytir hæð skráarspjaldsins með því að draga efri brún þess, eða með örvalyklum þegar brúnin hefur fókus. Tvísmellur endurstillir hæðina og hæðin er vistuð.

## Sækja

Hér koma gögn inn: skrár sem sleppt er á flötinn, límdur texti, vefslóðir og opnar vefþjónustur. Innflutningur skráa
fer í skrefum: skrá, stillingar með forskoðun, dálkar með gerðum, lokið. Snið: CSV og annar aðgreindur texti, texti
með fastri dálkbreidd, Excel, ODS, JSON (líka JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile og gegnum R:
SPSS, Stata, SAS, PX, Parquet, RDS og RData (sjá [format.md](format.md)); R-sniðin eru flutt inn í einu skrefi án
forskoðunar. Undir Opnar vefþjónustur eru forstillingar fyrir Hagstofu Íslands, Veðurstofu Íslands og hagstofur og
stofnanir hinna Norðurlandanna, SCB (flettu í efnistrénu eða leitaðu að töflu), Eurostat, Nordic Statistics og
fleiri, auk uppruna sem krefjast lykla; landahnapparnir ofan við listann velja hvaða landa upprunar birtast. Eigin
uppsetningum er bætt við úr skrá og þeim má deila. *Vistaðar sóknir* telur upp gagnasöfnin sem komið hafa úr
vefþjónustu og uppfærir þau með einum smelli, eitt í einu eða öll. Í fyrsta skipti sem forritið þarf að hafa samband
við netið í einhverjum tilgangi (vefþjónustur, vefslóðir, GitHub, íhlutir) spyr það um leyfi; svarið má vista. Sjá
[api-konfiguration.md](api-konfiguration.md).

Undir *Gagnagrunnar* eru tvær leiðir inn: *Gagnagrunnur um brúna* (Access, Excel, SQL Server, SQLite og
ODBC-uppsprettur á tölvunni um litla staðbundna skriftu) og *Bæta við gagnagrunnsuppsprettu* (PostgREST, OData,
GraphQL, CouchDB, ClickHouse, Elasticsearch, SPARQL, InfluxDB, Google Sheets og Airtable um HTTP). Access-skrár eru
auk þess lesnar beint sem skrár, og í Chrome og Edge má tengja skrá svo gagnasafnið sé lesið aftur af diski. Sjá
[kallor.md](kallor.md).

QGIS-verkefni (.qgs, .qgz) verða kortasýnir: lagaröð, sýnileiki og tákn fylgja með, lögin eru pöruð við gagnasöfn með sama skráarheiti og gagnaskrár sem sleppt er með verkefninu eru fluttar inn fyrst (sjá [kartor.md](kartor.md)).

Undir *Gagnagrunnar* er einnig *Bæta við landupplýsingauppsprettu*: WFS-, OGC API Features- eða ArcGIS-þjónusta verður
uppspretta þar sem lögin eru sótt sem GeoJSON og opnuð sem kort, og uppsprettan *Geodataportalen (sök geodata)* leitar í
sænsku landsskránni yfir landupplýsingar og bætir þjónustum við með einum smelli. Forstilltar landupplýsingauppsprettur
eru til fyrir SCB, SGU, Havs- och vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen, Kartverket, Hagstofu
Finnlands og SYKE auk landupplýsingavettvangs Lantmäteriet fyrir þá sem hafa lykil. Sjá
[kallor.md](kallor.md#opin-landupplýsingagögn).

Stafrænt skipulag er flutt inn sem skipulag: sænskt deiliskipulag samkvæmt landsforskriftinni (GeoJSON) eða
tilvísunarfitjur Lantmäteriet, aðalskipulag samkvæmt forskriftinni eða ÖP-líkani Boverket (GeoPackage, valið *Allt
aðalskipulagið sem skipulag*). Skráin þekkist á innihaldinu, upplýsingar skipulagsins birtast og skipulagið opnast
sem skipulagskort í Vinna með litum Boverket (sjá [planer.md](planer.md)).

Net (hnútar og leggir) eru flutt inn sem net úr GraphML, GEXF, JSON með hnútum og leggjum eða Cypher-skriftum; skráin
þekkist á innihaldinu, upplýsingar netsins birtast og netið opnast sem netsýn í Vinna (sjá [grafer.md](grafer.md)).
Tvær töflur verða net með hnappinum *Gera net úr töflum* í Umsjón.

Byggingarlíkön í IFC og teikningar í DXF verða að gagnasöfnum af tegundinni líkan. Upplýsingar um skrána birtast og líkanið opnast í
þrívídd eða sem teikning í Vinna (sjá [cad-bim.md](cad-bim.md)).

**Söfnun á vettvangi** í lista yfir heimildir byggir eyðublað á dálkum og reglum gagnasafns og sendir það í símann. Raðirnar koma aftur sem ný
útgáfa (sjá [insamling.md](insamling.md)).

Allar heimildir á listanum líta eins út, með tákni fyrir gerð og línu undir heitinu. *Bæta við heimild* safnar saman öllum leiðum til að bæta við heimild: stillingaskrá, gagnagrunni eða landupplýsingaþjónustu.

**Forritið segir fyrst hvað skráin er**, til dæmis tafla með stöðum, net eða byggingarlíkan, og sýnir hana á sínu eigin formi: kort, myndirnar, skissu af netinu, teikninguna eða fyrstu síðuna. Ef eitthvað er þess virði að spyrja um spyr það: hnit sem virðast hafa skipt um stað, í hvaða hnitakerfi þau eru og hvort lesa eigi lista af tengslum sem net. Ekkert breytist fyrr en þú svarar, og kortið sýnir hvað svarið gerir.

**Margar ólíkar skrár** eru flokkaðar eftir því hvað þær eru: myndir verða eitt safn, skjöl annað og hver önnur skrá sitt eigið gagnasafn. Þú sérð listann fyrst og getur sleppt einhverju. Þú getur líka sleppt heilli möppu eða valið hana með *Velja möppu*. Skrá sem ekki er hægt að lesa stöðvar ekki hinar.

**Leiðbeiningar.** Undir Leiðbeiningar eru fjórar stuttar leiðir frá spurningu til niðurstöðu með raunverulegum gögnum: bera saman sveitarfélög í gegnum Kolada, mannfjöldapýramídi í gegnum SCB, veður yfir langan tíma í gegnum SMHI og verðþróun í gegnum Seðlabanka Evrópu. Leiðbeining sækir, hreinsar og vistar myndrit. Þú færð töfluna, myndritið og skrefin til að byggja á. Hún sækir af netinu aðeins þegar þú ýtir á *Keyra leiðbeininguna*.

**Gagnapakkar.** ZIP-skrá með `datapackage.json` (Frictionless Data Package) er lesin með gerðum og titlum úr skema hennar, og hver tafla verður að gagnasafni.

**Skrár frá CDE.** OpenCDE-gagnalind telur upp líkön og skjöl verkefnisins, og *Sækja* býr til gagnasafn af tegund skrárinnar sem man hvaðan það kom. Sjá [kallor.md](kallor.md).

**BCF-skrár.** BCF-skrá (bcf, bcfzip) verður tafla með málum, með athugasemdum og íhlutum við hliðina. Sjá [format.md](format.md).

## Umsjón

Heimili gagnasafnanna. Hlutaspjaldið er tré: gagnasöfn geta legið í möppum með undirmöppum (`Fjármál/2026`) og haft
merki; síureitur leitar í heiti, stuttheiti, merki og möppu, og listanum má raða eftir breytt, heiti eða röðum.
Möppur fellast saman og opnast, og gagnasöfn má draga í möppu. Gátreitirnir velja fleiri gagnasöfn (Shift velur bil)
og hnappurinn *Aðgerðir (n)* opnar hópaðgerðirnar: raða (mappa og merki), pakka, flytja út sem ZIP með CSV-skrám,
sækja aftur úr vefþjónustu, keyra uppskrift og eyða. Mappa og merki fylgja gagnasafninu í skrá þess, í pökkum og í
afritum.

Yfirlit gagnasafns sýnir lýsigögn, dálkalista, athugasemdir, sögu þess sem gert hefur verið við gagnasafnið og
útgáfur, og hér endurnefnir þú og breytir stuttheiti (stuttheitið er notað í SQL, R og myndritaskrám), raðar, eyðir
og sækir aftur úr vefþjónustu. Undir *Vinnusvæði* er hversu mikil geymsla er í notkun, varanleg geymsla, afrit í ZIP
og endurheimt, í Edge og Chrome færanleg mappa (vinnusvæðið er vistað sem venjulegar skrár í möppu sem þú velur,
sjálfkrafa eftir hverja breytingu ef þú vilt, og má hlaða inn á annarri tölvu), *Netaðgangur* (hvaða tilgangir mega
hafa samband við netið, með dagbók yfir köll) og *Íhlutir* (hlutar forritsins og R-pakkar sem eru sóttir þegar þeirra
er þörf, með stærð, uppruna og hnöppum til að sækja fyrirfram eða fjarlægja). Pakkar og GitHub hafa flust í haminn
Deila.

Skjala- eða myndasafn er sýnt með fjölda skjala og síðna eða mynda, með skjalalistanum eða fyrstu smámyndunum á
yfirlitsflipanum, og með hnappinum *Lesa* eða *Sýna myndir* sem opnar lestrarsýnina eða myndasýnina í Vinna (sjá
[dokument.md](dokument.md)).

**Flæði og vöktun** eru í hlutaspjaldinu: vistaðar keðjur sem keyrðar eru með einum smelli eða við ræsingu og heimildir sem láta vita
þegar ný gögn eru til (sjá [floden.md](floden.md)).

**Það sem forritið sér.** Yfirlitið sýnir hvað einnig má nota gagnasafnið sem: staði á korti, tímaröð, svæði sem má lita, net eða samfelldan texta. Hver lína segir hvers vegna og þú getur slökkt á því sem er rangt eða kveikt á því sem forritið missti af. Valið er vistað í gagnasafninu og hamirnir fylgja því. Þar fyrir neðan sýnir **Vert að athuga** það sem tegund gagnanna þarf: síður án texta, myndir án staðsetningar, leggi sem vísa á hnúta sem eru ekki til, einingar án magns eða raðir án staðar.

**Val.** Hnappurinn *Nota sem val* er í Leita og í sýnum Vinna. Það sem þú sérð fylgir síðan milli hama og birtist á stöðustikunni. Í Vinna sýnir þú það með listavali, í Flytja út velur þú hvort aðeins valið fylgi og í pökkum geturðu sent aðeins valið. Af stöðustikunni vistar þú það sem lista, gerir það að gagnasafni eða hreinsar það. Ef raðir gagnasafnsins breytast hverfur valið, því það myndi ekki lengur merkja það sama.

**Mynd.** Yfirlitið sýnir mynd af gagnasafninu: fyrstu síðuna, kort af stöðunum, skissu af netinu, teikninguna, úr hverju líkanið er eða línu yfir tíma. Venjuleg tafla hefur enga mynd.

**Mörg gagnasöfn.** Ef þú hefur valið mörg sýnir *Þetta geta þau gert saman* hvað er hægt: sama kort þegar öll hafa staði, ein tafla þegar öll hafa sömu dálka og eitt safn þegar öll eru myndir eða öll eru skjöl. Þau völdu breytast ekki. Við útflutning fær hvert sitt eigið snið, til dæmis myndir sem ZIP og net sem GraphML.

**Útgáfur** segja hvað þær innihalda í eigin einingum gagnasafnsins, og samanburðurinn sýnir hvaða myndir, skjöl, hnútar, leggir eða einingar hafa bæst við og horfið.

**Kóðalistar.** Dálkar með kóðum úr þekktum lista eru sýndir á yfirlitinu: SNI, SSYK, NACE, ISCED, COFOG, NUTS, norrænu hliðstæðurnar, lönd og sveitarfélög. Smellur bætir nöfnunum við sem gildamerkingum og gildin breytast ekki. Stuttur kóði telst aðeins þegar nafn dálksins passar. Listarnir fylgja forritinu og heimildir þeirra og leyfi eru í `presets/kodlistor/KALLA.md`.

**Lýsing.** Flipinn Lýsing geymir það sem gagnagátt vill vita samkvæmt DCAT-AP-SE: titil, útgefanda, tengilið, þema, leyfi og tímabil. Lýsingin fylgir gagnasafninu, segir hvað vantar og hægt er að vista hana sem RDF/XML eða lesa úr slíkri skrá. Ekkert er sent héðan.

**Uppruni.** Flipinn Uppruni sýnir hvaðan gagnasafn kemur og hvað það hefur orðið að: gagnalindina, gagnasöfnin sem það var gert úr, uppskriftina og útgáfurnar, og gagnasöfnin, myndritin, mælaborðin, skjölin, minnisbækurnar, listana, flæðin og deilingarnar sem byggja á því. Smellur opnar það sem þú smellir á og *Sækja sem texta* gefur það sama til að setja í skýrslu.

**Safn.** Undir Safn eru tilbúnar uppskriftir, sniðmát, skriftur og minnisbækur, hvert með sitt leyfi. Þú sérð hvað eitthvað gerir áður en þú bætir því við. Fleiri söfn eru sótt af vefslóð og *Vista eigin sem safnskrá* býr til skrá úr því sem þú hefur gert, til að setja í GitHub-geymslu eða hvert sem er.

**Frá CDE.** Gagnasafn sótt frá OpenCDE-þjóni sýnir þjón, verkefni og útgáfu, getur spurt um nýrri útgáfu og opnað mál líkansins.

## Leita

Finna og lista án kóða. Flipinn *Leita* leitar í öllum dálkum í einu eða öllum gagnasöfnum; hvert orð þarf að
finnast í röðinni, óháð há- og lágstöfum. Niðurstöðurnar birtast eftir gagnasafni með fjölda, flokkum (algengustu
gildin í dálkum með fá ólík gildi, sem afmarka leitina með einum smelli) og töflu þar sem röð opnar alla færsluna í
eiginleikaspjaldinu. Leit má vista sem lista, gera að nýju gagnasafni eða opna í Vinna. Flipinn *Fyrirspurn* býr til
fyrirspurn yfir eitt eða fleiri gagnasöfn (dálkar, útreikningar, skilyrði, röðun) án kóða og sýnir þá SQL sem verður
til; hana má opna í Greina, vista sem lista eða gera að gagnasafni. Flipinn *Listar* safnar vistuðum leitum og
fyrirspurnum eftir gagnasafni og keyrir þær aftur á gögnum dagsins; listar afmarka líka töfluna í Vinna og raðir
myndrita. Sjá [soka.md](soka.md).

## Vinna

Allt sem gert er við töfluna með hnöppum og gluggum: breyta reitum beint í töflunni, raða, sía og sjá dálkatölfræði;
aðgerðir til hreinsunar (leita og skipta út með reglulegum segðum, snyrta, há- og lágstafir, lagfæring stafakóðunar,
skipta út gildi, fylla í vantandi, tvítök, hreinsun flokka), gerðir (tala, dagsetning, já/nei), uppbygging
(reiknaðir dálkar, skipta og sameina, eyða röðum, snúa) og ný gagnasöfn (hópa og safna saman, tengja, leggja saman).
Gagnagæðasniðið bendir á hvað ætti að leiðrétta, og gæðareglur (má ekki vanta, einkvæmt, bil, listi, mynstur, lengd,
SQL-skilyrði) athuga gögnin eftir óskum með skýrslu og röðum sem bregðast sem eigið gagnasafn. Allt er skráð sem
uppskrift sem má afturkalla, spila á öðru gagnasafni og flytja út sem R- eða SQL-kóða. Útgáfur vista skyndimyndir
til að hverfa aftur til. Sjá [bearbeta.md](bearbeta.md).

**Skjalasöfn** (PDF, Word, OpenDocument, Markdown, texti) opnast sem lestrarsýn: veldu skjal,
flettu síðu fyrir síðu, sýndu PDF-síðuna sem mynd, leitaðu í öllu safninu og sæktu frumritið. **Myndasöfn** opnast sem myndasafn með smámyndum, síu, röðun og EXIF-upplýsingum myndarinnar í skoðaranum, þar sem
lýsingunni má breyta. *Sýna sem töflu* gefur í báðum tilvikum venjulegu töfluna með öllum aðgerðum. Sjá
[dokument.md](dokument.md).

Gagnasöfn með rúmfræði eða hnitum opnast sem **kort** til að þysja og færa; smellur á fitju sýnir eigindin, bakgrunnskort eftir samþykki, *Vista sem kortasýn* fyrir Myndgera. *Sýna sem töflu* gefur töfluna (sjá [kartor.md](kartor.md)).

Val úr Leita er merkt í þrívíddarlíkaninu, og myndavélinni er beint að því.

**Að lesa texta í myndum.** Síður í skannaðri PDF-skrá og myndir í myndasafni má lesa með textagreiningu, sem keyrir í vafranum. Sjá [dokument.md](dokument.md).

**Mál.** Líkansýnin sýnir BCF-mál verkefnisins frá CDE og merkir byggingarhlutana sem þau vísa á. Sjá [cad-bim.md](cad-bim.md).

**Að skrifa mál.** Líkansýnin býr til mál úr merkingunni með sýnina sem viewpoint, skrifar athugasemdir og breytir stöðu, og vistar mál verkefnisins sem BCF-skrá. Sjá [cad-bim.md](cad-bim.md).

## Greina

Kóði og tölfræði. Verkfærin eru í fastri röð: R, Python, SQL, Regex og síðast minnisbókin, sem fléttar saman hluta úr hinum;
Python-stjórnborðið hefur pandas, matplotlib, seaborn og plotly og er sótt sem eining í fyrsta sinn sem þú ræsir það (sjá
[python.md](python.md)). R-stjórnborðið hefur ggplot2, dplyr, tidyr og aðra pakka, vistaðar
skriftur, myndrit með útflutningi í SVG, PNG og PDF, og `dm_read()`/`dm_write()` til að flytja gögn milli forritsins
og R (sjá [r-guide.md](r-guide.md)); pakkar sem fylgja ekki forritinu eru sóttir úr pakkasafni webR þegar kóðinn þarf
þá, eftir að þú hefur gefið leyfi. SQL-stjórnborðið vinnur á valda gagnasafnið (`data`), þar sem önnur gagnasöfn nást
með stuttheitum sínum svo fyrirspurn geti gert join yfir fleiri gagnasöfn; fyrirspurnir sýna niðurstöður sem má vista
sem nýtt gagnasafn, breytandi setningar eru skráðar sem uppskriftarskref (sjá [bearbeta.md](bearbeta.md)). Flipinn
Regex prófar reglulegar segðir á dálki með niðurstöðurnar merktar og notar þær til að sía, draga út, skipta út,
skipta upp, merkja, telja eða búa til gæðareglu, með mynstursniði og safni norrænna mynstra (sjá [regex.md](regex.md)).
Minnisbókin blandar texta (Markdown), R og SQL í reitum sem keyra í röð og verða að skýrslu í HTML, Word, PDF,
Markdown eða LaTeX (sjá [anteckningsbok.md](anteckningsbok.md)). Síðar: tölfræðilíkön.

Þegar skjalasafn er valið er flipinn **Texti** (orðtíðni með stopporðum, leitarorð í samhengi, samtíðni og yfirlit
fyrir hvert skjal) og þegar myndasafn er valið flipinn **Myndir** (yfirlit eftir tegund, myndavél, ári eða mánuði og
tvítök með myndahakki). Báðir eru eftir Regex og á undan Minnisbókinni, og hverja niðurstöðu má vista sem nýtt
gagnasafn. Sjá [dokument.md](dokument.md).

Fyrir gagnasöfn með rúmfræði er flipinn **Geo** (eftir Regex): mál, punktar í svæðum, næst, jaðarsvæði, yfirlögn, sameining og einföldun með Turf í vafranum; niðurstöðurnar verða gagnasöfn sem opnast sem kort.

Net fá flipann **Cypher** strax eftir SQL (Cypher-hlutmengi þýtt í SQL, SQL sýnt) og flipann **Net** eftir Regex
(samantekt, gráða, samhangandi hlutar, stysta leið, hlutnet, hnútar og leggir sem töflur).

Flipinn **Tölfræði** á eftir Regex gerir algengar greiningar með eyðublöðum sem skrifa og sýna kóðann (sjá [statistik.md](statistik.md)).

Líkön og teikningar fá flipann **Magn** eftir Regex (fjöldi, lengd, flatarmál og rúmmál eftir gerð, hæð og efni, úr skránni eða mælt á
rúmfræðinni).

Greina opnast í því verkfæri sem hentar gagnasafninu: Texti fyrir skjöl, Myndir fyrir myndasöfn, Net fyrir net, Magn fyrir líkön, Skipulag fyrir skipulag, Geo fyrir töflur með staði og annars Tölfræði. Þegar þú velur flipa sjálf(ur) verður þú þar. R ræsist ekki fyrr en þú opnar flipann R.

**Kóði til að byrja á.** Í R, Python og SQL er listi af kóða skrifuðum fyrir valið gagnasafn: leggir nets, magn líkans, myndir á mánuði, summa á tímabil eða staðirnir sem punktar. Valið setur kóðann inn þar sem bendillinn er. Ný minnisbók byrjar á sama hátt. Í SQL eru hliðartöflurnar sýndar með dálkum sínum, og smellur skrifar fyrirspurn um töfluna.

**Þróun.** Tölfræði hefur tólið *Þróun*, sem gefur eitt gildi á tímabil og beina línu í gegnum þau og segir hve mikið gildið breytist á tímabil. Gagnasafn sem er tímaröð opnast þar.

**Telja eftir svæði.** Undir Geo telur *Punktar í svæðum* staði eftir svæði, með flatarmáli og fjölda á ferkílómetra. Staðirnir geta verið myndir með staðsetningu, og svæðin geta verið skipulag, tafla með formum eða sveitarfélaga- og sýslumörkin sem fylgja forritinu.

## Myndgera

Myndrit með þremur vélum og einu útliti: myndritasmiðurinn (Vega-Lite) með súlum, línum, flötum, punktum,
stuðlaritum, hitakortum, kassaritum, kökum og kortum (þemakort úr GeoJSON- eða shapefile-gögnum); D3-snið fyrir
röðun, hallarit og aldurspýramída; og R-skriftur með ggplot2. Vistuð myndrit má flytja út sem SVG, PNG, PDF og
PowerPoint, deila sem viz-skrám, sýna í safni og búa til í hópkeyrslu eftir hópum. Mælaborð safna vistuðum myndritum
í grind með sameiginlegum síum og eru flutt út sem HTML eða PowerPoint. Sjá [visualisera.md](visualisera.md).

Myndritstegundin **Kort** er kortasýn með mörgum lögum úr gagnasöfnum með rúmfræði eða hnitum og meðfylgjandi mörkum, lit eftir flokki eða bili, merkjum, vistaðri sýn og bakgrunnskorti eftir samþykki; gagnvirk í stjórnborðum, kynningum og birtu HTML, flutt út í SVG, PNG og PDF án bakgrunnskorts (sjá [kartor.md](kartor.md)).

## Flytja út

Skrár á eigin tölvu, í þremur flipum. **Gögn**: CSV (Excel-aðlagað eða staðlað), Excel, ODS, JSON, XML, SQLite og
gegnum R: Parquet, SPSS, Stata og RDS. **Myndrit**: vistuð myndrit og mælaborð (líka öll myndrit sem ein PowerPoint)
sem SVG, PNG og PDF, eitt og eitt eða í hópkeyrslu eftir hópum í ZIP. **Skjöl**: skýrslur, kóðabækur og samantektir
úr sniðum í Markdown með staðgenglum, sem HTML, Word, PDF, Markdown eða LaTeX, eitt og eitt eða í hópkeyrslu eftir
hópum (sjá [dokumentmallar.md](dokumentmallar.md)). Það sem á að fara til annarra er í Deila.

Gagnasafn sem er meira en tafla skiptir sniðum í **Allt gagnasafnið** og **Aðeins taflan** og segir hvað fylgir ekki með. Skjöl má fá sem upprunaskrár eða hreinan texta, myndir sem ZIP og net sem tvær CSV-skrár.

**Eftir tegund gagnasafns.** Töflur með stöðum má vista sem KML, GPX og GeoPackage, í gráðum. Í GPX verða punktar að leiðarpunktum, og línur og útlínur flata verða að ferlum. Myndasöfn geta orðið yfirlitsblað í PDF með myndum og nöfnum. Skipulag getur orðið skipulagskort í PDF með skýringum, skipulagsákvæðin í Word og upprunalega skráin ef skipulagið kom úr skrá. IFC-líkan getur gefið magn í Excel, með summum eftir gerð og öllum gildum, og rúmfræðina sem glTF. DXF-teikning getur orðið PDF. Ef þú flytur út mörg gagnasöfn í Umsjón fær hvert sitt eigið form.

**Runuvinnsla eftir hæð eða skjali.** Runuvinnsla eftir hópi virkar með hvaða dálki sem er. Líkani er skipt eftir dálkinum `vaning`, og mynd líkansins sýnir þá aðeins þá hæð. Skjali er skipt eftir dálkinum `dokument`.

**Önnur verkfæri.** *Gagnapakki* gefur ZIP með CSV-skrám og `datapackage.json`, sem mörg verkfæri geta lesið. Leggir nets og eiginleikar líkans fylgja sem eigin töflur. *Gæðayfirlýsing* gefur Word-skjal á því formi sem SCB notar, útfyllt úr prófíl, reglum, athugasemdum, breytingum og lýsingu, með stöðum til að skrifa það sem aðeins manneskja getur sagt.

## Deila

Gefa öðrum gögn. **Pakki**: ZIP með völdum gagnasöfnum, myndritum, mælaborðum, sniðum, minnisbókum og skriftum,
skilaboðum og breytingaskrá, sem viðtakandinn opnar undir *Taka á móti* og getur skipt út sínum útgáfum með.
**GitHub**: vinnusvæðið sem mappa í safni, senda og sækja, með aðgangslykli sem er vistaður dulkóðaður.
**Deilivalmynd**: eigin deilivalmynd tölvunnar eða símans fyrir skrá eða pakka (tölvupóstur, Teams, skilaboðaforrit).
**Birta**: mælaborð og skjöl sem sjálfstæðar HTML-skrár. **Tæki**: beinn flutningur í síma og aðrar tölvur á sama neti með QR-kóða, staðfestingarkóða og pörun, og
Dataspatium Farsími í símanum (sjá [mobil.md](mobil.md)). **Taka á móti**: pakkar úr skrá eða af vefslóð, með
sendanda og breytingar sýnilegar áður en nokkuð er tekið inn. Gagnasöfn sem fara úr forritinu eru fyrst yfirfarin
með tilliti til persónuupplýsinga. Sjá [dela.md](dela.md).

**Til CDE.** Gagnasafn eða upprunaleg skrá þess í verkefni á OpenCDE-þjóni, í gegnum Documents API eða sem BCF-skjal. Sjá [dela.md](dela.md).
