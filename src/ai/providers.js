// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * AI providers for "Fråga AI om modellen": two adapters, Anthropic Messages and OpenAI-compatible Chat Completions (which also covers
 * Gemini's OpenAI endpoint and local servers such as Ollama, vLLM and llama.cpp), written as classic scripts without SDKs. A provider
 * is a saved setting (kind, name, address, model); its key lives in api/secrets, never in the setting, the logs or the AI's context.
 * Nothing is called without the consent purpose `ai` for the provider's host, and the policy `local` refuses every host that is not
 * the user's own computer. Requests and answers are normalised to one shape so that the agent loop does not know the provider.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/providers', ['api/http', 'api/secrets', 'platform/consent', 'platform/storage/idb'], (http, secrets, consent, idb) => {
    const t = (k, p) => D.t(k, p);
    const SETTING = 'ai.providers';
    const POLICY_SETTING = 'ai.policy';
    /** The policies: ask per host (the consent dialog), cloud allowed, or only the user's own computer. */
    const POLICIES = ['ask', 'cloud', 'local'];
    /** The two adapters and what a new provider of each kind starts with. */
    const KINDS = {
      anthropic: { labelKey: 'ai.kind.anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', path: '/v1/messages' },
      openai: { labelKey: 'ai.kind.openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5', path: '/chat/completions' },
    };
    /** Ready-made starting points for the dialog. */
    const PRESETS = [
      { id: 'anthropic', kind: 'anthropic', nameKey: 'ai.preset.anthropic', baseUrl: KINDS.anthropic.baseUrl, model: KINDS.anthropic.model },
      { id: 'openai', kind: 'openai', nameKey: 'ai.preset.openai', baseUrl: KINDS.openai.baseUrl, model: KINDS.openai.model },
      { id: 'ollama', kind: 'openai', nameKey: 'ai.preset.ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2' },
    ];
    const ANTHROPIC_VERSION = '2023-06-01';
    const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
    const hostOf = (url) => { try { return new URL(url).host || String(url); } catch (_e) { return String(url); } };
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
    /** Save a provider (new or changed); the key is set apart with `setKey`. */
    async function save(provider) {
      const p = { id: String(provider.id || ('ai-' + Date.now().toString(36))), kind: KINDS[provider.kind] ? provider.kind : 'openai', name: String(provider.name || '').trim() || hostOf(provider.baseUrl), baseUrl: trimUrl(provider.baseUrl), model: String(provider.model || '').trim() };
      if (!/^https?:\/\//i.test(p.baseUrl) && !/^dataspatium-asset:\/\//.test(p.baseUrl)) throw new Error(t('ai.err.address'));
      if (!p.model) throw new Error(t('ai.err.model'));
      const all = await list();
      const i = all.findIndex((x) => x.id === p.id);
      if (i >= 0) all[i] = p; else all.push(p);
      await idb.setSetting(SETTING, all);
      notify();
      return p;
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

    function anthropicBody(provider, req) {
      const messages = [];
      for (const m of req.messages) {
        if (m.role === 'tool') messages.push({ role: 'user', content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: String(r.content) })) });
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
      if (req.system) messages.push({ role: 'system', content: req.system });
      for (const m of req.messages) {
        if (m.role === 'tool') for (const r of m.results) messages.push({ role: 'tool', tool_call_id: r.id, content: String(r.content) });
        else if (m.role === 'assistant') {
          const calls = (typeof m.content === 'string' ? [] : m.content.filter((b) => b.type === 'tool_use')).map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
          const msg = { role: 'assistant', content: textOf(m.content) || null };
          if (calls.length) msg.tool_calls = calls;
          messages.push(msg);
        } else messages.push({ role: 'user', content: userContent(m.content, 'openai') });
      }
      const body = { model: provider.model, messages, max_tokens: req.maxTokens || 1024 };
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
    /** The server's error in words, from the body when it has them. */
    function errorText(res) {
      try { const data = JSON.parse(res.text); const e = data.error || data; return String((e && (e.message || e.msg)) || '').slice(0, 300); } catch (_e) { return String(res.text || '').replace(/\s+/g, ' ').slice(0, 200); }
    }
    /**
     * One exchange with a provider.
     * @param {{id: string, kind: string, name: string, baseUrl: string, model: string}} provider
     * @param {{system?: string, messages: any[], tools?: any[], maxTokens?: number, signal?: AbortSignal, timeoutMs?: number}} req
     * @returns {Promise<{text: string, toolCalls: Array<{id: string, name: string, args: any}>, content: any[], usage: {input: number, output: number}, stop: string}>}
     */
    async function chat(provider, req) {
      await allowed(provider);
      const kind = KINDS[provider.kind] || KINDS.openai;
      const key = keyOf(provider.id);
      if (!key && !isLocal(provider.baseUrl)) throw new Error(t('ai.err.nokey', { name: provider.name }));
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (provider.kind === 'anthropic') { headers['x-api-key'] = key; headers['anthropic-version'] = ANTHROPIC_VERSION; headers['anthropic-dangerous-direct-browser-access'] = 'true'; }
      else if (key) headers.Authorization = 'Bearer ' + key;
      const body = provider.kind === 'anthropic' ? anthropicBody(provider, req) : openaiBody(provider, req);
      const res = await http.request({ url: trimUrl(provider.baseUrl) + kind.path, method: 'POST', headers, body: JSON.stringify(body), signal: req.signal, timeoutMs: req.timeoutMs || 120000, retries: 0, rateKey: 'ai:' + provider.id });
      if (!res.ok) throw new http.ApiError(t('ai.err.provider', { name: provider.name, detail: `${http.describeStatus(res.status)} ${errorText(res)}`.trim() }), { kind: 'http', status: res.status });
      let data;
      try { data = JSON.parse(res.text); } catch (_e) { throw new http.ApiError(t('ai.err.provider', { name: provider.name, detail: t('api.err.json', { text: String(res.text || '').slice(0, 120) }) }), { kind: 'parse' }); }
      return provider.kind === 'anthropic' ? anthropicAnswer(data) : openaiAnswer(data);
    }
    return { KINDS, PRESETS, POLICIES, list, get, save, remove, setKey, hasKey, isLocal, hostOf, policy, setPolicy, allowed, chat, subscribe };
  });
})();
