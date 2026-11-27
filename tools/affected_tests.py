#!/usr/bin/env python3
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
"""List the test files a git range is likely to affect, and the configurations it needs.

A changed module under src/ affects every test file that reaches it from the modules the file requires: the edges are the
module names a file names (the define() lists, require(), and 'prefix/' + id for lazy modules such as the modes), and a test
that starts the app reaches the modes it names ('bearbeta') in one step. --depth limits the steps (the default reaches all).
A changed test file affects itself, a fixture the files that require it. A changed file that is not a module (an R or Python
helper, a preset, a document) affects the test files that name it and those that require a module that names it.

The platform, the boot loader, the harness and the page, the dictionaries, vendor/ and the asset generators affect the
whole suite. With --refine a change to the boot loader, tests/start.js or a dictionary that only adds scripts to the boot
lists, test files to the suite or entries to a dictionary counts as those: the new scripts, the new test files, or the code
that uses the changed keys (and the i18n tests).

The configurations beyond Edge and Firefox at 1400 x 1000: 768 x 1024 when ui/ (but not a dictionary), viz/ or CSS
changed, localhost when the loading (platform/, boot.js, sw-coi.js, vendor/ and its manifest, the network shim) changed,
and ?python=1 when python/, engines/python or data/python-bridge changed; the Python run needs only the test files that
use the real Pyodide.

Usage:
    python -I tools/affected_tests.py                      # origin/main...HEAD and uncommitted changes
    python -I tools/affected_tests.py main..HEAD --json
    python -I tools/affected_tests.py 4569c9ac --why       # one commit, with the reason for each file
    python -I tools/affected_tests.py --refine --depth 2   # list changes as their entries, at most two steps
    python -I tools/affected_tests.py --weights <run output>...   # write tests/weights.js from ?timings=1 runs
"""
import argparse
import fnmatch
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TESTS = ROOT / "tests"

# Changes that reach every test: the platform, the harness and the page, vendor/ and the tools that write embedded files.
WHOLE = ["src/platform/*", "src/ui/i18n/i18n.js", "vendor/*", "tests/harness.js", "tests/setup.js", "tests/index.html",
         "tools/wrap_assets.py", "tools/wrap_local.py", "tools/fetch_vendor.py", "tools/shared_glossary.py"]
# Whole-suite changes too, unless --refine and the diff only adds list entries (see refine()).
LISTS = ["src/boot.js", "tests/start.js", "src/ui/i18n/*.js"]
# Files the browser suite never loads; the asset manifest changes with the assets it lists, which count by themselves.
IGNORED = ["LICENSE*", ".git*", ".claude/*", "tools/*", "docs/images/*", "tests/perf.*", "tests/weights.js", "CITATION*",
           "presets/local-assets.js"]
UI = ["src/ui/*", "*.css", "src/viz/*", "index.html", "m/*"]
LOADING = ["src/platform/*", "src/boot.js", "sw-coi.js", "manifest.webmanifest", "index.html", "src/start.js", "m/*", "vendor/*",
           "tools/wrap_assets.py", "tools/wrap_local.py"]
PYTHON = ["python/*", "src/engines/python/*", "src/data/python-bridge.js", "tools/pyodide_catalog.py"]
# The tests that read every dictionary, run for any change to one.
I18N_TESTS = ["i18n.test.js", "i18n-start.test.js", "glossary.test.js"]
MODES = ["inhamta", "hantera", "soka", "bearbeta", "kontrollera", "analysera", "visualisera", "exportera", "dela"]
STRING = re.compile(r"""(['"`])([A-Za-z0-9_@][\w@.\-/]*)\1""")
PREFIX = re.compile(r"""(['"`])([a-z][\w\-/]*/)\1\s*\+""")
BARE_REQUIRE = re.compile(r"""require\(\s*['"]([\w\-]+)['"]""")
DEFINE = re.compile(r"""\.define\(\s*['"]([^'"]+)['"]""")
ENTRY = re.compile(r"""^\s*'([^']+)'\s*:""")
SCRIPT = re.compile(r"""^\s*'(src/[^']+\.js)',?\s*(//.*)?$""")
PY_TEST = re.compile(r"python=1|cachedRuntime\(")
LITERAL = re.compile(r"""(['"`])((?:\\.|(?!\1)[^\\\n])*)\1""")
TEMPLATE_HEAD = re.compile(r"`([^`$\n]*)\$\{")
# Files loaded by a name the code builds ('docs/help/' + lang + '.js'): the module that loads them.
ASSET_OWNERS = {"docs/": "ui/help", "r/": "engines/r", "python/": "data/python-bridge"}


