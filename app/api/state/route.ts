import {getOwner} from '../../owner-auth';
import {snapshot} from '../../../lib/store';
import {publicIntegrations} from '../../../lib/integrations';
export async function GET(req:Request){if(!await getOwner())return Response.json({error:'Влез в собствения си акаунт'},{status:401});try{const s=await snapshot();s.integrations=publicIntegrations(s.integrations);return Response.json(s,{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Базата данни не е достъпна'},{status:503});}}
