# Python i Dataspatium

Modusen *Analyser* har ein Python-konsoll ved sida av R-konsollen. Python køyrer i nettlesaren med Pyodide (Python 3.13),
heilt utan installasjon. I motsetnad til R følgjer Python ikkje med i appmappa: køyretida og pakkane blir henta frå
jsDelivr første gongen du brukar dei, etter at du har gjeve løyve, og blir deretter lagra i nettlesaren som komponentar.

## Kom i gang

1. Opne *Analyser* og fana *Python*. Trykk *Start Python* eller *Køyr*. Første gongen spør appen om løyve til å hente
   komponentar og lastar ned Python med numpy og pandas (om lag 22 MB); det tek eit halvt minutt på eit vanleg
   samband. Neste gong startar Python på eit par sekund utan internett.
2. Skriv kode i redigeringsfeltet, og trykk Ctrl+Enter (Cmd+Enter på Mac). Heile skriptet blir køyrt; er tekst merkt,
   blir berre merkinga køyrd. Utdata, feil og diagram blir viste under redigeringsfeltet, og verdien av den siste linja
   blir skriven ut som i ein Python-konsoll.
3. Lagre skript med *Lagre skript*. Lagra skript ligg i panelet til venstre og følgjer med i tryggingskopiar.

## Funksjonane i Dataspatium

Funksjonane heiter det same som i R og finst direkte i sesjonen (`from dataspatium import *` blir køyrt ved start).

| Funksjon | Gjer |
|---|---|
| `dm_list()` | Viser datasetta i sesjonen som ein `DataFrame` med kolonnane namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("kortnamn")` | Les inn eit datasett som pandas `DataFrame` med rette typar: datoar og datoar med tid blir `datetime64`, ja/nei `boolean`, heiltal `int64` (eller `Int64` når verdiar manglar), tal `float64`, tekst `str`. Argumentet er helst kortnamnet (det knappen *Set inn dm_read()* skriv), men kan òg vere id, nøyaktig namn, namn uavhengig av store og små bokstavar eller eit eintydig prefiks. |
| `dm_read("Namn", columns=["a", "b"], where="a > 10", n=1000)` | Les berre visse kolonnar, rader som oppfyller eit SQL-vilkår, eller eit avgrensa tal på rader. |
| `df.attrs["dataspatium"]` | Etikettane, skildringane, einingane, typane og verdietikettane til kolonnane frå appen (`labels`, `descriptions`, `units`, `types`, `value_labels`). `dm_write()` tek dei med tilbake, eller via argumenta `labels`, `descriptions` og `units`. |
| `dm_value_labels(df, "kjonn", {1: "Mann", 2: "Kvinne"}, to="labels")` | Verdietikettar for ein kolonne som ein dict frå kode til etikett. `to="labels"` byter kodar mot etikettar, `to="codes"` tilbake, `to=None` set berre etikettane, og `labels=None` fjernar dei. Tabellen blir endra på staden, og `dm_write()` lagrar etikettane. |
| `dm_write(df, "Nytt namn", description="…")` | Sender ein `DataFrame` til appen som eit nytt datasett. Det dukkar opp i lista når kommandoen er ferdig. Utan namn blir namnet på variabelen brukt. |
| `theme_dataspatium()` | matplotlib-stil med utsjånaden og paletten til appen. Blir sett automatisk første gongen matplotlib blir brukt i sesjonen. |
| `dm_palette()` | Fargepaletten til appen (Okabe-Ito, fargeblindsikker) som ei liste; `dm_palette(n)` gjev n fargar. |

Døme:

```python
df = dm_read("befolkning_2024")
per_fylke = (df.groupby("fylke", as_index=False)
    .agg(folketal=("folketal", "sum"), kommunar=("kommune", "count"))
    .sort_values("folketal", ascending=False))
