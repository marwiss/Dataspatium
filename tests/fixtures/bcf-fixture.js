// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Hand-written BCF files for the tests, written from buildingSMART's BCF-XML documentation (3.0 and 2.1) as another program would
 * write them: `v30` a BCF 3.0 file with two topics, comments, two viewpoints with snapshots, selected, hidden and coloured components,
 * lines, clipping planes, a bitmap, a document in the file and extensions.xml; `v21` a BCF 2.1 file with comments and viewpoints
 * beside the topic, repeated labels and links, colours straight under Color, a document by path and a camera without an aspect
 * ratio; `older` the form the app wrote before it followed 3.0 (comments and viewpoints in lists beside the topic), and a topic with
 * one viewpoint by its fixed name and 2.0's flat component list. Each entry is XML text, or `{base64}` for bytes. Invented content,
 * no personal data (the addresses are example.org).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('tests/fixtures/bcf', [], () => {
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const PDF = btoa('%PDF-1.4\n% a test document\n%%EOF\n');
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const pt = (name, x, y, z) => `<${name}><X>${x}</X><Y>${y}</Y><Z>${z}</Z></${name}>`;
    const G = {
      project: 'b4f2d0a1-5c3e-4e7a-9f10-2a6b8c4d1e01',
      topicA: 'a1b2c3d4-1111-4aaa-8bbb-000000000001', topicB: 'a1b2c3d4-1111-4aaa-8bbb-000000000002',
      vp1: 'a1b2c3d4-2222-4aaa-8bbb-000000000001', vp2: 'a1b2c3d4-2222-4aaa-8bbb-000000000002',
      c1: 'a1b2c3d4-3333-4aaa-8bbb-000000000001', c2: 'a1b2c3d4-3333-4aaa-8bbb-000000000002',
      doc: 'a1b2c3d4-4444-4aaa-8bbb-000000000001', ref1: 'a1b2c3d4-5555-4aaa-8bbb-000000000001', ref2: 'a1b2c3d4-5555-4aaa-8bbb-000000000002',
      topic21: 'B7C8D9E0-6666-4AAA-8BBB-000000000001', vp21a: 'b7c8d9e0-7777-4aaa-8bbb-000000000001', vp21b: 'b7c8d9e0-7777-4aaa-8bbb-000000000002',
      c21a: 'b7c8d9e0-8888-4aaa-8bbb-000000000001', c21b: 'b7c8d9e0-8888-4aaa-8bbb-000000000002',
      ref21a: 'b7c8d9e0-9999-4aaa-8bbb-000000000001', ref21b: 'b7c8d9e0-9999-4aaa-8bbb-000000000002', related21: 'b7c8d9e0-6666-4aaa-8bbb-000000000002',
      oldTopic: 'c9d8e7f6-1111-4aaa-8bbb-000000000001', oldVp: 'c9d8e7f6-2222-4aaa-8bbb-000000000001', oldComment: 'c9d8e7f6-3333-4aaa-8bbb-000000000001',
      oneTopic: 'c9d8e7f6-1111-4aaa-8bbb-000000000002', oneVp: 'c9d8e7f6-2222-4aaa-8bbb-000000000002',
    };
    /** IFC GlobalIds of the elements, and the IfcProject. */
    const IFC = { door: '2O2Fr$t4X7Zf8NOew3FLOH', wall: '1hOSvn6df7F8_7GcBWlRGQ', slab: '0M6o6q$rP2bwkTYtEOm1Hk', pipe: '3vB2YO$MX4xv5uCqZZG05x', project: '0YvctVUKr0kugbFTf53O9L' };

    const v30 = {
      'bcf.version': `${X}<Version VersionId="3.0"/>\n`,
      'extensions.xml': `${X}<Extensions>
  <TopicTypes><TopicType>Issue</TopicType><TopicType>Request</TopicType></TopicTypes>
  <TopicStatuses><TopicStatus>Open</TopicStatus><TopicStatus>In progress</TopicStatus><TopicStatus>Closed</TopicStatus></TopicStatuses>
  <Priorities><Priority>Low</Priority><Priority>High</Priority></Priorities>
  <TopicLabels><TopicLabel>Architecture</TopicLabel><TopicLabel>Accessibility</TopicLabel></TopicLabels>
  <Users><User>reviewer@example.org</User><User>designer@example.org</User></Users>
  <Stages><Stage>Design</Stage></Stages>
</Extensions>\n`,
      'project.bcfp': `${X}<ProjectInfo><Project ProjectId="${G.project}"><Name>House A</Name></Project></ProjectInfo>\n`,
      'documents.xml': `${X}<DocumentInfo><Documents><Document Guid="${G.doc}"><Filename>measurements.pdf</Filename><Description>Measured on site</Description></Document></Documents></DocumentInfo>\n`,
      [`Documents/${G.doc}`]: { base64: PDF },
      [`${G.topicA}/markup.bcf`]: `${X}<Markup>
  <Header>
    <Files>
      <File IfcProject="${IFC.project}" IsExternal="true">
        <Filename>house-a-architecture.ifc</Filename>
        <Date>2026-10-30T14:02:11+01:00</Date>
        <Reference>https://cde.example.org/files/house-a-architecture.ifc</Reference>
      </File>
    </Files>
  </Header>
  <Topic Guid="${G.topicA}" ServerAssignedId="GR-17" TopicType="Issue" TopicStatus="In progress">
    <ReferenceLinks><ReferenceLink>https://cde.example.org/issues/GR-17</ReferenceLink></ReferenceLinks>
    <Title>The door is too narrow</Title>
    <Priority>High</Priority>
    <Labels><Label>Architecture</Label><Label>Accessibility</Label></Labels>
    <CreationDate>2026-11-02T09:00:00Z</CreationDate>
    <CreationAuthor>reviewer@example.org</CreationAuthor>
    <ModifiedDate>2026-11-03T10:30:00Z</ModifiedDate>
    <ModifiedAuthor>designer@example.org</ModifiedAuthor>
    <DueDate>2026-11-20T00:00:00Z</DueDate>
    <AssignedTo>designer@example.org</AssignedTo>
    <Stage>Design</Stage>
    <Description>The clear width of the opening is 760 mm &amp; less than asked for.</Description>
    <DocumentReferences>
      <DocumentReference Guid="${G.ref1}"><DocumentGuid>${G.doc}</DocumentGuid><Description>Measured on site</Description></DocumentReference>
      <DocumentReference Guid="${G.ref2}"><Url>https://example.org/requirements.pdf</Url><Description>Requirements</Description></DocumentReference>
    </DocumentReferences>
    <RelatedTopics><RelatedTopic Guid="${G.topicB}"/></RelatedTopics>
    <Comments>
      <Comment Guid="${G.c1}"><Date>2026-11-02T09:00:00Z</Date><Author>reviewer@example.org</Author><Comment>See the viewpoint.</Comment><Viewpoint Guid="${G.vp1}"/></Comment>
      <Comment Guid="${G.c2}"><Date>2026-11-03T10:30:00Z</Date><Author>designer@example.org</Author><Comment>A wider door is coming.</Comment></Comment>
    </Comments>
    <Viewpoints>
      <ViewPoint Guid="${G.vp1}"><Viewpoint>view-1.bcfv</Viewpoint><Snapshot>picture-1.png</Snapshot><Index>0</Index></ViewPoint>
      <ViewPoint Guid="${G.vp2}"><Viewpoint>view-2.bcfv</Viewpoint><Snapshot>picture-2.jpg</Snapshot><Index>1</Index></ViewPoint>
    </Viewpoints>
  </Topic>
</Markup>\n`,
      [`${G.topicA}/view-1.bcfv`]: `${X}<VisualizationInfo Guid="${G.vp1}">
  <Components>
    <Selection>
      <Component IfcGuid="${IFC.door}"><OriginatingSystem>OtherTool 7</OriginatingSystem><AuthoringToolId>4711</AuthoringToolId></Component>
      <Component IfcGuid="${IFC.wall}"/>
    </Selection>
    <Visibility DefaultVisibility="true">
      <ViewSetupHints SpacesVisible="false" SpaceBoundariesVisible="false" OpeningsVisible="true"/>
      <Exceptions><Component IfcGuid="${IFC.slab}"/></Exceptions>
    </Visibility>
    <Coloring>
      <Color Color="FFFF0000"><Components><Component IfcGuid="${IFC.door}"/></Components></Color>
    </Coloring>
  </Components>
  <PerspectiveCamera>
    ${pt('CameraViewPoint', 12.5, -4, 3.2)}
    ${pt('CameraDirection', -0.8, 0.6, 0)}
    ${pt('CameraUpVector', 0, 0, 1)}
    <FieldOfView>55</FieldOfView>
    <AspectRatio>1.7777777777777777</AspectRatio>
  </PerspectiveCamera>
  <Lines><Line>${pt('StartPoint', 1, 2, 0)}${pt('EndPoint', 1, 2, 2.1)}</Line></Lines>
  <ClippingPlanes><ClippingPlane>${pt('Location', 0, 0, 2.5)}${pt('Direction', 0, 0, 1)}</ClippingPlane></ClippingPlanes>
  <Bitmaps><Bitmap><Format>png</Format><Reference>sign.png</Reference>${pt('Location', 1, 2, 1)}${pt('Normal', 0, -1, 0)}${pt('Up', 0, 0, 1)}<Height>0.5</Height></Bitmap></Bitmaps>
</VisualizationInfo>\n`,
      [`${G.topicA}/picture-1.png`]: { base64: PNG },
      [`${G.topicA}/sign.png`]: { base64: PNG },
      [`${G.topicA}/view-2.bcfv`]: `${X}<VisualizationInfo Guid="${G.vp2}">
  <Components>
    <Visibility>
      <Exceptions><Component IfcGuid="${IFC.door}"/><Component IfcGuid="${IFC.wall}"/></Exceptions>
    </Visibility>
  </Components>
  <OrthogonalCamera>
    ${pt('CameraViewPoint', 5, 5, 30)}
    ${pt('CameraDirection', 0, 0, -1)}
    ${pt('CameraUpVector', 0, 1, 0)}
    <ViewToWorldScale>14.5</ViewToWorldScale>
    <AspectRatio>1.5</AspectRatio>
  </OrthogonalCamera>
</VisualizationInfo>\n`,
      [`${G.topicA}/picture-2.jpg`]: { base64: JPEG },
      [`${G.topicB}/markup.bcf`]: `${X}<Markup>
  <Topic Guid="${G.topicB}" TopicType="Request" TopicStatus="Open">
    <Title>Show the door schedule</Title>
    <CreationDate>2026-11-02T09:05:00Z</CreationDate>
    <CreationAuthor>reviewer@example.org</CreationAuthor>
  </Topic>
</Markup>\n`,
    };

    const v21 = {
      'bcf.version': `${X}<Version VersionId="2.1" xsi:noNamespaceSchemaLocation="version.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><DetailedVersion>2.1</DetailedVersion></Version>\n`,
      'project.bcfp': `${X}<ProjectExtension><Project ProjectId="${G.project}"><Name>House B</Name></Project><ExtensionSchema>extensions.xsd</ExtensionSchema></ProjectExtension>\n`,
      'Documents/section.pdf': { base64: PDF },
      [`${G.topic21.toLowerCase()}/markup.bcf`]: `${X}<Markup>
  <Header>
    <File IfcProject="${IFC.project}" isExternal="true"><Filename>house-b-services.ifc</Filename><Date>2026-10-01T08:00:00</Date><Reference>https://cde.example.org/files/house-b-services.ifc</Reference></File>
  </Header>
  <Topic Guid="${G.topic21}" TopicType="Clash" TopicStatus="Active">
    <ReferenceLink>https://cde.example.org/issues/77</ReferenceLink>
    <ReferenceLink>https://cde.example.org/issues/78</ReferenceLink>
    <Title>A pipe runs through the beam</Title>
    <Priority>Critical</Priority>
    <Index>3</Index>
    <Labels>Structural</Labels>
    <Labels>Services</Labels>
    <CreationDate>2026-10-02T08:00:00Z</CreationDate>
    <CreationAuthor>coordinator@example.org</CreationAuthor>
    <ModifiedDate>2026-10-03T08:00:00Z</ModifiedDate>
    <ModifiedAuthor>services@example.org</ModifiedAuthor>
    <DueDate>2026-10-15T00:00:00Z</DueDate>
    <AssignedTo>services@example.org</AssignedTo>
    <Stage>Construction</Stage>
    <Description>The pipe needs a sleeve or a new route.</Description>
    <DocumentReference Guid="${G.ref21a}" isExternal="false"><ReferencedDocument>../Documents/section.pdf</ReferencedDocument><Description>Section</Description></DocumentReference>
    <DocumentReference Guid="${G.ref21b}" isExternal="true"><ReferencedDocument>https://example.org/standard.html</ReferencedDocument></DocumentReference>
    <RelatedTopic Guid="${G.related21}"/>
  </Topic>
  <Comment Guid="${G.c21a}"><Date>2026-10-02T08:00:00Z</Date><Author>coordinator@example.org</Author><Comment>Found by the clash run.</Comment><Viewpoint Guid="${G.vp21a}"/></Comment>
  <Comment Guid="${G.c21b}"><Date>2026-10-03T08:00:00Z</Date><Author>services@example.org</Author><Comment>We move the pipe.</Comment></Comment>
  <Viewpoints Guid="${G.vp21a}"><Viewpoint>viewpoint.bcfv</Viewpoint><Snapshot>snapshot.png</Snapshot></Viewpoints>
  <Viewpoints Guid="${G.vp21b}"><Viewpoint>plan.bcfv</Viewpoint><Snapshot>plan.png</Snapshot><Index>1</Index></Viewpoints>
</Markup>\n`,
      [`${G.topic21.toLowerCase()}/viewpoint.bcfv`]: `${X}<VisualizationInfo Guid="${G.vp21a}">
  <Components>
    <ViewSetupHints SpacesVisible="false" SpaceBoundariesVisible="false" OpeningsVisible="false"/>
    <Selection><Component IfcGuid="${IFC.pipe}"><OriginatingSystem>Older Tool 2019</OriginatingSystem><AuthoringToolId>99</AuthoringToolId></Component></Selection>
    <Visibility DefaultVisibility="true"><Exceptions><Component IfcGuid="${IFC.slab}"/></Exceptions></Visibility>
    <Coloring><Color Color="FF00FF00"><Component IfcGuid="${IFC.pipe}"/><Component IfcGuid="${IFC.wall}"/></Color></Coloring>
  </Components>
  <PerspectiveCamera>
    ${pt('CameraViewPoint', 20, -10, 8)}
    ${pt('CameraDirection', -0.7, 0.7, -0.2)}
    ${pt('CameraUpVector', 0, 0, 1)}
    <FieldOfView>60</FieldOfView>
  </PerspectiveCamera>
  <ClippingPlanes><ClippingPlane>${pt('Location', 0, 0, 4)}${pt('Direction', 0, 0, 1)}</ClippingPlane></ClippingPlanes>
</VisualizationInfo>\n`,
      [`${G.topic21.toLowerCase()}/snapshot.png`]: { base64: PNG },
      [`${G.topic21.toLowerCase()}/plan.bcfv`]: `${X}<VisualizationInfo Guid="${G.vp21b}">
  <Components><Visibility DefaultVisibility="true"/></Components>
  <OrthogonalCamera>
    ${pt('CameraViewPoint', 0, 0, 50)}
    ${pt('CameraDirection', 0, 0, -1)}
    ${pt('CameraUpVector', 0, 1, 0)}
    <ViewToWorldScale>40</ViewToWorldScale>
  </OrthogonalCamera>
</VisualizationInfo>\n`,
      [`${G.topic21.toLowerCase()}/plan.png`]: { base64: PNG },
    };

    const older = {
      'bcf.version': `${X}<Version VersionId="3.0"/>\n`,
      'project.bcfp': `${X}<ProjectInfo><Project ProjectId="${G.project}"><Name>Earlier export</Name></Project></ProjectInfo>\n`,
      [`${G.oldTopic}/markup.bcf`]: `${X}<Markup><Header><Files><File IfcProject="${IFC.project}" IsExternal="true"><Filename>house.ifc</Filename><Date>2026-09-01T10:00:00.000Z</Date></File></Files></Header><Topic Guid="${G.oldTopic}" TopicType="Inspection" TopicStatus="Open"><ReferenceLink>https://example.org/a</ReferenceLink><Title>Crack in the render</Title><Priority>High</Priority><Index>0</Index><Labels>Facade</Labels><Labels>Damage</Labels><CreationDate>2026-09-01T10:00:00.000Z</CreationDate><Description>Seen on the south side.</Description><DocumentReference Guid="${G.ref1}"><Url>https://example.org/photo.jpg</Url></DocumentReference></Topic><Comments><Comment Guid="${G.oldComment}"><Date>2026-09-01T10:00:00.000Z</Date><Comment>Photographed.</Comment><Viewpoint Guid="${G.oldVp}"/></Comment></Comments><Viewpoints><ViewPoint Guid="${G.oldVp}"><Viewpoint>viewpoint.bcfv</Viewpoint><Snapshot>snapshot.jpg</Snapshot><Index>0</Index></ViewPoint></Viewpoints></Markup>\n`,
      [`${G.oldTopic}/viewpoint.bcfv`]: `${X}<VisualizationInfo Guid="${G.oldVp}"><Components><Selection><Component IfcGuid="${IFC.wall}"><OriginatingSystem>Dataspatium</OriginatingSystem></Component></Selection><Visibility DefaultVisibility="true"></Visibility><Coloring><Color Color="C0392B"><Component IfcGuid="${IFC.wall}"></Component></Color></Coloring></Components><PerspectiveCamera>${pt('CameraViewPoint', 3, -3, 2)}${pt('CameraDirection', -0.577, 0.577, -0.577)}${pt('CameraUpVector', -0.408, 0.408, 0.816)}<FieldOfView>60</FieldOfView><AspectRatio>1.6</AspectRatio></PerspectiveCamera></VisualizationInfo>\n`,
      [`${G.oldTopic}/snapshot.jpg`]: { base64: JPEG },
      // Before BCF 2.0: one viewpoint by its fixed name, not listed in the markup, with every component in one list.
      [`${G.oneTopic}/markup.bcf`]: `${X}<Markup><Topic Guid="${G.oneTopic}"><Title>Old single view</Title><CreationDate>2015-02-18T09:12:00Z</CreationDate><CreationAuthor>someone@example.org</CreationAuthor></Topic></Markup>\n`,
      [`${G.oneTopic}/viewpoint.bcfv`]: `${X}<VisualizationInfo Guid="${G.oneVp}"><Components><Component IfcGuid="${IFC.door}" Selected="true" Visible="true" Color="FF0000"/><Component IfcGuid="${IFC.slab}" Selected="false" Visible="false"/></Components><PerspectiveCamera>${pt('CameraViewPoint', 0, -10, 2)}${pt('CameraDirection', 0, 1, 0)}${pt('CameraUpVector', 0, 0, 1)}<FieldOfView>45</FieldOfView></PerspectiveCamera></VisualizationInfo>\n`,
      [`${G.oneTopic}/snapshot.png`]: { base64: PNG },
    };

    /** The entries as bytes, for platform/storage/zip. @param {Record<string, string|{base64: string}>} files */
    function bytesOf(files) {
      const out = {};
      for (const [name, v] of Object.entries(files)) out[name] = typeof v === 'string' ? new TextEncoder().encode(v) : Uint8Array.from(atob(v.base64), (c) => c.charCodeAt(0));
      return out;
    }
    return { v30, v21, older, bytesOf, G, IFC, PNG, JPEG };
  });
})();
