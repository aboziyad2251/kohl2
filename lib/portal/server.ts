import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { PortalProfile } from './types';
import { ZodError } from 'zod';
export class PortalError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
function config() {
    const url = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
        throw new PortalError(503, 'Authentication is not configured');
    return { url, key };
}
export function adminClient() {
    const { url } = config();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key)
        throw new PortalError(503, 'User administration is not configured');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } });
}
export async function requireIdentity(req: NextRequest, executive = false) {
    const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer)
        throw new PortalError(401, 'Sign in required');
    const { url, key } = config();
    const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${bearer}` },
            fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
        auth: { persistSession: false, autoRefreshToken: false } });
    const { data: identity, error } = await client.auth.getUser(bearer);
    if (error || !identity.user)
        throw new PortalError(401, 'Invalid session');
    const { data, error: profileError } = await client.rpc('portal_me');
    if (profileError || !data)
        throw new PortalError(403, 'Inactive or unassigned account');
    const profile = data as PortalProfile;
    if (profile.account.id !== identity.user.id)
        throw new PortalError(403, 'Identity mismatch');
    if (executive && !['ADMIN', 'CEO'].includes(profile.account.role))
        throw new PortalError(403, 'Admin or CEO required');
    return { user: identity.user, profile, client };
}
export async function administrative(actor: string, operation: string, payload: unknown = {}, requestId = crypto.randomUUID()) {
    const { data, error } = await adminClient().rpc('portal_admin', { actor, operation, payload, request_id: requestId });
    if (error) {
        // Database errors can contain private constraint details. Do not expose them.
        console.error('[portal-admin]', operation, error.code);
        throw new PortalError(error.code === '42501' ? 403 : 400, 'The account or linked records could not be updated');
    }
    return data;
}
export function invitationRedirect() {
    const origin = process.env.APP_ORIGIN;
    if (!origin || !/^https?:\/\//.test(origin))
        throw new PortalError(503, 'APP_ORIGIN is not configured');
    return new URL('/auth/set-password', origin).toString();
}
export function apiError(error: unknown) {
    if (error instanceof ZodError)
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const known = error instanceof PortalError;
    if (!known)
        console.error('[portal-api]', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: known ? error.message : 'Unable to complete request' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
export function json(data: unknown) { return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } }); }
