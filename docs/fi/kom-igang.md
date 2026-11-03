# Dataspatiumin aloitusopas

Tämä opas vie sinut lataamisesta ensimmäiseen vientiin. Se ei edellytä muuta kuin nykyaikaisen selaimen.

## 1. Lataa ja pura

Lataa uusin julkaisu osoitteesta <https://github.com/marwiss/Dataspatium/releases/latest>: ZIP-tiedosto
`dataspatium-<versio>.zip` kohdasta *Assets*. Pura se valitsemaasi kansioon, esimerkiksi `Tiedostot\Dataspatium`. Kansiossa
on `index.html`, kansiot `src`, `vendor` ja `docs` ja muuta. Älä siirrä tai nimeä uudelleen kansion sisällä olevia
tiedostoja; koko kansion voi sen sijaan siirtää vapaasti, myös USB-muistille.

## 2. Avaa sovellus

Kaksoisnapsauta `index.html`-tiedostoa. Selain avaa sovelluksen tietokoneeltasi (osoite alkaa `file:///`). Jos
kaksoisnapsautus ei toimi, napsauta hiiren kakkospainikkeella ja valitse *Avaa sovelluksessa* ja selaimesi, tai vedä
tiedosto avoimeen selainikkunaan.

Ensimmäisellä kerralla sovellus kysyy, mitä kieltä haluat käyttää: ruotsia, tanskaa, norjaa, suomea, islantia vai englantia.
Valinta tallennetaan selaimeen, ja sitä voi muuttaa milloin tahansa oikean yläkulman kielipainikkeella (kirjainkuvake) tai
komentopaletista. Fontit ja kuvakkeet ladataan kansiosta; se kestää hetken. Mitään ei noudeta internetistä.

## 3. Tilat

Yläreunassa on kuusi tilaa. Vasemmanpuoleinen paneeli näyttää kohteet (aineistot ja lähteet), keskellä on työalue,
oikeanpuoleinen paneeli näyttää ominaisuudet ja tilastot, ja alareunassa on loki. Paneelit voi piilottaa oikean yläkulman
painikkeilla. Alt+1 … Alt+6 vaihtaa tilaa näppäimistöltä.

| Tila | Mitä siellä tehdään |
|---|---|
| Nouda | Tuodaan tiedostoja, liitetään taulukoita ja noudetaan Pohjoismaiden avoimista rajapinnoista, kuten Tilastokeskukselta, THL:n Sotkanetista, SCB:ltä, SSB:ltä ja Eurostatista ([api-konfiguration.md](api-konfiguration.md)) |
| Hallitse | Näet aineistosi, nimeät uudelleen, poistat, tallennat versioita, varmuuskopioit ja palautat työtilan |
| Muokkaa | Muokkaat soluja, lajittelet ja suodatat, puhdistat ja tyypität, lasket sarakkeita, pivotoit ja yhdistät aineistoja; kaikessa on kumoaminen, versiot ja reseptit ([bearbeta.md](bearbeta.md)) |
| Analysoi | R-konsoli, jossa on ggplot2 ja tidyverse, tallennetut skriptit ja kaavioiden vienti; SQL-konsoli valittua aineistoa vastaan |
| Visualisoi | Rakennat kaavioita Vega-Litellä, D3-malleilla tai R-skripteillä, tallennat, viet ja luot niitä eräajona ([visualisera.md](visualisera.md)) |
| Vie | Lataat dataa CSV-, Excel-, JSON- tai SQLite-muodossa, tallennettuja kaavioita SVG-, PNG- tai PDF-muodossa ja asiakirjoja malleista HTML-, Word-, PDF-, Markdown- tai LaTeX-muodossa ([dokumentmallar.md](dokumentmallar.md)) |

## 4. Tuo tiedosto

1. Siirry *Nouda*-tilaan ja pudota tiedosto katkoviivalla rajatulle alueelle (tai napsauta ja valitse tiedosto). Tuetut
   tiedostomuodot: CSV, TSV ja muut erotinmuotoiset tekstitiedostot, Excel (xlsx, xls, xlsm, xlsb), ODS, JSON, NDJSON,
   JSON-stat, GeoJSON, XML, SQLite, GeoPackage, shapefile (ZIP, jossa shp ja dbf), kiinteälevyinen teksti sekä
   tilastotiedostot SPSS:stä (sav), Statasta (dta), SAS:sta (sas7bdat, xpt), PX-muoto, Parquet ja R (rds, RData).
   Tiedostoja voi noutaa myös suoraan verkko-osoitteesta kohdassa *Verkko-osoitteesta*. Tilastomuodot lukee R, ja ne tuodaan
   yhdessä vaiheessa ilman esikatselua; ensimmäisellä kerralla se kestää muutaman sekunnin R:n käynnistyessä. Ks.
   [format.md](format.md).
2. Tarkista asetukset. Dataspatium arvaa merkistökoodauksen (UTF-8 tai Windows-1252), erottimen, onko ensimmäinen rivi
   otsikkorivi ja onko desimaalierotin pilkku vai piste. Esikatselu näyttää ensimmäiset 100 riviä.
3. Tarkista sarakkeet. Jokainen sarake saa tyypin: teksti, kokonaisluku, desimaaliluku, päivämäärä, päivämäärä ja aika tai
   kyllä/ei. Etunollilla alkavat koodit (kuntakoodit, postinumerot) säilytetään tekstinä. Muuta nimeä tai tyyppiä
   tarvittaessa ja poista valinta sarakkeista, joita et halua mukaan.
