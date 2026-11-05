// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The issues of a model, from the CDE it came from or from any OpenCDE source in the workspace: the BCF topics whose viewpoints
 * point at elements of this model, one list, and a click marks the elements in the 3D view and shows the snapshot and the
 * comments. Reading only; nothing is fetched until the user asks, and nothing is stored.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/model-issues', ['ui/base', 'data/datasets', 'api/families/opencde', 'api/connectors'], (base, datasets, opencde, connectors) => {
    const { h, t, i18n, replace } = base;
    const PAGE = 500;
    /** Badge colours follow what a status usually means; unknown statuses are plain. */
    const BADGE = [[/open|öppe|ny|new|active|aktiv/i, 'warn'], [/progress|pågå|under/i, 'accent'], [/resolved|löst|closed|stäng|done|klar/i, 'ok']];
    const badgeKind = (status) => { const hit = BADGE.find(([re]) => re.test(String(status || ''))); return hit ? hit[1] : undefined; };

    /**
     * @param {any} ctx shell context
     * @param {any} ds the model dataset
     * @param {{select: (ids: number[], fit: boolean) => void, connectorId?: string, projectId?: string}} hooks
     */
    function create(ctx, ds, hooks) {
      const { ui, shell } = ctx;
      const cde = (ds.source && ds.source.cde) || {};
      const s = { connector: null, connectors: [], projects: null, projectId: hooks.projectId || cde.projectId || '', topics: null, parts: new Map(), elements: new Map(), selected: null, comments: [], snapshot: '', busy: '', error: '', missing: 0 };
      const el = h('div', { class: 'dm-stack-sm dm-model-issues', 'data-model-issues': '' });
      let alive = true;
      const fail = (err) => { s.error = String((err && err.message) || err); shell.log(s.error, 'error'); };

      async function start() {
        s.connectors = (await connectors.list()).filter((c) => opencde.isOpenCde(c));
        s.connector = s.connectors.find((c) => c.id === (hooks.connectorId || cde.connectorId)) || s.connectors[0] || null;
        render();
        if (s.connector && opencde.signedIn(s.connector) && s.projectId) await load();
      }
      async function signIn() {
        if (!s.connector) return;
        s.busy = 'login'; s.error = ''; render();
        try {
          if (!opencde.redirectUri()) throw new Error(t('issues.err.file'));
          await opencde.login(s.connector);
          await load();
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      /** The project's topics and the elements their viewpoints point at, matched against this model by guid. */
      async function load() {
        if (!s.connector || !opencde.signedIn(s.connector)) return;
        s.busy = 'topics'; s.error = ''; render();
        try {
          if (!s.projects) s.projects = await opencde.projects(s.connector);
          if (!s.projectId || !s.projects.some((p) => p.project_id === s.projectId)) s.projectId = s.projects[0] ? s.projects[0].project_id : '';
          if (!s.projectId) { s.topics = []; s.busy = ''; render(); return; }
          const topics = [];
          for (let skip = 0; ; skip += PAGE) {
            const page = await opencde.topics(s.connector, s.projectId, { $top: PAGE, $skip: skip });
            topics.push(...page);
            if (page.length < PAGE || topics.length >= 20000) break;
          }
          const table = await opencde.fetchComponents(s.connector, s.projectId, topics);
          const at = Object.fromEntries(table.columns.map((c, i) => [c, i]));
          s.parts = new Map();
          const guids = new Set();
          for (const r of table.rows) {
            const guid = r[at.ifc_guid];
            if (!guid) continue;
            guids.add(String(guid));
            const list = s.parts.get(r[at.topic_guid]) || [];
            list.push({ guid: String(guid), role: r[at.role], color: r[at.color], viewpoint: r[at.viewpoint_guid] });
            s.parts.set(r[at.topic_guid], list);
          }
          s.elements = await elementsByGuid(Array.from(guids));
          // Topics that point at this model first, the rest after; within each group the newest first.
          const touches = (tp) => (s.parts.get(tp.guid) || []).filter((c) => s.elements.has(c.guid)).length;
          topics.sort((a, b) => (touches(b) > 0) - (touches(a) > 0) || String(b.modified_date || b.creation_date || '').localeCompare(String(a.modified_date || a.creation_date || '')));
          s.topics = topics;
          s.missing = topics.filter((tp) => (s.parts.get(tp.guid) || []).length && !touches(tp)).length;
          shell.log(t('issues.fetched', { n: i18n.formatNumber(topics.length), model: i18n.formatNumber(topics.filter((tp) => touches(tp) > 0).length) }), 'ok');
        } catch (err) { s.topics = null; fail(err); }
        s.busy = ''; render();
      }
      /** The model's elements for the guids, in chunks the query can take. */
      async function elementsByGuid(guids) {
        const out = new Map();
        if (!guids.length) return out;
        const engine = (await datasets.ensureOpen(ds.id)).engine;
        for (let i = 0; i < guids.length; i += 400) {
          const chunk = guids.slice(i, i + 400);
          const res = await engine.exec(`select id, guid from data where guid in (${chunk.map(() => '?').join(', ')})`, chunk);
          for (const r of (res[0] ? res[0].values : [])) out.set(String(r[1]), Number(r[0]));
        }
        return out;
      }
      const elementIds = (tp) => (s.parts.get(tp.guid) || []).map((c) => s.elements.get(c.guid)).filter((id) => id !== undefined);

      async function choose(tp) {
        s.selected = tp.guid; s.comments = []; s.snapshot = '';
        hooks.select(elementIds(tp), true);
        render();
        try {
          const [comments, viewpoints] = await Promise.all([opencde.comments(s.connector, s.projectId, tp.guid), opencde.viewpoints(s.connector, s.projectId, tp.guid)]);
          if (s.selected !== tp.guid) return;
          s.comments = comments;
          const withPicture = viewpoints.find((v) => v.snapshot);
          if (withPicture) {
            const got = await opencde.binary(s.connector, `/bcf/3.0/projects/${encodeURIComponent(s.projectId)}/topics/${encodeURIComponent(tp.guid)}/viewpoints/${encodeURIComponent(withPicture.guid)}/snapshot`, 'image/*');
            if (s.selected !== tp.guid || !alive) return;
            s.snapshot = URL.createObjectURL(new Blob([got.buffer], { type: got.contentType || 'image/png' }));
          }
        } catch (err) { fail(err); }
        render();
      }
      function clearSnapshot() { if (s.snapshot) { URL.revokeObjectURL(s.snapshot); s.snapshot = ''; } }

      function render() {
        if (!alive) return;
        const parts = [h('h4', { text: t('issues.title') })];
        if (!s.connectors.length) {
          parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.none.source') }));
          replace(el, ...parts); return;
        }
        if (s.connectors.length > 1) {
          const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('issues.source'), inline: true }));
          sel.options = s.connectors.map((c) => ({ value: c.id, label: c.name }));
          sel.value = s.connector ? s.connector.id : '';
          sel.addEventListener('change', () => { s.connector = s.connectors.find((c) => c.id === sel.value) || null; s.projects = null; s.topics = null; s.selected = null; clearSnapshot(); render(); });
          parts.push(sel);
        }
        const signed = s.connector && opencde.signedIn(s.connector);
        if (!signed) {
          parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.signin.hint', { name: s.connector ? s.connector.name : '' }) }),
            ui.button({ label: t('opencde.signin'), icon: 'chevron-right', size: 'sm', loading: s.busy === 'login', onClick: signIn }));
        } else {
          if (s.projects && s.projects.length > 1) {
            const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('opencde.project'), inline: true }));
            sel.options = s.projects.map((p) => ({ value: p.project_id, label: p.name }));
            sel.value = s.projectId;
            sel.addEventListener('change', () => { s.projectId = sel.value; s.topics = null; s.selected = null; clearSnapshot(); load(); });
            parts.push(sel);
          }
          parts.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: s.topics ? t('issues.fetch.again') : t('issues.fetch'), icon: 'refresh-cw', size: 'sm', loading: s.busy === 'topics', title: t('issues.fetch.hint'), onClick: load })));
        }
        if (s.error) parts.push(h('p', { class: 'dm-error dm-small', text: s.error }));
        if (s.topics) {
          const inModel = s.topics.filter((tp) => elementIds(tp).length);
          parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.summary', { n: i18n.formatNumber(s.topics.length), model: i18n.formatNumber(inModel.length) }) }));
          if (s.missing) parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.elsewhere', { n: i18n.formatNumber(s.missing) }) }));
          parts.push(h('ul', { class: 'dm-list dm-model-issues-list' }, s.topics.slice(0, 200).map((tp) => {
            const ids = elementIds(tp);
            return h('li', null, h('button', { type: 'button', class: 'dm-list-item', 'data-issue': tp.guid, 'aria-current': s.selected === tp.guid ? 'true' : 'false', onclick: () => choose(tp) },
              h('dm-badge', Object.assign({ text: tp.topic_status || t('issues.status.none') }, badgeKind(tp.topic_status) ? { kind: badgeKind(tp.topic_status) } : {})),
              h('span', { class: 'dm-list-main' }, h('span', { text: `${tp.server_assigned_id ? tp.server_assigned_id + ' ' : ''}${tp.title || ''}` }),
                h('span', { class: 'dm-list-sub', text: [tp.topic_type, tp.assigned_to, ids.length ? t('issues.elements.n', { n: i18n.formatNumber(ids.length) }) : ''].filter(Boolean).join(' · ') }))));
          })));
          if (s.topics.length > 200) parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.more', { n: i18n.formatNumber(s.topics.length - 200) }) }));
        }
        const chosen = s.selected && s.topics ? s.topics.find((tp) => tp.guid === s.selected) : null;
        if (chosen) {
          parts.push(h('div', { class: 'dm-card dm-stack-xs', 'data-issue-detail': '' },
            h('strong', { text: chosen.title || '' }),
            chosen.description ? h('p', { class: 'dm-small', text: chosen.description }) : null,
            h('p', { class: 'dm-help dm-small', text: [chosen.creation_author, chosen.creation_date ? i18n.formatDateTime(chosen.creation_date) : '', chosen.priority, chosen.due_date ? t('issues.due', { date: String(chosen.due_date).slice(0, 10) }) : ''].filter(Boolean).join(' · ') }),
            s.snapshot ? h('img', { class: 'dm-model-issue-snapshot', src: s.snapshot, alt: t('issues.snapshot') }) : null,
            s.comments.length ? h('ul', { class: 'dm-stack-xs' }, s.comments.map((c) => h('li', { class: 'dm-small' }, h('span', { class: 'dm-help', text: `${c.author || ''} · ${c.date ? i18n.formatDateTime(c.date) : ''}: ` }), h('span', { text: c.comment || '' })))) : h('p', { class: 'dm-help dm-small', text: t('issues.comments.none') })));
        }
        replace(el, ...parts);
      }
      function destroy() { alive = false; clearSnapshot(); }

      return { el, start, load, choose, destroy, state: s };
    }

    return { create, badgeKind };
  });
})();
