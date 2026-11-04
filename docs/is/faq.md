# Algengar spurningar

## Hvar eru gögnin mín geymd?

Í eigin gagnagrunni vafrans (IndexedDB) á þeirri tölvu og í því vafrasniði sem þú notar. Ekkert er sent neitt. Ef þú hreinsar
vefgögn, skiptir um snið eða fjarlægir vafrann hverfa gögnin. Taktu því afrit undir *Umsjón → Vinnusvæði*, eða notaðu færanlega
möppu í Edge og Chrome svo vinnusvæðið sé líka til sem venjulegar skrár á diski (sjá [kom-igang.md](kom-igang.md)).

## Þarf ég net?

Nei. Net þarf aðeins þegar þú sækir gögn úr vefþjónustu, sendir á eða sækir frá GitHub, smellir á *Leita að
uppfærslum* eða notar eitthvað sem fylgir ekki í möppunni: sumir íhlutir (til dæmis grunnkort) og R-pakkar utan
innbyggða úrvalsins eru sóttir þegar þeirra er þörf og síðan vistaðir á tölvunni. Í fyrsta skipti sem forritið þarf
netið í einhverjum tilgangi spyr það um leyfi; svarið má vista og breyta undir *Umsjón → Vinnusvæði → Netaðgangur*,
þar sem dagbókin yfir köll er líka. Allt annað, líka R, virkar án nettengingar.

## Af hverju tekur það tíma í fyrsta skipti sem ég nota R?

R er hlaðið sem WebAssembly (um 50 MB) og ræsist á nokkrum sekúndum. Pakkar eins og ggplot2 eru settir upp í R-setunni þegar þú
notar þá í fyrsta skipti, sem tekur nokkrar sekúndur til viðbótar. R-setan byrjar upp á nýtt þegar þú endurhleður síðuna, en
gagnasöfnin þín og skriftur eru áfram til.

## Get ég rofið R-kóða sem hefur fest?

