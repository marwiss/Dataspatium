// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Document templates: five built-in templates (report, codebook, per-group summary, and the inspection report and the
 * maintenance plan of a table of findings, docgen/findings) and the user's own templates in IndexedDB (table `documents`),
 * shareable as `*.doc.json` files. A template marked `findings` gets the context of a table of findings, as `codebook` gets the
 * codebook's.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/documents', ['platform/storage/idb', 'platform/sync'], (idb, sync) => {
    const FORMAT = 'dataspatium-doc/1';
    const listeners = new Set();
    function notify() { for (const fn of listeners) { try { fn(); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    const BUILTINS = [
      { id: 'builtin-rapport', name: D.t('doc.builtin.rapport.name'), builtin: true, body: D.t('doc.builtin.rapport.body'), description: D.t('doc.builtin.rapport.description') },
      { id: 'builtin-kodbok', name: D.t('doc.builtin.kodbok.name'), builtin: true, codebook: true, body: D.t('doc.builtin.kodbok.body'), description: D.t('doc.builtin.kodbok.description') },
      { id: 'builtin-grupp', name: D.t('doc.builtin.grupp.name'), builtin: true, body: D.t('doc.builtin.grupp.body'), description: D.t('doc.builtin.grupp.description') },
      { id: 'builtin-besiktning', name: D.t('doc.builtin.besiktning.name'), builtin: true, findings: true, body: D.t('doc.builtin.besiktning.body'), description: D.t('doc.builtin.besiktning.description') },
      { id: 'builtin-underhall', name: D.t('doc.builtin.underhall.name'), builtin: true, findings: true, body: D.t('doc.builtin.underhall.body'), description: D.t('doc.builtin.underhall.description') },
    ];

    async function list() { return BUILTINS.map((b) => Object.assign({}, b)).concat(await idb.listDocuments()); }
    async function get(id) { return BUILTINS.find((b) => b.id === id) || idb.getDocument(id); }
    async function save(doc) {
      const now = new Date().toISOString();
      const record = { id: doc.id && !String(doc.id).startsWith('builtin-') ? doc.id : 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: (doc.name || '').trim() || D.t('doc.untitled'), body: String(doc.body || ''), codebook: !!doc.codebook, findings: !!doc.findings, description: doc.description || '', createdAt: doc.createdAt || now, updatedAt: now };
      await idb.putDocument(record);
      notify();
      sync.broadcast('documents', 'saved', { id: record.id, name: record.name });
      return record;
    }
    async function remove(id) { if (String(id).startsWith('builtin-')) return; await idb.deleteDocument(id); notify(); sync.broadcast('documents', 'deleted', { id }); }
    sync.on((msg) => { if (msg.kind === 'documents') notify(); });
    function create(name, body) { return { id: null, name: name || '', body: body || D.t('doc.builtin.rapport.body'), codebook: false, description: '' }; }
    function exportJson(doc) { return JSON.stringify({ format: FORMAT, name: doc.name, codebook: !!doc.codebook, findings: !!doc.findings, description: doc.description || '', body: doc.body, app: 'Dataspatium', version: D.version, created: new Date().toISOString() }, null, 2) + '\n'; }
    async function importJson(text) {
      let obj;
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error(D.t('err.invalid.json')); }
      if (obj.format !== FORMAT || typeof obj.body !== 'string') throw new Error(D.t('doc.err.format', { format: FORMAT }));
      return save({ name: obj.name || D.t('doc.imported.name'), body: obj.body, codebook: !!obj.codebook, findings: !!obj.findings, description: obj.description || '' });
    }

    return { list, get, save, remove, create, exportJson, importJson, subscribe, BUILTINS, FORMAT };
  });
})();
