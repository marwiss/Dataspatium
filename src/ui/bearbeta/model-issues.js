// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The issues of a model, from the CDE it came from or from any OpenCDE source in the workspace: the BCF topics whose viewpoints
 * point at elements of this model, one list, and a click marks the elements in the 3D view and shows the snapshot and the
 * comments. With the rights for it, the user also writes: a new issue from the marked elements with the view as viewpoint, a
 * comment, a new status, a viewpoint of the current view. Nothing is fetched until asked, nothing is stored in the dataset, and
 * everything can be saved as a BCF file for clients without an API. The elements can be coloured by the status of their issues,
 * the issues saved as a table with the elements they point at (the tool Ärenden and the board Ärendeläge start from it), and the
 * coloured view saved as a chart.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/model-issues', ['ui/base', 'data/datasets', 'api/families/opencde', 'api/connectors', 'data/bcf-xml', 'data/issues', 'viz/charts', 'api/runner', 'ui/bearbeta/issue-fields'], (base, datasets, opencde, connectors, bcfXml, issuesLogic, charts, runner, issueFields) => {
    const { h, t, i18n, replace } = base;
    /** Badge colours follow what a status means (data/issues.rank, also the Swedish review statuses); unknown statuses are plain. */
    const BADGE = ['warn', 'accent', 'ok'];
    const badgeKind = (status) => BADGE[issuesLogic.rank(status)];
    /** Fields the server owns; a PUT sends everything else back. */
    const SERVER_FIELDS = ['guid', 'server_assigned_id', 'creation_author', 'creation_date', 'modified_author', 'modified_date', 'authorization'];

    /**
     * @param {any} ctx shell context
     * @param {any} ds the model dataset
     * @param {{select: (ids: number[], fit: boolean) => void, view?: () => any, png?: () => string, marked?: () => number[], setColors?: (groups: Array<{color: string, ids: number[]}>) => void, connectorId?: string, projectId?: string}} hooks
     */
    function create(ctx, ds, hooks) {
      const { ui, shell, services } = ctx;
      const cde = (ds.source && ds.source.cde) || {};
      const s = { connector: null, connectors: [], projects: null, projectId: hooks.projectId || cde.projectId || '', ext: null, rights: null, topics: null, parts: new Map(), elements: new Map(), selected: null, comments: [], viewpoints: [], snapshot: '', busy: '', error: '', missing: 0, comment: '', replyTo: '' };
      const el = h('div', { class: 'dm-stack-sm dm-model-issues', 'data-model-issues': '' });
      /** Colours by status in the 3D view, and the legend they get. */
      s.colored = false; s.legend = []; s.groups = [];
      let alive = true;
      const fail = (err) => { s.error = String((err && err.message) || err); shell.log(s.error, 'error'); };
      const may = (kind, action) => !!(s.rights && s.rights[kind] && s.rights[kind].includes(action));

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
          s.ext = await opencde.extensions(s.connector, s.projectId);
          s.rights = { project: s.ext.project_actions || [], topic: s.ext.topic_actions || [], comment: s.ext.comment_actions || [] };
          const topics = await opencde.allTopics(s.connector, s.projectId);
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
          applyColors();
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
      /** The guids of some element ids, for the components of a viewpoint. */
      async function guidsOf(ids) {
        if (!ids.length) return [];
        const engine = (await datasets.ensureOpen(ds.id)).engine;
        const res = await engine.exec(`select guid from data where id in (${ids.map(() => '?').join(', ')}) and guid is not null`, ids);
        return (res[0] ? res[0].values : []).map((r) => String(r[0]));
      }
      const elementIds = (tp) => (s.parts.get(tp.guid) || []).map((c) => s.elements.get(c.guid)).filter((id) => id !== undefined);
      const current = () => (s.selected && s.topics ? s.topics.find((tp) => tp.guid === s.selected) : null);

      async function choose(tp) {
        s.selected = tp.guid; s.comments = []; s.viewpoints = []; s.replyTo = ''; clearSnapshot();
        hooks.select(elementIds(tp), true);
        render();
        try {
          const [comments, viewpoints] = await Promise.all([opencde.comments(s.connector, s.projectId, tp.guid), opencde.viewpoints(s.connector, s.projectId, tp.guid)]);
          if (s.selected !== tp.guid) return;
          s.comments = comments; s.viewpoints = viewpoints;
          // The view goes where the viewpoint's camera stood; without a camera it stays on the elements.
          const withCamera = viewpoints.find((v) => v.perspective_camera || v.orthogonal_camera);
          if (withCamera && hooks.camera) hooks.camera(withCamera);
          const withPicture = viewpoints.find((v) => v.snapshot);
          if (withPicture) {
            const got = await opencde.binary(s.connector, `${opencde.bcfBase(s.connector)}/projects/${encodeURIComponent(s.projectId)}/topics/${encodeURIComponent(tp.guid)}/viewpoints/${encodeURIComponent(withPicture.guid)}/snapshot`, 'image/*');
            if (s.selected !== tp.guid || !alive) return;
            s.snapshot = URL.createObjectURL(new Blob([got.buffer], { type: got.contentType || 'image/png' }));
          }
        } catch (err) { fail(err); }
        render();
      }
      function clearSnapshot() { if (s.snapshot) { URL.revokeObjectURL(s.snapshot); s.snapshot = ''; } }

      // ---- colours, table and chart --------------------------------------------------------------------------------
      /** The colour groups for the view: empty when colours are off or nothing is fetched. */
      function computeColors() {
        if (!s.colored || !s.topics) return { groups: [], legend: [] };
        return issuesLogic.colorGroups(s.topics, s.parts, s.elements);
      }
      function applyColors() {
        const out = computeColors();
        s.groups = out.groups; s.legend = out.legend;
        if (hooks.setColors) hooks.setColors(out.groups);
      }
      const currentColors = () => s.groups.slice();
      /** Type, name and storey of the model's elements the issues point at. */
      async function elementInfo() {
        const info = new Map();
        const guids = Array.from(s.elements.keys());
        if (!guids.length) return info;
        const engine = (await datasets.ensureOpen(ds.id)).engine;
        for (let i = 0; i < guids.length; i += 400) {
          const chunk = guids.slice(i, i + 400);
          const res = await engine.exec(`select guid, typ, namn, vaning from data where guid in (${chunk.map(() => '?').join(', ')})`, chunk);
          for (const r of (res[0] ? res[0].values : [])) info.set(String(r[0]), { typ: r[1], namn: r[2], vaning: r[3] });
        }
        return info;
      }
      /** The issues as a dataset of their own, one row per issue and element, remembering the model and the project. */
      async function saveTable() {
        if (!s.topics || s.busy) return null;
        s.busy = 'table'; s.error = ''; render();
        try {
          const table = issuesLogic.tableOf(s.topics, s.parts, await elementInfo());
          const project = (s.projects || []).find((p) => p.project_id === s.projectId);
          const host = opencde.hostOf(s.connector.baseUrl);
          const meta = await runner.toDataset(table, {
            name: t('issues.table.name', { model: ds.name }),
            description: t('issues.table.description', { project: project ? project.name : s.projectId, host, model: ds.name }),
            source: { kind: 'file', fileName: '', cde: { connectorId: s.connector.id, connectorName: s.connector.name, host, projectId: s.projectId, projectName: project ? project.name : '', kind: 'issues', modelId: ds.id, modelName: ds.name, fetchedAt: new Date().toISOString() } },
          });
          const done = t('issues.table.saved', { name: meta.name, n: i18n.formatNumber(table.rows.length) });
          shell.log(done, 'ok'); ui.toast.show(done, { kind: 'ok' });
          s.busy = ''; render();
          return meta;
        } catch (err) { fail(err); s.busy = ''; render(); return null; }
      }
      /** The coloured view as a model chart, for dashboards and documents. */
      async function saveChart() {
        if (!s.topics || s.busy) return null;
        s.busy = 'chart'; s.error = ''; render();
        try {
          const out = s.colored ? computeColors() : issuesLogic.colorGroups(s.topics, s.parts, s.elements);
          const chart = charts.create('model', ds, t('issues.chart.name', { model: ds.name }));
          chart.model = { datasetId: ds.id, visible: null, filter: { typ: '', vaning: '', lager: '', search: '' }, view: hooks.view ? hooks.view() : null, colors: out.groups, legend: out.legend };
          const saved = await charts.save(chart);
          const done = t('issues.chart.saved', { name: saved.name });
          shell.log(done, 'ok'); ui.toast.show(done, { kind: 'ok' });
          s.busy = ''; render();
          return saved;
        } catch (err) { fail(err); s.busy = ''; render(); return null; }
      }

      // ---- writing ---------------------------------------------------------------------------------------------
      /** The current 3D view as a BCF viewpoint: camera, snapshot and the marked elements as the selection. */
      async function viewpointFromView(ids) {
        const view = hooks.view ? hooks.view() : null;
        const picture = hooks.png ? hooks.png() : '';
        const guids = await guidsOf(ids || []);
        const vp = {};
        // BCF cameras are in the model's own coordinates with Z up, so that Bonsai and other clients show the same place.
        if (view) Object.assign(vp, bcfXml.cameraOfView(view.ifc ? Object.assign({}, view, view.ifc) : view, view.ifc ? { worldUp: [0, 0, 1] } : {}));
        // A section goes with the viewpoint as BCF clipping planes, in the model's coordinates as the drawing keeps them.
        if (view && Array.isArray(view.section) && view.section.length) {
          const pt = (v) => ({ x: Math.round(v[0] * 1000) / 1000, y: Math.round(v[1] * 1000) / 1000, z: Math.round(v[2] * 1000) / 1000 });
          vp.clipping_planes = view.section.map((c) => ({ location: pt(c.location), direction: pt(c.direction) }));
        }
        // The picture at most 1500 px on its longest side, as BCF asks: the canvas has the screen's pixels.
        const fitted = picture ? await bcfXml.fitDataUrl(picture) : null;
        if (fitted) vp.snapshot = { snapshot_type: fitted.snapshotType, snapshot_data: fitted.base64 };
        vp.components = { selection: guids.map((g) => ({ ifc_guid: g, originating_system: 'Dataspatium' })), visibility: { default_visibility: true } };
        if (!view && !picture && !guids.length) return null;
        return vp;
      }
      /**
       * The new topic tied to this model's file (BCF 3.3.3) when the server lets the person: the project's own entry for the model's
       * document version, or the file's name, IfcProject and time stamp. A refusal leaves the topic as it is and is logged.
       */
      async function linkToModel(topic) {
        try {
          const file = await opencde.modelFile(s.connector, s.projectId, ds.source && ds.source.cde, bcfXml.headerOf(ds)[0]);
          if (await opencde.linkTopic(s.connector, s.projectId, topic, s.ext, file)) shell.log(t('issues.files.linked', { file: file.filename || file.reference || '' }), 'info');
        } catch (err) { shell.log(t('issues.files.failed', { message: String((err && err.message) || err) }), 'warn'); }
      }
      /** A new issue from what is marked: the dialog takes the words, the view gives the viewpoint. */
      async function newTopic() {
        const marked = hooks.marked ? hooks.marked() : [];
        const ext = s.ext || {};
        const title = /** @type {any} */ (h('dm-input', { label: t('issues.new.title') }));
        const description = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('common.description') }));
        // Type and status always have a value; the other fields of review practice are the person's choice.
        const fields = issueFields.create(ext, { required: ['topic_type', 'topic_status'] });
        const ok = await ui.dialog.open({
          title: t('issues.new'), size: 'md', help: 'cad-bim#ärenden-från-ett-cde',
          body: h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: marked.length ? t('issues.new.marked', { n: i18n.formatNumber(marked.length) }) : t('issues.new.unmarked') }), title, description, ...fields.nodes),
          actions: [{ label: t('common.cancel'), value: false }, { label: t('issues.new.create'), variant: 'primary', value: true, primary: true }],
        });
        if (ok !== true) return;
        if (!title.value.trim()) { ui.toast.show(t('issues.err.title'), { kind: 'warn' }); return; }
        s.busy = 'write'; s.error = ''; render();
        try {
          const body = Object.assign({ title: title.value.trim() }, fields.values());
          if (description.value.trim()) body.description = description.value.trim();
          const topic = await opencde.createTopic(s.connector, s.projectId, body);
          const vp = await viewpointFromView(marked);
          if (vp) await opencde.createViewpoint(s.connector, s.projectId, topic.guid, vp);
          await linkToModel(topic);
          shell.log(t('issues.created', { id: topic.server_assigned_id || topic.guid, title: topic.title }), 'ok');
          ui.toast.show(t('issues.created', { id: topic.server_assigned_id || topic.guid, title: topic.title }), { kind: 'ok' });
          s.busy = '';
          await load();
          const made = (s.topics || []).find((tp) => tp.guid === topic.guid);
          if (made) await choose(made);
        } catch (err) { fail(err); s.busy = ''; render(); }
      }
      async function sendComment() {
        const tp = current(); const text = s.comment.trim();
        if (!tp || !text) return;
        s.busy = 'write'; render();
        try {
          await opencde.createComment(s.connector, s.projectId, tp.guid, Object.assign({ comment: text }, s.replyTo ? { reply_to_comment_guid: s.replyTo } : {}));
          s.comment = ''; s.replyTo = '';
          s.comments = await opencde.comments(s.connector, s.projectId, tp.guid);
          shell.log(t('issues.commented', { id: tp.server_assigned_id || tp.title }), 'ok');
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      async function setStatus(value) {
        const tp = current();
        if (!tp || !value || value === tp.topic_status) return;
        s.busy = 'write'; render();
        try {
          const body = Object.assign({}, tp, { topic_status: value });
          for (const k of SERVER_FIELDS) delete body[k];
          const changed = await opencde.updateTopic(s.connector, s.projectId, tp.guid, body);
          s.topics = s.topics.map((x) => (x.guid === tp.guid ? Object.assign({}, x, changed) : x));
          shell.log(t('issues.status.changed', { id: changed.server_assigned_id || changed.title, status: changed.topic_status }), 'ok');
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      async function addViewpoint() {
        const tp = current();
        if (!tp) return;
        s.busy = 'write'; render();
        try {
          const vp = await viewpointFromView(hooks.marked ? hooks.marked() : []);
          if (!vp) throw new Error(t('issues.err.noview'));
          await opencde.createViewpoint(s.connector, s.projectId, tp.guid, vp);
          shell.log(t('issues.viewpoint.added', { id: tp.server_assigned_id || tp.title }), 'ok');
          s.busy = '';
          await load();
          const again = (s.topics || []).find((x) => x.guid === tp.guid);
          if (again) await choose(again);
        } catch (err) { fail(err); s.busy = ''; render(); }
      }
      /** Everything the project holds, as a BCF file: for colleagues whose tools read files but no API. */
      async function saveBcf() {
        if (!s.topics) return;
        s.busy = 'bcf'; s.error = ''; render();
        try {
          const items = [];
          for (const tp of s.topics) {
            const [comments, viewpoints] = await Promise.all([opencde.comments(s.connector, s.projectId, tp.guid), opencde.viewpoints(s.connector, s.projectId, tp.guid)]);
            const vps = [];
            for (const vp of viewpoints) {
              const base = `${opencde.bcfBase(s.connector)}/projects/${encodeURIComponent(s.projectId)}/topics/${encodeURIComponent(tp.guid)}/viewpoints/${encodeURIComponent(vp.guid)}`;
              const [sel, col, vis] = await Promise.all([opencde.api(s.connector, base + '/selection'), opencde.api(s.connector, base + '/coloring'), opencde.api(s.connector, base + '/visibility')]);
              const full = Object.assign({}, vp, { components: { selection: (sel && sel.selection) || [], coloring: (col && col.coloring) || [], visibility: (vis && vis.visibility) || { default_visibility: true } } });
              let snapshot = null;
              if (vp.snapshot) { try { const got = await opencde.binary(s.connector, base + '/snapshot', 'image/*'); snapshot = { bytes: new Uint8Array(got.buffer), type: got.contentType }; } catch (err) { D.log('issues', 'snapshot', err); } }
              vps.push({ viewpoint: full, snapshot });
            }
            // The topic's own model files when the server has them, else this model's file for a topic that points at it.
            const own = await opencde.topicFiles(s.connector, s.projectId, tp.guid).catch(() => null);
            const header = Array.isArray(own) && own.length ? own : (elementIds(tp).length ? bcfXml.headerOf(ds) : []);
            items.push({ topic: tp, comments, viewpoints: vps, header });
          }
          const project = (s.projects || []).find((p) => p.project_id === s.projectId);
          const author = bcfXml.authorOf(await opencde.identity(s.connector), await D.require('data/comments').author());
          // The project's lists go into extensions.xml, except its users: only those the topics are assigned to go with the file.
          const blob = await bcfXml.write(items, { projectName: project ? project.name : '', projectId: s.projectId, author, extensions: s.ext ? Object.assign({}, s.ext, { users: null }) : undefined });
          services.files.download(blob, services.files.safeName(project ? project.name : 'arenden', 'bcfzip'));
          shell.log(t('issues.bcf.saved', { n: i18n.formatNumber(items.length) }), 'ok');
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }

      // ---- the panel -------------------------------------------------------------------------------------------
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
          parts.push(h('div', { class: 'dm-row-wrap' },
            ui.button({ label: s.topics ? t('issues.fetch.again') : t('issues.fetch'), icon: 'refresh-cw', size: 'sm', loading: s.busy === 'topics', title: t('issues.fetch.hint'), onClick: load }),
            s.topics && may('project', 'createTopic') ? ui.button({ label: t('issues.new'), icon: 'plus', size: 'sm', variant: 'primary', loading: s.busy === 'write', title: t('issues.new.hint'), 'data-issue-new': '', onClick: () => newTopic().catch(fail) }) : null,
            s.topics && s.topics.length ? ui.button({ label: t('issues.bcf.save'), icon: 'download', size: 'sm', loading: s.busy === 'bcf', title: t('issues.bcf.save.hint'), 'data-issue-bcf': '', onClick: saveBcf }) : null,
            s.topics && s.topics.length ? ui.button({ label: t('issues.table.save'), icon: 'table', size: 'sm', loading: s.busy === 'table', title: t('issues.table.save.hint'), 'data-issue-table': '', onClick: saveTable }) : null));
        }
        if (s.error) parts.push(h('p', { class: 'dm-error dm-small', text: s.error }));
        if (s.topics) {
          const inModel = s.topics.filter((tp) => elementIds(tp).length);
          parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.summary', { n: i18n.formatNumber(s.topics.length), model: i18n.formatNumber(inModel.length) }) }));
          if (s.missing) parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.elsewhere', { n: i18n.formatNumber(s.missing) }) }));
          if (hooks.setColors && inModel.length) {
            const sw = /** @type {any} */ (h('dm-switch', { label: t('issues.colors'), title: t('issues.colors.hint'), 'data-issue-colors': '' }));
            sw.checked = s.colored;
            sw.addEventListener('change', () => { s.colored = sw.checked; applyColors(); render(); });
            parts.push(h('div', { class: 'dm-row-wrap' }, sw,
              ui.button({ label: t('issues.chart.save'), icon: 'image', size: 'sm', loading: s.busy === 'chart', title: t('issues.chart.save.hint'), 'data-issue-chart': '', onClick: saveChart })));
            if (s.colored && s.legend.length) {
              parts.push(h('ul', { class: 'dm-model-issues-legend dm-row-wrap' }, s.legend.map((l) => {
                const swatch = h('span', { class: 'dm-legend-swatch' }); swatch.style.background = l.color;
                return h('li', { class: 'dm-small' }, swatch, h('span', { text: `${l.status || t('issues.status.none')} (${i18n.formatNumber(l.n)})` }));
              })));
            }
          }
          parts.push(h('ul', { class: 'dm-list dm-model-issues-list' }, s.topics.slice(0, 200).map((tp) => {
            const ids = elementIds(tp);
            return h('li', null, h('button', { type: 'button', class: 'dm-list-item', 'data-issue': tp.guid, 'aria-current': s.selected === tp.guid ? 'true' : 'false', onclick: () => choose(tp) },
              h('dm-badge', Object.assign({ text: tp.topic_status || t('issues.status.none') }, badgeKind(tp.topic_status) ? { kind: badgeKind(tp.topic_status) } : {})),
              h('span', { class: 'dm-list-main' }, h('span', { text: `${tp.server_assigned_id ? tp.server_assigned_id + ' ' : ''}${tp.title || ''}` }),
                h('span', { class: 'dm-list-sub', text: [tp.topic_type, tp.assigned_to, ids.length ? t('issues.elements.n', { n: i18n.formatNumber(ids.length) }) : ''].filter(Boolean).join(' · ') }))));
          })));
          if (s.topics.length > 200) parts.push(h('p', { class: 'dm-help dm-small', text: t('issues.more', { n: i18n.formatNumber(s.topics.length - 200) }) }));
        }
        const chosen = current();
        if (chosen) parts.push(detail(chosen));
        replace(el, ...parts);
      }
      /** One comment: who and when, whom it answers, the text, and in BCF API 2.1 the way to answer it. */
      function commentItem(c, canAnswer) {
        const answered = c.reply_to_comment_guid ? s.comments.find((x) => x.guid === c.reply_to_comment_guid) : null;
        return h('li', { class: 'dm-small', 'data-issue-comment-item': c.guid || '' },
          h('span', { class: 'dm-help', text: `${c.author || ''} · ${c.date ? i18n.formatDateTime(c.date) : ''}: ` }),
          answered ? h('span', { class: 'dm-help', 'data-issue-reply-to': '', text: t('issues.comment.reply.to', { author: answered.author || '' }) + ' ' }) : null,
          h('span', { text: c.comment || '' }),
          canAnswer ? [' ', h('button', { type: 'button', class: 'dm-link', title: t('issues.comment.reply.hint'), 'data-issue-reply': c.guid || '', text: t('issues.comment.reply'), onclick: () => { s.replyTo = c.guid; render(); } })] : null);
      }
      function detail(chosen) {
        const canAnswer = opencde.bcfVersion(s.connector) === '2.1' && may('topic', 'createComment');
        const answering = s.replyTo ? s.comments.find((x) => x.guid === s.replyTo) : null;
        const nodes = [
          h('strong', { text: chosen.title || '' }),
          chosen.description ? h('p', { class: 'dm-small', text: chosen.description }) : null,
          h('p', { class: 'dm-help dm-small', text: [chosen.creation_author, chosen.creation_date ? i18n.formatDateTime(chosen.creation_date) : '', chosen.priority, chosen.stage, Array.isArray(chosen.labels) ? chosen.labels.join(', ') : '', chosen.assigned_to ? t('issues.assigned', { who: chosen.assigned_to }) : '', chosen.due_date ? t('issues.due', { date: String(chosen.due_date).slice(0, 10) }) : ''].filter(Boolean).join(' · ') }),
          s.snapshot ? h('img', { class: 'dm-model-issue-snapshot', src: s.snapshot, alt: t('issues.snapshot') }) : null,
          s.comments.length ? h('ul', { class: 'dm-stack-xs' }, s.comments.map((c) => commentItem(c, canAnswer))) : h('p', { class: 'dm-help dm-small', text: t('issues.comments.none') }),
        ];
        if (may('topic', 'createComment')) {
          const box = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '2', 'aria-label': t('issues.comment.write'), placeholder: t('issues.comment.write') }));
          box.value = s.comment;
          box.addEventListener('input', () => { s.comment = box.value; });
          nodes.push(h('div', { class: 'dm-stack-xs', 'data-issue-comment': '' }, answering ? h('p', { class: 'dm-help dm-small', 'data-issue-answering': '' }, t('issues.comment.reply.to', { author: answering.author || '' }), ' ', h('button', { type: 'button', class: 'dm-link', text: t('common.cancel'), onclick: () => { s.replyTo = ''; render(); } })) : null, box, h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('issues.comment.send'), icon: 'message-square', size: 'sm', loading: s.busy === 'write', onClick: sendComment }))));
        }
        const statuses = (s.ext && s.ext.topic_status) || [];
        if (may('topic', 'update') && statuses.length) {
          const sel = /** @type {any} */ (h('dm-select', { 'aria-label': t('issues.field.topic_status'), inline: true, 'data-issue-status': '' }));
          sel.options = statuses.map((v) => ({ value: v, label: v }));
          sel.value = chosen.topic_status || statuses[0];
          sel.addEventListener('change', () => setStatus(sel.value));
          nodes.push(h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-small', text: t('issues.status.change') }), sel));
        }
        if (may('topic', 'createViewpoint') && hooks.view) nodes.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('issues.viewpoint.add'), icon: 'scan-line', size: 'sm', loading: s.busy === 'write', title: t('issues.viewpoint.add.hint'), 'data-issue-viewpoint': '', onClick: addViewpoint })));
        return h('div', { class: 'dm-card dm-stack-xs', 'data-issue-detail': '' }, nodes);
      }
      function destroy() { alive = false; clearSnapshot(); if (hooks.setColors) hooks.setColors([]); }

      return { el, start, load, choose, newTopic, sendComment, setStatus, saveBcf, saveTable, saveChart, currentColors, destroy, state: s };
    }

    return { create, badgeKind };
  });
})();
