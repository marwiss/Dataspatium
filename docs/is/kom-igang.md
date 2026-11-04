# Hafist handa með Dataspatium

Þessi leiðarvísir fer með þig frá niðurhali að fyrsta útflutningi. Hann gerir ekki ráð fyrir neinu öðru en nútímalegum vafra.

## 1. Sæktu og afþjappaðu

Sæktu nýjustu útgáfuna á <https://github.com/marwiss/Dataspatium/releases/latest>: ZIP-skrána `dataspatium-<útgáfa>.zip`
undir *Assets*. Afþjappaðu hana í möppu sem þú velur sjálf(ur), til dæmis `Skjöl\Dataspatium`. Mappan inniheldur `index.html`,
möppurnar `src`, `vendor` og `docs` og fleira. Ekki færa eða endurnefna skrár inni í möppunni; alla möppuna má hins vegar
færa að vild, líka á USB-lykil.

## 2. Opnaðu forritið

Tvísmelltu á `index.html`. Vafrinn opnar forritið af tölvunni þinni (slóðin byrjar á `file:///`). Ef tvísmellurinn virkar ekki
skaltu hægrismella og velja *Opna með* og vafrann þinn, eða draga skrána í opinn vafraglugga.

Í fyrsta skipti spyr forritið hvaða tungumál þú vilt nota: sænsku, dönsku, norsku, finnsku, íslensku eða ensku. Valið er
vistað í vafranum og má breyta hvenær sem er með tungumálahnappnum (táknið með bókstöfum) efst til hægri eða gegnum
skipanaspjaldið. Leturgerðir og tákn eru hlaðin úr möppunni; það tekur augnablik. Ekkert er sótt af netinu.

### Grunnnámskeiðið

Eftir tungumálavalið hefst **grunnnámskeiðið**, gagnvirk yfirferð í spjaldi neðst til hægri. Það tekur um tíu mínútur
og fylgir dæminu *Mannfjöldi eftir sveitarfélögum 2024 (Svíþjóð)* gegnum alla átta hamina: sækja gögn, skoða
gagnasafnið, leita, reikna dálk, spyrja með SQL, reikna með R, búa til myndrit, flytja út og deila. Hvert skref útskýrir hugtak og
gefur verkefni. Rammi sýnir hvar á að smella og skrefið er merkt lokið þegar þú hefur gert það. *Gera það fyrir mig*
framkvæmir skrefið ef þú vilt frekar sjá hvernig það er gert.

Hægt er að lágmarka námskeiðið og loka því, og opna það aftur hvenær sem er úr hjálpinni (spurningarmerkið efst til
hægri) eða af skipanaspjaldinu (Ctrl+K, *Opna grunnnámskeiðið*). Það heldur áfram þar sem frá var horfið.

## 3. Hamirnir

Efst eru átta hamir. Spjaldið til vinstri sýnir hluti (gagnasöfn og uppruna), í miðjunni er vinnuflöturinn, spjaldið
til hægri sýnir eiginleika og tölfræði og neðst er stöðustikan með vistunarstöðu, geymslu, valda gagnasafninu,
R-vélinni og hnöppunum sem fella spjöldin inn og opna dagbókina. Breidd spjaldanna er breytt með því að draga brúnina
að vinnuflötinum. Alt+1 til Alt+8 skipta um ham með lyklaborðinu.

