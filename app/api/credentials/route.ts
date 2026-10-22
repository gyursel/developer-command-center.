import {getOwner} from '../../owner-auth';
import {env} from 'cloudflare:workers';
import {saveToken,deleteToken} from '../../../lib/credentials';
import {get,put,incident,db} from '../../../lib/store';
export async function POST(req:Request){
 const reply=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!await getOwner())return reply({error:'Влез отново.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Невалиден origin.'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Изисква се JSON.'},415);
 try{
  if(Number(req.headers.get('content-length')||0)>8192)return reply({error:'Твърде голяма заявка.'},413);
  const raw=await req.text();if(raw.length>8192)return reply({error:'Твърде голяма заявка.'},413);
  const b=JSON.parse(raw);if(!['github','vercel'].includes(b.provider))return reply({error:'Невалидна интеграция.'},400);
  const provider=b.provider as 'github'|'vercel';
  if(b.action==='delete'){await deleteToken(provider);return reply({ok:true});}
  const token=typeof b.token==='string'?b.token.trim():'';
  if(token.length<20||token.length>4096||/\s/.test(token))return reply({error:'Постави целия token без интервали.'},400);
  // Persistent throttling; no token values, request bodies or provider response bodies are logged.
  const now=Date.now();const lock=await db().prepare('INSERT INTO leases(key,until,owner) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET until=excluded.until,owner=excluded.owner WHERE leases.until < ? RETURNING owner').bind('credential-check:'+provider,now+15000,'validation',now).first<any>();
  if(!lock)return reply({error:'Изчакай 15 секунди преди нов опит.'},429);
  const url=provider==='github'?'https://api.github.com/user/repos?per_page=1':'https://api.vercel.com/v9/projects?limit=1';
  const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json','User-Agent':'DeveloperCommandCenter/1.0'},redirect:'manual',signal:AbortSignal.timeout(12000)});
  await r.body?.cancel();
  if(!r.ok)return reply({error:r.status===401?'Token-ът е невалиден или изтекъл.':r.status===403?'Token-ът няма достъп до необходимите ресурси.':'API проверката не успя (HTTP '+r.status+'). Опитай по-късно.'},400);
  await saveToken(provider,token);
  const state=await get<any>('integrations',{});state[provider]={...state[provider],nextAt:0,error:null};await put('integrations',state);
  await incident(provider+':credentials',false);
  return reply({ok:true});
 }catch{return reply({error:'Неуспешно свързване. Провери връзката и опитай отново.'},503);}
}
