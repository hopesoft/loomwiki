import path from 'node:path';
import { existsSync, mkdirSync, lstatSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createApp } from './app';
import { SourceStore } from './store';
import { KnowledgeStore } from './knowledge';
import { Maintenance } from './maintenance';
import { configuredMaintainer } from './provider';
import { acquireLibraryLock, LibraryBusyError } from './library-lock';

function start() {
  if (existsSync('.env')) loadEnvFile('.env');
  const port = Number(process.env.PORT ?? 4310);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a whole number from 1 to 65535. Check your environment or .env.');
  const assets = path.resolve('dist');
  if (!['index.html', 'app.js', 'app.css'].every(file => existsSync(path.join(assets, file)))) throw new Error('Web assets are missing. Run make build, or use make dev to build and start.');
  let provider;
  try { provider = configuredMaintainer(); }
  catch { throw new Error('Invalid model configuration. Check LOOMWIKI_PROVIDER (openai or deepseek) and use a valid HTTPS LOOMWIKI_MODEL_URL without credentials or query parameters, then restart.'); }
  const state = path.resolve(process.env.LOOMWIKI_STATE_DIR ?? '.local');
  mkdirSync(state, { recursive: true, mode: 0o700 });
  const dbPath = path.join(state, 'knowledge.sqlite');
  if (lstatSync(state).isSymbolicLink() || (existsSync(dbPath) && lstatSync(dbPath).isSymbolicLink())) throw new Error('State storage must not use symbolic links. Choose a regular local directory.');
  const sources = new SourceStore(path.resolve(process.env.LOOMWIKI_DATA_DIR ?? '.local/sources'));
  let knowledge: KnowledgeStore | undefined;
  let maintenance: Maintenance | undefined;
  let release: (() => void) | undefined;
  const server = createApp(sources, assets, () => maintenance);
  let stopping = false;
  function close() {
    if (stopping) return;
    stopping = true;
    // Let active requests finish before closing their database and releasing ownership.
    server.close(() => { knowledge?.close(); release?.(); });
  }
  server.listen(port, '127.0.0.1', () => {
    try {
      release = acquireLibraryLock(state);
      knowledge = new KnowledgeStore(dbPath);
      maintenance = new Maintenance(knowledge, sources, provider);
      console.log(`LoomWiki: http://127.0.0.1:${port}`);
      if (!provider) console.log('AI processing is disabled. Set LOOMWIKI_API_KEY in your private .env and restart. Local import remains available.');
    } catch (error) {
      console.error(error instanceof LibraryBusyError ? error.message : 'Unable to open the library. Check directory permissions and available disk space; do not delete existing data.');
      process.exitCode = 1; close();
    }
  });
  server.on('error', error => {
    console.error((error as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Stop the existing server (Ctrl+C in its terminal), or use PORT=${port < 65535 ? port + 1 : 4310} make dev with a separate library.`
      : 'Unable to start the local server. Check the listening port and local permissions.');
    knowledge?.close(); release?.(); process.exitCode = 1;
  });
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
try { start(); } catch (error) {
  // Configuration messages contain no user-provided values or provider responses.
  const message = error instanceof Error ? error.message : '';
  console.error(message.startsWith('PORT must') || message.startsWith('Web assets') || message.startsWith('Invalid model') || message.startsWith('State storage')
    ? message : 'Startup failed. Check local configuration and directory permissions.');
  process.exitCode = 1;
}
