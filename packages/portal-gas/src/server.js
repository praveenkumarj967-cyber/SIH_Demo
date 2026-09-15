import "dotenv/config";
import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidMobile } from "@govstack/shared";
import { consumersStore, bookingsStore, auditLogger, deriveStatus } from "./store.js";
import { seed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (consumersStore.isEmpty("consumers")) seed();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const isValidConsumerId = (id) => /^GC\d{3,8}$/i.test(String(id || ""));

app.get("/api/lookup/:mobileNumber", (req, res) => {
  const { mobileNumber } = req.params;
  if (!isValidMobile(mobileNumber)) return res.status(400).json({ error: "Invalid mobile number." });
  const { consumers } = consumersStore.read();
  const consumer = consumers.find((c) => c.mobileNumber === mobileNumber);
  if (!consumer) return res.status(404).json({ error: "No gas connection linked to this mobile number." });
  auditLogger.log({ actor: mobileNumber, action: "GAS_LOOKUP", target: consumer.consumerId });
  res.json(consumer);
});

app.get("/api/bookings/:consumerId", (req, res) => {
  const consumerId = (req.params.consumerId || "").toUpperCase();
  if (!isValidConsumerId(consumerId)) return res.status(400).json({ error: "Invalid consumer ID." });
  const { bookings } = bookingsStore.read();
  const mine = bookings.filter((b) => b.consumerId === consumerId).map((b) => ({ ...b, status: deriveStatus(b) }));
  res.json({ consumerId, bookings: mine });
});

app.post("/api/book", (req, res) => {
  const consumerId = (req.body?.consumerId || "").toUpperCase();
  if (!isValidConsumerId(consumerId)) return res.status(400).json({ error: "Invalid consumer ID." });
  const { consumers } = consumersStore.read();
  const consumer = consumers.find((c) => c.consumerId === consumerId);
  if (!consumer) return res.status(404).json({ error: "Consumer ID not found." });

  const { bookings } = bookingsStore.read();
  const activeBooking = bookings.find((b) => b.consumerId === consumerId && deriveStatus(b) !== "DELIVERED");
  if (activeBooking) {
    return res.status(409).json({ error: "A cylinder booking is already in progress for this consumer ID." });
  }

  const booking = { id: uuid(), consumerId, createdAt: new Date().toISOString(), amount: 1050 };
  bookingsStore.update((data) => data.bookings.push(booking));
  auditLogger.log({ actor: consumerId, action: "GAS_CYLINDER_BOOKED", target: booking.id });
  res.json({ bookingId: booking.id, status: "BOOKED" });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "portal-gas" }));

const PORT = process.env.PORT || 4103;
app.listen(PORT, () => console.log(`[portal-gas] listening on http://localhost:${PORT}`));
