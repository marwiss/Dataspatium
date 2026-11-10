# Muokkaa ja SQL-konsoli

Muokkaa-tila on kaikki, mitä taulukolle tehdään painikkeilla ja valintaikkunoilla: solujen korjaaminen, tekstin
puhdistaminen, tyyppien muuttaminen, uusien sarakkeiden laskeminen, pivotointi ja aineistojen yhdistäminen. Jokainen toiminto
kirjataan vaiheeksi aineiston reseptiin, sen voi kumota ja sen voi ajaa uudelleen toiselle aineistolle. Analysoi-tilan
SQL-konsoli käsittelee samaa aineistoa ja kirjaa muutokset samalla tavalla.

## Taulukko

- Kaksoisnapsauta solua tai valitse rivi ja paina Enter tai F2 muokataksesi. Enter tallentaa, Esc peruuttaa, Sarkain siirtyy
  seuraavaan soluun. Arvo tulkitaan sarakkeen tyypin mukaan: jos kirjoitat tekstiä numerosarakkeeseen, saat virheilmoituksen
  ja solu säilyttää arvonsa. Tyhjä teksti on puuttuva arvo.
- Nuolinäppäimet siirtävät valintaa, Page Up/Page Down selaavat sivuittain, Home/End siirtyvät ensimmäiselle tai viimeiselle
  riville.
- Napsauta sarakeotsikkoa lajitellaksesi (nouseva, laskeva, lajittelematon). Oikeanpuoleinen ominaisuuspaneeli näyttää
  silloin saraketilastot (lukumäärä, puuttuvat, erilliset, pienin, suurin, keskiarvo, summa, yleisimmät arvot) ja sarakkeen
  tyyppiin sopivat toiminnot. Vaihto-napsautus näyttää tilastot muuttamatta lajittelua.
- Suodatinkenttä hakee kaikista sarakkeista. Muokkaus toimii myös suodatetussa valinnassa.
- Työkalurivin *Lista* (näkyy, kun aineistolla on Hae-tilassa tallennettuja hakuja) rajaa taulukon listan
  riveihin; merkki näyttää määrän kokonaismäärästä. Muokkaus ja toiminnot toimivat tavalliseen tapaan.
- Taulukko on virtualisoitu: vain näkyvät rivit ovat selaimen DOM:ssa, loput SQLitessä. Miljoonaa riviä selaa yhtä nopeasti
  kuin sataa.

**Näkymän tarvitsemat sarakkeet.** Graafi tarvitsee solmun tunnisteen, kartta geometrian ja galleria tiedostonimet. Taulukkoa voi muuttaa vapaasti, mutta sovellus kysyy ensin, jos olet poistamassa, nimeämässä uudelleen tai muuttamassa tällaisen sarakkeen tyyppiä. Jos vaihe, jota ei voi ennakoida, kuten SQL tai pivotointi, poistaa sen, näkyy viesti, jossa on Kumoa.

## Toiminnot

**Toiminnot**-painike avaa paletin. Jokaisella toiminnolla on valintaikkuna, jonka kentät muodostetaan toiminnon
parametreista, ja mahdollisuuksien mukaan esikatselu näyttää, montaako riviä toiminto koskee, sekä esimerkit ennen ja jälkeen.

