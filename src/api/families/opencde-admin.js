// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataregium's administration API (an extension outside the OpenCDE specifications, client-guide §7) from the app: what the pages
 * under /admin show, as JSON under /admin/api/, with a token that holds the scope `admin` and belongs to an administrator. Lists
 * answer {items, total}; writes take the bodies the pages use. Dangerous operations (deleting, resetting a password, rotating a
 * secret, giving or taking the administrator flag) need a fresh sign-in: the server answers 403 with the code
 * reauthentication_required, and `fresh()` then signs in again (popup) and repeats the call once. One-time values (an initial
 * password, a client secret) are handed to the caller exactly once and never written to the log.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/opencde-admin', ['api/families/opencde', 'api/secrets', 'api/connectors'], (opencde, secrets, connectors) => {
    const ADMIN_SCOPE = 'admin';
    const BASE = '/admin/api';
    const ROLES = ['viewer', 'contributor', 'editor', 'manager'];
    const enc = encodeURIComponent;
    /** A query string from the parameters that have a value. */
    function query(params) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      const s = q.toString();
      return s ? '?' + s : '';
    }

    /** Whether the server says it has the administration API (the capabilities document). @param {any} connector */
    async function available(connector) {
      const caps = await opencde.capabilities(connector);
      return opencde.hasExtension(caps, 'admin_api');
    }
    /** Whether the session's token carries the admin scope (the server's answer, or the scopes asked for). @param {any} connector */
    function hasAdminScope(connector) {
      const creds = secrets.get(connector.id) || {};
      if (!creds.token) return false;
      const scope = String(creds.scope || (connector.auth && connector.auth.scope) || '');
      return scope.split(/\s+/).includes(ADMIN_SCOPE);
    }
    /**
     * Sign in with the admin scope added to the connector's scopes (kept, so later sign-ins ask for it too).
     * @param {any} connector @param {{popup?: Function, redirectUri?: string}} [options]
     */
    async function signInAsAdmin(connector, options = {}) {
      const scopes = String((connector.auth && connector.auth.scope) || opencde.SCOPES).split(/\s+/).filter(Boolean);
      if (!scopes.includes(ADMIN_SCOPE)) {
        scopes.push(ADMIN_SCOPE);
        connector.auth = Object.assign({}, connector.auth, { scope: scopes.join(' ') });
        if (connector.id) { try { await connectors.save(connector); } catch (err) { D.log('opencde-admin', 'could not keep the scope', err); } }
      }
      return opencde.login(connector, options);
    }
    /**
     * A dangerous call: when the server wants a fresh sign-in (403 reauthentication_required) the user signs in again and the call
     * is repeated once. @param {any} connector @param {() => Promise<any>} fn @param {{popup?: Function, redirectUri?: string}} [options]
     */
    async function fresh(connector, fn, options = {}) {
      try { return await fn(); } catch (err) {
        if (!(err && err.code === 'reauthentication_required')) throw err;
        await opencde.login(connector, options.popup ? { popup: options.popup, redirectUri: options.redirectUri } : {});
        return fn();
      }
    }

    const get = (connector, path) => opencde.api(connector, BASE + path);
    const write = (connector, method, path, json) => opencde.api(connector, BASE + path, Object.assign({ method }, json === undefined ? {} : { json }));
    /** A list answer as {items, total}, whether the server wrapped it or not. */
    async function list(connector, path) {
      const r = await get(connector, path);
      if (Array.isArray(r)) return { items: r, total: r.length };
      const items = Array.isArray(r && r.items) ? r.items : [];
      return { items, total: Number(r && r.total) || items.length };
    }

    // -------------------------------------------------------------------------------------------------- reading
    const overview = (c) => get(c, '/overview');
    const users = (c, p) => list(c, '/users' + query(p));
    const user = (c, id) => get(c, '/users/' + enc(id));
    const projects = (c, p) => list(c, '/projects' + query(p));
    const project = (c, id) => get(c, '/projects/' + enc(id));
    const clients = (c) => list(c, '/clients');
    const client = (c, id) => get(c, '/clients/' + enc(id));
    const sessions = (c, p) => list(c, '/sessions' + query(p));
    const audit = (c, p) => list(c, '/audit' + query(p));
    const settings = (c) => get(c, '/settings');
    const health = (c) => get(c, '/health');

    // -------------------------------------------------------------------------------------------------- writing
    const createUser = (c, body) => write(c, 'POST', '/users', body);
    /** Giving or taking the administrator flag is dangerous; the other fields are not. */
    const updateUser = (c, id, body, o) => ('is_admin' in body ? fresh(c, () => write(c, 'PUT', '/users/' + enc(id), body), o) : write(c, 'PUT', '/users/' + enc(id), body));
    const deleteUser = (c, id, o) => fresh(c, () => write(c, 'DELETE', '/users/' + enc(id)), o);
    const resetPassword = (c, id, o) => fresh(c, () => write(c, 'POST', '/users/' + enc(id) + '/reset-password', {}), o);
    const createProject = (c, body) => write(c, 'POST', '/projects', body);
    const updateProject = (c, id, body) => write(c, 'PUT', '/projects/' + enc(id), body);
    const deleteProject = (c, id, o) => fresh(c, () => write(c, 'DELETE', '/projects/' + enc(id)), o);
    const setMember = (c, id, userId, role) => write(c, 'PUT', `/projects/${enc(id)}/members/${enc(userId)}`, { role });
    const removeMember = (c, id, userId) => write(c, 'DELETE', `/projects/${enc(id)}/members/${enc(userId)}`);
    const createClient = (c, body) => write(c, 'POST', '/clients', body);
    const updateClient = (c, id, body) => write(c, 'PUT', '/clients/' + enc(id), body);
    const rotateSecret = (c, id, o) => fresh(c, () => write(c, 'POST', '/clients/' + enc(id) + '/rotate-secret', {}), o);
    const revokeClient = (c, id) => write(c, 'POST', '/clients/' + enc(id) + '/revoke', {});
    const deleteClient = (c, id, o) => fresh(c, () => write(c, 'DELETE', '/clients/' + enc(id)), o);
    const endSession = (c, id) => write(c, 'DELETE', '/sessions/' + enc(id));
    const endSessions = (c, userId) => write(c, 'DELETE', '/sessions?user=' + enc(userId));
    /**
     * A read-only Cypher query on the server's IFC graph (extension graph_query): the server refuses writing statements, runs in a
     * read transaction and cuts the answer at its row and time limits. Nodes, relationships and paths come back as JSON objects.
     * @param {any} c @param {string} cypher @param {Record<string, any>} [params] @returns {Promise<{columns: string[], rows: any[][], truncated: boolean}>}
     */
    const graphQuery = (c, cypher, params) => write(c, 'POST', '/graph/query', { cypher: String(cypher || ''), params: params || {} });

    // -------------------------------------------------------------------------------------------------- lists as tables
    const flag = (v) => (v ? 1 : 0);
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const TABLES = {
      users: {
        columns: ['id', 'username', 'name', 'email', 'is_admin', 'disabled', 'created_at', 'last_sign_in_at', 'projects'],
        row: (u) => [str(u.id), str(u.username), str(u.name), str(u.email), flag(u.is_admin), flag(u.disabled), str(u.created_at), str(u.last_sign_in_at), (u.projects || []).map((p) => `${p.name || p.project_id}: ${p.role}`).join('; ')],
      },
      projects: {
        columns: ['project_id', 'name', 'created_at', 'members', 'topics', 'documents', 'models'],
        row: (p) => [str(p.project_id), str(p.name), str(p.created_at), (p.members || []).map((m) => `${m.username || m.user_id}: ${m.role}`).join('; '), str(p.topics), str(p.documents), str(p.models)],
      },
      clients: {
        columns: ['client_id', 'name', 'public', 'dynamic', 'disabled', 'redirect_uris', 'created_at', 'expires_at', 'last_used_at', 'software_id', 'software_version'],
        row: (c) => [str(c.client_id), str(c.name), flag(c.public), flag(c.dynamic), flag(c.disabled), (c.redirect_uris || []).join(' '), str(c.created_at), str(c.expires_at), str(c.last_used_at), str(c.software_id), str(c.software_version)],
      },
      sessions: {
        columns: ['id', 'kind', 'user_id', 'username', 'client_id', 'client_name', 'scope', 'ip', 'created_at', 'expires_at'],
        row: (x) => [str(x.id), str(x.kind), str(x.user_id), str(x.username), str(x.client_id), str(x.client_name), str(x.scope), str(x.ip), str(x.created_at), str(x.expires_at)],
      },
      audit: {
        columns: ['at', 'type', 'actor', 'client_id', 'ip', 'request_id', 'details'],
        row: (e) => [str(e.at), str(e.type), str(e.actor), str(e.client_id), str(e.ip), str(e.request_id), e.details === null || e.details === undefined ? '' : (typeof e.details === 'string' ? e.details : JSON.stringify(e.details))],
      },
    };
    /** A list as {columns, rows} for a dataset. @param {keyof typeof TABLES} kind @param {any[]} items */
    function tableOf(kind, items) {
      const d = TABLES[kind];
      return { columns: d.columns.slice(), rows: (items || []).map(d.row) };
    }
    /** A graph query's answer as a table: nodes, relationships and other objects become JSON text. @param {any} result */
    function graphTable(result) {
      const cell = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : v);
      const columns = Array.isArray(result && result.columns) ? result.columns.map(String) : [];
      return { columns, rows: (Array.isArray(result && result.rows) ? result.rows : []).map((r) => (Array.isArray(r) ? r.map(cell) : columns.map((c) => cell(r && r[c])))) };
    }
    /** Settings as a two-column table (the structured values, then the raw OPENCDE_* values). @param {any} data */
    function settingsTable(data) {
      const rows = [];
      const flat = (prefix, v) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) { for (const [k, x] of Object.entries(v)) flat(prefix ? prefix + '.' + k : k, x); }
        else rows.push([prefix, Array.isArray(v) ? v.join(', ') : str(v)]);
      };
      const { raw, ...rest } = data || {};
      flat('', rest);
      for (const [k, v] of Object.entries(raw || {})) rows.push(['raw.' + k, str(v)]);
      return { columns: ['setting', 'value'], rows };
    }

    /** Fetch a saved administration list again (api/families/opencde.refetch hands over here for kind 'admin'). */
    async function refetch(connector, spec) {
      const kind = spec && spec.admin;
      const p = (spec && spec.params) || {};
      if (kind === 'settings') return Object.assign(settingsTable(await settings(connector)), { meta: {} });
      if (kind === 'graph') return Object.assign(graphTable(await graphQuery(connector, p.cypher, p.params)), { meta: {} });
      const lister = { users, projects, clients, sessions, audit }[kind];
      if (!lister) throw new Error(D.t('api.err.nosource'));
      return Object.assign(tableOf(kind, (await lister(connector, p)).items), { meta: {} });
    }

    return { ADMIN_SCOPE, ROLES, BASE, available, refetch, graphQuery, graphTable, hasAdminScope, signInAsAdmin, fresh, overview, users, user, projects, project, clients, client, sessions, audit, settings, health, createUser, updateUser, deleteUser, resetPassword, createProject, updateProject, deleteProject, setMember, removeMember, createClient, updateClient, rotateSecret, revokeClient, deleteClient, endSession, endSessions, tableOf, settingsTable, TABLES };
  });
})();
