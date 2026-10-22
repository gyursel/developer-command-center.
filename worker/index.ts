import handler from 'vinext/server/fetch-handler';
import {authenticated,sameOrigin,allowedAttempt,verifyPassword,createSession,cookie,logout} from '../lib/auth';
import {loginPage} from '../lib/login-page';
import {collect} from '../lib/collect';
import {put,snapshot} from '../lib/store';
import {publicIntegrations} from '../lib/integrations';
function secure(r:Response){const headers=new Headers(r.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','same-origin');return new Response(r.body,{status:r.status,headers});}
export default {
 async fetch(req:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const url=new URL(req.url);const path=url.pathname;
  if(!env.APP_ORIGIN||!env.OWNER_PASSWORD_HASH||!env.DB)return new Response('Configure APP_ORIGIN, OWNER_PASSWORD_HASH and DB.',{status:503});
  if(url.origin!==env.APP_ORIGIN)return new Response('Invalid origin',{status:403});
  let stage='initial';
  try{
   if(path==='/login'){
    if(req.method==='GET')return secure(new Response(loginPage(),{headers:{'Content-Type':'text/html; charset=utf-8'}}));
    if(req.method!=='POST')return new Response(null,{status:405});
    if(!sameOrigin(req))return new Response(null,{status:403});
    if(Number(req.headers.get('content-length')||0)>2048)return new Response(null,{status:413});
    if(!await allowedAttempt(req))return secure(new Response(loginPage(true),{status:429,headers:{'Content-Type':'text/html; charset=utf-8','Retry-After':'900'}}));
    const raw=await req.text();if(raw.length>2048)return new Response(null,{status:413});const data=new URLSearchParams(raw);const password=data.get('password')||'';
    const valid=password.length<=256&&await verifyPassword(password,env.OWNER_PASSWORD_HASH);
    if(!valid||data.get('username')!==env.OWNER_USERNAME)return secure(new Response(loginPage(true),{status:401,headers:{'Content-Type':'text/html; charset=utf-8'}}));
    return secure(new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':cookie(await createSession())}}));
   }
   stage='authentication';
   if(!await authenticated(req.headers.get('cookie')||''))return secure(path.startsWith('/api/')?Response.json({error:'Unauthorized'},{status:401}):new Response(null,{status:303,headers:{Location:'/login'}}));
   if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!sameOrigin(req))return new Response(null,{status:403});
   if(path==='/logout'){
    if(req.method!=='POST')return new Response(null,{status:405});await logout(req.headers.get('cookie')||'');return secure(new Response(null,{status:303,headers:{Location:'/login','Set-Cookie':cookie('',0)}}));
   }
   // Serve frequent dashboard data directly: skip Next/Vinext SSR for this JSON endpoint.
   if(path==='/api/state'&&req.method==='GET'){
    stage='state-snapshot';
    const state=await snapshot();
    stage='state-sanitize';
    state.integrations=publicIntegrations(state.integrations);
    stage='state-serialize';
    return secure(Response.json(state));
   }
   stage='page-render';
   return secure(await handler.fetch(req,env,ctx));
  }catch(error){
   // Never log cookies, authorization headers, URLs with query strings or credentials.
   console.error('DCC_WORKER_FAILURE',JSON.stringify({stage,path,errorType:error instanceof Error?error.name:typeof error}));
   return secure(Response.json({error:'Временна сървърна грешка.',stage},{status:503}));
  }
 },
 async scheduled(_controller:ScheduledController,env:Cloudflare.Env,_ctx:ExecutionContext){
  await collect();await put('scheduler',{enabled:true,intervalMinutes:1,lastRun:Date.now(),provider:'Cloudflare Cron'});
  await env.DB.batch([env.DB.prepare('DELETE FROM auth_sessions WHERE expires<?').bind(Date.now()),env.DB.prepare('DELETE FROM auth_attempts WHERE expires<?').bind(Date.now())]);
 }
};
