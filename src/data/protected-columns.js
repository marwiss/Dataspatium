// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Columns a view of the dataset cannot do without: the graph needs the node's id, a plan its geometry, a gallery its file
 * names. The table stays fully editable, so nothing here forbids anything. touched() lets a dialog ask first, and lost()
 * catches what no dialog could foresee, such as a pivot, a code step or SQL.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/protected-columns', ['viz/leaflet', 'data/kinds'], (leaflet, kinds) => {
    /**
     * The columns of a dataset that its own view needs.
     * @param {any} meta @param {Array<{name: string}>} columns @returns {string[]}
     */
    function list(meta, columns) {
      if (kinds.isCollection(meta)) return kinds.guarded(meta, columns);
      const geometry = leaflet.geometryColumn(columns);
      if (geometry) return [geometry];
      if (!leaflet.mapDefault(columns)) return [];
      const coordinates = leaflet.coordinateColumns(columns);
      return coordinates ? [coordinates.lon, coordinates.lat] : [];
    }

    /**
     * The columns an operation would rename, remove or give another type, as far as its settings say.
     * @param {string} opId @param {any} params @returns {string[]}
     */
    function touched(opId, params) {
      if (opId === 'rename_column' || opId === 'set_type') return params.column ? [params.column] : [];
      if (opId === 'drop_columns') return Array.isArray(params.columns) ? params.columns : [];
      return [];
    }

    /**
     * Which of the protected columns are gone or have another type after a step.
     * @param {string[]} guarded @param {Array<{name: string, type: string}>} before @param {Array<{name: string, type: string}>} after
     * @returns {string[]}
     */
    function lost(guarded, before, after) {
      return guarded.filter((name) => {
        const was = before.find((c) => c.name === name);
        const now = after.find((c) => c.name === name);
        return !now || (was && now.type !== was.type);
      });
    }

    return { list, touched, lost };
  });
})();
