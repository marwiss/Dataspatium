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
# create_wall, create_slab, create_roof and create_opening, so that a later operation can name it before the file has given it an id;
# so does the type of define_type, which create_wall, create_slab and create_roof name as their type.


def _cs_num(op, key, default=None, positive=False, unit="metres"):
    v = op.get(key)
    if v is None:
        if default is None:
            raise DataspatiumError("%s is required (%s)" % (key, unit))
        v = default
    try:
        v = float(v)
    except (TypeError, ValueError):
        raise DataspatiumError("%s must be a number (%s)" % (key, unit))
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


def _cs_angle(degrees):
    """An IfcCompoundPlaneAngleMeasure: degrees, minutes, seconds and millionths of a second, every part carrying the sign."""
    sign = -1 if float(degrees) < 0 else 1
    micro = int(round(abs(float(degrees)) * 3600.0 * 1000000.0))
    d, micro = divmod(micro, 3600 * 1000000)
    m, micro = divmod(micro, 60 * 1000000)
    s, micro = divmod(micro, 1000000)
    return [sign * d, sign * m, sign * s, sign * micro]


def _cs_crs_facts(crs):
    """The datum, projection and zone an EPSG code stands for, for the projected systems the Nordic countries draw in; (None, None,
    None) for a code outside the table. IFC4 requires the datum on IfcProjectedCRS, IFC4X3 does not."""
    code = int(crs[5:])
    if code == 3006:
        return "SWEREF99", "Transverse Mercator", "TM"
    if 3007 <= code <= 3018:
        return "SWEREF99", "Transverse Mercator", ("12 00", "13 30", "15 00", "16 30", "18 00", "14 15", "15 45", "17 15", "18 45", "20 15", "21 45", "23 15")[code - 3007]
    if 25828 <= code <= 25838:
        return "ETRS89", "Transverse Mercator", "UTM %dN" % (code - 25800)
    if code == 3067:
        return "ETRS89", "Transverse Mercator", "TM35FIN"
    if 3873 <= code <= 3885:
        return "ETRS89", "Transverse Mercator", "GK%dFIN" % (code - 3854)
    if 5105 <= code <= 5130:
        return "ETRS89", "Transverse Mercator", "NTM zone %d" % (code - 5100)
    if code == 3057:
        return "ISN93", "Lambert Conformal Conic", "Lambert 1993"
    if code == 8088:
        return "ISN2016", "Lambert Conformal Conic", "Lambert 2016"
    if 32601 <= code <= 32660:
        return "WGS84", "Transverse Mercator", "UTM %dN" % (code - 32600)
    if 32701 <= code <= 32760:
        return "WGS84", "Transverse Mercator", "UTM %dS" % (code - 32700)
    if code == 3857:
        return "WGS84", "Pseudo-Mercator", None
    return None, None, None


# Placements as matrices [X, Y, Z, origin] (the axes as columns, in file units), for reading where the walls stand.
def _cs_unit(v):
    n = math.sqrt(sum(c * c for c in v))
    return [c / n for c in v] if n > 1e-12 else None


def _cs_dot(u, v):
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]


def _cs_turn(m, v):
    """The direction v of the matrix m's coordinates in its parent's."""
    return [m[0][i] * v[0] + m[1][i] * v[1] + m[2][i] * v[2] for i in range(3)]


def _cs_at(m, p):
    """The point p of the matrix m's coordinates in its parent's."""
    return [a + b for a, b in zip(_cs_turn(m, p), m[3])]


def _cs_compose(a, b):
    return [_cs_turn(a, b[0]), _cs_turn(a, b[1]), _cs_turn(a, b[2]), _cs_at(a, b[3])]


def _cs_invert(m):
    """The inverse of a rigid placement: the rotation transposed and the origin turned back."""
    x, y, z, o = m
    return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]], [-_cs_dot(x, o), -_cs_dot(y, o), -_cs_dot(z, o)]]


def _cs_axes(position):
    """An IfcAxis2Placement3D or 2D as a matrix; the identity for none."""
    if position is None:
        return [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, 0.0]]
    origin = ([float(c) for c in position.Location.Coordinates] + [0.0, 0.0])[:3]
    if position.is_a("IfcAxis2Placement2D"):
        z = [0.0, 0.0, 1.0]
        ref = ([float(c) for c in position.RefDirection.DirectionRatios] + [0.0])[:3] if position.RefDirection is not None else [1.0, 0.0, 0.0]
    else:
        z = _cs_unit([float(c) for c in position.Axis.DirectionRatios]) if position.Axis is not None else [0.0, 0.0, 1.0]
        ref = [float(c) for c in position.RefDirection.DirectionRatios] if position.RefDirection is not None else ([0.0, 1.0, 0.0] if abs(z[0]) > 0.9 else [1.0, 0.0, 0.0])
    x = _cs_unit([a - _cs_dot(ref, z) * b for a, b in zip(ref, z)])
    return [x, [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]], z, origin]


def _cs_placement(placement, depth=0):
    """The absolute matrix of an object placement (a chain of IfcLocalPlacement); None for one the app cannot follow."""
    if placement is None:
        return _cs_axes(None)
    if depth > 64 or not placement.is_a("IfcLocalPlacement"):
        return None
    parent = _cs_placement(placement.PlacementRelTo, depth + 1)
    return None if parent is None else _cs_compose(parent, _cs_axes(placement.RelativePlacement))


def _cs_profile_points(profile):
    """The outer corners of a profile in its plane: rectangles and polyline outlines; [] for curves the app does not read."""
    if profile.is_a("IfcRectangleProfileDef"):
        hx, hy = float(profile.XDim) / 2.0, float(profile.YDim) / 2.0
        m = _cs_axes(profile.Position)
        return [_cs_at(m, (x, y, 0.0))[:2] for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
    curve = profile.OuterCurve if profile.is_a("IfcArbitraryClosedProfileDef") else None
    if curve is not None and curve.is_a("IfcPolyline"):
        return [[float(c) for c in p.Coordinates][:2] for p in curve.Points]
    if curve is not None and curve.is_a("IfcIndexedPolyCurve"):
        return [[float(c) for c in p][:2] for p in curve.Points.CoordList]
    return []


def _cs_item_points(item, depth=0):
    """The corners of a body item in its own coordinates: extruded rectangles and polylines, Boolean results by their first operand,
    faceted and tessellated solids; [] for what the app does not read."""
    if item is None or depth > 16:
        return []
    if item.is_a("IfcBooleanResult"):
        return _cs_item_points(item.FirstOperand, depth + 1)
    if item.is_a("IfcExtrudedAreaSolid"):
        d = _cs_unit([float(c) for c in item.ExtrudedDirection.DirectionRatios])
        m = _cs_axes(item.Position)
        return [_cs_at(m, (x + d[0] * k, y + d[1] * k, d[2] * k)) for x, y in _cs_profile_points(item.SweptArea) for k in (0.0, float(item.Depth))]
    if item.is_a("IfcFacetedBrep"):
        return [[float(c) for c in p.Coordinates] for f in item.Outer.CfsFaces for b in f.Bounds if b.Bound.is_a("IfcPolyLoop") for p in b.Bound.Polygon]
    if item.is_a("IfcTessellatedFaceSet"):
        return [[float(c) for c in p] for p in item.Coordinates.CoordList]
    return []


def _cs_rectangle(points):
    """Whether (x, y) points are the four corners of their bounding box (a closing corner may repeat the first)."""
    pts = list(points[:-1]) if len(points) > 4 and tuple(points[0]) == tuple(points[-1]) else list(points)
    if len(pts) != 4:
        return False
    x0, y0, x1, y1 = min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)
    corners = set()
    for x, y in pts:
        cx = 0 if abs(x - x0) < 1e-3 else 1 if abs(x - x1) < 1e-3 else None
        cy = 0 if abs(y - y0) < 1e-3 else 1 if abs(y - y1) < 1e-3 else None
        if cx is None or cy is None:
            return False
        corners.add((cx, cy))
    return len(corners) == 4


def _cs_roof_faces(shape, length, width, overhang, ridge):
    """The faces of a roof over the rectangle [0, length] x [0, width] in metres: (fall, corners), fall the horizontal direction the
    face falls toward and corners its outline in plan, the eaves first and then the upper corners back, with the overhang beyond the
    rectangle on every side. A shed falls toward negative y (ridge x: negative x); a gable's ridge runs along the longer side unless
    ridge says x or y; a hip roof's hips run at 45 degrees in plan, so its ridge lies along the longer side (a point over a square)."""
    a, b, o = float(length), float(width), float(overhang)
    sw, se, ne, nw = (-o, -o), (a + o, -o), (a + o, b + o), (-o, b + o)
    south, north, west, east = (0.0, -1.0), (0.0, 1.0), (-1.0, 0.0), (1.0, 0.0)
    if shape == "flat" or (shape == "shed" and ridge != "x"):
        return [(south, [sw, se, ne, nw])]
    if shape == "shed":
        return [(west, [nw, sw, se, ne])]
    if shape == "gable":
        if ridge == "x" or (ridge != "y" and a >= b):
            return [(south, [sw, se, (a + o, b / 2.0), (-o, b / 2.0)]), (north, [ne, nw, (-o, b / 2.0), (a + o, b / 2.0)])]
        return [(west, [nw, sw, (a / 2.0, -o), (a / 2.0, b + o)]), (east, [se, ne, (a / 2.0, b + o), (a / 2.0, -o)])]
    if a >= b:
        r1, r2 = (b / 2.0, b / 2.0), (a - b / 2.0, b / 2.0)
        faces = [(south, [sw, se, r2, r1]), (north, [ne, nw, r1, r2]), (west, [nw, sw, r1]), (east, [se, ne, r2])]
    else:
        r1, r2 = (a / 2.0, a / 2.0), (a / 2.0, b - a / 2.0)
        faces = [(west, [nw, sw, r1, r2]), (east, [se, ne, r2, r1]), (south, [sw, se, r1]), (north, [ne, nw, r2])]
    return [(fall, [p for i, p in enumerate(c) if i == 0 or abs(p[0] - c[i - 1][0]) + abs(p[1] - c[i - 1][1]) > 1e-6]) for fall, c in faces]


def _cs_type_values(model, ifc_class, kind):
    """The PredefinedTypes define_type gives a type class in the file's schema: the class's enumeration without USERDEFINED, which
    needs an ElementType, and without the values IFC4 and later deprecate (STANDARD and POLYGONAL for walls, rule IFC102); a roof
    type is ROOF."""
    if kind == "roof":
        return ["ROOF"]
    import ifcopenshell
    import ifcopenshell.util.attribute
    schema = ifcopenshell.schema_by_name(getattr(model, "schema_identifier", None) or model.schema)
    attr = next(a for a in schema.declaration_by_name(ifc_class).all_attributes() if a.name() == "PredefinedType")
    deprecated = ("STANDARD", "POLYGONAL") if ifc_class == "IfcWallType" and model.schema != "IFC2X3" else ()
    return [v for v in ifcopenshell.util.attribute.get_enum_items(attr) if v != "USERDEFINED" and v not in deprecated]


_QTO_NAMES = {}


def _cs_qto_names(schema, name):
    """The quantities of IfcOpenShell's template of the quantity set `name` in a schema, by their names in lower case to their
    spelling there; None when the schema has no template of it (IFC2X3)."""
    key = (str(schema), str(name))
    if key not in _QTO_NAMES:
        try:
            import ifcopenshell.util.pset
            template = ifcopenshell.util.pset.get_template(str(schema)).get_by_name(str(name))
        except Exception:
            template = None
        _QTO_NAMES[key] = None if template is None else {str(q.Name).lower(): str(q.Name) for q in (template.HasPropertyTemplates or ())}
    return _QTO_NAMES[key]


