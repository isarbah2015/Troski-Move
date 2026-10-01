import { z } from 'zod';

/** Mobile-money wallets Ghanaians pay with. Fares are the same whichever wallet pays. */
export const MOMO_NETWORKS = ['mtn', 'telecel', 'airteltigo'] as const;
export const MomoNetwork = z.enum(MOMO_NETWORKS);
export type MomoNetwork = z.infer<typeof MomoNetwork>;

export const MOMO_NETWORK_LABEL: Record<MomoNetwork, string> = {
  mtn: 'MTN MoMo',
  telecel: 'Telecel Cash',
  airteltigo: 'AT Money',
};

/** Network colours used for the small badge next to each wallet (brand-neutral enough for a chip). */
export const MOMO_NETWORK_COLOR: Record<MomoNetwork, string> = {
  mtn: '#F5B800',
  telecel: '#E0262C',
  airteltigo: '#1F5FBF',
};

/** Best guess of the wallet from a Ghana number (233 or 0 prefix). Undefined if the prefix is not recognised. */
export function guessMomoNetwork(phone: string | undefined | null): MomoNetwork | undefined {
  const digits = (phone ?? '').replace(/\D/g, '');
  const local = digits.startsWith('233') ? digits.slice(3) : digits.replace(/^0/, '');
  const p = local.slice(0, 2);
  if (['24', '25', '53', '54', '55', '59'].includes(p)) return 'mtn';
  if (['20', '50'].includes(p)) return 'telecel';
  if (['26', '27', '56', '57'].includes(p)) return 'airteltigo';
  return undefined;
}

/** `GET /api/fares`: the official fares in force now, readable without signing in. */
export const FaresResponse = z.object({
  /** The fare table in force (label and start), or null when the original fares apply. */
  table: z.object({ label: z.string(), effectiveFrom: z.string() }).nullable(),
  /** A table that is announced but not yet in force, so passengers can see the change coming. */
  upcoming: z.object({ label: z.string(), effectiveFrom: z.string() }).nullable(),
  roundingStep: z.number(),
  routes: z.array(
    z.object({
      routeId: z.string(),
      name: z.string(),
      origin: z.string(),
      destination: z.string(),
      stops: z.array(z.object({ name: z.string(), fare: z.number() })),
      /** Fixed prices between two stops inside the route, keyed `From|To`. */
      pairs: z.record(z.string(), z.number()),
    }),
  ),
});
export type FaresResponse = z.infer<typeof FaresResponse>;