| Ryhmä | Toiminto | Mitä se tekee |
|---|---|---|
| Sarakkeet | Nimeä sarake uudelleen | Uusi sarakkeen nimi; selite seuraa mukana, jos se oli sama kuin nimi |
| | Selite, kuvaus ja yksikkö | Selite on näyttönimi taulukon otsikoissa ja kaavioissa; kuvaus ja yksikkö näytetään tarkastelupaneelissa ja koodikirjassa, kulkevat SQLite-tiedoston mukana ja välittyvät R:lle attribuutteina `description` ja `unit` |
| | Arvoselitteet | Nimet sarakkeen koodeille, yksi riviä kohden `koodi = selite` (esimerkiksi `1 = Mies`); arvot eivät muutu. Selitteet näytetään ominaisuuspaneelissa (myös yleisimpien arvojen vieressä) ja koodikirjassa, ne välittyvät R:lle `haven::labelled`-muodossa ja kirjoitetaan .sav- ja .dta-tiedostoihin. Tyhjä teksti poistaa ne |
| | Poista sarakkeita | Poistaa valitut sarakkeet |
| | Järjestä sarakkeet uudelleen | Siirrä sarakkeita ylös ja alas |
| | Vaihda tyyppi | Teksti kokonaisluvuksi, desimaaliluvuksi, päivämääräksi, päivämääräksi ja ajaksi tai kyllä/ei-arvoksi. Desimaalierottimen ja päivämäärämuodon voi antaa; arvot, joita ei voi tulkita, muuttuvat tyhjiksi, ja niiden määrä ilmoitetaan |
| | Kopioi sarake | Kopio uudella nimellä, esimerkiksi ennen kuin alkuperäistä muutetaan |
| | Siisti sarakkeiden nimet | Kaikista nimistä tulee pieniä kirjaimia, numeroita ja alaviivoja (`Folkmängd 2024` muuttuu muotoon `folkmangd_2024`), joita on helppo kirjoittaa SQL:ssä ja R:ssä; selitteet säilyttävät alkuperäiset nimet |
| Arvot | Etsi ja korvaa | Teksti tai säännöllinen lauseke valituissa tekstisarakkeissa, esikatselun kera |
| | Poista välilyönnit | Alussa ja lopussa olevat sekä (valinnaisesti) kaksoisvälilyönnit |
| | Vaihda kirjainkoko | SUURAAKKOSET, pienaakkoset tai Isot Alkukirjaimet |
| | Korjaa merkistökoodaus | Korjaa mojibaken (Ã¶ muuttuu ö:ksi), joka on syntynyt tuonnissa väärällä koodauksella |
| | Korvaa arvo | Yksi tarkka arvo toisella; tyhjän arvon voi valita lähtö- tai kohdearvoksi |
| | Koodaa arvot uudelleen | Useita arvoja kerralla luettelon mukaan, yksi rivi arvoa kohden, `vanha = uusi` (esimerkiksi `01 = Stockholms län`); muut arvot säilytetään tai tyhjennetään |
| | Vaihda koodit selitteisiin | Vaihtaa sarakkeen koodit niiden arvoselitteisiin tai takaisin. Selitteet säilytetään, joten .sav- ja .dta-tiedostot saavat koodit takaisin viennissä; arvot, joilla ei ole selitettä, jäävät ennalleen, ja koodeiksi palautettaessa sarakkeesta tulee luku, jos kaikki koodit ovat lukuja |
| | Täytä puuttuvat arvot | Vakioarvo, edellisen tai seuraavan rivin arvo, keskiarvo, mediaani tai yleisin arvo |
| | Pyöristä luvut | Valittuun desimaalimäärään: lähimpään (puolikas pyöristetään poispäin nollasta), alaspäin, ylöspäin tai katkaisemalla desimaalit; negatiivinen määrä pyöristää kymmeniin (−1), satoihin (−2) ja niin edelleen |
| | Täydennä etunollilla | Tiettyyn pituuteen, esimerkiksi kuntakoodi 114 muotoon 0114; luvuista tulee tekstiä, jotta nollat säilyvät |
| | Poista merkkejä | Säilytä vain numerot (puhelinnumerot ja Y-tunnukset), säilytä vain kirjaimet ja välilyönnit, poista välimerkit ja symbolit tai poista kaikki välilyönnit |
| Rivit | Poista rivejä | SQL-ehto, esimerkiksi `befolkning < 1000`; valitse Säilytä, jos haluat sen sijaan säilyttää vain vastaavat rivit |
| | Poista kaksoiskappaleet | Valittujen sarakkeiden tai koko rivin perusteella; ensimmäinen esiintymä säilytetään |
| | Poista tyhjät rivit ja sarakkeet | Rivit, joilta kaikki arvot puuttuvat, ja halutessasi sarakkeet, joissa ei ole yhtään arvoa |
| | Lajittele rivit | Muuttaa rivien järjestyksen pysyvästi, nousevasti tai laskevasti yhden sarakkeen mukaan, jotta viennit ja asiakirjat saavat saman järjestyksen; tyhjät arvot tulevat viimeisiksi |
| | Säilytä ylimmät rivit | Rivit, joilla on suurin tai pienin arvo, kaikkiaan tai ryhmittäin (esimerkiksi kunkin maakunnan kolme suurinta kuntaa) |
| | Satunnaisotos | Rivien määrä tai prosenttiosuus; sama siemenluku antaa aina saman otoksen, joten resepti voidaan toistaa |
| Rakenne | Uusi laskettu sarake | SQL-lauseke, esimerkiksi `round(befolkning / 1000.0, 1)` tai `case when andel > 5 then 'stor' else 'liten' end` |
| | Yhdistä sarakkeita | Useita sarakkeita yhdeksi tekstisarakkeeksi erottimella |
| | Jaa sarake | Yksi tekstisarake useaksi erottimen kohdalta |
| | Poimi osa tekstistä | Uusi sarake, jossa on tietty määrä merkkejä tekstin alusta tai lopusta laskettuna valitusta kohdasta (Ruotsin läänikoodi on kuntakoodin kaksi ensimmäistä merkkiä) |
| | Pivotoi pitkään muotoon | Valituista sarakkeista tulee rivejä, joissa on nimi ja arvo |
| | Pivotoi leveään muotoon | Nimisarakkeen arvoista tulee uusia sarakkeita |
| | SQL-lause | Mikä tahansa UPDATE, DELETE tai ALTER TABLE taulua `data` vastaan |
| Laskelmat | Osuus summasta | Kunkin arvon osuus summasta prosentteina tai suhdelukuna, kaikkiaan tai ryhmittäin (kunnan osuus maakunnan väestöstä) |
| | Järjestä sijoille | Sija järjestyksessä, suurin tai pienin ensin, kaikkiaan tai ryhmittäin; yhtä suuret arvot saavat saman sijan (aukolla tai ilman) tai juoksevan sijan |
| | Kumulatiivinen summa | Kertyvä summa toisen sarakkeen osoittamassa järjestyksessä, kaikkiaan tai ryhmittäin |
| | Muutos edellisestä | Erotus tai prosenttimuutos edelliseen riviin toisen sarakkeen osoittamassa järjestyksessä, esimerkiksi edelliseen vuoteen kunnittain |
| | Luokittele | Luvut luokkiin omilla alarajoilla (`0, 18, 65` antaa `0–17`, `18–64` ja `65–`), tietty määrä yhtä leveitä luokkia tai ryhmiä, joissa on yhtä monta riviä (kvantiilit) |
| | Standardoi | z-arvot (etäisyys keskiarvosta keskihajontoina, otoksen keskihajonta) tai arvot skaalattuna välille 0–1 |
| | Poimi päivämäärän osa | Vuosi, neljännes, kuukausi, ISO-viikko, viikonpäivä (1 = maanantai), päivä, vuoden päivä, vuosi ja kuukausi (`2024-03`) tai tunti päivämäärästä |
| | Aika päivämäärien välillä | Kokonaisten päivien, viikkojen, kuukausien tai vuosien määrä kahden päivämäärän välillä, esimerkiksi ikä; ilman loppupäivää lasketaan siihen päivään, jona vaihe ajetaan |
| Säännölliset lausekkeet | Suodata kuviolla | Säilyttää tai poistaa rivejä sen mukaan, vastaako sarake säännöllistä lauseketta |
| | Poimi kuviolla | Uudet sarakkeet kuvion ryhmistä tai koko osumasta, esimerkiksi vuosiluku tekstistä |
| | Merkitse osumat | Kyllä/ei-sarake, joka näyttää, vastaako arvo kuviota |
| | Laske osumat | Sarake, jossa on osumien määrä kussakin arvossa |
| | Jaa kuviolla | Jakaa sarakkeen useaksi kohdista, joissa kuvio vastaa; viimeinen osa saa loput tekstistä |
| Uudet aineistot | Ryhmittele ja koosta | Summa, keskiarvo, pienin, suurin, lukumäärä, erillisten lukumäärä tai mediaani ryhmittäin uuteen aineistoon |
| | Yhdistä aineistoja | Vasen liitos tai sisäliitos toiseen aineistoon avaimen perusteella |
| | Liitä aineistoja | Pinoaa rivit useista aineistoista; sarakkeet yhdistetään nimen perusteella |
| | Puhdista luokat | Etsii saman arvon kirjoitusmuunnelmat (kirjainkoko, välilyönnit, tarkkeet) ja yhdistää ne |

