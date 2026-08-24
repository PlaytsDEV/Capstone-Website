import mongoose from "mongoose";
import logger from "../middleware/logger.js";
import { Contract, Reservation, Room, Stay, User } from "../models/index.js";
import { readMoveInDate } from "../utils/lifecycleNaming.js";
import { resolveReservationContractEligibility } from "./reservationContractEligibilityService.js";
import {
  deriveAdvanceCoverageDates,
  deriveContractLeaseDates,
} from "./contractLeaseDateService.js";
import {
  getContractValidation,
  validateContractForGeneration,
} from "./contractService.js";

const sameId = (left, right) =>
  Boolean(left) && Boolean(right) && String(left?._id || left) === String(right?._id || right);

const validDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const sameDate = (left, right) => {
  const a = validDate(left);
  const b = validDate(right);
  return Boolean(a && b && a.getTime() === b.getTime());
};

const addReason = (reasons, condition, reason) => {
  if (condition) reasons.push(reason);
};

const tenantName = (tenant, contract) =>
  [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ").trim() ||
  contract?.tenantLegalName ||
  "Unknown tenant";

const reservationLabel = (reservation) =>
  reservation?.reservationCode || String(reservation?._id || "");

const hasLegalArtifact = (contract) => Boolean(
  contract?.finalDocument ||
  contract?.finalStorageKey ||
  contract?.signedStorageKey ||
  contract?.notarizedStorageKey ||
  contract?.generatedStorageKey ||
  contract?.preparedDocuments?.length ||
  contract?.signedDocuments?.length,
);

const diagnosticBlocker = (validation) =>
  validation?.missingFields?.[0]?.field ||
  validation?.conflicts?.[0]?.code ||
  validation?.errors?.[0]?.code ||
  validation?.warnings?.[0]?.code ||
  null;

export const buildContractDateRecoveryReport = async ({
  contract,
  reservation,
  room,
  tenant,
  stays = [],
  relatedContracts = [],
}) => {
  const reasons = [];
  const moveIn = readMoveInDate(reservation, { includeSource: true });
  const resolvedMoveInDate = validDate(moveIn.value);
  const duration = Number(contract?.leaseDurationMonths);
  let proposedLeaseDates = null;
  let proposedCoverageDates = null;

  addReason(reasons, !contract, "Contract record is missing.");
  addReason(reasons, !reservation, "Authoritative Reservation record is missing.");
  addReason(reasons, !tenant, "Contract tenant record is missing.");
  addReason(reasons, !room, "Authoritative assigned Room record is missing.");
  if (!contract || !reservation) {
    return {
      contractId: String(contract?._id || ""),
      contractNumber: contract?.contractNumber || "",
      tenant: tenantName(tenant, contract),
      reservation: reservationLabel(reservation),
      branch: contract?.branch || room?.branch || "",
      currentStatus: contract?.status || null,
      currentLeaseStartDate: contract?.leaseStartDate || null,
      currentLeaseEndDate: contract?.leaseEndDate || null,
      resolvedMoveInDate,
      resolvedSourceField: moveIn.sourceField,
      proposedLeaseStartDate: null,
      proposedLeaseEndDate: null,
      eligible: false,
      reasons,
      beforeValidation: contract ? getContractValidation(contract) : null,
      proposedValidation: null,
      updates: null,
    };
  }

  addReason(reasons, contract.contractPurpose !== "initial", "Contract is not an initial Contract.");
  addReason(reasons, contract.isCurrent !== true, "Contract is not current.");
  addReason(reasons, contract.status !== "draft", `Contract status is ${contract.status}, not draft.`);
  addReason(
    reasons,
    contract.leaseStartDate !== null && contract.leaseStartDate !== undefined,
    "A lease start date already exists; recovery will not overwrite it.",
  );
  addReason(
    reasons,
    contract.leaseEndDate !== null && contract.leaseEndDate !== undefined,
    "A lease end date already exists; recovery will not overwrite it.",
  );
  addReason(reasons, hasLegalArtifact(contract), "Contract already has a legal document artifact.");
  addReason(reasons, Boolean(contract.archivedAt), "Contract is archived.");
  addReason(
    reasons,
    Boolean(contract.duplicateOfContractId || contract.supersededByContractId || contract.supersededBy),
    "Contract is marked duplicate or superseded.",
  );
  addReason(
    reasons,
    !sameId(contract.reservationId, reservation._id),
    "Contract reservationId does not match the authoritative Reservation.",
  );
  addReason(
    reasons,
    Boolean(contract.applicationId) && !sameId(contract.applicationId, reservation._id),
    "Contract applicationId conflicts with its Reservation.",
  );
  addReason(
    reasons,
    !sameId(contract.tenantId, reservation.userId) || !sameId(contract.tenantId, tenant?._id),
    "Contract does not belong to the Reservation tenant.",
  );
  addReason(
    reasons,
    !sameId(contract.roomId, reservation.roomId) || !sameId(contract.roomId, room?._id),
    "Contract does not point to the authoritative Reservation room.",
  );
  addReason(
    reasons,
    Boolean(room) && contract.branch !== room.branch,
    "Contract branch conflicts with the authoritative Room branch.",
  );
  if (moveIn.sourceField !== "targetMoveInDate") {
    const target = validDate(reservation.targetMoveInDate);
    reasons.push(
      target && resolvedMoveInDate && !sameDate(target, resolvedMoveInDate)
        ? `Canonical ${moveIn.sourceField} (${resolvedMoveInDate.toISOString()}) conflicts with targetMoveInDate (${target.toISOString()}).`
        : `Canonical move-in source is ${moveIn.sourceField || "missing"}, not targetMoveInDate.`,
    );
  }
  addReason(reasons, !resolvedMoveInDate, "Canonical move-in date is missing or invalid.");
  addReason(
    reasons,
    !Number.isInteger(duration) || duration < 1,
    "Contract lease duration is missing or invalid.",
  );
  if (
    reservation.leaseDuration !== null &&
    reservation.leaseDuration !== undefined &&
    Number(reservation.leaseDuration) !== duration
  ) {
    reasons.push("Reservation and Contract lease durations conflict.");
  }

  if (resolvedMoveInDate && Number.isInteger(duration) && duration > 0) {
    try {
      proposedLeaseDates = deriveContractLeaseDates({
        leaseStartDate: resolvedMoveInDate,
        leaseDurationMonths: duration,
      });
      proposedCoverageDates = deriveAdvanceCoverageDates(resolvedMoveInDate);
    } catch (error) {
      reasons.push(error.message);
    }
  }

  const authoritativeStay = stays.find((stay) => sameId(stay._id, contract.stayId)) ||
    stays.find((stay) => sameId(stay._id, reservation.currentStayId)) ||
    stays.find((stay) => ["active", "ending_soon"].includes(stay.status)) ||
    null;
  if (contract.stayId && !authoritativeStay) {
    reasons.push("Contract stayId does not resolve to a Stay for this Reservation.");
  }
  for (const stay of stays) {
    addReason(
      reasons,
      !sameId(stay.reservationId, reservation._id),
      `Stay ${stay._id} does not belong to the Reservation.`,
    );
    addReason(
      reasons,
      Boolean(stay.tenantId) && !sameId(stay.tenantId, contract.tenantId),
      `Stay ${stay._id} belongs to a different tenant.`,
    );
    addReason(
      reasons,
      Boolean(stay.branch) && stay.branch !== contract.branch,
      `Stay ${stay._id} belongs to a different branch.`,
    );
  }
  if (authoritativeStay?.leaseStartDate && proposedLeaseDates) {
    addReason(
      reasons,
      !sameDate(authoritativeStay.leaseStartDate, proposedLeaseDates.leaseStartDate),
      "Authoritative Stay lease start date conflicts with targetMoveInDate.",
    );
  }
  if (authoritativeStay?.leaseEndDate && proposedLeaseDates) {
    addReason(
      reasons,
      !sameDate(authoritativeStay.leaseEndDate, proposedLeaseDates.leaseEndDate),
      "Authoritative Stay lease end date conflicts with the canonical Contract term.",
    );
  }

  const otherContracts = relatedContracts.filter((entry) => !sameId(entry._id, contract._id));
  addReason(
    reasons,
    otherContracts.some((entry) => entry.isCurrent === true),
    "Another current Contract exists for this Reservation.",
  );
  addReason(
    reasons,
    otherContracts.some((entry) => (
      Number(entry.version || 0) > Number(contract.version || 0) ||
      new Date(entry.createdAt || 0).getTime() > new Date(contract.createdAt || 0).getTime()
    )),
    "A newer Contract exists for this Reservation.",
  );

  const eligibility = resolveReservationContractEligibility(reservation, {
    tenantExists: Boolean(tenant),
    roomExists: Boolean(room),
    roomType: room?.type,
    bedExists: Boolean(
      authoritativeStay?.bedId ||
      authoritativeStay?.bedCode ||
      contract.bedId ||
      contract.bedLabel,
    ),
  });
  if (!eligibility.eligible) {
    reasons.push(
      `Reservation is not eligible for Contract generation: ${eligibility.blockers[0]?.code || "UNKNOWN_BLOCKER"}.`,
    );
  }

  const expectedCoverageStart = reservation.advanceCoverageStart ||
    proposedCoverageDates?.advanceCoverageStart || null;
  const expectedCoverageEnd = reservation.advanceCoverageEnd ||
    proposedCoverageDates?.advanceCoverageEnd || null;
  const coverageStartPresent = Boolean(contract.advanceCoverageStart);
  const coverageEndPresent = Boolean(contract.advanceCoverageEnd);
  if (coverageStartPresent !== coverageEndPresent) {
    reasons.push("Contract has a partial advance-rent coverage date set.");
  } else if (coverageStartPresent && coverageEndPresent) {
    addReason(
      reasons,
      !sameDate(contract.advanceCoverageStart, expectedCoverageStart) ||
        !sameDate(contract.advanceCoverageEnd, expectedCoverageEnd),
      "Existing advance-rent coverage dates conflict with the canonical lease start.",
    );
  }

  const updates = proposedLeaseDates
    ? {
        leaseStartDate: proposedLeaseDates.leaseStartDate,
        leaseEndDate: proposedLeaseDates.leaseEndDate,
        ...(!coverageStartPresent && !coverageEndPresent
          ? {
              advanceCoverageStart: expectedCoverageStart,
              advanceCoverageEnd: expectedCoverageEnd,
            }
          : {}),
      }
    : null;
  const proposedContract = updates ? { ...contract, ...updates } : contract;
  let proposedValidation = null;
  if (reasons.length === 0) {
    proposedValidation = await validateContractForGeneration(proposedContract);
  }

  return {
    contractId: String(contract._id),
    contractNumber: contract.contractNumber,
    tenant: tenantName(tenant, contract),
    reservation: reservationLabel(reservation),
    reservationId: String(reservation._id),
    tenantId: String(contract.tenantId),
    branch: contract.branch,
    currentStatus: contract.status,
    currentLeaseStartDate: contract.leaseStartDate || null,
    currentLeaseEndDate: contract.leaseEndDate || null,
    resolvedMoveInDate,
    resolvedSourceField: moveIn.sourceField,
    proposedLeaseStartDate: proposedLeaseDates?.leaseStartDate || null,
    proposedLeaseEndDate: proposedLeaseDates?.leaseEndDate || null,
    eligible: reasons.length === 0,
    reasons,
    beforeValidation: getContractValidation(contract),
    proposedValidation,
    updates,
  };
};

const loadRecoveryContext = async (contract) => {
  const reservation = contract?.reservationId
    ? await Reservation.findById(contract.reservationId).lean()
    : null;
  const [room, tenant, stays, relatedContracts] = await Promise.all([
    reservation?.roomId ? Room.findById(reservation.roomId).lean() : null,
    contract?.tenantId ? User.findById(contract.tenantId).lean() : null,
    reservation?._id ? Stay.find({ reservationId: reservation._id }).lean() : [],
    reservation?._id
      ? Contract.find({
          $or: [
            { reservationId: reservation._id },
            { applicationId: reservation._id },
          ],
        }).lean()
      : [],
  ]);
  return { contract, reservation, room, tenant, stays, relatedContracts };
};

export const inspectContractDateRecovery = async (contractId) => {
  const contract = await Contract.findById(contractId).lean();
  return buildContractDateRecoveryReport(await loadRecoveryContext(contract));
};

export const repairContractDraftDates = async ({ contractId, actorId }) => {
  const report = await inspectContractDateRecovery(contractId);
  if (!report.eligible) {
    logger.warn(
      {
        contractId: report.contractId,
        contractNumber: report.contractNumber,
        reservationId: report.reservationId,
        tenantId: report.tenantId,
        missingRequiredField: report.beforeValidation?.missingFields?.[0]?.field || null,
        resolvedMoveInDateSource: report.resolvedSourceField,
        currentLifecycleStatus: report.currentStatus,
        blockingReason: report.reasons[0] || "NOT_ELIGIBLE_FOR_DETERMINISTIC_REPAIR",
      },
      "Existing Contract draft could not be deterministically recovered",
    );
    return { report, mutations: 0, repaired: false, contract: null };
  }

  const now = new Date();
  const result = await Contract.collection.updateOne(
    {
      _id: new mongoose.Types.ObjectId(contractId),
      tenantId: new mongoose.Types.ObjectId(report.tenantId),
      reservationId: new mongoose.Types.ObjectId(report.reservationId),
      isCurrent: true,
      status: "draft",
      leaseStartDate: null,
      leaseEndDate: null,
      archivedAt: null,
    },
    {
      $set: {
        ...report.updates,
        ...(actorId ? { updatedBy: new mongoose.Types.ObjectId(actorId) } : {}),
        updatedAt: now,
      },
    },
  );
  if (result.modifiedCount !== 1) {
    const current = await Contract.findById(contractId);
    return { report, mutations: 0, repaired: false, contract: current, stale: true };
  }

  const repaired = await Contract.findById(contractId);
  const validation = await validateContractForGeneration(repaired);
  logger.info(
    {
      contractId: repaired._id,
      contractNumber: repaired.contractNumber,
      reservationId: repaired.reservationId,
      tenantId: repaired.tenantId,
      missingRequiredField: validation.missingFields?.[0]?.field || null,
      resolvedMoveInDateSource: report.resolvedSourceField,
      currentLifecycleStatus: repaired.status,
      blockingReason: diagnosticBlocker(validation),
    },
    "Existing Contract draft canonical dates recovered and normal validation re-run",
  );
  return {
    report,
    mutations: 1,
    repaired: true,
    contract: repaired,
    validation,
  };
};

export const auditContractDraftDateRecovery = async ({ contractNumber = null } = {}) => {
  const query = {
    isCurrent: true,
    contractPurpose: { $in: ["initial", null] },
    isTestRecord: { $ne: true },
    ...(contractNumber ? { contractNumber } : {}),
  };
  const contracts = await Contract.find(query).sort({ branch: 1, contractNumber: 1 }).lean();
  const candidates = [];
  let alreadyHealthy = 0;

  for (const contract of contracts) {
    if (contract.leaseStartDate && contract.leaseEndDate) {
      alreadyHealthy += 1;
      continue;
    }
    if (
      contract.status !== "draft" ||
      contract.leaseStartDate !== null ||
      contract.leaseEndDate !== null
    ) {
      continue;
    }
    const context = await loadRecoveryContext(contract);
    if (!validDate(context.reservation?.targetMoveInDate)) continue;
    candidates.push(await buildContractDateRecoveryReport(context));
  }

  return {
    totalScanned: contracts.length,
    matchingCandidates: candidates.length,
    safeCandidates: candidates.filter((candidate) => candidate.eligible).length,
    ambiguous: candidates.filter((candidate) => !candidate.eligible).length,
    alreadyHealthy,
    candidates,
  };
};
