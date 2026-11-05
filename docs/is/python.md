# Python í Dataspatium

Hamurinn *Greina* hefur Python-stjórnborð við hlið R-stjórnborðsins. Python keyrir í vafranum með Pyodide (Python 3.14),
alveg án uppsetningar. Ólíkt R fylgir Python ekki með í forritsmöppunni: keyrsluumhverfið og pakkarnir eru sóttir frá
jsDelivr í fyrsta sinn sem þú notar þau, eftir að þú hefur gefið leyfi, og síðan vistuð í vafranum sem einingar.

## Hafist handa

1. Opnaðu *Greina* og flipann *Python*. Ýttu á *Ræsa Python* eða *Keyra*. Í fyrsta sinn spyr forritið um leyfi til að
   sækja einingar og hleður niður Python með numpy og pandas (um 22 MB); það tekur hálfa mínútu á venjulegri
   tengingu. Næst ræsist Python á nokkrum sekúndum án internets.
2. Skrifaðu kóða í ritilinn og ýttu á Ctrl+Enter (Cmd+Enter á Mac). Öll skriftan keyrir; ef texti er valinn keyrir
   aðeins valið. Úttak, villur og myndrit birtast undir ritlinum, og gildi síðustu línunnar er prentað eins og í
   Python-stjórnborði.
3. Vistaðu skriftur með *Vista skriftu*. Vistaðar skriftur eru í spjaldinu til vinstri og fylgja með í öryggisafritum.

## Föll Dataspatium

Föllin heita það sama og í R og eru beint í setunni (`from dataspatium import *` keyrir við ræsingu).

| Fall | Gerir |
|---|---|
| `dm_list()` | Sýnir gagnasöfnin í setunni sem `DataFrame` með dálkunum namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("stuttheiti")` | Les gagnasafn sem pandas `DataFrame` með réttum tegundum: dagsetningar og dagsetningar með tíma verða `datetime64`, já/nei `boolean`, heiltölur `int64` (eða `Int64` þegar gildi vantar), tölur `float64`, texti `str`. Viðfangið er helst stuttheitið (það sem hnappurinn *Setja inn dm_read()* skrifar) en getur líka verið id, nákvæmt heiti, heiti óháð há- og lágstöfum eða ótvírætt forskeyti. |
| `dm_read("Heiti", columns=["a", "b"], where="a > 10", n=1000)` | Les aðeins ákveðna dálka, raðir sem uppfylla SQL-skilyrði, eða takmarkaðan fjölda raða. |
| `df.attrs["dataspatium"]` | Merkimiðar, lýsingar, einingar, tegundir og gildismerkimiðar dálkanna úr forritinu (`labels`, `descriptions`, `units`, `types`, `value_labels`). `dm_write()` tekur þau með til baka, eða með viðföngunum `labels`, `descriptions` og `units`. |
| `dm_value_labels(df, "kyn", {1: "Karl", 2: "Kona"}, to="labels")` | Gildismerkimiðar fyrir einn dálk sem dict frá kóða í merkimiða. `to="labels"` skiptir kóðum út fyrir merkimiða, `to="codes"` til baka, `to=None` setur aðeins merkimiðana og `labels=None` fjarlægir þá. Töflunni er breytt á staðnum og `dm_write()` vistar merkimiðana. |
| `dm_write(df, "Nýtt heiti", description="…")` | Sendir `DataFrame` til forritsins sem nýtt gagnasafn. Það birtist í listanum þegar skipunin er búin. Án heitis er heiti breytunnar notað. |
| `theme_dataspatium()` | matplotlib-stíll með útliti og litavali forritsins. Settur sjálfkrafa í fyrsta sinn sem matplotlib er notað í setunni. |
| `dm_palette()` | Litaval forritsins (Okabe-Ito, öruggt fyrir litblinda) sem listi; `dm_palette(n)` gefur n liti. |

Dæmi:

```python
df = dm_read("ibuafjoldi_2024")
per_landshluti = (df.groupby("landshluti", as_index=False)
    .agg(ibuar=("ibuar", "sum"), sveitarfelog=("sveitarfelag", "count"))
    .sort_values("ibuar", ascending=False))
