# Avoimet rajapinnat ja API-määritykset

Dataspatium noutaa dataa suoraan avoimista rajapinnoista selaimeesi. Mikään ei kulje minkään palvelimen kautta: kutsut
kulkevat tietokoneeltasi viranomaisen palveluun, ja vastauksesta tulee aineisto työtilaan. Se edellyttää, että palvelu sallii
kutsut selaimista (CORS); kaikki alla olevat valmisasetukset on tarkistettu sen osalta.

## Valmiit lähteet

Nouda-tilan luettelo on ryhmitelty maittain. Sen yläpuolella olevat maapainikkeet (Ruotsi, Tanska, Norja, Suomi, Islanti,
Färsaaret, Grönlanti, Ahvenanmaa, Pohjoismaat, EU, Kansainvälinen) valitsevat, minkä maiden lähteet näytetään; valinta tallennetaan
selaimeen. Lähteiden nimet ja kuvaukset noudattavat sovelluksen kieltä, ja useilla kielillä saatavat PxWeb-palvelut (SCB, SSB,
Tilastokeskus, Hagstofa, Grönlannin tilastovirasto, ÅSUB) selataan sovelluksen kielellä, kun palvelussa on se. Kaikki alla
olevat lähteet on tarkistettu CORS-tuen osalta marraskuussa 2026, ja vain kaksi viimeistä ruotsalaista vaativat avaimen.

### Ruotsi ja EU

| Maa | Lähde | Mitä | Näin noudat |
|---|---|---|---|
| Ruotsi | SCB Statistikdatabasen (API v1 ja v2) | Virallinen tilasto | Selaa tai hae, valitse arvot |
| Ruotsi | Folkhälsomyndigheten, Socialstyrelsen, Kolada, SMHI, Naturvårdsverket, Lantmäterietin geodatakatalogi, Ruotsin dataportaali | Kansanterveys, terveys, kuntien tunnusluvut, sää, ilmanlaatu, suojelualueet, paikkatieto | Ks. ruotsinkielinen opas |
| Ruotsi | Lantmäteriet Direkt, Boverket, Trafikverket NVDB, Lantmäteriet STAC | Paikannimet, energiatodistukset, tietiedot, paikkatietotiedostot | Vaativat avaimen |
| Ruotsi | Boverketin ilmastotietokanta | Rakennustuotteiden yleiset ilmastotiedot (GWP vaiheille A1–A5), ilman avainta | Nouda uusin versio ja sen resurssit; mallien työkalu Ilmastoselvitys käyttää samoja tietoja |
| Ruotsi, kansainvälinen | Riksbank (SWEA), Maailmanpankki | Korot, valuuttakurssit, kehitysindikaattorit | Vain sillan kautta |
| EU | Eurostat | EU-tilastot | Anna aineiston koodi ja suodattimet |
| EU | Euroopan keskuspankki (EKP) | Valuuttakurssit ja EKP:n tilastot (SDMX) | Valitse valuutat ja tiheys valuuttakursseille tai anna tietovirta ja sarja-avain |
| Kansainvälinen | OECD | Työttömyys, BKT:n kasvu ja OECD:n muut tilastot (SDMX) | Valitse maat tai anna tietovirta ja sarja-avain |

### Muut Pohjoismaat

