import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';

const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const failures:string[]=[];
const environmentSecrets=Object.entries(process.env).filter(([name,value])=>/(API_KEY|TOKEN|SECRET|PASSWORD)$/.test(name)&&value&&value.length>=20).map(([,value])=>value!);
for(const file of files){
 if(!existsSync(file)) continue;
 if(lstatSync(file).isSymbolicLink()){failures.push(`${file}: review symbolic link before publication`);continue;}
 if(/(^|\/)(?:\.local|node_modules|dist|test-results|playwright-report|workspaces)(?:\/|$)|(^|\/)data\/private\//.test(file) || /(?:\.sqlite(?:-[^/]*)?|\.db(?:-[^/]*)?|\.log|\.pem|\.key)$/.test(file) || /(^|\/)\.env(?:\..*)?$/.test(file)&&!file.endsWith('.env.example')) failures.push(`${file}: local or sensitive artifact is publishable`);
 const data=readFileSync(file); if(data.includes(0)) continue;
 const text=data.toString('utf8');
 if(environmentSecrets.some(secret=>text.includes(secret)) || /\bsk-[A-Za-z0-9_-]{24,}\b/.test(text) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) failures.push(`${file}: possible credential content; inspect locally`);
}
const ignored=['.env','.local/knowledge.sqlite','.local/sources/example.json','test-results/example.png','dist/app.js'];
for(const file of ignored){try{execFileSync('git',['check-ignore','--no-index','-q',file]);}catch{failures.push(`${file}: required ignore rule is missing`);}}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else{console.log(`Publication checks passed for ${files.length} candidate files. No secret values printed.`);}
if(!existsSync('LICENSE')) console.log('Pending owner decision: no public license selected. This check does not authorize publication.');
console.log('Scope: tracked and non-ignored files only. This is not a complete credential audit or a Git history scan.');