Uuden aineiston luovat toiminnot jättävät alkuperäisen ennalleen ja valitsevat uuden aineiston, kun se on valmis.
Laskelmat lisäävät uuden sarakkeen ja jättävät olemassa olevat ennalleen; ne perustuvat SQL:n ikkunafunktioihin, ja
ne viedään R:ään dplyr-koodina, jossa on `group_by()` ja `mutate()`.
Säännöllisiä lausekkeita käyttäviä toimintoja on helpointa kokeilla Analysoi-tilan Regex-välilehdellä, jossa
osumat näkyvät kuviota kirjoitettaessa; siellä ovat myös kuviokirjasto ja kuvioprofiili (ks. [regex.md](regex.md)).
Sama JavaScript-syntaksi pätee toiminnossa *Etsi ja korvaa*, jossa kuvion alkuun kirjoitettu `(?i)` tai valinta
*Älä huomioi kirjainkokoa* tekee hausta kirjainkoosta riippumattoman.

## Kumoa

**Kumoa**-painike peruu viimeisimmän vaiheen, enintään kymmenen vaihetta taaksepäin saman istunnon aikana. Solumuokkaukset
kumotaan kirjoittamalla vanha arvo takaisin; muut toiminnot palauttamalla aineiston tilannekuva. Hyvin suurilla aineistoilla
tilannekuva kestää hetken, ja muistissa pidetään enintään 80 Mt tilannekuvia. Kumoaminen sivun uudelleenlatauksen jälkeen
tehdään versioilla.