4. Anna aineistolle nimi ja napsauta *Tuo*. Voit sen jälkeen avata sen suoraan *Muokkaa*-tilassa.

Vinkki: voit myös liittää taulukon Excelistä tai verkkosivulta kohdan *Liitä* kautta vasemmasta paneelista.

## 5. Selaa ja tarkista

*Muokkaa*-tilassa näkyy taulukko. Napsauta sarakeotsikkoa lajitellaksesi (nouseva, laskeva, lajittelematon) ja nähdäksesi
sarakkeen tilastot oikealla: lukumäärä, puuttuvat, erilliset, pienin, suurin, keskiarvo, summa ja yleisimmät arvot. Kirjoita
suodatinkenttään, niin näkyvät vain tekstin sisältävät rivit. Suuret taulukot piirretään rivi kerrallaan vierittäessä, joten
satojakin tuhansia rivejä voi selata.

## 6. Vie

Valitse *Vie*-tilassa muoto ja tiedostonimi ja napsauta *Vie ja lataa*.

- CSV profiililla *Sovitettu pohjoismaiselle Excelille* käyttää puolipistettä, desimaalipilkkua ja UTF-8:aa BOM-merkillä,
  joten pohjoismaisilla asetuksilla toimiva Excel avaa tiedoston oikein heti. Profiili *Vakio* käyttää pilkkua ja
  desimaalipistettä.
- Excel (xlsx) ja ODS säilyttävät luvut, päivämäärät ja kyllä/ei-arvot oikeina tyyppeinä.
- JSON tuottaa luettelon objekteja, XML tiedoston, jossa on yksi elementti riviä kohden.
- SQLite tuottaa aineiston oman tiedoston, jonka voi lukea myös R:llä, DB Browser for SQLite -ohjelmalla ja monilla muilla
  työkaluilla.
- Parquet-, SPSS- (sav), Stata- (dta) ja RDS-tiedostot kirjoittaa R, ja ne käynnistävät R-istunnon tarvittaessa.

Kaikki muodot voi tuoda uudelleen Dataspatiumiin.

## 7. Varmuuskopioi

Aineistot ovat selaimen tietokannassa tällä tietokoneella. Ne katoavat, jos tyhjennät sivustotiedot, vaihdat selainprofiilia
tai poistat selaimen. Siirry *Hallitse*-tilaan, valitse *Työtila* ja napsauta *Varmuuskopioi työtila*. Saat ZIP-tiedoston,
jossa ovat kaikki aineistot. Palauta pudottamalla ZIP-tiedosto alueelle *Palauta ZIP-tiedostosta*.

Edgessä ja Chromessa voit lisäksi valita *siirrettävän kansion*: työtila tallennetaan tavallisina tiedostoina (yksi
SQLite-tiedosto aineistoa kohden sekä kaaviot ja mallit) valitsemaasi kansioon, esimerkiksi USB-muistille tai synkronoituun
kansioon. Ota käyttöön *Tallenna automaattisesti muutosten yhteydessä*, niin kansio pysyy ajan tasalla. Toisella tietokoneella
valitset saman kansion ja napsautat *Lataa kansiosta*. Selaimen uudelleenkäynnistyksen jälkeen se kysyy kerran lupaa
käyttää kansiota uudelleen; napsauta *Yhdistä uudelleen*.

Jos haluat lähettää valikoiman kollegalle, käytä samalla sivulla toimintoa *Jaa paketti*: valitse aineistot ja otetaanko
kaaviot, kojelaudat, mallit ja muistikirjat mukaan. Kollega pudottaa paketin alueelle *Palauta ZIP-tiedostosta*; hänen
työtilassaan jo olevat kohteet ohitetaan.

## Yleisiä kysymyksiä

**Sivu on tyhjä tai näyttää vain "Dataspatium käynnistyy".** Tarkista, että koko kansio on purettu (ei vain `index.html`) ja
että käytät Edgen, Chromen tai Firefoxin ajantasaista versiota. Avaa selaimen konsoli (F12) ja etsi punaisia virheitä;
ilmoita niistä mielellään issuena.

**Å-, ä- ja ö-kirjaimet muuttuivat oudoiksi merkeiksi.** Vaihda merkistökoodausta tuontivaiheessa *Asetukset*, yleensä
UTF-8:n ja Windows-1252:n välillä.

**Luvut muuttuivat tekstiksi.** Sarakkeessa oli jokin arvo, jota ei voitu tulkita luvuksi, tai etunollilla alkavia lukuja.
Muuta tyyppiä vaiheessa *Sarakkeet* pakottaaksesi tulkinnan; arvot, joita ei voi tulkita, muuttuvat tyhjiksi.

**Voinko jakaa dataa kollegan kanssa?** Kyllä: vie aineisto (SQLite tai CSV) tai tee työtilasta varmuuskopio ja lähetä
ZIP-tiedosto. Kollega tuo tai palauttaa sen omaan Dataspatiumiinsa.

**Miksi ei palvelinta tai pilvipalvelua?** Jotta datasi pysyy sinulla ja jotta sovellus toimii ilman asennusta, tilejä ja
internetiä.

Lisää kysymyksiä ja vastauksia on tiedostossa [faq.md](faq.md). Kun haluat edetä ensimmäisistä vaiheista,
[anvandarguide.md](anvandarguide.md) kuvaa koko työnkulun tiedostosta raporttiin.
