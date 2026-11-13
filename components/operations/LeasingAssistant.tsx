"use client";
import { useState } from "react";
import type { Case, Workspace } from "@/lib/operations/model";
import { riyadhDate, termAlerts } from "@/lib/operations/model";
export default function LeasingAssistant({ workspace, owner, busy, onPlan, onFollowup }: {
  workspace: Workspace; owner: string; busy: boolean;
  onPlan: (id: string) => Promise<boolean>; onFollowup: (item: Case) => void;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const cases = workspace.cases.filter(c => c.assignee_id === owner);
  const tasks = workspace.followups.filter(f => f.assignee_id === owner && !f.completed_at)
    .sort((a,b) => a.due_at.localeCompare(b.due_at));
  const alerts = termAlerts(cases);
  return <section aria-label="أخصائي التأجير الافتراضي">
    <h2>أخصائي التأجير — مساعد افتراضي</h2>
    <p className="ops-help">داخل حسابك فقط. ينظم الطلبات المسندة إليك ويجهز المتابعات والمسودات؛ لا يرسل رسائل ولا يسجل مكالمة أو تحصيلاً أو إنجازاً لم يحدث.</p>
    <div className="portal-card">
      <h3>تقرير اليوم · {riyadhDate()}</h3>
      <p>{tasks.length} متابعات مفتوحة · {alerts.length} مدد تحتاج مراجعة المغادرة أو التجديد.</p>
      <p>الأولوية: عالج المتابعات المتأخرة، ثم نسّق الجاهزية قبل الوصول، وارفع أي قرار مالي عبر محمد ثم سالم.</p>
      <button className="portal-button" disabled={busy} onClick={async () => {
        if (await onPlan(requestId)) setRequestId(crypto.randomUUID());
      }}>إنشاء متابعات المدد التي تحتاج متابعة</button>
      <p className="ops-help">حتى 20 متابعة في المرة، تستحق بعد ساعة. لا يكرر متابعة مفتوحة أو متابعة أنشأها المساعد اليوم. راجع موعد كل مهمة؛ إنشاؤها لا يعني التواصل مع العميل.</p>
    </div>
    <h3>قائمة العمل</h3>
    {!tasks.length && <p>لا توجد متابعات مفتوحة مسندة إليك.</p>}
    {tasks.slice(0,30).map(t => <article className="portal-card" key={t.id}>
      <strong>{t.title}</strong>
      <p>{cases.find(c => c.id === t.case_id)?.customer_name || "طلب تأجير"} · {new Date(t.due_at).toLocaleString("ar-SA", {timeZone:"Asia/Riyadh"})}</p>
      {t.origin === "LEASING_ASSISTANT" && <span className="ops-badge">أنشأها المساعد الافتراضي — لم تُنجز بعد</span>}
    </article>)}
    {tasks.length > 30 && <p>يعرض أول 30 متابعة حسب موعدها؛ القائمة الكاملة في «يومي».</p>}
    <h3>مسودات التنسيق</h3>
    {alerts.slice(0,20).map(({item,action}) => <article className="portal-card" key={item.id}>
      <strong>{item.customer_name} · {action}</strong>
      <textarea className="portal-input w-full" aria-label={"مسودة "+item.customer_name} readOnly
        value={`مرحباً ${item.customer_name}، معك كحل العقارية. بخصوص مدة التأجير التي تنتهي بتاريخ ${item.end_date}، نرجو تأكيد رغبتك في المغادرة أو بحث إمكانية التمديد. سنراجع التوفر والشروط قبل أي تأكيد.`} />
      <button className="ops-link" onClick={() => onFollowup(item)}>فتح نموذج متابعة</button>
    </article>)}
    <p className="ops-help">المسودات اقتراحات للمراجعة والنسخ اليدوي؛ لم تُرسل عبر هاتف. لا يملك هذا المساعد صلاحية اعتماد مالي.</p>
  </section>;
}