class _ChangeSet:
    """Applies a change set to an IfcOpenShell model and reports what it created, changed and deleted.

    The operations are the form "dataspatium-tools/1", which Dataregium takes in a change proposal as well; new operations and fields
    are added, never changed. Since recommendations 3, 5 and 6 of the native IFC study (2026-11-12):

        define_type {kind: wall | slab | roof, name, layers: [{material, thickness, category, role}], predefined_type}
            a type with a ref: IfcWallType, IfcSlabType, or IfcSlabType ROOF for the roof slabs of create_roof, with an
            IfcMaterialLayerSet of the layers (metres; a wall's from its right side to its left seen from start to end, a slab's and
            a roof's from the top down); category (IfcMaterial.Category: concrete, steel, aluminium, block, brick, stone, wood,
            glass, gypsum, plastic, earth) and role (IfcMaterialLayer.Category: load_bearing, insulation, inner_finish,
            outer_finish) are optional and null when not known; predefined_type null takes NOTDEFINED, FLOOR and ROOF.
        create_wall, create_slab, create_roof {..., type}
            type (optional) is the ref of a define_type step or a type's id or GlobalId; the element takes its thickness from the
            layers (a thickness given must equal them), gets IfcRelDefinesByType and an IfcMaterialLayerSetUsage, and has no
            PredefinedType of its own (op_define_type and give_type).

    At the end of apply the walls the change set created are joined where their axes meet (join_walls), and what it created or
    changed gets its base quantities (base_quantities).
    """

    CREATES = ("create_wall", "create_slab", "create_roof", "create_opening", "create_spaces", "define_type")
    ROOF_TYPES = {"gable": "GABLE_ROOF", "hip": "HIP_ROOF", "shed": "SHED_ROOF", "flat": "FLAT_ROOF"}

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
        self.notes = []  # what an operation could not do in the file's schema, for the report
        self.n_created = 0
        owners = model.by_type("IfcOwnerHistory")
        self.owner = owners[0] if owners else None
        self._body = None
        self._axis = None

    # -- units, lookups and bookkeeping
    def u(self, metres):
        return float(metres) / self.scale

    def entity(self, ref):
        """An element by its STEP id, its GlobalId (22 characters: a proposal names elements so, decision F34 a at Dataregium), or a
        ref of this change set."""
        if isinstance(ref, str) and ref in self.refs:
            return self.refs[ref]
        if isinstance(ref, str) and len(ref) == 22 and not ref.isdigit():
            try:
                e = self.m.by_guid(ref)
            except Exception:
                e = None
            if e is None:
                raise DataspatiumError("no element with GlobalId %r" % (ref,))
            return e
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

    def storey(self, name, top=False):
        """A storey by its name; without one the lowest, or with top the highest."""
        storeys = self.m.by_type("IfcBuildingStorey")
        if not storeys:
            raise DataspatiumError("the model has no storey; create one with create_storeys_and_grid first")
        if name is None or str(name).strip() == "":
            ordered = sorted(storeys, key=lambda s: float(s.Elevation or 0))
            return ordered[-1] if top else ordered[0]
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
        site = self.site()
        building = self.root("IfcBuilding", "Building")
        building.CompositionType = "ELEMENT"
        building.ObjectPlacement = self.placement(site.ObjectPlacement, 0, 0, 0)
        ifcopenshell.api.aggregate.assign_object(self.m, products=[building], relating_object=site)
        self.register(building, ref=False)
        return building

    def site(self, name=None):
        """The file's site: the first IfcSite, or a new one under the project, with the buildings that hung on the project moved under it."""
        import ifcopenshell.api.aggregate
        sites = self.m.by_type("IfcSite")
        if sites:
            return sites[0]
        projects = self.m.by_type("IfcProject")
        if not projects:
            raise DataspatiumError("the model has no IfcProject")
        site = self.root("IfcSite", name or "Site")
        site.CompositionType = "ELEMENT"
        site.ObjectPlacement = self.placement(None, 0, 0, 0)
        ifcopenshell.api.aggregate.assign_object(self.m, products=[site], relating_object=projects[0])
        for building in self.m.by_type("IfcBuilding"):
            if any(rel.RelatingObject.id() == projects[0].id() for rel in (building.Decomposes or ())):
                ifcopenshell.api.aggregate.assign_object(self.m, products=[building], relating_object=site)
                self.touch(building)
        self.register(site, ref=False)
        return site

    def model_context(self):
        """The 3D model context (ContextType Model, not a sub-context), made when the file has none."""
        parents = [c for c in self.m.by_type("IfcGeometricRepresentationContext") if not c.is_a("IfcGeometricRepresentationSubContext") and (c.ContextType or "Model") == "Model"]
        if parents:
            return parents[0]
        import ifcopenshell.api.context
        return ifcopenshell.api.context.add_context(self.m, context_type="Model")

    def length_unit(self):
        """The project's length unit (an IfcNamedUnit), or None."""
        for project in self.m.by_type("IfcProject"):
            units = project.UnitsInContext
            for unit in ((units.Units or ()) if units is not None else ()):
                if unit.is_a("IfcNamedUnit") and getattr(unit, "UnitType", None) == "LENGTHUNIT":
                    return unit
        return None

    def body(self):
        if self._body is not None:
            return self._body
        subs = [c for c in self.m.by_type("IfcGeometricRepresentationSubContext") if (c.ContextIdentifier or "") == "Body"]
        if subs:
            self._body = subs[0]
            return subs[0]
        import ifcopenshell.api.context
        self._body = ifcopenshell.api.context.add_context(self.m, context_type="Model", context_identifier="Body", target_view="MODEL_VIEW", parent=self.model_context())
        return self._body

    def axis_context(self):
        """The sub-context of the walls' 'Axis' representations (Model/Axis/GRAPH_VIEW), made when the file has none."""
        if self._axis is not None:
            return self._axis
        subs = [c for c in self.m.by_type("IfcGeometricRepresentationSubContext") if (c.ContextIdentifier or "") == "Axis"]
        if subs:
            self._axis = subs[0]
            return subs[0]
        import ifcopenshell.api.context
        self._axis = ifcopenshell.api.context.add_context(self.m, context_type="Model", context_identifier="Axis", target_view="GRAPH_VIEW", parent=self.model_context())
        return self._axis

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

    def wall_extent(self, storey):
        """The bounding box (x0, y0, x1, y1) of the storey's walls in its plane and the height of their tops above it, in metres;
        (None, None) when no wall on the storey has a body the app can read."""
        frame = _cs_placement(storey.ObjectPlacement)
        if frame is None:
            return None, None
        back = _cs_invert(frame)
        pts = []
        for wall in self.m.by_type("IfcWall"):
            container = self.container(wall)
            if container is None or container.id() != storey.id():
                continue
            try:
                m = _cs_placement(wall.ObjectPlacement)
                rep = wall.Representation
                if m is None or rep is None:
                    continue
                m = _cs_compose(back, m)
                for r in rep.Representations or ():
                    if (r.RepresentationIdentifier or "") == "Body":
                        pts += [_cs_at(m, p) for item in (r.Items or ()) for p in _cs_item_points(item)]
            except Exception:
                continue
        if not pts:
            return None, None
        s = self.scale
        return (min(p[0] for p in pts) * s, min(p[1] for p in pts) * s, max(p[0] for p in pts) * s, max(p[1] for p in pts) * s), max(p[2] for p in pts) * s

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
        op, typ = self.with_type(op, "wall")
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
        # The centreline as the wall's 'Axis' (Curve2D), after the body, so that the topology reads it without the geometry kernel.
        axis = self.m.createIfcPolyline([self.point(0, 0), self.point(self.u(length), 0)])
        wall.Representation.Representations = list(wall.Representation.Representations) + [self.m.createIfcShapeRepresentation(self.axis_context(), "Axis", "Curve2D", [axis])]
        self.predefined(wall, "STANDARD")
        self.contain(wall, storey)
        self.register(wall, storey)
        self.give_type(wall, typ, "AXIS2", "POSITIVE", -thickness / 2.0)  # the layers centred on the axis, the first on the right

    def op_create_slab(self, op):
        op, typ = self.with_type(op, "slab")
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
        self.give_type(slab, typ, "AXIS3", "NEGATIVE", 0.0)  # the top at the storey, the first layer at the top

    def op_create_roof(self, op):
        """A roof over a rectangle: an IfcRoof in the storey (the highest when none is named) that aggregates one roof slab (IfcSlab
        ROOF) per face, the roof alone with a ref. The rectangle is the outline's bounding box or the storey's walls'; the eaves lie on
        its sides at base above the storey (by default the top of the walls, else 2.7 m), every face rises inward at the pitch (the
        ridge base + half the span x tan(pitch) high), and the overhang reaches beyond the sides. A face is the polygon of its outline
        in its own plane (Axis the face's normal, RefDirection along the eaves), extruded straight up by thickness / cos(pitch): its
        thickness at right angles is the given one, and neighbouring faces meet in the vertical planes through the ridge and the hips
        without a gap or an overlap."""
        import ifcopenshell.api.aggregate
        op, typ = self.with_type(op, "roof")
        shape = str(op.get("shape") or "").strip().lower()
        if shape not in self.ROOF_TYPES:
            raise DataspatiumError("shape must be gable, hip, shed or flat")
        storey = self.storey(op.get("storey"), top=True)
        flat = shape == "flat"
        pitch = 0.0 if flat else _cs_num(op, "pitch", 10.0 if shape == "shed" else 30.0, unit="degrees")
        if not flat and not 0.0 < pitch <= 75.0:
            raise DataspatiumError("pitch must be more than 0 and at most 75 degrees; use shape flat for a flat roof")
        overhang = _cs_num(op, "overhang", 0.0 if flat else 0.4)
        if overhang < 0:
            raise DataspatiumError("overhang must be zero or more (metres)")
        thickness = _cs_num(op, "thickness", 0.25, positive=True)
        ridge = str(op.get("ridge") or "").strip().lower() or None
        if ridge not in (None, "x", "y"):
            raise DataspatiumError("ridge must be x, y or null")
        outline = op.get("outline")
        extent, top = self.wall_extent(storey) if not outline or op.get("base") is None else (None, None)
        if outline:
            if not isinstance(outline, (list, tuple)) or len(outline) < 3:
                raise DataspatiumError("outline must be at least three [x, y] points")
            pts = [_cs_xy(p, "outline") for p in outline]
            extent = (min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts))
            if not _cs_rectangle(pts):
                self.notes.append("the roof's outline is not a rectangle along x and y (%d corners), so the roof covers its bounding box" % len(pts))
        elif extent is None:
            raise DataspatiumError("give an outline: storey %r has no walls whose shape the app can read" % _ifc_text(storey.Name))
        x0, y0, x1, y1 = extent
        length, width = x1 - x0, y1 - y0
        if length < 0.1 or width < 0.1:
            raise DataspatiumError("the roof must span at least 0.1 m along x and along y, not %.3g x %.3g m" % (length, width))
        base = _cs_num(op, "base", 2.7 if top is None else top)
        name = op.get("name") or "Roof"
        roof = self.root("IfcRoof", name)
        roof.ObjectPlacement = self.placement(storey.ObjectPlacement, self.u(x0), self.u(y0), self.u(base))
        if self.m.schema == "IFC2X3":
            roof.ShapeType = self.ROOF_TYPES[shape]
        else:
            self.predefined(roof, self.ROOF_TYPES[shape])
        self.contain(roof, storey)
        self.register(roof, storey)
        p = math.radians(pitch)
        sin, cos, tan = math.sin(p), math.cos(p), math.tan(p)
        slabs = []
        for i, (fall, corners) in enumerate(_cs_roof_faces(shape, length, width, overhang, ridge)):
            fx, fy = fall
            eaves = max(x * fx + y * fy for x, y in ((0.0, 0.0), (length, 0.0), (length, width), (0.0, width)))
            pts = [(x, y, (eaves - x * fx - y * fy) * tan) for x, y in corners]  # metres in the roof's placement
            along, up, normal = (-fy, fx, 0.0), (-fx * cos, -fy * cos, sin), (fx * sin, fy * sin, cos)
            o = pts[0]
            face = [[self.u(_cs_dot([q[k] - o[k] for k in range(3)], axis)) for axis in (along, up)] for q in pts]  # in the face's plane
            profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, self.m.createIfcPolyline([self.point(u, v) for u, v in face + face[:1]]))
            position = self.m.createIfcAxis2Placement3D(self.point(self.u(o[0]), self.u(o[1]), self.u(o[2])), self.direction(*normal), self.direction(*along))
            slab = self.root("IfcSlab", "%s %d" % (name, i + 1))
            slab.ObjectPlacement = self.placement(roof.ObjectPlacement, 0, 0, 0)
            slab.Representation = self.shape(self.m.createIfcExtrudedAreaSolid(profile, position, self.direction(0.0, sin, cos), self.u(thickness / cos)))
            self.predefined(slab, "ROOF")
            slabs.append(slab)
        ifcopenshell.api.aggregate.assign_object(self.m, products=slabs, relating_object=roof)
        for slab in slabs:
            self.register(slab, storey, ref=False)
        for slab in slabs:  # the layers rise from the face's underside, the plane of the slab's profile
            self.give_type(slab, typ, "AXIS3", "POSITIVE", 0.0)

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
        # A door or window in a wall that already bounds spaces bounds the one whose edge it stands on, as create_spaces would have.
        mid = self.plan_point(e, self.u(width) / 2.0)
        for b in list(getattr(wall, "ProvidesBoundaries", None) or ()):
            outline = self.space_outline(b.RelatingSpace) if b.RelatingSpace.is_a("IfcSpace") else None
            if mid is not None and outline is not None and outline.boundary.distance(_topo_point(mid)) <= thickness * self.scale / 2.0 + 0.05:
                self.bound(b.RelatingSpace, e, b.InternalOrExternalBoundary == "EXTERNAL")

    # -- spaces and their boundaries
    def bound(self, space, element, external):
        """A physical IfcRelSpaceBoundary of a space against a wall, door or window, without connection geometry for now."""
        import ifcopenshell.guid
        rel = self.m.create_entity("IfcRelSpaceBoundary", GlobalId=ifcopenshell.guid.new(), RelatingSpace=space, RelatedBuildingElement=element,
                                   PhysicalOrVirtualBoundary="PHYSICAL", InternalOrExternalBoundary="EXTERNAL" if external else "INTERNAL")
        if self.owner is not None:
            rel.OwnerHistory = self.owner
        return rel

    @staticmethod
    def fillings(wall):
        """The doors and windows in a wall's openings."""
        return [f.RelatedBuildingElement for v in (getattr(wall, "HasOpenings", None) or ()) for f in (getattr(v.RelatedOpeningElement, "HasFillings", None) or ())]

    def plan_point(self, e, along=0.0):
        """Where an element's placement stands in the world's plan, `along` file units along its x axis, in metres; None if unknown."""
        m = _cs_placement(getattr(e, "ObjectPlacement", None))
        if m is None:
            return None
        p = _cs_at(m, (along, 0.0, 0.0))
        return p[0] * self.scale, p[1] * self.scale

    def space_outline(self, space):
        """A space's footprint in the world's plan in metres (shapely): the profile of an extruded body, else the hull of its body's
        corners; None without a body the app can read."""
        from shapely.geometry import MultiPoint, Polygon
        m = _cs_placement(space.ObjectPlacement)
        rep = space.Representation
        pts = []
        for r in (rep.Representations if rep is not None and m is not None else ()):
            if (r.RepresentationIdentifier or "Body") != "Body":
                continue
            for item in (r.Items or ()):
                corners = [_cs_at(m, p) for p in _cs_item_points(item)]
                if item.is_a("IfcExtrudedAreaSolid") and len(corners) >= 6:
                    return Polygon([(q[0] * self.scale, q[1] * self.scale) for q in corners[::2]])
                pts += corners
        hull = MultiPoint([(q[0] * self.scale, q[1] * self.scale) for q in pts]).convex_hull if len(pts) >= 3 else None
        return hull if hull is not None and hull.geom_type == "Polygon" else None

    def storey_height(self, storey):
        """The default height of a storey's spaces in metres: up to the next storey, else to the top of its walls, else 3."""
        z = _topo_elevation(storey, self.scale)
        above = sorted(e for e in (_topo_elevation(s, self.scale) for s in self.m.by_type("IfcBuildingStorey")) if e > z + 1e-6)
        if above:
            return above[0] - z
        top = self.wall_extent(storey)[1]
        return top if top and top > 0 else 3.0

    def pick_rooms(self, topo, rooms, frame):
        """The listed rooms of one storey's topology, as (room, name, long name): each by a point inside it in the storey's plane, or by
        its index in get_topology. A point that hits no room, an index that does not exist and a room named twice are errors."""
        storey = _ifc_text(topo["_storey"].Name)
        back = _cs_invert(frame)

        def where(r):
            p = r["polygon"].representative_point()
            q = _cs_at(back, (p.x / self.scale, p.y / self.scale, frame[3][2]))
            return "%d at (%.2f, %.2f)" % (r["index"], q[0] * self.scale, q[1] * self.scale)
        out, seen = [], {}
        for i, entry in enumerate(rooms):
            if not isinstance(entry, dict) or not str(entry.get("name") or "").strip():
                raise DataspatiumError("room %d needs a name" % (i + 1))
            if entry.get("at") is not None:
                x, y = _cs_xy(entry.get("at"), "at")
                w = _cs_at(frame, (x / self.scale, y / self.scale, 0.0))
                hit = [r for r in topo["rooms"] if r["polygon"].contains(_topo_point((w[0] * self.scale, w[1] * self.scale)))]
                if not hit:
                    raise DataspatiumError("room %d: no closed room on storey %r has (%g, %g) inside; its rooms are %s" % (i + 1, storey, x, y, "; ".join(where(r) for r in topo["rooms"])))
                room = hit[0]
            else:
                index = entry.get("index")
                if isinstance(index, bool) or not isinstance(index, (int, float)) or int(index) != index or not 1 <= int(index) <= len(topo["rooms"]):
                    raise DataspatiumError("room %d: storey %r has rooms 1 to %d, not %r" % (i + 1, storey, len(topo["rooms"]), index))
                room = topo["rooms"][int(index) - 1]
            if room["index"] in seen:
                raise DataspatiumError("rooms %d and %d are the same room (%s)" % (seen[room["index"]], i + 1, where(room)))
            seen[room["index"]] = i + 1
            out.append((room, str(entry["name"]).strip()[:255], str(entry.get("long_name") or "").strip()[:255] or None))
        return out

    def make_space(self, storey, frame, room, name, long_name, height):
        """An IfcSpace with the room's outline (holes as voids) in the storey's plane, extruded height metres up from the storey."""
        back = _cs_invert(frame)

        def curve(ring):
            pts = [_cs_at(back, (c[0] / self.scale, c[1] / self.scale, frame[3][2])) for c in ring.coords]
            return self.m.createIfcPolyline([self.point(p[0], p[1]) for p in pts])
        poly = room["polygon"]
        if poly.interiors:
            profile = self.m.createIfcArbitraryProfileDefWithVoids("AREA", None, curve(poly.exterior), [curve(r) for r in poly.interiors])
        else:
            profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, curve(poly.exterior))
        space = self.root("IfcSpace", name)
        space.LongName = long_name
        space.CompositionType = "ELEMENT"
        if self.m.schema == "IFC2X3":
            space.InteriorOrExteriorSpace = "INTERNAL"
        else:
            self.predefined(space, "INTERNAL")
        space.ObjectPlacement = self.placement(storey.ObjectPlacement, 0, 0, 0)
        space.Representation = self.shape(self.m.createIfcExtrudedAreaSolid(profile, self.axis3(0, 0, 0), self.direction(0, 0, 1), self.u(height)))
        return space

    def space_quantities(self, space, room, height):
        """Qto_SpaceBaseQuantities in the file's units: the outline's area and perimeter, the area inside the walls' faces, the volumes."""
        import ifcopenshell.api.pset
        import ifcopenshell.util.unit

        def per(kind):
            try:
                return float(ifcopenshell.util.unit.calculate_unit_scale(self.m, kind) or 1.0)
            except Exception:
                return 1.0
        area, volume = per("AREAUNIT"), per("VOLUMEUNIT")
        gross, net = room["polygon"].area, room["net_area"]
        qto = ifcopenshell.api.pset.add_qto(self.m, product=space, name="Qto_SpaceBaseQuantities")
        ifcopenshell.api.pset.edit_qto(self.m, qto=qto, properties={
            "Height": self.u(height), "GrossPerimeter": self.u(room["polygon"].length), "GrossFloorArea": gross / area, "NetFloorArea": net / area,
            "GrossVolume": gross * height / volume, "NetVolume": net * height / volume})

    def op_create_spaces(self, op):
        """The rooms the walls enclose as spaces, from the topology of the file as it stands at this step, so that walls made earlier
        in the change set count: per room an IfcSpace aggregated in its storey, with the room's outline extruded to the height (by
        default up to the next storey, or to the top of the walls), Qto_SpaceBaseQuantities, and physical space boundaries to the walls
        along its edge (external where the topology finds the wall external) and to the doors and windows in them that stand on that
        edge. Listed rooms need the storey and get a ref each, in their order; without a list every room on the storey (or on every
        storey with rooms) is made, named by default_name with its index for {n}, and none gets a ref."""
        import ifcopenshell.api.aggregate
        rooms = op.get("rooms")
        listed = rooms is not None
        if listed and (not isinstance(rooms, list) or not rooms):
            raise DataspatiumError("rooms must be a list of {at or index, name, long_name}, or null for every room")
        named = str(op.get("storey") or "").strip()
        if listed and not named:
            raise DataspatiumError("name the storey the rooms are on; storey null goes with rooms null")
        storey = self.storey(named) if named else None
        height = None if op.get("height") is None else _cs_num(op, "height", positive=True)
        found = [x for x in _ifc_topology(self.m, storeys={_ifc_text(storey.Name)} if storey is not None else None, shapes=True)
                 if x["rooms"] and (storey is None or x["_storey"].id() == storey.id())]
        if not found:
            raise DataspatiumError("the walls enclose no room on %s; close the walls first (the preview's topology shows the open ends)"
                                   % ("storey %r" % _ifc_text(storey.Name) if storey is not None else "any storey"))
        template = str(op.get("default_name") or "Room {n}")
        made = 0
        for topo in found:
            s = topo["_storey"]
            frame = _cs_placement(s.ObjectPlacement)
            if frame is None:
                raise DataspatiumError("the placement of storey %r cannot be followed" % _ifc_text(s.Name))
            chosen = self.pick_rooms(topo, rooms, frame) if listed else [(r, template.replace("{n}", str(r["index"])), None) for r in topo["rooms"]]
            # The storey's spaces so far: a room one of them covers is not made twice, and a name is not given twice.
            others = [(p, self.space_outline(p)) for rel in (getattr(s, "IsDecomposedBy", None) or ()) for p in rel.RelatedObjects if p.is_a("IfcSpace")]
            covered = [(room, name, next((p for p, o in others if o is not None and o.contains(room["polygon"].representative_point())), None)) for room, name, _ in chosen]
            for room, name, space in covered:
                if space is not None and listed:
                    raise DataspatiumError("room %d on storey %r lies in the space %r already" % (room["index"], _ifc_text(s.Name), _ifc_text(space.Name)))
                if space is not None:
                    self.notes.append("room %d on storey %s was left out: the space %s covers it already" % (room["index"], _ifc_text(s.Name), _ifc_text(space.Name)))
            chosen = [c for c, (_, _, space) in zip(chosen, covered) if space is None]
            twice = [n for _, n, _ in chosen if n in {str(p.Name or "") for p, _ in others}]
            if twice:
                raise DataspatiumError("storey %r has a space named %r already" % (_ifc_text(s.Name), twice[0]))
            if not chosen:
                continue
            made += len(chosen)
            h = height or self.storey_height(s)
            external = {e["wall"] for e in topo["external"]}
            spaces = []
            for room, name, long_name in chosen:
                space = self.make_space(s, frame, room, name, long_name, h)
                spaces.append(space)
                for wall in (self.m.by_id(i) for i in room["walls"]):
                    self.bound(space, wall, wall.id() in external)
                    for f in self.fillings(wall):
                        mid = self.plan_point(f, float(getattr(f, "OverallWidth", None) or 0.0) / 2.0)
                        if mid is not None and room["polygon"].boundary.distance(_topo_point(mid)) <= topo["tolerance"]:
                            self.bound(space, f, wall.id() in external)
            ifcopenshell.api.aggregate.assign_object(self.m, products=spaces, relating_object=s)
            for space, (room, _, _) in zip(spaces, chosen):
                self.space_quantities(space, room, h)
                self.register(space, s, ref=listed)
        if not made:
            raise DataspatiumError("every room the walls enclose has a space already")

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

    def op_set_classification(self, op):
        import ifcopenshell.api.classification
        system = str(op.get("system") or "").strip()
        name = str(op.get("name") or "").strip()
        if not system or not name:
            raise DataspatiumError("system and name are required")
        found = [c for c in self.m.by_type("IfcClassification") if str(c.Name or "") == system]
        classification = found[0] if found else ifcopenshell.api.classification.add_classification(self.m, classification=system)
        code = str(op.get("code") or "").strip() or None
        uri = str(op.get("uri") or "").strip() or None
        for e in self.elements(op):
            ref = ifcopenshell.api.classification.add_reference(self.m, products=[e], identification=code, name=name, classification=classification)
            if uri and ref is not None and hasattr(ref, "Location"):
                ref.Location = uri
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
        """Delete elements; the doors and windows in an element's openings go with it, so nothing is left hanging in the air."""
        import ifcopenshell.api.root
        if op.get("confirm") is not True:
            raise DataspatiumError("deleting needs confirm: true, which the person gives")
        targets = self.elements(op)
        ids = {e.id() for e in targets}
        for e in targets:
            fillings = []
            for rel in (getattr(e, "HasOpenings", None) or ()):
                opening = rel.RelatedOpeningElement
                for f in (getattr(opening, "HasFillings", None) or ()):
                    if f.RelatedBuildingElement.id() not in ids:
                        fillings.append(f.RelatedBuildingElement)
            for f in fillings + [e]:
                rec = self.record(f, self.container(f))
                if f is not e:
                    rec["with"] = e.id()
                self.deleted.append(rec)
                self.changed.pop(f.id(), None)
                ifcopenshell.api.root.remove_product(self.m, product=f)

    def op_set_site(self, op):
        """The model's place on earth: the site's WGS 84 position (compound plane angles, every part signed), its height above the sea
        and its name, and with a crs the map conversion of the model context to that projected CRS (IFC4 and IFC4X3; IFC2X3 has none,
        which the report notes). The site goes into the changed list; a CRS or conversion that had to be made into the created list."""
        latitude = _cs_num(op, "latitude", unit="degrees")
        longitude = _cs_num(op, "longitude", unit="degrees")
        if not -90.0 <= latitude <= 90.0:
            raise DataspatiumError("latitude must be between -90 and 90 degrees")
        if not -180.0 <= longitude <= 180.0:
            raise DataspatiumError("longitude must be between -180 and 180 degrees")
        elevation = None if op.get("elevation") is None else _cs_num(op, "elevation")
        crs = str(op.get("crs") or "").strip().upper() or None
        eastings = northings = None
        if crs is not None:
            if not (crs.startswith("EPSG:") and crs[5:].isdigit()):
                raise DataspatiumError("crs must be an EPSG code such as EPSG:3006")
            eastings = _cs_num(op, "eastings")
            northings = _cs_num(op, "northings")
        elif op.get("eastings") is not None or op.get("northings") is not None:
            raise DataspatiumError("eastings and northings need a crs such as EPSG:3006")
        rotation = _cs_num(op, "rotation", 0.0, unit="degrees")
        site_name = str(op.get("site_name") or "").strip()[:255] or None
        site = self.site(site_name)
        site.RefLatitude = _cs_angle(latitude)
        site.RefLongitude = _cs_angle(longitude)
        if elevation is not None:
            site.RefElevation = self.u(elevation)
        if site_name:
            site.Name = site_name
        self.touch(site)
        if crs is None:
            return
        if self.m.schema == "IFC2X3":
            self.notes.append("the map conversion to %s was skipped: IFC2X3 has no IfcMapConversion; the site's latitude, longitude and elevation were set" % crs)
            return
        self.map_conversion(crs, eastings, northings, 0.0 if elevation is None else elevation, rotation)

    def map_conversion(self, crs, eastings, northings, height, rotation):
        """One IfcProjectedCRS named by the EPSG code and one IfcMapConversion from the model context to it, made or updated, never
        doubled. Lengths come in metres and are written in the file's unit, which is also the map unit."""
        context = self.model_context()
        conversions = self.m.by_type("IfcMapConversion")
        conversion = next((c for c in conversions if c.SourceCRS is not None and c.SourceCRS.id() == context.id()), conversions[0] if conversions else None)
        target = conversion.TargetCRS if conversion is not None and conversion.TargetCRS is not None and conversion.TargetCRS.is_a("IfcProjectedCRS") else None
        if target is None:
            found = self.m.by_type("IfcProjectedCRS")
            target = found[0] if found else None
        datum, projection, zone = _cs_crs_facts(crs)
        if datum is None and self.m.schema == "IFC4":
            datum = ""  # IFC4 requires a datum; an empty identifier says the app does not know this code's
            self.notes.append("the geodetic datum of %s is not known to the app; IFC4 requires one, so it is written empty" % crs)
        values = {"Name": crs, "GeodeticDatum": datum, "MapProjection": projection, "MapZone": zone, "MapUnit": self.length_unit()}
        if target is None:
            target = self.m.create_entity("IfcProjectedCRS", **values)
            self.register(target, ref=False)
        else:
            for key, value in values.items():
                setattr(target, key, value)
            self.touch(target)
        angle = math.radians(rotation)
        values = {"SourceCRS": context, "TargetCRS": target, "Eastings": self.u(eastings), "Northings": self.u(northings), "OrthogonalHeight": self.u(height),
                  "XAxisAbscissa": math.cos(angle), "XAxisOrdinate": math.sin(angle), "Scale": 1.0}
        if conversion is None:
            conversion = self.m.create_entity("IfcMapConversion", **values)
            self.register(conversion, ref=False)
        else:
            for key, value in values.items():
                setattr(conversion, key, value)
            self.touch(conversion)

    # -- types with material layers, wall joins and base quantities (recommendations 3, 5 and 6 of the native IFC study)
    TYPE_KINDS = {"wall": ("IfcWallType", "NOTDEFINED"), "slab": ("IfcSlabType", "FLOOR"), "roof": ("IfcSlabType", "ROOF")}
    MAX_LAYERS = 20
    # IfcMaterial.Category: the categories IfcOpenShell's add_material recommends; IfcMaterialLayer.Category: the keywords of the
    # schema's documentation of the attribute, (IFC4, IFC4X3). IFC2X3 has neither attribute.
    MATERIAL_CATEGORIES = ("concrete", "steel", "aluminium", "block", "brick", "stone", "wood", "glass", "gypsum", "plastic", "earth")
    LAYER_ROLES = {"load_bearing": ("LoadBearing", "LoadBearing"), "insulation": ("Insulation", "Insulation"),
                   "inner_finish": ("Finish", "Inner finish"), "outer_finish": ("Finish", "Outer finish")}

    def op_define_type(self, op):
        """A type with its material layers and a ref, for the type of later create steps: kind wall makes an IfcWallType, slab an
        IfcSlabType and roof an IfcSlabType ROOF for create_roof's roof slabs (the IfcRoof only aggregates them, and IFC2X3 has no
        IfcRoofType), with an IfcMaterialLayerSet named after it. The layers come in metres from a wall's right side to its left,
        seen from its start toward its end, and from a slab's or a roof's top down; a roof type keeps them from the bottom up, the
        order in which its slabs' usage lays them from the underside. A layer's optional category goes to its material
        (IfcMaterial.Category, one of MATERIAL_CATEGORIES; a material the file has already keeps its own and takes one it lacks) and
        its optional role to the layer (IfcMaterialLayer.Category, LAYER_ROLES in the file's schema); IFC2X3 has neither, which the
        notes say. The PredefinedType is predefined_type, by default NOTDEFINED, FLOOR and ROOF, from the class's list in the file's
        schema (_cs_type_values). A type of the same class and name, in any case, in the file is an error that names its GlobalId, to
        give as type instead (a server's copy of the file keeps the GlobalIds, not necessarily the STEP ids)."""
        kind = str(op.get("kind") or "").strip().lower()
        if kind not in self.TYPE_KINDS:
            raise DataspatiumError("kind must be wall, slab or roof")
        ifc_class, default = self.TYPE_KINDS[kind]
        name = str(op.get("name") or "").strip()[:255]
        if not name:
            raise DataspatiumError("the type needs a name")
        layers = op.get("layers")
        if not isinstance(layers, (list, tuple)) or not layers or len(layers) > self.MAX_LAYERS:
            raise DataspatiumError("layers must be a list of 1 to %d {material, thickness}, the thickness in metres" % self.MAX_LAYERS)
        parsed = []
        for i, layer in enumerate(layers):
            material = str(layer.get("material") or "").strip()[:255] if isinstance(layer, dict) else ""
            if not material:
                raise DataspatiumError("layer %d needs a material" % (i + 1))
            category = str(layer.get("category") or "").strip().lower() or None
            role = str(layer.get("role") or "").strip().lower().replace(" ", "_").replace("-", "_") or None
            if category is not None and category not in self.MATERIAL_CATEGORIES:
                raise DataspatiumError("layer %d: category must be one of %s, or null" % (i + 1, ", ".join(self.MATERIAL_CATEGORIES)))
            if role is not None and role not in self.LAYER_ROLES:
                raise DataspatiumError("layer %d: role must be one of %s, or null" % (i + 1, ", ".join(self.LAYER_ROLES)))
            try:
                parsed.append((material, _cs_num(layer, "thickness", positive=True), category, role))
            except DataspatiumError as exc:
                raise DataspatiumError("layer %d: %s" % (i + 1, exc))
        twin = next((t for t in self.m.by_type(ifc_class) if str(t.Name or "").strip().lower() == name.lower()), None)
        if twin is not None:
            raise DataspatiumError("the model has an %s named %r already (GlobalId %s, id %d); give its GlobalId as type, or choose another name"
                                   % (ifc_class, _ifc_text(twin.Name), twin.GlobalId, twin.id()))
        value = str(op.get("predefined_type") or "").strip().upper() or default
        allowed = _cs_type_values(self.m, ifc_class, kind)
        if value not in allowed:
            raise DataspatiumError("%s is not a PredefinedType of a %s type in %s; it takes %s" % (value, kind, self.m.schema, ", ".join(allowed)))
        old = self.m.schema == "IFC2X3"
        if old and any(c or r for _, _, c, r in parsed):
            self.notes.append("type %s: IFC2X3 has no material categories or layer roles, so they were left out" % name)
        made = []
        for material, thick, category, role in parsed:
            layer = self.m.create_entity("IfcMaterialLayer", Material=self.named_material(material, None if old else category), LayerThickness=round(self.u(thick), 9))
            if role is not None and not old:
                layer.Category = self.LAYER_ROLES[role][0 if self.m.schema == "IFC4" else 1]
            made.append(layer)
        t = self.root(ifc_class, name)
        t.PredefinedType = value
        self.associate(t, self.m.create_entity("IfcMaterialLayerSet", MaterialLayers=made[::-1] if kind == "roof" else made, LayerSetName=name))
        self.register(t)

    def named_material(self, name, category=None):
        """The file's IfcMaterial of that name, made when there is none; a category (IFC4 and later) goes to a material without one,
        and one the material has already must match it."""
        import ifcopenshell.api.material
        found = next((x for x in self.m.by_type("IfcMaterial") if str(x.Name or "") == name), None)
        if found is None:
            return ifcopenshell.api.material.add_material(self.m, name=name, category=category)
        own = str(getattr(found, "Category", None) or "").strip()
        if category and own and own.lower() != category:
            raise DataspatiumError("the model's material %r has the category %r, not %r; give that category or null" % (name, own, category))
        if category and not own:
            found.Category = category
        return found

    def associate(self, product, material):
        """An IfcRelAssociatesMaterial of one product with a material, a layer set or a layer set usage."""
        import ifcopenshell.guid
        return self.m.create_entity("IfcRelAssociatesMaterial", GlobalId=ifcopenshell.guid.new(), OwnerHistory=self.owner,
                                    RelatedObjects=[product], RelatingMaterial=material)

    @staticmethod
    def type_layers(t):
        """A type's IfcMaterialLayerSet: its own, else the one its occurrences' layer set usage names; None without one."""
        for rel in getattr(t, "HasAssociations", None) or ():
            if rel.is_a("IfcRelAssociatesMaterial") and rel.RelatingMaterial.is_a("IfcMaterialLayerSet"):
                return rel.RelatingMaterial
            if rel.is_a("IfcRelAssociatesMaterial") and rel.RelatingMaterial.is_a("IfcMaterialLayerSetUsage"):
                return rel.RelatingMaterial.ForLayerSet
        for rel in getattr(t, "Types", None) or getattr(t, "ObjectTypeOf", None) or ():
            for o in rel.RelatedObjects or ():
                for a in getattr(o, "HasAssociations", None) or ():
                    if a.is_a("IfcRelAssociatesMaterial") and a.RelatingMaterial.is_a("IfcMaterialLayerSetUsage"):
                        return a.RelatingMaterial.ForLayerSet
        return None

    def with_type(self, op, kind):
        """(op, type) for a create step: with a type (op["type"], a ref, id or GlobalId) a copy of the op whose thickness is that of
        the type's layers in metres, and the type, which must be a wall type for a wall, a slab type for a slab and a roof type (an
        IfcSlabType ROOF) for a roof; (op, None) without one. A thickness the step gives must be the layers'."""
        ref = op.get("type")
        if ref is None or str(ref).strip() == "":
            return op, None
        t = self.entity(ref)
        roof = str(getattr(t, "PredefinedType", None) or "") == "ROOF"
        if not t.is_a("IfcWallType" if kind == "wall" else "IfcSlabType") or (kind == "roof") != roof:
            what = {"wall": "a wall type (IfcWallType)", "slab": "a slab type (an IfcSlabType other than ROOF)", "roof": "a roof type (IfcSlabType ROOF)"}[kind]
            raise DataspatiumError("type must name %s, as define_type makes them, not the %s %r" % (what, t.is_a(), _ifc_text(getattr(t, "Name", None))))
        layers = self.type_layers(t)
        total = round(sum(float(x.LayerThickness or 0.0) for x in (layers.MaterialLayers if layers is not None else ())) * self.scale, 9)
        if total <= 0:
            raise DataspatiumError("type %r has no material layers to take the thickness from" % _ifc_text(t.Name))
        if op.get("thickness") is not None and abs(_cs_num(op, "thickness", positive=True) - total) > 0.0005:
            raise DataspatiumError("thickness %g m differs from the %g m of the layers of type %r; leave thickness null" % (_cs_num(op, "thickness"), total, _ifc_text(t.Name)))
        return dict(op, thickness=total), t

    def give_type(self, e, t, direction, sense, offset):
        """Type an occurrence: the type's IfcRelDefinesByType (one per type), the type's layers as an IfcMaterialLayerSetUsage of the
        occurrence's own (LayerSetDirection AXIS2 or AXIS3, DirectionSense POSITIVE or NEGATIVE, OffsetFromReferenceLine from the
        reference line or plane, in metres), and no PredefinedType or ObjectType of its own: the type carries it (OJT001). Nothing
        without a type."""
        if t is None:
            return
        import ifcopenshell.guid
        rel = next(iter(getattr(t, "Types", None) or getattr(t, "ObjectTypeOf", None) or ()), None)
        if rel is None:
            self.m.create_entity("IfcRelDefinesByType", GlobalId=ifcopenshell.guid.new(), OwnerHistory=self.owner, RelatedObjects=[e], RelatingType=t)
        else:
            rel.RelatedObjects = list(rel.RelatedObjects or ()) + [e]
        usage = self.m.create_entity("IfcMaterialLayerSetUsage", ForLayerSet=self.type_layers(t), LayerSetDirection=direction,
                                     DirectionSense=sense, OffsetFromReferenceLine=round(self.u(offset), 9))
        self.associate(e, usage)
        if getattr(e, "PredefinedType", None) is not None:
            e.PredefinedType = None
        if getattr(e, "ObjectType", None) is not None:
            e.ObjectType = None

    def finish(self):
        """After the operations: the joins of the walls the change set created (join_walls), then the base quantities of what it
        created or changed (base_quantities). A fault in either becomes a note in the report, and the operations stand."""
        for step, what in ((self.join_walls, "the wall joins"), (self.base_quantities, "the base quantities")):
            try:
                step()
            except Exception as exc:
                self.notes.append("%s could not be made: %s: %s" % (what, type(exc).__name__, exc))

    JOIN_RIGHT = 0.02  # |cos| of the angle between two walls below which they meet at right angles (about one degree)
    JOIN_LINE = 0.98  # and above which they run in line or side by side (about eleven degrees)

    @staticmethod
    def end_type(k):
        return "ATSTART" if k == 0 else "ATEND"

    def join_walls(self):
        """IfcRelConnectsPathElements where the axis of a wall the change set created meets another wall's on its storey, within the
        topology's tolerance (half the storey's thickest wall plus 0.05 m): two ends at one point are an L, ATSTART or ATEND on both
        with the main wall relating, and an end on another wall's axis between its ends a T, ATSTART or ATEND on the abutting wall,
        which relates, and ATPATH on the through wall, as IfcOpenShell's connect_wall writes them. Three or more ends at one point
        join when two of them continue each other in a line, which the others then abut. The bodies are cut square and the axes stay
        as drawn: at an L the main wall (the thicker, then the longer, then the older) reaches half the other's thickness past the
        corner and the other stops half the main wall's thickness short of it, so that the corner has neither a gap outside nor an
        overlap inside, and at a T the abutting wall stops at the through wall's face, so that no volume is counted twice. Only
        bodies of create_wall's form are cut (wall_box); walls at another angle are joined as drawn, and ends the app cannot sort
        out are left alone, both with a note. Walls joined before keep their joint."""
        new = {r["id"] for r in self.created if r.get("ifc_class") == "IfcWall"}
        storeys = {}
        for i in sorted(new):
            try:
                s = self.container(self.m.by_id(i))
            except Exception:
                continue  # deleted later in the change set
            if s is not None:
                storeys.setdefault(s.id(), s)
        if not storeys:
            return
        done = {frozenset((r.RelatingElement.id(), r.RelatedElement.id())) for r in self.m.by_type("IfcRelConnectsPathElements")
                if r.RelatingElement is not None and r.RelatedElement is not None}
        for s in storeys.values():
            walls = [self.join_wall(e, e.id() in new) for rel in (getattr(s, "ContainsElements", None) or ()) for e in (rel.RelatedElements or ()) if e.is_a("IfcWall")]
            walls = sorted((w for w in walls if w is not None), key=lambda w: w["id"])
            if len(walls) > 1:
                self.join_storey(walls, max([w["t"] for w in walls if w["t"] <= 1.0] or [0.2]) / 2.0 + 0.05, done)

    def join_wall(self, wall, new):
        """A wall as join_walls reads it: its axis in the world's plan in metres, the axis's direction and length, its thickness, its
        placement (a matrix in file units) and its body when create_wall drew it; None without a straight axis of two points."""
        try:
            m = _cs_placement(getattr(wall, "ObjectPlacement", None))
            rep = getattr(wall, "Representation", None)
            line = next((pts for r in (rep.Representations if rep is not None and m is not None else ()) if (r.RepresentationIdentifier or "") == "Axis"
                         for pts in (_topo_curve(item) for item in (r.Items or ())) if pts and len(pts) == 2), None)
            if line is None:
                return None
            s = self.scale
            a, b = [(q[0] * s, q[1] * s) for q in (_cs_at(m, (x, y, 0.0)) for x, y in line)]
            length = math.dist(a, b)
            box = self.wall_box(wall)
            t = float(box.SweptArea.YDim) * s if box is not None else _topo_thickness(wall, s)
        except Exception:
            return None
        if length <= 1e-6 or not t:
            return None
        return {"e": wall, "id": wall.id(), "new": new, "a": a, "b": b, "u": ((b[0] - a[0]) / length, (b[1] - a[1]) / length),
                "len": length, "t": float(t), "m": m, "line": line, "box": box}

    @staticmethod
    def wall_box(element):
        """The body of a wall or an opening when it is one IfcExtrudedAreaSolid of an IfcRectangleProfileDef along the element's x,
        extruded straight up from a position that only lifts it, as create_wall and create_opening draw them; else None."""
        rep = getattr(element, "Representation", None)
        bodies = [r for r in (rep.Representations if rep is not None else ()) if (r.RepresentationIdentifier or "") == "Body"]
        items = list(bodies[0].Items or ()) if len(bodies) == 1 else []
        if len(items) != 1 or not items[0].is_a("IfcExtrudedAreaSolid") or not items[0].SweptArea.is_a("IfcRectangleProfileDef") or items[0].SweptArea.Position is None:
            return None
        item = items[0]
        m, p = _cs_axes(item.Position), _cs_axes(item.SweptArea.Position)
        d = _cs_unit([float(c) for c in item.ExtrudedDirection.DirectionRatios])
        upright = abs(m[0][0] - 1.0) < 1e-9 and abs(m[2][2] - 1.0) < 1e-9 and abs(m[3][0]) < 1e-9 and abs(m[3][1]) < 1e-9
        return item if upright and d is not None and abs(d[2] - 1.0) < 1e-9 and abs(p[0][0] - 1.0) < 1e-9 else None

    def cut_end(self, w, end, q):
        """Move the end of a wall's body on the side of its axis's start (end 0) or end (1) to the plan point q (metres, world) along
        the wall; False, with nothing moved, when the body would be shorter than a centimetre."""
        item, m, s = w["box"], w["m"], self.scale
        profile = item.SweptArea
        x = (q[0] / s - m[3][0]) * m[0][0] + (q[1] / s - m[3][1]) * m[0][1]  # q along the wall's x, in file units
        cx, cy = [float(c) for c in profile.Position.Location.Coordinates][:2]
        x0, x1 = cx - float(profile.XDim) / 2.0, cx + float(profile.XDim) / 2.0
        if (end == 1) == (w["line"][1][0] >= w["line"][0][0]):
            x1 = x
        else:
            x0 = x
        if x1 - x0 < self.u(0.01):
            return False
        profile.XDim = round(x1 - x0, 9)
        point, centre = profile.Position.Location, round((x0 + x1) / 2.0, 9)
        if self.m.get_total_inverses(point) > 1:
            profile.Position.Location = self.point(centre, cy)
        else:
            point.Coordinates = (centre, cy)
        return True

    def join_storey(self, walls, tol, done):
        """The joins on one storey: wall ends within tol of each other meet at one point (union-find), which is a T for each of them
        when it lies on another wall's axis between that wall's ends, else an L of two ends or a meeting of three or more."""
        ends = [(w, k) for w in walls for k in (0, 1)]
        where = [w["a"] if k == 0 else w["b"] for w, k in ends]
        parent = list(range(len(ends)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        for _, i, j in _topo_pairs(where, tol):
            if ends[i][0] is not ends[j][0]:
                parent[find(i)] = find(j)
        groups = {}
        for i in range(len(ends)):
            groups.setdefault(find(i), []).append(i)
        for members in sorted(groups.values()):
            group = [ends[i] for i in members]
            if len({w["id"] for w, _ in group}) < len(group):
                continue  # both ends of one short wall
            p = (sum(where[i][0] for i in members) / len(members), sum(where[i][1] for i in members) / len(members))
            through = self.through(walls, group, p, tol)
            if through is not None:
                for e in group:
                    self.abut(e, through, "ATPATH", through["t"], done)
            elif len(group) == 2:
                self.join_l(group[0], group[1], done)
            elif len(group) > 2:
                self.join_node(group, p, done)

    @staticmethod
    def through(walls, group, p, tol):
        """The wall, not one of the group's, whose axis passes within tol of the point p between its ends (farther than tol from
        both), the nearest; None."""
        own = {w["id"] for w, _ in group}
        best = None
        for w in walls:
            if w["id"] in own:
                continue
            dx, dy = p[0] - w["a"][0], p[1] - w["a"][1]
            along, off = dx * w["u"][0] + dy * w["u"][1], abs(dx * w["u"][1] - dy * w["u"][0])
            if tol < along < w["len"] - tol and off <= tol and (best is None or off < best[0]):
                best = (off, w)
        return best[1] if best else None

    def label(self, w):
        """A wall of join_walls as the notes name it: its ref in this change set, else its id, and its name."""
        ref = next((r["ref"] for r in self.created if r["id"] == w["id"] and r.get("ref")), None)
        return "%s %r" % (ref or "#%d" % w["id"], _ifc_text(getattr(w["e"], "Name", None)) or "")

    def note_join(self, a, b, cos, angled):
        if angled:
            self.notes.append("walls %s and %s meet at %.0f degrees and were joined as drawn: the app cuts corners at right angles only"
                              % (self.label(a), self.label(b), math.degrees(math.acos(min(1.0, cos)))))
        else:
            self.notes.append("walls %s and %s were joined as drawn: the app cuts only bodies drawn by create_wall" % (self.label(a), self.label(b)))

    def abut(self, end, a, a_type, thickness, done):
        """The end `end` (a wall and 0 or 1) against the side of wall a, `thickness` metres thick: the abutting wall relates with
        ATSTART or ATEND and a with a_type (ATPATH at a T), and the abutting wall's body stops at a's face."""
        b, k = end
        pair = frozenset((a["id"], b["id"]))
        cos = abs(a["u"][0] * b["u"][0] + a["u"][1] * b["u"][1])
        if pair in done or not (a["new"] or b["new"]) or cos >= self.JOIN_LINE:
            return  # joined before, both old, or side by side as the layers of a wall
        p = _topo_cross(b["a"], b["u"], a["a"], a["b"])[1]  # where b's axis meets a's
        if cos <= self.JOIN_RIGHT and b["box"] is not None:
            into = b["u"] if k == 0 else (-b["u"][0], -b["u"][1])
            if self.cut_end(b, k, (p[0] + into[0] * thickness / 2.0, p[1] + into[1] * thickness / 2.0)):
                self.touch(b["e"])
        else:
            self.note_join(a, b, cos, cos > self.JOIN_RIGHT)
        self.connect(b, self.end_type(k), a, a_type)
        done.add(pair)

    def join_l(self, e1, e2, done):
        """Two wall ends at one point: an L at right angles, cut so that the corner has neither a gap nor an overlap (join_walls); in
        line a straight joint, ATEND to ATSTART, as drawn; at another angle joined as drawn, with a note."""
        (w1, k1), (w2, k2) = e1, e2
        pair = frozenset((w1["id"], w2["id"]))
        if pair in done or not (w1["new"] or w2["new"]):
            return
        out1 = w1["u"] if k1 == 1 else (-w1["u"][0], -w1["u"][1])
        out2 = w2["u"] if k2 == 1 else (-w2["u"][0], -w2["u"][1])
        dot = out1[0] * out2[0] + out1[1] * out2[1]
        if abs(dot) >= self.JOIN_LINE:
            if dot < 0:  # one continues the other; side by side is no joint
                self.connect(w1, self.end_type(k1), w2, self.end_type(k2))
                done.add(pair)
            return
        (wm, km), (wo, ko) = sorted((e1, e2), key=lambda e: (-round(e[0]["t"], 6), -round(e[0]["len"], 6), e[0]["id"]))
        if abs(dot) <= self.JOIN_RIGHT and wm["box"] is not None and wo["box"] is not None:
            p = _topo_cross(wm["a"], wm["u"], wo["a"], wo["b"])[1]  # where the axes cross
            om = wm["u"] if km == 1 else (-wm["u"][0], -wm["u"][1])  # out of the main wall at the corner
            oo = wo["u"] if ko == 1 else (-wo["u"][0], -wo["u"][1])
            if self.cut_end(wm, km, (p[0] + om[0] * wo["t"] / 2.0, p[1] + om[1] * wo["t"] / 2.0)):
                self.touch(wm["e"])
                if self.cut_end(wo, ko, (p[0] - oo[0] * wm["t"] / 2.0, p[1] - oo[1] * wm["t"] / 2.0)):
                    self.touch(wo["e"])
        else:
            self.note_join(wm, wo, abs(dot), abs(dot) > self.JOIN_RIGHT)
        self.connect(wm, self.end_type(km), wo, self.end_type(ko))
        done.add(pair)

    def join_node(self, group, p, done):
        """Three or more wall ends at one point: two that continue each other in a line get a straight joint and every other end
        abuts that line, the thicker of the two relating, then the older (at a cross the line of the thicker, then the longer,
        walls); without such a line the walls are left as drawn, with a note."""
        def out(e):
            return e[0]["u"] if e[1] == 1 else (-e[0]["u"][0], -e[0]["u"][1])
        lines = [(e1, e2) for i, e1 in enumerate(group) for e2 in group[i + 1:] if out(e1)[0] * out(e2)[0] + out(e1)[1] * out(e2)[1] <= -self.JOIN_LINE]
        if not lines:
            self.notes.append("walls %s meet at (%.2f, %.2f) in a way the app does not join, so they were left as drawn" % (", ".join(self.label(w) for w, _ in group), p[0], p[1]))
            return
        e1, e2 = min(lines, key=lambda l: (-round(max(l[0][0]["t"], l[1][0]["t"]), 6), -round(l[0][0]["len"] + l[1][0]["len"], 6), min(l[0][0]["id"], l[1][0]["id"])))
        self.join_l(e1, e2, done)
        line = min((e1, e2), key=lambda e: (-round(e[0]["t"], 6), e[0]["id"]))
        for e in group:
            if e is not e1 and e is not e2:
                self.abut(e, line[0], self.end_type(line[1]), max(e1[0]["t"], e2[0]["t"]), done)

    def connect(self, relating, relating_type, related, related_type):
        """An IfcRelConnectsPathElements between two walls of join_walls, without priorities or connection geometry."""
        import ifcopenshell.guid
        self.m.create_entity("IfcRelConnectsPathElements", GlobalId=ifcopenshell.guid.new(), OwnerHistory=self.owner,
                             RelatingElement=relating["e"], RelatedElement=related["e"], RelatingPriorities=[], RelatedPriorities=[],
                             RelatingConnectionType=relating_type, RelatedConnectionType=related_type)

    QUANTITIES = (("IfcWall", "Qto_WallBaseQuantities", "qto_wall"), ("IfcSlab", "Qto_SlabBaseQuantities", "qto_slab"),
                  ("IfcRoof", "Qto_RoofBaseQuantities", "qto_roof"), ("IfcDoor", "Qto_DoorBaseQuantities", "qto_filling"),
                  ("IfcWindow", "Qto_WindowBaseQuantities", "qto_filling"))

    def base_quantities(self):
        """The base quantities of the walls, slabs, roofs, doors and windows the change set created or changed, from their
        parameters without a geometry kernel, in the file's units and with MethodOfMeasurement BaseQuantities (add_qto): a set the
        element has of its own is updated, one it shares is left alone. Each quantity has the name in IfcOpenShell's template for the
        file's schema (IFC4X3 spells the wall's footprint areas GrossFootPrintArea and NetFootPrintArea), and one the template lacks
        is left out; IFC2X3 has no templates and gets IFC4's names. An element of another form gets none."""
        for i in dict.fromkeys([r["id"] for r in self.created] + list(self.changed)):
            try:
                e = self.m.by_id(i)
            except Exception:
                continue  # deleted later in the change set
            for ifc_class, name, method in self.QUANTITIES:
                if e.is_a(ifc_class):
                    values = getattr(self, method)(e)
                    if values:
                        self.write_qto(e, name, values)
                    break

    def unit_scale(self, kind):
        """The file's unit of a kind (AREAUNIT, VOLUMEUNIT) in SI units."""
        import ifcopenshell.util.unit
        try:
            return float(ifcopenshell.util.unit.calculate_unit_scale(self.m, kind) or 1.0)
        except Exception:
            return 1.0

    def write_qto(self, e, name, values):
        """values {quantity: (length | area | volume, metres, m² or m³)} as the element's quantity set `name`."""
        import ifcopenshell.api.pset
        names = _cs_qto_names(getattr(self.m, "schema_identifier", None) or self.m.schema, name)
        per = {"length": self.scale, "area": self.unit_scale("AREAUNIT"), "volume": self.unit_scale("VOLUMEUNIT")}
        props = {}
        for key, (kind, value) in values.items():
            spelled = key if names is None else names.get(key.lower())
            if spelled is not None:
                props[spelled] = round(float(value) / per[kind], 9)
        rels = [r for r in (getattr(e, "IsDefinedBy", None) or ()) if r.is_a("IfcRelDefinesByProperties") and hasattr(r.RelatingPropertyDefinition, "is_a")
                and r.RelatingPropertyDefinition.is_a("IfcElementQuantity") and r.RelatingPropertyDefinition.Name == name]
        if not props or any(len(r.RelatedObjects or ()) > 1 for r in rels):
            return
        qto = rels[0].RelatingPropertyDefinition if rels else ifcopenshell.api.pset.add_qto(self.m, product=e, name=name)
        ifcopenshell.api.pset.edit_qto(self.m, qto=qto, properties=props)

    def qto_wall(self, wall):
        """A wall of create_wall's form (wall_box): Length along its body's centreline as joined, Width, Height, the footprint, the
        side of its middle plane and the volume, gross and, less the openings of create_opening's form within the body, net (the
        footprint loses only an opening through the whole height); without the net values when an opening has another form."""
        item = self.wall_box(wall)
        if item is None:
            return None
        s, p = self.scale, item.SweptArea
        cx = float(p.Position.Location.Coordinates[0])
        x0, x1 = cx - float(p.XDim) / 2.0, cx + float(p.XDim) / 2.0
        z0 = _cs_axes(item.Position)[3][2]
        z1 = z0 + float(item.Depth)
        length, width, height = (x1 - x0) * s, float(p.YDim) * s, float(item.Depth) * s
        side, foot = length * height, length * width
        values = {"Length": ("length", length), "Width": ("length", width), "Height": ("length", height),
                  "GrossFootprintArea": ("area", foot), "GrossSideArea": ("area", side), "GrossVolume": ("volume", side * width)}
        cut = through = 0.0
        for rel in getattr(wall, "HasOpenings", None) or ():
            box = self.opening_box(rel.RelatedOpeningElement, wall)
            if box is None:
                return values
            w = max(0.0, min(x1, box[1]) - max(x0, box[0])) * s
            cut += w * max(0.0, min(z1, box[3]) - max(z0, box[2])) * s
            if box[2] <= z0 + 1e-9 and box[3] >= z1 - 1e-9:
                through += w * width
        values.update({"NetFootprintArea": ("area", foot - through), "NetSideArea": ("area", side - cut), "NetVolume": ("volume", (side - cut) * width)})
        return values

    def opening_box(self, opening, wall):
        """(x0, x1, z0, z1) of an opening's body in its wall's coordinates, in file units, when it is a box along the wall (wall_box);
        None for another form."""
        item = self.wall_box(opening)
        mw, mo = _cs_placement(getattr(wall, "ObjectPlacement", None)), _cs_placement(getattr(opening, "ObjectPlacement", None))
        if item is None or mw is None or mo is None:
            return None
        rel = _cs_compose(_cs_invert(mw), mo)
        if abs(rel[0][0] - 1.0) > 1e-6 or abs(rel[2][2] - 1.0) > 1e-6:
            return None
        cx, half = rel[3][0] + float(item.SweptArea.Position.Location.Coordinates[0]), float(item.SweptArea.XDim) / 2.0
        z0 = rel[3][2] + _cs_axes(item.Position)[3][2]
        return cx - half, cx + half, z0, z0 + float(item.Depth)

    def slab_face(self, slab):
        """(area m², perimeter m, thickness m, (length, depth) m or None, upness) of a slab whose body is one IfcExtrudedAreaSolid of a
        profile without voids: the profile's area and perimeter in its own plane, the thickness at right angles to it, its sides when
        it is a rectangle along its axes, and the z of its plane's normal, which projects it to the ground; None for another form."""
        rep = getattr(slab, "Representation", None)
        bodies = [r for r in (rep.Representations if rep is not None else ()) if (r.RepresentationIdentifier or "") == "Body"]
        items = list(bodies[0].Items or ()) if len(bodies) == 1 else []
        m = _cs_placement(getattr(slab, "ObjectPlacement", None))
        if len(items) != 1 or not items[0].is_a("IfcExtrudedAreaSolid") or m is None or getattr(items[0].SweptArea, "InnerCurves", None):
            return None
        item = items[0]
        pts = [tuple(q) for q in _cs_profile_points(item.SweptArea)]
        if len(pts) > 3 and math.dist(pts[0], pts[-1]) < 1e-9:
            pts = pts[:-1]
        d = _cs_unit([float(c) for c in item.ExtrudedDirection.DirectionRatios])
        if len(pts) < 3 or d is None:
            return None
        s = self.scale
        ring = pts + pts[:1]
        area = abs(sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(ring, ring[1:]))) / 2.0 * s * s
        perimeter = sum(math.dist(p, q) for p, q in zip(ring, ring[1:])) * s
        rect = None
        if _cs_rectangle(pts):
            rect = ((max(p[0] for p in pts) - min(p[0] for p in pts)) * s, (max(p[1] for p in pts) - min(p[1] for p in pts)) * s)
        return area, perimeter, float(item.Depth) * abs(d[2]) * s, rect, abs(_cs_compose(m, _cs_axes(item.Position))[2][2])

    def qto_slab(self, slab):
        """A slab of one extruded profile (slab_face): Width its thickness, Perimeter, Length and Depth when the profile is a
        rectangle, the profile's area and the volume; Net as Gross when it has no openings (the write tools cut none in slabs)."""
        face = self.slab_face(slab)
        if face is None:
            return None
        area, perimeter, width, rect, _ = face
        values = {"Width": ("length", width), "Perimeter": ("length", perimeter), "GrossArea": ("area", area), "GrossVolume": ("volume", area * width)}
        if rect is not None:
            values.update({"Length": ("length", rect[0]), "Depth": ("length", rect[1])})
        if not (getattr(slab, "HasOpenings", None) or ()):
            values.update({"NetArea": ("area", area), "NetVolume": ("volume", area * width)})
        return values

    def qto_roof(self, roof):
        """A roof by its aggregated slabs (create_roof's form): GrossArea and NetArea the sum of their faces, ProjectedArea that sum
        projected to the ground; none when a part is of another form, and no NetArea when one has openings."""
        parts = [o for rel in (getattr(roof, "IsDecomposedBy", None) or ()) for o in (rel.RelatedObjects or ()) if o.is_a("IfcSlab")]
        faces = [self.slab_face(o) for o in parts]
        if not faces or any(f is None for f in faces):
            return None
        gross = sum(f[0] for f in faces)
        values = {"GrossArea": ("area", gross), "ProjectedArea": ("area", sum(f[0] * f[4] for f in faces))}
        if not any(getattr(o, "HasOpenings", None) for o in parts):
            values["NetArea"] = ("area", gross)
        return values

    def qto_filling(self, e):
        """A door or a window by OverallWidth and OverallHeight, which create_opening sets: Width, Height, Perimeter and Area."""
        w, h = getattr(e, "OverallWidth", None), getattr(e, "OverallHeight", None)
        if not w or not h:
            return None
        w, h = float(w) * self.scale, float(h) * self.scale
        return {"Width": ("length", w), "Height": ("length", h), "Perimeter": ("length", 2.0 * (w + h)), "Area": ("area", w * h)}

    def apply(self, ops):
        if not isinstance(ops, list):
            raise DataspatiumError("the change set must be a list of operations")
        if self.m.schema == "IFC2X3" and self.owner is None:
            raise DataspatiumError("the IFC2X3 file has no owner history to give new entities")
        previous = self.owner_settings()
        try:
            self.apply_all(ops)
            self.finish()
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

    MAX_PROPOSAL = 10000

    def proposal(self, base):
        """The changed elements against the base, in the form Dataregium takes as a change proposal (see _Proposal)."""
        p = _Proposal(base, self.m)
        for rec in list(self.changed.values()):
            p.element(rec["id"])
        return {"changes": p.changes[:self.MAX_PROPOSAL], "truncated": len(p.changes) > self.MAX_PROPOSAL, "instances": len(p.instances),
                "unexpressed": {"created": len(self.created), "deleted": len(self.deleted), "relations": p.unexpressed}}


class _Proposal:
    """The attribute-level form of a change, as Dataregium takes it in a BCF topic's snippet (DataregiumIfcChangeSet).

    Compares the instances that exist in both the base and the candidate, each change on one attribute of one instance named
    by the GlobalId of the nearest rooted entity and the path from it in IFC's attribute names with 0-based indexes (no path for
    the rooted entity itself), and by STEP id only when no GlobalId reaches the instance; the collision keys of the server's merge
    are then the same between clients (a project rule). A value is a scalar, a typed value ({"type", "value"}), an enumeration
    ({"enum"}), a reference (named by GlobalId and path the same way, {"step_id"} only when no GlobalId reaches it) or a list of
    them. A sub-instance that the
    candidate replaced with a new one of the same class (a moved placement's point) is told as changes of the old instance, with
    "copy" when others share it. What only new instances carry (created elements, new relationships, property sets and properties)
    cannot be said in this form and is counted as unexpressed.
    """

    DEPTH = 8
    SKIP = ("OwnerHistory", "Representation", "RepresentationMaps", "Items")
    MEMBERSHIPS = (("ContainedInStructure", "RelatedElements"), ("HasAssociations", "RelatedObjects"), ("IsDefinedBy", "RelatedObjects"),
                   ("Decomposes", "RelatedObjects"))

    def __init__(self, base, candidate):
        self.base = base
        self.cand = candidate
        self.changes = []
        self.unexpressed = 0
        self.instances = set()
        self.seen = set()

    @staticmethod
    def instance(v):
        import ifcopenshell
        return isinstance(v, ifcopenshell.entity_instance)

    def in_base(self, e):
        """The base instance with the same id and class, or None for an instance the candidate made."""
        if not self.instance(e) or e.id() == 0:
            return None
        try:
            b = self.base.by_id(e.id())
        except Exception:
            return None
        return b if b is not None and b.is_a() == e.is_a() else None

    def in_cand(self, b):
        try:
            c = self.cand.by_id(b.id())
        except Exception:
            return None
        return c if c is not None and c.is_a() == b.is_a() else None

    def same(self, a, b):
        if self.instance(a) or self.instance(b):
            if not (self.instance(a) and self.instance(b)):
                return False
            if a.id() == 0 or b.id() == 0:
                return a.id() == 0 and b.id() == 0 and a.is_a() == b.is_a() and a.wrappedValue == b.wrappedValue
            return a.id() == b.id()
        if isinstance(a, (tuple, list)) or isinstance(b, (tuple, list)):
            if not (isinstance(a, (tuple, list)) and isinstance(b, (tuple, list))) or len(a) != len(b):
                return False
            return all(self.same(x, y) for x, y in zip(a, b))
        return a == b

    def value(self, v, kind):
        """A value in the change set's form; raises KeyError for a reference to an instance the base does not have."""
        if v is None:
            return None
        if self.instance(v):
            if v.id() == 0:
                return {"type": v.is_a(), "value": _ifc_value(v.wrappedValue)}
            if self.in_base(v) is None:
                raise KeyError(v.id())
            return self.ref(self.in_base(v))
        if isinstance(v, (tuple, list)):
            return [self.value(x, kind) for x in v]
        if isinstance(v, str) and kind == "ENUMERATION":
            return {"enum": v}
        return _ifc_value(v)

    @staticmethod
    def guid_of(inst):
        try:
            return str(inst.GlobalId) if hasattr(inst, "GlobalId") and inst.GlobalId else None
        except Exception:
            return None

    def change(self, inst, attribute, op, old=None, new=None, copy=False, root=None, path=()):
        """A change of `inst`: named by the GlobalId `root` of the rooted entity the `path` leads from, by STEP id without one."""
        own = self.guid_of(inst)
        if own:
            rec = {"guid": own, "attribute": attribute, "op": op}
        elif root and path:
            rec = {"guid": root, "path": ".".join(path), "attribute": attribute, "op": op}
        else:
            rec = {"step_id": inst.id(), "attribute": attribute, "op": op}
            copy = False
        if op in ("set", "remove"):
            rec["old"] = old
        if op in ("set", "add"):
            rec["new"] = new
        if copy:
            rec["copy"] = True
        self.changes.append(rec)
        self.instances.add(inst.id())

    def shared(self, b):
        try:
            return len(self.base.get_inverse(b)) > 1
        except Exception:
            return False

    def diff(self, b, c, depth=0, copy=False, root=None, path=()):
        """The attributes of a base instance against its candidate, into the sub-instances it owns; `path` leads here from the rooted
        entity `root` (a rooted instance starts a path of its own)."""
        if b.id() in self.seen or depth > self.DEPTH:
            return
        self.seen.add(b.id())
        own = self.guid_of(b)
        if own:
            root, path = own, ()
        for i in range(len(b)):
            try:
                name, kind = b.attribute_name(i), b.attribute_type(i)
            except Exception:
                continue
            if kind == "DERIVED" or name in self.SKIP:
                continue
            try:
                bv, cv = b[i], c[i]
            except Exception:
                continue
            if self.instance(bv) and bv.id() != 0 and self.instance(cv) and cv.id() != 0 and bv.is_a() == cv.is_a() and not hasattr(bv, "GlobalId"):
                if cv.id() == bv.id():
                    self.diff(bv, cv, depth + 1, copy, root, path + (name,))
                elif self.in_base(cv) is None:
                    # replaced by a new instance of the same class: the old one's attributes, on a copy when others share it
                    self.diff(bv, cv, depth + 1, copy or self.shared(bv), root, path + (name,))
                else:
                    self.change(b, name, "set", old=self.ref(bv), new=self.ref(cv), copy=copy, root=root, path=path)
                continue
            if kind.startswith("AGGREGATE OF ENTITY INSTANCE") and isinstance(bv, (tuple, list)) and isinstance(cv, (tuple, list)):
                self.members(b, name, bv, cv, depth, copy, root, path)
                continue
            if self.same(bv, cv):
                continue
            try:
                self.change(b, name, "set", old=self.value(bv, kind), new=self.value(cv, kind), copy=copy, root=root, path=path)
            except KeyError:
                self.unexpressed += 1

    def ref(self, inst):
        """A base instance as a value: its own GlobalId, the GlobalId and path of a rooted entity that reaches it, or its STEP id."""
        guid = self.guid_of(inst)
        if guid:
            return {"guid": guid}
        found = self.locate(inst)
        return {"guid": found[0], "path": found[1]} if found else {"step_id": inst.id()}

    LOCATE_DEPTH = 6

    def locate(self, inst, depth=0, seen=None):
        """(GlobalId, path) of a rooted base entity whose forward attributes lead to `inst`, found backwards through the inverses."""
        seen = seen if seen is not None else set()
        if depth > self.LOCATE_DEPTH or inst.id() in seen:
            return None
        seen.add(inst.id())
        try:
            referrers = list(self.base.get_inverse(inst))
        except Exception:
            return None
        steps = []
        for r in referrers:
            segment = None
            for i in range(len(r)):
                try:
                    v = r[i]
                except Exception:
                    continue
                if self.instance(v) and v.id() == inst.id():
                    segment = r.attribute_name(i)
                elif isinstance(v, (tuple, list)):
                    for k, x in enumerate(v):
                        if self.instance(x) and x.id() == inst.id():
                            segment = "%s[%d]" % (r.attribute_name(i), k)
                            break
                if segment:
                    break
            if segment:
                steps.append((r, segment))
        # the rooted owner first (the storey's own ObjectPlacement), the longer way through other instances only without one
        for r, segment in steps:
            guid = self.guid_of(r)
            if guid:
                return guid, segment
        for r, segment in steps:
            up = self.locate(r, depth + 1, seen)
            if up:
                return up[0], up[1] + "." + segment
        return None

    def members(self, b, name, bv, cv, depth, copy, root=None, path=()):
        """An aggregate of instances: the members both have are compared, the others added or removed."""
        bids = {x.id(): x for x in bv if self.instance(x)}
        cids = {y.id(): y for y in cv if self.instance(y)}
        for i, x in enumerate(bv):
            if self.instance(x):
                if x.id() in cids:
                    if not hasattr(x, "GlobalId"):
                        self.diff(x, cids[x.id()], depth + 1, copy, root, path + ("%s[%d]" % (name, i),))
                else:
                    self.change(b, name, "remove", old=self.ref(x), copy=copy, root=root, path=path)
        for y in cv:
            if self.instance(y) and y.id() not in bids:
                if self.in_base(y) is None:
                    self.unexpressed += 1
                else:
                    self.change(b, name, "add", new=self.ref(y), copy=copy, root=root, path=path)

    def memberships(self, b, c):
        """The relationships the element is a member of (container, material, property sets, aggregate): changed membership."""
        for inverse, attribute in self.MEMBERSHIPS:
            brels = [r for r in (getattr(b, inverse, None) or ()) if self.instance(r)]
            crels = [r for r in (getattr(c, inverse, None) or ()) if self.instance(r)]
            bids = {r.id() for r in brels}
            cids = {r.id() for r in crels}
            for i, r in enumerate(brels):
                if r.id() not in cids:
                    self.change(r, attribute, "remove", old=self.ref(b))
                elif inverse == "IsDefinedBy" and getattr(r, "RelatingPropertyDefinition", None) is not None:
                    # a property set both have: its properties' values (the set is rooted, so its own GlobalId names them)
                    pd = r.RelatingPropertyDefinition
                    cpd = self.in_cand(pd)
                    if cpd is not None:
                        self.diff(pd, cpd, 1, False, self.guid_of(b), ("IsDefinedBy[%d]" % i, "RelatingPropertyDefinition"))
            for r in crels:
                if r.id() not in bids:
                    if self.in_base(r) is None:
                        self.unexpressed += 1
                    else:
                        self.change(r, attribute, "add", new=self.ref(b))

    def element(self, step_id):
        """A changed rooted element: its own attributes, its placement and its memberships."""
        try:
            b = self.base.by_id(int(step_id))
        except Exception:
            b = None
        c = self.in_cand(b) if b is not None else None
        if b is None or c is None:
            self.unexpressed += 1
            return
        self.diff(b, c)
        self.memberships(b, c)


def _ifc_integrity(model):
    """What breaks the model's relationships, keyed so that a base and its candidate can be compared: openings without a host,
    doors and windows without an opening, elements outside the spatial structure, and relationships with nothing on one side."""
    out = {}

    def add(kind, e, message):
        key = "%s:%s" % (kind, getattr(e, "GlobalId", None) or e.id())
        out[key] = {"level": "error", "kind": "integrity", "ifc_class": e.is_a(), "id": e.id(), "attribute": None, "message": message}

    for o in model.by_type("IfcOpeningElement"):
        if not (getattr(o, "VoidsElements", None) or ()):
            add("opening", o, "opening without a host element")
    for cls in ("IfcDoor", "IfcWindow"):
        for e in model.by_type(cls):
            if not (getattr(e, "FillsVoids", None) or ()):
                add("filling", e, "%s without an opening" % cls)
    for e in model.by_type("IfcElement"):
        if e.is_a("IfcFeatureElement"):
            continue
        if (getattr(e, "ContainedInStructure", None) or ()) or (getattr(e, "Decomposes", None) or ()) or (getattr(e, "FillsVoids", None) or ()):
            continue
        if getattr(e, "Nests", None):
            continue
        add("container", e, "element outside the spatial structure")
    for cls, attr in (("IfcRelContainedInSpatialStructure", "RelatedElements"), ("IfcRelAggregates", "RelatedObjects"),
                      ("IfcRelDefinesByProperties", "RelatedObjects"), ("IfcRelAssociatesMaterial", "RelatedObjects"),
                      ("IfcRelDefinesByType", "RelatedObjects")):
        try:
            rels = model.by_type(cls)
        except Exception:
            continue
        for r in rels:
            if not (getattr(r, attr, None) or ()):
                add("empty", r, "%s with no %s" % (cls, attr))
    return out


# ---- the building's topology (decision F46 a) -------------------------------------------------------
# The walls' centrelines per storey become rooms with shapely (which comes with IfcOpenShell): the line ends are snapped to each
# other within a tolerance, the lines noded and polygonized. Rooms that share a stretch of boundary border each other, the walls
# along the rooms' union are the external walls with the compass sector they face, and the lines' free ends are the open ends
# that a closed storey cannot have. Lengths are metres, coordinates the model's plan.

TOPOLOGY_MAX_WALLS = 2000
TOPOLOGY_MIN_ROOM = 0.5  # m²; smaller polygons are slivers between lines, not rooms
TOPOLOGY_MIN_WIDTH = 0.5  # m; so are narrower ones, such as the gap between the layers of a wall
_FACINGS = ("N", "NE", "E", "SE", "S", "SW", "W", "NW")


def _topo_north(model):
    """(a, b, source): the model's plan turned to the map, east = a*dx - b*dy and north = b*dx + a*dy. From IfcMapConversion's
    XAxisAbscissa and XAxisOrdinate when the file has one (it takes precedence over TrueNorth, as IFC 4.3 says), else from the
    model context's TrueNorth, else the model's +y is north."""
    contexts = [c for c in model.by_type("IfcGeometricRepresentationContext") if not c.is_a("IfcGeometricRepresentationSubContext")]
    context = next((c for c in contexts if (c.ContextType or "Model") == "Model"), contexts[0] if contexts else None)
    try:
        conversions = model.by_type("IfcMapConversion")
    except Exception:  # IFC2X3 has no IfcMapConversion
        conversions = []
    own = [c for c in conversions if context is not None and c.SourceCRS is not None and c.SourceCRS.id() == context.id()]
    conversion = own[0] if own else (conversions[0] if len(conversions) == 1 else None)
    if conversion is not None:
        a = 1.0 if conversion.XAxisAbscissa is None else float(conversion.XAxisAbscissa)
        b = 0.0 if conversion.XAxisOrdinate is None else float(conversion.XAxisOrdinate)
        if math.hypot(a, b) > 0:
            return a / math.hypot(a, b), b / math.hypot(a, b), "map"
    north = getattr(context, "TrueNorth", None) if context is not None else None
    if north is not None:
        r = [float(v) for v in north.DirectionRatios] + [0.0, 0.0]
        if math.hypot(r[0], r[1]) > 0:
            return r[1] / math.hypot(r[0], r[1]), r[0] / math.hypot(r[0], r[1]), "true_north"
    return 1.0, 0.0, "model"


def _topo_point(p):
    """A shapely point of (x, y)."""
    from shapely.geometry import Point
    return Point(float(p[0]), float(p[1]))


def _topo_facing(dx, dy, north):
    """The compass sector (N, NE, ... NW) a direction in the plan points to."""
    a, b = north[0], north[1]
    bearing = math.degrees(math.atan2(a * dx - b * dy, b * dx + a * dy)) % 360.0
    return _FACINGS[int((bearing + 22.5) // 45.0) % 8]


def _topo_curve(item):
    """The (x, y) points of an axis curve in its own coordinates: an IfcPolyline, an IfcIndexedPolyCurve or an IfcTrimmedCurve of an
    IfcLine; None for another curve."""
    if item.is_a("IfcPolyline"):
        return [(float(p.Coordinates[0]), float(p.Coordinates[1])) for p in item.Points]
    if item.is_a("IfcIndexedPolyCurve"):
        coords = [(float(c[0]), float(c[1])) for c in item.Points.CoordList]
        if not getattr(item, "Segments", None):
            return coords
        out = []
        for segment in item.Segments:
            for i in segment.wrappedValue:
                if not out or out[-1] != coords[int(i) - 1]:
                    out.append(coords[int(i) - 1])
        return out
    if item.is_a("IfcTrimmedCurve") and item.BasisCurve.is_a("IfcLine"):
        line = item.BasisCurve
        p0 = [float(v) for v in line.Pnt.Coordinates]
        o = [float(v) for v in line.Dir.Orientation.DirectionRatios]
        step = float(line.Dir.Magnitude) / (math.sqrt(sum(v * v for v in o)) or 1.0)

        def at(trim):
            for t in trim:
                if hasattr(t, "is_a") and t.is_a("IfcCartesianPoint"):
                    return float(t.Coordinates[0]), float(t.Coordinates[1])
            for t in trim:
                u = float(getattr(t, "wrappedValue", t))  # an IfcParameterValue along the line
                return p0[0] + u * step * o[0], p0[1] + u * step * o[1]
            return None
        ends = at(item.Trim1), at(item.Trim2)
        return list(ends) if ends[0] and ends[1] else None
    return None


def _topo_axis(wall, scale):
    """The wall's 'Axis' representation in plan, in metres in world coordinates through its placement; None without one."""
    import ifcopenshell.util.placement as placement
    rep = getattr(wall, "Representation", None)
    for r in (rep.Representations if rep is not None else ()):
        if (r.RepresentationIdentifier or "") != "Axis":
            continue
        for item in (r.Items or ()):
            pts = _topo_curve(item)
            if pts and len(pts) >= 2:
                m = placement.get_local_placement(wall.ObjectPlacement)
                return [((m[0][0] * x + m[0][1] * y + m[0][3]) * scale, (m[1][0] * x + m[1][1] * y + m[1][3]) * scale) for x, y in pts]
    return None


def _topo_thickness(wall, scale):
    """The wall's thickness in metres: the narrow side of an extruded rectangle, else its material layers; None when unknown."""
    rep = getattr(wall, "Representation", None)
    for r in (rep.Representations if rep is not None else ()):
        for item in (r.Items or ()):
            if item.is_a("IfcExtrudedAreaSolid") and item.SweptArea.is_a("IfcRectangleProfileDef"):
                return min(float(item.SweptArea.XDim), float(item.SweptArea.YDim)) * scale
    try:
        import ifcopenshell.util.element as el
        mat = el.get_material(wall)
        layers = mat.ForLayerSet if mat is not None and mat.is_a("IfcMaterialLayerSetUsage") else mat
        if layers is not None and layers.is_a("IfcMaterialLayerSet"):
            return sum(float(x.LayerThickness or 0) for x in layers.MaterialLayers) * scale or None
    except Exception:
        pass
    return None


def _topo_settings():
    import ifcopenshell.geom
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    try:
        settings.set("disable-opening-subtractions", True)  # the footprint needs no openings, and the booleans are slow
    except Exception:
        pass
    return settings


def _topo_footprint(wall, settings):
    """(centreline, width) from the body's footprint: its vertices (world coordinates, metres) projected to the plan, their minimum
    rotated rectangle and its long axis."""
    import ifcopenshell.geom
    import ifcopenshell.util.shape as shape_util
    import shapely
    verts = shape_util.get_vertices(ifcopenshell.geom.create_shape(settings, wall).geometry)
    if len(verts) < 2:
        return None, None
    rect = shapely.oriented_envelope(shapely.MultiPoint([(float(v[0]), float(v[1])) for v in verts]))
    if rect.geom_type == "LineString":
        return [rect.coords[0], rect.coords[-1]], 0.0
    if rect.geom_type != "Polygon" or rect.is_empty:
        return None, None
    c = list(rect.exterior.coords)

    def mid(p, q):
        return (p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0
    if math.dist(c[0], c[1]) >= math.dist(c[1], c[2]):
        return [mid(c[0], c[3]), mid(c[1], c[2])], math.dist(c[1], c[2])
    return [mid(c[0], c[1]), mid(c[3], c[2])], math.dist(c[0], c[1])


def _topo_cross(p, d, a, b):
    """(t, x): where the line through p along the unit vector d crosses the line through a and b, p + t * d; None when parallel."""
    rx, ry = b[0] - a[0], b[1] - a[1]
    den = d[0] * ry - d[1] * rx
    if abs(den) < 1e-9 * (math.hypot(rx, ry) or 1.0):
        return None
    t = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / den
    return t, (round(p[0] + t * d[0], 6), round(p[1] + t * d[1], 6))


def _topo_pairs(pts, radius):
    """The pairs (distance, a, b) of points at most radius apart, closest first, found on a grid of cells radius wide."""
    cells = {}
    size = max(radius, 1e-6)
    out = []
    for n, p in enumerate(pts):
        cx, cy = math.floor(p[0] / size), math.floor(p[1] / size)
        for cell in [(cx + dx, cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]:
            out.extend((math.dist(pts[m], p), m, n) for m in cells.get(cell, ()) if math.dist(pts[m], p) <= radius)
        cells.setdefault((cx, cy), []).append(n)
    return sorted(out)


def _topo_snap(lines, tol, widths=None):
    """The lines with their ends snapped, in three steps. Ends that coincide within a centimetre meet at their mean. Another end goes
    along its own line, extended or trimmed, to the nearest crossing with a line near it (a T junction; or a corner, where that
    line's free end goes there too, as when both walls of a corner stop at the other's face), moving at most half the thickness of
    the wall it meets plus 0.05 m, and never more than tol. Ends still free pair up within tol, closest first, unless their walls run
    side by side as the layers of a wall do. A point that lands inside a line is inserted in it, so that noding joins the two exactly."""
    from shapely.geometry import LineString, Point
    from shapely.strtree import STRtree
    out = [[(round(float(c[0]), 6), round(float(c[1]), 6)) for c in line] for line in lines]
    reach = [min(tol, float(w or 0.2) / 2.0 + 0.05) for w in (widths or [None] * len(out))]
    ends = [(i, k) for i in range(len(out)) for k in (0, -1)]

    def end(m):
        return out[ends[m][0]][ends[m][1]]

    def direction(m):
        """The unit vector along the line out of its end m, or None."""
        i, k = ends[m]
        p, q = out[i][k], (out[i][1] if k == 0 else out[i][-2])
        n = math.dist(p, q)
        return ((p[0] - q[0]) / n, (p[1] - q[1]) / n) if n > 0 else None

    def meet(group):
        mean = (round(sum(end(m)[0] for m in group) / len(group), 6), round(sum(end(m)[1] for m in group) / len(group), 6))
        for m in group:
            out[ends[m][0]][ends[m][1]] = mean

    parent = list(range(len(ends)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for _, a, b in _topo_pairs([end(m) for m in range(len(ends))], 0.01):
        parent[find(a)] = find(b)
    groups = {}
    for m in range(len(ends)):
        groups.setdefault(find(m), []).append(m)
    free = {g[0] for g in groups.values() if len(g) == 1}
    for g in groups.values():
        if len(g) > 1:
            meet(g)
    geoms = [LineString(c) for c in out]
    tree = STRtree(geoms)
    inserted = {}
    for m in sorted(free):
        d = direction(m)
        if m not in free or d is None:
            continue  # taken to a corner by the other wall's end, or a line without length
        i, k = ends[m]
        p = end(m)
        best = None
        for j in (int(x) for x in tree.query(Point(p).buffer(2.0 * tol)) if int(x) != i):
            for a, b in zip(out[j], out[j][1:]):
                hit = _topo_cross(p, d, a, b)
                if hit is None or abs(hit[0]) > reach[j] or (best is not None and abs(hit[0]) >= best[0]):
                    continue
                corner = None
                off = LineString([a, b]).distance(Point(hit[1]))
                if off > 1e-6:  # beyond the other line's end: a corner, when that end is free and near enough
                    corner = 2 * j + (0 if math.dist(hit[1], out[j][0]) < math.dist(hit[1], out[j][-1]) else 1)
                    if off > reach[i] or corner not in free:
                        continue
                best = (abs(hit[0]), j, hit[1], corner)
        if best is None:
            continue
        _, j, x, corner = best
        free.discard(m)
        out[i][k] = x
        if corner is None:
            inserted.setdefault(j, []).append(x)
        else:
            free.discard(corner)
            out[j][ends[corner][1]] = x
    left = sorted(free)
    for _, a, b in _topo_pairs([end(m) for m in left], tol):
        ma, mb = left[a], left[b]
        if ma not in free or mb not in free:
            continue
        da, db = direction(ma), direction(mb)
        pa, pb = end(ma), end(mb)
        if da and db and abs(da[0] * db[1] - da[1] * db[0]) < 0.17 and abs((pb[0] - pa[0]) * da[1] - (pb[1] - pa[1]) * da[0]) > 0.05:
            continue  # parallel within 10 degrees and side by side
        free.difference_update((ma, mb))
        meet([ma, mb])
    for j, points in inserted.items():
        first, last = out[j][0], out[j][-1]
        inner = sorted(set(out[j][1:-1]) | set(points), key=lambda c: geoms[j].project(Point(c)))
        out[j] = [first] + [c for c in inner if c != first and c != last] + [last]
    return out


def _topo_outward(union, part, tol, north):
    """The compass sector a wall along the rooms' union faces: the normal of its longest piece there that points out of the rooms."""
    from shapely.geometry import Point
    pieces = [g for g in getattr(part, "geoms", [part]) if g.geom_type == "LineString" and g.length > 0]
    if not pieces:
        return None
    piece = max(pieces, key=lambda g: g.length)
    (x0, y0), (x1, y1) = piece.coords[0][:2], piece.coords[-1][:2]
    n = math.hypot(x1 - x0, y1 - y0)
    if n == 0:
        return None
    nx, ny = -(y1 - y0) / n, (x1 - x0) / n
    mid = piece.interpolate(0.5, normalized=True)
    for eps in (0.05, tol + 0.05):
        left = union.covers(Point(mid.x + nx * eps, mid.y + ny * eps))
        right = union.covers(Point(mid.x - nx * eps, mid.y - ny * eps))
        if left != right:
            return _topo_facing(-nx, -ny, north) if left else _topo_facing(nx, ny, north)
    return None


def _topo_plan(walls, tol, north=(1.0, 0.0, "model"), shapes=False):
    """One storey's plan from its walls' centrelines, with shapely alone: `walls` are dicts {"id", "guid", "name", "line": [(x, y),
    ...], "width"} in metres (width may be None). Rooms are the polygons over TOPOLOGY_MIN_ROOM and TOPOLOGY_MIN_WIDTH. A wall
    belongs to a room, and is external, when it runs along the room's boundary (or the union's) for longer than one that only meets
    it there; two rooms are neighbours when their boundaries share such a stretch. With shapes, every room also has its "polygon"
    (shapely, counter-clockwise) and its "net_area" inside the walls' faces, for create_spaces; neither goes into JSON."""
    from shapely.geometry import LineString
    from shapely.geometry.polygon import orient
    from shapely.ops import polygonize_full, unary_union
    from shapely.strtree import STRtree
    snapped = _topo_snap([w["line"] for w in walls], tol, [w.get("width") for w in walls])
    keep = [i for i, c in enumerate(snapped) if LineString(c).length > 1e-6]
    if not keep:
        return {"rooms": [], "external": [], "dangles": [], "closed": False}
    walls = [walls[i] for i in keep]
    geoms = [LineString(snapped[i]) for i in keep]
    noded = unary_union(geoms)
    edges = [g for g in getattr(noded, "geoms", [noded]) if g.geom_type == "LineString"]
    degree = {}
    for e in edges:
        for c in (e.coords[0], e.coords[-1]):
            key = (round(c[0], 6), round(c[1], 6))
            degree[key] = degree.get(key, 0) + 1
    dangles = sorted([round(x, 3), round(y, 3)] for (x, y), n in degree.items() if n == 1)
    polygons = list(polygonize_full(edges)[0].geoms)
    rooms = sorted((p for p in polygons if p.area > TOPOLOGY_MIN_ROOM and not p.buffer(-TOPOLOGY_MIN_WIDTH / 2.0).is_empty),
                   key=lambda p: (round(p.centroid.y), round(p.centroid.x, 6), -round(p.area, 6)))  # a room around another comes first
    tree = STRtree(geoms)
    meets = 2.0 * tol + 0.01  # a wall that only meets a boundary runs at most 2 * tol inside its buffer

    def along(zone):
        out = []
        for j in tree.query(zone):
            part = geoms[int(j)].intersection(zone)
            if part.length > meets:
                out.append((int(j), part))
        return out

    neighbours = [set() for _ in rooms]
    room_tree = STRtree(rooms)
    for i, r in enumerate(rooms):
        for k in (int(x) for x in room_tree.query(r)):
            if k > i and r.boundary.intersection(rooms[k].boundary).length > meets:
                neighbours[i].add(k)
                neighbours[k].add(i)
    out_rooms = []
    for i, r in enumerate(rooms):
        members = along(r.boundary.buffer(tol))
        rec = {"index": i + 1, "area": round(r.area, 2), "perimeter": round(r.length, 2), "walls": sorted({walls[j]["id"] for j, _ in members}),
               "neighbours": sorted(k + 1 for k in neighbours[i])}
        if shapes:
            # inside the faces: the outline less a band of half each wall's thickness along it
            bands = unary_union([geoms[j].buffer(float(walls[j].get("width") or 0.2) / 2.0, cap_style="flat") for j, _ in members])
            rec["polygon"], rec["net_area"] = orient(r, sign=1.0), r.difference(bands).area
        out_rooms.append(rec)
    external = []
    if rooms:
        union = unary_union(polygons)  # with the slivers between the layers of a wall, which are inside too
        for j, part in along(union.boundary.buffer(tol)):
            facing = _topo_outward(union, part, tol, north)
            if facing:
                external.append({"wall": walls[j]["id"], "guid": walls[j].get("guid"), "name": walls[j].get("name"), "facing": facing, "length": round(part.length, 2)})
        external.sort(key=lambda e: (_FACINGS.index(e["facing"]), e["wall"]))
    return {"rooms": out_rooms, "external": external, "dangles": dangles, "closed": bool(rooms) and not dangles}


def _topo_elevation(storey, scale):
    if storey.Elevation is not None:
        return float(storey.Elevation) * scale
    try:
        import ifcopenshell.util.placement as placement
        return float(placement.get_local_placement(storey.ObjectPlacement)[2][3]) * scale
    except Exception:
        return 0.0


def _ifc_topology(model, tolerance=None, storeys=None, shapes=False):
    """The building's topology per storey (decision F46 a), as a list in the storeys' order of elevation:

        {"storey", "elevation" (m), "rooms": [{"index" (from 1), "area" (m²), "perimeter" (m), "walls": [wall ids], "neighbours":
         [room indices]}], "external": [{"wall", "guid", "name", "facing" (N, NE, E, SE, S, SW, W, NW), "length" (m)}], "dangles":
         [[x, y], ...] (open wall ends, metres), "closed" (at least one room and nothing dangles), "walls" (on the storey), "unread"
         (walls whose centreline could not be read), "tolerance" (m), "north" (map, true_north or model)}

    A wall's centreline is its 'Axis' representation through its placement, else the long axis of its body's footprint
    (ifcopenshell.geom). The ends are snapped within `tolerance` metres (by default half the storey's thickest wall plus 0.05 m).
    `storeys` (names) limits the storeys read. At most TOPOLOGY_MAX_WALLS walls. With shapes (for create_spaces, never for JSON) the
    rooms carry their polygons and net areas (_topo_plan) and every storey its entity as "_storey".
    """
    import ifcopenshell.util.unit
    try:
        scale = float(ifcopenshell.util.unit.calculate_unit_scale(model) or 1.0)  # metres per file unit
    except Exception:
        scale = 1.0
    north = _topo_north(model)
    chosen = []
    for s in model.by_type("IfcBuildingStorey"):
        if storeys is not None and _ifc_text(s.Name) not in storeys:
            continue
        chosen.append((s, [e for rel in (getattr(s, "ContainsElements", None) or ()) for e in (rel.RelatedElements or ()) if e.is_a("IfcWall")]))
    total = sum(len(walls) for _, walls in chosen)
    if total > TOPOLOGY_MAX_WALLS:
        raise DataspatiumError("the topology reads at most %d walls; there are %d" % (TOPOLOGY_MAX_WALLS, total))
    settings = None
    out = []
    for s, walls in sorted(chosen, key=lambda x: _topo_elevation(x[0], scale)):
        read, widths, unread = [], [], 0
        for w in walls:
            try:
                line = _topo_axis(w, scale)
                width = _topo_thickness(w, scale) if line else None
            except Exception:
                line = None
            if not line:
                try:
                    if settings is None:
                        settings = _topo_settings()
                    line, width = _topo_footprint(w, settings)
                except Exception:
                    line = None
            if not line or math.dist(line[0], line[-1]) <= 1e-6:
                unread += 1
                continue
            read.append({"id": w.id(), "guid": getattr(w, "GlobalId", None), "name": _ifc_text(getattr(w, "Name", None)), "line": line, "width": width})
            if width:
                widths.append(width)
        tol = float(tolerance) if tolerance else max([x for x in widths if x <= 1.0] or [0.2]) / 2.0 + 0.05
        rec = {"storey": _ifc_text(s.Name), "elevation": round(_topo_elevation(s, scale), 3)}
        rec.update(_topo_plan(read, tol, north, shapes))
        rec.update({"walls": len(walls), "unread": unread, "tolerance": round(tol, 3), "north": north[2]})
        if shapes:
            rec["_storey"] = s
        out.append(rec)
    return out


def _ifc_changeset(in_file, changeset_json, out_file):
    """The recipe step "AI-ändring": a change set's operations on the model, checked against the schema and written as IFC.

    Called by the app with the dataset as a SQLite file (also for the preview, which never touches the dataset). Returns the
    report: what was created (with refs), changed and deleted, the schema findings and what the change set broke in the model's
    relationships (new against the base, counted as errors), counts for the log, the changes of
    existing instances in Dataregium's proposal form (`proposal`), `notes` about what an operation could not do in the
    file's schema (the map conversion in IFC2X3), and the candidate's `topology` (_ifc_topology) on the storeys of the walls the
    change set created, changed or deleted, or {"error"} when it could not be computed.
    """
    file_name, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "changeset-in.ifc"), data)
    ops = json.loads(changeset_json or "[]")
    cs = _ChangeSet(model)
    cs.apply(ops)
    findings, errors = cs.findings()
    model.write(out_file)
    # The base opened once more: the old values for the proposal are the file's, and only what the change set broke counts.
    base = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "changeset-base.ifc"), data)
    try:
        before = _ifc_integrity(base)
        broken = [f for key, f in _ifc_integrity(model).items() if key not in before]
    except Exception as exc:
        broken = [{"level": "error", "kind": "integrity", "ifc_class": None, "id": None, "attribute": None, "message": "integrity check failed: %s" % exc}]
    findings = broken[:20] + findings
    errors += len(broken)
    try:
        proposal = cs.proposal(base)
    except Exception as exc:
        proposal = {"changes": [], "truncated": False, "instances": 0, "unexpressed": {"created": len(cs.created), "deleted": len(cs.deleted), "relations": 0}, "error": str(exc)}
    # Only the storeys whose walls the change set touched: a preview of other changes on a large model stays quick.
    storeys = {r.get("storey") for r in cs.created + list(cs.changed.values()) + cs.deleted if str(r.get("ifc_class") or "").startswith("IfcWall")}
    try:
        topology = _ifc_topology(model, storeys=storeys) if storeys else []
    except Exception as exc:
        topology = {"error": str(exc) or type(exc).__name__}
    return json.dumps({"elements": len(model.by_type("IfcElement")), "entities": len(list(model)), "file": file_name, "operations": len(ops),
                       "created": cs.created, "changed": list(cs.changed.values()), "deleted": cs.deleted, "findings": findings, "errors": errors,
                       "proposal": proposal, "notes": cs.notes, "topology": topology},
                      ensure_ascii=False, default=str)


def _ifc_topology_file(in_file, out_file):
    """The topology (_ifc_topology) of the model kept in a dataset file, for the read tool get_topology and the card Topologi in
    Kontrollera: the original IFC is read from the SQLite file, and the JSON list is written to out_file and returned."""
    _, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "topology-in.ifc"), data)
    text = json.dumps(_ifc_topology(model), ensure_ascii=False, default=str)
    with open(out_file, "w", encoding="utf-8") as fh:
        fh.write(text)
    return text


# The schemas a new model can be written in (OB-06): the newest first, which is the default.
IFC_NEW_SCHEMAS = ("IFC4X3_ADD2", "IFC4", "IFC2X3")


def _ifc_new_owner(model):
    """IFC2X3 needs an owner history on every IfcRoot: the application as its own user, with no person's name."""
    import time
    import ifcopenshell.api.owner
    organisation = ifcopenshell.api.owner.add_organisation(model, identification="Dataspatium", name="Dataspatium")
    person = ifcopenshell.api.owner.add_person(model, identification="user", family_name="User", given_name="")
    user = ifcopenshell.api.owner.add_person_and_organisation(model, person=person, organisation=organisation)
    application = ifcopenshell.api.owner.add_application(model, application_developer=organisation, version="3",
                                                         application_full_name="Dataspatium", application_identifier="Dataspatium")
    return model.createIfcOwnerHistory(OwningUser=user, OwningApplication=application, ChangeAction="ADDED", CreationDate=int(time.time()))


def _ifc_new_model(schema, settings_json, out_file):
    """A new, empty building model (OB-06): a project with metre units and the model contexts, a site, a building and a
    first storey, written in the schema chosen (IFC4X3_ADD2 by default, IFC4 or IFC2X3).

    The names come from settings_json ({"project", "site", "building", "storey", "elevation"}); the storeys, walls and the rest
    are added afterwards by Ändra med AI, whose change sets work on this file like on any other. Returns the report: the schema,
    the counts and the schema check's findings.
    """
    import ifcopenshell.api.aggregate
    import ifcopenshell.api.context
    import ifcopenshell.api.project
    import ifcopenshell.api.unit
    import ifcopenshell.guid
    schema = str(schema or IFC_NEW_SCHEMAS[0]).upper()
    if schema not in IFC_NEW_SCHEMAS:
        raise DataspatiumError("unknown schema %r; choose one of %s" % (schema, ", ".join(IFC_NEW_SCHEMAS)))
    opts = json.loads(settings_json or "{}")

    def name(key, default):
        value = str(opts.get(key) or "").strip()
        return value[:255] if value else default

    model = ifcopenshell.api.project.create_file(version=schema)
    owner = _ifc_new_owner(model) if schema == "IFC2X3" else None
    project = model.create_entity("IfcProject", GlobalId=ifcopenshell.guid.new(), Name=name("project", "Project"))
    if owner is not None:
        project.OwnerHistory = owner
    units = [ifcopenshell.api.unit.add_si_unit(model, unit_type=kind) for kind in ("LENGTHUNIT", "AREAUNIT", "VOLUMEUNIT", "PLANEANGLEUNIT")]
    cs = _ChangeSet(model)
    previous = cs.owner_settings()
    try:
        ifcopenshell.api.unit.assign_unit(model, units=units)
        context = ifcopenshell.api.context.add_context(model, context_type="Model")
        ifcopenshell.api.context.add_context(model, context_type="Model", context_identifier="Body", target_view="MODEL_VIEW", parent=context)
        site = cs.root("IfcSite", name("site", "Site"))
        site.CompositionType = "ELEMENT"
        site.ObjectPlacement = cs.placement(None, 0, 0, 0)
        ifcopenshell.api.aggregate.assign_object(model, products=[site], relating_object=project)
        building = cs.root("IfcBuilding", name("building", "Building"))
        building.CompositionType = "ELEMENT"
        building.ObjectPlacement = cs.placement(site.ObjectPlacement, 0, 0, 0)
        ifcopenshell.api.aggregate.assign_object(model, products=[building], relating_object=site)
    finally:
        cs.restore_owner_settings(previous)
    cs.scale = 1.0
    cs.apply([{"tool": "create_storeys_and_grid", "storeys": [{"name": name("storey", "Level 1"), "elevation": _cs_num(opts, "elevation", 0.0)}]}])
    findings, errors = cs.findings()
    os.makedirs(os.path.dirname(out_file) or ".", exist_ok=True)
    model.write(out_file)
    return json.dumps({"schema": model.schema_identifier if hasattr(model, "schema_identifier") else schema, "entities": len(list(model)),
                       "storeys": len(model.by_type("IfcBuildingStorey")), "findings": findings[:20], "errors": errors},
                      ensure_ascii=False, default=str)
