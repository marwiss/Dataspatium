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
| SWEREF 99 TM | Þekkist á gildunum og er umreiknað í WGS 84 við teikningu |

Gagnasöfn með rúmfræðidálki eða dálkum sem heita lengd og breidd opnast beint sem kort; fyrir aðra hnitadálka (til
dæmis `x` og `y`) velur þú *Sýna sem kort* í tækjastiku töflunnar.

Landupplýsingar má einnig sækja beint úr opnum þjónustum: *Bæta við landupplýsingauppsprettu* í Safna gerir uppsprettu
úr WFS-, OGC API Features- eða ArcGIS-þjónustu, og uppsprettan *Geodataportalen* finnur þjónustur í sænsku landsskránni.
Svörin fá rúmfræðidálk og opnast sem kort. Sjá [kallor.md](kallor.md#opin-landupplýsingagögn).

Heiti duga ekki. Forritið athugar líka gildin: rúmfræðidálkur verður að innihalda rúmfræði og hnit verða að vera í gráðum eða í vörpuðu kerfi. Dálkar sem heita aðeins x og y teljast hnit þegar gildin eru vörpuð, því litlar tölur undir þeim heitum eru oftast eitthvað annað. Töflu með hnitum má flytja út sem GeoJSON með punktum.

Ef hnitin eru í öðru kerfi en SWEREF 99 TM velur þú það við innflutning, til dæmis RT 90 eða UTM-belti. Forritið bætir þá við dálkum í gráðum og varðveitir upprunalegu gildin.

## Kortið í Vinna

Kortið sýnir fitjur gagnasafnsins í lit forritsins. Þysjaðu með hjólinu eða hnöppunum, færðu með því að draga, og
smelltu á fitju til að sjá eigindi hennar í skoðaranum; *Breyta í töflunni* fer með þig á röðina í töflunni.
Tækjastikan hefur bakgrunnskort (ekkert eða OpenStreetMap), *Þysja að öllu*, *Vista sem kortasýn* (vistar kortið með
lögum og núverandi sýn sem myndrit í Myndgera) og *Sýna sem töflu*. Allt sem þú gerir í töflunni (sía, leiðrétta, eyða
röðum) sést á kortinu.

Stór gagnasöfn eru teiknuð á striga; 10 000 marghyrningar færast án hiks. Fleiri en 50 000 fitjur í lagi eru ekki
teiknaðar (mörkin má hækka fyrir hvert lag í kortasýninni).

Myndasöfn með staðsetningu hafa hnappinn *Sýna á kortinu*. Smelltu á stað og skoðarinn sýnir myndina. Tafla þar sem raðir nefna myndir sýnir þær á sama hátt. *Nota það sem sést* gerir það sem kortið sýnir núna að vali sem fylgir í aðra hami. Í kortasýn í Myndgera geta myndasöfn og skipulög verið lög.

## Kortasýnir í Myndgera

*Nýtt myndrit → Kort* býr til kortasýn með valda gagnasafnið sem fyrsta lag. Stillingarnar til vinstri:

- **Bakgrunnskort**: ekkert (sjálfgefið), OpenStreetMap eða eigin kortaþjónn með slóðarmynstri eins og
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

## Takmarkanir

- Bakgrunnskort og birt HTML með bakgrunnskorti þurfa net; forritið sjálft sendir engar beiðnir án samþykkis.
- Vörpun: WGS 84 og SWEREF 99 TM. Önnur hnitakerfi þarf að umreikna fyrir innflutning (til dæmis í QGIS).
- Útflutningurinn teiknar lögin, ekki bakgrunnskortið eða WMS-lög.
- Jaðarsvæði og yfirlagnir eru flatarreikningar á WGS 84-hnitum með Turf; á kílómetrakvarða á Norðurlöndum er villan
  lítil, fyrir mjög stór svæði merkjanleg.
