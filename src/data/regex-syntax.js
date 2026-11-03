// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Regular expression syntax shared by the Regex tab, the recipe steps and their R and SQL export.
 * Patterns are JavaScript (ECMAScript) regular expressions with the same rules as the SQLite functions in
 * engines/sqlite/sqlite-worker.js: a leading inline flag group such as (?i) becomes flags, and the
 * Unicode flag is added whenever the pattern allows it, so that \p{L} and other Unicode properties work
 * while older patterns that are only valid without it keep working.
 *
 * Also: patterns generated from a pattern-profile shape, a library of common Nordic patterns, and the
 * stringr (ICU) form of a pattern and of a replacement for R export.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/regex-syntax', [], () => {
    /**
     * The pattern and flags as they are compiled: leading groups such as (?i), (?s) and (?m) become flags.
     * @param {string} pattern @param {string} [flags]
     * @returns {{source: string, flags: string}}
     */
    function normalise(pattern, flags) {
      let p = String(pattern); let f = '';
      const lead = /^(?:\(\?[ims]+\))+/.exec(p);
      if (lead) p = p.slice(lead[0].length);
      for (const c of String(flags || '') + (lead ? lead[0].replace(/[^ims]/g, '') : '')) if ('dgimsuyv'.includes(c) && !f.includes(c)) f += c;
      return { source: p, flags: f };
    }

    /**
     * The pattern of a step: `whole` anchors it to the whole value.
     * @param {{pattern: string, whole?: boolean}} p
     */
    const fullPattern = (p) => (p.whole ? `^(?:${p.pattern})$` : String(p.pattern || ''));
    /** Flags of a step: i for case-insensitive, s when the dot also matches line breaks. */
    const flagsOf = (p) => (p.caseInsensitive ? 'i' : '') + (p.dotAll ? 's' : '');

    /**
     * Compile a pattern; an invalid pattern gives a message instead of an exception.
     * @param {string} pattern @param {string} [flags]
     * @returns {{re: RegExp|null, unicode: boolean, groups: string[], error: string}}
     */
    function compile(pattern, flags) {
      const n = normalise(pattern, flags);
      let re = null; let error = ''; let unicode = true;
      try { re = new RegExp(n.source, n.flags + 'u'); } catch (err) {
        try { re = new RegExp(n.source, n.flags); unicode = false; } catch (_err) { error = String((err && err.message) || err); }
      }
      return { re, unicode, groups: re ? groupNames(n.source, re.flags) : [], error };
    }

    /**
     * Names of the capture groups in order: a named group's name, otherwise its number as text.
     * @param {string} source @param {string} [flags]
     */
    function groupNames(source, flags) {
      let count = 0;
      try { count = new RegExp(source + '|', String(flags || '').replace(/[gy]/g, '')).exec('').length - 1; } catch (_err) { return []; }
      const names = [];
      // Opening parentheses that capture; escapes and character classes are skipped.
      let inClass = false;
      for (let i = 0; i < source.length && names.length < count; i++) {
        const c = source[i];
        if (c === '\\') { i++; continue; }
        if (inClass) { if (c === ']') inClass = false; continue; }
        if (c === '[') { inClass = true; continue; }
        if (c !== '(') continue;
        if (source[i + 1] !== '?') { names.push(String(names.length + 1)); continue; }
        const named = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(source.slice(i));
        if (named) names.push(named[1]);
      }
      while (names.length < count) names.push(String(names.length + 1));
      return names;
    }

    /**
     * A pattern that matches every value of a shape: A is an upper-case letter, a another letter, 9 a digit,
     * a + after one of them a run of it; other characters stand for themselves.
     * @param {string} shape
     */
    function patternFromShape(shape) {
      const cls = { A: '\\p{Lu}', a: '\\p{Ll}', 9: '\\d' };
      const chars = Array.from(String(shape));
      let out = '';
      for (let i = 0; i < chars.length;) {
        const c = chars[i];
        if (cls[c]) {
          let n = 1; while (chars[i + n] === c) n++;
          const plus = chars[i + n] === '+';
          out += cls[c] + (plus ? '+' : n > 1 ? `{${n}}` : '');
          i += n + (plus ? 1 : 0);
          continue;
        }
        // Only syntax characters are escaped: other escapes such as \- are errors with the Unicode flag.
        out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        i++;
      }
      return '^' + out + '$';
    }

    /**
     * Common patterns, each with a value that matches and one that does not (checked by the tests). Labels
     * are i18n keys `regex.lib.<id>`; groups `regex.lib.group.<group>`.
     */
    const LIBRARY = [
      { group: 'se', id: 'se_pnr', pattern: '^(\\d{2})?\\d{6}[-+]?\\d{4}$', yes: '19811218-9876', no: '1981-12-18' },
      { group: 'se', id: 'se_orgnr', pattern: '^(16)?\\d{6}-?\\d{4}$', yes: '556000-0000', no: '55600-00000' },
      { group: 'se', id: 'se_postnr', pattern: '^\\d{3} ?\\d{2}$', yes: '114 55', no: '1145' },
      { group: 'se', id: 'se_kommunkod', pattern: '^\\d{4}$', yes: '0180', no: '180' },
      { group: 'se', id: 'se_phone', pattern: '^(\\+46|0)[\\d \\-]{6,14}\\d$', yes: '08-123 456 78', no: '123' },
      { group: 'se', id: 'se_regnr', pattern: '^[A-HJ-PR-UW-Z]{3} ?\\d{2}[A-HJ-PR-UW-Z\\d]$', yes: 'ABC 12D', no: 'ABQ 123' },
      { group: 'nordic', id: 'dk_cpr', pattern: '^\\d{6}-?\\d{4}$', yes: '010190-1234', no: '01019-01234' },
      { group: 'nordic', id: 'no_fnr', pattern: '^\\d{6} ?\\d{5}$', yes: '01019012345', no: '0101901234' },
      { group: 'nordic', id: 'fi_hetu', pattern: '^\\d{6}[-+A-FU-Y]\\d{3}[0-9A-FHJ-NPR-Y]$', yes: '131052-308T', no: '131052-308Z' },
      { group: 'nordic', id: 'is_kt', pattern: '^\\d{6}-?\\d{4}$', yes: '120160-3389', no: '12016-03389' },
      { group: 'nordic', id: 'postnr4', pattern: '^\\d{4}$', yes: '0150', no: '01500' },
      { group: 'nordic', id: 'fi_postnr', pattern: '^\\d{5}$', yes: '00100', no: '0010' },
      { group: 'general', id: 'email', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', yes: 'namn@example.se', no: 'namn@example' },
      { group: 'general', id: 'url', pattern: 'https?://[^\\s]+', yes: 'Se https://www.scb.se/', no: 'www.scb.se' },
      { group: 'general', id: 'iso_date', pattern: '^\\d{4}-\\d{2}-\\d{2}$', yes: '2024-01-31', no: '31/01/2024' },
      { group: 'general', id: 'dmy_date', pattern: '^(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4})$', yes: '31.1.2024', no: '2024-01-31' },
      { group: 'general', id: 'time', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', yes: '09:45', no: '24:00' },
      { group: 'general', id: 'year', pattern: '(?<!\\d)(19|20)\\d{2}(?!\\d)', yes: 'Folkmängd 2024', no: 'Kod 12024' },
      { group: 'general', id: 'decimal_comma', pattern: '^-?\\d{1,3}( ?\\d{3})*(,\\d+)?$', yes: '1 234,5', no: '1.234.5' },
      { group: 'general', id: 'amount', pattern: '(?<belopp>\\d(?:[\\d ]*\\d)?(?:,\\d{1,2})?) ?(?:kr|SEK)(?!\\p{L})', yes: 'Pris 1 250,50 kr', no: 'Pris okänt' },
      { group: 'general', id: 'parentheses', pattern: '\\(([^)]*)\\)', yes: 'Stockholms län (01)', no: 'Stockholms län' },
      { group: 'general', id: 'words', pattern: '\\p{L}+', yes: 'Malmö', no: '123' },
      { group: 'general', id: 'surplus_space', pattern: '^\\s|\\s$|\\s{2,}', yes: 'Malmö  stad', no: 'Malmö stad' },
      { group: 'general', id: 'hashtag', pattern: '#[\\p{L}\\d_]+', yes: 'Nytt #öppnadata', no: 'Inga taggar' },
    ];

    // ---- R (stringr, ICU) and SQL forms --------------------------------------------------------------
    const rstr = (s) => JSON.stringify(String(s));
    /** stringr::regex() for a pattern and its flags; a leading (?i) is kept, ICU understands it too. */
    function rRegex(pattern, flags) {
      const opts = [];
      if (String(flags || '').includes('i')) opts.push('ignore_case = TRUE');
      if (String(flags || '').includes('s')) opts.push('dotall = TRUE');
      return `stringr::regex(${rstr(pattern)}${opts.length ? ', ' + opts.join(', ') : ''})`;
    }
    /**
     * A JavaScript replacement ($1, $<name>, $&, $$) with R's back-references (\1, \0, $), as the value of
     * the R string. Named references become numbers through the pattern's group names.
     * @param {string} replacement @param {string} pattern
     */
    function rReplacement(replacement, pattern) {
      const names = groupNames(normalise(pattern).source, 'u');
      return String(replacement || '').replace(/\\/g, '\\\\').replace(/\$(\$|&|\d{1,2}|<([^>]+)>)/g, (all, what, name) => {
        if (what === '$') return '$';
        if (what === '&') return '\\0';
        if (name !== undefined) { const i = names.indexOf(name); return i >= 0 ? '\\' + (i + 1) : all; }
        return '\\' + what;
      });
    }

    return { normalise, fullPattern, flagsOf, compile, groupNames, patternFromShape, LIBRARY, rRegex, rReplacement };
  });
})();
