# Dataspatium Python helpers, imported into every Python session (``from dataspatium import *``).
# User documentation (Swedish): docs/sv/python.md.
#
# Datasets are exchanged with the app as SQLite files in /data (see docs/sv/format.md for the schema):
#   dm_list()                 datasets available in this session (a pandas DataFrame)
#   dm_read("Namn")           read a dataset as a pandas DataFrame with restored types
#   dm_write(df, "Namn")      hand a DataFrame back to the app as a new dataset
#   dm_value_labels(df, "kolumn", {1: "Man", 2: "Kvinna"}, to="labels")   value labels
#   theme_dataspatium()       matplotlib style and palette shared with the rest of the app
# Code comments are in English; messages shown to the user follow the app's language (dm_setup(lang)).
import base64
import csv
import datetime as _dt
import inspect
import io
import json
import math
import os
import random
import sqlite3
import sys

__all__ = ["dm_list", "dm_read", "dm_read_nodes", "dm_read_edges", "dm_read_properties", "dm_read_quantities", "dm_write", "dm_find", "dm_index", "dm_value_labels", "dm_palette",
           "theme_dataspatium", "dm_setup", "DataspatiumError", "dm_ifc", "dm_ifc_write", "dm_ifc_elements", "dm_ifc_psets", "dm_ifc_tree", "dm_ifc_validate",
           "dm_ifc_select", "dm_ifc_set", "dm_ifc_geometry", "dm_ifc_ids"]

DATA_DIR = "/data"
OUT_DIR = "/data/out"
PALETTE = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#56B4E9", "#CC79A7", "#F0E442", "#7F7F7F"]
_state = {"lang": "sv", "figures": {}, "plot_seq": 0, "mpl_setup": False}


class DataspatiumError(Exception):
    """An error with a message in the app's language."""


# ---- user-facing messages in the seven UI languages (sv is the fallback) -------------------------

MESSAGES = {
    "sv": {
        "list.empty": "Inga datamängder är tillgängliga i Python-sessionen ännu. Importera i läget Inhämta.",
        "find.none": "Inga datamängder finns i Python-sessionen. Kör dm_list() för att se vad som finns.",
        "find.many": "Flera datamängder matchar \"%s\": %s",
        "find.missing": "Hittar ingen datamängd som heter \"%s\". Kör dm_list() för att se vad som finns.",
        "read.notmirrored": "Datamängden \"%s\" är inte speglad till Python ännu. Prova igen om en stund.",
        "write.df": "dm_write() behöver en pandas DataFrame.",
        "write.nocols": "Datamängden saknar kolumner.",
        "write.sent": "Datamängden \"%s\" skickas till appen (%d rader, %d kolumner).",
        "write.log": "Skapad med dm_write() i Python",
        "write.default": "Från Python",
        "plot.gone": "Diagrammet finns inte längre i Python-sessionen.",
        "labels.named": "Värdeetiketterna ska vara en dict från kod till etikett, till exempel {1: \"Man\", 2: \"Kvinna\"}.",
        "labels.column": "Kolumnen \"%s\" finns inte i tabellen.",
        "step.nofunction": "Koden måste definiera en funktion step(df).",
        "step.notframe": "step(df) måste returnera en pandas DataFrame.",
        "plot.plotly": "Ett plotly-diagram exporteras av appen, inte av Python.",
        "ifc.notmodel": "Datamängden är ingen IFC-modell (saknar originalfil).",
        "ifc.nofile": "Modellens originalfil saknas i datamängden.",
        "ifc.needs": "Hjälparen behöver en modell från dm_ifc().",
        "ifc.written": "Modellen \"%s\" skickas till appen som ny datamängd.",
        "ifc.changed": "ändrad",
        "ifc.default": "Modell",
        "ifc.step.nofunction": "Koden måste definiera en funktion step(model).",
        "ifc.step.notmodel": "step(model) måste returnera modellen (eller None).",
        "ifc.key.missing": "Tabellen saknar nyckelkolumnen \"%s\".",
        "ids.invalid": "IDS-filen kunde inte läsas: %s",
        "ids.missing": "IDS-filen hittades inte: %s",
    },
    "da": {
        "list.empty": "Ingen datasæt er tilgængelige i Python-sessionen endnu. Importér under Hent.",
        "find.none": "Der findes ingen datasæt i Python-sessionen. Kør dm_list() for at se, hvad der findes.",
        "find.many": "Flere datasæt matcher \"%s\": %s",
        "find.missing": "Kan ikke finde et datasæt med navnet \"%s\". Kør dm_list() for at se, hvad der findes.",
        "read.notmirrored": "Datasættet \"%s\" er ikke spejlet til Python endnu. Prøv igen om et øjeblik.",
        "write.df": "dm_write() kræver en pandas DataFrame.",
        "write.nocols": "Datasættet har ingen kolonner.",
        "write.sent": "Datasættet \"%s\" sendes til appen (%d rækker, %d kolonner).",
        "write.log": "Oprettet med dm_write() i Python",
        "write.default": "Fra Python",
        "plot.gone": "Diagrammet findes ikke længere i Python-sessionen.",
        "labels.named": "Værdietiketterne skal være en dict fra kode til etiket, for eksempel {1: \"Mand\", 2: \"Kvinde\"}.",
        "labels.column": "Kolonnen \"%s\" findes ikke i tabellen.",
        "step.nofunction": "Koden skal definere en funktion step(df).",
        "step.notframe": "step(df) skal returnere en pandas DataFrame.",
        "plot.plotly": "Et plotly-diagram eksporteres af appen, ikke af Python.",
        "ifc.notmodel": "Datasættet er ingen IFC-model (mangler originalfil).",
        "ifc.nofile": "Modellens originalfil mangler i datasættet.",
        "ifc.needs": "Hjælperen skal have en model fra dm_ifc().",
        "ifc.written": "Modellen \"%s\" sendes til appen som nyt datasæt.",
        "ifc.changed": "ændret",
        "ifc.default": "Model",
        "ifc.step.nofunction": "Koden skal definere en funktion step(model).",
        "ifc.step.notmodel": "step(model) skal returnere modellen (eller None).",
        "ifc.key.missing": "Tabellen mangler nøglekolonnen \"%s\".",
        "ids.invalid": "IDS-filen kunne ikke læses: %s",
        "ids.missing": "IDS-filen blev ikke fundet: %s",
    },
    "nb": {
        "list.empty": "Ingen datasett er tilgjengelige i Python-sesjonen ennå. Importer under Hent.",
        "find.none": "Det finnes ingen datasett i Python-sesjonen. Kjør dm_list() for å se hva som finnes.",
        "find.many": "Flere datasett matcher \"%s\": %s",
        "find.missing": "Finner ikke noe datasett som heter \"%s\". Kjør dm_list() for å se hva som finnes.",
        "read.notmirrored": "Datasettet \"%s\" er ikke speilet til Python ennå. Prøv igjen om et øyeblikk.",
        "write.df": "dm_write() krever en pandas DataFrame.",
        "write.nocols": "Datasettet har ingen kolonner.",
        "write.sent": "Datasettet \"%s\" sendes til appen (%d rader, %d kolonner).",
        "write.log": "Opprettet med dm_write() i Python",
        "write.default": "Fra Python",
        "plot.gone": "Diagrammet finnes ikke lenger i Python-sesjonen.",
        "labels.named": "Verdietikettene må være en dict fra kode til etikett, for eksempel {1: \"Mann\", 2: \"Kvinne\"}.",
        "labels.column": "Kolonnen \"%s\" finnes ikke i tabellen.",
        "step.nofunction": "Koden må definere en funksjon step(df).",
        "step.notframe": "step(df) må returnere en pandas DataFrame.",
        "plot.plotly": "Et plotly-diagram eksporteres av appen, ikke av Python.",
        "ifc.notmodel": "Datasettet er ingen IFC-modell (mangler originalfil).",
        "ifc.nofile": "Modellens originalfil mangler i datasettet.",
        "ifc.needs": "Hjelperen trenger en modell fra dm_ifc().",
        "ifc.written": "Modellen \"%s\" sendes til appen som nytt datasett.",
        "ifc.changed": "endret",
        "ifc.default": "Modell",
        "ifc.step.nofunction": "Koden må definere en funksjon step(model).",
        "ifc.step.notmodel": "step(model) må returnere modellen (eller None).",
        "ifc.key.missing": "Tabellen mangler nøkkelkolonnen \"%s\".",
        "ids.invalid": "IDS-filen kunne ikke leses: %s",
        "ids.missing": "IDS-filen ble ikke funnet: %s",
    },
    "nn": {
        "list.empty": "Ingen datasett er tilgjengelege i Python-sesjonen enno. Importer under Hent.",
        "find.none": "Det finst ingen datasett i Python-sesjonen. Køyr dm_list() for å sjå kva som finst.",
        "find.many": "Fleire datasett samsvarar med \"%s\": %s",
        "find.missing": "Finn ikkje noko datasett som heiter \"%s\". Køyr dm_list() for å sjå kva som finst.",
        "read.notmirrored": "Datasettet \"%s\" er ikkje spegla til Python enno. Prøv igjen om ei stund.",
        "write.df": "dm_write() krev ein pandas DataFrame.",
        "write.nocols": "Datasettet har ingen kolonnar.",
        "write.sent": "Datasettet \"%s\" blir sendt til appen (%d rader, %d kolonnar).",
        "write.log": "Oppretta med dm_write() i Python",
        "write.default": "Frå Python",
        "plot.gone": "Diagrammet finst ikkje lenger i Python-sesjonen.",
        "labels.named": "Verdietikettane må vere ein dict frå kode til etikett, til dømes {1: \"Mann\", 2: \"Kvinne\"}.",
        "labels.column": "Kolonnen \"%s\" finst ikkje i tabellen.",
        "step.nofunction": "Koden må definere ein funksjon step(df).",
        "step.notframe": "step(df) må returnere ein pandas DataFrame.",
        "plot.plotly": "Eit plotly-diagram blir eksportert av appen, ikkje av Python.",
        "ifc.notmodel": "Datasettet er ingen IFC-modell (manglar originalfil).",
        "ifc.nofile": "Originalfila til modellen manglar i datasettet.",
        "ifc.needs": "Hjelparen treng ein modell frå dm_ifc().",
        "ifc.written": "Modellen \"%s\" blir send til appen som nytt datasett.",
        "ifc.changed": "endra",
        "ifc.default": "Modell",
        "ifc.step.nofunction": "Koden må definere ein funksjon step(model).",
        "ifc.step.notmodel": "step(model) må returnere modellen (eller None).",
        "ifc.key.missing": "Tabellen manglar nøkkelkolonnen \"%s\".",
        "ids.invalid": "IDS-fila kunne ikkje lesast: %s",
        "ids.missing": "IDS-fila vart ikkje funnen: %s",
    },
    "fi": {
        "list.empty": "Python-istunnossa ei ole vielä aineistoja. Tuo aineisto Nouda-tilassa.",
        "find.none": "Python-istunnossa ei ole aineistoja. Aja dm_list() nähdäksesi, mitä on saatavilla.",
        "find.many": "Useat aineistot vastaavat hakua \"%s\": %s",
        "find.missing": "Aineistoa nimeltä \"%s\" ei löydy. Aja dm_list() nähdäksesi, mitä on saatavilla.",
        "read.notmirrored": "Aineistoa \"%s\" ei ole vielä peilattu Pythoniin. Yritä hetken kuluttua uudelleen.",
        "write.df": "dm_write() tarvitsee pandas DataFrame -olion.",
        "write.nocols": "Aineistossa ei ole sarakkeita.",
        "write.sent": "Aineisto \"%s\" lähetetään sovellukseen (%d riviä, %d saraketta).",
        "write.log": "Luotu dm_write()-funktiolla Pythonissa",
        "write.default": "Pythonista",
        "plot.gone": "Kaaviota ei enää ole Python-istunnossa.",
        "labels.named": "Arvoselitteiden on oltava dict koodista selitteeseen, esimerkiksi {1: \"Mies\", 2: \"Nainen\"}.",
        "labels.column": "Saraketta \"%s\" ei ole taulukossa.",
        "step.nofunction": "Koodin on määriteltävä funktio step(df).",
        "step.notframe": "step(df):n on palautettava pandas DataFrame.",
        "plot.plotly": "Sovellus vie plotly-kaavion, ei Python.",
        "ifc.notmodel": "Tietoaineisto ei ole IFC-malli (alkuperäinen tiedosto puuttuu).",
        "ifc.nofile": "Mallin alkuperäinen tiedosto puuttuu tietoaineistosta.",
        "ifc.needs": "Apufunktio tarvitsee mallin dm_ifc()-kutsusta.",
        "ifc.written": "Malli \"%s\" lähetetään sovellukseen uutena tietoaineistona.",
        "ifc.changed": "muutettu",
        "ifc.default": "Malli",
        "ifc.step.nofunction": "Koodin on määriteltävä funktio step(model).",
        "ifc.step.notmodel": "step(model)-funktion on palautettava malli (tai None).",
        "ifc.key.missing": "Taulukosta puuttuu avainsarake \"%s\".",
        "ids.invalid": "IDS-tiedostoa ei voitu lukea: %s",
        "ids.missing": "IDS-tiedostoa ei löytynyt: %s",
    },
    "is": {
        "list.empty": "Engin gagnasöfn eru tiltæk í Python-setunni enn. Flyttu inn undir Sækja.",
        "find.none": "Engin gagnasöfn eru í Python-setunni. Keyrðu dm_list() til að sjá hvað er til.",
        "find.many": "Fleiri gagnasöfn passa við \"%s\": %s",
        "find.missing": "Finn ekkert gagnasafn sem heitir \"%s\". Keyrðu dm_list() til að sjá hvað er til.",
        "read.notmirrored": "Gagnasafnið \"%s\" hefur ekki verið speglað til Python enn. Reyndu aftur eftir augnablik.",
        "write.df": "dm_write() þarf pandas DataFrame.",
        "write.nocols": "Gagnasafnið hefur enga dálka.",
        "write.sent": "Gagnasafnið \"%s\" er sent til forritsins (%d raðir, %d dálkar).",
        "write.log": "Búið til með dm_write() í Python",
        "write.default": "Frá Python",
        "plot.gone": "Myndritið er ekki lengur til í Python-setunni.",
        "labels.named": "Gildismerkimiðar verða að vera dict frá kóða í merkimiða, til dæmis {1: \"Karl\", 2: \"Kona\"}.",
        "labels.column": "Dálkurinn \"%s\" er ekki í töflunni.",
        "step.nofunction": "Kóðinn verður að skilgreina fall step(df).",
        "step.notframe": "step(df) verður að skila pandas DataFrame.",
        "plot.plotly": "Forritið flytur út plotly-myndrit, ekki Python.",
        "ifc.notmodel": "Gagnasafnið er ekki IFC-líkan (upprunalegu skrána vantar).",
        "ifc.nofile": "Upprunalegu skrá líkansins vantar í gagnasafnið.",
        "ifc.needs": "Hjálparfallið þarf líkan frá dm_ifc().",
        "ifc.written": "Líkanið \"%s\" er sent til forritsins sem nýtt gagnasafn.",
        "ifc.changed": "breytt",
        "ifc.default": "Líkan",
        "ifc.step.nofunction": "Kóðinn þarf að skilgreina fallið step(model).",
        "ifc.step.notmodel": "step(model) þarf að skila líkaninu (eða None).",
        "ifc.key.missing": "Töfluna vantar lykildálkinn \"%s\".",
        "ids.invalid": "Ekki tókst að lesa IDS-skrána: %s",
        "ids.missing": "IDS-skráin fannst ekki: %s",
    },
    "en": {
        "list.empty": "No datasets are available in the Python session yet. Import one in Import.",
        "find.none": "There are no datasets in the Python session. Run dm_list() to see what exists.",
        "find.many": "Several datasets match \"%s\": %s",
        "find.missing": "No dataset called \"%s\" was found. Run dm_list() to see what exists.",
        "read.notmirrored": "The dataset \"%s\" has not been mirrored to Python yet. Try again in a moment.",
        "write.df": "dm_write() needs a pandas DataFrame.",
        "write.nocols": "The dataset has no columns.",
        "write.sent": "The dataset \"%s\" is being sent to the app (%d rows, %d columns).",
        "write.log": "Created with dm_write() in Python",
        "write.default": "From Python",
        "plot.gone": "The plot no longer exists in the Python session.",
        "labels.named": "Value labels must be a dict from code to label, for example {1: \"Man\", 2: \"Woman\"}.",
        "labels.column": "The column \"%s\" is not in the table.",
        "step.nofunction": "The code must define a function step(df).",
        "step.notframe": "step(df) must return a pandas DataFrame.",
        "plot.plotly": "A plotly chart is exported by the app, not by Python.",
        "ifc.notmodel": "The dataset is not an IFC model (no original file).",
        "ifc.nofile": "The model's original file is missing from the dataset.",
        "ifc.needs": "The helper needs a model from dm_ifc().",
        "ifc.written": "The model \"%s\" is sent to the app as a new dataset.",
        "ifc.changed": "changed",
        "ifc.default": "Model",
        "ifc.step.nofunction": "The code must define a function step(model).",
        "ifc.step.notmodel": "step(model) must return the model (or None).",
        "ifc.key.missing": "The table has no key column \"%s\".",
        "ids.invalid": "The IDS file could not be read: %s",
        "ids.missing": "The IDS file was not found: %s",
    },
}


