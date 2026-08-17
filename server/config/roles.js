/**
 * ============================================================================
 * ROLE CONSTANTS — Single source of truth for user roles
 * ============================================================================
 *
 * The highest-level role is canonicalized as "owner".
 * ============================================================================
 */

export const ROLES = Object.freeze({
  OWNER: "owner",
  BRANCH_ADMIN: "branch_admin",
  TENANT: "tenant",
  APPLICANT: "applicant",
});

/**
 * Returns true if the role has owner-level (full cross-branch) privileges.
 *
 * @param {string|undefined} role
 * @returns {boolean}
 */
export const isOwnerRole = (role) => role === ROLES.OWNER;

/**
 * Returns true if the role has any admin-level privileges (owner or branch admin).
 *
 * @param {string|undefined} role
 * @returns {boolean}
 */
export const isAdminRole = (role) =>
  role === ROLES.OWNER || role === ROLES.BRANCH_ADMIN || role === "admin";

/**
 * All role values that carry admin-level access.
 */
export const ADMIN_ROLE_VALUES = Object.freeze([
  ROLES.OWNER,
  ROLES.BRANCH_ADMIN,
]);

/**
 * Role values with owner-level (cross-branch) access.
 */
export const OWNER_ROLE_VALUES = Object.freeze([
  ROLES.OWNER,
]);

