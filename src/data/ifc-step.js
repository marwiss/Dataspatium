// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The app's own reader for IFC files (ISO 10303-21, "STEP"), in a worker: one fast pass over the bytes records where
 * every entity is, then only the entities that matter are parsed. It gives the file's facts (schema, project, units,
 * counts per entity type) and the tables of a model dataset: the elements with storey, type, material and
 * classification, their properties and quantities (inherited from the type too) and the non-geometric entities with
 * their raw attributes. Quantities are converted to SI units with the project's unit assignment. Geometry is not
 * touched here: it goes through engines/ifc. Standalone worker function: no references outside itself.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  function dataspatiumIfcStepWorker() {
    'use strict';
    var WORDS = ['Standard', 'Case', 'Building', 'Element', 'Proxy', 'Storey', 'Curtain', 'Wall', 'Slab', 'Beam', 'Column', 'Door', 'Window', 'Roof', 'Stair', 'Flight', 'Ramp', 'Railing', 'Covering', 'Member', 'Plate', 'Footing', 'Pile', 'Space', 'Site', 'Spatial', 'Zone', 'Flow', 'Terminal', 'Segment', 'Fitting', 'Controller', 'Moving', 'Storage', 'Treatment', 'Energy', 'Conversion', 'Device', 'Distribution', 'Chamber', 'Port', 'Furnishing', 'Furniture', 'System', 'Opening', 'Virtual', 'Annotation', 'Grid', 'Transport', 'Geographic', 'Civil', 'Discrete', 'Accessory', 'Fastener', 'Mechanical', 'Reinforcing', 'Bar', 'Mesh', 'Tendon', 'Anchor', 'Sensor', 'Actuator', 'Alarm', 'Air', 'Terminal', 'Box', 'Duct', 'Silencer', 'Pipe', 'Cable', 'Carrier', 'Junction', 'Fan', 'Pump', 'Valve', 'Tank', 'Boiler', 'Chiller', 'Coil', 'Compressor', 'Condenser', 'Cooling', 'Tower', 'Damper', 'Filter', 'Fire', 'Suppression', 'Heat', 'Exchanger', 'Humidifier', 'Lamp', 'Light', 'Fixture', 'Motor', 'Connection', 'Outlet', 'Sanitary', 'Stack', 'Switching', 'Transformer', 'Tube', 'Bundle', 'Unitary', 'Equipment', 'Evaporative', 'Cooler', 'Evaporator', 'Electric', 'Appliance', 'Distribution', 'Board', 'Flow', 'Instrument', 'Interceptor', 'Medical', 'Audio', 'Visual', 'Communications', 'Protective', 'Unit', 'Solar', 'Waste', 'Burner', 'Cogeneration', 'Bridge', 'Part', 'Facility', 'Road', 'Railway', 'Rail', 'Marine', 'Alignment', 'Earthworks', 'Cut', 'Fill', 'Kerb', 'Pavement', 'Course', 'Mooring', 'Navigational', 'Sign', 'Signal', 'Vibration', 'Isolator', 'Damper', 'Impact', 'Protection', 'Deep', 'Foundation', 'Structural', 'Surface', 'Curve', 'Action', 'Reaction', 'Load', 'Linear', 'Planar', 'Point', 'Assembly', 'Geotechnical', 'Stratum', 'Tank', 'Project', 'Library', 'Type', 'Style', 'Shading', 'Chimney', 'Building', 'Systems', 'Cartesian', 'Direction', 'Axis', 'Placement', 'Local', 'Shape', 'Representation', 'Product', 'Definition', 'Property', 'Set', 'Single', 'Value', 'Enumerated', 'Bounded', 'List', 'Complex', 'Quantity', 'Length', 'Area', 'Volume', 'Count', 'Weight', 'Time', 'Material', 'Layer', 'Usage', 'Constituent', 'Profile', 'Classification', 'Reference', 'Unit', 'Assignment', 'Conversion', 'Based', 'Measure', 'With', 'Poly', 'Loop', 'Line', 'Closed', 'Connected', 'Open', 'Face', 'Bound', 'Outer', 'Polygonal', 'Half', 'Boolean', 'Clipping', 'Result', 'Extruded', 'Swept', 'Revolved', 'Solid', 'Mapped', 'Geometric', 'Context', 'Sub', 'Person', 'Organization', 'And', 'Application', 'Owner', 'History', 'Styled', 'Item', 'Presentation', 'Assignment', 'Colour', 'Rgb', 'Rendering', 'Rectangle', 'Circle', 'Arbitrary', 'Rel', 'Aggregates', 'Contained', 'In', 'Structure', 'Defines', 'By', 'Associates', 'Properties', 'Voids', 'Fills', 'Nests', 'Connects', 'Elements', 'Space', 'Boundary', 'Assigns', 'To', 'Group', 'Actor', 'Role', 'Address', 'Telecom', 'Postal', 'Trimmed', 'Composite', 'Segment', 'Vertex', 'Edge', 'Oriented', 'Tessellated', 'Triangulated', 'Indexed', 'Spline', 'With', 'Knots', 'Rational', 'Advanced', 'Brep', 'Faceted', 'Manifold', 'Shell', 'Based', 'Model', 'Transformation', 'Operator', 'Three', 'Two', 'Dimensional', 'Derived', 'Exponent', 'Si', 'Text', 'Literal', 'Annotation', 'Fill', 'Hatching', 'Tank', 'Calendar', 'Date', 'Local', 'Coordinated', 'Offset', 'Of', 'Plane', 'Vector', 'Ellipse', 'Curve', 'Master', 'Cross', 'Section', 'Shape', 'Hollow', 'Round', 'Beam', 'Lining', 'Panel', 'Permeable', 'Reinforcement', 'Definition'];
    var ROOT_NOT_PRODUCT = /^(IFCREL|IFCPROPERTY|IFCELEMENTQUANTITY|IFCPROJECT|IFCCONTEXT|IFCTYPEOBJECT)|(TYPE|STYLE|TEMPLATE|PROPERTIES)$/;
    var NOT_ELEMENT = { IFCOPENINGELEMENT: 1, IFCOPENINGSTANDARDCASE: 1, IFCDISTRIBUTIONPORT: 1, IFCVIRTUALELEMENT: 1, IFCGRID: 1, IFCANNOTATION: 1, IFCALIGNMENT: 1, IFCALIGNMENTHORIZONTAL: 1, IFCALIGNMENTVERTICAL: 1, IFCALIGNMENTSEGMENT: 1, IFCALIGNMENTCANT: 1, IFCREFERENT: 1, IFCSTRUCTURALANALYSISMODEL: 1 };
    var STRUCTURE = /^IFC(SITE|BUILDING|BUILDINGSTOREY|FACILITY|FACILITYPART|FACILITYPARTCOMMON|BRIDGE|BRIDGEPART|ROAD|ROADPART|RAILWAY|RAILWAYPART|MARINEFACILITY|MARINEPART|SPATIALZONE)$/;
    var ROOMS = /^IFC(SPACE|EXTERNALSPATIALELEMENT)$/;
    var KEPT = /^IFC(PROPERTY|QUANTITY|PHYSICALCOMPLEXQUANTITY|COMPLEXPROPERTY|MATERIAL|CLASSIFICATION|SIUNIT|CONVERSIONBASEDUNIT|UNITASSIGNMENT|MEASUREWITHUNIT)/;

    function prettyType(name) {
      var rest = name.replace(/^IFC/, '');
      var out = 'Ifc';
      while (rest) {
        var best = '';
        for (var i = 0; i < WORDS.length; i++) {
          var w = WORDS[i];
          if (w.length > best.length && rest.indexOf(w.toUpperCase()) === 0) best = w;
        }
        if (!best) { out += rest.charAt(0) + rest.slice(1).toLowerCase(); break; }
        out += best;
        rest = rest.slice(best.length);
      }
      return out;
    }

    /** One pass over the file: where every entity is. */
    function scan(b, report) {
      var n = b.length;
      var text = new TextDecoder('latin1').decode(b.subarray(0, Math.min(n, 65536)));
      if (!/ISO-10303-21/.test(text.slice(0, 2048))) throw new Error('notifc');
      var dataAt = text.search(/DATA\s*(\([^)]*\))?\s*;/);
      if (dataAt < 0) throw new Error('notifc');
      var header = text.slice(0, dataAt);
      var cap = 200000;
      var ids = new Int32Array(cap); var types = new Int32Array(cap); var starts = new Uint32Array(cap); var ends = new Uint32Array(cap);
      var count = 0; var maxId = 0;
      var typeNames = []; var typeCounts = []; var byHash = new Map();
      var i = dataAt + 4; var nextReport = 5000000;
      while (i < n) {
        var c = b[i];
        if (c === 35) {
          var id = 0; i++;
          while ((c = b[i]) >= 48 && c <= 57) { id = id * 10 + c - 48; i++; }
          while (i < n && b[i] !== 61) i++;
          i++;
          while (i < n && b[i] <= 32) i++;
          var ts = i; var h = 7;
          while (i < n && (c = b[i]) !== 40 && c > 32) { h = (h * 131 + c) % 1099511627689; i++; }
          var te = i;
          while (i < n && b[i] !== 40) i++;
          var as = i; var inStr = false;
          while (i < n) { c = b[i]; if (c === 39) inStr = !inStr; else if (c === 59 && !inStr) break; i++; }
          if (count === cap) {
            cap = Math.floor(cap * 1.7);
            var a1 = new Int32Array(cap); a1.set(ids); ids = a1;
            var a2 = new Int32Array(cap); a2.set(types); types = a2;
            var a3 = new Uint32Array(cap); a3.set(starts); starts = a3;
            var a4 = new Uint32Array(cap); a4.set(ends); ends = a4;
          }
          var t = byHash.get(h);
          if (t === undefined) { t = typeNames.length; byHash.set(h, t); typeNames.push(String.fromCharCode.apply(null, b.subarray(ts, te)).toUpperCase()); typeCounts.push(0); }
          typeCounts[t]++;
          ids[count] = id; types[count] = t; starts[count] = as; ends[count] = i; count++;
          if (id > maxId) maxId = id;
          i++;
          if (i > nextReport) { nextReport += 5000000; report(i / n * 0.5); }
        } else if (c === 69 && b[i + 1] === 78 && b[i + 2] === 68 && b[i + 3] === 83 && b[i + 4] === 69 && b[i + 5] === 67) {
          break;
        } else if (c === 47 && b[i + 1] === 42) {
          i += 2;
          while (i < n && !(b[i] === 42 && b[i + 1] === 47)) i++;
          i += 2;
        } else i++;
      }
      var indexOf = new Int32Array(maxId + 1).fill(-1);
      for (var k = 0; k < count; k++) indexOf[ids[k]] = k;
      return { b: b, header: header, ids: ids, types: types, starts: starts, ends: ends, count: count, typeNames: typeNames, typeCounts: typeCounts, indexOf: indexOf };
    }

    function decodeString(b, from, to) {
      var ascii = true; var plain = true;
      for (var i = from; i < to; i++) { var c = b[i]; if (c >= 128) { ascii = false; break; } if (c === 92 || c === 39) plain = false; }
      var s;
      if (ascii) s = to - from < 8192 ? String.fromCharCode.apply(null, b.subarray(from, to)) : new TextDecoder('latin1').decode(b.subarray(from, to));
      else {
        plain = false;
        try { s = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(from, to)); } catch (_e) { s = new TextDecoder('latin1').decode(b.subarray(from, to)); }
      }
      if (plain) return s;
      s = s.replace(/''/g, "'");
      if (s.indexOf('\\') < 0) return s;
      s = s.replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, function (_m, hex) { var o = ''; for (var i = 0; i + 4 <= hex.length; i += 4) o += String.fromCharCode(parseInt(hex.substr(i, 4), 16)); return o; });
      s = s.replace(/\\X4\\([0-9A-Fa-f]+)\\X0\\/g, function (_m, hex) { var o = ''; for (var i = 0; i + 8 <= hex.length; i += 8) o += String.fromCodePoint(parseInt(hex.substr(i, 8), 16)); return o; });
      s = s.replace(/\\X\\([0-9A-Fa-f]{2})/g, function (_m, hex) { return String.fromCharCode(parseInt(hex, 16)); });
      s = s.replace(/\\P[A-I]\\/g, '');
      s = s.replace(/\\S\\(.)/g, function (_m, ch) { return String.fromCharCode(ch.charCodeAt(0) + 128); });
      return s.replace(/\\\\/g, '\\');
    }

    /** The attributes of one entity: strings, numbers, null, {r: id}, {e: 'ENUM'}, {t: 'IFCLABEL', v: value} and arrays. */
    function argsOf(f, k) {
      var b = f.b; var pos = f.starts[k]; var end = f.ends[k];
      function ws() { while (pos < end && b[pos] <= 32) pos++; }
      function list() {
        pos++;
        var out = [];
        ws();
        if (b[pos] === 41) { pos++; return out; }
        while (pos < end) {
          out.push(value());
          ws();
          if (b[pos] === 44) { pos++; continue; }
          if (b[pos] === 41) { pos++; break; }
          break;
        }
        return out;
      }
      function value() {
        ws();
        var c = b[pos];
        if (c === 35) { pos++; var id = 0; while ((c = b[pos]) >= 48 && c <= 57) { id = id * 10 + c - 48; pos++; } return { r: id }; }
        if (c === 39) {
          var from = ++pos;
          while (pos < end) { if (b[pos] === 39) { if (b[pos + 1] === 39) { pos += 2; continue; } break; } pos++; }
          var s = decodeString(b, from, pos);
          pos++;
          return s;
        }
        if (c === 36 || c === 42) { pos++; return null; }
        if (c === 46) { var e0 = ++pos; while (pos < end && b[pos] !== 46) pos++; var en = String.fromCharCode.apply(null, b.subarray(e0, pos)); pos++; return { e: en }; }
        if (c === 40) return list();
        if ((c >= 48 && c <= 57) || c === 45 || c === 43) {
          var n0 = pos; pos++;
          while (pos < end && ((c = b[pos]) >= 48 && c <= 57 || c === 46 || c === 69 || c === 101 || c === 45 || c === 43)) pos++;
          return parseFloat(String.fromCharCode.apply(null, b.subarray(n0, pos)));
        }
        if (c === 34) { var h0 = ++pos; while (pos < end && b[pos] !== 34) pos++; var hx = String.fromCharCode.apply(null, b.subarray(h0, pos)); pos++; return hx; }
        var t0 = pos;
        while (pos < end && (c = b[pos]) !== 40 && c !== 44 && c !== 41 && c > 32) pos++;
        var name = String.fromCharCode.apply(null, b.subarray(t0, pos)).toUpperCase();
        ws();
        if (b[pos] === 40) { var inner = list(); return { t: name, v: inner.length === 1 ? inner[0] : inner }; }
        return name ? { t: name, v: null } : null;
      }
      return list();
    }

    function headerFacts(f) {
      var h = f.header;
      var schema = (/FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/.exec(h) || [])[1] || '';
      var fileName = /FILE_NAME\s*\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*\(([^)]*)\)\s*,\s*\(([^)]*)\)\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/.exec(h);
      return { schema: schema, timestamp: fileName ? fileName[2] : '', preprocessor: fileName ? fileName[5] : '', application: fileName ? fileName[6] : '' };
    }

    /** Conversion factors to SI and display names of the project's units. */
    function projectUnits(f, rootedOf) {
      var factors = { LENGTHUNIT: 1, AREAUNIT: 1, VOLUMEUNIT: 1, MASSUNIT: 1, TIMEUNIT: 1 };
      var names = { LENGTHUNIT: 'm', AREAUNIT: 'm²', VOLUMEUNIT: 'm³', MASSUNIT: 'kg', TIMEUNIT: 's' };
      var project = rootedOf('IFCPROJECT')[0];
      if (project === undefined) return { factors: factors, names: names };
      var a = argsOf(f, project);
      var assign = a[8] && a[8].r ? a[8].r : null;
      if (!assign) return { factors: factors, names: names };
      var units = argsOf(f, f.indexOf[assign])[0] || [];
      for (var i = 0; i < units.length; i++) {
        if (!units[i] || !units[i].r) continue;
        var info = unitInfo(f, units[i].r);
        if (info && info.kind && Object.prototype.hasOwnProperty.call(factors, info.kind)) { factors[info.kind] = info.factor; names[info.kind] = info.label; }
      }
      return { factors: factors, names: names };
    }
    var PREFIX = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 1e1, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9, PICO: 1e-12, FEMTO: 1e-15, ATTO: 1e-18 };
    var PREFIX_SHORT = { KILO: 'k', HECTO: 'h', DECA: 'da', DECI: 'd', CENTI: 'c', MILLI: 'm', MICRO: 'µ' };
    var SI_NAME = { METRE: 'm', SQUARE_METRE: 'm²', CUBIC_METRE: 'm³', GRAM: 'g', SECOND: 's', WATT: 'W', VOLT: 'V', AMPERE: 'A', KELVIN: 'K', DEGREE_CELSIUS: '°C', JOULE: 'J', NEWTON: 'N', PASCAL: 'Pa', HERTZ: 'Hz', LUMEN: 'lm', LUX: 'lx', RADIAN: 'rad', OHM: 'Ω' };
    function unitInfo(f, id) {
      var k = f.indexOf[id];
      if (k === undefined || k < 0) return null;
      var type = f.typeNames[f.types[k]];
      var a = argsOf(f, k);
      if (type === 'IFCSIUNIT') {
        var kind = a[1] && a[1].e; var prefix = a[2] && a[2].e; var name = a[3] && a[3].e;
        var p = prefix ? (PREFIX[prefix] || 1) : 1;
        var factor = name === 'SQUARE_METRE' ? p * p : (name === 'CUBIC_METRE' ? p * p * p : p);
        if (name === 'GRAM') factor = p / 1000;
        var shortP = prefix ? (PREFIX_SHORT[prefix] || '') : '';
        return { kind: kind, factor: factor, label: shortP + (SI_NAME[name] || String(name || '').toLowerCase()) };
      }
      if (type === 'IFCCONVERSIONBASEDUNIT') {
        var base = a[3] && a[3].r ? argsOf(f, f.indexOf[a[3].r]) : null;
        var value = base && base[0] ? (base[0].v !== undefined ? base[0].v : base[0]) : 1;
        var inner = base && base[1] && base[1].r ? unitInfo(f, base[1].r) : null;
        return { kind: a[1] && a[1].e, factor: Number(value) * (inner ? inner.factor : 1), label: String(a[2] || '').toLowerCase() };
      }
      return null;
    }

    function plain(v) {
      if (v === null || v === undefined) return null;
      if (typeof v === 'object') {
        if (v.e !== undefined) return v.e === 'T' ? true : (v.e === 'F' ? false : (v.e === 'U' ? null : v.e));
        if (v.t !== undefined) return plain(v.v);
        if (Array.isArray(v)) return v.map(plain);
        if (v.r !== undefined) return null;
      }
      return v;
    }

    /**
     * The height of an object placement above the world's origin, in file units, along its IfcLocalPlacement chain (the parents'
     * rotations left aside, as for a storey); null without a placement or for one the reader cannot follow.
     */
    function placementZ(f, ref) {
      if (!ref || ref.r === undefined) return null;
      var z = 0;
      for (var depth = 0; ref && ref.r !== undefined && depth < 64; depth++) {
        var k = f.indexOf[ref.r];
        if (k === undefined || k < 0 || f.typeNames[f.types[k]] !== 'IFCLOCALPLACEMENT') return null;
        var a = argsOf(f, k);
        var axis = a[1] && a[1].r !== undefined ? f.indexOf[a[1].r] : -1;
        if (axis === undefined || axis < 0) return null;
        var loc = argsOf(f, axis)[0];
        var at = loc && loc.r !== undefined && f.indexOf[loc.r] >= 0 ? argsOf(f, f.indexOf[loc.r])[0] : null;
        z += Array.isArray(at) && typeof at[2] === 'number' ? at[2] : 0;
        ref = a[0];
      }
      return z;
    }

    function summaryOf(f) {
      var rooted = rootedIndex(f);
      var project = rooted.of('IFCPROJECT')[0];
      var site = rooted.of('IFCSITE')[0];
      var building = rooted.of('IFCBUILDING')[0];
      var nameOf = function (k) { if (k === undefined) return ''; var a = argsOf(f, k); return a[2] || ''; };
      var facts = headerFacts(f);
      var counts = f.typeNames.map(function (n, i) { return { name: prettyType(n), count: f.typeCounts[i], raw: n }; }).sort(function (a, b) { return b.count - a.count; });
      var elementTypes = counts.filter(function (t) { return isProductName(t.raw); });
      var units = projectUnits(f, rooted.of);
      var storeys = rooted.of('IFCBUILDINGSTOREY').map(function (k) {
        var a = argsOf(f, k);
        var z = typeof a[9] === 'number' ? a[9] : placementZ(f, a[5]);  // IFC4.3 deprecates Elevation: then the placement says it
        return { id: f.ids[k], name: a[2] || '', elevation: typeof z === 'number' ? Math.round(z * units.factors.LENGTHUNIT * 1e6) / 1e6 : null };
      });
      storeys.sort(function (a, b) { return (a.elevation === null ? 0 : a.elevation) - (b.elevation === null ? 0 : b.elevation); });
      return {
        format: 'ifc', schema: facts.schema, timestamp: facts.timestamp, application: facts.application || facts.preprocessor, project: nameOf(project), site: nameOf(site), building: nameOf(building),
        units: units.names, entities: f.count, types: counts.map(function (t) { return { name: t.name, count: t.count }; }).slice(0, 400),
        elementTypes: elementTypes.map(function (t) { return { name: t.name, count: t.count }; }), storeys: storeys,
      };
    }
    function isProductName(n) { return !ROOT_NOT_PRODUCT.test(n) && !NOT_ELEMENT[n] && ROOTED_NAME.test(n); }
    /** Names that can only be geometry or resources: never products, so the summary's list stays clean. */
    var ROOTED_NAME = /^IFC(?!CARTESIAN|DIRECTION|AXIS|POLY|FACE|CLOSED|CONNECTED|SHAPE|PRODUCTDEFINITION|LOCALPLACEMENT|STYLED|PRESENTATION|SURFACE|COLOUR|CURVE|TRIMMED|CIRCLE|ELLIPSE|LINE|VECTOR|PLANE|EXTRUDED|REVOLVED|BOOLEAN|HALFSPACE|POLYGONAL|MAPPED|REPRESENTATION|CARTESIANTRANSFORMATION|ARBITRARY|RECTANGLE|PERSON|ORGANIZATION|APPLICATION|OWNERHISTORY|GEOMETRIC|UNIT|SIUNIT|DERIVEDUNIT|DIMENSIONAL|MEASURE|CONVERSION|MONETARY|PROPERTY|QUANTITY|MATERIAL|CLASSIFICATION|REL|BSPLINE|COMPOSITE|INDEXED|TESSELLATED|TRIANGULATED|ADVANCED|ORIENTED|EDGE|VERTEX|TEXT|FILL|DRAUGHTING|EXTERNALLY|LIBRARY|DOCUMENT|TELECOM|POSTAL|ACTOR|CALENDAR|LOCALTIME|COORDINATED|TIME|TABLE|APPROVAL|SECTION|ISHAPE|LSHAPE|TSHAPE|USHAPE|CSHAPE|ZSHAPE|DERIVED|CENTERLINE|PIXEL|BLOB|IMAGE|COMPLEX|PHYSICAL|VOIDING|PROJECTED)/;

    function rootedIndex(f) {
      var byType = new Map();
      var b = f.b;
      for (var k = 0; k < f.count; k++) {
        var as = f.starts[k];
        if (b[as + 1] === 39 && b[as + 24] === 39) {
          var t = f.types[k];
          var list = byType.get(t);
          if (!list) { list = []; byType.set(t, list); }
          list.push(k);
        }
      }
      var nameToType = new Map(f.typeNames.map(function (n, i) { return [n, i]; }));
      return {
        byType: byType,
        of: function (name) { var t = nameToType.get(name); return (t !== undefined && byType.get(t)) || []; },
      };
    }

    /** The tables of a model dataset. */
    function tablesOf(f, report) {
      var rooted = rootedIndex(f);
      var units = projectUnits(f, rooted.of);
      var ref = function (v) { return v && v.r !== undefined ? v.r : null; };
      var refs = function (v) { return Array.isArray(v) ? v.map(ref).filter(function (x) { return x !== null; }) : []; };
      var nameOfType = function (k) { return f.typeNames[f.types[k]]; };

      // ---- relations ------------------------------------------------------------------------------------------
      var parent = new Map(); var contained = new Map(); var typeOf = new Map(); var defs = new Map(); var materialOf = new Map(); var classOf = new Map();
      function push(map, key, value) { var l = map.get(key); if (!l) { l = []; map.set(key, l); } l.push(value); }
      rooted.byType.forEach(function (list, t) {
        var name = f.typeNames[t];
        if (name.indexOf('IFCREL') !== 0) return;
        for (var i = 0; i < list.length; i++) {
          var a = argsOf(f, list[i]);
          if (name === 'IFCRELAGGREGATES' || name === 'IFCRELNESTS') { var from = ref(a[4]); refs(a[5]).forEach(function (x) { if (!parent.has(x)) parent.set(x, from); }); }
          else if (name === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') { var st = ref(a[5]); refs(a[4]).forEach(function (x) { contained.set(x, st); }); }
          else if (name === 'IFCRELVOIDSELEMENT') { if (!parent.has(ref(a[5]))) parent.set(ref(a[5]), ref(a[4])); }
          else if (name === 'IFCRELFILLSELEMENT') { if (!parent.has(ref(a[5]))) parent.set(ref(a[5]), ref(a[4])); }
          else if (name === 'IFCRELDEFINESBYTYPE') { var ty = ref(a[5]); refs(a[4]).forEach(function (x) { typeOf.set(x, ty); }); }
          else if (name === 'IFCRELDEFINESBYPROPERTIES') { var d = ref(a[5]); refs(a[4]).forEach(function (x) { push(defs, x, d); }); }
          else if (name === 'IFCRELASSOCIATESMATERIAL') { var m = ref(a[5]); refs(a[4]).forEach(function (x) { push(materialOf, x, m); }); }
          else if (name === 'IFCRELASSOCIATESCLASSIFICATION') { var c = ref(a[5]); refs(a[4]).forEach(function (x) { push(classOf, x, c); }); }
        }
      });

      // ---- materials, classifications -------------------------------------------------------------------------
      var materialCache = new Map();
      function materialNames(id, depth) {
        if (materialCache.has(id)) return materialCache.get(id);
        var out = [];
        var k = f.indexOf[id];
        if (k !== undefined && k >= 0 && (depth || 0) < 6) {
          var n = nameOfType(k); var a = argsOf(f, k);
          var each = function (list) { refs(list).forEach(function (x) { materialNames(x, (depth || 0) + 1).forEach(function (m) { if (out.indexOf(m) < 0) out.push(m); }); }); };
          if (n === 'IFCMATERIAL') { if (a[0]) out.push(String(a[0])); }
          else if (n === 'IFCMATERIALLIST') each(a[0]);
          else if (n === 'IFCMATERIALLAYERSET') each(a[0]);
          else if (n === 'IFCMATERIALLAYER' || n === 'IFCMATERIALLAYERWITHOFFSETS') each([a[0]]);
          else if (n === 'IFCMATERIALLAYERSETUSAGE' || n === 'IFCMATERIALPROFILESETUSAGE' || n === 'IFCMATERIALPROFILESETUSAGETAPERING') each([a[0]]);
          else if (n === 'IFCMATERIALCONSTITUENTSET') each(a[2]);
          else if (n === 'IFCMATERIALCONSTITUENT') each([a[2]]);
          else if (n === 'IFCMATERIALPROFILESET') each(a[2]);
          else if (n === 'IFCMATERIALPROFILE' || n === 'IFCMATERIALPROFILEWITHOFFSETS') each([a[2]]);
        }
        materialCache.set(id, out);
        return out;
      }
      function classificationText(id) {
        var k = f.indexOf[id];
        if (k === undefined || k < 0) return '';
        var a = argsOf(f, k); var n = nameOfType(k);
        if (n === 'IFCCLASSIFICATIONREFERENCE') { var code = a[1] || ''; var label = a[2] || ''; return code && label ? code + ' ' + label : String(code || label); }
        if (n === 'IFCCLASSIFICATION') return String(a[3] || '');
        return '';
      }

      // ---- property sets and quantities -----------------------------------------------------------------------
      var LENGTHISH = /^IFC(POSITIVE|NONNEGATIVE)?LENGTHMEASURE$/;
      function unitLabelOf(valueType, unitRef) {
        if (unitRef) { var info = unitInfo(f, unitRef); if (info) return info.label; }
        if (!valueType) return null;
        if (LENGTHISH.test(valueType)) return units.names.LENGTHUNIT;
        if (valueType === 'IFCAREAMEASURE') return units.names.AREAUNIT;
        if (valueType === 'IFCVOLUMEMEASURE') return units.names.VOLUMEUNIT;
        if (valueType === 'IFCMASSMEASURE') return units.names.MASSUNIT;
        return null;
      }
      function propertiesOf(k, prefix, out) {
        var n = nameOfType(k); var a = argsOf(f, k);
        var name = prefix + (a[0] || '');
        var add = function (value, valueType, unitRef) {
          var v = plain(value);
          if (v === null || v === undefined || v === '') { out.push([name, null, null, unitLabelOf(valueType, unitRef)]); return; }
          var text = Array.isArray(v) ? v.join(', ') : String(v);
          out.push([name, text, typeof v === 'number' ? v : null, unitLabelOf(valueType, unitRef)]);
        };
        if (n === 'IFCPROPERTYSINGLEVALUE') add(a[2], a[2] && a[2].t, ref(a[3]));
        else if (n === 'IFCPROPERTYENUMERATEDVALUE') add(a[2], null, null);
        else if (n === 'IFCPROPERTYLISTVALUE') add(a[2], null, ref(a[3]));
        else if (n === 'IFCPROPERTYBOUNDEDVALUE') { add(a[2] !== null && a[2] !== undefined ? a[2] : a[3], (a[2] && a[2].t) || (a[3] && a[3].t), ref(a[4])); }
        else if (n === 'IFCCOMPLEXPROPERTY') refs(a[3]).forEach(function (x) { var j = f.indexOf[x]; if (j >= 0) propertiesOf(j, name + ' / ', out); });
      }
      var SLAG = { IFCQUANTITYLENGTH: ['LENGTHUNIT', 'langd'], IFCQUANTITYAREA: ['AREAUNIT', 'area'], IFCQUANTITYVOLUME: ['VOLUMEUNIT', 'volym'], IFCQUANTITYWEIGHT: ['MASSUNIT', 'vikt'], IFCQUANTITYTIME: ['TIMEUNIT', 'tid'], IFCQUANTITYCOUNT: [null, 'antal'], IFCQUANTITYNUMBER: [null, 'antal'] };
      var SI_LABEL = { langd: 'm', area: 'm²', volym: 'm³', vikt: 'kg', tid: 's', antal: null };
      function quantitiesOf(k, prefix, out) {
        var n = nameOfType(k); var a = argsOf(f, k);
        if (n === 'IFCPHYSICALCOMPLEXQUANTITY') { refs(a[2]).forEach(function (x) { var j = f.indexOf[x]; if (j >= 0) quantitiesOf(j, prefix + (a[0] || '') + ' / ', out); }); return; }
        var sl = SLAG[n];
        if (!sl) return;
        var value = plain(a[3]);
        if (typeof value !== 'number') return;
        var info = a[2] && a[2].r ? unitInfo(f, a[2].r) : null;
        var factor = info ? info.factor : (sl[0] ? units.factors[sl[0]] : 1);
        out.push([prefix + (a[0] || ''), value * factor, sl[1], SI_LABEL[sl[1]]]);
      }
      var setCache = new Map();
      function setOf(id) {
        if (setCache.has(id)) return setCache.get(id);
        var res = null;
        var k = f.indexOf[id];
        if (k !== undefined && k >= 0) {
          var n = nameOfType(k);
          var a = argsOf(f, k);
          if (n === 'IFCPROPERTYSET') { var props = []; refs(a[4]).forEach(function (x) { var j = f.indexOf[x]; if (j >= 0) propertiesOf(j, '', props); }); res = { kind: 'p', name: a[2] || '', rows: props }; }
          else if (n === 'IFCELEMENTQUANTITY') { var q = []; refs(a[5]).forEach(function (x) { var j = f.indexOf[x]; if (j >= 0) quantitiesOf(j, '', q); }); res = { kind: 'q', name: a[2] || '', rows: q }; }
        }
        setCache.set(id, res);
        return res;
      }

      // ---- elements -------------------------------------------------------------------------------------------
      function storeyOf(id) {
        var cur = id; var guard = 0;
        while (cur !== null && cur !== undefined && guard++ < 64) {
          var k = f.indexOf[cur];
          if (k !== undefined && k >= 0 && cur !== id) { var n = nameOfType(k); if (n === 'IFCBUILDINGSTOREY' || /PART(COMMON)?$/.test(n)) return argsOf(f, k)[2] || ''; }
          cur = contained.has(cur) ? contained.get(cur) : parent.get(cur);
        }
        return null;
      }
      var elements = []; var properties = []; var quantities = []; var storeyCounts = new Map(); var typeCounts = new Map();
      var done = 0;
      rooted.byType.forEach(function (list, t) {
        var name = f.typeNames[t];
        if (ROOT_NOT_PRODUCT.test(name) || NOT_ELEMENT[name]) return;
        for (var i = 0; i < list.length; i++) {
          var k = list[i];
          var a = argsOf(f, k);
          var hasPlace = a[5] && a[5].r !== undefined; var hasShape = a[6] && a[6].r !== undefined;
          if (!((a[5] === null || hasPlace) && (a[6] === null || hasShape) && (hasPlace || hasShape))) continue;
          var id = f.ids[k];
          var typeId = typeOf.has(id) ? typeOf.get(id) : null;
          var typeArgs = null;
          if (typeId !== null) { var tk = f.indexOf[typeId]; if (tk !== undefined && tk >= 0) typeArgs = argsOf(f, tk); }
          var storey = storeyOf(id);
          var mats = []; (materialOf.get(id) || (typeId !== null && materialOf.get(typeId)) || []).forEach(function (m) { materialNames(m).forEach(function (x) { if (mats.indexOf(x) < 0) mats.push(x); }); });
          var classes = (classOf.get(id) || (typeId !== null && classOf.get(typeId)) || []).map(classificationText).filter(Boolean);
          var pset = {}; var qset = {}; var hasP = false; var hasQ = false;
          var addSet = function (s, source) {
            if (!s) return;
            if (s.kind === 'p') {
              var into = pset[s.name] = pset[s.name] || {};
              for (var r = 0; r < s.rows.length; r++) { var row = s.rows[r]; if (source === 'typ' && into[row[0]] !== undefined) continue; into[row[0]] = row[2] !== null ? row[2] : row[1]; properties.push([id, s.name, row[0], row[1], row[2], row[3], source]); hasP = true; }
            } else {
              var q = qset[s.name] = qset[s.name] || {};
              for (var r2 = 0; r2 < s.rows.length; r2++) { var qr = s.rows[r2]; q[qr[0]] = qr[1]; quantities.push([id, s.name, qr[0], qr[1], qr[2], qr[3]]); hasQ = true; }
            }
          };
          (defs.get(id) || []).forEach(function (d) { addSet(setOf(d), 'objekt'); });
          if (typeId !== null && typeArgs) refs(typeArgs[5]).forEach(function (d) { addSet(setOf(d), 'typ'); });
          if (typeId !== null) (defs.get(typeId) || []).forEach(function (d) { addSet(setOf(d), 'typ'); });
          var pretty = prettyType(name);
          var category = STRUCTURE.test(name) ? 'struktur' : (ROOMS.test(name) ? 'rum' : 'byggdel');
          elements.push([id, a[0], pretty, category, a[2] || null, a[3] || null, typeof a[4] === 'string' ? a[4] : null, typeof a[7] === 'string' ? a[7] : null, storey, typeArgs ? (typeArgs[2] || null) : null, mats.length ? mats.join(', ') : null, classes.length ? classes.join(', ') : null, hasP ? JSON.stringify(pset) : null, hasQ ? JSON.stringify(qset) : null]);
          if (category === 'byggdel') { typeCounts.set(pretty, (typeCounts.get(pretty) || 0) + 1); if (storey !== null) storeyCounts.set(storey, (storeyCounts.get(storey) || 0) + 1); }
          if (++done % 5000 === 0) report(0.5 + 0.4 * Math.min(1, done / Math.max(1, f.count / 10)));
        }
      });
      elements.sort(function (x, y) { return x[0] - y[0]; });

      // ---- the non-geometric entities -------------------------------------------------------------------------
      var entities = []; var latin = new TextDecoder('latin1');
      for (var e = 0; e < f.count; e++) {
        var tn = f.typeNames[f.types[e]];
        var isRooted = f.b[f.starts[e] + 1] === 39 && f.b[f.starts[e] + 24] === 39;
        if (isRooted || KEPT.test(tn)) entities.push([f.ids[e], prettyType(tn), latin.decode(f.b.subarray(f.starts[e] + 1, Math.max(f.starts[e] + 1, f.ends[e] - 1)))]);
      }
      var summary = summaryOf(f);
      summary.elements = elements.filter(function (r) { return r[3] === 'byggdel'; }).length;
      summary.rows = elements.length;
      summary.rooms = elements.filter(function (r) { return r[3] === 'rum'; }).length;
      summary.properties = properties.length;
      summary.quantities = quantities.length;
      summary.elementTypes = Array.from(typeCounts.entries()).map(function (x) { return { name: x[0], count: x[1] }; }).sort(function (x, y) { return y.count - x.count || x.name.localeCompare(y.name); });
      summary.storeys.forEach(function (s) { s.count = storeyCounts.get(s.name) || 0; });
      return { summary: summary, elements: elements, properties: properties, quantities: quantities, entities: entities };
    }

    /**
     * What the climate declaration needs per element (analysis/climate), in metres and cubic metres: the PredefinedType of the
     * element and of its type, its materials (name, layer thickness, fraction, the item's and the material's category), the
     * overall height and width of a door or window, the volume of the Body when it is made of extrusions (profile area × depth,
     * through mapped items, and the first operand of a clipping), the element it is a part of, whether it has parts, how many
     * openings void it, and the element a door or window sits in.
     */
    function climateOf(f) {
      var rooted = rootedIndex(f);
      var L = projectUnits(f, rooted.of).factors.LENGTHUNIT || 1;
      var ref = function (v) { return v && v.r !== undefined ? v.r : null; };
      var refs = function (v) { return Array.isArray(v) ? v.map(ref).filter(function (x) { return x !== null; }) : []; };
      var at = function (id) { var k = id === null || id === undefined ? -1 : f.indexOf[id]; return k === undefined || k < 0 ? -1 : k; };
      var nameOfType = function (k) { return f.typeNames[f.types[k]]; };
      var num = function (v) { var x = plain(v); return typeof x === 'number' && isFinite(x) ? x : null; };
      var text = function (v) { return typeof v === 'string' ? v : null; };
      /** The first enumeration from an attribute on: the PredefinedType (booleans and logicals are skipped). */
      var enumFrom = function (a, start) { for (var i = start; i < a.length; i++) { var v = a[i]; if (v && v.e !== undefined && v.e !== 'T' && v.e !== 'F' && v.e !== 'U') return v.e; } return null; };

      var elements = [];
      rooted.byType.forEach(function (list, t) {
        var name = f.typeNames[t];
        if (ROOT_NOT_PRODUCT.test(name) || NOT_ELEMENT[name] || STRUCTURE.test(name) || ROOMS.test(name)) return;
        for (var i = 0; i < list.length; i++) {
          var a = argsOf(f, list[i]);
          var hasPlace = a[5] && a[5].r !== undefined; var hasShape = a[6] && a[6].r !== undefined;
          if ((a[5] === null || hasPlace) && (a[6] === null || hasShape) && (hasPlace || hasShape)) elements.push({ k: list[i], id: f.ids[list[i]], a: a, name: name });
        }
      });
      var isElement = new Set(elements.map(function (e) { return e.id; }));
      var typeOf = new Map(); var materialOf = new Map(); var parentOf = new Map(); var hasParts = new Set(); var voids = new Map();
      var openingHost = new Map(); var fills = new Map();
      rooted.byType.forEach(function (list, t) {
        var name = f.typeNames[t];
        if (name !== 'IFCRELDEFINESBYTYPE' && name !== 'IFCRELASSOCIATESMATERIAL' && name !== 'IFCRELAGGREGATES' && name !== 'IFCRELVOIDSELEMENT' && name !== 'IFCRELFILLSELEMENT') return;
        for (var i = 0; i < list.length; i++) {
          var a = argsOf(f, list[i]);
          if (name === 'IFCRELDEFINESBYTYPE') { var ty = ref(a[5]); refs(a[4]).forEach(function (x) { typeOf.set(x, ty); }); }
          else if (name === 'IFCRELASSOCIATESMATERIAL') { var m = ref(a[5]); refs(a[4]).forEach(function (x) { if (!materialOf.has(x)) materialOf.set(x, m); }); }
          else if (name === 'IFCRELAGGREGATES') {
            var whole = ref(a[4]);
            if (!isElement.has(whole)) continue;
            refs(a[5]).forEach(function (x) { if (isElement.has(x)) { parentOf.set(x, whole); hasParts.add(whole); } });
          } else if (name === 'IFCRELVOIDSELEMENT') { var host = ref(a[4]); voids.set(host, (voids.get(host) || 0) + 1); openingHost.set(ref(a[5]), host); }
          else fills.set(ref(a[5]), ref(a[4]));
        }
      });

      /** A material's name and its own category (IfcMaterial.Category in IFC4: concrete, steel, wood, glass, gypsum …). */
      function materialOfRef(id) { var k = at(id); if (k < 0 || nameOfType(k) !== 'IFCMATERIAL') return ['', null]; var a = argsOf(f, k); return [String(a[0] || ''), text(a[2])]; }
      function materialSet(id, depth) {
        var k = at(id);
        if (k < 0 || depth > 6) return null;
        var n = nameOfType(k); var a = argsOf(f, k);
        var each = function (list, fn) { return refs(list).map(function (x) { var j = at(x); return j < 0 ? null : fn(argsOf(f, j)); }).filter(Boolean); };
        // Every item: [name, thickness m, fraction, the item's category (layer, profile, constituent), the material's own category,
        // the IfcMaterial's id (for its properties in materialProps)].
        var item = function (matRef, thickness, fraction, category) { var m = materialOfRef(matRef); return [m[0], thickness, fraction, category, m[1], at(matRef) >= 0 ? matRef : null]; };
        if (n === 'IFCMATERIAL') return { kind: 'single', items: [[String(a[0] || ''), null, null, null, text(a[2]), id]] };
        if (n === 'IFCMATERIALLAYERSETUSAGE' || n === 'IFCMATERIALPROFILESETUSAGE' || n === 'IFCMATERIALPROFILESETUSAGETAPERING') return materialSet(ref(a[0]), depth + 1);
        if (n === 'IFCMATERIALLAYERSET') return { kind: 'layers', items: each(a[0], function (la) { var th = num(la[1]); return item(ref(la[0]), th === null ? null : th * L, null, text(la[5])); }) };
        if (n === 'IFCMATERIALPROFILESET') return { kind: 'profiles', items: each(a[2], function (pa) { return item(ref(pa[2]), null, null, text(pa[5])); }) };
        if (n === 'IFCMATERIALCONSTITUENTSET') return { kind: 'constituents', items: each(a[2], function (ca) { return item(ref(ca[2]), null, num(ca[3]), text(ca[4])); }) };
        if (n === 'IFCMATERIALLIST') return { kind: 'list', items: refs(a[0]).map(function (x) { return item(x, null, null, null); }) };
        return null;
      }

      // ---- the volume of a Body made of extrusions ----------------------------------------------------------------
      function pointsArea(pts) {
        if (pts.length < 3 || pts.some(function (p) { return !p; })) return null;
        var s = 0;
        for (var i = 0; i < pts.length; i++) { var p = pts[i]; var q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
        return Math.abs(s) / 2;
      }
      var xy = function (c) { return Array.isArray(c) && c.length >= 2 ? [Number(c[0]) || 0, Number(c[1]) || 0] : null; };
      function curveArea(id) {
        var k = at(id);
        if (k < 0) return null;
        var n = nameOfType(k); var a = argsOf(f, k);
        if (n === 'IFCPOLYLINE') return pointsArea(refs(a[0]).map(function (x) { var j = at(x); return j < 0 ? null : xy(argsOf(f, j)[0]); }));
        if (n === 'IFCINDEXEDPOLYCURVE') {
          var lk = at(ref(a[0]));
          var coords = lk >= 0 ? argsOf(f, lk)[0] : null;
          if (!Array.isArray(coords)) return null;
          var order = [];
          if (Array.isArray(a[1]) && a[1].length) {
            for (var s = 0; s < a[1].length; s++) {
              var seg = a[1][s];
              // An arc would need its curve; only straight segments are counted.
              if (!seg || seg.t !== 'IFCLINEINDEX') return null;
              var idx = Array.isArray(seg.v) ? seg.v : [seg.v];
              for (var i = 0; i < idx.length; i++) if (!order.length || order[order.length - 1] !== idx[i]) order.push(idx[i]);
            }
          } else for (var c = 0; c < coords.length; c++) order.push(c + 1);
          return pointsArea(order.map(function (i) { return xy(coords[Number(i) - 1]); }));
        }
        return null;
      }
      function profileArea(id, depth) {
        var k = at(id);
        if (k < 0 || depth > 4) return null;
        var n = nameOfType(k); var a = argsOf(f, k);
        var x = function (i) { return num(a[i]); };
        var all = function (list) { return list.every(function (v) { return v !== null; }); };
        if (n === 'IFCRECTANGLEPROFILEDEF') return all([x(3), x(4)]) ? x(3) * x(4) : null;
        if (n === 'IFCROUNDEDRECTANGLEPROFILEDEF') return all([x(3), x(4)]) ? x(3) * x(4) - (4 - Math.PI) * Math.pow(x(5) || 0, 2) : null;
        if (n === 'IFCRECTANGLEHOLLOWPROFILEDEF') return all([x(3), x(4), x(5)]) ? x(3) * x(4) - Math.max(0, x(3) - 2 * x(5)) * Math.max(0, x(4) - 2 * x(5)) : null;
        if (n === 'IFCCIRCLEPROFILEDEF') return x(3) !== null ? Math.PI * x(3) * x(3) : null;
        if (n === 'IFCCIRCLEHOLLOWPROFILEDEF') return all([x(3), x(4)]) ? Math.PI * (x(3) * x(3) - Math.pow(Math.max(0, x(3) - x(4)), 2)) : null;
        if (n === 'IFCELLIPSEPROFILEDEF') return all([x(3), x(4)]) ? Math.PI * x(3) * x(4) : null;
        if (n === 'IFCISHAPEPROFILEDEF') return all([x(3), x(4), x(5), x(6)]) ? 2 * x(3) * x(6) + (x(4) - 2 * x(6)) * x(5) : null;
        if (n === 'IFCARBITRARYCLOSEDPROFILEDEF') return curveArea(ref(a[2]));
        if (n === 'IFCARBITRARYPROFILEDEFWITHVOIDS') {
          var outer = curveArea(ref(a[2]));
          if (outer === null) return null;
          var inner = refs(a[3]).map(curveArea);
          return inner.some(function (v) { return v === null; }) ? null : Math.max(0, outer - inner.reduce(function (sum, v) { return sum + v; }, 0));
        }
        if (n === 'IFCDERIVEDPROFILEDEF') {
          var parent = profileArea(ref(a[2]), depth + 1);
          var ok = at(ref(a[3]));
          var oa = ok >= 0 ? argsOf(f, ok) : [];
          var s1 = num(oa[3]); s1 = s1 === null ? 1 : s1;
          var s2 = nameOfType(ok) === 'IFCCARTESIANTRANSFORMATIONOPERATOR2DNONUNIFORM' && num(oa[4]) !== null ? num(oa[4]) : s1;
          return parent === null ? null : parent * s1 * s2;
        }
        return null;
      }
      function solidVolume(id, depth, flags) {
        var k = at(id);
        if (k < 0 || depth > 8) return null;
        var n = nameOfType(k); var a = argsOf(f, k);
        if (n === 'IFCEXTRUDEDAREASOLID') {
          var area = profileArea(ref(a[0]), 0); var d = num(a[3]); var dk = at(ref(a[2]));
          var dir = dk >= 0 ? argsOf(f, dk)[0] : null;
          if (area === null || d === null || !Array.isArray(dir)) return null;
          var len = Math.sqrt(dir.reduce(function (sum, v) { return sum + (Number(v) || 0) * (Number(v) || 0); }, 0));
          // The profile lies in the placement's XY plane: only the part of the direction along Z adds volume.
          return len ? area * d * Math.abs((Number(dir[2]) || 0) / len) : null;
        }
        if (n === 'IFCBOOLEANCLIPPINGRESULT' || (n === 'IFCBOOLEANRESULT' && a[0] && a[0].e === 'DIFFERENCE')) { flags.clipped = true; return solidVolume(ref(a[1]), depth + 1, flags); }
        if (n === 'IFCMAPPEDITEM') {
          var mk = at(ref(a[0]));
          var v = mk >= 0 ? representationVolume(ref(argsOf(f, mk)[1]), depth + 1, flags) : null;
          if (v === null) return null;
          var tk = at(ref(a[1]));
          if (tk < 0) return v;
          var ta = argsOf(f, tk); var s = num(ta[3]); s = s === null ? 1 : s;
          if (nameOfType(tk) === 'IFCCARTESIANTRANSFORMATIONOPERATOR3DNONUNIFORM') return v * s * (num(ta[5]) === null ? s : num(ta[5])) * (num(ta[6]) === null ? s : num(ta[6]));
          return v * s * s * s;
        }
        return null;
      }
      function representationVolume(id, depth, flags) {
        var k = at(id);
        var items = k >= 0 ? refs(argsOf(f, k)[3]) : [];
        if (!items.length) return null;
        var sum = 0;
        for (var i = 0; i < items.length; i++) { var v = solidVolume(items[i], depth, flags); if (v === null) return null; sum += v; }
        return sum;
      }
      function bodyOf(shape) {
        var k = at(shape);
        var reps = k >= 0 ? refs(argsOf(f, k)[2]) : [];
        var info = reps.map(function (r) { var j = at(r); var a = j >= 0 ? argsOf(f, j) : []; return { id: r, ident: String(a[1] || ''), kind: String(a[2] || '') }; });
        var body = info.filter(function (r) { return /^body$/i.test(r.ident); });
        if (!body.length) body = info.filter(function (r) { return !r.ident && /^(SweptSolid|Clipping|MappedRepresentation|CSG)$/i.test(r.kind); });
        return body.map(function (r) { return r.id; });
      }

      var out = [];
      for (var e = 0; e < elements.length; e++) {
        var el = elements[e]; var a = el.a;
        var typeId = typeOf.has(el.id) ? typeOf.get(el.id) : null;
        var tk = at(typeId);
        var typePredefined = tk >= 0 ? enumFrom(argsOf(f, tk), 9) : null;
        var mat = materialOf.has(el.id) ? materialSet(materialOf.get(el.id), 0) : null;
        if (!mat && typeId !== null && materialOf.has(typeId)) mat = materialSet(materialOf.get(typeId), 0);
        var overall = null;
        if (/^IFC(DOOR|WINDOW)(STANDARDCASE)?$/.test(el.name)) { var h = num(a[8]); var w = num(a[9]); if (h !== null && w !== null) overall = [h * L, w * L]; }
        var geometry = 'none'; var volume = null; var flags = { clipped: false };
        var body = a[6] && a[6].r !== undefined ? bodyOf(a[6].r) : [];
        if (body.length) {
          var total = 0;
          for (var b = 0; b < body.length && total !== null; b++) { var v = representationVolume(body[b], 0, flags); total = v === null ? null : total + v; }
          geometry = total === null ? 'other' : 'extrusion';
          volume = total === null ? null : total * L * L * L;
        }
        // A door or a window fills an opening that voids its host, usually a wall.
        var opening = fills.has(el.id) ? fills.get(el.id) : null;
        var hostId = opening !== null && openingHost.has(opening) ? openingHost.get(opening) : null;
        out.push([el.id, enumFrom(a, 8), typePredefined, mat, overall, volume, flags.clipped, geometry, parentOf.has(el.id) ? parentOf.get(el.id) : null, hasParts.has(el.id), voids.get(el.id) || 0, hostId]);
      }
      return { elements: out, materialProps: materialPropsOf(f) };
    }

    /**
     * The properties of the materials, for the material inventory (analysis/inventory): IFC4's IfcMaterialProperties (such as
     * Pset_MaterialCommon with MassDensity), IFC2X3's IfcExtendedMaterialProperties, and the MassDensity of IFC2X3's
     * IfcGeneralMaterialProperties under Pset_MaterialCommon. One row per single or enumerated value: [material id, set, name, value].
     */
    function materialPropsOf(f) {
      var wanted = {};
      f.typeNames.forEach(function (n, i) { if (n === 'IFCMATERIALPROPERTIES' || n === 'IFCEXTENDEDMATERIALPROPERTIES' || n === 'IFCGENERALMATERIALPROPERTIES') wanted[i] = n; });
      var out = [];
      if (!Object.keys(wanted).length) return out;
      var ref = function (v) { return v && v.r !== undefined ? v.r : null; };
      var at = function (id) { var k = id === null || id === undefined ? -1 : f.indexOf[id]; return k === undefined || k < 0 ? -1 : k; };
      var valueOf = function (k) {
        var n = f.typeNames[f.types[k]]; var a = argsOf(f, k);
        if (n !== 'IFCPROPERTYSINGLEVALUE' && n !== 'IFCPROPERTYENUMERATEDVALUE') return null;
        var v = plain(a[2]);
        return [String(a[0] || ''), Array.isArray(v) ? v.join(', ') : v];
      };
      for (var k = 0; k < f.count; k++) {
        var n = wanted[f.types[k]];
        if (!n) continue;
        var a = argsOf(f, k);
        if (n === 'IFCGENERALMATERIALPROPERTIES') { var d = plain(a[3]); if (ref(a[0]) !== null && typeof d === 'number') out.push([ref(a[0]), 'Pset_MaterialCommon', 'MassDensity', d]); continue; }
        var four = n === 'IFCMATERIALPROPERTIES';
        var material = ref(four ? a[3] : a[0]); var set = String((four ? a[0] : a[3]) || '');
        var list = four ? a[2] : a[1];
        if (material === null || !Array.isArray(list)) continue;
        for (var i = 0; i < list.length; i++) {
          var j = at(ref(list[i]));
          var pv = j >= 0 ? valueOf(j) : null;
          if (pv && pv[0] && pv[1] !== null && pv[1] !== undefined && pv[1] !== '') out.push([material, set, pv[0], pv[1]]);
        }
      }
      return out;
    }

    var parts = null;
    self.onmessage = function (ev) {
      var msg = ev.data || {};
      try {
        var report = function (p) { self.postMessage({ id: msg.id, progress: p }); };
        if (msg.type === 'summary') {
          self.postMessage({ id: msg.id, ok: true, result: summaryOf(scan(new Uint8Array(msg.bytes), report)) });
        } else if (msg.type === 'climate') {
          self.postMessage({ id: msg.id, ok: true, result: climateOf(scan(new Uint8Array(msg.bytes), report)) });
        } else if (msg.type === 'tables') {
          var t = tablesOf(scan(new Uint8Array(msg.bytes), report), report);
          parts = { queue: [['elements', t.elements], ['properties', t.properties], ['quantities', t.quantities], ['entities', t.entities]], at: 0, summary: t.summary };
          self.postMessage({ id: msg.id, summary: t.summary, tables: true });
        } else if (msg.type === 'next') {
          // One chunk per request: the page writes it to SQLite before it asks for the next.
          while (parts && parts.queue.length && parts.at >= parts.queue[0][1].length) { parts.queue.shift(); parts.at = 0; }
          if (!parts || !parts.queue.length) { parts = null; self.postMessage({ id: msg.id, ok: true, result: { done: true } }); return; }
          var head = parts.queue[0];
          var rows = head[1].slice(parts.at, parts.at + 5000);
          parts.at += rows.length;
          self.postMessage({ id: msg.id, ok: true, result: { table: head[0], rows: rows } });
        }
      } catch (err) { self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) }); }
    };
    self.postMessage({ ready: true });
  }

  D.define('data/ifc-step', [], () => {
    let worker = null; let ready = null; let seq = 0;
    const pending = new Map();
    function ensureWorker() {
      if (worker) return ready;
      worker = D.workers.create({ namespace: 'ifc-step', source: D.workers.functionSource(dataspatiumIfcStepWorker), name: 'ifc-step' });
      ready = new Promise((resolve) => {
        worker.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.ready) { resolve(true); return; }
          const p = pending.get(msg.id);
          if (!p) return;
          if (msg.progress !== undefined) { if (p.onProgress) p.onProgress(msg.progress); return; }
          pending.delete(msg.id);
          if (msg.tables) p.resolve(msg);
          else if (msg.ok) p.resolve(msg.result);
          else p.reject(msg.error === 'notifc' ? new Error(D.t('model.err.notifc')) : new Error(msg.error));
        };
        worker.onerror = (ev) => { for (const p of pending.values()) p.reject(new Error(String((ev && ev.message) || 'IFC reader'))); pending.clear(); stop(); };
      });
      return ready;
    }
    function stop() { if (worker) { worker.terminate(); worker = null; ready = null; } }
    function call(msg, onProgress, transfer) {
      return ensureWorker().then(() => new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, onProgress });
        worker.postMessage(Object.assign({ id }, msg), transfer || []);
      }));
    }

    /**
     * The facts of an IFC file, for the import step.
     * @param {Uint8Array} bytes @param {{onProgress?: (share: number) => void}} [options]
     */
    async function summary(bytes, options = {}) {
      const copy = bytes.slice().buffer;
      return call({ type: 'summary', bytes: copy }, options.onProgress, [copy]);
    }
    /**
     * The tables of an IFC file, delivered chunk by chunk so that a large model never sits in the page twice.
     * @param {Uint8Array} bytes
     * @param {{onRows: (table: 'elements'|'properties'|'quantities'|'entities', rows: any[][]) => Promise<void>, onProgress?: (share: number) => void}} options
     * @returns {Promise<any>} the summary
     */
    async function tables(bytes, options) {
      const copy = bytes.slice().buffer;
      const head = await call({ type: 'tables', bytes: copy }, options.onProgress, [copy]);
      try {
        for (;;) {
          const part = await call({ type: 'next' });
          if (part.done) break;
          await options.onRows(part.table, part.rows);
        }
      } finally { stop(); }
      return head.summary;
    }
    /**
     * The facts the climate declaration reads from the file, one row per element: [id, predefined, typePredefined, materials
     * ({kind, items: [name, thickness m, fraction, item category, material category, material id][]}), overall [height, width] m,
     * extruded volume m³, clipped, geometry ('none'|'extrusion'|'other'), parent element id, has parts, openings, host element id
     * (the element a door or window fills an opening in)]; and the materials' properties, [material id, set, name, value] (the
     * mass density in the file's values, taken as kg/m³). The worker stays for the next call.
     * @param {Uint8Array} bytes @param {{onProgress?: (share: number) => void}} [options] @returns {Promise<{elements: any[][], materialProps: any[][]}>}
     */
    async function climate(bytes, options = {}) {
      const copy = bytes.slice().buffer;
      return call({ type: 'climate', bytes: copy }, options.onProgress, [copy]);
    }
    return { summary, tables, climate, stop };
  });
})();
