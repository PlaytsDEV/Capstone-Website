/**
 * ============================================================================
 * ROLE CONSTANTS — Single source of truth for user roles
 * ============================================================================
 *
 * Migration note:
 *   The highest-level role was historically stored as "superadmin" in some
 *   databases. The canonical value going forward is "owner". Both values are
 *   accepted by isOwnerRole() and isAdminRole() during the transition period.
 *   Run server/scripts/migrate-superadmin-to-owner.js to update existing
 *   records once you are ready to retire the legacy value.
 * ============================================================================
 */

export const ROLES = Object.freeze({
  OWNER: "owner",
  BRANCH_ADMIN: "branch_admin",
  TENANT: "tenant",
  APPLICANT: "applicant",
});

/** Legacy role value — accepted during migration, not used for new records. */
export const LEGACY_ROLES = Object.freeze({
  SUPERADMIN: "superadmin",
});

/**
 * Returns true if the role has owner-level (full cross-branch) privileges.
 * Accepts both "owner" (current) and "superadmin" (legacy) during migration.
 *
 * @param {string|undefined} role
 * @returns {boolean}
 */
export const isOwnerRole = (role) =>
  role === ROLES.OWNER || role === LEGACY_ROLES.SUPERADMIN;

/**
 * Returns true if the role has any admin-level privileges (owner or branch admin).
 *
 * @param {string|undefined} role
 * @returns {boolean}
 */
export const isAdminRole = (role) =>
  role === ROLES.OWNER ||
  role === ROLES.BRANCH_ADMIN ||
  role === LEGACY_ROLES.SUPERADMIN;

/**
 * All role values that carry admin-level access.
 * Use in MongoDB $in / $nin queries for backward compatibility.
 */
export const ADMIN_ROLE_VALUES = Object.freeze([
  ROLES.OWNER,
  ROLES.BRANCH_ADMIN,
  LEGACY_ROLES.SUPERADMIN,
]);

/**
 * Role values with owner-level (cross-branch) access.
 * Use in MongoDB $in queries for backward compatibility.
 */
export const OWNER_ROLE_VALUES = Object.freeze([
  ROLES.OWNER,
  LEGACY_ROLES.SUPERADMIN,
]);
