// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Before the boot loader: the tests assert Swedish messages and drive the shell themselves (language, course, consent). */
try { localStorage.setItem('dataspatium.lang', 'sv'); localStorage.setItem('dataspatium.course', '{"status":"closed","step":0}'); localStorage.setItem('dataspatium.consent', 'granted'); } catch (e) { /* storage may be unavailable */ }
// The tests reach every module directly, so the boot loader loads every group of scripts at start (src/boot.js GROUPS); the page
// tests/lazy.html (data-groups="start" on this script) loads only the start list, as the app does, and tries what waits for a group.
if (!(document.currentScript && document.currentScript.getAttribute('data-groups') === 'start')) /** @type {any} */ (globalThis).DATASPATIUM_PROFILE = 'all';
// Every breach of the content policy is written to the log, so that the whole suite shows what the policy stops.
document.addEventListener('securitypolicyviolation', function (e) { console.log('DATASPATIUM-LOG: CSP | ' + e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || '') + ':' + (e.lineNumber || 0)); });
