import mongoose from "mongoose";
import dayjs from "dayjs";
import { Contract, ContractCounter, Reservation, Room, Stay, User } from "../models/index.js";
import {
  normalizeContractRoomType,
  resolveContractBranch,
  validateBranchRoomType,
} from "../config/contractConfig.js";
import {
  resolveTenantFinancialSummary,
} from "./tenantProfileService.js";
import {
  buildContractGenerationData,
  resolveApplicantIdentity,
} from "./contractGenerationDataService.js";
import { resolveContractTemplate } from "./contractTemplateService.js";
import { resolveContractLeasePricing } from "./contractPricingResolver.js";
import { getBusinessSettings } from "../utils/businessSettings.js";

export const CONTRACT_TRANSITIONS = Object.freeze({
  draft: ["incomplete", "ready_for_generation", "awaiting_signatures", "partially_signed", "signed", "cancelled"],
  incomplete: ["draft", "ready_for_generation", "awaiting_signatures", "partially_signed", "signed", "cancelled"],
  ready_for_generation: ["draft", "incomplete", "generated", "awaiting_signatures", "partially_signed", "signed", "cancelled"],
  generated: ["awaiting_signatures", "partially_signed", "signed", "notarized", "cancelled"],
  awaiting_signatures: ["partially_signed", "signed", "notarized", "cancelled"],
  partially_signed: ["awaiting_signatures", "signed", "notarized", "cancelled"],
  signed: ["awaiting_notarization", "notarized", "cancelled"],
  awaiting_notarization: ["notarized", "cancelled"],
  notarized: ["ready_for_publication", "cancelled"],
  ready_for_publication: ["published", "cancelled"],
  published: ["active", "replaced", "transfer_review_required", "terminated"],
  active: ["expiring_soon", "renewal_pending", "transfer_review_required", "terminated", "replaced"],
  expiring_soon: ["expired", "renewal_pending", "transfer_review_required", "terminated", "replaced"],
  expired: ["renewal_pending", "archived"],
  renewal_pending: ["renewed", "cancelled"],
  renewed: ["archived"],
  transfer_review_required: ["replaced", "terminated", "active"],
  terminated: ["archived"],
  cancelled: ["archived"],
  replaced: ["archived"],
  archived: [],
});

const terminalStatuses = new Set(["renewed", "terminated", "cancelled", "replaced", "archived"]);

const serviceError = (message, code, statusCode = 400, details = undefined) =>
  Object.assign(new Error(message), { code, statusCode, details });

const duplicateContractError = (existingContract) => serviceError(
  "A contract already exists for this approved reservation or stay.",
  "DUPLICATE_CONTRACT",
  409,
  {
    existingContract: {
      id: String(existingContract._id),
      contractNumber: existingContract.contractNumber,
      status: existingContract.status,
      tenantName: existingContract.tenantLegalName,
      branch: existingContract.branch,
      roomNumber: existingContract.roomNumber,
      bedLabel: existingContract.bedLabel || existingContract.bedId || "",
      updatedAt: existingContract.updatedAt,
    },
  },
);

export const assertValidContractTransition = (from, to) => {
  if (from === to) return true;
  if (!CONTRACT_TRANSITIONS[from]?.includes(to)) {
    throw serviceError(
      `Contract status cannot change from ${from} to ${to}.`,
      "INVALID_CONTRACT_STATUS_TRANSITION",
      409,
      { from, to, allowed: CONTRACT_TRANSITIONS[from] || [] },
    );
  }
  return true;
};

export const formatContractNumber = (branch, year, sequence) => {
  const { code } = resolveContractBranch(branch);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw serviceError("Contract sequence must be a positive integer.", "INVALID_CONTRACT_SEQUENCE");
  }
  return `LIL-${code}-${year}-${String(sequence).padStart(5, "0")}`;
};

