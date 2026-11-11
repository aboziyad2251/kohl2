"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { portalRequest } from "@/lib/portal/client";
import {
  type Workspace,
  type Case,
  type Unit,
  labels,
  kinds,
  stages,
  entryKinds,
  metrics,
  recommendations,
  termAlerts,
  riyadhDate,
  operationAction,
} from "@/lib/operations/model";
import { downloadWorkbook, type ExportSnapshot } from "@/lib/operations/export";
import "./operations.css";
import DocumentsPanel from "./DocumentsPanel";
import InstallmentEditor from "./InstallmentEditor";
import { saveDownload } from "@/lib/operations/client";
const money = (v: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(
    v,
  );
const dateTime = (v: string) =>
  new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(v));
const field = "portal-input w-full";
function Input({
  name,
  label,
  type = "text",
  value,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
}) {
  return (
    <label className="ops-field">
      {label}
      <input
        name={name}
        className={field}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={1000}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0.01" : undefined}
      />
    </label>
  );
}
function Options({
  name,
  label,
  items,
  value,
  optional = false,
  onChange,
}: {
  name: string;
  label: string;
  items: { id: string; name: string }[];
  value?: string;
  optional?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="ops-field">
      {label}
      <select
        className={field}
        name={name}
        defaultValue={value || ""}
        required={!optional}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="">{optional ? "غير محدد" : "اختر"}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  );
}
const options = (values: readonly string[]) =>
  values.map((id) => ({ id, name: labels[id] || id }));
