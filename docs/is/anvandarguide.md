# Notendahandbók

Þessi handbók lýsir því hvernig þú vinnur í Dataspatium frá fyrstu skrá að fullbúinni skýrslu. Hún gerir ráð fyrir að þú
hafir opnað forritið eins og lýst er í [kom-igang.md](kom-igang.md). Nánar um hvern ham er í [lagen.md](lagen.md), um
skráarsnið í [format.md](format.md), um vefþjónustur í [api-konfiguration.md](api-konfiguration.md), um vinnslu í
[bearbeta.md](bearbeta.md), um R í [r-guide.md](r-guide.md), um Python í [python.md](python.md), um myndrit í [visualisera.md](visualisera.md) og um skjöl í
[dokumentmallar.md](dokumentmallar.md). Algengum spurningum er svarað í [faq.md](faq.md).

## Vinnusvæðið

Skjárinn lítur eins út í öllum hömum. Efst skiptirðu um ham (Sækja, Umsjón, Leita, Vinna, Greina, Myndgera, Flytja
út, Deila; Alt+1 til Alt+8 virka líka) og nærð skipanaspjaldinu (stækkunarglerið eða Ctrl+K), tungumálahnappinum,
þemanu (ljóst eða dökkt) og hjálparhnappinum með útgáfunúmeri og *Leita að uppfærslum*. Skipanaspjaldið er
fljótlegasta leiðin að flestu: skrifaðu nokkra stafi til að skipta um ham, opna gagnasafn, myndrit eða mælaborð,
leita í gögnum eða keyra aðgerð á valda gagnasafnið. Til vinstri eru hlutir hamsins (gagnasöfn, upprunar, myndrit,
snið), í miðjunni vinnuflöturinn og til hægri eiginleikaspjaldið með eiginleikum og tölfræði. Neðst er stöðustikan:
vistunarstaða, geymsla, valda gagnasafnið, R-vélin, netköll í gangi og hnapparnir sem fella spjöldin inn og opna
dagbókina, þar sem hver aðgerð, viðvörun og villa er skráð; hana lestu þegar eitthvað fer ekki eins og þú ætlaðir.
Breidd spjaldanna er breytt með því að draga brúnina að vinnuflötinum, og í þröngum gluggum opnast spjöldin sem
yfirlagsspjöld yfir vinnuflötinn (sjá [lagen.md](lagen.md)).

Allt sem þú býrð til er vistað sjálfkrafa í gagnagrunni vafrans á tölvunni þinni. Ekkert er sent neitt nema þú sækir
sjálf(ur) úr vefþjónustu, leitar að uppfærslum, sendir á GitHub eða deilir. Í fyrsta skipti sem forritið þarf netið í
einhverjum tilgangi spyr það um leyfi, og svarið má vista; undir *Umsjón → Vinnusvæði → Netaðgangur* sérðu hvað er
leyft og hvaða köll hafa verið gerð. Hlutar forritsins sem fylgja ekki í möppunni (sumir íhlutir og R-pakkar) eru
sóttir á sama hátt þegar þeirra er þörf og síðan vistaðir á tölvunni.

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

Undir *Bæta við uppsprettum* → *Opnar vefþjónustur* er skráin yfir forstillingar (þær sem þú bætir við koma undir *Viðbættar uppsprettur*; SCB og Boverket eru þar frá byrjun) fyrir hagstofur og fleiri stofnanir á Íslandi, í Danmörku, Noregi, Finnlandi og
Svíþjóð, sjálfstjórnarsvæðin, Nordic Statistics og Eurostat (á Íslandi Hagstofa Íslands og Veðurstofa Íslands). Landahnapparnir
fyrir ofan listann velja hvaða landa upprunar birtast. Flettu eða leitaðu að töflu, veldu breytur, forskoðaðu og sæktu í nýtt
gagnasafn eða bættu við fyrirliggjandi. Sótt gagnasafn man fyrirspurn sína, svo sækja má það aftur úr Umsjón þegar uppruninn
hefur verið uppfærður, og *Vistaðar sóknir* í Sækja uppfærir slík gagnasöfn með einum smelli og keyrir uppskriftir
þeirra aftur.

Gagnagrunnar: Access-skrám er sleppt á flötinn eins og öðrum skrám; gagnagrunnar á tölvunni (SQL Server, ODBC, Excel,
SQLite) nást um *Gagnagrunnur um brúna* og þjónustur um HTTP (PostgREST, OData, GraphQL og fleiri) um *Gagnagrunnsuppspretta*; OpenCDE og Neo4j eiga sín eigin val undir Bæta við uppsprettum. Í Chrome og Edge má tengja skrá og lesa hana aftur af diski. Sjá [kallor.md](kallor.md).

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

## Finna í gögnum (Leita)

