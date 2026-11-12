// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the start profile (`?profil=start`, platform/startup-profile): the summary of fake marks, resource entries and
 * long tasks, its lines, and that nothing is marked on a page without the parameter.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const P = D.require('platform/startup-profile');
  /** @param {string} name @param {number} t */
  const m = (name, t) => ({ name: 'dataspatium:' + name, startTime: t });

  test('startup profile: the summary times each script, its own share, the folder groups, the bytes and the long tasks', async (assert) => {
    const marks = [m('boot', 10), m('insert:src/platform/registry.js', 11), m('insert:src/ui/i18n/sv.js', 12), m('insert:vendor/manifest.js', 13),
      m('load:src/platform/registry.js', 20), m('dom-content-loaded', 30), m('load:src/ui/i18n/sv.js', 120), m('load:vendor/manifest.js', 125),
      m('ready', 130), m('first-render', 400), { name: 'someone-else', startTime: 5 }];
    const resources = [
      { name: 'http://127.0.0.1:8092/src/platform/registry.js', decodedBodySize: 2048, transferSize: 900 },
      { name: 'http://127.0.0.1:8092/src/ui/i18n/sv.js?v=1', decodedBodySize: 307200, transferSize: 80000 },
      { name: 'http://127.0.0.1:8092/src/ui/design/base.css', decodedBodySize: 5120, transferSize: 1500 },
    ];
    const s = P.summarize({ marks, resources, longTasks: [{ startTime: 30, duration: 92 }, { startTime: 200, duration: 40 }], paints: [{ name: 'first-contentful-paint', startTime: 90 }], protocol: 'http:', page: 'full' });
    assert.deepEqual(s.timeline, { boot: 10, domContentLoaded: 30, scriptsDone: 125, ready: 130, firstRender: 400, bootError: null });
    // total = load - insertion; own = load - the later of insertion and the previous load (boot for the first).
    assert.deepEqual(s.scripts.map((x) => [x.path, x.group, x.total, x.own, x.bytes]), [
      ['src/platform/registry.js', 'src/platform', 9, 9, 2048], ['src/ui/i18n/sv.js', 'src/ui/i18n', 108, 100, 307200], ['vendor/manifest.js', 'vendor', 112, 5, null]]);
    assert.deepEqual(s.slowest.map((x) => x.path), ['vendor/manifest.js', 'src/ui/i18n/sv.js', 'src/platform/registry.js'], 'slowest by load minus insertion');
    assert.deepEqual(s.groups, [{ group: 'src/ui/i18n', scripts: 1, own: 100, bytes: 307200 }, { group: 'src/platform', scripts: 1, own: 9, bytes: 2048 }, { group: 'vendor', scripts: 1, own: 5, bytes: null }]);
    assert.deepEqual([s.bytes.available, s.bytes.counted, s.bytes.scripts, s.bytes.resources, s.bytes.all, s.bytes.transferred], [true, 2, 309248, 3, 314368, 82400]);
    assert.deepEqual(s.bytes.largest.map((x) => x.path), ['src/ui/i18n/sv.js', 'src/platform/registry.js']);
    assert.deepEqual(s.longTasks, { supported: true, count: 1, total: 92, longest: 92, items: [{ start: 30, duration: 92, scripts: ['src/ui/i18n/sv.js'] }] }, 'only tasks over 50 ms, with the script that ran in it');
    const lines = P.lines(s);
    assert.equal(lines[0], 'profil start: full page over http:, 3 scripts; from navigation start: boot 10 ms, DOMContentLoaded 30 ms, last script 125 ms, ready 130 ms, first render 400 ms');
    for (const line of ['profil paint: first-contentful-paint 90 ms', 'profil slowest 2: src/ui/i18n/sv.js 108 ms from insertion to load (own 100 ms, 300.0 kB)',
      'profil group: src/ui/i18n 1 script, own 100 ms, 300.0 kB', 'profil largest 1: src/ui/i18n/sv.js 300.0 kB', 'profil long task: 92 ms at 30 ms during src/ui/i18n/sv.js']) {
      assert.ok(lines.includes(line), 'line: ' + line + ' in ' + lines.join(' / '));
    }
    assert.ok(lines.every((l) => l.startsWith('profil ') && !/["\n]/.test(l)), 'one line each, no quotes for the runner');
    return lines.length + ' lines';
  });

  test('startup profile: from file:// without sizes or long tasks the lines say so, and the folder groups follow the paths', async (assert) => {
    const s = P.summarize({ marks: [m('boot', 5), m('insert:src/app.js', 6), m('load:src/app.js', 50), m('ready', 60)], resources: [{ name: 'file:///C:/x/src/app.js', decodedBodySize: 0 }],
      longTasks: null, navigation: { domContentLoadedEventStart: 42 }, protocol: 'file:', page: 'mobile', error: 'no first render' });
    assert.deepEqual(s.timeline, { boot: 5, domContentLoaded: 42, scriptsDone: 50, ready: 60, firstRender: null, bootError: null }, 'DOMContentLoaded from the navigation entry without a mark');
    assert.equal(s.bytes.available, false);
    assert.equal(s.longTasks.supported, false);
    const lines = P.lines(s);
    assert.ok(lines.includes('profil bytes: not reported by the browser over file: (from a web server the bytes per file are listed)'), lines.join(' / '));
    assert.ok(lines.includes('profil long tasks: not reported by this browser'));
    assert.equal(lines[lines.length - 1], 'profil error: no first render');
    assert.ok(lines[0].includes('mobile page') && lines[0].includes('first render -'), lines[0]);
    assert.deepEqual(['src/app.js', 'src/api/families/pxweb.js', 'src/ui/modes/hantera.js', 'src/ui/ask.js', 'src/ui/bearbeta/model-view.js', 'vendor/manifest.js', 'presets/presets.js'].map(P.groupOf),
      ['src', 'src/api', 'src/ui/modes', 'src/ui', 'src/ui/bearbeta', 'vendor', 'presets']);
    return 'ok';
  });

  test('startup profile: a page without ?profil=start marks nothing, even when the app has drawn', async (assert) => {
    P.rendered();
    await new Promise((r) => setTimeout(r, 50));
    const ours = performance.getEntriesByType('mark').filter((x) => x.name.startsWith('dataspatium:'));
    assert.equal(ours.length, 0, ours.map((x) => x.name).slice(0, 5).join(', '));
    return 'ok';
  });
})();
