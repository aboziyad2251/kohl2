import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json } from '@/lib/portal/server';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { client } = await requireIdentity(req, true);
    const [database, last] = await Promise.all([
      client.from('properties').select('id').limit(1),
      client.from('crm_activities').select('created_at').eq('created_by_name', 'هاتف · ربط تلقائي').order('created_at', { ascending: false }).limit(1),
    ]);
    const secret = process.env.HATIF_WEBHOOK_SECRET;
    return json({
      checkedAt: new Date().toISOString(), database: !database.error,
      hatif: { enabled: process.env.HATIF_ENABLED === 'true', configured: !!secret && secret.length >= 20 && !secret.includes('•'), lastRecordedActivity: last.data?.[0]?.created_at || null, observationAvailable: !last.error },
      aiConfigured: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY),
      googleEnabled: process.env.GOOGLE_LOGIN_ENABLED === 'true', recoveryEnabled: process.env.PASSWORD_RECOVERY_ENABLED === 'true',
    });
  } catch (error) { return apiError(error); }
}
