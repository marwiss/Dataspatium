# Usein kysytyt kysymykset

## Mihin datani tallennetaan?

Selaimen omaan tietokantaan (IndexedDB) sillä tietokoneella ja siinä selainprofiilissa, jota käytät. Mitään ei lähetetä
minnekään. Jos tyhjennät sivustotiedot, vaihdat profiilia tai poistat selaimen, data katoaa. Tee siksi varmuuskopioita
kohdassa *Hallitse → Työtila* tai käytä Edgessä ja Chromessa siirrettävää kansiota, jolloin työtila on myös tavallisina
tiedostoina levyllä (ks. [kom-igang.md](kom-igang.md)).

## Tarvitsenko internetiä?

En. Internetiä tarvitaan vain, kun noudat dataa rajapinnasta tai napsautat *Tarkista päivitykset*. Kaikki muu, myös R, toimii
ilman verkkoa.

## Miksi R:n ensimmäinen käyttökerta kestää?

R ladataan WebAssemblynä (noin 50 Mt) ja käynnistyy muutamassa sekunnissa. Paketit kuten ggplot2 asennetaan R-istuntoon
ensimmäisellä käyttökerralla, mikä kestää vielä muutaman sekunnin. R-istunto alkaa alusta, kun lataat sivun uudelleen, mutta
aineistosi ja skriptisi säilyvät.

## Voinko keskeyttää jumittuneen R-koodin?

Et. file://-tilassa selain ei salli mekanismia, jota R:n keskeyttäminen kesken laskennan vaatii. Käytä Analysoi-tilassa
toimintoa *Käynnistä R uudelleen*; aineistot eivät muutu.

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

Voi. Sijoita kansio muuttamattomana mille tahansa staattiselle verkkopalvelimelle. Palvelintoimintoja ei tarvita.

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

Helpoimmin toiminnolla *Jaa paketti* kohdassa *Hallitse → Työtila*: valitse aineistot ja otetaanko kaaviot, kojelaudat, mallit
ja muistikirjat mukaan, ja lähetä ZIP-tiedosto. Kollega pudottaa sen alueelle *Palauta ZIP-tiedostosta*. Voit myös viedä
yksittäisen aineiston SQLite-muodossa (säilyttää tyypit, selitteet ja historian) tai varmuuskopioida koko työtilan. Kaaviot ja
asiakirjamallit voi viedä JSON-tiedostoina, API-määritykset `.api.json`-tiedostoina ja reseptit JSON-, R- tai SQL-muodossa.

## Etkö löydä vastausta täältä?

Lue [anvandarguide.md](anvandarguide.md) tai avaa issue GitHubissa (ks. [CONTRIBUTING.md](../../CONTRIBUTING.md)).
