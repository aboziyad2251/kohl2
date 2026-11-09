import { z } from 'zod';
export const reportDate = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v + 'T00:00:00+03:00'); return !Number.isNaN(d.getTime()) && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year:'numeric', month:'2-digit', day:'2-digit' }).format(d) === v; }, 'تاريخ غير صالح');
const text = z.string().trim().max(12000);
const count = z.number().int().nonnegative().max(10000000).nullable();
const amount = z.number().finite().min(0).max(1e14).nullable();
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).max(500);
export const workStatus = z.enum(['منجز','تحت الإجراء','بالانتظار']);
export const actionSchema = z.object({ id: z.string().uuid(), action: text.min(1), contact: text, owner: text.min(1), due_at: z.string().datetime({ offset: true }), indicator: text.min(1) }).strict();
export const communicationsSchema = z.object({ inbound:count, outbound:count, missed:count, returned:count, abandoned:count, whatsappConversations:count, uniqueContacts:count, totalCalls:count, avgDurationSeconds:amount, avgWaitSeconds:amount, whatsappInbound:count, whatsappOutbound:count, pendingConversations:count }).strict();
export const contentSchema = z.object({
  summary: z.object({ achievements:list(text), inProgress:list(text), decisions:list(text) }).strict(),
  tasks: list(z.object({ task:text, status:workStatus, note:text }).strict()),
  improvements: list(z.object({ improvement:text, beneficiary:text, status:workStatus }).strict()),
  communications: communicationsSchema,
  followups: list(z.object({ entity:text, status:text, next:text }).strict()),
  carryovers: list(z.object({ item:text, owner:text }).strict()),
  calls: list(z.object({ time:z.string().datetime({ offset:true }), direction:z.enum(['واردة','صادرة','غير محدد']), result:z.enum(['مكتملة','فائتة','متروكة','غير محدد']), durationSeconds:amount, contact:text, note:text }).strict()),
  operationalNotes:list(text),
  contacts:list(z.object({ contact:text, category:z.enum(['إيجار سكني','مستثمر تجاري','مسوقون وتوظيف','داخلي','غير مصنف']), temperature:z.enum(['ساخن','دافئ','بارد','شريك','غير مصنف']), need:text, next:text, rentalRequest:z.boolean(), pipelineValue:amount }).strict()),
  analysis:z.object({ source:z.enum(['claude','manual','none']), bullets:list(text) }).strict(),
  strategies:list(z.object({ category:text, goal:text, channelTiming:text, message:text, followup:text }).strict()),
  tomorrow:list(actionSchema),
}).strict();
export type KrContent = z.infer<typeof contentSchema>;
export type KrFacts = { financial: { received:number; thirdParty:number|null; officeRevenue:number|null; vat:number; transactions:number; source:string }; propertyCount:number; availableUnits:number|null; commercialAvailableUnits:number|null; sources:string[]; warnings:string[]; capturedAt:string };
export type KrReport = { id:string; report_date:string; status:'DRAFT'|'PENDING_APPROVAL'|'RETURNED'|'APPROVED'|'PUBLISHED'; revision:number; content:KrContent; facts:KrFacts; prepared_name:string; submitted_at:string|null; approved_name:string|null; approved_at:string|null; return_note:string|null; updated_at:string; published_at?:string|null; previous_versions?:{revision:number;report_status:string;reason:string;actor_name:string;created_at:string}[] };
export function emptyContent(): KrContent { return { summary:{ achievements:[],inProgress:[],decisions:[] }, tasks:[], improvements:[], communications:{ inbound:null,outbound:null,missed:null,returned:null,abandoned:null,whatsappConversations:null,uniqueContacts:null,totalCalls:null,avgDurationSeconds:null,avgWaitSeconds:null,whatsappInbound:null,whatsappOutbound:null,pendingConversations:null }, followups:[],carryovers:[],calls:[],operationalNotes:[],contacts:[],analysis:{source:'none',bullets:[]},strategies:[],tomorrow:[] }; }
export function nextReportDay(day:string) { const date = new Date(day + 'T12:00:00+03:00'); date.setUTCDate(date.getUTCDate()+1); return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function assertTomorrow(content:KrContent, day:string) {
  const tomorrow = nextReportDay(day), ids = new Set<string>();
  for (const action of content.tomorrow) {
    const due = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(action.due_at));
    if (due !== tomorrow || ids.has(action.id)) throw new z.ZodError([{ code:z.ZodIssueCode.custom, path:['tomorrow'], message:'يجب أن تكون مواعيد الخطة في اليوم التالي بتوقيت الرياض ومعرّفاتها غير مكررة' }]);
    ids.add(action.id);
  }
}
