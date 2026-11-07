// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Tests for plan files of the kinds planning tools make (Rita Detaljplan and Rita Översiktsplan for QGIS are the example): the delivery file per Lantmäteriet's
 * Detaljplan 4.1 and Översiktsplan 2.0 (the two files below are valid against Lantmäteriet's JSON schemas; they were checked
 * with the schemas outside the app), Rita Detaljplan's GeoPackage and Boverket's ÖP model 0.4 as Rita Översiktsplan writes it,
 * through the readers in data/plan, io/import and the plan view. Own test data only; nothing touches the net.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const { test } = D.require('tests/harness');
  const plan = D.require('data/plan');
  const geo = D.require('data/geo');
  const datasets = D.require('data/datasets');
  const importer = D.require('io/import');
  const sqlite = D.require('engines/sqlite');
  const B_UUID = 'f9e056a6-cda8-4b92-a15d-dc70d61dfa36';
  const GATA_UUID = '7f46c19a-343d-433e-9ff8-59679eed36d8';

  /** A delivery file per Detaljplan 4.1, as Rita Detaljplan's export writes it (valid against detaljplan-4.1.json). */
  const DP41 = {"type": "FeatureCollection", "feature:mediatyp": "application/vnd.lm.detaljplan.v4+json", "features": [{"type": "Feature", "id": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "geometry": null, "properties": {"feature:typ": "detaljplan", "objektidentitet": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "kommun": "1380", "beteckning": "DP 2026:4", "namn": "Detaljplan för Strandkvarteret", "syfte": "Bostäder och gata vid stranden", "status": "laga kraft", "datumStatusforandring": "2026-09-20", "typ": "detaljplan", "kvalitetsbeskrivning": {"digitaliseringsniva": "komplett", "korrigeradeGranser": false, "kontrolleratPlaneringsunderlag": true}, "anvandbarhet": "god", "plangeometri": [{"geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[150000.0, 6450000.0], [150200.0, 6450000.0], [150200.0, 6450200.0], [150000.0, 6450200.0], [150000.0, 6450000.0]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}], "beslutsinformation": [{"instansInomKommunen": "kommunfullmäktige", "diarienummerKommun": "KS 2025/77", "beslutstyp": "antagande av ny detaljplan", "datumPaborjat": "2025-02-01", "datumAntagande": "2026-08-25", "datumLagakraft": ["2026-09-20"], "genomforandetid": 60, "genomforandetidStartar": "2026-09-20", "planbestammelse": ["00000000-0000-4000-8000-000000000101", "00000000-0000-4000-8000-000000000102", "00000000-0000-4000-8000-000000000103", "00000000-0000-4000-8000-000000000104", "00000000-0000-4000-8000-000000000105", "00000000-0000-4000-8000-000000000106", "00000000-0000-4000-8000-000000000107", "00000000-0000-4000-8000-000000000108", "00000000-0000-4000-8000-000000000109"]}], "planbeskrivning": {"planbeskrivning": {"namn": "Planbeskrivning Strandkvarteret", "referens": [{"lank": "https://kommun.example/planbeskrivning.pdf"}]}}}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000101", "geometry": null, "properties": {"feature:typ": "användningsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000101", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "f9e056a6-cda8-4b92-a15d-dc70d61dfa36", "bestammelseformulering": "Bostäder", "bestammelsegeometri": [{"geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[150000.0, 6450000.0], [150140.0, 6450000.0], [150140.0, 6450200.0], [150000.0, 6450200.0], [150000.0, 6450000.0]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}], "planbestammelsebeskrivning": {"motiv": "Nya bostäder nära stranden."}}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000102", "geometry": null, "properties": {"feature:typ": "användningsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000102", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "7f46c19a-343d-433e-9ff8-59679eed36d8", "bestammelseformulering": "Gata", "bestammelsegeometri": [{"geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[150140.0, 6450000.0], [150200.0, 6450000.0], [150200.0, 6450200.0], [150140.0, 6450200.0], [150140.0, 6450000.0]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}], "giltighetstid": 120}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000103", "geometry": null, "properties": {"feature:typ": "egenskapsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000103", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "2bd7f01b-ac79-45b4-a24d-093620e7e2f2", "bestammelseformulering": "Största byggnadsarea är 300 m² per fastighet", "bestammelsevarde": [{"datatyp": "decimaltal", "variabelvarde": "300", "beskrivning": "byggnadsarea", "vardetyp": "max", "enhet": "kvadratmeter"}], "sekundarEgenskapsgrans": false, "reglerarAnvandningsbestammelse": ["00000000-0000-4000-8000-000000000101"], "bestammelsegeometri": [{"geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[150010.0, 6450010.0], [150110.0, 6450010.0], [150110.0, 6450110.0], [150010.0, 6450110.0], [150010.0, 6450010.0]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}], "planbestammelsebeskrivning": {"motiv": "Begränsar byggnadernas storlek mot stranden."}}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000104", "geometry": null, "properties": {"feature:typ": "egenskapsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000104", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "fb5dba7d-330b-48ce-9a68-121ef5260bcb", "bestammelseformulering": "Marken får inte förses med byggnad", "reglerarAnvandningsbestammelse": ["00000000-0000-4000-8000-000000000101"], "bestammelsegeometri": [{"geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[150000.0, 6450180.0], [150140.0, 6450180.0], [150140.0, 6450200.0], [150000.0, 6450200.0], [150000.0, 6450180.0]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}]}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000105", "geometry": null, "properties": {"feature:typ": "egenskapsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000105", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "623a21a0-5d27-4b55-889f-b0841409894d", "bestammelseformulering": "Utfartsförbud", "reglerarAnvandningsbestammelse": ["00000000-0000-4000-8000-000000000101"], "bestammelsegeometri": [{"geometri": {"typ": "linje", "position": {"type": "LineString", "coordinates": [[150140.0, 6450020.0], [150140.0, 6450120.0]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}]}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000106", "geometry": null, "properties": {"feature:typ": "egenskapsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000106", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "291393ff-4cbe-47de-8b84-0b1aa6fe3664", "bestammelseformulering": "Markens höjd över nollplanet ska vara 3,5 meter", "bestammelsevarde": [{"datatyp": "decimaltal", "variabelvarde": "3.5", "beskrivning": "höjd", "vardetyp": "exakt", "enhet": "meter"}], "reglerarAnvandningsbestammelse": ["00000000-0000-4000-8000-000000000101"], "bestammelsegeometri": [{"geometri": {"typ": "punkt", "position": {"type": "Point", "coordinates": [150060.0, 6450060.0]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}]}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000107", "geometry": null, "properties": {"feature:typ": "egenskapsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000107", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "912a1a73-ad9d-418d-9ffd-19ecb2cc9c7f", "bestammelseformulering": "Högsta nockhöjd är 12 meter", "bestammelsevarde": [{"datatyp": "decimaltal", "variabelvarde": "12", "beskrivning": "nockhöjd", "vardetyp": "max", "enhet": "meter"}], "vertikalAvgransning": "nedåt", "reglerarAnvandningsbestammelse": ["00000000-0000-4000-8000-000000000101"], "bestammelsegeometri": [{"geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[150010.0, 6450120.0, 4.5], [150060.0, 6450120.0, 4.5], [150060.0, 6450170.0, 4.5], [150010.0, 6450170.0, 4.5], [150010.0, 6450120.0, 4.5]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 3, "hojdsystem": "EPSG:5613"}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}]}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000108", "geometry": null, "properties": {"feature:typ": "administrativ bestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000108", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "4248b7fb-d019-48a9-9552-1eaf7d688b17", "bestammelseformulering": "Strandskyddet är upphävt", "bestammelsegeometri": [{"geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[150000.0, 6450000.0], [150140.0, 6450000.0], [150140.0, 6450180.0], [150000.0, 6450180.0], [150000.0, 6450000.0]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 2}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}]}}, {"type": "Feature", "id": "00000000-0000-4000-8000-000000000109", "geometry": null, "properties": {"feature:typ": "egenskapsbestämmelse", "detaljplan": "a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f", "objektidentitet": "00000000-0000-4000-8000-000000000109", "objektversion": 1, "versionGiltigFran": "2026-10-01T10:00:00+02:00", "planbestammelsekatalogreferens": "fb5dba7d-330b-48ce-9a68-121ef5260bcb", "bestammelseformulering": "Marken får inte förses med byggnad", "reglerarAnvandningsbestammelse": ["00000000-0000-4000-8000-000000000102"], "bestammelsegeometri": [{"geometri": {"typ": "kropp", "position": {"type": "MultiPolygon", "coordinates": [[[[150150.0, 6450080.0, -6.0], [150190.0, 6450080.0, -6.0], [150190.0, 6450050.0, -6.0], [150150.0, 6450050.0, -6.0], [150150.0, 6450050.0, -6.0]]], [[[150150.0, 6450050.0, -2.5], [150190.0, 6450050.0, -2.5], [150190.0, 6450080.0, -2.5], [150150.0, 6450080.0, -2.5], [150150.0, 6450050.0, -2.5]]], [[[150150.0, 6450050.0, -6.0], [150190.0, 6450050.0, -6.0], [150190.0, 6450050.0, -2.5], [150150.0, 6450050.0, -2.5], [150150.0, 6450050.0, -6.0]]], [[[150190.0, 6450050.0, -6.0], [150190.0, 6450080.0, -6.0], [150190.0, 6450080.0, -2.5], [150190.0, 6450050.0, -2.5], [150190.0, 6450050.0, -6.0]]], [[[150190.0, 6450080.0, -6.0], [150150.0, 6450080.0, -6.0], [150150.0, 6450080.0, -2.5], [150190.0, 6450080.0, -2.5], [150190.0, 6450080.0, -6.0]]], [[[150150.0, 6450080.0, -6.0], [150150.0, 6450050.0, -6.0], [150150.0, 6450050.0, -2.5], [150150.0, 6450080.0, -2.5], [150150.0, 6450080.0, -6.0]]]]}, "koordinatsystemPlan": "EPSG:3007", "dimension": 3, "hojdsystem": "EPSG:5613"}, "geometrimetadata": {"lagesbestamningsmetodPlan": {"typ": "lägesplacering", "variant": "digital karta"}, "tidpunktForLagesbestamningPlan": "2026-10-01T10:00:00+02:00"}}]}}]};
  /** A delivery file per Översiktsplan 2.0 test 4, as Rita Översiktsplan's export writes it (valid against oversiktsplan-2.0.json). */
  const OP20 = {"type": "FeatureCollection", "feature:mediatyp": "application/vnd.lm.oversiktsplan.v2+json", "features": [{"type": "Feature", "geometry": null, "properties": {"feature:typ": "oversiktsplan", "objektidentitet": "b7e3b2f1-4d66-4d7f-8c1f-2b3c4d5e6f70", "versionGiltigFran": "2026-06-01T09:00:00+02:00", "beslut": "c8f4c3a2-5e77-4e80-9d20-3c4d5e6f7081", "kommunkod": "1494", "kommunnamn": "Lidköping", "planhandelse": {"varde": "antagen", "vardereferens": "20000000-0000-4000-8000-000000000001", "grupp": "Planhändelse", "gruppreferens": "20000000-0000-4000-8000-000000000000"}, "datumPlanhandelse": "2026-06-01", "datumPaborjat": "2024-03-01", "planensTitel": "Översiktsplan Lidköping 2040", "digitaltUrsprung": true, "underlag": [{"underlagstyp": {"varde": "Planeringsunderlag", "vardereferens": "20000000-0000-4000-8000-000000000011", "grupp": "Underlag", "gruppreferens": "20000000-0000-4000-8000-000000000010"}, "underlag": [{"namn": "Planeringsunderlag", "externReferens": {"identitet": "u1", "producentensIdentitet": "u1.pdf", "tidsstampel": "2026-05-01T00:00:00+02:00", "avser": "Planeringsunderlag"}}]}]}}, {"type": "Feature", "geometry": null, "properties": {"feature:typ": "beslutOP", "objektidentitet": "c8f4c3a2-5e77-4e80-9d20-3c4d5e6f7081", "versionGiltigFran": "2026-06-01T09:00:00+02:00", "beslutandeOrganisation": {"organisationsnamn": "Lidköpings kommun"}, "beslutandeInstans": "kommunfullmäktige", "paverkar": [{"identitet": "b7e3b2f1-4d66-4d7f-8c1f-2b3c4d5e6f70", "objekttyp": "oversiktsplan"}], "handelse": [{"handelsetyp": "fattat", "datum": "2026-04-27"}, {"handelsetyp": "laga kraft", "datum": "2026-06-01"}], "diarienummer": "KS 2024/12"}}, {"type": "Feature", "geometry": null, "properties": {"feature:typ": "innehallOP", "objektidentitet": "10000000-0000-4000-8000-000000000001", "versionGiltigFran": "2026-06-01T09:00:00+02:00", "oversiktsplan": "b7e3b2f1-4d66-4d7f-8c1f-2b3c4d5e6f70", "innehallstyp": {"varde": "Bostadsbebyggelse", "vardereferens": "30000000-0000-4000-8000-000000000001", "grupp": "Mark- och vattenanvändning", "gruppreferens": "30000000-0000-4000-8000-000000000000"}, "planhandelse": {"varde": "antagen", "vardereferens": "20000000-0000-4000-8000-000000000001", "grupp": "Planhändelse", "gruppreferens": "20000000-0000-4000-8000-000000000000"}, "datumPlanhandelse": "2026-06-01", "underErsattning": false, "illustrativaGranser": true, "namn": "Norra staden", "geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[380000.0, 6480000.0], [381000.0, 6480000.0], [381000.0, 6480800.0], [380000.0, 6480800.0], [380000.0, 6480000.0]]]}, "koordinatsystemPlan": "EPSG:3006", "dimension": 2}, "berorAnnatInnehall": ["10000000-0000-4000-8000-000000000002"]}}, {"type": "Feature", "geometry": null, "properties": {"feature:typ": "innehallOP", "objektidentitet": "10000000-0000-4000-8000-000000000002", "versionGiltigFran": "2026-06-01T09:00:00+02:00", "oversiktsplan": "b7e3b2f1-4d66-4d7f-8c1f-2b3c4d5e6f70", "innehallstyp": {"varde": "LIS-område", "vardereferens": "30000000-0000-4000-8000-000000000002", "grupp": "Landsbygdsutveckling i strandnära läge", "gruppreferens": "30000000-0000-4000-8000-000000000003"}, "planhandelse": {"varde": "antagen", "vardereferens": "20000000-0000-4000-8000-000000000001", "grupp": "Planhändelse", "gruppreferens": "20000000-0000-4000-8000-000000000000"}, "datumPlanhandelse": "2026-06-01", "underErsattning": false, "illustrativaGranser": true, "namn": "Vänerstranden", "geometri": {"typ": "yta", "position": {"type": "Polygon", "coordinates": [[[381000.0, 6480000.0], [381500.0, 6480000.0], [381500.0, 6480800.0], [381000.0, 6480800.0], [381000.0, 6480000.0]]]}, "koordinatsystemPlan": "EPSG:3006", "dimension": 2}}}, {"type": "Feature", "geometry": null, "properties": {"feature:typ": "innehallOP", "objektidentitet": "10000000-0000-4000-8000-000000000003", "versionGiltigFran": "2026-06-01T09:00:00+02:00", "oversiktsplan": "b7e3b2f1-4d66-4d7f-8c1f-2b3c4d5e6f70", "innehallstyp": {"varde": "Utvecklingsinriktning", "vardereferens": "30000000-0000-4000-8000-000000000004", "grupp": "Utvecklingsinriktning", "gruppreferens": "30000000-0000-4000-8000-000000000004"}, "planhandelse": {"varde": "antagen", "vardereferens": "20000000-0000-4000-8000-000000000001", "grupp": "Planhändelse", "gruppreferens": "20000000-0000-4000-8000-000000000000"}, "datumPlanhandelse": "2026-06-01", "underErsattning": false, "illustrativaGranser": true, "namn": "Nytt stråk", "geometri": {"typ": "multilinje", "position": {"type": "MultiLineString", "coordinates": [[[380000.0, 6480000.0], [380600.0, 6480600.0]], [[380700.0, 6480600.0], [381200.0, 6480900.0]]]}, "koordinatsystemPlan": "EPSG:3006", "dimension": 2}, "sambandsniva": [{"varde": "Regional", "vardereferens": "30000000-0000-4000-8000-000000000005", "grupp": "Sambandsnivå", "gruppreferens": "30000000-0000-4000-8000-000000000006"}]}}, {"type": "Feature", "geometry": null, "properties": {"feature:typ": "innehallOP", "objektidentitet": "10000000-0000-4000-8000-000000000004", "versionGiltigFran": "2026-06-01T09:00:00+02:00", "oversiktsplan": "b7e3b2f1-4d66-4d7f-8c1f-2b3c4d5e6f70", "innehallstyp": {"varde": "Bostadsförsörjning", "vardereferens": "30000000-0000-4000-8000-000000000007", "grupp": "Bostadsförsörjning", "gruppreferens": "30000000-0000-4000-8000-000000000007"}, "planhandelse": {"varde": "antagen", "vardereferens": "20000000-0000-4000-8000-000000000001", "grupp": "Planhändelse", "gruppreferens": "20000000-0000-4000-8000-000000000000"}, "datumPlanhandelse": "2026-06-01", "underErsattning": false, "illustrativaGranser": true, "namn": "Riktlinjer för bostadsförsörjningen"}}]};
  const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const ids = { b: ID(101), gata: ID(102), e1: ID(103), prick: ID(104), utfart: ID(105), n1: ID(106), h1: ID(107), a1: ID(108), kropp: ID(109) };
  const extras = (row) => (row && row.egenskaper ? JSON.parse(row.egenskaper) : {});
  const inSweden = (g) => {
    const first = (c) => (typeof c[0] === 'number' ? c : first(c[0]));
    const p = first(g.coordinates);
    return p[0] > 10 && p[0] < 25 && p[1] > 55 && p[1] < 70;
  };

  test('plan files: a delivery file per Detaljplan 4.1 reads every provision with its geometry, values, motive and heights', async (assert) => {
    assert.equal(plan.detect(DP41), 'detaljplan');
    const r = plan.fromDetaljplan(DP41);
    assert.equal(r.rows.length, 10, 'the plan area and nine provisions');
    assert.deepEqual(r.rows.map((x) => x.objekttyp), ['planomrade', 'anvandning', 'anvandning', 'egenskap', 'egenskap', 'egenskap', 'egenskap', 'egenskap', 'administrativ', 'egenskap']);
    for (const x of r.rows) assert.ok(x.geometri, 'a geometry for ' + x.objektid);
    const by = (id) => r.rows.find((x) => x.objektid === id);
    const g = (id) => geo.parseGeometry(by(id).geometri);
    assert.equal(g(ids.b).type, 'Polygon');
    assert.ok(inSweden(g(ids.b)), 'converted from SWEREF 99 12 00 to WGS 84: ' + JSON.stringify(g(ids.b).coordinates[0][0]));
    assert.equal(g(ids.utfart).type, 'LineString', 'a line (utfartsförbud)');
    assert.equal(g(ids.n1).type, 'Point', 'a point (markens höjd)');
    const body = g(ids.kropp);
    assert.equal(body.type, 'Polygon', 'a body is drawn as its footprint');
    assert.equal(body.coordinates[0].length, 5);
    assert.equal(by(ids.kropp).underkant, -6); assert.equal(by(ids.kropp).overkant, -2.5);
    assert.equal(by(ids.h1).underkant, 4.5, 'one height limited downwards is the lower limit'); assert.equal(by(ids.h1).overkant, null);
    assert.equal(by(ids.b).underkant, null, 'no height for a provision in 2D');
    const e1 = by(ids.e1);
    assert.deepEqual([e1.varde, e1.vardetyp, e1.enhet], ['300', 'max', 'kvadratmeter']);
    assert.equal(e1.etikett, 'Begränsar byggnadernas storlek mot stranden.', 'the motive inside the provision');
    assert.deepEqual(extras(e1).reglerarAnvandningsbestammelse, [ids.b]);
    assert.equal(extras(e1).sekundarEgenskapsgrans, false);
    assert.equal(extras(by(ids.gata)).giltighetstid, 120);
    assert.equal(by(ids.b).etikett, 'Nya bostäder nära stranden.');
    const p = r.plan;
    assert.deepEqual([p.beteckning, p.namn, p.kommun, p.kommunkod, p.status, p.typ], ['DP 2026:4', 'Detaljplan för Strandkvarteret', '1380', '1380', 'laga kraft', 'detaljplan']);
    assert.deepEqual([p.datumPaborjat, p.datumAntagande, p.datumLagakraft, p.genomforandetid, p.diarienummer], ['2025-02-01', '2026-08-25', '2026-09-20', '60', 'KS 2025/77'], 'the decision inside the plan');
    assert.equal(p.planbeskrivning, 'Planbeskrivning Strandkvarteret');
    assert.equal(p.crs, 'EPSG:3007');
    return 'ok';
  });

  test('plan files: the 4.1 file imports through io/import as a plan with the catalogue\'s facts and the new columns', async (assert) => {
    const file = new File([JSON.stringify(DP41)], 'strandkvarteret.json', { type: 'application/json' });
    let meta = null;
    try {
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'detaljplan', 'sniffed as a plan'); assert.equal(p.kind, 'plan'); assert.equal(p.totalRows, 10);
      meta = await importer.run(file, {}, null, null);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 10); assert.equal(meta.name, 'Detaljplan för Strandkvarteret');
      const cols = (await datasets.columns(meta.id)).map((c) => c.name);
      for (const c of ['underkant', 'overkant', 'egenskaper']) assert.ok(cols.includes(c), 'column ' + c);
      const rows = (await D.require('viz/data').fetchRows(meta.id, { fields: cols, limit: 20 })).rows;
      const b = rows.find((x) => x.objektid === ids.b);
      assert.equal(b.beteckning, 'B', 'the designation from Boverket\'s catalogue'); assert.ok(plan.fillOf(b), 'a fill for the use');
      const gata = rows.find((x) => x.objektid === ids.gata);
      assert.equal(gata.beteckning, 'GATA');
      assert.equal(rows.find((x) => x.objektid === ids.kropp).underkant, -6);
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id).catch(() => {}); }
  }, 60000);

  test('plan files: an Översiktsplan 2.0 file reads with geometry, the catalogue\'s categories as themes, the decision and content without a place', async (assert) => {
    assert.equal(plan.detect(OP20), 'oversiktsplan');
    const r = plan.fromOversiktsplanGeoJson(OP20);
    assert.equal(r.rows.length, 4);
    assert.deepEqual(r.rows.map((x) => x.tema), ['markochvattenanvandning', 'lis', 'utvecklingsinriktning', 'bostadsforsorjning'], 'themes by the categories\' table keys');
    assert.deepEqual(r.rows.map((x) => (x.geometri ? geo.parseGeometry(x.geometri).type : null)), ['Polygon', 'Polygon', 'MultiLineString', null]);
    assert.ok(inSweden(geo.parseGeometry(r.rows[0].geometri)), 'converted from SWEREF 99 TM');
    assert.equal(r.rows[0].innehallstyp, 'Bostadsbebyggelse');
    assert.equal(plan.opFillOf(r.rows[1]), plan.OP_THEME_COLORS.lis);
    assert.deepEqual(extras(r.rows[0]).berorAnnatInnehall, ['10000000-0000-4000-8000-000000000002']);
    assert.deepEqual(extras(r.rows[2]).sambandsniva, ['Regional']);
    assert.equal(extras(r.rows[0]).underErsattning, false); assert.equal(extras(r.rows[0]).illustrativaGranser, true);
    const p = r.plan;
    assert.deepEqual([p.namn, p.kommun, p.kommunkod, p.status, p.digitaltUrsprung], ['Översiktsplan Lidköping 2040', 'Lidköping', '1494', 'antagen', true]);
    assert.deepEqual([p.datumAntagande, p.datumLagakraft, p.diarienummer, p.beslut], ['2026-04-27', '2026-06-01', 'KS 2024/12', 1], 'the decision and its events');
    return 'ok';
  });

  // ---- GeoPackages ----------------------------------------------------------------------------------------------
  /** WKB (little-endian, 2D) of a GeoJSON geometry: points, lines, polygons and their multi forms. */
  function wkb(g) {
    const out = [];
    const chunk = (n, fill) => { const dv = new DataView(new ArrayBuffer(n)); fill(dv); out.push(new Uint8Array(dv.buffer)); };
    const u32 = (v) => chunk(4, (dv) => dv.setUint32(0, v, true));
    const pt = (c) => chunk(16, (dv) => { dv.setFloat64(0, c[0], true); dv.setFloat64(8, c[1], true); });
    const pts = (cs) => { u32(cs.length); cs.forEach(pt); };
    const write = (geom) => {
      chunk(5, (dv) => { dv.setUint8(0, 1); dv.setUint32(1, { Point: 1, LineString: 2, Polygon: 3, MultiPoint: 4, MultiLineString: 5, MultiPolygon: 6 }[geom.type], true); });
      if (geom.type === 'Point') pt(geom.coordinates);
      else if (geom.type === 'LineString') pts(geom.coordinates);
      else if (geom.type === 'Polygon') { u32(geom.coordinates.length); geom.coordinates.forEach(pts); }
      else { const single = { MultiPoint: 'Point', MultiLineString: 'LineString', MultiPolygon: 'Polygon' }[geom.type]; u32(geom.coordinates.length); geom.coordinates.forEach((c) => write({ type: single, coordinates: c })); }
    };
    write(g);
    const bytes = new Uint8Array(out.reduce((s, a) => s + a.length, 0));
    let o = 0;
    for (const a of out) { bytes.set(a, o); o += a.length; }
    return bytes;
  }
  const gpb = (g, srs) => { const w = wkb(g); const out = new Uint8Array(8 + w.length); out[0] = 0x47; out[1] = 0x50; out[2] = 0; out[3] = 0x01; new DataView(out.buffer).setInt32(4, srs, true); out.set(w, 8); return out; };
  const ring = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const mpoly = (x, y, w, h) => ({ type: 'MultiPolygon', coordinates: [[ring(x, y, w, h)]] });
  /** A GeoPackage with sql.js: the spatial reference, the contents, and each table's rows with geometry as GPB. */
  async function geoPackage(srs, layers) {
    const engine = new sqlite.SqliteEngine();
    await engine.start(); await engine.open();
    await engine.exec(`create table gpkg_spatial_ref_sys (srs_name text, srs_id integer primary key, organization text, organization_coordsys_id integer, definition text); insert into gpkg_spatial_ref_sys values ('${srs.name}', ${srs.id}, 'EPSG', ${srs.id}, ''); create table gpkg_contents (table_name text primary key, data_type text, identifier text, srs_id integer); create table gpkg_geometry_columns (table_name text, column_name text, geometry_type_name text, srs_id integer, z integer, m integer);`);
    for (const layer of layers) {
      const cols = layer.columns;
      await engine.exec(`create table "${layer.name}" (fid integer primary key${layer.geometry ? ', geom blob' : ''}${cols.map((c) => `, "${c}" text`).join('')})`);
      await engine.run('insert into gpkg_contents values (?, ?, ?, ?)', [layer.name, layer.geometry ? 'features' : 'attributes', layer.name, layer.geometry ? srs.id : null]);
      if (layer.geometry) await engine.run('insert into gpkg_geometry_columns values (?, ?, ?, ?, 0, 0)', [layer.name, 'geom', layer.geometry, srs.id]);
      let fid = 1;
      for (const row of layer.rows) {
        const names = ['fid'].concat(layer.geometry ? ['geom'] : [], cols);
        const values = [fid++].concat(layer.geometry ? [row.geom ? gpb(row.geom, srs.id) : null] : [], cols.map((c) => (row[c] === undefined ? null : row[c])));
        await engine.run(`insert into "${layer.name}" (${names.map((n) => `"${n}"`).join(', ')}) values (${names.map(() => '?').join(', ')})`, values);
      }
    }
    const bytes = await engine.export();
    engine.terminate();
    return bytes;
  }

  test('plan files: a Rita Detaljplan GeoPackage imports whole as a plan with designations, colours, heights, motives and areas not yet given a provision', async (assert) => {
    const X = 150000; const Y = 6450000;
    const P = 'a6d2a1f0-3c55-4c6e-9b0e-1a2b3c4d5e6f';
    const area = ['objektidentitet', 'objektversion', 'versionGiltigFran', 'detaljplan', 'beteckning', 'farg', 'symbol', 'anvandningsform', 'bestammelser', 'label_x', 'label_y'];
    const prov = ['objektidentitet', 'objektversion', 'versionGiltigFran', 'detaljplan', 'tabell', 'yta', 'beteckning', 'beteckningsindex', 'ordning', 'planbestammelsekatalogreferens', 'bestammelsekod', 'anvandningsform', 'farg', 'symbol', 'bestammelseformulering', 'avviker', 'ursprungligBestammelseformulering', 'bestammelsevarde', 'motiv', 'vertikalAvgransning', 'hojdUnderkant', 'hojdOverkant', 'giltighetstid', 'borjarGallaEfter', 'sekundarEgenskapsgrans', 'reglerarDetaljplan'];
    const bytes = await geoPackage({ name: 'SWEREF99 12 00', id: 3007 }, [
      { name: 'detaljplan', geometry: 'MULTIPOLYGON', columns: ['objektidentitet', 'objektversion', 'versionGiltigFran', 'kommun', 'beteckning', 'namn', 'syfte', 'status', 'datumStatusforandring', 'typ', 'anvandbarhet'],
        rows: [{ geom: mpoly(X, Y, 200, 200), objektidentitet: P, objektversion: 1, kommun: '1380', beteckning: 'DP 2026:4', namn: 'Detaljplan för Strandkvarteret', syfte: 'Bostäder och gata', status: 'antagen', typ: 'detaljplan', anvandbarhet: 'god' }] },
      { name: 'anvandning_yta', geometry: 'MULTIPOLYGON', columns: area, rows: [
        { geom: mpoly(X, Y, 140, 200), objektidentitet: 'a1', detaljplan: P, beteckning: 'B', farg: 'gul', anvandningsform: 'Kvartersmark', bestammelser: 1 },
        { geom: mpoly(X + 140, Y, 60, 150), objektidentitet: 'a2', detaljplan: P, beteckning: 'GATA', farg: 'ljusgrå', anvandningsform: 'Allmän plats', bestammelser: 1 },
        { geom: mpoly(X + 140, Y + 150, 60, 50), objektidentitet: 'a3', detaljplan: P, beteckning: '', bestammelser: 0 }] },
      { name: 'egenskap_yta', geometry: 'MULTIPOLYGON', columns: area.concat(['sekundar']), rows: [
        { geom: mpoly(X + 10, Y + 10, 100, 100), objektidentitet: 'y1', detaljplan: P, beteckning: 'e1 h1', bestammelser: 2 },
        { geom: mpoly(X, Y + 180, 140, 20), objektidentitet: 'y2', detaljplan: P, beteckning: '', symbol: 'prickmark', bestammelser: 1 }] },
      { name: 'egenskap_linje', geometry: 'MULTILINESTRING', columns: area, rows: [{ geom: { type: 'MultiLineString', coordinates: [[[X + 140, Y + 20], [X + 140, Y + 120]]] }, objektidentitet: 'l1', detaljplan: P, bestammelser: 1 }] },
      { name: 'egenskap_punkt', geometry: 'MULTIPOINT', columns: area, rows: [{ geom: { type: 'MultiPoint', coordinates: [[X + 60, Y + 60]] }, objektidentitet: 'p1', detaljplan: P, beteckning: 'n1', bestammelser: 1 }] },
      { name: 'bestammelse', geometry: null, columns: prov, rows: [
        { objektidentitet: 'b-1', detaljplan: P, tabell: 'anvandning_yta', yta: 'a1', beteckning: 'B', ordning: 1, planbestammelsekatalogreferens: B_UUID, anvandningsform: 'Kvartersmark', farg: 'gul', bestammelseformulering: 'Bostäder', motiv: 'Nya bostäder nära stranden.' },
        { objektidentitet: 'b-2', detaljplan: P, tabell: 'anvandning_yta', yta: 'a2', beteckning: 'GATA', ordning: 1, planbestammelsekatalogreferens: GATA_UUID, anvandningsform: 'Allmän plats', farg: 'ljusgrå', bestammelseformulering: 'Gata', giltighetstid: 120 },
        { objektidentitet: 'b-3', detaljplan: P, tabell: 'egenskap_yta', yta: 'y1', beteckning: 'e1', beteckningsindex: 1, ordning: 1, planbestammelsekatalogreferens: '2bd7f01b-ac79-45b4-a24d-093620e7e2f2', bestammelseformulering: 'Största byggnadsarea är 300 m² per fastighet',
          bestammelsevarde: '[{"datatyp": "decimaltal", "variabelvarde": "300", "beskrivning": "byggnadsarea", "vardetyp": "max", "enhet": "kvadratmeter"}]', motiv: 'Begränsar byggnadernas storlek.', sekundarEgenskapsgrans: 0 },
        { objektidentitet: 'b-4', detaljplan: P, tabell: 'egenskap_yta', yta: 'y1', beteckning: 'h1', beteckningsindex: 1, ordning: 2, planbestammelsekatalogreferens: '912a1a73-ad9d-418d-9ffd-19ecb2cc9c7f', bestammelseformulering: 'Högsta nockhöjd är 12 meter', vertikalAvgransning: 'nedåt', hojdUnderkant: 4.5 },
        { objektidentitet: 'b-5', detaljplan: P, tabell: 'egenskap_yta', yta: 'y2', beteckning: '', ordning: 1, planbestammelsekatalogreferens: 'fb5dba7d-330b-48ce-9a68-121ef5260bcb', symbol: 'prickmark', bestammelseformulering: 'Marken får inte förses med byggnad' },
        { objektidentitet: 'b-6', detaljplan: P, tabell: 'egenskap_linje', yta: 'l1', beteckning: '', ordning: 1, planbestammelsekatalogreferens: '623a21a0-5d27-4b55-889f-b0841409894d', bestammelseformulering: 'Utfartsförbud' },
        { objektidentitet: 'b-7', detaljplan: P, tabell: 'egenskap_punkt', yta: 'p1', beteckning: 'n1', ordning: 1, planbestammelsekatalogreferens: '291393ff-4cbe-47de-8b84-0b1aa6fe3664', bestammelseformulering: 'Markens höjd över nollplanet ska vara 3,5 meter', avviker: 1, ursprungligBestammelseformulering: 'Markens höjd över nollplanet ska vara [höjd] meter' },
        { objektidentitet: 'b-8', detaljplan: P, tabell: 'egenskap_yta', yta: 'gone', beteckning: 'e2', ordning: 1, bestammelseformulering: 'En bestämmelse vars yta är borttagen' }] },
      { name: 'beslutsinformation', geometry: null, columns: ['detaljplan', 'instansInomKommunen', 'diarienummerKommun', 'beslutstyp', 'datumPaborjat', 'datumAntagande', 'datumLagakraft', 'genomforandetid', 'genomforandetidStartar'],
        rows: [{ detaljplan: P, instansInomKommunen: 'kommunfullmäktige', diarienummerKommun: 'KS 2025/77', beslutstyp: 'antagande av ny detaljplan', datumPaborjat: '2025-02-01', datumAntagande: '2026-08-25', datumLagakraft: '2026-09-20; 2026-10-01', genomforandetid: 60 }] },
      { name: 'dokument', geometry: null, columns: ['detaljplan', 'roll', 'innehall', 'namn', 'kortnamn', 'datum', 'lank'],
        rows: [{ detaljplan: P, roll: 'planbeskrivning', namn: 'Planbeskrivning Strandkvarteret' }, { detaljplan: P, roll: 'beslutshandling', innehall: 'plankarta', namn: 'Plankarta' }] },
      { name: 'hjalplinje', geometry: 'MULTILINESTRING', columns: ['objektidentitet', 'beskrivning'], rows: [{ geom: { type: 'MultiLineString', coordinates: [[[X, Y], [X + 10, Y + 10]]] }, objektidentitet: 'h-1', beskrivning: 'konstruktionslinje' }] },
      { name: 'dp_meta', geometry: null, columns: ['nyckel', 'varde'], rows: [{ nyckel: 'schemaversion', varde: '11' }] },
    ]);
    const file = new File([bytes], 'strandkvarteret.gpkg', { type: 'application/geopackage+sqlite3' });
    let meta = null;
    try {
      const p = await importer.preview(file, {});
      assert.equal(p.importer, 'sqlite'); assert.equal(p.planGpkg, 'detaljplan', 'recognised as a Rita Detaljplan GeoPackage');
      meta = await importer.run(file, { plan: true }, null, null);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.name, 'Detaljplan för Strandkvarteret');
      assert.equal(meta.rowCount, 9, 'the plan area, seven provisions and the area without one; the provision whose area is gone and the helper line are not part of the plan');
      assert.ok(meta.plan && meta.plan.slag === 'detaljplan' && meta.plan.format === 'detaljplan-gpkg', JSON.stringify(meta.plan));
      assert.deepEqual([meta.plan.status, meta.plan.datumAntagande, meta.plan.datumLagakraft, meta.plan.genomforandetid, meta.plan.planbeskrivning], ['antagen', '2026-08-25', '2026-09-20', '60', 'Planbeskrivning Strandkvarteret']);
      assert.equal(meta.plan.handlingar.length, 2);
      const cols = (await datasets.columns(meta.id)).map((c) => c.name);
      const rows = (await D.require('viz/data').fetchRows(meta.id, { fields: cols, limit: 20 })).rows;
      const by = (id) => rows.find((x) => x.objektid === id);
      assert.deepEqual(rows.map((x) => x.objekttyp), ['planomrade', 'anvandning', 'anvandning', 'egenskap', 'egenskap', 'egenskap', 'egenskap', 'egenskap', 'anvandning']);
      assert.equal(by('b-1').beteckning, 'B'); assert.equal(String(by('b-1').farg).toLowerCase(), 'gul', 'the colour name (the catalogue writes it with a capital)'); assert.equal(plan.fillOf(by('b-1')), D.require('data/plan-catalog').colorFor('gul'));
      assert.equal(by('b-1').etikett, 'Nya bostäder nära stranden.');
      assert.deepEqual([by('b-3').beteckning, by('b-3').varde, by('b-3').enhet], ['e1', '300', 'kvadratmeter']);
      assert.equal(by('b-4').underkant, 4.5); assert.equal(by('b-4').overkant, null);
      assert.equal(extras(by('b-5')).symbol, 'prickmark');
      assert.equal(extras(by('b-7')).ursprungligBestammelseformulering, 'Markens höjd över nollplanet ska vara [höjd] meter');
      assert.equal(extras(by('b-2')).giltighetstid, 120);
      assert.equal(geo.parseGeometry(by('b-6').geometri).type, 'MultiLineString');
      assert.equal(geo.parseGeometry(by('b-7').geometri).type, 'MultiPoint');
      assert.ok(inSweden(geo.parseGeometry(by('b-1').geometri)), 'SWEREF 99 12 00 by its name in the GeoPackage');
      assert.equal(extras(by('a3')).utanBestammelse, true, 'the drawn area without a provision');
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id).catch(() => {}); }
  }, 60000);

  test('plan files: an ÖP GeoPackage in Boverket\'s model 0.4 reads its decision, links and the planhandling\'s sections, and no link table as content', async (assert) => {
    const X = 380000; const Y = 6480000;
    const content = ['objektidentitet', 'versiongiltigfran', 'oversiktsplan', 'vertikal_avgransning', 'kompletterandeInnehallstyp', 'namn', 'innehallstyp_varde', 'precisering', 'beslut', 'planhandelse_varde', 'under_ersattning', 'datum_paborjat', 'illustrativa_granser', 'presentationsskala', 'planhandelse_datum'];
    const bytes = await geoPackage({ name: 'SWEREF99 TM', id: 3006 }, [
      { name: 'oversiktsplan', geometry: null, columns: ['objektidentitet', 'beslut', 'kommunkod', 'kommunnamn', 'planens_titel', 'planhandelse_varde', 'planhandelse_datum', 'datum_paborjat', 'digitalt_ursprung'],
        rows: [{ objektidentitet: 'op-1', beslut: 'dec-1', kommunkod: '1494', kommunnamn: 'Lidköping', planens_titel: 'Översiktsplan Lidköping 2040', planhandelse_varde: 'antagen', planhandelse_datum: '2026-06-01', datum_paborjat: '2024-03-01', digitalt_ursprung: 1 }] },
      { name: 'innehall_op_markochvattenanvandning_polygon', geometry: 'MULTIPOLYGON', columns: content.concat(['utbyggnadsordning']), rows: [
        { geom: mpoly(X, Y, 1000, 800), objektidentitet: 'c-1', oversiktsplan: 'op-1', namn: 'Norra staden', innehallstyp_varde: 'Bostadsbebyggelse', planhandelse_varde: 'antagen', planhandelse_datum: '2026-06-01', under_ersattning: 0, illustrativa_granser: 1, utbyggnadsordning: 'Etapp 1 (2027–2030)' }] },
      { name: 'innehall_op_utvecklingsinriktning_line', geometry: 'MULTILINESTRING', columns: content.concat(['sambandsniva_varde', 'utbyggnadsordning', 'rita_pilar']), rows: [
        { geom: { type: 'MultiLineString', coordinates: [[[X, Y], [X + 600, Y + 600]]] }, objektidentitet: 'c-2', oversiktsplan: 'op-1', namn: 'Nytt stråk', innehallstyp_varde: 'Utvecklingsinriktning', sambandsniva_varde: 'Regional', planhandelse_varde: 'antagen', planhandelse_datum: '2026-06-01', under_ersattning: 0, illustrativa_granser: 1, rita_pilar: 'slut' }] },
      { name: 'innehall_op_bostadsforsorjning_polygon', geometry: 'MULTIPOLYGON', columns: content, rows: [
        { geom: null, objektidentitet: 'c-3', oversiktsplan: 'op-1', namn: 'Riktlinjer för bostadsförsörjningen', innehallstyp_varde: 'Bostadsförsörjning', planhandelse_varde: 'antagen', planhandelse_datum: '2026-06-01', under_ersattning: 0, illustrativa_granser: 1 }] },
      { name: 'innehall_op_markochvattenanvandning_lookup', geometry: null, columns: ['innehallstyp_varde', 'vardereferens', 'grupp_varde', 'gruppreferens'], rows: [{ innehallstyp_varde: 'Bostadsbebyggelse' }] },
      { name: 'innehall_op_beror_annat_innehall', geometry: null, columns: ['objektidentitet', 'beror_objektidentitet'], rows: [{ objektidentitet: 'c-1', beror_objektidentitet: 'c-2' }] },
      { name: 'innehall_op_extern_referens_ri', geometry: null, columns: ['extern_referens_ri_id', 'objektidentitet', 'dokumentreferens_id'], rows: [] },
      { name: 'beslut_op', geometry: null, columns: ['objektidentitet', 'beslutande_organisation_namn', 'beslutande_instans', 'diarienummer', 'rubrik'], rows: [{ objektidentitet: 'dec-1', beslutande_organisation_namn: 'Lidköpings kommun', beslutande_instans: 'kommunfullmäktige', diarienummer: 'KS 2024/12' }] },
      { name: 'beslut_op_handelse', geometry: null, columns: ['beslut_op_id', 'handelsetyp', 'datum'], rows: [{ beslut_op_id: 'dec-1', handelsetyp: 'fattat', datum: '2026-04-27' }, { beslut_op_id: 'dec-1', handelsetyp: 'laga kraft', datum: '2026-06-01' }] },
      { name: 'avsnittsbokmärke', geometry: null, columns: ['avsnittsbokmarke_id', 'avsnittsbokmarke_text'], rows: [{ avsnittsbokmarke_id: 'bm-1', avsnittsbokmarke_text: 'Bostäder i Norra staden' }] },
      { name: 'dokumentavsnitt', geometry: null, columns: ['avsnittstyp_varde', 'avsnittsbokmarke_id', 'dokumentreferens_id', 'dokument_id', 'objektidentitet'], rows: [{ avsnittstyp_varde: 'Ställningstagande', avsnittsbokmarke_id: 'bm-1', dokumentreferens_id: 'd-1', dokument_id: 'c-1', objektidentitet: 'c-1' }] },
    ]);
    const file = new File([bytes], 'op-lidkoping.gpkg', { type: 'application/geopackage+sqlite3' });
    let meta = null;
    try {
      const p = await importer.preview(file, {});
      assert.equal(p.planGpkg, 'oversiktsplan');
      meta = await importer.run(file, { plan: true }, null, null);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 3, 'three content objects; the link tables are not content');
      assert.deepEqual([meta.plan.kommun, meta.plan.kommunkod, meta.plan.digitaltUrsprung, meta.plan.datumAntagande, meta.plan.datumLagakraft, meta.plan.diarienummer], ['Lidköping', '1494', true, '2026-04-27', '2026-06-01', 'KS 2024/12']);
      const cols = (await datasets.columns(meta.id)).map((c) => c.name);
      assert.deepEqual(cols, plan.OP_COLUMNS.map((c) => c.name));
      const rows = (await D.require('viz/data').fetchRows(meta.id, { fields: cols, limit: 10 })).rows;
      const by = (id) => rows.find((x) => x.objektid === id);
      assert.deepEqual(rows.map((x) => x.tema).sort(), ['bostadsforsorjning', 'markochvattenanvandning', 'utvecklingsinriktning']);
      assert.deepEqual(extras(by('c-1')).berorAnnatInnehall, ['c-2']);
      assert.deepEqual(extras(by('c-1')).dokument, ['Bostäder i Norra staden'], 'the planhandling\'s section about the object');
      assert.equal(extras(by('c-1')).underErsattning, false); assert.equal(extras(by('c-1')).illustrativaGranser, true);
      assert.equal(by('c-1').utbyggnadsordning, 'Etapp 1 (2027–2030)');
      assert.equal(extras(by('c-2')).sambandsniva, 'Regional');
      assert.equal(by('c-3').geometri, null, 'content described only in text');
      return 'ok';
    } finally { if (meta) await datasets.remove(meta.id).catch(() => {}); }
  }, 60000);

  // ---- archive packages (Boverket's specification for long-term preservation, PREMIS 3.0) ------------------------------
  const hex = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((b) => b.toString(16).padStart(2, '0')).join('');
  /** The files of an archive package as Rita makes it: content/, metadata/PREMIS.xml with each file's SHA-256, schemas/. */
  async function archivePackage(root, contents, tamper) {
    const enc = new TextEncoder();
    const files = [];
    const objects = [];
    for (const [path, data] of Object.entries(contents)) {
      const bytes = typeof data === 'string' ? enc.encode(data) : data;
      objects.push(`<premis:object xsi:type="premis:file"><premis:objectIdentifier><premis:objectIdentifierType>UUID</premis:objectIdentifierType><premis:objectIdentifierValue>${crypto.randomUUID()}</premis:objectIdentifierValue></premis:objectIdentifier>`
        + `<premis:objectCharacteristics><premis:compositionLevel>0</premis:compositionLevel><premis:fixity><premis:messageDigestAlgorithm>SHA-256</premis:messageDigestAlgorithm><premis:messageDigest>${await hex(bytes)}</premis:messageDigest></premis:fixity><premis:size>${bytes.length}</premis:size></premis:objectCharacteristics>`
        + `<premis:originalName>${path.split('/').pop()}</premis:originalName><premis:storage><premis:contentLocation><premis:contentLocationType>Uniform Resource Identifier</premis:contentLocationType><premis:contentLocationValue>${encodeURI(path)}</premis:contentLocationValue></premis:contentLocation></premis:storage></premis:object>`);
      const written = tamper && tamper[path] ? enc.encode(tamper[path]) : bytes;
      files.push([path, written]);
    }
    const premis = `<?xml version="1.0" encoding="UTF-8"?><premis:premis xmlns:premis="http://www.loc.gov/premis/v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="3.0">`
      + `<premis:object xsi:type="premis:representation"><premis:objectIdentifier><premis:objectIdentifierType>UUID</premis:objectIdentifierType><premis:objectIdentifierValue>${crypto.randomUUID()}</premis:objectIdentifierValue></premis:objectIdentifier><premis:originalName>Strandkvarteret</premis:originalName></premis:object>`
      + objects.join('') + '</premis:premis>';
    files.push(['metadata/PREMIS.xml', enc.encode(premis)], ['schemas/premis-v3-0.xsd', enc.encode('<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>')]);
    return files.map(([path, bytes]) => { const f = new File([bytes], path.split('/').pop()); /** @type {any} */ (f).dmPath = root + '/' + path; return f; });
  }

  test('plan files: an archive package, as a folder or a ZIP, opens as the plan with its documents and the check of its files', async (assert) => {
    const archive = D.require('io/importers/plan-archive');
    const root = 'Strandkvarteret_arkivpaket_2026-11-07';
    const contents = { 'content/strandkvarteret.json': JSON.stringify(DP41), 'content/plankarta.pdf': '%PDF-1.7 plankarta', 'content/planbeskrivning.pdf': '%PDF-1.7 planbeskrivning' };
    const made = [];
    try {
      // A folder: its files are recognised as a package and imported as one plan (Inhämta's drop zone does the same).
      const files = await archivePackage(root, contents);
      assert.ok(importer.isPackage(files), 'the files are a package');
      assert.ok(!importer.isPackage([new File(['a,b\n1,2\n'], 'annat.csv', { type: 'text/csv' })]), 'a file on its own is not');
      const meta = await importer.runPackage(files, {}); made.push(meta.id);
      assert.equal(meta.kind, 'plan'); assert.equal(meta.rowCount, 10); assert.equal(meta.name, 'Detaljplan för Strandkvarteret');
      const a = meta.plan.arkivpaket;
      assert.ok(a, 'the check kept with the plan');
      assert.deepEqual([a.namn, a.filer, a.stammer, a.andrade.length, a.saknas.length], [root, 3, 3, 0, 0], JSON.stringify(a));
      const tr = D.require('ui/i18n').t;
      assert.equal(tr('plan.archive.ok', { n: 1 }), tr('plan.archive.ok.one', { n: 1 }), 'one file in the singular');
      const kept = (await D.require('data/dataset-files').list(meta.id)).map((f) => f.name);
      for (const p of ['content/plankarta.pdf', 'content/planbeskrivning.pdf', 'metadata/PREMIS.xml']) assert.ok(kept.includes(p), 'kept: ' + p);
      // A changed file and a missing one are reported.
      const tampered = (await archivePackage(root, contents, { 'content/plankarta.pdf': '%PDF-1.7 ändrad' })).filter((f) => !/planbeskrivning/.test(f.name));
      const meta2 = await archive.importFiles(tampered, {}); made.push(meta2.id);
      assert.deepEqual(meta2.plan.arkivpaket.andrade, ['content/plankarta.pdf']);
      assert.deepEqual(meta2.plan.arkivpaket.saknas, ['content/planbeskrivning.pdf']);
      // A ZIP of the package: recognised by its PREMIS.xml, previewed and imported.
      const entries = {};
      for (const f of files) entries[/** @type {any} */ (f).dmPath] = new Uint8Array(await f.arrayBuffer());
      const blob = await D.require('platform/storage/zip').createZip(entries);
      const zipFile = new File([blob], root + '.zip', { type: 'application/zip' });
      const p = await importer.preview(zipFile, {});
      assert.equal(p.importer, 'planarchive'); assert.equal(p.kind, 'plan'); assert.equal(p.plan.arkivpaket.stammer, 3);
      const meta3 = await importer.run(zipFile, {}, null, null); made.push(meta3.id);
      assert.equal(meta3.kind, 'plan'); assert.equal(meta3.rowCount, 10);
      // A place outside the package is not checked, and nothing outside it is read.
      const premis = archive.entriesOf('<premis:premis xmlns:premis="http://www.loc.gov/premis/v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><premis:object xsi:type="premis:file"><premis:objectCharacteristics><premis:fixity><premis:messageDigestAlgorithm>SHA-256</premis:messageDigestAlgorithm><premis:messageDigest>00</premis:messageDigest></premis:fixity></premis:objectCharacteristics><premis:storage><premis:contentLocation><premis:contentLocationValue>../utanfor.txt</premis:contentLocationValue></premis:contentLocation></premis:storage></premis:object></premis:premis>');
      const report = await archive.verify(new Map(), premis);
      assert.deepEqual(report.unchecked, ['../utanfor.txt']);
      return 'ok';
    } finally { for (const id of made) await datasets.remove(id).catch(() => {}); }
  }, 60000);

  test('plan files: real files from planning tools (Rita Detaljplan 0.1.77, Rita Översiktsplan 0.1.15) read whole, file by file and as archive packages', async (assert) => {
    const fx = D.require('tests/fixtures/plan-files');
    const archive = D.require('io/importers/plan-archive');
    const unzip = async (pkg) => {
      const bytes = Uint8Array.from(atob(pkg.zip), (c) => c.charCodeAt(0));
      const entries = await D.require('platform/storage/zip').readZip(bytes);
      return Object.entries(entries).filter(([n]) => !n.endsWith('/')).map(([n, b]) => { const f = new File([b], n.split('/').pop()); /** @type {any} */ (f).dmPath = n; return f; });
    };
    const byEnd = (files, re) => files.find((f) => re.test(/** @type {any} */ (f).dmPath));
    const made = [];
    try {
      // The detaljplan: its delivery file to NGP.
      const dpFiles = await unzip(fx.dp);
      const dpJson = JSON.parse(await byEnd(dpFiles, /content\/[^/]+\.json$/).text());
      assert.equal(plan.detect(dpJson), 'detaljplan');
      const d = plan.fromDetaljplan(dpJson);
      assert.equal(d.rows.length, 5, 'the plan area and four provisions');
      for (const r of d.rows) assert.ok(r.geometri, 'a geometry for ' + r.objekttyp);
      assert.ok(inSweden(geo.parseGeometry(d.rows[0].geometri)), 'in Eskilstuna');
      const texts = d.rows.map((r) => r.formulering);
      assert.ok(texts.some((x) => /^Största lutning är 5:5/.test(x)), 'the variables filled in: ' + texts.join(' | '));
      assert.ok(!texts.some((x) => /\[[^\]]+:[^\]]+\]/.test(x)), 'no variable left in brackets');
      assert.deepEqual([d.plan.namn, d.plan.kommun], ['Kv Väktaren', 'Eskilstuna']);
      // The detaljplan: its GeoPackage, whole.
      const gpkg = byEnd(dpFiles, /content\/[^/]+\.gpkg$/);
      const gp = await importer.preview(new File([gpkg], gpkg.name), {});
      assert.equal(gp.planGpkg, 'detaljplan', 'recognised as a detaljplan GeoPackage');
      const m1 = await importer.run(new File([gpkg], gpkg.name), { plan: true }, null, null); made.push(m1.id);
      assert.equal(m1.rowCount, 5);
      const cols = (await datasets.columns(m1.id)).map((c) => c.name);
      const rows = (await D.require('viz/data').fetchRows(m1.id, { fields: cols, limit: 20 })).rows;
      const uses = rows.filter((r) => r.objekttyp === 'anvandning');
      assert.equal(uses.length, 2); assert.ok(uses.every((r) => plan.fillOf(r)), 'the uses filled');
      assert.ok(rows.every((r) => r.geometri), 'every object with its geometry');
      assert.ok(rows.some((r) => extras(r).symbol), 'the catalogue symbol kept');
      assert.ok(!rows.some((r) => /\[[^\]]+:[^\]]+\]/.test(r.formulering || '')), 'the variables filled in from the GeoPackage too');
      // The detaljplan: its archive package.
      const m2 = await archive.importFiles(dpFiles, {}); made.push(m2.id);
      const a = m2.plan.arkivpaket;
      assert.deepEqual([a.filer, a.stammer, a.andrade.length, a.saknas.length], [4, 4, 0, 0], JSON.stringify(a));
      assert.equal(m2.rowCount, 5);
      // The översiktsplan: its delivery file, its GeoPackage and its archive package.
      const opFiles = await unzip(fx.op);
      const opJson = JSON.parse(await byEnd(opFiles, /content\/[^/]+\.json$/).text());
      assert.equal(plan.detect(opJson), 'oversiktsplan');
      const o = plan.fromOversiktsplanGeoJson(opJson);
      assert.equal(o.rows.length, 4);
      assert.deepEqual(o.rows.map((r) => r.tema).sort(), ['klimatrelateradrisk', 'markochvattenanvandning', 'markochvattenanvandning', 'utvecklingsinriktning']);
      assert.ok(o.rows.every((r) => r.geometri), 'every content object with its geometry');
      assert.deepEqual([o.plan.kommun, o.plan.kommunkod, o.plan.datumAntagande, o.plan.datumLagakraft, o.plan.diarienummer], ['Eskilstuna', '0484', '2026-04-27', '2026-06-01', 'KS 2026/12']);
      const opGpkg = byEnd(opFiles, /content\/[^/]+\.gpkg$/);
      const m3 = await importer.run(new File([opGpkg], opGpkg.name), { plan: true }, null, null); made.push(m3.id);
      assert.equal(m3.rowCount, 4, 'four content objects; no lookup or link table as content');
      assert.deepEqual([m3.plan.kommun, m3.plan.datumLagakraft, m3.plan.diarienummer], ['Eskilstuna', '2026-06-01', 'KS 2026/12']);
      const m4 = await archive.importFiles(opFiles, {}); made.push(m4.id);
      assert.deepEqual([m4.plan.arkivpaket.stammer, m4.plan.arkivpaket.andrade.length], [2, 0], JSON.stringify(m4.plan.arkivpaket));
      // Downloaded from a web address, a plan file keeps a name that leads it to the right reader.
      const urls = D.require('io/url-import');
      assert.deepEqual([urls.fileName('https://kommun.example/planer/dp-2026-4.gpkg', ''), urls.fileName('https://kommun.example/planer/dp-2026-4', 'application/geopackage+sqlite3'), urls.fileName('https://kommun.example/arkiv/paket', 'application/zip'), urls.fileName('https://kommun.example/ngp/leverans', 'application/vnd.lm.detaljplan.v4+json')],
        ['dp-2026-4.gpkg', 'dp-2026-4.gpkg', 'paket.zip', 'leverans.json']);
      return 'ok';
    } finally { for (const id of made) await datasets.remove(id).catch(() => {}); }
  }, 120000);

  test('plan files: an archive package dropped in Inhämta as a ZIP shows the plan and the check of its files, and imports without the column step', async (assert) => {
    const t = D.require('ui/i18n').t;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
      const t0 = performance.now();
      for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
    }
    const fx = D.require('tests/fixtures/plan-files');
    const zipFile = new File([Uint8Array.from(atob(fx.dp.zip), (c) => c.charCodeAt(0))], fx.dp.name + '.zip', { type: 'application/zip' });
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const button = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const click = (el) => /** @type {HTMLElement} */ (el.querySelector('button')).click();
    let made = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('dm-dropzone'), 5000, 'the drop zone');
      zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [zipFile] }, bubbles: true }));
      const card = await waitFor(() => root.querySelector('[data-plan-preview]'), 15000, 'the plan card');
      assert.ok(card.textContent.includes('Kv Väktaren'), card.textContent);
      assert.ok(card.textContent.includes(t('plan.archive.ok', { n: 4 })), 'the check of the files: ' + card.textContent);
      assert.ok(!button(t('common.next')), 'no column step for a plan');
      click(await waitFor(() => button(t('common.import')), 5000, 'the Import button'));
      await waitFor(() => root.querySelector('.dm-success'), 15000, 'the result');
      made = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'plan' && d.name === 'Kv Väktaren'), 5000, 'the plan in the list');
      assert.equal(made.plan.arkivpaket.stammer, 4);
      return 'ok';
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      if (made) await datasets.remove(made.id).catch(() => {});
      root.remove();
    }
  }, 60000);

  test('plan files: an archive package dropped in Inhämta as a folder opens as the plan in one step, and other files one at a time', async (assert) => {
    const t = D.require('ui/i18n').t;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
      const t0 = performance.now();
      for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
    }
    const fx = D.require('tests/fixtures/plan-files');
    // The files as the drop zone gives them for a dropped folder: each with its path inside the folder (dmPath).
    const entries = await D.require('platform/storage/zip').readZip(Uint8Array.from(atob(fx.dp.zip), (c) => c.charCodeAt(0)));
    const files = Object.entries(entries).filter(([n]) => !n.endsWith('/')).map(([n, b]) => { const f = new File([b], n.split('/').pop()); /** @type {any} */ (f).dmPath = n; return f; });
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    const button = (text) => Array.from(root.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === text);
    const click = (el) => /** @type {HTMLElement} */ (el.querySelector('button')).click();
    let made = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      shell.activate('inhamta');
      const zone = await waitFor(() => root.querySelector('dm-dropzone'), 5000, 'the drop zone');
      assert.ok(zone.hasAttribute('multiple'), 'the drop zone takes several files and folders');
      zone.dispatchEvent(new CustomEvent('dm-files', { detail: { files }, bubbles: true }));
      await waitFor(() => root.querySelector('.dm-success'), 15000, 'the result');
      assert.ok(!button(t('common.next')), 'no column step for a package');
      made = await waitFor(() => shell.store.get().datasets.find((d) => d.kind === 'plan' && d.name === 'Kv Väktaren'), 5000, 'the plan in the list');
      assert.deepEqual([made.plan.arkivpaket.filer, made.plan.arkivpaket.stammer], [4, 4], JSON.stringify(made.plan.arkivpaket));
      // Several files that are not a package: the first is read, and the user is told so.
      click(await waitFor(() => button(t('import.another')), 5000, 'Import another'));
      const zone2 = await waitFor(() => root.querySelector('dm-dropzone'), 5000, 'the drop zone again');
      const csv = (name) => new File(['a,b\n1,2\n'], name, { type: 'text/csv' });
      zone2.dispatchEvent(new CustomEvent('dm-files', { detail: { files: [csv('forsta.csv'), csv('andra.csv')] }, bubbles: true }));
      const said = t('import.drop.first', { name: 'forsta.csv' });
      await waitFor(() => Array.from(document.querySelectorAll('.dm-toast')).some((el) => el.textContent.includes(said)), 5000, 'the note about the first file');
      await waitFor(() => button(t('common.next')), 10000, 'the first file\'s next step');
      return 'ok';
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      if (made) await datasets.remove(made.id).catch(() => {});
      root.remove();
    }
  }, 60000);

  test('plan files: the plan map asks before it fetches a background map, and Hantera changes the answer', async (assert) => {
    const t = D.require('ui/i18n').t;
    const consent = D.require('platform/consent');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
      const t0 = performance.now();
      for (;;) { const v = await fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
    }
    assert.ok(!consent.override(), 'the test page does not allow everything');
    const before = await consent.state('basemaps');
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null;
    try {
      await consent.set('basemaps', null);
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      meta = await importer.run(new File([JSON.stringify(DP41)], 'strandkvarteret.json', { type: 'application/json' }), {}, null, null);
      await waitFor(() => shell.store.get().datasets.find((d) => d.id === meta.id), 5000, 'dataset in store');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      const choice = /** @type {any} */ (await waitFor(() => Array.from(root.querySelectorAll('dm-select')).find((s) => s.getAttribute('aria-label') === t('map.basemap')), 10000, 'the background map choice'));
      assert.equal(choice.value, 'none', 'no background map until one is chosen');
      choice.value = 'osm';
      choice.dispatchEvent(new Event('change'));
      // The question names the purpose and the host; saying no fetches nothing and the map says so.
      const question = await waitFor(() => document.querySelector('dialog[open] [data-consent-dialog="basemaps"]'), 5000, 'the question');
      assert.ok(question.textContent.includes(t('consent.purpose.basemaps')), question.textContent);
      assert.ok(question.textContent.includes('tile.openstreetmap.org'), question.textContent);
      const dialog = /** @type {HTMLElement} */ (question.closest('dialog'));
      const deny = Array.from(dialog.querySelectorAll('dm-button')).find((b) => b.textContent.trim() === t('consent.deny'));
      /** @type {HTMLElement} */ (deny.querySelector('button')).click();
      await waitFor(() => Array.from(document.querySelectorAll('.dm-toast')).some((el) => el.textContent.includes(t('map.basemap.denied'))), 5000, 'the note that the map has no background');
      assert.equal(await consent.state('basemaps'), 'denied', 'the answer remembered');
      // Hantera, Arbetsyta, Internetåtkomst: the answer shown and changed back to ask.
      shell.activate('hantera');
      shell.store.set({ selectedId: '__workspace' });
      const sel = /** @type {any} */ (await waitFor(() => root.querySelector('[data-settings="network"] dm-select[data-consent="basemaps"]'), 10000, 'the Internet access card'));
      assert.equal(sel.value, 'denied');
      sel.value = 'ask';
      sel.dispatchEvent(new Event('change'));
      await waitFor(async () => (await consent.state('basemaps')) === null, 5000, 'the answer cleared');
      return 'ok';
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      await consent.set('basemaps', before).catch(() => {});
      if (meta) await datasets.remove(meta.id).catch(() => {});
      root.remove();
    }
  }, 60000);

  test('plan files: the plan view shows the plan\'s decision, a provision\'s height and content without a place', async (assert) => {
    const t = D.require('ui/i18n').t;
    const fmt = D.require('ui/i18n').formatNumber;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function waitFor(fn, timeoutMs = 5000, label = 'condition') {
      const t0 = performance.now();
      for (;;) { const v = fn(); if (v) return v; if (performance.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + label); await wait(50); }
    }
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute; left:-10000px; width:1400px; height:900px;';
    document.body.appendChild(root);
    let meta = null; let opMeta = null;
    try {
      history.replaceState(null, '', location.pathname + location.search);
      const shell = await D.require('app').start(root);
      meta = await importer.run(new File([JSON.stringify(DP41)], 'strandkvarteret.json', { type: 'application/json' }), {}, null, null);
      await waitFor(() => shell.store.get().datasets.find((d) => d.id === meta.id), 5000, 'dataset in store');
      shell.activate('bearbeta');
      shell.store.set({ selectedId: meta.id });
      const right = () => /** @type {HTMLElement} */ (root.querySelector('.dm-right'));
      await waitFor(() => right() && right().textContent.includes('KS 2025/77'), 10000, 'the decision in the inspector');
      assert.ok(right().textContent.includes('2026-08-25'), 'the adoption date');
      assert.ok(right().textContent.includes('Planbeskrivning Strandkvarteret'), 'the plan description');
      const item = /** @type {HTMLElement} */ (await waitFor(() => Array.from(root.querySelectorAll('.dm-right .dm-plan-provisions li')).find((li) => li.textContent.includes('Högsta nockhöjd')), 5000, 'the provision in the list'));
      item.click();
      await waitFor(() => right().textContent.includes(t('plan.field.hojd')), 5000, 'the height');
      const expected = t('plan.height.lower', { h: `${fmt(4.5)} m` });
      assert.ok(right().textContent.includes(expected), `"${expected}" in the inspector`);
      opMeta = await importer.run(new File([JSON.stringify(OP20)], 'op-lidkoping.json', { type: 'application/json' }), {}, null, null);
      await waitFor(() => shell.store.get().datasets.find((d) => d.id === opMeta.id), 5000, 'the ÖP in store');
      shell.store.set({ selectedId: opMeta.id });
      const unplaced = await waitFor(() => root.querySelector('.dm-right [data-plan-unplaced]'), 10000, 'content without a place');
      assert.ok(unplaced.textContent.includes(t('plan.unplaced.one')), unplaced.textContent);
      /** @type {HTMLElement} */ (unplaced.querySelector('summary')).click();
      /** @type {HTMLElement} */ (unplaced.querySelector('li')).click();
      await waitFor(() => right().textContent.includes('Riktlinjer för bostadsförsörjningen') && right().textContent.includes(t('plan.field.innehallstyp')), 5000, 'the content\'s facts');
      return 'ok';
    } finally {
      for (const el of Array.from(document.querySelectorAll('dialog[open]'))) /** @type {any} */ (el).close();
      if (meta) await datasets.remove(meta.id).catch(() => {});
      if (opMeta) await datasets.remove(opMeta.id).catch(() => {});
      root.remove();
    }
  }, 120000);
})();