def matches(path, patterns):
    return any(fnmatch.fnmatch(path, p) for p in patterns)


def ignored(path):
    """Never loaded by the suite: the tools, the planning, and the Markdown files at the root (docs/ is embedded in the help)."""
    return matches(path, IGNORED) or ("/" not in path and path.endswith(".md"))


def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ""


def suite_files(text=None):
    """The files tests/start.js loads, in order."""
    text = read(TESTS / "start.js") if text is None else text
    body = text.split("var files = [", 1)[1].split("];", 1)[0]
    return re.findall(r"'([^']+)'", body)


def scan():
    """Modules by name, the file of each, and the source files with their text (src/ and the support files of tests/)."""
    sources = {}
    for p in list((ROOT / "src").rglob("*.js")) + [p for p in TESTS.rglob("*.js") if not p.name.endswith(".test.js")]:
        sources[p.relative_to(ROOT).as_posix()] = read(p)
    module_file = {}
    for rel, text in sources.items():
        for name in DEFINE.findall(text):
            if not name.startswith("tests/tmp"):
                module_file.setdefault(name, rel)
    return module_file, sources


def names_in(text, known):
    """The modules a file names: any string that is a module name with a slash, a bare name in require(), and 'prefix/' + x."""
    out = {s for _, s in STRING.findall(text) if "/" in s and s in known}
    out |= {s for s in BARE_REQUIRE.findall(text) if s in known}
    for _, prefix in PREFIX.findall(text):
        out |= {m for m in known if m.startswith(prefix)}
    return out


class Graph:
    def __init__(self):
        self.module_file, self.sources = scan()
        known = set(self.module_file)
        self.file_modules = {}
        for name, rel in self.module_file.items():
            self.file_modules.setdefault(rel, set()).add(name)
        self.uses = {rel: names_in(text, known) for rel, text in self.sources.items()}
        self.files = suite_files()
        self.test_files = [f for f in self.files if f.endswith(".test.js")]
        self.test_text = {f: read(TESTS / f) for f in self.test_files}
        self.test_uses = {}
        for f, text in self.test_text.items():
            uses = names_in(text, known)
            if "app" in uses:
                strings = {s for _, s in STRING.findall(text)}
                uses |= {"ui/modes/" + m for m in MODES if m in strings and "ui/modes/" + m in known}
            self.test_uses[f] = uses
        # Every string in the code, and the head of each template string, with the files that hold it.
        self.literals = {}
        owners = [("src", rel, t) for rel, t in self.sources.items() if not rel.startswith("src/ui/i18n/")]
        owners += [("test", f, t) for f, t in self.test_text.items()]
        for owner, name, body in owners:
            for lit in {m.group(2) for m in LITERAL.finditer(body)} | set(TEMPLATE_HEAD.findall(body)):
                self.literals.setdefault(lit, set()).add((owner, name))
        self._dist = {}

    def distances(self, test_file):
        """Steps from the modules a test file requires (0) to every module it reaches."""
        if test_file not in self._dist:
            dist = {m: 0 for m in self.test_uses[test_file]}
            frontier = list(dist)
            while frontier:
                nxt = []
                for m in frontier:
                    for d in self.uses.get(self.module_file.get(m), ()):
                        if d not in dist:
                            dist[d] = dist[m] + 1
                            nxt.append(d)
                frontier = nxt
            self._dist[test_file] = dist
        return self._dist[test_file]

    def naming(self, exact=(), starts=None, ends=None):
        """The modules (the dictionaries left out) and the test files with a string that is one of `exact`, or starts or
        ends with the given text."""
        owners = set()
        for k in exact:
            owners |= self.literals.get(k, set())
        if starts or ends:
            for lit, who in self.literals.items():
                if (starts and lit.startswith(starts)) or (ends and lit.endswith(ends)):
                    owners |= who
        mods = set()
        for kind, name in owners:
            if kind == "src":
                mods |= self.file_modules.get(name, set())
        return mods, {name for kind, name in owners if kind == "test"}


