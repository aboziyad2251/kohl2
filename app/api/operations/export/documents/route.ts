import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { withAudit } from "@/lib/audit/server";
import {
  requireIdentity,
  adminClient,
  PortalError,
  apiError,
} from "@/lib/portal/server";
import type { ExportSnapshot } from "@/lib/operations/export";
import { workbookBytes } from "@/lib/operations/export";
import { storedZip } from "@/lib/operations/zip";
export const dynamic = "force-dynamic";
export const GET = withAudit(async (req: NextRequest) => {
  try {
    const { user, client } = await requireIdentity(req, true);
    const id = z.string().uuid().parse(req.nextUrl.searchParams.get("id"));
    const { data, error } = await client.rpc("kohl_operations", {
      operation: "EXPORT_READ",
      payload: { id },
    });
    if (error || !data) throw new PortalError(404, "نسخة التقرير غير متاحة.");
    const snapshot = data as ExportSnapshot;
    const entries = new Set(
      snapshot.workspace.entries
        .filter((e) => e.date >= snapshot.from && e.date <= snapshot.to)
        .map((e) => e.id),
    );
    const documents = (snapshot.workspace.documents || []).filter((d) =>
      entries.has(d.entry_id),
    );
    if (
      documents.length > 200 ||
      documents.reduce((n, d) => n + d.size, 0) > 50 * 1024 * 1024
    )
      throw new PortalError(
        413,
        "اختر فترة أقصر؛ الحد 200 مستند أو 50 ميجابايت للحزمة.",
      );
    const files: { name: string; bytes: Uint8Array }[] = [];
    const admin = adminClient();
    for (const doc of documents) {
      const checked = await admin.rpc("operations_document", {
        actor: user.id,
        operation: "READ",
        payload: { id: doc.id },
      });
      if (
        checked.error ||
        !checked.data ||
        checked.data.sha256 !== doc.sha256 ||
        checked.data.entry_id !== doc.entry_id
      )
        throw new PortalError(
          409,
          "مستند لا يطابق نسخة التقرير؛ لم تُنشأ حزمة ناقصة.",
        );
      const file = await admin.storage
        .from("kohl-finance-documents")
        .download(checked.data.object_path);
      if (file.error || !file.data)
        throw new PortalError(
          503,
          "تعذر تحميل أحد المستندات؛ لم تُنشأ حزمة ناقصة.",
        );
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      if (
        bytes.length !== doc.size ||
        createHash("sha256").update(bytes).digest("hex") !== doc.sha256
      )
        throw new PortalError(409, "فشل التحقق من سلامة مستند.");
      const ext =
        doc.mime === "application/pdf"
          ? "pdf"
          : doc.mime === "image/png"
            ? "png"
            : doc.mime === "image/webp"
              ? "webp"
              : "jpg";
      files.push({ name: `documents/${doc.entry_id}/${doc.id}.${ext}`, bytes });
    }
    files.push({ name: "report.xlsx", bytes: await workbookBytes(snapshot) });
    files.push({
      name: "manifest.json",
      bytes: Buffer.from(
        JSON.stringify(
          {
            report_id: id,
            from: snapshot.from,
            to: snapshot.to,
            captured_at: snapshot.created_at,
            documents,
          },
          null,
          2,
        ),
      ),
    });
    return new Response(storedZip(files), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="kohl-accountant-${id}.zip"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
});
