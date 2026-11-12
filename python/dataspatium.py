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

def dm_setup(lang="sv", version=None):
    """Called once by the app after Python has started. lang: sv, da, nb, fi, is or en; version: the app's (src/platform/registry.js),
    which the IFC files the app writes name in their header (_ifc_header)."""
    if isinstance(lang, str) and lang in MESSAGES:
        _state["lang"] = lang
    if isinstance(version, str) and version.strip():
        _state["version"] = version.strip()
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
    _ifc_header(model, info.get("file") or (str(name) + ".ifc"))
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
    ids.validate(m, should_filter_version=True)  # a specification applies only to the IFC versions it names
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
    _ifc_header(out, file_name)
    out.write(out_file)
    return json.dumps({"elements": len(out.by_type("IfcElement")), "entities": len(list(out)), "file": file_name, "name": name})


def _ifc_apply(in_file, table_file, key, out_file):
    """The recipe step "Skriv tabell till modellen": a table's values into the model with dm_ifc_set(), written as IFC."""
    file_name, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "apply-in.ifc"), data)
    df = _read_file(table_file)
    changed = dm_ifc_set(model, df, key=key or "guid")
    _ifc_header(model, file_name)
    model.write(out_file)
    return json.dumps({"changed": changed, "rows": int(len(df)), "file": file_name})


# ---- the change set of "Ändra med AI" ---------------------------------------------------------
# The AI's write tools never touch the model themselves: they fill a change set (a JSON list of operations) that the person
# previews and approves in the app; only then does _ifc_changeset() apply it, as a recipe step with undo. Lengths are metres and
# are scaled to the file's unit. A created element gets a ref ("new-1", "new-2", ...) in the order of the operations
# create_wall, create_slab, create_roof and create_opening, so that a later operation can name it before the file has given it an id;
# so does the type of define_type, which create_wall, create_slab and create_roof name as their type, and the element of create_element,
# which create_element names as part_of or host and whose type is a define_type ref as well.


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


# SWEREF 99's twelve local zones in the order of their EPSG codes 3007 to 3018; the compound codes with RH 2000 heights follow the
# same order: 5845 is SWEREF 99 TM + RH 2000 (3006) and 5846 to 5857 the local zones + RH 2000 (3007 to 3018).
CS_SWEREF_ZONES = ("12 00", "13 30", "15 00", "16 30", "18 00", "14 15", "15 45", "17 15", "18 45", "20 15", "21 45", "23 15")
CS_COMPOUND_RH2000 = (5845, 5857)
CS_RH2000 = "RH 2000"


def _cs_crs_plan(code):
    """The projected code of a compound code with RH 2000 (5845 to 5857 give 3006 to 3018), any other code as it is."""
    return code - 2839 if CS_COMPOUND_RH2000[0] <= code <= CS_COMPOUND_RH2000[1] else code


def _cs_crs_height(code):
    """The height system a compound EPSG code gives (RH 2000 for 5845 to 5857), None for a projected code without heights."""
    return CS_RH2000 if CS_COMPOUND_RH2000[0] <= code <= CS_COMPOUND_RH2000[1] else None


def _cs_crs_vertical(code, given=None):
    """IfcProjectedCRS.VerticalDatum: None when the code gives the height system itself (the compound codes), else the one given,
    else RH 2000 for SWEREF 99 (3006 to 3018), Sweden's height system, else None."""
    if _cs_crs_height(code):
        return None
    if given and str(given).strip():
        return str(given).strip()[:255]
    return CS_RH2000 if 3006 <= code <= 3018 else None


def _cs_crs_description(code, vertical=None):
    """IfcProjectedCRS.Description in plain words, such as 'SWEREF 99 18 00 + RH 2000' or 'ETRS89 / UTM zone 32N', with the height
    system of the code or the vertical datum; None for a code outside the table of _cs_crs_facts."""
    datum, projection, zone = _cs_crs_facts("EPSG:%d" % _cs_crs_plan(code))
    if datum is None:
        return None
    if datum == "SWEREF99":
        text = "SWEREF 99 %s" % zone
    else:
        text = "%s / %s" % ({"WGS84": "WGS 84"}.get(datum, datum), zone.replace("UTM ", "UTM zone ") if zone else projection)
    height = _cs_crs_height(code) or vertical
    return "%s + %s" % (text, height) if height else text


def _cs_crs_facts(crs):
    """The datum, projection and zone an EPSG code stands for, for the projected systems the Nordic countries draw in (and the
    compound codes of SWEREF 99 with RH 2000, whose plan is the projected code's); (None, None, None) for a code outside the table.
    IFC4 requires the datum on IfcProjectedCRS, IFC4X3 does not."""
    code = _cs_crs_plan(int(crs[5:]))
    if code == 3006:
        return "SWEREF99", "Transverse Mercator", "TM"
    if 3007 <= code <= 3018:
        return "SWEREF99", "Transverse Mercator", CS_SWEREF_ZONES[code - 3007]
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


_PSET_TEMPLATES = {}
# The units a value might carry after its number ("40 dB"), in lower case without spaces. A value never carries its unit: IFC gives
# a property its unit (the Praxi study, recommendation 8; the native IFC study, recommendation 13).
_CS_UNITS = frozenset((
    "mm", "cm", "dm", "m", "km", "mm2", "cm2", "dm2", "m2", "km2", "mm²", "cm²", "dm²", "m²", "km²", "mm3", "cm3", "dm3", "m3", "mm³", "cm³",
    "dm³", "m³", "l", "liter", "litre", "g", "kg", "t", "ton", "n", "kn", "pa", "kpa", "mpa", "gpa", "db", "dba", "db(a)", "w", "kw", "mw",
    "wh", "kwh", "mwh", "w/m2k", "w/m²k", "w/(m2k)", "w/(m²k)", "w/m2,k", "w/m²,k", "w/(m2·k)", "w/(m²·k)", "w/m²·k", "w/mk", "w/(mk)",
    "w/m·k", "w/(m·k)", "m2k/w", "m²k/w", "°c", "°", "deg", "k", "%", "h", "min", "s", "l/s", "m3/h", "m³/h", "m3/s", "m³/s", "kg/m3",
    "kg/m³", "kg/m2", "kg/m²", "kg/m", "lux", "lx", "st", "pcs", "kr", "sek", "nok", "dkk", "isk", "eur", "kgco2e", "kgco2-ekv"))


def _cs_pset_templates(schema):
    """IfcOpenShell's property and quantity set templates of a schema (as in file.schema_identifier) by their names in lower case;
    empty when it has none."""
    key = str(schema)
    if key not in _PSET_TEMPLATES:
        try:
            import ifcopenshell.util.pset
            files = ifcopenshell.util.pset.get_template(key).templates
            _PSET_TEMPLATES[key] = {str(t.Name).lower(): t for f in files for t in f.by_type("IfcPropertySetTemplate") if t.Name}
        except Exception:
            _PSET_TEMPLATES[key] = {}
    return _PSET_TEMPLATES[key]


