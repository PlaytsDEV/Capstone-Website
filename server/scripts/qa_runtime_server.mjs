import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { assertIsolatedQaEnvironment } from "../utils/qaFixtureSafety.js";
import { loadQaEnvironment } from "../utils/qaEnvironment.js";

loadQaEnvironment();
const safety = assertIsolatedQaEnvironment(process.env);

await import("../config/firebase.js");
const { default: admin } = await import("firebase-admin");
if (!admin.apps.length) throw new Error("Firebase Auth Emulator initialization failed.");

await mongoose.connect(process.env.MONGODB_URI);

const [
  { default: mobileAuthRoutes },
  { default: mobileBillingRoutes },
  { default: mobilePaymongoRoutes },
  { default: mobileRoutes },
] = await Promise.all([
  import("../routes/mobileAuthRoutes.js"),
  import("../routes/mobileBillingRoutes.js"),
  import("../routes/mobilePaymongoRoutes.js"),
  import("../mobile/mobileRoutes.mjs"),
]);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.get("/api/health", (_req, res) => res.json({
  success: true,
  data: {
    status: "healthy",
    environment: "isolated-local-qa",
    firebaseProject: safety.firebaseProjectId,
    mongoDatabase: safety.mongoDatabase,
    paymongoMode: safety.paymongoMode,
  },
}));
app.get("/api/m/health", (_req, res) => res.json({ status: "ok", environment: "isolated-local-qa" }));
app.use("/api/m", mobileBillingRoutes);
app.use("/api/m", mobilePaymongoRoutes);
app.use("/api/m", mobileAuthRoutes);
app.use("/api/m", mobileRoutes);
app.use((error, _req, res, _next) => {
  console.error("[qa-runtime] request failed:", error?.message || "unknown error");
  res.status(500).json({ detail: "Isolated QA runtime request failed." });
});

const port = Number(process.env.PORT || 5001);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Isolated QA runtime listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
