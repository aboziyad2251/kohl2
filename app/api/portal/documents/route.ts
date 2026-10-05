import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireIdentity, apiError, PortalError } from '@/lib/portal/server';
import { workflow } from '@/lib/portal/workflow-server';
import { ownerEarnings } from '@/lib/portal/calculations';
import { renderPortalPDF } from '@/lib/portal/pdf';
import type { PortalDashboard } from '@/lib/portal/workflows';
export const dynamic = 'force-dynamic';
const schema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('payment'), payment_id: z.string().uuid() }), z.object({ kind: z.literal('statement'), start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })]);
// Bound parallel Chromium processes on this application instance.
let rendering = 0;
export async function POST(req: NextRequest) {
    let acquired = false;
    try {
        const { user, profile } = await requireIdentity(req), body = schema.parse(await req.json());
        if (rendering >= 2) throw new PortalError(429, 'Documents are being prepared; try again shortly');
        rendering++; acquired = true;
        let document;
        if (body.kind === 'payment') document = await workflow(user.id, 'PAYMENT_DOCUMENT', { payment_id: body.payment_id });
        else {
            if (profile.account.role !== 'OWNER') throw new PortalError(403, 'Owner statement requires an owner account');
            if (body.end < body.start || !Number.isFinite(Date.parse(body.start)) || !Number.isFinite(Date.parse(body.end)) || Date.parse(body.end) - Date.parse(body.start) > 366 * 86400000) throw new PortalError(400, 'Choose a period of up to one year');
            const data = await workflow(user.id, 'DASHBOARD') as PortalDashboard;
            const rows = ownerEarnings(data, body.start, body.end);
            document = await workflow(user.id, 'STATEMENT_DOCUMENT', { owner_name: profile.account.name, start: body.start, end: body.end, rows, gross: rows.reduce((n, r) => n + r.gross, 0), deductions: rows.reduce((n, r) => n + r.deductions, 0), net: rows.reduce((n, r) => n + r.net, 0) });
        }
        const bytes = await renderPortalPDF(document);
        return new NextResponse(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Kohl-${body.kind}-${document.verification_code}.pdf"`, 'Cache-Control': 'private, no-store' } });
    } catch (error) { return apiError(error); }
    finally { if (acquired) rendering--; }
}
