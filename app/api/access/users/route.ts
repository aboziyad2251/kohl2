import { NextRequest } from 'next/server';
import { requireIdentity, administrative, adminClient, invitationRedirect, apiError, json, PortalError } from '@/lib/portal/server';
import { saveUserSchema } from '@/lib/portal/validation';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        const { user } = await requireIdentity(req, true);
        return json(await administrative(user.id, 'LIST'));
    }
    catch (error) {
        return apiError(error);
    }
}
export async function POST(req: NextRequest) {
    try {
        const { user } = await requireIdentity(req, true);
        const parsed = saveUserSchema.safeParse(await req.json());
        if (!parsed.success)
            throw new PortalError(400, parsed.error.issues.map(i => i.message).join('; '));
        const input = parsed.data;
        const requestId = crypto.randomUUID();
        const admin = adminClient();
        const googleAccount = process.env.GOOGLE_LOGIN_ENABLED === 'true';
        let target = input.user_id;
        if (!target) {
            // generateLink creates the unconfirmed Auth identity without sending mail.
            // Its token stays on the server and is discarded; DB links precede delivery.
            const { data, error } = googleAccount
                ? await admin.auth.admin.createUser({email:input.email,email_confirm:true})
                : await admin.auth.admin.generateLink({ type: 'invite', email: input.email,
                    options: { redirectTo: invitationRedirect() } });
            if (error || !data.user)
                throw new PortalError(400, 'Email cannot be provisioned; use the existing account or retry');
            target = data.user.id;
            // Prevent adopting/promoting an unrelated existing identity through email.
            const list = await administrative(user.id, 'LIST');
            if (list.users.some((u: {
                id: string;
            }) => u.id === target))
                throw new PortalError(409, 'Account already exists; edit or resend its invite');
        }
        else {
            const list = await administrative(user.id, 'LIST');
            const existing = list.users.find((u: {
                id: string;
            }) => u.id === target);
            if (!existing || existing.email.toLowerCase() !== input.email.toLowerCase())
                throw new PortalError(400, 'Use the account email already on record');
        }
        await administrative(user.id, 'SAVE', { ...input, user_id: target }, requestId);
        if (input.user_id)
            return json({ user_id: target, saved: true });
        await administrative(user.id, 'STATUS', { user_id: target, is_active: true }, requestId);
        if (googleAccount) return json({user_id:target,saved:true,invitation_sent:false,
            message:'Account approved. The user can sign in with Google using this email.',
            whatsapp:`مرحباً ${input.full_name}، تم اعتماد حسابك لدى كحل العقارية. سجل الدخول باستخدام Google بالبريد ${input.email}. ${process.env.APP_ORIGIN}/login`});
        const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, { redirectTo: invitationRedirect() });
        await administrative(user.id, 'INVITATION', { user_id: target, status: inviteError ? 'FAILED' : 'SENT' }, requestId);
        return json({ user_id: target, saved: true, invitation_sent: !inviteError,
            message: inviteError ? 'Account created. Email delivery failed; resend from Users & Access.' : 'Invitation sent',
            whatsapp: `مرحباً ${input.full_name}، تم إنشاء حسابك لدى كحل العقارية. يرجى استخدام رابط الدعوة المرسل إلى ${input.email} لتعيين كلمة المرور. ${process.env.APP_ORIGIN}/login` });
    }
    catch (error) {
        return apiError(error);
    }
}
