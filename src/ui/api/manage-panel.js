// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The card Projektets medlemmar in an OpenCDE source's view (ui/api/opencde-view): Dataregium's project administration (its OB-41) for
 * a project's manager, who need not be a server administrator. Shown when the capabilities announce `project_administration`; the
 * button "Logga in som projektansvarig" asks for the scope. Lists the projects the user manages and their members with roles, adds a
 * member by user name, changes a role, removes a member and renames the project. Every change is confirmed and written to the log;
 * the server's refusals (the last manager, a user who does not exist) are told in the user's words. When the server mirrors
 * repositories to a forge (Dataregium's step 7, `git.remote`), the page also connects the project's mirror with an address and a
 * token that goes once to the server and is never kept in the app, shows how the last push went, and stops the mirror.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/manage-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/opencde', 'api/families/opencde-manage', 'platform/tier'], (base, basic, overlays, opencde, manage, tier) => {
    const { h, t, replace } = base;

    /** @param {{connector: any, log?: Function}} api */
    function create(api) {
      const { connector } = api;
      const s = { on: null, ext: null, projects: [], projectId: '', members: [], busy: '', error: '', username: '', role: 'contributor', teams: [], idsDocs: [], team: { name: '', responsible: '', members: '', ids: '' },
        // The mirror at a forge (Dataregium's step 7): the extension, the project's status (undefined until read, null when none) and
        // the form without the token, which lives only in its field until it goes.
        remoteExt: null, remote: undefined, remoteForm: { url: '', expires: '', maxFileMib: '100', ack: false } };
      /** The token's field: read once when the mirror is connected, then emptied; the token is never kept in the panel's state. */
      let tokenField = null;
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-manage-panel': '' });
      /** Dataregium's teams (DS-49) belong to BIM och GIS, of the app and of the server (platform/tier); members and roles stay in Dokument. */
      const teamsShown = () => !!(s.ext && s.ext.teamsUrl) && tier.shows('cde.teams', { server: connector.id });
      el.hidden = true;
      const log = (msg, kind) => { if (api.log) api.log(msg, kind || 'ok'); };
      const roleName = (role) => (base.i18n.has('manage.role.' + role) ? t('manage.role.' + role) : role);
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
        if (s.on) s.remoteExt = await manage.remoteExtension(connector).catch(() => null);
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
        if (teamsShown()) await loadTeams();
        if (s.remoteExt) await loadRemote();
        s.busy = ''; render();
      }
      async function select(projectId) { s.projectId = projectId; s.members = []; s.remote = undefined; await loadMembers(); }
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
      /** The project's mirror at a forge, as the server tells it (undefined until read, null when there is none). */
      async function loadRemote() {
        if (!s.remoteExt || !s.projectId) return;
        try { s.remote = await manage.remote(connector, s.remoteExt, s.projectId); } catch (err) { s.remote = undefined; fail(err); }
      }
      /**
       * Connects the mirror after the manager has acknowledged that the project's files leave the server for the forge: the address,
       * the token (sent once to the source's own server, never kept in the app and never in the log), the date it expires and the
       * forge's file limit. The token's field is emptied whatever the answer.
       * @param {{url?: string, token?: string, expires?: string, maxFileMib?: string|number, ack?: boolean}} [given] the form's values, for tests
       */
      async function connectRemote(given) {
        if (!s.remoteExt || !s.projectId || s.busy) return false;
        const form = Object.assign({}, s.remoteForm, given || {});
        const token = given && given.token !== undefined ? String(given.token) : String((tokenField && tokenField.value) || '');
        if (tokenField) tokenField.value = '';
        if (!form.ack) { s.error = t('manage.remote.err.ack'); render(); return false; }
        const made = manage.remoteBody({ url: form.url, token, expires: form.expires, maxFileMib: form.maxFileMib }, s.remoteExt);
        if ('error' in made) { s.error = t(made.error, { hosts: s.remoteExt.hosts.join(', ') }); render(); return false; }
        s.busy = 'remote'; s.error = ''; render();
        let ok = false;
        try {
          s.remote = await manage.setRemote(connector, s.remoteExt, s.projectId, made.body);
          s.remoteForm = { url: '', expires: '', maxFileMib: '100', ack: false };
          log(t('manage.remote.done', { url: made.body.url, project: (project() || {}).name || s.projectId }));
          ok = true;
        } catch (err) { fail(err); }
        s.busy = ''; render();
        return ok;
      }
      async function removeRemote(options = {}) {
        if (!s.remote || s.busy) return false;
        if (!options.confirmed && !(await overlays.dialog.confirm(t('manage.remote.remove.confirm', { url: s.remote.url }), { danger: true }))) return false;
        s.busy = 'remote'; s.error = ''; render();
        let ok = false;
        try { await manage.removeRemote(connector, s.remoteExt, s.projectId); log(t('manage.remote.removed', { url: s.remote.url })); s.remote = null; ok = true; } catch (err) { fail(err); }
        s.busy = ''; render();
        return ok;
      }
      /** The mirror's part of the page: its status and the way to stop it, or the form that connects one. */
      function remoteNodes() {
        const nodes = [h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('manage.remote') })), h('p', { class: 'dm-help dm-xs', text: t('manage.remote.hint') })];
        const r = s.remote;
        if (r === undefined) return nodes;
        if (r) {
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('manage.remote.url'), value: r.url },
            { label: t('manage.remote.status'), value: t('manage.remote.state.' + r.status) },
            r.pushedAt ? { label: t('manage.remote.pushedAt'), value: base.i18n.formatDateTime(r.pushedAt) } : null,
            r.pushed.length ? { label: t('manage.remote.pushed'), value: r.pushed.join(', ') } : null,
            r.expiresAt ? { label: t('manage.remote.expires'), value: base.i18n.formatDateTime(r.expiresAt) } : null,
            r.maxFileBytes ? { label: t('manage.remote.maxFile'), value: base.i18n.formatBytes(r.maxFileBytes) } : null,
          ].filter(Boolean);
          const leftOut = r.leftOut.map((x) => (typeof x === 'string' ? x : String((x && (x.path || x.file || x.name)) || JSON.stringify(x))));
          nodes.push(h('div', { class: 'dm-stack-xs', 'data-manage-remote': r.status }, kv,
            r.error ? h('p', { class: 'dm-error dm-small', 'data-manage-remote-error': '', text: t('manage.remote.error', { error: r.error }) }) : null,
            leftOut.length ? h('p', { class: 'dm-help dm-xs', 'data-manage-remote-left': String(leftOut.length), text: t('manage.remote.left', { n: base.i18n.formatNumber(leftOut.length), files: leftOut.slice(0, 10).join(', ') + (leftOut.length > 10 ? ' …' : '') }) }) : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('manage.reload'), icon: 'refresh-cw', size: 'sm', variant: 'ghost', disabled: !!s.busy, title: t('manage.remote.reload.hint'), 'data-manage-remote-reload': '', onClick: async () => { await loadRemote(); render(); } }),
              basic.button({ label: t('manage.remote.remove'), icon: 'trash-2', size: 'sm', variant: 'ghost', loading: s.busy === 'remote', disabled: !!s.busy, title: t('manage.remote.remove.hint'), 'data-manage-remote-remove': '', onClick: () => removeRemote() }))));
          return nodes;
        }
        const field = (key, attrs) => { const f = /** @type {any} */ (h('dm-input', attrs)); f.value = s.remoteForm[key]; f.addEventListener('input', () => { s.remoteForm[key] = f.value; }); return f; };
        // The same field across the page's redraws, so that a typed token stays in it (and only there) until it goes.
        tokenField = tokenField || /** @type {any} */ (h('dm-input', { label: t('manage.remote.token'), type: 'password', help: t('manage.remote.token.help'), 'data-manage-remote-token': '' }));
        const ack = /** @type {any} */ (h('dm-switch', { label: t('manage.remote.ack'), 'data-manage-remote-ack': '' }));
        ack.checked = !!s.remoteForm.ack;
        ack.addEventListener('change', () => { s.remoteForm.ack = !!ack.checked; render(); });
        nodes.push(h('div', { class: 'dm-stack-sm', 'data-manage-remote': 'none' },
          field('url', { label: t('manage.remote.url'), placeholder: 'https://github.com/owner/repository.git', help: s.remoteExt.hosts.length ? t('manage.remote.url.help', { hosts: s.remoteExt.hosts.join(', ') }) : '', 'data-manage-remote-url': '' }),
          tokenField,
          h('div', { class: 'dm-row-wrap' },
            field('expires', { label: t('manage.remote.expires'), type: 'date', help: t('manage.remote.expires.help'), 'data-manage-remote-expires': '' }),
            field('maxFileMib', { label: t('manage.remote.maxFile.mib'), type: 'number', min: '1', max: '5120', 'data-manage-remote-size': '' })),
          ack,
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('manage.remote.connect'), icon: 'git-branch', size: 'sm', loading: s.busy === 'remote', disabled: !!s.busy || !s.remoteForm.ack, title: t('manage.remote.connect.hint'), 'data-manage-remote-connect': '', onClick: () => connectRemote() }))));
        return nodes;
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
          if (teamsShown()) nodes.push(...teamNodes());
          if (s.remoteExt) nodes.push(...remoteNodes());
        }
        if (s.error) nodes.push(h('p', { class: 'dm-error', 'data-manage-error': '', text: s.error }));
        replace(el, nodes);
        if (tokenField && tokenField.control) tokenField.control.setAttribute('autocomplete', 'off');
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
      return { el, start, state: s, signIn, loadProjects, select, add, setRole, remove, rename, loadTeams, addTeam, removeTeam, loadRemote, connectRemote, removeRemote };
    }
    return { create };
  });
})();
