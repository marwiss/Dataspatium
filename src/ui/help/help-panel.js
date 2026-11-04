// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Help inside the app (the handbook): the user documentation from docs/, embedded per language by
 * tools/wrap_local.py as docs/help/<lang>.js and shown in a dialog with a table of contents, search over
 * sections and links between the documents. No network and no browser tab; the language follows the app.
 * Dialogs opened with `help: 'doc#section'` get a ? button that opens that section. Sections are named by
 * their Swedish heading slug and found by heading position in the other languages.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/help', ['ui/base', 'ui/basic', 'ui/overlays', 'docgen/markdown'], (base, basic, overlays, markdown) => {
    const { h, t, i18n, replace } = base;
    /** Documents in reading order (file names without .md; Swedish in docs/, other languages in docs/<lang>/). */
    const DOCS = ['kom-igang', 'anvandarguide', 'lagen', 'soka', 'bearbeta', 'visualisera', 'anteckningsbok', 'regex', 'format', 'api-konfiguration', 'kallor', 'r-guide', 'python', 'dokument', 'kartor', 'planer', 'grafer', 'cad-bim', 'floden', 'statistik', 'dokumentmallar', 'dela', 'mobil', 'faq', 'licenser'];
    /** Modes with a document of their own; the others open the chapter of docs/lagen.md that carries the mode's name. */
    const MODE_DOCS = { soka: 'soka', bearbeta: 'bearbeta', visualisera: 'visualisera', dela: 'dela' };
    const REPO = 'https://github.com/marwiss/Dataspatium/blob/main/';
    /** @type {Map<string, Promise<any>>} language code -> loaded handbook */
    const cache = new Map();
    /** The open panel, if any (one at a time). */
    let panel = null;

    /** Heading text to an anchor: lower case, letters and digits of any script kept, spaces to hyphens. */
    function slug(text) {
      return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
    }

    /** 'doc#section' -> {doc, section}. */
    function parseRef(ref) {
      const [doc, section] = String(ref || '').split('#');
      return { doc: doc || undefined, section: section || undefined };
    }

    /** A path relative to a document's folder, normalised to a repository path such as docs/images/x.png. */
    function resolvePath(lang, href) {
      const segs = lang === 'sv' ? ['docs'] : ['docs', lang];
      for (const part of String(href).split('/')) {
        if (part === '..') segs.pop();
        else if (part && part !== '.') segs.push(part);
      }
      return segs.join('/');
    }

    /**
     * Where a link leads: another embedded document (opened in the panel) or a URL (opened in a new tab).
     * @param {string} lang @param {string} href
     * @returns {{doc?: string, section?: string, url?: string}}
     */
    function resolveLink(lang, href) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { url: href };
      if (href.startsWith('#')) return { section: decodeURIComponent(href.slice(1)) };
      const [path, hash] = href.split('#');
      const section = hash ? decodeURIComponent(hash) : undefined;
      const full = resolvePath(lang, path);
      const m = full.match(/^docs(?:\/([a-z]{2}))?\/([a-z0-9-]+)\.md$/);
      if (m && DOCS.includes(m[2]) && (m[1] || 'sv') === lang) return { doc: m[2], section };
      return { url: REPO + full + (hash ? '#' + hash : '') };
    }

    /** Plain text of a block, for search. */
    function blockText(b) {
      if (b.type === 'paragraph') return markdown.plain(b.runs);
      if (b.type === 'list') return b.items.map((it) => markdown.plain(it)).join(' ');
      if (b.type === 'table') return b.columns.concat(...b.rows).join(' ');
      if (b.type === 'code') return b.text;
      if (b.type === 'image') return b.alt || '';
      return '';
    }

    /**
     * Markdown to blocks and sections. Fenced code, image lines and blockquote markers are handled here, the rest
     * by docgen/markdown. Every heading gets a slug (unique within the document); a section's text is the plain
     * text up to the next heading.
     * @param {string} text
     * @returns {{title: string, blocks: any[], sections: Array<{slug: string, title: string, level: number, text: string}>}}
     */
    function compile(text) {
      const blocks = [];
      let pending = []; let fence = null;
      const flush = () => { if (pending.length) { blocks.push(...markdown.parse(pending.join('\n')).blocks); pending = []; } };
      for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
        if (fence) {
          if (/^\s*```/.test(raw)) { blocks.push({ type: 'code', lang: fence.lang, text: fence.lines.join('\n') }); fence = null; } else fence.lines.push(raw);
          continue;
        }
        const open = raw.match(/^\s*```\s*([\w-]*)\s*$/);
        if (open) { flush(); fence = { lang: open[1], lines: [] }; continue; }
        const image = raw.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
        if (image) { flush(); blocks.push({ type: 'image', alt: image[1], src: image[2] }); continue; }
        pending.push(raw.replace(/^>\s?/, ''));
      }
      if (fence) blocks.push({ type: 'code', lang: fence.lang, text: fence.lines.join('\n') });
      flush();
      const sections = []; const used = new Set(); let title = '';
      for (const b of blocks) {
        if (b.type === 'heading') {
          const name = markdown.plain(b.runs);
          const baseSlug = slug(name) || 'avsnitt';
          let s = baseSlug; let n = 2;
          while (used.has(s)) s = baseSlug + '-' + n++;
          used.add(s); b.slug = s;
          if (!title) title = name;
          sections.push({ slug: s, title: name, level: b.level, text: '' });
        } else if (sections.length) {
          const last = sections[sections.length - 1];
          last.text += (last.text ? ' ' : '') + blockText(b);
        }
      }
      return { title, blocks, sections };
    }

    /**
     * The handbook in a language (default: the app's), loaded once per language.
     * @param {string} [lang]
     * @returns {Promise<{lang: string, docs: Array<{id: string, title: string, blocks: any[], sections: any[]}>, byId: Map<string, any>}>}
     */
    function load(lang) {
      const code = lang || i18n.language();
      if (!cache.has(code)) {
        const p = (async () => {
          const docs = [];
          for (const id of DOCS) {
            const c = compile(await D.assets.loadText(`docs/${code}/${id}.md`));
            docs.push({ id, title: c.title || id, blocks: c.blocks, sections: c.sections });
          }
          return { lang: code, docs, byId: new Map(docs.map((d) => [d.id, d])) };
        })();
        p.catch(() => cache.delete(code));
        cache.set(code, p);
      }
      return cache.get(code);
    }

    /** The handbook if it is already loaded in the app's language, otherwise null. */
    function loaded() { return cache.has(i18n.language()) ? cache.get(i18n.language()) : null; }

    /**
     * A section given by its Swedish slug, in the handbook's language: the same slug when it exists, otherwise the
     * heading at the same position as in the Swedish document (the translations share their structure).
     * @returns {Promise<string|null>}
     */
    async function resolveSection(bundle, docId, section) {
      const doc = bundle.byId.get(docId);
      if (!doc || !section) return null;
      if (doc.sections.some((s) => s.slug === section)) return section;
      if (bundle.lang === 'sv') return null;
      const sv = (await load('sv')).byId.get(docId);
      const i = sv ? sv.sections.findIndex((s) => s.slug === section) : -1;
      return i >= 0 && doc.sections[i] ? doc.sections[i].slug : null;
    }

    /**
     * Sections containing every word of the query (matches in the heading first), with a snippet around the first word.
     * @returns {Array<{doc: any, section: any, inTitle: boolean, snippet: string}>}
     */
    function search(bundle, query, limit = 40) {
      const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      const hits = [];
      for (const doc of bundle.docs) {
        for (const section of doc.sections) {
          const title = section.title.toLowerCase(); const body = section.text.toLowerCase();
          if (!words.every((w) => title.includes(w) || body.includes(w))) continue;
          const at = body.indexOf(words[0]);
          const from = Math.max(0, at - 60);
          const snippet = at < 0 ? section.text.slice(0, 160) : (from > 0 ? '… ' : '') + section.text.slice(from, at + 120) + (at + 120 < section.text.length ? ' …' : '');
          hits.push({ doc, section, inTitle: words.some((w) => title.includes(w)), snippet });
        }
      }
      hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle));
      return hits.slice(0, limit);
    }

    /**
     * Blocks to DOM. Links to other documents of the handbook open in the panel, everything else in a new tab.
     * @param {any} bundle @param {any} doc @param {(doc: string, section?: string) => void} onLink
     */
    function render(bundle, doc, onLink) {
      const lang = bundle.lang;
      const link = (r) => {
        const target = resolveLink(lang, r.link);
        if (target.url) return h('a', { href: target.url, target: '_blank', rel: 'noopener' }, r.text);
        const docId = target.doc || doc.id;
        return h('a', { href: '#', 'data-doc': docId, 'data-section': target.section || null, onclick: (e) => { e.preventDefault(); onLink(docId, target.section); } }, r.text);
      };
      const runs = (list) => list.map((r) => {
        let node = r.link ? link(r) : document.createTextNode(r.text);
        if (r.code) node = h('code', null, node);
        if (r.bold) node = h('strong', null, node);
        if (r.italic) node = h('em', null, node);
        return node;
      });
      const cells = (row, tag, numeric) => row.map((c, i) => h(tag, { class: numeric[i] ? 'dm-num' : null }, runs(markdown.inline(c))));
      return doc.blocks.map((b) => {
        switch (b.type) {
          case 'heading': return h('h' + Math.min(6, b.level + 1), { class: 'dm-help-heading', 'data-section': b.slug }, runs(b.runs));
          case 'paragraph': return h('p', null, runs(b.runs));
          case 'list': return h(b.ordered ? 'ol' : 'ul', null, b.items.map((it) => h('li', null, runs(it))));
          case 'table': return h('div', { class: 'dm-help-table' }, h('table', null, h('thead', null, h('tr', null, cells(b.columns, 'th', b.numeric))), h('tbody', null, b.rows.map((r) => h('tr', null, cells(r, 'td', b.numeric))))));
          case 'rule': return h('hr', null);
          case 'code': return h('pre', { class: 'dm-help-code' }, h('code', { text: b.text }));
          case 'image': return h('figure', { class: 'dm-help-figure' }, h('img', { src: (globalThis.DATASPATIUM_BASE || '') + resolvePath(lang, b.src), alt: b.alt, loading: 'lazy' }), b.alt ? h('figcaption', { text: b.alt }) : null);
          default: return null;
        }
      });
    }

    /**
     * Open the handbook (one panel at a time; a second call navigates the open one).
     * @param {{doc?: string, section?: string, query?: string, lang?: string}} [where]
     * @returns {Promise<{el: HTMLElement, state: any, show: Function, search: Function, close: Function}>}
     */
    async function open(where = {}) {
      if (panel) { await panel.show(where.doc, where.section, where.query); return panel; }
      const bundle = await load(where.lang);
      const state = { doc: null, section: null, query: '', hits: [] };
      const nav = h('nav', { class: 'dm-help-nav dm-list', 'aria-label': t('help.contents') });
      const content = h('div', { class: 'dm-help-content dm-prose', tabindex: '-1' });
      const searchInput = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('help.search.placeholder'), 'aria-label': t('help.search'), inline: true }));
      let timer = 0;
      searchInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => runSearch(searchInput.value), 150); });
      // The update check is the only network call the app makes on its own, and only on this click.
      const result = h('span', { class: 'dm-help dm-small' });
      const checkBtn = basic.button({ label: t('update.check'), icon: 'refresh-cw', size: 'sm', onClick: async () => {
        checkBtn.loading = true; result.textContent = t('update.checking');
        try {
          const res = await D.require('platform/updates').check();
          result.textContent = res.newer ? t('update.available', { version: res.latest }) + ' ' : t('update.latest', { version: res.current });
          if (res.newer) result.appendChild(h('a', { href: res.url, target: '_blank', rel: 'noopener', text: t('update.download') }));
        } catch (err) { result.textContent = String((err && err.message) || err); }
        checkBtn.loading = false;
      } });
      const el = h('div', { class: 'dm-help-panel' },
        searchInput,
        h('div', { class: 'dm-help-body' }, nav, content),
        h('div', { class: 'dm-help-foot dm-row-wrap' },
          h('span', { class: 'dm-help', text: t('app.version', { version: D.version }) + '. ' + t('shell.shortcuts') }),
          checkBtn, result,
          h('a', { href: i18n.docsUrl(bundle.lang), target: '_blank', rel: 'noopener', text: t('shell.help.docs.link') })));

      function renderNav() {
        replace(nav, bundle.docs.map((d) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': state.doc === d.id ? 'true' : null, onclick: () => show(d.id) }, h('span', { class: 'dm-list-main', text: d.title }))));
      }
      /** Show a document, scrolled to a section (a Swedish slug or one of the document's own); a query searches instead. */
      async function show(docId, section, query) {
        if (query) { searchInput.value = query; runSearch(query); return; }
        const doc = bundle.byId.get(docId) || (state.doc && bundle.byId.get(state.doc)) || bundle.docs[0];
        const resolved = await resolveSection(bundle, doc.id, section);
        state.doc = doc.id; state.section = resolved; state.query = ''; state.hits = [];
        searchInput.value = '';
        replace(content, render(bundle, doc, (d, s) => show(d, s)));
        renderNav();
        const target = resolved ? content.querySelector(`[data-section="${CSS.escape(resolved)}"]`) : null;
        if (target) target.scrollIntoView({ block: 'start' }); else content.scrollTop = 0;
      }
      function runSearch(query) {
        state.query = query; state.hits = search(bundle, query);
        if (!query.trim()) { show(state.doc || bundle.docs[0].id); return; }
        state.doc = null; renderNav();
        replace(content,
          h('p', { class: 'dm-help', text: state.hits.length ? t('help.hits', { n: state.hits.length }) : t('help.nohits') }),
          h('ul', { class: 'dm-help-hits' }, state.hits.map((x) => h('li', null, h('button', { type: 'button', class: 'dm-help-hit', onclick: () => show(x.doc.id, x.section.slug) }, h('strong', { text: x.doc.title + ' › ' + x.section.title }), h('span', { text: x.snippet }))))));
      }
      panel = { el, state, show, search: runSearch, close: () => { const dlg = el.closest('dialog'); if (dlg) dlg.close(); } };
      overlays.dialog.open({ title: t('help.title'), size: 'lg', body: el, actions: [{ label: t('course.open'), value: 'course' }, { label: t('common.close'), variant: 'primary', value: true }] })
        .then((choice) => { panel = null; if (choice === 'course' && D.shell && D.shell.course) D.shell.course.open(); });
      await show(where.doc || bundle.docs[0].id, where.section, where.query);
      return panel;
    }

    /** The chapter for a mode: the mode's own document, or the chapter of docs/lagen.md with the mode's (Swedish) name. */
    function openForMode(mode) {
      if (MODE_DOCS[mode]) return open({ doc: MODE_DOCS[mode] });
      return open({ doc: 'lagen', section: slug(i18n.tIn('sv', 'mode.' + mode)) });
    }

    /** Palette commands: one per document of the handbook. */
    async function commands() {
      const bundle = await load();
      return bundle.docs.map((d) => ({ id: 'help:' + d.id, label: t('help.palette', { title: d.title }), group: t('help.title'), icon: 'circle-help', keywords: [t('shell.help')], run: () => open({ doc: d.id }) }));
    }

    return { DOCS, slug, parseRef, compile, load, loaded, resolveSection, search, open, openForMode, commands, current: () => panel };
  });
})();
