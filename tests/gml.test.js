// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for the GML reader (F130 a, io/importers/gml) on short excerpts of real answers (2026-11-28): Kartverket's deegree
 * (WFS 2.0, GML 3.2, urn:ogc:def:crs:EPSG::4326 with latitude first and EPSG:4326 with longitude first), SCB's GeoServer (WFS
 * 1.1.0 GML 3.1.1 in urn:x-ogc:def:crs:EPSG:3006 with northing first, WFS 1.0.0 GML 2.1.2 with gml:coordinates, WFS 2.0 GML 3.2
 * with epsg.xml#4326); multi geometries, curves and nested attributes; the WFS family choosing GML when a service has no
 * GeoJSON, with pages, the box in CRS84 and the answer as a map; and a .gml file in Inhämta. Nothing touches the net: the
 * services are dataspatium-asset:// addresses.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const t = D.require('ui/i18n').t;
  const gml = D.require('io/importers/gml');
  const parsers = D.require('api/parsers');
  const geodata = D.require('api/families/geodata');
  const connectors = D.require('api/connectors');
  const runner = D.require('api/runner');
  const leaflet = D.require('viz/leaflet');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const BASE = 'dataspatium-asset://tests/gml';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
    const t0 = performance.now();
    for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(40); }
  }
  const names = [];
  function serve(name, fn) {
    names.push(name);
    D.net.virtual(name, (url) => Promise.resolve().then(() => fn(new URL(url))).then((out) => ({ kind: 'text', data: String(out) })));
  }
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

  // ---- Kartverket, administrative enheter (deegree, WFS 2.0, GML 3.2) ----
  const KV_APP = 'https://skjema.geonorge.no/SOSI/produktspesifikasjon/AdmEnheter/20240101';
  /** One municipality as Kartverket sends it, with the ring cut to three points and closed. */
  const kommune = (id, srs, ring, nr, navn) => `
  <wfs:member>
    <app:Kommune xmlns:app="${KV_APP}" gml:id="kommune.${id}">
      <app:identifikasjon>
        <app:Identifikasjon>
          <app:lokalId>999ff9a4-33de-4ba7-9d39-d27f89752f55</app:lokalId>
          <app:navnerom>https://data.geonorge.no/sosi/inndelinger/inndelingsbase/kommuner</app:navnerom>
          <app:versjonId>7</app:versjonId>
        </app:Identifikasjon>
      </app:identifikasjon>
      <app:oppdateringsdato>2024-05-10T11:00:48</app:oppdateringsdato>
      <app:område>
        <!--Inlined geometry 'kommune.${id}_APP_OMRÅDE'-->
        <gml:MultiSurface gml:id="kommune.${id}_APP_OMRÅDE" srsName="${srs}">
          <gml:surfaceMember>
            <gml:Polygon gml:id="GEOMETRY_1a322c7c-9654-43bb-bec4-f294f162e4fe" srsName="${srs}">
              <gml:exterior>
                <gml:LinearRing>
                  <gml:posList>${ring}</gml:posList>
                </gml:LinearRing>
              </gml:exterior>
            </gml:Polygon>
          </gml:surfaceMember>
        </gml:MultiSurface>
      </app:område>
      <app:administrativEnhetNavn>
        <app:AdministrativEnhetNavn>
          <app:navn>${navn}</app:navn>
          <app:språk>nor</app:språk>
          <app:rekkefølge>0</app:rekkefølge>
        </app:AdministrativEnhetNavn>
      </app:administrativEnhetNavn>
      <app:kommunenummer>${nr}</app:kommunenummer>
      <app:kommunenavn>${navn}</app:kommunenavn>
      <app:samiskForvaltningsområde>false</app:samiskForvaltningsområde>
    </app:Kommune>
  </wfs:member>`;
  const kvCollection = (members, matched = 'unknown') => `<?xml version='1.0' encoding='UTF-8'?>
<wfs:FeatureCollection xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:wfs="http://www.opengis.net/wfs/2.0" timeStamp="2026-11-28T02:07:50Z" xmlns:gml="http://www.opengis.net/gml/3.2" numberMatched="${matched}" numberReturned="0">
  <!--NOTE: numberReturned attribute should be 'unknown' as well, but this would not validate against the current version of the WFS 2.0 schema (change upcoming).-->${members}
</wfs:FeatureCollection>`;
  const LATLON = '60.803009 12.080177 60.803073 12.080237 60.803762 12.081291 60.803009 12.080177';
  const LONLAT = '12.080177 60.803009 12.080237 60.803073 12.081291 60.803762 12.080177 60.803009';
  const RING = [[12.080177, 60.803009], [12.080237, 60.803073], [12.081291, 60.803762], [12.080177, 60.803009]];
  /** Kartverket's stedsnavn: a bridge with its centre line, the name nested three levels down. */
  const STED = `<?xml version='1.0' encoding='UTF-8'?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" numberMatched="unknown" numberReturned="0">
  <wfs:member>
    <app:Sted xmlns:app="https://skjema.geonorge.no/SOSI/produktspesifikasjon/StedsnavnForVanligBruk/20231001" gml:id="sted.1314433">
      <app:identifikasjon><app:Identifikasjon><app:lokalId>18536</app:lokalId><app:navnerom>https://data.geonorge.no/sosi/stedsnavn</app:navnerom><app:versjonId>20221201</app:versjonId></app:Identifikasjon></app:identifikasjon>
      <app:senterlinje>
        <!--Inlined geometry 'sted.1314433_APP_SENTERLINJE'-->
        <gml:LineString gml:id="sted.1314433_APP_SENTERLINJE" srsName="urn:ogc:def:crs:EPSG::4326">
          <gml:posList>68.930214 18.477234 68.929571 18.479861</gml:posList>
        </gml:LineString>
      </app:senterlinje>
      <app:stedsnavn>
        <app:Stedsnavn>
          <app:navnestatus>hovednavn</app:navnestatus>
          <app:skrivemåte><app:Skrivemåte><app:komplettskrivemåte>Tunebrua</app:komplettskrivemåte><app:skrivemåtestatus>godkjent</app:skrivemåtestatus></app:Skrivemåte></app:skrivemåte>
        </app:Stedsnavn>
      </app:stedsnavn>
      <app:navneobjekttype>bru</app:navneobjekttype>
      <app:kommune><app:Kommune><app:kommunenummer>5520</app:kommunenummer><app:kommunenavn>Bardu</app:kommunenavn></app:Kommune></app:kommune>
    </app:Sted>
  </wfs:member>
</wfs:FeatureCollection>`;

  // ---- SCB, tätorter (GeoServer) ----
  const SCB_ATTRS = (p) => `<${p}objectid>1</${p}objectid><${p}kod>0125TB114</${p}kod><${p}officielltnamn>Älvnäs</${p}officielltnamn><${p}totalareal_varde>58.033344</${p}totalareal_varde><${p}befolkning>822</${p}befolkning>`;
  const SCB_311 = `<?xml version="1.0" encoding="UTF-8"?><wfs:FeatureCollection xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:stat="http://geodata.scb.se/stat" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" numberOfFeatures="1" timeStamp="2026-11-28T02:31:27.814Z"><gml:featureMembers><stat:Tatorter_2023 gml:id="Tatorter_2023.1">${SCB_ATTRS('stat:')}<stat:sp_geometry><gml:MultiSurface srsName="urn:x-ogc:def:crs:EPSG:3006"><gml:surfaceMember><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>6575215.37399736 657235.14570001 6575220.88269737 657228.51860001 6575225.72199737 657225.17050001 6575215.37399736 657235.14570001</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember></gml:MultiSurface></stat:sp_geometry></stat:Tatorter_2023></gml:featureMembers></wfs:FeatureCollection>`;
  const SCB_2 = `<?xml version="1.0" encoding="UTF-8"?><wfs:FeatureCollection xmlns="http://www.opengis.net/wfs" xmlns:wfs="http://www.opengis.net/wfs" xmlns:stat="http://geodata.scb.se/stat" xmlns:gml="http://www.opengis.net/gml" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><gml:featureMember><stat:Tatorter_2023 fid="Tatorter_2023.1">${SCB_ATTRS('stat:')}<stat:sp_geometry><gml:MultiPolygon srsName="http://www.opengis.net/gml/srs/epsg.xml#3006"><gml:polygonMember><gml:Polygon><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates decimal="." cs="," ts=" ">657235.14570001,6575215.37399736 657228.51860001,6575220.88269736 657225.17050001,6575225.72199736 657235.14570001,6575215.37399736</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></gml:polygonMember></gml:MultiPolygon></stat:sp_geometry></stat:Tatorter_2023></gml:featureMember></wfs:FeatureCollection>`;
  const SCB_32 = `<?xml version="1.0" encoding="UTF-8"?><wfs:FeatureCollection xmlns:stat="http://geodata.scb.se/stat" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" numberMatched="2017" numberReturned="1" timeStamp="2026-11-28T02:33:10.120Z"><wfs:member><stat:Tatorter_2023 gml:id="Tatorter_2023.1">${SCB_ATTRS('stat:')}<stat:sp_geometry><gml:MultiSurface gml:id="Tatorter_2023.1.sp_geometry" srsName="http://www.opengis.net/gml/srs/epsg.xml#4326"><gml:surfaceMember><gml:Polygon gml:id="Tatorter_2023.1.sp_geometry.1"><gml:exterior><gml:LinearRing><gml:posList>17.76026783 59.28653187 17.76015565 59.28658375 17.76010047 59.2866284 17.76026783 59.28653187</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></gml:surfaceMember></gml:MultiSurface></stat:sp_geometry></stat:Tatorter_2023></wfs:member></wfs:FeatureCollection>`;
  const SCB_RING = [[657235.14570001, 6575215.37399736], [657228.51860001, 6575220.88269736], [657225.17050001, 6575225.72199736], [657235.14570001, 6575215.37399736]];

  test('gml: GML 3.2 from Kartverket reads the axis order its srsName says, the nested properties as columns, the surface as a multipolygon', async (assert) => {
    const urn = await gml.read(kvCollection(kommune(1, 'urn:ogc:def:crs:EPSG::4326', LATLON, '3419', 'Våler')));
    const plain = await gml.read(kvCollection(kommune(1, 'EPSG:4326', LONLAT, '3419', 'Våler')));
    for (const [label, got] of [['urn, latitude first', urn], ['EPSG:4326, longitude first as deegree writes it', plain]]) {
      assert.equal(got.features.length, 1, label);
      const f = got.features[0];
      assert.equal(f.geometry.type, 'MultiPolygon', label);
      assert.deepEqual(f.geometry.coordinates, [[RING]], label + ': longitude, latitude');
      assert.equal(got.crs, 'EPSG:4326', label);
      assert.equal(got.numberMatched, null, label + ': numberMatched "unknown" is no number');
    }
    const [rec] = gml.records(urn.features);
    assert.equal(rec.id, 'kommune.1');
    assert.equal(rec.kommunenummer, '3419'); assert.equal(rec.kommunenavn, 'Våler'); assert.equal(rec['samiskForvaltningsområde'], 'false');
    assert.equal(rec['identifikasjon.lokalId'], '999ff9a4-33de-4ba7-9d39-d27f89752f55', 'the object element (Identifikasjon) is left out of the name');
    assert.equal(rec['administrativEnhetNavn.navn'], 'Våler');
    assert.equal(rec.geometri_typ, 'MultiPolygon');
    assert.ok(!Object.keys(rec).some((k) => /^område/.test(k)), 'the geometry property is the geometry, not a column');
    const sted = gml.records((await gml.read(STED)).features)[0];
    assert.equal(sted['stedsnavn.skrivemåte.komplettskrivemåte'], 'Tunebrua', 'three levels down');
    assert.equal(sted['kommune.kommunenavn'], 'Bardu');
    assert.deepEqual(JSON.parse(sted.geometri), { type: 'LineString', coordinates: [[18.477234, 68.930214], [18.479861, 68.929571]] });
    // Two members: the rows keep their order, a repeated name is joined.
    const two = await gml.read(kvCollection(kommune(1, 'urn:ogc:def:crs:EPSG::4326', LATLON, '3419', 'Våler') + kommune(2, 'urn:ogc:def:crs:EPSG::4326', LATLON, '3420', 'Elverum')));
    assert.deepEqual(gml.records(two.features).map((r) => r.kommunenummer), ['3419', '3420']);
    return 'ok';
  });

  test('gml: GML 3.1.1 and 2.1.2 from SCB, CRS84 and the http URI of EPSG read as x and y in the app\'s order', async (assert) => {
    const v311 = await gml.read(SCB_311);
    assert.equal(v311.crs, 'EPSG:3006');
    assert.deepEqual(v311.features[0].geometry.coordinates, [[[[657235.14570001, 6575215.37399736], [657228.51860001, 6575220.88269737], [657225.17050001, 6575225.72199737], [657235.14570001, 6575215.37399736]]]], 'urn:x-ogc 3006: northing first, read as easting, northing');
    const r311 = gml.records(v311.features, { names: ['geometry_type', 'geometry'] })[0];
    assert.equal(r311.officielltnamn, 'Älvnäs'); assert.equal(r311.befolkning, '822'); assert.equal(r311.id, 'Tatorter_2023.1'); assert.equal(r311.geometry_type, 'MultiPolygon');
    const v2 = await gml.read(SCB_2);
    assert.equal(v2.crs, 'EPSG:3006');
    assert.deepEqual(v2.features[0].geometry.coordinates, [[SCB_RING]], 'GML 2 coordinates with cs and ts, epsg.xml#3006 as x, y');
    assert.equal(gml.records(v2.features)[0].id, 'Tatorter_2023.1', 'fid');
    const v32 = await gml.read(SCB_32);
    assert.equal(v32.numberMatched, 2017); assert.equal(v32.numberReturned, 1);
    assert.deepEqual(v32.features[0].geometry.coordinates[0][0][0], [17.76026783, 59.28653187], 'epsg.xml#4326: longitude first');
    // The other spellings of a system.
    const point = (srs, pos) => `<gml:FeatureCollection xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:a="urn:a"><gml:featureMember><a:p gml:id="p1"><a:g><gml:Point srsName="${srs}"><gml:pos>${pos}</gml:pos></gml:Point></a:g></a:p></gml:featureMember></gml:FeatureCollection>`;
    const at = async (srs, pos) => (await gml.read(point(srs, pos))).features[0].geometry.coordinates;
    assert.deepEqual(await at('urn:ogc:def:crs:OGC:1.3:CRS84', '18.07 59.33'), [18.07, 59.33], 'CRS84: longitude first');
    assert.deepEqual(await at('http://www.opengis.net/def/crs/OGC/1.3/CRS84', '18.07 59.33'), [18.07, 59.33]);
    assert.deepEqual(await at('http://www.opengis.net/def/crs/EPSG/0/4326', '59.33 18.07'), [18.07, 59.33], 'EPSG\'s http URI: latitude first');
    assert.deepEqual(await at('urn:ogc:def:crs:EPSG::4258', '59.33 18.07'), [18.07, 59.33], 'ETRS89 too');
    assert.deepEqual(await at('urn:ogc:def:crs:EPSG::25833', '262000 6650000'), [262000, 6650000], 'UTM 33N: easting first in EPSG too');
    assert.deepEqual(await at('urn:ogc:def:crs:EPSG::3045', '6650000 262000'), [262000, 6650000], 'ETRS-TM33: northing first, the same grid as UTM 33N');
    assert.equal((await gml.read(point('urn:ogc:def:crs:EPSG::3045', '6650000 262000'))).crs, 'EPSG:25833');
    // A server that writes SWEREF 99 TM as easting, northing under a URN: the first position cannot be a northing, so it is read as it is.
    assert.deepEqual(await at('urn:ogc:def:crs:EPSG::3006', '657235.1 6575215.4'), [657235.1, 6575215.4], 'an impossible order is read the other way');
    assert.deepEqual(await at('urn:ogc:def:crs:EPSG::4326', '160.8 12.08'), [160.8, 12.08], 'a latitude beyond 90 is a longitude');
    return 'ok';
  });

  test('gml: points, lines, surfaces, their multi forms and the usual curves, simplified', async (assert) => {
    const doc = `<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:t="urn:test">
      <wfs:member><t:o gml:id="o1"><t:namn>Punkter</t:namn><t:g><gml:MultiPoint srsName="EPSG:3006"><gml:pointMember><gml:Point><gml:pos>100 200</gml:pos></gml:Point></gml:pointMember><gml:pointMember><gml:Point><gml:pos>110 210</gml:pos></gml:Point></gml:pointMember></gml:MultiPoint></t:g></t:o></wfs:member>
      <wfs:member><t:o gml:id="o2"><t:namn>Linjer</t:namn><t:g><gml:MultiCurve srsName="EPSG:3006"><gml:curveMember><gml:LineString><gml:pos>0 0</gml:pos><gml:pos>10 0</gml:pos></gml:LineString></gml:curveMember><gml:curveMember><gml:Curve><gml:segments><gml:LineStringSegment><gml:posList>10 0 20 0</gml:posList></gml:LineStringSegment><gml:ArcString><gml:posList>20 0 30 10 40 0</gml:posList></gml:ArcString></gml:segments></gml:Curve></gml:curveMember></gml:MultiCurve></t:g></t:o></wfs:member>
      <wfs:member><t:o gml:id="o3"><t:namn>Yta med hål</t:namn><t:g><gml:Surface srsName="EPSG:3006"><gml:patches><gml:PolygonPatch><gml:exterior><gml:LinearRing><gml:posList>0 0 100 0 100 100 0 100 0 0</gml:posList></gml:LinearRing></gml:exterior><gml:interior><gml:LinearRing><gml:posList>40 40 60 40 60 60 40 60</gml:posList></gml:LinearRing></gml:interior></gml:PolygonPatch></gml:patches></gml:Surface></t:g></t:o></wfs:member>
      <wfs:member><t:o gml:id="o4"><t:namn>Cirkel</t:namn><t:g><gml:Polygon srsName="EPSG:3006"><gml:exterior><gml:Ring><gml:curveMember><gml:Curve><gml:segments><gml:CircleByCenterPoint numArc="1"><gml:pos>500 500</gml:pos><gml:radius uom="m">10</gml:radius></gml:CircleByCenterPoint></gml:segments></gml:Curve></gml:curveMember></gml:Ring></gml:exterior></gml:Polygon></t:g></t:o></wfs:member>
      <wfs:member><t:o gml:id="o5"><t:namn xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/><t:g><gml:MultiGeometry srsName="EPSG:3006"><gml:geometryMember><gml:Point><gml:pos>1 2</gml:pos></gml:Point></gml:geometryMember><gml:geometryMember><gml:LineString><gml:posList srsDimension="3">0 0 5 1 1 5</gml:posList></gml:LineString></gml:geometryMember></gml:MultiGeometry></t:g><t:extra><gml:Point srsName="EPSG:3006"><gml:pos>7 8</gml:pos></gml:Point></t:extra><t:dokument xlink:href="https://example.invalid/d.pdf" xmlns:xlink="http://www.w3.org/1999/xlink"/></t:o></wfs:member>
    </wfs:FeatureCollection>`;
    const got = await gml.read(doc);
    const g = got.features.map((f) => f.geometry);
    assert.deepEqual(g.map((x) => x.type), ['MultiPoint', 'MultiLineString', 'Polygon', 'Polygon', 'GeometryCollection']);
    assert.deepEqual(g[0].coordinates, [[100, 200], [110, 210]]);
    const [first, second] = g[1].coordinates;
    assert.deepEqual(first, [[0, 0], [10, 0]]);
    assert.deepEqual(second.slice(0, 2), [[10, 0], [20, 0]], 'the segments joined');
    const arc = second.slice(1);
    assert.ok(arc.length > 10, 'the arc drawn as short chords: ' + arc.length);
    assert.ok(arc.every((p) => near(Math.hypot(p[0] - 30, p[1]), 10, 1e-6)), 'every point of the arc on its circle (centre 30 0, radius 10)');
    assert.ok(arc.some((p) => near(p[0], 30, 0.5) && near(p[1], 10, 0.5)), 'through its middle point');
    assert.deepEqual(arc[arc.length - 1], [40, 0], 'ends where it should');
    assert.equal(g[2].coordinates.length, 2, 'exterior and interior');
    assert.deepEqual(g[2].coordinates[1][0], g[2].coordinates[1][g[2].coordinates[1].length - 1], 'the interior ring is closed');
    const circle = g[3].coordinates[0];
    assert.ok(circle.length > 30 && circle.every((p) => near(Math.hypot(p[0] - 500, p[1] - 500), 10, 1e-6)), 'a circle by its centre');
    assert.deepEqual(g[4].geometries.map((x) => x.type), ['Point', 'LineString']);
    assert.deepEqual(g[4].geometries[1].coordinates, [[0, 0, 5], [1, 1, 5]], 'three dimensions in groups of three');
    const rec = gml.records(got.features)[4];
    assert.equal(rec.namn, null, 'xsi:nil is empty');
    assert.deepEqual(JSON.parse(rec.extra), { type: 'Point', coordinates: [7, 8] }, 'a second geometry as GeoJSON text');
    assert.equal(rec.dokument, 'https://example.invalid/d.pdf', 'a reference by xlink:href');
    await assert.throws(() => gml.read('<inte xml'), new RegExp(t('import.err.gml').slice(0, 12)));
    return 'ok';
  });

  test('gml: the API format gml gives WGS 84 and numberMatched for paging; a projected answer is converted', async (assert) => {
    const a = await parsers.parse(kvCollection(kommune(1, 'urn:ogc:def:crs:EPSG::4326', LATLON, '3419', 'Våler')), { format: 'gml' });
    assert.ok(a.columns.includes('kommunenavn') && a.columns.includes('geometri') && a.columns.includes('geometri_typ'), a.columns.join(','));
    assert.deepEqual(JSON.parse(a.rows[0][a.columns.indexOf('geometri')]).coordinates, [[RING]]);
    assert.equal(a.data.numberMatched, undefined, '"unknown" leaves paging to the page size');
    // Geometries that name no system are in the one asked for (the endpoint's response options).
    const bare = kvCollection(kommune(1, 'urn:ogc:def:crs:EPSG::4326', LATLON, '3419', 'Våler')).replace(/ srsName="[^"]*"/g, '');
    const d = await parsers.parse(bare, { format: 'gml', options: { srsName: 'urn:ogc:def:crs:EPSG::4326' } });
    assert.deepEqual(JSON.parse(d.rows[0][d.columns.indexOf('geometri')]).coordinates, [[RING]], 'no srsName: the system asked for');
    const b = await parsers.parse(SCB_32, { format: 'gml' });
    assert.equal(b.data.numberMatched, 2017);
    const c = await parsers.parse(SCB_311, { format: 'gml' });
    const ring = JSON.parse(c.rows[0][c.columns.indexOf('geometri')]).coordinates[0][0];
    assert.ok(ring.every((p) => p[0] > 17 && p[0] < 19 && p[1] > 59 && p[1] < 60), 'SWEREF 99 TM converted to WGS 84 near Stockholm: ' + JSON.stringify(ring[0]));
    // An exception report is the service's error, as for GeoJSON.
    const exc = '<?xml version="1.0"?><ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0"><ows:Exception exceptionCode="InvalidParameterValue" locator="typeNames"><ows:ExceptionText>Unknown feature type</ows:ExceptionText></ows:Exception></ows:ExceptionReport>';
    await assert.throws(() => parsers.parse(exc, { format: 'gml' }), /Unknown feature type/);
    return 'ok';
  });

  // Kartverket's capabilities, cut to one feature type and the GetFeature formats (GML only), with a CountDefault for paging.
  const KV_CAPS = `<?xml version='1.0' encoding='UTF-8'?>
<wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:ows="http://www.opengis.net/ows/1.1" xmlns="http://www.opengis.net/wfs/2.0" version="2.0.0">
  <ows:OperationsMetadata>
    <ows:Operation name="GetFeature"><ows:DCP><ows:HTTP><ows:Get xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://wfs.geonorge.no/skwms1/wfs.administrative_enheter?" /></ows:HTTP></ows:DCP></ows:Operation>
    <ows:Parameter name="outputFormat"><ows:AllowedValues><ows:Value>text/xml; subtype=gml/3.2.1</ows:Value><ows:Value>application/gml+xml; version=3.2</ows:Value></ows:AllowedValues></ows:Parameter>
    <ows:Constraint name="CountDefault"><ows:NoValues /><ows:DefaultValue>2</ows:DefaultValue></ows:Constraint>
  </ows:OperationsMetadata>
  <FeatureTypeList>
    <FeatureType>
      <Name xmlns:app="${KV_APP}">app:Kommune</Name>
      <Title>Kommune</Title>
      <DefaultCRS>urn:ogc:def:crs:EPSG::4258</DefaultCRS>
    </FeatureType>
  </FeatureTypeList>
</wfs:WFS_Capabilities>`;

  test('gml: a WFS with only GML is read as GML in WGS 84, the box is sent in CRS84, paging stops at a short page, and the answer opens as a map', async (assert) => {
    const ids = []; const seen = [];
    const all = [['3419', 'Våler'], ['3420', 'Elverum'], ['3421', 'Trysil']];
    serve('tests/gml/kv', (u) => {
      if (u.searchParams.get('request') === 'GetCapabilities') return KV_CAPS;
      seen.push(u);
      const start = Number(u.searchParams.get('startIndex') || 0); const count = Number(u.searchParams.get('count') || 1000);
      return kvCollection(all.slice(start, start + count).map(([nr, navn], i) => kommune(start + i + 1, 'urn:ogc:def:crs:EPSG::4326', LATLON, nr, navn)).join(''));
    });
    try {
      assert.equal(geodata.gmlFormat(['text/xml; subtype=gml/3.1.1', 'text/xml; subtype=gml/3.2.1', 'GML2']), 'text/xml; subtype=gml/3.2.1', 'GML 3.2 first');
      assert.equal(geodata.gmlFormat(['GML2', 'gml3']), 'gml3');
      assert.equal(geodata.gmlFormat(['GML2', 'SHAPE-ZIP']), 'GML2');
      assert.equal(geodata.gmlFormat(['SHAPE-ZIP', 'csv']), null);
      const r = await geodata.createConnector('wfs', { baseUrl: BASE + '/kv' });
      ids.push(r.connector.id);
      assert.equal(r.discoveryError, null, 'GML is no longer an error: ' + r.discoveryError);
      const ep = r.connector.endpoints[0];
      assert.equal(ep.response.format, 'gml');
      const param = (name) => ep.params.find((p) => p.name === name);
      assert.equal(param('outputFormat').default, 'text/xml; subtype=gml/3.2.1', 'the format as the service names it');
      assert.equal(param('srsName').default, 'urn:ogc:def:crs:EPSG::4326', 'WGS 84 as a URN');
      assert.equal(param('bbox').type, 'bbox'); assert.equal(param('bbox').bboxCrs, 'urn:ogc:def:crs:OGC:1.3:CRS84');
      assert.equal(geodata.genericEndpoint(r.connector).response.format, 'gml', 'the generic endpoint too');
      const table = await runner.fetchTable(r.connector, ep, { bbox: '11,60,13,61' });
      assert.equal(table.rows.length, 3); assert.equal(table.meta.pages, 2, 'pages of CountDefault, the second short');
      const first = seen[0];
      assert.equal(first.searchParams.get('bbox'), '11,60,13,61,urn:ogc:def:crs:OGC:1.3:CRS84', 'the box with its system');
      assert.equal(first.searchParams.get('typeNames'), 'app:Kommune');
      assert.deepEqual(table.rows.map((row) => row[table.columns.indexOf('kommunenavn')]), ['Våler', 'Elverum', 'Trysil']);
      await assert.throws(() => runner.fetchTable(r.connector, ep, { bbox: '60,11,61,13,9' }), /bbox|WGS 84|Område|Area/i);
      const meta = await runner.toDataset(table, { name: 'GML-test', source: { kind: 'api', connectorName: r.connector.name } });
      try {
        const cols = await datasets.columns(meta.id);
        assert.ok(leaflet.mapDefault(cols), 'the dataset opens as a map');
      } finally { await datasets.remove(meta.id); }
      // A source saved before GML was read asks again and gets GML endpoints.
      const again = await geodata.refresh(r.connector);
      assert.equal(again.connector.endpoints[0].response.format, 'gml');
    } finally { for (const id of ids) await connectors.remove(id).catch(() => {}); }
    return 'ok';
  });

  test('gml: a .gml file in Inhämta is a geodata table in its own system, one feature type at a time; GML saved as .xml goes to the same reader', async (assert) => {
    const created = [];
    const twoTypes = SCB_311.replace('</gml:featureMembers>', '<stat:Kommun gml:id="Kommun.1"><stat:kommunkod>0125</stat:kommunkod><stat:geom><gml:Point srsName="urn:x-ogc:def:crs:EPSG:3006"><gml:pos>6575215.4 657235.1</gml:pos></gml:Point></stat:geom></stat:Kommun></gml:featureMembers>');
    try {
      const file = new File([twoTypes], 'tatorter.gml', { type: 'application/gml+xml' });
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'gml');
      assert.deepEqual(p.layers, ['Tatorter_2023', 'Kommun']);
      assert.equal(p.crs, 'EPSG:3006');
      assert.ok(p.columns.includes('officielltnamn') && p.columns.includes('geometry'), p.columns.join(','));
      const meta = await importer.run(file, { format: 'gml' }, null, 'Tätorter');
      created.push(meta.id);
      const cols = await datasets.columns(meta.id);
      assert.ok(leaflet.mapDefault(cols), 'opens as a map');
      const got = await datasets.get(meta.id);
      assert.equal(D.require('data/geo').crsOfMeta(got), 'EPSG:3006', 'the system is kept with the dataset');
      const rows = await datasets.query(meta.id);
      const gi = cols.findIndex((c) => c.name === 'geometry');
      assert.deepEqual(JSON.parse(rows[0][gi]).coordinates[0][0][0], [657235.14570001, 6575215.37399736], 'easting, northing');
      const second = await importer.run(new File([twoTypes], 'tatorter.gml'), { format: 'gml', layer: 'Kommun' }, null, 'Kommun');
      created.push(second.id);
      assert.equal((await datasets.query(second.id)).length, 1, 'the other feature type');
      // Saved as .xml: recognised by its contents.
      const asXml = await importer.preview(new File([SCB_2], 'tatorter.xml'), {});
      assert.equal(asXml.importer, 'gml', 'GML in an .xml file');
      // In Inhämta: the dropped file shows its rows and its feature type.
      const root = document.createElement('div');
      root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
      document.body.appendChild(root);
      try {
        history.replaceState(null, '', location.pathname + location.search);
        const shell = await D.require('app').start(root);
        shell.activate('inhamta');
        const zone = await waitFor(() => root.querySelector('.dm-center dm-dropzone'), 5000, 'the drop zone');
        assert.ok(String(zone.getAttribute('accept')).split(',').includes('.gml'), 'the picker offers .gml');
        zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [new File([twoTypes], 'tatorter.gml')] } }));
        await waitFor(() => root.querySelector('.dm-center') && root.querySelector('.dm-center').textContent.includes('Älvnäs'), 10000, 'the preview of the rows');
        assert.ok(Array.from(root.querySelectorAll('.dm-center dm-select')).some((s) => (s.getAttribute('label') || '') === t('import.gml.layer')), 'a choice of feature type');
      } finally { root.remove(); }
    } finally { for (const id of created) await datasets.remove(id).catch(() => {}); }
    return 'ok';
  }, 60000);

  test('gml: cleanup', async (assert) => {
    for (const n of names) D.net.unvirtual(n);
    assert.ok(true);
  });
})();
