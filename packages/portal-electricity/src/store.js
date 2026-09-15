import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonStore, createAuditLogger } from "@govstack/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

export const consumersStore = new JsonStore(path.join(dataDir, "consumers.json"), { consumers: [] });
export const billsStore = new JsonStore(path.join(dataDir, "bills.json"), { bills: [] });
export const auditLogger = createAuditLogger(path.join(dataDir, "audit-log.json"));
