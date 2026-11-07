// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Kontroll's IFC graph as the app reads it (the server's docs/ifcgraph.md and graph-schema.md). Every IFC entity is a node labelled
 * IfcEntity, its class and all its supertypes, in no particular order, with `ifc_class`, `step_id`, `model_id` and the literal attributes
 * by their IFC names; relationships are named after the attributes, forward and inverse. Pure logic: which class and name a node shows,
 * which family colours it, the models on the server, the ready-made views of one model, the steps from one element, and the properties
 * that never leave an answer.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/ifc-graph', [], () => {
    /** Stored hashes of secrets (Kontroll's password_hash, secret_hash, token_hash, code_hash and their like). */
    const PROTECTED = /(^|_)(password|secret|token|code)_hash$/i;
    const HASHED_VALUE = /^\$argon2/;
    const NAME_KEYS = ['name', 'Name', 'namn', 'title', 'titel', 'file_name', 'filename', 'username', 'label', 'ifc_guid', 'comment', 'guid', 'id', 'project_id', 'document_id', 'client_id'];
    const MAX_NAME = 80;
    const present = (v) => v !== null && v !== undefined && v !== '' && typeof v !== 'object';

    /**
     * The class a node counts as: its concrete IFC class, otherwise its first label other than IfcEntity. The driver gives labels in the
     * database's own order, so labels[0] says nothing on a node with many.
     * @param {string[]} labels @param {Record<string, any>} [properties] @returns {string}
     */
    function classOf(labels, properties) {
      if (properties && properties.ifc_class) return String(properties.ifc_class);
      const list = labels || [];
      return list.find((l) => l !== 'IfcEntity') || list[0] || '';
    }
    /**
     * A display name for a node. An IFC entity shows its Name, with the value for a property or a quantity, otherwise its class and STEP
     * number; other nodes the first property that says what they are. Empty when nothing does.
     * @param {Record<string, any>} [properties] @returns {string}
     */
    function nameOf(properties) {
      const p = properties || {};
      let name = '';
      if (p.ifc_class) {
        const base = present(p.Name) ? String(p.Name) : present(p.LongName) ? String(p.LongName) : '';
        const valueKey = Object.keys(p).find((k) => /Value$/.test(k) && present(p[k]));
        if (!base) name = `${p.ifc_class}${present(p.step_id) ? ' #' + p.step_id : ''}`;
        else name = valueKey ? `${base}: ${p[valueKey]}` : base;
      } else {
        const key = NAME_KEYS.find((k) => present(p[k]));
        name = key ? String(p[key]) : '';
      }
      return name.length > MAX_NAME ? name.slice(0, MAX_NAME - 1) + '…' : name;
    }
    /**
     * Which family an IFC node belongs to, for its colour: 39 classes in the smallest model would otherwise share twelve colours. Null for a
     * node that is not an IFC entity.
     * @param {{label?: string, properties?: Record<string, any>}} node @returns {string|null}
     */
    function familyOf(node) {
      const p = (node && node.properties) || {};
      if (!p.ifc_class) return null;
      const labels = new Set(Array.isArray(p.etiketter) ? p.etiketter : [node.label]);
      if (labels.has('IfcProject') || labels.has('IfcSpatialStructureElement') || labels.has('IfcSpatialElement')) return 'spatial';
      if (labels.has('IfcRelationship')) return 'relation';
      if (labels.has('IfcProduct')) return 'element';
      if (labels.has('IfcTypeObject')) return 'type';
      if (labels.has('IfcPropertyDefinition') || labels.has('IfcProperty') || labels.has('IfcPhysicalQuantity')) return 'property';
      if (/^IfcMaterial/.test(String(p.ifc_class))) return 'material';
      return 'other';
    }
    /** The key a drawing colours a node by: `ifc:<family>` for IFC entities, the label for everything else. @param {any} node */
    function colorKey(node) {
      const family = familyOf(node);
      return family ? 'ifc:' + family : (node.label || '');
    }
    /**
     * A value without stored hashes of secrets: protected keys are removed at every depth, an Argon2 hash anywhere becomes null. A Bolt
     * connection reads the whole database, the accounts included, so `MATCH (n) RETURN n` must not carry hashes into a dataset.
     * @param {any} value @returns {any}
     */
    function redact(value) {
      if (typeof value === 'string') return HASHED_VALUE.test(value) ? null : value;
      if (Array.isArray(value)) return value.map(redact);
      if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        const out = {};
        for (const [k, v] of Object.entries(value)) if (!PROTECTED.test(k)) out[k] = redact(v);
        return out;
      }
      return value;
    }
    /** Whether a result column holds a protected property (`u.password_hash`, or an alias with the same name). @param {string} column */
    const isProtected = (column) => PROTECTED.test(String(column).split('.').pop());

    /** A string as a Cypher literal. @param {any} value */
    const quote = (value) => "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

    /** Every model the graph knows, with what the app shows of it. Read by the columns' names in `modelsOf`. */
    const MODELS = "MATCH (m:IfcModel)\nOPTIONAL MATCH (p:Project)-[:HAS_MODEL]->(m)\nRETURN m.id AS id, m.file_name AS fil, m.state AS tillstand, m.version_index AS version, m.entities AS entiteter, m.relationships AS relationer, m.schema AS schema, m.error AS fel, coalesce(m.document_id, m.bcf_document_guid) AS dokument, p.name AS projekt, coalesce(m.done_at, m.created_at) AS klar\nORDER BY projekt, fil, version DESC, klar DESC";
    /**
     * The answer to MODELS as lists: finished models, the newest version of each document first and marked `latest` (older versions stay
     * in the graph until pruned), and how many wait or failed.
     * @param {{columns: string[], rows: any[][]}} table
     * @returns {{models: any[], waiting: number, failed: number}}
     */
    function modelsOf(table) {
      const at = (row, name) => row[table.columns.indexOf(name)];
      const all = table.rows.map((row) => ({ id: String(at(row, 'id')), file: String(at(row, 'fil') || ''), state: String(at(row, 'tillstand') || ''), version: at(row, 'version'), entities: at(row, 'entiteter'), relationships: at(row, 'relationer'), schema: at(row, 'schema') || '', error: at(row, 'fel') || '', document: at(row, 'dokument') || '', project: at(row, 'projekt') || '', doneAt: String(at(row, 'klar') || ''), latest: false }));
      const models = all.filter((m) => m.state === 'done').sort((a, b) => String(a.project).localeCompare(String(b.project)) || a.file.localeCompare(b.file) || (Number(b.version) || 0) - (Number(a.version) || 0) || b.doneAt.localeCompare(a.doneAt));
      const seen = new Set();
      for (const m of models) { const key = m.document || m.id; m.latest = !seen.has(key); seen.add(key); }
      return { models, waiting: all.filter((m) => m.state === 'queued' || m.state === 'running').length, failed: all.filter((m) => m.state === 'failed').length };
    }
    /**
     * The model a link asks for: the same document and version, otherwise the document's newest, otherwise the first newest there is.
     * @param {any[]} models @param {{documentId?: string|null, versionIndex?: number|null}|null} [link] @returns {any|null}
     */
    function pickModel(models, link) {
      if (link && link.documentId) {
        const ofDocument = models.filter((m) => m.document === link.documentId);
        const exact = ofDocument.find((m) => link.versionIndex != null && Number(m.version) === Number(link.versionIndex));
        if (exact || ofDocument.length) return exact || ofDocument[0];
      }
      return models.find((m) => m.latest) || models[0] || null;
    }

    /**
     * Ready-made views of one model. `graph: false` answers with a table only. Every view has a limit, since a large architectural model
     * has millions of entities; the app says when an answer reached it.
     */
    const VIEWS = [
      { id: 'spatial', layout: 'dagre', cypher: (m) => `MATCH (p:IfcProject {model_id: ${m}})-[:IS_DECOMPOSED_BY|RELATED_OBJECTS*0..12]->(x)\nOPTIONAL MATCH (x)-[r:IS_DECOMPOSED_BY|RELATED_OBJECTS]->(y)\nRETURN x, r, y\nLIMIT 1000` },
      { id: 'elements', layout: 'dagre', cypher: (m) => `MATCH (s:IfcEntity {model_id: ${m}})-[a:CONTAINS_ELEMENTS]->(c)-[b:RELATED_ELEMENTS]->(e)\nRETURN s, a, c, b, e\nLIMIT 1000` },
      { id: 'types', layout: 'fcose', cypher: (m) => `MATCH (e:IfcProduct {model_id: ${m}})-[a:IS_DEFINED_BY]->(r:IfcRelDefinesByType)-[b:RELATING_TYPE]->(y)\nRETURN e, a, r, b, y\nLIMIT 1000` },
      { id: 'materials', layout: 'fcose', cypher: (m) => `MATCH (e:IfcProduct {model_id: ${m}})-[a:HAS_ASSOCIATIONS]->(r:IfcRelAssociatesMaterial)-[b:RELATING_MATERIAL]->(x)\nRETURN e, a, r, b, x\nLIMIT 1000` },
      { id: 'properties', layout: 'fcose', cypher: (m) => `MATCH (e:IfcProduct {model_id: ${m}})-[a:IS_DEFINED_BY]->(r:IfcRelDefinesByProperties)-[b:RELATING_PROPERTY_DEFINITION]->(s)-[c:HAS_PROPERTIES|QUANTITIES]->(p)\nRETURN e, a, r, b, s, c, p\nLIMIT 1000` },
      { id: 'issues', layout: 'dagre', cypher: (m) => `MATCH (t:Topic)-[a:HAS_VIEWPOINT]->(v:Viewpoint)-[b:HAS_COMPONENT]->(c:Component)-[d:SAME_AS]->(e:IfcEntity {model_id: ${m}})\nRETURN t, a, v, b, c, d, e\nLIMIT 1000` },
      { id: 'whole', layout: 'fcose', cypher: (m) => `MATCH (a:IfcEntity {model_id: ${m}})-[r]->(b:IfcEntity)\nRETURN a, r, b\nLIMIT 1000` },
      { id: 'classes', layout: 'fcose', graph: false, cypher: (m) => `MATCH (e:IfcEntity {model_id: ${m}})\nRETURN e.ifc_class AS klass, count(*) AS antal\nORDER BY antal DESC` },
    ];
    /**
     * The Cypher of a view of a model. @param {string} viewId @param {string} modelId @returns {{cypher: string, layout: string, graph: boolean}|null}
     */
    function viewOf(viewId, modelId) {
      const view = VIEWS.find((v) => v.id === viewId);
      return view ? { cypher: view.cypher(quote(modelId)), layout: view.layout, graph: view.graph !== false } : null;
    }
    /** What can be fetched from one node. `issues` and `properties` only mean something on a product. */
    const STEPS = {
      neighbours: (n) => `MATCH (n)-[r]-(m)\nWHERE elementId(n) = ${n}\nRETURN n, r, m\nLIMIT 200`,
      properties: (n) => `MATCH (n)-[a:IS_DEFINED_BY]->(r:IfcRelDefinesByProperties)-[b:RELATING_PROPERTY_DEFINITION]->(s)-[c:HAS_PROPERTIES|QUANTITIES]->(p)\nWHERE elementId(n) = ${n}\nRETURN n, a, r, b, s, c, p\nLIMIT 500`,
      issues: (n) => `MATCH (t:Topic)-[a:HAS_VIEWPOINT]->(v:Viewpoint)-[b:HAS_COMPONENT]->(c:Component)-[d:SAME_AS]->(n)\nWHERE elementId(n) = ${n}\nRETURN t, a, v, b, c, d, n\nLIMIT 200`,
    };
    /** The Cypher of a step from a node. @param {'neighbours'|'properties'|'issues'} step @param {string} nodeId the database's element id */
    const stepFrom = (step, nodeId) => STEPS[step](quote(nodeId));
    /** One element by its GlobalId, with its neighbours. @param {string} guid @param {string} [modelId] */
    const element = (guid, modelId) => `MATCH (n:IfcEntity {GlobalId: ${quote(guid)}${modelId ? `, model_id: ${quote(modelId)}` : ''}})-[r]-(m)\nRETURN n, r, m\nLIMIT 200`;
    /** The relationships among some nodes, with the ids in the parameter `ids`. An answer that names only nodes shows how they hang together. */
    const CONNECTING = 'MATCH (a)-[r]->(b)\nWHERE elementId(a) IN $ids AND elementId(b) IN $ids\nRETURN a, r, b\nLIMIT 2000';
    /** The limit a query ends with, if any. @param {string} text @returns {number|null} */
    function limitOf(text) {
      const m = /\bLIMIT\s+(\d+)\s*;?\s*$/i.exec(String(text));
      return m ? Number(m[1]) : null;
    }

    return { classOf, nameOf, familyOf, colorKey, redact, isProtected, quote, MODELS, modelsOf, pickModel, VIEWS, viewOf, stepFrom, element, CONNECTING, limitOf };
  });
})();
