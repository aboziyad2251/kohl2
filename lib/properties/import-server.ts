import 'server-only';
import { NextRequest } from 'next/server';
import { adminClient,requireIdentity,PortalError } from '@/lib/portal/server';
import type { ImportContext } from './import-match';
export async function importActor(req:NextRequest){const identity=await requireIdentity(req);if(identity.profile.account.history_only||!['ADMIN','CEO','EMPLOYEE'].includes(identity.profile.account.role))throw new PortalError(403,'لا تملك صلاحية استيراد العقارات');return identity;}
export async function importRpc(name:string,params:Record<string,unknown>){const {data,error}=await adminClient().rpc(name,params);if(error)throw new PortalError(error.code==='42501'?403:error.code==='40001'||error.code==='23505'?409:503,error.code==='40001'?'تغيرت البيانات أو انتهت المعاينة؛ أعد المعاينة قبل الحفظ.':error.code==='23505'?'كود أو وحدة مكررة؛ راجع القرارات والملف.':'تعذر تنفيذ الاستيراد. راجع بيانات المالك والصك والحقول والصلاحيات.');return data;}
export async function importContext(actor:string):Promise<ImportContext>{return importRpc('property_import_context',{actor});}
export async function importJson(req:NextRequest,max=2*1024*1024){const reader=req.body?.getReader();if(!reader)throw new PortalError(400,'الطلب فارغ');let size=0;const chunks:Uint8Array[]=[];while(true){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>max){await reader.cancel();throw new PortalError(413,'بيانات كثيرة؛ قسّم الملف');}chunks.push(x.value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PortalError(400,'JSON غير صالح');}}