def _msg(key, *args):
    """Message in the session language, formatted with % when arguments are given."""
    table = MESSAGES.get(_state["lang"]) or MESSAGES["sv"]
    text = table.get(key) or MESSAGES["sv"].get(key) or key
    return text % args if args else text


# ---- index of datasets mirrored by the app ---------------------------------------------------

def dm_index():
    """The datasets the app has mirrored, as a list of dicts (id, name, shortName, folder, file, rowCount, ...)."""
    path = os.path.join(DATA_DIR, "index.tsv")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh, delimiter="\t", quoting=csv.QUOTE_NONE))
    for r in rows:
        r.setdefault("shortName", "")
        r.setdefault("folder", "")
        for k in ("rowCount", "columnCount"):
            try:
                r[k] = int(r.get(k) or 0)
            except ValueError:
                r[k] = 0
    return rows


def dm_list():
    """List the datasets available to Python (same column names in every language, as in R)."""
    import pandas as pd
    idx = dm_index()
    columns = ["namn", "kortnamn", "mapp", "rader", "kolumner", "ändrad", "id"]
    if not idx:
        print(_msg("list.empty"))
        return pd.DataFrame(columns=columns)
    return pd.DataFrame([[r["name"], r["shortName"], r["folder"], r["rowCount"], r["columnCount"], r.get("updatedAt", ""), r["id"]] for r in idx], columns=columns)


def dm_find(x):
    """Resolve a dataset reference (id, short name, exact name, case-insensitive name or unique prefix) to an id."""
    idx = dm_index()
    if not idx:
        raise DataspatiumError(_msg("find.none"))
    x = str(x)
    low = x.lower()

    def qualified(r):
        return (r["folder"] + "/" + r["name"]) if r["folder"] else r["name"]

    def qshort(r):
        return (r["folder"] + "/" + r["shortName"]) if r["folder"] else r["shortName"]

    for pick in (lambda r: r["id"] == x, lambda r: r["name"] == x, lambda r: r["shortName"] == low,
                 lambda r: r["name"].lower() == low, lambda r: qualified(r).lower() == low,
                 lambda r: qshort(r).lower() == low, lambda r: r["name"].lower().startswith(low)):
        hits = [r for r in idx if pick(r)]
        if len(hits) == 1:
            return hits[0]["id"]
        if len(hits) > 1:
            raise DataspatiumError(_msg("find.many", x, ", ".join(r["name"] for r in hits)))
    raise DataspatiumError(_msg("find.missing", x))


def _quote(name):
    return '"' + str(name).replace('"', '""') + '"'


def _is_na(v):
    if v is None:
        return True
    try:
        if v is getattr(sys.modules.get("pandas"), "NA", object()) or v is getattr(sys.modules.get("pandas"), "NaT", object()):
            return True
    except Exception:
        pass
    return isinstance(v, float) and math.isnan(v)


