import { analyzeMessage } from "./nlu.js";
import { callTool } from "./mcpClients.js";
import { getSession } from "./session.js";
import { createAuditLogger } from "@govstack/shared";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auditLogger = createAuditLogger(path.join(__dirname, "..", "data", "chat-audit-log.json"));

const HELP_TEXT = `I can help you with:
• "Check my Aadhar status" / "Update my Aadhar address to ..."
• "Check my PAN status" / "Update my PAN name to ..."
• "Book a gas cylinder" / "Track my gas booking"
• "Check my electricity bill" / "Pay my electricity bill"
• "Track all my applications" (one consolidated view across departments)

Share your registered mobile number once, and I will securely resolve your records across every connected department — no need to remember separate IDs.`;

const FIELD_KEYWORDS = [
  { field: "address", words: ["address"] },
  { field: "name", words: ["name"] },
  { field: "dob", words: ["dob", "date of birth", "birth date"] },
];

function extractField(text) {
  const lower = text.toLowerCase();
  return FIELD_KEYWORDS.find((f) => f.words.some((w) => lower.includes(w)))?.field;
}

function extractValueAfterTo(message) {
  const match = message.match(/\bto\s+(.+)$/i);
  return match ? match[1].replace(/[.?!]+$/, "").trim() : undefined;
}

async function ensureId(session, portal, tool, idKey, entityValue) {
  if (entityValue) {
    session.ids[idKey] = entityValue;
    return entityValue;
  }
  if (session.ids[idKey]) return session.ids[idKey];
  const profile = await callTool(portal, tool, { mobileNumber: session.mobileNumber });
  session.ids[idKey] = profile[idKey];
  session.profiles[portal] = profile;
  return profile[idKey];
}

export async function handleMessage(sessionId, mobileNumberInput, message) {
  const session = getSession(sessionId);
  session.ids ||= {};
  session.profiles ||= {};

  if (mobileNumberInput) session.mobileNumber = mobileNumberInput;
  const { intent, entities } = analyzeMessage(message);
  if (entities.mobileNumber) session.mobileNumber = entities.mobileNumber;

  // Continue a multi-turn slot-filling flow (e.g. Aadhar/PAN update) if one is pending.
  if (session.pending) {
    try {
      return await continuePending(session, message, entities);
    } catch (err) {
      session.pending = null;
      auditLogger.log({ actor: session.mobileNumber || "unknown", action: "CHAT_INTENT_FAILED", target: "continuePending", result: "FAILURE", meta: { error: err.message } });
      return `Sorry, that department's service is not responding right now (${err.message}). Please try again shortly.`;
    }
  }

  if (!session.mobileNumber && !["greeting", "help"].includes(intent)) {
    return "Please share your registered 10-digit mobile number so I can securely look up your records across departments.";
  }

  try {
    switch (intent) {
      case "greeting":
        return `Hello! I am the unified Government Services Assistant. ${HELP_TEXT}`;
      case "help":
        return HELP_TEXT;
      case "farewell":
        return "You're welcome! Have a great day.";
      case "aadhar_status":
        return await handleStatus(session, "aadhar", "aadhar_lookup", "aadhar_check_status", "aadharNumber", entities.aadharNumber, "Aadhar");
      case "aadhar_update":
        return await startUpdateFlow(session, "aadhar", entities, message, {
          portal: "aadhar",
          lookupTool: "aadhar_lookup",
          updateTool: "aadhar_request_update",
          idKey: "aadharNumber",
          label: "Aadhar",
        });
      case "pan_status":
        return await handleStatus(session, "pan", "pan_lookup", "pan_check_status", "panNumber", entities.panNumber, "PAN");
      case "pan_update":
        return await startUpdateFlow(session, "pan", entities, message, {
          portal: "pan",
          lookupTool: "pan_lookup",
          updateTool: "pan_request_update",
          idKey: "panNumber",
          label: "PAN",
        });
      case "gas_status":
        return await handleGasStatus(session, entities);
      case "gas_book":
        return await handleGasBook(session, entities);
      case "electricity_status":
        return await handleElectricityStatus(session, entities);
      case "electricity_pay":
        return await handleElectricityPay(session, entities);
      case "track_all":
        return await handleTrackAll(session);
      default:
        return `I did not quite catch that. ${HELP_TEXT}`;
    }
  } catch (err) {
    auditLogger.log({ actor: session.mobileNumber || "unknown", action: "CHAT_INTENT_FAILED", target: intent, result: "FAILURE", meta: { error: err.message } });
    return `Sorry, that department's service is not responding right now (${err.message}). Please try again shortly.`;
  }
}

async function handleStatus(session, portal, lookupTool, statusTool, idKey, entityId, label) {
  const id = await ensureId(session, portal, lookupTool, idKey, entityId);
  const result = await callTool(portal, statusTool, { [idKey]: id });
  auditLogger.log({ actor: session.mobileNumber, action: `${portal.toUpperCase()}_STATUS_CHECKED`, target: id });
  if (!result.requests || result.requests.length === 0) {
    return `No pending ${label} update requests found for ${id}. Everything is up to date.`;
  }
  const lines = result.requests.map((r) => `• ${r.field} → "${r.newValue}" — ${r.status}`);
  return `${label} update requests for ${id}:\n${lines.join("\n")}`;
}

