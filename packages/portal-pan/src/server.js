import "dotenv/config";
import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isValidMobile, isValidPan } from "@govstack/shared";
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
  if (!record) return res.status(404).json({ error: "No PAN record linked to this mobile number." });
  auditLogger.log({ actor: mobileNumber, action: "PAN_LOOKUP", target: record.panNumber });
  res.json(record);
});

app.get("/api/status/:panNumber", (req, res) => {
  const panNumber = (req.params.panNumber || "").toUpperCase();
  if (!isValidPan(panNumber)) return res.status(400).json({ error: "Invalid PAN number." });
  const { requests } = requestsStore.read();
  const mine = requests.filter((r) => r.panNumber === panNumber);
  mine.forEach(applyIfApproved);
  const withStatus = mine.map((r) => ({ ...r, status: deriveStatus(r) }));
  res.json({ panNumber, requests: withStatus });
});

app.post("/api/update-request", (req, res) => {
  const panNumber = (req.body?.panNumber || "").toUpperCase();
  const { field, newValue } = req.body || {};
  if (!isValidPan(panNumber)) return res.status(400).json({ error: "Invalid PAN number." });
  if (!["name", "address", "dob"].includes(field)) return res.status(400).json({ error: "field must be name, address or dob." });
  if (!newValue) return res.status(400).json({ error: "newValue is required." });
  const { records } = recordsStore.read();
  const record = records.find((r) => r.panNumber === panNumber);
  if (!record) return res.status(404).json({ error: "PAN number not found." });

  const request = {
    id: uuid(),
    panNumber,
    field,
    oldValue: record[field],
    newValue,
    status: "PENDING",
    applied: false,
    createdAt: new Date().toISOString(),
  };
  requestsStore.update((data) => data.requests.push(request));
  auditLogger.log({ actor: panNumber, action: "PAN_UPDATE_REQUESTED", target: field, meta: { requestId: request.id } });
  res.json({ requestId: request.id, status: "PENDING" });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "portal-pan" }));

const PORT = process.env.PORT || 4102;
app.listen(PORT, () => console.log(`[portal-pan] listening on http://localhost:${PORT}`));
