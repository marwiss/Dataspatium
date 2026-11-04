#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Dataspatium database bridge (Python 3, standard library; pyodbc is used when it is installed).

The same service as tools/db-bridge.ps1, for macOS, Linux and Windows without PowerShell: a small local HTTP
service that Dataspatium opens from Inhämta -> "Databas via bryggan". It serves SQLite files directly and, with
pyodbc, every ODBC data source on the computer (PostgreSQL, MySQL/MariaDB, SQL Server, Oracle, Access ...).
Nothing leaves the computer: it listens on 127.0.0.1 only, requires the token printed at start, answers CORS only
for the app's origins (a page opened from a folder sends Origin "null") and is read-only unless --allow-write is
given; even then every write needs the user's approval in the app (approved: true). Ctrl+C or POST /stop stops it.

Usage:
  python tools/db_bridge.py
  python tools/db_bridge.py --port 8731 --allow-write
Options: --port N (0 = random), --token T (default random), --allow-write, --max-rows N (default 100000),
  --allow-origin O (repeatable; default "null" and https://marwiss.github.io; localhost origins are always allowed).

Protocol (JSON): GET / (info), GET /sources, POST /tables {source}, POST /columns {source, table},
  POST /rows {source, table, limit}, POST /query {source, sql, limit, approved}, GET /log, GET or POST /stop.
A source is {kind: sqlite|dsn|odbc|access|excel, ...} with path, dsn, user, password or connectionString.
"""
import argparse
import datetime
import decimal
import json
import re
import secrets
import socket
import sqlite3
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import pyodbc  # type: ignore
except ImportError:  # pragma: no cover - optional
    pyodbc = None

VERSION = "2.3.0"
KINDS = ["sqlite"] + (["dsn", "odbc", "access", "excel"] if pyodbc else [])


def parse_args():
    p = argparse.ArgumentParser(description="Dataspatium database bridge")
    p.add_argument("--port", type=int, default=0)
    p.add_argument("--token", default="")
    p.add_argument("--allow-write", action="store_true")
    p.add_argument("--max-rows", type=int, default=100000)
    p.add_argument("--allow-origin", action="append", default=None)
    return p.parse_args()


def read_only(sql):
    s = re.sub(r"/\*[\s\S]*?\*/", " ", sql)
    s = re.sub(r"--[^\r\n]*", " ", s).strip()
    if ";" in s.rstrip(";"):
        return False
    first = (s.split() or [""])[0].upper()
    return first in ("SELECT", "WITH", "VALUES", "PRAGMA", "EXPLAIN")


def type_name(value):
    """Python value -> the .NET-like type names the app maps (Int64, Double, String, DateTime, Boolean ...)."""
    if isinstance(value, bool):
        return "Boolean"
    if isinstance(value, int):
        return "Int64"
    if isinstance(value, float):
        return "Double"
    if isinstance(value, decimal.Decimal):
        return "Decimal"
    if isinstance(value, datetime.datetime):
        return "DateTime"
    if isinstance(value, datetime.date):
        return "Date"
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "Byte[]"
    return "String"


def convert(value):
    if isinstance(value, datetime.datetime):
        return value.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(value, datetime.date):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        import base64
        return base64.b64encode(bytes(value)).decode("ascii")
    return value


class Bridge:
    def __init__(self, args):
        self.allow_write = args.allow_write
        self.max_rows = args.max_rows
        self.log = []
        self.lock = threading.Lock()

    # ---- connections ----
    def connect(self, source):
        kind = (source or {}).get("kind")
        if kind == "sqlite":
            path = source.get("path")
            if not path:
                raise ValueError("Ange sökvägen till SQLite-filen.")
            uri = "file:" + path.replace("\\", "/") + ("?mode=ro" if not self.allow_write else "")
            cn = sqlite3.connect(uri, uri=True, timeout=10)
            return "sqlite", cn
        if not pyodbc:
            raise ValueError("Källtypen %s kräver pyodbc (pip install pyodbc)." % kind)
        if kind == "dsn":
            if not source.get("dsn"):
                raise ValueError("Ange DSN.")
            cs = "DSN=%s;" % source["dsn"]
            if source.get("user"):
                cs += "UID=%s;PWD=%s;" % (source["user"], source.get("password", ""))
        elif kind == "odbc":
            cs = source.get("connectionString") or ""
            if not cs:
                raise ValueError("Ange anslutningssträngen.")
        elif kind == "access":
            if not source.get("path"):
                raise ValueError("Ange sökvägen till Access-filen.")
            cs = "Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=%s;" % source["path"]
            if source.get("password"):
                cs += "PWD=%s;" % source["password"]
        elif kind == "excel":
            if not source.get("path"):
                raise ValueError("Ange sökvägen till Excel-filen.")
            cs = "Driver={Microsoft Excel Driver (*.xls, *.xlsx, *.xlsm, *.xlsb)};DBQ=%s;ReadOnly=1;" % source["path"]
        else:
            raise ValueError("Okänd källtyp: %s" % kind)
        return "odbc", pyodbc.connect(cs, timeout=15)

    @staticmethod
    def quote(kind, source, name):
        if kind == "odbc" and (source or {}).get("kind") in ("access", "excel"):
            return "[" + str(name).replace("]", "]]") + "]"
        return '"' + str(name).replace('"', '""') + '"'

    # ---- endpoints ----
    def info(self):
        return {"name": "Dataspatium-databasbrygga", "version": VERSION, "platform": sys.platform, "allowWrite": self.allow_write, "kinds": KINDS, "maxRows": self.max_rows, "pyodbc": bool(pyodbc)}

    def sources(self):
        out = {"dsns": [], "drivers": [], "providers": []}
        if pyodbc:
            try:
                out["dsns"] = [{"name": n, "driver": d} for n, d in pyodbc.dataSources().items()]
            except Exception:  # pragma: no cover
                pass
            try:
                out["drivers"] = list(pyodbc.drivers())
            except Exception:  # pragma: no cover
                pass
        return out

    def tables(self, source):
        kind, cn = self.connect(source)
        try:
            if kind == "sqlite":
                cur = cn.execute("select name, type from sqlite_master where type in ('table', 'view') and name not like 'sqlite_%' order by name")
                return [{"name": r[0], "type": r[1].upper()} for r in cur.fetchall()]
            cur = cn.cursor()
            rows = cur.tables(tableType="TABLE,VIEW").fetchall()
            out = []
            for r in rows:
                name = r.table_name
                if r.table_schem and r.table_schem not in ("dbo", "public", "main"):
                    name = "%s.%s" % (r.table_schem, name)
                out.append({"name": name, "type": r.table_type})
            return out
        finally:
            cn.close()

    def columns(self, source, table):
        kind, cn = self.connect(source)
        try:
            cur = cn.cursor()
            cur.execute("SELECT * FROM %s WHERE 1 = 0" % self.quote(kind, source, table))
            cols = []
            declared = {}
            if kind == "sqlite":
                for r in cn.execute('PRAGMA table_info("%s")' % str(table).replace('"', '""')).fetchall():
                    declared[r[1]] = (r[2] or "").upper()
            for d in cur.description or []:
                name = d[0]
                t = "String"
                if kind == "sqlite":
                    decl = declared.get(name, "")
                    t = "Int64" if "INT" in decl else "Double" if any(k in decl for k in ("REAL", "FLOA", "DOUB", "NUM", "DEC")) else "Boolean" if "BOOL" in decl else "DateTime" if "TIME" in decl else "Date" if "DATE" in decl else "String"
                elif d[1] is not None:
                    t = {int: "Int64", float: "Double", bool: "Boolean", decimal.Decimal: "Decimal", datetime.datetime: "DateTime", datetime.date: "Date", bytes: "Byte[]", bytearray: "Byte[]"}.get(d[1], "String")
                cols.append({"name": name, "type": t, "nullable": d[6] if len(d) > 6 and d[6] is not None else True})
            return cols
        finally:
            cn.close()

    def read(self, kind, cn, sql, limit):
        cur = cn.cursor()
        cur.execute(sql)
        names = [d[0] for d in (cur.description or [])]
        rows = []
        truncated = False
        for r in cur:
            if len(rows) >= limit:
                truncated = True
                break
            rows.append([convert(v) for v in r])
        types = []
        for i, name in enumerate(names):
            sample = next((r[i] for r in rows if r[i] is not None), None)
            # Values are already converted; take the type from the raw sample where it tells more than the text.
            types.append({"name": name, "type": type_name(sample)})
        if kind == "sqlite":
            # typeof() per column on the result would need a second query; declared types come from /columns.
            pass
        return {"columns": types, "rows": rows, "truncated": truncated}

    def rows(self, source, table, limit):
        kind, cn = self.connect(source)
        try:
            return self.read(kind, cn, "SELECT * FROM %s" % self.quote(kind, source, table), limit)
        finally:
            cn.close()

    def query(self, source, sql, limit, approved):
        write = not read_only(sql)
        if write and not self.allow_write:
            return 403, {"error": "Bryggan är skrivskyddad; starta med --allow-write för att tillåta ändringar"}
        if write and not approved:
            return 428, {"error": "Skrivning kräver användarens godkännande (approved: true)", "sql": sql}
        kind, cn = self.connect(source)
        try:
            if write:
                cur = cn.cursor()
                cur.execute(sql)
                n = cur.rowcount
                cn.commit()
                result = {"affected": n}
            else:
                result = self.read(kind, cn, sql, limit)
        finally:
            cn.close()
        with self.lock:
            self.log.append({"at": datetime.datetime.now().isoformat(timespec="seconds"), "kind": (source or {}).get("kind"), "sql": sql[:120], "write": write})
            del self.log[:-200]
        return 200, result


def make_handler(bridge, token, allow_origins, server_box):
    class Handler(BaseHTTPRequestHandler):
        server_version = "Dataspatium-bridge/" + VERSION

        def log_message(self, fmt, *args):  # quiet
            pass

        def origin_ok(self, origin):
            return origin in allow_origins or origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1")

        def send_json(self, status, obj):
            data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.cors()
            self.end_headers()
            self.wfile.write(data)

        def cors(self):
            origin = self.headers.get("Origin")
            if origin and self.origin_ok(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Max-Age", "600")
                if self.headers.get("Access-Control-Request-Private-Network") == "true":
                    self.send_header("Access-Control-Allow-Private-Network", "true")

        def do_OPTIONS(self):
            origin = self.headers.get("Origin")
            if origin and not self.origin_ok(origin):
                self.send_json(403, {"error": "Ursprunget tillåts inte: " + origin})
                return
            self.send_response(204)
            self.cors()
            self.end_headers()

        def guard(self):
            origin = self.headers.get("Origin")
            if origin and not self.origin_ok(origin):
                self.send_json(403, {"error": "Ursprunget tillåts inte: " + origin})
                return False
            host = (self.headers.get("Host") or "").split(":")[0]
            if host not in ("127.0.0.1", "localhost"):
                self.send_json(403, {"error": "Bara 127.0.0.1"})
                return False
            if self.headers.get("Authorization") != "Bearer " + token:
                self.send_json(401, {"error": "Fel eller saknad token"})
                return False
            return True

        def body(self):
            n = int(self.headers.get("Content-Length") or 0)
            if not n:
                return {}
            return json.loads(self.rfile.read(n).decode("utf-8") or "{}")

        def do_GET(self):
            if not self.guard():
                return
            try:
                if self.path == "/":
                    self.send_json(200, bridge.info())
                elif self.path == "/sources":
                    self.send_json(200, bridge.sources())
                elif self.path == "/log":
                    self.send_json(200, {"entries": bridge.log})
                elif self.path == "/stop":
                    self.send_json(200, {"stopping": True})
                    threading.Thread(target=server_box[0].shutdown, daemon=True).start()
                else:
                    self.send_json(404, {"error": "Okänd sökväg " + self.path})
            except Exception as err:  # noqa: BLE001 - reported to the app
                self.send_json(500, {"error": str(err)})

        def do_POST(self):
            if not self.guard():
                return
            try:
                b = self.body()
                limit = min(int(b.get("limit") or bridge.max_rows), bridge.max_rows)
                if self.path == "/tables":
                    t = bridge.tables(b.get("source"))
                    self.send_json(200, {"tables": t, "count": len(t)})
                elif self.path == "/columns":
                    self.send_json(200, {"columns": bridge.columns(b.get("source"), b.get("table"))})
                elif self.path == "/rows":
                    self.send_json(200, bridge.rows(b.get("source"), b.get("table"), limit))
                elif self.path == "/query":
                    sql = str(b.get("sql") or "")
                    if not sql.strip():
                        self.send_json(400, {"error": "Tom fråga"})
                        return
                    status, result = bridge.query(b.get("source"), sql, limit, bool(b.get("approved")))
                    self.send_json(status, result)
                elif self.path == "/stop":
                    self.send_json(200, {"stopping": True})
                    threading.Thread(target=server_box[0].shutdown, daemon=True).start()
                else:
                    self.send_json(404, {"error": "Okänd sökväg " + self.path})
            except Exception as err:  # noqa: BLE001 - reported to the app
                self.send_json(500, {"error": str(err)})

    return Handler


def main():
    args = parse_args()
    token = args.token or secrets.token_urlsafe(18)
    allow_origins = set(args.allow_origin or ["null", "https://marwiss.github.io"])
    port = args.port
    if port == 0:
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
    bridge = Bridge(args)
    box = [None]
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(bridge, token, allow_origins, box))
    box[0] = server
    print("Dataspatium-databasbrygga %s lyssnar på http://127.0.0.1:%d/" % (VERSION, port))
    print("Token: " + token)
    print("Klistra in adressen och token i appen under Inhämta -> Databas via bryggan. Ctrl+C stoppar.")
    print("Skrivning TILLÅTEN (--allow-write); varje skrivning kräver ändå godkännande i appen." if args.allow_write else "Skrivskyddad: bara SELECT.")
    if not pyodbc:
        print("pyodbc saknas: bara SQLite-filer kan öppnas (pip install pyodbc för ODBC-källor).")
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    print("Bryggan har stoppats.")


if __name__ == "__main__":
    main()
