// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Skriv IDS med AI (decision F41 a, step 5): an Information Delivery Specification written from the person's description, with the
 * validator in the loop. The AI hands the whole file over with the tool write_ids; the app checks it (the structure here, then
 * ifctester against the chosen model in Python) and answers with the error to fix or the summary per specification. The AI goes on
 * until the file runs, then reports in words; requirements are never softened to make them pass. Nothing is written anywhere by this
 * module: the person saves the file or uploads it to the project afterwards. Tool results are marked as data.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/ids-writer', ['ai/providers', 'ai/model-tools'], (providers, modelTools) => {
    const NS = 'http://standards.buildingsmart.org/IDS';
    const MAX_ROUNDS = 8;
    const WRITE_TOOL = {
      name: 'write_ids',
      description: 'Hand over the whole IDS file as XML text (IDS 1.0, root <ids> in the namespace http://standards.buildingsmart.org/IDS). The app checks it against the model with ifctester and answers: an error in the file to fix, or the summary per specification with the checks that passed and failed and their reasons. Call it again with a corrected file when it did not run; when it ran, answer in words with a short account of what the check found.',
      parameters: { type: 'object', properties: { xml: { type: 'string', description: 'the complete IDS file' } }, required: ['xml'], additionalProperties: false },
    };
    function language() {
      const i18n = D.require('ui/i18n');
      const code = i18n.language();
      const l = (i18n.LANGUAGES || []).find((x) => x.code === code);
      return { code, label: l ? l.label : code };
    }
    /** The system text: the format in short, the rules of the loop, the model's facts and the person's language. */
    function system(lang, facts) {
      return [
        'You write an IDS file (buildingSMART Information Delivery Specification 1.0) from the person\'s description, for the IFC model described below.',
        'Hand the file over with the tool write_ids. The app checks it with ifctester against the model and answers. When the file did not run, fix what the error says and hand it over again. When it ran, do not change the requirements to make them pass: answer in words with a short account of what passed and what failed.',
        'The format: the root <ids xmlns="http://standards.buildingsmart.org/IDS" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://standards.buildingsmart.org/IDS http://standards.buildingsmart.org/IDS/1.0/ids.xsd">, then <info><title>…</title></info> and <specifications> with one <specification name="…" ifcVersion="IFC4" identifier="…"> per group of requirements. <applicability minOccurs="1" maxOccurs="unbounded"> holds the facets that choose the elements (entity with <name><simpleValue>IFCWALL</simpleValue></name>, classification, property, material, attribute, partOf) and <requirements> the facets they must meet, each with cardinality="required", "optional" or "prohibited". A property facet has <propertySet>, <baseName> and optionally <value>, with dataType such as IFCLABEL, IFCBOOLEAN, IFCLENGTHMEASURE or IFCAREAMEASURE. Entity names are upper case. A pattern is <xs:restriction base="xs:string"><xs:pattern value="…"/></xs:restriction>.',
        'Use the classes and property sets the model actually has, as listed below, and set ifcVersion to the model\'s schema.',
        `The person uses the app in ${lang.label} (${lang.code}): write titles, names, descriptions and your words in that language; the XML markup stays as it is.`,
        facts ? '[data from the app] The model: ' + JSON.stringify(facts).slice(0, 6000) : '',
      ].filter(Boolean).join(' ');
    }
    /** The light check before ifctester: well-formed XML, the root ids in its namespace, at least one specification. @param {string} xml */
    function structure(xml) {
      const doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) return 'the XML is not well-formed';
      const root = doc.documentElement;
      if (!root || root.localName !== 'ids' || root.namespaceURI !== NS) return 'the root must be <ids> in the namespace ' + NS;
      if (!doc.getElementsByTagNameNS(NS, 'specification').length) return 'the file has no specification';
      return null;
    }
    /** The table of the IDS tool as the AI's result: the summary, the failed checks with reasons (clipped) and the row count. */
    function summarise(out) {
      const cols = (out && out.columns) || [];
      const at = (r, n) => r[cols.indexOf(n)];
      const rows = (out && out.rows) || [];
      const failed = rows.filter((r) => at(r, 'status') === 'underkänd').slice(0, 40)
        .map((r) => ({ specification: at(r, 'specifikation'), requirement: at(r, 'krav'), element: [at(r, 'typ'), at(r, 'namn'), at(r, 'guid')].filter(Boolean).join(' '), reason: at(r, 'orsak') }));
      return { ran: true, summary: (out && out.summary) || null, failed, rows: rows.length };
    }
    /** The check through ifctester in Python: the file written to Python's file system, the tool run against the model. */
    async function checkWithPython(datasetId, xml) {
      const bridge = D.require('data/python-bridge').bridge;
      const path = '/data/ids/ai-' + Date.now().toString(36) + '.ids';
      await bridge.writeFile(path, new TextEncoder().encode(xml));
      return summarise(await bridge.ifcTool(datasetId, 'ids', { ids: path }));
    }

    /**
     * Writes the IDS with the validator in the loop.
     * @param {{provider: any, datasetId: string, description: string, rounds?: number, check?: (xml: string) => Promise<any>, signal?: AbortSignal,
     *   timeoutMs?: number, onEvent?: (ev: any) => void}} input check replaces ifctester (tests); rounds at most MAX_ROUNDS hand-overs
     * @returns {Promise<{xml: string, result: any, rounds: number, stopped: 'ran'|'rounds'|'cancelled'|'answered', answer: string, usage: {input: number, output: number}, messages: any[]}>}
     */
    async function write(input) {
      const rounds = Math.max(1, Math.min(MAX_ROUNDS, Math.floor(Number(input.rounds)) || 4));
      const check = input.check || ((xml) => checkWithPython(input.datasetId, xml));
      const signal = input.signal || new AbortController().signal;
      const emit = (ev) => { if (input.onEvent) { try { input.onEvent(ev); } catch (err) { console.error(err); } } };
      const facts = await modelTools.call(input.datasetId, 'get_model_overview', {}).catch(() => null);
      const messages = [{ role: 'user', content: String(input.description || '') }];
      const usage = { input: 0, output: 0 };
      let xml = ''; let result = null; let answer = ''; let stopped = 'rounds'; let used = 0;
      const sys = system(language(), facts);
      try {
        for (let turn = 0; turn < rounds * 2 + 1; turn++) {
          if (signal.aborted) { stopped = 'cancelled'; break; }
          const res = await providers.chat(input.provider, { system: sys, messages, tools: [WRITE_TOOL], maxTokens: 6000, signal, timeoutMs: input.timeoutMs || 180000 });
          usage.input += res.usage.input; usage.output += res.usage.output;
          messages.push({ role: 'assistant', content: res.content.length ? res.content : [{ type: 'text', text: res.text }] });
          const call = res.toolCalls.find((c) => c.name === WRITE_TOOL.name);
          if (!call) { answer = res.text; stopped = result && result.ran ? 'ran' : 'answered'; break; }
          used++;
          xml = String((call.args && call.args.xml) || '');
          const problem = structure(xml);
          let outcome;
          if (problem) outcome = { ran: false, error: problem };
          else { try { outcome = await check(xml); } catch (err) { outcome = { ran: false, error: String((err && err.message) || err).slice(0, 500) }; } }
          result = outcome;
          emit({ type: 'round', round: used, ran: !!outcome.ran, error: outcome.error || null, summary: outcome.summary || null });
          const results = res.toolCalls.map((c) => ({ id: c.id, name: c.name, content: '[data from the app] ' + (c === call ? JSON.stringify(outcome).slice(0, 12000) : 'unknown tool') }));
          messages.push({ role: 'tool', results });
          if (used >= rounds) { stopped = outcome.ran ? 'ran' : 'rounds'; break; }
        }
      } catch (err) {
        if (signal.aborted) stopped = 'cancelled'; else throw err;
      }
      return { xml, result, rounds: used, stopped, answer, usage, messages };
    }
    return { write, structure, summarise, system, WRITE_TOOL, MAX_ROUNDS, NS };
  });
})();
