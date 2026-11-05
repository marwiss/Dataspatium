// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The pictures of a row, for an inspector: thumbnails that open the picture in its collection. `data/media` finds them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/row-pictures', ['ui/base'], (base) => {
    const { h, t } = base;

    /**
     * Put thumbnails in an element.
     * @param {HTMLElement} el @param {Array<{name: string, albumId: string, url: string}>} list
     * @param {(albumId: string, name: string) => void} onOpen
     */
    function fill(el, list, onOpen) {
      el.replaceChildren(...list.map((p) => h('button', { type: 'button', class: 'dm-photos-item', title: t('map.picture.open'), onclick: () => onOpen(p.albumId, p.name) },
        h('img', { src: p.url, alt: p.name }), h('span', { class: 'dm-truncate dm-small', text: p.name }))));
    }
    /**
     * The pictures a row names, or null when its dataset names none.
     * @param {string} id @param {(column: string) => any} value reads a column of the row @param {(albumId: string, name: string) => void} onOpen
     * @returns {Promise<HTMLElement|null>}
     */
    async function create(id, value, onOpen) {
      const media = D.require('data/media');
      const list = await media.picturesOf(id, value);
      if (!list.length) return null;
      const el = h('div', { class: 'dm-photos dm-map-photos' });
      fill(el, list, onOpen);
      return el;
    }

    return { fill, create };
  });
})();
