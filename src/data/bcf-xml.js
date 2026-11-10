// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * BCF-XML 3.0, the file form of BCF (a ZIP, .bcf or .bcfzip): one folder per topic with markup.bcf, the viewpoints as .bcfv
 * and their snapshots. Written from the same objects the BCF API gives, read back into the same shape, so that issues move
 * between the server, the app's tables and clients without an API. Everything written is escaped; everything read is text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/bcf-xml', ['platform/storage/zip', 'platform/text'], (zip, text) => {
    const esc = text.escapeHtml;
    const tag = (name, value) => (value === null || value === undefined || value === '' ? '' : `<${name}>${esc(value)}</${name}>`);
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '0');
    const point = (name, p) => `<${name}>${tag('X', num(p && p.x))}${tag('Y', num(p && p.y))}${tag('Z', num(p && p.z))}</${name}>`;
    const encode = (s) => new TextEncoder().encode(s);
    const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
    const newGuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }));

    /**
     * The viewpoint file of one viewpoint, from the API's shape (camera, components, snapshot left out here).
     * @param {any} vp @returns {string}
     */
    function viewpointXml(vp) {
      const c = vp.components || {};
      const list = (items) => (items || []).map((x) => `<Component IfcGuid="${esc(x.ifc_guid || '')}">${tag('OriginatingSystem', x.originating_system)}${tag('AuthoringToolId', x.authoring_tool_id)}</Component>`).join('');
      const vis = c.visibility || { default_visibility: true };
      const components = `<Components>${c.selection && c.selection.length ? `<Selection>${list(c.selection)}</Selection>` : ''}<Visibility DefaultVisibility="${vis.default_visibility === false ? 'false' : 'true'}">${vis.exceptions && vis.exceptions.length ? `<Exceptions>${list(vis.exceptions)}</Exceptions>` : ''}</Visibility>${c.coloring && c.coloring.length ? `<Coloring>${c.coloring.map((g) => `<Color Color="${esc(g.color)}">${list(g.components)}</Color>`).join('')}</Coloring>` : ''}</Components>`;
      const pc = vp.perspective_camera; const oc = vp.orthogonal_camera;
      const camera = pc ? `<PerspectiveCamera>${point('CameraViewPoint', pc.camera_view_point)}${point('CameraDirection', pc.camera_direction)}${point('CameraUpVector', pc.camera_up_vector)}${tag('FieldOfView', num(pc.field_of_view))}${tag('AspectRatio', num(pc.aspect_ratio || 1))}</PerspectiveCamera>`
        : oc ? `<OrthogonalCamera>${point('CameraViewPoint', oc.camera_view_point)}${point('CameraDirection', oc.camera_direction)}${point('CameraUpVector', oc.camera_up_vector)}${tag('ViewToWorldScale', num(oc.view_to_world_scale))}${tag('AspectRatio', num(oc.aspect_ratio || 1))}</OrthogonalCamera>` : '';
      const planes = Array.isArray(vp.clipping_planes) && vp.clipping_planes.length
        ? `<ClippingPlanes>${vp.clipping_planes.map((c) => `<ClippingPlane>${point('Location', c.location)}${point('Direction', c.direction)}</ClippingPlane>`).join('')}</ClippingPlanes>` : '';
      return `<?xml version="1.0" encoding="UTF-8"?>\n<VisualizationInfo Guid="${esc(vp.guid)}">${components}${camera}${planes}</VisualizationInfo>\n`;
    }
    /**
     * The markup of one topic with its comments and the names of its viewpoint files.
     * @param {any} topic @param {any[]} comments @param {Array<{guid: string, file: string, snapshot: string|null, index: number}>} viewpoints
     */
    function markupXml(topic, comments, viewpoints, header) {
      const files = (header || []).map((f) => `<File${f.ifc_project ? ` IfcProject="${esc(f.ifc_project)}"` : ''}${f.ifc_spatial_structure_element ? ` IfcSpatialStructureElement="${esc(f.ifc_spatial_structure_element)}"` : ''} IsExternal="true">${tag('Filename', f.filename)}${tag('Date', f.date)}${tag('Reference', f.reference)}</File>`).join('');
      const labels = (topic.labels || []).map((l) => tag('Labels', l)).join('');
      const refs = (topic.document_references || []).map((r) => `<DocumentReference Guid="${esc(r.guid || newGuid())}">${tag('DocumentGuid', r.document_guid)}${tag('Url', r.url)}${tag('Description', r.description)}</DocumentReference>`).join('');
      const related = (topic.related_topics || []).map((r) => `<RelatedTopic Guid="${esc(r.related_topic_guid || r)}"/>`).join('');
      const t = `<Topic Guid="${esc(topic.guid)}"${topic.topic_type ? ` TopicType="${esc(topic.topic_type)}"` : ''}${topic.topic_status ? ` TopicStatus="${esc(topic.topic_status)}"` : ''}${topic.server_assigned_id ? ` ServerAssignedId="${esc(topic.server_assigned_id)}"` : ''}>`
        + tag('ReferenceLink', (topic.reference_links || [])[0]) + tag('Title', topic.title || '') + tag('Priority', topic.priority) + (topic.index !== undefined && topic.index !== null ? tag('Index', topic.index) : '') + labels
        + tag('CreationDate', topic.creation_date || new Date().toISOString()) + tag('CreationAuthor', topic.creation_author || '') + tag('ModifiedDate', topic.modified_date) + tag('ModifiedAuthor', topic.modified_author)
        + tag('DueDate', topic.due_date) + tag('AssignedTo', topic.assigned_to) + tag('Stage', topic.stage) + tag('Description', topic.description) + refs + related + '</Topic>';
      const c = comments.map((x) => `<Comment Guid="${esc(x.guid || newGuid())}">${tag('Date', x.date || new Date().toISOString())}${tag('Author', x.author || '')}${tag('Comment', x.comment || '')}${x.viewpoint_guid ? `<Viewpoint Guid="${esc(x.viewpoint_guid)}"/>` : ''}${tag('ModifiedDate', x.modified_date)}${tag('ModifiedAuthor', x.modified_author)}</Comment>`).join('');
      const v = viewpoints.map((x) => `<ViewPoint Guid="${esc(x.guid)}">${tag('Viewpoint', x.file)}${tag('Snapshot', x.snapshot)}${tag('Index', x.index)}</ViewPoint>`).join('');
      return `<?xml version="1.0" encoding="UTF-8"?>\n<Markup><Header>${files ? `<Files>${files}</Files>` : ''}</Header>${t}${c ? `<Comments>${c}</Comments>` : ''}${v ? `<Viewpoints>${v}</Viewpoints>` : ''}</Markup>\n`;
    }
    /**
     * A .bcfzip from topics in the API's shape.
     * @param {Array<{topic: any, comments: any[], viewpoints: Array<{viewpoint: any, snapshot?: {bytes: Uint8Array|ArrayBuffer, type: string}|null}>, header?: any[]}>} items
     * @param {{projectName?: string}} [options] @returns {Promise<Blob>}
     */
    async function write(items, options = {}) {
      const entries = {};
      entries['bcf.version'] = encode('<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="3.0"/>\n');
      if (options.projectName) entries['project.bcfp'] = encode(`<?xml version="1.0" encoding="UTF-8"?>\n<ProjectInfo><Project ProjectId="${esc(options.projectId || newGuid())}">${tag('Name', options.projectName)}</Project></ProjectInfo>\n`);
      for (const item of items) {
        const guid = isUuid(item.topic.guid) ? item.topic.guid.toLowerCase() : newGuid();
        const topic = Object.assign({}, item.topic, { guid });
        const vps = [];
        (item.viewpoints || []).forEach((entry, i) => {
          const vp = entry.viewpoint || entry;
          const vguid = isUuid(vp.guid) ? vp.guid.toLowerCase() : newGuid();
          const file = i === 0 ? 'viewpoint.bcfv' : `viewpoint-${i + 1}.bcfv`;
          entries[`${guid}/${file}`] = encode(viewpointXml(Object.assign({}, vp, { guid: vguid })));
          let snapshot = null;
          if (entry.snapshot && entry.snapshot.bytes) {
            const ext = /jpe?g/i.test(entry.snapshot.type || '') ? 'jpg' : 'png';
            snapshot = i === 0 ? `snapshot.${ext}` : `snapshot-${i + 1}.${ext}`;
            entries[`${guid}/${snapshot}`] = entry.snapshot.bytes instanceof Uint8Array ? entry.snapshot.bytes : new Uint8Array(entry.snapshot.bytes);
          }
          vps.push({ guid: vguid, file, snapshot, index: vp.index === undefined || vp.index === null ? i : vp.index });
        });
        entries[`${guid}/markup.bcf`] = encode(markupXml(topic, item.comments || [], vps, item.header));
      }
      return zip.createZip(entries, { level: 6 });
    }

    // ------------------------------------------------------------------------------------------------------------ reading
    const textOf = (el, name) => { const n = el ? Array.from(el.children).find((c) => c.localName === name) : null; return n ? n.textContent : null; };
    const children = (el, name) => (el ? Array.from(el.children).filter((c) => c.localName === name) : []);
    const pointOf = (el) => (el ? { x: Number(textOf(el, 'X')) || 0, y: Number(textOf(el, 'Y')) || 0, z: Number(textOf(el, 'Z')) || 0 } : null);
    function parse(text, name) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error(D.t('bcf.err.xml', { file: name }));
      return doc.documentElement;
    }
    function componentsOf(root) {
      const comps = children(root, 'Components')[0];
      if (!comps) return null;
      const list = (el) => children(el, 'Component').map((c) => ({ ifc_guid: c.getAttribute('IfcGuid') || null, originating_system: textOf(c, 'OriginatingSystem'), authoring_tool_id: textOf(c, 'AuthoringToolId') }));
      const vis = children(comps, 'Visibility')[0];
      return {
        selection: list(children(comps, 'Selection')[0]),
        coloring: children(children(comps, 'Coloring')[0], 'Color').map((c) => ({ color: c.getAttribute('Color') || '', components: list(c) })),
        visibility: { default_visibility: !vis || vis.getAttribute('DefaultVisibility') !== 'false', exceptions: vis ? list(children(vis, 'Exceptions')[0]) : [] },
      };
    }
    function cameraOf(root) {
      const pc = children(root, 'PerspectiveCamera')[0]; const oc = children(root, 'OrthogonalCamera')[0];
      const base = (el) => ({ camera_view_point: pointOf(children(el, 'CameraViewPoint')[0]), camera_direction: pointOf(children(el, 'CameraDirection')[0]), camera_up_vector: pointOf(children(el, 'CameraUpVector')[0]), aspect_ratio: Number(textOf(el, 'AspectRatio')) || 1 });
      // The clipping planes: a location and a direction towards the side cut away.
      const planes = children(children(root, 'ClippingPlanes')[0], 'ClippingPlane').map((c) => ({ location: pointOf(children(c, 'Location')[0]), direction: pointOf(children(c, 'Direction')[0]) }));
      const clip = planes.length ? { clipping_planes: planes } : {};
      if (pc) return Object.assign({ perspective_camera: Object.assign(base(pc), { field_of_view: Number(textOf(pc, 'FieldOfView')) || 60 }) }, clip);
      if (oc) return Object.assign({ orthogonal_camera: Object.assign(base(oc), { view_to_world_scale: Number(textOf(oc, 'ViewToWorldScale')) || 1 }) }, clip);
      return clip;
    }
    /**
     * The contents of a .bcfzip in the API's shape.
     * @param {Uint8Array|ArrayBuffer} bytes
     * @returns {Promise<{version: string, project: {name: string, id: string}|null, topics: any[], comments: any[], viewpoints: any[], components: any[], snapshots: Array<{topic_guid: string, viewpoint_guid: string, bytes: Uint8Array, type: string}>}>}
     */
    async function read(bytes) {
      const entries = await zip.readZip(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      const names = Object.keys(entries);
      const versionFile = names.find((n) => /(^|\/)bcf\.version$/i.test(n));
      if (!versionFile) throw new Error(D.t('bcf.err.notbcf'));
      const prefix = versionFile.slice(0, versionFile.length - 'bcf.version'.length);
      const version = (parse(zip.text(entries[versionFile]), versionFile).getAttribute('VersionId') || '').trim();
      const out = { version, project: null, topics: [], comments: [], viewpoints: [], components: [], snapshots: [] };
      const projectFile = names.find((n) => n.startsWith(prefix) && /\.bcfp$/i.test(n));
      if (projectFile) {
        const p = children(parse(zip.text(entries[projectFile]), projectFile), 'Project')[0];
        if (p) out.project = { name: textOf(p, 'Name') || '', id: p.getAttribute('ProjectId') || '' };
      }
      for (const name of names.filter((n) => n.startsWith(prefix) && /\/markup\.bcf$/i.test(n))) {
        const folder = name.slice(0, name.length - 'markup.bcf'.length);
        const root = parse(zip.text(entries[name]), name);
        const te = children(root, 'Topic')[0];
        if (!te) continue;
        const guid = (te.getAttribute('Guid') || folder.replace(/\/$/, '').split('/').pop() || newGuid()).toLowerCase();
        const topic = {
          guid, server_assigned_id: te.getAttribute('ServerAssignedId') || null, topic_type: te.getAttribute('TopicType') || null, topic_status: te.getAttribute('TopicStatus') || null,
          title: textOf(te, 'Title') || '', priority: textOf(te, 'Priority'), index: textOf(te, 'Index') === null ? null : Number(textOf(te, 'Index')), labels: children(te, 'Labels').map((l) => l.textContent),
          creation_date: textOf(te, 'CreationDate'), creation_author: textOf(te, 'CreationAuthor'), modified_date: textOf(te, 'ModifiedDate'), modified_author: textOf(te, 'ModifiedAuthor'),
          due_date: textOf(te, 'DueDate'), assigned_to: textOf(te, 'AssignedTo'), stage: textOf(te, 'Stage'), description: textOf(te, 'Description'),
          reference_links: children(te, 'ReferenceLink').map((l) => l.textContent),
          document_references: children(te, 'DocumentReference').map((r) => ({ guid: r.getAttribute('Guid'), document_guid: textOf(r, 'DocumentGuid'), url: textOf(r, 'Url'), description: textOf(r, 'Description') })),
          related_topics: children(te, 'RelatedTopic').map((r) => ({ related_topic_guid: r.getAttribute('Guid') })),
          header_files: children(children(children(root, 'Header')[0], 'Files')[0], 'File').map((f) => ({ ifc_project: f.getAttribute('IfcProject'), ifc_spatial_structure_element: f.getAttribute('IfcSpatialStructureElement'), filename: textOf(f, 'Filename'), date: textOf(f, 'Date'), reference: textOf(f, 'Reference') })),
        };
        out.topics.push(topic);
        for (const c of children(children(root, 'Comments')[0], 'Comment')) {
          const vp = children(c, 'Viewpoint')[0];
          out.comments.push({ guid: c.getAttribute('Guid') || newGuid(), topic_guid: guid, date: textOf(c, 'Date'), author: textOf(c, 'Author'), comment: textOf(c, 'Comment') || '', viewpoint_guid: vp ? vp.getAttribute('Guid') : null, modified_date: textOf(c, 'ModifiedDate'), modified_author: textOf(c, 'ModifiedAuthor') });
        }
        for (const v of children(children(root, 'Viewpoints')[0], 'ViewPoint')) {
          const vguid = (v.getAttribute('Guid') || newGuid()).toLowerCase();
          const file = textOf(v, 'Viewpoint'); const snap = textOf(v, 'Snapshot');
          const viewpoint = { guid: vguid, topic_guid: guid, index: textOf(v, 'Index') === null ? null : Number(textOf(v, 'Index')), components: null };
          if (file && entries[folder + file]) {
            const vroot = parse(zip.text(entries[folder + file]), folder + file);
            Object.assign(viewpoint, cameraOf(vroot), { components: componentsOf(vroot) });
          }
          if (snap && entries[folder + snap]) out.snapshots.push({ topic_guid: guid, viewpoint_guid: vguid, bytes: entries[folder + snap], type: /jpe?g$/i.test(snap) ? 'image/jpeg' : 'image/png' });
          out.viewpoints.push(viewpoint);
          const comps = viewpoint.components;
          if (comps) {
            for (const c of comps.selection || []) out.components.push({ topic: topic.title, topic_guid: guid, viewpoint_guid: vguid, role: 'selection', ifc_guid: c.ifc_guid, color: null, originating_system: c.originating_system, authoring_tool_id: c.authoring_tool_id });
            for (const g of comps.coloring || []) for (const c of g.components || []) out.components.push({ topic: topic.title, topic_guid: guid, viewpoint_guid: vguid, role: 'coloring', ifc_guid: c.ifc_guid, color: g.color, originating_system: c.originating_system, authoring_tool_id: c.authoring_tool_id });
          }
        }
      }
      return out;
    }
    /** The bytes of a possible BCF file: a ZIP whose first entries say so. Cheap enough for the import to sniff. */
    async function sniff(file) {
      if (!/\.(bcf|bcfzip)$/i.test(file.name || '')) return false;
      try { const names = Object.keys(await zip.readZip(new Uint8Array(await file.arrayBuffer()))); return names.some((n) => /(^|\/)bcf\.version$/i.test(n)); } catch (_err) { return false; }
    }

    /**
     * The 3D view's camera as a BCF perspective camera: the position, the direction towards the target, and the up vector that
     * stands at right angles to it, in the model's coordinates. three.js looks along -Z with Y up by default, so the world up is Y.
     * @param {{position: number[], target: number[], fov?: number, aspect?: number}} view from viz/model-draw's `view()`
     * @param {{worldUp?: number[]}} [options] @returns {any} perspective_camera
     */
    function cameraFromView(view, options = {}) {
      const p = view.position || [0, 0, 0]; const tgt = view.target || [0, 0, 0];
      const d = [tgt[0] - p[0], tgt[1] - p[1], tgt[2] - p[2]];
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      const dir = d.map((v) => v / len);
      const wu = options.worldUp || [0, 1, 0];
      const dot = wu[0] * dir[0] + wu[1] * dir[1] + wu[2] * dir[2];
      let up = [wu[0] - dir[0] * dot, wu[1] - dir[1] * dot, wu[2] - dir[2] * dot];
      const ul = Math.hypot(up[0], up[1], up[2]);
      up = ul > 1e-6 ? up.map((v) => v / ul) : [0, 0, 1];
      const round = (v) => Math.round(v * 1000) / 1000;
      return {
        camera_view_point: { x: round(p[0]), y: round(p[1]), z: round(p[2]) },
        camera_direction: { x: round(dir[0]), y: round(dir[1]), z: round(dir[2]) },
        camera_up_vector: { x: round(up[0]), y: round(up[1]), z: round(up[2]) },
        field_of_view: view.fov || 45, aspect_ratio: view.aspect || 1.6,
      };
    }

    /**
     * The 3D view's camera as BCF: `{perspective_camera}`, or `{orthogonal_camera}` with `view_to_world_scale` as the height of the
     * view in metres when the view is orthographic.
     * @param {{position: number[], target: number[], fov?: number, aspect?: number, projection?: string, height?: number}} view
     * @param {{worldUp?: number[]}} [options] @returns {any}
     */
    function cameraOfView(view, options = {}) {
      const camera = cameraFromView(view, options);
      if (view.projection !== 'orthographic') return { perspective_camera: camera };
      delete camera.field_of_view;
      return { orthogonal_camera: Object.assign(camera, { view_to_world_scale: Math.round((Number(view.height) || 1) * 1000) / 1000 }) };
    }

    return { write, read, sniff, viewpointXml, markupXml, newGuid, cameraFromView, cameraOfView };
  });
})();