def dm_read(x, columns=None, where=None, n=None):
    """Read a dataset into a pandas DataFrame, restoring Dataspatium's column types.

    x: name, short name or id. columns: optional list of columns. where: optional SQL condition, e.g. "lan = 'Skåne län'".
    n: maximum number of rows. Column labels, descriptions, units and value labels are kept in df.attrs["dataspatium"].
    """
    did = dm_find(x)
    file = os.path.join(DATA_DIR, did + ".sqlite")
    if not os.path.exists(file):
        raise DataspatiumError(_msg("read.notmirrored", x))
    return _read_file(file, columns=columns, where=where, n=n, did=did)


def _read_file(file, columns=None, where=None, n=None, did=None):
    """A Dataspatium SQLite file as a DataFrame (dm_read() and the code steps in recipes)."""
    import pandas as pd
    con = sqlite3.connect(file)
    con.row_factory = sqlite3.Row
    try:
        cols = [dict(r) for r in con.execute("select * from _columns order by position")]
        select = "*" if columns is None else ", ".join(_quote(c) for c in columns)
        sql = "select %s from data" % select
        if where:
            sql += " where " + str(where)
        if n is not None:
            sql += " limit %d" % int(n)
        df = pd.read_sql_query(sql, con)
        meta = {r["key"]: r["value"] for r in con.execute("select key, value from _meta")}
    finally:
        con.close()
    types, labels, descriptions, units, value_labels = {}, {}, {}, {}, {}
    for c in cols:
        name = c["name"]
        if name not in df.columns:
            continue
        t = c.get("type") or "text"
        types[name] = t
        s = df[name]
        if t == "date":
            df[name] = pd.to_datetime(s, errors="coerce", format="ISO8601")
        elif t == "datetime":
            df[name] = pd.to_datetime(s, errors="coerce", format="ISO8601")
        elif t == "boolean":
            df[name] = s.map({0: False, 1: True, "0": False, "1": True, True: True, False: False, "true": True, "false": False}).astype("boolean")
        elif t == "integer":
            num = pd.to_numeric(s, errors="coerce")
            df[name] = num.astype("Int64") if num.isna().any() else num.astype("int64")
        elif t == "number":
            df[name] = pd.to_numeric(s, errors="coerce")
        if c.get("label") and c["label"] != name:
            labels[name] = c["label"]
        if c.get("description"):
            descriptions[name] = c["description"]
        if c.get("unit"):
            units[name] = c["unit"]
        if c.get("value_labels"):
            try:
                value_labels[name] = json.loads(c["value_labels"])
            except ValueError:
                pass
    df.attrs["dataspatium"] = {"id": did or meta.get("id"), "name": meta.get("name"), "types": types, "labels": labels,
                               "descriptions": descriptions, "units": units, "value_labels": value_labels}
    return df


# ---- value labels ------------------------------------------------------------------------------

def _norm(v):
    """Codes compare as text; 1 and 1.0 are the same code."""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def dm_value_labels(df, column, labels=None, to=None):
    """Value labels for one column, as a dict from code to label ({1: "Man", 2: "Kvinna"}).

    to="labels" replaces the codes with their labels, to="codes" turns labels back into codes, None only records
    the labels (dm_write() keeps them) and labels=None removes them. The DataFrame is changed in place and returned.
    """
    import pandas as pd
    if not isinstance(df, pd.DataFrame) or column not in df.columns:
        raise DataspatiumError(_msg("labels.column", column))
    meta = df.attrs.setdefault("dataspatium", {})
    store = meta.setdefault("value_labels", {})
    if not labels:
        store.pop(column, None)
        return df
    if not isinstance(labels, dict):
        raise DataspatiumError(_msg("labels.named"))
    old = store.get(column) or {}
    s = df[column]
    if to == "labels":
        by_code = {_norm(k): v for k, v in labels.items()}
        df[column] = s.map(lambda v: v if _is_na(v) else by_code.get(_norm(v), v))
        mode = "labels"
    elif to == "codes":
        by_label = {str(v): k for k, v in labels.items()}
        values = s.map(lambda v: v if _is_na(v) else by_label.get(str(v), v))
        if all(isinstance(k, (int, float)) and not isinstance(k, bool) for k in labels):
            try:
                values = pd.to_numeric(values)
            except (ValueError, TypeError):
                pass
        df[column] = values
        mode = "codes"
    else:
        mode = "labels" if old.get("values") == "labels" else "codes"
    store[column] = {"values": mode, "labels": [[k, str(v)] for k, v in labels.items()]}
    return df


# ---- writing -----------------------------------------------------------------------------------

def _type_of(s, previous=None):
    """Dataspatium column type for a pandas Series."""
    import pandas as pd
    from pandas.api import types as pt
    dt = s.dtype
    if pt.is_bool_dtype(dt):
        return "boolean"
    if pt.is_datetime64_any_dtype(dt):
        if previous == "datetime":
            return "datetime"
        nn = s.dropna()
        if len(nn) == 0:
            return previous or "date"
        return "date" if bool((nn.dt.normalize() == nn).all()) else "datetime"
    if pt.is_integer_dtype(dt):
        return "integer"
    if pt.is_float_dtype(dt):
        nn = s.dropna()
        if previous == "integer" and len(nn) and bool((nn == nn.round()).all()):
            return "integer"
        return "number"
    if pt.is_numeric_dtype(dt):
        return "number"
    values = [v for v in s.tolist() if not _is_na(v)]
    if values and all(isinstance(v, bool) for v in values):
        return "boolean"
    if values and all(isinstance(v, int) and not isinstance(v, bool) for v in values):
        return "integer"
    if values and all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
        return "number"
    if values and all(isinstance(v, _dt.datetime) for v in values):
        return "date" if all(v.hour == v.minute == v.second == 0 for v in values) else "datetime"
    if values and all(isinstance(v, _dt.date) for v in values):
        return "date"
    return "text"


def _cell(v, t):
    """One value as SQLite stores it for the type."""
    if _is_na(v):
        return None
    if t == "boolean":
        return 1 if bool(v) else 0
    if t == "integer":
        return int(v)
    if t == "number":
        return float(v)
    if t == "date":
        return v.strftime("%Y-%m-%d") if hasattr(v, "strftime") else str(v)[:10]
    if t == "datetime":
        if hasattr(v, "tzinfo") and v.tzinfo is not None:
            v = v.astimezone(_dt.timezone.utc).replace(tzinfo=None)
        return v.strftime("%Y-%m-%d %H:%M:%S") if hasattr(v, "strftime") else str(v)[:19]
    return str(v)


def _caller_name(df):
    """The variable name the caller used for the frame, as R's deparse(substitute(df)) would give."""
    try:
        frame = inspect.currentframe().f_back.f_back
        for scope in (frame.f_locals, frame.f_globals):
            for k, v in scope.items():
                if v is df and not k.startswith("_"):
                    return k
    except Exception:
        pass
    return None


