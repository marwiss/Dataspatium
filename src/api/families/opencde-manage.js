// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataregium's project administration (its OB-41, an extension outside the OpenCDE specifications): a project's manager lists the
 * members, adds one by user name, changes a role and removes a member, with a token that holds the scope the capabilities name
 * (`project`) and belongs to a manager of the project. The server refuses a change that would leave the project without a manager
 * (409). Renaming goes through the BCF API's PUT of the project, as in the specification; projects are never deleted here.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/families/opencde-manage', ['api/families/opencde', 'api/secrets', 'api/connectors'], (opencde, secrets, connectors) => {
    const DEFAULT = { url: '/manage/1.0/projects', scope: 'project', roles: ['viewer', 'contributor', 'editor', 'manager'] };
    const enc = encodeURIComponent;

    /** The extension as the capabilities document announces it, or null. @param {any} connector */
    async function extension(connector) {
      const caps = await opencde.capabilities(connector);
      if (!opencde.hasExtension(caps, 'project_administration')) return null;
      const ext = caps.extensions.project_administration || {};
      // teams_url (Dataregium 3.0.0): the teams of a project, whose parts of the model an IDS document marks.
      return { teamsUrl: ext.teams_url ? String(ext.teams_url).replace(/\/+$/, '') : null, url: String(ext.url || DEFAULT.url).replace(/\/+$/, ''), scope: String(ext.scope || DEFAULT.scope), roles: Array.isArray(ext.roles) && ext.roles.length ? ext.roles.map(String) : DEFAULT.roles };
    }
    /** Whether the session's token carries the scope. @param {any} connector @param {string} scope */
    function hasScope(connector, scope) {
      const creds = secrets.get(connector.id) || {};
      if (!creds.token) return false;
      return String(creds.scope || (connector.auth && connector.auth.scope) || '').split(/\s+/).includes(scope);
    }
    /**
     * Sign in with the project scope added to the connector's scopes (kept, so later sign-ins ask for it too).
     * @param {any} connector @param {string} scope @param {{popup?: Function, redirectUri?: string}} [options]
     */
    async function signIn(connector, scope, options = {}) {
      const scopes = String((connector.auth && connector.auth.scope) || opencde.SCOPES).split(/\s+/).filter(Boolean);
      if (!scopes.includes(scope)) {
        scopes.push(scope);
        connector.auth = Object.assign({}, connector.auth, { scope: scopes.join(' ') });
        if (connector.id) { try { await connectors.save(connector); } catch (err) { D.log('opencde-manage', 'could not keep the scope', err); } }
      }
      return opencde.login(connector, options);
    }
    /** A list answer as {items, total}. */
    const listOf = (data) => (Array.isArray(data) ? { items: data, total: data.length } : { items: (data && Array.isArray(data.items)) ? data.items : [], total: Number(data && data.total) || 0 });
    /** The projects the caller manages. @param {any} connector @param {{url: string}} ext */
    async function projects(connector, ext) { return listOf(await opencde.api(connector, ext.url)); }
    /** A project's members with their roles. */
    async function members(connector, ext, projectId) { return listOf(await opencde.api(connector, `${ext.url}/${enc(projectId)}/members`)); }
    /** Adds a member by exact user name, or sets the role of one who is already a member. */
    const addMember = (connector, ext, projectId, username, role) => opencde.api(connector, `${ext.url}/${enc(projectId)}/members`, { method: 'POST', json: { username: String(username).trim(), role } });
    const setRole = (connector, ext, projectId, userId, role) => opencde.api(connector, `${ext.url}/${enc(projectId)}/members/${enc(userId)}`, { method: 'PUT', json: { role } });
    const removeMember = (connector, ext, projectId, userId) => opencde.api(connector, `${ext.url}/${enc(projectId)}/members/${enc(userId)}`, { method: 'DELETE' });
    /** Renames the project through the BCF API (3.0 and 2.1 alike). */
    const rename = (connector, projectId, name) => opencde.api(connector, `${opencde.bcfBase(connector)}/projects/${enc(projectId)}`, { method: 'PUT', json: { name: String(name).trim() } });

    /** The address of a project's teams, from the extension's template. */
    const teamsUrl = (ext, projectId) => String(ext.teamsUrl || `${ext.url}/{project_id}/teams`).replace('{project_id}', enc(projectId));
    /** A project's teams: team_id, name, responsible and members (user names) and the IDS document whose specifications mark the part. */
    async function teams(connector, ext, projectId) { return listOf(await opencde.api(connector, teamsUrl(ext, projectId))); }
    /** The body the server wants: user names for the responsible and the members, the IDS document by id. */
    const teamBody = (team) => ({ name: String(team.name || '').trim(), responsible: String(team.responsible || '').trim(), members: (team.members || []).map((x) => String(x).trim()).filter(Boolean), ids_document_id: String(team.ids_document_id || '').trim() });
    const addTeam = (connector, ext, projectId, team) => opencde.api(connector, teamsUrl(ext, projectId), { method: 'POST', json: teamBody(team) });
    const setTeam = (connector, ext, projectId, teamId, team) => opencde.api(connector, `${teamsUrl(ext, projectId)}/${enc(teamId)}`, { method: 'PUT', json: teamBody(team) });
    const removeTeam = (connector, ext, projectId, teamId) => opencde.api(connector, `${teamsUrl(ext, projectId)}/${enc(teamId)}`, { method: 'DELETE' });

    return { DEFAULT, extension, hasScope, signIn, projects, members, addMember, setRole, removeMember, rename, teamsUrl, teams, addTeam, setTeam, removeTeam };
  });
})();
