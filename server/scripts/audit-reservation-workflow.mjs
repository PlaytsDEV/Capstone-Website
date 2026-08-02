#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import dotenv from "dotenv";
import { assertReportOnlyArgs, analyzeAuditDataset } from "./reservation-phase-0/audit-core.mjs";
import { closeSafetyConnection, establishReadOnlySafety, loadAuditDataset } from "./reservation-phase-0/read-only-source.mjs";
import { writeReports } from "./reservation-phase-0/report-writer.mjs";
import { inspectStatusDefinitions } from "./reservation-phase-0/status-definitions.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(scriptDirectory, "..");
const repositoryDirectory = path.resolve(serverDirectory, "..");
const outputDirectory = path.join(serverDirectory, "audit-output", "reservation-phase-0");

dotenv.config({ path: path.join(serverDirectory, ".env"), quiet: true });

const git = (...args) => execFileSync("git", args, { cwd: repositoryDirectory, encoding: "utf8" }).trim();
const npmVersion = String(process.env.npm_config_user_agent || "").match(/npm\/(\S+)/)?.[1] || "unknown";
const repository = {
  branch: git("branch", "--show-current"),
  commit: git("rev-parse", "HEAD"),
  workingTreeAtAudit: git("status", "--porcelain") ? "dirty (Phase 0 implementation changes present)" : "clean",
  nodeVersion: process.version,
  npmVersion,
};

let safety;
try {
  const options = assertReportOnlyArgs(process.argv.slice(2));
  const explicitlyAuthorized = String(process.env.RESERVATION_AUDIT_READ_ONLY_AUTHORIZED || "").toLowerCase() === "true";
  safety = await establishReadOnlySafety({ uri: process.env.MONGODB_URI, environmentName: process.env.NODE_ENV, explicitlyAuthorized });
  safety.explicitlyAuthorized = explicitlyAuthorized;
  let result = null;
  if (safety.safe && !options.metadataOnly) result = analyzeAuditDataset(await loadAuditDataset(safety), { now: new Date() });
  const summary = await writeReports({ outputDirectory, safety, result, repository, statusDefinitions: inspectStatusDefinitions() });
  console.log(JSON.stringify({ verdict: summary.verdict, outputDirectory, recordLevelQueriesExecuted: summary.environment.recordLevelQueriesExecuted }, null, 2));
  if (!result) process.exitCode = 2;
} catch (error) {
  console.error(`Reservation Phase 0 audit stopped safely: ${error.message}`);
  process.exitCode = 2;
} finally {
  await closeSafetyConnection(safety);
}
