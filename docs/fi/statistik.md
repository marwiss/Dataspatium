# Tilastot, aikasarjat ja mallit

**Tilastot**-välilehti Analysoi-tilassa tekee tavallisia analyyseja lomakkeilla. Lomake kirjoittaa koodin täyttäessäsi sitä, joten näet,
mitä ajetaan, ja voit käyttää koodia muualla. **Aikasarjatoiminnot** Muokkaa-tilassa valmistelevat sarjoja SDMX:stä ja PxWebistä.
Regression **malli** voidaan tallentaa ja käyttää reseptivaiheena *Ennuste* uusiin tietoihin.

## Tilastot-välilehti

Valitse aineisto ja työkalu, täytä lomake ja paina *Aja*. Oletuksena on R; valitse lomakkeesta Python, jos haluat. Koodi näkyy lomakkeen
alla, ja sen voi avata konsolissa kohdasta *Avaa konsolissa*.

| Työkalu | Mitä se antaa |
|---|---|
| Kuvailevat | Lukumäärä, puuttuvat arvot, keskiarvo, keskihajonta, kvartiilit, pienin ja suurin sarakkeittain, halutessa ryhmittäin; yhdestä sarakkeesta myös histogrammi |
| Ristiintaulukko | Lukumäärät kahden luokittelun mukaan, halutessa prosentteina, ja khii²-testi |
| Korrelaatio | Pearson tai Spearman lukusarakkeiden välillä värillisen taulukon kera |
| Hypoteesitesti | t-testi (kaksi ryhmää, arvoa vastaan, parittainen), Mann-Whitney, varianssianalyysi ja Kruskal-Wallis |
| Regressio | Lineaarinen tai logistinen, kertoimet, keskivirheet ja p-arvot; tekstisarakkeista tulee indikaattoreita |
| Klusterointi | k-means vapaavalintaisella klusterien määrällä ja halutessa uusi aineisto, jossa klusteri on sarakkeena |

Taulukon yläpuolella on lause siitä, mitä tulos kertoo. Se kertoo, onko ero tilastollisesti merkitsevä, ei sitä, mitä se tarkoittaa.
Tilastolliset menetelmät olettavat asioita, joita lomake ei näe, kuten sen, miten tiedot on kerätty ja ovatko rivit riippumattomia.
Arvio on sinun. Jokaisen tuloksen voi tallentaa aineistona, ja koodi kulkee mukana kuvauksessa.

Python käynnistyy vasta, kun painat *Aja*, ja scipy, statsmodels ja scikit-learn noudetaan, kun niitä tarvitaan ensimmäisen kerran.

## Aikasarjat Muokkaa-tilassa

Toimintojen ryhmä **Aikasarjat** on taulukoille, joissa on jaksosarake ja mahdollisesti sarjat erottavia sarakkeita, kuten kunta tai
sukupuoli. Jokainen toiminto on reseptivaihe, jonka voi perua ja toistaa seuraavassa noudossa.

| Toiminto | Mitä se tekee |
|---|---|
| Tulkitse jaksot | Tekee yhtenäiset jaksot (`2024-03`, `2024-Q1`, `2024`) arvoista `2024M03`, `2024K1`, `2024-Q1`, `Q1 2024`, `202403`, `2024` ja päivämääristä, sekä päivämääräsarakkeen kaavioille |
| Jaksota | Yksi rivi neljännestä tai vuotta kohti: summa, keskiarvo, viimeinen arvo, pienin tai suurin; taulukko korvataan |
| Muutos ajassa | Ero tai prosentti edelliseen jaksoon tai viime vuoden samaan jaksoon |
| Indeksi | Jokainen arvo perusjaksoon verrattuna, perusjakso on 100; vuosi perusjaksona ottaa kuukausien tai neljännesten keskiarvon |
| Liukuva keskiarvo | Viimeisimpien jaksojen keskiarvo tai keskitetty; vain täydet ikkunat antavat arvon |
| Kausitasoita | Trendi, kausivaihtelu ja tasoitettu arvo R:llä (`stl`); sarjan on oltava ehjä ja vähintään kaksi vuotta pitkä, muut jäävät tyhjiksi |

Rivien ei tarvitse olla järjestyksessä, eivätkä sarjat sekoitu. Jaksot, joiden muotoa ei tunnisteta, jäävät tyhjiksi, joten tarkista
määrä esikatselusta.

Visualisoi-tilassa on kaaviotyypit **Aikasarja** (yksi viiva sarjaa kohti) ja **Pienet monikot** (yksi pieni kaavio sarjaa kohti).

## Mallit ja Ennuste

Kun regressio on valmis, voit painaa *Tallenna malli*. Kertoimet tallennetaan aineistoon ja kulkevat pakettien ja varmuuskopioiden
mukana. *Mallit*-työkalu Tilastot-välilehdellä luettelee ne kaavoineen.

Toiminto **Ennuste mallista** Laskelmat-ryhmässä Muokkaa-tilassa laskee uuden sarakkeen mallilla samassa aineistossa tai toisessa,
jossa on samat sarakkeet. Laskenta on tavallista SQL:ää, joten R:ää tai Pythonia ei tarvita. Malli kopioidaan reseptivaiheeseen, joten
resepti voidaan toistaa, vaikka alkuperäinen aineisto olisi poissa. Uuden sarakkeen kuvaus koodikirjassa sisältää mallin kaavan ja sovituksen.

- Jos mallin tarvitsema sarake puuttuu, viesti kertoo, mikä.
- Rivi, jolla selittävä arvo on tyhjä, ei saa ennustetta.
- Tekstiarvo, jota malli ei ole nähnyt, lasketaan vertailutasoksi eli ilman lisäystä.
- Logistinen malli antaa aakkosjärjestyksessä viimeisen lopputuloksen todennäköisyyden.

Vain lineaariset ja logistiset mallit voidaan tallentaa, koska ne voidaan ilmaista kaavana. Alkuperäistä kirjastoaan vaativia malleja ei
voi ajaa reseptivaiheena.