def _cs_unit_in(value):
    """(number, unit) of a text that is a number with one of _CS_UNITS written after it ("40 dB" gives ("40", "dB")); None otherwise."""
    if not isinstance(value, str):
        return None
    import re
    m = re.match(r"^\s*([-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?)\s*([^\d\s.,+-].*?)\s*$", value)
    if not m or m.group(2).replace(" ", "").lower() not in _CS_UNITS:
        return None
    return m.group(1), m.group(2)


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

    Since recommendation 13 of the native IFC study and 4, 8 and 9 of the Praxi study (2026-11-12):

        create_wall, create_slab {..., load_bearing, status}, create_roof {..., status}
            load_bearing (optional) true or false writes Pset_WallCommon.LoadBearing or Pset_SlabCommon.LoadBearing, and status
            (optional: NEW, EXISTING, DEMOLISH or TEMPORARY) Status in the common set (the roof's slabs and the IfcRoof too), on the
            type when every occurrence of it says the same, else on the element (write_marked); null or missing writes nothing.
        assign {..., category}
            category (optional) is the material's IfcMaterial.Category, one of MATERIAL_CATEGORIES, with material.
        set_properties
            a set named Pset_... or Qto_... is checked against IfcOpenShell's template of the file's schema: unknown sets and
            properties, values of the wrong type and numbers with their unit written after them are refused (op_set_properties).

    At the end of apply IsExternal follows the topology on the walls the change set created or changed, on their doors and windows,
    and on its roofs and roof slabs (write_external).

    Since recommendations 2 and 3 of the Praxi study and 14 of the native IFC study (2026-11-12), all optional:

        create_storeys_and_grid {storeys: [{..., description, long_name}]}
            a storey's Description (such as "Plan 2 (Entré)") and LongName; given for a storey that exists, they are set on it.
        create_spaces {rooms: [{..., number, room_type}]}
            with number the space's Name is the number (unique among the model's spaces), its LongName the name and its
            Description the long_name; without one the name is the Name and long_name the LongName, as before. room_type is the
            room's type: ObjectType with PredefinedType USERDEFINED (IFC2X3: ObjectType alone).
        set_site {..., vertical_datum}
            the height system of the elevation for IfcProjectedCRS.VerticalDatum, when the EPSG code does not give it; null takes
            RH 2000 for SWEREF 99 (3006 to 3018). The compound codes 5845 to 5857 (SWEREF 99 TM and the local zones with RH 2000)
            are known; the CRS gets a Description in plain words and the metre as MapUnit, every parent representation context its
            own IfcMapConversion with the same values and the file's unit as Scale, and IFC4 and IFC2X3 buildings the height in
            ElevationOfRefHeight (map_conversion, building_height).

    Since recommendation 7 of the Praxi study and 17 of the native IFC study (2026-11-12), elements are changed in place so that their
    GlobalId stays for their whole life:

        edit_element {id, name, start, end, thickness, height, type, outline, offset, width, sill, pitch, overhang, base}
            changes an existing element (id: its id, GlobalId or a ref) and keeps its GlobalId; a field left out or null keeps its
            value. A wall of create_wall's form takes start and end ([x, y] metres in its storey's plane), thickness, height and type;
            a slab of create_slab's form outline, thickness and type, its top where it was; an opening of create_opening's form, or
            the door or window in it, offset, width, height and sill, the two together; a roof of create_roof's form pitch, overhang
            and base, its slabs following; any element name. The parameters are read from the element's representation (a wall's
            start and end from its Axis), never from a store of their own. The body, the Axis, the layer usage, the base quantities
            and the wall joins are made anew (op_edit_element); an element of another form, or a field its kind does not take, is an
            error that says what to do instead.
        transform_elements {ids, dx, dy, dz}
            the displacement is in the storey's plane; a door or window moves with its opening (IfcRelFillsElement,
            IfcRelVoidsElement), the site, the building and the storeys are refused, a point is moved in place or replaced so that
            none is left unused (rule IFC106), and a moved wall is joined anew (op_transform_elements).

    Since recommendations 4 and 11 of the native IFC study (2026-11-12), with new optional fields and one new operation:

        define_type {kind: ... | covering | column | beam | footing | railing | door | window, ..., material, material_category,
                     operation, partitioning, width, height, lining_depth}
            covering is layered as a slab is (IfcCoveringType); column, beam, footing and railing (IfcColumnType, IfcBeamType,
            IfcFootingType, IfcRailingType) take layers null and an optional material; door and window (IfcDoorType and IfcWindowType,
            IfcDoorStyle and IfcWindowStyle in IFC2X3) take operation (OperationType, DOOR_OPERATIONS) or partitioning
            (PartitioningType, WINDOW_PARTITIONS), width and height (metres) and lining_depth (metres), and get IfcOpenShell's door or
            window geometry as the type's representation map and their lining (and a door's panel) properties (define_element_type).
        create_element {storey, ifc_class, predefined_type, object_type, type, name, at: [x, y], z, rotation,
                        shape: {profile: rectangle | circle | polygon, x, y, radius, outline, depth, along: z | x}, stair, part_of, host}
            an element of ELEMENT_CLASSES with a ref: a SweptSolid contained in the storey, or aggregated in part_of (and on its
            storey) and never both; host is what an IfcCovering covers; IfcStair takes stair: {risers, riser_height, tread_length,
            width, thickness, landing} instead of shape and aggregates a sloped IfcStairFlight STRAIGHT with Pset_StairFlightCommon
            and, with a landing, an IfcSlab LANDING (op_create_element, create_stair).
        create_opening {..., type, side}
            type (optional) is a door or window type; the filling takes its size and its mapped geometry, stands flush with the
            wall's left face (side right: the right face) and a door opens toward that side (place_typed_fill).
    """

    CREATES = ("create_wall", "create_slab", "create_roof", "create_opening", "create_spaces", "define_type", "create_element")
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
        self._schema = None
        self.marks = {"LoadBearing": {}, "Status": {}}  # element id -> what its create step gave (write_marked)
        self.written = set()  # (element id, set, property) that set_properties wrote, which write_external may replace
        self.rejoin = set()  # ids of walls whose joins edit_element or transform_elements undid, for join_walls
        self.fill_sizes = {}  # (width, height) in metres of the door and window types this change set defines, by STEP id

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
            ordered = sorted(storeys, key=lambda s: _topo_elevation(s, self.scale))  # IFC4.3's storeys have their height in the placement
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

    # -- the right class (decision B-57.2): every class and enumeration value an operation sets is checked against the schema
    def schema_def(self):
        if self._schema is None:
            self._schema = _ifc_schema(getattr(self.m, "schema_identifier", None) or self.m.schema)
        return self._schema

    def check_class(self, ifc_class):
        """The entity's declaration in the file's schema; a DataspatiumError, with the classes to use instead, when it does not exist
        there or is abstract."""
        schema = self.schema_def()
        decl = _ifc_declaration(schema, ifc_class)
        if decl is not None and decl.as_entity() is not None and not decl.is_abstract():
            return decl
        if decl is not None and decl.as_entity() is not None:
            raise DataspatiumError("%s is abstract in %s; use one of %s" % (ifc_class, schema.name(), ", ".join(_ifc_concrete(decl)[:30])))
        import difflib
        near = difflib.get_close_matches(str(ifc_class), [d.name() for d in schema.declarations() if d.as_entity() is not None and not d.is_abstract()], 8, 0.6)
        raise DataspatiumError("%s is not an entity of %s%s" % (ifc_class, schema.name(), "; near: " + ", ".join(near) if near else ""))

    def check_enum(self, e, value, attribute="PredefinedType"):
        """Whether the schema gives the element the enumeration `attribute`; a DataspatiumError that lists the allowed values for one
        it does not take, and for USERDEFINED without the name of the type (ObjectType on an occurrence, ElementType on a type)."""
        items = _ifc_enum_items(self.check_class(e.is_a()), attribute)
        if items is None:
            return False
        gone = DEPRECATED_VALUES.get(self.m.schema, {}).get(e.is_a(), ()) if attribute == "PredefinedType" else ()
        allowed = [i for i in items if i not in gone]
        if value in gone:
            raise DataspatiumError("%s is deprecated for %s in %s (bSI rule IFC102); use one of %s" % (value, e.is_a(), self.schema_def().name(), ", ".join(allowed)))
        if value not in items:
            raise DataspatiumError("%s is not a %s of %s in %s; it takes %s" % (value, attribute, e.is_a(), self.schema_def().name(), ", ".join(allowed)))
        if value == "USERDEFINED" and attribute == "PredefinedType":
            named = "ElementType" if e.is_a("IfcTypeObject") else "ObjectType"
            if not str(getattr(e, named, None) or "").strip():
                raise DataspatiumError("%s USERDEFINED needs %s, the name of the user-defined type; or use one of %s" % (e.is_a(), named, ", ".join(i for i in allowed if i not in ("USERDEFINED", "NOTDEFINED"))))
        return True

    def predefined(self, e, value):
        """Set the element's PredefinedType after check_enum; an entity whose schema has none (walls, doors and windows in IFC2X3)
        takes nothing."""
        if self.check_enum(e, value):
            e.PredefinedType = value

    # -- the file's structure
    def root(self, ifc_class, name):
        import ifcopenshell.guid
        self.check_class(ifc_class)
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

    def closed(self, outline):
        """A closed IfcPolyline through (x, y) corners: a repeated first corner at the end is dropped, and the line closes on the first
        corner's own IfcCartesianPoint, not a copy of it (bSI rule GEM111)."""
        corners = [tuple(float(v) for v in p) for p in outline]
        while len(corners) > 1 and corners[-1] == corners[0]:
            corners.pop()
        if len(corners) < 3:
            raise DataspatiumError("an outline needs at least three different corners")
        pts = [self.point(x, y) for x, y in corners]
        return self.m.createIfcPolyline(pts + pts[:1])

    def prism(self, outline, height, z0=0.0):
        """A closed outline of (x, y) points extruded height along Z from z0."""
        profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, self.closed(outline))
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
                self.storey_texts(existing[0], s, touch=True)
                made.append(existing[0])
                continue
            elevation = _cs_num(s, "elevation", 0.0)
            storey = self.root("IfcBuildingStorey", s["name"])
            storey.CompositionType = "ELEMENT"
            self.storey_texts(storey, s)
            if self.m.schema != "IFC4X3":
                storey.Elevation = self.u(elevation)  # deprecated in IFC4.3 (IFC102): there the placement alone gives the height
            storey.ObjectPlacement = self.placement(building.ObjectPlacement, 0, 0, self.u(elevation))
            ifcopenshell.api.aggregate.assign_object(self.m, products=[storey], relating_object=building)
            self.register(storey, ref=False)
            made.append(storey)
        if grid:
            if not isinstance(grid, dict):
                raise DataspatiumError("grid must be an object with x_spacing, x_count, y_spacing and y_count")
            self.make_grid(grid, made[0] if made else self.storey(None))

    def storey_texts(self, storey, s, touch=False):
        """A storey's optional description (Description, such as 'Plan 2 (Entré)': the entrance level said in words) and long name
        (LongName), recommendation 2 of the Praxi study; on a storey that exists already only what differs is set, and it is changed."""
        changed = False
        for key, attribute in (("description", "Description"), ("long_name", "LongName")):
            value = str(s.get(key) or "").strip()[:255]
            if value and getattr(storey, attribute, None) != value:
                setattr(storey, attribute, value)
                changed = True
        if changed and touch:
            self.touch(storey)

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
        # STANDARD is deprecated (IFC102): a wall the AI calls a non-load-bearing interior wall partitions, any other is solid.
        self.predefined(wall, "PARTITIONING" if op.get("partition") is True else "SOLIDWALL")
        self.contain(wall, storey)
        self.register(wall, storey)
        self.mark_common(wall, op)
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
        self.mark_common(slab, op)
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
            if self.check_enum(roof, self.ROOF_TYPES[shape], "ShapeType"):
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
            profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, self.closed(face))
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
        for e in [roof] + slabs:
            self.mark_common(e, op)

    def op_create_opening(self, op):
        import ifcopenshell.api.feature
        wall = self.entity(op.get("wall_id"))
        if not wall.is_a("IfcWall"):
            raise DataspatiumError("wall_id must name a wall, not %s" % wall.is_a())
        fill = op.get("fill")
        if fill not in (None, "", "door", "window"):
            raise DataspatiumError("fill must be door, window or null")
        typed = self.fill_type(op, fill or None)  # a door or window type gives the fill, its size and its geometry
        if typed is not None:
            fill = typed["fill"]
        offset = _cs_num(op, "offset", 0.0)
        width = typed["width"] if typed else _cs_num(op, "width", 0.9, positive=True)
        height = typed["height"] if typed else _cs_num(op, "height", 2.1, positive=True)
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
        if typed is None:
            e.ObjectPlacement = self.placement(opening.ObjectPlacement, 0, 0, 0)
            leaf = self.u(0.05)
            e.Representation = self.box(self.u(width), leaf, self.u(height), 0, -leaf / 2.0, 0)
        else:
            self.place_typed_fill(e, opening, wall, typed, thickness, op.get("side"))
        e.OverallHeight = self.u(height)
        e.OverallWidth = self.u(width)
        if typed is None:
            self.predefined(e, "DOOR" if fill == "door" else "WINDOW")
        ifcopenshell.api.feature.add_filling(self.m, opening=opening, element=e)
        if storey is not None:
            self.contain(e, storey)
        self.register(e, storey)
        if typed is not None:
            self.relate_type(e, typed["type"])
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
            out.append(self.room_names(room, entry, i, out))
        return out

    def room_names(self, room, entry, i, before):
        """(room, Name, LongName) of a listed room. With a number (optional, recommendation 2 of the Praxi study) the number is the
        Name, unique among the model's spaces and the rooms listed before, the name the LongName and long_name the Description;
        without one the name is the Name and long_name the LongName, as before numbers came. room_type (optional) is the room's
        type, written as ObjectType with PredefinedType USERDEFINED by make_space, which reads it and the Description from room["ifc"]
        (the topology's room dicts are made for this operation alone)."""
        name = str(entry["name"]).strip()[:255]
        long_name = str(entry.get("long_name") or "").strip()[:255] or None
        number = str(entry.get("number") if entry.get("number") is not None else "").strip()[:255]
        room["ifc"] = {"room_type": str(entry.get("room_type") or "").strip()[:255] or None}
        if not number:
            return room, name, long_name
        if number in {n for _, n, _ in before}:
            raise DataspatiumError("room %d: the number %s is listed twice; a room number is unique in the building" % (i + 1, number))
        taken = next((s for s in self.m.by_type("IfcSpace") if str(s.Name or "") == number), None)
        if taken is not None:
            raise DataspatiumError("room %d: the number %s is the space %s's already (#%d); a room number is unique in the building" % (i + 1, number, _ifc_text(taken.LongName) or number, taken.id()))
        room["ifc"]["description"] = long_name
        return room, number, name

    def make_space(self, storey, frame, room, name, long_name, height):
        """An IfcSpace with the room's outline (holes as voids) in the storey's plane, extruded height metres up from the storey."""
        back = _cs_invert(frame)

        def curve(ring):
            return self.closed([_cs_at(back, (c[0] / self.scale, c[1] / self.scale, frame[3][2]))[:2] for c in ring.coords])
        poly = room["polygon"]
        if poly.interiors:
            profile = self.m.createIfcArbitraryProfileDefWithVoids("AREA", None, curve(poly.exterior), [curve(r) for r in poly.interiors])
        else:
            profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, curve(poly.exterior))
        space = self.root("IfcSpace", name)
        space.LongName = long_name
        space.CompositionType = "ELEMENT"
        extra = room.get("ifc") or {}
        if extra.get("description"):
            space.Description = extra["description"]
        if extra.get("room_type"):
            space.ObjectType = extra["room_type"]  # the room's type (Praxi: ObjectType with USERDEFINED); IFC2X3 has no PredefinedType
        if self.m.schema == "IFC2X3":
            if self.check_enum(space, "INTERNAL", "InteriorOrExteriorSpace"):
                space.InteriorOrExteriorSpace = "INTERNAL"
        elif extra.get("room_type"):
            self.predefined(space, "USERDEFINED")
        elif self.m.schema == "IFC4X3":
            self.predefined(space, "SPACE")  # INTERNAL is deprecated in IFC4.3 (IFC102); that the room is inside is IsExternal false
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
                if self.m.schema == "IFC4X3" or (self.m.schema == "IFC4" and space.PredefinedType == "USERDEFINED"):  # no INTERNAL to say it
                    import ifcopenshell.api.pset
                    pset = ifcopenshell.api.pset.add_pset(self.m, product=space, name="Pset_SpaceCommon")
                    ifcopenshell.api.pset.edit_pset(self.m, pset=pset, properties={"IsExternal": False})
                self.register(space, s, ref=listed)
        if not made:
            raise DataspatiumError("every room the walls enclose has a space already")

    def op_set_properties(self, op):
        """Properties of one set on elements or types. A set named Pset_... or Qto_... must be IfcOpenShell's template of that name in
        the file's schema (property_template), and its properties are spelled and checked as the template says (checked_properties); a
        Qto_ set becomes an IfcElementQuantity. A set of the model's own takes text, numbers and booleans as they come, though not a
        number with its unit written after it. The element's own set of the name is edited, never its type's (put_properties)."""
        name = str(op.get("pset") or "").strip()
        props = op.get("properties")
        if not name or not isinstance(props, dict) or not props:
            raise DataspatiumError("pset and properties (an object of name: value) are required")
        template, name = self.property_template(name)
        values = self.checked_properties(template, name, props)
        for e in self.elements(op):
            self.put_properties(e, template, name, values)
            self.written.update((e.id(), name, key) for key in values)
            self.touch(e)

    def op_set_classification(self, op):
        """A reference to a class of the system the person names, on the elements. A reference is reused only when its system, its
        code (Identification; ItemReference in IFC2X3) and its Location all match, and without a code its name too; otherwise it is
        made under that system's IfcClassification. (IfcOpenShell's add_reference reuses any reference with the same code in the
        file, whatever its system, and any reference without a code when none is given.) The system's own facts, when given (edition,
        source and dictionary_uri), go on its IfcClassification as Edition, Source and Location (IFC4) or Specification (IFC4.3); a
        system of the same name with another edition or address is another IfcClassification. Nothing is fetched: the facts come from
        the call. IFC2X3 requires Source and Edition, so an empty label stands for one not given, and its IfcClassification is not
        related to the project (IFC2X3 relates only references)."""
        import ifcopenshell.api.classification
        import ifcopenshell.guid
        system = str(op.get("system") or "").strip()
        name = str(op.get("name") or "").strip()
        if not system or not name:
            raise DataspatiumError("system and name are required")
        edition, source, address = (str(op.get(key) or "").strip() or None for key in ("edition", "source", "dictionary_uri"))
        address_attribute = {"IFC4": "Location", "IFC4X3": "Specification"}.get(self.m.schema)

        def same_system(c):
            here = getattr(c, address_attribute, None) if address_attribute else None
            return (str(c.Name or "") == system and not (edition and c.Edition and str(c.Edition) != edition)
                    and not (address and here and str(here) != address))
        classification = next((c for c in self.m.by_type("IfcClassification") if same_system(c)), None)
        if classification is None and self.m.schema == "IFC2X3":
            classification = self.m.create_entity("IfcClassification", Source=source or "", Edition=edition or "", Name=system)
        elif classification is None:
            classification = ifcopenshell.api.classification.add_classification(self.m, classification=system)
        if edition and not classification.Edition:
            classification.Edition = edition
        if source and not classification.Source:
            classification.Source = source
        if address and address_attribute and not getattr(classification, address_attribute, None):
            setattr(classification, address_attribute, address)
        code = str(op.get("code") or "").strip() or None
        uri = str(op.get("uri") or "").strip() or None
        code_attribute = "ItemReference" if self.m.schema == "IFC2X3" else "Identification"

        def system_of(ref):
            source = ref.ReferencedSource
            for _ in range(16):  # a reference may hang under another reference of the same system
                if source is None or not source.is_a("IfcClassificationReference"):
                    break
                source = source.ReferencedSource
            return source
        # Without a code a class is known by its name alone, so the name must match as well.
        ref = next((r for r in self.m.by_type("IfcClassificationReference") if system_of(r) == classification
                    and (getattr(r, code_attribute, None) or None) == code and (r.Location or None) == uri
                    and (code is not None or str(r.Name or "") == name)), None)
        if ref is None:
            ref = self.m.create_entity("IfcClassificationReference", Location=uri, Name=name, ReferencedSource=classification, **{code_attribute: code})
        elements = self.elements(op)
        rel = next((r for r in self.m.by_type("IfcRelAssociatesClassification") if r.RelatingClassification == ref), None)
        if rel is None:
            rel = self.m.create_entity("IfcRelAssociatesClassification", GlobalId=ifcopenshell.guid.new(), RelatedObjects=elements, RelatingClassification=ref)
            if self.owner is not None:
                rel.OwnerHistory = self.owner
        else:
            rel.RelatedObjects = list(rel.RelatedObjects) + [e for e in elements if e not in rel.RelatedObjects]
        for e in elements:
            self.touch(e)

    def op_assign(self, op):
        import ifcopenshell.api.material
        storey = self.storey(op["storey"]) if op.get("storey") else None
        material = op.get("material")
        if storey is None and not material:
            raise DataspatiumError("give a storey, a material or both")
        category = self.material_category(op, material)
        for e in self.elements(op):
            if storey is not None:
                self.contain(e, storey)
            if material:
                mat = self.named_material(str(material), category)  # the file's material of the name, or a new one
                try:
                    ifcopenshell.api.material.unassign_material(self.m, products=[e])
                except Exception:
                    pass
                ifcopenshell.api.material.assign_material(self.m, products=[e], type="IfcMaterial", material=mat)
            self.touch(e)

    def op_transform_elements(self, op):
        """Move elements by dx, dy, dz metres in their storey's plane (an opening's: its host's; without a storey the world's), turned
        into the frame each placement is relative to. A door or a window moves with its opening and an opening with its doors and
        windows (IfcRelFillsElement, IfcRelVoidsElement), and what is placed in another moved element follows it instead of moving
        twice. The site, the building and the storeys (IfcSpatialStructureElement other than IfcSpace) are refused: the site's place
        and the storeys' heights are the whole project's and change only by agreement. A placement's point is moved itself when nothing
        else uses it, else replaced, so that no point is left unused (bSI rule IFC106) and nothing else moves along; a moved wall's
        joins are undone and made anew where it meets other walls (unjoin, join_walls)."""
        dx, dy, dz = _cs_num(op, "dx", 0.0), _cs_num(op, "dy", 0.0), _cs_num(op, "dz", 0.0)
        moved = []
        for e in self.elements(op):
            if e.is_a("IfcSpatialStructureElement") and not e.is_a("IfcSpace"):
                raise DataspatiumError("%s #%d %r is not moved: the site's place and the storeys' heights are the whole project's and change only by agreement with the person; move the elements on it instead"
                                       % (e.is_a(), e.id(), _ifc_text(getattr(e, "Name", None)) or ""))
            for x in self.with_fillings(e):
                if all(x.id() != y.id() for y in moved):
                    moved.append(x)
        for e in moved:
            if not self.movable(e):
                raise DataspatiumError("element %d has no local placement to move" % e.id())
        d = (self.u(dx), self.u(dy), self.u(dz))
        for e in moved:
            if not any(y.id() != e.id() and self.placed_in(e, y) for y in moved):
                if e.is_a("IfcWall"):
                    self.unjoin(e)
                    for end in (0, 1):
                        self.draw_out(e, end)
                self.shift(e, self.plane_of(e), d)
            self.touch(e)
            for rel in getattr(e, "VoidsElements", None) or ():
                self.touch(rel.RelatingBuildingElement)  # the host's net quantities

    # -- moving and changing in place: placements, points and items that only the element uses
    @staticmethod
    def movable(e):
        """Whether an element has a local placement of a 3D axis placement relative to one the app can follow."""
        pl = getattr(e, "ObjectPlacement", None)
        return (pl is not None and pl.is_a("IfcLocalPlacement") and pl.RelativePlacement is not None and pl.RelativePlacement.is_a("IfcAxis2Placement3D")
                and _cs_placement(pl.PlacementRelTo) is not None)

    @staticmethod
    def with_fillings(e):
        """An element with what moves along with it: a door or a window with its opening and the opening's other doors and windows, an
        opening with its doors and windows; any other element alone."""
        openings = [r.RelatingOpeningElement for r in (getattr(e, "FillsVoids", None) or ())]
        if e.is_a("IfcOpeningElement"):
            openings.append(e)
        if not openings:
            return [e]
        out = []
        for o in openings:
            for x in [o] + [r.RelatedBuildingElement for r in (getattr(o, "HasFillings", None) or ())]:
                if all(x.id() != y.id() for y in out):
                    out.append(x)
        return out

    @staticmethod
    def placed_in(e, other):
        """Whether the placement of e is relative, directly or through others, to the placement of the element `other`."""
        target = getattr(other, "ObjectPlacement", None)
        p = getattr(e, "ObjectPlacement", None)
        for _ in range(64):
            p = p.PlacementRelTo if p is not None and p.is_a("IfcLocalPlacement") else None
            if p is None or target is None:
                return False
            if p.id() == target.id():
                return True
        return False

    def plane_of(self, e):
        """The absolute matrix of the plane a displacement of e is given in: its storey's (its container's), for an opening its host's,
        else the world's."""
        c = self.container(e)
        if c is None:
            host = next((r.RelatingBuildingElement for r in (getattr(e, "VoidsElements", None) or ())), None)
            c = self.container(host) if host is not None else None
        m = _cs_placement(getattr(c, "ObjectPlacement", None)) if c is not None else None
        return m if m is not None else _cs_axes(None)

    def shift(self, e, plane, d):
        """Move e's placement (movable) by d, a displacement in file units in the frame of the absolute matrix `plane`, turned into the
        frame its placement is relative to."""
        pl = e.ObjectPlacement
        local = _cs_turn(_cs_invert(_cs_placement(pl.PlacementRelTo)), _cs_turn(plane, d))
        pos = self.own(pl, "RelativePlacement")
        c = ([float(v) for v in pos.Location.Coordinates] + [0.0, 0.0, 0.0])[:3]
        self.set_point(pos, "Location", [round(a + b, 9) for a, b in zip(c, local)])

    def own(self, owner, attribute):
        """The instance in owner's `attribute`, copied first when anything else uses it too, so that a change to it changes owner alone."""
        inst = getattr(owner, attribute)
        if inst is not None and self.m.get_total_inverses(inst) > 1:
            import ifcopenshell.util.element
            inst = ifcopenshell.util.element.copy(self.m, inst)
            setattr(owner, attribute, inst)
        return inst

    def set_point(self, owner, attribute, coords):
        """Set the IfcCartesianPoint in owner's `attribute` to coords (file units): the point itself when nothing else uses it, else a
        new one, so that no point is left unused (bSI rule IFC106) and nothing else moves with it."""
        p = getattr(owner, attribute)
        coords = [float(c) for c in coords]
        if p is not None and p.is_a("IfcCartesianPoint") and len(p.Coordinates) == len(coords) and self.m.get_total_inverses(p) == 1:
            p.Coordinates = coords
        else:
            setattr(owner, attribute, self.point(*coords))

    def set_direction(self, owner, attribute, ratios, default=None):
        """Set the IfcDirection in owner's `attribute` to ratios like set_point; an attribute left out stays out while the ratios are its
        default (None: it is always written)."""
        d = getattr(owner, attribute)
        ratios = [float(c) for c in ratios]
        now = [float(c) for c in d.DirectionRatios] if d is not None else (list(default) if default is not None else None)
        if now is not None and len(now) == len(ratios) and all(abs(a - b) < 1e-12 for a, b in zip(now, ratios)):
            return
        if d is not None and len(d.DirectionRatios) == len(ratios) and self.m.get_total_inverses(d) == 1:
            d.DirectionRatios = ratios
        else:
            setattr(owner, attribute, self.direction(*ratios))

    def drop(self, inst):
        """Remove an instance that nothing uses any more, with what only it uses (remove_deep2), so that no resource is left without a
        rooted entity (bSI rule IFC106)."""
        if inst is not None and self.m.get_total_inverses(inst) == 0:
            import ifcopenshell.util.element
            ifcopenshell.util.element.remove_deep2(self.m, inst)

    def replace_item(self, rep, old, new):
        """Put the representation item new in old's place in rep, with old's styles and presentation layers, and drop old."""
        rep.Items = [new if i.id() == old.id() else i for i in (rep.Items or ())]
        for r in list(self.m.get_inverse(old)):
            if r.is_a("IfcStyledItem"):
                r.Item = new
            elif r.is_a("IfcPresentationLayerAssignment"):
                r.AssignedItems = [new if i.id() == old.id() else i for i in (r.AssignedItems or ())]
        self.drop(old)

    # -- joins undone, for walls that change or move
    def path_joins(self, w):
        """A wall's IfcRelConnectsPathElements with other walls: (relationship, the wall's connection type, the other wall, its type)."""
        out = []
        for attribute, mine, theirs in (("ConnectedTo", "Relating", "Related"), ("ConnectedFrom", "Related", "Relating")):
            for rel in getattr(w, attribute, None) or ():
                other = getattr(rel, theirs + "Element", None) if rel.is_a("IfcRelConnectsPathElements") else None
                if other is not None and other.is_a("IfcWall"):
                    out.append((rel, getattr(rel, mine + "ConnectionType", None), other, getattr(rel, theirs + "ConnectionType", None)))
        return out

    def unjoin(self, wall):
        """Undo a wall's joins before its axis or thickness changes or it moves, so that join_walls makes them anew where the walls still
        meet (rejoin): every IfcRelConnectsPathElements between it and another wall goes, and where the other wall joined it with an end
        (ATSTART or ATEND), that end's other joins go as well and its body reaches its axis's end again (draw_out)."""
        todo, seen = [(wall, None)], set()
        while todo:
            w, end = todo.pop()
            if (w.id(), end) in seen:
                continue
            seen.add((w.id(), end))
            self.rejoin.add(w.id())
            for rel, mine, other, theirs in self.path_joins(w):
                if end is not None and mine != self.end_type(end):
                    continue
                self.m.remove(rel)
                if theirs in ("ATSTART", "ATEND"):
                    todo.append((other, 0 if theirs == "ATSTART" else 1))
            if end is not None:
                self.draw_out(w, end)

    def draw_out(self, w, end):
        """Let the end of a wall's body (0 on its axis's start's side, 1 on its end's) reach its axis's end again, as before a join cut
        it; nothing for a body of another form than create_wall's."""
        j = self.join_wall(w, False)
        if j is not None and j["box"] is not None and self.cut_end(j, end, j["a"] if end == 0 else j["b"]):
            self.touch(w)

    # -- edit_element (recommendation 7 of the Praxi study, 17 of the native IFC study)
    EDITS = {"wall": ("start", "end", "thickness", "height", "type"), "slab": ("outline", "thickness", "type"),
             "opening": ("offset", "width", "height", "sill"), "roof": ("pitch", "overhang", "base")}
    EDIT_FIELDS = ("name", "start", "end", "thickness", "height", "type", "outline", "offset", "width", "sill", "pitch", "overhang", "base")

    def op_edit_element(self, op):
        """Change an existing element in place and keep its GlobalId. The fields given (not null) must be name or those of the element's
        kind (EDITS): the measures go to edit_wall, edit_slab, edit_opening or edit_roof, which read the element's parameters from its
        representation and refuse one of another form with what to do instead. The element and what changed with it are in the changed
        list, so that finish gives them their base quantities."""
        e = self.entity(op.get("id"))
        fields = [k for k in self.EDIT_FIELDS if op.get(k) is not None and not (isinstance(op.get(k), str) and not op.get(k).strip())]
        if not fields:
            raise DataspatiumError("nothing to change: give the name or the measures to change, and null for the rest")
        kind = self.edit_kind(e)
        measures = [k for k in fields if k != "name"]
        wrong = [k for k in measures if k not in self.EDITS.get(kind, ())]
        if wrong:
            raise DataspatiumError(self.edit_refusal(e, kind, wrong))
        if "name" in fields and not e.is_a("IfcRoot"):
            raise DataspatiumError("%s #%d has no name to change" % (e.is_a(), e.id()))
        if measures:
            getattr(self, "edit_" + kind)(e, op)
        if "name" in fields:
            e.Name = str(op["name"]).strip()[:255]
            for rec in self.created:
                if rec["id"] == e.id():
                    rec["name"] = _ifc_text(e.Name)
        self.touch(e)

    def edit_kind(self, e):
        """wall, slab, opening (also for a door or a window), roof, "roof slab" for a slab of a roof, or None."""
        if e.is_a("IfcWall"):
            return "wall"
        if e.is_a("IfcRoof"):
            return "roof"
        if e.is_a("IfcOpeningElement") or e.is_a("IfcDoor") or e.is_a("IfcWindow"):
            return "opening"
        if e.is_a("IfcSlab"):
            return "roof slab" if self.roof_of(e) is not None else "slab"
        return None

    @staticmethod
    def roof_of(slab):
        return next((r.RelatingObject for r in (getattr(slab, "Decomposes", None) or ()) if r.RelatingObject.is_a("IfcRoof")), None)

    def edit_refusal(self, e, kind, wrong):
        """Why edit_element does not take these fields for this element, and what the AI can do instead."""
        what = "%s #%d %r" % (e.is_a(), e.id(), _ifc_text(getattr(e, "Name", None)) or "")
        if kind == "roof slab":
            roof = self.roof_of(e)
            return "%s is a slab of roof #%d %r: edit the roof with pitch, overhang or base; the slab itself takes only name" % (what, roof.id(), _ifc_text(roof.Name) or "")
        if kind is None:
            return ("%s takes only name in edit_element (%s are for walls, slabs, openings with their doors and windows, and roofs); move it with transform_elements, and delete it and create it anew only when the person asks"
                    % (what, ", ".join(wrong)))
        return "%s takes %s or name, not %s" % (what, ", ".join(self.EDITS[kind]), ", ".join(wrong))

    def cannot(self, e, why, tool):
        """The refusal of measures for an element that is not of the write tools' form."""
        return DataspatiumError("%s #%d %r cannot be changed in place: %s. edit_element can still change its name and transform_elements move it; delete it and draw it anew with %s only when the person asks"
                                % (e.is_a(), e.id(), _ifc_text(getattr(e, "Name", None)) or "", why, tool))

    def layers_of(self, e):
        """(total thickness in metres, what gives it) of the material layers an element's own layer set usage or its type gives it;
        None without."""
        import ifcopenshell.util.element as el
        own = [r.RelatingMaterial.ForLayerSet for r in (getattr(e, "HasAssociations", None) or ())
               if r.is_a("IfcRelAssociatesMaterial") and r.RelatingMaterial.is_a("IfcMaterialLayerSetUsage")]
        t = el.get_type(e)
        layers = own[0] if own else (self.type_layers(t) if t is not None else None)
        if layers is None:
            return None
        total = round(sum(float(x.LayerThickness or 0.0) for x in (layers.MaterialLayers or ())) * self.scale, 9)
        return total, ("type %r" % _ifc_text(t.Name)) if t is not None else ("layer set %r" % _ifc_text(layers.LayerSetName))

    def edit_thickness(self, e, op, kind, current):
        """(thickness in metres, the new type or None) of an edited wall or slab: with a type (with_type) its layers', which a thickness
        given must equal, and the type unless the element has it already; else, when its layers fix it, its own, which a thickness given
        must equal; else the thickness given or the current one."""
        import ifcopenshell.util.element as el
        if op.get("type") not in (None, ""):
            typed, t = self.with_type({"type": op["type"], "thickness": op.get("thickness")}, kind)
            old = el.get_type(e)
            return typed["thickness"], (None if old is not None and old.id() == t.id() else t)
        fixed = self.layers_of(e)
        if fixed is not None and fixed[0] > 0:
            if op.get("thickness") is not None and abs(_cs_num(op, "thickness", positive=True) - fixed[0]) > 0.0005:
                raise DataspatiumError("the thickness of %s #%d comes from its %s (%g m); to change it give another %s type as type (define_type makes one)"
                                       % (e.is_a(), e.id(), fixed[1], fixed[0], kind))
            return current, None
        return (_cs_num(op, "thickness", positive=True) if op.get("thickness") is not None else current), None

    def untype(self, e):
        """Take an occurrence off its type before give_type gives it another: out of the type's IfcRelDefinesByType (which goes when it
        relates nothing more), and its own material association removed, with a layer set usage or a material that nothing else uses."""
        rels = list(getattr(e, "IsTypedBy", None) or ()) + [r for r in (getattr(e, "IsDefinedBy", None) or ()) if r.is_a("IfcRelDefinesByType")]
        for rel in {r.id(): r for r in rels}.values():
            rest = [o for o in (rel.RelatedObjects or ()) if o.id() != e.id()]
            if rest:
                rel.RelatedObjects = rest
            else:
                self.m.remove(rel)
        for rel in [r for r in (getattr(e, "HasAssociations", None) or ()) if r.is_a("IfcRelAssociatesMaterial")]:
            material = rel.RelatingMaterial
            rest = [o for o in (rel.RelatedObjects or ()) if o.id() != e.id()]
            if rest:
                rel.RelatedObjects = rest
                continue
            self.m.remove(rel)
            if material is not None and (material.is_a("IfcMaterialLayerSetUsage") or material.is_a("IfcMaterial")) and self.m.get_total_inverses(material) == 0:
                self.m.remove(material)  # not deep: a layer set stays with its type

    def wall_frame(self, wall):
        """A wall of create_wall's form as edit_element reads it: its storey and the storey's absolute matrix S, its placement relative
        to the storey (rel), its Axis (representation, item and two points along its x, file units), its body (wall_box), its start and
        end in the storey's plane (metres), the storey-plane height of its axis (z, file units), its body's centre off the axis (off,
        file units), its thickness and height (metres) and its body's base (file units); else the refusal of cannot."""
        s = self.scale
        storey = self.container(wall)
        S = _cs_placement(storey.ObjectPlacement) if storey is not None else None
        W = _cs_placement(getattr(wall, "ObjectPlacement", None)) if self.movable(wall) else None
        rep = getattr(wall, "Representation", None)
        axis_rep, axis_item = next(((r, i) for r in (rep.Representations if rep is not None else ()) if (r.RepresentationIdentifier or "") == "Axis" for i in (r.Items or ())), (None, None))
        line = _topo_curve(axis_item) if axis_item is not None else None
        box = self.wall_box(wall)
        rel = _cs_compose(_cs_invert(S), W) if S is not None and W is not None else None
        why = None
        if rel is None:
            why = "it is in no storey, or its placement cannot be read"
        elif not line or len(line) != 2 or abs(line[0][1] - line[1][1]) > self.u(1e-6) or abs(line[1][0] - line[0][0]) < self.u(0.01):
            why = "it has no straight Axis of two points along its x"
        elif box is None:
            why = "its body is not one extruded rectangle along its axis"
        elif len(getattr(rep, "ShapeOfProduct", None) or ()) > 1:
            why = "it shares its shape with other elements"
        elif abs(rel[2][2] - 1.0) > 1e-6:
            why = "it does not stand upright in its storey"
        if why:
            raise self.cannot(wall, why, "create_wall")
        a, b = _cs_at(rel, (line[0][0], line[0][1], 0.0)), _cs_at(rel, (line[1][0], line[1][1], 0.0))
        p = box.SweptArea
        return {"storey": storey, "S": S, "rel": rel, "axis_rep": axis_rep, "axis_item": axis_item, "line": line, "box": box,
                "start": (a[0] * s, a[1] * s), "end": (b[0] * s, b[1] * s), "z": a[2], "off": float(p.Position.Location.Coordinates[1]) - line[0][1],
                "thickness": float(p.YDim) * s, "height": float(box.Depth) * s, "base": _cs_axes(box.Position)[3][2]}

    def edit_wall(self, wall, op):
        """edit_element on a wall (wall_frame). start and end place it at the new start along the new axis and draw its Axis and body
        anew from start to end; thickness and height size its body. Its openings keep their place along it when its direction stays the
        same, else their offset from its start, get its new thickness and must stay within it. A new type types it with the layers
        centred as create_wall lays them; a typed wall takes its thickness from its layers. Its joins are undone and made anew at the
        end (unjoin, join_walls); the spaces it bounds keep their outlines, which the report notes."""
        s = self.scale
        f = self.wall_frame(wall)
        start = _cs_xy(op["start"], "start") if op.get("start") is not None else f["start"]
        end = _cs_xy(op["end"], "end") if op.get("end") is not None else f["end"]
        length = math.dist(start, end)
        if length < 0.01:
            raise DataspatiumError("start and end are the same point")
        thickness, typ = self.edit_thickness(wall, op, "wall", f["thickness"])
        height = _cs_num(op, "height", positive=True) if op.get("height") is not None else f["height"]
        moving = math.dist(start, f["start"]) > 1e-9 or math.dist(end, f["end"]) > 1e-9
        resizing = abs(thickness - f["thickness"]) > 1e-9
        line = f["line"]
        u = ((end[0] - start[0]) / length, (end[1] - start[1]) / length)
        was = math.dist(f["start"], f["end"])
        same = was > 0 and ((f["end"][0] - f["start"][0]) * u[0] + (f["end"][1] - f["start"][1]) * u[1]) / was > 1.0 - 1e-9
        new_line = [(0.0, 0.0), (self.u(length), 0.0)] if moving else line
        lo, hi = min(new_line[0][0], new_line[1][0]), max(new_line[0][0], new_line[1][0])
        top, tol = f["base"] + self.u(height), self.u(0.001)
        plan = []
        for rel in getattr(wall, "HasOpenings", None) or ():
            o = rel.RelatedOpeningElement
            box, item, opl = self.opening_box(o, wall), self.wall_box(o), getattr(o, "ObjectPlacement", None)
            inside = self.movable(o) and opl.PlacementRelTo is not None and opl.PlacementRelTo.id() == wall.ObjectPlacement.id()
            label = "opening #%d %r" % (o.id(), _ifc_text(o.Name) or "")
            if box is None or item is None or not inside:
                if moving or resizing:
                    raise DataspatiumError("%s in wall #%d is not drawn and placed as create_opening does, so the wall's start, end and thickness cannot change with it; change its height or name, or ask the person what to do with the opening" % (label, wall.id()))
                continue
            ox, oy, oz = ([float(c) for c in opl.RelativePlacement.Location.Coordinates] + [0.0, 0.0, 0.0])[:3]
            nx, ny = ox, oy
            if moving and same:  # its place along the line stays
                q = _cs_at(f["rel"], (ox, oy, oz))
                nx, ny = (q[0] - self.u(start[0])) * u[0] + (q[1] - self.u(start[1])) * u[1], oy - line[0][1]
            elif moving:  # its offset from the start stays
                nx, ny = ox - line[0][0], oy - line[0][1]
            x0, x1 = nx + box[0] - ox, nx + box[1] - ox
            if x0 < lo - tol or x1 > hi + tol or box[3] > top + tol:
                raise DataspatiumError("%s would reach beyond wall #%d (%.3g to %.3g m along a wall of %.3g m, its top %.3g m up in a wall %.3g m high); first move or resize it with edit_element (offset, width, height, sill), or ask the person whether to delete it"
                                       % (label, wall.id(), (x0 - lo) * s, (x1 - lo) * s, (hi - lo) * s, (box[3] - f["base"]) * s, height))
            plan.append((o, item, (nx, ny, oz), _cs_placement(opl), self.loose_fillings(o) if moving else []))
        if moving or resizing:
            self.unjoin(wall)
        if moving:
            self.place_wall(wall, f, start, u)
            self.set_axis(f, new_line)
        if moving or resizing:
            p = self.own(f["box"], "SweptArea")
            p.XDim = round(hi - lo, 9)
            p.YDim = round(self.u(thickness), 9)
            self.set_point(self.own(p, "Position"), "Location", (round((lo + hi) / 2.0, 9), round(new_line[0][1] + f["off"], 9)))
        f["box"].Depth = round(self.u(height), 9)
        for o, item, at, before, loose in plan:
            if moving:
                self.set_point(self.own(o.ObjectPlacement, "RelativePlacement"), "Location", [round(c, 9) for c in at])
                self.follow(o, before, loose)
            if resizing:
                q = self.own(item, "SweptArea")
                q.YDim = round(float(q.YDim) + self.u(thickness) - self.u(f["thickness"]), 9)
            if moving or resizing:
                self.touch(o)
        if typ is not None:
            self.untype(wall)
            self.give_type(wall, typ, "AXIS2", "POSITIVE", f["off"] * s - thickness / 2.0)
        if (moving or resizing) and getattr(wall, "ProvidesBoundaries", None):
            self.notes.append("wall #%d %r bounds spaces whose outlines stay as they were" % (wall.id(), _ifc_text(wall.Name) or ""))
        self.touch(wall)

    def place_wall(self, wall, f, start, u):
        """Set a wall's placement at start (metres in its storey's plane, at the height its axis had) with its x along u, relative to the
        placement it was relative to."""
        pl = wall.ObjectPlacement
        target = [[u[0], u[1], 0.0], [-u[1], u[0], 0.0], [0.0, 0.0, 1.0], [self.u(start[0]), self.u(start[1]), f["z"]]]
        self.set_local(pl, _cs_compose(_cs_invert(_cs_placement(pl.PlacementRelTo)), _cs_compose(f["S"], target)))

    def set_local(self, pl, local):
        """Write the matrix `local` (relative to the placement's PlacementRelTo, file units) into an IfcLocalPlacement's own axis
        placement: its point and directions in place when nothing else uses them, else new ones."""
        pos = self.own(pl, "RelativePlacement")
        self.set_point(pos, "Location", [round(c, 9) for c in local[3]])
        axis, ref = [round(c, 12) for c in local[2]], [round(c, 12) for c in local[0]]
        # Axis and RefDirection are both given or both left out (IfcAxis2Placement3D's rule AxisAndRefDirProvision).
        both = pos.Axis is not None or pos.RefDirection is not None or axis != [0.0, 0.0, 1.0] or ref != [1.0, 0.0, 0.0]
        self.set_direction(pos, "Axis", axis, None if both else (0.0, 0.0, 1.0))
        self.set_direction(pos, "RefDirection", ref, None if both else (1.0, 0.0, 0.0))

    def loose_fillings(self, opening):
        """The doors and windows of an opening that are not placed in it, with their absolute matrices, for follow; a refusal for one
        without a local placement to move."""
        out = []
        for x in [r.RelatedBuildingElement for r in (getattr(opening, "HasFillings", None) or ())]:
            if not self.placed_in(x, opening):
                if not self.movable(x):
                    raise self.cannot(x, "it is not placed in its opening and has no local placement to move with it", "create_opening")
                out.append((x, _cs_placement(x.ObjectPlacement)))
        return out

    def follow(self, opening, before, loose):
        """Move the doors and windows of loose_fillings as the opening moved from the absolute matrix `before`."""
        turn = _cs_compose(_cs_placement(opening.ObjectPlacement), _cs_invert(before))
        for x, m in loose:
            self.set_local(x.ObjectPlacement, _cs_compose(_cs_invert(_cs_placement(x.ObjectPlacement.PlacementRelTo)), _cs_compose(turn, m)))
            self.touch(x)

    def set_axis(self, f, line):
        """Draw a wall's Axis (wall_frame) anew as a polyline through two points of its own coordinates (file units)."""
        rep, item = f["axis_rep"], f["axis_item"]
        if not (item.is_a("IfcPolyline") and len(item.Points) == 2 and self.m.get_total_inverses(item) == 1):
            self.replace_item(rep, item, self.m.createIfcPolyline([self.point(*q) for q in line]))
            return
        pts = []
        for p, q in zip(item.Points, line):
            if len(p.Coordinates) == 2 and self.m.get_total_inverses(p) == 1:
                p.Coordinates = [round(float(c), 9) for c in q]
                pts.append(p)
            else:
                pts.append(self.point(*q))
        item.Points = pts

    def slab_frame(self, slab):
        """A slab of create_slab's form as edit_element reads it: its body (one outline of straight edges extruded straight up), the
        matrix M of the body's position in the storey's plane, its outline there (metres), its thickness (metres) and the height of its
        top in the slab's coordinates (file units); else the refusal of cannot."""
        s = self.scale
        storey = self.container(slab)
        S = _cs_placement(storey.ObjectPlacement) if storey is not None else None
        P = _cs_placement(getattr(slab, "ObjectPlacement", None))
        rep = getattr(slab, "Representation", None)
        bodies = [r for r in (rep.Representations if rep is not None else ()) if (r.RepresentationIdentifier or "") == "Body"]
        items = list(bodies[0].Items or ()) if len(bodies) == 1 else []
        item = items[0] if len(items) == 1 and items[0].is_a("IfcExtrudedAreaSolid") else None
        profile = item.SweptArea if item is not None else None
        curve = profile.OuterCurve if profile is not None and profile.is_a() == "IfcArbitraryClosedProfileDef" else None
        why, M = None, None
        if S is None or P is None:
            why = "it is in no storey, or its placement cannot be read"
        elif curve is None or not curve.is_a("IfcPolyline"):
            why = "its body is not one outline of straight edges extruded"
        elif len(getattr(rep, "ShapeOfProduct", None) or ()) > 1:
            why = "it shares its shape with other elements"
        else:
            position = _cs_axes(item.Position)
            M = _cs_compose(_cs_compose(_cs_invert(S), P), position)
            d = _cs_unit([float(c) for c in item.ExtrudedDirection.DirectionRatios])
            if d is None or abs(d[2] - 1.0) > 1e-9 or abs(position[2][2] - 1.0) > 1e-9 or abs(M[2][2] - 1.0) > 1e-6:
                why = "it is not extruded straight up"
        if why:
            raise self.cannot(slab, why, "create_slab")
        pts = [[float(c) for c in p.Coordinates][:2] for p in curve.Points]
        if len(pts) > 3 and math.dist(pts[0], pts[-1]) < 1e-9:
            pts = pts[:-1]
        return {"item": item, "M": M, "outline": [(q[0] * s, q[1] * s) for q in (_cs_at(M, (x, y, 0.0)) for x, y in pts)],
                "thickness": float(item.Depth) * s, "top": _cs_axes(item.Position)[3][2] + float(item.Depth)}

    def edit_slab(self, slab, op):
        """edit_element on a slab (slab_frame): outline (corners in metres in the storey's plane) draws its profile anew, closed on its
        first point (GEM111); thickness keeps its top where it is; a new type types it with the layers down from its top as create_slab
        lays them; a typed slab takes its thickness from its layers."""
        f = self.slab_frame(slab)
        thickness, typ = self.edit_thickness(slab, op, "slab", f["thickness"])
        item = f["item"]
        if op.get("outline") is not None:
            outline = op["outline"]
            if not isinstance(outline, (list, tuple)) or len(outline) < 3:
                raise DataspatiumError("outline must be at least three [x, y] points")
            back = _cs_invert(f["M"])
            local = [_cs_at(back, (self.u(x), self.u(y), f["M"][3][2]))[:2] for x, y in (_cs_xy(p, "outline") for p in outline)]
            profile = self.own(item, "SweptArea")
            old = profile.OuterCurve
            profile.OuterCurve = self.closed([(round(x, 9), round(y, 9)) for x, y in local])
            self.drop(old)
        if abs(thickness - f["thickness"]) > 1e-9:
            z = round(f["top"] - self.u(thickness), 9)
            if item.Position is None:
                item.Position = self.axis3(0, 0, z)
            else:
                pos = self.own(item, "Position")
                c = ([float(v) for v in pos.Location.Coordinates] + [0.0, 0.0, 0.0])[:3]
                self.set_point(pos, "Location", (c[0], c[1], z))
            item.Depth = round(self.u(thickness), 9)
        if typ is not None:
            self.untype(slab)
            self.give_type(slab, typ, "AXIS3", "NEGATIVE", 0.0)
        self.touch(slab)

    def opening_frame(self, e):
        """An opening of create_opening's form in a wall of create_wall's form, or the door or window in it, as edit_element reads it:
        the opening, its wall, its body (wall_box), its doors and windows, its offset from the wall's start, width, sill above the
        wall's base and height (metres), and the extent of the wall's body along it and up (bx0, bx1, bz0, bz1, metres); else the refusal
        of cannot."""
        s = self.scale
        opening = e if e.is_a("IfcOpeningElement") else next((r.RelatingOpeningElement for r in (getattr(e, "FillsVoids", None) or ())), None)
        if opening is None:
            raise self.cannot(e, "it fills no opening", "create_opening")
        wall = next((r.RelatingBuildingElement for r in (getattr(opening, "VoidsElements", None) or ())), None)
        box = self.opening_box(opening, wall) if wall is not None else None
        item, body = self.wall_box(opening), (self.wall_box(wall) if wall is not None else None)
        if wall is None or not wall.is_a("IfcWall") or box is None or item is None or body is None or not self.movable(opening):
            raise self.cannot(e, "it is not an opening of create_opening's form in a wall of create_wall's form", "create_opening")
        cx, half = float(body.SweptArea.Position.Location.Coordinates[0]), float(body.SweptArea.XDim) / 2.0
        bz = _cs_axes(body.Position)[3][2]
        return {"opening": opening, "wall": wall, "item": item, "fillings": [r.RelatedBuildingElement for r in (getattr(opening, "HasFillings", None) or ())],
                "offset": box[0] * s, "width": (box[1] - box[0]) * s, "sill": box[2] * s, "height": (box[3] - box[2]) * s,
                "bx0": (cx - half) * s, "bx1": (cx + half) * s, "bz0": bz * s, "bz1": (bz + float(body.Depth)) * s}

    def edit_opening(self, e, op):
        """edit_element on an opening (opening_frame) or the door or window in it: offset (metres from the wall's start, along it), sill
        (above the wall's base), width and height, the opening and its doors and windows together; the opening must stay within the
        wall's body. A door or window placed in the opening follows it (one placed elsewhere is moved as much), and their bodies,
        OverallWidth and OverallHeight take the new size."""
        f = self.opening_frame(e)
        opening, wall, item, fillings = f["opening"], f["wall"], f["item"], f["fillings"]
        offset, width, sill, height = f["offset"], f["width"], f["sill"], f["height"]
        new = {k: (_cs_num(op, k, positive=k in ("width", "height")) if op.get(k) is not None else v)
               for k, v in (("offset", offset), ("width", width), ("sill", sill), ("height", height))}
        bx0, bx1, bz0, bz1 = f["bx0"], f["bx1"], f["bz0"], f["bz1"]
        if new["offset"] < bx0 - 0.001 or new["offset"] + new["width"] > bx1 + 0.001 or new["sill"] < bz0 - 0.001 or new["sill"] + new["height"] > bz1 + 0.001:
            raise DataspatiumError("%s #%d would reach beyond wall #%d %r, whose body runs from %.3g to %.3g m from its start and from %.3g to %.3g m up; give an offset, width, sill and height within it"
                                   % (e.is_a(), e.id(), wall.id(), _ifc_text(wall.Name) or "", bx0, bx1, bz0, bz1))
        resize = abs(new["width"] - width) > 1e-9 or abs(new["height"] - height) > 1e-9
        boxes = [item]
        for x in fillings:
            b = self.wall_box(x)
            if resize and b is None:
                raise self.cannot(x, "its body is not the box create_opening draws, so its size cannot change", "create_opening")
            boxes.append(b)
        loose = self.loose_fillings(opening)
        d = (self.u(new["offset"] - offset), 0.0, self.u(new["sill"] - sill))
        if any(abs(c) > 1e-12 for c in d):
            before = _cs_placement(opening.ObjectPlacement)
            self.shift(opening, _cs_placement(wall.ObjectPlacement), d)
            self.follow(opening, before, loose)
        if resize:
            for b in boxes:
                self.resize_box(b, self.u(new["width"]), self.u(new["height"]))
            for x in fillings:
                if hasattr(x, "OverallWidth"):
                    x.OverallWidth, x.OverallHeight = round(self.u(new["width"]), 9), round(self.u(new["height"]), 9)
        for x in [opening] + fillings + [wall]:
            self.touch(x)

    def resize_box(self, item, width, height):
        """A box of create_opening's form (wall_box) made width long along x from where it starts, and height high (file units)."""
        p = self.own(item, "SweptArea")
        cx, cy = [float(c) for c in p.Position.Location.Coordinates][:2]
        x0 = cx - float(p.XDim) / 2.0
        p.XDim = round(width, 9)
        self.set_point(self.own(p, "Position"), "Location", (round(x0 + width / 2.0, 9), cy))
        item.Depth = round(height, 9)

    def roof_frame(self, roof):
        """A roof of create_roof's form as edit_element reads it: its storey's absolute matrix S, its shape (PredefinedType, in IFC2X3
        ShapeType), its base above the storey and, from its slabs' faces, the pitch, the rectangle it covers (length and width), the
        overhang and the thickness (metres), the ridge, and per slab its body and the direction its face falls; else the refusal of
        cannot."""
        s = self.scale
        storey = self.container(roof)
        S = _cs_placement(storey.ObjectPlacement) if storey is not None else None
        R = _cs_placement(roof.ObjectPlacement) if self.movable(roof) else None
        shape = {v: k for k, v in self.ROOF_TYPES.items()}.get(str(getattr(roof, "ShapeType" if self.m.schema == "IFC2X3" else "PredefinedType", None) or ""))
        parts = [o for rel in (getattr(roof, "IsDecomposedBy", None) or ()) for o in (rel.RelatedObjects or ()) if o.is_a("IfcSlab")]
        why, faces = None, []
        rel = _cs_compose(_cs_invert(S), R) if S is not None and R is not None else None
        if rel is None or abs(rel[2][2] - 1.0) > 1e-6:
            why = "it is in no storey, or its placement cannot be read"
        elif shape is None:
            why = "its shape is none of create_roof's (gable, hip, shed, flat)"
        elif not parts:
            why = "it has no roof slabs"
        for slab in parts if why is None else ():
            P = _cs_placement(getattr(slab, "ObjectPlacement", None))
            rep = getattr(slab, "Representation", None)
            bodies = [r for r in (rep.Representations if rep is not None else ()) if (r.RepresentationIdentifier or "") == "Body"]
            items = list(bodies[0].Items or ()) if len(bodies) == 1 else []
            item = items[0] if len(items) == 1 and items[0].is_a("IfcExtrudedAreaSolid") and items[0].SweptArea.is_a() == "IfcArbitraryClosedProfileDef" else None
            inner = _cs_compose(_cs_invert(R), P) if P is not None else None
            if item is None or inner is None or any(abs(inner[i][j] - (1.0 if i == j else 0.0)) > 1e-6 for i in range(3) for j in range(3)) or max(abs(c) for c in inner[3]) > self.u(1e-6):
                why = "its slab #%d is not one of create_roof's faces" % slab.id()
                break
            M = _cs_compose(inner, _cs_axes(item.Position))
            n, h = M[2], math.hypot(M[2][0], M[2][1])
            d = _cs_unit([float(c) for c in item.ExtrudedDirection.DirectionRatios])
            faces.append({"slab": slab, "rep": bodies[0], "item": item, "pitch": math.degrees(math.atan2(h, n[2])), "fall": (n[0] / h, n[1] / h) if h > 1e-9 else None,
                          "thickness": float(item.Depth) * abs(d[2]) * s if d is not None else 0.0, "corners": [_cs_at(M, (q[0], q[1], 0.0)) for q in _cs_profile_points(item.SweptArea)]})
        if why is None:
            xs, ys = [c[0] * s for x in faces for c in x["corners"]], [c[1] * s for x in faces for c in x["corners"]]
            overhang, pitch, thickness = -min(xs), faces[0]["pitch"], faces[0]["thickness"]
            if abs(overhang + min(ys)) > 0.001 or overhang < -0.001 or thickness <= 0 or any(abs(x["pitch"] - pitch) > 0.01 or abs(x["thickness"] - thickness) > 0.0005 for x in faces):
                why = "its faces are not of one pitch, overhang and thickness"
        if why is None:
            overhang = max(0.0, overhang)
            length, width = max(xs) - overhang, max(ys) - overhang
            falls = [x["fall"] for x in faces if x["fall"] is not None]
            ridge = None
            if shape == "gable":
                ridge = "x" if all(abs(fall[0]) < 1e-6 for fall in falls) else "y"
            elif shape == "shed" and falls and abs(falls[0][0]) > 0.5:
                ridge = "x"
            want = [fall for fall, _ in _cs_roof_faces(shape, length, width, overhang, ridge)]
            if len(want) != len(faces) or (shape != "flat" and any(sum(1 for x in faces if x["fall"] and x["fall"][0] * w[0] + x["fall"][1] * w[1] > 0.999) != 1 for w in want)):
                why = "its slabs are not the faces create_roof makes"
        if why:
            raise self.cannot(roof, why, "create_roof")
        return {"S": S, "shape": shape, "base": rel[3][2] * s, "pitch": 0.0 if shape == "flat" else pitch, "length": length, "width": width,
                "overhang": overhang, "thickness": thickness, "ridge": ridge, "faces": faces}

    def edit_roof(self, roof, op):
        """edit_element on a roof (roof_frame): base (the eaves' height above the storey) lifts it, and pitch and overhang make its faces
        anew over the same rectangle as create_roof does (roof_solid), each slab keeping its GlobalId, its type and its layers with a
        new body; a flat roof has no pitch."""
        f = self.roof_frame(roof)
        flat = f["shape"] == "flat"
        if flat and op.get("pitch") is not None:
            raise DataspatiumError("roof #%d is flat and has no pitch; another shape is a new roof, which only the person can ask for" % roof.id())
        pitch = _cs_num(op, "pitch", unit="degrees") if op.get("pitch") is not None else f["pitch"]
        if not flat and not 0.0 < pitch <= 75.0:
            raise DataspatiumError("pitch must be more than 0 and at most 75 degrees")
        overhang = _cs_num(op, "overhang") if op.get("overhang") is not None else f["overhang"]
        if overhang < 0:
            raise DataspatiumError("overhang must be zero or more (metres)")
        base = _cs_num(op, "base") if op.get("base") is not None else f["base"]
        if abs(base - f["base"]) > 1e-9:
            self.shift(roof, f["S"], (0.0, 0.0, self.u(base - f["base"])))
        if abs(pitch - f["pitch"]) > 1e-9 or abs(overhang - f["overhang"]) > 1e-9:
            p = math.radians(pitch)
            for fall, corners in _cs_roof_faces(f["shape"], f["length"], f["width"], overhang, f["ridge"]):
                face = f["faces"][0] if flat else next(x for x in f["faces"] if x["fall"] and x["fall"][0] * fall[0] + x["fall"][1] * fall[1] > 0.999)
                self.replace_item(face["rep"], face["item"], self.roof_solid(fall, corners, f["length"], f["width"], p, f["thickness"]))
                self.touch(face["slab"])
        self.touch(roof)

    def roof_solid(self, fall, corners, length, width, pitch, thickness):
        """The body of one face of a roof over [0, length] x [0, width] in metres, as op_create_roof draws it: the face's outline in its
        own plane (Axis the normal, RefDirection along the eaves), extruded straight up by thickness / cos(pitch)."""
        sin, cos, tan = math.sin(pitch), math.cos(pitch), math.tan(pitch)
        fx, fy = fall
        eaves = max(x * fx + y * fy for x, y in ((0.0, 0.0), (length, 0.0), (length, width), (0.0, width)))
        pts = [(x, y, (eaves - x * fx - y * fy) * tan) for x, y in corners]
        along, up, normal = (-fy, fx, 0.0), (-fx * cos, -fy * cos, sin), (fx * sin, fy * sin, cos)
        o = pts[0]
        face = [[self.u(_cs_dot([q[k] - o[k] for k in range(3)], axis)) for axis in (along, up)] for q in pts]
        profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, self.closed(face))
        position = self.m.createIfcAxis2Placement3D(self.point(self.u(o[0]), self.u(o[1]), self.u(o[2])), self.direction(*normal), self.direction(*along))
        return self.m.createIfcExtrudedAreaSolid(profile, position, self.direction(0.0, sin, cos), self.u(thickness / cos))

    def parameters(self, e):
        """What edit_element reads of an element, for the read tool get_parameters: its id, GlobalId, class, name and kind (wall, slab,
        opening, roof, or null when edit_element can change only its name), and its kind's measures in metres and degrees: a wall's start
        and end in its storey's plane, thickness, height and type; a slab's outline, thickness and type; an opening's (also for its door
        or window) wall, offset, width, height and sill; a roof's shape, pitch, overhang and base. A note says why an element of another
        form has no measures."""
        import ifcopenshell.util.element as el
        kind = self.edit_kind(e)
        out = {"id": e.id(), "guid": getattr(e, "GlobalId", None), "ifc_class": e.is_a(), "name": _ifc_text(getattr(e, "Name", None)), "kind": kind if kind in self.EDITS else None}
        t = el.get_type(e) if e.is_a("IfcObject") else None
        typed = _ifc_text(t.Name) if t is not None else None

        def r6(v):
            return round(float(v), 6)
        try:
            if kind == "wall":
                f = self.wall_frame(e)
                out.update(start=[r6(v) for v in f["start"]], end=[r6(v) for v in f["end"]], thickness=r6(f["thickness"]), height=r6(f["height"]), type=typed)
            elif kind == "slab":
                f = self.slab_frame(e)
                out.update(outline=[[r6(v) for v in p] for p in f["outline"]], thickness=r6(f["thickness"]), type=typed)
            elif kind == "opening":
                f = self.opening_frame(e)
                out.update(wall=f["wall"].id(), offset=r6(f["offset"]), width=r6(f["width"]), height=r6(f["height"]), sill=r6(f["sill"]))
            elif kind == "roof":
                f = self.roof_frame(e)
                out.update(shape=f["shape"], pitch=r6(f["pitch"]), overhang=r6(f["overhang"]), base=r6(f["base"]))
            elif kind == "roof slab":
                out["note"] = self.edit_refusal(e, kind, ["pitch"])
            else:
                out["note"] = "edit_element changes only the name of a %s" % e.is_a()
        except DataspatiumError as exc:
            out.update(kind=None, note=str(exc))
        return out

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
            self.building_height(elevation)
        if site_name:
            site.Name = site_name
        self.touch(site)
        if crs is None:
            return
        if self.m.schema == "IFC2X3":
            self.notes.append("the map conversion to %s was skipped: IFC2X3 has no IfcMapConversion; the site's latitude, longitude and elevation were set" % crs)
            return
        self.map_conversion(crs, eastings, northings, 0.0 if elevation is None else elevation, rotation, op.get("vertical_datum"))

    def building_height(self, elevation):
        """The buildings' height above the sea in IfcBuilding.ElevationOfRefHeight (the model origin's elevation plus the building's
        placement), as the Swedish guidance asks, in IFC4 and IFC2X3. IFC4X3 deprecates the attribute (bSI rule IFC102, decision
        B-60.2): there the height is the map conversion's OrthogonalHeight alone."""
        if self.m.schema == "IFC4X3":
            return
        for building in self.m.by_type("IfcBuilding"):
            frame = _cs_placement(building.ObjectPlacement)
            building.ElevationOfRefHeight = self.u(elevation) + (frame[3][2] if frame is not None else 0.0)
            self.touch(building)

    def parent_contexts(self):
        """The representation contexts that are not sub-contexts (Model, Plan …), the model context made when the file has none."""
        found = [c for c in self.m.by_type("IfcGeometricRepresentationContext") if not c.is_a("IfcGeometricRepresentationSubContext")]
        return found or [self.model_context()]

    def metre(self):
        """An IfcSIUnit for the metre, the MapUnit of a projected CRS: the project's length unit when that is the metre, else one the
        file has, else a new one (bSI rule GRF005: the CRS in metres, the conversion's Scale from the file's unit)."""
        def plain(u):
            return u is not None and u.is_a("IfcSIUnit") and u.UnitType == "LENGTHUNIT" and u.Name == "METRE" and not u.Prefix
        unit = self.length_unit()
        if plain(unit):
            return unit
        return next((u for u in self.m.by_type("IfcSIUnit") if plain(u)), None) or self.m.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Name="METRE")

    def map_conversion(self, crs, eastings, northings, height, rotation, vertical=None):
        """One IfcProjectedCRS named by the EPSG code, with its datum, projection and zone, a Description in plain words and the
        VerticalDatum when the code does not give the height system (RH 2000 by default for SWEREF 99), and one IfcMapConversion to it
        from every parent representation context, all with the same values (bSI rule GRF001), made or updated, never doubled. The
        MapUnit is the metre and the conversion's Scale the file's length unit in metres (GRF005), so the eastings, northings and
        height, which come in metres, are written as they are. The height is the model origin's height above the vertical datum,
        which in IFC4X3 also carries the building's height (IfcBuilding.ElevationOfRefHeight is deprecated there)."""
        contexts = self.parent_contexts()
        conversions = list(self.m.by_type("IfcMapConversion"))
        target = next((c.TargetCRS for c in conversions if c.TargetCRS is not None and c.TargetCRS.is_a("IfcProjectedCRS")), None)
        if target is None:
            found = self.m.by_type("IfcProjectedCRS")
            target = found[0] if found else None
        code = int(crs[5:])
        datum, projection, zone = _cs_crs_facts(crs)
        if datum is None and self.m.schema == "IFC4":
            datum = ""  # IFC4 requires a datum; an empty identifier says the app does not know this code's
            self.notes.append("the geodetic datum of %s is not known to the app; IFC4 requires one, so it is written empty" % crs)
        vertical = _cs_crs_vertical(code, vertical)
        values = {"Name": crs, "Description": _cs_crs_description(code, vertical), "GeodeticDatum": datum, "VerticalDatum": vertical,
                  "MapProjection": projection, "MapZone": zone, "MapUnit": self.metre()}
        if target is None:
            target = self.m.create_entity("IfcProjectedCRS", **values)
            self.register(target, ref=False)
        else:
            for key, value in values.items():
                setattr(target, key, value)
            self.touch(target)
        angle = math.radians(rotation)
        for context in contexts:
            conversion = next((c for c in conversions if c.SourceCRS is not None and c.SourceCRS.id() == context.id()), None)
            values = {"SourceCRS": context, "TargetCRS": target, "Eastings": float(eastings), "Northings": float(northings), "OrthogonalHeight": float(height),
                      "XAxisAbscissa": math.cos(angle), "XAxisOrdinate": math.sin(angle), "Scale": float(self.scale)}
            if conversion is None:
                conversion = self.m.create_entity("IfcMapConversion", **values)
                self.register(conversion, ref=False)
            else:
                for key, value in values.items():
                    setattr(conversion, key, value)
                self.touch(conversion)

    # -- types with material layers, wall joins and base quantities (recommendations 3, 5 and 6 of the native IFC study)
    TYPE_KINDS = {"wall": ("IfcWallType", "NOTDEFINED"), "slab": ("IfcSlabType", "FLOOR"), "roof": ("IfcSlabType", "ROOF"),
                  "covering": ("IfcCoveringType", "NOTDEFINED")}
    MAX_LAYERS = 20
    # IfcMaterial.Category: the categories IfcOpenShell's add_material recommends; IfcMaterialLayer.Category: the keywords of the
    # schema's documentation of the attribute, (IFC4, IFC4X3). IFC2X3 has neither attribute.
    MATERIAL_CATEGORIES = ("concrete", "steel", "aluminium", "block", "brick", "stone", "wood", "glass", "gypsum", "plastic", "earth")
    LAYER_ROLES = {"load_bearing": ("LoadBearing", "LoadBearing"), "insulation": ("Insulation", "Insulation"),
                   "inner_finish": ("Finish", "Inner finish"), "outer_finish": ("Finish", "Outer finish")}

    def op_define_type(self, op):
        """A type with its material layers and a ref, for the type of later create steps: kind wall makes an IfcWallType, slab an
        IfcSlabType and roof an IfcSlabType ROOF for create_roof's roof slabs (the IfcRoof only aggregates them, and IFC2X3 has no
        IfcRoofType), and covering an IfcCoveringType for create_element's coverings (its layers from the outer face in), with an
        IfcMaterialLayerSet named after it; the kinds without layers go to define_element_type. The layers come in metres from a wall's right side to its left,
        seen from its start toward its end, and from a slab's or a roof's top down; a roof type keeps them from the bottom up, the
        order in which its slabs' usage lays them from the underside. A layer's optional category goes to its material
        (IfcMaterial.Category, one of MATERIAL_CATEGORIES; a material the file has already keeps its own and takes one it lacks) and
        its optional role to the layer (IfcMaterialLayer.Category, LAYER_ROLES in the file's schema); IFC2X3 has neither, which the
        notes say. The PredefinedType is predefined_type, by default NOTDEFINED, FLOOR and ROOF, from the class's list in the file's
        schema (_cs_type_values). A type of the same class and name, in any case, in the file is an error that names its GlobalId, to
        give as type instead (a server's copy of the file keeps the GlobalIds, not necessarily the STEP ids)."""
        kind = str(op.get("kind") or "").strip().lower()
        if kind in self.ELEMENT_TYPE_KINDS:
            return self.define_element_type(op, kind)
        if kind not in self.TYPE_KINDS:
            raise DataspatiumError("kind must be wall, slab, roof, covering, column, beam, footing, railing, door or window")
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

    # -- more building elements, straight stairs, and door and window types (recommendations 4 and 11 of the native IFC study)
    # The classes create_element makes; IfcFurniture is IfcFurnishingElement in IFC2X3, and IfcStair is a straight stair.
    ELEMENT_CLASSES = ("IfcColumn", "IfcBeam", "IfcMember", "IfcFooting", "IfcPile", "IfcCovering", "IfcRailing", "IfcChimney",
                       "IfcShadingDevice", "IfcSanitaryTerminal", "IfcFurniture", "IfcFurnishingElement", "IfcStair")
    ELEMENT_TYPE_KINDS = {"column": ("IfcColumnType", "COLUMN"), "beam": ("IfcBeamType", "BEAM"), "footing": ("IfcFootingType", "NOTDEFINED"),
                          "railing": ("IfcRailingType", "NOTDEFINED"), "door": ("IfcDoorType", "DOOR"), "window": ("IfcWindowType", "WINDOW")}
    # The OperationTypes and PartitioningTypes whose geometry IfcOpenShell draws; a window's as (panels, columns, rows).
    DOOR_OPERATIONS = ("SINGLE_SWING_LEFT", "SINGLE_SWING_RIGHT", "DOUBLE_SWING_LEFT", "DOUBLE_SWING_RIGHT", "DOUBLE_DOOR_SINGLE_SWING",
                       "DOUBLE_DOOR_DOUBLE_SWING", "SLIDING_TO_LEFT", "SLIDING_TO_RIGHT", "DOUBLE_DOOR_SLIDING")
    WINDOW_PARTITIONS = {"SINGLE_PANEL": (1, 1, 1), "DOUBLE_PANEL_VERTICAL": (2, 2, 1), "DOUBLE_PANEL_HORIZONTAL": (2, 1, 2),
                         "TRIPLE_PANEL_VERTICAL": (3, 3, 1), "TRIPLE_PANEL_HORIZONTAL": (3, 1, 3), "TRIPLE_PANEL_BOTTOM": (3, 2, 2),
                         "TRIPLE_PANEL_TOP": (3, 2, 2), "TRIPLE_PANEL_LEFT": (3, 2, 2), "TRIPLE_PANEL_RIGHT": (3, 2, 2)}
    LINING = 0.05  # metres: IfcOpenShell's lining thickness and the least lining depth
    PANEL = 0.035  # the depth of a door panel and of a window frame
    PANEL_X = 0.025  # from the lining's side to the panel or frame
    THRESHOLD = 0.025  # a door's threshold, high
    MAX_RISERS = 60

    def make(self, ifc_class, **values):
        """An entity with the attributes the file's schema gives its class; the others, and those given as None, are left out."""
        names = {a.name() for a in self.check_class(ifc_class).all_attributes()}
        return self.m.create_entity(ifc_class, **{k: v for k, v in values.items() if k in names and v is not None})

    def property_definition(self, ifc_class, name, **values):
        """A rooted property definition of the type, such as IfcDoorLiningProperties, with lengths already in file units."""
        import ifcopenshell.guid
        return self.make(ifc_class, GlobalId=ifcopenshell.guid.new(), OwnerHistory=self.owner, Name=name, **values)

    # IFC4.3 deprecates these property definitions (buildingSMART's rule IFC102) for the standard sets of the same name and values.
    LINING_SETS = {"IfcDoorLiningProperties": "Pset_DoorLiningProperties", "IfcDoorPanelProperties": "Pset_DoorPanelProperties",
                   "IfcWindowLiningProperties": "Pset_WindowLiningProperties"}

    def lining_properties(self, t, ifc_class, name, **values):
        """A type's lining or panel properties: the property definition, or in IFC4.3 the standard property set that replaces it,
        typed by its template (lengths already in file units). Returns the definition to add to HasPropertySets, None for a set."""
        if self.m.schema != "IFC4X3":
            return self.property_definition(ifc_class, name, **values)
        import ifcopenshell.api.pset
        import ifcopenshell.util.pset
        name = self.LINING_SETS[ifc_class]
        template = ifcopenshell.util.pset.get_template("IFC4X3").get_by_name(name)
        listed = {x.Name for x in (template.HasPropertyTemplates or ()) if x.TemplateType == "P_ENUMERATEDVALUE"} if template is not None else set()
        pset = ifcopenshell.api.pset.add_pset(self.m, product=t, name=name)
        # An enumerated property (PanelOperation, PanelPosition) takes its value as a list, so that it is written as one (PSE001).
        ifcopenshell.api.pset.edit_pset(self.m, pset=pset, properties={k: ([v] if k in listed else v) for k, v in values.items() if v is not None})
        return None

    def relate_type(self, e, t):
        """Type an occurrence that has no layers: the type's IfcRelDefinesByType (one per type), and no PredefinedType or ObjectType of
        the occurrence's own when the type has a PredefinedType other than NOTDEFINED (OJT001). Its material is the type's."""
        import ifcopenshell.guid
        rel = next(iter(getattr(t, "Types", None) or getattr(t, "ObjectTypeOf", None) or ()), None)
        if rel is None:
            self.m.create_entity("IfcRelDefinesByType", GlobalId=ifcopenshell.guid.new(), OwnerHistory=self.owner, RelatedObjects=[e], RelatingType=t)
        else:
            rel.RelatedObjects = list(rel.RelatedObjects or ()) + [e]
        own = str(getattr(t, "PredefinedType", None) or "")
        if own and own != "NOTDEFINED":
            if getattr(e, "PredefinedType", None) is not None:
                e.PredefinedType = None
            if getattr(e, "ObjectType", None) is not None:
                e.ObjectType = None

    def define_element_type(self, op, kind):
        """define_type for the kinds without layers: an IfcColumnType, IfcBeamType, IfcFootingType, IfcRailingType, IfcDoorType or
        IfcWindowType (IfcDoorStyle and IfcWindowStyle in IFC2X3) with a ref, its PredefinedType (by default COLUMN, BEAM,
        NOTDEFINED, NOTDEFINED, DOOR and WINDOW) checked against the class's list, and the material, when given, as an IfcMaterial of
        the type that its occurrences take. A door and a window get their geometry (door_geometry, window_geometry). A type of the
        same class and name in the file is an error that names its GlobalId."""
        ifc_class, default = self.ELEMENT_TYPE_KINDS[kind]
        old = self.m.schema == "IFC2X3"
        if old and kind in ("door", "window"):
            ifc_class = "IfcDoorStyle" if kind == "door" else "IfcWindowStyle"
        name = str(op.get("name") or "").strip()[:255]
        if not name:
            raise DataspatiumError("the type needs a name")
        if op.get("layers"):
            raise DataspatiumError("a %s type has no layers; give its material as material, or null" % kind)
        self.check_class(ifc_class)
        twin = next((t for t in self.m.by_type(ifc_class) if str(t.Name or "").strip().lower() == name.lower()), None)
        if twin is not None:
            raise DataspatiumError("the model has an %s named %r already (GlobalId %s, id %d); give its GlobalId as type, or choose another name"
                                   % (ifc_class, _ifc_text(twin.Name), twin.GlobalId, twin.id()))
        value = str(op.get("predefined_type") or "").strip().upper() or None
        if value == "USERDEFINED":
            raise DataspatiumError("USERDEFINED needs the name of a kind of its own, which define_type does not take; choose a value from the class's list, or NOTDEFINED")
        category = str(op.get("material_category") or "").strip().lower() or None
        if category is not None and category not in self.MATERIAL_CATEGORIES:
            raise DataspatiumError("material_category must be one of %s, or null" % ", ".join(self.MATERIAL_CATEGORIES))
        t = self.root(ifc_class, name)
        if _ifc_enum_items(self.check_class(ifc_class)) is not None:
            self.check_enum(t, value or default)
            t.PredefinedType = value or default
        elif value:
            self.notes.append("type %s: %s has no PredefinedType in %s, so %s was left out" % (name, ifc_class, self.m.schema, value))
        material = str(op.get("material") or "").strip()[:255]
        if material:
            if old and category:
                self.notes.append("type %s: IFC2X3 has no material categories, so it was left out" % name)
            self.associate(t, self.named_material(material, None if old else category))
        if kind == "door":
            self.door_geometry(t, op)
        elif kind == "window":
            self.window_geometry(t, op)
        self.register(t)

    def fill_size(self, op, width, height):
        """(width, height, lining depth) in metres of a door or window type: the op's, else the defaults given and LINING."""
        w = _cs_num(op, "width", width, positive=True)
        h = _cs_num(op, "height", height, positive=True)
        d = _cs_num(op, "lining_depth", self.LINING, positive=True)
        if not 0.3 <= w <= 20.0 or not 0.3 <= h <= 20.0:
            raise DataspatiumError("width and height must be 0.3 to 20 m")
        if not self.LINING <= d <= 2.0:
            raise DataspatiumError("lining_depth must be %g to 2 m" % self.LINING)
        return w, h, d

    def type_geometry(self, t, rep, width, height):
        """The type's geometry as its representation map, which its occurrences map; the size for create_opening."""
        t.RepresentationMaps = list(t.RepresentationMaps or ()) + [self.m.createIfcRepresentationMap(self.axis3(0, 0, 0), rep)]
        self.fill_sizes[t.id()] = (width, height)

    def door_geometry(self, t, op):
        """A door type's OperationType (one of DOOR_OPERATIONS), its lining and panel properties and IfcOpenShell's door geometry in
        the type's coordinates: x across the opening from 0 to the width, z up from the floor, and the lining from y = 0 to the lining
        depth with the panel at its far side, flush with y = depth, so that the door opens toward +y; a *_LEFT door has its hinges at
        x = 0, on the left as seen in the direction it opens. The threshold fills the lining's depth and there are no casings, which a
        lining shallower than the wall would leave hanging in the air."""
        import ifcopenshell.api.geometry
        operation = str(op.get("operation") or "SINGLE_SWING_LEFT").strip().upper()
        if operation not in self.DOOR_OPERATIONS:
            raise DataspatiumError("operation must be one of %s" % ", ".join(self.DOOR_OPERATIONS))
        self.check_enum(t, operation, "OperationType")
        t.OperationType = operation
        if self.m.schema == "IFC2X3":
            t.ConstructionType = "NOTDEFINED"
            t.Sizeable = False
        t.ParameterTakesPrecedence = False  # the geometry, not the properties, is the door
        w, h, d = self.fill_size(op, 0.9, 2.1)
        u = self.u
        panel_y = d - self.PANEL
        rep = ifcopenshell.api.geometry.add_door_representation(
            self.m, context=self.body(), overall_height=u(h), overall_width=u(w), operation_type=operation, unit_scale=self.scale,
            lining_properties={"LiningDepth": u(d), "LiningThickness": u(self.LINING), "LiningOffset": 0.0, "LiningToPanelOffsetX": u(self.PANEL_X),
                               "LiningToPanelOffsetY": u(panel_y), "TransomThickness": 0.0, "CasingThickness": 0.0, "ThresholdDepth": u(d),
                               "ThresholdThickness": u(self.THRESHOLD), "ThresholdOffset": 0.0},
            panel_properties={"PanelDepth": u(self.PANEL), "FrameDepth": u(self.PANEL), "FrameThickness": u(self.PANEL)})
        how = "SLIDING" if "SLIDING" in operation else "DOUBLE_ACTING" if "DOUBLE_SWING" in operation else "SWINGING"
        panels = [("LEFT", 0.5), ("RIGHT", 0.5)] if "DOUBLE_DOOR" in operation else [("MIDDLE", 1.0)]
        lining = self.lining_properties(t, "IfcDoorLiningProperties", "Lining", LiningDepth=u(d), LiningThickness=u(self.LINING), ThresholdDepth=u(d),
                                        ThresholdThickness=u(self.THRESHOLD), LiningOffset=0.0, ThresholdOffset=0.0,
                                        LiningToPanelOffsetX=u(self.PANEL_X), LiningToPanelOffsetY=u(panel_y))
        # One standard set holds one panel, so a door of two panels gets none in IFC4.3; the geometry has both.
        leaves = [self.lining_properties(t, "IfcDoorPanelProperties", "Panel %d" % (i + 1), PanelDepth=u(self.PANEL), PanelOperation=how,
                                         PanelWidth=share, PanelPosition=where) for i, (where, share) in enumerate(panels) if self.m.schema != "IFC4X3" or len(panels) == 1]
        t.HasPropertySets = list(t.HasPropertySets or ()) + [x for x in [lining] + leaves if x is not None]
        self.type_geometry(t, rep, w, h)

    def window_geometry(self, t, op):
        """A window type's PartitioningType (OperationType in IFC2X3; one of WINDOW_PARTITIONS), its lining properties and
        IfcOpenShell's window geometry in the type's coordinates, as a door's (door_geometry): the lining from y = 0 to its depth, the
        frames flush with y = depth, and the mullions and transoms dividing the width and the height evenly."""
        import ifcopenshell.api.geometry
        part = str(op.get("partitioning") or "SINGLE_PANEL").strip().upper()
        if part not in self.WINDOW_PARTITIONS:
            raise DataspatiumError("partitioning must be one of %s" % ", ".join(self.WINDOW_PARTITIONS))
        old = self.m.schema == "IFC2X3"
        attribute = "OperationType" if old else "PartitioningType"
        self.check_enum(t, part, attribute)
        setattr(t, attribute, part)
        if old:
            t.ConstructionType = "NOTDEFINED"
            t.Sizeable = False
        t.ParameterTakesPrecedence = False
        w, h, d = self.fill_size(op, 1.2, 1.2)
        u = self.u
        panels, cols, rows = self.WINDOW_PARTITIONS[part]
        lining = {"LiningDepth": u(d), "LiningThickness": u(self.LINING), "LiningOffset": 0.0, "LiningToPanelOffsetX": u(self.PANEL_X),
                  "LiningToPanelOffsetY": 0.0, "MullionThickness": u(self.LINING), "TransomThickness": u(self.LINING),
                  "FirstMullionOffset": u(w / cols), "SecondMullionOffset": u(2.0 * w / 3.0), "FirstTransomOffset": u(h / rows), "SecondTransomOffset": u(2.0 * h / 3.0)}
        rep = ifcopenshell.api.geometry.add_window_representation(
            self.m, context=self.body(), overall_height=u(h), overall_width=u(w), partition_type=part, unit_scale=self.scale, lining_properties=lining,
            panel_properties=[{"FrameDepth": u(self.PANEL), "FrameThickness": u(self.PANEL)} for _ in range(panels)])
        # The lining properties give the mullions' and transoms' offsets as shares of the width and the height.
        extra = {}
        if cols > 1:
            extra.update(MullionThickness=u(self.LINING), FirstMullionOffset=1.0 / cols, SecondMullionOffset=2.0 / 3.0 if cols == 3 else None)
        if rows > 1:
            extra.update(TransomThickness=u(self.LINING), FirstTransomOffset=1.0 / rows, SecondTransomOffset=2.0 / 3.0 if rows == 3 else None)
        props = self.lining_properties(t, "IfcWindowLiningProperties", "Lining", LiningDepth=u(d), LiningThickness=u(self.LINING), LiningOffset=0.0,
                                       LiningToPanelOffsetX=u(self.PANEL_X), LiningToPanelOffsetY=u(d - self.PANEL), **extra)
        if props is not None:
            t.HasPropertySets = list(t.HasPropertySets or ()) + [props]
        self.type_geometry(t, rep, w, h)

    FILL_TYPES = {"IfcDoorType": "door", "IfcDoorStyle": "door", "IfcWindowType": "window", "IfcWindowStyle": "window"}

    def fill_type(self, op, fill):
        """For create_opening with a type: {type, fill, width, height, depth, map}, the fill from the type's class (a fill given must
        match it), the size in metres from define_type, else from a door or window of the type in the file (OverallWidth and
        OverallHeight), else the op's width and height, which must otherwise equal it; the lining's depth from the type's lining
        properties (0 without them), and the type's Body representation map; None without a type."""
        ref = op.get("type")
        if ref is None or str(ref).strip() == "":
            return None
        t = self.entity(ref)
        kind = self.FILL_TYPES.get(t.is_a())
        if kind is None:
            raise DataspatiumError("type must name a door or window type (IfcDoorType, IfcWindowType), as define_type makes them, not the %s %r" % (t.is_a(), _ifc_text(getattr(t, "Name", None))))
        if fill and fill != kind:
            raise DataspatiumError("type %r is a %s type, so fill must be %s or null" % (_ifc_text(t.Name), kind, kind))
        size = self.fill_sizes.get(t.id())
        if size is None:
            for rel in getattr(t, "Types", None) or getattr(t, "ObjectTypeOf", None) or ():
                size = next(((float(o.OverallWidth) * self.scale, float(o.OverallHeight) * self.scale) for o in rel.RelatedObjects or ()
                             if getattr(o, "OverallWidth", None) and getattr(o, "OverallHeight", None)), None)
        if size is None:
            if op.get("width") is None or op.get("height") is None:
                raise DataspatiumError("type %r has no %s in the model to take its size from; give width and height" % (_ifc_text(t.Name), kind))
            size = (_cs_num(op, "width", positive=True), _cs_num(op, "height", positive=True))
        for key, v in zip(("width", "height"), size):
            if op.get(key) is not None and abs(_cs_num(op, key, positive=True) - v) > 0.0005:
                raise DataspatiumError("%s %g m differs from the %g m of type %r; leave width and height null" % (key, _cs_num(op, key), v, _ifc_text(t.Name)))
        lining = next((p for p in (getattr(t, "HasPropertySets", None) or ()) if p.is_a() in ("IfcDoorLiningProperties", "IfcWindowLiningProperties")), None)
        depth = float(lining.LiningDepth) * self.scale if lining is not None and lining.LiningDepth else 0.0
        if lining is None:  # IFC4.3: the standard set that replaces the deprecated definition (lining_properties)
            import ifcopenshell.util.element as el
            value = el.get_pset(t, "Pset_DoorLiningProperties" if kind == "door" else "Pset_WindowLiningProperties", "LiningDepth")
            depth = float(value) * self.scale if value else 0.0
        maps = [r for r in (t.RepresentationMaps or ()) if (r.MappedRepresentation.RepresentationIdentifier or "") == "Body"]
        return {"type": t, "fill": kind, "width": size[0], "height": size[1], "depth": depth, "map": maps[0] if maps else None}

    def place_typed_fill(self, e, opening, wall, typed, thickness, side):
        """A typed door or window in its opening, which lies along the wall: flush with the wall's left face (seen from the wall's
        start toward its end; the inside of an outer wall drawn counter-clockwise), its axes the wall's, so that a door opens toward
        that face and a *_LEFT door's hinges are at the opening's side nearest the wall's start; side right turns it around, flush
        with the right face, opening toward it, the hinges of a *_LEFT door at the side nearest the wall's end. The type's
        representation map is mapped as it is; a type without one gets the plain panel of an untyped filling, with a note."""
        side = str(side or "left").strip().lower()
        if side not in ("left", "right"):
            raise DataspatiumError("side must be left or right (seen from the wall's start toward its end), or null for left")
        name = _ifc_text(typed["type"].Name)
        half, depth = thickness / 2.0, self.u(typed["depth"])
        if typed["depth"] <= 0:
            self.notes.append("type %s gives no lining depth (IfcDoorLiningProperties or IfcWindowLiningProperties), so it stands at the wall's face" % name)
        elif depth > thickness + self.u(0.001):
            self.notes.append("the lining of type %s (%.3g m) is deeper than wall %s (%.3g m), so it stands out of the wall's other face"
                              % (name, typed["depth"], _ifc_text(wall.Name), thickness * self.scale))
        if side == "left":
            e.ObjectPlacement = self.placement(opening.ObjectPlacement, 0.0, half - depth, 0.0)
        else:
            e.ObjectPlacement = self.placement(opening.ObjectPlacement, self.u(typed["width"]), depth - half, 0.0, -1.0, 0.0)
        rmap = typed["map"]
        if rmap is None:
            self.notes.append("type %s has no geometry to map, so the %s is drawn as a plain panel" % (name, typed["fill"]))
            leaf = self.u(0.05)
            e.Representation = self.box(self.u(typed["width"]), leaf, self.u(typed["height"]), 0, depth - leaf, 0)  # inside the wall's face
            return
        target = self.m.createIfcCartesianTransformationOperator3D(self.direction(1, 0, 0), self.direction(0, 1, 0), self.point(0, 0, 0), 1.0, self.direction(0, 0, 1))
        rep = self.m.createIfcShapeRepresentation(rmap.MappedRepresentation.ContextOfItems, "Body", "MappedRepresentation", [self.m.createIfcMappedItem(rmap, target)])
        e.Representation = self.m.createIfcProductDefinitionShape(None, None, [rep])

    def op_create_element(self, op):
        """A building element of ELEMENT_CLASSES with a ref: its class (element_class), PredefinedType and ObjectType checked against
        the schema (element_predefined), a SweptSolid body (element_body) placed at `at` and z in the storey's plane, turned by
        rotation (element_placement), and contained in the storey, or for a part (part_of) aggregated in its whole and on the whole's
        storey, never both; a covering's host gets IfcRelCoversBldgElements or IfcRelCoversSpaces (cover), and a type its
        IfcRelDefinesByType (relate_type). IfcStair goes to create_stair."""
        import ifcopenshell.api.aggregate
        cls = self.element_class(op.get("ifc_class"))
        if cls == "IfcStair":
            return self.create_stair(op)
        if op.get("stair") is not None:
            raise DataspatiumError("stair is for IfcStair; %s takes shape" % cls)
        shape = self.element_shape(op.get("shape"))
        whole, storey = self.element_storey(op)
        typ = self.element_type(op, cls)
        depth = shape["depth"]
        layers = self.type_layers(typ) if typ is not None and cls == "IfcCovering" else None
        if layers is not None:
            total = round(sum(float(x.LayerThickness or 0.0) for x in layers.MaterialLayers or ()) * self.scale, 9)
            if depth is not None and abs(depth - total) > 0.0005:
                raise DataspatiumError("depth %g m differs from the %g m of the layers of type %r; leave depth null" % (depth, total, _ifc_text(typ.Name)))
            depth = total
        if depth is None or depth <= 0:
            raise DataspatiumError("shape.depth is required (metres)")
        if op.get("host") not in (None, "") and cls != "IfcCovering":
            raise DataspatiumError("host is for IfcCovering: the element or space it covers; a part of a whole is part_of")
        e = self.root(cls, str(op.get("name") or "").strip()[:255] or cls[3:])
        object_type = str(op.get("object_type") or "").strip()[:255]
        if object_type:
            e.ObjectType = object_type
        self.element_predefined(e, typ, op.get("predefined_type"))
        e.ObjectPlacement = self.element_placement(op, shape, storey, whole)
        e.Representation = self.element_body(shape, depth)
        if whole is not None:
            ifcopenshell.api.aggregate.assign_object(self.m, products=[e], relating_object=whole)
            self.touch(whole)
        else:
            self.contain(e, storey)
        self.cover(op.get("host"), e)
        self.register(e, storey)
        if typ is not None:
            self.relate_type(e, typ)

    def element_class(self, value):
        """The class create_element writes, checked against the file's schema: IfcFurniture and IfcFurnishingElement are IfcFurniture
        in IFC4 and later and IfcFurnishingElement in IFC2X3; a class the schema lacks (IfcChimney in IFC2X3) is an error."""
        name = str(value or "").strip()
        cls = next((c for c in self.ELEMENT_CLASSES if c.lower() == name.lower()), None)
        if cls is None:
            raise DataspatiumError("ifc_class must be one of %s; walls, slabs, roofs, openings with their doors and windows, and spaces have tools of their own"
                                   % ", ".join(self.ELEMENT_CLASSES))
        if cls in ("IfcFurniture", "IfcFurnishingElement"):
            cls = "IfcFurnishingElement" if self.m.schema == "IFC2X3" else "IfcFurniture"
            if cls.lower() != name.lower():
                self.notes.append("%s is written as %s in %s" % (name, cls, self.m.schema))
        try:
            self.check_class(cls)
        except DataspatiumError as exc:
            raise DataspatiumError("%s; create_element cannot make it in this file's schema, so leave it out or ask the person" % exc)
        return cls

    def element_shape(self, shape):
        """create_element's shape, checked: {profile, x, y, radius, outline, depth, along} in metres, depth None when not given."""
        if not isinstance(shape, dict):
            raise DataspatiumError("shape must be {profile, x, y, radius, outline, depth, along}")
        profile = str(shape.get("profile") or "").strip().lower()
        along = str(shape.get("along") or "z").strip().lower()
        if along not in ("z", "x"):
            raise DataspatiumError("shape.along must be z (standing, extruded up) or x (lying, extruded along the rotation)")
        out = {"profile": profile, "along": along, "depth": None if shape.get("depth") is None else _cs_num(shape, "depth", positive=True)}
        if profile == "rectangle":
            out.update(x=_cs_num(shape, "x", positive=True), y=_cs_num(shape, "y", positive=True))
        elif profile == "circle":
            out.update(radius=_cs_num(shape, "radius", positive=True))
        elif profile == "polygon":
            if along != "z":
                raise DataspatiumError("a polygon is an outline in the plan, so shape.along must be z")
            outline = shape.get("outline")
            if not isinstance(outline, (list, tuple)) or len(outline) < 3:
                raise DataspatiumError("shape.outline must be at least three [x, y] corners in metres")
            out.update(outline=[_cs_xy(p, "shape.outline") for p in outline])
        else:
            raise DataspatiumError("shape.profile must be rectangle, circle or polygon")
        return out

    def element_storey(self, op):
        """(whole, storey): without part_of no whole and the named storey; with part_of the whole, an element that can have parts (a
        stair, a roof, a railing ...), and its storey, which a storey given must be."""
        ref = op.get("part_of")
        if ref is None or str(ref).strip() == "":
            return None, self.storey(op.get("storey"))
        whole = self.entity(ref)
        if not whole.is_a("IfcElement") or whole.is_a("IfcFeatureElement") or whole.is_a("IfcDoor") or whole.is_a("IfcWindow"):
            raise DataspatiumError("part_of must name an element that has parts, such as a stair or a roof, not the %s %r" % (whole.is_a(), _ifc_text(getattr(whole, "Name", None))))
        storey = self.container(whole)
        if storey is None or not storey.is_a("IfcBuildingStorey"):
            raise DataspatiumError("the whole %s %r lies on no storey, so its parts cannot be placed" % (whole.is_a(), _ifc_text(whole.Name)))
        if op.get("storey") not in (None, "") and self.storey(op.get("storey")).id() != storey.id():
            raise DataspatiumError("a part lies on its whole's storey %r; leave storey null" % _ifc_text(storey.Name))
        return whole, storey

    def element_type(self, op, cls):
        """The type of a create_element step (a ref, id or GlobalId), which must be of the class's type class in the file's schema
        (IfcColumnType for IfcColumn ...; furniture in IFC2X3 also IfcFurnitureType); None without one."""
        ref = op.get("type")
        if ref is None or str(ref).strip() == "":
            return None
        t = self.entity(ref)
        schema = self.schema_def()
        names = [cls + "Type"] + (["IfcFurnitureType", "IfcSystemFurnitureElementType"] if cls == "IfcFurnishingElement" else [])
        allowed = [n for n in names if _ifc_declaration(schema, n) is not None]
        if not allowed:
            raise DataspatiumError("%s has no type class in %s; leave type null" % (cls, schema.name()))
        if not any(t.is_a(n) for n in allowed):
            raise DataspatiumError("type must name an %s, as define_type makes them, not the %s %r" % (" or ".join(allowed), t.is_a(), _ifc_text(getattr(t, "Name", None))))
        return t

    def element_predefined(self, e, typ, value):
        """The element's PredefinedType: none when its type has one other than NOTDEFINED (OJT001), and a value given must then be
        the type's; otherwise the value, checked against the class's list (USERDEFINED needs ObjectType), or NOTDEFINED. A class
        without PredefinedType in the file's schema (columns in IFC2X3) takes none, with a note when one was given."""
        value = str(value or "").strip().upper() or None
        if _ifc_enum_items(self.check_class(e.is_a())) is None:
            if value:
                self.notes.append("%s %s: %s has no PredefinedType in %s, so %s was left out" % (e.is_a(), _ifc_text(e.Name), e.is_a(), self.m.schema, value))
            return
        own = str(getattr(typ, "PredefinedType", None) or "") if typ is not None else ""
        if own and own != "NOTDEFINED":
            if value and value != own:
                raise DataspatiumError("its type %r is %s, which the element takes; leave predefined_type null or give %s" % (_ifc_text(typ.Name), own, own))
            return
        self.predefined(e, value or "NOTDEFINED")

    def local_placement(self, storey, whole, x, y, z, dx, dy):
        """A placement at (x, y, z) metres in the storey's plane with its x axis along (dx, dy): under the storey's placement, or for a
        part under its whole's, with the same place expressed in the whole's coordinates."""
        if whole is None:
            return self.placement(storey.ObjectPlacement, self.u(x), self.u(y), self.u(z), dx, dy)
        s, w = _cs_placement(storey.ObjectPlacement), _cs_placement(whole.ObjectPlacement)
        if s is None or w is None:
            raise DataspatiumError("the placement of the whole %r cannot be read, so its part cannot be placed in it" % _ifc_text(whole.Name))
        here = _cs_compose(s, [[dx, dy, 0.0], [-dy, dx, 0.0], [0.0, 0.0, 1.0], [self.u(x), self.u(y), self.u(z)]])
        m = _cs_compose(_cs_invert(w), here)
        r = [[round(c, 9) + 0.0 for c in v] for v in m]
        return self.m.createIfcLocalPlacement(whole.ObjectPlacement, self.m.createIfcAxis2Placement3D(self.point(*r[3]), self.direction(*r[2]), self.direction(*r[0])))

    def element_placement(self, op, shape, storey, whole):
        """create_element's placement: at [x, y] and z metres in the storey's plane, its x axis turned rotation degrees counter-clockwise
        from the storey's; a polygon's at the storey's origin, z up, unturned, since its outline is in the storey's plane."""
        z = _cs_num(op, "z", 0.0)
        if shape["profile"] == "polygon":
            return self.local_placement(storey, whole, 0.0, 0.0, z, 1.0, 0.0)
        x, y = _cs_xy(op.get("at"), "at")
        a = math.radians(_cs_num(op, "rotation", 0.0, unit="degrees"))
        return self.local_placement(storey, whole, x, y, z, round(math.cos(a), 12) + 0.0, round(math.sin(a), 12) + 0.0)

    def element_body(self, shape, depth):
        """The SweptSolid body of create_element's shape, depth metres: along z the profile in the element's plan, centred on its
        placement (a polygon's outline as given), extruded up; along x the profile across the element's x axis, x its width along y
        and y its height along z, centred on the axis, extruded along x."""
        u = self.u
        if shape["profile"] == "polygon":
            profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, self.closed([(u(px), u(py)) for px, py in shape["outline"]]))
        else:
            centre = self.m.createIfcAxis2Placement2D(self.point(0.0, 0.0), None)
            if shape["profile"] == "rectangle":
                profile = self.m.createIfcRectangleProfileDef("AREA", None, centre, u(shape["x"]), u(shape["y"]))
            else:
                profile = self.m.createIfcCircleProfileDef("AREA", None, centre, u(shape["radius"]))
        if shape["along"] == "z":
            position = self.axis3(0, 0, 0)
        else:  # the profile's x across (the element's y), its y up (z), extruded along the element's x
            position = self.m.createIfcAxis2Placement3D(self.point(0, 0, 0), self.direction(1, 0, 0), self.direction(0, 1, 0))
        return self.shape(self.m.createIfcExtrudedAreaSolid(profile, position, self.direction(0, 0, 1), u(depth)))

    def cover(self, host_ref, covering):
        """The covering covers its host: IfcRelCoversBldgElements for a building element, IfcRelCoversSpaces for a space (RelatedSpace
        in IFC2X3), one relationship per host; nothing without a host. IFC4 deprecates both relationships (buildingSMART's rule
        IFC102): there the covering is part of the element it covers (IfcRelAggregates, and so in no storey of its own, SPS007), or
        contained in the space it covers."""
        import ifcopenshell.guid
        if host_ref is None or str(host_ref).strip() == "":
            return
        host = self.entity(host_ref)
        if self.m.schema != "IFC2X3" and (host.is_a("IfcSpace") or (host.is_a("IfcElement") and not host.is_a("IfcFeatureElement") and not host.is_a("IfcCovering"))):
            import ifcopenshell.api.aggregate
            import ifcopenshell.api.spatial
            if host.is_a("IfcSpace"):
                self.contain(covering, host)
            else:
                if getattr(covering, "ContainedInStructure", None):
                    ifcopenshell.api.spatial.unassign_container(self.m, products=[covering])
                ifcopenshell.api.aggregate.assign_object(self.m, products=[covering], relating_object=host)
            self.touch(host)
            return
        if host.is_a("IfcSpace"):
            rel_class, relating = "IfcRelCoversSpaces", "RelatedSpace" if self.m.schema == "IFC2X3" else "RelatingSpace"
        elif host.is_a("IfcElement") and not host.is_a("IfcFeatureElement") and not host.is_a("IfcCovering"):
            rel_class, relating = "IfcRelCoversBldgElements", "RelatingBuildingElement"
        else:
            raise DataspatiumError("host must name a building element or a space, not the %s %r" % (host.is_a(), _ifc_text(getattr(host, "Name", None))))
        rel = next((r for r in self.m.by_type(rel_class) if getattr(r, relating, None) == host), None)
        if rel is None:
            self.m.create_entity(rel_class, GlobalId=ifcopenshell.guid.new(), OwnerHistory=self.owner, RelatedCoverings=[covering], **{relating: host})
        else:
            rel.RelatedCoverings = list(rel.RelatedCoverings or ()) + [covering]
        self.touch(host)

    def create_stair(self, op):
        """create_element's IfcStair: a straight stair (STRAIGHT_RUN_STAIR; ShapeType in IFC2X3) with a ref, contained in the storey at
        `at` and z, rising in the direction of rotation, that aggregates one sloped IfcStairFlight STRAIGHT (flight_solid) with its
        number of risers and treads, riser height and tread length as attributes and in Pset_StairFlightCommon, and with a landing
        an IfcSlab LANDING at the top: the flight's width, `landing` metres long, its top at the stair's height and as thick as the
        flight. The parts get no refs; a railing is create_element's part_of the stair."""
        import ifcopenshell.api.aggregate
        import ifcopenshell.api.pset
        if op.get("shape") is not None:
            raise DataspatiumError("an IfcStair takes stair, not shape")
        if op.get("part_of") not in (None, "") or op.get("host") not in (None, ""):
            raise DataspatiumError("a stair is not part_of another element and covers nothing, so part_of and host must be null")
        st = op.get("stair")
        if not isinstance(st, dict):
            raise DataspatiumError("an IfcStair needs stair: {risers, riser_height, tread_length, width, thickness, landing}")
        n = st.get("risers")
        if isinstance(n, float) and n.is_integer():
            n = int(n)
        if not isinstance(n, int) or isinstance(n, bool) or not 2 <= n <= self.MAX_RISERS:
            raise DataspatiumError("stair.risers must be a whole number from 2 to %d" % self.MAX_RISERS)
        h = _cs_num(st, "riser_height", positive=True)
        g = _cs_num(st, "tread_length", positive=True)
        width = _cs_num(st, "width", 1.0, positive=True)
        t = _cs_num(st, "thickness", max(0.2, h), positive=True)
        if t < h - 1e-9:
            raise DataspatiumError("stair.thickness (%g m, the waist at right angles to the slope) must be at least the riser height (%g m)" % (t, h))
        landing = None if st.get("landing") is None else _cs_num(st, "landing", positive=True)
        value = str(op.get("predefined_type") or "").strip().upper() or "STRAIGHT_RUN_STAIR"
        if value != "STRAIGHT_RUN_STAIR":
            raise DataspatiumError("create_element makes straight stairs of one flight: predefined_type STRAIGHT_RUN_STAIR or null")
        storey = self.storey(op.get("storey"))
        x, y = _cs_xy(op.get("at"), "at")
        z = _cs_num(op, "z", 0.0)
        a = math.radians(_cs_num(op, "rotation", 0.0, unit="degrees"))
        typ = self.element_type(op, "IfcStair")
        name = str(op.get("name") or "").strip()[:255] or "Stair"
        stair = self.root("IfcStair", name)
        object_type = str(op.get("object_type") or "").strip()[:255]
        if object_type:
            stair.ObjectType = object_type
        stair.ObjectPlacement = self.placement(storey.ObjectPlacement, self.u(x), self.u(y), self.u(z), round(math.cos(a), 12) + 0.0, round(math.sin(a), 12) + 0.0)
        if self.m.schema == "IFC2X3":
            if self.check_enum(stair, value, "ShapeType"):
                stair.ShapeType = value
        else:
            self.element_predefined(stair, typ, value if typ is None or str(getattr(typ, "PredefinedType", None) or "NOTDEFINED") == "NOTDEFINED" else None)
        self.contain(stair, storey)
        self.register(stair, storey)
        flight = self.root("IfcStairFlight", "%s 1" % name)
        flight.ObjectPlacement = self.placement(stair.ObjectPlacement, 0, 0, 0)
        flight.Representation = self.shape(self.flight_solid(n, h, g, width, t))
        self.predefined(flight, "STRAIGHT")
        # IFC4 deprecates the flight's own counts and measures (buildingSMART's rule IFC102); Pset_StairFlightCommon below has them.
        names = {d.name() for d in self.check_class("IfcStairFlight").all_attributes()} if self.m.schema == "IFC2X3" else set()
        for key, v in (("NumberOfRisers", n), ("NumberOfRiser", n), ("NumberOfTreads", n - 1), ("RiserHeight", self.u(h)), ("TreadLength", self.u(g))):
            if key in names:
                setattr(flight, key, v)
        parts = [flight]
        if landing is not None:
            slab = self.root("IfcSlab", "%s 2" % name)
            slab.ObjectPlacement = self.placement(stair.ObjectPlacement, 0, 0, 0)
            slab.Representation = self.box(self.u(landing), self.u(width), self.u(t), self.u((n - 1) * g), -self.u(width) / 2.0, self.u(n * h - t))
            self.predefined(slab, "LANDING")
            parts.append(slab)
        ifcopenshell.api.aggregate.assign_object(self.m, products=parts, relating_object=stair)
        for part in parts:
            self.register(part, storey, ref=False)
        pset = ifcopenshell.api.pset.add_pset(self.m, product=flight, name="Pset_StairFlightCommon")
        ifcopenshell.api.pset.edit_pset(self.m, pset=pset, properties={"NumberOfRiser": n, "NumberOfTreads": n - 1, "RiserHeight": self.u(h), "TreadLength": self.u(g)})
        if typ is not None:
            self.relate_type(stair, typ)

    def flight_solid(self, n, h, g, width, t):
        """A straight flight in its stair's coordinates (metres in, file units out): the steps' profile in the vertical plane of the
        walking line, x the run and z the rise from the first riser's foot at (0, 0), extruded across the width centred on that line.
        It has the first n - 1 risers of h and the n - 1 treads of g; the last riser is the front edge of the landing or the floor
        above, which begins at x = (n - 1) g, where the flight ends in a vertical cut. Its underside runs parallel to the nosings' line,
        t below it at right angles, and meets the floor, on which the first step stands."""
        drop = t * math.hypot(g, h) / g  # the waist measured vertically, more than h since t >= h
        run, rise = (n - 1) * g, n * h
        pts = [(0.0, 0.0)]
        for i in range(n - 1):
            pts += [(i * g, (i + 1) * h), ((i + 1) * g, (i + 1) * h)]
        if rise - drop <= 1e-9:
            pts.append((run, 0.0))  # a short, thick flight is one block
        else:
            pts += [(run, rise - drop), ((drop - h) * g / h, 0.0)]
        u = self.u
        profile = self.m.createIfcArbitraryClosedProfileDef("AREA", None, self.closed([(u(px), u(pz)) for px, pz in pts]))
        position = self.m.createIfcAxis2Placement3D(self.point(0.0, u(width) / 2.0, 0.0), self.direction(0, -1, 0), self.direction(1, 0, 0))
        return self.m.createIfcExtrudedAreaSolid(profile, position, self.direction(0, 0, 1), u(width))

    def finish(self):
        """After the operations: the joins of the walls the change set created (join_walls), then the base quantities of what it
        created or changed (base_quantities). A fault in either becomes a note in the report, and the operations stand."""
        for step, what in ((self.join_walls, "the wall joins"), (self.base_quantities, "the base quantities")):
            try:
                step()
            except Exception as exc:
                self.notes.append("%s could not be made: %s: %s" % (what, type(exc).__name__, exc))
        self.finish_properties()

    def finish_properties(self):
        """After the base quantities: LoadBearing and Status as the create steps gave them (write_marked) and IsExternal from the
        topology (write_external). A fault becomes a note in the report, and the operations stand."""
        for step, what in ((lambda: self.write_marked("LoadBearing"), "LoadBearing"), (lambda: self.write_marked("Status"), "Status"),
                           (self.write_external, "IsExternal")):
            try:
                step()
            except Exception as exc:
                self.note_once("%s could not be set: %s: %s" % (what, type(exc).__name__, exc))

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
        out are left alone, both with a note. Walls joined before keep their joint; walls whose joins an edit or a move undid (rejoin)
        count as new."""
        new = {r["id"] for r in self.created if r.get("ifc_class") == "IfcWall"} | self.rejoin
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

    # -- LoadBearing, IsExternal, the material's category and the checked property sets (recommendation 13 of the native IFC study,
    # 4, 8 and 9 of the Praxi study): the climate declaration tells its categories apart by them.
    COMMON_SETS = (("IfcWall", "Pset_WallCommon"), ("IfcWallType", "Pset_WallCommon"), ("IfcSlab", "Pset_SlabCommon"),
                   ("IfcSlabType", "Pset_SlabCommon"), ("IfcDoor", "Pset_DoorCommon"), ("IfcWindow", "Pset_WindowCommon"), ("IfcRoof", "Pset_RoofCommon"))
    LENGTH_MEASURES = ("IfcLengthMeasure", "IfcPositiveLengthMeasure", "IfcNonNegativeLengthMeasure")
    ANGLE_MEASURES = ("IfcPlaneAngleMeasure", "IfcPositivePlaneAngleMeasure")
    VALUE_KINDS = {"P_BOUNDEDVALUE": "a bounded value (a range)", "P_LISTVALUE": "a list of values", "P_TABLEVALUE": "a table",
                   "P_REFERENCEVALUE": "a reference to another entity"}
    QUANTITY_MEASURES = {"Q_LENGTH": "IfcLengthMeasure", "Q_AREA": "IfcAreaMeasure", "Q_VOLUME": "IfcVolumeMeasure", "Q_COUNT": "IfcCountMeasure",
                         "Q_WEIGHT": "IfcMassMeasure", "Q_TIME": "IfcTimeMeasure"}

    def material_category(self, op, material):
        """The IfcMaterial.Category assign gives with its material, checked against MATERIAL_CATEGORIES; None without one, and in IFC2X3,
        which has no category (with a note)."""
        category = str(op.get("category") or "").strip().lower() or None
        if category is None:
            return None
        if not material:
            raise DataspatiumError("category goes with a material")
        if category not in self.MATERIAL_CATEGORIES:
            raise DataspatiumError("category must be one of %s, or null" % ", ".join(self.MATERIAL_CATEGORIES))
        if self.m.schema == "IFC2X3":
            self.note_once("IFC2X3 has no material categories, so the category %s of %s was left out" % (category, material))
            return None
        return category

    def note_once(self, text):
        if text not in self.notes:
            self.notes.append(text)

    def element_label(self, e):
        """An element as the notes name it: its ref in this change set, else its id, and its name."""
        ref = next((r["ref"] for r in self.created if r["id"] == e.id() and r.get("ref")), None)
        return "%s %r" % (ref or "#%d" % e.id(), _ifc_text(getattr(e, "Name", None)) or "")

    def property_template(self, name):
        """(template, name) of a set: for one named Pset_... or Qto_... (in any case) IfcOpenShell's template of that name in the file's
        schema and the name as the template spells it; an IFC2X3 file, whose templates lack Pset_Condition and the Qto_ sets, takes
        IFC4's, with a note. A name the schema does not define is an error with the nearest names: a set of the model's own must not
        start with Pset_ or Qto_. (None, name) for any other name, a set of the model's own."""
        if not name.lower().startswith(("pset_", "qto_")):
            return None, name
        known = _cs_pset_templates(getattr(self.m, "schema_identifier", None) or self.m.schema)
        template = known.get(name.lower())
        if template is None and self.m.schema == "IFC2X3":
            template = _cs_pset_templates("IFC4").get(name.lower())
            if template is not None:
                self.note_once("%s is not a set of IFC2X3, so it was written as IFC4 defines it" % template.Name)
        if template is None:
            import difflib
            near = difflib.get_close_matches(name, [str(t.Name) for t in known.values()], 5, 0.6)
            raise DataspatiumError("%s is not a property or quantity set of %s%s; a set of your own must not start with Pset_ or Qto_: name it "
                                   "country-origin-project_Name, such as SE-ACME-42_%s" % (name, self.m.schema, "; nearest: " + ", ".join(near) if near else "",
                                                                                            name.split("_", 1)[1] or "Name"))
        return template, str(template.Name)

    def checked_properties(self, template, name, props):
        """{property: value} to write: for a template's set each property spelled as the template has it, with its value checked
        (property_value), and a property the template lacks an error with the nearest names; for a set of the model's own the values as
        they come, but never a number with its unit written after it."""
        out = {}
        props_of = {str(p.Name).lower(): p for p in ((template.HasPropertyTemplates or ()) if template is not None else ()) if p.Name}
        for key, value in props.items():
            key = str(key).strip()
            if not key:
                raise DataspatiumError("every property needs a name")
            if template is None:
                self.no_unit("%s.%s" % (name, key), value)
                out[key] = _ifc_value(value)
                continue
            prop = props_of.get(key.lower())
            if prop is None:
                import difflib
                names = [str(p.Name) for p in template.HasPropertyTemplates or () if p.Name]
                near = difflib.get_close_matches(key, names, 3, 0.6)
                raise DataspatiumError("%s has no property %s%s; its properties are %s; put another property in a set of your own, whose name does "
                                       "not start with Pset_ or Qto_" % (name, key, " (nearest: %s)" % ", ".join(near) if near else "", ", ".join(names)))
            out[str(prop.Name)] = self.property_value(name, prop, value)
        return out

    @staticmethod
    def no_unit(where, value):
        """An error for a text that is a number with its unit written after it ("40 dB")."""
        unit = _cs_unit_in(value)
        if unit is not None:
            raise DataspatiumError("%s: give the number only, without its unit (%s, not %r): IFC gives the property its unit"
                                   % (where, unit[0].replace(",", "."), value))

    def number_of(self, where, value, measure):
        """A value as a number: a number, or a text of a number alone (a decimal comma too); an error for a number with its unit
        after it, or other text."""
        if isinstance(value, bool) or value is None:
            raise DataspatiumError("%s is a number (%s), not %r" % (where, measure, value))
        if isinstance(value, (int, float)):
            return float(value)
        self.no_unit(where, value)
        text = str(value).strip()
        if text.count(",") == 1 and "." not in text:
            text = text.replace(",", ".")
        try:
            number = float(text)
        except ValueError:
            raise DataspatiumError("%s is a number (%s), not %r" % (where, measure, value))
        if not math.isfinite(number):
            raise DataspatiumError("%s is a number (%s), not %r" % (where, measure, value))
        return number

    def base_type(self, measure):
        """The simple type under a measure in the file's schema (STRING, DOUBLE, INT, BOOL, LOGICAL ...), as edit_pset reads it; None
        for an entity or a name the schema lacks."""
        decl = _ifc_declaration(self.schema_def(), measure)
        if decl is None or decl.as_type_declaration() is None:
            return None
        try:
            return self.m.create_entity(measure).attribute_type(0)
        except Exception:
            return None

    def property_value(self, pset, prop, value):
        """One value checked against its property template, as the file takes it. A boolean is true or false (also as the text true or
        false). A measure is a number, without a unit written after it: above zero for a positive measure, at least zero for a
        non-negative one and 0 to 1 for a normalised ratio, a whole number for an integer or a count; lengths, areas and volumes come in
        metres, m² and m³ and angles in degrees, and are written in the file's units. A label or an identifier is text without a unit
        after a number (a number becomes its text), a date YYYY-MM-DD, and an enumeration one of its values in any case. A quantity
        (Q_LENGTH, Q_AREA ...) is a number of zero or more in the same units. A bounded, list, table or reference value is refused:
        set_properties writes single values. A measure the file's schema lacks (IFC4's date in IFC2X3) is written as a label or a real."""
        where = "%s.%s" % (pset, prop.Name)
        kind = str(prop.TemplateType or "P_SINGLEVALUE").strip()
        measure = str(prop.PrimaryMeasureType or "").strip() or None
        if kind.startswith("Ifc"):  # three properties of IFC4's templates name their measure as the template type
            kind, measure = "P_SINGLEVALUE", measure or kind
        per = {"length": self.scale, "area": self.unit_scale("AREAUNIT"), "volume": self.unit_scale("VOLUMEUNIT")}
        if kind.startswith("Q_"):
            number = self.number_of(where, value, kind)
            if number < 0:
                raise DataspatiumError("%s is a quantity of zero or more, not %g" % (where, number))
            if kind == "Q_COUNT" and number != int(number):
                raise DataspatiumError("%s is a count, a whole number, not %g" % (where, number))
            # As a measure, so that edit_qto takes the quantity's class from it (IfcLengthMeasure gives IfcQuantityLength).
            spelled = self.QUANTITY_MEASURES.get(kind, "IfcLengthMeasure")
            if kind == "Q_COUNT":
                return self.m.create_entity(spelled, int(number) if self.base_type(spelled) == "INT" else float(int(number)))  # an integer in IFC4.3
            return self.m.create_entity(spelled, round(number / per.get(kind[2:].lower(), 1.0), 9))
        if kind == "P_ENUMERATEDVALUE":
            enumerators = prop.Enumerators
            items = [str(getattr(v, "wrappedValue", v)) for v in ((enumerators.EnumerationValues or ()) if enumerators is not None else ())]
            hit = None if isinstance(value, bool) else next((i for i in items if i.lower() == str(value).strip().lower()), None)
            if hit is None:
                raise DataspatiumError("%s takes one of %s, not %r" % (where, ", ".join(items), value))
            return ("enum", hit, "IfcLabel", str(getattr(enumerators, "Name", None) or "PEnum_" + str(prop.Name)), items)
        if kind != "P_SINGLEVALUE":
            raise DataspatiumError("%s is %s, which set_properties does not write; leave it out" % (where, self.VALUE_KINDS.get(kind, kind)))
        measure = measure or "IfcLabel"
        base = self.base_type(measure)
        if base is None and _ifc_declaration(self.schema_def(), measure) is None:  # a measure of a later schema
            base = "BOOL" if measure in ("IfcBoolean", "IfcLogical") else "STRING" if measure in ("IfcDate", "IfcDateTime", "IfcTime", "IfcDuration", "IfcURIReference") else "DOUBLE"
            spelled = {"BOOL": "IfcBoolean", "STRING": "IfcLabel"}.get(base, "IfcReal")
        else:
            spelled = measure
        if base in ("BOOL", "LOGICAL"):
            flag = value if isinstance(value, bool) else {"true": True, "false": False}.get(str(value).strip().lower())
            if flag is None:
                raise DataspatiumError("%s is true or false, not %r" % (where, value))
            return self.m.create_entity(spelled, flag)
        if base in ("DOUBLE", "INT"):
            number = self.number_of(where, value, measure)
            whole = base == "INT" or "Count" in measure
            if whole and number != int(number):
                raise DataspatiumError("%s is a whole number (%s), not %g" % (where, measure, number))
            if ("Positive" in measure and number <= 0) or ("NonNegative" in measure and number < 0) or (measure == "IfcNormalisedRatioMeasure" and not 0 <= number <= 1):
                raise DataspatiumError("%s is %s (%s), not %g" % (where, "0 to 1" if "Normalised" in measure else "above zero" if "Positive" in measure else "zero or more", measure, number))
            if measure in self.LENGTH_MEASURES:
                number /= per["length"]
            elif measure == "IfcAreaMeasure":
                number /= per["area"]
            elif measure == "IfcVolumeMeasure":
                number /= per["volume"]
            elif measure in self.ANGLE_MEASURES:
                number = math.radians(number) / self.unit_scale("PLANEANGLEUNIT")
            return self.m.create_entity(spelled, int(number) if base == "INT" else round(float(number), 12))
        if base == "STRING":
            if isinstance(value, bool) or value is None:
                raise DataspatiumError("%s is text (%s), not %r" % (where, measure, value))
            text = (str(int(value)) if float(value).is_integer() else repr(float(value))) if isinstance(value, (int, float)) else str(value).strip()
            if measure == "IfcDate" and not (len(text) == 10 and text[4] == "-" and text[7] == "-" and text.replace("-", "").isdigit()):
                raise DataspatiumError("%s is a date, YYYY-MM-DD, not %r" % (where, value))
            if measure in ("IfcLabel", "IfcIdentifier"):
                self.no_unit(where, text)
                text = text[:255]
            return self.m.create_entity(spelled, text)
        raise DataspatiumError("%s is a %s, which set_properties does not write; leave it out" % (where, measure))

    def put_properties(self, e, template, name, values):
        """Checked values on one element or type: a Qto_ set as an IfcElementQuantity (add_qto, edit_qto), another as an IfcPropertySet.
        The element's own set of the name is edited, never its type's, and one it shares with other elements is first made its own
        (unshare_pset); an enumeration is written as an IfcPropertyEnumeratedValue unless the set holds it as a single value already."""
        import ifcopenshell.api.pset
        import ifcopenshell.util.element as el
        qto = template is not None and name.lower().startswith("qto_")
        own = el.get_psets(e, psets_only=not qto, qtos_only=qto, should_inherit=False).get(name)
        pset = self.m.by_id(own["id"]) if own and own.get("id") else None
        rels = (getattr(pset, "DefinesOccurrence", None) or getattr(pset, "PropertyDefinitionOf", None) or ()) if pset is not None else ()
        if not e.is_a("IfcTypeObject") and sum(len(r.RelatedObjects or ()) for r in rels) > 1:
            pset = ifcopenshell.api.pset.unshare_pset(self.m, products=[e], pset=pset)[0]
        # Every value is typed already (property_value), so the API needs no template: IFC2X3 writes IFC4's sets as well.
        if qto:
            pset = pset or ifcopenshell.api.pset.add_qto(self.m, product=e, name=name)
            ifcopenshell.api.pset.edit_qto(self.m, qto=pset, properties=values)
            return
        pset = pset or ifcopenshell.api.pset.add_pset(self.m, product=e, name=name)
        held = {str(p.Name): p for p in (getattr(pset, "HasProperties", None) or ())}
        out = {}
        for key, value in values.items():
            if isinstance(value, tuple) and value and value[0] == "enum":
                _, hit, measure, enum_name, items = value
                prop = held.get(key)
                if prop is not None and prop.is_a("IfcPropertyEnumeratedValue"):
                    value = [hit]  # edit_pset keeps the property's enumeration
                elif prop is not None:
                    value = self.m.create_entity(measure, hit)  # the set holds it as a single value
                else:
                    value = self.m.create_entity("IfcPropertyEnumeratedValue", Name=key, EnumerationValues=[self.m.create_entity(measure, hit)],
                                                 EnumerationReference=self.enumeration(enum_name, measure, items))
            out[key] = value
        ifcopenshell.api.pset.edit_pset(self.m, pset=pset, properties=out)

    def enumeration(self, name, measure, items):
        """The file's IfcPropertyEnumeration of the name and values, made once: its name is unique in the file."""
        for e in self.m.by_type("IfcPropertyEnumeration"):
            if str(e.Name or "") == name:
                return e if [str(getattr(v, "wrappedValue", v)) for v in (e.EnumerationValues or ())] == list(items) else None
        return self.m.create_entity("IfcPropertyEnumeration", Name=name, EnumerationValues=[self.m.create_entity(measure, i) for i in items])

    def own_value(self, e, pset, prop):
        """The value of a property in the element's (or the type's) own set, not inherited; None when it has none."""
        import ifcopenshell.util.element as el
        return el.get_psets(e, psets_only=True, should_inherit=False).get(pset, {}).get(prop)

    def common_set(self, e):
        return next((name for cls, name in self.COMMON_SETS if e.is_a(cls)), None)

    def put_common(self, e, prop, value):
        """One property of the element's or type's common set (Pset_WallCommon ...), through the template check."""
        template, name = self.property_template(self.common_set(e))
        self.put_properties(e, template, name, self.checked_properties(template, name, {prop: value}))
        self.touch(e)

    STATUSES = ("NEW", "EXISTING", "DEMOLISH", "TEMPORARY")

    def mark_common(self, e, op):
        """Keep the load_bearing (true, false or null) and the status (NEW, EXISTING, DEMOLISH, TEMPORARY or null) of a create step for
        write_marked; a partition is not load-bearing."""
        value = op.get("load_bearing")
        if value is not None:
            if not isinstance(value, bool):
                raise DataspatiumError("load_bearing must be true, false or null (not given)")
            if value and op.get("partition") is True:
                raise DataspatiumError("partition true makes a non-load-bearing wall; leave partition out for a load-bearing wall")
            self.marks["LoadBearing"][e.id()] = value
        status = str(op.get("status") or "").strip().upper() or None
        if status is not None:
            if status not in self.STATUSES:
                raise DataspatiumError("status must be %s, or null" % ", ".join(self.STATUSES))
            self.marks["Status"][e.id()] = status

    @staticmethod
    def plain(value):
        """A property value as get_psets gives it, an enumeration's one value unwrapped."""
        return value[0] if isinstance(value, (list, tuple)) and len(value) == 1 else value

    def write_marked(self, prop):
        """LoadBearing or Status of the elements whose create step gave it (mark_common). An element without a type gets it on itself.
        A typed element's type gets it when the type has none and every occurrence of the type says the same, from its step or its
        own set; otherwise each element gets its own, unless the type says the same already. Nothing for null: the app never guesses
        whether a part bears load or what its status is. A common set whose template in the file's schema lacks the property
        (Status in IFC2X3) is left alone, with a note."""
        import ifcopenshell.util.element as el
        groups = {}
        for i, value in self.marks[prop].items():
            try:
                e = self.m.by_id(i)
            except Exception:
                continue  # deleted later in the change set
            t = el.get_type(e)
            groups.setdefault(t.id() if t is not None else -i, (t, []))[1].append((e, value))
        for t, items in groups.values():
            name = self.common_set(items[0][0])
            template = self.property_template(name)[0]
            if template is not None and not any(str(p.Name) == prop for p in template.HasPropertyTemplates or ()):
                self.note_once("%s has no %s in %s, so it was left out" % (name, prop, self.m.schema))
                continue
            on_type = None
            if t is not None:
                said = {e.id(): value for e, value in items}
                on_type = self.plain(self.own_value(t, name, prop))
                values = {said[o.id()] if o.id() in said else self.plain(self.own_value(o, name, prop)) for o in el.get_types(t)}
                if on_type is None and len(values) == 1 and None not in values:
                    self.put_common(t, prop, values.pop())
                    continue
            for e, value in items:
                if on_type is None or on_type != value:
                    self.put_common(e, prop, value)

    def roof_slab(self, e):
        import ifcopenshell.util.element as el
        try:
            return str(el.get_predefined_type(e) or "") == "ROOF"
        except Exception:
            return str(getattr(e, "PredefinedType", None) or "") == "ROOF"

    def set_external(self, e, value):
        """IsExternal on an element, in its common set; the element's value afterwards. A value the element had before the change set
        (not one set_properties wrote in it) is kept, with a note when the app's differs."""
        name = self.common_set(e)
        if name is None:
            return value
        own = self.own_value(e, name, "IsExternal")
        if own is not None and (e.id(), name, "IsExternal") not in self.written:
            if bool(own) != value:
                self.note_once("%s %s keeps the model's IsExternal %s; the topology says %s" % (e.is_a(), self.element_label(e), str(bool(own)).lower(), str(value).lower()))
            return bool(own)
        if own is None or bool(own) != value:
            self.put_common(e, "IsExternal", value)
        return value

    def write_external(self):
        """IsExternal at the end of apply. The walls the change set created or changed are external when they run along the outer
        boundary of their storey's topology (_ifc_topology: the union of its rooms, a courtyard's walls too) and internal when they
        bound its rooms otherwise, and the doors and windows in them take their wall's value; on a storey whose walls do not close,
        or that has walls the topology cannot read, they are left alone, and so is a wall that bounds no room, with a note. The roof
        slabs and roofs the change set created or changed are external. A value that was in the model already stays (set_external)."""
        walls, storeys = [], {}
        for i in dict.fromkeys([r["id"] for r in self.created] + list(self.changed)):
            try:
                e = self.m.by_id(i)
            except Exception:
                continue  # deleted later in the change set
            if e.is_a("IfcRoof") or (e.is_a("IfcSlab") and self.roof_slab(e)):
                self.set_external(e, True)
            elif e.is_a("IfcWall"):
                s = self.container(e)
                if s is not None and s.is_a("IfcBuildingStorey"):
                    walls.append((e, s.id()))
                    storeys.setdefault(s.id(), s)
        if not walls:
            return
        found = {rec["_storey"].id(): rec for rec in _ifc_topology(self.m, storeys={_ifc_text(s.Name) for s in storeys.values()}, shapes=True)}
        for sid, s in storeys.items():
            rec = found.get(sid)
            mine = [w for w, at in walls if at == sid]
            why = ("the app could not read its walls" if rec is None else "%d of its walls could not be read" % rec["unread"] if rec["unread"]
                   else "%d wall ends stand open" % len(rec["dangles"]) if rec["dangles"] else "its walls enclose no room" if not rec["closed"] else None)
            if why is not None:
                self.note_once("IsExternal was left out on the walls of storey %s that the change set made or changed, and on their doors and windows: "
                          "%s, so the app cannot tell outside from inside" % (_ifc_text(s.Name), why))
                continue
            outer = {x["wall"] for x in rec["external"]}
            inner = {w for room in rec["rooms"] for w in room["walls"]} - outer
            alone = []
            for w in mine:
                if w.id() not in outer and w.id() not in inner:
                    alone.append(w)
                    continue
                value = self.set_external(w, w.id() in outer)
                for f in self.fillings(w):
                    self.set_external(f, value)
            if alone:
                self.note_once("IsExternal was left out on walls %s of storey %s: they bound no room" % (", ".join(self.element_label(w) for w in alone), _ifc_text(s.Name)))

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


