"use client";
import { useRef, useState } from "react";
import type { FinanceDocument } from "@/lib/operations/model";
import { operationsFetch, saveDownload } from "@/lib/operations/client";
export default function DocumentsPanel({
  entryId,
  documents,
  editable,
  onSaved,
}: {
  entryId: string;
  documents: FinanceDocument[];
  editable: boolean;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("الحد الأعلى 5 ميجابايت");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("entry_id", entryId);
      body.set("file", file);
      await operationsFetch("/api/operations/documents", {
        method: "POST",
        body,
      });
      if (input.current) input.current.value = "";
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الرفع");
    } finally {
      setBusy(false);
    }
  }
  async function download(doc: FinanceDocument) {
    setBusy(true);
    setError("");
    try {
      await saveDownload(
        "/api/operations/documents?id=" + doc.id,
        doc.filename,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر التنزيل");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="ops-documents">
      <summary>المستندات الخاصة ({documents.length})</summary>
      {error && (
        <p role="alert" className="ops-alert">
          {error}
        </p>
      )}
      {documents.map((d) => (
        <div key={d.id}>
          <button
            className="ops-link"
            disabled={busy}
            onClick={() => void download(d)}
          >
            {d.filename}
          </button>
          <small> · {Math.ceil(d.size / 1024)} كيلوبايت</small>
        </div>
      ))}
      {editable && (
        <div className="ops-actions">
          <label>
            مستند الحركة
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={busy}
            />
          </label>
          <button
            className="portal-button"
            disabled={busy || documents.length >= 10}
            onClick={() => void upload()}
          >
            {busy ? "جارٍ المعالجة…" : "رفع المستند"}
          </button>
          <small>
            حتى 10 مستندات، 5 ميجابايت لكل ملف. تُجمّد المرفقات بعد المراجعة.
          </small>
        </div>
      )}
      {!documents.length && !editable && (
        <p className="ops-help">
          لم يُرفق مستند قبل اعتماد الحركة؛ راجع المرجع المسجل.
        </p>
      )}
    </details>
  );
}
