import { NextRequest } from 'next/server';
import { requireInternal } from '@/lib/navigation/require-internal';
import { apiError, json, PortalError } from '@/lib/portal/server';
import { agencyMetrics, brokerageLinkMetrics, documentationMetrics } from '@/lib/dashboard/metrics';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 const {client}=await requireInternal(req);
 const rows=async(table:string,columns:string)=>{const all:any[]=[];
  for(let page=0;page<20;page++){const {data,error}=await client.from(table).select(columns).order('id').range(page*1000,page*1000+999);if(error)throw new PortalError(503,'تعذر تحميل مؤشرات لوحة التحكم');all.push(...(data||[]));if((data||[]).length<1000)return all;}
  throw new PortalError(503,'تعذر حساب المؤشرات كاملة؛ لم يتم عرض إجماليات مقتطعة');
 };
 const [contracts,agencies,agreements,properties]=await Promise.all([
  rows('contracts','id,status,is_archived,ejar_contract_number,ejar_sync_status'),
  rows('e_poas','id,status,expiry_date'),
  rows('brokerage_agreements','id,is_archived,ejar_status,ejar_contract_number,ejar_sync_status'),rows('properties','id')]);
 return json({documentation:documentationMetrics(contracts),agencies:agencyMetrics(agencies),ejar:brokerageLinkMetrics(agreements),activeContracts:contracts.filter(c=>c.status==='Active').length,totalProperties:properties.length,activeBrokerage:agreements.filter(a=>a.ejar_status==='Active'&&!a.is_archived).length});
}catch(e){return apiError(e);}}
