// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The tool of "Kontrollera med AI" (decision F44 a): record_finding puts one finding (a damage or wear the AI sees in a photo, or a fault a
 * field form's measurement shows) into a list that the panel shows and saves as a table or as BCF issues. A call never touches the model:
 * the photo's number is resolved to the picture that went with the question (its name, position and time) and the element's id or guid
 * to the element of the model dataset, so that a wrong number is an answer the AI can mend. The element's condition goes into the change
 * set through set_properties on Pset_Condition (AssessmentDate, AssessmentCondition, AssessmentDescription), the only write a check
 * allows; the person previews and approves it as in Ändra. The schema is flat, with every field required (null for "not given").
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/check-tools', ['ai/model-tools', 'ai/write-tools'], (modelTools, writeTools) => {
    const t = (k, p) => D.t(k, p);
    const CONDITIONS = ['good', 'fair', 'poor', 'critical'];
    const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    const PSET = 'Pset_Condition';
    const PSET_PROPERTIES = ['AssessmentDate', 'AssessmentCondition', 'AssessmentDescription'];
    const MAX_FINDINGS = 200;
    /** The tools as the providers see them. */
    const TOOLS = [
      { name: 'record_finding', description: 'Record one finding of the check: a damage or wear you can see in a photo, or a fault a measurement of the field form shows. photo is the picture\'s number in its caption (picture 1 is 1), or null when the finding rests on the field form alone; element_id is the element\'s id (STEP id) or guid from the read tools, or null when no element is identified. condition is the element\'s condition, priority how soon it should be dealt with, action the recommended maintenance or repair. Answers the finding\'s number.',
        parameters: { type: 'object', properties: {
          photo: { type: ['integer', 'null'], description: 'the picture\'s number in its caption, or null' },
          element_id: { type: ['integer', 'string', 'null'], description: 'the element\'s id or guid, or null' },
          title: { type: 'string', description: 'a short title, in the language of the question' },
          description: { type: 'string', description: 'what you see and where, in the language of the question' },
          condition: { type: 'string', enum: CONDITIONS },
          priority: { type: 'string', enum: PRIORITIES },
          action: { type: ['string', 'null'], description: 'the recommended maintenance or repair, or null' },
        } } },
    ];
    /** The only write tool of a check. */
    const WRITES = writeTools.TOOLS.filter((tool) => tool.name === 'set_properties');
    const has = (name) => TOOLS.some((tool) => tool.name === name);

    /** An empty list of findings for one model. @param {string} [datasetId] @returns {{datasetId: string|null, findings: any[]}} */
    const create = (datasetId) => ({ datasetId: datasetId || null, findings: [] });

    const given = (v) => v !== null && v !== undefined && v !== '';
    const pad = (n) => String(n).padStart(2, '0');
    /** Today as YYYY-MM-DD in the person's own time zone. */
    function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    /** The date of a finding: the photo's when its file says so, today otherwise. */
    function dateOf(picture) {
      const m = picture && picture.when ? /^(\d{4})[-:](\d{2})[-:](\d{2})/.exec(String(picture.when)) : null;
      return m ? `${m[1]}-${m[2]}-${m[3]}` : today();
    }
    /** The element an id or a guid names, looked up in the model dataset; an unknown one is an error the AI can mend. */
    async function elementOf(x, datasetId) {
      const text = typeof x === 'string' ? x.trim() : '';
      const id = typeof x === 'number' ? x : /^\d+$/.test(text) ? Number(text) : null;
      const guid = id === null ? text : null;
      if (id !== null && (!Number.isInteger(id) || id < 1)) throw new Error('element_id must be an element\'s id (an integer) or guid, or null');
      if (guid !== null && (!guid || guid.length > 64)) throw new Error('element_id must be an element\'s id (an integer) or guid, or null');
      if (!datasetId) return { id, guid, ifcClass: null, name: null, storey: null };
      const got = await modelTools.call(datasetId, 'get_element', { id, guid });
      if (!got || got.error) throw new Error(`no element with ${id !== null ? 'id ' + id : 'guid ' + guid} in the model; find it with query_elements or get_element`);
      return { id: Number(got.id) || null, guid: got.guid ? String(got.guid) : null, ifcClass: got.ifc_class ? String(got.ifc_class) : null, name: got.name ? String(got.name) : null, storey: got.storey ? String(got.storey) : null };
    }
    /** One finding from a call, checked, with the picture and the element resolved. */
    async function build(args, context) {
      const a = args && typeof args === 'object' ? args : {};
      if (typeof a.title !== 'string' || !a.title.trim()) throw new Error('title is required: a short title of the finding');
      const condition = String(a.condition || '').toLowerCase();
      if (!CONDITIONS.includes(condition)) throw new Error(`condition must be ${CONDITIONS.join(', ')}`);
      const priority = String(a.priority || '').toLowerCase();
      if (!PRIORITIES.includes(priority)) throw new Error(`priority must be ${PRIORITIES.join(', ')}`);
      const photos = Array.isArray(context.photos) ? context.photos : [];
      let picture = null; let photo = null;
      if (given(a.photo)) {
        const n = typeof a.photo === 'string' && /^\d+$/.test(a.photo) ? Number(a.photo) : a.photo;
        if (!photos.length) throw new Error('no picture went with this question: give photo null');
        if (!Number.isInteger(n) || n < 1 || n > photos.length) throw new Error(`photo must be a picture's number, 1 to ${photos.length}, or null`);
        photo = n; picture = photos[n - 1] || null;
      }
      const element = given(a.element_id) ? await elementOf(a.element_id, context.datasetId) : null;
      const where = picture && picture.where && Number.isFinite(picture.where.lat) && Number.isFinite(picture.where.lon) ? picture.where : null;
      return {
        title: a.title.replace(/\s+/g, ' ').trim().slice(0, 200), description: given(a.description) ? String(a.description).trim().slice(0, 2000) : '',
        condition, priority, action: given(a.action) ? String(a.action).trim().slice(0, 1000) || null : null,
        photo, photoName: picture && picture.name ? String(picture.name) : null,
        picture: picture && picture.data ? { name: picture.name ? String(picture.name) : '', mediaType: String(picture.mediaType || 'image/jpeg'), data: picture.data } : null,
        elementId: element ? element.id : null, elementGuid: element ? element.guid : null, elementClass: element ? element.ifcClass : null, elementName: element ? element.name : null, storey: element ? element.storey : null,
        date: dateOf(picture), lat: where ? where.lat : null, lon: where ? where.lon : null,
      };
    }
    /**
     * Run record_finding: the finding is checked and appended to the list. Errors are answers, so the model can mend the call.
     * @param {{datasetId?: string|null, findings: any[]}} collector @param {any} args
     * @param {{datasetId?: string, photos?: Array<{name?: string, mediaType?: string, data?: string, where?: any, when?: string}>}} [context] the pictures of the question, in caption order
     * @returns {Promise<{recorded: number}|{error: string}>}
     */
    async function call(collector, args, context = {}) {
      if (!collector || !Array.isArray(collector.findings)) return { error: 'no list of findings is open' };
      if (collector.findings.length >= MAX_FINDINGS) return { error: `the list holds ${MAX_FINDINGS} findings already; sum up the rest in the answer` };
      let finding;
      try { finding = await build(args, Object.assign({ datasetId: collector.datasetId || null }, context)); } catch (e) { return { error: String((e && e.message) || e) }; }
      finding.n = collector.findings.length + 1;
      collector.findings.push(finding);
      return { recorded: finding.n };
    }
    /**
     * A write in a check: only the condition, set_properties on Pset_Condition with its own properties; anything else is refused as an
     * answer the AI can read. @param {any} cs the change set @param {string} name @param {any} args
     */
    function write(cs, name, args) {
      if (name !== 'set_properties') return { error: `${name} is not offered in a check: the only change is set_properties on ${PSET}, and elements are never created, moved or deleted` };
      const a = args && typeof args === 'object' ? args : {};
      if (String(a.pset || '').toLowerCase() !== PSET.toLowerCase()) return { error: `in a check set_properties writes ${PSET} only, not ${a.pset || 'another set'}` };
      const canonical = (p) => PSET_PROPERTIES.find((k) => !!p && k.toLowerCase() === String(p.name || '').toLowerCase());
      const props = Array.isArray(a.properties) ? a.properties : [];
      if (props.some((p) => !canonical(p))) return { error: `${PSET} has the properties ${PSET_PROPERTIES.join(', ')}` };
      return writeTools.call(cs, name, Object.assign({}, a, { pset: PSET, properties: props.map((p) => Object.assign({}, p, { name: canonical(p) })) }));
    }
    /** The element of a finding in a few words: class, id and name. @param {any} f */
    function elementText(f) {
      if (!f || (!f.elementId && !f.elementGuid)) return '';
      return [f.elementClass, f.elementId ? '#' + f.elementId : '', f.elementName].filter(Boolean).join(' ') || String(f.elementGuid);
    }
    /** One line about a finding, for the panel's list and the log. @param {any} f */
    function describe(f) {
      const element = elementText(f);
      return [t('ai.check.describe', { n: String(f.n), title: f.title, condition: t('ai.check.condition.' + f.condition), priority: t('ai.check.priority.' + f.priority) }),
        element ? t('ai.check.element', { element }) : '', f.photoName ? t('ai.check.photo', { name: f.photoName }) : '', f.action ? t('ai.check.action', { action: f.action }) : ''].filter(Boolean).join(' · ');
    }

    return { TOOLS, WRITES, CONDITIONS, PRIORITIES, PSET, PSET_PROPERTIES, MAX_FINDINGS, has, create, call, write, describe, elementText, today };
  });
})();
