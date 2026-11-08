#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
# tools/run-tests.sh: the Linux and macOS counterpart of run-tests.ps1. Runs a Dataspatium page headless in Chromium (or Chrome,
# Edge) and Firefox, from file:// or an http address, and prints the console lines `DATASPATIUM-LOG: ...` and the final
# `DATASPATIUM-TESTS: pass=N fail=M`. Exit code: 0 all passed, 1 failures, 2 timeout or browser missing.
#
#   tools/run-tests.sh
#   tools/run-tests.sh --url "tests/index.html?only=opencde" --browsers chromium --timeout 600
#   DATASPATIUM_CDE_URL=http://localhost:8000 DATASPATIUM_CDE_HELPER=http://127.0.0.1:8094 DATASPATIUM_CDE_CLIENT=dataspatium \
#     tools/run-tests.sh --url "http://localhost:8080/tests/index.html" --browsers chromium
#
# The DATASPATIUM_CDE_* variables become the query parameters of the live test against Kontroll (tests/opencde-live.test.js):
# URL -> cde, HELPER -> cdehelper, CLIENT -> cdeclient, USER -> cdeuser (the signed-in user's id, dm_manager by default), PROJECT -> cdeproject, GRAPH -> cdegraph, GRAPH_DB -> cdegraphdb,
# GRAPH_USER -> cdegraphuser, GRAPH_PASS -> cdegraphpass, ADMIN_HELPER -> cdeadminhelper, BCF -> cdebcf (2.1 runs the suite through BCF API 2.1),
# VAL_DOC -> cdevaldoc, VAL_VER -> cdevalver, VAL_NAME -> cdevalname (the card Validera modellen against a version the server has checked). The page must
# then be served over http.
# CHROME and FIREFOX name the browser binaries when they are not on PATH; DATASPATIUM_CHROME_FLAGS adds flags (root gets
# --no-sandbox by itself, as containers need).
set -u

URL="tests/index.html"
TIMEOUT=300
BROWSERS="chromium firefox"
WIDTH=1400
HEIGHT=1000
ALL_CONSOLE=0
usage() { sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'; }
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2;;
    --timeout) TIMEOUT="$2"; shift 2;;
    --browsers) BROWSERS="${2//,/ }"; shift 2;;
    --width) WIDTH="$2"; shift 2;;
    --height) HEIGHT="$2"; shift 2;;
    --all-console) ALL_CONSOLE=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# A relative page becomes a file:// address under the repository, keeping its query string and hash.
resolve_url() {
  local u="$1" hash="" query="" path
  case "$u" in *://*) echo "$u"; return;; esac
  case "$u" in *'#'*) hash="#${u#*#}"; u="${u%%#*}";; esac
  case "$u" in *'?'*) query="?${u#*\?}"; u="${u%%\?*}";; esac
  path="$(cd "$ROOT" && cd "$(dirname "$u")" && pwd)/$(basename "$u")"
  echo "file://$path$query$hash"
}

urlencode() {
  if command -v python3 > /dev/null 2>&1; then python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
  else printf '%s' "$1" | sed 's/:/%3A/g; s#/#%2F#g; s/?/%3F/g; s/&/%26/g; s/=/%3D/g; s/ /%20/g'; fi
}

# The live test's parameters from the environment, so that a CI job needs no URL building of its own.
cde_params() {
  local out="" name value
  for pair in URL:cde HELPER:cdehelper CLIENT:cdeclient USER:cdeuser PROJECT:cdeproject GRAPH:cdegraph GRAPH_DB:cdegraphdb GRAPH_USER:cdegraphuser GRAPH_PASS:cdegraphpass ADMIN_HELPER:cdeadminhelper BCF:cdebcf VAL_DOC:cdevaldoc VAL_VER:cdevalver VAL_NAME:cdevalname; do
    name="DATASPATIUM_CDE_${pair%%:*}"
    value="${!name:-}"
    [ -n "$value" ] && out="$out&${pair#*:}=$(urlencode "$value")"
  done
  echo "$out"
}

PAGE="$(resolve_url "$URL")"
EXTRA="$(cde_params)"
if [ -n "$EXTRA" ]; then
  case "$PAGE" in *'#'*) HASH="#${PAGE#*#}"; PAGE="${PAGE%%#*}";; *) HASH="";; esac
  case "$PAGE" in *'?'*) PAGE="$PAGE$EXTRA";; *) PAGE="$PAGE?${EXTRA#&}";; esac
  PAGE="$PAGE$HASH"
fi

WORK="${TMPDIR:-/tmp}/dm-tests-$(printf '%s' "$ROOT" | cksum | cut -d' ' -f1)"
mkdir -p "$WORK"
TOTAL_FAIL=0
TIMED_OUT=0
MISSING=0

find_browser() {
  for c in "$@"; do
    [ -z "$c" ] && continue
    if command -v "$c" > /dev/null 2>&1; then command -v "$c"; return 0; fi
    if [ -x "$c" ]; then echo "$c"; return 0; fi
  done
  return 1
}

