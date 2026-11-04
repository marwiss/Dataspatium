// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Graph editing as recipe steps (data/operations, group "graph"): add, change and remove nodes and edges, relabel,
 * merge nodes. The operations work on the graph tables of a graph dataset (nodes in `data`, edges in `_edges`),
 * refresh `_meta.graph` and are logged, replayed and undone like every other step. The Cypher writing clauses
 * (analysis/cypher-write) and the graph view's buttons both end here.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/graph-ops', ['data/operations', 'data/datasets'], (ops, datasets) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const propsText = (o) => { const p = {}; for (const [k, v] of Object.entries(o || {})) if (v !== null && v !== undefined && v !== '') p[k] = v; return Object.keys(p).length ? JSON.stringify(p) : null; };
    const parseProps = (v) => { if (!v) return {}; if (typeof v === 'object') return v; try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : {}; } catch (_e) { return {}; } };
    const list = (v) => (Array.isArray(v) ? v.map(String) : String(v || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean));
    const ph = (arr) => arr.map(() => '?').join(', ');
    const cypherKey = (k) => (/^[A-Za-z_]\w*$/.test(k) ? k : '`' + k.replace(/`/g, '``') + '`');
    const cypherValue = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(String(typeof v === 'object' ? JSON.stringify(v) : v)));
    const cypherMap = (o) => { const parts = Object.entries(o || {}).map(([k, v]) => `${cypherKey(k)}: ${cypherValue(v)}`); return parts.length ? ` {${parts.join(', ')}}` : ''; };

    async function ensureTables(ctx) {
      await ctx.engine.run('create table if not exists _edges (id text primary key, kalla text, mal text, typ text, egenskaper text)');
      await ctx.engine.run('create table if not exists _layout (id text primary key, x real, y real)');
    }
    /** Recount labels, types, nodes and edges into _meta.graph after an edit. */
    async function refreshMeta(ctx) {
      const metaRes = await ctx.engine.exec("select value from _meta where key = 'graph'");
      let info = {}; try { info = metaRes[0] && metaRes[0].values[0] ? JSON.parse(metaRes[0].values[0][0]) : {}; } catch (_e) { info = {}; }
      const n = await ctx.engine.exec('select count(*) from data'); const e = await ctx.engine.exec('select count(*) from _edges');
      const labels = await ctx.engine.exec("select coalesce(etikett, ''), count(*) from data group by 1 order by 2 desc, 1");
      const types = await ctx.engine.exec("select coalesce(typ, ''), count(*) from _edges group by 1 order by 2 desc, 1");
      info.nodes = Number(n[0].values[0][0]); info.edges = Number(e[0].values[0][0]);
      info.labels = (labels[0] ? labels[0].values : []).map((r) => ({ name: str(r[0]), count: Number(r[1]) }));
      info.types = (types[0] ? types[0].values : []).map((r) => ({ name: str(r[0]), count: Number(r[1]) }));
      if (info.directed === undefined) info.directed = true;
      await ctx.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['graph', JSON.stringify(info)]);
      // The open handle's record is what gets saved and listed: keep its graph facts current too.
      if (ctx.datasetId) { try { (await datasets.ensureOpen(ctx.datasetId)).meta.graph = info; } catch (_e) { /* not open */ } }
      return info;
    }
    async function nextEdgeId(ctx) {
      const r = await ctx.engine.exec("select max(cast(substr(id, 2) as integer)) from _edges where id like 'e%' and substr(id, 2) glob '[0-9]*'");
      return 'e' + ((r[0] && r[0].values[0] && Number(r[0].values[0][0])) || 0) + 1;
    }
    async function nodeExists(ctx, id) { const r = await ctx.engine.exec('select 1 from data where id = ?', [String(id)]); return !!(r[0] && r[0].values.length); }

    // ---- nodes --------------------------------------------------------------------------------------------------
    ops.define({
      id: 'graph_add_node', group: 'graph', manualPreview: true,
      params: [{ name: 'id', type: 'text', required: true }, { name: 'etikett', type: 'text' }, { name: 'namn', type: 'text' }, { name: 'egenskaper', type: 'lines' }],
      async apply(ctx, p) {
        await ensureTables(ctx);
        const id = str(p.id).trim(); if (!id) throw new Error(D.t('graph.op.err.id'));
        if (await nodeExists(ctx, id)) throw new Error(D.t('graph.op.err.exists', { id }));
        const props = parseProps(p.egenskaper && typeof p.egenskaper === 'string' && /^\s*\{/.test(p.egenskaper) ? p.egenskaper : linesToProps(p.egenskaper));
        await ctx.engine.run('insert into data (id, etikett, namn, egenskaper) values (?, ?, ?, ?)', [id, str(p.etikett) || null, str(p.namn) || props.name || id, propsText(props)]);
        await refreshMeta(ctx);
        return { rows: 1 };
      },
      toSQL: (p) => [`INSERT INTO data (id, etikett, namn, egenskaper) VALUES ('${str(p.id).replace(/'/g, "''")}', ${p.etikett ? "'" + str(p.etikett).replace(/'/g, "''") + "'" : 'NULL'}, ${p.namn ? "'" + str(p.namn).replace(/'/g, "''") + "'" : 'NULL'}, ${propsText(parseProps(linesToProps(p.egenskaper))) ? "'" + propsText(parseProps(linesToProps(p.egenskaper))).replace(/'/g, "''") + "'" : 'NULL'});`],
      toR: (p) => `# Cypher: CREATE (${p.etikett ? ':' + cypherKey(str(p.etikett)) : ''}${cypherMap(Object.assign({ id: p.id }, p.namn ? { name: p.namn } : {}, parseProps(linesToProps(p.egenskaper))))})`,
    });
    /** "key: value" lines (or JSON) → properties object; numbers and booleans are typed. */
    function linesToProps(text) {
      if (!text) return {};
      if (typeof text === 'object') return text;
      const s = String(text).trim();
      if (/^\{/.test(s)) return parseProps(s);
      const out = {};
      for (const line of s.split(/\n/)) { const m = /^\s*([^:=]+?)\s*[:=]\s*(.*?)\s*$/.exec(line); if (!m) continue; const v = m[2]; out[m[1]] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v; }
      return out;
    }
    ops.define({
      id: 'graph_set_node', group: 'graph', manualPreview: true,
      params: [{ name: 'ids', type: 'lines', required: true }, { name: 'etikett', type: 'text' }, { name: 'namn', type: 'text' }, { name: 'egenskaper', type: 'lines' }, { name: 'remove', type: 'lines' }],
      async apply(ctx, p) {
        await ensureTables(ctx);
        const ids = list(p.ids); if (!ids.length) throw new Error(D.t('graph.op.err.ids'));
        const set = linesToProps(p.egenskaper); const remove = list(p.remove);
        let rows = 0;
        for (const id of ids) {
          const r = await ctx.engine.exec('select egenskaper from data where id = ?', [id]);
          if (!r[0] || !r[0].values.length) continue;
          const props = parseProps(r[0].values[0][0]);
          for (const [k, v] of Object.entries(set)) props[k] = v;
          for (const k of remove) delete props[k];
          const sets = ['egenskaper = ?']; const vals = [propsText(props)];
          if (p.etikett !== undefined && p.etikett !== null && p.etikett !== '') { sets.push('etikett = ?'); vals.push(str(p.etikett)); }
          if (p.namn !== undefined && p.namn !== null && p.namn !== '') { sets.push('namn = ?'); vals.push(str(p.namn)); }
          else if (set.name !== undefined) { sets.push('namn = ?'); vals.push(str(set.name)); }
          vals.push(id);
          rows += await ctx.engine.run(`update data set ${sets.join(', ')} where id = ?`, vals);
        }
        await refreshMeta(ctx);
        return { rows };
      },
      toSQL: (p) => [`-- ${D.t('graph.op.sql.setnode', { n: list(p.ids).length })}`],
      toR: (p) => `# Cypher: MATCH (n) WHERE n.id IN [${list(p.ids).map((v) => JSON.stringify(v)).join(', ')}] SET ${Object.entries(linesToProps(p.egenskaper)).map(([k, v]) => `n.${cypherKey(k)} = ${cypherValue(v)}`).concat(p.etikett ? [`n:${cypherKey(str(p.etikett))}`] : []).join(', ') || 'n = n'}`,
    });
    ops.define({
      id: 'graph_delete_nodes', group: 'graph', manualPreview: true,
      params: [{ name: 'ids', type: 'lines', required: true }, { name: 'detach', type: 'switch', default: true }],
      async apply(ctx, p) {
        await ensureTables(ctx);
        const ids = list(p.ids); if (!ids.length) throw new Error(D.t('graph.op.err.ids'));
        let edges = 0;
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          const touching = await ctx.engine.exec(`select count(*) from _edges where kalla in (${ph(chunk)}) or mal in (${ph(chunk)})`, chunk.concat(chunk));
          const n = Number(touching[0].values[0][0]);
          if (n && p.detach === false) throw new Error(D.t('graph.op.err.attached', { n }));
          edges += await ctx.engine.run(`delete from _edges where kalla in (${ph(chunk)}) or mal in (${ph(chunk)})`, chunk.concat(chunk));
          await ctx.engine.run(`delete from _layout where id in (${ph(chunk)})`, chunk);
        }
        let rows = 0;
        for (let i = 0; i < ids.length; i += 500) { const chunk = ids.slice(i, i + 500); rows += await ctx.engine.run(`delete from data where id in (${ph(chunk)})`, chunk); }
        await refreshMeta(ctx);
        return { rows, edges };
      },
      toSQL: (p) => [`DELETE FROM _edges WHERE kalla IN (${list(p.ids).map((v) => "'" + v.replace(/'/g, "''") + "'").join(', ')}) OR mal IN (${list(p.ids).map((v) => "'" + v.replace(/'/g, "''") + "'").join(', ')});`, `DELETE FROM data WHERE id IN (${list(p.ids).map((v) => "'" + v.replace(/'/g, "''") + "'").join(', ')});`],
      toR: (p) => `# Cypher: MATCH (n) WHERE n.id IN [${list(p.ids).map((v) => JSON.stringify(v)).join(', ')}] DETACH DELETE n`,
    });
    ops.define({
      id: 'graph_merge_nodes', group: 'graph', manualPreview: true,
      params: [{ name: 'ids', type: 'lines', required: true }, { name: 'into', type: 'text', required: true }],
      async apply(ctx, p) {
        await ensureTables(ctx);
        const into = str(p.into).trim(); const ids = list(p.ids).filter((id) => id !== into);
        if (!into || !ids.length) throw new Error(D.t('graph.op.err.ids'));
        if (!(await nodeExists(ctx, into))) throw new Error(D.t('graph.op.err.missing', { id: into }));
        // Properties of the merged nodes fill gaps in the target; edges are re-pointed, self-loops created by the merge dropped.
        const target = await ctx.engine.exec('select egenskaper from data where id = ?', [into]);
        const props = parseProps(target[0].values[0][0]);
        for (const id of ids) { const r = await ctx.engine.exec('select egenskaper from data where id = ?', [id]); if (r[0] && r[0].values.length) for (const [k, v] of Object.entries(parseProps(r[0].values[0][0]))) if (props[k] === undefined) props[k] = v; }
        await ctx.engine.run('update data set egenskaper = ? where id = ?', [propsText(props), into]);
        let edges = 0;
        edges += await ctx.engine.run(`update _edges set kalla = ? where kalla in (${ph(ids)})`, [into].concat(ids));
        edges += await ctx.engine.run(`update _edges set mal = ? where mal in (${ph(ids)})`, [into].concat(ids));
        await ctx.engine.run('delete from _edges where kalla = ? and mal = ? and id in (select id from _edges where kalla = mal and kalla = ?)', [into, into, into]);
        await ctx.engine.run(`delete from _layout where id in (${ph(ids)})`, ids);
        const rows = await ctx.engine.run(`delete from data where id in (${ph(ids)})`, ids);
        await refreshMeta(ctx);
        return { rows, edges };
      },
      toSQL: (p) => [`-- ${D.t('graph.op.sql.merge', { n: list(p.ids).length, into: str(p.into) })}`],
      toR: (p) => `# ${D.t('graph.op.sql.merge', { n: list(p.ids).length, into: str(p.into) })}`,
    });

    // ---- edges --------------------------------------------------------------------------------------------------
    ops.define({
      id: 'graph_add_edge', group: 'graph', manualPreview: true,
      params: [{ name: 'kalla', type: 'text', required: true }, { name: 'mal', type: 'text', required: true }, { name: 'typ', type: 'text' }, { name: 'egenskaper', type: 'lines' }, { name: 'id', type: 'text' }],
      async apply(ctx, p) {
        await ensureTables(ctx);
        const a = str(p.kalla).trim(); const b = str(p.mal).trim();
        if (!(await nodeExists(ctx, a))) throw new Error(D.t('graph.op.err.missing', { id: a }));
        if (!(await nodeExists(ctx, b))) throw new Error(D.t('graph.op.err.missing', { id: b }));
        const id = str(p.id).trim() || await nextEdgeId(ctx);
        await ctx.engine.run('insert into _edges (id, kalla, mal, typ, egenskaper) values (?, ?, ?, ?, ?)', [id, a, b, str(p.typ) || null, propsText(linesToProps(p.egenskaper))]);
        await refreshMeta(ctx);
        return { rows: 1, id };
      },
      toSQL: (p) => [`INSERT INTO _edges (id, kalla, mal, typ, egenskaper) VALUES (${p.id ? "'" + str(p.id).replace(/'/g, "''") + "'" : 'NULL'}, '${str(p.kalla).replace(/'/g, "''")}', '${str(p.mal).replace(/'/g, "''")}', ${p.typ ? "'" + str(p.typ).replace(/'/g, "''") + "'" : 'NULL'}, NULL);`],
      toR: (p) => `# Cypher: MATCH (a {id: ${JSON.stringify(str(p.kalla))}}), (b {id: ${JSON.stringify(str(p.mal))}}) CREATE (a)-[:${cypherKey(str(p.typ) || 'RELATED')}${cypherMap(linesToProps(p.egenskaper))}]->(b)`,
    });
    ops.define({
      id: 'graph_set_edge', group: 'graph', manualPreview: true,
      params: [{ name: 'ids', type: 'lines', required: true }, { name: 'typ', type: 'text' }, { name: 'egenskaper', type: 'lines' }, { name: 'remove', type: 'lines' }],
      async apply(ctx, p) {
        await ensureTables(ctx);
        const ids = list(p.ids); if (!ids.length) throw new Error(D.t('graph.op.err.ids'));
        const set = linesToProps(p.egenskaper); const remove = list(p.remove);
        let rows = 0;
        for (const id of ids) {
          const r = await ctx.engine.exec('select egenskaper from _edges where id = ?', [id]);
          if (!r[0] || !r[0].values.length) continue;
          const props = parseProps(r[0].values[0][0]);
          for (const [k, v] of Object.entries(set)) props[k] = v;
          for (const k of remove) delete props[k];
          const sets = ['egenskaper = ?']; const vals = [propsText(props)];
          if (p.typ) { sets.push('typ = ?'); vals.push(str(p.typ)); }
          vals.push(id);
          rows += await ctx.engine.run(`update _edges set ${sets.join(', ')} where id = ?`, vals);
        }
        await refreshMeta(ctx);
        return { rows };
      },
      toSQL: (p) => [`-- ${D.t('graph.op.sql.setedge', { n: list(p.ids).length })}`],
      toR: (p) => `# Cypher: MATCH ()-[r]->() WHERE r.id IN [${list(p.ids).map((v) => JSON.stringify(v)).join(', ')}] SET ${Object.entries(linesToProps(p.egenskaper)).map(([k, v]) => `r.${cypherKey(k)} = ${cypherValue(v)}`).join(', ') || 'r = r'}`,
    });
    ops.define({
      id: 'graph_delete_edges', group: 'graph', manualPreview: true,
      params: [{ name: 'ids', type: 'lines', required: true }],
      async apply(ctx, p) {
        await ensureTables(ctx);
        const ids = list(p.ids); if (!ids.length) throw new Error(D.t('graph.op.err.ids'));
        let rows = 0;
        for (let i = 0; i < ids.length; i += 500) { const chunk = ids.slice(i, i + 500); rows += await ctx.engine.run(`delete from _edges where id in (${ph(chunk)})`, chunk); }
        await refreshMeta(ctx);
        return { rows };
      },
      toSQL: (p) => [`DELETE FROM _edges WHERE id IN (${list(p.ids).map((v) => "'" + v.replace(/'/g, "''") + "'").join(', ')});`],
      toR: (p) => `# Cypher: MATCH ()-[r]->() WHERE r.id IN [${list(p.ids).map((v) => JSON.stringify(v)).join(', ')}] DELETE r`,
    });

    const OPS = ['graph_add_node', 'graph_set_node', 'graph_delete_nodes', 'graph_merge_nodes', 'graph_add_edge', 'graph_set_edge', 'graph_delete_edges'];
    return { OPS, linesToProps, refreshMeta };
  });
})();
