// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Conditions in flows (Martin's F31 a): a small language of its own that the app reads and never runs as code, so that a plan
 * from an AI or a file can do no more than its commands. It has numbers, text in quotes, true, false and null, references to
 * earlier answers (`check.total`, `rows.rows[0][1]`, `item` in a loop), the comparisons = == != < <= > >= and contains, and
 * and, or, not and parentheses. `fill` puts answers into a step's arguments: "{{ref}}" alone gives the value itself, inside other
 * text it gives the value as text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/conditions', [], () => {
    const t = (k, p) => D.t(k, p);
    const MAX_LENGTH = 500;
    const MAX_DEPTH = 20;
    const WORDS = ['and', 'or', 'not', 'contains', 'true', 'false', 'null'];

    /** @param {string} message */
    const fail = (message) => { throw new Error(t('conditions.err', { message })); };

    /** The text as tokens: numbers, strings, names (with dots and indexes kept apart), operators and parentheses. */
    function tokens(text) {
      const src = String(text);
      if (src.length > MAX_LENGTH) fail(t('conditions.err.long', { n: MAX_LENGTH }));
      const out = [];
      let i = 0;
      while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '(' || c === ')' || c === '[' || c === ']' || c === '.') { out.push({ k: c }); i++; continue; }
        const two = src.slice(i, i + 2);
        if (two === '==' || two === '!=' || two === '<=' || two === '>=') { out.push({ k: 'op', v: two === '==' ? '=' : two }); i += 2; continue; }
        if (c === '=' || c === '<' || c === '>') { out.push({ k: 'op', v: c }); i++; continue; }
        if (c === "'" || c === '"') {
          let j = i + 1; let s = '';
          while (j < src.length && src[j] !== c) { if (src[j] === '\\' && j + 1 < src.length) { s += src[j + 1]; j += 2; } else { s += src[j]; j++; } }
          if (j >= src.length) fail(t('conditions.err.quote'));
          out.push({ k: 'lit', v: s }); i = j + 1; continue;
        }
        const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
        if (num && (c !== '-' || !out.length || ['op', '(', 'word'].includes(out[out.length - 1].k))) { out.push({ k: 'lit', v: Number(num[0]) }); i += num[0].length; continue; }
        const name = /^[A-Za-z_À-ɏ][A-Za-z0-9_À-ɏ]*/.exec(src.slice(i));
        if (name) {
          const w = name[0].toLowerCase();
          if (WORDS.includes(w)) out.push(w === 'true' || w === 'false' || w === 'null' ? { k: 'lit', v: w === 'null' ? null : w === 'true' } : { k: 'word', v: w });
          else out.push({ k: 'name', v: name[0] });
          i += name[0].length; continue;
        }
        fail(t('conditions.err.char', { char: c }));
      }
      return out;
    }

    /** The tokens as a tree, by recursive descent: or, and, not, comparison, value. */
    function parse(text) {
      const toks = tokens(text);
      let pos = 0; let depth = 0;
      const peek = () => toks[pos];
      const take = (k, v) => { const x = toks[pos]; if (!x || x.k !== k || (v !== undefined && x.v !== v)) return null; pos++; return x; };
      const deeper = () => { if (++depth > MAX_DEPTH) fail(t('conditions.err.deep')); };
      function or() { deeper(); let left = and(); while (take('word', 'or')) left = { op: 'or', a: left, b: and() }; depth--; return left; }
      function and() { let left = not(); while (take('word', 'and')) left = { op: 'and', a: left, b: not() }; return left; }
      function not() { if (take('word', 'not')) { deeper(); const x = { op: 'not', a: not() }; depth--; return x; } return compare(); }
      function compare() {
        const left = value();
        const o = take('op') || take('word', 'contains');
        if (!o) return left;
        return { op: o.v, a: left, b: value() };
      }
      function value() {
        const x = peek();
        if (!x) fail(t('conditions.err.end'));
        if (take('(')) { const inner = or(); if (!take(')')) fail(t('conditions.err.paren')); return inner; }
        if (x.k === 'lit') { pos++; return { lit: x.v }; }
        if (x.k === 'name') {
          pos++;
          const path = [x.v];
          for (;;) {
            if (take('.')) { const n = take('name') || take('lit'); if (!n) fail(t('conditions.err.name')); path.push(n.v); continue; }
            if (take('[')) { const n = take('lit'); if (!n || !take(']')) fail(t('conditions.err.index')); path.push(n.v); continue; }
            break;
          }
          return { ref: path };
        }
        fail(t('conditions.err.token', { token: String(x.v !== undefined ? x.v : x.k) }));
        return null;
      }
      const tree = or();
      if (pos < toks.length) fail(t('conditions.err.token', { token: String(toks[pos].v !== undefined ? toks[pos].v : toks[pos].k) }));
      return tree;
    }

    /** A reference's value in the scope; missing parts give null, never an error, so that a condition can ask for them. */
    function lookup(scope, path) {
      let v = scope;
      for (const part of path) {
        if (v === null || v === undefined) return null;
        if (typeof part === 'number') v = Array.isArray(v) ? v[part] : null;
        else v = Object.prototype.hasOwnProperty.call(Object(v), part) ? v[part] : (part === 'length' && (Array.isArray(v) || typeof v === 'string') ? v.length : null);
      }
      return v === undefined ? null : v;
    }
    const truthy = (v) => !(v === null || v === false || v === 0 || v === '' || (Array.isArray(v) && !v.length));
    /** Numbers compare as numbers, also when one side is a number written as text; the rest as text. */
    function cmp(a, b) {
      const na = typeof a === 'number' ? a : (typeof a === 'string' && a.trim() !== '' && !isNaN(Number(a)) ? Number(a) : null);
      const nb = typeof b === 'number' ? b : (typeof b === 'string' && b.trim() !== '' && !isNaN(Number(b)) ? Number(b) : null);
      if (na !== null && nb !== null && (typeof a === 'number' || typeof b === 'number')) return na < nb ? -1 : na > nb ? 1 : 0;
      const sa = String(a); const sb = String(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    }
    function evaluate(node, scope) {
      if ('lit' in node) return node.lit;
      if (node.ref) return lookup(scope, node.ref);
      switch (node.op) {
        case 'or': return truthy(evaluate(node.a, scope)) || truthy(evaluate(node.b, scope));
        case 'and': return truthy(evaluate(node.a, scope)) && truthy(evaluate(node.b, scope));
        case 'not': return !truthy(evaluate(node.a, scope));
        case 'contains': {
          const a = evaluate(node.a, scope); const b = evaluate(node.b, scope);
          if (Array.isArray(a)) return a.some((x) => x === b || (x !== null && b !== null && cmp(x, b) === 0));
          return a !== null && b !== null && String(a).toLocaleLowerCase('sv').includes(String(b).toLocaleLowerCase('sv'));
        }
        default: {
          const a = evaluate(node.a, scope); const b = evaluate(node.b, scope);
          if (a === null || b === null) return node.op === '=' ? a === b : node.op === '!=' ? a !== b : false;
          const c = cmp(a, b);
          return node.op === '=' ? c === 0 : node.op === '!=' ? c !== 0 : node.op === '<' ? c < 0 : node.op === '<=' ? c <= 0 : node.op === '>' ? c > 0 : c >= 0;
        }
      }
    }
    /**
     * Whether a condition holds for the answers so far.
     * @param {string} text @param {Record<string, any>} scope @returns {boolean}
     */
    function test(text, scope) { return truthy(evaluate(parse(text), scope || {})); }
    /** The value a reference or an expression gives (for `each`). @param {string} text @param {Record<string, any>} scope */
    function value(text, scope) { return evaluate(parse(text), scope || {}); }
    /** What is wrong with a condition, or null when it reads. @param {string} text @returns {string|null} */
    function check(text) { try { parse(text); return null; } catch (err) { return String((err && err.message) || err); } }

    /**
     * Arguments with answers put in: "{{ref}}" alone gives the value, inside other text the value as text; the rest stays.
     * @param {any} args @param {Record<string, any>} scope
     */
    function fill(args, scope) {
      if (typeof args === 'string') {
        const whole = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(args);
        if (whole) return value(whole[1], scope);
        return args.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, ref) => { const v = value(ref, scope); return v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); });
      }
      if (Array.isArray(args)) return args.map((x) => fill(x, scope));
      if (args && typeof args === 'object') { const out = {}; for (const [k, v] of Object.entries(args)) out[k] = fill(v, scope); return out; }
      return args;
    }

    return { parse, test, value, check, fill, truthy, MAX_LENGTH };
  });
})();
