#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
# tools/run-tests.sh: the Linux and macOS counterpart of run-tests.ps1. Runs a Dataspatium page headless in Chromium (or Chrome,
# Edge) and Firefox, from file:// or an http address, and prints the console lines `DATASPATIUM-LOG: ...` and the final
# `DATASPATIUM-TESTS: pass=N fail=M`. Exit code: 0 all passed, 1 failures, 2 timeout or browser missing.
#
#   tools/run-tests.sh
#   tools/run-tests.sh --url "tests/index.html?only=opencde" --browsers chromium --timeout 600
#   tools/run-tests.sh --shards 2 --jobs 4 --timeout 1800
#   DATASPATIUM_CDE_URL=http://localhost:8000 DATASPATIUM_CDE_HELPER=http://127.0.0.1:8094 DATASPATIUM_CDE_CLIENT=dataspatium \
#     tools/run-tests.sh --url "http://localhost:8080/tests/index.html" --browsers chromium
#
# --shards N splits the suite into N parts of about the same time per browser (?shard=i/N), --jobs K runs up to K browsers at
# once; with --jobs above 1 the files with a test marked serial run afterwards, one browser at a time (?serial=skip, then
# ?serial=only). Each browser has its own profile and logs under $TMPDIR/dm-tests-<code>/<run>, and the parts of one browser
# add up to one DATASPATIUM-TESTS line. --timings adds ?timings=1 (DATASPATIUM-TIME lines for tools/affected_tests.py --weights).
#
# The DATASPATIUM_CDE_* variables become the query parameters of the live test against Dataregium (tests/opencde-live.test.js):
# URL -> cde, HELPER -> cdehelper, CLIENT -> cdeclient, USER -> cdeuser (the signed-in user's id, dm_manager by default), PROJECT -> cdeproject, GRAPH -> cdegraph, GRAPH_DB -> cdegraphdb,
# GRAPH_USER -> cdegraphuser, GRAPH_PASS -> cdegraphpass, ADMIN_HELPER -> cdeadminhelper, BCF -> cdebcf (2.1 runs the suite through BCF API 2.1),
# VAL_DOC -> cdevaldoc, VAL_VER -> cdevalver, VAL_NAME -> cdevalname (the card Validera modellen against a version the server has checked). The page must
# then be served over http. The twin's proposals (VII) also need python=1 in --url, such as "http://localhost:8080/tests/index.html?python=1".
# CHROME and FIREFOX name the browser binaries when they are not on PATH; DATASPATIUM_CHROME_FLAGS adds flags (root gets
# --no-sandbox by itself, as containers need).
set -u

URL="tests/index.html"
TIMEOUT=300
BROWSERS="chromium firefox"
WIDTH=1400
HEIGHT=1000
SHARDS=1
JOBS=1
TIMINGS=0
ALL_CONSOLE=0
usage() { sed -n '3,24p' "$0" | sed 's/^# \{0,1\}//'; }
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL="$2"; shift 2;;
    --timeout) TIMEOUT="$2"; shift 2;;
    --browsers) BROWSERS="${2//,/ }"; shift 2;;
    --width) WIDTH="$2"; shift 2;;
    --height) HEIGHT="$2"; shift 2;;
    --shards) SHARDS="$2"; shift 2;;
    --jobs) JOBS="$2"; shift 2;;
    --timings) TIMINGS=1; shift;;
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

# Adds a query string (a=1&b=2) to an address, before its hash.
add_query() {
  local u="$1" extra="$2" hash=""
  [ -z "$extra" ] && { echo "$u"; return; }
  case "$u" in *'#'*) hash="#${u#*#}"; u="${u%%#*}";; esac
  case "$u" in *'?'*) echo "$u&$extra$hash";; *) echo "$u?$extra$hash";; esac
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
  echo "${out#&}"
}

PAGE="$(add_query "$(resolve_url "$URL")" "$(cde_params)")"

# One folder per copy of the repository, and in it one per run: runs at the same time never share a profile or a log.
BASE="${TMPDIR:-/tmp}/dm-tests-$(printf '%s' "$ROOT" | cksum | cut -d' ' -f1)"
WORK="$BASE/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$WORK"
find "$BASE" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*-[0-9]*-[0-9]*' -mtime +2 -exec rm -rf {} + 2> /dev/null
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
CHROMIUM_EXE="$(find_browser "${CHROME:-}" chromium chromium-browser google-chrome google-chrome-stable chrome microsoft-edge msedge \
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome /Applications/Microsoft\ Edge.app/Contents/MacOS/Microsoft\ Edge)"
FIREFOX_EXE="$(find_browser "${FIREFOX:-}" firefox firefox-esr /Applications/Firefox.app/Contents/MacOS/firefox)"

