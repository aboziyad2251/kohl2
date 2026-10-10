import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json } from '@/lib/portal/server';
import { workflow } from '@/lib/portal/workflow-server';
import { attentionSummary } from '@/lib/portal/attention';
import type { PortalDashboard } from '@/lib/portal/workflows';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        const { user } = await requireIdentity(req);
        const data = await workflow(user.id, 'DASHBOARD') as PortalDashboard;
        return json(attentionSummary(data, user.id));
    } catch (error) { return apiError(error); }
}