# ---- buildingSMART's normative rules (recommendation 8 of the native IFC study, 2026-11-12) -------------------------
# A selection of the rules of buildingSMART's validation service, ifc-gherkin-rules (https://github.com/buildingSMART/ifc-gherkin-rules,
# read at commit 893f827 of 2026-07-29), ported to the app's own Python without behave, pyproj or rtree: IFC102, GEM111, SWE001,
# PSE001, PSE002, QTY001, GRF001, GRF003, GRF005, SPS007, OJT001 and PJS003. The tables of IFC102 are the rule's own. PSE001 and QTY001
# read IfcOpenShell's property set templates instead of the rule's CSV tables, SWE001 asks shapely whether a profile is valid, GRF005
# knows a CRS's unit from the Nordic codes the app writes or from the CRS's MapUnit where the rule asks pyproj, and PJS003 also
# counts a GlobalId used twice. Every finding carries its rule; implementer agreements and informal propositions are errors and
# industry practice warnings, as the validation service grades them. The preview of a change set (_ifc_changeset) tries what the
# change set made or changed and counts only what the base did not have already.
#
# The ported rules are under the rules' own licence:
#
#   MIT License
#
#   Copyright (c) buildingSMART International Ltd
#
#   Permission is hereby granted, free of charge, to any person obtaining a copy
#   of this software and associated documentation files (the "Software"), to deal
#   in the Software without restriction, including without limitation the rights
#   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
#   copies of the Software, and to permit persons to whom the Software is
#   furnished to do so, subject to the following conditions:
#
#   The above copyright notice and this permission notice shall be included in all
#   copies or substantial portions of the Software.
#
#   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
#   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
#   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
#   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
#   SOFTWARE.

