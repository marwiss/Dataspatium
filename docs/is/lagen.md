# Hamirnir sex

Dataspatium skiptist í sex hami sem fylgja gangi vinnunnar, í anda hagskýrslugerðar þar sem gögnum er safnað, þau unnin,
greind og birt: Sækja, Umsjón, Vinna, Greina, Myndgera, Flytja út. Allir hamir hafa sömu grind: hamaval efst, hlutaspjald til
vinstri, vinnuflöt í miðju, eiginleikaspjald til hægri og dagbók neðst. Spjöldin skipta aldrei um stað. Alt+1 til Alt+6 skipta
um ham. Tómt vinnusvæði opnast í Sækja, vinnusvæði með gagnasöfnum í Umsjón. Hnapparnir efst til hægri fella inn spjöldin,
skipta um þema (ljóst, dökkt, fylgja kerfinu), skipta um tungumál og opna hjálpina.

Skipanaspjaldið (Ctrl+K eða stækkunarglerið efst) nær til alls úr einum leitarreit: skipta um ham, opna gagnasafn, myndrit eða
mælaborð, keyra aðgerð á valda gagnasafnið, flytja út, opna vinnusvæðið, skipta um þema eða leita að uppfærslum. Örvar upp og
niður velja, Enter keyrir og Esc lokar; síðast keyrðu skipanirnar eru efst.

## Sækja

Hér koma gögn inn: skrár sem sleppt er á flötinn, límdur texti, vefslóðir og opnar vefþjónustur. Innflutningur skráa fer fram í
skrefum: skrá, stillingar með forskoðun, dálkar með gerðum, lokið. Snið: CSV og annar aðgreindur texti, texti með fastri
breidd, Excel, ODS, JSON (líka JSON-stat og GeoJSON), XML, SQLite, GeoPackage, shapefile og gegnum R: SPSS, Stata, SAS, PX,
Parquet, RDS og RData (sjá [format.md](format.md)); R-sniðin eru flutt inn í einu skrefi án forskoðunar. Undir Opnar
vefþjónustur eru forstillingar fyrir hagstofur og fleiri stofnanir á Íslandi, í Danmörku, Noregi, Finnlandi, Svíþjóð,
Grænlandi, Færeyjum og á Álandseyjum, Nordic Statistics og Eurostat; landahnapparnir fyrir ofan listann velja hvaða landa
upprunar birtast. Eigin uppsetningum er bætt við úr skrá og þeim má deila. *Vistaðar sóknir* sýnir gagnasöfnin sem komu úr
vefþjónustu og uppfærir þau með einum smelli, eitt í einu eða öll. Sjá [api-konfiguration.md](api-konfiguration.md).

## Umsjón

Heimili gagnasafnanna. Yfirlit með lýsigögnum, dálkalisti, saga þess sem gert hefur verið við gagnasafnið, útgáfur, endurnefna
og stuttheiti (stuttheitið er notað í SQL, R og myndritaskrám), eyða, sækja aftur úr vefþjónustu (eitt gagnasafn eða öll í
einu). Hér er líka vinnusvæðið: hversu mikil geymsla er í notkun, varanleg geymsla, afritun í ZIP og endurheimt og, í Edge og
Chrome, færanleg mappa: vinnusvæðið er vistað sem venjulegar skrár í möppu sem þú velur, sjálfkrafa eftir hverja breytingu ef
þú vilt, og má hlaða inn á annarri tölvu. *Deila pakka* býr til ZIP með völdum gagnasöfnum, myndritum, mælaborðum, sniðum og
minnisbókum handa samstarfsmanni, sem hleður henni inn undir *Endurheimta úr ZIP*.

## Vinna

Allt sem gert er við töfluna með hnöppum og gluggum: breyta reitum beint í töflunni, raða, sía og sjá dálkatölfræði; aðgerðir
til hreinsunar (finna og skipta út með reglulegum segðum, fjarlægja bil, há- og lágstafir, lagfæring stafakóðunar, skipta út
gildi, fylla í vantandi, tvítök, hreinsun flokka), gerðir (tölur, dagsetningar, já/nei), uppbygging (reiknaðir dálkar, skipta
og sameina, eyða röðum, snúa) og ný gagnasöfn (hópa og taka saman, tengja, skeyta saman). Gagnagæðasniðið bendir á það sem
ætti að lagfæra og gæðareglur (má ekki vanta, einkvæmt, bil, listi, mynstur, lengd, SQL-skilyrði) athuga gögnin eftir þörfum
með skýrslu og röðum sem bregðast sem sérstöku gagnasafni. Allt er skráð sem uppskriftir sem má afturkalla, keyra á annað
gagnasafn og flytja út sem R- eða SQL-kóða. Útgáfur vista skyndimyndir til að fara aftur í. Sjá [bearbeta.md](bearbeta.md).

## Greina

Kóði og tölfræði. R-stjórnborð með ggplot2, dplyr, tidyr og öðrum pökkum, vistaðar skriftur, myndrit með útflutningi í SVG, PNG
og PDF og `dm_read()`/`dm_write()` til að flytja gögn milli forritsins og R (sjá [r-guide.md](r-guide.md)). SQL-stjórnborð á
valda gagnasafnið (`data`), þar sem önnur gagnasöfn nást með stuttheitum sínum svo ein fyrirspurn getur tengt fleiri
gagnasöfn með join; fyrirspurnir sýna niðurstöður sem má vista sem nýtt gagnasafn og breytandi setningar eru skráðar sem skref
í uppskriftinni (sjá [bearbeta.md](bearbeta.md)). Minnisbókin blandar saman texta (Markdown), R og SQL í reitum sem keyra í röð
og verða að skýrslu í HTML, Word, PDF, Markdown eða LaTeX (sjá [anteckningsbok.md](anteckningsbok.md)). Regex-flipinn prófar reglulegar segðir á dálki með samsvaranirnar merktar og notar þær til að sía, draga út,
skipta út, skipta upp, merkja, telja eða búa til gæðareglu, með mynsturyfirliti og safni norrænna mynstra (sjá
[regex.md](regex.md)). Síðar: tölfræðileg líkön.

## Myndgera

Myndrit með þremur vélum og einu útliti: myndritasmiðurinn (Vega-Lite) með súlum, línum, flötum, punktum, stuðlaritum,
hitakortum, kassaritum, kökuritum og kortum (þemakort úr GeoJSON- eða shapefile-gögnum); D3-snið fyrir röðun, hallarit og
aldurspíramída; og R-skriftur með ggplot2. Vistuð myndrit má flytja út sem SVG, PNG, PDF og PowerPoint, deila sem viz-skrám,
sýna í safni og búa til í hópkeyrslu eftir hópum. Mælaborð safna vistuðum myndritum í hnitanet með sameiginlegum síum og eru
flutt út sem HTML eða PowerPoint. Sjá [visualisera.md](visualisera.md).

## Flytja út

Þrír flipar. **Gögn**: CSV (aðlagað Excel eða staðlað), Excel, ODS, JSON, XML, SQLite og gegnum R: Parquet, SPSS, Stata og RDS.
**Myndrit**: vistuð myndrit og mælaborð (líka öll myndrit sem ein PowerPoint) sem SVG, PNG og PDF, eitt í einu eða í hópkeyrslu
eftir hópum í ZIP. **Skjöl**: skýrslur, kóðabækur og samantektir úr sniðum í Markdown með staðgenglum, sem HTML, Word, PDF,
Markdown eða LaTeX, eitt í einu eða í hópkeyrslu eftir hópum (sjá [dokumentmallar.md](dokumentmallar.md)).