export const generateContractNumber = async (branch, date = new Date(), session = null) => {
  resolveContractBranch(branch);
  const year = date.getUTCFullYear();
  const counter = await ContractCounter.findOneAndUpdate(
    { _id: `${branch}:${year}` },
    { $inc: { sequence: 1 }, $setOnInsert: { branch, year } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session },
  );
  return {
    contractNumber: formatContractNumber(branch, year, counter.sequence),
    contractYear: year,
    contractSequence: counter.sequence,
  };
};

const formatReservationAddress = (address) => {
  if (!address) return "";
  if (typeof address === "string") {
    return address
      .replace(/,\s*(National Capital Region\s*(\(NCR\))?|NCR|Region\s+[IVXLCDM\d\-A-Za-z]+(\s*\([^\)]+\))?)\s*$/i, "")
      .trim();
  }
  return [
    address.unitHouseNo, address.street, address.barangay,
    address.city, address.province,
  ].filter(Boolean).join(", ");
};

const getBedLabel = (bed = {}) => bed.code || [bed.bunkBlock, bed.position].filter(Boolean).join("-");

export const createDraftContract = async ({
  reservationId,
  stayId = null,
  actorId,
  allowedBranch = null,
}) => {
  if (!mongoose.isValidObjectId(reservationId)) {
    throw serviceError("A valid reservationId is required.", "INVALID_RESERVATION_ID");
  }

  const reservation = await Reservation.findById(reservationId).lean();
  if (!reservation) throw serviceError("Reservation not found.", "RESERVATION_NOT_FOUND", 404);

  const [tenant, room, stay] = await Promise.all([
    User.findById(reservation.userId).lean(),
    Room.findById(reservation.roomId).lean(),
    stayId ? Stay.findById(stayId).lean() : reservation.currentStayId
      ? Stay.findById(reservation.currentStayId).lean()
      : Stay.findOne({ reservationId: reservation._id, status: { $in: ["active", "ending_soon"] } }).lean(),
  ]);
  if (!tenant) throw serviceError("Reservation tenant not found.", "TENANT_NOT_FOUND", 404);
  if (!room) throw serviceError("Reservation room not found.", "ROOM_NOT_FOUND", 404);
  if (stay && String(stay.reservationId) !== String(reservation._id)) {
    throw serviceError("Stay does not belong to the reservation.", "STAY_RESERVATION_MISMATCH", 409);
  }

  const branch = stay?.branch || room.branch;
  if (stay?.branch && stay.branch !== room.branch) {
    throw serviceError("Stay and room branch assignments conflict.", "CONTRACT_BRANCH_CONFLICT", 409);
  }
  if (allowedBranch && allowedBranch !== branch) {
    throw serviceError(
      "You cannot create a Contract for another branch.",
      "CONTRACT_BRANCH_ACCESS_DENIED",
      403,
    );
  }
  const canonicalRoomType = validateBranchRoomType(branch, room.type);
  const property = resolveContractBranch(branch);
  const effectiveStayId = stay?._id || null;
  const duplicateConditions = [
    { reservationId: reservation._id },
    { applicationId: reservation._id },
    { initialContractKey: `reservation:${reservation._id}` },
  ];
  if (effectiveStayId) {
    duplicateConditions.push(
      { stayId: effectiveStayId },
      { initialStayKey: `stay:${effectiveStayId}` },
    );
  }
  // Only a still-current contract (isCurrent: true) counts as a real
  // duplicate-in-progress. A cancelled/superseded contract for this
  // reservation must not permanently block regeneration — see the matching
  // isCurrent-scoped unique indexes on initialContractKey/initialStayKey.
  const existingContract = await Contract.findOne({
    contractPurpose: { $in: ["initial", null] },
    isCurrent: true,
    $or: duplicateConditions,
  }).select(
    "_id contractNumber status tenantLegalName branch roomNumber bedLabel bedId updatedAt",
  ).lean();
  if (existingContract) {
    throw duplicateContractError(existingContract);
  }

  // A cancelled predecessor (isCurrent: false) is allowed to be superseded by
  // a new draft. Track lineage and bump the version instead of silently
  // starting back at v1, so this reads as a controlled regeneration rather
  // than an unrelated duplicate.
  const previousContract = await Contract.findOne({
    contractPurpose: { $in: ["initial", null] },
    isCurrent: false,
    $or: duplicateConditions,
  }).sort({ version: -1, createdAt: -1 }).select("_id version").lean();

  const leaseStartDate = stay?.leaseStartDate || reservation.confirmedMoveInDate ||
    reservation.moveInDate || reservation.intendedMoveInDate || null;
  const leaseDurationMonths = Number(reservation.leaseDuration) || null;
  const leaseEndDate = stay?.leaseEndDate ||
    (leaseStartDate && leaseDurationMonths
      ? new Date(new Date(leaseStartDate).setMonth(new Date(leaseStartDate).getMonth() + leaseDurationMonths))
      : null);
  const structuredSnapshot =
    reservation.financialWorkflowVersion === "structured-initial-payment-v1"
      ? reservation.pricingSnapshot
      : null;
  const approvedRate = Number.isFinite(
    Number(structuredSnapshot?.finalMonthlyRate ?? reservation.monthlyRent),
  )
    ? Number(structuredSnapshot?.finalMonthlyRate ?? reservation.monthlyRent)
    : null;
  const financial = resolveTenantFinancialSummary({ reservation });
  const settings = await getBusinessSettings();
  const pricing = structuredSnapshot
    ? {
        isLongTerm: structuredSnapshot.leaseType === "long",
        leaseType:
          structuredSnapshot.leaseType === "long" ? "long_term" : "short_term",
        regularMonthlyRate: structuredSnapshot.regularMonthlyRate,
        discountPercentage: structuredSnapshot.discountPercentage,
        discountAmount: structuredSnapshot.discountAmount,
        approvedMonthlyRate: structuredSnapshot.finalMonthlyRate,
      }
    : resolveContractLeasePricing({
        room,
        roomType: canonicalRoomType,
        leaseDurationMonths,
        approvedMonthlyRate: approvedRate,
        longTermLeaseMinMonths: settings.longTermLeaseMinMonths,
      });
  let resolvedTemplate = null;
  try {
    resolvedTemplate = resolveContractTemplate({
      branch,
      roomType: canonicalRoomType,
      leaseType: pricing.isLongTerm ? "long-term" : "short-term",
      leaseStartDate,
      leaseEndDate,
      leaseDurationMonths,
    });
  } catch {
    // A draft may preserve incomplete lease data. Full validation reports the
    // exact template/date issue before generation.
  }
  const selectedBed = reservation.selectedBed || {};
  const person = resolveApplicantIdentity({ reservation });
  const number = await generateContractNumber(branch);

  try {
    const created = await Contract.create({
      ...number,
      contractPurpose: "initial",
      initialContractKey: `reservation:${reservation._id}`,
      initialStayKey: effectiveStayId ? `stay:${effectiveStayId}` : null,
      tenantId: tenant._id,
      applicationId: reservation._id,
      reservationId: reservation._id,
      stayId: effectiveStayId,
      roomId: room._id,
      branch,
      version: previousContract ? previousContract.version + 1 : 1,
      previousContractId: previousContract?._id || null,
      templateType: resolvedTemplate?.templateId ||
        `${canonicalRoomType.replaceAll("-", "_")}_${pricing.leaseType}`,
      roomType: canonicalRoomType,
      leaseType: pricing.leaseType,
      propertyName: property.propertyName,
      propertyAddress: property.propertyAddress,
      roomNumber: room.roomNumber,
      bedId: canonicalRoomType === "private" ? "" : (stay?.bedId || selectedBed.id || ""),
      bedLabel: canonicalRoomType === "private" ? "" : (stay?.bedCode || getBedLabel(selectedBed)),
      tenantLegalName: person.fullName || "",
      tenantAddress: person.currentAddress || formatReservationAddress(reservation.address) || "",
      tenantEmail: person.email || "",
      tenantPhone: person.phone || "",
      tenantNationality: person.nationality || "",
      tenantBirthDate: person.birthDate || null,
      leaseStartDate,
      leaseEndDate,
      leaseDurationMonths,
      regularMonthlyRate: pricing.regularMonthlyRate,
      discountPercentage: pricing.discountPercentage,
      discountType: pricing.discountPercentage === 0 ? "none" : "percentage",
      discountAmount: pricing.discountAmount,
      approvedMonthlyRate: pricing.approvedMonthlyRate,
      advanceRentAmount:
        structuredSnapshot?.advanceRentAmount ?? financial.advanceRent,
      securityDepositAmount:
        structuredSnapshot?.securityDepositAmount ?? financial.securityDeposit,
      reservationFeeAmount:
        structuredSnapshot?.reservationFeeAmount ?? reservation.reservationFeeAmount ?? null,
      reservationFeeCreditAmount:
        structuredSnapshot && reservation.reservationFeePaymentStatus === "verified"
          ? structuredSnapshot.reservationFeeAmount
          : reservation.reservationFeeAmount ?? null,
      pricingApprovalId: reservation._id,
      pricingApprovedBy:
        structuredSnapshot?.approvedBy || reservation.applicationReviewedBy || null,
      pricingApprovedAt:
        structuredSnapshot?.approvedAt || reservation.approvedForPaymentAt || reservation.approvedDate || null,
      advanceCoverageStart:
        reservation.advanceCoverageStart || leaseStartDate,
      advanceCoverageEnd:
        reservation.advanceCoverageEnd ||
        (leaseStartDate
          ? dayjs(leaseStartDate).add(1, "month").subtract(1, "day").toDate()
          : null),
      status: "draft",
      statusHistory: [{ status: "draft", changedBy: actorId, reason: "Contract draft created" }],
      createdBy: actorId,
      updatedBy: actorId,
    });

    if (previousContract) {
      await Contract.updateOne(
        { _id: previousContract._id },
        { $set: { supersededByContractId: created._id, supersededBy: created._id } },
      );
    }

    return created;
  } catch (error) {
    if (
      error?.code === 11000 &&
      (error?.keyPattern?.initialContractKey || error?.keyPattern?.initialStayKey)
    ) {
      const winner = await Contract.findOne({
        isCurrent: true,
        $or: [
          { initialContractKey: `reservation:${reservation._id}` },
          ...(effectiveStayId ? [{ initialStayKey: `stay:${effectiveStayId}` }] : []),
        ],
      }).select(
        "_id contractNumber status tenantLegalName branch roomNumber bedLabel bedId updatedAt",
      ).lean();
      if (winner) throw duplicateContractError(winner);
      throw serviceError(
        "A contract already exists for this approved reservation or stay.",
        "DUPLICATE_CONTRACT",
        409,
      );
    }
    throw error;
  }
};

