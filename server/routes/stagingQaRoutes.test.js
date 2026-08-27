import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, "stagingQaRoutes.js"), "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

describe("staging QA notification route contract", () => {
  test("is mounted only in the explicit staging environment", () => {
    expect(serverSource).toContain('deploymentEnvironment(process.env) === "staging"');
    expect(serverSource).toContain('app.use("/api/qa", stagingQaRoutes)');
  });

  test("requires normal admin authentication plus the dedicated QA allowlist", () => {
    expect(source).toContain("verifyToken, verifyAdmin, requireStagingQaAdmin");
    expect(source).toContain("STAGING_QA_ADMIN_EMAILS");
    expect(source).toContain("qa_fixture: true");
    expect(source).toContain("qa_run_id: qaRunId");
  });

  test("reuses all five production notification payload producers", () => {
    for (const producer of [
      "sendMobilePushAnnouncement",
      "notify.billingNotice",
      "notify.contractDocumentReady",
      "notify.maintenanceUpdated",
      "notify.adminReply",
    ]) expect(source).toContain(producer);
  });
});
