import "dotenv/config";
import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidMobile, isValidAadhar } from "@govstack/shared";
import { recordsStore, requestsStore, auditLogger, deriveStatus, applyIfApproved } from "./store.js";
import { seed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (recordsStore.isEmpty("records")) seed();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/lookup/:mobileNumber", (req, res) => {
  const { mobileNumber } = req.params;
  if (!isValidMobile(mobileNumber)) return res.status(400).json({ error: "Invalid mobile number." });
  const { records } = recordsStore.read();
  const record = records.find((r) => r.mobileNumber === mobileNumber);
  if (!record) return res.status(404).json({ error: "No Aadhar record linked to this mobile number." });
  auditLogger.log({ actor: mobileNumber, action: "AADHAR_LOOKUP", target: record.aadharNumber });
  res.json(record);
});

app.get("/api/status/:aadharNumber", (req, res) => {
  const { aadharNumber } = req.params;
  if (!isValidAadhar(aadharNumber)) return res.status(400).json({ error: "Invalid Aadhar number." });
  const { requests } = requestsStore.read();
  const mine = requests.filter((r) => r.aadharNumber === aadharNumber);
  mine.forEach(applyIfApproved);
  const withStatus = mine.map((r) => ({ ...r, status: deriveStatus(r) }));
  res.json({ aadharNumber, requests: withStatus });
});

app.post("/api/update-request", (req, res) => {
  const { aadharNumber, field, newValue } = req.body || {};
  if (!isValidAadhar(aadharNumber)) return res.status(400).json({ error: "Invalid Aadhar number." });
  if (!["name", "address", "dob"].includes(field)) return res.status(400).json({ error: "field must be name, address or dob." });
  if (!newValue) return res.status(400).json({ error: "newValue is required." });
  const { records } = recordsStore.read();
  const record = records.find((r) => r.aadharNumber === aadharNumber);
  if (!record) return res.status(404).json({ error: "Aadhar number not found." });

  const request = {
    id: uuid(),
    aadharNumber,
    field,
    oldValue: record[field],
    newValue,
    status: "PENDING",
    applied: false,
    createdAt: new Date().toISOString(),
  };
  requestsStore.update((data) => data.requests.push(request));
  auditLogger.log({ actor: aadharNumber, action: "AADHAR_UPDATE_REQUESTED", target: field, meta: { requestId: request.id } });
  res.json({ requestId: request.id, status: "PENDING" });
});

app.post("/api/verify-aadhar", (req, res) => {
  const { aadharNumber, name, mobileNumber } = req.body || {};
  const { records } = recordsStore.read();
  
  const cleanInputAadhar = aadharNumber ? aadharNumber.replace(/\s/g, "") : null;
  
  const record = records.find((r) => {
    const cleanRecordAadhar = r.aadharNumber.replace(/\s/g, "");
    if (cleanInputAadhar) {
      return cleanRecordAadhar === cleanInputAadhar;
    }
    return mobileNumber && r.mobileNumber === mobileNumber;
  });

  if (!record) {
    return res.status(404).json({ verified: false, error: "UIDAI Verification Failed: Aadhar number not found in UIDAI central database." });
  }

  auditLogger.log({ actor: aadharNumber || mobileNumber, action: "UIDAI_EKYC_VERIFICATION", target: record.aadharNumber });

  res.json({
    verified: true,
    uidaiReference: `UIDAI-EKYC-${Date.now()}`,
    record: {
      aadharNumber: record.aadharNumber,
      name: record.name,
      dob: record.dob,
      address: record.address,
      gender: record.gender || "Female",
    },
    verificationSource: "UIDAI_CENTRAL_EKYC",
    verifiedAt: new Date().toISOString(),
  });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "portal-aadhar" }));

const PORT = process.env.PORT || 4101;
app.listen(PORT, () => console.log(`[portal-aadhar] listening on http://localhost:${PORT}`));