def git(*args):
    return subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


class Change:
    """The paths a range changes (with the working tree unless committed only), and their old and new lines and texts."""

    def __init__(self, rng, worktree):
        if rng and ".." not in rng:
            rng = rng + "^.." + rng
        # The working tree counts only for a range that ends at HEAD.
        worktree = worktree and rng.split("..", 1)[1].lstrip(".") in ("", "HEAD")
        self.range, self.worktree = rng, worktree
        self.base = git("merge-base", *rng.split("...", 1)).strip() if "..." in rng else rng.split("..", 1)[0]
        self.head = None if worktree else rng.split("..", 1)[1].lstrip(".") or "HEAD"
        out = set(git("diff", "--name-only", self.base, *([self.head] if self.head else [])).split())
        if worktree:
            out |= set(git("ls-files", "--others", "--exclude-standard").split())
        self.paths = sorted(out)

    def lines(self, path):
        """The removed and added lines of one path."""
        diff = git("diff", "-U0", self.base, *([self.head] if self.head else []), "--", path)
        return [l for l in diff.splitlines() if l[:1] in "+-" and not l.startswith(("+++", "---"))]

    def old(self, path):
        try:
            return git("show", f"{self.base}:{path}")
        except subprocess.CalledProcessError:
            return ""

    def new(self, path):
        return read(ROOT / path) if self.head is None else git("show", f"{self.head}:{path}")


def refine(graph, change, path):
    """For a list file: (modules touched, test files, nearby modules) when the diff only adds entries, else None (whole suite)."""
    lines = [l for l in change.lines(path) if l[1:].strip() and not l[1:].strip().startswith("//")]
    if path == "tests/start.js":
        old_text, new_text = change.old(path), change.new(path)
        try:
            old, new = suite_files(old_text), suite_files(new_text)
        except IndexError:
            return None
        outside = lambda t: t.split("var files = [", 1)[0] + t.split("];", 1)[1]
        added = [f for f in new if f not in old]
        # The rest of the page unchanged, and the files both have in the same order: only the added files are new.
        if outside(old_text) != outside(new_text) or [f for f in new if f in old] != [f for f in old if f in new]:
            return None
        return set(), {f for f in added if f.endswith(".test.js")}, set()
    if path == "src/boot.js":
        if not all(l[0] == "+" and SCRIPT.match(l[1:]) for l in lines):
            return None
        mods = set()
        for l in lines:
            mods |= graph.file_modules.get(SCRIPT.match(l[1:]).group(1), set())
        return mods, set(), set()
    if path.startswith("src/ui/i18n/"):
        if not all(ENTRY.match(l[1:]) for l in lines):
            return None
        keys = {ENTRY.match(l[1:]).group(1) for l in lines}
        mods, tests = set(), set()
        for k in keys:
            m, t = graph.naming({k})
            mods |= m
            tests |= t
            if m or t:
                continue
            # A key built in code ('mode.' + id) is found by the prefix it is built from.
            parts = k.split(".")
            for n in range(len(parts) - 1, 0, -1):
                m, t = graph.naming({".".join(parts[:n]) + "."})
                if m or t:
                    mods |= m
                    tests |= t
                    break
        return set(), tests | set(I18N_TESTS), mods
    return None


