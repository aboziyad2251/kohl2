'use client';
import { useState } from 'react';
import { portalRequest } from '@/lib/portal/client';
type Viewer={user_id:string;name:string;role:string;active:boolean;enabled:boolean};
export default function KrManagementAccess(){
 const [users,setUsers]=useState<Viewer[]|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 async function load(){setBusy('load');setError('');try{setUsers((await portalRequest<{users:Viewer[]}>('/api/financials/kr/access')).users);}catch(e){setError(e instanceof Error?e.message:'تعذر تحميل الصلاحيات');}finally{setBusy('');}}
 async function update(user:Viewer,enabled:boolean){setBusy(user.user_id);setError('');try{await portalRequest('/api/financials/kr/access',{method:'PATCH',body:JSON.stringify({user_id:user.user_id,enabled})});setUsers(items=>items?.map(x=>x.user_id===user.user_id?{...x,enabled}:x)||null);}catch(e){setError(e instanceof Error?e.message:'تعذر حفظ الصلاحية');}finally{setBusy('');}}
 return <details className="portal-card kr-edit-control" onToggle={e=>{if(e.currentTarget.open&&!users&&!busy)void load();}}><summary>صلاحية مشاهدة تقارير الإدارة</summary><p>المسؤول العام والرئيس التنفيذي يملكان الوصول تلقائياً. امنح المديرين الآخرين صلاحية مشاهدة تقارير KR وسجلها فقط، دون تعديل أو صلاحيات مالية أخرى.</p>{error&&<p role="alert">{error}</p>}{!users&&<button className="underline" disabled={!!busy} onClick={()=>void load()}>{busy?'جارٍ التحميل…':'تحميل الحسابات'}</button>}{users?.length===0&&<p>لا توجد حسابات داخلية إضافية حالياً.</p>}{users?.map(user=><label className="block py-2" key={user.user_id}><input type="checkbox" checked={user.enabled} disabled={!!busy||!user.active&&!user.enabled} onChange={e=>void update(user,e.target.checked)}/> {user.name} · {user.role==='HR'?'الموارد البشرية':'موظف'} {!user.active&&'· الحساب معطل'}</label>)}</details>;
}
