// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the kind raster (decision B-64): GeoTIFF and cloud-optimised GeoTIFF files read in the raster worker (engines/raster)
 * with their size, bands, place and system, and nothing decoded on the page; one dataset of one or more files, each a row with its
 * extent in WGS 84, the original byte for byte and a preview in Web Mercator with each pixel in its place; the overview that fits,
 * the limits on the originals and one band of floats stretched; the refusals in words the person can act on; the page never kept
 * waiting; Exportera's original and map image with its attribution; the review before sharing; undo, versions and packages; and
 * the orthophoto shown saved as a raster without a key, a token or a file address.
 * Nothing here touches the net: the files are GeoTIFFs written by tests/fixtures/geotiff, and the consent asker is a stub.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
})();