Leita finnur raðir án kóða. Skrifaðu eitt eða fleiri orð, veldu öll gagnasöfn eða aðeins það valda og ýttu á *Leita*.
Niðurstöðurnar birtast eftir gagnasafni; flokkarnir (algengustu gildin í dálkum með fá ólík gildi) afmarka með einum
smelli, og röð í töflunni sýnir alla færsluna í eiginleikaspjaldinu. Leitina má vista sem lista, gera að nýju
gagnasafni eða opna í Vinna með gagnasafnið valið. Flipinn *Fyrirspurn* býr til fyrirspurn yfir eitt eða fleiri
gagnasöfn með dálkum, útreikningum, skilyrðum og röðun án kóða og sýnir þá SQL sem verður til; vistaðir listar afmarka
töfluna í Vinna og raðir myndrita. Sjá [soka.md](soka.md).

## Halda röð og reglu (Umsjón)

Hvert gagnasafn hefur yfirlit (uppruni, stærð, lýsing, mappa og merki), dálkalista með gerðum, merkimiðum, lýsingum
og einingum (stillt undir Vinna með *Merkimiði, lýsing og eining*), athugasemdir, læsilega sögu alls sem hefur verið
gert og útgáfur. Endurnefndu og breyttu stuttheiti, raðaðu, eyddu eða sæktu aftur úr vefþjónustu (uppfærðu með
uppskriftinni eða bættu við röðum). Undir *Vinnusvæði* sérðu hversu mikil geymsla er í notkun, biður um varanlega
geymslu, tekur afrit sem ZIP og endurheimtir. Forritið minnir þig við ræsingu þegar lengri tími en valinn fjöldi daga
er liðinn frá síðasta afriti (30 dagar sjálfgefið; breytt eða slökkt á í sama spjaldi). Í Edge og Chrome má auk þess
spegla vinnusvæðið í færanlega möppu á diski, sjálfkrafa við hverja breytingu.

Hlutaspjaldið í Umsjón er tré. *Raða* gefur gagnasafni möppu (með undirmöppum, eins og `Fjármál/2026`) og merki;
möppur má fella saman, og gagnasafn má draga í aðra möppu. Síureiturinn leitar í heiti, stuttheiti, merki og möppu,
og listanum má raða eftir breytt, heiti eða röðum. Gátreitirnir velja fleiri gagnasöfn (Shift velur bil), og
hnappurinn *Aðgerðir (n)* gerir það sama við þau öll í einu: raða, pakka, flytja út sem ZIP með CSV-skrám, sækja
aftur úr vefþjónustu, keyra uppskrift eða eyða. Mappa og merki eru vistuð í skrá gagnasafnsins og fylgja í pökkum,
afritum og GitHub; í R sýnir `dm_list()` möppuna og `dm_read("Mappa/Heiti")` les gagnasafn í möppu.

## Deila með öðrum

Allt sem á að fara til annars fólks er í hamnum *Deila* (sjá [dela.md](dela.md)):

- Úrval: *Pakki* gefur ZIP með völdum gagnasöfnum, myndritum, mælaborðum, sniðum, minnisbókum og skriftum,
  skilaboðum og breytingaskrá: því sem gert hefur verið við hvert gagnasafn síðan því var síðast deilt, og óleystum
  athugasemdum. Viðtakandinn opnar hann undir *Taka á móti*, sér skilaboðin og breytingarnar og velur fyrir gagnasöfn
  sem þegar eru til hvort skipta eigi þeim út fyrir útgáfu pakkans (eigin útgáfa er vistuð undir *Útgáfur*); öðru er
  sleppt. Undir Umsjón gera *Aðgerðir* á fleiri völdum gagnasöfnum það sama.
- Athugasemdir: hvert gagnasafn hefur flipann *Athugasemdir* í Umsjón, og í Vinna gerirðu athugasemd við dálk úr
  eiginleikaspjaldinu. Athugasemdirnar eru í skrá gagnasafnsins og fylgja í pökkum, afritum, færanlegu möppunni og
  GitHub. Nafnið sem birtist velur þú; það er aðeins vistað í vafranum.
- Allt vinnusvæðið: afritið (ZIP) er endurheimt undir Umsjón á annarri tölvu.
- Milli tölva gegnum GitHub: flipinn *GitHub* sendir vinnusvæðið í GitHub-safn (helst lokað) og sækir það á annarri
  tölvu. Til þess þarf nákvæman aðgangslykil (fine-grained personal access token) sem má aðeins lesa og skrifa
  innihald einmitt þess safns. Lykillinn er notaður í lotunni eða vistaður dulkóðaður, og ekkert er sent fyrr en þú
  ýtir á *Senda á GitHub* eða *Sækja frá GitHub*. Aðeins breyttar skrár eru sendar, í einni færslu (commit) með
  skilaboðum þínum; þegar sótt er velurðu, eins og fyrir pakka, hvort skipta eigi út gagnasöfnum sem eru til.
