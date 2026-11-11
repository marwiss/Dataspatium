#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Dataspatium from the command line, and as an MCP server, through the database bridge.

The app runs in the browser and cannot listen, so a program on the computer reaches it through the bridge
(tools/db_bridge.py or tools/db-bridge.ps1, started with --allow-commands / -AllowCommands): the program queues a command,
the app picks it up when Styrning utifrån is on (Hantera -> Internetåtkomst), runs it under its own rules (a command that
changes something is approved by the person in the app) and answers back. The commands are the app's own (data/commands):
`list` prints them with their JSON Schemas.

Usage:
    python tools/dataspatium.py list
    python tools/dataspatium.py run <command> [--args '{"dataset": "Befolkning"}'] [--timeout 300]
    python tools/dataspatium.py plan <flow.json> [--name "Månadsrapport"]
    python tools/dataspatium.py mcp

The bridge's address and token come from --bridge and --token, else from DATASPATIUM_BRIDGE and DATASPATIUM_TOKEN
(the bridge prints both when it starts). Answers are JSON on stdout; the exit code is 1 when a command fails.
`mcp` speaks the Model Context Protocol over stdio (newline-delimited JSON-RPC), so that an AI tool on the computer
sees the app's commands as its tools. Standard library only.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

VERSION = "1.0.0"
MCP_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")


class BridgeError(Exception):
    pass


