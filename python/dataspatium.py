# Dataspatium Python helpers, imported into every Python session (``from dataspatium import *``).
# User documentation (Swedish): docs/python.md.
#
# Datasets are exchanged with the app as SQLite files in /data (see docs/format.md for the schema):
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
           "theme_dataspatium", "dm_setup", "DataspatiumError"]

DATA_DIR = "/data"
OUT_DIR = "/data/out"
PALETTE = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#56B4E9", "#CC79A7", "#F0E442", "#7F7F7F"]
_state = {"lang": "sv", "figures": {}, "plot_seq": 0, "mpl_setup": False}


class DataspatiumError(Exception):
    """An error with a message in the app's language."""


# ---- user-facing messages in the six UI languages (sv is the fallback) -------------------------

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
