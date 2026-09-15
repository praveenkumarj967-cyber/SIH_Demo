import "dotenv/config";
import express from "express";
import cors from "cors";
import { usersStore } from "./store.js";
import { seed } from "./seed.js";
import authRoutes from "./routes.auth.js";
import documentRoutes from "./routes.documents.js";
import officialRoutes from "./routes.official.js";
import devRoutes from "./routes.dev.js";

if (usersStore.isEmpty("users")) {
  seed();
}

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/official", officialRoutes);
app.use("/api/dev", devRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "document-vault-api" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[document-vault-api] listening on http://localhost:${PORT}`);
});
