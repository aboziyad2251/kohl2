import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emptyContent, type KrFacts } from './schema';
import { PortalError } from '@/lib/portal/server';

export async function collectReport(client:SupabaseClient, day:string) {
  const content = emptyContent(), warnings:string[] = [], sources:string[] = [];
  async function rows(table:string, columns:string, filter:(query:any)=>any, optional=false):Promise<any[]> {
    const all:any[]=[];
    for(let page=0;page<20;page++) {
      const {data,error} = await filter(client.from(table).select(columns)).order('id').range(page*1000,page*1000+999);
      if(error) { if(optional){ warnings.push(`تعذر تحميل ${table}؛ لا تعد القيم المفقودة صفراً.`); return []; } throw new PortalError(503,`تعذر تحميل مصدر التقرير: ${table}`); }
      all.push(...(data||[])); if((data||[]).length<1000){sources.push(table);return all;}
    }
    throw new PortalError(503,`حجم مصدر ${table} يتطلب تصديراً مخصصاً؛ لم يتم اقتطاع البيانات.`);
  }
  async function hatifRows() {
    const {data,error}=await client.rpc('kr_hatif_source',{day});
    if(error){warnings.push('تعذر التحقق من سجل هاتف؛ استورد الملخص الموثق.');return [];}
    sources.push('Hatif · verified ingestion links');return (data||[]) as any[];
  }
  const start=day+'T00:00:00+03:00', end=day+'T23:59:59.999999+03:00';
  const [activities, leads, transactions, properties, managed, agenda, delegated, observed] = await Promise.all([
    rows('crm_activities','id,title,activity_type,status,notes,created_at,created_by_name,lead_id,lead_or_client_name,due_date', q=>q.or(`due_date.eq.${day},and(created_at.gte.${start},created_at.lte.${end})`)),
    rows('crm_leads','id,name,phone,lead_type,priority,budget_max,notes,created_at,kr_category,kr_temperature',q=>q.gte('created_at',start).lte('created_at',end)),
    rows('financial_transactions','id,transaction_type,amount,tax_vat,net_profit,third_party_amount',q=>q.eq('transaction_date',day)),
    rows('properties','id,property_use,property_kind',q=>q),
    rows('managed_property_contracts','id,vacant_units,status,property_type',q=>q, true),
    rows('kr_agenda_tasks','id,action,owner,status,indicator',q=>q.eq('due_date',day).eq('is_current',true), true),
    rows('task_delegations','id,title,status,notes,assigned_to_name,description',q=>q.eq('due_date',day)),
    hatifRows(),
  ]);
  const hatifIds=new Set(observed.map(a=>a.id));
  content.tasks = activities.filter(a=>a.due_date===day && !hatifIds.has(a.id)).map(a=>({task:a.title,status:a.status==='COMPLETED'?'منجز' as const:'تحت الإجراء' as const,note:a.notes||''}));
  content.tasks.push(...agenda.map(a=>({task:a.action,status:a.status==='COMPLETED'?'منجز' as const:'بالانتظار' as const,note:`${a.owner} · ${a.indicator}`})));
  content.tasks.push(...delegated.map(a=>({task:a.title,status:a.status==='COMPLETED'?'منجز' as const:a.status==='IN_PROGRESS'?'تحت الإجراء' as const:'بالانتظار' as const,note:[a.assigned_to_name,a.notes||a.description].filter(Boolean).join(' · ')})));
  content.calls = observed.filter(a=>a.activity_type==='CALL').map(a=>({time:a.created_at,direction:'غير محدد',result:'غير محدد',durationSeconds:null,contact:[a.lead_or_client_name,a.phone].filter(Boolean).join(' · '),note:a.notes||''}));
  // Existing Hatif ingestion does not retain direction, wait times or delivery metrics.
  // Count observed calls only; never fabricate missing operational KPIs.
  if(observed.length) content.communications.totalCalls=content.calls.length;
  warnings.push('سجل هاتف الحالي لا يحفظ كل مؤشرات الاتجاه والانتظار والتسليم؛ استورد ملخص هاتف الموثق لاستكمالها.');
  content.operationalNotes = [];
  if(process.env.KOHL_OPERATIONS_KR_ENABLED==='true') {
    const {data:operations,error}=await client.rpc('operations_kr_summary',{day});
    if(error||!operations) warnings.push('تعذر تحميل ملخص التأجير والمالية الداخلية؛ لا تعد البيانات المفقودة صفراً.');
    else {
      sources.push('Kohl · leasing/internal finance');
      content.operationalNotes.push(`التأجير: ${operations.cases} طلب جديد؛ ${operations.followups_done} متابعة منجزة من ${operations.followups_due} مستحقة.`);
      content.operationalNotes.push(`المالية الداخلية: تحصيل معتمد ${operations.received} ريال؛ مصروفات ${operations.expenses} ريال؛ تأمين مستلم ${operations.deposits} ريال؛ ${operations.pending} حركات بانتظار المراجعة.`);
      content.operationalNotes.push('ملخص المالية الداخلية مستقل عن financial_transactions؛ لا تجمع المصدرين قبل المطابقة. التحصيل ليس صافي إيراد المكتب.');
    }
  }

  content.contacts=leads.map(l=>({contact:[l.name,l.phone].filter(Boolean).join(' · '),category:l.kr_category||'غير مصنف',temperature:l.kr_temperature||'غير مصنف',need:l.notes||'',next:'',rentalRequest:l.lead_type==='TENANT',pipelineValue:l.lead_type==='TENANT'&&Number(l.budget_max)>0?Number(l.budget_max):null}));
  content.communications.uniqueContacts=new Set([...leads.map(l=>l.id),...observed.map(a=>a.lead_id).filter(Boolean)]).size;
  content.summary.achievements=content.tasks.filter(t=>t.status==='منجز').map(t=>t.task);
  content.summary.inProgress=content.tasks.filter(t=>t.status!=='منجز').map(t=>t.task);
  const income=transactions.filter(t=>t.transaction_type==='INCOME'), expenses=transactions.filter(t=>t.transaction_type==='EXPENSE');
  if(transactions.some(t=>!['INCOME','EXPENSE'].includes(t.transaction_type))) throw new PortalError(503,'تصنيف القيود المالية غير معروف؛ راجع مخطط المصدر.');
  const sum=(items:any[],key:string)=>items.reduce((n,t)=>n+Number(t[key]||0),0);
  const trustKnown=income.every(t=>t.third_party_amount!=null);
  if(!trustKnown) warnings.push('تصنيف أمانات الطرف الثالث غير مكتمل؛ لا يمكن تأكيد صافي إيراد المكتب.');
  const commercial=managed.filter(m=>m.status==='Active'&&m.property_type==='Commercial');
  if(managed.some(m=>m.status==='Active'&&m.property_type==='Mixed'))warnings.push('الوحدات المختلطة غير مشمولة في عدد الوحدات التجارية لعدم توفر تفصيل الاستخدام.');
  const facts:KrFacts={financial:{received:sum(income,'amount'),thirdParty:trustKnown?sum(income,'third_party_amount'):null,officeRevenue:trustKnown?sum(income,'amount')-sum(income,'tax_vat')-sum(income,'third_party_amount')-sum(expenses,'net_profit'):null,vat:sum(income,'tax_vat'),transactions:transactions.length,source:'ERP · financial_transactions'},propertyCount:properties.length,availableUnits:sources.includes('managed_property_contracts')&&managed.filter(m=>m.status==='Active').every(m=>m.vacant_units!=null)?sum(managed.filter(m=>m.status==='Active'),'vacant_units'):null,commercialAvailableUnits:sources.includes('managed_property_contracts')&&commercial.every(m=>m.vacant_units!=null)?sum(commercial,'vacant_units'):null,sources,warnings,capturedAt:new Date().toISOString()};
  // Validate the bounded editable payload before persistence, including collected rows.
  return {content,facts};
}