def dm_write(df, name=None, description="", labels=None, descriptions=None, units=None, value_labels=None):
    """Hand a DataFrame to the app as a new dataset. The app picks up the file after the command ends.

    labels, descriptions, units: dicts column -> text (defaults come from df.attrs["dataspatium"] set by dm_read()).
    value_labels: dict column -> {code: label}. Returns the new dataset id.
    """
    import pandas as pd
    if not isinstance(df, pd.DataFrame):
        raise DataspatiumError(_msg("write.df"))
    if name is None:
        name = _caller_name(df) or _msg("write.default")
    os.makedirs(OUT_DIR, exist_ok=True)
    did = "ds_py%s%d" % (_dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%d%H%M%S"), random.randint(1000, 9999))
    file = os.path.join(OUT_DIR, did + ".sqlite")
    rows, cols = _write_file(df, file, did, name, description=description, labels=labels, descriptions=descriptions,
                             units=units, value_labels=value_labels, source={"kind": "python", "expression": str(name)})
    print("[dataspatium:write] %s" % file)
    print(_msg("write.sent", name, rows, cols), file=sys.stderr)
    return did


def _write_file(df, file, did, name, description="", labels=None, descriptions=None, units=None, value_labels=None, source=None):
    """Write a DataFrame as a Dataspatium SQLite file (dm_write() and the code steps). Returns (rows, columns)."""
    import pandas as pd
    if df.shape[1] == 0:
        raise DataspatiumError(_msg("write.nocols"))
    meta = df.attrs.get("dataspatium") or {}
    labels = dict(meta.get("labels") or {}, **(labels or {}))
    descriptions = dict(meta.get("descriptions") or {}, **(descriptions or {}))
    units = dict(meta.get("units") or {}, **(units or {}))
    stored_labels = dict(meta.get("value_labels") or {})
    for col, mapping in (value_labels or {}).items():
        if isinstance(mapping, dict):
            stored_labels[col] = {"values": "codes", "labels": [[k, str(v)] for k, v in mapping.items()]}
    names = [str(c) for c in df.columns]
    types = {}
    columns = []
    for c, n in zip(df.columns, names):
        s = df[c]
        if isinstance(s.dtype, pd.CategoricalDtype):
            s = s.astype(object)
        t = _type_of(s, (meta.get("types") or {}).get(n))
        types[n] = t
        columns.append([_cell(v, t) for v in s.tolist()])
    rows = list(zip(*columns)) if columns else []
    if os.path.exists(file):
        os.remove(file)
    sql_types = {"text": "TEXT", "integer": "INTEGER", "number": "REAL", "date": "TEXT", "datetime": "TEXT", "boolean": "INTEGER"}
    now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    con = sqlite3.connect(file)
    try:
        con.execute("create table data (%s)" % ", ".join("%s %s" % (_quote(n), sql_types[types[n]]) for n in names))
        if rows:
            con.executemany("insert into data values (%s)" % ", ".join("?" for _ in names), rows)
        con.execute("create table _columns (position integer, name text, type text, label text, format text, source_name text, description text, unit text, value_labels text)")
        con.executemany("insert into _columns values (?,?,?,?,?,?,?,?,?)", [
            (i, n, types[n], labels.get(n) or n, None, n, descriptions.get(n), units.get(n),
             json.dumps(stored_labels[n], ensure_ascii=False) if stored_labels.get(n) else None)
            for i, n in enumerate(names)])
        con.execute("create table _meta (key text primary key, value text)")
        con.executemany("insert into _meta values (?, ?)", [
            ("id", did), ("name", str(name)), ("description", str(description or "")), ("createdAt", now), ("updatedAt", now),
            ("rowCount", str(len(rows))), ("columnCount", str(len(names))),
            ("source", json.dumps(source or {"kind": "python"}, ensure_ascii=False))])
        con.execute("create table _log (ts text, action text, details text)")
        con.execute("insert into _log values (?, ?, ?)", (now, "python", json.dumps({"message": _msg("write.log")}, ensure_ascii=False)))
        con.commit()
    finally:
        con.close()
    return len(rows), len(names)


def _run_step(code, in_file, out_file, limit=None, name=""):
    """A code step in a recipe: the code defines step(df); the result replaces the dataset's table.

    Called by the app with the dataset as a SQLite file. With `limit`, only the first rows are used (preview).
    """
    import pandas as pd
    import numpy as np
    df = _read_file(in_file)
    if limit:
        df = df.head(int(limit))
    ns = {"__name__": "__dataspatium_step__", "pd": pd, "np": np, "dm_palette": dm_palette}
    exec(compile(str(code), "<steg>", "exec"), ns)
    fn = ns.get("step")
    if not callable(fn):
        raise DataspatiumError(_msg("step.nofunction"))
    out = fn(df)
    if out is None:
        out = df
    if not isinstance(out, pd.DataFrame):
        raise DataspatiumError(_msg("step.notframe"))
    if "dataspatium" not in out.attrs and "dataspatium" in df.attrs:
        out.attrs["dataspatium"] = df.attrs["dataspatium"]
    rows, cols = _write_file(out.reset_index(drop=True) if not isinstance(out.index, pd.RangeIndex) else out, out_file, "step",
                             name or (df.attrs.get("dataspatium") or {}).get("name") or "step", source={"kind": "python_step"})
    return json.dumps({"rows": rows, "columns": [str(c) for c in out.columns]})


# ---- plots -------------------------------------------------------------------------------------

def dm_palette(n=None):
    """Colour palette shared with the app (Okabe-Ito)."""
    if n is None:
        return list(PALETTE)
    return [PALETTE[i % len(PALETTE)] for i in range(int(n))]


def theme_dataspatium():
    """matplotlib style matching the app's look (applied automatically when matplotlib is first used)."""
    import matplotlib as mpl
    from cycler import cycler
    mpl.rcParams.update({
        "axes.prop_cycle": cycler(color=PALETTE),
        "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
        "axes.grid": True, "grid.color": "#e1e4e9", "axes.axisbelow": True,
        "axes.spines.top": False, "axes.spines.right": False, "axes.spines.left": False, "axes.spines.bottom": False,
        "axes.edgecolor": "#e1e4e9", "axes.titleweight": "bold", "axes.titlelocation": "left",
        "axes.labelcolor": "#545c69", "xtick.color": "#545c69", "ytick.color": "#545c69",
        "legend.frameon": False, "figure.figsize": (7, 5), "figure.dpi": 96, "savefig.dpi": 150, "font.size": 11,
    })


def _matplotlib_setup():
    """Called by the app before code that uses matplotlib runs for the first time: Agg backend and the theme."""
    import matplotlib
    matplotlib.use("Agg")
    theme_dataspatium()
    _state["mpl_setup"] = True
    return "ok"


def _plotly_setup():
    """Called by the app before code that uses plotly runs for the first time: fig.show() hands the figure to the app
    (rendered with plotly.js and the app's theme) instead of trying to open a browser renderer."""
    import plotly.basedatatypes as _pb
    import plotly.io as pio

    def _show(self, *args, **kwargs):
        _state.setdefault("plotly", []).append(json.loads(self.to_json()))
    _pb.BaseFigure.show = _show
    pio.templates.default = "none"
    _state["plotly_setup"] = True
    return "ok"


def _format_result(value):
    """The console's representation of a command's last value: figures go to the plot area, the rest is repr()."""
    if value is None:
        return None
    try:
        import plotly.basedatatypes as _pb
        if isinstance(value, _pb.BaseFigure):
            _state.setdefault("plotly", []).append(json.loads(value.to_json()))
            return None
    except ImportError:
        pass
    try:
        import matplotlib.figure as _mf
        if isinstance(value, _mf.Figure):
            return None
    except ImportError:
        pass
    return repr(value)


def _plot_collect():
    """Called by the app after each run: every open matplotlib figure becomes SVG and PNG and every shown plotly
    figure its JSON; figures are kept for export."""
    out = []
    if "matplotlib" in sys.modules:
        import matplotlib.pyplot as plt
        for num in list(plt.get_fignums()):
            fig = plt.figure(num)
            _state["plot_seq"] += 1
            key = _state["plot_seq"]
            w, h = fig.get_size_inches()
            svg = io.StringIO()
            fig.savefig(svg, format="svg")
            png = io.BytesIO()
            fig.savefig(png, format="png", dpi=96)
            _state["figures"][key] = fig
            out.append({"key": key, "width": int(round(w * 96)), "height": int(round(h * 96)),
                        "svg": svg.getvalue(), "png": base64.b64encode(png.getvalue()).decode("ascii")})
            plt.close(fig)
    for fig_json in _state.get("plotly") or []:
        _state["plot_seq"] += 1
        key = _state["plot_seq"]
        _state["figures"][key] = {"plotly": fig_json}
        layout = fig_json.get("layout") or {}
        out.append({"key": key, "plotly": fig_json, "width": int(layout.get("width") or 672), "height": int(layout.get("height") or 480)})
    _state["plotly"] = []
    while len(_state["figures"]) > 30:
        del _state["figures"][min(_state["figures"])]
    return json.dumps(out)


def _plot_export(key, fmt, path, width=7, height=5, dpi=150):
    """Export a kept matplotlib figure to SVG, PNG or PDF at the given size in inches."""
    fig = _state["figures"].get(int(key))
    if fig is None:
        raise DataspatiumError(_msg("plot.gone"))
    if isinstance(fig, dict):
        raise DataspatiumError(_msg("plot.plotly"))
    old = fig.get_size_inches()
    fig.set_size_inches(float(width), float(height))
    try:
        fig.savefig(path, format=fmt, dpi=int(dpi))
    finally:
        fig.set_size_inches(*old)
    return json.dumps(path)


# ---- session setup -----------------------------------------------------------------------------

def dm_setup(lang="sv"):
    """Called once by the app after Python has started. lang: sv, da, nb, fi, is or en."""
    if isinstance(lang, str) and lang in MESSAGES:
        _state["lang"] = lang
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    # Importing pandas takes a moment in WebAssembly; do it now, while the user is still typing.
    import pandas  # noqa: F401
    return True


def _expand_json(df, column):
    """Expand a column of JSON objects into columns (graph node and edge properties)."""
    import json as _json
    if column not in df.columns:
        return df
    parsed = []
    for s in df[column]:
        try:
            parsed.append(_json.loads(s) if isinstance(s, str) and s else {})
        except ValueError:
            parsed.append({})
    keys = []
    for p in parsed:
        for k in p:
            if k not in keys and k not in df.columns:
                keys.append(k)
    for k in keys:
        df[k] = [p.get(k) if not isinstance(p.get(k), (list, dict)) else _json.dumps(p.get(k), ensure_ascii=False) for p in parsed]
    return df.drop(columns=[column])


def dm_read_edges(x):
    """Edges of a graph dataset (kind "graph") as a DataFrame: id, kalla (source), mal (target), typ and the properties as columns."""
    import pandas as pd
    did = dm_find(x)
    file = os.path.join(DATA_DIR, did + ".sqlite")
    if not os.path.exists(file):
        raise DataspatiumError(_msg("read.notmirrored", x))
    con = sqlite3.connect(file)
    try:
        names = [r[0] for r in con.execute("select name from sqlite_master where type = 'table'")]
        if "_edges" not in names:
            raise DataspatiumError("not a graph dataset")
        df = pd.read_sql_query("select id, kalla, mal, typ, egenskaper from _edges", con)
    finally:
        con.close()
    return _expand_json(df, "egenskaper")


def _read_model_table(x, table):
    import pandas as pd
    did = dm_find(x)
    file = os.path.join(DATA_DIR, did + ".sqlite")
    if not os.path.exists(file):
        raise DataspatiumError(_msg("read.notmirrored", x))
    con = sqlite3.connect(file)
    try:
        names = [r[0] for r in con.execute("select name from sqlite_master where type = 'table'")]
        if table not in names:
            raise DataspatiumError("not an IFC model")
        return pd.read_sql_query("select * from " + table, con)
    finally:
        con.close()


def dm_read_properties(x):
    """Properties of a building model (dataset kind "model") as a DataFrame: id, uppsattning, namn, varde, tal, enhet, kalla."""
    return _read_model_table(x, "_properties")


def dm_read_quantities(x):
    """Quantities of a building model in SI units as a DataFrame: id, uppsattning, namn, varde, slag, enhet."""
    return _read_model_table(x, "_quantities")


def dm_read_nodes(x):
    """Nodes of a graph dataset with their properties as columns (id, etikett, namn, ...)."""
    return _expand_json(dm_read(x), "egenskaper")


# ---- building models with IfcOpenShell (dataset kind "model", 2.4.0) ------------------------------
#
# IfcOpenShell (LGPL-3.0) comes as pinned WebAssembly wheels fetched by the app on the first `import ifcopenshell`
# or dm_ifc() (see src/engines/python/catalog.js). The original IFC file travels inside the mirrored dataset
# (table _files, kind original), so a model opens straight from the mirror.

IFC_DIR = "/data/ifc"
_ifc_info = {}  # id(model) -> {"id": dataset id, "name": dataset name, "file": original file name, "path": copy in IFC_DIR}
_IFC_ATTRIBUTES = {"namn": "Name", "name": "Name", "beskrivning": "Description", "description": "Description",
                   "objekttyp": "ObjectType", "objecttype": "ObjectType", "tagg": "Tag", "tag": "Tag"}


def _ifc_original_from(file):
    """The original IFC file kept in a Dataspatium SQLite file (table _files, kind original): (name, bytes)."""
    con = sqlite3.connect(file)
    try:
        names = [r[0] for r in con.execute("select name from sqlite_master where type = 'table'")]
        if "_files" not in names:
            raise DataspatiumError(_msg("ifc.notmodel"))
        row = con.execute("select name, bytes from _files where kind = 'original' order by name limit 1").fetchone()
    finally:
        con.close()
    if not row or not row[1]:
        raise DataspatiumError(_msg("ifc.nofile"))
    return str(row[0]), bytes(row[1])


def _ifc_open_bytes(path, data):
    import ifcopenshell
    with open(path, "wb") as fh:
        fh.write(data)
    return ifcopenshell.open(path)


def dm_ifc(x):
    """Open a building model (dataset kind "model", an IFC file) with IfcOpenShell.

    Returns an ifcopenshell.file; keep it in a variable and use the IfcOpenShell API (by_type, by_guid, the api module)
    or the helpers dm_ifc_elements(), dm_ifc_psets(), dm_ifc_tree(), dm_ifc_validate(), dm_ifc_select(), dm_ifc_set(),
    dm_ifc_geometry() and dm_ifc_write(). The dataset itself is never changed by this; dm_ifc_write() hands a copy to the app.
    """
    did = dm_find(x)
    file = os.path.join(DATA_DIR, did + ".sqlite")
    if not os.path.exists(file):
        raise DataspatiumError(_msg("read.notmirrored", x))
    info = next((r for r in dm_index() if r["id"] == did), {})
    name, data = _ifc_original_from(file)
    os.makedirs(IFC_DIR, exist_ok=True)
    stamp = "".join(ch for ch in str(info.get("updatedAt", "")) if ch.isalnum()) or "0"
    path = os.path.join(IFC_DIR, "%s-%s.ifc" % (did, stamp))
    if not os.path.exists(path) or os.path.getsize(path) != len(data):
        for old in os.listdir(IFC_DIR):
            if old.startswith(did + "-"):
                os.remove(os.path.join(IFC_DIR, old))
        model = _ifc_open_bytes(path, data)
    else:
        import ifcopenshell
        model = ifcopenshell.open(path)
    _ifc_info[id(model)] = {"id": did, "name": info.get("name") or str(x), "file": name, "path": path}
    return model


def _ifc_of(model):
    import ifcopenshell
    if not isinstance(model, ifcopenshell.file):
        raise DataspatiumError(_msg("ifc.needs"))
    return model


def dm_ifc_write(model, name=None, description=""):
    """Hand a model to the app as a new model dataset (the original file is kept, the tables are built from it).

    The dataset the model came from is not changed; use the recipe step "Python på modellen" in Bearbeta for a new version.
    """
    _ifc_of(model)
    info = _ifc_info.get(id(model), {})
    if name is None:
        name = "%s (%s)" % (info.get("name") or _msg("ifc.default"), _msg("ifc.changed"))
    os.makedirs(OUT_DIR, exist_ok=True)
    did = "ds_ifc%s%d" % (_dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%d%H%M%S"), random.randint(1000, 9999))
    path = os.path.join(OUT_DIR, did + ".ifc")
    model.write(path)
    with open(path + ".json", "w", encoding="utf-8") as fh:
        json.dump({"name": str(name), "description": str(description or ""), "file": info.get("file") or (str(name) + ".ifc"),
                   "from": info.get("id") or ""}, fh, ensure_ascii=False)
    print("[dataspatium:write] %s" % path)
    print(_msg("ifc.written", name), file=sys.stderr)
    return did


def _ifc_text(v):
    return None if v is None else str(v)


def _ifc_material_name(mat):
    if mat is None:
        return None
    for attr in ("Name", "LayerSetName", "ForProfileSet", "ForLayerSet"):
        v = getattr(mat, attr, None)
        if isinstance(v, str) and v:
            return v
        if v is not None and not isinstance(v, str):
            return _ifc_material_name(v)
    return mat.is_a()


def _ifc_items(model, ifc_class, elements):
    if elements is not None:
        return list(elements)
    return list(model.by_type(str(ifc_class or "IfcElement")))


def dm_ifc_elements(model, ifc_class="IfcElement", elements=None):
    """Elements straight from the model as a DataFrame with the dataset's column names: guid, typ, namn, beskrivning,
    objekttyp, tagg, vaning (the storey), typnamn, material and id (the file's #id)."""
    import pandas as pd
    import ifcopenshell.util.element as el
    m = _ifc_of(model)
    rows = []
    for e in _ifc_items(m, ifc_class, elements):
        try:
            container = el.get_container(e)
        except Exception:
            container = None
        try:
            typ = el.get_type(e)
        except Exception:
            typ = None
        try:
            material = _ifc_material_name(el.get_material(e, should_skip_usage=True))
        except Exception:
            material = None
        rows.append([e.GlobalId if hasattr(e, "GlobalId") else None, e.is_a(), _ifc_text(getattr(e, "Name", None)),
                     _ifc_text(getattr(e, "Description", None)), _ifc_text(getattr(e, "ObjectType", None)), _ifc_text(getattr(e, "Tag", None)),
                     _ifc_text(getattr(container, "Name", None)) if container is not None else None,
                     _ifc_text(getattr(typ, "Name", None)) if typ is not None else None, material, e.id()])
    return pd.DataFrame(rows, columns=["guid", "typ", "namn", "beskrivning", "objekttyp", "tagg", "vaning", "typnamn", "material", "id"])


def dm_ifc_psets(model, ifc_class="IfcElement", psets=None, qtos=False, elements=None):
    """Property sets as one wide table: guid, typ, namn and one column per "Set.Property" (qtos=True: the quantity sets too).

    psets: optional list of set names to keep. Nested values become JSON text.
    """
    import pandas as pd
    import ifcopenshell.util.element as el
    m = _ifc_of(model)
    wanted = set(psets) if psets else None
    rows = []
    keys = []
    seen = set()
    for e in _ifc_items(m, ifc_class, elements):
        rec = {"guid": getattr(e, "GlobalId", None), "typ": e.is_a(), "namn": _ifc_text(getattr(e, "Name", None))}
        try:
            data = el.get_psets(e, psets_only=not qtos)
        except Exception:
            data = {}
        for set_name, props in data.items():
            if wanted is not None and set_name not in wanted:
                continue
            for k, v in props.items():
                if k == "id":
                    continue
                key = "%s.%s" % (set_name, k)
                if isinstance(v, (list, tuple, dict)):
                    v = json.dumps(v, ensure_ascii=False, default=str)
                rec[key] = v
                if key not in seen:
                    seen.add(key)
                    keys.append(key)
        rows.append(rec)
    return pd.DataFrame(rows, columns=["guid", "typ", "namn"] + keys)


def dm_ifc_tree(model):
    """The spatial structure as a table: niva (depth), guid, typ, namn, foralder (the parent's guid), element (elements contained)."""
    import pandas as pd
    import ifcopenshell.util.element as el
    m = _ifc_of(model)
    rows = []

    def walk(obj, depth, parent):
        try:
            contained = el.get_contained(obj)
        except Exception:
            contained = set()
        rows.append([depth, getattr(obj, "GlobalId", None), obj.is_a(), _ifc_text(getattr(obj, "Name", None)), parent, len(contained)])
        try:
            parts = el.get_parts(obj)
        except Exception:
            parts = []
        for part in sorted(parts, key=lambda p: (str(getattr(p, "Name", "") or ""), p.id())):
            if part.is_a("IfcSpatialElement") or part.is_a("IfcSpatialStructureElement") or part.is_a("IfcProject"):
                walk(part, depth + 1, getattr(obj, "GlobalId", None))

    for project in m.by_type("IfcProject"):
        walk(project, 0, None)
    return pd.DataFrame(rows, columns=["niva", "guid", "typ", "namn", "foralder", "element"])


def dm_ifc_validate(model, express=False):
    """Check the model against its schema; a table of findings: niva (level), typ, id, guid, attribut, meddelande.

    express=True also runs the schema's rules (slower; the app fetches pytest the first time).
    """
    import pandas as pd
    import ifcopenshell.validate
    m = _ifc_of(model)
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(m, logger, express_rules=bool(express))
    rows = []
    for s in logger.statements:
        inst = s.get("instance") if isinstance(s, dict) else None
        rows.append([str(s.get("level", "")) if isinstance(s, dict) else "", inst.is_a() if inst is not None else None,
                     inst.id() if inst is not None else None, getattr(inst, "GlobalId", None) if inst is not None else None,
                     _ifc_text(s.get("attribute")) if isinstance(s, dict) else None, str(s.get("message", s)) if isinstance(s, dict) else str(s)])
    return pd.DataFrame(rows, columns=["niva", "typ", "id", "guid", "attribut", "meddelande"])


def dm_ifc_select(model, query):
    """Elements matched by IfcOpenShell's selector syntax, as dm_ifc_elements() lists them.

    Examples: "IfcWall", "IfcWall, Pset_WallCommon.FireRating=EI60", "IfcElement, material=Betong", "IfcSlab, Name=/Bjälklag.*/".
    """
    import ifcopenshell.util.selector as sel
    m = _ifc_of(model)
    return dm_ifc_elements(m, elements=sel.filter_elements(m, str(query)))


def _ifc_value(v):
    if _is_na(v):
        return None
    if hasattr(v, "item") and not isinstance(v, (str, bytes)):
        try:
            v = v.item()
        except Exception:
            pass
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, int):
        return int(v)
    if isinstance(v, float):
        return float(v)
    return str(v)


def dm_ifc_set(model, df, key="guid"):
    """Write a table's values into the model and return the number of elements changed.

    Rows are matched on `key` (GlobalId). Columns Name, Description, ObjectType, Tag (or namn, beskrivning, objekttyp,
    tagg) set the element's attributes; columns named "Set.Property" set properties (the set is created when missing).
    Empty cells leave the model as it is. Other columns are ignored.
    """
    import pandas as pd
    import ifcopenshell.api.attribute
    import ifcopenshell.api.pset
    import ifcopenshell.util.element as el
    m = _ifc_of(model)
    if not isinstance(df, pd.DataFrame):
        raise DataspatiumError(_msg("write.df"))
    if key not in df.columns:
        raise DataspatiumError(_msg("ifc.key.missing", key))
    changed = 0
    for _, row in df.iterrows():
        guid = row[key]
        if not isinstance(guid, str) or not guid:
            continue
        try:
            e = m.by_guid(guid)
        except Exception:
            continue
        attributes = {}
        sets = {}
        for c in df.columns:
            if c == key:
                continue
            v = _ifc_value(row[c])
            if v is None or v == "":
                continue
            low = str(c).lower()
            if low in _IFC_ATTRIBUTES:
                attributes[_IFC_ATTRIBUTES[low]] = str(v)
            elif "." in str(c):
                set_name, prop = str(c).split(".", 1)
                sets.setdefault(set_name, {})[prop] = v
        if attributes:
            ifcopenshell.api.attribute.edit_attributes(m, product=e, attributes=attributes)
        for set_name, props in sets.items():
            existing = el.get_psets(e, psets_only=True).get(set_name)
            pset = m.by_id(existing["id"]) if existing and existing.get("id") else ifcopenshell.api.pset.add_pset(m, product=e, name=set_name)
            ifcopenshell.api.pset.edit_pset(m, pset=pset, properties=props)
        if attributes or sets:
            changed += 1
    return changed


def dm_ifc_geometry(model, ifc_class="IfcElement", elements=None):
    """Measured on the geometry (OpenCASCADE, metres): guid, typ, namn, volym_m3, yta_m2 (surface), bredd_m, djup_m, hojd_m
    (the bounding box), hornpunkter; elements without a shape get empty measures. Slow for big models."""
    import pandas as pd
    import ifcopenshell.geom
    import ifcopenshell.util.shape as shape_util
    m = _ifc_of(model)
    settings = ifcopenshell.geom.settings()
    rows = []
    for e in _ifc_items(m, ifc_class, elements):
        base = [getattr(e, "GlobalId", None), e.is_a(), _ifc_text(getattr(e, "Name", None))]
        if getattr(e, "Representation", None) is None:
            rows.append(base + [None, None, None, None, None, 0])
            continue
        try:
            geometry = ifcopenshell.geom.create_shape(settings, e).geometry
            verts = shape_util.get_vertices(geometry)
            lo, hi = shape_util.get_bbox(verts)
            rows.append(base + [round(float(shape_util.get_volume(geometry)), 4), round(float(shape_util.get_area(geometry)), 4),
                                round(float(hi[0] - lo[0]), 4), round(float(hi[1] - lo[1]), 4), round(float(hi[2] - lo[2]), 4), int(len(verts))])
        except Exception:
            rows.append(base + [None, None, None, None, None, 0])
    return pd.DataFrame(rows, columns=["guid", "typ", "namn", "volym_m3", "yta_m2", "bredd_m", "djup_m", "hojd_m", "hornpunkter"])


IDS_DIR = "/data/ids"


def _ids_path(source, name=None):
    """The IDS file as a path in Python's file system: a path given, or XML text or bytes written under /data/ids."""
    if isinstance(source, str) and os.path.exists(source):
        return source
    if isinstance(source, str) and "<" not in source:
        raise DataspatiumError(_msg("ids.missing", source))
    os.makedirs(IDS_DIR, exist_ok=True)
    path = os.path.join(IDS_DIR, str(name or "krav") if str(name or "").endswith(".ids") else (str(name or "krav") + ".ids"))
    data = source.encode("utf-8") if isinstance(source, str) else bytes(source)
    with open(path, "wb") as fh:
        fh.write(data)
    return path


def dm_ifc_ids(model, source, name=None):
    """Check the model against an IDS file (buildingSMART Information Delivery Specification) with ifctester.

    source: a path in Python's file system, the IDS as XML text, or bytes. Returns a table with one row per requirement and
    element: specifikation, krav, status (godkänd, underkänd or ej tillämpligt), guid, typ, namn, orsak. The summary of the
    check (specifications, requirements, checks, passed and failed) is in df.attrs["ids"]. ifctester is LGPL-3.0 and travels
    with the app without its web app; see docs/sv/licenser.md.
    """
    import pandas as pd
    import ifctester.ids
    import ifctester.reporter
    m = _ifc_of(model)
    path = _ids_path(source, name)
    try:
        ids = ifctester.ids.open(path)
    except Exception as e:
        raise DataspatiumError(_msg("ids.invalid", str(e)[:200]))
    ids.validate(m)
    res = ifctester.reporter.Json(ids).report()
    rows = []
    for spec in res.get("specifications", []):
        spec_name = spec.get("name") or ""
        requirements = spec.get("requirements") or []
        if not requirements:
            rows.append([spec_name, None, "ej tillämpligt", None, None, None, spec.get("description") or None])
        for req in requirements:
            label = (str(req.get("label") or "") + ": " if req.get("label") else "") + str(req.get("value") or "")
            label = label or str(req.get("facet_type") or "")
            failed = req.get("failed_entities") or []
            passed = req.get("passed_entities") or []
            for e in failed:
                rows.append([spec_name, label, "underkänd", e.get("global_id"), e.get("class"), e.get("name"), e.get("reason")])
            for e in passed:
                rows.append([spec_name, label, "godkänd", e.get("global_id"), e.get("class"), e.get("name"), None])
            if not failed and not passed:
                rows.append([spec_name, label, "ej tillämpligt", None, None, None, req.get("description") or None])
    df = pd.DataFrame(rows, columns=["specifikation", "krav", "status", "guid", "typ", "namn", "orsak"])
    df.attrs["ids"] = {
        "title": res.get("title"), "status": bool(res.get("status")), "specifications": int(res.get("total_specifications") or 0),
        "specifications_pass": int(res.get("total_specifications_pass") or 0), "requirements": int(res.get("total_requirements") or 0),
        "requirements_pass": int(res.get("total_requirements_pass") or 0), "checks": int(res.get("total_checks") or 0),
        "checks_pass": int(res.get("total_checks_pass") or 0), "checks_fail": int(res.get("total_checks_fail") or 0),
    }
    return df


def _frame_json(df, limit=None, extra=None):
    """A DataFrame as the JSON table the app's tools show: columns with Dataspatium types, rows as plain values, and any extra facts."""
    import pandas as pd
    total = int(len(df))
    if limit:
        df = df.head(int(limit))
    columns = []
    types = {}
    for c in df.columns:
        s = df[c]
        if isinstance(s.dtype, pd.CategoricalDtype):
            s = s.astype(object)
        t = _type_of(s)
        types[str(c)] = t
        columns.append({"name": str(c), "type": t})
    rows = [[_cell(v, types[str(c)]) for c, v in zip(df.columns, rec)] for rec in df.itertuples(index=False, name=None)]
    out = {"columns": columns, "rows": rows, "total": total}
    if extra:
        out["summary"] = extra
    return json.dumps(out, ensure_ascii=False, default=str)


def _ifc_tool(x, tool, params_json="{}"):
    """The model tools of Analysera (JSON in, JSON table out): validate, structure, psets, select, elements, geometry."""
    p = json.loads(params_json or "{}")
    model = dm_ifc(x)
    ifc_class = p.get("ifc_class") or "IfcElement"
    if tool == "validate":
        df = dm_ifc_validate(model, express=bool(p.get("express")))
    elif tool == "ids":
        df = dm_ifc_ids(model, p.get("ids") or "")
        return _frame_json(df, limit=p.get("limit"), extra=df.attrs.get("ids"))
    elif tool == "structure":
        df = dm_ifc_tree(model)
    elif tool == "psets":
        df = dm_ifc_psets(model, ifc_class, psets=p.get("psets") or None, qtos=bool(p.get("qtos")))
    elif tool == "select":
        df = dm_ifc_select(model, p.get("query") or "IfcElement")
    elif tool == "elements":
        df = dm_ifc_elements(model, ifc_class)
    elif tool == "geometry":
        df = dm_ifc_geometry(model, ifc_class)
    else:
        raise DataspatiumError("unknown tool: %s" % tool)
    return _frame_json(df, limit=p.get("limit"))


def _ifc_step_namespace(model):
    import pandas as pd
    import ifcopenshell
    import ifcopenshell.util.element
    return {"__name__": "__dataspatium_ifc_step__", "pd": pd, "ifcopenshell": ifcopenshell, "model": model,
            "dm_ifc_elements": dm_ifc_elements, "dm_ifc_psets": dm_ifc_psets, "dm_ifc_tree": dm_ifc_tree, "dm_ifc_validate": dm_ifc_validate,
            "dm_ifc_select": dm_ifc_select, "dm_ifc_set": dm_ifc_set, "dm_ifc_geometry": dm_ifc_geometry, "dm_read": dm_read, "dm_palette": dm_palette}


def _ifc_step(code, in_file, out_file, name=""):
    """The recipe step "Python på modellen": the code defines step(model) and may change the model; the result is written as IFC.

    Called by the app with the dataset as a SQLite file. Returns counts for the log.
    """
    import ifcopenshell
    file_name, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "step-in.ifc"), data)
    ns = _ifc_step_namespace(model)
    exec(compile(str(code), "<steg>", "exec"), ns)
    fn = ns.get("step")
    if not callable(fn):
        raise DataspatiumError(_msg("ifc.step.nofunction"))
    out = fn(model)
    if out is None:
        out = model
    if not isinstance(out, ifcopenshell.file):
        raise DataspatiumError(_msg("ifc.step.notmodel"))
    out.write(out_file)
    return json.dumps({"elements": len(out.by_type("IfcElement")), "entities": len(list(out)), "file": file_name, "name": name})


