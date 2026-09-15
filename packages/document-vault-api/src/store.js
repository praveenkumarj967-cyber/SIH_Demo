import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonStore, createAuditLogger } from "@govstack/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

export const usersStore = new JsonStore(path.join(dataDir, "users.json"), { users: [] });
export const documentsStore = new JsonStore(path.join(dataDir, "documents.json"), { documents: [] });
export const otpStore = new JsonStore(path.join(dataDir, "otps.json"), { otps: [] });
export const consentStore = new JsonStore(path.join(dataDir, "consent-requests.json"), { requests: [] });
export const inboxStore = new JsonStore(path.join(dataDir, "mock-sms-inbox.json"), { messages: [] });
export const officialsStore = new JsonStore(path.join(dataDir, "officials.json"), { officials: [] });
export const auditLogger = createAuditLogger(path.join(dataDir, "audit-log.json"));

/** Simulates an SMS gateway: every "sent" OTP/notification lands in a per-mobile mock inbox. */
export function sendMockSms(mobileNumber, message) {
  inboxStore.update((data) => {
    data.messages.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mobileNumber,
      message,
      sentAt: new Date().toISOString(),
    });
    if (data.messages.length > 500) data.messages.shift();
  });
}