export const getContractValidation = (contract) => {
  const required = [
    ["tenantLegalName", "Tenant legal name"],
    ["tenantAddress", "Tenant address"],
    ["branch", "Branch"],
    ["roomId", "Room"],
    ["roomNumber", "Room number"],
    ["bedId", "Bed or slot"],
    ["leaseStartDate", "Lease start date"],
    ["leaseEndDate", "Lease end date"],
    ["leaseDurationMonths", "Lease duration"],
    ["regularMonthlyRate", "Approved regular monthly rate"],
    ["discountPercentage", "Approved discount percentage"],
    ["discountAmount", "Approved discount amount"],
    ["approvedMonthlyRate", "Approved monthly rate"],
    ["advanceRentAmount", "Advance rent"],
    ["securityDepositAmount", "Security deposit"],
    ["reservationFeeAmount", "Reservation fee"],
    ["reservationFeeCreditAmount", "Reservation-fee credit"],
    ["advanceCoverageStart", "Advance-rent coverage start"],
    ["advanceCoverageEnd", "Advance-rent coverage end"],
    ["pricingApprovalId", "Pricing approval record"],
    ["pricingApprovedBy", "Pricing approving administrator"],
    ["pricingApprovedAt", "Pricing approval date"],
  ];
  const missingFields = required
    .filter(([field]) => contract[field] === null || contract[field] === undefined || contract[field] === "")
    .map(([field, label]) => ({ field, label }));
  return { valid: missingFields.length === 0, missingFields, conflicts: [], warnings: [] };
};

