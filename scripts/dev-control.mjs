#!/usr/bin/env node
// Local control panel for the redmine-ops-dashboard dev servers.
//
// Usage:   node scripts/dev-control.mjs            (defaults to port 9999)
//          node scripts/dev-control.mjs --port 9000
//
// Opens an HTTP server with a small HTML control panel. Buttons start/stop
// the Vite web server (port 5173) and the Hono api server (port 8787).
// Status is determined by TCP-probing the dev ports, so externally-started
// servers also show as "running" — but only processes spawned here can be
// stopped from the panel (the panel labels those "managed").

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const IS_WIN = process.platform === 'win32';
const NPM = IS_WIN ? 'npm.cmd' : 'npm';

const args = process.argv.slice(2);
const portArgIdx = args.indexOf('--port');
const PANEL_PORT = portArgIdx >= 0 ? Number(args[portArgIdx + 1]) : 9999;

const SERVICES = {
  web: {
    label: 'Frontend (Vite)',
    port: 5173,
    url: 'http://localhost:5173/redmine-ops-dashboard/',
    npmArgs: ['run', 'dev'],
  },
  api: {
    label: 'Backend (Hono)',
    port: 8787,
    url: 'http://localhost:8787/health',
    npmArgs: ['run', 'dev:server'],
  },
};

/** @type {Record<string, {proc: import('node:child_process').ChildProcess, startedAt: number, log: string[]}>} */
const managed = {};

