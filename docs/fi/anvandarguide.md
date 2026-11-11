# Käyttöopas

Tämä opas kuvaa, miten työskentelet Dataspatiumissa ensimmäisestä tiedostosta valmiiseen raporttiin. Se olettaa, että olet
avannut sovelluksen tiedoston [kom-igang.md](kom-igang.md) ohjeiden mukaan. Kunkin tilan tiedot ovat tiedostossa
[lagen.md](lagen.md), tiedostomuodot tiedostossa [format.md](format.md), rajapinnat tiedostossa
[api-konfiguration.md](api-konfiguration.md), muokkaus tiedostossa [bearbeta.md](bearbeta.md), R tiedostossa
[r-guide.md](r-guide.md), Python tiedostossa [python.md](python.md), kaaviot tiedostossa [visualisera.md](visualisera.md) ja asiakirjat tiedostossa
[dokumentmallar.md](dokumentmallar.md). Yleisiin kysymyksiin vastataan tiedostossa [faq.md](faq.md).

## Työtila

Näkymä on samanlainen kaikissa tiloissa. Ylhäällä vaihdat tilaa (Nouda, Hallitse, Hae, Muokkaa, Analysoi,
Visualisoi, Vie, Jaa; myös Alt+1 … Alt+8 toimii) ja tavoitat komentopaletin (suurennuslasi tai Ctrl+K),
kielipainikkeen, teeman (vaalea tai tumma) ja ohjepainikkeen versionumeroineen ja toimintoineen *Tarkista
päivitykset*. Komentopaletti on nopein tie useimpiin asioihin: kirjoita muutama kirjain vaihtaaksesi tilaa,
avataksesi aineiston, kaavion tai kojelaudan, hakeaksesi datasta tai suorittaaksesi muokkaustoiminnon valitulle
aineistolle. Vasemmalla ovat tilan kohteet (aineistot, lähteet, kaaviot, mallit), keskellä työalue ja oikealla
tarkastelupaneeli ominaisuuksineen ja tilastoineen. Alhaalla on tilarivi: tallennuksen tila, tallennustila, valittu
aineisto, R-moottori, käynnissä olevat internetkutsut ja painikkeet, jotka piilottavat paneelit ja avaavat lokin,
johon kirjataan jokainen toiminto, varoitus ja virhe; sitä luet, kun jokin ei mene niin kuin ajattelit. Paneelien
leveyttä muutetaan vetämällä reunaa työaluetta kohti, ja kapeissa ikkunoissa paneelit avautuvat työalueen päälle
(ks. [lagen.md](lagen.md)).

Kaikki luomasi tallennetaan automaattisesti selaimen tietokantaan tietokoneellasi. Mitään ei lähetetä minnekään,
ellet itse nouda rajapinnasta, tarkista päivityksiä, lähetä GitHubiin tai jaa. Kun sovellus tarvitsee ensimmäisen
kerran internetiä jotakin tarkoitusta varten, se kysyy lupaa, ja vastauksen voi tallentaa; kohdassa *Hallitse →
Työtila → Internetyhteys* näet, mikä on sallittu ja mitä kutsuja on tehty. Sovelluksen osat, jotka eivät tule
kansion mukana (jotkin komponentit ja R-paketit), noudetaan samalla tavalla tarvittaessa ja tallennetaan sitten
paikallisesti.

## Peruskurssi

Peruskurssi on hyvä tapa tutustua sovellukseen. Se alkaa kielen valinnan jälkeen, kun sovellus avataan ensimmäisen
kerran, ja muuten ohjeesta (kysymysmerkki oikeassa yläkulmassa) tai komentopaletin komennolla *Avaa peruskurssi*.
Kurssi näkyy oikean alakulman paneelissa, kun työskentelet oikeassa sovelluksessa, ja se seuraa esimerkkiä *Väestö
kunnittain 2024 (Ruotsi)* yhdeksässä vaiheessa:

