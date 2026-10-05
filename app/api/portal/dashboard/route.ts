import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json } from '@/lib/portal/server';
import { workflow } from '@/lib/portal/workflow-server';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try { const { user } = await requireIdentity(req); return json(await workflow(user.id, 'DASHBOARD')); }
    catch (error) { return apiError(error); }
}
