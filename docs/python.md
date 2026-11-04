# Python i Dataspatium

Läget *Analysera* har en Python-konsol bredvid R-konsolen. Python körs i webbläsaren med Pyodide (Python 3.14),
helt utan installation. Till skillnad från R följer Python inte med i appmappen: körtiden och paketen hämtas från
jsDelivr första gången du använder dem, efter att du gett lov, och sparas sedan i webbläsaren som komponenter.

## Kom igång

1. Öppna *Analysera* och fliken *Python*. Tryck *Starta Python* eller *Kör*. Första gången frågar appen om lov att
   hämta komponenter och laddar ned Python med numpy och pandas (cirka 22 MB); det tar en halv minut på en vanlig
   anslutning. Nästa gång startar Python på ett par sekunder utan internet.
2. Skriv kod i redigeraren och tryck Ctrl+Enter (Cmd+Enter på Mac). Hela skriptet körs; är text markerad körs bara
   markeringen. Utskrifter, fel och diagram visas under redigeraren, och värdet av den sista raden skrivs ut som i
   en Python-konsol.
3. Spara skript med *Spara skript*. Sparade skript ligger i panelen till vänster och följer med i säkerhetskopior.

## Dataspatiums funktioner

Funktionerna heter detsamma som i R och finns direkt i sessionen (`from dataspatium import *` körs vid starten).

| Funktion | Gör |
|---|---|
| `dm_list()` | Visar datamängderna i sessionen som en `DataFrame` med kolumnerna namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("kortnamn")` | Läser in en datamängd som pandas `DataFrame` med rätt typer: datum och datum med tid blir `datetime64`, ja/nej `boolean`, heltal `int64` (eller `Int64` när värden saknas), tal `float64`, text `str`. Argumentet är helst kortnamnet (det som knappen *Infoga dm_read()* skriver) men kan också vara id, exakt namn, namn oavsett skiftläge eller ett entydigt prefix. |
| `dm_read("Namn", columns=["a", "b"], where="a > 10", n=1000)` | Läser bara vissa kolumner, rader som uppfyller ett SQL-villkor, eller ett begränsat antal rader. |
| `df.attrs["dataspatium"]` | Kolumnernas etiketter, beskrivningar, enheter, typer och värdeetiketter från appen (`labels`, `descriptions`, `units`, `types`, `value_labels`). `dm_write()` tar dem tillbaka, eller via argumenten `labels`, `descriptions` och `units`. |
| `dm_value_labels(df, "kon", {1: "Man", 2: "Kvinna"}, to="labels")` | Värdeetiketter för en kolumn, som en dict från kod till etikett. `to="labels"` byter koder mot etiketter, `to="codes"` tillbaka, `to=None` sätter bara etiketterna, och `labels=None` tar bort dem. Tabellen ändras på plats och `dm_write()` sparar etiketterna. |
| `dm_write(df, "Nytt namn", description="…")` | Skickar en `DataFrame` till appen som en ny datamängd. Den dyker upp i listan när kommandot är klart. Utan namn används variabelns namn. |
| `theme_dataspatium()` | matplotlib-stil med appens utseende och palett. Sätts automatiskt första gången matplotlib används i sessionen. |
| `dm_palette()` | Appens färgpalett (Okabe-Ito, färgblindsäker) som en lista; `dm_palette(n)` ger n färger. |

Exempel:

```python
df = dm_read("befolkning_2024")
per_lan = (df.groupby("lan", as_index=False)
    .agg(folkmangd=("folkmangd", "sum"), kommuner=("kommun", "count"))
    .sort_values("folkmangd", ascending=False))
