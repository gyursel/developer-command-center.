import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {authenticated} from '../lib/auth';
export async function getOwner(){return await authenticated((await headers()).get('cookie')||'')?{userId:'owner'}:null;}
export async function requireOwner(){if(!await getOwner())redirect('/login');}
