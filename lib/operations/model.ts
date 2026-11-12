import { z } from "zod";
import { reportDate } from "@/lib/kr/schema";
const id = z.string().uuid(),
  text = z.string().trim().max(1000),
  short = text.min(1).max(160);
const amount = z
  .number()
  .finite()
  .positive()
  .max(999999999)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    "هللات صحيحة",
  );
export const kinds = ["DAILY", "MONTHLY", "ANNUAL"] as const;
export const stages = [
  "NEW",
  "QUALIFIED",
  "OFFERED",
  "VIEWING",
  "CONFIRMED",
  "LOST",
  "CANCELLED",
] as const;
export const entryKinds = [
  "RECEIPT",
  "EXPENSE",
  "DEPOSIT_IN",
  "DEPOSIT_OUT",
  "OWNER_PAYMENT",
  "REFUND",
] as const;
export const labels: Record<string, string> = {
  DAILY: "يومي",
  MONTHLY: "شهري",
  ANNUAL: "سنوي",
  NEW: "جديد",
  QUALIFIED: "احتياج محدد",
  OFFERED: "خيارات مقدمة",
  VIEWING: "معاينة",
  CONFIRMED: "مؤكد",
  LOST: "لم يتم",
  CANCELLED: "ملغى",
  READY: "جاهزة",
  CLEANING: "تحتاج تجهيزاً",
  MAINTENANCE: "صيانة",
  UNAVAILABLE: "غير متاحة",
  PENDING: "بانتظار المراجعة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  RECEIPT: "تحصيل إيجار",
  EXPENSE: "مصروف",
  DEPOSIT_IN: "استلام تأمين",
  DEPOSIT_OUT: "رد تأمين",
  OWNER_PAYMENT: "صرف للمالك",
  REFUND: "رد تحصيل",
  COMPANY: "كحل",
  OWNER: "المالك",
  PLATFORM: "المنصة",
  OPEN: "مفتوحة",
  DONE: "منجزة",
  CANCELLED_TASK: "ملغاة",
};
export const operationAction = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("INSTALLMENTS_SAVE"),
      id,
      case_id: id,
      version: z.number().int().positive(),
      note: short,
      parts: z
        .array(z.object({ amount, due_date: reportDate }).strict())
        .min(1)
        .max(120),
    })
    .strict(),
  z
    .object({
      operation: z.literal("CASE_CREATE"),
      id,
      lead_id: id,
      assignee_id: id.optional(),
      kind: z.enum(kinds),
      source: short,
      need: short,
      next_action: short,
      due_at: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      operation: z.literal("CASE_UPDATE"),
      id,
      version: z.number().int().positive(),
      stage: z.enum(stages),
      note: short,
      unit_id: id.nullable(),
      start_date: reportDate.nullable(),
      end_date: reportDate.nullable(),
      amount: amount.nullable(),
      beneficiary: z.enum(["COMPANY", "OWNER"]).nullable(),
      contract_id: id.nullable(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("FOLLOWUP_ADD"),
      id,
      case_id: id,
      title: short,
      due_at: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      operation: z.literal("FOLLOWUP_DONE"),
      id,
      note: short,
      blocked_by: z.enum(["NONE", "MANAGEMENT", "READINESS", "CUSTOMER"]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("UNIT_SAVE"),
      id,
      property_id: id,
      code: short,
      readiness: z.enum(["READY", "CLEANING", "MAINTENANCE", "UNAVAILABLE"]),
      note: short,
    })
    .strict(),
  z
    .object({
      operation: z.literal("ENTRY_CREATE"),
      id,
      installment_id: id.nullable().optional(),
      case_id: id.nullable(),
      kind: z.enum(entryKinds),
      amount,
      date: reportDate,
      holder: z.enum(["COMPANY", "OWNER", "PLATFORM"]),
      reference: short,
      category: short,
      note: text,
    })
    .strict(),
  z
    .object({
      operation: z.literal("ENTRY_DECIDE"),
      id,
      status: z.enum(["APPROVED", "REJECTED"]),
      note: short,
    })
    .strict(),
  z.object({ operation: z.literal("ASSISTANT_PLAN"), id }).strict(),
]);
export const periodSchema = z
  .object({ from: reportDate, to: reportDate })
  .strict()
  .refine(
    (v) =>
      v.from <= v.to && Date.parse(v.to) - Date.parse(v.from) <= 366 * 86400000,
    "اختر فترة لا تتجاوز سنة",
  );