RULE_SOURCE = "buildingSMART ifc-gherkin-rules 893f827"
RULE_LEVELS = {"IFC102": "error", "GEM111": "error", "SWE001": "error", "PSE001": "error", "PSE002": "warning", "QTY001": "error",
               "GRF001": "error", "GRF003": "warning", "GRF005": "warning", "SPS007": "error", "OJT001": "error", "PJS003": "error"}
RULE_TITLES = {
    "IFC102": "Absence of deprecated entities", "GEM111": "No duplicated points within a polyloop or polyline",
    "SWE001": "Arbitrary profile boundary no self-intersections", "PSE001": "Standard properties and property sets validation",
    "PSE002": "Custom properties and property sets validation", "QTY001": "Standard quantities and quantity sets validation",
    "GRF001": "Identical coordinate operations", "GRF003": "CRS presence with spatial entities", "GRF005": "CRS unit type differences",
    "SPS007": "Spatial containment", "OJT001": "Object predefined type", "PJS003": "Globally unique identifiers"}
_RULE_IFC102_IFC4_ATTRIBUTES = (
    ("IfcDoorLiningProperties", "ShapeAspectStyle"), ("IfcDoorPanelProperties", "ShapeAspectStyle"),
    ("IfcFillAreaStyleHatching", "PointOfReferenceHatchLine"), ("IfcReinforcingElement", "SteelGrade"),
    ("IfcRelAssignsToActor", "RelatedObjectsType"), ("IfcRelAssignsToControl", "RelatedObjectsType"), ("IfcRelAssignsToGroup", "RelatedObjectsType"),
    ("IfcRelAssignsToGroupByFactor", "RelatedObjectsType"), ("IfcRelAssignsToProcess", "RelatedObjectsType"),
    ("IfcRelAssignsToProduct", "RelatedObjectsType"), ("IfcRelAssignsToResource", "RelatedObjectsType"),
    ("IfcStairFlight", "NumberOfRisers"), ("IfcStairFlight", "NumberOfTreads"), ("IfcStairFlight", "RiserHeight"), ("IfcStairFlight", "TreadLength"),
    ("IfcWindowPanelProperties", "ShapeAspectStyle"), ("IfcWindowLiningProperties", "ShapeAspectStyle"),
    ("IfcTendon", "SteelGrade"), ("IfcTendon", "NominalDiameter"), ("IfcTendon", "CrossSectionArea"), ("IfcTendon", "TensionForce"),
    ("IfcTendon", "PreStress"), ("IfcTendon", "FrictionCoefficient"), ("IfcTendon", "AnchorageSlip"), ("IfcTendon", "MinCurvatureRadius"),
    ("IfcTendonAnchor", "SteelGrade"), ("IfcTendonType", "NominalDiameter"), ("IfcTendonType", "CrossSectionArea"), ("IfcTendonType", "SheathDiameter"))
