import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { acquireLibraryLock, LibraryBusyError } from '../src/server/library-lock';

test('library lock rejects aliases and duplicate ownership, releases idempotently', async t => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'loomwiki-lock-')));
  t.after(() => rm(root, {recursive:true,force:true}));
  const release = acquireLibraryLock(path.join(root,'state'));
  try {
    assert.throws(() => acquireLibraryLock(path.join(root,'state')), LibraryBusyError);
    await symlink(path.join(root,'state'),path.join(root,'alias'));
    assert.throws(() => acquireLibraryLock(path.join(root,'alias')), LibraryBusyError);
    const other=acquireLibraryLock(path.join(root,'other'));other();
  } finally {release();release();}
  acquireLibraryLock(path.join(root,'state'))();
});
test('another process cannot acquire the library; abrupt process exit releases it', async t => {
  const root=await realpath(await mkdtemp(path.join(tmpdir(),'loomwiki-process-lock-')));
  const code="import { acquireLibraryLock } from './src/server/library-lock.ts'; acquireLibraryLock(process.argv[1]); console.log('LOCKED'); setInterval(()=>{},1000);";
  const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',code,root],{stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(child.exitCode===null && child.signalCode===null){child.kill('SIGKILL');await once(child,'exit');}await rm(root,{recursive:true,force:true});});
  await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>{reject(new Error('Lock subprocess did not start.'));},10000);
    child.once('error',error=>{clearTimeout(timeout);reject(error);});
    child.stdout.on('data',data=>{if(data.toString().includes('LOCKED')){clearTimeout(timeout);resolve();}});
    child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Lock subprocess exited before readiness.'));});
  });
  assert.throws(()=>acquireLibraryLock(root),LibraryBusyError);
  const exited=once(child,'exit');child.kill('SIGKILL');await exited;
  acquireLibraryLock(root)();
});