def _ifc_apply(in_file, table_file, key, out_file):
    """The recipe step "Skriv tabell till modellen": a table's values into the model with dm_ifc_set(), written as IFC."""
    file_name, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "apply-in.ifc"), data)
    df = _read_file(table_file)
    changed = dm_ifc_set(model, df, key=key or "guid")
    model.write(out_file)
    return json.dumps({"changed": changed, "rows": int(len(df)), "file": file_name})


# ---- the change set of "Ändra med AI" ---------------------------------------------------------
# The AI's write tools never touch the model themselves: they fill a change set (a JSON list of operations) that the person
# previews and approves in the app; only then does _ifc_changeset() apply it, as a recipe step with undo. Lengths are metres and
# are scaled to the file's unit. A created element gets a ref ("new-1", "new-2", ...) in the order of the operations
# create_wall, create_slab and create_opening, so that a later operation can name it before the file has given it an id.


def _cs_num(op, key, default=None, positive=False):
    v = op.get(key)
    if v is None:
        if default is None:
            raise DataspatiumError("%s is required" % key)
        v = default
    try:
        v = float(v)
    except (TypeError, ValueError):
        raise DataspatiumError("%s must be a number (metres)" % key)
    if positive and v <= 0:
        raise DataspatiumError("%s must be greater than zero" % key)
    return v


