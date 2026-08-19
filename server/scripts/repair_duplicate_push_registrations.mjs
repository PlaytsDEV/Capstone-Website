import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const isWrite = process.argv.includes("--write");
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

function hash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function normalizedEntry(entry, fallback = {}) {
  if (typeof entry === "string") {
    return { token: entry.trim(), provider: null, platform: null, device_id: null, enabled: true, updated_at: null, last_seen_at: null };
  }
  if (!entry || typeof entry !== "object") return null;
  const token = String(entry.token || entry.push_token || "").trim();
  if (!token) return null;
  return {
    token,
    provider: entry.provider || fallback.provider || null,
    platform: entry.platform || entry.device_platform || fallback.platform || null,
    device_id: entry.device_id || null,
    enabled: entry.enabled !== false,
    updated_at: entry.updated_at || fallback.updated_at || null,
    last_seen_at: entry.last_seen_at || entry.updated_at || fallback.updated_at || null,
  };
}

function entryTime(entry) {
  const value = new Date(entry.last_seen_at || entry.updated_at || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function uniqueEntries(user) {
  const entries = (user.push_tokens || []).map((entry) => normalizedEntry(entry)).filter(Boolean);
  if (user.push_token) {
    entries.push(normalizedEntry({
      token: user.push_token,
      provider: user.push_provider,
      platform: user.push_platform,
      updated_at: user.push_token_updated,
      enabled: true,
    }));
  }
  const byToken = new Map();
  for (const entry of entries) {
    const current = byToken.get(entry.token);
    if (!current || entryTime(entry) >= entryTime(current)) byToken.set(entry.token, entry);
  }
  return [...byToken.values()];
}

async function main() {
  if (!mongoUri) throw new Error("MONGODB_URI is not configured");
  await mongoose.connect(mongoUri, process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {});
  const usersCollection = mongoose.connection.db.collection("users");
  const users = await usersCollection.find({
    $or: [
      { push_token: { $exists: true, $nin: [null, ""] } },
      { "push_tokens.0": { $exists: true } },
    ],
  }, { projection: { user_id: 1, push_token: 1, push_provider: 1, push_platform: 1, push_token_updated: 1, push_tokens: 1 } }).toArray();

  const states = users.map((user) => ({ user, entries: uniqueEntries(user) }));
  const ownersByToken = new Map();
  for (const state of states) {
    for (const entry of state.entries.filter((item) => item.enabled)) {
      const owner = ownersByToken.get(entry.token);
      if (!owner || entryTime(entry) > entryTime(owner.entry)) {
        ownersByToken.set(entry.token, { userId: String(state.user._id), entry });
      }
    }
  }

  const report = [];
  for (const state of states) {
    let disabledCrossAccount = 0;
    let disabledLegacyRefreshes = 0;

    for (const entry of state.entries) {
      const owner = ownersByToken.get(entry.token);
      if (entry.enabled && owner && owner.userId !== String(state.user._id)) {
        entry.enabled = false;
        disabledCrossAccount += 1;
      }
    }

    const activeLegacyGroups = new Map();
    for (const entry of state.entries.filter((item) => item.enabled && !item.device_id)) {
      const group = String(entry.platform || "unknown").toLowerCase();
      if (!activeLegacyGroups.has(group)) activeLegacyGroups.set(group, []);
      activeLegacyGroups.get(group).push(entry);
    }
    for (const entries of activeLegacyGroups.values()) {
      // Two tokens can represent two real pre-upgrade devices. Three or more
      // on one platform is the historical refresh-append defect this repair
      // targets; keep only the most recently seen registration.
      if (entries.length < 3) continue;
      entries.sort((left, right) => entryTime(right) - entryTime(left));
      for (const stale of entries.slice(1)) {
        stale.enabled = false;
        disabledLegacyRefreshes += 1;
      }
    }

    const active = state.entries
      .filter((entry) => entry.enabled)
      .sort((left, right) => entryTime(right) - entryTime(left));
    const changed = disabledCrossAccount > 0 || disabledLegacyRefreshes > 0;
    if (changed) {
      report.push({
        user: hash(state.user.user_id || state.user._id),
        activeBefore: uniqueEntries(state.user).filter((entry) => entry.enabled).length,
        activeAfter: active.length,
        disabledCrossAccount,
        disabledLegacyRefreshes,
        retainedTokenHashes: active.map((entry) => hash(entry.token)),
      });
    }

    if (isWrite && changed) {
      const latest = active[0] || null;
      await usersCollection.updateOne(
        { _id: state.user._id },
        {
          $set: {
            push_tokens: state.entries,
            push_token: latest?.token || null,
            push_provider: latest?.provider || null,
            push_platform: latest?.platform || null,
            push_token_updated: new Date(),
          },
        },
      );
    }
  }

  console.log(JSON.stringify({
    mode: isWrite ? "write" : "dry-run",
    usersScanned: users.length,
    usersChanged: report.length,
    activeRegistrationsDisabled: report.reduce((sum, item) => sum + item.disabledCrossAccount + item.disabledLegacyRefreshes, 0),
    report,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[repair-duplicate-push-registrations] ERROR:", error.message || String(error));
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
