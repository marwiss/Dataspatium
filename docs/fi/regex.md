# Säännölliset lausekkeet (Regex)

Säännöllinen lauseke on kuvio, joka kuvaa tekstiä: `^\d{5}$` kuvaa suomalaista postinumeroa, `\(([^)]*)\)`
sulkeissa olevaa tekstiä. Dataspatiumissa kuvioilla analysoidaan, korjataan ja jaetaan aineistojen arvoja.
Analysoi-tilan **Regex**-välilehdellä kuvioita kokeillaan sarakkeeseen ja tulos näkyy heti. Samat kuviot toimivat
myös Muokkaa-tilassa (toimintoryhmä *Säännölliset lausekkeet*, *Etsi ja korvaa*), laatusäännössä *Vastaa kuviota*
ja SQL-konsolissa.

## Mikä standardi?

Dataspatium käyttää JavaScriptin säännöllisiä lausekkeita ECMAScript-standardin (ECMA-262) mukaisesti, Unicode-lippu
päällä. Perustelut:

- Ne ovat selaimessa valmiina, joten erillistä kirjastoa ei tarvita ja kaikki toimii `file://`-osoitteesta.
- Sama moottori on käytössä kaikkialla sovelluksessa: Regex-välilehdellä, SQLite-moottorin SQL-funktioissa,
  säännöissä ja toiminnossa Etsi ja korvaa. Kuvio, joka toimii yhdessä paikassa, toimii kaikissa.
- Niissä on se, mitä data vaatii: nimetyt ryhmät `(?<nimi>…)`, katse eteen ja taakse (`(?=…)`, `(?<=…)`),
  Unicode-luokat kuten `\p{L}` (kaikki kirjaimet, myös å, ä, ö, æ, ø, þ ja ð) ja liput kirjainkoolle.
- Syntaksi on hyvin dokumentoitu (esimerkiksi MDN:ssä) ja hyvin lähellä R-paketin stringr (ICU) ja PCRE:n
  syntaksia, joten kuvioita voi siirtää Dataspatiumin, R:n ja useimpien muiden työkalujen välillä.

Muut verratut standardit: POSIX ERE (R:n oletusmoottori TRE) ei tue katsetta eteen ja taakse eikä Unicode-luokkia.
PCRE (R ja `perl = TRUE`) ja ICU (stringr) ovat JavaScriptin lähisukulaisia. RE2 takaa, ettei kuvio voi koskaan
jumittua, mutta sitä ei ole selaimessa, eikä siinä ole takaisinviittauksia eikä katsetta eteen ja taakse.
JavaScriptin riski, että jotkin kuviot voivat kestää hyvin kauan, hoidetaan sen sijaan aikarajalla (ks. *Turvallisuus
ja suorituskyky*).

Dataspatiumin säännöt standardin lisäksi:

- Unicode-lippu lisätään, kun kuvio sen sallii. Vanhempi kuvio, joka on kelvollinen vain ilman sitä, esimerkiksi
  `a\-b`, toimii edelleen, mutta silloin ilman `\p{…}`-luokkia.
- Kuvion alussa olevat `(?i)`, `(?s)` ja `(?m)` muuttuvat lipuiksi, kuten R:ssä, Pythonissa ja PCRE:ssä.
  `(?i)jyväskylä` vastaa tekstiä JYVÄSKYLÄ.
- `\w`, `\d` ja `\b` koskevat vain merkkejä a–z, A–Z, 0–9 ja alaviivaa. Käytä kirjaimille `\p{L}` ja sanarajana
  `(?<!\p{L})` ja `(?!\p{L})` tekstissä, jossa on å, ä ja ö.

## Regex-välilehti

Välilehti on Analysoi-tilassa R:n, SQL:n ja Muistikirjan vieressä, ja sen asettelu on sama kuin muualla
sovelluksessa:

