import {getOwner} from '../../owner-auth';
import {snapshot,put} from '../../../lib/store';
import {publicIntegrations} from '../../../lib/integrations';
export async function GET(){if(!await getOwner())return Response.json({error:'Unauthorized'},{status:401});try{const s=await snapshot();s.integrations=publicIntegrations(s.integrations);return Response.json(s,{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Database unavailable'},{status:503});}}
