// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for GitHub sync (platform/storage/github-store.js through data/workspace.js) against an in-memory GitHub:
 * blobs, trees, commits and branch refs with the same rules as the REST API (blob hashes as in git, fast-forward
 * only, raw blob downloads, the contents API for the first commit of an empty repository).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const datasets = D.require('data/datasets');
  const recipes = D.require('data/recipes');
  const workspace = D.require('data/workspace');
  const github = D.require('platform/storage/github');
  const t = D.require('ui/i18n').t;
  const created = [];
  let savedConfig = null;

  /** An in-memory GitHub with one repository "test/data"; `empty` starts it without commits. */
  function fakeGitHub(options = {}) {
    const blobs = new Map(); const trees = new Map(); const commits = new Map(); const refs = new Map();
    const calls = [];
    let n = 0;
    const id = () => (++n).toString(16).padStart(40, '0');
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    function commitFiles(files, message, parent) {
      const tree = id(); trees.set(tree, new Map(files));
      const sha = id(); commits.set(sha, { tree, message, parents: parent ? [parent] : [] });
      return sha;
    }
    if (!options.empty) refs.set('main', commitFiles([['README.md', 'r0']], 'Initial', null));
    blobs.set('r0', new TextEncoder().encode('# test\n'));
    async function handle(url, init) {
      const method = (init && init.method) || 'GET';
      const headers = (init && init.headers) || {};
      const body = init && init.body ? JSON.parse(init.body) : null;
      const u = new URL(url);
      calls.push(`${method} ${u.pathname}`);
      if (headers.Authorization !== 'Bearer good') return json(401, { message: 'Bad credentials' });
      const m = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(u.pathname);
      if (!m || `${m[1]}/${m[2]}` !== 'test/data') return json(404, { message: 'Not Found' });
      const path = m[3] || '';
      let r;
      if (method === 'GET' && path === '') return json(200, { full_name: 'test/data', default_branch: 'main', size: refs.size ? 1 : 0 });
      if ((r = /^\/git\/ref\/heads\/(.+)$/.exec(path)) && method === 'GET') {
        if (!refs.size) return json(409, { message: 'Git Repository is empty.' });
        return refs.has(r[1]) ? json(200, { ref: `refs/heads/${r[1]}`, object: { sha: refs.get(r[1]) } }) : json(404, { message: 'Not Found' });
      }
      if ((r = /^\/git\/commits\/(\w+)$/.exec(path)) && method === 'GET') return commits.has(r[1]) ? json(200, { sha: r[1], tree: { sha: commits.get(r[1]).tree } }) : json(404, { message: 'Not Found' });
      if ((r = /^\/git\/trees\/(\w+)$/.exec(path)) && method === 'GET') {
        const tree = trees.get(r[1]);
        return json(200, { sha: r[1], truncated: false, tree: Array.from(tree, ([p, sha]) => ({ path: p, type: 'blob', mode: '100644', sha, size: blobs.get(sha).byteLength })) });
      }
      if ((r = /^\/git\/blobs\/(\w+)$/.exec(path)) && method === 'GET') return new Response(blobs.get(r[1]), { status: 200 });
      if (path === '/git/blobs' && method === 'POST') {
        const bytes = fromB64(body.content);
        const sha = await github.blobSha(bytes);
        blobs.set(sha, bytes);
        return json(201, { sha });
      }
      if (path === '/git/trees' && method === 'POST') {
        const tree = new Map(trees.get(body.base_tree));
        for (const e of body.tree) { if (e.sha === null) tree.delete(e.path); else tree.set(e.path, e.sha); }
        const sha = id(); trees.set(sha, tree);
        return json(201, { sha });
      }
      if (path === '/git/commits' && method === 'POST') {
        const sha = id(); commits.set(sha, { tree: body.tree, message: body.message, parents: body.parents });
        return json(201, { sha });
      }
      if ((r = /^\/git\/refs\/heads\/(.+)$/.exec(path)) && method === 'PATCH') {
        const parent = commits.get(body.sha).parents[0];
        if (options.reject || parent !== refs.get(r[1])) return json(422, { message: 'Update is not a fast forward' });
        refs.set(r[1], body.sha);
        return json(200, { object: { sha: body.sha } });
      }
      if (path === '/git/refs' && method === 'POST') { refs.set(body.ref.replace('refs/heads/', ''), body.sha); return json(201, {}); }
      if ((r = /^\/contents\/(.+)$/.exec(path)) && method === 'PUT') {
        const bytes = fromB64(body.content);
        const sha = await github.blobSha(bytes);
        blobs.set(sha, bytes);
        const base = refs.get(body.branch);
        const files = base ? Array.from(trees.get(commits.get(base).tree)) : [];
        refs.set(body.branch, commitFiles(files.concat([[r[1], sha]]), body.message, base || null));
        return json(201, {});
      }
      return json(404, { message: 'Not Found: ' + method + ' ' + path });
    }
    /** Files of the branch head as path -> blob sha. */
    function head(branch = 'main') { return trees.get(commits.get(refs.get(branch)).tree); }
    return { fetch: handle, head, commits, refs, calls, setReject(v) { options.reject = v; } };
  }

  const make = async (name, n) => {
    const meta = await datasets.create({ name, columns: [{ name: 'kommun', type: 'text', label: 'kommun' }, { name: 'folk', type: 'integer', label: 'folk' }], rows: [['Uppsala', n]] });
    created.push(meta.id);
    return meta.id;
  };

  test('github: the repository name is read from several forms and blob hashes match git', async (assert) => {
    assert.deepEqual(github.parseRepo('test/data'), { owner: 'test', repo: 'data' });
    assert.deepEqual(github.parseRepo('https://github.com/test/data.git'), { owner: 'test', repo: 'data' });
    assert.deepEqual(github.parseRepo('github.com/test/data/'), { owner: 'test', repo: 'data' });
    assert.equal(github.parseRepo('bara-ett-ord'), null);
    // `git hash-object` of "hello\n" is ce013625030ba8dba906f756967f9e9ca394464a.
    assert.equal(await github.blobSha(new TextEncoder().encode('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
  });

  test('github: a push writes the workspace in one commit, skips what is unchanged and removes deleted datasets', async (assert) => {
    savedConfig = await workspace.githubConfig();
    const gh = fakeGitHub();
    await workspace.setGithubConfig({ repo: 'test/data', branch: 'main', path: 'dataspatium' });
    const a = await make('Synk A', 1);
    const b = await make('Synk B', 2);
    let res = await workspace.pushToGitHub({ token: 'good', message: 'Första', fetch: gh.fetch });
    assert.ok(res.commit && res.written >= 3, JSON.stringify(res));
    let files = gh.head();
    for (const path of ['README.md', 'dataspatium/manifest.json', `dataspatium/datasets/${a}.sqlite`, `dataspatium/datasets/${b}.sqlite`]) assert.ok(files.has(path), path + ' in the repository');
    assert.equal(gh.commits.get(gh.refs.get('main')).message, 'Första');
    assert.ok((await workspace.githubConfig()).lastPush, 'the time is remembered');
    // Nothing changed: no commit (the manifest's time stamp alone does not count).
    const commits = gh.commits.size;
    res = await workspace.pushToGitHub({ token: 'good', fetch: gh.fetch });
    assert.equal(res.commit, null);
    assert.equal(gh.commits.size, commits, 'no new commit');
    // A changed dataset is written again, a removed one is removed; files outside the workspace layout stay.
    await recipes.apply(a, 'set_label', { column: 'folk', label: 'Folkmängd' });
    await datasets.save(a);
    await datasets.remove(b);
    res = await workspace.pushToGitHub({ token: 'good', fetch: gh.fetch });
    files = gh.head();
    assert.ok(res.written >= 1 && res.removed === 1, JSON.stringify(res));
    assert.ok(!files.has(`dataspatium/datasets/${b}.sqlite`), 'removed dataset');
    assert.ok(files.has('README.md'), 'other files are left alone');
    return gh.commits.size + ' commits';
  }, 60000);

  test('github: a fetch adds what is missing and replaces on request; errors say what to do', async (assert) => {
    const gh = fakeGitHub();
    const a = await make('Hämtas A', 10);
    const b = await make('Hämtas B', 20);
    await workspace.pushToGitHub({ token: 'good', fetch: gh.fetch });
    await recipes.apply(a, 'set_label', { column: 'folk', label: 'Ändrad lokalt' });
    await datasets.remove(b);
    const fetched = await workspace.fetchFromGitHub({ token: 'good', fetch: gh.fetch });
    assert.ok(fetched.existing.some((d) => d.id === a), 'A exists here');
    assert.ok(!fetched.existing.some((d) => d.id === b), 'B does not');
    const res = await workspace.restoreFromGitHub(fetched, { replaceIds: [a] });
    assert.ok(res.imported.some((m) => m.name === 'Hämtas B'), 'B is added again');
    created.push(...res.imported.map((m) => m.id));
    assert.equal(res.replaced.length, 1, 'replaced; skipped: ' + JSON.stringify(res.skipped));
    assert.equal((await datasets.columns(a))[1].label, 'folk', 'A as in the repository');
    const versions = await datasets.listVersions(a);
    assert.ok(versions.some((v) => v.label === t('bundle.replaced.version', { name: 'test/data' })), 'the local A is kept as a version');
    // Errors.
    const message = async (fn) => { try { await fn(); return ''; } catch (err) { return err.message; } };
    assert.equal(await message(() => workspace.pushToGitHub({ token: 'bad', fetch: gh.fetch })), t('github.err.token'));
    assert.equal(await message(() => workspace.pushToGitHub({ token: '', fetch: gh.fetch })), t('github.err.notoken'));
    await recipes.apply(a, 'set_label', { column: 'folk', label: 'Igen' });
    gh.setReject(true);
    assert.equal(await message(() => workspace.pushToGitHub({ token: 'good', fetch: gh.fetch })), t('github.err.behind'));
    gh.setReject(false);
    await workspace.setGithubConfig({ repo: 'test/finns-inte' });
    assert.equal(await message(() => workspace.pushToGitHub({ token: 'good', fetch: gh.fetch })), t('github.err.notfound'));
    await workspace.setGithubConfig({ repo: 'inget repo' });
    assert.equal(await message(() => workspace.pushToGitHub({ token: 'good', fetch: gh.fetch })), t('github.err.repo'));
    return 'ok';
  }, 60000);

  test('github: an empty repository gets a first commit, and a new branch starts from the default one', async (assert) => {
    const gh = fakeGitHub({ empty: true });
    await workspace.setGithubConfig({ repo: 'test/data', branch: 'main', path: 'dataspatium' });
    const res = await workspace.pushToGitHub({ token: 'good', fetch: gh.fetch });
    assert.ok(res.commit, 'pushed');
    assert.ok(gh.head().has('README.md') && gh.head().has('dataspatium/manifest.json'), Array.from(gh.head().keys()).join(', '));
    await workspace.setGithubConfig({ branch: 'arbete' });
    await workspace.pushToGitHub({ token: 'good', message: 'Egen gren', fetch: gh.fetch });
    assert.ok(gh.refs.has('arbete'), 'the branch is made');
    assert.ok(gh.calls.includes('PUT /repos/test/data/contents/README.md'), 'the contents API made the first commit');
    return gh.refs.size + ' branches';
  }, 60000);

  test('github: cleanup', async (assert) => {
    for (const id of created) { try { await datasets.remove(id); } catch (_err) { /* ignore */ } }
    if (savedConfig) await workspace.setGithubConfig(savedConfig);
    assert.ok(true);
  });
})();
