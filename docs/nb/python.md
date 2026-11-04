# Python i Dataspatium

Modusen *Analyser* har en Python-konsoll ved siden av R-konsollen. Python kjører i nettleseren med Pyodide (Python 3.14),
helt uten installasjon. I motsetning til R følger Python ikke med i appmappen: kjøretiden og pakkene hentes fra
jsDelivr første gang du bruker dem, etter at du har gitt lov, og lagres deretter i nettleseren som komponenter.

## Kom i gang

1. Åpne *Analyser* og fanen *Python*. Trykk *Start Python* eller *Kjør*. Første gang spør appen om lov til å hente
   komponenter og laster ned Python med numpy og pandas (cirka 22 MB); det tar et halvt minutt på en vanlig
   forbindelse. Neste gang starter Python på et par sekunder uten internett.
2. Skriv kode i redigeringsfeltet, og trykk Ctrl+Enter (Cmd+Enter på Mac). Hele skriptet kjøres; er tekst markert,
   kjøres bare markeringen. Utdata, feil og diagrammer vises under redigeringsfeltet, og verdien av den siste linjen
   skrives ut som i en Python-konsoll.
3. Lagre skript med *Lagre skript*. Lagrede skript ligger i panelet til venstre og følger med i sikkerhetskopier.

## Dataspatiums funksjoner

Funksjonene heter det samme som i R og finnes direkte i sesjonen (`from dataspatium import *` kjøres ved start).

| Funksjon | Gjør |
|---|---|
| `dm_list()` | Viser datasettene i sesjonen som en `DataFrame` med kolonnene namn, kortnamn, mapp, rader, kolumner, ändrad, id. |
| `dm_read("kortnavn")` | Leser inn et datasett som pandas `DataFrame` med riktige typer: datoer og datoer med tid blir `datetime64`, ja/nei `boolean`, heltall `int64` (eller `Int64` når verdier mangler), tall `float64`, tekst `str`. Argumentet er helst kortnavnet (det knappen *Sett inn dm_read()* skriver), men kan også være id, nøyaktig navn, navn uavhengig av store og små bokstaver eller et entydig prefiks. |
| `dm_read("Navn", columns=["a", "b"], where="a > 10", n=1000)` | Leser bare visse kolonner, rader som oppfyller en SQL-betingelse, eller et begrenset antall rader. |
| `df.attrs["dataspatium"]` | Kolonnenes etiketter, beskrivelser, enheter, typer og verdietiketter fra appen (`labels`, `descriptions`, `units`, `types`, `value_labels`). `dm_write()` tar dem med tilbake, eller via argumentene `labels`, `descriptions` og `units`. |
| `dm_value_labels(df, "kjonn", {1: "Mann", 2: "Kvinne"}, to="labels")` | Verdietiketter for en kolonne som en dict fra kode til etikett. `to="labels"` bytter koder mot etiketter, `to="codes"` tilbake, `to=None` setter bare etikettene, og `labels=None` fjerner dem. Tabellen endres på stedet, og `dm_write()` lagrer etikettene. |
| `dm_write(df, "Nytt navn", description="…")` | Sender en `DataFrame` til appen som et nytt datasett. Det dukker opp i listen når kommandoen er ferdig. Uten navn brukes variabelens navn. |
| `theme_dataspatium()` | matplotlib-stil med appens utseende og palett. Settes automatisk første gang matplotlib brukes i sesjonen. |
| `dm_palette()` | Appens fargepalett (Okabe-Ito, fargeblindsikker) som en liste; `dm_palette(n)` gir n farger. |

Eksempel:

```python
df = dm_read("befolkning_2024")
per_fylke = (df.groupby("fylke", as_index=False)
    .agg(folketall=("folketall", "sum"), kommuner=("kommune", "count"))
    .sort_values("folketall", ascending=False))
per_fylke
dm_write(per_fylke, "Folketall per fylke 2024")

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.barh(per_fylke["fylke"][::-1], per_fylke["folketall"][::-1] / 1000, color=dm_palette()[0])
ax.set_title("Folketall per fylke 2024")
ax.set_xlabel("Tusen")
```

