import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity, administrative, apiError, json } from '@/lib/portal/server';
export async function POST(req: NextRequest) {
    try {
        const { user } = await requireIdentity(req, true);
        const payload = z.object({ tenant_lease_end_action: z.enum(['HISTORY', 'DEACTIVATE']) }).parse(await req.json());
        return json(await administrative(user.id, 'SETTINGS', payload));
    }
    catch (error) {
        return apiError(error);
    }
}
