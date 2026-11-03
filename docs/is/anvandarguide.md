# Notendahandbók

Þessi handbók lýsir því hvernig þú vinnur í Dataspatium frá fyrstu skrá að fullbúinni skýrslu. Hún gerir ráð fyrir að þú
hafir opnað forritið eins og lýst er í [kom-igang.md](kom-igang.md). Nánar um hvern ham er í [lagen.md](lagen.md), um
skráarsnið í [format.md](format.md), um vefþjónustur í [api-konfiguration.md](api-konfiguration.md), um vinnslu í
[bearbeta.md](bearbeta.md), um R í [r-guide.md](r-guide.md), um myndrit í [visualisera.md](visualisera.md) og um skjöl í
[dokumentmallar.md](dokumentmallar.md). Algengum spurningum er svarað í [faq.md](faq.md).

## Vinnusvæðið

Skjárinn lítur eins út í öllum hömum. Efst skiptirðu um ham (Sækja, Umsjón, Vinna, Greina, Myndgera, Flytja út; Alt+1 til
Alt+6 virka líka) og sérð stöðu vinnusvæðisins (vistað eða óvistað), skipanaspjaldið (stækkunarglerið eða Ctrl+K),
tungumálahnappinn, þemað (ljóst eða dökkt) og hjálparhnappinn með útgáfunúmeri og *Leita að uppfærslum*. Skipanaspjaldið er
fljótlegasta leiðin að flestu: skrifaðu nokkra stafi til að skipta um ham, opna gagnasafn, myndrit eða mælaborð, eða keyra
aðgerð á valda gagnasafnið. Til vinstri eru hlutir hamsins (gagnasöfn, upprunar, myndrit, snið), í miðjunni vinnuflöturinn og
til hægri eiginleikaspjaldið með eiginleikum og tölfræði. Neðst er dagbókin, þar sem hver aðgerð, viðvörun og villa er skráð;
hana lestu þegar eitthvað fer ekki eins og þú ætlaðir.

Allt sem þú býrð til er vistað sjálfkrafa í gagnagrunni vafrans á tölvunni þinni. Ekkert er sent neitt nema þú sækir sjálf(ur)
úr vefþjónustu, leitar að uppfærslum eða flytur út.

## Grunnnámskeiðið

Grunnnámskeiðið er góð leið til að kynnast forritinu. Það hefst eftir tungumálavalið í fyrsta skipti sem forritið er
opnað og annars úr hjálpinni (spurningarmerkið efst til hægri) eða með skipuninni *Opna grunnnámskeiðið* á
skipanaspjaldinu. Námskeiðið birtist í spjaldi neðst til hægri á meðan þú vinnur í raunverulega forritinu og fylgir
dæminu *Mannfjöldi eftir sveitarfélögum 2024 (Svíþjóð)* í níu skrefum:

1. Velkomin: hvað forritið gerir og hvernig skjánum er skipað.
2. Sækja: innflutningur sýnigagna og hvað gagnasafn er.
3. Umsjón: heiti og stutt heiti, heimild, dálkar, útgáfur og afrit.
4. Vinna: taflan, snið dálka og reiknaður dálkur sem verður skref í uppskriftinni.
5. Greina með SQL: mannfjöldi eftir lénum og hvernig stutt heiti tengja gagnasöfn.
6. Greina með R: `dm_read()`, samantekt og stuðlarit með ggplot2.
7. Myndgera: lárétt súlurit yfir mannfjölda eftir lénum.
8. Flytja út: gögn, myndrit og skjöl.
9. Lokið: hvert þú heldur næst.

Hvert skref útskýrir hugtak og gefur verkefni. Rammi merkir hnappinn sem á að smella á og skrefið er merkt lokið þegar
forritið sér að verkefnið er búið. *Gera það fyrir mig* (eða *Sýna mér*) framkvæmir skrefið svo að þú getur fylgst með
án þess að skrifa neitt. Hægt er að lágmarka námskeiðið með örinni og loka því með krossinum; næst heldur það áfram þar
sem frá var horfið. Það býr til sýnigagnasafnið, dálk í því og myndrit, sem þú eyðir eins og venjulega þegar þú þarft
þau ekki lengur.

## Vinnuferli frá skrá til skýrslu

### 1. Sæktu gögn (Sækja)