## Datan laatu

**Datan laatu** -painike profiloi aineiston: rivien ja kaksoiskappaleiden määrä sekä sarakkeittain puuttuvat arvot, erilliset
arvot, vaihteluväli ja havainnot. Havainnot osoittavat toimintoon, joka korjaa ne yhdellä napsautuksella:

- välilyönnit alussa tai lopussa, kaksoisvälilyönnit: Poista välilyönnit
- tyhjät tekstit, jotka eivät ole puuttuvia arvoja: Korvaa arvo (tyhjä puuttuvaksi)
- tekstinä tallennetut luvut tai päivämäärät: Vaihda tyyppi
- todennäköinen merkistövirhe: Korjaa merkistökoodaus
- arvot, jotka eroavat vain kirjainkoossa: Vaihda kirjainkoko
- henkilötunnuksilta näyttävät arvot: Pseudonymisoi
- sarake, jonka kaikilla riveillä on sama arvo (tiedoksi)

## Säännöt

**Säännöt**-painike avaa aineiston laatusäännöt: mitä on pädettävä, jotta data on oikein. Sääntötyypit ovat:

| Sääntötyyppi | Rikkoo |
|---|---|
| Ei saa puuttua | Puuttuvat arvot |
| Yksilöllinen | Arvot (tai useamman sarakkeen yhdistelmät), jotka esiintyvät useammin kuin kerran |
| Välillä | Luvut, päivämäärät tai teksti rajojen ulkopuolella |
| Luettelossa | Arvot, joita ei ole luettelossa |
| Ei kiellettyjä arvoja | Arvot, jotka ovat luettelossa, esimerkiksi `tuntematon` tai `-99` |
| Vastaa kuviota | Teksti, joka ei vastaa säännöllistä lauseketta |
| Tietty muoto | Teksti, joka ei ole sähköpostiosoite, verkko-osoite, ISO-päivämäärä, postinumero (ruotsalainen, tanskalainen, norjalainen, suomalainen tai islantilainen) tai Ruotsin kunta- tai läänikoodi |
| Tekstin pituus | Teksti, joka on rajoja lyhyempi tai pidempi |
| Ei ylimääräisiä välilyöntejä | Teksti, jonka alussa tai lopussa on välilyöntejä tai jossa on kaksoisvälilyöntejä |
| Voidaan tulkita tyypiksi | Teksti, jota ei voi tulkita kokonaisluvuksi, desimaaliluvuksi, päivämääräksi, päivämääräksi ja ajaksi tai kyllä/ei-arvoksi |
| Kelvollinen tunnus | Numerot, joiden muoto on väärä, päivämäärä virheellinen tai tarkiste väärä, ks. alla |
| Vertaa kahta saraketta | Rivit, joilla kahden sarakkeen välinen ehto ei päde, esimerkiksi että alkupäivä on pienempi tai yhtä suuri kuin loppupäivä |
| Löytyy toisesta aineistosta | Arvot, jotka puuttuvat toisen aineiston sarakkeesta (viite-eheys, kuten vierasavain) |
| Täytettyjen arvojen osuus | Sarake kokonaisuutena, kun täytettyjen arvojen osuus on kynnysarvoa pienempi (esimerkiksi 95 %) |
| Ei poikkeavia arvoja | Luvut, jotka ovat kvartiileista kauempana kuin valittu määrä kvartiilivälejä (oletus 1,5) tai keskiarvosta kauempana kuin valittu määrä keskihajontoja (oletus 3) |
| SQL-ehto | Rivit, joilla vapaa SQL-ehto ei ole tosi |

