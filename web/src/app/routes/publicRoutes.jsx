import React from "react";
import { Route } from "react-router-dom";
import RequireNonAdmin from "../../shared/guards/RequireNonAdmin";
import ProtectedRoute from "../../shared/components/ProtectedRoute";
import { RouteShell } from "./RouteShell";
import { PublicFrame } from "./PublicFrame";
import GlobalLoading from "../../shared/components/GlobalLoading";
import {
  LandingPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
  SignIn,
  SignUp,
  ForgotPassword,
  OtpVerify,
  AuthAction,
  ResetPassword,
  PublicStayVerificationPage,
} from "../lazyPages";

export function PublicRoutes() {
  return (
    <>
      <Route
        path="/verify-stay/:referenceId"
        element={
          <RouteShell name="PublicStayVerification" fallback={<GlobalLoading />}>
            <PublicStayVerificationPage />
          </RouteShell>
        }
      />
      <Route element={<PublicFrame />}>
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRole="applicant" requireAuth={false}>
              <RouteShell name="LandingPage" fallback={<GlobalLoading />}>
                <LandingPage />
              </RouteShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/privacy-policy"
          element={
            <RouteShell name="PrivacyPolicy" fallback={<GlobalLoading />}>
              <PrivacyPolicyPage />
            </RouteShell>
          }
        />
        <Route
          path="/terms-of-service"
          element={
            <RouteShell name="TermsOfService" fallback={<GlobalLoading />}>
              <TermsOfServicePage />
            </RouteShell>
          }
        />
        <Route
          path="/signin"
          element={
            <RequireNonAdmin>
              <RouteShell name="SignIn" fallback={<GlobalLoading />}>
                <SignIn />
              </RouteShell>
            </RequireNonAdmin>
          }
        />
        <Route
          path="/signup"
          element={
            <RequireNonAdmin>
              <RouteShell name="SignUp" fallback={<GlobalLoading />}>
                <SignUp />
              </RouteShell>
            </RequireNonAdmin>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RequireNonAdmin>
              <RouteShell name="ForgotPassword" fallback={<GlobalLoading />}>
                <ForgotPassword />
              </RouteShell>
            </RequireNonAdmin>
          }
        />
        <Route
          path="/verify-otp"
          element={
            <RequireNonAdmin>
              <RouteShell name="OtpVerify" fallback={<GlobalLoading />}>
                <OtpVerify />
              </RouteShell>
            </RequireNonAdmin>
          }
        />
        <Route
          path="/auth-action"
          element={
            <RouteShell name="AuthAction" fallback={<GlobalLoading />}>
              <AuthAction />
            </RouteShell>
          }
        />
        <Route
          path="/auth_action"
          element={
            <RouteShell name="AuthActionUnderscoreAlias" fallback={<GlobalLoading />}>
              <AuthAction />
            </RouteShell>
          }
        />
        <Route
          path="/reset-password"
          element={
            <RouteShell name="ResetPassword" fallback={<GlobalLoading />}>
              <ResetPassword />
            </RouteShell>
          }
        />
        <Route
          path="/verify-email"
          element={
            <RouteShell name="AuthActionLegacyAlias" fallback={<GlobalLoading />}>
              <AuthAction />
            </RouteShell>
          }
        />
      </Route>
    </>
  );
}
