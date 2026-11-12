// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A small XSD checker of our own, for the tests only (decision F47 a): it reads buildingSMART's BCF schemas with DOMParser and checks
 * an XML document against them without a library. It covers what the BCF schemas use: global and local elements, named and inline
 * complex types with xs:sequence and xs:choice (element order, minOccurs and maxOccurs), attributes and attribute groups (allowed
 * names, use="required"), xs:include, and simple types by restriction of the built-in types (string, normalizedString, double, int,
 * boolean, dateTime, anyURI) with the facets pattern, length, minLength, enumeration, whiteSpace and the four numeric bounds. Unknown
 * elements and attributes are errors; xsi: and xmlns attributes are allowed. The schemas come from tests/fixtures/bcf-schemas.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('tests/bcf-schema-check', [], () => {
    const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
    const kids = (el) => Array.from(el ? el.children : []);
    const xs = (el, name) => kids(el).filter((c) => c.localName === name);
    const local = (q) => String(q || '').replace(/^[^:]*:/, '');
    const isBuiltin = (q) => /^xs:/.test(String(q || ''));

    /** One schema file with the definitions of the files it includes. */
    function scopeOf(files, name, seen = new Set()) {
      const scope = { elements: new Map(), complex: new Map(), simple: new Map(), attributes: new Map(), groups: new Map() };
      if (seen.has(name) || !files[name]) return scope;
      seen.add(name);
      const doc = new DOMParser().parseFromString(files[name], 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('schema not readable: ' + name);
      const root = doc.documentElement;
      for (const inc of xs(root, 'include')) {
        const other = scopeOf(files, String(inc.getAttribute('schemaLocation')).split('/').pop(), seen);
        for (const k of Object.keys(scope)) for (const [n, v] of other[k]) scope[k].set(n, v);
      }
      const into = { element: 'elements', complexType: 'complex', simpleType: 'simple', attribute: 'attributes', attributeGroup: 'groups' };
      for (const el of kids(root)) if (into[el.localName] && el.getAttribute('name')) scope[into[el.localName]].set(el.getAttribute('name'), el);
      return scope;
    }

    // ------------------------------------------------------------------------------------------------ simple types
    const BUILTIN = {
      string: () => true,
      anyURI: () => true,
      normalizedString: (v) => !/[\r\n\t]/.test(v),
      boolean: (v) => /^(true|false|1|0)$/.test(v),
      int: (v) => /^[+-]?\d+$/.test(v) && Math.abs(Number(v)) <= 2147483648,
      double: (v) => /^([+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?|[+-]?INF|NaN)$/.test(v),
      dateTime: (v) => /^-?\d{4,}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(v),
    };
    const COLLAPSED = new Set(['boolean', 'int', 'double', 'dateTime', 'anyURI']);
    const collapse = (v) => v.replace(/[\t\r\n ]+/g, ' ').trim();
    /** The problems of a value against a simple type: a built-in name, a named type or an inline xs:simpleType. */
    function simpleErrors(scope, type, raw, where) {
      if (typeof type === 'string') {
        if (isBuiltin(type)) {
          const base = local(type);
          const v = COLLAPSED.has(base) ? collapse(raw) : raw;
          const check = BUILTIN[base];
          if (!check) return [`${where}: the checker does not know ${type}`];
          return check(v) ? [] : [`${where}: "${raw}" is no ${type}`];
        }
        const named = scope.simple.get(local(type));
        return named ? simpleErrors(scope, named, raw, where) : [`${where}: unknown type ${type}`];
      }
      const r = xs(type, 'restriction')[0];
      if (!r) return [];
      const base = r.getAttribute('base') || 'xs:string';
      const errors = simpleErrors(scope, base, raw, where);
      const facets = (name) => xs(r, name).map((f) => f.getAttribute('value'));
      const ws = facets('whiteSpace')[0];
      const v = ws === 'collapse' || COLLAPSED.has(local(base)) ? collapse(raw) : ws === 'replace' ? raw.replace(/[\t\r\n]/g, ' ') : raw;
      const length = facets('length')[0]; const min = facets('minLength')[0];
      if (length !== undefined && v.length !== Number(length)) errors.push(`${where}: "${raw}" should have ${length} characters`);
      if (min !== undefined && v.length < Number(min)) errors.push(`${where}: "${raw}" should have at least ${min} characters`);
      for (const p of facets('pattern')) if (!new RegExp('^(?:' + p + ')$').test(v)) errors.push(`${where}: "${raw}" does not match ${p}`);
      const en = facets('enumeration');
      if (en.length && !en.includes(v)) errors.push(`${where}: "${raw}" is not one of ${en.join(', ')}`);
      const n = Number(v);
      for (const [name, ok] of [['minExclusive', (b) => n > b], ['maxExclusive', (b) => n < b], ['minInclusive', (b) => n >= b], ['maxInclusive', (b) => n <= b]]) {
        const bound = facets(name)[0];
        if (bound !== undefined && !ok(Number(bound))) errors.push(`${where}: ${v} breaks ${name} ${bound}`);
      }
      return errors;
    }

    // ------------------------------------------------------------------------------------------------ content models
    const occurs = (p, name) => { const v = p.getAttribute(name); return v === null ? 1 : v === 'unbounded' ? Infinity : Number(v); };
    const PARTICLES = new Set(['element', 'sequence', 'choice']);
    const particles = (el) => kids(el).filter((c) => PARTICLES.has(c.localName));
    const elementName = (scope, p) => (p.getAttribute('ref') ? local(p.getAttribute('ref')) : p.getAttribute('name'));
    /** Where one particle, with its own minOccurs and maxOccurs, can end when it starts at child `start`. */
    function ends(scope, p, list, start) {
      const min = occurs(p, 'minOccurs'); const max = occurs(p, 'maxOccurs');
      const result = new Set(min === 0 ? [start] : []);
      let current = new Set([start]);
      for (let n = 1; n <= Math.min(max, list.length - start + 1) && current.size; n++) {
        const next = new Set();
        for (const s of current) for (const e of once(scope, p, list, s)) next.add(e);
        if (n >= min) for (const e of next) result.add(e);
        current = next;
      }
      return result;
    }
    function once(scope, p, list, s) {
      if (p.localName === 'element') return s < list.length && list[s].localName === elementName(scope, p) ? new Set([s + 1]) : new Set();
      if (p.localName === 'sequence') {
        let cur = new Set([s]);
        for (const c of particles(p)) { const next = new Set(); for (const x of cur) for (const e of ends(scope, c, list, x)) next.add(e); cur = next; if (!cur.size) break; }
        return cur;
      }
      const out = new Set();
      for (const c of particles(p)) for (const e of ends(scope, c, list, s)) out.add(e);
      return out;
    }
    /** The declaration of a child by its name, anywhere in a content model (the BCF schemas give a name one type per parent). */
    function declIn(scope, p, name) {
      for (const c of particles(p)) {
        if (c.localName === 'element') { if (elementName(scope, c) === name) return c.getAttribute('ref') ? scope.elements.get(name) : c; } else { const d = declIn(scope, c, name); if (d) return d; }
      }
      return null;
    }
    /** The attributes a complex type allows, by name, with their declarations. */
    function attributesOf(scope, holder, out = new Map()) {
      for (const a of xs(holder, 'attribute')) {
        const ref = a.getAttribute('ref');
        const name = ref ? local(ref) : a.getAttribute('name');
        out.set(name, { use: a.getAttribute('use') || 'optional', decl: ref ? scope.attributes.get(name) || a : a });
      }
      for (const g of xs(holder, 'attributeGroup')) { const group = scope.groups.get(local(g.getAttribute('ref'))); if (group) attributesOf(scope, group, out); }
      return out;
    }
    const typeOfDecl = (decl) => decl.getAttribute('type') || xs(decl, 'simpleType')[0] || xs(decl, 'complexType')[0] || null;

    /** The problems of one element against its declaration, and of its children against theirs. */
    function elementErrors(scope, el, decl, path) {
      const errors = [];
      if (el.namespaceURI) errors.push(`${path}: in the namespace ${el.namespaceURI}, the schema has none`);
      let type = typeOfDecl(decl);
      if (typeof type === 'string' && !isBuiltin(type)) type = scope.complex.get(local(type)) || scope.simple.get(local(type)) || type;
      const attrs = Array.from(el.attributes).filter((a) => a.namespaceURI !== XSI && a.name !== 'xmlns' && !a.name.startsWith('xmlns:'));
      const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3 || n.nodeType === 4).map((n) => n.textContent).join('');
      // No type at all is xs:anyType, which takes anything.
      if (!type) return errors;
      if (typeof type === 'string' || type.localName === 'simpleType') {
        if (attrs.length) errors.push(`${path}: attributes are not allowed here (${attrs.map((a) => a.name).join(', ')})`);
        if (kids(el).length) errors.push(`${path}: elements are not allowed in a value (${kids(el).map((c) => c.localName).join(', ')})`);
        errors.push(...simpleErrors(scope, type, textNodes, path));
        return errors;
      }
      // A complex type: its attributes, then its content.
      const allowed = attributesOf(scope, type);
      for (const a of attrs) {
        const known = allowed.get(a.name);
        if (!known) { errors.push(`${path}: the attribute ${a.name} is not in the schema`); continue; }
        const at = typeOfDecl(known.decl);
        if (at) errors.push(...simpleErrors(scope, at, a.value, `${path}/@${a.name}`));
      }
      for (const [name, known] of allowed) if (known.use === 'required' && !el.hasAttribute(name)) errors.push(`${path}: the required attribute ${name} is missing`);
      const model = particles(type)[0];
      const list = kids(el);
      // Empty content takes no text at all, not even white space; element content takes white space between the elements.
      if (!model ? textNodes.length : textNodes.trim()) errors.push(`${path}: text is not allowed here ("${textNodes.trim().slice(0, 40) || 'white space'}")`);
      if (!model) { if (list.length) errors.push(`${path}: no elements are allowed here (${list.map((c) => c.localName).join(', ')})`); return errors; }
      const reach = ends(scope, model, list, 0);
      if (!reach.has(list.length)) {
        const furthest = Math.max(-1, ...Array.from(reach));
        errors.push(furthest < list.length && furthest >= 0 && reach.size
          ? `${path}: <${list[furthest].localName}> is not allowed at this place (children: ${list.map((c) => c.localName).join(', ') || 'none'})`
          : `${path}: the children do not follow the schema, a required element may be missing (children: ${list.map((c) => c.localName).join(', ') || 'none'})`);
      }
      list.forEach((child, i) => {
        const d = declIn(scope, model, child.localName);
        if (!d) { errors.push(`${path}: the element ${child.localName} is not in the schema`); return; }
        errors.push(...elementErrors(scope, child, d, `${path}/${child.localName}[${i}]`));
      });
      return errors;
    }

    /**
     * A checker for one set of schemas: `{ 'markup.xsd': text, ... }`. `check(xml)` gives the problems of a document as sentences
     * (empty when it is valid), against the schema file that declares its root element.
     * @param {Record<string, string>} files
     */
    function create(files) {
      const scopes = Object.keys(files).map((name) => {
        const own = new Set(xs(new DOMParser().parseFromString(files[name], 'application/xml').documentElement, 'element').map((e) => e.getAttribute('name')));
        return { name, own, scope: scopeOf(files, name) };
      });
      function check(xml, label = 'document') {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) return [`${label}: not well-formed XML`];
        const root = doc.documentElement;
        const hit = scopes.find((s) => s.own.has(root.localName));
        if (!hit) return [`${label}: no schema declares <${root.localName}>`];
        return elementErrors(hit.scope, root, hit.scope.elements.get(root.localName), `${label} ${root.localName}`);
      }
      return { check };
    }

    /**
     * Every XML file of a BCF archive checked against the schemas of its version: bcf.version, project.bcfp, extensions.xml and
     * documents.xml (3.0), each markup.bcf and each .bcfv. Returns the problems, empty when the archive is valid.
     * @param {Record<string, Record<string, string>>} schemas by version @param {Record<string, Uint8Array>} entries @param {string} version
     * @returns {string[]}
     */
    function checkArchive(schemas, entries, version) {
      const checker = create(schemas[version]);
      const out = [];
      for (const [name, bytes] of Object.entries(entries)) {
        if (!/(^|\/)(bcf\.version|extensions\.xml|documents\.xml|markup\.bcf)$|\.(bcfv|bcfp)$/i.test(name)) continue;
        out.push(...checker.check(new TextDecoder().decode(bytes), name));
      }
      return out;
    }

    /** The schemas, loaded once from tests/fixtures/bcf-schemas/schemas.js; null when the folder is not in this copy. */
    let loaded;
    async function schemas() {
      if (loaded !== undefined) return loaded;
      try { await D.assets.loadScript('fixtures/bcf-schemas/schemas.js'); loaded = D.require('tests/fixtures/bcf-schemas'); } catch (_e) { loaded = null; }
      return loaded;
    }
    /**
     * A BCF file the app wrote (a Blob or bytes), checked against the schemas of a version: the problems, empty when it is valid, or
     * null when the schemas are not in this copy (the release ZIP leaves them out).
     * @param {Blob|Uint8Array|ArrayBuffer} file @param {string} [version] @returns {Promise<string[]|null>}
     */
    async function checkBlob(file, version = '3.0') {
      const sc = await schemas();
      if (!sc) return null;
      const bytes = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : file instanceof Uint8Array ? file : new Uint8Array(file);
      return checkArchive(sc, await D.require('platform/storage/zip').readZip(bytes), version);
    }

    return { create, checkArchive, schemas, checkBlob };
  });
})();
