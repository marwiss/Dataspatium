# Dataspatium Farsími og flutningur milli tækja

Dataspatium Farsími er lítil síða fyrir síma og spjaldtölvur sem tekur á móti, sýnir og sendir áfram gögn úr
Dataspatium. Hún keyrir af vefnum (<https://marwiss.github.io/Dataspatium/m/> eða úr sömu möppu og forritið á eigin
vefþjóni) og má setja upp sem forrit. Allt Dataspatium keyrir ekki í símanum: farsímasíðan er sendill, viðtakandi,
skoðari og áframsendandi.

Flutningurinn fer beint milli tækjanna yfir staðarnetið með WebRTC, án þjóns og án þess að gögn fari um netið.
Tölvan sýnir QR-kóða, síminn skannar hann og bæði sýna sama staðfestingarkóða. Sama tækni tengir saman tvær tölvur
með kóðum sem límdir eru inn.

## Í fyrsta skipti: para símann

1. Á tölvunni: opnaðu *Deila → Tæki*, láttu *Tengjast við* standa á *Nýtt tæki* og smelltu á *Sýna QR-kóða*.
2. Í símanum: opnaðu myndavélina og beindu henni að QR-kóðanum. Farsímasíðan opnast í vafranum (í fyrsta skipti
   er hún sótt af vefnum; eftir það er hún í skyndiminni símans). Síminn sýnir 52 stafa kóða.
3. Á tölvunni: skrifaðu kóða símans í reitinn undir QR-kóðanum og smelltu á *Tengjast*. Tölva með myndavél mun í
   komandi útgáfu geta skannað QR-kóða símans í staðinn.
4. Bæði tæki sýna nú sama sex stafa staðfestingarkóða. Stemmi hann: smelltu á *Para tækið* á tölvunni. Síminn fær
   að vita það og vistar pörunina líka.

Næst nægir að velja símann undir *Tengjast við* á tölvunni, sýna QR-kóðann og skanna: tengingin verður til án
nokkurs kóða til baka. Pörunin samanstendur af vottorði símans og leyndarmáli sem tækin deila; hún er vistuð í
vafranum báðum megin og má fjarlægja undir *Pöruð tæki* (tölvan) eða með því að hreinsa vefgögn (síminn).

## Senda frá tölvunni

Undir *Senda* velurðu valin gagnasöfn eða öll gagnasöfn sem pakka, eða skrár af tölvunni. Gagnasöfn fara fyrst
gegnum yfirferðina fyrir deilingu (sjá [dela.md](dela.md)): dálka sem virðast innihalda kennitölur, netföng eða
símanúmer má dulnefna eða fjarlægja í afritinu. Síminn spyr áður en hann tekur á móti og sýnir staðfestingarkóðann
einu sinni enn. Flutningurinn fer í blokkum með prófsummu; slitni hann heldur hann áfram frá blokkunum sem þegar eru
komnar þegar þið tengist aftur.

## Í símanum

- **Móttekið** telur upp pakka og skrár með fjölda gagnasafna, stærð og sendanda. Pakki opnast með lista yfir
  gagnasöfn sín; gagnasafn birtist sem tafla með síu og flettingu, með fyrsta dálkinn fastan þegar töflunni er
  flett til hliðar.
- **Deila áfram** sendir pakkann eða skrána um deilivalmynd símans (tölvupóstur, skilaboð, skýjageymsla).
- **Senda til tölvu** setur pakkann í biðröð: skannaðu QR-kóða hinnar tölvunnar og þá er hann sendur þangað þegar
  tengingin er komin á. Þannig virkar sendilferlið tölva → sími → tölva, líka milli tveggja neta.
- Síminn getur líka sent eigin skrár (*Senda skrár úr símanum*) til tengdrar tölvu; þær eru fluttar inn þar sem
  gagnasöfn, eða opnaðar undir *Taka á móti* sé um pakka að ræða.
- Forrit í símanum geta deilt skrám til Dataspatium Farsíma um deilivalmyndina þegar farsímasíðan er uppsett sem
  forrit; skrárnar lenda undir *Móttekið*.
- *Stillingar* hafa heiti símans (það sem tölvan sýnir), kóða hans og tungumál.

## Tölva til tölvu

Veldu *Önnur tölva (líma inn kóða)* á annarri tölvunni og límdu inn kóðann úr *Sýna QR-kóða*-sýn hinnar tölvunnar
(hnappurinn *Afrita* undir QR-kóðanum). Fyrri tölvan sýnir þá svarkóða sem er límdur inn á hinni undir *Kóði frá
tækinu*. Eftir það virkar allt eins og milli tölvu og síma, pörun meðtalin.

## Kröfur og takmarkanir

- Tækin verða að ná hvort til annars á netinu. Á heimanetum og flestum skrifstofunetum virkar það; net sem
  einangra tæki hvert frá öðru (gestanet, sum fyrirtækjanet) stöðva tenginguna. Deildu þá eigin neti tölvunnar eða
  símans (netdeilingu) tímabundið.
- Tölvan þarf Edge, Chrome eða Firefox. Síminn þarf vafra með WebRTC og, fyrir skönnun, myndavél; í Android Chrome
  eru QR-kóðar lesnir beint á síðunni, í öðrum vöfrum er kóðinn opnaður um myndavélarforritið eða límdur inn.
- Síminn þarf að ná vefnum í fyrsta skipti til að sækja farsímasíðuna; eftir það virkar hún án nets nema sjálfur
  flutningurinn, sem fer um staðarnetið.
- Engin gögn eru send á neinn þjón. QR-kóðinn inniheldur netfang tölvunnar á staðarnetinu og einnota lykil;
  staðfestingarkóðinn ver gegn því að einhver annar á netinu tengist. Paraðu aðeins tæki þar sem þú hefur borið
  saman staðfestingarkóðann.
- Flutningur er geymdur í minni; mjög stórir pakkar (nokkur hundruð megabæti) geta verið of stórir fyrir síma.

## Bilanaleit

- *Bíð eftir að tækið tengist* hverfur ekki: tækin eru á ólíkum netum, eða netið lokar á umferð milli þeirra.
  Prófaðu netdeilingu úr símanum og tengdu tölvuna við hana.
- *Mótaðilinn er ekki tækið sem kóðinn vísar á*: kóðinn sem var skrifaður inn tilheyrir öðrum síma. Skrifaðu hann
  inn aftur.
- Staðfestingarkóðarnir eru ólíkir: aftengdu. Einhver annar kann að hafa skannað kóðann.
- Dagbókin neðst á tölvunni sýnir hvert skref tengingarinnar.
