import fs from "fs";
import admin from "firebase-admin";
import {
  removePrivateContractFile,
  resolvePrivateContractStorageKey,
  writePrivateContractAtomically,
  removeContractArtifactFile,
  resolveContractArtifactStorageKey,
  writeContractArtifactAtomically,
} from "./contractPrivateStorageService.js";

const storageError = (message, code, statusCode = 500, details) =>
  Object.assign(new Error(message), { code, statusCode, ...(details ? { details } : {}) });

const bucketCandidates = () => {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  return [...new Set([
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.GCLOUD_STORAGE_BUCKET,
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
    projectId ? `${projectId}.firebasestorage.app` : "",
    projectId ? `${projectId}.appspot.com` : "",
  ].map((value) => String(value || "").trim()).filter(Boolean))];
};

const useLocalStorage = () => {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CONTRACT_DOCUMENT_STORAGE === "local"
    || process.env.NODE_ENV === "test"
    || !admin.apps.length;
};

const findFirebaseFile = async (storageKey, requireExisting = false) => {
  if (!admin.apps.length) {
    if (requireExisting) {
      throw storageError(
        "Persistent Contract document storage is not configured.",
        "CONTRACT_STORAGE_NOT_CONFIGURED",
        503,
      );
    }
    return null;
  }
  for (const bucketName of bucketCandidates()) {
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(storageKey);
    if (!requireExisting || (await file.exists())[0]) return { bucket, file };
  }
  return null;
};

export const storePreparedContractDocument = async ({
  target,
  bytes,
  metadata = {},
}) => {
  if (useLocalStorage()) {
    await writePrivateContractAtomically(target, bytes);
    return { provider: "local", storageKey: target.storageKey };
  }

  const destination = await findFirebaseFile(target.storageKey);
  if (!destination) {
    throw storageError(
      "Persistent Contract document storage is not configured.",
      "CONTRACT_STORAGE_NOT_CONFIGURED",
      503,
    );
  }
  await destination.file.save(bytes, {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      contentType: "application/pdf",
      cacheControl: "private, no-store",
      metadata: Object.fromEntries(
        Object.entries(metadata)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, String(value)]),
      ),
    },
  });
  return {
    provider: "firebase-storage",
    storageKey: target.storageKey,
    bucket: destination.bucket.name,
  };
};

export const inspectPreparedContractDocument = async (document) => {
  const provider = document?.storageProvider || "local";
  const storageKey = String(document?.storageKey || "");
  if (!storageKey) {
    throw storageError(
      "Prepared Contract metadata has no storage key.",
      "PREPARED_DOCUMENT_METADATA_INVALID",
      410,
    );
  }

  if (provider === "firebase-storage") {
    try {
      const destination = await findFirebaseFile(storageKey, true);
      if (destination) {
        const [metadata] = await destination.file.getMetadata();
        return {
          provider: "firebase-storage",
          storageKey,
          size: Number(metadata.size || 0),
          createReadStream: () => destination.file.createReadStream(),
        };
      }
    } catch (firebaseErr) {
      if (firebaseErr.code !== "CONTRACT_STORAGE_NOT_CONFIGURED" && firebaseErr.statusCode !== 503) {
        // Fall through to local fallback
      }
    }

    // Fallback: check if file exists locally on disk
    let localPath;
    try {
      localPath = resolvePrivateContractStorageKey(storageKey);
      const stat = await fs.promises.stat(localPath).catch(() => null);
      if (stat?.isFile()) {
        return {
          provider: "local",
          storageKey,
          size: stat.size,
          absolutePath: localPath,
          createReadStream: () => fs.createReadStream(localPath),
        };
      }
    } catch {
      // Ignore local resolution failure
    }

    throw storageError(
      "The prepared Contract file is missing from persistent storage.",
      "PREPARED_DOCUMENT_STORAGE_MISSING",
      410,
    );
  }

  let absolutePath;
  try {
    absolutePath = resolvePrivateContractStorageKey(storageKey);
  } catch {
    throw storageError(
      "Prepared Contract metadata contains an invalid storage key.",
      "PREPARED_DOCUMENT_METADATA_INVALID",
      410,
    );
  }
  const stat = await fs.promises.stat(absolutePath).catch(() => null);
  if (stat?.isFile()) {
    return {
      provider: "local",
      storageKey,
      size: stat.size,
      absolutePath,
      createReadStream: () => fs.createReadStream(absolutePath),
    };
  }

  // Fallback: check if file exists in Firebase Storage
  if (admin.apps.length) {
    try {
      const destination = await findFirebaseFile(storageKey, true);
      if (destination) {
        const [metadata] = await destination.file.getMetadata();
        return {
          provider: "firebase-storage",
          storageKey,
          size: Number(metadata.size || 0),
          createReadStream: () => destination.file.createReadStream(),
        };
      }
    } catch {
      // Ignore Firebase fallback error
    }
  }

  throw storageError(
    "The prepared Contract file is missing from storage.",
    "PREPARED_DOCUMENT_STORAGE_MISSING",
    410,
  );
};

export const removePreparedContractDocument = async (document) => {
  if (!document?.storageKey) return;
  if (document.storageProvider === "firebase-storage") {
    const destination = await findFirebaseFile(document.storageKey);
    if (destination) await destination.file.delete({ ignoreNotFound: true });
    return;
  }
  await removePrivateContractFile(
    resolvePrivateContractStorageKey(document.storageKey),
  );
};