def select(graph, change, refined=False, depth=None):
    """{files, whole, reasons, configs, unmapped} for a Change."""
    changed = change.paths
    reasons, touched, near = {}, {}, {}
    whole, unmapped = [], []
    for p in changed:
        if matches(p, WHOLE):
            whole.append(p)
            continue
        if ignored(p) or (not (ROOT / p).exists() and not p.startswith(("src/", "tests/"))):
            continue
        if matches(p, LISTS):
            got = refine(graph, change, p) if refined else None
            if got is None:
                whole.append(p)
                continue
            mods, tests, nearby = got
            for m in mods:
                touched.setdefault(m, p)
            for m in nearby:
                near.setdefault(m, p)
            for f in tests:
                reasons.setdefault(f, p)
            continue
        if p.startswith("tests/") and p.endswith(".test.js"):
            name = p[len("tests/"):]
            (reasons.setdefault(name, p) if name in graph.test_files else unmapped.append(p))
            continue
        mods = graph.file_modules.get(p)
        if mods:
            for m in mods:
                touched.setdefault(m, p)
            continue
        # Not a module: the files that name it (a wrapper by its original's name), a preset also by its folder
        # (presets/api/), and the module that loads files whose names the code builds.
        bare = p[:-3] if p.endswith(".js") and (ROOT / p[:-3]).exists() else p
        base = bare.rsplit("/", 1)[-1]
        folder = bare.rsplit("/", 1)[0] + "/" if bare.startswith("presets/") and bare.count("/") > 1 else None
        named = "." in base and len(base) > 6
        mods, tests = graph.naming({bare} | ({base} if named else set()), folder, "/" + base if named else None)
        mods |= {m for prefix, m in ASSET_OWNERS.items() if bare.startswith(prefix)}
        for m in mods:
            near.setdefault(m, p)
        for f in tests:
            reasons.setdefault(f, p)
        if not mods and not tests:
            unmapped.append(p)
    for f in graph.test_files:
        if f in reasons:
            continue
        dist = graph.distances(f)
        hit = next((m for m in touched if m in dist and (depth is None or dist[m] <= depth)), None)
        hit = hit or next((m for m in near if dist.get(m, 99) == 0), None)
        if hit:
            src = touched.get(hit) or near.get(hit)
            reasons[f] = src + (f" ({hit}, {dist[hit]} steps)" if graph.module_file.get(hit) != src or dist[hit] else "")
    files = graph.test_files if whole else [f for f in graph.test_files if f in reasons]
    configs = {
        "768": sorted(p for p in changed if matches(p, UI) and not p.startswith("src/ui/i18n/")),
        "localhost": sorted(p for p in changed if matches(p, LOADING)),
        "python": sorted(p for p in changed if matches(p, PYTHON)),
    }
    return {"files": files, "whole": whole, "reasons": reasons, "configs": configs, "unmapped": unmapped,
            "python_files": [f for f in files if PY_TEST.search(graph.test_text[f])]}


def page(files, total, extra=""):
    query = "" if len(files) == total else "files=" + ",".join(f[:-len(".test.js")] for f in files)
    query = "&".join(q for q in (query, extra) if q)
    return "tests/index.html" + ("?" + query if query else "")


