// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * AI providers for "Fråga AI om modellen": two adapters, Anthropic Messages and OpenAI-compatible Chat Completions (which also covers
 * Gemini's OpenAI endpoint and local servers such as Ollama, vLLM and llama.cpp), written as classic scripts without SDKs. A provider
 * is a saved setting (kind, name, address, model); its key lives in api/secrets, never in the setting, the logs or the AI's context.
 * Nothing is called without the consent purpose `ai` for the provider's host, and the policy `local` refuses every host that is not
 * the user's own computer. Requests and answers are normalised to one shape so that the agent loop does not know the provider.
 * The answer is streamed (ai/stream) so that the panels can show it while it is written, and the call falls back to the plain answer
 * when the server sends one or refuses to stream (B-83). Each kind has its own list of models, and the server's own list is fetched
 * and the key tried (the cheapest real call: the list of models) only on the person's press, after the same consent as a question.
 * A picture tool's picture (ai/view-tools) goes to a provider that sees pictures (`seesImages`): in Anthropic's tool result, and for
 * an OpenAI-compatible API in a user message after the tool messages, since those take text only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/providers', ['api/http', 'api/secrets', 'platform/consent', 'platform/storage/idb', 'ai/stream'], (http, secrets, consent, idb, stream) => {
    const t = (k, p) => D.t(k, p);
    const SETTING = 'ai.providers';
    const POLICY_SETTING = 'ai.policy';
    /** The policies: ask per host (the consent dialog), cloud allowed, or only the user's own computer. */
    const POLICIES = ['ask', 'cloud', 'local'];
    /** The two adapters and what a new provider of each kind starts with. */
    const KINDS = {
      anthropic: { labelKey: 'ai.kind.anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', path: '/v1/messages', models: '/v1/models' },
      openai: { labelKey: 'ai.kind.openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5', path: '/chat/completions', models: '/models' },
    };
    /** The models to choose from before the server's own list is fetched: per kind, and for a model on the user's own computer. */
    const MODELS = {
      anthropic: ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
      openai: ['gpt-5', 'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano'],
      local: ['llama3.2'],
    };
    /** Ready-made starting points for the dialog. */
    const PRESETS = [
      { id: 'anthropic', kind: 'anthropic', nameKey: 'ai.preset.anthropic', baseUrl: KINDS.anthropic.baseUrl, model: KINDS.anthropic.model },
      { id: 'openai', kind: 'openai', nameKey: 'ai.preset.openai', baseUrl: KINDS.openai.baseUrl, model: KINDS.openai.model },
      { id: 'ollama', kind: 'openai', nameKey: 'ai.preset.ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: MODELS.local[0] },
    ];
    const MAX_MODELS = 200;
    const ANTHROPIC_VERSION = '2023-06-01';
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };
    /** OpenAI's own service, whose newer models take max_completion_tokens instead of max_tokens. */
    const isOpenAi = (url) => { try { return /(^|\.)openai\.com$/i.test(new URL(url).hostname); } catch (_e) { return false; } };
    /** A provider on the user's own computer: loopback or a .local name. */
    function isLocal(baseUrl) {
      let host = '';
      try { host = new URL(baseUrl).hostname.toLowerCase(); } catch (_e) { return false; }
      return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.localhost') || host.endsWith('.local');
    }

    // ---------------------------------------------------------------------------- the saved providers
    const listeners = new Set();
    const notify = () => { for (const fn of Array.from(listeners)) { try { fn(); } catch (err) { console.error(err); } } };
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    /** @returns {Promise<Array<{id: string, kind: string, name: string, baseUrl: string, model: string}>>} */
    async function list() { const v = await idb.getSetting(SETTING, []); return Array.isArray(v) ? v : []; }
    async function get(id) { return (await list()).find((p) => p.id === id) || null; }
    /** A list of model names as the setting keeps it: strings, trimmed, each once, at most MAX_MODELS. */
    const cleanModels = (names) => Array.from(new Set((Array.isArray(names) ? names : []).map((m) => String(m || '').trim().slice(0, 120)).filter(Boolean))).slice(0, MAX_MODELS);
    /**
     * Save a provider (new or changed); the key is set apart with `setKey` or `saveKey`. `models` is the server's own list, kept
     * from an earlier save when not given.
     */
    async function save(provider) {
      const p = { id: String(provider.id || ('ai-' + Date.now().toString(36))), kind: KINDS[provider.kind] ? provider.kind : 'openai', name: String(provider.name || '').trim() || hostOf(provider.baseUrl), baseUrl: trimUrl(provider.baseUrl), model: String(provider.model || '').trim() };
      if (!/^https?:\/\//i.test(p.baseUrl) && !/^dataspatium-asset:\/\//.test(p.baseUrl)) throw new Error(t('ai.err.address'));
      if (!p.model) throw new Error(t('ai.err.model'));
      const all = await list();
      const i = all.findIndex((x) => x.id === p.id);
      const models = cleanModels(provider.models !== undefined ? provider.models : i >= 0 ? all[i].models : []);
      if (models.length) p.models = models;
      if (i >= 0) all[i] = p; else all.push(p);
      await idb.setSetting(SETTING, all);
      notify();
      return p;
    }
    /** Choose a saved provider's model (the panel's list); the choice is kept with the provider. @param {string} id @param {string} model */
    async function setModel(id, model) {
      const p = await get(id);
      if (!p) throw new Error(t('ai.err.model'));
      return p.model === String(model || '').trim() ? p : save(Object.assign({}, p, { model }));
    }
    /**
     * The models to choose from for a provider: its kind's own list (OpenAI's for OpenAI's service, the local default for a model on
     * the user's computer), then the server's list once fetched, and always the chosen one.
     * @param {{kind?: string, baseUrl?: string, model?: string, models?: string[]}} provider
     */
    function modelsFor(provider) {
      const p = provider || {};
      const own = p.kind === 'anthropic' ? MODELS.anthropic : isLocal(p.baseUrl) ? MODELS.local : isOpenAi(p.baseUrl) || !p.baseUrl ? MODELS.openai : [];
      return cleanModels([].concat(own, p.models || [], p.model ? [p.model] : []));
    }
    async function remove(id) {
      await idb.setSetting(SETTING, (await list()).filter((p) => p.id !== id));
      secrets.forget(id);
      notify();
    }
    /** The key, kept by api/secrets (the session, or encrypted with the passphrase). */
    function setKey(id, key) { const had = secrets.get(id) || {}; secrets.set(id, Object.assign({}, had, { apiKey: String(key || '') })); }
    function hasKey(id) { const c = secrets.get(id); return !!(c && c.apiKey); }
    const keyOf = (id) => { const c = secrets.get(id); return c && c.apiKey ? String(c.apiKey) : ''; };
    /**
     * The key stored encrypted with the passphrase (api/secrets), and kept in the session too, so that it is there after the app is
     * opened again once the stored keys are unlocked; without `key` the one given in this session is stored.
     * @param {string} id @param {string|null} key @param {string} passphrase
     */
    async function saveKey(id, key, passphrase) {
      const values = Object.assign({}, secrets.get(id) || {});
      if (key) values.apiKey = String(key);
      if (!values.apiKey) throw new Error(t('ai.test.nokey'));
      await secrets.persist(id, values, passphrase);
    }
    /** Forgets the key in the session and the stored one. @param {string} id */
    const forgetKey = (id) => secrets.forget(id);
    /** Keeps the key for this session only: the stored one is forgotten. @param {string} id */
    async function unstoreKey(id) {
      const had = secrets.get(id);
      await secrets.forget(id);
      if (had) secrets.set(id, had);
    }
    /** Unlocks every stored key with the passphrase; returns how many. @param {string} passphrase */
    const unlockKeys = (passphrase) => secrets.unlock(passphrase);
    /**
     * Where a provider's key is: `session` (for this session only), `saved` (stored encrypted and unlocked), `locked` (stored
     * encrypted, not unlocked since the app opened), `local` (none, and a model on the user's computer needs none) or `missing`.
     * @param {{id: string, baseUrl: string}} provider @returns {Promise<'session'|'saved'|'locked'|'local'|'missing'>}
     */
    async function keyState(provider) {
      const has = hasKey(provider.id);
      const stored = await secrets.isPersisted(provider.id).catch(() => false);
      if (has) return stored ? 'saved' : 'session';
      if (stored) return 'locked';
      return isLocal(provider.baseUrl) ? 'local' : 'missing';
    }
    const subscribeKeys = (fn) => secrets.subscribe(fn);

    // ---------------------------------------------------------------------------- the policy
    async function policy() { const v = await idb.getSetting(POLICY_SETTING, 'ask'); return POLICIES.includes(v) ? v : 'ask'; }
    async function setPolicy(value) { if (!POLICIES.includes(value)) throw new Error('policy'); await idb.setSetting(POLICY_SETTING, value); notify(); }
    /** Whether a provider may be called now: the policy, then the consent for its host. Throws when not. */
    async function allowed(provider) {
      const pol = await policy();
      if (pol === 'local' && !isLocal(provider.baseUrl)) throw new Error(t('ai.err.policy.local', { host: hostOf(provider.baseUrl) }));
      await consent.require('ai', { host: hostOf(provider.baseUrl), label: provider.name });
      return true;
    }

    // ---------------------------------------------------------------------------- the two adapters
    /** A tool's parameters for the strict modes: a flat object, every field required, no additional properties. */
    function strictSchema(parameters) {
      const props = (parameters && parameters.properties) || {};
      return { type: 'object', properties: props, required: Object.keys(props), additionalProperties: false };
    }
    /**
     * A user message's content in the provider's form: text, or blocks of text and images (base64, decision F43 a); a provider that
     * cannot see images gets the text alone.
     */
    function userContent(content, kind) {
      if (!Array.isArray(content)) return String(content);
      return content.map((b) => {
        if (b && b.type === 'image' && b.data) {
          const mediaType = String(b.mediaType || 'image/jpeg');
          return kind === 'anthropic' ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: String(b.data) } } : { type: 'image_url', image_url: { url: `data:${mediaType};base64,${String(b.data)}` } };
        }
        return { type: 'text', text: String((b && b.text) || '') };
      });
    }
    /** The text of an assistant message's blocks. */
    const textOf = (content) => (typeof content === 'string' ? content : (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
    /**
     * The OpenAI-compatible models known to take pictures; the others are taken to read text only. Every Claude model sees pictures.
     */
    const SEES = /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|chatgpt|\bo[134](?!-mini)|\bo4-mini|gemini|claude|vision|llava|moondream|minicpm-v|vl\b|pixtral|gemma-?3|llama-?4|mistral-(small|medium)/i;
    /**
     * Whether a provider sees pictures, so that the picture tools' pictures go to it (ai/view-tools): Anthropic Messages always,
     * an OpenAI-compatible API when its model is one of SEES. @param {{kind?: string, model?: string}|null} provider
     */
    const seesImages = (provider) => !!provider && (provider.kind === 'anthropic' || SEES.test(String(provider.model || '')));
    /** A tool's picture as the kind's image block. @param {{mediaType?: string, data: string}} image @param {string} kind */
    const imageBlock = (image, kind) => userContent([{ type: 'image', mediaType: image.mediaType, data: image.data }], kind)[0];

    function anthropicBody(provider, req) {
      const messages = [];
      const sees = seesImages(provider);
      for (const m of req.messages) {
        // A tool's picture goes in its result, after the words (decision B-84).
        if (m.role === 'tool') messages.push({ role: 'user', content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: sees && r.image && r.image.data ? [{ type: 'text', text: String(r.content) }, imageBlock(r.image, 'anthropic')] : String(r.content) })) });
        else if (m.role === 'assistant') messages.push({ role: 'assistant', content: (typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content).map((b) => (b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: b.input || {} } : { type: 'text', text: b.text || '' })).filter((b) => b.type === 'tool_use' || b.text) });
        else messages.push({ role: 'user', content: userContent(m.content, 'anthropic') });
      }
      const body = { model: provider.model, max_tokens: req.maxTokens || 1024, messages };
      if (req.system) body.system = req.system;
      if (req.tools && req.tools.length) body.tools = req.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: strictSchema(tool.parameters) }));
      return body;
    }
    function anthropicAnswer(data) {
      const content = Array.isArray(data.content) ? data.content : [];
      return {
        text: content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(),
        toolCalls: content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} })),
        content: content.map((b) => (b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: b.input || {} } : { type: 'text', text: b.text || '' })),
        usage: { input: Number(data.usage && data.usage.input_tokens) || 0, output: Number(data.usage && data.usage.output_tokens) || 0 },
        stop: data.stop_reason || '',
      };
    }
    function openaiBody(provider, req) {
      const messages = [];
      const sees = seesImages(provider);
      if (req.system) messages.push({ role: 'system', content: req.system });
      for (const m of req.messages) {
        if (m.role === 'tool') {
          for (const r of m.results) messages.push({ role: 'tool', tool_call_id: r.id, content: String(r.content) });
          // A tool message takes text only: the tools' pictures follow in one user message, each after a line that names its call.
          const shots = sees ? m.results.filter((r) => r.image && r.image.data) : [];
          if (shots.length) messages.push({ role: 'user', content: shots.flatMap((r) => [{ type: 'text', text: `[picture from the model: the answer of ${r.name}, call ${r.id}]` }, imageBlock(r.image, 'openai')]) });
        } else if (m.role === 'assistant') {
          const calls = (typeof m.content === 'string' ? [] : m.content.filter((b) => b.type === 'tool_use')).map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
          const msg = { role: 'assistant', content: textOf(m.content) || null };
          if (calls.length) msg.tool_calls = calls;
          messages.push(msg);
        } else messages.push({ role: 'user', content: userContent(m.content, 'openai') });
      }
      const body = { model: provider.model, messages };
      body[isOpenAi(provider.baseUrl) ? 'max_completion_tokens' : 'max_tokens'] = req.maxTokens || 1024;
      if (req.tools && req.tools.length) body.tools = req.tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: strictSchema(tool.parameters), strict: true } }));
      return body;
    }
    function openaiAnswer(data) {
      const choice = (data.choices || [])[0] || {};
      const msg = choice.message || {};
      const calls = (msg.tool_calls || []).map((c) => {
        let args = {};
        try { args = c.function && c.function.arguments ? JSON.parse(c.function.arguments) : {}; } catch (_e) { args = {}; }
        return { id: c.id, name: c.function ? c.function.name : '', args };
      });
      const text = typeof msg.content === 'string' ? msg.content.trim() : textOf(msg.content);
      const content = [];
      if (text) content.push({ type: 'text', text });
      for (const c of calls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.args });
      return { text, toolCalls: calls, content, usage: { input: Number(data.usage && data.usage.prompt_tokens) || 0, output: Number(data.usage && data.usage.completion_tokens) || 0 }, stop: choice.finish_reason || '' };
    }
    /** A text with the key put out of sight, should a server repeat it. @param {string} text @param {string} key */
    const masked = (text, key) => (key && key.length >= 4 ? String(text).split(key).join('•••') : String(text));
    /** The server's error in words, from the body when it has them; never the key. */
    function errorText(res, key) {
      let out;
      try { const data = JSON.parse(res.text); const e = data.error || data; out = String((e && (e.message || e.msg)) || '').slice(0, 300); } catch (_e) { out = String(res.text || '').replace(/\s+/g, ' ').slice(0, 200); }
      return masked(out, key);
    }
    /** The request's headers for a provider: the key as the kind wants it, never anywhere else. */
    function headersFor(provider, key, accept) {
      const headers = { Accept: accept || 'application/json' };
      if (provider.kind === 'anthropic') { headers['x-api-key'] = key; headers['anthropic-version'] = ANTHROPIC_VERSION; headers['anthropic-dangerous-direct-browser-access'] = 'true'; }
      else if (key) headers.Authorization = 'Bearer ' + key;
      return headers;
    }
    /** Providers that refused to stream in this session: they get the plain call. */
    const noStream = new Set();
    /** A refusal to stream: a 400 or 422 whose words name the stream (an unknown `stream` or `stream_options`). */
    const refusesStream = (res) => (res.status === 400 || res.status === 422) && /stream/i.test(String(res.text || ''));
    /**
     * One exchange with a provider. The answer is streamed, and `onDelta` gets its pieces as they come: {type: 'text', text},
     * {type: 'tool', name} when a tool call begins, and {type: 'usage', input, output}. A server that answers without a stream,
     * or refuses one, gets the same call without it, and the answer is the same; `stream: false` asks for the plain call at once.
     * @param {{id: string, kind: string, name: string, baseUrl: string, model: string}} provider
     * @param {{system?: string, messages: any[], tools?: any[], maxTokens?: number, signal?: AbortSignal, timeoutMs?: number, stream?: boolean, onDelta?: (d: any) => void}} req
     * @returns {Promise<{text: string, toolCalls: Array<{id: string, name: string, args: any}>, content: any[], usage: {input: number, output: number}, stop: string, streamed: boolean}>}
     */
    async function chat(provider, req) {
      await allowed(provider);
      const kind = KINDS[provider.kind] || KINDS.openai;
      const key = keyOf(provider.id);
      if (!key && !isLocal(provider.baseUrl)) throw new Error(t('ai.err.nokey', { name: provider.name }));
      const streaming = req.stream !== false && !noStream.has(provider.id);
      const headers = Object.assign({ 'Content-Type': 'application/json' }, headersFor(provider, key, streaming ? 'text/event-stream' : 'application/json'));
      const body = provider.kind === 'anthropic' ? anthropicBody(provider, req) : openaiBody(provider, req);
      if (streaming) { body.stream = true; if (provider.kind !== 'anthropic') body.stream_options = { include_usage: true }; }
      const res = await http.request({ url: trimUrl(provider.baseUrl) + kind.path, method: 'POST', headers, body: JSON.stringify(body), signal: req.signal, timeoutMs: req.timeoutMs || 120000, retries: 0, rateKey: 'ai:' + provider.id, responseType: streaming ? 'stream' : undefined });
      if (!res.ok) {
        if (streaming && refusesStream(res)) { noStream.add(provider.id); return chat(provider, Object.assign({}, req, { stream: false })); }
        throw new http.ApiError(t('ai.err.provider', { name: provider.name, detail: `${http.describeStatus(res.status)} ${errorText(res, key)}`.trim() }), { kind: 'http', status: res.status });
      }
      const answer = (data, streamed) => Object.assign(provider.kind === 'anthropic' ? anthropicAnswer(data) : openaiAnswer(data), { streamed });
      const failed = (err) => (err && err.name === 'AbortError' ? new http.ApiError('Avbrutet.', { kind: 'aborted' }) : new http.ApiError(t('ai.err.provider', { name: provider.name, detail: masked(String((err && err.message) || err), key) }), { kind: 'stream' }));
      if (streaming && res.body && /text\/event-stream/i.test(String(res.contentType || ''))) {
        try { return answer(await stream.read(res.body, provider.kind, { onDelta: req.onDelta, signal: req.signal }), true); } catch (err) { throw failed(err); }
      }
      let text = res.text;
      if (res.body) { try { text = await new Response(res.body).text(); } catch (err) { throw failed(err); } }
      // A relayed answer comes whole, and a server without the content type may still send events.
      if (streaming && stream.looksLikeEvents(text)) { try { return answer(stream.readText(text, provider.kind), false); } catch (err) { throw failed(err); } }
      let data;
      try { data = JSON.parse(text); } catch (_e) { throw new http.ApiError(t('ai.err.provider', { name: provider.name, detail: t('api.err.json', { text: masked(String(text || '').slice(0, 120), key) }) }), { kind: 'parse' }); }
      return answer(data, false);
    }

    /**
     * The server's own list of models, on the person's press (B-83): Anthropic's GET /v1/models, an OpenAI-compatible GET
     * {address}/models; after the policy and the consent for the host, as a question. The key may be one typed but not yet kept.
     * @param {{id?: string, kind: string, name?: string, baseUrl: string}} provider @param {{key?: string, signal?: AbortSignal, limit?: number}} [options]
     * @returns {Promise<{ok: boolean, status: number, models: string[], res: any, key: string}>}
     */
    async function listModels(provider, options = {}) {
      const p = Object.assign({ name: hostOf(provider.baseUrl) }, provider);
      await allowed(p);
      const kind = KINDS[p.kind] || KINDS.openai;
      const key = String(options.key || (p.id ? keyOf(p.id) : '') || '');
      const limit = options.limit || 1000;
      const url = trimUrl(p.baseUrl) + kind.models + (p.kind === 'anthropic' ? '?limit=' + limit : '');
      const res = await http.request({ url, method: 'GET', headers: headersFor(p, key), signal: options.signal, timeoutMs: 30000, retries: 0, rateKey: 'ai:' + (p.id || hostOf(p.baseUrl)) });
      let models = [];
      if (res.ok) {
        try { const data = JSON.parse(res.text); models = (Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []).map((m) => String((m && (m.id || m.name)) || '')).filter(Boolean); } catch (_e) { models = []; }
      }
      return { ok: res.ok, status: res.status, models: cleanModels(models).sort((a, b) => a.localeCompare(b)), res, key };
    }
    /**
     * Fetches the server's list of models; a server that refuses is an error in words. @param {any} provider @param {{key?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<string[]>}
     */
    async function fetchModels(provider, options = {}) {
      if (!options.key && !(provider.id && keyOf(provider.id)) && !isLocal(provider.baseUrl)) throw new Error(t('ai.test.nokey'));
      const out = await listModels(provider, options).catch((err) => { throw keyError(err, provider); });
      if (!out.ok) throw new Error(statusText(out.status, provider, errorText(out.res, out.key)));
      return out.models;
    }
    /** A refused or failed request in words, with what to do. */
    function statusText(status, provider, detail) {
      const host = hostOf(provider.baseUrl);
      const key = status === 401 ? 'ai.test.401' : status === 403 ? 'ai.test.403' : status === 404 || status === 405 ? 'ai.test.404' : status === 429 ? 'ai.test.429' : status >= 500 ? 'ai.test.5xx' : 'ai.test.other';
      return t(key, { host, status: String(status), detail: detail || '' }).trim();
    }
    /** A request that never got an answer (no network, or no CORS), in words; a refused consent or policy keeps its own words. */
    function keyError(err, provider) {
      if (err && (err.kind === 'network' || err.kind === 'timeout')) return new Error(t('ai.test.network', { host: hostOf(provider.baseUrl) }));
      return err instanceof Error ? err : new Error(String(err));
    }
    /**
     * Tries the key with the cheapest real call (B-83): the server's list of models, and for an OpenAI-compatible server without one
     * a message of one token. The answer says OK or, in words with what to do, what was wrong: the key (401), the access (403), the
     * address (404) or the reach (no network or no CORS). The key is never part of the answer.
     * @param {{id?: string, kind: string, name?: string, baseUrl: string, model?: string}} provider @param {{key?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<{ok: boolean, status: number, code: string, message: string, models: string[]}>}
     */
    async function testKey(provider, options = {}) {
      const key = String(options.key || (provider.id ? keyOf(provider.id) : '') || '');
      if (!key && !isLocal(provider.baseUrl)) return { ok: false, status: 0, code: 'nokey', message: t('ai.test.nokey'), models: [] };
      let out;
      try { out = await listModels(provider, { key, signal: options.signal, limit: 1 }); } catch (err) {
        const e = keyError(err, provider);
        return { ok: false, status: 0, code: err && (err.kind === 'network' || err.kind === 'timeout') ? 'network' : 'refused', message: e.message, models: [] };
      }
      if (out.ok) return { ok: true, status: out.status, code: 'ok', message: t('ai.test.ok', { host: hostOf(provider.baseUrl) }), models: out.models };
      if ((out.status === 404 || out.status === 405) && provider.kind !== 'anthropic' && provider.model) {
        // No list of models on this server: one token of an answer tells as much.
        const res = await http.request({ url: trimUrl(provider.baseUrl) + KINDS.openai.path, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headersFor(provider, key)),
          body: JSON.stringify(Object.assign({ model: provider.model, messages: [{ role: 'user', content: 'ping' }] }, { [isOpenAi(provider.baseUrl) ? 'max_completion_tokens' : 'max_tokens']: 1 })), signal: options.signal, timeoutMs: 30000, retries: 0 }).catch((err) => err);
        if (res && res.ok) return { ok: true, status: res.status, code: 'ok', message: t('ai.test.ok', { host: hostOf(provider.baseUrl) }), models: [] };
        if (res && typeof res.status === 'number') out = { status: res.status, res, key };
      }
      const code = out.status === 401 ? 'key' : out.status === 403 ? 'access' : out.status === 404 || out.status === 405 ? 'address' : 'other';
      return { ok: false, status: out.status, code, message: statusText(out.status, provider, errorText(out.res, key)), models: [] };
    }
    return { KINDS, MODELS, PRESETS, POLICIES, list, get, save, setModel, modelsFor, remove, setKey, hasKey, saveKey, forgetKey, unstoreKey, unlockKeys, keyState, subscribeKeys, isLocal, hostOf, policy, setPolicy, allowed, chat, fetchModels, testKey, subscribe, seesImages };
  });
})();
