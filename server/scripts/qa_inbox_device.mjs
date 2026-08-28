import { spawnSync } from "node:child_process";
import { readFixtureDefinitions } from "../services/qaFixtureService.js";
import { loadQaEnvironment } from "../utils/qaEnvironment.js";

loadQaEnvironment();
const command = String(process.argv[2] || "").trim();
const fixtureName = String(process.argv[3] || "").trim().toUpperCase().replace(/_/g, "-");
const serial = String(process.env.QA_ADB_SERIAL || "").trim();
if (!serial) throw new Error("QA_ADB_SERIAL is required.");
const fixture = readFixtureDefinitions().find((entry) => entry.name === fixtureName);
if (!fixture) throw new Error("Use a known QA fixture name.");

function adb(args) {
  const result = spawnSync("adb", ["-s", serial, ...args], { stdio: "ignore", windowsHide: true });
  if (result.status !== 0) throw new Error("ADB action failed.");
}

async function mailboxToken() {
  const response = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: fixture.email, password: fixture.password }),
  });
  if (!response.ok) throw new Error(`QA inbox authentication failed (${response.status}).`);
  return (await response.json()).token;
}

async function newestMessage(token) {
  if (process.env.QA_LOCAL_INBOX_URL) {
    const response = await fetch(
      `${process.env.QA_LOCAL_INBOX_URL}/messages/latest?fixture=${encodeURIComponent(fixture.name)}`,
      { headers: { authorization: `Bearer ${process.env.QA_LOCAL_INBOX_TOKEN}` } },
    );
    if (!response.ok) throw new Error(`Local QA inbox lookup failed (${response.status}).`);
    return (await response.json()).message;
  }
  const response = await fetch("https://api.mail.tm/messages?page=1", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`QA inbox message lookup failed (${response.status}).`);
  const listing = await response.json();
  const id = listing["hydra:member"]?.[0]?.id;
  if (!id) return null;
  const detail = await fetch(`https://api.mail.tm/messages/${id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!detail.ok) throw new Error(`QA inbox message read failed (${detail.status}).`);
  return detail.json();
}

async function waitForValue(extract) {
  const token = process.env.QA_LOCAL_INBOX_URL ? null : await mailboxToken();
  const deadline = Date.now() + Number(process.env.QA_INBOX_WAIT_MS || 120000);
  while (Date.now() < deadline) {
    const message = await newestMessage(token);
    const value = message
      ? extract(`${JSON.stringify(message.variables || {})}\n${message.text || ""}\n${message.html || ""}`)
      : null;
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Timed out waiting for the controlled QA inbox message.");
}

if (command === "type-email") adb(["shell", "input", "text", fixture.email]);
else if (command === "type-password") adb(["shell", "input", "text", fixture.password]);
else if (command === "type-otp") {
  const otp = await waitForValue((body) => body.match(/\b\d{6}\b/)?.[0]);
  adb(["shell", "input", "text", otp]);
  console.log("Genuine QA inbox verification code entered on the authorized device (value not logged). ");
} else if (command === "open-reset") {
  const link = await waitForValue((body) => {
    const decoded = body.replace(/&amp;/g, "&");
    return decoded.match(/https?:\/\/[^\s"'<>]+/gi)
      ?.find((value) => value.includes("mode=resetPassword") || value.includes("/auth-action")) || null;
  });
  adb(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", link]);
  console.log("Genuine QA reset link opened on the authorized device (token not logged). ");
} else {
  throw new Error("Usage: qa_inbox_device.mjs <type-email|type-password|type-otp|open-reset> <QA fixture>");
}
