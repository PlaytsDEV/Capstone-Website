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
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import {
  useBillingReport,
  useOccupancyReport,
  useOperationsReport,
} from "../../../shared/hooks/queries/useAnalyticsReports";
import "../styles/design-tokens.css";
import "../styles/admin-reports.css";
import {
  AnalyticsBarChart,
  AnalyticsLineChart,
} from "../components/shared";
import { AdminDashboardSkeleton } from "../components/AdminContentSkeletons";
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
  handleCsvExport,
  handlePdfExport,
} from "./analyticsTabShared";
import { buildRangeLabel, formatBranch, formatPeso } from "./reportCommon";
import AnalyticsOccupancyTab from "./AnalyticsOccupancyTab";
import AnalyticsBillingTab from "./AnalyticsBillingTab";
import AnalyticsOperationsTab from "./AnalyticsOperationsTab";
import AnalyticsConsolidatedTab from "./AnalyticsConsolidatedTab";
import AnalyticsFinancialsTab from "./AnalyticsFinancialsTab";
import AnalyticsMonitoringTab from "./AnalyticsMonitoringTab";
import AnalyticsDemographicsTab from "./AnalyticsDemographicsTab";
import MarketingSourceReport from "../components/MarketingSourceReport";
import InquiryPipelineBoard from "../components/InquiryPipelineBoard";

