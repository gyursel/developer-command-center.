import {tokenFor} from './credentials';
import { get,put,incident } from './store';
export async function api(url:string,token:string,cache:any={}) {
 const h:Record<string,string>={Authorization:'Bearer '+token,Accept:'application/json','User-Agent':'DeveloperCommandCenter/1.0'};
 if(url.startsWith('https://api.github.com/')){h.Accept='application/vnd.github+json';h['X-GitHub-Api-Version']='2022-11-28';}
 if(cache.etag)h['If-None-Match']=cache.etag;
 const r=await fetch(url,{headers:h,redirect:'manual',signal:AbortSignal.timeout(12000)});
 if(r.status===304)return {...cache,at:Date.now()};
 if(!r.ok){const error:any=new Error('HTTP '+r.status);const retry=Number(r.headers.get('retry-after'));const reset=Number(r.headers.get('x-ratelimit-reset'))*1000;error.retryAt=Math.max(Date.now()+((Number.isFinite(retry)&&retry>0?retry:300)*1000),reset||0);throw error;}
 return {data:await r.json(),etag:r.headers.get('etag'),at:Date.now()};
}
export async function syncIntegrations(settings:any){
 const state=await get<any>('integrations',{});
 for(const kind of ['github','vercel']){
  const token=await tokenFor(kind as 'github'|'vercel');let old=state[kind]||{items:[],cache:{}};
  await incident(kind+':credentials',!token,'Notice',kind==='github'?'Свържи GitHub':'Свържи Vercel','Няма сървърен API token. Виж Настройки → Интеграции.');
  if(!token){state[kind]={...old,connected:false,error:'Липсват credentials'};continue;}
  if(old.nextAt>Date.now())continue;
  const cache={...old.cache};
  const read=async(url:string)=>{cache[url]=await api(url,token,cache[url]);return cache[url].data;};
  try{
   let items:any[]=[];let available:any[]=[];
   if(kind==='github'){
    // Discover all repositories visible to the token; do not rely on a manual allowlist.
    // Page conservatively (up to 2,000 repos) and check only repositories whose push
    // timestamp changes, rather than requesting commit history for every repo each minute.
    const discovered:any[]=[];
    for(let page=1;page<=20;page++){
     const pageRows:any[]=await read('https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&visibility=all&per_page=100&page='+page);
     discovered.push(...pageRows);
     if(pageRows.length<100)break;
    }
    available=discovered.map((r:any)=>({id:r.full_name,name:r.full_name,branch:r.default_branch||'main',pushedAt:r.pushed_at||null}));
    const previous=new Map<string,any>((old.available||[]).map((r:any)=>[r.name,r]));
    const baselineExists=(old.available||[]).some((r:any)=>r.pushedAt!==undefined);
    const changed=baselineExists?available.filter((r:any)=>{
     const prior=previous.get(r.name);
     return !prior||prior.pushedAt!==r.pushedAt;
    }).sort((a:any,b:any)=>Date.parse(b.pushedAt||'')-Date.parse(a.pushedAt||'')):[];
    const recent=(old.items||[]).filter((x:any)=>x.kind==='github'&&Date.now()-x.at<24*3600000);
    items=[...recent];
    // Cap API requests per sync to protect the free-tier worker and API rate limit.
    for(const r of changed.slice(0,10)){
     if(!r.pushedAt)continue;
     try{
      const commits:any[]=await read('https://api.github.com/repos/'+r.name+'/commits?per_page=1&sha='+encodeURIComponent(r.branch));
      const c=commits[0];
      if(c)items.push({kind:'github',id:c.sha,repository:r.name,name:r.name,branch:r.branch,sha:c.sha.slice(0,7),message:c.commit.message.split('\n')[0],at:Date.parse(c.commit.committer.date),url:c.html_url,status:'Commit'});
     }catch(e:any){if(e?.message==='HTTP 409'||e?.message==='HTTP 404')continue;throw e;}
    }
    items=[...new Map(items.map((x:any)=>[x.repository+':'+x.id,x])).values()].sort((a:any,b:any)=>b.at-a.at).slice(0,100);
   }else{
    const optional=async(url:string,fallback:any)=>{try{return await read(url);}catch(e:any){if(e.message==='HTTP 403')return fallback;throw e;}};
    const teams=await optional('https://api.vercel.com/v2/teams?limit=100',{teams:[]});
    const scopes=[{id:null,name:'Personal',slug:null},...(teams.teams||[])];
    const user=await optional('https://api.vercel.com/v2/user',{});
    for(const scope of scopes){
     const q=scope.id?'&teamId='+encodeURIComponent(scope.id):'';
     const projects=await read('https://api.vercel.com/v9/projects?limit=100'+q);
     for(const p of projects.projects||[]){
      available.push({id:(scope.id||'personal')+':'+p.id,name:p.name,scope:scope.name});
      if(settings.projects.length&&!settings.projects.includes((scope.id||'personal')+':'+p.id))continue;
      if(items.length>=20)break;
      const d=await read('https://api.vercel.com/v6/deployments?limit=1&projectId='+encodeURIComponent(p.id)+q);
      const latest=d.deployments?.[0];if(!latest)continue;
      const raw=String(latest.state||latest.readyState||'').toUpperCase();
      const status=({QUEUED:'Queued',INITIALIZING:'Queued',BUILDING:'Building',READY:'Ready',ERROR:'Error',CANCELED:'Cancelled',CANCELLED:'Cancelled'} as any)[raw]||'Unknown';
      const active=p.targets?.production;const slug=scope.slug||user.user?.username;
      items.push({kind:'vercel',id:latest.uid||latest.id,name:p.name,projectId:p.id,scope:scope.name,status,environment:latest.target||'preview',branch:latest.meta?.githubCommitRef||null,sha:latest.meta?.githubCommitSha?.slice(0,7)||null,message:latest.meta?.githubCommitMessage||'',at:latest.created||latest.createdAt,url:latest.url?'https://'+latest.url:null,dashboard:slug?'https://vercel.com/'+encodeURIComponent(slug)+'/'+encodeURIComponent(p.name):'https://vercel.com/dashboard',production:active?{id:active.id||active.uid,url:active.url?'https://'+active.url:null}:null});
     }
    }
   }
   state[kind]={connected:true,items:items.sort((a,b)=>b.at-a.at),available,cache,at:Date.now(),error:null,nextAt:Date.now()+60000};
   await incident(kind+':api',false);await incident(kind+':stale',false);
   if(kind==='vercel'){
    const currentKeys=items.map(x=>'deployment:'+x.scope+':'+x.projectId);
    const {db}=await import('./store'); const previous=await db().prepare("SELECT key FROM incidents WHERE key LIKE 'deployment:%' AND resolved IS NULL").all<any>();
    for(const row of previous.results)if(!currentKeys.includes(row.key))await incident(row.key,false);
    for(const d of items)await incident('deployment:'+d.scope+':'+d.projectId,['Error','Cancelled'].includes(d.status),d.status==='Error'?'Critical':'Warning',d.name+' · '+d.status,'Последният deployment: '+d.id);
   }
  }catch(e:any){state[kind]={...old,connected:true,error:/^HTTP \d+$/.test(e.message)?e.message:'API връзката е неуспешна',attemptAt:Date.now(),nextAt:e.retryAt||Date.now()+300000};await incident(kind+':api',true,'Warning',kind+' · проблем с API',state[kind].error);}
  if(state[kind].at&&Date.now()-state[kind].at>150*60000)await incident(kind+':stale',true,'Notice',kind+' · остарели данни','Последната успешна синхронизация е преди повече от 150 минути.');
 }
 // Tokens and HTTP cache never leave the server.
 await put('integrations',state);
}
export function publicIntegrations(state:any){return Object.fromEntries(Object.entries(state).map(([k,v]:any)=>[k,{...v,cache:undefined}]));}