per_landshluti
dm_write(per_landshluti, "Íbúafjöldi eftir landshlutum 2024")

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.barh(per_landshluti["landshluti"][::-1], per_landshluti["ibuar"][::-1] / 1000, color=dm_palette()[0])
ax.set_title("Íbúafjöldi eftir landshlutum 2024")
ax.set_xlabel("Þúsundir")
```

## Myndrit

matplotlib teiknar án skjás (Agg) og hver opin mynd birtist í stjórnborðinu sem SVG þegar skipunin er búin; myndunum
er síðan lokað, svo ný skipun byrjar með hreint borð. Undir hverju myndriti eru hnappar til útflutnings í SVG (vigur,
gott fyrir Word og vef), PNG og PDF, í stærðinni 7 × 5 tommur og 150 dpi fyrir PNG. Í minnisbókinni eru myndritin
vistuð sem PNG.

## Pakkar

Við ræsingu eru numpy, pandas og micropip sótt. Pyodide hefur pakka sem eru byggðir fyrir vafrann, yfir 350 talsins:
matplotlib, scipy, statsmodels, scikit-learn, networkx, shapely, geopandas, sympy, pillow, lxml, openpyxl, xlrd,
sqlalchemy, pyarrow, duckdb, bokeh, altair og fleiri. Þegar kóðinn flytur inn pakka sem er ekki í setunni sækir
forritið hjólið með ósjálfstæðum pökkum þess áður en kóðinn keyrir, ber það saman við prófsummuna í pakkalista Pyodide
og vistar það í vafranum; það sést undir *Sýsla → Vinnusvæði → Einingar*, þar sem einingar má einnig fjarlægja. Hreinir
Python-pakkar af PyPI sem eru ekki hluti af Pyodide eru settir upp með `import micropip; await micropip.install("pakki")`;
forritið spyr um leyfi áður en Python nær í internetið.

Prófsummur: skrár keyrsluumhverfisins eru læstar við Pyodide 314.0.7 með SHA-256 í forritinu; pakkarnir eru bornir
saman við `pyodide-lock.json`, sem er sjálf læst með sinni summu. Skrá með rangri summu er ekki notuð.

## Kóðaskref í uppskriftum

Í Vinna er aðgerðin **Python-skref** (hópurinn Kóði í litaspjaldinu): fall `def step(df): ... return df` keyrir á alla
töfluna með pandas, og það sem fallið skilar verður nýja taflan með tegundum úr niðurstöðunni. Skrefið er skráð í
uppskriftina með kóðanum, má afturkalla, endurspila á öðru gagnasafni og fylgir með þegar uppskriftin er flutt út (sem
athugasemdir í SQL- og R-kóðanum). Hnappurinn *Forskoða* keyrir fallið á fyrstu 200 röðunum og sýnir dálka
niðurstöðunnar og nokkrar raðir áður en þú beitir því. Flyttu inn það sem þú þarft í kóðanum; `pd` og `np` eru þegar
til staðar. Samsvarandi **R-skref** tekur fall `function(df) { ... }` (sjá [r-guide.md](r-guide.md)).

## seaborn og plotly

seaborn og plotly eru ekki hluti af úrvali Pyodide; forritið hefur hjól þeirra frá PyPI fest með prófsummum og sækir
þau sem einingar þegar kóðinn flytur þau inn (`import seaborn as sns`, `import plotly.express as px`). seaborn teiknar
gegnum matplotlib og birtist eins og aðrar myndir. plotly-myndir eru gagnvirkar: `fig.show()`, eða `fig` sem síðasta
lína, afhendir forritinu myndina, sem teiknar hana með plotly.js (sótt sem eining í fyrsta sinn, 4,8 MB) og þema
forritsins og flytur hana út í SVG, PNG og PDF. Í minnisbókinni eru plotly-myndir vistaðar sem PNG og gagnvirka
sýnin helst á meðan plotly.js er tiltækt.

## Python-myndrit í Myndgera

Í Myndgera getur myndrit verið **Python-skrifta**: gagnasafnið er `df`, og nýjasta myndritið (matplotlib eða plotly)
birtist og er vistað með skriftunni. Python-myndrit eru flutt út í SVG, PNG, PDF og PowerPoint, keyrð í hópkeyrslu
eftir hópum (skriftan keyrir einu sinni fyrir hvert gildi með `df` síað) og má setja inn í skjalasniðmát með
`{{diagram "Heiti"}}`; það sama gildir nú um R-myndrit. Í mælaborðum og birtu HTML er vistað plotly-myndrit gagnvirkt,
önnur Python- og R-myndrit birtast sem vistuð mynd.

## Hvernig gögn flytjast milli forritsins og Python

Gagnasöfnin eru SQLite-skrár. Þegar þú keyrir kóða afritar forritið gagnasöfnin sem kóðinn vísar í með `dm_read()` í
sýndarskráakerfi Python undir `/data`, ásamt skrá yfir þau. `dm_read()` les skrána með einingunni `sqlite3` og
`pandas.read_sql_query` og endurheimtir dálkategundirnar úr töflunni `_columns`. `dm_write()` skrifar nýja SQLite-skrá
í `/data/out` sem forritið sækir og bætir við vinnusvæðið þegar skipunin er búin. Þú getur notað `sqlite3` beint:
`sqlite3.connect("/data/<id>.sqlite")` þar sem id sést með `dm_list()`.

Gagnasöfn stærri en 50 MB eru aðeins spegluð þegar kóðinn vísar í þau. Gögn milli R og Python fara um gagnasöfn:
`dm_write()` í einu málinu, `dm_read()` í hinu.

## Tungumál

Skilaboð frá `dm_list()`, `dm_read()` og `dm_write()` fylgja tungumáli forritsins (sænska, danska, norska, finnska,
íslenska eða enska); dálkaheitin í `dm_list()` eru hins vegar alltaf þau sömu svo skriftur virki óháð tungumáli.

## Takmarkanir

- Þegar forritið er opnað úr möppu (file://) er ekki hægt að rjúfa Python-kóða á meðan hann keyrir. Ef eitthvað frýs:
  *Endurræsa Python*. Vistaðar skriftur verða ekki fyrir áhrifum, en hlutir í setunni hverfa. Keyri forritið af
  vefþjóni (localhost eða https) er hnappurinn *Stöðva* til staðar, sem stöðvar kóðann og heldur setunni (sjá
  [faq.md](faq.md)).
- Minni er takmarkað af vafranum og WebAssembly; haltu gagnasöfnum undir nokkur hundruð megabætum í Python.
- Inntak á meðan keyrt er (`input()`) virkar ekki, og ekki heldur þræðir, ferli eða skrár utan sýndarskráakerfisins.
  Netköll frá Python (til dæmis `micropip` og `pyodide.http`) krefjast þess að þú hafir gefið leyfi fyrir einingum.
- Engir gagnvirkir gluggar eru til; matplotlib teiknar í SVG og PNG. plotly er teiknað með plotly.js í forritinu og seaborn fylgir með sem pakki.
