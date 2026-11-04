# Työnkulut ja seurannat

**Työnkulku** on tallennettu vaiheiden ketju, joka ajetaan yhdellä napsautuksella tai sovelluksen käynnistyessä: nouda uudet
tiedot, käsittele, piirrä kaaviot, kirjoita asiakirjat ja vie. Se on kuukausiraportti yhdessä painikkeessa. **Seuranta** pitää
kirjaa siitä, onko aineiston lähde muuttunut, ja kertoo sen tilarivillä. Molemmat löytyvät Hallitse-tilan objektipaneelista
kohdasta *Työnkulut ja seurannat*.

## Työnkulun luominen

Paina *Uusi työnkulku*, anna sille nimi ja lisää vaiheet. Vaiheet ajetaan ylhäältä alas, ja siirrät niitä nuolilla.

| Vaihe | Mitä se tekee |
|---|---|
| Nouda uudet tiedot | Lukee lähteen uudelleen ja toistaa aineiston reseptin, yhdelle aineistolle tai kaikille noudetuille |
| Toista resepti | Tekee saman käsittelyn toiselle aineistolle |
| Aja R- tai Python-skripti | Ajaa tallennetun skriptin Analysoi-tilasta; `dm_write`-funktiolla kirjoitetuista tulee aineistoja |
| Tallenna luettelo aineistona | Ajaa tallennetun luettelon tai kyselyn Hae-tilasta; seuraava ajo päivittää saman aineiston, joten sen kaaviot toimivat edelleen |
| Vie kaavio | Piirtää tallennetun kaavion PNG-, SVG- tai PDF-muodossa; ryhmittelysarakkeella yksi kaavio arvoa kohti |
| Vie koontinäyttö | Kirjoittaa koontinäytön erillisenä HTML-tiedostona |
| Luo asiakirja | Täyttää asiakirjamallin; ryhmittelysarakkeella yksi asiakirja arvoa kohti |
| Vie aineisto | Kirjoittaa aineiston tiedostoksi |

Aineistoon perustuva kaavio tai asiakirja piirretään tiedoilla, jotka ovat olemassa vaiheen ajon aikana, joten sijoita ne
noutavien ja käsittelevien vaiheiden jälkeen.

## Työnkulun ajaminen

*Aja* käynnistää työnkulun. Tilarivi näyttää, mikä vaihe on käynnissä, ja lokiin tulee yksi rivi vaihetta kohti. *Keskeytä*
pysäyttää työnkulun ennen seuraavaa vaihetta. Työnkulku pysähtyy ensimmäiseen virheeseen, ellet ole ottanut käyttöön kohtaa
*Jatka seuraavaan vaiheeseen virheen jälkeen*. Ajo lasketaan silloinkin epäonnistuneeksi. Tarkastelija näyttää viimeisimmän ajon
vaihe vaiheelta ja virheen siellä, missä se syntyi.

Ajon tiedostot säilyvät, kunnes lataat ne kohdasta *Lataa tulos* tai suljet sovelluksen. Yksi tiedosto tulee sellaisenaan, ja
useasta tulee ZIP-tiedosto.

Työnkulku ei koskaan lähetä mitään sovelluksesta. Se, minkä haluat jakaa muille, kulkee Jaa-tilan kautta, jossa henkilötiedot
tarkistetaan ensin.

## Ajo käynnistyksessä

Kohdalla *Aja, kun sovellus käynnistyy* työnkulku ajetaan pian sovelluksen avautumisen jälkeen. Se ajetaan vain, jos sen ei
tarvitse kysyä mitään:

- Verkosta noutavat vaiheet vaativat, että suostumus on jo annettu.
- Tietokantasillan kautta lukevia vaiheita ei ajeta käynnistyksessä, koska silta yhdistetään käsin.
- Python-skriptit vaativat, että Python on jo noudettu.

Muuten työnkulku ohitetaan, ja loki kertoo syyn. Mitään ei ajeta, kun sovellus on suljettu.

## Lähteen seuranta

Seuranta koskee API:sta tai tietokannasta noudettuja aineistoja ja linkitettyjä tiedostoja. Ota se käyttöön kohdasta *Seuraa
lähdettä* aineiston sivulla Hallitse-tilassa tai välilehdeltä *Seurannat*.

*Tarkista nyt* lukee kaikki seuratut lähteet. Sovellus vertaa rivejä siihen, millaisia ne olivat aineiston viimeisimmässä
päivityksessä. Samat rivit eri järjestyksessä eivät ole uutinen. Jos jokin on muuttunut, tilarivi näyttää *Uusia tietoja*, ja
välilehti kertoo, montako riviä lähteessä on nyt, montako on uusia tai muuttuneita ja mitkä sarakkeet ovat tulleet tai poistuneet.

Muuttunut rivi lasketaan sekä uudeksi että poistuneeksi, koska sovellus ei tiedä, mitkä sarakkeet yksilöivät rivin.

Aineisto ei muutu, ennen kuin painat *Päivitä*. Silloin uudet tiedot noudetaan ja resepti toistetaan, ja seuranta vertaa sen
jälkeen uuteen versioon. Sama pätee, kun päivität muulla tavalla, esimerkiksi työnkulussa.

Kohdalla *Tarkista, kun sovellus käynnistyy* tarkistus tehdään käynnistyksessä, mutta vain lähteille, joihin olet jo antanut
suostumuksen. Linkitetyt tiedostot tarkistetaan silloin vain, jos selaimella on yhä lupasi; muuten näkyy *Ei tarkistettu*.

## Varmuuskopiot

Työnkulut kulkevat varmuuskopioiden ja siirrettävän kansion mukana, mutta eivät muille tarkoitetuissa paketeissa, koska ne
viittaavat työtilasi aineistoihin. Varmuuskopiosta tuleva työnkulku ei koskaan käynnisty itsestään, ennen kuin olet ottanut sen uudelleen käyttöön.

## Rajoitukset

- Tarkistus noutaa lähteestä koko vastauksen. Suuret lähteet vievät yhtä kauan kuin tavallinen nouto.
- Vain yksi työnkulku ajetaan kerrallaan.
- Vaihe ei voi käyttää toisen tulosta muuten kuin aineistoihin päätyneen kautta.
- Useiden aineistojen päivitystä yhdessä vaiheessa ei keskeytetä kesken noudon.
