// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Styrning utifrån (Martin's F30 a, the third layer): programs on the computer run the app's commands through the bridge. The
 * page cannot listen, so it polls the bridge for queued commands (GET /commands/next), runs each through data/commands under the
 * app's own rules and posts the answer back (POST /commands/<id>/result); first it tells the bridge which commands exist
 * (POST /commands/catalog), so that the CLI and the MCP server (tools/dataspatium.py) can list them. Off at every start: the switch
 * lives in the session, turning it on asks the person once, the bridge must have been started with --allow-commands, and a command
 * that changes something is approved in the app's own dialog each time, like the AI's. Nothing here runs code from outside: a
 * command is looked up by name and checked against its schema.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('api/remote', ['api/bridge', 'data/commands'], (bridge, commands) => {
    const WAIT = 20;
    const PAUSE = 500;
    const state = { on: false, connected: false, reason: '', error: '', running: '', count: 0 };
    const listeners = new Set();
    /** @type {{confirm?: () => Promise<boolean>, approve?: (cmd: any, args: any, options: any) => Promise<boolean>, log?: (text: string, kind?: string) => void}|null} */
    let asker = null;
    let loop = null;
    let controller = null;
    const t = (k, p) => D.t(k, p);

    function notify() { for (const fn of Array.from(listeners)) { try { fn(status()); } catch (err) { console.error('[remote] listener failed', err); } } }
    /** @param {(s: any) => void} fn */
    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    /** The shell gives the dialogs: the confirmation when the switch goes on, the approval of a writing command, the log. */
    function setAsker(fn) { asker = fn || null; }
    function status() { return Object.assign({}, state); }
    const sleep = (ms, signal) => new Promise((resolve) => { if (signal.aborted) { resolve(); return; } const timer = setTimeout(resolve, ms); signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true }); });

    /**
     * Turns the control on (after the person's confirmation) or off. @param {boolean} on @returns {Promise<boolean>} the state afterwards
     */
    async function setOn(on) {
      if (on && !state.on) {
        if (asker && asker.confirm && !(await asker.confirm())) return false;
        state.on = true; state.count = 0; state.error = ''; state.reason = '';
        notify();
        start();
      } else if (!on && state.on) {
        state.on = false;
        stop();
        notify();
      }
      return state.on;
    }
    function stop() {
      if (controller) controller.abort();
      controller = null; loop = null;
      state.connected = false; state.running = '';
    }
    /** Starts polling when the switch is on and a bridge is connected; a bridge without --allow-commands is told. */
    function start() {
      if (loop || !state.on) return;
      if (!bridge.isConnected()) { state.reason = 'bridge'; state.connected = false; notify(); return; }
      controller = new AbortController();
      const signal = controller.signal;
      loop = (async () => {
        try {
          const info = await bridge.info(true);
          if (!info || !info.commands) { state.reason = 'flag'; state.connected = false; notify(); return; }
          await bridge.call('/commands/catalog', { commands: commands.list() });
          state.connected = true; state.reason = ''; state.error = ''; notify();
          while (!signal.aborted) {
            const next = await bridge.call('/commands/next?wait=' + WAIT);
            if (signal.aborted) break;
            if (!next || !next.id) { await sleep(PAUSE, signal); continue; }
            const name = String(next.name || '');
            state.running = name; state.count++; notify();
            const out = await commands.run(name, next.args, { approve: (cmd, args) => (asker && asker.approve ? asker.approve(cmd, args, { source: 'bridge' }) : Promise.resolve(false)), signal });
            state.running = ''; notify();
            if (asker && asker.log) asker.log(out.ok ? t('remote.log.done', { name }) : t('remote.log.failed', { name, error: String(out.error || '') }), out.ok ? 'info' : 'warn');
            if (signal.aborted) break;
            await bridge.call('/commands/' + encodeURIComponent(String(next.id)) + '/result', { ok: out.ok, result: out.ok ? out.result : null, error: out.ok ? null : String(out.error || '') });
          }
        } catch (err) {
          if (!signal.aborted) { state.reason = 'error'; state.error = String((err && err.message) || err); }
        } finally {
          loop = null; state.connected = false; state.running = '';
          notify();
        }
      })();
    }
    // The bridge connects or goes away while the switch is on: follow it.
    bridge.subscribe(() => {
      if (!state.on) return;
      if (bridge.isConnected()) { if (!loop) start(); } else { stop(); state.reason = 'bridge'; notify(); }
    });
    return { WAIT, PAUSE, status, subscribe, setAsker, setOn, start, stop };
  });
})();
