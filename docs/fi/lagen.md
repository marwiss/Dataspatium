# Kahdeksan tilaa

Dataspatium on jaettu kahdeksaan tilaan, jotka seuraavat työn kulkua tilastotuotannon hengessä: kerää, käsittele,
analysoi ja julkaise: Nouda, Hallitse, Hae, Muokkaa, Analysoi, Visualisoi, Vie, Jaa. Kaikilla tiloilla on sama
runko: tilanvalitsin ylhäällä, kohdepaneeli vasemmalla, työalue keskellä, tarkastelupaneeli oikealla ja tilarivi
alhaalla, loki sen yläpuolelle taitettuna. Paneelit eivät koskaan vaihda paikkaa. Alt+1 … Alt+8 vaihtaa tilaa. Tyhjä
työtila avautuu Nouda-tilaan, aineistoja sisältävä työtila Hallitse-tilaan. Oikean yläkulman painikkeet avaavat
komentopaletin, vaihtavat kieltä, vaihtavat teemaa (vaalea, tumma, järjestelmän mukaan) ja avaavat ohjeen.

**Tilarivi** näyttää tallennuksen tilan, kuinka paljon tallennustilaa työtila käyttää, valitun aineiston (nimi,
rivit ja sarakkeet; napsautus avaa sen Hallitse-tilassa), R-moottorin tilan (pois, käynnistyy, valmis, varattu;
napsautus käynnistää sen), käynnissä olevat internetkutsut (napsautus näyttää kutsujen lokin), painikkeet, jotka
piilottavat ja näyttävät kohdepaneelin, tarkastelupaneelin ja lokin, sekä lokin rivimäärän.

**Paneelien leveyttä** muutetaan vetämällä paneelin ja työalueen välistä reunaa; kaksoisnapsautus palauttaa
oletuksen, ja näppäimistöllä nuolinäppäimet siirtävät reunaa (Vaihto suuremmille askelille, Home ja End pienimmälle
ja suurimmalle leveydelle). Leveydet tallennetaan. Kapeammissa ikkunoissa (alle 1 100 px) tilanvalitsin näyttää vain
kuvakkeet, teksti vain aktiivisessa tilassa, ja tarkastelupaneeli avautuu työalueen päälle liukupaneelina; alle
760 px myös kohdepaneeli tekee samoin. Liukupaneeli suljetaan Esc-näppäimellä tai napsauttamalla työaluetta.

**Työkaluvihjeet** näytetään kaikille painikkeille, kun osoitin pysähtyy niiden päälle tai kun ne saavat
kohdistuksen näppäimistöltä; kosketusnäytöllä pitämällä sormea painikkeella.

Komentopaletti (Ctrl+K tai suurennuslasi ylhäällä) tavoittaa kaiken yhdestä hakukentästä: vaihda tilaa, avaa
aineisto, kaavio tai kojelauta, suorita muokkaustoiminto valitulle aineistolle, vie, avaa työtila, hae datasta, luo
paketti, kopioi linkki tähän, vaihda teemaa tai tarkista päivitykset. Linkit ovat muotoa
`index.html#/<tila>/<lyhytnimi>` (tai kaavion nimi Visualisoi-tilassa, hakuteksti Hae-tilassa) ja toimivat myös
kansiosta. Nuoli ylös ja alas valitsee, Enter suorittaa ja Esc sulkee; viimeksi
suoritetut komennot ovat ylimpänä.

## Nouda

Tänne data tulee: alueelle pudotetut tiedostot, liitetty teksti, verkko-osoitteet ja avoimet rajapinnat. Tiedostojen
tuonti etenee vaiheittain: tiedosto, asetukset esikatselulla, sarakkeet tyyppeineen, valmis. Muodot: CSV ja muu
erotinmerkein jaettu teksti, kiinteälevyinen teksti, Excel, ODS, JSON (myös JSON-stat ja GeoJSON), XML, SQLite,
GeoPackage, shapefile sekä R:n kautta SPSS, Stata, SAS, PX, Parquet, RDS ja RData (ks. [format.md](format.md));
R-muodot tuodaan yhdessä vaiheessa ilman esikatselua. Kohdassa Avoimet rajapinnat on valmiit asetukset
Tilastokeskukselle, THL:lle ja muille Pohjoismaiden tilastovirastoille ja viranomaisille, SCB:lle (selaa aihepuuta
tai hae taulukkoa), Eurostatille, Nordic Statisticsille ja muille, sekä avaimia vaativille lähteille; luettelon
yläpuolella olevat maapainikkeet valitsevat, minkä maiden lähteet näytetään. Omat määritykset lisätään tiedostosta,
ja niitä voi jakaa. *Tallennetut haut* luettelee rajapinnasta tulleet aineistot ja päivittää ne yhdellä
napsautuksella, yksi kerrallaan tai kaikki. Kun sovelluksen pitää ensimmäisen kerran ottaa yhteys internetiin jotakin
tarkoitusta varten (rajapinnat, verkko-osoitteet, GitHub, komponentit), se kysyy lupaa; vastauksen voi tallentaa.
Ks. [api-konfiguration.md](api-konfiguration.md).

