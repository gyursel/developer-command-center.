import {env} from 'cloudflare:workers';
import {get,put,db} from './store';
export type Provider = 'github'|'vercel';
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const encoded=(b:Uint8Array)=>btoa(String.fromCharCode(...b));
async function key(){
 const raw=(env as any).CREDENTIAL_ENCRYPTION_KEY;
 if(typeof raw!=='string'||bytes(raw).length!==32)throw new Error('Credential storage unavailable');
 return crypto.subtle.importKey('raw',bytes(raw),'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(provider:Provider,token:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(provider)},await key(),new TextEncoder().encode(token));
 return {v:1,iv:encoded(iv),cipher:encoded(new Uint8Array(cipher))};
}
export async function tokenFor(provider:Provider):Promise<string|null>{
 const stored=await get<any>('credential:'+provider,null);
 if(stored){const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(stored.iv),additionalData:new TextEncoder().encode(provider)},await key(),bytes(stored.cipher));return new TextDecoder().decode(plain);}
 return (env as any)[provider.toUpperCase()+'_TOKEN']||null;
}
export async function credentialFlags(){
 return {github:!!((env as any).GITHUB_TOKEN||await get('credential:github',null)),vercel:!!((env as any).VERCEL_TOKEN||await get('credential:vercel',null)),canSave:!!(env as any).CREDENTIAL_ENCRYPTION_KEY};
}
export async function saveToken(provider:Provider,token:string){await put('credential:'+provider,await seal(provider,token));}
export async function deleteToken(provider:Provider){await db().prepare('DELETE FROM records WHERE key=?').bind('credential:'+provider).run();}
