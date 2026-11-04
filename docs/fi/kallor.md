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

Painike **Lisää tietokantalähde** kohdassa *Tietokannat* Nouda-tilassa tekee osoitteesta ja avaimesta tavallisen
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

## Linkitetyt tiedostot

Chromessa ja Edgessä Nouda-tilassa on painike **Linkitä tiedosto tietokoneelta**. Tiedosto valitaan tietokoneen
tiedostovalitsimella ja tuodaan tavalliseen tapaan, mutta aineisto säilyttää linkin tiedostoon: **Päivitä levyltä**
Hallitse-tilassa lukee tiedoston uudelleen samoilla asetuksilla, korvaa rivit ja toistaa reseptin (siivoukset,
uudet sarakkeet ja yhdistämiset tehdään uudelleen). Selain voi pyytää lupaa lukea tiedosto uudelleen
uudelleenkäynnistyksen jälkeen. Firefoxista toiminto puuttuu; siinä tuot tiedoston uudelleen. R:n kautta luettavia
muotoja (SPSS, Stata, SAS, PX, RDS, Parquet) ei voi linkittää.

## WebSocket

Sovelluksessa on WebSocket-yhteystapa (suostumus käyttötarkoituksittain, JSON-kehykset, kysely ja vastaus
pareittain id:n mukaan). Sitä käyttävät tulevat lähteet kuten Neo4j (Bolt WebSocketin yli, suunniteltu versioon
2.9) ja suoratoistorajapinnat; mikään esiasetus ei käytä sitä vielä.

## Rajoitukset

- Silta toimii tietokoneella, jolla sovellusta käytetään; etätietokannat tavoitetaan sen tietokoneen ajurien tai DSN:ien kautta.
- Enintään 100 000 riviä hakua kohden sillan kautta, ellei `-MaxRows`-arvoa nosteta; suuret taulut rajataan parhaiten SQL:llä.
- Access-tiedostot selaimessa: ei kyselyjä, linkitettyjä tauluja eikä salasanoja; hyvin suuret tiedostot vievät muistia.
- Elasticsearch antaa enintään 10 000 osumaa hakua kohden (`from` + `size`).
- Kaikki HTTP-lähteet vaativat CORSin; sitä ei voi kiertää selaimesta.