| Hamur | Hvað þú gerir þar |
|---|---|
| Sækja | Flytur inn skrár, límir inn töflur og sækir úr opnum vefþjónustum á Norðurlöndum, eins og Hagstofu Íslands, Veðurstofu Íslands, SCB, SSB, Hagstofu Finnlands og Eurostat ([api-konfiguration.md](api-konfiguration.md)) |
| Umsjón | Sérð gagnasöfnin þín í möppum með merkjum, endurnefnir, eyðir, vistar útgáfur, keyrir hópaðgerðir á fleiri gagnasöfn, tekur afrit af og endurheimtir vinnusvæðið |
| Leita | Leitar í öllum dálkum í einu eða öllum gagnasöfnum, afmarkar með flokkum og vistar leitir sem lista ([soka.md](soka.md)) |
| Vinna | Breytir reitum, raðar og síar, hreinsar og ákvarðar gerðir, reiknar dálka, snýrð og tengir gagnasöfn; allt með afturköllun, útgáfum og uppskriftum ([bearbeta.md](bearbeta.md)) |
| Greina | R-stjórnborð með ggplot2 og tidyverse, vistaðar skriftur og útflutningur myndrita; Python-stjórnborð með pandas og matplotlib; SQL-stjórnborð á valda gagnasafnið; reglulegar segðir; minnisbók sem verður að skýrslu |
| Myndgera | Býrð til myndrit með Vega-Lite, D3-sniðum eða R-skriftum, vistar, flytur út og býrð þau til í hópkeyrslu ([visualisera.md](visualisera.md)) |
| Flytja út | Hleður niður gögnum sem CSV, Excel, JSON eða SQLite, vistuðum myndritum sem SVG, PNG eða PDF og skjölum úr sniðum sem HTML, Word, PDF, Markdown eða LaTeX ([dokumentmallar.md](dokumentmallar.md)) |
| Deila | Pakkar gagnasöfnum með myndritum og sniðum fyrir samstarfsfólk, sendir þau beint í síma og aðrar tölvur með QR-kóða ([mobil.md](mobil.md)), sendir vinnusvæðið á GitHub, deilir um deilivalmynd tölvunnar og birtir mælaborð sem HTML ([dela.md](dela.md)) |

## 4. Flyttu inn skrá

1. Farðu í *Sækja* og slepptu skrá á strikaða flötinn (eða smelltu og veldu skrá). Studd skráarsnið: CSV, TSV og aðrar
   aðgreindar textaskrár, Excel (xlsx, xls, xlsm, xlsb), ODS, JSON, NDJSON, JSON-stat, GeoJSON, XML, SQLite, GeoPackage,
   shapefile (ZIP með shp og dbf), texti með fastri breidd og tölfræðiskrár úr SPSS (sav), Stata (dta), SAS (sas7bdat, xpt),
   PX-snið, Parquet og R (rds, RData). Einnig má sækja skrár beint af vefslóð undir *Af vefslóð*. R les tölfræðisniðin og þau
   eru flutt inn í einu skrefi án forskoðunar; í fyrsta skipti tekur það nokkrar sekúndur meðan R ræsist. Sjá
   [format.md](format.md).
2. Athugaðu stillingarnar. Dataspatium giskar á stafakóðun (UTF-8 eða Windows-1252), aðgreini, hvort fyrsta röðin sé
   fyrirsagnir og hvort tugabrotstáknið sé komma eða punktur. Forskoðunin sýnir fyrstu 100 raðirnar.
3. Athugaðu dálkana. Hver dálkur fær gerð: texti, heiltala, tugabrot, dagsetning, dagsetning og tími eða já/nei. Kóðar með
   núllum fremst (sveitarfélagakóðar, póstnúmer) eru geymdir sem texti. Breyttu heiti eða gerð eftir þörfum og taktu hakið af
   dálkum sem þú vilt ekki hafa með.
4. Gefðu gagnasafninu heiti og smelltu á *Flytja inn*. Síðan geturðu opnað það beint í *Vinna*.

Ábending: þú getur líka límt inn töflu úr Excel eða af vefsíðu gegnum *Líma* í spjaldinu til vinstri.

## 5. Flettu og athugaðu

Í *Vinna* birtist taflan. Smelltu á dálkafyrirsögn til að raða (vaxandi, minnkandi, óraðað) og til að sjá tölfræði dálksins til
hægri: fjöldi, vantar, ólík gildi, lægst, hæst, meðaltal, summa og algengustu gildi. Skrifaðu í síureitinn til að sýna aðeins
raðir sem innihalda textann. Stórar töflur birtast röð fyrir röð eftir því sem þú flettir, svo jafnvel hundruð þúsunda raða má
skoða.

## 6. Flyttu út

Í *Flytja út* velurðu snið og skráarheiti og smellir á *Flytja út og hlaða niður*.

