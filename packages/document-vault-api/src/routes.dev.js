import { Router } from "express";
import { inboxStore } from "./store.js";

const router = Router();

/**
 * Mock SMS inbox - stands in for a real SMS gateway (e.g. Twilio/MSG91) which
 * this prototype has no live credentials for. Disabled outside development.
 */
router.get("/inbox/:mobileNumber", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production." });
  }
  const { messages } = inboxStore.read();
  const mine = messages.filter((m) => m.mobileNumber === req.params.mobileNumber).slice(-10).reverse();
  res.json({ messages: mine });
});

export default router;
