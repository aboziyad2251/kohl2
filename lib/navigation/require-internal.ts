import { NextRequest } from 'next/server';
import { requireIdentity, PortalError } from '@/lib/portal/server';
export async function requireInternal(req: NextRequest) {
  const identity = await requireIdentity(req);
  if (!['ADMIN', 'CEO', 'HR', 'EMPLOYEE'].includes(identity.profile.account.role)) throw new PortalError(403, 'Internal account required');
  return identity;
}
