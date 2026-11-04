# Usein kysytyt kysymykset

## Mihin datani tallennetaan?

Selaimen omaan tietokantaan (IndexedDB) sillä tietokoneella ja siinä selainprofiilissa, jota käytät. Mitään ei lähetetä
minnekään. Jos tyhjennät sivustotiedot, vaihdat profiilia tai poistat selaimen, data katoaa. Tee siksi varmuuskopioita
kohdassa *Hallitse → Työtila* tai käytä Edgessä ja Chromessa siirrettävää kansiota, jolloin työtila on myös tavallisina
tiedostoina levyllä (ks. [kom-igang.md](kom-igang.md)).

## Tarvitsenko internetiä?

En. Internetiä tarvitaan vain, kun noudat dataa rajapinnasta, lähetät GitHubiin tai noudat sieltä, napsautat
*Tarkista päivitykset* tai käytät jotakin, mikä ei tule kansion mukana: jotkin komponentit (esimerkiksi
taustakartat) ja sisäänrakennetun valikoiman ulkopuoliset R-paketit noudetaan tarvittaessa ja tallennetaan sitten
paikallisesti. Kun sovellus tarvitsee ensimmäisen kerran internetiä jotakin tarkoitusta varten, se kysyy lupaa;
vastauksen voi tallentaa ja muuttaa kohdassa *Hallitse → Työtila → Internetyhteys*, jossa on myös kutsujen loki.
Kaikki muu, myös R, toimii ilman verkkoa.

## Miksi R:n ensimmäinen käyttökerta kestää?

R ladataan WebAssemblynä (noin 50 Mt) ja käynnistyy muutamassa sekunnissa. Paketit kuten ggplot2 asennetaan R-istuntoon
ensimmäisellä käyttökerralla, mikä kestää vielä muutaman sekunnin. R-istunto alkaa alusta, kun lataat sivun uudelleen, mutta
aineistosi ja skriptisi säilyvät.

## Voinko keskeyttää jumittuneen R-koodin?

