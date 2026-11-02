// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Swedish number and time locales for Vega and D3 (decimal comma, narrow space as thousands separator,
 * ISO dates, Swedish month and day names).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/locale', [], () => {
    const numberLocale = { decimal: ',', thousands: ' ', grouping: [3], currency: ['', ' kr'], percent: ' %', minus: '−', nan: '' };
    const timeLocale = {
      dateTime: '%A den %d %B %Y %X',
      date: '%Y-%m-%d',
      time: '%H:%M:%S',
      periods: ['fm', 'em'],
      days: ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'],
      shortDays: ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'],
      months: ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'],
      shortMonths: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
    };
    /** Number formats offered in the builder: [id, label, d3-format pattern]. */
    const NUMBER_FORMATS = [
      { id: 'auto', label: 'Automatiskt', pattern: '' },
      { id: 'int', label: 'Heltal (1 234)', pattern: ',.0f' },
      { id: 'dec1', label: 'En decimal (1 234,5)', pattern: ',.1f' },
      { id: 'dec2', label: 'Två decimaler (1 234,56)', pattern: ',.2f' },
      { id: 'si', label: 'Förkortat (1,2k, 3,4M)', pattern: '~s' },
      { id: 'pct', label: 'Procent (12 %)', pattern: '.0%' },
      { id: 'pct1', label: 'Procent med decimal (12,3 %)', pattern: '.1%' },
    ];
    return { numberLocale, timeLocale, NUMBER_FORMATS };
  });
})();
