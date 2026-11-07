// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Browser for a Neo4j source in Inhämta: the graph workbench (ui/api/graph-workbench) over Bolt, with the source's own address and
 * credentials. A model's page can ask for its graph (api/graph-source), and then the view opens on that model.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/neo4j-view', ['ui/base', 'api/families/neo4j', 'api/graph-source', 'ui/api/graph-workbench'], (base, neo4j, graphSource, workbench) => {
    const { t } = base;

    /** @param {{connector: any, ctx?: any, log?: Function, onDataset?: Function, refreshRight?: Function}} api */
    function create(api) {
      const { connector } = api;
      const bench = workbench.create({
        connector, ctx: api.ctx, log: api.log, onDataset: api.onDataset, onInspector: () => { if (api.refreshRight) api.refreshRight(); },
        run: graphSource.boltRunner(connector),
        hint: t('neo4j.hint', { host: neo4j.hostOf(connector.baseUrl), database: (connector.family && connector.family.database) || 'neo4j' }),
      });
      function start() {
        bench.start();
        const link = graphSource.takeLink(api.ctx, connector);
        if (link) bench.follow(link).catch((err) => D.log('neo4j-view', err));
      }
      return Object.assign({}, bench, { start });
    }
    return { create };
  });
})();
