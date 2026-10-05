import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json, PortalError } from '@/lib/portal/server';
import { workflow } from '@/lib/portal/workflow-server';
import { workflowSchema, customerOperations } from '@/lib/portal/workflows';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    try {
        const { user, profile } = await requireIdentity(req);
        const parsed = workflowSchema.safeParse(await req.json());
        if (!parsed.success) throw new PortalError(400, parsed.error.issues.map(i => i.message).join('; '));
        const { operation, ...payload } = parsed.data;
        if (!['ADMIN', 'CEO'].includes(profile.account.role) && !customerOperations.includes(operation)) throw new PortalError(403, 'Admin or CEO required');
        return json(await workflow(user.id, operation, payload));
    } catch (error) { return apiError(error); }
}
