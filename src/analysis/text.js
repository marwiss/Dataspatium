// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Text analysis without code for document datasets (kind "document", one row per paragraph): word frequencies,
 * keywords in context (KWIC), co-occurring words and a summary per document. Everything works on the rows of
 * the dataset as arrays; the column positions are passed in, so renamed or reordered columns still work.
 * Long collections are processed in chunks with a pause for the UI between them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('analysis/text', [], () => {
    /** Words: letters and digits, with inner apostrophes and hyphens ("don't", "e-post"). */
    const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
    const CHUNK = 1000;
    /**
     * Short stopword lists (function words) per language. They are deliberately small: the user can add words of
     * their own, and nothing is removed when the switch is off.
     */
    const STOPWORDS = {
      sv: 'och att det som en ett är på i för med av till den de inte om har var jag han hon vi ni man sig så kan ska skall från eller men också vid under över efter mellan mot utan hos än när där här vad vem hur varför denna detta dessa dess sin sitt sina hans hennes deras vår vårt våra er ert era min mitt mina din ditt dina nu då sedan bara mycket mer mest alla allt andra annan någon något några ingen inget inga samt även vara blir bli blev varit finns får fick gör göra kommer kom hade ha kunde skulle måste vilka vilket vilken sådan såsom enligt dock ju väl ut in upp ned ner redan igen åt ur per bland därför eftersom såväl dig mig oss dem honom henne du detta vilket',
      en: 'the a an and or but if of to in on at by for with from as is are was were be been being it its this that these those he she they we you i me him her them us my your his their our not no do does did have has had will would can could should shall may might must there here when where what which who whom why how all any some such than then so too very also into over under about after before between through during up down out more most other own same only just s t',
      da: 'og i at det en et er til på af for med som den de ikke der har var jeg han hun vi man sig så kan skal fra eller men også ved under over efter mellem mod uden hos end når hvor hvad hvem hvordan hvorfor denne dette disse sin sit sine hans hendes deres vores jeres min mit mine din dit dine nu da siden kun meget mere mest alle alt andre anden nogen noget nogle ingen intet samt være bliver blive blev været findes får fik gør gøre kommer kom havde have kunne skulle må hvilke hvilket hvilken ifølge dog jo ud ind op ned allerede igen om os dem du hende ham',
      nb: 'og i å det en et ei er til på av for med som den de ikke der har var jeg han hun vi man seg så kan skal fra eller men også ved under over etter mellom mot uten hos enn når hvor hva hvem hvordan hvorfor denne dette disse sin sitt sine hans hennes deres vår vårt våre min mitt mine din ditt dine nå da siden bare mye mer mest alle alt andre annen noen noe ingen samt være blir bli ble vært finnes får fikk gjør gjøre kommer kom hadde ha kunne skulle må hvilke hvilket hvilken ifølge likevel jo ut inn opp ned allerede igjen om oss dem du henne ham',
      nn: 'og i å det ein eit ei er til på av for med som den dei ikkje der har var eg han ho vi me de seg så kan skal frå eller men òg ved under over etter om ut inn opp ned her no då når kva kvar korleis kvifor noko nokon nokre alle alt anna andre berre mykje mange meir mest same sjølv slik sidan før etter mellom gjennom utan mot hos blir vart vere vore ha hadde har få fekk gje gav gjer gjorde kom kjem gå gjekk sjå såg seie sa vil ville må måtte kan kunne skulle bør burde dette desse denne den det dei han ho hans hennar deira vår vårt våre min mi mitt mine din di ditt dine sin si sitt sine ja nei enn att igjen',
      fi: 'ja on ei että se oli hän en ovat mutta kuin kun niin myös sen tai jos vain joka ole sitä siitä hänen ne nämä tämä tämän tässä tätä me he te minä sinä mitä mikä missä miten miksi kuka ketkä jotka jossa jonka jota olla ollut olleet olivat olen olet olemme olette kanssa mukaan jälkeen ennen yli alle välillä ilman luona kuten sekä vielä jo nyt sitten aina usein paljon enemmän eniten kaikki kaikkia muu muut toinen toisen jokin jotain joku mitään kukaan mihin mistä tähän tästä siihen sillä siinä sinne täällä siellä näin noin ehkä kyllä eivät emme ette saa voi voidaan pitää täytyy tulee tuli',
      is: 'og að í á er það sem um ekki til með af fyrir við en var hann hún þau þeir þær ég þú þið sig svo má skal frá eða einnig undir yfir eftir milli gegn án hjá þegar þar hvað hver hvernig þessi þetta þessar þessir sinn sín sitt hans hennar þeirra okkar ykkar minn mín mitt þinn þín þitt nú þá síðan bara mikið meira mest allir allt aðrir annar einhver eitthvað enginn ekkert vera verður verða varð verið finnst fær fékk gerir gera kemur kom hafði hafa gæti skyldi þurfa hvaða samkvæmt þó út inn upp niður aftur hefur höfum hefði voru eru þessu þessum þennan honum henni þeim þess okkur mér þér mig þig',
    };
    const LANGS = Object.keys(STOPWORDS);

    /** Tokenise a text into lower-case words. */
    function tokenize(text) {
      return (String(text || '').toLowerCase().match(WORD_RE) || []);
    }
    /**
     * The stopword set for a language plus the user's own words (comma, space or newline separated).
     * @param {string} lang @param {string} [extra] @param {boolean} [useList] false keeps only the extra words
     */
    function stopwordsFor(lang, extra, useList = true) {
      const set = new Set(useList && STOPWORDS[lang] ? STOPWORDS[lang].split(' ') : []);
      for (const w of String(extra || '').toLowerCase().split(/[\s,;]+/)) if (w) set.add(w);
      return set;
    }
    const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
    const keep = (w, opts) => w.length >= (opts.minLength || 1) && (opts.numbers || !/^\p{N}+$/u.test(w)) && !(opts.stopwords && opts.stopwords.has(w));

    /**
     * Word frequencies over the rows.
     * @param {any[][]} rows @param {{textIndex: number, docIndex?: number, stopwords?: Set<string>|null, minLength?: number, numbers?: boolean, top?: number}} opts
     * @returns {Promise<{words: Array<{word: string, count: number, documents: number, share: number}>, tokens: number, types: number}>}
     */
    async function wordFrequencies(rows, opts) {
      /** @type {Map<string, {count: number, docs: Set<any>}>} */
      const counts = new Map();
      let tokens = 0;
      for (let i = 0; i < rows.length; i++) {
        if (i && i % CHUNK === 0) await pause();
        const row = rows[i];
        const doc = opts.docIndex === undefined ? 0 : row[opts.docIndex];
        for (const w of tokenize(row[opts.textIndex])) {
          if (!keep(w, opts)) continue;
          tokens++;
          let e = counts.get(w);
          if (!e) { e = { count: 0, docs: new Set() }; counts.set(w, e); }
          e.count++; e.docs.add(doc);
        }
      }
      const words = Array.from(counts, ([word, e]) => ({ word, count: e.count, documents: e.docs.size, share: tokens ? e.count / tokens : 0 }));
      words.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
      return { words: words.slice(0, opts.top || 200), tokens, types: counts.size };
    }

    /**
     * Keywords in context: every occurrence of the term with the text before and after it.
     * @param {any[][]} rows @param {string} term
     * @param {{textIndex: number, docIndex?: number, pageIndex?: number, regex?: boolean, caseSensitive?: boolean, wholeWord?: boolean, width?: number, limit?: number}} opts
     * @returns {{hits: Array<{document: any, page: any, row: number, left: string, match: string, right: string}>, total: number, error?: string}}
     */
    function kwic(rows, term, opts) {
      const hits = []; let total = 0;
      if (!term) return { hits, total };
      let re;
      try {
        let source = opts.regex ? term : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (opts.wholeWord) source = `(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`;
        re = new RegExp(source, 'gu' + (opts.caseSensitive ? '' : 'i'));
      } catch (err) { return { hits, total, error: (err && err.message) || String(err) }; }
      const width = opts.width || 60; const limit = opts.limit || 500;
      for (let i = 0; i < rows.length; i++) {
        const text = String(rows[i][opts.textIndex] || '');
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text))) {
          if (!m[0]) { re.lastIndex++; continue; }
          total++;
          if (hits.length < limit) {
            hits.push({
              document: opts.docIndex === undefined ? null : rows[i][opts.docIndex], page: opts.pageIndex === undefined ? null : rows[i][opts.pageIndex], row: i + 1,
              left: (m.index > width ? '…' : '') + text.slice(Math.max(0, m.index - width), m.index), match: m[0],
              right: text.slice(m.index + m[0].length, m.index + m[0].length + width) + (m.index + m[0].length + width < text.length ? '…' : ''),
            });
          }
        }
      }
      return { hits, total };
    }

    /**
     * Pairs of words that occur together, in the same paragraph (window 0) or within `window` words of each other.
     * @param {any[][]} rows @param {{textIndex: number, stopwords?: Set<string>|null, minLength?: number, numbers?: boolean, window?: number, top?: number, maxWordsPerParagraph?: number}} opts
     * @returns {Promise<{pairs: Array<{a: string, b: string, count: number}>, paragraphs: number}>}
     */
    async function cooccurrences(rows, opts) {
      /** @type {Map<string, number>} */
      const counts = new Map();
      const window = opts.window || 0; const cap = opts.maxWordsPerParagraph || 400;
      let paragraphs = 0;
      for (let i = 0; i < rows.length; i++) {
        if (i && i % 200 === 0) await pause();
        const words = tokenize(rows[i][opts.textIndex]).filter((w) => keep(w, opts)).slice(0, cap);
        if (words.length < 2) continue;
        paragraphs++;
        if (window) {
          for (let a = 0; a < words.length; a++) {
            const seen = new Set();
            for (let b = a + 1; b < words.length && b <= a + window; b++) {
              if (words[a] === words[b] || seen.has(words[b])) continue;
              seen.add(words[b]);
              const k = words[a] < words[b] ? words[a] + '\u0001' + words[b] : words[b] + '\u0001' + words[a];
              counts.set(k, (counts.get(k) || 0) + 1);
            }
          }
        } else {
          const uniq = Array.from(new Set(words)).sort();
          for (let a = 0; a < uniq.length; a++) for (let b = a + 1; b < uniq.length; b++) {
            const k = uniq[a] + '\u0001' + uniq[b];
            counts.set(k, (counts.get(k) || 0) + 1);
          }
        }
      }
      const pairs = Array.from(counts, ([k, count]) => { const [a, b] = k.split('\u0001'); return { a, b, count }; });
      pairs.sort((x, y) => y.count - x.count || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
      return { pairs: pairs.slice(0, opts.top || 200), paragraphs };
    }

    /**
     * One line per document: pages, paragraphs, headings, tables, words, characters, distinct words.
     * @param {any[][]} rows @param {{textIndex: number, docIndex: number, pageIndex?: number, typeIndex?: number}} opts
     */
    function summary(rows, opts) {
      /** @type {Map<any, any>} */
      const docs = new Map();
      for (const row of rows) {
        const name = row[opts.docIndex];
        let d = docs.get(name);
        if (!d) { d = { document: name, pages: 0, paragraphs: 0, headings: 0, tables: 0, words: 0, characters: 0, types: new Set() }; docs.set(name, d); }
        d.paragraphs++;
        const type = opts.typeIndex === undefined ? '' : row[opts.typeIndex];
        if (type === 'rubrik') d.headings++; else if (type === 'tabell') d.tables++;
        if (opts.pageIndex !== undefined) d.pages = Math.max(d.pages, Number(row[opts.pageIndex]) || 0);
        const text = String(row[opts.textIndex] || '');
        d.characters += text.length;
        for (const w of tokenize(text)) { d.words++; d.types.add(w); }
      }
      return Array.from(docs.values()).map((d) => ({ document: d.document, pages: d.pages, paragraphs: d.paragraphs, headings: d.headings, tables: d.tables, words: d.words, characters: d.characters, distinct: d.types.size, ttr: d.words ? d.types.size / d.words : 0 }));
    }

    /** Column positions of a document dataset by name, with the fixed positions as fallback. */
    function indexes(columns) {
      const find = (name, fallback) => { const i = columns.findIndex((c) => c.name === name); return i >= 0 ? i : fallback; };
      return { docIndex: find('dokument', 0), pageIndex: find('sida', 1), paragraphIndex: find('stycke', 2), typeIndex: find('typ', 3), textIndex: find('text', 4) };
    }

    return { tokenize, stopwordsFor, wordFrequencies, kwic, cooccurrences, summary, indexes, STOPWORDS, LANGS, WORD_RE };
  });
})();