function probeHost(host, port, timeoutMs) {
  return new Promise((resolveProbe) => {
    const socket = connect({ host, port });
    let done = false;
    const finish = (up) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolveProbe(up);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

// Vite binds to IPv6 ::1 on Windows; Hono binds to IPv4. Race both so either wins.
async function tcpProbe(port, timeoutMs = 400) {
  const [v4, v6] = await Promise.all([
    probeHost('127.0.0.1', port, timeoutMs),
    probeHost('::1', port, timeoutMs),
  ]);
  return v4 || v6;
}

function appendLog(key, chunk) {
  const m = managed[key];
  if (!m) return;
  const text = chunk.toString();
  m.log.push(text);
  // Keep ~400 lines worth so the panel stays light.
  if (m.log.length > 400) m.log.splice(0, m.log.length - 400);
}

function startService(key) {
  if (managed[key]) {
    return { ok: false, error: 'already started by panel' };
  }
  const svc = SERVICES[key];
  if (!svc) return { ok: false, error: 'unknown service' };

  // The backend reads PORT from env (defaults 8787); strip it so a panel-level
  // PORT (e.g. set by preview tooling) can't bleed into the child and steal a
  // different port. Vite ignores PORT, so this is safe for both services.
  const { PORT, ...childEnv } = process.env;
  void PORT;

  // Windows requires shell: true to spawn .cmd files since Node 20 (CVE-2024-27980).
  // Args are hard-coded above, so there's no injection vector.
  const proc = spawn(NPM, svc.npmArgs, {
    cwd: REPO,
    env: childEnv,
    shell: IS_WIN,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !IS_WIN, // POSIX: own process group so we can kill -pid
  });

  managed[key] = { proc, startedAt: Date.now(), log: [] };

  proc.stdout?.on('data', (d) => appendLog(key, d));
  proc.stderr?.on('data', (d) => appendLog(key, d));
  proc.on('exit', (code, signal) => {
    appendLog(key, `\n[panel] process exited code=${code} signal=${signal}\n`);
    // Leave the final log on the entry briefly so the UI can show it, but
    // drop the proc reference so the service no longer counts as "managed".
    const entry = managed[key];
    if (entry) entry.proc = null;
    setTimeout(() => {
      if (managed[key] && !managed[key].proc) delete managed[key];
    }, 5_000);
  });
  proc.on('error', (err) => appendLog(key, `\n[panel] spawn error: ${err.message}\n`));

  return { ok: true, pid: proc.pid };
}

function stopService(key) {
  const m = managed[key];
  if (!m || !m.proc) return { ok: false, error: 'not managed by panel' };
  const pid = m.proc.pid;
  if (!pid) return { ok: false, error: 'no pid' };

  if (IS_WIN) {
    // Kill the whole npm.cmd → node tree. /T = tree, /F = force.
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.on('error', (err) => appendLog(key, `\n[panel] taskkill error: ${err.message}\n`));
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try { m.proc.kill('SIGTERM'); } catch { /* ignore */ }
    }
  }
  return { ok: true };
}

async function getStatus() {
  const [webUp, apiUp] = await Promise.all([
    tcpProbe(SERVICES.web.port),
    tcpProbe(SERVICES.api.port),
  ]);
  return {
    web: {
      ...publicSvc('web'),
      running: webUp,
      managed: Boolean(managed.web?.proc),
      pid: managed.web?.proc?.pid ?? null,
      uptimeMs: managed.web ? Date.now() - managed.web.startedAt : null,
    },
    api: {
      ...publicSvc('api'),
      running: apiUp,
      managed: Boolean(managed.api?.proc),
      pid: managed.api?.proc?.pid ?? null,
      uptimeMs: managed.api ? Date.now() - managed.api.startedAt : null,
    },
  };
}

function publicSvc(key) {
  const s = SERVICES[key];
  return { key, label: s.label, port: s.port, url: s.url };
}

function tailLog(key, maxChars = 8_000) {
  const m = managed[key];
  if (!m) return '';
  const joined = m.log.join('');
  return joined.length > maxChars ? joined.slice(joined.length - maxChars) : joined;
}

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  });
  res.end(buf);
}

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Redmine Ops — Dev Control</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0b1020;
    --panel: #141a30;
    --panel-2: #1c2440;
    --border: #2a325a;
    --text: #e6e9f5;
    --muted: #8a93b8;
    --green: #22c55e;
    --red: #ef4444;
    --amber: #f59e0b;
    --blue: #60a5fa;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: radial-gradient(1200px 600px at 20% -10%, #1b2350 0%, var(--bg) 60%);
    color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    min-height: 100vh;
    padding: 32px 20px;
  }
  .wrap { max-width: 900px; margin: 0 auto; }
  header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 24px; }
  h1 { font-size: 20px; margin: 0; font-weight: 600; letter-spacing: 0.2px; }
  header .sub { color: var(--muted); font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  .card {
    background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.25);
  }
  .card h2 { margin: 0 0 4px 0; font-size: 15px; font-weight: 600; }
  .card .port { color: var(--muted); font-size: 12px; font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; }
  .row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; gap: 12px; }
  .pill { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; border: 1px solid var(--border); background: rgba(255,255,255,0.02); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); box-shadow: 0 0 0 2px rgba(255,255,255,0.04); }
  .dot.up   { background: var(--green); box-shadow: 0 0 0 2px rgba(34,197,94,0.18); }
  .dot.down { background: var(--red);   box-shadow: 0 0 0 2px rgba(239,68,68,0.18); }
  .dot.warn { background: var(--amber); box-shadow: 0 0 0 2px rgba(245,158,11,0.18); }
  .btns { display: flex; gap: 8px; }
  button {
    appearance: none;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.04);
    color: var(--text);
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: transform .08s ease, background .12s ease, border-color .12s ease;
  }
  button:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.start { border-color: rgba(34,197,94,0.35); }
  button.start:hover:not(:disabled) { background: rgba(34,197,94,0.12); }
  button.stop  { border-color: rgba(239,68,68,0.35); }
  button.stop:hover:not(:disabled) { background: rgba(239,68,68,0.12); }
  .meta { color: var(--muted); font-size: 12px; margin-top: 10px; font-family: ui-monospace, "Cascadia Mono", Menlo, monospace; }
  a.link { color: var(--blue); text-decoration: none; }
  a.link:hover { text-decoration: underline; }
  details { margin-top: 12px; }
  details > summary { cursor: pointer; color: var(--muted); font-size: 12px; user-select: none; }
  pre.log {
    margin: 8px 0 0; padding: 10px; max-height: 220px; overflow: auto;
    background: #07091a; border: 1px solid var(--border); border-radius: 8px;
    font: 12px/1.45 ui-monospace, "Cascadia Mono", Menlo, monospace; color: #cdd4ee;
    white-space: pre-wrap; word-break: break-word;
  }
  footer { margin-top: 22px; color: var(--muted); font-size: 12px; text-align: center; }
  .toast {
    position: fixed; right: 16px; bottom: 16px;
    background: var(--panel-2); border: 1px solid var(--border); color: var(--text);
    padding: 10px 14px; border-radius: 8px; font-size: 13px;
    opacity: 0; transform: translateY(8px); transition: all .18s ease;
    pointer-events: none;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.err { border-color: rgba(239,68,68,0.5); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Redmine Ops — Dev Control</h1>
    <div class="sub">Polling every 2s · panel port <span id="panelPort"></span></div>
  </header>
  <div class="grid" id="cards"></div>
  <footer>Buttons drive <code>npm run dev</code> and <code>npm run dev:server</code>. External processes still show as running, but only panel-managed ones can be stopped from here.</footer>
</div>
<div class="toast" id="toast"></div>

<script>
const services = ['web', 'api'];

const cards = document.getElementById('cards');
document.getElementById('panelPort').textContent = location.port || '(default)';

function cardHtml(s) {
  return ` + '`' + `
    <div class="card" id="card-\${s.key}">
      <h2>\${s.label}</h2>
      <div class="port">localhost:\${s.port} · <a class="link" href="\${s.url}" target="_blank" rel="noreferrer">open</a></div>
      <div class="row">
        <span class="pill"><span class="dot" id="dot-\${s.key}"></span><span id="status-\${s.key}">checking…</span></span>
        <div class="btns">
          <button class="start" id="start-\${s.key}">Start</button>
          <button class="stop"  id="stop-\${s.key}">Stop</button>
        </div>
      </div>
      <div class="meta" id="meta-\${s.key}">—</div>
      <details>
        <summary>Recent output</summary>
        <pre class="log" id="log-\${s.key}">(no managed process)</pre>
      </details>
    </div>
  ` + '`' + `;
}

function toast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('err', !!isError);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

function fmtUptime(ms) {
  if (ms == null) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ' + (s % 60) + 's';
  return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
}

async function fetchStatus() {
  const r = await fetch('/api/status');
  return r.json();
}

async function fetchLog(key) {
  const r = await fetch('/api/log/' + key);
  return r.text();
}

async function postAction(action, key) {
  const r = await fetch('/api/' + action + '/' + key, { method: 'POST' });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.ok === false) {
    toast((body && body.error) || ('Failed: ' + action + ' ' + key), true);
  } else {
    toast(action + ' ' + key + ' ok');
  }
}

function paint(state) {
  for (const key of services) {
    const s = state[key];
    const dot = document.getElementById('dot-' + key);
    const status = document.getElementById('status-' + key);
    const meta = document.getElementById('meta-' + key);
    const startBtn = document.getElementById('start-' + key);
    const stopBtn = document.getElementById('stop-' + key);

    let label, cls;
    if (s.running && s.managed) { label = 'running · managed'; cls = 'up'; }
    else if (s.running)         { label = 'running · external'; cls = 'warn'; }
    else if (s.managed)         { label = 'starting…'; cls = 'warn'; }
    else                        { label = 'stopped'; cls = 'down'; }

    dot.className = 'dot ' + cls;
    status.textContent = label;

    const bits = [];
    if (s.pid) bits.push('pid ' + s.pid);
    if (s.uptimeMs != null) bits.push('up ' + fmtUptime(s.uptimeMs));
    meta.textContent = bits.length ? bits.join(' · ') : '—';

    startBtn.disabled = !!s.managed || s.running;
    stopBtn.disabled  = !s.managed;
  }
}

async function refreshLogs() {
  for (const key of services) {
    const el = document.getElementById('log-' + key);
    if (!el) continue;
    const open = el.closest('details')?.open;
    if (!open) continue;
    try {
      const text = await fetchLog(key);
      if (text && text.trim()) {
        const atBottom = Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) < 8;
        el.textContent = text;
        if (atBottom) el.scrollTop = el.scrollHeight;
      }
    } catch { /* ignore */ }
  }
}

