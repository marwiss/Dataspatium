// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A new, empty building model (OB-06 Schemaval för nya modeller): the modelling wheel writes an IFC file with a project in metres,
 * the model contexts, a site, a building and a first storey in the schema the person chooses (IFC4X3_ADD2 by default, IFC4 or
 * IFC2X3), and the file becomes a model dataset like any imported one. Ändra med AI then builds in it. IfcOpenShell runs in the
 * app's Python, which starts only on the person's action and fetches its components after consent.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/ifc-new', [], () => {
    /** The schemas offered, the default first; the names are the IFC schema identifiers. */
    const SCHEMAS = ['IFC4X3_ADD2', 'IFC4', 'IFC2X3'];
    const DEFAULT_SCHEMA = SCHEMAS[0];
    const bridge = () => D.require('data/python-bridge').bridge;
    const clean = (value, fallback) => {
      const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 255);
      return text || fallback;
    };

    /**
     * The settings of a new model with the defaults filled in, or an error the person can act on.
     * @param {{name?: string, schema?: string, project?: string, site?: string, building?: string, storey?: string, elevation?: number}} input
     * @returns {{name: string, schema: string, project: string, site: string, building: string, storey: string, elevation: number}}
     */
    function settings(input = {}) {
      const schema = String(input.schema || DEFAULT_SCHEMA).toUpperCase();
      if (!SCHEMAS.includes(schema)) throw new Error(D.t('newmodel.err.schema', { schema, list: SCHEMAS.join(', ') }));
      const elevation = input.elevation == null || input.elevation === '' ? 0 : Number(input.elevation);
      if (!Number.isFinite(elevation)) throw new Error(D.t('newmodel.err.elevation'));
      const project = clean(input.project, D.t('newmodel.default.project'));
      return {
        name: clean(input.name, project),
        schema,
        project,
        site: clean(input.site, D.t('newmodel.default.site')),
        building: clean(input.building, D.t('newmodel.default.building')),
        storey: clean(input.storey, D.t('newmodel.default.storey')),
        elevation,
      };
    }

    /** A file name from the dataset name: letters, digits, dashes and underscores, ending in .ifc. */
    function fileNameOf(name) {
      const base = String(name || 'model').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
      return (base || 'model') + '.ifc';
    }

    /**
     * Write a new model with the wheel and keep it as a model dataset.
     * @param {Parameters<typeof settings>[0]} input
     * @param {{onProgress?: (share: number) => void}} [options]
     * @returns {Promise<{dataset: any, info: any}>}
     */
    async function create(input, options = {}) {
      const s = settings(input);
      const job = await bridge().runIfcNewModel(s.schema, { project: s.project, site: s.site, building: s.building, storey: s.storey, elevation: s.elevation });
      const info = job.info || {};
      if (Number(info.errors) > 0) throw new Error(D.t('newmodel.err.invalid', { n: Number(info.errors) }));
      const fileName = fileNameOf(s.name);
      // Through the importer like any other file, so that the list, the store and the kind of dataset follow as usual.
      const file = new File([job.bytes], fileName, { type: 'application/x-step' });
      const meta = await D.require('io/import').run(file, {}, null, s.name, options.onProgress ? (p) => options.onProgress(Number(p && p.share) || 0) : undefined);
      const datasets = D.require('data/datasets');
      await datasets.updateMeta(meta.id, { source: { kind: 'new', fileName, schema: s.schema, createdAt: new Date().toISOString() }, description: D.t('newmodel.description', { schema: s.schema }) });
      return { dataset: await datasets.get(meta.id), info };
    }

    return { SCHEMAS, DEFAULT_SCHEMA, settings, fileNameOf, create };
  });
})();
