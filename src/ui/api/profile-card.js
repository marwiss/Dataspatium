// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Projektprofil (decision F41 a, step 5): a card in the OpenCDE source's view for the chosen project, with the project's IDS
 * documents among its files, the bSDD dictionaries the person has chosen for it (kept in this browser, per server and project),
 * a search in bSDD after the consent for its host, and Skriv IDS med AI: the AI writes a specification from a description with
 * the app's own IDS check in the loop (ai/ids-writer), shown round by round in a floating panel, and the result is saved as a
 * file or uploaded to the project. Nothing is fetched before a button is pressed.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/profile-card', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/opencde', 'api/bsdd', 'ai/providers', 'ai/ids-writer', 'data/datasets', 'platform/storage/idb', 'platform/files'],
    (base, basic, overlays, opencde, bsdd, providers, idsWriter, datasets, idb, files) => {
      const { h, t, i18n, replace } = base;
      const SETTING = (connectorId, projectId) => `profile:${connectorId}:${projectId}`;
      const isIds = (f) => /\.ids$/i.test(String((f && f.filename) || ''));

      /**
       * @param {{connector: any, log?: (msg: string, kind?: string) => void}} options
       */
      function create(options) {
        const { connector } = options;
        const log = (msg, kind) => { if (options.log) options.log(msg, kind || 'ok'); };
        const el = h('div', { class: 'dm-card dm-stack-sm', 'data-opencde-profile': '', hidden: '' });
        const s = { projectId: '', projectName: '', files: [], dictionaries: [], search: '', results: null, busy: '', error: '' };
        async function load() {
          const saved = await idb.getSetting(SETTING(connector.id, s.projectId), null);
          s.dictionaries = saved && Array.isArray(saved.dictionaries) ? saved.dictionaries : [];
        }
        async function save() { await idb.setSetting(SETTING(connector.id, s.projectId), { dictionaries: s.dictionaries }); }
        /** The view tells the card which project and files it shows; without a project the card hides. */
        function update(state) {
          const changed = String(state.projectId || '') !== s.projectId;
          s.projectId = String(state.projectId || ''); s.projectName = String(state.projectName || ''); s.files = Array.isArray(state.files) ? state.files : [];
          if (!s.projectId) { el.hidden = true; return; }
          el.hidden = false;
          if (changed) { s.results = null; s.error = ''; load().then(render).catch(() => render()); } else render();
        }
        async function addDictionary(d) {
          if (!d || !d.uri) return;
          if (!s.dictionaries.some((x) => x.uri === d.uri)) { s.dictionaries.push({ uri: String(d.uri), name: String(d.name || d.uri) }); await save(); }
          render();
        }
        async function removeDictionary(uri) {
          s.dictionaries = s.dictionaries.filter((x) => x.uri !== uri);
          await save(); render();
        }
        const step = async (name, fn) => { s.busy = name; s.error = ''; render(); try { await fn(); } catch (err) { s.error = String((err && err.message) || err); } s.busy = ''; render(); };
        const searchBsdd = () => step('search', async () => {
          const q = String(s.search || '').trim();
          if (!q) return;
          s.results = await bsdd.search(q, { dictionaries: s.dictionaries.map((d) => d.uri), limit: 20 });
        });
        const listDictionaries = () => step('dictionaries', async () => { s.results = (await bsdd.dictionaries()).map((d) => Object.assign({ isDictionary: true }, d)); });

        function render() {
          const docs = s.files.filter(isIds);
          const search = /** @type {any} */ (h('dm-input', { label: t('profile.bsdd.search'), placeholder: t('profile.bsdd.placeholder'), 'data-profile-search': '' }));
          search.value = s.search;
          search.addEventListener('input', () => { s.search = search.value; });
          search.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') searchBsdd(); });
          replace(el,
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('profile.card') }), h('span', { class: 'dm-help dm-xs', text: s.projectName })),
            h('p', { class: 'dm-help dm-xs', text: t('profile.card.hint') }),
            h('div', { class: 'dm-stack-xs', 'data-profile-ids-docs': String(docs.length) },
              h('span', { class: 'dm-small', text: t('profile.ids.docs', { n: i18n.formatNumber(docs.length) }) }),
              docs.length ? h('ul', { class: 'dm-stack-xs' }, docs.map((f) => h('li', { class: 'dm-small dm-mono', text: f.filename }))) : null),
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('profile.ids.write'), icon: 'sparkles', size: 'sm', title: t('profile.ids.write.hint'), 'data-profile-write-ids': '', onClick: () => writeDialog() })),
            h('div', { class: 'dm-stack-xs', 'data-profile-dictionaries': String(s.dictionaries.length) },
              h('span', { class: 'dm-small', text: t('profile.bsdd.dictionaries', { n: i18n.formatNumber(s.dictionaries.length) }) }),
              s.dictionaries.length ? h('div', { class: 'dm-row-wrap' }, s.dictionaries.map((d) => h('dm-badge', { text: d.name, title: d.uri, 'data-profile-dictionary': d.uri, onclick: () => removeDictionary(d.uri) }))) : h('span', { class: 'dm-help dm-xs', text: t('profile.bsdd.none') })),
            h('div', { class: 'dm-row-wrap' }, search,
              basic.button({ label: t('profile.bsdd.go'), icon: 'search', size: 'sm', loading: s.busy === 'search', title: t('profile.bsdd.go.hint', { host: bsdd.HOST }), 'data-profile-search-go': '', onClick: searchBsdd }),
              basic.button({ label: t('profile.bsdd.list'), icon: 'book-open', size: 'sm', loading: s.busy === 'dictionaries', title: t('profile.bsdd.list.hint'), onClick: listDictionaries })),
            s.results ? resultsView() : null,
            s.error ? h('p', { class: 'dm-error dm-small', text: s.error }) : null);
        }
        function resultsView() {
          if (!s.results.length) return h('p', { class: 'dm-help dm-small', text: t('profile.bsdd.noresults') });
          return h('ul', { class: 'dm-stack-xs', 'data-profile-results': String(s.results.length) }, s.results.slice(0, 20).map((r) => h('li', { class: 'dm-row-wrap' },
            h('span', { class: 'dm-grow dm-small' }, h('strong', { text: r.name }), h('span', { class: 'dm-help', text: ' ' + [r.code, r.dictionary || r.organization, r.version].filter(Boolean).join(' · ') })),
            r.isDictionary ? basic.button({ label: t('profile.bsdd.add'), icon: 'plus', size: 'sm', 'icon-only': true, title: t('profile.bsdd.add'), onClick: () => addDictionary(r) })
              : h('span', { class: 'dm-help dm-xs dm-mono dm-truncate', text: r.uri }))));
        }

        /** Skriv IDS med AI: the provider, the model to check against and the description; then the loop in a floating panel. */
        async function writeDialog() {
          const list = await providers.list();
          if (!list.length) { overlays.toast.show(t('ai.providers.none'), { kind: 'warn' }); return null; }
          const models = (await datasets.list()).filter((d) => d.kind === 'model' && !(d.model && d.model.format === 'dxf'));
          if (!models.length) { overlays.toast.show(t('profile.ids.nomodel'), { kind: 'warn' }); return null; }
          const own = models.filter((d) => d.source && d.source.cde && String(d.source.cde.projectId) === s.projectId);
          const choice = { providerId: list[0].id, datasetId: (own[0] || models[0]).id, description: '', rounds: 4 };
          const desc = /** @type {any} */ (h('dm-input', { label: t('profile.ids.description'), type: 'textarea', rows: '5', placeholder: t('profile.ids.placeholder') }));
          desc.addEventListener('input', () => { choice.description = desc.value; });
          const body = h('div', { class: 'dm-stack-sm', 'data-profile-ids': '' },
            h('p', { class: 'dm-help dm-small', text: t('profile.ids.hint') }),
            list.length > 1 ? basic.select(t('ai.provider'), list.map((p) => ({ value: p.id, label: p.name })), choice.providerId, (v) => { choice.providerId = v; }) : null,
            basic.select(t('profile.ids.model'), models.map((d) => ({ value: d.id, label: d.name })), choice.datasetId, (v) => { choice.datasetId = v; }),
            desc);
          const ok = await overlays.dialog.open({ title: t('profile.ids.title'), help: 'cad-bim#projektprofil', body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('profile.ids.run'), variant: 'primary', value: true, primary: true }] });
          if (ok !== true || !String(choice.description).trim()) return null;
          const provider = list.find((p) => p.id === choice.providerId) || list[0];
          const model = models.find((d) => d.id === choice.datasetId) || models[0];
          return runPanel(provider, model, choice);
        }
        function runPanel(provider, model, choice) {
          const run = { rounds: [], out: null, error: '', controller: new AbortController(), busy: true };
          const panel = overlays.floating({ onClose: () => { if (run.busy) run.controller.abort(); } });
          panel.el.setAttribute('data-profile-ids-run', '');
          const fileName = () => (String(choice.description).trim().slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'ids') + '.ids';
          const saveFile = () => { files.download(new File([run.out.xml], fileName(), { type: 'application/xml' }), fileName()); };
          const upload = async () => {
            run.busy = true; render();
            try { await opencde.uploadDocument(connector, new File([run.out.xml], fileName(), { type: 'application/xml' }), {}); const done = t('profile.ids.uploaded', { name: fileName() }); log(done); overlays.toast.show(done, { kind: 'ok' }); }
            catch (err) { run.error = String((err && err.message) || err); }
            run.busy = false; render();
          };
          const roundLine = (r) => h('li', { class: r.ran ? '' : 'dm-warn', 'data-profile-round': String(r.round) }, h('span', { text: r.ran
            ? t('profile.ids.round.ran', { n: r.round, pass: i18n.formatNumber((r.summary && r.summary.checks_pass) || 0), fail: i18n.formatNumber((r.summary && r.summary.checks_fail) || 0) })
            : t('profile.ids.round.error', { n: r.round, error: String(r.error || '').slice(0, 200) }) }));
          function render() {
            const out = run.out;
            panel.update({
              title: t('profile.ids.title'), meta: `${provider.name} · ${model.name}`,
              body: [
                run.rounds.length ? h('ul', { class: 'dm-stack-xs dm-flow-log' }, run.rounds.map(roundLine)) : null,
                run.busy && !out ? h('p', { class: 'dm-help', text: t('profile.ids.working') }) : null,
                out && out.answer ? h('p', { class: 'dm-assistant-answer', text: out.answer }) : null,
                out && out.xml ? h('pre', { class: 'dm-help-code', 'data-profile-ids-xml': '', text: out.xml.length > 20000 ? out.xml.slice(0, 20000) + '…' : out.xml }) : null,
                out && out.stopped === 'rounds' ? h('p', { class: 'dm-warn dm-small', text: t('profile.ids.notran') }) : null,
                out && out.usage ? h('p', { class: 'dm-help dm-small', text: t('ai.usage', { input: i18n.formatNumber(out.usage.input), output: i18n.formatNumber(out.usage.output) }) }) : null,
                run.error ? h('p', { class: 'dm-error', text: run.error }) : null,
              ].filter(Boolean),
              actions: [
                run.busy && !out ? basic.button({ label: t('flows.cancel'), icon: 'octagon-x', title: t('assistant.stop.hint'), onClick: () => run.controller.abort() }) : null,
                out && out.xml ? basic.button({ label: t('profile.ids.save'), icon: 'download', variant: 'primary', title: t('profile.ids.save.hint'), onClick: saveFile }) : null,
                out && out.xml && opencde.hasDocuments(connector) ? basic.button({ label: t('profile.ids.upload'), icon: 'upload', title: t('profile.ids.upload.hint'), loading: run.busy, onClick: upload }) : null,
              ].filter(Boolean),
            });
          }
          render();
          idsWriter.write({ provider, datasetId: model.id, description: choice.description, rounds: choice.rounds, signal: run.controller.signal, onEvent: (ev) => { if (ev.type === 'round') { run.rounds.push(ev); render(); } } })
            .then((out) => { run.out = out; run.busy = false; log(t('profile.ids.done', { rounds: i18n.formatNumber(out.rounds), state: t('profile.ids.state.' + out.stopped) })); render(); })
            .catch((err) => { run.error = String((err && err.message) || err); run.busy = false; render(); });
          return { panel, run };
        }
        return { el, update, state: s, addDictionary, removeDictionary, searchBsdd, writeDialog, render };
      }
      return { create, SETTING };
    });
})();
