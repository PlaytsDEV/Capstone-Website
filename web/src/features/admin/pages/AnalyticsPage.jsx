import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Bed,
  BedDouble,
  Receipt,
  DollarSign,
  Shield,
  ShieldAlert,
  TrendingUp,
  Wrench,
  LayoutGrid,
  PhilippinePeso,
  CalendarDays,
  ClipboardList,
  Users,
  PanelsTopLeft,
  Target,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  DoorOpen,
  Check,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import {
  useBillingReport,
  useOccupancyReport,
  useOperationsReport,
} from "../../../shared/hooks/queries/useAnalyticsReports";
import { useDashboardData } from "../../../shared/hooks/queries/useDashboard";
import "../styles/design-tokens.css";
import "../styles/admin-reports.css";
import {
  AnalyticsBarChart,
  AnalyticsLineChart,
} from "../components/shared";
import { AdminAnalyticsSkeleton } from "../components/AdminContentSkeletons";
import {
  ANALYTICS_DETAILS_PATH,
  buildAnalyticsDetailsHref,
  getSummaryDetailRange,
  normalizeAnalyticsSummaryState,
} from "./analyticsNavigation.mjs";
import {
  RANGE_OPTIONS_SHORT,
  CardFilterSelect,
  ExportButtons,
} from "./analyticsTabShared";
import {
  buildRangeLabel,
  formatBranch,
  formatPeso,
  formatDate,
  formatDateTime,
} from "./reportCommon";
import AnalyticsOccupancyTab from "./AnalyticsOccupancyTab";
import AnalyticsBillingTab from "./AnalyticsBillingTab";
import AnalyticsOperationsTab from "./AnalyticsOperationsTab";
import AnalyticsConsolidatedTab from "./AnalyticsConsolidatedTab";
import AnalyticsFinancialsTab from "./AnalyticsFinancialsTab";
import AnalyticsMonitoringTab from "./AnalyticsMonitoringTab";
import AnalyticsDemographicsTab from "./AnalyticsDemographicsTab";
import AnalyticsAcquisitionTab from "./AnalyticsAcquisitionTab";
import AnalyticsSupportChatTab from "./AnalyticsSupportChatTab";
import AdminPageHeader from "../../../shared/components/AdminPageHeader";

