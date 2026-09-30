import { z } from 'zod';

/** What a conductor's QR sticker encodes. `version` bumps on every regenerate. */
export const QrPayload = z.object({
  vehicleId: z.number(),
  shortCode: z.string(),
  routeId: z.string(),
  version: z.number().int().positive(),
});
export type QrPayload = z.infer<typeof QrPayload>;

export function encodeQrPayload(payload: QrPayload): string {
  return JSON.stringify(payload);
}

/**
 * Turns whatever a passenger scanned or typed into a code the API can resolve: a JSON sticker payload,
 * a `trotrolink://v/<qr id>` link, a raw QR id or a short code like CIR01.
 */
export function parseScannedCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = QrPayload.safeParse(JSON.parse(trimmed));
      if (parsed.success) return parsed.data.shortCode;
    } catch {
      // fall through: not JSON after all
    }
  }
  const link = trimmed.match(/^trotrolink:\/\/v\/(.+)$/i);
  return link ? link[1]! : trimmed;
}
