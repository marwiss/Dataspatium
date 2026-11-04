# Söfnun á vettvangi

Með **Söfnun á vettvangi** fyllir þú út raðir í símanum, með eða án nets, með mynd og staðsetningu. Eyðublaðið byggir á dálkum og reglum
gagnasafns, svo röng röð sést strax þar sem þú stendur. Raðirnar koma síðan aftur í tölvuna sem ný útgáfa gagnasafnsins. Myndirnar verða að
myndasafni og staðsetningarnar lenda á kortinu.

## Svona gengur það fyrir sig

1. Í **Sækja** velur þú *Söfnun á vettvangi* og síðan gagnasafn eða *Nýtt gagnasafn*.
2. Ákveddu hvaða reiti síminn á að spyrja um og ýttu á *Senda í símann*.
3. Tengdu símann undir **Tæki** í Deila og sendu eyðublaðið. Síminn þarf net í þetta sinn.
4. Í símanum opnar þú eyðublaðið og safnar röðum. Nú þarf ekki net.
5. Þegar þú ert kominn aftur ýtir þú á *Senda í tölvuna* og skannar kóða tölvunnar.
6. Tölvan sýnir hvað hefur borist og þú velur *Bæta við*.

## Eyðublaðið

Hver dálkur verður að reit. Þú getur slökkt á dálki, breytt merkinu og valið hvort reitsins sé krafist. *Halda í næstu röð* hentar því sem er
eins í mörgum röðum, til dæmis dagsetningu eða svæði.

Gerð reitsins kemur frá dálkinum. Gildamerki og reglan *leyfð gildi* verða sjálfkrafa að vallista. Þú getur líka skrifað val sjálfur, eitt í línu
sem `gildi` eða `kóði = texti`, eða sótt þau með *Sækja val úr dálkinum*.

Staðsetning og myndir geta verið óvirkar, valfrjálsar eða krafist. Myndir eru minnkaðar í símanum svo lengsta hliðin verði 2048 dílar, nema þú
veljir annað undir *Fleiri valkostir*.

*Nýtt gagnasafn* tekur einn dálk í línu, til dæmis `stadur` eða `fjoldi: heiltala`.

Áður en eyðublaðið fer úr tölvunni sýnir appið hvað fylgir með. Það eru reitir, merki, val og reglur, aldrei raðir.

## Reglurnar

Síminn athugar reglurnar með sama SQLite og tölvan, svo röð er metin eins á báðum stöðum.

- **Athugað í símanum:** bil, leyfð og bönnuð gildi, mynstur, snið, lengd, kennitölur, samanburður milli dálka og frjáls SQL-skilyrði sem nota
  aðeins dálka eyðublaðsins.
- **Einkvæm gildi** eru aðeins borin saman við raðirnar í símanum. Tölvan athugar gagnvart öllu gagnasafninu.
- **Aðeins athugað í tölvunni:** heilleiki, gildi í öðru gagnasafni og reglur um dálka sem eru ekki á eyðublaðinu.

Villa á eyðublaðinu, eins og auður reitur sem krafist er eða bókstafur í talnareit, kemur í veg fyrir að röðin sé vistuð. Brotin regla stöðvar það
einu sinni. Ef þú ýtir aftur á Vista er röðinni haldið og reglan skráð, því sá sem stendur á staðnum getur vitað betur en reglan.

## Í símanum

Eyðublaðið er efst á upphafssíðunni í Dataspatium Mobil. *Vista og ný röð* er venjulega leiðin áfram.

Röð sem þú ert að vinna í er vistuð sem drög frá fyrstu breytingu og myndir eru geymdar um leið og þær eru teknar. Símar loka stundum síðunni þegar
myndavélin opnast. Þá býður eyðublaðið *Halda áfram með drögin* þegar þú kemur aftur.

Síminn sýnir *Virkar án nets í þessum síma* þegar hann hefur allt sem hann þarf. Ef þar stendur í staðinn að opna þurfi síðuna einu sinni enn, gerðu
það á meðan þú hefur net. Settu síðuna gjarnan upp á heimaskjánum. Vafrar geta annars hreinsað geymslu síðna sem eru ekki notaðar og á iPhone getur
það gerst eftir viku án notkunar.

Raðir eru áfram í símanum þar til þú velur *Hreinsa sendar*. Senda röð er ekki hægt að breyta í símanum, aðeins í tölvunni.

Ef þú hefur enga tengingu við tölvuna getur þú notað *Deila sem skrá* og sent skrána á annan hátt. Tekið er á móti henni undir **Taka á móti** í Deila.

## Í tölvunni

Raðirnar berast um Tæki eða Taka á móti og þú sérð þær áður en nokkru er bætt við.

- Taflan er fyrst vistuð sem útgáfa svo þú getir farið til baka.
- Dálkum sem vantar er bætt við: `falt_id`, `lat`, `lon`, `noggrannhet_m`, `foto`, `insamlad` og `insamlad_av`. Ef gagnasafnið hefur þegar dálka
  fyrir lengd og breidd eru þeir notaðir.
- Gagnasafnið opnast sem kort í Vinna, því raðirnar hafa staðsetningu.
- Myndirnar verða að myndasafninu *Heiti: myndir* með staðsetningu og tíma raðarinnar. Síðari afhendingar fara í sama safn.
- Reglur gagnasafnsins eru keyrðar á niðurstöðuna og skráin segir hve margar eru brotnar.

Raðir eru þekktar á `falt_id`. Sömu skrá má því taka á móti tvisvar án þess að neitt tvöfaldist, en röð sem hefur verið breytt í tölvunni er ekki
yfirskrifuð.

Ef gagnasafnið er ekki lengur í tölvunni er lagt til nýtt með dálkum eyðublaðsins.

## Persónuupplýsingar

Staðsetning og myndir eru oft persónuupplýsingar og mynd getur sýnt fólk. Spyrðu aðeins um það sem þarf og slökktu annars á staðsetningu og myndum.

Síminn biður um leyfi áður en hann gefur upp staðsetningu og staðsetningin sjálf fer hvergi fyrr en þú sendir raðirnar. Raðir og myndir liggja
ódulkóðaðar í geymslu vafrans í símanum, svo sendu þær og hreinsaðu reglulega.

## Takmarkanir

- Dataspatium Mobil keyrir frá vefslóð, ekki úr skrá, og þarf net í fyrsta sinn.
- Nákvæmni staðsetningar fer eftir símanum. Reiturinn `noggrannhet_m` segir hversu viss hún er.
- Stórar safnanir skiptast í nokkrar skrár, sem tekið er á móti hverri fyrir sig.
- Margir símar geta safnað með sama eyðublaði. Hver sími hefur sínar eigin raðir og þeim er bætt við hverri fyrir sig.
