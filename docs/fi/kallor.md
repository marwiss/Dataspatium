# Lähteet: tietokannat, silta ja linkitetyt tiedostot

Tiedostojen, liitetyn tekstin, verkko-osoitteiden ja esiasetettujen avointen rajapintojen (ks.
[api-konfiguration.md](api-konfiguration.md)) lisäksi Dataspatium voi hakea dataa tietokannoista kolmella tavalla:
**Access-tiedostot** luetaan suoraan selaimessa, **omalla tietokoneella tai verkossa olevat tietokannat**
tavoitetaan pienen paikallisen sillan kautta, ja **HTTP:n yli toimivat tietokantapalvelut** (PostgREST, OData,
GraphQL ja muut) muuttuvat tavallisiksi lähteiksi Nouda-tilassa. Tietokoneen tiedostovalitsimella valitut
tiedostot voi lisäksi **linkittää**, jolloin aineisto luetaan levyltä uudelleen yhdellä napsautuksella. Kaikki
tapahtuu selaimessa; mitään ei lähetetä muualle kuin itse nimeämääsi tietokantaan.

## Access-tiedostot (mdb, accdb)

Pudota tiedosto Nouda-tilan alueelle kuten mikä tahansa tiedosto. mdb-reader lukee sen suoraan selaimessa ilman,
että Access on tietokoneella: taulut luetellaan *Asetukset*-vaiheessa, valitset yhden ja saat sarakkeet Accessin
ilmoittamine tyyppeineen (teksti, luvut, päivämäärät, kyllä/ei). Kyselyjä, linkitettyjä tauluja ja salasanalla
suojattuja tiedostoja ei voi lukea näin; käytä silloin alla olevaa siltaa. dBase-tiedostot (.dbf) luetaan
taulukkolaskentatuonnilla.

## Tietokantasilta

Silta on pieni skripti, jonka käynnistät tietokoneella tarvittaessa, samaan tapaan kuin paikallisen
verkkopalvelimen. Se kuuntelee vain omaa tietokonetta (127.0.0.1), vaatii ikkunassa näkyvän tunnisteen ja on
kirjoitussuojattu, ellet käynnistä sitä kirjoitus sallittuna. Sovellus hakee taulut sillan kautta; mikään ei
poistu tietokoneelta.

### Sillan käynnistys

- **Windows**: avaa PowerShell sovelluksen kansiossa ja suorita `powershell -ExecutionPolicy Bypass -File tools\db-bridge.ps1`.
  Silta puhuu ODBC:tä, OLE DB:tä ja SqlClientia ja tavoittaa siten Accessin (mdb ja accdb Microsoft ACE:n kautta),
  Excelin, SQL Serverin (myös LocalDB ja Express), Oraclen, PostgreSQL:n, MySQL/MariaDB:n, Paradoxin, dBasen ja
  kaikki tietokoneen ODBC-tietolähteet (DSN). Järjestelmänvalvojan oikeuksia ei tarvita.
- **macOS ja Linux** (ja Windows ilman PowerShelliä): `python tools/db_bridge.py` (Python 3, vakiokirjasto).
  SQLite-tiedostot toimivat aina; `pyodbc` asennettuna (`pip install pyodbc`) myös ODBC-lähteet.

Ikkuna näyttää osoitteen (`http://127.0.0.1:<portti>/`) ja tunnisteen. Valinnat: `-Port` tai `--port` valitsee
portin, `-AllowWrite` tai `--allow-write` sallii muutokset, `-MaxRows` tai `--max-rows` rajoittaa rivien määrän
hakua kohden (oletus 100 000) ja `-AllowOrigins` tai `--allow-origin` määrää, mitkä sovelluksen osoitteet saavat
kutsua siltaa. Kansiosta avatun sivun alkuperä on `null`, joka on sallittu, samoin `localhost` ja sovelluksen osoite
GitHub Pagesissa. Pysäytä sulkemalla ikkuna tai painamalla Ctrl+C.

### Sillan käyttö sovelluksessa

