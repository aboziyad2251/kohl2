import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { PortalError } from '@/lib/portal/server';

export const RETURN_COOKIE = 'kohl_leasing_return';
export const SESSION_SECONDS = 4 * 60 * 60;
const PURPOSE = 'kohl-leasing-return-v1';
export type ReturnSession = {
  owner: string; parentSession: string; child: string; childSession: string;
  refreshToken: string; expires: number;
};
function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new PortalError(503, 'تبديل الحساب غير مهيأ.');
  return createHash('sha256').update(PURPOSE+'\0'+secret).digest();
}
export function sealReturnSession(value: ReturnSession) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), nonce);
  cipher.setAAD(Buffer.from(PURPOSE));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('base64url');
}
export function openReturnSession(value?: string): ReturnSession {
  try {
    if (!value || value.length > 3500) throw new Error();
    const bytes = Buffer.from(value, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0,12));
    cipher.setAAD(Buffer.from(PURPOSE)); cipher.setAuthTag(bytes.subarray(12,28));
    const data = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'));
    if (!data || typeof data.expires !== 'number' || data.expires <= Date.now()
      || typeof data.refreshToken !== 'string' || !data.refreshToken
      || ![data.owner,data.parentSession,data.child,data.childSession].every(isUuid)) throw new Error();
    return data;
  } catch { throw new PortalError(401, 'انتهت جلسة العودة؛ سجّل الدخول بحساب محمد.'); }
}
function isUuid(value: unknown) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
// Call only after Auth.getUser has verified this bearer.
export function verifiedSessionId(bearer: string) {
  try {
    const id = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString('utf8')).session_id;
    if (!isUuid(id)) throw new Error();
    return id as string;
  } catch { throw new PortalError(401, 'الجلسة غير صالحة للتبديل.'); }
}
export function requireSwitchOrigin(req: NextRequest) {
  const origin = new URL(process.env.APP_ORIGIN || req.url).origin;
  if (req.headers.get('origin') !== origin) throw new PortalError(403, 'مصدر الطلب غير مسموح.');
}
export function returnCookieOptions(req: NextRequest) {
  return {httpOnly:true,secure:new URL(process.env.APP_ORIGIN || req.url).protocol === 'https:',
    sameSite:'strict' as const,path:'/api/auth',maxAge:SESSION_SECONDS};
}
