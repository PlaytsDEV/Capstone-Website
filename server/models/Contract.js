import mongoose from "mongoose";
import { ROOM_BRANCHES } from "../config/branches.js";

export const CONTRACT_STATUSES = Object.freeze([
  "draft", "incomplete", "ready_for_generation", "generated",
  "awaiting_signatures", "partially_signed", "signed",
  "awaiting_notarization", "notarized", "ready_for_publication",
  "published", "active", "expiring_soon", "expired", "renewal_pending",
  "renewed", "transfer_review_required", "terminated", "cancelled",
  "replaced", "archived", "voided", "rejected",
]);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: CONTRACT_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const preparedDocumentSchema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ["prepared"], default: "prepared" },
    version: { type: Number, required: true, min: 1 },
    storageProvider: {
      type: String,
      enum: ["local", "firebase-storage"],
      default: "local",
    },
    storageKey: { type: String, required: true },
    fileName: { type: String, required: true },
    fileHash: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 1 },
    pageCount: { type: Number, required: true, min: 1 },
    generatedAt: { type: Date, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    templateId: { type: String, required: true },
    templateVersion: { type: String, required: true },
    coordinateVersion: { type: String, required: true },
    reason: { type: String, default: "", trim: true },
    superseded: { type: Boolean, default: false },
    generationSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    renderMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const signedDocumentSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, min: 1 },
    // Shared by signedDocuments[] and notarizedDocuments[] (this schema is
    // reused for both). Defaults to "local" so every pre-migration record —
    // written before this field existed — is correctly read as local-disk,
    // matching how it was actually stored. New uploads set this explicitly
    // via contractDocumentStorageService.js's storeSignedContractDocument /
    // storeNotarizedContractDocument.
    storageProvider: { type: String, enum: ["local", "firebase-storage"], default: "local" },
    storageKey: { type: String, required: true },
    fileName: { type: String, required: true },
    fileHash: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    preparedDocumentVersion: { type: Number, required: true, min: 1 },
    superseded: { type: Boolean, default: false },
    replacementReason: { type: String, default: "", trim: true },
    rejectionReason: { type: String, default: "", trim: true },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verificationNotes: { type: String, default: "", trim: true },
    verificationChecklist: { type: mongoose.Schema.Types.Mixed, default: null },
    notarialDetails: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

// NOTE: intentionally NOT `immutable: true` on these fields. Mongoose only
// permits writes to an immutable path when the *parent* document is new
// (doc.isNew) — but a Contract is, by definition, never new by the time its
// finalDocument is legitimately set (it was already created and saved
// earlier in its lifecycle). With `immutable: true` here, the very first
// authorized finalization write would silently fail schema validation
// (`finalDocument.<field>: Path '<field>' is required.`) on every real
// Contract, making final-document publication impossible. Business-level
// immutability (no finalDocument -> first upload allowed; existing
// finalDocument -> replacement requires the formal process) is enforced at
// the service layer instead — see contractNotarizationService.js's
// `assertDirectUploadAllowed` and contractPublicationService.js's
// `assertNotPublished`, which are the only two authorized writers of this
// field and already reject unauthorized replacement attempts.
const finalDocumentSchema = new mongoose.Schema(
  {
    // Increments only via the formal replacement process
    // (contractFinalDocumentReplacementService.replaceFinalContractDocument);
    // absent/1 on every finalDocument set by the original finalize paths.
    version: { type: Number, default: 1, min: 1 },
    storageKey: { type: String, required: true },
    fileName: { type: String, required: true },
    fileHash: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true },
    pageCount: { type: Number, required: true, min: 1 },
    // "admin_scan" is written only by scripts/reconcileFinalContractUploads.mjs,
    // backfilling a Contract whose wet-signed scan was uploaded through the
    // legacy signedDocuments[]-only flow before formal notarization
    // verification existed for it — so sourceVerifiedAt/By below are
    // legitimately absent for that source type, not required.
    sourceType: { type: String, enum: ["notarized", "admin_scan"], required: true },
    sourceVersion: { type: Number, required: true, min: 1 },
    sourceUploadedAt: { type: Date, required: true },
    sourceVerifiedAt: { type: Date, default: null },
    sourceVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, required: true },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tenantVisible: { type: Boolean, default: true, required: true },
    // Only set on a finalDocument that itself replaced a prior one — absent
    // on the original finalize (no formal-replacement history yet).
    replacementReason: { type: String, default: "", trim: true },
  },
  { _id: false },
);

