import "dotenv/config";
import express from "express";
import cors from "cors";
import { initMcpClients, closeAllMcpClients } from "./mcpClients.js";
import { handleMessage } from "./dialog.js";
import { getSession } from "./session.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { sessionId, mobileNumber, message } = req.body || {};
  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId and message are required." });
  }
  const session = getSession(sessionId);
  session.history.push({ role: "user", text: message, at: new Date().toISOString() });
  try {
    const reply = await handleMessage(sessionId, mobileNumber, message);
    session.history.push({ role: "bot", text: reply, at: new Date().toISOString() });
    res.json({ reply, mobileNumber: session.mobileNumber });
  } catch (err) {
    console.error("[chatbot-api] Unexpected error handling message:", err);
    res.status(500).json({ error: "Something went wrong while processing your request. Please try again." });
  }
});

app.get("/api/chat/history/:sessionId", (req, res) => {
  res.json({ history: getSession(req.params.sessionId).history });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "chatbot-api" }));

const PORT = process.env.PORT || 4200;

initMcpClients()
  .then(() => {
    app.listen(PORT, () => console.log(`[chatbot-api] listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("[chatbot-api] Failed to initialize MCP clients:", err);
    process.exit(1);
  });

process.on("SIGINT", async () => {
  await closeAllMcpClients();
  process.exit(0);
});
