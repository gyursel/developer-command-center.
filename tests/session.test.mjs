import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync(new URL('../app/session-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {apiFetch,SessionExpiredError}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('simulated expired session, network retry, and authenticated reload',async()=>{
 let events=0,calls=[];globalThis.window={dispatchEvent:()=>events++};
 globalThis.fetch=async(path,init)=>{calls.push(init);return new Response('{}',{status:401});};
 await assert.rejects(apiFetch('/api/state'),SessionExpiredError);assert.equal(events,1);
 assert.equal(calls[0].credentials,'same-origin');assert.equal(calls[0].redirect,'manual');assert.equal(calls[0].cache,'no-store');
 globalThis.fetch=async()=>{throw new TypeError('Network error');};await assert.rejects(apiFetch('/api/state'),TypeError);assert.equal(events,1);
 globalThis.fetch=async()=>Response.json({sites:[{id:'saved'}],settings:{opacity:88}});
 assert.equal((await (await apiFetch('/api/state')).json()).sites[0].id,'saved');
 globalThis.fetch=async()=>({type:'opaqueredirect',status:0});await assert.rejects(apiFetch('/api/state'),SessionExpiredError);
});
test('entry page requires owner session',()=>{const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');assert.ok(page.includes('await requireOwner()'));const dashboard=readFileSync(new URL('../app/dashboard.tsx',import.meta.url),'utf8');assert.ok(dashboard.includes('href="/login"'));});
