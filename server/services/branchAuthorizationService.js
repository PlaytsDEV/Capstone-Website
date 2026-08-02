import { ROOM_BRANCHES } from "../config/branches.js";
import { ROLES, isOwnerRole } from "../config/roles.js";
import auditLogger from "../utils/auditLogger.js";
import { checkBranchAccess } from "../utils/reservationHelpers.js";

const normalizeBranch = (value) => {
  const raw = value?.branch ?? value;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return ROOM_BRANCHES.includes(normalized) ? normalized : null;
};

const denialStatus = (code) =>
  ["BRANCH_RELATIONSHIP_INCONSISTENT", "BILL_BRANCH_MISMATCH", "TARGET_ROOM_BRANCH_MISMATCH"].includes(code) ? 409 :
    code === "TARGET_BED_MISMATCH" ? 422 :
    code === "TARGET_BRANCH_UNRESOLVED" ? 422 : 403;

const denialMessage = (code) => {
  if (code === "BRANCH_RELATIONSHIP_INCONSISTENT") {
    return "The linked records have inconsistent branch assignments and require review.";
  }
  if (code === "TARGET_BRANCH_UNRESOLVED") {
    return "The target branch could not be verified. This action requires review.";
  }
  if (code === "TARGET_BED_MISMATCH") {
    return "The selected bed does not belong to the authoritative Room.";
  }
  if (code === "TARGET_ROOM_BRANCH_MISMATCH" || code === "BILL_BRANCH_MISMATCH") {
    return "The linked operational records are inconsistent and require review.";
  }
  if (code === "BRANCH_SCOPE_MISSING") {
    return "Your branch authorization scope could not be verified.";
  }
  return "You do not have access to perform this action for the selected branch.";
};

async function recordDeniedAttempt(req, { action, targetBranch, code, entityType, entityId }) {
  await auditLogger.log({
    req,
    type: "security",
    action: "authorization.branch_action_denied",
    severity: "warning",
    entityType: entityType || "system",
    entityId,
    details: "A branch-scoped administrative action was denied before mutation.",
    metadata: {
      requestedAction: action,
      actorBranch: req.branchFilter ?? null,
      targetBranch: targetBranch ?? null,
      denialReason: code,
      branchAccessResult: "denied",
      requestId: req.id || null,
      requestTimestamp: new Date().toISOString(),
    },
  });
}

async function deny(req, res, context, code) {
  await recordDeniedAttempt(req, { ...context, code });
  res.status(denialStatus(code)).json({
    success: false,
    error: denialMessage(code),
    code,
  });
  return null;
}

export const denyBranchAction = (req, res, context, code) =>
  deny(req, res, context, code);

/**
 * Resolve and enforce a branch from authoritative server-side relations.
 * Every required source must be present and all supplied sources must agree.
 */
export async function enforceAuthoritativeBranch({
  req,
  res,
  action,
  entityType,
  entityId,
  sources,
}) {
  const context = { action, entityType, entityId };
  if (req.branchFilter === undefined || typeof req.isOwner !== "boolean") {
    return deny(req, res, context, "BRANCH_SCOPE_MISSING");
  }

  const role = req.authUser?.role;
  const owner = isOwnerRole(role);
  if (
    (owner && (!req.isOwner || req.branchFilter !== null)) ||
    (!owner && (role !== ROLES.BRANCH_ADMIN || req.isOwner))
  ) {
    return deny(req, res, context, "BRANCH_SCOPE_MISSING");
  }

  const resolved = [];
  for (const source of sources || []) {
    const branch = normalizeBranch(source.value);
    if (source.required !== false && !branch) {
      return deny(req, res, context, "TARGET_BRANCH_UNRESOLVED");
    }
    if (branch) resolved.push({ source: source.source, branch });
  }
  if (resolved.length === 0) {
    return deny(req, res, context, "TARGET_BRANCH_UNRESOLVED");
  }

  const branches = [...new Set(resolved.map((entry) => entry.branch))];
  if (branches.length !== 1) {
    return deny(
      req,
      res,
      { ...context, targetBranch: branches.join(",") },
      "BRANCH_RELATIONSHIP_INCONSISTENT",
    );
  }

  const branchId = branches[0];
  if (!owner) {
    const scopedBranch = normalizeBranch(req.branchFilter);
    if (!scopedBranch) {
      return deny(req, res, { ...context, targetBranch: branchId }, "BRANCH_SCOPE_MISSING");
    }
    const branchProbe = {
      status() { return this; },
      json() { return this; },
    };
    const denied = checkBranchAccess(branchProbe, scopedBranch, branchId);
    if (denied) {
      return deny(
        req,
        res,
        { ...context, targetBranch: branchId },
        "BRANCH_ACCESS_DENIED",
      );
    }
  }

  return {
    branchId,
    source: resolved.map((entry) => entry.source).join(","),
    consistencyChecked: resolved.length > 1,
    branchAccessResult: "allowed",
  };
}

export function roomContainsBed(room, bedId) {
  if (!room || !bedId) return false;
  return Boolean(
    room.beds?.some(
      (bed) => String(bed.id ?? bed._id) === String(bedId),
    ),
  );
}

export async function logBranchScopedSuccess({
  req,
  action,
  entityType,
  entityId,
  branchContext,
  previousState,
  newState,
  reason,
  linkedRecords = {},
  financial = null,
}) {
  await auditLogger.log({
    req,
    type: "data_modification",
    action,
    severity: "high",
    entityType,
    entityId,
    details: reason,
    metadata: {
      actorBranchScope: req.branchFilter ?? "global",
      targetBranch: branchContext.branchId,
      branchSource: branchContext.source,
      consistencyChecked: branchContext.consistencyChecked,
      branchAccessResult: "allowed",
      previousState,
      newState,
      reason,
      linkedRecords,
      financial,
      requestId: req.id || null,
      requestTimestamp: new Date().toISOString(),
    },
  });
}
