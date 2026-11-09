import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAudit,actions } from '@/lib/audit/server';
import { apiError,json,PortalError } from '@/lib/portal/server';
import { reportDate } from '@/lib/kr/schema';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 const {client}=await requireAudit(req),p=req.nextUrl.searchParams;
 const parsed=z.object({user:z.string().trim().max(254).regex(new RegExp('^[\\p{L}\\p{N}@. _+\\-]+$','u')).optional(),action:z.enum(actions).optional(),module:z.string().trim().max(100).optional(),from:reportDate.optional(),to:reportDate.optional(),page:z.coerce.number().int().min(0).max(100000).default(0)}).parse(Object.fromEntries(p));
 if(parsed.from&&parsed.to&&parsed.from>parsed.to)throw new PortalError(400,'ترتيب الفترة غير صحيح');
 let q=client.from('audit_logs').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(parsed.page*50,parsed.page*50+49);
 if(parsed.user){if(z.string().uuid().safeParse(parsed.user).success)q=q.eq('user_id',parsed.user);else q=q.or(`user_name.ilike.%${parsed.user.replace(/_/g,'\\_')}%,user_email.ilike.%${parsed.user.replace(/_/g,'\\_')}%`);}if(parsed.action)q=q.eq('action_type',parsed.action);if(parsed.module)q=q.eq('module',parsed.module);
 if(parsed.from)q=q.gte('created_at',parsed.from+'T00:00:00+03:00');
 if(parsed.to){const end=new Date(parsed.to+'T00:00:00+03:00');end.setUTCDate(end.getUTCDate()+1);q=q.lt('created_at',end.toISOString());}
 const {data,error,count}=await q;if(error)throw new PortalError(503,'تعذر قراءة سجل التدقيق');return json({logs:data,total:count,page:parsed.page});
 }catch(e){return apiError(e);}}