# Waits for the summary line in the log files (after the browser's pid). Returns 0 when it is there, 1 at the timeout and 2 when
# the browser exited without writing it (a crash at start, such as a sandbox refusal, is then reported at once).
wait_for_summary() {
  local pid="$1" deadline=$(( $(date +%s) + TIMEOUT ))
  shift
  while [ "$(date +%s)" -lt "$deadline" ]; do
    sleep 0.7
    for f in "$@"; do
      if [ -f "$f" ] && grep -q 'DATASPATIUM-TESTS:' "$f"; then sleep 0.5; return 0; fi
    done
    if ! kill -0 "$pid" > /dev/null 2>&1; then
      sleep 0.5
      for f in "$@"; do [ -f "$f" ] && grep -q 'DATASPATIUM-TESTS:' "$f" && return 0; done
      return 2
    fi
  done
  return 1
}

# Prints the test lines of one browser from its console messages (one message per line on stdin).
report() {
  local browser="$1" finished="$2" fail=0 saw=0 line
  echo "===== $browser"
  while IFS= read -r line; do
    case "$line" in
      DATASPATIUM-LOG:*) echo "  ${line#DATASPATIUM-LOG: }";;
      DATASPATIUM-TESTS:*) saw=1; fail="$(printf '%s' "$line" | sed -n 's/.*fail=\([0-9]*\).*/\1/p')"; echo "  $line";;
      *) if [ "$ALL_CONSOLE" = 1 ] || printf '%s' "$line" | grep -q -E 'Uncaught|Error|error|failed|Failed'; then echo "  [console] $line"; fi;;
    esac
  done
  if [ "$finished" = 2 ]; then echo "  ERROR: the browser exited before the DATASPATIUM-TESTS summary (see $WORK)"; TIMED_OUT=1
  elif [ "$finished" != 0 ]; then echo "  TIMEOUT: no DATASPATIUM-TESTS summary within $TIMEOUT s"; TIMED_OUT=1
  elif [ "$saw" = 0 ]; then echo "  ERROR: the summary line was seen in the log but could not be parsed"; TIMED_OUT=1
  fi
  TOTAL_FAIL=$(( TOTAL_FAIL + ${fail:-0} ))
}

run_chromium() {
  local exe profile log pid finished flags
  exe="$(find_browser "${CHROME:-}" chromium chromium-browser google-chrome google-chrome-stable chrome microsoft-edge msedge \
        /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome /Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge)" \
    || { echo "===== chromium: browser not found (set CHROME)"; MISSING=1; return; }
  profile="$WORK/chromium"; log="$WORK/chromium.log"
  rm -rf "$profile" "$log"
  flags="--headless=new --disable-gpu --no-first-run --no-default-browser-check --window-size=$WIDTH,$HEIGHT --enable-logging=stderr --v=0 --user-data-dir=$profile ${DATASPATIUM_CHROME_FLAGS:-}"
  [ "$(id -u)" = 0 ] && flags="$flags --no-sandbox"
  # shellcheck disable=SC2086
  "$exe" $flags "$PAGE" > "$WORK/chromium.out" 2> "$log" &
  pid=$!
  wait_for_summary "$pid" "$log"; finished=$?
  kill "$pid" > /dev/null 2>&1; sleep 0.3; kill -9 "$pid" > /dev/null 2>&1
  # Chromium logs console messages as `INFO:CONSOLE:50] "text", source: ...` (older builds: `CONSOLE(50)]`). The report reads a
  # process substitution, not a pipeline: a pipeline would run it in a subshell and lose TIMED_OUT and TOTAL_FAIL.
  report "chromium ($exe)" "$finished" < <(sed -n -E 's/.*CONSOLE[:(][0-9]+\)?\] "(.*)", source: .*/\1/p' "$log")
}

run_firefox() {
  local exe profile log err pid finished
  exe="$(find_browser "${FIREFOX:-}" firefox firefox-esr /Applications/Firefox.app/Contents/MacOS/firefox)" \
    || { echo "===== firefox: browser not found (set FIREFOX)"; MISSING=1; return; }
  profile="$WORK/firefox"; log="$WORK/firefox.log"; err="$WORK/firefox.err"
  rm -rf "$profile" "$log" "$err"; mkdir -p "$profile"
  cat > "$profile/user.js" <<'PREFS'
user_pref("devtools.console.stdout.content", true);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("browser.aboutwelcome.enabled", false);
PREFS
  "$exe" --headless --no-remote --width "$WIDTH" --height "$HEIGHT" --profile "$profile" "$PAGE" > "$log" 2> "$err" &
  pid=$!
  wait_for_summary "$pid" "$log" "$err"; finished=$?
  kill "$pid" > /dev/null 2>&1; sleep 0.8; kill -9 "$pid" > /dev/null 2>&1
  # Firefox prints `console.log: "text"` (quoted) for strings.
  report "firefox ($exe)" "$finished" < <(cat "$log" "$err" 2> /dev/null | sed -n -E 's/^console\.(log|error|warn|info): "?(.*[^"])"?$/\2/p; /JavaScript error|Error:/p')
}

for b in $BROWSERS; do
  case "$b" in
    chromium|chrome|edge) run_chromium;;
    firefox) run_firefox;;
    *) echo "Unknown browser: $b";;
  esac
done

if [ "$MISSING" = 1 ] || [ "$TIMED_OUT" = 1 ]; then exit 2; fi
if [ "$TOTAL_FAIL" -gt 0 ]; then exit 1; fi
exit 0
