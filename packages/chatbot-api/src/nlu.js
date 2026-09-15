const MOBILE_RE = /\b[6-9]\d{9}\b/;
const AADHAR_RE = /\b\d{12}\b/;
const PAN_RE = /\b[A-Za-z]{5}\d{4}[A-Za-z]\b/;
const GAS_CONSUMER_RE = /\bGC[-]?\d{3,8}\b/i;
const ELECTRICITY_CONSUMER_RE = /\bEL[-]?\d{3,8}\b/i;
const AMOUNT_RE = /(?:rs\.?|inr|₹)\s?(\d+(?:\.\d{1,2})?)/i;

/** Lightweight rule-based intent classifier (no external LLM dependency required). */
export function analyzeMessage(message) {
  const text = message.toLowerCase();
  const has = (...words) => words.some((w) => text.includes(w));

  const entities = {
    mobileNumber: message.match(MOBILE_RE)?.[0],
    aadharNumber: message.match(AADHAR_RE)?.[0],
    panNumber: message.match(PAN_RE)?.[0]?.toUpperCase(),
    consumerId: message.match(GAS_CONSUMER_RE)?.[0]?.toUpperCase(),
    consumerNumber: message.match(ELECTRICITY_CONSUMER_RE)?.[0]?.toUpperCase(),
    amount: message.match(AMOUNT_RE)?.[1] ? Number(message.match(AMOUNT_RE)[1]) : undefined,
  };

  let intent = "unknown";
  if (has("hi", "hello", "hey", "namaste")) intent = "greeting";
  else if (has("help", "what can you do")) intent = "help";
  else if (has("track everything", "all my applications", "track all", "consolidated", "dashboard")) intent = "track_all";
  else if (has("aadhar", "aadhaar")) intent = has("update", "change", "correct") ? "aadhar_update" : "aadhar_status";
  else if (has("pan card", "pan number") || (has("pan") && !has("panel"))) intent = has("update", "change", "correct") ? "pan_update" : "pan_status";
  else if (has("gas", "cylinder", "lpg")) intent = has("book", "order") ? "gas_book" : "gas_status";
  else if (has("electricity", "power bill", "current bill", "elec bill")) intent = has("pay") ? "electricity_pay" : "electricity_status";
  else if (has("thank", "bye")) intent = "farewell";

  return { intent, entities };
}
