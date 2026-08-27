#!/usr/bin/env node
import { loadEnv } from "vite";
import {
  validateWebFirebaseEnvironment,
  validateWebServiceEnvironment,
} from "../src/shared/config/environment.js";

const mode = String(process.argv[2] || "").trim().toLowerCase();
if (!["staging", "production"].includes(mode)) {
  console.error("Web environment verification requires staging or production.");
  process.exit(1);
}

const fileEnv = loadEnv(mode, process.cwd(), "");
const env = { ...fileEnv, ...process.env };
const deployment = String(env.VITE_DEPLOYMENT_ENV || "").trim().toLowerCase();
const failures = [];
if (deployment !== mode) failures.push(`VITE_DEPLOYMENT_ENV must equal ${mode}`);

try {
  validateWebServiceEnvironment({
    environment: deployment,
    apiUrl: env.VITE_API_URL,
    socketUrl: env.VITE_SOCKET_URL,
    appUrl: env.VITE_APP_URL,
  });
} catch (error) {
  failures.push(error.message);
}

for (const name of [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
]) {
  if (!String(env[name] || "").trim()) failures.push(`${name} is required`);
}

try {
  validateWebFirebaseEnvironment({
    environment: deployment,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: env.VITE_FIREBASE_APP_ID,
  });
} catch (error) {
  failures.push(error.message);
}

if (failures.length) {
  console.error(`Web ${mode} environment verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Web ${mode} environment verified for ${env.VITE_API_URL}.`);
