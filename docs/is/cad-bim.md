# CAD og BIM: byggingarlíkön og teikningar

Dataspatium opnar byggingarlíkön í IFC og teikningar í DXF sem sérstaka tegund gagnasafns. Líkanið er teiknað í þrívídd,
byggingarhlutarnir verða að töflu og hægt er að leita í eiginleikum og magni, reikna það og flytja út. Allt gerist í
vafranum: skráin fer aldrei úr tölvunni. Upprunalega skráin er vistuð í gagnasafninu og fylgir pökkum og öryggisafritum.

## Að opna líkan

Slepptu `.ifc`-, `.ifczip`- eða `.dxf`-skrá í Sækja. Upplýsingar um skrána birtast (skema, verkefni, forrit, hæðir og fjöldi
eftir gerð) og *Flytja inn* býr til gagnasafnið. IFC2X3, IFC4 og IFC4X3 á STEP-sniði eru studd. Innflutningur um 50 MB líkans
tekur um fjórðung úr mínútu og það opnast síðan á nokkrum sekúndum.

## Stór líkön frá þjóninum

Líkan sem er of stórt til að lesa í vafranum má sækja frá Dataregium án IFC-skrárinnar. Í skráalista gagnalindarinnar undir *Sækja →
OpenCDE* hefur líkan hnappinn **Stórt líkan** þegar þjónninn hefur rúmfræði-API (`ifc_geometry`). Veldu smáatriðastig: *Öll rúmfræðin*
gefur net byggingarhlutanna, *Kassar á byggingarhluta* aðeins einn kassa hver fyrir skjótt yfirlit. Forritið sækir rúmfræðina sem
tvíundar-glTF, les hana í bakgrunnsþræði og býr til líkansgagnasafn með einni línu á byggingarhluta (auðkenni, GlobalId, flokkur, nafn og
hæð úr nefndum fyrirspurnum þjónsins). Rúmfræðin er geymd með gagnasafninu, svo að þrívíddarsýnin, auðkenning, val og mál virka eins og
fyrir líkan úr skrá. Eiginleikar og magn fylgja ekki með, og það sem þarf IFC-skrána, eins og árekstraprófun forritsins og útflutningur
frumritsins, vantar; árekstraprófun og fyrirspurnir þjónsins virka sem fyrr. Spjaldið í Umsjón sýnir *Rúmfræði: Frá þjóninum*.

## Líkanið í Vinna

