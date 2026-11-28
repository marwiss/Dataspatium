// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The AI's two picture tools about an IFC model (PLAN 0 h, B-84; Dataregium's /mcp gives neither ifc_plot nor ifc_render, its
 * F205 d): render_view, the model as the 3D view draws it from a named view or an angle, of the whole model, a storey, a class or
 * chosen elements; and plan_or_section, a storey's plan cut at a height or a vertical section along an axis or a line, with the
 * view's own clipping and an orthographic camera. The pictures are drawn in the browser by viz/model-draw (meshes from the worker,
 * drawn off screen), at most 1024 px on the long side and about 300 kB, and go with the tool's answer only to a provider that sees
 * pictures (`options.images`; ai/providers.seesImages); any other gets a short text instead. Nothing is sent from here: the picture
 * goes with the question the person sends, under the AI's consent.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/view-tools', ['data/datasets', 'viz/model-draw'], (datasets, draw) => {
    const WIDTH = 1024;
    const HEIGHT = 768;
    const MAX_BYTES = 300 * 1024;
    const MAX_IDS = 500;
    const NO_PICTURE = 'No picture can be shown: the AI model in use does not take pictures. Read the model with the other tools instead.';
    const str = () => ({ type: ['string', 'null'] });
    const num = () => ({ type: ['number', 'null'] });
    const point = () => ({ type: ['array', 'null'], items: { type: 'number' } });
    /** The tools as the providers see them: flat, every field required, null for "not given" (the strict modes). */
    const TOOLS = [
      { name: 'render_view', description: 'A picture of the model as the app\'s 3D view draws it (shaded surfaces in the elements\' own colours, 1024 × 768 pixels), to see the shape, the layout and how the parts meet, which the tables cannot tell. It shows the whole model, one storey (storey), one IFC class (ifc_class) or chosen elements (ids: STEP ids or GlobalIds, at most 500): with ids and isolate false or null the rest is drawn too and the chosen elements are marked in the highlight colour, with isolate true only they are drawn. The camera frames what is chosen from view: iso (from above in the south-east, the default), top (from above, north up), front (from the south), back (from the north), left (from the west), right (from the east) or bottom; or from azimuth (degrees clockwise from the model\'s north, the side the camera looks from: 0 north, 90 east) and elevation (degrees above the horizon, default 30). The model\'s axes are x east, y north, z up. projection is perspective (the default) or orthographic. Answers what the picture shows, how many elements are drawn and the model\'s extent in its coordinates. It draws the model as it is, without the changes of an open change set. Each picture costs tokens: ask for one when words are not enough.',
        parameters: { type: 'object', properties: { view: str(), azimuth: num(), elevation: num(), storey: str(), ifc_class: str(), ids: { type: ['array', 'null'], items: { type: ['integer', 'string'] } }, isolate: { type: ['boolean', 'null'] }, projection: str() } } },
      { name: 'plan_or_section', description: 'An orthographic picture of the model cut by a plane, as the 3D view\'s section draws it (1024 × 768 pixels). kind plan: one storey seen from above with north up, cut at cut_height metres above the storey\'s floor (default 1.2, which cuts the walls, doors and windows), with only that storey\'s elements. kind section: a vertical cut seen from the side, with what lies on the viewer\'s side of the plane cut away; its plane runs along axis x (west to east at y = at, seen looking north) or y (south to north at x = at, seen looking west), or along the line from start to end ([x, y] metres in the model\'s coordinates, x east and y north, seen looking to the left of the line); at null puts the plane through the middle, and storey limits a section to one storey. Answers what the picture shows, where the cut lies, how many metres the picture\'s height spans and the model\'s extent in its coordinates. It draws the model as it is, without the changes of an open change set.',
        parameters: { type: 'object', properties: { kind: str(), storey: str(), cut_height: num(), axis: str(), at: num(), start: point(), end: point() } } },
    ];
    const has = (name) => TOOLS.some((tool) => tool.name === name);
    const VIEW_NAMES = Object.keys(draw.VIEWS);
    const round = (v) => Math.round(v * 100) / 100;
    const given = (v) => v !== null && v !== undefined && v !== '';
    const finite = (v) => given(v) && Number.isFinite(Number(v));

    /** The STEP ids of the rows that match, as numbers. */
    async function idsWhere(datasetId, where, params) {
      const handle = await datasets.ensureOpen(datasetId);
      const r = await handle.engine.exec(`select id from data where ${where}`, params);
      return (r[0] ? r[0].values : []).map((row) => Number(row[0])).filter(Number.isFinite);
    }
    /** The storeys' names, for an answer that names a storey the model lacks. */
    async function storeyNames(datasetId) {
      const handle = await datasets.ensureOpen(datasetId);
      const r = await handle.engine.exec("select distinct vaning from data where vaning is not null and vaning != '' order by vaning");
      return (r[0] ? r[0].values : []).map((row) => String(row[0]));
    }
    /** STEP ids and GlobalIds as STEP ids, at most MAX_IDS. */
    async function chosenIds(datasetId, list) {
      const items = (Array.isArray(list) ? list : []).slice(0, MAX_IDS);
      const steps = items.filter((x) => Number.isInteger(x) || (typeof x === 'string' && /^\d+$/.test(x))).map(Number);
      const guids = items.filter((x) => typeof x === 'string' && /^[0-9A-Za-z_$]{22}$/.test(x));
      return guids.length ? steps.concat(await idsWhere(datasetId, `guid in (${guids.map(() => '?').join(', ')})`, guids)) : steps;
    }
    /** The box of some elements (all without a list) in the model's own coordinates (Z up), as the 3D view's boundsIfc. */
    function extentOf(meshes, ids) {
      const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
      const boxes = ids ? ids.map((id) => meshes.stats.get(id)).filter(Boolean) : [meshes.focus];
      for (const b of boxes) {
        for (let i = 0; i < 8; i++) {
          const p = draw.toIfc(meshes.coordination, [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]]);
          for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
        }
      }
      return Number.isFinite(min[0]) ? { min, max } : { min: [-1, -1, -1], max: [1, 1, 1] };
    }
    const extentText = (box) => ({ min: box.min.map(round), max: box.max.map(round) });
    /** The picture drawn and its answer: the words, the picture (base64 without the prefix) and what the agent shows the person. */
    async function shoot(datasetId, shot, answer) {
      const got = await draw.picture(datasetId, shot, { width: WIDTH, height: HEIGHT, maxBytes: MAX_BYTES });
      const metres = got.view && got.view.height > 0 ? { metres_high: round(got.view.height), metres_per_pixel: Math.round(got.view.height / got.height * 10000) / 10000 } : {};
      return Object.assign(answer, { width: got.width, height: got.height }, metres, { picture: { mediaType: got.mediaType, data: got.url.split(',')[1] || '', bytes: got.bytes } });
    }
    /** The elements of a storey with geometry, or the answer that names the storeys. */
    async function storeyIds(datasetId, meshes, storey) {
      const ids = (await idsWhere(datasetId, 'lower(vaning) = lower(?)', [String(storey)])).filter((id) => meshes.byElement.has(id));
      return ids.length ? { ids } : { error: `no element with geometry on a storey named ${storey}; the storeys are ${(await storeyNames(datasetId)).join(', ') || 'none'}` };
    }

    async function renderView(datasetId, a) {
      const meshes = await draw.meshesOf(datasetId);
      const drawn = (ids) => ids.filter((id) => meshes.byElement.has(id));
      let visible = null;
      if (given(a.storey)) { const got = await storeyIds(datasetId, meshes, a.storey); if (got.error) return got; visible = got.ids; }
      if (given(a.ifc_class)) {
        const ids = drawn(await idsWhere(datasetId, 'lower(typ) = lower(?)', [String(a.ifc_class)]));
        visible = visible ? visible.filter((id) => ids.includes(id)) : ids;
        if (!visible.length) return { error: `no element of class ${a.ifc_class} with geometry${given(a.storey) ? ' on storey ' + a.storey : ''}` };
      }
      const chosen = Array.isArray(a.ids) && a.ids.length ? drawn(await chosenIds(datasetId, a.ids)) : [];
      if (Array.isArray(a.ids) && a.ids.length && !chosen.length) return { error: 'none of the ids names an element with geometry in the model' };
      const isolate = !!a.isolate && chosen.length > 0;
      if (isolate) visible = visible ? visible.filter((id) => chosen.includes(id)) : chosen;
      if (visible && !visible.length) return { error: 'none of the chosen elements lies on that storey or is of that class' };
      // A named view, or an angle: the direction from what is shown towards the camera in the model's axes (x east, y north, z up).
      const named = VIEW_NAMES.includes(String(a.view)) ? String(a.view) : 'iso';
      let direction = draw.VIEWS[named];
      let angle = '';
      if (finite(a.azimuth) || finite(a.elevation)) {
        const az = (finite(a.azimuth) ? Number(a.azimuth) : 135) * Math.PI / 180;
        const el = Math.max(-89.5, Math.min(89.5, finite(a.elevation) ? Number(a.elevation) : 30)) * Math.PI / 180;
        direction = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
        angle = `from azimuth ${round(az * 180 / Math.PI)}° and elevation ${round(el * 180 / Math.PI)}°`;
      }
      const projection = a.projection === 'orthographic' ? 'orthographic' : 'perspective';
      const count = visible ? visible.length : meshes.byElement.size;
      const scope = isolate ? `${chosen.length} chosen elements` : [given(a.storey) ? `storey ${a.storey}` : '', given(a.ifc_class) ? `the class ${a.ifc_class}` : ''].filter(Boolean).join(', ') || 'the whole model';
      const shows = `The ${angle ? 'view ' + angle : named + ' view'} of ${scope}, ${projection}: ${count} elements drawn${chosen.length && !isolate ? `, ${chosen.length} of them marked in the highlight colour` : ''}.`;
      return shoot(datasetId, { visible, selected: isolate ? [] : chosen, direction, projection },
        { shows, view: angle ? null : named, projection, count, marked: isolate ? 0 : chosen.length, extent: extentText(extentOf(meshes, visible)) });
    }

    async function planOrSection(datasetId, a) {
      const meshes = await draw.meshesOf(datasetId);
      const kind = a.kind === 'section' || (a.kind !== 'plan' && !given(a.storey)) ? 'section' : 'plan';
      if (kind === 'plan' && !given(a.storey)) return { error: 'give storey: the storey to draw in plan; list_storeys names them' };
      let visible = null;
      if (given(a.storey)) { const got = await storeyIds(datasetId, meshes, a.storey); if (got.error) return got; visible = got.ids; }
      const box = extentOf(meshes, visible);
      const centre = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2);
      const count = visible ? visible.length : meshes.byElement.size;
      const extent = extentText(box);
      if (kind === 'plan') {
        const cutHeight = finite(a.cut_height) ? Math.max(0.05, Math.min(20, Number(a.cut_height))) : 1.2;
        const z = box.min[2] + cutHeight;
        // The plane's direction points to the side cut away (BCF), here everything above the cut.
        const section = [{ location: [centre[0], centre[1], z], direction: [0, 0, 1] }];
        const shows = `The plan of storey ${a.storey}, cut ${round(cutHeight)} m above its floor (z ${round(box.min[2])} m, cut at z ${round(z)} m), seen from above with north (the model's y axis) up, orthographic: ${count} elements of the storey; what lies above the cut is not drawn.`;
        return shoot(datasetId, { visible, section, projection: 'orthographic', direction: draw.VIEWS.top }, { shows, kind, storey: String(a.storey), cut: { floor_z: round(box.min[2]), cut_height: round(cutHeight), z: round(z) }, count, extent });
      }
      let start; let end; let along;
      const pt = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
      if (pt(a.start) && pt(a.end)) { start = [Number(a.start[0]), Number(a.start[1])]; end = [Number(a.end[0]), Number(a.end[1])]; along = `the line from (${start.map(round).join(', ')}) to (${end.map(round).join(', ')})`; }
      else {
        const axis = a.axis === 'y' ? 'y' : 'x';
        const at = finite(a.at) ? Number(a.at) : centre[axis === 'x' ? 1 : 0];
        start = axis === 'x' ? [box.min[0], at] : [at, box.min[1]];
        end = axis === 'x' ? [box.max[0], at] : [at, box.max[1]];
        along = axis === 'x' ? `the x axis at y = ${round(at)} m` : `the y axis at x = ${round(at)} m`;
      }
      const dx = end[0] - start[0]; const dy = end[1] - start[1]; const len = Math.hypot(dx, dy);
      if (!(len > 1e-6)) return { error: 'start and end must be two different points' };
      // The view looks to the left of the line; the side behind the viewer is cut away and the camera stands there.
      const left = [-dy / len, dx / len];
      const away = [-left[0], -left[1], 0];
      const section = [{ location: [start[0], start[1], centre[2]], direction: away }];
      const facing = Math.round(((Math.atan2(left[0], left[1]) * 180 / Math.PI) + 360) % 360);
      const shows = `A vertical section along ${along}, seen looking towards azimuth ${facing}° (0 north, 90 east), orthographic: ${count} elements${given(a.storey) ? ' of storey ' + a.storey : ''}; what lies on the viewer's side of the plane is cut away.`;
      return shoot(datasetId, { visible, section, projection: 'orthographic', direction: away }, { shows, kind, storey: given(a.storey) ? String(a.storey) : null, cut: { start: start.map(round), end: end.map(round), looking: facing }, count, extent });
    }

    /**
     * Run a picture tool. Without `options.images` (a provider that does not see pictures) the answer is NO_PICTURE as an error the
     * model can read; bad arguments are errors too, never exceptions.
     * @param {string} datasetId @param {string} name @param {any} args @param {{images?: boolean}} [options]
     * @returns {Promise<any>} the answer, with `picture` {mediaType, data, bytes} when one was drawn
     */
    async function call(datasetId, name, args, options = {}) {
      if (!has(name)) return { error: 'unknown tool ' + name };
      if (!options.images) return { error: NO_PICTURE };
      const a = args && typeof args === 'object' ? args : {};
      try {
        return name === 'render_view' ? await renderView(datasetId, a) : await planOrSection(datasetId, a);
      } catch (err) { return { error: String((err && err.message) || err).slice(0, 300) }; }
    }
    return { TOOLS, has, call, NO_PICTURE, WIDTH, HEIGHT, MAX_BYTES };
  });
})();
