export const getAuthenticatedUserDestination = (user = {}) =>
  user.role === "branch_admin" || user.role === "owner"
    ? "/admin/dashboard"
    : "/applicant/check-availability";
