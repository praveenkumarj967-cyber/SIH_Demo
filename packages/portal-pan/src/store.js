import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonStore, createAuditLogger } from "@govstack/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

export const recordsStore = new JsonStore(path.join(dataDir, "records.json"), { records: [] });
export const requestsStore = new JsonStore(path.join(dataDir, "requests.json"), { requests: [] });
export const auditLogger = createAuditLogger(path.join(dataDir, "audit-log.json"));

const PENDING_MS = 10 * 1000;
const REVIEW_MS = 25 * 1000;

export function deriveStatus(request) {
  if (request.status === "REJECTED") return "REJECTED";
  const elapsed = Date.now() - new Date(request.createdAt).getTime();
  if (elapsed < PENDING_MS) return "PENDING";
  if (elapsed < REVIEW_MS) return "IN_REVIEW";
  return "APPROVED";
}

export function applyIfApproved(request) {
  if (request.applied) return;
  if (deriveStatus(request) !== "APPROVED") return;
  recordsStore.update((data) => {
    const record = data.records.find((r) => r.panNumber === request.panNumber);
    if (record) record[request.field] = request.newValue;
  });
  requestsStore.update((data) => {
    const found = data.requests.find((r) => r.id === request.id);
    if (found) found.applied = true;
  });
}
