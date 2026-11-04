# Python Dataspatiumissa

*Analysoi*-tilassa on Python-konsoli R-konsolin vierellä. Python toimii selaimessa Pyodiden avulla (Python 3.14) ilman
mitään asennusta. Toisin kuin R, Python ei tule sovelluskansion mukana: ajoympäristö ja paketit haetaan jsDelivristä,
kun käytät niitä ensimmäisen kerran ja olet antanut luvan, ja ne tallennetaan sen jälkeen selaimeen komponentteina.

## Aloita

1. Avaa *Analysoi* ja *Python*-välilehti. Paina *Käynnistä Python* tai *Suorita*. Ensimmäisellä kerralla sovellus
   kysyy lupaa hakea komponentteja ja lataa Pythonin sekä numpyn ja pandasin (noin 22 MB); se vie puoli minuuttia
   tavallisella yhteydellä. Seuraavalla kerralla Python käynnistyy parissa sekunnissa ilman internetiä.
2. Kirjoita koodia editoriin ja paina Ctrl+Enter (Macissa Cmd+Enter). Koko skripti suoritetaan; jos tekstiä on
   valittuna, vain valinta suoritetaan. Tulosteet, virheet ja kaaviot näkyvät editorin alla, ja viimeisen rivin arvo
   tulostetaan kuten Python-konsolissa.
3. Tallenna skriptit painikkeella *Tallenna skripti*. Tallennetut skriptit ovat vasemmassa paneelissa ja kulkevat
   varmuuskopioiden mukana.

## Dataspatiumin funktiot

Funktioilla on samat nimet kuin R:ssä, ja ne ovat suoraan istunnossa (`from dataspatium import *` ajetaan
käynnistyksessä).

| Funktio | Tekee |
|---|---|
| `dm_list()` | Näyttää istunnon aineistot `DataFrame`-oliona, jonka sarakkeet ovat namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("lyhytnimi")` | Lukee aineiston pandas `DataFrame`-olioksi oikeilla tyypeillä: päivämäärät ja aikaleimat ovat `datetime64`, kyllä/ei `boolean`, kokonaisluvut `int64` (tai `Int64`, kun arvoja puuttuu), luvut `float64`, teksti `str`. Argumentti on mieluiten lyhytnimi (jonka painike *Lisää dm_read()* kirjoittaa), mutta se voi olla myös id, tarkka nimi, nimi kirjainkoosta riippumatta tai yksikäsitteinen alkuosa. |
| `dm_read("Nimi", columns=["a", "b"], where="a > 10", n=1000)` | Lukee vain tietyt sarakkeet, SQL-ehdon täyttävät rivit tai rajatun määrän rivejä. |
| `df.attrs["dataspatium"]` | Sarakkeiden selitteet, kuvaukset, yksiköt, tyypit ja arvoselitteet sovelluksesta (`labels`, `descriptions`, `units`, `types`, `value_labels`). `dm_write()` vie ne takaisin, tai argumenteilla `labels`, `descriptions` ja `units`. |
| `dm_value_labels(df, "sukupuoli", {1: "Mies", 2: "Nainen"}, to="labels")` | Yhden sarakkeen arvoselitteet dict-rakenteena koodista selitteeseen. `to="labels"` korvaa koodit selitteillä, `to="codes"` palauttaa koodit, `to=None` asettaa vain selitteet, ja `labels=None` poistaa ne. Taulukko muuttuu paikallaan, ja `dm_write()` tallentaa selitteet. |
| `dm_write(df, "Uusi nimi", description="…")` | Lähettää `DataFrame`-olion sovellukseen uutena aineistona. Se ilmestyy luetteloon, kun komento on valmis. Ilman nimeä käytetään muuttujan nimeä. |
| `theme_dataspatium()` | matplotlib-tyyli sovelluksen ulkoasulla ja paletilla. Asetetaan automaattisesti, kun matplotlibia käytetään istunnossa ensimmäisen kerran. |
| `dm_palette()` | Sovelluksen väripaletti (Okabe-Ito, värisokeille turvallinen) listana; `dm_palette(n)` antaa n väriä. |

Esimerkki:

```python
df = dm_read("vaesto_2024")
per_maakunta = (df.groupby("maakunta", as_index=False)
    .agg(vaesto=("vaesto", "sum"), kuntia=("kunta", "count"))
    .sort_values("vaesto", ascending=False))
