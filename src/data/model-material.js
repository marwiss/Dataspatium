// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The material behind a building model (decision F43 b, step 5): the brief and the pictures a model was built from go to the model's
 * project on the server, so that everyone who works on the model with a client of their own sees what it was built from. The brief
 * becomes the Markdown document `brief-<model>.md` with one line per picture (name, label, time and position when given), and every
 * picture a document of its own; both go up as project documents of the BCF API (3.8.2: no page of the server's in a popup, and the
 * form a topic's document references point at), and the topic "Underlag" (3.7.2) lists them with a document reference each, plus one
 * to the model when it is a document on the server. The whole must weigh under 64 MB. Nothing goes up before the person asks: the
 * brief and the pictures are the person's own, uploaded to their own server after the confirmation in the panel.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/model-material', ['api/families/opencde', 'api/http', 'data/exif'], (opencde, http, exif) => {
    const t = (k, p) => D.t(k, p);
    /** The most the brief and the pictures may weigh together, in bytes. */
    const MAX_BYTES = 64 * 1024 * 1024;
    /** Base64 characters per atob call: a multiple of four, so that every slice decodes on its own. */
    const SLICE = 1 << 20;
    /** What a file name on the server may not carry: path characters and control characters. */
    const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]/g;

    /**
     * @typedef {{name: string, mediaType: string, data: string, label?: string, when?: string, where?: {lat: number, lon: number, alt?: number}}} MaterialAttachment
     *   a picture: its name, media type and bytes as base64 without a prefix, with a label, a time and a position when known
     * @typedef {{brief: string, attachments?: MaterialAttachment[], name?: string}} Material
     *   the brief as the person wrote it, the pictures, and the model's name
     * @typedef {{topic: {guid: string, title: string}, documents: Array<{id: string, name: string}>, skipped: string[]}} MaterialUpload
     *   the topic made, the documents on the server with their guids, and the names of the pictures that could not be uploaded
     */

    /** Base64 without whitespace and without a data: prefix, which the panel never sends but a caller might. @param {any} b64 */
    function clean(b64) {
      const s = String(b64 || '');
      return (s.startsWith('data:') ? s.slice(s.indexOf(',') + 1) : s).replace(/\s+/g, '');
    }
    /** The bytes a base64 text decodes to, counted without decoding it. @param {string} b64 */
    function bytesOfBase64(b64) {
      const body = clean(b64).replace(/=+$/, '');
      const rest = body.length % 4;
      return Math.floor(body.length / 4) * 3 + (rest === 2 ? 1 : rest === 3 ? 2 : 0);
    }
    /**
     * Base64 to bytes without a library: the browser's own decoder when it has one, otherwise atob slice by slice, so that a large
     * picture never becomes one huge binary string. @param {string} b64 @returns {Uint8Array}
     */
    function fromBase64(b64) {
      const s = clean(b64);
      const U8 = /** @type {any} */ (Uint8Array);
      if (typeof U8.fromBase64 === 'function') return U8.fromBase64(s);
      const out = new Uint8Array(bytesOfBase64(s));
      let o = 0;
      for (let i = 0; i < s.length; i += SLICE) {
        const bin = atob(s.slice(i, i + SLICE));
        for (let j = 0; j < bin.length; j++) out[o++] = bin.charCodeAt(j);
      }
      return out.subarray(0, o);
    }
    /** A name the server may keep: no path or control characters, on one line. @param {any} name @param {string} fallback */
    function safeName(name, fallback) {
      return String(name || '').replace(UNSAFE, '_').replace(/\s+/g, ' ').trim() || fallback;
    }
    /** One line of text, for a label or a time inside the Markdown. @param {any} v */
    const oneLine = (v) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim();
    /** The brief's file name: brief-<model>.md, or brief-modell.md for a model without a name. @param {Material} material */
    const briefName = (material) => `brief-${safeName(material && material.name, 'modell')}.md`;
    /** A position as "lat, lon" with five decimals (about a metre), and the height in metres when given. @param {any} where */
    function whereText(where) {
      if (!where || !Number.isFinite(Number(where.lat)) || !Number.isFinite(Number(where.lon))) return '';
      const alt = where.alt === undefined || where.alt === null || !Number.isFinite(Number(where.alt)) ? '' : `, ${Math.round(Number(where.alt))} m`;
      return `${Number(where.lat).toFixed(5)}, ${Number(where.lon).toFixed(5)}${alt}`;
    }
    /** The line of a picture in the brief: its name and, in brackets, its label, time and position when given. @param {MaterialAttachment} a */
    function pictureLine(a, places = true) {
      const name = safeName(a && a.name, 'bild');
      const details = [oneLine(a && a.label), places ? oneLine(a && a.when) : '', places ? whereText(a && a.where) : ''].filter(Boolean);
      return details.length ? t('material.line', { name, details: details.join(', ') }) : name;
    }
    /**
     * The brief as a Markdown document: a heading with the model's name, the text as the person wrote it, and the pictures as a list.
     * @param {Material} material @returns {string}
     */
    function briefText(material, places = true) {
      const attachments = Array.isArray(material && material.attachments) ? material.attachments : [];
      const name = oneLine(material && material.name);
      const lines = [`# ${t('material.brief.name')}${name ? ': ' + name : ''}`, '', String((material && material.brief) || '').replace(/\r\n?/g, '\n').trim()];
      if (attachments.length) lines.push('', `## ${t('material.pictures')}`, '', ...attachments.map((a) => `- ${pictureLine(a, places)}`));
      return lines.join('\n') + '\n';
    }
    /** What the brief and the pictures weigh together, in bytes, without decoding the pictures. @param {Material} material */
    function sizeOf(material) {
      const attachments = Array.isArray(material && material.attachments) ? material.attachments : [];
      return new TextEncoder().encode(briefText(material)).length + attachments.reduce((n, a) => n + bytesOfBase64(a && a.data), 0);
    }
    /** The body of a reference to a document of the project, in the connector's version of the BCF API (3.7.2 by guid, 4.7.2 by address). */
    function referenceBody(connector, projectId, id, description) {
      if (opencde.bcfVersion(connector) !== '2.1') return { document_guid: id, description };
      const base = opencde.bcfBase(connector);
      const root = /^[a-z][a-z0-9+.-]*:/i.test(base) ? base : String(connector.baseUrl || '').replace(/\/+$/, '') + base;
      return { referenced_document: `${root}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(id)}`, description };
    }
    const isAborted = (err) => !!(err && err.kind === 'aborted');

    /**
     * Upload the material behind a model to its project: the brief as `brief-<model>.md`, every picture as a document, and the topic
     * "Underlag" with a document reference to each of them, and to the model when `documentId` names it on the server. A picture that
     * cannot be uploaded is skipped and the rest goes on; the brief's failure, an abort and a size over 64 MB end the call. The documents
     * stay on the server when the topic cannot be made, since the BCF API has no way to remove them.
     * @param {any} connector a signed-in OpenCDE source @param {string} projectId the model's project
     * @param {string|null} documentId the model's document on the server (a Documents API document id or a BCF document guid), or null
     * With `places: false` (the sharing review's choice) the pictures' times and positions stay out: the brief's lines omit them and
     * every picture's EXIF, XMP and comments are stripped (data/exif.strip).
     * @param {Material} material @param {{onStatus?: (text: string) => void, signal?: AbortSignal, places?: boolean}} [options]
     * @returns {Promise<MaterialUpload>}
     */
    async function upload(connector, projectId, documentId, material, options = {}) {
      const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};
      const signal = options.signal;
      const places = options.places !== false;
      const check = () => { if (signal && signal.aborted) throw new http.ApiError(t('opencde.err.cancelled'), { kind: 'aborted' }); };
      const attachments = Array.isArray(material && material.attachments) ? material.attachments : [];
      if (sizeOf(material) > MAX_BYTES) throw new Error(t('material.err.size'));
      const documents = []; const refs = []; const skipped = [];
      // The brief first: without it there is no material, so its failure ends the call before any picture goes up.
      const name = briefName(material);
      check(); onStatus(t('material.status.upload', { name }));
      const brief = await opencde.uploadBcfDocument(connector, projectId, new File([new TextEncoder().encode(briefText(material, places))], name, { type: 'text/markdown' }), { signal });
      documents.push({ id: brief.guid, name }); refs.push({ id: brief.guid, description: t('material.brief.name') });
      for (const a of attachments) {
        const fileName = safeName(a && a.name, 'bild');
        // A picture without bytes has nothing to upload.
        if (!a || !clean(a.data)) { skipped.push(fileName); continue; }
        check(); onStatus(t('material.status.upload', { name: fileName }));
        try {
          const doc = await opencde.uploadBcfDocument(connector, projectId, new File([places ? fromBase64(a && a.data) : exif.strip(fromBase64(a && a.data))], fileName, { type: String((a && a.mediaType) || 'application/octet-stream') }), { signal });
          documents.push({ id: doc.guid, name: fileName }); refs.push({ id: doc.guid, description: oneLine(a && a.label) || fileName });
        } catch (err) {
          if (isAborted(err)) throw err;
          D.log('material', 'could not upload ' + fileName, err);
          skipped.push(fileName);
        }
      }
      check(); onStatus(t('material.status.topic'));
      const n = documents.length - 1;
      const description = t(n ? 'material.topic.description' : 'material.topic.description.none', { n }) + '\n\n' + documents.map((d) => `- ${d.name}`).join('\n');
      const topic = await opencde.createTopic(connector, projectId, { title: t('material.topic.title'), description });
      for (const r of refs) { check(); await opencde.createDocumentReference(connector, projectId, topic.guid, referenceBody(connector, projectId, r.id, r.description), { signal }); }
      // The model itself, when it is a document on the server: Dataregium takes a Documents API id as document_guid too. A refusal
      // (another server, a document of another project) costs nothing but the link.
      if (documentId && opencde.bcfVersion(connector) !== '2.1') {
        try { await opencde.createDocumentReference(connector, projectId, topic.guid, { document_guid: String(documentId), description: oneLine(material && material.name) || t('material.model') }, { signal }); }
        catch (err) { if (isAborted(err)) throw err; D.log('material', 'the reference to the model was refused', err); }
      }
      return { topic: { guid: topic.guid, title: topic.title || t('material.topic.title') }, documents, skipped };
    }
    /** What was done, in the person's words: the server, the topic and how many documents. @param {any} connector @param {MaterialUpload} result */
    const summary = (connector, result) => t('material.done', { server: opencde.hostOf(connector.baseUrl), title: result.topic.title, n: result.documents.length });

    return { MAX_BYTES, upload, summary, briefName, briefText, sizeOf, fromBase64, bytesOfBase64 };
  });
})();
