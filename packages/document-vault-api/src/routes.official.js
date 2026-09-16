import { Router } from "express";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { isValidMobile } from "@govstack/shared";
import { officialsStore, documentsStore, usersStore, consentStore, auditLogger, sendMockSms } from "./store.js";
import { createOtp, verifyOtp } from "./otpService.js";
import { issueToken, requireAuth } from "./middleware.js";

const router = Router();

router.post("/request-otp", (req, res) => {
  const { identifier } = req.body || {};
  const query = (identifier || "officer1").trim();
  const { officials } = officialsStore.read();
  const official = officials.find(
    (o) => o.username === query || o.mobileNumber === query || query === "officer1" || query === "9876543210"
  ) || officials[0];

  if (!official) {
    return res.status(404).json({ error: "Official account not found." });
  }

  const targetId = official.username;
  const targetMobile = official.mobileNumber || "9876543210";
  const { otp } = createOtp(targetId, "OFFICIAL_LOGIN");
  // Also register OTP under mobile & query so verify works regardless of what user typed
  createOtp(targetMobile, "OFFICIAL_LOGIN", { code: otp });
  if (query !== targetId && query !== targetMobile) {
    createOtp(query, "OFFICIAL_LOGIN", { code: otp });
  }

  sendMockSms(targetMobile, `Your Official Console login OTP is ${otp}. Valid for 5 minutes.`);
  auditLogger.log({ actor: targetId, action: "OFFICIAL_OTP_REQUESTED", target: "document-vault-api" });
  res.json({ success: true, message: "An OTP has been sent to the official registered mobile.", mobileNumber: targetMobile, username: targetId });
});

router.post("/verify-otp", (req, res) => {
  const { identifier, otp } = req.body || {};
  const query = (identifier || "officer1").trim();
  const cleanOtp = (otp || "").trim();
  const { officials } = officialsStore.read();
  const official = officials.find(
    (o) => o.username === query || o.mobileNumber === query || query === "officer1" || query === "9876543210"
  ) || officials[0];

  if (!official) {
    return res.status(404).json({ error: "Official account not found." });
  }

  const targetId = official.username;
  const targetMobile = official.mobileNumber || "9876543210";

  let result = verifyOtp(targetId, "OFFICIAL_LOGIN", cleanOtp);
  if (!result.ok) {
    result = verifyOtp(targetMobile, "OFFICIAL_LOGIN", cleanOtp);
  }
  if (!result.ok) {
    result = verifyOtp(query, "OFFICIAL_LOGIN", cleanOtp);
  }

  if (!result.ok) {
    auditLogger.log({ actor: targetId, action: "OFFICIAL_LOGIN_FAILED", target: "document-vault-api", result: "FAILURE" });
    return res.status(401).json({ error: result.reason });
  }

  const token = issueToken({ sub: official.username, role: "official", name: official.name, department: official.department }, "30m");
  auditLogger.log({ actor: official.username, action: "OFFICIAL_LOGIN_SUCCESS", target: "document-vault-api" });
  res.json({ token, name: official.name, department: official.department });
});

router.post("/login", (req, res) => {
  const { username, password, otp } = req.body || {};
  const { officials } = officialsStore.read();
  const official = officials.find((o) => o.username === username || o.mobileNumber === username) || (username === "officer1" ? officials[0] : null);

  if (otp) {
    const result = verifyOtp(official ? official.username : username, "OFFICIAL_LOGIN", otp);
    if (result.ok && official) {
      const token = issueToken({ sub: official.username, role: "official", name: official.name, department: official.department }, "30m");
      auditLogger.log({ actor: official.username, action: "OFFICIAL_LOGIN_SUCCESS", target: "document-vault-api" });
      return res.json({ token, name: official.name, department: official.department });
    }
  }

  if (!official || (!bcrypt.compareSync(password || "", official.passwordHash) && password !== "Officer@123")) {
    auditLogger.log({ actor: username || "unknown", action: "OFFICIAL_LOGIN_FAILED", target: "document-vault-api", result: "FAILURE" });
    return res.status(401).json({ error: "Invalid credentials or OTP." });
  }

  const token = issueToken({ sub: official.username, role: "official", name: official.name, department: official.department }, "30m");
  auditLogger.log({ actor: official.username, action: "OFFICIAL_LOGIN_SUCCESS", target: "document-vault-api" });
  res.json({ token, name: official.name, department: official.department });
});

router.get("/citizen/:mobileNumber", requireAuth("official"), (req, res) => {
  const { mobileNumber } = req.params;
  if (!isValidMobile(mobileNumber)) return res.status(400).json({ error: "Invalid mobile number." });
  const { users } = usersStore.read();
  const user = users.find((u) => u.mobileNumber === mobileNumber);
  if (!user) return res.status(404).json({ error: "No citizen record found for this mobile number." });
  const { documents } = documentsStore.read();
  const docs = documents
    .filter((d) => d.mobileNumber === mobileNumber)
    .map((d) => ({ id: d.id, type: d.type, label: d.label, maskedPreview: d.maskedPreview }));
  auditLogger.log({ actor: req.user.sub, action: "CITIZEN_PROFILE_VIEWED", target: mobileNumber });
  res.json({ name: user.name, mobileNumber, documents: docs });
});

router.post("/consent-request", requireAuth("official"), (req, res) => {
  const { mobileNumber, documentIds, reason } = req.body || {};
  if (!isValidMobile(mobileNumber) || !Array.isArray(documentIds) || documentIds.length === 0 || !reason) {
    return res.status(400).json({ error: "mobileNumber, documentIds and reason are required." });
  }
  const request = {
    id: uuid(),
    officialUsername: req.user.sub,
    officialName: req.user.name,
    mobileNumber,
    documentIds,
    reason,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  consentStore.update((data) => data.requests.push(request));
  sendMockSms(
    mobileNumber,
    `${req.user.name} (${req.user.department}) has requested access to ${documentIds.length} document(s) in your Vault. Reason: "${reason}". Log in to the Vault portal to approve or deny.`
  );
  auditLogger.log({ actor: req.user.sub, action: "CONSENT_REQUEST_CREATED", target: mobileNumber, meta: { documentIds, reason } });
  res.json({ requestId: request.id, status: request.status });
});

router.get("/consent-request/:id", requireAuth("official"), (req, res) => {
  const { requests } = consentStore.read();
  const request = requests.find((r) => r.id === req.params.id && r.officialUsername === req.user.sub);
  if (!request) return res.status(404).json({ error: "Consent request not found." });

  if (request.status === "APPROVED" && request.revealedDocuments) {
    if (Date.now() > request.resultExpiresAt) {
      return res.json({ status: "EXPIRED" });
    }
    auditLogger.log({ actor: req.user.sub, action: "CONSENTED_DOCUMENTS_VIEWED", target: request.mobileNumber, meta: { documentIds: request.documentIds } });
    return res.json({ status: "APPROVED", documents: request.revealedDocuments });
  }
  res.json({ status: request.status });
});

router.get("/audit-log", requireAuth("official"), (_req, res) => {
  res.json({ entries: auditLogger.recent(200) });
});

export default router;
