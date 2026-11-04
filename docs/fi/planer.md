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
| Kansallinen määrittely Detaljplan (Lantmäteriet, versio 4) | GeoJSON, jossa `feature:typ` (detaljplan, anvandningsbestammelse, egenskapsbestammelse, administrativBestammelse, beslutsinformation, planbestammelsebeskrivning) tai `feature:mediatyp application/vnd.lm.detaljplan.v4+json` | Kaava-alue, määräykset luetteloviitteellä, muotoilulla ja arvolla, päätöstiedot (aloitettu, hyväksytty, lainvoima, toteuttamisaika), perustelut |
| Viitekohteet kansalliselta paikkatietoalustalta | STAC-kohteet, joissa `properties.detaljplan` ja `properties.planbestammelse` (Lantmäterietin asemakaava-API:n vastaus) | Kaavan tiedot, määräysten muotoilu, luetteloviite, luokka ja arvo |
| Kansallinen määrittely Översiktsplan (testiversio 1.0) | GeoJSON, jossa `feature:typ` oversiktsplan, innehallOP, beslutOP | Kaavan tiedot ja sisältökohteet sisältötyypillä, nimellä, tarkennuksella ja kaavatapahtumalla |
| Boverketin ÖP-malli (GeoPackage) | Taulut `innehall_op_<teema>_<geometriatyyppi>` ja `oversiktsplan` | Kaikki sisältötasot yhtenä kaavana, teema tasoa kohden |

Koordinaatit SWEREF 99 TM:ssä ja paikallisissa SWEREF 99 -vyöhykkeissä (EPSG:3006–3018, luetaan kentästä
`koordinatsystemPlan`) sekä Web Mercatorissa muunnetaan WGS 84:ään. GeoJSON-tiedosto tunnistetaan sisällöstä, ei
päätteestä: pudota se Nouda-tilaan, niin kaavan tiedot ja painike *Tuo* tulevat näkyviin. ÖP-mallin
GeoPackage-tiedosto saa valinnan *Koko yleiskaava kaavana*; pois päältä tuodaan yksi taulukko kerrallaan kuten ennen.

Lantmäterietin asemakaava-API:sta (lähde *Lantmäteriet geodataplattformen: detaljplaner*, vaatii avaimen liittyneeltä
organisaatiolta) vastaus tallennetaan kaavana painikkeella *Tallenna kaavana* taulukon sijaan.

## Kaavakartta Muokkaa-tilassa

Kaava avautuu kaavakarttana: käyttömääräykset täytettyinä Boverketin väreillä (asuminen keltainen, keskusta ruskea,
teollisuus siniharmaa, katu vaaleanharmaa, puisto vaaleanvihreä, vesi sininen ja niin edelleen BFS 2020:5:n yleisten
ohjeiden mukaan; sävyt ovat sovelluksen omia), ominaisuusmääräykset sinisinä katkoviivareunoina, hallinnolliset
määräykset violetteina pisteviivoina, kaava-alueen raja mustana ja merkinnät nimiöinä. Napsauta kohdetta, niin
tarkastin näyttää sen tiedot ja mitä luettelo sanoo määräyksestä: koodi, tyyppi, voimassaolo ja luettelon muotoilu.
Tasot kytketään päälle ja pois tyypeittäin, taustakartta näytetään suostumuksen jälkeen, ja painikkeet antavat
*Tallenna karttanäkymänä* (Visualisoi, koontinäytöt ja Julkaise), *Kaavamääräykset* (luettelo Markdownina) ja *Näytä
taulukkona*.

Yleiskaava piirretään teemoittain: maa- ja vesialueiden käyttö täytettynä sisältötyypin mukaan, muut teemat yhdellä
värillä teemaa kohden ja valittavalla näkyvyydellä. Tarkastin näyttää pinta-alan maa- ja vesialueiden käyttöä kohden.

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
- Lantmäterietin asemakaava-API vaatii avaimen; sovellus on testattu dokumentoitua mallia vastaan omilla testitiedoilla.
