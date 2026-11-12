# Kartat

Aineisto, jossa on geometria tai koordinaatit, on kartta. Muokkaa-tilassa se avautuu karttana, jota voi lähentää ja
panoroida, Visualisoi-tilassa siitä tulee tallennettu **karttanäkymä** useine tasoineen koontinäyttöihin,
esityksiin ja julkaisuun, ja Analysoi-tilassa on välilehti **Geo**, jossa on paikkatietotyökaluja ilman koodia.
Kartat piirretään Leafletilla; geometria lasketaan Turfilla. Verkosta ei noudeta mitään, ennen kuin valitset
taustakartan ja annat suostumuksesi.

## Mikä on paikkatietoa

| Paikkatieto | Tunnistetaan |
|---|---|
| Geometriasarake | Tekstisarake, jossa on GeoJSON tai WKT, yleensä `geometry` (GeoJSON-, Shapefile-, GeoPackage-, KML-, GPX- ja TopoJSON-tuonnit tuottavat sen) |
| Koordinaattisarakkeet | Kaksi lukusaraketta pituus- ja leveysasteelle (`lon`/`lat`, `longitude`/`latitude`, `x`/`y` ja muut) |
| Projisoidut koordinaatit | Muunnetaan WGS 84:ksi tiedoston koordinaattijärjestelmällä tai SWEREF 99 TM:nä, jos tiedosto ei ilmoita järjestelmää (katso [Koordinaattijärjestelmät](#koordinaattijärjestelmät)) |

Aineistot, joissa on geometriasarake tai sarakkeet nimeltä pituus- ja leveysaste, avautuvat karttana suoraan; muille
koordinaattisarakkeille (esimerkiksi `x` ja `y`) valitse *Näytä karttana* taulukon työkalupalkista.

Paikkatietoa voi noutaa myös suoraan avoimista palveluista: *Lisää paikkatietolähde* Nouda-tilassa tekee lähteen WFS-,
OGC API Features- tai ArcGIS-palvelusta, ja lähde *Geodataportalen* hakee palveluja Ruotsin kansallisesta luettelosta.
Vastaukset saavat geometriasarakkeen ja avautuvat karttoina. Katso [kallor.md](kallor.md#avoin-paikkatieto).

Nimet eivät riitä. Sovellus tarkistaa myös arvot: geometriasarakkeessa on oltava geometria, ja koordinaattien on oltava asteina tai projisoidussa järjestelmässä. Pelkästään x- ja y-nimiset sarakkeet lasketaan koordinaateiksi, kun arvot ovat projisoituja, koska pienet luvut näillä nimillä ovat yleensä jotain muuta. Koordinaatteja sisältävän taulukon voi viedä GeoJSON-pisteinä.

Jos koordinaatit ovat muussa koordinaatistossa kuin SWEREF 99 TM, valitset sen tuonnin yhteydessä, esimerkiksi RT 90:n tai UTM-vyöhykkeen. Sovellus lisää silloin sarakkeet asteina ja säilyttää alkuperäiset.

## Kartta Muokkaa-tilassa

Kartta näyttää aineiston kohteet sovelluksen värillä. Lähennä rullalla tai painikkeilla, panoroi vetämällä (mittakaavajana vasemmassa alakulmassa näyttää etäisyyden metreinä) ja
napsauta kohdetta, niin tarkastelupaneeli näyttää sen ominaisuudet; *Muokkaa taulukossa* vie riville taulukossa.
Työkalupalkissa ovat taustakartta (ei mitään, OpenStreetMap tai [ortokuva](#ortokuvat)), *Sovita kaikki*, *Tallenna karttanäkymänä*
(tallentaa kartan tasoineen ja nykyisine näkymineen kaaviona Visualisoi-tilaan) ja *Näytä taulukkona*. Kaikki, mitä
teet taulukossa (suodatat, korjaat, poistat rivejä), näkyy kartalla.

Suuret aineistot piirretään canvasille; 10 000 polygonia panoroituu nykimättä. Yli 50 000 kohdetta tasoa kohti ei
piirretä (rajaa voi nostaa tasoa kohti karttanäkymässä).

Kuvakokoelmissa, joissa on sijainteja, on painike *Näytä kartalla*. Napsauta paikkaa, niin tarkastelija näyttää kuvan. Taulukko, jonka rivit nimeävät kuvia, näyttää ne samalla tavalla. *Käytä näkyvää* tekee siitä, mitä kartta juuri nyt näyttää, valinnan, joka seuraa muihin tiloihin. Karttanäkymässä Visualisoi-tilassa kuvakokoelmat ja kaavat voivat olla tasoja.

## Karttanäkymät Visualisoi-tilassa

*Uusi kaavio → Kartta* luo karttanäkymän, jonka ensimmäinen taso on valittu aineisto. Asetukset vasemmalla:

- **Taustakartta**: ei mitään (oletus), OpenStreetMap, [ortokuva](#ortokuvat) tai oma karttapalvelin osoitemallilla, kuten
  `https://…/{z}/{x}/{y}.png`, ja lähdetekstillä, tai **WMS-palvelu** (osoite, tasot, kuvamuoto ja läpinäkyvyys; *Lue tasot* hakee palvelun
  tasoluettelon). Taustakartat noudetaan verkosta, ja ensimmäisellä kerralla kysytään
  suostumus (tarkoitus *Taustakartat* kohdassa Hallitse → Internet-yhteys).
- **Tasot**: lisää aineistoja tai mukana tulevat rajat (Ruotsin, Tanskan, Norjan ja Suomen maakunnat ja kunnat)
  tai **WMS-taso** (karttapalvelun kuvia, jotka piirretään kohteiden alle valitulla peittävyydellä; sillä ei ole selitettä
  eikä se tule mukaan SVG-, PNG- ja PDF-vientiin). Jokaisella tasolla on nimi, näkyvyys, järjestys, väri, täyttö, viivan leveys ja pisteen koko, geometria- tai
  koordinaattisarakkeet, väri sarakkeen mukaan (luokat sovelluksen paletilla tai luokkavälit sekventiaalisella
  asteikolla, luokkien määrä), nimiö (näkyy, kun osoitin on kohteen päällä) ja kohteiden enimmäismäärä.
- **Näkymä**: *Tallenna nykyinen näkymä* lukitsee kartan keskipisteen ja zoomin; muuten kartta sovitetaan tasoihin.
  Selitettä ja korkeutta voi muuttaa.

Tarkastelupaneeli näyttää selitteen ja napsauttamasi kohteen. Karttanäkymä viedään SVG-, PNG- ja PDF-muotoon, ajetaan
eräajona ryhmää kohti, muuttuu PowerPointiksi ja voidaan sijoittaa asiakirjamalleihin tunnisteella
`{{diagram "Nimi"}}`. Vienti piirtää tasot ilman taustakarttaa. Koontinäytöissä, esityksissä ja julkaistussa
HTML:ssä kartta on vuorovaikutteinen; julkaistuun HTML:ään upotetaan Leaflet ja kohteet GeoJSON-muodossa, ja
taustakartan noutaa silloin lukijan selain.

## Ortokuvat

Ortokuva on ilmakuva, joka on oikaistu niin, että se asettuu kuin kartta. Neljä avointa ortokuvaa on taustakartan valinnassa
Muokkaa-tilan kartassa, Visualisoi-tilan karttanäkymissä, kaavakartalla ja uuden rakennuksen paikan alla (katso [cad-bim.md](cad-bim.md)):

| Ortokuva | Julkaisija ja palvelu | Koordinaattijärjestelmät | Lisenssi ja lähdemaininta | Avain |
|---|---|---|---|---|
| Tanska: GeoDanmark ortofoto forår | Klimadatastyrelsen, WMS osoitteessa `wms.datafordeler.dk` | Web Mercator, ETRS89 / UTM 32N (25832) | CC BY 4.0, "GeoDanmark ortofoto forår © Klimadatastyrelsen" | Maksuton API-avain Datafordelerenilta: luo käyttäjä sähköpostiosoitteella osoitteessa portal.datafordeler.dk ja sitten API-avain (voimassa kaksi vuotta) |
| Suomi: Ortokuva | Maanmittauslaitos, WMTS osoitteessa `avoin-karttakuva.maanmittauslaitos.fi` | Web Mercator | CC BY 4.0, "Ortokuva © Maanmittauslaitos" | Maksuton API-avain Maanmittauslaitokselta: luo tili Oma tili -palveluun (omatili.maanmittauslaitos.fi) ja sitten uusi API-avain |
| Islanti: Grunnkort – Loftmynd | Náttúrufræðistofnun, WMS osoitteessa `gis.natt.is` | Web Mercator, ISN93 (3057) | CC BY 4.0, "Grunnkort – Loftmynd © Náttúrufræðistofnun" | Ei tarvita |
| Ruotsi: Ortofoto (STAC) | Lantmäteriet, pilvioptimoidut GeoTIFF-tiedostot STAC-luettelossa osoitteessa `api.lantmateriet.se/stac-bild`, tiedostot osoitteessa `dl1.lantmateriet.se` | Web Mercator (muunnettuna), SWEREF 99 TM (3006) | CC BY 4.0, "Ortofoto © Lantmäteriet (vuosi)", käsitelty karttaa varten | Kuluttaja-avain ja kuluttajasalaisuus maksuttomalta Geotorget-tililtä (geotorget.lantmateriet.se), jolla Ortofoto Nedladdning on tilattu; sama avain kuin korkeusmallissa |

- Lähdemaininta ja lisenssi näkyvät kartan kulmassa niin kauan kuin ortokuva on näkyvissä.
- Kuvat haetaan vasta, kun valitset ortokuvan, *Taustakartat*-suostumuksen jälkeen; kysymys nimeää palvelun palvelimen.
- Jos ortokuva vaatii avaimen, sovellus kysyy sitä, kun valitset kuvan. Avain on voimassa istunnon ajan tai tallennetaan salattuna
  tunnuslauseella kuten sovelluksen muut avaimet, lähetetään vain omaan palveluunsa kuvien osoitteissa eikä sitä koskaan tallenneta
  karttanäkymään. Julkaistu HTML ottaa mukaan vain ortokuvat, jotka eivät vaadi avainta.
- Kaavakartalla kaavan omassa koordinaattijärjestelmässä ovat ne ortokuvat, joiden palvelu tarjoaa järjestelmän (Tanska UTM 32N:ssä,
  Islanti ISN93:ssa).
- Islannin mosaiikki ei vielä kata koko maata, ja sitä laajennetaan joka vuosi. Suomen avoin palvelu antaa kuvat zoomaustasolle 16 asti ja
  suurentaa niitä sen jälkeen.
- Norjalla ei ole avointa ortokuvapalvelua: Norge i bilder on avoin vain Norge digitalt -yhteistyön jäsenille. Ruotsilla ei ole avointa
  ruutupalvelua (Lantmäterietin Ortofoto Visning on lisenssimaksullinen), mutta Lantmäterietin ortokuvat ovat avointa dataa tiedostoina,
  ja sovellus lukee niitä näkymä kerrallaan (alla).

### Ruotsi: Lantmäterietin ortokuvat

- Valitse *Ortokuva – Lantmäteriet (STAC)*. Se on taustakartan valinnassa Muokkaa-tilan kartassa, Visualisoi-tilan karttanäkymissä,
  kaavakartalla (Web Mercatorissa tai SWEREF 99 TM:ssä) ja, kun paikka on Ruotsissa, uuden rakennuksen paikan alla.
- Sovellus hakee Lantmäterietin kuvaluettelosta (STAC, kokoelmat `orto-<alue>-<vuosi>`) uusimmat värikuvat sen alueen päältä, jonka
  kartta näyttää, ja lukee tiedostoista vain tarvittavan rajauksen. Tiedostot ovat 2,5 × 2,5 km:n ruutuja SWEREF 99 TM:ssä, 16 cm
  kuvapistettä kohden vuodesta 2019 (aiemmin 25 tai 50 cm); suurempi näkymä luetaan tiedoston karkeammalta yleiskuvatasolta. Missä uusin
  kuvauslento päättyy, seuraavaksi uusin täydentää.
- Kuva koskee näkymää, jolle haet sen, enintään 1 km² (uuden rakennuksen paikalle paikka ja 250 m sen ympäriltä). Sen pisin sivu on
  enintään 2 048 kuvapistettä eikä koskaan tiedostoa tarkempi. Kun siirrät karttaa, painike *Hae ortokuva näkymälle* hakee kuvan uudelle
  näkymälle; samaan näkymään uudelleen piirretty kartta käyttää jo haettua kuvaa. Suuremmasta näkymästä tulee kehotus lähentää.
- Web Mercator -kartalla kuva muunnetaan SWEREF 99 TM:stä kuvapiste kuvapisteeltä, joten se on oikealla paikallaan (alle kuvapisteen
  virhe); SWEREF 99 TM -kaavakartalla se on kuten tiedostossa.
- Tiedostot vaativat avaimen: kuluttaja-avaimen ja kuluttajasalaisuuden maksuttomalta Geotorget-tililtä, jolla tuote Ortofoto
  Nedladdning on tilattu (Lantmäteriet käsittelee tilauksen, ja ehdot on hyväksyttävä). Se on sama avain, jota lähde *Lantmäteriet
  paikkatiedot avaimella (STAC)* ja korkeusmalli käyttävät; jos se puuttuu, sovellus kysyy sitä, kun valitset ortokuvan, ja antaa linkin
  Geotorgetiin. Avaimella sovellus hakee käyttötunnisteen osoitteesta `apimanager.lantmateriet.se`, ja tunniste lähetetään vain
  osoitteeseen `dl1.lantmateriet.se`. Haku luettelosta ei vaadi avainta.
- Mitään ei haeta, ennen kuin valitset ortokuvan tai painat painiketta. Silloin sovellus kysyy kerran suostumusta *API-hakuun* ja nimeää
  palvelimet. Tallennettu karttanäkymä ei hae mitään, kun se avataan; se näyttää painikkeen.
- Lähdemerkintä kartan kulmassa noudattaa Lantmäterietin ehtoja: "Ortofoto © Lantmäteriet (vuosi), käsitelty karttaa varten (CC BY
  4.0)". Kuva ei sisälly vientiin (SVG, PNG, PDF), tallennettuihin karttanäkymiin eikä julkaistuun HTML:ään.
- Tiedostot luetaan ruutu kerrallaan tauon kanssa, ja muunnos tehdään erissä, joten sivu ei jumitu; 1 km²:n näkymä vie muutaman
  sekunnin.

## Paikkatietotyökalut Analysoi-tilassa

Kun geometrian sisältävä aineisto on valittu, Analysoi saa välilehden **Geo** (Regexin jälkeen). Jokainen tulos on
taulukko, jossa on sarake `geometry`; sen voi tallentaa aineistoksi painikkeella *Luo aineisto* ja avata karttana.

| Työkalu | Mitä se tekee |
|---|---|
| Mitat | Pinta-ala (km²), pituus (km), keskipiste (pituus- ja leveysaste) ja laajuus jokaiselle kohteelle |
| Pisteet alueissa | Laskee pisteet aluetta kohti (ja summaa arvosarakkeen) tai antaa jokaiselle pisteelle alueen ominaisuudet |
| Lähin | Jokaiselle kohteelle lähin kohde toisessa aineistossa ja etäisyys kilometreinä |
| Puskuri | Vyöhykkeet valitulla etäisyydellä metreinä jokaisen kohteen ympärillä |
| Päällekkäisyys | Kahden alueaineiston leikkaus (yksi kohde jokaista päällekkäistä paria kohti molempien ominaisuuksineen ja yhteinen pinta-ala) tai erotus (se, mitä ensimmäisestä tasosta jää) |
| Yhdistäminen | Yhdistää alueet, joilla on sama arvo sarakkeessa (tai kaikki), yhdeksi kohteeksi lukumäärän ja pinta-alan kanssa |
| Yksinkertaistus | Yksinkertaistaa geometriat valitulla toleranssilla metreinä ja näyttää pisteiden määrän ennen ja jälkeen |

Työkalut toimivat selaimessa ilman verkkoa ja osissa, jotta sivu vastaa; hyvin suuret aineistot (kymmeniätuhansia
monimutkaisia polygoneja) vievät aikaa. Mitat ja koordinaattimuunnos ovat myös reseptivaiheina Muokkaa-tilassa
(ryhmä Paikkatieto).

## QGIS-projektit

Pudota projektitiedosto (`.qgs` tai `.qgz`) Nouda-tilaan, mieluiten datatiedostojen kanssa (GeoPackage, GeoJSON,
Shapefile ZIP-muodossa). Dataspatium lukee tasojen järjestyksen, näkyvyyden ja symbolit (yksi symboli, luokat tai
luokkavälit väreineen, viivanleveyksineen ja pistekokoineen) ja yhdistää jokaisen tason aineistoon, jolla on sama
tiedostonimi (ja GeoPackagessa tason nimi); puuttuvat mukana tulevat tiedostot tuodaan ensin. Tuloksena on
karttanäkymä Visualisoi-tilassa. Rasteritasoja, nimiöitä, tehosteita ja sääntöpohjaisia symboleja ensimmäisen säännön
jälkeen ei oteta mukaan.

## Koordinaattijärjestelmät

GeoPackage-tiedosto, shapefile (jossa on `.prj`) ja GeoJSON-tiedosto, jossa on `crs`, ilmoittavat koordinaattijärjestelmänsä.
Sovellus käyttää sitä piirtäessään kartan, etsiessään paikkoja paikkahaussa ja viedessään aineiston geometrioineen;
taulukon koordinaatit säilyvät sellaisina kuin ne ovat tiedostossa. Jos tiedosto ei ilmoita järjestelmää, projisoidut
koordinaatit tulkitaan SWEREF 99 TM:ksi. Sovellus muuntaa nämä järjestelmät:

| Järjestelmä | EPSG |
|---|---|
| SWEREF 99 TM ja sen kaksitoista paikallista vyöhykettä (SWEREF 99 12 00–23 15) | 3006, 3007–3018 |
| RT 90 2,5 gon V Lantmäterietin suoralla projektiolla | 3021 |
| ETRS89 ja WGS 84 / UTM 32–35 (Tanska, Norja, Suomi) | 25832–25835, 32632–32635 |
| ETRS-TM35FIN ja Suomen GK-kaistat | 3067, 3873–3885 |
| ISN93 / Lambert 1993 (Islanti) | 3057 |
| Web Mercator | 3857 |
| WGS 84 ja ETRS89 asteina | 4326, 4258 |

Muunnos vastaa PROJia (jota QGIS käyttää) millimetrin tarkkuudella; RT 90 2,5 gon V kahden desimetrin tarkkuudella, koska
suora projektio on yksinkertaistus. Jos tiedosto ilmoittaa muun järjestelmän, esimerkiksi RT 90:n muussa kaistassa tai
vanhan paikallisen kunnan järjestelmän, Nouda kertoo siitä, eikä kartta piirrä paikkoja väärin vaan jättää ne
piirtämättä; muunna tiedosto ensin SWEREF 99:ään, esimerkiksi QGIS:ssä. Nämä kartat piirretään Web Mercatorissa pohjoinen
ylöspäin; kaavan voi näyttää myös sen omassa järjestelmässä (katso [planer.md](planer.md#koordinaatti--ja-korkeusjärjestelmät)).

## Rajoitukset

- Taustakartat ja julkaistu HTML taustakartalla vaativat verkon; sovellus itse ei tee pyyntöjä ilman suostumusta.
- Koordinaattijärjestelmät: kohdassa [Koordinaattijärjestelmät](#koordinaattijärjestelmät) luetellut. Muut on muunnettava ennen
  tuontia (esimerkiksi QGIS:ssä); sovellus kertoo siitä eikä piirrä niitä.
- Vienti piirtää tasot, ei taustakarttaa eikä WMS-tasoja.
- Puskurit ja päällekkäisyydet ovat tasolaskentaa WGS 84 -koordinaateilla Turfin kautta; kilometrimittakaavassa
  Pohjoismaissa virhe on pieni, hyvin suurilla alueilla huomattava.
