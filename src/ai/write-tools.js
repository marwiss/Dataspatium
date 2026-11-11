// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The write tools of "Ändra med AI": the AI proposes, the person decides. A call never touches the model; it is checked and put into
 * an open change set (a list of operations, JSON) that the person previews and approves in the model view, where it becomes the recipe
 * step ifc_changeset (python/dataspatium.py applies it with IfcOpenShell, checks the schema and reports). Lengths are metres. A created
 * wall, slab or opening gets a ref (new-1, new-2, …) so that later calls can name it before the file has given it an id; the wheel gives
 * the same refs in the same order. Deleting needs confirm: true from the AI and is confirmed again by the person before approval.
 * set_site places the model on earth (the site's WGS 84 position and, with an EPSG code, the map conversion); it is a change, not a
 * create, so it gets no ref. Publishing is never a tool. The schemas are flat where they can be, with every field required (null for
 * "not given").
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/write-tools', [], () => {
    const t = (k, p) => D.t(k, p);
    const MAX_OPS = 200;
    const MAX_IDS = 500;
    const str = () => ({ type: ['string', 'null'] });
    const num = () => ({ type: ['number', 'null'] });
    const xy = () => ({ type: ['array', 'null'], items: { type: 'number' } });
    const ids = () => ({ type: 'array', items: { type: ['integer', 'string'] } });
    const CREATES = ['create_wall', 'create_slab', 'create_opening'];
    /** The tools as the providers see them. */
    const TOOLS = [
      { name: 'create_storeys_and_grid', description: 'Add building storeys (name and elevation in metres above the first) and/or a grid to the change set. The grid has x_count bays of x_spacing metres along X (axes A, B, …) and y_count bays of y_spacing along Y (axes 1, 2, …), with A1 at (0, 0). A storey that already exists is kept. Either may be null.',
        parameters: { type: 'object', properties: {
          storeys: { type: ['array', 'null'], items: { type: 'object', properties: { name: { type: 'string' }, elevation: { type: 'number' } }, required: ['name', 'elevation'], additionalProperties: false } },
          grid: { type: ['object', 'null'], properties: { x_spacing: { type: 'number' }, x_count: { type: 'integer' }, y_spacing: { type: 'number' }, y_count: { type: 'integer' } }, required: ['x_spacing', 'x_count', 'y_spacing', 'y_count'], additionalProperties: false } } } },
      { name: 'create_wall', description: 'Add a wall on a storey (null: the lowest) from start [x, y] to end [x, y] in metres in the storey\'s plane, with its thickness centred on that line and its height from the storey. Defaults: thickness 0.2, height 3. Answers the ref of the wall.',
        parameters: { type: 'object', properties: { storey: str(), start: xy(), end: xy(), thickness: num(), height: num(), name: str() } } },
      { name: 'create_slab', description: 'Add a floor slab on a storey, with its top at the storey\'s elevation. outline is a list of [x, y] corners in metres, or null to follow the grid\'s extent. Default thickness 0.25. Answers the ref of the slab.',
        parameters: { type: 'object', properties: { storey: str(), outline: { type: ['array', 'null'], items: { type: 'array', items: { type: 'number' } } }, thickness: num(), name: str() } } },
      { name: 'create_opening', description: 'Cut an opening in a wall (wall_id: its id or ref), offset metres from the wall\'s start, width by height metres, sill metres above the storey, and fill it with a door or a window (fill: door, window or null). Defaults: width 0.9, height 2.1, sill 0. Answers the ref of the door or window, or of the opening.',
        parameters: { type: 'object', properties: { wall_id: { type: ['integer', 'string'] }, offset: num(), width: num(), height: num(), sill: num(), fill: str(), name: str() } } },
      { name: 'set_properties', description: 'Set properties in one property set (pset, such as Pset_WallCommon) on elements (ids: ids or refs): properties is a list of {name, value} with string, number or boolean values. Missing sets are created.',
        parameters: { type: 'object', properties: { ids: ids(), pset: { type: 'string' }, properties: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: ['string', 'number', 'boolean'] } }, required: ['name', 'value'], additionalProperties: false } } } } },
      { name: 'set_classification', description: 'Classify elements (ids or refs) with a class of a classification system such as a bSDD dictionary: system is the dictionary\'s name, name the class name, code its code and uri its address (a bSDD class uri). Written as an IfcClassificationReference. Use search_bsdd first to find the class.',
        parameters: { type: 'object', properties: { ids: ids(), system: { type: 'string' }, name: { type: 'string' }, code: str(), uri: str() } } },
      { name: 'assign', description: 'Move elements (ids or refs) to a storey (by name) and/or give them a material (by name, created when missing). Either may be null.',
        parameters: { type: 'object', properties: { ids: ids(), storey: str(), material: str() } } },
      { name: 'transform_elements', description: 'Move elements (ids or refs) by dx, dy, dz metres.',
        parameters: { type: 'object', properties: { ids: ids(), dx: num(), dy: num(), dz: num() } } },
      { name: 'delete_elements', description: 'Delete elements (ids or refs) with what depends on them. Only when the person asked for it in this conversation; confirm must be true to say so, and the person confirms again before approval.',
        parameters: { type: 'object', properties: { ids: ids(), confirm: { type: ['boolean', 'null'] } } } },
      { name: 'set_site', description: 'Set the model\'s place on earth: the site\'s latitude and longitude in WGS 84 degrees (south and west negative), its elevation in metres above sea level, and, when the model is drawn in a projected coordinate system, the map conversion: crs is the EPSG code (such as EPSG:3006 for SWEREF 99 TM), eastings and northings the coordinates of the model\'s origin in metres, and rotation the angle in degrees from grid north to the model\'s X axis (counter-clockwise positive; 0 when null). crs, eastings and northings go together; site_name renames the site. One call per model is enough: a second call replaces the first.',
        parameters: { type: 'object', properties: { latitude: { type: 'number' }, longitude: { type: 'number' }, elevation: num(), crs: str(), eastings: num(), northings: num(), rotation: num(), site_name: str() } } },
      { name: 'manage_changeset', description: 'The open change set: action list shows its steps, remove_last drops the last step, clear empties it.',
        parameters: { type: 'object', properties: { action: { type: 'string' } } } },
    ];
    const has = (name) => TOOLS.some((tool) => tool.name === name);

    /** An empty change set for one model. @param {string} datasetId */
    const create = (datasetId) => ({ datasetId, ops: [], refs: 0 });

    const finite = (v) => typeof v === 'number' && Number.isFinite(v);
    const given = (v) => v !== null && v !== undefined && v !== '';
    const err = (message) => ({ error: message });
    function number(args, key, options = {}) {
      const v = args[key];
      const unit = options.unit || 'metres';
      if (!given(v)) { if (options.required) throw new Error(`${key} is required (${unit})`); return options.fallback === undefined ? null : options.fallback; }
      if (!finite(v)) throw new Error(`${key} must be a number (${unit})`);
      if (options.positive && v <= 0) throw new Error(`${key} must be greater than zero`);
      return v;
    }
    function point(v, key) {
      if (!Array.isArray(v) || v.length !== 2 || !finite(v[0]) || !finite(v[1])) throw new Error(`${key} must be [x, y] in metres`);
      return [v[0], v[1]];
    }
    function text(args, key, options = {}) {
      const v = args[key];
      if (!given(v)) { if (options.required) throw new Error(`${key} is required`); return null; }
      return String(v).slice(0, 200);
    }
    function idList(cs, v) {
      if (!Array.isArray(v) || !v.length) throw new Error('ids must be a list of element ids or refs');
      if (v.length > MAX_IDS) throw new Error(`at most ${MAX_IDS} ids in one step`);
      return v.map((x) => idOrRef(cs, x, 'ids'));
    }
    function idOrRef(cs, x, key) {
      if (typeof x === 'string' && /^new-\d+$/.test(x)) {
        if (Number(x.slice(4)) < 1 || Number(x.slice(4)) > cs.refs) throw new Error(`${x} is not a ref of this change set (${cs.refs ? 'new-1 to new-' + cs.refs : 'none yet'})`);
        return x;
      }
      const n = typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : x;
      if (!Number.isInteger(n) || n < 1) throw new Error(`${key} must hold element ids (integers) or refs (new-1, …)`);
      return n;
    }
    /** The operation for one call, checked, in the shape the wheel reads. */
    function build(cs, name, args) {
      const a = args || {};
      switch (name) {
        case 'create_storeys_and_grid': {
          const storeys = Array.isArray(a.storeys) ? a.storeys.map((s) => { if (!s || !given(s.name)) throw new Error('every storey needs a name'); return { name: String(s.name).slice(0, 200), elevation: finite(s.elevation) ? s.elevation : 0 }; }) : [];
          let grid = null;
          if (a.grid && typeof a.grid === 'object') {
            grid = { x_spacing: number(a.grid, 'x_spacing', { required: true, positive: true }), x_count: number(a.grid, 'x_count', { fallback: 1, positive: true }), y_spacing: number(a.grid, 'y_spacing', { required: true, positive: true }), y_count: number(a.grid, 'y_count', { fallback: 1, positive: true }) };
            if (!Number.isInteger(grid.x_count) || !Number.isInteger(grid.y_count) || grid.x_count > 100 || grid.y_count > 100) throw new Error('x_count and y_count must be whole numbers, at most 100');
          }
          if (!storeys.length && !grid) throw new Error('give storeys, a grid or both');
          return { tool: name, storeys, grid };
        }
        case 'create_wall': {
          const start = point(a.start, 'start'); const end = point(a.end, 'end');
          if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 0.01) throw new Error('start and end are the same point');
          return { tool: name, storey: text(a, 'storey'), start, end, thickness: number(a, 'thickness', { fallback: 0.2, positive: true }), height: number(a, 'height', { fallback: 3, positive: true }), name: text(a, 'name') };
        }
        case 'create_slab': {
          const outline = given(a.outline) ? (Array.isArray(a.outline) ? a.outline.map((p) => point(p, 'outline')) : null) : null;
          if (given(a.outline) && (!outline || outline.length < 3)) throw new Error('outline must be at least three [x, y] points, or null for the grid\'s extent');
          return { tool: name, storey: text(a, 'storey'), outline, thickness: number(a, 'thickness', { fallback: 0.25, positive: true }), name: text(a, 'name') };
        }
        case 'create_opening': {
          const fill = given(a.fill) ? String(a.fill).toLowerCase() : null;
          if (fill && fill !== 'door' && fill !== 'window') throw new Error('fill must be door, window or null');
          if (!given(a.wall_id)) throw new Error('wall_id is required');
          return { tool: name, wall_id: idOrRef(cs, a.wall_id, 'wall_id'), offset: number(a, 'offset', { fallback: 0 }), width: number(a, 'width', { fallback: 0.9, positive: true }), height: number(a, 'height', { fallback: 2.1, positive: true }), sill: number(a, 'sill', { fallback: 0 }), fill, name: text(a, 'name') };
        }
        case 'set_properties': {
          const pset = text(a, 'pset', { required: true });
          if (!Array.isArray(a.properties) || !a.properties.length) throw new Error('properties must be a list of {name, value}');
          const properties = {};
          for (const p of a.properties) {
            if (!p || !given(p.name) || !['string', 'number', 'boolean'].includes(typeof p.value)) throw new Error('every property needs a name and a string, number or boolean value');
            properties[String(p.name).slice(0, 200)] = typeof p.value === 'string' ? p.value.slice(0, 1000) : p.value;
          }
          return { tool: name, ids: idList(cs, a.ids), pset, properties };
        }
        case 'set_classification': {
          const system = text(a, 'system', { required: true });
          const className = text(a, 'name', { required: true });
          return { tool: name, ids: idList(cs, a.ids), system, code: text(a, 'code'), name: className, uri: text(a, 'uri') };
        }
        case 'assign': {
          const storey = text(a, 'storey'); const material = text(a, 'material');
          if (!storey && !material) throw new Error('give a storey, a material or both');
          return { tool: name, ids: idList(cs, a.ids), storey, material };
        }
        case 'transform_elements': {
          const op = { tool: name, ids: idList(cs, a.ids), dx: number(a, 'dx', { fallback: 0 }), dy: number(a, 'dy', { fallback: 0 }), dz: number(a, 'dz', { fallback: 0 }) };
          if (!op.dx && !op.dy && !op.dz) throw new Error('nothing to move: dx, dy and dz are all zero');
          return op;
        }
        case 'delete_elements': {
          if (a.confirm !== true) throw new Error('deleting needs confirm: true, and only when the person asked for it in this conversation');
          return { tool: name, ids: idList(cs, a.ids), confirm: true };
        }
        case 'set_site': {
          const latitude = number(a, 'latitude', { required: true, unit: 'degrees' });
          const longitude = number(a, 'longitude', { required: true, unit: 'degrees' });
          if (latitude < -90 || latitude > 90) throw new Error('latitude must be between -90 and 90 degrees');
          if (longitude < -180 || longitude > 180) throw new Error('longitude must be between -180 and 180 degrees');
          const crs = text(a, 'crs');
          const eastings = number(a, 'eastings'); const northings = number(a, 'northings');
          if (crs) {
            if (!/^EPSG:\d+$/i.test(crs)) throw new Error('crs must be an EPSG code such as EPSG:3006');
            if (eastings === null || northings === null) throw new Error('eastings and northings (metres) are required with crs');
          } else if (eastings !== null || northings !== null) throw new Error('eastings and northings need a crs such as EPSG:3006');
          return { tool: name, latitude, longitude, elevation: number(a, 'elevation'), crs: crs ? crs.toUpperCase() : null, eastings, northings, rotation: number(a, 'rotation', { fallback: 0, unit: 'degrees' }), site_name: text(a, 'site_name') };
        }
        default: throw new Error(`unknown tool ${name}`);
      }
    }
    /**
     * Run one write tool against a change set: the operation is checked and appended, never applied. Errors are answers, so the model
     * can mend the call.
     * @param {{datasetId: string, ops: any[], refs: number}} cs @param {string} name @param {any} args
     */
    function call(cs, name, args) {
      if (!cs) return err('no change set is open');
      if (name === 'manage_changeset') {
        const action = args && args.action ? String(args.action) : 'list';
        if (action === 'clear') { cs.ops = []; cs.refs = 0; return { ok: true, steps: 0 }; }
        if (action === 'remove_last') {
          const last = cs.ops.pop();
          if (last && last.ref) cs.refs--;
          return { ok: true, removed: last ? describe(last) : null, steps: cs.ops.length };
        }
        if (action !== 'list') return err('action must be list, remove_last or clear');
        return { steps: cs.ops.map((op, i) => ({ step: i + 1, tool: op.tool, ref: op.ref || null, description: describe(op) })) };
      }
      if (!has(name)) return err(`unknown tool ${name}`);
      if (cs.ops.length >= MAX_OPS) return err(`the change set holds ${MAX_OPS} steps already; ask the person to approve it first`);
      let op;
      try { op = build(cs, name, args); } catch (e) { return err(String((e && e.message) || e)); }
      if (CREATES.includes(name)) { cs.refs++; op.ref = `new-${cs.refs}`; }
      cs.ops.push(op);
      const out = { ok: true, step: cs.ops.length, description: describe(op) };
      if (op.ref) out.ref = op.ref;
      return out;
    }
    const fmt = (v) => (typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v === null || v === undefined ? '' : v));
    const idsText = (list) => (list || []).map(fmt).join(', ');
    /** One line about an operation, for the panel's list and the log. @param {any} op */
    function describe(op) {
      switch (op.tool) {
        case 'create_storeys_and_grid': return t('ai.change.create_storeys_and_grid', { storeys: (op.storeys || []).map((s) => `${s.name} (${fmt(s.elevation)} m)`).join(', ') || '–', grid: op.grid ? t('ai.change.grid', { x: fmt(op.grid.x_spacing), y: fmt(op.grid.y_spacing), nx: fmt(op.grid.x_count), ny: fmt(op.grid.y_count) }) : '' });
        case 'create_wall': return t('ai.change.create_wall', { ref: op.ref || '', name: op.name || '', storey: op.storey || t('ai.change.storey.lowest'), x1: fmt(op.start[0]), y1: fmt(op.start[1]), x2: fmt(op.end[0]), y2: fmt(op.end[1]), thickness: fmt(op.thickness), height: fmt(op.height) });
        case 'create_slab': return t('ai.change.create_slab', { ref: op.ref || '', name: op.name || '', storey: op.storey || t('ai.change.storey.lowest'), thickness: fmt(op.thickness), outline: op.outline ? t('ai.change.outline.points', { n: String(op.outline.length) }) : t('ai.change.outline.grid') });
        case 'create_opening': return t('ai.change.create_opening', { ref: op.ref || '', fill: t('ai.change.fill.' + (op.fill || 'none')), name: op.name || '', wall: fmt(op.wall_id), width: fmt(op.width), height: fmt(op.height), offset: fmt(op.offset) });
        case 'set_properties': return t('ai.change.set_properties', { pset: op.pset, ids: idsText(op.ids), props: Object.entries(op.properties || {}).map(([k, v]) => `${k} = ${fmt(v)}`).join(', ') });
        case 'set_classification': return t('ai.change.set_classification', { ids: idsText(op.ids), system: op.system, cls: [op.code, op.name].filter(Boolean).join(' ') });
        case 'assign': return t('ai.change.assign', { ids: idsText(op.ids), storey: op.storey ? t('ai.change.assign.storey', { storey: op.storey }) : '', material: op.material ? t('ai.change.assign.material', { material: op.material }) : '' });
        case 'transform_elements': return t('ai.change.transform_elements', { ids: idsText(op.ids), dx: fmt(op.dx), dy: fmt(op.dy), dz: fmt(op.dz) });
        case 'delete_elements': return t('ai.change.delete_elements', { ids: idsText(op.ids) });
        case 'set_site': {
          const deg = (v) => String(Math.round(v * 1e6) / 1e6);
          const crs = op.crs ? t('ai.change.set_site.crs', { crs: op.crs, eastings: fmt(op.eastings), northings: fmt(op.northings) }) + (op.rotation ? t('ai.change.set_site.rotation', { rotation: fmt(op.rotation) }) : '') : '';
          return t('ai.change.set_site', { name: op.site_name ? ' ' + op.site_name : '', lat: deg(op.latitude), lon: deg(op.longitude), elevation: op.elevation === null ? '' : t('ai.change.set_site.elevation', { elevation: fmt(op.elevation) }), crs });
        }
        default: return String(op.tool);
      }
    }
    /** What a change set holds, in numbers. @param {{ops: any[]}} cs */
    const summary = (cs) => ({ steps: cs.ops.length, creates: cs.ops.filter((op) => CREATES.includes(op.tool) || op.tool === 'create_storeys_and_grid').length, deletes: cs.ops.filter((op) => op.tool === 'delete_elements').length });
    /** The operations as the wheel reads them (without the refs the panel shows). @param {{ops: any[]}} cs */
    const toWheel = (cs) => cs.ops.map((op) => { const o = Object.assign({}, op); delete o.ref; return o; });

    return { TOOLS, CREATES, MAX_OPS, has, create, call, describe, summary, toWheel };
  });
})();
