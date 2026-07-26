import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export const GENERATED_CONTRACT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../private/generated-contracts",
);

export const sanitizeContractFileSegment = (value, fallback = "contract") => {
  const sanitized = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return sanitized || fallback;
};

const ensureInsideRoot = (candidate) => {
  const root = path.resolve(GENERATED_CONTRACT_ROOT);
  const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    const error = new Error("Invalid private Contract storage path.");
    error.code = "CONTRACT_STORAGE_PATH_INVALID";
    error.statusCode = 400;
    throw error;
  }
  return resolved;
};

export const buildPreparedContractStorage = ({
  branch,
  year,
  contractNumber,
  tenantLegalName,
  roomType,
  leaseType,
  contractDate,
  version,
}) => {
  const safeBranch = sanitizeContractFileSegment(branch);
  const safeContractNumber = sanitizeContractFileSegment(contractNumber);
  const safeTenantName = sanitizeContractFileSegment(tenantLegalName, "Tenant");
  const safeRoomType = sanitizeContractFileSegment(roomType, "Room");
  const safeLeaseType = sanitizeContractFileSegment(leaseType, "Lease");
  const safeContractDate = sanitizeContractFileSegment(contractDate, "Undated");
  const fileName =
    `Lease_${safeTenantName}_${safeRoomType}_${safeLeaseType}_${safeContractDate}_v${version}.pdf`;
  const relativeDirectory = path.join(
    safeBranch,
    String(year),
    safeContractNumber,
  );
  const storageKey = path.join(relativeDirectory, fileName).replaceAll("\\", "/");
  const absolutePath = ensureInsideRoot(path.join(GENERATED_CONTRACT_ROOT, storageKey));
  return { fileName, storageKey, absolutePath, directory: path.dirname(absolutePath) };
};

export const writePrivateContractAtomically = async (target, bytes) => {
  await fs.mkdir(target.directory, { recursive: true, mode: 0o700 });
  try {
    await fs.access(target.absolutePath);
    const error = new Error("Prepared Contract version already exists.");
    error.code = "CONTRACT_FILE_VERSION_EXISTS";
    error.statusCode = 409;
    throw error;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporaryPath = ensureInsideRoot(
    `${target.absolutePath}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await fs.writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    await fs.rename(temporaryPath, target.absolutePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  return target;
};

export const removePrivateContractFile = async (absolutePath) => {
  const safePath = ensureInsideRoot(absolutePath);
  await fs.rm(safePath, { force: true });
};

export const resolvePrivateContractStorageKey = (storageKey) =>
  ensureInsideRoot(path.join(GENERATED_CONTRACT_ROOT, String(storageKey || "")));
