# Kort

Gagnasafn með rúmfræði eða hnitum er kort. Í Vinna opnast það sem kort til að þysja og færa, í Myndgera verður það
vistuð **kortasýn** með mörgum lögum fyrir stjórnborð, kynningar og birtingu, og í Greina er flipinn **Geo** með
landfræðitólum án kóða. Kortin eru teiknuð með Leaflet; rúmfræðin er reiknuð með Turf. Ekkert er sótt af netinu fyrr
en þú velur bakgrunnskort og gefur samþykki þitt.

## Hvað telst landupplýsingar

| Landupplýsingar | Þekkist á |
|---|---|
| Rúmfræðidálkur | Textadálkur með GeoJSON eða WKT, oftast `geometry` (innflutningur á GeoJSON, Shapefile, GeoPackage, KML, GPX og TopoJSON gefur hann) |
| Hnitadálkar | Tveir töludálkar fyrir lengd og breidd (`lon`/`lat`, `longitude`/`latitude`, `x`/`y` og fleiri) |
| Vörpuð hnit | Umreiknuð í WGS 84 með hnitakerfi skrárinnar, eða sem SWEREF 99 TM þegar skráin gefur ekkert upp (sjá [Hnitakerfi](#hnitakerfi)) |

Gagnasöfn með rúmfræðidálki eða dálkum sem heita lengd og breidd opnast beint sem kort; fyrir aðra hnitadálka (til
dæmis `x` og `y`) velur þú *Sýna sem kort* í tækjastiku töflunnar.

Landupplýsingar má einnig sækja beint úr opnum þjónustum: *Bæta við landupplýsingauppsprettu* í Safna gerir uppsprettu
úr WFS-, OGC API Features- eða ArcGIS-þjónustu, og uppsprettan *Geodataportalen* finnur þjónustur í sænsku landsskránni.
Svörin fá rúmfræðidálk og opnast sem kort. Sjá [kallor.md](kallor.md#opin-landupplýsingagögn).

Heiti duga ekki. Forritið athugar líka gildin: rúmfræðidálkur verður að innihalda rúmfræði og hnit verða að vera í gráðum eða í vörpuðu kerfi. Dálkar sem heita aðeins x og y teljast hnit þegar gildin eru vörpuð, því litlar tölur undir þeim heitum eru oftast eitthvað annað. Töflu með hnitum má flytja út sem GeoJSON með punktum.

Ef hnitin eru í öðru kerfi en SWEREF 99 TM velur þú það við innflutning, til dæmis RT 90 eða UTM-belti. Forritið bætir þá við dálkum í gráðum og varðveitir upprunalegu gildin.

## Kortið í Vinna

Kortið sýnir fitjur gagnasafnsins í lit forritsins. Þysjaðu með hjólinu eða hnöppunum, færðu með því að draga (kvarðinn neðst til vinstri sýnir fjarlægðina í metrum), og
smelltu á fitju til að sjá eigindi hennar í skoðaranum; *Breyta í töflunni* fer með þig á röðina í töflunni.
Tækjastikan hefur bakgrunnskort (ekkert, OpenStreetMap eða [loftmynd](#loftmyndir)), *Þysja að öllu*, *Vista sem kortasýn* (vistar kortið með
lögum og núverandi sýn sem myndrit í Myndgera) og *Sýna sem töflu*. Allt sem þú gerir í töflunni (sía, leiðrétta, eyða
röðum) sést á kortinu.

Stór gagnasöfn eru teiknuð á striga; 10 000 marghyrningar færast án hiks. Fleiri en 50 000 fitjur í lagi eru ekki
teiknaðar (mörkin má hækka fyrir hvert lag í kortasýninni).

Myndasöfn með staðsetningu hafa hnappinn *Sýna á kortinu*. Smelltu á stað og skoðarinn sýnir myndina. Tafla þar sem raðir nefna myndir sýnir þær á sama hátt. *Nota það sem sést* gerir það sem kortið sýnir núna að vali sem fylgir í aðra hami. Í kortasýn í Myndgera geta myndasöfn og skipulög verið lög.

## Kortasýnir í Myndgera

*Nýtt myndrit → Kort* býr til kortasýn með valda gagnasafnið sem fyrsta lag. Stillingarnar til vinstri:

- **Bakgrunnskort**: ekkert (sjálfgefið), OpenStreetMap, [loftmynd](#loftmyndir) eða eigin kortaþjónn með slóðarmynstri eins og
  `https://…/{z}/{x}/{y}.png` og heimildartexta, eða **WMS-þjónusta** (vistfang, lög, myndsnið og gegnsæi; *Lesa lög* sækir lagalista
  þjónustunnar). Bakgrunnskort eru sótt af netinu og spurt er um samþykki í fyrsta
  sinn (tilgangurinn *Bakgrunnskort* undir Umsjón → Netaðgangur).
- **Lög**: bættu við fleiri gagnasöfnum eða meðfylgjandi mörkum (lén og sveitarfélög í Svíþjóð, Danmörku, Noregi og
  Finnlandi) eða **WMS-lagi** (myndir úr kortaþjónustu, dregnar undir fitjunum með völdu gegnsæi; það hefur engar
  skýringar og fylgir ekki með í útflutningi í SVG, PNG og PDF). Hvert lag hefur heiti, sýnileika, röð, lit, fyllingu, línubreidd og punktastærð, rúmfræði- eða
  hnitadálka, lit eftir dálki (flokkar með litaspjaldi forritsins eða bil með raðkvarða, fjöldi bila), merki (sýnt
  þegar bendillinn hvílir á fitju) og hámarksfjölda fitja.
- **Sýn**: *Vista núverandi sýn* læsir miðju og þysjun kortsins; annars er kortið fellt að lögunum. Skýringum og hæð má
  breyta.

Skoðarinn sýnir skýringarnar og fitjuna sem þú smelltir á. Kortasýn er flutt út í SVG, PNG og PDF, keyrð í hóp fyrir
hvern flokk, verður PowerPoint og má setja í skjalasniðmát með `{{diagram "Heiti"}}`. Útflutningurinn teiknar lögin
án bakgrunnskorts. Í stjórnborðum, kynningum og birtu HTML er kortið gagnvirkt; birt HTML fær Leaflet innfellt og
fitjurnar sem GeoJSON, og bakgrunnskortið sækir þá vafri lesandans.

## Loftmyndir

Hornrétt loftmynd (réttmynd) er loftmynd sem hefur verið leiðrétt svo hún liggi eins og kort. Þrjár opnar loftmyndir eru í vali á
bakgrunnskorti í Vinna, í kortasýnum í Myndgera, á skipulagskortinu og undir staðsetningu nýrrar byggingar (sjá [cad-bim.md](cad-bim.md)):

| Loftmynd | Útgefandi og þjónusta | Hnitakerfi | Leyfi og tilvísun | Lykill |
|---|---|---|---|---|
| Danmörk: GeoDanmark ortofoto forår | Klimadatastyrelsen, WMS á `wms.datafordeler.dk` | Web Mercator, ETRS89 / UTM 32N (25832) | CC BY 4.0, "GeoDanmark ortofoto forår © Klimadatastyrelsen" | Ókeypis API-lykill frá Datafordeleren: stofnaðu notanda með netfangi á portal.datafordeler.dk og síðan API-lykil (gildir í tvö ár) |
| Finnland: Ortokuva | Maanmittauslaitos, WMTS á `avoin-karttakuva.maanmittauslaitos.fi` | Web Mercator | CC BY 4.0, "Ortokuva © Maanmittauslaitos" | Ókeypis API-lykill frá Maanmittauslaitos: stofnaðu aðgang í Oma tili (omatili.maanmittauslaitos.fi) og síðan nýjan API-lykil |
| Ísland: Grunnkort – Loftmynd | Náttúrufræðistofnun, WMS á `gis.natt.is` | Web Mercator, ISN93 (3057) | CC BY 4.0, "Grunnkort – Loftmynd © Náttúrufræðistofnun" | Enginn |

- Tilvísunin og leyfið standa í horni kortsins á meðan loftmyndin er sýnd.
- Myndirnar eru aðeins sóttar þegar þú velur loftmynd, eftir samþykki fyrir *Bakgrunnskort*; spurningin nefnir hýsil þjónustunnar.
- Þurfi loftmyndin lykil spyr forritið um hann þegar þú velur hana. Lykillinn gildir í lotunni eða er vistaður dulkóðaður með
  lykilsetningu eins og aðrir lyklar forritsins, er aðeins sendur til eigin þjónustu í slóðum myndanna og er aldrei vistaður í kortasýninni.
  Birt HTML tekur aðeins með loftmyndir sem þurfa ekki lykil.
- Á skipulagskortinu í eigin hnitakerfi skipulagsins eru þær loftmyndir sem þjónustan býður í því kerfi (Danmörk í UTM 32N, Ísland í ISN93).
- Mósaík Íslands nær enn ekki yfir allt landið og er stækkuð á hverju ári. Opin þjónusta Finnlands gefur myndirnar upp að aðdráttarstigi 16
  og stækkar þær eftir það.
- Svíþjóð og Noregur hafa engar opnar loftmyndaþjónustur: Ortofoto Visning frá Lantmäteriet ber leyfisgjald, og Norge i bilder er aðeins
  opin meðlimum Norge digitalt. Loftmyndir Lantmäteriet eru opin gögn (CC BY 4.0) sem skrár til niðurhals (STAC), en forritið sýnir þær
  ekki sem kort enn.

## Landfræðitól í Greina

Þegar gagnasafn með rúmfræði er valið fær Greina flipann **Geo** (eftir Regex). Allar niðurstöður eru töflur með
dálkinum `geometry` sem má vista sem gagnasafn með *Búa til gagnasafn* og opna sem kort.

| Tól | Hvað það gerir |
|---|---|
| Mál | Flatarmál (km²), lengd (km), miðja (lengd, breidd) og útbreiðsla hverrar fitju |
| Punktar í svæðum | Telur punkta í hverju svæði (og leggur saman gildisdálk) eða gefur hverjum punkti eigindi svæðisins |
| Næst | Fyrir hverja fitju næsta fitja í öðru gagnasafni með fjarlægðinni í km |
| Jaðarsvæði | Svæði í valinni fjarlægð í metrum umhverfis hverja fitju |
| Yfirlögn | Skurður tveggja svæðagagnasafna (ein fitja fyrir hvert skarandi par með báðum eigindasettum og sameiginlegu flatarmáli) eða mismunur (það sem eftir er af fyrsta laginu) |
| Sameining | Sameinar svæði með sama gildi í dálki (eða öll) í eina fitju með fjölda og flatarmáli |
| Einföldun | Einfaldar rúmfræði með völdu þoli í metrum og sýnir fjölda punkta fyrir og eftir |

Tólin vinna í vafranum án nets og í áföngum svo síðan svari; mjög stór gagnasöfn (tugþúsundir flókinna marghyrninga)
taka tíma. Mál og hnitaumreikningur eru líka uppskriftarskref í Vinna (hópurinn Landupplýsingar).

## QGIS-verkefni

Slepptu verkefnaskrá (`.qgs` eða `.qgz`) í Sækja, helst með gagnaskránum (GeoPackage, GeoJSON, Shapefile sem ZIP).
Dataspatium les lagaröðina, sýnileikann og táknin (eitt tákn, flokka eða bil með litum, línubreiddum og
punktastærðum) og parar hvert lag við gagnasafn með sama skráarheiti (og lagheiti fyrir GeoPackage); meðfylgjandi
skrár sem vantar eru fluttar inn fyrst. Niðurstaðan er kortasýn í Myndgera. Rastalög, merkingar, áhrif og reglubundin
tákn umfram fyrstu reglu eru ekki tekin með.

## Hnitakerfi

GeoPackage-skrá, shape-skrá (með `.prj`) og GeoJSON-skrá með `crs` gefa upp hnitakerfi sitt. Forritið notar það þegar
kortið er teiknað, þegar staðbundin leit leitar að stöðum og þegar gagnasafnið er flutt út með rúmfræði; hnitin í
töflunni haldast eins og þau standa í skránni. Gefi skráin ekkert kerfi upp eru vörpuð hnit tekin sem SWEREF 99 TM.
Forritið umreiknar þessi kerfi:

| Kerfi | EPSG |
|---|---|
| SWEREF 99 TM og tólf staðbeltin (SWEREF 99 12 00 til 23 15) | 3006, 3007–3018 |
| RT 90 2,5 gon V, með beinni vörpun Lantmäteriet | 3021 |
| ETRS89 og WGS 84 / UTM 32–35 (Danmörk, Noregur, Finnland) | 25832–25835, 32632–32635 |
| ETRS-TM35FIN og finnsku GK-beltin | 3067, 3873–3885 |
| ISN93 / Lambert 1993 (Ísland) | 3057 |
| Web Mercator | 3857 |
| WGS 84 og ETRS89 í gráðum | 4326, 4258 |

Umreikningurinn stemmir við PROJ (sem QGIS notar) innan millimetra; RT 90 2,5 gon V innan tveggja desímetra, því bein
vörpun er einföldun. Gefi skrá upp annað kerfi, til dæmis RT 90 í öðru belti eða eldra staðbundið kerfi sveitarfélags,
segir Sækja frá og kortið teiknar ekki staðina í stað þess að teikna þá vitlaust; umreiknaðu skrána fyrst í SWEREF 99,
til dæmis í QGIS. Kortin hér eru teiknuð í Web Mercator með norður upp; skipulag má einnig sýna í eigin kerfi (sjá
[planer.md](planer.md#hnitakerfi-og-hæðir)).

## Takmarkanir

- Bakgrunnskort og birt HTML með bakgrunnskorti þurfa net; forritið sjálft sendir engar beiðnir án samþykkis.
- Hnitakerfi: þau sem eru talin upp undir [Hnitakerfi](#hnitakerfi). Önnur þarf að umreikna fyrir innflutning (til dæmis í QGIS);
  forritið segir frá og teiknar þau ekki.
- Útflutningurinn teiknar lögin, ekki bakgrunnskortið eða WMS-lög.
- Jaðarsvæði og yfirlagnir eru flatarreikningar á WGS 84-hnitum með Turf; á kílómetrakvarða á Norðurlöndum er villan
  lítil, fyrir mjög stór svæði merkjanleg.
