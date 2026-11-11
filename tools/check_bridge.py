#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""Checks the bridge's command queue, the CLI and the MCP server without a browser: this script plays the app.

It starts a bridge with --allow-commands, registers a small catalog as the app would, answers the commands it is handed, and
drives tools/dataspatium.py (list, run, plan and mcp) against it. Standard library only.

Usage:
    python tools/check_bridge.py            # the Python bridge (tools/db_bridge.py)
    python tools/check_bridge.py ps         # the PowerShell bridge (tools/db-bridge.ps1), on Windows
"""
import json
import os
import pathlib
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
PORT, TOKEN = 8771, "check-token"
BRIDGE = "http://127.0.0.1:%d" % PORT
KIND = sys.argv[1] if len(sys.argv) > 1 else "py"


def call(method, path, body=None, timeout=40):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BRIDGE + path, data=data, method=method, headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main():
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
        # Nobody is connected: a command is refused with the reason.
        status, out = call("POST", "/commands", {"name": "list_datasets", "args": {}})
        assert status == 409 and "Styrning" in out["error"], (status, out)
        # The app registers its commands and starts polling; this thread answers as the app would.
        catalog = [{"name": "list_datasets", "writes": False, "description": "The datasets.", "parameters": {"type": "object", "properties": {}, "required": [], "additionalProperties": False}},
                   {"name": "run_plan", "writes": True, "description": "Runs a plan.", "parameters": {"type": "object", "properties": {"name": {"type": "string"}, "steps": {"type": "string"}}, "required": ["name", "steps"], "additionalProperties": False}}]
        status, out = call("POST", "/commands/catalog", {"commands": catalog})
        assert status == 200 and out["registered"] == 2, out

        def page():
            deadline = time.time() + 60
            while time.time() < deadline and len(seen) < 4:
                try:
                    _, nxt = call("GET", "/commands/next?wait=5")
                except Exception:  # noqa: BLE001 - the bridge is gone
                    break
                if nxt.get("id"):
                    seen.append(nxt)
                    result = {"ok": True, "result": {"datasets": [{"id": "d1", "name": "Befolkning"}]}} if nxt["name"] == "list_datasets" else {"ok": False, "error": "not approved"}
                    call("POST", "/commands/%s/result" % nxt["id"], result)
                else:
                    time.sleep(0.2)
        th = threading.Thread(target=page, daemon=True)
        th.start()
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
