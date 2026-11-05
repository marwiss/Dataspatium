"""A stand-in for the user at the browser pages of a Kontroll server, for the live test of Dataspatium's OpenCDE source.

The live test tests/opencde-live.test.js asks this helper to do what a person would do in the popup: sign in and consent on the
authorization page, pick documents on the selection page, fill in the upload page. The helper answers with the address the
server redirected to, which the test hands to the family as the popup's result. It runs on 127.0.0.1 only, reads the test
user's password from the environment and never writes it anywhere. Needs Python 3 with httpx. See docs/utveckling.md.
"""
from __future__ import annotations

import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import httpx

BASE = os.environ.get("CDE_BASE", "http://127.0.0.1:8000").rstrip("/")
USER = os.environ.get("CDE_USER", "dm_manager")
PASSWORD = os.environ.get("CDE_PASSWORD", "")
PORT = int(os.environ.get("CDE_HELPER_PORT", "8092"))
FORM_TOKEN = re.compile(r'name="form_token" value="([^"]+)"')
SELECTED = re.compile(r'name="selected" value="([^"]+)"')


def form_token(html: str) -> str:
    m = FORM_TOKEN.search(html)
    if not m:
        raise RuntimeError("the page carries no form token")
    return m.group(1)


def location_of(response: httpx.Response) -> str:
    if response.status_code != 302:
        raise RuntimeError(f"expected a redirect, got {response.status_code}: {response.text[:200]}")
    return response.headers["location"]


def authorize(url: str, user: str) -> str:
    """Sign in and consent on the authorization page; the server redirects to the client's address with the code."""
    with httpx.Client(follow_redirects=False, timeout=30.0) as browser:
        page = browser.get(url)
        if page.status_code != 200:
            raise RuntimeError(f"authorization page answered {page.status_code}: {page.text[:300]}")
        response = browser.post(
            str(page.url),
            data={"form_token": form_token(page.text), "username": user, "password": PASSWORD, "decision": "allow"},
        )
        return location_of(response)


def signed_in_browser(user: str) -> httpx.Client:
    browser = httpx.Client(base_url=BASE, follow_redirects=False, timeout=30.0)
    page = browser.get("/signin")
    response = browser.post("/signin", data={"form_token": form_token(page.text), "username": user, "password": PASSWORD})
    if response.status_code != 302:
        browser.close()
        raise RuntimeError(f"browser sign-in failed: {response.status_code}")
    return browser


def select(url: str, user: str, ids: list[str], cancel: bool) -> dict:
    browser = signed_in_browser(user)
    try:
        page = browser.get(url)
        if page.status_code != 200:
            raise RuntimeError(f"selection page answered {page.status_code}: {page.text[:300]}")
        offered = SELECTED.findall(page.text)
        if cancel:
            data = {"form_token": form_token(page.text), "action": "cancel"}
        else:
            chosen = ids or offered
            data = {"form_token": form_token(page.text), "action": "select", "selected": chosen}
        return {"callback": location_of(browser.post(url, data=data)), "offered": offered}
    finally:
        browser.close()


def upload(url: str, user: str, project: str, title: str, version: str, cancel: bool) -> dict:
    browser = signed_in_browser(user)
    try:
        page = browser.get(url)
        if page.status_code != 200:
            raise RuntimeError(f"upload page answered {page.status_code}: {page.text[:300]}")
        if cancel:
            data = {"form_token": form_token(page.text), "action": "cancel"}
        else:
            data = {"form_token": form_token(page.text), "project_id": project, "action": "save", "title_0": title, "version_0": version}
        return {"callback": location_of(browser.post(url, data=data))}
    finally:
        browser.close()


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parts = urlsplit(self.path)
        q = {k: v[0] for k, v in parse_qs(parts.query).items()}
        user = q.get("user", USER)
        try:
            if parts.path == "/health":
                self._send(200, {"ok": True, "base": BASE, "user": USER})
            elif parts.path == "/quit":
                self._send(200, {"ok": True})
                import threading
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            elif parts.path == "/authorize":
                self._send(200, {"callback": authorize(q["url"], user)})
            elif parts.path == "/select":
                ids = [x for x in q.get("ids", "").split(",") if x]
                self._send(200, select(q["url"], user, ids, q.get("cancel") == "1"))
            elif parts.path == "/upload":
                self._send(200, upload(q["url"], user, q.get("project", ""), q.get("title", "Dokument"), q.get("version", "1"), q.get("cancel") == "1"))
            else:
                self._send(404, {"error": "unknown path"})
        except Exception as exc:  # noqa: BLE001
            self._send(200, {"error": str(exc)})

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write(("%s " % self.path.split("?")[0]) + (fmt % args) + "\n")


if __name__ == "__main__":
    if not PASSWORD:
        sys.exit("CDE_PASSWORD missing")
    print(f"helper on http://127.0.0.1:{PORT} for {BASE} as {USER}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