export default function OperationsWorkspace({
  mode,
}: {
  mode: "leasing" | "finance";
}) {
  const { currentUser, isExecutive } = useAuth();
  const [entryCase, setEntryCase] = useState(""),
    [entryKind, setEntryKind] = useState("");
  const [w, setW] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(mode === "leasing" ? "today" : "entries"),
    [search, setSearch] = useState(""),
    [employee, setEmployee] = useState("");
  const [from, setFrom] = useState(riyadhDate()),
    [to, setTo] = useState(riyadhDate());
  const [form, setForm] = useState<{
      type: string;
      id: string;
      item?: Case | Unit;
    }>(),
    [exported, setExported] = useState<ExportSnapshot>();
  const generation = useRef(0),
    inflight = useRef(false);
  const load = useCallback(async () => {
    const g = ++generation.current;
    setLoading(true);
    try {
      const data = await portalRequest<Workspace>("/api/operations");
      if (g === generation.current) {
        setW(data);
        setError("");
      }
    } catch (e) {
      if (g === generation.current) {
        setW(null);
        setError(e instanceof Error ? e.message : "تعذر التحميل");
      }
    } finally {
      if (g === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    setW(null);
    setForm(undefined);
    setExported(undefined);
    void load();
    return () => {
      ++generation.current;
    };
  }, [load, currentUser.id]);
  useEffect(() => {
    if (!form) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".ops-dialog");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not([type="hidden"]),select,textarea',
        ) || [],
      );
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !inflight.current) {
        setForm(undefined);
        return;
      }
      if (e.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [form?.id]);
  const open = (type: string, item?: Case | Unit) => {
    setEntryCase("");
    setEntryKind("");
    setForm({ type, id: crypto.randomUUID(), item });
    setError("");
    setNotice("");
  };
  async function save(input: unknown) {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      const checked = operationAction.parse(input);
      await portalRequest("/api/operations", {
        method: "POST",
        body: JSON.stringify(checked),
      });
      setForm(undefined);
      setNotice("تم الحفظ.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "راجع الحقول المطلوبة والتواريخ والمبالغ.",
      );
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const data = new FormData(event.currentTarget),
      get = (key: string) => String(data.get(key) || ""),
      nullable = (key: string) => get(key) || null;
    const item = form.item as Case | undefined;
    try {
      if (form.type === "case")
        return await save({
          operation: "CASE_CREATE",
          id: form.id,
          lead_id: get("lead_id"),
          assignee_id: get("assignee_id") || currentUser.id,
          kind: get("kind"),
          source: get("source"),
          need: get("need"),
          next_action: get("next_action"),
          due_at: new Date(get("due_at") + ":00+03:00").toISOString(),
        });
      if (form.type === "update" && item)
        return await save({
          operation: "CASE_UPDATE",
          id: item.id,
          version: item.version,
          stage: get("stage"),
          note: get("note"),
          unit_id: nullable("unit_id"),
          start_date: nullable("start_date"),
          end_date: nullable("end_date"),
          amount: get("amount") ? Number(get("amount")) : null,
          beneficiary: nullable("beneficiary"),
          contract_id: nullable("contract_id"),
        });
      if (form.type === "followup")
        return await save({
          operation: "FOLLOWUP_ADD",
          id: form.id,
          case_id: get("case_id"),
          title: get("title"),
          due_at: new Date(get("due_at") + ":00+03:00").toISOString(),
        });
      if (form.type === "done")
        return await save({
          operation: "FOLLOWUP_DONE",
          id: get("id"),
          note: get("note"),
          blocked_by: get("blocked_by"),
        });
      if (form.type === "unit")
        return await save({
          operation: "UNIT_SAVE",
          id: form.item?.id || form.id,
          property_id: get("property_id"),
          code: get("code"),
          readiness: get("readiness"),
          note: get("note"),
        });
      if (form.type === "entry")
        return await save({
          operation: "ENTRY_CREATE",
          id: form.id,
          installment_id: nullable("installment_id"),
          case_id: nullable("case_id"),
          kind: get("kind"),
          amount: Number(get("amount")),
          date: get("date"),
          holder: get("holder"),
          reference: get("reference"),
          category: get("category"),
          note: get("note"),
        });
      if (form.type === "decision")
        return await save({
          operation: "ENTRY_DECIDE",
          id: get("id"),
          status: get("status"),
          note: get("note"),
        });
    } catch {
      setError("تحقق من التاريخ والوقت؛ المواعيد بتوقيت الرياض.");
    }
  }
  async function exportReport() {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      const snapshot = await portalRequest<ExportSnapshot>(
        "/api/operations/export",
        {
          method: "POST",
          body: JSON.stringify({ id: crypto.randomUUID(), from, to }),
        },
      );
      setExported(snapshot);
      await downloadWorkbook(snapshot);
      setNotice(
        "حُفظت نسخة التقرير ونُزّل ملف Excel. يمكنك طباعة الملخص إلى PDF.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التصدير");
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  }
  async function readExport(id: string) {
    setBusy(true);
    setError("");
    try {
      const snapshot = await portalRequest<ExportSnapshot>(
        "/api/operations/export?id=" + encodeURIComponent(id),
      );
      setExported(snapshot);
      await downloadWorkbook(snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل التقرير");
    } finally {
      setBusy(false);
    }
  }
  const performance =
    w && employee
      ? {
          ...w,
          cases: w.cases.filter((c) => c.assignee_id === employee),
          followups: w.followups.filter((f) => f.assignee_id === employee),
        }
      : w;
  const m = performance ? metrics(performance, from, to) : null;
  const tabs =
    mode === "leasing"
      ? [
          ["today", "يومي"],
          ["cases", "طلبات التأجير"],
          ["units", "الوحدات والتجهيز"],
          ["performance", "الأداء والتحسين"],
        ]
      : [
          ["entries", "الحركات والمراجعة"],
          ["dues", "المستحقات"],
          ["report", "تقرير المحاسب"],
        ];
  const caseItems =
    w?.cases.map((c) => ({
      id: c.id,
      name: `${c.customer_name} · ${labels[c.kind]} · ${c.id.slice(0, 8)}`,
    })) || [];
  const caseName = (id: string | null) =>
    w?.cases.find((c) => c.id === id)?.customer_name || "مصروف عام";
  return (
    <section
      className="ops-workspace portal-surface rounded-2xl p-4 sm:p-6"
      dir="rtl"
    >
      <header className="ops-header">
        <div>
          <p className="ops-eyebrow">كحل · مساحة العمل</p>
          <h1>
            {mode === "leasing"
              ? "التأجير ومتابعة العملاء"
              : "المالية الداخلية"}
          </h1>
          <p>
            {mode === "leasing"
              ? "كل متابعة لها خطوة قادمة، وكل تأجير له سجل واضح."
              : "متابعة الأموال والمستندات وإعداد تقارير المحاسب."}
          </p>
        </div>
        <div className="ops-actions">
          <button
            className="portal-button"
            disabled={loading || busy}
            onClick={() => void load()}
          >
            تحديث
          </button>
          <Link
            className="ops-link"
            href={mode === "leasing" ? "/financials/internal" : "/leasing"}
          >
            {mode === "leasing" ? "المالية الداخلية" : "التأجير"}
          </Link>
        </div>
      </header>
      <nav className="ops-tabs" aria-label="أقسام مساحة العمل">
        {tabs.map(([id, title]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="ops-alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="ops-success">
          {notice}
        </p>
      )}
      {loading && !w ? (
        <p role="status">جارٍ تحميل مساحة العمل…</p>
      ) : !w ? (
        <div className="ops-empty">
          لم تُحمّل البيانات. لا تُعرض أرقام صفرية مكان البيانات غير المتاحة.
          <button className="ops-link" onClick={() => void load()}>
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          <div className="ops-period">
            <label>
              من
              <input
                className={field}
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setExported(undefined);
                }}
              />
            </label>
            <label>
              إلى
              <input
                className={field}
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setExported(undefined);
                }}
              />
            </label>
            <span>المؤشرات حسب الفترة · المواعيد بتوقيت الرياض</span>
          </div>
          <div className="ops-cards">
            {(mode === "leasing"
              ? [
                  ["طلبات الفترة", String(m!.cases)],
                  ["متابعات متأخرة الآن", String(m!.overdue.length)],
                  [
                    "الالتزام بالموعد",
                    m!.followupRate === null
                      ? "لا توجد عينة"
                      : `${m!.followupRate}%`,
                  ],
                  ["سرعة الرد عبر هاتف", "غير متاح"],
                ]
              : [
                  ["تحصيل إيجار معتمد", money(m!.received)],
                  ["مصروفات معتمدة", money(m!.expenses)],
                  ["تأمين مستلم خلال الفترة", money(m!.depositsIn)],
                  ["عمليات بانتظار المراجعة", String(m!.pending)],
                ]
            ).map(([title, value]) => (
              <article key={title} className="portal-card">
                <p>{title}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          {mode === "finance" && (
            <p className="ops-help">
              الأرقام حركة مالية مسجلة، وليست صافي ربح. جهة التحصيل قد تكون كحل
              أو المالك أو المنصة.{" "}
              {isExecutive
                ? "اعتماد الحركة يؤكد مراجعتها ولا ينفّذ تحويلاً بنكياً."
                : "تظهر فقط الحركات التي سجلتها؛ ليست إجمالي الشركة."}
            </p>
          )}
          {tab === "today" && (
            <>
              <div className="ops-section-head">
                <h2>المتابعات المطلوبة</h2>
                <button
                  className="portal-button"
                  onClick={() => open("followup")}
                >
                  إضافة متابعة
                </button>
              </div>
              <div className="ops-list">
                {w.followups
                  .filter((f) => !f.completed_at)
                  .map((f) => (
                    <article className="portal-card ops-row" key={f.id}>
                      <div>
                        <h3>{f.title}</h3>
                        <p>
                          {caseName(f.case_id)} · {dateTime(f.due_at)}
                        </p>
                        {new Date(f.due_at) < new Date() && (
                          <span className="ops-badge">متأخرة</span>
                        )}
                      </div>
                      <button
                        className="ops-link"
                        onClick={() => setForm({ type: "done", id: f.id })}
                      >
                        تسجيل النتيجة
                      </button>
                    </article>
                  ))}
                {!w.followups.some((f) => !f.completed_at) && (
                  <p className="ops-empty">
                    لا توجد متابعات مفتوحة. أضف طلباً أو متابعة لبدء يومك.
                  </p>
                )}
              </div>
              <div className="ops-section-head">
                <h2>الوصول والمغادرة اليوم</h2>
              </div>
              {w.cases
                .filter(
                  (c) =>
                    c.stage === "CONFIRMED" &&
                    (c.start_date === riyadhDate() ||
                      c.end_date === riyadhDate()),
                )
                .map((c) => (
                  <p className="portal-card" key={c.id}>
                    {c.customer_name} ·{" "}
                    {c.start_date === riyadhDate() ? "وصول" : "مغادرة"} ·{" "}
                    {labels[c.kind]}
                  </p>
                ))}
              <section aria-label="تنبيهات انتهاء المدة">
                <h2>انتهاء المدة والتجديد</h2>
                <p className="ops-help">
                  اليومي خلال 3 أيام، والشهري خلال 7 أيام، والسنوي خلال 30 يوماً،
                  مع الحالات التي انتهت مدتها. التنبيه لا يجدد الحجز تلقائياً؛
                  سجّل نتيجة التواصل وراجع الإدارة.
                </p>
                {termAlerts(w.cases).map(({ item, days, action }) => (
                  <article className="portal-card ops-row" key={item.id}>
                    <div>
                      <h3>{item.customer_name} · {labels[item.kind]}</h3>
                      <p>{item.end_date} · {days < 0
                        ? `انتهت المدة منذ ${-days} يوم`
                        : days === 0 ? "تنتهي المدة اليوم" : `متبقي ${days} يوم`}</p>
                      <p>{action} · {item.assignee_name}</p>
                      {w.followups.some(f => f.case_id === item.id && !f.completed_at) && (
                        <span className="ops-badge">توجد متابعة مفتوحة لهذا الطلب</span>
                      )}
                    </div>
                    <button className="ops-link" onClick={() => open("followup", item)}>
                      إضافة متابعة للمدة
                    </button>
                  </article>
                ))}
                {!termAlerts(w.cases).length && (
                  <p className="ops-empty">لا توجد مدد تحتاج تنبيهاً حالياً.</p>
                )}
              </section>
              <p className="ops-help">
                المكالمات والرسائل متاحة في{" "}
                <Link href="/crm?tab=activities" className="ops-link">
                  سجل علاقات العملاء
                </Link>
                . قياس سرعة الرد يحتاج بيانات إضافية من هاتف.
              </p>
            </>
          )}
          {tab === "cases" && (
            <>
              <div className="ops-section-head">
                <h2>طلبات التأجير</h2>
                <button className="portal-button" onClick={() => open("case")}>
                  طلب تأجير جديد
                </button>
              </div>
              <input
                className={field}
                aria-label="بحث الطلبات"
                placeholder="ابحث باسم العميل أو رقم الهاتف"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="ops-list">
                {w.cases
                  .filter((c) => (c.customer_name + c.phone).includes(search))
                  .map((c) => (
                    <article className="portal-card ops-row" key={c.id}>
                      <div>
                        <h3>
                          {c.customer_name}{" "}
                          <span className="ops-badge">{labels[c.stage]}</span>
                        </h3>
                        <p>
                          {labels[c.kind]} · {c.source} · {c.assignee_name}
                        </p>
                        <p>{c.need}</p>
                        {c.start_date && (
                          <p>
                            {c.start_date} ← {c.end_date} ·{" "}
                            {c.amount ? money(Number(c.amount)) : ""}
                          </p>
                        )}
                      </div>
                      {!["LOST", "CANCELLED"].includes(c.stage) && (
                        <button
                          className="ops-link"
                          onClick={() => open("update", c)}
                        >
                          فتح الطلب
                        </button>
                      )}
                    </article>
                  ))}
                {!w.cases.length && (
                  <p className="ops-empty">
                    لا توجد طلبات بعد. اختر عميلاً موجوداً لتجنب تكرار سجله.
                  </p>
                )}
              </div>
            </>
          )}
          {tab === "units" && (
            <>
              <div className="ops-section-head">
                <h2>الوحدات وجاهزيتها</h2>
                {isExecutive && (
                  <button
                    className="portal-button"
                    onClick={() => open("unit")}
                  >
                    إضافة وحدة
                  </button>
                )}
              </div>
              <p className="ops-help">
                جاهزية الوحدة يعتمدها مدير التشغيل من حساب الإدارة. سجّل كل وحدة
                مرة واحدة تحت عقارها الصحيح.
              </p>
              <div className="ops-list">
                {w.units.map((u) => (
                  <article className="portal-card ops-row" key={u.id}>
                    <div>
                      <h3>
                        {u.property_name} · {u.code}
                      </h3>
                      <span className="ops-badge">{labels[u.readiness]}</span>
                      <p>{u.note}</p>
                    </div>
                    {isExecutive && (
                      <button
                        className="ops-link"
                        onClick={() => open("unit", u)}
                      >
                        تحديث الجاهزية
                      </button>
                    )}
                  </article>
                ))}
                {!w.units.length && (
                  <p className="ops-empty">لم تُسجل وحدات التأجير بعد.</p>
                )}
              </div>
            </>
          )}
          {tab === "performance" && (
            <>
              {isExecutive && (
                <label>
                  عرض أداء الموظف
                  <select
                    className={field}
                    value={employee}
                    onChange={(e) => setEmployee(e.target.value)}
                  >
                    <option value="">جميع الموظفين</option>
                    {w.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <h2>التحويل حسب نوع التأجير</h2>
              <p className="ops-help">
                طلبات أُنشئت خلال الفترة وتجاوزت مرحلة «جديد»؛ النسبة حسب حالتها
                الحالية. هذه فترة قياس أولية دون أهداف ثابتة.
              </p>
              <div className="ops-cards">
                {m!.conversion.map((c) => (
                  <article className="portal-card" key={c.kind}>
                    <h3>{labels[c.kind]}</h3>
                    <strong>
                      {c.total
                        ? `${Math.round((c.won / c.total) * 100)}%`
                        : "لا توجد عينة"}
                    </strong>
                    <p>
                      {c.won} مؤكدة من {c.total} مؤهلة
                    </p>
                  </article>
                ))}
              </div>
              <p>
                متابعات مستحقة: {m!.followupsDue} · في الموعد: {m!.onTime} ·
                عوائق مسجلة: {m!.blocked}
              </p>
              <h2>خطوات التحسين</h2>
              <ul>
                {recommendations(performance || w, from, to).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="ops-help">
                اقتراحات من السجلات الحالية. سرعة الرد والمكالمات الفائتة ليست
                جزءاً من التقييم حتى تتوفر بياناتها.
              </p>
            </>
          )}
          {tab === "entries" && (
            <>
              <div className="ops-section-head">
                <h2>الحركات المالية</h2>
                <button className="portal-button" onClick={() => open("entry")}>
                  {isExecutive ? "تسجيل حركة" : "تسجيل إثبات تحصيل"}
                </button>
              </div>
              <div className="ops-list">
                {w.entries.map((e) => (
                  <article className="portal-card ops-row" key={e.id}>
                    <div>
                      <h3>
                        {labels[e.kind]} · {money(Number(e.amount))}{" "}
                        <span className="ops-badge">{labels[e.status]}</span>
                      </h3>
                      <p>
                        {caseName(e.case_id)} · {e.date} · الجهة:{" "}
                        {labels[e.holder]}
                      </p>
                      <p>
                        المرجع: {e.reference} · {e.category}
                      </p>
                      <p>{e.note}</p>
                      {e.decision_note && <p>المراجعة: {e.decision_note}</p>}
                    </div>
                    <DocumentsPanel
                      entryId={e.id}
                      documents={(w.documents || []).filter(
                        (d) => d.entry_id === e.id,
                      )}
                      editable={e.status === "PENDING"}
                      onSaved={load}
                    />
                    {isExecutive && e.status === "PENDING" && (
                      <button
                        className="ops-link"
                        onClick={() => setForm({ type: "decision", id: e.id })}
                      >
                        مراجعة
                      </button>
                    )}
                  </article>
                ))}
                {!w.entries.length && (
                  <p className="ops-empty">لا توجد حركات مسجلة.</p>
                )}
              </div>
              <Link className="ops-link" href="/portal-management?tab=broker">
                العمولات وطلبات الصرف الحالية
              </Link>
            </>
          )}
          {tab === "dues" && (
            <>
              {!isExecutive ? (
                <p>
                  المستحقات الإجمالية متاحة للإدارة؛ يمكنك تسجيل إثبات التحصيل
                  من تبويب الحركات.
                </p>
              ) : (
                <>
                  <h2>جداول الدفعات</h2>
                  <div className="ops-list">
                    {w.cases
                      .filter((c) => c.stage === "CONFIRMED")
                      .map((c) => (
                        <InstallmentEditor
                          key={c.id + ":" + c.version}
                          item={c}
                          dues={w.dues.filter((d) => d.case_id === c.id)}
                          busy={busy}
                          locked={w.entries.some(
                            (e) =>
                              e.case_id === c.id &&
                              ["RECEIPT", "REFUND"].includes(e.kind),
                          )}
                          onSave={save}
                        />
                      ))}
                  </div>
                  <h2>المستحقات حتى نهاية الفترة</h2>
                  <div className="ops-list">
                    {m!.outstanding
                      .filter((d) => d.due_date <= to)
                      .map((d) => (
                        <article
                          className="portal-card ops-row"
                          key={d.id || d.case_id}
                        >
                          <div>
                            <h3>
                              {caseName(d.case_id)} · الدفعة {d.sequence || 1}
                            </h3>
                            <p>
                              الاستحقاق: {d.due_date} · الإجمالي:{" "}
                              {money(Number(d.amount))}
                            </p>
                          </div>
                          <strong>المتبقي: {money(d.balance)}</strong>
                        </article>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
          {tab === "report" && (
            <>
              {isExecutive ? (
                <>
                  <div className="ops-section-head">
                    <h2>تسليم المحاسب</h2>
                    <button
                      className="portal-button"
                      disabled={busy || !from || !to || from > to}
                      onClick={() => void exportReport()}
                    >
                      حفظ نسخة وتصدير Excel
                    </button>
                  </div>
                  <p>
                    يتضمن التقرير الحركات والدفعات ومراجع المستندات. احفظ نسخة
                    ثم نزّل حزمة المحاسب التي تضم Excel والمرفقات الخاصة كما
                    كانت عند حفظها.
                  </p>
                  {!!w.exports?.length && (
                    <div className="ops-list">
                      <h3>آخر 50 نسخة محفوظة</h3>
                      {w.exports.map((s) => (
                        <button
                          className="ops-link"
                          key={s.id}
                          disabled={busy}
                          onClick={() => void readExport(s.id)}
                        >
                          {s.period_from} — {s.period_to} ·{" "}
                          {dateTime(s.created_at)}
                        </button>
                      ))}
                    </div>
                  )}
                  {exported && (
                    <>
                      <p>
                        رقم النسخة: <bdi>{exported.id}</bdi>
                      </p>
                      <button
                        className="ops-link"
                        onClick={() => void downloadWorkbook(exported)}
                      >
                        تنزيل نفس النسخة
                      </button>
                      <button
                        className="portal-button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            await saveDownload(
                              "/api/operations/export/documents?id=" +
                                exported.id,
                              `kohl-accountant-${exported.id}.zip`,
                            );
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "تعذر تنزيل الحزمة",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        تنزيل حزمة المحاسب مع المرفقات
                      </button>
                      <button
                        className="ops-link"
                        onClick={() => window.print()}
                      >
                        طباعة ملخص النسخة / PDF
                      </button>
                      <div className="ops-print">
                        <h2>كحل · ملخص الحركة المالية</h2>
                        <p>
                          {exported.from} — {exported.to}
                        </p>
                        <p>نسخة {exported.id}</p>
                        <p>
                          تحصيل معتمد:{" "}
                          {money(
                            metrics(
                              exported.workspace,
                              exported.from,
                              exported.to,
                            ).received,
                          )}
                        </p>
                        <p>
                          مصروفات معتمدة:{" "}
                          {money(
                            metrics(
                              exported.workspace,
                              exported.from,
                              exported.to,
                            ).expenses,
                          )}
                        </p>
                        <p>
                          المبالغ تشمل جهات تحصيل مختلفة؛ ليست قائمة أرباح أو
                          إقراراً ضريبياً.
                        </p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p>تصدير تقارير الشركة متاح للإدارة المخولة فقط.</p>
              )}
            </>
          )}
          {form && (
            <div
              className="ops-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ops-form-title"
            >
              <div className="portal-surface ops-dialog">
                <div className="ops-section-head">
                  <h2 id="ops-form-title">
                    {
                      (
                        {
                          case: "طلب تأجير جديد",
                          update: "تحديث الطلب",
                          followup: "متابعة جديدة",
                          done: "نتيجة المتابعة",
                          unit: "جاهزية الوحدة",
                          entry: "حركة مالية",
                          decision: "مراجعة الحركة",
                        } as Record<string, string>
                      )[form.type]
                    }
                  </h2>
                  <button
                    disabled={busy}
                    onClick={() => setForm(undefined)}
                    aria-label="إغلاق النموذج"
                  >
                    ✕
                  </button>
                </div>
                {error && (
                  <p role="alert" className="ops-alert">
                    {error}
                  </p>
                )}
                <form key={form.id} onSubmit={submit} className="ops-form">
                  {form.type === "case" && (
                    <>
                      <Options
                        name="lead_id"
                        label="العميل الموجود"
                        items={w.leads.map((l) => ({
                          id: l.id,
                          name: `${l.name} · ${l.phone}`,
                        }))}
                      />
                      <Link href="/crm" className="ops-link">
                        إضافة أو مراجعة العميل في CRM
                      </Link>
                      {isExecutive && (
                        <Options
                          name="assignee_id"
                          label="الموظف المسؤول"
                          items={w.staff}
                          value={currentUser.id}
                        />
                      )}
                      <Options
                        name="kind"
                        label="نوع التأجير"
                        items={options(kinds)}
                      />
                      <Input name="source" label="مصدر الطلب" value="هاتف" />
                      <Input name="need" label="الاحتياج والميزانية" />
                      <Input name="next_action" label="الخطوة القادمة" />
                      <Input
                        name="due_at"
                        label="موعد المتابعة بتوقيت الرياض"
                        type="datetime-local"
                      />
                    </>
                  )}
                  {form.type === "update" &&
                    (() => {
                      const c = form.item as Case;
                      return (
                        <>
                          <Options
                            name="stage"
                            label="المرحلة"
                            items={options(
                              c.stage === "CONFIRMED"
                                ? ["CANCELLED"]
                                : stages.filter(
                                    (s) =>
                                      isExecutive ||
                                      !["CONFIRMED", "CANCELLED"].includes(s),
                                  ),
                            )}
                            value={
                              c.stage === "CONFIRMED" ? "CANCELLED" : c.stage
                            }
                          />
                          <Options
                            name="unit_id"
                            label="الوحدة"
                            items={w.units.map((u) => ({
                              id: u.id,
                              name: `${u.property_name} · ${u.code} · ${labels[u.readiness]}`,
                            }))}
                            value={c.unit_id || ""}
                            optional
                          />
                          <Input
                            name="start_date"
                            label="بداية التأجير"
                            type="date"
                            value={c.start_date || ""}
                            required={false}
                          />
                          <Input
                            name="end_date"
                            label="نهاية التأجير / المغادرة (غير مشمولة)"
                            type="date"
                            value={c.end_date || ""}
                            required={false}
                          />
                          <Input
                            name="amount"
                            label="إجمالي قيمة المدة بالريال"
                            type="number"
                            value={c.amount || ""}
                            required={false}
                          />
                          <Options
                            name="beneficiary"
                            label="صاحب استحقاق الإيجار"
                            items={options(["COMPANY", "OWNER"])}
                            value={c.beneficiary || ""}
                            optional
                          />
                          {isExecutive ? (
                            <Options
                              name="contract_id"
                              label="العقد الموجود إن وجد"
                              items={w.contracts.map((c) => ({
                                id: c.id,
                                name: c.contract_number,
                              }))}
                              value={c.contract_id || ""}
                              optional
                            />
                          ) : (
                            <input
                              type="hidden"
                              name="contract_id"
                              value={c.contract_id || ""}
                            />
                          )}
                          <Input name="note" label="سبب التحديث / الاعتماد" />
                          <p className="ops-help">
                            التأكيد للإدارة فقط ويُنشئ مستحقاً واحداً بقيمة
                            المدة. لا يمثل إنشاء عقد قانوني أو ربطاً بإيجار.
                            إلغاء طلب له حركات مالية يحتاج تسوية منفصلة.
                          </p>
                        </>
                      );
                    })()}
                  {form.type === "followup" && (
                    <>
                      <Options
                        name="case_id"
                        label="طلب التأجير"
                        items={caseItems}
                        value={form.item?.id}
                      />
                      <Input name="title" label="الإجراء المطلوب"
                        value={form.item ? ((form.item as Case).kind === "DAILY"
                          ? "تنسيق المغادرة أو التمديد" : "متابعة التجديد أو الإخلاء") : ""}
                      />
                      <Input
                        name="due_at"
                        label="الموعد بتوقيت الرياض"
                        type="datetime-local"
                      />
                    </>
                  )}
                  {form.type === "done" && (
                    <>
                      <input type="hidden" name="id" value={form.id} />
                      <Input name="note" label="نتيجة المتابعة" />
                      <Options
                        name="blocked_by"
                        label="هل واجهت عائقاً؟"
                        items={[
                          { id: "NONE", name: "لا يوجد" },
                          { id: "MANAGEMENT", name: "انتظار الإدارة" },
                          { id: "READINESS", name: "جاهزية الوحدة" },
                          { id: "CUSTOMER", name: "انتظار العميل" },
                        ]}
                        value="NONE"
                      />
                    </>
                  )}
                  {form.type === "unit" && (
                    <>
                      <Options
                        name="property_id"
                        label="العقار"
                        items={w.properties.map((p) => ({
                          id: p.id,
                          name: p.property_name,
                        }))}
                        value={(form.item as Unit)?.property_id}
                      />
                      <Input
                        name="code"
                        label="رقم أو اسم الوحدة الثابت"
                        value={(form.item as Unit)?.code}
                      />
                      <Options
                        name="readiness"
                        label="الجاهزية"
                        items={options([
                          "READY",
                          "CLEANING",
                          "MAINTENANCE",
                          "UNAVAILABLE",
                        ])}
                        value={(form.item as Unit)?.readiness}
                      />
                      <Input
                        name="note"
                        label="ملاحظة التشغيل"
                        value={(form.item as Unit)?.note}
                      />
                    </>
                  )}
                  {form.type === "entry" && (
                    <>
                      <Options
                        name="case_id"
                        label="طلب التأجير المؤكد (اختياري للمصروف العام)"
                        items={caseItems.filter(
                          (i) =>
                            w.cases.find((c) => c.id === i.id)?.stage ===
                            "CONFIRMED",
                        )}
                        optional={isExecutive}
                        onChange={setEntryCase}
                      />
                      <Options
                        name="kind"
                        label="نوع الحركة"
                        onChange={setEntryKind}
                        items={options(
                          isExecutive ? entryKinds : ["RECEIPT", "DEPOSIT_IN"],
                        )}
                      />
                      {["RECEIPT", "REFUND"].includes(entryKind) && (
                        <Options
                          key={entryCase}
                          name="installment_id"
                          label="الدفعة المرتبطة"
                          items={w.dues
                            .filter((d) => d.case_id === entryCase && !d.voided)
                            .map((d) => ({
                              id: d.id || "",
                              name: `دفعة ${d.sequence || 1} · ${d.due_date} · ${money(Number(d.amount))}`,
                            }))}
                          value={
                            w.dues.filter((d) => d.case_id === entryCase)
                              .length === 1
                              ? w.dues.find((d) => d.case_id === entryCase)?.id
                              : undefined
                          }
                        />
                      )}
                      <Input
                        name="amount"
                        label="المبلغ بالريال"
                        type="number"
                      />
                      <Input
                        name="date"
                        label="تاريخ الحركة"
                        type="date"
                        value={riyadhDate()}
                      />
                      <Options
                        name="holder"
                        label="الجهة المستلمة / الدافعة"
                        items={options(["COMPANY", "OWNER", "PLATFORM"])}
                      />
                      <Input
                        name="reference"
                        label="مرجع التحويل أو المستند (فريد لدى الجهة)"
                      />
                      <Input name="category" label="التصنيف" />
                      <Input
                        name="note"
                        label="تفاصيل وموقع المستند"
                        required={false}
                      />
                      <p className="ops-help">
                        تُحفظ الحركة بانتظار المراجعة. لا تدخل كلمات مرور أو
                        بيانات بطاقات في الملاحظات.
                      </p>
                    </>
                  )}
                  {form.type === "decision" && (
                    <>
                      <input type="hidden" name="id" value={form.id} />
                      <Options
                        name="status"
                        label="قرار المراجعة"
                        items={options(["APPROVED", "REJECTED"])}
                      />
                      <Input name="note" label="نتيجة المطابقة أو سبب الرفض" />
                      <p className="ops-help">
                        اعتمد فقط بعد مراجعة البنك أو كشف الجهة والمستند. القرار
                        نهائي ومسجل في التاريخ.
                      </p>
                    </>
                  )}
                  <div className="ops-actions">
                    <button
                      className="portal-button"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? "جارٍ الحفظ…" : "حفظ"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setForm(undefined)}
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
