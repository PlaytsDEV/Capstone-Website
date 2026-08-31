/** Read-only Room Transfer predecessor audit for moved-in generated/initial Contracts. */
import "dotenv/config";
import mongoose from "mongoose";
import { Contract, Reservation, Stay, User } from "../models/index.js";
import { CURRENT_RESIDENT_STATUS_QUERY } from "../utils/lifecycleNaming.js";

if (process.argv.some((arg) => ["--apply", "--write", "--fix", "--repair", "--delete"].includes(arg))) {
  throw new Error("This predecessor audit is read-only.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const TARGETS = ["joanne ong", "juanito dela cruz", "juanito dela cruzz", "saoirse de dios"];
const sid = (value) => (value ? String(value) : null);
const normalizedName = (user) => `${user?.firstName || ""} ${user?.lastName || ""}`.trim().toLowerCase();

await mongoose.connect(process.env.MONGODB_URI);
try {
  const users = await User.find({ isArchived: { $ne: true } }).select("firstName lastName email user_id role tenantStatus").lean();
  const targets = users.filter((user) => TARGETS.includes(normalizedName(user)));
  const records = [];
  for (const tenant of targets) {
    const reservations = await Reservation.find({ userId: tenant._id, status: CURRENT_RESIDENT_STATUS_QUERY, isArchived: { $ne: true } }).lean();
    for (const reservation of reservations) {
      const [contract, stay] = await Promise.all([
        Contract.findOne({ reservationId: reservation._id, isCurrent: true, archivedAt: null }).sort({ version: -1, createdAt: -1 }).lean(),
        Stay.findOne({ reservationId: reservation._id, status: { $in: ["active", "ending_soon", "expiring_soon", "renewal_pending"] } }).sort({ createdAt: -1 }).lean(),
      ]);
      const signedDocument = (contract?.signedDocuments || []).find((document) => document?.url || document?.fileHash);
      const finalDocument = contract?.finalDocument?.url || contract?.finalDocument?.fileHash
        ? contract.finalDocument
        : null;
      const statusEvidence = (contract?.statusHistory || []).filter((entry) =>
        ["signed", "notarized", "ready_for_publication", "published", "active"].includes(entry?.status));
      const wetSignedEvidenceExists = Boolean(signedDocument || finalDocument || statusEvidence.length > 0);
      const affected = contract?.status === "generated" && contract?.contractPurpose === "initial";
      const classification = !affected
        ? "NOT_AFFECTED"
        : wetSignedEvidenceExists
          ? "UPSTREAM_DATA_HYGIENE"
          : "INTENTIONAL_RULE";
      records.push({
        tenant: `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim(),
        tenantId: sid(tenant._id),
        userId: tenant.user_id || null,
        reservationId: sid(reservation._id),
        reservationStatus: reservation.status,
        moveInDate: reservation.confirmedMoveInDate || reservation.moveInDate || null,
        stay: stay ? { id: sid(stay._id), status: stay.status, leaseStartDate: stay.leaseStartDate, leaseEndDate: stay.leaseEndDate } : null,
        contract: contract ? {
          id: sid(contract._id),
          number: contract.contractNumber,
          status: contract.status,
          purpose: contract.contractPurpose,
          isCurrent: contract.isCurrent,
          tenantSignatureStatus: contract.tenantSignatureStatus || null,
        } : null,
        wetSignedEvidenceExists,
        wetSignedEvidence: {
          signedDocument: signedDocument ? { url: signedDocument.url || null, fileHash: signedDocument.fileHash || null } : null,
          finalDocument: finalDocument ? { url: finalDocument.url || null, fileHash: finalDocument.fileHash || null } : null,
          statusHistory: statusEvidence,
        },
        classification,
        opsRemediation: affected
          ? wetSignedEvidenceExists
            ? "Validate the final scan, then repair the Contract lifecycle through the established publication workflow. Do not auto-publish."
            : "Obtain and validate the wet-signed/final Contract before publication. Room Transfer remains blocked."
          : null,
      });
    }
  }
  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    generatedAt: new Date().toISOString(),
    requestedTenantsFound: targets.length,
    counts: Object.fromEntries(["TRANSFER_RULE_TOO_STRICT", "UPSTREAM_DATA_HYGIENE", "INTENTIONAL_RULE", "NOT_AFFECTED"].map((key) => [key, records.filter((record) => record.classification === key).length])),
    records,
    automaticPublicationPerformed: false,
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
