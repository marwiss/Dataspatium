// SPDX-License-Identifier: 0BSD
/*
 * This file alone is under the Zero-Clause BSD licence (0BSD, decision F74 a), so that whoever deploys the app may change and
 * share their version; the rest of Dataspatium is under PolyForm Strict 1.0.0 (LICENSE):
 *
 *   Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.
 *   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
 *   WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR
 *   CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 *   NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Deployment settings for Dataspatium (optional). index.html (and Dataspatium Mobil, m/index.html, for the language) loads
 * this file before the app, from a folder (file://) as well as from a web server. As shipped it sets nothing: no ceiling on
 * the tier, the browser's language and no server.
 *
 * To set something, remove the comment markers around the block below and keep only the lines you need:
 *
 * - tier: the highest tier the users may choose: 'documents' (1 Dokument, Documents), 'bim-gis' (2 BIM och GIS, BIM + GIS)
 *   or 'experimental' (3 Experimentell, Experimental). Users still choose their own tier under Hantera > Arbetsyta
 *   (Manage > Workspace in English), at most this one.
 * - language: the language before the user chooses one: 'sv', 'en', 'da', 'nb', 'nn', 'fi' or 'is'. The first-start
 *   language question is then skipped; the language button still changes it.
 * - server: a Dataregium server added as a source at the first start. It is never contacted until the user opens it
 *   and agrees to the network access, and it never replaces a source the user has on the same host.
 *
 * A value that cannot be read is skipped with a warning in the browser's console, so a mistyped file never locks the app.
 *
 * Keep a copy of your edited file: a new version of the app ships this file again with nothing set.
 * See "Hur ställer man in appen för en organisation?" in docs/sv/faq.md, or "How do I set up the app for an
 * organisation?" in docs/en/faq.md.
 */
/*
globalThis.DATASPATIUM_CONFIG = {
  tier: 'bim-gis',
  language: 'sv',
  server: { baseUrl: 'https://cde.example.org', name: 'Our Dataregium' },
};
*/
