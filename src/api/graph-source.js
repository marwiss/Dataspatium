// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The ways to a server's graph. Two transports give the same answer {columns, rows, graph, truncated}: Bolt through a Neo4j source, and
 * the read-only graph query of Kontroll's administration API (decided as the first choice in production: no database port, the server's
 * row and time limits, hashes removed, every statement audited). Also how a saved graph finds its server again, and how a model fetched
 * from a CDE opens its graph in Inhämta.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/graph-source', ['api/connectors', 'api/families/neo4j', 'api/families/opencde-admin'], (connectors, neo4j, admin) => {
    /** Queries over Bolt with a Neo4j source's credentials. @param {any} connector */
    const boltRunner = (connector) => (text, options) => neo4j.run(connector, text, options);
    /** Queries through the administration API of an OpenCDE source signed in with the scope admin. @param {any} connector */
    const adminRunner = (connector) => async (text, options) => neo4j.answerToTable(await admin.graphQuery(connector, text, options && options.params));
    /** What a dataset saved from a graph keeps of where it came from. @param {any} connector @param {string} cypher @param {'admin'} [via] */
    const sourceOf = (connector, cypher, via) => Object.assign({ kind: 'api', connector: connector.id, cypher, fetchedAt: new Date().toISOString() }, via ? { via } : {});
    /**
     * The way from a saved dataset back to its server, or null when there is none (the source is gone, or no longer signed in as an
     * administrator). Nothing is sent here.
     * @param {any} ds @returns {Promise<{connector: any, host: string, run: Function}|null>}
     */
    async function forDataset(ds) {
      const source = ds && ds.source;
      if (!source || !source.cypher || !source.connector) return null;
      const connector = await connectors.get(source.connector);
      if (!connector) return null;
      const host = neo4j.hostOf(connector.baseUrl);
      if (source.via === 'admin') return admin.hasAdminScope(connector) ? { connector, host, run: adminRunner(connector) } : null;
      return neo4j.isNeo4j(connector) ? { connector, host, run: boltRunner(connector) } : null;
    }
    /** A host without its port, with every name of this machine as one. @param {string} host */
    function machineOf(host) {
      const name = String(host || '').toLowerCase().replace(/:\d+$/, '');
      return name === '127.0.0.1' || name === '[::1]' ? 'localhost' : name;
    }
    /**
     * Which source opens the graph of a file from a CDE: a Neo4j source on the same machine, otherwise the CDE source itself, whose view says
     * what the server offers.
     * @param {{connectorId: string, host: string}} cde @returns {Promise<any|null>}
     */
    async function connectorFor(cde) {
      const all = await connectors.list();
      const machine = machineOf(cde.host);
      return all.find((c) => neo4j.isNeo4j(c) && machineOf(neo4j.hostOf(c.baseUrl)) === machine) || (await connectors.get(cde.connectorId)) || null;
    }
    /**
     * Open the IFC graph of a model fetched from a CDE: Inhämta opens the source, and the source's view takes the request with `takeLink`.
     * @param {any} ctx @param {any} ds the model dataset @param {{guid?: string}} [options] an element to start from
     * @returns {Promise<boolean>} false when no source is left
     */
    async function open(ctx, ds, options = {}) {
      const cde = ds.source && ds.source.cde;
      const connector = cde ? await connectorFor(cde) : null;
      if (!connector) return false;
      ctx.store.set({
        pendingGraph: { connectorId: connector.id, documentId: cde.documentId || null, versionIndex: cde.versionIndex == null ? null : cde.versionIndex, guid: options.guid || null, at: Date.now() },
        pendingSource: { family: connector.family.type, baseUrl: connector.baseUrl },
      });
      ctx.shell.activate('inhamta');
      return true;
    }
    /** The request `open` left for this source, taken once. @param {any} ctx @param {any} connector */
    function takeLink(ctx, connector) {
      const store = ctx && ctx.store;
      const link = store && typeof store.get === 'function' ? store.get().pendingGraph : null;
      if (!link || link.connectorId !== connector.id) return null;
      store.set({ pendingGraph: null });
      return link;
    }
    return { boltRunner, adminRunner, sourceOf, forDataset, machineOf, connectorFor, open, takeLink };
  });
})();
