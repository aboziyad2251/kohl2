export const PHOTO_LIMIT = 10 * 1024 * 1024;
export const VIDEO_LIMIT = 40 * 1024 * 1024;
export const mediaTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'] as const;
export function inspectMedia(type: string, bytes: Uint8Array): { ext: string; kind: 'photo' | 'video' } | null {
  const starts = (prefix: number[]) => prefix.every((value, i) => bytes[i] === value);
  const ascii = (start: number, end: number) => String.fromCharCode(...Array.from(bytes.subarray(start, end)));
  if (!bytes.length) return null;
  if (type.startsWith('image/') && bytes.length > PHOTO_LIMIT || bytes.length > VIDEO_LIMIT) return null;
  if (type === 'image/jpeg' && starts([255,216,255])) return { ext: 'jpg', kind: 'photo' };
  if (type === 'image/png' && starts([137,80,78,71,13,10,26,10])) return { ext: 'png', kind: 'photo' };
  if (type === 'image/webp' && ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP') return { ext: 'webp', kind: 'photo' };
  if (type === 'video/mp4' && bytes.length >= 16 && ascii(4,8) === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV)/.test(ascii(8,12))) return { ext: 'mp4', kind: 'video' };
  if (type === 'video/webm' && starts([26,69,223,163]) && ascii(0,Math.min(bytes.length,4096)).includes('webm')) return { ext: 'webm', kind: 'video' };
  return null;
}