- **Vasemmalla**: aineistot, tallennetut kuviosi ja kuviokirjasto.
- **Keskellä**: sarake, kuvio, liput ja mitä tehdään, sekä esikatselu.
- **Oikealla**: syntaksi lyhyesti ja sama asia SQL- ja R-koodina, jonka voi avata SQL- tai R-välilehdellä.

Näin teet:

1. Valitse aineisto vasemmalta ja sarake kentästä **Sarake**.
2. Kirjoita kuvio kenttään **Kuvio** tai napsauta kirjaston kuviota. Esikatselu näyttää sarakkeen yleisimmät arvot
   (enintään 500 eri arvoa) osumat merkittyinä, ja kentän alla oleva rivi kertoo, montako riviä vastaa kuviota.
3. Valitse tarvittaessa **Älä huomioi kirjainkokoa**, **Koko arvon on vastattava** (kuvion ympärille lisätään
   `^(?:` ja `)$`) ja **Piste vastaa myös rivinvaihtoa**.
4. Valitse kohdasta **Mitä tehdään** ja paina **Käytä**.

| Mitä tehdään | Mitä tapahtuu |
|---|---|
| Testaa ja näytä osumat | Näyttää osumat, niiden määrän arvoittain ja halutessa vain arvot, joissa on tai ei ole osumaa. Mikään ei muutu |
| Kuvioprofiili | Näyttää arvojen muodot: `A` on iso kirjain, `a` muu kirjain ja `9` numero, joten arvon `00100` muoto on `99999`. *Yksinkertaista toistot* kirjoittaa jonon muodossa `9+`. **Käytä** tekee muodosta kuvion. Mikään ei muutu |
| Suodata rivejä | Säilyttää vastaavat rivit tai poistaa ne |
| Poimi uusiin sarakkeisiin | Uusi sarake kuvion jokaisesta ryhmästä tai yksi sarake koko osumalle, jos kuviossa ei ole ryhmiä. Nimetyt ryhmät antavat sarakkeiden nimet; muita nimiä voi antaa. *Kaikki osumat* kokoaa kaikki osumat erottimella |
| Korvaa | Korvaa osumat tekstisarakkeissa. `$1`, `$2` ja `$<nimi>` lisäävät ryhmän, `$&` koko osuman |
| Jaa sarakkeisiin | Jakaa arvon kuvion kohdalta valittuun määrään sarakkeita; viimeinen saa loput tekstistä |
| Merkitse osumat uuteen sarakkeeseen | Kyllä/ei-sarake, joka näyttää, vastaako arvo kuviota |
| Laske osumat uuteen sarakkeeseen | Sarake, jossa on osumien määrä kussakin arvossa |
| Luo laatusääntö | Lisää sarakkeelle säännön *Vastaa kuviota*; se ajetaan Muokkaa-tilassa kohdassa Säännöt |

Aineistoa muuttavasta toiminnosta tulee reseptin vaihe kuten Muokkaa-tilan toiminnoista: sen voi kumota siellä,
toistaa toiselle aineistolle ja viedä SQL:nä (Dataspatiumin funktioilla `dm_regex_*`) ja R-koodina (paketilla
stringr). Samat vaiheet ovat Muokkaa-tilassa kohdassa **Toiminnot** ryhmässä *Säännölliset lausekkeet*.

Arvot, jotka eivät ole tekstiä, kuten luvut ja päivämäärät, kokeillaan tekstimuodossaan (`2.5`, `2024-01-31`).

## Kuviokirjasto

Kirjastossa on valmiita kuvioita kolmessa ryhmässä. *Ruotsi*: henkilötunnus (personnummer), organisaationumero,
postinumero, kuntakoodi, puhelinnumero ja auton rekisterinumero. *Pohjoismaat*: tanskalainen CPR-numero, norjalainen
fødselsnummer, henkilötunnus, islantilainen kennitala ja pohjoismaiset postinumerot. *Yleiset*: sähköpostiosoite,
verkko-osoite tekstissä, päivämäärät muodoissa VVVV-KK-PP ja P.K.VVVV, kellonaika, vuosiluku tekstissä, luku
desimaalipilkulla, summa kruunuina, teksti sulkeissa, sanat, ylimääräiset välilyönnit ja aihetunnisteet.

