// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Application entry point: loads fonts, builds the shell and registers the nine modes. Inhämta and Hantera, where the app
 * lands, are part of the start; the other seven are groups of scripts (src/boot.js GROUPS) that the shell loads the first
 * time the mode is opened, and creates at once where the group is loaded already (the test page loads every group).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  /** The modes loaded at first use; each one's group has the mode's id as its name. */
  const LAZY_MODES = ['soka', 'bearbeta', 'kontrollera', 'analysera', 'visualisera', 'exportera', 'dela'];
  D.define('app', ['ui/shell', 'ui/fonts', 'ui/theme', 'ui/modes/inhamta', 'ui/modes/hantera', 'platform/startup-profile'],
    (shellMod, fonts, _theme, inhamta, hantera, startupProfile) => ({
      LAZY_MODES,
      /** @param {HTMLElement} root */
      async start(root) {
        fonts.loadFonts();
        const shell = shellMod.create(root);
        shell.registerMode(inhamta.createMode(shell.ctx));
        shell.registerMode(hantera.createMode(shell.ctx));
        for (const id of LAZY_MODES) shell.registerLazyMode(id, id, 'ui/modes/' + id);
        await shell.init();
        // The start profile (?profil=start, platform/startup-profile) notes the first render; nothing happens without it.
        startupProfile.rendered();
        // Resume auto-save to the portable folder when it was on (Chromium only, see data/workspace.js).
        D.require('data/workspace').initFolder().catch((err) => D.log('folder', 'init failed', err));
        // Exposed on the Dataspatium namespace for debugging and for tools/screenshot.ps1 -EvalFile scripts.
        D.shell = shell;
        shell.log(D.t('app.started', { version: D.version, protocol: location.protocol }));
        return shell;
      },
    }));
})();
