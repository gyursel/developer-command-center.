import Dashboard from './dashboard';
import {requireOwner} from './owner-auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireOwner();return <Dashboard/>;}
