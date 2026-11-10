# CAD og BIM: byggingarlíkön og teikningar

Dataspatium opnar byggingarlíkön í IFC og teikningar í DXF sem sérstaka tegund gagnasafns. Líkanið er teiknað í þrívídd,
byggingarhlutarnir verða að töflu og hægt er að leita í eiginleikum og magni, reikna það og flytja út. Allt gerist í
vafranum: skráin fer aldrei úr tölvunni. Upprunalega skráin er vistuð í gagnasafninu og fylgir pökkum og öryggisafritum.

## Að opna líkan

Slepptu `.ifc`-, `.ifczip`- eða `.dxf`-skrá í Sækja. Upplýsingar um skrána birtast (skema, verkefni, forrit, hæðir og fjöldi
eftir gerð) og *Flytja inn* býr til gagnasafnið. IFC2X3, IFC4 og IFC4X3 á STEP-sniði eru studd. Innflutningur um 50 MB líkans
tekur um fjórðung úr mínútu og það opnast síðan á nokkrum sekúndum.

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

- Ekki er hægt að breyta líkaninu og engin ný IFC-skrá er skrifuð. Breytingar á töflunum hafa ekki áhrif á upprunalegu skrána.
- Líkan er teiknað aftur úr upprunalegu skránni í hverri nýrri lotu. 57 MB líkanið sem forritið var prófað með tekur 4–6 sekúndur.
- Fyrsta teikning mjög stórs líkans getur læst síðunni um stund á meðan skjákortið tekur við þríhyrningunum.
- Magnið er ekki magntaka samkvæmt neinum reglum. Berðu það saman við heimildina áður en það er notað.
- DXF er lesið í tveimur víddum. DWG þarf fyrst að vista sem DXF.
