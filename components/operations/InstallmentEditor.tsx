"use client";
import { useState } from "react";
import type { Case, Workspace } from "@/lib/operations/model";
export default function InstallmentEditor({
  item,
  dues,
  locked,
  busy,
  onSave,
}: {
  item: Case;
  dues: Workspace["dues"];
  locked: boolean;
  busy: boolean;
  onSave: (input: unknown) => Promise<void>;
}) {
  const [parts, setParts] = useState(
      dues.map((d) => ({ amount: String(d.amount), due_date: d.due_date })),
    ),
    [note, setNote] = useState(""),
    [id] = useState(() => crypto.randomUUID());
  const cents = parts.reduce(
      (n, p) => n + Math.round(Number(p.amount) * 100),
      0,
    ),
    expected = Math.round(Number(item.amount) * 100);
  return (
    <details className="portal-card ops-installments">
      <summary>
        {item.customer_name} · جدولة{" "}
        {Number(item.amount).toLocaleString("ar-SA")} ريال
      </summary>
      {locked ? (
        <p className="ops-help">
          توجد حركة تحصيل أو رد مرتبطة؛ الجدول مقفل لحفظ تاريخ العمليات.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave({
              operation: "INSTALLMENTS_SAVE",
              id,
              case_id: item.id,
              version: item.version,
              note,
              parts: parts.map((p) => ({
                amount: Number(p.amount),
                due_date: p.due_date,
              })),
            });
          }}
        >
          <p className="ops-help">
            قسّم قيمة المدة إلى دفعات. يجب أن يساوي مجموعها الإجمالي، ولا يعد
            الجدول تحصيلاً.
          </p>
          {parts.map((p, index) => (
            <div className="ops-actions" key={index}>
              <label>
                تاريخ الدفعة {index + 1}
                <input
                  className="portal-input"
                  type="date"
                  required
                  value={p.due_date}
                  onChange={(e) =>
                    setParts(
                      parts.map((v, i) =>
                        i === index ? { ...v, due_date: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                مبلغ الدفعة {index + 1}
                <input
                  className="portal-input"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={p.amount}
                  onChange={(e) =>
                    setParts(
                      parts.map((v, i) =>
                        i === index ? { ...v, amount: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                disabled={parts.length === 1 || busy}
                onClick={() => setParts(parts.filter((_, i) => i !== index))}
              >
                حذف الدفعة {index + 1}
              </button>
            </div>
          ))}
          <button
            className="ops-link"
            type="button"
            disabled={parts.length >= 120 || busy}
            onClick={() =>
              setParts([
                ...parts,
                { amount: "", due_date: parts.at(-1)?.due_date || "" },
              ])
            }
          >
            إضافة دفعة
          </button>
          <p role="status">
            المجموع: {(cents / 100).toLocaleString("ar-SA")} · المطلوب:{" "}
            {Number(item.amount).toLocaleString("ar-SA")}
          </p>
          <label>
            سبب اعتماد الجدول
            <input
              className="portal-input"
              required
              maxLength={160}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            className="portal-button"
            disabled={busy || cents !== expected || !parts.length}
          >
            اعتماد جدول الدفعات
          </button>
        </form>
      )}
    </details>
  );
}
