import type { Workspace } from "./model";
import { labels, metrics, riyadhDate } from "./model";
export type ExportSnapshot = {
  id: string;
  from: string;
  to: string;
  created_at: string;
  workspace: Workspace;
};
async function createWorkbook(s: ExportSnapshot) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
  const inPeriod = (date: string) => date >= s.from && date <= s.to;
  const m = metrics(s.workspace, s.from, s.to, new Date(s.created_at));
  add("التقرير", [
    {
      "رقم النسخة": s.id,
      من: s.from,
      إلى: s.to,
      "وقت الحفظ": s.created_at,
      "تحصيل معتمد": m.received,
      "مصروفات معتمدة": m.expenses,
      "تأمين مستلم": m.depositsIn,
      "تأمين مردود": m.depositsOut,
      "صرف للمالك": m.ownerPaid,
      "رد تحصيل": m.refunds,
      ملاحظة:
        "حركة تشغيلية وليست قائمة أرباح أو إقراراً ضريبياً؛ جهة التحصيل منفصلة عن صاحب الاستحقاق.",
    },
  ]);
  add(
    "الحركات",
    s.workspace.entries
      .filter((e) => inPeriod(e.date))
      .map((e) => ({
        "رقم العملية": e.id,
        "معرف الدفعة": e.installment_id || "",
        "طلب التأجير": e.case_id || "",
        النوع: labels[e.kind],
        المبلغ: e.amount,
        التاريخ: e.date,
        "جهة التحصيل أو الدفع": labels[e.holder],
        الحالة: labels[e.status],
        التصنيف: e.category,
        "مرجع المستند": e.reference,
        ملاحظات: e.note,
        "قرار المراجعة": e.decision_note,
        "مراجعة المدير": e.manager_review_note || "",
        "تاريخ الرفع للاعتماد النهائي": e.manager_reviewed_at || "",
      })),
  );
  add(
    "المستحقات",
    m.outstanding
      .filter((d) => d.due_date <= s.to)
      .map((d) => ({
        "طلب التأجير": d.case_id,
        "رقم الدفعة": d.sequence || 1,
        المستحق: d.amount,
        "تاريخ الاستحقاق": d.due_date,
        "المتبقي في نهاية الفترة": d.balance,
      })),
  );
  add(
    "التأجير",
    s.workspace.cases
      .filter((c) => inPeriod(riyadhDate(new Date(c.created_at))))
      .map((c) => ({
        "رقم الطلب": c.id,
        العميل: c.customer_name,
        المسؤول: c.assignee_name,
        النوع: labels[c.kind],
        الحالة: labels[c.stage],
        "بداية الإقامة": c.start_date || "",
        "المغادرة غير مشمولة": c.end_date || "",
        القيمة: c.amount,
        "صاحب الاستحقاق": labels[c.beneficiary || ""] || "غير محدد",
        "العقد المرتبط": c.contract_id || "",
      })),
  );
  add(
    "التدقيق",
    s.workspace.history
      .filter((h) => inPeriod(riyadhDate(new Date(h.created_at))))
      .map((h) => ({
        السجل: h.entity_id,
        الإجراء: h.action,
        المسؤول: h.actor_name,
        التاريخ: h.created_at,
        الملاحظة: h.note,
      })),
  );
  add(
    "المستندات",
    (s.workspace.documents || [])
      .filter((d) =>
        s.workspace.entries.some(
          (e) => e.id === d.entry_id && inPeriod(e.date),
        ),
      )
      .map((d) => ({
        "رقم المستند": d.id,
        الحركة: d.entry_id,
        الاسم: d.filename,
        "حجم الملف": d.size,
        SHA256: d.sha256,
      })),
  );
  return { XLSX, book };
}
export async function workbookBytes(s: ExportSnapshot): Promise<Uint8Array> {
  const { XLSX, book } = await createWorkbook(s);
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));
}
export async function downloadWorkbook(s: ExportSnapshot) {
  const { XLSX, book } = await createWorkbook(s);
  XLSX.writeFile(
    book,
    `kohl-operations-${s.from}-${s.to}-${s.id.slice(0, 8)}.xlsx`,
  );
}
