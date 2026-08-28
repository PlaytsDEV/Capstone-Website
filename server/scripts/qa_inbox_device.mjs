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

function adbCapture(args) {
  const result = spawnSync("adb", ["-s", serial, ...args], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("ADB inspection failed.");
  return result.stdout;
}

function verifyVisibleValue(value, label) {
  const remoteHierarchy = "/sdcard/qa-window.xml";
  try {
    adb(["shell", "uiautomator", "dump", remoteHierarchy]);
    const hierarchy = adbCapture(["exec-out", "cat", remoteHierarchy]);
    if (!hierarchy.includes(`text="${value}"`)) throw new Error(`Device ${label} does not match the requested QA fixture.`);
    console.log(`Exact synthetic fixture ${label} verified on device; value not logged.`);
  } finally {
    adb(["shell", "rm", "-f", remoteHierarchy]);
  }
}

async function typeEmail(value) {
  const specialKeycodes = { ".": 56, "@": 77, "-": 69, "+": 81 };
  for (const character of value.toLowerCase()) {
    let keycode;
    if (character >= "a" && character <= "z") keycode = 29 + character.charCodeAt(0) - 97;
    else if (character >= "0" && character <= "9") keycode = 7 + Number(character);
    else keycode = specialKeycodes[character];
    if (keycode === undefined) throw new Error("QA fixture email contains an unsupported input character.");
    adb(["shell", "input", "keyevent", String(keycode)]);
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
}

async function typePassword(value) {
  for (const character of value) {
    let keycode;
    let shifted = false;
    if (character >= "a" && character <= "z") keycode = 29 + character.charCodeAt(0) - 97;
    else if (character >= "A" && character <= "Z") {
      keycode = 29 + character.charCodeAt(0) - 65;
      shifted = true;
    } else if (character >= "0" && character <= "9") keycode = 7 + Number(character);
    else if (character === "!") {
      keycode = 8;
      shifted = true;
    } else throw new Error("QA fixture password contains an unsupported input character.");
    adb(["shell", "input", shifted ? "keycombination" : "keyevent", ...(shifted ? ["59"] : []), String(keycode)]);
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
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

if (command === "type-email") await typeEmail(fixture.email);
else if (command === "type-password") await typePassword(fixture.password);
else if (command === "verify-email") verifyVisibleValue(fixture.email, "email");
else if (command === "verify-password-visible") verifyVisibleValue(fixture.password, "password");
else if (command === "type-otp") {
  const otp = await waitForValue((body) => body.match(/\b\d{6}\b/)?.[0]);
  // The mobile OTP screen uses six one-character inputs and advances focus
  // after each key. Sending the whole code as one text event can leave only
  // the first box populated on physical Android devices, so enter digit key
  // events individually without ever printing the value.
  for (const digit of otp) {
    adb(["shell", "input", "keyevent", String(7 + Number(digit))]);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
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
  throw new Error("Usage: qa_inbox_device.mjs <type-email|type-password|verify-email|verify-password-visible|type-otp|open-reset> <QA fixture>");
}
