// HttpOnly server sessions. Never copy them to JS storage.
export class SessionExpiredError extends Error {
  constructor(){super('Сесията е изтекла. Влез отново.');this.name='SessionExpiredError';}
}
export async function apiFetch(path:string,init:RequestInit={}) {
  const response=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',redirect:'manual'});
  // A fetch must not follow the sign-in flow into HTML (or a cross-origin CORS error).
  if(response.status===401||response.type==='opaqueredirect'||response.status===302||response.status===303){
    window.dispatchEvent(new Event('dcc:session-expired'));
    throw new SessionExpiredError();
  }
  return response;
}
