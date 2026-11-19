import { DatabaseSync } from 'node:sqlite';
import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';

export class LibraryBusyError extends Error {
  constructor() { super('This library is already open in another LoomWiki process. Stop that process before restarting, or choose a different LOOMWIKI_STATE_DIR. Changing PORT alone does not select a different library.'); }
}
export function acquireLibraryLock(directory: string): () => void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(realpathSync(directory), '.instance.sqlite');
  if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw new Error('The instance lock must not be a symbolic link.');
  const db = new DatabaseSync(file);
  try {
    // A separate rollback-journal database holds an OS-backed lock for this process's lifetime.
    // Never unlink it: another process could otherwise lock a different inode at the same path.
    db.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;');
  } catch (error) {
    db.close();
    const code = (error as { errcode?: number }).errcode;
    if (code === 5 || code === 6) throw new LibraryBusyError();
    throw error;
  }
  let released = false;
  return () => { if (!released) { released = true; try { db.exec('ROLLBACK'); } finally { db.close(); } } };
}
