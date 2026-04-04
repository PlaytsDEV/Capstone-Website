import React from "react";
import { Route, Routes } from "react-router-dom";
import { PublicRoutes } from "./publicRoutes";
import { LegacyRoutes } from "./legacyRoutes";
import { AdminRoutes } from "./adminRoutes";
import { TenantRoutes } from "./tenantRoutes";
import { RouteShell } from "./RouteShell";
import { NotFoundPage } from "../lazyPages";

export function AppRoutes() {
  return (
    <Routes>
      {PublicRoutes()}
      {LegacyRoutes()}
      {AdminRoutes()}
      {TenantRoutes()}
      <Route
        path="*"
        element={
          <RouteShell name="NotFound">
            <NotFoundPage />
          </RouteShell>
        }
      />
    </Routes>
  );
}
