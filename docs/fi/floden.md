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
| Suorita komento | Suorittaa yhden sovelluksen komennoista, argumentit JSON-muodossa; vastaus on komennon tiedot |

Aineistoon perustuva kaavio tai asiakirja piirretään tiedoilla, jotka ovat olemassa vaiheen ajon aikana, joten sijoita ne
noutavien ja käsittelevien vaiheiden jälkeen.

## Ehdot, silmukat ja kysymykset

Työnkulku voi valita reitin aiempien vaiheiden tulosten mukaan. Anna vaiheelle *Vastauksen nimi*, niin myöhemmät vaiheet saavat
vastauksen muodossa `{{nimi.kenttä}}` argumenteissa, kysymyksissä ja viesteissä ja muodossa `nimi.kenttä` ehdoissa. *Suorita
komento* suorittaa yhden niistä komennoista, joita myös sovelluksen tekoäly käyttää, argumentit JSON-muodossa. Jos vaiheen nimi
on `maara` ja se suorittaa komennon `run_sql` argumentein `{"dataset": "Väestö", "sql": "select count(*) from data"}`, määrä
on `maara.rows[0][0]`.

Vain lukevat komennot ovat `list_datasets`, `describe_dataset`, `read_rows`, `column_stats`, `run_sql`, `list_operations`, `describe_operation`, `list_items`, `list_files`. Muuttavat tai tiedostoja tekevät komennot ovat `apply_operation`, `undo`, `refresh_dataset`, `replay_recipe`, `run_script`, `list_to_dataset`, `render_chart`, `dashboard_html`, `generate_document`, `export_dataset`, `run_flow`, `run_r`, `run_python`. `run_sql` suorittaa vain
yhden lukevan lauseen.

| Vaihe | Miten se toimii |
|---|---|
| Jos ehto täyttyy | Suorittaa kohdan *Silloin* vaiheet, jos ehto täyttyy, muuten kohdan *Muuten* vaiheet |
| Jokaiselle luettelon arvolle | Suorittaa vaiheet kerran jokaiselle aiemman vastauksen arvolle, esimerkiksi `kunnat.rows`; arvon saa muodossa `{{item}}`, ja luku n antaa kierrokset 1–n |
| Toista, kunnes ehto täyttyy | Suorittaa vaiheet ja kokeilee ehtoa jokaisen kierroksen jälkeen, kierrosten välissä tauko; kierroksen saa muodossa `{{round}}` |
| Kysy minulta | Näyttää kysymyksen vastausvaihtoehtoineen, yksi riviä kohden, ja odottaa vastausta, jonka saa muodossa `{{nimi.answer}}` |
| Lopeta työnkulku | Lopettaa työnkulun ja jättää viestin lokiin; sitä ei lasketa virheeksi |

Ehto kirjoitetaan vertailuilla `=`, `!=`, `<`, `<=`, `>`, `>=` ja `contains`, sanoilla `and`, `or` ja `not`, sulkeilla, luvuilla,
lainausmerkeissä olevalla tekstillä ja viittauksilla vastauksiin, esimerkiksi `maara.rows[0][0] > 0 and nimi = 'Ale'`. Sovellus
lukee ehdon itse eikä koskaan suorita sitä koodina. Puuttuva vastaus lasketaan tyhjäksi, ja ehto, jota ei voi lukea, näkyy heti
muokkaimessa.

Molemmilla silmukoilla on raja, *Enintään kierroksia* (oletus 100, enintään 1 000) ja *Enintään sekunteja*, ja ensin täyttyvä raja
pätee. Silmukan vastaus kertoo, montako kierrosta se kävi (`rounds`) ja miksi se päättyi (`reason`: `done`, `until`, `rounds` tai
`time`), jotta myöhempi ehto voi valita sen mukaan.

*Pysäytä* työnkulkunäkymässä ja tilarivillä pysäyttää työnkulun ennen seuraavaa vaihetta ja jokaisen kierroksen jälkeen, ja
käynnissä oleva tauko keskeytyy heti. Jo alkanut vaihe suoritetaan loppuun. Loki kertoo, mihin työnkulku pysähtyi, esimerkiksi
*Pysäytit kierroksella 37/250*, ja tehdyt muutokset voi perua tavalliseen tapaan.

## Työnkulun ajaminen

*Aja* käynnistää työnkulun. Tilarivi näyttää, mikä vaihe on käynnissä, ja lokiin tulee yksi rivi vaihetta kohti. *Pysäytä*
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
- Työnkulkua, joka kysyy sinulta (*Kysy minulta*), ei koskaan ajeta käynnistyksessä.

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
- Vain nimetyt vaiheet antavat vastauksia, joita myöhemmät vaiheet voivat lukea: komento antaa tietonsa, silmukka `rounds` ja
  `reason`, kysymys `answer` ja muut vaiheet viestinsä ja tiedostonsa.
- Useiden aineistojen päivitystä yhdessä vaiheessa ei keskeytetä kesken noudon.
