// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Plan view in Bearbeta for datasets of kind "plan": a detailed development plan drawn as a plan map (uses filled
 * with Boverket's colours, property and administrative provisions as outlines, designations as labels, the plan
 * boundary on top) or a comprehensive plan by theme, with zoom and pan, an optional background map after consent,
 * the provisions listed in the inspector and the clicked provision explained from the embedded catalogue. The
 * dataset itself is always the table of plan objects; the table is one click away.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-view', ['ui/base', 'data/datasets', 'data/plan', 'data/plan-catalog', 'data/geo', 'viz/leaflet', 'viz/charts', 'viz/data', 'platform/files'], (base, datasets, plan, catalog, geo, leaflet, charts, vizData, files) => {
    const { h, t, i18n, replace } = base;
    const MAX_ROWS = 20000;
    const OUTLINE_STYLES = {
      planomrade: { color: '#111111', weight: 3, dashArray: null, fillOpacity: 0 },
      egenskap: { color: '#1f6fb2', weight: 1.5, dashArray: '6 4', fillOpacity: 0 },
      administrativ: { color: '#8a3ffc', weight: 1.5, dashArray: '2 4', fillOpacity: 0 },
      overgang: { color: '#777c84', weight: 1.2, dashArray: '1 4', fillOpacity: 0 },
      annan: { color: '#4a4f57', weight: 1, dashArray: '4 4', fillOpacity: 0 },
    };

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{onTable: () => void}} options
     */
    function create(ctx, options) {
      const { ui, shell, store } = ctx;
      const s = { id: null, basemap: 'none', labels: true, hidden: new Set(), selected: null, rows: [], info: null, slag: 'detaljplan', updatedAt: null };
      let ds = null; let slots = null; let mapEl = null; let handle = null; let seq = 0; let groups = []; let labelLayer = null; let L = null;

      /** Read the plan's rows (objects) and facts. */
      async function load(dataset) {
        ds = dataset;
        s.info = dataset.plan || {};
        s.slag = s.info.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan';
        if (s.id !== dataset.id) { s.id = dataset.id; s.selected = null; s.hidden = new Set(); s.basemap = 'none'; }
        if (s.updatedAt === dataset.updatedAt && s.rows.length) return;
        const columns = await datasets.columns(dataset.id);
        const data = await vizData.fetchRows(dataset.id, { fields: columns.map((c) => c.name), limit: MAX_ROWS });
        s.rows = data.rows.map((r, i) => Object.assign({ _i: i }, r));
        s.updatedAt = dataset.updatedAt;
      }
      /** Grouping key of a row: object type for a detailed plan, theme for a comprehensive plan. */
      const keyOf = (row) => (s.slag === 'oversiktsplan' ? (row.tema || 'omrade') : (row.objekttyp || 'annan'));
      function groupKeys() {
        if (s.slag === 'detaljplan') return plan.OBJECT_TYPES.filter((typ) => s.rows.some((r) => r.objekttyp === typ));
        const seen = []; for (const r of s.rows) { const k = keyOf(r); if (!seen.includes(k)) seen.push(k); }
        return seen.sort((a, b) => (a === 'markochvattenanvandning' ? -1 : b === 'markochvattenanvandning' ? 1 : a.localeCompare(b, 'sv')));
      }
      function groupLabel(key) {
        if (s.slag === 'detaljplan') return t('plan.type.' + key);
        return D.require('ui/i18n').has('plan.theme.' + key) ? t('plan.theme.' + key) : key;
      }
      function styleFor(row) {
        if (s.slag === 'oversiktsplan') {
          const fill = plan.opFillOf(row);
          return { color: '#3b3f46', weight: row.tema === 'plangeometri' ? 2.5 : 1, fillColor: fill, fillOpacity: row.tema === 'markochvattenanvandning' ? 0.6 : (row.tema === 'plangeometri' || row.tema === 'omrade' ? 0 : 0.35), dashArray: row.tema === 'omrade' ? '6 4' : null };
        }
        if (row.objekttyp === 'anvandning') return { color: '#4a4f57', weight: 1, fillColor: plan.fillOf(row) || '#dadde1', fillOpacity: 0.6, dashArray: null };
        const o = OUTLINE_STYLES[row.objekttyp] || OUTLINE_STYLES.annan;
        return { color: o.color, weight: o.weight, fillColor: o.color, fillOpacity: o.fillOpacity, dashArray: o.dashArray };
      }
      const labelText = (row) => (s.slag === 'oversiktsplan' ? (row.tema === 'markochvattenanvandning' ? row.innehallstyp : row.namn) : row.beteckning);

      /**
       * @param {any} dataset @param {{center: HTMLElement, right: HTMLElement}} target
       */
      async function render(dataset, target) {
        slots = target;
        const my = ++seq;
        try { await load(dataset); } catch (err) { replace(target.center, h('p', { class: 'dm-error', text: String((err && err.message) || err) })); return; }
        if (my !== seq || !slots) return;
        const basemapSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('map.basemap'), inline: true }));
        basemapSel.options = [{ value: 'none', label: t('map.basemap.none') }, { value: 'osm', label: t('map.basemap.osm') }];
        basemapSel.value = s.basemap;
        basemapSel.addEventListener('change', () => { s.basemap = basemapSel.value; draw(); });
        const labels = /** @type {any} */ (h('dm-switch', { label: t('plan.labels') }));
        labels.checked = s.labels;
        labels.addEventListener('change', () => { s.labels = labels.checked; updateLabels(); });
        mapEl = h('div', { class: 'dm-map-view dm-plan-view dm-center-fill', 'aria-label': t('plan.view') });
        const info = s.info || {};
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('layers', 20), dataset.name, ' ', h('dm-badge', { text: t('plan.slag.' + s.slag) }), info.land && info.land !== 'SE' ? h('dm-badge', { text: t('plan.land.' + info.land) }) : null, info.status ? h('dm-badge', { kind: /laga kraft|antagen|vedtaget|í gildi|voimassa|^13$/i.test(info.status) ? 'ok' : 'accent', text: info.status }) : null),
            h('div', { class: 'dm-toolbar' }, basemapSel, labels,
              ui.button({ label: t('map.fit'), icon: 'scan-line', 'icon-only': true, title: t('map.fit.hint'), onClick: fit }),
              ui.button({ label: t('map.save.chart'), icon: 'save', title: t('plan.save.chart.hint'), onClick: saveChart }),
              s.slag === 'detaljplan' ? ui.button({ label: t('plan.provisions.export'), icon: 'file-text', title: t('plan.provisions.export.hint'), onClick: exportProvisions }) : null,
              ui.button({ label: t('bearbeta.view.table'), icon: 'table', title: t('bearbeta.view.table.hint'), onClick: options.onTable }))),
          mapEl);
        await draw();
        renderInspector();
      }

      async function draw() {
        if (!mapEl || !ds) return;
        const my = ++seq;
        if (handle) { handle.finalize(); handle = null; }
        groups = []; labelLayer = null;
        mapEl.replaceChildren();
        try {
          L = await leaflet.ensure();
          // The shared map setup (consent-gated background map) with no dataset layers; the plan objects are drawn here.
          const hd = await leaflet.render(mapEl, { kind: 'map', name: ds.name, map: { layers: [], basemap: s.basemap, custom: { url: '', attribution: '' }, legend: false } }, {});
          if (my !== seq) { hd.finalize(); return; }
          handle = hd;
          if (hd.info.basemapDenied) ui.toast.show(t('map.basemap.denied'), { kind: 'warn' });
          for (const key of groupKeys()) {
            const rows = s.rows.filter((r) => keyOf(r) === key && r.geometri);
            if (!rows.length) continue;
            const features = rows.map((r) => ({ type: 'Feature', geometry: geo.parseGeometry(r.geometri), properties: { _i: r._i } })).filter((f) => f.geometry && f.geometry.type);
            const group = L.geoJSON({ type: 'FeatureCollection', features }, {
              style: (f) => Object.assign({ fill: true }, styleFor(s.rows[f.properties._i])),
              pointToLayer: (f, latlng) => { const st = styleFor(s.rows[f.properties._i]); return L.circleMarker(latlng, { radius: 6, color: st.color, fillColor: st.fillColor, weight: st.weight, fillOpacity: Math.max(0.7, st.fillOpacity) }); },
              onEachFeature: (f, lyr) => { lyr.on('click', () => { s.selected = s.rows[f.properties._i]; renderInspector(); highlight(lyr); }); },
            });
            if (!s.hidden.has(key)) group.addTo(hd.map);
            groups.push({ key, group, count: rows.length });
          }
          updateLabels();
          fit();
          openPending();
          renderInspector();
        } catch (err) {
          if (my !== seq) return;
          replace(mapEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
          shell.log(String((err && err.message) || err), 'error');
        }
      }
      let highlighted = null;
      function highlight(lyr) {
        if (highlighted && highlighted.setStyle && highlighted._dmStyle) highlighted.setStyle(highlighted._dmStyle);
        if (lyr && lyr.setStyle) { lyr._dmStyle = Object.assign({}, lyr.options); lyr.setStyle({ weight: 4, color: '#e63946' }); highlighted = lyr; if (lyr.bringToFront) lyr.bringToFront(); }
      }
      /** A search hit: the plan object chosen and in view. */
      function openPending() {
        const pending = ctx.store.get().openPlanObject;
        if (!pending || !s.id || pending.datasetId !== s.id) return;
        ctx.store.set({ openPlanObject: null });
        const row = s.rows.find((r) => String(r.objektid) === String(pending.objektid));
        if (!row) return;
        s.selected = row;
        for (const g of groups) {
          g.group.eachLayer((lyr) => {
            if (!lyr.feature || lyr.feature.properties._i !== row._i) return;
            highlight(lyr);
            if (handle && lyr.getBounds) handle.map.fitBounds(lyr.getBounds(), { maxZoom: 16 });
            else if (handle && lyr.getLatLng) handle.map.setView(lyr.getLatLng(), 16);
          });
        }
        renderInspector();
      }
      /** Designation labels at the centre of every visible object (the plan boundary excluded). */
      function updateLabels() {
        if (!handle || !L) return;
        if (labelLayer) { handle.map.removeLayer(labelLayer); labelLayer = null; }
        if (!s.labels) return;
        const markers = [];
        for (const g of groups) {
          if (s.hidden.has(g.key) || g.key === 'planomrade' || g.key === 'plangeometri') continue;
          g.group.eachLayer((lyr) => {
            const row = s.rows[lyr.feature.properties._i];
            const text = labelText(row);
            if (!text) return;
            const center = lyr.getBounds ? lyr.getBounds().getCenter() : (lyr.getLatLng ? lyr.getLatLng() : null);
            if (!center) return;
            const el = document.createElement('span'); el.className = 'dm-plan-label' + (row.objekttyp === 'anvandning' || row.tema === 'markochvattenanvandning' ? ' dm-plan-label-use' : ''); el.textContent = String(text);
            markers.push(L.marker(center, { icon: L.divIcon({ className: 'dm-plan-label-wrap', html: el, iconSize: null }), interactive: false, keyboard: false }));
          });
        }
        labelLayer = L.layerGroup(markers).addTo(handle.map);
      }
      function fit() {
        if (!handle || !L) return;
        let bounds = null;
        for (const g of groups) { const b = g.group.getBounds(); if (b && b.isValid()) bounds = bounds ? bounds.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast()); }
        if (bounds) handle.map.fitBounds(bounds, { padding: [16, 16], maxZoom: 18, animate: false });
      }
      function toggleGroup(key, visible) {
        if (visible) s.hidden.delete(key); else s.hidden.add(key);
        const g = groups.find((x) => x.key === key);
        if (g && handle) { if (visible) g.group.addTo(handle.map); else handle.map.removeLayer(g.group); }
        updateLabels();
      }

      /** Save the plan as a map chart for Visualisera: uses coloured by Boverket's colour names, the rest as outlines. */
      async function saveChart() {
        const name = await ui.dialog.prompt(t('viz.name'), { title: t('map.save.chart'), value: t('map.chart.default', { name: ds.name }) });
        if (!name) return;
        try {
          const cols = await datasets.columns(ds.id);
          const record = charts.create('map', ds, name.trim());
          const def = leaflet.defaultMap(cols, ds);
          const colorValues = {};
          for (const [k, v] of Object.entries(catalog.COLORS)) colorValues[k.charAt(0).toUpperCase() + k.slice(1)] = v;
          if (s.slag === 'detaljplan') {
            const uses = leaflet.layerFor(cols, ds, 0); uses.name = t('plan.type.anvandning'); uses.filters = [{ field: 'objekttyp', op: '=', value: 'anvandning' }]; uses.colorBy = { column: 'farg', mode: 'category', values: colorValues }; uses.label = 'beteckning'; uses.popup = ['beteckning', 'formulering', 'kategori']; uses.style = Object.assign(uses.style, { weight: 1, fillOpacity: 0.6 });
            const outlines = leaflet.layerFor(cols, ds, 1); outlines.name = t('plan.layer.outlines'); outlines.filters = [{ field: 'objekttyp', op: '!=', value: 'anvandning' }]; outlines.colorBy = { column: 'objekttyp', mode: 'category', values: { planomrade: '#111111', egenskap: '#1f6fb2', administrativ: '#8a3ffc', overgang: '#777c84' } }; outlines.label = 'beteckning'; outlines.popup = ['beteckning', 'formulering', 'kategori']; outlines.style = Object.assign(outlines.style, { weight: 1.5, fillOpacity: 0.05 });
            def.layers = [uses, outlines];
          } else {
            const uses = leaflet.layerFor(cols, ds, 0); uses.name = t('plan.theme.markochvattenanvandning'); uses.filters = [{ field: 'tema', op: '=', value: 'markochvattenanvandning' }]; uses.colorBy = { column: 'innehallstyp', mode: 'category', values: plan.OP_USE_COLORS }; uses.label = 'innehallstyp'; uses.popup = ['innehallstyp', 'namn', 'precisering'];
            const rest = leaflet.layerFor(cols, ds, 1); rest.name = t('plan.layer.themes'); rest.filters = [{ field: 'tema', op: '!=', value: 'markochvattenanvandning' }]; rest.colorBy = { column: 'tema', mode: 'category', values: plan.OP_THEME_COLORS }; rest.label = 'namn'; rest.popup = ['tema', 'innehallstyp', 'namn']; rest.style = Object.assign(rest.style, { fillOpacity: 0.25 });
            def.layers = [uses, rest];
          }
          def.basemap = s.basemap;
          record.map = def;
          if (handle) record.map.view = handle.view();
          record.thumbnail = await leaflet.thumbnail(record).catch(() => null);
          const saved = await charts.save(record);
          shell.log(t('viz.saved.toast', { name: saved.name }), 'ok');
          ui.toast.show(t('viz.saved.toast', { name: saved.name }), { kind: 'ok', action: { label: t('map.open.visualisera'), onClick: () => { store.set({ openChartId: saved.id }); shell.activate('visualisera'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      /** The provisions as a Markdown file (the list on a plan map). */
      function exportProvisions() {
        const labels = { plan: t('plan.slag.detaljplan'), beteckning: t('plan.field.beteckning'), kommun: t('plan.field.kommun'), status: t('plan.field.status'), lagakraft: t('plan.field.lagakraft') };
        for (const typ of plan.OBJECT_TYPES) labels[typ] = t('plan.type.' + typ);
        const md = plan.provisionsMarkdown(s.info || {}, s.rows, labels);
        files.download(new Blob([md], { type: 'text/markdown;charset=utf-8' }), files.safeName(ds.name, 'md'));
      }

      // ---- inspector ----
      function renderInspector() {
        if (!slots) return;
        const items = [];
        const info = s.info || {};
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          info.beteckning ? { label: t('plan.field.beteckning'), value: info.beteckning } : null,
          info.kommun || info.kommunkod ? { label: t('plan.field.kommun'), value: [info.kommun, info.kommunkod].filter(Boolean).join(' ') } : null,
          info.typ ? { label: t('plan.field.typ'), value: info.typ } : null,
          info.status ? { label: t('plan.field.status'), value: info.status } : null,
          info.datumLagakraft ? { label: t('plan.field.lagakraft'), value: info.datumLagakraft } : null,
          info.datumPaborjat ? { label: t('plan.field.paborjat'), value: info.datumPaborjat } : null,
          info.anvandbarhet ? { label: t('plan.field.anvandbarhet'), value: info.anvandbarhet } : null,
          info.anteckning ? { label: t('plan.field.note'), value: info.anteckning } : null,
          { label: t('plan.field.objects'), value: i18n.formatNumber(s.rows.length) },
          info.format ? { label: t('plan.field.format'), value: t('plan.format.' + (info.format || 'detaljplan')) } : null,
        ].filter(Boolean);
        items.push(h('h4', { text: t('plan.about') }), kv, h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('plan.status.edit'), icon: 'pencil', size: 'sm', title: t('plan.status.edit.hint'), onClick: () => editStatus().catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })) })));
        // Layers: one switch per object type or theme, with counts.
        const layerList = h('div', { class: 'dm-stack-sm dm-plan-layers' }, groups.map((g) => {
          const sw = /** @type {any} */ (h('dm-switch', { label: `${groupLabel(g.key)} (${i18n.formatNumber(g.count)})` }));
          sw.checked = !s.hidden.has(g.key);
          sw.addEventListener('change', () => toggleGroup(g.key, sw.checked));
          return sw;
        }));
        items.push(h('h4', { text: t('map.layers') }), layerList);
        if (s.selected) {
          items.push(h('h4', { text: t('plan.selected') }), selectedDetails(s.selected));
          const block = D.require('ui/kinds/comment-block');
          const objekt = s.selected.objektid;
          if (objekt) items.push(block.create(ctx, ds, block.targetOf(ds, `plan:${objekt}`, s.selected.namn || String(objekt), () => objekt)));
        } else if (s.slag === 'detaljplan') {
          const legend = plan.legend(s.rows);
          if (legend.length) items.push(h('h4', { text: t('map.legend') }), h('ul', { class: 'dm-map-legend-list dm-plan-legend' }, legend.map((e) => h('li', null, h('span', { class: 'dm-map-legend-swatch', style: { background: e.color || 'transparent' } }), h('span', { class: 'dm-plan-legend-text' }, h('strong', { text: e.beteckning + ' ' }), h('span', { class: 'dm-truncate', text: e.formulering || '' }))))));
          for (const g of plan.grouped(s.rows)) {
            if (g.typ === 'anvandning') continue;
            items.push(h('details', { class: 'dm-more', open: g.rows.length <= 12 ? true : null }, h('summary', { text: `${t('plan.type.' + g.typ)} (${i18n.formatNumber(g.rows.length)})` }),
              h('ul', { class: 'dm-plan-provisions' }, g.rows.slice(0, 200).map((r) => h('li', { onclick: () => { s.selected = r; renderInspector(); } }, h('strong', { text: (r.beteckning || '–') + ' ' }), h('span', { text: r.formulering || '' }))))));
          }
        } else {
          const areas = plan.areasByUse(s.rows, 'oversiktsplan').slice(0, 30);
          if (areas.length) items.push(h('h4', { text: t('plan.theme.markochvattenanvandning') }), h('ul', { class: 'dm-map-legend-list dm-plan-legend' }, areas.map((e) => h('li', null, h('span', { class: 'dm-map-legend-swatch', style: { background: e.color } }), h('span', { class: 'dm-truncate', text: `${e.label} · ${i18n.formatNumber(Math.round(e.area / 10000))} ha` })))));
          items.push(h('p', { class: 'dm-help', text: t('plan.help.op') }));
        }
        replace(slots.right, items);
      }
      /** What is known about the plan's standing, kept with the dataset: its status, when it gained legal force, and a note. */
      async function editStatus() {
        const info = s.info || {};
        const field = (label, value) => { const el = /** @type {any} */ (h('dm-input', { label })); el.value = value || ''; return el; };
        const status = field(t('plan.field.status'), info.status);
        const date = field(t('plan.field.lagakraft'), info.datumLagakraft);
        const note = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('plan.field.note') }));
        note.value = info.anteckning || '';
        const ok = await ui.dialog.open({ title: t('plan.status.edit'), body: h('div', { class: 'dm-stack' }, status, date, note), actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
        if (!ok) return;
        const next = Object.assign({}, info, { status: status.value.trim(), datumLagakraft: date.value.trim(), anteckning: note.value.trim() });
        const handle = await datasets.ensureOpen(ds.id);
        handle.meta.plan = next;
        await handle.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['plan', JSON.stringify(next)]);
        await datasets.save(ds.id);
        datasets.notify('changed', { id: ds.id });
        s.info = next;
        renderInspector();
      }
      /** The clicked object: its facts, and the catalogue's facts about the provision it refers to. */
      function selectedDetails(row) {
        const kv = /** @type {any} */ (h('dm-kv'));
        const isOp = s.slag === 'oversiktsplan';
        kv.items = (isOp ? [
          { label: t('plan.field.tema'), value: groupLabel(row.tema) }, { label: t('plan.field.innehallstyp'), value: row.innehallstyp }, row.namn ? { label: t('common.name'), value: row.namn } : null,
          row.precisering ? { label: t('plan.field.precisering'), value: row.precisering } : null, row.kompletterande ? { label: t('plan.field.kompletterande'), value: row.kompletterande } : null,
          row.anvandningsstatus ? { label: t('plan.field.anvandningsstatus'), value: row.anvandningsstatus } : null, row.planhandelse ? { label: t('plan.field.planhandelse'), value: `${row.planhandelse} ${row.planhandelse_datum || ''}`.trim() } : null,
        ] : [
          { label: t('plan.field.objekttyp'), value: t('plan.type.' + (row.objekttyp || 'annan')) }, row.beteckning ? { label: t('plan.field.beteckning'), value: row.beteckning } : null,
          row.formulering ? { label: t('plan.field.formulering'), value: row.formulering } : null, row.kategori ? { label: t('plan.field.kategori'), value: row.underkategori ? `${row.kategori} / ${row.underkategori}` : row.kategori } : null,
          row.anvandningsform ? { label: t('plan.field.anvandningsform'), value: row.anvandningsform } : null, row.varde ? { label: t('plan.field.varde'), value: `${row.vardetyp ? row.vardetyp + ' ' : ''}${row.varde}${row.enhet ? ' ' + row.enhet : ''}` } : null,
          row.farg ? { label: t('plan.field.farg'), value: row.farg } : null, row.kod ? { label: t('plan.field.kod'), value: row.kod } : null, row.etikett && row.objekttyp !== 'planomrade' ? { label: t('plan.field.motiv'), value: row.etikett } : null,
        ]).filter(Boolean);
        const box = h('div', { class: 'dm-stack-sm' }, kv);
        if (!isOp && row.katalogreferens) {
          const note = h('p', { class: 'dm-help dm-small', text: t('common.loading') });
          box.appendChild(note);
          catalog.get(row.katalogreferens).then((entry) => {
            if (!entry) { note.textContent = t('plan.catalog.unknown', { id: row.katalogreferens }); return; }
            const period = entry.start ? `${entry.start} – ${catalog.isCurrent(entry) ? t('plan.catalog.current') : entry.slut}` : '';
            replace(note, h('span', { text: t('plan.catalog.entry', { kod: entry.kod || entry.beteckning, typ: t(catalog.typeKey(entry.typ)), period }) }), entry.formulering && entry.formulering !== row.formulering ? h('span', { class: 'dm-block', text: t('plan.catalog.template', { text: entry.formulering }) }) : null);
          }).catch(() => { note.textContent = ''; });
        }
        box.appendChild(h('div', { class: 'dm-row-wrap' },
          ui.button({ label: t('plan.copy.text'), icon: 'copy', size: 'sm', onClick: async () => { try { await navigator.clipboard.writeText(isOp ? [row.innehallstyp, row.namn, row.precisering].filter(Boolean).join(' – ') : `${row.beteckning ? row.beteckning + ' ' : ''}${row.formulering || ''}`); ui.toast.show(t('plan.copied'), { kind: 'ok' }); } catch (_e) { /* clipboard unavailable */ } } }),
          ui.button({ label: t('map.edit.table'), icon: 'table', size: 'sm', title: t('map.edit.table.hint'), onClick: options.onTable }),
          ui.button({ label: t('common.close'), icon: 'x', size: 'sm', variant: 'ghost', onClick: () => { s.selected = null; highlight(null); renderInspector(); } })));
        return box;
      }

      function destroy() { seq++; if (handle) { handle.finalize(); handle = null; } groups = []; labelLayer = null; mapEl = null; slots = null; }
      return { render, destroy, state: s };
    }
    return { create };
  });
})();
