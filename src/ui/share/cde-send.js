// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dela: a dataset, or its original file, to a project on an OpenCDE server. The dataset is written in a file format from a copy
 * that has been through the review, or the original is sent after the warning (an IFC model's file through the review, which
 * looks inside it and cleans the copy), and the file goes up through the Documents API
 * (the server's own page asks for title and version) or as a BCF document. A dataset that came from the CDE can go back as a new
 * version of the same document. A workspace bundle (the package dialog, through the review) goes the same way, so that two
 * Dataspatium users share through the server; the source view's files card receives it on the other side.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/cde-send', ['ui/base', 'data/datasets', 'data/kinds', 'api/families/opencde', 'api/connectors', 'ui/share/review', 'data/share-scan', 'platform/tier', 'ui/settings/tier'], (base, datasets, kinds, opencde, connectors, review, shareScan, tier, tierUi) => {
    const { h, t, i18n, replace } = base;
    /** Tests give a popup of their own; the app opens the server's page in a window. */
    let popup = null;
    /** Tests under file:// give the redirect address too; the app derives it from its root. */
    let redirectOverride = null;

    /**
     * The panel for the tab in Dela.
     * @param {any} ctx shell context @param {{dataset: () => any}} hooks the dataset chosen in the list
     */
    function create(ctx, hooks) {
      const { ui, shell, services } = ctx;
      const s = { connectors: [], connector: null, projects: null, projectId: '', what: 'dataset', format: '', how: 'documents', busy: '', error: '', progress: null, done: '', message: '', messageMax: opencde.MESSAGE_MAX, conflict: null };
      const el = h('div', { class: 'dm-stack' });
      const fail = (err) => { s.error = String((err && err.message) || err); shell.log(s.error, 'error'); };
      const ds = () => hooks.dataset();

      async function start() {
        s.connectors = (await connectors.list()).filter((c) => opencde.isOpenCde(c));
        s.connector = s.connectors[0] || null;
        render();
        if (s.connector && opencde.signedIn(s.connector)) { await loadLimits(); await loadProjects(); }
      }
      /** How long a version's message may be on the chosen server (Dataregium's capability git). */
      async function loadLimits() {
        s.messageMax = await opencde.messageMax(s.connector);
        render();
      }
      async function signIn() {
        s.busy = 'login'; s.error = ''; render();
        try {
          if (!opencde.redirectUri()) throw new Error(t('issues.err.file'));
          await opencde.login(s.connector);
          await loadLimits();
          await loadProjects();
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      async function loadProjects() {
        // The projects are the BCF API's. A server with the Documents API alone has none to list; its own page asks for the project
        // when a file goes up.
        if (!opencde.hasBcf(s.connector)) { s.projects = []; s.projectId = ''; render(); return; }
        s.busy = 'projects'; render();
        try {
          s.projects = await opencde.projects(s.connector);
          const d = ds();
          const home = d && d.source && d.source.cde && d.source.cde.connectorId === s.connector.id ? d.source.cde.projectId : '';
          if (!s.projectId || !s.projects.some((p) => p.project_id === s.projectId)) s.projectId = (home && s.projects.some((p) => p.project_id === home) ? home : (s.projects[0] ? s.projects[0].project_id : ''));
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      /** The file to send: an export of a reviewed copy, or the original after the warning. */
      async function fileToSend(d) {
        if (s.what === 'bundle') {
          let picked = null;
          const res = await D.require('ui/share/bundle').shareBundle(ctx, { datasetIds: d ? [d.id] : undefined, deliver: async (blob, name) => { picked = { blob, name }; } });
          if (!res || !picked) return null;
          return new File([picked.blob], picked.name, { type: 'application/zip' });
        }
        if (s.what === 'original' && (await shareScan.isIfc(d.id))) return reviewedModel(d);
        if (s.what === 'original') {
          if (!(await review.warn(ctx, [d.id]))) return null;
          const out = await services.exporter.exportDataset(d.id, kinds.of(d).wholeFormat);
          return new File([out.blob], out.filename, { type: out.blob.type || 'application/octet-stream' });
        }
        const reviewed = await review.review(ctx, [d.id]);
        if (!reviewed) return null;
        const out = await shareScan.exportCopy(d, s.format, reviewed.transform[d.id] || {});
        return new File([out.blob], out.filename, { type: out.blob.type || 'application/octet-stream' });
      }
      /**
       * An IFC model's own file, through the review: the people, addresses, owner history and header inside it are kept,
       * pseudonymised or removed in the copy (IfcOpenShell in the app's Python), and the copy's file is what goes up.
       */
      async function reviewedModel(d) {
        const reviewed = await review.review(ctx, [d.id]);
        if (!reviewed) return null;
        const tr = reviewed.transform[d.id] || {};
        const format = kinds.of(d).wholeFormat;
        // The copy keeps the file's own name, as the model's file does when it goes up unchanged.
        const out = shareScan.changes(tr) ? await shareScan.exportCopy(d, format, tr, { filename: null }) : await services.exporter.exportDataset(d.id, format);
        const note = review.summary(reviewed.transform);
        if (note) shell.log(note, 'info');
        return new File([out.blob], out.filename || D.require('platform/files').safeName(d.name, 'ifc'), { type: out.blob.type || 'application/octet-stream' });
      }
      /**
       * Send the chosen dataset. `asVersionOf` makes it a new version of that Documents API document.
       * @param {{asVersionOf?: string}} [options]
       */
      async function send(options = {}) {
        const d = ds();
        // Only a BCF document needs the project chosen here; the Documents API's page asks for the project itself.
        const bcfDocument = s.how === 'bcf' && !options.asVersionOf;
        if (!d || !s.connector || s.busy || (bcfDocument && !s.projectId)) return;
        // A BCF document belongs to the BCF API, BIM och GIS (platform/tier), also capped by the server's own tier.
        if (bcfDocument && !tier.shows('cde.bcf', { server: s.connector.id })) return;
        s.busy = 'send'; s.error = ''; s.done = ''; s.progress = null; s.conflict = null; render();
        try {
          const file = await fileToSend(d);
          if (!file) { s.busy = ''; render(); return; }
          let result;
          if (s.how === 'bcf' && !options.asVersionOf) {
            result = await opencde.uploadBcfDocument(s.connector, s.projectId, file);
            s.done = t('cde.send.done.bcf', { name: file.name, id: result.guid });
          } else {
            const redirect = redirectOverride || opencde.redirectUri();
            if (!redirect) throw new Error(t('opencde.err.file.documents'));
            const version = await opencde.uploadDocument(s.connector, file, { documentId: options.asVersionOf || null, baseVersionIndex: options.asVersionOf && d.source && d.source.cde && d.source.cde.documentId === options.asVersionOf && d.source.cde.versionIndex != null ? Number(d.source.cde.versionIndex) : null, message: options.asVersionOf ? s.message : '', redirectUri: redirect, popup: popup || undefined, onProgress: (p) => { s.progress = p; renderProgress(); } });
            if (!version) { s.done = t('cde.send.cancelled'); }
            else {
              result = version;
              s.done = t('cde.send.done.document', { name: version.title || file.name, version: String(version.version_number || version.version_index) });
              const same = options.asVersionOf && d.source && d.source.cde && d.source.cde.documentId === options.asVersionOf;
              if (same) s.message = '';
              // The server moved ids the file reused (Dataregium's safety net): the stored version becomes the model, so that the next
              // change builds on the ids the server keeps. Otherwise the dataset that went back now points at that version.
              let adopted = false;
              // Merged by the server's ifcmerge with what came between its base and the latest (Dataregium's phase 5.3): the stored
              // version holds both sides and the server's ids, so it becomes the model as well.
              if (same && (version.renumbered || version.merged)) {
                try {
                  await opencde.adoptStored(s.connector, d.id, version);
                  adopted = true;
                  if (version.merged) s.done += ' ' + t('cde.send.merged', { other: String(version.merged.withVersion) });
                  if (version.renumbered) s.done += ' ' + t('cde.send.renumbered', { n: version.renumbered.count });
                } catch (err) {
                  D.log('cde', err);
                  s.error = version.merged ? t('cde.send.merged.failed', { other: String(version.merged.withVersion), detail: String((err && err.message) || err) }) : t('cde.send.renumbered.failed', { n: version.renumbered.count, detail: String((err && err.message) || err) });
                }
              }
              // When the stored version could not be fetched, the dataset keeps pointing at the version it came from, so that the server
              // refuses the next version (version_conflict) and Sök ny version offers the stored one.
              if (same && !adopted && !version.renumbered && !version.merged) {
                const cde = Object.assign({}, d.source.cde, { versionIndex: Number(version.version_index), reference: version.links && version.links.document_version_download ? version.links.document_version_download.url : d.source.cde.reference, fetchedAt: new Date().toISOString() });
                await datasets.updateMeta(d.id, { source: Object.assign({}, d.source, { cde }) });
              }
            }
          }
          if (result) {
            shell.log(s.done, 'ok'); ui.toast.show(s.done, { kind: 'ok', timeout: 8000 });
            // Sharing is part of the dataset's history, as with bundles.
            try { await datasets.appendLog(await datasets.ensureOpen(d.id), 'shared', { name: t('cde.send.log', { host: opencde.hostOf(s.connector.baseUrl) }) }); datasets.scheduleSave(d.id); } catch (err) { D.log('cde', err); }
          }
        } catch (err) {
          if (isCancelled(err)) s.done = t('cde.send.cancelled');
          else {
            fail(err);
            if (err && err.code === 'ifc_validation_failed' && err.report) refusedReport(String(err.report)).catch((e) => D.log('cde', e));
            // The server's ifcmerge found changes on both sides of the same thing (Dataregium's phase 5.3): the panel lists them.
            if (err && err.code === 'version_conflict' && Array.isArray(err.conflicts)) s.conflict = { keys: err.conflicts, details: Array.isArray(err.conflictDetails) ? err.conflictDetails : [], merge: err.merge || null };
          }
        }
        s.busy = ''; s.progress = null; render();
      }
      /** The report of a refused upload (Dataregium's OB-28): its counts in the message, and the dataset's card shows the server's check. */
      async function refusedReport(url) {
        const validation = D.require('data/ifc-validation');
        const report = await opencde.api(s.connector, url);
        const c = validation.counts(report);
        s.error = t('cde.send.refused.validation', { findings: i18n.formatNumber(c.findings), errors: i18n.formatNumber(c.errors) }) + ' ' + s.error;
        const d = ds();
        if (d) await validation.record(d.id, 'server', { status: report && report.status ? report.status : 'issues', findings: c.findings, errors: c.errors, refused: true });
        render();
      }
      const isCancelled = (err) => String((err && err.message) || '') === t('opencde.err.cancelled');
      /** While the server's page is open in a popup (sign-in, upload): stop waiting instead of sitting out the five minutes. */
      const cancelButton = () => ui.button({ label: t('common.cancel'), size: 'sm', title: t('opencde.cancel.hint'), 'data-cde-cancel': '', onClick: () => opencde.cancelPopup() });
      let progressEl = null;
      function renderProgress() {
        if (!progressEl || !s.progress) return;
        const p = s.progress;
        replace(progressEl, h('dm-progress', { value: String(p.total ? Math.round((p.done / p.total) * 100) : 0), label: t('cde.send.uploading') }), h('p', { class: 'dm-help dm-small', text: t('cde.send.progress', { done: i18n.formatBytes(p.done), total: i18n.formatBytes(p.total) }) }));
      }
      function render() {
        const d = ds();
        const nodes = [h('h3', { text: t('cde.send.title') }), h('p', { class: 'dm-help', text: t('cde.send.hint') })];
        if (!s.connectors.length) { nodes.push(h('p', { class: 'dm-help', text: t('issues.none.source') })); replace(el, h('div', { class: 'dm-card dm-stack' }, nodes)); return; }
        if (s.connectors.length > 1) {
          const sel = /** @type {any} */ (h('dm-select', { label: t('issues.source') }));
          sel.options = s.connectors.map((c) => ({ value: c.id, label: c.name }));
          sel.value = s.connector ? s.connector.id : '';
          sel.addEventListener('change', () => { s.connector = s.connectors.find((c) => c.id === sel.value) || null; s.projects = null; s.projectId = ''; s.messageMax = opencde.MESSAGE_MAX; render(); if (s.connector && opencde.signedIn(s.connector)) loadLimits().then(loadProjects); });
          nodes.push(sel);
        }
        const signed = s.connector && opencde.signedIn(s.connector);
        if (!signed) {
          nodes.push(h('p', { class: 'dm-help dm-small', text: t('issues.signin.hint', { name: s.connector ? s.connector.name : '' }) }), h('div', { class: 'dm-row' },
            ui.button({ label: t('opencde.signin'), icon: 'chevron-right', variant: 'primary', loading: s.busy === 'login', onClick: signIn }),
            s.busy === 'login' ? cancelButton() : null));
        } else {
          if (s.projects && opencde.hasBcf(s.connector)) {
            const sel = /** @type {any} */ (h('dm-select', { label: t('opencde.project') }));
            sel.options = s.projects.map((p) => ({ value: p.project_id, label: p.name }));
            sel.value = s.projectId;
            sel.addEventListener('change', () => { s.projectId = sel.value; });
            nodes.push(s.projects.length ? sel : h('p', { class: 'dm-help', text: t('opencde.projects.none') }));
          }
          if (!d) nodes.push(h('p', { class: 'dm-help', text: t('dela.inspector.hint') }));
          else {
            const profile = kinds.of(d);
            // The original file only where the export that carries it can work: a raster that kept none (a saved orthophoto, a file
            // over the limits, a copy shared without them) has nothing to send.
            const whole = profile.files ? services.exporter.formatsFor(d).find((f) => f.id === profile.wholeFormat) : null;
            const original = !!profile.files && !(whole && whole.unavailable);
            const what = /** @type {any} */ (h('dm-select', { label: t('dela.share.what') }));
            what.options = [{ value: 'dataset', label: t('cde.send.what.export', { name: d.name }) }].concat(original ? [{ value: 'original', label: t('cde.send.what.original') }] : []).concat([{ value: 'bundle', label: t('cde.send.what.bundle') }]);
            if (s.what === 'original' && !original) s.what = 'dataset';
            what.value = s.what;
            what.addEventListener('change', () => { s.what = what.value; render(); });
            const formats = services.exporter.formatsFor(d).filter((f) => !f.places && !f.kind);
            const format = /** @type {any} */ (h('dm-select', { label: t('dela.share.format') }));
            format.options = formats.map((f) => ({ value: f.id, label: t(f.key) }));
            if (!formats.some((f) => f.id === s.format)) s.format = formats[0] ? formats[0].id : '';
            format.value = s.format;
            format.addEventListener('change', () => { s.format = format.value; });
            // A server of BCF API 2.1 alone has no Documents API, so a file goes as a BCF document or not at all, and one with the
            // Documents API alone takes no BCF document; a BCF document needs the tier BIM och GIS, of the app and of the server
            // (platform/tier), and without either way the panel says why.
            const documents = opencde.hasDocuments(s.connector);
            const bcfOk = opencde.hasBcf(s.connector) && tier.shows('cde.bcf', { server: s.connector.id });
            if (!documents) s.how = 'bcf';
            else if (s.how === 'bcf' && !bcfOk) s.how = 'documents';
            if (!documents && !bcfOk) { nodes.push(tierUi.notice(ctx, 'cde.bcf', { server: s.connector.id })); replace(el, h('div', { class: 'dm-card dm-stack' }, nodes)); return; }
            const how = /** @type {any} */ (h('dm-select', { label: t('cde.send.how') }));
            how.options = (documents ? [{ value: 'documents', label: t('cde.send.how.documents') }] : []).concat(bcfOk ? [{ value: 'bcf', label: t('cde.send.how.bcf') }] : []);
            how.value = s.how;
            how.addEventListener('change', () => { s.how = how.value; render(); });
            const own = documents && d.source && d.source.cde && d.source.cde.documentId && d.source.cde.connectorId === s.connector.id ? d.source.cde : null;
            progressEl = h('div', { 'data-cde-progress': '' });
            // What the new version changes, for its message on the server (at most what the server's capability git says).
            let message = null;
            if (own) {
              message = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '2', label: t('cde.send.message'), help: t('cde.send.message.help', { n: i18n.formatNumber(s.messageMax) }), 'data-cde-message': '' }));
              message.value = s.message;
              message.addEventListener('input', () => { s.message = String(message.value || '').slice(0, s.messageMax); });
            }
            nodes.push(what, s.what === 'dataset' ? format : null, s.what === 'bundle' ? h('p', { class: 'dm-help dm-small', text: t('cde.send.what.bundle.hint') }) : null, how,
              h('p', { class: 'dm-help dm-small', text: t(s.how === 'bcf' ? 'cde.send.how.bcf.hint' : 'cde.send.how.documents.hint') }),
              message,
              h('div', { class: 'dm-row-wrap' },
                ui.button({ label: t('cde.send.button'), icon: 'upload', variant: 'primary', loading: s.busy === 'send', title: t('cde.send.button.hint'), 'data-cde-send': '', onClick: () => send() }),
                own ? ui.button({ label: t('cde.send.version', { n: String((Number(own.versionIndex) || 0) + 1) }), icon: 'upload', loading: s.busy === 'send', title: t('cde.send.version.hint'), 'data-cde-send-version': '', onClick: () => send({ asVersionOf: own.documentId }) }) : null,
                s.busy === 'send' ? cancelButton() : null),
              progressEl);
          }
        }
        if (s.error) nodes.push(h('p', { class: 'dm-error', text: s.error }));
        if (s.conflict) nodes.push(conflictReport(s.conflict));
        if (s.done) nodes.push(h('p', { class: 'dm-success', 'data-cde-done': '', text: s.done }));
        replace(el, h('div', { class: 'dm-card dm-stack' }, nodes));
        renderProgress();
      }
      /** A value of the server's conflict in brief: a typed value, a reference, a list or STEP text (Dataregium's conflict_details). */
      function brief(v) {
        if (v === null || v === undefined || v === '') return '–';
        if (typeof v === 'object') { const s = JSON.stringify(v); return s.length > 80 ? s.slice(0, 77) + '…' : s; }
        const s = String(v); return s.length > 80 ? s.slice(0, 77) + '…' : s;
      }
      /** The conflicts ifcmerge found against the latest version, with what to do. */
      function conflictReport(c) {
        const latest = c.merge && c.merge.latestVersionIndex ? String(c.merge.latestVersionIndex) : '?';
        const whole = c.keys.length === 1 && c.keys[0] === '*';
        const shown = c.details.slice(0, 20);
        return h('div', { class: 'dm-card dm-stack-sm', 'data-cde-conflicts': String(whole ? 0 : c.keys.length) },
          h('h4', { text: whole ? t('cde.send.conflict.whole', { latest }) : t('cde.send.conflict.title', { n: c.keys.length, latest }) }),
          whole ? null : h('ul', { class: 'dm-list dm-xs' }, shown.map((x) => h('li', { class: 'dm-small', text: t('cde.send.conflict.row', { key: String(x.key || ''), op: String(x.op || 'set'), base: brief(x.base), ours: brief(x.ours), theirs: brief(x.theirs) }) }))),
          !whole && c.keys.length > shown.length ? h('p', { class: 'dm-help dm-xs', text: t('compare.more', { n: i18n.formatNumber(c.keys.length - shown.length) }) }) : null,
          h('p', { class: 'dm-help dm-small', text: t('cde.send.conflict.hint', { latest }) }));
      }
      function destroy() { progressEl = null; }

      return { el, start, send, render, destroy, state: s };
    }

    return { create, setPopup: (fn, redirect) => { popup = fn; redirectOverride = redirect || null; } };
  });
})();
