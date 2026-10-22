'use client';

type Check={at?:number;status?:string;code?:number|null;ms?:number|null;error?:string|null;failureStage?:string};
type Site={name:string;url:string;latest?:Check|null;history?:Check[]};
function classify(check:Check):{title:string;cause:string;steps:string[];confidence:string}{
 const c=check.code,stage=check.failureStage,error=check.error||'';
 if(stage==='dns')return {title:'Проблем при DNS проверката',cause:'DNS резолюцията е неуспешна или отговорът не е разрешен от проверяващия сървър.',steps:['Провери DNS записите A/AAAA и nameserver-ите.','Провери дали домейнът се разрешава публично.','Ако адресът е блокиран, провери дали не сочи към частна мрежа.'],confidence:'Измерен етап: DNS; точната причина изисква DNS логове.'};
 if(/Timeout/i.test(error))return {title:'Превишено време за отговор',cause:'Проверката не е завършила в рамките на 12 секунди.',steps:['Провери работата и натоварването на сървъра.','Прегледай логовете за бавни заявки и връзките към базата.','Повтори проверката и сравни времената.'],confidence:'Потвърден timeout; причината може да е мрежа, приложение или доставчик.'};
 if(c===1102)return {title:'Cloudflare 1102',cause:'Върнат е код 1102; ако страницата е Cloudflare Error 1102, Worker вероятно е надвишил ресурсен лимит.',steps:['Отвори Cloudflare Workers → Metrics и Errors.','Провери CPU/изпълненията и лимитите на плана.','Разгледай Workers Logs и последния deployment; обмисли rollback след проверка.'],confidence:'Кодът сам по себе си не доказва Cloudflare Error 1102 без съдържание на страницата.'};
 if(c===429)return {title:'Ограничение на заявките (HTTP 429)',cause:'Сървърът връща rate-limit отговор.',steps:['Провери rate limiting/WAF правилата.','Прегледай броя заявки и повтори по-късно.','Провери дали мониторингът не е ограничен от антибот защита.'],confidence:'Потвърден HTTP статус; конкретното правило не е известно.'};
 if(c===401||c===403)return {title:'Отказан достъп',cause:'Сървърът отказва публичната заявка на мониторинга.',steps:['Провери дали URL изисква удостоверяване.','Прегледай WAF и правила за достъп.','Използвай отделен публичен health endpoint, ако е приложимо.'],confidence:'Потвърден HTTP статус; не означава непременно повреден сайт.'};
 if(c===404)return {title:'Страницата не е намерена',cause:'Проверяваният URL връща HTTP 404.',steps:['Провери точния URL и пренасочванията.','Провери routing и deployment файловете.'],confidence:'Потвърден HTTP статус.'};
 if(c&&c>=500)return {title:'Сървърна грешка HTTP '+c,cause:'Сървърът или upstream услугата връща грешка.',steps:['Прегледай application/runtime логовете около часа на инцидента.','Провери последния deployment, env variables и връзките към базата.','Провери състоянието на hosting доставчика.'],confidence:'Потвърден HTTP статус; без сървърни логове конкретната причина е неизвестна.'};
 if(c&&c>=400)return {title:'HTTP предупреждение '+c,cause:'Сайтът отговаря, но с клиентска грешка.',steps:['Провери URL, авторизация и routing.','Прегледай правилата за блокиране на заявките.'],confidence:'Потвърден HTTP статус.'};
 if(check.status==='Unknown')return {title:'Неопределен резултат',cause:'Проверката не може надеждно да заключи дали сайтът работи.',steps:['Провери публичния адрес и DNS.','Повтори проверката.','Прегледай ограниченията на Cloudflare Worker мониторинга.'],confidence:'Няма потвърдено прекъсване.'};
 if(check.status==='Offline')return {title:'Сайтът е недостъпен при проверката',cause:'Не е получен успешен HTTP отговор.',steps:['Провери DNS и хостинга.','Прегледай сървърните логове в hosting панела.','Повтори проверката за потвърждение.'],confidence:'Недостъпността е наблюдавана от проверяващия Worker.'};
 return {title:'Няма активен HTTP проблем',cause:'Последната проверка е успешна.',steps:['Продължи наблюдението на историята.'],confidence:'Това не изключва проблеми между отделните проверки.'};
}
export default function SiteDiagnostics({site}:{site:Site}){
 const latest=site.latest,history=(site.history||[]).slice(-10).reverse();
 if(!latest)return <section className="diagnostic-panel"><h3>Автоматична диагностика</h3><p>Няма реални измервания. Стартирай първата проверка.</p></section>;
 const d=classify(latest),bad=latest.status!=='Online';
 return <section className="diagnostic-panel" aria-label="Автоматична диагностика">
  <div className="diagnostic-heading"><h3>Автоматична диагностика</h3><span className={'diagnostic-level '+(bad?'issue':'ok')}>{bad?'Нуждае се от внимание':'Нормално'}</span></div>
  <strong className="diagnostic-title">{d.title}</strong>
  <p>{d.cause}</p>
  <p className="muted tiny"><strong>Доказателства:</strong> HTTP {latest.code??'няма'} · {latest.ms??'—'} ms · {latest.failureStage||'HTTP'} · {latest.error||'без регистрирана грешка'}</p>
  <p className="muted tiny"><strong>Достоверност:</strong> {d.confidence}</p>
  <h4>Препоръчителни действия</h4>
  <ol>{d.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
  <h4>Дневник на проверките</h4>
  <div className="diagnostic-log" role="region" aria-label="Последни измервания" tabIndex={0}>
   {history.length?history.map((x,i)=><div className="diagnostic-log-row" key={i}><time>{x.at?new Date(x.at).toLocaleString('bg-BG',{timeZone:'Europe/Sofia'}):'—'}</time><span>{x.status||'Unknown'}</span><span>HTTP {x.code??'—'}</span><span>{x.ms??'—'} ms</span><span>{x.error||'—'}</span></div>):<p>Няма история.</p>}
  </div>
  <p className="muted tiny">Това са реални HTTP/DNS резултати от DCC, не application/Cloudflare/Vercel сървърни логове. За точна първопричина могат да са необходими логовете на хостинга. DCC не изпълнява автоматични поправки.</p>
 </section>;
}
