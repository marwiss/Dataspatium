// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A preliminary climate declaration from a building model (F43, decisions B-59 and B-59.1). Every building element gets one of
 * Boverket's four categories, or "not included", and one of the six layers of a building (Boverket's rapport 2024:26, chapter 3,
 * figure 1), from one table of rules that reads only the IFC class, the PredefinedType (of the occurrence, or of its type) and
 * the common properties LoadBearing and IsExternal; no classification system is read. A rule either decides, decides
 * provisionally (the element is surely declared but its category is uncertain, say an interior wall without LoadBearing: it
 * counts in the totals and is listed for the person), or cannot decide (it does not count until the person settles it). When
 * IsExternal is not given it may be derived: from the building's topology when the person has run it, and for a door or window
 * from the wall it sits in; the rule then says so. The person's settlement of an element is kept per GlobalId.
 * Quantities come from the file's quantity sets, otherwise from a simple extrusion in the geometry (profile area × depth) or a
 * door's or window's overall size, otherwise there is none. A post is one material of one element (a layer, a constituent, the
 * only material), or the element itself keyed by its type when it is a window, a door or has no material. Each material is
 * matched with a resource of Boverket's climate database (api/klimatdatabas): within the database category its IfcMaterial
 * Category names when it has one, by name otherwise, and the person's choice wins. GWP-GHG is summed for A1–A3, A4 and A5 (the
 * waste, A5.1). `gather` reads a model dataset and its file; everything else is a pure function, for the tests.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/climate', ['data/datasets', 'data/model', 'data/ifc-step', 'platform/storage/idb', 'ui/i18n'], (datasets, model, step, idb, i18n) => {
    const t = (k, p) => D.t(k, p);
    /** Boverket's four categories, then what is not included and what the rules cannot decide. */
    const CATEGORIES = ['grund', 'barande', 'skarm', 'inner', 'ingar_inte', 'oklar'];
    /** The categories a declaration sums. */
    const DECLARED = ['grund', 'barande', 'skarm', 'inner'];
    /** The six layers of a building: site and foundation, frame, envelope, services, interior, fixed furnishings. */
    const LAYERS = [1, 2, 3, 4, 5, 6];
    /** The layer of a declared category, for an element the person settles. */
    const CATEGORY_LAYER = { grund: 1, barande: 2, skarm: 3, inner: 5 };
    const CHOICES_KEY = 'klimat:resurser';
    const SETTLED_KEY = 'klimat:kategorier';

    /** Building services (IfcDistributionElement and its subtypes in IFC4 and IFC4X3) and transport elements. */
    const SERVICES = ['IfcDistributionElement', 'IfcDistributionControlElement', 'IfcDistributionFlowElement', 'IfcDistributionChamberElement',
      'IfcEnergyConversionDevice', 'IfcFlowController', 'IfcFlowFitting', 'IfcFlowMovingDevice', 'IfcFlowSegment', 'IfcFlowStorageDevice',
      'IfcFlowTerminal', 'IfcFlowTreatmentDevice', 'IfcActuator', 'IfcAlarm', 'IfcController', 'IfcFlowInstrument', 'IfcProtectiveDeviceTrippingUnit',
      'IfcSensor', 'IfcUnitaryControlElement', 'IfcAirToAirHeatRecovery', 'IfcBoiler', 'IfcBurner', 'IfcChiller', 'IfcCoil', 'IfcCondenser',
      'IfcCooledBeam', 'IfcCoolingTower', 'IfcElectricGenerator', 'IfcElectricMotor', 'IfcEngine', 'IfcEvaporativeCooler', 'IfcEvaporator',
      'IfcHeatExchanger', 'IfcHumidifier', 'IfcMotorConnection', 'IfcTransformer', 'IfcTubeBundle', 'IfcUnitaryEquipment', 'IfcAirTerminalBox',
      'IfcDamper', 'IfcElectricDistributionBoard', 'IfcDistributionBoard', 'IfcElectricTimeControl', 'IfcFlowMeter', 'IfcProtectiveDevice',
      'IfcSwitchingDevice', 'IfcValve', 'IfcCableCarrierFitting', 'IfcCableFitting', 'IfcDuctFitting', 'IfcJunctionBox', 'IfcPipeFitting',
      'IfcCompressor', 'IfcFan', 'IfcPump', 'IfcCableCarrierSegment', 'IfcCableSegment', 'IfcDuctSegment', 'IfcPipeSegment', 'IfcConveyorSegment',
      'IfcElectricFlowStorageDevice', 'IfcTank', 'IfcAirTerminal', 'IfcAudioVisualAppliance', 'IfcCommunicationsAppliance', 'IfcElectricAppliance',
      'IfcFireSuppressionTerminal', 'IfcLamp', 'IfcLightFixture', 'IfcMedicalDevice', 'IfcOutlet', 'IfcSanitaryTerminal', 'IfcSpaceHeater',
      'IfcStackTerminal', 'IfcWasteTerminal', 'IfcLiquidTerminal', 'IfcMobileTelecommunicationsAppliance', 'IfcSignal', 'IfcDuctSilencer',
      'IfcFilter', 'IfcInterceptor', 'IfcElectricFlowTreatmentDevice', 'IfcTransportElement'];

    /**
     * The rules, in order: the first that matches decides. `classes` and `predefined` list what matches; `external` and `loadBearing`
     * are the values of IsExternal and LoadBearing that match (true, false, or null for not given; a list for several); a missing
     * key matches anything. `category` is one of CATEGORIES and `layer` one of LAYERS, or null when the rule cannot say. A rule
     * with `uncertain` decides provisionally: the element is declared either way, so it counts, but its category waits for the
     * person. `reason` says why (climate.reason.<reason>). Boverket's page "Byggdelar som ingår" (read 2026-11-12) is the ground:
     * piles, earthworks, services, fixed furnishings, movable walls, interior surface layers and shading are not included;
     * stairs, ramps and their railings are load-bearing; ceilings, interior doors and glazed partitions belong to interior walls.
     */
    const RULES = [
      { id: 'footing', classes: ['IfcFooting'], category: 'grund', layer: 1 },
      { id: 'pile', classes: ['IfcPile', 'IfcDeepFoundation', 'IfcCaissonFoundation'], category: 'ingar_inte', layer: 1 },
      { id: 'site', classes: ['IfcEarthworksCut', 'IfcEarthworksFill', 'IfcEarthworksElement', 'IfcReinforcedSoil', 'IfcGeographicElement', 'IfcCivilElement', 'IfcCourse', 'IfcPavement', 'IfcKerb', 'IfcGeotechnicalElement', 'IfcGeotechnicalStratum', 'IfcBorehole'], category: 'ingar_inte', layer: 1 },
      { id: 'slab-base', classes: ['IfcSlab'], predefined: ['BASESLAB'], category: 'grund', layer: 1 },
      { id: 'wall-retaining', classes: ['IfcWall'], predefined: ['RETAININGWALL'], category: 'ingar_inte', layer: 1 },
      { id: 'solar', classes: ['IfcSolarDevice'], category: 'oklar', layer: null, reason: 'solar' },
      { id: 'services', classes: SERVICES, category: 'ingar_inte', layer: 4 },
      { id: 'furnishing', classes: ['IfcFurnishingElement', 'IfcFurniture', 'IfcSystemFurnitureElement'], category: 'ingar_inte', layer: 6 },
      { id: 'shading', classes: ['IfcShadingDevice'], category: 'ingar_inte', layer: 3 },
      { id: 'frame-notbearing', classes: ['IfcColumn', 'IfcBeam'], loadBearing: false, category: 'oklar', layer: 2, reason: 'notbearing' },
      { id: 'frame', classes: ['IfcColumn', 'IfcBeam'], category: 'barande', layer: 2 },
      { id: 'stair', classes: ['IfcStair', 'IfcStairFlight', 'IfcRamp', 'IfcRampFlight'], category: 'barande', layer: 2 },
      { id: 'railing-fence', classes: ['IfcRailing'], predefined: ['FENCE'], category: 'ingar_inte', layer: 1 },
      { id: 'railing', classes: ['IfcRailing'], category: 'barande', layer: 2 },
      { id: 'slab-landing', classes: ['IfcSlab'], predefined: ['LANDING'], category: 'barande', layer: 2 },
      { id: 'slab-roof', classes: ['IfcSlab'], predefined: ['ROOF'], category: 'skarm', layer: 3 },
      { id: 'roof', classes: ['IfcRoof'], category: 'skarm', layer: 3 },
      { id: 'slab-external', classes: ['IfcSlab'], external: true, category: 'skarm', layer: 3 },
      { id: 'floor-notbearing', classes: ['IfcSlab'], predefined: ['FLOOR'], loadBearing: false, category: 'inner', layer: 5, uncertain: true, reason: 'floor' },
      { id: 'floor', classes: ['IfcSlab'], predefined: ['FLOOR'], category: 'barande', layer: 2 },
      { id: 'slab-bearing', classes: ['IfcSlab'], loadBearing: true, category: 'barande', layer: 2 },
      { id: 'slab-unknown', classes: ['IfcSlab'], category: 'barande', layer: 2, uncertain: true, reason: 'slab' },
      { id: 'wall-movable', classes: ['IfcWall'], predefined: ['MOVABLE'], category: 'ingar_inte', layer: 5 },
      { id: 'wall-external', classes: ['IfcWall'], external: true, category: 'skarm', layer: 3 },
      { id: 'partition-bearing', classes: ['IfcWall'], predefined: ['PARTITIONING'], external: [false, null], loadBearing: true, category: 'barande', layer: 2 },
      { id: 'partition', classes: ['IfcWall'], predefined: ['PARTITIONING'], external: [false, null], category: 'inner', layer: 5 },
      { id: 'wall-internal-bearing', classes: ['IfcWall'], external: false, loadBearing: true, category: 'barande', layer: 2 },
      { id: 'wall-internal', classes: ['IfcWall'], external: false, loadBearing: false, category: 'inner', layer: 5 },
      { id: 'wall-internal-unknown', classes: ['IfcWall'], external: false, category: 'inner', layer: 5, uncertain: true, reason: 'bearing' },
      { id: 'wall-bearing-unknown', classes: ['IfcWall'], loadBearing: true, category: 'barande', layer: 2, uncertain: true, reason: 'external' },
      { id: 'wall-unknown', classes: ['IfcWall'], category: 'inner', layer: 5, uncertain: true, reason: 'external' },
      { id: 'curtainwall-internal', classes: ['IfcCurtainWall'], external: false, category: 'inner', layer: 5 },
      { id: 'curtainwall', classes: ['IfcCurtainWall'], category: 'skarm', layer: 3 },
      { id: 'window-internal', classes: ['IfcWindow'], external: false, category: 'inner', layer: 5 },
      { id: 'window-external', classes: ['IfcWindow'], external: true, category: 'skarm', layer: 3 },
      { id: 'window', classes: ['IfcWindow'], category: 'skarm', layer: 3, uncertain: true, reason: 'external' },
      { id: 'door-external', classes: ['IfcDoor'], external: true, category: 'skarm', layer: 3 },
      { id: 'door-internal', classes: ['IfcDoor'], external: false, category: 'inner', layer: 5 },
      { id: 'door', classes: ['IfcDoor'], category: 'inner', layer: 5, uncertain: true, reason: 'external' },
      { id: 'member-mullion', classes: ['IfcMember'], predefined: ['MULLION'], category: 'skarm', layer: 3 },
      { id: 'member-roof', classes: ['IfcMember'], predefined: ['RAFTER', 'PURLIN', 'COLLAR', 'CHORD'], category: 'barande', layer: 2 },
      { id: 'plate-curtain', classes: ['IfcPlate'], predefined: ['CURTAIN_PANEL'], category: 'skarm', layer: 3 },
      { id: 'member-bearing', classes: ['IfcMember', 'IfcPlate'], loadBearing: true, category: 'barande', layer: 2 },
      { id: 'member-external', classes: ['IfcMember', 'IfcPlate'], external: true, category: 'skarm', layer: 3 },
      { id: 'member-internal', classes: ['IfcMember', 'IfcPlate'], external: false, loadBearing: false, category: 'inner', layer: 5 },
      { id: 'member-unknown', classes: ['IfcMember', 'IfcPlate'], category: 'barande', layer: 2, uncertain: true, reason: 'bearing' },
      { id: 'covering-ceiling', classes: ['IfcCovering'], predefined: ['CEILING'], category: 'inner', layer: 5 },
      { id: 'covering-finish', classes: ['IfcCovering'], predefined: ['FLOORING', 'MOLDING', 'SKIRTINGBOARD'], category: 'ingar_inte', layer: 5 },
      { id: 'covering-services', classes: ['IfcCovering'], predefined: ['SLEEVING', 'WRAPPING'], category: 'ingar_inte', layer: 4 },
      { id: 'covering-roofing', classes: ['IfcCovering'], predefined: ['ROOFING'], category: 'skarm', layer: 3 },
      { id: 'covering-topping', classes: ['IfcCovering'], predefined: ['TOPPING'], category: 'barande', layer: 2 },
      { id: 'covering-membrane-internal', classes: ['IfcCovering'], predefined: ['MEMBRANE'], external: false, category: 'ingar_inte', layer: 5 },
      { id: 'covering-insulation-internal', classes: ['IfcCovering'], predefined: ['INSULATION'], external: false, category: 'inner', layer: 5 },
      { id: 'covering-lining', classes: ['IfcCovering'], predefined: ['CLADDING'], external: false, category: 'inner', layer: 5, uncertain: true, reason: 'lining' },
      { id: 'covering-envelope', classes: ['IfcCovering'], predefined: ['CLADDING', 'INSULATION', 'MEMBRANE'], category: 'skarm', layer: 3 },
      { id: 'covering-unknown', classes: ['IfcCovering'], category: 'oklar', layer: null, reason: 'covering' },
      { id: 'reinforcement', classes: ['IfcReinforcingElement', 'IfcReinforcingBar', 'IfcReinforcingMesh', 'IfcTendon', 'IfcTendonAnchor', 'IfcTendonConduit'], category: 'barande', layer: 2, uncertain: true, reason: 'reinforcement' },
      { id: 'proxy', classes: ['IfcBuildingElementProxy', 'IfcBuiltElement', 'IfcBuildingElement', 'IfcElementAssembly', 'IfcBuildingElementPart', 'IfcElementComponent', 'IfcChimney', 'IfcDiscreteAccessory', 'IfcFastener', 'IfcMechanicalFastener'], category: 'oklar', layer: null, reason: 'proxy' },
      { id: 'unknown', category: 'oklar', layer: null, reason: 'class' },
    ];
    const UPPER = new Map(RULES.map((r) => [r, r.classes ? new Set(r.classes.map((c) => c.toUpperCase())) : null]));

    /** The IFC class without the StandardCase and ElementedCase endings of IFC2X3 and IFC4, in capitals. @param {string} cls */
    const classKey = (cls) => String(cls || '').toUpperCase().replace(/(STANDARDCASE|ELEMENTEDCASE)$/, '');
    const meaningful = (v) => !!v && v !== 'NOTDEFINED' && v !== 'USERDEFINED';
    /**
     * The PredefinedType that applies: the type's when it says something (IFC: a type's value goes before the occurrence's),
     * otherwise the occurrence's. @param {string|null} occurrence @param {string|null} type @returns {string|null}
     */
    const predefinedOf = (occurrence, type) => (meaningful(type) ? type : meaningful(occurrence) ? occurrence : (occurrence || type || null));
    /** A property value as true, false or null (not given). @param {any} v @returns {boolean|null} */
    function bool(v) {
      if (v === true || v === false) return v;
      const s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
      if (['true', 't', '.t.', '1', 'yes', 'ja'].includes(s)) return true;
      if (['false', 'f', '.f.', '0', 'no', 'nej'].includes(s)) return false;
      return null;
    }
    const oneOf = (want, have) => (Array.isArray(want) ? want : [want]).includes(have === undefined ? null : have);
    function matches(rule, el) {
      const classes = UPPER.get(rule);
      if (classes && !classes.has(classKey(el.cls))) return false;
      if (rule.predefined && !rule.predefined.includes(el.predefined)) return false;
      if (rule.external !== undefined && !oneOf(rule.external, el.external)) return false;
      if (rule.loadBearing !== undefined && !oneOf(rule.loadBearing, el.loadBearing)) return false;
      return true;
    }
    const shown = (v) => (v === null || v === undefined ? t('climate.notgiven') : String(v));
    /**
     * The rule's own words for an element: the class, the PredefinedType and the properties the rule looked at (a derived IsExternal
     * says where from), and the reason when it cannot decide for sure. @param {any} rule @param {any} el
     */
    function ruleText(rule, el) {
      const parts = [String(el.cls || '')];
      if (rule.predefined) parts.push(String(el.predefined));
      if (rule.external !== undefined) parts.push('IsExternal = ' + shown(el.external) + (el.externalFrom ? ' (' + t('climate.derived.' + el.externalFrom) + ')' : ''));
      if (rule.loadBearing !== undefined) parts.push('LoadBearing = ' + shown(el.loadBearing));
      if (rule.reason) parts.push(t('climate.reason.' + rule.reason));
      return parts.join(' · ');
    }
    /**
     * Category and layer of one element. `uncertain` marks a provisional category: declared, but the person should settle it.
     * @param {{cls: string, predefined?: string|null, external?: boolean|null, loadBearing?: boolean|null, externalFrom?: string|null}} el
     * @returns {{category: string, layer: number|null, rule: string, reason: string|null, uncertain: boolean, text: string}}
     */
    function classify(el) {
      const e = { cls: el.cls, predefined: el.predefined || null, external: el.external === undefined ? null : el.external, loadBearing: el.loadBearing === undefined ? null : el.loadBearing, externalFrom: el.externalFrom || null };
      const rule = RULES.find((r) => matches(r, e)) || RULES[RULES.length - 1];
      return { category: rule.category, layer: rule.layer, rule: rule.id, reason: rule.reason || null, uncertain: !!rule.uncertain, text: ruleText(rule, e) };
    }

    /**
     * IsExternal from the building's topology (python/dataspatium.py `_ifc_topology`, run on the person's action): the walls along a
     * storey's outer boundary are external, and on a closed storey the other walls of its rooms are internal.
     * @param {any[]} storeys the topology's list @returns {Map<number, boolean>} wall id → IsExternal
     */
    function externalFromTopology(storeys) {
      const out = new Map();
      for (const s of Array.isArray(storeys) ? storeys : []) {
        const outer = new Set((s.external || []).map((w) => Number(w.wall)));
        for (const id of outer) out.set(id, true);
        if (s.closed) for (const room of s.rooms || []) for (const w of room.walls || []) if (!outer.has(Number(w))) out.set(Number(w), false);
      }
      return out;
    }

    /**
     * The decision for every element and post. IsExternal is the file's, else the topology's, else (for a door or a window) its
     * host's; a part the rules cannot decide for sure takes the decision of the element it belongs to; and the person's settlement
     * (GlobalId → category) goes before everything. The data from gather is not changed.
     * @param {{elements: any[], posts: any[]}} data @param {{derived?: Map<number, boolean>|null, settled?: Record<string, string>|null}} [options]
     * @returns {{elements: any[], posts: any[]}}
     */
    function decide(data, options = {}) {
      const derived = options.derived || new Map();
      const settled = options.settled || {};
      const byId = new Map();
      const elements = data.elements.map((raw) => {
        const el = Object.assign({}, raw, { externalFrom: null });
        if (el.external === null && derived.has(el.id)) { el.external = derived.get(el.id); el.externalFrom = 'topology'; }
        byId.set(el.id, el);
        return el;
      });
      for (const el of elements) {
        const host = el.external === null && el.host !== null && el.host !== undefined ? byId.get(el.host) : null;
        if (host && host.external !== null && /^IFC(DOOR|WINDOW)$/.test(classKey(el.cls))) { el.external = host.external; el.externalFrom = 'host'; }
      }
      for (const el of elements) {
        const c = classify(el);
        Object.assign(el, { category: c.category, layer: c.layer, rule: c.rule, reason: c.reason, uncertain: c.uncertain, ruleText: c.text });
      }
      for (const el of elements) {
        const parent = el.parent !== null && el.parent !== undefined ? byId.get(el.parent) : null;
        if ((el.category === 'oklar' || el.uncertain) && parent && parent.category !== 'oklar' && !parent.uncertain) {
          Object.assign(el, { category: parent.category, layer: parent.layer, rule: 'part', reason: null, uncertain: false, ruleText: t('climate.reason.part', { cls: parent.cls, rule: parent.ruleText }) });
        }
      }
      for (const el of elements) {
        el.ruled = { category: el.category, layer: el.layer, uncertain: el.uncertain, reason: el.reason, text: el.ruleText };
        const choice = el.guid ? settled[el.guid] : undefined;
        if (choice && CATEGORIES.includes(choice) && choice !== 'oklar') {
          Object.assign(el, { category: choice, layer: CATEGORY_LAYER[choice] || el.layer, rule: 'person', reason: null, uncertain: false, ruleText: t('climate.rule.person', { rule: el.ruled.text }) });
        }
      }
      const posts = data.posts.map((p) => {
        const el = byId.get(p.id);
        return Object.assign({}, p, el ? { category: el.category, layer: el.layer, rule: el.rule, uncertain: el.uncertain, ruleText: el.ruleText } : {});
      });
      return { elements, posts };
    }

    // ---- quantities --------------------------------------------------------------------------------------------------
    const SIDE_AREA = new Set(['IFCWALL', 'IFCCURTAINWALL']);
    /** Which volume, area and weight of a quantity set to take: net before plain before gross; undefined for names that do not apply. */
    const RANK = {
      volym: (name) => ({ NETVOLUME: 0, VOLUME: 1, GROSSVOLUME: 2 })[String(name).toUpperCase()],
      area: (name, cls) => {
        const n = String(name).toUpperCase();
        if (SIDE_AREA.has(cls)) { const side = ({ NETSIDEAREA: 0, GROSSSIDEAREA: 1 })[n]; if (side !== undefined) return side; }
        return ({ NETAREA: 2, AREA: 3, GROSSAREA: 4 })[n];
      },
      vikt: (name) => ({ NETWEIGHT: 0, WEIGHT: 1, GROSSWEIGHT: 2 })[String(name).toUpperCase()],
    };
    /** The best value of one kind among an element's quantities ([name, value, kind] rows). */
    function pick(rows, kind, cls) {
      let best = null; let rank = Infinity;
      for (const [name, value, slag] of rows) {
        if (slag !== kind || typeof value !== 'number' || !Number.isFinite(value)) continue;
        const r = RANK[kind](name, cls);
        if (r !== undefined && r < rank) { rank = r; best = value; }
      }
      return best;
    }
    /**
     * An element's volume (m³), area (m²) and mass (kg), each with where it came from: the file's quantity sets, the extrusion in
     * the geometry, or a door's or window's overall size. @param {string} cls @param {any[][]} qto [name, value, slag] rows
     * @param {any} fact the file's facts for the element (data/ifc-step.climate), or null
     */
    function quantitiesOf(cls, qto, fact) {
      const key = classKey(cls);
      const q = { volume: pick(qto || [], 'volym', key), area: pick(qto || [], 'area', key), mass: pick(qto || [], 'vikt', key), sources: {}, notes: [] };
      for (const k of ['volume', 'area', 'mass']) if (q[k] !== null) q.sources[k] = 'qto';
      if (q.volume === null && fact && typeof fact.volume === 'number') {
        q.volume = fact.volume; q.sources.volume = 'extrusion';
        if (fact.clipped) q.notes.push(t('climate.source.clipped'));
        if (fact.openings) q.notes.push(t('climate.source.openings', { n: fact.openings }));
      }
      if (q.area === null && fact && Array.isArray(fact.overall)) { q.area = fact.overall[0] * fact.overall[1]; q.sources.area = 'overall'; }
      return q;
    }

    /** The key a material is chosen under: the same name in any model gets the same resource. */
    const materialKey = (name) => 'm:' + String(name).trim().toLowerCase();
    /** The key of an element without a material of its own, a window or a door: its type's name, or its class. */
    const typeKey = (el) => 't:' + String(el.typnamn || el.cls || '').trim().toLowerCase();
    /** Windows and doors are whole products in the climate database, counted per square metre. */
    const WHOLE_PRODUCTS = new Set(['IFCWINDOW', 'IFCDOOR']);
    /**
     * The posts of one element: one per material (a layer's volume is its share of the thickness, a constituent's its fraction),
     * or the element itself keyed by its type. A post has a key, a label, the name and the IfcMaterial Category resources are
     * matched on, the layer thickness and its volume, area and mass with their sources, and the IfcMaterial's id (`material`, null
     * for a post keyed by its type). The material inventory passes `whole: false` to count doors and windows per material too.
     * @param {any} el {cls, typnamn} @param {any} q quantitiesOf
     * @param {any} materials {kind, items: [name, thickness, fraction, item category, material category, material id][]}
     * @param {{whole?: boolean}} [options]
     */
    function postsOf(el, q, materials, options = {}) {
      const whole = (key, label, name, category, material) => [{ key, label, name, materialCategory: category || null, material: material === undefined ? null : material, thickness: null, volume: q.volume, area: q.area, mass: q.mass, sources: q.sources, notes: q.notes.slice() }];
      const items = materials && Array.isArray(materials.items) ? materials.items : [];
      const named = items.filter((i) => i && String(i[0] || '').trim());
      if ((options.whole !== false && WHOLE_PRODUCTS.has(classKey(el.cls))) || !named.length) {
        const name = String(el.typnamn || el.cls || '').trim();
        return whole(typeKey(el), t('climate.material.type', { name }), el.typnamn ? name : '', null, null);
      }
      if (named.length === 1 && materials.kind !== 'layers') return whole(materialKey(named[0][0]), String(named[0][0]).trim(), String(named[0][0]).trim(), named[0][4], named[0][5]);
      const post = (i, volume, area, sources) => ({ key: materialKey(i[0]), label: String(i[0]).trim(), name: String(i[0]).trim(), materialCategory: i[4] || null, material: i[5] === undefined ? null : i[5], thickness: typeof i[1] === 'number' ? i[1] : null, volume, area, mass: null, sources, notes: q.notes.slice() });
      if (materials.kind === 'layers') {
        const total = items.reduce((s, i) => s + (typeof i[1] === 'number' && i[1] > 0 ? i[1] : 0), 0);
        // Every layer covers the element's whole area; without an area the volume over the total thickness gives it, and the
        // other way round, so each kind keeps the source it was derived from.
        const area = q.area !== null ? q.area : (q.volume !== null && total > 0 ? q.volume / total : null);
        const sources = { volume: q.sources.volume || q.sources.area, area: q.sources.area || q.sources.volume };
        return named.map((i) => {
          const th = typeof i[1] === 'number' && i[1] > 0 ? i[1] : null;
          const volume = th === null ? null : q.volume !== null && total > 0 ? q.volume * th / total : area !== null ? area * th : null;
          return post(i, volume, area, sources);
        });
      }
      if (materials.kind === 'constituents' && named.every((i) => typeof i[2] === 'number' && i[2] > 0)) {
        const sum = named.reduce((s, i) => s + i[2], 0);
        return named.map((i) => post(i, q.volume === null ? null : q.volume * i[2] / sum, null, { volume: q.sources.volume }));
      }
      // Several materials without shares: each is listed, none has a quantity of its own.
      return named.map((i) => Object.assign(post(i, null, null, {}), { notes: [t('climate.source.shares')] }));
    }

    // ---- resources: proposals, choices and the computation ------------------------------------------------------------------
    /**
     * IfcMaterial.Category (IFC4 recommends concrete, steel, aluminium, block, brick, stone, wood, glass, gypsum, plastic and earth)
     * and a few common words, to the categories of Boverket's climate database by their code there (6 Betong, 8 Stål och andra
     * metaller, 9 Murblock och tegel, 12 Trävaror, 4 Fönster, dörrar och glas, 10 Byggskivor, 7 Isolering, 2 Bruk och
     * bindemedel, 11 Tätskikt, 5 Färg och fog).
     */
    const MATERIAL_GROUPS = {
      concrete: ['6'], betong: ['6'], steel: ['8'], stål: ['8'], aluminium: ['8'], aluminum: ['8'], metal: ['8'], metall: ['8'],
      block: ['9'], brick: ['9'], tegel: ['9'], stone: ['9'], sten: ['9'], masonry: ['9'], wood: ['12'], timber: ['12'], trä: ['12'],
      glass: ['4'], glas: ['4'], gypsum: ['10'], gips: ['10'], board: ['10'], insulation: ['7'], isolering: ['7'],
      mortar: ['2'], bruk: ['2'], membrane: ['11'], waterproofing: ['11'], tätskikt: ['11'], paint: ['5'], färg: ['5'],
    };
    /** Words that name a whole database category: they choose it but say nothing about which product in it fits best. */
    const GROUP_ONLY = new Set(['insulation', 'isolering', 'wood', 'timber', 'trä', 'board', 'metal', 'metall']);
    const categoryWords = (category) => String(category || '').toLowerCase().split(/[^\p{L}]+/u).filter((w) => MATERIAL_GROUPS[w]);
    /** The database categories an IfcMaterial Category names, or null. @param {string|null|undefined} category @returns {string[]|null} */
    function groupsOf(category) {
      const found = new Set();
      for (const w of categoryWords(category)) for (const g of MATERIAL_GROUPS[w]) found.add(g);
      return found.size ? Array.from(found) : null;
    }
    /** The kinds of quantity a post can offer a resource. @param {any} post @returns {string[]} */
    const kindsOf = (post) => ['volume', 'area', 'mass'].filter((k) => post[k] !== null && post[k] !== undefined);
    /** Whether a resource can be counted from one of these kinds of quantity. @param {any} r @param {string[]|Set<string>} kinds */
    function compatible(r, kinds) {
      const has = (k) => (kinds instanceof Set ? kinds.has(k) : kinds.includes(k));
      if (r.unit === 'kg') return (has('volume') && !!r.density) || (has('area') && !!r.areal) || has('mass');
      if (r.unit === 'm²') return has('area');
      return false;
    }
    const words = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !/^\d+$/.test(w));
    /**
     * How well a name matches a resource: a whole word counts most, then a word that ends with it (Swedish compounds name the
     * thing last: fabriksbetong is concrete, betongtakpannor are tiles), then one that holds it.
     */
    function score(query, r) {
      const target = words([r.name, r.nameEn, r.synonyms].join(' '));
      let s = 0;
      for (const w of words(query)) {
        if (target.includes(w)) s += 4;
        else if (w.length >= 4 && target.some((x) => x.endsWith(w))) s += 3;
        else if (w.length >= 4 && target.some((x) => x.includes(w))) s += 1;
      }
      return s;
    }
    /**
     * Resources proposed for a material, best first, among those its quantities can count: within the database categories its
     * IfcMaterial Category names when there are such resources (ranked by the name and a category word that tells products apart,
     * such as gypsum among the boards, the database's order breaking ties), otherwise by name alone.
     * @param {string} name @param {any[]} resources @param {string[]|Set<string>} kinds @param {number} [limit] @param {string|null} [category]
     */
    function suggest(name, resources, kinds, limit = 5, category = null) {
      const pool = resources.filter((r) => compatible(r, kinds));
      const groups = groupsOf(category);
      const within = groups ? pool.filter((r) => groups.includes(String(r.group))) : [];
      const query = [name].concat(within.length ? categoryWords(category).filter((w) => !GROUP_ONLY.has(w)) : []).join(' ');
      const ranked = (within.length ? within : pool).map((r, i) => ({ r, i, s: score(query, r) }));
      return (within.length ? ranked : ranked.filter((x) => x.s > 0)).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, limit).map((x) => x.r);
    }
    /**
     * The materials of the posts, each with its key, label, name, IfcMaterial Category, number of elements and posts, total
     * quantities and the kinds it offers.
     * @param {any[]} posts @returns {Array<{key: string, label: string, name: string, category: string|null, elements: number, posts: number, volume: number, area: number, mass: number, kinds: string[]}>}
     */
    function materialsOf(posts) {
      const by = new Map();
      for (const p of posts) {
        let m = by.get(p.key);
        if (!m) { m = { key: p.key, label: p.label, name: p.name || '', category: null, ids: new Set(), posts: 0, volume: 0, area: 0, mass: 0, kinds: new Set() }; by.set(p.key, m); }
        if (!m.category && p.materialCategory) m.category = p.materialCategory;
        m.ids.add(p.id); m.posts++;
        for (const k of kindsOf(p)) { m[k] += p[k]; m.kinds.add(k); }
      }
      return Array.from(by.values()).sort((a, b) => a.label.localeCompare(b.label, i18n.locale()))
        .map((m) => ({ key: m.key, label: m.label, name: m.name, category: m.category, elements: m.ids.size, posts: m.posts, volume: m.volume, area: m.area, mass: m.mass, kinds: Array.from(m.kinds) }));
    }
    /**
     * The resource of each material: the person's choice (an empty choice means none), otherwise the best proposal.
     * @param {any[]} materials materialsOf @param {any} db {resources} @param {Record<string, string>} choices
     * @returns {Map<string, {resource: any, chosen: boolean}>}
     */
    function resolve(materials, db, choices) {
      const resources = (db && db.resources) || [];
      const byId = new Map(resources.map((r) => [String(r.id), r]));
      const out = new Map();
      for (const m of materials) {
        const choice = choices && Object.prototype.hasOwnProperty.call(choices, m.key) ? String(choices[m.key]) : null;
        if (choice !== null && (choice === '' || byId.has(choice))) out.set(m.key, { resource: choice ? byId.get(choice) : null, chosen: true });
        else out.set(m.key, { resource: suggest(m.name, resources, m.kinds, 1, m.category)[0] || null, chosen: false });
      }
      return out;
    }
    /**
     * How much of a resource a post holds, in the resource's own unit: the post's mass, its volume times the density or its area
     * times the mass per area for a resource counted in kilograms, its area for one counted in square metres; null otherwise.
     */
    function amountOf(post, r) {
      if (!r) return null;
      if (r.unit === 'kg') {
        if (post.mass !== null && post.mass !== undefined) return { amount: post.mass, basis: 'mass', mass: post.mass };
        if (post.volume !== null && post.volume !== undefined && r.density) return { amount: post.volume * r.density, basis: 'volume', mass: post.volume * r.density };
        if (post.area !== null && post.area !== undefined && r.areal) return { amount: post.area * r.areal, basis: 'area', mass: post.area * r.areal };
        return null;
      }
      if (r.unit === 'm²' && post.area !== null && post.area !== undefined) return { amount: post.area, basis: 'area', mass: r.areal ? post.area * r.areal : null };
      return null;
    }
    /**
     * GWP-GHG of every post in kg CO₂e: A1–A3 with the conservative or the typical value, A4 and A5 (the waste) where the database
     * gives them. @param {any[]} posts decide().posts @param {{db?: any, choices?: Record<string, string>, value?: 'conservative'|'typical'}} options
     */
    function compute(posts, options = {}) {
      const picked = resolve(materialsOf(posts), options.db, options.choices || {});
      const typical = options.value === 'typical';
      return posts.map((p) => {
        const choice = picked.get(p.key) || { resource: null, chosen: false };
        const r = choice.resource;
        const a = amountOf(p, r);
        const basis = a ? a.basis : (p.volume !== null ? 'volume' : p.area !== null ? 'area' : p.mass !== null ? 'mass' : null);
        let gwp = null;
        if (a) {
          const a13 = typical ? r.a1a3.typical : r.a1a3.conservative;
          gwp = { a1a3: typeof a13 === 'number' ? a.amount * a13 : null, a4: typeof r.a4 === 'number' ? a.amount * r.a4 : null, a5: typeof r.a5 === 'number' ? a.amount * r.a5 : null };
          gwp.total = (gwp.a1a3 || 0) + (gwp.a4 || 0) + (gwp.a5 || 0);
        }
        return Object.assign({}, p, { resource: r, chosen: choice.chosen, basis, mass: a ? a.mass : p.mass, gwp });
      });
    }

    // ---- the person's choices, kept in the browser for every model ------------------------------------------------------------
    /** Material key → resource id ('' for none). @returns {Promise<Record<string, string>>} */
    async function choices() { return Object.assign({}, (await idb.getSetting(CHOICES_KEY, null)) || {}); }
    /** GlobalId → category, for the elements the person has settled. @returns {Promise<Record<string, string>>} */
    async function settled() { return Object.assign({}, (await idb.getSetting(SETTLED_KEY, null)) || {}); }
    async function update(key, picks) {
      const all = Object.assign({}, (await idb.getSetting(key, null)) || {});
      for (const [k, v] of Object.entries(picks || {})) { if (v === null || v === undefined) delete all[k]; else all[k] = String(v); }
      await idb.setSetting(key, all);
      return all;
    }
    /** Choose resources for materials; null takes a choice back, so that the proposal applies again. @param {Record<string, string|null>} picks */
    const choose = (picks) => update(CHOICES_KEY, picks);
    /** Settle the category of elements by GlobalId; null hands them back to the rules. @param {Record<string, string|null>} picks */
    const settle = (picks) => update(SETTLED_KEY, picks);

    // ---- sums and tables ------------------------------------------------------------------------------------------------
    const round = (v, d = 3) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * Math.pow(10, d)) / Math.pow(10, d) : null);
    const col = (name, type) => ({ name, type, label: t('climate.col.' + name) });
    const categoryLabel = (c) => t('climate.cat.' + c);
    const layerLabel = (n) => (n ? t('climate.layer.' + n) : t('climate.cat.oklar'));
    /** How an element's category was reached: a rule, provisionally, not at all, or by the person. */
    const decision = (r) => t('climate.decision.' + (r.rule === 'person' ? 'person' : r.category === 'oklar' ? 'undecided' : r.uncertain ? 'uncertain' : 'rule'));
    /**
     * Sums per category (Boverket's four, their total, then not included and undecided) or per layer of the building. Provisional
     * categories count where they stand, and `uncertain` says how many of the elements are provisional.
     * @param {any[]} rows compute @param {'category'|'layer'} by
     */
    function summarize(rows, by) {
      const groups = by === 'layer' ? LAYERS.map(String).concat(['']) : CATEGORIES;
      const empty = (group, label) => ({ group, label, ids: new Set(), unsure: new Set(), posts: 0, withQuantity: 0, withResource: 0, a1a3: 0, a4: 0, a5: 0, total: 0 });
      const sums = new Map(groups.map((g) => [g, empty(g, by === 'layer' ? layerLabel(Number(g) || null) : categoryLabel(g))]));
      for (const r of rows) {
        const s = sums.get(by === 'layer' ? (r.layer ? String(r.layer) : '') : r.category);
        if (!s) continue;
        s.ids.add(r.id); if (r.uncertain) s.unsure.add(r.id); s.posts++;
        if (r.basis) s.withQuantity++;
        if (r.resource) s.withResource++;
        if (r.gwp) { s.a1a3 += r.gwp.a1a3 || 0; s.a4 += r.gwp.a4 || 0; s.a5 += r.gwp.a5 || 0; s.total += r.gwp.total; }
      }
      const list = groups.map((g) => sums.get(g));
      if (by !== 'layer') {
        const declared = empty('total', t('climate.cat.total'));
        for (const s of list.filter((x) => DECLARED.includes(x.group))) {
          s.ids.forEach((id) => declared.ids.add(id)); s.unsure.forEach((id) => declared.unsure.add(id));
          for (const k of ['posts', 'withQuantity', 'withResource', 'a1a3', 'a4', 'a5', 'total']) declared[k] += s[k];
        }
        list.splice(DECLARED.length, 0, declared);
      }
      const base = by === 'layer' ? list.reduce((s, x) => s + x.total, 0) : list.find((x) => x.group === 'total').total;
      return list.map((s) => ({ group: s.group, label: s.label, elements: s.ids.size, uncertain: s.unsure.size, posts: s.posts, withQuantity: s.withQuantity, withResource: s.withResource, a1a3: s.a1a3, a4: s.a4, a5: s.a5, total: s.total,
        share: base > 0 && (by === 'layer' || DECLARED.includes(s.group) || s.group === 'total') ? s.total / base * 100 : null }));
    }
    /** The sums as a table. @param {any[]} rows compute @param {'category'|'layer'} by */
    function summaryTable(rows, by) {
      return {
        columns: [col(by === 'layer' ? 'skikt' : 'kategori', 'text'), col('element', 'integer'), col('osakra', 'integer'), col('poster', 'integer'), col('med_mangd', 'integer'), col('med_resurs', 'integer'), col('a1_a3', 'number'), col('a4', 'number'), col('a5', 'number'), col('totalt', 'number'), col('andel', 'number')],
        rows: summarize(rows, by).map((s) => [s.label, s.elements, s.uncertain, s.posts, s.withQuantity, s.withResource, round(s.a1a3, 1), round(s.a4, 1), round(s.a5, 1), round(s.total, 1), round(s.share, 1)]),
      };
    }
    const UNIT = { volume: 'm³', area: 'm²', mass: 'kg' };
    /** Where the quantity a post is counted with came from, with its notes. */
    function sourceText(row) {
      const source = row.basis ? (row.sources && row.sources[row.basis]) || 'qto' : 'none';
      return [t('climate.source.' + source)].concat(source === 'extrusion' ? row.notes : row.notes.filter((n) => n === t('climate.source.shares'))).join(', ');
    }
    /** One row per element and material, as the dataset the tool saves. @param {any[]} rows compute */
    function elementTable(rows) {
      return {
        columns: [col('id', 'integer'), col('guid', 'text'), col('typ', 'text'), col('namn', 'text'), col('vaning', 'text'), col('typnamn', 'text'), col('material', 'text'), col('tjocklek_mm', 'number'),
          col('kategori', 'text'), col('beslut', 'text'), col('skikt', 'text'), col('regel', 'text'), col('mangd', 'number'), col('enhet', 'text'), col('mangdkalla', 'text'), col('resurs', 'text'), col('resurs_id', 'text'), col('val', 'text'),
          col('massa_kg', 'number'), col('a1_a3', 'number'), col('a4', 'number'), col('a5', 'number'), col('totalt', 'number')],
        rows: rows.map((r) => [r.id, r.guid, r.typ, r.namn, r.vaning, r.typnamn, r.label, r.thickness === null ? null : round(r.thickness * 1000, 1), categoryLabel(r.category), decision(r), layerLabel(r.layer), r.ruleText,
          r.basis ? round(r[r.basis]) : null, r.basis ? UNIT[r.basis] : null, sourceText(r), r.resource ? r.resource.name : null, r.resource ? String(r.resource.id) : null,
          r.resource ? t(r.chosen ? 'climate.choice.chosen' : 'climate.choice.proposal') : null, round(r.mass, 1), r.gwp ? round(r.gwp.a1a3) : null, r.gwp ? round(r.gwp.a4) : null, r.gwp ? round(r.gwp.a5) : null, r.gwp ? round(r.gwp.total) : null]),
      };
    }
    /** Whether the rules left an element to the person: undecided or provisional, or settled by the person. */
    const toSettle = (el) => el.rule === 'person' || el.category === 'oklar' || el.uncertain;
    /** The elements to settle, once each, with the category they count in now and the rule's reason. @param {any[]} elements decide().elements */
    function settleTable(elements) {
      const list = elements.filter(toSettle);
      return { columns: [col('id', 'integer'), col('guid', 'text'), col('typ', 'text'), col('namn', 'text'), col('vaning', 'text'), col('typnamn', 'text'), col('kategori', 'text'), col('beslut', 'text'), col('regel', 'text')],
        rows: list.map((e) => [e.id, e.guid, e.typ, e.namn, e.vaning, e.typnamn, categoryLabel(e.category), decision(e), e.ruleText]) };
    }
    /**
     * The elements to settle in groups the person can settle at once: the same class, type and rule. Each group says how many
     * elements it holds, the category they count in now, and the person's common choice ('' when none or mixed).
     * @param {any[]} elements decide().elements @param {Record<string, string>} settledNow
     * @returns {Array<{key: string, label: string, text: string, count: number, guids: string[], category: string, uncertain: boolean, choice: string}>}
     */
    function settleGroups(elements, settledNow) {
      const by = new Map();
      for (const el of elements.filter(toSettle)) {
        const key = [el.typ, el.typnamn || '', el.ruled.text].join('\u0001');
        let g = by.get(key);
        if (!g) { g = { key, label: [el.typ, el.typnamn].filter(Boolean).join(' · '), text: el.ruled.text, count: 0, guids: [], category: el.ruled.category, uncertain: el.ruled.uncertain, choices: new Set() }; by.set(key, g); }
        g.count++;
        if (el.guid) g.guids.push(el.guid);
        g.choices.add((el.guid && settledNow && settledNow[el.guid]) || '');
      }
      return Array.from(by.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, i18n.locale()))
        .map((g) => ({ key: g.key, label: g.label, text: g.text, count: g.count, guids: g.guids, category: g.category, uncertain: g.uncertain, choice: g.choices.size === 1 ? Array.from(g.choices)[0] : '' }));
    }

    // ---- reading a model dataset ----------------------------------------------------------------------------------------
    async function exec(id, sql) {
      const handle = await datasets.ensureOpen(id);
      const res = await handle.engine.exec(sql);
      return res[0] ? res[0].values : [];
    }
    /** Give the page a turn between batches, so that a large model never blocks it. */
    const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
    /**
     * Everything the tool reads from a model dataset: its elements with class, PredefinedType, IsExternal and LoadBearing (the
     * occurrence's before its type's), the element each belongs to and the one a door or window sits in, and the posts with their
     * quantities. The facts from the original file are read in the IFC reader's worker; a model without its file (geometry from
     * the server) has classes and properties only. An element made of parts is counted in its parts. Nothing is decided here.
     * `wholeProducts: false` counts doors and windows per material (the material inventory); `materialProps` are the materials'
     * own properties from the file (data/ifc-step.climate).
     * @param {string} id @param {{onProgress?: (share: number) => void, wholeProducts?: boolean}} [options]
     * @returns {Promise<{elements: any[], posts: any[], containers: number, hasFile: boolean, materialProps: any[][]}>}
     */
    async function gather(id, options = {}) {
      const rows = await exec(id, "select id, guid, typ, namn, vaning, typnamn from data where kategori = 'byggdel' order by id");
      const props = new Map();
      for (const [eid, name, value, source] of await exec(id, "select id, namn, varde, kalla from _properties where namn in ('LoadBearing', 'IsExternal') and uppsattning like 'Pset%Common'")) {
        const p = props.get(eid) || {};
        // The occurrence's value goes before its type's.
        if (p[name] === undefined || (source === 'objekt' && p[name + ':typ'])) { p[name] = bool(value); p[name + ':typ'] = source !== 'objekt'; }
        props.set(eid, p);
      }
      const qtos = new Map();
      for (const [eid, name, value, slag] of await exec(id, "select id, namn, varde, slag from _quantities where slag in ('area', 'volym', 'vikt')")) {
        const list = qtos.get(eid) || [];
        list.push([name, value, slag]);
        qtos.set(eid, list);
      }
      const original = await model.original(id).catch(() => null);
      const facts = new Map();
      let materialProps = [];
      if (original) {
        const out = await step.climate(original.bytes, { onProgress: options.onProgress });
        for (const f of out.elements) facts.set(f[0], { predefined: f[1], typePredefined: f[2], materials: f[3], overall: f[4], volume: f[5], clipped: f[6], geometry: f[7], parent: f[8], hasParts: f[9], openings: f[10], host: f[11] });
        materialProps = out.materialProps || [];
      }
      const postOptions = { whole: options.wholeProducts !== false };
      const elements = []; const posts = []; let containers = 0;
      for (let i = 0; i < rows.length; i++) {
        const [eid, guid, typ, namn, vaning, typnamn] = rows[i];
        const fact = facts.get(eid) || null;
        const p = props.get(eid) || {};
        const el = { id: eid, guid, typ, cls: typ, namn, vaning, typnamn, predefined: fact ? predefinedOf(fact.predefined, fact.typePredefined) : null,
          external: p.IsExternal === undefined ? null : p.IsExternal, loadBearing: p.LoadBearing === undefined ? null : p.LoadBearing,
          parent: fact ? fact.parent : null, host: fact ? fact.host : null, hasParts: !!(fact && fact.hasParts) };
        elements.push(el);
        if (el.hasParts) containers++;
        else for (const post of postsOf(el, quantitiesOf(el.cls, qtos.get(eid), fact), fact ? fact.materials : null, postOptions)) posts.push(Object.assign(post, { id: eid, guid, typ, namn, vaning, typnamn }));
        if (i % 2000 === 1999) await pause();
      }
      return { elements, posts, containers, hasFile: !!original, materialProps };
    }

    return { CATEGORIES, DECLARED, LAYERS, RULES, SERVICES, MATERIAL_GROUPS, classify, predefinedOf, bool, externalFromTopology, decide, quantitiesOf, postsOf, materialKey, typeKey, kindsOf, compatible, groupsOf, score, suggest, materialsOf, resolve, amountOf, compute,
      choices, choose, settled, settle, summarize, summaryTable, elementTable, settleTable, settleGroups, gather, round };
  });
})();
