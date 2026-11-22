export const followupCategories=['GENERAL','CONTACT','QUALIFY','OPTIONS','VIEWING','CONTRACT','ARRIVAL','DEPARTURE','RENEWAL','READINESS','COLLECTION'] as const;
export type FollowupCategory=typeof followupCategories[number];
export const followupCategoryLabels:Record<FollowupCategory,string>={GENERAL:'متابعة عامة',CONTACT:'تواصل أولي',QUALIFY:'تحديد الاحتياج',OPTIONS:'عرض الخيارات',VIEWING:'تنسيق معاينة',CONTRACT:'استكمال العقد',ARRIVAL:'تنسيق الوصول',DEPARTURE:'تنسيق المغادرة',RENEWAL:'تجديد أو إخلاء',READINESS:'تنسيق جاهزية الوحدة',COLLECTION:'متابعة التحصيل'};
export function suggestFollowupCategory(item:{stage:string;kind:string;start_date:string|null},today:string):FollowupCategory{
 if(item.stage==='NEW')return 'CONTACT';
 if(item.stage==='QUALIFIED')return 'OPTIONS';
 if(item.stage==='OFFERED')return 'VIEWING';
 if(item.stage==='VIEWING')return 'CONTRACT';
 if(item.stage==='CONFIRMED')return item.kind==='DAILY'?(item.start_date&&item.start_date>=today?'ARRIVAL':'DEPARTURE'):'RENEWAL';
 return 'GENERAL';
}
export function followupCategorySummary(items:{category?:FollowupCategory;due_at:string;completed_at:string|null}[],from:string,to:string){
 const scoped=items.filter(item=>{
  const stamp=Date.parse(item.due_at);if(!Number.isFinite(stamp))return false;
  const date=new Date(stamp+3*3600000).toISOString().slice(0,10);
  return date>=from&&date<=to;
 });
 return followupCategories.map(category=>{
  const tasks=scoped.filter(item=>(item.category||'GENERAL')===category);
  return {category,total:tasks.length,completed:tasks.filter(item=>item.completed_at!==null).length};
 }).filter(row=>row.total>0);
}