per_fylke
dm_write(per_fylke, "Folketal per fylke 2024")

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.barh(per_fylke["fylke"][::-1], per_fylke["folketal"][::-1] / 1000, color=dm_palette()[0])
ax.set_title("Folketal per fylke 2024")
ax.set_xlabel("Tusen")
```

### Bygningsmodellar (IFC) med IfcOpenShell

| Funksjon | Gjer |
|---|---|
| `dm_ifc("modell")` | Opnar ein IFC-modell (datasett av typen modell) med IfcOpenShell og returnerer ei `ifcopenshell.file`. Wheels blir henta første gongen (om lag 13 MB, etter samtykke). |
| `dm_ifc_elements(model, "IfcWall")` | Elementa som `DataFrame`: guid, typ, namn, beskrivning, objekttyp, tagg, vaning, typnamn, material, id. |
| `dm_ifc_psets(model, "IfcWall", qtos=True)` | Eigenskapssetta som ein brei tabell, ein kolonne per `Sett.Eigenskap`; `qtos=True` tek med mengdesetta. |
| `dm_ifc_tree(model)` | Den romlege strukturen: nivå, guid, type, namn, forelder, talet på element. |
| `dm_ifc_validate(model, express=True)` | Funn frå skjemakontrollen: nivå, type, id, guid, attributt, melding. `express=True` køyrer òg reglane i skjemaet. |
| `dm_ifc_select(model, "IfcWall, Pset_WallCommon.FireRating=EI60")` | Element etter utvalsspråket i IfcOpenShell, som `dm_ifc_elements()` listar dei. |
| `dm_ifc_geometry(model, "IfcWall")` | Volum, overflate og omsluttande boks per element, målt på geometrien (meter). |
| `dm_ifc_ids(model, "krav.ids")` | Kontrollerer modellen mot ei IDS-fil (sti i filsystemet til Python, XML-tekst eller bytes) med ifctester: specifikation, krav, status, guid, typ, namn, orsak; oppteljinga i `df.attrs["ids"]`. |
| `dm_ifc_set(model, df, key="guid")` | Skriv verdiane i tabellen inn i modellen (attributt og `Sett.Eigenskap`-kolonnar) og returnerer talet på endra element. |
| `dm_ifc_write(model, "Nytt namn")` | Sender modellen til appen som eit nytt modelldatasett. Det opphavlege datasettet blir ikkje endra. |

Heile API-et i IfcOpenShell kan brukast: `model.by_type("IfcWall")`, `ifcopenshell.util.element.get_psets(e)`, `ifcopenshell.api` med fleire. Steget *Python på modellen* i Bearbeid køyrer same slags kode som ein funksjon `step(model)` og gjer resultatet til ein ny versjon av datasettet; sjå [CAD og BIM](cad-bim.md).

## Diagram

matplotlib teiknar utan skjerm (Agg), og kvar open figur blir vist i konsollen som SVG når kommandoen er ferdig; figurane
blir deretter lukka, så ein ny kommando byrjar med reint bord. Under kvart diagram finst knappar for eksport til SVG
(vektor, bra for Word og nett), PNG og PDF, i storleiken 7 × 5 tommar og 150 dpi for PNG. I notatboka blir
diagramma lagra som PNG.

## Pakkar

Ved starten blir numpy, pandas og micropip henta. Pyodide har pakkar bygde for nettlesaren, over 350 stykke: matplotlib,
scipy, statsmodels, scikit-learn, networkx, shapely, geopandas, sympy, pillow, lxml, openpyxl, xlrd, sqlalchemy,
pyarrow, duckdb, bokeh, altair med fleire. Når koden importerer ein pakke som ikkje finst i sesjonen, hentar appen
hjulet med avhengnadene før koden blir køyrd, kontrollerer det mot kontrollsummen i pakkelista til Pyodide og lagrar det i
nettlesaren; det blir vist under *Handter → Arbeidsområde → Komponentar*, der komponentar òg kan fjernast. Reine
Python-pakkar frå PyPI som ikkje er med i Pyodide, blir installerte med `import micropip; await micropip.install("pakke")`;
appen spør om løyve før Python går på internett.

Kontrollsummar: filene til køyretida er låste til Pyodide 0.29.5 med SHA-256 i appen; pakkane blir kontrollerte mot
`pyodide-lock.json`, som sjølv er låst med summen sin. Ei fil med feil sum blir ikkje brukt.

## Kodesteg i oppskrifter

I Bearbeid finst handlinga **Python-steg** (gruppa Kode i paletten): ein funksjon `def step(df): ... return df`
blir køyrd på heile tabellen med pandas, og det funksjonen returnerer, blir den nye tabellen med typar frå resultatet.
Steget blir logga i oppskrifta med koden sin, kan angrast, spelast av på eit anna datasett og følgjer med når oppskrifta
blir eksportert (som kommentarar i SQL- og R-koden). Knappen *Førehandsvis* køyrer funksjonen på dei første 200 radene og
viser kolonnane i resultatet og nokre rader før du brukar han. Importer det du treng i koden; `pd` og `np` finst
allereie. Det tilsvarande **R-steget** tek ein funksjon `function(df) { ... }` (sjå [r-guide.md](r-guide.md)).

## seaborn og plotly

seaborn og plotly er ikkje med i utvalet til Pyodide; appen har hjula deira frå PyPI låste med kontrollsummar og hentar
dei som komponentar når koden importerer dei (`import seaborn as sns`, `import plotly.express as px`). seaborn
teiknar via matplotlib og blir vist som andre figurar. plotly-figurar blir viste interaktivt: `fig.show()`, eller `fig` som
siste linje, overlèt figuren til appen, som teiknar han med plotly.js (blir henta som komponent første gongen, 4,8 MB) og
temaet til appen, og eksporterer han til SVG, PNG og PDF. I notatboka blir plotly-figurar lagra som PNG, med den interaktive
visinga halden så lenge plotly.js finst.

## Python-diagram i Visualiser

I Visualiser kan eit diagram vere eit **Python-skript**: datasettet finst som `df`, og det siste diagrammet (matplotlib
eller plotly) blir vist og lagra med skriptet. Python-diagram blir eksporterte til SVG, PNG, PDF og PowerPoint, køyrde i
batch per gruppe (skriptet blir køyrt éin gong per verdi med `df` filtrert) og kan setjast inn i dokumentmalar med
`{{diagram "Namn"}}`; det same gjeld no R-diagram. I dashbord og i publisert HTML blir eit lagra plotly-diagram vist
interaktivt, andre Python- og R-diagram som lagra bilete.

## Slik blir data flytta mellom appen og Python

Datasetta er SQLite-filer. Når du køyrer kode, kopierer appen datasetta som koden refererer til med `dm_read()`,
til det virtuelle filsystemet til Python under `/data`, saman med ein indeks. `dm_read()` les fila med modulen `sqlite3` og
`pandas.read_sql_query` og gjenopprettar kolonnetypane frå tabellen `_columns`. `dm_write()` skriv ei ny SQLite-fil
i `/data/out`, som appen hentar og legg til i arbeidsområdet når kommandoen er ferdig. Du kan bruke `sqlite3`
direkte: `sqlite3.connect("/data/<id>.sqlite")`, der id blir vist av `dm_list()`.

Datasett større enn 50 MB blir berre spegla når koden refererer til dei. Data mellom R og Python går via datasett:
`dm_write()` i det eine språket, `dm_read()` i det andre.

## Språk

Meldingar frå `dm_list()`, `dm_read()` og `dm_write()` følgjer språket i appen (svensk, dansk, norsk bokmål eller nynorsk, finsk, islandsk
eller engelsk); kolonnenamna i `dm_list()` er derimot alltid dei same, slik at skript fungerer uavhengig av språk.

## Avgrensingar

- Når appen blir opna frå ei mappe (file://), kan Python-kode ikkje avbrytast medan han køyrer. Om noko heng: *Start Python
  på nytt*. Lagra skript blir ikkje påverka, men objekt i sesjonen forsvinn. Køyrer appen frå ein webtenar (localhost
  eller https), finst knappen *Avbryt*, som stoppar koden og held på sesjonen (sjå [faq.md](faq.md)).
- Minnet er avgrensa av nettlesaren og WebAssembly; hald datasett under nokre hundre megabyte i Python.
- Inndata under køyring (`input()`) fungerer ikkje, og heller ikkje trådar, prosessar eller filer utanfor det virtuelle
  filsystemet. Nettverkskall frå Python (til dømes `micropip` og `pyodide.http`) krev at du har gjeve løyve til
  komponentar.
- Det finst ingen interaktive vindauge; matplotlib teiknar til SVG og PNG. plotly blir teikna med plotly.js i appen, og seaborn følgjer med som pakke.
