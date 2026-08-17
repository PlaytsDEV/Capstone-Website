import React, { useEffect, useMemo } from "react";
import { Link, useSearchParams, Navigate } from "react-router-dom";
import {
 ArrowLeft,
 BedDouble,
 Receipt,
 Users,
 Wrench,
 DollarSign,
 ShieldAlert,
 PanelsTopLeft,
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import PageShell from "../components/shared/PageShell";
import {
 buildAnalyticsSummaryHref,
 normalizeAnalyticsState,
} from "./analyticsNavigation.mjs";
import AnalyticsOccupancyTab from "./AnalyticsOccupancyTab";
import AnalyticsBillingTab from "./AnalyticsBillingTab";
import AnalyticsOperationsTab from "./AnalyticsOperationsTab";
import AnalyticsConsolidatedTab from "./AnalyticsConsolidatedTab";
import AnalyticsFinancialsTab from "./AnalyticsFinancialsTab";
import AnalyticsMonitoringTab from "./AnalyticsMonitoringTab";
import AnalyticsDemographicsTab from "./AnalyticsDemographicsTab";
import "../styles/admin-reports.css";

const BASE_TABS = [
  { key: "occupancy", label: "Occupancy", icon: BedDouble, iconClassName: "text-blue-500 dark:text-blue-400" },
  { key: "billing", label: "Billing", icon: Receipt, iconClassName: "text-emerald-600 dark:text-emerald-400" },
  { key: "operations", label: "Operations", icon: Wrench, iconClassName: "text-amber-500 dark:text-amber-400" },
  { key: "demographics", label: "Demographics", icon: Users, iconClassName: "text-purple-500 dark:text-purple-400" },
];

const OWNER_TABS = [
  { key: "consolidated", label: "Consolidated", icon: PanelsTopLeft, iconClassName: "text-indigo-500 dark:text-indigo-400" },
  { key: "financials", label: "Financials", icon: DollarSign, iconClassName: "text-emerald-600 dark:text-emerald-400" },
  { key: "monitoring", label: "System Monitoring", icon: ShieldAlert, iconClassName: "text-rose-500 dark:text-rose-400" },
];

function resolveTabComponent(tabKey, sharedProps) {
 switch (tabKey) {
 case "billing":
 return <AnalyticsBillingTab {...sharedProps} />;
 case "operations":
 return <AnalyticsOperationsTab {...sharedProps} />;
 case "demographics":
 return <AnalyticsDemographicsTab {...sharedProps} />;
 case "consolidated":
 return <AnalyticsConsolidatedTab {...sharedProps} />;
 case "financials":
 return <AnalyticsFinancialsTab {...sharedProps} />;
 case "monitoring":
 return <AnalyticsMonitoringTab {...sharedProps} />;
 case "occupancy":
 default:
 return <AnalyticsOccupancyTab {...sharedProps} />;
 }
}

export default function AnalyticsDetailsPage() {
  const [searchParams] = useSearchParams();
  return <Navigate to={`/admin/analytics?${searchParams.toString()}`} replace />;
}