_RULE_IFC102_EXACT = ("IfcFlowFitting", "IfcFlowSegment", "IfcFlowTerminal", "IfcFlowController", "IfcFlowMovingDevice", "IfcFlowStorageDevice",
                      "IfcFlowTreatmentDevice", "IfcEnergyConversionDevice")
# IFC102 by the file's schema family, from the rule's tables: entities never written (excluding subtypes; names that are no entity
# of the schema are kept as the rule has them and skipped), attributes left empty, (entity, attribute, values) never written, and
# entities never instantiated as themselves (only as a subtype).
RULE_IFC102 = {
    "IFC4X3": {
        "entities": ("IfcBuildingSystem", "IfcCivilElement", "IfcCivilElementType", "IfcDoorLiningProperties", "IfcDoorPanelProperties",
                     "IfcElectricDistributionBoard", "IfcElectricDistributionBoardType", "IfcFaceBasedSurfaceModel", "IfcMaterialClassificationRelationship",
                     "IfcMaterialList", "IfcPermeableCoveringProperties", "IfcPostalAddress", "IfcRelConnectsPortToElement", "IfcRelCoversBldgElements",
                     "IfcRelServicesBuildings", "IfcRelCoversSpaces", "IfcTelecomAddress", "IfcTextLiteral", "IfcTrapeziumProfileDef",
                     "IfcWallStandardCase", "IfcWindowLiningProperties", "IfcWindowPanelProperties", "IfcWindowStandardCase"),
        "attributes": (("IfcBuilding", "BuildingAddress"), ("IfcBuilding", "ElevationOfRefHeight"), ("IfcBuilding", "ElevationOfTerrain"),
                       ("IfcBuildingStorey", "Elevation"), ("IfcFillAreaStyleHatching", "PointOfReferenceHatchLine"), ("IfcOrganization", "Addresses"),
                       ("IfcPerson", "Addresses"), ("IfcPile", "ConstructionType"), ("IfcReinforcingElement", "SteelGrade"), ("IfcRelAssigns", "RelatedObjectsType"),
                       ("IfcSite", "LandTitleNumber"), ("IfcSite", "SiteAddress"), ("IfcStairFlight", "NumberOfRisers"), ("IfcStairFlight", "NumberOfTreads"),
                       ("IfcStairFlight", "RiserHeight"), ("IfcStairFlight", "TreadLength"), ("IfcSurfaceStyleRendering", "DiffuseTransmissionColour"),
                       ("IfcSurfaceStyleRendering", "ReflectionColour"), ("IfcSurfaceStyleRendering", "TransmissionColour"), ("IfcSurfaceTexture", "Parameter"),
                       ("IfcTendon", "NominalDiameter"), ("IfcTendon", "CrossSectionArea"), ("IfcTextureCoordinateGenerator", "Parameter")),
        "values": (("IfcBuildingElementProxy", "PredefinedType", ("PROVISIONFORSPACE", "PROVISIONFORVOID")),
                   ("IfcFireSuppressionTerminal", "PredefinedType", ("SPRINKLERDEFLECTOR",)), ("IfcFireSuppressionTerminalType", "PredefinedType", ("SPRINKLERDEFLECTOR",)),
                   ("IfcCableCarrierFitting", "PredefinedType", ("TEE", "CROSS", "REDUCER")), ("IfcCableCarrierFittingType", "PredefinedType", ("TEE", "CROSS", "REDUCER")),
                   ("IfcGeographicElement", "PredefinedType", ("SOIL_BORING_POINT",)), ("IfcGeographicElementType", "PredefinedType", ("SOIL_BORING_POINT",)),
                   ("IfcSpace", "PredefinedType", ("INTERNAL", "EXTERNAL")), ("IfcSpaceType", "PredefinedType", ("INTERNAL", "EXTERNAL")),
                   ("IfcWall", "PredefinedType", ("POLYGONAL", "STANDARD")), ("IfcWallType", "PredefinedType", ("POLYGONAL", "STANDARD")),
                   ("IfcShapeRepresentation", "RepresentationType", ("PointCloud",)), ("IfcPropertySet", "Name", ("Pset_Draughting",))),
        "exact": _RULE_IFC102_EXACT,
    },
    "IFC4": {
        "entities": ("Ifc2DCompositeCurve", "IfcBeamStandardCase", "IfcConnectionPortGeometry", "IfcColumnStandardCase", "IfcDoorStandardCase",
                     "IfcDoorStyle", "IfcDoorStyleOperationEnum", "IfcElectricalElement", "IfcEquipmentElement", "IfcFaceBasedSurfaceModel",
                     "IfcMaterialClassificationRelationship", "IfcMaterialList", "IfcMemberStandardCase", "IfcNullStyle", "IfcObjectTypeEnum",
                     "IfcOpeningStandardCase", "IfcPlateStandardCase", "IfcPresentationStyleAssignment", "IfcProxy", "IfcRelCoversBldgElements",
                     "IfcRelCoversSpaces", "IfcSlabElementedCase", "IfcSlabStandardCase", "IfcTextLiteral", "IfcWallElementedCase", "IfcWallStandardCase",
                     "IfcWindowStandardCase", "IfcWindowStyle", "IfcWindowStyleOperationEnum"),
        "attributes": _RULE_IFC102_IFC4_ATTRIBUTES,
        "values": (("IfcWall", "PredefinedType", ("POLYGONAL", "STANDARD", "ELEMENTEDWALL")), ("IfcWallType", "PredefinedType", ("POLYGONAL", "STANDARD", "ELEMENTEDWALL")),
                   ("IfcPropertySet", "Name", ("Pset_Draughting",))),
        "exact": _RULE_IFC102_EXACT,
    },
    "IFC2X3": {
        "entities": ("Ifc2DCompositeCurve", "IfcConnectionPortGeometry", "IfcElectricalElement", "IfcEquipmentElement", "IfcObjectTypeEnum", "IfcTextLiteral"),
        "attributes": (("IfcFillAreaStyleHatching", "PointOfReferenceHatchLine"),),
        "values": (("IfcOwnerHistory", "ChangeAction", ("MODIFIEDADDED", "MODIFIEDDELETED")), ("IfcPropertySet", "Name", ("Pset_Draughting",))),
        "exact": ("IfcProductRepresentation", "IfcRepresentation", "IfcRepresentationContext", "IfcRelAssociates"),
    },
}
RULE_GUID_CHARS = frozenset("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$")
RULE_PROPERTY_KINDS = {"P_SINGLEVALUE": "IfcPropertySingleValue", "P_ENUMERATEDVALUE": "IfcPropertyEnumeratedValue",
                       "P_BOUNDEDVALUE": "IfcPropertyBoundedValue", "P_LISTVALUE": "IfcPropertyListValue", "P_TABLEVALUE": "IfcPropertyTableValue",
                       "P_REFERENCEVALUE": "IfcPropertyReferenceValue", "Q_LENGTH": "IfcQuantityLength", "Q_AREA": "IfcQuantityArea",
                       "Q_VOLUME": "IfcQuantityVolume", "Q_COUNT": "IfcQuantityCount", "Q_WEIGHT": "IfcQuantityWeight", "Q_TIME": "IfcQuantityTime",
                       "Q_NUMBER": "IfcQuantityNumber"}