- CSV með sniðinu *Aðlagað fyrir Excel á Norðurlöndum* notar semikommu, tugakommu og UTF-8 með BOM svo Excel með norrænum
  stillingum opni skrána rétt strax. Sniðið *Staðlað* gefur kommu og tugapunkt.
- Excel (xlsx) og ODS halda tölum, dagsetningum og já/nei sem raunverulegum gerðum.
- JSON gefur lista af hlutum, XML skrá með einu staki fyrir hverja röð.
- SQLite gefur eigin skrá gagnasafnsins, sem einnig má lesa í R, DB Browser for SQLite og mörgum öðrum verkfærum.
- Parquet, SPSS (sav), Stata (dta) og RDS eru skrifuð af R og ræsa R-setuna þegar þörf krefur.

Öll snið má flytja aftur inn í Dataspatium.

## 7. Taktu afrit

Gagnasöfnin eru í gagnagrunni vafrans á þessari tölvu. Þau hverfa ef þú hreinsar vefgögn, skiptir um vafrasnið eða fjarlægir
vafrann. Farðu í *Umsjón*, veldu *Vinnusvæði* og smelltu á *Taka afrit af vinnusvæðinu*. Þú færð ZIP-skrá með öllum
gagnasöfnum. Endurheimtu með því að sleppa ZIP-skránni á flötinn *Endurheimta úr ZIP*.

Í Edge og Chrome geturðu auk þess valið *færanlega möppu*: vinnusvæðið er vistað sem venjulegar skrár (ein SQLite-skrá fyrir
hvert gagnasafn auk myndrita og sniða) í möppu sem þú velur, til dæmis á USB-lykli eða í samstilltri möppu. Kveiktu á *Vista
sjálfkrafa við breytingar* svo mappan haldist uppfærð. Á annarri tölvu velurðu sömu möppu og smellir á *Hlaða úr möppunni*.
Eftir endurræsingu vafrans biður hann einu sinni um leyfi til að nota möppuna aftur; smelltu á *Tengjast aftur*.

Ef þú vilt senda úrval til samstarfsmanns ferðu í haminn *Deila* og flipann *Pakki*: veldu gagnasöfn og hvort myndrit,
mælaborð, snið, minnisbækur og skriftur eigi að fylgja. Samstarfsmaðurinn opnar pakkann undir *Taka á móti* í sama
ham; því sem þegar er til í vinnusvæði hans eða hennar er sleppt.

## Algengar spurningar

**Síðan er tóm eða sýnir aðeins „Dataspatium er að ræsast“.** Athugaðu að öll mappan hafi verið afþjöppuð (ekki aðeins
`index.html`) og að þú notir nýlega útgáfu af Edge, Chrome eða Firefox. Opnaðu stjórnborð vafrans (F12) og leitaðu að rauðum
villum; tilkynntu þær gjarnan sem issue.

**Íslensku stafirnir mínir urðu að undarlegum táknum.** Skiptu um stafakóðun í innflutningsskrefinu *Stillingar*, oftast milli
UTF-8 og Windows-1252.

**Tölur urðu að texta.** Dálkurinn innihélt eitthvert gildi sem ekki var hægt að túlka sem tölu, eða tölur með núlli fremst.
Breyttu gerðinni í skrefinu *Dálkar* til að knýja fram túlkun; gildi sem ekki er hægt að túlka verða tóm.

**Get ég deilt gögnum með samstarfsmanni?** Já, fluttu gagnasafnið út (SQLite eða CSV) eða taktu afrit af vinnusvæðinu og
sendu ZIP-skrána. Samstarfsmaðurinn flytur inn eða endurheimtir í sínu Dataspatium.

**Af hverju enginn þjónn eða skýjaþjónusta?** Svo að gögnin þín haldist hjá þér og forritið virki án uppsetningar, aðganga og
nets.

Fleiri spurningar og svör eru í [faq.md](faq.md). Þegar þú vilt komast lengra en fyrstu skrefin lýsir
[anvandarguide.md](anvandarguide.md) öllu vinnuferlinu frá skrá til skýrslu.
