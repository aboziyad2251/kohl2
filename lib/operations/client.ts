import { supabase } from "@/lib/supabaseClient";
export async function operationsFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("يرجى تسجيل الدخول");
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...init.headers,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "تعذر تنفيذ العملية");
  }
  return response;
}
export async function saveDownload(path: string, filename: string) {
  const response = await operationsFetch(path);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
