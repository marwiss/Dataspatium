// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Issues (BCF topics) against the elements of a model, as plain logic: a colour per status for the 3D view, the issues as a
 * table with one row per issue and element, counts per group for the tool Ärenden, and which saved tables belong to a model.
 * Colours come from the design tokens through viz/theme. Nothing here touches the DOM or the network.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/issues', ['viz/theme', 'data/datasets'], (theme, datasets) => {
    /** What a status usually means, read from its words: 0 open, 1 in progress, 2 done; 3 when the words say nothing. */
    const RANKS = [
      [/progress|pågå|under|arbete|work|review|gransk/i, 1],
      [/resolved|löst|closed|stäng|done|klar|avslut|rejected|avvis/i, 2],
      [/open|öppe|\bny\b|new|active|aktiv|request|begär|todo|att göra/i, 0],
    ];
    /**
     * The six review statuses of Swedish practice (BEAst's status words, which Praxi uses for review with BCF), as a mapping only: what
     * each means in the app (0 open, 1 in progress, 2 done) and the nearest default status of a Dataregium project. The words are
     * recognised in a project's own list of statuses; the app never offers them as values. A new comment is open; one to be fixed, or
     * sent on to a new review, is in progress; one fixed, rejected or approved is done.
     */
    const REVIEW_STATUSES = [
      { status: 'Ny kommentar', rank: 0, like: 'Open' },
      { status: 'Ska åtgärdas', rank: 1, like: 'In progress' },
      { status: 'Ny granskning', rank: 1, like: 'In progress' },
      { status: 'Har åtgärdats', rank: 2, like: 'Resolved' },
      { status: 'Avvisad', rank: 2, like: 'Closed' },
      { status: 'Godkänd', rank: 2, like: 'Closed' },
    ];
    const REVIEW_RANK = new Map(REVIEW_STATUSES.map((r) => [r.status.toLowerCase(), r.rank]));
    const TOPIC_FIELDS = ['guid', 'server_assigned_id', 'title', 'topic_type', 'topic_status', 'priority', 'stage', 'labels', 'assigned_to', 'creation_author', 'creation_date', 'modified_author', 'modified_date', 'due_date', 'description'];
    const ELEMENT_FIELDS = ['element_guid', 'element_typ', 'element_namn', 'element_vaning'];
    const COLUMNS = TOPIC_FIELDS.concat(ELEMENT_FIELDS);
    /** The columns the tool Ärenden can group by. */
    const SUMMARY_GROUPS = ['topic_status', 'topic_type', 'priority', 'assigned_to', 'element_typ', 'element_vaning'];

    /** @param {any} status @returns {number} 0 open, 1 in progress, 2 done, 3 unknown */
    function rank(status) {
      const s = String(status || '');
      const review = REVIEW_RANK.get(s.trim().replace(/\s+/g, ' ').toLowerCase());
      if (review !== undefined) return review;
      const hit = RANKS.find(([re]) => re.test(s));
      return hit ? hit[1] : 3;
    }
    /**
     * One colour per status: open is the error colour, in progress the warning colour, done the ok colour; statuses whose words
     * say nothing take the categorical palette in turn.
     * @param {string[]} statuses @returns {Map<string, string>}
     */
    function statusColors(statuses) {
      const tk = theme.tokens();
      const fixed = [tk.error, tk.warn, tk.ok];
      const out = new Map();
      let next = 0;
      for (const st of statuses) {
        const r = rank(st);
        out.set(st, r < 3 ? fixed[r] : tk.palette[next++ % tk.palette.length]);
      }
      return out;
    }
    const byRank = (a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b));

    /**
     * A colour per element from the issues that point at it; when several do, the most open status wins.
     * @param {any[]} topics BCF topics
     * @param {Map<string, Array<{guid: string}>>} parts topic guid to its components (ifc guids)
     * @param {Map<string, number>} elements ifc guid to the element id in the model
     * @returns {{groups: Array<{status: string, color: string, ids: number[]}>, legend: Array<{status: string, color: string, n: number}>}}
     */
    function colorGroups(topics, parts, elements) {
      const statuses = Array.from(new Set((topics || []).map((tp) => String(tp.topic_status || '')))).sort(byRank);
      const colors = statusColors(statuses);
      /** @type {Map<number, string>} */
      const best = new Map();
      for (const tp of topics || []) {
        const status = String(tp.topic_status || '');
        for (const c of parts.get(tp.guid) || []) {
          const id = elements.get(c.guid);
          if (id === undefined) continue;
          const had = best.get(id);
          if (had === undefined || byRank(status, had) < 0) best.set(id, status);
        }
      }
      /** @type {Map<string, number[]>} */
      const byStatus = new Map();
      for (const [id, status] of best) {
        const list = byStatus.get(status) || [];
        list.push(id);
        byStatus.set(status, list);
      }
      const groups = statuses.filter((st) => byStatus.has(st)).map((st) => ({ status: st, color: colors.get(st) || '', ids: byStatus.get(st) || [] }));
      return { groups, legend: groups.map((g) => ({ status: g.status, color: g.color, n: g.ids.length })) };
    }

    /**
     * The issues as a table: one row per issue and element it points at in this model, one row with empty element columns
     * for an issue that points at nothing here. Lists (labels) are joined with commas.
     * @param {any[]} topics @param {Map<string, Array<{guid: string}>>} parts
     * @param {Map<string, {typ?: any, namn?: any, vaning?: any}>} info ifc guid to the element's type, name and storey
     * @returns {{columns: string[], rows: any[][], meta: {}}}
     */
    function tableOf(topics, parts, info) {
      const rows = [];
      for (const tp of topics || []) {
        const head = TOPIC_FIELDS.map((f) => { const v = tp[f]; return Array.isArray(v) ? v.join(', ') : (v === undefined ? null : v); });
        const seen = new Set();
        const hits = (parts.get(tp.guid) || []).filter((c) => info.has(c.guid) && !seen.has(c.guid) && seen.add(c.guid));
        if (!hits.length) rows.push(head.concat([null, null, null, null]));
        for (const c of hits) {
          const e = info.get(c.guid) || {};
          rows.push(head.concat([c.guid, e.typ === undefined ? null : e.typ, e.namn === undefined ? null : e.namn, e.vaning === undefined ? null : e.vaning]));
        }
      }
      return { columns: COLUMNS.slice(), rows, meta: {} };
    }

    /**
     * Counts per group from a saved table of issues: issues, open issues and elements, by one or two of SUMMARY_GROUPS.
     * @param {string} id the table's dataset id @param {string[]} groups
     * @returns {Promise<{columns: Array<{name: string, type: string, label: string}>, rows: any[][]}>}
     */
    async function summary(id, groups) {
      const names = (await datasets.columns(id)).map((c) => c.name);
      const at = (n) => names.indexOf(n);
      const picked = Array.from(new Set((groups || []).filter((g) => SUMMARY_GROUPS.includes(g) && names.includes(g))));
      const rows = await datasets.query(id, {});
      const guidAt = at('guid'); const elementAt = at('element_guid'); const statusAt = at('topic_status');
      /** @type {Map<string, {key: string[], topics: Set<string>, open: Set<string>, elements: Set<string>}>} */
      const acc = new Map();
      for (const r of rows) {
        const key = picked.map((g) => (r[at(g)] === null || r[at(g)] === undefined ? '' : String(r[at(g)])));
        const k = JSON.stringify(key);
        let a = acc.get(k);
        if (!a) { a = { key, topics: new Set(), open: new Set(), elements: new Set() }; acc.set(k, a); }
        const guid = guidAt >= 0 ? r[guidAt] : null;
        if (guid) {
          a.topics.add(String(guid));
          if (rank(statusAt >= 0 ? r[statusAt] : '') < 2) a.open.add(String(guid));
        }
        const eg = elementAt >= 0 ? r[elementAt] : null;
        if (eg) a.elements.add(String(eg));
      }
      const out = Array.from(acc.values()).map((a) => a.key.concat([a.topics.size, a.open.size, a.elements.size]));
      out.sort((x, y) => Number(y[picked.length]) - Number(x[picked.length]) || String(x[0]).localeCompare(String(y[0])));
      const col = (name, type) => ({ name, type, label: name });
      return { columns: picked.map((g) => col(g, 'text')).concat([col('arenden', 'integer'), col('oppna', 'integer'), col('byggdelar', 'integer')]), rows: out };
    }

    /**
     * The saved tables of issues in the workspace, those of this model first.
     * @param {any[]} list dataset records @param {any} [model] @returns {any[]}
     */
    function tablesFor(list, model) {
      const own = (d) => d.source && d.source.cde && d.source.cde.kind === 'issues';
      return (list || []).filter(own).sort((a, b) => Number(!!(model && b.source.cde.modelId === model.id)) - Number(!!(model && a.source.cde.modelId === model.id)) || String(a.name).localeCompare(String(b.name)));
    }

    return { rank, statusColors, colorGroups, tableOf, summary, tablesFor, COLUMNS, TOPIC_FIELDS, ELEMENT_FIELDS, SUMMARY_GROUPS, REVIEW_STATUSES };
  });
})();
