// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the R session: webR from embedded assets, the Dataspatium R helpers and the bridge. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const { bridge } = D.require('data/r-bridge');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const created = [];
  const stdoutOf = (res) => res.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('');

  test('r: webR starts from embedded assets and dm_read restores Dataspatium types', async (assert) => {
    const file = new File(['kommun;kod;befolkning;andel;datum;aktiv\nStockholm;0180;984748;9,37;2024-12-31;ja\nGöteborg;1480;596841;5,68;2024-12-31;nej\n'], 'bryggtest.csv', { type: 'text/csv' });
    const meta = await importer.run(file, {}, null, 'Bryggtest');
    created.push(meta.id);
    await D.require('data/recipes').apply(meta.id, 'set_label', { column: 'befolkning', label: 'Folkmängd', description: 'Antal invånare', unit: 'personer' });
    await bridge.start();
    assert.ok(/^R version 4\./.test(bridge.version), bridge.version);
    const listed = await bridge.run('x <- dm_list(); cat("Bryggtest" %in% x$namn, "bryggtest" %in% x$kortnamn)');
    assert.equal(stdoutOf(listed).trim(), 'TRUE TRUE', 'dm_list with short names: ' + JSON.stringify(listed.entries));
    const read = await bridge.run('df <- dm_read("Bryggtest"); cat(nrow(df), class(df$datum), class(df$befolkning), class(df$aktiv), df$kod[1], df$andel[1], attr(df$befolkning, "label"), attr(df$befolkning, "description"), attr(df$befolkning, "unit"), is.null(attr(df$kommun, "label")), sep = "|")');
    assert.equal(stdoutOf(read).trim(), '2|Date|integer|logical|0180|9.37|Folkmängd|Antal invånare|personer|TRUE', JSON.stringify(read.entries));
    const filtered = await bridge.run('cat(nrow(dm_read("bryggtest", columns = "kommun", where = "befolkning > 600000")))');
    assert.equal(stdoutOf(filtered).trim(), '1');
    const modelMeta = await importer.run(D.require('tests/fixtures/ifc').ifcFile(), { format: 'model' }, null, 'Rmodell');
    created.push(modelMeta.id);
    const modelRead = await bridge.run('q <- dm_read_quantities("Rmodell"); p <- dm_read_properties("Rmodell"); cat(nrow(q), sum(q$varde[q$namn == "NetVolume"]), nrow(dm_read("Rmodell")), "FireRating" %in% p$namn)');
    assert.equal(modelRead.entries.filter((e) => e.kind === 'stdout').map((e) => e.text).join('').trim(), '12 8 10 TRUE', JSON.stringify(modelRead.entries));
    return `${bridge.version}; startup ${Math.round(bridge.startupMs)} ms`;
  }, 180000);

  test('r: plots are captured and exported, dm_write creates a dataset, errors are reported', async (assert) => {
    const plotted = await bridge.run('plot(1:10, main = "Bryggtest")');
    const plot = plotted.entries.find((e) => e.kind === 'plot');
    assert.ok(plot && plot.key, 'plot entry with key: ' + JSON.stringify(plotted.entries.map((e) => e.kind)));
    assert.ok(plot.canvas && plot.canvas.width > 100, 'canvas width ' + (plot.canvas && plot.canvas.width));
    const px = plot.canvas.getContext('2d').getImageData(0, 0, plot.canvas.width, plot.canvas.height).data;
    let dark = 0;
    for (let i = 0; i < px.length; i += 4 * 101) if (px[i] < 200 || px[i + 1] < 200 || px[i + 2] < 200) dark++;
    assert.ok(dark > 50, 'plot has drawn pixels: ' + dark);
    const svg = await bridge.exportPlot(plot.key, 'svg');
    assert.ok((await svg.text()).includes('<svg'), 'svg export');
    const pdf = await bridge.exportPlot(plot.key, 'pdf');
    assert.equal(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0, 5)), '%PDF-');
    const written = await bridge.run('x <- data.frame(a = 1:3, b = c("x", "y", "z"), d = as.Date("2024-01-01") + 0:2, ok = c(TRUE, FALSE, TRUE)); attr(x$a, "label") <- "Antal"; attr(x$a, "unit") <- "st"; dm_write(x, "Från R", descriptions = c(a = "Löpnummer"))');
    const ds = written.entries.find((e) => e.kind === 'dataset');
    assert.ok(ds, 'dataset entry: ' + JSON.stringify(written.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 80))));
    created.push(ds.meta.id);
    assert.equal(ds.meta.name, 'Från R');
    const cols = await datasets.columns(ds.meta.id);
    assert.deepEqual(cols.map((c) => c.type), ['integer', 'text', 'date', 'boolean']);
    assert.equal(cols[0].label, 'Antal'); assert.equal(cols[0].unit, 'st'); assert.equal(cols[0].description, 'Löpnummer'); assert.equal(cols[1].unit, null);
    const rows = await datasets.query(ds.meta.id);
    assert.deepEqual(rows[0], [1, 'x', '2024-01-01', 1]);
    const failed = await bridge.run('stop("testfel")');
    assert.ok(failed.entries.some((e) => e.kind === 'error' && e.text.includes('testfel')), JSON.stringify(failed.entries));
    const gg = await bridge.run('library(ggplot2); print(ggplot(data.frame(x = 1:3, y = c(2, 4, 3)), aes(x, y)) + geom_col())');
    assert.ok(gg.entries.some((e) => e.kind === 'plot'), 'ggplot2 plot: ' + JSON.stringify(gg.entries.map((e) => e.kind + ':' + (e.text || '').slice(0, 120))));
    return 'ok';
  }, 180000);

  test('r: running code stops with interrupt() when the page is cross-origin isolated (from a web server)', async (assert) => {
    if (!bridge.canInterrupt) {
      assert.ok(!D.capabilities.sharedArrayBuffer, 'no SharedArrayBuffer without isolation');
      assert.equal(bridge.interrupt(), false, 'nothing to stop');
      return 'not isolated (file://): only a restart helps';
    }
    await bridge.start();
    assert.ok(bridge.engine.interruptible, 'the SharedArrayBuffer channel is used');
    const running = bridge.run('x <- 0\nwhile (TRUE) x <- x + 1');
    await new Promise((r) => setTimeout(r, 1500));
    assert.ok(bridge.interrupt(), 'the interrupt is sent');
    const res = await running;
    assert.ok(res.entries.some((e) => e.kind === 'error' && e.text === D.t('r.interrupted')), JSON.stringify(res.entries));
    const after = await bridge.run('cat(x > 0, 1 + 1)');
    assert.equal(stdoutOf(after).trim(), 'TRUE 2', 'the session and its objects remain');
    return 'stopped after ' + Math.round(res.ms) + ' ms';
  }, 120000);

  test('r: cleanup', async (assert) => {
    for (const id of created) await datasets.remove(id);
    assert.ok(true);
  });
})();
