// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The findings of "Kontrollera med AI" (decision F44 a) in the AI panel: one row per finding (title, condition and priority, the element,
 * the photo and the recommended action) and three actions, each the person's own. *Spara fynden som tabell* makes a new table dataset with
 * one finding per row; *Exportera som BCF* downloads a BCFzip with one topic per finding, the photo as its viewpoint's snapshot and the
 * element's GlobalId selected; and for a model fetched from a server the person is signed in to, *Skapa ärenden på servern* creates the
 * same topics in the model's project after a confirmation that names their number and the project. A finding that fails is skipped and
 * reported, and the next press sends what is left. A viewpoint's camera frames the element when the model view has drawn it (`bounds`);
 * a server's own priorities and topic types are matched by their words, and left out when none fits, since the server checks them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/ai-check', ['ui/base', 'ui/basic', 'ui/overlays', 'ai/check-tools', 'data/datasets', 'data/bcf-xml', 'api/connectors', 'api/families/opencde', 'platform/files'],
    (base, basic, overlays, checkTools, datasets, bcfXml, connectors, opencde, files) => {
      const { h, t, i18n } = base;
      /** Badge colours: the worse the condition or the sooner the action, the stronger. */
      const KIND = { good: 'ok', fair: 'accent', poor: 'warn', critical: 'error', low: null, medium: 'accent', high: 'warn', urgent: 'error' };
      /** The priorities of a BCF file: the words Dataregium's projects use by default. */
      const BCF_PRIORITY = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Critical' };
      /** A server's own priorities, matched by their words in the seven languages and the usual English ones. */
      const PRIORITY_WORDS = { low: /low|minor|låg|lav|matala|lítil/i, medium: /medium|normal|medel|middel|keski|miðl/i, high: /high|major|hög|høj|høy|høg|korkea|mikil|hár/i, urgent: /urgent|critical|akut|kritisk|kiire|kriitt|brýn/i };
      /** The topic type of a finding on a server: an inspection when the project has one, an issue otherwise. */
      const TOPIC_TYPES = [/inspection|besiktning|kontroll|inspektion|tarkast|skoðun/i, /issue|ärende|defect|fault|sag|sak|asia|mál/i];
      /** Without a drawn model the camera looks at a building-sized box at the model's origin, for a server that wants a camera with the selection. */
      const AROUND_ORIGIN = { min: [-10, -10, 0], max: [10, 10, 6] };
      const bytesOf = (b64) => Uint8Array.from(atob(String(b64)), (c) => c.charCodeAt(0));
      const word = (prefix, value) => t(prefix + '.' + value);
      /** The table's columns; condition and priority are codes with their words as value labels. */
      function columns() {
        const labels = (prefix, codes) => ({ values: 'codes', labels: codes.map((c) => [c, word(prefix, c)]) });
        return [{ name: 'foto', type: 'text' }, { name: 'element_id', type: 'integer' }, { name: 'element_guid', type: 'text' }, { name: 'titel', type: 'text' }, { name: 'beskrivning', type: 'text' },
          { name: 'skick', type: 'text', valueLabels: labels('ai.check.condition', checkTools.CONDITIONS) }, { name: 'prioritet', type: 'text', valueLabels: labels('ai.check.priority', checkTools.PRIORITIES) },
          { name: 'atgard', type: 'text' }, { name: 'datum', type: 'date' }, { name: 'lat', type: 'number' }, { name: 'lon', type: 'number' }];
      }
      /** One finding as a row, in the order of the columns. @param {any} f */
      const rowOf = (f) => [f.photoName, f.elementId, f.elementGuid, f.title, f.description, f.condition, f.priority, f.action, f.date, f.lat, f.lon];
      /** A word of a server's own list that names a level, or nothing. */
      const priorityOn = (level, allowed) => (Array.isArray(allowed) ? allowed.find((x) => PRIORITY_WORDS[level].test(String(x))) || null : null);
      function typeOn(allowed) {
        for (const re of TOPIC_TYPES) { const hit = Array.isArray(allowed) ? allowed.find((x) => re.test(String(x))) : null; if (hit) return hit; }
        return null;
      }

      /**
       * @param {any} _ctx shell context
       * @param {{datasetId: string, findings: () => {findings: any[]}, render: () => void, fail: (err: any) => void, log: (msg: string, kind?: string) => void, busy?: () => boolean, bounds?: (ids: number[]) => ({min: number[], max: number[]}|null)}} options
       */
      function create(_ctx, options) {
        const s = { busy: '', server: null, saved: null, sent: null, failed: [] };
        const list = () => { const c = options.findings(); return c && Array.isArray(c.findings) ? c.findings : []; };
        const blocked = () => !!s.busy || !!(options.busy && options.busy());
        const done = (msg) => { options.log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 }); };

        /** The server the model came from, when the person is signed in to it: the topics go to the model's project there. */
        async function load(meta) {
          s.server = null;
          const m = meta || (await datasets.get(options.datasetId));
          const cde = m && m.source && m.source.cde;
          if (!cde || !cde.connectorId || !cde.projectId) return;
          const c = await connectors.get(cde.connectorId).catch(() => null);
          if (c && opencde.isOpenCde(c) && opencde.signedIn(c)) s.server = { cde, connector: c, project: String(cde.projectName || cde.projectId) };
        }
        function boxOf(f) {
          if (!f.elementId || !options.bounds) return null;
          try { return options.bounds([f.elementId]); } catch (_e) { return null; }
        }
        /** A finding's view: a camera on the element (or on the model's origin), the element selected, and the photo as the snapshot. */
        function viewOf(f) {
          const box = boxOf(f);
          const snapshot = f.picture && /^image\/(jpeg|png)$/.test(f.picture.mediaType) ? f.picture : null;
          if (!box && !f.elementGuid && !snapshot) return null;
          const viewpoint = {};
          if (box || f.elementGuid) viewpoint.perspective_camera = bcfXml.cameraOfBox(box || AROUND_ORIGIN);
          if (f.elementGuid) viewpoint.components = { selection: [{ ifc_guid: f.elementGuid, originating_system: 'Dataspatium' }], visibility: { default_visibility: true } };
          return { viewpoint, snapshot };
        }
        /** The words of a finding's topic: what the AI saw, the condition and the priority, the action, the element and the photo. */
        function descriptionOf(f) {
          const element = checkTools.elementText(f);
          const where = Number.isFinite(f.lat) && Number.isFinite(f.lon) ? t('ai.build.caption.where', { lat: f.lat.toFixed(5), lon: f.lon.toFixed(5) }) : '';
          return [f.description,
            `${t('ai.check.badge.condition', { condition: word('ai.check.condition', f.condition) })} · ${t('ai.check.badge.priority', { priority: word('ai.check.priority', f.priority) })}`,
            f.action ? t('ai.check.action', { action: f.action }) : '',
            element ? t('ai.check.element', { element: f.elementGuid && f.elementGuid !== element ? `${element} (${f.elementGuid})` : element }) : '',
            f.photoName ? t('ai.check.photo', { name: [f.photoName, where].filter(Boolean).join(', ') }) : ''].filter(Boolean).join('\n');
        }
        const topicOf = (f, now) => ({ guid: bcfXml.newGuid(), title: f.title.slice(0, 255), description: descriptionOf(f), priority: BCF_PRIORITY[f.priority], topic_type: 'Inspection', topic_status: 'Open', creation_date: now, creation_author: '' });

        /** The findings as a new table dataset, one finding per row (the person's action). */
        async function save() {
          const found = list();
          if (!found.length || blocked()) return null;
          s.busy = 'table'; options.render();
          let made = null;
          try {
            const meta = await datasets.get(options.datasetId);
            const name = meta ? meta.name : '';
            made = await datasets.create({ name: t('ai.check.table.name', { name }), description: t('ai.check.table.description', { name, date: checkTools.today() }), columns: columns(), rows: found.map(rowOf), source: { kind: 'derived', from: options.datasetId, tool: 'ai-check' } });
            s.saved = { id: made.id, name: made.name };
            done(t('ai.check.table.saved', { name: made.name }));
          } catch (err) { options.fail(err); made = null; }
          s.busy = ''; options.render();
          return made;
        }
        /** The findings as a BCFzip, one topic per finding, offered as a download (the person's action). */
        async function exportBcf() {
          const found = list();
          if (!found.length || blocked()) return null;
          s.busy = 'bcf'; options.render();
          let blob = null;
          try {
            const meta = await datasets.get(options.datasetId);
            const name = meta ? meta.name : '';
            const now = new Date().toISOString();
            const header = meta && meta.model && meta.model.file ? [{ filename: String(meta.model.file), date: now }] : [];
            const items = found.map((f) => {
              const view = viewOf(f);
              return { topic: topicOf(f, now), comments: [], header, viewpoints: view ? [{ viewpoint: Object.assign({ guid: bcfXml.newGuid() }, view.viewpoint), snapshot: view.snapshot ? { bytes: bytesOf(view.snapshot.data), type: view.snapshot.mediaType } : null }] : [] };
            });
            const cde = meta && meta.source && meta.source.cde;
            blob = await bcfXml.write(items, cde && cde.projectId ? { projectName: String(cde.projectName || name), projectId: String(cde.projectId) } : { projectName: name });
            files.download(blob, files.safeName(`${t('ai.check.title')} ${name}`.trim(), 'bcfzip'));
            done(t('ai.check.bcf.saved', { n: i18n.formatNumber(found.length) }));
          } catch (err) { options.fail(err); blob = null; }
          s.busy = ''; options.render();
          return blob;
        }
        const failedText = () => t('ai.check.server.failed', { n: i18n.formatNumber(s.failed.length), errors: s.failed.slice(0, 5).map((x) => `${x.n}. ${x.title}: ${x.error}`).join('; ') + (s.failed.length > 5 ? ' …' : '') });
        async function confirmSend(n, server) {
          const ok = await overlays.dialog.open({
            title: t('ai.check.server'), help: 'cad-bim#kontrollera-med-ai',
            body: h('p', { class: 'dm-help', text: t('ai.check.server.confirm', { n: i18n.formatNumber(n), project: server.project, server: server.connector.name }) }),
            actions: [{ label: t('common.cancel'), value: false }, { label: t('ai.check.server.send'), variant: 'primary', value: true, primary: true }],
          });
          return ok === true;
        }
        /**
         * One BCF topic per finding on the server the model came from, each with a viewpoint of the photo and the element, after the
         * person's confirmation. A finding that fails is skipped and reported; the next press sends the ones left, and a topic that was
         * made without its viewpoint only gets the viewpoint.
         * @param {{confirmed?: boolean}} [opts] @returns {Promise<{made: number, failed: Array<{n: number, title: string, error: string}>}|null>}
         */
        async function createIssues(opts = {}) {
          const server = s.server;
          const todo = list().filter((f) => !f.issued);
          if (!server || !todo.length || blocked()) return null;
          if (!opts.confirmed && !(await confirmSend(todo.length, server))) return null;
          s.busy = 'server'; s.failed = []; options.render();
          let made = 0;
          try {
            if (!opencde.signedIn(server.connector)) throw new Error(t('ai.check.server.signin', { server: server.connector.name }));
            const ext = (await opencde.extensions(server.connector, server.cde.projectId).catch(() => null)) || {};
            const type = typeOn(ext.topic_type);
            for (const f of todo) {
              try {
                if (!f.topicGuid) {
                  const body = { title: f.title.slice(0, 255), description: descriptionOf(f) };
                  if (type) body.topic_type = type;
                  const priority = priorityOn(f.priority, ext.priority);
                  if (priority) body.priority = priority;
                  const topic = await opencde.createTopic(server.connector, server.cde.projectId, body);
                  if (!topic || !topic.guid) throw new Error(t('api.err.service', { message: server.connector.name }));
                  f.topicGuid = String(topic.guid);
                }
                const view = viewOf(f);
                if (view) await opencde.createViewpoint(server.connector, server.cde.projectId, f.topicGuid, Object.assign({}, view.viewpoint, view.snapshot ? { snapshot: { snapshot_type: view.snapshot.mediaType === 'image/png' ? 'png' : 'jpg', snapshot_data: view.snapshot.data } } : {}));
                f.issued = true; made++;
              } catch (err) { s.failed.push({ n: f.n, title: f.title, error: String((err && err.message) || err) }); }
            }
            s.sent = { made: (s.sent ? s.sent.made : 0) + made, project: server.project };
            if (made) done(t('ai.check.server.done', { n: i18n.formatNumber(made), project: server.project }));
            if (s.failed.length) options.log(failedText(), 'error');
          } catch (err) { options.fail(err); }
          s.busy = ''; options.render();
          return { made, failed: s.failed.slice() };
        }

        function row(f) {
          const element = checkTools.elementText(f);
          const where = [element ? t('ai.check.element', { element }) : '', f.photoName ? t('ai.check.photo', { name: f.photoName }) : ''].filter(Boolean).join(' · ');
          return h('li', { class: 'dm-stack-xs', 'data-ai-check-finding': String(f.n), 'data-ai-check-condition': f.condition, 'data-ai-check-priority': f.priority },
            h('div', { class: 'dm-row-wrap' },
              h('strong', { class: 'dm-small', text: `${f.n}. ${f.title}` }),
              h('dm-badge', { kind: KIND[f.condition], text: t('ai.check.badge.condition', { condition: word('ai.check.condition', f.condition) }) }),
              h('dm-badge', { kind: KIND[f.priority], text: t('ai.check.badge.priority', { priority: word('ai.check.priority', f.priority) }) }),
              f.issued ? h('dm-badge', { kind: 'ok', text: t('ai.check.sent'), 'data-ai-check-issued': f.topicGuid || '' }) : null),
            f.description ? h('p', { class: 'dm-xs', text: f.description }) : null,
            where ? h('p', { class: 'dm-help dm-xs', text: where }) : null,
            f.action ? h('p', { class: 'dm-xs', text: t('ai.check.action', { action: f.action }) }) : null);
        }
        /** The list and its actions, under the answer. */
        function view() {
          const found = list();
          const off = !found.length || blocked();
          return h('div', { class: 'dm-stack-sm', 'data-ai-check': String(found.length) },
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('ai.check.title') }), h('span', { class: 'dm-help dm-xs', 'data-ai-check-count': '', text: t('ai.check.count', { n: i18n.formatNumber(found.length) }) })),
            found.length ? h('ol', { class: 'dm-list dm-stack-sm', 'data-ai-check-findings': '' }, found.map(row)) : h('p', { class: 'dm-help dm-xs', text: t('ai.check.empty') }),
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('ai.check.save'), icon: 'table', size: 'sm', loading: s.busy === 'table', disabled: off, title: t('ai.check.save.hint'), 'data-ai-check-save': '', onClick: () => save() }),
              basic.button({ label: t('ai.check.bcf'), icon: 'download', size: 'sm', loading: s.busy === 'bcf', disabled: off, title: t('ai.check.bcf.hint'), 'data-ai-check-bcf': '', onClick: () => exportBcf() }),
              s.server ? basic.button({ label: t('ai.check.server'), icon: 'message-square', size: 'sm', loading: s.busy === 'server', disabled: off || !found.some((f) => !f.issued), title: t('ai.check.server.hint'), 'data-ai-check-server': '', onClick: () => createIssues() }) : null),
            s.saved ? h('p', { class: 'dm-help dm-xs', 'data-ai-check-saved': s.saved.id, text: t('ai.check.table.saved', { name: s.saved.name }) }) : null,
            s.sent && s.sent.made ? h('p', { class: 'dm-help dm-xs', 'data-ai-check-sent': String(s.sent.made), text: t('ai.check.server.done', { n: i18n.formatNumber(s.sent.made), project: s.sent.project }) }) : null,
            s.failed.length ? h('p', { class: 'dm-error dm-small', 'data-ai-check-failed': String(s.failed.length), text: failedText() }) : null);
        }
        return { state: s, load, view, save, exportBcf, createIssues, viewOf, descriptionOf };
      }
      return { create, columns, rowOf, BCF_PRIORITY };
    });
})();
