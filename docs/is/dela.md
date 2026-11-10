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

**Skrárnar.** Gagnasafn með skrám sýnir hve stórar þær eru, og þú getur skilið þær eftir til að gera pakkann minni. Raðirnar fylgja með. Án skráa sinna sýnir myndasafn aðeins upplýsingarnar um myndirnar, og skjal textann sinn.

## GitHub

Vinnusvæðið sem mappa í GitHub-safni, helst lokuðu. Gefðu upp safn (`eigandi/heiti`), grein og möppu, og nákvæman
aðgangslykil sem má aðeins lesa og skrifa innihald þess safns. Lykillinn er notaður í lotunni eða vistaður dulkóðaður;
ekkert er sent fyrr en þú ýtir á *Senda á GitHub* eða *Sækja frá GitHub*. Aðeins breyttar skrár eru sendar, í einni
færslu með skilaboðum þínum. Þegar sótt er velurðu, eins og fyrir pakka, hvort skipta eigi út gagnasöfnum sem þegar
eru til (þín útgáfa er vistuð undir *Útgáfur*). Í fyrsta skipti spyr forritið um leyfi til að hafa samband við GitHub
(sjá *Netaðgangur* í [anvandarguide.md](anvandarguide.md)).

## Samvinna í gegnum GitHub

Þegar þú sækir frá GitHub er það sem hér er borið saman við það sem var sótt, eftir ferli þeirra. Glugginn segir fyrir hvert
gagnasafn hver hefur breytt hverju, og athugasemdir og minnispunktar frá báðum aðilum haldast alltaf.

- Ef aðeins hinn aðilinn hefur breytt gögnum er sú útgáfa tekin inn og þín vistuð sem útgáfa til að fara aftur í.
- Ef aðeins þú hefur breytt gögnum helst þín útgáfa.
- Ef báðir hafa breytt velur þú: halda báðum, með sóttu sem eigin gagnasafni, halda þinni eða taka sóttu. Sjálfgefið er að halda
  báðum, svo ekkert tapast.

Athugasemdir frá öðrum sem þú hefur ekki lesið sjást í stöðustikunni. Smellur opnar þær og nafn þess sem skrifaði stendur við
hverja athugasemd. Nafnið er það sem viðkomandi hefur sjálfur gefið upp.

## Tæki

Beinn flutningur í síma, spjaldtölvur og aðrar tölvur yfir staðarnetið, án þjóns. Tölvan sýnir QR-kóða; síminn
skannar hann með myndavélinni og opnar Dataspatium Farsíma, sem tekur á móti pökkum og skrám, sýnir töflurnar og
getur sent þær áfram eða afhent þær annarri tölvu. Í fyrsta skipti sýnir síminn kóða sem skrifaður er inn á tölvunni
og tækin eru pöruð; eftir það nægir ein skönnun. Bæði tæki sýna sama staðfestingarkóða og viðtakandinn samþykkir
áður en nokkuð er tekið á móti. Tvær tölvur tengjast með kóðum sem límdir eru inn. Allt ferlið, kröfur og
bilanaleit er í [mobil.md](mobil.md). Hnappurinn *QR-kóði á farsímasíðuna* sýnir vefslóðina sem skönnuð er til að
opna farsímasíðuna í fyrsta skipti.

## Yfirferð fyrir deilingu

Allt sem fer úr forritinu með pökkum, tækjum eða deilivalmyndinni er fyrst yfirfarið og yfirferðin nær til allrar skrárinnar. Forritið leitar að kennitölum, netföngum og símanúmerum, bæði í heilum
dálkum og inni í samfelldum texta, og sýnir það sem annars fylgir með án þess að sjást í töflunni. Fyrir hvern hluta velur þú hvað gerist í afritinu.

| Hluti | Val |
|---|---|
| Dálkur með kennitölum, netföngum eða símanúmerum | Halda, dulnefna eða fjarlægja. Dulnefning merkir að sama gildi gefur sama kóða en gildið verður ekki lesið |
| Samfelldur texti, til dæmis efnisgreinar skjala | Halda, fela það sem finnst eða fjarlægja dálkinn |
| Leggir netsins og eiginleikar líkansins | Halda, fela það sem finnst eða fjarlægja í afritinu |
| Upprunaskrár | Halda eða fjarlægja. Ekki er hægt að dulnefna þær, svo lagt er til að fjarlægja þær þegar öðru er breytt |
| Myndir | Halda eða fjarlægja. Staðsetning er fjarlægð sér, bæði úr töflunni og úr myndskránni |
| Athugasemdir og höfundar í lýsigögnum skjala | Halda eða fjarlægja |
| Safnaðar raðir | Hægt er að dulnefna hver safnaði og fjarlægja staðsetningu |

