const crypto = require('crypto');

function generateSessionToken() {
  return `session_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function createSession(db, userId) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const owner = await db.collection('users').findOne(
    { user_id: userId },
    { projection: { securityVersion: 1, security_version: 1 } },
  );
  const securityVersion = Number(owner?.securityVersion ?? owner?.security_version ?? 0);
  if (!Number.isSafeInteger(securityVersion) || securityVersion < 0) {
    throw new Error('Invalid account security version');
  }
  await db.collection('user_sessions').deleteMany({ user_id: userId });
  await db.collection('user_sessions').insertOne({
    user_id: userId,
    session_token: token,
    security_version: securityVersion,
    expires_at: expiresAt,
    created_at: new Date(),
  });
  return { session_token: token, expires_at: expiresAt };
}

module.exports = { createSession };
