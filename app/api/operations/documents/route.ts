import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  requireIdentity,
  adminClient,
  PortalError,
  apiError,
  json,
} from "@/lib/portal/server";
import { withAudit } from "@/lib/audit/server";
import {
  DOCUMENT_LIMIT,
  inspectDocument,
  documentFilename,
} from "@/lib/operations/documents";
export const dynamic = "force-dynamic";
const bucket = "kohl-finance-documents";
async function documentRPC(actor: string, operation: string, payload: unknown) {
  const { data, error } = await adminClient().rpc("operations_document", {
    actor,
    operation,
    payload,
  });
  if (error)
    throw new PortalError(
      error.code === "42501" ? 403 : error.code === "40001" ? 409 : 400,
      "تعذر الوصول إلى المستند؛ تحقق من صلاحية الحركة وحالتها.",
    );
  return data;
}
export const GET = withAudit(async (req: NextRequest) => {
  try {
    const { user } = await requireIdentity(req);
    const id = z.string().uuid().parse(req.nextUrl.searchParams.get("id"));
    const file = await documentRPC(user.id, "READ", { id });
    const { data, error } = await adminClient()
      .storage.from(bucket)
      .download(file.object_path);
    if (error || !data) throw new PortalError(503, "تعذر تنزيل المستند.");
    const bytes = Buffer.from(await data.arrayBuffer());
    if (
      bytes.length !== file.size ||
      createHash("sha256").update(bytes).digest("hex") !== file.sha256
    )
      throw new PortalError(409, "المستند لا يطابق النسخة المسجلة.");
    return new Response(bytes, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `attachment; filename="${id}.${inspectDocument(file.mime, bytes) || "bin"}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
});
export const POST = withAudit(async (req: NextRequest) => {
  let reserved: { id: string; object_path: string } | undefined;
  let actor = "";
  try {
    const { user, profile } = await requireIdentity(req);
    actor = user.id;
    if (!["ADMIN", "CEO", "EMPLOYEE"].includes(profile.account.role))
      throw new PortalError(403, "غير مخول");
    if (!req.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new PortalError(415, "ارفع ملفاً مع الحركة.");
    const reader = req.body?.getReader();
    if (!reader) throw new PortalError(400, "مستند مطلوب");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > DOCUMENT_LIMIT + 65536) {
        await reader.cancel();
        throw new PortalError(413, "الحد الأعلى للمستند 5 ميجابايت.");
      }
      chunks.push(part.value);
    }
    const form = await new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": req.headers.get("content-type")! },
      body: Buffer.concat(chunks),
    }).formData();
    const entry_id = z.string().uuid().parse(form.get("entry_id"));
    const file = form.get("file");
    if (!file || typeof file === "string" || file.size > DOCUMENT_LIMIT)
      throw new PortalError(400, "اختر مستنداً حتى 5 ميجابايت.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!inspectDocument(file.type, bytes))
      throw new PortalError(
        400,
        "الملفات المقبولة: PDF أو JPEG أو PNG أو WebP مطابق لنوعه.",
      );
    const reservation = await documentRPC(actor, "RESERVE", {
      id: crypto.randomUUID(),
      entry_id,
      filename: documentFilename(file.name),
      mime: file.type,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    if (reservation.status === "READY")
      return json({ saved: true, id: reservation.id, duplicate: true });
    reserved = reservation;
    const { error } = await adminClient()
      .storage.from(bucket)
      .upload(reservation.object_path, bytes, {
        contentType: file.type,
        upsert: false,
      });
    if (error) {
      // Resume a verified object after a server crash/lost upload response; never overwrite it.
      const existing=await adminClient().storage.from(bucket).download(reservation.object_path);
      const existingBytes=existing.data?Buffer.from(await existing.data.arrayBuffer()):null;
      if(existing.error||!existingBytes||existingBytes.length!==bytes.length||createHash('sha256').update(existingBytes).digest('hex')!==reservation.sha256)
        throw new PortalError(503,"تعذر حفظ المستند في التخزين الخاص.");
    }
    await documentRPC(actor, "FINISH", { id: reservation.id });
    reserved = undefined;
    return json({ saved: true, id: reservation.id });
  } catch (e) {
    if (reserved) {
      // Never remove a file if a FINISH response was lost after its commit.
      let completed = false;
      try {
        await documentRPC(actor, "READ", { id: reserved.id });
        completed = true;
      } catch {}
      if (completed) return json({ saved: true, id: reserved.id });
      try {
        const aborted = await documentRPC(actor, "ABORT", { id: reserved.id });
        const { error } = await adminClient()
          .storage.from(bucket)
          .remove([aborted.object_path]);
        if (error) throw error;
      } catch {
        console.error("[operations] upload cleanup needs reconciliation");
      }
    }
    return apiError(e);
  }
});
