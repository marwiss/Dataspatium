# Python i Dataspatium

Tilstanden *Analysér* har en Python-konsol ved siden af R-konsollen. Python kører i browseren med Pyodide (Python 3.13),
helt uden installation. Modsat R følger Python ikke med i appmappen: kørselsmiljøet og pakkerne hentes fra jsDelivr
første gang, du bruger dem, efter at du har givet lov, og gemmes derefter i browseren som komponenter.

## Kom i gang

1. Åbn *Analysér* og fanen *Python*. Tryk *Start Python* eller *Kør*. Første gang spørger appen om lov til at hente
   komponenter og downloader Python med numpy og pandas (cirka 22 MB); det tager et halvt minut på en almindelig
   forbindelse. Næste gang starter Python på et par sekunder uden internet.
2. Skriv kode i editoren, og tryk Ctrl+Enter (Cmd+Enter på Mac). Hele scriptet køres; er der markeret tekst, køres kun
   markeringen. Output, fejl og diagrammer vises under editoren, og værdien af den sidste linje udskrives som i en
   Python-konsol.
3. Gem scripts med *Gem script*. Gemte scripts ligger i panelet til venstre og følger med i sikkerhedskopier.

## Dataspatiums funktioner

Funktionerne hedder det samme som i R og findes direkte i sessionen (`from dataspatium import *` køres ved start).

| Funktion | Gør |
|---|---|
| `dm_list()` | Viser datasættene i sessionen som en `DataFrame` med kolonnerne namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("kortnavn")` | Indlæser et datasæt som pandas `DataFrame` med de rigtige typer: datoer og datoer med tid bliver `datetime64`, ja/nej `boolean`, heltal `int64` (eller `Int64`, når værdier mangler), tal `float64`, tekst `str`. Argumentet er helst kortnavnet (det, som knappen *Indsæt dm_read()* skriver), men kan også være id, det præcise navn, navnet uanset store og små bogstaver eller et entydigt præfiks. |
| `dm_read("Navn", columns=["a", "b"], where="a > 10", n=1000)` | Læser kun visse kolonner, rækker, der opfylder en SQL-betingelse, eller et begrænset antal rækker. |
| `df.attrs["dataspatium"]` | Kolonnernes etiketter, beskrivelser, enheder, typer og værdietiketter fra appen (`labels`, `descriptions`, `units`, `types`, `value_labels`). `dm_write()` tager dem med tilbage, eller via argumenterne `labels`, `descriptions` og `units`. |
| `dm_value_labels(df, "kon", {1: "Mand", 2: "Kvinde"}, to="labels")` | Værdietiketter for en kolonne som en dict fra kode til etiket. `to="labels"` erstatter koder med etiketter, `to="codes"` går tilbage, `to=None` sætter kun etiketterne, og `labels=None` fjerner dem. Tabellen ændres på stedet, og `dm_write()` gemmer etiketterne. |
| `dm_write(df, "Nyt navn", description="…")` | Sender en `DataFrame` til appen som et nyt datasæt. Det dukker op i listen, når kommandoen er færdig. Uden navn bruges variablens navn. |
| `theme_dataspatium()` | matplotlib-stil med appens udseende og palet. Sættes automatisk første gang, matplotlib bruges i sessionen. |
| `dm_palette()` | Appens farvepalet (Okabe-Ito, farveblindsikker) som en liste; `dm_palette(n)` giver n farver. |

Eksempel:

```python
df = dm_read("befolkning_2024")
per_region = (df.groupby("region", as_index=False)
    .agg(folketal=("folketal", "sum"), kommuner=("kommune", "count"))
    .sort_values("folketal", ascending=False))