1. Tervetuloa: mitä sovellus tekee ja miten näkymä on järjestetty.
2. Nouda: esimerkkidatan tuonti ja mikä aineisto on.
3. Hallitse: nimi ja lyhyt nimi, lähde, sarakkeet, versiot ja varmuuskopiot.
4. Muokkaa: taulukko, sarakeprofiilit ja laskettu sarake, josta tulee vaihe reseptiin.
5. Analysoi SQL:llä: väkiluku lääneittäin ja miten lyhyet nimet yhdistävät aineistoja.
6. Analysoi R:llä: `dm_read()`, yhteenveto ja histogrammi ggplot2:lla.
7. Visualisoi: vaakapalkkikaavio väkiluvusta lääneittäin.
8. Vie: data, kaaviot ja asiakirjat.
9. Valmis: miten jatkaa.

Jokainen vaihe selittää käsitteen ja antaa tehtävän. Kehys merkitsee painikkeen, jota napsauttaa, ja vaihe kuitataan
tehdyksi, kun sovellus huomaa tehtävän tehdyksi. *Tee se puolestani* (tai *Näytä*) tekee vaiheen, joten voit seurata
mukana kirjoittamatta mitään. Kurssin voi pienentää nuolesta ja sulkea rastista; seuraavalla kerralla se jatkuu
siitä, mihin jäit. Kurssi luo esimerkkiaineiston, siihen sarakkeen ja kaavion, jotka voit poistaa tavalliseen tapaan,
kun et enää tarvitse niitä.

## Työnkulku tiedostosta raporttiin

### 1. Nouda data (Nouda)

Pudota tiedosto alueelle, liitä taulukko tai nouda tiedosto verkko-osoitteesta (palvelimen on sallittava CORS; jaettu
Dataspatium-määritys lisätään suoraan). Tarkista esikatselu: merkistökoodaus, erotin, otsikkorivi ja desimaalierotin
arvataan, mutta niitä voi muuttaa. Sarakevaiheessa jokainen sarake saa tyypin; etunollilla alkavat koodit (kuntakoodit,
henkilötunnukset) säilytetään tekstinä. Anna aineistolle nimi ja tuo se. Alueen alla on sovelluksen
mukana tulevaa dataa: painike esimerkkiaineistolle *Väestö kunnittain 2024 (Ruotsi)* ja luettelo *Rajat karttoja
varten*, jossa ovat Ruotsin, Tanskan, Norjan ja Suomen kuntien ja alueiden rajat.

*Avointen rajapintojen* alla on valmisasetukset Suomen, Ruotsin, Norjan, Tanskan ja Islannin tilastovirastoille ja useille
muille viranomaisille, itsehallintoalueille, Nordic Statisticsille ja Eurostatille (Suomesta esimerkiksi Tilastokeskus,
Kuntien avainluvut, THL:n Sotkanet, PRH:n YTJ, Digitraffic, Ilmatieteen laitos ja avoindata.fi). Luettelon yläpuolella olevat
maapainikkeet valitsevat, minkä maiden lähteet näytetään. Selaa tai hae taulukko, valitse muuttujat, esikatsele ja nouda
uuteen aineistoon tai lisää olemassa olevaan. Noudettu aineisto muistaa kyselynsä, joten sen voi noutaa uudelleen
Hallitse-tilasta, kun lähde on päivittynyt, ja Nouda-tilan *Tallennetut haut* päivittää tällaiset aineistot yhdellä
napsautuksella ja toistaa niiden reseptit.

Tietokannat: Access-tiedostot pudotetaan alueelle kuten muut tiedostot; tietokoneen tietokannat (SQL Server, ODBC,
Excel, SQLite) tavoitetaan kohdasta *Tietokanta sillan kautta* ja HTTP-palvelut (PostgREST, OData, GraphQL ja muut)
kohdasta *Tietokantalähde*; OpenCDE:llä ja Neo4j:llä on omat valintansa kohdassa Lisää lähteitä. Chromessa ja Edgessä tiedoston voi linkittää ja lukea uudelleen levyltä. Ks.
[kallor.md](kallor.md).

### 2. Tarkista ja korjaa (Muokkaa)

Taulukko näyttää aineiston rivi riviltä, vaikka siinä olisi satoja tuhansia rivejä. Napsauta otsikkoa lajitellaksesi ja
nähdäksesi sarakkeen tilastot oikealla: lukumäärä, puuttuvat, erilliset, pienin, suurin, keskiarvo ja yleisimmät arvot.
Suodata hakukentällä. Kaksoisnapsauta solua muuttaaksesi sitä.