export type Case = {
  id: string;
  lead_id: string;
  customer_name: string;
  phone: string;
  assignee_id: string;
  assignee_name: string;
  kind: (typeof kinds)[number];
  source: string;
  need: string;
  stage: (typeof stages)[number];
  unit_id: string | null;
  start_date: string | null;
  end_date: string | null;
  amount: number | null;
  beneficiary: string | null;
  contract_id: string | null;
  version: number;
  qualified_at: string | null;
  created_at: string;
  updated_at: string;
};
export type Followup = {
  origin?: "HUMAN" | "LEASING_ASSISTANT";
  id: string;
  case_id: string;
  title: string;
  due_at: string;
  completed_at: string | null;
  note: string;
  blocked_by: string;
  assignee_id: string;
};
export type Entry = {
  manager_reviewed_at?: string | null;
  manager_reviewed_by?: string | null;
  manager_review_note?: string;
  installment_id?: string | null;
  id: string;
  case_id: string | null;
  kind: (typeof entryKinds)[number];
  amount: number;
  date: string;
  holder: string;
  reference: string;
  category: string;
  note: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_by: string;
  created_at: string;
  decision_note: string;
  decided_at: string | null;
};
export type Unit = {
  id: string;
  property_id: string;
  property_name: string;
  code: string;
  readiness: string;
  note: string;
};
export type FinanceDocument = {
  id: string;
  entry_id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  created_at: string;
};
export type Workflow = {
  manager_id: string; final_id: string; manager_name: string; final_name: string;
  assistant_available: boolean;
};
export type Workspace = {
  workflow?: Workflow;
  documents?: FinanceDocument[];
  exports?: {
    id: string;
    period_from: string;
    period_to: string;
    created_at: string;
  }[];
  role: string;
  cases: Case[];
  followups: Followup[];
  entries: Entry[];
  units: Unit[];
  dues: {
    id?: string;
    sequence?: number;
    case_id: string;
    amount: number;
    due_date: string;
    voided: boolean;
  }[];
  leads: { id: string; name: string; phone: string; source: string }[];
  properties: { id: string; property_name: string }[];
  staff: { id: string; name: string }[];
  contracts: { id: string; contract_number: string }[];
  history: {
    entity_id: string;
    action: string;
    note: string;
    created_at: string;
    actor_name: string;
  }[];
  captured_at: string;
};
export function riyadhDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function metrics(
  w: Workspace,
  from: string,
  to: string,
  now = new Date(),
) {
  const within = (date: string) => date >= from && date <= to;
  const cases = w.cases.filter((c) =>
    within(riyadhDate(new Date(c.created_at))),
  );
  const due = w.followups.filter(
    (f) => within(riyadhDate(new Date(f.due_at))) && new Date(f.due_at) <= now,
  );
  const accountable = due; // Self-reported blockers are visible, never an automatic KPI exemption.
  const onTime = accountable.filter(
    (f) => f.completed_at && new Date(f.completed_at) <= new Date(f.due_at),
  ).length;
  const approved = w.entries.filter(
    (e) => e.status === "APPROVED" && within(e.date),
  );
  const sum = (kind: string, holder?: string) =>
    approved
      .filter((e) => e.kind === kind && (!holder || e.holder === holder))
      .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0) / 100;
  const outstanding = w.dues
    .filter((d) => !d.voided)
    .map((d) => {
      const paid = w.entries
        .filter(
          (e) =>
            e.case_id === d.case_id &&
            (!d.id || e.installment_id === d.id) &&
            e.status === "APPROVED" &&
            e.kind === "RECEIPT" &&
            e.date <= to,
        )
        .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0);
      const refunds = w.entries
        .filter(
          (e) =>
            e.case_id === d.case_id &&
            (!d.id || e.installment_id === d.id) &&
            e.status === "APPROVED" &&
            e.kind === "REFUND" &&
            e.date <= to,
        )
        .reduce((n, e) => n + Math.round(Number(e.amount) * 100), 0);
      return {
        ...d,
        balance: (Math.round(Number(d.amount) * 100) - paid + refunds) / 100,
      };
    });
  return {
    cases: cases.length,
    followupsDue: accountable.length,
    onTime,
    blocked: due.filter((f) => f.blocked_by !== "NONE").length,
    followupRate: accountable.length
      ? Math.round((onTime / accountable.length) * 100)
      : null,
    overdue: w.followups.filter(
      (f) => !f.completed_at && new Date(f.due_at) < now,
    ),
    conversion: kinds.map((kind) => {
      const cohort = cases.filter((c) => c.kind === kind && !!c.qualified_at);
      return {
        kind,
        total: cohort.length,
        won: cohort.filter((c) => c.stage === "CONFIRMED").length,
      };
    }),
    received: sum("RECEIPT"),
    expenses: sum("EXPENSE"),
    depositsIn: sum("DEPOSIT_IN"),
    depositsOut: sum("DEPOSIT_OUT"),
    ownerPaid: sum("OWNER_PAYMENT"),
    refunds: sum("REFUND"),
    outstanding,
    pending: w.entries.filter((e) => e.status === "PENDING").length,
  };
}
export function recommendations(w: Workspace, from: string, to: string) {
  const m = metrics(w, from, to);
  return [
    m.overdue.length
      ? `${m.overdue.length} متابعات متأخرة؛ افتح قائمة المتابعات وحدد الخطوة القادمة.`
      : null,
    m.pending
      ? `${m.pending} عمليات مالية تنتظر المراجعة؛ لا تدخل ضمن التحصيل المعتمد.`
      : null,
    w.units.some((u) => u.readiness !== "READY")
      ? "راجع جاهزية الوحدات مع مدير التشغيل قبل التأكيد."
      : null,
  ].filter(Boolean) as string[];
}

// Calendar-day differences use Riyadh's date, not the browser's timezone.
// Daily stays need departure coordination; monthly/annual terms need renewal review.
export function termAlerts(cases: Case[], now = new Date()) {
  const today = Date.parse(riyadhDate(now) + "T00:00:00Z");
  const windows = { DAILY: 3, MONTHLY: 7, ANNUAL: 30 };
  return cases.flatMap((item) => {
    if (item.stage !== "CONFIRMED" || !item.end_date) return [];
    const end = Date.parse(item.end_date + "T00:00:00Z");
    if (!Number.isFinite(end)) return [];
    const days = Math.round((end - today) / 86400000);
    if (days > windows[item.kind]) return [];
    return [{ item, days, action: item.kind === "DAILY"
      ? "تنسيق المغادرة أو التمديد"
      : "متابعة التجديد أو الإخلاء" }];
  }).sort((a, b) => a.days - b.days || a.item.id.localeCompare(b.item.id));
}