## Hallitse

Aineistojen koti. Kohdepaneeli on puu: aineistot voivat olla kansioissa alikansioineen (`Talous/2026`), ja niillä
voi olla tunnisteita; suodatinkenttä hakee nimestä, lyhytnimestä, tunnisteesta ja kansiosta, ja luettelon voi
lajitella muutosajan, nimen tai rivimäärän mukaan. Kansiot avautuvat ja sulkeutuvat, ja aineistoja voi vetää
kansioon. Valintaruudut valitsevat useita aineistoja (Vaihto valitsee välin), ja painike *Toiminnot (n)* avaa
erätoiminnot: järjestä (kansio ja tunnisteet), paketoi, vie ZIP-tiedostona CSV-tiedostoineen, nouda uudelleen
rajapinnasta, suorita resepti ja poista. Kansio ja tunnisteet kulkevat aineiston mukana sen tiedostossa, paketeissa
ja varmuuskopioissa.

Aineiston yleiskatsaus näyttää metatiedot, sarakeluettelon, kommentit, historian aineistolle tehdyistä toimista ja
versiot, ja tässä nimeät uudelleen ja vaihdat lyhytnimen (lyhytnimeä käytetään SQL:ssä, R:ssä ja
kaaviotiedostoissa), järjestät, poistat ja noudat uudelleen rajapinnasta. Kohdassa *Työtila* ovat käytetty
tallennustila, pysyvä tallennus, varmuuskopiointi ZIP-tiedostoon ja palautus, Edgessä ja Chromessa siirrettävä
kansio (työtila tallennetaan tavallisina tiedostoina valitsemaasi kansioon, halutessasi automaattisesti jokaisen
muutoksen jälkeen, ja sen voi ladata toisella tietokoneella), *Internetyhteys* (mitkä tarkoitukset saavat ottaa
yhteyden internetiin, kutsujen lokin kanssa) ja *Komponentit* (sovelluksen osat ja R-paketit, jotka noudetaan
tarvittaessa, kokoineen, lähteineen ja painikkeineen etukäteen noutamiseen tai poistamiseen). Paketit ja GitHub ovat
siirtyneet Jaa-tilaan.

## Hae

Löydä ja listaa ilman koodia. Välilehti *Hae* hakee kaikista sarakkeista yhdessä tai kaikissa aineistoissa; jokaisen
sanan on löydyttävä riviltä kirjainkoosta riippumatta. Osumat näytetään aineistoittain lukumäärineen, fasetteineen
(yleisimmät arvot sarakkeissa, joissa on vähän eri arvoja ja jotka rajaavat hakua yhdellä napsautuksella) ja
taulukkona, jossa rivi avaa koko tietueen tarkastelupaneeliin. Haun voi tallentaa listaksi, siitä voi tehdä uuden
aineiston tai sen voi avata Muokkaa-tilassa. Välilehti *Listat* kokoaa tallennetut haut aineistoittain ja suorittaa
ne uudelleen tämän päivän datalla. Ks. [soka.md](soka.md).

## Muokkaa

Kaikki, mitä taulukolle tehdään painikkeilla ja valintaikkunoilla: muokkaa soluja suoraan taulukossa, lajittele,
suodata ja katso saraketilastoja; puhdistustoiminnot (etsi ja korvaa säännöllisillä lausekkeilla, poista
välilyönnit, kirjainkoko, merkistökoodauksen korjaus, korvaa arvo, täytä puuttuvat, kaksoiskappaleet, luokkien
puhdistus), tyypit (luku, päivämäärä, kyllä/ei), rakenne (lasketut sarakkeet, jaa ja yhdistä, poista rivejä,
pivotoi) ja uudet aineistot (ryhmittele ja aggregoi, yhdistä, liitä). Datan laatuprofiili osoittaa, mitä pitäisi
korjata, ja laatusäännöt (ei saa puuttua, yksilöllinen, väli, luettelo, kuvio, pituus, SQL-ehto) tarkistavat datan
pyynnöstä raportilla ja virheellisillä riveillä omana aineistonaan. Kaikki kirjataan reseptiksi, jonka voi kumota,
toistaa toiselle aineistolle ja viedä R- tai SQL-koodina. Versiot tallentavat tilannekuvia, joihin voi palata. Ks.
[bearbeta.md](bearbeta.md).

## Analysoi

