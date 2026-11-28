#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Dataspatium database bridge (Python 3, standard library; its drivers are used when they are installed).

The same service as tools/db-bridge.ps1, for macOS, Linux and Windows without PowerShell: a small local HTTP
service that Dataspatium opens from Inhämta -> "Databas via bryggan". It serves SQLite files directly, connects itself to
MySQL and MariaDB with PyMySQL (MIT), to PostgreSQL (and PostGIS, TimescaleDB, CockroachDB ...) with pg8000 (BSD-3-Clause) and
to Oracle with python-oracledb in thin mode (Apache-2.0 or UPL-1.0), and with pyodbc to every ODBC data source on the computer
(SQL Server, Access ...). None of the drivers ships with the app; `pip install pymysql pg8000 oracledb` installs them, and the
bridge says so when one is missing. A password stays in this process: it is never written to the log, and an error that
repeats it is answered without it.
Nothing leaves the computer: it listens on 127.0.0.1 only, requires the token printed at start, answers CORS only
for the app's origins (a page opened from a folder sends Origin "null") and is read-only unless --allow-write is
given; even then every write needs the user's approval in the app (approved: true). Ctrl+C or POST /stop stops it.

As a go-between (POST /fetch) it fetches an https address for the app when the service does not let the browser read
its answer (no CORS), but only from the hosts the user names with --allow-host; the page can never add one. It refuses
addresses that resolve to this computer or the local network, connects to the address it checked, sends only a few
headers (no cookies), follows at most three redirects to allowed hosts and stops at --max-fetch-mb.

Usage:
  python tools/db_bridge.py
  python tools/db_bridge.py --port 8731 --allow-write
