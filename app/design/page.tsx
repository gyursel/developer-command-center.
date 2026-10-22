import { requireOwner } from '../owner-auth';
import DesignBoard from './style-board';

export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  await requireOwner();
  return <DesignBoard />;
}