RULE_MAX_FINDINGS = 200
EXPRESS_MAX_ENTITIES = 300000  # the schema's rules at approval are left out above this, with a note


class _Rules:
    """The rules above on one model: `of(e)` tries one instance against the rules that concern its class, `model_level()` the rules
    that concern the whole model (GRF001, GRF003, GRF005), and `run(scope)` both, on every instance or on the step ids in scope. A
    finding is {level, kind "rule", rule, ifc_class, id, guid, attribute, message}, keyed so that a base and its candidate compare."""

    def __init__(self, model):
        self.m = model
        schema = str(getattr(model, "schema", "") or "").upper()
        self.family = "IFC4X3" if schema.startswith("IFC4X3") else "IFC2X3" if schema.startswith("IFC2X3") else "IFC4"
        table = RULE_IFC102[self.family]
        self.deprecated = set(table["entities"])
        self.exact = set(table["exact"])
        self.attributes = table["attributes"]
        self.values = table["values"]
        self._precision = None
        self._templates = False
        self._guids = None

    # -- helpers
    @property
    def precision(self):
        """The largest Precision of the model's own contexts, in the file's units; 1e-5 without one, as the rules take it."""
        if self._precision is None:
            values = [float(c.Precision) for c in self.m.by_type("IfcGeometricRepresentationContext") if getattr(c, "Precision", None)]
            self._precision = max(values) if values else 1e-5
        return self._precision

    @property
    def templates(self):
        if self._templates is False:
            try:
                import ifcopenshell.util.pset
                self._templates = ifcopenshell.util.pset.get_template(getattr(self.m, "schema_identifier", None) or self.m.schema)
            except Exception:
                self._templates = None
        return self._templates

    @property
    def guids(self):
        if self._guids is None:
            self._guids = {}
            for e in self.m.by_type("IfcRoot"):
                g = getattr(e, "GlobalId", None)
                self._guids[g] = self._guids.get(g, 0) + 1
        return self._guids

    @staticmethod
    def finding(rule, e, attribute, message, key=None):
        return {"level": RULE_LEVELS[rule], "kind": "rule", "rule": rule, "ifc_class": e.is_a() if e is not None else None,
                "id": e.id() if e is not None else None, "guid": getattr(e, "GlobalId", None) if e is not None else None,
                "attribute": attribute, "message": message,
                "_key": "%s:%s:%s" % (rule, e.id() if e is not None else "model", key if key is not None else attribute)}

    def wanted(self):
        """The classes whose instances a full run tries."""
        names = {"IfcRoot", "IfcPolyline", "IfcPolyLoop", "IfcArbitraryClosedProfileDef", "IfcShapeRepresentation"}
        names |= self.deprecated | self.exact | {a[0] for a in self.attributes} | {v[0] for v in self.values}
        return names

    def run(self, scope=None):
        """{key: finding} of every instance (scope None) or of the step ids in scope, and of the model-level rules."""
        out = {}
        if scope is None:
            seen = set()
            items = []
            for name in sorted(self.wanted()):
                try:
                    found = self.m.by_type(name)
                except Exception:
                    continue  # a name the schema does not have
                for e in found:
                    if e.id() not in seen:
                        seen.add(e.id())
                        items.append(e)
        else:
            items = []
            for i in sorted(scope):
                try:
                    items.append(self.m.by_id(int(i)))
                except Exception:
                    continue
        for e in items:
            for f in self.of(e):
                out.setdefault(f["_key"], f)
        for f in self.model_level():
            out.setdefault(f["_key"], f)
        return out

    def of(self, e):
        """The findings of one instance."""
        out = []
        cls = e.is_a()
        try:
            out += self.ifc102(e, cls)
            if e.is_a("IfcPolyline") or e.is_a("IfcPolyLoop"):
                out += self.gem111(e)
            if e.is_a("IfcArbitraryClosedProfileDef"):
                out += self.swe001(e)
            if e.is_a("IfcPropertySet"):
                out += self.pse(e)
            if e.is_a("IfcElementQuantity") and self.family != "IFC2X3":
                out += self.qty001(e)
            if e.is_a("IfcProduct"):
                out += self.sps007(e)
            if self.family != "IFC2X3" and (e.is_a("IfcObject") or e.is_a("IfcTypeObject")):
                out += self.ojt001(e)
            if e.is_a("IfcRoot"):
                out += self.pjs003(e)
        except Exception as exc:  # a rule that cannot read an odd instance says so instead of failing the preview
            out.append({"level": "warning", "kind": "rule", "rule": None, "ifc_class": cls, "id": e.id(), "guid": getattr(e, "GlobalId", None),
                        "attribute": None, "message": "the rules could not read this instance: %s: %s" % (type(exc).__name__, exc), "_key": "read:%s" % e.id()})
        return out

    # -- IFC102 Absence of deprecated entities
    def ifc102(self, e, cls):
        out = []
        if cls in self.deprecated:
            out.append(self.finding("IFC102", e, None, "%s is deprecated in %s; it is never written" % (cls, self.family), "entity"))
        if cls in self.exact:
            out.append(self.finding("IFC102", e, None, "%s is not instantiated as itself in %s; use the specific subtype" % (cls, self.family), "exact"))
        for owner, attr in self.attributes:
            if e.is_a(owner) and getattr(e, attr, None) not in (None, (), []):
                out.append(self.finding("IFC102", e, attr, "%s.%s is deprecated in %s and stays empty" % (owner, attr, self.family)))
        for owner, attr, values in self.values:
            if e.is_a(owner) and getattr(e, attr, None) in values:
                out.append(self.finding("IFC102", e, attr, "%s %s is deprecated for %s in %s" % (attr, getattr(e, attr), owner, self.family)))
        return out

    # -- GEM111 No duplicated points within a polyloop or polyline
    def gem111(self, e):
        points = list((e.Polygon if e.is_a("IfcPolyLoop") else e.Points) or ())
        coords = [tuple(float(c) for c in p.Coordinates) for p in points]
        if len(coords) < 2:
            return []
        out = []
        loop = e.is_a("IfcPolyLoop")
        closed = not loop and math.dist(coords[0], coords[-1]) < self.precision
        pair = _rule_duplicate(coords, self.precision, skip=(0, len(coords) - 1) if closed else None)
        if pair is not None:
            what = "polyloop" if loop else "closed polyline" if closed else "open polyline"
            out.append(self.finding("GEM111", e, "Polygon" if loop else "Points", "the %s repeats a point: %d and %d are %s and %s" % (
                what, pair[0] + 1, pair[1] + 1, list(coords[pair[0]]), list(coords[pair[1]]))))
        if closed and points[0].id() != points[-1].id():
            out.append(self.finding("GEM111", e, "Points", "the closed polyline ends on #%d, a copy of its first point #%d, instead of the first point itself" % (
                points[-1].id(), points[0].id()), "closing"))
        return out

    # -- SWE001 Arbitrary profile boundary no self-intersections
    def swe001(self, e):
        from shapely.geometry import Polygon
        from shapely.validation import explain_validity
        out = []
        curves = [("OuterCurve", e.OuterCurve)]
        if e.is_a("IfcArbitraryProfileDefWithVoids"):
            curves += [("InnerCurves", c) for c in (e.InnerCurves or ())]
        for n, (attr, curve) in enumerate(curves):
            ring = _rule_curve_points(curve)
            if ring is None or len(ring) < 3:
                continue  # a curve the app cannot trace (circles, trimmed curves) is left to the server's check
            polygon = Polygon(ring)
            what = "outer curve" if attr == "OuterCurve" else "inner curve #%d" % curve.id()
            if not polygon.is_valid:
                out.append(self.finding("SWE001", e, attr, "the profile's %s is not a simple closed boundary: %s" % (what, explain_validity(polygon)), "%s:%d" % (attr, n)))
            else:
                near = _rule_near_edges(ring, self.precision)
                if near is not None:
                    out.append(self.finding("SWE001", e, attr, "the profile's %s comes within the precision of itself between edges %d and %d" % (what, near[0] + 1, near[1] + 1), "%s:%d" % (attr, n)))
        return out

    # -- PSE001 Standard property sets, PSE002 custom property sets
    def related(self, pset):
        """(occurrences, types) a property set or quantity set is given to."""
        rels = list(getattr(pset, "DefinesOccurrence", None) or getattr(pset, "PropertyDefinitionOf", None) or ())
        objects = [o for r in rels for o in (r.RelatedObjects or ())]
        types = [o for o in objects if o.is_a("IfcTypeObject")] + list(getattr(pset, "DefinesType", None) or ())
        return [o for o in objects if not o.is_a("IfcTypeObject")], types

    @staticmethod
    def predefined(obj):
        """The object's predefined type as the rules read it: its own, USERDEFINED read as its ObjectType, else its type's."""
        import ifcopenshell.util.element as el
        if not obj.is_a("IfcTypeObject"):
            pt = getattr(obj, "PredefinedType", None)
            if pt:
                return getattr(obj, "ObjectType", None) if pt == "USERDEFINED" else pt
            obj = el.get_type(obj)
        if obj is not None and getattr(obj, "PredefinedType", None):
            return getattr(obj, "ElementType", None) if obj.PredefinedType == "USERDEFINED" else obj.PredefinedType
        return None

    def applies(self, rule, template, sets, obj, kind):
        """The findings when a standard set is given to an object its template does not apply to."""
        import ifcopenshell.util.type as types
        tt = str(template.TemplateType or "")
        if kind == "occurrence" and tt in ("PSET_TYPEDRIVENONLY", "QTO_TYPEDRIVENONLY"):
            return [self.finding(rule, sets, None, "%s is for type objects only, not for %s #%d" % (sets.Name, obj.is_a(), obj.id()), "only:%d" % obj.id())]
        if kind == "type" and tt in ("PSET_OCCURRENCEDRIVEN", "PSET_PERFORMANCEDRIVEN", "QTO_OCCURRENCEDRIVEN"):
            return [self.finding(rule, sets, None, "%s is for occurrences only, not for the type %s #%d" % (sets.Name, obj.is_a(), obj.id()), "only:%d" % obj.id())]
        q = self.templates
        try:
            decl = q.schema.declaration_by_name(obj.is_a()).as_entity()
        except Exception:
            return []
        applicable = str(template.ApplicableEntity or "IfcRoot")
        pt = str(self.predefined(obj) or "")
        ok = q.is_applicable(decl, applicable, pt, tt, self.family)
        if not ok and kind == "type":
            try:
                ok = any(q.is_applicable(q.schema.declaration_by_name(c).as_entity(), applicable, pt, "", self.family) for c in types.get_applicable_entities(obj.is_a(), self.family))
            except Exception:
                ok = False
        if ok:
            return []
        return [self.finding(rule, sets, None, "%s does not apply to %s #%d%s; it applies to %s" % (sets.Name, obj.is_a(), obj.id(), " (%s)" % pt if pt else "", applicable), "applies:%d" % obj.id())]

    def pse(self, e):
        import re
        name = str(getattr(e, "Name", None) or "")
        if not name.startswith("Pset_"):
            if re.match(r"^[Pp][Ss][Ee][Tt]", name):
                return [self.finding("PSE002", e, "Name", "%r is a property set of its own whose name starts like a standard one; only IFC's own sets start with Pset_" % name)]
            return []
        if self.templates is None:
            return []
        template = self.templates.get_by_name(name)
        if template is None and self.family == "IFC2X3":
            # The app's own deviation from the rule: a set that came with IFC4, written in an IFC2X3 file as IFC4 defines it (such as
            # Pset_Condition in a check of an older model), is a warning, and its properties' names are tried against IFC4's template
            # (not their types: IFC2X3 lacks some of IFC4's, such as IfcDate).
            try:
                import ifcopenshell.util.pset
                later = ifcopenshell.util.pset.get_template("IFC4").get_by_name(name)
            except Exception:
                later = None
            if later is not None:
                warn = dict(self.finding("PSE001", e, "Name", "%s is not a property set of IFC2X3; it is written as IFC4 defines it" % name), level="warning")
                named = [f for f in self.members("PSE001", e, later, list(getattr(e, "HasProperties", None) or ())) if not f["_key"].endswith((":type", ":kind"))]
                return [warn] + named
        if template is None:
            return [self.finding("PSE001", e, "Name", "%s is not a standard property set of %s; a set of your own has a name without Pset_" % (name, self.family))]
        out = self.members("PSE001", e, template, list(getattr(e, "HasProperties", None) or ()))
        occurrences, types = self.related(e)
        for o in occurrences:
            out += self.applies("PSE001", template, e, o, "occurrence")
        for o in types:
            out += self.applies("PSE001", template, e, o, "type")
        return out

    def members(self, rule, sets, template, members):
        """The properties or quantities of a standard set against its template: name, kind and, for single and enumerated values, type."""
        out = []
        known = {t.Name: t for t in (template.HasPropertyTemplates or ())}
        for p in members:
            t = known.get(p.Name)
            if t is None:
                out.append(self.finding(rule, sets, p.Name, "%s is not a %s of %s" % (p.Name, "quantity" if rule == "QTY001" else "property", sets.Name)))
                continue
            kind = RULE_PROPERTY_KINDS.get(str(getattr(t, "TemplateType", None) or ""))
            if kind and not p.is_a(kind):
                out.append(self.finding(rule, sets, p.Name, "%s.%s is an %s; the template has an %s" % (sets.Name, p.Name, p.is_a(), kind), p.Name + ":kind"))
            elif p.is_a("IfcPropertySingleValue") and p.NominalValue is not None and getattr(t, "PrimaryMeasureType", None) and not p.NominalValue.is_a(t.PrimaryMeasureType):
                out.append(self.finding(rule, sets, p.Name, "%s.%s is an %s; the template has an %s" % (sets.Name, p.Name, p.NominalValue.is_a(), t.PrimaryMeasureType), p.Name + ":type"))
            elif p.is_a("IfcPropertyEnumeratedValue") and getattr(t, "Enumerators", None) is not None:
                allowed = {getattr(v, "wrappedValue", v) for v in (t.Enumerators.EnumerationValues or ())}
                wrong = [getattr(v, "wrappedValue", v) for v in (p.EnumerationValues or ()) if getattr(v, "wrappedValue", v) not in allowed]
                if wrong:
                    out.append(self.finding(rule, sets, p.Name, "%s.%s takes %s, not %s" % (sets.Name, p.Name, ", ".join(sorted(map(str, allowed))), ", ".join(map(str, wrong))), p.Name + ":value"))
        return out

    # -- QTY001 Standard quantity sets
    def qty001(self, e):
        name = str(getattr(e, "Name", None) or "")
        if not name.startswith("Qto_") or self.templates is None:
            return []
        template = self.templates.get_by_name(name)
        if template is None:
            return [self.finding("QTY001", e, "Name", "%s is not a standard quantity set of %s; a set of your own has a name without Qto_" % (name, self.family))]
        out = self.members("QTY001", e, template, list(getattr(e, "Quantities", None) or ()))
        if getattr(e, "MethodOfMeasurement", None) != "BaseQuantities":
            out.append(self.finding("QTY001", e, "MethodOfMeasurement", "%s has MethodOfMeasurement %r; a standard quantity set has 'BaseQuantities'" % (name, getattr(e, "MethodOfMeasurement", None))))
        occurrences, types = self.related(e)
        for o in occurrences:
            out += self.applies("QTY001", template, e, o, "occurrence")
        for o in types:
            out += self.applies("QTY001", template, e, o, "type")
        return out

    # -- SPS007 Spatial containment
    def sps007(self, e):
        # The containment through the inverse ContainedInStructure, as the rule reads it: a spatial element that a file puts in an
        # IfcRelContainedInSpatialStructure has no such inverse, and the rule does not see it.
        within = [r.RelatingStructure for r in (getattr(e, "ContainedInStructure", None) or ())]
        held = any(s.is_a("IfcSpatialStructureElement") for s in within)
        if e.is_a("IfcGrid") or e.is_a("IfcAnnotation"):
            if e.is_a("IfcAnnotation") and any(r.RelatingObject.is_a("IfcAnnotation") for r in (getattr(e, "Nests", None) or ())):
                return []
            return [] if held else [self.finding("SPS007", e, "ContainedInStructure", "%s is not contained in a spatial structure element (a storey)" % e.is_a())]
        if e.is_a("IfcElement"):
            out = []
            parts = [r for r in (getattr(e, "Decomposes", None) or ())]
            if not e.is_a("IfcFeatureElement") and not parts and not held:
                out.append(self.finding("SPS007", e, "ContainedInStructure", "%s is neither contained in a spatial structure element nor part of another element" % e.is_a()))
            if within and any(r.is_a("IfcRelAggregates") and r.RelatingObject.is_a("IfcElement") for r in parts):
                out.append(self.finding("SPS007", e, "ContainedInStructure", "%s is part of another element and must not be contained in a spatial structure as well" % e.is_a(), "part"))
            return out
        if within:
            return [self.finding("SPS007", e, "ContainedInStructure", "%s is no element and must not be contained in a spatial structure; aggregate it instead" % e.is_a())]
        return []

    # -- OJT001 Object predefined type (IFC4 and IFC4.3)
    def ojt001(self, e):
        out = []
        pt = getattr(e, "PredefinedType", None)
        if e.is_a("IfcTypeObject"):
            if pt == "USERDEFINED" and hasattr(e, "ElementType") and not str(e.ElementType or "").strip():
                out.append(self.finding("OJT001", e, "ElementType", "the type is USERDEFINED without an ElementType to name it"))
            return out
        typed = [r.RelatingType for r in (getattr(e, "IsTypedBy", None) or ())]
        if not typed and pt == "USERDEFINED" and not str(getattr(e, "ObjectType", None) or "").strip():
            out.append(self.finding("OJT001", e, "ObjectType", "the element is USERDEFINED without an ObjectType to name it"))
        for t in typed:
            tpt = getattr(t, "PredefinedType", None)
            if tpt and not str(tpt).startswith("NOTDEFINED") and pt is not None:
                out.append(self.finding("OJT001", e, "PredefinedType", "the element has PredefinedType %s while its type %s #%d has %s; the element's stays empty" % (pt, t.is_a(), t.id(), tpt)))
        return out

    # -- PJS003 Globally unique identifiers
    def pjs003(self, e):
        g = getattr(e, "GlobalId", None)
        if not isinstance(g, str):
            return [self.finding("PJS003", e, "GlobalId", "the GlobalId is missing")]
        out = []
        if len(g) != 22:
            out.append(self.finding("PJS003", e, "GlobalId", "the GlobalId %r has %d characters, not 22" % (g, len(g)), "length"))
        if any(c not in RULE_GUID_CHARS for c in g):
            out.append(self.finding("PJS003", e, "GlobalId", "the GlobalId %r has characters outside 0-9, A-Z, a-z, _ and $" % g, "chars"))
        if not g[:1] or g[0] not in "0123":
            out.append(self.finding("PJS003", e, "GlobalId", "the GlobalId %r starts with %r, not 0, 1, 2 or 3" % (g, g[:1]), "start"))
        if self.guids.get(g, 0) > 1:
            out.append(self.finding("PJS003", e, "GlobalId", "the GlobalId %s is used by %d instances" % (g, self.guids[g]), "unique"))
        return out

    # -- GRF001, GRF003, GRF005: the model's georeferencing
    def model_level(self):
        out = []
        try:
            out += self.grf001()
            out += self.grf003()
            out += self.grf005()
        except Exception as exc:
            out.append({"level": "warning", "kind": "rule", "rule": None, "ifc_class": None, "id": None, "guid": None, "attribute": None,
                        "message": "the georeferencing rules could not run: %s: %s" % (type(exc).__name__, exc), "_key": "read:model"})
        return out

    @staticmethod
    def operation(op):
        """A coordinate operation's values without its SourceCRS, entities by their step id."""
        def plain(v):
            if hasattr(v, "is_a") and hasattr(v, "id"):
                return ("#", v.id()) if v.id() else (v.is_a(), getattr(v, "wrappedValue", None))
            return v
        info = op.get_info(recursive=False)
        return (op.is_a(),) + tuple(sorted((k, plain(v)) for k, v in info.items() if k not in ("id", "type", "SourceCRS")))

    def grf001(self):
        if self.family != "IFC4X3":
            return []
        contexts = list(self.m.by_type("IfcGeometricRepresentationContext", include_subtypes=False))
        if len(contexts) < 2:
            return []
        sigs = [tuple(sorted((self.operation(op) for op in (getattr(c, "HasCoordinateOperation", None) or ())), key=repr)) for c in contexts]
        if all(s == sigs[0] for s in sigs):
            return []
        odd = next(c for c, s in zip(contexts, sigs) if s != sigs[0])
        return [self.finding("GRF001", odd, "HasCoordinateOperation", "the %d geometric representation contexts do not share one coordinate operation: %s" % (
            len(contexts), ", ".join("#%d %s" % (c.id(), "none" if not s else s[0][0]) for c, s in zip(contexts, sigs))), "model")]

    def grf003(self):
        if self.family == "IFC4" and self.m.by_type("IfcBuilding") and not self.m.by_type("IfcProjectedCRS"):
            return [self.finding("GRF003", self.m.by_type("IfcBuilding")[0], None, "the model has a building but no IfcProjectedCRS", "model")]
        if self.family == "IFC4X3" and self.m.by_type("IfcFacility") and not self.m.by_type("IfcCoordinateReferenceSystem"):
            return [self.finding("GRF003", self.m.by_type("IfcFacility")[0], None, "the model has a facility but no coordinate reference system", "model")]
        return []

    def crs_unit(self, crs):
        """The CRS's horizontal unit in metres: metres for the Nordic codes the app knows, else from its MapUnit; None when unknown."""
        name = str(getattr(crs, "Name", None) or "")
        try:
            if name.upper().startswith("EPSG:") and _cs_crs_facts(name)[0] is not None:
                return 1.0
        except Exception:
            pass
        unit = getattr(crs, "MapUnit", None)
        if unit is None:
            return None
        if unit.is_a("IfcSIUnit"):
            import ifcopenshell.util.unit
            return float(ifcopenshell.util.unit.get_prefix_multiplier(unit.Prefix)) if unit.Prefix else 1.0
        if unit.is_a("IfcConversionBasedUnit") and unit.ConversionFactor is not None:
            factor = float(unit.ConversionFactor.ValueComponent.wrappedValue)
            base = unit.ConversionFactor.UnitComponent
            return factor * (self.crs_unit_of_si(base) or 1.0)
        return None

    @staticmethod
    def crs_unit_of_si(unit):
        import ifcopenshell.util.unit
        return float(ifcopenshell.util.unit.get_prefix_multiplier(unit.Prefix)) if getattr(unit, "Prefix", None) else 1.0

    def grf005(self):
        if self.family == "IFC2X3":
            return []
        import ifcopenshell.util.unit
        out = []
        project = float(ifcopenshell.util.unit.calculate_unit_scale(self.m, "LENGTHUNIT") or 1.0)
        for conv in self.m.by_type("IfcMapConversion"):
            crs = self.crs_unit(conv.TargetCRS) if conv.TargetCRS is not None else None
            if crs is None:
                continue
            scale = getattr(conv, "Scale", None)
            if not scale or float(scale) == 1.0:
                if not math.isclose(crs, project, rel_tol=1e-9):
                    out.append(self.finding("GRF005", conv, "Scale", "the map conversion has no scale, but the project's length unit (%g m) differs from the CRS's (%g m); the rule wants Scale %g" % (project, crs, crs / project)))
            elif not math.isclose(crs / project, float(scale), rel_tol=1e-9):
                out.append(self.finding("GRF005", conv, "Scale", "the map conversion's Scale %g is not the CRS's unit (%g m) divided by the project's (%g m), %g" % (float(scale), crs, project, crs / project)))
        return out


