import crypto from "node:crypto";
import { MongoClient } from "mongodb";
import { classifyEnvironment } from "./audit-core.mjs";

const WRITE_ACTIONS = new Set([
  "insert", "update", "remove", "createCollection", "createIndex", "dropCollection",
  "dropDatabase", "renameCollectionSameDB", "renameCollection", "convertToCapped",
  "collMod", "compact", "bypassDocumentValidation", "enableSharding", "moveChunk",
]);

const FORBIDDEN_COMMANDS = new Set([
  "insert", "update", "delete", "findandmodify", "findandmodify", "create", "createindexes",
  "drop", "dropdatabase", "renamecollection", "bulkwrite", "committransaction", "aborttransaction",
]);

export function parseDatabaseIdentity(uri, environmentName = process.env.NODE_ENV) {
  const raw = String(uri || "").trim();
  const result = { configured: Boolean(raw), environmentName: environmentName || "unset", databaseName: null, hostCategory: "unknown", hostFingerprint: null };
  if (!raw) return result;
  try {
    const normalized = raw.replace(/^mongodb\+srv:/, "https:").replace(/^mongodb:/, "http:");
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    result.databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || null;
    result.hostCategory = ["localhost", "127.0.0.1", "::1"].includes(host) ? "local" : raw.startsWith("mongodb+srv:") ? "managed-remote" : "remote";
    result.hostFingerprint = crypto.createHash("sha256").update(host).digest("hex").slice(0, 12);
  } catch {
    result.parseError = true;
  }
  return result;
}

export function assessPrivileges(connectionStatus) {
  const privileges = connectionStatus?.authInfo?.authenticatedUserPrivileges;
  if (!Array.isArray(privileges)) return "unavailable";
  const actions = privileges.flatMap((entry) => entry.actions || []);
  return actions.some((action) => WRITE_ACTIONS.has(String(action))) ? "write-capable" : "read-only";
}

function safeError(error) {
  const code = error?.code || error?.codeName || "UNKNOWN";
  return `${code}: database metadata request failed`;
}

export async function establishReadOnlySafety({ uri, environmentName, explicitlyAuthorized = false }) {
  const identity = parseDatabaseIdentity(uri, environmentName);
  if (!identity.configured || identity.parseError || !identity.databaseName) {
    const classification = classifyEnvironment({ ...identity, privilegeAssessment: "unavailable", explicitlyAuthorized });
    return { ...identity, privilegeAssessment: "unavailable", ...classification, metadataConnected: false };
  }

  const observedCommands = [];
  const client = new MongoClient(uri, {
    retryWrites: false,
    monitorCommands: true,
    serverSelectionTimeoutMS: 8_000,
    socketTimeoutMS: 15_000,
    readPreference: "secondaryPreferred",
    readConcern: { level: "majority" },
    appName: "lilycrest-reservation-phase-0-read-only-audit",
  });
  client.on("commandStarted", (event) => {
    const command = String(event.commandName || "").toLowerCase();
    observedCommands.push(command);
    if (FORBIDDEN_COMMANDS.has(command)) {
      throw new Error(`Read-only audit blocked forbidden database command: ${command}`);
    }
  });

  try {
    await client.connect();
    const admin = client.db(identity.databaseName).admin();
    let privilegeAssessment = "unavailable";
    try {
      privilegeAssessment = assessPrivileges(await admin.command({ connectionStatus: 1, showPrivileges: true }));
    } catch {
      privilegeAssessment = "unavailable";
    }
    const classification = classifyEnvironment({ ...identity, privilegeAssessment, explicitlyAuthorized });
    return { ...identity, privilegeAssessment, ...classification, metadataConnected: true, observedCommands: [...new Set(observedCommands)].sort(), client };
  } catch (error) {
    await client.close().catch(() => {});
    const classification = classifyEnvironment({ ...identity, privilegeAssessment: "unavailable", explicitlyAuthorized });
    return { ...identity, privilegeAssessment: "unavailable", ...classification, metadataConnected: false, error: safeError(error), observedCommands: [...new Set(observedCommands)].sort() };
  }
}

const COLLECTIONS = Object.freeze({
  reservations: "reservations", contracts: "contracts", bills: "bills", payments: "payments",
  rooms: "rooms", users: "users", stays: "stays", settings: "businesssettings",
  auditLogs: "auditLogs", webhookEvents: "paymongowebhookevents", notifications: "notifications",
});

