import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, readdir, link, unlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import type { Source, SourceDetail } from '../shared/source';

export class InputError extends Error {}
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const validId = /^[a-f0-9]{64}$/;
export const MAX_BYTES = 1024 * 1024;
export function validateFilename(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 180 || !value.trim() || /[\\/\x00-\x1f]/.test(value) || !/\.(md|markdown)$/i.test(value)) {
    throw new InputError('Choose a Markdown file with a plain filename.');
  }
}
export class SourceStore {
  constructor(private readonly root: string) {}
  private async prepare() {
    // Reject existing symlink components before creating the private storage directory.
    let current = path.parse(path.resolve(this.root)).root;
    for (const part of path.resolve(this.root).slice(current.length).split(path.sep)) {
      current = path.join(current, part);
      try { if ((await lstat(current)).isSymbolicLink()) throw new Error('Storage symlinks are not supported.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }
  async read(id: string): Promise<SourceDetail> {
    if (!validId.test(id)) throw new InputError('Invalid source identifier.');
    await this.prepare();
    const handle = await open(path.join(this.root, id + '.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const record = JSON.parse(await handle.readFile('utf8'));
      validateFilename(record.filename);
      const bytes = Buffer.from(record.base64, 'base64');
      if (record.id !== id || bytes.length !== record.byteLength || hash(bytes) !== record.sha256 || hash(record.filename + '\0' + record.sha256) !== id) throw new Error('Source integrity check failed.');
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      return { id, filename: record.filename, sha256: record.sha256, importedAt: record.importedAt, byteLength: bytes.length, text };
    } finally { await handle.close(); }
  }
  async list(): Promise<Source[]> {
    await this.prepare();
    const result: Source[] = [];
    for (const name of await readdir(this.root)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const { text: _text, ...source } = await this.read(name.slice(0, -5));
      result.push(source);
    }
    return result.sort((a, b) => b.importedAt.localeCompare(a.importedAt) || a.id.localeCompare(b.id));
  }
  async import(filename: string, bytes: Buffer): Promise<SourceDetail> {
    validateFilename(filename);
    if (!bytes.length || bytes.length > MAX_BYTES) throw new InputError('Choose a nonempty file up to 1 MiB.');
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new InputError('The source must use UTF-8 encoding.'); }
    await this.prepare();
    const sha256 = hash(bytes);
    const id = hash(filename + '\0' + sha256);
    try { return await this.read(id); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const temp = path.join(this.root, '.' + randomUUID() + '.tmp');
    const record = { id, filename, sha256, importedAt: new Date().toISOString(), byteLength: bytes.length, base64: bytes.toString('base64') };
    const handle = await open(temp, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(record));
      await handle.sync();
    } catch (error) { await unlink(temp).catch(() => {}); throw error; }
    finally { await handle.close(); }
    // Requests are serialized by the HTTP service; publish only complete records.
    try { await link(temp, path.join(this.root, id + '.json')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    finally { await unlink(temp); }
    return this.read(id);
  }
}
