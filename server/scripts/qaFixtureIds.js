import crypto from "node:crypto";
import mongoose from "mongoose";

export const normalizeQaRunId = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^qa-[a-z0-9][a-z0-9-]{2,48}$/.test(normalized)) {
    throw new Error("QA_RUN_ID must match qa-<letters/numbers/hyphens> and be at most 51 characters.");
  }
  return normalized;
};

export const stableObjectId = (runId, key) => new mongoose.Types.ObjectId(
  crypto.createHash("sha256").update(`${runId}:${key}`).digest("hex").slice(0, 24),
);

export const qaMetadata = (runId, key) => ({
  qa_fixture: true,
  qa_run_id: runId,
  qa_fixture_key: key,
});
