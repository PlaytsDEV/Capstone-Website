import React from "react";
import RouteErrorBoundary from "../../shared/components/RouteErrorBoundary";

export function RouteShell({ name, children }) {
  return <RouteErrorBoundary name={name}>{children}</RouteErrorBoundary>;
}
