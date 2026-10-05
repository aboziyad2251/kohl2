import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminClient, apiError, json, PortalError } from '@/lib/portal/server';
export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
    try {
        const parsed = z.string().uuid().safeParse(params.code);
        if (!parsed.success) throw new PortalError(404, 'Document not found');
        const { data, error } = await adminClient().rpc('portal_verify_document', { code: parsed.data });
        if (error || !data) throw new PortalError(404, 'Document not found');
        return json(data);
    } catch (error) { return apiError(error); }
}
