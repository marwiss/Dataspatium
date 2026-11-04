// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Own test data for the CAD and BIM tests: a small IFC4 building written by hand (millimetres; two storeys, walls of
 * 4000 × 200 × 2500 mm, a slab, a door without geometry, a type, property sets, quantities, materials and a
 * classification) and a small DXF drawing (R12-style sections with lines, a polyline, a circle, an arc, a text and a
 * block). Nothing here comes from a real project.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('tests/fixtures/ifc', [], () => {
    const guid = (n) => ('0Dataspatium' + String(n).padStart(10, '0')).slice(0, 22);

    /** The IFC text. @param {{walls?: number, name?: string}} [options] walls per storey (at least 2) */
    function ifcText(options = {}) {
      const walls = Math.max(2, options.walls || 2);
      const lines = [];
      let next = 1000;
      const add = (text) => { const id = next++; lines.push(`#${id}=${text};`); return id; };
      const head = ["ISO-10303-21;", "HEADER;", "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');",
        `FILE_NAME('${options.name || 'testhus.ifc'}','2026-11-04T12:00:00',('Testare'),('Testbolaget'),'Testverktyg','Testprogram 1.0','');`,
        "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;'];
      const person = add("IFCPERSON($,'Testare',$,$,$,$,$,$)");
      const org = add("IFCORGANIZATION($,'Testbolaget',$,$,$)");
      const po = add(`IFCPERSONANDORGANIZATION(#${person},#${org},$)`);
      const app = add(`IFCAPPLICATION(#${org},'1.0','Testprogram','TP')`);
      const owner = add(`IFCOWNERHISTORY(#${po},#${app},$,.ADDED.,$,$,$,1320688800)`);
      const units = add(`IFCUNITASSIGNMENT((#${add('IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)')},#${add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)')},#${add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)')},#${add('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)')}))`);
      const origin = add('IFCCARTESIANPOINT((0.,0.,0.))');
      const zDir = add('IFCDIRECTION((0.,0.,1.))');
      const xDir = add('IFCDIRECTION((1.,0.,0.))');
      const world = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zDir},#${xDir})`);
      const context = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${world},$)`);
      const body = add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${context},$,.MODEL_VIEW.,$)`);
      let g = 1;
      const G = () => guid(g++);
      const project = add(`IFCPROJECT('${G()}',#${owner},'Testprojekt',$,$,$,$,(#${context}),#${units})`);
      const placeAt = (x, y, z, parent) => {
        const p = add(`IFCAXIS2PLACEMENT3D(#${add(`IFCCARTESIANPOINT((${x}.,${y}.,${z}.))`)},#${zDir},#${xDir})`);
        return add(`IFCLOCALPLACEMENT(${parent ? '#' + parent : '$'},#${p})`);
      };
      const sitePl = placeAt(0, 0, 0, null);
      const site = add(`IFCSITE('${G()}',#${owner},'Tomten',$,$,#${sitePl},$,$,.ELEMENT.,$,$,$,$,$)`);
      const buildingPl = placeAt(0, 0, 0, sitePl);
      const building = add(`IFCBUILDING('${G()}',#${owner},'Testhuset',$,$,#${buildingPl},$,$,.ELEMENT.,$,$,$)`);
      add(`IFCRELAGGREGATES('${G()}',#${owner},$,$,#${project},(#${site}))`);
      add(`IFCRELAGGREGATES('${G()}',#${owner},$,$,#${site},(#${building}))`);
      const storeyPl = [placeAt(0, 0, 0, buildingPl), placeAt(0, 0, 3000, buildingPl)];
      const storeys = [add(`IFCBUILDINGSTOREY('${G()}',#${owner},'Plan 1',$,$,#${storeyPl[0]},$,$,.ELEMENT.,0.)`), add(`IFCBUILDINGSTOREY('${G()}',#${owner},'Plan 2',$,$,#${storeyPl[1]},$,$,.ELEMENT.,3000.)`)];
      add(`IFCRELAGGREGATES('${G()}',#${owner},$,$,#${building},(#${storeys[0]},#${storeys[1]}))`);
      const solid = (xDim, yDim, depth) => {
        const p2d = add(`IFCAXIS2PLACEMENT2D(#${add('IFCCARTESIANPOINT((0.,0.))')},#${add('IFCDIRECTION((1.,0.))')})`);
        const profile = add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${p2d},${xDim}.,${yDim}.)`);
        return add(`IFCEXTRUDEDAREASOLID(#${profile},#${world},#${zDir},${depth}.)`);
      };
      const shapeOf = (s) => add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${add(`IFCSHAPEREPRESENTATION(#${body},'Body','SweptSolid',(#${s}))`)}))`);
      const colored = (s, r, gr, b) => {
        const rgb = add(`IFCCOLOURRGB($,${r},${gr},${b})`);
        const rendering = add(`IFCSURFACESTYLERENDERING(#${rgb},0.,$,$,$,$,$,$,.NOTDEFINED.)`);
        const style = add(`IFCSURFACESTYLE($,.BOTH.,(#${rendering}))`);
        add(`IFCSTYLEDITEM(#${s},(#${style}),$)`);
      };
      // The wall type carries a property set that its walls inherit.
      const typePset = add(`IFCPROPERTYSET('${G()}',#${owner},'Typens egenskaper',$,(#${add("IFCPROPERTYSINGLEVALUE('Tillverkare',$,IFCLABEL('Testfabriken'),$)")}))`);
      const wallType = add(`IFCWALLTYPE('${G()}',#${owner},'Yttervägg 200',$,$,(#${typePset}),$,$,$,.STANDARD.)`);
      const material = add("IFCMATERIAL('Betong',$,$)");
      const insulation = add("IFCMATERIAL('Mineralull',$,$)");
      const layers = add(`IFCMATERIALLAYERSET((#${add(`IFCMATERIALLAYER(#${material},150.,$,$,$,$,$)`)},#${add(`IFCMATERIALLAYER(#${insulation},50.,$,$,$,$,$)`)}),'Vägg 200',$)`);
      const usage = add(`IFCMATERIALLAYERSETUSAGE(#${layers},.AXIS2.,.POSITIVE.,0.,$)`);
      const code = add("IFCCLASSIFICATIONREFERENCE($,'B123',\"Bärande vägg\",$,$,$)".replace(/"/g, "'"));
      const allWalls = [];
      storeys.forEach((storey, si) => {
        const contained = [];
        for (let w = 0; w < walls; w++) {
          const s = solid(4000, 200, 2500);
          if (w === 0) colored(s, 0.8, 0.2, 0.2);
          const wall = add(`IFCWALL('${G()}',#${owner},'Vägg ${si + 1}.${w + 1}',\$,'Yttervägg',#${placeAt(w * 5000, 0, 0, storeyPl[si])},#${shapeOf(s)},'V${si + 1}${w + 1}',.SOLIDWALL.)`);
          contained.push(wall); allWalls.push(wall);
          const pset = add(`IFCPROPERTYSET('${G()}',#${owner},'Pset_WallCommon',$,(#${add(`IFCPROPERTYSINGLEVALUE('LoadBearing',$,IFCBOOLEAN(.T.),$)`)},#${add(`IFCPROPERTYSINGLEVALUE('FireRating',$,IFCLABEL('EI60'),$)`)},#${add(`IFCPROPERTYSINGLEVALUE('ThermalTransmittance',$,IFCTHERMALTRANSMITTANCEMEASURE(0.17),$)`)}))`);
          add(`IFCRELDEFINESBYPROPERTIES('${G()}',#${owner},$,$,(#${wall}),#${pset})`);
          const qto = add(`IFCELEMENTQUANTITY('${G()}',#${owner},'Qto_WallBaseQuantities',$,$,(#${add("IFCQUANTITYLENGTH('Length',$,$,4000.,$)")},#${add("IFCQUANTITYAREA('NetSideArea',$,$,10.,$)")},#${add("IFCQUANTITYVOLUME('NetVolume',$,$,2.,$)")}))`);
          add(`IFCRELDEFINESBYPROPERTIES('${G()}',#${owner},$,$,(#${wall}),#${qto})`);
        }
        if (si === 0) {
          const slab = add(`IFCSLAB('${G()}',#${owner},'Bjälklag ÅÄÖ','En \\X2\\00E4\\X0\\kta platta',$,#${placeAt(0, 2000, -300, storeyPl[0])},#${shapeOf(solid(6000, 3000, 300))},'B1',.FLOOR.)`);
          contained.push(slab);
          add(`IFCRELASSOCIATESMATERIAL('${G()}',#${owner},$,$,(#${slab}),#${material})`);
          const door = add(`IFCDOOR('${G()}',#${owner},'Dörr 1',$,$,#${placeAt(0, 0, 0, storeyPl[0])},$,'D1',2100.,900.,.DOOR.,$,$)`);
          contained.push(door);
          add(`IFCRELASSOCIATESCLASSIFICATION('${G()}',#${owner},$,$,(#${door}),#${code})`);
        }
        add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${G()}',#${owner},$,$,(${contained.map((c) => '#' + c).join(',')}),#${storey})`);
      });
      add(`IFCRELDEFINESBYTYPE('${G()}',#${owner},$,$,(${allWalls.map((c) => '#' + c).join(',')}),#${wallType})`);
      add(`IFCRELASSOCIATESMATERIAL('${G()}',#${owner},$,$,(${allWalls.map((c) => '#' + c).join(',')}),#${usage})`);
      return head.concat(lines, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n') + '\n';
    }
    function ifcFile(options = {}) { return new File([ifcText(options)], options.name || 'testhus.ifc', { type: 'application/octet-stream' }); }

    /** A small DXF drawing. */
    function dxfText() {
      const pairs = (...rows) => rows.flat().join('\n');
      const line = (layer, x1, y1, x2, y2) => pairs(['0', 'LINE', '8', layer, '10', x1, '20', y1, '11', x2, '21', y2]);
      const entities = [
        line('Väggar', 0, 0, 10, 0), line('Väggar', 10, 0, 10, 5),
        pairs(['0', 'LWPOLYLINE', '8', 'Rum', '90', 4, '70', 1, '10', 1, '20', 1, '10', 4, '20', 1, '10', 4, '20', 3, '10', 1, '20', 3]),
        pairs(['0', 'CIRCLE', '8', 'Rum', '10', 7, '20', 2, '40', 1]),
        pairs(['0', 'ARC', '8', 'Dorrar', '10', 2, '20', 2, '40', 1, '50', 0, '51', 90]),
        pairs(['0', 'TEXT', '8', 'Text', '10', 1, '20', 4, '40', 0.5, '1', 'Kök & <hall>']),
        pairs(['0', 'INSERT', '8', 'Inredning', '2', 'BORD', '10', 5, '20', 1, '41', 2, '42', 2, '50', 0]),
      ];
      return pairs(['0', 'SECTION', '2', 'TABLES'], ['0', 'TABLE', '2', 'LAYER', '70', 5],
        ...['Väggar', 'Rum', 'Dorrar', 'Text', 'Inredning'].map((n, i) => ['0', 'LAYER', '2', n, '70', 0, '62', i + 1, '6', 'CONTINUOUS']),
        ['0', 'ENDTAB', '0', 'ENDSEC'],
        ['0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '2', 'BORD', '8', '0', '70', 0, '10', 0, '20', 0, '3', 'BORD'],
        [line('0', 0, 0, 1, 0)], [line('0', 1, 0, 1, 1)], ['0', 'ENDBLK', '0', 'ENDSEC'],
        ['0', 'SECTION', '2', 'ENTITIES'], entities, ['0', 'ENDSEC', '0', 'EOF']) + '\n';
    }
    function dxfFile() { return new File([dxfText()], 'testritning.dxf', { type: 'application/octet-stream' }); }

    return { ifcText, ifcFile, dxfText, dxfFile };
  });
})();