def _rule_duplicate(coords, tolerance, skip=None):
    """The first pair (i, j) of points closer than the tolerance, the pair `skip` (a closed polyline's ends) excepted; None."""
    n = len(coords)
    if n <= 64:
        for i in range(n):
            for j in range(i + 1, n):
                if (i, j) != skip and math.dist(coords[i], coords[j]) < tolerance:
                    return (i, j)
        return None
    cells = {}
    size = max(tolerance, 1e-12)
    for j, c in enumerate(coords):
        key = tuple(int(math.floor(v / size)) for v in c)
        for near in _rule_neighbours(key):
            for i in cells.get(near, ()):
                if (i, j) != skip and math.dist(coords[i], c) < tolerance:
                    return (i, j)
        cells.setdefault(key, []).append(j)
    return None


def _rule_near_edges(ring, tolerance, most=120):
    """Two edges of a closed ring that are not neighbours and come closer than the tolerance (the rule's precision), as their
    indices; None, also for a ring of more than `most` edges, which shapely's validity alone covers."""
    from shapely.geometry import LineString
    pts = [p for i, p in enumerate(ring) if i == 0 or p != ring[i - 1]]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    if n < 4 or n > most:
        return None
    edges = [LineString([pts[i], pts[(i + 1) % n]]) for i in range(n)]
    for i in range(n):
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            if edges[i].distance(edges[j]) < tolerance:
                return (i, j)
    return None


def _rule_neighbours(key):
    out = [()]
    for k in key:
        out = [o + (k + d,) for o in out for d in (-1, 0, 1)]
    return out


def _rule_curve_points(curve):
    """A profile curve as 2D points in order, for the curves the app can trace: polylines, indexed poly curves (arcs sampled) and
    composite curves of those; None for the others."""
    if curve is None:
        return None
    if curve.is_a("IfcPolyline"):
        return [tuple(float(v) for v in p.Coordinates[:2]) for p in (curve.Points or ())]
    if curve.is_a("IfcIndexedPolyCurve"):
        pts = [tuple(float(v) for v in c[:2]) for c in (curve.Points.CoordList or ())]
        segments = getattr(curve, "Segments", None)
        if not segments:
            return pts
        out = []
        for seg in segments:
            idx = [int(i) - 1 for i in (seg.wrappedValue if hasattr(seg, "wrappedValue") else seg[0])]
            if any(i < 0 or i >= len(pts) for i in idx):
                return None
            run = [pts[i] for i in idx]
            if seg.is_a("IfcArcIndex") and len(run) == 3:
                run = _rule_arc(*run)
            out += run if not out else run[1:]
        return out
    if curve.is_a("IfcCompositeCurve"):
        out = []
        for seg in (curve.Segments or ()):
            part = _rule_curve_points(getattr(seg, "ParentCurve", None))
            if part is None:
                return None
            if getattr(seg, "SameSense", True) is False:
                part = part[::-1]
            out += part if not out else part[1:]
        return out
    return None


def _rule_arc(a, b, c, n=8):
    """An arc through three points as n segments; the three points when they are in line."""
    ax, ay = a
    bx, by = b
    cx, cy = c
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-12:
        return [a, b, c]
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    r = math.hypot(ax - ux, ay - uy)
    t0, t1, t2 = (math.atan2(p[1] - uy, p[0] - ux) for p in (a, b, c))
    sweep = (t2 - t0) % (2 * math.pi)
    if (t1 - t0) % (2 * math.pi) > sweep:
        sweep -= 2 * math.pi
    return [(ux + r * math.cos(t0 + sweep * k / n), uy + r * math.sin(t0 + sweep * k / n)) for k in range(n + 1)]


def _ifc_rules(model, scope=None, limit=RULE_MAX_FINDINGS):
    """The rules on a model (every instance, or the step ids in scope): {"findings": [...], "errors", "warnings", "rules": {code:
    {level, title, count}}, "source"}, errors first."""
    found = _Rules(model).run(scope)
    return _rule_report(list(found.values()), limit)


def _rule_report(findings, limit=RULE_MAX_FINDINGS):
    findings = sorted(findings, key=lambda f: (f["level"] != "error", str(f.get("rule") or "~"), f.get("id") or 0))
    by_rule = {}
    for f in findings:
        code = f.get("rule") or "read"
        r = by_rule.setdefault(code, {"level": f["level"], "title": RULE_TITLES.get(code), "count": 0})
        r["count"] += 1
    return {"findings": [{k: v for k, v in f.items() if k != "_key"} for f in findings[:limit]], "errors": sum(1 for f in findings if f["level"] == "error"),
            "warnings": sum(1 for f in findings if f["level"] != "error"), "rules": by_rule, "source": RULE_SOURCE}


def _ifc_max_id(model):
    try:
        return int(model.get_max_id())
    except Exception:
        return max((e.id() for e in model), default=0)


def _ifc_rules_new(base, model, touched=()):
    """The rules' findings on a candidate that its base did not have (_ifc_changeset): the instances the change set added (step ids
    above the base's), the ones it touched with their property and quantity sets and their types are tried, a finding on an instance
    the base has counts only when the base's instance lacks it, and the model-level rules count when the base passed them."""
    top = _ifc_max_id(base)
    scope = set(range(top + 1, _ifc_max_id(model) + 1))
    for i in touched:
        try:
            e = model.by_id(int(i))
        except Exception:
            continue
        scope.add(e.id())
        for rel in (getattr(e, "IsDefinedBy", None) or ()):
            d = getattr(rel, "RelatingPropertyDefinition", None)
            if d is not None and hasattr(d, "id"):
                scope.add(d.id())
        for rel in (getattr(e, "IsTypedBy", None) or ()):
            scope.add(rel.RelatingType.id())
    candidate = _Rules(model).run(scope)
    old = [f for f in candidate.values() if f.get("id") is not None and f["id"] <= top]
    before = {}
    if old:
        rules = _Rules(base)
        for i in {f["id"] for f in old}:
            try:
                for f in rules.of(base.by_id(i)):
                    before[f["_key"]] = f
            except Exception:
                continue
    for f in _Rules(base).model_level():
        before[f["_key"]] = f
    return _rule_report([f for key, f in candidate.items() if key not in before])


def _ifc_express(model):
    """The schema's EXPRESS rules (ifcopenshell.validate with express_rules) as {key: finding}; the attribute names the rule."""
    import ifcopenshell.validate
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(model, logger, express_rules=True)
    out = {}
    for s in logger.statements:
        if not isinstance(s, dict) or str(s.get("level", "")).lower() != "error":
            continue
        inst = s.get("instance")
        rule = _ifc_text(s.get("attribute"))
        message = " ".join(str(s.get("message", "")).split("\n\n")[0].split())[:300]
        key = "%s:%s:%s" % (rule, inst.id() if inst is not None else "model", message if rule is None else "")
        out.setdefault(key, {"level": "error", "kind": "express", "rule": rule, "ifc_class": inst.is_a() if inst is not None else None,
                             "id": inst.id() if inst is not None else None, "guid": getattr(inst, "GlobalId", None) if inst is not None else None,
                             "attribute": rule, "message": message})
    return out


def _ifc_express_new(base, model, limit=20):
    """The EXPRESS rules at approval: {"ran", "errors", "findings"} with only what the base did not break already (the base is checked
    only when the candidate has findings), or {"ran": false, "note"} for a model above EXPRESS_MAX_ENTITIES or without the rules."""
    try:
        size = _ifc_max_id(model)
        if size > EXPRESS_MAX_ENTITIES:
            return {"ran": False, "errors": 0, "findings": [], "note": "the schema's rules were left out on a model of %d instances" % size}
        found = _ifc_express(model)
        before = _ifc_express(base) if found else {}
    except Exception as exc:
        return {"ran": False, "errors": 0, "findings": [], "note": "the schema's rules could not run: %s: %s" % (type(exc).__name__, exc)}
    new = [f for key, f in found.items() if key not in before]
    return {"ran": True, "errors": len(new), "findings": new[:limit]}


def _ifc_ids_brief(model, path, limit=8):
    """A candidate against an IDS file for the preview: the specifications that fail, each with its name, how many checks fail and
    the first elements with the reason; {"error"} when ifctester cannot read the file or is missing."""
    try:
        import ifctester.ids
        import ifctester.reporter
        ids = ifctester.ids.open(path)
        ids.validate(model, should_filter_version=True)
        res = ifctester.reporter.Json(ids).report()
    except Exception as exc:
        return {"file": os.path.basename(str(path)), "error": "%s: %s" % (type(exc).__name__, str(exc)[:200])}
    failed = []
    for spec in res.get("specifications", []):
        bad = [e for req in (spec.get("requirements") or []) for e in (req.get("failed_entities") or [])]
        if spec.get("status") is False or bad:
            failed.append({"name": spec.get("name") or "", "failed": len(bad),
                           "examples": [{"class": e.get("class"), "id": e.get("id"), "name": e.get("name"), "reason": _ifc_clip(e.get("reason"), 160) or None} for e in bad[:3]]})
    return {"file": os.path.basename(str(path)), "specifications": int(res.get("total_specifications") or 0),
            "passed": int(res.get("total_specifications_pass") or 0), "failed": failed[:limit]}


def _ifc_rule_findings(findings, errors, *reports):
    """The schema's findings with the rules' (and the EXPRESS rules') new ones: errors after the schema's, warnings last, and the
    errors counted, so that a rule error blocks approval as a schema error does."""
    head, tail = list(findings), []
    for r in reports:
        if not r:
            continue
        head += [f for f in r.get("findings") or [] if f.get("level") == "error"][:20]
        tail += [f for f in r.get("findings") or [] if f.get("level") != "error"][:10]
        errors += int(r.get("errors") or 0)
    return head + tail, errors


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
                m = (getattr(placement, "get_local_placement", None) or placement.get_placement)(wall.ObjectPlacement)  # get_placement since IfcOpenShell 0.9.1
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
        return float((getattr(placement, "get_local_placement", None) or placement.get_placement)(storey.ObjectPlacement)[2][3]) * scale  # get_placement since 0.9.1
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


def _ifc_changeset(in_file, changeset_json, out_file, options_json=None):
    """The recipe step "AI-ändring": a change set's operations on the model, checked against the schema and written as IFC.

    Called by the app with the dataset as a SQLite file (also for the preview, which never touches the dataset). Returns the
    report: what was created (with refs), changed and deleted, the schema findings and what the change set broke in the model's
    relationships (new against the base, counted as errors), counts for the log, the changes of
    existing instances in Dataregium's proposal form (`proposal`), `notes` about what an operation could not do in the
    file's schema (the map conversion in IFC2X3), and the candidate's `topology` (_ifc_topology) on the storeys of the walls the
    change set created, changed or deleted, or {"error"} when it could not be computed.

    Also `rules`, buildingSMART's rules on what the change set made or changed (_ifc_rules_new: the new findings carry their rule
    among the findings, errors counted and warnings apart). options_json (optional): {"express": true} runs the schema's EXPRESS rules
    as well, at approval (`express`, _ifc_express_new; new errors counted), and {"ids": path} tries the candidate against an IDS file
    (`ids`, _ifc_ids_brief; not counted as errors).
    """
    opts = json.loads(options_json or "{}")
    file_name, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "changeset-in.ifc"), data)
    ops = json.loads(changeset_json or "[]")
    cs = _ChangeSet(model)
    cs.apply(ops)
    findings, errors = cs.findings()
    note = _ifc_crs_note(model) if cs.created else None
    if note:
        cs.notes.append(note)
    _ifc_header(model, file_name)
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
        rules = _ifc_rules_new(base, model, [r.get("id") for r in cs.created + list(cs.changed.values())])
    except Exception as exc:
        rules = {"findings": [], "errors": 0, "warnings": 0, "rules": {}, "error": "%s: %s" % (type(exc).__name__, exc)}
    express = _ifc_express_new(base, model) if opts.get("express") else None
    findings, errors = _ifc_rule_findings(findings, errors, rules, express)
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
    extra = {"rules": {k: v for k, v in rules.items() if k != "findings"}}
    if express is not None:
        extra["express"] = {k: v for k, v in express.items() if k != "findings"}
    if opts.get("ids"):
        extra["ids"] = _ifc_ids_brief(model, opts["ids"])
    return json.dumps(dict({"elements": len(model.by_type("IfcElement")), "entities": len(list(model)), "file": file_name, "operations": len(ops),
                            "created": cs.created, "changed": list(cs.changed.values()), "deleted": cs.deleted, "findings": findings, "errors": errors,
                            "proposal": proposal, "notes": cs.notes, "topology": topology}, **extra),
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


PARAMETERS_MAX = 200


def _ifc_parameters_file(in_file, ids_json, out_file):
    """The measures edit_element reads of elements (_ChangeSet.parameters), for the read tool get_parameters: ids_json is a JSON list of
    STEP ids or GlobalIds, at most PARAMETERS_MAX; an id the model lacks gives {"id", "error"}. The original IFC is read from the SQLite
    file, nothing is written back, and the JSON list is written to out_file and returned."""
    _, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "parameters-in.ifc"), data)
    cs = _ChangeSet(model)
    out = []
    for ref in (json.loads(ids_json or "[]") or [])[:PARAMETERS_MAX]:
        try:
            out.append(cs.parameters(cs.entity(ref)))
        except DataspatiumError as exc:
            out.append({"id": ref, "error": str(exc)})
    text = json.dumps(out, ensure_ascii=False, default=str)
    with open(out_file, "w", encoding="utf-8") as fh:
        fh.write(text)
    return text


# ---- personal data out of a model's copy (the review before sharing) ----------------------------------------------------
# A model handed to an authority becomes a public record (Boverket 2023:4), so the copy that leaves the app can lose what names
# people. The app finds it (data/ifc-step `personalOf`, data/share-scan) and the person chooses per part: "hash" writes codes
# (salted SHA-256, the same as dm_hash, so a value gives the same code in the file and in the tables), "remove" takes it away.
# GlobalIds, the spatial structure and the elements stay; the dataset itself is never touched.
SCRUB_MASK = "[***]"
SCRUB_PLACEHOLDERS = ("", "none", "unknown", "undefined", "not defined", "not specified", "nobody", "n/a", "-", "?")


def _scrub_code(salt, value):
    import hashlib
    key = (str(salt) + "|" + str(value)) if salt else str(value)
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def _scrub_id_attr(entity):
    """The identification attribute of a person or organisation: Identification from IFC4, Id in IFC2X3."""
    return "Identification" if hasattr(entity, "Identification") else "Id"


def _scrub_neutral_person(p):
    """The app's own neutral owner (identification "user", family name "User", no address) names nobody."""
    ident = getattr(p, _scrub_id_attr(p), None)
    names = [p.GivenName] + list(p.MiddleNames or ()) + list(p.PrefixTitles or ()) + list(p.SuffixTitles or ())
    return (not ident or ident == "user") and p.FamilyName in (None, "", "User") and not any(names) and not p.Addresses


def _scrub_person_key(p):
    parts = [getattr(p, _scrub_id_attr(p), None), p.GivenName] + list(p.MiddleNames or ()) + [p.FamilyName]
    return " ".join(str(x) for x in parts if x) or "#%d" % p.id()


def _scrub_address(model, owner, choice, salt):
    """The postal and telecom addresses of a person or organisation: codes in every field that says where, or gone."""
    addresses = list(owner.Addresses or ())
    if choice == "remove":
        owner.Addresses = None
        for a in addresses:
            if not model.get_total_inverses(a):
                model.remove(a)
        return len(addresses)
    code = lambda v: _scrub_code(salt, v) if v else v  # noqa: E731
    for a in addresses:
        if a.is_a("IfcTelecomAddress"):
            for attr in ("TelephoneNumbers", "FacsimileNumbers", "ElectronicMailAddresses", "MessagingIDs"):
                if hasattr(a, attr) and getattr(a, attr):
                    setattr(a, attr, tuple(code(v) for v in getattr(a, attr)))
            for attr in ("PagerNumber", "WWWHomePageURL"):
                if getattr(a, attr, None):
                    setattr(a, attr, code(getattr(a, attr)))
        elif a.is_a("IfcPostalAddress"):
            if a.AddressLines:
                a.AddressLines = tuple(code(v) for v in a.AddressLines)
            for attr in ("InternalLocation", "PostalBox", "Town", "Region", "PostalCode"):
                if getattr(a, attr, None):
                    setattr(a, attr, code(getattr(a, attr)))
    return len(addresses)


def _scrub_person(model, p, choice, salt):
    """A person with a code for names and identification ("hash"), or as the app's neutral user ("remove"); IFC2X3 needs a name."""
    value = _scrub_code(salt, _scrub_person_key(p)) if choice == "hash" else None
    setattr(p, _scrub_id_attr(p), value or "user")
    p.FamilyName = value or "User"
    for attr in ("GivenName", "MiddleNames", "PrefixTitles", "SuffixTitles"):
        setattr(p, attr, None)
    _scrub_address(model, p, choice, salt)


def _scrub_stand_in(model, who, salt, made):
    """For "hash" of an owner or actor: a new user with a coded person in place of the one named (the same person gives the same
    stand-in); an organisation alone stays, since it names no person. Returns the entity to point at."""
    if who is None or not (who.is_a("IfcPerson") or who.is_a("IfcPersonAndOrganization")):
        return who
    person = who if who.is_a("IfcPerson") else who.ThePerson
    if person is None or _scrub_neutral_person(person):
        return who
    code = _scrub_code(salt, _scrub_person_key(person))
    key = (code, who.TheOrganization.id() if who.is_a("IfcPersonAndOrganization") and who.TheOrganization else 0)
    if key not in made:
        stand_in = model.create_entity("IfcPerson", **{"Id" if model.schema == "IFC2X3" else "Identification": code, "FamilyName": code})
        made["persons"].add(stand_in.id())
        if who.is_a("IfcPersonAndOrganization"):
            stand_in = model.create_entity("IfcPersonAndOrganization", ThePerson=stand_in, TheOrganization=who.TheOrganization)
        made[key] = stand_in
    return made[key]


def _scrub_orphans(model, ids):
    """Who an owner history or actor named and nothing names any more: gone, with their addresses."""
    for cls in ("IfcPersonAndOrganization", "IfcApplication", "IfcPerson", "IfcOrganization"):
        for e in list(model.by_type(cls)):
            if e.id() in ids and not model.get_total_inverses(e):
                addresses = list(getattr(e, "Addresses", None) or ())
                model.remove(e)
                for a in addresses:
                    if not model.get_total_inverses(a):
                        model.remove(a)


def _scrub_named(entity):
    """The ids an owner history's users and applications, or an actor's TheActor, point at (to clear the orphans afterwards)."""
    out = set()
    for i in range(len(entity)):
        v = entity[i]
        if hasattr(v, "is_a") and v.id() and (v.is_a("IfcPersonAndOrganization") or v.is_a("IfcPerson") or v.is_a("IfcOrganization") or v.is_a("IfcApplication")):
            out.add(v.id())
            for j in range(len(v)):
                inner = v[j]
                if hasattr(inner, "is_a") and inner.id():
                    out.add(inner.id())
    return out


def _scrub_owner(model, choice, salt, made):
    """The owner histories: their users get stand-ins ("hash"; the applications stay), or the histories go ("remove"; IFC2X3,
    where every object must have one, gets the app's neutral owner instead)."""
    histories = list(model.by_type("IfcOwnerHistory"))
    named = set()
    for h in histories:
        named |= _scrub_named(h)
    if choice == "hash":
        for h in histories:
            for attr in ("OwningUser", "LastModifyingUser"):
                user = getattr(h, attr)
                stand_in = _scrub_stand_in(model, user, salt, made)
                if stand_in is not user:
                    setattr(h, attr, stand_in)
    else:
        neutral = _ifc_new_owner(model) if model.schema == "IFC2X3" and histories else None
        for h in histories:
            if neutral is not None:
                for e in model.get_inverse(h):
                    if hasattr(e, "OwnerHistory") and e.OwnerHistory == h:
                        e.OwnerHistory = neutral
            model.remove(h)
    _scrub_orphans(model, named)
    return len(histories)


def _scrub_header(model, choice, salt):
    """FILE_NAME's author, organisation and authorisation: codes, or empty as IfcOpenShell writes them."""
    fn = model.header.file_name
    real = lambda v: str(v or "").strip().lower() not in SCRUB_PLACEHOLDERS  # noqa: E731
    if choice == "hash":
        fn.author = tuple(_scrub_code(salt, v) if real(v) else v for v in (fn.author or ("",)))
        fn.organization = tuple(_scrub_code(salt, v) if real(v) else v for v in (fn.organization or ("",)))
        fn.authorization = _scrub_code(salt, fn.authorization) if real(fn.authorization) else fn.authorization
    else:
        fn.author = ("",)
        fn.organization = ("",)
        fn.authorization = ""
    return 1


def _scrub_dangling(model, rels):
    """Relationships left without their relating or related side after an object went."""
    for rel in rels:
        try:
            info = rel.get_info(recursive=False)
        except Exception:
            continue
        if any((k.startswith("Relating") and v is None) or (k.startswith("Related") and k != "RelatedObjectsType" and v in (None, ()))
               for k, v in info.items()):
            model.remove(rel)


def _scrub_actors(model, choice, salt, made):
    """IfcActor and IfcOccupant: a code for the name and a stand-in for the person ("hash"), or gone with their assignments."""
    actors = list(model.by_type("IfcActor"))
    named = set()
    for a in actors:
        named |= _scrub_named(a)
        if choice == "hash":
            if a.Name:
                a.Name = _scrub_code(salt, a.Name)
            a.Description = None
            stand_in = _scrub_stand_in(model, a.TheActor, salt, made)
            if stand_in is not a.TheActor:
                a.TheActor = stand_in
        else:
            rels = [r for r in model.get_inverse(a) if r.is_a("IfcRelationship")]
            model.remove(a)
            _scrub_dangling(model, rels)
    _scrub_orphans(model, named)
    return len(actors)


def _scrub_value(model, value, clean):
    """A string, a wrapped value (IfcLabel, IfcText ...) or a list of them, with the pieces cleaned; the same object if nothing changed."""
    if isinstance(value, str):
        out = clean(value)
        return value if out == value else out
    if isinstance(value, tuple):
        out = tuple(_scrub_value(model, v, clean) for v in value)
        return value if all(a is b for a, b in zip(out, value)) else out
    if hasattr(value, "is_a") and not value.id() and isinstance(getattr(value, "wrappedValue", None), str):
        text = value.wrappedValue
        out = clean(text)
        return value if out == text else model.create_entity(value.is_a(), out)
    return value


def _scrub_text(model, choice, matches, salt):
    """The pieces of free text the app's detectors found, in Name and Description of every object and in the properties: a code
    each ("hash") or [***] ("remove"), the rest of the text as it was."""
    found = sorted({str(m) for m in matches or () if m}, key=len, reverse=True)
    if not found:
        return 0

    def clean(s):
        for m in found:
            if m in s:
                s = s.replace(m, _scrub_code(salt, m) if choice == "hash" else SCRUB_MASK)
        return s
    changed = 0
    for e in model.by_type("IfcRoot"):
        for attr in ("Name", "Description"):
            v = getattr(e, attr, None)
            if isinstance(v, str):
                out = clean(v)
                if out != v:
                    setattr(e, attr, out)
                    changed += 1
    for e in model.by_type("IfcProperty"):
        for i in range(len(e)):
            v = e[i]
            out = _scrub_value(model, v, clean)
            if out is not v:
                e[i] = out
                changed += 1
    return changed


def _ifc_scrub(in_file, options_file, out_file):
    """The review before sharing: personal data out of the copy's model, by the parts the person chose (see above).

    options_file holds {"persons", "organizations", "owner", "header", "actors", "text": "hash" | "remove" | absent, "matches":
    [pieces of free text], "salt"}. The original IFC is read from the copy's SQLite file and the cleaned one written to out_file;
    the app builds the copy's tables from it. Returns what was changed per part.
    """
    file_name, data = _ifc_original_from(in_file)
    with open(options_file, encoding="utf-8") as fh:
        opts = json.load(fh) or {}
    salt = str(opts.get("salt") or "")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "scrub-in.ifc"), data)
    choice = lambda k: opts.get(k) if opts.get(k) in ("hash", "remove") else None  # noqa: E731
    made = {"persons": set()}
    done = {}
    if choice("header"):
        done["header"] = _scrub_header(model, choice("header"), salt)
    if choice("owner"):
        done["owner"] = _scrub_owner(model, choice("owner"), salt, made)
    if choice("actors"):
        done["actors"] = _scrub_actors(model, choice("actors"), salt, made)
    if choice("persons"):
        people = [p for p in model.by_type("IfcPerson") if not _scrub_neutral_person(p) and not (choice("persons") == "hash" and p.id() in made["persons"])]
        for p in people:
            _scrub_person(model, p, choice("persons"), salt)
        done["persons"] = len(people)
    if choice("organizations"):
        done["organizations"] = sum(_scrub_address(model, o, choice("organizations"), salt) for o in model.by_type("IfcOrganization") if o.Addresses)
    if choice("text"):
        done["text"] = _scrub_text(model, choice("text"), opts.get("matches") or [], salt)
    model.write(out_file)
    return json.dumps({"file": file_name, "changed": done, "elements": len(model.by_type("IfcElement")), "entities": len(list(model))}, ensure_ascii=False)


# ---- the right IFC class (decision B-57.2) ------------------------------------------------------------
# In native IFC the class is the classification (decision B-59): the most specific entity with its PredefinedType, an ObjectType
# only for USERDEFINED, and a type object; a system the person names comes on top through set_classification. _ifc_class_search
# finds the class for a thing from its English words in IfcOpenShell's documentation of the schema; _ifc_class_report lists what
# in a model falls short of that.

CLASS_ROOTS = ("IfcElement", "IfcSpatialElement", "IfcSpatialStructureElement", "IfcTypeProduct")
# PredefinedTypes the IFC releases deprecate (bSI rule IFC102), by the file's schema family: never written, flagged in the search.
DEPRECATED_VALUES = {
    "IFC4": {"IfcWall": ("STANDARD", "POLYGONAL", "ELEMENTEDWALL"), "IfcWallType": ("STANDARD", "POLYGONAL", "ELEMENTEDWALL")},
    "IFC4X3": {"IfcWall": ("STANDARD", "POLYGONAL"), "IfcWallType": ("STANDARD", "POLYGONAL"), "IfcSpace": ("INTERNAL", "EXTERNAL"),
               "IfcSpaceType": ("INTERNAL", "EXTERNAL"), "IfcBuildingElementProxy": ("PROVISIONFORSPACE", "PROVISIONFORVOID")},
}
CLASS_RULES = {
    "userdefined": "IFC CorrectPredefinedType; ifc-gherkin-rules OJT001 Object Predefined Type",
    "type_conflicts": "ifc-gherkin-rules OJT001 Object Predefined Type (concept template 4.1.3.2)",
    "outside": "ifc-gherkin-rules SPS007 Spatial Containment",
}


