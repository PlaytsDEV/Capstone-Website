import crypto from "crypto";

export const uidFingerprint = (uid) =>
  crypto.createHash("sha256").update(String(uid || "")).digest("hex").slice(0, 12);

export const resolveProvisioningIdentity = async ({ email, auth, findMongoUser }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("PROVISIONING_EMAIL_REQUIRED");

  let firebaseUser = null;
  try {
    firebaseUser = await auth.getUserByEmail(normalizedEmail);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }

  const mongoUser = await findMongoUser(normalizedEmail);
  if (firebaseUser && mongoUser && mongoUser.firebaseUid !== firebaseUser.uid) {
    throw new Error("IDENTITY_CONFLICT: Firebase and MongoDB identities differ; no account was changed");
  }
  if (!firebaseUser && mongoUser) {
    throw new Error("IDENTITY_CONFLICT: MongoDB profile has no matching Firebase identity; no account was changed");
  }

  return { normalizedEmail, firebaseUser, mongoUser };
};
