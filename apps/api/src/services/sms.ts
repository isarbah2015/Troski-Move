import { logger } from "../logger";

export type SmsStatus = "sent" | "simulated" | "no_phone";

/**
 * Sends an SMS through Hubtel (GPRTU's account). With no Hubtel credentials it runs in a simulator: the message is
 * logged and reported as `simulated`, so the dashboard flow can be shown without sending anything real.
 */
export async function sendSms(to: string | null | undefined, content: string): Promise<SmsStatus> {
  if (!to) return "no_phone";
  const id = process.env.HUBTEL_CLIENT_ID;
  const secret = process.env.HUBTEL_CLIENT_SECRET;
  if (!id || !secret) {
    logger.warn({ to, content }, "SMS_SIMULATOR_MODE: Hubtel credentials are not set, so no SMS was sent");
    return "simulated";
  }
  const q = new URLSearchParams({ clientid: id, clientsecret: secret, from: process.env.HUBTEL_SENDER_ID ?? "GPRTU", to, content });
  try {
    const res = await fetch(`https://smsc.hubtel.com/v1/messages/send?${q.toString()}`);
    if (!res.ok) {
      logger.warn({ status: res.status }, "Hubtel rejected an SMS");
      return "simulated";
    }
    return "sent";
  } catch (err) {
    logger.warn({ err }, "Could not reach Hubtel");
    return "simulated";
  }
}
