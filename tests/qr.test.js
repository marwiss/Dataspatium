// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for ui/qr: module matrix, SVG element and PNG from the vendored generator. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const qr = D.require('ui/qr');

  test('qr: a text becomes a module matrix, an SVG element and a PNG', async (assert) => {
    const rows = await qr.matrix('https://marwiss.github.io/Dataspatium/m/#o=abc');
    assert.ok(rows.length >= 21 && rows.length % 4 === 1, 'a QR version: ' + rows.length + ' modules');
    assert.ok(rows.every((r) => r.length === rows.length), 'square');
    // The finder pattern: the top-left 7×7 corner is dark around the border.
    assert.ok(rows[0].slice(0, 7).every(Boolean) && rows[6].slice(0, 7).every(Boolean), 'finder pattern present');
    const svg = await qr.element('Dataspatium', { size: 120, label: 'QR' });
    assert.equal(svg.tagName.toLowerCase(), 'svg');
    assert.equal(svg.getAttribute('width'), '120');
    assert.equal(svg.getAttribute('aria-label'), 'QR');
    const path = svg.querySelector('path');
    assert.ok(path && /^M\d+ \d+h\d+v1h-\d+z/.test(path.getAttribute('d') || ''), 'dark modules as one path');
    assert.ok(!svg.querySelector('text'), 'no text nodes');
    const png = await qr.png('Dataspatium', { scale: 2 });
    assert.equal(png.type, 'image/png');
    assert.ok(png.size > 100, 'png has content');
    // A long payload still fits (version grows; the generator picks the smallest).
    const long = await qr.matrix('x'.repeat(700));
    assert.ok(long.length > rows.length, 'larger version for more data: ' + long.length);
    return rows.length + ' modules';
  });
})();
