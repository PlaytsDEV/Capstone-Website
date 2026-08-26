import React from "react";
import { Navigate, Route, useLocation } from "react-router-dom";

function LegacyRedirect({ to }) {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: to,
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
}

export function LegacyRoutes() {
  return (
    <>
      <Route path="/admin/login" element={<Navigate to="/signin" replace />} />
      <Route path="/billing" element={<LegacyRedirect to="/applicant/billing" />} />
      <Route path="/bill-details" element={<LegacyRedirect to="/applicant/billing" />} />
      <Route path="/tenant/documents" element={<LegacyRedirect to="/applicant/contracts" />} />
      <Route path="/tenant/contracts" element={<LegacyRedirect to="/applicant/contracts" />} />
      <Route path="/documents" element={<LegacyRedirect to="/applicant/contracts" />} />
      <Route path="/contracts" element={<LegacyRedirect to="/applicant/contracts" />} />
      <Route path="/tenant/reservation" element={<LegacyRedirect to="/applicant/reservation" />} />
      <Route path="/tenant/billing" element={<LegacyRedirect to="/applicant/billing" />} />
      <Route path="/tenant/maintenance" element={<LegacyRedirect to="/applicant/maintenance" />} />
      <Route path="/tenant/announcements" element={<LegacyRedirect to="/applicant/announcements" />} />
      <Route path="/tenant/profile" element={<LegacyRedirect to="/applicant/profile" />} />
      <Route path="/tenant/account" element={<LegacyRedirect to="/applicant/profile" />} />
      <Route
        path="/tenant/forgot-password"
        element={<Navigate to="/forgot-password" replace />}
      />
      <Route
        path="/super-admin"
        element={<Navigate to="/admin/dashboard" replace />}
      />
      <Route
        path="/super-admin/users"
        element={<Navigate to="/admin/users" replace />}
      />
      <Route
        path="/super-admin/tenants"
        element={<Navigate to="/admin/tenants" replace />}
      />
      <Route
        path="/super-admin/activity-logs"
        element={<Navigate to="/admin/audit-logs" replace />}
      />
      <Route
        path="/super-admin/branches"
        element={<Navigate to="/admin/branches" replace />}
      />
      <Route
        path="/super-admin/roles"
        element={<Navigate to="/admin/roles" replace />}
      />
      <Route
        path="/super-admin/settings"
        element={<Navigate to="/admin/settings" replace />}
      />
      <Route
        path="/super-admin/backups"
        element={<Navigate to="/admin/settings?tab=backups" replace />}
      />
    </>
  );
}
