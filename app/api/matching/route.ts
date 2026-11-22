import {NextRequest} from 'next/server';
import {withAudit} from '@/lib/audit/server';
import {requireIdentity,PortalError,json,apiError} from '@/lib/portal/server';
import {profileSchema,eventSchema} from '@/lib/matching/model';
import {z} from 'zod';
export const dynamic='force-dynamic';
async function identity(req:NextRequest){const result=await requireIdentity(req);if(!['ADMIN','CEO','EMPLOYEE'].includes(result.profile.account.role))throw new PortalError(403,'غير مخول');return result;}
export async function GET(req:NextRequest){try{const {client}=await identity(req);const {data,error}=await client.rpc('market_workspace',{operation:'LOAD',payload:{}});if(error)throw new PortalError(503,'تعذر تحميل مساحة المطابقة. تحقق من تحديث قاعدة البيانات أو حجم السجلات');return json(data);}catch(e){return apiError(e);}}
const input=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('REQUEST'),payload:z.object({id:z.string().uuid(),details:profileSchema.refine(v=>v.hard.every(k=>v[k]!==null&&v[k]!==''),'أكمل الشروط الإلزامية')}).strict()}).strict(),
 z.object({operation:z.literal('LISTING'),payload:z.object({id:z.string().uuid(),listing_id:z.string().uuid(),details:profileSchema}).strict()}).strict(),
 z.object({operation:z.literal('FEEDBACK'),payload:eventSchema}).strict(),
]);
async function post(req:NextRequest){try{const {client}=await identity(req);const raw=await req.text();if(raw.length>10000)throw new PortalError(413,'طلب كبير');let body;try{body=JSON.parse(raw);}catch{throw new PortalError(400,'طلب غير صالح');}const parsed=input.parse(body);const {data,error}=await client.rpc('market_workspace',parsed);if(error)throw new PortalError(error.code==='42501'?403:400,'تعذر الحفظ؛ راجع بيانات الطلب والعقار والوحدة');return json(data);}catch(e){return apiError(e);}}
export const POST=withAudit(post);
