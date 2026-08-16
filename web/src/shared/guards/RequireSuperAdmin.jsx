/**
 * =============================================================================
 * LEGACY OWNER GUARD (@deprecated)
 * =============================================================================
 *
 * Legacy route protection component that maps to the canonical `owner` role.
 * Prefer using `RequireOwner` directly.
 *
 * Allowed Roles: 'owner' only
 * Redirects to: /signin (if not owner)
 * =============================================================================
 */

import React from "react";
import RequireOwner from "./RequireOwner";

/**
 * Guard component that requires owner role
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Protected owner content
 * @returns {React.ReactElement} Children if owner, redirect otherwise
 */
const RequireSuperAdmin = ({ children }) => {
  return <RequireOwner>{children}</RequireOwner>;
};

export default RequireSuperAdmin;
