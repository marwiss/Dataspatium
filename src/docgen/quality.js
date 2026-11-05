// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A quality declaration in the form SCB uses: content, reliability, timeliness, accessibility and comparability. What the app
 * knows is filled in from the profile, the rules, the comments, the change log and the description, and what only a person
 * can say is left as a marked place to write. The result is a Word document to work on.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('docgen/quality', ['data/datasets', 'data/profile', 'data/dcat', 'data/kinds'], (datasets, profile, dcat, kinds) => {
    const t = (key, params) => D.t(key, params);
    const cell = (v) => String(v === null || v === undefined ? '' : v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    const table = (head, rows) => (rows.length ? [`| ${head.map(cell).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`].concat(rows.map((r) => `| ${r.map(cell).join(' | ')} |`)).join('\n') : '');
    const write = (key) => `*${t('quality.write', { what: t(key) })}*`;

    /**
     * The declaration as Markdown.
     * @param {string} id @returns {Promise<string>}
     */
    async function markdownFor(id) {
      const meta = await datasets.get(id);
      const d = dcat.of(meta);
      const p = await profile.profile(id);
      const i18n = D.require('ui/i18n');
      const n = (v) => i18n.formatNumber(v || 0);
      const out = [`# ${t('quality.title', { name: d.title || meta.name })}`, '', t('quality.generated', { date: i18n.formatDateTime(new Date()) }), ''];
      out.push(`## ${t('quality.content')}`, '', d.description || write('quality.content.write'), '', `${t('datasets.rows')}: ${n(p.rows)}. ${kinds.summary(meta)}.`, '');
      out.push(`### ${t('quality.variables')}`, '', table([t('common.name'), t('common.type'), t('quality.label'), t('quality.unit'), t('quality.distinct')], p.columns.map((c) => [c.name, c.type, c.label && c.label !== c.name ? c.label : '', c.unit || '', c.distinct === undefined ? '' : n(c.distinct)])), '');
      out.push(`## ${t('quality.reliability')}`, '', write('quality.reliability.write'), '');
      const gaps = p.columns.filter((c) => c.nulls);
      out.push(`### ${t('quality.missing')}`, '', gaps.length ? table([t('common.name'), t('quality.missing.n'), t('quality.missing.share')], gaps.map((c) => [c.name, n(c.nulls), p.rows ? i18n.formatNumber(c.nulls / p.rows, { style: 'percent', maximumFractionDigits: 1 }) : ''])) : t('quality.missing.none'), '');
      if (p.duplicates) out.push(t('quality.duplicates', { n: n(p.duplicates) }), '');
      const rules = D.require('data/rules');
      const results = (await rules.run(id).catch(() => ({ results: [] }))).results;
      if (results.length) out.push(`### ${t('quality.rules')}`, '', table([t('quality.rule'), t('quality.rule.failing')], results.map((r) => [rules.describe(r.rule), n(r.failures)])), '');
      const notes = (await D.require('data/comments').list(id)).filter((c) => !c.resolved);
      if (notes.length) out.push(`### ${t('comments.title')}`, '', notes.map((c) => `- ${c.text}`).join('\n'), '');
      out.push(`## ${t('quality.timeliness')}`, '', `${t('common.created')}: ${i18n.formatDateTime(meta.createdAt)}. ${t('common.updated')}: ${i18n.formatDateTime(meta.updatedAt)}.`, '');
      if (d.frequency) out.push(`${t('dcat.frequency')}: ${t('dcat.frequency.' + d.frequency)}.`, '');
      if (d.temporalFrom || d.temporalTo) out.push(`${t('dcat.temporal')}: ${[d.temporalFrom, d.temporalTo].filter(Boolean).join(' – ')}.`, '');
      out.push(write('quality.timeliness.write'), '');
      out.push(`## ${t('quality.access')}`, '', d.publisher ? `${t('dcat.publisher')}: ${d.publisher}.` : write('dcat.publisher'), '');
      if (d.contactName || d.contactEmail) out.push(`${t('dcat.contact')}: ${[d.contactName, d.contactEmail].filter(Boolean).join(', ')}.`, '');
      if (d.license) out.push(`${t('dcat.license')}: ${d.license}.`, '');
      const steps = await D.require('data/recipes').steps(id);
      out.push(`## ${t('quality.comparability')}`, '', write('quality.comparability.write'), '');
      if (steps.length) out.push(`### ${t('quality.steps')}`, '', steps.map((s) => `- ${s.description}`).join('\n'), '');
      const labelled = p.columns.filter((c) => c.valueLabels);
      if (labelled.length) out.push(`### ${t('quality.labelled')}`, '', labelled.map((c) => `- ${c.name}`).join('\n'), '');
      return out.join('\n');
    }
    /** @param {string} id @returns {Promise<Blob>} */
    async function toDocx(id) {
      const meta = await datasets.get(id);
      const ast = D.require('docgen/markdown').parse(await markdownFor(id));
      return D.require('docgen/builders-office').toDocx(ast, { title: t('quality.title', { name: meta.name }) });
    }

    return { markdownFor, toDocx };
  });
})();
