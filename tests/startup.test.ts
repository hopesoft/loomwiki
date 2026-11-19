import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, realpath, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import { KnowledgeStore } from '../src/server/knowledge';
const main=path.resolve('src/server/main.ts');
const loader=import.meta.resolve('tsx');
async function freePort(){const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=(socket.address() as {port:number}).port;await new Promise<void>(resolve=>socket.close(()=>resolve()));return port;}
async function fixture(t:{after:(fn:()=>Promise<void>)=>void}){
 const root=await realpath(await mkdtemp(path.join(tmpdir(),'loomwiki-startup-')));
 await mkdir(path.join(root,'dist'));
 for(const file of ['index.html','app.js','app.css']) await writeFile(path.join(root,'dist',file),'fixture');
 const children:ReturnType<typeof spawn>[]=[];
 t.after(async()=>{for(const child of children){if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill('SIGKILL');await done;}}await rm(root,{recursive:true,force:true});});
 function launch(port:number,overrides:Record<string,string>={}){
  const child=spawn(process.execPath,['--import',loader,main],{cwd:root,env:{PATH:process.env.PATH,HOME:process.env.HOME,PORT:String(port),LOOMWIKI_API_KEY:'',...overrides},stdio:['ignore','pipe','pipe']});children.push(child);
  let output='';child.stdout!.on('data',chunk=>output+=chunk);child.stderr!.on('data',chunk=>output+=chunk);
  const done=once(child,'exit');
  async function ready(){for(let i=0;i<200;i++){if(output.includes('LoomWiki: http') && (overrides.LOOMWIKI_API_KEY || output.includes('AI processing is disabled')))return;if(child.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Server did not become ready: '+output);}
  return {child,done,ready,output:()=>output};
 }
 return {root,launch};
}
test('different ports cannot share a library or interrupt its running task; graceful restart recovers',async t=>{
 const f=await fixture(t);const first=f.launch(await freePort());await first.ready();
 assert.match(first.output(),/AI processing is disabled/);
 const db=new KnowledgeStore(path.join(f.root,'.local','knowledge.sqlite'));
 try{
  const run=db.startRun('synthetic-source');
  const second=f.launch(await freePort());const [code]=await second.done;assert.equal(code,1);assert.match(second.output(),/already open/);
  assert.equal(db.runs().find(item=>item.id===run.id)?.status,'running');
  first.child.kill('SIGTERM');await first.done;
  const restarted=f.launch(await freePort());await restarted.ready();
  assert.equal(db.runs().find(item=>item.id===run.id)?.status,'failed');
  restarted.child.kill('SIGTERM');await restarted.done;
 }finally{db.close();}
});
test('startup reports occupied port, invalid configuration, and missing build without secrets',async t=>{
 const f=await fixture(t);const port=await freePort();const first=f.launch(port);await first.ready();
 const duplicate=f.launch(port);assert.equal((await duplicate.done)[0],1);assert.match(duplicate.output(),/Port .* already in use/);
 const invalid=f.launch(await freePort(),{LOOMWIKI_API_KEY:'synthetic-test-value',LOOMWIKI_MODEL_URL:'not-a-url'});
 assert.equal((await invalid.done)[0],1);assert.match(invalid.output(),/Invalid model configuration/);assert.ok(!invalid.output().includes('synthetic-test-value'));
 first.child.kill('SIGTERM');await first.done;
 await rm(path.join(f.root,'dist'),{recursive:true});
 const missing=f.launch(await freePort());assert.equal((await missing.done)[0],1);assert.match(missing.output(),/Run make build/);
});
