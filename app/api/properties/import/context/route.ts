import { NextRequest } from 'next/server';
import { importActor,importContext } from '@/lib/properties/import-server';
import { apiError,json } from '@/lib/portal/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const {user}=await importActor(req);return json(await importContext(user.id));}catch(e){return apiError(e);}}
