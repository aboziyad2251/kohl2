import { NextRequest } from "next/server";
import { z } from "zod";
import { withAudit } from "@/lib/audit/server";
import {
  requireIdentity,
  apiError,
  json,
  PortalError,
} from "@/lib/portal/server";
import { periodSchema } from "@/lib/operations/model";
export const dynamic = "force-dynamic";
export const POST = withAudit(async (req: NextRequest) => {
  try {
    const { client } = await requireIdentity(req, true);
    const input = z
      .object({ id: z.string().uuid(), from: z.string(), to: z.string() })
      .strict()
      .parse(await req.json());
    periodSchema.parse({ from: input.from, to: input.to });
    const { data, error } = await client.rpc("kohl_operations", {
      operation: "EXPORT",
      payload: input,
    });
    if (error)
      throw new PortalError(
        error.code === "42501" ? 403 : 400,
        "تعذر حفظ نسخة التقرير؛ لم يتم إنشاء تصدير جزئي.",
      );
    return json(data);
  } catch (e) {
    return apiError(e);
  }
});

export const GET = withAudit(async (req: NextRequest) => {
  try {
    const { client } = await requireIdentity(req, true);
    const id = z.string().uuid().parse(req.nextUrl.searchParams.get("id"));
    const { data, error } = await client.rpc("kohl_operations", {
      operation: "EXPORT_READ",
      payload: { id },
    });
    if (error)
      throw new PortalError(
        error.code === "42501" ? 403 : 400,
        "تعذر تحميل النسخة المحفوظة.",
      );
    return json(data);
  } catch (e) {
    return apiError(e);
  }
});
