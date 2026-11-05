# Dataspatium Mobiili ja siirto laitteiden välillä

Dataspatium Mobiili on pieni sivu puhelimille ja tableteille, joka vastaanottaa, näyttää ja jakaa edelleen dataa
Dataspatiumista. Se toimii verkosta (<https://marwiss.github.io/Dataspatium/m/> tai samasta kansiosta kuin sovellus
omalla verkkopalvelimella) ja sen voi asentaa sovellukseksi. Koko Dataspatium ei toimi puhelimessa: mobiilisivu on
kuriiri, vastaanottaja, katselin ja edelleenjakaja.

Siirto tapahtuu suoraan laitteiden välillä paikallisverkon yli WebRTC:llä, ilman palvelinta ja ilman, että data
kulkee internetin kautta. Tietokone näyttää QR-koodin, puhelin skannaa sen, ja molemmat näyttävät saman
tarkistuskoodin. Sama tekniikka yhdistää kaksi tietokonetta liitettävillä koodeilla.

## Ensimmäinen kerta: parita puhelin

1. Tietokoneella: avaa *Jaa → Laitteet*, jätä *Yhdistä laitteeseen* arvoon *Uusi laite* ja napsauta *Näytä
   QR-koodi*.
2. Puhelimella: avaa kamera ja suuntaa se QR-koodiin. Mobiilisivu avautuu selaimeen (ensimmäisellä kerralla se
   noudetaan verkosta; sen jälkeen se on puhelimen välimuistissa). Puhelin näyttää 52 merkin koodin.
3. Tietokoneella: kirjoita puhelimen koodi QR-koodin alla olevaan kenttään ja napsauta *Yhdistä*. Kameralla
   varustettu tietokone voi tulevassa versiossa skannata puhelimen QR-koodin sen sijaan.
4. Molemmat laitteet näyttävät nyt saman kuusinumeroisen tarkistuskoodin. Jos se täsmää: napsauta tietokoneella
   *Parita laite*. Puhelin saa tiedon ja tallentaa parituksen myös.

Seuraavalla kerralla riittää, että valitset puhelimen tietokoneen kohdassa *Yhdistä laitteeseen*, näytät QR-koodin
ja skannaat: yhteys muodostuu ilman mitään koodia takaisin. Paritus koostuu puhelimen varmenteesta ja laitteiden
jakamasta salaisuudesta; se tallennetaan selaimeen molemmin puolin ja sen voi poistaa kohdassa *Paritetut
laitteet* (tietokone) tai tyhjentämällä sivustotiedot (puhelin).

## Lähettäminen tietokoneelta

Kohdassa *Lähetä* valitset valitut aineistot tai kaikki aineistot pakettina, tai tiedostoja tietokoneelta.
Aineistot käyvät ensin läpi tarkistuksen ennen jakamista (ks. [dela.md](dela.md)): sarakkeet, jotka näyttävät
sisältävän henkilötunnuksia, sähköposteja tai puhelinnumeroita, voi pseudonymisoida tai poistaa kopiosta. Puhelin
kysyy ennen vastaanottamista ja näyttää tarkistuskoodin vielä kerran. Siirto kulkee lohkoina tarkistussummineen; jos
se katkeaa, se jatkuu jo perille tulleista lohkoista, kun yhdistätte uudelleen.

## Puhelimessa

- **Vastaanotettu** luettelee paketit ja tiedostot aineistojen määrän, koon ja lähettäjän kanssa. Paketti avautuu
  aineistoluettelona; aineisto näytetään taulukkona suodattimella ja sivutuksella, ensimmäinen sarake kiinteänä, kun
  taulukkoa vieritetään sivusuunnassa.
- **Jaa edelleen** lähettää paketin tai tiedoston puhelimen jakovalikon kautta (sähköposti, viestit,
  pilvitallennus).
- **Lähetä tietokoneelle** laittaa paketin jonoon: skannaa toisen tietokoneen QR-koodi, niin se lähetetään sinne,
  kun yhteys on auki. Näin toimii kuriirikulku tietokone → puhelin → tietokone, myös kahden verkon välillä.
