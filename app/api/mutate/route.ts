import {getOwner} from '../../owner-auth';
import {get,put,seed,db,incident} from '../../../lib/store';
import {webUrl} from '../../../lib/security';
import {initialSettings} from '../../../lib/defaults';
export async function POST(req:Request){
 if(!await getOwner())return Response.json({error:'Unauthorized'},{status:401});
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Forbidden'},{status:403});
 try{
  if(Number(req.headers.get('content-length')||0)>60000)throw new Error('Твърде много данни');
  const raw=await req.text();if(raw.length>60000)throw new Error('Твърде много данни');const b=JSON.parse(raw);await seed();
  if(b.type==='sites'||b.type==='links'){
   if(!Array.isArray(b.value)||b.value.length>30)throw new Error('Максимум 30 записа');
   const ids=new Set();const clean=b.value.map((s:any)=>{if(typeof s.id!=='string'||s.id.length>100||ids.has(s.id))throw new Error('Невалиден ID');ids.add(s.id);if(typeof s.name!=='string'||!s.name.trim())throw new Error('Въведи име');return {id:s.id,name:s.name.trim().slice(0,80),url:webUrl(s.url).toString(),...(b.type==='links'?{icon:String(s.icon||'↗').slice(0,6)}:{})};});
   if(b.type==='sites'){
    const old=await get<any[]>('sites',[]);
    for(const s of old){const next=clean.find((x:any)=>x.id===s.id);if(!next||next.url!==s.url){await db().batch([db().prepare('DELETE FROM checks WHERE site_id=?').bind(s.id),db().prepare('DELETE FROM records WHERE key=?').bind('availability:'+s.id)]);for(const suffix of ['offline','http','ssl'])await incident('site:'+s.id+':'+suffix,false);}}
   }
   await put(b.type,clean);
  }else if(b.type==='settings'){
   const s=b.value,modules=['websites','deployments','alerts','shortcuts'];
   if(!s||!Array.isArray(s.panels)||s.panels.length!==4||new Set(s.panels).size!==4||s.panels.some((x:any)=>!modules.includes(x)))throw new Error('Невалидно оформление');
   const clamp=(x:any,min:number,max:number)=>Math.min(max,Math.max(min,Number(x)||min));
   const settings={...initialSettings,sslDays:clamp(s.sslDays,1,365),repositories:(s.repositories||[]).slice(0,12).map((r:any)=>{if(!/^[\w.-]+\/[\w.-]+$/.test(r.name)||typeof r.branch!=='string'||!r.branch.trim()||r.branch.length>200)throw new Error('Невалидно repository/branch');return {name:r.name,branch:r.branch};}),projects:(s.projects||[]).filter((x:any)=>typeof x==='string').slice(0,20),panels:s.panels,hidden:(s.hidden||[]).filter((x:any)=>modules.includes(x)),visual:{theme:['green','blue','orange','red'].includes(s.visual?.theme)?s.visual.theme:'green',opacity:clamp(s.visual?.opacity,5,100),glow:clamp(s.visual?.glow,0,50),font:clamp(s.visual?.font,12,18),compact:!!s.visual?.compact,textColor:typeof s.visual?.textColor==='string'&&/^#[0-9a-f]{6}$/i.test(s.visual.textColor)?s.visual.textColor:'',textOpacity:clamp(s.visual?.textOpacity??100,20,100),logoSize:clamp(s.visual?.logoSize??190,70,215),logoOpacity:clamp(s.visual?.logoOpacity??100,10,100),logoGlow:clamp(s.visual?.logoGlow??35,0,100)},widths:Object.fromEntries(modules.map(k=>[k,s.widths?.[k]===1?1:s.widths?.[k]===2?2:['websites','shortcuts'].includes(k)?2:1])),heights:Object.fromEntries(modules.map(k=>[k,clamp(s.heights?.[k]||420,300,900)]))};
   await put('settings',settings);
  }else if(b.type==='alert'){
   if(typeof b.id!=='string'||b.id.length>100)throw new Error('Невалиден ID');
   if(b.action==='dismiss'){await put('dismissed:'+b.id,true);}
   else if(b.action==='restore'){await db().prepare('DELETE FROM records WHERE key=?').bind('dismissed:'+b.id).run();}
   else if(b.action==='read')await db().prepare('UPDATE incidents SET read=1 WHERE id=?').bind(b.id).run();
   else if(b.action==='mute')await db().prepare('UPDATE incidents SET muted=? WHERE id=?').bind(Date.now()+3600000,b.id).run();
   else if(b.action==='unmute')await db().prepare('UPDATE incidents SET muted=0 WHERE id=?').bind(b.id).run();
  }else throw new Error('Непознато действие');
  return Response.json({ok:true});
 }catch(e:any){return Response.json({error:e instanceof SyntaxError?'Невалидни данни':e.message||'Неуспешен запис'},{status:400});}
}
