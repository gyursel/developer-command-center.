'use client';
import {apiFetch,SessionExpiredError} from './session-client';
import {useState} from 'react';
export default function CredentialForm({provider,configured,enabled,onSaved}:{provider:string;configured:boolean;enabled:boolean;onSaved:()=>Promise<void>}){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('Проверяваме ключа…');
  try{const r=await apiFetch('/api/credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,token})});const result:any=await r.json();if(!r.ok){setMessage(result.error||'Неуспешен запис.');return;}setToken('');setMessage('Ключът е проверен и запазен. Натисни „Синхронизирай“ по-долу.');await onSaved();}
  catch(e){setMessage(e instanceof SessionExpiredError?e.message:'Връзката е прекъсната. Опитай отново.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} autoComplete="off"><label className="field">{configured?'Замени token':'Постави token'}<input type="password" name={provider+'-access-token'} aria-label={provider+' token'} autoComplete="new-password" spellCheck={false} value={token} onChange={e=>setToken(e.target.value)} maxLength={4096} disabled={busy||!enabled} placeholder={configured?'Нов token (по избор)':'Постави създадения ключ тук'}/></label><button type="submit" className="outline-btn" disabled={!enabled||busy||!token.trim()}>{busy?'Проверяване…':'Провери и запази'}</button><p className="tiny muted" role="status" aria-live="polite">{!enabled?'Защитеното съхранение още не е конфигурирано.':message}</p></form>;
}
