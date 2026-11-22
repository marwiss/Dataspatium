// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What each kind of dataset is, in one place, so that the modes ask rather than test `ds.kind` themselves: its mark and its
 * own view, the tab Analysera opens in, how it counts itself, which columns its view needs, which side tables it has, where
 * a search hit in it lives and how it is checked. A new kind of data is a new entry here plus its views. Everything a table
 * can also be used as (a map, a time series) is a facet, in data/facets, because that depends on the data and not the kind.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/kinds', ['ui/i18n', 'platform/tier'], (i18n, tier) => {
    const t = D.t;
    const n = (x) => i18n.formatNumber(x || 0);
    const isDxf = (ds) => !!(ds && ds.model && ds.model.format === 'dxf');
    const planKind = (ds) => (ds.plan && ds.plan.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan');
    const pagesOf = (ds) => (Array.isArray(ds.documents) ? ds.documents : []).reduce((s, d) => s + (Number(d.pages) || 0), 0);
    const picturesOf = (ds) => (ds.images && ds.images.count ? ds.images.count : ds.rowCount || 0);
    /**
     * The sizes up to which a raster keeps its original files, one file and a dataset's together (B-64). data/raster's limits
     * start from them, and the facts name them.
     */
    const RASTER_KEEP = { file: 32e6, total: 40e6 };
    /** A raster's files as data/raster describes them in `_meta.raster`; none when the facts are missing. */
    const rasterFiles = (ds) => (ds && ds.raster && Array.isArray(ds.raster.files) ? ds.raster.files : []);
    /**
     * The union of a raster's placed files, [west, south, east, north] from their previews' corners; null when none has a place.
     * @param {Array<{preview?: {bounds?: number[][]|null}}>} files `_meta.raster.files` @returns {number[]|null}
     */
    function rasterExtent(files) {
      const boxes = (files || []).map((f) => (f && f.preview && Array.isArray(f.preview.bounds) ? f.preview.bounds : null)).filter(Boolean).map((b) => [b[0][1], b[1][0], b[1][1], b[0][0]]);
      return boxes.length ? [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))] : null;
    }
    /** Ground metres per pixel in three significant digits. */
    const metres = (r) => i18n.formatNumber(r, { maximumSignificantDigits: 3 });
    /** How many files a raster has: the rows of its table, which is the list of its files (a row removed there takes its file away). */
    const rasterCount = (ds) => (typeof ds.rowCount === 'number' ? ds.rowCount : rasterFiles(ds).length);
    /** A raster's summary in parts: its files and, when the first file has one, its resolution. */
    function rasterParts(ds) {
      const files = rasterFiles(ds);
      const r = files[0] ? Number(files[0].resolution) : 0;
      return [t('raster.files.n', { n: n(rasterCount(ds)) }), r > 0 ? t('raster.resolution', { r: metres(r) }) : ''].filter(Boolean);
    }

    /**
     * What each kind is: its mark, its own view in Bearbeta, the tab Analysera opens in, its chart in Visualisera, its side tables,
     * what its `_files` hold, its picture in Hantera, the export that carries it whole, what a table export of it loses, the columns
     * its view cannot do without (`protect`) and how a hit in its table is found again in its own view (`hit`; `value` reads a
     * column of the hit). `derived` names the sorts of `_files` the app made itself, which a copy without the originals keeps;
     * `mapLayer` says how viz/leaflet draws the kind on maps; `checks: 'table'` has Kontrollera check it as a table.
     */
    const PROFILES = {
      table: {
        icon: 'table', view: null, tab: 'stats', chart: null, sideTables: [],
        summary: (ds) => `${t('common.rows', { n: n(ds.rowCount) })} · ${t('common.columns', { n: ds.columnCount || 0 })}`,
        hit: null,
      },
      document: {
        icon: 'file-text', view: 'document', tab: 'text', chart: null, sideTables: [], files: 'originals', loses: 'export.loses.document',
        picture: 'page', wholeFormat: 'document-originals',
        // What it takes to make one collection of several: the column that names a file, and the sorts of files kept.
        merge: { as: 'documents', column: 'dokument', files: ['original'] },
        versionDiff: [{ label: 'versions.own.documents', table: 'data', column: 'dokument' }],
        open: { label: 'hantera.read', hint: 'hantera.read.hint', icon: 'book-open' },
        protect: () => ['dokument', 'sida', 'stycke', 'text'],
        summary: (ds) => `${t('document.files.n', { n: n((ds.documents || []).length) })} · ${t('document.pages.n', { n: n(pagesOf(ds)) })}`,
        hit: (value, id) => ({ label: 'soka.open.document', icon: 'book-open', store: { openDocument: { datasetId: id, document: value('dokument'), page: value('sida') } } }),
      },
      images: {
        icon: 'images', view: 'images', tab: 'images', chart: null, sideTables: [], files: 'pictures', loses: 'export.loses.images',
        // The page in Hantera shows the pictures themselves.
        picture: 'none', wholeFormat: 'images-zip',
        merge: { as: 'images', column: 'fil', files: ['preview', 'thumb'] },
        versionDiff: [{ label: 'versions.own.pictures', table: 'data', column: 'fil' }],
        open: { label: 'hantera.view.images', hint: 'hantera.view.images.hint', icon: 'images' },
        protect: () => ['fil'],
        summary: (ds) => t('datasets.sub.images', { n: n(picturesOf(ds)) }),
        hit: (value, id) => ({ label: 'soka.open.image', icon: 'images', store: { openImage: { datasetId: id, name: value('fil') } } }),
      },
      plan: {
        icon: 'layers', view: 'plan', tab: 'plan', chart: 'map', sideTables: [], files: 'originals', picture: 'map', wholeFormat: 'geojson',
        open: { label: 'hantera.view.plan', hint: 'hantera.view.plan.hint', icon: 'layers' },
        protect: () => ['objektid', 'objekttyp', 'geometri', 'tema'],
        summary: (ds) => `${t('plan.slag.' + planKind(ds))} · ${t('plan.objects.n', { n: n(ds.rowCount) })}`,
        hit: (value, id) => ({ label: 'soka.open.plan', icon: 'layers', store: { openPlanObject: { datasetId: id, objektid: value('objektid') } } }),
      },
      graph: {
        icon: 'share-2', view: 'graph', tab: 'graph', chart: 'graph', sideTables: ['_edges', '_layout'], chartTables: ['_edges'], files: 'originals', cypher: true, noStats: true, loses: 'export.loses.graph',
        picture: 'network', wholeFormat: 'graphml',
        versionDiff: [{ label: 'versions.own.nodes', table: 'data', column: 'id' }, { label: 'versions.own.edges', table: '_edges', column: 'id' }],
        // A word on an edge finds the nodes at both ends.
        sideSearch: { table: '_edges', columns: ['typ', 'egenskaper'], keys: ['kalla', 'mal'], on: 'id' },
        open: { label: 'hantera.view.graph', hint: 'hantera.view.graph.hint', icon: 'share-2' },
        protect: () => ['id', 'etikett', 'namn', 'egenskaper'],
        summary: (ds) => `${t('graph.nodes.n', { n: n(ds.rowCount) })} · ${t('graph.edges.n', { n: n(ds.graph && ds.graph.edges) })}`,
        hit: (value, id) => ({ label: 'soka.open.node', icon: 'share-2', store: { openNode: { datasetId: id, id: value('id'), data: { id: value('id'), etikett: value('etikett'), namn: value('namn'), egenskaper: value('egenskaper') } } } }),
      },
      model: {
        icon: 'box', view: 'model', tab: 'model', chart: 'model', sideTables: ['_properties', '_quantities', '_entities'], chartTables: ['_properties', '_quantities'], files: 'originals', loses: 'export.loses.model',
        picture: 'model', wholeFormat: 'model-original',
        versionDiff: [{ label: 'versions.own.elements', table: 'data', column: 'id' }],
        // A word in a property set finds the element that has it.
        sideSearch: { table: '_properties', columns: ['uppsattning', 'namn', 'varde'], keys: ['id'], on: 'id' },
        open: { label: 'hantera.view.model', hint: 'hantera.view.model.hint', icon: 'box' },
        protect: (ds) => (isDxf(ds) ? ['id', 'typ', 'lager'] : ['id', 'guid', 'typ']),
        summary: (ds) => (isDxf(ds) ? t('model.entities.n', { n: n(ds.rowCount) }) : t('model.elements.n', { n: n(ds.model && ds.model.elements ? ds.model.elements : ds.rowCount) })),
        hit: (value, id) => ({ label: 'soka.open.element', icon: 'box', store: { openElement: { datasetId: id, id: value('id') } } }),
      },
      raster: {
        icon: 'image', view: 'map', tab: 'sql', chart: 'map', sideTables: [], files: 'originals',
        // The sorts of _files the app made itself from the originals: a copy that leaves the originals out keeps them (data/share-scan).
        derived: ['preview', 'thumb'],
        // How viz/leaflet draws the kind on maps: its pictures, not features.
        mapLayer: 'raster',
        // Kontrollera checks its table of files as it checks a table.
        checks: 'table',
        loses: 'export.loses.raster', picture: 'raster', wholeFormat: 'raster-original',
        versionDiff: [{ label: 'versions.own.rasters', table: 'data', column: 'fil' }],
        open: { label: 'hantera.view.raster', hint: 'hantera.view.raster.hint', icon: 'map' },
        protect: () => ['fil', 'geometri'],
        summary: (ds) => rasterParts(ds).join(' · '),
        hit: (value, id) => ({ label: 'soka.open.raster', icon: 'map', store: { openRaster: { datasetId: id, name: value('fil') } } }),
      },
    };

    /** @param {{kind?: string}|string|null|undefined} ds a dataset or the name of a kind @returns {any} its profile */
    function of(ds) {
      const kind = typeof ds === 'string' ? ds : ds && ds.kind;
      return PROFILES[kind] || PROFILES.table;
    }
    /**
     * Whether the tier in effect shows a kind's own views and tools (platform/tier, the entry `kind:<kind>`); when it does not,
     * the dataset is kept and shows as a table.
     * @param {{kind?: string}|string|null|undefined} ds @returns {boolean}
     */
    const shown = (ds) => tier.shows('kind:' + ((typeof ds === 'string' ? ds : ds && ds.kind) || 'table'));
    /** @param {any} ds @returns {string|null} the kind's own view where the tier shows it, else null (the table) */
    const ownView = (ds) => (shown(ds) ? of(ds).view : null);
    /** @param {any} ds @returns {string} the Analysera tab a kind opens in where the tier shows it, else the statistics */
    const ownTab = (ds) => (shown(ds) ? of(ds).tab : PROFILES.table.tab);
    /** True for anything that is more than a table; such a dataset counts itself in its own units. */
    const isCollection = (ds) => of(ds) !== PROFILES.table;
    /** @param {any} ds @returns {string} one line about its size, in its own units */
    const summary = (ds) => of(ds).summary(ds);
    /** @param {any} ds @returns {string[]} columns its own view cannot do without */
    const guarded = (ds, columns) => (of(ds).protect ? of(ds).protect(ds) : []).filter((name) => columns.some((c) => c.name === name));

    /** Parts of the summary as separate labels. */
    function badges(ds) {
      switch (of(ds)) {
        case PROFILES.document: return [t('document.files.n', { n: n((ds.documents || []).length) }), t('document.pages.n', { n: n(pagesOf(ds)) })];
        case PROFILES.images: return [t('gallery.count', { n: n(picturesOf(ds)) })];
        case PROFILES.plan: return [t('plan.slag.' + planKind(ds)), t('plan.objects.n', { n: n(ds.rowCount) })];
        case PROFILES.graph: return [t('graph.nodes.n', { n: n(ds.rowCount) }), t('graph.edges.n', { n: n(ds.graph && ds.graph.edges) })];
        case PROFILES.model: return [summary(ds)];
        case PROFILES.raster: return rasterParts(ds);
        default: return [t('common.rows', { n: n(ds.rowCount) }), t('common.columns', { n: ds.columnCount || 0 })];
      }
    }

    /**
     * A raster's facts from `_meta.raster`: its files (when more than one, or when some were left out: those that could not be read
     * apart from those over the number a raster holds), system, resolution, pixels, bands and data type, what became of the
     * originals and the attribution with the licence. Values the files share are said once; differing ones are listed.
     * @param {any} ds @returns {Array<{label: string, value: string}>}
     */
    function rasterFacts(ds) {
      const r = ds.raster || {};
      const files = rasterFiles(ds);
      const left = Array.isArray(r.skipped) ? r.skipped.filter(Boolean) : [];
      const many = left.filter((s) => s.code === 'many');
      const skipped = [left.length > many.length ? t('images.skipped', { n: n(left.length - many.length) }) : '',
        many.length ? t('raster.skipped.many', { n: n(many.length), max: n(Number(many[0].max) || 0) }) : ''].filter(Boolean).join('; ');
      const count = rasterCount(ds);
      const each = (fn) => Array.from(new Set(files.map(fn).filter(Boolean))).join(', ');
      const res = files.map((f) => Number(f.resolution)).filter((x) => x > 0);
      const lo = Math.min(...res); const hi = Math.max(...res);
      const system = (f) => (f.crsSource === 'assumed' ? t('raster.crs.assumed', { crs: f.crsText || f.crs }) : f.crsText || f.crs || t('raster.crs.none'));
      const kept = (f) => t('raster.kept.' + (f.kept === 'original' ? 'original' : f.skipped || 'view'), { max: i18n.formatBytes(f.skipped === 'total' ? RASTER_KEEP.total : RASTER_KEEP.file) });
      const counts = new Map();
      for (const f of files) { const text = kept(f); counts.set(text, (counts.get(text) || 0) + 1); }
      const licence = r.license && r.license.name ? String(r.license.name) : '';
      const credit = r.attribution ? String(r.attribution) + (licence ? ` (${licence})` : '') : licence;
      return [
        count > 1 || skipped ? { label: t('raster.field.files'), value: n(count) + (skipped ? ` (${skipped})` : '') } : null,
        { label: t('raster.field.crs'), value: each(system) },
        res.length ? { label: t('raster.field.resolution'), value: t('raster.resolution', { r: lo === hi ? metres(lo) : `${metres(lo)}–${metres(hi)}` }) } : null,
        { label: t('raster.field.size'), value: each((f) => (f.width && f.height ? `${n(f.width)} × ${n(f.height)}` : '')) },
        { label: t('raster.field.bands'), value: each((f) => (f.bands ? `${n(f.bands)} · ${f.format || 'uint'}${f.bits || 8}` : '')) },
        { label: t('raster.field.original'), value: Array.from(counts, ([text, c]) => (files.length > 1 ? `${text} (${n(c)})` : text)).join('; ') },
        { label: t('raster.field.attribution'), value: credit },
      ].filter((x) => x && x.value);
    }

    /**
     * The facts about a dataset that only make sense for its kind, for the overview in Hantera.
     * @param {any} ds @returns {Array<{label: string, value: any}>}
     */
    function facts(ds) {
      const pl = ds.kind === 'plan' ? ds.plan || {} : null;
      const gr = ds.kind === 'graph' ? ds.graph || {} : null;
      const collection = isCollection(ds);
      return [
        collection ? { label: t('datasets.kind'), value: pl ? t('plan.slag.' + (pl.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan')) : t('datasets.kind.' + ds.kind) } : null,
        ds.kind === 'model' && isDxf(ds) ? { label: t('model.field.entities'), value: i18n.formatNumber(ds.rowCount || 0) } : null,
        ds.kind === 'model' && isDxf(ds) ? { label: t('model.layers'), value: i18n.formatNumber((ds.model.layers || []).length) } : null,
        ds.kind === 'model' && ds.model && !isDxf(ds) ? { label: t('model.field.format'), value: ds.model.schema || 'IFC' } : null,
        ds.kind === 'model' && ds.model && ds.model.geometry === 'server' ? { label: t('model.field.geometry'), value: t('model.source.server.' + (ds.model.lod === 'box' ? 'box' : 'full')) } : null,
        ds.kind === 'model' && ds.model && !isDxf(ds) && ds.model.project ? { label: t('model.field.project'), value: ds.model.project } : null,
        ds.kind === 'model' && ds.model && Array.isArray(ds.model.parties) && ds.model.parties[0] && ds.model.parties[0].organization ? { label: t('model.field.party'), value: ds.model.parties[0].organization } : null,
        ds.kind === 'model' && ds.model && !isDxf(ds) ? { label: t('model.field.elements'), value: i18n.formatNumber(ds.model.elements || 0) } : null,
        ds.kind === 'model' && ds.model && !isDxf(ds) ? { label: t('model.field.storeys'), value: (ds.model.storeys || []).map((x) => x.name).join(', ') } : null,
        gr ? { label: t('graph.nodes'), value: i18n.formatNumber(ds.rowCount || 0) } : null,
        gr ? { label: t('graph.edges'), value: i18n.formatNumber(gr.edges || 0) } : null,
        gr && gr.labels && gr.labels.length ? { label: t('graph.labels'), value: gr.labels.slice(0, 12).map((l) => `${l.name || t('graph.nolabel')} (${i18n.formatNumber(l.count)})`).join(', ') } : null,
        gr && gr.types && gr.types.length ? { label: t('graph.types'), value: gr.types.slice(0, 12).map((l) => `${l.name || t('graph.notype')} (${i18n.formatNumber(l.count)})`).join(', ') } : null,
        pl && pl.beteckning ? { label: t('plan.field.beteckning'), value: pl.beteckning } : null,
        pl && (pl.kommun || pl.kommunkod) ? { label: t('plan.field.kommun'), value: [pl.kommun, pl.kommunkod].filter(Boolean).join(' ') } : null,
        pl && pl.status ? { label: t('plan.field.status'), value: pl.status } : null,
        pl && pl.datumLagakraft ? { label: t('plan.field.lagakraft'), value: pl.datumLagakraft } : null,
        pl ? { label: t('plan.field.objects'), value: i18n.formatNumber(ds.rowCount || 0) } : null,
        ds.kind === 'document' && Array.isArray(ds.documents) ? { label: t('document.files'), value: `${i18n.formatNumber(ds.documents.length)} · ${t('document.pages.n', { n: i18n.formatNumber(ds.documents.reduce((n, d) => n + (d.pages || 0), 0)) })}` } : null,
        ds.kind === 'document' ? { label: t('document.paragraphs'), value: i18n.formatNumber(ds.rowCount || 0) } : null,
        ds.kind === 'images' && ds.images ? { label: t('images.count'), value: i18n.formatNumber(ds.images.count || 0) + (ds.images.skipped && ds.images.skipped.length ? ` (${t('images.skipped', { n: ds.images.skipped.length })})` : '') } : null,
        ...(ds.kind === 'raster' ? rasterFacts(ds) : []),
      ].filter(Boolean);
    }

    return { PROFILES, RASTER_KEEP, of, isCollection, summary, guarded, badges, facts, isDxf, shown, ownView, ownTab, rasterExtent };
  });
})();
