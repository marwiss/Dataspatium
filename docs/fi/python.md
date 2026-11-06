# Python Dataspatiumissa

*Analysoi*-tilassa on Python-konsoli R-konsolin vierellä. Python toimii selaimessa Pyodiden avulla (Python 3.13) ilman
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

### Rakennusmallit (IFC) IfcOpenShellillä

| Funktio | Tekee |
|---|---|
| `dm_ifc("malli")` | Avaa IFC-mallin (mallityypin tietoaineisto) IfcOpenShellillä ja palauttaa `ifcopenshell.file`-olion. Wheel-paketit haetaan ensimmäisellä kerralla (noin 13 Mt, luvan jälkeen). |
| `dm_ifc_elements(model, "IfcWall")` | Elementit `DataFrame`-taulukkona: guid, typ, namn, beskrivning, objekttyp, tagg, vaning, typnamn, material, id. |
| `dm_ifc_psets(model, "IfcWall", qtos=True)` | Ominaisuusjoukot leveänä taulukkona, sarake kutakin `Joukko.Ominaisuus`-paria kohti; `qtos=True` ottaa mukaan määräjoukot. |
| `dm_ifc_tree(model)` | Tilarakenne: taso, guid, tyyppi, nimi, yläosa, elementtien määrä. |
| `dm_ifc_validate(model, express=True)` | Skeematarkistuksen löydökset: taso, tyyppi, id, guid, attribuutti, viesti. `express=True` suorittaa myös skeeman säännöt. |
| `dm_ifc_select(model, "IfcWall, Pset_WallCommon.FireRating=EI60")` | Elementit IfcOpenShellin valintakielen mukaan, kuten `dm_ifc_elements()` ne luettelee. |
| `dm_ifc_geometry(model, "IfcWall")` | Tilavuus, pinta-ala ja rajauslaatikko elementtiä kohti, mitattu geometriasta (metreinä). |
| `dm_ifc_set(model, df, key="guid")` | Kirjoittaa taulukon arvot malliin (attribuutit ja `Joukko.Ominaisuus`-sarakkeet) ja palauttaa muutettujen elementtien määrän. |
| `dm_ifc_write(model, "Uusi nimi")` | Lähettää mallin sovellukseen uutena mallitietoaineistona. Alkuperäinen tietoaineisto ei muutu. |

Koko IfcOpenShellin API on käytettävissä: `model.by_type("IfcWall")`, `ifcopenshell.util.element.get_psets(e)`, `ifcopenshell.api` ja muut. Muokkaa-tilan vaihe *Python mallille* suorittaa samanlaisen koodin funktiona `step(model)` ja tekee tuloksesta tietoaineiston uuden version; katso [CAD ja BIM](cad-bim.md).

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

Tarkistesummat: ajoympäristön tiedostot on lukittu Pyodide-versioon 0.29.5 SHA-256-summilla sovelluksessa; paketit
tarkistetaan `pyodide-lock.json`-tiedostoa vasten, joka on itse lukittu summallaan. Tiedostoa, jonka summa on väärä,
ei käytetä.

## Koodivaiheet resepteissä

Muokkaa-tilassa on toiminto **Python-vaihe** (paletin ryhmä Koodi): funktio `def step(df): ... return df` suoritetaan
koko taulukolle pandasilla, ja funktion palauttama taulukko korvaa vanhan tyyppeineen. Vaihe kirjataan reseptiin
koodeineen, sen voi kumota, toistaa toiselle aineistolle, ja se kulkee viedyn reseptin mukana (kommentteina SQL- ja
R-koodissa). Painike *Esikatsele* suorittaa funktion ensimmäisille 200 riville ja näyttää tuloksen sarakkeet ja
muutaman rivin ennen käyttöä. Tuo tarvitsemasi moduulit koodissa; `pd` ja `np` ovat jo valmiina. Vastaava **R-vaihe**
ottaa funktion `function(df) { ... }` (ks. [r-guide.md](r-guide.md)).

## seaborn ja plotly

seaborn ja plotly eivät kuulu Pyodiden valikoimaan; sovellus on kiinnittänyt niiden PyPI-wheelit tarkistesummineen ja
hakee ne komponentteina, kun koodi tuo ne (`import seaborn as sns`, `import plotly.express as px`). seaborn piirtää
matplotlibin kautta ja näkyy kuten muut kuvat. plotly-kuvat ovat vuorovaikutteisia: `fig.show()` tai `fig` viimeisenä
rivinä antaa kuvan sovellukselle, joka piirtää sen plotly.js:llä (haetaan komponenttina ensimmäisellä kerralla,
4,8 MB) ja sovelluksen teemalla ja vie sen SVG-, PNG- ja PDF-muotoon. Muistikirjassa plotly-kuvat tallennetaan
PNG-muodossa, ja vuorovaikutteinen näkymä säilyy niin kauan kuin plotly.js on saatavilla.

## Python-kaaviot Visualisoi-tilassa

Visualisoi-tilassa kaavio voi olla **Python-skripti**: aineisto on `df`, ja viimeisin kaavio (matplotlib tai plotly)
näytetään ja tallennetaan skriptin kanssa. Python-kaaviot viedään SVG-, PNG-, PDF- ja PowerPoint-muotoon, ajetaan
eräajona ryhmittäin (skripti suoritetaan kerran arvoa kohden `df` suodatettuna), ja ne voi sijoittaa
asiakirjamalleihin merkinnällä `{{diagram "Nimi"}}`; sama koskee nyt R-kaavioita. Koontinäytöissä ja julkaistussa
HTML:ssä tallennettu plotly-kaavio on vuorovaikutteinen, muut Python- ja R-kaaviot näytetään tallennettuna kuvana.

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
- Vuorovaikutteisia ikkunoita ei ole; matplotlib piirtää SVG- ja PNG-muotoon. plotly piirretään sovelluksessa plotly.js:llä ja seaborn tulee mukana pakettina; ei myöhemmässä
  versiossa.
