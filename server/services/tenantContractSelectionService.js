import { Contract, Stay } from "../models/index.js";

const PRIMARY_VISIBLE_STATUSES = new Set([
  "generated",
  "awaiting_signatures",
  "partially_signed",
  "signed",
  "awaiting_notarization",
  "notarized",
  "ready_for_publication",
  "published",
  "active",
  "expiring_soon",
]);

const HISTORY_VISIBLE_STATUSES = new Set([
  "expired",
  "renewed",
  "replaced",
  "terminated",
]);

const id = (value) => String(value?._id || value || "");
const sameId = (left, right) => Boolean(id(left)) && id(left) === id(right);

export const isResidentContractEligible = (contract) => {
  if (!contract || !PRIMARY_VISIBLE_STATUSES.has(contract.status)) return false;
  if (contract.isCurrent === false || contract.isCanonical === false) return false;
  if (contract.duplicateOfContractId || contract.supersededByContractId || contract.supersededBy) {
    return false;
  }
  if (contract.publicationStatus === "withdrawn" || contract.publicationStatus === "internal") {
    return false;
  }
  return (
    contract.tenantVisible === true ||
    ["ready_for_resident", "published"].includes(contract.publicationStatus) ||
    // Backward compatibility for verified pre-publication records created before
    // publicationStatus existed. Draft/incomplete records never enter this path.
    contract.publicationStatus == null
  );
};

const relationshipRank = (contract, activeStay) => {
  if (!activeStay) return contract.isCurrent === false ? -1 : 100;
  if (sameId(contract.stayId, activeStay._id)) return 400;
  if (sameId(contract.reservationId, activeStay.reservationId)) return 300;
  if (sameId(contract.applicationId, activeStay.reservationId)) return 200;
  return -1;
};

export const selectCanonicalTenantContract = ({ contracts = [], activeStay = null }) => {
  const candidates = contracts
    .filter(isResidentContractEligible)
    .map((contract) => ({ contract, rank: relationshipRank(contract, activeStay) }))
    .filter(({ rank }) => rank >= 0);
  if (!candidates.length) return null;

  const highestRank = Math.max(...candidates.map(({ rank }) => rank));
  const highest = candidates.filter(({ rank }) => rank === highestRank);
  if (highest.length !== 1) {
    throw Object.assign(
      new Error("Multiple resident-visible canonical Contracts were found."),
      {
        code: "MULTIPLE_CANONICAL_CONTRACTS",
        statusCode: 409,
        candidateCount: highest.length,
      },
    );
  }
  return highest[0].contract;
};

export const resolveTenantCanonicalContract = async (tenantId) => {
  const [activeStay, contracts] = await Promise.all([
    Stay.findOne({
      tenantId,
      status: { $in: ["active", "ending_soon"] },
    }).sort({ leaseStartDate: -1 }).lean(),
    Contract.find({ tenantId }).sort({ createdAt: -1 }),
  ]);
  return selectCanonicalTenantContract({ contracts, activeStay });
};

export const resolveTenantContractHistory = async (tenantId) => {
  const contracts = await Contract.find({ tenantId }).sort({ leaseEndDate: -1, createdAt: -1 });
  return contracts.filter((contract) =>
    HISTORY_VISIBLE_STATUSES.has(contract.status) &&
    !contract.duplicateOfContractId &&
    contract.isCanonical !== false,
  );
};
