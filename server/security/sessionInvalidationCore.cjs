async function invalidateUserSessionsCore({ db, adminAuth, userId, mongoId, firebaseUid, reason, audit, failClosed = true }) {
  const failures = [];
  let securityVersion = null;
  if (userId) {
    try {
      const result = await db.collection('users').findOneAndUpdate(
        { user_id: userId }, { $inc: { securityVersion: 1 }, $set: { authInvalidatedAt: new Date() } }, { returnDocument: 'after' },
      );
      const user = result?.value || result;
      securityVersion = Number(user?.securityVersion ?? 0);
    } catch (error) { failures.push({ store: 'securityVersion', error }); }
  }
  if (firebaseUid && adminAuth) {
    try { await adminAuth.revokeRefreshTokens(firebaseUid); } catch (error) { failures.push({ store: 'firebase', error }); }
  }
  if (mongoId) {
    try {
      await db.collection('usersessions').updateMany(
        { userId: mongoId, isActive: true }, { $set: { isActive: false, logoutTime: new Date() } },
      );
    } catch (error) { failures.push({ store: 'web', error }); }
  }
  if (userId) {
    try { await db.collection('user_sessions').deleteMany({ user_id: userId }); }
    catch (error) { failures.push({ store: 'mobile', error }); }
  }
  try { if (audit) await audit({ userId, mongoId, reason, failures: failures.map((f) => f.store) }); }
  catch (error) { failures.push({ store: 'audit', error }); }
  if (failClosed && failures.some((f) => f.store === 'securityVersion')) {
    const error = new Error('Unable to establish logical session revocation');
    error.code = 'SESSION_INVALIDATION_FAILED'; error.failures = failures; throw error;
  }
  return { securityVersion, failures };
}
module.exports = { invalidateUserSessionsCore };