Kirjaston kuviot tarkistavat muodon, eivät sitä, onko numero kelvollinen. Tunnusten tarkisteet ja päivämäärät
tarkistaa sääntö *Kelvollinen tunnus* Muokkaa-tilassa.

## Tallennetut kuviot

**Tallenna kuvio** tallentaa kuvion ja liput nimellä. Tallennetut kuviot näkyvät vasemmalla ja kulkevat R- ja
SQL-skriptien tavoin mukana varmuuskopiossa, paketeissa (kun *Tallennetut skriptit ja kuviot* on valittu) ja
siirrettävässä kansiossa tiedostoina `scripts/<id>.script.json`.

## Syntaksi lyhyesti

| Kuvio | Tarkoittaa | Esimerkki |
|---|---|---|
| `.` | mikä tahansa merkki | `a.c` vastaa tekstejä abc ja a-c |
| `\d` | numero 0–9 | `\d{4}` vastaa lukua 2024 |
| `\p{L}`, `\p{Lu}`, `\p{Ll}` | kirjain, iso, pieni | `\p{Lu}\p{Ll}+` vastaa sanaa Jyväskylä |
| `\s` | välilyönti, sarkain tai rivinvaihto | `\s{2,}` vastaa kaksoisvälilyöntejä |
| `[abc]`, `[^abc]`, `[a-z]` | yksi merkeistä, ei mikään niistä, väli | `[.,]` vastaa pistettä tai pilkkua |
| `a\|b` | a tai b | `kr\|EUR` |
| `*`, `+`, `?` | nolla tai useampi, yksi tai useampi, nolla tai yksi | `\d+` |
| `{n}`, `{n,m}`, `{n,}` | tasan n, n–m, vähintään n kertaa | `\d{3,4}` |
| `^`, `$` | arvon alku ja loppu | `^\d+$` on pelkkiä numeroita |
| `(…)` | ryhmä, käytetään muodossa `$1` | `(\d{2})(\d{3})` |
| `(?<nimi>…)` | nimetty ryhmä, käytetään muodossa `$<nimi>` | `(?<vuosi>\d{4})` |
| `(?:…)` | ryhmä, jota ei tallenneta | `(?:kr\|EUR)` |
| `(?=…)`, `(?!…)` | jota seuraa, jota ei seuraa | `\d+(?= €)` |
| `(?<=…)`, `(?<!…)` | jota edeltää, jota ei edellä | `(?<=nro )\d+` |
| `\` | tekee erikoismerkistä tavallisen | `\.` on piste, `\(` sulje |

## Esimerkkejä

| Tehtävä | Kuvio | Mitä tehdään |
|---|---|---|
| Vuosiluku tekstistä kuten *Väkiluku 2024* | `(?<vuosi>(?:19\|20)\d{2})` | Poimi; uusi sarake `vuosi` |
| Koodi sulkeissa, *Uusimaa (01)* | `\((\d{2})\)` | Poimi; anna nimeksi `koodi` |
| Ruotsalainen postinumero välilyönnillä | `^(\d{3}) ?(\d{2})$` | Korvaa tekstillä `$1 $2` |
| Sukunimi ja etunimi tekstistä *Berg, Anna* | `, ?` | Jaa kahteen sarakkeeseen |
| Rivit, joiden vapaassa tekstissä on sähköpostiosoite | `[^\s@]+@[^\s@]+\.[^\s@]+` | Merkitse osumat tai Suodata rivejä |
| Sekalaiset päivämäärämuodot | (ei kuviota) | Kuvioprofiili näyttää esimerkiksi `9999-99-99` ja `99.99.9999`; korjaa sitten toiminnolla Vaihda tyyppi Muokkaa-tilassa |
| Puhelinnumerot pelkkinä numeroina | `[^\d+]` | Korvaa tyhjällä (tai toiminnolla Poista merkkejä) |

## SQL:ssä ja R:ssä

SQL-konsolissa ovat samat kuviot Dataspatiumin funktioiden kautta:

| Funktio | Antaa |
|---|---|
| `x regexp 'kuvio'`, `regexp('kuvio', x)` | 1, jos x vastaa kuviota, muuten 0 |
| `regexp_replace(x, 'kuvio', 'korvaus', 'gi')` | x, jossa osumat on korvattu (`g` kaikki, `i` kirjainkoosta riippumatta) |
| `dm_regex_test(x, 'kuvio', 'i')` | 1, 0 tai tyhjä tyhjälle arvolle |
| `dm_regex_extract(x, 'kuvio', ryhmä, '')` | ryhmä (numero tai nimi, 0 koko osumalle) ensimmäisestä osumasta |
| `dm_regex_all(x, 'kuvio', ryhmä, ', ', '')` | ryhmä kaikista osumista erottimella |
| `dm_regex_count(x, 'kuvio', '')` | osumien määrä |
| `dm_regex_split(x, 'kuvio', osa, määrä, '')` | osa numero `osa` kaikkiaan `määrä` osasta, kun x jaetaan kuvion kohdalta |
| `dm_shape(x, 0)` | kuvioprofiilin muoto (1 yksinkertaistaa toistot) |

```sql
select kunta, dm_regex_extract(nimi, '\((\d{2})\)', 1, '') as koodi
from data
where dm_regex_test(postinumero, '^\d{5}$', '') = 0
```

R:ssä käytetään pakettia stringr, jonka syntaksi (ICU) on lähes sama: `stringr::str_detect(df$postinumero,
stringr::regex("^\\d{5}$"))`. Erot, jotka kannattaa tuntea: R:ssä jokainen `\` kirjoitetaan merkkijonon sisällä
kahdesti, korvauksen ryhmä kirjoitetaan `\\1` eikä `$1` (reseptin vienti muuntaa sen puolestasi), ja katseen
taaksepäin on oltava rajatun pituinen. `\d` vastaa ICU:ssa kaikkia Unicode-numeroita mutta JavaScriptissä vain
numeroita 0–9.

## Turvallisuus ja suorituskyky

Jotkin kuviot voivat kestää äärimmäisen kauan joillakin arvoilla, esimerkiksi `(a+)+$` pitkällä a-merkkien jonolla,
jota seuraa jokin muu merkki (*katastrofaalinen paluuhaku*). Siksi kuvioita kokeillaan omassa taustasäikeessään
kahden sekunnin aikarajalla. Kun aika loppuu, säie pysäytetään, näytetään ilmoitus eikä mitään muuteta. Ennen kuin
vaihe muuttaa aineistoa, kuvio kokeillaan samalla tavalla sarakkeen kaikkiin arvoihin. Tee silloin kuviosta
yksinkertaisempi: vältä sisäkkäisiä toistoja kuten `(a+)+` ja `(\w*)*`, ja ole mahdollisimman tarkka, esimerkiksi
`[^,]*` eikä `.*`.

Esikatselu näyttää 500 yleisintä eri arvoa. Osumien määrä lasketaan tarkasti, kun sarakkeessa on enintään 20 000 eri
arvoa, muuten 20 000 yleisimmästä, mikä silloin kerrotaan kuviokentän alla.

## Rajoitukset

- Korvaus toimii tekstisarakkeissa; vaihda muiden sarakkeiden tyypiksi ensin teksti.
- Toiselle aineistolle toistettu resepti kokeilee kuviota kyseisen aineiston arvoihin ennen ajoa.
- R-vienti käyttää stringr-pakettia. Harvinainen syntaksi, kuten rajoittamattoman pituinen katse taaksepäin, voi
  antaa R:ssä eri tuloksen.