Voit, kun sovellus ajetaan verkkopalvelimelta (esimerkiksi `python -m http.server 8080` omalla tietokoneella tai https
intranetissä): silloin R-välilehdellä on *Suorita*-painikkeen vieressä painike *Keskeytä*, ja R-istunto objekteineen
säilyy. Kun sovellus avataan kansiosta (file://), selain ei salli tarvittavaa mekanismia; käytä silloin Analysoi-tilassa
toimintoa *Käynnistä R uudelleen*. Aineistot eivät muutu.

## Miten Python toimii sovelluksessa?

Python (Pyodide) ei tule kansion mukana. Kun painat ensimmäisen kerran *Käynnistä Python* tai *Suorita*
Python-välilehdellä, sovellus kysyy lupaa hakea komponentteja ja lataa Pythonin sekä numpyn ja pandasin (noin 22 MB)
jsDelivristä, tarkistettuina tunnettuja tarkistesummia vasten. Sen jälkeen kaikki tallennetaan selaimeen, ja Python
käynnistyy ilman internetiä. Koodin tuomat paketit (matplotlib, scipy, scikit-learn ja muut Pyodiden valikoimassa)
haetaan samalla tavalla tarvittaessa. Ks. [python.md](python.md).

## Miksi jokin rajapinta ei toimi?

Useimmiten rajapinnalta puuttuu CORS-tuki eli selain ei saa lukea vastausta. Silloin Dataspatium tavoittaa sen vain
välityspalvelimen kautta, jota ylläpidät itse (asetus Nouda-tilassa). Jotkin rajapinnat vaativat lisäksi avaimen. Ks.
[api-konfiguration.md](api-konfiguration.md), jossa kerrotaan myös avainten hankkimisesta.

## Miten API-avaimet tallennetaan?

Joko vain muistiin istunnon ajaksi tai salattuna valitsemallasi salalauseella. Ei koskaan selkokielisinä, eivätkä ne koskaan
kulje mukana, kun jaat määrityksen.

## Kuinka suuria aineistoja sovellus kestää?

Pari miljoonaa riviä Edgessä ja Chromessa, hieman vähemmän Firefoxissa; selaimen muisti asettaa rajan. Mitatut ajat miljoonalle
riville ovat tiedostossa [utveckling.md](../utveckling.md) (ruotsiksi). Vähintään 64 Mt:n tekstitiedostot luetaan osissa,
joten itse lukeminen ei vaadi koko tiedoston mahtumista muistiin tekstinä.

## Mitä eroa on Firefoxilla ja Edgellä tai Chromella?

Ulkoasu ja toiminnot ovat samat, mutta Firefoxista puuttuu kansioiden käyttö, joten siirrettävää kansiota ei ole siellä.
ZIP-varmuuskopio toimii kaikkialla.

## Voiko sovellusta käyttää verkkopalvelimelta tai intranetistä?

Voi. Sijoita kansio muuttamattomana mille tahansa staattiselle verkkopalvelimelle; palvelintoimintoja ei tarvita.
https-yhteydellä ja omalla tietokoneella osoitteessa `http://localhost` sovellus rekisteröi service workerin
(`sw-coi.js`), joka tekee sivusta *cross-origin isolated* -tilaisen, ja silloin R-koodin voi keskeyttää. Ensimmäisellä
kerralla sivu latautuu kerran uudelleen, kun service worker ottaa ohjauksen. Tavallisella http-yhteydellä intranetissä
selain ei salli service workereita, mutta palvelin, joka itse lähettää otsakkeet `Cross-Origin-Opener-Policy: same-origin`
ja `Cross-Origin-Embedder-Policy: credentialless`, antaa saman tuloksen. Kaikki muu toimii kuten kansiosta. Selain
tallentaa datan osoitekohtaisesti, joten kansion työtila ja palvelimen työtila ovat erillään; siirrä niiden välillä
varmuuskopiolla tai paketilla.

Verkkopalvelimelta, myös osoitteesta <https://marwiss.github.io/Dataspatium/>, sovelluksen voi asentaa omaksi
sovellukseksi: Edgessä ja Chromessa osoiterivin *Asenna*-kuvakkeesta tai selaimen valikosta. Se saa silloin oman
ikkunan ja kuvakkeen, tiedostot tallennetaan selaimeen, jotta se toimii ilman verkkoa, ja tallennustilasta tulee
pysyvä. Uudet versiot noudetaan, kun sovellus avataan uudelleen verkon kanssa.

## Voinko avata index.html-tiedoston suoraan ZIP-tiedostosta?

Et. Pura ZIP-tiedosto ensin (napsauta hiiren kakkospainikkeella ja valitse Windowsissa *Pura kaikki*) ja avaa sitten
`index.html` puretusta kansiosta.

## Miten päivitän?

Lataa uusi versio ja pura se uuteen kansioon. Datasi on selaimessa, ei kansiossa, joten se säilyy, kun avaat uuden version
`index.html`-tiedoston samalla tietokoneella ja samassa selaimessa. Ohjepainikkeen alla on *Tarkista päivitykset*, joka
vertaa versiotasi GitHubin uusimpaan julkaisuun. Tarkistus tehdään vain, kun napsautat.

## Voinko vaihtaa kieltä?

Voit. Kun sovellus avataan ensimmäisen kerran, valitset kielen; sen jälkeen oikean yläkulman kielipainike (kirjainkuvake) tai
paletin komento *Kieli* avaa saman valinnan. Saatavilla ovat ruotsi, tanska, norja (bokmål), suomi, islanti ja englanti.
Sovellus latautuu uudelleen valitulla kielellä, kun tallentamattomat muutokset on tallennettu. Valinta tallennetaan selaimeen,
joten jokaisella tietokoneella ja profiililla on omansa. Dokumentaatio on samoilla kielillä kansiossa `docs`.

## Onko lähteitä muista Pohjoismaista?

On. Nouda-tilan *Avointen rajapintojen* alla ovat Suomen, Ruotsin, Norjan, Tanskan, Islannin, Grönlannin, Färsaarten ja
Ahvenanmaan tilastovirastot, Nordic Statistics, THL:n Sotkanet, PRH:n YTJ, Digitraffic, Ilmatieteen laitos, avoindata.fi,
Norjan kansanterveyslaitos, Brønnøysundin rekisterit, Kartverket, MET Norway, Veðurstofa Íslands ja Tanskan dataportaali.
Luettelon yläpuolella olevat maapainikkeet valitsevat, minkä maiden lähteet näytetään; valinta tallennetaan selaimeen.
Kaikki lähteet on tarkistettu CORS-tuen osalta, eivätkä ne vaadi avainta. Ks. [api-konfiguration.md](api-konfiguration.md).

## Voiko sovellus olla auki useassa välilehdessä?

Voi. Välilehdet jakavat saman työtilan ja pitävät toisensa ajan tasalla: jos tallennat tai poistat jotain yhdessä
välilehdessä, muut lataavat luettelonsa uudelleen ja kirjaavat tapahtuneen. Älä silti muokkaa samaa aineistoa kahdessa
välilehdessä yhtä aikaa; jos molemmissa on tallentamattomia muutoksia, viimeksi tallentava voittaa.

## Voiko jokin toinen paikallinen HTML-tiedosto lukea dataani?

Edgessä ja Chromessa kaikki file://-tilassa avatut tiedostot jakavat saman tallennustilan. Älä siis avaa tuntemattomia
HTML-tiedostoja paikallisesti, kun sovelluksessa on arkaluonteista dataa. Avaimia ei koskaan tallenneta selkokielisinä.
Firefox pitää paikalliset tiedostot erillään.

## Saanko käyttää sovellusta työssäni?

Saat, jos työnantaja on viranomainen, kunta, hyvinvointialue, koulu, korkeakoulu tai yleishyödyllinen järjestö eli kyse on
ei-kaupallisesta käytöstä. Kaupallinen käyttö vaatii lisenssinantajan luvan. Ks. [licenser.md](licenser.md).

## Miten teen kartan?

Ruotsista: napsauta Nouda-tilassa *Ruotsin kuntien rajat (SCB)* tai *Ruotsin läänien rajat (SCB)*; rajat tulevat sovelluksen
mukana. Muista maista tuot rajat GeoJSON-, shapefile- tai GeoPackage-tiedostosta. Yhdistä sitten arvosi rajoihin koodin
perusteella Muokkaa-tilassa (*Yhdistä aineistoja*) ja valitse Visualisoi-tilassa kaaviotyyppi *Kartta*. Pisteet pituus- ja
leveysasteineen (esimerkiksi mittausasemat) piirretään *Pistekartalla*. Ks. [visualisera.md](visualisera.md).

## Miten yhdistän useita aineistoja yhdessä SQL-kyselyssä?

Jokaisella aineistolla on lyhytnimi (näkyy nimen alla kohdepaneelissa, muutetaan kohdassa Hallitse > Nimeä uudelleen).
Analysoi-tilan SQL-välilehdellä valitun aineiston nimi on `data`, mutta siihen pääsee myös lyhytnimellä, ja kaikkiin muihin
aineistoihin viitataan niiden lyhytnimillä: `select k.kommun, b.folkmangd from befolkning_2024 b join kommungranser k on
k.kommunkod = b.kommunkod`. Tuloksen voi tallentaa uutena aineistona. R:ssä `dm_read("lyhytnimi")` lukee saman aineiston.
Ks. [bearbeta.md](bearbeta.md).

## Miten tarkistan, että data on kunnossa?

*Datan laatu* Muokkaa-tilassa profiloi kaikki sarakkeet ja ehdottaa toimintoja. *Säännöt* antavat sinun kirjata vaatimuksia
(ei saa puuttua, yksilöllinen, väli, luettelo, kuvio, pituus tai SQL-ehto) ja ajaa ne jokaisen tuonnin jälkeen; rikkovat
rivit voi tallentaa omaksi aineistokseen ja tuloksen ladata raporttina. Säännöt tallennetaan aineistoon ja kulkevat mukana,
kun jaat sen. Ks. [bearbeta.md](bearbeta.md).

## Voinko poistaa henkilötunnukset ennen aineiston jakamista?

Voit. Muokkaa-tilan toiminto *Pseudonymisoi* korvaa tunnisteet suolatuilla tiivisteillä, peitetyillä arvoilla tai
juoksevilla numeroilla, ja datan laatuprofiili ehdottaa sitä, kun sarake näyttää sisältävän henkilötunnuksia. Kyse on
pseudonymisoinnista, ei anonymisoinnista: muut sarakkeet voivat yhä yksilöidä henkilöitä, joten käy koko aineisto läpi ennen
jakamista. Ks. [bearbeta.md](bearbeta.md).

## Miten jaan dataa kollegan kanssa?

Helpoimmin *Jaa*-tilassa: kohdassa *Paketti* valitset aineistot ja otetaanko kaaviot, kojelaudat, mallit,
muistikirjat ja skriptit mukaan, kirjoitat viestin ja lähetät ZIP-tiedoston, esimerkiksi välilehdeltä *Jakovalikko*
(sähköposti, Teams ja muut sovellukset). Kollega avaa sen kohdassa *Vastaanota*, näkee viestisi ja muutokset ja voi
korvata omat versionsa. Kommentit, kansiot ja tunnisteet tulevat mukana. Samassa verkossa paketti kulkee suoraan tietokoneiden välillä tai
puhelimen kautta (välilehti *Laitteet*, ks. [mobil.md](mobil.md)). Jos työskentelette samassa työtilassa, voitte
käyttää myös yhteistä GitHub-repositoriota (välilehti *GitHub*). Ennen kuin mikään lähtee sovelluksesta, aineistot
tarkistetaan henkilötietojen varalta; ne voi pseudonymisoida tai poistaa kopiosta. Kojelaudat ja asiakirjat voi julkaista
itsenäisinä HTML-tiedostoina (välilehti *Julkaise*). Voit myös viedä yksittäisen aineiston SQLite-muodossa
(säilyttää tyypit, selitteet, kommentit ja historian) tai varmuuskopioida koko työtilan. Kaaviot ja asiakirjamallit
voi viedä JSON-tiedostoina, API-määritykset `.api.json`-tiedostoina ja reseptit JSON-, R- tai SQL-muodossa. Ks.
[dela.md](dela.md).

## Miten avaan peruskurssin uudelleen?

Napsauta oikean yläkulman kysymysmerkkiä ja valitse *Avaa peruskurssi*, tai paina Ctrl+K ja kirjoita *peruskurssi*.
Kurssi jatkuu siitä, mihin jäit; jos olet käynyt sen loppuun, se alkaa alusta. Kurssi on saatavilla kaikilla kuudella
kielellä.

## Miten pidän järjestystä monissa aineistoissa?

Anna niille kansiot ja tunnisteet: *Järjestä* Hallitse-tilassa, tai vedä aineisto kansioon kohdepaneelissa.
Kansioilla voi olla alikansioita (`Talous/2026`), suodatinkenttä hakee nimestä, tunnisteesta ja kansiosta, ja
valintaruudut valitsevat useita aineistoja erätoimintoja varten. Kansio ja tunnisteet kulkevat aineiston mukana
paketeissa ja varmuuskopioissa, ja R:ssä `dm_list()` näyttää kansion.

## Mitä komponentit ovat?

Sovelluksen osia, jotka eivät tule kansion mukana, jotta se pysyy pienenä: esimerkiksi taustakartat ja
sisäänrakennetun valikoiman ulkopuoliset R-paketit. Ne noudetaan kiinteästä osoitteesta, kun jokin tarvitsee niitä,
luvan antamisen jälkeen, ja ne tarkistetaan tunnettua tarkistussummaa vastaan, kun sellainen on. Sen jälkeen ne
tallennetaan selaimeen, eikä niitä tarvitse noutaa uudelleen. Kohdassa *Hallitse → Työtila → Komponentit* näet,
mitä komponentteja on ja kuinka suuria ne ovat, ja voit noutaa ne etukäteen tai poistaa ne.

## Voinko käyttää sovellusta puhelimessa?

Koko sovellus on tehty tietokoneille, mutta puhelin voi olla mukana: Dataspatium Mobiili
(<https://marwiss.github.io/Dataspatium/m/>) vastaanottaa paketteja ja tiedostoja tietokoneelta paikallisverkon yli,
näyttää taulukot, jakaa ne edelleen ja vie ne toiselle tietokoneelle. Avaa tietokoneella *Jaa → Laitteet* ja
skannaa QR-koodi; ks. [mobil.md](mobil.md). Tableteilla palvelintilassa koko sovellusta voi käyttää: kapeissa
ikkunoissa tilanvalitsin näyttää kuvakkeet ja paneelit avautuvat työalueen päälle.

## Miten siirrän dataa puhelimeen ilman internetiä?

Tietokone ja puhelin tarvitsevat vain saman paikallisverkon; siirto tapahtuu suoraan niiden välillä WebRTC:llä eikä
kulje palvelimen kautta. Ensimmäisellä kerralla puhelimen on noudettava mobiilisivu verkosta (tai omalta
verkkopalvelimelta intranetissä); sen jälkeen se on välimuistissa. Jos yhteistä verkkoa ei ole: kytke puhelimen
yhteyden jakaminen päälle ja yhdistä tietokone siihen. Ks. [mobil.md](mobil.md).

## Missä ohje on?

Sovelluksessa: oikean yläkulman **?**-painike tai F1 avaa käsikirjan sen tilan luvusta, jossa olet, ja siinä on haku
kaikista osioista sekä linkit dokumenttien välillä. Samat tekstit ovat GitHubissa kansiossa [docs/](anvandarguide.md).
Peruskurssi avataan käsikirjasta tai näppäimillä Ctrl+K.

## Voinko näyttää kojelaudan suurella näytöllä?

Kyllä. Avaa kojelauta Visualisoi-tilassa ja napsauta **Esitä**: kojelauta täyttää ikkunan, nuolinäppäimet näyttävät
kaavion kerrallaan, F antaa koko näytön ja Esc lopettaa. Yhteiset suodattimet pysyvät ylhäällä. Ks.
[visualisera.md](visualisera.md).

## Voinko lukea Access-tietokannan tai SQL Server -taulun?

Kyllä. Access-tiedostot (mdb, accdb) pudotetaan Nouda-tilan alueelle ja luetaan suoraan selaimessa. SQL Server,
ODBC-lähteet, Excel ja Access-kyselyt tavoitetaan tietokantasillan kautta, pienellä skriptillä, jonka käynnistät
tietokoneella; palvelut kuten PostgREST, OData ja GraphQL lisätään lähteiksi osoitteella. Ks. [kallor.md](kallor.md).

## Etkö löydä vastausta täältä?

Lue [anvandarguide.md](anvandarguide.md) tai avaa issue GitHubissa (ks. [CONTRIBUTING.md](../../CONTRIBUTING.md)).
