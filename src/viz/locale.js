// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Number and time locales for Vega and D3 in the active UI language: decimal and thousands separators
 * from Intl, month and day names from Intl.DateTimeFormat, ISO dates, and the number formats offered in
 * the chart builder. Built once per page load (a language change reloads the page).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/locale', ['ui/i18n'], (i18n) => {
    const locale = i18n.locale();
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
    const decimal = (parts.find((p) => p.type === 'decimal') || { value: ',' }).value;
    const group = (parts.find((p) => p.type === 'group') || { value: ' ' }).value;
    const currencyByLanguage = { sv: ' kr', da: ' kr.', nb: ' kr', fi: ' €', is: ' kr.', en: ' £' };
    const numberLocale = { decimal, thousands: group, grouping: [3], currency: ['', currencyByLanguage[i18n.language()] || ''], percent: ' %', minus: '−', nan: '' };

    const names = (options, count, mk) => Array.from({ length: count }, (_, i) => new Intl.DateTimeFormat(locale, options).format(mk(i)));
    const day = (i) => new Date(Date.UTC(2024, 0, 7 + i, 12)); // 2024-01-07 is a Sunday
    const month = (i) => new Date(Date.UTC(2024, i, 15, 12));
    const timeLocale = {
      dateTime: '%A %d %B %Y %X',
      date: '%Y-%m-%d',
      time: '%H:%M:%S',
      periods: ['fm', 'em'],
      days: names({ weekday: 'long', timeZone: 'UTC' }, 7, day),
      shortDays: names({ weekday: 'short', timeZone: 'UTC' }, 7, day).map((s) => s.replace(/\.$/, '')),
      months: names({ month: 'long', timeZone: 'UTC' }, 12, month),
      shortMonths: names({ month: 'short', timeZone: 'UTC' }, 12, month).map((s) => s.replace(/\.$/, '')),
    };
    /** Number formats offered in the builder: [id, label, d3-format pattern]. */
    const NUMBER_FORMATS = [
      { id: 'auto', label: D.t('viz.numfmt.auto'), pattern: '' },
      { id: 'int', label: D.t('viz.numfmt.int'), pattern: ',.0f' },
      { id: 'dec1', label: D.t('viz.numfmt.dec1'), pattern: ',.1f' },
      { id: 'dec2', label: D.t('viz.numfmt.dec2'), pattern: ',.2f' },
      { id: 'si', label: D.t('viz.numfmt.si'), pattern: '~s' },
      { id: 'pct', label: D.t('viz.numfmt.pct'), pattern: '.0%' },
      { id: 'pct1', label: D.t('viz.numfmt.pct1'), pattern: '.1%' },
    ];
    return { numberLocale, timeLocale, NUMBER_FORMATS, locale };
  });
})();
