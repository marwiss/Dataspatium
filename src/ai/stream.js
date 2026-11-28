// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Answers from an AI provider as they are written (B-83): a parser for server-sent events and two collectors that build the same
 * answer as the non-streaming call, Anthropic Messages (message_start, content_block_start, content_block_delta with text_delta and
 * input_json_delta, message_delta with its usage) and OpenAI-compatible Chat Completions (choices[].delta with its content and
 * tool_calls, the usage in the last chunk). The collectors report each piece through `onDelta` ({type: 'text', text}, {type: 'tool',
 * name}, {type: 'usage', input, output}), and `read` follows a response body until it ends or the signal aborts it. Nothing here
 * calls the network or touches the page; the text reaches the page only as text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ai/stream', [], () => {
    /**
     * A parser of server-sent events: `push` takes text as it comes, in any slices, and `onEvent(name, data)` gets each event whose
     * data lines are joined by line breaks; comments and other fields are skipped, and `end` hands over an event left without its
     * blank line. @param {(name: string, data: string) => void} onEvent
     */
    function parser(onEvent) {
      let buffer = ''; let name = ''; let data = []; let lastCR = false;
      const dispatch = () => {
        if (data.length) onEvent(name || 'message', data.join('\n'));
        name = ''; data = [];
      };
      const line = (text) => {
        if (text === '') { dispatch(); return; }
        if (text[0] === ':') return;
        const at = text.indexOf(':');
        const field = at < 0 ? text : text.slice(0, at);
        let value = at < 0 ? '' : text.slice(at + 1);
        if (value[0] === ' ') value = value.slice(1);
        if (field === 'event') name = value;
        else if (field === 'data') data.push(value);
      };
      return {
        /** @param {string} chunk */
        push(chunk) {
          let text = String(chunk);
          // A CR at the end of the last slice and an LF at the start of this one are one line break.
          if (lastCR && text[0] === '\n') text = text.slice(1);
          lastCR = text.endsWith('\r');
          buffer += text;
          for (;;) {
            const m = /\r\n|\r|\n/.exec(buffer);
            if (!m) break;
            // A CR at the very end may be the first half of CRLF: keep it until the next slice says.
            if (m[0] === '\r' && m.index === buffer.length - 1) { line(buffer.slice(0, m.index)); buffer = ''; break; }
            line(buffer.slice(0, m.index));
            buffer = buffer.slice(m.index + m[0].length);
          }
        },
        end() { if (buffer) { line(buffer); buffer = ''; } dispatch(); },
      };
    }
    const parse = (text) => { try { return JSON.parse(text); } catch (_e) { return null; } };
    const emit = (onDelta, d) => { if (onDelta) { try { onDelta(d); } catch (err) { console.error(err); } } };
    /** An error the provider sent inside the stream. */
    function streamError(e) {
      const err = new Error(String((e && (e.message || e.type)) || 'stream error').slice(0, 300));
      /** @type {any} */ (err).streamError = true;
      return err;
    }

    /**
     * Collects Anthropic's events into the shape of a non-streaming answer: {content, stop_reason, usage}. Thinking blocks are left
     * out, as the non-streaming answer leaves them out. @param {(d: any) => void} [onDelta]
     */
    function anthropic(onDelta) {
      const blocks = [];
      const usage = { input_tokens: 0, output_tokens: 0 };
      let stop = '';
      let seen = false;
      const report = () => emit(onDelta, { type: 'usage', input: usage.input_tokens, output: usage.output_tokens });
      return {
        /** @param {string} name @param {string} text */
        event(name, text) {
          const ev = parse(text);
          if (!ev) return;
          const type = ev.type || name;
          seen = true;
          if (type === 'error') throw streamError(ev.error);
          if (type === 'message_start') {
            const u = (ev.message && ev.message.usage) || {};
            usage.input_tokens = Number(u.input_tokens) || 0; usage.output_tokens = Number(u.output_tokens) || 0;
            report();
          } else if (type === 'content_block_start') {
            const b = ev.content_block || {};
            if (b.type === 'text') blocks[ev.index] = { type: 'text', text: String(b.text || '') };
            else if (b.type === 'tool_use') { blocks[ev.index] = { type: 'tool_use', id: b.id, name: b.name, json: '' }; emit(onDelta, { type: 'tool', name: String(b.name || '') }); }
            else blocks[ev.index] = null;
          } else if (type === 'content_block_delta') {
            const b = blocks[ev.index];
            const d = ev.delta || {};
            if (!b) return;
            if (d.type === 'text_delta' && b.type === 'text') { b.text += String(d.text || ''); emit(onDelta, { type: 'text', text: String(d.text || '') }); }
            else if (d.type === 'input_json_delta' && b.type === 'tool_use') b.json += String(d.partial_json || '');
          } else if (type === 'message_delta') {
            if (ev.delta && ev.delta.stop_reason) stop = String(ev.delta.stop_reason);
            const u = ev.usage || {};
            if (u.output_tokens !== undefined) usage.output_tokens = Number(u.output_tokens) || 0;
            if (u.input_tokens !== undefined) usage.input_tokens = Number(u.input_tokens) || usage.input_tokens;
            report();
          }
        },
        /** Whether any event was read: a body that held none is not an answer. */
        seen: () => seen,
        result() {
          const content = blocks.filter(Boolean).map((b) => (b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: (b.json ? parse(b.json) : null) || {} } : b));
          return { content, stop_reason: stop, usage };
        },
      };
    }

    /**
     * Collects an OpenAI-compatible stream into the shape of a non-streaming answer: {choices: [{message, finish_reason}], usage}.
     * The tool calls come in pieces by their index: the id and the name first, the arguments in slices. @param {(d: any) => void} [onDelta]
     */
    function openai(onDelta) {
      let text = '';
      const calls = [];
      let finish = '';
      let usage = null;
      let seen = false;
      return {
        /** @param {string} _name @param {string} raw */
        event(_name, raw) {
          if (String(raw).trim() === '[DONE]') return;
          const ev = parse(raw);
          if (!ev) return;
          seen = true;
          if (ev.error) throw streamError(ev.error);
          if (ev.usage) {
            usage = { prompt_tokens: Number(ev.usage.prompt_tokens) || 0, completion_tokens: Number(ev.usage.completion_tokens) || 0 };
            emit(onDelta, { type: 'usage', input: usage.prompt_tokens, output: usage.completion_tokens });
          }
          for (const choice of Array.isArray(ev.choices) ? ev.choices : []) {
            if ((choice.index || 0) !== 0) continue;
            const d = choice.delta || {};
            if (typeof d.content === 'string' && d.content) { text += d.content; emit(onDelta, { type: 'text', text: d.content }); }
            for (const tc of Array.isArray(d.tool_calls) ? d.tool_calls : []) {
              const i = Number.isInteger(tc.index) ? tc.index : calls.length;
              const fn = tc.function || {};
              if (!calls[i]) calls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              const c = calls[i];
              if (tc.id) c.id = String(tc.id);
              if (fn.name) { const first = !c.function.name; c.function.name += String(fn.name); if (first) emit(onDelta, { type: 'tool', name: c.function.name }); }
              if (fn.arguments) c.function.arguments += String(fn.arguments);
            }
            if (choice.finish_reason) finish = String(choice.finish_reason);
          }
        },
        seen: () => seen,
        result() {
          const message = { role: 'assistant', content: text || null };
          const list = calls.filter(Boolean).map((c, i) => Object.assign(c, { id: c.id || 'call_' + i }));
          if (list.length) message.tool_calls = list;
          return { choices: [{ index: 0, message, finish_reason: finish }], usage: usage || { prompt_tokens: 0, completion_tokens: 0 } };
        },
      };
    }

    /** The collector for a provider's kind. @param {string} kind @param {(d: any) => void} [onDelta] */
    const collector = (kind, onDelta) => (kind === 'anthropic' ? anthropic(onDelta) : openai(onDelta));

    /** An abort as the fetch API reports it. */
    function aborted() { const err = new Error('aborted'); err.name = 'AbortError'; return err; }

    /**
     * Follows a response body of server-sent events to its end and returns the collected answer; an aborted signal cancels the
     * reading at once and rejects with an AbortError.
     * @param {ReadableStream<Uint8Array>} body @param {string} kind @param {{onDelta?: (d: any) => void, signal?: AbortSignal}} [options]
     * @returns {Promise<any>} the answer in the provider's non-streaming shape
     */
    async function read(body, kind, options = {}) {
      const c = collector(kind, options.onDelta);
      const p = parser((name, data) => c.event(name, data));
      const reader = body.getReader();
      const decoder = new TextDecoder();
      const signal = options.signal;
      const onAbort = () => { reader.cancel().catch(() => {}); };
      if (signal) { if (signal.aborted) { onAbort(); throw aborted(); } signal.addEventListener('abort', onAbort, { once: true }); }
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (signal && signal.aborted) throw aborted();
          if (done) break;
          p.push(decoder.decode(value, { stream: true }));
        }
        p.push(decoder.decode());
        p.end();
      } catch (err) {
        if (signal && signal.aborted) throw aborted();
        throw err;
      } finally {
        if (signal) signal.removeEventListener('abort', onAbort);
      }
      if (!c.seen()) throw streamError({ message: 'the stream ended without an answer' });
      return c.result();
    }

    /** A whole body of server-sent events read at once (a relayed answer), into the same shape. @param {string} text @param {string} kind */
    function readText(text, kind) {
      const c = collector(kind);
      const p = parser((name, data) => c.event(name, data));
      p.push(String(text)); p.end();
      return c.result();
    }
    /** Whether a text is a body of server-sent events. @param {string} text */
    const looksLikeEvents = (text) => /^\s*(event|data|:)/.test(String(text || ''));

    return { parser, anthropic, openai, collector, read, readText, looksLikeEvents };
  });
})();
