// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The card Projektets medlemmar in an OpenCDE source's view (ui/api/opencde-view): Dataregium's project administration (its OB-41) for
 * a project's manager, who need not be a server administrator. Shown when the capabilities announce `project_administration`; the
 * button "Logga in som projektansvarig" asks for the scope. Lists the projects the user manages and their members with roles, adds a
 * member by user name, changes a role, removes a member and renames the project. Every change is confirmed and written to the log;
 * the server's refusals (the last manager, a user who does not exist) are told in the user's words.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/manage-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/opencde', 'api/families/opencde-manage'], (base, basic, overlays, opencde, manage) => {
    const { h, t, replace } = base;

    /** @param {{connector: any, log?: Function}} api */
    function create(api) {
      const { connector } = api;
      const s = { on: null, ext: null, projects: [], projectId: '', members: [], busy: '', error: '', username: '', role: 'contributor', teams: [], idsDocs: [], team: { name: '', responsible: '', members: '', ids: '' } };
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-manage-panel': '' });
      el.hidden = true;
      const log = (msg, kind) => { if (api.log) api.log(msg, kind || 'ok'); };
      const roleName = (role) => { const key = 'manage.role.' + role; const x = t(key); return x === key ? role : x; };
      const project = () => s.projects.find((p) => p.project_id === s.projectId) || null;
      const memberName = (m) => (m ? String(m.name || m.username || m.user_id) : '');
      function fail(err, extra = {}) {
        const status = err && err.status;
        s.error = status === 409 ? t('manage.err.lastManager')
          : status === 403 ? t('manage.err.notManager')
            : status === 404 && extra.username ? t('manage.err.noUser', { username: extra.username })
              : String((err && err.message) || err);
        log(`${connector.name}: ${s.error}`, 'error');
      }

      /** The card appears when the server has the extension; the lists load when the session has the scope. */
      async function start() {
        try { s.ext = await manage.extension(connector); s.on = !!s.ext; } catch (_e) { s.on = false; }
        render();
        if (s.on && manage.hasScope(connector, s.ext.scope)) await loadProjects();
      }
      async function signIn() {
        if (!s.ext || s.busy) return;
        s.busy = 'signin'; s.error = ''; render();
        try { await manage.signIn(connector, s.ext.scope); } catch (err) { fail(err); }
        s.busy = ''; render();
        if (manage.hasScope(connector, s.ext.scope)) await loadProjects();
      }
      async function loadProjects() {
        s.busy = 'projects'; s.error = ''; render();
        try {
          s.projects = (await manage.projects(connector, s.ext)).items;
          if (!s.projects.some((p) => p.project_id === s.projectId)) s.projectId = s.projects[0] ? s.projects[0].project_id : '';
        } catch (err) { fail(err); }
        s.busy = ''; render();
        if (s.projectId) await loadMembers();
      }
      async function loadMembers() {
        if (!s.projectId) return;
        s.busy = 'members'; s.error = ''; render();
        try { s.members = (await manage.members(connector, s.ext, s.projectId)).items; } catch (err) { s.members = []; fail(err); }
        if (s.ext && s.ext.teamsUrl) await loadTeams();
        s.busy = ''; render();
      }
      async function select(projectId) { s.projectId = projectId; s.members = []; await loadMembers(); }
      /** A change: run, logged, and the members read again. */
      async function change(fn, logText, extra) {
        if (s.busy) return false;
        s.busy = 'write'; s.error = ''; render();
        let ok = false;
        try { await fn(); log(logText); ok = true; } catch (err) { fail(err, extra); }
        s.busy = ''; render();
        if (ok) await loadMembers();
        return ok;
      }
      async function add(username, role) {
        const name = String(username || '').trim();
        if (!name || !s.projectId) return false;
        const ok = await change(() => manage.addMember(connector, s.ext, s.projectId, name, role), t('manage.added', { username: name, role: roleName(role), project: (project() || {}).name || s.projectId }), { username: name });
        if (ok) { s.username = ''; render(); }
        return ok;
      }
      async function setRole(userId, role, options = {}) {
        const m = s.members.find((x) => x.user_id === userId);
        if (!m || m.role === role) return false;
        if (!options.confirmed && !(await overlays.dialog.confirm(t('manage.role.confirm', { name: memberName(m), role: roleName(role) })))) { render(); return false; }
        return change(() => manage.setRole(connector, s.ext, s.projectId, userId, role), t('manage.role.done', { name: memberName(m), role: roleName(role) }));
      }
      async function remove(userId, options = {}) {
        const m = s.members.find((x) => x.user_id === userId);
        if (!m) return false;
        if (!options.confirmed && !(await overlays.dialog.confirm(t('manage.remove.confirm', { name: memberName(m), project: (project() || {}).name || s.projectId }), { danger: true }))) return false;
        return change(() => manage.removeMember(connector, s.ext, s.projectId, userId), t('manage.remove.done', { name: memberName(m) }));
      }
      async function rename(name) {
        const p = project();
        if (!p) return false;
        const next = name !== undefined ? name : await overlays.dialog.prompt(t('manage.rename.label'), { title: t('manage.rename'), value: p.name || '' });
        if (!next || !String(next).trim() || String(next).trim() === p.name) return false;
        const ok = await change(() => manage.rename(connector, s.projectId, next), t('manage.rename.done', { name: String(next).trim() }));
        if (ok) await loadProjects();
        return ok;
      }

      /** The teams (Dataregium 3.0.0), and the project's IDS documents among its files, to pick a team's part from; a server may name none. */
      async function loadTeams() {
        try { s.teams = (await manage.teams(connector, s.ext, s.projectId)).items; } catch (err) { s.teams = []; fail(err); }
        try {
          const files = await D.require('api/families/opencde').filesList(connector, s.projectId);
          s.idsDocs = files.filter((f) => /\.ids$/i.test(String(f.filename || '')) && f.documentId).map((f) => ({ id: String(f.documentId), name: String(f.filename) }));
        } catch (_err) { s.idsDocs = []; }
      }
      const idsName = (id) => { const d = s.idsDocs.find((x) => x.id === id); return d ? d.name : String(id || ''); };
      /** A team from the form: the members as user names, one per line or comma-separated; the server checks them against the project. */
      async function addTeam(team) {
        const name = String(team.name || '').trim();
        const members = String(team.members || '').split(/[\n,;]/).map((x) => x.trim()).filter(Boolean);
        const ids = String(team.ids || '').trim();
        if (!name || !team.responsible || !ids || !s.projectId) { s.error = t('manage.team.err.form'); render(); return false; }
        const ok = await change(() => manage.addTeam(connector, s.ext, s.projectId, { name, responsible: team.responsible, members, ids_document_id: ids }), t('manage.team.added', { name, project: (project() || {}).name || s.projectId }));
        if (ok) { s.team = { name: '', responsible: '', members: '', ids: '' }; render(); }
        return ok;
      }
      async function removeTeam(teamId, options = {}) {
        const team = s.teams.find((x) => x.team_id === teamId);
        if (!team) return false;
        if (!options.confirmed && !(await overlays.dialog.confirm(t('manage.team.remove.confirm', { name: String(team.name || '') }), { danger: true }))) return false;
        return change(() => manage.removeTeam(connector, s.ext, s.projectId, teamId), t('manage.team.remove.done', { name: String(team.name || '') }));
      }
      function roleSelect(value, attrs, onChange) {
        const sel = /** @type {any} */ (h('dm-select', Object.assign({ label: t('manage.role') }, attrs)));
        sel.options = (s.ext ? s.ext.roles : manage.DEFAULT.roles).map((r) => ({ value: r, label: roleName(r) }));
        sel.value = value;
        sel.addEventListener('change', () => onChange(sel.value));
        return sel;
      }
      function render() {
        el.hidden = !s.on;
        if (!s.on) { replace(el); return; }
        const scoped = manage.hasScope(connector, s.ext.scope);
        const nodes = [h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('manage.title') })), h('p', { class: 'dm-help dm-xs', text: t('manage.hint') })];
        if (!scoped) {
          nodes.push(h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('manage.signin'), icon: 'key-round', size: 'sm', loading: s.busy === 'signin', title: t('manage.signin.hint'), 'data-manage-signin': '', onClick: signIn })));
        } else if (!s.projects.length) {
          nodes.push(h('p', { class: 'dm-help', 'data-manage-none': '', text: s.busy === 'projects' ? t('manage.loading') : t('manage.none') }));
        } else {
          const sel = /** @type {any} */ (h('dm-select', { label: t('manage.project'), 'data-manage-project': '' }));
          sel.options = s.projects.map((p) => ({ value: p.project_id, label: String(p.name || p.project_id) }));
          sel.value = s.projectId;
          sel.addEventListener('change', () => { select(sel.value); });
          nodes.push(h('div', { class: 'dm-row-wrap' }, sel,
            basic.button({ label: t('manage.rename'), icon: 'pencil', size: 'sm', disabled: !!s.busy, title: t('manage.rename.hint'), 'data-manage-rename': '', onClick: () => rename() }),
            basic.button({ label: t('manage.reload'), icon: 'refresh-cw', size: 'sm', variant: 'ghost', loading: s.busy === 'members', 'data-manage-reload': '', onClick: loadMembers })));
          nodes.push(h('ul', { class: 'dm-list', 'data-manage-members': String(s.members.length) }, s.members.map((m) => h('li', { class: 'dm-row-wrap', 'data-manage-member': String(m.user_id) },
            h('span', { class: 'dm-grow dm-small', text: m.name && m.username && m.name !== m.username ? `${m.name} (${m.username})` : memberName(m) }),
            roleSelect(m.role, { 'data-manage-role': String(m.user_id) }, (role) => { setRole(m.user_id, role); }),
            basic.button({ label: t('manage.remove'), icon: 'trash-2', size: 'sm', variant: 'ghost', disabled: !!s.busy, title: t('manage.remove.hint'), 'data-manage-remove': String(m.user_id), onClick: () => remove(m.user_id) })))));
          const who = /** @type {any} */ (h('dm-input', { label: t('manage.username'), placeholder: t('manage.username.placeholder'), 'data-manage-username': '' }));
          who.value = s.username;
          who.addEventListener('input', () => { s.username = who.value; });
          nodes.push(h('div', { class: 'dm-row-wrap' }, who, roleSelect(s.role, { 'data-manage-new-role': '' }, (role) => { s.role = role; }),
            basic.button({ label: t('manage.add'), icon: 'plus', size: 'sm', disabled: !!s.busy, title: t('manage.add.hint'), 'data-manage-add': '', onClick: () => add(s.username, s.role) })));
          if (s.ext.teamsUrl) nodes.push(...teamNodes());
        }
        if (s.error) nodes.push(h('p', { class: 'dm-error', 'data-manage-error': '', text: s.error }));
        replace(el, nodes);
      }
      /** The teams and the form for one more: name, the responsible among the editors and managers, the members, the IDS document. */
      function teamNodes() {
        const nodes = [h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('manage.teams') })), h('p', { class: 'dm-help dm-xs', text: t('manage.teams.hint') })];
        nodes.push(s.teams.length ? h('ul', { class: 'dm-list', 'data-manage-teams': String(s.teams.length) }, s.teams.map((team) => h('li', { class: 'dm-row-wrap', 'data-manage-team': String(team.team_id) },
          h('span', { class: 'dm-grow dm-small' }, h('strong', { text: String(team.name || '') }), h('span', { text: ' · ' + t('manage.team.line', { responsible: String(team.responsible || ''), n: String((team.members || []).length), ids: idsName(team.ids_document_id) }) })),
          basic.button({ label: t('manage.remove'), icon: 'trash-2', size: 'sm', variant: 'ghost', disabled: !!s.busy, title: t('manage.team.remove.hint'), 'data-manage-team-remove': String(team.team_id), onClick: () => removeTeam(team.team_id) }))))
          : h('p', { class: 'dm-help dm-small', 'data-manage-teams': '0', text: t('manage.teams.none') }));
        const name = /** @type {any} */ (h('dm-input', { label: t('manage.team.name'), 'data-manage-team-name': '' }));
        name.value = s.team.name; name.addEventListener('input', () => { s.team.name = name.value; });
        const responsible = basic.select(t('manage.team.responsible'), [{ value: '', label: '–' }].concat(s.members.filter((m) => m.role === 'editor' || m.role === 'manager').map((m) => ({ value: String(m.username || ''), label: memberName(m) }))), s.team.responsible, (v) => { s.team.responsible = v; });
        responsible.setAttribute('data-manage-team-responsible', '');
        const members = /** @type {any} */ (h('dm-input', { label: t('manage.team.members'), type: 'textarea', rows: '2', help: t('manage.team.members.help'), 'data-manage-team-members': '' }));
        members.value = s.team.members; members.addEventListener('input', () => { s.team.members = members.value; });
        let ids;
        if (s.idsDocs.length) { ids = basic.select(t('manage.team.ids'), [{ value: '', label: '–' }].concat(s.idsDocs.map((d) => ({ value: d.id, label: d.name }))), s.team.ids, (v) => { s.team.ids = v; }); }
        else { ids = /** @type {any} */ (h('dm-input', { label: t('manage.team.ids'), placeholder: t('manage.team.ids.placeholder'), help: t('manage.team.ids.help') })); ids.value = s.team.ids; ids.addEventListener('input', () => { s.team.ids = ids.value; }); }
        ids.setAttribute('data-manage-team-ids', '');
        nodes.push(h('div', { class: 'dm-row-wrap' }, name, responsible, members, ids,
          basic.button({ label: t('manage.team.add'), icon: 'plus', size: 'sm', disabled: !!s.busy, title: t('manage.team.add.hint'), 'data-manage-team-add': '', onClick: () => addTeam(s.team) })));
        return nodes;
      }
      return { el, start, state: s, signIn, loadProjects, select, add, setRole, remove, rename, loadTeams, addTeam, removeTeam };
    }
    return { create };
  });
})();
