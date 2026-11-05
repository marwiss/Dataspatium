# Kahdeksan tilaa

Dataspatium on jaettu kahdeksaan tilaan, jotka seuraavat työn kulkua tilastotuotannon hengessä: kerää, käsittele,
analysoi ja julkaise: Nouda, Hallitse, Hae, Muokkaa, Analysoi, Visualisoi, Vie, Jaa. Kaikilla tiloilla on sama
runko: tilanvalitsin ylhäällä, kohdepaneeli vasemmalla (paneeliotsikkona tilan oma nimi: Lähteet Nouda-tilassa, Aineistot muissa), työalue keskellä, tarkastelupaneeli oikealla ja tilarivi
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

Muutat lokipaneelin korkeutta vetämällä sen yläreunasta tai nuolinäppäimillä, kun reuna on kohdistettu. Kaksoisnapsautus palauttaa korkeuden, ja korkeus tallennetaan.

## Nouda

Tänne data tulee: alueelle pudotetut tiedostot, liitetty teksti, verkko-osoitteet ja avoimet rajapinnat. Tiedostojen
tuonti etenee vaiheittain: tiedosto, asetukset esikatselulla, sarakkeet tyyppeineen, valmis. Muodot: CSV ja muu
erotinmerkein jaettu teksti, kiinteälevyinen teksti, Excel, ODS, JSON (myös JSON-stat ja GeoJSON), XML, SQLite,
GeoPackage, shapefile sekä R:n kautta SPSS, Stata, SAS, PX, Parquet, RDS ja RData (ks. [format.md](format.md));
R-muodot tuodaan yhdessä vaiheessa ilman esikatselua. Vasemmassa sarakkeessa, jonka paneeliotsikko on *Lähteet*, on neljä ryhmää. *Tavalliset lähteet*: Tiedostot, Liitä ja Verkko-osoitteesta. *Lisää lähteitä*: Tietokanta sillan kautta, Avoimet rajapinnat, API tiedostosta, Tietokantalähde, OpenCDE, Neo4j ja Paikkatietolähde. *Lisätyt lähteet*: se, mitä olet lisännyt, jokaisella rivillä poistopainike; alusta alkaen siellä ovat SCB:n ja Boverketin avoimet rajapinnat. *Muut lähteet*: Tallennetut haut, Keruu maastossa ja Oppaat. *Avoimet rajapinnat* näyttää työtilassa luettelon, jossa ovat valmiit asetukset
Tilastokeskukselle, THL:lle ja muille Pohjoismaiden tilastovirastoille ja viranomaisille, SCB:lle (selaa aihepuuta
tai hae taulukkoa), Eurostatille, Nordic Statisticsille ja muille, sekä avaimia vaativille lähteille, maapainikkeilla ja haulla. *Lisää* siirtää esiasetuksen kohtaan Lisätyt lähteet ja avaa sen; jos poistat sen sieltä, se palaa luetteloon ja voidaan lisätä uudelleen. Omat määritykset lisätään kohdasta *API tiedostosta*, ja niitä voi jakaa; poistettu oma lähde poistetaan tallennettujen avaintensa kanssa. *Tallennetut haut* luettelee rajapinnasta tulleet aineistot ja päivittää ne yhdellä
napsautuksella, yksi kerrallaan tai kaikki. Kun sovelluksen pitää ensimmäisen kerran ottaa yhteys internetiin jotakin
tarkoitusta varten (rajapinnat, verkko-osoitteet, GitHub, komponentit), se kysyy lupaa; vastauksen voi tallentaa.
Ks. [api-konfiguration.md](api-konfiguration.md).

