# Kaavat: digitaaliset asemakaavat ja yleiskaavat

Dataspatium avaa digitaaliset kaavat kaavoina: ruotsalainen detaljplan (asemakaava) piirretään kaavakarttana
Boverketin väreillä ja merkinnöillä, määräykset luetellaan ja haetaan Boverketin kaavamääräysluettelosta
(Planbestämmelsekatalogen), ja översiktsplan (yleiskaava) näytetään teema kerrallaan. Kaava on *kaava*-tyyppinen
aineisto: yksi kaavakohde riviä kohden (kaava-alue ja jokainen määräys tai sisältökohde) geometrialla WGS 84:ssä,
kaavan tiedot metatiedoissa ja alkuperäinen tiedosto tallennettuna aineistoon. Taulukko on aina yhden napsautuksen
päässä.

## Luettavat muodot

| Muoto | Tunnistetaan | Sisältö |
|---|---|---|
| Kansallinen määrittely Detaljplan (Lantmäteriet, versio 4.1) | GeoJSON, jossa `feature:mediatyp application/vnd.lm.detaljplan.v4+json` tai `feature:typ` (detaljplan, användningsbestämmelse, egenskapsbestämmelse, administrativ bestämmelse; myös ilman kirjaimia å, ä ja ö) | Kaava-alue, määräykset katalogiviittauksineen, sanamuotoineen, arvoineen ja perusteluineen, geometriat alueina, viivoina, pisteinä ja kappaleina (korkeus RH 2000 -järjestelmässä), päätöstiedot (aloitettu, hyväksytty, lainvoimainen, toteuttamisaika, diaarinumero) ja kaavaselostuksen nimi |
| Viitekohteet kansalliselta paikkatietoalustalta | STAC-kohteet, joissa `properties.detaljplan` ja `properties.planbestammelse` (Lantmäterietin asemakaava-API:n vastaus) | Kaavan tiedot, määräysten muotoilu, luetteloviite, luokka ja arvo |
| Kansallinen määrittely Översiktsplan (Lantmäteriet, versio 2.0, testiversio 4) | GeoJSON, jossa `feature:mediatyp application/vnd.lm.oversiktsplan.v2+json` tai `feature:typ` oversiktsplan, innehallOP, beslutOP | Kaavan tiedot ja päätös (tehty, lainvoimainen), sisältökohteet sisältötyyppeineen, teema ÖP-katalogin luokan mukaan, nimi, tarkennus, kaavatapahtuma, yhteystaso ja kytkennät, myös pelkästään tekstissä kuvattu sisältö |
| Boverketin ÖP-malli (GeoPackage, tietokantamalli 0.4) | Taulut `innehall_op_<teema>_<geometriatyyppi>` ja `oversiktsplan` | Kaikki sisältötasot yhtenä kaavana, teema tasoittain, kaavan päätös (`beslut_op`), sisällön kytkennät ja kaava-asiakirjan jaksot (kirjanmerkit) |
| Detaljplan GeoPackagessa | Taulut `detaljplan`, `bestammelse` sekä `anvandning_yta`, `egenskap_yta`, `egenskap_linje`, `egenskap_punkt` kansallisen määrittelyn kenttänimin | Kaava sellaisena kuin suunnittelutyökalu sen tallentaa: kaava-alue, alueet, viivat ja pisteet määräyksineen, merkintöineen, väreineen, perusteluineen ja korkeuksineen, päätöstiedot ja asiakirjat; alueet, joilla ei vielä ole määräystä, näytetään piirrettyinä |

Koordinaatit SWEREF 99 TM:ssä ja paikallisissa SWEREF 99 -vyöhykkeissä (EPSG:3006–3018, luetaan kentästä
`koordinatsystemPlan`) sekä Web Mercatorissa muunnetaan WGS 84:ään. GeoJSON-tiedosto tunnistetaan sisällöstä, ei
päätteestä: pudota se Nouda-tilaan, niin kaavan tiedot ja painike *Tuo* tulevat näkyviin. ÖP-mallin
GeoPackage-tiedosto saa valinnan *Koko yleiskaava kaavana*; pois päältä tuodaan yksi taulukko kerrallaan kuten ennen. GeoPackage-muotoinen asemakaava saa valinnan *Koko kaava kaavana*. GeoPackage-tiedoston koordinaattijärjestelmä luetaan tiedostosta, myös kun se on annettu vain nimellä (esimerkiksi *SWEREF99 15 00*).

## Kaavakartta Muokkaa-tilassa