*Datan laatu* käy läpi kaikki sarakkeet ja osoittaa ongelmat (tekstinä tallennetut luvut, sekalaiset päivämäärämuodot,
kaksoiskappaleet, merkistövirheet, poikkeavat luokat) painikkeella, joka suorittaa oikean toiminnon. *Säännöt* antavat sinun
kirjata, mitä on pädettävä (ei saa puuttua, yksilöllinen, väli, luettelo, kuvio, pituus, SQL-ehto), ajaa tarkistuksen milloin
tahansa, tallentaa rikkovat rivit omaksi aineistokseen ja ladata raportin. Kaikki toiminnot ovat myös paletissa: poista
tyhjät rivit, poista välilyönnit, kirjainkoko, etsi ja korvaa säännöllisillä lausekkeilla, vaihda tyyppi, tulkitse
päivämäärät ja luvut, täytä puuttuvat arvot, kaksoiskappaleet, ryhmittele samankaltaiset luokat ja muuta. Jokainen toiminto
kirjataan reseptin vaiheeksi ja voidaan kumota. Ennen jakamista tunnisteet, kuten henkilötunnukset, voi pseudonymisoida
suolatuilla tiivisteillä, peittämällä tai juoksevilla numeroilla; suolaa ei koskaan tallenneta reseptiin.

### 3. Yhdistä ja muotoile (Muokkaa)

Lasketut sarakkeet, sarakkeiden jakaminen ja yhdistäminen, rivien suodatus pois, uudelleen nimeäminen ja järjestäminen,
pivotointi leveän ja pitkän muodon välillä, ryhmittely ja koostaminen, kahden aineiston yhdistäminen avaimella ja
samansarakkeisten aineistojen liittäminen. Koostamisista, yhdistämisistä ja liittämisistä syntyy uusia aineistoja, joten
alkuperäinen säilyy. Ryhmä *Paikkatieto* antaa keskipisteen ja pinta-alan geometrioista, muunnoksen SWEREF 99 TM:n ja WGS 84:n
välillä sekä ruotsalaisen kunnan ja läänin koordinaateista mukana tulevien rajojen avulla.

Reseptin (kaikki vaiheet järjestyksessä) voi näyttää, ajaa datan uudelle versiolle ja viedä JSON-, R- tai SQL-muodossa.
Versiot otetaan tuonnissa, ennen massatoimintoja ja pyydettäessä; kahta versiota voi verrata ja vanhemman palauttaa.

### 4. Analysoi R:llä ja SQL:llä (Analysoi)

R-konsoli suorittaa oikeaa R:ää (WebR) selaimessa. `dm_list()` näyttää aineistot, `dm_read("lyhytnimi")` lukee aineiston
data.frame-muodossa oikein tyypein, `dm_write(df, "Uusi nimi")` lähettää data.framen takaisin uutena aineistona.
`theme_dataspatium()` ja `dm_palette()` antavat ggplot2:lle sovelluksen ulkoasun. Kaaviot näytetään paneelissa ja viedään
SVG-, PNG- tai PDF-muotoon. Paketit kuten ggplot2, dplyr, tidyr, data.table, haven ja readxl ovat mukana, ja ne asennetaan
istuntoon ensimmäisellä käyttökerralla. Skriptit voi tallentaa ja ajaa uudelleen. Ensimmäinen käynnistys kestää muutaman
sekunnin.

SQL-välilehti kysyy aineiston taulua `data` suoraan SQLitellä. Muihin aineistoihin viitataan niiden lyhytnimillä (näkyvät
nimen alla kohdepaneelissa), joten yksi kysely voi yhdistää useita aineistoja, esimerkiksi
`select ... from befolkning_2024 b join kommungranser k on k.kommunkod = b.kommunkod`. SELECT-kyselyt näyttävät tuloksen
(enintään 5 000 riviä), ja sen voi tallentaa uutena aineistona; UPDATE, DELETE ja ALTER kirjataan reseptin vaiheina. Painike
*Lisää dm_read()* ja tarkastelupaneelin R-esimerkit käyttävät myös lyhytnimeä.