# The jobs: one per browser and part, and with --jobs above 1 one more per browser for the files that measure time.
J_BROWSER=(); J_NAME=(); J_LABEL=(); J_QUERY=(); J_SERIAL=(); J_PID=(); J_START=(); J_STATE=(); J_SECS=(); J_AGAIN=()
add_job() {
  J_BROWSER+=("$1"); J_NAME+=("$2"); J_LABEL+=("$3"); J_QUERY+=("$4"); J_SERIAL+=("$5")
  J_PID+=(0); J_START+=(0); J_STATE+=(pending); J_SECS+=(0); J_AGAIN+=(0)
}
SELECTED=""
for b in $BROWSERS; do
  case "$b" in
    chromium|chrome|edge) b=chromium; [ -z "$CHROMIUM_EXE" ] && { echo "===== chromium: browser not found (set CHROME)"; MISSING=1; continue; };;
    firefox) [ -z "$FIREFOX_EXE" ] && { echo "===== firefox: browser not found (set FIREFOX)"; MISSING=1; continue; };;
    *) echo "Unknown browser: $b"; continue;;
  esac
  SELECTED="$SELECTED $b"
  timings=""; [ "$TIMINGS" = 1 ] && timings="timings=1"
  for i in $(seq 1 "$SHARDS"); do
    q=""; name="$b"; label=""
    [ "$SHARDS" -gt 1 ] && { q="shard=$i/$SHARDS"; name="$b-$i-of-$SHARDS"; label="part $i/$SHARDS"; }
    [ "$JOBS" -gt 1 ] && q="${q:+$q&}serial=skip"
    [ -n "$timings" ] && q="${q:+$q&}$timings"
    add_job "$b" "$name" "$label" "$q" 0
  done
  [ "$JOBS" -gt 1 ] && add_job "$b" "$b-serial" "serial" "serial=only${timings:+&$timings}" 1
done

[ "${#J_NAME[@]}" = 0 ] && exit 2

logs_of() {
  local dir="$WORK/${J_NAME[$1]}"
  if [ "${J_BROWSER[$1]}" = chromium ]; then echo "$dir/chromium.log"; else echo "$dir/firefox.log $dir/firefox.err"; fi
}

start_job() {
  local i="$1" dir="$WORK/${J_NAME[$1]}" page flags
  page="$(add_query "$PAGE" "${J_QUERY[$i]}")"
  mkdir -p "$dir/profile"
  if [ "${J_BROWSER[$i]}" = chromium ]; then
    flags="--headless=new --disable-gpu --no-first-run --no-default-browser-check --window-size=$WIDTH,$HEIGHT --enable-logging=stderr --v=0 --user-data-dir=$dir/profile ${DATASPATIUM_CHROME_FLAGS:-}"
    [ "$(id -u)" = 0 ] && flags="$flags --no-sandbox"
    # shellcheck disable=SC2086
    "$CHROMIUM_EXE" $flags "$page" > "$dir/chromium.out" 2> "$dir/chromium.log" &
  else
    cat > "$dir/profile/user.js" <<'PREFS'
user_pref("devtools.console.stdout.content", true);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("browser.aboutwelcome.enabled", false);
PREFS
    "$FIREFOX_EXE" --headless --no-remote --width "$WIDTH" --height "$HEIGHT" --profile "$dir/profile" "$page" > "$dir/firefox.log" 2> "$dir/firefox.err" &
  fi
  J_PID[$i]=$!
  J_START[$i]=$(date +%s)
  J_STATE[$i]=running
}

stop_job() {
  local i="$1" pid="${J_PID[$1]}"
  kill "$pid" > /dev/null 2>&1; sleep 0.5; kill -9 "$pid" > /dev/null 2>&1
  # Child processes that outlive the browser's own carry its profile in their command line.
  command -v pkill > /dev/null 2>&1 && pkill -9 -f -- "$WORK/${J_NAME[$i]}/profile" > /dev/null 2>&1
  J_SECS[$i]=$(( $(date +%s) - J_START[$i] ))
}

# Checks a running job: done (the summary came), timeout, or exited (the browser ended without the summary, such as a sandbox
# refusal at start, reported at once).
poll_job() {
  local i="$1" f
  for f in $(logs_of "$i"); do
    if [ -f "$f" ] && grep -q 'DATASPATIUM-TESTS:' "$f"; then sleep 0.5; J_STATE[$i]=done; stop_job "$i"; return; fi
  done
  if ! kill -0 "${J_PID[$i]}" > /dev/null 2>&1; then
    sleep 0.5
    for f in $(logs_of "$i"); do [ -f "$f" ] && grep -q 'DATASPATIUM-TESTS:' "$f" && { J_STATE[$i]=done; stop_job "$i"; return; }; done
    J_STATE[$i]=exited; stop_job "$i"; return
  fi
  # A browser that has written nothing after three minutes never opened the page: it is started again, once.
  if [ "${J_AGAIN[$i]}" = 0 ] && [ $(( $(date +%s) - J_START[$i] )) -gt 180 ] && ! cat $(logs_of "$i") 2> /dev/null | grep -q 'DATASPATIUM-'; then
    stop_job "$i"; rm -rf "$WORK/${J_NAME[$i]}"; J_AGAIN[$i]=1; start_job "$i"; return
  fi
  if [ $(( $(date +%s) - J_START[$i] )) -gt "$TIMEOUT" ]; then J_STATE[$i]=timeout; stop_job "$i"; fi
}

