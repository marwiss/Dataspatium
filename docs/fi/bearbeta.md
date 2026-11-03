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
- Taulukko on virtualisoitu: vain näkyvät rivit ovat selaimen DOM:ssa, loput SQLitessä. Miljoonaa riviä selaa yhtä nopeasti
  kuin sataa.

## Toiminnot

**Toiminnot**-painike avaa paletin. Jokaisella toiminnolla on valintaikkuna, jonka kentät muodostetaan toiminnon
parametreista, ja mahdollisuuksien mukaan esikatselu näyttää, montaako riviä toiminto koskee, sekä esimerkit ennen ja jälkeen.

| Ryhmä | Toiminto | Mitä se tekee |
|---|---|---|
| Sarakkeet | Nimeä sarake uudelleen | Uusi sarakkeen nimi; selite seuraa mukana, jos se oli sama kuin nimi |
| | Selite, kuvaus ja yksikkö | Selite on näyttönimi taulukon otsikoissa ja kaavioissa; kuvaus ja yksikkö näytetään tarkastelupaneelissa ja koodikirjassa, kulkevat SQLite-tiedoston mukana ja välittyvät R:lle attribuutteina `description` ja `unit` |
| | Poista sarakkeita | Poistaa valitut sarakkeet |
| | Järjestä sarakkeet uudelleen | Siirrä sarakkeita ylös ja alas |
| | Vaihda tyyppi | Teksti kokonaisluvuksi, desimaaliluvuksi, päivämääräksi, päivämääräksi ja ajaksi tai kyllä/ei-arvoksi. Desimaalierottimen ja päivämäärämuodon voi antaa; arvot, joita ei voi tulkita, muuttuvat tyhjiksi, ja niiden määrä ilmoitetaan |
| Arvot | Etsi ja korvaa | Teksti tai säännöllinen lauseke valituissa tekstisarakkeissa, esikatselun kera |
| | Poista välilyönnit | Alussa ja lopussa olevat sekä (valinnaisesti) kaksoisvälilyönnit |
| | Vaihda kirjainkoko | SUURAAKKOSET, pienaakkoset tai Isot Alkukirjaimet |
| | Korjaa merkistökoodaus | Korjaa mojibaken (Ã¶ muuttuu ö:ksi), joka on syntynyt tuonnissa väärällä koodauksella |
| | Korvaa arvo | Yksi tarkka arvo toisella; tyhjän arvon voi valita lähtö- tai kohdearvoksi |
| | Täytä puuttuvat arvot | Vakioarvo tai edellisen rivin arvo |
| Rivit | Poista rivejä | SQL-ehto, esimerkiksi `befolkning < 1000`; valitse Säilytä, jos haluat sen sijaan säilyttää vain vastaavat rivit |
| | Poista kaksoiskappaleet | Valittujen sarakkeiden tai koko rivin perusteella; ensimmäinen esiintymä säilytetään |
| Rakenne | Uusi laskettu sarake | SQL-lauseke, esimerkiksi `round(befolkning / 1000.0, 1)` tai `case when andel > 5 then 'stor' else 'liten' end` |
| | Yhdistä sarakkeita | Useita sarakkeita yhdeksi tekstisarakkeeksi erottimella |
| | Jaa sarake | Yksi tekstisarake useaksi erottimen kohdalta |
| | Pivotoi pitkään muotoon | Valituista sarakkeista tulee rivejä, joissa on nimi ja arvo |
| | Pivotoi leveään muotoon | Nimisarakkeen arvoista tulee uusia sarakkeita |
| | SQL-lause | Mikä tahansa UPDATE, DELETE tai ALTER TABLE taulua `data` vastaan |
| Uudet aineistot | Ryhmittele ja koosta | Summa, keskiarvo, pienin, suurin, lukumäärä, erillisten lukumäärä tai mediaani ryhmittäin uuteen aineistoon |
| | Yhdistä aineistoja | Vasen liitos tai sisäliitos toiseen aineistoon avaimen perusteella |
| | Liitä aineistoja | Pinoaa rivit useista aineistoista; sarakkeet yhdistetään nimen perusteella |
| | Puhdista luokat | Etsii saman arvon kirjoitusmuunnelmat (kirjainkoko, välilyönnit, tarkkeet) ja yhdistää ne |

Uuden aineiston luovat toiminnot jättävät alkuperäisen ennalleen ja valitsevat uuden aineiston, kun se on valmis.

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

**Säännöt**-painike avaa aineiston laatusäännöt: mitä on pädettävä, jotta data on oikein. Sääntötyyppejä on seitsemän: ei saa
puuttua, yksilöllinen (yksi tai useampi sarake yhdessä), välillä (luvut, päivämäärät tai teksti), luettelossa, vastaa kuviota
(säännöllinen lauseke), tekstin pituus ja vapaa SQL-ehto, jonka on oltava tosi jokaisella rivillä. **Ehdota sääntöjä** lisää
sääntöjä datan laatuprofiilista: sarakkeet ilman puuttuvia arvoja, yksilölliset sarakkeet ja kiinteän pituiset koodit.

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
  `dm_lower`, `dm_title`, `dm_squish`.
- SQL-skriptit tallennetaan kohdepaneeliin samoin kuin R-skriptit.

SQLiten murre on voimassa: `||` tekstin yhdistämiseen, `cast(x as integer)`, `strftime()` päivämääriin, `group_concat()`,
ikkunafunktiot kuten `row_number() over (partition by …)`.

## Rajoitukset

- Kumoaminen toimii istunnon sisällä; käytä versioita palataksesi sivun uudelleenlatauksen jälkeen.
- Sarakkeen uudelleen rakentavat toiminnot (Vaihda tyyppi, Jaa sarake, pivotointi) vievät aineiston ensin kumoamista varten.
  Yli muutaman sadan megatavun aineistoissa se kestää huomattavasti.
- Reseptien R-vienti kattaa sisäänrakennetut toiminnot; vapaa SQL viedään kommenttina, koska sitä ei voi kääntää R:ksi
  automaattisesti.
