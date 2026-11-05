# Jaa

Jaa-tila kokoaa kaiken, mikä liittyy tiedon antamiseen muille ihmisille ja laitteille. Vie koskee tiedostoja omalle
tietokoneelle; Jaa paketteja, GitHubia, laitteita, jakovalikkoa, julkaisemista ja vastaanottamista. Ennen kuin
aineistot lähtevät sovelluksesta, ne käyvät läpi henkilötietojen tarkistuksen (ks. alla).

## Paketti

Paketti on ZIP-tiedosto, jossa on valitut aineistot ja niihin kuuluvat kohteet: kaaviot, kojelaudat, mallit,
muistikirjat ja skriptit, sekä viesti, lähettäjän nimi ja muutosloki siitä, mitä kullekin aineistolle on tehty sen
jälkeen, kun se viimeksi jaettiin. *Luo paketti* avaa valintaikkunan kaikki aineistot esivalittuina; kun aineisto on
valittu, on myös *Paketoi vain tämä*. Vastaanottaja avaa paketin kohdassa *Vastaanota* ja näkee viestin ja muutokset
ennen kuin mitään otetaan vastaan. Tarkastelupaneeli näyttää, kuinka paljon jaettavaa on. Ks. myös
[format.md](format.md) paketin rakenteesta.

**Tiedostot.** Aineisto, jossa on tiedostoja, näyttää niiden koon, ja voit jättää ne pois paketin pienentämiseksi. Rivit seuraavat mukana. Ilman tiedostojaan kuvakokoelma näyttää vain kuvien tiedot ja asiakirja tekstinsä.

## GitHub

Työtila kansiona GitHub-repositoriossa, mieluiten yksityisessä. Anna repositorio (`omistaja/nimi`), haara ja kansio
sekä hienojakoinen käyttöoikeustunnus, joka saa vain lukea ja kirjoittaa juuri sen repositorion sisältöä. Tunnusta
käytetään istunnon ajan tai se tallennetaan salattuna; mitään ei lähetetä, ennen kuin painat *Lähetä GitHubiin* tai
*Nouda GitHubista*. Vain muuttuneet tiedostot lähetetään yhtenä committina viestisi kera. Noudettaessa valitset,
kuten paketeille, korvataanko jo olemassa olevat aineistot (oma versiosi tallennetaan kohtaan *Versiot*).
Ensimmäisellä kerralla sovellus kysyy lupaa ottaa yhteys GitHubiin (ks. *Internetyhteys* tiedostossa
[anvandarguide.md](anvandarguide.md)).

## Yhteistyö GitHubin kautta

Kun haet GitHubista, täällä olevaa verrataan haettuun niiden historian perusteella. Valintaikkuna kertoo jokaisesta aineistosta,
kuka on muuttanut mitä, ja molempien kommentit ja merkinnät säilyvät aina.

- Jos vain toinen osapuoli on muuttanut dataa, sen versio otetaan käyttöön ja omasi tallennetaan versiona, johon voi palata.
- Jos vain sinä olet muuttanut dataa, versiosi säilyy.
- Jos molemmat ovat muuttaneet, sinä valitset: säilytä molemmat, haettu omana aineistonaan, säilytä omasi tai ota haettu.
  Oletuksena molemmat säilyvät, joten mikään ei katoa.

Muiden kommentit, joita et ole lukenut, näkyvät tilarivillä. Napsautus avaa ne, ja kirjoittajan nimi on jokaisen kommentin
kohdalla. Nimi on se, jonka henkilö on itse antanut.

## Laitteet

Suora siirto puhelimiin, tabletteihin ja toisiin tietokoneisiin paikallisverkon yli ilman palvelinta. Tietokone
näyttää QR-koodin; puhelin skannaa sen kameralla ja avaa Dataspatium Mobiilin, joka vastaanottaa paketit ja
tiedostot, näyttää taulukot ja voi jakaa ne edelleen tai viedä ne toiselle tietokoneelle. Ensimmäisellä kerralla
puhelin näyttää koodin, joka kirjoitetaan tietokoneelle, ja laitteet paritetaan; sen jälkeen yksi skannaus riittää.
Molemmat laitteet näyttävät saman tarkistuskoodin, ja vastaanottaja hyväksyy ennen kuin mitään otetaan vastaan.
Kaksi tietokonetta yhdistetään liitettävillä koodeilla. Koko kulku, vaatimukset ja vianetsintä ovat tiedostossa
[mobil.md](mobil.md). Painike *QR-koodi mobiilisivulle* näyttää osoitteen, joka skannataan mobiilisivun avaamiseksi
ensimmäisen kerran.

## Tarkistus ennen jakamista

Kaikki, mikä lähtee sovelluksesta pakettien, laitteiden tai jakovalikon kautta, tarkistetaan ensin, ja tarkistus koskee koko tiedostoa. Sovellus etsii henkilötunnuksia, sähköpostiosoitteita ja
puhelinnumeroita sekä kokonaisista sarakkeista että juoksevan tekstin sisältä ja luettelee sen, mikä muuten kulkee mukana näkymättä taulukossa. Valitset kullekin osalle, mitä kopiossa tapahtuu.

