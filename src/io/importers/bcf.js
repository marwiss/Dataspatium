// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Importer for BCF files (.bcf, .bcfzip; BCF-XML 3.0 and 2.1, also from other programs): the topics become a table in the shape the
 * OpenCDE source gives, so that everything that knows issues (the facet, the starters, the charts) applies. Comments and viewpoint
 * components become tables of their own beside it, when there are any. The file itself is kept with the topics as their original, so
 * that the viewpoints, snapshots and documents stay with the data.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('io/importers/bcf', ['data/bcf-xml', 'data/datasets', 'api/families/opencde', 'data/dataset-files'], (bcfXml, datasets, opencde, datasetFiles) => {
    const EXT = /\.(bcf|bcfzip)$/i;
    function detect(file) { return EXT.test(file.name || ''); }
    const baseName = (name) => String(name || 'bcf').replace(/\.[^.]+$/, '');

    /**
     * @param {File} file @param {any} [options] @param {string} [name] @param {Function} [progress]
     * @returns {Promise<any>} the topics dataset; comments and components are created beside it
     */
    async function importFile(file, options = {}, name, progress) {
      if (progress) progress({ step: 'read', file: file.name });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const read = await bcfXml.read(bytes);
      if (!read.topics.length) throw new Error(D.t('bcf.err.empty'));
      const title = name || baseName(file.name);
      const source = { kind: 'file', fileName: file.name, size: file.size, format: 'bcf', bcf: { version: read.version, project: read.project } };
      const t = D.t;
      const topics = opencde.tables.topics(read.topics);
      const columns = (tb) => tb.columns.map((c) => ({ name: c, type: 'text' }));
      const handle = await datasets.createEmpty({ name: title, columns: columns(topics), source, description: read.project && read.project.name ? t('bcf.description', { project: read.project.name }) : '' });
      let main;
      try {
        await datasets.appendImportRows(handle, topics.rows);
        await datasetFiles.put(handle, [{ name: file.name || 'arenden.bcfzip', kind: 'original', type: 'application/zip', bytes }]);
        main = await datasets.finishImport(handle);
      } catch (err) { datasets.abortImport(handle); throw err; }
      const made = [main];
      if (read.comments.length) {
        const byGuid = new Map(read.topics.map((tp) => [tp.guid, tp.title]));
        const tb = opencde.tables.comments(read.comments.map((c) => Object.assign({ topic: byGuid.get(c.topic_guid) || '' }, c)));
        made.push(await datasets.create({ name: `${title}: ${t('opencde.kind.comments')}`, columns: columns(tb), rows: tb.rows, source }));
      }
      if (read.components.length) {
        const tb = opencde.tables.components(read.components);
        made.push(await datasets.create({ name: `${title}: ${t('opencde.kind.components')}`, columns: columns(tb), rows: tb.rows, source }));
      }
      return main;
    }
    /** For the preview step: the first topics as rows. */
    async function preview(file) {
      const read = await bcfXml.read(await file.arrayBuffer());
      const tb = opencde.tables.topics(read.topics);
      return { columns: tb.columns, dataRows: tb.rows.slice(0, 50), header: true, declaredTypes: tb.columns.map(() => 'text'), meta: { format: 'bcf', topics: read.topics.length, comments: read.comments.length, components: read.components.length } };
    }

    return { id: 'bcf', kind: 'table', detect, sniff: bcfXml.sniff, preview, importFile };
  });
})();
