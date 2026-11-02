// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Tests for the user-triggered update check (GitHub Releases) with a stubbed fetcher. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const updates = D.require('platform/updates');

  test('updates: version comparison and release check with a stubbed GitHub response', async (assert) => {
    assert.equal(updates.compareVersions('1.0.0', '1.0.0'), 0);
    assert.equal(updates.compareVersions('1.0.0-fas7', 'v1.0.0'), 0);
    assert.equal(updates.compareVersions('0.7.0', '1.0.0'), -1);
    assert.equal(updates.compareVersions('1.2.0', '1.1.9'), 1);
    assert.equal(updates.compareVersions('1.10.0', '1.9.0'), 1);
    assert.deepEqual(updates.parseVersion('v2.10.3'), [2, 10, 3]);
    assert.equal(updates.parseVersion('senaste'), null);
    let requested = '';
    const fetchJson = async (url) => { requested = url; return { tag_name: 'v1.1.0', html_url: 'https://github.com/marwiss/Dataspatium/releases/tag/v1.1.0', published_at: '2026-12-01T00:00:00Z' }; };
    const res = await updates.check({ fetchJson, current: '1.0.0' });
    assert.equal(requested, updates.API_URL);
    assert.ok(res.newer, 'newer');
    assert.equal(res.latest, '1.1.0');
    assert.ok(res.url.endsWith('v1.1.0'), res.url);
    const same = await updates.check({ fetchJson: async () => ({ tag_name: 'v1.0.0' }), current: '1.0.0' });
    assert.ok(!same.newer, 'same version is not newer');
    assert.equal(same.url, updates.RELEASES_URL, 'falls back to the releases page');
    await assert.throws(() => updates.check({ fetchJson: async () => { throw new Error('offline'); } }), /internetanslutningen/);
    await assert.throws(() => updates.check({ fetchJson: async () => ({ tag_name: 'senaste' }) }), /versionsnummer/);
    return `latest ${res.latest}`;
  });
})();
