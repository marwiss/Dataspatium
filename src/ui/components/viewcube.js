// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * dm-viewcube: a small cube in a corner of the 3D view that turns with the camera and takes it to a standard view. The six faces
 * are buttons (top, bottom, front, back, left, right), and a button under the cube gives the view from above in the south-east.
 * Each sends `dm-view` with `{view}`; the keys 1–7 of the view do the same. Setting `orientation` to the camera's
 * matrixWorldInverse (column-major, as three.js keeps it) turns the cube so that its faces point where the model's do.
 *
 * <dm-viewcube></dm-viewcube>
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viewcube', ['ui/base', 'ui/icons'], (base, icons) => {
    const { h, t, DmElement, define } = base;
    /** Each face and where it sits on a cube whose CSS axes are x right, y down and z towards the viewer. */
    const FACES = [
      ['front', 'translateZ(var(--dm-viewcube-half))'],
      ['back', 'rotateY(180deg) translateZ(var(--dm-viewcube-half))'],
      ['right', 'rotateY(90deg) translateZ(var(--dm-viewcube-half))'],
      ['left', 'rotateY(-90deg) translateZ(var(--dm-viewcube-half))'],
      ['top', 'rotateX(90deg) translateZ(var(--dm-viewcube-half))'],
      ['bottom', 'rotateX(-90deg) translateZ(var(--dm-viewcube-half))'],
    ];

    /**
     * The CSS transform of a camera's rotation: the 3×3 part of the view matrix with the y axis flipped, because CSS counts y
     * downwards and three.js upwards.
     * @param {ArrayLike<number>} e column-major 4×4 @returns {string}
     */
    function cssOf(e) {
      const s = [1, -1, 1];
      const out = [];
      for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) {
          const v = s[row] * s[col] * Number(e[col * 4 + row]);
          out.push(Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0);
        }
        out.push(0);
      }
      out.push(0, 0, 0, 1);
      return `matrix3d(${out.join(',')})`;
    }

    class DmViewcube extends DmElement {
      connectedCallback() {
        if (this.cube) return;
        this.setAttribute('role', 'group');
        this.setAttribute('aria-label', t('model.view.cube'));
        this.cube = h('div', { class: 'dm-viewcube-cube' });
        for (const [name, transform] of FACES) {
          const face = h('button', { type: 'button', class: 'dm-viewcube-face', 'data-view': name, 'aria-label': t('model.view.' + name + '.hint'), 'data-tip': t('model.view.' + name + '.hint'), text: t('model.view.' + name) });
          face.style.transform = transform;
          face.addEventListener('click', () => this.go(name));
          this.cube.appendChild(face);
        }
        const iso = h('button', { type: 'button', class: 'dm-viewcube-iso', 'data-view': 'iso', 'aria-label': t('model.view.iso.hint'), 'data-tip': t('model.view.iso.hint') }, icons.icon('box'));
        iso.addEventListener('click', () => this.go('iso'));
        this.appendChild(h('div', { class: 'dm-viewcube-stage' }, this.cube));
        this.appendChild(iso);
        if (this.pending) { this.cube.style.transform = this.pending; this.pending = ''; }
      }
      /** @param {string} view */
      go(view) { this.dispatchEvent(new CustomEvent('dm-view', { detail: { view }, bubbles: true })); }
      /** @param {ArrayLike<number>} e the camera's matrixWorldInverse elements */
      set orientation(e) {
        const css = cssOf(e);
        if (this.cube) this.cube.style.transform = css; else this.pending = css;
      }
    }
    define('dm-viewcube', DmViewcube);
    return { DmViewcube, cssOf, FACES };
  });
})();
