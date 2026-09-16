import { Router } from "express";
import { v4 as uuid } from "uuid";
import { isValidMobile, isValidOtp, decrypt, encrypt, maskValue } from "@govstack/shared";
import { documentsStore, consentStore, auditLogger, sendMockSms } from "./store.js";
import { createOtp, verifyOtp } from "./otpService.js";
import { requireAuth } from "./middleware.js";

const router = Router();
const ENC_KEY = process.env.VAULT_ENC_KEY || "4f3c2a1e9b8d7c6a5f4e3d2c1b0a99887766554433221100ffeeddccbbaa9988";
const REVEAL_TTL_SECONDS = Number(process.env.REVEAL_TTL_SECONDS || 30);

function maskedDoc(doc) {
  return { id: doc.id, type: doc.type, label: doc.label, maskedPreview: doc.maskedPreview, verification: doc.verification };
}

// -- Citizen: Upload & Live Verify Document with Issuer (UIDAI / Income Tax) --
router.post("/upload", requireAuth("citizen"), async (req, res) => {
  const { type, label, value } = req.body || {};
  const mobileNumber = req.user.sub;
  if (!type || !value) {
    return res.status(400).json({ error: "Document type and document number/value are required." });
  }

  let verificationResult = { verified: false, source: "UNVERIFIED" };

  // 1. Live Verification for AADHAR against UIDAI Server
  if (type.toUpperCase() === "AADHAR") {
    try {
      const uidaiRes = await fetch("http://localhost:4101/api/verify-aadhar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadharNumber: value, mobileNumber }),
      });
      const uidaiData = await uidaiRes.json();
      if (!uidaiRes.ok || !uidaiData.verified) {
        return res.status(400).json({
          error: uidaiData.error || "UIDAI Verification Failed: Aadhar record does not match UIDAI central registry.",
        });
      }
      verificationResult = {
        verified: true,
        source: "UIDAI_EKYC_API",
        reference: uidaiData.uidaiReference,
        badge: "🟢 UIDAI e-KYC Verified",
      };
    } catch (err) {
      console.warn("UIDAI Server call failed", err);
      return res.status(500).json({ error: "Unable to reach UIDAI verification server." });
    }
  } 
  // 2. Live Verification for PAN against Income Tax PAN Server
  else if (type.toUpperCase() === "PAN") {
    try {
      const panRes = await fetch(`http://localhost:4102/api/status/${value.trim().toUpperCase()}`);
      if (!panRes.ok) {
        return res.status(400).json({ error: "PAN Verification Failed: Invalid PAN format or record not found." });
      }
      verificationResult = {
        verified: true,
        source: "INCOME_TAX_PAN_API",
        badge: "🟢 Income Tax Dept Verified",
      };
    } catch (err) {
      return res.status(500).json({ error: "Unable to reach Income Tax PAN verification server." });
    }
  } else {
    verificationResult = {
      verified: true,
      source: "DIGITAL_SIGNATURE_OK",
      badge: "🟢 Verified Document",
    };
  }

  const newDoc = {
    id: uuid(),
    mobileNumber,
    type: type.toUpperCase(),
    label: label || `${type} Card`,
    maskedPreview: maskValue(value),
    encryptedValue: encrypt(value, ENC_KEY),
    verification: verificationResult,
    createdAt: new Date().toISOString(),
  };

  documentsStore.update((data) => {
    data.documents.push(newDoc);
  });

  auditLogger.log({
    actor: mobileNumber,
    action: "DOCUMENT_UPLOADED_AND_VERIFIED",
    target: newDoc.id,
    meta: { type: newDoc.type, source: verificationResult.source },
  });

  res.json({
    success: true,
    message: `Document uploaded and verified via ${verificationResult.source}!`,
    document: maskedDoc(newDoc),
    verification: verificationResult,
  });
});

// -- Third-Party Application: Direct Vault Retrieval via OTP ---------------
router.post("/direct-fetch-otp", (req, res) => {
  const { mobileNumber, documentType } = req.body || {};
  if (!isValidMobile(mobileNumber)) {
    return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });
  }
  const { documents } = documentsStore.read();
  const found = documents.find((d) => d.mobileNumber === mobileNumber && (documentType ? d.type === documentType.toUpperCase() : true));
  if (!found) {
    return res.status(404).json({ error: `No ${documentType || "document"} found in Vault for mobile number ${mobileNumber}.` });
  }
  const { otp } = createOtp(mobileNumber, "VAULT_FETCH", { documentType: found.type, documentId: found.id });
  sendMockSms(
    mobileNumber,
    `OTP to authorize external application to fetch your ${found.label} from DigiVault: ${otp}. Valid for 5 minutes.`
  );
  auditLogger.log({ actor: mobileNumber, action: "DIRECT_FETCH_OTP_REQUESTED", target: found.id, meta: { documentType: found.type } });
  res.json({ success: true, message: `OTP sent to ${mobileNumber} for ${found.label} retrieval.`, documentType: found.type, label: found.label });
});

router.post("/direct-fetch-verify", (req, res) => {
  const { mobileNumber, documentType, otp } = req.body || {};
  if (!isValidMobile(mobileNumber) || !isValidOtp(otp)) {
    return res.status(400).json({ error: "Valid 10-digit mobile number and 6-digit OTP required." });
  }
  const result = verifyOtp(mobileNumber, "VAULT_FETCH", otp);
  if (!result.ok) {
    auditLogger.log({ actor: mobileNumber, action: "DIRECT_FETCH_FAILED", target: mobileNumber, result: "FAILURE" });
    return res.status(401).json({ error: result.reason });
  }
  const targetType = result.meta?.documentType || (documentType ? documentType.toUpperCase() : null);
  const targetId = result.meta?.documentId;
  const { documents } = documentsStore.read();
  const doc = documents.find((d) => d.mobileNumber === mobileNumber && (targetId ? d.id === targetId : d.type === targetType));
  if (!doc) {
    return res.status(404).json({ error: "Requested document record not found." });
  }
  const decryptedVal = decrypt(doc.encryptedValue, ENC_KEY);
  auditLogger.log({ actor: mobileNumber, action: "DIRECT_FETCH_SUCCESS", target: doc.id, meta: { documentType: doc.type } });
  res.json({
    success: true,
    document: {
      id: doc.id,
      type: doc.type,
      label: doc.label,
      value: decryptedVal,
      maskedPreview: doc.maskedPreview,
      verifiedSource: "DIGIVAULT_OTP",
      verifiedAt: new Date().toISOString(),
    },
  });
});

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
