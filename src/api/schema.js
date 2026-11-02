// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Connector configuration format (`*.api.json`, format id "dataspatium-api/1") and a small validator.
 * The schema object doubles as documentation (see docs/api-konfiguration.md). Only the subset of
 * JSON Schema that the format needs is implemented: type, required, properties, additionalProperties,
 * enum, items, pattern, minimum, minItems.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/schema', [], () => {
    const FORMAT_ID = 'dataspatium-api/1';
    const AUTH_TYPES = ['none', 'apiKey', 'basic', 'bearer', 'oauth2_client_credentials'];
    const PARAM_TYPES = ['string', 'number', 'boolean', 'enum', 'multi', 'date', 'text', 'querylines'];
    const PARAM_IN = ['path', 'query', 'header', 'body', 'template', 'option'];
    const PAGINATION_TYPES = ['none', 'page', 'offset', 'next-url', 'cursor', 'link-header', 'link-rel'];
    const FORMATS = ['json', 'jsonstat', 'csv', 'geojson', 'xml', 'entryscape', 'text'];
    const FAMILIES = ['pxweb', 'socialstyrelsen'];
    const ID = { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]*$' };

    const paramSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        in: { type: 'string', enum: PARAM_IN },
        label: { type: 'string' },
        help: { type: 'string' },
        type: { type: 'string', enum: PARAM_TYPES },
        required: { type: 'boolean' },
        hidden: { type: 'boolean' },
        raw: { type: 'boolean' },
        default: {},
        example: {},
        template: { type: 'string' },
        enum: { type: 'array' },
        options: { type: 'array', items: { type: 'object', required: ['value'], properties: { value: {}, label: { type: 'string' } } } },
        optionsFrom: { type: 'object', required: ['endpoint', 'value'], properties: { endpoint: { type: 'string' }, value: { type: 'string' }, label: { type: 'string' }, params: { type: 'object' } } },
        join: { type: 'string' },
        style: { type: 'string', enum: ['join', 'repeat'] },
        min: { type: 'number' },
        max: { type: 'number' },
      },
    };

    const endpointSchema = {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: ID,
        name: { type: 'string' },
        description: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST'] },
        path: { type: 'string' },
        headers: { type: 'object' },
        params: { type: 'array', items: paramSchema },
        body: {},
        bodyType: { type: 'string', enum: ['json', 'form', 'text'] },
        pagination: {
          type: 'object', required: ['type'],
          properties: { type: { type: 'string', enum: PAGINATION_TYPES }, param: { type: 'string' }, sizeParam: { type: 'string' }, size: { type: 'number' }, start: { type: 'number' }, path: { type: 'string' }, totalPath: { type: 'string' }, totalPagesPath: { type: 'string' }, rel: { type: 'string' }, maxPages: { type: 'number' } },
        },
        response: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: FORMATS },
            path: { type: 'string' },
            explode: { type: 'string' },
            constants: { type: 'object' },
            rename: { type: 'object' },
            convert: { type: 'object' },
            drop: { type: 'array', items: { type: 'string' } },
            recordTag: { type: 'string' },
            options: { type: 'object' },
          },
        },
        dataset: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, keys: { type: 'array', items: { type: 'string' } } } },
      },
    };

    const schema = {
      $id: 'https://dataspatium.local/schema/api-connector.json',
      title: 'Dataspatium API connector',
      type: 'object',
      required: ['format', 'id', 'name', 'baseUrl'],
      properties: {
        format: { type: 'string', enum: [FORMAT_ID] },
        id: ID,
        name: { type: 'string', minLength: 1 },
        publisher: { type: 'string' },
        description: { type: 'string' },
        docs: { type: 'string' },
        license: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } } },
        level: { type: 'number', enum: [1, 2] },
        baseUrl: { type: 'string', pattern: '^(https?://|dataspatium-asset://)' },
        headers: { type: 'object' },
        auth: {
          type: 'object', required: ['type'],
          properties: { type: { type: 'string', enum: AUTH_TYPES }, in: { type: 'string', enum: ['header', 'query'] }, name: { type: 'string' }, prefix: { type: 'string' }, tokenUrl: { type: 'string' }, scope: { type: 'string' }, help: { type: 'string' }, signupUrl: { type: 'string' } },
        },
        rateLimit: { type: 'object', required: ['requests', 'perSeconds'], properties: { requests: { type: 'number', minimum: 1 }, perSeconds: { type: 'number', minimum: 0.1 } } },
        family: { type: 'object', required: ['type'], properties: { type: { type: 'string', enum: FAMILIES }, version: { type: 'number' }, lang: { type: 'string' }, maxCells: { type: 'number' } } },
        endpoints: { type: 'array', items: endpointSchema },
        notes: { type: 'string' },
      },
    };

    function typeOf(v) {
      if (v === null) return 'null';
      if (Array.isArray(v)) return 'array';
      return typeof v;
    }

    function check(value, node, path, errors) {
      if (!node || typeof node !== 'object') return;
      if (node.type) {
        const t = typeOf(value);
        const ok = node.type === 'integer' ? (t === 'number' && Number.isInteger(value)) : t === node.type;
        if (!ok) { errors.push(`${path || 'roten'}: förväntade ${node.type}, fick ${t}`); return; }
      }
      if (node.enum && !node.enum.some((e) => e === value)) errors.push(`${path}: värdet ${JSON.stringify(value)} är inte ett av ${node.enum.map((e) => JSON.stringify(e)).join(', ')}`);
      if (typeof value === 'string') {
        if (node.pattern && !new RegExp(node.pattern).test(value)) errors.push(`${path}: "${value}" matchar inte mönstret ${node.pattern}`);
        if (node.minLength !== undefined && value.length < node.minLength) errors.push(`${path}: får inte vara tom`);
      }
      if (typeof value === 'number' && node.minimum !== undefined && value < node.minimum) errors.push(`${path}: måste vara minst ${node.minimum}`);
      if (Array.isArray(value)) {
        if (node.minItems !== undefined && value.length < node.minItems) errors.push(`${path}: minst ${node.minItems} poster krävs`);
        if (node.items) value.forEach((item, i) => check(item, node.items, `${path}[${i}]`, errors));
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const key of node.required || []) if (value[key] === undefined) errors.push(`${path ? path + '.' : ''}${key} saknas`);
        if (node.properties) {
          for (const [key, sub] of Object.entries(node.properties)) if (value[key] !== undefined) check(value[key], sub, path ? `${path}.${key}` : key, errors);
          if (node.additionalProperties === false) for (const key of Object.keys(value)) if (!node.properties[key]) errors.push(`${path}.${key}: okänt fält`);
        }
      }
    }

    /**
     * Validate a connector object. Returns an array of Swedish error messages (empty when valid).
     * @param {any} obj
     */
    function validate(obj) {
      const errors = [];
      check(obj, schema, '', errors);
      if (errors.length) return errors;
      const auth = obj.auth || { type: 'none' };
      if (auth.type === 'apiKey' && !auth.name) errors.push('auth.name saknas (namnet på header eller frågeparameter för nyckeln)');
      if (auth.type === 'oauth2_client_credentials' && !auth.tokenUrl) errors.push('auth.tokenUrl saknas');
      const ids = new Set();
      for (const ep of obj.endpoints || []) {
        if (ids.has(ep.id)) errors.push(`endpoints: id ${ep.id} förekommer flera gånger`);
        ids.add(ep.id);
        const names = new Set();
        for (const p of ep.params || []) {
          if (names.has(p.name)) errors.push(`endpoints.${ep.id}: parametern ${p.name} förekommer flera gånger`);
          names.add(p.name);
          if (p.optionsFrom && !(obj.endpoints || []).some((e) => e.id === p.optionsFrom.endpoint)) errors.push(`endpoints.${ep.id}.${p.name}: optionsFrom pekar på okänd endpoint ${p.optionsFrom.endpoint}`);
        }
        const pag = ep.pagination;
        if (pag && (pag.type === 'page' || pag.type === 'offset') && !pag.param) errors.push(`endpoints.${ep.id}.pagination.param saknas`);
        if (pag && (pag.type === 'next-url' || pag.type === 'cursor' || pag.type === 'link-rel') && !pag.path) errors.push(`endpoints.${ep.id}.pagination.path saknas`);
        if (pag && pag.type === 'cursor' && !pag.param) errors.push(`endpoints.${ep.id}.pagination.param saknas`);
      }
      if (!obj.family && !(obj.endpoints && obj.endpoints.length)) errors.push('Konfigurationen behöver minst en endpoint eller en family');
      return errors;
    }

    return { schema, validate, FORMAT_ID, AUTH_TYPES, PARAM_TYPES, PARAM_IN, PAGINATION_TYPES, FORMATS, FAMILIES };
  });
})();
