import { NextRequest } from "next/server";
import { requireIdentity, json, apiError, PortalError } from "@/lib/portal/server";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const { client } = await requireIdentity(req);
    const { data, error } = await client.rpc("kohl_operations", { operation: "WORKFLOW_INFO", payload: {} });
    if (error || !data) throw new PortalError(403, "مسار المراجعة غير متاح.");
    return json(data);
  } catch (error) { return apiError(error); }
}
