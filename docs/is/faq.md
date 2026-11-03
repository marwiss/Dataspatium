# Algengar spurningar

## Hvar eru gögnin mín geymd?

Í eigin gagnagrunni vafrans (IndexedDB) á þeirri tölvu og í því vafrasniði sem þú notar. Ekkert er sent neitt. Ef þú hreinsar
vefgögn, skiptir um snið eða fjarlægir vafrann hverfa gögnin. Taktu því afrit undir *Umsjón → Vinnusvæði*, eða notaðu færanlega
möppu í Edge og Chrome svo vinnusvæðið sé líka til sem venjulegar skrár á diski (sjá [kom-igang.md](kom-igang.md)).

## Þarf ég net?

Nei. Net þarf aðeins þegar þú sækir gögn úr vefþjónustu eða smellir á *Leita að uppfærslum*. Allt annað, líka R, virkar án
nettengingar.

## Af hverju tekur það tíma í fyrsta skipti sem ég nota R?

R er hlaðið sem WebAssembly (um 50 MB) og ræsist á nokkrum sekúndum. Pakkar eins og ggplot2 eru settir upp í R-setunni þegar þú
notar þá í fyrsta skipti, sem tekur nokkrar sekúndur til viðbótar. R-setan byrjar upp á nýtt þegar þú endurhleður síðuna, en
gagnasöfnin þín og skriftur eru áfram til.

## Get ég rofið R-kóða sem hefur fest?

Nei. Undir file:// leyfir vafrinn ekki þann búnað sem þarf til að rjúfa R í miðjum útreikningi. Notaðu *Endurræsa R* í Greina;
gagnasöfnin verða ekki fyrir áhrifum.

## Af hverju virkar vefþjónusta ekki?

Oftast vantar CORS-stuðning, það er vafrinn má ekki lesa svarið. Þá getur Dataspatium aðeins náð til hennar gegnum milliþjón
sem þú rekur sjálf(ur) (stilling undir Sækja). Sumar vefþjónustur krefjast líka lykils. Sjá
[api-konfiguration.md](api-konfiguration.md), sem lýsir líka hvernig lykla er aflað.

## Hvernig eru API-lyklar vistaðir?

Annaðhvort aðeins í minni meðan setan stendur eða dulkóðaðir með lykilsetningu sem þú velur. Aldrei í hreinum texta, og þeir
fylgja aldrei með þegar þú deilir uppsetningu.

## Hversu stór gagnasöfn ræður forritið við?

Nokkrar milljónir raða í Edge og Chrome, heldur færri í Firefox; minni vafrans setur mörkin. Mældir tímar fyrir milljón raðir
eru í [utveckling.md](../utveckling.md) (á sænsku). Textaskrár sem eru 64 MB eða stærri eru lesnar í bútum, svo lesturinn sjálfur
krefst þess ekki að öll skráin rúmist í minni sem texti.

## Hvað greinir Firefox frá Edge og Chrome?

Útlit og virkni eru hin sömu, en Firefox hefur ekki möppuaðgang, svo færanlega mappan er ekki þar. Afrit sem ZIP virkar alls
staðar.

## Má keyra forritið af vefþjóni eða innra neti?

Já. Settu möppuna óbreytta á hvaða kyrrstæðan vefþjón sem er. Enga þjónsvirkni þarf.

## Get ég opnað index.html beint í ZIP-skránni?

Nei. Afþjappaðu ZIP-skrána fyrst (hægrismelltu og veldu *Extract all* í Windows) og opnaðu síðan `index.html` í afþjöppuðu
möppunni.

## Hvernig uppfæri ég?

Sæktu nýju útgáfuna og afþjappaðu hana í nýja möppu. Gögnin þín eru í vafranum, ekki í möppunni, svo þau eru áfram til þegar þú
opnar `index.html` nýju útgáfunnar á sömu tölvu og í sama vafra. Undir hjálparhnappnum er *Leita að uppfærslum*, sem ber útgáfu
þína saman við nýjustu útgáfuna á GitHub. Athugunin er aðeins gerð þegar þú smellir.

## Get ég skipt um tungumál?

Já. Í fyrsta skipti sem forritið er opnað velurðu tungumál; eftir það opnar tungumálahnappurinn efst til hægri (táknið með
bókstöfum) eða skipunin *Tungumál* í spjaldinu sama val. Sænska, danska, norska (bókmál), finnska, íslenska og enska eru í boði.
Forritið endurhleðst á valda tungumálinu þegar óvistaðar breytingar hafa verið vistaðar. Valið er vistað í vafranum, svo hver
tölva og snið hefur sitt eigið. Skjölunin er á sömu tungumálum í möppunni `docs`.

## Eru til upprunar frá öðrum norrænum löndum?

Já. Undir *Opnar vefþjónustur* í Sækja eru hagstofur Íslands, Danmerkur, Noregs, Finnlands, Svíþjóðar, Grænlands, Færeyja og
Álandseyja, Nordic Statistics, Veðurstofa Íslands, Lýðheilsustofnun Noregs, fyrirtækjaskrár Noregs og Finnlands, Kartverket,
MET Norway, Sotkanet, Digitraffic, Veðurstofa Finnlands og dönsku og finnsku gagnagáttirnar. Landahnapparnir fyrir ofan listann
velja hvaða landa upprunar birtast; valið er vistað í vafranum. Allir upprunar hafa verið athugaðir með tilliti til CORS og
krefjast ekki lykils. Sjá [api-konfiguration.md](api-konfiguration.md).

