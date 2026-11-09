import { z } from 'zod';

export const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export type PropertyLocation = z.infer<typeof locationSchema>;
export function mapLinks(input: PropertyLocation) {
  const { latitude, longitude } = locationSchema.parse(input);
  const pin = `${latitude},${longitude}`;
  return {
    view: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pin)}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pin)}`,
    embed: `https://maps.google.com/maps?q=${encodeURIComponent(pin)}&z=17&output=embed`,
  };
}
export function parseCoordinates(input: string): PropertyLocation | null {
  // Accept a coordinate pair, a full Google Maps URL with @lat,lng, or its query value.
  // Short links are deliberately not fetched by the server.
  const text = input.trim();
  let candidate = text;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (!['google.com', 'www.google.com', 'maps.google.com', 'www.google.com.sa', 'google.com.sa'].includes(url.hostname)) return null;
      const pin = decodeURIComponent(url.pathname + url.search).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
      candidate = pin ? `${pin[1]},${pin[2]}` : url.searchParams.get('query') || url.searchParams.get('q') || url.pathname.match(/@(-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)/)?.[1] || '';
    } catch { return null; }
  }
  const pair = candidate.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!pair) return null;
  const parsed = locationSchema.safeParse({ latitude: Number(pair[1]), longitude: Number(pair[2]) });
  return parsed.success ? parsed.data : null;
}
