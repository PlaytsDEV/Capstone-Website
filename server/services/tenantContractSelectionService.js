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

// Pre-generation lifecycle stages. Excluded from the default (web "My
// Contract") eligibility set intentionally — see
// tenantContractSelectionService.test.js "does not expose an internal
// incomplete Contract" / "without exposing legacy drafts". The mobile app's
// Contract requirement is different: a tenant must see their authoritative
// Contract as soon as it exists, before the prepared PDF is generated. Opt in
// per call site with `includeEarlyStages` rather than changing the shared
// default, so web behavior is unaffected.
const EARLY_STAGE_STATUSES = new Set([
  "draft",
  "incomplete",
  "ready_for_generation",
]);

const HISTORY_VISIBLE_STATUSES = new Set([
  "expired",
  "renewed",
  "replaced",
  "terminated",
  "cancelled",
  "archived",
  "completed",
]);

const id = (value) => String(value?._id || value || "");
const sameId = (left, right) => Boolean(id(left)) && id(left) === id(right);

export const isResidentContractEligible = (contract, { includeEarlyStages = false } = {}) => {
  if (!contract) return false;
  const statusVisible = PRIMARY_VISIBLE_STATUSES.has(contract.status) ||
    (includeEarlyStages && EARLY_STAGE_STATUSES.has(contract.status));
  if (!statusVisible) return false;
  if (contract.archivedAt) return false;
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
    // Backward compatibility for verified pre-publication records created
    // before publicationStatus existed, and for freshly created Contracts
    // (publicationStatus is unset until an admin acts on it) reached via
    // includeEarlyStages.
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

// A stayId/reservationId match is only a relevance signal between Contracts
// that are otherwise equally "real" — it must never let a pre-generation
// draft outrank a Contract that has actually progressed (generated or
// beyond). Without this tier, a draft created at reservation time (and thus
// still carrying the original Stay's stayId) can outrank the tenant's later,
// fully-generated/published Contract for the same stay whenever that later
// Contract's stayId was never backfilled — reproduced in
// tenantContractSelectionService.test.js "a stale early-stage draft must
// never outrank a later fully-generated Contract for the same stay". This
// only changes ranking among candidates already passing
// isResidentContractEligible, so it can only matter when includeEarlyStages
// is true (mobile) — Web's default candidate set never contains an
// early-stage Contract in the first place, so this tier is a no-op there.
const stageTier = (contract) => (EARLY_STAGE_STATUSES.has(contract.status) ? 0 : 1);

export const selectCanonicalTenantContract = ({
  contracts = [],
  activeStay = null,
  includeEarlyStages = false,
}) => {
  const candidates = contracts
    .filter((contract) => isResidentContractEligible(contract, { includeEarlyStages }))
    .map((contract) => ({
      contract,
      rank: relationshipRank(contract, activeStay),
      tier: stageTier(contract),
    }))
    .filter(({ rank }) => rank >= 0);
  if (!candidates.length) return null;

  // Tier first (progressed Contracts always beat early-stage drafts),
  // relationship strength only breaks ties within the same tier.
  const highestTier = Math.max(...candidates.map(({ tier }) => tier));
  const tiered = candidates.filter(({ tier }) => tier === highestTier);
  const highestRank = Math.max(...tiered.map(({ rank }) => rank));
  const highest = tiered.filter(({ rank }) => rank === highestRank);
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

export const resolveTenantCanonicalContract = async (tenantId, { includeEarlyStages = false } = {}) => {
  const [activeStay, contracts] = await Promise.all([
    Stay.findOne({
      tenantId,
      status: { $in: ["active", "ending_soon"] },
    }).sort({ leaseStartDate: -1 }).lean(),
    // Ownership is unconditional (tenantId scoping only) — includeEarlyStages
    // only widens which *statuses* of the tenant's own Contracts are
    // eligible, never whose Contracts are considered.
    Contract.find({ tenantId }).sort({ createdAt: -1 }),
  ]);
  return selectCanonicalTenantContract({ contracts, activeStay, includeEarlyStages });
};

export const resolveTenantContractHistory = async (tenantId) => {
  const [canonical, contracts] = await Promise.all([
    resolveTenantCanonicalContract(tenantId).catch(() => null),
    Contract.find({ tenantId }).sort({ leaseEndDate: -1, createdAt: -1 }),
  ]);
  const canonicalId = canonical ? String(canonical._id) : null;
  return contracts.filter((contract) => {
    if (canonicalId && String(contract._id) === canonicalId) return false;
    if (contract.duplicateOfContractId) return false;
    return HISTORY_VISIBLE_STATUSES.has(contract.status);
  });
};
