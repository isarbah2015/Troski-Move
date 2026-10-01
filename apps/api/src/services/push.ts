import { logger } from "../logger";

/**
 * Sends a push notification through Expo's push service. It needs no secret here, but delivery to a standalone Android
 * build needs FCM credentials added to the Expo project (GPRTU's Firebase project). With no valid token, or no
 * credentials, the call just fails quietly: notifications are a nicety, never part of a payment or trip.
 */
export async function sendPush(token: string | null | undefined, title: string, body: string): Promise<void> {
  if (!token || !token.startsWith("ExponentPushToken") || process.env.PUSH_ENABLED === "false") return;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, title, body, sound: null, channelId: "trip", data: { screen: "trip" } }),
    });
    if (!res.ok) logger.warn({ status: res.status }, "Push service rejected a notification");
  } catch (err) {
    logger.warn({ err }, "Could not reach the push service");
  }
}
