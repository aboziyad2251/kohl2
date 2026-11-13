import { NextRequest } from "next/server";
import {
  requireIdentity,
  apiError,
  json,
  PortalError,
} from "@/lib/portal/server";
import { withAudit } from "@/lib/audit/server";
import { leasingActions } from '@/lib/leasing/access';
import { operationAction } from "@/lib/operations/model";
export const dynamic = "force-dynamic";
async function perform(req: NextRequest, write: boolean) {
  try {
    const { client, profile } = await requireIdentity(req);
    if (!["ADMIN", "CEO", "EMPLOYEE", "LEASING"].includes(profile.account.role))
      throw new PortalError(403, "غير مخول");
    if (write && Number(req.headers.get("content-length") || 0) > 16384)
      throw new PortalError(413, "طلب كبير");
    const raw = write ? await req.text() : "";
    if (raw.length > 16384) throw new PortalError(413, "طلب كبير");
    const input = write
      ? operationAction.parse(JSON.parse(raw))
      : { operation: "LIST" };
    const { operation, ...payload } = input;
    if (profile.account.role === "LEASING" && !leasingActions.has(operation)) throw new PortalError(403, "صلاحيات التأجير فقط.");
    const { data, error } = await client.rpc(profile.account.role === "LEASING" ? "leasing_operations" : "kohl_operations", {
      operation,
      payload,
    });
    if (error) {
      const missing = ["42883", "PGRST202", "42P01"].includes(error.code);
      throw new PortalError(
        missing
          ? 503
          : error.code === "42501"
            ? 403
            : ["23505", "PT409", "40001"].includes(error.code)
              ? 409
              : 400,
        missing
          ? "القسم بانتظار تهيئة قاعدة البيانات المعتمدة."
          : error.code === "54000"
            ? "تجاوزت البيانات حد العرض؛ يلزم الأرشفة أو تقسيم التقرير."
            : "تعذر الحفظ؛ حدّث البيانات وتحقق من الصلاحية وجاهزية الوحدة والتواريخ والمبالغ والمرجع.",
      );
    }
    return json(data);
  } catch (e) {
    if (e instanceof SyntaxError)
      return apiError(new PortalError(400, "طلب غير صالح"));
    return apiError(e);
  }
}
export const GET = withAudit((req: NextRequest) => perform(req, false));
export const POST = withAudit((req: NextRequest) => perform(req, true));