def _cs_xy(value, key):
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise DataspatiumError("%s must be [x, y] in metres" % key)
    try:
        return float(value[0]), float(value[1])
    except (TypeError, ValueError):
        raise DataspatiumError("%s must be [x, y] in metres" % key)


def _cs_label(i):
    """A, B, ..., Z, AA, AB, ... for the grid's axes along X."""
    out = ""
    i += 1
    while i > 0:
        i, r = divmod(i - 1, 26)
        out = chr(65 + r) + out
    return out


class _ChangeSet:
    """Applies a change set to an IfcOpenShell model and reports what it created, changed and deleted."""

    CREATES = ("create_wall", "create_slab", "create_opening")

    def __init__(self, model):
        import ifcopenshell.util.unit
        self.m = model
        try:
            self.scale = float(ifcopenshell.util.unit.calculate_unit_scale(model) or 1.0)  # metres per file unit
        except Exception:
            self.scale = 1.0
        self.refs = {}
        self.created = []
        self.changed = {}
        self.deleted = []
        self.n_created = 0
        owners = model.by_type("IfcOwnerHistory")
        self.owner = owners[0] if owners else None
        self._body = None

    # -- units, lookups and bookkeeping
    def u(self, metres):
        return float(metres) / self.scale

    def entity(self, ref):
        """An element by its STEP id, or by a ref of this change set."""
        if isinstance(ref, str) and ref in self.refs:
            return self.refs[ref]
        try:
            e = self.m.by_id(int(ref))
        except Exception:
            raise DataspatiumError("no element with id %r" % (ref,))
        if e is None:
            raise DataspatiumError("no element with id %r" % (ref,))
        return e

    def elements(self, op):
        ids = op.get("ids")
        if not isinstance(ids, (list, tuple)) or not ids:
            raise DataspatiumError("ids must be a list of element ids or refs")
        return [self.entity(x) for x in ids]

    def storey(self, name):
        storeys = self.m.by_type("IfcBuildingStorey")
        if not storeys:
            raise DataspatiumError("the model has no storey; create one with create_storeys_and_grid first")
        if name is None or str(name).strip() == "":
            return sorted(storeys, key=lambda s: float(s.Elevation or 0))[0]
        for exact in (True, False):
            for s in storeys:
                a, b = str(s.Name or ""), str(name)
                if (a == b) if exact else (a.lower() == b.lower()):
                    return s
        raise DataspatiumError("no storey named %r; the storeys are %s" % (name, ", ".join(str(s.Name) for s in storeys)))

    def container(self, e):
        import ifcopenshell.util.element as el
        try:
            return el.get_container(e)
        except Exception:
            return None

    def record(self, e, storey=None):
        return {"id": e.id(), "guid": getattr(e, "GlobalId", None), "ifc_class": e.is_a(), "name": _ifc_text(getattr(e, "Name", None)),
                "storey": _ifc_text(getattr(storey, "Name", None)) if storey is not None else None}

    def register(self, e, storey=None, ref=True):
        rec = self.record(e, storey)
        if ref:
            self.n_created += 1
            rec["ref"] = "new-%d" % self.n_created
            self.refs[rec["ref"]] = e
        self.created.append(rec)
        return rec

    def touch(self, e):
        if any(c["id"] == e.id() for c in self.created):
            return
        self.changed[e.id()] = self.record(e, self.container(e))

    # -- the file's structure
    def root(self, ifc_class, name):
        import ifcopenshell.guid
        e = self.m.create_entity(ifc_class, GlobalId=ifcopenshell.guid.new(), Name=str(name))
        if self.owner is not None:
            e.OwnerHistory = self.owner
        return e

    def owner_settings(self):
        """IFC2X3 needs an owner history on every IfcRoot, also on the relationships the API makes: lend it the file's."""
        import ifcopenshell.api.owner.settings as settings
        if self.m.schema != "IFC2X3" or self.owner is None:
            return None
        previous = (settings.get_user, settings.get_application)
        owner = self.owner
        settings.get_user = lambda _file: owner.OwningUser
        settings.get_application = lambda _file: owner.OwningApplication
        return previous

    @staticmethod
    def restore_owner_settings(previous):
        if previous is None:
            return
        import ifcopenshell.api.owner.settings as settings
        settings.get_user, settings.get_application = previous

    @staticmethod
    def predefined(e, value):
        try:
            e.PredefinedType = value
        except Exception:
            pass

    def building(self):
        import ifcopenshell.api.aggregate
        buildings = self.m.by_type("IfcBuilding")
        if buildings:
            return buildings[0]
        projects = self.m.by_type("IfcProject")
        if not projects:
            raise DataspatiumError("the model has no IfcProject")
        sites = self.m.by_type("IfcSite")
        if sites:
            site = sites[0]
        else:
            site = self.root("IfcSite", "Site")
            site.CompositionType = "ELEMENT"
            site.ObjectPlacement = self.placement(None, 0, 0, 0)
            ifcopenshell.api.aggregate.assign_object(self.m, products=[site], relating_object=projects[0])
        building = self.root("IfcBuilding", "Building")
        building.CompositionType = "ELEMENT"
        building.ObjectPlacement = self.placement(site.ObjectPlacement, 0, 0, 0)
        ifcopenshell.api.aggregate.assign_object(self.m, products=[building], relating_object=site)
        self.register(building, ref=False)
        return building

    def body(self):
        if self._body is not None:
            return self._body
        subs = [c for c in self.m.by_type("IfcGeometricRepresentationSubContext") if (c.ContextIdentifier or "") == "Body"]
        if subs:
            self._body = subs[0]
            return subs[0]
        import ifcopenshell.api.context
        parents = [c for c in self.m.by_type("IfcGeometricRepresentationContext") if not c.is_a("IfcGeometricRepresentationSubContext") and (c.ContextType or "Model") == "Model"]
        parent = parents[0] if parents else ifcopenshell.api.context.add_context(self.m, context_type="Model")
        self._body = ifcopenshell.api.context.add_context(self.m, context_type="Model", context_identifier="Body", target_view="MODEL_VIEW", parent=parent)
        return self._body

    def contain(self, e, storey):
        import ifcopenshell.api.spatial
        ifcopenshell.api.spatial.assign_container(self.m, products=[e], relating_structure=storey)

    # -- geometry, in file units
    def point(self, x, y, z=None):
        return self.m.createIfcCartesianPoint([float(x), float(y)] if z is None else [float(x), float(y), float(z)])

    def direction(self, x, y, z=None):
        return self.m.createIfcDirection([float(x), float(y)] if z is None else [float(x), float(y), float(z)])

    def axis3(self, x, y, z, dx=1.0, dy=0.0):
        return self.m.createIfcAxis2Placement3D(self.point(x, y, z), self.direction(0, 0, 1), self.direction(dx, dy, 0))

    def placement(self, parent, x, y, z, dx=1.0, dy=0.0):
        return self.m.createIfcLocalPlacement(parent, self.axis3(x, y, z, dx, dy))

    def shape(self, solid):
        rep = self.m.createIfcShapeRepresentation(self.body(), "Body", "SweptSolid", [solid])
        return self.m.createIfcProductDefinitionShape(None, None, [rep])

    def box(self, length, width, height, x0=0.0, y0=0.0, z0=0.0):
        """A rectangle of length (X) by width (Y) with its corner at (x0, y0), extruded height along Z from z0."""
        position = self.m.createIfcAxis2Placement2D(self.point(x0 + length / 2.0, y0 + width / 2.0), None)
        profile = self.m.createIfcRectangleProfileDef("AREA", None, position, float(length), float(width))
        return self.shape(self.m.createIfcExtrudedAreaSolid(profile, self.axis3(0, 0, z0), self.direction(0, 0, 1), float(height)))

    def prism(self, outline, height, z0=0.0):
        """A closed outline of (x, y) points extruded height along Z from z0."""
        pts = [self.point(x, y) for x, y in outline]
        if outline[0] != outline[-1]:
            pts.append(pts[0])
        profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, self.m.createIfcPolyline(pts))
        return self.shape(self.m.createIfcExtrudedAreaSolid(profile, self.axis3(0, 0, z0), self.direction(0, 0, 1), float(height)))

    def wall_thickness(self, wall):
        """The YDim of the wall's rectangle profile, in file units; 0.2 m when the wall has another shape."""
        rep = getattr(wall, "Representation", None)
        for r in (rep.Representations if rep is not None else []):
            for item in (r.Items or []):
                if item.is_a("IfcExtrudedAreaSolid") and item.SweptArea.is_a("IfcRectangleProfileDef"):
                    return float(item.SweptArea.YDim)
        return self.u(0.2)

    def grid_outline(self):
        pts = []
        for g in self.m.by_type("IfcGrid"):
            for axis in list(g.UAxes or []) + list(g.VAxes or []):
                curve = axis.AxisCurve
                for p in (curve.Points if curve.is_a("IfcPolyline") else []):
                    c = list(p.Coordinates)
                    pts.append((c[0] * self.scale, c[1] * self.scale))
        if not pts:
            raise DataspatiumError("give an outline, or create a grid first so that the slab can follow it")
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return [(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)), (min(xs), max(ys))]

    # -- the operations
    def op_create_storeys_and_grid(self, op):
        import ifcopenshell.api.aggregate
        storeys = op.get("storeys") or []
        grid = op.get("grid")
        if not storeys and not grid:
            raise DataspatiumError("give storeys, a grid or both")
        building = self.building()
        made = []
        for s in storeys:
            if not isinstance(s, dict) or not str(s.get("name") or "").strip():
                raise DataspatiumError("every storey needs a name")
            existing = [x for x in self.m.by_type("IfcBuildingStorey") if str(x.Name or "") == str(s["name"])]
            if existing:
                made.append(existing[0])
                continue
            elevation = _cs_num(s, "elevation", 0.0)
            storey = self.root("IfcBuildingStorey", s["name"])
            storey.CompositionType = "ELEMENT"
            storey.Elevation = self.u(elevation)
            storey.ObjectPlacement = self.placement(building.ObjectPlacement, 0, 0, self.u(elevation))
            ifcopenshell.api.aggregate.assign_object(self.m, products=[storey], relating_object=building)
            self.register(storey, ref=False)
            made.append(storey)
        if grid:
            if not isinstance(grid, dict):
                raise DataspatiumError("grid must be an object with x_spacing, x_count, y_spacing and y_count")
            self.make_grid(grid, made[0] if made else self.storey(None))

    def make_grid(self, grid, storey):
        xs = _cs_num(grid, "x_spacing", positive=True)
        ys = _cs_num(grid, "y_spacing", positive=True)
        xn = int(_cs_num(grid, "x_count", 1.0, positive=True))
        yn = int(_cs_num(grid, "y_count", 1.0, positive=True))
        if xn > 100 or yn > 100:
            raise DataspatiumError("at most 100 bays per direction")
        width, depth = xs * xn, ys * yn
        u_axes = [self.m.createIfcGridAxis(_cs_label(i), self.m.createIfcPolyline([self.point(self.u(i * xs), 0), self.point(self.u(i * xs), self.u(depth))]), True) for i in range(xn + 1)]
        v_axes = [self.m.createIfcGridAxis(str(j + 1), self.m.createIfcPolyline([self.point(0, self.u(j * ys)), self.point(self.u(width), self.u(j * ys))]), True) for j in range(yn + 1)]
        g = self.root("IfcGrid", "Grid")
        g.ObjectPlacement = self.placement(storey.ObjectPlacement, 0, 0, 0)
        g.UAxes = u_axes
        g.VAxes = v_axes
        self.contain(g, storey)
        self.register(g, storey, ref=False)

    def op_create_wall(self, op):
        storey = self.storey(op.get("storey"))
        x1, y1 = _cs_xy(op.get("start"), "start")
        x2, y2 = _cs_xy(op.get("end"), "end")
        length = math.hypot(x2 - x1, y2 - y1)
        if length <= 0:
            raise DataspatiumError("start and end are the same point")
        thickness = _cs_num(op, "thickness", 0.2, positive=True)
        height = _cs_num(op, "height", 3.0, positive=True)
        wall = self.root("IfcWall", op.get("name") or "Wall")
        wall.ObjectPlacement = self.placement(storey.ObjectPlacement, self.u(x1), self.u(y1), 0, (x2 - x1) / length, (y2 - y1) / length)
        wall.Representation = self.box(self.u(length), self.u(thickness), self.u(height), 0, -self.u(thickness) / 2.0, 0)
        self.predefined(wall, "STANDARD")
        self.contain(wall, storey)
        self.register(wall, storey)

    def op_create_slab(self, op):
        storey = self.storey(op.get("storey"))
        thickness = _cs_num(op, "thickness", 0.25, positive=True)
        outline = op.get("outline") or self.grid_outline()
        if not isinstance(outline, (list, tuple)) or len(outline) < 3:
            raise DataspatiumError("outline must be at least three [x, y] points")
        pts = [_cs_xy(p, "outline") for p in outline]
        slab = self.root("IfcSlab", op.get("name") or "Slab")
        slab.ObjectPlacement = self.placement(storey.ObjectPlacement, 0, 0, 0)
        slab.Representation = self.prism([(self.u(x), self.u(y)) for x, y in pts], self.u(thickness), -self.u(thickness))
        self.predefined(slab, "FLOOR")
        self.contain(slab, storey)
        self.register(slab, storey)

    def op_create_opening(self, op):
        import ifcopenshell.api.feature
        wall = self.entity(op.get("wall_id"))
        if not wall.is_a("IfcWall"):
            raise DataspatiumError("wall_id must name a wall, not %s" % wall.is_a())
        fill = op.get("fill")
        if fill not in (None, "", "door", "window"):
            raise DataspatiumError("fill must be door, window or null")
        offset = _cs_num(op, "offset", 0.0)
        width = _cs_num(op, "width", 0.9, positive=True)
        height = _cs_num(op, "height", 2.1, positive=True)
        sill = _cs_num(op, "sill", 0.0)
        thickness = self.wall_thickness(wall)
        storey = self.container(wall)
        opening = self.root("IfcOpeningElement", op.get("name") or "Opening")
        opening.ObjectPlacement = self.placement(wall.ObjectPlacement, self.u(offset), 0, self.u(sill))
        margin = self.u(0.02)
        opening.Representation = self.box(self.u(width), thickness + 2 * margin, self.u(height), 0, -thickness / 2.0 - margin, 0)
        self.predefined(opening, "OPENING")
        ifcopenshell.api.feature.add_feature(self.m, feature=opening, element=wall)
        self.touch(wall)
        if not fill:
            self.register(opening, storey)
            return
        self.register(opening, storey, ref=False)
        e = self.root("IfcDoor" if fill == "door" else "IfcWindow", op.get("name") or ("Door" if fill == "door" else "Window"))
        e.ObjectPlacement = self.placement(opening.ObjectPlacement, 0, 0, 0)
        leaf = self.u(0.05)
        e.Representation = self.box(self.u(width), leaf, self.u(height), 0, -leaf / 2.0, 0)
        e.OverallHeight = self.u(height)
        e.OverallWidth = self.u(width)
        self.predefined(e, "DOOR" if fill == "door" else "WINDOW")
        ifcopenshell.api.feature.add_filling(self.m, opening=opening, element=e)
        if storey is not None:
            self.contain(e, storey)
        self.register(e, storey)

    def op_set_properties(self, op):
        import ifcopenshell.api.pset
        import ifcopenshell.util.element as el
        name = op.get("pset")
        props = op.get("properties")
        if not name or not isinstance(props, dict) or not props:
            raise DataspatiumError("pset and properties (an object of name: value) are required")
        values = {str(k): _ifc_value(v) for k, v in props.items()}
        for e in self.elements(op):
            existing = el.get_psets(e, psets_only=True).get(str(name))
            pset = self.m.by_id(existing["id"]) if existing and existing.get("id") else ifcopenshell.api.pset.add_pset(self.m, product=e, name=str(name))
            ifcopenshell.api.pset.edit_pset(self.m, pset=pset, properties=values)
            self.touch(e)

    def op_assign(self, op):
        import ifcopenshell.api.material
        storey = self.storey(op["storey"]) if op.get("storey") else None
        material = op.get("material")
        if storey is None and not material:
            raise DataspatiumError("give a storey, a material or both")
        for e in self.elements(op):
            if storey is not None:
                self.contain(e, storey)
            if material:
                found = [x for x in self.m.by_type("IfcMaterial") if str(x.Name or "") == str(material)]
                mat = found[0] if found else ifcopenshell.api.material.add_material(self.m, name=str(material))
                try:
                    ifcopenshell.api.material.unassign_material(self.m, products=[e])
                except Exception:
                    pass
                ifcopenshell.api.material.assign_material(self.m, products=[e], type="IfcMaterial", material=mat)
            self.touch(e)

    def op_transform_elements(self, op):
        dx, dy, dz = _cs_num(op, "dx", 0.0), _cs_num(op, "dy", 0.0), _cs_num(op, "dz", 0.0)
        for e in self.elements(op):
            pl = getattr(e, "ObjectPlacement", None)
            if pl is None or not pl.is_a("IfcLocalPlacement") or not pl.RelativePlacement.is_a("IfcAxis2Placement3D"):
                raise DataspatiumError("element %d has no local placement to move" % e.id())
            c = list(pl.RelativePlacement.Location.Coordinates) + [0.0, 0.0, 0.0]
            pl.RelativePlacement.Location = self.point(c[0] + self.u(dx), c[1] + self.u(dy), c[2] + self.u(dz))
            self.touch(e)

    def op_delete_elements(self, op):
        import ifcopenshell.api.root
        if op.get("confirm") is not True:
            raise DataspatiumError("deleting needs confirm: true, which the person gives")
        for e in self.elements(op):
            self.deleted.append(self.record(e, self.container(e)))
            self.changed.pop(e.id(), None)
            ifcopenshell.api.root.remove_product(self.m, product=e)

    def apply(self, ops):
        if not isinstance(ops, list):
            raise DataspatiumError("the change set must be a list of operations")
        if self.m.schema == "IFC2X3" and self.owner is None:
            raise DataspatiumError("the IFC2X3 file has no owner history to give new entities")
        previous = self.owner_settings()
        try:
            self.apply_all(ops)
        finally:
            self.restore_owner_settings(previous)
        if self.owner is not None:
            # The API makes some relationships without an owner history; IFC2X3 requires one on every IfcRoot.
            for e in self.m.by_type("IfcRoot"):
                if e.OwnerHistory is None:
                    e.OwnerHistory = self.owner

    def apply_all(self, ops):
        for i, op in enumerate(ops):
            name = op.get("tool") if isinstance(op, dict) else None
            fn = getattr(self, "op_" + str(name), None) if name else None
            if fn is None:
                raise DataspatiumError("step %d: unknown operation %r" % (i + 1, name))
            try:
                fn(op)
            except DataspatiumError as exc:
                raise DataspatiumError("step %d (%s): %s" % (i + 1, name, exc))
            except Exception as exc:
                raise DataspatiumError("step %d (%s): %s: %s" % (i + 1, name, type(exc).__name__, exc))

    def findings(self, limit=50):
        """The schema check of the whole model: (findings, number of errors)."""
        import ifcopenshell.validate
        logger = ifcopenshell.validate.json_logger()
        try:
            ifcopenshell.validate.validate(self.m, logger, express_rules=False)
        except Exception as exc:
            return [{"level": "error", "ifc_class": None, "id": None, "attribute": None, "message": "validation failed: %s" % exc}], 1
        out = []
        errors = 0
        for s in logger.statements:
            if not isinstance(s, dict):
                continue
            level = str(s.get("level", "")).lower()
            inst = s.get("instance")
            if level == "error":
                errors += 1
            if len(out) < limit:
                out.append({"level": level, "ifc_class": inst.is_a() if inst is not None else None, "id": inst.id() if inst is not None else None,
                            "attribute": _ifc_text(s.get("attribute")), "message": str(s.get("message", ""))})
        return out, errors


def _ifc_changeset(in_file, changeset_json, out_file):
    """The recipe step "AI-ändring": a change set's operations on the model, checked against the schema and written as IFC.

    Called by the app with the dataset as a SQLite file (also for the preview, which never touches the dataset). Returns the
    report: what was created (with refs), changed and deleted, the schema findings and counts for the log.
    """
    file_name, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "changeset-in.ifc"), data)
    ops = json.loads(changeset_json or "[]")
    cs = _ChangeSet(model)
    cs.apply(ops)
    findings, errors = cs.findings()
    model.write(out_file)
    return json.dumps({"elements": len(model.by_type("IfcElement")), "entities": len(list(model)), "file": file_name, "operations": len(ops),
                       "created": cs.created, "changed": list(cs.changed.values()), "deleted": cs.deleted, "findings": findings, "errors": errors},
                      ensure_ascii=False, default=str)