Välilehti *Muistikirja* kokoaa tekstiä (Markdown), R:ää ja SQL:ää soluihin, jotka suoritetaan järjestyksessä ja jotka
tallentavat tulosteensa. Valmis muistikirja viedään HTML-, Word-, PDF-, Markdown- tai LaTeX-muotoon koodin kanssa tai ilman.
Ks. [anteckningsbok.md](anteckningsbok.md).

*Regex*-välilehti kokeilee säännöllistä lauseketta sarakkeeseen kirjoittaessasi: yleisimmät arvot näytetään
osumat merkittyinä, ja vastaavat rivit lasketaan. Samalla kuviolla voi sitten suodattaa rivejä, poimia ryhmiä
uusiin sarakkeisiin, korvata, jakaa, merkitä tai laskea osumia tai luoda laatusäännön. *Kuvioprofiili* näyttää
arvojen muodot (esimerkiksi `9999-99-99` ja `99/99/9999` päivämäärille), ja vasemmalla olevassa kirjastossa on
valmiita kuvioita muun muassa henkilötunnuksille, postinumeroille ja päivämäärille. Ks. [regex.md](regex.md).

### 5. Visualisoi (Visualisoi)

Kaaviorakentaja luo pylväs-, viiva-, alue-, piste-, ympyrä- ja muita kaavioita aineistosta: valitse sarakkeet akseleille,
värille ja pienille paneeleille, koostaminen, lajittelu ja otsikot. D3-mallit antavat erikoiskaavioita (tikkukaavio,
kaltevuuskaavio, väestöpyramidi), ja R-kaaviot voi tallentaa koodeineen. Kaikki moottorit käyttävät samoja värejä ja
fontteja. Tallennetut kaaviot kootaan galleriaan ja viedään SVG-, PNG-, PDF- tai PowerPoint-muotoon yksitellen tai yksi
ryhmää kohden (esimerkiksi kunnittain) ZIP-tiedostoon tai esitykseen. Kartat piirretään kaaviotyypillä *Kartta* aineistosta,
jossa on geometria (mukana tulevat Ruotsin kuntien tai läänien rajat tai omat GeoJSON-, shapefile- ja GeoPackage-tiedostoista)
yhdistettynä arvoihin koodin mukaan, ja *Pistekartalla* pituus- ja leveysasteista rajat taustana. Kojelauta kokoaa useita
tallennettuja kaavioita ruudukkoon yhteisillä suodattimilla, esimerkiksi alue tai vuosi, ja sen voi viedä itsenäisenä
HTML-sivuna tai PowerPointina.

### 6. Asiakirjat (Vie, välilehti Asiakirjat)

Asiakirjamallit kirjoitetaan Markdown-muodossa paikkamerkein: `{{datamangd}}`, `{{antal_rader}}`, `{{#tabell}}…{{/tabell}}`
riveille, `{{diagram "Nimi"}}` tallennetulle kaaviolle, `{{sidbrytning}}` ja tunnusluvut kuten `{{summor.kolumn}}`. Raportti,
koodikirja ja ryhmäyhteenveto ovat valmiina. Luo HTML-, Word-, PDF-, Markdown- tai LaTeX-muodossa yksitellen tai yksi asiakirja
ryhmää kohden.

### 7. Vie data (Vie, välilehti Data)

CSV (sovitettu pohjoismaiselle Excelille tai vakio), Excel, ODS, JSON, GeoJSON (geometriaa sisältäville aineistoille), XML,
SQLite sekä R:n kautta Parquet, SPSS, Stata ja RDS. SQLite ja Parquet säilyttävät tyypit tarkasti; kaikki muodot voi tuoda
uudelleen.

## Datasta hakeminen (Hae)

Hae löytää rivejä ilman koodia. Kirjoita yksi tai useampi sana, valitse kaikki aineistot tai vain valittu ja paina
*Hae*. Osumat näytetään aineistoittain; fasetit (yleisimmät arvot sarakkeissa, joissa on vähän eri arvoja) rajaavat
yhdellä napsautuksella, ja taulukon rivi näyttää koko tietueen tarkastelupaneelissa. Haun voi tallentaa listaksi,
siitä voi tehdä uuden aineiston tai sen voi avata Muokkaa-tilassa aineisto valittuna. Välilehti *Kysely* rakentaa
kyselyn yhdelle tai useammalle aineistolle sarakkeineen, laskentoineen, ehtoineen ja lajitteluineen ilman koodia ja
näyttää luomansa SQL:n; tallennetut listat rajaavat Muokkaa-tilan taulukon ja kaavioiden rivit. Ks. [soka.md](soka.md).