Líkanið opnast sem þrívíddarsýn með töflu yfir byggingarhlutana fyrir neðan. Dragðu til að snúa, skrunaðu til að þysja
að bendlinum og dragðu með hægri hnappi eða með Shift til að færa; á snertiskjá snýr einn fingur og tveir klípa og færa.
Tvísmelltu á byggingarhluta til að snúa um nákvæmlega þann punkt. Ramminn sýnir allt sem er sýnt; stakir hlutir langt frá
byggingunni eru ekki taldir með. Fleiri leiðir til að skoða líkanið eru undir [Sýnir og lyklaborðið](#sýnir-og-lyklaborðið).

- **Velja**: smelltu á byggingarhluta í líkaninu eða röð í töflunni. Valið fylgir og skoðarinn sýnir gerð, hæð, efni, flokkun,
  eiginleika og magn, ásamt yfirborði og rúmmáli mældu á rúmfræðinni.
- **Sía**: veldu gerð eða hæð, eða leitaðu að heiti, efni eða eiginleika. Taflan og líkanið sýna sama úrval.
- **Sýna sem töflu**: allir dálkar sem venjuleg tafla með öllum verkfærum í Vinna.
- **Vista sem graf**: sýnin með síu og sjónarhorni verður að grafi í Myndgera.

Rúmfræðin er reiknuð úr upprunalegu skránni í fyrsta sinn sem líkanið opnast í lotu og er aðeins notuð til að teikna og mæla.
Töflurnar eru áfram til þótt tölvuna vanti WebGL; þá birtast skilaboð í stað þrívíddarsýnarinnar.

### Sýnir og lyklaborðið

- **Sýnarkubburinn** í horninu snýst með líkaninu. Smelltu á hlið til að sjá líkanið ofan frá, framan frá, frá hægri, aftan frá,
  frá vinstri eða neðan frá, og á hnappinn undir kubbnum til að sjá það á ská ofan frá. Framan frá horfir eftir Y-ás líkansins,
  það er til norðurs þegar líkanið er teiknað með norður upp. Sýnirnar sýna það sem sían sýnir.
- **Hornrétt sýn**: hnappurinn með ferningnum skiptir á milli fjarvíddar og hornréttrar sýnar, þar sem byggingarhlutar minnka
  ekki með fjarlægð. Ofan frá verður þá grunnmynd og framan frá útlitsmynd. Myndrit og viewpoint muna hvaða sýn það var.
- **Snið**: hnappurinn með lögunum opnar sniðið í skoðaranum. Dragðu sleðana fyrir austur–vestur, suður–norður og hæð til að skera
  burt það sem er utan kassa, eða veldu hæð undir *Snið við hæð* til að sjá hana frá gólfi upp í 1,2 m sem grunnmynd. *Fjarlægja
  sniðið* sýnir allt aftur. Sniðið fylgir myndriti og viewpoint, og viewpoint úr öðru forriti sýnir sitt snið.
- **Þysja að merktu** sýnir merktu byggingarhlutana, og **Sýna aðeins merkt** felur allt annað svo að þú getir snúið í kringum
  þá; smelltu aftur til að sýna allt.
- **Lyklaborðið** virkar þegar þrívíddarsýnin hefur fókus: smelltu í hana eða farðu þangað með Tab.

| Lykill | Gerir |
|---|---|
| Örvarnar | færa sýnina |
| Ctrl eða Shift og örvarnar | snúa |
| + og − | þysja |
| F | þysjar að merktu |
| Home | sýnir allt |
| 1–7 | ofan frá, framan frá, frá hægri, aftan frá, frá vinstri, neðan frá, á ská ofan frá |
| O | skiptir um hornrétta sýn |

## Mál frá CDE

Líkan sem sótt var frá OpenCDE-þjóni, eða hvaða líkan sem er þegar slíkur þjónn er gagnalind, getur sýnt málin sín:
hnappurinn *Mál* í líkansýninni opnar spjald í skoðaranum með BCF-málum verkefnisins. Þau sem vísa á byggingarhluta í þessu
líkani koma fyrst, með stöðu og fjölda byggingarhluta. Smelltu á mál, þá eru byggingarhlutarnir merktir í 3D-sýninni og
spjaldið sýnir lýsingu, skyndimynd og athugasemdir. Málin eru sótt þegar þú biður um það og eru ekki vistuð í gagnasafninu;
til að reikna með þeim vistar þú þau sem töflu í Sækja. Ef málið hefur viewpoint með myndavél fer sýnin þangað, í fjarvídd eða hornrétt og með sniði sínu.

Með réttindum til þess er einnig hægt að skrifa. *Nýtt mál* býr til mál á þjóninum með fyrirsögn, tegund, stöðu og merkjum úr
listum verkefnisins, og sýnin fylgir með sem viewpoint: myndavélin (í fjarvídd eða hornrétt) með sniðinu, skyndimynd og merktu byggingarhlutarnir sem íhlutir. Í völdu
máli getur þú skrifað athugasemd, breytt stöðu og bætt núverandi sýn við sem nýju viewpoint. *Vista sem BCF* gefur öll mál
verkefnisins með athugasemdum, viewpoints og skyndimyndum sem BCF-skrá, sem verkfæri án API geta opnað. BCF-skrá má einnig lesa
inn í Sækja: málin verða tafla, athugasemdir og íhlutir töflur við hliðina.

*Lita eftir stöðu* gefur byggingarhlutunum lit opnasta máls síns: rautt fyrir opin, gult fyrir í vinnslu, grænt fyrir lokuð, með
skýringum undir listanum. *Vista sem töflu* gefur mál verkefnisins sem töflu með einni línu á hvert mál og byggingarhluta (tegund,
nafn og hæð fylgja með), sem Umsjón þekkir sem mál: kortið *Mál* sýnir stöðuna og býr til mælaborðið *Staða mála* með stöðu, tegund,
ábyrgðaraðila, forgangi og mánuði á bak við sameiginlegar síur, og hnappurinn *Sýna í líkaninu* fer aftur í spjaldið. Verkfærið
*Mál* í flipanum Magn í Greina telur mál, opin mál og byggingarhluta eftir stöðu, tegund, forgangi, ábyrgðaraðila, tegund
byggingarhluta eða hæð úr slíkri töflu, og SQL-upphafskóðinn fær fyrirspurnir fyrir tengingina. *Vista sem rit* vistar sýnina með
litunum sem líkansrit, sem mælaborð, skjöl og Birta sýna með skýringum.

Net líkansins á þjóninum er teiknað og spurt úr *Sækja*, og hnappurinn *IFC-DB* (áður IFC-LPG) fer með þig þangað, sjá [grafer.md](grafer.md#ifc-db-á-dataregium-þjóni).

Líkan grafsins, venslin og fyrirspurnirnar frá hlið Dataspatium eru í [ifc-db.md](https://github.com/marwiss/Dataregium/blob/main/docs/is/ifc-db.md) hjá Dataregium.

### Svið málsins og líkanskráin

*Nýtt mál* tekur þau svið sem sænsk rýnivenja biður um, öll úr eigin listum verkefnisins: tegund og stöðu (alltaf stillt), forgang,
merki, ábyrgðaraðila, úthlutun, áfanga og skilafrest. BCF hefur ekkert sérstakt svið fyrir ábyrgðaraðila, svo honum er bætt við sem
merki. Skyndimyndin er í mesta lagi 1.500 dílar á lengstu hliðinni, eins og BCF segir. Þegar þjónninn leyfir tengir forritið málið
við líkanskrána (`PUT /topics/{guid}/files` í BCF API): með eigin færslu verkefnisins fyrir útgáfuna sem líkanið var sótt úr, og
annars með nafni skrárinnar, tímastimpli og IfcProject úr haus IFC-skrárinnar.

### BCF-skrár

Forritið skrifar BCF-skrár sem BCF-XML 3.0, snið buildingSMART fyrir mál:

- Hvert mál hefur tegund og stöðu, titil, dagsetningu og höfund. Án tegundar eða stöðu verða þau Issue og Open. Höfundurinn er
  aðgangurinn þinn á þjóninum þegar þú ert innskráð(ur), annars nafnið sem þú hefur gefið fyrir athugasemdir (*Nafn þitt*), annars
  Dataspatium; forritið býr aldrei til nafn.
- Athugasemdir og viewpoints eru inni í málinu, og merki, tenglar, skjalatilvísanir og tengd mál eru í sínum listum. Skráin hefur
  `extensions.xml` með þeim tegundum, stöðum, forgangsstigum, merkjum, úthlutunum og áföngum sem hún notar.
- Haus hvers máls nefnir líkanskrána: nafnið úr haus IFC-skrárinnar, tímastimpil skrárinnar og GlobalId IfcProject, og vistfangið
  fyrir líkan af þjóni.
- Skyndimyndir eru í mesta lagi 1.500 dílar á lengstu hliðinni; stærri mynd er teiknuð aftur í þeirri stærð.
- Skjöl, eins og ljósmyndir gervigreindarprófunarinnar, eru í möppunni Documents og skráð í `documents.xml`.

Forritið les BCF 3.0 og 2.1 úr öðrum forritum og eigin eldri skrár. Athugasemdir, viewpoints með myndavél og sniði, skyndimyndir,
valdir, faldir og litaðir íhlutir og skjöl fylgja með. Lestu BCF-skrá inn í Sækja: málin verða tafla með athugasemdum og íhlutum í
töflum við hliðina, og skráin er vistuð með málunum svo að myndirnar og sýnirnar haldist.

### Rýni samkvæmt sænskri venju

Í sænskri venju við rýni líkana með BCF hefur mál eina af sex stöðum. Forritið þekkir þær í eigin stöðulista verkefnisins og gefur
þeim sömu liti og öðrum stöðum:

- *Ny kommentar* (ný athugasemd) telst opin, eins og Open.
- *Ska åtgärdas* (á að laga) og *Ny granskning* (ný rýni) teljast í vinnslu, eins og In progress: málið á að laga, eða það er tekið upp
  í næstu rýni.
- *Har åtgärdats* (lagað), *Avvisad* (hafnað) og *Godkänd* (samþykkt) teljast lokið: lagað eins og Resolved, hin tvö eins og Closed.

Stöðurnar eru aðeins notaðar þegar verkefnið á þjóninum hefur þær í lista sínum; forritið býður þær ekki fram sjálft.
Dataregium-verkefni hefur Open, In progress, Resolved og Closed sjálfgefið, sem svara til þeirra eins og að ofan. Í Dataregium
stillir stjórnandi stöðulista verkefnisins (`topic_status`) á síðu verkefnisins undir `/admin`. Hnappurinn *Använd Praxis statusar*
(nota stöður Praxis) á sama stað setur sex stöðurnar hér að ofan í listann og lætur aðra lista verkefnisins óbreytta. Svið rýnimáls
eru í *Nýtt mál* og undir *Fleiri valkostir* í gervigreindarprófuninni: titill, lýsing, staða, úthlutun, ábyrgðaraðili (sem merki),
áfangi og skilafrestur, og rýnandinn er sá sem er innskráður.

## Töflurnar

| Tafla | Innihald |
|---|---|
| `data` | Ein röð fyrir hvern byggingarhluta, rými og hæð: id, guid, typ (gerð), kategori (byggdel, rum, struktur), namn (heiti), beskrivning, objekttyp, tagg, vaning (hæð), typnamn, material, klassificering, egenskaper (eiginleikar) og mangder (magn) sem JSON |
| `_properties` | Ein röð fyrir hvern eiginleika: id, uppsattning (mengi), namn, varde (gildi), tal, enhet (eining), kalla (objekt eða typ) |
| `_quantities` | Ein röð fyrir hvert magn í SI-einingum: id, uppsattning, namn, varde, slag (langd, area, volym, vikt, tid, antal), enhet |
| `_entities` | Einingar skrárinnar sem ekki eru rúmfræði, með hráum eigindum: id, typ, attribut |

Eiginleikar sem aðeins eru á gerð byggingarhlutans eru taldir með og merktir `typ`. Magn er umreiknað í metra, fermetra,
rúmmetra og kílógrömm með einingum verkefnisins. Op og tengitengi eru ekki byggingarhlutar og finnast aðeins í `_entities`.

Hægt er að spyrja töflurnar með SQL í Greina:

```sql
SELECT d.vaning, d.typ, count(*) AS antal, sum(q.varde) AS volym
FROM data d JOIN _quantities q ON q.id = d.id
WHERE q.namn = 'NetVolume'
GROUP BY 1, 2 ORDER BY 1, 2
```

Í R og Python gefur `dm_read()` byggingarhlutana, `dm_read_properties()` eiginleikana og `dm_read_quantities()` magnið.

## Flipinn Magn í Greina

- **Samantekt**: upplýsingar um skrána og innihald hennar.
- **Magn**: fjöldi, lengd, flatarmál, rúmmál og þyngd flokkað eftir gerð, hæð, efni, heiti gerðar eða flokkun. Heimildin
  *Magn skrárinnar* tekur eitt gildi á hvern byggingarhluta og tegund: nettó á undan öðrum og brúttó síðast, svo að veggur sé
  ekki talinn tvisvar. Heimildin *Mælt á rúmfræðinni* reiknar á þríhyrningunum og virkar einnig þegar skrána vantar magn.
  Yfirborðið er þá allt yfirborð byggingarhlutans, ekki til dæmis hliðarflatarmál veggjar.
- **Magnlisti**: hvert magnheiti í skránni eftir gerð, með summu. Hér sérðu nákvæmlega hvað skráin segir.
- **Eiginleikar**: hvaða gildi eiginleiki hefur og á hve mörgum byggingarhlutum af hverri gerð.
- **Einingar**: úr hve mörgum einingum af hverri tegund skráin samanstendur.
- **Loftslagsyfirlýsing**: bráðabirgðaloftslagsyfirlýsing út frá líkaninu eftir flokki og lagi, sjá *Bráðabirgðaloftslagsyfirlýsing* hér fyrir neðan.
- **Efnisúttekt**: grunnur að úrgangsstjórnunaráætluninni úr líkaninu, með byggingarvörum sem má endurnota, úrganginum eftir flokkum
  og lögum og þeim hættulegu efnum sem líkanið tilgreinir, sjá *Efnisúttekt fyrir úrgangsstjórnunaráætlun* hér fyrir neðan.

Hægt er að vista hverja niðurstöðu sem gagnasafn.

## IfcOpenShell í forritinu

Forritið getur lesið, sannprófað og breytt IFC-líkönum með IfcOpenShell, sama safni sem Dataregium byggir á. Það
keyrir í Python í vafranum, er sótt í fyrsta sinn sem það er notað (um 13 MB, eftir samþykki þitt fyrir íhluti) og síðan vistað í
vafranum. Engu er sent neitt; líkanið fer ekki af tölvunni.

**Í Greina, flipanum Magn**, hefur IFC-líkan fimm verkfæri til viðbótar:

- **Sannprófun** sannprófar líkanið gegn IFC-skema sínu: eigindi, tegundir og tilvísanir, valfrjálst einnig reglur skemans.
  Niðurstöðurnar má vista sem gagnasafn.
- **Rýmisskipan** sýnir verkefni, lóð, byggingu, hæðir og rými sem tré með fjölda eininga í hverjum hluta.
- **Eiginleikasöfn** gefur öll eiginleikasöfn einingartegundar sem breiða töflu: eina röð á einingu, einn dálk á eiginleika
  (`Safn.Eiginleiki`), valfrjálst einnig magnsöfnin.
- **IFC-val** sækir einingar með valmáli IfcOpenShell, til dæmis `IfcWall, Pset_WallCommon.FireRating=EI60` eða
  `IfcElement, material=Steypa`.
- **Rúmfræðimál** mælir rúmmál, yfirborð og umlykjandi kassa á einingu á rúmfræðinni (OpenCASCADE). Hægt fyrir stór líkön.
- **IDS-prófun** prófar líkanið gegn IDS-skrá (buildingSMART Information Delivery Specification) með ifctester,
  eigin prófara IfcOpenShell: veldu .ids-skrána og þú færð eina röð á kröfu og einingu með stóðst, féll eða á ekki við og
  ástæðunni, auk samantektar. Skráin verður í vafranum. ifctester fylgir forritinu án vefforrits síns, svo ekkert er sótt umfram
  Python sjálft.
  Undir *IDS í forritinu* velur þú í staðinn eina af IDS-skrám forritsins, til dæmis *Avfallshantering* (sjá *Efnisúttekt fyrir
  úrgangsstjórnunaráætlun*), sem er prófuð á sama hátt; *Vista IDS-skrána* vistar þá völdu á tölvunni.

**Í Vinna** hefur líkanið tvær aðgerðir undir *Aðgerðir* (hnappurinn er bæði í líkansýn og töflusýn), í hópnum *Líkan*:

- **Skrifa töflu í líkanið** skrifar gildi töflu inn í líkanið. Raðir eru paraðar á GUID; dálkarnir `Name`, `Description`,
  `ObjectType` og `Tag` (eða `namn`, `beskrivning`, `objekttyp`, `tagg`) verða eigindi, og dálkar eins og
  `Pset_WallCommon.FireRating` verða eiginleikar (safnið er búið til ef það vantar). Vinnulagið: vista *Eiginleikasöfn* sem
  gagnasafn, breyta því í Vinna og skrifa til baka.
- **Python á líkanið** keyrir fallið `step(model)` með API IfcOpenShell á allt líkanið.

Bæði eru skref í uppskriftinni: breytta líkanið verður nýtt innihald gagnasafnsins (upprunalegu skránni er skipt út og töflurnar
byggðar upp á nýtt), skrefið er skráð og hægt að afturkalla, og upprunalega skráin er alltaf núverandi útgáfa þegar þú flytur
líkanið út eða sendir það til CDE.

**Í Python** (Python-flipinn í Greina og kóðareitir í glósubókinni) opnar `dm_ifc("heiti")` líkanið sem `ifcopenshell.file`.
Hjálparföllin `dm_ifc_elements`, `dm_ifc_psets`, `dm_ifc_tree`, `dm_ifc_validate`, `dm_ifc_select` og `dm_ifc_geometry` gefa
töflur, `dm_ifc_set(model, df)` skrifar töflu inn í líkanið og `dm_ifc_write(model, "heiti")` sendir líkanið til forritsins sem
nýtt gagnasafn; sjá [Python í Dataspatium](python.md). Verkfærin í Greina og Python breyta gagnasafninu aldrei; aðeins
aðgerðirnar í Vinna gefa nýja útgáfu.

IfcOpenShell er LGPL-3.0 og er sótt óbreytt sem fest wheel-skjöl úr skrá IfcOpenShell sjálfs, sjá [Leyfi](licenser.md).

## Sannprófa líkanið

Spjaldið **Sannprófa líkanið** í Umsjón safnar saman prófunum á IFC-líkani, með nýjustu niðurstöðu hverrar.

- **Prófun þjónsins** er til fyrir líkan sem sótt var sem skjalaútgáfa úr CDE. Dataregium (frá 3.0.0) prófar hverja IFC-skrá sem er
  hlaðið upp gagnvart IFC-skemanu og, þegar þjónninn hefur þær uppsettar, gagnvart reglum buildingSMART (ifc-gherkin-rules), og setur
  niðurstöðuna í lýsigögn útgáfunnar. *Sækja prófun þjónsins* les hana: ekkert fannst, aðeins viðvaranir, niðurstöður með villum, bíður
  eftir prófun eða ekki tókst að prófa, og hvenær og með hvaða reglum. Forritið spyr þjóninn ekki fyrr en þú ýtir á hnappinn. Séu
  niðurstöður sýnir *Sýna niðurstöðurnar* skýrslu þjónsins: fjölda niðurstaðna og villna, hvaða prófanir voru gerðar og hvaða reglur
  ekki tókst að keyra, og hverja niðurstöðu með reglu sinni, tilviki sínu (`#123`) og GlobalId einingarinnar. *Merkja í líkaninu*
  merkir síðan einingarnar í líkanasýninni í Vinna, og *Vista sem töflu* vistar niðurstöðurnar sem töflu með dálkunum `kind`, `rule`, `severity`, `message`, `step_id`, `global_id` og
  `attribute`. Skýrslan er sótt með sömu innskráningu frá vistfangi sem forritið býr sjálft til á sama þjóni; vistfangi úr lýsigögnum
  er aldrei fylgt.
- **IDS-skrár verkefnisins**: athugi þjónninn skrána einnig gagnvart IDS-skjölum verkefnisins (nýjustu útgáfu hvers skjals sem endar á
  `.ids`), sýnir skýrslan hve margar forskriftir voru samþykktar, ekki samþykktar eða áttu ekki við skrána, og hverjar voru ekki samþykktar,
  með heiti skjalsins og fjölda niðurstaðna. IDS-skjal sem ekki var hægt að lesa er meðal reglnanna sem ekki var hægt að keyra.
- **Það sem ekkert GlobalId nær til**: finni prófun þjónsins graph tilvik sem ekkert með GlobalId nær til, sýnir skýrslan hnappinn
  *Fjarlægja það sem ekkert GlobalId nær til*. Þjónninn leggur þá til, eftir staðfestingu þína, breytingasett sem fjarlægir þau;
  tillagan verður mál sem er prófað og samþykkt eins og önnur, og útgáfan heldur öllu.
- **Prófanir hér** sýnir nýjustu *Sannprófun*, *IDS-prófun* og árekstraprófun sem keyrðar voru í forritinu, og hnapparnir opna þær í
  Greina. Niðurstöðurnar eru vistaðar í stillingum forritsins, ekki í gagnasafninu.

Niðurstöðurnar eiga við skrána eins og henni var hlaðið upp, og þjónninn stöðvar aldrei skrá vegna þeirra. Skrá þar sem allar
niðurstöður eru viðvaranir telst gild hjá sannprófunarþjónustu buildingSMART. Hafi þjónninn enga slíka prófun segir spjaldið að
þjónninn hafi ekki prófað útgáfuna.

## Verkefnissnið

Spjaldið **Verkefnissnið** í sýn gagnalindarinnar undir *Sækja → OpenCDE* sýnir snið valda verkefnisins: IDS-skjöl verkefnisins
(skrár með endingunni `.ids` meðal skráa verkefnisins) og bSDD-orðabækurnar sem þú hefur valið fyrir verkefnið, geymdar í þessum vafra
á hvern þjón og verkefni.

- **Skrifa IDS með gervigreind** skrifar Information Delivery Specification úr lýsingu með orðum. Veldu þjónustuveitanda, líkanið sem
  kröfurnar eru prófaðar gegn, og lýstu kröfunum. Gervigreindin afhendir forritinu skrána, sem prófar hana (fyrst formið, svo með
  ifctester gegn líkaninu, í Python í vafranum) og svarar með villunni sem þarf að laga eða niðurstöðunni á hverja forskrift. Það
  gengur umferð fyrir umferð þar til hægt er að keyra skrána, í mesta lagi fjórar umferðir, og kröfurnar eru aldrei mildaðar til að
  komast í gegn. Útkomuna má vista sem `.ids`-skrá eða hlaða upp í verkefnið sem skjali.
- **Leita í bSDD** flettir upp flokkum í buildingSMART Data Dictionary eftir samþykki fyrir hýsilinn `api.bsdd.buildingsmart.org`, í
  völdu orðabókunum eða öllum; *Orðabækur* sýnir orðabækurnar svo þú getir bætt þeim við sniðið. Í *Breyta með gervigreind* getur
  gervigreindin leitað með tólinu `search_bsdd` og flokkað byggingarhluta með `set_classification`, sem er skrifað sem
  `IfcClassificationReference` í breytingasettið sem þú samþykkir.
  `search_bsdd` leitar aðeins í frjálsum orðabókum þar sem leyfisskilmálarnir hafa verið lesnir (IFC 4.3, Uniclass 2015 og ETIM 10.1) og
  gefur upp orðabók og leyfi hvers flokks, og `set_classification` skrifar útgáfu, útgefanda og vefslóð kerfisins á `IfcClassification`
  þess.

buildingSMART-reglur þjónsins sjást á spjaldinu *Sannprófa líkanið* í Umsjón; veldu reglu í listanum við hlið *Merkja í líkaninu* til að
auðkenna aðeins byggingarhlutana sem sú regla hittir.

## Árekstraprófun

Verkfærið **Árekstrar** í Greina (flipinn Magn) finnur byggingarhluta sem ganga hver inn í annan eða koma of nálægt hver öðrum. Það
vinnur á sömu þríhyrningum og þrívíddarsýnin sýnir, í eigin þræði, og þarf hvorki Python né net.

- **Mengi A og mengi B** eru allir byggingarhlutar eða ein tegund, til dæmis loftstokkar gagnvart bitum. B getur verið í sama líkani
  eða í öðru líkani í sama verkefni, og þá þurfa líkönin að deila hnitakerfi. Op teljast ekki.
- **Á þjóninum**: fyrir líkan frá Dataregium (frá 3.0.0, þegar kveikt er á árekstraprófun þjónsins) velur *Hvar* hvort forritið
  reiknar sjálft eða þjónninn gerir sömu prófun á útgáfunum. Þjónninn vinnur í biðröð; forritið bíður og sýnir skýrsluna sem sína
  eigin, með sömu töflu, merkingu og BCF-skrá, og *Senda sem mál* lætur þjóninn búa til málin með einu viewpoint hvert. Hitt
  líkanið verður þá að vera útgáfa í sama verkefni.
- **Skurður** telur pör þar sem önnur einingin nær dýpra inn í hina en vikmörkin (2 mm nema annað sé gefið). Dýptin er mæld sem hve
  langt horn og brúnir ná inn í hina eininguna, svo fletir sem aðeins snertast teljast ekki. *Innilokun* er eining sem liggur öll inni
  í annarri.
- **Laus fjarlægð** telur pör sem eru nær hvort öðru en fjarlægðin (50 mm nema annað sé gefið), skurðir meðtaldir.

Niðurstaðan er tafla með auðkenni, GlobalId, tegund og heiti beggja eininga, tegund árekstrar, dýpt eða fjarlægð í millimetrum og punkt
í eigin hnitum líkansins. Þaðan:

- *Merkja í líkaninu* merkir einingarnar í líkanasýninni í Vinna.
- *Vista sem BCF* vistar eitt mál fyrir hvern árekstur í BCF-skrá, með sýn sem horfir á punktinn og báðar einingarnar merktar og
  litaðar. Myndavél og punktur eru í hnitum líkansins með Z upp, svo önnur BCF-verkfæri sýna sama stað.
- *Senda sem mál* býr til málin beint í verkefninu á þjóninum með BCF API, fyrir líkan sem sótt var úr CDE. Þar sjá allir biðlarar
  þau, til dæmis Bonsai.
- *Búa til gagnasafn* vistar töfluna.

Nýjasta niðurstaðan stendur á spjaldinu Sannprófa líkanið í Umsjón, með því hvort það var gert í forritinu eða á þjóninum. Mælingin gerir ráð fyrir lokuðum flötum: eining með opna eða
gallaða fleti getur gefið óvissa dýpt. Bognir fletir eru skipt í þríhyrninga, svo vikmörk undir millimetra verða óviss. Einingar sem þrívíddarsýnin getur ekki teiknað eru ekki með, og niðurstaðan segir hve margar þær eru; í sýnilíkani frá Tekla átti það við um allt bendistál.

## Bráðabirgðaloftslagsyfirlýsing

Tólið **Loftslagsyfirlýsing** í Greina (flipinn Magn) reiknar bráðabirgðaloftslagsyfirlýsingu út frá líkaninu: loftslagsáhrif fyrir
A1–A3, A4 og A5 í kg CO₂e eftir flokki og eftir lagi byggingarinnar. Hún er stuðningur við hönnunina, ekki yfirlýsing til skráningar
hjá Boverket.

**Flokkur og lag.** Hver byggingarhluti fær einn af fjórum flokkum Boverket (burðarhlutar – undirstöður, burðarhlutar – annað,
hjúpur, innveggir) eða *Ekki innifalið*, og eitt af sex lögum byggingarinnar samkvæmt skýrslu Boverket 2024:26: 1 lóð og undirstöður,
2 burðarkerfi og önnur burðarvirki, 3 hjúpur, þak og framhlið, 4 tæknikerfi, 5 loft, innveggir og yfirborð innanhúss, 6 fastar
innréttingar. Reglurnar lesa aðeins IFC-klasann, PredefinedType (byggingarhlutans eða gerðarinnar) og LoadBearing og IsExternal í
Pset_*Common; ekkert flokkunarkerfi er lesið. Þær fylgja lista Boverket yfir byggingarhluta sem eru innifaldir: staurar, jarðvinna,
tæknikerfi, fastar innréttingar, færanlegir innveggir, yfirborð innanhúss og sólarvörn eru ekki innifalin; stigar, skábrautir og
handrið eru burðarhlutar; loft, niðurhengd loft og innihurðir tilheyra innveggjunum. Dálkurinn *Regla* sýnir hvað réð.

- **Óviss**: byggingarhlutinn er innifalinn en flokkurinn óviss, til dæmis innveggur án LoadBearing eða hurð án IsExternal. Hann er
  talinn í flokknum sem sýndur er og birtist undir *Til ákvörðunar*. Útveggur er hjúpur óháð LoadBearing.
- **Ekki hægt að ákveða**: reglurnar geta ekki sagt hvort byggingarhlutinn er innifalinn, til dæmis staðgengilshlutur eða sólarsellur
  (sem eru aðeins innifaldar þegar þær eru felldar inn í þak eða framhlið). Hann er ekki talinn fyrr en þú hefur ákveðið hann.
- **Útleitt IsExternal**: þegar skráin tilgreinir ekki IsExternal fær hurð eða gluggi gildið frá veggnum sem hún eða hann situr í.
  *Leiða út IsExternal* les grannfræði byggingarinnar með Python forritsins, sem ræsist þá (í fyrsta sinn eru íhlutir þess sóttir með
  samþykki þínu): veggirnir meðfram ytri mörkum hæðar eru útveggir, og á lokaðri hæð eru aðrir veggir rýmanna innveggir. Reglan segir
  hvenær gildi er útleitt.
- Samsettur byggingarhluti, til dæmis þak úr þakplötum, er talinn í hlutum sínum, og hluti sem reglurnar geta ekki ákveðið fær flokk
  heildarinnar.

Undir **Til ákvörðunar** velur þú flokk fyrir heilan hóp byggingarhluta með sama klasa, gerð og reglu. Valið er geymt fyrir hvern
byggingarhluta (GlobalId) í vafranum þar til þú lætur reglurnar ákveða aftur.

**Magn.** Rúmmál, flatarmál og þyngd eru tekin úr magntölum skrárinnar, nettó á undan brúttó og hliðarflatarmál veggjar. Ef skráin
hefur engar magntölur er rúmmálið reiknað úr rúmfræðinni þegar byggingarhlutinn er einföld útpressun: flatarmál sniðsins sinnum dýptin
(rétthyrningur, hringur, I-snið, fjöllína og fleira), líka gegnum framsetningu gerðarinnar og fyrir klippingu. Op eru þá ekki dregin
frá, og dálkurinn *Heimild magnsins* segir það. Hurðir og gluggar eru taldir í fermetrum út frá málum sínum. Byggingarhluta með
efnislögum er skipt eftir efni samkvæmt þykkt laganna. Annars hefur röðin ekkert magn og er ekki talin.

**Loftslagsgögn.** *Sækja loftslagsgagnagrunninn* sækir loftslagsgagnagrunn Boverket (um 0,9 MB) frá api.boverket.se með samþykki
þínu fyrir vefþjónustur og geymir hann í vafranum; ekkert um líkanið er sent. Undir *Efni og auðlindir* velur þú auðlind fyrir hvert
efni. Tillögurnar byggja fyrst á flokki efnisins í IFC (IfcMaterial.Category, til dæmis concrete, steel, wood, glass eða gypsum) og
síðan á heitinu; hurðir og gluggar fá tillögur eftir heiti gerðarinnar. *Samþykkja tillögurnar* geymir tillögurnar sem þitt val, sem
gildir fyrir öll líkön. Loftslagsáhrifin eru massinn (rúmmálið sinnum eðlismassinn eða flatarmálið sinnum þyngdin á fermetra) sinnum
gildi gagnagrunnsins fyrir A1–A3, A4 og A5 (rýrnun). Boverket segir að loftslagsgögn byggingarvara séu sett varfærið, um 25 prósentum
yfir meðaltali; tólið reiknar með varfærna gildinu og sýnir það dæmigerða ef beðið er um það.

Hverja sýn má vista sem gagnasafn. Heimild: Boverket, loftslagsgagnagrunnurinn (opin gögn, sjá [licenser.md](licenser.md)).

## Efnisúttekt fyrir úrgangsstjórnunaráætlun

Tólið **Efnisúttekt** í Greina (flipinn Magn) tekur saman það sem líkanið veit sem grunn að úrgangsstjórnunaráætluninni
(avfallshanteringsplan). Samkvæmt sænsku PBL 10 kap. 8 a §, sem gildir frá 1. júlí 2026, skal byggjandinn sjá til þess að til sé
úrgangsstjórnunaráætlun með upplýsingum um

1. hvaða byggingarvörur má endurnota og hvernig þær eru meðhöndlaðar, og
2. hvaða úrgangur getur hlotist af framkvæmdinni og hvernig hann er meðhöndlaður, einkum hvernig byggjandinn hyggst gera mögulega a)
   hágæða endurvinnslu efna og b) örugga meðhöndlun og fjarlægingu hættulegra efna.

Áætlunar er ekki krafist þegar hún er augljóslega óþörf, og eftirlitsaðilinn (kontrollansvarig) hefur sama hlutverk gagnvart henni
og eftirlitsáætluninni. Boverket lagði áætlunina til í skýrslu 2024:26 undir heitinu auðlindastjórnunaráætlun. Tólið gefur grunninn;
áætlunin og matið eru byggjandans. Sýnirnar fylgja tveimur liðum ákvæðisins.

**1. Byggingarvörur sem má endurnota.** Byggingarhlutarnir með gerð, þeir með vörugögn fyrst: framleiðandi (Manufacturer), gerð
(ModelLabel) og GTIN (GlobalTradeItemNumber) úr Pset_ManufacturerTypeInformation, helst á gerðinni, og raðnúmer (SerialNumber) og
strikamerki (BarCode) úr Pset_ManufacturerOccurrence á byggingarhlutanum. Vartala GTIN er prófuð samkvæmt reglu GS1; villa er sýnd
en aldrei leiðrétt. Hver lína hefur lag byggingarinnar, efnin, flokkana og þau hættulegu efni sem líkanið tilgreinir. IFC2X3 hefur
ekkert GTIN.

**2 a. Úrgangur eftir flokkum og eftir lögum og flokkum.** Hvert efni í hverjum byggingarhluta fær úrgangsflokk samkvæmt sænsku
úrgangsreglugerðinni (avfallsförordningen 3 kap. 10 §), sem auk spilliefna krefst þess að timbur, steinefni (steypa, múrsteinn,
klinker, keramik og steinn), málmar, gler, plast og gifs séu flokkuð frá. Flokkurinn er fyrst tekinn úr flokki efnisins í IFC
(IfcMaterial.Category, til dæmis concrete, steel, wood, glass, gypsum eða plastic) og annars úr heiti efnisins (steypa, límtré,
gifsplata, einangrunargler og þess háttar, á norrænu málunum og ensku). Steinull, glerull og steinefnaull tilheyra hvorki steinefnum
né gleri, og samsett efni eins og trefjastyrkt plast, heiti sem tilgreina fleiri flokka (timbur/ál) eða engan, og byggingarhlutar án
efnis fá flokkinn *Annað / ákveða*. Dálkurinn *Regla* sýnir hvað réð. Summurnar gefa byggingarhluta, línur, rúmmál, flatarmál og
massa eftir flokkum og eftir lögum byggingarinnar (sex lögum loftslagsyfirlýsingarinnar) og flokkum. Ekkert flokkunarkerfi er lesið.

**2 b. Hættuleg efni.** Aðeins það sem eiginleiki í líkaninu segir: eiginleiki sem varðar hættuleg efni eða spilliefni að heiti eða
mengi (til dæmis Pset_EnvironmentalImpactValues.HazardousWaste, eða eigið mengi með asbesti eða PCB) og hefur gildi sem segir já, á
byggingarhlutanum, gerðinni eða efninu. Forritið giskar aldrei. Tilgreini líkanið engin hættuleg efni segir tólið það, og úttekt á
hættulegum efnum þarf samt.

**Allir byggingarhlutar og efni** eru línurnar á bak við summurnar: magnið, flokkur efnisins, þykktin, úrgangsflokkurinn með
reglunni, lagið, eðlismassinn og massinn.

**Magn og massi.** Magnið er loftslagsyfirlýsingarinnar: magn skrárinnar, annars rúmfræði einfaldra útpressana, og byggingarhluta
með efnislögum er skipt eftir þykkt laganna; hurðir og gluggar eru hér taldir eftir efni. Massinn er þyngd skrárinnar, annars
rúmmálið sinnum eðlismassi efnisins (Pset_MaterialCommon.MassDensity í kg/m³). Án eðlismassa hefur línan engan massa, og
athugasemdin segir hve margar línur það á við.

**IDS fyrir úrgangsstjórnun.** *IDS Úrgangsstjórnun* opnar IDS-prófun með IDS-skrá forritsins `SE-Dataspatium_Avfallshantering.ids`
og prófar líkanið gegn henni í Python forritsins: efni með einum af ráðlögðum flokkum IFC á hverjum byggingarhluta; grunnmagn
rúmmáls á veggjum, plötum, bitum, súlum, stöngum og plötuhlutum (IfcMember og IfcPlate), undirstöðum og stigaköflum, og flatarmáls á
hurðum, gluggum, klæðningum, þökum og glerveggjum; framleiðanda og gerð á hurðum, gluggum og lagnabúnaði og GTIN á réttu formi þegar
það er til. Skráin gildir fyrir IFC4 og IFC4.3, því að IFC2X3 vantar efnisflokk, sniðmát fyrir grunnmagn og GTIN. ifctester
samþykkir efniskröfuna þegar að minnsta kosti eitt af efnum byggingarhlutans hefur flokk, og samsettir byggingarhlutar (þök, stigar,
rampar og glerveggir) eru prófaðir í hlutum sínum.

Vista má hverja sýn sem gagnasafn. Ekkert er sótt af netinu.

## DXF-teikningar

DXF-skrá verður að töflu með einum teikningarhlut í hverri röð (gerð, lag, litur, lengd, flatarmál, texti og staðsetning) og
SVG-teikningu. Teikningin opnast í Vinna, þar sem þú þysjar með hjólinu eða með því að klípa og færir með því að draga; þegar teikningin hefur fókus færa örvarnar, + og − þysja, Home sýnir allt og F þysjar að merkta hlutnum. Röð í töflunni þysjar að hlut sínum. Kveikt er og slökkt á
lögum í skoðaranum og smellur velur hlutinn og röð hans. Flipinn Magn gefur fjölda, lengd og flatarmál eftir lagi og gerð.

Línur, fjöllínur með bogum, hringir, bogar, sporbaugar, splínur, punktar, textar, heilflötur, þrívíddarfletir, blokkir og
blokkir málsetninga eru teiknaðar. Skygging (HATCH) er ekki teiknuð.

## Útflutningur

Flytja út gefur upprunalegu skrána, eiginleika og magn sem CSV (ein röð fyrir hvert gildi) og teikninguna sem SVG, auk venjulegra
töflusniða fyrir `data`. Gröf af líkönum eru flutt út sem PNG, SVG og PDF; þrívíddarlíkan verður þá að mynd.

## Takmarkanir

- Ekki er hægt að breyta töflunum beint. Líkaninu er breytt með uppskriftarskrefum IfcOpenShell og með *Breyta með gervigreind*,
  sem skrifa nýja útgáfu IFC-skrárinnar.
- Líkan er teiknað aftur úr upprunalegu skránni í hverri nýrri lotu. 57 MB líkanið sem forritið var prófað með tekur 4–6 sekúndur.
- Fyrsta teikning mjög stórs líkans getur læst síðunni um stund á meðan skjákortið tekur við þríhyrningunum.
- Magnið er ekki magntaka samkvæmt neinum reglum. Berðu það saman við heimildina áður en það er notað.
- DXF er lesið í tveimur víddum. DWG þarf fyrst að vista sem DXF.

## Nýtt líkan

Nýtt, autt líkan er búið til í Sækja með *Nýtt byggingarlíkan*. Veldu skema (IFC4X3_ADD2 er sjálfgefið; IFC4 og IFC2X3 eru fyrir
forrit sem lesa ekki það nýjasta) og heiti verkefnis, lóðar, byggingar og fyrstu hæðar. Forritið skrifar líkanið með IfcOpenShell
í Python forritsins, í metrum og með samhengjum líkansins, og líkanið stenst skemaprófun. Í fyrsta sinn eru Python og IfcOpenShell
sótt eftir samþykki.

Líkanið verður venjulegt líkanagagnasafn. Opnaðu það í Vinna og byggðu í því með *Breyta með gervigreind*, til dæmis „tvær hæðir og
hnitanet 6×4 m með útveggjum eftir netinu“. Það má flytja út sem IFC og birta á Dataregium eins og önnur líkön.

### Auðkenni, númer og staðsetning

Undir *Auðkenni* í eyðublaðinu fyllir þú út það sem þú veist; aðeins það er skrifað í skrána:
- *Landeignarnúmer* verður heiti lóðarinnar (IfcSite.Name) og auðkenni hennar (Pset_LandRegistration.LandID); það sem þú
  skrifaðir undir *Lóð* verður þá langt heiti lóðarinnar.
- *Byggingarnúmer* verður heiti byggingarinnar (IfcBuilding.Name) og *Heiti byggingarinnar* langt heiti hennar (LongName).
- *Opinbert auðkenni byggingar* er skrifað í Pset_BuildingCommon.BuildingID með IsPermanentID, svo að líkanið og skrárnar eigi við
  sömu byggingu.
- *Lýsing fyrstu hæðar* verður Description hæðarinnar, til dæmis að hún sé inngangshæð.
- *Höfundur* og *Stofnun* eru aðeins skrifuð í haus IFC-skrárinnar ef þú fyllir þau út; nafn eru persónuupplýsingar.

Líkanið fær einnig samhengið Axis fyrir ása veggjanna frá upphafi, og skýrslan minnir á að líkanið vantar hnitakerfi
(buildingSMART-reglan GRF003) þar til `set_site` hefur gefið því eitt.

Gervigreindin númerar hæðirnar í hæðarröð fyrir allt verkefnið (Plan 1, Plan 2 …) og skrifar inngangshæðina í lýsingu hæðarinnar;
`create_storeys_and_grid` tekur `description` og `long_name` fyrir hverja hæð. `create_spaces` tekur `number` fyrir hvert rými,
einkvæmt í byggingunni: númerið verður Name rýmisins, heiti rýmisins LongName þess og `long_name` lýsing þess, og rýmisgerð
(`room_type`) er skrifuð sem ObjectType með PredefinedType USERDEFINED. Án númers gilda heitin eins og áður.

`set_site` þekkir samsettu EPSG-kóðana fyrir SWEREF 99 með hæðum í RH 2000: 5845 fyrir SWEREF 99 TM og 5846–5857 fyrir tólf
staðbundnu beltin í sömu röð og 3007–3018 (til dæmis 5850 fyrir SWEREF 99 18 00 + RH 2000). Fyrir byggingu í Svíþjóð velur
gervigreindin helst staðbundna beltið þegar hnitin eru í því; hún umreiknar aldrei hnit sjálf. Hnitakerfið (IfcProjectedCRS) fær
lýsingu á venjulegu máli og, þegar kóðinn tilgreinir ekki hæðarkerfið, RH 2000 sem VerticalDatum (annað með `vertical_datum`).
Kortaeiningin er alltaf metri og Scale umbreytingarinnar lengdareining skrárinnar í metrum (GRF005), svo líkan í millimetrum fær
Scale 0,001. Hvert yfirsamhengi (Model, Plan) fær sína eigin IfcMapConversion með sömu gildum (GRF001). Hæð byggingarinnar yfir
sjávarmáli er OrthogonalHeight umbreytingarinnar; í IFC4 og IFC2X3 einnig IfcBuilding.ElevationOfRefHeight, sem IFC4X3 hefur
lagt af.

Skráarhausinn: hver IFC-skrá sem forritið skrifar eða vistar fær FILE_DESCRIPTION með sýnarskilgreiningu og stiginu 2;1, og
FILE_NAME með heiti skrárinnar, tímanum samkvæmt ISO 8601, forvinnsluforritinu (Dataspatium og IfcOpenShell með útgáfum) og
upprunaforritinu á forminu *Dataspatium - Dataspatium - útgáfa*. Sýnarskilgreiningin er CoordinationView_V2.0 fyrir IFC2X3 og
ReferenceView_V1.2 fyrir IFC4. IFC4X3 hefur enga opinbera sýn fyrir líkan í öllu skemanu (Reference View sleppir meðal annars
útpressuðum formum), svo hausinn segir `notYetAssigned` í stað sýnar sem skráin fylgir ekki; staðfestingarþjónusta buildingSMART
merkir það, og viðtakandi sem krefst sýnar tilgreinir hana. Skrá sem forritið breytir heldur eigin höfundi, stofnun og
upprunaforriti, og sýn sinni þegar staðfestingarþjónustan samþykkir hana.

## Ný bygging úr lýsingu

Skrifaðu lýsingu í eyðublaðið *Nýtt byggingarlíkan* ("tveggja hæða hús 12 × 8 m með risþaki, múrsteinshlið, inngangur mót suðri …") og
veldu *Byggja úr lýsingunni með gervigreind* þegar líkanið er til: líkanið opnast í Vinna með gervigreindarspjaldið í hamnum **Byggja
úr lýsingu**. Þar getur þú hengt við ljósmyndir og skannaðar teikningar (JPEG, PNG eða PDF; grunnteikning gefur réttu málin, ljósmynd
útlitið, efnin og hvernig hlutarnir tengjast) eða bætt við myndum úr myndasafni, til dæmis þeim sem þú tókst með Dataspatium Mobil.
Gervigreindin les tóma líkanið, segir áætlun sína, spyr í spjaldinu þegar lýsingin skilur eitthvað mikilvægt eftir opið (grunnflötur,
fjöldi hæða, hæðarhæð, veggþykktir, efni) og byggir svo í hópum með sömu tólum og *Breyta*: hæðir og net, veggir á hverja hæð,
plötur, op, eiginleikar og efni, með forskoðun og leiðréttingum eftir hvern hóp. Ekkert er skrifað í líkanið fyrr en þú forskoðar og
samþykkir breytingasettið að venju, og þú getur bætt við með nýrri lýsingu í sama ham. Myndirnar eru sendar þjónustuveitandanum með
lýsingunni eftir samþykki fyrir hýsil veitandans; staðbundið líkan sem sér myndir heldur öllu á tölvunni.
Með *Upplýsingar úr gagnasafni* fara línur úr töflu í lýsinguna sem texti: grunnflötur sóttur af kortinu (Opin landupplýsingagögn) verður
horn í metrum frá suðvesturhorninu, svo veggirnir fái rétt mál, og mál og athugasemdir úr vettvangseyðublaði í Dataspatium Mobil verða
línur; umferð með símanum getur síðan gefið fleiri myndir og mál, og lýsingin er fyllt út í sama ham.
Lýsinguna og myndirnar má einnig setja á þjóninn sem efnivið líkansins þegar líkanið var sótt úr CDE: málið *Efniviður* í verkefni
líkansins fær lýsinguna sem textaskjal og hverja mynd sem skjal, svo að aðrir sem vinna með líkanið í eigin biðlurum sjái úr hverju
það var byggt. Hnappurinn heitir *Setja efniviðinn á þjóninn*.
Efst í spjaldinu standa *Upplýsingar um bygginguna* (hvaða bygging, hæðir, lengd, breidd, hæð, undirstöður, þak) og *Nákvæmni* (skissa,
aðaldrættir eða nákvæmt): fylltu inn það sem þú veist, svo verður það upphaf lýsingarinnar og gervigreindin spyr um afganginn. Orðin
eru hversdagsleg, en að baki þeim liggja upplýsingakröfur ISO 19650 og level of information need, og líkanið er hugsað sem
rekstrarlíkan byggingarinnar. Hver mynd er hengd við sem ljósmynd, norður-, austur-, suður- eða vesturhlið, innanhúss eða teikning, og
ljósmynd með staðsetningu og tíma í skránni (EXIF) fær þau í myndatextann sinn, svo að gervigreindin viti hvað hún sér. Upplýsingarnar
úr gagnasafni gefa einnig suðvesturhorn grunnflatarins á kortinu, svo gervigreindin staðsetur líkanið með `set_site` (staðsetning, hæð
og SWEREF 99 TM), og með *Með landhæð í hornunum*, sem birtist þegar heimild Lantmäteriet hefur verið bætt við, landhæðina í hverju
horni úr hæðarlíkaninu: netkall með lyklinum þínum eftir samþykki.
Þegar gagnasafn er valið sýnir *Staðurinn á kortinu* grunnflötinn í návígi, og í vali á bakgrunnskorti er loftmyndin sem nær yfir
staðinn: þú sérð bygginguna að ofan meðan þú staðsetur hana. Kortið er teiknað þegar þú opnar það, og myndirnar eru aðeins sóttar þegar
þú velur bakgrunn og gefur samþykki. Danmörk, Finnland og Ísland hafa opnar loftmyndir sem tígla; í Svíþjóð les forritið loftmynd
Lantmäteriet fyrir staðinn og 250 m í kring úr skrám Lantmäteriet með lyklinum þínum frá Geotorget (sá sami og fyrir landhæðina);
Noregur hefur enga opna loftmynd (sjá [kartor.md](kartor.md#loftmyndir)).
Eftir veggi hverrar hæðar les forskoðunin grannfræði byggingarinnar: miðlínur veggjanna verða að herbergjum, og hæðin er lokuð þegar
veggirnir loka að minnsta kosti einu herbergi og enginn veggendi stendur laus; gervigreindin lagar lausa enda með því að færa veggi eða
bæta við veggjum áður en hún leggur plöturnar. Útveggirnir með áttum sínum gera gervigreindinni kleift að para ljósmynd af
suðurhliðinni við réttu veggina (lestrartólið `get_topology`), og sama grannfræði birtist á kortinu *Grannfræði* í Athuga.

### Tilgangur, áfangi og kröfur

Undir *Upplýsingar um bygginguna* eru einnig *Tilgangur*, *Áfangi* og *Kröfur (IDS)*. Tilgangurinn er það sem líkanið er notað til, og
hann velur nákvæmni og kröfur, sem þú getur breytt eftir á:

| Tilgangur | Nákvæmni | Kröfur |
|---|---|---|
| Rúmmálsathugun | Skissa | SE-Dataspatium_Grund |
| Byggingarleyfi | Aðaldrættir | SE-Dataspatium_Grund |
| Loftslagsyfirlýsing | Aðaldrættir | SE-Dataspatium_Klimatdeklaration |
| Rekstur og viðhald | Nákvæmt | SE-Dataspatium_Grund |
| Úrgangsstjórnun | Nákvæmt | SE-Dataspatium_Avfallshantering |
| Annað (með eigin texta) | Aðaldrættir | engar |

Áfanginn segir hvar í lífi byggingarinnar líkanið á heima: frumathugun, tillaga, verkteikningar, í byggingu eða núverandi bygging.
Tilgangur, áfangi og kröfur hefja lýsinguna. Með kröfum prófar hver forskoðun, gervigreindarinnar og þín, tillöguna gegn IDS-skránni,
og gervigreindin fær forskriftirnar sem ekki eru uppfylltar svo hún geti lagað þær. Kröfurnar hindra ekki samþykktina; spjaldið sýnir
hve margar forskriftir eru uppfylltar og hverjar ekki.

Nákvæmnin fylgir upplýsingaþörfinni í ISO 7817-1 (kafli 6), sem skiptir henni í rúmfræði, stafræna upplýsingar og skjölun. Með eigin
orðum forritsins merkja stigin þrjú þetta eftir þáttum:

| Þáttur | Skissa | Aðaldrættir | Nákvæmt |
|---|---|---|---|
| Smáatriði | hæðir, útveggir og plötur sem einföld form, engin op | allir veggir með þykkt gerðanna, plötur, lögun þaksins og op með sennilegum málum | lög eftir gerð, hurðir og gluggar með karmi og ramma, veggir sem mætast í hornum |
| Víddir | form í þrívídd og ás veggjarins | eins og skissan | eins og skissan; grunnmyndatákn geta komið síðar |
| Staðsetning | hæðarkótar hæða, hnitanetið og lóðin þegar hún er þekkt | mál úr teikningu eða lýsingu, hnitsett þegar upplýsingarnar eru til | mæld eða málsett staðsetning, op á nákvæmum stað |
| Útlit | sjálfgefnir litir | litur eftir flokki efnisins | yfirborðsstíll fyrir hvert efni, aðskilinn frá efninu |
| Stikuð hegðun | útpressanir sem hægt er að breyta málum á | gerðir (skiptu um gerð og allar breytast) og lög | tengingar sem reikna hornin upp á nýtt, stikaðar hurðir og gluggar |
| Auðkenning | heiti, IFC-flokkur með PredefinedType og GlobalId | nefndar gerðir, herbergi með númeri og heiti | hlutar og rýmisflokkar, Tag á hurðum og gluggum |
| Upplýsingainnihald | hæðir og hæðarkótar | IsExternal, LoadBearing og efni á gerðunum, grunnmagn | bruni, U-gildi og loftslagsgögn eftir gerð eða efni, ástand núverandi byggingar |
| Skjölun | lýsingin | lýsingin og myndirnar sem gögn líkansins | EPD-tilvísanir og vörublöð |

## Athuga með gervigreind

Hamurinn **Athuga** í gervigreindarspjaldinu ber líkan af byggingu sem þegar stendur saman við ljósmyndir af skemmdum og sliti, teknar
með Dataspatium Mobil, myndavél eða dróna, og við mál úr vettvangseyðublaði. Hengdu ljósmyndirnar við í spjaldinu, merktar með
framhlið eða innanhúss, eða bættu við myndum úr myndasafni sem þú fluttir inn í Sækja; ljósmynd með staðsetningu og tíma í skránni
(EXIF) fær þau í myndatextann, og *Upplýsingar úr gagnasafni* setur mál og athugasemdir úr vettvangseyðublaði í spurninguna.
Gervigreindin les líkanið með sömu tólum og í *Spyrja*, finnur eininguna sem hver mynd sýnir og skráir atriði fyrir hverja skemmd með
titli, lýsingu, ástandi (gott, viðunandi, lélegt eða alvarlegt), forgangi (lítill, miðlungs, mikill eða brýnn) og ráðlagðri aðgerð;
ljósmynd án sýnilegrar skemmdar gefur ekkert atriði. Ástand einingarinnar fer í eiginleikasafnið Pset_Condition (matsdagsetning,
ástand og stutt lýsing) í breytingasetti sem þú forskoðar og samþykkir eins og í *Breyta*, og engar einingar eru búnar til, færðar eða
eyddar. Atriðin birtast undir svarinu, og *Vista atriðin sem töflu* býr til nýtt gagnasafn með einu atriði í hverri línu: ljósmynd,
eining, titill, lýsing, ástand, forgangur, aðgerð, dagsetning og staðsetning myndarinnar. *Flytja út sem BCF* hleður niður BCF-skrá
með einu máli á hvert atriði, þar sem sýnin horfir á eininguna, merkta og litaða, með mynd af líkaninu sem skyndimynd og ljósmyndina sem skjal, og fyrir líkan sem var sótt af þjóni
sem þú hefur skráð þig inn á stofnar *Stofna mál á þjóninum* sömu mál í verkefni líkansins eftir staðfestingu; þar verður ljósmyndin skjal í verkefninu, eða eigin viewpoint með ljósmyndinni einni þegar þú mátt ekki bæta við skjölum, og málin eru tengd líkanskránni þegar þjónninn leyfir það. Undir *Fleiri valkostir* gefur þú málunum stöðu, úthlutun, ábyrgðaraðila, áfanga og skilafrest, á þjóni úr listum verkefnisins. Ljósmyndirnar eru
sendar þjónustuveitandanum með spurningunni eftir samþykki fyrir hýsil veitandans, og þær fara aftur af tölvunni aðeins þegar þú
stofnar mál á þjóninum.

## Spyrja gervigreind um líkanið

Hnappurinn *Spyrja gervigreind* í líkanssýninni opnar spjald í skoðaranum þar sem þú spyrð spurningar um opna IFC-líkanið, til dæmis
"hvaða hurðir vantar brunaflokk á hæð 2?". Gervigreindarlíkanið les með tólum (yfirlit líkansins, hæðirnar, einingar eftir flokki, hæð,
nafni og eiginleika, eina einingu með öllum eiginleikum, það sem þú merktir í 3D-sýninni og, fyrir líkan sótt frá Dataregium, nefndar
fyrirspurnir þjónsins) og svarar með þeim einingum sem það byggir á.
*Merkja n einingar* setur einingar svarsins í valið, sem 3D-sýnin, taflan og hinir hamirnir fylgja. Spjaldið sýnir hvert tólakall og þá tóka
sem fóru í svarið. Gervigreindin getur aðeins lesið: engu er breytt, vistað eða birt, og næsta spurning heldur samtalinu áfram.

*Þjónustur* bætir við skýjaþjónustu eða staðbundnu líkani: Anthropic Messages eða OpenAI-samhæfðum forritaskilum (OpenAI, Gemini, Ollama,
vLLM, llama.cpp og fleiri), með vistfangi, líkani og API-lykli. Lykillinn er geymdur í setunni eða dulritaður með lykilsetningunni þinni,
aldrei í hreinum texta og aldrei í spurningunni. *Stefna* ræður hvað má kalla: *Spyrja* biður um samþykki fyrir hverja þjónustu í fyrsta
sinn, *Ský* leyfir skýjaþjónustur, og *Aðeins staðbundið* leyfir aðeins líkön á þinni eigin tölvu. Það sem er sent er spurningin þín og þau
tólasvör sem líkanið biður um; tólasvörin eru gögn úr líkaninu, aldrei fyrirmæli, og eru stytt þegar þau eru stór.

## Breyta með gervigreind

Hamurinn *Breyta* í sama spjaldi lætur gervigreindina leggja til breytingar á líkaninu, til dæmis "búðu til tvær hæðir og 6×4 m hnitanet,
útveggi eftir netinu, eina plötu á hæð og hurð í hverjum vegg á hæð 1". Gervigreindin les líkanið með sömu tólum og í Spyrja og skrifar
með tólum fyrir hæðir og hnitanet, veggi, plötur, op með hurð eða glugga, eiginleika, efni, færslur og eyðingar. Tólið `set_site` setur
stað líkansins á jörðinni: breiddargráðu, lengdargráðu og hæð lóðarinnar, og með EPSG-kóða eins og 3006 fyrir SWEREF 99 TM einnig
kortavörpunina, það er upphafspunkt líkansins í austur- og norðurhnitum og snúning hans (ekki í IFC2X3, sem vantar hana). Tólið
`create_roof` setur risþak, valmaþak, einhalla þak eða flatt þak með halla, þakskeggi og þykkt á veggi hæðar (efstu hæðina ef engin er
nefnd): IfcRoof úr þakplötum (IfcSlab af gerðinni ROOF), einni á hvern þakflöt, yfir umlykjandi rétthyrningi veggjanna eða gefnum
rétthyrningi (önnur útlína víkur enn sem komið er fyrir umlykjandi rétthyrningi sínum). Tólið `create_spaces` gerir herbergin sem
veggirnir loka að rýmum (IfcSpace) með nöfnum úr rýmisáætluninni, valin með punkti inni í þeim eða númeri sínu í grannfræðinni, með hæð
upp að næstu hæð, flatarmálum (Qto_SpaceBaseQuantities) og mörkum að veggjunum og hurðum þeirra og gluggum. Tólin breyta engu: þau
fylla breytingasett sem spjaldið telur upp skref fyrir skref (mál í metrum; nýjar einingar fá tilvísanirnar new-1, new-2 … þar til
skráin hefur gefið þeim auðkenni).

Tólið `define_type` gerir veggjagerð, plötugerð eða þakgerð (IfcWallType, IfcSlabType eða IfcSlabType af gerðinni ROOF fyrir
þakplöturnar) með efnislögum í metrum, fyrir vegg frá hægri hlið til vinstri séð frá upphafi að enda og fyrir plötu og þak ofan frá og
niður. Hvert lag getur fengið flokk efnisins (þá sem IFC mælir með: concrete, steel, aluminium, block, brick, stone, wood, glass,
gypsum, plastic og earth) og hlutverk lagsins (burðarlag, einangrun, innra eða ytra yfirborð), en aðeins þegar þau eru þekkt.
`create_wall`, `create_slab` og `create_roof` taka gerðina: einingin fær gerðina (IfcRelDefinesByType), þykkt sína úr lögunum og lögin
lögð á sig (IfcMaterialLayerSetUsage: lög veggjar miðjuð á línuna, lög plötu niður frá efra borði í hæð hæðarinnar og lög þakplatna
upp frá neðra borði), og PredefinedType hennar er á gerðinni. Efni og sameiginlegir eiginleikar tilheyra gerðinni, og gervigreindin
skilgreinir gerðirnar fyrst. Þegar breytingasettið er keyrt eru veggirnir sem það býr til tengdir veggjunum sem þeir mæta
(IfcRelConnectsPathElements): í horni nær þykkari veggurinn (við sömu þykkt sá lengri) út fyrir hornið og hinn endar við hann, og veggur
sem endar á línu annars endar við hlið hans, svo að hornin fá hvorki rifur né skörun og ekkert rúmmál er talið tvisvar. Miðlínur
veggjanna haldast eins og þær voru teiknaðar, og veggir sem mætast í öðru en réttu horni eru tengdir eins og þeir eru teiknaðir. Að lokum fá
veggir, plötur, þök, hurðir og gluggar sem breytingasettið bjó til eða breytti grunnmagn (Qto_WallBaseQuantities, Qto_SlabBaseQuantities,
Qto_RoofBaseQuantities, Qto_DoorBaseQuantities og Qto_WindowBaseQuantities) reiknað út frá málunum, með opin dregin frá og með nöfnunum
úr sniðmátum skemans.

Verkfærið `create_element` gerir þá byggingarhluta sem hafa ekki eigið verkfæri, í nákvæmasta IFC-flokknum og aldrei sem
IfcBuildingElementProxy: súlur (IfcColumn), bita (IfcBeam), stoðir og sperrur (IfcMember), undirstöður (IfcFooting), staura (IfcPile),
klæðningar eins og gólfefni, niðurhengd loft, utanhússklæðningu, þakklæðningu og einangrun (IfcCovering), handrið (IfcRailing),
reykháfa (IfcChimney), sólskyggni (IfcShadingDevice), hreinlætistæki (IfcSanitaryTerminal), húsgögn (IfcFurniture, í IFC2X3
IfcFurnishingElement) og beina stiga (IfcStair). Flokkurinn og PredefinedType hans eru prófuð gagnvart skema líkansins eins og í hinum
verkfærunum. Formið er pressaður prófíll: rétthyrningur, hringur eða útlína í plani hæðarinnar, uppréttur frá hæð yfir hæðinni (súlur,
undirstöður, klæðningar, húsgögn) eða liggjandi í stefnu (bitar, stoðir og handrið). Hlutinn er á hæðinni eða hluti af heild
(`part_of`), til dæmis handrið stiga, og er þá í heildinni og á hæð hennar en ekki beint á hæðinni. Klæðning getur tilgreint hvað hún
klæðir (`host`): byggingarhluta eða rými. Í IFC4 og síðar verður hún hluti af byggingarhlutanum (IfcRelAggregates) eða liggur í
rýminu; aðeins í IFC2X3 fær hún IfcRelCoversBldgElements eða IfcRelCoversSpaces. Beinn stigi (STRAIGHT_RUN_STAIR) er hallandi
stigahluti (IfcStairFlight, STRAIGHT) með fjölda þrepa, uppstigi, framstigi og breidd sem eigindum og í Pset_StairFlightCommon og, ef
óskað er, stigapalli (IfcSlab, LANDING) efst; síðasta uppstigið er frambrún pallsins eða plötunnar fyrir ofan.

`define_type` gerir líka gerðir fyrir klæðningar (með lögum, eins og plötugerð), súlur, bita, undirstöður, handrið, hurðir og glugga
(IfcCoveringType, IfcColumnType, IfcBeamType, IfcFootingType, IfcRailingType, IfcDoorType og IfcWindowType; í IFC2X3 IfcDoorStyle og
IfcWindowStyle) með efni. Hurðagerð hefur opnunarmáta sinn (OperationType, til dæmis SINGLE_SWING_LEFT, með lamirnar vinstra megin séð
í þá stefnu sem hurðin opnast), gluggagerð skiptingu sína (PartitioningType, til dæmis SINGLE_PANEL eða DOUBLE_PANEL_VERTICAL), og
báðar breidd, hæð og dýpt karmsins. IfcOpenShell teiknar formið, með karmi, hurðarblöðum eða gluggarömmum og gleri, einu sinni á
gerðinni og hver hurð og gluggi gerðarinnar endurnýtir það (vörpuð lögun), og gerðin fær eiginleika karmsins og hurðarblaðanna
(IfcDoorLiningProperties, IfcDoorPanelProperties, IfcWindowLiningProperties). `create_opening` tekur gerðina: hurðin eða glugginn fær
stærð og form gerðarinnar og stendur í fleti við vinstri hlið veggjarins, séð frá upphafi veggjarins að enda hans (innhlið útveggjar
sem er teiknaður rangsælis), og hurð opnast að þeirri hlið, vinstri hurð með lamirnar á þeirri hlið opsins sem er næst upphafi
veggjarins. Með `side: right` er henni snúið: í fleti við hægri hliðina og opnast að henni. Karmur jafndjúpur og veggurinn er þykkur
fyllir allt gatið.
Tólið `edit_element` breytir einingu sem fyrir er á sínum stað, svo að hún heldur GlobalId sínu alla ævi: upphafi, enda, þykkt, hæð og
gerð veggjar, útlínu, þykkt og gerð plötu, staðsetningu, breidd, hæð og neðri brún ops ásamt hurð þess eða glugga, þakhalla, þakskeggi
og hæð þakskeggs þaks, og heiti hvaða einingar sem er. Málin eru lesin úr eigin rúmfræði einingarinnar (upphaf og endir veggjar úr ás
hans), og bolurinn, ásinn, lögin, grunnmagnið og veggjasamskeytin eru gerð á ný. Lestrartólið `get_parameters` sýnir gervigreindinni
málin sem `edit_element` breytir, lesin á sama hátt, svo að hún geti breytt einingu sem hún bjó ekki til sjálf. Op veggjarins halda
stað sínum eftir honum meðan hann heldur stefnu sinni (annars fjarlægð sinni frá upphafi hans) og verða að rúmast í honum, og þakið
heldur ferhyrningi sínum. Veggur eða plata með gerð fær þykkt sína úr gerðinni, svo að þykkari veggur fær aðra gerð. Einingu sem er
ekki teiknuð eins og skrifverkfærin teikna má aðeins gefa nýtt heiti, og svarið segir hvað gervigreindin getur gert í staðinn.
Gervigreindin breytir því einingum í stað þess að eyða þeim og búa þær til á ný, og eyðir aðeins þegar þú biður um það. Færsla með
`transform_elements` fer fram í fleti hæðarinnar: hurð eða gluggi færist með opi sínu, færður veggur er tengdur veggjunum sem hann
mætir, enginn punktur er skilinn eftir ónotaður, og lóðin, byggingin og hæðirnar eru aldrei færðar, því að staður þeirra og hæðir varða
allt verkefnið og breytast aðeins eftir samkomulagi.
Vöruauðkenni skrifar gervigreindin aðeins þegar þú gefur þau upp, og hún býr þau aldrei til: GTIN (GlobalTradeItemNumber),
framleiðanda (Manufacturer) og gerð (ModelLabel) í Pset_ManufacturerTypeInformation á gerðinni, og raðnúmer (SerialNumber) og
strikamerki (BarCode) í Pset_ManufacturerOccurrence á byggingarhlutanum. IFC2X3 hefur ekkert GTIN.
**Burður, staða og eiginleikar.** `create_wall` og `create_slab` taka `load_bearing` (burðarvirki eða ekki), og þau og `create_roof`
taka `status` (NEW nýtt, EXISTING núverandi, DEMOLISH verður rifið, TEMPORARY tímabundið), en aðeins þegar lýsingin eða þú segir það:
gervigreindin giskar aldrei, og stafrænn tvíburi núverandi byggingar fær EXISTING. Gildin eru skrifuð sem LoadBearing og Status í
Pset_WallCommon, Pset_SlabCommon og Pset_RoofCommon, á gerðina þegar allir hlutir gerðarinnar segja það sama og annars á hlutinn;
IFC2X3 hefur ekkert Status, og skýrslan segir það. Þegar breytingasafnið er keyrt setur forritið sjálft IsExternal út frá
grannfræðinni á veggina sem það bjó til eða breytti: satt meðfram ytri mörkum hæðarinnar og ósatt inni í byggingunni, og hurðirnar og
gluggarnir í veggjunum fá gildi síns veggjar. Þök og þakplötur eru ytri. Hæð þar sem veggirnir lokast ekki fær ekkert IsExternal, og
skýrslan og forskoðun gervigreindarinnar segja hvers vegna; gildi sem líkanið hafði þegar heldur sér. Það er með LoadBearing og
IsExternal sem loftslagsyfirlýsingin greinir flokkana að.
`set_properties` prófar eiginleikasafn sem heitir Pset_… eða Qto_… á móti sniðmátum IfcOpenShell fyrir skema líkansins: safni eða
eiginleika sem sniðmátið vantar er hafnað með nálægustu nöfnunum, satt og ósatt, mælingar og upptalningar verða að hafa rétta tegund,
og tölu með einingunni skrifaðri í gildið („40 dB“) er hafnað. Gefðu aðeins töluna, lengdir í metrum, flatarmál í m², rúmmál í m³ og
horn í gráðum, og forritið skrifar þau í einingum skrárinnar. Safn sem heitir Qto_… verður magnsafn (IfcElementQuantity). Eigið
eiginleikasafn má ekki byrja á Pset_ eða Qto_, og gervigreindin fær það ráð að nefna það land-uppruni-verkefni_Nafn, til dæmis
SE-ACME-42_Hljodvist, með eiginleikanöfnum í PascalCase án å, ä og ö. Eiginleikarnir fara í eigið safn hlutarins, aldrei í safn
gerðarinnar. `assign` tekur flokk efnisins (IfcMaterial.Category, sömu ellefu og í `define_type`).

*Forskoða* keyrir breytingasettið á afriti af líkaninu með IfcOpenShell í Python forritsins (íhlutirnir eru sóttir eftir samþykki í
fyrsta sinn), teiknar niðurstöðuna í þrívídd með nýtt grænt og breytt gult og sýnir hvað er búið til, breytt og eytt ásamt niðurstöðum
skemaathugunarinnar. *Samþykkja* gerir breytingarnar að uppskriftarskrefinu *Gervigreindarbreyting*: líkanið fær nýja útgáfu í
vinnusvæðinu, töflurnar eru endurbyggðar og skrefið má afturkalla nákvæmlega. Skrefið ber upprunann (þjónusta, líkan og spurningarnar).
Breytingasett með skemavillum er ekki hægt að samþykkja, eyðingar eru staðfestar einu sinni enn, og *Hafna* fleygir breytingasettinu án
þess að snerta líkanið. Gervigreindin getur aldrei vistað eða birt: það gerir þú með hnöppunum.

Forskoðunin athugar einnig vensl líkansins: op án veggjar, hurð eða gluggi án ops, byggingarhluti utan hæðanna og vensl án innihalds
teljast villur, en aðeins þegar breytingasettið olli þeim; það sem þegar var í líkaninu hindrar ekkert. Sé veggur eyddur fylgja hurðir
hans og gluggar með. Þegar Python forritsins er þegar í gangi forskoðar gervigreindin sjálf breytingasettið áður en þú sérð það og
lagar það sem hjólið finnur, mest tvisvar; samþykktin er áfram þín.

Líkan sem sótt var frá Dataregium er birt sem ný útgáfa í Deila með grunnútgáfu skjalsins, þeirri útgáfu sem þú sóttir. Hafi skjalið
fengið nýrri útgáfu á meðan hafnar þjónninn birtingunni (412 version_conflict); sæktu þá nýjustu útgáfuna, gerðu breytingarnar aftur
og birtu á ný. Fyrir líkan sem sótt var frá Dataregium spyr *Forskoða* líka forathugun þjónsins á tillögunni (skema, reglur
buildingSMART og IDS verkefnisins) þegar uppsprettan er innskráð, og verkefni sem tekur ekki við skrám með villum hafnar birtingunni
(422) með atriðum þjónsins í skilaboðunum og á spjaldinu Prófa líkanið.

*Leggja til á þjóninum* sendir forskoðað breytingasett til Dataregium sem breytingatillögu í stað þess að birta: BCF-mál í verkefninu
með breytingunum í viðhengi á formi þjónsins (snippet-gerðin DataregiumIfcChangeSet, sem þjónninn ber saman við skema sitt). Formið
tilgreinir breytingar á fyrirliggjandi tilvikum, eina á hvert eigindi: eiginleikagildi, staðsetningar, hvaða hæð stak tilheyrir og
þess háttar, með grunnútgáfu skjalsins, nafni þínu á þjóninum og gervigreindarlíkaninu sem uppruna. Ný stök, eyðingar og ný vensl er
ekki enn hægt að tilgreina á forminu; spjaldið telur þau og þau standa í lýsingu málsins. Hnappurinn er til fyrir líkan sem sótt var frá
Dataregium þegar þjónninn tilgreinir getuna `ifc_changes`, og tillagan breytir ekki líkaninu. Reyni þjónninn tillögur (Dataregium
með IFC-DB-eininguna á) sýnir spjaldið niðurstöðu prófunarinnar undir málinu: hve mörgum breytingum var hægt að beita á
grunnútgáfuna, ný atriði miðað við grunninn, og hverja breytingu sem ekki var hægt að beita ásamt ástæðu (atriði af gerðinni proposal),
til dæmis að gildi sé ekki lengur það sem tillagan gekk út frá. Sé prófunin hrein getur *manager* í verkefninu ýtt á *Samþykkja á
þjóninum*: þjónninn gerir tillöguna að næstu útgáfu skjalsins (með grunnútgáfu, tillöguhöfundi og samþykkjanda í lýsigögnum
útgáfunnar) og lokar málinu. Líkaninu í forritinu er ekki breytt við það; sæktu nýju útgáfuna frá Dataregium til að vinna áfram með hana. Hafi skjalið fengið
nýrri útgáfur síðan grunnurinn var, reynir þjónninn tillöguna aftur á nýjustu útgáfunni í sama skrefi og samþykkir gagnvart henni þegar
prófunin er hrein; rekist breytingarnar á það sem kom á milli hafnar þjónninn (412) og spjaldið telur upp lyklana sem rekast á
(tilvik og eigindi), eða segir að allt geti hafa breyst þegar heil skrá var hlaðin upp á milli. Sæktu þá nýjustu útgáfuna, gerðu
breytingarnar aftur og leggðu til á ný.
Kortið *Breytingatillögur á þjóninum* í líkanssýninni sýnir, fyrir líkan sótt frá Dataregium, allar tillögur gagnvart skjalinu þegar
þjónninn tilgreinir getuna `ifc_proposals_url`: titil, stöðu, hver lagði til, hve margar breytingar og gagnvart hvaða útgáfu;
*Samþykkja* gerir prófaða tillögu að næstu útgáfu fyrir þann sem má samþykkja, svo að fleiri með hver sinn biðlara geti unnið með sama
líkan. Þjónn sem gefur upp sniðið `ops_form` (`dataspatium-tools/1`) fær auk þess aðgerðir skrifverkfæranna, svo nýjar einingar,
eyðingar og tengsl fylgja tillögunni: þjónninn byggir þær á grunnútgáfunni með sama kóða og appið, og lykill í árekstri sem þú gefur
eftir er sendur með sem `keep_theirs`.

Hafi verkefnið teymi (spjaldið *Meðlimir verkefnisins* í Sýsla) sýnir spjaldið hvaða teymi breytingin snertir. Snerti hún aðeins hluta
eins teymis samþykkir ábyrgðarmaður þess teymis, líka með hlutverkið ritstjóri, og þjónninn hafnar (403) verkefnisstjóra; snerti hún
hluta fleiri teyma, eða engan, samþykkir verkefnisstjóri eins og áður. Þegar IDS-skjal fær nýja útgáfu athugar þjónninn nýjustu
IFC-útgáfur verkefnisins aftur, og skýrslur þeirra standa sem í bið á meðan.

Gefi þjónninn gildin fyrir hvern árekstur sýnir spjaldið fyrir hvern þeirra gildið í grunninum, það sem kom á milli og tillögu þína,
og þú velur fyrir hvern árekstur hvort þú heldur tillögu þinni eða tekur það sem kom á milli. *Leggja til aftur með mínu vali* sendir
tillöguna gagnvart nýjustu útgáfunni með þeim breytingum sem haldið er og án þeirra sem strikaðar eru, og þjónninn reynir hana aftur
áður en hægt er að samþykkja hana. Sameiningin fer fram á þjóninum; vafrinn sér aðeins um sjálfa árekstrana.

## Réttur IFC-flokkur

Í IFC er flokkurinn fyrsta flokkunin: nákvæmasti flokkurinn með PredefinedType sínu, ObjectType aðeins þegar PredefinedType er
USERDEFINED, og gerðarhlutur; önnur flokkunarkerfi koma ofan á. Gervigreindin finnur flokkinn fyrir hlut með lestrartólinu
`search_ifc_class`, með enskum IFC-orðum eins og *sink* eða *handrail*, í skjölun skema líkansins sem fylgir IfcOpenShell, og
breytingasettið tekur aðeins við flokkum sem eru til og eru ekki óhlutbundnir í skema líkansins, og PredefinedType af lista flokksins.
Kortið *IFC-flokkar* í Athuga (og lestrartólið `get_class_report`) telur staðgengilshluta (IfcBuildingElementProxy), USERDEFINED án
nafns, byggingarhluta án gerðar, PredefinedType bæði á gerð og hluta (reglan OJT001) og hluta utan rýmisskipanarinnar (SPS007), með
dæmum.

## Reglur buildingSMART í forskoðuninni

Forskoðunin prófar líka það sem breytingasettið býr til eða breytir gegn úrvali af stöðluðum reglum buildingSMART, sömu reglum og
staðfestingarþjónusta buildingSMART notar (ifc-gherkin-rules), fluttum yfir í eigið Python forritsins:

- **IFC102**: engar úreltar einingar, eigindi eða gildi í skema skrárinnar, til dæmis IfcWallStandardCase, veggurinn STANDARD eða
  IfcBuildingStorey.Elevation í IFC 4.3;
- **GEM111**: engir endurteknir punktar í fjöllínum og fjöllykkjum, og lokuð fjöllína endar í sínum eigin fyrsta punkti;
- **SWE001**: snið sem skera ekki sjálf sig (prófað með shapely);
- **PSE001** og **PSE002**: staðlað sett (Pset_) hefur heiti, eiginleika, gerðir og flokka sniðmáts skemans, og eigið sett byrjar ekki
  eins og Pset;
- **QTY001**: magnsett (Qto_) fylgir sniðmátinu og hefur MethodOfMeasurement BaseQuantities;
- **GRF001**, **GRF003** og **GRF005**: öll samhengi hafa sömu hnitaaðgerð, líkan með byggingu hefur hnitakerfi, og kvarði
  kortavörpunarinnar passar við einingarnar;
- **SPS007**: byggingarhlutar liggja í rýmisskipaninni, og hluti af byggingarhluta liggur ekki jafnframt í hæð;
- **OJT001**: PredefinedType er á gerðinni eða á hlutnum, ekki báðum, og USERDEFINED hefur heiti;
- **PJS003**: hvert GlobalId hefur 22 leyfð tákn og byrjar á 0–3, og ekkert GlobalId er notað tvisvar.

Hver niðurstaða ber kóða reglunnar. Það sem buildingSMART telur samkomulag gefur villur, sem hindra samþykktina eins og skemavillur;
starfsvenjur (PSE002, GRF003 og GRF005) gefa viðvaranir, sem standa sér. Aðeins það sem breytingasettið veldur telst með: það sem þegar
var í líkaninu hindrar ekkert. Gervigreindin fær reglurnar sem halda ekki eftir hverja forskoðun og lagar þær, eins og hún gerir með
grannfræðina. Forritið hefur ekki allt reglusafnið: GRF005 þekkir einingu hnitakerfisins fyrir norrænu kóðana sem forritið skrifar eða
út frá MapUnit þess, og SWE001 fylgir fjöllínum, vísuðum ferlum og samsettum ferlum úr þeim. Allt safnið á heima á þjóninum.

Þess vegna skrifar forritið ekki heldur sjálft það sem IFC102 úreldir. Í IFC4 og síðar verður klæðning með `host` hluti af
byggingarhlutanum sem hún klæðir (IfcRelAggregates) eða liggur í rýminu, í stað IfcRelCoversBldgElements og IfcRelCoversSpaces, og
fjöldi þrepa og mál stigans standa aðeins í Pset_StairFlightCommon. Í IFC 4.3 standa eiginleikar karms og hurðarblaða í
Pset_DoorLiningProperties, Pset_DoorPanelProperties og Pset_WindowLiningProperties, sem koma í stað IfcDoorLiningProperties og hinna.
Staðlað sett sem kom fyrst með IFC4, til dæmis Pset_Condition í IFC2X3-skrá, gefur aðeins viðvörun frá PSE001.

*Samþykkja* keyrir að auki EXPRESS-reglur skemans (WHERE-reglur og föll) með IfcOpenShell; pytest er sótt fyrir þær sem íhlutur í
fyrsta sinn. Breytingasett sem brýtur reglu sem líkanið uppfyllti áður er ekki samþykkt, og skilaboðin nefna regluna; biddu
gervigreindina að laga breytingasettið og samþykktu aftur. Í líkani með fleiri en 300.000 tilvik er EXPRESS-reglunum sleppt, og
annállinn segir frá því.

## Grunnupplýsingar

Spjaldið **Grunnupplýsingar** í Athuga prófar líkan gegn grunnreglum Praxi, leiðbeininga BIM Alliance um IFC, hér með eigin orðum
forritsins; engir textar, gildalistar eða sniðmát úr Praxi fylgja forritinu. Spjaldið les líkanið þegar þú ýtir á hnappinn:

- haus skrárinnar tilgreinir sýn (MVD), forritið sem skrifaði skrána, forvinnsluna og tímann (höfundur og stofnun birtast ekki);
- líkanið hefur varpað hnitakerfi með einum EPSG-kóða, kortavörpun og hæðarkerfi;
- verkefnið, lóðin, byggingin og hæðirnar hafa heiti, byggingin einnig langt heiti og hæðirnar lýsingu;
- hvert herbergi hefur númer í Name, og ekkert númer er notað tvisvar í sömu byggingu;
- eigið eiginleikasett byrjar ekki eins og sett IFC (Pset_, Qto_), byrjar á landskóða (SE-…), hefur aðeins A–Z, tölustafi, - og _, og
  eiginleika í PascalCase án å, ä og ö;
- ekkert gildi ber einingu sína: 40, ekki „40 dB“.

Hver athugun birtist sem uppfyllt, þarf að skoða eða villa, með fyrstu dæmunum. IDS getur ekki prófað haus skrárinnar eða að eitthvað
sé einstakt, og þess vegna er þetta sérstakt spjald.

## IDS-skrár forritsins

Forritið hefur eigin IDS-skrár í `presets/ids/`, skrifaðar eftir opnum reglum:

- **SE-Dataspatium_Grund.ids**: heiti á lóð, byggingu, hæðum og herbergjum, engir staðgengilshlutar, og PredefinedType á plötum,
  þökum, hurðum, gluggum og klæðningum (USERDEFINED er samþykkt með heiti).
- **SE-Dataspatium_Klimatdeklaration.ids**: LoadBearing á veggjum, plötum, þökum, súlum og bitum, IsExternal á veggjum, hurðum og
  gluggum, efni á byggingarhlutunum, flokkur á hverju efni og grunnmagn: það sem bráðabirgðaloftslagsyfirlýsingin les.

IDS nefnir flokk án undirflokka hans, svo IFC4-flokkarnir …StandardCase hafa eigin forskriftir, og forskrift gildir aðeins um þær
IFC-útgáfur sem hún tilgreinir. Lýsingin velur skrá eftir tilganginum, og IDS-prófun í Greina getur keyrt þær.

## Bera saman útgáfur

Hnappurinn *Bera saman* í líkansýninni ber opna líkanið saman við vistaða útgáfu sama gagnasafns (Útgáfur í Vinna) eða við annað
IFC-líkan í vinnusvæðinu, til dæmis nýrri útgáfu sem sótt var frá CDE. Einingar eru paraðar á GlobalId; spjaldið telur upp hvað er
aðeins hér, aðeins í hinni og hvað breyttist, eigind fyrir eigind og eiginleika fyrir eiginleika. Í þrívídd er það sem er aðeins hér
grænt og það sem breyttist gult; *Sýna hina útgáfuna* teiknar hina skrána í staðinn með það sem er aðeins þar rautt. *Merkja* setur
muninn í valið. Engu er breytt; sami samanburður fær síðar diff-API Dataregium sem uppsprettu.

Fyrir líkan sem sótt var frá Dataregium sýnir spjaldið líka *Breytingasett þjónsins*: breytingarnar sem gáfu sóttu útgáfuna á
þjóninum, þegar hún var samþykkt úr breytingatillögu, með málinu, hver lagði til og samþykkti, grunnútgáfunni (útgáfunni sem tillagan
var reynd á) og hverri breytingu með tilviki, eigindi, gömlu og nýju gildi. *Merkja* merkir tilvikin í líkaninu. Útgáfa sem hlaðið var
upp sem heilli skrá hefur ekkert breytingasett. Það er þriðja uppsprettan við hlið svipmyndanna og hinna líkananna.

Með *Útgáfur þjónsins* eru hinar útgáfur skjalsins á Dataregium sóttar sem valkostir í listann *Bera saman við*. Veljir þú eina
þeirra reiknar þjónninn samanburðinn (mismun hans milli útgáfa, eftir GlobalId og eigindi, með staðsetningu, lögun, íláti og gerð sem
eigin reitum) og hann er sýndur sem sömu listar og litir hér, en án hinnar útgáfunnar í þrívídd; sæktu þá útgáfu til að sjá hana.
