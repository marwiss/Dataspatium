// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The panel "Fråga AI om modellen" in Bearbeta's model view (the inspector): choose a provider and the policy, ask a question about
 * the open IFC model, follow the tools the AI used, and mark the elements the answer rests on in the 3D view and the table. In the
 * mode Ändra the AI proposes changes through the write tools instead: they fill a change set that the person previews (the candidate
 * file drawn in 3D, new elements green and changed ones yellow, the schema findings listed) and approves or rejects. An approved
 * change set becomes the recipe step ifc_changeset, with undo and a new version of the model; deletions are confirmed once more. For a
 * model fetched from Dataregium the preview also asks the server's precheck (OB-28) of the candidate, when the source is signed in, and the
 * change set can go to the server as a change proposal: a BCF topic whose snippet holds the changes of existing instances in the
 * server's form (DataregiumIfcChangeSet), with the base version, the signed-in user and the AI model as its provenance; the server's
 * trial of the proposal against the base version (state, applied changes, findings) is shown under the topic, and a manager can make
 * a clean proposal the document's next version from here (OB-27 on the server's side); against a stale base the server retries the
 * trial on the latest version and merges what does not collide, and the person decides each collision here (base, what came between,
 * the proposal) before the proposal goes again (OB-19 d). The
 * keys live in api/secrets; nothing is sent without the consent for the provider's host. The dialog `providers` adds, changes and
 * removes providers (Anthropic Messages, OpenAI-compatible, local servers). The mode Bygg ur brief (decision F43 a) builds a whole
 * building in an empty model from a brief, with photos and scanned drawings attached as pictures, the AI's questions answered in the
 * panel, and the same preview and approval as Ändra. The mode Kontrollera (decision F44 a) tries an existing building's model against
 * photos and a field form's measurements with the same attachments: the findings are listed under the answer (ui/bearbeta/ai-check)
 * and each element's condition (Pset_Condition) is previewed and approved as in Ändra.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/ai-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'ai/providers', 'ai/agent', 'ai/write-tools', 'ai/check-tools', 'ui/bearbeta/ai-check', 'data/selection', 'data/recipes', 'data/ifc-ops', 'data/datasets', 'data/ifc-validation', 'api/connectors', 'api/families/opencde', 'platform/storage/idb'],
    (base, basic, overlays, icons, providers, agent, writeTools, checkTools, aiCheck, selection, recipes, ifcOps, datasets, validation, connectors, opencde, idb) => {
      const { h, t, i18n, replace } = base;
      const LAST_SETTING = 'ai.lastProvider';
      const MODES = ['ask', 'change', 'build', 'check'];
      const cssColor = (name) => ((globalThis.getComputedStyle ? getComputedStyle(document.documentElement).getPropertyValue(name) : '') || '').trim() || '#888888';

      /**
       * @param {any} ctx shell context
       * @param {{datasetId: string, mode?: string, brief?: string, onMarked?: Function, preview?: (preview: {bytes?: Uint8Array|null, colors?: Array<{color: string, ids: number[]}>}|null) => any, onApproved?: Function, bounds?: (ids: number[]) => ({min: number[], max: number[]}|null)}} options
       */
      function create(ctx, options) {
        const { shell } = ctx;
        const s = { providers: [], providerId: '', policy: 'ask', mode: MODES.includes(String(options.mode)) ? String(options.mode) : 'ask', question: options.brief ? String(options.brief) : '', busy: false, answer: '', steps: [], elements: [], usage: null, error: '', history: [], exchanges: [],
          changeset: writeTools.create(options.datasetId), preview: null, previewing: false, approving: false, proposing: false, proposed: null, cde: null, approvingServer: false,
          attachments: [], questionBox: null, picturesFrom: '', albums: [], factsFrom: '', tables: [],
          form: { building: '', storeys: '', length: '', width: '', height: '', foundation: '', roof: '' }, detail: 'main', nextLabel: 'photo', material: null, uploading: false, opsForm: null, heightsSource: false, factsHeights: false, canPropose: null, projectPolicy: undefined,
          findings: checkTools.create(options.datasetId) };
        const el = h('div', { class: 'dm-card dm-stack-sm', 'data-ai-panel': '' });
        let abort = null;
        const unsubscribe = providers.subscribe(() => load().then(render));
        const log = (msg, kind) => { if (shell && shell.log) shell.log(msg, kind || 'ok'); };
        const fail = (err) => { s.error = String((err && err.message) || err); log(`AI: ${s.error}`, 'error'); };
        const changing = () => s.mode === 'change' || s.mode === 'build' || s.mode === 'check';
        const building = () => s.mode === 'build';
        const checking = () => s.mode === 'check';
        // Pictures go with the brief and with a check (decision F44 a), each with its caption.
        const withPictures = () => building() || checking();
        const check = aiCheck.create(ctx, { datasetId: options.datasetId, findings: () => s.findings, bounds: options.bounds, busy: () => s.busy, log, fail: (err) => { fail(err); render(); }, render: () => render() });

        async function load() {
          s.providers = await providers.list();
          s.policy = await providers.policy();
          const all = await datasets.list();
          s.albums = all.filter((d) => d.kind === 'images');
          s.tables = all.filter((d) => d.id !== options.datasetId && (!d.kind || d.kind === 'table' || d.kind === 'plan'));
          const last = await idb.getSetting(LAST_SETTING, '');
          if (!s.providers.some((p) => p.id === s.providerId)) s.providerId = s.providers.some((p) => p.id === last) ? last : (s.providers[0] ? s.providers[0].id : '');
          // Lantmäteriet's terrain model can give the ground heights at a footprint's corners when its source is added (no call here).
          s.heightsSource = !!(await connectors.get('lantmateriet-stac').catch(() => null));
          // The brief and the pictures can go to the model's server as its material (F43 b, step 5) when the model came from one the person is signed in to.
          s.material = null;
          const meta = all.find((d) => d.id === options.datasetId) || (await datasets.get(options.datasetId));
          const cde = meta && meta.source && meta.source.cde;
          if (cde && cde.connectorId && cde.projectId && cde.documentId) {
            const c = await connectors.get(cde.connectorId).catch(() => null);
            if (c && opencde.isOpenCde(c) && opencde.signedIn(c)) s.material = { cde, connector: c, name: meta.name };
          }
          await check.load(meta);
        }
        /** Uploads the brief and the pictures as documents on the server, tied to the topic Underlag (data/model-material). */
        async function uploadMaterial() {
          const brief = s.question.trim();
          if (!s.material || s.uploading || (!brief && !s.attachments.length) || !D.has('data/model-material')) return;
          const project = s.material.cde.projectName || s.material.cde.projectId;
          // Through the sharing review, as everything that leaves the app: positions and times are dropped from the copy unless kept.
          const places = s.attachments.filter((a) => a.when || (a.where && Number.isFinite(a.where.lat))).length;
          const choice = await D.require('ui/share/review').material(ctx, { pictures: s.attachments.length, places, server: s.material.connector.name, project });
          if (!choice) return;
          s.uploading = true; s.error = ''; render();
          try {
            const out = await D.require('data/model-material').upload(s.material.connector, s.material.cde.projectId, s.material.cde.documentId, { brief, attachments: s.attachments, name: s.material.name }, { onStatus: (text) => log(String(text)), places: choice.places === 'keep' });
            const msg = t('material.done', { server: s.material.connector.name, title: String((out && out.topic && out.topic.title) || ''), n: i18n.formatNumber(out && out.documents ? out.documents.length : 0) });
            log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
          } catch (err) { fail(err); }
          s.uploading = false; render();
        }
        const provider = () => s.providers.find((p) => p.id === s.providerId) || null;
        async function askNow() {
          const p = provider();
          const brief = s.question.trim();
          // In the build mode the building's facts and the level of detail open the brief (decision F43 b); facts alone are enough to start.
          // A check may start from the photos alone.
          const question = building() ? [factsBlock(), brief].filter(Boolean).join('\n\n') : checking() && !brief ? t('ai.check.question.default') : brief;
          if (s.busy || !p || !(building() ? brief || factsGiven() : checking() ? brief || s.attachments.length : brief)) return;
          // A project that allows only local models (Dataregium's F29 a) refuses a cloud provider for its model, before anything is sent.
          if (s.material && !providers.isLocal(p.baseUrl)) {
            if (s.projectPolicy === undefined) s.projectPolicy = await opencde.aiPolicy(s.material.connector, s.material.cde.projectId).catch(() => null);
            if (s.projectPolicy === 'local') { s.error = t('ai.err.policy.project', { project: s.material.cde.projectName || s.material.cde.projectId, host: providers.hostOf(p.baseUrl) }); render(); return; }
          }
          s.busy = true; s.error = ''; s.answer = ''; s.steps = []; s.elements = []; s.usage = null; render();
          abort = new AbortController();
          try {
            const out = await agent.ask({ provider: p, datasetId: options.datasetId, question, history: s.history, changeset: changing() ? s.changeset : null, build: building(), check: checking(), findings: checking() ? s.findings : undefined, images: withPictures() ? s.attachments.map((a, i) => ({ mediaType: a.mediaType, data: a.data, caption: captionOf(a, i + 1), name: a.name, where: a.where, when: a.when })) : undefined, ask: building() ? askPerson : undefined, signal: abort.signal, onEvent: (ev) => { if (ev.type === 'tool') { s.steps.push(ev.step); renderSteps(); } } });
            s.answer = out.answer; s.steps = out.steps; s.elements = out.elements; s.usage = out.usage;
            // The next question continues the conversation, but only the words: the tool traffic is not carried on.
            s.history = s.history.concat([{ role: 'user', content: question }, { role: 'assistant', content: out.answer }]).slice(-10);
            s.exchanges.push({ question, answer: out.answer, elements: out.elements.length });
            if (changing()) {
              // A preview shows one change set; a changed set needs a new one.
              if (out.steps.some((step) => writeTools.has(step.name))) await dropPreview();
              log(t('ai.log.changes', { n: i18n.formatNumber(s.changeset.ops.length), tools: String(out.steps.length) }), out.stopped === 'answered' ? 'ok' : 'warn');
              if (checking()) log(t('ai.check.log', { n: i18n.formatNumber(s.findings.findings.length) }), 'ok');
            } else log(t('ai.log.answered', { tools: String(out.steps.length), input: i18n.formatNumber(out.usage.input), output: i18n.formatNumber(out.usage.output) }), out.stopped === 'answered' ? 'ok' : 'warn');
            await idb.setSetting(LAST_SETTING, p.id);
          } catch (err) { fail(err); }
          abort = null; s.busy = false; s.question = ''; render();
        }
        function cancel() { if (abort) abort.abort(); }
        // ---- build mode (decision F43 a): a question to the person, and pictures and drawings as the brief's material ----
        const MAX_IMAGES = 16; const MAX_SIDE = 1600; const MAX_PAGES = 8; const MAX_RAW_BYTES = 4 * 1024 * 1024;
        /** Bytes as base64 without a prefix, in slices so that a large picture does not overflow the call stack. */
        function base64Of(bytes) {
          let s = '';
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
          return btoa(s);
        }
        /** A question from the AI, shown in the panel until the person answers or closes it. */
        function askPerson(q) {
          return new Promise((resolve) => {
            s.questionBox = { q, resolve: (v) => { s.questionBox = null; resolve(v); render(); } };
            if (q.signal) q.signal.addEventListener('abort', () => { if (s.questionBox) s.questionBox.resolve(null); }, { once: true });
            render();
          });
        }
        /** A picture as a JPEG no larger than MAX_SIDE on its longer side, base64 without the prefix. */
        async function shrink(blob) {
          const bitmap = await createImageBitmap(blob);
          const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
          canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          bitmap.close();
          return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        }
        /** The pages of a scanned drawing as pictures, at most MAX_PAGES. */
        async function pdfPages(bytes, name) {
          const pdf = D.require('engines/pdf');
          await pdf.load();
          const doc = await pdf.open(bytes);
          const out = [];
          for (let pageNo = 1; pageNo <= Math.min(doc.numPages, MAX_PAGES); pageNo++) {
            const canvas = document.createElement('canvas');
            await pdf.render(doc, pageNo, canvas, { width: MAX_SIDE });
            out.push({ name: `${name} (${pageNo})`, mediaType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], label: 'drawing' });
          }
          return out;
        }
        async function attachFiles(fileList) {
          for (const f of Array.from(fileList || [])) {
            if (s.attachments.length >= MAX_IMAGES) break;
            try {
              if (/pdf$/i.test(String(f.type)) || /\.pdf$/i.test(String(f.name))) s.attachments = s.attachments.concat((await pdfPages(new Uint8Array(await f.arrayBuffer()), f.name)).slice(0, MAX_IMAGES - s.attachments.length));
              else if (/^image\//.test(String(f.type))) {
                const bytes = new Uint8Array(await f.arrayBuffer());
                const meta = /jpe?g$/i.test(String(f.type)) ? exifOf(bytes) : {};
                // A picture the browser cannot decode (an odd JPEG from a camera) still goes along as it is, up to MAX_RAW_BYTES.
                let picture = null;
                try { picture = { mediaType: 'image/jpeg', data: await shrink(new Blob([bytes], { type: f.type })) }; } catch (err) {
                  if (!/^image\/(jpeg|png|webp|gif)$/.test(String(f.type)) || bytes.length > MAX_RAW_BYTES) throw err;
                  picture = { mediaType: String(f.type), data: base64Of(D.require('data/exif').strip(bytes)) };
                }
                s.attachments.push(Object.assign({ name: f.name, label: s.nextLabel }, picture, meta));
              }
            } catch (err) { fail(err); }
          }
          render();
        }
        /** The pictures of an image collection (their previews), for example those taken with Dataspatium Mobil. */
        async function addPictures(datasetId) {
          if (!datasetId) return;
          const handle = await datasets.ensureOpen(datasetId);
          // The collection's own columns carry the position and the time of each picture (the images importer reads them from EXIF).
          const r = await handle.engine.exec('select fil, lat, lon, altitud, datum from data limit ' + MAX_IMAGES).catch(() => handle.engine.exec('select fil from data limit ' + MAX_IMAGES));
          const files = D.require('data/dataset-files');
          for (const row of (r[0] ? r[0].values : [])) {
            if (s.attachments.length >= MAX_IMAGES) break;
            const name = String(row[0]);
            const f = (await files.read(datasetId, name, 'preview').catch(() => null)) || (await files.read(datasetId, name, 'thumb').catch(() => null));
            if (!f) continue;
            const where = row[1] !== null && row[1] !== undefined && row[2] !== null && row[2] !== undefined && Number.isFinite(Number(row[1])) && Number.isFinite(Number(row[2]))
              ? { lat: Number(row[1]), lon: Number(row[2]), alt: row[3] === null || row[3] === undefined || !Number.isFinite(Number(row[3])) ? null : Number(row[3]) } : null;
            try { s.attachments.push(Object.assign({ name, mediaType: 'image/jpeg', data: await shrink(new Blob([f.bytes], { type: f.type })), label: s.nextLabel }, where ? { where } : null, row[4] ? { when: String(row[4]) } : null)); } catch (err) { fail(err); }
          }
          render();
        }
        /** Facts from a dataset into the brief (F43 b): a footprint from the map or measurements from a field form, as text. */
        async function addFacts(datasetId) {
          if (!datasetId) return;
          try {
            // The ground heights only when the person has turned them on: a call to Lantmäteriet with their key, after consent.
            const got = await D.require('ai/build-input').facts(datasetId, { heights: !!(building() && s.factsHeights && s.heightsSource) });
            s.question = (s.question ? s.question.replace(/\s+$/, '') + '\n\n' : '') + got.text;
            log(t('ai.build.facts.added', { name: got.name, n: i18n.formatNumber(got.rows), g: i18n.formatNumber(got.geometries) }), 'ok');
            if (got.heights) log(t('ai.build.facts.heights.added', { h: i18n.formatNumber(got.heights) }), 'ok');
            if (got.heightsError) log(t('ai.build.facts.heights.failed', { error: got.heightsError }), 'warn');
          } catch (err) { fail(err); }
          render();
        }
        // ---- the building's facts, the level of detail and the captions (decision F43 b: plain words, the ISO 19650 notions behind them) ----
        const FOUNDATIONS = ['slab', 'crawl', 'basement', 'piers']; const ROOFS = ['gable', 'hip', 'shed', 'flat', 'mansard'];
        const DETAILS = ['sketch', 'main', 'detailed']; const LABELS = ['photo', 'north', 'east', 'south', 'west', 'inside', 'drawing'];
        const factsGiven = () => Object.values(s.form).some((v) => String(v || '').trim());
        /** The building's facts and the level of detail as the opening of the brief. */
        function factsBlock() {
          const f = s.form; const parts = [];
          const add = (key) => { const v = String(f[key] || '').trim(); if (v) parts.push(`${t('ai.build.form.' + key)}: ${v}`); };
          ['building', 'storeys', 'length', 'width', 'height'].forEach(add);
          if (FOUNDATIONS.includes(f.foundation)) parts.push(`${t('ai.build.form.foundation')}: ${t('ai.build.foundation.' + f.foundation)}`);
          if (ROOFS.includes(f.roof)) parts.push(`${t('ai.build.form.roof')}: ${t('ai.build.roof.' + f.roof)}`);
          const level = DETAILS.includes(s.detail) ? s.detail : 'main';
          const lines = parts.length ? [t('ai.build.form.block', { facts: parts.join('; ') })] : [];
          lines.push(t('ai.build.detail.block', { level: t('ai.build.detail.' + level), text: t('ai.build.detail.' + level + '.text') }));
          return lines.join('\n');
        }
        /** The caption that goes before a picture: what it shows, and where and when it was taken when the file says so. */
        function captionOf(a, n) {
          const bits = [t('ai.build.caption', { n: String(n), label: t('ai.build.label.' + (LABELS.includes(a.label) ? a.label : 'photo')), name: String(a.name || '') })];
          if (a.when) bits.push(t('ai.build.caption.when', { when: String(a.when) }));
          if (a.where && Number.isFinite(a.where.lat) && Number.isFinite(a.where.lon)) {
            bits.push(t('ai.build.caption.where', { lat: a.where.lat.toFixed(5), lon: a.where.lon.toFixed(5) }));
            if (Number.isFinite(a.where.alt)) bits.push(t('ai.build.caption.alt', { alt: String(Math.round(a.where.alt)) }));
          }
          return bits.join(', ');
        }
        /** Position and time out of a JPEG's EXIF, for the caption; nothing when the file has none. */
        function exifOf(bytes) {
          try {
            const meta = D.require('data/exif').parse(bytes);
            const out = {};
            if (meta && Number.isFinite(meta.lat) && Number.isFinite(meta.lon)) out.where = { lat: meta.lat, lon: meta.lon, alt: Number.isFinite(meta.altitude) ? meta.altitude : null };
            if (meta && meta.dateTimeOriginal) out.when = meta.dateTimeOriginal;
            return out;
          } catch (_e) { return {}; }
        }
        function formView() {
          const field = (key, type) => {
            const el = /** @type {any} */ (h('dm-input', { label: t('ai.build.form.' + key), type: type || 'text', placeholder: key === 'building' ? t('ai.build.form.building.placeholder') : '', 'data-ai-form': key }));
            el.value = s.form[key];
            el.addEventListener('input', () => { s.form[key] = String(el.value || ''); });
            return el;
          };
          const choice = (key, prefix, keys) => basic.select(t('ai.build.form.' + key), [{ value: '', label: t('ai.build.form.unknown') }].concat(keys.map((k) => ({ value: k, label: t(prefix + k) }))), s.form[key], (v) => { s.form[key] = v; }, { 'data-ai-form': key });
          return h('div', { class: 'dm-stack-xs', 'data-ai-form-box': '' },
            h('strong', { class: 'dm-small', text: t('ai.build.form') }),
            h('p', { class: 'dm-help dm-xs', text: t('ai.build.form.hint') }),
            h('div', { class: 'dm-row-wrap' }, field('building'), field('storeys', 'number')),
            h('div', { class: 'dm-row-wrap' }, field('length', 'number'), field('width', 'number'), field('height', 'number')),
            h('div', { class: 'dm-row-wrap' }, choice('foundation', 'ai.build.foundation.', FOUNDATIONS), choice('roof', 'ai.build.roof.', ROOFS),
              basic.select(t('ai.build.detail'), DETAILS.map((k) => ({ value: k, label: t('ai.build.detail.' + k) })), s.detail, (v) => { s.detail = DETAILS.includes(v) ? v : 'main'; }, { 'data-ai-detail': '', title: t('ai.build.detail.hint') })));
        }
        function heightsSwitch() {
          const sw = /** @type {any} */ (h('dm-switch', { label: t('ai.build.facts.heights.switch'), title: t('ai.build.facts.heights.hint'), 'data-ai-facts-heights': '' }));
          sw.checked = !!s.factsHeights;
          sw.addEventListener('change', () => { s.factsHeights = !!sw.checked; });
          return sw;
        }
        function attachRow() {
          const input = /** @type {any} */ (h('input', { type: 'file', accept: 'image/*,.pdf', multiple: '', hidden: '', 'data-ai-attach-input': '' }));
          input.addEventListener('change', () => { attachFiles(input.files); input.value = ''; });
          const albums = s.albums || [];
          const pick = albums.length ? basic.select(t('ai.build.pictures'), [{ value: '', label: '–' }].concat(albums.map((a) => ({ value: a.id, label: a.name }))), s.picturesFrom, (v) => { s.picturesFrom = v; }) : null;
          const labelPick = basic.select(t('ai.build.label'), LABELS.map((k) => ({ value: k, label: t('ai.build.label.' + k) })), s.nextLabel, (v) => { s.nextLabel = LABELS.includes(v) ? v : 'photo'; }, { 'data-ai-label': '' });
          // A check sends the pictures with its question, not with a brief; the material and the ground heights belong to the brief.
          const hint = t(checking() ? 'ai.check.attach.hint' : 'ai.build.attach.hint');
          return h('div', { class: 'dm-stack-xs', 'data-ai-attachments': String(s.attachments.length) },
            h('div', { class: 'dm-row-wrap' },
              labelPick,
              basic.button({ label: t('ai.build.attach'), icon: 'images', size: 'sm', title: hint, 'data-ai-attach': '', onClick: () => input.click() }),
              pick, pick ? basic.button({ label: t('ai.build.pictures.add'), icon: 'image', size: 'sm', disabled: !s.picturesFrom, 'data-ai-pictures-add': '', onClick: () => addPictures(s.picturesFrom) }) : null, input,
              s.material && building() && D.has('data/model-material') ? basic.button({ label: t('ai.build.material'), icon: 'upload', size: 'sm', title: t('ai.build.material.hint'), loading: s.uploading, disabled: !s.question.trim() && !s.attachments.length, 'data-ai-material': '', onClick: uploadMaterial }) : null),
            s.tables.length ? h('div', { class: 'dm-row-wrap' },
              basic.select(t('ai.build.facts'), [{ value: '', label: '–' }].concat(s.tables.map((d) => ({ value: d.id, label: d.name }))), s.factsFrom, (v) => { s.factsFrom = v; }),
              basic.button({ label: t('ai.build.facts.add'), icon: 'table', size: 'sm', disabled: !s.factsFrom, title: t(checking() ? 'ai.check.facts.hint' : 'ai.build.facts.hint'), 'data-ai-facts-add': '', onClick: () => addFacts(s.factsFrom) }),
              s.heightsSource && building() ? heightsSwitch() : null) : null,
            s.attachments.length ? h('div', { class: 'dm-row-wrap' }, s.attachments.map((a, i) => h('dm-badge', { text: a.label && a.label !== 'photo' ? `${a.name} · ${t('ai.build.label.' + a.label)}` : a.name, title: t('ai.build.remove'), 'data-ai-attachment': a.name, 'data-ai-attachment-label': a.label || 'photo', onclick: () => { s.attachments.splice(i, 1); render(); } }))) : null,
            h('p', { class: 'dm-help dm-xs', text: s.attachments.length ? t(checking() ? 'ai.check.consent' : 'ai.build.consent', { n: i18n.formatNumber(s.attachments.length) }) : hint }));
        }
        function questionView() {
          const { q, resolve } = s.questionBox;
          const free = q.free ? /** @type {any} */ (h('dm-input', { label: t('ask.free') })) : null;
          return h('div', { class: 'dm-card dm-stack-sm dm-ask', 'data-ask': '' },
            h('p', { class: 'dm-ask-question', text: String(q.question || '').slice(0, 500) }),
            (q.options || []).slice(0, 6).map((o, i) => h('div', { class: 'dm-stack-sm dm-ask-option', 'data-ask-option': String(i) },
              basic.button({ label: String(o.label).slice(0, 80), title: o.description || o.label, onClick: () => resolve({ answer: o.label, index: i, free: false }) }),
              o.description ? h('p', { class: 'dm-help dm-small', text: String(o.description).slice(0, 200) }) : null)),
            free ? h('div', { class: 'dm-row-wrap dm-ask-free' }, free, basic.button({ label: t('ask.answer'), title: t('ask.answer.hint'), onClick: () => { const v = String(free.value || '').trim().slice(0, 500); if (v) resolve({ answer: v, index: null, free: true }); } })) : null,
            basic.button({ label: t('common.cancel'), variant: 'ghost', size: 'sm', title: t('assistant.question.cancel'), onClick: () => resolve(null) }));
        }
        /** The elements of the answer into the shared selection, which the 3D view and the table follow. */
        async function mark() {
          if (!s.elements.length) return;
          const made = await selection.setFromWhere(options.datasetId, `id in (${s.elements.map(Number).filter(Number.isFinite).join(', ')})`, [], t('ai.selection.label'));
          if (made && options.onMarked) options.onMarked(made);
          overlays.toast.show(made ? t('selection.made', { n: i18n.formatNumber(made.rowids.length) }) : t('selection.none'), { kind: made ? 'ok' : 'info' });
        }

        // ---- the change set ------------------------------------------------------------------------------------
        /** New elements green, changed ones yellow, for the 3D view. @param {any} report */
        function colorsOf(report) {
          const ids = (list) => (list || []).map((e) => Number(e.id)).filter(Number.isFinite);
          return [{ color: cssColor('--dm-ok'), ids: ids(report && report.created) }, { color: cssColor('--dm-warn'), ids: ids(report && report.changed) }].filter((g) => g.ids.length);
        }
        async function dropPreview() {
          const had = !!s.preview;
          s.preview = null; s.proposed = null;
          if (had && options.preview) await options.preview(null);
        }
        /** The change set on a copy of the model: the candidate drawn in 3D and the wheel's report shown. The dataset is untouched. */
        async function previewNow() {
          if (s.previewing || s.busy || !s.changeset.ops.length) return;
          s.previewing = true; s.error = ''; render();
          try {
            const out = await ifcOps.previewChangeset(options.datasetId, writeTools.toWheel(s.changeset));
            s.preview = { report: out.report || {}, bytes: out.bytes, server: null };
            if (options.preview) await options.preview({ bytes: out.bytes, colors: colorsOf(out.report) });
            await precheckOf(out.bytes);
          } catch (err) { fail(err); }
          s.previewing = false; render();
        }
        /** The server's precheck of the candidate, for a model fetched from a Dataregium the user is signed in to; its failure is a line, not an error. */
        async function precheckOf(bytes) {
          const meta = await datasets.get(options.datasetId);
          const cde = meta && meta.source && meta.source.cde;
          s.cde = cde && cde.connectorId && cde.projectId ? cde : null;
          if (!s.cde || !s.preview) return;
          const connector = await connectors.get(cde.connectorId);
          if (!connector || !opencde.isOpenCde(connector) || !opencde.signedIn(connector)) return;
          s.opsForm = await opencde.opsForm(connector).catch(() => null);
          // Dataregium's floor for proposing is the role editor (its F35 a): without it the button is not offered.
          s.canPropose = await opencde.canPropose(connector, cde.projectId).catch(() => true);
          const mine = s.preview;
          mine.server = { status: 'pending' }; render();
          try {
            const report = await opencde.precheck(connector, cde.projectId, bytes, (meta.model && meta.model.file) || 'model.ifc', { onStatus: () => {} });
            if (s.preview !== mine) return;
            mine.server = report ? { status: validation.STATUSES.includes(report.status) ? report.status : 'unknown', counts: validation.counts(report), report } : null;
          } catch (err) { if (s.preview === mine) mine.server = { status: 'failed', error: String((err && err.message) || err) }; }
          render();
        }
        /** The proposal's form: the changes of existing instances, and what only the description can tell. */
        const proposalOf = (report) => (report && report.proposal && Array.isArray(report.proposal.changes) ? report.proposal : null);
        function proposalText(proposal) {
          const un = proposal.unexpressed || {};
          const lines = [t('ai.change.propose.summary', { n: i18n.formatNumber(proposal.changes.length), m: i18n.formatNumber(Number(proposal.instances) || 0) })];
          if (s.opsForm && s.changeset.ops.length) lines.push(t('ai.change.propose.ops', { n: i18n.formatNumber(s.changeset.ops.length) }));
          else if (un.created || un.deleted || un.relations) lines.push(t('ai.change.propose.unexpressed', { created: i18n.formatNumber(un.created || 0), deleted: i18n.formatNumber(un.deleted || 0), relations: i18n.formatNumber(un.relations || 0) }));
          return lines.join(' ');
        }
        async function proposeDialog(defaults) {
          const title = /** @type {any} */ (h('dm-input', { label: t('ai.change.propose.topic'), 'data-ai-propose-title': '' }));
          title.value = defaults.title;
          const description = /** @type {any} */ (h('dm-input', { label: t('ai.change.propose.description'), rows: '6' }));
          description.value = defaults.description;
          const ok = await overlays.dialog.open({
            title: t('ai.change.propose.title'), help: 'cad-bim#ändra-med-ai',
            body: h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help', text: t('ai.change.propose.hint.dialog', { project: defaults.project }) }), title, description),
            actions: [{ label: t('common.cancel'), value: false }, { label: t('ai.change.propose.send'), variant: 'primary', value: true, primary: true }],
          });
          return ok === true ? { title: String(title.value || '').trim(), description: String(description.value || '') } : null;
        }
        /**
         * The previewed change set as a change proposal on Dataregium: a BCF topic with the attribute-level changes as its snippet in
         * the server's form, the base version and the signed-in user as provenance. The model is neither changed nor published.
         * @param {{title: string, description?: string}} [given] the words, when the dialog is not to ask
         */
        async function proposeNow(given) {
          const report = s.preview && s.preview.report;
          const proposal = proposalOf(report);
          const cde = s.cde;
          if (s.proposing || s.busy || !proposal || !cde) return;
          const withOps = !!s.opsForm && s.changeset.ops.length > 0;
          if (!proposal.changes.length && !withOps) { fail(new Error(t('ai.change.propose.none'))); render(); return; }
          const connector = await connectors.get(cde.connectorId);
          if (!connector) { fail(new Error(t('cde.err.noconnector', { host: cde.host }))); render(); return; }
          const project = cde.projectName || cde.projectId;
          const last = s.exchanges.length ? s.exchanges[s.exchanges.length - 1].question : '';
          const defaults = { project, title: (last || t('ai.change.title')).replace(/\s+/g, ' ').slice(0, 120), description: s.changeset.ops.map((op) => writeTools.describe(op)).join('\n') + '\n\n' + proposalText(proposal) };
          const values = given || await proposeDialog(defaults);
          if (!values) return;
          s.proposing = true; s.error = ''; render();
          try {
            if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
            const me = await opencde.currentUser(connector).catch(() => null);
            const ext = (await opencde.extensions(connector, cde.projectId).catch(() => null)) || {};
            const types = Array.isArray(ext.topic_type) ? ext.topic_type : [];
            const topicType = types.find((x) => /change|proposal|ändring|förslag|endring|forslag|ændring|muutos|ehdotus|breyting|tillaga/i.test(String(x))) || types[0] || null;
            const p = provider();
            const changeSet = {
              base: { document_id: String(cde.documentId || ''), version_index: Number(cde.versionIndex) || 1 },
              provenance: { user: String((me && (me.name || me.id)) || 'Dataspatium'), ai_model: p ? p.model : null, tool_call: s.changeset.ops.map((op) => op.tool).join(',').slice(0, 200) || null, created_at: new Date().toISOString() },
              changes: proposal.changes,
            };
            const out = await opencde.proposeChanges(connector, cde.projectId, { title: values.title || defaults.title, description: values.description || defaults.description, topicType, changeSet, ops: withOps ? await guidOps(writeTools.toWheel(s.changeset)) : undefined });
            if (!out) throw new Error(t('ai.change.propose.unsupported'));
            s.proposed = { guid: out.topic.guid, title: values.title || defaults.title, trial: out.tried ? { state: 'queued' } : null, approveUrl: out.approveUrl || null, approved: null,
              proposalUrl: out.proposalUrl || null, schemaUrl: out.schemaUrl, changeSet: out.changeSet || changeSet, details: null, picks: [] };
            const msg = t('ai.change.propose.done', { title: s.proposed.title, project });
            log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
            if (out.tried) trialOf(connector, out.proposalUrl, s.proposed);
          } catch (err) { fail(err); if (err && err.status === 403) s.error = t('ai.change.propose.role'); }
          s.proposing = false; render();
        }
        /** The operations with the model's GlobalIds for its STEP ids, read from the dataset's own table (decision F34 a at Dataregium). */
        async function guidOps(ops) {
          const ids = new Set();
          for (const op of ops) { for (const x of Array.isArray(op.ids) ? op.ids : []) if (Number.isInteger(x)) ids.add(x); if (Number.isInteger(op.wall_id)) ids.add(op.wall_id); }
          if (!ids.size) return ops;
          const map = new Map();
          const handle = await datasets.ensureOpen(options.datasetId);
          const list = Array.from(ids);
          for (let i = 0; i < list.length; i += 500) {
            const r = await handle.engine.exec(`select id, guid from data where id in (${list.slice(i, i + 500).join(',')})`);
            for (const row of (r[0] ? r[0].values : [])) if (row[1]) map.set(Number(row[0]), String(row[1]));
          }
          return writeTools.withGuids(ops, (id) => map.get(id) || null);
        }
        /** The server's trial of the proposal, polled until it is final; its failure is a line under the topic, not an error. */
        async function trialOf(connector, proposalUrl, mine) {
          try {
            const report = await opencde.proposalTrial(connector, proposalUrl, { onStatus: (state) => { if (s.proposed === mine) { mine.trial = { state }; render(); } } });
            if (s.proposed !== mine) return;
            const state = report && ['queued', 'running', 'clean', 'issues', 'failed'].includes(report.state) ? report.state : 'failed';
            mine.trial = { state, applied: Number(report && report.applied) || 0, count: Number(report && report.change_count) || 0, issues: Number(report && report.issue_count) || 0, errors: Number(report && report.error_count) || 0, error: (report && report.error) || '', list: Array.isArray(report && report.issues) ? report.issues : [],
              // Dataregium 3.0.0: the teams whose part the change set touches; one team's part is approved by its responsible.
              teams: Array.isArray(report && report.teams) ? report.teams.map((x) => ({ id: String(x.team_id || ''), name: String(x.name || x.team_id || '') })) : [], teamsError: String((report && report.teams_error) || '') };
            log(trialText(mine.trial), state === 'clean' ? 'ok' : 'warn');
          } catch (err) { if (s.proposed === mine) mine.trial = { state: 'failed', error: String((err && err.message) || err), list: [] }; }
          render();
        }
        /** A manager makes a clean proposal the document's next version on the server; the local model is not touched. */
        async function approveOnServer(options = {}) {
          const mine = s.proposed;
          const cde = s.cde;
          if (!mine || !cde || !mine.approveUrl || !mine.trial || mine.trial.state !== 'clean' || mine.approved || s.approvingServer || s.busy) return;
          const connector = await connectors.get(cde.connectorId);
          if (!connector) return;
          const project = cde.projectName || cde.projectId;
          if (!options.confirmed && !(await overlays.dialog.confirm(t('ai.change.approve.server.confirm', { title: mine.title, project })))) return;
          s.approvingServer = true; s.error = ''; render();
          try {
            const version = await opencde.approveProposal(connector, mine.approveUrl);
            if (s.proposed === mine) {
              mine.conflicts = null;
              mine.approved = { index: Number(version && version.version_index) || 0, number: String((version && (version.version_number || version.version_index)) || ''), title: String((version && version.title) || '') };
              const msg = t('ai.change.approve.server.done', { n: mine.approved.number, title: mine.approved.title || mine.title, project });
              log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
            }
          } catch (err) {
            fail(err);
            // A change that touches one team's part is the team's responsible's to approve, not a manager's (403).
            if (s.proposed === mine && err && err.status === 403) s.error = t('ai.change.approve.server.team', { detail: String((err && (err.detail || err.message)) || '') });
            if (s.proposed === mine && err && err.status === 412 && Array.isArray(err.conflicts)) {
              // The document moved on and the changes collide with what came between: the keys, or everything after a whole file.
              mine.conflicts = err.conflicts;
              // With the three values per key the person decides each collision here; the merge itself stays on the server (OB-19 d).
              mine.details = !err.conflicts.includes('*') && Array.isArray(err.conflictDetails) && err.conflictDetails.length ? err.conflictDetails : null;
              mine.picks = (mine.details || []).map(() => 'ours');
              s.error = err.conflicts.includes('*') ? t('ai.change.approve.server.conflict.all')
                : mine.details ? t('ai.change.approve.server.conflict.choose', { k: i18n.formatNumber(mine.details.length) })
                  : t('ai.change.approve.server.conflict', { k: i18n.formatNumber(err.conflicts.length), keys: err.conflicts.slice(0, 10).join(', ') + (err.conflicts.length > 10 ? ' …' : '') });
            } else if (s.proposed === mine && err && err.status === 409 && mine.approveUrl && mine.trial) {
              // The trial on the latest version was not clean: the server's findings replace the old verdict.
              mine.trial = { state: 'queued' };
              trialOf(connector, mine.approveUrl.replace(/\/approve$/, ''), mine);
            }
          }
          s.approvingServer = false; render();
        }
        /**
         * The collisions decided: a change kept takes the latest version's value as its old one, a change given up leaves the proposal;
         * the proposal goes again against the latest version and the server tries it anew before it can be approved.
         * @param {string[]} [choices] 'ours' or 'theirs' per collision, in the server's order; the panel's picks otherwise
         */
        async function resolveNow(choices) {
          const mine = s.proposed;
          const cde = s.cde;
          if (!mine || !cde || !mine.details || !mine.changeSet || s.approvingServer || s.busy) return;
          const picks = mine.details.map((d, i) => ((choices && choices[i]) || mine.picks[i] || 'ours'));
          s.approvingServer = true; s.error = ''; render();
          try {
            const connector = await connectors.get(cde.connectorId);
            if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
            const versions = await opencde.documentVersions(connector, [cde.documentId]);
            const latest = versions.filter((v) => !v.document_id || v.document_id === cde.documentId).reduce((n, v) => Math.max(n, Number(v.version_index) || 0), 0);
            const same = (c, d) => (c.guid || null) === (d.guid || null) && (c.path || null) === (d.path || null) && (c.step_id || null) === (d.step_id || null) && c.attribute === d.attribute && (!d.op || c.op === d.op);
            let kept = 0; let dropped = 0;
            const changes = [];
            for (const c of mine.changeSet.changes) {
              const i = mine.details.findIndex((d) => same(c, d));
              if (i < 0) { changes.push(c); continue; }
              if (picks[i] === 'theirs') { dropped++; continue; }
              kept++;
              changes.push(c.op === 'set' ? Object.assign({}, c, { old: mine.details[i].theirs === undefined ? null : mine.details[i].theirs }) : c);
            }
            const hasOps = Array.isArray(mine.changeSet.ops) && mine.changeSet.ops.length > 0;
            if (!changes.length && !hasOps) throw new Error(t('ai.change.conflict.empty'));
            const theirs = mine.details.filter((d, i) => picks[i] === 'theirs').map((d) => String(d.key || (d.guid ? `${d.guid}${d.path ? '/' + d.path : ''}.${d.attribute}` : `#${d.step_id}.${d.attribute}`)));
            const changeSet = Object.assign({}, mine.changeSet, { base: Object.assign({}, mine.changeSet.base, { version_index: latest || mine.changeSet.base.version_index }), changes },
              hasOps ? { keep_theirs: Array.from(new Set((mine.changeSet.keep_theirs || []).concat(theirs))) } : {});
            await opencde.putChangeSet(connector, cde.projectId, mine.guid, mine.schemaUrl, changeSet);
            mine.changeSet = changeSet; mine.details = null; mine.picks = []; mine.conflicts = null;
            log(t('ai.change.conflict.resent', { n: String(changeSet.base.version_index), kept: i18n.formatNumber(kept), dropped: i18n.formatNumber(dropped) }), 'ok');
            if (mine.proposalUrl) { mine.trial = { state: 'queued' }; trialOf(connector, mine.proposalUrl, mine); }
          } catch (err) { fail(err); }
          s.approvingServer = false; render();
        }
        /** A value of the change set's form in words, for the collisions. */
        function conflictValue(v) {
          if (v === null || v === undefined) return '–';
          if (Array.isArray(v)) { const text = v.map(conflictValue).join(', '); return text.length > 60 ? text.slice(0, 57) + '…' : text; }
          if (typeof v === 'object') {
            if (v.value !== undefined) return String(v.value);
            if (v.enum !== undefined) return '.' + v.enum + '.';
            if (v.guid !== undefined) return String(v.guid) + (v.path ? '/' + v.path : '');
            if (v.step_id !== undefined) return '#' + v.step_id;
            return JSON.stringify(v).slice(0, 60);
          }
          return String(v);
        }
        function renderConflicts(mine) {
          return h('div', { class: 'dm-stack-sm', 'data-ai-conflicts': String(mine.details.length) },
            h('strong', { class: 'dm-small', text: t('ai.change.conflict.title') }),
            mine.details.slice(0, 100).map((d, i) => {
              const pick = /** @type {any} */ (h('dm-select', { label: t('ai.change.conflict.choice'), 'data-ai-conflict-pick': String(i) }));
              pick.options = [{ value: 'ours', label: t('ai.change.conflict.ours') }, { value: 'theirs', label: t('ai.change.conflict.theirs') }];
              pick.value = mine.picks[i] || 'ours';
              pick.addEventListener('change', () => { mine.picks[i] = pick.value === 'theirs' ? 'theirs' : 'ours'; });
              return h('div', { class: 'dm-row-wrap', 'data-ai-conflict': String(i) },
                h('span', { class: 'dm-small dm-grow', text: t('ai.change.conflict.line', { key: String(d.key || ''), base: conflictValue(d.base), theirs: conflictValue(d.theirs), ours: conflictValue(d.ours), n: String(d.version_index || '–') }) }), pick);
            }),
            h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('ai.change.conflict.resend'), icon: 'refresh-cw', size: 'sm', loading: s.approvingServer, disabled: s.busy, title: t('ai.change.conflict.resend.hint'), 'data-ai-conflict-resend': '', onClick: () => resolveNow() })));
        }
        const trialText = (trial) => t('ai.change.trial.' + (trial.state === 'running' ? 'queued' : trial.state), { applied: i18n.formatNumber(trial.applied || 0), n: i18n.formatNumber(trial.count || 0), issues: i18n.formatNumber(trial.issues || 0), errors: i18n.formatNumber(trial.errors || 0), error: trial.error || '' });
        const deletions = () => s.changeset.ops.filter((op) => op.tool === 'delete_elements').reduce((n, op) => n + op.ids.length, 0);
        /** The previewed change set as a recipe step: undoable, logged with its provenance, a new version of the model. */
        async function approveNow() {
          const report = s.preview && s.preview.report;
          if (s.approving || s.busy || !report || Number(report.errors) > 0) return;
          const n = deletions();
          if (n && !(await overlays.dialog.confirm(t('ai.change.confirm.delete', { n: i18n.formatNumber(n) }), { danger: true }))) return;
          s.approving = true; s.error = ''; render();
          try {
            const p = provider();
            const provenance = { provider: p ? p.name : '', model: p ? p.model : '', questions: s.exchanges.map((x) => x.question).slice(-5), at: new Date().toISOString() };
            const colors = colorsOf(report);
            // The colours first: the redraw that the new version causes then shows them on the changed model.
            s.preview = null;
            if (options.preview) await options.preview(colors.length ? { colors } : null);
            const result = await recipes.apply(options.datasetId, 'ifc_changeset', { changes: JSON.stringify(writeTools.toWheel(s.changeset)), provenance: JSON.stringify(provenance) });
            s.changeset = writeTools.create(options.datasetId);
            const msg = t('ai.change.approved', { created: i18n.formatNumber((report.created || []).length), changed: i18n.formatNumber((report.changed || []).length), deleted: i18n.formatNumber((report.deleted || []).length) });
            log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
            if (options.onApproved) options.onApproved(result);
          } catch (err) { fail(err); }
          s.approving = false; render();
        }
        async function rejectNow() {
          if (s.busy || s.previewing || s.approving) return;
          s.changeset = writeTools.create(options.datasetId);
          await dropPreview();
          render();
        }

        // ---- rendering -----------------------------------------------------------------------------------------
        function stepLine(step) {
          const args = Object.entries(step.args || {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ');
          const tail = step.error ? t('ai.step.error', { error: step.error }) : (step.count !== null && step.count !== undefined ? t('ai.step.count', { n: i18n.formatNumber(step.count) }) : '');
          return h('li', { class: 'dm-small', text: `${step.name}(${args}) ${tail} · ${step.ms} ms` });
        }
        let stepsEl = null;
        function renderSteps() { if (stepsEl) replace(stepsEl, s.steps.length ? h('ol', { class: 'dm-list dm-xs', 'data-ai-steps': '' }, s.steps.map(stepLine)) : null); }
        function renderChanges() {
          const cs = s.changeset;
          const report = s.preview && s.preview.report;
          const errors = report ? Number(report.errors) || 0 : 0;
          const proposal = s.cde && !s.cde.documentId ? null : proposalOf(report);
          const finding = (f) => h('li', { class: 'dm-xs', text: `${f.ifc_class || ''}${f.id ? ' #' + f.id : ''}${f.attribute ? ' ' + f.attribute : ''}: ${f.message || ''}` });
          return h('div', { class: 'dm-stack-sm', 'data-ai-changeset': '' },
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('ai.change.title') }), h('span', { class: 'dm-help dm-xs', 'data-ai-change-count': '', text: t('ai.change.steps', { n: i18n.formatNumber(cs.ops.length) }) })),
            cs.ops.length ? h('ol', { class: 'dm-list dm-xs', 'data-ai-changes': '' }, cs.ops.map((op) => h('li', { class: op.tool === 'delete_elements' ? 'dm-small dm-error' : 'dm-small', text: writeTools.describe(op) }))) : h('p', { class: 'dm-help dm-xs', text: t('ai.change.empty') }),
            report ? h('div', { class: 'dm-stack-sm', 'data-ai-report': '' },
              h('p', { class: 'dm-small', text: t('ai.change.report', { created: i18n.formatNumber((report.created || []).length), changed: i18n.formatNumber((report.changed || []).length), deleted: i18n.formatNumber((report.deleted || []).length) }) }),
              h('p', { class: errors ? 'dm-error dm-small' : 'dm-help dm-xs', 'data-ai-findings': String(errors), text: errors ? t('ai.change.findings', { n: i18n.formatNumber(errors) }) : t('ai.change.findings.none') }),
              Array.isArray(report.findings) && report.findings.length ? h('ul', { class: 'dm-list dm-xs' }, report.findings.slice(0, 10).map(finding)) : null,
              // The wheel's notes: what it could not do in the file's schema, and what the model still lacks (no CRS, GRF003).
              Array.isArray(report.notes) && report.notes.length ? h('ul', { class: 'dm-list dm-xs', 'data-ai-notes': String(report.notes.length) }, report.notes.slice(0, 10).map((n) => h('li', { class: 'dm-help dm-xs', text: String(n) }))) : null,
              s.preview.server ? h('p', { class: s.preview.server.status === 'issues' || s.preview.server.status === 'failed' ? 'dm-error dm-small' : 'dm-help dm-xs', 'data-ai-precheck': s.preview.server.status,
                text: t('ai.change.precheck.' + s.preview.server.status, { n: i18n.formatNumber((s.preview.server.counts || {}).findings || 0), errors: i18n.formatNumber((s.preview.server.counts || {}).errors || 0), error: s.preview.server.error || '' }) }) : null,
              s.cde && proposal ? h('p', { class: 'dm-help dm-xs', 'data-ai-proposal': String(proposal.changes.length), text: proposalText(proposal) }) : null,
              s.proposed ? h('p', { class: 'dm-small', 'data-ai-proposed': s.proposed.guid, text: t('ai.change.proposed', { title: s.proposed.title }) }) : null,
              s.proposed && s.proposed.trial ? h('p', { class: s.proposed.trial.state === 'issues' || s.proposed.trial.state === 'failed' ? 'dm-error dm-small' : 'dm-help dm-xs', 'data-ai-trial': s.proposed.trial.state, text: trialText(s.proposed.trial) }) : null,
              s.proposed && s.proposed.trial && (s.proposed.trial.teams || []).length ? h('p', { class: 'dm-help dm-xs', 'data-ai-trial-teams': String(s.proposed.trial.teams.length), text: t(s.proposed.trial.teams.length === 1 ? 'ai.change.trial.team' : 'ai.change.trial.teams', { names: s.proposed.trial.teams.map((x) => x.name).join(', ') }) }) : null,
              s.proposed && s.proposed.trial && s.proposed.trial.teamsError ? h('p', { class: 'dm-help dm-xs', 'data-ai-trial-teams-error': '', text: t('ai.change.trial.teams.error', { error: s.proposed.trial.teamsError }) }) : null,
              s.proposed && s.proposed.trial && (s.proposed.trial.list || []).length ? h('ul', { class: 'dm-list dm-xs', 'data-ai-trial-issues': '' }, s.proposed.trial.list.slice(0, 10).map((f) => h('li', { class: 'dm-xs', text: `${f.kind || ''}${f.rule ? ' ' + f.rule : ''}${f.step_id ? ' #' + f.step_id : ''}: ${f.message || ''}` }))) : null,
              s.proposed && s.proposed.trial && s.proposed.trial.state === 'clean' && s.proposed.approveUrl && !s.proposed.approved ? h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('ai.change.approve.server'), icon: 'circle-check', size: 'sm', loading: s.approvingServer, disabled: s.busy, title: t('ai.change.approve.server.hint'), 'data-ai-approve-server': '', onClick: () => approveOnServer() })) : null,
              s.proposed && s.proposed.approved ? h('p', { class: 'dm-small', 'data-ai-approved-server': String(s.proposed.approved.index), text: t('ai.change.approved.server', { n: s.proposed.approved.number }) }) : null,
              s.proposed && s.proposed.details ? renderConflicts(s.proposed)
                : s.proposed && s.proposed.conflicts ? h('ul', { class: 'dm-list dm-xs', 'data-ai-approve-conflicts': String(s.proposed.conflicts.length) }, s.proposed.conflicts.slice(0, 10).map((k) => h('li', { class: 'dm-xs', text: k }))) : null) : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('ai.change.preview'), icon: 'eye', size: 'sm', loading: s.previewing, disabled: !cs.ops.length || s.busy, title: t('ai.change.preview.hint'), 'data-ai-preview': '', onClick: previewNow }),
              basic.button({ label: t('ai.change.approve'), icon: 'check', size: 'sm', loading: s.approving, disabled: !report || errors > 0 || s.busy, title: t('ai.change.approve.hint'), 'data-ai-approve': '', onClick: approveNow }),
              s.cde && proposal && s.canPropose === false ? h('p', { class: 'dm-help dm-xs', 'data-ai-propose-role': '', text: t('ai.change.propose.role.none') }) : null,
              s.cde && proposal && s.canPropose !== false ? basic.button({ label: t('ai.change.propose'), icon: 'share-2', size: 'sm', loading: s.proposing, disabled: !(proposal.changes.length || (s.opsForm && cs.ops.length)) || s.busy || !!s.proposed, title: t('ai.change.propose.hint'), 'data-ai-propose': '', onClick: () => proposeNow() }) : null,
              basic.button({ label: t('ai.change.reject'), icon: 'x', size: 'sm', variant: 'ghost', disabled: !cs.ops.length || s.busy, title: t('ai.change.reject.hint'), 'data-ai-reject': '', onClick: rejectNow })),
            h('p', { class: 'dm-help dm-xs', text: t('ai.change.python') }));
        }
        function render() {
          const sel = /** @type {any} */ (h('dm-select', { label: t('ai.provider') }));
          sel.options = s.providers.map((p) => ({ value: p.id, label: `${p.name} · ${p.model}${providers.isLocal(p.baseUrl) ? ' · ' + t('ai.local') : ''}` }));
          sel.value = s.providerId;
          sel.addEventListener('change', () => { s.providerId = sel.value; });
          const pol = /** @type {any} */ (h('dm-select', { label: t('ai.policy'), title: t('ai.policy.hint') }));
          pol.options = providers.POLICIES.map((id) => ({ value: id, label: t('ai.policy.' + id) }));
          pol.value = s.policy;
          pol.addEventListener('change', () => { providers.setPolicy(pol.value).then(() => { s.policy = pol.value; }).catch(fail); });
          const mode = /** @type {any} */ (h('dm-select', { label: t('ai.mode'), title: t('ai.mode.hint'), 'data-ai-mode': '' }));
          mode.options = MODES.map((id) => ({ value: id, label: t('ai.mode.' + id) }));
          mode.value = s.mode;
          mode.addEventListener('change', () => { s.mode = MODES.includes(mode.value) ? mode.value : 'ask'; render(); });
          const q = /** @type {any} */ (h('dm-input', { label: t(building() ? 'ai.build.brief' : 'ai.question'), rows: building() ? '6' : '3', placeholder: t(building() ? 'ai.build.placeholder' : checking() ? 'ai.check.placeholder' : changing() ? 'ai.question.placeholder.change' : 'ai.question.placeholder'), 'data-ai-question': '' }));
          q.value = s.question;
          q.addEventListener('input', () => { s.question = q.value; });
          q.addEventListener('keydown', (ev) => { if (/** @type {KeyboardEvent} */ (ev).key === 'Enter' && (/** @type {KeyboardEvent} */ (ev).ctrlKey || /** @type {KeyboardEvent} */ (ev).metaKey)) { ev.preventDefault(); askNow(); } });
          stepsEl = h('div');
          const p = provider();
          replace(el,
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t(building() ? 'ai.title.build' : checking() ? 'ai.title.check' : changing() ? 'ai.title.change' : 'ai.title') }), basic.button({ label: t('ai.providers.manage'), icon: 'settings', size: 'sm', 'data-ai-providers': '', onClick: () => manage(ctx).then(() => load().then(render)) })),
            h('p', { class: 'dm-help dm-xs', text: t(building() ? 'ai.hint.build' : checking() ? 'ai.hint.check' : changing() ? 'ai.hint.change' : 'ai.hint') }),
            s.providers.length ? h('div', { class: 'dm-row-wrap' }, sel, pol, mode) : h('p', { class: 'dm-help', 'data-ai-none': '', text: t('ai.providers.none') }),
            p && !providers.hasKey(p.id) && !providers.isLocal(p.baseUrl) ? h('p', { class: 'dm-help dm-xs', text: t('ai.key.missing', { name: p.name }) }) : null,
            building() ? formView() : null,
            q,
            withPictures() ? attachRow() : null,
            s.questionBox ? questionView() : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t(building() ? 'ai.build.run' : checking() ? 'ai.check.run' : changing() ? 'ai.propose' : 'ai.ask'), icon: 'cpu', variant: 'primary', size: 'sm', loading: s.busy, disabled: !s.providers.length, 'data-ai-ask': '', onClick: askNow }),
              s.busy ? basic.button({ label: t('common.cancel'), size: 'sm', 'data-ai-cancel': '', onClick: cancel }) : null,
              s.elements.length && !s.busy ? basic.button({ label: t('ai.mark', { n: i18n.formatNumber(s.elements.length) }), icon: 'list-checks', size: 'sm', 'data-ai-mark': '', onClick: mark }) : null),
            s.error ? h('p', { class: 'dm-error', 'data-ai-error': '', text: s.error }) : null,
            s.answer ? h('div', { class: 'dm-stack-sm', 'data-ai-answer': '' }, s.answer.split(/\n{2,}/).map((para) => h('p', { class: 'dm-small', text: para }))) : null,
            checking() ? check.view() : null,
            stepsEl,
            changing() ? renderChanges() : null,
            s.usage ? h('p', { class: 'dm-help dm-xs', 'data-ai-usage': '', text: t('ai.usage', { input: i18n.formatNumber(s.usage.input), output: i18n.formatNumber(s.usage.output) }) }) : null,
            s.exchanges.length > 1 ? h('p', { class: 'dm-help dm-xs', text: t('ai.history', { n: String(s.exchanges.length) }) }) : null);
          renderSteps();
        }
        function destroy() { unsubscribe(); cancel(); if (s.preview && options.preview) { s.preview = null; Promise.resolve(options.preview(null)).catch(() => {}); } }
        load().then(render);
        return { el, destroy, state: s, check, ask: (question) => { s.question = question; return askNow(); }, attach: (list) => { s.attachments = s.attachments.concat(list || []); render(); }, addFacts, mark, load, preview: previewNow, approve: approveNow, reject: rejectNow, propose: proposeNow, approveOnServer, resolveConflicts: resolveNow, setMode: (m) => { s.mode = MODES.includes(m) ? m : 'ask'; render(); } };
      }

      /** The dialog that lists the providers and adds, changes or removes one; the key is written, never shown. */
      async function manage(_ctx) {
        for (;;) {
          const all = await providers.list();
          const rows = all.map((p) => h('div', { class: 'dm-row', 'data-ai-provider': p.id },
            h('span', { class: 'dm-grow dm-small', text: `${p.name} · ${t('ai.kind.' + p.kind)} · ${p.model} · ${providers.hostOf(p.baseUrl)}${providers.hasKey(p.id) ? '' : ' · ' + t('ai.key.none')}` }),
            basic.button({ label: t('common.edit'), size: 'sm', onClick: () => done({ edit: p }) }),
            basic.button({ label: t('ai.providers.remove'), size: 'sm', variant: 'ghost', onClick: () => done({ remove: p }) })));
          let done = () => {};
          const chosen = await overlays.dialog.open({
            title: t('ai.providers.title'),
            body: (finish) => { done = finish; return h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help', text: t('ai.providers.hint') }), rows.length ? rows : h('p', { class: 'dm-help', text: t('ai.providers.none') })); },
            actions: [{ label: t('common.close'), value: null }, { label: t('ai.providers.add'), variant: 'primary', value: 'add', primary: true }],
          });
          if (!chosen) return;
          if (chosen === 'add') await edit(null);
          else if (chosen.edit) await edit(chosen.edit);
          else if (chosen.remove) { if (await overlays.dialog.confirm(t('ai.providers.remove.confirm', { name: chosen.remove.name }), { danger: true })) await providers.remove(chosen.remove.id); }
        }
      }
      /** One provider's form: a preset to start from, then kind, name, address, model and key. */
      async function edit(existing) {
        const values = Object.assign({ kind: 'anthropic', name: '', baseUrl: providers.KINDS.anthropic.baseUrl, model: providers.KINDS.anthropic.model }, existing || {});
        let error = '';
        for (;;) {
          const preset = /** @type {any} */ (h('dm-select', { label: t('ai.preset') }));
          preset.options = [{ value: '', label: t('ai.preset.own') }].concat(providers.PRESETS.map((p) => ({ value: p.id, label: t(p.nameKey) })));
          preset.value = '';
          const kind = /** @type {any} */ (h('dm-select', { label: t('ai.kind') }));
          kind.options = Object.keys(providers.KINDS).map((k) => ({ value: k, label: t(providers.KINDS[k].labelKey) }));
          kind.value = values.kind;
          const name = /** @type {any} */ (h('dm-input', { label: t('ai.name'), value: values.name }));
          const baseUrl = /** @type {any} */ (h('dm-input', { label: t('ai.baseUrl'), value: values.baseUrl, placeholder: 'https://…' }));
          const model = /** @type {any} */ (h('dm-input', { label: t('ai.model'), value: values.model }));
          const key = /** @type {any} */ (h('dm-input', { label: t('ai.key'), type: 'password', help: t('ai.key.hint'), placeholder: existing && providers.hasKey(existing.id) ? t('ai.key.kept') : '' }));
          preset.addEventListener('change', () => { const p = providers.PRESETS.find((x) => x.id === preset.value); if (!p) return; kind.value = p.kind; name.value = t(p.nameKey); baseUrl.value = p.baseUrl; model.value = p.model; });
          const body = h('div', { class: 'dm-stack-sm' }, existing ? null : preset, kind, name, baseUrl, model, key, error ? h('p', { class: 'dm-error', text: error }) : null);
          const ok = await overlays.dialog.open({ title: existing ? t('ai.providers.edit') : t('ai.providers.add'), body, actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
          Object.assign(values, { kind: kind.value, name: name.value, baseUrl: baseUrl.value, model: model.value });
          if (ok !== true) return null;
          try {
            const saved = await providers.save(values);
            if (key.value) providers.setKey(saved.id, key.value);
            return saved;
          } catch (err) { error = String((err && err.message) || err); }
        }
      }
      return { create, manage, edit };
    });
})();
