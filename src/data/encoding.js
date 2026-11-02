// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Character-encoding detection for text imports. Swedish files from Excel are often Windows-1252,
 * while modern exports are UTF-8 (sometimes with a BOM). Strategy: BOM first, then a UTF-16 heuristic,
 * then strict UTF-8 validation of a sample, otherwise Windows-1252.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/encoding', [], () => {
    const SAMPLE = 1 << 20;
    const ENCODINGS = [
      { value: 'utf-8', label: 'UTF-8' },
      { value: 'windows-1252', label: 'Windows-1252 (ANSI, Latin-1)' },
      { value: 'iso-8859-1', label: 'ISO 8859-1' },
      { value: 'utf-16le', label: 'UTF-16 LE' },
      { value: 'utf-16be', label: 'UTF-16 BE' },
      { value: 'macintosh', label: 'Mac Roman' },
    ];

    /** Trim a UTF-8 sample so it does not end inside a multi-byte sequence. */
    function trimToCharBoundary(bytes) {
      let end = bytes.length;
      for (let back = 1; back <= 4 && end - back >= 0; back++) {
        const b = bytes[end - back];
        if (b < 0x80) return bytes.subarray(0, end);
        if (b >= 0xc0) return bytes.subarray(0, end - back);
      }
      return bytes;
    }

    /**
     * @param {Uint8Array} bytes
     * @returns {{encoding: string, bom: boolean, confidence: 'high'|'medium'|'low'}}
     */
    function detect(bytes) {
      if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { encoding: 'utf-8', bom: true, confidence: 'high' };
      if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: 'utf-16le', bom: true, confidence: 'high' };
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: 'utf-16be', bom: true, confidence: 'high' };
      const sample = bytes.subarray(0, Math.min(bytes.length, SAMPLE));
      let zerosEven = 0; let zerosOdd = 0; let high = 0;
      for (let i = 0; i < sample.length; i++) {
        const b = sample[i];
        if (b === 0) { if (i % 2) zerosOdd++; else zerosEven++; }
        else if (b >= 0x80) high++;
      }
      if (sample.length > 64 && zerosOdd > sample.length * 0.3) return { encoding: 'utf-16le', bom: false, confidence: 'medium' };
      if (sample.length > 64 && zerosEven > sample.length * 0.3) return { encoding: 'utf-16be', bom: false, confidence: 'medium' };
      if (high === 0) return { encoding: 'utf-8', bom: false, confidence: 'high' }; // pure ASCII
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(sample.length < bytes.length ? trimToCharBoundary(sample) : sample);
        return { encoding: 'utf-8', bom: false, confidence: 'high' };
      } catch (_e) {
        return { encoding: 'windows-1252', bom: false, confidence: 'medium' };
      }
    }

    /** @param {Uint8Array|ArrayBuffer} bytes @param {string} encoding */
    function decode(bytes, encoding) {
      return new TextDecoder(encoding).decode(bytes);
    }

    /**
     * Read a File as text, detecting the encoding unless one is given.
     * @param {Blob} file
     * @param {{encoding?: string, maxBytes?: number}} [options]
     */
    async function readText(file, options = {}) {
      const blob = options.maxBytes ? file.slice(0, options.maxBytes) : file;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const detected = detect(bytes);
      const encoding = options.encoding || detected.encoding;
      return { text: decode(bytes, encoding), encoding, detected, truncated: !!options.maxBytes && file.size > options.maxBytes, bytes: bytes.length };
    }

    return { detect, decode, readText, ENCODINGS };
  });
})();