Já, þegar forritið keyrir af vefþjóni (til dæmis `python -m http.server 8080` á eigin tölvu, eða https á innraneti): þá
er hnappurinn *Stöðva* við hliðina á *Keyra* í R-flipanum, og R-lotan með hlutum sínum helst. Þegar forritið er opnað
úr möppu (file://) leyfir vafrinn ekki þann búnað sem þarf; notaðu þá *Endurræsa R* í Greina. Gagnasöfnin verða ekki
fyrir áhrifum.

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

Já. Settu möppuna óbreytta á hvaða kyrrstæðan vefþjón sem er; enga þjónsvirkni þarf. Yfir https, og á eigin tölvu
yfir `http://localhost`, skráir forritið þjónustuvinnsluna (service worker) `sw-coi.js` sem gerir síðuna *cross-origin
isolated*, og þá er hægt að stöðva R-kóða. Í fyrsta skipti hleðst síðan einu sinni aftur þegar hún tekur við. Yfir
venjulegt http á innraneti leyfir vafrinn engar þjónustuvinnslur, en þjónn sem sjálfur sendir hausana
`Cross-Origin-Opener-Policy: same-origin` og `Cross-Origin-Embedder-Policy: credentialless` gefur það sama. Allt annað
virkar eins og úr möppunni. Vafrinn geymir gögn eftir vefslóð, svo vinnusvæðið í möppunni og það á þjóninum eru aðskilin;
færðu á milli með afriti eða pakka.

Af vefþjóni, líka <https://marwiss.github.io/Dataspatium/>, má setja forritið upp sem sjálfstætt forrit: í Edge og
Chrome um táknið *Setja upp* í veffangastikunni eða valmynd vafrans. Það fær þá eigin glugga og eigið tákn, skrárnar
eru vistaðar í vafranum svo það virki án nets, og geymslan verður varanleg. Nýjar útgáfur eru sóttar þegar forritið
er opnað aftur með neti.

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

Einfaldast í hamnum *Deila*: undir *Pakki* velurðu gagnasöfn og hvort myndrit, mælaborð, snið, minnisbækur og
skriftur eigi að fylgja, skrifar skilaboð og sendir ZIP-skrána, til dæmis um flipann *Deilivalmynd* (tölvupóstur,
Teams og önnur forrit). Samstarfsmaðurinn opnar hana undir *Taka á móti*, sér skilaboð þín og hvað hefur breyst og
getur skipt út eigin útgáfum. Athugasemdir, möppur og merki fylgja með. Séuð þið á sama neti fer pakkinn beint milli tölvanna eða um símann
(flipinn *Tæki*, sjá [mobil.md](mobil.md)). Ef þið vinnið í sama vinnusvæði getið þið líka notað sameiginlegt
GitHub-safn (flipinn *GitHub*). Áður en nokkuð fer úr forritinu eru gagnasöfnin yfirfarin með tilliti til
persónuupplýsinga, sem má dulnefna eða fjarlægja í afritinu. Mælaborð og skjöl má birta sem sjálfstæðar HTML-skrár
(flipinn *Birta*). Þú getur líka flutt út eitt gagnasafn sem SQLite (heldur gerðum, merkimiðum, athugasemdum og
sögu) eða tekið afrit af öllu vinnusvæðinu. Myndrit og skjalasnið má flytja út sem JSON-skrár, API-uppsetningar sem
`.api.json` og uppskriftir sem JSON, R eða SQL. Sjá [dela.md](dela.md).

## Hvernig opna ég grunnnámskeiðið aftur?

Smelltu á spurningarmerkið efst til hægri og veldu *Opna grunnnámskeiðið*, eða ýttu á Ctrl+K og skrifaðu *námskeið*.
Námskeiðið heldur áfram þar sem frá var horfið; ef þú hefur lokið því byrjar það upp á nýtt. Það er til á öllum sex
tungumálunum.

## Hvernig held ég röð og reglu á mörgum gagnasöfnum?

Gefðu þeim möppur og merki: *Raða* í Umsjón, eða dragðu gagnasafn í möppu í hlutaspjaldinu. Möppur geta haft
undirmöppur (`Fjármál/2026`), síureiturinn leitar í heiti, merki og möppu, og gátreitirnir velja fleiri gagnasöfn
fyrir hópaðgerðir. Mappa og merki fylgja gagnasafninu í pökkum og afritum, og í R sýnir `dm_list()` möppuna.

## Hvað eru íhlutir?

Hlutar forritsins sem fylgja ekki í möppunni, til að halda henni lítilli: til dæmis grunnkort og R-pakkar utan
innbyggða úrvalsins. Þeir eru sóttir af fastri vefslóð þegar eitthvað þarf þá, eftir að þú hefur gefið leyfi, og
athugaðir gegn þekktri prófsummu þar sem slík er til. Síðan eru þeir vistaðir í vafranum og þarf ekki að sækja aftur.
Undir *Umsjón → Vinnusvæði → Íhlutir* sérðu hverjir eru til og hversu stórir þeir eru, og getur sótt þá fyrirfram eða
fjarlægt þá.

## Get ég notað forritið í símanum?

Allt forritið er gert fyrir tölvur, en síminn getur verið með: Dataspatium Farsími
(<https://marwiss.github.io/Dataspatium/m/>) tekur á móti pökkum og skrám frá tölvunni yfir staðarnetið, sýnir
töflurnar, sendir þær áfram og afhendir þær annarri tölvu. Opnaðu *Deila → Tæki* á tölvunni og skannaðu QR-kóðann;
sjá [mobil.md](mobil.md). Í spjaldtölvum í þjónsham má nota allt forritið: í þröngum gluggum sýnir hamavalið tákn
og spjöldin opnast sem yfirlagsspjöld yfir vinnuflötinn.

## Hvernig flyt ég gögn í síma án nettengingar?

Tölvan og síminn þurfa aðeins sama staðarnet; flutningurinn fer beint á milli þeirra með WebRTC og um engan þjón. Í
fyrsta skipti þarf síminn að sækja farsímasíðuna af vefnum (eða af eigin vefþjóni á innraneti); eftir það er hún í
skyndiminni. Sé ekkert sameiginlegt net: kveiktu á netdeilingu í símanum og tengdu tölvuna við hana. Sjá
[mobil.md](mobil.md).

## Hvar er hjálpin?

Í forritinu: hnappurinn **?** efst til hægri eða F1 opnar handbókina við kaflann fyrir haminn sem þú ert í, með leit
í öllum köflum og tenglum milli skjala. Sömu textar eru í [docs/](anvandarguide.md) á GitHub. Grunnnámskeiðið er
opnað úr handbókinni eða með Ctrl+K.

## Get ég sýnt mælaborð á stórum skjá?

Já. Opnaðu mælaborðið í Myndgera og smelltu á **Kynna**: mælaborðið fyllir gluggann, örvalyklarnir fara eitt myndrit
í einu, F gefur fullan skjá og Esc lýkur. Sameiginlegu síurnar haldast efst. Sjá [visualisera.md](visualisera.md).

## Finnurðu ekki svarið hér?

Lestu [anvandarguide.md](anvandarguide.md) eða stofnaðu issue á GitHub (sjá [CONTRIBUTING.md](../../CONTRIBUTING.md)).
