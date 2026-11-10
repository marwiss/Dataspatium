# Security

Security is the app's first requirement. Dataspatium holds your datasets, API keys and tokens in the browser and talks to
servers (open APIs, OpenCDE servers such as Dataregium) only when you ask it to. The policy is the same as Dataregium's, since
the two are developed as a pair and released with the same numbers; Dataregium's half is in [README](https://github.com/marwiss/Dataregium/blob/main/docs/en/README.md#personal-data)
of that repository. How to report a vulnerability is in [SECURITY.md](../../SECURITY.md).

## Threat model

**Assets**: your datasets (which may hold personal data), API keys and tokens for servers, the passphrase that protects
them, what you share with others (bundles, files sent to a server, published pages) and the integrity of the workspace.

**Actors**: you; other programs on the same computer; websites you visit in the same browser; the servers you fetch from
and send to; whoever receives a file you shared; whoever can read the network between you and a server.

**Trust boundaries**: the app runs in the browser's sandbox and reaches only what you drop on it or choose in a dialog.
Opened from a folder (file://) it shares its storage origin with other locally opened HTML files in Chromium, which is why
secrets are encrypted. Servers are foreign: everything they send is treated as data and escaped; everything the app sends
to them goes through your action and your consent per purpose. R, Python and web-ifc run in WebAssembly sandboxes in
workers with no access to the computer.

## Controls and the tests that prove them

Every control has an automated test in `tests/` or a pointer to the code that carries it.

| Control | Standard | Test |
|---|---|---|
| No network call without your action and your consent per purpose (api, url, github, components, basemaps, databases, neo4j, stun, opencde); a denied consent stops the call | OWASP ASVS 8.3 | `consent.test.js`: *a purpose is asked once, the answer is remembered when wanted, and a denial raises ConsentError* |
| Secrets (API keys, tokens) are never stored in clear text: only for the session, or encrypted with a passphrase (AES-GCM via WebCrypto), with lock and unlock | OWASP ASVS 2.10, 6.2 | `api.test.js`: *secrets in session, encrypted persistence, lock and unlock* |
| A recipe with a secret step is not replayed without you | Data minimisation | `refresh`: *a recipe with a secret step is refused before anything is fetched* |
| Components and R packages are fetched from pinned addresses after consent, verified against SHA-256 before use and cached in IndexedDB | OWASP ASVS 14.2 | `components`: *fetched once with consent, verified against SHA-256, served from the cache afterwards, and removable* |
| Third-party code is vendored at a pinned version with its licence and never edited by hand | OWASP ASVS 14.2 | `tools/fetch_vendor.py`, `THIRD_PARTY_LICENSES.md`, review |
| Everything that leaves the app is reviewed as a whole: identity numbers, e-mail and phone columns, running text, side tables, originals, picture positions, graph edges, comments and authors; keep, pseudonymise or remove in the copy; the dataset never changes | Data minimisation (GDPR art. 5) | `review`: *identity numbers, e-mail and phone columns are found; the shared copy is hashed or stripped while the dataset stays*, *running text in a document is found and masked*, *graph edges and node properties are scanned and masked*; `exif`: *strip leaves the picture and removes the text* |
| OAuth2 against OpenCDE: authorization code with PKCE S256, `state` and an exact redirect address; a wrong `state` and a denied consent are refused; tokens are refreshed and revoked | RFC 6749, 7636, 9700 | `opencde`: *sign in with a popup, refuse a wrong state, refresh an expiring token, sign out*; the live suite C2, C7–C9 |
| The callback from the sign-in window: through the opener or a BroadcastChannel with an acknowledgement; a closed window counts as an error only when the app is not isolated | — | `opencde VI`: *the popup flow hears the callback page through a BroadcastChannel and a storage event* |
| The request log masks headers (Authorization among them) and keeps bodies only on request, never for token calls | OWASP ASVS 7.1 | `cde-log`: *paths become APIs and operations, headers are masked, bodies only when asked and never for tokens* |
| Answers from a graph database carry no stored hashes: password, token, code and secret hashes are removed from nodes, relationships, tables and maps before anything is shown or saved, and Bolt sessions are always read sessions | Data minimisation | `ifc graph`: *stored hashes never reach a table or a graph* |
| An archive package's files are compared with the checksums (SHA-256) in `PREMIS.xml` when the package is read, and a changed or missing file is shown; a place that points outside the package is not checked and never read | PREMIS 3.0 | `plan files`: *an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files* |
| All rendered data is escaped; no `innerHTML` with user data; documents and published pages escape | OWASP ASVS 5.3 | `published page`: *everything escaped*; `docgen`: *builders escape and structure the content*; code convention |
| Service worker and PWA only in server mode; from file:// nothing depends on them | — | the localhost step of the test matrix |
| No secrets, personal data or the author's identity in the repository or its history | — | the release scripts' identity check before every commit, `CONTRIBUTING.md` |

## Personal data and retention

What the app stores, where, and for how long. Everything stays on your computer; nothing is sent to the app's author, and
no update check is made without your action. Dataregium's half (what the server stores about you) is in
[README](https://github.com/marwiss/Dataregium/blob/main/docs/en/README.md#personal-data).

| Data | Where | Contains | Kept |
|---|---|---|---|
| Datasets | IndexedDB (one SQLite file per dataset) | what you imported, with columns, comments and history; may hold personal data | until you delete them; backups and bundles are ZIP files where you put them |
| Settings | IndexedDB | language, panel widths, added sources, consents, saved queries | until you clear site data |
| Secrets | memory, or IndexedDB encrypted with your passphrase | API keys, tokens; the passphrase is never stored | the session, or until you remove the source |
| The log | memory | actions, errors and calls with masked headers | until the page is reloaded |
| Names on comments | the dataset's file | the name you gave yourself | travels with bundles, backups and GitHub |
| What you send | with the recipient | datasets, files, issues, comments and your user name at the server | under the recipient's terms |

## Known gaps

- No Content-Security-Policy yet: the app runs classic scripts, blob workers and WebAssembly, and the web-ifc bundle needs
  `eval`. A meta CSP without `'unsafe-eval'` is added when web-ifc can be loaded without it.
- From file:// in Chromium every locally opened HTML file shares storage. Secrets are encrypted, but a sensitive workspace
  should run from a local server (`python -m http.server`) or be mirrored to a portable folder.
- Chromium applies the server's `form-action` to the redirect after the sign-in too; the server must allow the app's
  callback address (Dataregium does).

## Reporting a vulnerability

Do not open a public issue. Use the button *Report a vulnerability* under Security → Advisories in the repository on
GitHub, as [SECURITY.md](../../SECURITY.md) says: version (under the help button), browser, what you saw and how to
reproduce it. You get an acknowledgement within a few days and a fix or a plan as soon as the problem is understood.

## Versions that receive fixes

One release per major number is kept: only the latest release of the 2 series receives fixes. 1.0.0 is kept for
reference without fixes.