Options: --port N (0 = random), --token T (default random), --allow-write, --max-rows N (default 100000),
  --allow-origin O (repeatable; default "null" and https://marwiss.github.io; localhost origins are always allowed),
  --allow-host H (repeatable; the hosts /fetch may reach, none by default), --max-fetch-mb N (default 50).

Protocol (JSON): GET / (info), GET /sources, POST /tables {source}, POST /columns {source, table},
  POST /rows {source, table, limit}, POST /query {source, sql, limit, approved}, GET /log, GET or POST /stop,
  POST /fetch {url, method, headers, body (base64)} -> {status, statusText, headers, body (base64)}.
A source is {kind: sqlite|dsn|odbc|access|excel, ...} with path, dsn, user, password or connectionString, or
{kind: mysql|mariadb|postgres|oracle, host, port, database, user, password} with tls (mysql, mariadb: disabled, preferred,
required, verify_ca, verify_identity; oracle: disabled, verify_identity) or sslmode (postgres: disable, prefer, require,
verify-ca, verify-full). GET / tells which drivers are installed (drivers: {kind: {name, ok, version, via, package}}).
"""
import argparse
import base64
import datetime
import decimal
import importlib
import json
import math
import re
import secrets
import socket
import sqlite3
import ssl
import sys
import threading
import time
import http.client
import ipaddress
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import pyodbc  # type: ignore
except ImportError:  # pragma: no cover - optional
    pyodbc = None

VERSION = "2.7.0"


def parse_args():
    p = argparse.ArgumentParser(description="Dataspatium database bridge")
    p.add_argument("--port", type=int, default=0)
    p.add_argument("--token", default="")
    p.add_argument("--allow-write", action="store_true")
    p.add_argument("--max-rows", type=int, default=100000)
    p.add_argument("--allow-origin", action="append", default=None)
    p.add_argument("--allow-host", action="append", default=None)
    p.add_argument("--max-fetch-mb", type=int, default=50)
    p.add_argument("--allow-commands", action="store_true", help="let programs on this computer run the app's commands through the bridge")
    return p.parse_args()


# ---- the go-between (POST /fetch) ----
# Headers the app may pass on; a key header of a preset (Ocp-Apim-Subscription-Key, X-Api-Key ...) is allowed by its name.
FETCH_HEADERS = {"accept", "accept-language", "authorization", "content-type", "range", "if-none-match", "if-modified-since"}
NEVER_HEADERS = {"cookie", "cookie2", "host", "origin", "referer", "connection", "content-length", "transfer-encoding", "te", "upgrade", "expect", "keep-alive", "via", "forwarded"}
KEY_HEADER = re.compile(r"^[A-Za-z0-9-]{1,64}$")
RETURN_HEADERS = ("content-type", "content-range", "etag", "last-modified", "link", "x-total-count", "retry-after")
MAX_REDIRECTS = 3


class RelayError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def header_allowed(name):
    n = str(name).lower()
    if n in NEVER_HEADERS or n.startswith("proxy-") or n.startswith("sec-") or not KEY_HEADER.match(str(name)):
        return False
    return n in FETCH_HEADERS or bool(re.search(r"key|token|subscription", n))


def public_address(host, port):
    """The address to connect to, after checking that every address of the name is on the internet."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as err:
        raise RelayError(502, "Kunde inte slå upp %s: %s" % (host, err))
    first = None
    for _fam, _t, _p, _c, sa in infos:
        ip = ipaddress.ip_address(sa[0].split("%")[0])
        if ip.version == 6 and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if not ip.is_global or ip.is_multicast:
            raise RelayError(403, "%s pekar på den egna datorn eller det lokala nätet; bryggan hämtar inte därifrån" % host)
        first = first or sa[0]
    if not first:
        raise RelayError(502, "Ingen adress för %s" % host)
    return first


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    """HTTPS to the address that was checked, with the host name for SNI and the certificate, so a second lookup cannot
    lead somewhere else."""

    def __init__(self, host, address, port, timeout):
        super().__init__(host, port, timeout=timeout, context=ssl.create_default_context())
        self._address = address

    def connect(self):
        sock = socket.create_connection((self._address, self.port), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def relay(allow_hosts, max_bytes, request, timeout=60):
    """Fetch one address for the app. Returns the answer as {status, statusText, headers, body (base64)}."""
    url = str(request.get("url") or "")
    method = str(request.get("method") or "GET").upper()
    if method not in ("GET", "POST"):
        raise RelayError(400, "Bara GET och POST")
    headers = {str(k): str(v) for k, v in (request.get("headers") or {}).items() if header_allowed(k)}
    body = base64.b64decode(request["body"]) if request.get("body") else None
    if body is not None and len(body) > 10 * 1024 * 1024:
        raise RelayError(413, "Begärans kropp är större än 10 MB")
    for _hop in range(MAX_REDIRECTS + 1):
        u = urllib.parse.urlsplit(url)
        host = (u.hostname or "").lower()
        if u.scheme != "https" or not host:
            raise RelayError(400, "Bryggan hämtar bara https-adresser")
        if host not in allow_hosts:
            raise RelayError(403, "Värden %s är inte tillåten. Starta bryggan med --allow-host %s om du vill hämta från den." % (host, host))
        port = u.port or 443
        conn = PinnedHTTPSConnection(host, public_address(host, port), port, timeout)
        try:
            conn.request(method, (u.path or "/") + ("?" + u.query if u.query else ""), body=body, headers=headers)
            res = conn.getresponse()
            location = res.getheader("location")
            if res.status in (301, 302, 303, 307, 308) and location:
                url = urllib.parse.urljoin(url, location)
                if res.status == 303 or (res.status in (301, 302) and method == "POST"):
                    method, body = "GET", None
                continue
            data = res.read(max_bytes + 1)
            if len(data) > max_bytes:
                raise RelayError(413, "Svaret är större än %d MB (--max-fetch-mb)" % (max_bytes // (1024 * 1024)))
            out = {k: res.getheader(k) for k in RETURN_HEADERS if res.getheader(k)}
            return {"status": res.status, "statusText": res.reason, "headers": out, "body": base64.b64encode(data).decode("ascii"), "host": host, "path": u.path}
        except (OSError, http.client.HTTPException) as err:
            raise RelayError(502, "Kunde inte hämta från %s: %s" % (host, err))
        finally:
            conn.close()
    raise RelayError(508, "För många omdirigeringar")


# Words that make a statement that starts with SELECT or WITH write after all: a data-modifying WITH, SELECT ... INTO a new table
# or a file on the server (INTO OUTFILE), SELECT ... FOR UPDATE. Text in quotes is left out before the words are looked for.
WRITE_WORDS = re.compile(r"\b(insert|update|delete|merge|upsert|truncate|drop|alter|create|grant|revoke|into)\b", re.I)


def read_only(sql):
    s = re.sub(r"/\*[\s\S]*?\*/", " ", sql)
    s = re.sub(r"--[^\r\n]*", " ", s).strip()
    if ";" in s.rstrip(";"):
        return False
    first = (s.split() or [""])[0].upper()
    bare = re.sub(r"'(?:[^']|'')*'|\"(?:[^\"]|\"\")*\"|`(?:[^`]|``)*`", "''", s)
    return first in ("SELECT", "WITH", "VALUES", "PRAGMA", "EXPLAIN") and not WRITE_WORDS.search(bare)


def scrub(text, source):
    """A message without the source's password: a driver may repeat what it was given, and nothing the bridge answers or logs
    carries it (values shorter than four characters are left, as in the app's api/secrets)."""
    out = str(text)
    src = source if isinstance(source, dict) else {}
    values = [str(src.get("password") or "")]
    values += re.findall(r"(?i)(?:^|;)\s*(?:pwd|password)\s*=\s*(\{(?:[^}]|\}\})*\}|[^;]*)", str(src.get("connectionString") or ""))
    for v in values:
        v = v.strip()
        if len(v) >= 4:
            out = out.replace(v, "***")
            if v.startswith("{") and v.endswith("}"):
                out = out.replace(v[1:-1].replace("}}", "}"), "***")
    return out


def odbc_value(value):
    """A value for an ODBC connection string: in braces when it holds a character that would end or change the attribute."""
    v = str(value or "")
    return "{" + v.replace("}", "}}") + "}" if re.search(r"[;{}]", v) or v != v.strip() else v


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
    """A driver's value -> JSON: times as ISO text (in UTC when the value knows its zone), bytes as base64, JSON and arrays as
    JSON text, and whatever else a driver gives (UUID, interval, address, range) as its text."""
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, datetime.datetime):
        if value.tzinfo is not None:
            value = value.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return value.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(value, (datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value) if value.is_finite() else None
    if isinstance(value, (bytes, bytearray, memoryview)):
        return base64.b64encode(bytes(value)).decode("ascii")
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


# ---- the bridge's own drivers: MySQL and MariaDB, PostgreSQL, Oracle ----
# Each is imported only when it is installed (pip install pymysql pg8000 oracledb); without it the bridge says how to install it.
# None ships with the app. Licences: PyMySQL MIT, pg8000 BSD-3-Clause, python-oracledb Apache-2.0 or UPL-1.0.

def tls_context(mode):
    """An ssl context for an encryption mode (MySQL's ssl-mode or libpq's sslmode names), or None for no TLS."""
    m = str(mode or "").lower().replace("-", "_")
    if m in ("disabled", "disable"):
        return None
    if m not in ("preferred", "prefer", "required", "require", "verify_ca", "verify_identity", "verify_full"):
        raise ValueError("Okänt läge för kryptering: %s" % mode)
    ctx = ssl.create_default_context()
    if m in ("verify_identity", "verify_full"):
        return ctx
    ctx.check_hostname = False
    if m != "verify_ca":
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


class SqlDriver:
    """A database the bridge connects to itself with a DB-API 2.0 driver (PEP 249). A subclass names the driver and says how
    to connect, list the tables, quote a name and limit a table; reading, writing and the answers are the same as for ODBC.
    A read runs in a read-only transaction where the database has one, and is rolled back."""

    kinds, module, package, title, label, port = (), "", "", "", "", 0
    QUOTE = '"'
    TYPES = {}
    TABLES = ""
    READ_ONLY = ""

    def __init__(self):
        self.mod, self.tried = None, False

    def load(self):
        """The driver's module, or None when it is not installed (tried once)."""
        if not self.tried:
            self.tried = True
            try:
                self.mod = importlib.import_module(self.module)
            except ImportError:
                self.mod = None
        return self.mod

    def require(self):
        if self.load() is None:
            raise ValueError("%s kräver drivrutinen %s, som inte är installerad: pip install %s (och starta om bryggan)" % (self.label, self.title, self.package))
        return self.mod

    def describe(self):
        mod = self.load()
        root = (sys.modules.get(self.module.split(".")[0]) or mod) if mod is not None else None
        return {"name": self.title, "ok": mod is not None, "version": str(getattr(root, "__version__", "") or ""), "via": "python", "package": self.package}

    @staticmethod
    def endpoint(source, port):
        host = str(source.get("host") or "").strip()
        if not host:
            raise ValueError("Ange värden (host).")
        try:
            return host, int(source.get("port") or port)
        except (TypeError, ValueError):
            raise ValueError("Porten måste vara ett tal.")

    @staticmethod
    def split(name):
        """schema.table as the table list writes it -> [schema, table]; a plain name -> [name]."""
        schema, dot, table = str(name).partition(".")
        return [schema, table] if dot and schema and table else [str(name)]

    def quote(self, name):
        q = self.QUOTE
        return ".".join(q + part.replace(q, q + q) + q for part in self.split(name))

    def read_only(self, cn):
        try:
            cur = cn.cursor()
            cur.execute(self.READ_ONLY)
            cur.close()
        except Exception:  # noqa: BLE001 - a server without it (CrateDB, QuestDB): the keyword check and the rollback remain
            pass

    def finish(self, cn):
        try:
            cn.rollback()
        except Exception:  # noqa: BLE001 - nothing to roll back
            pass

    def listed(self, schema, name, source):
        return name

    def tables(self, cn, source):
        cur = cn.cursor()
        cur.execute(self.TABLES)
        out = []
        for schema, name, ttype in cur.fetchall():
            shown = self.listed(str(schema or ""), str(name), source)
            t = str(ttype or "").upper()
            if shown and t in ("BASE TABLE", "TABLE", "VIEW", "FOREIGN", "FOREIGN TABLE"):
                out.append({"name": shown, "type": "TABLE" if t == "BASE TABLE" else t})
        return out

    def coltype(self, d):
        return self.TYPES.get(d[1], "String")

    def select_all(self, cn, source, table, n):
        return "SELECT * FROM %s LIMIT %d" % (self.quote(table), n)


class MySql(SqlDriver):
    kinds, module, package, title, label, port = ("mysql", "mariadb"), "pymysql", "pymysql", "PyMySQL", "MySQL och MariaDB", 3306
    QUOTE = "`"
    TYPES = {0: "Decimal", 246: "Decimal", 1: "Int64", 2: "Int64", 3: "Int64", 8: "Int64", 9: "Int64", 13: "Int64", 4: "Double", 5: "Double",
             10: "Date", 14: "Date", 7: "DateTime", 12: "DateTime"}
    TABLES = "SELECT table_schema, table_name, table_type FROM information_schema.tables ORDER BY table_schema, table_name"
    READ_ONLY = "SET SESSION TRANSACTION READ ONLY"
    SYSTEM = {"mysql", "information_schema", "performance_schema", "sys"}

    def connect(self, source):
        mod = self.require()
        host, port = self.endpoint(source, self.port)
        mode = str(source.get("tls") or "preferred").lower()
        # An unbuffered cursor, so that a large answer is read row by row and stops at the limit.
        cn = mod.connect(host=host, port=port, user=str(source.get("user") or ""), password=str(source.get("password") or ""),
                         database=source.get("database") or None, ssl=tls_context(mode), connect_timeout=15, charset="utf8mb4",
                         cursorclass=mod.cursors.SSCursor)
        if mode not in ("preferred", "disabled"):
            # PyMySQL goes on without TLS when the server offers none; a mode that requires it checks the session.
            cur = cn.cursor()
            cur.execute("SHOW SESSION STATUS LIKE 'Ssl_cipher'")
            row = cur.fetchone()
            cur.close()
            if not row or not row[1]:
                cn.close()
                raise ValueError("Servern krypterar inte anslutningen (tls: %s), så bryggan avbröt den." % mode)
        return cn

    def finish(self, cn):
        pass  # the connection closes without reading what is left of an answer; the server rolls back

    def listed(self, schema, name, source):
        if schema.lower() in self.SYSTEM:
            return None
        db = str(source.get("database") or "")
        if db:
            return name if schema.lower() == db.lower() else None
        return schema + "." + name


class Postgres(SqlDriver):
    kinds, module, package, title, label, port = ("postgres",), "pg8000.dbapi", "pg8000", "pg8000", "PostgreSQL", 5432
    TYPES = {16: "Boolean", 20: "Int64", 21: "Int64", 23: "Int64", 700: "Double", 701: "Double", 1700: "Decimal", 1082: "Date",
             1114: "DateTime", 1184: "DateTime", 17: "Byte[]"}
    TABLES = "SELECT table_schema, table_name, table_type FROM information_schema.tables ORDER BY table_schema, table_name"
    READ_ONLY = "SET default_transaction_read_only = on"
    SYSTEM = re.compile(r"^(pg_|information_schema$|crdb_internal$|_timescaledb|timescaledb_)")

    def connect(self, source):
        mod = self.require()
        host, port = self.endpoint(source, self.port)
        mode = str(source.get("sslmode") or "prefer").lower()
        kw = {"user": str(source.get("user") or ""), "password": str(source.get("password") or ""), "host": host, "port": port,
              "database": source.get("database") or None, "timeout": 120, "application_name": "Dataspatium-brygga"}
        try:
            return mod.connect(ssl_context=tls_context(mode), **kw)
        except mod.InterfaceError as err:
            if mode != "prefer" or "SSL" not in str(err):
                raise
            return mod.connect(ssl_context=None, **kw)  # prefer: plain when the server refuses TLS

    def read_only(self, cn):
        # Outside a transaction, so that the next one (the read) starts read-only.
        cn.autocommit = True
        try:
            super().read_only(cn)
        finally:
            cn.autocommit = False

    def listed(self, schema, name, source):
        if self.SYSTEM.match(schema):
            return None
        return name if schema == "public" else schema + "." + name

    def select_all(self, cn, source, table, n):
        """PostGIS: geometry and geography columns come as WKT with their SRID (ST_AsEWKT), which the app draws on a map."""
        parts = self.split(table)
        schema, name = (parts[0], parts[1]) if len(parts) == 2 else ("public", parts[0])
        cur = cn.cursor()
        cur.execute("SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position", (schema, name))
        cols = cur.fetchall()
        cur.close()
        q = lambda c: '"' + str(c).replace('"', '""') + '"'  # noqa: E731
        spatial = [str(u) in ("geometry", "geography") for _c, u in cols]
        listing = ", ".join("ST_AsEWKT(%s) AS %s" % (q(c), q(c)) if s else q(c) for (c, _u), s in zip(cols, spatial)) if any(spatial) else "*"
        return "SELECT %s FROM %s LIMIT %d" % (listing, self.quote(table), n)


class Oracle(SqlDriver):
    kinds, module, package, title, label, port = ("oracle",), "oracledb", "oracledb", "python-oracledb", "Oracle", 1521
    TABLES = "SELECT NULL, table_name, 'TABLE' FROM user_tables UNION ALL SELECT NULL, view_name, 'VIEW' FROM user_views ORDER BY 2"
    READ_ONLY = "SET TRANSACTION READ ONLY"

    def load(self):
        mod = super().load()
        if mod is not None and getattr(mod, "defaults", None) is not None:
            mod.defaults.fetch_lobs = False  # CLOB as text and BLOB as bytes, not LOB objects
        return mod

    def connect(self, source):
        mod = self.require()
        host, port = self.endpoint(source, self.port)
        if not source.get("database"):
            raise ValueError("Ange tjänstnamnet (service name).")
        mode = str(source.get("tls") or "disabled").lower()
        if mode not in ("disabled", "verify_identity"):
            raise ValueError("Okänt läge för kryptering: %s" % mode)
        kw = {"user": str(source.get("user") or ""), "password": str(source.get("password") or ""), "host": host, "port": port,
              "service_name": str(source["database"]), "tcp_connect_timeout": 15}
        if mode == "verify_identity":
            kw["protocol"] = "tcps"
        return mod.connect(**kw)

    def coltype(self, d):
        code = str(getattr(d[1], "name", d[1]) or "").upper()
        if "NUMBER" in code:
            return "Int64" if len(d) > 5 and d[4] and d[5] == 0 else "Double"
        if "BINARY_FLOAT" in code or "BINARY_DOUBLE" in code:
            return "Double"
        if "DATE" in code or "TIMESTAMP" in code:
            return "DateTime"
        if "BOOLEAN" in code:
            return "Boolean"
        if "RAW" in code or "BLOB" in code:
            return "Byte[]"
        return "String"

    def select_all(self, cn, source, table, n):
        return "SELECT * FROM %s FETCH FIRST %d ROWS ONLY" % (self.quote(table), n)


DRIVERS = [MySql(), Postgres(), Oracle()]
DRIVER_OF = {k: d for d in DRIVERS for k in d.kinds}


def kinds():
    """The kinds of source this bridge can open now."""
    return ["sqlite"] + (["dsn", "odbc", "access", "excel"] if pyodbc else []) + [k for d in DRIVERS if d.load() is not None for k in d.kinds]


class Commands:
    """POST /commands from a program on this computer (the CLI tools/dataspatium.py, an MCP client), picked up by the app that has
    Styrning utifrån on (GET /commands/next), run there under the app's own rules (a writing command is approved by the person)
    and answered back (POST /commands/<id>/result). The app registers its commands first (POST /commands/catalog); without an app
    that polled within PAGE_TIMEOUT seconds a command is refused. POST /commands/<id>/cancel takes a queued command out of the queue
    and marks a running one cancelling, which the app sees in GET /commands/<id> and stops at its next check. Everything is behind
    the token, on 127.0.0.1 only."""

    MAX_QUEUE = 100
    MAX_WAIT = 60.0
    TTL = 300.0
    PAGE_TIMEOUT = 90.0

    def __init__(self):
        self.lock = threading.Condition()
        self.items = {}
        self.queue = []
        self.catalog = None
        self.seen = 0.0
        self.seq = 0

    def connected(self):
        return self.catalog is not None and time.time() - self.seen < self.PAGE_TIMEOUT

    def register(self, commands):
        with self.lock:
            self.catalog = [c for c in (commands or []) if isinstance(c, dict) and c.get("name")]
            self.seen = time.time()
            self.lock.notify_all()
        return {"registered": len(self.catalog)}

    def shown(self):
        with self.lock:
            self._expire()
            return {"connected": self.connected(), "commands": list(self.catalog or []), "queued": len(self.queue)}

    def submit(self, body):
        with self.lock:
            self._expire()
            if not self.connected():
                return 409, {"error": "Ingen app är ansluten: öppna Dataspatium, anslut bryggan och slå på Styrning utifrån under Hantera → Internetåtkomst"}
            if len(self.queue) >= self.MAX_QUEUE:
                return 429, {"error": "Kön är full"}
            name = str(body.get("name") or "").strip()
            if not name:
                return 400, {"error": "Ange name"}
            args = body.get("args")
            self.seq += 1
            cid = "c%d-%s" % (self.seq, secrets.token_hex(4))
            self.items[cid] = {"id": cid, "name": name, "args": args if isinstance(args, dict) else {}, "state": "queued", "at": time.time()}
            self.queue.append(cid)
            self.lock.notify_all()
            return 202, {"id": cid, "state": "queued"}

    def next(self, wait):
        """The next queued command for the app, or {} after `wait` seconds."""
        with self.lock:
            end = time.time() + wait
            while True:
                self.seen = time.time()
                self._expire()
                if self.queue:
                    cid = self.queue.pop(0)
                    it = self.items[cid]
                    it["state"] = "running"
                    it["started"] = time.time()
                    return {"id": cid, "name": it["name"], "args": it["args"]}
                left = end - time.time()
                if left <= 0:
                    return {}
                self.lock.wait(min(left, 5.0))

    def finish(self, cid, body):
        with self.lock:
            it = self.items.get(cid)
            if not it:
                return 404, {"error": "Okänt kommando " + cid}
            it.update({"state": "done", "cancelled": it["state"] == "cancelling", "ok": bool(body.get("ok")), "result": body.get("result"), "error": body.get("error"), "done_at": time.time()})
            self.seen = time.time()
            self.lock.notify_all()
            return 200, {"id": cid, "state": "done"}

    def status(self, cid, wait):
        """A command's state, waited for up to `wait` seconds when it is not done."""
        with self.lock:
            end = time.time() + wait
            while True:
                it = self.items.get(cid)
                if not it:
                    return 404, {"error": "Okänt kommando " + cid}
                if it["state"] in ("done", "cancelled", "cancelling") or time.time() >= end:
                    return 200, {k: it.get(k) for k in ("id", "name", "state", "ok", "result", "error", "cancelled")}
                self.lock.wait(min(end - time.time(), 5.0))

    def cancel(self, cid):
        """A queued command is cancelled at once; a running one is marked, and the app stops it at its next check."""
        with self.lock:
            it = self.items.get(cid)
            if not it:
                return 404, {"error": "Okänt kommando " + cid}
            if it["state"] == "queued":
                self.queue.remove(cid)
                it.update({"state": "cancelled", "cancelled": True, "ok": False, "error": "Avbrutet", "done_at": time.time()})
                self.lock.notify_all()
                return 200, {"id": cid, "state": "cancelled"}
            if it["state"] in ("running", "cancelling"):
                it["state"] = "cancelling"
                self.lock.notify_all()
                return 202, {"id": cid, "state": "cancelling"}
            return 409, {"error": "Kommandot är redan klart", "id": cid, "state": it["state"]}

    def _expire(self):
        now = time.time()
        for cid in list(self.items):
            it = self.items[cid]
            old = (it.get("done_at") and now - it["done_at"] > self.TTL) or (not it.get("done_at") and now - it["at"] > 2 * self.TTL)
            if old:
                self.items.pop(cid, None)
                if cid in self.queue:
                    self.queue.remove(cid)


class Bridge:
    def __init__(self, args):
        self.allow_write = args.allow_write
        self.max_rows = args.max_rows
        self.allow_hosts = sorted({h.strip().lower() for h in (getattr(args, "allow_host", None) or []) if h.strip()})
        self.max_fetch = max(1, int(getattr(args, "max_fetch_mb", 50) or 50)) * 1024 * 1024
        self.commands = Commands() if getattr(args, "allow_commands", False) else None
        self.log = []
        self.lock = threading.Lock()

    # ---- connections ----
    def connect(self, source, write=False):
        """(engine, connection): engine is "sqlite", "odbc" or the SqlDriver. Only a write that the bridge allows opens for writing."""
        kind = (source or {}).get("kind")
        driver = DRIVER_OF.get(kind)
        if driver:
            cn = driver.connect(source)
            if not write:
                driver.read_only(cn)
            return driver, cn
        if kind == "sqlite":
            path = source.get("path")
            if not path:
                raise ValueError("Ange sökvägen till SQLite-filen.")
            uri = "file:" + path.replace("\\", "/") + ("" if self.allow_write and write else "?mode=ro")
            cn = sqlite3.connect(uri, uri=True, timeout=10)
            return "sqlite", cn
        if not pyodbc:
            raise ValueError("Källtypen %s kräver pyodbc (pip install pyodbc)." % kind)
        if kind == "dsn":
            if not source.get("dsn"):
                raise ValueError("Ange DSN.")
            cs = "DSN=%s;" % odbc_value(source["dsn"])
            if source.get("user"):
                cs += "UID=%s;PWD=%s;" % (odbc_value(source["user"]), odbc_value(source.get("password", "")))
        elif kind == "odbc":
            cs = source.get("connectionString") or ""
            if not cs:
                raise ValueError("Ange anslutningssträngen.")
        elif kind == "access":
            if not source.get("path"):
                raise ValueError("Ange sökvägen till Access-filen.")
            cs = "Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=%s;" % odbc_value(source["path"])
            if source.get("password"):
                cs += "PWD=%s;" % odbc_value(source["password"])
        elif kind == "excel":
            if not source.get("path"):
                raise ValueError("Ange sökvägen till Excel-filen.")
            cs = "Driver={Microsoft Excel Driver (*.xls, *.xlsx, *.xlsm, *.xlsb)};DBQ=%s;ReadOnly=1;" % odbc_value(source["path"])
        else:
            raise ValueError("Okänd källtyp: %s" % kind)
        return "odbc", pyodbc.connect(cs, timeout=15)

    @staticmethod
    def close(engine, cn):
        """A read is rolled back (a write has been committed before); the connection is closed."""
        try:
            if isinstance(engine, SqlDriver):
                engine.finish(cn)
        finally:
            cn.close()

    @staticmethod
    def quote(kind, source, name):
        if isinstance(kind, SqlDriver):
            return kind.quote(name)
        if kind == "odbc" and (source or {}).get("kind") in ("access", "excel"):
            return "[" + str(name).replace("]", "]]") + "]"
        return '"' + str(name).replace('"', '""') + '"'

    # ---- endpoints ----
    def info(self):
        return {"name": "Dataspatium-databasbrygga", "version": VERSION, "platform": sys.platform, "allowWrite": self.allow_write, "kinds": kinds(), "maxRows": self.max_rows, "pyodbc": bool(pyodbc),
                "drivers": {k: d.describe() for d in DRIVERS for k in d.kinds}, "commands": bool(self.commands), "fetch": True, "allowHosts": self.allow_hosts}

    def fetch(self, request):
        """POST /fetch: the go-between. The log has the host and the path, never the query, headers or body."""
        try:
            result = relay(set(self.allow_hosts), self.max_fetch, request)
            status = result["status"]
        except RelayError as err:
            result, status = None, err.status
            self.note_fetch(request, status)
            return status, {"error": str(err)}
        self.note_fetch(request, status, result.pop("host"), result.pop("path"))
        return 200, result

    def note_fetch(self, request, status, host=None, path=None):
        if host is None:
            u = urllib.parse.urlsplit(str(request.get("url") or ""))
            host, path = (u.hostname or ""), u.path
        with self.lock:
            self.log.append({"at": datetime.datetime.now().isoformat(timespec="seconds"), "kind": "fetch", "host": host, "path": (path or "")[:120], "status": status})
            del self.log[:-200]

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
            if isinstance(kind, SqlDriver):
                return kind.tables(cn, source)
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
            self.close(kind, cn)

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
                if isinstance(kind, SqlDriver):
                    t = kind.coltype(d)
                elif kind == "sqlite":
                    decl = declared.get(name, "")
                    t = "Int64" if "INT" in decl else "Double" if any(k in decl for k in ("REAL", "FLOA", "DOUB", "NUM", "DEC")) else "Boolean" if "BOOL" in decl else "DateTime" if "TIME" in decl else "Date" if "DATE" in decl else "String"
                elif d[1] is not None:
                    t = {int: "Int64", float: "Double", bool: "Boolean", decimal.Decimal: "Decimal", datetime.datetime: "DateTime", datetime.date: "Date", bytes: "Byte[]", bytearray: "Byte[]"}.get(d[1], "String")
                cols.append({"name": name, "type": t, "nullable": d[6] if len(d) > 6 and d[6] is not None else True})
            cur.close()
            return cols
        finally:
            self.close(kind, cn)

    def read(self, kind, cn, sql, limit):
        cur = cn.cursor()
        cur.execute(sql)
        desc = list(cur.description or [])
        names = [d[0] for d in desc]
        rows = []
        samples = [None] * len(names)
        truncated = False
        for r in cur:
            if len(rows) >= limit:
                truncated = True
                break
            for i, v in enumerate(r):
                if samples[i] is None and v is not None:
                    samples[i] = v
            rows.append([convert(v) for v in r])
        # The type of the first value that is not null, before it is converted; a column without values takes the driver's.
        types = []
        for i, name in enumerate(names):
            t = type_name(samples[i]) if samples[i] is not None else (kind.coltype(desc[i]) if isinstance(kind, SqlDriver) else "String")
            types.append({"name": name, "type": t})
        return {"columns": types, "rows": rows, "truncated": truncated}

    def rows(self, source, table, limit):
        kind, cn = self.connect(source)
        try:
            # The bridge's own drivers ask for one row more than the limit, so that a large table is not read whole.
            sql = kind.select_all(cn, source, table, limit + 1) if isinstance(kind, SqlDriver) else "SELECT * FROM %s" % self.quote(kind, source, table)
            return self.read(kind, cn, sql, limit)
        finally:
            self.close(kind, cn)

    def query(self, source, sql, limit, approved):
        write = not read_only(sql)
        if write and not self.allow_write:
            return 403, {"error": "Bryggan är skrivskyddad; starta med --allow-write för att tillåta ändringar"}
        if write and not approved:
            return 428, {"error": "Skrivning kräver användarens godkännande (approved: true)", "sql": sql}
        kind, cn = self.connect(source, write)
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
            self.close(kind, cn)
        with self.lock:
            # The kind and the start of the statement; never the source's address, user or password.
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

        def wait_of(self, query):
            try:
                return max(0.0, min(float(urllib.parse.parse_qs(query).get("wait", ["0"])[0] or 0), Commands.MAX_WAIT))
            except ValueError:
                return 0.0

        def commands_allowed(self):
            if bridge.commands:
                return True
            self.send_json(403, {"error": "Bryggan startades utan --allow-commands"})
            return False

        def do_GET(self):
            if not self.guard():
                return
            path, _, query = self.path.partition("?")
            try:
                if path == "/commands/catalog":
                    if self.commands_allowed():
                        self.send_json(200, bridge.commands.shown())
                elif path == "/commands/next":
                    if self.commands_allowed():
                        self.send_json(200, bridge.commands.next(self.wait_of(query)))
                elif path.startswith("/commands/"):
                    if self.commands_allowed():
                        status, result = bridge.commands.status(path[len("/commands/"):], self.wait_of(query))
                        self.send_json(status, result)
                elif self.path == "/":
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
            b = {}
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
                elif self.path == "/fetch":
                    status, result = bridge.fetch(b)
                    self.send_json(status, result)
                elif self.path == "/commands":
                    if self.commands_allowed():
                        status, result = bridge.commands.submit(b)
                        self.send_json(status, result)
                elif self.path == "/commands/catalog":
                    if self.commands_allowed():
                        self.send_json(200, bridge.commands.register(b.get("commands")))
                elif self.path.startswith("/commands/") and self.path.endswith("/result"):
                    if self.commands_allowed():
                        status, result = bridge.commands.finish(self.path[len("/commands/"):-len("/result")], b)
                        self.send_json(status, result)
                elif self.path.startswith("/commands/") and self.path.endswith("/cancel"):
                    if self.commands_allowed():
                        status, result = bridge.commands.cancel(self.path[len("/commands/"):-len("/cancel")])
                        self.send_json(status, result)
                elif self.path == "/stop":
                    self.send_json(200, {"stopping": True})
                    threading.Thread(target=server_box[0].shutdown, daemon=True).start()
                else:
                    self.send_json(404, {"error": "Okänd sökväg " + self.path})
            except Exception as err:  # noqa: BLE001 - reported to the app, without the source's password
                self.send_json(500, {"error": scrub(err, b.get("source") if isinstance(b, dict) else None)})

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
    if bridge.allow_hosts:
        print("Hämtar via bryggan från: " + ", ".join(bridge.allow_hosts))
    if bridge.commands:
        print("Kommandon TILLÅTNA (--allow-commands): program på datorn kan köra appens kommandon när Styrning utifrån är på i appen.")
    if not pyodbc:
        print("pyodbc saknas: ODBC-källor kräver det (pip install pyodbc).")
    missing = [d for d in DRIVERS if d.load() is None]
    if missing:
        print("Drivrutiner som saknas: %s. Installera dem med: pip install %s" % (", ".join("%s (%s)" % (d.title, d.label) for d in missing), " ".join(d.package for d in missing)))
    sys.stdout.flush()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    print("Bryggan har stoppats.")


if __name__ == "__main__":
    main()
