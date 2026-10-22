import {env} from 'cloudflare:workers';
const enc=new TextEncoder();
export const SESSION_COOKIE='dcc_session';
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
export function sameOrigin(req:Request){return req.headers.get('origin')===env.APP_ORIGIN && new URL(req.url).origin===env.APP_ORIGIN;}
export async function verifyPassword(password:string,stored:string){
 const [type,iterations,salt,expected]=stored.split('$');
 if(type!=='pbkdf2'||iterations!=='100000'||!salt||!/^[a-f0-9]{64}$/.test(expected||''))return false;
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bytes=Uint8Array.from(atob(salt),c=>c.charCodeAt(0));
 const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:100000,hash:'SHA-256'},key,256));
 let diff=0;for(let i=0;i<bits.length;i++)diff|=bits[i]^parseInt(expected.slice(i*2,i*2+2),16);return diff===0;
}
export function sessionToken(cookie:string){const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export async function authenticated(cookie:string){
 if(!env.OWNER_PASSWORD_HASH)return false;const token=sessionToken(cookie);if(!token)return false;
 const s=await env.DB.prepare('SELECT expires,version FROM auth_sessions WHERE hash=?').bind(await digest(token)).first<{expires:number,version:string}>();
 return !!s&&s.expires>Date.now()&&s.version===await digest(env.OWNER_PASSWORD_HASH);
}
export function cookie(token:string,age=43200){const u=new URL(env.APP_ORIGIN);const local=['localhost','127.0.0.1'].includes(u.hostname);return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${u.protocol==='https:'?'; Secure':local?'':'; Secure'}`;}
export async function allowedAttempt(req:Request){
 const ip=await digest(req.headers.get('cf-connecting-ip')||'local');const now=Date.now(),window=Math.floor(now/900000); 
 for(const key of ['ip:'+ip+':'+window,'global:'+window]){
 const row=await env.DB.prepare('INSERT INTO auth_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+900000).first<{count:number}>();
 if(!row||row.count>(key.startsWith('ip:')?10:100))return false;
 }return true;
}
export async function createSession(){const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');await env.DB.prepare('INSERT INTO auth_sessions(hash,expires,version) VALUES(?,?,?)').bind(await digest(token),Date.now()+43200000,await digest(env.OWNER_PASSWORD_HASH)).run();return token;}
export async function logout(raw:string){const t=sessionToken(raw);if(t)await env.DB.prepare('DELETE FROM auth_sessions WHERE hash=?').bind(await digest(t)).run();}