## Järjestyksen pitäminen (Hallitse)

Jokaisella aineistolla on yleiskatsaus (lähde, koko, kuvaus, kansio ja tunnisteet), sarakeluettelo tyyppeineen,
selitteineen, kuvauksineen ja yksikköineen (asetetaan Muokkaa-tilassa toiminnolla *Selite, kuvaus ja yksikkö*),
kommentit, luettava historia kaikesta tehdystä ja versiot. Nimeä uudelleen ja vaihda lyhytnimi, järjestä, poista tai
nouda uudelleen rajapinnasta (päivitä reseptin kanssa tai lisää rivejä). Kohdassa *Työtila* näet käytetyn
tallennustilan, pyydät pysyvää tallennustilaa, otat varmuuskopion ZIP-tiedostona ja palautat. Sovellus muistuttaa
käynnistyessään, kun edellisestä varmuuskopiosta on kulunut valittua päivämäärää pidempään (oletuksena 30 päivää;
muutetaan tai poistetaan käytöstä samassa kortissa). Edgessä ja Chromessa työtilan voi lisäksi peilata siirrettävään
kansioon levylle automaattisesti jokaisen muutoksen yhteydessä.

Hallitse-tilan kohdepaneeli on puu. *Järjestä* antaa aineistolle kansion (alikansioineen, kuten `Talous/2026`) ja
tunnisteita; kansiot voi sulkea, ja aineiston voi vetää toiseen kansioon. Suodatinkenttä hakee nimestä,
lyhytnimestä, tunnisteesta ja kansiosta, ja luettelon voi lajitella muutosajan, nimen tai rivimäärän mukaan.
Valintaruudut valitsevat useita aineistoja (Vaihto valitsee välin), ja painike *Toiminnot (n)* tekee saman kaikille
kerralla: järjestä, paketoi, vie ZIP-tiedostona CSV-tiedostoineen, nouda uudelleen rajapinnasta, suorita resepti tai
poista. Kansio ja tunnisteet tallennetaan aineiston tiedostoon ja kulkevat mukana paketeissa, varmuuskopioissa ja
GitHubissa; R:ssä `dm_list()` näyttää kansion ja `dm_read("Kansio/Nimi")` lukee kansiossa olevan aineiston.

## Jakaminen muiden kanssa

Kaikki, mikä on tarkoitettu muille ihmisille, on *Jaa*-tilassa (ks. [dela.md](dela.md)):

- Valikoima: *Paketti* tuottaa ZIP-tiedoston valituista aineistoista, kaavioista, kojelaudoista, malleista,
  muistikirjoista ja skripteistä sekä viestin ja muutoslokin: mitä kullekin aineistolle on tehty sen jälkeen, kun se
  viimeksi jaettiin, ja ratkaisemattomat kommentit. Vastaanottaja avaa sen kohdassa *Vastaanota*, näkee viestin ja
  muutokset ja valitsee jo olemassa oleville aineistoille, korvataanko ne paketin versiolla (oma versio tallennetaan
  kohtaan *Versiot*); muut ohitetaan. Hallitse-tilassa *Toiminnot* usealle valitulle aineistolle tekee saman.
- Kommentit: jokaisella aineistolla on Hallitse-tilassa välilehti *Kommentit*, ja Muokkaa-tilassa kommentoit saraketta
  tarkastelupaneelista. Kommentit ovat aineiston tiedostossa ja kulkevat mukana paketeissa, varmuuskopioissa,
  siirrettävässä kansiossa ja GitHubissa. Näytettävän nimen annat itse; se tallennetaan vain selaimeen.
