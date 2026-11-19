import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { KnowledgeStore } from '../src/server/knowledge';
import { SourceStore } from '../src/server/store';
import { Maintenance } from '../src/server/maintenance';
import type { Maintainer } from '../src/server/provider';
import type { Draft } from '../src/shared/knowledge';
async function setup(t: { after: (fn: () => Promise<void>) => void }) {
 const root = await realpath(await mkdtemp(path.join(tmpdir(), 'loomwiki-maintenance-')));
 const sources = new SourceStore(path.join(root, 'sources'));
 const db = path.join(root, 'knowledge.sqlite');
 const knowledge = new KnowledgeStore(db);
 t.after(async () => { knowledge.close(); await rm(root, {recursive:true,force:true}); });
 const source = await sources.import('policy.md', Buffer.from('Birch keeps logs for 30 days in 2026.'));
 const draft: Draft = { targetPageId:null, title:'Birch retention', summary:'Create a supported page.', claims:[{text:'Retention is 30 days.',citations:[{sourceId:source.id,quote:'30 days'}]}], conflicts:[] };
 const provider: Maintainer = {label:'deterministic-test-only',destination:'test://fixture',suggest:async()=>structuredClone(draft)};
 return {root,db,sources,knowledge,source,draft,provider, service:new Maintenance(knowledge,sources,provider)};
}
test('new proposal does not mutate knowledge; acceptance saves page, history, and review together', async t => {
 const f=await setup(t); const proposal=await f.service.process(f.source.id);
 assert.equal(f.knowledge.pages().length,0);
 await assert.rejects(f.service.process(f.source.id), /awaiting review/);
 await f.service.review(proposal.id,'accept','Verified against the source.');
 const page=f.knowledge.pages()[0]; assert.equal(page.revision,1);
 assert.equal(f.knowledge.history(page.id)[0].reviewNote,'Verified against the source.');
 assert.equal(f.knowledge.proposals()[0].status,'accepted');
 await assert.rejects(f.service.review(proposal.id,'accept',''), /already/);
 assert.equal(f.knowledge.history(page.id).length,1);
});
test('rejection leaves knowledge and revision history unchanged; retry is available', async t => {
 const f=await setup(t); const proposal=await f.service.process(f.source.id);
 await f.service.review(proposal.id,'reject','Not useful.');
 assert.equal(f.knowledge.pages().length,0);
 assert.equal(f.knowledge.proposals()[0].reviewNote,'Not useful.');
 assert.equal((await f.service.process(f.source.id)).status,'pending');
});
test('second source updates the same page and retains the first revision and both sources', async t => {
 const f=await setup(t); await f.service.review((await f.service.process(f.source.id)).id,'accept','');
 const page=f.knowledge.pages()[0];
 const next=await f.sources.import('policy.md',Buffer.from('Birch keeps logs for 90 days in 2026.'));
 const refs=[...page.claims[0].citations,{sourceId:next.id,quote:'90 days'}];
 f.provider.suggest=async()=>({targetPageId:page.id,title:page.title,summary:'Sources disagree.',claims:[...page.claims,{text:'A second source says 90 days.',citations:[refs[1]]}],conflicts:[{description:'Different retention durations for the same policy and year.',citations:refs}]});
 const proposal=await f.service.process(next.id);
 assert.equal(f.knowledge.pages()[0].revision,1);
 await assert.rejects(f.service.review(proposal.id,'accept',''), /Explain/);
 await f.service.review(proposal.id,'accept','Keep both views unresolved.');
 assert.equal(f.knowledge.pages().length,1); assert.equal(f.knowledge.pages()[0].revision,2);
 assert.equal(f.knowledge.history(page.id).length,2);
 assert.equal(f.knowledge.history(page.id)[1].snapshot.claims.length,1);
 assert.equal(f.knowledge.pages()[0].conflicts.length,1);
 assert.equal((await f.sources.read(f.source.id)).text,'Birch keeps logs for 30 days in 2026.');
});
test('stale update cannot overwrite a newer accepted revision', async t => {
 const f=await setup(t); await f.service.review((await f.service.process(f.source.id)).id,'accept','');
 const page=f.knowledge.pages()[0];
 f.draft.targetPageId=page.id;
 const a=f.knowledge.propose(f.source.id, f.draft,page,'fixture');
 const b=f.knowledge.propose(f.source.id, f.draft,page,'fixture');
 await f.service.review(a.id,'accept','');
 await assert.rejects(f.service.review(b.id,'accept',''), /page changed/);
 assert.equal(f.knowledge.pages()[0].revision,2);
 assert.equal(f.knowledge.proposals().find(item=>item.id===b.id)?.status,'pending');
});
test('invented quotes, unknown target, unsupported sources and empty output never become proposals', async t => {
 const f=await setup(t);
 for(const value of [ {...f.draft,claims:[{text:'Invented',citations:[{sourceId:f.source.id,quote:'forever'}]}]}, {...f.draft,targetPageId:'unknown'}, {...f.draft,claims:[]}, {...f.draft,claims:[{text:'External',citations:[{sourceId:'a'.repeat(64),quote:'30 days'}]}]}]) {
  f.provider.suggest=async()=>value;
  await assert.rejects(f.service.process(f.source.id));
 }
 assert.equal(f.knowledge.pages().length,0); assert.equal(f.knowledge.proposals().length,0);
 assert.ok(f.knowledge.runs().every(run=>run.status==='failed'));
});
test('missing configuration is explicit and sends no processing request', async t => {
 const f=await setup(t); const service=new Maintenance(f.knowledge,f.sources,null);
 await assert.rejects(service.process(f.source.id), /Configure/);
 assert.equal(f.knowledge.runs().length,0);
});
test('provider failures are sanitized and allow retry', async t => {
 const f=await setup(t); f.provider.suggest=async()=>{throw new Error('private-provider-response');};
 await assert.rejects(f.service.process(f.source.id), /Processing failed/);
 assert.ok(!JSON.stringify(f.knowledge.runs()).includes('private-provider-response'));
 f.provider.suggest=async()=>f.draft;
 assert.equal((await f.service.process(f.source.id)).status,'pending');
});
test('reopening the database preserves accepted history and marks interrupted runs failed', async t => {
 const f=await setup(t); await f.service.review((await f.service.process(f.source.id)).id,'accept','');
 f.knowledge.startRun(f.source.id);
 const second=new KnowledgeStore(f.db);
 try { assert.equal(second.pages().length,1); assert.equal(second.history(second.pages()[0].id).length,1); assert.equal(second.runs()[0].status,'failed'); }
 finally {second.close();}
});

test('history-write failure rolls back page creation and acceptance', async t => {
 const f=await setup(t); const proposal=await f.service.process(f.source.id);
 const fault=new DatabaseSync(f.db);
 fault.exec("CREATE TRIGGER fail_revision BEFORE INSERT ON revisions BEGIN SELECT RAISE(ABORT, 'injected history failure'); END;");
 try {
  await assert.rejects(f.service.review(proposal.id,'accept',''));
  assert.equal(f.knowledge.pages().length,0);
  assert.equal(f.knowledge.proposals()[0].status,'pending');
  fault.exec('DROP TRIGGER fail_revision');
  await f.service.review(proposal.id,'accept','Retry after storage recovery.');
  assert.equal(f.knowledge.pages().length,1);
 } finally {fault.close();}
});
test('only one processing run may execute at once', async t => {
 const f=await setup(t);
 let complete!: (draft: Draft)=>void;
 f.provider.suggest=()=>new Promise(resolve=>{complete=resolve;});
 const processing=f.service.process(f.source.id);
 while(!complete) await new Promise(resolve=>setTimeout(resolve,1));
 await assert.rejects(f.service.process(f.source.id), /Another source/);
 complete(f.draft); await processing;
 assert.equal(f.knowledge.proposals().length,1);
});