Slepptu skrá á flötinn, límdu inn töflu eða sæktu skrá af vefslóð (þjónninn þarf að leyfa CORS; deildri Dataspatium-uppsetningu
er bætt við beint). Athugaðu forskoðunina: giskað er á stafakóðun, aðgreini, fyrirsagnaröð og tugabrotstákn, en þeim má breyta.
Í dálkaskrefinu fær hver dálkur gerð; kóðar með núlli fremst (sveitarfélagakóðar, kennitölur) eru geymdir sem texti. Gefðu
gagnasafninu heiti og fluttu inn. Undir fletinum eru gögn sem fylgja forritinu: hnappur fyrir sýnigögnin *Mannfjöldi
eftir sveitarfélögum 2024 (Svíþjóð)* og listinn *Mörk fyrir kort* með mörkum sveitarfélaga og svæða fyrir Svíþjóð,
Danmörku, Noreg og Finnland.

Undir *Opnar vefþjónustur* eru forstillingar fyrir hagstofur og fleiri stofnanir á Íslandi, í Danmörku, Noregi, Finnlandi og
Svíþjóð, sjálfstjórnarsvæðin, Nordic Statistics og Eurostat (á Íslandi Hagstofa Íslands og Veðurstofa Íslands). Landahnapparnir
fyrir ofan listann velja hvaða landa upprunar birtast. Flettu eða leitaðu að töflu, veldu breytur, forskoðaðu og sæktu í nýtt
gagnasafn eða bættu við fyrirliggjandi. Sótt gagnasafn man fyrirspurn sína, svo sækja má það aftur úr Umsjón þegar uppruninn
hefur verið uppfærður, og *Vistaðar sóknir* í Sækja uppfærir slík gagnasöfn með einum smelli og keyrir uppskriftir
þeirra aftur.

### 2. Farðu yfir og leiðréttu (Vinna)

Taflan sýnir gagnasafnið röð fyrir röð jafnvel þegar það hefur hundruð þúsunda raða. Smelltu á fyrirsögn til að raða og sjá
tölfræði dálksins til hægri: fjöldi, vantar, ólík gildi, lægst, hæst, meðaltal og algengustu gildi. Síaðu með leitarreitnum.
Tvísmelltu á reit til að breyta honum.

*Gagnagæði* fara yfir alla dálka og benda á vandamál (tölur geymdar sem texti, blönduð dagsetningarsnið, tvítök,
kóðunarvillur, frávikandi flokka) með hnappi sem framkvæmir rétta aðgerð. *Reglur* leyfa þér að skrifa niður hvað skuli gilda
(má ekki vanta, einkvæmt, bil, listi, mynstur, lengd, SQL-skilyrði), keyra athugunina hvenær sem er, vista raðir sem bregðast
sem sérstakt gagnasafn og hlaða niður skýrslu. Allar aðgerðir eru líka í spjaldinu: fjarlægja tómar raðir, fjarlægja bil, há-
og lágstafir, finna og skipta út með reglulegum segðum, breyta gerð, túlka dagsetningar og tölur, fylla í vantandi gildi,
tvítök, klasa svipaða flokka og fleira. Hver aðgerð er skráð sem skref í uppskriftinni og má afturkalla. Áður en deilt er má
dulnefna auðkenni eins og kennitölur með söltuðum tætigildum, hulningu eða raðnúmerum; saltið er aldrei vistað í
uppskriftinni.

### 3. Sameinaðu og umbreyttu (Vinna)

Reiknaðir dálkar, skipta og sameina dálka, sía burt raðir, endurnefna og endurraða, snúa milli breiðs og langs forms, hópa og
taka saman, tengja tvö gagnasöfn á lykli og skeyta saman gagnasöfnum með sömu dálkum. Samantektir, tengingar og samskeytingar
verða ný gagnasöfn, svo frumgögnin haldast. Hópurinn *Landupplýsingar* gefur miðpunkt og flatarmál úr rúmfræði, umreikning milli
SWEREF 99 TM og WGS 84 og sænskt sveitarfélag og lén úr hnitum með meðfylgjandi mörkum.

Uppskriftina (öll skref í röð) má sýna, keyra á nýja útgáfu gagnanna og flytja út sem JSON, R-kóða eða SQL. Útgáfur eru teknar
við innflutning, fyrir fjöldaaðgerðir og eftir þörfum; bera má saman tvær útgáfur og endurheimta eldri.

### 4. Greindu með R og SQL (Greina)

