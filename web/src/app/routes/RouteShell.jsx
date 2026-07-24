import React, { Suspense } from "react";
import RouteErrorBoundary from "../../shared/components/RouteErrorBoundary";
import RouteContentFallback from "../../shared/components/RouteContentFallback";

export function RouteShell({ name, fallback = <RouteContentFallback />, children }) {
  return (
    <RouteErrorBoundary name={name}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}