async function tick() {
  try {
    const state = await fetchStatus();
    paint(state);
    await refreshLogs();
  } catch (e) {
    toast('Panel server unreachable', true);
  }
}

function bootstrap(state) {
  cards.innerHTML = services.map((k) => cardHtml(state[k])).join('');
  for (const key of services) {
    document.getElementById('start-' + key).addEventListener('click', () => postAction('start', key).then(tick));
    document.getElementById('stop-' + key).addEventListener('click', () => postAction('stop', key).then(tick));
  }
  paint(state);
}

fetchStatus().then((s) => { bootstrap(s); refreshLogs(); });
setInterval(tick, 2000);
</script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(HTML);
    return;
  }

  if (req.method === 'GET' && path === '/api/status') {
    sendJson(res, 200, await getStatus());
    return;
  }

  if (req.method === 'GET' && path.startsWith('/api/log/')) {
    const key = path.slice('/api/log/'.length);
    if (!SERVICES[key]) return sendJson(res, 404, { ok: false, error: 'unknown service' });
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(tailLog(key) || '(no managed process)');
    return;
  }

  const startMatch = path.match(/^\/api\/start\/(web|api)$/);
  if (req.method === 'POST' && startMatch) {
    const result = startService(startMatch[1]);
    sendJson(res, result.ok ? 200 : 409, result);
    return;
  }

  const stopMatch = path.match(/^\/api\/stop\/(web|api)$/);
  if (req.method === 'POST' && stopMatch) {
    const result = stopService(stopMatch[1]);
    sendJson(res, result.ok ? 200 : 409, result);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(PANEL_PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PANEL_PORT}/`;
  console.log(`[dev-control] panel ready at ${url}`);
  console.log('[dev-control] press Ctrl+C to exit (managed child processes will be killed)');
});

function shutdown() {
  console.log('\n[dev-control] shutting down — killing managed processes');
  for (const key of Object.keys(managed)) {
    try { stopService(key); } catch { /* ignore */ }
  }
  // Give taskkill a beat to fire before exit.
  setTimeout(() => process.exit(0), 400);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