Kaava avautuu kaavakarttana: käyttömääräykset täytettyinä Boverketin väreillä (asuminen keltainen, keskusta ruskea,
teollisuus siniharmaa, katu vaaleanharmaa, puisto vaaleanvihreä, vesi sininen ja niin edelleen BFS 2020:5:n yleisten
ohjeiden mukaan; sävyt ovat sovelluksen omia), ominaisuusmääräykset sinisinä katkoviivareunoina, hallinnolliset
määräykset violetteina pisteviivoina, kaava-alueen raja mustana ja merkinnät nimiöinä. Napsauta kohdetta, niin
tarkastin näyttää sen tiedot ja mitä luettelo sanoo määräyksestä: koodi, tyyppi, voimassaolo ja luettelon muotoilu.
Tasot kytketään päälle ja pois tyypeittäin, taustakartta näytetään suostumuksen jälkeen, ja painikkeet antavat *Kaavamääräykset* (luettelo Markdownina) ja *Näytä
taulukkona*.

Yleiskaava piirretään teemoittain: maa- ja vesialueiden käyttö täytettynä sisältötyypin mukaan, muut teemat yhdellä
värillä teemaa kohden ja valittavalla näkyvyydellä. Tarkastin näyttää pinta-alan maa- ja vesialueiden käyttöä kohden.

Viivat (liittymäkiellot, aidat, kehityssuunnat) ja pisteet (esimerkiksi maanpinnan korkeus) piirretään sellaisinaan. Korkeussuunnassa rajattu määräys piirretään pohjapiirroksenaan, ja tarkastelija näyttää korkeuden kaavan korkeusjärjestelmässä (NGP:hen toimitettavissa kaavoissa RH 2000): alarajan, ylärajan tai molemmat. Tarkastelija näyttää myös kaavan päätöksen (hyväksytty, lainvoimainen, valitettu, toteuttamisaika, diaarinumero, päätöksen tyyppi), kaavaselostuksen nimen ja asiakirjat sekä valitusta kohteesta muut tiedot, kuten voimassaoloajan, toissijaisen ominaisuusrajan, mitä käyttömääräyksiä ominaisuusmääräys säätelee, yhteystason, mitä sisältö koskee ja missä kaava-asiakirjassa sitä kuvataan. Pelkästään tekstissä kuvattu sisältö, jolla ei ole sijaintia kartalla, luetellaan kohdassa *kohteet ilman sijaintia kartalla*, ja sen voi valita sieltä.

## Koordinaatti- ja korkeusjärjestelmät

NGP:hen toimitettavat asemakaavat (detaljplaner) laaditaan SWEREF 99 TM:ssä tai kunnan paikallisessa SWEREF 99
-vyöhykkeessä ja korkeudet RH 2000:ssa, ja tiedosto ilmoittaa molemmat (`koordinatsystemPlan` ja `hojdsystem`). Yleiskaavat
(översiktsplaner) ovat useimmiten SWEREF 99 TM:ssä. Tarkastelija näyttää kaavan koordinaattijärjestelmän ja, jos kaavassa
on korkeuksia, korkeusjärjestelmän; GeoPackage-tiedosto ei ilmoita korkeusjärjestelmää, ja silloin se kerrotaan.

Kaavakartta piirretään verkkokarttana (Web Mercator pohjoinen ylöspäin, jolloin taustana voi olla OpenStreetMap) tai kaavan
omassa järjestelmässä: valitse se työkalurivillä, esimerkiksi *SWEREF 99 16 30*. Silloin ruudukon pohjoinen on ylöspäin
kuten kaavakartassa, ja jokainen kohde on koordinaateissaan. Tausta voi silloin tulla WMS-palvelusta, joka tarjoaa saman
järjestelmän: valitse taustakartaksi *WMS-palvelu* ja anna osoite ja taso (*Lue tasot* hakee palvelun tasoluettelon ja
kertoo, jos tasolta puuttuu järjestelmä). OpenStreetMap on saatavilla vain verkkokarttana. Tausta haetaan suostumuksen
jälkeen kuten muutkin taustakartat.

Kaava, jonka koordinaattijärjestelmää sovellus ei osaa muuntaa, luetaan kaikkine kohteineen, mutta kohteita ei piirretä,
koska ne osuisivat väärään kohtaan: Nouda ja tarkastelija kertovat, minkä järjestelmän tiedosto ilmoittaa, ja kohteet
luetellaan kohdassa *kohdetta ilman sijaintia kartalla*. Sovellus muuntaa SWEREF 99 TM:n ja sen kaksitoista paikallista vyöhykettä, RT 90 2,5 gon V:n, pohjoismaiset UTM- ja
TM-järjestelmät, ISN93:n ja Web Mercatorin; muunnos vastaa PROJia (jota QGIS käyttää) millimetrin tarkkuudella, RT 90
kahden desimetrin tarkkuudella.

## Suunnittelutyökaluilla tehdyt kaavat

