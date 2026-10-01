import { amountDue, newTripRef, vehicleWithRoute } from "../lib";
import { initiatePayment } from "../routes/payments";

/**
 * USSD for feature phones (*123# then a vehicle code). Africa's Talking calls this on every key press with the
 * whole conversation so far in `text` ("CIR01*2*1"), and expects "CON ..." to continue or "END ..." to finish.
 *
 * USSD screens use the plain GSM alphabet, so amounts are written "GHS 4", not "₵4".
 */
export type UssdReply = { end: boolean; message: string };

const con = (message: string): UssdReply => ({ end: false, message });
const end = (message: string): UssdReply => ({ end: true, message });

export async function handleUssd(text: string, phoneNumber: string): Promise<UssdReply> {
  const parts = text === "" ? [] : text.split("*");
  if (parts.length === 0) return con("TrotroLink\nEnter the vehicle code on the sticker (e.g. CIR01):");

  const found = await vehicleWithRoute(parts[0]!.trim());
  if (!found) return end(`Vehicle ${parts[0]!.trim().toUpperCase()} not found. Check the code on the sticker and dial again.`);
  const stops = found.route.stopsJson.slice(1); // the origin is where you board
  const code = found.vehicle.shortCode;

  if (parts.length === 1) {
    const menu = stops.map((s, i) => `${i + 1}. ${s.name} GHS ${amountDue(s.fare)}`).join("\n");
    return con(`${code} ${found.route.origin} to ${found.route.destination}\nWhere do you get off?\n${menu}`);
  }

  const pick = Number(parts[1]);
  const stop = Number.isInteger(pick) ? stops[pick - 1] : undefined;
  if (!stop) return end("That choice is not on the list. Dial again and pick a number.");
  const amount = amountDue(stop.fare);

  if (parts.length === 2) return con(`Pay GHS ${amount} to ${stop.name}?\n1. Yes, pay with MoMo\n2. No`);

  if (parts[2] !== "1") return end("Cancelled. Nothing was charged.");

  // One ride per dial: the trip reference is fixed by this USSD session, so a repeated confirm cannot double-charge.
  const result = await initiatePayment({
    tripId: newTripRef(),
    deviceId: `ussd-${phoneNumber.replace(/\D/g, "")}`,
    vehicleCode: code,
    boardingStop: found.route.stopsJson[0]!.name,
    alightingStop: stop.name,
    amount,
    payerPhone: phoneNumber.replace(/[^\d+]/g, ""),
  });
  if (result.status !== 200 || "error" in result.body) {
    const reason = "error" in result.body ? result.body.error : "Please try again.";
    return end(`Payment could not start. ${reason}`);
  }
  return end(`Approve the MoMo prompt on your phone and enter your PIN. GHS ${amount} to ${stop.name}. Ref ${result.body.tripId}.`);
}