1. Valitse *Tietokanta sillan kautta* kohdasta *Tietokannat* Nouda-tilassa, liitä osoite ja tunniste ja paina
   **Yhdistä**. Tunniste on voimassa istunnon ajan; *Tallenna salattuna* säilyttää sen samalla tunnuslauseella
   kuin API-avaimet.
2. Kuvaa lähde: Access- tai Excel-tiedosto (polku tietokoneella), SQL Server (palvelin, tietokanta ja käyttäjä tai
   Windows-kirjautuminen), ODBC-tietolähde (valitse tietokoneen DSN:istä) tai yhteysmerkkijono. Paina
   **Hae taulut**.
3. Valitse taulu, katso ensimmäiset sata riviä ja paina **Tuo**. Saraketyypit tulevat tietokannasta.
4. **Oma SQL** suorittaa kyselyn tietokannan omalla murteella ja tuo tuloksen. SELECT näytetään heti; muut lauseet
   vaativat, että silta on käynnistetty kirjoitus sallittuna, ja ne hyväksytään yksi kerrallaan dialogissa, joka
   näyttää lauseen.

Tuodut aineistot muistavat lähteensä: *Päivitä* Hallitse-tilassa tai *Tallennetut haut* Nouda-tilassa hakee taulun
tai kyselyn uudelleen ja toistaa reseptin. Salasanoja ei koskaan tallenneta aineiston mukana; uudelleenkäynnistyksen
jälkeen sovellus pyytää avaamaan lähteen uudelleen ennen päivitystä. Analysoi-tilan SQL-välilehti voi ajaa suoraan
sillassa viimeksi avattua lähdettä vastaan (*Suorita kohteessa*).

### Turvallisuus

- Silta vastaa vain osoitteessa 127.0.0.1, vaatii tunnisteen jokaisessa kutsussa ja sallii CORSin vain
  sovelluksen omille osoitteille.
- Oletuksena kirjoitussuojattu: vain SELECT pääsee läpi. Kirjoitus sallittunakin vaaditaan hyväksyntäsi lausetta
  kohden; silta vastaa 428, kunnes sovellus lähettää hyväksynnän.
- Silta kirjaa viimeisimmät kutsut (`GET /log`) ja pysähtyy, kun ikkuna suljetaan.
- Tunnisteet ja salasanat säilytetään vain istunnossa tai tunnuslauseella salattuina, ei koskaan selväkielisinä
  eikä jaetuissa määrityksissä.

### Vianetsintä

- *Provider cannot be found*: asenna Microsoft Access Database Engine (ACE) 64-bittisenä tai käytä ODBC-DSN:ää,
  jolla on 64-bittinen ajuri. Silta on 64-bittinen, kun PowerShell on.
- *Väärä tai puuttuva tunniste*: kopioi tunniste uudelleen sillan ikkunasta; se vaihtuu jokaisessa
  käynnistyksessä, ellet anna `-Token`.
- *Silta ei vastaa*: tarkista, että ikkuna on auki ja osoite oikea; kokeile toista porttia.
- Suorituskäytäntö: skripti käynnistetään valitsimella `-ExecutionPolicy Bypass`, kuten sovelluksen
  testityökalutkin, joten asetuksia ei tarvitse muuttaa.
- IT-osasto voi tarkistaa skriptin (`tools/db-bridge.ps1`, noin 200 riviä) ja käynnistää sen kiinteällä
  portilla ja tunnisteella.

## Tietokantalähteet HTTP:n yli

Valinta **Tietokantalähde** kohdassa *Lisää lähteitä* Nouda-tilassa tekee osoitteesta ja avaimesta tavallisen
API-lähteen. Sovellus kysyy palvelulta sen taulut (skeeman tunnistus) ja lisää päätepisteen taulua kohden sekä
yleisen päätepisteen, johon annat taulun itse. Lähde toimii sen jälkeen kuten esiasetetut rajapinnat: parametrit,
esikatselu, automaattisesti seurattavat sivut ja yhdellä napsautuksella päivittyvät tallennetut haut.