Koodi ja tilastot. Työkalut ovat kiinteässä järjestyksessä: R, SQL, Regex ja viimeisenä muistikirja, joka kokoaa osia
muista; Python lisätään R:n jälkeen tulevassa versiossa. R-konsolissa on ggplot2, dplyr, tidyr ja muita paketteja,
tallennetut skriptit, kaaviot vienteineen SVG-, PNG- ja PDF-muotoon sekä `dm_read()`/`dm_write()` datan siirtämiseen
sovelluksen ja R:n välillä (ks. [r-guide.md](r-guide.md)); paketit, jotka eivät tule sovelluksen mukana, noudetaan
webR:n pakettivarastosta, kun koodi tarvitsee niitä, luvan antamisen jälkeen. SQL-konsoli toimii valittua aineistoa
(`data`) vastaan, ja muihin aineistoihin viitataan lyhytnimillä, joten kysely voi yhdistää useita aineistoja; kyselyt
näyttävät tulokset, jotka voi tallentaa uudeksi aineistoksi, ja muuttavat lauseet kirjataan reseptin vaiheiksi (ks.
[bearbeta.md](bearbeta.md)). Regex-välilehti kokeilee säännöllisiä lausekkeita sarakkeeseen osumat korostettuina ja
käyttää niitä suodattamiseen, poimimiseen, korvaamiseen, jakamiseen, merkitsemiseen, laskemiseen tai laatusäännön
luomiseen, kuvioprofiilin ja pohjoismaisten kuvioiden kirjaston kanssa (ks. [regex.md](regex.md)). Muistikirja
yhdistää tekstiä (Markdown), R:ää ja SQL:ää soluissa, jotka suoritetaan järjestyksessä ja joista syntyy raportti
HTML-, Word-, PDF-, Markdown- tai LaTeX-muodossa (ks. [anteckningsbok.md](anteckningsbok.md)). Myöhemmin:
tilastolliset mallit.

## Visualisoi

Kaavioita kolmella moottorilla ja yhdellä ilmeellä: kaaviorakentaja (Vega-Lite) pylväillä, viivoilla, alueilla,
pisteillä, histogrammeilla, lämpökartoilla, laatikkokuvioilla, ympyröillä ja kartoilla (teemakartat GeoJSON- tai
shapefile-datasta); D3-mallit sijoituksille, kaltevuuskaavioille ja väestöpyramideille; ja R-skriptit ggplot2:lla.
Tallennetut kaaviot voi viedä SVG-, PNG-, PDF- ja PowerPoint-muotoon, jakaa viz-tiedostoina, näyttää galleriassa ja
luoda eräajona ryhmittäin. Kojelaudat kokoavat tallennetut kaaviot ruudukkoon yhteisillä suodattimilla, ja ne viedään
HTML- tai PowerPoint-muotoon. Ks. [visualisera.md](visualisera.md).

## Vie

Tiedostoja omalle tietokoneelle, kolmessa välilehdessä. **Data**: CSV (Excel-sovitettu tai vakio), Excel, ODS, JSON,
XML, SQLite sekä R:n kautta Parquet, SPSS, Stata ja RDS. **Kaaviot**: tallennetut kaaviot ja kojelaudat (myös kaikki
kaaviot yhtenä PowerPointina) SVG-, PNG- ja PDF-muodossa, yksittäin tai eräajona ryhmittäin ZIP-tiedostoon.
**Asiakirjat**: raportteja, koodikirjoja ja koosteita Markdown-malleista paikkamerkein, HTML-, Word-, PDF-,
Markdown- tai LaTeX-muodossa, yksittäin tai eräajona ryhmittäin (ks. [dokumentmallar.md](dokumentmallar.md)). Se,
mikä on tarkoitettu muille ihmisille, on Jaa-tilassa.

## Jaa

Anna tietoa muille. **Paketti**: ZIP valituista aineistoista, kaavioista, kojelaudoista, malleista, muistikirjoista
ja skripteistä, viesti ja muutosloki, jonka vastaanottaja avaa kohdassa *Vastaanota* ja jolla hän voi korvata omat
versionsa. **GitHub**: työtila kansiona repositoriossa, lähetä ja nouda, salattuna tallennetulla
käyttöoikeustunnuksella. **Jakovalikko**: tietokoneen tai puhelimen oma jakovalikko tiedostolle tai paketille
(sähköposti, Teams, viestisovellukset). **Julkaise**: kojelaudat ja asiakirjat itsenäisinä HTML-tiedostoina.
**Laitteet**: suora siirto puhelimiin ja toisiin tietokoneisiin samassa verkossa QR-koodilla, tarkistuskoodilla
ja parituksella sekä Dataspatium Mobiili puhelimessa (ks. [mobil.md](mobil.md)). **Vastaanota**: paketit
tiedostosta tai verkko-osoitteesta, lähettäjä ja muutokset näkyvissä ennen kuin mitään otetaan vastaan.
Sovelluksesta lähtevät aineistot tarkistetaan ensin henkilötietojen varalta. Ks. [dela.md](dela.md).
