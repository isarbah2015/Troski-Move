import { Router, type IRouter } from "express";
import { logger } from "../logger";
import { handleUssd } from "../services/ussd";

const router: IRouter = Router();

/**
 * Africa's Talking USSD callback. Form fields: sessionId, serviceCode, phoneNumber, text. The answer is plain text
 * starting with CON (more to come) or END (finished). Point the AT USSD channel's callback URL at this route.
 */
router.post("/ussd", async (req, res): Promise<void> => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const phone = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber : "";
  res.type("text/plain");
  if (!/^\+?\d{9,15}$/.test(phone)) {
    res.send("END Could not read your number.");
    return;
  }
  try {
    const reply = await handleUssd(text, phone);
    res.send(`${reply.end ? "END" : "CON"} ${reply.message}`);
  } catch (err) {
    logger.error({ err }, "USSD handler failed");
    res.send("END Something went wrong. Please try again.");
  }
});

export default router;