Aðeins afritið sem deilt er breytist og gagnasafnið í forritinu helst eins og það er. Ef þú breytir einhverju fylgja hvorki breytingaskrá né uppskrift með, því þau geta innihaldið upprunalegu gildin.
Pakkar eru einnig hreinsaðir af leifum fjarlægðra gilda í skránni sjálfri.

Yfirferðin sér ekki allt. Nöfn, heimilisföng og innihald upprunaskráa og mynda þarft þú að meta sjálf(ur). Pakki tekur aðeins með myndrit, mælaborð og minnisbækur valinna gagnasafna.
Persónuupplýsingar í þeim, í sniðmátum og skriftum, í vistuðum niðurstöðum minnisbókanna og í heitum og skráarheitum gagnasafnanna eru sýndar
undir *Það sem fylgir pakkanum* og huldar í afritinu nema þú veljir að halda þeim, fjarlægja niðurstöðurnar eða sleppa skránni.

Samstillingu við **GitHub** þarf að vera hægt að sækja aftur eins og hún var, svo þar er ekkert hægt að dulnefna. Forritið sýnir þess í stað hvað geta verið persónuupplýsingar áður en þú sendir.
**Birta** býr til HTML-síðu með þeim gildum sem gröfin sýna, svo athugaðu þau áður en þú setur síðuna út.

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

**Gagnasafn sem eigin síða.** Undir Gagnasöfn verður gagnasafn að síðu á eigin formi: texti til að lesa, myndir til að fletta, kort, netkerfi eða tafla til að sía. Síðan sækir ekkert af netinu og hægt er að senda hana sem eina skrá. Hún fer fyrst í gegnum yfirferð og sýnir í mesta lagi 2.000 raðir eða 100 myndir.

## Að birta vinnusvæði

*Birta vinnusvæðið* býr til vefsvæði úr öllu vinnusvæðinu eða úrvali, fyrir innra net eða til að senda. Það verður ZIP með
upphafssíðu og síðu fyrir hvert gagnasafn, mælaborð og skjal, með leit í töflum og kóðabók undir hverju gagnasafni. Síðurnar eru
aðeins til lestrar, tengjast með afstæðum tenglum og sækja ekkert af netinu.

Gagnasöfnin fara í gegnum yfirferðina og eru sýnd úr afritum. Mælaborð og skjöl eru teiknuð úr gagnasöfnunum eins og þau eru, svo
þar færð þú að vita hvað þau innihalda og velur hvort þau fylgi með.

## Til CDE

Flipinn *Til CDE* sendir gagnasafn í verkefni á OpenCDE-þjóni eins og Dataregium. Veldu þjón, skráðu þig inn og veldu verkefni;
veldu síðan hvort gagnasafnið skuli skrifað á skráarsniði eða upprunalega skráin send, og hvort það fari í gegnum Documents
API, þar sem eigin síða þjónsins spyr um titil, útgáfu og verkefni og skránni er síðan hlaðið upp í hlutum, eða sem BCF-skjal,
sem tekur aðeins skrána. Gagnasafnið er skrifað úr afriti sem farið hefur í gegnum yfirferðina, og upprunalegar skrár fá sömu
viðvörun sem í pökkunum. Gagnasafn sem sótt var frá þjóninum má senda sem nýja útgáfu af skjali sínu, og kortið *Frá CDE* í
Umsjón veit það síðan. Hver sending er skráð í ferli gagnasafnsins.

*Vinnusvæðispakki* sendir pakka í stað gagnasafns: pakkaglugginn velur gagnasöfn og innihald eins og venjulega, yfirferðin fer fram,
og skráin fer upp sem skjal. Viðtakandinn sér pakkann í skráalista uppsprettunnar í Sækja og tekur á móti honum með einum smelli.

## Taka á móti

Opnaðu pakka úr skrá (slepptu henni á flötinn) eða af vefslóð. Sendandi, skilaboð og breytingar birtast fyrst;
gagnasöfnum sem þegar eru til má skipta út fyrir útgáfu pakkans, annars er þeim sleppt. Afrit (ZIP úr *Taka afrit af
vinnusvæðinu*) má líka opna hér, en á heima undir Umsjón, Vinnusvæði.

## Það sem ekki gengur

Vafri getur ekki verið þjónn, svo aðrir geta ekki sótt gögn af tölvunni þinni þegar slökkt er á henni eða þegar þeir
eru ekki á sama neti; þá fer skrá eða pakki um deilivalmyndina, skýjamöppu (færanlega mappan undir Umsjón getur
legið í OneDrive eða Dropbox) eða GitHub. Á sama neti fer flutningurinn beint milli tækjanna (flipinn Tæki).
`mailto:`-tenglar geta ekki borið viðhengi; notaðu deilivalmyndina eða vistaðu skrána og hengdu hana við.
