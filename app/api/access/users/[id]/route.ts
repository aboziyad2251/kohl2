import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity, administrative, adminClient, invitationRedirect, apiError, json, PortalError } from '@/lib/portal/server';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const { user } = await requireIdentity(req, true);
        if (!z.string().uuid().safeParse(params.id).success)
            throw new PortalError(400, 'Invalid user');
        const input = z.object({ action: z.enum(['activate', 'deactivate', 'reset', 'invite']) }).parse(await req.json());
        const list = await administrative(user.id, 'LIST');
        const target = list.users.find((u: {
            id: string;
        }) => u.id === params.id);
        if (!target)
            throw new PortalError(404, 'Account not found');
        if (input.action === 'activate' || input.action === 'deactivate') {
            await administrative(user.id, 'STATUS', { user_id: params.id, is_active: input.action === 'activate' });
            return json({ ok: true });
        }
        // Never issue password links for an inactive account.
        if (!target.is_active)
            throw new PortalError(400, 'Reactivate the account before sending a link');
        if (input.action === 'invite' && target.last_login)
            throw new PortalError(400, 'This user has already signed in; use password reset');
        const admin = adminClient();
        const { error } = input.action === 'invite'
            ? await admin.auth.admin.inviteUserByEmail(target.email, { redirectTo: invitationRedirect() })
            : await admin.auth.resetPasswordForEmail(target.email, { redirectTo: invitationRedirect() });
        await administrative(user.id, input.action === 'invite' ? 'INVITATION' : 'AUTH_EVENT', {
            user_id: params.id, status: error ? 'FAILED' : 'SENT', event: `${input.action}_${error ? 'FAILED' : 'SENT'}`,
        });
        if (error)
            throw new PortalError(502, 'Email delivery failed. Check Auth/SMTP configuration and retry.');
        return json({ ok: true });
    }
    catch (error) {
        return apiError(error);
    }
}