// ============================================================================
// Generic "signed" / "notarized" contract-artifact storage.
//
// Same durable-vs-local behavior as the Prepared functions above
// (useLocalStorage() decides production-Firebase vs local disk), same
// storageProvider-tagged legacy-read fallback shape (inspectContractArtifact
// mirrors inspectPreparedContractDocument's dual-check), parameterized by
// `kind` ("signed" | "notarized") instead of being hardcoded to Prepared's
// paths/naming. Kept separate from storePreparedContractDocument /
// inspectPreparedContractDocument / removePreparedContractDocument (which
// still exist above, unchanged) so the already-covered Draft/Prepared path
// is never touched by this migration.
// ============================================================================

export const storeContractArtifact = async ({ kind, target, bytes, contentType, metadata = {} }) => {
  if (useLocalStorage()) {
    await writeContractArtifactAtomically(target, bytes);
    return { provider: "local", storageKey: target.storageKey };
  }

  const destination = await findFirebaseFile(target.storageKey);
  if (!destination) {
    throw storageError(
      "Persistent Contract document storage is not configured.",
      "CONTRACT_STORAGE_NOT_CONFIGURED",
      503,
    );
  }
  await destination.file.save(bytes, {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      contentType,
      cacheControl: "private, no-store",
      metadata: Object.fromEntries(
        Object.entries(metadata)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, String(value)]),
      ),
    },
  });
  return {
    provider: "firebase-storage",
    storageKey: target.storageKey,
    bucket: destination.bucket.name,
  };
};

export const inspectContractArtifact = async ({ kind, document }) => {
  const provider = document?.storageProvider || "local";
  const storageKey = String(document?.storageKey || "");
  if (!storageKey) {
    throw storageError(
      "Contract document metadata has no storage key.",
      "CONTRACT_ARTIFACT_METADATA_INVALID",
      410,
    );
  }

  if (provider === "firebase-storage") {
    try {
      const destination = await findFirebaseFile(storageKey, true);
      if (destination) {
        const [meta] = await destination.file.getMetadata();
        return {
          provider: "firebase-storage",
          storageKey,
          size: Number(meta.size || 0),
          createReadStream: () => destination.file.createReadStream(),
        };
      }
    } catch (firebaseErr) {
      if (firebaseErr.code !== "CONTRACT_STORAGE_NOT_CONFIGURED" && firebaseErr.statusCode !== 503) {
        // Fall through to local fallback
      }
    }

    let localPath;
    try {
      localPath = resolveContractArtifactStorageKey(kind, storageKey);
      const stat = await fs.promises.stat(localPath).catch(() => null);
      if (stat?.isFile()) {
        return {
          provider: "local",
          storageKey,
          size: stat.size,
          absolutePath: localPath,
          createReadStream: () => fs.createReadStream(localPath),
        };
      }
    } catch {
      // Ignore local resolution failure
    }

    throw storageError(
      "The Contract document file is missing from persistent storage.",
      "CONTRACT_ARTIFACT_STORAGE_MISSING",
      410,
    );
  }

  // provider === "local" — this is also every pre-migration legacy record,
  // since signedDocumentSchema's storageProvider defaults to "local" and no
  // historical write ever set it to anything else.
  let absolutePath;
  try {
    absolutePath = resolveContractArtifactStorageKey(kind, storageKey);
  } catch {
    throw storageError(
      "Contract document metadata contains an invalid storage key.",
      "CONTRACT_ARTIFACT_METADATA_INVALID",
      410,
    );
  }
  const stat = await fs.promises.stat(absolutePath).catch(() => null);
  if (stat?.isFile()) {
    return {
      provider: "local",
      storageKey,
      size: stat.size,
      absolutePath,
      createReadStream: () => fs.createReadStream(absolutePath),
    };
  }

  // Fallback: a "local" record whose file was actually migrated/re-uploaded
  // into Firebase under the same storageKey without the Mongo field being
  // updated (defensive only — normal writes always set storageProvider
  // correctly themselves).
  if (admin.apps.length) {
    try {
      const destination = await findFirebaseFile(storageKey, true);
      if (destination) {
        const [meta] = await destination.file.getMetadata();
        return {
          provider: "firebase-storage",
          storageKey,
          size: Number(meta.size || 0),
          createReadStream: () => destination.file.createReadStream(),
        };
      }
    } catch {
      // Ignore Firebase fallback error
    }
  }

  throw storageError(
    "The Contract document file is missing from storage.",
    "CONTRACT_ARTIFACT_STORAGE_MISSING",
    410,
  );
};

export const removeContractArtifact = async ({ kind, document }) => {
  if (!document?.storageKey) return;
  if (document.storageProvider === "firebase-storage") {
    const destination = await findFirebaseFile(document.storageKey);
    if (destination) await destination.file.delete({ ignoreNotFound: true });
    return;
  }
  await removeContractArtifactFile(
    kind,
    resolveContractArtifactStorageKey(kind, document.storageKey),
  );
};

export const storeSignedContractDocument = (args) => storeContractArtifact({ kind: "signed", ...args });
export const inspectSignedContractDocument = (document) => inspectContractArtifact({ kind: "signed", document });
export const removeSignedContractDocument = (document) => removeContractArtifact({ kind: "signed", document });

export const storeNotarizedContractDocument = (args) => storeContractArtifact({ kind: "notarized", ...args });
export const inspectNotarizedContractDocument = (document) => inspectContractArtifact({ kind: "notarized", document });
export const removeNotarizedContractDocument = (document) => removeContractArtifact({ kind: "notarized", document });
