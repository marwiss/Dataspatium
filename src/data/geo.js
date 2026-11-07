// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Geometry helpers shared by importers, exporters and the map charts: parse a geometry cell (GeoJSON
 * text or object, WKT such as POLYGON((...)) with optional Z/M and SRID prefix), tell projected
 * coordinates from longitude/latitude, and convert between SWEREF 99 TM (EPSG:3006, the projection
 * of Swedish geodata) and WGS 84 with Lantmäteriet's Gauss-Krüger formulas.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/geo', [], () => {
    /** Nested parentheses of a WKT body into nested arrays of [x, y]. */
    function parseNested(str) {
      let i = 0;
      const skipWs = () => { while (i < str.length && /\s/.test(str[i])) i++; };
      function list() {
        if (str[i] !== '(') throw new Error(D.t('geo.err.wkt.paren'));
        i++;
        const items = [];
        for (;;) {
          skipWs();
          if (str[i] === '(') items.push(list());
          else {
            const start = i;
            while (i < str.length && str[i] !== ',' && str[i] !== ')') i++;
            const nums = str.slice(start, i).trim().split(/\s+/).map(Number);
            if (nums.length < 2 || nums.slice(0, 2).some((n) => !Number.isFinite(n))) throw new Error(D.t('geo.err.wkt.coord'));
            items.push([nums[0], nums[1]]);
          }
          skipWs();
          if (str[i] === ',') { i++; continue; }
          if (str[i] === ')') { i++; return items; }
          throw new Error(D.t('geo.err.wkt.char'));
        }
      }
      skipWs();
      return list();
    }
    const isPoint = (v) => Array.isArray(v) && typeof v[0] === 'number';

    /** WKT text -> GeoJSON geometry, or null when the text is not WKT. */
    function wktToGeoJson(text) {
      const s = String(text || '').trim().replace(/^SRID=\d+\s*;\s*/i, '');
      const m = /^(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON)\s*(ZM|Z|M)?\s*(EMPTY|\(.*\))\s*$/is.exec(s);
      if (!m) return null;
      const type = m[1].toUpperCase();
      if (m[3].toUpperCase() === 'EMPTY') return null;
      let items;
      try { items = parseNested(m[3]); } catch (_err) { return null; }
      switch (type) {
        case 'POINT': return isPoint(items[0]) ? { type: 'Point', coordinates: items[0] } : null;
        case 'LINESTRING': return { type: 'LineString', coordinates: items };
        case 'POLYGON': return { type: 'Polygon', coordinates: items };
        case 'MULTIPOINT': return { type: 'MultiPoint', coordinates: items.map((it) => (isPoint(it) ? it : it[0])) };
        case 'MULTILINESTRING': return { type: 'MultiLineString', coordinates: items };
        case 'MULTIPOLYGON': return { type: 'MultiPolygon', coordinates: items };
        default: return null;
      }
    }

    /** A geometry cell (object, GeoJSON text, Feature text or WKT) -> GeoJSON geometry or null. */
    function parseGeometry(value) {
      if (value === null || value === undefined) return null;
      if (typeof value === 'object') return value.type === 'Feature' ? value.geometry || null : value;
      const s = String(value).trim();
      if (!s) return null;
      if (s[0] === '{') {
        try { const g = JSON.parse(s); return g && g.type === 'Feature' ? g.geometry || null : g; } catch (_err) { return null; }
      }
      return wktToGeoJson(s);
    }

    function firstCoordinate(c) { let v = c; while (Array.isArray(v) && Array.isArray(v[0])) v = v[0]; return Array.isArray(v) && typeof v[0] === 'number' ? v : null; }
    /** True when the first coordinate found cannot be longitude/latitude (projected metres such as SWEREF99 TM). */
    function isProjected(geometries) {
      for (const g of geometries || []) {
        const c = g && g.coordinates ? firstCoordinate(g.coordinates) : null;
        if (c) return Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90;
      }
      return false;
    }

    /** Bounding box {minX, minY, maxX, maxY} over geometries (or anything with `coordinates`); null when empty. */
    function bounds(geometries) {
      let b = null;
      const visit = (c) => {
        if (!Array.isArray(c)) return;
        if (typeof c[0] === 'number' && typeof c[1] === 'number') {
          if (!b) b = { minX: c[0], minY: c[1], maxX: c[0], maxY: c[1] };
          else { b.minX = Math.min(b.minX, c[0]); b.minY = Math.min(b.minY, c[1]); b.maxX = Math.max(b.maxX, c[0]); b.maxY = Math.max(b.maxY, c[1]); }
        } else for (const x of c) visit(x);
      };
      for (const g of geometries || []) {
        if (!g) continue;
        if (g.type === 'GeometryCollection') (g.geometries || []).forEach((gg) => visit(gg && gg.coordinates));
        else visit(g.coordinates);
      }
      return b;
    }

    // GRS 80 and SWEREF 99 TM (EPSG:3006): Gauss-Krüger series as published by Lantmäteriet, millimetre accuracy.
    const A = 6378137;
    const F = 1 / 298.257222101;
    const K0 = 0.9996;
    const LON0 = 15;
    const FALSE_E = 500000;
    const FALSE_N = 0;
    const DEG = Math.PI / 180;
    /** The SWEREF 99 projections: TM and the twelve local zones (central meridian, scale, false easting), by EPSG code. */
    const SWEREF_ZONES = {
      3006: { lon0: 15, k0: 0.9996, falseE: 500000 },
      3007: { lon0: 12, k0: 1, falseE: 150000 }, 3008: { lon0: 13.5, k0: 1, falseE: 150000 }, 3009: { lon0: 15, k0: 1, falseE: 150000 },
      3010: { lon0: 16.5, k0: 1, falseE: 150000 }, 3011: { lon0: 18, k0: 1, falseE: 150000 }, 3012: { lon0: 14.25, k0: 1, falseE: 150000 },
      3013: { lon0: 15.75, k0: 1, falseE: 150000 }, 3014: { lon0: 17.25, k0: 1, falseE: 150000 }, 3015: { lon0: 18.75, k0: 1, falseE: 150000 },
      3016: { lon0: 20.25, k0: 1, falseE: 150000 }, 3017: { lon0: 21.75, k0: 1, falseE: 150000 }, 3018: { lon0: 23.25, k0: 1, falseE: 150000 },
    };
    /** EPSG code of a CRS given as a number, "EPSG:3007", "urn:ogc:def:crs:EPSG::3007" or "SWEREF99 13 30"; 3006 for anything else. */
    function swerefZone(crs) {
      if (crs === null || crs === undefined || crs === '') return 3006;
      const m = /(\d{4})\s*$/.exec(String(crs).trim());
      if (m && SWEREF_ZONES[Number(m[1])]) return Number(m[1]);
      const z = /sweref\s*99\s*(\d{2})\s*(\d{2})/i.exec(String(crs));
      if (z) { const lon0 = Number(z[1]) + Number(z[2]) / 60; const hit = Object.keys(SWEREF_ZONES).find((k) => Number(k) !== 3006 && SWEREF_ZONES[k].lon0 === lon0); if (hit) return Number(hit); }
      return 3006;
    }
    function tmConstants() {
      const e2 = F * (2 - F);
      const n = F / (2 - F);
      const aHat = (A / (1 + n)) * (1 + (n ** 2) / 4 + (n ** 4) / 64);
      return { e2, n, aHat };
    }

    /** SWEREF 99 easting/northing in metres -> [longitude, latitude] in degrees; `epsg` picks the zone (default TM). */
    function swerefToWgs84(x, y, epsg) {
      const zone = SWEREF_ZONES[epsg] || SWEREF_ZONES[3006];
      const { e2, n, aHat } = tmConstants();
      const xi = (y - (zone.falseN || FALSE_N)) / (zone.k0 * aHat);
      const eta = (x - zone.falseE) / (zone.k0 * aHat);
      const d1 = n / 2 - (2 * n ** 2) / 3 + (37 * n ** 3) / 96 - (n ** 4) / 360;
      const d2 = (n ** 2) / 48 + (n ** 3) / 15 - (437 * n ** 4) / 1440;
      const d3 = (17 * n ** 3) / 480 - (37 * n ** 4) / 840;
      const d4 = (4397 * n ** 4) / 161280;
      const xiP = xi - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta) - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
      const etaP = eta - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta) - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
      const phiStar = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
      const dLon = Math.atan(Math.sinh(etaP) / Math.cos(xiP));
      const aS = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4;
      const bS = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
      const cS = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
      const dS = -(4279 * e2 ** 4) / 1260;
      const s = Math.sin(phiStar);
      const phi = phiStar + s * Math.cos(phiStar) * (aS + bS * s ** 2 + cS * s ** 4 + dS * s ** 6);
      return [zone.lon0 + dLon / DEG, phi / DEG];
    }

    /** [longitude, latitude] in degrees -> SWEREF 99 TM [easting, northing] in metres. */
    function wgs84ToSweref(lon, lat) {
      const { e2, n, aHat } = tmConstants();
      const phi = lat * DEG;
      const aC = e2;
      const bC = (5 * e2 ** 2 - e2 ** 3) / 6;
      const cC = (104 * e2 ** 3 - 45 * e2 ** 4) / 120;
      const dC = (1237 * e2 ** 4) / 1260;
      const s = Math.sin(phi);
      const phiStar = phi - s * Math.cos(phi) * (aC + bC * s ** 2 + cC * s ** 4 + dC * s ** 6);
      const dLon = (lon - LON0) * DEG;
      const xiP = Math.atan(Math.tan(phiStar) / Math.cos(dLon));
      const etaP = Math.atanh(Math.cos(phiStar) * Math.sin(dLon));
      const b1 = n / 2 - (2 * n ** 2) / 3 + (5 * n ** 3) / 16 + (41 * n ** 4) / 180;
      const b2 = (13 * n ** 2) / 48 - (3 * n ** 3) / 5 + (557 * n ** 4) / 1440;
      const b3 = (61 * n ** 3) / 240 - (103 * n ** 4) / 140;
      const b4 = (49561 * n ** 4) / 161280;
      const north = K0 * aHat * (xiP + b1 * Math.sin(2 * xiP) * Math.cosh(2 * etaP) + b2 * Math.sin(4 * xiP) * Math.cosh(4 * etaP) + b3 * Math.sin(6 * xiP) * Math.cosh(6 * etaP) + b4 * Math.sin(8 * xiP) * Math.cosh(8 * etaP)) + FALSE_N;
      const east = K0 * aHat * (etaP + b1 * Math.cos(2 * xiP) * Math.sinh(2 * etaP) + b2 * Math.cos(4 * xiP) * Math.sinh(4 * etaP) + b3 * Math.cos(6 * xiP) * Math.sinh(6 * etaP) + b4 * Math.cos(8 * xiP) * Math.sinh(8 * etaP)) + FALSE_E;
      return [east, north];
    }

    /** New geometry with every position replaced by fn([x, y]) -> [x, y]. */
    function mapCoordinates(geometry, fn) {
      if (!geometry) return geometry;
      const walk = (c) => (Array.isArray(c) && typeof c[0] === 'number' ? fn(c) : (Array.isArray(c) ? c.map(walk) : c));
      if (geometry.type === 'GeometryCollection') return Object.assign({}, geometry, { geometries: (geometry.geometries || []).map((g) => mapCoordinates(g, fn)) });
      return Object.assign({}, geometry, { coordinates: walk(geometry.coordinates || []) });
    }

    /**
     * Other Nordic transverse Mercator projections on GRS 80 / ETRS89: UTM zones 32–35 (Denmark, Norway, Finland;
     * EPSG:258xx and 326xx), ETRS-TM35FIN (3067) and the Finnish Gauss-Krüger zones GK19–GK31 (3873–3885; the city of
     * Helsinki publishes in GK25, 3879). Same series as SWEREF (the ellipsoid is the same), other parameters.
     */
    const TM_ZONES = {
      25832: { lon0: 9, k0: 0.9996, falseE: 500000 }, 25833: { lon0: 15, k0: 0.9996, falseE: 500000 }, 25834: { lon0: 21, k0: 0.9996, falseE: 500000 }, 25835: { lon0: 27, k0: 0.9996, falseE: 500000 },
      32632: { lon0: 9, k0: 0.9996, falseE: 500000 }, 32633: { lon0: 15, k0: 0.9996, falseE: 500000 }, 32634: { lon0: 21, k0: 0.9996, falseE: 500000 }, 32635: { lon0: 27, k0: 0.9996, falseE: 500000 },
      3067: { lon0: 27, k0: 0.9996, falseE: 500000 },
      // RT 90 2,5 gon V, with Lantmäteriet's parameters for direct conversion on GRS 80.
      3021: { lon0: 15.806284529, k0: 1.00000561024, falseE: 1500064.274, falseN: -667.711 },
    };
    for (let z = 19; z <= 31; z++) TM_ZONES[3854 + z] = { lon0: z, k0: 1, falseE: z * 1000000 + 500000 };
    /** ISN93 / Lambert 1993 (EPSG:3057), the Icelandic national grid: Lambert conformal conic with two standard parallels. */
    const ISN93 = { lat0: 65, lon0: -19, lat1: 64.25, lat2: 65.75, falseE: 500000, falseN: 500000 };
    /** EPSG code found in a CRS text ("EPSG:25832", "urn:ogc:def:crs:EPSG::3067", 3057), or null. */
    function epsgOf(crs) {
      if (crs === null || crs === undefined || crs === '') return null;
      if (typeof crs === 'number') return crs;
      const m = /(\d{4,5})\s*$/.exec(String(crs).trim());
      return m ? Number(m[1]) : null;
    }
    /** True when a CRS text names nothing: empty, or GeoPackage's undefined systems ("Undefined Cartesian SRS"). */
    const unnamed = (crs) => crs === null || crs === undefined || /^\s*(undefined\b.*)?$/i.test(String(crs));
    /**
     * EPSG code of a coordinate system given as a number, an EPSG text or URN ("EPSG:3007", "urn:ogc:def:crs:EPSG::3007",
     * "http://www.opengis.net/def/crs/EPSG/0/3007"), OGC's CRS84, or a name as GeoPackage files, .prj files and GIS programs
     * write it ("SWEREF99 TM", "SWEREF99_15_00", "RT90 2.5 gon V", "ETRS_1989_UTM_Zone_33N", "ETRS89 / TM35FIN(E,N)",
     * "ISN93 / Lambert 1993", "WGS 84"); null when it names nothing the app recognises.
     * @param {any} crs
     * @returns {number|null}
     */
    function crsCode(crs) {
      if (unnamed(crs)) return null;
      if (typeof crs === 'number') return crs;
      const s = String(crs).trim();
      const coded = /(?:^|epsg\D{0,4}|\/epsg\/\d+\/)(\d{4,5})\s*$/i.exec(s);
      if (coded) return Number(coded[1]);
      const n = s.toLowerCase().replace(/[_\s]+/g, ' ');
      if (/crs ?84/.test(n)) return 4326;
      if (/pseudo.?mercator|web ?mercator|900913/.test(n)) return 3857;
      if (/sweref ?99 ?tm/.test(n)) return 3006;
      const z = /sweref ?99 ?(\d{1,2}) ?(\d{2})/.exec(n);
      if (z) { const lon0 = Number(z[1]) + Number(z[2]) / 60; const hit = Object.keys(SWEREF_ZONES).find((k) => Number(k) !== 3006 && SWEREF_ZONES[k].lon0 === lon0); return hit ? Number(hit) : null; }
      if (/rt ?90/.test(n)) return /2[.,]?5 ?gon ?[vw]/.test(n) ? 3021 : null;
      const utm = /(etrs ?(?:19)?89|wgs ?(?:19)?84).*utm.*zone ?(\d{2}) ?n/.exec(n);
      if (utm) { const code = (/etrs/.test(utm[1]) ? 25800 : 32600) + Number(utm[2]); return TM_ZONES[code] ? code : null; }
      if (/tm ?35 ?fin/.test(n)) return 3067;
      const gk = /gk ?(\d{2}) ?fin/.exec(n);
      if (gk) { const code = 3854 + Number(gk[1]); return TM_ZONES[code] ? code : null; }
      if (/isn ?93|lambert ?1993/.test(n)) return 3057;
      if (/^(gcs )?(wgs ?(19)?84)$/.test(n)) return 4326;
      if (/^(gcs )?etrs ?(19)?89$/.test(n)) return 4258;
      return null;
    }
    /** True when the app can convert coordinates in this system (SWEREF 99, Web Mercator, the Nordic grids it reads, degrees). */
    const supported = (code) => !!(code && (SWEREF_ZONES[code] || TM_ZONES[code] || code === 3057 || code === 3857 || code === 4326 || code === 4258));
    /**
     * True when a file names a coordinate system the app cannot convert: its coordinates would land in the wrong place, so they
     * are not drawn. A file that names no system is not unknown (projected coordinates are then taken as SWEREF 99 TM).
     * @param {any} crs
     */
    function crsUnknown(crs) { return !unnamed(crs) && !supported(crsCode(crs)); }
    /** The usual name of a coordinate system the app reads ("SWEREF 99 TM", "SWEREF 99 15 00", "ETRS89 / UTM 33N"), or ''. */
    function crsLabel(crs) {
      const code = crsCode(crs);
      if (code === 3006) return 'SWEREF 99 TM';
      if (code && SWEREF_ZONES[code]) { const lon0 = SWEREF_ZONES[code].lon0; return `SWEREF 99 ${String(Math.floor(lon0)).padStart(2, '0')} ${String(Math.round((lon0 % 1) * 60)).padStart(2, '0')}`; }
      if (code === 3021) return 'RT 90 2,5 gon V';
      if (code && code >= 25832 && code <= 25835) return `ETRS89 / UTM ${code - 25800}N`;
      if (code && code >= 32632 && code <= 32635) return `WGS 84 / UTM ${code - 32600}N`;
      if (code === 3067) return 'ETRS-TM35FIN';
      if (code && code >= 3873 && code <= 3885) return `ETRS-GK${code - 3854}FIN`;
      if (code === 3057) return 'ISN93 / Lambert 1993';
      if (code === 3857) return 'Web Mercator';
      if (code === 4326) return 'WGS 84';
      if (code === 4258) return 'ETRS89';
      return '';
    }
    /** A system for people: its name with the EPSG code ("SWEREF 99 15 00 (EPSG:3009)"), or the text as the file gave it; '' for nothing. */
    function crsText(crs) {
      if (unnamed(crs)) return '';
      const label = crsLabel(crs);
      return label ? `${label} (EPSG:${crsCode(crs)})` : String(crs).trim();
    }
    /**
     * The proj4 definition of a projected system the app reads, from the same parameters as its own conversion (so that a map
     * drawn in the plan's grid puts every object where the conversion does); null for degrees, Web Mercator and unknown systems.
     * RT 90 2,5 gon V uses Lantmäteriet's direct projection on GRS 80, as the conversion does.
     * @param {any} crs
     * @returns {string|null}
     */
    function proj4Def(crs) {
      const code = crsCode(crs);
      const zone = code ? (SWEREF_ZONES[code] || TM_ZONES[code]) : null;
      const tail = '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
      if (zone) return `+proj=tmerc +lat_0=0 +lon_0=${zone.lon0} +k=${zone.k0} +x_0=${zone.falseE} +y_0=${zone.falseN || 0} ${tail}`;
      if (code === 3057) return `+proj=lcc +lat_0=${ISN93.lat0} +lon_0=${ISN93.lon0} +lat_1=${ISN93.lat1} +lat_2=${ISN93.lat2} +x_0=${ISN93.falseE} +y_0=${ISN93.falseN} ${tail}`;
      return null;
    }
    /** Height systems by EPSG code (the Nordic national ones). */
    const HEIGHT_SYSTEMS = { 5613: 'RH 2000', 5718: 'RH 70', 5799: 'DVR90', 5941: 'NN2000', 3900: 'N2000', 8089: 'ISH2004' };
    /** The name of a height system given as "EPSG:5613", a URN or a name; the text itself when the code is not one of the Nordic systems; '' for nothing. */
    function heightLabel(system) {
      if (unnamed(system)) return '';
      const code = epsgOf(system);
      return (code && HEIGHT_SYSTEMS[code]) || String(system).trim();
    }
    /** Lambert conformal conic (two parallels) metres -> [longitude, latitude]; GRS 80. */
    function lccToWgs84(x, y, p) {
      const e = Math.sqrt(F * (2 - F));
      const m = (phi) => Math.cos(phi) / Math.sqrt(1 - e * e * Math.sin(phi) ** 2);
      const tf = (phi) => Math.tan(Math.PI / 4 - phi / 2) / ((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi))) ** (e / 2);
      const phi1 = p.lat1 * DEG; const phi2 = p.lat2 * DEG; const phi0 = p.lat0 * DEG;
      const n = Math.log(m(phi1) / m(phi2)) / Math.log(tf(phi1) / tf(phi2));
      const Fc = m(phi1) / (n * tf(phi1) ** n);
      const rho0 = A * Fc * tf(phi0) ** n;
      const dx = x - p.falseE; const dy = rho0 - (y - p.falseN);
      const rho = Math.sign(n) * Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dx, dy);
      const tP = (rho / (A * Fc)) ** (1 / n);
      let phi = Math.PI / 2 - 2 * Math.atan(tP);
      for (let i = 0; i < 8; i++) phi = Math.PI / 2 - 2 * Math.atan(tP * ((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi))) ** (e / 2));
      return [p.lon0 + (theta / n) / DEG, phi / DEG];
    }
    /** Transverse Mercator metres -> [longitude, latitude] for a zone {lon0, k0, falseE} on GRS 80 (the SWEREF series). */
    function tmToWgs84(x, y, zone) {
      const saved = SWEREF_ZONES[0]; SWEREF_ZONES[0] = zone;
      try { return swerefToWgs84(x, y, 0); } finally { if (saved) SWEREF_ZONES[0] = saved; else delete SWEREF_ZONES[0]; }
    }
    /**
     * Projected geometry -> WGS 84; degrees pass through. Without `crs` the geometry is taken as SWEREF 99 TM (the
     * Swedish standard); a CRS of a local SWEREF 99 zone (EPSG:3007–3018) selects that zone. Also read: Web Mercator,
     * RT 90 2,5 gon V, the UTM zones 32–35 (ETRS89 and WGS 84), ETRS-TM35FIN, the Finnish GK zones and ISN93 (Iceland).
     * A system the app cannot convert gives null: no place rather than a wrong one (see `crsUnknown`).
     */
    function toWgs84(geometry, crs) {
      if (!isProjected([geometry])) return geometry;
      if (unnamed(crs)) return mapCoordinates(geometry, (c) => swerefToWgs84(c[0], c[1], 3006));
      const code = crsCode(crs);
      if (code === 3857) return mapCoordinates(geometry, (c) => mercatorToWgs84(c[0], c[1]));
      if (code === 3057) return mapCoordinates(geometry, (c) => lccToWgs84(c[0], c[1], ISN93));
      if (code && TM_ZONES[code]) return mapCoordinates(geometry, (c) => tmToWgs84(c[0], c[1], TM_ZONES[code]));
      if (code && SWEREF_ZONES[code]) return mapCoordinates(geometry, (c) => swerefToWgs84(c[0], c[1], code));
      // Unknown, or degrees declared for coordinates that are not degrees.
      return null;
    }
    /** True when the app can convert a CRS to WGS 84 (SWEREF 99, Web Mercator, RT 90 2,5 gon V, Nordic UTM/TM zones, ISN93, degrees). */
    function knownCrs(crs) { return supported(crsCode(crs)); }
    /** The coordinate system kept with a dataset (the file's, as the importer read it), or ''. */
    function crsOfMeta(meta) {
      if (!meta) return '';
      const o = meta.importOptions || {};
      return String(o.crs || meta.crs || '');
    }
    /** Web Mercator (EPSG:3857) metres -> [longitude, latitude]. */
    function mercatorToWgs84(x, y) {
      const R = 6378137;
      return [(x / R) / DEG, Math.atan(Math.sinh(y / R)) / DEG];
    }

    return { SWEREF_ZONES, TM_ZONES, ISN93, HEIGHT_SYSTEMS, swerefZone, epsgOf, crsCode, crsUnknown, crsLabel, crsText, crsOfMeta, proj4Def, heightLabel, knownCrs, parseGeometry, wktToGeoJson, firstCoordinate, isProjected, bounds, swerefToWgs84, wgs84ToSweref, tmToWgs84, lccToWgs84, mercatorToWgs84, mapCoordinates, toWgs84 };
  });
})();
