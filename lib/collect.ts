import {db,get,put,seed,incident} from './store';
import {probe,nextAvailability} from './security';
import {syncIntegrations} from './integrations';
async function recordStats(siteId:string,result:any){
 const key='checkStats:'+siteId;
 const current=await get<any>(key,null);
 // Legacy history is bootstrapped by the daily maintenance pass, never by dashboard readers.
 const status=result.status;
 const next={samples:(current?.samples||0)+1,start:current?.start||result.at,available:(current?.available||0)+(status==='Online'||status==='Warning'?1:0),measured:(current?.measured||0)+(status!=='Unknown'?1:0)};
 await put(key,next);
}
async function maintainStats(sites:any[]){
 // One bounded historical reconciliation per day, after history retention is applied.
 const day=Math.floor(Date.now()/86400000);
 if(await get('checkStatsDay',-1)===day)return;
 for(const site of sites){
  const r=await db().prepare("SELECT count(*) as samples,min(at) as start,sum(CASE WHEN json_extract(value,'$.status') IN ('Online','Warning') THEN 1 ELSE 0 END) as available,sum(CASE WHEN json_extract(value,'$.status') != 'Unknown' THEN 1 ELSE 0 END) as measured FROM checks WHERE site_id=?").bind(site.id).first<any>();
  await put('checkStats:'+site.id,{samples:r?.samples||0,start:r?.start||null,available:r?.available||0,measured:r?.measured||0});
 }
 await put('checkStatsDay',day);
}
export async function collect(siteId?:string){
 await seed();if(await get('probeVersion',0)<2){await db().prepare("UPDATE checks SET value=json_set(value,'$.status','Unknown','$.error','Невалидно измерване от стара версия на collector') WHERE json_extract(value,'$.error')='Неуспешна HTTP/DNS/TLS проверка'").run();await db().prepare("DELETE FROM records WHERE key LIKE 'availability:%'").run();await put('probeVersion',2);}const now=Date.now(),owner=crypto.randomUUID();
 const lock=await db().prepare('INSERT INTO leases(key,until,owner) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET until=excluded.until,owner=excluded.owner WHERE leases.until < ? RETURNING owner').bind('collect',now+900000,owner,now).first<any>();
 if(lock?.owner!==owner)return {busy:true};
 try{
  const sites=await get<any[]>('sites',[]),settings=await get<any>('settings',{});const selected=siteId?sites.filter(s=>s.id===siteId):sites;
  let count=0;
  // Batches of two: bounded socket and DNS concurrency, one persisted result consumed by all modules.
  for(let i=0;i<selected.length;i+=2)await Promise.all(selected.slice(i,i+2).map(async site=>{
   const previous=await db().prepare('SELECT at FROM checks WHERE site_id=? ORDER BY at DESC LIMIT 1').bind(site.id).first<any>();
   if(previous&&Date.now()-previous.at<60000)return;
   const result=await probe(site.url);if(result.status==='Unknown'){await db().prepare('INSERT INTO checks(id,site_id,at,value) VALUES(?,?,?,?)').bind(crypto.randomUUID(),site.id,result.at,JSON.stringify(result)).run();count++;await recordStats(site.id,result);return;}const old=await get<any>('availability:'+site.id,null);const next:any={...nextAvailability(old,result.status),announced:old?.announced||false};next.announced=next.announced||next.transition;
   await db().batch([db().prepare('INSERT INTO checks(id,site_id,at,value) VALUES(?,?,?,?)').bind(crypto.randomUUID(),site.id,result.at,JSON.stringify(result)),db().prepare('INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('availability:'+site.id,JSON.stringify(next))]);
   count++;await recordStats(site.id,result);
   if(next.transition||(old?.announced&&next.stable===result.status)){
    await incident('site:'+site.id+':offline',next.stable==='Offline','Critical',site.name+' е недостъпен','Две последователни проверки · '+(result.code?'HTTP '+result.code:result.error));
    await incident('site:'+site.id+':http',next.stable==='Warning','Warning',site.name+' · HTTP предупреждение','HTTP '+result.code);
    if(next.transition&&next.previous==='Offline'&&next.stable!=='Offline'){
     const key='recovery:'+site.id+':'+result.at;await incident(key,true,'Notice',site.name+' е възстановен','Потвърдено с две последователни проверки.');await incident(key,false);
    }
   }
   // First sample is only a baseline, even when offline. Report its real status in the website row.
   const ssl:any=result;
   await incident('site:'+site.id+':ssl',ssl.sslValid===false||(ssl.sslDays!==null&&ssl.sslDays<=settings.sslDays),ssl.sslValid===false?'Critical':'Warning',site.name+' · SSL сертификат',ssl.sslValid===false?'Невалиден сертификат':String(ssl.sslDays)+' оставащи дни');
  }));
  if(!siteId){await syncIntegrations(settings);await put('lastCollection',Date.now());await incident('collector:stale',false);}
  if(!siteId){
   await db().prepare('DELETE FROM checks WHERE at < ?').bind(Date.now()-30*86400000).run();
   await maintainStats(sites);
  }
  return {busy:false,checked:count,at:Date.now()};
 }finally{await db().prepare('DELETE FROM leases WHERE key=? AND owner=?').bind('collect',owner).run();}
}