async function startUpdateFlow(session, portalKey, entities, message, cfg) {
  const id = await ensureId(session, cfg.portal, cfg.lookupTool, cfg.idKey, entities[cfg.idKey]);
  const field = extractField(message);
  const newValue = extractValueAfterTo(message);

  if (field && newValue) {
    const result = await callTool(cfg.portal, cfg.updateTool, { [cfg.idKey]: id, field, newValue });
    auditLogger.log({ actor: session.mobileNumber, action: `${cfg.portal.toUpperCase()}_UPDATE_REQUESTED`, target: id, meta: { field, newValue } });
    return `Your ${cfg.label} ${field} update request has been submitted (reference: ${result.requestId}). Status: ${result.status}.`;
  }

  session.pending = { cfg, id, slots: { field, newValue } };
  if (!field) return `Sure — which ${cfg.label} field would you like to update: name, address or date of birth?`;
  return `Got it, updating ${field}. What should the new value be?`;
}

async function continuePending(session, message, entities) {
  const { cfg, id, slots } = session.pending;
  if (!slots.field) {
    const field = extractField(message);
    if (!field) return `Please choose one of: name, address or date of birth.`;
    slots.field = field;
    session.pending.slots = slots;
    return `Got it, updating ${field}. What should the new value be?`;
  }
  if (!slots.newValue) {
    slots.newValue = message.replace(/^to\s+/i, "").trim();
  }
  session.pending = null;
  const result = await callTool(cfg.portal, cfg.updateTool, { [cfg.idKey]: id, field: slots.field, newValue: slots.newValue });
  auditLogger.log({ actor: session.mobileNumber, action: `${cfg.portal.toUpperCase()}_UPDATE_REQUESTED`, target: id, meta: slots });
  return `Your ${cfg.label} ${slots.field} update request has been submitted (reference: ${result.requestId}). Status: ${result.status}.`;
}

async function handleGasStatus(session, entities) {
  const consumerId = await ensureId(session, "gas", "gas_lookup", "consumerId", entities.consumerId);
  const result = await callTool("gas", "gas_check_bookings", { consumerId });
  if (!result.bookings || result.bookings.length === 0) return `No cylinder bookings found for consumer ${consumerId}.`;
  const latest = result.bookings.at(-1);
  return `Latest cylinder booking for ${consumerId}: ₹${latest.amount} — status: ${latest.status}.`;
}

async function handleGasBook(session, entities) {
  const consumerId = await ensureId(session, "gas", "gas_lookup", "consumerId", entities.consumerId);
  const result = await callTool("gas", "gas_book_cylinder", { consumerId });
  auditLogger.log({ actor: session.mobileNumber, action: "GAS_BOOKED_VIA_CHAT", target: consumerId });
  return `Your cylinder has been booked for consumer ${consumerId} (booking ID: ${result.bookingId}). Status: ${result.status}.`;
}

async function handleElectricityStatus(session, entities) {
  const consumerNumber = await ensureId(session, "electricity", "electricity_lookup", "consumerNumber", entities.consumerNumber);
  const bill = await callTool("electricity", "electricity_check_bill", { consumerNumber });
  return `Electricity bill for ${consumerNumber}: ₹${bill.amount} due on ${bill.dueDate} — status: ${bill.status}.`;
}

async function handleElectricityPay(session, entities) {
  const consumerNumber = await ensureId(session, "electricity", "electricity_lookup", "consumerNumber", entities.consumerNumber);
  const bill = await callTool("electricity", "electricity_check_bill", { consumerNumber });
  if (bill.status === "PAID") return `Good news — the electricity bill for ${consumerNumber} is already paid.`;
  const amount = entities.amount || bill.amount;
  const result = await callTool("electricity", "electricity_pay_bill", { consumerNumber, amount });
  auditLogger.log({ actor: session.mobileNumber, action: "ELECTRICITY_PAID_VIA_CHAT", target: consumerNumber, meta: { amount } });
  return `Payment of ₹${result.receipt.amount} successful for ${consumerNumber}. Status: ${result.status}.`;
}

async function handleTrackAll(session) {
  if (!session.mobileNumber) return "Please share your registered mobile number first.";
  const tasks = [
    { portal: "aadhar", tool: "aadhar_lookup", label: "Aadhar" },
    { portal: "pan", tool: "pan_lookup", label: "PAN" },
    { portal: "gas", tool: "gas_lookup", label: "Gas connection" },
    { portal: "electricity", tool: "electricity_lookup", label: "Electricity connection" },
  ];
  const results = await Promise.allSettled(tasks.map((t) => callTool(t.portal, t.tool, { mobileNumber: session.mobileNumber })));
  const lines = results.map((r, i) => {
    const { label } = tasks[i];
    if (r.status === "fulfilled") return `✅ ${label}: linked and active.`;
    return `⚠️ ${label}: not available right now (${r.reason.message}).`;
  });
  auditLogger.log({ actor: session.mobileNumber, action: "TRACK_ALL_VIEWED", target: session.mobileNumber });
  return `Consolidated view across all connected departments:\n${lines.join("\n")}\n\nAsk me about any one of these for full details (status, dues, bookings).`;
}
