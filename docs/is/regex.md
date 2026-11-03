# Reglulegar segðir (Regex)

Regluleg segð er mynstur sem lýsir texta: `^\d{3}$` lýsir íslensku póstnúmeri, `\(([^)]*)\)` texta innan sviga. Í
Dataspatium eru mynstrin notuð til að greina, leiðrétta og skipta upp gildum í gagnasöfnum. Flipinn **Regex** í
hamnum Greina er staðurinn til að prófa mynstur á dálki og sjá niðurstöðuna strax. Sömu mynstur virka líka í Vinna
(aðgerðahópurinn *Reglulegar segðir*, *Finna og skipta út*), í gæðareglunni *Passar við mynstur* og í
SQL-stjórnborðinu.

## Hvaða staðall?

Dataspatium notar reglulegar segðir JavaScript samkvæmt staðlinum ECMAScript (ECMA-262), með Unicode-flaggið virkt.
Ástæðurnar:

- Þær eru innbyggðar í vafrann, svo ekkert aukasafn þarf og allt virkar frá `file://`.
- Sama vélin er notuð alls staðar í forritinu: í Regex-flipanum, í SQL-föllum SQLite-vélarinnar, í reglunum og í
  Finna og skipta út. Mynstur sem virkar á einum stað virkar á öllum.
- Þær hafa það sem gögn krefjast: nefnda hópa `(?<heiti>…)`, að horfa fram og aftur (`(?=…)`, `(?<=…)`),
  Unicode-flokka eins og `\p{L}` (alla bókstafi, líka á, ð, þ, æ, ö, ä og å) og flögg fyrir há- og lágstafi.
- Málskipanin er vel skjalfest (til dæmis á MDN) og mjög nálægt þeirri sem R-pakkinn stringr (ICU) og PCRE nota,
  svo mynstur má flytja milli Dataspatium, R og flestra annarra tóla.

Aðrir staðlar sem voru bornir saman: POSIX ERE (sjálfgefna vél R, TRE) vantar að horfa fram og aftur og
Unicode-flokka. PCRE (R með `perl = TRUE`) og ICU (stringr) eru náskyld JavaScript. RE2 tryggir að mynstur geti
aldrei fest sig, en er ekki til í vafranum og vantar bakvísanir og að horfa fram og aftur. Áhættunni við
JavaScript, að sum mynstur geti tekið mjög langan tíma, er í staðinn mætt með tímamörkum (sjá *Öryggi og afköst*).

Reglur Dataspatium umfram staðalinn:

- Unicode-flagginu er bætt við þegar mynstrið leyfir það. Eldra mynstur sem er aðeins gilt án þess, til dæmis
  `a\-b`, virkar samt, en þá án `\p{…}`.
- `(?i)`, `(?s)` og `(?m)` fremst í mynstrinu verða að flöggum, eins og í R, Python og PCRE. `(?i)ísafjörður`
  passar við ÍSAFJÖRÐUR.
- `\w`, `\d` og `\b` ná aðeins yfir a–z, A–Z, 0–9 og undirstrik. Notaðu `\p{L}` fyrir bókstafi og `(?<!\p{L})` og
  `(?!\p{L})` sem orðaskil í texta með íslenskum stöfum.

## Regex-flipinn

Flipinn er í Greina við hliðina á R, SQL og Minnisbók og hefur sama útlit og restin af forritinu:

- **Vinstra megin**: gagnasöfnin, vistuðu mynstrin þín og mynsturasafnið.
- **Í miðjunni**: dálkur, mynstur, flögg og hvað á að gera, með forskoðun.
- **Hægra megin**: málskipanin í stuttu máli og það sama sem SQL- og R-kóði sem má opna í SQL- eða R-flipanum.

Svona gerirðu:

1. Veldu gagnasafn í listanum til vinstri og dálk í reitnum **Dálkur**.
2. Skrifaðu mynstur í reitinn **Mynstur** eða smelltu á mynstur í safninu. Forskoðunin sýnir algengustu gildi
   dálksins (allt að 500 ólík) með samsvaranirnar merktar, og línan undir reitnum segir hve margar raðir passa.
3. Veldu eftir þörfum **Hunsa há- og lágstafi**, **Allt gildið þarf að passa** (mynstrið er umlukt `^(?:` og
   `)$`) og **Punktur passar við línuskil**.
4. Veldu hvað á að gera undir **Hvað á að gera** og ýttu á **Nota**.

