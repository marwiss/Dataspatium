// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The panel "Jämför versioner" in Bearbeta's model view (the inspector): compare the open IFC model with a saved version of the same
 * dataset or with another model in the workspace (a newer version fetched from a CDE), see what is only here, only there and changed
 * (attribute by attribute, property by property), colour the 3D view (green only here, yellow changed), draw the other version instead
 * (red only there), and mark the elements. For a model fetched from Dataregium the panel also shows the server's change set of the
 * fetched version (the topic it was approved from, who proposed and approved it, and every change), and the server's own diff of the
 * fetched version against any other version of the document (its OB-30), sources beside the snapshots and the other models. The
 * server's diff by STEP id (its phase 5.1) also names the instances under each element, and the instances no object reaches or that
 * too many share. A server that keeps the document's history in git (its phase 5.5) gives the commits as pages to choose from, each
 * compared with this version through the diff of two sides, and Dela opens the panel on the branch of an upload that did not merge,
 * compared with the latest version. Pure reading: nothing is changed; the diff comes from data/model-diff, or from the server in the
 * same shape.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/model-compare', ['ui/base', 'ui/basic', 'ui/overlays', 'data/model-diff', 'data/selection', 'api/connectors'], (base, basic, overlays, modelDiff, selection, connectors) => {
    /** The OpenCDE family, set by connectorOf below with the group 'families' (src/boot.js) loaded before the server is asked. @type {any} */
    let opencde = null;
    const { h, t, i18n, replace } = base;
    const SHOW = 50;
    const SHOW_FIELDS = 6;
    const SHOW_IDS = 12;
    const cssColor = (name) => ((globalThis.getComputedStyle ? getComputedStyle(document.documentElement).getPropertyValue(name) : '') || '').trim() || '#888888';

    /**
     * @param {any} ctx shell context @param {any} ds the model dataset
     * With `conflict` (Dela, after a 412 of the server's ifcmerge) the upload that did not merge, kept on a branch until `expiresAt`, is
     * the first choice, compared with the latest version (`latest`) through the diff of two sides, and run at once; `diff` is the
     * server's answer when Dela has it already.
     * @param {{preview?: (preview: {bytes?: Uint8Array|null, colors?: Array<{color: string, ids: number[]}>}|null) => any, conflict?: {commit: string, latest: number, expiresAt?: string|null, diff?: any}}} options
     */
    function create(ctx, ds, options) {
      const s = { choices: [], choice: '', busy: false, result: null, showOther: false, error: '', server: null, serverBusy: false, serverError: '', history: null };
      const cde = ds && ds.source && ds.source.cde && ds.source.cde.connectorId && ds.source.cde.documentId && ds.source.cde.versionIndex ? ds.source.cde : null;
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-compare-panel': '' });
      const keyOf = (c) => (c.server ? `server:${c.server}` : c.snapshot ? `v${c.snapshot}` : c.datasetId);
      const conflict = cde && options.conflict && options.conflict.commit && Number(options.conflict.latest) >= 1 ? options.conflict : null;
      /** The branch of an upload that did not merge, as a choice: this side is the upload (the model here), the other the latest version. */
      let serverChoices = conflict ? [{ datasetId: ds.id, server: conflict.commit, sides: { a: conflict.commit, b: Number(conflict.latest) }, expiresAt: conflict.expiresAt || null, diff: conflict.diff || null,
        label: t('compare.conflict.label', { latest: String(conflict.latest) }) }] : [];
      async function load() {
        s.choices = (await modelDiff.choices(ds.id)).concat(serverChoices);
        if (!s.choices.some((c) => keyOf(c) === s.choice)) s.choice = s.choices[0] ? keyOf(s.choices[0]) : '';
      }
      /** The colours: on this version green for only here and yellow for changed; on the other red for only there and yellow for changed. */
      function colors(other) {
        const r = s.result;
        if (!r) return [];
        const groups = other
          ? [{ color: cssColor('--dm-error'), ids: r.onlyThere.map((e) => e.id) }, { color: cssColor('--dm-warn'), ids: r.changed.map((e) => e.idThere) }]
          : [{ color: cssColor('--dm-ok'), ids: r.onlyHere.map((e) => e.id) }, { color: cssColor('--dm-warn'), ids: r.changed.map((e) => e.id) }];
        return groups.filter((g) => g.ids.length);
      }
      async function run() {
        const c = s.choices.find((x) => keyOf(x) === s.choice);
        if (!c || s.busy) return;
        s.busy = true; s.error = ''; s.result = null; s.showOther = false; render();
        try {
          s.result = c.server ? await serverDiff(c) : await modelDiff.diff(ds.id, c);
          if (options.preview) await options.preview({ colors: colors(false) });
        } catch (err) { s.error = String((err && err.message) || err); }
        s.busy = false; render();
      }
      /** The other version drawn in 3D instead of this one, and back. */
      async function toggleOther() {
        if (!s.result) return;
        s.showOther = !s.showOther && !!s.result.other.bytes;
        if (options.preview) await options.preview(s.showOther ? { bytes: s.result.other.bytes, colors: colors(true) } : { colors: colors(false) });
        render();
      }
      /** What is only here and what changed, into the shared selection (ids of this version). */
      async function mark() {
        const r = s.result;
        if (!r) return;
        const ids = r.onlyHere.map((e) => e.id).concat(r.changed.map((e) => e.id)).filter(Number.isFinite);
        if (!ids.length) return;
        const made = await selection.setFromWhere(ds.id, `id in (${ids.join(', ')})`, [], t('compare.selection.label'));
        overlays.toast.show(made ? t('selection.made', { n: i18n.formatNumber(made.rowids.length) }) : t('selection.none'), { kind: made ? 'ok' : 'info' });
      }
      async function connectorOf() {
        opencde = await D.ensure(['families'], () => D.require('api/families/opencde'));
        const connector = await connectors.get(cde.connectorId);
        if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
        if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
        return connector;
      }
      /** A point of the document's history as a choice, compared with this version through the server's sides (its phase 5.5). */
      function historyChoice(e) {
        const params = { n: String(e.versionIndex || e.mergedWith || '–'), date: e.date ? i18n.formatDateTime(e.date) : '', author: e.author, subject: e.subject.slice(0, 80), expires: e.expiresAt ? i18n.formatDateTime(e.expiresAt) : '' };
        const key = e.kind === 'conflict' && opencde.expired(e.expiresAt) ? 'compare.history.conflict.gone' : 'compare.history.' + e.kind;
        return { datasetId: ds.id, server: e.commit, sides: { a: Number(cde.versionIndex), b: e.kind === 'version' && e.versionIndex ? e.versionIndex : e.commit }, expiresAt: e.expiresAt, label: t(key, params) };
      }
      /** A page of the document's history as the choices, newest first; this version itself is left out. */
      async function loadHistory(connector, skip) {
        const page = await opencde.history(connector, cde.documentId, { top: opencde.HISTORY_TOP, skip });
        // The server counts only while there is more than the page, so the last page keeps the count of the one before.
        s.history = { total: page.total !== null ? page.total : (s.history && s.history.total) || null, more: page.more, top: page.top, skip: page.skip, count: page.entries.length };
        serverChoices = page.entries.filter((e) => !(e.kind === 'version' && e.versionIndex === Number(cde.versionIndex))).map(historyChoice);
        await load();
        if (serverChoices.length) s.choice = keyOf(serverChoices[0]);
      }
      /** Another page of the history: newer (-1) or older (+1). @param {number} step */
      async function pageHistory(step) {
        if (!s.history || s.serverBusy) return;
        const skip = Math.max(0, s.history.skip + step * s.history.top);
        if (step > 0 && !s.history.more) return;
        s.serverBusy = true; s.serverError = ''; render();
        try { await loadHistory(await connectorOf(), skip); } catch (err) { s.serverError = String((err && err.message) || err); }
        s.serverBusy = false; render();
      }
      /**
       * The document's other versions on the server as choices, compared through the server's diff (Dataregium's OB-30); a server that
       * keeps the document's history in git gives its commits instead, page by page, each compared with this version through the
       * diff of two sides (its phase 5.5).
       */
      async function loadServerVersions() {
        if (!cde || s.serverBusy) return;
        s.serverBusy = true; s.serverError = ''; render();
        try {
          const connector = await connectorOf();
          const caps = await opencde.capabilities(connector);
          if (opencde.canHistory(caps)) {
            await loadHistory(connector, 0);
            if (!serverChoices.length && !s.history.more) throw new Error(t('compare.server.noversions'));
            s.serverBusy = false; render();
            return;
          }
          if (!opencde.hasExtension(caps, 'ifc_diff')) throw new Error(t('compare.server.nodiff'));
          const versions = await opencde.documentVersions(connector, [cde.documentId]);
          serverChoices = versions.filter((v) => Number(v.version_index) !== Number(cde.versionIndex)).map((v) => ({ datasetId: ds.id, server: Number(v.version_index), label: t('compare.server.version', { n: String(v.version_number || v.version_index) }) }))
            .sort((x, y) => y.server - x.server);
          if (!serverChoices.length) throw new Error(t('compare.server.noversions'));
          await load();
          s.choice = keyOf(serverChoices[0]);
        } catch (err) { s.serverError = String((err && err.message) || err); }
        s.serverBusy = false; render();
      }
      async function serverDiff(c) {
        let json = c.diff || null;
        c.diff = null;
        if (!json) {
          const connector = await connectorOf();
          try {
            json = c.sides ? await opencde.sidesDiff(connector, cde.documentId, c.sides.a, c.sides.b) : await opencde.versionDiff(connector, cde.documentId, Number(cde.versionIndex), c.server);
          } catch (err) {
            // A conflict's branch is taken away at the first cleanup after its time (Dataregium's phase 5.5).
            if (err && err.status === 404 && c.expiresAt) throw new Error(t('compare.conflict.expired', { date: i18n.formatDateTime(c.expiresAt) }));
            throw err;
          }
        }
        if (!json) throw new Error(t('compare.server.nodiff'));
        const here = await D.require('data/datasets').ensureOpen(ds.id);
        return modelDiff.fromServer(here.engine, json, c.label, c);
      }
      /** The server's change set of the fetched version: a third source, read from Dataregium; a whole-file version has none. */
      async function loadServer() {
        if (!cde || s.serverBusy) return;
        s.serverBusy = true; s.serverError = ''; render();
        try {
          const connector = await connectorOf();
          const set = await opencde.versionChanges(connector, cde.documentId, Number(cde.versionIndex));
          s.server = { version: Number(cde.versionIndex), set: set || null, changes: set && Array.isArray(set.changes) ? set.changes : [] };
        } catch (err) { s.serverError = String((err && err.message) || err); }
        s.serverBusy = false; render();
      }
      /** The instances the server's changes name, by GlobalId (the rooted entity a path starts from) or by STEP id, into the shared selection. */
      async function markServer() {
        const changes = s.server ? s.server.changes : [];
        const ids = Array.from(new Set(changes.map((c) => Number(c.step_id)).filter((n) => Number.isFinite(n) && n > 0)));
        const guids = Array.from(new Set(changes.map((c) => String(c.guid || '')).filter((g) => /^[0-9A-Za-z_$]{22}$/.test(g))));
        if (!ids.length && !guids.length) return;
        const where = [ids.length ? `id in (${ids.join(', ')})` : '', guids.length ? `guid in (${guids.map((g) => "'" + g + "'").join(', ')})` : ''].filter(Boolean).join(' or ');
        const made = await selection.setFromWhere(ds.id, where, [], t('compare.selection.label'));
        overlays.toast.show(made ? t('selection.made', { n: i18n.formatNumber(made.rowids.length) }) : t('selection.none'), { kind: made ? 'ok' : 'info' });
      }
      /** A value of the change set's form in words: a reference, a typed value, an enumeration, a list or a scalar. */
      function serverValue(v) {
        if (v === null || v === undefined || v === '') return '–';
        if (Array.isArray(v)) return v.map(serverValue).join(', ');
        if (typeof v === 'object') {
          if (v.step_id !== undefined) return '#' + v.step_id;
          if (v.guid !== undefined) return String(v.guid) + (v.path ? '/' + v.path : '');
          if (v.enum !== undefined) return '.' + v.enum + '.';
          if (v.type !== undefined) return `${serverValue(v.value)} (${v.type})`;
        }
        return String(v);
      }
      const serverKey = (c) => (c.step_id !== undefined && c.step_id !== null ? '#' + c.step_id : String(c.guid || '') + (c.path ? '/' + c.path : ''));
      /** Where in the history the choices are, and the way to newer and older commits. */
      function historyPages() {
        const p = s.history;
        if (!p || (!p.skip && !p.more)) return p ? h('p', { class: 'dm-help dm-xs', 'data-compare-history': String(p.count), text: t('compare.history.hint') }) : null;
        const page = Math.floor(p.skip / p.top) + 1;
        const pages = p.total ? Math.max(page, Math.ceil(p.total / p.top)) : 0;
        return h('div', { class: 'dm-stack-xs', 'data-compare-history': String(p.count) },
          h('p', { class: 'dm-help dm-xs', text: t('compare.history.hint') }),
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('compare.history.newer'), icon: 'chevron-left', size: 'sm', disabled: !p.skip || s.serverBusy, title: t('compare.history.newer.hint'), 'data-compare-history-newer': '', onClick: () => pageHistory(-1) }),
            h('span', { class: 'dm-small', 'data-compare-history-page': String(page), text: pages ? t('compare.history.page', { page: i18n.formatNumber(page), pages: i18n.formatNumber(pages) }) : t('compare.history.page.open', { page: i18n.formatNumber(page) }) }),
            basic.button({ label: t('compare.history.older'), icon: 'chevron-right', size: 'sm', disabled: !p.more || s.serverBusy, title: t('compare.history.older.hint'), 'data-compare-history-older': '', onClick: () => pageHistory(1) })));
      }
      function renderServer() {
        if (!cde) return null;
        const sv = s.server;
        return h('div', { class: 'dm-stack-sm', 'data-compare-server': '' },
          h('h4', { text: t('compare.server.title') }),
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('compare.server.versions'), icon: 'history', size: 'sm', loading: s.serverBusy, title: t('compare.server.versions.hint'), 'data-compare-server-versions': '', onClick: loadServerVersions }),
            basic.button({ label: t('compare.server.load', { n: String(cde.versionIndex) }), icon: 'download', size: 'sm', loading: s.serverBusy, title: t('compare.server.hint'), 'data-compare-server-load': '', onClick: loadServer }),
            sv && sv.changes.length ? basic.button({ label: t('compare.server.mark', { n: i18n.formatNumber(sv.changes.length) }), icon: 'list-checks', size: 'sm', 'data-compare-server-mark': '', onClick: markServer }) : null),
          historyPages(),
          s.serverError ? h('p', { class: 'dm-error', text: s.serverError }) : null,
          sv && !sv.set ? h('p', { class: 'dm-help dm-small', 'data-compare-server-none': '', text: t('compare.server.none', { n: String(sv.version) }) }) : null,
          sv && sv.set ? h('div', { class: 'dm-stack-sm', 'data-compare-server-result': String(sv.changes.length) },
            h('p', { class: 'dm-small', text: t('compare.server.meta', { id: String(sv.set.change_set_id || '–'), proposed: String(sv.set.proposed_by || '–'), approved: String(sv.set.approved_by || '–'), base: String((sv.set.base && sv.set.base.version_index) || '–'), n: i18n.formatNumber(sv.changes.length) }) }),
            h('ul', { class: 'dm-list dm-xs' }, sv.changes.slice(0, SHOW).map((c) => h('li', { class: 'dm-small', text: t('compare.server.change', { key: serverKey(c), attribute: String(c.attribute || ''), op: String(c.op || 'set'), old: serverValue(c.old), new: serverValue(c.new) }) + (c.copy ? ' (copy)' : '') }))),
            sv.changes.length > SHOW ? h('p', { class: 'dm-help dm-xs', text: t('compare.more', { n: i18n.formatNumber(sv.changes.length - SHOW) }) }) : null) : null);
      }
      const value = (v) => (v === null || v === undefined || v === '' ? '–' : String(v));
      const line = (e) => `${e.typ}${e.namn ? ' ' + e.namn : ''}${e.vaning ? ' · ' + e.vaning : ''} (#${e.id})`;
      /** STEP ids in brief: the first SHOW_IDS, and how many more the server counted. */
      const idList = (list, count) => {
        const shown = list.slice(0, SHOW_IDS);
        return shown.map((n) => '#' + n).join(', ') + (count > shown.length ? ' ' + t('compare.more', { n: i18n.formatNumber(count - shown.length) }) : '');
      };
      /** What the server compared by STEP id names under an element: its instances in the other version and in this one. */
      function steps(e) {
        const out = [];
        if (e.fields && !e.fields.length && !e.moreFields && (e.stepIdsCount || e.stepIdsRemovedCount)) out.push(h('li', { class: 'dm-help', 'data-compare-steps-only': '', text: t('compare.steps.only') }));
        if (e.stepIdsCount) out.push(h('li', { class: 'dm-help', 'data-compare-steps': 'there', text: t('compare.steps.there', { ids: idList(e.stepIds || [], e.stepIdsCount) }) }));
        if (e.stepIdsRemovedCount) out.push(h('li', { class: 'dm-help', 'data-compare-steps': 'here', text: t('compare.steps.here', { ids: idList(e.stepIdsRemoved || [], e.stepIdsRemovedCount) }) }));
        return out;
      }
      function section(key, label, list, total, fields) {
        if (!total) return null;
        return h('div', { class: 'dm-stack-sm', ['data-compare-' + key]: '' },
          h('h4', { text: `${t(label)} (${i18n.formatNumber(total)})` }),
          h('ul', { class: 'dm-list dm-xs' }, list.slice(0, SHOW).map((e) => {
            const sub = (fields && e.fields ? e.fields.slice(0, SHOW_FIELDS).map((f) => h('li', { text: t('compare.field', { name: f.name, there: value(f.there), here: value(f.here) }) })).concat(e.fields.length > SHOW_FIELDS || e.moreFields ? [h('li', { class: 'dm-help', text: t('compare.more', { n: i18n.formatNumber(e.fields.length - SHOW_FIELDS + (e.moreFields || 0)) }) })] : []) : []).concat(steps(e));
            return h('li', { class: 'dm-small' }, h('span', { text: line(e) }), sub.length ? h('ul', { class: 'dm-list dm-xs' }, sub) : null);
          })),
          total > SHOW ? h('p', { class: 'dm-help dm-xs', text: t('compare.more', { n: i18n.formatNumber(total - SHOW) }) }) : null);
      }
      /** The server's instances that no object reaches, or that too many reach to be brought to them (by STEP id only). */
      function instances(key, label, hint, group) {
        if (!group || !group.count) return null;
        const shown = group.list.slice(0, SHOW);
        return h('div', { class: 'dm-stack-sm', ['data-compare-' + key]: String(group.count) },
          h('h4', { text: `${t(label)} (${i18n.formatNumber(group.count)})` }),
          h('p', { class: 'dm-help dm-xs', text: t(hint) }),
          h('ul', { class: 'dm-list dm-xs' }, shown.map((x) => h('li', { class: 'dm-small', text: t(x.objects ? 'compare.instance.objects' : 'compare.instance', { id: '#' + x.id, type: x.type, change: t('compare.change.' + x.change), side: t('compare.side.' + x.side), n: i18n.formatNumber(x.objects) }) }))),
          group.count > shown.length ? h('p', { class: 'dm-help dm-xs', text: t('compare.more', { n: i18n.formatNumber(group.count - shown.length) }) }) : null);
      }
      function render() {
        const sel = /** @type {any} */ (h('dm-select', { label: t('compare.with'), 'data-compare-with': '' }));
        sel.options = s.choices.map((c) => ({ value: keyOf(c), label: c.label }));
        sel.value = s.choice;
        sel.addEventListener('change', () => { s.choice = sel.value; });
        const r = s.result;
        const nothing = r && !r.counts.onlyHere && !r.counts.onlyThere && !r.counts.changed;
        replace(el,
          h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('compare.title') })),
          s.choices.length ? h('div', { class: 'dm-row-wrap' }, sel, basic.button({ label: t('compare.run'), icon: 'history', size: 'sm', loading: s.busy, 'data-compare-run': '', onClick: run })) : h('p', { class: 'dm-help', 'data-compare-none': '', text: t('compare.none') }),
          s.error ? h('p', { class: 'dm-error', text: s.error }) : null,
          r ? h('div', { class: 'dm-stack-sm', 'data-compare-result': '' },
            h('p', { class: 'dm-small', 'data-compare-counts': '', text: t('compare.counts', { other: r.other.label, here: i18n.formatNumber(r.counts.here), there: i18n.formatNumber(r.counts.there), added: i18n.formatNumber(r.counts.onlyHere), removed: i18n.formatNumber(r.counts.onlyThere), changed: i18n.formatNumber(r.counts.changed) }) }),
            r.by ? h('p', { class: 'dm-help dm-xs', 'data-compare-by': r.by, text: t('compare.by.' + r.by) }) : null,
            nothing ? h('p', { class: 'dm-help dm-small', text: t('compare.same') }) : h('p', { class: 'dm-help dm-xs', text: t('compare.hint') }),
            r.truncated ? h('p', { class: 'dm-help dm-xs', text: t('compare.truncated', { n: i18n.formatNumber(modelDiff.MAX_LIST) }) }) : null,
            nothing ? null : h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t(s.showOther ? 'compare.show.here' : 'compare.show.other'), icon: 'layers', size: 'sm', disabled: !r.other.bytes, title: t('compare.show.other.hint'), 'data-compare-other': '', onClick: toggleOther }),
              r.counts.onlyHere + r.counts.changed ? basic.button({ label: t('compare.mark', { n: i18n.formatNumber(r.counts.onlyHere + r.counts.changed) }), icon: 'list-checks', size: 'sm', 'data-compare-mark': '', onClick: mark }) : null),
            section('only-here', 'compare.only.here', r.onlyHere, r.counts.onlyHere, false),
            section('changed', 'compare.changed', r.changed, r.counts.changed, true),
            section('only-there', 'compare.only.there', r.onlyThere, r.counts.onlyThere, false),
            instances('shared', 'compare.shared', 'compare.shared.hint', r.shared),
            instances('unplaced', 'compare.unplaced', 'compare.unplaced.hint', r.unplaced)) : null,
          renderServer());
      }
      function destroy() { if (s.result && options.preview) { s.result = null; Promise.resolve(options.preview(null)).catch(() => {}); } }
      const ready = load().then(() => {
        if (conflict) s.choice = keyOf(serverChoices[0]);
        render();
        return conflict ? run() : undefined;
      }).catch((err) => D.log('compare', err));
      return { el, destroy, state: s, ready, load, run, toggleOther, mark, loadServer, markServer, loadServerVersions, pageHistory };
    }
    return { create };
  });
})();
