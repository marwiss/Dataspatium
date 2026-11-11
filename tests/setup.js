// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Before the boot loader: the tests assert Swedish messages and drive the shell themselves (language, course, consent). */
try { localStorage.setItem('dataspatium.lang', 'sv'); localStorage.setItem('dataspatium.course', '{"status":"closed","step":0}'); localStorage.setItem('dataspatium.consent', 'granted'); } catch (e) { /* storage may be unavailable */ }
// Every breach of the content policy is written to the log, so that the whole suite shows what the policy stops.
document.addEventListener('securitypolicyviolation', function (e) { console.log('DATASPATIUM-LOG: CSP | ' + e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || '') + ':' + (e.lineNumber || 0)); });