| Hvað á að gera | Hvað gerist |
|---|---|
| Prófa og sýna samsvaranir | Sýnir samsvaranirnar, fjöldann á hvert gildi og, ef þú vilt, aðeins gildi með eða án samsvörunar. Engu er breytt |
| Mynsturyfirlit | Sýnir form gildanna: `A` er hástafur, `a` annar bókstafur og `9` tölustafur, svo `101` hefur formið `999`. *Einfalda endurtekningar* skrifar runu sem `9+`. **Nota** býr til mynstur úr forminu. Engu er breytt |
| Sía raðir | Heldur röðunum sem passa eða fjarlægir þær |
| Draga út í nýja dálka | Nýr dálkur fyrir hvern hóp í mynstrinu, eða einn dálkur með allri samsvöruninni ef mynstrið hefur enga hópa. Nefndir hópar gefa dálkaheitin; gefa má önnur heiti. *Allar samsvaranir* safnar öllum samsvörunum með aðgreini |
| Skipta út | Skiptir út samsvörunum í textadálkum. `$1`, `$2` og `$<heiti>` setja inn hóp, `$&` alla samsvörunina |
| Skipta upp í dálka | Skiptir gildinu þar sem mynstrið passar, í valinn fjölda dálka; sá síðasti fær afganginn af textanum |
| Merkja samsvaranir í nýjum dálki | Já/nei-dálkur sem sýnir hvort gildið passar |
| Telja samsvaranir í nýjum dálki | Dálkur með fjölda samsvarana í hverju gildi |
| Búa til gæðareglu | Bætir reglunni *Passar við mynstur* við fyrir dálkinn; hún er keyrð undir Reglur í Vinna |

Það sem breytir gagnasafninu verður að uppskriftarskrefi, eins og aðgerðirnar í Vinna: það má afturkalla þar, keyra
aftur á öðru gagnasafni og flytja út sem SQL (með föllum Dataspatium `dm_regex_*`) og sem R-kóða (með pakkanum
stringr). Sömu skref eru í Vinna undir **Aðgerðir** í hópnum *Reglulegar segðir*.

Gildi sem eru ekki texti, til dæmis tölur og dagsetningar, eru prófuð á textaformi sínu (`2.5`, `2024-01-31`).

## Mynsturasafnið

Safnið hefur tilbúin mynstur í þremur hópum. *Svíþjóð*: personnummer, organisationsnummer, póstnúmer,
sveitarfélagsnúmer, símanúmer og bílnúmer. *Norðurlönd*: danskt CPR-númer, norskt fødselsnummer, finnskt
henkilötunnus, kennitala og norræn póstnúmer. *Almennt*: netfang, veffang í texta, dagsetningar sem ÁÁÁÁ-MM-DD og
D.M.ÁÁÁÁ, klukkan, ártal í texta, tala með tugakommu, upphæð í krónum, texti innan sviga, orð, óþörf bil og
myllumerki.

Mynstrin í safninu athuga formið, ekki hvort númer sé gilt. Vartölur og dagsetningar í auðkennisnúmerum athugar
reglan *Gilt auðkennisnúmer* í Vinna.

## Vistuð mynstur

**Vista mynstur** vistar mynstrið og flöggin undir heiti. Vistuð mynstur birtast til vinstri og fylgja, eins og R-
og SQL-skriftur, afritum, pökkum (þegar *Vistaðar skriftur og mynstur* er valið) og færanlegu möppunni sem skrár
`scripts/<id>.script.json`.

## Málskipan í stuttu máli

