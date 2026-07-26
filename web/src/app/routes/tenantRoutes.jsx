import React from "react";
import { Navigate, Route } from "react-router-dom";
import ProtectedRoute from "../../shared/components/ProtectedRoute";
import TenantLayout from "../../shared/layouts/TenantLayout";
import { RouteShell } from "./RouteShell";
import {
  CheckAvailabilityPage,
  ReservationFlowPage,
  ProfilePage,
  ContractsPage,
  TenantBillingPage,
  TenantMaintenancePage,
  TenantAnnouncementsPage,
} from "../lazyPages";

import CheckAvailabilityPageSkeleton from "../../features/tenant/components/check-availability/CheckAvailabilityPageSkeleton";
import TenantLayoutSkeleton from "../../shared/layouts/TenantLayoutSkeleton";
import ProfilePageSkeleton from "../../features/tenant/components/profile/ProfilePageSkeleton";
import ContractsPageSkeleton from "../../features/tenant/components/contracts/ContractsPageSkeleton";
import BillingPageSkeleton from "../../features/tenant/components/billing/BillingPageSkeleton";
import MaintenancePageSkeleton from "../../features/tenant/components/maintenance/MaintenancePageSkeleton";
import AnnouncementsPageSkeleton from "../../features/tenant/components/announcements/AnnouncementsPageSkeleton";
import ReservationPageSkeleton from "../../features/tenant/components/reservation/ReservationPageSkeleton";

export function TenantRoutes() {
  return (
    <>
      <Route path="/applicant" element={<Navigate to="/applicant/profile" replace />} />
      <Route
        path="/applicant/dashboard"
        element={
          <ProtectedRoute requiredRole="applicant">
            <Navigate to="/applicant/profile" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applicant/rooms"
        element={
          <ProtectedRoute requiredRole="applicant">
            <Navigate to="/applicant/check-availability" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applicant/check-availability"
        element={
          <ProtectedRoute requiredRole="applicant" requireAuth={false}>
            <RouteShell name="CheckAvailability" fallback={<CheckAvailabilityPageSkeleton />}>
              <CheckAvailabilityPage />
            </RouteShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/applicant"
        element={
          <ProtectedRoute requiredRole="applicant">
            <RouteShell name="TenantLayout" fallback={<TenantLayoutSkeleton />}>
              <TenantLayout />
            </RouteShell>
          </ProtectedRoute>
        }
      >
        <Route
          path="reservation"
          element={
            <RouteShell name="ReservationFlow" fallback={<ReservationPageSkeleton />}>
              <ReservationFlowPage />
            </RouteShell>
          }
        />
        <Route
          path="profile"
          element={
            <RouteShell name="Profile" fallback={<ProfilePageSkeleton />}>
              <ProfilePage />
            </RouteShell>
          }
        />
        <Route
          path="contracts"
          element={
            <ProtectedRoute requiredRole="tenant">
              <RouteShell name="Contracts" fallback={<ContractsPageSkeleton />}>
                <ContractsPage />
              </RouteShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="billing"
          element={
            <ProtectedRoute requiredRole="tenant">
              <RouteShell name="Billing" fallback={<BillingPageSkeleton />}>
                <TenantBillingPage />
              </RouteShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="maintenance"
          element={
            <ProtectedRoute requiredRole="tenant">
              <RouteShell name="Maintenance" fallback={<MaintenancePageSkeleton />}>
                <TenantMaintenancePage />
              </RouteShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="announcements"
          element={
            <ProtectedRoute requiredRole="tenant">
              <RouteShell name="Announcements" fallback={<AnnouncementsPageSkeleton />}>
                <TenantAnnouncementsPage />
              </RouteShell>
            </ProtectedRoute>
          }
        />
      </Route>
    </>
  );
}