## Get ég haft forritið opið í mörgum flipum?

Já. Fliparnir deila sama vinnusvæði og halda hver öðrum upplýstum: ef þú vistar eða eyðir einhverju í einum flipa endurhlaða
hinir lista sína og skrá hvað gerðist. Breyttu samt ekki sama gagnasafni í tveimur flipum samtímis; ef báðir hafa óvistaðar
breytingar vinnur sá sem vistar síðast.

## Getur önnur staðbundin HTML-skrá lesið gögnin mín?

Í Edge og Chrome deila allar skrár sem opnaðar eru gegnum file:// sömu geymslu. Opnaðu því ekki óþekktar HTML-skrár
staðbundið meðan þú ert með viðkvæm gögn í forritinu. Lyklar eru aldrei vistaðir í hreinum texta. Firefox heldur staðbundnum
skrám aðskildum.

## Má ég nota forritið í vinnunni?

Já, ef vinnuveitandinn er stjórnvald, sveitarfélag, landshluti, skóli, háskóli eða félagasamtök sem ekki eru rekin í
hagnaðarskyni, það er óviðskiptaleg notkun. Viðskiptaleg notkun krefst leyfis leyfisveitanda. Sjá [licenser.md](licenser.md).

## Hvernig bý ég til kort?

Fyrir Svíþjóð: smelltu á *Sveitarfélagamörk Svíþjóðar (SCB)* eða *Lénamörk Svíþjóðar (SCB)* í Sækja; mörkin fylgja
forritinu. Fyrir önnur lönd, þar á meðal Ísland, flyturðu inn mörk úr GeoJSON, shapefile eða GeoPackage. Tengdu síðan gildin þín
við mörkin á kóðanum í Vinna (*Tengja gagnasöfn*) og veldu myndritagerðina *Kort* í Myndgera. Punktar með lengd og breidd (til
dæmis veðurstöðvar) eru teiknaðir með *Punktakorti*. Sjá [visualisera.md](visualisera.md).

## Hvernig sameina ég mörg gagnasöfn í einni SQL-fyrirspurn?

Hvert gagnasafn hefur stuttheiti (birtist undir heitinu í hlutaspjaldinu, breytt undir Umsjón > Endurnefna). Í SQL-flipanum
undir Greina heitir valda gagnasafnið `data` en næst líka með stuttheiti sínu, og öll önnur gagnasöfn nást með stuttheitum
sínum: `select k.kommun, b.folkmangd from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. Niðurstöðuna
má vista sem nýtt gagnasafn. Í R les `dm_read("stuttheiti")` sama gagnasafn. Sjá [bearbeta.md](bearbeta.md).

## Hvernig athuga ég að gögnin standist kröfur?

*Gagnagæði* í Vinna greina alla dálka og leggja til aðgerðir. *Reglur* leyfa þér að skrifa niður kröfur (má ekki vanta,
einkvæmt, bil, listi, mynstur, lengd eða SQL-skilyrði) og keyra þær eftir hvern innflutning; raðir sem bregðast má vista sem
sérstakt gagnasafn og hlaða niður niðurstöðunni sem skýrslu. Reglurnar eru vistaðar í gagnasafninu og fylgja því þegar þú deilir
því. Sjá [bearbeta.md](bearbeta.md).

## Get ég fjarlægt kennitölur áður en ég deili gagnasafni?

Já. Aðgerðin *Dulnefna* í Vinna skiptir auðkennum út fyrir söltuð tætigildi, hulin gildi eða raðnúmer, og gagnagæðasniðið
leggur hana til þegar dálkur virðist innihalda kennitölur. Þetta er dulnefning, ekki nafnleysing: aðrir dálkar geta enn bent á
einstaklinga, svo farðu yfir allt gagnasafnið áður en þú deilir því. Sjá [bearbeta.md](bearbeta.md).

## Hvernig deili ég gögnum með samstarfsmanni?

Einfaldast með *Deila pakka* undir *Umsjón → Vinnusvæði*: veldu gagnasöfn og hvort myndrit, mælaborð, snið og minnisbækur eigi
að fylgja, og sendu ZIP-skrána. Samstarfsmaðurinn sleppir henni á *Endurheimta úr ZIP*. Þú getur líka flutt út eitt gagnasafn
sem SQLite (heldur gerðum, merkimiðum og sögu) eða tekið afrit af öllu vinnusvæðinu. Myndrit og skjalasnið má flytja út sem
JSON-skrár, API-uppsetningar sem `.api.json` og uppskriftir sem JSON, R eða SQL.

## Finnurðu ekki svarið hér?

Lestu [anvandarguide.md](anvandarguide.md) eða stofnaðu issue á GitHub (sjá [CONTRIBUTING.md](../../CONTRIBUTING.md)).
