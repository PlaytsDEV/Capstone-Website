import { USER_ROLES } from "../utils/constants.js";

export const getAuthenticatedUserDestination = (user = {}) => {
  if (
    user.role === USER_ROLES.BRANCH_ADMIN ||
    user.role === USER_ROLES.OWNER ||
    user.role === "super_admin"
  ) {
    return "/admin/dashboard";
  }

  if (user.role === USER_ROLES.TENANT) {
    return "/applicant/profile";
  }

  return "/applicant/check-availability";
};