*Tietokanta sillan kautta* avaa siltanäkymän (Access, Excel, SQL Server, SQLite ja
ODBC-lähteet tietokoneella pienen paikallisen skriptin kautta); jokainen yhdistämäsi tietokanta ilmestyy kohtaan Lisätyt lähteet ja avaa siltanäkymän uudelleen kyseinen tietokanta valittuna. *Tietokantalähde* tekee lähteen osoitteesta ja avaimesta (PostgREST, OData,
GraphQL, CouchDB, ClickHouse, Elasticsearch, SPARQL, InfluxDB, Google Sheets ja Airtable HTTP:n yli; myös OpenCDE ja Neo4j, joilla on lisäksi omat valintansa luettelossa).
Access-tiedostot luetaan lisäksi suoraan tiedostoina, ja Chromessa ja Edgessä tiedoston voi linkittää niin, että
aineisto luetaan uudelleen levyltä. Ks. [kallor.md](kallor.md).

QGIS-projekteista (.qgs, .qgz) tulee karttanäkymiä: tasojärjestys, näkyvyys ja symbolit tulevat mukana, tasot yhdistetään samannimisiin aineistoihin ja projektin kanssa pudotetut datatiedostot tuodaan ensin (katso [kartor.md](kartor.md)).

*Paikkatietolähde* kohdassa Lisää lähteitä: WFS-, OGC API Features- tai ArcGIS-palvelusta tulee lähde, jonka
tasot noudetaan GeoJSONina ja avataan karttoina, ja lähde *Geodataportalen (sök geodata)* hakee Ruotsin kansallisesta
paikkatietoluettelosta ja lisää palveluja yhdellä napsautuksella. Valmiita paikkatietolähteitä on SCB:lle, SGU:lle,
Havs- och vattenmyndighetenille, Riksantikvarieämbetetille, Skogsstyrelsenille, Kartverketille, Tilastokeskukselle ja
SYKElle sekä Lantmäterietin paikkatietoalustalle avaimen haltijoille. Katso [kallor.md](kallor.md#avoin-paikkatieto).

Digitaaliset kaavat tuodaan kaavoina: ruotsalainen asemakaava kansallisen määrittelyn mukaan (GeoJSON) tai
Lantmäterietin viitekohteet, yleiskaava määrittelyn tai Boverketin ÖP-mallin mukaan (GeoPackage, valinta *Koko
yleiskaava kaavana*). Tiedosto tunnistetaan sisällöstä, kaavan tiedot näytetään ja kaava avautuu kaavakarttana
Muokkaa-tilassa Boverketin väreillä (katso [planer.md](planer.md)).

Verkot (solmujen ja särmien verkostot) tuodaan verkkoina GraphML-, GEXF-, solmu-särmä-JSON- tai Cypher-skriptitiedostoista;
tiedosto tunnistetaan sisällöstä, verkon tiedot näytetään ja verkko avautuu verkkonäkymänä Muokkaa-tilassa (katso
[grafer.md](grafer.md)). Kahdesta taulukosta tulee verkko painikkeella *Tee verkko taulukoista* Hallitse-tilassa.

IFC-rakennusmalleista ja DXF-piirustuksista tulee malli-tyyppisiä aineistoja. Tiedoston tiedot näytetään, ja malli avautuu 3D:nä tai
piirustuksena Muokkaa-tilassa (katso [cad-bim.md](cad-bim.md)).

**Keruu maastossa** lähdeluettelossa rakentaa lomakkeen aineiston sarakkeista ja säännöistä ja lähettää sen puhelimeen. Rivit palaavat uutena
versiona (katso [insamling.md](insamling.md)).

Kaikki luettelon lähteet näyttävät samalta: tyypin symboli ja rivi nimen alla.

**Sovellus kertoo ensin, mikä tiedosto on**, esimerkiksi paikkoja sisältävä taulukko, graafi tai rakennusmalli, ja näyttää sen omassa muodossaan: kartan, kuvat, luonnoksen graafista, piirustuksen tai ensimmäisen sivun. Jos jotakin kannattaa kysyä, se kysyy: koordinaatit, jotka näyttävät vaihtaneen paikkaa, missä koordinaatistossa ne ovat ja luetaanko yhteyksien lista graafina. Mikään ei muutu ennen kuin vastaat, ja kartta näyttää vastauksen vaikutuksen.

**Useat erilaiset tiedostot** lajitellaan sen mukaan, mitä ne ovat: kuvista tulee yksi kokoelma, asiakirjoista toinen ja muista tiedostoista kustakin oma aineisto. Näet listan ensin ja voit jättää jotakin pois. Voit myös pudottaa kokonaisen kansion tai valita sen kohdasta *Valitse kansio*. Tiedosto, jota ei voi lukea, ei estä muita.

**Oppaat.** Kohdassa Oppaat on neljä lyhyttä tietä kysymyksestä tulokseen oikealla datalla: vertaa kuntia Koladan kautta, väestöpyramidi SCB:n kautta, sää pitkällä aikavälillä SMHI:n kautta ja hintakehitys Euroopan keskuspankin kautta. Opas hakee, siistii ja tallentaa kaavion. Saat taulukon, kaavion ja vaiheet, joiden päälle rakentaa. Se hakee verkosta vain, kun painat *Suorita opas*.

**Datapaketit.** ZIP-tiedosto, jossa on `datapackage.json` (Frictionless Data Package), luetaan skeeman tyypeillä ja otsikoilla, ja jokaisesta taulukosta tulee aineisto.

**Tiedostot CDE:stä.** OpenCDE-lähde luettelee projektin mallit ja asiakirjat, ja *Hae* tekee tiedoston omaa lajia olevan aineiston, joka muistaa alkuperänsä. Katso [kallor.md](kallor.md).

**BCF-tiedostot.** BCF-tiedostosta (bcf, bcfzip) tulee asiataulukko, ja kommentit ja komponentit sen viereen. Katso [format.md](format.md).

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

Asiakirja- tai kuvakokoelma näytetään asiakirjojen ja sivujen tai kuvien määrällä, yleiskatsausvälilehdellä
asiakirjaluettelona tai ensimmäisinä pienoiskuvina, ja painikkeella *Lue* tai *Näytä kuvat*, joka avaa lukunäkymän
tai gallerian Muokkaa-tilassa (katso [dokument.md](dokument.md)).

**Työnkulut ja seurannat** ovat objektipaneelissa: tallennetut ketjut, jotka ajetaan yhdellä napsautuksella tai käynnistyksessä, ja
lähteet, jotka kertovat uusista tiedoista (katso [floden.md](floden.md)).

**Mitä sovellus näkee.** Yleisnäkymä näyttää, miten aineistoa voi käyttää myös: paikkoja kartalla, aikasarjana, väritettävinä alueina, verkostona tai juoksevana tekstinä. Jokainen rivi kertoo syyn, ja voit poistaa käytöstä sen, mikä ei pidä paikkaansa, tai ottaa käyttöön sen, minkä sovellus jätti huomaamatta. Valinta tallennetaan aineistoon, ja tilat seuraavat sitä. Sen alla **Tarkistettavaa** kertoo, mitä aineiston laji tarvitsee: sivuja ilman tekstiä, kuvia ilman sijaintia, särmiä, jotka osoittavat olemattomiin solmuihin, elementtejä ilman määriä tai rivejä ilman paikkaa.

**Valinta.** Painike *Käytä valintana* on Hae-tilassa ja Muokkaa-tilan näkymissä. Näkemäsi seuraa sen jälkeen tilasta toiseen ja näkyy tilarivillä. Muokkaa-tilassa näytät sen listavalinnasta, Vie-tilassa valitset, viedäänkö vain valinta, ja paketeissa voit lähettää vain valinnan. Tilariviltä tallennat sen listana, teet siitä aineiston tai tyhjennät sen. Jos aineiston rivit muuttuvat, valinta häviää, koska se ei enää tarkoittaisi samaa.

**Kuva.** Yleiskuva näyttää kuvan aineistosta: ensimmäisen sivun, kartan paikoista, luonnoksen graafista, piirustuksen, mallin osat tai viivan ajan yli. Tavallisella taulukolla ei ole kuvaa.

**Useat aineistot.** Jos olet valinnut useita, kohta *Näitä ne voivat tehdä yhdessä* näyttää, mikä on mahdollista: sama kartta, kun kaikilla on paikkoja, yksi taulukko, kun kaikilla on samat sarakkeet, ja yksi kokoelma, kun kaikki ovat kuvia tai kaikki ovat asiakirjoja. Valitut eivät muutu. Viennissä kukin saa oman muotonsa, esimerkiksi kuvat ZIP-tiedostona ja graafit GraphML-muodossa.

**Versiot** kertovat sisältönsä aineiston omissa yksiköissä, ja vertailu näyttää, mitkä kuvat, asiakirjat, solmut, särmät tai elementit ovat tulleet ja poistuneet.

**Koodiluettelot.** Sarakkeet, joissa on koodeja tunnetusta luettelosta, näytetään yleiskuvassa: SNI, SSYK, NACE, ISCED, COFOG, NUTS, pohjoismaiset vastineet, maat ja kunnat. Napsautus lisää nimet arvonimikkeiksi, eivätkä arvot muutu. Lyhyt koodi lasketaan vain, kun sarakkeen nimi täsmää. Luettelot tulevat sovelluksen mukana, ja niiden lähteet ja lisenssit ovat tiedostossa `presets/kodlistor/KALLA.md`.

**Kuvaus.** Välilehdellä Kuvaus on se, mitä dataportaali haluaa tietää DCAT-AP-SE:n mukaan: otsikko, julkaisija, yhteystieto, teema, lisenssi ja ajanjakso. Kuvaus seuraa aineistoa, kertoo mitä puuttuu, ja sen voi tallentaa RDF/XML-muodossa tai lukea sellaisesta tiedostosta. Täältä ei lähetetä mitään.

**Alkuperä.** Alkuperä-välilehti näyttää, mistä aineisto on peräisin ja mitä siitä on tullut: lähteen, aineistot, joista se on tehty, reseptin ja versiot sekä aineistot, kaaviot, koontinäytöt, asiakirjat, muistikirjat, luettelot, työnkulut ja jaot, jotka perustuvat siihen. Napsautus avaa kohteen, ja *Lataa tekstinä* antaa saman raporttiin lisättäväksi.

**Kirjasto.** Kirjastossa on valmiita reseptejä, malleja, skriptejä ja muistikirjoja, kullakin oma lisenssinsä. Näet, mitä kohde tekee, ennen kuin lisäät sen. Lisää kirjastoja haetaan verkko-osoitteesta, ja *Tallenna omat kirjastotiedostona* tekee tiedoston omista töistäsi GitHub-repoon tai minne tahansa.

**CDE:stä.** OpenCDE-palvelimelta haettu aineisto näyttää palvelimen, projektin ja version, voi kysyä uudempaa versiota ja avata mallin asiat.

**Asiat.** CDE:stä tulleiden asioiden taulukko saa kortin Asiat: tilanne tilan mukaan, koontinäyttö Asioiden tila ja tie malliin. Katso [cad-bim.md](cad-bim.md).

## Hae

Löydä ja listaa ilman koodia. Välilehti *Hae* hakee kaikista sarakkeista yhdessä tai kaikissa aineistoissa; jokaisen
sanan on löydyttävä riviltä kirjainkoosta riippumatta. Osumat näytetään aineistoittain lukumäärineen, fasetteineen
(yleisimmät arvot sarakkeissa, joissa on vähän eri arvoja ja jotka rajaavat hakua yhdellä napsautuksella) ja
taulukkona, jossa rivi avaa koko tietueen tarkastelupaneeliin. Haun voi tallentaa listaksi, siitä voi tehdä uuden
aineiston tai sen voi avata Muokkaa-tilassa. Välilehti *Kysely* rakentaa kyselyn yhdelle tai useammalle aineistolle
(sarakkeet, laskennat, ehdot, lajittelu) ilman koodia ja näyttää luomansa SQL:n; sen voi avata Analysoi-tilassa,
tallentaa listaksi tai tehdä siitä aineiston. Välilehti *Listat* kokoaa tallennetut haut ja kyselyt aineistoittain ja
suorittaa ne uudelleen tämän päivän datalla; listat rajaavat myös Muokkaa-tilan taulukon ja kaavioiden rivit. Ks.
[soka.md](soka.md).

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

Asiakirjakokoelmat (PDF, Word, OpenDocument, Markdown, teksti) avautuvat lukunäkymänä: valitse asiakirja, selaa
sivu kerrallaan, näytä PDF-sivu kuvana, hae koko kokoelmasta ja lataa alkuperäinen. Kuvakokoelmat avautuvat
galleriana, jossa on pienoiskuvat, suodatin, järjestys ja kuvan EXIF-tiedot tarkastelupaneelissa, jossa kuvausta voi
muokata. *Näytä taulukkona* antaa molemmissa tapauksissa tavallisen taulukon kaikilla toiminnoilla. Katso
[dokument.md](dokument.md).

Aineistot, joissa on geometria tai koordinaatit, avautuvat **karttana**, jota voi lähentää ja panoroida; kohteen napsautus näyttää ominaisuudet, taustakartta suostumuksen jälkeen, *Tallenna karttanäkymänä* Visualisoi-tilaan. *Näytä taulukkona* antaa taulukon (katso [kartor.md](kartor.md)).

Hae-tilasta tehty valinta merkitään 3D-malliin, ja kamera kääntyy sitä kohti.

**Tekstin lukeminen kuvista.** Skannatun PDF:n sivut ja gallerian kuvat voi lukea tekstintunnistuksella, joka toimii selaimessa. Katso [dokument.md](dokument.md).

**Asiat.** Mallinäkymä näyttää projektin BCF-asiat CDE:stä ja merkitsee rakennusosat, joihin ne osoittavat. Katso [cad-bim.md](cad-bim.md).

**Asioiden kirjoittaminen.** Mallinäkymä luo asioita valinnasta näkymällä viewpointina, kommentoi ja vaihtaa tilan sekä tallentaa projektin asiat BCF-tiedostona. Katso [cad-bim.md](cad-bim.md).

## Analysoi

Koodi ja tilastot. Työkalut ovat kiinteässä järjestyksessä: R, Python, SQL, Regex ja viimeisenä muistikirja, joka kokoaa osia
muista. Python-konsolissa on pandas, matplotlib, seaborn ja plotly, ja se haetaan komponenttina, kun käynnistät sen ensimmäisen kerran
(ks. [python.md](python.md)). R-konsolissa on ggplot2, dplyr, tidyr ja muita paketteja,
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

Kun asiakirjakokoelma on valittu, näkyy välilehti **Teksti** (sanafrekvenssi hukkasanoineen, avainsanat
kontekstissa, yhteisesiintymät ja yleiskatsaus asiakirjaa kohti), ja kun kuvakokoelma on valittu, välilehti **Kuvat**
(yleiskatsaus tyypin, kameran, vuoden tai kuukauden mukaan sekä kaksoiskappaleet kuvatiivisteen avulla). Molemmat
ovat Regexin jälkeen ja ennen Muistikirjaa, ja jokaisen tuloksen voi tallentaa uudeksi aineistoksi. Katso
[dokument.md](dokument.md).

Geometrian sisältäville aineistoille on välilehti **Geo** (Regexin jälkeen): mitat, pisteet alueissa, lähin, puskuri, päällekkäisyys, yhdistäminen ja yksinkertaistus Turfilla selaimessa; tuloksista tulee aineistoja, jotka avautuvat karttoina.

Verkot saavat välilehden **Cypher** heti SQL:n jälkeen (Cypher-osajoukko käännettynä SQL:ksi, SQL näytetään) ja välilehden
**Verkko** Regexin jälkeen (yhteenveto, aste, komponentit, lyhin polku, aliverkko, solmut ja särmät taulukkoina).

Välilehti **Tilastot** Regexin jälkeen tekee tavallisia analyyseja lomakkeilla, jotka kirjoittavat ja näyttävät koodin (katso [statistik.md](statistik.md)).

Mallit ja piirustukset saavat välilehden **Määrät** Regexin jälkeen (lukumäärä, pituus, pinta-ala ja tilavuus tyypeittäin, kerroksittain
ja materiaaleittain, tiedostosta tai geometriasta mitattuna).

Analysoi avautuu aineistoon sopivassa työkalussa: Teksti asiakirjoille, Kuvat kuvakokoelmille, Graafi graafeille, Määrät malleille, Kaava kaavoille, Geo paikkoja sisältäville taulukoille ja muuten Tilastot. Kun valitset välilehden itse, pysyt siinä. R käynnistyy vasta, kun avaat R-välilehden.

**Aloituskoodi.** R:ssä, Pythonissa ja SQL:ssä on lista valitulle aineistolle kirjoitettua koodia: graafin särmät, mallin määrät, kuvat kuukausittain, summa jaksoittain tai paikat pisteinä. Valinta liittää koodin kohdistimen kohdalle. Uusi muistikirja alkaa samalla tavalla. SQL:ssä näytetään sivutaulukot sarakkeineen, ja napsautus kirjoittaa kyselyn taulukosta.

**Trendi.** Tilastoissa on työkalu *Trendi*, joka antaa yhden arvon jaksoa kohden ja suoran niiden läpi ja kertoo, kuinka paljon arvo muuttuu jaksoa kohden. Aikasarjana oleva aineisto avautuu siihen.

**Laske alueittain.** Geo-kohdan *Pisteet alueissa* laskee paikat alueittain, pinta-alan ja neliökilometrikohtaisen määrän kanssa. Paikat voivat olla kuvia, joissa on sijainti, ja alueet voivat olla kaava, muotoja sisältävä taulukko tai sovelluksen mukana tulevat kunta- ja maakuntarajat.

**Asiat.** Määrät-välilehden työkalu Asiat laskee asiat ja rakennusosat tilan, tyypin, rakennusosatyypin tai kerroksen mukaan. Katso [cad-bim.md](cad-bim.md).

## Visualisoi

Kaavioita kolmella moottorilla ja yhdellä ilmeellä: kaaviorakentaja (Vega-Lite) pylväillä, viivoilla, alueilla,
pisteillä, histogrammeilla, lämpökartoilla, laatikkokuvioilla, ympyröillä ja kartoilla (teemakartat GeoJSON- tai
shapefile-datasta); D3-mallit sijoituksille, kaltevuuskaavioille ja väestöpyramideille; ja R-skriptit ggplot2:lla.
Tallennetut kaaviot voi viedä SVG-, PNG-, PDF- ja PowerPoint-muotoon, jakaa viz-tiedostoina, näyttää galleriassa ja
luoda eräajona ryhmittäin. Kojelaudat kokoavat tallennetut kaaviot ruudukkoon yhteisillä suodattimilla, ja ne viedään
HTML- tai PowerPoint-muotoon. Ks. [visualisera.md](visualisera.md).

Kaaviolaji **Kartta** on karttanäkymä, jossa on useita tasoja aineistoista, joissa on geometria tai koordinaatit, sekä mukana tulevat rajat, väri luokan tai luokkavälin mukaan, nimiöt, tallennettu näkymä ja taustakartta suostumuksen jälkeen; vuorovaikutteinen koontinäytöissä, esityksissä ja julkaistussa HTML:ssä, vietynä SVG-, PNG- ja PDF-muotoon ilman taustakarttaa (katso [kartor.md](kartor.md)).

**Asioiden tila.** Koontinäyttö Asioiden tila luodaan asiataulukosta, ja mallikaavio voi kantaa värit asian tilan mukaan. Katso [cad-bim.md](cad-bim.md).

## Vie

Tiedostoja omalle tietokoneelle, kolmessa välilehdessä. **Data**: CSV (Excel-sovitettu tai vakio), Excel, ODS, JSON,
XML, SQLite sekä R:n kautta Parquet, SPSS, Stata ja RDS. **Kaaviot**: tallennetut kaaviot ja kojelaudat (myös kaikki
kaaviot yhtenä PowerPointina) SVG-, PNG- ja PDF-muodossa, yksittäin tai eräajona ryhmittäin ZIP-tiedostoon.
**Asiakirjat**: raportteja, koodikirjoja ja koosteita Markdown-malleista paikkamerkein, HTML-, Word-, PDF-,
Markdown- tai LaTeX-muodossa, yksittäin tai eräajona ryhmittäin (ks. [dokumentmallar.md](dokumentmallar.md)). Se,
mikä on tarkoitettu muille ihmisille, on Jaa-tilassa.

Aineisto, joka on enemmän kuin taulukko, jakaa muodot ryhmiin **Koko aineisto** ja **Vain taulukko** ja kertoo, mikä ei tule mukaan. Asiakirjat saa alkuperäisinä tiedostoina tai pelkkänä tekstinä, kuvat ZIP-tiedostona ja graafit kahtena CSV-tiedostona.

**Aineiston lajin mukaan.** Paikkoja sisältävät taulukot voi tallentaa KML-, GPX- ja GeoPackage-muodossa, asteina. GPX:ssä pisteistä tulee reittipisteitä, ja viivoista ja alueiden ääriviivoista tulee jälkiä. Kuvakokoelmista voi tehdä kontaktiarkin PDF-muodossa kuvineen ja nimineen. Kaavasta voi tehdä kaavakartan PDF-muodossa selitteineen, kaavamääräykset Wordissa ja alkuperäisen tiedoston, jos kaava tuli tiedostosta. IFC-malli voi antaa määrät Excelissä, summat tyypeittäin ja kaikki arvot, ja geometrian glTF-muodossa. DXF-piirustuksesta voi tehdä PDF:n. Jos viet useita aineistoja Hallitse-tilassa, kukin saa oman muotonsa.

**Eräajo kerroksittain tai asiakirjoittain.** Eräajo ryhmittäin toimii millä tahansa sarakkeella. Malli jaetaan sarakkeen `vaning` mukaan, ja mallin kuva näyttää silloin vain sen kerroksen. Asiakirja jaetaan sarakkeen `dokument` mukaan.

**Muut työkalut.** *Datapaketti* antaa ZIP-tiedoston, jossa on CSV-tiedostoja ja `datapackage.json`, jonka moni työkalu osaa lukea. Graafin särmät ja mallin ominaisuudet seuraavat omina taulukoinaan. *Laatuseloste* antaa Word-asiakirjan SCB:n käyttämässä muodossa, täytettynä profiilista, säännöistä, kommenteista, muutoksista ja kuvauksesta, ja siinä on paikkoja sille, minkä vain ihminen voi sanoa.

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

**CDE:hen.** Aineisto tai sen alkuperäinen tiedosto projektiin OpenCDE-palvelimella, Documents API:n kautta tai BCF-asiakirjana. Katso [dela.md](dela.md).

**Työtilapaketti CDE:n kautta.** Välilehti CDE:hen lähettää paketin asiakirjana; vastaanottaja ottaa sen vastaan lähteen tiedostoluettelosta. Katso [dela.md](dela.md).
