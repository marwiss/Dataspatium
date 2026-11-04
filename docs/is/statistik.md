# Tölfræði, tímaraðir og líkön

Flipinn **Tölfræði** í Greina gerir algengar greiningar með eyðublöðum. Eyðublaðið skrifar kóðann á meðan þú fyllir það út, svo þú sérð
hvað er keyrt og getur tekið kóðann með þér. **Tímaraðaaðgerðirnar** í Vinna undirbúa raðir úr SDMX og PxWeb. **Líkan** úr aðhvarfi má
vista og nota sem uppskriftarskrefið *Spá* á ný gögn.

## Flipinn Tölfræði

Veldu gagnasafn og verkfæri, fylltu út eyðublaðið og ýttu á *Keyra*. R er sjálfgefið; veldu Python í eyðublaðinu ef þú vilt það frekar.
Kóðinn birtist undir eyðublaðinu og má opna í stjórnborði með *Opna í stjórnborði*.

| Verkfæri | Hvað það gefur |
|---|---|
| Lýsandi | Fjöldi, gildi sem vantar, meðaltal, staðalfrávik, fjórðungar, lægst og hæst eftir dálki, gjarnan eftir hópi; með einum dálki einnig stuðlarit |
| Krosstafla | Fjöldi eftir tveimur flokkum, gjarnan með prósentum, og kí²-próf |
| Fylgni | Pearson eða Spearman milli talnadálka, með litaðri töflu |
| Tilgátupróf | t-próf (tveir hópar, gegn gildi, parað), Mann-Whitney, dreifigreining og Kruskal-Wallis |
| Aðhvarf | Línulegt eða lógistískt, með stuðlum, staðalskekkjum og p-gildum; textadálkar verða vísar |
| Klasagreining | k-means með völdum fjölda klasa og nýtt gagnasafn með klasann sem dálk ef þú vilt |

Fyrir ofan töfluna stendur setning um hvað niðurstaðan sýnir. Hún segir hvort munur sé tölfræðilega marktækur, ekki hvað hann merkir.
Tölfræðiaðferðir gera ráð fyrir hlutum sem eyðublaðið sér ekki, til dæmis hvernig gögnum var safnað og hvort raðir séu óháðar. Matið er
þitt. Hægt er að vista hverja niðurstöðu sem gagnasafn og kóðinn fylgir í lýsingunni.

Python ræsist ekki fyrr en þú ýtir á *Keyra*, og scipy, statsmodels og scikit-learn eru sótt í fyrsta sinn sem þeirra er þörf.

## Tímaraðir í Vinna

Hópurinn **Tímaraðir** meðal aðgerða er fyrir töflur með tímabilsdálk og hugsanlega dálka sem aðgreina raðirnar, til dæmis sveitarfélag
eða kyn. Hver aðgerð er uppskriftarskref sem má afturkalla og spila við næstu sókn.

| Aðgerð | Hvað hún gerir |
|---|---|
| Túlka tímabil | Býr til samræmd tímabil (`2024-03`, `2024-Q1`, `2024`) úr `2024M03`, `2024K1`, `2024-Q1`, `Q1 2024`, `202403`, `2024` og dagsetningum, og dagsetningardálk fyrir gröf |
| Draga saman tímabil | Ein röð fyrir hvern ársfjórðung eða ár, með summu, meðaltali, síðasta gildi, lægsta eða hæsta; taflan er leyst af hólmi |
| Breyting yfir tíma | Munur eða prósenta miðað við fyrra tímabil eða sama tímabil í fyrra |
| Vísitala | Hvert gildi miðað við grunntímabil sem er 100; ár sem grunnur tekur meðaltal mánaða eða ársfjórðunga |
| Hlaupandi meðaltal | Meðaltal síðustu tímabila eða miðjað; aðeins heilir gluggar gefa gildi |
| Árstíðaleiðrétta | Leitni, árstíð og leiðrétt gildi með R (`stl`); röðin verður að vera heil og að minnsta kosti tveggja ára, aðrar verða auðar |

Raðirnar þurfa ekki að vera í röð og þeim er ekki blandað saman. Tímabil á sniði sem ekki þekkist verða auð, svo athugaðu fjöldann í forskoðun.

Í Myndgera eru grafgerðirnar **Tímaröð** (ein lína fyrir hverja röð) og **Litlar margfeldur** (eitt lítið graf fyrir hverja röð).

## Líkön og Spá

Þegar aðhvarfi er lokið geturðu ýtt á *Vista líkanið*. Stuðlarnir eru vistaðir í gagnasafninu og fylgja pökkum og öryggisafritum.
Verkfærið *Líkön* í flipanum Tölfræði listar þau með formúlunni.

Aðgerðin **Spá úr líkani** undir Útreikningar í Vinna reiknar nýjan dálk með líkaninu, á sama gagnasafni eða öðru með sömu dálka.
Útreikningurinn er venjulegt SQL, svo hvorki R né Python þarf. Líkanið er afritað í uppskriftarskrefið, svo hægt er að spila uppskriftina
þótt upprunalega gagnasafnið sé horfið. Lýsing nýja dálksins í kóðabókinni inniheldur formúlu líkansins og mátun.

- Ef dálk vantar sem líkanið þarf færðu skilaboð um hvern.
- Röð með auðu gildi í skýringardálki fær enga spá.
- Textagildi sem líkanið hefur ekki séð telst viðmiðunarstig, það er án viðbótar.
- Lógistískt líkan gefur líkur á síðustu útkomu í stafrófsröð.

Aðeins er hægt að vista línuleg og lógistísk líkön, því þau má setja fram sem formúlu. Líkön sem þurfa upprunalegt safn sitt er ekki hægt
að keyra sem uppskriftarskref.