Tunnukset tarkistetaan näin: ruotsalainen henkilötunnus ja samordningsnummer (10 tai 12 numeroa, kelvollinen
päivämäärä, päivä plus 60 samordningsnummerissa, tarkiste Luhnin mukaan), ruotsalainen organisaationumero (kolmas
numero vähintään 2, Luhn), norjalainen fødselsnummer ja D-numero (molemmat tarkisteet modulo 11), tanskalainen
CPR-numero (kelvollinen päivämäärä; modulo 11 -tarkistetta ei tarkisteta, koska se ei ole koskenut kaikkia numeroita
vuodesta 2007), suomalainen henkilötunnus (välimerkki ja tarkistusmerkki) ja islantilainen kennitala (tarkiste modulo
11, kelvollinen päivämäärä, vuosisatanumero). Tarkistus kertoo vain, että numero voi olla olemassa, ei että se
kuuluu jollekulle.

**Ehdota sääntöjä** lisää sääntöjä datan laatuprofiilista: sarakkeet ilman puuttuvia arvoja, yksilölliset sarakkeet
ja kiinteän pituiset koodit. Sarakkeet, joiden nimessä on henkilötunnus, hetu, personnummer, CPR, fødselsnummer tai
kennitala, saavat säännön sille tunnuslajille, jonka vähintään puolet arvoista läpäisee; sarakkeet, joiden nimessä
on postinumero, saavat säännön sille postinumeromuodolle, jota useimmat arvot noudattavat; ja sarakkeet, joiden
nimessä on sähköposti tai e-mail, saavat säännön sähköpostiosoitteille.

**Aja säännöt** laskee kutakin sääntöä rikkovat rivit, näyttää osuuden ja muutaman esimerkin ja kirjaa ajon aineiston
historiaan. Rikotun säännön rikkovat rivit voi tallentaa omaksi aineistokseen, ja koko tuloksen voi ladata HTML-raporttina.
Säännöt tallennetaan aineiston metatietoihin, joten ne kulkevat mukana varmuuskopioissa, paketeissa ja siirrettävässä
kansiossa.

## Pseudonymisoi

Toiminto **Pseudonymisoi** (ryhmä Arvot, myös sarakevalikossa ja komentopaletissa) korvaa tunnisteet, kuten henkilötunnukset
tai asiakasnumerot, ennen jakamista. Menetelmiä on kolme:

- **Tiiviste**: SHA-256 suolasta ja arvosta, lyhennettynä haluttuun pituuteen (oletus 16 merkkiä). Sama arvo antaa saman
  tiivisteen, joten taulujen väliset liitokset säilyvät, jos käytetään samaa suolaa. Suola on valitsemasi salainen teksti; sitä
  ei koskaan tallenneta lokiin tai reseptiin (siellä lukee `***`), eikä reseptiä, jossa on tällainen vaihe, voi ajaa ilman,
  että suola annetaan uudelleen.
- **Peitä merkit**: säilyttää halutun määrän merkkejä alusta ja lopusta sekä erottimet ja korvaa loput merkillä `*`
  (`19800101-1234` muuttuu muotoon `198001**-****`, kun alusta säilytetään kuusi merkkiä).
- **Juokseva numero**: jokainen erillinen arvo saa etuliitteellisen juoksevan numeron lajittelujärjestyksessä (`P0001`,
  `P0002`).

