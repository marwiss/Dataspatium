#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Checks the bridge without a browser: this script plays the app.

First the bridge's own drivers (MySQL and MariaDB, PostgreSQL, Oracle) against fake drivers in this process: the source's form,
tables, columns and rows in the same answers as ODBC, read-only transactions, writes only with --allow-write and approval, TLS
modes, PostGIS geometry as WKT, and the password that reaches the driver but never the log or an error. No database is started.
Then it starts a bridge with --allow-commands, registers a small catalog as the app would, answers the commands it is handed,
and drives tools/dataspatium.py (list, run, cancel, plan and mcp) against it. Standard library only.

Usage:
    python tools/check_bridge.py            # the Python bridge (tools/db_bridge.py), with the drivers
    python tools/check_bridge.py ps         # the PowerShell bridge (tools/db-bridge.ps1), on Windows
    python tools/check_bridge.py drivers    # only the drivers
"""
import argparse
import datetime
import decimal
import importlib.util
import json
import os
import pathlib
import re
import ssl
import subprocess
import sys
import threading
import time
import types
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
PORT, TOKEN = 8771, "check-token"
BRIDGE = "http://127.0.0.1:%d" % PORT
KIND = sys.argv[1] if len(sys.argv) > 1 else "py"
SECRET = "pw-Hemlig-4711"


def call_at(base, method, path, body=None, timeout=40):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method, headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


class FakeServer:
    """One database as a fake driver sees it: tables with columns and rows, whether it offers TLS, and what was run."""

    def __init__(self, tls=True):
        self.tls = tls
        self.executed, self.connects, self.events = [], [], []
        utc1 = datetime.timezone(datetime.timedelta(hours=1))
        self.tables = [("public", "kommuner", "BASE TABLE"), ("public", "lan", "VIEW"), ("plan", "omraden", "BASE TABLE"), ("pg_catalog", "pg_class", "BASE TABLE"),
                       ("information_schema", "columns", "VIEW"), ("register", "kommuner", "BASE TABLE"), ("mysql", "user", "BASE TABLE"), ("sys", "x", "VIEW")]
        self.columns = [("kod", "text", 25), ("namn", "text", 25), ("folkmangd", "int8", 20), ("andel", "numeric", 1700), ("datum", "timestamptz", 1184), ("geom", "geometry", 99999)]
        self.rows = [("0180", "Stockholm", 984748, decimal.Decimal("0.094"), datetime.datetime(2024, 12, 31, 1, 0, tzinfo=utc1), "0101000020BE0B0000"),
                     ("1280", "Malmö", 362133, decimal.Decimal("0.035"), datetime.datetime(2024, 12, 31, 1, 0, tzinfo=utc1), "0101000020BE0B0001"),
                     ("2580", "Luleå", 79000, None, None, None)]


def fake_driver(server, name, error):
    """A module with the DB-API that tools/db_bridge.py uses from PyMySQL or pg8000.dbapi, against `server`."""
    mod = types.ModuleType(name)
    mod.__version__ = "0.0-fake"
    mod.Error = error
    mod.InterfaceError = type("InterfaceError", (error,), {})
    mod.cursors = types.SimpleNamespace(SSCursor=object)

    class Cursor:
        def __init__(self, cn):
            self.cn, self.description, self.result, self.rowcount = cn, None, [], -1

        def execute(self, sql, params=None):
            server.executed.append(sql)
            s = " ".join(sql.split())
            low = s.lower()
            self.description, self.result = None, []
            if low.startswith("set "):
                if "read only" in low or "read_only" in low:
                    self.cn.read_only = True
                return
            if low.startswith("show session status like 'ssl_cipher'"):
                self.result = [("Ssl_cipher", "TLS_AES_256_GCM_SHA384" if self.cn.tls else "")]
                return
            if "from information_schema.tables" in low:
                self.result = list(server.tables)
                return
            if "from information_schema.columns" in low:
                self.result = [(c, u) for c, u, _o in server.columns] if params == ("public", "kommuner") else []
                return
            if low.startswith("select") and "fail" in low:
                raise mod.Error("syntax error near fail for user u with password %s" % self.cn.password)
            if re.match(r"(update|delete|insert)\b", low):
                if self.cn.read_only:
                    raise mod.Error("cannot execute %s in a read-only transaction" % low.split()[0].upper())
                self.rowcount = len(server.rows)
                return
            m = re.match(r'select (.+?) from [`"]?([a-z_.`"]+?)[`"]?(?: where 1 = 0| limit (\d+))?$', low)
            if not m:
                raise mod.Error("unknown statement " + s)
            self.description = [(c, o, None, None, None, None, None) for c, _u, o in server.columns]
            if " where 1 = 0" in low:
                return
            n = int(m.group(3)) if m.group(3) else len(server.rows)
            ewkt = 'st_asewkt("geom")' in low
            self.result = [r[:5] + (("SRID=3006;POINT(%d 6580821)" % (674032 + i)) if ewkt and r[5] else r[5],) for i, r in enumerate(server.rows[:n])]

        def __iter__(self):
            return iter(self.result)

        def fetchall(self):
            return list(self.result)

        def fetchone(self):
            return self.result[0] if self.result else None

        def close(self):
            pass

    class Connection:
        def __init__(self, kw):
            self.kw, self.password, self.read_only, self.autocommit = kw, kw.get("password"), False, False
            ctx = kw.get("ssl", kw.get("ssl_context"))
            self.tls = bool(ctx) and server.tls

        def cursor(self):
            return Cursor(self)

        def commit(self):
            server.events.append("commit")

        def rollback(self):
            server.events.append("rollback")

        def close(self):
            server.events.append("close")

    def connect(**kw):
        server.connects.append(kw)
        if kw.get("host") == "fel.example":
            raise mod.InterfaceError("could not connect to fel.example as user %s with password %s" % (kw.get("user"), kw.get("password")))
        if kw.get("ssl_context") and not server.tls:
            raise mod.InterfaceError("Server refuses SSL")
        return Connection(kw)

    mod.connect = connect
    return mod


def check_drivers():
    """The bridge's own drivers against fake ones, in this process, through the bridge's HTTP handler."""
    spec = importlib.util.spec_from_file_location("db_bridge_under_check", str(ROOT / "tools/db_bridge.py"))
    bridge_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bridge_mod)
    error = type("Error", (Exception,), {})
    pg, my = FakeServer(tls=False), FakeServer(tls=False)
    bridge_mod.DRIVER_OF["postgres"].mod, bridge_mod.DRIVER_OF["postgres"].tried = fake_driver(pg, "pg8000.dbapi", error), True
    bridge_mod.DRIVER_OF["mysql"].mod, bridge_mod.DRIVER_OF["mysql"].tried = fake_driver(my, "pymysql", error), True
    bridge_mod.DRIVER_OF["oracle"].mod, bridge_mod.DRIVER_OF["oracle"].tried = None, True  # not installed
    args = argparse.Namespace(allow_write=False, max_rows=1000, allow_host=None, max_fetch_mb=50, allow_commands=False)
    bridge = bridge_mod.Bridge(args)
    box = [None]
    server = ThreadingHTTPServer(("127.0.0.1", 0), bridge_mod.make_handler(bridge, TOKEN, {"null"}, box))
    box[0] = server
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_address[1]
    call = lambda method, path, body=None: call_at(base, method, path, body)  # noqa: E731
    try:
        status, info = call("GET", "/")
        assert status == 200 and info["version"] == bridge_mod.VERSION, info
        assert {"mysql", "mariadb", "postgres"} <= set(info["kinds"]) and "oracle" not in info["kinds"], info["kinds"]
        assert info["drivers"]["postgres"] == {"name": "pg8000", "ok": True, "version": "0.0-fake", "via": "python", "package": "pg8000"}, info["drivers"]
        assert info["drivers"]["mariadb"]["name"] == "PyMySQL" and info["drivers"]["oracle"] == {"name": "python-oracledb", "ok": False, "version": "", "via": "python", "package": "oracledb"}, info["drivers"]
        # A driver that is not installed is named with the way to install it.
        status, out = call("POST", "/tables", {"source": {"kind": "oracle", "host": "db", "database": "ORCL", "user": "u", "password": SECRET}})
        assert status == 500 and "pip install oracledb" in out["error"] and SECRET not in out["error"], out

        # PostgreSQL: the source's form reaches the driver; sslmode prefer falls back when the server refuses TLS.
        source = {"kind": "postgres", "host": "db.example", "port": "6543", "database": "kommun", "user": "läsare", "password": SECRET, "sslmode": "prefer"}
        status, out = call("POST", "/tables", {"source": source})
        assert status == 200, out
        names = [t["name"] for t in out["tables"]]
        assert names == ["kommuner", "lan", "plan.omraden", "register.kommuner", "mysql.user", "sys.x"], names
        assert {"name": "lan", "type": "VIEW"} in out["tables"] and {"name": "kommuner", "type": "TABLE"} in out["tables"], out["tables"]
        first, second = pg.connects[0], pg.connects[1]
        assert isinstance(first["ssl_context"], ssl.SSLContext) and second["ssl_context"] is None, "prefer: TLS first, then plain"
        assert second["host"] == "db.example" and second["port"] == 6543 and second["database"] == "kommun" and second["user"] == "läsare" and second["password"] == SECRET
        assert "SET default_transaction_read_only = on" in pg.executed, "a read runs read-only"
        assert pg.events[-2:] == ["rollback", "close"], pg.events
        # require does not fall back.
        status, out = call("POST", "/tables", {"source": dict(source, sslmode="require")})
        assert status == 500 and "SSL" in out["error"], out
        # verify-full checks the certificate and the host name.
        pg.tls = True
        status, out = call("POST", "/columns", {"source": dict(source, sslmode="verify-full"), "table": "kommuner"})
        ctx = pg.connects[-1]["ssl_context"]
        assert status == 200 and ctx.check_hostname and ctx.verify_mode == ssl.CERT_REQUIRED, (status, out)
        assert [c["name"] + ":" + c["type"] for c in out["columns"]] == ["kod:String", "namn:String", "folkmangd:Int64", "andel:Decimal", "datum:DateTime", "geom:String"], out
        assert pg.executed[-1] == 'SELECT * FROM "kommuner" WHERE 1 = 0', pg.executed[-1]
        # Rows: one more than the limit is asked for, PostGIS geometry comes as WKT, times in UTC, numbers as numbers.
        status, out = call("POST", "/rows", {"source": source, "table": "kommuner", "limit": 2})
        assert status == 200 and out["truncated"] is True and len(out["rows"]) == 2, out
        assert pg.executed[-1] == 'SELECT "kod", "namn", "folkmangd", "andel", "datum", ST_AsEWKT("geom") AS "geom" FROM "kommuner" LIMIT 3', pg.executed[-1]
        assert out["rows"][0] == ["0180", "Stockholm", 984748, 0.094, "2024-12-31T00:00:00", "SRID=3006;POINT(674032 6580821)"], out["rows"][0]
        assert [c["type"] for c in out["columns"]] == ["String", "String", "Int64", "Decimal", "DateTime", "String"], out["columns"]
        status, out = call("POST", "/rows", {"source": source, "table": "plan.omraden", "limit": 5})
        assert pg.executed[-1] == 'SELECT * FROM "plan"."omraden" LIMIT 6', pg.executed[-1]
        # Own SQL: read-only, and the same answer as ODBC.
        status, out = call("POST", "/query", {"source": source, "sql": "SELECT * FROM kommuner", "limit": 10})
        assert status == 200 and len(out["rows"]) == 3 and out["truncated"] is False and out["columns"][0] == {"name": "kod", "type": "String"}, out
        assert out["columns"][3]["type"] == "Decimal" and out["rows"][2][3] is None, out
        # Writes: refused while read-only, also when hidden behind SELECT or WITH; then approved one by one.
        for sql in ("UPDATE kommuner SET namn = 'x'", "WITH d AS (DELETE FROM kommuner RETURNING *) SELECT * FROM d", "SELECT * INTO kopia FROM kommuner", "SELECT * FROM kommuner FOR UPDATE"):
            status, out = call("POST", "/query", {"source": source, "sql": sql, "approved": True})
            assert status == 403, (sql, status, out)
        status, out = call("POST", "/query", {"source": source, "sql": "SELECT 'update' AS ord, \"delete\" FROM kommuner"})
        assert status != 403, ("quoted words are no write", status, out)
        bridge.allow_write = True
        status, out = call("POST", "/query", {"source": source, "sql": "UPDATE kommuner SET namn = 'x'"})
        assert status == 428, (status, out)
        before = len(pg.executed)
        status, out = call("POST", "/query", {"source": source, "sql": "UPDATE kommuner SET namn = 'x'", "approved": True})
        assert status == 200 and out == {"affected": 3}, (status, out)
        assert "SET default_transaction_read_only = on" not in pg.executed[before:] and "commit" in pg.events[-3:], (pg.executed[before:], pg.events[-3:])
        bridge.allow_write = False
        # The password: in the driver's hands only. An error that repeats it is answered without it, and the log never has it.
        status, out = call("POST", "/tables", {"source": dict(source, host="fel.example")})
        assert status == 500 and SECRET not in out["error"] and "***" in out["error"], out
        status, out = call("POST", "/query", {"source": source, "sql": "SELECT fail"})
        assert status == 500 and SECRET not in json.dumps(out) and "***" in out["error"], out
        status, out = call("GET", "/log")
        logged = json.dumps(out)
        assert SECRET not in logged and "db.example" not in logged and "läsare" not in logged and out["entries"], logged

        # MySQL and MariaDB: backticks, the schema chosen by the database, TLS modes (required checks the session).
        msrc = {"kind": "mariadb", "host": "127.0.0.1", "database": "register", "user": "u", "password": SECRET}
        status, out = call("POST", "/tables", {"source": msrc})
        assert status == 200 and [t["name"] for t in out["tables"]] == ["kommuner"], out
        kw = my.connects[-1]
        assert kw["port"] == 3306 and kw["charset"] == "utf8mb4" and kw["password"] == SECRET and kw["ssl"].verify_mode == ssl.CERT_NONE, kw
        assert "SET SESSION TRANSACTION READ ONLY" in my.executed and "rollback" not in my.events and my.events[-1] == "close", (my.executed, my.events)
        status, out = call("POST", "/tables", {"source": dict(msrc, database="", kind="mysql")})
        assert [t["name"] for t in out["tables"]] == ["public.kommuner", "public.lan", "plan.omraden", "pg_catalog.pg_class", "register.kommuner"], out
        status, out = call("POST", "/rows", {"source": msrc, "table": "kommuner", "limit": 100})
        assert status == 200 and my.executed[-1] == "SELECT * FROM `kommuner` LIMIT 101" and len(out["rows"]) == 3, (my.executed[-1], out)
        status, out = call("POST", "/rows", {"source": dict(msrc, database=""), "table": "register.kommuner", "limit": 1})
        assert my.executed[-1] == "SELECT * FROM `register`.`kommuner` LIMIT 2", my.executed[-1]
        status, out = call("POST", "/tables", {"source": dict(msrc, tls="required")})
        assert status == 500 and "krypterar inte" in out["error"] and my.events[-1] == "close", out
        my.tls = True
        status, out = call("POST", "/tables", {"source": dict(msrc, tls="verify_identity")})
        assert status == 200 and my.connects[-1]["ssl"].check_hostname, out
        status, out = call("POST", "/tables", {"source": dict(msrc, tls="disabled")})
        assert status == 200 and my.connects[-1]["ssl"] is None, out
        status, out = call("POST", "/tables", {"source": dict(msrc, tls="nej")})
        assert status == 500 and "kryptering" in out["error"], out
        status, out = call("POST", "/tables", {"source": dict(msrc, host="")})
        assert status == 500 and "host" in out["error"], out
        # The same quoting in ODBC strings: a password with ; stays one value.
        assert bridge_mod.odbc_value("a;b}c") == "{a;b}}c}" and bridge_mod.odbc_value("C:\\Mina data\\x.accdb") == "C:\\Mina data\\x.accdb"
        assert bridge_mod.scrub("Pwd={a;b}}c} failed", {"connectionString": "Driver={X};Pwd={a;b}}c};"}) == "Pwd=*** failed"
        print("check_bridge drivers: ok (%d statements against PostgreSQL, %d against MySQL)" % (len(pg.executed), len(my.executed)))
        return 0
    finally:
        server.shutdown()
        server.server_close()


def call(method, path, body=None, timeout=40):
    return call_at(BRIDGE, method, path, body, timeout)


def main():
    if KIND == "drivers":
        return check_drivers()
    if KIND == "py":
        check_drivers()
    env = dict(os.environ, DATASPATIUM_BRIDGE=BRIDGE, DATASPATIUM_TOKEN=TOKEN, PYTHONIOENCODING="utf-8")
    cmd = (["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "tools/db-bridge.ps1"), "-Port", str(PORT), "-Token", TOKEN, "-AllowCommands"] if KIND == "ps"
           else [sys.executable, "-I", str(ROOT / "tools/db_bridge.py"), "--port", str(PORT), "--token", TOKEN, "--allow-commands"])
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8")
    seen = []
    try:
        info = None
        for _ in range(150):
            try:
                _, info = call("GET", "/")
                break
            except Exception:  # noqa: BLE001 - not up yet
                time.sleep(0.2)
        assert info and info["commands"] is True, info
        # The started bridge describes a driver for each kind of the app's form, and an attempt that fails (no driver, or nothing
        # listening on the port) is answered without the password.
        assert {"mysql", "mariadb", "postgres"} <= set(info.get("drivers") or {}), info
        for kind in ("mysql", "postgres"):
            status, out = call("POST", "/tables", {"source": {"kind": kind, "host": "127.0.0.1", "port": 9, "user": "u", "password": SECRET}})
            assert status == 500 and out.get("error") and SECRET not in json.dumps(out), (kind, status, out)
        # Nobody is connected: a command is refused with the reason.
        status, out = call("POST", "/commands", {"name": "list_datasets", "args": {}})
        assert status == 409 and "Styrning" in out["error"], (status, out)
        # The app registers its commands and starts polling; this thread answers as the app would.
        catalog = [{"name": "list_datasets", "writes": False, "description": "The datasets.", "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}},
                   {"name": "run_plan", "writes": True, "description": "Runs a plan.", "parameters": {"type": "object", "properties": {"name": {"type": "string"}, "steps": {"type": "string"}}, "required": ["name", "steps"], "additionalProperties": False}}]
        status, out = call("POST", "/commands/catalog", {"commands": catalog})
        assert status == 200 and out["registered"] == 2, out
        # A queued command is cancelled at once and never reaches the app.
        status, out = call("POST", "/commands", {"name": "list_datasets", "args": {}})
        assert status == 202, (status, out)
        queued = out["id"]
        status, out = call("POST", "/commands/%s/cancel" % queued, {})
        assert status == 200 and out["state"] == "cancelled", (status, out)
        status, out = call("GET", "/commands/%s" % queued)
        assert out["state"] == "cancelled" and out["ok"] is False and out["cancelled"] is True, out

        def page():
            deadline = time.time() + 60
            while time.time() < deadline and len(seen) < 5:
                try:
                    _, nxt = call("GET", "/commands/next?wait=5")
                except Exception:  # noqa: BLE001 - the bridge is gone
                    break
                if nxt.get("id"):
                    seen.append(nxt)
                    if nxt["name"] == "run_plan" and (nxt.get("args") or {}).get("name") == "Långsam":
                        time.sleep(1.5)
                    result = {"ok": True, "result": {"datasets": [{"id": "d1", "name": "Befolkning"}]}} if nxt["name"] == "list_datasets" else {"ok": False, "error": "not approved"}
                    call("POST", "/commands/%s/result" % nxt["id"], result)
                else:
                    time.sleep(0.2)
        th = threading.Thread(target=page, daemon=True)
        th.start()
        # A running command is marked cancelling; the app's answer closes it, and the bridge remembers the cancel.
        status, out = call("POST", "/commands", {"name": "run_plan", "args": {"name": "Långsam", "steps": "[]"}})
        slow = out["id"]
        st = {}
        for _ in range(100):
            _, st = call("GET", "/commands/%s" % slow)
            if st["state"] == "running":
                break
            time.sleep(0.1)
        assert st["state"] == "running", st
        status, out = call("POST", "/commands/%s/cancel" % slow, {})
        assert status == 202 and out["state"] == "cancelling", (status, out)
        for _ in range(100):
            _, st = call("GET", "/commands/%s?wait=1" % slow)
            if st["state"] == "done":
                break
            time.sleep(0.1)
        assert st["state"] == "done" and st["cancelled"] is True, st
        status, out = call("POST", "/commands/%s/cancel" % slow, {})
        assert status == 409, (status, out)
        cli = [sys.executable, "-I", str(ROOT / "tools/dataspatium.py")]
        out = subprocess.run(cli + ["list"], capture_output=True, text=True, encoding="utf-8", env=env)
        assert out.returncode == 0 and '"connected": true' in out.stdout and "run_plan" in out.stdout, out.stdout + out.stderr
        out = subprocess.run(cli + ["run", "list_datasets"], capture_output=True, text=True, encoding="utf-8", env=env)
        assert out.returncode == 0 and "Befolkning" in out.stdout, out.stdout + out.stderr
        plan = ROOT / "check-plan.json"
        plan.write_text(json.dumps({"format": "dataspatium-flow/1", "name": "Check", "steps": [{"type": "command", "params": {"command": "list_datasets", "args": {}}}]}), encoding="utf-8")
        try:
            out = subprocess.run(cli + ["plan", str(plan)], capture_output=True, text=True, encoding="utf-8", env=env)
        finally:
            plan.unlink()
        assert out.returncode == 1 and "not approved" in out.stdout, out.stdout + out.stderr
        assert seen[-1]["name"] == "run_plan" and json.loads(seen[-1]["args"]["steps"])[0]["type"] == "command", seen[-1]
        # MCP over stdio: initialize, tools/list, tools/call, an unknown method.
        lines = [json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "check", "version": "0"}}}),
                 json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
                 json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}),
                 json.dumps({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "list_datasets", "arguments": {}}}),
                 json.dumps({"jsonrpc": "2.0", "id": 4, "method": "nope"})]
        out = subprocess.run(cli + ["mcp"], input="\n".join(lines) + "\n", capture_output=True, text=True, encoding="utf-8", env=env)
        answers = [json.loads(line) for line in out.stdout.splitlines() if line.strip()]
        assert [a["id"] for a in answers] == [1, 2, 3, 4], out.stdout + out.stderr
        assert answers[0]["result"]["protocolVersion"] == "2025-06-18"
        assert [tl["name"] for tl in answers[1]["result"]["tools"]] == ["list_datasets", "run_plan"] and "inputSchema" in answers[1]["result"]["tools"][0]
        assert answers[2]["result"]["isError"] is False and "Befolkning" in answers[2]["result"]["content"][0]["text"]
        assert answers[3]["error"]["code"] == -32601
        th.join(timeout=15)
        # The wrong token is refused.
        try:
            urllib.request.urlopen(urllib.request.Request(BRIDGE + "/commands/catalog", headers={"Authorization": "Bearer nej"}), timeout=5)
            raise AssertionError("no 401")
        except urllib.error.HTTPError as e:
            assert e.code == 401
        # The CLI cancels by id: what is done is refused with the bridge's reason.
        out = subprocess.run(cli + ["cancel", slow], capture_output=True, text=True, encoding="utf-8", env=env)
        assert out.returncode == 2 and "redan klart" in out.stderr, out.stdout + out.stderr
        print("check_bridge %s: ok (%d commands served)" % (KIND, len(seen)))
        return 0
    finally:
        try:
            call("POST", "/stop", {})
        except Exception:  # noqa: BLE001 - already gone
            pass
        proc.wait(timeout=10)


if __name__ == "__main__":
    sys.exit(main())
