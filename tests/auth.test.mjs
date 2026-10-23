import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
const require=createRequire(import.meta.url),esbuild=require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]}));
const env={APP_ORIGIN:'https://dcc.example',OWNER_USERNAME:'owner'};globalThis.__authEnv=env;
let auth,worker,sql;
function stmt(q,v=[]){return {bind(...a){return stmt(q,a)},async first(){return sql.prepare(q).get(...v)||null},async run(){return sql.prepare(q).run(...v)}}}
before(async()=>{
 sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0002_standalone_auth.sql','utf8'));env.DB={prepare:q=>stmt(q),batch:async a=>Promise.all(a.map(s=>s.run()))};
 const salt=randomBytes(16);env.OWNER_PASSWORD_HASH='pbkdf2$100000$'+salt.toString('base64')+'$'+pbkdf2Sync('test-password-only-123',salt,100000,32,'sha256').toString('hex');
 const dir=fs.mkdtempSync(os.tmpdir()+'/dcc-auth-');
 await esbuild.build({stdin:{contents:"export * from './lib/auth';export {default as worker} from './worker/index';",resolveDir:process.cwd(),loader:'ts'},outfile:dir+'/auth.mjs',platform:'node',format:'esm',bundle:true,plugins:[{name:'boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/^vinext\/server\/fetch-handler$/},()=>({path:'handler',namespace:'mock'}));b.onResolve({filter:/\.\.\/lib\/(collect|store)$/},a=>({path:a.path.endsWith('collect')?'collect':'store',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='env'?'export const env=globalThis.__authEnv':a.path==='handler'?"export default {fetch:async()=>new Response('protected')}" :a.path==='collect'?'export async function collect(){globalThis.__scheduled=true}':'export async function put(){};export async function snapshot(){return {integrations:{}}}'}));}}]});
 auth=await import(dir+'/auth.mjs');worker=auth.worker;
});
const req=(path,options={})=>new Request('https://dcc.example'+path,options);
test('password verification rejects wrong password',async()=>{assert.ok(await auth.verifyPassword('test-password-only-123',env.OWNER_PASSWORD_HASH));assert.equal(await auth.verifyPassword('wrong',env.OWNER_PASSWORD_HASH),false)});
test('unauthenticated and spoofed identity headers cannot access APIs',async()=>{for(const path of ['/api/collect','/api/state','/api/credentials','/api/collector-status']){const r=await worker.fetch(req(path,{headers:{'oai-authenticated-user-email':'owner@example.com','oai-authenticated-user-id':'owner'}}),env,{});assert.equal(r.status,401)}});
test('login requires same origin and issues secure HttpOnly cookie; logout revokes',async()=>{
 const body=new URLSearchParams({username:'owner',password:'test-password-only-123'});
 assert.equal((await worker.fetch(req('/login',{method:'POST',headers:{Origin:'https://evil.test'},body}),env,{})).status,403);
 const r=await worker.fetch(req('/login',{method:'POST',headers:{Origin:env.APP_ORIGIN},body}),env,{});assert.equal(r.status,303);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 assert.equal((await worker.fetch(req('/api/state',{headers:{Cookie:cookie}}),env,{})).status,200);
 assert.equal((await worker.fetch(req('/api/mutate',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test'}}),env,{})).status,403);
 assert.equal((await worker.fetch(req('/logout',{method:'POST',headers:{Cookie:cookie,Origin:env.APP_ORIGIN}}),env,{})).status,303);assert.equal(await auth.authenticated(cookie),false);
});
test('expired and tampered sessions fail; password rotation invalidates sessions',async()=>{let token=await auth.createSession();assert.ok(await auth.authenticated('dcc_session='+token));assert.equal(await auth.authenticated('dcc_session='+token.slice(0,-1)+'z'),false);sql.prepare('UPDATE auth_sessions SET expires=0').run();assert.equal(await auth.authenticated('dcc_session='+token),false);token=await auth.createSession();const old=env.OWNER_PASSWORD_HASH;env.OWNER_PASSWORD_HASH+='x';assert.equal(await auth.authenticated('dcc_session='+token),false);env.OWNER_PASSWORD_HASH=old;});
test('login rate limit persists in database',async()=>{sql.exec('DELETE FROM auth_attempts');for(let i=0;i<10;i++)assert.equal(await auth.allowedAttempt(req('/login')),true);assert.equal(await auth.allowedAttempt(req('/login')),false)});
test('scheduled handler invokes collector without browser or session',async()=>{await worker.scheduled({},env,{});assert.ok(globalThis.__scheduled)});
