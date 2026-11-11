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

Net líkansins á þjóninum er teiknað og spurt úr *Sækja*, og hnappurinn *IFC-LPG* fer með þig þangað, sjá [grafer.md](grafer.md#ifc-lpg-á-dataregium-þjóni).

Líkan grafsins, venslin og fyrirspurnirnar frá hlið Dataspatium eru í [ifc-lpg.md](https://github.com/marwiss/Dataregium/blob/main/docs/is/ifc-lpg.md) hjá Dataregium.

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
Eftir veggi hverrar hæðar les forskoðunin grannfræði byggingarinnar: miðlínur veggjanna verða að herbergjum, og hæðin er lokuð þegar
veggirnir loka að minnsta kosti einu herbergi og enginn veggendi stendur laus; gervigreindin lagar lausa enda með því að færa veggi eða
bæta við veggjum áður en hún leggur plöturnar. Útveggirnir með áttum sínum gera gervigreindinni kleift að para ljósmynd af
suðurhliðinni við réttu veggina (lestrartólið `get_topology`), og sama grannfræði birtist á kortinu *Grannfræði* í Athuga.

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
kortavörpunina, það er upphafspunkt líkansins í austur- og norðurhnitum og snúning hans (ekki í IFC2X3, sem vantar hana). Tólin breyta
engu: þau fylla breytingasett sem spjaldið telur upp skref fyrir skref (mál í metrum; nýjar einingar fá tilvísanirnar new-1, new-2 … þar
til skráin hefur gefið þeim auðkenni).

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
með IFC-LPG-eininguna á) sýnir spjaldið niðurstöðu prófunarinnar undir málinu: hve mörgum breytingum var hægt að beita á
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
