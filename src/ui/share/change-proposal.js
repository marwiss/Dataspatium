// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A change proposal on Dataregium, shared by Ändra med AI (ui/bearbeta/ai-panel) and Dela's Till CDE (ui/share/cde-send, decision
 * F123 a): the words of the topic asked in a dialog, the change set sent as a BCF topic whose snippet is in the server's form
 * (DataregiumIfcChangeSet: the base version, the provenance, the changes), the server's trial polled until it is final and shown
 * under the topic, a manager's approval as the document's next version (OB-27 on the server's side), and against a stale base the
 * collisions with what came between, decided per key before the proposal goes again (OB-19 d). When the change set cannot express
 * what changed, the whole file goes instead (decision F124 a, the server's F204 a): tried and approved the same way, its collisions
 * shown but not chosen one by one, since a file has no changes to keep or give up. The host keeps the state (`cde`,
 * `proposed`, `approvingServer`, `error`), so that its view and its tests read it where they did; the server's rows are rendered as
 * text, never as markup.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/change-proposal', ['ui/base', 'ui/basic', 'ui/overlays', 'api/connectors', 'api/families/opencde'], (base, basic, overlays, connectors, opencde) => {
    const { h, t, i18n } = base;
    const TRIAL_STATES = ['queued', 'running', 'clean', 'issues', 'failed'];
    /** The words a project's topic type for a change proposal goes by, in the app's languages. */
    const PROPOSAL_TYPE = /change|proposal|ändring|förslag|endring|forslag|ændring|muutos|ehdotus|breyting|tillaga/i;

    /**
     * The topic's title and description in a dialog, with the lines that tell what goes and what does not.
     * @param {{title: string, description: string, hint: string, lines?: string[], help?: string}} options
     * @returns {Promise<{title: string, description: string}|null>} null when the person cancels
     */
    async function askWords(options) {
      const title = /** @type {any} */ (h('dm-input', { label: t('ai.change.propose.topic'), 'data-ai-propose-title': '' }));
      title.value = options.title;
      const description = /** @type {any} */ (h('dm-input', { label: t('ai.change.propose.description'), rows: '6', 'data-ai-propose-description': '' }));
      description.value = options.description;
      const ok = await overlays.dialog.open({
        title: t('ai.change.propose.title'), help: options.help,
        body: h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help', text: options.hint }), (options.lines || []).map((line) => h('p', { class: 'dm-help dm-small', text: line })), title, description),
        actions: [{ label: t('common.cancel'), value: false }, { label: t('ai.change.propose.send'), variant: 'primary', value: true, primary: true }],
      });
      return ok === true ? { title: String(title.value || '').trim(), description: String(description.value || '') } : null;
    }

    /** The server's trial in words; a whole file has nothing applied, so its trial tells only the findings. @param {any} trial */
    const trialText = (trial) => {
      const state = trial.state === 'running' ? 'queued' : trial.state;
      const key = trial.kind === 'file' && (state === 'clean' || state === 'issues') ? 'ai.change.trial.file.' + state : 'ai.change.trial.' + state;
      return t(key, { applied: i18n.formatNumber(trial.applied || 0), n: i18n.formatNumber(trial.count || 0), issues: i18n.formatNumber(trial.issues || 0), errors: i18n.formatNumber(trial.errors || 0), error: trial.error || '' });
    };

    /**
     * @param {{state: any, log: (msg: string, kind?: string) => void, fail: (err: any) => void, render: () => void, busy?: () => boolean}} host
     *   `state` holds `cde` (the dataset's source.cde), `proposed`, `approvingServer` and `error`; `busy` stops the buttons while the
     *   host works
     */
    function create(host) {
      const s = host.state;
      const render = () => host.render();
      const busy = () => !!(host.busy && host.busy());
      const projectOf = (cde) => cde.projectName || cde.projectId;

      /**
       * The change set as a proposal on the dataset's server, signed in first when the source is not: a BCF topic of the project's type
       * for proposals with the change set as its snippet, the base version, the signed-in user and how it was made as its provenance.
       * The model is neither changed nor published. Sets `state.proposed` and starts polling the trial; throws what fails, with the
       * server's status (403 when the role editor is missing).
       * @param {any} connector
       * @param {{title: string, description: string, changes: any[], aiModel?: string|null, toolCall?: string|null, ops?: any[]}} options
       */
      /** Signed in first when the source is not, and the project's topic type for proposals. */
      async function ready(connector) {
        if (!opencde.signedIn(connector)) { if (!opencde.redirectUri()) throw new Error(t('issues.err.file')); await opencde.login(connector); }
        const ext = (await opencde.extensions(connector, s.cde.projectId).catch(() => null)) || {};
        const types = Array.isArray(ext.topic_type) ? ext.topic_type : [];
        return types.find((x) => PROPOSAL_TYPE.test(String(x))) || types[0] || null;
      }
      async function send(connector, options) {
        const cde = s.cde;
        const topicType = await ready(connector);
        const me = await opencde.currentUser(connector).catch(() => null);
        const changeSet = {
          base: { document_id: String(cde.documentId || ''), version_index: Number(cde.versionIndex) || 1 },
          provenance: { user: String((me && (me.name || me.id)) || 'Dataspatium'), ai_model: options.aiModel || null, tool_call: options.toolCall ? String(options.toolCall).slice(0, 200) : null, created_at: new Date().toISOString() },
          changes: options.changes,
        };
        const out = await opencde.proposeChanges(connector, cde.projectId, { title: options.title, description: options.description, topicType, changeSet, ops: options.ops });
        if (!out) throw new Error(t('ai.change.propose.unsupported'));
        s.proposed = { guid: out.topic.guid, title: options.title, trial: out.tried ? { state: 'queued' } : null, approveUrl: out.approveUrl || null, approved: null,
          proposalUrl: out.proposalUrl || null, schemaUrl: out.schemaUrl, changeSet: out.changeSet || changeSet, details: null, picks: [] };
        const msg = t('ai.change.propose.done', { title: s.proposed.title, project: projectOf(cde) });
        host.log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
        if (out.tried) trial(connector, out.proposalUrl, s.proposed);
        return s.proposed;
      }
      /**
       * A whole IFC file as the proposal (decision F124 a, Dataregium's F204 a), when the change set cannot express what changed: the
       * file, already through the review, goes as the topic's own snippet on the base version, with how it was made in the query; the
       * server tries it and a manager approves it as a change set. Sets `state.proposed` (kind 'file') and starts polling the trial.
       * @param {any} connector
       * @param {{title: string, description: string, bytes: Uint8Array, fileName?: string, aiModel?: string|null, toolCall?: string|null}} options
       */
      async function sendFile(connector, options) {
        const cde = s.cde;
        const topicType = await ready(connector);
        const base = { document_id: String(cde.documentId || ''), version_index: Number(cde.versionIndex) || 1 };
        const out = await opencde.proposeFile(connector, cde.projectId, { title: options.title, description: options.description, topicType, bytes: options.bytes, fileName: options.fileName, base, aiModel: options.aiModel || null, toolCall: options.toolCall || null });
        if (!out) throw new Error(t('ai.change.propose.file.unsupported'));
        s.proposed = { kind: 'file', guid: out.topic.guid, title: options.title, fileName: out.fileName, trial: out.tried ? { state: 'queued', kind: 'file' } : null, approveUrl: out.approveUrl || null, approved: null,
          proposalUrl: out.proposalUrl || null, changeSet: null, details: null, picks: [] };
        const msg = t('ai.change.propose.file.done', { title: s.proposed.title, project: projectOf(cde) });
        host.log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
        if (out.tried) trial(connector, out.proposalUrl, s.proposed);
        return s.proposed;
      }
      /** The server's trial of the proposal, polled until it is final; its failure is a line under the topic, not an error. */
      async function trial(connector, proposalUrl, mine) {
        try {
          const report = await opencde.proposalTrial(connector, proposalUrl, { onStatus: (state) => { if (s.proposed === mine) { mine.trial = { state, kind: mine.kind || 'change_set' }; render(); } } });
          if (s.proposed !== mine) return;
          const state = report && TRIAL_STATES.includes(report.state) ? report.state : 'failed';
          // Dataregium's F204 a: the trial is of a whole file (kind file, nothing applied) or of a change set, on a commit of its own.
          mine.trial = { state, kind: report && report.kind === 'file' ? 'file' : mine.kind === 'file' ? 'file' : 'change_set', commit: report && typeof report.commit === 'string' ? report.commit : null, applied: Number(report && report.applied) || 0, count: Number(report && report.change_count) || 0, issues: Number(report && report.issue_count) || 0, errors: Number(report && report.error_count) || 0, error: (report && report.error) || '', list: Array.isArray(report && report.issues) ? report.issues : [],
            // Dataregium 3.0.0: the teams whose part the change set touches; one team's part is approved by its responsible.
            teams: Array.isArray(report && report.teams) ? report.teams.map((x) => ({ id: String(x.team_id || ''), name: String(x.name || x.team_id || '') })) : [], teamsError: String((report && report.teams_error) || '') };
          host.log(trialText(mine.trial), state === 'clean' ? 'ok' : 'warn');
        } catch (err) { if (s.proposed === mine) mine.trial = { state: 'failed', error: String((err && err.message) || err), list: [] }; }
        render();
      }
      /** A manager makes a clean proposal the document's next version on the server; the local model is not touched. */
      async function approve(options = {}) {
        const mine = s.proposed;
        const cde = s.cde;
        if (!mine || !cde || !mine.approveUrl || !mine.trial || mine.trial.state !== 'clean' || mine.approved || s.approvingServer || busy()) return;
        const connector = await connectors.get(cde.connectorId);
        if (!connector) return;
        const project = projectOf(cde);
        if (!options.confirmed && !(await overlays.dialog.confirm(t('ai.change.approve.server.confirm', { title: mine.title, project })))) return;
        s.approvingServer = true; s.error = ''; render();
        try {
          const version = await opencde.approveProposal(connector, mine.approveUrl);
          if (s.proposed === mine) {
            mine.conflicts = null;
            mine.approved = { index: Number(version && version.version_index) || 0, number: String((version && (version.version_number || version.version_index)) || ''), title: String((version && version.title) || '') };
            const msg = t('ai.change.approve.server.done', { n: mine.approved.number, title: mine.approved.title || mine.title, project });
            host.log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
          }
        } catch (err) {
          host.fail(err);
          // A change that touches one team's part is the team's responsible's to approve, not a manager's (403).
          if (s.proposed === mine && err && err.status === 403) s.error = t('ai.change.approve.server.team', { detail: String((err && (err.detail || err.message)) || '') });
          if (s.proposed === mine && err && err.status === 412 && Array.isArray(err.conflicts)) {
            // The document moved on and the changes collide with what came between: the keys, or everything after a whole file.
            mine.conflicts = err.conflicts;
            // With the three values per key the person decides each collision here; the merge itself stays on the server (OB-19 d).
            mine.details = !err.conflicts.includes('*') && Array.isArray(err.conflictDetails) && err.conflictDetails.length ? err.conflictDetails : null;
            mine.picks = (mine.details || []).map(() => 'ours');
            // A whole file has no changes to keep or give up one by one: the collisions are shown, and the file is made again.
            s.error = err.conflicts.includes('*') ? t('ai.change.approve.server.conflict.all')
              : mine.details && mine.kind === 'file' ? t('ai.change.approve.server.conflict.file', { k: i18n.formatNumber(mine.details.length) })
              : mine.details ? t('ai.change.approve.server.conflict.choose', { k: i18n.formatNumber(mine.details.length) })
                : t('ai.change.approve.server.conflict', { k: i18n.formatNumber(err.conflicts.length), keys: err.conflicts.slice(0, 10).join(', ') + (err.conflicts.length > 10 ? ' …' : '') });
          } else if (s.proposed === mine && err && err.status === 409 && mine.approveUrl && mine.trial) {
            // The trial on the latest version was not clean: the server's findings replace the old verdict.
            mine.trial = { state: 'queued' };
            trial(connector, mine.approveUrl.replace(/\/approve$/, ''), mine);
          }
        }
        s.approvingServer = false; render();
      }
      /**
       * The collisions decided: a change kept takes the latest version's value as its old one, a change given up leaves the proposal;
       * the proposal goes again against the latest version and the server tries it anew before it can be approved.
       * @param {string[]} [choices] 'ours' or 'theirs' per collision, in the server's order; the view's picks otherwise
       */
      async function resolve(choices) {
        const mine = s.proposed;
        const cde = s.cde;
        if (!mine || !cde || !mine.details || !mine.changeSet || s.approvingServer || busy()) return;
        const picks = mine.details.map((d, i) => ((choices && choices[i]) || mine.picks[i] || 'ours'));
        s.approvingServer = true; s.error = ''; render();
        try {
          const connector = await connectors.get(cde.connectorId);
          if (!connector) throw new Error(t('cde.err.noconnector', { host: cde.host }));
          const versions = await opencde.documentVersions(connector, [cde.documentId]);
          const latest = versions.filter((v) => !v.document_id || v.document_id === cde.documentId).reduce((n, v) => Math.max(n, Number(v.version_index) || 0), 0);
          const { changes, keepTheirs, kept, dropped } = decideConflicts(mine.changeSet, mine.details, picks);
          const hasOps = Array.isArray(mine.changeSet.ops) && mine.changeSet.ops.length > 0;
          if (!changes.length && !hasOps) throw new Error(t('ai.change.conflict.empty'));
          const changeSet = Object.assign({}, mine.changeSet, { base: Object.assign({}, mine.changeSet.base, { version_index: latest || mine.changeSet.base.version_index }), changes },
            hasOps ? { keep_theirs: Array.from(new Set((mine.changeSet.keep_theirs || []).concat(keepTheirs))) } : {});
          await opencde.putChangeSet(connector, cde.projectId, mine.guid, mine.schemaUrl, changeSet);
          mine.changeSet = changeSet; mine.details = null; mine.picks = []; mine.conflicts = null;
          host.log(t('ai.change.conflict.resent', { n: String(changeSet.base.version_index), kept: i18n.formatNumber(kept), dropped: i18n.formatNumber(dropped) }), 'ok');
          if (mine.proposalUrl) { mine.trial = { state: 'queued' }; trial(connector, mine.proposalUrl, mine); }
        } catch (err) { host.fail(err); }
        s.approvingServer = false; render();
      }
      function conflictsView(mine) {
        if (mine.kind === 'file') {
          return h('div', { class: 'dm-stack-sm', 'data-ai-conflicts': String(mine.details.length), 'data-ai-conflicts-file': '' },
            h('strong', { class: 'dm-small', text: t('ai.change.conflict.title') }),
            h('ul', { class: 'dm-list dm-xs' }, mine.details.slice(0, 100).map((d, i) => h('li', { class: 'dm-small', 'data-ai-conflict': String(i), text: t('ai.change.conflict.line', { key: String(d.key || ''), base: conflictValue(d.base), theirs: conflictValue(d.theirs), ours: conflictValue(d.ours), n: String(d.version_index || '–') }) }))),
            h('p', { class: 'dm-help dm-xs', text: t('ai.change.conflict.file') }));
        }
        return h('div', { class: 'dm-stack-sm', 'data-ai-conflicts': String(mine.details.length) },
          h('strong', { class: 'dm-small', text: t('ai.change.conflict.title') }),
          mine.details.slice(0, 100).map((d, i) => {
            const pick = /** @type {any} */ (h('dm-select', { label: t('ai.change.conflict.choice'), 'data-ai-conflict-pick': String(i) }));
            pick.options = [{ value: 'ours', label: t('ai.change.conflict.ours') }, { value: 'theirs', label: t('ai.change.conflict.theirs') }];
            pick.value = mine.picks[i] || 'ours';
            pick.addEventListener('change', () => { mine.picks[i] = pick.value === 'theirs' ? 'theirs' : 'ours'; });
            return h('div', { class: 'dm-row-wrap', 'data-ai-conflict': String(i) },
              h('span', { class: 'dm-small dm-grow', text: t('ai.change.conflict.line', { key: String(d.key || ''), base: conflictValue(d.base), theirs: conflictValue(d.theirs), ours: conflictValue(d.ours), n: String(d.version_index || '–') }) }), pick,
              wholeConflict(d) ? h('span', { class: 'dm-help dm-xs', 'data-ai-conflict-whole': String(i), text: t('ai.change.conflict.whole') }) : null);
          }),
          h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('ai.change.conflict.resend'), icon: 'refresh-cw', size: 'sm', loading: s.approvingServer, disabled: busy(), title: t('ai.change.conflict.resend.hint'), 'data-ai-conflict-resend': '', onClick: () => resolve() })));
      }
      /** The sent proposal under its topic: the trial, the teams, the findings, the approval and the collisions. @returns {Array<HTMLElement|null>} */
      function view() {
        const p = s.proposed;
        if (!p) return [];
        const tr = p.trial;
        return [
          h('p', { class: 'dm-small', 'data-ai-proposed': p.guid, 'data-ai-proposed-kind': p.kind || 'change_set', text: p.kind === 'file' ? t('ai.change.proposed.file', { title: p.title, file: p.fileName || '' }) : t('ai.change.proposed', { title: p.title }) }),
          tr ? h('p', { class: tr.state === 'issues' || tr.state === 'failed' ? 'dm-error dm-small' : 'dm-help dm-xs', 'data-ai-trial': tr.state, text: trialText(tr) }) : null,
          tr && (tr.teams || []).length ? h('p', { class: 'dm-help dm-xs', 'data-ai-trial-teams': String(tr.teams.length), text: t(tr.teams.length === 1 ? 'ai.change.trial.team' : 'ai.change.trial.teams', { names: tr.teams.map((x) => x.name).join(', ') }) }) : null,
          tr && tr.teamsError ? h('p', { class: 'dm-help dm-xs', 'data-ai-trial-teams-error': '', text: t('ai.change.trial.teams.error', { error: tr.teamsError }) }) : null,
          tr && (tr.list || []).length ? h('ul', { class: 'dm-list dm-xs', 'data-ai-trial-issues': '' }, tr.list.slice(0, 10).map((f) => h('li', { class: 'dm-xs', text: `${f.kind || ''}${f.rule ? ' ' + f.rule : ''}${f.step_id ? ' #' + f.step_id : ''}: ${f.message || ''}` }))) : null,
          tr && tr.state === 'clean' && p.approveUrl && !p.approved ? h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('ai.change.approve.server'), icon: 'circle-check', size: 'sm', loading: s.approvingServer, disabled: busy(), title: t('ai.change.approve.server.hint'), 'data-ai-approve-server': '', onClick: () => approve() })) : null,
          p.approved ? h('p', { class: 'dm-small', 'data-ai-approved-server': String(p.approved.index), text: t('ai.change.approved.server', { n: p.approved.number }) }) : null,
          p.details ? conflictsView(p)
            : p.conflicts ? h('ul', { class: 'dm-list dm-xs', 'data-ai-approve-conflicts': String(p.conflicts.length) }, p.conflicts.slice(0, 10).map((k) => h('li', { class: 'dm-xs', text: k }))) : null,
        ];
      }
      return { send, sendFile, trial, approve, resolve, view };
    }

    /** A value of the change set's form in words, for the collisions. */
    function conflictValue(v) {
      if (v === null || v === undefined) return '–';
      if (Array.isArray(v)) { const text = v.map(conflictValue).join(', '); return text.length > 60 ? text.slice(0, 57) + '…' : text; }
      if (typeof v === 'object') {
        if (v.value !== undefined) return String(v.value);
        if (v.enum !== undefined) return '.' + v.enum + '.';
        if (v.guid !== undefined) return String(v.guid) + (v.path ? '/' + v.path : '');
        if (v.step_id !== undefined) return '#' + v.step_id;
        return JSON.stringify(v).slice(0, 60);
      }
      return String(v);
    }
    /**
     * A collision on a whole instance (Dataregium's `#<step>` without an attribute): it was deleted or changed class in the latest
     * version, so it cannot be given up with keep_theirs; the change set goes again on the latest version.
     * @param {any} d an entry of conflict_details
     */
    function wholeConflict(d) {
      return !d.attribute && !String(d.key || '').includes('.');
    }
    /**
     * The person's choices on the collisions applied to the change set. Each collision finds its change by its place in `changes`
     * (Dataregium's change_index), else by the change's address: the STEP id when both have one, else the GlobalId and path, else
     * the instance's own GlobalId. A change kept takes the latest version's value as its old one, a change given up leaves the
     * proposal (for a whole instance every change of it), and the keys given up that are not whole instances go to keep_theirs for
     * the operations.
     * @param {{changes: any[]}} changeSet @param {any[]} details conflict_details @param {string[]} picks 'ours' or 'theirs' per detail
     * @returns {{changes: any[], keepTheirs: string[], kept: number, dropped: number}}
     */
    function decideConflicts(changeSet, details, picks) {
      const list = changeSet.changes || [];
      const address = (c) => JSON.stringify([c.guid || null, c.path || null, c.step_id === undefined || c.step_id === null ? null : Number(c.step_id)]);
      const same = (c, d) => c.attribute === d.attribute && (!d.op || c.op === d.op) && (
        c.step_id !== undefined && c.step_id !== null && d.step_id !== undefined && d.step_id !== null ? Number(c.step_id) === Number(d.step_id)
          : c.path ? !!c.guid && c.guid === d.guid && c.path === d.path
            : !!c.guid && c.guid === d.guid && !d.path);
      const changeOf = (d) => (Number.isInteger(d.change_index) && d.change_index >= 0 && d.change_index < list.length ? d.change_index : list.findIndex((c) => same(c, d)));
      /** @type {Map<number, number>} */ const decided = new Map();
      const gone = new Set();
      details.forEach((d, i) => {
        const at = changeOf(d);
        if (at < 0) return;
        decided.set(at, i);
        if (wholeConflict(d) && picks[i] === 'theirs') gone.add(address(list[at]));
      });
      let kept = 0; let dropped = 0;
      const changes = [];
      list.forEach((c, at) => {
        if (gone.has(address(c))) { dropped++; return; }
        const i = decided.has(at) ? /** @type {number} */ (decided.get(at)) : -1;
        if (i < 0) { changes.push(c); return; }
        if (picks[i] === 'theirs') { dropped++; return; }
        kept++;
        const d = details[i];
        changes.push(c.op === 'set' && !wholeConflict(d) ? Object.assign({}, c, { old: d.theirs === undefined ? null : d.theirs }) : c);
      });
      const keepTheirs = details.filter((d, i) => picks[i] === 'theirs' && !wholeConflict(d))
        .map((d) => String(d.key || (d.guid ? `${d.guid}${d.path ? '/' + d.path : ''}.${d.attribute}` : `#${d.step_id}.${d.attribute}`)));
      return { changes, keepTheirs, kept, dropped };
    }
    return { create, askWords, trialText, conflictValue, wholeConflict, decideConflicts };
  });
})();
