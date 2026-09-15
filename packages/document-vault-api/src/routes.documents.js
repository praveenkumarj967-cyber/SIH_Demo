import { Router } from "express";
import { isValidOtp, decrypt } from "@govstack/shared";
import { documentsStore, consentStore, auditLogger, sendMockSms } from "./store.js";
import { createOtp, verifyOtp } from "./otpService.js";
import { requireAuth } from "./middleware.js";

const router = Router();
const ENC_KEY = process.env.VAULT_ENC_KEY;
const REVEAL_TTL_SECONDS = Number(process.env.REVEAL_TTL_SECONDS || 30);

function maskedDoc(doc) {
  return { id: doc.id, type: doc.type, label: doc.label, maskedPreview: doc.maskedPreview };
}

// -- Citizen: list own documents (always masked) ---------------------------
router.get("/", requireAuth("citizen"), (req, res) => {
  const { documents } = documentsStore.read();
  const mine = documents.filter((d) => d.mobileNumber === req.user.sub);
  res.json({ documents: mine.map(maskedDoc) });
});

// -- Citizen: request a single OTP to unmask one or more documents ---------
router.post("/reveal-request", requireAuth("citizen"), (req, res) => {
  const { documentIds } = req.body || {};
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ error: "Select at least one document to unlock." });
  }
  const { documents } = documentsStore.read();
  const owned = documents.filter((d) => documentIds.includes(d.id) && d.mobileNumber === req.user.sub);
  if (owned.length !== documentIds.length) {
    return res.status(403).json({ error: "One or more documents do not belong to this account." });
  }
  const { otp } = createOtp(req.user.sub, "REVEAL", { documentIds });
  sendMockSms(
    req.user.sub,
    `OTP to unlock ${documentIds.length} document(s) in your Vault: ${otp}. Valid for 5 minutes. Never share this code.`
  );
  auditLogger.log({ actor: req.user.sub, action: "REVEAL_OTP_REQUESTED", target: documentIds.join(","), meta: { count: documentIds.length } });
  res.json({ success: true, message: "A single OTP has been sent for all selected documents." });
});

// -- Citizen: confirm OTP and receive decrypted values (auto re-masks client-side) --
router.post("/reveal-confirm", requireAuth("citizen"), (req, res) => {
  const { otp, documentIds } = req.body || {};
  if (!isValidOtp(otp)) return res.status(400).json({ error: "Enter the 6-digit OTP." });
  const result = verifyOtp(req.user.sub, "REVEAL", otp);
  if (!result.ok) {
    auditLogger.log({ actor: req.user.sub, action: "REVEAL_FAILED", target: (documentIds || []).join(","), result: "FAILURE", meta: { reason: result.reason } });
    return res.status(401).json({ error: result.reason });
  }
  const idsToReveal = result.meta?.documentIds || documentIds || [];
  const { documents } = documentsStore.read();
  const revealed = documents
    .filter((d) => idsToReveal.includes(d.id) && d.mobileNumber === req.user.sub)
    .map((d) => ({ id: d.id, type: d.type, label: d.label, value: decrypt(d.encryptedValue, ENC_KEY) }));
  auditLogger.log({ actor: req.user.sub, action: "DOCUMENTS_REVEALED", target: idsToReveal.join(","), meta: { count: revealed.length } });
  res.json({ documents: revealed, revealTtlSeconds: REVEAL_TTL_SECONDS });
});

// -- Citizen: view & respond to official consent requests ------------------
router.get("/consent-requests", requireAuth("citizen"), (req, res) => {
  const { requests } = consentStore.read();
  const mine = requests.filter((r) => r.mobileNumber === req.user.sub);
  res.json({ requests: mine });
});

router.post("/consent-requests/:id/respond", requireAuth("citizen"), (req, res) => {
  const { approve } = req.body || {};
  const request = consentStore.update((data) => {
    const found = data.requests.find((r) => r.id === req.params.id && r.mobileNumber === req.user.sub);
    if (!found) return null;
    if (found.status !== "PENDING") return found;
    found.status = approve ? "AWAITING_OTP" : "DENIED";
    found.respondedAt = new Date().toISOString();
    return found;
  });
  if (!request) return res.status(404).json({ error: "Consent request not found." });
  if (request.status === "DENIED") {
    auditLogger.log({ actor: req.user.sub, action: "CONSENT_DENIED", target: request.officialUsername });
    return res.json({ status: "DENIED" });
  }
  const { otp } = createOtp(req.user.sub, "CONSENT_APPROVE", { consentRequestId: request.id });
  sendMockSms(
    req.user.sub,
    `OTP to authorize ${request.officialUsername} to view your documents: ${otp}. Only enter this on the Vault portal, never share it verbally.`
  );
  res.json({ status: "AWAITING_OTP" });
});

router.post("/consent-requests/:id/confirm", requireAuth("citizen"), (req, res) => {
  const { otp } = req.body || {};
  if (!isValidOtp(otp)) return res.status(400).json({ error: "Enter the 6-digit OTP." });
  const result = verifyOtp(req.user.sub, "CONSENT_APPROVE", otp);
  if (!result.ok) return res.status(401).json({ error: result.reason });

  const { documents } = documentsStore.read();
  const request = consentStore.update((data) => {
    const found = data.requests.find((r) => r.id === req.params.id && r.mobileNumber === req.user.sub);
    if (!found) return null;
    found.status = "APPROVED";
    found.approvedAt = new Date().toISOString();
    found.resultExpiresAt = Date.now() + REVEAL_TTL_SECONDS * 1000 * 4;
    found.revealedDocuments = documents
      .filter((d) => found.documentIds.includes(d.id))
      .map((d) => ({ id: d.id, type: d.type, label: d.label, value: decrypt(d.encryptedValue, ENC_KEY) }));
    return found;
  });
  if (!request) return res.status(404).json({ error: "Consent request not found." });
  auditLogger.log({ actor: req.user.sub, action: "CONSENT_APPROVED", target: request.officialUsername, meta: { documentIds: request.documentIds } });
  res.json({ status: "APPROVED" });
});

export default router;
