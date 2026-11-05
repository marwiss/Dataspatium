# CAD og BIM: byggingarlíkön og teikningar

Dataspatium opnar byggingarlíkön í IFC og teikningar í DXF sem sérstaka tegund gagnasafns. Líkanið er teiknað í þrívídd,
byggingarhlutarnir verða að töflu og hægt er að leita í eiginleikum og magni, reikna það og flytja út. Allt gerist í
vafranum: skráin fer aldrei úr tölvunni. Upprunalega skráin er vistuð í gagnasafninu og fylgir pökkum og öryggisafritum.

## Að opna líkan

Slepptu `.ifc`-, `.ifczip`- eða `.dxf`-skrá í Sækja. Upplýsingar um skrána birtast (skema, verkefni, forrit, hæðir og fjöldi
eftir gerð) og *Flytja inn* býr til gagnasafnið. IFC2X3, IFC4 og IFC4X3 á STEP-sniði eru studd. Innflutningur um 50 MB líkans
tekur um fjórðung úr mínútu og það opnast síðan á nokkrum sekúndum.

## Líkanið í Vinna

Líkanið opnast sem þrívíddarsýn með töflu yfir byggingarhlutana fyrir neðan. Dragðu til að snúa, skrunaðu til að þysja og
dragðu með hægri hnappi til að færa. Ramminn sýnir allt líkanið; stakir hlutir langt frá byggingunni eru ekki taldir með.

- **Velja**: smelltu á byggingarhluta í líkaninu eða röð í töflunni. Valið fylgir og skoðarinn sýnir gerð, hæð, efni, flokkun,
  eiginleika og magn, ásamt yfirborði og rúmmáli mældu á rúmfræðinni.
- **Sía**: veldu gerð eða hæð, eða leitaðu að heiti, efni eða eiginleika. Taflan og líkanið sýna sama úrval.
- **Sýna sem töflu**: allir dálkar sem venjuleg tafla með öllum verkfærum í Vinna.
- **Vista sem graf**: sýnin með síu og sjónarhorni verður að grafi í Myndgera.

Rúmfræðin er reiknuð úr upprunalegu skránni í fyrsta sinn sem líkanið opnast í lotu og er aðeins notuð til að teikna og mæla.
Töflurnar eru áfram til þótt tölvuna vanti WebGL; þá birtast skilaboð í stað þrívíddarsýnarinnar.

## Mál frá CDE

Líkan sem sótt var frá OpenCDE-þjóni, eða hvaða líkan sem er þegar slíkur þjónn er gagnalind, getur sýnt málin sín:
hnappurinn *Mál* í líkansýninni opnar spjald í skoðaranum með BCF-málum verkefnisins. Þau sem vísa á byggingarhluta í þessu
líkani koma fyrst, með stöðu og fjölda byggingarhluta. Smelltu á mál, þá eru byggingarhlutarnir merktir í 3D-sýninni og
spjaldið sýnir lýsingu, skyndimynd og athugasemdir. Málin eru sótt þegar þú biður um það og eru ekki vistuð í gagnasafninu;
til að reikna með þeim vistar þú þau sem töflu í Sækja. Þetta er lestur; að búa til og breyta málum kemur í næstu útgáfu.

Með réttindum til þess er einnig hægt að skrifa. *Nýtt mál* býr til mál á þjóninum með fyrirsögn, tegund, stöðu og merkjum úr
listum verkefnisins, og sýnin fylgir með sem viewpoint: myndavélin, skyndimynd og merktu byggingarhlutarnir sem íhlutir. Í völdu
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

Líkan grafsins, venslin og fyrirspurnirnar frá hlið Dataspatium eru í [ifcgraph.md](https://github.com/marwiss/Kontroll/blob/main/docs/ifcgraph.md) hjá Kontroll.

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

## DXF-teikningar

DXF-skrá verður að töflu með einum teikningarhlut í hverri röð (gerð, lag, litur, lengd, flatarmál, texti og staðsetning) og
SVG-teikningu. Teikningin opnast í Vinna, þar sem þú þysjar með hjólinu og færir með því að draga. Kveikt er og slökkt á
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