Suolattu tiivistäminen on pseudonymisointia, ei anonymisointia: suolan tunteva voi kokeilla ehdokkaita, ja muiden sarakkeiden
yhdistelmät voivat yhä yksilöidä henkilöitä. Poista tai karkeista muut arkaluonteiset sarakkeet äläkä koskaan jaa suolaa
datan kanssa. Reseptin SQL-vienti käyttää Dataspatiumin funktioita `dm_hash` ja `dm_mask`; R-vienti käyttää tiivisteisiin
pakettia digest.

## Paikkatieto

Toimintoryhmä *Paikkatieto* käsittelee geometriasarakkeita (GeoJSON tai WKT tekstinä, pituus/leveysasteina tai SWEREF 99 TM
-koordinaatteina) ja koordinaattisarakkeita:

- **Keskipiste geometriasta** lisää pituus- ja leveysasteen (WGS 84) kunkin alueen tai viivan keskipisteelle, esimerkiksi
  kuntien piirtämiseksi kuplina pistekartalle.
- **Pinta-ala geometriasta** lisää pinta-alan neliökilometreinä (tasossa SWEREF 99 TM:lle, maapallon pinnalla
  pituus/leveysasteille; reiät vähennetään).
- **Muunna koordinaatit** muuntaa kaksi saraketta SWEREF 99 TM:n (itä, pohjoinen) ja WGS 84:n (pituus, leveys) välillä uusiksi
  sarakkeiksi Lantmäterietin kaavoilla.
- **Kunta ja lääni koordinaateista** hakee, missä Ruotsin kunnassa ja läänissä kukin piste sijaitsee, SCB:n mukana tulevien
  rajojen avulla ja lisää sarakkeet `kommunkod`, `kommun`, `lanskod` ja `lan` (tai vain läänin). SWEREF 99 TM -koordinaatit
  tunnistetaan. Rajat ovat SCB:n yksinkertaistettuja maarajoja teemakarttoja varten: järvissä, meressä tai Ruotsin
  ulkopuolella olevat pisteet jäävät tyhjiksi, ja hyvin lähellä rajaa olevat pisteet voivat osua naapurikuntaan.
- **Korkeus maastomallista** lisää jokaisen pisteen korkeuden metreinä (RH 2000) Lantmäterietin maastomallista lähteen
  *Lantmäteriet paikkatiedot avaimella (STAC)* avaimella. Koordinaatit voivat olla WGS 84- tai SWEREF 99 TM
  -järjestelmässä; enintään 5 000 pistettä kerrallaan, ja mallin ulkopuolinen piste ei saa korkeutta.
- **Korkeudet geometrian varrella** lisää alimman, ylimmän ja keskimääräisen korkeuden jokaisen viivan ja monikulmion
  reunan varrelta, oletuksena piste kymmenen metrin välein (enintään 200 geometriaa kohden), sarakkeisiin `hojd_min`,
  `hojd_max` ja `hojd_medel`.

Kaikki neljä ovat reseptin vaiheita, jotka voi kumota ja ajaa uudelleen. SQL-viennissä ne näkyvät Dataspatiumin funktioiden
kutsuina (`dm_geo_lon`, `dm_geo_area`, `dm_to_lon`, `dm_region` ja muut); R-vienti tuottaa vastaavan koodin paketilla sf.

## Versiot

**Versiot**-painike (myös Hallitse-tilassa) tallentaa aineistosta tilannekuvan kuvauksen kera. Versiota voi verrata nykytilaan
(rivien määrä, lisätyt, poistetut ja tyyppiä vaihtaneet sarakkeet), sen voi palauttaa tai poistaa. Versiot tallennetaan
selaimen tietokantaan, ja ne kulkevat mukana työtilan varmuuskopiossa. Tallenna versio ennen suurempia muutoksia.

## Resepti

**Resepti**-painike näyttää kaikki aineistolle tehdyt vaiheet järjestyksessä. Täältä voit:

- kopioida reseptin R-koodina (`dm_read()` lyhytnimellä, dplyr/tidyr/stringr-kutsut, `dm_write()`) tai SQL:nä taulua `data`
  vastaan,
- ladata reseptin JSON-tiedostona jaettavaksi,
- ajaa samat vaiheet toiselle työtilan aineistolle,
- ajaa reseptin JSON-tiedostosta valitulle aineistolle.

