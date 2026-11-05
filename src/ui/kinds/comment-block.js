// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Comments in one place: a line per comment for the list in Hantera, and a small block for an object's inspector (a page, a
 * picture, a node, an element, a plan object, a place). A comment on an object remembers how to get back to it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/comment-block', ['ui/base', 'data/comments', 'data/kinds'], (base, comments, kinds) => {
    const { h, t, i18n, replace } = base;

    /**
     * What a comment on an object needs: a key that says which object, a name for it, and the way back.
     * @param {any} ds @param {string} key @param {string} label @param {(column: string) => any} value reads a column of the object
     * @returns {{key: string, label: string, open: any}}
     */
    function targetOf(ds, key, label, value) {
      const hit = kinds.of(ds).hit;
      return { key, label, open: hit ? hit(value, ds.id).store : null };
    }
    /** A place in a table has no kind of its own to ask. */
    function placeTarget(ds, rowid, label) {
      return { key: `row:${rowid}`, label, open: { openMapRow: { datasetId: ds.id, rowid } } };
    }
    /** Back to the object in Bearbeta. The dataset may have a new id after a bundle, so the id is set here. */
    function openTarget(ctx, ds, target) {
      const store = JSON.parse(JSON.stringify(target.open));
      for (const v of Object.values(store)) /** @type {any} */ (v).datasetId = ds.id;
      ctx.store.set(Object.assign({ selectedId: ds.id }, store));
      ctx.shell.activate('bearbeta');
    }
    /** One line in a list of comments. @param {any} ctx @param {any} ds @param {any} c @param {() => void} again */
    function line(ctx, ds, c, again, options = {}) {
      const { ui } = ctx;
      const about = options.showTarget && c.target ? c.target.label : '';
      return h('li', { class: 'dm-list-item dm-list-item-static' }, ui.icon(c.resolved ? 'check' : 'message-square', 14),
        h('span', { class: 'dm-list-main' + (c.resolved ? ' dm-muted' : '') },
          h('span', { class: 'dm-small', text: [c.author || t('comments.anonymous'), i18n.formatDateTime(c.ts), c.column, about, c.resolved ? t('comments.resolved') : ''].filter(Boolean).join(' · ') }),
          h('span', { text: c.text })),
        options.showTarget && c.target && c.target.open ? ui.button({ label: t('comments.show'), icon: 'eye', variant: 'ghost', title: t('comments.show.hint'), onClick: () => openTarget(ctx, ds, c.target) }) : null,
        ui.button({ label: c.resolved ? t('comments.reopen') : t('comments.resolve'), variant: 'ghost', onClick: async () => { await comments.setResolved(ds.id, c.id, !c.resolved); again(); } }),
        ui.button({ label: t('common.delete'), icon: 'trash-2', 'icon-only': true, variant: 'ghost', onClick: async () => {
          if (await ui.dialog.confirm(t('comments.delete.confirm'), { okLabel: t('common.delete'), danger: true })) { await comments.remove(ds.id, c.id); again(); }
        } }));
    }
    /**
     * The block for an object's inspector.
     * @param {any} ctx @param {any} ds @param {{key: string, label: string, open: any}} target @returns {HTMLElement}
     */
    function create(ctx, ds, target) {
      const { ui } = ctx;
      const holder = h('div', { class: 'dm-stack-sm dm-object-comments' });
      const draw = async () => {
        const list = (await comments.list(ds.id)).filter((c) => c.target && c.target.key === target.key);
        const text = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '2', label: t('comments.new') }));
        replace(holder,
          h('h4', { text: t('comments.title') }),
          list.length ? h('ul', { class: 'dm-list' }, list.map((c) => line(ctx, ds, c, () => draw().catch((err) => D.log('comments', err))))) : null,
          text,
          h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('comments.add'), icon: 'message-square', size: 'sm', onClick: async () => {
            try {
              await comments.add(ds.id, { text: text.value, target });
              ctx.shell.log(t('comments.added'), 'ok');
              await draw();
            } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
          } })));
      };
      draw().catch((err) => D.log('comments', err));
      return holder;
    }

    return { targetOf, placeTarget, openTarget, line, create };
  });
})();
