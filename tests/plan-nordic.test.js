// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for plans from the other Nordic countries (data/plan-nordic): the projections they come in, Plandata.dk
 * lokalplaner and kommuneplanrammer, Finland's kaavatietomalli, Iceland's stafrænt skipulag, a Norwegian
 * reguleringsplan GeoPackage, fetching one plan from a service (virtual Plandata and Skipulagsstofnun services) and
 * the plan tools without Boverket's catalogue. Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const nordic = D.require('data/plan-nordic');
  const plan = D.require('data/plan');
  const geo = D.require('data/geo');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const detaljplanImp = D.require('io/importers/detaljplan');
  const sqlite = D.require('engines/sqlite');
  const connectors = D.require('api/connectors');
  const t = D.require('ui/i18n').t;
  const BASE = 'dataspatium-asset://tests/geo';
  const served = []; const names = [];
  function serve(name, fn) {
    names.push(name);
    D.net.virtual(name, (url) => { served.push(url); return Promise.resolve().then(() => fn(new URL(url))).then((out) => ({ kind: 'text', data: typeof out === 'string' ? out : JSON.stringify(out) })); });
  }
  const sq = (x, y, w, hgt) => ({ type: 'Polygon', coordinates: [[[x, y], [x + w, y], [x + w, y + hgt], [x, y + hgt], [x, y]]] });
  const feat = (id, geometry, properties) => ({ type: 'Feature', id, geometry, properties });
  const first = (g) => geo.parseGeometry(g).coordinates[0][0];

  // Plandata.dk: a lokalplan with two delområder and one byggefelt in EPSG:25832 (north-west Zealand).
  const DK = () => ({ type: 'FeatureCollection', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::25832' } }, features: [
    feat('lp.1', sq(690000, 6180000, 400, 300), { planid: 11922461, komnr: 306, kommunenavn: 'Odsherred', objektkode: 20, plantype: 20.1, plannr: '2024-05', plannavn: 'Ferieboliger ved Røgeriet', anvgen: 51, anvendelsegenerel: 'Rekreativt område', zone: 1, zonestatus: 'Byzone', status: 'V', datoforsl: 20251028, datovedt: 20260630, datoikraft: 20260716, bebygpct: 40, doklink: 'https://dokument.plandata.dk/x.pdf' }),
    feat('d.1', sq(690000, 6180000, 200, 300), { planid: 1, lokplan_id: 11922461, komnr: 306, objektkode: 30, plantype: 30.1, delnr: 'I', anvgen: 11, anvendelsegenerel: 'Boligområde', zone: 1, status: 'V', bebygpct: 30, maxetager: 2, maxbygnhjd: 8.5, anvspec1: 1110, anvspec2: 1120 }),
    feat('d.2', sq(690200, 6180000, 200, 300), { planid: 2, lokplan_id: 11922461, komnr: 306, objektkode: 30, plantype: 30.1, delnr: 'II', anvgen: 51, anvendelsegenerel: 'Rekreativt område', zone: 1, status: 'V' }),
    feat('b.1', sq(690020, 6180020, 100, 100), { planid: 3, lokplan_id: 11922461, komnr: 306, objektkode: 30, plantype: 30.4, delnr: 'I', byggefelttype: 1, status: 'V', maxbygnhjd: 8.5 }),
  ] });
  const DK_KP = () => ({ type: 'FeatureCollection', features: [
    feat('r.1', sq(12.1, 55.6, 0.01, 0.01), { planid: 2908149, komnr: 813, kommunenavn: 'Frederikshavn', objektkode: 10, plantype: 10.1, komplan_id: 2673954, plannr: 'FRE.B.01.01', plannavn: 'Jerup Kommuneplan 2015', anvgen: 11, fzone: 1, planstatus: 'V', datoikraft: 20150325, distrikt: '9' }),
    feat('r.2', sq(12.11, 55.6, 0.01, 0.01), { planid: 2908150, komnr: 813, kommunenavn: 'Frederikshavn', objektkode: 10, plantype: 10.1, komplan_id: 2673954, plannr: 'FRE.E.01.01', plannavn: 'Jerup Kommuneplan 2015', anvgen: 31, fzone: 1, planstatus: 'V', datoikraft: 20150325 }),
  ] });
  // Finland: a small asemakaava in the national plan data model (ETRS-TM35FIN), two plan objects and three regulation groups.
  const FI = () => ({
    planKey: '46877e24-6cd0-4534-a863-755417bc9002', permanentPlanIdentifier: 'AK-001847', planType: 'http://uri.suomi.fi/codelist/rytj/RY_Kaavalaji/code/31', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13',
    name: { fin: 'Asemakaava 1107', swe: 'Detaljplan 1107' }, scale: 2000, approvalDate: '2025-03-17', periodOfValidity: { begin: '2025-11-13' }, administrativeAreaIdentifiers: ['749'],
    geographicalArea: { srid: '3067', geometry: sq(376800, 6670000, 300, 200) },
    planObjects: [
      { planObjectKey: 'o1', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13', undergroundStatus: 'http://uri.suomi.fi/codelist/rytj/RY_MaanalaisuudenLaji/code/02', geometry: { srid: '3067', geometry: sq(376800, 6670000, 150, 200) }, name: { fin: 'Korttelialue 1' }, objectNumber: 1 },
      { planObjectKey: 'o2', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13', undergroundStatus: 'http://uri.suomi.fi/codelist/rytj/RY_MaanalaisuudenLaji/code/02', geometry: { srid: '3067', geometry: sq(376950, 6670000, 150, 200) }, name: { fin: 'Puisto' }, objectNumber: 2 },
    ],
    planRegulationGroups: [
      { planRegulationGroupKey: 'g1', titleOfPlanRegulation: { fin: 'Asuinkerrostalojen korttelialue' }, letterIdentifier: 'AK', colorNumber: '#8c4b2a', planRegulations: [
        { planRegulationKey: 'r1', type: 'http://uri.suomi.fi/codelist/rytj/RY_Kaavamaarayslaji/code/asuinkerrostaloalue', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13' },
        { planRegulationKey: 'r2', type: 'http://uri.suomi.fi/codelist/rytj/RY_Kaavamaarayslaji/code/sallittuKerrosala', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13', value: { dataType: 'numeric', number: 3200, unitOfMeasure: 'k-m2' } },
        { planRegulationKey: 'r3', type: 'http://uri.suomi.fi/codelist/rytj/RY_Kaavamaarayslaji/code/maanpaallinenKerroslukuArvovali', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13', value: { dataType: 'positiveNumericRange', minimumValue: 2, maximumValue: 4 } },
      ] },
      { planRegulationGroupKey: 'g2', titleOfPlanRegulation: { fin: 'Puisto' }, letterIdentifier: 'VP', planRegulations: [
        { planRegulationKey: 'r4', type: 'http://uri.suomi.fi/codelist/rytj/RY_Kaavamaarayslaji/code/puisto', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13' },
      ] },
    ],
    planRegulationGroupRelations: [{ planObjectKey: 'o1', planRegulationGroupKey: 'g1' }, { planObjectKey: 'o2', planRegulationGroupKey: 'g2' }],
    generalRegulationGroups: [{ generalRegulationGroupKey: 'y1', titleOfPlanRegulation: { fin: 'Yleismääräykset' }, planRegulations: [{ planRegulationKey: 'r5', type: 'http://uri.suomi.fi/codelist/rytj/RY_Kaavamaarayslaji/code/sanallinenMaarays', lifeCycleStatus: 'http://uri.suomi.fi/codelist/rytj/kaavaelinkaari/code/13', value: { dataType: 'text', text: 'Autopaikkoja 1 ap / 100 k-m2.' } }] }],
  });
  // Iceland: a stafrænt deiliskipulag as its five layers (WGS 84, as the service answers with outSR=4326).
  const IS_LAYERS = {
    0: [feat(1, sq(-21.95, 64.12, 0.004, 0.002), { OBJECTID: 1, audkenni: '7759', skipnr: '19585', malsMed: 'DSK', malsnr: '202408055', skipStig: 'Deiliskipulag', heiti: 'Deiliskipulag íbúðabyggðar við Ásbrún', heitiStj: 'Borgarbyggð', nrStj: '3609', skipulagsskjol: 'https://example.test/7759.pdf', gildirFra: 1168387200000, gildirTil: null })],
    1: [feat(2, sq(-21.95, 64.12, 0.004, 0.0005), { OBJECTID: 2, audkenni: '7759', skipnr: '19585', samgongurTeg: 'Vegur', lysing: 'Aðkomuvegur', skilmalar: ' ' })],
    2: [feat(3, sq(-21.95, 64.1205, 0.002, 0.0015), { OBJECTID: 3, audkenni: '7759', skipnr: '19585', staerd: 1200, nytHlutf: 0.35, landnr: '123456', heiti: 'Ásbrún 2', skilmalar: ' ' })],
    3: [feat(4, sq(-21.949, 64.1205, 0.0005, 0.0015), { OBJECTID: 4, audkenni: '7759', skipnr: '19585', kvadirTeg: 'Helgunarsvæði veitna', skilmalar: 'Ekki eru heimilar framkvæmdir.', lysing: 'Lagnir' })],
    4: [feat(5, sq(-21.9495, 64.121, 0.001, 0.0008), { OBJECTID: 5, audkenni: '7759', skipnr: '19585', byggTeg: 'Íbúðarhús', haedirOfan: 2, byggmagn: 420, ibudirFj: 2, stadfang: 'Ásbrún 2', lysing: 'Parhús' })],
  };
  const IS_ADAL = [
    feat(1, sq(-20.3, 63.95, 0.02, 0.01), { OBJECTID: 1, audkenni: '15310', skipnr: '15310', skipStig: 'Aðalskipulag', heiti: 'Aðalskipulag Rangárþings ytra 2016-2028', heitiStj: 'Rangárþing ytra', nrStj: '8614', gildirFra: 1566777600000, gildirTil: null }),
    feat(2, sq(-20.3, 63.95, 0.01, 0.01), { OBJECTID: 2, audkenni: '15310', skipnr: '15310', flokkur: 'AT', numer: 1, heiti: 'Kornþurrkunarstöð', akvaedi: 'Hús fyrir kornþurrkun.', gildirFra: 1566777600000 }),
    feat(3, sq(-20.29, 63.95, 0.01, 0.01), { OBJECTID: 3, audkenni: '15310', skipnr: '15310', flokkur: 'ÍB', numer: 2, heiti: 'Hella', akvaedi: 'Íbúðarbyggð.', ibudirFj: 40, gildirFra: 1566777600000 }),
  ];
  const planRows = (r) => r.rows;

  test('plan-nordic: UTM, TM35FIN, GK and ISN93 coordinates become WGS 84', (assert) => {
    assert.deepEqual(geo.tmToWgs84(500000, 0, geo.TM_ZONES[25832]).map((v) => Math.round(v * 1e6) / 1e6), [9, 0], 'UTM 32 false origin');
    const isn = geo.lccToWgs84(500000, 500000, geo.ISN93);
    assert.ok(Math.abs(isn[0] + 19) < 1e-6 && Math.abs(isn[1] - 65) < 1e-6, 'ISN93 origin: ' + isn);
    const rvk = geo.toWgs84({ type: 'Point', coordinates: [357000, 408000] }, 'EPSG:3057').coordinates;
    assert.ok(rvk[0] > -22.4 && rvk[0] < -21.5 && rvk[1] > 64.0 && rvk[1] < 64.3, 'Reykjavík: ' + rvk);
    const hel = geo.toWgs84({ type: 'Point', coordinates: [376895, 6670011] }, 'urn:ogc:def:crs:EPSG::3067').coordinates;
    assert.ok(hel[0] > 24.6 && hel[0] < 25.1 && hel[1] > 60.1 && hel[1] < 60.3, 'Helsinki TM35FIN: ' + hel);
    const gk = geo.toWgs84({ type: 'Point', coordinates: [25500000, 6673000] }, 'EPSG:3879').coordinates;
    assert.ok(Math.abs(gk[0] - 25) < 1e-6 && gk[1] > 60.1 && gk[1] < 60.3, 'GK25 central meridian: ' + gk);
    const cph = geo.toWgs84({ type: 'Point', coordinates: [724000, 6176000] }, 'EPSG:25832').coordinates;
    assert.ok(cph[0] > 12.3 && cph[0] < 12.8 && cph[1] > 55.5 && cph[1] < 55.8, 'Copenhagen UTM 32: ' + cph);
    assert.ok(geo.knownCrs('EPSG:25833') && geo.knownCrs(3057) && !geo.knownCrs('EPSG:2154'));
    assert.equal(geo.epsgOf('urn:ogc:def:crs:EPSG::25832'), 25832);
    return 'ok';
  });

  test('plan-nordic: Plandata.dk lokalplaner and kommuneplanrammer become plan rows with Danish colours', async (assert) => {
    assert.equal(plan.detect(DK()), 'plandata'); assert.equal(plan.detect(DK_KP()), 'plandata-kommuneplan');
    assert.equal(nordic.detectTable(['planid', 'komnr', 'anvgen', 'geometri']), 'plandata');
    const r = await nordic.read('plandata', DK(), {});
    assert.equal(r.plan.land, 'DK'); assert.equal(r.plan.beteckning, '2024-05'); assert.equal(r.plan.kommun, 'Odsherred'); assert.equal(r.plan.status, 'Vedtaget'); assert.equal(r.plan.datumLagakraft, '2026-07-16');
    assert.deepEqual(r.rows.map((x) => x.objekttyp), ['planomrade', 'anvandning', 'anvandning', 'egenskap']);
    const bolig = r.rows[1];
    assert.equal(bolig.beteckning, 'I'); assert.equal(bolig.farg, 'Gul'); assert.equal(bolig.kod, '11'); assert.ok(/Boligområde/.test(bolig.formulering) && /2 etager/.test(bolig.formulering), bolig.formulering);
    assert.equal(bolig.kategori, '1110, 1120'); assert.equal(bolig.varde, '30'); assert.equal(bolig.enhet, '%');
    assert.equal(r.rows[2].farg, 'Grön'); assert.equal(r.rows[3].formulering, 'Byggefelt med begrænsende byggeret');
    const c = first(r.rows[0].geometri);
    assert.ok(c[0] > 11.5 && c[0] < 12.5 && c[1] > 55.5 && c[1] < 56, 'EPSG:25832 → WGS 84: ' + c);
    assert.equal(plan.fillOf(bolig), '#f4e07a', 'fillOf uses the colour name');
    const legend = plan.legend(r.rows);
    assert.deepEqual(legend.map((e) => e.beteckning), ['I', 'II']);
    const areas = plan.areasByUse(r.rows, 'detaljplan');
    assert.equal(areas.length, 2); assert.ok(Math.abs(areas[0].area - 60000) < 1500, 'about 6 ha: ' + areas[0].area);
    // A lokalplan without delområder: the plan polygon is also the use area.
    const alone = await nordic.read('plandata', { type: 'FeatureCollection', features: [DK().features[0]] }, {});
    assert.deepEqual(alone.rows.map((x) => x.objekttyp), ['planomrade', 'anvandning']); assert.equal(alone.rows[1].farg, 'Grön');
    const kp = await nordic.read('plandata-kommuneplan', DK_KP(), {});
    assert.equal(kp.plan.slag, 'oversiktsplan'); assert.equal(kp.plan.land, 'DK'); assert.equal(kp.plan.format, 'plandata-kommuneplan');
    assert.deepEqual(kp.rows.map((x) => [x.tema, x.innehallstyp, x.farg]), [['markochvattenanvandning', 'Boligområde', 'Gul'], ['markochvattenanvandning', 'Erhvervsområde', 'Lila']]);
    assert.equal(plan.opFillOf(kp.rows[1]), D.require('data/plan-catalog').COLORS.lila);
    assert.deepEqual(plan.OP_COLUMNS.map((x) => x.name).slice(-3), ['farg', 'ordning', 'geometri']);
    return `${r.rows.length} + ${kp.rows.length} rader`;
  });

  test('plan-nordic: a kaavatietomalli plan gets uses with the map letters and Finnish colours; the file imports as a plan', async (assert) => {
    assert.equal(plan.detect(FI()), 'kaavatietomalli');
    const codes = await nordic.loadKaavamaarayslaji();
    assert.ok(codes.size >= 260 && codes.get('asuinkerrostaloalue').kort === 'AK' && /Omr/.test(codes.get('asuinkerrostaloalue').sv), 'code list: ' + codes.size);
    const r = nordic.fromKaavatietomalli(FI(), { lang: 'sv', codes });
    assert.equal(r.plan.land, 'FI'); assert.equal(r.plan.beteckning, 'AK-001847'); assert.equal(r.plan.namn, 'Detaljplan 1107'); assert.equal(r.plan.typ, 'Asemakaava'); assert.equal(r.plan.skala, '1:2000');
    const types = r.rows.map((x) => x.objekttyp);
    assert.deepEqual(types, ['planomrade', 'anvandning', 'egenskap', 'egenskap', 'anvandning', 'administrativ'], types.join(','));
    const ak = r.rows[1];
    assert.equal(ak.beteckning, 'AK'); assert.equal(ak.kod, 'asuinkerrostaloalue'); assert.equal(ak.farg, 'Brun'); assert.ok(/flervåningshus|Kvartersområde/i.test(ak.formulering), ak.formulering);
    assert.equal(r.rows[2].varde, '3200'); assert.equal(r.rows[2].enhet, 'k-m2'); assert.equal(r.rows[3].varde, '2–4');
    assert.equal(r.rows[4].beteckning, 'VP'); assert.equal(r.rows[4].farg, 'Grön');
    assert.equal(r.rows[5].formulering, 'Autopaikkoja 1 ap / 100 k-m2.'); assert.equal(r.rows[5].geometri, null);
    const c = first(ak.geometri);
    assert.ok(c[0] > 24.5 && c[0] < 25.2 && c[1] > 60.1 && c[1] < 60.3, 'TM35FIN → WGS 84: ' + c);
    const file = new File([JSON.stringify(FI())], 'ak-1107.json', { type: 'application/json' });
    let meta = null;
    try {
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'detaljplan', 'sniffed'); assert.equal(p.planFormat, 'kaavatietomalli'); assert.equal(p.plan.land, 'FI');
      meta = await importer.run(file, {}, null, null);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 6); assert.ok(meta.plan && meta.plan.land === 'FI' && meta.plan.format === 'kaavatietomalli', JSON.stringify(meta.plan));
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id).catch(() => {}); }
  });

  test('plan-nordic: stafrænt deiliskipulag and aðalskipulag become plans; one plan is fetched whole from a virtual Skipulagsstofnun service', async (assert) => {
    const all = Object.values(IS_LAYERS).flat();
    assert.equal(plan.detect({ type: 'FeatureCollection', features: all }), 'skipulag');
    assert.equal(plan.detect({ type: 'FeatureCollection', features: IS_ADAL }), 'skipulag-adal');
    const r = nordic.fromSkipulag(all, {});
    assert.equal(r.plan.land, 'IS'); assert.equal(r.plan.beteckning, '19585'); assert.equal(r.plan.kommun, 'Borgarbyggð'); assert.equal(r.plan.status, 'Í gildi'); assert.equal(r.plan.datumLagakraft, '2007-01-10'); assert.equal(r.plan.malsmedferd, 'DSK');
    assert.deepEqual(r.rows.map((x) => x.objekttyp), ['planomrade', 'anvandning', 'anvandning', 'egenskap', 'administrativ']);
    const hus = r.rows.find((x) => x.kod === 'Íbúðarhús');
    assert.ok(hus && hus.farg === 'Gul' && hus.varde === '420' && hus.enhet === 'm²' && /2 hæðir/.test(hus.formulering), JSON.stringify(hus));
    const veg = r.rows.find((x) => x.kategori === 'Samgöngur'); const lod = r.rows.find((x) => x.kategori === 'Lóð');
    assert.equal(veg.farg, 'Ljusgrå'); assert.equal(veg.kod, 'Vegur'); assert.ok(/1200 m²/.test(lod.formulering) && lod.varde === '0.35', lod.formulering);
    const op = nordic.fromSkipulag(IS_ADAL, {});
    assert.equal(op.plan.slag, 'oversiktsplan'); assert.equal(op.plan.format, 'skipulag-adal'); assert.equal(op.plan.kommun, 'Rangárþing ytra');
    assert.deepEqual(op.rows.map((x) => [x.tema, x.innehallstyp, x.farg]), [['omrade', 'Skipulagsmörk', ''], ['markochvattenanvandning', 'Athafnasvæði', 'Blågrå'], ['markochvattenanvandning', 'Íbúðarbyggð', 'Gul']]);
    assert.equal(op.rows[2].namn, 'ÍB2 Hella');
    // The requests for one plan: five layers of Stafraent_deiliskipulag by skipnr, or the aðalskipulag layers with "ask:".
    const req = nordic.fetchPlanRequests('skipulag', BASE + '/arcgis/rest/services', '19585');
    assert.equal(req.stage1.length, 5); assert.ok(req.stage1[0].url.includes('/Stafraent_deiliskipulag/FeatureServer/0/query?') && req.stage1[0].url.includes(encodeURIComponent("skipnr='19585'")) && req.stage1[0].url.includes('outSR=4326'), req.stage1[0].url);
    assert.ok(nordic.fetchPlanRequests('skipulag', BASE + '/arcgis/rest/services', 'ask:15310').stage1[1].url.includes('/Stafraent_adalskipulag/MapServer/11/query?'));
    const ids = [];
    try {
      // Virtual providers match the exact path: one per layer of the deiliskipulag service.
      for (const i of [0, 1, 2, 3, 4]) serve(`tests/geo/arcgis/rest/services/Stafraent_deiliskipulag/FeatureServer/${i}/query`, (u) => ({ type: 'FeatureCollection', features: /19585/.test(u.searchParams.get('where') || '') ? IS_LAYERS[i] : [] }));
      const connector = Object.assign({}, await connectors.get('skipulagsstofnun'), { id: 'test-skipulag', baseUrl: BASE + '/arcgis/rest/services' });
      assert.equal(connector.family.plans, 'skipulag', 'the preset offers plan fetching');
      const view = D.require('ui/api/geodata-view').create({ connector, runFetch() {}, log() {}, onDataset(m) { ids.push(m.id); } });
      view.start();
      assert.ok(view.el.querySelector('.dm-geo-plan'), 'the fetch-plan card is shown');
      served.length = 0;
      await view.fetchPlan('19585');
      assert.equal(served.length, 5, 'five layer requests: ' + served.length + ' ' + view.state.planMsg);
      assert.equal(ids.length, 1, 'one plan saved: ' + view.state.planMsg);
      const meta = await datasets.get(ids[0]);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 5); assert.equal(meta.plan.land, 'IS'); assert.equal(meta.name, 'Deiliskipulag íbúðabyggðar við Ásbrún');
      await view.fetchPlan('999');
      assert.ok(view.state.planErr && view.state.planMsg === t('plan.fetch.none'), 'no objects → explained: ' + view.state.planMsg);
      return 'ok';
    } finally {
      for (const i of [0, 1, 2, 3, 4]) D.net.unvirtual(`tests/geo/arcgis/rest/services/Stafraent_deiliskipulag/FeatureServer/${i}/query`);
      for (const id of ids) await datasets.remove(id).catch(() => {});
    }
  }, 30000);

  test('plan-nordic: a lokalplan is fetched from a virtual Plandata WFS in two stages and saved as a plan; the Plan tab hides the catalogue tools', async (assert) => {
    const ids = [];
    try {
      serve('tests/geo/plandata-wfs', (u) => {
        const type = u.searchParams.get('typeNames') || ''; const cql = u.searchParams.get('CQL_FILTER') || '';
        const feats = DK().features.map((f) => Object.assign({}, f, { geometry: geo.toWgs84(f.geometry, 'EPSG:25832') }));
        if (/lokalplan_vedtaget/.test(type)) return { type: 'FeatureCollection', features: /planid=11922461|plannr='2024-05'/.test(cql) ? [feats[0]] : [] };
        if (/lokalplandelomraade/.test(type)) return { type: 'FeatureCollection', features: /lokplan_id=11922461/.test(cql) ? [feats[1], feats[2]] : [] };
        if (/byggefelt/.test(type)) return { type: 'FeatureCollection', features: /lokplan_id=11922461/.test(cql) ? [feats[3]] : [] };
        return { type: 'FeatureCollection', features: [] };
      });
      const preset = await connectors.get('plandata-dk');
      assert.ok(preset && preset.family.plans === 'plandata' && preset.level === 1, 'Plandata preset');
      const connector = Object.assign({}, preset, { id: 'test-plandata', baseUrl: BASE + '/plandata-wfs' });
      served.length = 0;
      const parsed = await nordic.fetchPlan('plandata', connector.baseUrl, '2024-05', (url) => D.require('api/families/databases').getJson(connector, url));
      assert.equal(served.length, 3, 'lokalplan, then delområder and byggefelter: ' + served.length);
      assert.ok(served[0].includes(encodeURIComponent("plannr='2024-05'")) && served[1].includes(encodeURIComponent('lokplan_id=11922461')), served.join(' | '));
      assert.equal(parsed.format, 'plandata'); assert.equal(parsed.rows.length, 4);
      const meta = await detaljplanImp.importParsed(parsed, null, { kind: 'api', connector: connector.id });
      ids.push(meta.id);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.name, 'Ferieboliger ved Røgeriet'); assert.equal(meta.plan.land, 'DK');
      // API answers from one Plandata layer can be kept as a plan too (Spara som plan).
      const table = { columns: ['planid', 'komnr', 'kommunenavn', 'objektkode', 'plantype', 'plannr', 'plannavn', 'anvgen', 'zone', 'status', 'geometri'], rows: [[11922461, 306, 'Odsherred', 20, 20.1, '2024-05', 'Ferieboliger', 51, 1, 'V', JSON.stringify(geo.toWgs84(sq(690000, 6180000, 400, 300), 'EPSG:25832'))]] };
      assert.ok(plan.detectTable(table.columns)); assert.equal(plan.tableFormat(table.columns), 'plandata');
      const m2 = await detaljplanImp.importTable(table.columns, table.rows, 'Lokalplan via API', {});
      ids.push(m2.id);
      assert.equal(m2.rowCount, 2); assert.equal(m2.plan.format, 'plandata');
      // The Plan tab for a Danish plan: summary, provisions and areas, no catalogue check or search.
      const panel = D.require('ui/analysis/plan-panel');
      const ds = (await datasets.list()).find((d) => d.id === meta.id);
      const base = D.require('ui/base');
      const ctx = { ui: Object.assign({ h: base.h, t: base.t, i18n: base.i18n, replace: base.replace, icon: D.require('ui/icons').icon, button: D.require('ui/basic').button }, D.require('ui/overlays')), shell: { log() {} }, store: { get: () => ({ datasets: [ds], selectedId: meta.id }), subscribe() { return () => {}; } } };
      const p = panel.create(ctx, {});
      const c = p.center();
      const tabs = /** @type {any} */ (c.body[0]);
      assert.deepEqual(tabs.tabs.map((x) => x.id), ['summary', 'provisions', 'areas'], 'tools without the catalogue');
      return 'ok';
    } finally {
      D.net.unvirtual('tests/geo/plandata-wfs');
      for (const id of ids) await datasets.remove(id).catch(() => {});
    }
  }, 30000);

  test('plan-nordic: a Norwegian reguleringsplan GeoPackage imports whole with arealformål names and colours', async (assert) => {
    const wkbPolygon = (rings) => {
      const n = 9 + rings.reduce((s, r) => s + 4 + r.length * 16, 0);
      const buf = new ArrayBuffer(n); const dv = new DataView(buf); let pos = 0;
      dv.setUint8(pos++, 1); dv.setUint32(pos, 3, true); pos += 4; dv.setUint32(pos, rings.length, true); pos += 4;
      for (const r of rings) { dv.setUint32(pos, r.length, true); pos += 4; for (const c of r) { dv.setFloat64(pos, c[0], true); dv.setFloat64(pos + 8, c[1], true); pos += 16; } }
      return new Uint8Array(buf);
    };
    const gpb = (geometry, srs) => { const wkb = wkbPolygon(geometry.coordinates); const out = new Uint8Array(8 + wkb.length); out[0] = 0x47; out[1] = 0x50; out[2] = 0; out[3] = 0x01; new DataView(out.buffer).setInt32(4, srs, true); out.set(wkb, 8); return out; };
    const engine = new sqlite.SqliteEngine();
    await engine.start(); await engine.open();
    await engine.exec("create table gpkg_spatial_ref_sys (srs_name text, srs_id integer primary key, organization text, organization_coordsys_id integer, definition text); insert into gpkg_spatial_ref_sys values ('ETRS89 / UTM zone 33N', 25833, 'EPSG', 25833, ''); create table gpkg_contents (table_name text primary key, data_type text, identifier text, srs_id integer); create table gpkg_geometry_columns (table_name text, column_name text, geometry_type_name text, srs_id integer, z integer, m integer);");
    for (const [name, cols] of [['RpOmråde', 'lokalId text, planidentifikasjon text, plannavn text, plantype text, planstatus text, ikrafttredelsesdato text, kommunenummer text'], ['RpArealformålOmråde', 'lokalId text, planidentifikasjon text, arealformål integer, feltbetegnelse text, eierform text, beskrivelse text, utnyttingstall real, utnyttingstype text'], ['RpSikringSone', 'lokalId text, planidentifikasjon text, hensynskategori text, beskrivelse text']]) {
      await engine.exec(`create table "${name}" (fid integer primary key, område blob, ${cols}); insert into gpkg_contents values ('${name}', 'features', '${name}', 25833); insert into gpkg_geometry_columns values ('${name}', 'område', 'MULTIPOLYGON', 25833, 0, 0);`);
    }
    await engine.run('insert into "RpOmråde" (fid, område, lokalId, planidentifikasjon, plannavn, plantype, planstatus, ikrafttredelsesdato, kommunenummer) values (?, ?, ?, ?, ?, ?, ?, ?, ?)', [1, gpb(sq(262000, 6650000, 300, 200), 25833), 'p1', '0301-2024-01', 'Detaljregulering Testbyen', '35', '3', '2024-06-20', '0301']);
    const uses = [[2, sq(262000, 6650000, 100, 200), 'a1', 1110, 'BBB1', 'Annen eierform', 'Boligbebyggelse', 60, 'BYA'], [3, sq(262100, 6650000, 100, 200), 'a2', 2010, 'o_SV1', 'Offentlig', 'Veg', null, null], [4, sq(262200, 6650000, 100, 200), 'a3', 3050, 'o_GP1', 'Offentlig', 'Park', null, null]];
    for (const u of uses) await engine.run('insert into "RpArealformålOmråde" (fid, område, lokalId, planidentifikasjon, arealformål, feltbetegnelse, eierform, beskrivelse, utnyttingstall, utnyttingstype) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [u[0], gpb(u[1], 25833), u[2], '0301-2024-01', u[3], u[4], u[5], u[6], u[7], u[8]]);
    await engine.run('insert into "RpSikringSone" (fid, område, lokalId, planidentifikasjon, hensynskategori, beskrivelse) values (?, ?, ?, ?, ?, ?)', [5, gpb(sq(262020, 6650020, 50, 50), 25833), 's1', '0301-2024-01', 'H190', 'Sikringsone - andre sikringssoner']);
    const bytes = await engine.export();
    engine.terminate();
    const file = new File([bytes], 'regplan-testbyen.gpkg', { type: 'application/geopackage+sqlite3' });
    let meta = null;
    try {
      assert.equal(nordic.gpkgKind(['RpOmråde', 'RpArealformålOmråde']), 'reguleringsplan'); assert.equal(nordic.gpkgKind(['Skipulag', 'Lodir', 'Byggingarreitir']), 'skipulag'); assert.equal(nordic.gpkgKind(['kommuner']), null);
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'sqlite'); assert.equal(p.planGpkg, 'reguleringsplan'); assert.ok(!p.oversiktsplan);
      meta = await importer.run(file, { plan: true }, null, null);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 5); assert.equal(meta.name, 'Detaljregulering Testbyen');
      assert.ok(meta.plan.land === 'NO' && meta.plan.format === 'reguleringsplan-gpkg' && meta.plan.beteckning === '0301-2024-01' && meta.plan.datumLagakraft === '2024-06-20', JSON.stringify(meta.plan));
      const cols = await datasets.columns(meta.id);
      const rows = await D.require('viz/data').fetchRows(meta.id, { fields: cols.map((c) => c.name), limit: 10 });
      const by = Object.fromEntries(rows.rows.map((r) => [r.objektid, r]));
      assert.equal(by.a1.objekttyp, 'anvandning'); assert.equal(by.a1.beteckning, 'BBB1'); assert.equal(by.a1.formulering, 'Boligbebyggelse'); assert.equal(by.a1.kod, '1110'); assert.equal(by.a1.farg, 'Gul'); assert.equal(by.a1.varde, '60'); assert.equal(by.a1.vardetyp, 'BYA');
      assert.equal(by.a2.farg, 'Ljusgrå'); assert.equal(by.a3.farg, 'Grön'); assert.equal(by.a3.formulering, 'Park'); assert.equal(by.a1.kategori, 'Bebyggelse og anlegg');
      assert.equal(by.s1.objekttyp, 'administrativ'); assert.equal(by.s1.kod, 'H190');
      const c = first(by.p1.geometri);
      assert.ok(c[0] > 10.5 && c[0] < 11 && c[1] > 59.8 && c[1] < 60.1, 'UTM 33 → Oslo: ' + c);
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id).catch(() => {}); }
  }, 60000);

  test('plan-nordic: cleanup', async (assert) => {
    for (const n of names) D.net.unvirtual(n);
    assert.ok(true);
  });
})();
