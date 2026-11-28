// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The change proposals of a model on its server (decision F43 b, step 5: several people with their own clients feed the same asset
 * information model). A card in the model view for a model fetched from a Dataregium the person is signed in to: the proposals the
 * server holds against the document (capability `ifc_changes.ifc_proposals_url`), newest first, each with its state, author, size and
 * base version, and Approve for a tried one when the person may approve. A tried proposal, a whole file (Dataregium's F204 a) or a
 * change set, shows what it changes against its base through the server's diff of two sides (its phase 5.5). Nothing is fetched
 * until the person asks; the rows are the server's data and are rendered as text, never as markup.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/proposals-card', ['ui/base', 'ui/basic', 'ui/overlays', 'data/datasets', 'api/connectors'], (base, basic, overlays, datasets, connectors) => {
    /** The OpenCDE family, set by ready() with the group 'families' (src/boot.js) loaded for a model from a server document. @type {any} */
    let opencde = null;
    const { h, t, i18n, replace } = base;
    const STATES = ['queued', 'running', 'clean', 'issues', 'failed', 'approved'];
    const MAX_ROWS = 200;

    /**
     * @param {any} ctx the mode context (shell.log)
     * @param {any} ds the dataset's meta (id, name, source.cde)
     */
    function create(ctx, ds) {
      const s = { cde: null, connector: null, rows: null, busy: false, error: '', approving: '', shown: false, sides: false, diffs: {}, diffing: '' };
      const el = h('div', { 'data-proposals': '' });
      const log = (msg, level) => { if (ctx && ctx.shell && typeof ctx.shell.log === 'function') ctx.shell.log(msg, level); };
      const guidOf = (row) => String((row && row.topic_guid) || '');

      /** Whether the card applies: the model came from a server document and the person is signed in. No network here. */
      async function ready() {
        const meta = await datasets.get(ds.id);
        const cde = meta && meta.source && meta.source.cde;
        if (!cde || !cde.connectorId || !cde.projectId || !cde.documentId) { s.shown = false; render(); return false; }
        const connector = await connectors.get(cde.connectorId);
        if (connector) opencde = await D.ensure(['families'], () => D.require('api/families/opencde'));
        if (!connector || !opencde.isOpenCde(connector) || !opencde.signedIn(connector)) { s.shown = false; render(); return false; }
        s.cde = cde; s.connector = connector; s.shown = true; render();
        return true;
      }

      /** The list, on the person's request. */
      async function fetchRows() {
        if (s.busy || !s.shown) return;
        s.busy = true; s.error = ''; render();
        try {
          const rows = await opencde.ifcProposals(s.connector, s.cde.projectId, s.cde.documentId);
          s.sides = opencde.canSides(await opencde.capabilities(s.connector));
          if (!rows) { s.rows = null; s.error = t('proposals.unsupported'); }
          else { s.rows = rows.slice(0, MAX_ROWS); log(t('proposals.log.fetched', { n: i18n.formatNumber(s.rows.length), server: s.connector.name }), 'ok'); }
        } catch (err) { s.error = String((err && err.message) || err); }
        s.busy = false; render();
      }

      /**
       * Approves one proposal on the server; the server answers the new version, 403 when a team's responsible has to, 412 when the
       * document moved on and the changes collide (the one who proposed resolves that in the AI panel).
       * @param {any} row @param {{confirmed?: boolean}} [options]
       */
      async function approve(row, options = {}) {
        if (!row || !row.approve_url || s.approving || !s.shown) return null;
        const project = s.cde.projectName || s.cde.projectId;
        if (!options.confirmed && !(await overlays.dialog.confirm(t('proposals.approve.confirm', { title: String(row.title || ''), project })))) return null;
        s.approving = guidOf(row); s.error = ''; render();
        let version = null;
        try {
          version = await opencde.approveProposal(s.connector, String(row.approve_url));
          const msg = t('proposals.approved', { title: String(row.title || ''), version: String((version && (version.version_number || version.version_index)) || ''), project });
          log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
        } catch (err) {
          if (err && err.status === 403) s.error = t('proposals.err.team', { detail: String((err && (err.detail || err.message)) || '') });
          else if (err && err.status === 412) s.error = t('proposals.err.conflict');
          else s.error = String((err && err.message) || err);
        }
        s.approving = '';
        if (version) await fetchRows(); else render();
        return version;
      }

      /**
       * What a proposal changes against its base, as the server's diff of two sides (Dataregium's phase 5.5): the trial names its kind
       * (a whole file, F204 a, or a change set) and its commit, and the diff goes from the base version's index to that commit. The
       * trial's address is used only on the source's own server, so the token goes nowhere else.
       * @param {any} row
       */
      async function showDiff(row) {
        const guid = guidOf(row);
        if (!guid || s.diffing || !s.shown) return null;
        s.diffing = guid; s.error = ''; render();
        try {
          const trialUrl = opencde.ownUrl(s.connector, row.proposal_url, `${opencde.bcfBase(s.connector)}/projects/${encodeURIComponent(s.cde.projectId)}/topics/${encodeURIComponent(guid)}/ifc-proposal`);
          const trial = await opencde.api(s.connector, trialUrl);
          const kind = trial && trial.kind === 'file' ? 'file' : 'change_set';
          const commit = trial && typeof trial.commit === 'string' && /^[0-9a-f]{7,64}$/i.test(trial.commit) ? trial.commit : '';
          const base = Number((trial && trial.base && trial.base.version_index) || row.base_version_index) || 0;
          if (!commit || !base) { s.diffs[guid] = { kind, none: true }; }
          else {
            const json = await opencde.sidesDiff(s.connector, s.cde.documentId, base, commit);
            if (!json) throw new Error(t('compare.server.nodiff'));
            const list = (x) => (Array.isArray(x) ? x : []);
            s.diffs[guid] = { kind, base, commit, added: list(json.added), removed: list(json.removed), changed: list(json.changed), truncated: !!json.truncated };
          }
        } catch (err) { s.error = String((err && err.message) || err); }
        s.diffing = ''; render();
        return s.diffs[guid] || null;
      }
      const elementLine = (e) => `${String(e.type || '')}${e.name ? ' ' + String(e.name) : ''}${e.storey ? ' · ' + String(e.storey) : ''}`;
      function diffView(guid) {
        const d = s.diffs[guid];
        if (!d) return null;
        if (d.none) return h('p', { class: 'dm-help dm-xs', 'data-proposal-diff': guid, text: t('proposals.diff.none') });
        const group = (key, list) => (list.length ? h('li', { class: 'dm-xs', text: t('proposals.diff.' + key, { names: list.slice(0, 5).map(elementLine).join(', ') + (list.length > 5 ? ' …' : '') }) }) : null);
        return h('div', { class: 'dm-stack-xs', 'data-proposal-diff': guid, 'data-proposal-kind': d.kind },
          h('p', { class: 'dm-small', text: t('proposals.diff.counts', { added: i18n.formatNumber(d.added.length), removed: i18n.formatNumber(d.removed.length), changed: i18n.formatNumber(d.changed.length), base: String(d.base) }) }),
          h('ul', { class: 'dm-list dm-xs' }, group('added', d.added), group('removed', d.removed), group('changed', d.changed)),
          d.truncated ? h('p', { class: 'dm-help dm-xs', text: t('proposals.diff.truncated') }) : null);
      }

      const stateOf = (row) => (STATES.includes(String(row && row.state)) ? String(row.state) : 'queued');
      function rowView(row) {
        const state = stateOf(row);
        const guid = guidOf(row);
        const canApprove = !!row.approve_url && (state === 'clean' || state === 'issues');
        const tried = state === 'clean' || state === 'issues' || state === 'approved';
        const whole = s.diffs[guid] && s.diffs[guid].kind === 'file';
        const when = row.checked_at ? i18n.formatDateTime(row.checked_at) : '';
        return h('div', { class: 'dm-stack-xs', 'data-proposal': guid, 'data-proposal-state': state },
          h('div', { class: 'dm-row' },
            h('strong', { class: 'dm-grow dm-small', text: String(row.title || '') }),
            h('dm-badge', { text: t('proposals.state.' + state, { version: String(row.version_index || '') }) })),
          row.description ? h('p', { class: 'dm-help dm-xs', text: String(row.description).slice(0, 200) }) : null,
          // change_count is null until the server has tried the proposal (and for a whole file), and description null when the topic has none.
          h('p', { class: 'dm-help dm-xs', text: whole ? t('proposals.row.file', { base: String(row.base_version_index || ''), author: String(row.author || ''), when })
            : t('proposals.row', { changes: row.change_count === null || row.change_count === undefined ? '–' : i18n.formatNumber(Number(row.change_count) || 0), base: String(row.base_version_index || ''), author: String(row.author || ''), when }) }),
          h('div', { class: 'dm-row-wrap' },
            tried && s.sides ? basic.button({ label: t('proposals.diff'), icon: 'git-branch', size: 'sm', title: t('proposals.diff.hint'), loading: s.diffing === guid, disabled: !!s.diffing, 'data-proposal-diff-show': guid, onClick: () => showDiff(row) }) : null,
            canApprove ? basic.button({ label: t('proposals.approve'), icon: 'check', size: 'sm', title: t('proposals.approve.hint'), loading: s.approving === guid, disabled: !!s.approving, 'data-proposal-approve': guid, onClick: () => approve(row) }) : null),
          diffView(guid));
      }

      function render() {
        if (!s.shown) { replace(el); return; }
        replace(el,
          h('h4', { text: t('proposals.title') }),
          h('p', { class: 'dm-help dm-xs', text: t('proposals.hint', { server: s.connector.name }) }),
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('proposals.fetch'), icon: 'refresh-cw', size: 'sm', title: t('proposals.fetch.hint'), loading: s.busy, 'data-proposals-fetch': '', onClick: fetchRows })),
          s.error ? h('p', { class: 'dm-error', 'data-proposals-error': '', text: s.error }) : null,
          s.rows ? (s.rows.length ? h('div', { class: 'dm-stack-sm', 'data-proposals-list': String(s.rows.length) }, s.rows.map(rowView)) : h('p', { class: 'dm-help', 'data-proposals-list': '0', text: t('proposals.none') })) : null,
          s.rows && s.rows.length >= MAX_ROWS ? h('p', { class: 'dm-help dm-xs', text: t('proposals.more', { n: i18n.formatNumber(s.rows.length) }) }) : null);
      }

      return { el, state: s, ready: ready(), refresh: ready, fetch: fetchRows, approve, showDiff, destroy() { replace(el); } };
    }
    return { create, STATES, MAX_ROWS };
  });
})();