# Runs the jobs whose serial flag is $1 with at most $2 browsers at once.
run_phase() {
  local serial="$1" max="$2" i running
  while :; do
    running=0
    for i in "${!J_NAME[@]}"; do [ "${J_STATE[$i]}" = running ] && running=$(( running + 1 )); done
    for i in "${!J_NAME[@]}"; do
      [ "$running" -ge "$max" ] && break
      if [ "${J_SERIAL[$i]}" = "$serial" ] && [ "${J_STATE[$i]}" = pending ]; then start_job "$i"; running=$(( running + 1 )); fi
    done
    [ "$running" = 0 ] && return
    sleep 0.7
    for i in "${!J_NAME[@]}"; do [ "${J_STATE[$i]}" = running ] && poll_job "$i"; done
  done
}

# The console messages of a job, one per line.
messages() {
  local i="$1" dir="$WORK/${J_NAME[$1]}"
  if [ "${J_BROWSER[$i]}" = chromium ]; then
    # Chromium logs console messages as `INFO:CONSOLE:50] "text", source: ...` (older builds: `CONSOLE(50)]`).
    sed -n -E 's/.*CONSOLE[:(][0-9]+\)?\] "(.*)", source: .*/\1/p' "$dir/chromium.log" 2> /dev/null
  else
    # Firefox prints `console.log: "text"` (quoted) for strings.
    cat "$dir/firefox.log" "$dir/firefox.err" 2> /dev/null | sed -n -E 's/^console\.(log|error|warn|info): "?(.*[^"])"?$/\2/p; /JavaScript error|Error:/p'
  fi
}

# Prints the test lines of one browser's jobs, a line per part, and one DATASPATIUM-TESTS line for them all. The reads come from
# process substitution, not a pipeline: a pipeline would run them in a subshell and lose TIMED_OUT and TOTAL_FAIL.
report() {
  local b="$1" i line pass=0 fail=0 p f saw notes="" label exe
  exe="$CHROMIUM_EXE"; [ "$b" = firefox ] && exe="$FIREFOX_EXE"
  echo "===== $b ($exe)"
  for i in "${!J_NAME[@]}"; do
    [ "${J_BROWSER[$i]}" = "$b" ] || continue
    p=0; f=0; saw=0
    while IFS= read -r line; do
      case "$line" in
        DATASPATIUM-LOG:*) echo "  ${line#DATASPATIUM-LOG: }";;
        DATASPATIUM-TIME:*) echo "  $line";;
        DATASPATIUM-TESTS:*) saw=1; p="$(printf '%s' "$line" | sed -n 's/.*pass=\([0-9]*\).*/\1/p')"; f="$(printf '%s' "$line" | sed -n 's/.*fail=\([0-9]*\).*/\1/p')";;
        *) if [ "$ALL_CONSOLE" = 1 ] || printf '%s' "$line" | grep -q -E 'Uncaught|Error|error|failed|Failed'; then echo "  [console] $line"; fi;;
      esac
    done < <(messages "$i")
    label="${J_LABEL[$i]:+${J_LABEL[$i]}: }"
    case "${J_STATE[$i]}" in
      exited) notes="$notes  ERROR: ${label}the browser exited before the DATASPATIUM-TESTS summary (see $WORK/${J_NAME[$i]})"$'\n'; TIMED_OUT=1;;
      timeout) notes="$notes  TIMEOUT: ${label}no DATASPATIUM-TESTS summary within $TIMEOUT s"$'\n'; TIMED_OUT=1;;
      *) if [ "$saw" = 0 ]; then notes="$notes  ERROR: ${label}the summary line was seen in the log but could not be parsed"$'\n'; TIMED_OUT=1
         elif [ -n "${J_LABEL[$i]}" ]; then notes="$notes  ${label}pass=$p fail=$f in ${J_SECS[$i]} s"$'\n'; fi;;
    esac
    [ "${J_AGAIN[$i]}" = 1 ] && notes="$notes  NOTE: ${label}started again after three minutes without a line from the page"$'\n'
    pass=$(( pass + ${p:-0} )); fail=$(( fail + ${f:-0} ))
  done
  printf '%s' "$notes"
  echo "  DATASPATIUM-TESTS: pass=$pass fail=$fail"
  TOTAL_FAIL=$(( TOTAL_FAIL + fail ))
}

T0=$(date +%s)
run_phase 0 "$JOBS"
run_phase 1 1
for b in $SELECTED; do report "$b"; done
BROWSER_TIME=0
for i in "${!J_NAME[@]}"; do BROWSER_TIME=$(( BROWSER_TIME + J_SECS[i] )); done
echo "===== wall $(( $(date +%s) - T0 )) s, browser time $BROWSER_TIME s, ${#J_NAME[@]} browser(s), at most $JOBS at once; logs in $WORK"
for i in "${!J_NAME[@]}"; do rm -rf "$WORK/${J_NAME[$i]}/profile"; done

if [ "$MISSING" = 1 ] || [ "$TIMED_OUT" = 1 ]; then exit 2; fi
if [ "$TOTAL_FAIL" -gt 0 ]; then exit 1; fi
exit 0
