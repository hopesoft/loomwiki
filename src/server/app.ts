import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { InputError, MAX_BYTES, SourceStore } from './store';
import type { Maintenance } from './maintenance';

export function createApp(store: SourceStore, assets: string, maintenanceOrFactory?: Maintenance | (() => Maintenance | undefined)) {
  let imports = Promise.resolve();
  return createServer(async (req, res) => {
    const send = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const expectedHost = `127.0.0.1:${(res.socket!.address() as { port: number }).port}`;
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`) || req.headers['sec-fetch-site'] === 'cross-site') { send(403, { error: 'Only same-origin local requests are allowed.' }); return; }
    try {
      const url = new URL(req.url!, `http://${expectedHost}`);
      const maintenance = typeof maintenanceOrFactory === 'function' ? maintenanceOrFactory() : maintenanceOrFactory;
      if (maintenance && req.method === 'GET' && url.pathname === '/api/workspace') {
        send(200, { pages: maintenance.knowledge.pages(), proposals: maintenance.knowledge.proposals(), runs: maintenance.knowledge.runs(), provider: maintenance.status() }); return;
      }
      if (maintenance && req.method === 'GET' && url.pathname.startsWith('/api/history/')) { send(200, maintenance.knowledge.history(url.pathname.slice(13))); return; }
      if (maintenance && req.method === 'POST' && url.pathname.startsWith('/api/process/')) { send(201, await maintenance.process(url.pathname.slice(13))); return; }
      if (maintenance && req.method === 'POST' && url.pathname.startsWith('/api/review/')) {
        if (req.headers['content-type'] !== 'application/json') throw new InputError('Expected a JSON review decision.');
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 8192) throw new InputError('Review note is too long.'); chunks.push(chunk); }
        let decision; try { decision = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new InputError('Invalid review decision.'); }
        if (!decision || !['accept', 'reject'].includes(decision.action) || typeof decision.note !== 'string' || decision.note.length > 2000) throw new InputError('Invalid review decision.');
        send(200, await maintenance.review(url.pathname.slice(12), decision.action, decision.note)); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/sources') { send(200, await store.list()); return; }
      if (req.method === 'GET' && url.pathname.startsWith('/api/sources/')) { send(200, await store.read(url.pathname.slice(13))); return; }
      if (req.method === 'POST' && url.pathname === '/api/sources') {
        if (req.headers['content-type'] !== 'application/octet-stream') throw new InputError('Expected a raw Markdown file.');
        const filename = decodeURIComponent(String(req.headers['x-filename'] ?? ''));
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > MAX_BYTES) throw new InputError('File exceeds the 1 MiB limit.'); chunks.push(chunk); }
        const result = imports.then(() => store.import(filename, Buffer.concat(chunks)));
        imports = result.then(() => {}, () => {});
        send(201, await result); return;
      }
      const allowed: Record<string, string> = { '/': 'index.html', '/app.js': 'app.js', '/app.css': 'app.css' };
      if (req.method === 'GET' && allowed[url.pathname]) {
        const file = allowed[url.pathname];
        const bytes = await readFile(path.join(assets, file));
        res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : 'text/javascript', 'Cache-Control': 'no-store' }); res.end(bytes); return;
      }
      send(404, { error: 'Not found.' });
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      send(error instanceof InputError ? 400 : missing ? 404 : 500, { error: error instanceof InputError ? error.message : missing ? 'Source or application asset not found.' : 'Unable to read or save the source. Check local storage integrity and permissions.' });
    }
  });
}