function MiniSparkline({ data = [], stroke = "#2563eb", width = 54, height = 20 }) {
  if (!data || data.length < 2) return null;
  const values = data.map((v) => Number(v) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const usableWidth = width - padding * 2;

  const points = values
    .map((val, idx) => {
      const x = padding + (idx / (values.length - 1)) * usableWidth;
      const y = height - padding - ((val - min) / range) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="analytics-kpi-sparkline"
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function AnalyticsFinalLayout({ clearLegacyOverview = false }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isOwner = user?.role === "owner";
  const requestedTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(requestedTab);
  const activeTabNormalized =
    activeTab === "revenue" ? "billing" : activeTab === "marketing-roi" ? "acquisition" : activeTab;
  const requestedRange = searchParams.get("range");
  const requestedBranch = searchParams.get("branch");

  const [overviewOccupancyMetric, setOverviewOccupancyMetric] = useState("rate");
  const [overviewOccupancyRange, setOverviewOccupancyRange] = useState(null);
  const [overviewBillingRange, setOverviewBillingRange] = useState(null);
  const [overviewOperationsRange, setOverviewOperationsRange] = useState(null);

  const { range, branch } = normalizeAnalyticsSummaryState({
    requestedRange,
    requestedBranch,
    isOwner,
    userBranch: user?.branch || "gil-puyat",
  });

  const activeOverviewOccupancyRange = overviewOccupancyRange || range;
  const activeOverviewBillingRange = overviewBillingRange || range;
  const activeOverviewOperationsRange = overviewOperationsRange || range;

  useEffect(() => {
    const tabInUrl = searchParams.get("tab") || "overview";
    if (tabInUrl !== activeTab) {
      setActiveTab(tabInUrl);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (clearLegacyOverview && nextParams.has("tab")) {
      nextParams.delete("tab");
      changed = true;
    }

    if (requestedRange !== range) {
      nextParams.set("range", range);
      changed = true;
    }

    if (isOwner) {
      if (requestedBranch !== branch) {
        nextParams.set("branch", branch);
        changed = true;
      }
    } else if (searchParams.has("branch")) {
      nextParams.delete("branch");
      changed = true;
    }

    if (!changed) return;
    setSearchParams(nextParams, { replace: true, preventScrollReset: true });
  }, [
    branch,
    clearLegacyOverview,
    isOwner,
    range,
    requestedBranch,
    requestedRange,
    searchParams,
    setSearchParams,
  ]);

  const sharedDayParams = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const billingParams = useMemo(
    () => ({
      range: getSummaryDetailRange("billing", range),
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );

  const overviewOccupancyParams = useMemo(
    () => ({
      range: activeOverviewOccupancyRange,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeOverviewOccupancyRange],
  );

  const overviewBillingParams = useMemo(
    () => ({
      range: getSummaryDetailRange("billing", activeOverviewBillingRange),
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeOverviewBillingRange],
  );

  const overviewOperationsParams = useMemo(
    () => ({
      range: activeOverviewOperationsRange,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, activeOverviewOperationsRange],
  );

  const occupancyQuery = useOccupancyReport(overviewOccupancyParams);
  const billingQuery = useBillingReport(overviewBillingParams);
  const operationsQuery = useOperationsReport(overviewOperationsParams);
  const { data: dashboardData } = useDashboardData(sharedDayParams);

  const occupancyData = occupancyQuery.data;
  const billingData = billingQuery.data;
  const operationsData = operationsQuery.data;
  const occupancyKpis = occupancyData?.kpis || {};
  const billingKpis = billingData?.kpis || {};
  const operationsKpis = operationsData?.kpis || {};
  const occupancyTrend = occupancyData?.series?.occupancyTrend || [];
  const revenueByMonth = billingData?.series?.revenueByMonth || [];
  const reservationsByPeriod = operationsData?.series?.reservationsByPeriod || [];

  const occupancyChartConfig = useMemo(() => {
    if (overviewOccupancyMetric === "beds") {
      return {
        data: occupancyTrend.map((item) => ({
          label: item.label,
          occupied: item.occupiedBeds || 0,
          capacity: item.totalCapacity || 0,
        })),
        lines: [
          { key: "occupied", label: "Occupied Beds", color: "#2563eb", strokeWidth: 2.5 },
          { key: "capacity", label: "Total Capacity", color: "#64748b", strokeWidth: 1.75 },
        ],
        valueFormatter: (value) => `${value} bed${value === 1 ? "" : "s"}`,
        subTitle: `Occupied beds vs. capacity — ${buildRangeLabel(activeOverviewOccupancyRange).toLowerCase()}`,
      };
    }

    if (overviewOccupancyMetric === "byType") {
      return {
        data: occupancyTrend.map((item) => ({
          label: item.label,
          private: item.byType?.["private"] ?? 0,
          double: item.byType?.["double-sharing"] ?? 0,
          quadruple: item.byType?.["quadruple-sharing"] ?? 0,
        })),
        lines: [
          { key: "private", label: "Private", color: "#2563eb", strokeWidth: 2 },
          { key: "double", label: "Double Sharing", color: "#16a34a", strokeWidth: 2 },
          { key: "quadruple", label: "Quad Sharing", color: "#f59e0b", strokeWidth: 2 },
        ],
        valueFormatter: (value) => `${value}%`,
        subTitle: `By room type — ${buildRangeLabel(activeOverviewOccupancyRange).toLowerCase()}`,
      };
    }

    return {
      data: occupancyTrend.map((item) => ({
        label: item.label,
        occupancy: item.totalRate ?? 0,
        target: 90,
      })),
      lines: [
        { key: "occupancy", label: "Occupancy rate", color: "#2563eb", strokeWidth: 3 },
        { key: "target", label: "Target (90%)", color: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "4 4" },
      ],
      valueFormatter: (value) => `${value}%`,
      subTitle: `Daily rate vs 90% benchmark — ${buildRangeLabel(activeOverviewOccupancyRange).toLowerCase()}`,
    };
  }, [activeOverviewOccupancyRange, occupancyTrend, overviewOccupancyMetric]);

  const pendingReservations =
    dashboardData?.reservationStatus?.pending ?? (operationsKpis.reservations || 0);
  const activeTickets =
    dashboardData?.kpis?.activeTickets ??
    (operationsKpis.unresolvedRequests || operationsKpis.maintenanceRequests || 0);
  const unresolvedInquiries = useMemo(
    () =>
      dashboardData?.recentInquiries?.filter(
        (item) => !["resolved", "closed"].includes(item.status),
      ).length ?? (operationsKpis.openInquiries || 0),
    [dashboardData, operationsKpis],
  );
  const overdueAmount =
    billingKpis.overdueAmountLabel || billingKpis.outstandingBalanceLabel || "₱0";

  const hasUrgentActions =
    pendingReservations > 0 ||
    activeTickets > 0 ||
    unresolvedInquiries > 0 ||
    (billingKpis.outstandingBalance || 0) > 0;

  const roomTypes = useMemo(() => {
    if (occupancyData?.tables?.roomTypes && occupancyData.tables.roomTypes.length > 0) {
      return occupancyData.tables.roomTypes;
    }
    const totalCap = occupancyKpis.totalCapacity || 10;
    const occBeds = occupancyKpis.occupiedBeds || 0;
    const occRate = occupancyKpis.occupancyRate || 0;
    return [
      {
        type: "private",
        label: "Private",
        totalBeds: Math.max(1, Math.round(totalCap * 0.2)),
        occupiedBeds: Math.round(occBeds * 0.2),
        occupancyRate: occRate,
      },
      {
        type: "double-sharing",
        label: "Double Sharing",
        totalBeds: Math.max(1, Math.round(totalCap * 0.4)),
        occupiedBeds: Math.round(occBeds * 0.4),
        occupancyRate: occRate,
      },
      {
        type: "quadruple-sharing",
        label: "Quadruple Sharing",
        totalBeds: Math.max(1, Math.round(totalCap * 0.4)),
        occupiedBeds: Math.round(occBeds * 0.4),
        occupancyRate: occRate,
      },
    ];
  }, [occupancyData, occupancyKpis]);

  const branchLabel = formatBranch(
    occupancyData?.scope?.branch ||
      billingData?.scope?.branch ||
      operationsData?.scope?.branch ||
      branch,
  );

  const handleRangeChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("range", value);
    setSearchParams(nextParams, { replace: true, preventScrollReset: true });
  };

  const handleBranchChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("branch", value);
    setSearchParams(nextParams, { replace: true, preventScrollReset: true });
  };

  const handleTabChange = (nextTab) => {
    const resolvedTab = nextTab === "revenue" ? "billing" : nextTab;
    setActiveTab(resolvedTab);
    const nextParams = new URLSearchParams(searchParams);
    if (resolvedTab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", resolvedTab);
    }
    setSearchParams(nextParams, { replace: true, preventScrollReset: true });
  };

  const analyticsTabs = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: LayoutGrid, iconClassName: "text-sky-500 dark:text-sky-400" },
      { id: "occupancy", label: "Occupancy", icon: BedDouble, iconClassName: "text-blue-500 dark:text-blue-400" },
      { id: "billing", label: "Billing & Revenue", icon: Receipt, iconClassName: "text-emerald-600 dark:text-emerald-400" },
      { id: "operations", label: "Operations", icon: Wrench, iconClassName: "text-amber-500 dark:text-amber-400" },
      { id: "support", label: "Support & Chat", icon: MessageSquare, iconClassName: "text-sky-500 dark:text-sky-400" },
      { id: "demographics", label: "Demographics", icon: Users, iconClassName: "text-purple-500 dark:text-purple-400" },
      { id: "acquisition", label: "Lead Acquisition", icon: Target, iconClassName: "text-teal-500 dark:text-teal-400" },
      ...(isOwner
        ? [
            {
              id: "consolidated",
              label: "Consolidated",
              icon: PanelsTopLeft,
              iconClassName: "text-indigo-500 dark:text-indigo-400",
            },
            {
              id: "financials",
              label: "Financials",
              icon: PhilippinePeso,
              iconClassName: "text-emerald-600 dark:text-emerald-400",
            },
            {
              id: "monitoring",
              label: "Monitoring",
              icon: ShieldAlert,
              iconClassName: "text-rose-500 dark:text-rose-400",
            },
          ]
        : []),
    ],
    [isOwner],
  );




  const [tabExports, setTabExports] = useState({});

  const registerTabExport = React.useCallback((tabKey, exports) => {
    if (!tabKey) return;
    setTabExports((prev) => {
      if (prev[tabKey] === exports) return prev;
      return {
        ...prev,
        [tabKey]: exports,
      };
    });
  }, []);

  const detailSharedProps = useMemo(
    () => ({
      branch,
      range: getSummaryDetailRange(activeTab, range),
      isOwner,
      onRangeChange: handleRangeChange,
      onBranchChange: handleBranchChange,
      registerExport: (exports) => registerTabExport(activeTabNormalized, exports),
    }),
    [branch, activeTab, range, isOwner, activeTabNormalized, registerTabExport],
  );

  const currentTabExport =
    activeTabNormalized === "overview" ? null : tabExports[activeTabNormalized];

  const isInitialLoading =
    (occupancyQuery.isLoading && !occupancyData) ||
    (billingQuery.isLoading && !billingData) ||
    (operationsQuery.isLoading && !operationsData);

  if (isInitialLoading) {
    return <AdminAnalyticsSkeleton activeTab={activeTab} isOwner={isOwner} />;
  }

  const occupancyDelta = occupancyKpis?.comparison?.occupancyRate || {
    label: "+0 pp",
    changeType: "neutral",
    text: "vs prev period",
  };
  const revenueDelta = billingKpis?.comparison?.collectedRevenue || {
    label: "+0%",
    changeType: "neutral",
    text: "vs prev period",
  };
  const reservationsDelta = operationsKpis?.comparison?.reservations || {
    label: "+0",
    changeType: "neutral",
    text: "vs prev period",
  };
  const maintenanceDelta = operationsKpis?.comparison?.maintenanceRequests || {
    label: "+0",
    changeType: "neutral",
    text: "vs prev period",
  };

  return (
    <div className="analytics-container space-y-4">
      {/* Pattern 1 Integrated Sticky Sub-Header */}
      <AdminPageHeader
        title="Analytics"
        subtitle="Review occupancy, revenue, operations, and cross-branch performance trends."
        tabs={analyticsTabs}
        activeTab={activeTabNormalized}
        onTabChange={handleTabChange}
        controls={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isOwner ? (
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="analytics-header-branch"
                  className="text-[11px] font-medium text-muted-foreground whitespace-nowrap"
                >
                  Branch:
                </label>
                <select
                  id="analytics-header-branch"
                  value={branch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="h-8 px-2.5 py-1 text-xs font-semibold bg-background text-foreground border border-border/80 rounded-lg shadow-xs hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all cursor-pointer"
                  aria-label="Filter by branch"
                >
                  <option value="all">All Branches</option>
                  <option value="gil-puyat">Gil Puyat</option>
                  <option value="guadalupe">Guadalupe</option>
                </select>
              </div>
            ) : user?.branch ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                  Branch:
                </span>
                <span className="h-8 inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-muted/40 text-foreground">
                  {branchLabel}
                </span>
              </div>
            ) : null}

            <CardFilterSelect
              label="Duration:"
              value={range}
              onChange={handleRangeChange}
              options={RANGE_OPTIONS_SHORT}
              className="h-8"
              selectClassName="h-8 px-2.5 py-1 text-xs font-semibold rounded-lg"
              ariaLabel="Filter by duration"
            />
          </div>
        }
        actions={
          activeTabNormalized !== "overview" && currentTabExport?.exportCsv && currentTabExport?.exportPdf ? (
            <ExportButtons onCsv={currentTabExport.exportCsv} onPdf={currentTabExport.exportPdf} />
          ) : null
        }
      />

      <div className="analytics-layout">
        {/* Main Content */}
        <main className="analytics-main">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="analytics-tab-content active">
              {/* Elevated Primary KPI Grid */}
              <div className="analytics-kpi-grid">
                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("occupancy")}
                  title="Click to view Occupancy details"
                >
                  <div className="analytics-kpi-card-header">
                    <div className="analytics-kpi-icon blue">
                      <Bed size={15} strokeWidth={1.5} />
                    </div>
                    <MiniSparkline
                      data={occupancyTrend.map((item) => item.totalRate)}
                      stroke="#2563eb"
                    />
                  </div>
                  <div className="analytics-kpi-label">Occupancy rate</div>
                  <div className="analytics-kpi-value">
                    {occupancyQuery.isLoading ? "..." : occupancyKpis.occupancyRateLabel || "0%"}
                  </div>
                  <div className={`analytics-kpi-change ${occupancyDelta.changeType || "neutral"}`}>
                    {occupancyDelta.text || `${occupancyDelta.label || "+0 pp"} vs prev period`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                    {occupancyKpis.occupiedBeds || 0} of {occupancyKpis.totalCapacity || 0} beds occupied
                  </div>
                </div>

                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("revenue")}
                  title="Click to view Billing & Revenue details"
                >
                  <div className="analytics-kpi-card-header">
                    <div className="analytics-kpi-icon green">
                      <PhilippinePeso size={15} strokeWidth={1.5} />
                    </div>
                    <MiniSparkline
                      data={revenueByMonth.map((item) => item.collectedRevenue)}
                      stroke="#16a34a"
                    />
                  </div>
                  <div className="analytics-kpi-label">Revenue collected</div>
                  <div className="analytics-kpi-value">
                    {billingQuery.isLoading
                      ? "..."
                      : billingKpis.collectedRevenueLabel?.replace("PHP ", "₱") || "₱0"}
                  </div>
                  <div className={`analytics-kpi-change ${revenueDelta.changeType || "neutral"}`}>
                    {revenueDelta.text || `${revenueDelta.label || "+0%"} vs prev period`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                    Collection rate: {billingKpis.collectionRate || 0}%
                  </div>
                </div>

                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("operations")}
                  title="Click to view Operations details"
                >
                  <div className="analytics-kpi-card-header">
                    <div className="analytics-kpi-icon amber">
                      <CalendarDays size={15} strokeWidth={1.5} />
                    </div>
                    <MiniSparkline
                      data={reservationsByPeriod.map((item) => item.count)}
                      stroke="#d97706"
                    />
                  </div>
                  <div className="analytics-kpi-label">Reservations</div>
                  <div className="analytics-kpi-value">
                    {operationsQuery.isLoading ? "..." : operationsKpis.reservations || 0}
                  </div>
                  <div className={`analytics-kpi-change ${reservationsDelta.changeType || "neutral"}`}>
                    {reservationsDelta.text || `${reservationsDelta.label || "+0"} vs prev period`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                    {pendingReservations} awaiting review
                  </div>
                </div>

                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("operations")}
                  title="Click to view Operations details"
                >
                  <div className="analytics-kpi-card-header">
                    <div className="analytics-kpi-icon purple">
                      <Wrench size={15} strokeWidth={1.5} />
                    </div>
                    <MiniSparkline
                      data={(operationsData?.series?.maintenanceByType || []).map((item) => item.count)}
                      stroke="#7c3aed"
                    />
                  </div>
                  <div className="analytics-kpi-label">Maintenance</div>
                  <div className="analytics-kpi-value">
                    {operationsQuery.isLoading ? "..." : operationsKpis.maintenanceRequests || 0}
                  </div>
                  <div className={`analytics-kpi-change ${maintenanceDelta.changeType || "neutral"}`}>
                    {maintenanceDelta.text || `${maintenanceDelta.label || "+0"} vs prev period`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                    {activeTickets} active ticket{activeTickets === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              {/* 2x2 Layout: 3 Operational Charts + 1 Action & Inventory Hub */}
              <div className="analytics-charts-grid">
                <div className="analytics-chart-card">
                  <div className="analytics-chart-card-header">
                    <div>
                      <div className="analytics-chart-card-title">Occupancy trend</div>
                      <div className="analytics-chart-card-sub">
                        {occupancyChartConfig.subTitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="analytics-view-mode-toggle" role="group" aria-label="Occupancy view metric">
                        <button
                          type="button"
                          className={`analytics-view-mode-btn ${overviewOccupancyMetric === "rate" ? "active" : ""}`}
                          onClick={() => setOverviewOccupancyMetric("rate")}
                        >
                          Rate %
                        </button>
                        <button
                          type="button"
                          className={`analytics-view-mode-btn ${overviewOccupancyMetric === "beds" ? "active" : ""}`}
                          onClick={() => setOverviewOccupancyMetric("beds")}
                        >
                          Beds
                        </button>
                        <button
                          type="button"
                          className={`analytics-view-mode-btn ${overviewOccupancyMetric === "byType" ? "active" : ""}`}
                          onClick={() => setOverviewOccupancyMetric("byType")}
                        >
                          By Type
                        </button>
                      </div>
                      <CardFilterSelect
                        value={activeOverviewOccupancyRange}
                        onChange={setOverviewOccupancyRange}
                      />
                    </div>
                  </div>
                  <div className="analytics-chart-card-body">
                    <AnalyticsLineChart
                      data={occupancyChartConfig.data}
                      lines={occupancyChartConfig.lines}
                      height={140}
                      valueFormatter={occupancyChartConfig.valueFormatter}
                      emptyTitle="No occupancy data"
                      emptyDescription="Data will appear once available."
                    />
                  </div>
                </div>

                <div className="analytics-chart-card">
                  <div className="analytics-chart-card-header">
                    <div>
                      <div className="analytics-chart-card-title">Revenue collections</div>
                      <div className="analytics-chart-card-sub">Billed vs collected — monthly</div>
                    </div>
                    <CardFilterSelect
                      value={activeOverviewBillingRange}
                      onChange={setOverviewBillingRange}
                    />
                  </div>
                  <div className="analytics-chart-card-body">
                    <AnalyticsBarChart
                      data={revenueByMonth.map((item) => ({
                        label: item.label,
                        collected: item.collectedRevenue,
                        billed: item.billedAmount,
                      }))}
                      bars={[
                        { key: "collected", label: "Collected", color: "#16a34a" },
                        { key: "billed", label: "Billed", color: "#0f766e" },
                      ]}
                      height={120}
                      valueFormatter={(value) => formatPeso(value)}
                      emptyTitle="No billing data"
                      emptyDescription="Data will appear once available."
                    />
                  </div>
                </div>

                <div className="analytics-chart-card">
                  <div className="analytics-chart-card-header">
                    <div>
                      <div className="analytics-chart-card-title">Reservation activity</div>
                      <div className="analytics-chart-card-sub">Bookings per week</div>
                    </div>
                    <CardFilterSelect
                      value={activeOverviewOperationsRange}
                      onChange={setOverviewOperationsRange}
                    />
                  </div>
                  <div className="analytics-chart-card-body">
                    <AnalyticsBarChart
                      data={reservationsByPeriod.map((item) => ({
                        label: item.label,
                        count: item.count,
                      }))}
                      bars={[{ key: "count", label: "Reservations", color: "#f59e0b" }]}
                      height={120}
                      emptyTitle="No reservation data"
                      emptyDescription="Data will appear once available."
                    />
                  </div>
                </div>

                {/* Dedicated Operational Action Center & Live Queues */}
                <div className="analytics-chart-card analytics-action-center-card">
                  <div className="analytics-chart-card-header">
                    <div>
                      <div className="analytics-chart-card-title">Operational action center</div>
                      <div className="analytics-chart-card-sub">
                        Live queue status & required administrator follow-ups
                      </div>
                    </div>
                    {hasUrgentActions ? (
                      <span className="analytics-queue-pill warning">
                        <span className="analytics-queue-pill__dot warning" />
                        Action Required
                      </span>
                    ) : (
                      <span className="analytics-queue-pill clear">
                        <span className="analytics-queue-pill__dot clear" />
                        All Queues Clear
                      </span>
                    )}
                  </div>
                  <div className="analytics-chart-card-body">
                    <div className="analytics-queue-list">
                      {/* Maintenance Queue */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate("/admin/maintenance")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate("/admin/maintenance");
                          }
                        }}
                        className="analytics-queue-row"
                        title="Manage active maintenance issues"
                      >
                        <div className="analytics-queue-row__main">
                          <div className="analytics-queue-icon rose">
                            <Wrench size={14} />
                          </div>
                          <div className="analytics-queue-info">
                            <span className="analytics-queue-title">Maintenance Tickets</span>
                            <span className="analytics-queue-desc">
                              {activeTickets > 0
                                ? `${activeTickets} open ticket${activeTickets === 1 ? "" : "s"} requiring technician triage`
                                : "Zero active maintenance tickets"}
                            </span>
                          </div>
                        </div>
                        <div className="analytics-queue-row__end">
                          {activeTickets > 0 ? (
                            <span className="analytics-queue-chip warning">
                              {activeTickets} Open
                            </span>
                          ) : (
                            <span className="analytics-queue-chip clear">
                              <Check size={11} /> Clear
                            </span>
                          )}
                          <ChevronRight size={14} className="analytics-queue-arrow" />
                        </div>
                      </div>

                      {/* Reservations Queue */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate("/admin/reservations")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate("/admin/reservations");
                          }
                        }}
                        className="analytics-queue-row"
                        title="Review pending reservations"
                      >
                        <div className="analytics-queue-row__main">
                          <div className="analytics-queue-icon amber">
                            <CalendarDays size={14} />
                          </div>
                          <div className="analytics-queue-info">
                            <span className="analytics-queue-title">Pending Reservations</span>
                            <span className="analytics-queue-desc">
                              {pendingReservations > 0
                                ? `${pendingReservations} booking${pendingReservations === 1 ? "" : "s"} awaiting approval`
                                : "No pending reservations"}
                            </span>
                          </div>
                        </div>
                        <div className="analytics-queue-row__end">
                          {pendingReservations > 0 ? (
                            <span className="analytics-queue-chip warning">
                              {pendingReservations} Pending
                            </span>
                          ) : (
                            <span className="analytics-queue-chip clear">
                              <Check size={11} /> Clear
                            </span>
                          )}
                          <ChevronRight size={14} className="analytics-queue-arrow" />
                        </div>
                      </div>

                      {/* Inquiries Queue */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate("/admin/inquiries")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate("/admin/inquiries");
                          }
                        }}
                        className="analytics-queue-row"
                        title="View open inquiries"
                      >
                        <div className="analytics-queue-row__main">
                          <div className="analytics-queue-icon blue">
                            <Users size={14} />
                          </div>
                          <div className="analytics-queue-info">
                            <span className="analytics-queue-title">Tenant Inquiries</span>
                            <span className="analytics-queue-desc">
                              {unresolvedInquiries > 0
                                ? `${unresolvedInquiries} open message${unresolvedInquiries === 1 ? "" : "s"} awaiting reply`
                                : "All inquiries addressed"}
                            </span>
                          </div>
                        </div>
                        <div className="analytics-queue-row__end">
                          {unresolvedInquiries > 0 ? (
                            <span className="analytics-queue-chip warning">
                              {unresolvedInquiries} Open
                            </span>
                          ) : (
                            <span className="analytics-queue-chip clear">
                              <Check size={11} /> Clear
                            </span>
                          )}
                          <ChevronRight size={14} className="analytics-queue-arrow" />
                        </div>
                      </div>

                      {/* Billing & Overdue Queue */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleTabChange("billing")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleTabChange("billing");
                          }
                        }}
                        className="analytics-queue-row"
                        title="View overdue balances"
                      >
                        <div className="analytics-queue-row__main">
                          <div className="analytics-queue-icon emerald">
                            <PhilippinePeso size={14} />
                          </div>
                          <div className="analytics-queue-info">
                            <span className="analytics-queue-title">Outstanding Balances</span>
                            <span className="analytics-queue-desc">
                              {(billingKpis.outstandingBalance || 0) > 0
                                ? `${overdueAmount} pending collection`
                                : "All accounts up to date"}
                            </span>
                          </div>
                        </div>
                        <div className="analytics-queue-row__end">
                          {(billingKpis.outstandingBalance || 0) > 0 ? (
                            <span className="analytics-queue-chip danger">
                              {overdueAmount}
                            </span>
                          ) : (
                            <span className="analytics-queue-chip clear">
                              <Check size={11} /> Settled
                            </span>
                          )}
                          <ChevronRight size={14} className="analytics-queue-arrow" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Reports Render */}
          {activeTabNormalized === "occupancy" && (
            <AnalyticsOccupancyTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "billing" && (
            <AnalyticsBillingTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "financials" && (
            <AnalyticsFinancialsTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "operations" && (
            <AnalyticsOperationsTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "support" && (
            <AnalyticsSupportChatTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "monitoring" && (
            <AnalyticsMonitoringTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "demographics" && (
            <AnalyticsDemographicsTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "acquisition" && (
            <AnalyticsAcquisitionTab {...detailSharedProps} />
          )}
          {activeTabNormalized === "consolidated" && (
            <AnalyticsConsolidatedTab {...detailSharedProps} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function AnalyticsPageFinal() {
  return <AnalyticsFinalLayout />;
}
