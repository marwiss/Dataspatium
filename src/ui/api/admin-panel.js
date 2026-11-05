// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The card Administration in an OpenCDE source's view (ui/api/opencde-view): Kontroll's administration API from the app, shown when
 * the server's capabilities document says the API is on. It needs a token with the scope admin that belongs to an administrator; the
 * button "Logga in som administratör" asks for the scope. Sections: overview, users, projects, clients, sessions, audit, settings and
 * health. Every change is confirmed in a dialog and written to the log; one-time values (an initial password, a client secret) are
 * shown once with a Copy button and never logged. Every list can be saved as a dataset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/admin-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'api/families/opencde', 'api/families/opencde-admin', 'api/runner'], (base, basic, overlays, opencde, admin, runner) => {
    const { h, t, i18n, replace } = base;
    const SECTIONS = ['overview', 'users', 'projects', 'clients', 'sessions', 'audit', 'settings', 'health'];
    const ICONS = { overview: 'info', users: 'key-round', projects: 'folder', clients: 'cpu', sessions: 'monitor', audit: 'history', settings: 'settings', health: 'activity', graph: 'network' };
    const LISTS = ['users', 'projects', 'clients', 'sessions', 'audit'];

    /**
     * @param {{connector: any, ctx?: any, log?: Function, onDataset?: Function}} api
     */
    function create(api) {
      const { connector } = api;
      const s = { on: null, graph: false, tab: 'overview', busy: '', error: '', forbidden: false, data: /** @type {Record<string, any>} */ ({}), q: { users: '', projects: '', sessionsUser: '', auditType: '', auditSince: '', cypher: 'MATCH (n) RETURN labels(n) AS etikett, count(*) AS antal ORDER BY antal DESC' } };
      const el = h('div', { class: 'dm-card dm-stack-sm', 'data-admin-panel': '' });
      el.hidden = true;
      const log = (msg, kind) => { if (api.log) api.log(msg, kind || 'ok'); };
      const host = () => opencde.hostOf(connector.baseUrl);
      const fail = (err) => {
        s.error = String((err && err.message) || err);
        s.forbidden = !!(err && err.status === 403 && err.code !== 'reauthentication_required');
        log(`${connector.name}: ${s.error}`, 'error');
      };
      const when = (iso) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso) : i18n.formatDateTime(d); };
      const n = (v) => i18n.formatNumber(Number(v) || 0);

      /** The card appears when the server has the API; the lists load when the session has the scope. */
      async function start() {
        try { const caps = await opencde.capabilities(connector); s.on = opencde.hasExtension(caps, 'admin_api'); s.graph = opencde.hasExtension(caps, 'graph_query'); } catch (_e) { s.on = false; }
        render();
        if (s.on && admin.hasAdminScope(connector)) await load('overview');
      }
      async function signIn() {
        if (s.busy === 'write' || s.busy === 'signin') return;
        if (loading) await loading;
        s.busy = 'signin'; s.error = ''; s.forbidden = false; render();
        try { await admin.signInAsAdmin(connector); s.data = {}; } catch (err) { fail(err); }
        s.busy = ''; render();
        if (admin.hasAdminScope(connector)) await load(s.tab);
      }
      /** The load in flight, so that loads run one at a time and a write can wait for one instead of being dropped. */
      let loading = null;
      /** One section's data from the server. */
      async function load(tab) {
        if (loading) await loading;
        if (s.busy === 'write' || s.busy === 'signin') return;
        loading = loadNow(tab);
        try { await loading; } finally { loading = null; }
      }
      async function loadNow(tab) {
        s.busy = tab; s.error = ''; s.forbidden = false; render();
        try {
          if (tab === 'overview') s.data.overview = await admin.overview(connector);
          else if (tab === 'users') s.data.users = (await admin.users(connector, { q: s.q.users })).items;
          else if (tab === 'projects') s.data.projects = (await admin.projects(connector, { q: s.q.projects })).items;
          else if (tab === 'clients') s.data.clients = (await admin.clients(connector)).items;
          else if (tab === 'sessions') s.data.sessions = (await admin.sessions(connector, { user: s.q.sessionsUser })).items;
          else if (tab === 'audit') s.data.audit = (await admin.audit(connector, { type: s.q.auditType, since: s.q.auditSince })).items;
          else if (tab === 'settings') s.data.settings = await admin.settings(connector);
          else if (tab === 'health') s.data.health = await admin.health(connector);
        } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      /** A write: confirmed by the caller, run, logged, and the section loaded again. */
      async function change(fn, logText, tab) {
        if (s.busy === 'write' || s.busy === 'signin') return null;
        if (loading) await loading;
        s.busy = 'write'; s.error = ''; render();
        let out = null;
        try { out = await fn(); if (logText) log(logText); } catch (err) { fail(err); out = null; s.busy = ''; render(); return null; }
        s.busy = '';
        await load(tab || s.tab);
        return out === null || out === undefined ? true : out;
      }
      /** A list as a dataset in the workspace. */
      async function saveDataset(kind) {
        const tbl = kind === 'settings' ? admin.settingsTable(s.data.settings) : kind === 'graph' ? admin.graphTable(s.data.graph) : admin.tableOf(kind, s.data[kind] || []);
        const what = t('admin.tab.' + kind);
        try {
          const meta = await runner.toDataset({ columns: tbl.columns, rows: tbl.rows, meta: {} }, {
            name: t('admin.dataset.name', { host: host(), what }),
            description: opencde.describe(connector, t('admin.title') + ': ' + what, ''),
            source: { kind: 'api', connectorId: connector.id, connectorName: connector.name, family: 'opencde', opencde: { kind: 'admin', admin: kind, params: kind === 'users' ? { q: s.q.users } : kind === 'projects' ? { q: s.q.projects } : kind === 'sessions' ? { user: s.q.sessionsUser } : kind === 'audit' ? { type: s.q.auditType, since: s.q.auditSince } : kind === 'graph' ? { cypher: s.q.cypher, params: {} } : {} }, fetchedAt: new Date().toISOString() },
          });
          log(t('admin.saved', { name: meta.name }));
          overlays.toast.show(t('admin.saved', { name: meta.name }), { kind: 'ok' });
          if (api.onDataset) api.onDataset(meta);
        } catch (err) { fail(err); render(); }
      }

      // ------------------------------------------------------------------------------------------------ small parts
      const field = (label, value, attrs) => { const f = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs || {}))); f.value = value === undefined || value === null ? '' : String(value); return f; };
      const switchField = (label, checked) => { const sw = /** @type {any} */ (h('dm-switch', { label })); sw.checked = !!checked; return sw; };
      const badge = (ok, textOk, textBad) => h('dm-badge', { kind: ok ? 'ok' : 'error', text: ok ? textOk : textBad });
      const saveButton = (kind) => basic.button({ label: t('admin.save'), icon: 'save', size: 'sm', 'data-admin-save': kind, disabled: !s.data[kind], onClick: () => saveDataset(kind) });
      const iconButton = (label, icon, onClick, attrs) => basic.button(Object.assign({ label, icon, size: 'sm', 'icon-only': true, title: label, onClick }, attrs || {}));
      const confirm = (message, danger, okLabel) => overlays.dialog.confirm(message, { danger: !!danger, okLabel: okLabel || (danger ? t('common.delete') : t('common.ok')) });
      /** A filter row: an input and a button that loads the section again. */
      function filterRow(key, label, tab, extra) {
        const input = field(label, s.q[key], { inline: true });
        input.addEventListener('input', () => { s.q[key] = input.value; });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); load(tab); } });
        return h('div', { class: 'dm-row-wrap' }, input, extra || null, basic.button({ label: t('admin.refresh'), icon: 'refresh-cw', size: 'sm', loading: s.busy === tab, onClick: () => load(tab) }));
      }
      /** A one-time value: shown once with a Copy button, never logged. */
      async function showOnce(title, label, value) {
        await overlays.dialog.open({
          title,
          body: h('div', { class: 'dm-stack-sm', 'data-admin-once': '' },
            h('p', { class: 'dm-help', text: t('admin.once.hint') }),
            h('p', { class: 'dm-help dm-xs', text: label }),
            h('pre', { class: 'dm-help-code' }, h('code', { 'data-admin-once-value': '', text: String(value || '') })),
            h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('common.copy'), icon: 'copy', size: 'sm', onClick: async () => { try { await navigator.clipboard.writeText(String(value || '')); overlays.toast.show(t('admin.once.copied'), { kind: 'ok' }); } catch (_e) { /* the user selects the text instead */ } } }))),
          actions: [{ label: t('common.close'), variant: 'primary', value: true }],
        });
      }
      /** A table of the section's rows. */
      function tableEl(columns, rows) {
        const table = /** @type {any} */ (h('dm-table', { class: 'dm-table-tall' }));
        requestAnimationFrame(() => table.setData({ columns: columns.map((c) => ({ key: c, label: c, type: 'text' })), rowCount: rows.length, rowProvider: async (start, count) => rows.slice(start, start + count) }));
        return h('div', { class: 'dm-table-wrap' }, table);
      }

      // ------------------------------------------------------------------------------------------------ users
      async function userForm(title, u) {
        const username = field(t('admin.user.username'), u ? u.username : '', u ? { disabled: '' } : {});
        const name = field(t('admin.user.name'), u ? u.name : '');
        const email = field(t('admin.user.email'), u ? u.email : '', { type: 'email' });
        const isAdmin = switchField(t('admin.user.isadmin'), u && u.is_admin);
        const ok = await overlays.dialog.open({ title, body: h('div', { class: 'dm-stack-sm', 'data-admin-form': 'user' }, username, name, email, isAdmin), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return null;
        return { username: String(username.value || '').trim(), name: String(name.value || '').trim(), email: String(email.value || '').trim(), is_admin: !!isAdmin.checked };
      }
      async function newUser() {
        const f = await userForm(t('admin.user.new'), null);
        if (!f || !f.username) return;
        const out = await change(() => admin.createUser(connector, { username: f.username, name: f.name, email: f.email, is_admin: f.is_admin }), t('admin.log.user.created', { name: f.username, host: host() }), 'users');
        if (out && out.initial_password) await showOnce(t('admin.user.created', { name: f.username }), t('admin.once.password'), out.initial_password);
      }
      async function editUser(u) {
        const f = await userForm(t('admin.user.edit'), u);
        if (!f) return;
        const body = { name: f.name, email: f.email };
        if (f.is_admin !== !!u.is_admin) body.is_admin = f.is_admin;
        await change(() => admin.updateUser(connector, u.id, body), t('admin.log.user.updated', { name: u.username }), 'users');
      }
      async function toggleUser(u) {
        if (!u.disabled && !(await confirm(t('admin.user.disable.confirm', { name: u.username }), true, t('admin.user.disable')))) return;
        await change(() => admin.updateUser(connector, u.id, { disabled: !u.disabled }), t('admin.log.user.updated', { name: u.username }), 'users');
      }
      async function resetPassword(u) {
        if (!(await confirm(t('admin.user.reset.confirm', { name: u.username }), true, t('admin.user.reset')))) return;
        const out = await change(() => admin.resetPassword(connector, u.id), t('admin.log.user.reset', { name: u.username }), 'users');
        if (out && out.password) await showOnce(t('admin.user.password', { name: u.username }), t('admin.once.password'), out.password);
      }
      async function deleteUser(u) {
        if (!(await confirm(t('admin.user.delete.confirm', { name: u.username }), true))) return;
        await change(() => admin.deleteUser(connector, u.id), t('admin.log.user.deleted', { name: u.username }), 'users');
      }
      function usersBody() {
        const list = s.data.users;
        const rows = (list || []).map((u) => h('div', { class: 'dm-row dm-admin-row', 'data-admin-user': u.username },
          h('span', { class: 'dm-grow dm-truncate' }, h('strong', { text: u.username }), h('span', { class: 'dm-help dm-xs', text: ' ' + [u.name, u.email, u.is_admin ? t('admin.user.admin') : '', u.disabled ? t('admin.user.disabled') : '', u.last_sign_in_at ? t('admin.user.lastsignin', { when: when(u.last_sign_in_at) }) : ''].filter(Boolean).join(' · ') })),
          iconButton(t('common.edit'), 'pencil', () => editUser(u)),
          iconButton(t(u.disabled ? 'admin.user.enable' : 'admin.user.disable'), u.disabled ? 'eye' : 'eye-off', () => toggleUser(u)),
          iconButton(t('admin.user.reset'), 'key-round', () => resetPassword(u)),
          iconButton(t('common.delete'), 'trash-2', () => deleteUser(u), { variant: 'ghost' })));
        return h('div', { class: 'dm-stack-sm' },
          filterRow('users', t('admin.users.filter'), 'users', basic.button({ label: t('admin.user.new'), icon: 'plus', size: 'sm', 'data-admin-new': 'user', onClick: newUser })),
          list && !list.length ? h('p', { class: 'dm-help', text: t('admin.none') }) : null,
          rows.length ? h('div', { class: 'dm-stack-xs' }, rows) : null);
      }

      // ------------------------------------------------------------------------------------------------ projects
      async function newProject() {
        const name = await overlays.dialog.prompt(t('admin.project.name'), { title: t('admin.project.new'), okLabel: t('common.save') });
        if (!name || !name.trim()) return;
        await change(() => admin.createProject(connector, { name: name.trim() }), t('admin.log.project.created', { name: name.trim() }), 'projects');
      }
      async function renameProject(p) {
        const name = await overlays.dialog.prompt(t('admin.project.name'), { title: t('admin.project.rename'), value: p.name, okLabel: t('common.save') });
        if (!name || !name.trim() || name.trim() === p.name) return;
        await change(() => admin.updateProject(connector, p.project_id, { name: name.trim() }), t('admin.log.project.updated', { name: name.trim() }), 'projects');
      }
      async function deleteProject(p) {
        if (!(await confirm(t('admin.project.delete.confirm', { name: p.name }), true))) return;
        await change(() => admin.deleteProject(connector, p.project_id), t('admin.log.project.deleted', { name: p.name }), 'projects');
      }
      /** The members of a project with their roles; changes go to the server at once. */
      async function membersDialog(p) {
        let members = (p.members || []).slice();
        let users = s.data.users;
        if (!users) { try { users = (await admin.users(connector, {})).items; s.data.users = users; } catch (err) { fail(err); render(); return; } }
        const body = h('div', { class: 'dm-stack-sm', 'data-admin-members': p.project_id });
        const roleOptions = admin.ROLES.map((r) => ({ value: r, label: t('admin.role.' + r) }));
        const draw = () => {
          const rows = members.map((m) => {
            const sel = basic.select(t('admin.project.role'), roleOptions, m.role, async (role) => {
              try { await admin.setMember(connector, p.project_id, m.user_id, role); m.role = role; log(t('admin.log.project.member', { user: m.username || m.user_id, role: t('admin.role.' + role), name: p.name })); } catch (err) { fail(err); }
              draw();
            }, { inline: true });
            return h('div', { class: 'dm-row dm-admin-row', 'data-admin-member': m.username || m.user_id },
              h('span', { class: 'dm-grow dm-truncate', text: m.username || m.user_id }), sel,
              iconButton(t('common.delete'), 'x', async () => {
                try { await admin.removeMember(connector, p.project_id, m.user_id); members = members.filter((x) => x !== m); log(t('admin.log.project.member.removed', { user: m.username || m.user_id, name: p.name })); } catch (err) { fail(err); }
                draw();
              }));
          });
          const free = (users || []).filter((u) => !members.some((m) => m.user_id === u.id));
          const pick = basic.select(t('admin.project.user'), free.map((u) => ({ value: u.id, label: u.username })), free[0] ? free[0].id : '', () => {}, { inline: true });
          const role = basic.select(t('admin.project.role'), roleOptions, 'viewer', () => {}, { inline: true });
          const add = basic.button({ label: t('admin.project.add'), icon: 'plus', size: 'sm', disabled: !free.length, onClick: async () => {
            const u = free.find((x) => x.id === /** @type {any} */ (pick).value);
            if (!u) return;
            const r = /** @type {any} */ (role).value || 'viewer';
            try { await admin.setMember(connector, p.project_id, u.id, r); members.push({ user_id: u.id, username: u.username, role: r }); log(t('admin.log.project.member', { user: u.username, role: t('admin.role.' + r), name: p.name })); } catch (err) { fail(err); }
            draw();
          } });
          replace(body, rows.length ? h('div', { class: 'dm-stack-xs' }, rows) : h('p', { class: 'dm-help', text: t('admin.project.members.none') }), h('div', { class: 'dm-row-wrap' }, pick, role, add), s.error ? h('p', { class: 'dm-error', text: s.error }) : null);
        };
        draw();
        await overlays.dialog.open({ title: t('admin.project.members.title', { name: p.name }), body, size: 'lg', actions: [{ label: t('common.close'), variant: 'primary', value: true }] });
        await load('projects');
      }
      function projectsBody() {
        const list = s.data.projects;
        const rows = (list || []).map((p) => h('div', { class: 'dm-row dm-admin-row', 'data-admin-project': p.name },
          h('span', { class: 'dm-grow dm-truncate' }, h('strong', { text: p.name }), h('span', { class: 'dm-help dm-xs', text: ' ' + t('admin.project.counts', { topics: n(p.topics), documents: n(p.documents), models: n(p.models), members: n((p.members || []).length) }) })),
          iconButton(t('admin.project.rename'), 'pencil', () => renameProject(p)),
          iconButton(t('admin.project.members'), 'list-checks', () => membersDialog(p)),
          iconButton(t('common.delete'), 'trash-2', () => deleteProject(p), { variant: 'ghost' })));
        return h('div', { class: 'dm-stack-sm' },
          filterRow('projects', t('admin.projects.filter'), 'projects', basic.button({ label: t('admin.project.new'), icon: 'plus', size: 'sm', 'data-admin-new': 'project', onClick: newProject })),
          list && !list.length ? h('p', { class: 'dm-help', text: t('admin.none') }) : null,
          rows.length ? h('div', { class: 'dm-stack-xs' }, rows) : null);
      }

      // ------------------------------------------------------------------------------------------------ clients
      async function clientForm(title, c) {
        const name = field(t('admin.client.name'), c ? c.name : '');
        const description = field(t('admin.client.description'), c ? c.description : '');
        const url = field(t('admin.client.url'), c ? c.url : '', { type: 'url' });
        const redirects = field(t('admin.client.redirects'), (c && c.redirect_uris ? c.redirect_uris : []).join('\n'), { type: 'textarea', rows: '3' });
        const pub = c ? null : switchField(t('admin.client.public'), true);
        const ok = await overlays.dialog.open({ title, body: h('div', { class: 'dm-stack-sm', 'data-admin-form': 'client' }, name, description, url, redirects, pub), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return null;
        const body = { name: String(name.value || '').trim(), description: String(description.value || '').trim(), url: String(url.value || '').trim(), redirect_uris: String(redirects.value || '').split(/\s+/).map((x) => x.trim()).filter(Boolean) };
        if (pub) body.public = !!pub.checked;
        return body;
      }
      async function newClient() {
        const f = await clientForm(t('admin.client.new'), null);
        if (!f || !f.name) return;
        const out = await change(() => admin.createClient(connector, f), t('admin.log.client.created', { name: f.name }), 'clients');
        if (out && out.client_secret) await showOnce(t('admin.client.created', { name: f.name }), t('admin.once.secret'), out.client_secret);
      }
      async function editClient(c) {
        const f = await clientForm(t('admin.client.edit'), c);
        if (!f) return;
        await change(() => admin.updateClient(connector, c.client_id, f), t('admin.log.client.updated', { name: f.name }), 'clients');
      }
      async function rotateSecret(c) {
        if (!(await confirm(t('admin.client.rotate.confirm', { name: c.name }), true, t('admin.client.rotate')))) return;
        const out = await change(() => admin.rotateSecret(connector, c.client_id), t('admin.log.client.rotated', { name: c.name }), 'clients');
        if (out && out.client_secret) await showOnce(t('admin.client.secret', { name: c.name }), t('admin.once.secret'), out.client_secret);
      }
      async function revokeClient(c) {
        if (!(await confirm(t('admin.client.revoke.confirm', { name: c.name }), true, t('admin.client.revoke')))) return;
        await change(() => admin.revokeClient(connector, c.client_id), t('admin.log.client.revoked', { name: c.name }), 'clients');
      }
      async function deleteClient(c) {
        if (!(await confirm(t('admin.client.delete.confirm', { name: c.name }), true))) return;
        await change(() => admin.deleteClient(connector, c.client_id), t('admin.log.client.deleted', { name: c.name }), 'clients');
      }
      function clientsBody() {
        const list = s.data.clients;
        const rows = (list || []).map((c) => h('div', { class: 'dm-row dm-admin-row', 'data-admin-client': c.client_id },
          h('span', { class: 'dm-grow dm-truncate' }, h('strong', { text: c.name || c.client_id }), h('span', { class: 'dm-help dm-xs', text: ' ' + [c.client_id, c.public ? t('admin.client.public.badge') : '', c.dynamic ? t('admin.client.dynamic') : '', c.disabled ? t('admin.client.disabled') : '', c.last_used_at ? t('admin.client.lastused', { when: when(c.last_used_at) }) : t('admin.client.never')].filter(Boolean).join(' · ') })),
          iconButton(t('common.edit'), 'pencil', () => editClient(c)),
          c.public ? null : iconButton(t('admin.client.rotate'), 'key-round', () => rotateSecret(c)),
          iconButton(t('admin.client.revoke'), 'x', () => revokeClient(c)),
          iconButton(t('common.delete'), 'trash-2', () => deleteClient(c), { variant: 'ghost' })));
        return h('div', { class: 'dm-stack-sm' },
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('admin.client.new'), icon: 'plus', size: 'sm', 'data-admin-new': 'client', onClick: newClient }), basic.button({ label: t('admin.refresh'), icon: 'refresh-cw', size: 'sm', loading: s.busy === 'clients', onClick: () => load('clients') })),
          list && !list.length ? h('p', { class: 'dm-help', text: t('admin.none') }) : null,
          rows.length ? h('div', { class: 'dm-stack-xs' }, rows) : null);
      }

      // ------------------------------------------------------------------------------------------------ sessions
      async function endSession(x) {
        if (!(await confirm(t('admin.session.end.confirm', { name: x.username || x.user_id }), true, t('admin.session.end')))) return;
        await change(() => admin.endSession(connector, x.id), t('admin.log.session.ended', { id: x.id }), 'sessions');
      }
      async function endAll() {
        const who = s.q.sessionsUser.trim();
        if (!who || !(await confirm(t('admin.session.endall.confirm', { name: who }), true, t('admin.session.endall')))) return;
        await change(() => admin.endSessions(connector, who), t('admin.log.sessions.ended', { name: who }), 'sessions');
      }
      function sessionsBody() {
        const list = s.data.sessions;
        const rows = (list || []).map((x) => h('div', { class: 'dm-row dm-admin-row', 'data-admin-session': x.id },
          h('dm-badge', { kind: x.kind === 'web' ? 'accent' : 'ok', text: t(x.kind === 'web' ? 'admin.session.web' : 'admin.session.oauth2') }),
          h('span', { class: 'dm-grow dm-truncate' }, h('strong', { text: x.username || x.user_id }), h('span', { class: 'dm-help dm-xs', text: ' ' + [x.client_name || x.client_id, x.scope, x.ip, x.created_at ? when(x.created_at) : '', x.expires_at ? '→ ' + when(x.expires_at) : ''].filter(Boolean).join(' · ') })),
          iconButton(t('admin.session.end'), 'x', () => endSession(x))));
        return h('div', { class: 'dm-stack-sm' },
          filterRow('sessionsUser', t('admin.sessions.filter'), 'sessions', basic.button({ label: t('admin.session.endall'), icon: 'x', size: 'sm', disabled: !s.q.sessionsUser.trim(), onClick: endAll })),
          list && !list.length ? h('p', { class: 'dm-help', text: t('admin.none') }) : null,
          rows.length ? h('div', { class: 'dm-stack-xs' }, rows) : null);
      }

      // ------------------------------------------------------------------------------------------------ audit, settings, health, overview
      function auditBody() {
        const since = field(t('admin.audit.since'), s.q.auditSince, { type: 'date', inline: true });
        since.addEventListener('input', () => { s.q.auditSince = since.value; });
        const list = s.data.audit;
        const tbl = admin.tableOf('audit', list || []);
        return h('div', { class: 'dm-stack-sm' },
          filterRow('auditType', t('admin.audit.type'), 'audit', since),
          list && !list.length ? h('p', { class: 'dm-help', text: t('admin.none') }) : null,
          list && list.length ? tableEl(tbl.columns, tbl.rows) : null);
      }
      function settingsBody() {
        const data = s.data.settings;
        if (!data) return null;
        const tbl = admin.settingsTable(data);
        return h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help dm-xs', text: t('admin.settings.hint') }), tableEl(tbl.columns, tbl.rows));
      }
      function healthBody() {
        const data = s.data.health;
        if (!data) return null;
        const checks = Array.isArray(data.checks) ? data.checks : [];
        const bad = checks.filter((c) => !c.ok).length;
        return h('div', { class: 'dm-stack-sm', 'data-admin-health': '' },
          badge(!bad && data.ok !== false, t('admin.health.ok'), t('admin.health.problems', { n: n(bad) })),
          h('div', { class: 'dm-stack-xs' }, checks.map((c) => h('div', { class: 'dm-row dm-admin-row' }, h('dm-badge', { kind: c.ok ? 'ok' : 'error', text: c.ok ? 'OK' : '!' }), h('span', { class: 'dm-grow' }, h('strong', { text: String(c.name || '') }), h('span', { class: 'dm-help dm-xs', text: c.detail ? ' ' + String(c.detail) : '' }))))));
      }
      function uptime(sec) {
        const total = Math.max(0, Math.floor(Number(sec) || 0));
        const d = Math.floor(total / 86400); const hrs = Math.floor((total % 86400) / 3600); const min = Math.floor((total % 3600) / 60);
        return d ? t('admin.uptime.days', { d: n(d), h: n(hrs) }) : t('admin.uptime.hours', { h: n(hrs), m: n(min) });
      }
      function overviewBody() {
        const o = s.data.overview;
        if (!o) return null;
        const counts = ['users', 'projects', 'clients', 'sessions', 'topics', 'documents', 'models'];
        return h('div', { class: 'dm-stack-sm', 'data-admin-overview': '' },
          h('div', { class: 'dm-row-wrap' }, counts.map((k) => h('div', { class: 'dm-stat' }, h('span', { class: 'dm-stat-value', text: n(o[k]) }), h('span', { class: 'dm-stat-label', text: t('admin.count.' + k) })))),
          h('p', { class: 'dm-help dm-small', text: t('admin.overview.line', { version: String(o.version || '?'), uptime: uptime(o.uptime_s), dialect: String(o.dialect || '?') }) }),
          h('div', { class: 'dm-row-wrap' },
            badge(!!o.graph_ok, t('admin.graph.ok'), t('admin.graph.down')),
            badge(!!(o.request_log && o.request_log.enabled), t('admin.requestlog.on', { n: n(o.request_log && o.request_log.rows) }), t('admin.requestlog.off'))));
      }

      // ------------------------------------------------------------------------------------------------ graph query
      async function runGraph() {
        if (s.busy === 'write' || s.busy === 'graph' || !s.q.cypher.trim()) return;
        if (loading) await loading;
        s.busy = 'graph'; s.error = ''; render();
        try { s.data.graph = await admin.graphQuery(connector, s.q.cypher, {}); log(t('admin.graph.ran', { n: n(s.data.graph.rows && s.data.graph.rows.length) })); } catch (err) { fail(err); }
        s.busy = ''; render();
      }
      function graphBody() {
        const area = field(t('admin.graph.cypher'), s.q.cypher, { type: 'textarea', rows: '4' });
        area.addEventListener('input', () => { s.q.cypher = area.value; });
        const r = s.data.graph;
        const tbl = r ? admin.graphTable(r) : null;
        return h('div', { class: 'dm-stack-sm', 'data-admin-graph': '' },
          h('p', { class: 'dm-help dm-xs', text: t('admin.graph.hint') }),
          area,
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('admin.graph.run'), icon: 'play', size: 'sm', 'data-admin-graph-run': '', loading: s.busy === 'graph', onClick: runGraph }), r ? h('span', { class: 'dm-help dm-xs', text: t('admin.graph.rows', { n: n(tbl.rows.length) }) + (r.truncated ? ' ' + t('admin.graph.truncated') : '') }) : null),
          tbl && tbl.rows.length ? tableEl(tbl.columns, tbl.rows) : null);
      }

      // ------------------------------------------------------------------------------------------------ the card
      function render() {
        el.hidden = !s.on;
        if (!s.on) { replace(el); return; }
        const scope = admin.hasAdminScope(connector);
        const head = h('div', { class: 'dm-row' },
          h('strong', { class: 'dm-grow', text: t('admin.title') }),
          scope ? h('dm-badge', { kind: 'ok', text: t('admin.scope.ok') }) : null,
          scope && LISTS.includes(s.tab) ? saveButton(s.tab) : null,
          scope && (s.tab === 'settings' || (s.tab === 'graph' && s.data.graph)) ? saveButton(s.tab) : null,
          scope ? basic.button({ label: t('admin.refresh'), icon: 'refresh-cw', size: 'sm', 'icon-only': true, title: t('admin.refresh'), loading: s.busy === s.tab, onClick: () => load(s.tab) }) : null);
        const nodes = [head, h('p', { class: 'dm-help dm-xs', text: t('admin.hint') })];
        if (!scope) {
          nodes.push(h('p', { class: 'dm-help', text: t('admin.scope.missing') }));
          nodes.push(h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('admin.signin'), icon: 'lock', size: 'sm', 'data-admin-signin': '', loading: s.busy === 'signin', onClick: signIn })));
        } else {
          const tabs = /** @type {any} */ (h('dm-tabs'));
          tabs.tabs = SECTIONS.concat(s.graph ? ['graph'] : []).map((id) => ({ id, label: t('admin.tab.' + id), icon: ICONS[id] }));
          tabs.active = s.tab;
          tabs.addEventListener('dm-change', (e) => { s.tab = /** @type {any} */ (e).detail.id; render(); if (!s.data[s.tab] && s.tab !== 'graph') load(s.tab); });
          nodes.push(tabs);
          const body = s.tab === 'overview' ? overviewBody() : s.tab === 'users' ? usersBody() : s.tab === 'projects' ? projectsBody() : s.tab === 'clients' ? clientsBody() : s.tab === 'sessions' ? sessionsBody() : s.tab === 'audit' ? auditBody() : s.tab === 'settings' ? settingsBody() : s.tab === 'graph' ? graphBody() : healthBody();
          nodes.push(h('div', { class: 'dm-admin-body', 'data-admin-tab': s.tab }, body, !body && s.busy ? h('p', { class: 'dm-help', text: t('admin.loading') }) : null));
        }
        if (s.error) nodes.push(h('p', { class: 'dm-error', text: s.error }));
        if (s.forbidden) nodes.push(h('p', { class: 'dm-help', text: t('admin.forbidden') }));
        replace(el, nodes);
      }

      return { el, start, load, signIn, saveDataset, state: s, destroy: () => {} };
    }
    return { create, SECTIONS };
  });
})();
