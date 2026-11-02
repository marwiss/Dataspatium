// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * <dm-table>: virtualised data grid for large tables.
 *
 * Rows are fetched in blocks from an async provider, so only the visible window is in the DOM and
 * the dataset itself can stay in SQLite:
 *   table.setData({
 *     columns: [{key, label, type, width?}],
 *     rowCount: 120000,
 *     rowProvider: async (start, count, sort) => rows,   // rows: any[][] in column order
 *     sort: {key, dir: 'asc'|'desc'} | null,
 *   });
 * Events: `dm-sort` {sort}, `dm-row` {index, row}, `dm-column` {column}.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/table', ['ui/base', 'ui/icons'], (base, icons) => {
    const { h, DmElement, define, t, i18n } = base;
    const ROW_HEIGHT = 30;
    const BLOCK = 200;
    const OVERSCAN = 8;
    const DEFAULT_WIDTH = { text: 180, integer: 110, number: 120, date: 120, datetime: 160, boolean: 90 };

    class DmTable extends DmElement {
      constructor() {
        super();
        this.columns = [];
        this.rowCount = 0;
        this.rowProvider = null;
        this.sort = null;
        this.blocks = new Map();
        this.loading = new Map();
        this.rows = new Map();
        this.selectedIndex = -1;
        this.generation = 0;
        this.showRowNumbers = true;
        /** Set `editable = true` to allow in-place editing (double-click or Enter); emits dm-cell-commit. */
        this.editable = false;
        this.activeCol = -1;
        this.editing = null;
      }
      connectedCallback() {
        if (this.scroller) return;
        this.head = h('div', { class: 'dm-table-head', role: 'row' });
        this.body = h('div', { class: 'dm-table-body' });
        this.scroller = h('div', { class: 'dm-table-scroll', tabindex: '0', role: 'grid' }, this.head, this.body);
        this.footInfo = h('span');
        this.foot = h('div', { class: 'dm-table-foot' }, this.footInfo, h('span'));
        this.append(this.scroller, this.foot);
        let frame = 0;
        this.scroller.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; this.render(); }); });
        this.scroller.addEventListener('keydown', (e) => this.onKey(e));
        this.observer = new ResizeObserver(() => this.render());
        this.observer.observe(this.scroller);
        this.renderHead();
        this.render();
      }
      disconnectedCallback() { this.observer?.disconnect(); }

      /** Replace the data source. */
      setData({ columns, rowCount, rowProvider, sort }) {
        this.columns = columns || [];
        this.rowCount = rowCount || 0;
        this.rowProvider = rowProvider || null;
        this.sort = sort || null;
        this.selectedIndex = -1;
        this.reset();
        if (this.scroller) { this.scroller.scrollTop = 0; this.renderHead(); this.render(); }
      }
      /** Reload rows and columns but keep the scroll position and selection (after edits). */
      updateData({ columns, rowCount, rowProvider }) {
        if (columns) this.columns = columns;
        if (rowCount !== undefined) this.rowCount = rowCount;
        if (rowProvider) this.rowProvider = rowProvider;
        if (this.sort && !this.columns.some((c) => c.key === this.sort.key)) this.sort = null;
        if (this.selectedIndex >= this.rowCount) this.selectedIndex = -1;
        if (this.activeCol >= this.columns.length) this.activeCol = -1;
        this.reset();
        if (this.scroller) { this.renderHead(); this.render(); }
      }
      /** Drop cached rows (after edits or sort changes) and redraw. */
      reset() {
        this.generation++;
        this.blocks.clear(); this.loading.clear();
        for (const el of this.rows.values()) el.remove();
        this.rows.clear();
        if (this.body) this.body.style.height = (this.rowCount * ROW_HEIGHT) + 'px';
      }
      refresh() { this.reset(); this.render(); }

      widthOf(col) { return col.width || DEFAULT_WIDTH[col.type] || DEFAULT_WIDTH.text; }

      renderHead() {
        const cells = [];
        if (this.showRowNumbers) cells.push(h('div', { class: 'dm-th dm-rownum', role: 'columnheader', style: { width: '56px', flex: '0 0 56px' }, text: '#' }));
        for (const col of this.columns) {
          const sorted = this.sort && this.sort.key === col.key ? this.sort.dir : null;
          const th = h('button', {
            type: 'button', class: 'dm-th', role: 'columnheader', style: { width: this.widthOf(col) + 'px', flex: `0 0 ${this.widthOf(col)}px` },
            'aria-sort': sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : null,
            title: `${col.label || col.key} (${t('type.' + (col.type || 'text'))})`,
            onclick: (e) => this.onHeaderClick(col, e),
          },
            h('span', { class: 'dm-th-label', text: col.label || col.key }),
            sorted ? icons.icon(sorted === 'asc' ? 'arrow-up' : 'arrow-down', 12) : null);
          cells.push(th);
        }
        this.head.replaceChildren(...cells);
        this.body.style.height = (this.rowCount * ROW_HEIGHT) + 'px';
        const total = this.columns.reduce((s, c) => s + this.widthOf(c), 0) + (this.showRowNumbers ? 56 : 0);
        this.body.style.width = total + 'px';
        this.head.style.width = total + 'px';
      }

      onHeaderClick(col, e) {
        this.emit('dm-column', { column: col });
        if (e.shiftKey) return; // shift-click: inspect only
        let dir = 'asc';
        if (this.sort && this.sort.key === col.key) dir = this.sort.dir === 'asc' ? 'desc' : (this.sort.dir === 'desc' ? null : 'asc');
        this.sort = dir ? { key: col.key, dir } : null;
        this.renderHead();
        this.reset();
        this.emit('dm-sort', { sort: this.sort });
        this.render();
      }

      onKey(e) {
        if (!this.rowCount || this.editing) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          this.activeCol = Math.max(0, Math.min(this.columns.length - 1, (this.activeCol < 0 ? 0 : this.activeCol) + (e.key === 'ArrowRight' ? 1 : -1)));
          this.markActiveCell();
          return;
        }
        if ((e.key === 'Enter' || e.key === 'F2') && this.editable && this.selectedIndex >= 0) {
          e.preventDefault();
          this.startEdit(this.selectedIndex, this.activeCol < 0 ? 0 : this.activeCol);
          return;
        }
        const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'PageDown' ? 20 : e.key === 'PageUp' ? -20 : e.key === 'Home' ? -Infinity : e.key === 'End' ? Infinity : 0;
        if (!step) return;
        e.preventDefault();
        const next = Math.max(0, Math.min(this.rowCount - 1, (this.selectedIndex < 0 ? 0 : this.selectedIndex) + step));
        this.selectRow(next, true);
      }

      markActiveCell() {
        for (const el of this.body.querySelectorAll('.dm-td-active')) el.classList.remove('dm-td-active');
        const row = this.rows.get(this.selectedIndex);
        if (!row || this.activeCol < 0) return;
        const cell = row.children[this.activeCol + (this.showRowNumbers ? 1 : 0)];
        if (cell) cell.classList.add('dm-td-active');
      }

      /** Raw value of a loaded cell, or undefined when its block is not loaded. */
      cellValue(rowIndex, colIndex) {
        const block = this.blocks.get(Math.floor(rowIndex / BLOCK));
        const row = block && block[rowIndex % BLOCK];
        return row ? row[colIndex] : undefined;
      }

      /** Update a loaded cell in place (after a successful edit) without refetching. */
      setCell(rowIndex, colIndex, value) {
        const block = this.blocks.get(Math.floor(rowIndex / BLOCK));
        if (block && block[rowIndex % BLOCK]) block[rowIndex % BLOCK][colIndex] = value;
        const row = this.rows.get(rowIndex);
        if (row) { row.remove(); this.rows.delete(rowIndex); this.render(); }
      }

      /** Open an inline editor for a cell. */
      startEdit(rowIndex, colIndex) {
        if (!this.editable || this.editing) return;
        const row = this.rows.get(rowIndex);
        const col = this.columns[colIndex];
        if (!row || !col) return;
        const cell = row.children[colIndex + (this.showRowNumbers ? 1 : 0)];
        if (!cell) return;
        const current = this.cellValue(rowIndex, colIndex);
        const input = /** @type {HTMLInputElement} */ (h('input', { class: 'dm-cell-editor', type: 'text', 'aria-label': col.label || col.key }));
        input.value = current === null || current === undefined ? '' : String(current);
        cell.textContent = '';
        cell.appendChild(input);
        this.editing = { rowIndex, colIndex, cell, input, original: current };
        let done = false;
        const finish = (commit) => {
          if (done) return; done = true;
          this.editing = null;
          const value = input.value;
          cell.textContent = formatCell(current, col.type, col);
          if (current === null || current === undefined) cell.classList.add('dm-null');
          if (commit && value !== (current === null || current === undefined ? '' : String(current))) {
            this.emit('dm-cell-commit', { rowIndex, colIndex, column: col, value, original: current });
          }
          this.scroller.focus();
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
          else if (e.key === 'Tab') { e.preventDefault(); finish(true); const next = Math.min(this.columns.length - 1, colIndex + (e.shiftKey ? -1 : 1)); this.activeCol = next; this.markActiveCell(); setTimeout(() => this.startEdit(rowIndex, next), 0); }
          e.stopPropagation();
        });
        input.addEventListener('blur', () => finish(true));
        input.focus();
        input.select();
      }

      selectRow(index, scrollIntoView) {
        const prev = this.rows.get(this.selectedIndex);
        if (prev) prev.removeAttribute('aria-selected');
        this.selectedIndex = index;
        const el = this.rows.get(index);
        if (el) el.setAttribute('aria-selected', 'true');
        if (scrollIntoView) {
          const top = index * ROW_HEIGHT; const headH = this.head.offsetHeight;
          if (top < this.scroller.scrollTop) this.scroller.scrollTop = top;
          else if (top + ROW_HEIGHT > this.scroller.scrollTop + this.scroller.clientHeight - headH) this.scroller.scrollTop = top + ROW_HEIGHT + headH - this.scroller.clientHeight;
        }
        const block = this.blocks.get(Math.floor(index / BLOCK));
        this.emit('dm-row', { index, row: block ? block[index % BLOCK] : null });
      }

      async ensureBlock(b) {
        if (this.blocks.has(b) || this.loading.has(b) || !this.rowProvider) return;
        const gen = this.generation;
        const p = Promise.resolve(this.rowProvider(b * BLOCK, Math.min(BLOCK, this.rowCount - b * BLOCK), this.sort)).then((rows) => {
          if (gen !== this.generation) return;
          this.blocks.set(b, rows); this.loading.delete(b); this.render();
        }, (err) => { this.loading.delete(b); console.error('[dm-table] row provider failed', err); });
        this.loading.set(b, p);
      }

      render() {
        if (!this.scroller) return;
        const headH = this.head.offsetHeight || 34;
        const top = this.scroller.scrollTop; const height = this.scroller.clientHeight - headH;
        const first = Math.max(0, Math.floor(top / ROW_HEIGHT) - OVERSCAN);
        const last = Math.min(this.rowCount - 1, Math.ceil((top + height) / ROW_HEIGHT) + OVERSCAN);
        const needed = new Set();
        for (let i = first; i <= last; i++) needed.add(i);
        for (const [i, el] of this.rows) if (!needed.has(i)) { el.remove(); this.rows.delete(i); }
        if (this.rowCount === 0) {
          if (!this.emptyEl) { this.emptyEl = h('div', { class: 'dm-table-empty', text: t('table.no.rows') }); this.body.appendChild(this.emptyEl); }
          this.footInfo.textContent = t('common.rows', { n: 0 });
          return;
        }
        if (this.emptyEl) { this.emptyEl.remove(); this.emptyEl = null; }
        for (let b = Math.floor(first / BLOCK); b <= Math.floor(last / BLOCK); b++) this.ensureBlock(b);
        for (let i = first; i <= last; i++) {
          if (this.rows.has(i)) continue;
          const block = this.blocks.get(Math.floor(i / BLOCK));
          if (!block) continue;
          const row = block[i % BLOCK];
          if (!row) continue;
          const el = this.drawRow(i, row);
          this.rows.set(i, el);
          this.body.appendChild(el);
        }
        const firstVisible = Math.min(this.rowCount, Math.floor(top / ROW_HEIGHT) + 1);
        const lastVisible = Math.min(this.rowCount, Math.ceil((top + height) / ROW_HEIGHT));
        this.footInfo.textContent = t('table.range', { from: i18n.formatNumber(firstVisible), to: i18n.formatNumber(lastVisible), total: i18n.formatNumber(this.rowCount) });
      }

      drawRow(index, values) {
        const cells = [];
        if (this.showRowNumbers) cells.push(h('div', { class: 'dm-td dm-rownum', role: 'rowheader', style: { width: '56px', flex: '0 0 56px' }, text: i18n.formatNumber(index + 1) }));
        this.columns.forEach((col, c) => {
          const v = values[c];
          const td = h('div', { class: 'dm-td', role: 'gridcell', style: { width: this.widthOf(col) + 'px', flex: `0 0 ${this.widthOf(col)}px` } });
          if (v === null || v === undefined) td.classList.add('dm-null');
          else {
            const text = formatCell(v, col.type, col);
            td.textContent = text; td.title = text;
            if (col.type === 'integer' || col.type === 'number') td.classList.add('dm-num');
          }
          if (index === this.selectedIndex && c === this.activeCol) td.classList.add('dm-td-active');
          td.addEventListener('click', () => { this.activeCol = c; this.markActiveCell(); });
          if (this.editable) td.addEventListener('dblclick', () => { this.selectRow(index, false); this.activeCol = c; this.startEdit(index, c); });
          cells.push(td);
        });
        const tr = h('div', { class: 'dm-tr', role: 'row', style: { top: (index * ROW_HEIGHT) + 'px' }, 'aria-selected': index === this.selectedIndex ? 'true' : null, onclick: () => this.selectRow(index, false) }, cells);
        return tr;
      }
    }

    const YEAR_LIKE = /^(ar|år|year|period|tid|arstal|årtal|manad|månad|vecka|kvartal)$/i;
    /** Format a cell value for display using Swedish conventions; year-like integer columns skip grouping. */
    function formatCell(v, type, col) {
      if (v === null || v === undefined) return '';
      switch (type) {
        case 'integer': return i18n.formatNumber(v, { maximumFractionDigits: 0, useGrouping: !(col && YEAR_LIKE.test(col.key || '')) });
        case 'number': return i18n.formatNumber(v);
        case 'boolean': return v === 1 || v === true || v === 'true' ? t('common.yes') : t('common.no');
        default: return String(v);
      }
    }

    define('dm-table', DmTable);
    return { DmTable, formatCell, ROW_HEIGHT, BLOCK };
  });
})();
