// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * QR codes as SVG elements, drawn from the module matrix of qrcode-generator (vendor, MIT). The library is loaded
 * on first use; the SVG is built with DOM calls, never from markup, so any text can be encoded safely.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/qr', [], () => {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    let libPromise = null;
    function lib() {
      if (!libPromise) {
        libPromise = D.assets.loadVendorScript('vendor/qrcode-generator/qrcode.js').then(() => {
          const q = /** @type {any} */ (globalThis).qrcode;
          if (typeof q !== 'function') throw new Error('qrcode-generator did not load');
          return q;
        });
        libPromise.catch(() => { libPromise = null; });
      }
      return libPromise;
    }

    /**
     * The module matrix of a text: rows of booleans (dark = true). Type 0 picks the smallest version that fits.
     * @param {string} text @param {{level?: 'L'|'M'|'Q'|'H'}} [options]
     */
    async function matrix(text, options = {}) {
      const qrcode = await lib();
      const qr = qrcode(0, options.level || 'M');
      qr.addData(String(text), 'Byte');
      qr.make();
      const n = qr.getModuleCount();
      const rows = [];
      for (let r = 0; r < n; r++) { const row = new Array(n); for (let c = 0; c < n; c++) row[c] = qr.isDark(r, c); rows.push(row); }
      return rows;
    }

    /**
     * An <svg> element with the code, scaled by CSS; `size` sets width and height in px, `margin` the quiet zone in modules.
     * @param {string} text @param {{size?: number, margin?: number, level?: 'L'|'M'|'Q'|'H', label?: string}} [options]
     */
    async function element(text, options = {}) {
      const rows = await matrix(text, { level: options.level });
      const n = rows.length;
      const margin = options.margin === undefined ? 2 : options.margin;
      const total = n + margin * 2;
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${total} ${total}`);
      svg.setAttribute('width', String(options.size || 240));
      svg.setAttribute('height', String(options.size || 240));
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.setAttribute('role', 'img');
      if (options.label) svg.setAttribute('aria-label', options.label);
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('width', String(total)); bg.setAttribute('height', String(total)); bg.setAttribute('fill', '#fff');
      svg.appendChild(bg);
      // One path for all dark modules keeps the element small even for large codes.
      let d = '';
      for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
          if (!rows[r][c]) { c++; continue; }
          let w = 1;
          while (c + w < n && rows[r][c + w]) w++;
          d += `M${c + margin} ${r + margin}h${w}v1h-${w}z`;
          c += w;
        }
      }
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', '#000');
      svg.appendChild(path);
      return svg;
    }

    /** The same code as a PNG blob (for sharing or saving). */
    async function png(text, options = {}) {
      const rows = await matrix(text, { level: options.level });
      const scale = options.scale || 8;
      const margin = options.margin === undefined ? 2 : options.margin;
      const n = rows.length; const total = (n + margin * 2) * scale;
      const canvas = document.createElement('canvas');
      canvas.width = total; canvas.height = total;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, total, total);
      ctx.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (rows[r][c]) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
      return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
    }

    return { matrix, element, png };
  });
})();