R-stjórnborðið keyrir raunverulegt R (WebR) í vafranum. `dm_list()` sýnir gagnasöfnin, `dm_read("stuttheiti")` les eitt sem
data.frame með réttum gerðum, `dm_write(df, "Nýtt heiti")` sendir data.frame til baka sem nýtt gagnasafn. `theme_dataspatium()`
og `dm_palette()` gefa ggplot2 útlit forritsins. Myndrit birtast í spjaldinu og eru flutt út sem SVG, PNG eða PDF. Pakkar eins
og ggplot2, dplyr, tidyr, data.table, haven og readxl fylgja með og eru settir upp í setunni þegar þeir eru notaðir í fyrsta
skipti. Skriftur má vista og keyra aftur. Fyrsta ræsing tekur nokkrar sekúndur.

SQL-flipinn spyr töflu gagnasafnsins `data` beint með SQLite. Önnur gagnasöfn nást með stuttheitum sínum (birtast undir heitinu
í hlutaspjaldinu), svo ein fyrirspurn getur tengt fleiri gagnasöfn með join, til dæmis
`select ... from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. SELECT-fyrirspurnir sýna niðurstöðuna
(allt að 5 000 raðir) og hana má vista sem nýtt gagnasafn; UPDATE, DELETE og ALTER eru skráð sem skref í uppskriftinni. Hnappurinn
*Setja inn dm_read()* og R-dæmin í eiginleikaspjaldinu nota líka stuttheitið.

Flipinn *Minnisbók* safnar texta (Markdown), R og SQL í reiti sem keyra í röð og vista úttak sitt. Fullbúin minnisbók er flutt
út sem HTML, Word, PDF, Markdown eða LaTeX, með eða án kóðans. Sjá [anteckningsbok.md](anteckningsbok.md).

Flipinn *Regex* prófar reglulega segð á dálki meðan þú skrifar: algengustu gildin birtast með samsvaranirnar
merktar og raðirnar sem passa eru taldar. Sama mynstur getur síðan síað raðir, dregið hópa út í nýja dálka, skipt
út, skipt upp, merkt eða talið samsvaranir eða orðið að gæðareglu. *Mynsturyfirlit* sýnir form gildanna (til dæmis
`9999-99-99` og `99/99/9999` fyrir dagsetningar) og safnið til vinstri hefur tilbúin mynstur meðal annars fyrir
kennitölur, póstnúmer og dagsetningar. Sjá [regex.md](regex.md).

### 5. Myndgerðu (Myndgera)

Myndritasmiðurinn býr til súlu-, línu-, flatar-, punkta-, köku- og önnur myndrit úr gagnasafni: veldu dálka fyrir ása, lit og
smáspjöld, samantekt, röðun og titla. D3-snið gefa sérmyndrit (sleikjóarit, hallarit, aldurspíramída) og R-myndrit má vista með
kóða sínum. Allar vélar nota sömu liti og leturgerðir. Vistuð myndrit safnast í safnið og eru flutt út sem SVG, PNG, PDF eða
PowerPoint, eitt í einu eða eitt fyrir hvern hóp (til dæmis hvert sveitarfélag) í ZIP eða kynningu. Kort eru teiknuð með
myndritagerðinni *Kort* úr gagnasafni með rúmfræði (meðfylgjandi sænsk sveitarfélaga- eða lénamörk eða eigin úr GeoJSON,
shapefile og GeoPackage) tengdri við gildi eftir kóða, og með *Punktakorti* úr lengd og breidd með mörkin sem bakgrunn.
Mælaborð safnar mörgum vistuðum myndritum í hnitanet með sameiginlegum síum, til dæmis landshluta eða ári, og er flutt út sem
sjálfstæð HTML eða PowerPoint.

### 6. Skjöl (Flytja út, flipinn Skjöl)

Skjalasnið eru skrifuð í Markdown með staðgenglum: `{{datamangd}}`, `{{antal_rader}}`, `{{#tabell}}…{{/tabell}}` fyrir raðir,
`{{diagram "Heiti"}}` fyrir vistað myndrit, `{{sidbrytning}}` og lykiltölur eins og `{{summor.kolumn}}`. Skýrsla, kóðabók og
hópasamantekt eru innbyggð. Búðu til sem HTML, Word, PDF, Markdown eða LaTeX, eitt í einu eða eitt skjal fyrir hvern hóp.

### 7. Fluttu út gögn (Flytja út, flipinn Gögn)

CSV (aðlagað fyrir Excel á Norðurlöndum eða staðlað), Excel, ODS, JSON, GeoJSON (fyrir gagnasöfn með rúmfræði), XML, SQLite og
gegnum R: Parquet, SPSS, Stata og RDS. SQLite og Parquet halda gerðunum nákvæmlega; öll snið má flytja aftur inn.

## Halda röð og reglu (Umsjón)

Hvert gagnasafn hefur yfirlit (uppruni, stærð, lýsing), dálkalista með gerðum, merkimiðum, lýsingum og einingum (stillt undir
Vinna með *Merkimiði, lýsing og eining*), sögu alls sem hefur verið gert og útgáfur. Endurnefndu og breyttu stuttheiti, eyddu
eða sæktu aftur úr vefþjónustu (uppfærðu með uppskriftinni eða bættu við röðum). Undir *Vinnusvæði* sérðu hversu mikil geymsla er í notkun, biður um varanlega geymslu, tekur
afrit sem ZIP og endurheimtir. Forritið minnir þig við ræsingu þegar lengri tími en valinn fjöldi daga er liðinn frá síðasta
afriti (30 dagar sjálfgefið; breytt eða slökkt á í sama spjaldi). Í Edge og Chrome má auk þess spegla vinnusvæðið í færanlega
möppu á diski, sjálfkrafa við hverja breytingu.

## Deila með öðrum

- Úrval: *Deila pakka* undir Umsjón gefur ZIP með völdum gagnasöfnum, myndritum, mælaborðum, sniðum og minnisbókum. Viðtakandinn
  hleður henni inn undir *Endurheimta úr ZIP*; því sem þegar er til er sleppt.
- Allt vinnusvæðið: afritið (ZIP) er endurheimt undir Umsjón á annarri tölvu.
- Eitt gagnasafn: fluttu út sem SQLite (allt fylgir) eða Parquet.
- API-uppsetningar (`.api.json`), myndrit og skjalasnið (JSON) og uppskriftir (JSON, R eða SQL) eru fluttar út og hlaðnar inn
  sem skrár. Lyklar fylgja aldrei með.

## Lyklaborð

Alt+1 til Alt+6 skipta um ham og Ctrl+K opnar skipanaspjaldið. Fyrsta ýting á Tab á síðunni sýnir tengilinn *Fara í efnið*, sem
færir fókus framhjá hamavalinu og hlutaspjaldinu. Allt næst með Tab og Enter; gluggum er lokað með Esc. Í töflunni færa
örvalyklarnir milli reita og Enter breytir. Forritið fylgir kerfisstillingunni um minni hreyfingu.

Skipt er um flipa með vinstri og hægri örvalykli, Home og End. Allir hnappar, reitir og kóðaritlar hafa heiti sem
skjálesarar lesa upp, gluggar eru lesnir upp með fyrirsögn sinni og síðan hefur kennileiti fyrir hamaskiptinn,
hlutaspjaldið, vinnusvæðið og eiginleikaspjaldið. Texti og reitarammar hafa birtuskil samkvæmt WCAG AA bæði í ljósu
og dökku þema. Vega lýsir myndritum úr myndritasmiðnum fyrir skjálesara; tölurnar á bak við R-myndrit og D3-snið eru í
töflunni í Vinna.

## Tungumál

Viðmótið er á sænsku, dönsku, norsku (bókmáli), finnsku, íslensku og ensku. Í fyrsta skipti sem forritið er opnað velurðu
tungumál; tungumálahnappurinn efst til hægri (eða skipunin *Tungumál* í spjaldinu) skiptir síðar. Valið er vistað í vafranum,
svo hver tölva og vafrasnið hefur sitt eigið. Tölur í viðmótinu fylgja venjum tungumálsins; gögnunum sjálfum er aldrei breytt.
Skilaboð R fylgja sama vali, en staðgenglar sniðanna eins og `{{datamangd}}` og lykilorð taflnanna `kolumner`, `sortera`,
`topp`, `filter` og `rubrik` eru hluti af sniðmálinu og eru eins á öllum tungumálum. Skjölunin er á öllum sex tungumálunum undir
`docs/` (sænska í `docs/`, hin í `docs/<tungumál>/`).

## Þegar eitthvað fer úrskeiðis

Lestu dagbókina neðst: villum sem þú getur lagfært er lýst á þínu tungumáli með tillögum. Ef R frýs skaltu nota *Endurræsa R*;
gagnasöfnin verða ekki fyrir áhrifum. Taktu afrit áður en þú hreinsar vafragögn. Villur eru tilkynntar sem issues á GitHub, sjá
[CONTRIBUTING.md](../../CONTRIBUTING.md).