Ajo pysähtyy ensimmäiseen epäonnistuvaan vaiheeseen (esimerkiksi sarakkeeseen, jota ei ole) ja kertoo, montako vaihetta
suoritettiin. Reseptitiedosto on muotoa

```json
{ "app": "Dataspatium", "kind": "recipe", "version": "0.3.0", "name": "Kuntien puhdistus",
  "steps": [ { "op": "trim", "params": { "columns": ["kommun"], "squish": true }, "description": "Poista välilyönnit sarakkeesta kommun" } ] }
```

## Koodivaiheet

Paletin ryhmässä **Koodi** on kaksi toimintoa, jotka suorittavat funktion koko taulukolle: **Python-vaihe**
(`def step(df):` pandasilla, ks. [python.md](python.md)) ja **R-vaihe** (`function(df) { ... }`, ks.
[r-guide.md](r-guide.md)). Funktion palauttama taulukko korvaa vanhan tyyppeineen; selitteet ja yksiköt seuraavat
sarakkeita, jotka säilyttävät nimensä. *Esikatsele* suorittaa funktion ensimmäisille 200 riville ja näyttää sarakkeet
ja muutaman rivin. Vaihe kirjataan reseptiin koodeineen, sen voi kumota ja toistaa muille aineistoille; SQL-viennissä
koodi on kommenttina, R-viennissä R-vaihe suoritetaan koodina ja Python-vaihe on kommenttina. Python haetaan
ensimmäisellä kerralla.

## Asiakirjat, kuvat ja kartat

Asiakirja- ja kuvakokoelmat avautuvat Muokkaa-tilassa omassa näkymässään (lukunäkymä tai galleria), ja aineistot,
joissa on geometria tai koordinaatit, karttana, jota voi lähentää ja panoroida; painike *Näytä taulukkona* antaa
tavallisen taulukon. Kaikki tämän tilan toiminnot koskevat taulukkoa: kappaleiden tai kohteiden suodatus, tekstin
korjaus, rivien poisto, laskettujen sarakkeiden lisäys. Katso [dokument.md](dokument.md) ja [kartor.md](kartor.md).

## SQL-konsoli

Jokaisella aineistolla on **lyhytnimi** (näkyy nimen alla kohdepaneelissa ja Hallitse-tilassa, jossa sen voi muuttaa nimen
kanssa): pienet kirjaimet a–z, numerot ja alaviiva, enintään 20 merkkiä ja mieluiten enintään 15, ei koskaan SQL:n tai R:n
varattu sana. Ehdotus muodostetaan nimestä ilman pikkusanoja, ja vuosiluku tulee jälkiliitteeksi: *Väestö kunnittain 2024*
muuttuu muotoon `vaesto_2024`. Mukana tulevan esimerkkidatan lyhytnimet ovat kiinteät
(`befolkning_2024`, `kommungranser`, `lansgranser`) kaikilla kielillä. SQL-konsolissa valitun aineiston nimi on `data`, mutta
siihen pääsee myös lyhytnimellä, ja muihin aineistoihin viitataan niiden lyhytnimillä, joten yksi kysely voi yhdistää useita
aineistoja:

```sql
select k.kommun, k.lan, b.folkmangd
from befolkning_2024 b
join kommungranser k on k.kommunkod = b.kommunkod
order by b.folkmangd desc
```

Muut aineistot ovat kyselyssä vain luku -tilassa; UPDATE, DELETE ja ALTER koskevat valittua aineistoa, mutta ne saavat lukea
muita (esimerkiksi `update data set lan = (select lan from kommungranser k where k.kommunkod = data.kommunkod)`). Samassa
kyselyssä voi olla enintään yhdeksän muuta aineistoa. Tuloksen voi tallentaa uutena aineistona. Lyhytnimet toimivat myös
R:ssä (`dm_read("lyhytnimi")`; painike *Lisää dm_read()*, R-esimerkit, uudet muistikirjat ja reseptien R-vienti käyttävät
lyhytnimeä), ja niitä käytetään, kun kaaviot ja muistikirjat yhdistetään aineistoihin tuonnissa.

SQL-konsoli on Analysoi-tilan SQL-välilehdellä, ja se käsittelee valittua aineistoa, jonka taulun nimi on `data`. Ctrl+Enter
suorittaa koko skriptin, valittu teksti suoritetaan erikseen.