- Puhelin voi myös lähettää omia tiedostojaan (*Lähetä tiedostoja puhelimesta*) yhdistetylle tietokoneelle; ne
  tuodaan siellä aineistoiksi tai avataan kohdassa *Vastaanota*, jos kyse on paketista.
- Puhelimen sovellukset voivat jakaa tiedostoja Dataspatium Mobiiliin jakovalikon kautta, kun mobiilisivu on
  asennettu sovellukseksi; tiedostot tulevat kohtaan *Vastaanotettu*.
- *Asetuksissa* ovat puhelimen nimi (jonka tietokone näyttää), sen koodi ja kieli.

Aineisto näytetään omassa muodossaan: selattavat kuvat, luettavat asiakirjat, paikat pisteinä, graafin solmut särmien määrineen, mallin osat ja kaavan määräykset. Rivit ovat kohdassa *Rivit*.

## Tietokoneesta tietokoneeseen

Valitse toisella tietokoneella *Toinen tietokone (liitä koodi)* ja liitä koodi toisen tietokoneen *Näytä
QR-koodi* -näkymästä (painike *Kopioi* QR-koodin alla). Ensimmäinen tietokone näyttää sitten vastauskoodin, joka
liitetään toiselle kohtaan *Koodi laitteesta*. Sen jälkeen kaikki toimii kuten tietokoneen ja puhelimen välillä,
paritus mukaan lukien.

## Keruu maastossa

Tietokoneelta tullut lomake on aloitussivun yläosassa. Puhelin täyttää rivit ilman verkkoa, valokuvan ja sijainnin kera, ja tarkistaa ne heti lomaketta ja
aineiston sääntöjä vasten. *Lähetä tietokoneelle* vie ne takaisin samaa yhteyttä pitkin. Katso [insamling.md](insamling.md).

## Vaatimukset ja rajoitukset

- Laitteiden on tavoitettava toisensa verkossa. Kotiverkoissa ja useimmissa toimistoverkoissa se toimii; verkot,
  jotka eristävät asiakkaat toisistaan (vierasverkot, jotkin yritysverkot), estävät yhteyden. Jaa silloin
  tilapäisesti tietokoneen tai puhelimen oma verkko (yhteyden jakaminen).
- Tietokone tarvitsee Edgen, Chromen tai Firefoxin. Puhelin tarvitsee WebRTC-tuen sisältävän selaimen ja
  skannaukseen kameran; Android Chromessa QR-koodit luetaan suoraan sivulla, muissa selaimissa koodi avataan
  kamerasovelluksella tai liitetään.
- Puhelimen on tavoitettava verkko ensimmäisellä kerralla mobiilisivun noutamiseksi; sen jälkeen se toimii ilman
  verkkoa lukuun ottamatta itse siirtoa, joka tapahtuu paikallisesti.
- Mitään dataa ei lähetetä millekään palvelimelle. QR-koodi sisältää tietokoneen verkko-osoitteen ja
  kertakäyttöavaimen; tarkistuskoodi suojaa siltä, että joku muu verkossa liittyisi mukaan. Parita vain laitteita,
  joiden tarkistuskoodin olet vertaillut.
- Siirto pysyy muistissa; hyvin suuret paketit (useita satoja megatavuja) voivat olla puhelimelle liikaa.

## Vianetsintä

- *Odotetaan, että laite yhdistää* ei katoa: laitteet ovat eri verkoissa tai verkko estää niiden välisen
  liikenteen. Kokeile yhteyden jakamista puhelimesta ja yhdistä tietokone siihen.
- *Vastapuoli ei ole se laite, johon koodi viittaa*: kirjoitettu koodi kuuluu toiselle puhelimelle. Kirjoita se
  uudelleen.
- Tarkistuskoodit eroavat: katkaise yhteys. Joku muu on voinut skannata koodin.
- Tietokoneen alareunan loki näyttää yhteyden jokaisen vaiheen.