Suunnittelutyökalulla piirretyt kaavat luetaan kuten kaikki samanlaiset kaavat, teki ne mikä työkalu tahansa. Esimerkki on [Rita Detaljplan ja Rita Översiktsplan](https://github.com/ritaplan), QGIS-lisäosat. Se, mitä ne tallentavat ja toimittavat, avautuu näin:

| Tiedosto | Avautuu |
|---|---|
| Asemakaavan toimitustiedosto NGP:hen (JSON, Detaljplan 4.1) | Kaavakarttana Planbestämmelsekatalogenin merkinnöin ja värein |
| GeoPackage-muotoinen asemakaava kansallisen määrittelyn kenttänimin | Kaavakarttana kaavan omin merkinnöin ja värein, perustelut ja korkeudet mukana |
| Yleiskaavan toimitustiedosto NGP:hen (JSON, Översiktsplan 2.0) | Yleiskaavana teemoittain päätöksineen |
| GeoPackage-muotoinen yleiskaava (Boverketin tietokantamalli 0.4) | Yleiskaavana teemoittain päätöksineen, kytkentöineen ja kaava-asiakirjan jaksoineen |
| Arkistopaketti (kansio tai ZIP-tiedosto, jossa `metadata/PREMIS.xml`) | Kaava kansiosta `content` asiakirjoineen ja tiedostojen tarkistus |

Pudota tiedosto kohtaan Nouda tai hae se toiminnolla *Verkko-osoitteesta*, kun se on verkossa (esimerkiksi kunnan julkaisema kaava); tiedosto ilman tiedostopäätettä tunnistetaan sisältötyypistään. Arkistopaketin voi pudottaa kansiona tai ZIP-tiedostona: sovellus lukee kaavan kansiosta `content` (ensisijaisesti GeoPackage-tiedoston, muuten toimitustiedoston), tallentaa paketin tiedostot kaavan mukana ja vertaa jokaista tiedostoa sen tarkistussummaan (SHA-256) tiedostossa `PREMIS.xml`. Tarkastelija näyttää kohdassa *Arkistopaketti*, vastaavatko tiedostot, mitkä ovat muuttuneet tai puuttuvat, ja avaa asiakirjat (kaavakartan ja kaavaselostuksen) uuteen välilehteen. Paketin ulkopuolelle osoittavaa paikkaa ei tarkisteta eikä koskaan lueta.

## Kaava-välilehti Analysoi-tilassa

Kaava saa välilehden **Kaava** Regexin jälkeen:

- **Yhteenveto**: kaavan tiedot, kohteiden määrä tyypeittäin, luetteloviitteiden tila ja kaavan käyttöala.
- **Määräykset**: kaikki määräykset taulukkona merkinnällä, muotoilulla, luokalla, arvolla, koodilla ja
  luettelotilalla; voi tallentaa aineistona tai ladata Markdownina. Yleiskaavalle: sisältö teemoittain.
- **Pinta-alat**: pinta-ala käyttötarkoitusta kohden (alueiden summa SWEREF 99 TM:ssä) ja osuus kaavan käyttöalasta.
- **Luettelotarkistus**: jokainen luetteloviite haetaan luettelosta: voimassa, korvattu (ja millä), päättynyt,
  tuntematon tai puuttuva, ja noudattaako muotoilu luettelon mallia.
- **Hae luettelosta**: vapaatekstihaku luettelon 3 700 määräyksestä suodattimilla tyyppi, käyttömuoto ja voimassaolo;
  tuloksen voi tallentaa aineistona.

## Kaavamääräysluettelo

Sovelluksessa on upotettu kopio Boverketin Planbestämmelsekatalogenista (avoin data; julkaisu 20251201), joten haut,
värit ja luettelotarkistus toimivat ilman verkkoa. Lähde on mainittava: Boverket ja Planbestämmelsekatalogen. Luettelo
on myös lähteenä Nouda-tilassa (*Boverket Planbestämmelsekatalogen*): hae määräys UUID-tunnuksella, listaa julkaisut,
värit, käyttömuodot, luokat ja symbolit Boverketin avoimen API:n kautta. Kopio päivitetään komennolla
`python tools/plan_catalog.py` ennen uutta julkaisua.

## Rajoitukset

- Boverketin värit annetaan määräyksissä niminä; sovelluksen sävyt ovat omia. Symbolimerkinnät (pistemaa, ristimaa ja
  muut) piirretään reunaviivoina merkinnällä, ei Boverketin symboleilla.
- Määräyskuvaukset, suunnitteluaineistot ja päätösasiakirjat tulevat mukaan vain tekstinä (perustelut) tai tietoina
  kaavan metatiedoissa; asiakirjoja ei noudeta.
- Pinta-alat ovat tasolaskelmia SWEREF 99 TM:ssä; paikallisten vyöhykkeiden kaavoille virhe on mitätön.
