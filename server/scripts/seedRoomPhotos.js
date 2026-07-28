/**
 * =============================================================================
 * ROOM PHOTO SEEDER
 * =============================================================================
 *
 * One-time migration: reads the real dormitory photos bundled as static web
 * assets, uploads them to Firebase Storage (room-photos/{roomId}/), and saves
 * the public URLs into each room's `images` field in MongoDB.
 *
 * This seeds ONLY rooms whose `images` array is currently empty — existing
 * photos are never overwritten.
 *
 * Usage (from the server/ directory):
 *   node --env-file=.env scripts/seedRoomPhotos.js
 *
 * Or from the project root:
 *   node --env-file=Capstone-Website/server/.env Capstone-Website/server/scripts/seedRoomPhotos.js
 */

import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import admin from "firebase-admin";

// ── Paths ──────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Web assets base relative to this script (server/scripts/ → web/src/assets/)
const ASSETS_BASE = path.resolve(
  __dirname,
  "../../web/src/assets/images/branches",
);

// ── Image map — same sources that RoomCard uses in Check Availability ──────
const IMAGE_MAP = {
  // Gil Puyat — Quadruple Sharing
  "gil-puyat:quadruple-sharing": [
    path.join(ASSETS_BASE, "gil-puyat", "Quadruple - GP", "Pic quad.jpg"),
    path.join(ASSETS_BASE, "gil-puyat", "Quadruple - GP", "Quad & double Common CR.jpg"),
    path.join(ASSETS_BASE, "gil-puyat", "Quadruple - GP", "Quad & double Common CR2.jpg"),
  ],
  // Gil Puyat — Double Sharing
  "gil-puyat:double-sharing": [
    path.join(ASSETS_BASE, "gil-puyat", "Double - GP", "Double sharing room1.jpg"),
    path.join(ASSETS_BASE, "gil-puyat", "Double - GP", "Quad & double Common CR.jpg"),
    path.join(ASSETS_BASE, "gil-puyat", "Double - GP", "Quad & double Common CR2.jpg"),
  ],
  // Gil Puyat — Private
  "gil-puyat:private": [
    path.join(ASSETS_BASE, "gil-puyat", "Private - GP", "private room copy.jpg"),
    path.join(ASSETS_BASE, "gil-puyat", "Private - GP", "Private Rm T&B.JPG"),
  ],
  // Guadalupe — all types are shared rooms
  "guadalupe:quadruple-sharing": [
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe shared room.jpg"),
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe shared room2.jpg"),
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe CR.JPG"),
  ],
  "guadalupe:double-sharing": [
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe shared room.jpg"),
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe shared room2.jpg"),
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe CR.JPG"),
  ],
  "guadalupe:private": [
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe shared room.jpg"),
    path.join(ASSETS_BASE, "guadalupe", "2d-viewing", "Guadalupe CR.JPG"),
  ],
};

function getImagePaths(branch, type) {
  const key = `${String(branch).toLowerCase()}:${String(type).toLowerCase()}`;
  return IMAGE_MAP[key] || IMAGE_MAP[`${String(branch).toLowerCase()}:quadruple-sharing`] || [];
}

// ── Firebase Admin ─────────────────────────────────────────────────────────
function initFirebase() {
  if (admin.apps.length) return;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
      universe_domain: "googleapis.com",
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

async function uploadFile(bucket, localPath, storagePath) {
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  const contentType = mimeMap[ext] || "image/jpeg";

  const fileRef = bucket.file(storagePath);
  await fileRef.save(buffer, { metadata: { contentType } });
  await fileRef.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  Room Photo Seeder starting…\n");

  // 1. Firebase
  initFirebase();
  const bucket = admin.storage().bucket();
  console.log(`✅  Firebase Storage bucket: ${bucket.name}`);

  // 2. MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`✅  MongoDB connected\n`);

  const Room = mongoose.model(
    "Room",
    new mongoose.Schema({}, { strict: false }),
    "rooms",
  );

  // 3. Fetch rooms with no images
  const rooms = await Room.find({
    $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
  }).lean();

  console.log(`📋  Found ${rooms.length} room(s) with no photos.\n`);

  if (rooms.length === 0) {
    console.log("✨  Nothing to seed — all rooms already have photos.");
    await mongoose.disconnect();
    process.exit(0);
  }

  let seeded = 0;
  let skipped = 0;
  let errors = 0;

  for (const room of rooms) {
    const roomId = String(room._id);
    const branch = String(room.branch || "").toLowerCase();
    const type = String(room.type || "").toLowerCase();
    const roomLabel = room.name || room.roomNumber || roomId;

    const localPaths = getImagePaths(branch, type);

    if (localPaths.length === 0) {
      console.warn(`  ⚠️  ${roomLabel} — no image mapping for branch="${branch}" type="${type}". Skipped.`);
      skipped++;
      continue;
    }

    // Filter to existing files
    const existingPaths = localPaths.filter((p) => fs.existsSync(p));
    if (existingPaths.length === 0) {
      console.warn(`  ⚠️  ${roomLabel} — source image files not found on disk. Skipped.`);
      skipped++;
      continue;
    }

    const urls = [];
    let roomOk = true;

    for (const localPath of existingPaths) {
      const filename = path.basename(localPath).replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `room-photos/${roomId}/${filename}`;
      try {
        const url = await uploadFile(bucket, localPath, storagePath);
        urls.push(url);
        process.stdout.write(`    ↑  ${filename}\n`);
      } catch (err) {
        console.error(`    ✗  Failed to upload ${filename}: ${err.message}`);
        roomOk = false;
      }
    }

    if (urls.length > 0) {
      await Room.updateOne({ _id: room._id }, { $set: { images: urls } });
      console.log(`  ✅  ${roomLabel} — saved ${urls.length} photo(s)\n`);
      seeded++;
    } else {
      console.error(`  ✗  ${roomLabel} — all uploads failed\n`);
      errors++;
    }
  }

  console.log("─────────────────────────────────────");
  console.log(`✅  Seeded:  ${seeded} rooms`);
  console.log(`⚠️  Skipped: ${skipped} rooms`);
  console.log(`✗   Errors:  ${errors} rooms`);

  await mongoose.disconnect();
  console.log("\n🎉  Done!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
