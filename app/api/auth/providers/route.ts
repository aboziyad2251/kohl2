import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({google: process.env.GOOGLE_LOGIN_ENABLED === 'true'},
    {headers:{'Cache-Control':'no-store'}});
}