| Maa | Lähde | Mitä | Näin noudat |
|---|---|---|---|
| Suomi | Tilastokeskus StatFin | Virallinen tilasto suomeksi, ruotsiksi ja englanniksi | Selaa aihepuuta, valitse arvot; 100 000 solua per kutsu |
| Suomi | Kuntien avainluvut (Tilastokeskus) | Avainluvut kunnittain ja hyvinvointialueittain | Selaa, valitse arvot |
| Suomi | Sotkanet (THL) | Terveyden ja hyvinvoinnin indikaattorit | Nouda indikaattorit ja alueet, sitten arvot indikaattorille ja vuosille |
| Suomi | YTJ (PRH) | Yritykset | Hae nimellä, paikkakunnalla, Y-tunnuksella tai toimialalla |
| Suomi | Digitraffic tiesää (Fintraffic) | Tiesääasemat ja mittaukset | Nouda asemat (pistekartta) ja viimeisimmät mittaukset |
| Suomi | Ilmatieteen laitos | Säähavainnot paikkakunnittain tai asemittain | Anna paikkakunta tai aseman tunnus, parametrit ja jakso |
| Suomi | Avoindata.fi | Suomen dataportaali | Hae aineistoja, yksi rivi per tiedosto |
| Ahvenanmaa | ÅSUB | Virallinen tilasto ruotsiksi ja englanniksi | Selaa, valitse arvot |
| Norja | SSB Statistikkbanken (API v1 ja v2) | Virallinen tilasto norjaksi ja englanniksi | Selaa aihepuuta tai hae taulukko, valitse arvot; 800 000 solua per kutsu |
| Norja | FHI Statistikk | Kansanterveystilastot Norjan kansanterveyslaitoksen rekistereistä ja tilastopankeista | Valitse lähde, taulukko ja arvot ulottuvuuksittain (mittarit MEASURE_TYPE-ulottuvuudessa) |
| Norja | Enhetsregisteret (Brønnøysundregistrene) | Yritykset ja organisaatiot | Hae nimellä, kunnalla, yhtiömuodolla tai toimialakoodilla |
| Norja | Kartverket kommuneinfo | Kunnat ja fylket | Nouda luettelot, myös kunnat fylkeittäin |
| Norja | MET Norway Locationforecast | Sääennuste koordinaatille | Anna leveys- ja pituusaste |
| Tanska | Danmarks Statistik Statistikbanken | Virallinen tilasto (api.statbank.dk) | Selaa aihepuuta, valitse taulukko ja arvot muuttujittain; valitsemattomat muuttujat summataan pois |
| Tanska | Open Data DK | Tanskan kuntien ja alueiden dataportaali | Hae aineistoja, yksi rivi per tiedosto |
| Islanti | Hagstofa Íslands | Virallinen tilasto islanniksi ja englanniksi | Selaa tietokantoja, valitse arvot; 10 000 solua per kutsu |
| Islanti | Veðurstofa Íslands | Säähavainnot asemittain | Anna asemanumerot |
| Grönlanti | Grønlands Statistik | Virallinen tilasto tanskaksi ja englanniksi | Selaa, valitse arvot |
| Färsaaret | Hagstova Føroya | Virallinen tilasto englanniksi | Selaa, valitse arvot |
| Pohjoismaat | Nordic Statistics database | Vertailukelpoinen pohjoismainen tilasto englanniksi | Selaa, valitse arvot |

Ei mukana: Tanskan DMI ja Norjan Frost (MET) vaativat avaimen; Energi Data Servicestä ja data.norge.no:sta puuttuu CORS;
opingogn.is:llä ei enää ole hakurajapintaa. Lähteitä ilman CORS-tukea ei tavoiteta suoraan selaimesta; ne vaativat oman
välityspalvelimen, ks. alla.