| Osa | Valinta |
|---|---|
| Sarake, jossa on henkilötunnuksia, sähköposteja tai puhelinnumeroita | Säilytä, pseudonymisoi tai poista. Pseudonymisointi tarkoittaa, että sama arvo antaa saman koodin, mutta arvoa ei voi lukea |
| Juokseva teksti, kuten asiakirjojen kappaleet | Säilytä, peitä osumat tai poista sarake |
| Graafin särmät ja mallin ominaisuudet | Säilytä, peitä osumat tai poista kopiosta |
| Alkuperäiset tiedostot | Säilytä tai poista. Niitä ei voi pseudonymisoida, joten poistamista ehdotetaan, kun jotain muuta muutetaan |
| Kuvat | Säilytä tai poista. Sijainti poistetaan erikseen sekä taulukosta että kuvatiedostosta |
| Kommentit ja tekijät asiakirjojen metatiedoissa | Säilytä tai poista |
| Kerätyt rivit | Kerääjä voidaan pseudonymisoida ja sijainti poistaa |

Vain jaettava kopio muuttuu, ja sovelluksen aineisto säilyy ennallaan. Jos muutat jotain, muutosloki ja resepti eivät tule mukaan, koska ne voivat sisältää alkuperäiset arvot. Paketeista poistetaan
myös poistettujen arvojen jäänteet itse tiedostossa.

Tarkistus ei näe kaikkea. Nimet, osoitteet ja alkuperäisten tiedostojen ja kuvien sisältö on arvioitava itse. Paketin kaaviot, muistikirjat ja asiakirjat voivat näyttää alkuperäiset arvot, joten jätä
ne tarvittaessa pois. Tiedostonimet kulkevat mukana.

**GitHub**-synkronointi on voitava noutaa takaisin sellaisena kuin se oli, joten siinä mitään ei voi pseudonymisoida. Sovellus näyttää sen sijaan ennen lähetystä, mikä voi olla henkilötietoja.
**Julkaise** luo HTML-sivun kaavioiden näyttämistä arvoista, joten tarkista ne ennen sivun julkaisemista.

## Jakovalikko

Tietokoneen tai puhelimen oma jakovalikko: lähetä tiedosto sähköpostiin, Teamsiin, viestisovelluksiin tai muihin
sovelluksiin. Valitse, jaetaanko valittu aineisto tiedostona (CSV, Excel, ODS tai JSON) vai kaikki aineistot
pakettina, ja paina *Jaa*. Tiedostojen jakovalikko on Edgessä ja Chromessa Windowsissa ja mobiilissa; muissa
selaimissa (Firefox) tiedosto tallennetaan sen sijaan, ja painikkeen nimi on silloin *Tallenna tiedosto*. Puhelimessa,
johon Dataspatium Mobiili on asennettu, tiedostoja voi jakaa myös *Dataspatiumiin* muista sovelluksista; ne
tulevat mobiilisivun kohtaan *Vastaanotettu*.

## Julkaise

Itsenäinen HTML-tiedosto, joka toimii ilman Dataspatiumia ja jonka voi laittaa intranetiin tai lähettää: kojelaudat
(kaaviot upotettuina) ja asiakirjat malleista, täytettyinä valitulla aineistolla. Julkaistut tiedostot sisältävät
datan ja kaaviot selkokielisinä; jaa ne vain niille, jotka saavat nähdä tiedot.

**Aineisto omana sivunaan.** Kohdassa Aineistot aineistosta tulee sivu omassa muodossaan: luettava teksti, selattavat kuvat, kartta, verkko tai suodatettava taulukko. Sivu ei hae mitään verkosta, ja sen voi lähettää yhtenä tiedostona. Se käy ensin läpi tarkistuksen ja näyttää enintään 2 000 riviä tai 100 kuvaa.

## Työtilan julkaiseminen

*Julkaise työtila* tekee koko työtilasta tai sen osasta verkkosivuston intranetiin tai lähetettäväksi. Siitä tulee ZIP, jossa on
aloitussivu ja sivu kullekin aineistolle, koontinäytölle ja asiakirjalle, ja taulukoissa on haku ja jokaisen aineiston alla
koodikirja. Sivuja voi vain lukea, ne on yhdistetty suhteellisilla linkeillä, eivätkä ne hae mitään verkosta.

Aineistot käyvät läpi tarkistuksen ja näytetään kopioista. Koontinäytöt ja asiakirjat piirretään aineistoista sellaisina kuin ne
ovat, joten niiden sisällöstä kerrotaan ja päätät itse, tulevatko ne mukaan.

## Vastaanota

Avaa paketti tiedostosta (pudota se alueelle) tai verkko-osoitteesta. Lähettäjä, viesti ja muutokset näytetään
ensin; jo olemassa olevat aineistot voi korvata paketin versiolla, muuten ne ohitetaan. Myös varmuuskopion (ZIP
toiminnosta *Varmuuskopioi työtila*) voi avata tässä, mutta sen paikka on Hallitse-tilan Työtila-kohdassa.

## Mikä ei onnistu

Selain ei voi olla palvelin, joten muut eivät voi noutaa dataa tietokoneeltasi, kun se on sammutettu tai kun he
eivät ole samassa verkossa; silloin tiedosto tai paketti kulkee jakovalikon, pilvikansion (Hallitse-tilan
siirrettävä kansio voi olla OneDrivessa tai Dropboxissa) tai GitHubin kautta. Samassa verkossa siirto tapahtuu
suoraan laitteiden välillä (Laitteet-välilehti). `mailto:`-linkit eivät voi kantaa liitteitä; käytä jakovalikkoa
tai tallenna tiedosto ja liitä se.