| Perhe | Todennus | Tunnistus | Haku | CORS |
|---|---|---|---|---|
| PostgREST / Supabase | `apikey`-otsake (valinnainen) | OpenAPI-juuri | `select`, `order`, suodattimet riveittäin; sivut `limit`/`offset` | Sallittu oletuksena |
| OData v4 | Basic (valinnainen) | Palvelukuvaus | `$select`, `$filter`, `$orderby`, `$top`; `@odata.nextLink` seurataan | Riippuu palvelusta |
| GraphQL | Bearer (valinnainen) | Ei | Kirjoitat kyselyn; ensimmäinen lista kohdassa `data` on taulukko | Riippuu palvelimesta |
| CouchDB | Basic (valinnainen) | `_all_dbs` | `_all_docs` dokumentteineen; `skip`/`limit` | Otetaan käyttöön CouchDB:ssä |
| ClickHouse | Basic (valinnainen) | `SHOW TABLES` | SQL taulua kohden, `FORMAT JSON`; `add_http_cors_header=1` lähetetään | Asetuksen kautta |
| Elasticsearch / OpenSearch | API-avain (valinnainen) | `_cat/indices` | `_search` ja `q`; `from`/`size`, enintään 10 000 osumaa | `http.cors.*` |
| SPARQL | Ei | Ei | Kysely parametrina; muuttujista tulee sarakkeita | Julkiset päätepisteet sallivat |
| InfluxDB v2 | Tunniste | Säiliöt | Flux-kysely; annotoitu CSV | Tarkista palvelin |
| Google Sheets | Ei | Ei | Julkaistu tai linkillä jaettu taulukko CSV:nä | Google |
| Airtable | Henkilökohtainen tunniste | Metadata-rajapinta | Tietueet `offset`-sivutuksella; kentistä tulee sarakkeita | Sallittu |

CORS tarkoittaa, että tietokannan palvelimen on sallittava kutsut selaimesta. Kansiosta avattu sivu lähettää
alkuperän `null`; palvelintilassa sovelluksen osoitteen. Käyttöönotto on kuvattu kunkin palvelun dokumentaatiossa
(linkki dialogissa). Jos palvelinta ei voi muuttaa, jäljelle jäävät välityspalvelinasetus (ks.
[api-konfiguration.md](api-konfiguration.md)) tai silta ODBC:n kautta.

Avaimet ja salasanat pysyvät istunnossa tai tallentuvat salattuina; luotu määritys voidaan viedä ja jakaa ilman
niitä. Vastausmuodot `graphql`, `sparql` ja `influx-csv` sekä `lift` (sisäkkäisen olion nosto sarakkeiksi) on
kuvattu tiedostossa [api-konfiguration.md](api-konfiguration.md), ja niitä voi käyttää omissa määrityksissä.

### Neo4j Boltin yli

Valinta **Neo4j** kohdassa *Lisää lähteitä* (perhe **Neo4j (Bolt)**, joka on myös kohdassa *Tietokantalähde*) yhdistää Neo4j Auraan tai omaan palvelimeen Neo4j:n ajurilla
WebSocketin yli (`neo4j+s://…`, tietokanta, käyttäjätunnus ja salasana; salasanaa ei koskaan tallenneta selkotekstinä).
Lähde avaa Cypher-editorin: tulos on taulukko tai verkkoaineisto, kun vastaus sisältää solmuja ja suhteita; kyselyt voi
tallentaa lähteelle. Yhteys vaatii suostumuksen (tarkoitus Neo4j) eikä kuulu CORS:n piiriin; oma palvelin ilman TLS:ää
(`bolt://`) tavoitetaan vain http://-sivulta. Katso [grafer.md](grafer.md#neo4j-lähteenä).

### OpenCDE-palvelin (BCF ja Documents API)

