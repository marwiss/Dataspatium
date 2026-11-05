# Security policy

Security is the first requirement of this app: it holds the user's datasets, API keys and
tokens in the browser, and it talks to servers (open APIs, and OpenCDE servers such as
Kontroll) only when the user asks it to. The policy is the same as Kontroll's; the two
projects are developed as a pair and released with the same numbers.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through
GitHub's "Report a vulnerability" button on this repository (Security → Advisories). Include
the version (shown under the help button), the browser, what you observed and how to
reproduce it. You will get an acknowledgement within a few days and a fix or a mitigation
plan as soon as the problem is understood.

## What we do

- The threat model, the controls and the tests that prove them, personal data and retention
  are documented in `docs/sakerhet.md` (Swedish; translations under
  `docs/<language>/sakerhet.md`, English in `docs/en/sakerhet.md`).
- Nothing leaves the computer without the user's action and consent per purpose; secrets are
  kept only for the session or encrypted with a passphrase; everything that is shared goes
  through a review of personal data first.
- Every release runs the whole browser test suite in Edge and Firefox, including the security
  tests (consent, secrets, review before sharing, OAuth2 with PKCE and state, log masking,
  component checksums), and the live suite against a Kontroll server.
- Third-party components are vendored at pinned versions with their licences; components and R
  packages fetched on demand are pinned and verified against SHA-256; no code is evaluated
  from data, with one documented exception (the web-ifc bundle).
- No secrets, personal data or author identities in the repository or its history.

## Supported versions

One release per major number is kept; only the latest release of the 2 series receives fixes.
