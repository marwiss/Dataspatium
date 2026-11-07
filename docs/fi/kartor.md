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

Kartta näyttää aineiston kohteet sovelluksen värillä. Lähennä rullalla tai painikkeilla, panoroi vetämällä ja
napsauta kohdetta, niin tarkastelupaneeli näyttää sen ominaisuudet; *Muokkaa taulukossa* vie riville taulukossa.
Työkalupalkissa ovat taustakartta (ei mitään tai OpenStreetMap), *Sovita kaikki*, *Tallenna karttanäkymänä*
(tallentaa kartan tasoineen ja nykyisine näkymineen kaaviona Visualisoi-tilaan) ja *Näytä taulukkona*. Kaikki, mitä
teet taulukossa (suodatat, korjaat, poistat rivejä), näkyy kartalla.

Suuret aineistot piirretään canvasille; 10 000 polygonia panoroituu nykimättä. Yli 50 000 kohdetta tasoa kohti ei
piirretä (rajaa voi nostaa tasoa kohti karttanäkymässä).

Kuvakokoelmissa, joissa on sijainteja, on painike *Näytä kartalla*. Napsauta paikkaa, niin tarkastelija näyttää kuvan. Taulukko, jonka rivit nimeävät kuvia, näyttää ne samalla tavalla. *Käytä näkyvää* tekee siitä, mitä kartta juuri nyt näyttää, valinnan, joka seuraa muihin tiloihin. Karttanäkymässä Visualisoi-tilassa kuvakokoelmat ja kaavat voivat olla tasoja.

## Karttanäkymät Visualisoi-tilassa

*Uusi kaavio → Kartta* luo karttanäkymän, jonka ensimmäinen taso on valittu aineisto. Asetukset vasemmalla:

- **Taustakartta**: ei mitään (oletus), OpenStreetMap tai oma karttapalvelin osoitemallilla, kuten
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
