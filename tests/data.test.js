// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for type inference, value parsing and encoding detection. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const types = D.require('data/types');
  const encoding = D.require('data/encoding');

  test('types: Swedish numbers, dates, booleans and identifiers', (assert) => {
    assert.equal(types.detectType(['1 234,5', '2,0', '-3']).type, 'number');
    assert.deepEqual(types.detectType(['1 234,5', '2,0']).decimal, 'comma');
    assert.equal(types.detectType(['1,234.5', '2.0']).decimal, 'point');
    assert.equal(types.detectType(['1', '2', '', null, '3']).type, 'integer');
    assert.equal(types.detectType(['0123', '0456']).type, 'text', 'leading zeros stay text');
    assert.equal(types.detectType(['198501011234', '200012319876']).type, 'integer');
    assert.equal(types.detectType(['2024-01-31', '31/12/2024', '1.2.2023']).type, 'date');
    assert.equal(types.detectType(['2024-01-31 10:00', '2024-01-31T10:00:00Z']).type, 'datetime');
    assert.equal(types.detectType(['Ja', 'nej', 'ja']).type, 'boolean');
    assert.equal(types.detectType(['Stockholm', '12']).type, 'text');
    assert.equal(types.detectType([]).type, 'text');
    assert.equal(types.parseValue('1 234,5', 'number', { decimal: 'comma' }), 1234.5);
    assert.equal(types.parseValue('1,234.5', 'number', { decimal: 'point' }), 1234.5);
    assert.equal(types.parseValue('1.5e3', 'number', { decimal: 'comma' }), 1500);
    assert.equal(types.parseValue('31/12/2024', 'date'), '2024-12-31');
    assert.equal(types.parseValue('2024-01-31T10:05:00Z', 'datetime'), '2024-01-31 10:05:00');
    assert.equal(types.parseValue('nej', 'boolean'), 0);
    assert.equal(types.parseValue('  ', 'integer'), null);
    assert.equal(types.parseValue(new Date(2024, 0, 31), 'date'), '2024-01-31');
    assert.deepEqual(types.cleanColumnNames(['a', 'A', '', 'b']), ['a', 'A_2', 'kolumn_3', 'b']);
    const inferred = types.inferColumns(['id', 'tal', 'datum'], [['001', '1,5', '2024-01-01'], ['002', '2', '2024-02-01']]);
    assert.deepEqual(inferred.map((c) => c.type), ['text', 'number', 'date']);
  });

  test('encoding: BOM, UTF-8, Windows-1252 and UTF-16 detection', async (assert) => {
    const enc = new TextEncoder();
    assert.equal(encoding.detect(enc.encode('kommun;befolkning\nGöteborg;1')).encoding, 'utf-8');
    assert.equal(encoding.detect(new Uint8Array([0xef, 0xbb, 0xbf, 0x61])).bom, true);
    const cp1252 = new Uint8Array([0x47, 0xf6, 0x74, 0x65, 0x62, 0x6f, 0x72, 0x67]); // "Göteborg" in Windows-1252
    const det = encoding.detect(cp1252);
    assert.equal(det.encoding, 'windows-1252');
    assert.equal(encoding.decode(cp1252, det.encoding), 'Göteborg');
    const utf16 = new Uint8Array([0xff, 0xfe, 0x47, 0x00, 0xf6, 0x00]);
    assert.equal(encoding.detect(utf16).encoding, 'utf-16le');
    const file = new File([cp1252], 'test.csv');
    const read = await encoding.readText(file);
    assert.equal(read.text, 'Göteborg');
    assert.equal(read.encoding, 'windows-1252');
  });
})();
