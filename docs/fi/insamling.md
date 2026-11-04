# Keruu maastossa

**Keruu maastossa** -toiminnolla täytät rivejä puhelimessa verkon kanssa tai ilman, valokuvan ja sijainnin kera. Lomake perustuu aineiston
sarakkeisiin ja sääntöihin, joten virheellinen rivi näkyy heti siellä, missä olet. Rivit palaavat sitten tietokoneelle aineiston uutena
versiona. Valokuvista tulee kuvakokoelma, ja sijainnit päätyvät kartalle.

## Näin se toimii

1. Valitse **Nouda**-tilassa *Keruu maastossa* ja sitten aineisto tai *Uusi aineisto*.
2. Päätä, mitä kenttiä puhelin kysyy, ja paina *Lähetä puhelimeen*.
3. Yhdistä puhelin kohdassa **Laitteet** Jaa-tilassa ja lähetä lomake. Puhelin tarvitsee tällä kertaa verkon.
4. Avaa lomake puhelimessa ja kerää rivejä. Nyt verkkoa ei tarvita.
5. Kun olet palannut, paina *Lähetä tietokoneelle* ja skannaa tietokoneen koodi.
6. Tietokone näyttää, mitä on saapunut, ja valitset *Lisää*.

## Lomake

Jokaisesta sarakkeesta tulee kenttä. Voit poistaa sarakkeen käytöstä, muuttaa otsikkoa ja valita, onko kenttä pakollinen. *Säilytä seuraavalle
riville* sopii tietoihin, jotka ovat samoja monella rivillä, kuten päivämäärä tai alue.

Kentän tyyppi tulee sarakkeesta. Arvotunnisteista ja säännöstä *sallitut arvot* tulee itsestään valintalista. Voit myös kirjoittaa valinnat itse,
yhden riviä kohti muodossa `arvo` tai `koodi = teksti`, tai noutaa ne kohdasta *Nouda valinnat sarakkeesta*.

Sijainti ja valokuvat voivat olla pois käytöstä, vapaaehtoisia tai pakollisia. Kuvia pienennetään puhelimessa niin, että pisin sivu on 2048
pikseliä, ellet valitse muuta kohdassa *Lisää asetuksia*.

*Uusi aineisto* ottaa yhden sarakkeen riviä kohti, kuten `paikka` tai `maara: kokonaisluku`.

Ennen kuin lomake lähtee tietokoneelta, sovellus näyttää, mitä lähtee mukaan. Mukana on kenttiä, otsikoita, valintoja ja sääntöjä, ei koskaan rivejä.

## Säännöt

Puhelin tarkistaa säännöt samalla SQLitellä kuin tietokone, joten rivi arvioidaan samoin molemmissa paikoissa.

- **Tarkistetaan puhelimessa:** välit, sallitut ja kielletyt arvot, mallit, muodot, pituus, henkilötunnukset, sarakkeiden väliset vertailut ja
  vapaat SQL-ehdot, jotka käyttävät vain lomakkeen sarakkeita.
- **Yksilölliset arvot** verrataan vain puhelimen riveihin. Tietokone tarkistaa koko aineistoa vasten.
- **Tarkistetaan vain tietokoneella:** täydellisyys, toisen aineiston arvot ja säännöt sarakkeista, jotka eivät ole lomakkeessa.

Lomakkeen virhe, kuten tyhjä pakollinen kenttä tai kirjain lukukentässä, estää rivin tallennuksen. Rikottu sääntö estää sen kerran. Jos painat
Tallenna uudelleen, rivi säilytetään ja sääntö merkitään, koska paikalla oleva voi tietää säännön paremmin.

## Puhelimessa

Lomake on Dataspatium Mobilin aloitussivun yläosassa. *Tallenna ja uusi rivi* on tavallinen tapa jatkaa.

Työn alla oleva rivi tallennetaan luonnoksena ensimmäisestä muutoksesta alkaen, ja kuvat tallennetaan heti, kun ne on otettu. Puhelimet sulkevat joskus
sivun, kun kamera avautuu. Kun palaat, lomake tarjoaa kohdan *Jatka luonnosta*.

Puhelin näyttää *Toimii ilman verkkoa tässä puhelimessa*, kun sillä on kaikki tarvittava. Jos siinä lukee, että sivu on avattava vielä kerran, tee se,
kun verkko on käytössä. Asenna sivu mieluiten aloitusnäytölle. Selaimet voivat muuten tyhjentää käyttämättömien sivujen tallennustilan, ja iPhonessa
se voi tapahtua viikon käyttämättömyyden jälkeen.

Rivit pysyvät puhelimessa, kunnes valitset *Tyhjennä lähetetyt*. Lähetettyä riviä ei voi muuttaa puhelimessa, vain tietokoneella.

Jos sinulla ei ole yhteyttä tietokoneeseen, voit käyttää kohtaa *Jaa tiedostona* ja lähettää tiedoston muulla tavoin. Se otetaan vastaan kohdassa **Vastaanota** Jaa-tilassa.

## Tietokoneella

Rivit saapuvat kohdan Laitteet tai Vastaanota kautta, ja näet ne ennen kuin mitään lisätään.

- Taulukko tallennetaan ensin versiona, joten voit palata siihen.
- Puuttuvat sarakkeet lisätään: `falt_id`, `lat`, `lon`, `noggrannhet_m`, `foto`, `insamlad` ja `insamlad_av`. Jos aineistossa on jo pituus- ja
  leveysastesarakkeet, niitä käytetään.
- Aineisto avautuu karttana Muokkaa-tilassa, koska riveillä on sijainnit.
- Kuvista tulee kuvakokoelma *Nimi: kuvat* rivin sijainnin ja ajan kera. Myöhemmät toimitukset tulevat samaan kokoelmaan.
- Aineiston säännöt ajetaan tulokselle, ja loki kertoo, kuinka moni rikkoutuu.

Rivit tunnistetaan sarakkeesta `falt_id`. Sama tiedosto voidaan siksi ottaa vastaan kahdesti ilman kaksoiskappaleita, mutta tietokoneella muutettua
riviä ei korvata.

Jos aineistoa ei enää ole tietokoneella, ehdotetaan uutta lomakkeen sarakkeilla.

## Henkilötiedot

Sijainti ja kuvat ovat usein henkilötietoja, ja kuvassa voi näkyä ihmisiä. Kysy vain tarpeellista, ja poista muuten sijainti ja kuvat käytöstä.

Puhelin pyytää lupaa ennen sijainnin luovuttamista, eikä sijaintia lähetetä minnekään ennen kuin lähetät rivit. Rivit ja kuvat ovat salaamattomina
selaimen tallennustilassa puhelimessa, joten lähetä ja tyhjennä ne säännöllisesti.

## Rajoitukset

- Dataspatium Mobil toimii verkko-osoitteesta, ei tiedostosta, ja tarvitsee verkon ensimmäisellä kerralla.
- Sijainnin tarkkuus riippuu puhelimesta. Kenttä `noggrannhet_m` kertoo, kuinka varma se on.
- Suuret keräykset jaetaan useaan tiedostoon, jotka otetaan vastaan erikseen.
- Useat puhelimet voivat kerätä samalla lomakkeella. Jokaisella puhelimella on omat rivinsä, ja ne lisätään erikseen.
