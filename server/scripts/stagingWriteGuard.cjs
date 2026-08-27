"use strict";

const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const text = (value) => String(value || "").trim();
const marker = /(?:^|[-_.])(staging|stage|qa|e2e|test|dev|local)(?:$|[-_.])/i;

function mongoDatabaseName(env) {
  if (text(env.DB_NAME)) return text(env.DB_NAME);
  try {
    return decodeURIComponent(new URL(text(env.MONGODB_URI || env.MONGO_URI || env.MONGO_URL)).pathname.replace(/^\/+/, "").split("/")[0] || "");
  } catch {
    return "";
  }
}

function assertStagingWriteTarget(env = process.env, { toolName = "write tool" } = {}) {
  const explicitEnvironment = text(env.LILYCREST_ENVIRONMENT || env.DEPLOYMENT_ENV || env.APP_ENV).toLowerCase();
  const deploymentEnvironment = explicitEnvironment || (text(env.NODE_ENV).toLowerCase() === "production" ? "production" : "development");
  const production = deploymentEnvironment === "production"
    || [env.PUBLIC_API_URL, env.API_PUBLIC_URL, env.PUBLIC_FRONTEND_URL, env.FRONTEND_URL]
      .some((value) => ["api.lilycrest.space", "www.lilycrest.space", "lilycrest.space"].includes((() => { try { return new URL(text(value)).hostname.toLowerCase(); } catch { return ""; } })()));
  const dbName = mongoDatabaseName(env);
  const firebaseLooksProduction = [env.FIREBASE_PROJECT_ID, env.FIREBASE_STORAGE_BUCKET]
    .some((value) => text(value) && !marker.test(text(value)));
  if (production || (dbName && !marker.test(dbName)) || firebaseLooksProduction) {
    const error = new Error(`Production target detected; ${toolName} aborted with no writes`);
    error.code = "PRODUCTION_TARGET_DETECTED";
    throw error;
  }
  const stagingHosts = [env.PUBLIC_API_URL, env.PUBLIC_FRONTEND_URL]
    .every((value) => { try { return marker.test(new URL(text(value)).hostname); } catch { return false; } });
  const stagingFirebase = [env.FIREBASE_PROJECT_ID, env.FIREBASE_STORAGE_BUCKET]
    .every((value) => marker.test(text(value)));
  if (deploymentEnvironment !== "staging" || text(env.STAGING_ALLOW_WRITES).toLowerCase() !== "true" || !marker.test(dbName) || !stagingHosts || !stagingFirebase) {
    const error = new Error(`Staging write guard blocked ${toolName} with no writes`);
    error.code = "STAGING_WRITE_BLOCKED";
    throw error;
  }
  return true;
}

module.exports = { assertStagingWriteTarget };