// A snapshot of a superseded finalDocument, written only by
// contractFinalDocumentReplacementService.replaceFinalContractDocument
// right before it overwrites contract.finalDocument with the replacement.
// Same shape as finalDocumentSchema plus the supersession bookkeeping —
// this is the audit trail the task's "never destructively overwrite
// contract history" requirement needs: the prior ACTIVE final document
// becomes a SUPERSEDED entry here rather than being discarded.
const finalDocumentHistoryEntrySchema = new mongoose.Schema(
  {
    ...finalDocumentSchema.obj,
    supersededAt: { type: Date, required: true },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

const contractSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null, index: true },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", required: true, index: true },
    stayId: { type: mongoose.Schema.Types.ObjectId, ref: "Stay", default: null },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    branch: { type: String, enum: ROOM_BRANCHES, required: true, index: true },

    contractNumber: { type: String, required: true, immutable: true, unique: true },
    contractYear: { type: Number, required: true, immutable: true },
    contractSequence: { type: Number, required: true, immutable: true },
    version: { type: Number, default: 1, min: 1, immutable: true },
    contractPurpose: {
      type: String,
      enum: ["initial", "renewal", "amendment", "replacement"],
      default: "initial",
      required: true,
      index: true,
    },
    initialContractKey: { type: String, default: null, immutable: true },
    initialStayKey: { type: String, default: null, immutable: true },
    // Set only when contractPurpose === "replacement" — distinguishes a
    // same-room bed swap from a full room change so Admin/Tenant UI can use
    // accurate language ("Bed Reassignment" vs "Room Transfer") even though
    // both currently go through the same full replacement-Contract mechanism
    // (a bed assignment is part of the legal document; a lighter, non-
    // Contract bed-swap path was deliberately not built in this pass — see
    // steady-waddling-metcalfe.md D1).
    transferType: {
      type: String,
      enum: ["room_change", "bed_only", null],
      default: null,
    },
    // Lightweight admin-visibility flag for a Contract field that may no
    // longer match the current authoritative Reservation data (e.g. a
    // move-in reschedule approved after the Contract already progressed
    // past early-stage — see approvePreMoveInModification). Never used to
    // silently mutate a progressed Contract's snapshot fields; the flag is
    // the record that a human needs to reconcile it.
    staleDataFlags: {
      type: [
        {
          field: { type: String, required: true },
          flaggedAt: { type: Date, default: Date.now, required: true },
          reason: { type: String, required: true },
          resolvedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
    parentContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },
    replacesContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },
    replacementReason: { type: String, default: "", trim: true },
    amendmentReason: { type: String, default: "", trim: true },
    amendmentFields: { type: [String], default: [] },
    duplicateOfContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    archiveReason: { type: String, default: "", trim: true },
    archivedPreviousStatus: { type: String, enum: CONTRACT_STATUSES, default: null },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    restoreReason: { type: String, default: "", trim: true },
    isTestRecord: { type: Boolean, default: false, index: true },
    testPurpose: { type: String, default: "", trim: true },
    createdForTestingBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdForTestingAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, default: "", trim: true },
    templateType: { type: String, trim: true, default: "" },
    roomType: { type: String, enum: ["private", "double-sharing", "quadruple-sharing"], required: true },
    leaseType: { type: String, enum: ["short_term", "long_term"], required: true },

    propertyName: { type: String, required: true, trim: true, immutable: true },
    propertyAddress: { type: String, required: true, trim: true, immutable: true },
    roomNumber: { type: String, required: true, trim: true, immutable: true },
    bedId: { type: String, default: "", trim: true, immutable: true },
    bedLabel: { type: String, default: "", trim: true, immutable: true },

    tenantLegalName: { type: String, default: "", trim: true, immutable: true },
    tenantAddress: { type: String, default: "", trim: true, immutable: true },
    tenantEmail: { type: String, default: "", trim: true, lowercase: true, immutable: true },
    tenantPhone: { type: String, default: "", trim: true, immutable: true },
    tenantNationality: { type: String, default: "", trim: true, immutable: true },
    tenantBirthDate: { type: Date, default: null, immutable: true },
    tenantAgeAtGeneration: { type: Number, default: null, min: 18, immutable: true },

    leaseStartDate: { type: Date, default: null, immutable: true },
    leaseEndDate: { type: Date, default: null, immutable: true },
    leaseDurationMonths: { type: Number, default: null, min: 1, immutable: true },

    regularMonthlyRate: { type: Number, default: null, min: 0 },
    discountPercentage: { type: Number, default: null, min: 0, max: 100 },
    discountType: { type: String, enum: ["percentage", "none"], default: "percentage" },
    discountAmount: { type: Number, default: null, min: 0 },
    approvedMonthlyRate: { type: Number, default: null, min: 0 },
    advanceRentAmount: { type: Number, default: null, min: 0 },
    securityDepositAmount: { type: Number, default: null, min: 0 },
    reservationFeeAmount: { type: Number, default: null, min: 0 },
    reservationFeeCreditAmount: { type: Number, default: null, min: 0 },
    pricingApprovalId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null },
    pricingApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    pricingApprovedAt: { type: Date, default: null },
    pricingApprovalNotes: { type: String, default: "", trim: true },
    advanceCoverageStart: { type: Date, default: null, immutable: true },
    advanceCoverageEnd: { type: Date, default: null, immutable: true },
    executionDate: { type: Date, default: null },

    templateVersion: { type: String, default: null },
    legalContentVersion: { type: String, default: null },
    validatedGenerationData: { type: mongoose.Schema.Types.Mixed, default: null },
    lastValidatedAt: { type: Date, default: null },

    generatedStorageKey: { type: String, default: null },
    generatedFileName: { type: String, default: null },
    generatedFileHash: { type: String, default: null },
    generatedFileSize: { type: Number, default: null, min: 1 },
    generatedPageCount: { type: Number, default: null, min: 1 },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    generatedVersion: { type: Number, default: 0, min: 0 },
    preparedDocuments: { type: [preparedDocumentSchema], default: [] },
    printedAt: { type: Date, default: null },
    printedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    tenantSignatureStatus: { type: String, enum: ["pending", "completed", "not_required"], default: "pending" },
    tenantSignedAt: { type: Date, default: null },
    tenantSignatureConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lessorSignatureStatus: { type: String, enum: ["pending", "completed", "not_required"], default: "pending" },
    lessorSignedAt: { type: Date, default: null },
    lessorSignatureConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    witnessSignatureStatus: { type: String, enum: ["pending", "completed", "not_required"], default: "pending" },
    witnessSignedAt: { type: Date, default: null },
    witnessSignatureConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    signedStorageKey: { type: String, default: null },
    signedFileName: { type: String, default: null },
    signedFileHash: { type: String, default: null },
    signedFileSize: { type: Number, default: null, min: 1 },
    signedMimeType: { type: String, default: null },
    signedUploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    signedDocumentVersion: { type: Number, default: 0, min: 0 },
    signedDocuments: { type: [signedDocumentSchema], default: [] },
    signingVerifiedAt: { type: Date, default: null },
    signingVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    signingVerificationNotes: { type: String, default: "", trim: true },
    signingRejectionReason: { type: String, default: "", trim: true },
    notarizedFileName: { type: String, default: null },
    notarizedFileHash: { type: String, default: null },
    notarizedFileSize: { type: Number, default: null, min: 1 },
    notarizedMimeType: { type: String, default: null },
    notarizedUploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notarizedDocumentVersion: { type: Number, default: 0, min: 0 },
    notarizedDocuments: { type: [signedDocumentSchema], default: [] },
    notarizationVerifiedAt: { type: Date, default: null },
    notarizationVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notarizationVerificationNotes: { type: String, default: "", trim: true },
    notarizationRejectionReason: { type: String, default: "", trim: true },
    notarizationVerificationChecklist: { type: mongoose.Schema.Types.Mixed, default: null },
    notarizedAt: { type: Date, default: null },
    notarizationPlace: { type: String, default: "", trim: true },
    notaryName: { type: String, default: "", trim: true },
    notaryOffice: { type: String, default: "", trim: true },
    documentNumber: { type: String, default: "", trim: true },
    pageNumber: { type: String, default: "", trim: true },
    bookNumber: { type: String, default: "", trim: true },
    seriesYear: { type: Number, default: null, min: 1900, max: 2200 },
    notarizedStorageKey: { type: String, default: null },
    finalStorageKey: { type: String, default: null },
    finalDocument: { type: finalDocumentSchema, default: null },
    // Superseded finalDocument snapshots, oldest first, written only by the
    // formal replacement process (never by the original finalize paths).
    // Empty on every contract whose final document has never been replaced.
    finalDocumentHistory: { type: [finalDocumentHistoryEntrySchema], default: [] },
    readyForPublicationAt: { type: Date, default: null },
    readyForPublicationBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publicationNotes: { type: String, default: "", trim: true },
    tenantVisible: { type: Boolean, default: false },
    isCanonical: { type: Boolean, default: true, index: true },
    publicationStatus: {
      type: String,
      enum: ["internal", "ready_for_resident", "published", "withdrawn"],
      default: undefined,
      index: true,
    },
    publicationChecklist: { type: mongoose.Schema.Types.Mixed, default: null },
    publicationChecklistConfirmedAt: { type: Date, default: null },
    publicationChecklistConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    generatedAt: { type: Date, default: null },
    signedUploadedAt: { type: Date, default: null },
    notarizedUploadedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },

    status: { type: String, enum: CONTRACT_STATUSES, default: "draft", required: true, index: true },
    isCurrent: { type: Boolean, default: true, index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    previousContractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", default: null },
    // Deprecated/unwritten — no service in this codebase writes this field
    // (confirmed by a full-repo grep). previousContractId/parentContractId/
    // replacesContractId are the canonical predecessor links; do not start
    // writing this field without first reconciling it with those.
    renewedContractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", default: null },
    // supersededBy/supersededByContractId have always been written together
    // as a redundant mirror pair. Going forward only supersededByContractId
    // is the write target (contractService.js); supersededBy is kept
    // read-only for backward compatibility with historical records —
    // isResidentContractEligible (tenantContractSelectionService.js) already
    // excludes a contract if either field is set.
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", default: null },
    supersededByContractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", default: null },
    // Informational/audit snapshot only, computed at renewal/replacement
    // successor-contract creation — no Bill/charge is auto-generated from
    // this (no authoritative deposit-adjustment billing policy exists in
    // this codebase; see server/utils/depositUtils.js).
    depositAdjustment: {
      type: new mongoose.Schema(
        {
          heldAmount: { type: Number, default: 0 },
          requiredAmount: { type: Number, default: 0 },
          adjustmentAmount: { type: Number, default: 0 },
          computedAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

contractSchema.index({ branch: 1, contractYear: 1, contractSequence: 1 }, { unique: true });
// Scoped to isCurrent:true (matching the stayId index below) so that once a
// contract is cancelled/superseded (isCurrent set to false), its immutable
// initialContractKey/initialStayKey no longer blocks creating a replacement
// draft contract for the same reservation/stay.
contractSchema.index(
  { initialContractKey: 1 },
  {
    unique: true,
    partialFilterExpression: { initialContractKey: { $type: "string" }, isCurrent: true },
    name: "unique_initial_contract_reservation",
  },
);
contractSchema.index(
  { initialStayKey: 1 },
  {
    unique: true,
    partialFilterExpression: { initialStayKey: { $type: "string" }, isCurrent: true },
    name: "unique_initial_contract_stay",
  },
);
contractSchema.index({ tenantId: 1, isCurrent: 1, createdAt: -1 });
contractSchema.index({ branch: 1, status: 1, createdAt: -1 });
contractSchema.index(
  { stayId: 1 },
  { unique: true, partialFilterExpression: { stayId: { $type: "objectId" }, isCurrent: true } },
);

export default mongoose.model("Contract", contractSchema);