## Diagrammer

matplotlib tegner uten skjerm (Agg), og hver åpen figur vises i konsollen som SVG når kommandoen er ferdig; figurene
lukkes deretter, så en ny kommando begynner med rent bord. Under hvert diagram finnes knapper for eksport til SVG
(vektor, bra for Word og nett), PNG og PDF, i størrelsen 7 × 5 tommer og 150 dpi for PNG. I notatboken lagres
diagrammene som PNG.

## Pakker

Ved starten hentes numpy, pandas og micropip. Pyodide har pakker bygd for nettleseren, over 350 stykker: matplotlib,
scipy, statsmodels, scikit-learn, networkx, shapely, geopandas, sympy, pillow, lxml, openpyxl, xlrd, sqlalchemy,
pyarrow, duckdb, bokeh, altair med flere. Når koden importerer en pakke som ikke finnes i sesjonen, henter appen
hjulet med avhengighetene før koden kjøres, kontrollerer det mot kontrollsummen i Pyodides pakkeliste og lagrer det i
nettleseren; det vises under *Håndter → Arbeidsområde → Komponenter*, der komponenter også kan fjernes. Rene
Python-pakker fra PyPI som ikke inngår i Pyodide, installeres med `import micropip; await micropip.install("pakke")`;
appen spør om lov før Python går på internett.

Kontrollsummer: kjøretidens filer er låst til Pyodide 314.0.7 med SHA-256 i appen; pakkene kontrolleres mot
`pyodide-lock.json`, som selv er låst med sin sum. En fil med feil sum brukes ikke.

## Slik flyttes data mellom appen og Python

Datasettene er SQLite-filer. Når du kjører kode, kopierer appen datasettene som koden refererer til med `dm_read()`,
til Pythons virtuelle filsystem under `/data`, sammen med en indeks. `dm_read()` leser filen med modulen `sqlite3` og
`pandas.read_sql_query` og gjenoppretter kolonnetypene fra tabellen `_columns`. `dm_write()` skriver en ny SQLite-fil
i `/data/out`, som appen henter og legger til i arbeidsområdet når kommandoen er ferdig. Du kan bruke `sqlite3`
direkte: `sqlite3.connect("/data/<id>.sqlite")`, der id vises av `dm_list()`.

Datasett større enn 50 MB speiles bare når koden refererer til dem. Data mellom R og Python går via datasett:
`dm_write()` i det ene språket, `dm_read()` i det andre.

## Språk

Meldinger fra `dm_list()`, `dm_read()` og `dm_write()` følger appens språk (svensk, dansk, norsk, finsk, islandsk
eller engelsk); kolonnenavnene i `dm_list()` er derimot alltid de samme, slik at skript fungerer uavhengig av språk.

## Begrensninger

- Når appen åpnes fra en mappe (file://), kan Python-kode ikke avbrytes mens den kjører. Hvis noe henger: *Start Python
  på nytt*. Lagrede skript påvirkes ikke, men objekter i sesjonen forsvinner. Kjører appen fra en webserver (localhost
  eller https), finnes knappen *Avbryt*, som stopper koden og beholder sesjonen (se [faq.md](faq.md)).
- Minnet begrenses av nettleseren og WebAssembly; hold datasett under noen hundre megabyte i Python.
- Inndata under kjøring (`input()`) fungerer ikke, og heller ikke tråder, prosesser eller filer utenfor det virtuelle
  filsystemet. Nettverkskall fra Python (for eksempel `micropip` og `pyodide.http`) krever at du har gitt lov til
  komponenter.
- Det finnes ingen interaktive vinduer; matplotlib tegner til SVG og PNG. plotly og seaborn kommer i en senere versjon.