def report(result, graph, why):
    files, total = result["files"], len(graph.test_files)
    if not files and not any(result["configs"].values()):
        print("No test file is affected.")
        return
    print(("Whole suite, because of " + ", ".join(result["whole"][:5])) if result["whole"]
          else f"{len(files)} of {total} test files" + (": " + ", ".join(files) if len(files) <= 30 else " (--why lists them)"))
    if why and not result["whole"]:
        for f in files:
            print(f"  {f} <- {result['reasons'][f]}")
    if result["unmapped"]:
        print("Not mapped (check by hand or run the whole suite): " + ", ".join(result["unmapped"]))
    print("Configurations:")
    print("  1400x1000 Edge and Firefox")
    for key, label in (("768", "768x1024 Edge and Firefox"), ("localhost", "Edge from localhost"), ("python", "Edge with ?python=1")):
        hit = result["configs"][key]
        print(f"  {label}: " + (("yes, " + ", ".join(hit[:4]) + (" ..." if len(hit) > 4 else "")) if hit else "no"))
    run = "powershell -File tools/run-tests.ps1 -Lock -Jobs 2 -TimeoutSec 1800"
    # One browser over http: two at once against python's server lost a script at start.
    one = "powershell -File tools/run-tests.ps1 -Lock -Browsers edge -TimeoutSec 1800"
    print("Run:")
    if files:
        print(f'  {run} -Url "{page(files, total)}"')
        if result["configs"]["768"]:
            print(f'  {run} -Url "{page(files, total)}" -Width 768 -Height 1024')
    if result["configs"]["localhost"]:
        print(f'  python -m http.server 8137 --bind 127.0.0.1, then {one} -Url "http://127.0.0.1:8137/{page(files, total)}"')
    if result["configs"]["python"]:
        py = result["python_files"] or [f for f in graph.test_files if PY_TEST.search(graph.test_text[f])]
        print(f'  {one} -Url "{page(py, total, "python=1")}"')


def write_weights(outputs):
    """tests/weights.js from the DATASPATIUM-TIME lines of Edge (or Chromium) in run outputs; several runs are averaged."""
    sums = {}
    for out in outputs:
        raw = pathlib.Path(out).read_bytes()
        text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8-sig", "replace")
        browser = ""
        for line in text.splitlines():
            if line.startswith("====="):
                browser = line.split()[1] if len(line.split()) > 1 else ""
            m = re.search(r"DATASPATIUM-TIME: (\S+) (\d+) (\d+)", line)
            if m and browser in ("edge", "chromium"):
                sums.setdefault(m.group(1), []).append(int(m.group(2)) / 1000)
    if not sums:
        sys.exit("no DATASPATIUM-TIME lines from Edge or Chromium: run with -Timings (tools/run-tests.ps1) or ?timings=1")
    weights = {f: round(sum(v) / len(v), 1) for f, v in sums.items()}
    order = [f for f in suite_files() if f in weights] + sorted(f for f in weights if f not in suite_files())
    body = ",\n".join(f"    '{f}': {weights[f]}" for f in order)
    (TESTS / "weights.js").write_text(
        "// @ts-check\n// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0\n"
        "/**\n * Seconds per test file in Edge at 1400 x 1000, for splitting the suite into parts of about the same time (?shard=,\n"
        " * tests/harness.js). Written by `python -I tools/affected_tests.py --weights <output>` from runs with ?timings=1; a file\n"
        " * that is missing counts as one second.\n */\n"
        "(function () {\n  'use strict';\n  globalThis.Dataspatium.define('tests/weights', [], () => ({\n"
        + body + ",\n  }));\n})();\n", encoding="utf-8", newline="\n")
    print(f"tests/weights.js: {len(weights)} files, {round(sum(weights.values()))} s")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("range", nargs="?", default="origin/main...HEAD", help="git range, or one commit (default origin/main...HEAD)")
    ap.add_argument("--committed", action="store_true", help="leave out uncommitted and untracked changes")
    ap.add_argument("--refine", action="store_true", help="boot lists, the suite list and dictionaries by their added entries")
    ap.add_argument("--depth", type=int, help="at most this many steps from a test's own modules to a changed one")
    ap.add_argument("--json", action="store_true", help="the result as JSON")
    ap.add_argument("--why", action="store_true", help="the changed file behind each test file")
    ap.add_argument("--weights", nargs="+", metavar="OUTPUT", help="write tests/weights.js from these run outputs and stop")
    args = ap.parse_args()
    if args.weights:
        write_weights(args.weights)
        return
    graph = Graph()
    try:
        change = Change(args.range, not args.committed)
    except subprocess.CalledProcessError as err:
        sys.exit("git: " + (err.stderr or "").strip())
    result = select(graph, change, args.refine, args.depth)
    result["changed"] = change.paths
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(f"{len(change.paths)} changed files in {args.range}" + (" and the working tree" if change.worktree else ""))
        report(result, graph, args.why)


if __name__ == "__main__":
    main()
