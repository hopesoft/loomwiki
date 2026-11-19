// This isolated fixture server is never imported by the production application.
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SourceStore } from '../../src/server/store';
import { KnowledgeStore } from '../../src/server/knowledge';
import { Maintenance } from '../../src/server/maintenance';
import { createApp } from '../../src/server/app';
import { InputError } from '../../src/server/store';
const root=await realpath(await mkdtemp(path.join(tmpdir(),'loomwiki-browser-')));
const sources=new SourceStore(path.join(root,'sources'));
const knowledge=new KnowledgeStore(path.join(root,'knowledge.sqlite'));
let failedOnce=false;
const service=new Maintenance(knowledge,sources,{
 label:'Browser test fixture (no AI)',destination:'test://local-fixture',
 async suggest(source,pages){
  if(source.filename==='retry.md' && !failedOnce){failedOnce=true;throw new InputError('Synthetic provider failure. Please retry.');}
  const retention=source.text.includes('retains audit logs');
  const prior=retention?pages.find(page=>page.title==='Birch retention policy'):undefined;
  const quote=retention?(source.text.includes('90 days')?'90 days':'30 days'):source.text;
  const claim={text:retention?`Project Birch retains audit logs for ${quote}.`:source.text,citations:[{sourceId:source.id,quote}]};
  return {targetPageId:prior?.id??null,title:retention?'Birch retention policy':'Additional notes',summary:prior?'The new source specifies a different duration for the same policy and period. Keep both perspectives for review.':'Create a page from the preserved source.',claims:[...(prior?.claims??[]),claim],conflicts:prior?[{description:'The sources specify 30 and 90 days for the same policy in 2026.',citations:[prior.claims[0].citations[0],claim.citations[0]]}]:[]};
 }
});
const server=createApp(sources,path.resolve('dist'),service);
server.listen(4389,'127.0.0.1');
server.on('error',async()=>{knowledge.close();await rm(root,{recursive:true,force:true});process.exitCode=1;});
process.once('SIGTERM',()=>{server.close(async()=>{knowledge.close();await rm(root,{recursive:true,force:true});});});