export const validateContractForGeneration = async (
  contract,
  { requestedTemplateId = null } = {},
) => {
  const base = getContractValidation(contract);
  const result = {
    valid: false,
    status: "incomplete",
    template: null,
    generationData: null,
    missingFields: [...base.missingFields],
    conflicts: [...base.conflicts],
    warnings: [...base.warnings],
    errors: [],
    pricingValidation: null,
  };

  if (!contract.tenantNationality) {
    result.missingFields.push({ field: "tenantNationality", label: "Tenant nationality" });
  }
  if (!contract.tenantBirthDate) {
    result.missingFields.push({ field: "tenantBirthDate", label: "Tenant birth date" });
  }

  if (contract.stayId) {
    const duplicate = await Contract.exists({
      stayId: contract.stayId,
      isCurrent: true,
      _id: { $ne: contract._id },
    });
    if (duplicate) {
      result.conflicts.push({
        code: "DUPLICATE_CURRENT_CONTRACT",
        message: "Another current Contract exists for this Stay.",
      });
    }
  }

  try {
    const generationData = await buildContractGenerationData(contract, {
      requestedTemplateId,
    });
    result.generationData = generationData;
    result.template = generationData.template;
    result.pricingValidation = generationData.pricingValidation;
    if ((generationData.tenant.tenantAgeAtGeneration ?? 0) < 18) {
      result.conflicts.push({
        code: "TENANT_LEGAL_AGE_REQUIRED",
        message: "Tenant must be of legal age at Contract generation.",
      });
    }
    result.errors.push(...generationData.pricingValidation.errors);
    result.warnings.push(...generationData.pricingValidation.warnings);
  } catch (error) {
    result.errors.push({
      code: error.code || "CONTRACT_GENERATION_DATA_INVALID",
      message: error.message,
      details: error.details,
    });
  }

  result.valid =
    result.missingFields.length === 0 &&
    result.conflicts.length === 0 &&
    result.errors.length === 0 &&
    result.warnings.length === 0;
  result.status = result.valid ? "ready_for_generation" : "incomplete";
  return result;
};

