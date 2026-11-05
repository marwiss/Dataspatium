[Svenska](../../README.md) · [Dansk](../da/README.md) · [Norsk](../nb/README.md) · [Suomi](../fi/README.md) · **Íslenska** · [English](../en/README.md)

# Dataspatium

Dataspatium er vefforrit fyrir gögn frá uppruna til skýrslu: sæktu gögn úr skrám og opnum vefþjónustum, vistaðu og haltu
utan um gagnasöfn, farðu yfir og leiðréttu gildi, greindu með R, myndgerðu og fluttu út. Allt keyrir í þínum eigin vafra.
Enginn þjónn, engin uppsetning, engir aðgangar. Gögnin þín yfirgefa aldrei tölvuna nema þú flytjir þau sjálf(ur) út.

![Dataspatium í hamnum Vinna með töflu yfir sænsk sveitarfélög](../images/bearbeta.png)

Viðmótið er á sænsku, dönsku, norsku, finnsku, íslensku og ensku. Skjámyndirnar í skjöluninni sýna forritið á sænsku.

## Sækja og hefjast handa

1. **Sæktu.** Farðu í [nýjustu útgáfuna](https://github.com/marwiss/Dataspatium/releases/latest) og sæktu ZIP-skrána undir
   *Assets* (`dataspatium-<útgáfa>.zip`, um 100 MB; R og allir R-pakkar fylgja með).
2. **Afþjappaðu.** Hægrismelltu á ZIP-skrána og veldu *Extract all* (Windows) eða tvísmelltu á hana (macOS). Settu möppuna
   þar sem þú vilt hafa hana, til dæmis í Skjöl. Forritið virkar ekki beint inni í ZIP-skránni.
3. **Opnaðu.** Tvísmelltu á `index.html` í möppunni eða dragðu skrána í vafraglugga. Ef Windows spyr hvaða forrit eigi að
   nota velurðu Edge, Chrome eða Firefox. Í fyrsta skipti spyr forritið hvaða tungumál þú vilt (því má breyta með
   tungumálahnappnum efst til hægri) og hefur síðan **grunnnámskeiðið**, gagnvirka yfirferð yfir alla hami með
   sýnigögnum sem tekur um tíu mínútur. Opnaðu það aftur úr hjálpinni (?).
4. **Flyttu inn.** Í hamnum *Sækja* sleppirðu skrá á flötinn (eða smellir á *Prófa með sýnigögnum*), athugar gerðir dálkanna
   og smellir á *Flytja inn*. Gagnasafnið er vistað í vafranum á tölvunni þinni.
5. **Haltu áfram.** Skiptu um ham efst: *Umsjón* sýnir gagnasöfnin þín og vinnusvæðið, *Leita* finnur raðir í þeim, *Vinna*
   sýnir töfluna með röðun, síum og aðgerðum, *Greina* opnar R- og SQL-stjórnborðið, *Myndgera* býr til myndrit, *Flytja út*
   hleður niður gögnum, myndritum og skjölum og *Deila* gefur þau öðrum.

Gögn eru vistuð í eigin gagnagrunni vafrans. Ef þú hreinsar vefgögn hverfa þau, svo taktu afrit reglulega undir *Umsjón >
Vinnusvæði*. Afritið er ZIP-skrá sem má endurheimta á sömu eða annarri tölvu. Skref fyrir skref með nánari upplýsingum:
[kom-igang.md](kom-igang.md).

Forritið er líka beint á vefnum, án niðurhals: <https://marwiss.github.io/Dataspatium/>. Af vefþjóni má setja það upp
sem sjálfstætt forrit (Edge og Chrome: *Setja upp* í veffangastikunni) og það virkar síðan líka án nets. Vefútgáfan og
möppuútgáfan hafa aðskilin vinnusvæði; færðu gögn á milli þeirra með afriti eða pakka.

## Kröfur

- Windows, macOS eða Linux.
- Microsoft Edge eða Google Chrome (útgáfa 120 eða nýrri) eða Firefox (útgáfa 128 eða nýrri). Safari er ekki stutt.
- Um 300 MB laust pláss fyrir forritsmöppuna og minnst 4 GB vinnsluminni (8 GB mælt með fyrir stór gagnasöfn). Engin
  stjórnandaréttindi þarf.
- Net þarf aðeins þegar þú sækir gögn úr opnum vefþjónustum, sendir á GitHub, leitar að uppfærslum eða sækir íhlut eða
  R-pakka sem fylgir ekki í möppunni; forritið spyr fyrst um leyfi.

## Hvað þú getur gert

- **Sækja**: CSV-, Excel-, ODS-, JSON-, JSON-stat-, SDMX-JSON-, GeoJSON-, XML-, SQLite-, GeoPackage- og shapefile-skrár, töflur í HTML-, Markdown-, Word- og LaTeX-skjölum, kortaskrár á KML-, KMZ-, GPX- og TopoJSON-sniði, SQL-skriftur, eldri töflureiknissnið (dBase, Lotus 1-2-3, Quattro Pro, SYLK, DIF), texta með fastri
  dálkbreidd, tölfræðiskrár úr SPSS, Stata og SAS (með gildismerkimiðum) og PX-sniði auk Parquet og RDS (gegnum R), límdan texta, skrár af vefslóðum
  og gögn beint úr opnum vefþjónustum hjá Hagstofu Íslands, Veðurstofu Íslands, hagstofum Danmerkur, Noregs, Finnlands,
  Svíþjóðar, Grænlands, Færeyja og Álandseyja, Nordic Statistics, Eurostat, Seðlabanka Evrópu, OECD og fleiri stofnunum,
  með landasíu og vistuðum sóknum sem uppfærast með einum smelli og keyra uppskriftir sínar aftur (sjá
  [api-konfiguration.md](api-konfiguration.md)). Sýnigögn og mörk sveitarfélaga og svæða fyrir Svíþjóð, Danmörku, Noreg
  og Finnland fylgja með.
- **Gagnagrunnar**: Access-skrár eru lesnar beint í vafranum; gagnagrunnar á tölvunni eða í netinu (SQL Server, ODBC,
  Excel, SQLite) nást um staðbundna brú, og PostgREST/Supabase, OData, GraphQL, CouchDB, ClickHouse, Elasticsearch,
  SPARQL, InfluxDB, Google Sheets og Airtable verða uppsprettur með einum smelli. Skrár má tengja og lesa aftur af
  diski (sjá [kallor.md](kallor.md)).
- **Skjöl og myndir**: PDF, Word, OpenDocument, Markdown og texti verða skjalasöfn sem eru lesin í lestrarsýn, síðu fyrir síðu
  eða í heild; myndir verða myndasafn með EXIF-upplýsingum og myndasafni. Tólin Texti (orðtíðni, leitarorð í
  samhengi, samtíðni) og Myndir (yfirlit, tvítök) virka án kóða (sjá [dokument.md](dokument.md)).
- **Vinna**: fletta, raða og sía stórar töflur, breyta reitum, hreinsa, ákvarða gerðir, endurkóða, skipta í flokka, raða í sæti, reikna hlutföll, uppsafnaðar summur og breytingar, snúa og tengja gögn, athuga
  gagnagæði með sniði og reglum (meðal annars snið gilda, norræn auðkennisnúmer, tilvísanir í önnur gagnasöfn og frávik), dulnefna kennitölur áður en deilt er, með afturköllun, útgáfum og uppskriftum sem má flytja
  út sem R eða SQL (sjá [bearbeta.md](bearbeta.md)).
- **Greina**: innbyggt R-stjórnborð með ggplot2 og tidyverse (sjá [r-guide.md](r-guide.md)), Python-stjórnborð með
  pandas og matplotlib sem er sótt í fyrsta sinn (sjá [python.md](python.md)), SQL-stjórnborð þar sem
  gagnasöfn eru tengd með join gegnum stuttheiti sín, og minnisbækur með texta-, R- og SQL-reitum sem verða að skýrslum í
  HTML, Word, PDF, Markdown eða LaTeX (sjá [anteckningsbok.md](anteckningsbok.md)), og Regex-flipi þar sem reglulegar segðir eru prófaðar á dálki og notaðar til að sía, draga út, skipta út og skipta upp (sjá [regex.md](regex.md)), allt í vafranum.
- **Kort**: landupplýsingasöfn opnast sem kort til að þysja, kortasýnir með mörgum lögum og bakgrunnskorti eftir
  samþykki verða stjórnborð og birt HTML, landfræðitólin reikna flatarmál, punkta í svæðum, næsta, jaðarsvæði og
  yfirlögn án kóða, og QGIS-verkefni verða kortasýnir (sjá [kartor.md](kartor.md)).
- **Opin landupplýsingagögn**: WFS-, OGC API Features- og ArcGIS-þjónustur verða uppsprettur þar sem lögin eru sótt sem
  kort, með forstillingum fyrir SCB, SGU, HaV, RAÄ, Skogsstyrelsen, Kartverket, Hagstofu Finnlands og SYKE, leit í
  Geodataportalen og WMS-þjónustum sem bakgrunnskorti eða lagi (sjá [kallor.md](kallor.md)).
- **Skipulag**: sænskt stafrænt deiliskipulag (landsforskriftin, landupplýsingavettvangur Lantmäteriet) opnast sem
  skipulagskort með litum og merkingum Boverket, ákvæðin eru flett upp í skrá Boverket yfir skipulagsákvæði (innbyggt
  eintak), og aðalskipulag (forskriftin eða ÖP-líkan Boverket) er sýnt þema fyrir þema (sjá [planer.md](planer.md)).
- **Norrænt skipulag**: staðbundið skipulag og rammar sveitarfélagsskipulags Danmerkur (Plandata.dk), finnska
  skipulagsgagnalíkanið og skipulagsskráin (Ryhti), stafrænt deili- og aðalskipulag Íslands (Skipulagsstofnun) og norskt
  reguleringsplan (GeoPackage) opnast sem skipulag með litum hvers lands; heilt skipulag er sótt með númeri sínu frá Plandata og Skipulagsstofnun.
- **Net**: GraphML, GEXF, JSON með hnútum og leggjum og Cypher-skriftur opnast sem net með yfirliti eftir merkimiða, fókus-
  og heildarsýn (Cytoscape og sigma), Cypher-hlutmengi þýddu í SQL, netmælingum í bakgrunni og útflutningi í öllum fjórum
  sniðum; tvær töflur verða net (sjá [grafer.md](grafer.md)).
  Netinu er breytt í Vinna og með skrifandi Cypher (uppskriftarskref), Neo4j er uppspretta yfir Bolt, flipinn Net hefur PageRank,
  samfélög, miðlægni, mynsturfyrirspurnir og uppröðun, og net verða myndir í Myndgera, mælaborðum og Birta.
- **CAD og BIM**: IFC-líkön opnast í þrívídd (web-ifc og three.js) fyrir ofan töflu yfir byggingarhlutana og valið fylgir í báðar áttir.
  Eiginleikar og magn verða að töflum, flipinn Magn reiknar eftir gerð, hæð og efni og DXF-teikningar birtast sem SVG með lögum
  (sjá [cad-bim.md](cad-bim.md)).
- **Flæði og vöktun**: vistuð keðja (sókn, uppskriftir, skriftur, listar, gröf, mælaborð, skjöl, útflutningur) er keyrð með einum smelli
  eða við ræsingu og vaktaðar heimildir láta vita á stöðustikunni þegar ný gögn eru til (sjá [floden.md](floden.md)).
- **Tölfræði án kóða**: flipinn Tölfræði gerir lýsandi tölfræði, krosstöflur, fylgni, tilgátupróf, aðhvarf og klasagreiningu með eyðublöðum sem
  skrifa og sýna R- eða Python-kóðann. Tímaraðaaðgerðir í Vinna (tímabil, breyting, vísitala, hlaupandi meðaltal, árstíðaleiðrétting), og aðhvarf má
  vista og nota sem uppskriftarskrefið Spá (sjá [statistik.md](statistik.md)).
- **Söfnun á vettvangi**: eyðublað byggt á dálkum og reglum gagnasafns er sent í Dataspatium Mobil. Síminn safnar röðum án nets, með mynd og staðsetningu, og
  raðirnar koma aftur sem ný útgáfa. Myndirnar verða að myndasafni og staðsetningarnar lenda á kortinu (sjá [insamling.md](insamling.md)).
- **Yfirferð allrar skrárinnar**: það sem deilt er er yfirfarið í heild, með samfelldum texta, upprunaskrám, staðsetningu mynda, leggjum neta og athugasemdum. Hamirnir fylgja einnig tegund gagnasafns betur: leitarniðurstöður
  opnast þar sem þær eru og kort eru aðeins boðin þegar gildin eru í raun hnit (sjá [dela.md](dela.md)).
- **Hamirnir fylgja gagnasafninu**: forritið sýnir hvað einnig má nota gagnasafn sem og segir hvers vegna, opnar Greina í réttu verkfæri og sýnir hvað er vert að athuga. Val fylgir milli hama og útflutningur segir hvað fylgir með (sjá [lagen.md](lagen.md)).
- **Leitað og teiknað eftir innihaldi gagnasafnsins**: leitaðu eftir stað, finndu hnúta í gegnum leggi sína og einingar í gegnum eiginleika sína, sjáðu myndir á kortinu og teiknaðu myndrit út frá leggjum, eiginleikum og magni (sjá [soka.md](soka.md)).
- **Sækja og Umsjón fylgja skránni**: forritið segir hvað skrá er, sýnir hana á sínu formi og spyr um hnit, hnitakerfi og tengsl. Blandaðar möppur eru flokkaðar, og Umsjón sýnir mynd fyrir hvert gagnasafn (sjá [lagen.md](lagen.md)).
- **Vinna fylgir gagnasafninu**: gerðu athugasemd við síðu, mynd, hnút eða stað, leiðréttu texta, gefðu myndum stað, gerðu við rúmfræði, finndu tvítekningar í netum og flokkaðu einingar (sjá [bearbeta.md](bearbeta.md)).
- **Leita og Greina fylgja gagnasafninu**: spyrðu um eiginleika, nágranna eða stað, byrjaðu á kóða skrifuðum fyrir gagnasafnið, sjáðu þróun í tímaröð og teldu staði eftir svæði (sjá [soka.md](soka.md)).
- **Myndgera fylgir gagnasafninu**: tillögur með raunverulegum myndum fyrir hverja tegund, krosssíur í mælaborðum og sniðmátsorð sem setja kort, net, líkan eða skipulag í skjal (sjá [visualisera.md](visualisera.md)).
- **Flytja út fylgir gagnasafninu**: KML, GPX og GeoPackage fyrir staði, yfirlitsblað fyrir myndir, skipulagskort og ákvæði fyrir skipulög, magn í Excel og glTF fyrir líkön, PDF fyrir teikningar (sjá [lagen.md](lagen.md)).
- **Deila fylgir gagnasafninu**: veldu hvort skrárnar fylgi í pakka, gerðu gagnasafn að eigin síðu til að senda, og sjáðu hverja tegund á eigin formi í símanum (sjá [dela.md](dela.md)).
- **Kóðalistar, lýsingar og leiðbeiningar**: merkingar úr SNI, SSYK, NACE og öðrum listum með smelli, gagnapakkar, DCAT-AP-SE, gæðayfirlýsing og fjórar leiðbeiningar með raunverulegum gögnum (sjá [lagen.md](lagen.md)).
- **Texti úr myndum**: skannaðar PDF-skrár, myndir og myndir af töflum eru lesnar með textagreiningu í vafranum, á öllum sex tungumálunum.
- **Uppruni, samvinna og safn**: sjáðu hvaðan gagnasafn kemur og hvað það hefur orðið að, vinndu saman í gegnum GitHub án þess að neitt tapist, sæktu uppskriftir og sniðmát með leyfi og birtu vinnusvæðið sem vefsvæði.
- **Kontroll sem CDE, 1. hluti**: sæktu líkön og skjöl úr verkefni OpenCDE-þjóns, sjáðu hvenær nýrri útgáfa er til, og sjáðu málin sem vísa á byggingarhluta líkansins.
- **Kontroll sem CDE, 2. hluti**: búðu til mál úr merkingunni í líkaninu með sýnina sem viewpoint, skrifaðu athugasemdir og breyttu stöðu, sendu gagnasöfn og skrár til þjónsins, BCF-skrár inn og út, og sjálfskráning gegn þjónum sem leyfa það.
- **Kontroll sem CDE, 3. hluti**: litaðu líkanið eftir stöðu mála, vistaðu málin sem töflu með byggingarhlutunum, verkfærið Mál, mælaborðið Staða mála, upphafskóði fyrir Cypher gegn IFC-grafi Kontroll og vinnusvæðispakkar í gegnum þjóninn.
- **Skráning CDE-kalla**: kortið Skrá í OpenCDE-uppsprettunni sýnir hvert kall með API, aðgerð, stöðu og tíma, skýrir aðgerðina og afritar hana sem curl; X-Request-Id er parað við skrá þjónsins.
- **Létt ræsing**: stórir hlutar eins og R og Python hlaðast fyrst þegar þeir eru notaðir, og stöðustikan sýnir hvað hleðst á meðan.
- **Samræming við Kontroll, 1. skref**: forritið les getuskjal þjónsins, þýðir villukóða hans, ber sameiginlegt orðasafn á sex tungumálum og opnar uppsprettu úr tenglinum Opna í Dataspatium.
- **Myndgera**: myndrit með Vega-Lite (þar með talið þemakort og punktakort, föst ásamörk, lograkvarði, viðmiðunarlínur og leitnilínur), D3-sniðum eða R, flutt út sem SVG, PNG, PDF og
  PowerPoint, líka í hópkeyrslu eftir hópum, og mælaborð með sameiginlegum síum sem verða HTML eða PowerPoint (sjá
  [visualisera.md](visualisera.md)).
- **Skjalfesta**: skýrslur og kóðabækur úr sniðum sem HTML, Word, PDF, Markdown eða LaTeX, líka eitt skjal fyrir hvert
  sveitarfélag eða ár (sjá [dokumentmallar.md](dokumentmallar.md)).
- **Flytja út og deila**: gögn í CSV, Excel, ODS, JSON, GeoJSON, XML, SQLite, Parquet, SPSS, Stata og RDS; í hamnum
  *Deila* pakka með völdum gagnasöfnum og hlutum ásamt skilaboðum og breytingaskrá, samstillingu við GitHub-safn,
  deilivalmynd tölvunnar og birtingu mælaborða og skjala sem sjálfstæðra HTML-skráa (sjá [dela.md](dela.md)); beinan
  flutning í síma og aðrar tölvur á sama neti með QR-kóða og staðfestingarkóða, og *Dataspatium Farsíma*, sem tekur á
  móti, sýnir og sendir áfram í símanum (sjá [mobil.md](mobil.md)); yfirferð persónuupplýsinga áður en nokkru er
  deilt; athugasemdir við gagnasöfn og dálka, afrit af vinnusvæðinu sem ZIP og, í Edge og Chrome, færanlega möppu með
  venjulegum skrám.
- **Halda röð og reglu**: möppur og merki fyrir gagnasöfn, síun og röðun, og hópaðgerðir á fleiri gagnasöfn í einu
  (raða, pakka, flytja út, sækja aftur, keyra uppskrift, eyða).
- **Finna hratt**: hamurinn *Leita* leitar í öllum dálkum í einu eða öllum gagnasöfnum, með flokkum sem afmarka og
  vistuðum listum (sjá [soka.md](soka.md)); skipanaspjaldið (Ctrl+K) skiptir um ham, opnar gagnasöfn, myndrit og
  mælaborð og keyrir aðgerðir úr einum leitarreit.
- **Fyrirspurn án kóða**: flipinn *Fyrirspurn* í Leita tengir gagnasöfn, velur dálka og útreikninga, setur skilyrði
  og sýnir þá SQL sem verður til; vistaðir listar afmarka töfluna í Vinna og raðir myndrita.
- **Hjálp í forritinu og kynning**: öll handbókin með leit opnast með ? eða F1 við kaflann fyrir haminn sem þú ert
  í, og **Kynna** sýnir mælaborð í öllum glugganum eitt myndrit í einu.
- **Sex tungumál**: viðmót, skilaboð og skjölun á sænsku, dönsku, norsku (bókmáli), finnsku, íslensku og ensku.
- **Grunnnámskeið**: gagnvirk yfirferð yfir alla átta hamina með sýnigögnum, á öllum sex tungumálunum. Það birtist í
  fyrsta skipti sem forritið er opnað og má opna hvenær sem er úr hjálpinni eða af skipanaspjaldinu.

## Dataspatium og Kontroll

Dataspatium (forritið í vafranum) og [Kontroll](https://github.com/marwiss/Kontroll) (þjónn fyrir OpenCDE-API buildingSMART: Foundation, BCF og Documents)
eru þróuð til að vinna saman sem biðlari og þjónn. Forritið bætir þjóninum við sem uppsprettu í Sækja, skráir sig inn með OAuth2 og
skráir sig sjálft sem biðlara þegar þjónninn leyfir það, sækir líkön og skjöl verkefnisins, les og skrifar mál með viewpoints úr
3D-sýninni, sendir gagnasöfn, skrár og vinnusvæðispakka aftur í gegnum Documents API, spyr IFC-graf þjónsins með Cypher og skráir
hvert kall með sama X-Request-Id sem þjónninn skrifar í eigin beiðnaskrá. Fyrirspurnirnar í grafið og stjórnunin eru viðbætur utan forskriftanna; allt annað fer í gegnum þrjú OpenCDE-API, svo aðrir
OpenCDE-biðlarar virka einnig. Þjónninn er ekki nauðsynlegur fyrir annað í forritinu: án þjóns virkar allt annað eins og áður. README Kontroll og `docs/client-guide.md` lýsa samstarfinu frá hlið þjónsins; hér er því lýst í
[kallor.md](kallor.md) og [cad-bim.md](cad-bim.md).

## Lærðu meira

Skráarheitin eru þau sömu á öllum tungumálum (sænsku frumheitin), svo tenglar virka eins alls staðar.

- **Handbókin** í forritinu: sömu skjölun og hér, með leit; opnaðu hana með ? efst til hægri eða F1.
- **Grunnnámskeiðið** í forritinu: gagnvirk yfirferð yfir alla hami með sýnigögnum; opnaðu það úr hjálpinni (?) eða
  með Ctrl+K.
- [Hafist handa](kom-igang.md): skref fyrir skref með algengum spurningum.
- [Notendahandbók](anvandarguide.md): allt vinnuferlið frá skrá til skýrslu.
- [Algengar spurningar](faq.md): geymsla, öryggi, R, vefþjónustur og uppfærslur.
- [Hamirnir átta](lagen.md): hvað er hvar og hvers vegna.
- [Leita](soka.md) og [Deila](dela.md): finna án kóða, og gefa öðrum gögn.
- [Dataspatium Farsími](mobil.md): síminn sem sendill, viðtakandi og skoðari; flutningur milli tækja.
- [Minnisbók](anteckningsbok.md): texti, R og SQL í reitum sem verða að skýrslu.
- [Skjöl og myndir](dokument.md): PDF, Word, OpenDocument, Markdown og myndir sem gagnasöfn; skjalasýn, myndasafn og tólin Texti og Myndir.
- [Kort](kartor.md): kortið í Vinna, kortasýnir í Myndgera, landfræðitólin og QGIS-verkefni.
- [Reglulegar segðir](regex.md): mynstur til að greina, leiðrétta og skipta upp texta í gagnasöfnum.
- [Snið og innflutningur](format.md): skráarsnið, stafakóðun, tugabrotstákn, dagsetningar og dálkgerðir.
- [Opnar vefþjónustur](api-konfiguration.md): forstilltir upprunar, lyklar og eigin uppsetningar.
- [R í Dataspatium](r-guide.md): R-stjórnborðið, `dm_read()`, `dm_write()` og meðfylgjandi pakkar.
- [Python í Dataspatium](python.md): Python-stjórnborðið, `dm_read()`, `dm_write()` og pakkar sem eru sóttir eftir þörfum.
- [Myndgera](visualisera.md): myndritasmiðurinn, D3-snið, R-myndrit, kort og mælaborð.
- [Skjöl og snið](dokumentmallar.md): sniðmálið og úttakssniðin.
- [Leyfi](licenser.md): hvað þú mátt gera með forritið og hvaða leyfi íhlutir þriðja aðila hafa.
- [Þróun](../utveckling.md), [Högun](../arkitektur.md) og [Stílleiðbeiningar](../stilguide.md) fyrir þau sem vilja skilja
  kóðann (á sænsku); hvernig framlögum er tekið kemur fram í [CONTRIBUTING.md](../../CONTRIBUTING.md) (á sænsku).
- Ytri upprunar: [WebR](https://docs.r-wasm.org/webr/latest/), [R fyrir byrjendur](https://www.r-project.org/),
  [Vega-Lite](https://vega.github.io/vega-lite/), [opin gögn Hagstofu Íslands](https://hagstofa.is/).

## Takmarkanir í stuttu máli

- Opna þarf forritið úr afþjappaðri möppu (file://) eða venjulegum vefþjóni; það virkar ekki beint inni í ZIP-skrá.
- Vefþjónustur án CORS-stuðnings er ekki hægt að kalla beint úr vafranum.
- Gagnasafn ætti að vera undir nokkrum milljónum raða; minni vafrans setur mörkin.
- Þegar forritið er opnað úr möppu er ekki hægt að stöðva R-kóða í miðjum útreikningi; notaðu *Endurræsa R*. Af
  vefþjóni (localhost eða https) er hnappurinn *Stöðva* til staðar.
- Fleiri flipar virka og halda hver öðrum upplýstum, en breyttu ekki sama gagnasafni í tveimur flipum samtímis: sá sem vistar
  síðast vinnur.
- Færanlega mappan krefst Edge eða Chrome; Firefox hefur ekki möppuaðgang (File System Access). Afrit sem ZIP virkar alls
  staðar.
- Allt forritið er gert fyrir tölvur; í símum og spjaldtölvum er Dataspatium Farsími notaður
  (<https://marwiss.github.io/Dataspatium/m/>), sem tekur á móti, sýnir og sendir áfram. Safari er ekki stutt fyrir
  allt forritið. Í þröngum gluggum opnast spjöldin sem yfirlagsspjöld yfir vinnuflötinn.
- Meðfylgjandi sýnigögn og kortamörk eru sænsk; forritið sjálft virkar með gögn hvaðan sem er.

## Villur og tillögur

Tilkynntu villur eða óskir sem *Issues* hér á GitHub. Lýstu vafranum, útgáfu Dataspatium (birtist undir hjálparhnappnum) og
hvað þú gerðir. Sjá [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Þróun

- Ekkert smíðaskref, ekkert node.js. Opnaðu `index.html` beint eða berðu möppuna fram með `python -m http.server 8080`.
- Íhlutir þriðja aðila: `python tools/fetch_vendor.py` og síðan `python tools/wrap_assets.py`.
- Prófanir: `powershell -File tools/run-tests.ps1` (headless Edge og Firefox). Sjá [utveckling.md](../utveckling.md) (á
  sænsku).

## Leyfi

Eigin kóði Dataspatium, skjölun og forstillingar (allt nema `vendor/`) eru með leyfið
[PolyForm Strict 1.0.0](../../LICENSE): frjálst að hlaða niður og nota í óviðskiptalegum tilgangi, líka hjá stjórnvöldum og
öðrum opinberum stofnunum, en ekki að breyta, byggja á eða dreifa áfram án skriflegs leyfis. Leyfisveitandi er höfundur
Dataspatium, sem næst í gegnum GitHub-aðganginn [marwiss](https://github.com/marwiss); stofnaðu issue fyrir aðra skilmála.
Hvað leyfið þýðir í reynd er útskýrt í [licenser.md](licenser.md).

Íhlutir þriðja aðila í `vendor/` hafa sín eigin leyfi (MIT, BSD, Apache-2.0, ISC, OFL, MPL, LGPL og GPL), sjá
[THIRD_PARTY_LICENSES.md](../../THIRD_PARTY_LICENSES.md). R og GPL-leyfðir R-pakkar eru dreifðir óbreyttir; frumkóðinn fæst hjá
[R-verkefninu](https://cran.r-project.org/sources.html), [webR](https://github.com/r-wasm/webr) og
[CRAN](https://cran.r-project.org/) í þeim útgáfum sem þar eru tilgreindar.
