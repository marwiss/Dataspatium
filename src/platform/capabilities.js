// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Runtime capability detection. The app adapts to what the browser offers instead of assuming.
 * Verified 2026-11-02: under file:// Edge lacks OPFS and module workers, Firefox lacks File System
 * Access pickers, neither has SharedArrayBuffer. See the file:// spike notes kept outside the repo (.claude/plans/underlag/spik-fas0.md).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const protocol = globalThis.location ? location.protocol : 'unknown:';
  const caps = {
    protocol,
    isFileProtocol: protocol === 'file:',
    isSecureContext: !!globalThis.isSecureContext,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined' && !!globalThis.crossOriginIsolated,
    indexedDB: typeof indexedDB !== 'undefined',
    opfs: !!(navigator.storage && typeof navigator.storage.getDirectory === 'function'),
    fileSystemAccess: typeof globalThis.showDirectoryPicker === 'function',
    serviceWorker: !!navigator.serviceWorker && protocol !== 'file:',
    webLocks: !!navigator.locks,
    decompressionStream: typeof DecompressionStream === 'function',
    nativeBase64: typeof Uint8Array.fromBase64 === 'function',
    offscreenCanvas: typeof OffscreenCanvas === 'function',
    userAgent: navigator.userAgent,
    isFirefox: /Firefox\//.test(navigator.userAgent),
    isChromium: /Chrome\//.test(navigator.userAgent),
    /**
     * OPFS availability can only be confirmed by trying (Edge throws SecurityError on file://).
     * @returns {Promise<boolean>}
     */
    async probeOpfs() {
      if (!caps.opfs) return false;
      try { await navigator.storage.getDirectory(); return true; } catch (_e) { caps.opfs = false; return false; }
    },
  };
  D.capabilities = caps;
  D.define('platform/capabilities', [], () => caps);
})();