export const validateContractRoomAssignment = async (contract) => {
  const room = await Room.findById(contract.roomId).lean();
  if (!room) {
    throw serviceError("Contract room not found.", "ROOM_NOT_FOUND", 404);
  }
  if (room.branch !== contract.branch) {
    throw serviceError(
      "The assigned Room belongs to a different Contract branch.",
      "CONTRACT_BRANCH_CONFLICT",
      409,
      {
        contractBranch: contract.branch,
        roomBranch: room.branch,
        roomId: String(room._id),
      },
    );
  }

  const actualRoomType = validateBranchRoomType(room.branch, room.type);
  const snapshotRoomType = normalizeContractRoomType(contract.roomType);
  if (snapshotRoomType !== actualRoomType) {
    throw serviceError(
      "The Contract room type does not match the actual assigned Room.",
      "CONTRACT_ROOM_TYPE_CONFLICT",
      409,
      {
        contractRoomType: snapshotRoomType || contract.roomType,
        actualRoomType,
        roomId: String(room._id),
      },
    );
  }
  return { room, roomType: actualRoomType };
};

export const approveContractPricing = async ({ contract, actorId, pricing, notes = "" }) => {
  if (!["draft", "incomplete", "ready_for_generation"].includes(contract.status)) {
    throw serviceError(
      "Approved legal pricing cannot be changed after Contract generation.",
      "CONTRACT_PRICING_APPROVAL_NOT_ALLOWED",
      409,
    );
  }
  const values = Object.fromEntries([
    "regularMonthlyRate", "discountPercentage", "discountAmount",
    "approvedMonthlyRate", "advanceRentAmount", "securityDepositAmount",
    "reservationFeeAmount",
  ].map((field) => [field, Number(pricing?.[field])]));
  if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
    throw serviceError("Every approved pricing value is required.", "APPROVED_PRICING_MISSING", 422);
  }
  const expectedDiscount = Math.round(values.regularMonthlyRate * values.discountPercentage) / 100;
  if (
    Math.abs(expectedDiscount - values.discountAmount) > 0.01 ||
    Math.abs(values.regularMonthlyRate - values.discountAmount - values.approvedMonthlyRate) > 0.01
  ) {
    throw serviceError("Approved pricing values are inconsistent.", "APPROVED_PRICING_CONFLICT", 422);
  }
  Object.assign(contract, values, {
    discountType: values.discountPercentage === 0 ? "none" : "percentage",
    reservationFeeCreditAmount: values.reservationFeeAmount,
    pricingApprovalId: contract.reservationId,
    pricingApprovedBy: actorId,
    pricingApprovedAt: new Date(),
    pricingApprovalNotes: String(notes || "").trim(),
    updatedBy: actorId,
  });
  await contract.save();
  return contract;
};

