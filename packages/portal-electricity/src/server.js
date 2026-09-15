import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidMobile } from "@govstack/shared";
import { consumersStore, billsStore, auditLogger } from "./store.js";
import { seed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (consumersStore.isEmpty("consumers")) seed();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const isValidConsumerNumber = (id) => /^EL\d{3,8}$/i.test(String(id || ""));

app.get("/api/lookup/:mobileNumber", (req, res) => {
  const { mobileNumber } = req.params;
  if (!isValidMobile(mobileNumber)) return res.status(400).json({ error: "Invalid mobile number." });
  const { consumers } = consumersStore.read();
  const consumer = consumers.find((c) => c.mobileNumber === mobileNumber);
  if (!consumer) return res.status(404).json({ error: "No electricity connection linked to this mobile number." });
  auditLogger.log({ actor: mobileNumber, action: "ELECTRICITY_LOOKUP", target: consumer.consumerNumber });
  res.json(consumer);
});

app.get("/api/bill/:consumerNumber", (req, res) => {
  const consumerNumber = (req.params.consumerNumber || "").toUpperCase();
  if (!isValidConsumerNumber(consumerNumber)) return res.status(400).json({ error: "Invalid consumer number." });
  const { bills } = billsStore.read();
  const bill = bills.find((b) => b.consumerNumber === consumerNumber);
  if (!bill) return res.status(404).json({ error: "No bill found for this consumer number." });
  res.json(bill);
});

app.post("/api/pay", (req, res) => {
  const consumerNumber = (req.body?.consumerNumber || "").toUpperCase();
  const { amount } = req.body || {};
  if (!isValidConsumerNumber(consumerNumber)) return res.status(400).json({ error: "Invalid consumer number." });
  if (!amount || amount <= 0) return res.status(400).json({ error: "A valid payment amount is required." });

  const result = billsStore.update((data) => {
    const bill = data.bills.find((b) => b.consumerNumber === consumerNumber);
    if (!bill) return { error: "No bill found for this consumer number." };
    if (bill.status === "PAID") return { error: "This bill has already been paid." };
    bill.status = "PAID";
    bill.history.push({ amount, paidAt: new Date().toISOString() });
    return { bill };
  });
  if (result.error) return res.status(400).json({ error: result.error });
  auditLogger.log({ actor: consumerNumber, action: "ELECTRICITY_BILL_PAID", target: consumerNumber, meta: { amount } });
  res.json({ status: "PAID", receipt: result.bill.history.at(-1) });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "portal-electricity" }));

const PORT = process.env.PORT || 4104;
app.listen(PORT, () => console.log(`[portal-electricity] listening on http://localhost:${PORT}`));
