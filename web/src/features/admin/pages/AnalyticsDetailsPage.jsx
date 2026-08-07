import React, { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
 { key: "occupancy", label: "Occupancy", icon: BedDouble },
 { key: "billing", label: "Billing", icon: Receipt },
 { key: "operations", label: "Operations", icon: Wrench },
 { key: "demographics", label: "Demographics", icon: Users },
];

const OWNER_TABS = [
 { key: "consolidated", label: "Consolidated", icon: PanelsTopLeft },
 { key: "financials", label: "Financials", icon: DollarSign },
 { key: "monitoring", label: "System Monitoring", icon: ShieldAlert },
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