- Koko työtila: varmuuskopio (ZIP) palautetaan Hallitse-tilassa toisella tietokoneella.
- Tietokoneiden välillä GitHubin kautta: välilehti *GitHub* lähettää työtilan GitHub-repositorioon (mieluiten
  yksityiseen) ja noutaa sen toisella tietokoneella. Se vaatii hienojakoisen käyttöoikeustunnuksen (fine-grained
  personal access token), joka saa vain lukea ja kirjoittaa juuri sen repositorion sisältöä. Tunnusta käytetään
  istunnon ajan tai se tallennetaan salattuna, eikä mitään lähetetä ennen kuin painat *Lähetä GitHubiin* tai *Nouda
  GitHubista*. Vain muuttuneet tiedostot lähetetään yhtenä committina viestisi kera; noudettaessa valitset, kuten
  paketeille, korvataanko olemassa olevat aineistot.
- Suoraan puhelimeen tai toiseen tietokoneeseen samassa verkossa: välilehti *Laitteet* näyttää QR-koodin, jonka
  puhelin skannaa; Dataspatium Mobiili vastaanottaa, näyttää ja jakaa edelleen (ks. [mobil.md](mobil.md)). Molemmat
  laitteet näyttävät saman tarkistuskoodin, ja parituksen jälkeen yksi skannaus riittää.
- Tietokoneen tai puhelimen jakovalikon kautta: välilehti *Jakovalikko* lähettää aineiston CSV-, Excel-, ODS- tai
  JSON-muodossa tai kaikki aineistot pakettina sähköpostiin, Teamsiin ja muihin sovelluksiin (Edge ja Chrome; Firefox
  tallentaa tiedoston).
- Tarkistus ensin: kun aineistoja paketoidaan tai lähetetään, sovellus etsii henkilötunnuksia, sähköposteja ja
  puhelinnumeroita ja antaa pseudonymisoida tai poistaa sarakkeet kopiosta.
- Valmiina verkkosivuna: välilehti *Julkaise* tekee kojelaudasta tai asiakirjasta itsenäisen HTML-tiedoston.
- Yksi aineisto: vie SQLite- (kaikki mukana) tai Parquet-muodossa Vie-tilassa.
- API-määritykset (`.api.json`), kaaviot ja asiakirjamallit (JSON) ja reseptit (JSON, R tai SQL) viedään ja ladataan
  tiedostoina. Avaimet eivät koskaan kulje mukana.

## Tekoälyavustaja

Tilarivin *Tekoälyavustaja* tai komentopaletin (Ctrl+K) *Tekoälyavustaja* avaa paneelin, jossa tekoäly tekee tehtäviä puolestasi
sovelluksen komennoilla kaikissa tiloissa. Se käyttää tekoälypalvelua, jonka olet lisännyt kohdassa *Palvelut*, joko
pilvipalvelua omalla avaimellasi tai paikallista mallia, ja siihen otetaan yhteys vasta, kun olet antanut suostumuksen palvelun
osoitteelle.

Kirjoita, mitä haluat tehdä, ja paina *Lähetä* (tai Ctrl+Enter). Tekoäly lukee ensin, esimerkiksi mitä aineistoja ja sarakkeita
on, ja valitsee seuraavan vaiheen sen mukaan, mitä se saa tietää. Vaiheet näkyvät paneelissa sitä mukaa kuin ne suoritetaan.

- Kaikki, mikä muuttaa jotakin, kuten Muokkaa-tilan toiminto, vienti tai R- tai Python-skripti, näytetään ensin omassa
  valintaikkunassaan komentoineen ja argumentteineen. Se suoritetaan vain, jos painat *Hyväksy*, ja sen voi perua jälkikäteen.
- Kun jatko riippuu siitä, mitä haluat, tekoäly kysyy sinulta paneelissa ja tarjoaa muutaman vastausvaihtoehdon. Vastaus
  kysymykseen ei koskaan hyväksy mitään.
- Toistuvaan tehtävään tekoäly voi ehdottaa kokonaista työnkulkua, jonka tallennat painikkeella *Tallenna työnkuluksi*. Tehtävän
  jälkeen voit myös tallentaa hyväksytyt vaiheet työnkuluksi. Molemmat ajetaan sen jälkeen ilman tekoälyä kohdassa *Työnkulut ja
  seurannat*.
- Tekoäly vastaa sovelluksen kielellä. *Pysäytä* keskeyttää ennen seuraavaa vaihetta, ja *Uusi keskustelu* aloittaa alusta.

