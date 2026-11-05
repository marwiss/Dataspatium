// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A dataset's description by DCAT-AP-SE: the fields the national data portal harvests, kept in the dataset (`_meta.dcat`),
 * written as RDF/XML and read back from such a file. Nothing is sent anywhere: the file is what a publisher puts where the
 * portal collects it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/dcat', ['data/datasets'], (datasets) => {
    const THEMES = ['AGRI', 'ECON', 'EDUC', 'ENER', 'ENVI', 'GOVE', 'HEAL', 'INTR', 'JUST', 'OP_DATPRO', 'REGI', 'SOCI', 'TECH', 'TRAN'];
    const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'IRREG', 'NEVER'];
    const LICENSES = [
      { value: 'http://creativecommons.org/publicdomain/zero/1.0/', label: 'CC0 1.0' },
      { value: 'http://creativecommons.org/licenses/by/4.0/', label: 'CC BY 4.0' },
      { value: 'http://creativecommons.org/licenses/by-sa/4.0/', label: 'CC BY-SA 4.0' },
    ];
    const LANGUAGE_CODES = { sv: 'SWE', en: 'ENG', da: 'DAN', nb: 'NOR', fi: 'FIN', is: 'ISL' };
    const THEME_BASE = 'http://publications.europa.eu/resource/authority/data-theme/';
    const FREQUENCY_BASE = 'http://publications.europa.eu/resource/authority/frequency/';
    const LANGUAGE_BASE = 'http://publications.europa.eu/resource/authority/language/';
    const NS = { rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', dcat: 'http://www.w3.org/ns/dcat#', dcterms: 'http://purl.org/dc/terms/', foaf: 'http://xmlns.com/foaf/0.1/', vcard: 'http://www.w3.org/2006/vcard/ns#' };
    /** What DCAT-AP-SE requires of a dataset. */
    const REQUIRED = ['title', 'description', 'publisher', 'contactName', 'contactEmail'];
    const xml = (s) => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    /**
     * The description, with what the dataset itself knows filled in.
     * @param {any} meta @returns {any}
     */
    function of(meta) {
      const given = meta.dcat || {};
      return Object.assign({ title: meta.name || '', description: meta.description || '', publisher: '', contactName: '', contactEmail: '', keywords: Array.isArray(meta.tags) ? meta.tags : [], theme: '', frequency: '', license: '', language: 'sv', temporalFrom: '', temporalTo: '', landingPage: '' }, given);
    }
    /** @param {any} description @returns {string[]} fields that are required and empty */
    function missing(description) {
      return REQUIRED.filter((key) => !String(description[key] || '').trim());
    }
    /**
     * Save the description with the dataset.
     * @param {string} id @param {any} description
     */
    async function save(id, description) {
      const handle = await datasets.ensureOpen(id);
      handle.meta.dcat = description;
      await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['dcat', JSON.stringify(description)]);
      await datasets.save(id);
      datasets.notify('changed', { id });
    }
    /**
     * As RDF/XML.
     * @param {any} meta the dataset @returns {string}
     */
    function toRdf(meta) {
      const d = of(meta);
      const lang = d.language || 'sv';
      const text = (name, value) => (value ? `    <${name} xml:lang="${xml(lang)}">${xml(value)}</${name}>\n` : '');
      const link = (name, uri) => (uri ? `    <${name} rdf:resource="${xml(uri)}"/>\n` : '');
      const uri = d.landingPage ? xml(d.landingPage) : `urn:dataspatium:${xml(meta.id)}`;
      return `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="${NS.rdf}" xmlns:dcat="${NS.dcat}" xmlns:dcterms="${NS.dcterms}" xmlns:foaf="${NS.foaf}" xmlns:vcard="${NS.vcard}">
  <dcat:Dataset rdf:about="${uri}">
${text('dcterms:title', d.title)}${text('dcterms:description', d.description)}${d.publisher ? `    <dcterms:publisher><foaf:Agent><foaf:name>${xml(d.publisher)}</foaf:name></foaf:Agent></dcterms:publisher>\n` : ''}${d.contactName || d.contactEmail ? `    <dcat:contactPoint><vcard:Organization><vcard:fn>${xml(d.contactName)}</vcard:fn>${d.contactEmail ? `<vcard:hasEmail rdf:resource="mailto:${xml(d.contactEmail)}"/>` : ''}</vcard:Organization></dcat:contactPoint>\n` : ''}${(d.keywords || []).map((k) => text('dcat:keyword', k)).join('')}${d.theme ? link('dcat:theme', THEME_BASE + d.theme) : ''}${d.frequency ? link('dcterms:accrualPeriodicity', FREQUENCY_BASE + d.frequency) : ''}${link('dcterms:language', LANGUAGE_CODES[lang] ? LANGUAGE_BASE + LANGUAGE_CODES[lang] : '')}${d.temporalFrom || d.temporalTo ? `    <dcterms:temporal><dcterms:PeriodOfTime>${d.temporalFrom ? `<dcat:startDate>${xml(d.temporalFrom)}</dcat:startDate>` : ''}${d.temporalTo ? `<dcat:endDate>${xml(d.temporalTo)}</dcat:endDate>` : ''}</dcterms:PeriodOfTime></dcterms:temporal>\n` : ''}${link('dcat:landingPage', d.landingPage)}${meta.updatedAt ? `    <dcterms:modified>${xml(String(meta.updatedAt).slice(0, 10))}</dcterms:modified>\n` : ''}    <dcat:distribution><dcat:Distribution>
      <dcterms:title xml:lang="${xml(lang)}">${xml(d.title)}</dcterms:title>
${d.license ? `      <dcterms:license rdf:resource="${xml(d.license)}"/>\n` : ''}    </dcat:Distribution></dcat:distribution>
  </dcat:Dataset>
</rdf:RDF>
`;
    }
    /**
     * A description read from RDF/XML. What is not in the file is left out.
     * @param {string} text @returns {any}
     */
    function fromRdf(text) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const dataset = doc.getElementsByTagNameNS(NS.dcat, 'Dataset')[0];
      if (!dataset || doc.querySelector('parsererror')) throw new Error(D.t('dcat.err.file'));
      const first = (ns, name, root = dataset) => { const el = root.getElementsByTagNameNS(ns, name)[0]; return el || null; };
      const textOf = (ns, name, root) => { const el = first(ns, name, root); return el ? el.textContent.trim() : ''; };
      const resource = (ns, name, root) => { const el = first(ns, name, root); return el ? (el.getAttributeNS(NS.rdf, 'resource') || '') : ''; };
      const tail = (uri) => uri.split('/').filter(Boolean).pop() || '';
      const distribution = first(NS.dcat, 'Distribution');
      const out = {
        title: textOf(NS.dcterms, 'title'), description: textOf(NS.dcterms, 'description'), publisher: textOf(NS.foaf, 'name'),
        contactName: textOf(NS.vcard, 'fn'), contactEmail: resource(NS.vcard, 'hasEmail').replace(/^mailto:/, ''),
        keywords: Array.from(dataset.getElementsByTagNameNS(NS.dcat, 'keyword')).map((k) => k.textContent.trim()),
        theme: tail(resource(NS.dcat, 'theme')), frequency: tail(resource(NS.dcterms, 'accrualPeriodicity')),
        license: distribution ? resource(NS.dcterms, 'license', distribution) : '', temporalFrom: textOf(NS.dcat, 'startDate'), temporalTo: textOf(NS.dcat, 'endDate'), landingPage: resource(NS.dcat, 'landingPage'),
      };
      const language = tail(resource(NS.dcterms, 'language'));
      const code = Object.keys(LANGUAGE_CODES).find((k) => LANGUAGE_CODES[k] === language);
      if (code) out.language = code;
      return out;
    }

    return { THEMES, FREQUENCIES, LICENSES, REQUIRED, of, missing, save, toRdf, fromRdf };
  });
})();
