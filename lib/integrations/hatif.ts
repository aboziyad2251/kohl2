import {createHmac,timingSafeEqual} from 'crypto';
import {z} from 'zod';
export const hatifScope={workspace:'3a22dc0c-549f-da45-fa62-9e69897bf05d',channel:'3a22dc0c-57bc-6e29-06b3-cd7aa539f176'};
export class HatifError extends Error{constructor(public status:number,message:string){super(message);}}
export function verifyHatif(raw:Buffer,signature:string|null,secret:string){if(!signature||!/^[a-f0-9]{64}$/.test(signature))return false;const expected=createHmac('sha256',secret).update(raw).digest();return timingSafeEqual(expected,Buffer.from(signature,'hex'));}
export function normalizeHatifPhone(value:string){let n=value.replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\s()+.-]/g,'');if(n.startsWith('00'))n=n.slice(2);if(/^05\d{8}$/.test(n))n='966'+n.slice(1);if(!/^[1-9]\d{7,14}$/.test(n))throw new HatifError(422,'رقم جهة الاتصال غير صالح');return '+'+n;}
const common=z.object({workspaceId:z.string().uuid(),channelId:z.string().uuid(),contactId:z.string().uuid().nullish(),creationTime:z.string().max(50).optional()}).passthrough();
export function parseHatif(kind:string,body:unknown){const parsed=common.safeParse(body);if(!parsed.success)throw new HatifError(400,'حدث غير صالح');const p=parsed.data;if(p.workspaceId.toLowerCase()!==hatifScope.workspace||p.channelId.toLowerCase()!==hatifScope.channel)throw new HatifError(403,'قناة غير مسموحة');
 if(kind==='calls'){if(typeof p.callId!=='string'||!z.string().uuid().safeParse(p.callId).success)throw new HatifError(400,'معرّف المكالمة مفقود');return p;}
 if(kind!=='whatsapp'||typeof p.conversationEventId!=='string'||!z.string().uuid().safeParse(p.conversationEventId).success||!['Inbound','Outbound'].includes(String(p.direction)))throw new HatifError(400,'حدث واتساب غير صالح');return p;}
let token:{value:string;until:number}|undefined;
export async function getHatifContact(contactId:string){
 const id=process.env.HATIF_CLIENT_ID,secret=process.env.HATIF_CLIENT_SECRET;if(!id||!secret)throw new HatifError(503,'بيانات API هاتف غير مكتملة');
 if(!token||token.until<Date.now()){const r=await fetch('https://api.voxa.sa/connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'KohlCRM/1.0'},body:new URLSearchParams({client_id:id,client_secret:secret,grant_type:'client_credentials',scope:'VoxaAPI'}),cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw new HatifError(503,'تعذر الاتصال بهاتف');const t=await r.json();if(typeof t.access_token!=='string'||typeof t.expires_in!=='number')throw new HatifError(503,'استجابة هاتف غير صالحة');token={value:t.access_token,until:Date.now()+Math.max(0,Math.min(t.expires_in,3600)-60)*1000};}
 const r=await fetch('https://api.voxa.sa/v1/contacts/'+encodeURIComponent(contactId),{headers:{Authorization:'Bearer '+token.value,'User-Agent':'KohlCRM/1.0'},cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});if(r.status===401)token=undefined;if(!r.ok)throw new HatifError(503,'تعذر جلب جهة الاتصال من هاتف');const c=await r.json();if(c.workspaceId?.toLowerCase()!==hatifScope.workspace||typeof c.phoneNumber!=='string')throw new HatifError(422,'جهة الاتصال خارج مساحة العمل أو بلا رقم');return {name:typeof c.name==='string'?c.name.slice(0,150):'',phone:normalizeHatifPhone(c.phoneNumber)};
}
export async function normalizeHatifEvent(kind:string,p:ReturnType<typeof parseHatif>){
 if(kind==='whatsapp'&&p.direction!=='Inbound')return null;
 let contact:{name:string;phone:string};if(p.contactId)contact=await getHatifContact(p.contactId);else if(kind==='calls'&&typeof p.contactNumber==='string')contact={name:'',phone:normalizeHatifPhone(p.contactNumber)};else throw new HatifError(422,'جهة الاتصال غير معروفة');
 if(kind==='calls'&&typeof p.contactNumber==='string'&&normalizeHatifPhone(p.contactNumber)!==contact.phone)throw new HatifError(422,'رقم جهة الاتصال غير متطابق');
 const date=typeof p.creationTime==='string'?new Date(p.creationTime):new Date();if(Number.isNaN(date.getTime()))throw new HatifError(400,'تاريخ الحدث غير صالح');
 const summary=typeof p.summary==='string'?p.summary.slice(0,4000):'';const content=kind==='whatsapp'&&typeof p.body==='string'?p.body.slice(0,8000):'';
 return {workspace_id:hatifScope.workspace,channel_id:hatifScope.channel,event_id:String(kind==='calls'?p.callId:p.conversationEventId),kind:kind==='calls'?'CALL':'WHATSAPP',phone:contact.phone,name:contact.name||'عميل هاتف '+contact.phone.slice(-4),occurred_at:date.toISOString(),title:kind==='calls'?'مكالمة عبر هاتف':'رسالة واتساب عبر هاتف',notes:[content,summary,kind==='calls'?'مدة المكالمة: '+String(p.callLength||'غير محددة').slice(0,30):'نوع الرسالة: '+String(p.messageType||'غير محدد').slice(0,40)].filter(Boolean).join('\n')};
}

