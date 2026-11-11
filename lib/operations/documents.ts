export const DOCUMENT_LIMIT = 5 * 1024 * 1024;
export function inspectDocument(mime: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > DOCUMENT_LIMIT) return null;
  const starts = (prefix: number[]) => prefix.every((b, i) => bytes[i] === b);
  const ascii = (a: number, b: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(a, b)));
  if (mime === "application/pdf" && ascii(0, 5) === "%PDF-") return "pdf";
  if (mime === "image/png" && starts([137, 80, 78, 71, 13, 10, 26, 10]))
    return "png";
  if (mime === "image/jpeg" && starts([255, 216, 255])) return "jpg";
  if (
    mime === "image/webp" &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 12) === "WEBP"
  )
    return "webp";
  return null;
}
export function documentFilename(name: string) {
  return name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 150) || "document";
}