class Client:
    """The bridge as a program sees it: submit a command and wait for the app's answer."""

    def __init__(self, bridge, token, timeout=300.0):
        self.bridge = bridge.rstrip("/")
        self.token = token
        self.timeout = timeout

    def call(self, method, path, body=None, timeout=70):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(self.bridge + path, data=data, method=method)
        req.add_header("Authorization", "Bearer " + self.token)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return json.loads(res.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as err:
            try:
                detail = json.loads(err.read().decode("utf-8")).get("error") or ""
            except Exception:  # noqa: BLE001 - the status is enough then
                detail = ""
            raise BridgeError("%s %s: %s" % (err.code, err.reason, detail or path)) from None
        except urllib.error.URLError as err:
            raise BridgeError("Bryggan svarar inte på %s (%s). Starta tools/db_bridge.py med --allow-commands." % (self.bridge, err.reason)) from None

    def catalog(self):
        return self.call("GET", "/commands/catalog")

    def run(self, name, args, timeout=None):
        """Queues the command and waits for the answer: {ok, result, error}."""
        started = self.call("POST", "/commands", {"name": name, "args": args or {}})
        cid = started["id"]
        end = time.time() + (timeout or self.timeout)
        while True:
            left = end - time.time()
            if left <= 0:
                return {"ok": False, "error": "Inget svar inom %d s; kommandot kan vänta på ett godkännande i appen" % (timeout or self.timeout)}
            status = self.call("GET", "/commands/%s?wait=%d" % (cid, max(1, min(30, int(left)))))
            if status.get("state") == "done":
                return {"ok": bool(status.get("ok")), "result": status.get("result"), "error": status.get("error")}
            time.sleep(0.2)


def flow_steps(path):
    """The steps of a flow file (dataspatium-flow/1) or of a bare list of steps."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and isinstance(data.get("steps"), list):
        return data.get("name") or "", data["steps"]
    if isinstance(data, list):
        return "", data
    raise SystemExit("The file holds neither a flow nor a list of steps: " + path)


# ---------------------------------------------------------------------------- MCP over stdio
class Mcp:
    """A Model Context Protocol server: the app's commands as tools, every call relayed through the bridge."""

    def __init__(self, client):
        self.client = client

    def tools(self):
        cat = self.client.catalog()
        out = []
        for c in cat.get("commands") or []:
            schema = c.get("parameters") or {"type": "object", "properties": {}}
            desc = str(c.get("description") or "")
            if c.get("writes"):
                desc += " Changes the app: the person approves it in the app before it runs."
            out.append({"name": c["name"], "description": desc, "inputSchema": schema})
        if not cat.get("connected"):
            sys.stderr.write("dataspatium mcp: no app is connected to the bridge yet\n")
        return out

    def handle(self, msg):
        method = msg.get("method")
        mid = msg.get("id")
        params = msg.get("params") or {}
        if method == "initialize":
            wanted = str(params.get("protocolVersion") or "")
            version = wanted if wanted in MCP_VERSIONS else MCP_VERSIONS[-1]
            return {"jsonrpc": "2.0", "id": mid, "result": {"protocolVersion": version, "capabilities": {"tools": {"listChanged": False}}, "serverInfo": {"name": "dataspatium", "version": VERSION},
                                                            "instructions": "The tools are the commands of the Dataspatium app open on this computer. Read with list_datasets, describe_dataset, read_rows and run_sql before changing anything; a tool that changes something runs only after the person approves it in the app."}}
        if method == "notifications/initialized" or (method or "").startswith("notifications/"):
            return None
        if method == "ping":
            return {"jsonrpc": "2.0", "id": mid, "result": {}}
        if method == "tools/list":
            try:
                return {"jsonrpc": "2.0", "id": mid, "result": {"tools": self.tools()}}
            except BridgeError as err:
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32000, "message": str(err)}}
        if method == "tools/call":
            name = str(params.get("name") or "")
            args = params.get("arguments") or {}
            try:
                out = self.client.run(name, args)
            except BridgeError as err:
                out = {"ok": False, "error": str(err)}
            text = json.dumps(out.get("result") if out.get("ok") else {"error": out.get("error")}, ensure_ascii=False)
            return {"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}], "isError": not out.get("ok")}}
        if mid is None:
            return None
        return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "Method not found: " + str(method)}}

    def serve(self, stdin=sys.stdin, stdout=sys.stdout):
        for line in stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except ValueError:
                stdout.write(json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
                stdout.flush()
                continue
            messages = msg if isinstance(msg, list) else [msg]
            for m in messages:
                answer = self.handle(m) if isinstance(m, dict) else None
                if answer is not None:
                    stdout.write(json.dumps(answer, ensure_ascii=False) + "\n")
                    stdout.flush()


# ---------------------------------------------------------------------------- the command line
def main(argv=None):
    p = argparse.ArgumentParser(description="Dataspatium through the database bridge: list, run, plan or serve MCP")
    p.add_argument("--bridge", default=os.environ.get("DATASPATIUM_BRIDGE", "http://127.0.0.1:8765"))
    p.add_argument("--token", default=os.environ.get("DATASPATIUM_TOKEN", ""))
    p.add_argument("--timeout", type=float, default=300.0, help="seconds to wait for the app's answer")
    sub = p.add_subparsers(dest="what", required=True)
    sub.add_parser("list", help="the app's commands with their schemas")
    r = sub.add_parser("run", help="run one command")
    r.add_argument("command")
    r.add_argument("--args", default="{}", help="the arguments as a JSON object")
    pl = sub.add_parser("plan", help="run a flow file as a plan (the person approves it once in the app)")
    pl.add_argument("file")
    pl.add_argument("--name", default="")
    sub.add_parser("mcp", help="serve the commands as MCP tools over stdio")
    a = p.parse_args(argv)
    if not a.token:
        sys.exit("Give the bridge's token with --token or DATASPATIUM_TOKEN (the bridge prints it when it starts).")
    client = Client(a.bridge, a.token, a.timeout)
    try:
        if a.what == "list":
            print(json.dumps(client.catalog(), ensure_ascii=False, indent=2))
            return 0
        if a.what == "mcp":
            Mcp(client).serve()
            return 0
        if a.what == "run":
            try:
                args = json.loads(a.args)
            except ValueError:
                sys.exit("--args must be a JSON object")
            out = client.run(a.command, args)
        else:
            name, steps = flow_steps(a.file)
            out = client.run("run_plan", {"name": a.name or name or os.path.basename(a.file), "steps": json.dumps(steps, ensure_ascii=False)})
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0 if out.get("ok") else 1
    except BridgeError as err:
        sys.stderr.write(str(err) + "\n")
        return 2


if __name__ == "__main__":
    sys.exit(main())
