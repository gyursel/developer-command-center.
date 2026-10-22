// Only public web destinations. Literal IPs, alternate ports and userinfo are disallowed.
// Cloudflare's global fetch is the final public-egress boundary, including DNS rebinding.
// Do not port this to Node fetch without pinning the approved DNS addresses at connect time.
export function webUrl(raw:string) {
 if(typeof raw!=='string'||raw.length>2048) throw new Error('Невалиден URL');
 const u=new URL(raw);
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||u.hash) throw new Error('Използвай публичен HTTP(S) адрес без порт, парола или fragment');
 const h=u.hostname.toLowerCase().replace(/\.$/,'');
 if(!h.includes('.')||h.includes(':')||/^\d+(\.\d+)*$/.test(h)||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]+$/.test(h)||/\.(localhost|local|internal|test|invalid|onion)$/.test(h)) throw new Error('Локални и IP адреси не се поддържат');
 u.hostname=h; return u;
}
export function publicIP(ip:string) {
 if(ip.includes(':')) { // Conservative public global-unicast subset; excludes transition/documentation ranges.
  const s=ip.toLowerCase(); return /^[23][0-9a-f]{3}:/.test(s)&&!/^2001:|^2002:|^3fff:/.test(s)&&!s.includes('.');
 }
 const a=ip.split('.').map(Number); if(a.length!==4||a.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
 const [x,y,z]=a;
 return !(x===0||x===10||x===127||x>=224||(x===100&&y>=64&&y<=127)||(x===169&&y===254)||(x===172&&y>=16&&y<=31)||(x===192&&(y===168||y===0||y===2))||(x===198&&(y===18||y===19||(y===51&&z===100)))||(x===203&&y===0&&z===113));
}
export async function publicDNS(u:URL, signal:AbortSignal, transport:typeof fetch=fetch) {
 const answers=await Promise.all(['A','AAAA'].map(async type=>{
  const r=await transport('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(u.hostname)+'&type='+type,{headers:{Accept:'application/dns-json'},signal,redirect:'manual'});
  if(!r.ok)throw new Error('DNS service HTTP '+r.status);
  const d:any=await r.json();if(d.Status!==0)throw new Error('DNS няма валиден отговор');
  return (d.Answer||[]).filter((a:any)=>a.type===1||a.type===28).map((a:any)=>a.data);
 }));
 const ips=answers.flat();if(!ips.length||ips.some(ip=>!publicIP(ip)))throw new Error('Блокиран DNS адрес');
 return ips;
}
export function classify(code:number|null) { return code===null?'Offline':code<400?'Online':code<500?'Warning':'Offline'; }
export async function probe(raw:string, transport:typeof fetch=fetch) {
 let stage='validation';const started=Date.now(), controller=new AbortController(), timer=setTimeout(()=>controller.abort(),12000);
 try {
  let u=webUrl(raw);let code=0;
  for(let i=0;i<=4;i++) {
   stage='dns';await publicDNS(u,controller.signal,transport);stage='http';
   const r=await transport(u.toString(),{method:'GET',redirect:'manual',signal:controller.signal,headers:{'User-Agent':'DeveloperCommandCenter/1.0','Accept':'text/html,*/*;q=0.8'},cache:'no-store'});
   code=r.status; const location=r.headers.get('location'); await r.body?.cancel();
   if([301,302,303,307,308].includes(code)&&location) {
    if(i===4)throw new Error('Твърде много пренасочвания');
    const next=webUrl(new URL(location,u).toString());
    if(u.protocol==='https:'&&next.protocol==='http:')throw new Error('Блокирано HTTPS към HTTP пренасочване');
    u=next;continue;
   }
   return {status:classify(code),code,ms:Date.now()-started,at:Date.now(),sslDays:null,sslValid:null,sslExpires:null,error:null};
  }
  throw new Error('Невалиден отговор');
 }catch(e:any){return {status:stage==='validation'||(stage==='dns'&&!String(e?.message).includes('DNS няма валиден отговор'))?'Unknown':'Offline',failureStage:stage,code:null,ms:Date.now()-started,at:Date.now(),sslDays:null,sslValid:null,sslExpires:null,error:controller.signal.aborted?'Timeout (12 секунди)':e.message==='Блокиран DNS адрес'?'Блокиран DNS адрес':/^DNS service HTTP \d+$/.test(e.message)?e.message:'Неуспешна '+stage+' проверка'};}
 finally {clearTimeout(timer);}
}
export function nextAvailability(old:any, observed:string) {
 if(!old) return {stable:observed,candidate:observed,streak:1,transition:false,previous:null};
 const streak=old.candidate===observed?Math.min(old.streak+1,3):1;
 const transition=observed!==old.stable&&streak>=2;
 return {stable:transition?observed:old.stable,candidate:observed,streak,transition,previous:old.stable};
}
