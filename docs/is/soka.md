# Leita

Hamurinn Leita finnur og listar án kóða. Hann liggur milli Umsjónar og Vinnu: fyrst finnur þú það sem þú leitar að,
síðan vinnur þú með það. Tveir flipar eru til frá 2.0, Leita og Listar; flipinn Fyrirspurn, sjónrænn
fyrirspurnasmiður sem sýnir þá SQL sem hann býr til, kemur í 2.2.

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

## Listar

Listi er vistuð leit í gagnasafni: textinn, afmarkanirnar og fjöldi niðurstaðna þegar hún var síðast keyrð. *Keyra*
sýnir niðurstöður dagsins í flipanum Leita (gögnin kunna að hafa breyst síðan listinn var vistaður), *Vista sem
gagnasafn* gerir niðurstöðurnar að nýju gagnasafni og *Eyða* fjarlægir listann. Listar fylgja gagnasafninu: sé
gagnasafninu eytt hverfa listar þess.

## Skipanaspjaldið

Ctrl+K finnur hluti og skipanir eins og áður. Skipunin *Leita í gögnum* opnar Leita með leitarreitinn í fókus.

## Lyklaborð

Enter í leitarreitnum leitar. Hnappar flokkanna og raðir töflunnar nást með Tab; röð er opnuð í eiginleikaspjaldinu
með Enter.