per_region
dm_write(per_region, "Folketal per region 2024")

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.barh(per_region["region"][::-1], per_region["folketal"][::-1] / 1000, color=dm_palette()[0])
ax.set_title("Folketal per region 2024")
ax.set_xlabel("Tusinder")
```

### Bygningsmodeller (IFC) med IfcOpenShell

| Funktion | Gør |
|---|---|
| `dm_ifc("model")` | Åbner en IFC-model (datasæt af typen model) med IfcOpenShell og returnerer en `ifcopenshell.file`. Wheels hentes første gang (cirka 13 MB, efter samtykke). |
| `dm_ifc_elements(model, "IfcWall")` | Elementerne som `DataFrame`: guid, typ, namn, beskrivning, objekttyp, tagg, vaning, typnamn, material, id. |
| `dm_ifc_psets(model, "IfcWall", qtos=True)` | Egenskabssættene som en bred tabel, en kolonne pr. `Sæt.Egenskab`; `qtos=True` tager mængdesættene med. |
| `dm_ifc_tree(model)` | Den rumlige struktur: niveau, guid, type, navn, overordnet, antal elementer. |
| `dm_ifc_validate(model, express=True)` | Fund fra skemakontrollen: niveau, type, id, guid, attribut, besked. `express=True` kører også skemaets regler. |
| `dm_ifc_select(model, "IfcWall, Pset_WallCommon.FireRating=EI60")` | Elementer efter IfcOpenShells udvalgssprog, som `dm_ifc_elements()` lister dem. |
| `dm_ifc_geometry(model, "IfcWall")` | Volumen, overflade og omsluttende kasse pr. element, målt på geometrien (meter). |
| `dm_ifc_ids(model, "krav.ids")` | Kontrollerer modellen mod en IDS-fil (sti i Pythons filsystem, XML-tekst eller bytes) med ifctester: specifikation, krav, status, guid, typ, namn, orsak; optællingen i `df.attrs["ids"]`. |
| `dm_ifc_set(model, df, key="guid")` | Skriver tabellens værdier ind i modellen (attributter og `Sæt.Egenskab`-kolonner) og returnerer antallet af ændrede elementer. |
| `dm_ifc_write(model, "Nyt navn")` | Sender modellen til appen som et nyt modeldatasæt. Det oprindelige datasæt ændres ikke. |

Hele IfcOpenShells API kan bruges: `model.by_type("IfcWall")`, `ifcopenshell.util.element.get_psets(e)`, `ifcopenshell.api` med flere. Trinnet *Python på modellen* i Bearbejd kører samme slags kode som en funktion `step(model)` og gør resultatet til en ny version af datasættet; se [CAD og BIM](cad-bim.md).

## Diagrammer

matplotlib tegner uden skærm (Agg), og hver åben figur vises i konsollen som SVG, når kommandoen er færdig; figurerne
lukkes derefter, så en ny kommando begynder med rent bord. Under hvert diagram er der knapper til eksport til SVG
(vektor, godt til Word og web), PNG og PDF, i størrelsen 7 × 5 tommer og 150 dpi for PNG. I notesbogen gemmes
diagrammerne som PNG.

## Pakker

Ved starten hentes numpy, pandas og micropip. Pyodide har pakker bygget til browseren, over 350 i alt: matplotlib,
scipy, statsmodels, scikit-learn, networkx, shapely, geopandas, sympy, pillow, lxml, openpyxl, xlrd, sqlalchemy,
pyarrow, duckdb, bokeh, altair med flere. Når koden importerer en pakke, der ikke findes i sessionen, henter appen
hjulet med dets afhængigheder, inden koden køres, kontrollerer det mod kontrolsummen i Pyodides pakkeliste og gemmer
det i browseren; det ses under *Håndtér → Arbejdsområde → Komponenter*, hvor komponenter også kan fjernes. Rene
Python-pakker fra PyPI, der ikke indgår i Pyodide, installeres med `import micropip; await micropip.install("pakke")`;
appen spørger om lov, inden Python går på internettet.

Kontrolsummer: kørselsmiljøets filer er låst til Pyodide 0.29.5 med SHA-256 i appen; pakkerne kontrolleres mod
`pyodide-lock.json`, som selv er låst med sin sum. En fil med forkert sum bruges ikke.

## Kodetrin i opskrifter

I Bearbejd findes handlingen **Python-trin** (gruppen Kode i paletten): en funktion `def step(df): ... return df`
køres på hele tabellen med pandas, og det, funktionen returnerer, bliver den nye tabel med typer fra resultatet.
Trinnet logges i opskriften med sin kode, kan fortrydes, afspilles på et andet datasæt og følger med, når opskriften
eksporteres (som kommentarer i SQL- og R-koden). Knappen *Forhåndsvis* kører funktionen på de første 200 rækker og
viser resultatets kolonner og nogle rækker, inden du anvender. Importér det, du har brug for, i koden; `pd` og `np`
findes allerede. Det tilsvarende **R-trin** tager en funktion `function(df) { ... }` (se [r-guide.md](r-guide.md)).

## seaborn og plotly

seaborn og plotly indgår ikke i Pyodides udvalg; appen har deres hjul fra PyPI fastlåst med kontrolsummer og henter
dem som komponenter, når koden importerer dem (`import seaborn as sns`, `import plotly.express as px`). seaborn
tegner via matplotlib og vises som andre figurer. plotly-figurer vises interaktivt: `fig.show()`, eller `fig` som
sidste linje, overlader figuren til appen, som tegner den med plotly.js (hentes som komponent første gang, 4,8 MB) og
appens tema og eksporterer den til SVG, PNG og PDF. I notesbogen gemmes plotly-figurer som PNG, med den interaktive
visning bevaret, så længe plotly.js findes.

## Python-diagrammer i Visualisér

I Visualisér kan et diagram være et **Python-script**: datasættet findes som `df`, og det seneste diagram (matplotlib
eller plotly) vises og gemmes med scriptet. Python-diagrammer eksporteres til SVG, PNG, PDF og PowerPoint, køres i
batch pr. gruppe (scriptet køres én gang pr. værdi med `df` filtreret) og kan indsættes i dokumentskabeloner med
`{{diagram "Navn"}}`; det samme gælder nu R-diagrammer. I dashboards og i publiceret HTML vises et gemt plotly-diagram
interaktivt, øvrige Python- og R-diagrammer som gemt billede.

## Sådan flyttes data mellem appen og Python

Datasættene er SQLite-filer. Når du kører kode, kopierer appen de datasæt, som koden refererer til med `dm_read()`,
til Pythons virtuelle filsystem under `/data` sammen med et indeks. `dm_read()` læser filen med modulet `sqlite3` og
`pandas.read_sql_query` og genskaber kolonnetyperne fra tabellen `_columns`. `dm_write()` skriver en ny SQLite-fil i
`/data/out`, som appen henter og føjer til arbejdsområdet, når kommandoen er færdig. Du kan bruge `sqlite3` direkte:
`sqlite3.connect("/data/<id>.sqlite")`, hvor id vises af `dm_list()`.

Datasæt større end 50 MB spejles kun, når koden refererer til dem. Data mellem R og Python går via datasæt:
`dm_write()` i det ene sprog, `dm_read()` i det andet.

## Sprog

Meddelelser fra `dm_list()`, `dm_read()` og `dm_write()` følger appens sprog (svensk, dansk, norsk, finsk, islandsk
eller engelsk); kolonnenavnene i `dm_list()` er derimod altid de samme, så scripts virker uanset sprog.

## Begrænsninger

- Når appen åbnes fra en mappe (file://), kan Python-kode ikke afbrydes, mens den kører. Hvis noget hænger: *Genstart
  Python*. Gemte scripts påvirkes ikke, men objekter i sessionen forsvinder. Kører appen fra en webserver (localhost
  eller https), findes knappen *Afbryd*, der stopper koden og bevarer sessionen (se [faq.md](faq.md)).
- Hukommelsen begrænses af browseren og WebAssembly; hold datasæt under nogle hundrede megabyte i Python.
- Input under kørsel (`input()`) virker ikke, og det gør tråde, processer eller filer uden for det virtuelle
  filsystem heller ikke. Netværkskald fra Python (for eksempel `micropip` og `pyodide.http`) kræver, at du har givet
  lov til komponenter.
- Der er ingen interaktive vinduer; matplotlib tegner til SVG og PNG. plotly tegnes med plotly.js i appen, og seaborn følger med som pakke.
