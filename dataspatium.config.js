// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/*
 * Deployment settings for Dataspatium (optional). index.html loads this file before the app, from a folder (file://) as well
 * as from a web server. As shipped it sets nothing: no ceiling on the tier, the browser's language and no server.
 *
 * To set something, remove the comment markers around the block below and keep only the lines you need:
 *
 * - tier: the highest tier the users may choose: 'documents' (1 Dokument), 'bim-gis' (2 BIM och GIS) or
 *   'experimental' (3 Experimentell). Users still choose their own tier under Hantera > Arbetsyta, at most this one.
 * - language: the language before the user chooses one: 'sv', 'en', 'da', 'nb', 'nn', 'fi' or 'is'. The first-start
 *   language question is then skipped; the language button still changes it.
 * - server: a Dataregium server added as a source at the first start. It is never contacted until the user opens it
 *   and agrees to the network access.
 *
 * Keep a copy of your edited file: a new version of the app ships this file again with nothing set.
 * See docs/sv/faq.md (Svenska) or docs/en/faq.md (English), "Ställa in appen för en organisation".
 */
/*
globalThis.DATASPATIUM_CONFIG = {
  tier: 'bim-gis',
  language: 'sv',
  server: { baseUrl: 'https://cde.example.org', name: 'Our Dataregium' },
};
*/
