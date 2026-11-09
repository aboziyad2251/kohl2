import { normalizeDigits } from '@/lib/property-import';
import { normalizeSearch } from '@/lib/navigation';
import { importColumns,type ImportValues,type ParsedPropertyRow } from './import-model';
export type CatalogRecord=Record<string,any>&{id:string;property_name:string;lessor_id:string};
export type ImportContext={catalog:CatalogRecord[];owners:{id:string;name:string}[];documents:{id:string;document_number:string;lessor_id:string}[];representatives:{id:string;name:string}[];version:string};
export type PreviewRow={source_row:number;classification:'NEW'|'UPDATE'|'NEEDS_CONFIRMATION';values:ImportValues;patch:Record<string,any>;candidates:CatalogRecord[];candidate_total:number;candidate_ids:string[];reasons:string[];errors:string[];new_errors:string[];diff:{field:string;before:unknown;after:unknown}[]};
export const identifier=(v:unknown)=>normalizeDigits(String(v??'')).trim().toLowerCase();
const name=(v:unknown)=>normalizeSearch(normalizeDigits(String(v??''))).replace(new RegExp('[^\\p{L}\\p{N}]','gu'),'');
export function similarity(a:unknown,b:unknown){const x=name(a),y=name(b);if(!x||!y)return 0;if(x===y)return 1;if(x.length<2||y.length<2)return 0;const grams=new Map<string,number>();for(let i=0;i<x.length-1;i++)grams.set(x.slice(i,i+2),(grams.get(x.slice(i,i+2))||0)+1);let match=0;for(let i=0;i<y.length-1;i++){const g=y.slice(i,i+2),n=grams.get(g)||0;if(n){match++;grams.set(g,n-1);}}return 2*match/(x.length+y.length-2);}
export const propertyUnit=(p:CatalogRecord)=>p.unit_number_edited?identifier(p.unit_number):identifier(p.unit_number??p.spreadsheet_details?.apartment_number);
const unit=propertyUnit;
const building=(p:CatalogRecord)=>p.building_name_edited?name(p.building_name):name(p.building_name||p.spreadsheet_details?.building_name||p.property_name.split(/\s*(?:—|-)\s*شقة/)[0]||'');
const equal=(a:unknown,b:unknown)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export function changes(patch:Record<string,any>,prior?:CatalogRecord){const out:{field:string;before:unknown;after:unknown}[]=[];for(const [key,v]of Object.entries(patch)){if(key==='amenities'){for(const [k,value]of Object.entries(v)){const old=Object.prototype.hasOwnProperty.call(prior?.amenities||{},k)?prior?.amenities?.[k]:prior?.spreadsheet_details?.[k]??null;if(!equal(old,value))out.push({field:k,before:old,after:value});}}else if(!equal(prior?.[key],v))out.push({field:key,before:prior?.[key]??null,after:v});}return out;}
export function buildPreview(rows:ParsedPropertyRow[],context:ImportContext){
 return rows.map((row):PreviewRow=>{const v=row.values,patch:Record<string,any>={},errors:string[]=[],reasons:string[]=[];const strongSets:CatalogRecord[][]=[];let unmatched=false;
 for(const col of importColumns){if(v[col.key]===undefined||['property_id','document_number'].includes(col.key))continue;if(col.amenity){patch.amenities??={};patch.amenities[col.key]=v[col.key];}else patch[col.key]=v[col.key];}
 let document=context.documents.find(d=>d.id===v.ownership_document_id);
 if(v.document_number){const found=context.documents.filter(d=>identifier(d.document_number)===identifier(v.document_number));if(found.length!==1)errors.push('رقم الصك غير موجود أو غير فريد؛ أضف الصك عبر مساره الحالي أولاً');else if(document&&document.id!==found[0].id)errors.push('رقم الصك ومعرّفه متعارضان');else document=found[0];}
 if(v.ownership_document_id&&!document)errors.push('الصك غير متاح');if(document)patch.ownership_document_id=document.id;
 if(v.lessor_id&&!context.owners.some(o=>o.id===v.lessor_id))errors.push('المالك غير متاح');
 if(document&&v.lessor_id&&document.lessor_id!==v.lessor_id)errors.push('مالك الصك لا يطابق مالك الصف');
 if(v.current_representative_id&&!context.representatives.some(r=>r.id===v.current_representative_id))errors.push('الممثل غير متاح');
 if(v.property_id){const found=context.catalog.filter(p=>p.id===v.property_id);if(found.length)strongSets.push(found);else unmatched=true;}
 for(const key of ['property_code','license_number'])if(v[key]){const found=context.catalog.filter(p=>identifier(p[key])===identifier(v[key]));if(found.length)strongSets.push(found);}
 if(document){let found=context.catalog.filter(p=>p.ownership_document_id===document!.id);if(v.unit_number)found=found.filter(p=>unit(p)===identifier(v.unit_number));if(found.length)strongSets.push(found);}
 const exact=strongSets.filter(s=>s.length===1).map(s=>s[0]);const exactIds=new Set(exact.map(p=>p.id));
 const proposed=exactIds.size===1?exact[0]:undefined;const compatible=proposed&&strongSets.every(s=>s.some(p=>p.id===proposed.id));
 const all=new Map<string,CatalogRecord>();strongSets.flat().forEach(p=>all.set(p.id,p));
 let classification:PreviewRow['classification']='NEW';
 if(proposed&&compatible&&!unmatched)classification='UPDATE';
 else {for(const p of context.catalog){const title=similarity(v.property_name,p.property_name);const sameUnit=v.unit_number&&unit(p)===identifier(v.unit_number);const sameBuilding=v.building_name&&building(p)===name(v.building_name);const sameAddress=v.address&&name(v.address)===name(p.address)&&(!v.city||name(v.city)===name(p.city));const gps=typeof v.latitude==='number'&&typeof v.longitude==='number'&&p.latitude!=null&&p.longitude!=null&&Math.abs(v.latitude-p.latitude)<0.00015&&Math.abs(v.longitude-p.longitude)<0.00015;
  if(title>0.75||(sameUnit&&(sameBuilding||sameAddress||gps))||sameAddress||gps)all.set(p.id,p);
 }if(all.size){classification='NEEDS_CONFIRMATION';reasons.push(exactIds.size>1||!compatible&&strongSets.length?'معرّفات متعارضة أو مشتركة':'تشابه الاسم أو الموقع أو المبنى والوحدة؛ يلزم قرارك');}}
 if(classification==='UPDATE'&&proposed){all.clear();all.set(proposed.id,proposed);}
 if(classification==='NEEDS_CONFIRMATION'&&unmatched)reasons.push('معرّف غير مطابق مع وجود سجل محتمل');
 const candidateTotal=all.size;const candidates=Array.from(all.values()).slice(0,20);
 const newErrors=importColumns.filter(c=>c.requiredNew&&(v[c.key]===undefined||v[c.key]===null||v[c.key]==='')).map(c=>'الجديد يحتاج '+c.label);
 if(document&&v.lessor_id===undefined)newErrors.push('الجديد يحتاج معرّف مالك الصك');
 return {source_row:row.source_row,classification,values:v,patch,candidates,candidate_total:candidateTotal,candidate_ids:candidates.map(p=>p.id),reasons,errors,new_errors:newErrors,diff:changes(patch,classification==='UPDATE'?proposed:undefined)};
 });
}
