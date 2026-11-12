// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * BCF-XML, the file form of BCF (a ZIP, .bcf or .bcfzip). Written as BCF 3.0: bcf.version, extensions.xml with the values the file
 * uses, project.bcfp, documents.xml with the documents under Documents/, and one folder per topic with markup.bcf (comments and
 * viewpoints inside the topic), the viewpoints as .bcfv and their snapshots, at most 1500 px on the longest side. Read from BCF 3.0,
 * BCF 2.1 (comments and viewpoints beside the topic, lists without containers, 2.1 colouring and document references), BCF 2.0's
 * components and the app's own exports before 3.0 was followed, into the shape the BCF API gives. Required values always have
 * content: a topic type and status, a title, and an author (the person's, or the tool's name). Everything written is escaped;
 * everything read is text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/bcf-xml', ['platform/storage/zip', 'platform/text'], (zip, text) => {
    // XML 1.0 has no place for most control characters, so they are left out of what is written.
    const esc = (v) => text.escapeHtml(String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''));
    const blank = (v) => v === null || v === undefined || String(v).replace(/\s+/g, '').length === 0;
    const filled = (v) => (blank(v) ? null : String(v));
    const tag = (name, value) => (blank(value) ? '' : `<${name}>${esc(value)}</${name}>`);
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : (Number.isFinite(Number(v)) && !blank(v) ? String(Number(v)) : '0'));
    const point = (name, p) => `<${name}><X>${num(p && p.x)}</X><Y>${num(p && p.y)}</Y><Z>${num(p && p.z)}</Z></${name}>`;
    const encode = (s) => new TextEncoder().encode(s);
    const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
    /** A guid in the lower case BCF 3.0 asks for, or null when it is none. */
    const lowerGuid = (s) => (isUuid(s) ? String(s).toLowerCase() : null);
    const newGuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }));
    /** An IFC GlobalId: 22 characters of IFC's own base 64. */
    const isIfcGuid = (s) => /^[0-9A-Za-z_$]{22}$/.test(String(s || ''));
    /** The longest side of a snapshot, in pixels (BCF-XML 3.0 and BCF API 3.0). */
    const MAX_SNAPSHOT = 1500;
    /** The values a topic always gets when it has none: BCF 3.0 requires both. */
    const DEFAULT_TYPE = 'Issue';
    const DEFAULT_STATUS = 'Open';
    /** The author when nobody has given a name and nobody is signed in: the tool's name, never a guessed person. */
    const TOOL_AUTHOR = 'Dataspatium';
    /**
     * bcf.version as the BCF 3.0 documentation gives it, but closed at once: the schema gives Version empty content, where not even the
     * line break of the documented file is allowed.
     */
    const VERSION_XML = `${XML}<Version VersionId="3.0" xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/buildingSMART/BCF-XML/release_3_0/Schemas/version.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>\n`;

    /**
     * The author of what the app writes: the person's identity on the server when signed in, otherwise the name the person has entered
     * for comments, otherwise the tool's name.
     * @param {string|null|undefined} serverUser @param {string|null|undefined} [typed] @returns {string}
     */
    function authorOf(serverUser, typed) { return filled(serverUser) || filled(typed) || TOOL_AUTHOR; }

    /** A value as xs:dateTime (a date alone becomes midnight UTC; BCF reads a time without a zone as UTC), or null. */
    function dateTime(v) {
      if (blank(v)) return null;
      let s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + 'T00:00:00Z';
      s = s.replace(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?=$|[Z+-])/, '$1T$2:00').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
      if (/^-?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(s)) return s;
      const d = new Date(s);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    }
    /** A colour as BCF's hex (RRGGBB or AARRGGBB, without #); a CSS colour of another form goes through the browser; null otherwise. */
    function colorOf(c) {
      let s = String(c || '').trim().replace(/^#/, '');
      if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((ch) => ch + ch).join('');
      if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s)) return s.toUpperCase();
      if (!s || typeof document === 'undefined') return null;
      try {
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return null;
        // A colour the browser does not know leaves the style as it was, so two different starts tell it apart.
        const through = (start) => { ctx.fillStyle = start; ctx.fillStyle = String(c); return String(ctx.fillStyle).replace(/^#/, ''); };
        const out = through('#000000');
        return out === through('#ffffff') && /^[0-9a-f]{6}$/i.test(out) ? out.toUpperCase() : null;
      } catch (_e) { return null; }
    }
    const uniq = (list) => Array.from(new Set((Array.isArray(list) ? list : (blank(list) ? [] : [list])).filter((x) => !blank(x)).map((x) => String(x).trim())));

    // ------------------------------------------------------------------------------------------------------------ viewpoints
    function componentXml(x) {
      const guid = x && isIfcGuid(x.ifc_guid) ? String(x.ifc_guid) : null;
      if (!x || (!guid && blank(x.authoring_tool_id))) return '';
      return `<Component${guid ? ` IfcGuid="${esc(guid)}"` : ''}>${tag('OriginatingSystem', x.originating_system)}${tag('AuthoringToolId', x.authoring_tool_id)}</Component>`;
    }
    const componentsList = (items) => (items || []).map(componentXml).join('');
    function componentsXml(c) {
      if (!c) return '';
      const selection = componentsList(c.selection);
      const vis = c.visibility || { default_visibility: true };
      const hints = vis.view_setup_hints;
      const flag = (v) => (v ? 'true' : 'false');
      const hintsXml = hints ? `<ViewSetupHints SpacesVisible="${flag(hints.spaces_visible)}" SpaceBoundariesVisible="${flag(hints.space_boundaries_visible)}" OpeningsVisible="${flag(hints.openings_visible)}"/>` : '';
      const exceptions = componentsList(vis.exceptions);
      const coloring = (c.coloring || []).map((g) => { const color = colorOf(g.color); const list = componentsList(g.components); return color && list ? `<Color Color="${color}"><Components>${list}</Components></Color>` : ''; }).join('');
      return `<Components>${selection ? `<Selection>${selection}</Selection>` : ''}<Visibility DefaultVisibility="${vis.default_visibility === false ? 'false' : 'true'}">${hintsXml}${exceptions ? `<Exceptions>${exceptions}</Exceptions>` : ''}</Visibility>${coloring ? `<Coloring>${coloring}</Coloring>` : ''}</Components>`;
    }
    /** A camera BCF can take: a direction and an up vector that are not zero and not parallel. Null when there is none. */
    function cameraParts(cam) {
      const v = (p) => [Number(p && p.x), Number(p && p.y), Number(p && p.z)];
      const ok = (a) => a.every(Number.isFinite);
      const at = v(cam.camera_view_point); const dir = v(cam.camera_direction); let up = v(cam.camera_up_vector);
      if (!ok(at) || !ok(dir) || !Math.hypot(dir[0], dir[1], dir[2])) return null;
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      if (!ok(up) || Math.hypot(...cross(dir, up)) < 1e-9) up = Math.abs(dir[2]) > 0.99 ? [0, 1, 0] : [0, 0, 1];
      const p = (a) => ({ x: a[0], y: a[1], z: a[2] });
      return `${point('CameraViewPoint', p(at))}${point('CameraDirection', p(dir))}${point('CameraUpVector', p(up))}`;
    }
    const positive = (v, fallback) => (Number(v) > 0 && Number.isFinite(Number(v)) ? Number(v) : fallback);

    /**
     * The viewpoint file of one viewpoint (BCF 3.0 visinfo), from the API's shape; null when the viewpoint has no camera, which a
     * viewpoint file must have (the markup then lists the snapshot alone).
     * @param {any} vp @returns {string|null}
     */
    function viewpointXml(vp) {
      const pc = vp.perspective_camera; const oc = vp.orthogonal_camera;
      const parts = pc ? cameraParts(pc) : oc ? cameraParts(oc) : null;
      if (!parts) return null;
      const fov = Number(pc && pc.field_of_view);
      const camera = pc ? `<PerspectiveCamera>${parts}<FieldOfView>${num(fov > 0 && fov < 180 ? fov : 60)}</FieldOfView><AspectRatio>${num(positive(pc.aspect_ratio, 1))}</AspectRatio></PerspectiveCamera>`
        : `<OrthogonalCamera>${parts}<ViewToWorldScale>${num(positive(oc.view_to_world_scale, 1))}</ViewToWorldScale><AspectRatio>${num(positive(oc.aspect_ratio, 1))}</AspectRatio></OrthogonalCamera>`;
      const lines = Array.isArray(vp.lines) && vp.lines.length ? `<Lines>${vp.lines.map((l) => `<Line>${point('StartPoint', l.start_point)}${point('EndPoint', l.end_point)}</Line>`).join('')}</Lines>` : '';
      const planes = Array.isArray(vp.clipping_planes) && vp.clipping_planes.length
        ? `<ClippingPlanes>${vp.clipping_planes.map((c) => `<ClippingPlane>${point('Location', c.location)}${point('Direction', c.direction)}</ClippingPlane>`).join('')}</ClippingPlanes>` : '';
      return `${XML}<VisualizationInfo Guid="${esc(lowerGuid(vp.guid) || vp.guid || newGuid())}">${componentsXml(vp.components)}${camera}${lines}${planes}</VisualizationInfo>\n`;
    }

    // ------------------------------------------------------------------------------------------------------------ markup
    function fileXml(f) {
      if (!f) return '';
      const name = filled(f.filename || f.file_name); const date = dateTime(f.date); const ref = filled(f.reference);
      const project = isIfcGuid(f.ifc_project) ? f.ifc_project : null; const spatial = isIfcGuid(f.ifc_spatial_structure_element) ? f.ifc_spatial_structure_element : null;
      if (!name && !date && !ref && !project) return '';
      return `<File${project ? ` IfcProject="${esc(project)}"` : ''}${spatial ? ` IfcSpatialStructureElement="${esc(spatial)}"` : ''} IsExternal="${f.is_external === false ? 'false' : 'true'}">${tag('Filename', name)}${tag('Date', date)}${tag('Reference', ref)}</File>`;
    }
    function referenceXml(r) {
      if (!r) return '';
      const doc = lowerGuid(r.document_guid); const url = filled(r.url || r.referenced_document);
      if (!doc && !url) return '';
      return `<DocumentReference Guid="${lowerGuid(r.guid) || newGuid()}">${doc ? `<DocumentGuid>${doc}</DocumentGuid>` : tag('Url', url)}${tag('Description', r.description)}</DocumentReference>`;
    }
    function snippetXml(s) {
      if (!s || blank(s.snippet_type) || blank(s.reference) || blank(s.reference_schema)) return '';
      return `<BimSnippet SnippetType="${esc(s.snippet_type)}" IsExternal="${s.is_external ? 'true' : 'false'}">${tag('Reference', s.reference)}${tag('ReferenceSchema', s.reference_schema)}</BimSnippet>`;
    }
    function commentXml(c, author) {
      const vp = lowerGuid(c.viewpoint_guid || (c.viewpoint && c.viewpoint.guid));
      if (blank(c.comment) && !vp) return '';
      const modified = dateTime(c.modified_date);
      return `<Comment Guid="${lowerGuid(c.guid) || newGuid()}">${tag('Date', dateTime(c.date) || new Date().toISOString())}${tag('Author', filled(c.author) || author)}${tag('Comment', c.comment)}${vp ? `<Viewpoint Guid="${vp}"/>` : ''}${modified ? tag('ModifiedDate', modified) + tag('ModifiedAuthor', filled(c.modified_author) || author) : ''}</Comment>`;
    }

    /**
     * The markup of one topic (BCF 3.0): the header with the model files, the topic with its lists in their containers, then its
     * comments and viewpoints. A required value that is missing gets its default: type Issue, status Open, the author given.
     * @param {any} topic @param {any[]} comments @param {Array<{guid: string, file: string|null, snapshot: string|null, index: number}>} viewpoints
     * @param {any[]} [header] files @param {{author?: string}} [options] @returns {string}
     */
    function markupXml(topic, comments, viewpoints, header, options = {}) {
      const author = authorOf(null, options.author);
      const files = (header || []).map(fileXml).join('');
      const links = uniq(topic.reference_links).map((l) => tag('ReferenceLink', l)).join('');
      const labels = uniq(topic.labels).map((l) => tag('Label', l)).join('');
      const refs = (topic.document_references || []).map(referenceXml).join('');
      const related = (topic.related_topics || []).map((r) => lowerGuid(r && typeof r === 'object' ? r.related_topic_guid : r)).filter(Boolean).map((g) => `<RelatedTopic Guid="${g}"/>`).join('');
      const cs = (comments || []).map((c) => commentXml(c, author)).join('');
      const vs = (viewpoints || []).map((x) => `<ViewPoint Guid="${esc(x.guid)}">${tag('Viewpoint', x.file)}${tag('Snapshot', x.snapshot)}${Number.isInteger(Number(x.index)) && !blank(x.index) ? tag('Index', String(Number(x.index))) : ''}</ViewPoint>`).join('');
      const modified = dateTime(topic.modified_date);
      const t = `<Topic Guid="${esc(lowerGuid(topic.guid) || newGuid())}"${filled(topic.server_assigned_id) ? ` ServerAssignedId="${esc(topic.server_assigned_id)}"` : ''} TopicType="${esc(filled(topic.topic_type) || DEFAULT_TYPE)}" TopicStatus="${esc(filled(topic.topic_status) || DEFAULT_STATUS)}">`
        + (links ? `<ReferenceLinks>${links}</ReferenceLinks>` : '') + tag('Title', filled(topic.title) || D.t('bcf.untitled')) + tag('Priority', topic.priority)
        + (labels ? `<Labels>${labels}</Labels>` : '')
        + tag('CreationDate', dateTime(topic.creation_date) || new Date().toISOString()) + tag('CreationAuthor', filled(topic.creation_author) || author)
        + (modified ? tag('ModifiedDate', modified) + tag('ModifiedAuthor', filled(topic.modified_author) || author) : '')
        + tag('DueDate', dateTime(topic.due_date)) + tag('AssignedTo', topic.assigned_to) + tag('Stage', topic.stage) + tag('Description', topic.description)
        + snippetXml(topic.bim_snippet) + (refs ? `<DocumentReferences>${refs}</DocumentReferences>` : '') + (related ? `<RelatedTopics>${related}</RelatedTopics>` : '')
        + (cs ? `<Comments>${cs}</Comments>` : '') + (vs ? `<Viewpoints>${vs}</Viewpoints>` : '') + '</Topic>';
      return `${XML}<Markup>${files ? `<Header><Files>${files}</Files></Header>` : ''}${t}</Markup>\n`;
    }

    /** The keys of the BCF API's project extensions, with the elements of extensions.xml they become, in the schema's order. */
    const EXTENSIONS = [['topic_type', 'TopicTypes', 'TopicType'], ['topic_status', 'TopicStatuses', 'TopicStatus'], ['priority', 'Priorities', 'Priority'],
      ['topic_label', 'TopicLabels', 'TopicLabel'], ['users', 'Users', 'User'], ['snippet_type', 'SnippetTypes', 'SnippetType'], ['stage', 'Stages', 'Stage']];
    /**
     * extensions.xml: the values the file uses, after a project's own lists when they are given (the BCF API's extensions).
     * @param {Record<string, Iterable<string>>} used @param {any} [extra] @returns {string}
     */
    function extensionsXml(used, extra) {
      const groups = EXTENSIONS.map(([key, outer, inner]) => {
        const values = uniq([].concat(extra && Array.isArray(extra[key]) ? extra[key] : [], Array.from(used[key] || [])));
        return values.length ? `<${outer}>${values.map((v) => tag(inner, v)).join('')}</${outer}>` : '';
      }).join('');
      return `${XML}<Extensions>${groups}</Extensions>\n`;
    }

    // ------------------------------------------------------------------------------------------------------------ snapshots
    const isPng = (b) => b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
    /** The width and height of a PNG or JPEG from its header, or null. @param {Uint8Array} b */
    function imageSize(b) {
      if (isPng(b)) return { width: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, height: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 };
      if (!isJpeg(b)) return null;
      let i = 2;
      while (i + 8 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: (b[i + 7] << 8) | b[i + 8], height: (b[i + 5] << 8) | b[i + 6] };
        if (m === 0xda || m === 0xd9) break;
        i += 2 + ((b[i + 2] << 8) | b[i + 3]);
      }
      return null;
    }
    /**
     * A snapshot within BCF's limit: a PNG or JPEG whose longest side is over `max` pixels is drawn again at that size, in its own
     * format (which also leaves out what the file said about where and by whom it was taken). Others come back as they are.
     * @param {{bytes: Uint8Array|ArrayBuffer, type?: string}} snapshot @param {number} [max]
     * @returns {Promise<{bytes: Uint8Array, type: string}>}
     */
    async function fitSnapshot(snapshot, max = MAX_SNAPSHOT) {
      const bytes = snapshot.bytes instanceof Uint8Array ? snapshot.bytes : new Uint8Array(snapshot.bytes);
      const type = isJpeg(bytes) ? 'image/jpeg' : isPng(bytes) ? 'image/png' : String(snapshot.type || 'image/png');
      const size = imageSize(bytes);
      if (!size || Math.max(size.width, size.height) <= max || typeof createImageBitmap !== 'function') return { bytes, type };
      const k = max / Math.max(size.width, size.height);
      const w = Math.max(1, Math.round(size.width * k)); const h = Math.max(1, Math.round(size.height * k));
      try {
        const bitmap = await createImageBitmap(new Blob([bytes], { type }));
        /** @type {any} */
        const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
        canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
        if (bitmap.close) bitmap.close();
        const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type, quality: 0.9 }) : await new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
        return { bytes: new Uint8Array(await blob.arrayBuffer()), type };
      } catch (err) { D.log('bcf', 'snapshot', err); return { bytes, type }; }
    }
    /** A picture as a data URL (from a canvas) within BCF's limit, as the bytes and the base64 the BCF API takes. */
    async function fitDataUrl(url, max = MAX_SNAPSHOT) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(String(url || ''));
      if (!m || !m[2]) return null;
      const fitted = await fitSnapshot({ bytes: Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)), type: m[1] || 'image/png' }, max);
      let s = '';
      for (let i = 0; i < fitted.bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(fitted.bytes.subarray(i, i + 0x8000)));
      return { bytes: fitted.bytes, type: fitted.type, base64: btoa(s), snapshotType: fitted.type === 'image/jpeg' ? 'jpg' : 'png' };
    }

    // ------------------------------------------------------------------------------------------------------------ writing
    /**
     * A BCF 3.0 file (.bcfzip) from topics in the API's shape. `header` is the model files of a topic, `documents` files that go in the
     * file's Documents folder and are referenced from the topic. `author` fills a missing creation or comment author (see authorOf);
     * `extensions` is a project's own lists, written to extensions.xml before the values the file uses.
     * @param {Array<{topic: any, comments?: any[], viewpoints?: Array<{viewpoint: any, snapshot?: {bytes: Uint8Array|ArrayBuffer, type: string}|null}>, header?: any[], documents?: Array<{guid?: string, filename: string, description?: string, bytes: Uint8Array|ArrayBuffer}>}>} items
     * @param {{projectName?: string, projectId?: string, author?: string, extensions?: any}} [options] @returns {Promise<Blob>}
     */
    async function write(items, options = {}) {
      const author = authorOf(null, options.author);
      /** @type {Record<string, Set<string>>} */
      const used = Object.fromEntries(EXTENSIONS.map(([key]) => [key, new Set()]));
      const note = (key, v) => { for (const x of uniq(v)) used[key].add(x); };
      /** @type {Map<string, {filename: string, description: string|null, bytes: Uint8Array}>} */
      const documents = new Map();
      const topicEntries = {};
      for (const item of items) {
        const given = item.topic || {};
        const guid = lowerGuid(given.guid) || newGuid();
        const topic = Object.assign({}, given, { guid, topic_type: filled(given.topic_type) || DEFAULT_TYPE, topic_status: filled(given.topic_status) || DEFAULT_STATUS, document_references: (given.document_references || []).slice() });
        for (const d of item.documents || []) {
          if (!d || !d.bytes) continue;
          const dguid = lowerGuid(d.guid) || newGuid();
          documents.set(dguid, { filename: filled(d.filename) || dguid, description: filled(d.description), bytes: d.bytes instanceof Uint8Array ? d.bytes : new Uint8Array(d.bytes) });
          if (!topic.document_references.some((r) => lowerGuid(r && r.document_guid) === dguid)) topic.document_references.push({ guid: newGuid(), document_guid: dguid, description: filled(d.description) || filled(d.filename) });
        }
        note('topic_type', topic.topic_type); note('topic_status', topic.topic_status); note('priority', topic.priority); note('topic_label', topic.labels);
        note('users', topic.assigned_to); note('stage', topic.stage); if (topic.bim_snippet) note('snippet_type', topic.bim_snippet.snippet_type);
        // The topic's folder has an entry of its own in the ZIP, as BCF's encoding guide asks.
        topicEntries[`${guid}/`] = new Uint8Array(0);
        const vps = [];
        let n = 0;
        for (const [i, entry] of (item.viewpoints || []).entries()) {
          const vp = (entry && entry.viewpoint) || entry || {};
          const vguid = lowerGuid(vp.guid) || newGuid();
          const xml = viewpointXml(Object.assign({}, vp, { guid: vguid }));
          const file = xml ? (n === 0 ? 'viewpoint.bcfv' : `viewpoint-${n + 1}.bcfv`) : null;
          let snapshot = null;
          if (entry && entry.snapshot && entry.snapshot.bytes) {
            const fitted = await fitSnapshot(entry.snapshot);
            const ext = fitted.type === 'image/jpeg' ? 'jpg' : 'png';
            snapshot = n === 0 ? `snapshot.${ext}` : `snapshot-${n + 1}.${ext}`;
            topicEntries[`${guid}/${snapshot}`] = fitted.bytes;
          }
          if (!xml && !snapshot) continue;
          if (xml) topicEntries[`${guid}/${file}`] = encode(xml);
          vps.push({ guid: vguid, file, snapshot, index: vp.index === undefined || vp.index === null ? i : vp.index });
          n++;
        }
        topicEntries[`${guid}/markup.bcf`] = encode(markupXml(topic, item.comments || [], vps, item.header, { author }));
      }
      const entries = { 'bcf.version': encode(VERSION_XML), 'extensions.xml': encode(extensionsXml(used, options.extensions)) };
      if (!blank(options.projectName) || !blank(options.projectId)) entries['project.bcfp'] = encode(`${XML}<ProjectInfo><Project ProjectId="${esc(filled(options.projectId) || newGuid())}">${tag('Name', options.projectName)}</Project></ProjectInfo>\n`);
      if (documents.size) {
        entries['documents.xml'] = encode(`${XML}<DocumentInfo><Documents>${Array.from(documents.entries()).map(([g, d]) => `<Document Guid="${g}">${tag('Filename', d.filename)}${tag('Description', d.description)}</Document>`).join('')}</Documents></DocumentInfo>\n`);
        entries['Documents/'] = new Uint8Array(0);
        for (const [g, d] of documents) entries[`Documents/${g}`] = d.bytes;
      }
      return zip.createZip(Object.assign(entries, topicEntries), { level: 6 });
    }

    // ------------------------------------------------------------------------------------------------------------ reading
    const children = (el, name) => (el ? Array.from(el.children).filter((c) => !name || c.localName === name) : []);
    const textOf = (el, name) => { const n = children(el, name)[0]; return n ? n.textContent : null; };
    const trimmed = (el, name) => { const v = textOf(el, name); return v === null ? null : v.trim(); };
    const pointOf = (el) => (el ? { x: Number(textOf(el, 'X')) || 0, y: Number(textOf(el, 'Y')) || 0, z: Number(textOf(el, 'Z')) || 0 } : null);
    const boolAttr = (el, name, fallback) => { const v = el ? el.getAttribute(name) : null; return v === null ? fallback : v === 'true' || v === '1'; };
    function parse(xml, name) {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error(D.t('bcf.err.xml', { file: name }));
      return doc.documentElement;
    }
    /**
     * The components of a viewpoint file: BCF 3.0 (colours with their own Components), 2.1 (components straight under Color, the setup
     * hints beside the selection) and 2.0 (one list of components with Selected, Visible and Color). In 3.0 a missing DefaultVisibility
     * means false; 2.1 gives no default, and the app reads it as true.
     */
    function componentsOf(root, v3) {
      const comps = children(root, 'Components')[0];
      if (!comps) return null;
      const one = (c) => ({ ifc_guid: c.getAttribute('IfcGuid') || null, originating_system: trimmed(c, 'OriginatingSystem'), authoring_tool_id: trimmed(c, 'AuthoringToolId') });
      const list = (el) => children(el, 'Component').map(one);
      const vis = children(comps, 'Visibility')[0];
      const visibility = { default_visibility: vis ? boolAttr(vis, 'DefaultVisibility', !v3) : true, exceptions: vis ? list(children(vis, 'Exceptions')[0]) : [] };
      const hints = (vis && children(vis, 'ViewSetupHints')[0]) || children(comps, 'ViewSetupHints')[0];
      if (hints) visibility.view_setup_hints = { spaces_visible: boolAttr(hints, 'SpacesVisible', false), space_boundaries_visible: boolAttr(hints, 'SpaceBoundariesVisible', false), openings_visible: boolAttr(hints, 'OpeningsVisible', false) };
      const selection = list(children(comps, 'Selection')[0]);
      const coloring = children(children(comps, 'Coloring')[0], 'Color').map((c) => ({ color: c.getAttribute('Color') || '', components: list(children(c, 'Components')[0]).concat(list(c)) })).filter((g) => g.components.length);
      // BCF 2.0: every component in one list.
      for (const c of children(comps, 'Component')) {
        if (c.getAttribute('Selected') === 'true') selection.push(one(c));
        if (c.getAttribute('Visible') === 'false') visibility.exceptions.push(one(c));
        const color = c.getAttribute('Color');
        if (color) { let g = coloring.find((x) => x.color === color); if (!g) { g = { color, components: [] }; coloring.push(g); } g.components.push(one(c)); }
      }
      return { selection, coloring, visibility };
    }
    function cameraOf(root) {
      const pc = children(root, 'PerspectiveCamera')[0]; const oc = children(root, 'OrthogonalCamera')[0];
      // A file without an aspect ratio (before 3.0) is read with 1, as BCF 3.0 says.
      const base = (el) => ({ camera_view_point: pointOf(children(el, 'CameraViewPoint')[0]), camera_direction: pointOf(children(el, 'CameraDirection')[0]), camera_up_vector: pointOf(children(el, 'CameraUpVector')[0]), aspect_ratio: Number(textOf(el, 'AspectRatio')) || 1 });
      // The clipping planes: a location and a direction towards the side cut away.
      const planes = children(children(root, 'ClippingPlanes')[0], 'ClippingPlane').map((c) => ({ location: pointOf(children(c, 'Location')[0]), direction: pointOf(children(c, 'Direction')[0]) }));
      const lines = children(children(root, 'Lines')[0], 'Line').map((l) => ({ start_point: pointOf(children(l, 'StartPoint')[0]), end_point: pointOf(children(l, 'EndPoint')[0]) }));
      const extra = Object.assign(planes.length ? { clipping_planes: planes } : {}, lines.length ? { lines } : {});
      if (pc) return Object.assign({ perspective_camera: Object.assign(base(pc), { field_of_view: Number(textOf(pc, 'FieldOfView')) || 60 }) }, extra);
      if (oc) return Object.assign({ orthogonal_camera: Object.assign(base(oc), { view_to_world_scale: Number(textOf(oc, 'ViewToWorldScale')) || 1 }) }, extra);
      return extra;
    }
    /** The items of a list that BCF 3.0 puts in a container and 2.1 repeats beside each other. */
    const listOf = (el, container, item) => children(el, item).concat(children(children(el, container)[0], item));
    const baseName = (p) => String(p || '').split(/[\\/]/).pop() || '';
    /** A path relative to a folder of the ZIP ("../Documents/a.pdf" from a topic), with forward slashes. */
    function resolvePath(folder, rel) {
      const parts = folder.split('/').filter(Boolean);
      for (const piece of String(rel).replace(/\\/g, '/').split('/')) { if (piece === '..') parts.pop(); else if (piece && piece !== '.') parts.push(piece); }
      return parts.join('/');
    }
    const lowerAll = (list) => list.map((x) => x.toLowerCase());

    /**
     * The contents of a BCF file (3.0, 2.1, 2.0's components, the app's earlier exports) in the API's shape.
     * @param {Uint8Array|ArrayBuffer} bytes
     * @returns {Promise<{version: string, project: {name: string, id: string}|null, extensions: any, topics: any[], comments: any[], viewpoints: any[], components: any[], snapshots: Array<{topic_guid: string, viewpoint_guid: string, bytes: Uint8Array, type: string}>, documents: Array<{guid: string, filename: string, description: string|null, bytes: Uint8Array|null}>}>}
     */
    async function read(bytes) {
      const entries = await zip.readZip(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      const names = Object.keys(entries);
      const byLower = new Map(lowerAll(names).map((n, i) => [n, names[i]]));
      const entry = (path) => entries[path] || entries[byLower.get(String(path).toLowerCase()) || ''] || null;
      const versionFile = names.find((n) => /(^|\/)bcf\.version$/i.test(n));
      if (!versionFile) throw new Error(D.t('bcf.err.notbcf'));
      const prefix = versionFile.slice(0, versionFile.length - 'bcf.version'.length);
      const vroot = parse(zip.text(entries[versionFile]), versionFile);
      const version = (vroot.getAttribute('VersionId') || trimmed(vroot, 'DetailedVersion') || '').trim();
      const v3 = /^3/.test(version);
      const out = { version, project: null, extensions: null, topics: [], comments: [], viewpoints: [], components: [], snapshots: [], documents: [] };
      const projectFile = names.find((n) => n.startsWith(prefix) && /\.bcfp$/i.test(n));
      if (projectFile) {
        const p = children(parse(zip.text(entries[projectFile]), projectFile), 'Project')[0];
        if (p) out.project = { name: trimmed(p, 'Name') || '', id: p.getAttribute('ProjectId') || '' };
      }
      const extFile = entry(prefix + 'extensions.xml');
      if (extFile) {
        const ext = parse(zip.text(extFile), 'extensions.xml');
        out.extensions = Object.fromEntries(EXTENSIONS.map(([key, outer, inner]) => [key, children(children(ext, outer)[0], inner).map((x) => x.textContent.trim()).filter(Boolean)]));
      }
      const docFile = entry(prefix + 'documents.xml');
      if (docFile) {
        for (const d of children(children(parse(zip.text(docFile), 'documents.xml'), 'Documents')[0], 'Document')) {
          const guid = (d.getAttribute('Guid') || '').toLowerCase();
          out.documents.push({ guid, filename: trimmed(d, 'Filename') || guid, description: trimmed(d, 'Description'), bytes: entry(`${prefix}Documents/${guid}`) });
        }
      }
      for (const name of names.filter((n) => n.startsWith(prefix) && /\/markup\.bcf$/i.test(n))) {
        const folder = name.slice(0, name.length - 'markup.bcf'.length);
        const root = parse(zip.text(entries[name]), name);
        const te = children(root, 'Topic')[0];
        if (!te) continue;
        const guid = (te.getAttribute('Guid') || folder.replace(/\/$/, '').split('/').pop() || newGuid()).toLowerCase();
        const header = children(root, 'Header')[0];
        const labels = children(te, 'Labels').flatMap((l) => { const inner = children(l, 'Label'); return inner.length ? inner.map((x) => x.textContent) : [l.textContent]; }).map((x) => x.trim()).filter(Boolean);
        const references = listOf(te, 'DocumentReferences', 'DocumentReference').map((r) => {
          const ref = { guid: (r.getAttribute('Guid') || newGuid()).toLowerCase(), document_guid: trimmed(r, 'DocumentGuid'), url: trimmed(r, 'Url'), description: trimmed(r, 'Description') };
          if (ref.document_guid) ref.document_guid = ref.document_guid.toLowerCase();
          // 2.1: a path in the file or an address, told apart by isExternal.
          const referenced = trimmed(r, 'ReferencedDocument');
          if (referenced && !ref.document_guid && !ref.url) {
            const inside = !boolAttr(r, 'isExternal', false) && !/^[a-z][a-z0-9+.-]*:/i.test(referenced) ? entry(resolvePath(folder, referenced)) : null;
            if (inside) { const dguid = newGuid(); out.documents.push({ guid: dguid, filename: baseName(referenced), description: ref.description, bytes: inside }); ref.document_guid = dguid; } else ref.url = referenced;
          }
          return ref;
        });
        const snippetEl = children(te, 'BimSnippet')[0];
        const topic = {
          guid, server_assigned_id: te.getAttribute('ServerAssignedId') || null, topic_type: te.getAttribute('TopicType') || null, topic_status: te.getAttribute('TopicStatus') || null,
          title: textOf(te, 'Title') || '', priority: trimmed(te, 'Priority'), index: textOf(te, 'Index') === null ? null : Number(textOf(te, 'Index')), labels,
          creation_date: trimmed(te, 'CreationDate'), creation_author: trimmed(te, 'CreationAuthor'), modified_date: trimmed(te, 'ModifiedDate'), modified_author: trimmed(te, 'ModifiedAuthor'),
          due_date: trimmed(te, 'DueDate'), assigned_to: trimmed(te, 'AssignedTo'), stage: trimmed(te, 'Stage'), description: textOf(te, 'Description'),
          reference_links: listOf(te, 'ReferenceLinks', 'ReferenceLink').map((l) => l.textContent.trim()).filter(Boolean),
          document_references: references,
          related_topics: listOf(te, 'RelatedTopics', 'RelatedTopic').map((r) => ({ related_topic_guid: (r.getAttribute('Guid') || '').toLowerCase() })).filter((r) => r.related_topic_guid),
          header_files: listOf(header, 'Files', 'File').map((f) => ({ ifc_project: f.getAttribute('IfcProject'), ifc_spatial_structure_element: f.getAttribute('IfcSpatialStructureElement'), is_external: boolAttr(f, 'IsExternal', boolAttr(f, 'isExternal', true)), filename: trimmed(f, 'Filename'), date: trimmed(f, 'Date'), reference: trimmed(f, 'Reference') })),
        };
        if (snippetEl) topic.bim_snippet = { snippet_type: snippetEl.getAttribute('SnippetType'), is_external: boolAttr(snippetEl, 'IsExternal', boolAttr(snippetEl, 'isExternal', false)), reference: trimmed(snippetEl, 'Reference'), reference_schema: trimmed(snippetEl, 'ReferenceSchema') };
        out.topics.push(topic);
        // Comments: in the topic (3.0), beside it (2.1), or in a list beside it (the app's earlier exports).
        for (const c of children(children(te, 'Comments')[0], 'Comment').concat(children(root, 'Comment'), children(children(root, 'Comments')[0], 'Comment'))) {
          const vp = children(c, 'Viewpoint')[0];
          out.comments.push({ guid: (c.getAttribute('Guid') || newGuid()).toLowerCase(), topic_guid: guid, date: trimmed(c, 'Date'), author: trimmed(c, 'Author'), comment: textOf(c, 'Comment') || '', viewpoint_guid: vp && vp.getAttribute('Guid') ? vp.getAttribute('Guid').toLowerCase() : null, modified_date: trimmed(c, 'ModifiedDate'), modified_author: trimmed(c, 'ModifiedAuthor') });
        }
        // Viewpoints: in a list in the topic (3.0), each one beside it (2.1, the element is called Viewpoints), or in a list beside it.
        const listed = children(children(te, 'Viewpoints')[0], 'ViewPoint');
        for (const v of children(root, 'Viewpoints')) { const inner = children(v, 'ViewPoint'); if (inner.length) listed.push(...inner); else listed.push(v); }
        const points = listed.map((v) => ({ guid: v.getAttribute('Guid'), file: trimmed(v, 'Viewpoint'), snap: trimmed(v, 'Snapshot'), index: textOf(v, 'Index') === null ? null : Number(textOf(v, 'Index')) }));
        // Before 2.0 a topic had one viewpoint with fixed names and no list.
        if (!points.length && entry(folder + 'viewpoint.bcfv')) points.push({ guid: null, file: 'viewpoint.bcfv', snap: entry(folder + 'snapshot.png') ? 'snapshot.png' : null, index: null });
        for (const p of points) {
          const file = p.file ? entry(folder + p.file) : null;
          const vrootEl = file ? parse(zip.text(file), folder + p.file) : null;
          const vguid = String(p.guid || (vrootEl && vrootEl.getAttribute('Guid')) || newGuid()).toLowerCase();
          const viewpoint = Object.assign({ guid: vguid, topic_guid: guid, index: p.index, components: null }, vrootEl ? cameraOf(vrootEl) : {}, vrootEl ? { components: componentsOf(vrootEl, v3) } : {});
          const snapBytes = p.snap ? entry(folder + p.snap) : null;
          if (snapBytes) { out.snapshots.push({ topic_guid: guid, viewpoint_guid: vguid, bytes: snapBytes, type: isJpeg(snapBytes) || /jpe?g$/i.test(p.snap) ? 'image/jpeg' : 'image/png' }); viewpoint.snapshot = { snapshot_type: isJpeg(snapBytes) ? 'jpg' : 'png' }; }
          out.viewpoints.push(viewpoint);
          const comps = viewpoint.components;
          const shot = snapBytes ? p.snap : null;
          if (comps) {
            for (const c of comps.selection || []) out.components.push({ topic: topic.title, topic_guid: guid, viewpoint_guid: vguid, role: 'selection', ifc_guid: c.ifc_guid, color: null, originating_system: c.originating_system, authoring_tool_id: c.authoring_tool_id, snapshot: shot });
            for (const g of comps.coloring || []) for (const c of g.components || []) out.components.push({ topic: topic.title, topic_guid: guid, viewpoint_guid: vguid, role: 'coloring', ifc_guid: c.ifc_guid, color: g.color, originating_system: c.originating_system, authoring_tool_id: c.authoring_tool_id, snapshot: shot });
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
     * The header of a topic about a model, from the model dataset's facts: the file's name as its IFC header gives it (else the name
     * of the file), the header's time stamp, the IfcProject's GlobalId and, for a model from a server, the address it came from.
     * @param {any} meta the model dataset's record @returns {any[]} BCF files, empty when the dataset is no IFC model
     */
    function headerOf(meta) {
      const m = (meta && meta.model) || {};
      const cde = (meta && meta.source && meta.source.cde) || {};
      const filename = filled(m.headerName) || filled(m.file);
      if (!filename && !m.projectGuid) return [];
      const file = { filename, date: dateTime(m.timestamp), ifc_project: isIfcGuid(m.projectGuid) ? m.projectGuid : null };
      if (filled(cde.reference)) file.reference = cde.reference;
      return [file];
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

    /**
     * A perspective camera that frames a box in the model's own coordinates (Z up) from the south-east above, as a clash's viewpoint
     * looks at its point: the camera of a finding's element (decision F44 a). @param {{min: number[], max: number[]}} box @returns {any}
     */
    function cameraOfBox(box) {
      const centre = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2);
      const size = Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
      const dist = Math.min(200, Math.max(2.5, size * 1.2 + 1));
      const dir = [-1, 1, -1].map((v) => v / Math.sqrt(3));
      return cameraFromView({ position: centre.map((v, k) => v - dir[k] * dist), target: centre, fov: 60, aspect: 1.6 }, { worldUp: [0, 0, 1] });
    }

    return { write, read, sniff, viewpointXml, markupXml, extensionsXml, newGuid, isIfcGuid, dateTime, colorOf, authorOf, headerOf, imageSize, fitSnapshot, fitDataUrl, cameraFromView, cameraOfView, cameraOfBox, MAX_SNAPSHOT, DEFAULT_TYPE, DEFAULT_STATUS, TOOL_AUTHOR };
  });
})();