function AnalyticsFinalLayout({ clearLegacyOverview = false }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isOwner = user?.role === "owner";
  const requestedTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(requestedTab);
  const requestedRange = searchParams.get("range");
  const requestedBranch = searchParams.get("branch");

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

  const occupancyData = occupancyQuery.data;
  const billingData = billingQuery.data;
  const operationsData = operationsQuery.data;
  const occupancyKpis = occupancyData?.kpis || {};
  const billingKpis = billingData?.kpis || {};
  const operationsKpis = operationsData?.kpis || {};
  const occupancyTrend = occupancyData?.series?.occupancyTrend || [];
  const revenueByMonth = billingData?.series?.revenueByMonth || [];
  const reservationsByPeriod = operationsData?.series?.reservationsByPeriod || [];

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
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    setSearchParams(nextParams, { replace: true, preventScrollReset: true });
  };




  const detailSharedProps = useMemo(
    () => ({
      branch,
      range: getSummaryDetailRange(activeTab, range),
      isOwner,
      onRangeChange: handleRangeChange,
      onBranchChange: handleBranchChange,
    }),
    [branch, activeTab, range, isOwner],
  );

  const isInitialLoading =
    (occupancyQuery.isLoading && !occupancyData) ||
    (billingQuery.isLoading && !billingData) ||
    (operationsQuery.isLoading && !operationsData);

  if (isInitialLoading) {
    return <AdminDashboardSkeleton />;
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

  const exportOverviewPdf = () => {
    handlePdfExport({
      title: "Executive Analytics Overview",
      subtitle: `${branchLabel} • ${buildRangeLabel(range)}`,
      filename: `analytics-overview-${range}.pdf`,
      reportType: "Overview",
      kpis: [
        {
          label: "Occupancy Rate",
          value: occupancyKpis.occupancyRateLabel || "0%",
          sub: `${occupancyDelta.label} ${occupancyDelta.text}`,
          highlight: true,
        },
        {
          label: "Revenue Collected",
          value: billingKpis.collectedRevenueLabel?.replace("PHP ", "₱") || "₱0",
          sub: `${revenueDelta.label} ${revenueDelta.text}`,
        },
        {
          label: "Reservations",
          value: operationsKpis.reservations || 0,
          sub: `${reservationsDelta.label} ${reservationsDelta.text}`,
        },
        {
          label: "Maintenance Requests",
          value: operationsKpis.maintenanceRequests || 0,
          sub: `${maintenanceDelta.label} ${maintenanceDelta.text}`,
        },
      ],
      sections: [
        {
          title: "Period Comparison Summary",
          type: "table",
          headers: ["Metric", "Current Value", "Change vs Previous Period"],
          rows: [
            {
              Metric: "Occupancy rate",
              "Current Value": occupancyKpis.occupancyRateLabel || "0%",
              "Change vs Previous Period": occupancyDelta.label,
            },
            {
              Metric: "Revenue collected",
              "Current Value": billingKpis.collectedRevenueLabel?.replace("PHP ", "₱") || "₱0",
              "Change vs Previous Period": revenueDelta.label,
            },
            {
              Metric: "Reservations",
              "Current Value": String(operationsKpis.reservations || 0),
              "Change vs Previous Period": reservationsDelta.label,
            },
            {
              Metric: "Maintenance",
              "Current Value": String(operationsKpis.maintenanceRequests || 0),
              "Change vs Previous Period": maintenanceDelta.label,
            },
          ],
        },
      ],
    });
  };

  const exportOverviewCsv = () => {
    handleCsvExport(
      [
        {
          metric: "Occupancy Rate",
          value: occupancyKpis.occupancyRateLabel || "0%",
          delta: occupancyDelta.label,
        },
        {
          metric: "Revenue Collected",
          value: billingKpis.collectedRevenueLabel?.replace("PHP ", "₱") || "₱0",
          delta: revenueDelta.label,
        },
        {
          metric: "Reservations",
          value: operationsKpis.reservations || 0,
          delta: reservationsDelta.label,
        },
        {
          metric: "Maintenance Requests",
          value: operationsKpis.maintenanceRequests || 0,
          delta: maintenanceDelta.label,
        },
      ],
      [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Current Value" },
        { key: "delta", label: "Change vs Previous Period" },
      ],
      `analytics-overview-${range}`,
    );
  };

  return (
    <div className="analytics-container">
      {/* Top Bar */}
      <div className="analytics-topbar">
        <div className="analytics-topbar-row">
          <div>
            <div className="analytics-topbar-title">Analytics</div>
            <div className="analytics-topbar-sub">
              {branchLabel} • {buildRangeLabel(range)}
            </div>
          </div>
          {activeTab === "overview" && (
            <div className="analytics-topbar-actions">
              <ExportButtons onCsv={exportOverviewCsv} onPdf={exportOverviewPdf} />
            </div>
          )}
        </div>
        <div className="analytics-tabs">
          <button
            className={`analytics-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => handleTabChange("overview")}
          >
            <LayoutGrid className="analytics-tab-icon" />
            Overview
          </button>
          <button
            className={`analytics-tab ${activeTab === "occupancy" ? "active" : ""}`}
            onClick={() => handleTabChange("occupancy")}
          >
            <BedDouble className="analytics-tab-icon" />
            Occupancy
          </button>
          <button
            className={`analytics-tab ${activeTab === "revenue" || activeTab === "billing" ? "active" : ""}`}
            onClick={() => handleTabChange("revenue")}
          >
            <Receipt className="analytics-tab-icon" />
            Billing &amp; Revenue
          </button>
          <button
            className={`analytics-tab ${activeTab === "operations" ? "active" : ""}`}
            onClick={() => handleTabChange("operations")}
          >
            <Wrench className="analytics-tab-icon" />
            Operations
          </button>
          <button
            className={`analytics-tab ${activeTab === "demographics" ? "active" : ""}`}
            onClick={() => handleTabChange("demographics")}
          >
            <Users className="analytics-tab-icon" />
            Demographics
          </button>
          <button
            className={`analytics-tab ${activeTab === "marketing-roi" ? "active" : ""}`}
            onClick={() => handleTabChange("marketing-roi")}
          >
            <Target className="analytics-tab-icon" />
            Marketing ROI
          </button>
          {isOwner && (
            <button
              className={`analytics-tab ${activeTab === "consolidated" ? "active" : ""}`}
              onClick={() => handleTabChange("consolidated")}
            >
              <PanelsTopLeft className="analytics-tab-icon" />
              Consolidated
            </button>
          )}
        </div>
      </div>

      <div className="analytics-layout">
        {/* Main Content */}
        <main className="analytics-main">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="analytics-tab-content active">
              <div className="analytics-kpi-grid">
                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("occupancy")}
                  title="Click to view Occupancy details"
                >
                  <div className="analytics-kpi-icon blue">
                    <Bed size={15} strokeWidth={1.5} />
                  </div>
                  <div className="analytics-kpi-label">Occupancy rate</div>
                  <div className="analytics-kpi-value">
                    {occupancyQuery.isLoading ? "..." : occupancyKpis.occupancyRateLabel || "0%"}
                  </div>
                  <div className={`analytics-kpi-change ${occupancyDelta.changeType || "neutral"}`}>
                    {occupancyDelta.text || `${occupancyDelta.label || "+0 pp"} vs prev period`}
                  </div>
                </div>
                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("revenue")}
                  title="Click to view Billing & Revenue details"
                >
                  <div className="analytics-kpi-icon green">
                    <PhilippinePeso size={15} strokeWidth={1.5} />
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
                </div>
                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("operations")}
                  title="Click to view Operations details"
                >
                  <div className="analytics-kpi-icon amber">
                    <CalendarDays size={15} strokeWidth={1.5} />
                  </div>
                  <div className="analytics-kpi-label">Reservations</div>
                  <div className="analytics-kpi-value">
                    {operationsQuery.isLoading ? "..." : operationsKpis.reservations || 0}
                  </div>
                  <div className={`analytics-kpi-change ${reservationsDelta.changeType || "neutral"}`}>
                    {reservationsDelta.text || `${reservationsDelta.label || "+0"} vs prev period`}
                  </div>
                </div>
                <div
                  className="analytics-kpi-card interactive"
                  onClick={() => handleTabChange("operations")}
                  title="Click to view Operations details"
                >
                  <div className="analytics-kpi-icon purple">
                    <Wrench size={15} strokeWidth={1.5} />
                  </div>
                  <div className="analytics-kpi-label">Maintenance</div>
                  <div className="analytics-kpi-value">
                    {operationsQuery.isLoading ? "..." : operationsKpis.maintenanceRequests || 0}
                  </div>
                  <div className={`analytics-kpi-change ${maintenanceDelta.changeType || "neutral"}`}>
                    {maintenanceDelta.text || `${maintenanceDelta.label || "+0"} vs prev period`}
                  </div>
                </div>
              </div>

              <div className="analytics-charts-grid">
                <div className="analytics-chart-card">
                  <div className="analytics-chart-card-header">
                    <div>
                      <div className="analytics-chart-card-title">Occupancy trend</div>
                      <div className="analytics-chart-card-sub">
                        Daily rate — {buildRangeLabel(activeOverviewOccupancyRange).toLowerCase()}
                      </div>
                    </div>
                    <CardFilterSelect
                      value={activeOverviewOccupancyRange}
                      onChange={setOverviewOccupancyRange}
                    />
                  </div>
                  <div className="analytics-chart-card-body">
                    <AnalyticsLineChart
                      data={occupancyTrend.map((item) => ({
                        label: item.label,
                        occupancy: item.totalRate,
                      }))}
                      lines={[{ key: "occupancy", label: "Occupancy rate" }]}
                      height={140}
                      valueFormatter={(value) => `${value}%`}
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

                <div className="analytics-chart-card">
                  <div className="analytics-chart-card-header">
                    <div className="analytics-chart-card-title">Period comparison</div>
                    <div className="analytics-chart-card-sub">Current vs previous period</div>
                  </div>
                  <div className="analytics-chart-card-body">
                    <div className="analytics-metric-row">
                      <div>
                        <div className="analytics-metric-row-label">Occupancy rate</div>
                        <div className="analytics-metric-row-sub">vs previous period</div>
                      </div>
                      <div>
                        <div className="analytics-metric-row-val">
                          {occupancyKpis.occupancyRateLabel || "0%"}
                        </div>
                        <div
                          className="analytics-metric-row-change"
                          style={{
                            color:
                              occupancyDelta.changeType === "up"
                                ? "var(--success)"
                                : occupancyDelta.changeType === "down"
                                  ? "var(--danger)"
                                  : "var(--muted-foreground)",
                          }}
                        >
                          {occupancyDelta.label}
                        </div>
                      </div>
                    </div>
                    <div className="analytics-metric-row">
                      <div>
                        <div className="analytics-metric-row-label">Revenue collected</div>
                        <div className="analytics-metric-row-sub">vs previous period</div>
                      </div>
                      <div>
                        <div className="analytics-metric-row-val">
                          {billingKpis.collectedRevenueLabel?.replace("PHP ", "₱") || "₱0"}
                        </div>
                        <div
                          className="analytics-metric-row-change"
                          style={{
                            color:
                              revenueDelta.changeType === "up"
                                ? "var(--success)"
                                : revenueDelta.changeType === "down"
                                  ? "var(--danger)"
                                  : "var(--muted-foreground)",
                          }}
                        >
                          {revenueDelta.label}
                        </div>
                      </div>
                    </div>
                    <div className="analytics-metric-row">
                      <div>
                        <div className="analytics-metric-row-label">Reservations</div>
                        <div className="analytics-metric-row-sub">vs previous period</div>
                      </div>
                      <div>
                        <div className="analytics-metric-row-val">
                          {operationsKpis.reservations || 0}
                        </div>
                        <div
                          className="analytics-metric-row-change"
                          style={{
                            color:
                              reservationsDelta.changeType === "up"
                                ? "var(--success)"
                                : reservationsDelta.changeType === "down"
                                  ? "var(--danger)"
                                  : "var(--muted-foreground)",
                          }}
                        >
                          {reservationsDelta.label}
                        </div>
                      </div>
                    </div>
                    <div className="analytics-metric-row">
                      <div>
                        <div className="analytics-metric-row-label">Maintenance</div>
                        <div className="analytics-metric-row-sub">vs previous period</div>
                      </div>
                      <div>
                        <div className="analytics-metric-row-val">
                          {operationsKpis.maintenanceRequests || 0}
                        </div>
                        <div
                          className="analytics-metric-row-change"
                          style={{
                            color:
                              maintenanceDelta.changeType === "up"
                                ? "var(--danger)"
                                : maintenanceDelta.changeType === "down"
                                  ? "var(--success)"
                                  : "var(--muted-foreground)",
                          }}
                        >
                          {maintenanceDelta.label}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Reports Render */}
          {activeTab === "occupancy" && <AnalyticsOccupancyTab {...detailSharedProps} />}
          {(activeTab === "revenue" || activeTab === "billing" || activeTab === "financials") && (
            <AnalyticsBillingTab {...detailSharedProps} />
          )}
          {(activeTab === "operations" || activeTab === "monitoring") && (
            <AnalyticsOperationsTab {...detailSharedProps} />
          )}
          {activeTab === "demographics" && <AnalyticsDemographicsTab {...detailSharedProps} />}
          {activeTab === "marketing-roi" && (
            <div className="pt-2 flex flex-col gap-6">
              <InquiryPipelineBoard />
              <MarketingSourceReport />
            </div>
          )}
          {activeTab === "consolidated" && <AnalyticsConsolidatedTab {...detailSharedProps} />}
        </main>
      </div>
    </div>
  );
}

export default function AnalyticsPageFinal() {
  return <AnalyticsFinalLayout />;
}
