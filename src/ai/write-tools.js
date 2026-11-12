// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The write tools of "Ändra med AI": the AI proposes, the person decides. A call never touches the model; it is checked and put into
 * an open change set (a list of operations, JSON) that the person previews and approves in the model view, where it becomes the recipe
 * step ifc_changeset (python/dataspatium.py applies it with IfcOpenShell, checks the schema and reports). Lengths are metres. A created
 * wall, slab, roof or opening gets a ref (new-1, new-2, …) so that later calls can name it before the file has given it an id; the wheel
 * gives the same refs in the same order. Deleting needs confirm: true from the AI and is confirmed again by the person before approval.
 * create_roof covers a rectangle (the outline's bounding box, or the storey's walls') with a gable, hip, shed or flat roof of roof slabs.
 * create_spaces makes the rooms the walls enclose into spaces (decision B-57.1) with names from the room programme, from the topology
 * the wheel computes at that step; it gets one ref per listed room (op.refs), and none when every room is made.
 * set_site places the model on earth (the site's WGS 84 position and, with an EPSG code, the map conversion); it is a change, not a
 * create, so it gets no ref. define_type makes a wall, slab or roof type with its material layers and a ref, which create_wall,
 * create_slab and create_roof take as type: the element gets the type, its thickness from the layers and the layers laid on it, and the
 * wheel joins the walls whose axes meet and writes the base quantities when it applies the change set (recommendations 3, 5 and 6 of
 * the native IFC study). Publishing is never a tool. The schemas are flat where they can be, with every field required (null for
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
    const bool = () => ({ type: ['boolean', 'null'] });
    const CREATES = ['create_wall', 'create_slab', 'create_roof', 'create_opening', 'create_spaces', 'define_type'];
    const ROOF_SHAPES = ['gable', 'hip', 'shed', 'flat'];
    const MAX_ROOMS = 200;
    const TYPE_KINDS = ['wall', 'slab', 'roof'];
    const MAX_LAYERS = 20;
    /** IfcMaterial.Category as IfcOpenShell recommends it, and the roles of IfcMaterialLayer.Category (the wheel spells them per schema). */
    const MATERIAL_CATEGORIES = ['concrete', 'steel', 'aluminium', 'block', 'brick', 'stone', 'wood', 'glass', 'gypsum', 'plastic', 'earth'];
    const LAYER_ROLES = ['load_bearing', 'insulation', 'inner_finish', 'outer_finish'];
    const typeRef = () => ({ type: ['integer', 'string', 'null'] });
    /** The tools as the providers see them. */
    const TOOLS = [
      { name: 'create_storeys_and_grid', description: 'Add building storeys (name and elevation in metres above the first) and/or a grid to the change set. The grid has x_count bays of x_spacing metres along X (axes A, B, …) and y_count bays of y_spacing along Y (axes 1, 2, …), with A1 at (0, 0). A storey that already exists is kept. Either may be null.',
        parameters: { type: 'object', properties: {
          storeys: { type: ['array', 'null'], items: { type: 'object', properties: { name: { type: 'string' }, elevation: { type: 'number' } }, required: ['name', 'elevation'], additionalProperties: false } },
          grid: { type: ['object', 'null'], properties: { x_spacing: { type: 'number' }, x_count: { type: 'integer' }, y_spacing: { type: 'number' }, y_count: { type: 'integer' } }, required: ['x_spacing', 'x_count', 'y_spacing', 'y_count'], additionalProperties: false } } } },
      { name: 'define_type', description: 'Define a wall, slab or roof type with its material layers, before the elements that use it. kind is wall (an IfcWallType), slab (an IfcSlabType) or roof (an IfcSlabType ROOF for the roof slabs of create_roof); name is the type\'s name, such as YV1. layers are its material layers, each {material, thickness in metres, category, role}: for a wall from its right side to its left as seen from its start toward its end (so the outside first when the outer walls run counter-clockwise), for a slab or a roof from the top down. category is the material\'s IFC category (concrete, steel, aluminium, block, brick, stone, wood, glass, gypsum, plastic or earth) and role the layer\'s (load_bearing, insulation, inner_finish or outer_finish); give them only when known, else null. predefined_type is the type\'s PredefinedType from its class\'s list, such as SOLIDWALL or PARTITIONING for a wall and FLOOR or BASESLAB for a slab (null: NOTDEFINED for a wall, FLOOR for a slab; a roof type is ROOF). Answers the ref of the type, which create_wall, create_slab and create_roof take as type; put shared properties on the type with set_properties and its ref.',
        parameters: { type: 'object', properties: { kind: { type: 'string' }, name: { type: 'string' }, layers: { type: 'array', items: { type: 'object', properties: { material: { type: 'string' }, thickness: { type: 'number' }, category: str(), role: str() }, required: ['material', 'thickness', 'category', 'role'], additionalProperties: false } }, predefined_type: str() } } },
      { name: 'create_wall', description: 'Add a wall on a storey (null: the lowest) from start [x, y] to end [x, y] in metres in the storey\'s plane, with its thickness centred on that line and its height from the storey. Defaults: thickness 0.2, height 3. partition true makes a non-load-bearing interior wall (PredefinedType PARTITIONING) when the wall has no type; otherwise the wall is SOLIDWALL or takes its PredefinedType from the type. With type (the ref of a define_type wall type, or a wall type\'s GlobalId or id) the wall takes its thickness from the type\'s layers, so leave thickness null. Walls whose lines meet at a corner, or that end on another wall\'s line, are joined by the app when the change set is applied: let them meet on their lines, and never lengthen or overlap them to close a corner. Answers the ref of the wall.',
        parameters: { type: 'object', properties: { storey: str(), start: xy(), end: xy(), thickness: num(), height: num(), name: str(), type: typeRef(), partition: bool() } } },
      { name: 'create_slab', description: 'Add a floor slab on a storey, with its top at the storey\'s elevation. outline is a list of [x, y] corners in metres, or null to follow the grid\'s extent. Default thickness 0.25. With type (the ref of a define_type slab type, or a slab type\'s GlobalId or id) the slab takes its thickness from the type\'s layers, so leave thickness null. Answers the ref of the slab.',
        parameters: { type: 'object', properties: { storey: str(), outline: { type: ['array', 'null'], items: { type: 'array', items: { type: 'number' } } }, thickness: num(), name: str(), type: typeRef() } } },
      { name: 'create_roof', description: 'Add a roof on the walls of a storey (null: the top storey), as an IfcRoof of roof slabs: shape is gable, hip, shed or flat. outline is the [x, y] corners in metres of the rectangle it covers, or null for the bounding box of the storey\'s walls; an outline that is not a rectangle along x and y is replaced by its bounding box for now. pitch is degrees, more than 0 and at most 75 (defaults: 30 for gable and hip, 10 for shed; flat ignores it). overhang is metres beyond the outline at the eaves (default 0.4, for flat 0), thickness metres (default 0.25). ridge is x or y: for gable the direction of the ridge (null: along the longer side), for shed the axis it falls along, down toward negative x or y (null: y, so to the south when y points north); hip and flat ignore it. base is the eaves height in metres above the storey (null: the top of the storey\'s walls, else 2.7). With type (the ref of a define_type roof type, or a roof type\'s GlobalId or id) every roof slab takes its thickness from the type\'s layers, so leave thickness null. Answers the ref of the roof.',
        parameters: { type: 'object', properties: { storey: str(), shape: { type: 'string' }, outline: { type: ['array', 'null'], items: { type: 'array', items: { type: 'number' } } }, pitch: num(), overhang: num(), thickness: num(), ridge: str(), base: num(), name: str(), type: typeRef() } } },
      { name: 'create_opening', description: 'Cut an opening in a wall (wall_id: its id or ref), offset metres from the wall\'s start, width by height metres, sill metres above the storey, and fill it with a door or a window (fill: door, window or null). Defaults: width 0.9, height 2.1, sill 0. Answers the ref of the door or window, or of the opening.',
        parameters: { type: 'object', properties: { wall_id: { type: ['integer', 'string'] }, offset: num(), width: num(), height: num(), sill: num(), fill: str(), name: str() } } },
      { name: 'create_spaces', description: 'Create the rooms the walls enclose as spaces (IfcSpace), from the topology of the model as it stands at this step, so that walls created earlier in the change set count. Each space gets the room\'s outline extruded to its height, is aggregated in its storey, gets Qto_SpaceBaseQuantities, and gets space boundaries to the walls along its edge and to the doors and windows in them (a door created later in such a wall joins them). storey is the storey\'s name; null makes every room on every storey with rooms, and then rooms must be null. rooms lists the rooms: each by at, an [x, y] point inside it in metres in the storey\'s plane, or by index, its index in get_topology (the other null), with name from the room programme (such as Kitchen) and long_name or null; null makes every room, named Room 1, Room 2 … in the person\'s language. A room that a space covers already is left out. height is metres (null: up to the next storey, or the walls\' height on the top storey). Answers one ref per listed room, in order; with rooms null the spaces get no refs.',
        parameters: { type: 'object', properties: { storey: str(), rooms: { type: ['array', 'null'], items: { type: 'object', properties: { at: xy(), index: { type: ['integer', 'null'] }, name: { type: 'string' }, long_name: str() }, required: ['at', 'index', 'name', 'long_name'], additionalProperties: false } }, height: num() } } },
      { name: 'set_properties', description: 'Set properties in one property set (pset, such as Pset_WallCommon) on elements (ids: ids or refs): properties is a list of {name, value} with string, number or boolean values. Missing sets are created.',
        parameters: { type: 'object', properties: { ids: ids(), pset: { type: 'string' }, properties: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: ['string', 'number', 'boolean'] } }, required: ['name', 'value'], additionalProperties: false } } } } },
      { name: 'set_classification', description: 'Classify elements (ids or refs) with a class of the classification system the person names; never assume a system. The IFC class with its PredefinedType is the classification itself (choose it with search_ifc_class); this adds a system on top. system is that system\'s name, name the class name, code its code and uri its address (for a bSDD class its uri). Written as an IfcClassificationReference under the system\'s IfcClassification, shared only when the system, the code and the uri match. edition, source and dictionary_uri describe the system (its edition, its publisher and the dictionary\'s address) and are written on its IfcClassification; the same system with another edition or dictionary_uri is another IfcClassification. search_bsdd finds a class in a free bSDD dictionary: take its dictionary as system with its edition, source and dictionary_uri. Never invent a code or an edition; null when not known.',
        parameters: { type: 'object', properties: { ids: ids(), system: { type: 'string' }, name: { type: 'string' }, code: str(), uri: str(), edition: str(), source: str(), dictionary_uri: str() } } },
      { name: 'assign', description: 'Move elements (ids or refs) to a storey (by name) and/or give them a material (by name, created when missing). Either may be null.',
        parameters: { type: 'object', properties: { ids: ids(), storey: str(), material: str() } } },
      { name: 'transform_elements', description: 'Move elements (ids or refs) by dx, dy, dz metres.',
        parameters: { type: 'object', properties: { ids: ids(), dx: num(), dy: num(), dz: num() } } },
      { name: 'delete_elements', description: 'Delete elements (ids or refs) with what depends on them. Only when the person asked for it in this conversation; confirm must be true to say so, and the person confirms again before approval.',
        parameters: { type: 'object', properties: { ids: ids(), confirm: { type: ['boolean', 'null'] } } } },
      { name: 'set_site', description: 'Set the model\'s place on earth: the site\'s latitude and longitude in WGS 84 degrees (south and west negative), its elevation in metres above sea level, and, when the model is drawn in a projected coordinate system, the map conversion: crs is the EPSG code (such as EPSG:3006 for SWEREF 99 TM), eastings and northings the coordinates of the model\'s origin in metres, and rotation the angle in degrees from grid east (the map\'s x axis, along the eastings) to the model\'s X axis, counter-clockwise positive, as IfcMapConversion measures it (0 when null: the model\'s X axis points east and its Y axis north). crs, eastings and northings go together; site_name renames the site. One call per model is enough: a second call replaces the first.',
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
    /** An IFC GlobalId: 22 characters of IFC's base 64 (a proposal to a server names elements so; decision F34 a at Dataregium). */
    const GUID = /^[0-9A-Za-z_$]{22}$/;
    function idOrRef(cs, x, key) {
      if (typeof x === 'string' && /^new-\d+$/.test(x)) {
        if (Number(x.slice(4)) < 1 || Number(x.slice(4)) > cs.refs) throw new Error(`${x} is not a ref of this change set (${cs.refs ? 'new-1 to new-' + cs.refs : 'none yet'})`);
        return x;
      }
      const n = typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : x;
      if (typeof n === 'string' && GUID.test(n)) return n;
      if (!Number.isInteger(n) || n < 1) throw new Error(`${key} must hold element ids (integers), GlobalIds or refs (new-1, …)`);
      return n;
    }
    /** [x, y] corners without a repeat of the first one at the end: the wheel closes an outline on its first point (GEM111). @param {number[][]} pts */
    function corners(pts) {
      const out = pts.slice();
      while (out.length > 1 && out[out.length - 1][0] === out[0][0] && out[out.length - 1][1] === out[0][1]) out.pop();
      return out;
    }
    /** The bounding box [x0, y0, x1, y1] of [x, y] points. @param {number[][]} pts */
    const bounds = (pts) => pts.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
    /** Whether [x, y] points are the four corners of their bounding box (a closing corner may repeat the first). @param {number[][]} pts */
    function rectangular(pts) {
      const last = pts[pts.length - 1];
      const p = pts.length > 4 && last[0] === pts[0][0] && last[1] === pts[0][1] ? pts.slice(0, -1) : pts;
      if (p.length !== 4) return false;
      const [x0, y0, x1, y1] = bounds(p);
      const side = (v, lo, hi) => (Math.abs(v - lo) < 1e-3 ? 'lo' : Math.abs(v - hi) < 1e-3 ? 'hi' : '');
      const hit = new Set(p.map((q) => side(q[0], x0, x1) + ',' + side(q[1], y0, y1)));
      return hit.size === 4 && Array.from(hit).every((k) => !k.startsWith(',') && !k.endsWith(','));
    }
    /** The total of a type's layers in metres. @param {Array<{thickness: number}>} layers */
    const layersThickness = (layers) => Math.round(layers.reduce((s, l) => s + l.thickness, 0) * 1e6) / 1e6;
    /**
     * The type a create step names, as {ref, thickness}: the ref of a define_type step of the kind, checked here and with its layers'
     * thickness, or a type's id or GlobalId in the model, which the wheel checks (thickness null); null without a type.
     * @param {{ops: any[], refs: number}} cs @param {any} a @param {string} kind @param {string} tool
     */
    function typeOf(cs, a, kind, tool) {
      if (!given(a.type)) return null;
      const ref = idOrRef(cs, a.type, 'type');
      if (typeof ref !== 'string' || !/^new-\d+$/.test(ref)) return { ref, thickness: null };
      const def = cs.ops.find((op) => op.ref === ref);
      if (!def || def.tool !== 'define_type') throw new Error(`type ${ref} is not a type; give the ref of a define_type step, or a type's id`);
      if (def.kind !== kind) throw new Error(`type ${ref} is a ${def.kind} type; ${tool} takes a ${kind} type`);
      return { ref, thickness: layersThickness(def.layers) };
    }
    /** A typed step's thickness: the layers', which a thickness given must match (within half a millimetre). */
    function typedThickness(a, typed) {
      const own = number(a, 'thickness', { positive: true });
      if (own !== null && typed.thickness !== null && Math.abs(own - typed.thickness) > 0.0005) throw new Error(`thickness ${fmt(own)} m differs from the ${fmt(typed.thickness)} m of the layers of type ${typed.ref}; leave thickness null`);
      return typed.thickness !== null ? typed.thickness : own;
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
        case 'define_type': {
          const kind = given(a.kind) ? String(a.kind).trim().toLowerCase() : '';
          if (!TYPE_KINDS.includes(kind)) throw new Error('kind must be wall, slab or roof');
          const typeName = text(a, 'name', { required: true }).trim();
          if (!typeName) throw new Error('name is required');
          if (!Array.isArray(a.layers) || !a.layers.length || a.layers.length > MAX_LAYERS) throw new Error(`layers must be a list of 1 to ${MAX_LAYERS} {material, thickness, category, role}, the thickness in metres`);
          const layers = a.layers.map((l, i) => {
            const which = `layer ${i + 1}`;
            if (!l || typeof l !== 'object' || !given(l.material) || !String(l.material).trim()) throw new Error(`${which} needs a material`);
            if (!finite(l.thickness) || l.thickness <= 0) throw new Error(`${which}: thickness must be a number greater than zero (metres)`);
            const category = given(l.category) ? String(l.category).trim().toLowerCase() : null;
            if (category && !MATERIAL_CATEGORIES.includes(category)) throw new Error(`${which}: category must be ${MATERIAL_CATEGORIES.join(', ')} or null`);
            const role = given(l.role) ? String(l.role).trim().toLowerCase().replace(/[\s-]+/g, '_') : null;
            if (role && !LAYER_ROLES.includes(role)) throw new Error(`${which}: role must be ${LAYER_ROLES.join(', ')} or null`);
            return { material: String(l.material).trim().slice(0, 200), thickness: l.thickness, category: category || null, role: role || null };
          });
          if (layersThickness(layers) > 5) throw new Error('the layers add up to more than 5 m');
          const predefined = given(a.predefined_type) ? String(a.predefined_type).trim().toUpperCase() : null;
          if (predefined && !/^[A-Z][A-Z0-9_]*$/.test(predefined)) throw new Error('predefined_type must be a PredefinedType such as SOLIDWALL, PARTITIONING, FLOOR or BASESLAB, or null');
          if (predefined === 'USERDEFINED') throw new Error('USERDEFINED needs the name of a kind of its own, which define_type does not take; choose a value from the class\'s list, or NOTDEFINED');
          if (kind === 'roof' && predefined && predefined !== 'ROOF') throw new Error('a roof type is an IfcSlabType ROOF; leave predefined_type null');
          // Slab and roof types are both IfcSlabType, so their names must differ too.
          const twin = cs.ops.find((op) => op.tool === 'define_type' && (op.kind === 'wall') === (kind === 'wall') && op.name.toLowerCase() === typeName.toLowerCase());
          if (twin) throw new Error(`${twin.ref} is a ${twin.kind} type named ${twin.name} already; give its ref as type, or choose another name`);
          return { tool: name, kind, name: typeName, layers, predefined_type: predefined || null };
        }
        case 'create_wall': {
          const start = point(a.start, 'start'); const end = point(a.end, 'end');
          if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 0.01) throw new Error('start and end are the same point');
          const typed = typeOf(cs, a, 'wall', name);
          const op = { tool: name, storey: text(a, 'storey'), start, end, thickness: typed ? typedThickness(a, typed) : number(a, 'thickness', { fallback: 0.2, positive: true }), height: number(a, 'height', { fallback: 3, positive: true }), name: text(a, 'name') };
          if (typed) op.type = typed.ref;
          if (a.partition === true) op.partition = true;  // PARTITIONING in the wheel when untyped; SOLIDWALL otherwise
          return op;
        }
        case 'create_slab': {
          const outline = given(a.outline) ? (Array.isArray(a.outline) ? corners(a.outline.map((p) => point(p, 'outline'))) : null) : null;
          if (given(a.outline) && (!outline || outline.length < 3)) throw new Error('outline must be at least three [x, y] points, or null for the grid\'s extent');
          const typed = typeOf(cs, a, 'slab', name);
          const op = { tool: name, storey: text(a, 'storey'), outline, thickness: typed ? typedThickness(a, typed) : number(a, 'thickness', { fallback: 0.25, positive: true }), name: text(a, 'name') };
          if (typed) op.type = typed.ref;
          return op;
        }
        case 'create_roof': {
          const shape = given(a.shape) ? String(a.shape).toLowerCase() : '';
          if (!ROOF_SHAPES.includes(shape)) throw new Error('shape must be gable, hip, shed or flat');
          const outline = given(a.outline) ? (Array.isArray(a.outline) ? corners(a.outline.map((p) => point(p, 'outline'))) : null) : null;
          if (given(a.outline) && (!outline || outline.length < 3)) throw new Error('outline must be at least three [x, y] points, or null for the bounding box of the storey\'s walls');
          if (outline) { const b = bounds(outline); if (b[2] - b[0] < 0.1 || b[3] - b[1] < 0.1) throw new Error('outline must span at least 0.1 m along x and along y'); }
          const flat = shape === 'flat';
          const pitch = flat ? 0 : number(a, 'pitch', { fallback: shape === 'shed' ? 10 : 30, unit: 'degrees' });
          if (!flat && (pitch <= 0 || pitch > 75)) throw new Error('pitch must be more than 0 and at most 75 degrees; use shape flat for a flat roof');
          const overhang = number(a, 'overhang', { fallback: flat ? 0 : 0.4 });
          if (overhang < 0) throw new Error('overhang must be zero or more (metres)');
          const ridge = given(a.ridge) ? String(a.ridge).toLowerCase() : null;
          if (ridge && ridge !== 'x' && ridge !== 'y') throw new Error('ridge must be x, y or null');
          const typed = typeOf(cs, a, 'roof', name);
          const op = { tool: name, storey: text(a, 'storey'), shape, outline, pitch, overhang, thickness: typed ? typedThickness(a, typed) : number(a, 'thickness', { fallback: 0.25, positive: true }), ridge: shape === 'gable' || shape === 'shed' ? ridge : null, base: number(a, 'base'), name: text(a, 'name') };
          if (typed) op.type = typed.ref;
          return op;
        }
        case 'create_opening': {
          const fill = given(a.fill) ? String(a.fill).toLowerCase() : null;
          if (fill && fill !== 'door' && fill !== 'window') throw new Error('fill must be door, window or null');
          if (!given(a.wall_id)) throw new Error('wall_id is required');
          return { tool: name, wall_id: idOrRef(cs, a.wall_id, 'wall_id'), offset: number(a, 'offset', { fallback: 0 }), width: number(a, 'width', { fallback: 0.9, positive: true }), height: number(a, 'height', { fallback: 2.1, positive: true }), sill: number(a, 'sill', { fallback: 0 }), fill, name: text(a, 'name') };
        }
        case 'create_spaces': {
          const storey = text(a, 'storey');
          let rooms = null;
          if (given(a.rooms)) {
            if (!Array.isArray(a.rooms) || !a.rooms.length) throw new Error('rooms must be a list of {at or index, name, long_name}, or null for every room');
            if (a.rooms.length > MAX_ROOMS) throw new Error(`at most ${MAX_ROOMS} rooms in one step`);
            if (!storey) throw new Error('name the storey the rooms are on; storey null goes with rooms null (every room on every storey)');
            const indexes = new Set();
            rooms = a.rooms.map((r, i) => {
              const which = `room ${i + 1}`;
              if (!r || typeof r !== 'object') throw new Error(`${which} must be {at or index, name, long_name}`);
              if (given(r.at) === given(r.index)) throw new Error(`${which} needs either at, an [x, y] point inside it in metres, or index, its index in get_topology`);
              if (!given(r.name)) throw new Error(`${which} needs a name`);
              if (given(r.index) && (!Number.isInteger(r.index) || r.index < 1)) throw new Error(`${which}: index must be a whole number from 1`);
              if (given(r.index) && indexes.has(r.index)) throw new Error(`${which}: index ${r.index} is listed twice`);
              if (given(r.index)) indexes.add(r.index);
              return { at: given(r.at) ? point(r.at, `${which}: at`) : null, index: given(r.index) ? r.index : null, name: String(r.name).slice(0, 200), long_name: text(r, 'long_name') };
            });
          }
          // Without a list the wheel names the rooms itself: the person's word for a room with {n} for its index.
          return { tool: name, storey, rooms, height: number(a, 'height', { positive: true }), default_name: rooms ? null : t('ai.change.spaces.name') };
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
          const op = { tool: name, ids: idList(cs, a.ids), system, code: text(a, 'code'), name: className, uri: text(a, 'uri') };
          for (const key of ['edition', 'source', 'dictionary_uri']) { const v = text(a, key); if (v) op[key] = v; }  // the system's facts, when given
          return op;
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
          if (last) cs.refs -= last.refs ? last.refs.length : last.ref ? 1 : 0;
          return { ok: true, removed: last ? describe(last) : null, steps: cs.ops.length };
        }
        if (action !== 'list') return err('action must be list, remove_last or clear');
        return { steps: cs.ops.map((op, i) => ({ step: i + 1, tool: op.tool, ref: op.ref || (op.refs && op.refs.length ? op.refs.join(', ') : null), description: describe(op) })) };
      }
      if (!has(name)) return err(`unknown tool ${name}`);
      if (cs.ops.length >= MAX_OPS) return err(`the change set holds ${MAX_OPS} steps already; ask the person to approve it first`);
      let op;
      try { op = build(cs, name, args); } catch (e) { return err(String((e && e.message) || e)); }
      // create_spaces gets a ref per listed room, in their order, as the wheel numbers them; the other creates one each.
      if (name === 'create_spaces') op.refs = (op.rooms || []).map(() => `new-${++cs.refs}`);
      else if (CREATES.includes(name)) { cs.refs++; op.ref = `new-${cs.refs}`; }
      cs.ops.push(op);
      const out = { ok: true, step: cs.ops.length, description: describe(op) };
      if (op.ref) out.ref = op.ref;
      if (op.refs && op.refs.length) out.refs = op.refs;
      if (op.tool === 'create_roof' && op.outline && !rectangular(op.outline)) {
        const b = bounds(op.outline);
        out.note = `the outline is not a rectangle along x and y (${op.outline.length} corners), so for now the roof covers its bounding box: ${fmt(b[2] - b[0])} × ${fmt(b[3] - b[1])} m from (${fmt(b[0])}, ${fmt(b[1])})`;
      }
      return out;
    }
    const fmt = (v) => (typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v === null || v === undefined ? '' : v));
    const idsText = (list) => (list || []).map(fmt).join(', ');
    /** The thickness of a step, a dash when the wheel takes it from a type of the model. */
    const thick = (op) => (op.thickness === null || op.thickness === undefined ? '–' : fmt(op.thickness));
    /** ", type new-1" after a typed wall, slab or roof. */
    const typedText = (op) => (op.type !== undefined && op.type !== null ? t('ai.change.typed', { type: fmt(op.type) }) : '');
    /** One line about an operation, for the panel's list and the log. @param {any} op */
    function describe(op) {
      switch (op.tool) {
        case 'create_storeys_and_grid': return t('ai.change.create_storeys_and_grid', { storeys: (op.storeys || []).map((s) => `${s.name} (${fmt(s.elevation)} m)`).join(', ') || '–', grid: op.grid ? t('ai.change.grid', { x: fmt(op.grid.x_spacing), y: fmt(op.grid.y_spacing), nx: fmt(op.grid.x_count), ny: fmt(op.grid.y_count) }) : '' });
        case 'define_type': return t('ai.change.define_type', { ref: op.ref || '', kind: t('ai.change.type.' + op.kind), name: op.name, predefined: op.predefined_type ? ' ' + op.predefined_type : '',
          layers: (op.layers || []).map((l) => `${l.material} ${fmt(l.thickness)} m`).join(', '), thickness: fmt(layersThickness(op.layers || [])) });
        case 'create_wall': return t('ai.change.create_wall', { ref: op.ref || '', name: op.name || '', storey: op.storey || t('ai.change.storey.lowest'), x1: fmt(op.start[0]), y1: fmt(op.start[1]), x2: fmt(op.end[0]), y2: fmt(op.end[1]), thickness: thick(op), height: fmt(op.height) }) + typedText(op) + (op.partition ? t('ai.change.wall.partition') : '');
        case 'create_slab': return t('ai.change.create_slab', { ref: op.ref || '', name: op.name || '', storey: op.storey || t('ai.change.storey.lowest'), thickness: thick(op), outline: op.outline ? t('ai.change.outline.points', { n: String(op.outline.length) }) : t('ai.change.outline.grid') }) + typedText(op);
        case 'create_roof': {
          const b = op.outline ? bounds(op.outline) : null;
          return t('ai.change.create_roof', { ref: op.ref || '', name: op.name ? ' ' + op.name : '', storey: op.storey || t('ai.change.storey.top'), shape: t('ai.change.roof.' + op.shape), pitch: op.shape === 'flat' ? '' : ` ${fmt(op.pitch)}°`,
            extent: b ? t('ai.change.roof.size', { x: fmt(b[2] - b[0]), y: fmt(b[3] - b[1]) }) : t('ai.change.roof.walls'), overhang: op.overhang ? t('ai.change.roof.overhang', { overhang: fmt(op.overhang) }) : '' }) + typedText(op);
        }
        case 'create_opening': return t('ai.change.create_opening', { ref: op.ref || '', fill: t('ai.change.fill.' + (op.fill || 'none')), name: op.name || '', wall: fmt(op.wall_id), width: fmt(op.width), height: fmt(op.height), offset: fmt(op.offset) });
        case 'create_spaces': {
          const rooms = op.rooms ? op.rooms.map((r) => (r.at ? t('ai.change.spaces.at', { name: r.name, x: fmt(r.at[0]), y: fmt(r.at[1]) }) : t('ai.change.spaces.index', { name: r.name, index: fmt(r.index) }))).join(', ')
            : t('ai.change.spaces.all', { names: [1, 2].map((n) => t('ai.change.spaces.name', { n })).join(', ') });
          const refs = op.refs || [];
          return t('ai.change.create_spaces', { ref: refs.length > 1 ? `${refs[0]}–${refs[refs.length - 1]}` : refs[0] || '', storey: op.storey || t('ai.change.spaces.every'), rooms, height: op.height ? t('ai.change.spaces.height', { height: fmt(op.height) }) : '' });
        }
        case 'set_properties': return t('ai.change.set_properties', { pset: op.pset, ids: idsText(op.ids), props: Object.entries(op.properties || {}).map(([k, v]) => `${k} = ${fmt(v)}`).join(', ') });
        case 'set_classification': return t('ai.change.set_classification', { ids: idsText(op.ids), system: [op.system, op.edition].filter(Boolean).join(' '), cls: [op.code, op.name].filter(Boolean).join(' ') });
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
    /**
     * The operations with every element named by its GlobalId where one is known, the STEP id where none is, and the refs as they
     * are: a server applies a proposal to its own copy of the file, whose STEP ids need not be the app's (decision F34 a at Dataregium).
     * @param {any[]} ops toWheel's list @param {(id: number) => (string|null)} guidOf
     */
    function withGuids(ops, guidOf) {
      const swap = (x) => (Number.isInteger(x) ? (guidOf(x) || x) : x);
      return ops.map((op) => {
        const o = Object.assign({}, op);
        if (Array.isArray(o.ids)) o.ids = o.ids.map(swap);
        if (o.wall_id !== undefined && o.wall_id !== null) o.wall_id = swap(o.wall_id);
        if (o.type !== undefined && o.type !== null) o.type = swap(o.type);
        return o;
      });
    }
    const toWheel = (cs) => cs.ops.map((op) => { const o = Object.assign({}, op); delete o.ref; delete o.refs; return o; });

    return { withGuids, TOOLS, CREATES, MAX_OPS, MATERIAL_CATEGORIES, LAYER_ROLES, has, create, call, describe, summary, toWheel };
  });
})();