| Mynstur | Merkir | Dæmi |
|---|---|---|
| `.` | hvaða stafur sem er | `a.c` passar við abc og a-c |
| `\d` | tölustafur 0–9 | `\d{4}` passar við 2024 |
| `\p{L}`, `\p{Lu}`, `\p{Ll}` | bókstafur, hástafur, lágstafur | `\p{Lu}\p{Ll}+` passar við Ísafjörður |
| `\s` | bil, dálkastopp eða línuskil | `\s{2,}` passar við tvöföld bil |
| `[abc]`, `[^abc]`, `[a-z]` | einn af stöfunum, enginn þeirra, bil | `[.,]` passar við punkt eða kommu |
| `a\|b` | a eða b | `kr\|ISK` |
| `*`, `+`, `?` | núll eða fleiri, einn eða fleiri, núll eða einn | `\d+` |
| `{n}`, `{n,m}`, `{n,}` | nákvæmlega n, n til m, minnst n sinnum | `\d{3,4}` |
| `^`, `$` | upphaf og endir gildisins | `^\d+$` er aðeins tölustafir |
| `(…)` | hópur, notaður sem `$1` | `(\d{6})-?(\d{4})` |
| `(?<heiti>…)` | nefndur hópur, notaður sem `$<heiti>` | `(?<ar>\d{4})` |
| `(?:…)` | hópur sem er ekki geymdur | `(?:kr\|ISK)` |
| `(?=…)`, `(?!…)` | fylgt af, ekki fylgt af | `\d+(?= kr)` |
| `(?<=…)`, `(?<!…)` | á undan er, á undan er ekki | `(?<=nr\. )\d+` |
| `\` | gerir sértákn venjulegt | `\.` er punktur, `\(` svigi |

## Dæmi

| Verkefni | Mynstur | Hvað á að gera |
|---|---|---|
| Ártal úr texta eins og *Mannfjöldi 2024* | `(?<ar>(?:19\|20)\d{2})` | Draga út; nýr dálkur `ar` |
| Kóði innan sviga, *Höfuðborgarsvæðið (1)* | `\((\d+)\)` | Draga út; gefðu heitið `kodi` |
| Kennitala með bandstriki | `^(\d{6})-?(\d{4})$` | Skipta út fyrir `$1-$2` |
| Eftirnafn og fornafn úr *Berg, Anna* | `, ?` | Skipta upp í 2 dálka |
| Raðir með netfangi í frjálsum texta | `[^\s@]+@[^\s@]+\.[^\s@]+` | Merkja samsvaranir eða Sía raðir |
| Blönduð dagsetningasnið | (ekkert) | Mynsturyfirlit sýnir til dæmis `9999-99-99` og `99.99.9999`; lagaðu síðan með Breyta gerð í Vinna |
| Símanúmer með aðeins tölustöfum | `[^\d+]` | Skipta út fyrir ekkert (eða aðgerðin Fjarlægja tákn) |

## Í SQL og R

SQL-stjórnborðið hefur sömu mynstur gegnum föll Dataspatium:

| Fall | Gefur |
|---|---|
| `x regexp 'mynstur'`, `regexp('mynstur', x)` | 1 ef x passar, annars 0 |
| `regexp_replace(x, 'mynstur', 'útskipting', 'gi')` | x með samsvörunum skipt út (`g` allar, `i` óháð há- og lágstöfum) |
| `dm_regex_test(x, 'mynstur', 'i')` | 1, 0 eða autt fyrir autt gildi |
| `dm_regex_extract(x, 'mynstur', hópur, '')` | hópinn (númer eða heiti, 0 fyrir alla samsvörunina) í fyrstu samsvörun |
| `dm_regex_all(x, 'mynstur', hópur, ', ', '')` | hópinn í öllum samsvörunum með aðgreini |
| `dm_regex_count(x, 'mynstur', '')` | fjölda samsvarana |
| `dm_regex_split(x, 'mynstur', hluti, fjöldi, '')` | hluta númer `hluti` af `fjöldi` þegar x er skipt við mynstrið |
| `dm_shape(x, 0)` | formið í mynsturyfirlitinu (1 einfaldar endurtekningar) |

```sql
select sveitarfelag, dm_regex_extract(heiti, '\((\d+)\)', 1, '') as kodi
from data
where dm_regex_test(postnumer, '^\d{3}$', '') = 0
```

Í R er pakkinn stringr notaður, en málskipan hans (ICU) er nánast sú sama: `stringr::str_detect(df$postnumer,
stringr::regex("^\\d{3}$"))`. Munurinn sem gott er að þekkja: í R er hvert `\` skrifað tvisvar inni í streng, hópur í
útskiptingu er skrifaður `\\1` í stað `$1` (útflutningur uppskrifta breytir því fyrir þig), og að horfa aftur á bak
þarf að hafa takmarkaða lengd. `\d` passar við alla Unicode-tölustafi í ICU en aðeins 0–9 í JavaScript.

## Öryggi og afköst

Sum mynstur geta tekið óhemju langan tíma á sumum gildum, til dæmis `(a+)+$` á langri runu af a sem endar á öðrum
staf (*hörmuleg bakrakning*). Þess vegna eru mynstrin prófuð í sérstökum bakgrunnsþræði með tveggja sekúndna
tímamörkum. Þegar tíminn rennur út er þráðurinn stöðvaður, skilaboð birtast og engu er breytt. Áður en skref breytir
gagnasafni er mynstrið prófað á sama hátt á öllum gildum dálksins. Gerðu þá mynstrið einfaldara: forðastu hreiðraðar
endurtekningar eins og `(a+)+` og `(\w*)*`, og hafðu mynstrið eins nákvæmt og hægt er, til dæmis `[^,]*` í stað `.*`.

Forskoðunin sýnir 500 algengustu ólíku gildin. Fjöldi samsvarana er talinn nákvæmlega þegar dálkurinn hefur í mesta
lagi 20.000 ólík gildi, annars á 20.000 algengustu, og þá stendur það undir mynsturreitnum.

## Takmarkanir

- Útskipting virkar á textadálka; breyttu fyrst gerðinni í texta fyrir aðra dálka.
- Uppskrift sem er keyrð á öðru gagnasafni prófar mynstrið á gildum þess gagnasafns áður en hún keyrir.
- Útflutningur í R notar stringr. Óvenjuleg málskipan, eins og að horfa aftur á bak með ótakmarkaðri lengd, getur
  gefið aðra niðurstöðu í R.