- `SELECT`, `WITH`, `VALUES`, `PRAGMA` ja `EXPLAIN` näyttävät tuloksen taulukossa (ensimmäiset 5 000 riviä). **Tallenna tulos
  aineistona** luo uuden aineiston koko tuloksesta ilman rivirajaa.
- `UPDATE`, `DELETE`, `ALTER TABLE` ja muut lauseet muuttavat aineistoa, kirjataan reseptin vaiheeksi SQL-lause ja ne voi
  kumota Muokkaa-tilassa.
- Ominaisuuspaneeli luettelee aineiston sarakkeet (napsautus lisää nimen), kaikkien aineistojen lyhytnimet ja Dataspatiumin
  lisäämät SQL-funktiot: `regexp`, `regexp_replace`, `dm_parse_number`, `dm_parse_date`, `dm_fix_encoding`, `dm_upper`,
  `dm_lower`, `dm_title`, `dm_squish`, `dm_round`, `dm_pad`, `dm_date_part`, `dm_date_diff` ja
  `dm_valid_id` (esimerkiksi `select * from data where dm_valid_id(hetu, 'fi_hetu') = 0`) sekä regex-funktiot
  `dm_regex_test`, `dm_regex_extract`, `dm_regex_all`, `dm_regex_count`, `dm_regex_split` ja `dm_shape`, jotka
  kuvataan ohjeessa [regex.md](regex.md).
- SQL-skriptit tallennetaan kohdepaneeliin samoin kuin R-skriptit.

SQLiten murre on voimassa: `||` tekstin yhdistämiseen, `cast(x as integer)`, `strftime()` päivämääriin, `group_concat()`,
ikkunafunktiot kuten `row_number() over (partition by …)`.

## Rajoitukset

- Kumoaminen toimii istunnon sisällä; käytä versioita palataksesi sivun uudelleenlatauksen jälkeen.
- Sarakkeen uudelleen rakentavat toiminnot (Vaihda tyyppi, Jaa sarake, pivotointi) vievät aineiston ensin kumoamista varten.
  Yli muutaman sadan megatavun aineistoissa se kestää huomattavasti.
- Reseptien R-vienti kattaa sisäänrakennetut toiminnot; vapaa SQL viedään kommenttina, koska sitä ei voi kääntää R:ksi
  automaattisesti.

## Aineiston lajin mukaan

- **Kommentit siihen, mitä katsot.** Tarkastelijassa voit kommentoida sivua, kuvaa, solmua, elementtiä, kaavakohdetta tai paikkaa kartalla. Hallitse-tilan kohdassa Kommentit näet ne kaikki, ja *Näytä* vie takaisin siihen, mitä kommentti koskee.
- **Kuvat.** Asetat tunnisteita, joilla voi hakea, ja paikan, joka tuo kuvan kartalle.
- **Asiakirjat.** Valitse kappale korjataksesi sen tekstin. Korjaus koskee aineiston tekstiä, eikä alkuperäinen tiedosto muutu. Asiakirjalla voi olla tunnisteita, ja *Peitä henkilötiedot* piilottaa tekstistä sen, mikä näyttää henkilötiedoilta. Alkuperäinen tiedosto sisältää ne yhä, joten poista se kopiosta, kun jaat.
- **Kartat.** *Korjaa geometriat* poistaa toistuvat pisteet ja sulkee alueet. Arvot, joita ei voi lukea muotona, tyhjennetään. *Koordinaatit muusta koordinaatistosta* lisää sarakkeet asteina. Toisesta tilasta tehty valinta merkitään kartalle.
- **Graafit.** *Etsi kaksoiskappaleet* näyttää solmut, joilla on sama tunniste ja nimi, kun kirjainkokoa, aksentteja ja välimerkkejä ei lasketa. Valitset itse, mitkä yhdistetään.
- **Mallit.** *Luokittele* asettaa luokituksen näkyville elementeille, esimerkiksi kaikille yhden kerroksen yhden tyypin elementeille.
- **Kaavat.** *Muuta tilaa* pitää kirjaa tilasta, päivämäärästä ja muistiinpanosta.
- **Taulukot.** Rivi, joka nimeää kuvia, näyttää ne tarkastelijassa.

Tietoihin tehdyt muutokset voi perua.
