import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonStore, createAuditLogger } from "@govstack/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

export const consumersStore = new JsonStore(path.join(dataDir, "consumers.json"), { consumers: [] });
export const bookingsStore = new JsonStore(path.join(dataDir, "bookings.json"), { bookings: [] });
export const auditLogger = createAuditLogger(path.join(dataDir, "audit-log.json"));

const OUT_FOR_DELIVERY_MS = 15 * 1000;
const DELIVERED_MS = 40 * 1000;

export function deriveStatus(booking) {
  const elapsed = Date.now() - new Date(booking.createdAt).getTime();
  if (elapsed < OUT_FOR_DELIVERY_MS) return "BOOKED";
  if (elapsed < DELIVERED_MS) return "OUT_FOR_DELIVERY";
  return "DELIVERED";
}
