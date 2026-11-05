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
  D.define('data/kinds', ['ui/i18n'], (i18n) => {
    const t = D.t;
    const n = (x) => i18n.formatNumber(x || 0);
    const isDxf = (ds) => !!(ds && ds.model && ds.model.format === 'dxf');
    const planKind = (ds) => (ds.plan && ds.plan.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan');
    const pagesOf = (ds) => (Array.isArray(ds.documents) ? ds.documents : []).reduce((s, d) => s + (Number(d.pages) || 0), 0);
    const picturesOf = (ds) => (ds.images && ds.images.count ? ds.images.count : ds.rowCount || 0);

    /** How a hit in a kind's table is found again in its own view. `value` reads a column of the hit. */
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
    };

    /** @param {{kind?: string}|string|null|undefined} ds a dataset or the name of a kind @returns {any} its profile */
    function of(ds) {
      const kind = typeof ds === 'string' ? ds : ds && ds.kind;
      return PROFILES[kind] || PROFILES.table;
    }
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
        default: return [t('common.rows', { n: n(ds.rowCount) }), t('common.columns', { n: ds.columnCount || 0 })];
      }
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
        ds.kind === 'model' && ds.model && !isDxf(ds) && ds.model.project ? { label: t('model.field.project'), value: ds.model.project } : null,
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
      ].filter(Boolean);
    }

    return { PROFILES, of, isCollection, summary, guarded, badges, facts, isDxf };
  });
})();