- Beint í síma eða aðra tölvu á sama neti: flipinn *Tæki* sýnir QR-kóða sem síminn skannar; Dataspatium Farsími
  tekur á móti, sýnir og sendir áfram (sjá [mobil.md](mobil.md)). Bæði tæki sýna sama staðfestingarkóða og eftir
  pörun nægir ein skönnun.
- Um deilivalmynd tölvunnar eða símans: flipinn *Deilivalmynd* sendir gagnasafn sem CSV, Excel, ODS eða JSON, eða öll
  gagnasöfn sem pakka, í tölvupóst, Teams og önnur forrit (Edge og Chrome; Firefox vistar skrána).
- Yfirferð fyrst: þegar gagnasöfnum er pakkað eða þau send leitar forritið að kennitölum, netföngum og símanúmerum og
  leyfir þér að dulnefna eða fjarlægja dálkana í afritinu.
- Sem tilbúin vefsíða: flipinn *Birta* gerir mælaborð eða skjal að sjálfstæðri HTML-skrá.
- Eitt gagnasafn: fluttu út sem SQLite (allt fylgir) eða Parquet undir Flytja út.
- API-uppsetningar (`.api.json`), myndrit og skjalasnið (JSON) og uppskriftir (JSON, R eða SQL) eru fluttar út og hlaðnar inn
  sem skrár. Lyklar fylgja aldrei með.

## Hjálp í forritinu

Öll handbókin er í forritinu: hnappurinn **?** efst til hægri, lykillinn **F1** eða skipunin *Hjálp* í
skipanaspjaldinu opnar hana við kaflann fyrir haminn sem þú ert í. Til vinstri er efnisyfirlitið, fyrir ofan það
leitarreitur sem leitar í öllum köflum, og tenglum milli skjala er fylgt inni í handbókinni. Gluggar með
**?**-hnappi opna rétta kaflann beint. Handbókin fylgir tungumáli forritsins og þarf ekkert net; neðst eru útgáfan,
*Leita að uppfærslum* og tengillinn á skjölunina á GitHub.

## Lyklaborð

Alt+1 til Alt+8 skipta um ham, Ctrl+K opnar skipanaspjaldið og F1 opnar handbókina. Brúnin milli spjalds og vinnuflatar getur fengið fókus
með Tab og er færð með örvalyklunum (Shift fyrir stærri skref, Home og End fyrir minnstu og mestu breidd). Fyrsta ýting á Tab á síðunni sýnir tengilinn *Fara í efnið*, sem
færir fókus framhjá hamavalinu og hlutaspjaldinu. Allt næst með Tab og Enter; gluggum er lokað með Esc. Í töflunni færa
örvalyklarnir milli reita og Enter breytir. Forritið fylgir kerfisstillingunni um minni hreyfingu.

Skipt er um flipa með vinstri og hægri örvalykli, Home og End. Allir hnappar, reitir og kóðaritlar hafa heiti sem
skjálesarar lesa upp, gluggar eru lesnir upp með fyrirsögn sinni og síðan hefur kennileiti fyrir hamaskiptinn,
hlutaspjaldið, vinnusvæðið og eiginleikaspjaldið. Texti og reitarammar hafa birtuskil samkvæmt WCAG AA bæði í ljósu
og dökku þema. Vega lýsir myndritum úr myndritasmiðnum fyrir skjálesara; tölurnar á bak við R-myndrit og D3-snið eru í
töflunni í Vinna.

## Tungumál

Viðmótið er á sænsku, dönsku, norsku (bókmáli og nýnorsku), finnsku, íslensku og ensku. Í fyrsta skipti sem forritið er opnað velurðu
tungumál; tungumálahnappurinn efst til hægri (eða skipunin *Tungumál* í spjaldinu) skiptir síðar. Valið er vistað í vafranum,
svo hver tölva og vafrasnið hefur sitt eigið. Tölur í viðmótinu fylgja venjum tungumálsins; gögnunum sjálfum er aldrei breytt.
Skilaboð R fylgja sama vali, en staðgenglar sniðanna eins og `{{datamangd}}` og lykilorð taflnanna `kolumner`, `sortera`,
`topp`, `filter` og `rubrik` eru hluti af sniðmálinu og eru eins á öllum tungumálum. Skjölunin er á öllum sjö tungumálunum undir
`docs/` (sænska í `docs/`, hin í `docs/<tungumál>/`).

## Þegar eitthvað fer úrskeiðis

Lestu dagbókina neðst: villum sem þú getur lagfært er lýst á þínu tungumáli með tillögum. Ef R frýs skaltu nota *Endurræsa R*;
gagnasöfnin verða ekki fyrir áhrifum. Taktu afrit áður en þú hreinsar vafragögn. Villur eru tilkynntar sem issues á GitHub, sjá
[CONTRIBUTING.md](../../CONTRIBUTING.md).