per_lan
dm_write(per_lan, "Folkmängd per län 2024")

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.barh(per_lan["lan"][::-1], per_lan["folkmangd"][::-1] / 1000, color=dm_palette()[0])
ax.set_title("Folkmängd per län 2024")
ax.set_xlabel("Tusental")
```

## Diagram

matplotlib ritar utan skärm (Agg) och varje öppen figur visas i konsolen som SVG när kommandot är klart; figurerna
stängs sedan, så ett nytt kommando börjar med rent bord. Under varje diagram finns knappar för export till SVG
(vektor, bra för Word och webb), PNG och PDF, i storleken 7 × 5 tum och 150 dpi för PNG. I anteckningsboken sparas
diagrammen som PNG.

## Paket

Vid starten hämtas numpy, pandas och micropip. Pyodide har färdigbyggda paket för webbläsaren, över 350 stycken:
matplotlib, scipy, statsmodels, scikit-learn, networkx, shapely, geopandas, sympy, pillow, lxml, openpyxl, xlrd,
sqlalchemy, pyarrow, duckdb, bokeh, altair med flera. När koden importerar ett paket som inte finns i sessionen
hämtar appen hjulet med dess beroenden innan koden körs, kontrollerar det mot kontrollsumman i Pyodides paketlista
och sparar det i webbläsaren; det syns under *Hantera → Arbetsyta → Komponenter*, där komponenter också kan tas bort.
Rena Python-paket från PyPI som inte ingår i Pyodide installeras med `import micropip; await micropip.install("paket")`;
appen frågar om lov innan Python når internet.

Kontrollsummor: körtidens filer är låsta till Pyodide 314.0.7 med SHA-256 i appen; paketen kontrolleras mot
`pyodide-lock.json`, som i sin tur är låst med sin summa. En fil med fel summa används inte.

## Kodsteg i recept

I Bearbeta finns åtgärden **Python-steg** (gruppen Kod i paletten): en funktion `def step(df): ... return df` körs på
hela tabellen med pandas, och det funktionen returnerar blir den nya tabellen, med typer från resultatet. Steget
loggas i receptet med sin kod, kan ångras, spelas upp på en annan datamängd och följer med när receptet exporteras
(som kommentarer i SQL- och R-koden). Knappen *Förhandsgranska* kör funktionen på de första 200 raderna och visar
resultatets kolumner och några rader innan du tillämpar. Importera det du behöver i koden; `pd` och `np` finns
redan. Motsvarande **R-steg** tar en funktion `function(df) { ... }` (se [r-guide.md](r-guide.md)).

## seaborn och plotly

seaborn och plotly ingår inte i Pyodides utbud; appen har deras hjul från PyPI pinnade med kontrollsummor och hämtar
dem som komponenter när koden importerar dem (`import seaborn as sns`, `import plotly.express as px`). seaborn
ritar via matplotlib och visas som andra figurer. plotly-figurer visas interaktivt: `fig.show()`, eller `fig` som
sista rad, lämnar figuren till appen, som ritar den med plotly.js (hämtas som komponent första gången, 4,8 MB) och
appens tema, och exporterar den till SVG, PNG och PDF. I anteckningsboken sparas plotly-figurer som PNG, med den
interaktiva vyn kvar så länge plotly.js finns.

## Python-diagram i Visualisera

I Visualisera kan ett diagram vara ett **Python-skript**: datamängden finns som `df`, och det senaste diagrammet
(matplotlib eller plotly) visas och sparas med skriptet. Python-diagram exporteras till SVG, PNG, PDF och PowerPoint,
körs i batch per grupp (skriptet körs en gång per värde med `df` filtrerat) och kan läggas in i dokumentmallar med
`{{diagram "Namn"}}`; detsamma gäller nu R-diagram. I dashboards och i publicerad HTML visas ett sparat
plotly-diagram interaktivt, övriga Python- och R-diagram som sparad bild.

## Hur data flyttas mellan appen och Python

Datamängderna är SQLite-filer. När du kör kod kopierar appen de datamängder som koden refererar med `dm_read()`
till Pythons virtuella filsystem under `/data`, tillsammans med ett index. `dm_read()` läser filen med modulen
`sqlite3` och `pandas.read_sql_query` och återställer kolumntyperna från tabellen `_columns`. `dm_write()` skriver en
ny SQLite-fil i `/data/out` som appen hämtar och lägger till i arbetsytan när kommandot är klart. Vill du använda
`sqlite3` direkt går det bra: `sqlite3.connect("/data/<id>.sqlite")` där id visas av `dm_list()`.

Datamängder större än 50 MB speglas bara när de refereras i koden. Data mellan R och Python går via datamängder:
`dm_write()` i det ena språket, `dm_read()` i det andra.

## Språk

Meddelanden från `dm_list()`, `dm_read()` och `dm_write()` följer appens språk (svenska, danska, norska, finska,
isländska eller engelska); kolumnnamnen i `dm_list()` är däremot alltid desamma så att skript fungerar oavsett
språk.

## Begränsningar

- När appen öppnas från en mapp (file://) kan Python-kod inte avbrytas medan den körs. Om något hänger sig: *Starta
  om Python*. Sparade skript påverkas inte, men objekt i sessionen försvinner. Körs appen från en webbserver
  (localhost eller https) finns knappen *Avbryt*, som stoppar koden och behåller sessionen (se [faq.md](faq.md)).
- Minnet begränsas av webbläsaren och WebAssembly; håll datamängder under några hundra megabyte i Python.
- Inmatning under körning (`input()`) fungerar inte, inte heller trådar, processer eller filer utanför det
  virtuella filsystemet. Nätverksanrop från Python (till exempel `micropip` och `pyodide.http`) kräver att du
  gett lov till komponenter.
- Interaktiva fönster finns inte; matplotlib ritar till SVG och PNG. plotly och seaborn kommer i en senare version.