const PROJECTIONS = Object.freeze({
  reservations: { _id: 1, userId: 1, roomId: 1, currentStayId: 1, selectedBed: 1, status: 1, paymentStatus: 1, paymentExpiresAt: 1, paymongoSessionId: 1, paymongoPaymentId: 1, paymentMethod: 1, paymentDate: 1, proofOfPaymentUrl: 1, monthlyRent: 1, totalPrice: 1, reservationFeeAmount: 1, applianceFees: 1, leaseDuration: 1, moveInDate: 1, finalMoveInDate: 1, confirmedMoveInDate: 1, approvedForPaymentAt: 1, applicationReviewedAt: 1, applicationReviewedBy: 1, reservedAt: 1, emergencyContact: 1, agreedToPrivacy: 1, agreedToCertification: 1, selfiePhotoUrl: 1, validIDFrontUrl: 1, validIDBackUrl: 1, nbiClearanceUrl: 1, companyIDUrl: 1, depositForfeited: 1, depositForfeitureReason: 1, depositForfeitedAt: 1, depositRefundAmount: 1, depositRefundStatus: 1, depositRefundProcessedAt: 1, depositRefundProcessedBy: 1, finalSettlementSummary: 1, reservationCreditConsumedAt: 1, reservationCreditAppliedBillId: 1, isArchived: 1, archivedAt: 1, cancelledAt: 1, cancellationSource: 1, cancellationReason: 1, createdAt: 1, updatedAt: 1 },
  contracts: { _id: 1, tenantId: 1, reservationId: 1, stayId: 1, roomId: 1, branch: 1, contractNumber: 1, status: 1, isCurrent: 1, roomType: 1, bedId: 1, leaseType: 1, leaseStartDate: 1, leaseEndDate: 1, leaseDurationMonths: 1, regularMonthlyRate: 1, discountPercentage: 1, discountType: 1, discountAmount: 1, approvedMonthlyRate: 1, advanceRentAmount: 1, securityDepositAmount: 1, reservationFeeAmount: 1, reservationFeeCreditAmount: 1, pricingApprovalId: 1, pricingApprovedBy: 1, pricingApprovedAt: 1, pricingApprovalNotes: 1, advanceCoverageStart: 1, advanceCoverageEnd: 1, executionDate: 1, lastValidatedAt: 1, generatedAt: 1, generatedVersion: 1, "preparedDocuments.version": 1, "preparedDocuments.superseded": 1, printedAt: 1, tenantSignatureStatus: 1, lessorSignatureStatus: 1, signedUploadedAt: 1, "signedDocuments.version": 1, "signedDocuments.superseded": 1, signingVerifiedAt: 1, notarizedUploadedAt: 1, "notarizedDocuments.version": 1, "notarizedDocuments.superseded": 1, notarizationVerifiedAt: 1, publishedAt: 1, archivedAt: 1, createdAt: 1, updatedAt: 1 },
  bills: { _id: 1, reservationId: 1, userId: 1, tenantId: 1, stayId: 1, roomId: 1, branch: 1, billType: 1, billingMonth: 1, billingCycleStart: 1, billingCycleEnd: 1, dueDate: 1, additionalCharges: 1, charges: 1, reservationCreditApplied: 1, totalAmount: 1, grossAmount: 1, paidAmount: 1, amountPaid: 1, remainingAmount: 1, status: 1, paymentDate: 1, paymentMethod: 1, paymongoSessionId: 1, paymongoPaymentId: 1, paymentProof: 1, penaltyDetails: 1, isMilestoneSubInvoice: 1, parentInvoiceId: 1, milestoneIndex: 1, description: 1, notes: 1, isArchived: 1, createdAt: 1, updatedAt: 1 },
  payments: { _id: 1, tenantId: 1, billId: 1, reservationId: 1, purpose: 1, amount: 1, expectedAmount: 1, paidAmount: 1, method: 1, currency: 1, source: 1, externalSessionId: 1, externalPaymentId: 1, paymentReference: 1, referenceNumber: 1, processedAt: 1, submittedAt: 1, verifiedBy: 1, verifiedAt: 1, proofUrl: 1, proofImageUrl: 1, status: 1, branch: 1, metadata: 1, notes: 1, createdAt: 1, updatedAt: 1 },
  rooms: { _id: 1, branch: 1, type: 1, capacity: 1, currentOccupancy: 1, price: 1, monthlyPrice: 1, shortTermRate: 1, regularLongRate: 1, regularShortRate: 1, "beds.id": 1, "beds.code": 1, "beds.status": 1, "beds.occupiedBy": 1, "beds.lockedBy": 1, "beds.lockExpiresAt": 1, available: 1, isArchived: 1, archivedAt: 1, createdAt: 1, updatedAt: 1 },
  users: { _id: 1, branch: 1, role: 1, emergencyContact: 1, emergencyPhone: 1, emergencyRelationship: 1, isArchived: 1, archivedAt: 1 },
  stays: { _id: 1, tenantId: 1, reservationId: 1, branch: 1, roomId: 1, bedId: 1, monthlyRent: 1, leaseStartDate: 1, leaseEndDate: 1, status: 1, createdAt: 1, updatedAt: 1 },
  settings: { _id: 1, reservationFeeAmount: 1, penaltyRatePerDay: 1, maxPenaltyCapPercent: 1, longTermLeaseMinMonths: 1, createdAt: 1, updatedAt: 1 },
  auditLogs: { _id: 1, timestamp: 1, action: 1, userId: 1, userRole: 1, branch: 1, entityType: 1, entityId: 1 },
  webhookEvents: { _id: 1, eventId: 1, eventType: 1, receivedAt: 1, signatureVerified: 1, processingStatus: 1, processedAt: 1, attemptCount: 1, createdAt: 1, updatedAt: 1 },
  notifications: { _id: 1, userId: 1, type: 1, entityType: 1, entityId: 1, createdAt: 1 },
});

