import mongoose from "mongoose";
import { assertIsolatedQaEnvironment } from "../utils/qaFixtureSafety.js";
import { loadQaEnvironment } from "../utils/qaEnvironment.js";
import {
  getQaFixtureStatus,
  readFixtureDefinitions,
  removeQaFixtures,
  seedQaFixtures,
} from "../services/qaFixtureService.js";

loadQaEnvironment();

const command = String(process.argv[2] || "status").toLowerCase();
if (!["status", "seed", "reset"].includes(command)) {
  throw new Error("Usage: node scripts/qa_fixtures.mjs <status|seed|reset>");
}

const safety = assertIsolatedQaEnvironment(process.env);
const definitions = readFixtureDefinitions(process.env);
await import("../config/firebase.js");
const { default: admin } = await import("firebase-admin");
if (!admin.apps.length) throw new Error("Firebase Auth Emulator initialization failed.");

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const auth = admin.auth();

let result;
if (command === "seed") {
  result = await seedQaFixtures({ db, auth, definitions });
} else if (command === "reset") {
  await removeQaFixtures({ db, auth, definitions });
  result = await seedQaFixtures({ db, auth, definitions });
} else {
  result = await getQaFixtureStatus({ db, auth, definitions });
}

console.log(JSON.stringify({
  command,
  environment: safety,
  result,
}, null, 2));
await mongoose.disconnect();
