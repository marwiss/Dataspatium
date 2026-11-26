// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for a digital comprehensive plan shown with its layers, text and files (ui/bearbeta/plan-view with ui/viz/layer-list,
 * ui/bearbeta/plan-layers and ui/bearbeta/plan-sections) and for the kind `layers` (ui/bearbeta/layers-view): the layers per
 * GeoPackage with distinct symbols, Visa alla, Dölj alla and Visa bara detta, the legend of what shows, the visibility remembered
 * per dataset, the ställningstaganden with those about the whole plan at the top, one section marking its three areas, the
 * sections of a chosen area in the inspector, the delivery's files opened under the safe rule, and three layers of the kind
 * `layers`. The datasets are built here with their side tables; nothing touches the net (no background map, a stubbed tile
 * factory and consent asker), and the setting, window.open, the downloads and the object URLs are put back afterwards.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const dsFiles = D.require('data/dataset-files');
  const plan = D.require('data/plan');
  const consent = D.require('platform/consent');
  const idb = D.require('platform/storage/idb');
  const memory = D.require('ui/viz/basemap-memory');
  const layerList = D.require('ui/viz/layer-list');
  const t = D.require('ui/i18n').t;
  const created = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 8000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  /** The app started off screen, with the consent asker and the remembered layers and background maps put back afterwards. */
  async function withApp(fn) {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const kept = await idb.getSetting(memory.SETTING, null);
    const asked = [];
    consent.setAsker(async (purpose) => { asked.push(purpose); return { allow: false, remember: false }; });
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      return await fn(shell, root, asked);
    } finally {
      consent.setAsker(null);
      if (kept === null) await idb.deleteSetting(memory.SETTING); else await idb.setSetting(memory.SETTING, kept);
      memory.reset();
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      root.remove();
    }
  }
  /** Where a view draws: a centre and an inspector off screen. */
  function target() {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-10000px; top:0; width:1000px; height:800px; display:flex;';
    const center = document.createElement('div'); center.style.cssText = 'width:680px; height:700px; display:flex; flex-direction:column;';
    const right = document.createElement('div'); right.style.cssText = 'width:320px;';
    host.append(center, right);
    document.body.appendChild(host);
    return { host, center, right };
  }
  /** A tile factory that records, for a map that must never fetch. */
  function tiles() { const made = []; return { made, factory: (url) => { made.push(url); return /** @type {any} */ (globalThis).L.layerGroup(); } }; }
  const square = (x, y, d = 0.01) => JSON.stringify({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
  const line = (x, y) => JSON.stringify({ type: 'LineString', coordinates: [[x, y], [x + 0.02, y + 0.01]] });
  const point = (x, y) => JSON.stringify({ type: 'Point', coordinates: [x, y] });
  const bytes = (text) => new TextEncoder().encode(text);
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
  const A = 'op-testkoping.gpkg'; const B = 'riksintressen.gpkg';
  const lagerOf = (tema, geom) => `innehall_op_${tema}${geom ? '_' + geom : ''}`;
  /** The plan's objektidentitet, which the GeoPackage writes in braces. */
  const PLAN_ID = '6B1E1F2A-0C3D-4E5F-8A9B-1C2D3E4F5A6B';

  /**
   * A delivered comprehensive plan: six layers in two GeoPackages (land use with three uses, development in areas and lines,
   * the plan boundary, national interests as areas and points), four sections (three ställningstaganden, one about the whole
   * plan, one description), five files and the delivery's warnings.
   */
  async function deliveredPlan(name) {
    const columns = plan.OP_COLUMNS.concat([{ name: 'lager', type: 'text' }, { name: 'fil', type: 'text' }]);
    const row = (o) => columns.map((c) => (o[c.name] === undefined ? (c.name === 'ordning' ? 0 : '') : o[c.name]));
    const use = (id, typ, x) => row({ objektid: id, tema: 'markochvattenanvandning', innehallstyp: typ, namn: typ, geometrityp: 'Polygon', geometri: square(x, 59.27), lager: lagerOf('markochvattenanvandning', 'polygon'), fil: A });
    const rows = [
      use('o-1', 'Bostadsbebyggelse', 15.20), use('o-2', 'Grönområde', 15.22), use('o-3', 'Verksamheter', 15.24),
      row({ objektid: 'u-1', tema: 'utvecklingsinriktning', innehallstyp: 'Utvecklingsinriktning', namn: 'Stråket', geometrityp: 'Polygon', geometri: square(15.26, 59.27), lager: lagerOf('utvecklingsinriktning', 'polygon'), fil: A }),
      row({ objektid: 'u-2', tema: 'utvecklingsinriktning', innehallstyp: 'Utvecklingsinriktning', namn: 'Leden', geometrityp: 'LineString', geometri: line(15.2, 59.29), lager: lagerOf('utvecklingsinriktning', 'line'), fil: A }),
      row({ objektid: 'p-0', tema: 'plangeometri', innehallstyp: 'Plangeometri', geometrityp: 'Polygon', geometri: square(15.18, 59.25, 0.12), lager: lagerOf('plangeometri'), fil: A }),
      row({ objektid: 'r-1', tema: 'riksintressen', innehallstyp: 'Kulturmiljövården', namn: 'Slottet', geometrityp: 'Polygon', geometri: square(15.28, 59.3), lager: lagerOf('riksintressen', 'polygon'), fil: B }),
      row({ objektid: 'r-2', tema: 'riksintressen', innehallstyp: 'Friluftslivet', namn: 'Badet', geometrityp: 'Point', geometri: point(15.27, 59.31), lager: lagerOf('riksintressen', 'point'), fil: B }),
    ];
    const files = [
      { name: A, kind: 'plankarta', type: 'application/geopackage+sqlite3', bytes: bytes('SQLite format 3\u0000 prov') },
      { name: 'planbeskrivning.docx', kind: 'textdokument', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: bytes('PK prov') },
      { name: 'planbeskrivning.pdf', kind: 'bilaga', type: 'text/html', bytes: PDF },
      { name: 'yttrande.pdf', kind: 'bilaga', type: 'application/pdf', bytes: bytes('<html><script>alert(1)</script></html>') },
      { name: 'manifest.xml', kind: 'manifest', type: 'application/xml', bytes: bytes('<manifest/>') },
    ];
    const leverans = { filer: files.map((f) => ({ namn: f.name, roll: f.kind, storlek: f.bytes.byteLength, sha256: '' })), manifest: { namn: 'manifest.xml', format: 'ODF' }, metadata: null, varningar: ['Bokmärket op_saknas finns inte i planbeskrivning.docx'] };
    const meta = await dsFiles.createDataset({ name, kind: 'plan', columns, rows, files, meta: { plan: { slag: 'oversiktsplan', objektid: `{${PLAN_ID}}`, namn: name, kommun: 'Testköping', kommunkod: '1880', status: 'Antagen', datumPlanhandelse: '2025-06-10', crs: 'EPSG:3006', leverans } } });
    created.push(meta.id);
    const hd = await datasets.ensureOpen(meta.id);
    await hd.engine.run('create table _sections (avsnitt text, dokument text, rubrik text, text text, typ text, ordning integer)');
    await hd.engine.run('create table _section_links (avsnitt text, objektid text, dokument text, typ text)');
    const sections = [
      ['op_h1', 'planbeskrivning.docx', 'Kommunens inriktning', 'Testköping ska växa hållbart.', 'Ställningstagande', 1],
      ['op_s1', 'planbeskrivning.docx', 'Ny bebyggelse i centrum', 'Kommunen prövar nya bostäder <img src=x onerror="window.dmPwned=1"> nära stationen.\nVerksamheter flyttar ut.', 'Ställningstagande', 2],
      ['op_s2', 'planbeskrivning.docx', 'Grönstruktur', 'Parkerna behålls.', 'ställningstagande', 3],
      ['op_b1', 'planbeskrivning.docx', 'Bakgrund', 'Centrum har vuxit sedan 1970.', 'Beskrivning', 4],
    ];
    for (const s of sections) await hd.engine.run('insert into _sections values (?, ?, ?, ?, ?, ?)', s);
    const links = [['op_h1', ''], ['op_s1', 'o-1'], ['op_s1', 'o-3'], ['op_s1', 'u-1'], ['op_s2', 'o-2'], ['op_b1', 'o-1']];
    for (const [a, o] of links) await hd.engine.run('insert into _section_links values (?, ?, ?, ?)', [a, o, 'planbeskrivning.docx', '']);
    await datasets.save(meta.id);
    return datasets.get(meta.id);
  }
  /** The plan view drawn into an off-screen target. */
  async function planView(shell, ds, factory) {
    const where = target();
    const view = D.require('ui/bearbeta/plan-view').create(shell.ctx, { onTable() {}, tileFactory: factory });
    await view.render(ds, where);
    await waitFor(() => view.handle && where.center.querySelector('.dm-plan-view[data-plan-layers-drawn]'), 10000, 'the plan map');
    return { view, where, close: () => { view.destroy(); where.host.remove(); } };
  }
  const switchesIn = (el) => Array.from(el.querySelectorAll('[data-layer-switch]'));
  const legendKeys = (el) => Array.from(el.querySelectorAll('[data-layer-legend] > .dm-map-legend-block > ul > li[data-layer-key]')).map((li) => li.getAttribute('data-layer-key'));
  const signature = (s) => [s.mark, s.color, s.dash || '', s.mark === 'point' ? s.shape : '', s.byRow ? 'rows' : ''].join('|');
  /** The Leaflet layers drawn for a plan object, found by its identity. */
  function drawnFor(view, objektid) {
    const out = [];
    view.handle.map.eachLayer((lyr) => { const p = lyr.feature && lyr.feature.properties; if (p && p._i !== undefined && view.state.rows[p._i] && view.state.rows[p._i].objektid === objektid) out.push(lyr); });
    return out;
  }
  const tab = (where, label) => /** @type {HTMLElement} */ (Array.from(where.center.querySelectorAll('[data-plan-tabs] [role="tab"]')).find((b) => b.textContent.trim() === label));

  test('op view: layers per GeoPackage with distinct symbols; Visa alla, Dölj alla and Visa bara detta; the legend shows only what shows; remembered', async (assert) => {
    const ds = await deliveredPlan('ÖP lagerprov');
    await withApp(async (shell, _root, asked) => {
      const { made, factory } = tiles();
      let pv = await planView(shell, ds, factory);
      try {
        const right = pv.where.right;
        assert.deepEqual(Array.from(right.querySelectorAll('[data-layer-group]')).map((g) => g.getAttribute('data-layer-group')), [A, B], 'grouped per GeoPackage');
        assert.equal(switchesIn(right).length, 6, 'one switch per layer');
        assert.ok(switchesIn(right).every((s) => /** @type {any} */ (s).checked), 'every layer shows at the start');
        assert.equal(pv.where.center.querySelector('.dm-plan-view').getAttribute('data-plan-layers-drawn'), '6', 'six layers drawn');
        // Distinct symbols: each its own colour, dash or shape; land use keeps Boverket's colours row by row.
        const syms = layerList.symbols(pv.view.state.layers);
        assert.equal(new Set(pv.view.state.layers.map((l) => signature(syms.get(l.key)))).size, 6, 'six distinct symbols');
        const useLayer = pv.view.state.layers.find((l) => l.tema === 'markochvattenanvandning');
        assert.equal(pv.view.state.layers[0], useLayer, 'land use first');
        const usePaths = drawnFor(pv.view, 'o-1');
        assert.equal(usePaths[0].options.fillColor, plan.opFillOf({ tema: 'markochvattenanvandning', innehallstyp: 'Bostadsbebyggelse' }), 'Boverket\'s colour for housing');
        const ri = pv.view.state.layers.find((l) => l.label.startsWith(t('plan.theme.riksintressen')) && l.mark === 'polygon');
        assert.equal(drawnFor(pv.view, 'r-1')[0].options.color, syms.get(ri.key).color, 'a theme layer in its palette colour');
        assert.ok(right.querySelector(`[data-layer-key="${useLayer.key}"] svg.dm-layer-swatch[data-mark="polygon"]`) && right.querySelector('svg.dm-layer-swatch[data-mark="point"]') && right.querySelector('svg.dm-layer-swatch[data-mark="line"]'), 'swatches for areas, lines and points');
        assert.equal(legendKeys(right).length, 6, 'the legend lists all six');
        assert.ok(right.querySelectorAll('.dm-layer-legend-categories li').length === 3, 'land use by its three uses');
        // The plan's own facts: its identity without braces and its planhändelse with the date (F90 a).
        const about = right.querySelector('dm-kv').textContent;
        assert.ok(about.includes(t('plan.field.objektid') + PLAN_ID) && !about.includes('{'), 'the plan\'s identity without braces: ' + about);
        assert.ok(about.includes(t('plan.field.planhandelse') + 'Antagen 2025-06-10'), 'its planhändelse with its date');
        // Dölj alla, Visa alla, Visa bara detta.
        const map = pv.view.handle.map;
        const onMap = () => pv.view.state.layers.filter((l) => drawnFor(pv.view, l.rows[0].objektid).length).length;
        /** @type {any} */ (right.querySelector('[data-layer-hide-all]')).click();
        assert.ok(switchesIn(right).every((s) => !/** @type {any} */ (s).checked) && onMap() === 0, 'none shows');
        assert.equal(legendKeys(right).length, 0, 'an empty legend');
        assert.ok(right.querySelector('[data-layer-legend]').textContent.includes(t('layers.legend.none')));
        /** @type {any} */ (right.querySelector('[data-layer-show-all]')).click();
        assert.equal(onMap(), 6, 'all show again');
        const pointLayer = pv.view.state.layers.find((l) => l.mark === 'point');
        /** @type {any} */ (right.querySelector(`[data-layer-only="${pointLayer.key}"]`)).click();
        assert.equal(onMap(), 1, 'only the points');
        assert.ok(drawnFor(pv.view, 'r-2').length === 1 && map.hasLayer(drawnFor(pv.view, 'r-2')[0]));
        assert.deepEqual(legendKeys(right), [pointLayer.key], 'the legend lists only the layer that shows');
        // A group's own Dölj alla and Visa alla.
        /** @type {any} */ (right.querySelector(`[data-layer-group-show="${A}"]`)).click();
        assert.equal(onMap(), 5, 'the first file\'s four and the point');
        /** @type {any} */ (right.querySelector(`[data-layer-group-hide="${B}"]`)).click();
        assert.equal(onMap(), 4);
        // One switch.
        const sw = /** @type {any} */ (right.querySelector(`[data-layer-switch="${useLayer.key}"]`));
        sw.querySelector('input').click();
        assert.ok(!sw.checked && onMap() === 3, 'land use off');
        const hidden = Array.from(pv.view.state.hidden).sort();
        assert.equal(hidden.length, 3, 'the second file and land use hidden');
        const stored = await waitFor(async () => { const v = await idb.getSetting(memory.SETTING, null); return v && v[ds.id] && v[ds.id].layers && v[ds.id].layers.hidden.length === 3 ? v : null; }, 3000, 'the setting');
        assert.deepEqual(stored[ds.id].layers.hidden.slice().sort(), hidden, 'kept by dataset id');
        // Back to the plan later in the session, and after a reload.
        pv.close();
        pv = await planView(shell, ds, factory);
        assert.deepEqual(switchesIn(pv.where.right).filter((s) => !/** @type {any} */ (s).checked).map((s) => s.getAttribute('data-layer-switch')).sort(), hidden, 'the same layers hidden in a new view');
        pv.close();
        memory.reset();
        pv = await planView(shell, ds, factory);
        assert.deepEqual(Array.from(pv.view.state.hidden).sort(), hidden, 'and after a reload, from the setting');
        assert.equal(legendKeys(pv.where.right).length, 3, 'the legend after a reload');
        assert.ok(!made.length && !asked.length, 'nothing fetched, nothing asked');
      } finally { pv.close(); }
    });
    return 'ok';
  }, 60000);

  test('op view: the map and the plan description side by side, the ställningstaganden first and the whole plan at the top; one section marks its three areas and fits the map to them', async (assert) => {
    const ds = await deliveredPlan('ÖP ställningstaganden');
    await withApp(async (shell) => {
      const pv = await planView(shell, ds, tiles().factory);
      try {
        const { center, right } = pv.where;
        const tabs = await waitFor(() => center.querySelector('[data-plan-tabs]'), 5000, 'the tabs');
        assert.deepEqual(Array.from(tabs.querySelectorAll('[role="tab"]')).map((b) => b.textContent.trim()), [t('plan.tab.text'), t('plan.tab.files')], 'the description and Filer; the map is no tab');
        const text = /** @type {HTMLElement} */ (center.querySelector('[data-plan-text]'));
        assert.ok(!text.hidden && !(/** @type {HTMLElement} */ (center.querySelector('.dm-plan-view'))).hidden, 'the map and the sections at the same time');
        const ids = (sel) => Array.from(text.querySelectorAll(sel + ' [data-plan-section]')).map((a) => a.getAttribute('data-plan-section'));
        assert.deepEqual(ids('[data-plan-whole]'), ['op_h1'], 'Gäller hela planen');
        assert.ok(text.firstElementChild && text.firstElementChild.hasAttribute('data-plan-whole'), 'at the top');
        assert.ok(text.querySelector('[data-plan-whole] h3').textContent === t('plan.sections.whole'));
        assert.deepEqual(ids('[data-plan-statements]'), ['op_s1', 'op_s2'], 'the ställningstaganden (any case)');
        assert.deepEqual(ids('[data-plan-others]'), ['op_b1'], 'then the others');
        const order = Array.from(text.querySelectorAll('[data-plan-section]')).map((a) => a.getAttribute('data-plan-section'));
        assert.deepEqual(order, ['op_h1', 'op_s1', 'op_s2', 'op_b1']);
        // Text only: the markup in the text is text.
        const s1 = /** @type {HTMLElement} */ (text.querySelector('[data-plan-section="op_s1"]'));
        assert.ok(s1.querySelector('h4').textContent === 'Ny bebyggelse i centrum' && s1.textContent.includes('<img src=x'), 'heading and text');
        assert.ok(!s1.querySelector('img') && !(/** @type {any} */ (window)).dmPwned, 'never as HTML');
        assert.equal(text.querySelector('[data-plan-whole] [data-plan-section-map]'), null, 'nothing to mark for the whole plan');
        // One section, three areas: all marked, the map fitted to them.
        const mark = /** @type {any} */ (s1.querySelector('[data-plan-section-map="op_s1"]'));
        assert.ok(mark.textContent.includes('3') || mark.getAttribute('label').includes('3'), 'three areas: ' + mark.getAttribute('label'));
        mark.click();
        const mapEl = /** @type {HTMLElement} */ (center.querySelector('.dm-plan-view'));
        await waitFor(() => mapEl.getAttribute('data-plan-marked') === '3', 5000, 'three areas marked');
        assert.ok(!mapEl.hidden && !text.hidden, 'the text stays beside the map');
        assert.ok(text.querySelector('[data-plan-section="op_s1"]').classList.contains('dm-plan-section-current'), 'the section marked in the text');
        const marks = pv.view.marks;
        assert.equal(marks.getLayers().length, 3, 'three marked');
        const want = ['o-1', 'o-3', 'u-1'].map((id) => drawnFor(pv.view, id)[0].getBounds());
        const view = pv.view.handle.map.getBounds();
        assert.ok(want.every((b) => view.contains(b)), 'the view holds all three');
        assert.ok(marks.getBounds().contains(want[0]) && marks.getBounds().contains(want[1]) && marks.getBounds().contains(want[2]), 'the marks are those areas');
        assert.ok(!view.contains(drawnFor(pv.view, 'p-0')[0].getBounds()), 'fitted to them, not to the whole plan');
        await waitFor(() => right.querySelector('[data-plan-chosen="op_s1"]'), 3000, 'the chosen section in the inspector');
        // Another section marks its own; Avmarkera clears.
        /** @type {any} */ (text.querySelector('[data-plan-section-map="op_s2"]')).click();
        await waitFor(() => mapEl.getAttribute('data-plan-marked') === '1', 5000, 'one area');
        /** @type {any} */ (right.querySelector('[data-plan-clear]')).click();
        await waitFor(() => mapEl.getAttribute('data-plan-marked') === '0' && !right.querySelector('[data-plan-chosen]'), 3000, 'cleared');
      } finally { pv.close(); }
    });
    return 'ok';
  }, 60000);

  test('op view: a chosen area lists its sections in the inspector, ställningstaganden first, each with Visa i planbeskrivningen', async (assert) => {
    const ds = await deliveredPlan('ÖP inspektör');
    await withApp(async (shell) => {
      const pv = await planView(shell, ds, tiles().factory);
      try {
        const { center, right } = pv.where;
        drawnFor(pv.view, 'o-1')[0].fire('click');
        const list = await waitFor(() => { const l = Array.from(right.querySelectorAll('[data-plan-object-sections] [data-plan-object-section]')); return l.length ? l : null; }, 5000, 'the sections of the area');
        assert.deepEqual(list.map((li) => li.getAttribute('data-plan-object-section')), ['op_s1', 'op_b1'], 'its ställningstagande, then its description');
        assert.ok(list[0].textContent.includes('Ny bebyggelse i centrum') && list[0].querySelector('dm-badge').textContent === 'Ställningstagande');
        assert.ok(!list[0].querySelector('img'), 'text only');
        /** @type {any} */ (right.querySelector('[data-plan-reveal="op_b1"]')).click();
        const text = /** @type {HTMLElement} */ (center.querySelector('[data-plan-text]'));
        assert.ok(!text.hidden, 'the text shows');
        const at = /** @type {HTMLElement} */ (text.querySelector('[data-plan-section="op_b1"]'));
        assert.ok(at.classList.contains('dm-plan-section-current') && document.activeElement === at.querySelector('h4'), 'at the section, with the focus');
        // An area no section points to says so.
        drawnFor(pv.view, 'r-1')[0].fire('click');
        await waitFor(() => { const b = right.querySelector('[data-plan-object-sections]'); return b && b.textContent.includes(t('plan.sections.object.none')); }, 5000, 'no section');
      } finally { pv.close(); }
    });
    return 'ok';
  }, 60000);

  test('op view: the delivery\'s files with roles and sizes; only a PDF or a picture whose bytes agree opens in a tab, the rest is downloaded; a file is added', async (assert) => {
    const ds = await deliveredPlan('ÖP filer');
    const files = D.require('platform/files');
    const orig = { open: window.open, download: files.download, url: URL.createObjectURL };
    const opened = []; const downloaded = []; const types = [];
    window.open = /** @type {any} */ ((u) => { opened.push(u); return null; });
    files.download = (blob, name) => { downloaded.push(name); };
    URL.createObjectURL = (blob) => { types.push(blob.type); return orig.url.call(URL, blob); };
    try {
      await withApp(async (shell) => {
        const pv = await planView(shell, ds, tiles().factory);
        try {
          const { center } = pv.where;
          await waitFor(() => tab(pv.where, t('plan.tab.files')), 5000, 'the tab Filer');
          tab(pv.where, t('plan.tab.files')).click();
          const pane = /** @type {HTMLElement} */ (center.querySelector('[data-plan-files]'));
          assert.ok(!pane.hidden);
          const names = Array.from(pane.querySelectorAll('[data-plan-file]')).map((li) => li.getAttribute('data-plan-file'));
          assert.deepEqual(names.slice().sort(), [A, 'manifest.xml', 'planbeskrivning.docx', 'planbeskrivning.pdf', 'yttrande.pdf'].sort());
          const item = (name) => /** @type {HTMLElement} */ (pane.querySelector(`[data-plan-file="${name}"]`));
          assert.ok(item(A).textContent.includes(t('plan.files.role.plankarta')) && item('planbeskrivning.docx').textContent.includes(t('plan.files.role.textdokument')), 'the roles');
          assert.ok(item('planbeskrivning.pdf').querySelector('.dm-plan-file-size').textContent.trim().length > 0, 'the size');
          assert.ok(pane.querySelector('[data-plan-warnings]').textContent.includes('op_saknas'), 'the delivery\'s warning');
          assert.ok(pane.textContent.includes('manifest.xml · ODF'), 'the manifest');
          const open = (name) => /** @type {any} */ (pane.querySelector(`[data-plan-file-open="${name}"]`));
          assert.equal(open('planbeskrivning.pdf').getAttribute('icon'), 'external-link', 'a PDF offers to open');
          assert.equal(open('planbeskrivning.docx').getAttribute('icon'), 'download', 'a DOCX is downloaded');
          types.length = 0;
          open('planbeskrivning.pdf').click();
          await waitFor(() => opened.length === 1, 3000, 'the PDF in a tab');
          assert.equal(types[types.length - 1], 'application/pdf', 'with the type chosen here, not the stored one (text/html)');
          // A "PDF" whose bytes are HTML is downloaded, never opened.
          open('yttrande.pdf').click();
          await waitFor(() => downloaded.includes('yttrande.pdf'), 3000, 'downloaded');
          open('planbeskrivning.docx').click();
          await waitFor(() => downloaded.includes('planbeskrivning.docx'), 3000, 'the DOCX downloaded');
          open('manifest.xml').click();
          await waitFor(() => downloaded.includes('manifest.xml'), 3000, 'the XML downloaded');
          assert.equal(opened.length, 1, 'only the real PDF opened');
          assert.ok(pane.querySelector('[data-plan-add-file]'), 'Lägg till fil i planen');
          // Lägg till fil i planen: the file is kept with the plan and listed with its role.
          await pv.view.sections.add([new File([PDF], 'granskningsyttrande.pdf', { type: 'application/pdf' })]);
          const fresh = await datasets.get(ds.id);
          await pv.view.render(fresh, pv.where);
          const added = await waitFor(() => center.querySelector('[data-plan-files] [data-plan-file="granskningsyttrande.pdf"]'), 8000, 'the added file');
          assert.ok(added.textContent.includes(t('plan.files.role.bilaga')), 'as an appendix');
          assert.ok(!(/** @type {HTMLElement} */ (center.querySelector('[data-plan-files]'))).hidden, 'the tab Filer stays');
          const after = await datasets.get(ds.id);
          assert.ok(after.plan.leverans.filer.some((f) => f.namn === 'granskningsyttrande.pdf' && f.roll === 'bilaga' && f.storlek === PDF.byteLength), 'in the delivery\'s list');
        } finally { pv.close(); }
      });
    } finally { window.open = orig.open; files.download = orig.download; URL.createObjectURL = orig.url; }
    return 'ok';
  }, 60000);

  test('op view: an older comprehensive plan without layers or files keeps its themes and its map alone', async (assert) => {
    const rows = [
      { objektid: 'g-1', tema: 'markochvattenanvandning', innehallstyp: 'Bostadsbebyggelse', geometrityp: 'Polygon', geometri: square(16.1, 58.6) },
      { objektid: 'g-2', tema: 'lis', innehallstyp: 'LIS-område', geometrityp: 'Polygon', geometri: square(16.12, 58.6) },
    ].map((o) => plan.OP_COLUMNS.map((c) => (o[c.name] === undefined ? (c.name === 'ordning' ? 0 : '') : o[c.name])));
    const meta = await dsFiles.createDataset({ name: 'Äldre ÖP', kind: 'plan', columns: plan.OP_COLUMNS, rows, files: [{ name: 'op.gpkg', kind: 'original', bytes: bytes('x') }], meta: { plan: { slag: 'oversiktsplan', namn: 'Äldre ÖP' } } });
    created.push(meta.id);
    await withApp(async (shell) => {
      const pv = await planView(shell, await datasets.get(meta.id), tiles().factory);
      try {
        assert.ok(!pv.where.center.querySelector('[data-plan-tabs]') && !pv.where.center.querySelector('[data-plan-split]'), 'no tabs and no description beside the map');
        assert.deepEqual(switchesIn(pv.where.right).map((s) => s.getAttribute('data-layer-switch')), ['markochvattenanvandning', 'lis'], 'a layer per theme');
        assert.equal(pv.where.right.querySelectorAll('[data-layer-group-show]').length, 0, 'one group, named after the dataset');
      } finally { pv.close(); }
    });
    return 'ok';
  }, 40000);

  test('layers view: three layers of two GeoPackages on one map, shown and hidden, with a feature\'s attributes and the table a button away', async (assert) => {
    const columns = ['lager', 'fil', 'objektid', 'geometrityp', 'geometri', 'egenskaper', 'ordning'].map((name) => ({ name, type: name === 'ordning' ? 'integer' : 'text' }));
    const rows = [
      ['vagar', 'vag.gpkg', '1', 'LINESTRING', line(17.0, 60.0), JSON.stringify({ namn: 'E4', bredd: 7.5 }), 0],
      ['vagar', 'vag.gpkg', '2', 'LINESTRING', line(17.02, 60.01), JSON.stringify({ namn: 'Väg 76', bredd: 6 }), 1],
      ['byggnader', 'vag.gpkg', '1', 'POLYGON', square(17.01, 60.0), JSON.stringify({ andamal: '<b>Bostad</b>' }), 2],
      ['brunnar', 'vatten.gpkg', '1', 'POINT', point(17.03, 60.02), JSON.stringify({ djup: 12 }), 3],
    ];
    const layersMeta = { filer: ['vag.gpkg', 'vatten.gpkg'], lager: [{ namn: 'vagar', fil: 'vag.gpkg', geometrityp: 'LINESTRING', antal: 2, crs: 'EPSG:3006' }, { namn: 'byggnader', fil: 'vag.gpkg', geometrityp: 'POLYGON', antal: 1, crs: 'EPSG:3006' }, { namn: 'brunnar', fil: 'vatten.gpkg', geometrityp: 'POINT', antal: 1, crs: 'EPSG:3006' }] };
    const meta = await dsFiles.createDataset({ name: 'Tre lager', kind: 'layers', columns, rows, meta: { layers: layersMeta } });
    created.push(meta.id);
    const ds = await datasets.get(meta.id);
    const kinds = D.require('data/kinds');
    assert.ok(ds.kind === 'layers' && ds.layers && ds.layers.lager.length === 3, 'the kind and its layers kept: ' + JSON.stringify({ kind: ds.kind, layers: ds.layers }));
    assert.equal(kinds.ownView(ds), 'layers');
    assert.ok(kinds.summary(ds).includes('3'), kinds.summary(ds));
    await withApp(async (shell, root) => {
      const where = target();
      const { made, factory } = tiles();
      let tabled = 0;
      const view = D.require('ui/bearbeta/layers-view').create(shell.ctx, { onTable: () => { tabled++; }, tileFactory: factory });
      try {
        await view.render(ds, where);
        const mapEl = await waitFor(() => where.center.querySelector('.dm-layers-view[data-layers-drawn="3"]'), 10000, 'three layers drawn');
        assert.ok(mapEl, 'one map');
        assert.deepEqual(Array.from(where.right.querySelectorAll('[data-layer-group]')).map((g) => g.getAttribute('data-layer-group')), ['vag.gpkg', 'vatten.gpkg'], 'per file');
        assert.deepEqual(switchesIn(where.right).map((s) => s.getAttribute('data-layer-switch')), ['vag.gpkg::vagar', 'vag.gpkg::byggnader', 'vatten.gpkg::brunnar'], 'in the order of _meta.layers');
        assert.deepEqual(Array.from(where.right.querySelectorAll('[data-layer-legend] svg.dm-layer-swatch')).map((s) => s.getAttribute('data-mark')), ['line', 'polygon', 'point'], 'a mark per geometry in the legend');
        const syms = layerList.symbols(view.state.layers);
        assert.equal(new Set(view.state.layers.map((l) => signature(syms.get(l.key)))).size, 3, 'three symbols');
        const count = () => { let n = 0; view.handle.map.eachLayer((l) => { if (l.feature && l.feature.properties && l.feature.properties._i !== undefined) n++; }); return n; };
        assert.equal(count(), 4, 'four features');
        /** @type {any} */ (where.right.querySelector('[data-layer-only="vag.gpkg::vagar"]')).click();
        assert.equal(count(), 2, 'only the roads');
        assert.deepEqual(legendKeys(where.right), ['vag.gpkg::vagar']);
        /** @type {any} */ (where.right.querySelector('[data-layer-show-all]')).click();
        assert.equal(count(), 4);
        // A feature's attributes from egenskaper, as text.
        let building = null;
        view.handle.map.eachLayer((l) => { if (l.feature && l.feature.properties && view.state.rows[l.feature.properties._i] && view.state.rows[l.feature.properties._i].lager === 'byggnader') building = l; });
        building.fire('click');
        const kv = await waitFor(() => where.right.querySelector('[data-layers-selected]'), 3000, 'the attributes');
        assert.ok(kv.textContent.includes('andamal') && kv.textContent.includes('<b>Bostad</b>') && !kv.querySelector('b'), 'the attribute as text');
        assert.ok(kv.textContent.includes('byggnader') && kv.textContent.includes('vag.gpkg'), 'its layer and file');
        const tableBtn = Array.from(where.center.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('bearbeta.view.table'));
        /** @type {any} */ (tableBtn).click();
        assert.equal(tabled, 1, 'the table a button away');
        assert.ok(where.right.querySelector('[data-layers-facts]').textContent.includes('3'), 'the facts');
        assert.equal(made.length, 0, 'no tiles');
      } finally { view.destroy(); where.host.remove(); }
      // Bearbeta opens the kind in its own view.
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      await waitFor(() => root.querySelector('.dm-center .dm-layers-view[data-layers-drawn="3"]'), 15000, 'the view in Bearbeta');
      assert.ok(root.querySelectorAll('.dm-right [data-layer-switch]').length === 3, 'with its layer list');
    });
    return 'ok';
  }, 60000);

  test('op view: Boverket\'s colours go first in every layer: a theme whose rows all carry one is drawn row by row with a legend per colour, a layer without keeps its palette colour, a mixed layer draws both, and a detailed plan looks as before', (assert) => {
    const planLayers = D.require('ui/bearbeta/plan-layers');
    const catalog = D.require('data/plan-catalog');
    const C = catalog.COLORS;
    let n = 0;
    const op = (o) => Object.assign({ _i: n++, innehallstyp: '', namn: '', farg: '', lager: '', fil: '' }, o);
    const rows = [
      op({ objektid: 'u-1', tema: 'markochvattenanvandning', innehallstyp: 'Bostadsbebyggelse', geometrityp: 'Polygon', geometri: square(15.2, 59.27) }),
      op({ objektid: 'r-1', tema: 'riksintressen', innehallstyp: 'Kulturmiljövården', farg: 'Gul', geometrityp: 'Polygon', geometri: square(15.24, 59.27) }),
      op({ objektid: 'r-2', tema: 'riksintressen', innehallstyp: 'Naturvården', farg: 'Ljusgrön', geometrityp: 'Polygon', geometri: square(15.26, 59.27) }),
      op({ objektid: 'l-1', tema: 'lis', innehallstyp: 'LIS-område', geometrityp: 'Polygon', geometri: square(15.28, 59.27) }),
      op({ objektid: 'v-1', tema: 'utvecklingsinriktning', innehallstyp: 'Stråk', farg: 'Blå', geometrityp: 'LineString', geometri: line(15.2, 59.29) }),
      op({ objektid: 'v-2', tema: 'utvecklingsinriktning', innehallstyp: 'Led', geometrityp: 'LineString', geometri: line(15.22, 59.29) }),
      op({ objektid: 'm-1', tema: 'miljokvalitetsnormer', innehallstyp: 'Vatten', farg: 'Röd', geometrityp: 'Point', geometri: point(15.2, 59.3) }),
      op({ objektid: 'm-2', tema: 'miljokvalitetsnormer', innehallstyp: 'Luft', farg: 'Ofärgad', geometrityp: 'Point', geometri: point(15.21, 59.3) }),
    ];
    const layers = planLayers.of(rows, { slag: 'oversiktsplan', name: 'Färgprov' });
    const syms = layerList.symbols(layers);
    const layer = (k) => layers.find((l) => l.key === k);
    const row = (id) => rows.find((r) => r.objektid === id);
    const style = (k, id) => layerList.styleOf(syms.get(k), row(id));
    const fromPalette = (c) => D.require('viz/theme').tokens().palette.includes(c);
    // A theme other than land use whose rows all carry a colour name: each row in its colour, a legend entry per colour.
    assert.deepEqual([style('riksintressen', 'r-1').fillColor, style('riksintressen', 'r-2').fillColor], [C.gul, C.ljusgrön], 'national interests in Boverket\'s colours');
    assert.ok(!fromPalette(syms.get('riksintressen').color), 'not a palette colour');
    assert.deepEqual(layer('riksintressen').categories, [{ label: 'Kulturmiljövården', color: C.gul }, { label: 'Naturvården', color: C.ljusgrön }], 'a legend per colour');
    // Land use as before; a layer without colours keeps its palette colour and has no categories.
    assert.equal(style('markochvattenanvandning', 'u-1').fillColor, plan.OP_USE_COLORS.bostadsbebyggelse);
    assert.ok(fromPalette(syms.get('lis').color) && style('lis', 'l-1').fillColor === syms.get('lis').color && !layer('lis').categories, 'LIS in its palette colour');
    // Mixed layers: the row with a colour in it, the rest in the layer's palette colour (lines by stroke, points by fill).
    const lines = syms.get('utvecklingsinriktning');
    assert.ok(fromPalette(lines.color), 'the line layer has a palette colour');
    assert.deepEqual([style('utvecklingsinriktning', 'v-1').color, style('utvecklingsinriktning', 'v-2').color], [C.blå, lines.color], 'a line in Boverket\'s colour, the other in the palette\'s');
    assert.deepEqual(layer('utvecklingsinriktning').categories, [{ label: 'Stråk', color: C.blå }], 'the legend names the colour drawn');
    const L = { circleMarker: (_at, o) => o, marker: (_at, o) => o, divIcon: (o) => o };
    const pts = syms.get('miljokvalitetsnormer');
    const fill = (id) => { const p = layerList.pointOf(L, pts, [59.3, 15.2], row(id)); return p.fillColor || p.icon.html.querySelector('[fill]').getAttribute('fill'); };
    assert.deepEqual([fill('m-1'), fill('m-2')], [C.röd, pts.fill], 'a point in its colour; "Ofärgad" is no colour, so the palette\'s');
    // The legend shows the categories under their layers.
    const legend = layerList.create({ layers, symbols: syms, hidden: new Set(), onChange() {} }).legend();
    assert.equal(legend.querySelectorAll('li[data-layer-key="riksintressen"] .dm-layer-legend-categories li').length, 2, 'two colours in the legend');
    assert.equal(legend.querySelectorAll('li[data-layer-key="lis"] .dm-layer-legend-categories').length, 0, 'none for LIS');
    // A detailed plan is drawn as before the layer list: uses in Boverket's colours, outlines in the plan map's, strokes at full opacity.
    const dp = [
      { _i: 0, objektid: 'a', objekttyp: 'planomrade', farg: '', geometrityp: 'Polygon', geometri: square(16, 58, 0.05) },
      { _i: 1, objektid: 'b', objekttyp: 'anvandning', beteckning: 'B', farg: 'Gul', geometrityp: 'Polygon', geometri: square(16.01, 58.01) },
      { _i: 2, objektid: 'c', objekttyp: 'anvandning', beteckning: 'GATA', farg: '', geometrityp: 'Polygon', geometri: square(16.02, 58.01) },
      { _i: 3, objektid: 'd', objekttyp: 'egenskap', beteckning: 'e1', farg: '', geometrityp: 'Polygon', geometri: square(16.03, 58.01) },
      { _i: 4, objektid: 'e', objekttyp: 'egenskap', beteckning: '', farg: '', geometrityp: 'Point', geometri: point(16.03, 58.02) },
    ];
    const dpLayers = planLayers.of(dp, { slag: 'detaljplan', name: 'DP' });
    const dpSyms = layerList.symbols(dpLayers);
    const pick = (s) => [s.color, s.weight, s.dashArray, s.fillColor, s.fillOpacity, s.opacity];
    assert.deepEqual(pick(layerList.styleOf(dpSyms.get('anvandning'), dp[1])), ['#4a4f57', 1, null, C.gul, 0.6, 1], 'B yellow');
    assert.deepEqual(pick(layerList.styleOf(dpSyms.get('anvandning'), dp[2])), ['#4a4f57', 1, null, C.ljusgrå, 0.6, 1], 'GATA light grey');
    assert.deepEqual(pick(layerList.styleOf(dpSyms.get('egenskap'), dp[3])), ['#1f6fb2', 1.5, '6 4', '#1f6fb2', 0, 1], 'a property provision as a blue dashed outline');
    assert.deepEqual(pick(layerList.styleOf(dpSyms.get('planomrade'), dp[0])), ['#111111', 3, null, '#111111', 0, 1], 'the plan boundary in black');
    const dpPoint = layerList.pointOf(L, dpSyms.get('egenskap'), [58.02, 16.03], dp[4]);
    assert.deepEqual([dpPoint.color, dpPoint.weight, dpPoint.fillColor, dpPoint.fillOpacity], ['#1f6fb2', 1.5, '#1f6fb2', 0.7], 'a point in its stroke\'s colour');
    return 'ok';
  });

  test('op view: the map and the plan description beside it in a wide window, one above the other below 1100 px; the splitter\'s width is kept', async (assert) => {
    const ds = await deliveredPlan('ÖP bredvid');
    const SPLIT = D.require('ui/bearbeta/plan-sections').SPLIT_SETTING;
    const kept = await idb.getSetting(SPLIT, null);
    await idb.deleteSetting(SPLIT);
    try {
      await withApp(async (shell) => {
        let pv = await planView(shell, ds, tiles().factory);
        try {
          const box = (sel) => pv.where.center.querySelector(sel).getBoundingClientRect();
          await waitFor(() => pv.where.center.querySelector('[data-plan-split] [data-plan-side]'), 5000, 'the description beside the map');
          const map = box('.dm-plan-view'); const side = box('[data-plan-side]');
          assert.ok(map.width > 100 && map.height > 100 && side.width > 100 && side.height > 100, 'both show: ' + JSON.stringify([map.width, map.height, side.width, side.height]));
          // The window decides (tools/run-tests.ps1 at 1400 and at -Width 768): side by side, or the text below the map.
          if (matchMedia('(max-width: 1099px)').matches) {
            assert.ok(side.top >= map.bottom - 1 && Math.abs(side.left - map.left) < 2, 'stacked below 1100 px: ' + JSON.stringify([map.bottom, side.top]));
            assert.equal(getComputedStyle(pv.where.center.querySelector('dm-splitter[for="pane"]')).display, 'none', 'no splitter when stacked');
          } else {
            assert.ok(side.left >= map.right - 1 && Math.abs(side.top - map.top) < 2, 'side by side: ' + JSON.stringify([map.right, side.left]));
            const splitter = /** @type {HTMLElement} */ (pv.where.center.querySelector('dm-splitter[for="pane"]'));
            assert.equal(splitter.getAttribute('role'), 'separator');
            splitter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
            const wider = box('[data-plan-side]').width;
            assert.ok(Math.abs(wider - side.width - 16) < 2, 'ArrowLeft widens the description: ' + [side.width, wider]);
            const saved = await waitFor(async () => { const v = await idb.getSetting(SPLIT, null); return typeof v === 'number' ? v : null; }, 3000, 'the width kept');
            assert.ok(Math.abs(saved - wider) < 2, 'kept as ' + saved);
            pv.close();
            pv = await planView(shell, ds, tiles().factory);
            await waitFor(() => pv.where.center.querySelector('[data-plan-side]'), 5000, 'drawn again');
            assert.ok(Math.abs(box('[data-plan-side]').width - wider) < 2, 'the same width the next time');
          }
        } finally { pv.close(); }
      });
    } finally { if (kept === null) await idb.deleteSetting(SPLIT); else await idb.setSetting(SPLIT, kept); }
    return 'ok';
  }, 60000);

  test('op view: Shift-click and a rectangle choose several areas; the inspector lists the union of their sections with the areas each covers, and Visa i planbeskrivningen goes to the text', async (assert) => {
    const ds = await deliveredPlan('ÖP urval');
    await withApp(async (shell) => {
      const pv = await planView(shell, ds, tiles().factory);
      try {
        const { center, right } = pv.where;
        const mapEl = /** @type {HTMLElement} */ (center.querySelector('.dm-plan-view'));
        const click = (id, shift) => drawnFor(pv.view, id)[0].fire('click', { originalEvent: { shiftKey: !!shift } });
        const listed = () => Array.from(right.querySelectorAll('[data-plan-object-sections] [data-plan-object-section]')).map((li) => li.getAttribute('data-plan-object-section'));
        click('o-1');
        await waitFor(() => listed().join() === 'op_s1,op_b1', 3000, 'one area');
        click('o-2', true);
        await waitFor(() => right.querySelector('[data-plan-picked="2"]'), 3000, 'two chosen');
        assert.deepEqual(listed(), ['op_s1', 'op_s2', 'op_b1'], 'the union, ställningstaganden first');
        const covers = (a) => right.querySelector(`[data-plan-object-section="${a}"] [data-plan-covers]`).textContent;
        assert.ok(covers('op_s1').includes('Bostadsbebyggelse') && !covers('op_s1').includes('Grönområde'), 'op_s1 covers the first: ' + covers('op_s1'));
        assert.ok(covers('op_s2').includes('Grönområde'), 'op_s2 covers the second');
        assert.equal(mapEl.getAttribute('data-plan-picked'), '2', 'both drawn as chosen');
        assert.ok(right.firstElementChild.hasAttribute('data-plan-focus'), 'what is chosen is at the top of the inspector');
        click('o-2', true);
        await waitFor(() => !right.querySelector('[data-plan-picked]') && listed().join() === 'op_s1,op_b1', 3000, 'Shift-click again removes it');
        // A rectangle over the first two uses; the plan boundary, which it also meets, is never chosen.
        const L = /** @type {any} */ (globalThis).L;
        const hits = pv.view.selectBox(L.latLngBounds([59.2705, 15.205], [59.275, 15.225]));
        assert.deepEqual(hits.map((r) => r.objektid).sort(), ['o-1', 'o-2'], 'the areas the rectangle meets');
        await waitFor(() => right.querySelector('[data-plan-picked="2"]'), 3000, 'two by the rectangle');
        // Shift and drag on the map itself adds the third.
        const map = pv.view.handle.map; const el = map.getContainer();
        const at = (lat, lon) => { const r = el.getBoundingClientRect(); const p = map.latLngToContainerPoint([lat, lon]); return { clientX: r.left + p.x, clientY: r.top + p.y }; };
        const drag = (from, to, shiftKey) => {
          const ev = (type, pt) => new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, button: 0, pointerId: 7, pointerType: 'mouse', shiftKey }, pt));
          el.dispatchEvent(ev('pointerdown', at(...from))); el.dispatchEvent(ev('pointermove', at(...to))); el.dispatchEvent(ev('pointerup', at(...to)));
        };
        drag([59.2705, 15.2405], [59.275, 15.245], true);
        await waitFor(() => right.querySelector('[data-plan-picked="3"]'), 3000, 'the third added by Shift and drag');
        // Markera område: the next drag, without Shift, chooses only what it meets, and the mode ends.
        const boxBtn = /** @type {HTMLElement} */ (center.querySelector('[data-plan-box] button'));
        boxBtn.click();
        assert.ok(boxBtn.getAttribute('aria-pressed') === 'true' && mapEl.hasAttribute('data-plan-box-mode'), 'Markera område on');
        drag([59.2705, 15.2605], [59.275, 15.265], false);
        await waitFor(() => listed().join() === 'op_s1' && !right.querySelector('[data-plan-picked]'), 3000, 'only the development area');
        assert.ok(boxBtn.getAttribute('aria-pressed') === 'false' && !mapEl.hasAttribute('data-plan-box-mode'), 'and the mode ends');
        // Visa i planbeskrivningen scrolls the text beside the map to the section and marks it.
        /** @type {any} */ (right.querySelector('[data-plan-reveal="op_s1"]')).click();
        const s1 = /** @type {HTMLElement} */ (center.querySelector('[data-plan-text] [data-plan-section="op_s1"]'));
        assert.ok(s1.classList.contains('dm-plan-section-current') && document.activeElement === s1.querySelector('h4'), 'at the section in the text');
        assert.ok(!mapEl.hidden, 'the map stays');
      } finally { pv.close(); }
    });
    return 'ok';
  }, 60000);

  test('op view: the inspector finds an area\'s sections whatever the case, braces or document of its links, marks a link the text only gives as Nämnd i texten, and says why when it cannot: an area without identity, a plan without links', async (assert) => {
    const columns = plan.OP_COLUMNS.concat([{ name: 'lager', type: 'text' }, { name: 'fil', type: 'text' }]);
    const row = (o) => columns.map((c) => (o[c.name] === undefined ? (c.name === 'ordning' ? 0 : '') : o[c.name]));
    const area = (id, namn, x) => row({ objektid: id, tema: 'omrade', innehallstyp: 'Område', namn, geometrityp: 'Polygon', geometri: square(x, 58.5), lager: 'omraden', fil: 'plan.gpkg' });
    /** A plan with the side tables as given, `kalla` included or not. */
    async function made(name, links, withSource) {
      const meta = await dsFiles.createDataset({ name, kind: 'plan', columns, rows: [area('{AB12-UPPER}', 'Hamnen', 16.0), area('b2', 'Torget', 16.02), area('', 'Utan id', 16.04)], files: [{ name: 'plan.gpkg', kind: 'plankarta', bytes: bytes('SQLite format 3\u0000') }], meta: { plan: { slag: 'oversiktsplan', namn: name, leverans: { filer: [], varningar: [], kopplingar: links.length ? undefined : { antal: 0, kallor: [], omraden: 3, omradenUtan: 3, avsnitt: 2, avsnittUtan: 2, stallningstaganden: 2, stallningstagandenUtan: 2, orsaker: ['notable', 'nocolumn', 'nomention'] } } } } });
      created.push(meta.id);
      const hd = await datasets.ensureOpen(meta.id);
      await hd.engine.run('create table _sections (avsnitt text, dokument text, rubrik text, text text, typ text, ordning integer)');
      await hd.engine.run(`create table _section_links (avsnitt text, objektid text, dokument text, typ text${withSource ? ', kalla text' : ''})`);
      await hd.engine.run('insert into _sections values (?, ?, ?, ?, ?, ?)', ['st_1', 'text.docx', 'Hamnen utvecklas', 'Hamnen blir en stadsdel.', 'Ställningstagande', 1]);
      await hd.engine.run('insert into _sections values (?, ?, ?, ?, ?, ?)', ['st_2', 'text.docx', 'Torget', 'Torget behålls.', 'Ställningstagande', 2]);
      for (const l of links) await hd.engine.run(`insert into _section_links values (?, ?, ?, ?${withSource ? ', ?' : ''})`, withSource ? l : l.slice(0, 4));
      await datasets.save(meta.id);
      return datasets.get(meta.id);
    }
    // The row keeps '{AB12-UPPER}'; its link says 'ab12-upper' and has no document; the other link is one the text only gives.
    const linked = await made('ÖP id-former', [['st_1', 'ab12-upper', '', 'Ställningstagande', 'modell'], ['st_2', 'B2', 'text.docx', 'Ställningstagande', 'text']], true);
    const bare = await made('ÖP utan kopplingar', [], false);
    await withApp(async (shell) => {
      let pv = await planView(shell, linked, tiles().factory);
      try {
        const { right, center } = pv.where;
        const sectionsOf = () => Array.from(right.querySelectorAll('[data-plan-object-sections] [data-plan-object-section]')).map((li) => li.getAttribute('data-plan-object-section'));
        drawnFor(pv.view, '{AB12-UPPER}')[0].fire('click');
        await waitFor(() => sectionsOf().join() === 'st_1', 3000, 'found in spite of case, braces and an empty document');
        assert.ok(!right.querySelector('[data-plan-object-section="st_1"] [data-plan-link-text]'), 'a link of the model is no inferred one');
        drawnFor(pv.view, 'b2')[0].fire('click');
        await waitFor(() => sectionsOf().join() === 'st_2', 3000, 'by its id in other case');
        assert.ok(right.querySelector('[data-plan-object-section="st_2"] [data-plan-link-text]').textContent === t('plan.link.text'), 'Nämnd i texten');
        assert.ok(center.querySelector('[data-plan-section="st_2"] [data-plan-link-text]'), 'and in the text beside the map');
        drawnFor(pv.view, '')[0].fire('click');
        await waitFor(() => right.querySelector('[data-plan-object-note="plan.sections.object.noid"]'), 3000, 'an area without identity says so');
        pv.close();
        pv = await planView(shell, bare, tiles().factory);
        drawnFor(pv.view, 'b2')[0].fire('click');
        await waitFor(() => pv.where.right.querySelector('[data-plan-object-note="plan.sections.object.nolinks"]'), 3000, 'a plan without links says so');
        tab(pv.where, t('plan.tab.files')).click();
        const links = /** @type {HTMLElement} */ (pv.where.center.querySelector('[data-plan-files] [data-plan-links]'));
        assert.equal(links.getAttribute('data-plan-links'), '0', 'Filer counts no links');
        assert.ok(links.querySelector('[data-plan-links-why]').textContent.includes(t('plan.links.why.notable')), 'and says why');
        assert.ok(links.querySelector('[data-plan-relink]'), 'with Läs kopplingarna igen');
        // A rectangle over all three chooses them; the union is still nothing, and that is said.
        const L = /** @type {any} */ (globalThis).L;
        pv.view.selectBox(L.latLngBounds([58.49, 15.99], [58.52, 16.06]));
        await waitFor(() => pv.where.right.querySelector('[data-plan-picked="3"]') && pv.where.right.querySelector('[data-plan-object-note="plan.sections.object.nolinks"]'), 3000, 'three chosen, no links');
      } finally { pv.close(); }
    });
    // The box test itself: inside, over a corner, across, around, a hole, a line through, a point outside.
    const pl = D.require('data/plan-links');
    const sq = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };
    const holed = { type: 'Polygon', coordinates: sq.coordinates.concat([[[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]]]) };
    assert.ok(pl.boxHits(sq, [2, 2, 3, 3]) && pl.boxHits(sq, [-1, -1, 1, 1]) && pl.boxHits(sq, [-5, 4, 15, 5]) && pl.boxHits(sq, [-1, -1, 11, 11]) && !pl.boxHits(sq, [11, 11, 12, 12]));
    assert.ok(!pl.boxHits(holed, [4, 4, 5, 5]) && pl.boxHits(holed, [1, 1, 3, 3]), 'a box in a hole meets nothing');
    assert.ok(pl.boxHits({ type: 'LineString', coordinates: [[-5, 5], [15, 5]] }, [4, 4, 6, 6]) && !pl.boxHits({ type: 'Point', coordinates: [1, 1] }, [2, 2, 3, 3]));
    return 'ok';
  }, 60000);

  test('op view: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id).catch(() => {});
    assert.ok(true);
  });
})();