const truthy = (value) => Boolean(value && String(value).trim());

function privacyTransform(key, document) {
  if (key === "reservations") {
    const copy = { ...document, proofOfPaymentPresent: truthy(document.proofOfPaymentUrl), documentEvidence: {
      selfiePresent: truthy(document.selfiePhotoUrl), validIdFrontPresent: truthy(document.validIDFrontUrl),
      validIdBackPresent: truthy(document.validIDBackUrl), nbiPresent: truthy(document.nbiClearanceUrl), companyIdPresent: truthy(document.companyIDUrl),
    } };
    for (const field of ["proofOfPaymentUrl", "selfiePhotoUrl", "validIDFrontUrl", "validIDBackUrl", "nbiClearanceUrl", "companyIDUrl"]) delete copy[field];
    if (copy.emergencyContact) copy.emergencyContact = { present: truthy(copy.emergencyContact.name) && truthy(copy.emergencyContact.contactNumber), relationshipPresent: truthy(copy.emergencyContact.relationship) };
    return copy;
  }
  if (key === "bills") {
    const copy = { ...document, paymentProof: document.paymentProof ? {
      imagePresent: truthy(document.paymentProof.imageUrl), submittedAmount: document.paymentProof.submittedAmount ?? null,
      submittedAt: document.paymentProof.submittedAt || null, verificationStatus: document.paymentProof.verificationStatus || "none",
      verifierPresent: Boolean(document.paymentProof.verifiedBy), verifiedAt: document.paymentProof.verifiedAt || null,
    } : null };
    return copy;
  }
  if (key === "payments") {
    const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata : {};
    const copy = { ...document, proofPresent: truthy(document.proofUrl) || truthy(document.proofImageUrl), safeEvidence: {
      transactionDatePresent: Boolean(metadata.transactionDate || document.processedAt || document.submittedAt),
      receivingAccountPresent: Boolean(metadata.receivingAccount || metadata.receivingAccountId || metadata.destinationAccount),
      providerStatus: metadata.providerStatus || metadata.proofStatus || null,
      category: [metadata.purpose, metadata.classification, metadata.chargeType].find((value) => typeof value === "string" && /^(advance[_ -]?rent|security[_ -]?deposit|initial[_ -]?payment|initial[_ -]?charge)$/i.test(value)) || null,
      accountMatch: metadata.accountMatch ?? null,
      allocations: Array.isArray(metadata.allocations) ? metadata.allocations.map((entry) => ({ targetId: entry.billId || entry.targetId || null, amount: entry.amount ?? null, branch: entry.branch || null })) : [],
      unallocatedAmount: metadata.unallocatedAmount ?? null,
    } };
    delete copy.proofUrl; delete copy.proofImageUrl; delete copy.metadata;
    return copy;
  }
  return document;
}

export async function loadAuditDataset(safety) {
  if (!safety?.safe || !safety.client) throw new Error("Record-level audit blocked because read-only database safety is not established.");
  const db = safety.client.db(safety.databaseName);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((row) => row.name));
  const dataset = { collectionWarnings: [], indexes: {} };
  for (const [key, collectionName] of Object.entries(COLLECTIONS)) {
    if (!existing.has(collectionName)) {
      dataset[key] = [];
      dataset.collectionWarnings.push(`Optional or required collection unavailable: ${collectionName}`);
      continue;
    }
    dataset[key] = (await db.collection(collectionName).find({}, { projection: PROJECTIONS[key], readConcern: { level: "majority" } }).sort({ _id: 1 }).toArray()).map((document) => privacyTransform(key, document));
    if (["reservations", "contracts", "bills", "payments", "rooms", "stays"].includes(key)) {
      dataset.indexes[key] = (await db.collection(collectionName).listIndexes().toArray()).map((index) => ({ name: index.name, key: index.key, unique: Boolean(index.unique), partialFilterExpression: index.partialFilterExpression || null }));
    }
  }
  return dataset;
}

export async function closeSafetyConnection(safety) {
  await safety?.client?.close();
}