Paikkatietolähteet (perhe `geodata`, `kind` `wfs`, `ogcapi` tai `arcgis`) toimitetaan ilman päätepisteitä: tasot luetaan
palvelusta, kun lähde avataan, ja tallennetaan omaan kopioosi määrityksestä. Valmiit: SCB:n avoin paikkatieto, SGU, Havs-
och vattenmyndigheten, Riksantikvarieämbetet, Skogsstyrelsen (ArcGIS), Kartverket (hallinnolliset yksiköt,
kiinteistökartta), Tilastokeskus, SYKE (ArcGIS) ja avaimella Lantmäterietin paikkatietoalusta (asemakaavat). Lähde
*Geodataportalen (sök geodata)* (perhe `geoportal`, vastausmuoto `geonetwork`) hakee Ruotsin kansallisesta luettelosta.
Katso [kallor.md](kallor.md#avoin-paikkatieto).

## Näin teet

1. Avaa **Nouda**-tila ja valitse lähde kohdepaneelin kohdasta **Avoimet rajapinnat**. Luettelon yläpuolella olevat
   maapainikkeet rajaavat sen valittuihin maihin.
2. Jos lähde vaatii avaimen, anna se kohdassa **Tunnistautuminen**. Valitse **Käytä tässä istunnossa** (unohdetaan, kun sivu
   suljetaan) tai **Tallenna salattuna** salalauseella.
3. Selaa tai hae haluamasi. PxWeb-palveluissa (Tilastokeskus, muut pohjoismaiset tilastovirastot, Folkhälsomyndigheten),
   Danmarks Statistikissa, FHI:ssä ja Socialstyrelsenissä valitset arvot muuttujittain; solujen määrä näytetään, ja palvelun
   rajan ylittävät valinnat jaetaan automaattisesti useaan kutsuun. Muissa lähteissä täytät kutsun parametrit. Luettelot
   (asemat, kunnat, tuotteet) noudetaan palvelusta, kun avaat kentän.
4. Paina **Nouda**. Edistyminen näytetään, ja noudon voi peruuttaa. **Esikatsele ensimmäinen sivu** noutaa vain yhden kutsun.
5. Tarkista taulukko ja paina **Tallenna aineistona** tai lisää rivit olemassa olevaan aineistoon (lisää tai korvaa).
   Aineiston kuvaukseen tulee lähde: julkaisija, taulukko, osoite ja lisenssi.

Ominaisuuspaneeli näyttää julkaisijan, lisenssin, pyyntörajan ja viimeisimmät kutsut tiloineen ja vasteaikoineen.

## Noudetun aineiston päivittäminen

Rajapinnasta tulevat aineistot muistavat lähteen ja valinnat. Nouda-tilan kohdassa **Tallennetut haut** ne näytetään lähteen,
viimeisimmän haun ja rivimäärän kanssa. **Päivitä** hakee samat tiedot uudelleen, korvaa rivit ja toistaa aineiston reseptin,
jotta puhdistukset ja lasketut sarakkeet palaavat; **Päivitä kaikki** tekee saman kaikille vuorollaan, ja komentopaletti ja
Hallitse-tila tarjoavat saman toiminnolla **Nouda API-aineistot uudelleen**. Jos haku tai reseptin vaihe epäonnistuu,
aineisto jää ennalleen ja virhe näytetään. Reseptin vaihetta, joka tarvitsee salaisuuden (esimerkiksi pseudonymisoinnin
avaimen), ei voi toistaa automaattisesti. **Hallitse**-tilassa on myös **Nouda uudelleen**, jossa valitset päivittämisen
tai uusien rivien lisäämisen loppuun reseptiä suorittamatta.

## Avaimet ja tietoturva

- Avaimia ei koskaan tallenneta selkokielisinä. Oletuksena ne ovat vain muistissa istunnon ajan.
- **Tallenna salattuna** salaa avaimen salalauseella (PBKDF2 ja AES-GCM) selaimen tietokantaan. Sama salalause koskee kaikkia
  tallennettuja avaimia. Salalausetta ei tallenneta; jos unohdat sen, avaimet on annettava uudelleen.
- Kun sovellus avataan uudelleen, tallennetut avaimet ovat lukittuina, kunnes annat salalauseen (**Avaa tallennetut
  avaimet**).
- Avaimet lähetetään vain määrityksen ilmoittamaan osoitteeseen, eivätkä ne koskaan kulje mukana, kun määritys viedään tai
  työtila varmuuskopioidaan.
- file://-tilassa kaikki paikallisesti avatut HTML-sivut jakavat tallennustilan Chromiumissa. Siksi salaus on oletus
  tallennetuille avaimille.

### Avainten hankkiminen

- **Boverket**: rekisteröidy [Boverketin API-portaaliin](https://api-portal.boverket.se/), tilaa energiatodistusten API ja
  kopioi tilausavain. Dataspatium lähettää sen otsakkeessa `Ocp-Apim-Subscription-Key`. Boverket sallii 10 kutsua kahdessa
  sekunnissa ja 1 500 vuorokaudessa.
- **Lantmäteriet Direkt**: luo tili [Geotorgetiin](https://geotorget.lantmateriet.se/), lisää tuote Ortnamn Direkt (avoin data,
  maksuton) ja luo API-avaimet. Anna asiakastunnus (consumer key) ja asiakassalaisuus (consumer secret); Dataspatium hakee
  käyttötunnisteen osoitteesta `https://api.lantmateriet.se/token` ja uusii sen, kun se vanhenee.
- **Trafikverket**: luo maksuton tili osoitteessa [data.trafikverket.se](https://data.trafikverket.se/) ja kopioi avain.
  Dataspatium lähettää sen XML-rungossa (`<LOGIN authenticationkey="…"/>`), ei koskaan osoitteessa.

## Välityspalvelin palveluille ilman CORS-tukea

Ominaisuuspaneelin kohdassa **Lisää asetuksia** voit antaa itse ylläpitämäsi välityspalvelimen osoitteen, esimerkiksi
`https://oma-proxy.esimerkki/?url={url}`. `{url}` korvataan koodatulla kohdeosoitteella; jos `{url}` puuttuu, kohdeosoite
lisätään loppuun. Dataspatium ei toimita välityspalvelinta eikä koskaan lähetä mitään muulle palvelimelle kuin itse
antamallesi.

## Määritysmuoto

Lähde kuvataan JSON-tiedostolla, jonka pääte on `.api.json`. Omat määritykset lisätään toiminnolla **Lisää API tiedostosta**,
ja ne voi viedä toiminnolla **Vie määritys** jaettaviksi. Valmisasetukset ovat sovelluskansion kansiossa `presets/api/`, ja ne
ovat hyviä lähtökohtia. Tiedoston peruskieli on ruotsi; käännökset lisätään kenttään `i18n` kielittäin, ja sovellus näyttää
tekstit omalla kielellään. Muoto on kuvattu kokonaisuudessaan [englanninkielisessä oppaassa](../en/api-konfiguration.md) ja
[ruotsinkielisessä](../sv/api-konfiguration.md).

### Ylätason kentät

Ylätason kentät ovat `format`, `id`, `name`, `publisher`, `description`, `docs`, `license`, `notes`, `level` (1 = ei avainta, 2 = avain), `country` (`SE`, `DK`, `NO`, `FI`, `IS`, `FO`, `GL`, `AX`, `NORDIC`, `EU`, `INT`), `i18n`, `baseUrl`, `headers`, `auth`, `rateLimit`, `cors`, `family` (`pxweb`, `statbank`, `fhi`, `socialstyrelsen`) ja `endpoints`.

### Endpoint

Päätepisteellä on `id`, `name`, `description`, `method`, `path`, `headers`, `params`, `body`, `bodyType`, `pagination`, `response`, `dataset`.

### Parametri

Parametrilla on `name`, `in`, `type`, `label`, `help`, `example`, `required`, `default`, `hidden`, `raw`, `template`, `optionsFrom`.

### Syntyvä taulukko

JSON-tietueet litistetään (sisäkkäisistä objekteista tulee sarakkeita, joiden nimessä on piste, listoista tulee JSON-tekstiä).
JSON-stat antaa yhden rivin solua kohti, ja jokaisella ulottuvuudella on koodi- ja tekstisarake, lisäksi aikasarake ja yksi
arvosarake mittaria kohti. SDMX-JSON antaa yhden rivin havaintoa kohti: jokaisesta ulottuvuudesta koodisarake (`<nimi>_kod`) ja
tekstisarake, kun koodeilla on tekstit, sekä aikajakso, arvo (`varde`) ja ne sarja- ja havaintoattribuutit, joilla on arvo.
Sarakkeiden nimet siistitään kuten tiedostoja tuotaessa (å, ä, ö muuttuvat a:ksi, a:ksi ja o:ksi), ja tyypit päätellään
desimaalipisteellä; etunollalliset koodit jäävät tekstiksi.

## Oman määrityksen kirjoittaminen

1. Lue palvelun dokumentaatio ja kokeile kutsua selaimessa tai `curl`-komennolla.
2. Tarkista CORS: `curl -s -D - -o /dev/null -H "Origin: null" "https://api.esimerkki.fi/..."` pitäisi näyttää
   `Access-Control-Allow-Origin: *` (tai `null`). Jos rivi puuttuu, palvelu toimii vain välityspalvelimen kautta.
3. Lähde liikkeelle kansion `presets/api/` valmisasetuksesta, muuta sitä ja tallenna nimellä `oma-palvelu.api.json`.
4. Lisää tiedosto Nouda-tilassa. Määrityksen virheet näytetään kenttien niminä; muoto tarkistetaan rakennetta vasten
   (`src/api/schema.js`).
5. Jaa tiedosto. Se ei koskaan sisällä avaimia.

## Rajoitukset

- MET Norwayn ehdot edellyttävät, että kutsuva ohjelma tunnistautuu User-Agent-otsakkeella. Selaimet lähettävät oman
  tunnisteensa, jonka palvelu tällä hetkellä hyväksyy; pidä kutsujen määrä pienenä.
- SDMX luetaan SDMX-JSON 1.0- tai 2.0-muodossa (datasanomat; EKP ja OECD lähettävät sitä parametrilla `format=jsondata`
  tai `Accept`-otsakkeella). SDMX-ML:ää ja SDMX-CSV:tä ei jäsennetä. JSON-stat 1.x (Danmarks Statistik) ja 2.0 luetaan
  molemmat.
- PX-tiedostoja ei jäsennetä JavaScriptillä; nouda JSON-stat tai käytä R:ssä pakettia pxR.
- Suurten vastausten (satoja tuhansia rivejä) jäsentäminen selaimessa vie aikaa. Rajaa valintaa tai käytä `maxPages`-asetusta.
- Kutsuja tehdään vain, kun painat Nouda tai avaat kentän, jonka vaihtoehdot tulevat palvelusta.
