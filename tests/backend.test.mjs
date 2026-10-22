import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url),esbuild=require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]}));
let sql,app,mutate,store;
const env={};globalThis.__testEnv=env;globalThis.__testUser=true;
function stmt(query,values=[]){return {bind(...v){return stmt(query,v)},async first(){return sql.prepare(query).get(...values)||null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){const r=sql.prepare(query).run(...values);return {success:true,meta:{changes:r.changes}}}};}
const tmp=fs.mkdtempSync(path.join(tmpdir(),'dcc-test-'));
before(async()=>{
 sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 env.DB={prepare:q=>stmt(q),batch:async statements=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 await esbuild.build({stdin:{contents:"export * from './lib/collect';export * from './lib/store';export {POST as mutate} from './app/api/mutate/route';export * from './lib/integrations';export * from './lib/credentials';export {POST as credentials} from './app/api/credentials/route';",resolveDir:process.cwd(),loader:'ts'},outfile:tmp+'/backend.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'test-boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env=globalThis.__testEnv;'}));b.onResolve({filter:/owner-auth$/},()=>({path:'auth',namespace:'auth'}));b.onLoad({filter:/.*/,namespace:'auth'},()=>({contents:'export async function getOwner(){return globalThis.__testUser?{userId:"owner"}:null}'}));}}]});
 app=await import(tmp+'/backend.mjs');mutate=app.mutate;store=app;
 globalThis.fetch=async (url,init)=>{url=String(url);if(url.includes('dns-query'))return Response.json({Status:0,Answer:[{type:1,data:'1.1.1.1'}]});return new Response(null,{status:globalThis.__httpStatus||200});};
 await store.seed();
});
const request=b=>new Request('https://dcc.test/api/mutate',{method:'POST',headers:{Origin:'https://dcc.test','Content-Type':'application/json'},body:JSON.stringify(b)});
function resetTime(){sql.prepare('UPDATE checks SET at=at-61000').run();}
test('CRUD persists sites and settings across new reads',async()=>{const sites=await store.get('sites',[]);sites.push({id:'test-site',name:'Persistence check',url:'https://example.com/'});assert.equal((await mutate(request({type:'sites',value:sites}))).status,200);assert.equal((await store.snapshot()).sites.at(-1).name,'Persistence check');const s=await store.get('settings',{});s.visual.opacity=64;s.hidden=['shortcuts'];assert.equal((await mutate(request({type:'settings',value:s}))).status,200);assert.equal((await store.get('settings',{})).visual.opacity,64);});
test('protected writes reject missing identity and cross-site origin',async()=>{globalThis.__testUser=false;assert.equal((await mutate(request({type:'sites',value:[]}))).status,401);globalThis.__testUser=true;const r=new Request('https://dcc.test/api/mutate',{method:'POST',headers:{Origin:'https://evil.com'},body:'{}'});assert.equal((await mutate(r)).status,403);});
test('backend stores a real probe response once; duplicate runs use cooldown',async()=>{globalThis.__httpStatus=200;await app.collect('test-site');let snap=await store.snapshot();assert.equal(snap.sites.at(-1).latest.code,200);assert.equal(snap.sites.at(-1).latest.sslDays,null);assert.equal(snap.sites.at(-1).samples,1);assert.equal((await app.collect('test-site')).checked,0);});
test('outage needs two checks; dedup keeps one active incident',async()=>{globalThis.__httpStatus=503;resetTime();await app.collect('test-site');assert.equal((await store.snapshot()).alerts.filter(x=>x.key==='site:test-site:offline').length,0);resetTime();await app.collect('test-site');resetTime();await app.collect('test-site');const a=(await store.snapshot()).alerts.filter(x=>x.key==='site:test-site:offline'&&!x.resolved);assert.equal(a.length,1);assert.equal(a[0].level,'Critical');});
test('read and mute persist; recovery resolves original outage',async()=>{let a=(await store.snapshot()).alerts.find(x=>x.key==='site:test-site:offline'&&!x.resolved);await mutate(request({type:'alert',id:a.id,action:'read'}));await mutate(request({type:'alert',id:a.id,action:'mute'}));a=(await store.snapshot()).alerts.find(x=>x.id===a.id);assert.equal(a.read,1);assert.ok(a.muted>Date.now());globalThis.__httpStatus=200;resetTime();await app.collect('test-site');assert.equal((await store.snapshot()).alerts.find(x=>x.id===a.id).resolved,null);resetTime();await app.collect('test-site');assert.ok((await store.snapshot()).alerts.find(x=>x.id===a.id).resolved);assert.equal((await store.snapshot()).alerts.filter(x=>x.key.startsWith('recovery:test-site')).length,1);});
test('missing credentials generate deduplicated Notice incidents',async()=>{await app.syncIntegrations(await store.get('settings',{}));await app.syncIntegrations(await store.get('settings',{}));const rows=(await store.snapshot()).alerts.filter(x=>x.key.endsWith(':credentials')&&!x.resolved);assert.equal(rows.length,2);assert.ok(rows.every(x=>x.level==='Notice'));assert.equal((await store.get('integrations',{})).github.connected,false);});
test('API failure retains cached data and applies backoff without leaking token',async()=>{env.GITHUB_TOKEN='dummy-test-token-only';globalThis.fetch=async()=>new Response('do-not-return-this-body',{status:429,headers:{'Retry-After':'600'}});await app.syncIntegrations(await store.get('settings',{}));const state=await store.get('integrations',{});assert.equal(state.github.error,'HTTP 429');assert.ok(state.github.nextAt>Date.now()+590000);assert.ok(!JSON.stringify(app.publicIntegrations(state)).includes('dummy-test-token'));assert.ok(!JSON.stringify(app.publicIntegrations(state)).includes('do-not-return'));delete env.GITHUB_TOKEN;});
test('ETag 304 reuses cached payload',async()=>{globalThis.fetch=async()=>new Response(null,{status:304});const result=await app.api('https://api.github.com/user/repos','dummy',{etag:'abc',data:[{id:1}],at:1});assert.deepEqual(result.data,[{id:1}]);assert.ok(result.at>1);});
test('deleting a site removes its probes and resolves its alerts',async()=>{const sites=await store.get('sites',[]);assert.equal((await mutate(request({type:'sites',value:sites.filter(s=>s.id!=='test-site')}))).status,200);assert.equal(sql.prepare('SELECT count(*) as n FROM checks WHERE site_id=?').get('test-site').n,0);assert.equal((await store.snapshot()).sites.some(x=>x.id==='test-site'),false);});
test('database constraint enforces one active incident per key',async()=>{await Promise.all([app.incident('dedup:test',true,'Warning','test','1'),app.incident('dedup:test',true,'Warning','test','2')]);assert.equal(sql.prepare("SELECT count(*) as n FROM incidents WHERE key='dedup:test' AND resolved IS NULL").get().n,1);});

test('credential endpoint rejects missing session and cross-origin requests',async()=>{
 const req=origin=>new Request('https://dcc.test/api/credentials',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 globalThis.__testUser=false;assert.equal((await app.credentials(req('https://dcc.test'))).status,401);
 globalThis.__testUser=true;assert.equal((await app.credentials(req('https://evil.test'))).status,403);
});
test('valid credentials are encrypted, survive rereads, never returned, and failed replacements preserve them',async()=>{
 env.CREDENTIAL_ENCRYPTION_KEY=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
 const token='test-only-not-real-credential-12345';
 const req=()=>new Request('https://dcc.test/api/credentials',{method:'POST',headers:{Origin:'https://dcc.test','Content-Type':'application/json'},body:JSON.stringify({provider:'github',token})});
 globalThis.fetch=async()=>new Response('{}',{status:200});
 const response=await app.credentials(req());assert.equal(response.status,200);assert.ok(!(await response.text()).includes(token));
 const stored=await store.get('credential:github',null);assert.ok(stored.cipher);assert.ok(!JSON.stringify(stored).includes(token));
 assert.equal(await app.tokenFor('github'),token);assert.equal((await store.snapshot()).credentials.github,true);assert.ok(!JSON.stringify(await store.snapshot()).includes(token));
 const duplicate=await app.credentials(req());assert.equal(duplicate.status,429);
 sql.prepare("DELETE FROM leases WHERE key='credential-check:github'").run();
 globalThis.fetch=async()=>new Response('sensitive-provider-body',{status:401});
 const failed=await app.credentials(req());assert.equal(failed.status,400);assert.ok(!(await failed.text()).includes('sensitive-provider-body'));assert.equal(await app.tokenFor('github'),token);
 await store.put('credential:vercel',stored);await assert.rejects(()=>app.tokenFor('vercel'));await app.deleteToken('vercel');
 stored.cipher=stored.cipher.slice(0,-4)+'AAAA';await store.put('credential:github',stored);await assert.rejects(()=>app.tokenFor('github'));await app.deleteToken('github');assert.equal(await app.tokenFor('github'),null);
});
