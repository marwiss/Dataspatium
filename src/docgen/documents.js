// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Document templates: three built-in templates (report, codebook, per-group summary) and the user's
 * own templates in IndexedDB (table `documents`), shareable as `*.doc.json` files.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/documents', ['platform/storage/idb'], (idb) => {
    const FORMAT = 'dataspatium-doc/1';
    const listeners = new Set();
    function notify() { for (const fn of listeners) { try { fn(); } catch (err) { console.error(err); } } }
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    const REPORT = `# {{datamangd}}

*Rapport skapad {{datum}} med {{app}}.*

{{#beskrivning}}{{beskrivning}}

{{/beskrivning}}Datamängden innehåller **{{antal_rader}} rader** och **{{antal_kolumner}} kolumner**.{{#kalla}} Källa: {{kalla}}.{{/kalla}}

## Kolumner

{{#tabell}}kalla: kolumner; rubrik: Kolumner i datamängden{{/tabell}}

## De första raderna

{{#tabell}}topp: 20; rubrik: De 20 första raderna{{/tabell}}

## Diagram

Lägg in ett sparat diagram med taggen diagram följt av diagrammets namn inom citattecken, se hjälpen till höger. Ta bort det här stycket när du är klar.
`;
    const CODEBOOK = `# Kodbok: {{datamangd}}

*Skapad {{datum}} med {{app}}.*

{{#beskrivning}}{{beskrivning}}

{{/beskrivning}}Datamängden har **{{antal_rader}} rader**, **{{antal_kolumner}} kolumner** och {{dubbletter}} dubblettrader.{{#kalla}} Källa: {{kalla}}.{{/kalla}}

{{#kolumner}}
## {{namn}}

- Typ: {{typ}}
- Etikett: {{etikett}}
- Saknade värden: {{saknade}}
- Unika värden: {{unika}}{{#ar_unik}} (unik nyckel){{/ar_unik}}
- Intervall: {{minsta}} – {{storsta}}
{{#medel}}- Medel: {{medel}}
{{/medel}}{{#anmarkningar}}- Anmärkningar: {{anmarkningar}}
{{/anmarkningar}}
{{/kolumner}}
`;
    const GROUP = `# {{datamangd}}: {{grupp}}

*{{gruppkolumn}} = {{grupp}}. Skapad {{datum}} med {{app}}.*

Urvalet omfattar **{{antal_rader}} rader**.

{{#tabell}}topp: 50; rubrik: Rader för {{grupp}}{{/tabell}}
`;
    const BUILTINS = [
      { id: 'builtin-rapport', name: 'Rapport om datamängd', builtin: true, body: REPORT, description: 'Översikt med kolumner, de första raderna och plats för diagram.' },
      { id: 'builtin-kodbok', name: 'Kodbok', builtin: true, codebook: true, body: CODEBOOK, description: 'En sektion per kolumn med typ, saknade och unika värden, intervall och anmärkningar.' },
      { id: 'builtin-grupp', name: 'Sammanställning per grupp', builtin: true, body: GROUP, description: 'Avsedd för batch per grupp: rubrik med gruppens värde och en tabell med gruppens rader.' },
    ];

    async function list() { return BUILTINS.map((b) => Object.assign({}, b)).concat(await idb.listDocuments()); }
    async function get(id) { return BUILTINS.find((b) => b.id === id) || idb.getDocument(id); }
    async function save(doc) {
      const now = new Date().toISOString();
      const record = { id: doc.id && !String(doc.id).startsWith('builtin-') ? doc.id : 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: (doc.name || '').trim() || 'Namnlös mall', body: String(doc.body || ''), codebook: !!doc.codebook, description: doc.description || '', createdAt: doc.createdAt || now, updatedAt: now };
      await idb.putDocument(record);
      notify();
      return record;
    }
    async function remove(id) { if (String(id).startsWith('builtin-')) return; await idb.deleteDocument(id); notify(); }
    function create(name, body) { return { id: null, name: name || '', body: body || REPORT, codebook: false, description: '' }; }
    function exportJson(doc) { return JSON.stringify({ format: FORMAT, name: doc.name, codebook: !!doc.codebook, description: doc.description || '', body: doc.body, app: 'Dataspatium', version: D.version, created: new Date().toISOString() }, null, 2) + '\n'; }
    async function importJson(text) {
      let obj;
      try { obj = JSON.parse(String(text).replace(/^﻿/, '')); } catch (_e) { throw new Error('Filen är inte giltig JSON.'); }
      if (obj.format !== FORMAT || typeof obj.body !== 'string') throw new Error('Filen är inte en Dataspatium-dokumentmall (format ' + FORMAT + ').');
      return save({ name: obj.name || 'Importerad mall', body: obj.body, codebook: !!obj.codebook, description: obj.description || '' });
    }

    return { list, get, save, remove, create, exportJson, importJson, subscribe, BUILTINS, FORMAT };
  });
})();
