import {credentialFlags} from './credentials';
import { env } from 'cloudflare:workers';
import { initialSites,initialLinks,initialSettings } from './defaults';
export const db=()=> (env as any).DB as D1Database;
export async function get<T=any>(key:string,fallback:T):Promise<T> {const r=await db().prepare('SELECT value FROM records WHERE key=?').bind(key).first<{value:string}>();return r?JSON.parse(r.value):fallback;}
export async function put(key:string,value:any){await db().prepare('INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value)).run();}
export async function seed(){await db().batch([['sites',initialSites],['links',initialLinks],['settings',initialSettings]].map(([k,v])=>db().prepare('INSERT OR IGNORE INTO records(key,value) VALUES(?,?)').bind(k,JSON.stringify(v))));}
export async function incident(key:string, active:boolean,level='Notice',title='',detail=''){
 const now=Date.now();
 const old=await db().prepare('SELECT id FROM incidents WHERE key=? AND resolved IS NULL LIMIT 1').bind(key).first<any>();
 if(!active){if(old)await db().prepare('UPDATE incidents SET resolved=?,seen=? WHERE id=?').bind(now,now,old.id).run();return;}
 if(old)await db().prepare('UPDATE incidents SET seen=?,level=?,title=?,detail=? WHERE id=?').bind(now,level,title,detail,old.id).run();
 else await db().prepare('INSERT OR IGNORE INTO incidents(id,key,opened,seen,level,title,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),key,now,now,level,title,detail).run();
}
export async function snapshot(){
 // Read-only: seeding and incident reconciliation belong to the scheduled collector.
 const sites=await get('sites',initialSites), settings=await get('settings',initialSettings);
 const summaries=await db().prepare("SELECT site_id,count(*) as samples,min(at) as start,sum(CASE WHEN json_extract(value,'$.status') IN ('Online','Warning') THEN 1 ELSE 0 END) as available,sum(CASE WHEN json_extract(value,'$.status') != 'Unknown' THEN 1 ELSE 0 END) as measured FROM checks GROUP BY site_id").all<any>();
 const stats=new Map(summaries.results.map((r:any)=>[r.site_id,r]));
 const histories=await Promise.all(sites.map(async(s:any)=>{const rows=await db().prepare('SELECT value FROM checks WHERE site_id=? ORDER BY at DESC LIMIT 60').bind(s.id).all<any>();return [s.id,rows.results.map((r:any)=>JSON.parse(r.value))] as const;}));
 const by=new Map(histories);
 const integrations=await get('integrations',{});
 // Staleness is evaluated independently of collection; a stalled collector cannot hide it.
 const last=await get('lastCollection',0);
 // Never write incidents during a frequent dashboard poll.
 const alerts=await db().prepare("SELECT incidents.*, CASE WHEN records.key IS NULL THEN 0 ELSE 1 END AS dismissed FROM incidents LEFT JOIN records ON records.key = 'dismissed:' || incidents.id ORDER BY incidents.opened DESC LIMIT 500").all();
 return {sites:sites.map((s:any)=>{const history=by.get(s.id)||[],st:any=stats.get(s.id);return {...s,latest:history[0]||null,history:[...history].reverse(),samples:st?.samples||0,periodStart:st?.start||null,uptime:st?.measured?Math.round(st.available/st.measured*10000)/100:null};}),settings,links:await get('links',initialLinks),alerts:alerts.results,integrations,lastCollection:last,scheduler:await get('scheduler',{enabled:false,intervalMinutes:60}),credentials:await credentialFlags(),serverTime:Date.now()};
}