Se, mitä tekoäly lukee aineistoista, on dataa eikä koskaan ohjeita. Pilvipalveluun lähetetty tieto lähtee tietokoneelta, joten
valitse arkaluonteisiin tehtäviin paikallinen malli.

## Ohje sovelluksessa

Koko käsikirja on sovelluksessa: oikean yläkulman **?**-painike, **F1**-näppäin tai komentopaletin komento *Ohje*
avaa sen sen tilan luvusta, jossa olet. Vasemmalla on sisältö, sen yläpuolella hakukenttä, joka hakee kaikista
osioista, ja dokumenttien väliset linkit avautuvat käsikirjan sisällä. Dialogit, joissa on **?**-painike, avaavat
oikean osion suoraan. Käsikirja seuraa sovelluksen kieltä eikä tarvitse verkkoa; alareunassa ovat versio,
*Tarkista päivitykset* ja linkki GitHubin dokumentaatioon.

## Näppäimistö

Alt+1 … Alt+8 vaihtaa tilaa, Ctrl+K avaa komentopaletin ja F1 avaa käsikirjan. Paneelin ja työalueen välinen reuna voi saada kohdistuksen
Sarkaimella, ja sitä siirretään nuolinäppäimillä (Vaihto suuremmille askelille, Home ja End pienimmälle ja
suurimmalle leveydelle). Ensimmäinen Sarkain-painallus sivulla näyttää linkin *Siirry
sisältöön*, joka siirtää kohdistuksen tilanvalitsimen ja kohdepaneelin ohi. Kaiken voi tavoittaa Sarkaimella ja Enterillä;
valintaikkunat suljetaan Escillä. Taulukossa nuolinäppäimet siirtävät solusta toiseen ja Enter aloittaa muokkauksen.
Sovellus noudattaa järjestelmän asetusta vähennetystä liikkeestä.

Välilehtiä vaihdetaan vasemmalla ja oikealla nuolinäppäimellä sekä Home- ja End-näppäimillä. Kaikilla painikkeilla,
kentillä ja koodieditoreilla on nimi, jonka ruudunlukija lukee, valintaikkunat luetaan otsikkonsa kanssa, ja sivulla
on maamerkit tilanvalitsimelle, objektipaneelille, työalueelle ja tarkastimelle. Tekstin ja kenttien reunojen
kontrasti täyttää WCAG AA -tason sekä vaaleassa että tummassa teemassa. Vega kuvaa kaaviorakentajan kaaviot
ruudunlukijoille; R-kaavioiden ja D3-mallien luvut löytyvät Muokkaa-tilan taulukosta.

## Kieli

Käyttöliittymä on saatavilla ruotsiksi, tanskaksi, norjaksi (bokmål ja nynorsk), suomeksi, islanniksi ja englanniksi. Kun sovellus
avataan ensimmäisen kerran, valitset kielen; oikean yläkulman kielipainike (tai paletin komento *Kieli*) vaihtaa sen
myöhemmin. Valinta tallennetaan selaimeen, joten jokaisella tietokoneella ja selainprofiililla on omansa. Käyttöliittymän
luvut noudattavat kielen käytäntöjä; itse dataa ei koskaan muuteta. R:n viestit seuraavat samaa valintaa, kun taas mallien
paikkamerkit kuten `{{datamangd}}` ja taulukon avainsanat `kolumner`, `sortera`, `topp`, `filter` ja `rubrik` ovat osa
mallikieltä ja samat kaikilla kielillä. Dokumentaatio on saatavilla kaikilla seitsemällä kielellä kansiossa `docs/` (ruotsi
kansiossa `docs/`, muut kansioissa `docs/<kieli>/`).

## Kun jokin menee pieleen

Lue alareunan loki: korjattavissa olevat virheet kuvataan omalla kielelläsi ehdotuksineen. Jos R jumittuu, käytä toimintoa
*Käynnistä R uudelleen*; aineistot eivät muutu. Tee varmuuskopio ennen selaimen tietojen tyhjentämistä. Virheistä
ilmoitetaan issueina GitHubissa, ks. [CONTRIBUTING.md](../../CONTRIBUTING.md).