per_maakunta
dm_write(per_maakunta, "Väestö maakunnittain 2024")

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.barh(per_maakunta["maakunta"][::-1], per_maakunta["vaesto"][::-1] / 1000, color=dm_palette()[0])
ax.set_title("Väestö maakunnittain 2024")
ax.set_xlabel("Tuhatta")
```

## Kaaviot

matplotlib piirtää ilman näyttöä (Agg), ja jokainen avoin kuva näytetään konsolissa SVG-muodossa, kun komento on
valmis; kuvat suljetaan sen jälkeen, joten uusi komento alkaa puhtaalta pöydältä. Jokaisen kaavion alla on painikkeet
vientiin SVG- (vektori, hyvä Wordiin ja verkkoon), PNG- ja PDF-muotoon, koossa 7 × 5 tuumaa ja PNG:ssä 150 dpi.
Muistikirjassa kaaviot tallennetaan PNG-muodossa.

## Paketit

Käynnistyksessä haetaan numpy, pandas ja micropip. Pyodidessa on selaimelle valmiiksi käännettyjä paketteja, yli
350: matplotlib, scipy, statsmodels, scikit-learn, networkx, shapely, geopandas, sympy, pillow, lxml, openpyxl, xlrd,
sqlalchemy, pyarrow, duckdb, bokeh, altair ja muita. Kun koodi tuo paketin, jota ei ole istunnossa, sovellus hakee
wheel-tiedoston riippuvuuksineen ennen koodin suorittamista, tarkistaa sen Pyodiden pakettiluettelon tarkistesummaa
vasten ja tallentaa sen selaimeen; se näkyy kohdassa *Hallitse → Työtila → Komponentit*, jossa komponentteja voi
myös poistaa. Puhtaat Python-paketit PyPI:stä, jotka eivät kuulu Pyodideen, asennetaan komennolla
`import micropip; await micropip.install("paketti")`; sovellus kysyy lupaa, ennen kuin Python käyttää internetiä.

Tarkistesummat: ajoympäristön tiedostot on lukittu Pyodide-versioon 314.0.7 SHA-256-summilla sovelluksessa; paketit
tarkistetaan `pyodide-lock.json`-tiedostoa vasten, joka on itse lukittu summallaan. Tiedostoa, jonka summa on väärä,
ei käytetä.

## Miten data siirtyy sovelluksen ja Pythonin välillä

Aineistot ovat SQLite-tiedostoja. Kun suoritat koodia, sovellus kopioi aineistot, joihin koodi viittaa `dm_read()`-
kutsulla, Pythonin virtuaaliseen tiedostojärjestelmään hakemistoon `/data` yhdessä indeksin kanssa. `dm_read()` lukee
tiedoston `sqlite3`-moduulilla ja `pandas.read_sql_query`-funktiolla ja palauttaa saraketyypit taulusta `_columns`.
`dm_write()` kirjoittaa uuden SQLite-tiedoston hakemistoon `/data/out`, jonka sovellus noutaa ja lisää työtilaan, kun
komento on valmis. `sqlite3`-moduulia voi käyttää suoraan: `sqlite3.connect("/data/<id>.sqlite")`, jossa id näkyy
`dm_list()`-funktiolla.

Yli 50 MB:n aineistot peilataan vain, kun koodi viittaa niihin. Data R:n ja Pythonin välillä kulkee aineistojen kautta:
`dm_write()` toisessa kielessä, `dm_read()` toisessa.

## Kieli

Funktioiden `dm_list()`, `dm_read()` ja `dm_write()` viestit noudattavat sovelluksen kieltä (ruotsi, tanska, norja,
suomi, islanti tai englanti); `dm_list()`-funktion sarakenimet ovat sen sijaan aina samat, jotta skriptit toimivat
kielestä riippumatta.

## Rajoitukset

- Kun sovellus avataan kansiosta (file://), Python-koodia ei voi keskeyttää sen suorituksen aikana. Jos jokin
  jumittuu: *Käynnistä Python uudelleen*. Tallennetut skriptit eivät muutu, mutta istunnon oliot häviävät. Kun sovellus
  ajetaan verkkopalvelimelta (localhost tai https), käytössä on *Keskeytä*-painike, joka pysäyttää koodin ja säilyttää
  istunnon (ks. [faq.md](faq.md)).
- Muistia rajoittavat selain ja WebAssembly; pidä aineistot alle muutaman sadan megatavun Pythonissa.
- Syöte suorituksen aikana (`input()`) ei toimi, eivätkä säikeet, prosessit tai tiedostot virtuaalisen
  tiedostojärjestelmän ulkopuolella. Verkkokutsut Pythonista (esimerkiksi `micropip` ja `pyodide.http`) edellyttävät,
  että olet antanut luvan komponenteille.
- Vuorovaikutteisia ikkunoita ei ole; matplotlib piirtää SVG- ja PNG-muotoon. plotly ja seaborn tulevat myöhemmässä
  versiossa.
