# Leita

Hamurinn Leita finnur og listar án kóða. Hann liggur milli Umsjónar og Vinnu: fyrst finnur þú það sem þú leitar að,
síðan vinnur þú með það. Þrír flipar: *Leita* (frjáls texti með flokkum), *Fyrirspurn* (sjónrænn fyrirspurnasmiður
yfir eitt eða fleiri gagnasöfn sem sýnir þá SQL sem hann býr til) og *Listar* (vistaðar leitir og fyrirspurnir).

## Leita

Skrifaðu orð eða setningu í leitarreitinn, veldu hvort þú leitar í öllum gagnasöfnum eða aðeins í því valda, og ýttu
á Leita (eða Enter). Leitað er í öllum dálkum, óháð gerð, og hvert orð þarf að finnast einhvers staðar í röðinni. Há-
og lágstafir skipta engu, ekki heldur fyrir á, æ og ö. Tákn sem annars hafa sérstaka merkingu í mynstrum (punktur,
svigar, stjarna) merkja hér aðeins sjálf sig; fyrir mynsturleit er flipinn Regex í Greina.

Niðurstöðurnar birtast eftir gagnasafni með fjölda. Hvert spjald hefur:

- **Flokka**: fyrir dálka með fá ólík gildi meðal niðurstaðnanna birtast algengustu gildin með fjölda. Smelltu á
  gildi til að afmarka leitina við það; virku afmarkanirnar birtast sem merktir hnappar og eru fjarlægðar með smelli.
  Dálkar þar sem hver niðurstaða hefur sitt eigið gildi (heiti, auðkenni) birtast ekki sem flokkar, því þeir afmarka
  ekkert.
- **Töflu** með fyrstu hundrað niðurstöðunum. Smelltu á röð til að sjá alla færsluna í eiginleikaspjaldinu til
  hægri, með raðnúmerinu og hnappnum *Opna í Vinna*.
- **Vista sem lista** vistar leitina (texta og afmarkanir) fyrir það gagnasafn undir flipanum Listar.
- **Vista sem gagnasafn** gerir niðurstöðurnar að nýju gagnasafni með sömu dálkum og gerðum.
- **Opna í Vinna** velur gagnasafnið og skiptir um ham.

Leitin keyrir í SQLite í vinnsluþræði, svo síðan frýs ekki. Í gagnasafni með milljón raða tekur leit um eina sekúndu
á hvert orð.

**Opnaðu það sem fannst** þar sem það er. Hnappurinn í skoðaranum fer á rétta síðu í skjali, rétta mynd í safni, hnútinn með nágrönnum í neti, eininguna í líkani, hlutinn á skipulagi, staðinn á kortinu eða röðina í töflu.

**Leita eftir stað.** Undir *Leita eftir stað* velur þú sveitarfélag eða svæði, eða punkt og fjarlægð. Þú getur leitað án orða, og þá birtist allt á staðnum. Aðeins gagnasöfn með staði taka þátt. Flötur telst eftir miðpunkti sínum, svo þetta er ekki nákvæm yfirlögn. Nákvæma yfirlögn gerir þú undir Geo í Greina.

**Hliðartöflur taka þátt.** Orð á legg í neti finnur hnútana á báðum endum, og gildi í IFC-eiginleika finnur eininguna. Þetta á líka við um vistaða lista og val.

## Fyrirspurn

Flipinn Fyrirspurn býr til fyrirspurn án þess að þú skrifir SQL og sýnir þá SQL sem verður til. Spjaldið
**Gagnasöfn** velur gagnasafnið sem spurt er í og tengir fleiri við með *Bæta við tengingu*: veldu gagnasafn, hvort
aðeins raðir með samsvörun í báðum eða allar raðir þess fyrsta eigi að fylgja með, og hvaða dálkar eiga að passa
saman (fleiri lykla má bæta við; tengd gagnasöfn þurfa stuttnöfn). **Dálkar** velur hvað er sýnt, sem gildi eða sem
útreikning (fjöldi, fjöldi ólíkra, summa, meðaltal, lægsta, hæsta) með valfrjálsu nafni í niðurstöðunni; sé
útreikningur með eru raðirnar sjálfkrafa flokkaðar eftir hinum dálkunum. **Skilyrði** eru sett í hópa þar sem öll
skilyrði þurfa að gilda eða eitt nægir (er, er ekki, er stærra en, er minnst, er minna en, er mest, inniheldur,
byrjar á, er eitt af, er á milli, er tómt, er ekki tómt), og **Röðun og fjöldi** ljúka verkinu. *Keyra
fyrirspurnina* sýnir niðurstöðuna sem töflu með mynduðu SQL fyrir neðan; *Opna í Greina* setur SQL-ið í
SQL-stjórnborðið þar sem því má breyta frekar. Í SQL-inu heitir fyrsta gagnasafnið `t0` og þau tengdu `t1`, `t2` og
svo framvegis.

*Vista sem lista* vistar fyrirspurnina undir Listar, þar sem hún er keyrð aftur á gögnum dagsins, og *Vista sem
gagnasafn* gerir niðurstöðuna að nýju gagnasafni með dálkum niðurstöðunnar.

**Skilyrði eftir tegund.** Líkan má spyrja um eiginleika, til dæmis veggi með brunaflokk EI60. Net má spyrja um nágranna hnúts og um hnúta innan nokkurra skrefa, þar sem hnúturinn er gefinn með auðkenni eða nafni. Gagnasafn með stöðum má spyrja um stað. Skilyrðin má blanda við venjuleg skilyrði, og fyrirspurnina má vista sem lista eða gera að gagnasafni.

## Listar

Listi er vistuð leit í gagnasafni: textinn, afmarkanirnar og fjöldi niðurstaðna þegar hún var síðast keyrð. *Keyra*
sýnir niðurstöður dagsins í flipanum Leita (gögnin kunna að hafa breyst síðan listinn var vistaður), *Vista sem
gagnasafn* gerir niðurstöðurnar að nýju gagnasafni og *Eyða* fjarlægir listann. Listar fylgja gagnasafninu: sé
gagnasafninu eytt hverfa listar þess.

Listar eru líka notaðir annars staðar. Í Vinna velur *Listi* í tækjastiku töflunnar vistaða leit sem afmarkar
töfluna (merkið sýnir fjölda raða af heildinni), og í myndritasmiðnum velur *Listi* undir síunum hvaða raðir
myndrit byggir á; valið fylgir myndritinu í mælaborð og útflutning og er keyrt aftur á gögnum dagsins. Fyrirspurnir
sem vistaðar eru úr flipanum Fyrirspurn birtast með SQL-inu sínu undir Listar og eru keyrðar í Fyrirspurn.

## Skipanaspjaldið

Ctrl+K finnur hluti og skipanir eins og áður. Skipunin *Leita í gögnum* opnar Leita með leitarreitinn í fókus.

## Lyklaborð

Enter í leitarreitnum leitar. Hnappar flokkanna og raðir töflunnar nást með Tab; röð er opnuð í eiginleikaspjaldinu
með Enter.
