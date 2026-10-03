import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json } from '@/lib/portal/server';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        const { profile, user } = await requireIdentity(req);
        return json({ ...profile, email: user.email });
    }
    catch (error) {
        return apiError(error);
    }
}