def _ifc_schema(name):
    """IfcOpenShell's definition of a schema by its name (IFC2X3, IFC4, IFC4X3_ADD2 ...), or by the one of its line that the app's
    IfcOpenShell carries (a file header's IFC4X3 or IFC2X3_TC1)."""
    import ifcopenshell
    upper = str(name or "").upper()
    for candidate in (str(name), next((s for s in IFC_NEW_SCHEMAS if upper.startswith(s.split("_")[0])), None)):
        try:
            return ifcopenshell.schema_by_name(candidate)
        except Exception:
            continue
    raise DataspatiumError("unknown IFC schema %r; the app reads %s" % (name, ", ".join(IFC_NEW_SCHEMAS)))


def _ifc_declaration(schema, name):
    """A declaration of the schema by name; None for one it lacks."""
    try:
        return schema.declaration_by_name(str(name))
    except Exception:
        return None


def _ifc_enum_items(decl, attribute="PredefinedType"):
    """The items of an entity's enumeration attribute; None when the entity has no such attribute."""
    import ifcopenshell.util.attribute
    attr = next((a for a in decl.all_attributes() if a.name() == attribute), None)
    if attr is None:
        return None
    try:
        return list(ifcopenshell.util.attribute.get_enum_items(attr))
    except Exception:
        return None


def _ifc_concrete(decl):
    """The names of the non-abstract entities at or below a declaration, in order."""
    out, stack = set(), [decl]
    while stack:
        d = stack.pop()
        if not d.is_abstract():
            out.add(d.name())
        stack.extend(d.subtypes())
    return sorted(out)


def _ifc_below(decl, name):
    """Whether a declaration is the entity `name` or one of its subtypes."""
    while decl is not None:
        if decl.name() == name:
            return True
        decl = decl.supertype()
    return False


def _ifc_clip(text, n=300):
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + " …"


def _ifc_class_search(schema, query, limit=12):
    """The classes of a schema for a thing named in English IFC words (decision B-57.2). Every word of the query must occur, in any
    case, in the class's name, its description, a PredefinedType's name or doc, or a name IfcOpenShell suggests for the class
    (ifcopenshell.util.doc; without its data the schema's names and enumerations alone). Among the non-abstract elements, spatial
    elements and type products, hits on the class's own name come first, then those on a PredefinedType's name, then the rest, and
    occurrences before types; a type whose occurrence class is a hit is left out. Per hit: class, the matching PredefinedTypes with
    their docs (all of them when the class's name matched; deprecated ones last and marked, IFC102), a description clipped to about
    300 characters, spec_url when known, and the type class (for a type, the occurrence class)."""
    import re
    import ifcopenshell.util.doc as doc
    import ifcopenshell.util.type as types
    s = _ifc_schema(schema)
    family = "IFC4X3" if s.name().upper().startswith("IFC4X3") else s.name().upper()
    words = [w for w in re.split(r"[^0-9a-z]+", str(query).lower()) if w]
    if not words:
        raise DataspatiumError("give the thing to look for in English IFC words, such as sink, handrail or curtain wall")
    try:
        docs = (doc.get_db(s.name()) or {}).get("entities") or {}
    except Exception:
        docs = {}
    roots = [d for d in (_ifc_declaration(s, n) for n in CLASS_ROOTS) if d is not None]
    found = []
    for name in sorted({n for r in roots for n in _ifc_concrete(r)}):
        decl = s.declaration_by_name(name)
        info = docs.get(name) or {}
        pt_docs = info.get("predefined_types") or {}
        pts = list(dict.fromkeys((_ifc_enum_items(decl) or []) + list(pt_docs)))
        try:
            suggested = doc.get_class_suggestions(s.name(), name) or []
        except Exception:
            suggested = []
        lname, ldesc = name.lower(), str(info.get("description") or "").lower()

        def in_pt(w, pt):
            return w in pt.lower() or w in str(pt_docs.get(pt) or "").lower()
        said = [x for x in suggested if any(w in str(x.get("name", "")).lower() for w in words)]
        if not all(w in lname or w in ldesc or any(in_pt(w, pt) for pt in pts) or any(w in str(x.get("name", "")).lower() for x in said) for w in words):
            continue
        by_name = all(w in lname for w in words)
        tier = 0 if by_name else 1 if all(w in lname or any(w in pt.lower() for pt in pts) for w in words) else 2
        chosen = pts if by_name else [pt for pt in pts if any(in_pt(w, pt) for w in words) or any(x.get("predefined_type") == pt for x in said)]
        gone = set(DEPRECATED_VALUES.get(family, {}).get(name, ())) | {pt for pt in pts if ".deprecated" in str(pt_docs.get(pt) or "")}
        hit = {"class": name, "predefined_types": [dict({"name": pt, "doc": _ifc_clip(str(pt_docs.get(pt) or "").replace("{ .deprecated}", ""), 200) or None},
                                                        **({"deprecated": True} if pt in gone else {})) for pt in sorted(chosen, key=lambda p: p in gone)],
               "description": _ifc_clip(info.get("description")) or None}
        if info.get("spec_url"):
            hit["spec_url"] = info["spec_url"]
        if said:
            hit["known_as"] = [str(x.get("name")) for x in said]
        is_type = _ifc_below(decl, "IfcTypeProduct")
        try:
            pair = types.get_applicable_entities(name, schema=s.name()) if is_type else types.get_applicable_types(name, schema=s.name())
        except Exception:
            pair = []
        pair = [getattr(x, "ifc_class", x) for x in pair]
        hit["occurrence_class" if is_type else "type_class"] = pair[0] if pair else None
        if len(pair) > 1:
            hit["occurrence_classes" if is_type else "type_classes"] = pair[:8]
        found.append(((tier, is_type, len(name), name), hit))
    found.sort(key=lambda x: x[0])
    # A type is left out when its occurrence class matched as well (IFC2X3 keeps IfcSanitaryTerminalType over IfcFlowTerminal).
    tiers = {h["class"]: key[0] for key, h in found}
    hits = [h for key, h in found if tiers.get(h.get("occurrence_class"), 9) > key[0]]
    return hits[:max(1, min(50, int(limit or 12)))]


def _ifc_class_report(model, limit=50):
    """What in a model falls short of the right IFC class (decision B-57.2), as counts and up to `limit` examples each: proxies
    (IfcBuildingElementProxy); USERDEFINED without the name of the type, ObjectType on an occurrence or ElementType on a type (the
    schema's CorrectPredefinedType and OJT001); elements without a type although their class has a type class; occurrences with a
    PredefinedType of their own while their type has one other than NOTDEFINED (OJT001: the occurrence's must then be empty; IFC4
    and later); and elements outside the spatial structure, neither contained nor part of an element that is (SPS007). Feature
    elements (openings) are left out of the last three, as SPS007 does."""
    import ifcopenshell.util.element as el
    import ifcopenshell.util.type as types
    schema = getattr(model, "schema_identifier", None) or model.schema
    pairs = {}

    def type_classes(cls):
        if cls not in pairs:
            try:
                pairs[cls] = list(types.get_applicable_types(cls, schema=schema))[:5]
            except Exception:
                pairs[cls] = []
        return pairs[cls]

    def bucket(rule=None):
        return dict({"count": 0, "examples": []}, **({"rule": rule} if rule else {}))

    def add(b, e, **extra):
        b["count"] += 1
        if len(b["examples"]) < limit:
            rec = {"id": e.id(), "guid": getattr(e, "GlobalId", None), "ifc_class": e.is_a(), "name": _ifc_text(getattr(e, "Name", None))}
            rec.update({k: v for k, v in extra.items() if v is not None})
            b["examples"].append(rec)

    def located(e, depth=0):
        if getattr(e, "ContainedInStructure", None):
            return True
        wholes = [r.RelatingObject for inverse in ("Decomposes", "Nests") for r in (getattr(e, inverse, None) or ())]
        return depth < 32 and any(hasattr(w, "ContainsElements") or located(w, depth + 1) for w in wholes)

    proxies, untyped = bucket(), dict(bucket(), by_class={})
    userdefined = dict(bucket(CLASS_RULES["userdefined"]), occurrences=0, types=0)
    conflicts, outside = bucket(CLASS_RULES["type_conflicts"]), bucket(CLASS_RULES["outside"])
    elements = model.by_type("IfcElement")
    for e in elements:
        if e.is_a("IfcBuildingElementProxy"):
            add(proxies, e, object_type=_ifc_text(getattr(e, "ObjectType", None)), predefined_type=getattr(e, "PredefinedType", None))
        if e.is_a("IfcFeatureElement"):
            continue
        if el.get_type(e) is None and type_classes(e.is_a()):
            add(untyped, e, type_classes=type_classes(e.is_a()))
            untyped["by_class"][e.is_a()] = untyped["by_class"].get(e.is_a(), 0) + 1
        if not located(e):
            add(outside, e)
    untyped["by_class"] = dict(sorted(untyped["by_class"].items(), key=lambda x: (-x[1], x[0]))[:30])
    for o in model.by_type("IfcObject"):
        if getattr(o, "PredefinedType", None) == "USERDEFINED" and not str(getattr(o, "ObjectType", None) or "").strip():
            userdefined["occurrences"] += 1
            add(userdefined, o, kind="occurrence")
    for t in model.by_type("IfcTypeObject"):
        named = next((a for a in ("ElementType", "ProcessType", "ResourceType") if hasattr(t, a)), None)
        if named and getattr(t, "PredefinedType", None) == "USERDEFINED" and not str(getattr(t, named, None) or "").strip():
            userdefined["types"] += 1
            add(userdefined, t, kind="type")
    if model.schema != "IFC2X3":
        for rel in model.by_type("IfcRelDefinesByType"):
            t = rel.RelatingType
            tpt = getattr(t, "PredefinedType", None)
            if tpt is None or str(tpt).startswith("NOTDEFINED"):
                continue
            for o in (rel.RelatedObjects or ()):
                if getattr(o, "PredefinedType", None) is not None:
                    add(conflicts, o, predefined_type=o.PredefinedType, differs=o.PredefinedType != tpt,
                        type={"id": t.id(), "ifc_class": t.is_a(), "name": _ifc_text(getattr(t, "Name", None)), "predefined_type": tpt})
    return {"schema": schema, "elements": len(elements), "proxies": proxies, "userdefined": userdefined, "untyped": untyped,
            "type_conflicts": conflicts, "outside": outside}


def _ifc_class_report_file(in_file, out_file):
    """The class report (_ifc_class_report) of the model kept in a dataset file, for the read tool get_class_report and the card
    IFC-klasser in Kontrollera: the original IFC is read from the SQLite file, and the JSON is written to out_file and returned."""
    _, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "classes-in.ifc"), data)
    text = json.dumps(_ifc_class_report(model), ensure_ascii=False, default=str)
    with open(out_file, "w", encoding="utf-8") as fh:
        fh.write(text)
    return text


# ---- basic requirements (recommendation 5 of the Praxi study, 2026-11-12) ---------------------------------------------------
# The card Grunduppgifter in Kontrollera tries a model against the basic rules of BIM Alliance's guidance Praxi for IFC, in the app's
# own words (decision B-59.3: no text, value list or template of Praxi is copied): the file header names the view, the originating
# system, the preprocessor and the time; the model has a projected CRS named by one EPSG code with a map conversion and a height
# system; the site, the building (with its long name) and the storeys (with a description) have names; every space has a number
# (Name) of its own within its building; a set of one's own neither starts like IFC's Pset_ and Qto_ nor uses other characters
# than A-Z, digits, - and _, starts with a country code (SE-…) and names its properties in PascalCase; and no text value carries
# its unit ("40 dB" instead of 40). IDS cannot try the header or uniqueness, which is why this is a check of its own.

BASICS_CHECKS = ("header", "crs", "names", "rooms", "psets", "units")
_BASICS_UNITS = ("mm", "cm", "dm", "m", "km", "m2", "m²", "m3", "m³", "kg", "g", "t", "kn", "n", "pa", "kpa", "mpa", "db", "db(a)",
                 "°c", "°", "k", "w", "kw", "kwh", "w/m2k", "w/m²k", "w/(m2k)", "w/(m²k)", "w/mk", "l", "l/s", "m3/s", "m³/s", "h", "min", "s")


def _ifc_basics(model, limit=8):
    """The basic requirements of a model (the card Grunduppgifter): per check in BASICS_CHECKS its status (ok, warn or fail), facts
    to show and its faults, each {code, level, count, examples} with up to `limit` examples as short technical lines."""
    import re
    schema = str(getattr(model, "schema", "") or "").upper()
    family = "IFC4X3" if schema.startswith("IFC4X3") else "IFC2X3" if schema.startswith("IFC2X3") else "IFC4"

    def label(e):
        return "#%d %s %s" % (e.id(), e.is_a(), repr(str(getattr(e, "Name", None) or "")) if getattr(e, "Name", None) else "–")

    def check(key, facts=None):
        return {"key": key, "status": "ok", "facts": facts or {}, "faults": []}

    def fault(c, code, level, items):
        items = list(items)
        if not items:
            return
        c["faults"].append({"code": code, "level": level, "count": len(items), "examples": [str(x) for x in items[:limit]]})
        if level == "fail" or (level == "warn" and c["status"] == "ok"):
            c["status"] = level

    out = []
    # The header: the view definition, the originating system, the preprocessor and the time (author and organisation are a
    # person's facts and stay out of the card).
    head = getattr(model, "header", None)
    name = getattr(head, "file_name", None)
    description = [str(x) for x in (getattr(getattr(head, "file_description", None), "description", None) or ())]
    view = next((x for x in description if "viewdefinition" in x.lower().replace(" ", "")), "")
    facts = {"view": view, "system": str(getattr(name, "originating_system", "") or ""), "preprocessor": str(getattr(name, "preprocessor_version", "") or ""),
             "time": str(getattr(name, "time_stamp", "") or ""), "schema": ", ".join(str(x) for x in (getattr(getattr(head, "file_schema", None), "schema_identifiers", None) or ()))}
    c = check("header", facts)
    fault(c, "no_system", "fail", ["FILE_NAME originating_system"] if not facts["system"].strip() else [])
    fault(c, "no_view", "warn", ["FILE_DESCRIPTION"] if not view else [])
    fault(c, "no_preprocessor", "warn", ["FILE_NAME preprocessor_version"] if not facts["preprocessor"].strip() else [])
    fault(c, "no_time", "warn", ["FILE_NAME time_stamp"] if not re.match(r"^\d{4}-\d\d-\d\dT\d\d:\d\d", facts["time"]) else [])
    out.append(c)
    # The coordinate system.
    crs = [x for x in model.by_type("IfcCoordinateReferenceSystem")] if family != "IFC2X3" else []
    conversions = model.by_type("IfcMapConversion") if family != "IFC2X3" else []
    first = crs[0] if crs else None
    c = check("crs", {"crs": str(getattr(first, "Name", "") or ""), "height": str(getattr(first, "VerticalDatum", "") or ""), "conversions": len(conversions)})
    if family == "IFC2X3":
        sites = model.by_type("IfcSite")
        fault(c, "ifc2x3", "warn", ["IFC2X3"])
        fault(c, "no_latlon", "fail", [label(s) for s in sites if not getattr(s, "RefLatitude", None) or not getattr(s, "RefLongitude", None)])
    else:
        fault(c, "no_crs", "fail", ["IfcProjectedCRS"] if not crs else [])
        fault(c, "not_epsg", "fail", ["#%d %s %r" % (x.id(), x.is_a(), str(x.Name or "")) for x in crs if not re.match(r"^EPSG:\d+$", str(x.Name or "").strip())])
        fault(c, "no_conversion", "fail", ["IfcMapConversion"] if crs and not conversions else [])

        def has_height(x):
            code = str(x.Name or "")[5:]
            return bool(getattr(x, "VerticalDatum", None)) or (code.isdigit() and 5845 <= int(code) <= 5857)
        fault(c, "no_height", "warn", ["#%d %s %r" % (x.id(), x.is_a(), str(x.Name or "")) for x in crs if x.is_a("IfcProjectedCRS") and not has_height(x)])
    out.append(c)
    # Names on the site, the building and the storeys.
    c = check("names")
    fault(c, "no_name", "fail", [label(e) for cls in ("IfcProject", "IfcSite", "IfcBuilding", "IfcBuildingStorey") for e in model.by_type(cls) if not str(e.Name or "").strip()])
    fault(c, "no_long_name", "warn", [label(e) for e in model.by_type("IfcBuilding") if not str(getattr(e, "LongName", None) or "").strip()])
    fault(c, "no_description", "warn", [label(e) for e in model.by_type("IfcBuildingStorey") if not str(e.Description or "").strip()])
    buildings = model.by_type("IfcBuilding")
    fault(c, "buildings", "warn", [label(e) for e in buildings] if len(buildings) > 1 else [])
    c["facts"] = {"sites": len(model.by_type("IfcSite")), "buildings": len(buildings), "storeys": len(model.by_type("IfcBuildingStorey"))}
    out.append(c)
    # Room numbers: every space has a Name, unique within its building.
    import ifcopenshell.util.element as el
    spaces = model.by_type("IfcSpace")
    c = check("rooms", {"spaces": len(spaces)})
    fault(c, "no_number", "fail", [label(s) for s in spaces if not str(s.Name or "").strip()])
    seen = {}
    for s in spaces:
        number = str(s.Name or "").strip()
        if not number:
            continue
        p, building = s, None
        for _ in range(32):
            p = el.get_aggregate(p) or el.get_container(p)
            if p is None or p.is_a("IfcBuilding"):
                building = p
                break
        seen.setdefault(((building.id() if building is not None else 0), number), []).append(s)
    fault(c, "duplicate", "fail", ["%r: %s" % (k[1], ", ".join("#%d" % s.id() for s in v[:6])) for k, v in sorted(seen.items(), key=lambda x: x[0][1]) if len(v) > 1])
    out.append(c)
    # The naming of one's own property and quantity sets.
    try:
        import ifcopenshell.util.pset
        templates = ifcopenshell.util.pset.get_template(getattr(model, "schema_identifier", None) or model.schema)
    except Exception:
        templates = None
    try:  # IFC2X3 has no quantity sets of its own, and the sets IFC4 added are written there as IFC4 defines them
        later = ifcopenshell.util.pset.get_template("IFC4") if family == "IFC2X3" else None
    except Exception:
        later = None
    own = {}
    for s in list(model.by_type("IfcPropertySet")) + list(model.by_type("IfcElementQuantity")):
        n = str(s.Name or "")
        if any(k is not None and k.get_by_name(n) is not None for k in (templates, later)):
            continue
        rec = own.setdefault(n, set())
        for p in (getattr(s, "HasProperties", None) or getattr(s, "Quantities", None) or ()):
            rec.add(str(p.Name or ""))
    c = check("psets", {"own": len(own)})
    fault(c, "prefix", "fail", [n for n in sorted(own) if re.match(r"^(pset|qto)_?", n, re.I)])
    fault(c, "chars", "warn", [n for n in sorted(own) if not re.match(r"^[A-Za-z0-9_-]+$", n)])
    fault(c, "country", "warn", [n for n in sorted(own) if not re.match(r"^[A-Z]{2}-", n) and not re.match(r"^(pset|qto)_?", n, re.I)])
    fault(c, "pascal", "warn", ["%s.%s" % (n, p) for n in sorted(own) for p in sorted(own[n]) if not re.match(r"^[A-Z][A-Za-z0-9]*$", p)])
    out.append(c)
    # Units written inside text values.
    units = "|".join(re.escape(u) for u in sorted(_BASICS_UNITS, key=len, reverse=True))
    pattern = re.compile(r"^\s*[-+]?\d+(?:[.,]\d+)?\s*(?:%s)\s*$" % units, re.I)
    found = []
    for p in model.by_type("IfcPropertySingleValue"):
        v = p.NominalValue
        if v is None or v.is_a() not in ("IfcLabel", "IfcText", "IfcIdentifier"):
            continue
        text = str(v.wrappedValue or "")
        if pattern.match(text):
            sets = [s.Name for s in (getattr(p, "PartOfPset", None) or ())]
            found.append("%s.%s = %r" % (sets[0] if sets else "?", p.Name, text))
    c = check("units")
    fault(c, "unit", "warn", list(dict.fromkeys(found)))
    out.append(c)
    return {"schema": getattr(model, "schema_identifier", None) or model.schema, "checks": out}


def _ifc_basics_file(in_file, out_file):
    """The basic requirements (_ifc_basics) of the model kept in a dataset file, for the card Grunduppgifter in Kontrollera: the
    original IFC is read from the SQLite file, and the JSON is written to out_file and returned."""
    _, data = _ifc_original_from(in_file)
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    model = _ifc_open_bytes(os.path.join(os.path.dirname(out_file), "basics-in.ifc"), data)
    text = json.dumps(_ifc_basics(model), ensure_ascii=False, default=str)
    with open(out_file, "w", encoding="utf-8") as fh:
        fh.write(text)
    return text


# The schemas a new model can be written in (OB-06): the newest first, which is the default.
IFC_NEW_SCHEMAS = ("IFC4X3_ADD2", "IFC4", "IFC2X3")


# The view definition the header of a file the app writes declares, per schema family (recommendation 11 of the Praxi study). Only
# the names buildingSMART's validation service accepts per schema count (github.com/buildingSMART/validate, header_policy
# valid_descriptions.yaml; the header guide in github.com/buildingSMART/IFC4.x-IF, docs/IFC-file-header): CoordinationView_V2.0
# for IFC2X3 and ReferenceView_V1.2 for IFC4, the base views those schemas have, which no bSI rule holds a file's entities against.
# IFC4X3_ADD2 accepts only ReferenceView and Alignment-basedView, and bSI rule IFC430 places IfcExtrudedAreaSolid,
# IfcMaterialLayerSetUsage, IfcRelConnectsPathElements and IfcRelSpaceBoundary outside the IFC4.3 Reference View, so no official
# view fits a model the app authors in the full schema. There the header says 'ViewDefinition [notYetAssigned]', the neutral form
# of buildingSMART's own example files, rather than claim a view the file does not follow; the validation service flags it as it
# would flag no view at all, and a recipient who requires a view says which in the EIR.
IFC_HEADER_VIEWS = {"IFC2X3": "CoordinationView_V2.0", "IFC4": "ReferenceView_V1.2", "IFC4X3": None}
IFC_HEADER_VALID = {"IFC2X3": ("CoordinationView_V2.0", "SpaceBoundaryAddonView", "BasicFMHandoverView", "StructuralAnalysisView"),
                    "IFC4": ("ReferenceView_V1.2", "IFC4Precast"), "IFC4X3": ("ReferenceView", "Alignment-basedView")}


def _ifc_header_view(entries, schema, new):
    """FILE_DESCRIPTION.description: the entries (Comment, ExchangeRequirement, Option …) kept, and the ViewDefinition entry the
    app's for the schema (IFC_HEADER_VIEWS) on a new file, or on a file whose own one names no view the validation service accepts
    for its schema; a file's valid view stays, since it is its author's statement."""
    import re
    entries = [str(e) for e in (entries or ()) if str(e).strip()]
    views = [e for e in entries if e.strip().startswith("ViewDefinition")]
    named = []
    for e in views:
        found = re.search(r"\[(.*)\]", e)
        named += [v.strip() for v in (found.group(1) if found else "").split(",") if v.strip()]
    valid = IFC_HEADER_VALID.get(schema, ())
    if not new and named and all(v in valid or "AddOnView" in v for v in named) and all(re.match(r"^ViewDefinition \[", e.strip()) for e in views):
        return tuple(entries)
    own = "ViewDefinition [%s]" % (IFC_HEADER_VIEWS.get(schema) or "notYetAssigned")
    return tuple([own] + [e for e in entries if e not in views])


def _ifc_header(model, file_name, new=False, author=None, organization=None):
    """The STEP header of a file the app writes (recommendation 11 of the Praxi study; the header guide of buildingSMART):
    FILE_DESCRIPTION with the view definition (_ifc_header_view) and implementation level '2;1', and FILE_NAME with the file's name,
    the time in ISO 8601 (UTC), the preprocessor (Dataspatium with its version and IfcOpenShell's) and the originating system in the
    form the validation service reads ('Dataspatium - Dataspatium - <version>'). The author and organisation are empty on a new
    file unless the person entered them (they are personal data), and kept as they are on a file the app changes, as are its
    authorisation and an originating system of another program."""
    import ifcopenshell
    header = model.header
    schema = "IFC4X3" if str(model.schema).upper().startswith("IFC4X3") else str(model.schema).upper()
    header.file_description.description = _ifc_header_view(header.file_description.description, schema, new)
    header.file_description.implementation_level = "2;1"
    version = _state.get("version") or "0"
    name = header.file_name
    name.name = os.path.basename(str(file_name or "")) or "model.ifc"
    name.time_stamp = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()
    name.preprocessor_version = "Dataspatium %s (IfcOpenShell %s)" % (version, ifcopenshell.version)
    origin = str(name.originating_system or "").strip()
    if new or not origin or origin.startswith("IfcOpenShell") or origin.startswith("Dataspatium"):
        name.originating_system = "Dataspatium - Dataspatium - %s" % version
    if new:
        name.author = (str(author or "").strip()[:255],)
        name.organization = (str(organization or "").strip()[:255],)
        name.authorization = ""


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
    the counts, the schema check's findings and notes (the missing CRS, bSI rule GRF003, until set_site gives one).

    Optional keys, each written only when given (recommendations 2, 11 and 15 of the Praxi and native IFC studies, B3 of Boverket's
    report 2024:26): site_long_name (IfcSite.LongName; the app names the site after the property designation when there is one),
    land_id (the property designation as Pset_LandRegistration.LandID), building_long_name (IfcBuilding.LongName; the name is the
    building number when there is one), building_id (the national building id as Pset_BuildingCommon.BuildingID with
    IsPermanentID true), storey_description (the first storey's Description), author and organization (the header's, personal
    data the person enters) and file_name (the header's name of the file). The model contexts are Model with Body and Axis.
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
        # The walls' Axis representations have their sub-context from the start (recommendation 15 of the native IFC study).
        ifcopenshell.api.context.add_context(model, context_type="Model", context_identifier="Axis", target_view="GRAPH_VIEW", parent=context)
        site = cs.root("IfcSite", name("site", "Site"))
        site.CompositionType = "ELEMENT"
        site.ObjectPlacement = cs.placement(None, 0, 0, 0)
        ifcopenshell.api.aggregate.assign_object(model, products=[site], relating_object=project)
        building = cs.root("IfcBuilding", name("building", "Building"))
        building.CompositionType = "ELEMENT"
        building.ObjectPlacement = cs.placement(site.ObjectPlacement, 0, 0, 0)
        ifcopenshell.api.aggregate.assign_object(model, products=[building], relating_object=site)
        _ifc_new_names(model, site, building, opts)
    finally:
        cs.restore_owner_settings(previous)
    cs.scale = 1.0
    first = {"name": name("storey", "Level 1"), "elevation": _cs_num(opts, "elevation", 0.0)}
    if name("storey_description", None):
        first["description"] = name("storey_description", None)
    cs.apply([{"tool": "create_storeys_and_grid", "storeys": [first]}])
    findings, errors = cs.findings()
    notes = [n for n in [_ifc_crs_note(model)] if n]
    _ifc_header(model, opts.get("file_name") or out_file, new=True, author=opts.get("author"), organization=opts.get("organization"))
    os.makedirs(os.path.dirname(out_file) or ".", exist_ok=True)
    model.write(out_file)
    return json.dumps({"schema": model.schema_identifier if hasattr(model, "schema_identifier") else schema, "entities": len(list(model)),
                       "storeys": len(model.by_type("IfcBuildingStorey")), "findings": findings[:20], "errors": errors, "notes": notes},
                      ensure_ascii=False, default=str)


def _ifc_new_names(model, site, building, opts):
    """The Swedish names and numbers of a new model, each only when given (see _ifc_new_model): the site's long name and the
    property designation in Pset_LandRegistration.LandID, the building's long name, and the national building id in
    Pset_BuildingCommon.BuildingID with IsPermanentID true (Boverket's B3: one lasting identity per building)."""
    import ifcopenshell.api.pset

    def text(key):
        return str(opts.get(key) or "").strip()[:255] or None
    if text("site_long_name"):
        site.LongName = text("site_long_name")
    if text("land_id"):
        pset = ifcopenshell.api.pset.add_pset(model, product=site, name="Pset_LandRegistration")
        ifcopenshell.api.pset.edit_pset(model, pset=pset, properties={"LandID": text("land_id")})
    if text("building_long_name"):
        building.LongName = text("building_long_name")
    if text("building_id"):
        pset = ifcopenshell.api.pset.add_pset(model, product=building, name="Pset_BuildingCommon")
        ifcopenshell.api.pset.edit_pset(model, pset=pset, properties={"BuildingID": text("building_id"), "IsPermanentID": True})


def _ifc_crs_note(model):
    """The report's note when a model with a site or a building has no coordinate reference system (bSI rule GRF003, industry
    practice); None when it has one, and in IFC2X3, which has none to give."""
    if model.schema == "IFC2X3" or model.by_type("IfcCoordinateReferenceSystem"):
        return None
    if not (model.by_type("IfcSite") or model.by_type("IfcBuilding")):
        return None
    return ("GRF003: the model has no coordinate reference system yet; place it with set_site and an EPSG code (for a building in "
            "Sweden SWEREF 99 with RH 2000) when its place is known")
