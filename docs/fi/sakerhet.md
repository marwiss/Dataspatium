# Turvallisuus

Turvallisuus on sovelluksen ensimmäinen vaatimus. Dataspatium pitää datamääräsi, API-avaimesi ja tunnuksesi selaimessa ja
puhuu palvelimille (avoimet rajapinnat, OpenCDE-palvelimet kuten Dataregium) vain, kun pyydät sitä. Politiikka on sama kuin
Dataregiumin, koska kahta kehitetään parina ja julkaistaan samoilla numeroilla; Dataregiumin puolisko on sen repossa kansiossa
[README](https://github.com/marwiss/Dataregium/blob/main/docs/fi/README.md#henkilötiedot). Haavoittuvuuden ilmoittaminen kuvataan
tiedostossa [SECURITY.md](../../SECURITY.md).

## Uhkamalli

**Suojattavat kohteet**: datamääräsi (jotka voivat sisältää henkilötietoja), API-avaimet ja tunnukset palvelimille, niitä
suojaava salasanalause, se mitä jaat muille (paketit, palvelimelle lähetetyt tiedostot, julkaistut sivut) sekä työtilan eheys.

**Toimijat**: sinä itse; muut ohjelmat samalla tietokoneella; verkkosivustot, joilla käyt samassa selaimessa; palvelimet,
joilta noudat ja joille lähetät; se, joka saa jakamasi tiedoston; se, joka voi lukea verkkoa sinun ja palvelimen välillä.

**Luottamusrajat**: sovellus toimii selaimen hiekkalaatikossa ja tavoittaa vain sen, minkä pudotat alueelle tai valitset
valintaikkunassa. Kansiosta avattuna (file://) se jakaa Chromiumissa tallennusalkuperän muiden paikallisesti avattujen
HTML-tiedostojen kanssa, minkä vuoksi salaisuudet salataan. Palvelimet ovat vieraita: kaikki niiden lähettämä käsitellään
datana ja escapataan; kaikki sovelluksen niille lähettämä kulkee sinun toimintasi ja tarkoituskohtaisen suostumuksesi kautta.
R, Python ja web-ifc toimivat WebAssembly-hiekkalaatikoissa workereissa ilman pääsyä tietokoneelle.

## Kontrollit ja niitä todistavat testit

Jokaisella kontrollilla on automaattinen testi kansiossa `tests/` tai osoitin sitä kantavaan koodiin.

| Kontrolli | Standardi | Testi |
|---|---|---|
| Ei verkkokutsuja ilman toimintaasi ja tarkoituskohtaista suostumustasi (api, url, github, komponentit, taustakartat, tietokannat, neo4j, stun, opencde); evätty suostumus pysäyttää kutsun | OWASP ASVS 8.3 | `consent.test.js`: *a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError* |
| Salaisuuksia (API-avaimet, tunnukset) ei koskaan tallenneta selkokielisinä: vain istunnon ajaksi tai salasanalauseella salattuina (AES-GCM WebCryptolla), lukituksella ja avauksella | OWASP ASVS 2.10, 6.2 | `api.test.js`: *secrets in session, encrypted persistence, lock and unlock* |
| Salaisen vaiheen sisältävää reseptiä ei ajeta uudelleen ilman sinua | Tietojen minimointi | `refresh`: *a recipe with a secret step is refused before anything is fetched* |
| Komponentit ja R-paketit noudetaan kiinnitetyistä osoitteista suostumuksen jälkeen, tarkistetaan SHA-256:lla ennen käyttöä ja tallennetaan IndexedDB-välimuistiin | OWASP ASVS 14.2 | `components`: *fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable* |
| Kolmannen osapuolen koodi toimitetaan kiinnitettynä versiona lisensseineen eikä sitä muokata käsin | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, katselmointi |
| Kaikki sovelluksesta lähtevä tarkistetaan kokonaisuudessaan: henkilötunnukset, sähköposti- ja puhelinsarakkeet, leipäteksti, sivutaulukot, alkuperäiset tiedostot, kuvien sijainnit, graafien kaaret, kommentit ja tekijät; säilytä, pseudonymisoi tai poista kopiosta; datamäärä ei koskaan muutu | Tietojen minimointi (GDPR 5 art.) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| Paketti ottaa mukaan kaaviot, koontinäytöt ja muistikirjat vain valituista aineistoista; niiden, mallipohjien, skriptien, tallennettujen tulosteiden sekä aineistojen nimien ja tiedostonimien henkilötiedot näytetään ja peitetään kopiossa, ellet valitse säilyttämistä, tulosteiden poistoa tai pois jättämistä | Tietojen minimointi, GDPR 25 art. | `review`: *a bundle carries charts and notebooks of the chosen datasets only, and their personal data and names are cleaned* |
| OAuth2 OpenCDE:tä vastaan: authorization code PKCE S256:lla, `state` ja tarkka paluuosoite; väärä `state` ja evätty suostumus hylätään; tunnukset uusitaan ja perutaan | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; todellinen testi C2, C7–C9 |
| Paluu kirjautumisikkunasta: avaajan tai BroadcastChannelin kautta kuittauksella; suljettu ikkuna lasketaan virheeksi vain, kun sovellus ei ole eristetty | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| Pyyntöloki peittää otsakkeet (muun muassa Authorization) ja tallentaa rungot vain pyydettäessä, ei koskaan tunnuskutsuille | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Verkkotietokannan vastaukset eivät sisällä tallennettuja tiivisteitä: salasana-, token-, koodi- ja salaisuustiivisteet poistetaan solmuista, suhteista, taulukoista ja kartoista ennen näyttämistä tai tallentamista, ja Bolt-istunnot ovat aina lukevia | Tietojen minimointi | `ifc graph`: *stored hashes never reach a table or a graph* |
| Tunniste lähetetään vain lähteen omalle palvelimelle: palvelimen IFC-tarkistuksen raportti haetaan sovelluksen muodostamasta osoitteesta, ei koskaan version metatietojen osoitteesta | — | `validation`: *metadata and report from the server, the report from the app's own address, and the words in the log* |
| Avain, jonka palvelu haluaa pyynnön runkoon (Trafikverketin NVDB), täytetään vasta kun pyyntö lähetetään, koodataan rungon muodon mukaan eikä se koskaan päädy osoitteeseen, lokiin tai lähteen tietoihin | OWASP ASVS 8.3 | `geodata`: *NVDB sends its key in the XML body and a box in SWEREF 99 TM, pages with skip and opens as a map in WGS 84* |
| Hakutuloksen tiedostojen avain (Lantmäterietin STAC) lähetetään vain lähteen nimeämille palvelimille; muulla palvelimella oleva tiedosto haetaan ilman avainta | OWASP ASVS 8.3 | `geodata`: *Lantmäteriet STAC searches an area with the key, and Filer i källan reads the vector files in, with the key only for the file host* |
| Palvelimen katkaisema luettelo luetaan loppuun Link rel="next" -linkkien kautta, mutta vain samalta palvelimelta, joten tunniste ei koskaan mene muualle | — | `opencde`: *a list the server has capped is read to the end through Link rel="next", and only on the same server* |
| Arkistopaketin tiedostoja verrataan tiedoston `PREMIS.xml` tarkistussummiin (SHA-256), kun paketti luetaan, ja muuttunut tai puuttuva tiedosto näytetään; paketin ulkopuolelle osoittavaa paikkaa ei tarkisteta eikä koskaan lueta | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| Kaikki näytettävä data escapataan; ei `innerHTML`:ää käyttäjädatalla; asiakirjat ja julkaistut sivut escapaavat | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; koodikäytäntö |
| Service worker ja PWA vain palvelintilassa; file:// ei ole niistä riippuvainen | — | testimatriisin localhost-vaihe |
| Ei salaisuuksia, henkilötietoja tai tekijän identiteettiä repossa tai sen historiassa | — | julkaisuskriptien identiteettitarkistus ennen jokaista commitia, `CONTRIBUTING.md` |
| Tekoälypalvelua kutsutaan vain sen isännän suostumuksen (tarkoitus ai) ja käytännön mukaan: *Vain paikallinen* hylkää jokaisen isännän oman tietokoneen ulkopuolella; avain on api/secretsissä eikä koskaan kulje kysymyksen, lokin tai asetuksen mukana | OWASP ASVS 8.3, 2.10 | `ai.test.js`: *providers are saved without their key, the key goes to api/secrets, and the policy Local only refuses a cloud host* |
| Tekoäly voi vain lukea mallia: työkalut vastaavat aineiston taulukoiden datalla, vastaukset katkaistaan ja merkitään dataksi, ei koskaan ohjeiksi, ja silmukalla on askel- ja tokenbudjetti ja se voidaan peruuttaa | OWASP LLM01, LLM06 | `ai.test.js`: *the agent asks, runs the tool the model called, hands the result back as data and collects the elements* ja *a question can be cancelled, and the budget of turns ends a loop that never answers* |
| Tekoäly ei koskaan tee muutoksia itse: kirjoitustyökalut täyttävät muutosjoukon, jonka ihminen esikatselee ja hyväksyy; poisto vaatii tekoälyltä confirm-arvon ja ihmiseltä vielä yhden vahvistuksen; muutosjoukkoa, jossa on skeemavirheitä, ei voi hyväksyä; julkaisu, muutosehdotukset palvelimelle ja niiden hyväksyntä siellä ovat painikkeita, eivät koskaan työkaluja | OWASP LLM01, LLM06, LLM08 | `ai-change.test.js`: *the write tools check each call, fill the change set with refs and refuse what the person has not asked for* ja *the panel previews the candidate in 3D, approves it as a recipe step with provenance, undo restores the file exactly, and schema errors block approval*, *a previewed change set goes to Dataregium as a change proposal* |

## Henkilötiedot ja säilytys

Mitä sovellus tallentaa, minne ja kuinka pitkäksi aikaa. Kaikki pysyy tietokoneellasi; sovelluksen tekijälle ei lähetetä
mitään, eikä päivitystarkistusta tehdä ilman toimintaasi. Dataregiumin puolisko (mitä palvelin tallentaa sinusta) on tiedostossa
[README](https://github.com/marwiss/Dataregium/blob/main/docs/fi/README.md#henkilötiedot).

| Tieto | Missä | Sisältö | Säilytys |
|---|---|---|---|
| Datamäärät | IndexedDB (yksi SQLite-tiedosto datamäärää kohti) | tuomasi aineisto sarakkeineen, kommentteineen ja historioineen; voi sisältää henkilötietoja | kunnes poistat ne; varmuuskopiot ja paketit ovat ZIP-tiedostoja siellä, minne ne tallennat |
| Asetukset | IndexedDB | kieli, paneelien leveydet, lisätyt lähteet, suostumukset, tallennetut kyselyt | kunnes tyhjennät sivustotiedot |
| Salaisuudet | muisti, tai IndexedDB salattuna salasanalauseellasi | API-avaimet, tunnukset; salasanalausetta ei koskaan tallenneta | istunnon ajan, tai kunnes poistat lähteen |
| Loki | muisti | toiminnot, virheet ja kutsut peitetyin otsakkein | kunnes sivu ladataan uudelleen |
| Kommenttien nimet | datamäärän tiedosto | itse antamasi nimi | kulkee mukana paketeissa, varmuuskopioissa ja GitHubissa |
| Lähettämäsi | vastaanottajalla | datamäärät, tiedostot, asiat, kommentit ja käyttäjätunnuksesi palvelimella | vastaanottajan ehtojen mukaan |

## Tunnetut puutteet

- Ei vielä Content-Security-Policya: sovellus ajaa klassisia skriptejä, blob-workereita ja WebAssemblya, ja web-ifc:n paketti
  vaatii `eval`in. Meta-CSP ilman `'unsafe-eval'`-arvoa lisätään, kun web-ifc voidaan ladata ilman sitä.
- Chromiumissa file://-alkuperästä kaikki paikallisesti avatut HTML-tiedostot jakavat tallennustilan. Salaisuudet on salattu,
  mutta arkaluonteinen työtila kannattaa ajaa paikalliselta palvelimelta (`python -m http.server`) tai peilata siirrettävään kansioon.
- Chromium soveltaa palvelimen `form-action`-sääntöä myös kirjautumisen jälkeiseen uudelleenohjaukseen; palvelimen on sallittava
  sovelluksen paluuosoite (Dataregium sallii sen).

## Haavoittuvuuden ilmoittaminen

Älä avaa julkista issueta. Käytä GitHub-repon painiketta *Report a vulnerability* kohdassa Security → Advisories, kuten
[SECURITY.md](../../SECURITY.md) kuvaa: versio (ohjepainikkeen alla), selain, mitä näit ja miten se toistetaan. Saat
vahvistuksen muutamassa päivässä ja korjauksen tai suunnitelman heti, kun ongelma on ymmärretty.

## Korjauksia saavat versiot

Jokaisesta päänumerosta säilytetään yksi julkaisu: vain 2-sarjan uusin julkaisu saa korjauksia. 1.0.0 säilytetään
viitteeksi ilman korjauksia.
