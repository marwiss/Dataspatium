# Deila

Hamurinn Deila safnar því sem snýst um að gefa öðru fólki og tækjum gögn. Flytja út snýst um skrár á eigin tölvu;
Deila um pakka, GitHub, tæki, deilivalmyndina, birtingu og móttöku. Áður en gagnasöfn fara úr forritinu fara þau
gegnum yfirferð persónuupplýsinga (sjá neðar).

## Pakki

Pakki er ZIP-skrá með völdum gagnasöfnum og því sem þeim fylgir: myndritum, mælaborðum, sniðum, minnisbókum og
skriftum, ásamt skilaboðum, nafni sendanda og breytingaskrá yfir það sem gert hefur verið við hvert gagnasafn síðan
því var síðast deilt. *Búa til pakka* opnar gluggann með öll gagnasöfn forvalin; með gagnasafn valið er líka *Pakka
aðeins því*. Viðtakandinn opnar pakkann undir *Taka á móti* og sér skilaboð og breytingar áður en nokkuð er tekið
inn. Eiginleikaspjaldið sýnir hversu miklu er að deila. Sjá líka [format.md](format.md) um uppbyggingu pakkans.

## GitHub

Vinnusvæðið sem mappa í GitHub-safni, helst lokuðu. Gefðu upp safn (`eigandi/heiti`), grein og möppu, og nákvæman
aðgangslykil sem má aðeins lesa og skrifa innihald þess safns. Lykillinn er notaður í lotunni eða vistaður dulkóðaður;
ekkert er sent fyrr en þú ýtir á *Senda á GitHub* eða *Sækja frá GitHub*. Aðeins breyttar skrár eru sendar, í einni
færslu með skilaboðum þínum. Þegar sótt er velurðu, eins og fyrir pakka, hvort skipta eigi út gagnasöfnum sem þegar
eru til (þín útgáfa er vistuð undir *Útgáfur*). Í fyrsta skipti spyr forritið um leyfi til að hafa samband við GitHub
(sjá *Netaðgangur* í [anvandarguide.md](anvandarguide.md)).

## Tæki

Beinn flutningur í síma, spjaldtölvur og aðrar tölvur yfir staðarnetið, án þjóns. Tölvan sýnir QR-kóða; síminn
skannar hann með myndavélinni og opnar Dataspatium Farsíma, sem tekur á móti pökkum og skrám, sýnir töflurnar og
getur sent þær áfram eða afhent þær annarri tölvu. Í fyrsta skipti sýnir síminn kóða sem skrifaður er inn á tölvunni
og tækin eru pöruð; eftir það nægir ein skönnun. Bæði tæki sýna sama staðfestingarkóða og viðtakandinn samþykkir
áður en nokkuð er tekið á móti. Tvær tölvur tengjast með kóðum sem límdir eru inn. Allt ferlið, kröfur og
bilanaleit er í [mobil.md](mobil.md). Hnappurinn *QR-kóði á farsímasíðuna* sýnir vefslóðina sem skönnuð er til að
opna farsímasíðuna í fyrsta skipti.

## Yfirferð fyrir deilingu

Þegar gagnasöfnum er pakkað, þau send í tæki eða þeim deilt um deilivalmyndina leitar forritið í dálkunum að
kennitölum (sænskum, dönskum, norskum, finnskum og íslenskum), netföngum og símanúmerum, eftir dálkaheitum og
gildum. Finnist eitthvað birtist gluggi þar sem þú velur fyrir hvern dálk *Halda*, *Dulnefna* (sama gildi gefur
sama kóða en gildið verður ekki lesið) eða *Fjarlægja dálkinn*. Aðeins afritið sem deilt er breytist; gagnasafnið í
forritinu helst óbreytt og skráarlisti pakkans tilgreinir hvaða dálkum var breytt. Yfirferðin sér ekki allt: nöfn,
heimilisföng og frjálsan texta þarft þú að meta sjálf(ur).

## Deilivalmynd

Eigin deilivalmynd tölvunnar eða símans: sendu skrá í tölvupóst, Teams, skilaboðaforrit eða önnur forrit. Veldu
hvort valda gagnasafninu á að deila sem skrá (CSV, Excel, ODS eða JSON) eða hvort öllum gagnasöfnum á að deila sem
pakka, og ýttu á *Deila*. Deilivalmynd fyrir skrár er í Edge og Chrome á Windows og í farsímum; í öðrum vöfrum
(Firefox) er skráin vistuð í staðinn og hnappurinn heitir þá *Vista skrá*. Í síma með Dataspatium Farsíma uppsettan
má líka deila skrám *til* Dataspatium úr öðrum forritum; þær lenda undir *Móttekið* á farsímasíðunni.

## Birta

Sjálfstæð HTML-skrá sem virkar án Dataspatium og má setja á innranet eða senda: mælaborð (með myndritin innbyggð) og
skjöl úr sniðum, fyllt með valda gagnasafninu. Birtar skrár innihalda gögn og myndrit í læsilegu formi; deildu þeim
aðeins með þeim sem mega sjá upplýsingarnar.

## Taka á móti

Opnaðu pakka úr skrá (slepptu henni á flötinn) eða af vefslóð. Sendandi, skilaboð og breytingar birtast fyrst;
gagnasöfnum sem þegar eru til má skipta út fyrir útgáfu pakkans, annars er þeim sleppt. Afrit (ZIP úr *Taka afrit af
vinnusvæðinu*) má líka opna hér, en á heima undir Umsjón, Vinnusvæði.

## Það sem ekki gengur

Vafri getur ekki verið þjónn, svo aðrir geta ekki sótt gögn af tölvunni þinni þegar slökkt er á henni eða þegar þeir
eru ekki á sama neti; þá fer skrá eða pakki um deilivalmyndina, skýjamöppu (færanlega mappan undir Umsjón getur
legið í OneDrive eða Dropbox) eða GitHub. Á sama neti fer flutningurinn beint milli tækjanna (flipinn Tæki).
`mailto:`-tenglar geta ekki borið viðhengi; notaðu deilivalmyndina eða vistaðu skrána og hengdu hana við.
