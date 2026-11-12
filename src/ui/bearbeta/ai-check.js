// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The findings of "Kontrollera med AI" (decision F44 a) in the AI panel: one row per finding (title, condition and priority, the element,
 * the photo and the recommended action) and three actions, each the person's own. *Spara fynden som tabell* makes a new table dataset with
 * one finding per row; *Exportera som BCF* downloads a BCF 3.0 file with one topic per finding; and for a model fetched from a server the
 * person is signed in to, *Skapa ärenden på servern* creates the same topics in the model's project after the sharing review. A finding's
 * topic has a viewpoint whose camera frames the element (when the model view has drawn it, `bounds`), with the element selected and
 * coloured and, when the model view can draw one (`pictures`), a picture of the model from that camera as the snapshot. The site photo is
 * not the viewpoint's picture: it goes with the topic as a document (BCF's documents in the file; a project document and a document
 * reference on the server, or a viewpoint of its own with only the photo when the server does not let the person add documents). Under
 * *Fler alternativ* the person may give the topics a status, an assignee, a responsible party (a label), a stage and a due date, from the
 * project's own lists on a server. A topic on a server is tied to the model's file when the server allows it. A finding that fails is
 * skipped and reported, and the next press sends what is left. A server's own priorities and topic types are matched by their words, and
 * left out when none fits, since the server checks them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/ai-check', ['ui/base', 'ui/basic', 'ui/overlays', 'ai/check-tools', 'data/datasets', 'data/bcf-xml', 'data/exif', 'api/connectors', 'api/families/opencde', 'platform/files', 'viz/theme', 'data/comments', 'ui/bearbeta/issue-fields'],
    (base, basic, overlays, checkTools, datasets, bcfXml, exif, connectors, opencde, files, theme, comments, issueFields) => {
      const { h, t, i18n } = base;
      /** Badge colours: the worse the condition or the sooner the action, the stronger. */
      const KIND = { good: 'ok', fair: 'accent', poor: 'warn', critical: 'error', low: null, medium: 'accent', high: 'warn', urgent: 'error' };
      /** The priorities of a BCF file: the words Dataregium's projects use by default. */
      const BCF_PRIORITY = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Critical' };
      /** A server's own priorities, matched by their words in the seven languages and the usual English ones. */
      const PRIORITY_WORDS = { low: /low|minor|låg|lav|matala|lítil/i, medium: /medium|normal|medel|middel|keski|miðl/i, high: /high|major|hög|høj|høy|høg|korkea|mikil|hár/i, urgent: /urgent|critical|akut|kritisk|kiire|kriitt|brýn/i };
      /** The topic type of a finding on a server: an inspection when the project has one, an issue otherwise. */
      const TOPIC_TYPES = [/inspection|besiktning|kontroll|inspektion|tarkast|skoðun/i, /issue|ärende|defect|fault|sag|sak|asia|mál/i];
      /** The topic type and status of a finding in a BCF file when the person chooses no status. */
      const FILE_TYPE = 'Inspection';
      const FILE_STATUS = 'Open';
      /** The fields the person may give the topics under Fler alternativ. */
      const FIELDS = ['topic_status', 'assigned_to', 'responsible', 'stage', 'due_date'];
      /** Without a drawn model the camera looks at a building-sized box at the model's origin, for a server that wants a camera with the selection. */
      const AROUND_ORIGIN = { min: [-10, -10, 0], max: [10, 10, 6] };
      const bytesOf = (b64) => Uint8Array.from(atob(String(b64)), (c) => c.charCodeAt(0));
      /** Bytes as base64, in slices so that a large picture does not overflow the call stack. */
      function base64Of(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
        return btoa(s);
      }
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
      /** The colour a finding's element gets in its viewpoint: the theme's colour for how soon it should be dealt with. */
      function colorFor(priority) {
        const tk = theme.tokens();
        const kind = KIND[priority];
        return (kind && tk[kind]) || tk.accent;
      }

      /**
       * @param {any} _ctx shell context
       * @param {{datasetId: string, findings: () => {findings: any[]}, render: () => void, fail: (err: any) => void, log: (msg: string, kind?: string) => void, busy?: () => boolean,
       *   bounds?: (ids: number[]) => ({min: number[], max: number[]}|null), pictures?: (shots: Array<{viewpoint: any, selected: number[], colors: Array<{color: string, ids: number[]}>}>) => Promise<string[]>}} options
       */
      function create(_ctx, options) {
        const s = { busy: '', server: null, saved: null, sent: null, failed: [], fields: {}, ext: null, extBusy: false, more: false };
        const list = () => { const c = options.findings(); return c && Array.isArray(c.findings) ? c.findings : []; };
        const blocked = () => !!s.busy || !!(options.busy && options.busy());
        const done = (msg) => { options.log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 }); };

        /** The server the model came from, when the person is signed in to it: the topics go to the model's project there. */
        async function load(meta) {
          s.server = null; s.ext = null;
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
        /**
         * A finding's view: a camera on the element (or on the model's origin) with the element selected and coloured, and the photo,
         * without what its file can say about where and by whom it was taken (a picture the browser could not shrink keeps its EXIF).
         * Null when there is neither an element nor a photo.
         */
        function viewOf(f) {
          const box = boxOf(f);
          const photo = f.picture && /^image\/(jpeg|png)$/.test(f.picture.mediaType) ? { mediaType: f.picture.mediaType, bytes: exif.strip(bytesOf(f.picture.data)), name: f.photoName || (f.picture.mediaType === 'image/png' ? 'photo.png' : 'photo.jpg') } : null;
          if (!box && !f.elementGuid && !photo) return null;
          let viewpoint = null;
          if (box || f.elementGuid) viewpoint = { perspective_camera: bcfXml.cameraOfBox(box || AROUND_ORIGIN) };
          const color = colorFor(f.priority);
          if (viewpoint && f.elementGuid) {
            const component = { ifc_guid: f.elementGuid, originating_system: 'Dataspatium' };
            viewpoint.components = { selection: [component], coloring: [{ color: bcfXml.colorOf(color) || 'C0392B', components: [component] }], visibility: { default_visibility: true } };
          }
          return { viewpoint, photo, color };
        }
        /**
         * Pictures of the model from each finding's camera, with its element coloured, from the model view (`pictures`), within BCF's
         * 1500 px; null for a finding without a camera, and all null when the view cannot draw.
         * @returns {Promise<Array<{bytes: Uint8Array, type: string, base64: string, snapshotType: string}|null>>}
         */
        async function modelPictures(found) {
          const views = found.map((f) => viewOf(f));
          const wanted = found.map((f, i) => (views[i] && views[i].viewpoint ? i : -1)).filter((i) => i >= 0);
          const out = found.map(() => null);
          if (!options.pictures || !wanted.length) return out;
          try {
            const shots = wanted.map((i) => ({ viewpoint: views[i].viewpoint, selected: found[i].elementId ? [found[i].elementId] : [], colors: found[i].elementId ? [{ color: views[i].color, ids: [found[i].elementId] }] : [] }));
            const urls = await options.pictures(shots);
            for (const [k, i] of wanted.entries()) out[i] = urls && urls[k] ? await bcfXml.fitDataUrl(urls[k]) : null;
          } catch (err) { D.log('ai-check', 'pictures', err); }
          return out;
        }
        /** The words of a finding's topic: what the AI saw, the condition and the priority, the action, the element and the photo. */
        function descriptionOf(f, places = true) {
          const element = checkTools.elementText(f);
          const where = places && Number.isFinite(f.lat) && Number.isFinite(f.lon) ? t('ai.build.caption.where', { lat: f.lat.toFixed(5), lon: f.lon.toFixed(5) }) : '';
          return [f.description,
            `${t('ai.check.badge.condition', { condition: word('ai.check.condition', f.condition) })} · ${t('ai.check.badge.priority', { priority: word('ai.check.priority', f.priority) })}`,
            f.action ? t('ai.check.action', { action: f.action }) : '',
            element ? t('ai.check.element', { element: f.elementGuid && f.elementGuid !== element ? `${element} (${f.elementGuid})` : element }) : '',
            f.photoName ? t('ai.check.photo', { name: [f.photoName, where].filter(Boolean).join(', ') }) : ''].filter(Boolean).join('\n');
        }
        /** The fields the person chose under Fler alternativ (or a caller's), as a topic's fields. */
        function chosen(given) {
          if (given) return given;
          const out = {};
          const v = (k) => String(s.fields[k] || '').trim();
          for (const k of ['topic_status', 'assigned_to', 'stage']) if (v(k)) out[k] = v(k);
          if (v('responsible')) out.labels = [v('responsible')];
          const due = bcfXml.dateTime(v('due_date'));
          if (due) out.due_date = due;
          return out;
        }
        const topicOf = (f, now, fields, author) => Object.assign({ guid: bcfXml.newGuid(), title: f.title.slice(0, 255), description: descriptionOf(f), priority: BCF_PRIORITY[f.priority], topic_type: FILE_TYPE, topic_status: FILE_STATUS, creation_date: now, creation_author: author }, fields);
        const photoText = (f) => t('ai.check.photo.document', { name: f.photoName || '' });

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
        /**
         * The findings as a BCF 3.0 file, one topic per finding, offered as a download (the person's action): the model's file in the
         * header, a viewpoint on the element with a picture of the model, the photo as a document, and the chosen fields.
         * @param {{fields?: any}} [opts] `fields` instead of the ones chosen under Fler alternativ (a test, a command)
         */
        async function exportBcf(opts = {}) {
          const found = list();
          if (!found.length || blocked()) return null;
          s.busy = 'bcf'; options.render();
          let blob = null;
          try {
            const meta = await datasets.get(options.datasetId);
            const name = meta ? meta.name : '';
            const now = new Date().toISOString();
            const header = bcfXml.headerOf(meta);
            const author = bcfXml.authorOf(s.server ? await opencde.identity(s.server.connector) : null, await comments.author());
            const fields = chosen(opts.fields);
            const pictures = await modelPictures(found);
            const items = found.map((f, i) => {
              const view = viewOf(f);
              const viewpoints = view && view.viewpoint ? [{ viewpoint: Object.assign({ guid: bcfXml.newGuid() }, view.viewpoint), snapshot: pictures[i] ? { bytes: pictures[i].bytes, type: pictures[i].type } : null }] : [];
              const documents = view && view.photo ? [{ filename: view.photo.name, description: photoText(f), bytes: view.photo.bytes }] : [];
              return { topic: topicOf(f, now, fields, author), comments: [], header, viewpoints, documents };
            });
            const cde = meta && meta.source && meta.source.cde;
            blob = await bcfXml.write(items, Object.assign({ author }, cde && cde.projectId ? { projectName: String(cde.projectName || name), projectId: String(cde.projectId) } : { projectName: name }));
            files.download(blob, files.safeName(`${t('ai.check.title')} ${name}`.trim(), 'bcfzip'));
            done(t('ai.check.bcf.saved', { n: i18n.formatNumber(found.length) }));
          } catch (err) { options.fail(err); blob = null; }
          s.busy = ''; options.render();
          return blob;
        }
        const failedText = () => t('ai.check.server.failed', { n: i18n.formatNumber(s.failed.length), errors: s.failed.slice(0, 5).map((x) => `${x.n}. ${x.title}: ${x.error}`).join('; ') + (s.failed.length > 5 ? ' …' : '') });
        /** Through the sharing review, as everything that leaves the app: the photos' positions stay out of the topics unless kept. */
        async function confirmSend(todo, server) {
          const places = todo.filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon)).length;
          return D.require('ui/share/review').material(_ctx, { kind: 'findings', pictures: todo.length, places, server: server.connector.name, project: server.project });
        }
        /** The chosen fields a server takes: only values from its own lists (it refuses others). */
        function fieldsFor(fields, ext) {
          const out = {};
          const allowed = (key, v) => Array.isArray(ext[key]) && ext[key].includes(v);
          if (fields.topic_status && allowed('topic_status', fields.topic_status)) out.topic_status = fields.topic_status;
          if (fields.assigned_to && allowed('users', fields.assigned_to)) out.assigned_to = fields.assigned_to;
          if (fields.stage && allowed('stage', fields.stage)) out.stage = fields.stage;
          const labels = (fields.labels || []).filter((l) => allowed('topic_label', l));
          if (labels.length) out.labels = labels;
          if (fields.due_date) out.due_date = fields.due_date;
          return out;
        }
        /**
         * One BCF topic per finding on the server the model came from, after the person's confirmation: the topic with the chosen fields,
         * a viewpoint of the element with a picture of the model, the photo as a project document with a reference (or as a viewpoint of
         * its own), and the model's file in the topic's header when the server allows it. A finding that fails is skipped and reported;
         * the next press does only what is left of it.
         * @param {{confirmed?: boolean, places?: boolean, fields?: any}} [opts]
         * @returns {Promise<{made: number, failed: Array<{n: number, title: string, error: string}>}|null>}
         */
        async function createIssues(opts = {}) {
          const server = s.server;
          const todo = list().filter((f) => !f.issued);
          if (!server || !todo.length || blocked()) return null;
          // Confirmed by the caller (a test, a command): positions only when it says so.
          const choice = opts.confirmed ? { places: opts.places === true ? 'keep' : 'drop' } : await confirmSend(todo, server);
          if (!choice) return null;
          const places = choice.places === 'keep';
          s.busy = 'server'; s.failed = []; options.render();
          let made = 0;
          try {
            if (!opencde.signedIn(server.connector)) throw new Error(t('ai.check.server.signin', { server: server.connector.name }));
            const projectId = server.cde.projectId;
            const ext = (await opencde.extensions(server.connector, projectId).catch(() => null)) || {};
            const type = typeOn(ext.topic_type);
            const fields = fieldsFor(chosen(opts.fields), ext);
            const meta = await datasets.get(options.datasetId);
            const file = await opencde.modelFile(server.connector, projectId, server.cde, bcfXml.headerOf(meta)[0]).catch(() => null);
            const pictures = await modelPictures(todo);
            for (const [i, f] of todo.entries()) {
              try {
                if (!f.topicGuid) {
                  const body = Object.assign({ title: f.title.slice(0, 255), description: descriptionOf(f, places) }, fields);
                  if (type) body.topic_type = type;
                  const priority = priorityOn(f.priority, ext.priority);
                  if (priority) body.priority = priority;
                  const topic = await opencde.createTopic(server.connector, projectId, body);
                  if (!topic || !topic.guid) throw new Error(t('api.err.service', { message: server.connector.name }));
                  f.topicGuid = String(topic.guid);
                }
                const view = viewOf(f);
                if (view && view.viewpoint && !f.viewSent) {
                  const picture = pictures[i];
                  await opencde.createViewpoint(server.connector, projectId, f.topicGuid, Object.assign({}, view.viewpoint, picture ? { snapshot: { snapshot_type: picture.snapshotType, snapshot_data: picture.base64 } } : {}));
                  f.viewSent = true;
                }
                if (view && view.photo && !f.photoSent) {
                  const photoFile = new File([view.photo.bytes], view.photo.name, { type: view.photo.mediaType });
                  const attached = await opencde.attachDocument(server.connector, projectId, f.topicGuid, photoFile, photoText(f), ext);
                  // Without the right to add documents the photo goes as a viewpoint with only its picture, which BCF allows.
                  if (!attached) {
                    const fitted = await bcfXml.fitSnapshot({ bytes: view.photo.bytes, type: view.photo.mediaType });
                    await opencde.createViewpoint(server.connector, projectId, f.topicGuid, { snapshot: { snapshot_type: fitted.type === 'image/png' ? 'png' : 'jpg', snapshot_data: base64Of(fitted.bytes) } });
                  }
                  f.photoSent = true;
                }
                if (file && !f.linked) {
                  try { await opencde.linkTopic(server.connector, projectId, { guid: f.topicGuid }, ext, file); } catch (err) { options.log(t('issues.files.failed', { message: String((err && err.message) || err) }), 'warn'); }
                  f.linked = true;
                }
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
        /** The project's lists for the fields, asked when the person opens Fler alternativ for a model from a server. */
        async function loadLists() {
          if (!s.server || s.ext || s.extBusy) return;
          s.extBusy = true; options.render();
          try { s.ext = (await opencde.extensions(s.server.connector, s.server.cde.projectId)) || {}; } catch (err) { options.fail(err); }
          s.extBusy = false; options.render();
        }
        /** Fler alternativ: the fields of the topics, from the project's lists on a server and as free text for a file. */
        function more() {
          const box = h('details', { class: 'dm-more', 'data-ai-check-more': '' }, h('summary', { text: t('common.more') }));
          if (s.more) box.setAttribute('open', '');
          // A details element drawn open fires toggle too, so only a change counts.
          box.addEventListener('toggle', () => {
            const open = box.hasAttribute('open');
            if (open === s.more) return;
            s.more = open;
            if (open && s.server && !s.ext) loadLists(); else options.render();
          });
          if (!s.more) return box;
          if (s.server && !s.ext) { box.append(h('p', { class: 'dm-help dm-xs', text: s.extBusy ? t('ai.check.fields.loading') : t('ai.check.fields.none') })); return box; }
          const form = issueFields.create(s.server ? s.ext : null, { fields: FIELDS, initial: s.fields });
          for (const [name, input] of Object.entries(form.inputs)) {
            const keep = () => { s.fields[name] = String(input.value || ''); };
            input.addEventListener('change', keep); input.addEventListener('input', keep);
          }
          box.append(h('p', { class: 'dm-help dm-xs', text: s.server ? t('ai.check.fields.server') : t('ai.check.fields.file') }), h('div', { class: 'dm-stack-sm' }, ...form.nodes));
          return box;
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
            found.length ? more() : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('ai.check.save'), icon: 'table', size: 'sm', loading: s.busy === 'table', disabled: off, title: t('ai.check.save.hint'), 'data-ai-check-save': '', onClick: () => save() }),
              basic.button({ label: t('ai.check.bcf'), icon: 'download', size: 'sm', loading: s.busy === 'bcf', disabled: off, title: t('ai.check.bcf.hint'), 'data-ai-check-bcf': '', onClick: () => exportBcf() }),
              s.server ? basic.button({ label: t('ai.check.server'), icon: 'message-square', size: 'sm', loading: s.busy === 'server', disabled: off || !found.some((f) => !f.issued), title: t('ai.check.server.hint'), 'data-ai-check-server': '', onClick: () => createIssues() }) : null),
            s.saved ? h('p', { class: 'dm-help dm-xs', 'data-ai-check-saved': s.saved.id, text: t('ai.check.table.saved', { name: s.saved.name }) }) : null,
            s.sent && s.sent.made ? h('p', { class: 'dm-help dm-xs', 'data-ai-check-sent': String(s.sent.made), text: t('ai.check.server.done', { n: i18n.formatNumber(s.sent.made), project: s.sent.project }) }) : null,
            s.failed.length ? h('p', { class: 'dm-error dm-small', 'data-ai-check-failed': String(s.failed.length), text: failedText() }) : null);
        }
        return { state: s, load, view, save, exportBcf, createIssues, viewOf, descriptionOf, loadLists };
      }
      return { create, columns, rowOf, BCF_PRIORITY };
    });
})();