export const transitionContract = async (contract, nextStatus, actorId, reason = "") => {
  assertValidContractTransition(contract.status, nextStatus);
  contract.status = nextStatus;
  contract.updatedBy = actorId;
  contract.statusHistory.push({ status: nextStatus, changedBy: actorId, reason });
  if (terminalStatuses.has(nextStatus)) contract.isCurrent = false;
  await contract.save();
  return contract;
};

export const findCurrentContract = (filter) =>
  Contract.findOne({ ...filter, isCurrent: true }).sort({ version: -1, createdAt: -1 });

export const createReplacementContractForTransfer = async ({
  reservationId,
  stayId = null,
  oldContract,
  targetRoom,
  targetBed = {},
  effectiveTransferDate = new Date(),
  actorId,
  session = null,
}) => {
  if (!oldContract) {
    throw serviceError("Previous active contract is required for replacement.", "PREVIOUS_CONTRACT_REQUIRED", 400);
  }

  const reservation = await Reservation.findById(reservationId).session(session).lean();
  if (!reservation) throw serviceError("Reservation not found.", "RESERVATION_NOT_FOUND", 404);

  const [tenant, stay] = await Promise.all([
    User.findById(reservation.userId).session(session).lean(),
    stayId ? Stay.findById(stayId).session(session).lean() : Stay.findById(oldContract.stayId).session(session).lean(),
  ]);

  if (!tenant) throw serviceError("Tenant not found.", "TENANT_NOT_FOUND", 404);
  const branch = targetRoom.branch || oldContract.branch;
  const canonicalRoomType = validateBranchRoomType(branch, targetRoom.type);
  const property = resolveContractBranch(branch);

  // Mark old contract as replaced
  oldContract.status = "replaced";
  oldContract.isCurrent = false;
  oldContract.updatedBy = actorId;
  oldContract.statusHistory.push({
    status: "replaced",
    changedBy: actorId,
    changedAt: new Date(),
    reason: `Replaced by room transfer contract (${oldContract.roomNumber} -> ${targetRoom.roomNumber})`,
  });
  await oldContract.save({ session });

  const leaseStartDate = oldContract.leaseStartDate || stay?.leaseStartDate || effectiveTransferDate;
  const leaseEndDate = oldContract.leaseEndDate || stay?.leaseEndDate;
  const leaseDurationMonths = oldContract.leaseDurationMonths || (
    leaseStartDate && leaseEndDate ? Math.max(1, dayjs(leaseEndDate).diff(dayjs(leaseStartDate), "month")) : 1
  );

  const targetRate = Number(targetRoom.monthlyPrice || targetRoom.price || 0);
  const settings = await getBusinessSettings();
  const pricing = resolveContractLeasePricing({
    room: targetRoom,
    roomType: canonicalRoomType,
    leaseDurationMonths,
    approvedMonthlyRate: targetRate,
    longTermLeaseMinMonths: settings.longTermLeaseMinMonths,
  });

  let resolvedTemplate = null;
  try {
    resolvedTemplate = resolveContractTemplate({
      branch,
      roomType: canonicalRoomType,
      leaseType: pricing.isLongTerm ? "long-term" : "short-term",
      leaseStartDate,
      leaseEndDate,
      leaseDurationMonths,
    });
  } catch {
    // Template resolved on validation
  }

  const person = resolveApplicantIdentity({ contract: oldContract, reservation });
  const number = await generateContractNumber(branch, new Date(), session);

  const bedIdentifier = targetBed.id || String(targetBed._id || "");
  const bedName = targetBed.label || targetBed.code || [targetBed.bunkBlock, targetBed.position].filter(Boolean).join("-") || bedIdentifier || "";

  const createdDocs = await Contract.create(
    [
      {
        ...number,
        contractPurpose: "replacement",
        parentContractId: oldContract.parentContractId || oldContract._id,
        replacesContractId: oldContract._id,
        replacementReason: `Room transfer: ${oldContract.roomNumber} (${oldContract.bedLabel || oldContract.bedId || ""}) -> ${targetRoom.roomNumber} (${bedName})`,
        initialContractKey: null,
        initialStayKey: null,
        tenantId: tenant._id,
        applicationId: reservation._id,
        reservationId: reservation._id,
        stayId: stay?._id || oldContract.stayId || null,
        roomId: targetRoom._id,
        branch,
        version: (oldContract.version || 1) + 1,
        templateType: resolvedTemplate?.templateId || `${canonicalRoomType.replaceAll("-", "_")}_${pricing.leaseType}`,
        roomType: canonicalRoomType,
        leaseType: pricing.leaseType,
        propertyName: property.propertyName,
        propertyAddress: property.propertyAddress,
        roomNumber: targetRoom.roomNumber,
        bedId: bedIdentifier,
        bedLabel: bedName,
        tenantLegalName: oldContract.tenantLegalName || person.fullName || "",
        tenantAddress: oldContract.tenantAddress || person.currentAddress || formatReservationAddress(reservation.address) || "",
        tenantEmail: oldContract.tenantEmail || person.email || "",
        tenantPhone: oldContract.tenantPhone || person.phone || "",
        tenantNationality: oldContract.tenantNationality || person.nationality || "",
        tenantBirthDate: oldContract.tenantBirthDate || person.birthDate || null,
        leaseStartDate,
        leaseEndDate,
        leaseDurationMonths,
        regularMonthlyRate: pricing.regularMonthlyRate,
        discountPercentage: 0,
        discountType: "none",
        discountAmount: 0,
        approvedMonthlyRate: pricing.approvedMonthlyRate,
        advanceRentAmount: 0,
        securityDepositAmount: oldContract.securityDepositAmount || 0,
        reservationFeeAmount: 0,
        reservationFeeCreditAmount: 0,
        pricingApprovalId: reservation._id,
        pricingApprovedBy: actorId,
        pricingApprovedAt: new Date(),
        pricingApprovalNotes: `Auto-approved standard pricing on room transfer to ${targetRoom.roomNumber}`,
        advanceCoverageStart: oldContract.advanceCoverageStart || leaseStartDate,
        advanceCoverageEnd: oldContract.advanceCoverageEnd || (leaseStartDate ? dayjs(leaseStartDate).add(1, "month").subtract(1, "day").toDate() : null),
        status: "draft",
        statusHistory: [
          { status: "draft", changedBy: actorId, reason: `Room transfer replacement draft created (${oldContract.roomNumber} -> ${targetRoom.roomNumber})` },
        ],
        createdBy: actorId,
        updatedBy: actorId,
        isCurrent: true,
      },
    ],
    { session },
  );

  const created = createdDocs[0];
  oldContract.supersededByContractId = created._id;
  oldContract.supersededBy = created._id;
  await oldContract.save({ session });

  return created;
};

