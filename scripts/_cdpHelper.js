import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/**
 * Boş bir TCP port numarası bulur (127.0.0.1 üzerinde).
 */
export function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/**
 * HTTP sunucusu hazır olana kadar bekler.
 */
export async function waitForHttpReady(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // Henüz hazır değil
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`HTTP sunucusu zaman aşımına uğradı: ${url}`);
}

/**
 * Verilen dizini 127.0.0.1 üzerinde statik olarak sunar (fixture / build önizleme için).
 */
export function startStaticServer(rootDir, port) {
  const mimeMap = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const safeRel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const fullPath = path.resolve(rootDir, safeRel);
      const safeRoot = path.resolve(rootDir);
      if (!fullPath.startsWith(safeRoot) || !fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const stat = fs.statSync(fullPath);
      const targetFile = stat.isDirectory() ? path.join(fullPath, 'index.html') : fullPath;
      if (!fs.existsSync(targetFile)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(targetFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(targetFile).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(err.message);
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

/**
 * Vite preview sunucusunu başlatır (dist/ çıktısı üzerinden).
 */
export async function startVitePreview(cwd, port) {
  const proc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  proc.stdout.on('data', (d) => { logs += d.toString(); });
  proc.stderr.on('data', (d) => { logs += d.toString(); });

  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForHttpReady(url, 15000);
  } catch (err) {
    proc.kill('SIGKILL');
    throw new Error(`Vite preview başlatılamadı: ${err.message}\n${logs}`);
  }

  return {
    proc,
    url,
    close: async () => {
      if (!proc.killed) {
        proc.kill('SIGTERM');
        await new Promise((r) => setTimeout(r, 300));
        if (!proc.killed) proc.kill('SIGKILL');
      }
    },
  };
}

/**
 * Headless Chromium + WebSocket CDP istemcisi başlatır (sıfır harici bağımlılık).
 */
export async function launchChromiumCdp({ width = 1920, height = 1200 } = {}) {
  const cdpPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-cdp-'));

  const proc = spawn('/usr/bin/chromium', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrLogs = '';
  proc.stderr.on('data', (d) => { stderrLogs += d.toString(); });

  // CDP hedef listesinin hazır olmasını bekle
  const listUrl = `http://127.0.0.1:${cdpPort}/json/list`;
  let target = null;
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(listUrl);
      if (res.ok) {
        const list = await res.json();
        target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (target) break;
      }
    } catch {
      // Bekle
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  if (!target) {
    proc.kill('SIGKILL');
    throw new Error(`Chromium CDP bağlantısı kurulamadı.\n${stderrLogs}`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP WebSocket açma zaman aşımı')), 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', (e) => { clearTimeout(timer); reject(new Error(`WS hatası: ${e.message || 'bilinmeyen'}`)); }, { once: true });
  });

  let msgId = 0;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener('message', (event) => {
    const payload = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    if (payload.id) {
      const item = pending.get(payload.id);
      if (item) {
        pending.delete(payload.id);
        if (payload.error) item.reject(new Error(`CDP ${item.method}: ${payload.error.message}`));
        else item.resolve(payload.result);
      }
    } else if (payload.method) {
      const set = listeners.get(payload.method);
      if (set) {
        for (const fn of set) fn(payload.params || {});
      }
    }
  });

  function send(method, params = {}, timeoutMs = 15000) {
    const id = ++msgId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP komut zaman aşımı (${method})`));
      }, timeoutMs);
      pending.set(id, {
        method,
        resolve: (res) => { clearTimeout(timer); resolve(res); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  function on(method, fn) {
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(fn);
    return () => listeners.get(method)?.delete(fn);
  }

  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

  async function navigate(url) {
    const loadPromise = new Promise((resolve) => {
      const off = on('Page.loadEventFired', () => {
        off();
        resolve();
      });
    });
    await send('Page.navigate', { url });
    await Promise.race([
      loadPromise,
      new Promise((r) => setTimeout(r, 8000)),
    ]);
    await new Promise((r) => setTimeout(r, 350));
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || res.exceptionDetails.exception?.description || 'Runtime.evaluate hatası');
    }
    return res.result?.value;
  }

  async function setViewport(w, h) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 150));
  }

  async function setFileInputFiles(selector, files) {
    const { root } = await send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) throw new Error(`Dosya girdisi bulunamadı: ${selector}`);
    await send('DOM.setFileInputFiles', { nodeId, files });
  }

  async function screenshot(outPath, { fullPage = false } = {}) {
    const res = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: fullPage,
    });
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    }
    return res.data;
  }

  async function close() {
    try { ws.close(); } catch {}
    if (!proc.killed) {
      proc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 250));
      if (!proc.killed) proc.kill('SIGKILL');
    }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }

  return {
    send,
    on,
    navigate,
    evaluate,
    setViewport,
    setFileInputFiles,
    screenshot,
    close,
  };
}
