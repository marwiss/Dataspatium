// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Steps that belong to one kind of data: repairing geometries, reading coordinates in another system, masking personal data
 * in running text, and setting a classification on elements of a model. They are ordinary recipe steps, so they can be undone
 * and replayed. Rows are read and written in batches, so that a large table does not stop the page.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/operations-kinds', ['data/operations', 'data/geo', 'data/types'], (ops, geo, types) => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const BATCH = 2000;
    const GEOMETRY = ['text'];
    const NUMERIC = ['number', 'integer'];

    /** The same point twice in a row is one point. */
    function withoutRepeats(points) {
      const out = [];
      for (const c of points) { const last = out[out.length - 1]; if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c); }
      return out;
    }
    /** A ring ends where it starts. */
    function closed(ring) {
      if (ring.length < 3) return ring;
      const a = ring[0]; const b = ring[ring.length - 1];
      return a[0] === b[0] && a[1] === b[1] ? ring : ring.concat([a]);
    }
    const usable = (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
    function repairPolygon(rings) {
      const fixed = rings.map((r) => closed(withoutRepeats(r.filter(usable)))).filter((r) => r.length >= 4);
      return fixed.length ? fixed : null;
    }
    /**
     * A geometry as well as it can be read: empty parts go, rings close, and what cannot be mended becomes null.
     * @param {any} g @returns {any}
     */
    function repairGeometry(g) {
      if (!g || !g.type) return null;
      switch (g.type) {
        case 'Point': return usable(g.coordinates) ? g : null;
        case 'MultiPoint': { const c = g.coordinates.filter(usable); return c.length ? { type: g.type, coordinates: c } : null; }
        case 'LineString': { const c = withoutRepeats(g.coordinates.filter(usable)); return c.length >= 2 ? { type: g.type, coordinates: c } : null; }
        case 'MultiLineString': { const c = g.coordinates.map((l) => withoutRepeats(l.filter(usable))).filter((l) => l.length >= 2); return c.length ? { type: g.type, coordinates: c } : null; }
        case 'Polygon': { const c = repairPolygon(g.coordinates); return c ? { type: g.type, coordinates: c } : null; }
        case 'MultiPolygon': { const c = g.coordinates.map(repairPolygon).filter(Boolean); return c.length ? { type: g.type, coordinates: c } : null; }
        case 'GeometryCollection': { const c = (g.geometries || []).map(repairGeometry).filter(Boolean); return c.length ? { type: g.type, geometries: c } : null; }
        default: return null;
      }
    }

    ops.define({
      id: 'geo_repair', group: 'geo',
      params: [{ name: 'column', type: 'column', required: true, kinds: GEOMETRY, prefer: /^(geometri|geometry|geom|wkt|the_geom)$/i }],
      async apply(ctx, p) {
        if (!ctx.column(p.column)) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
        let repaired = 0; let removed = 0;
        for (let last = 0; ;) {
          const r = await ctx.engine.exec(`select rowid, ${q(p.column)} from data where rowid > ? and ${q(p.column)} is not null order by rowid limit ${BATCH}`, [last]);
          const rows = r[0] ? r[0].values : [];
          if (!rows.length) break;
          for (const [rowid, value] of rows) {
            last = rowid;
            let shape = null;
            try { shape = geo.parseGeometry(value); } catch (_err) { shape = null; }
            const fixed = repairGeometry(shape);
            const text = fixed ? JSON.stringify(fixed) : null;
            if (text === value) continue;
            // A valid text in another form, such as WKT, is left alone when nothing had to be mended.
            if (fixed && shape && JSON.stringify(shape) === text) continue;
            await ctx.engine.run(`update data set ${q(p.column)} = ? where rowid = ?`, [text, rowid]);
            if (fixed) repaired++; else removed++;
          }
        }
        return { rows: repaired + removed, repaired, removed };
      },
      toSQL: (p) => [`-- ${D.t('op.geo_repair.code', { column: p.column })}`],
      toR: (p) => `# ${D.t('op.geo_repair.code', { column: p.column })}`,
    });

    ops.define({
      id: 'geo_from_system', group: 'geo',
      params: [
        { name: 'xColumn', type: 'column', required: true, kinds: NUMERIC }, { name: 'yColumn', type: 'column', required: true, kinds: NUMERIC },
        { name: 'crs', type: 'select', required: true, options: () => D.require('io/file-sense').SYSTEMS, default: '3006' },
        { name: 'xName', type: 'text', default: 'lon' }, { name: 'yName', type: 'text', default: 'lat' },
      ],
      async apply(ctx, p) {
        const xn = String(p.xName || 'lon').trim(); const yn = String(p.yName || 'lat').trim();
        for (const name of [xn, yn]) if (ctx.column(name)) throw new Error(D.t('op.err.column.exists', { name }));
        await ctx.engine.run(`alter table data add column ${q(xn)} ${types.sqlType('number')}`);
        await ctx.engine.run(`alter table data add column ${q(yn)} ${types.sqlType('number')}`);
        ctx.addColumn({ name: xn, type: 'number', label: xn });
        ctx.addColumn({ name: yn, type: 'number', label: yn });
        let done = 0;
        for (let last = 0; ;) {
          const r = await ctx.engine.exec(`select rowid, ${q(p.xColumn)}, ${q(p.yColumn)} from data where rowid > ? order by rowid limit ${BATCH}`, [last]);
          const rows = r[0] ? r[0].values : [];
          if (!rows.length) break;
          for (const [rowid, x, y] of rows) {
            last = rowid;
            if (typeof x !== 'number' || typeof y !== 'number') continue;
            const c = geo.toWgs84({ type: 'Point', coordinates: [x, y] }, String(p.crs)).coordinates;
            await ctx.engine.run(`update data set ${q(xn)} = ?, ${q(yn)} = ? where rowid = ?`, [c[0], c[1], rowid]);
            done++;
          }
        }
        return { rows: done };
      },
      toSQL: (p) => [`-- ${D.t('op.geo_from_system.code', { crs: p.crs })}`],
      toR: (p) => `# ${D.t('op.geo_from_system.code', { crs: p.crs })}\npts <- sf::st_as_sf(df, coords = c(${JSON.stringify(p.xColumn)}, ${JSON.stringify(p.yColumn)}), crs = ${Number(p.crs)})\npts <- sf::st_transform(pts, 4326)`,
    });

    ops.define({
      id: 'mask_personal', group: 'values', manualPreview: true,
      params: [{ name: 'column', type: 'column', required: true, kinds: GEOMETRY }, { name: 'where', type: 'text' }],
      async apply(ctx, p) {
        if (!ctx.column(p.column)) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
        const c = q(p.column);
        const rows = await ctx.engine.run(`update data set ${c} = dm_mask_personal(${c}) where dm_has_personal(${c})${p.where ? ` and (${p.where})` : ''}`);
        return { rows };
      },
      toSQL: (p) => [`-- ${D.t('op.mask_personal.code', { column: p.column })}`],
      toR: (p) => `# ${D.t('op.mask_personal.code', { column: p.column })}`,
    });

    ops.define({
      id: 'set_on_rows', group: 'values', manualPreview: true,
      params: [{ name: 'column', type: 'column', required: true }, { name: 'value', type: 'text' }, { name: 'where', type: 'text', required: true }],
      async apply(ctx, p) {
        const col = ctx.column(p.column);
        if (!col) throw new Error(D.t('op.err.unknown.column', { name: p.column }));
        const value = p.value === null || p.value === undefined || p.value === '' ? null : types.parseValue(p.value, col.type);
        return { rows: await ctx.engine.run(`update data set ${q(p.column)} = ? where ${p.where}`, [value]) };
      },
      toSQL: (p) => [`UPDATE data SET ${q(p.column)} = ${p.value === null || p.value === undefined || p.value === '' ? 'NULL' : "'" + String(p.value).replace(/'/g, "''") + "'"} WHERE ${p.where};`],
      toR: (p) => `# ${D.t('code.sql.expr', { expression: p.where })}`,
    });

    // The text goes in like any other change: it can be undone, and it is in the dataset's log. The list of documents is in the
    // file, so undoing brings that back too.
    ops.define({
      id: 'ocr_text', group: 'values', manualPreview: true,
      params: [{ name: 'document', type: 'text', required: true }, { name: 'pages', type: 'text', required: true }, { name: 'language', type: 'text' }, { name: 'confidence', type: 'text' }],
      async apply(ctx, p) {
        const pages = JSON.parse(p.pages);
        const top = await ctx.engine.exec('select coalesce(max(stycke), 0) from data where dokument = ?', [p.document]);
        let paragraph = Number(top[0].values[0][0]);
        let rows = 0;
        for (const { page, paragraphs } of pages) {
          for (const text of paragraphs) {
            paragraph++;
            rows += await ctx.engine.run('insert into data (dokument, sida, stycke, typ, text, tecken) values (?, ?, ?, ?, ?, ?)', [p.document, page, paragraph, 'stycke', text, text.length]);
          }
        }
        const handle = await D.require('data/datasets').ensureOpen(ctx.datasetId);
        const added = pages.reduce((n, x) => n + x.paragraphs.reduce((m, s) => m + (String(s).match(/[\p{L}\p{N}]+/gu) || []).length, 0), 0);
        const count = pages.reduce((n, x) => n + x.paragraphs.length, 0);
        handle.meta.documents = (handle.meta.documents || []).map((d) => (d.name !== p.document ? d : Object.assign({}, d, {
          paragraphs: (Number(d.paragraphs) || 0) + count,
          words: (Number(d.words) || 0) + added,
          ocr: { pages: ((d.ocr && d.ocr.pages) || []).concat(pages.map((x) => x.page)), language: p.language || 'sv', confidence: Number(p.confidence) || 0 },
        })));
        await ctx.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['documents', JSON.stringify(handle.meta.documents)]);
        return { rows };
      },
      toSQL: (p) => [`-- ${D.t('op.ocr_text.code', { document: p.document })}`],
      toR: (p) => `# ${D.t('op.ocr_text.code', { document: p.document })}`,
    });

    return { repairGeometry };
  });
})();