Valinta **OpenCDE** kohdassa *Lisää lähteitä* (perhe **OpenCDE (BCF, Documents)**, joka on myös kohdassa *Tietokantalähde*) yhdistää palvelimeen, joka noudattaa buildingSMARTin
OpenCDE-rajapintoja, esimerkiksi [Kontroll](https://github.com/marwiss/Kontroll). Anna palvelimen osoite ja
asiakastunnus, jonka palvelimen pääkäyttäjä on rekisteröinyt Dataspatiumille (julkinen asiakas, jonka
uudelleenohjausosoite on `http://127.0.0.1:8080/oauth-callback.html` tai vastaava sovelluksen osoitteelle). Lähde avaa
näkymän, jossa kirjaudut palvelimelle (OAuth2 ja PKCE ponnahdusikkunassa; file://-osoitteesta liität osoitteen, johon
päädyt kirjautumisen jälkeen), valitset projektin ja haet asiat, kommentit, näkymien komponentit (yksi IFC-elementti
riviä kohti), tapahtumat ja tiedostot taulukoina. *Hae asiakirjat* avaa palvelimen oman asiakirjojen valintasivun
(Documents API); valitut tiedostot ladataan ja tuodaan kuin ne olisi pudotettu sovellukseen, joten IFC-malli tulee
malliaineistoksi. Käyttöoikeustunnukset ovat vain istunnossa eikä niitä viedä lähteen mukana. Yhteys vaatii
suostumuksen (tarkoitus OpenCDE-palvelin) ja palvelimen, joka sallii kutsut selaimesta (CORS).

Sovellus puhuu BCF API -versioita 3.0 ja 2.1. Se valitsee uusimman version, jota palvelin tarjoaa, ja myös pelkän 2.1:n palvelin toimii: sellaisesta
puuttuvat usein Foundation API ja Documents API, joten sovellus lukee version osoitteesta `/bcf/versions` ja kirjautumisosoitteet osoitteesta `/bcf/2.1/auth` ja
jättää pois kohdan *Hae asiakirjat*. Valintaikkunan kohdassa *Lisää asetuksia* voit valita version itse, ja jos palvelin tarjoaa useita, voit vaihtaa lähteen
näkymässä. Versiossa 2.1 *Projektin tiedostot* luettelee vain BCF-asiakirjat, asioilla ei ole palvelimen juoksevaa numeroa eikä viewpointia voi poistaa. Vastineeksi
kommentti voi olla vastaus toiseen: painike *Vastaa* paneelissa *Asiat*.

Kortti *IFC-LPG* näkyy, kun palvelimella on verkko, katso [grafer.md](grafer.md#ifc-lpg-kontroll-palvelimella).

Kohdassa *Projektin tiedostot* lähde luettelee mallit ja asiakirjat, jotka palvelimella on projektille. *Hae* tekee tiedoston
omaa lajia olevan aineiston, joten IFC-tiedostosta tulee malli ja CSV-tiedostosta taulukko, ja aineisto muistaa, miltä
palvelimelta, mistä projektista ja mistä versiosta se tuli. Hallitse-tilassa kortti *CDE:stä* näyttää tämän, ja *Etsi uusi
versio* kysyy palvelimelta, onko asiakirjasta uudempi versio; se haetaan silloin omaksi aineistokseen vanhan viereen. Lähde
kertoo myös, mitä voit tehdä projektissa, esimerkiksi luoda asioita tai ladata asiakirjoja. Kun lähde luodaan, valintaikkuna
kysyy palvelimelta, mistä kirjaudutaan; jos palvelin ei silloin vastaa, sovellus kysyy uudelleen ensimmäisessä kirjautumisessa.

Jos palvelin sallii, sovellus rekisteröi itsensä asiakkaaksi, kun jätät asiakastunnuksen tyhjäksi, jolloin järjestelmänvalvojan
ei tarvitse jakaa mitään. Aineistot voivat myös palata palvelimelle: Jaa-tilan välilehti *CDE:hen* lähettää aineiston missä
tahansa muodossa, tai alkuperäisen tiedoston, projektiin joko Documents API:n kautta, jossa palvelimen oma sivu kysyy otsikon ja
version, tai BCF-asiakirjana. Palvelimelta haettu aineisto voidaan lähettää asiakirjansa uutena versiona.

Kontrollin IFC-graafille näkymä tarjoaa aloituskoodia: graafin mallit ja viimeisin valmis malli asiakirjaa kohti, rakennusosat luokittain, seinien GTIN, asiat tilan mukaan,
asiat ja niiden rakennusosat, rakennusosaa koskevat asiat sekä graafi asioista, viewpointeista ja komponenteista. Valitse kysely,
muokkaa ja aja. Se edellyttää, että palvelimen ylläpitäjä on avannut Boltin; kehityspino tekee niin, tuotantopalvelin harvoin.

Työtilapaketti voi myös kulkea palvelimen kautta: välilehti *CDE:hen* lähettää sen asiakirjana, ja projektin tiedostojen kortti
näyttää pakettitiedostoille painikkeen *Vastaanota*, joka ottaa paketin vastaan aivan kuin tiedosto pudotettaisiin Nouda-tilaan.

Lähteen näkymän alareunan kortti *Loki* näyttää kaiken, mitä sovellus on lähettänyt palvelimelle istunnon aikana: ajan,
menetelmän, API:n (Foundation, BCF tai Documents) ja määrittelyn mukaisen toiminnon, tilan ja keston. Rivin napsautus näyttää
otsakkeet (tunnukset ja evästeet peitettyinä), selityksen siitä, mitä toiminto tekee, linkin määrittelyyn ja painikkeen *Kopioi
curl-komentona*. Kytke *Tallenna sisällöt* päälle nähdäksesi myös pyynnön ja vastauksen sisällön (teksti, enintään 64 kt; ei
koskaan tunnuskutsuja). Loki on vain muistissa eikä sitä lähetetä koskaan; sen voi tallentaa JSON-tiedostona tai aineistona.
Sovellus asettaa jokaiseen kutsuun otsakkeen X-Request-Id, jotta palvelimen oma loki voidaan yhdistää sovelluksen lokiin; jos
palvelin kieltää otsakkeen, se poistetaan käytöstä kyseiseltä lähteeltä.

Palvelimen puoli kuvataan Kontrollin dokumentaatiossa: [client-guide.md](https://github.com/marwiss/Kontroll/blob/main/docs/fi/client-guide.md) (miten asiakas yhdistää), [acceptance.md](https://github.com/marwiss/Kontroll/blob/main/docs/acceptance.md) (parin testiajot) ja [deploy/local.md](https://github.com/marwiss/Kontroll/blob/main/docs/fi/deploy/local.md) (kehityspino ja miten sovellusta testataan sitä vastaan).

Kontroll kuvaa lisäyksensä osoitteessa `GET /.well-known/kontroll`; sovellus lukee asiakirjan, kun lähde avataan, ja kirjoittaa
otsikon alle, mikä palvelin on kyseessä ja mitä lisäyksiä sillä on (itserekisteröinti, pyyntöloki, hallinta, IFC-LPG,
graafikyselyt). Palvelimella ilman asiakirjaa ei ole lisäyksiä, ja kaikki määrittelyjen mukainen toimii silti. Palvelimen virhekoodit
(`code` vastauksessa, esimerkiksi `reauthentication_required`) näytetään omalla kielelläsi; tuntemattomat koodit näyttävät palvelimen
oman tekstin. Linkki *Avaa Dataspatiumissa* palvelimen sivuilla on muotoa `index.html#/inhamta/opencde?server=https://…` ja avaa uuden
lähteen valintaikkunan osoite täytettynä. Jos palvelin on jo lähteenä, se avautuu suoraan. Linkki voi myös nimetä projektin ja asiakirjan
(`&project=…&document=…&version=…`): projekti valitaan ja asiakirja haetaan datamääräksi, kun olet kirjautunut. Sivut, jotka Kontroll
avaa ponnahdusikkunassa (kirjautuminen, lähetys, asiakirjojen valinta), näkyvät sovelluksen kielellä.

**Hallinta.** Jos olet järjestelmänvalvoja Kontroll-palvelimella, lähteen näkymä näyttää kortin *Hallinta* (kun palvelimen kyvykkyysasiakirja sanoo hallintarajapinnan olevan päällä). Painike *Kirjaudu järjestelmänvalvojana* pyytää oikeuden `admin`; sen jälkeen ovat välilehdet Yleiskuva, Käyttäjät (luo, muuta, poista käytöstä, nollaa salasana, poista), Projektit (luo, nimeä uudelleen, jäsenet ja roolit, poista), Asiakkaat (rekisteröi, muuta, vaihda salaisuus, peru tunnukset, poista), Istunnot (lopeta yksi tai käyttäjän kaikki), Tapahtumaloki, Asetukset ja Kunto sekä Graafikysely, kun palvelin sallii lukevan Cypherin IFC-graafiin. Vaaralliset toimet vaativat tuoreen kirjautumisen: palvelin vastaa `reauthentication_required`, sovellus avaa kirjautumisen uudelleen ja toistaa kutsun. Kertakäyttöiset arvot (alkusalasana, asiakassalaisuus) näytetään kerran Kopioi-painikkeen kanssa, eikä niitä kirjoiteta lokiin. Jokainen luettelo voidaan tallentaa datamääränä ja hakea uudelleen Hallitse-tilasta.

## Avoin paikkatieto

Kohdan *Paikkatietolähde* (Lisää lähteitä) valintaikkuna alkaa luettelolla **valmiista paikkatietolähteistä**: avoimia WFS-, OGC API
Features- ja ArcGIS-palveluja pohjoismaisilta viranomaisilta ja kunnilta (SCB, SGU, Naturvårdsverket,
Riksantikvarieämbetet, Skogsstyrelsen, Sundsvalls kommun, Kartverket, Miljødirektoratet, Riksantikvaren, Tilastokeskus, SYKE, Helsinki,
Väylävirasto, Danmarks Miljøportal, Københavns Kommune, Plandata.dk, Landmælingar Íslands ja muita), kaikki
tarkistettu toimiviksi selaimesta. Valmis lähde avataan, muut lisätään yhdellä napsautuksella ja tasot luetaan
palvelusta; suodata nimen, maan tai sisällön mukaan. Luettelo on tiedostossa `presets/geodata/services.json`. Luettelon

Kolme lähdettä noutaa kaavoja: *Plandata.dk (WFS)* ja *Skipulagsstofnun skipulagsgögn (ArcGIS)* -lähteissä on painike
**Nouda kaava**, joka lukee kokonaisen paikalliskaavan tai deiliskipulag-kaavan (kaikki tasot) kaavanumerolla ja
tallentaa sen kaavana, ja *Ryhti kaavatiedot (OGC API Features)* antaa Suomen kaavahakemiston. Katso [planer.md](planer.md#muiden-pohjoismaiden-kaavat).
alla ovat oman palvelun kentät. Boverketin Planbestämmelsekatalog on tavallinen API-lähde (*Boverket
Planbestämmelsekatalogen*), katso [planer.md](planer.md).

Valinta **Paikkatietolähde** kohdassa *Lisää lähteitä* Nouda-tilassa tekee tavallisen API-lähteen paikkatietopalvelun
osoitteesta samalla tavalla kuin tietokantalähteistä. Sovellus lukee palvelun tasot ja tekee päätepisteen tasoa kohden sekä
yleisen päätepisteen, jossa annat tason itse. Vastaukset ovat GeoJSONia WGS 84:ssä: aineisto saa geometriasarakkeen ja
avautuu karttana Muokkaa-tilassa (katso [kartor.md](kartor.md)). Lähde näyttää tasot suodatettavana luettelona; valitse
taso, rajaa mielellään alueella (bbox) ja nouda. Esikatselu näyttää vastauksen pienenä karttana taulukon yläpuolella, ja
*Avaa karttana* vie tallennettuun aineistoon.

| Perhe | Löytäminen | Nouto | Avain |
|---|---|---|---|
| WFS 2.0 (GeoServer, MapServer, Deegree) | GetCapabilities | GetFeature parametreilla `outputFormat=application/json` ja `srsName=EPSG:4326`; alue (bbox), CQL-suodatin, sarakkeet; sivut `startIndex`/`count` | Bearer (valinnainen) |
| OGC API Features | `/collections` | `/collections/{id}/items` parametreilla bbox, datetime ja filter; next-linkit seurataan | Bearer (valinnainen; Lantmäterietin paikkatietoalusta vaatii) |
| ArcGIS REST (FeatureServer, MapServer) | Palvelun kuvaus tai koko hakemisto | `/{taso}/query` parametreilla where, alue, `f=geojson` ja `outSR=4326`; sivut `resultOffset` | Token (valinnainen) |

Valmiit paikkatietolähteet ilman avainta (CORS tarkistettu): SCB:n avoin paikkatieto, SGU, Havs- och vattenmyndigheten,
Riksantikvarieämbetetin muinaisjäännökset, Skogsstyrelsen, Kartverketin hallinnolliset yksiköt ja kiinteistökartta (Norja)
sekä Tilastokeskus ja SYKE (Suomi). Tasot luetaan palvelusta, kun lähde avataan ensimmäisen kerran, ja ne voi lukea
uudelleen painikkeella *Lue tasot uudelleen*; luettelo tallennetaan omaan kopioosi lähteestä. Lantmäterietin
paikkatietoalusta (asemakaavat) on tasolla 2 Bearer-avaimella, jonka saa alustaan liittyneeltä organisaatiolta.

**Geodataportalen** (geodata.se) on Ruotsin kansallinen luettelo viranomaisten, alueiden ja kuntien paikkatiedoista. Lähde
*Geodataportalen (sök geodata)* hakee luettelosta ja näyttää yhden tietueen osumaa kohden: otsikko, organisaatio, kuvaus
ja palvelut. WFS-, OGC API- tai ArcGIS-palvelu lisätään paikkatietolähteeksi yhdellä napsautuksella ja avataan heti,
WMS-osoite kopioidaan käytettäväksi taustakarttana tai WMS-tasona karttanäkymässä, ja lataustiedostot ja metatiedot
avautuvat uuteen välilehteen. Osumaluettelon voi myös noutaa taulukkona välilehdeltä *Päätepisteet*.

Paikkatietopalvelut vastaavat usein suurella kohdemäärällä: rajaa alueella tai suodattimella ja nosta *Sivujen
enimmäismäärää* kohdassa *Lisää vaihtoehtoja* vain tarvittaessa. Oman palvelun on sallittava kutsut selaimesta (CORS)
samoin kuin tietokantalähteiden; useimpien viranomaisten GeoServer ja ArcGIS Server sallivat.
## Linkitetyt tiedostot

Chromessa ja Edgessä Nouda-tilassa on painike **Linkitä tiedosto tietokoneelta**. Tiedosto valitaan tietokoneen
tiedostovalitsimella ja tuodaan tavalliseen tapaan, mutta aineisto säilyttää linkin tiedostoon: **Päivitä levyltä**
Hallitse-tilassa lukee tiedoston uudelleen samoilla asetuksilla, korvaa rivit ja toistaa reseptin (siivoukset,
uudet sarakkeet ja yhdistämiset tehdään uudelleen). Selain voi pyytää lupaa lukea tiedosto uudelleen
uudelleenkäynnistyksen jälkeen. Firefoxista toiminto puuttuu; siinä tuot tiedoston uudelleen. R:n kautta luettavia
muotoja (SPSS, Stata, SAS, PX, RDS, Parquet) ei voi linkittää.

## WebSocket

Sovelluksessa on WebSocket-yhteystapa (suostumus käyttötarkoituksittain, JSON-kehykset, kysely ja vastaus
pareittain id:n mukaan). Se on tarkoitettu suoratoistorajapinnoille; mikään esiasetus ei käytä sitä vielä. Neo4j kulkee Boltin yli omalla ajurillaan.

## Rajoitukset

- Silta toimii tietokoneella, jolla sovellusta käytetään; etätietokannat tavoitetaan sen tietokoneen ajurien tai DSN:ien kautta.
- Enintään 100 000 riviä hakua kohden sillan kautta, ellei `-MaxRows`-arvoa nosteta; suuret taulut rajataan parhaiten SQL:llä.
- Access-tiedostot selaimessa: ei kyselyjä, linkitettyjä tauluja eikä salasanoja; hyvin suuret tiedostot vievät muistia.
- Elasticsearch antaa enintään 10 000 osumaa hakua kohden (`from` + `size`).
- Kaikki HTTP-lähteet vaativat CORSin; sitä ei voi kiertää selaimesta.
