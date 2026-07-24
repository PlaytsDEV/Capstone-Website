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
  VerifyEmail,
  AuthAction,
  ResetPassword,
} from "../lazyPages";

export function PublicRoutes() {
  return (
    <>
      <Route element={<PublicFrame />}>
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRole="applicant" requireAuth={false}>
              <RouteShell name="LandingPage">
                <LandingPage />
              </RouteShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/privacy-policy"
          element={
            <RouteShell name="PrivacyPolicy">
              <PrivacyPolicyPage />
            </RouteShell>
          }
        />
        <Route
          path="/terms-of-service"
          element={
            <RouteShell name="TermsOfService">
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
            <RouteShell name="AuthAction">
              <AuthAction />
            </RouteShell>
          }
        />
        <Route
          path="/reset-password"
          element={
            <RequireNonAdmin>
              <RouteShell name="ResetPassword" fallback={<GlobalLoading />}>
                <ResetPassword />
              </RouteShell>
            </RequireNonAdmin>
          }
        />
        <Route
          path="/verify-email"
          element={
            <RouteShell name="VerifyEmail">
              <VerifyEmail />
            </RouteShell>
          }
        />
      </Route>
    </>
  );
}
