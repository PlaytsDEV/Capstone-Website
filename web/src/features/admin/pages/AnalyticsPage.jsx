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
import {
  ANALYTICS_DETAILS_PATH,
  buildAnalyticsDetailsHref,
  getSummaryDetailRange,
  normalizeAnalyticsSummaryState,
} from "./analyticsNavigation.mjs";
import {
  RANGE_OPTIONS_SHORT,
  CardFilterSelect,
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

// Inline styles matching system design tokens
const styles = `
  .analytics-container {
    font-family: var(--font-sans, system-ui, sans-serif);
    background: var(--background, #f8fafc);
    color: var(--foreground, #1e293b);
    font-size: 13px;
    min-height: 100vh;
    margin: 0px;
    padding: 0px;
  }

  .analytics-topbar {
    background: var(--card, #ffffff);
    border-bottom: 1px solid var(--border, #e2e8f0);
    position: sticky;
    top: calc(-1 * var(--spacing-page, 24px));
    z-index: 40;
    margin: calc(-1 * var(--spacing-page, 24px)) calc(-1 * var(--spacing-page, 24px)) 24px calc(-1 * var(--spacing-page, 24px));
    padding: 16px 24px 0 24px;
    box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08);
  }

  .analytics-topbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .analytics-topbar-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-primary, #0a1628);
    letter-spacing: -0.01em;
  }

  .analytics-topbar-sub {
    font-size: 12px;
    color: var(--muted-foreground, #64748b);
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .analytics-topbar-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .analytics-filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .analytics-filter-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--muted-foreground, #64748b);
  }

  .analytics-select {
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 6px;
    background: var(--card, #ffffff);
    color: var(--foreground, #0f172a);
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .analytics-select:focus {
    border-color: var(--color-primary, #0a1628);
    box-shadow: 0 0 0 2px rgba(10, 22, 40, 0.1);
  }

  .analytics-btn {
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 6px;
    background: var(--card, #ffffff);
    color: var(--foreground, #0f172a);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s ease;
  }

  .analytics-btn:hover {
    background: var(--muted, #f1f5f9);
    border-color: var(--border-hover, #94a3b8);
  }

  .analytics-btn-primary {
    background: var(--color-primary, #0a1628);
    color: #ffffff;
    border-color: var(--color-primary, #0a1628);
  }

  .analytics-btn-primary:hover {
    background: #11223b;
    border-color: #11223b;
  }

  .analytics-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    border-bottom: 1px solid var(--border, #e2e8f0);
    margin-top: 12px;
    overflow-x: auto;
    white-space: nowrap;
    scrollbar-width: none;
  }
  .analytics-tabs::-webkit-scrollbar {
    display: none;
  }

  .analytics-tab {
    font-size: 12px;
    padding: 10px 18px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--muted-foreground, #64748b);
    border-bottom: 2px solid transparent;
    transition: color .15s ease, border-color .15s ease, background .15s ease;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    position: relative;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .analytics-tab:hover {
    color: var(--color-primary, #0a1628);
    background: rgba(10, 22, 40, 0.03);
  }

  .analytics-tab.active {
    color: var(--color-accent, #d4af37);
    border-bottom-color: var(--color-accent, #d4af37);
    font-weight: 700;
    background: rgba(212, 175, 55, 0.06);
  }

  .analytics-tab-icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }

  .analytics-layout {
    display: block;
    width: 100%;
  }

  .analytics-main {
    width: 100%;
    padding: 24px;
    box-sizing: border-box;
    min-width: 0;
  }

  .analytics-tab-content {
    display: none;
  }

  .analytics-tab-content.active {
    display: block;
  }

  .analytics-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .analytics-kpi-card {
    background: var(--card, #ffffff);
    border: 0.5px solid var(--border, #e2e8f0);
    border-radius: 10px;
    padding: 16px;
  }

  .analytics-kpi-label {
    font-size: 11px;
    color: var(--muted-foreground, #64748b);
    text-transform: uppercase;
    letter-spacing: .05em;
    margin-bottom: 6px;
  }

  .analytics-kpi-value {
    font-size: 24px;
    font-weight: 500;
    color: var(--foreground, #1e293b);
    line-height: 1;
    margin-bottom: 4px;
  }

  .analytics-kpi-change {
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .analytics-kpi-change.up {
    color: var(--success, #16a34a);
  }

  .analytics-kpi-change.down {
    color: var(--danger, #ef4444);
  }

  .analytics-kpi-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .analytics-kpi-icon.blue {
    background: var(--info-light, #dbeafe);
    color: var(--info, #2563eb);
  }

  .analytics-kpi-icon.green {
    background: var(--success-light, #dcfce7);
    color: var(--success, #16a34a);
  }

  .analytics-kpi-icon.amber {
    background: var(--warning-light, #fef3c7);
    color: var(--warning, #f59e0b);
  }

  .analytics-kpi-icon.purple {
    background: #ede9fe;
    color: #7c3aed;
  }

  .analytics-charts-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .analytics-chart-card {
    background: var(--card, #ffffff);
    border: 0.5px solid var(--border, #e2e8f0);
    border-radius: 10px;
    overflow: hidden;
  }

  .analytics-chart-card-header {
    padding: 14px 16px 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .analytics-chart-card-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground, #1e293b);
  }

  .analytics-chart-card-sub {
    font-size: 12px;
    color: var(--muted-foreground, #64748b);
    margin-top: 2px;
  }

  .analytics-chart-card-body {
    padding: 16px;
  }

  .analytics-metric-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 0.5px solid var(--border, #e2e8f0);
  }

  .analytics-metric-row:last-child {
    border-bottom: none;
  }

  .analytics-metric-row-label {
    font-size: 13px;
    color: var(--foreground, #1e293b);
  }

  .analytics-metric-row-sub {
    font-size: 11px;
    color: var(--muted-foreground, #64748b);
    margin-top: 1px;
  }

  .analytics-metric-row-val {
    font-size: 15px;
    font-weight: 500;
    color: var(--foreground, #1e293b);
    text-align: right;
  }

  .analytics-metric-row-change {
    font-size: 11px;
    text-align: right;
  }

  .analytics-hero-banner {
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 20px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .analytics-hero-banner.blue {
    background: var(--info-light, #dbeafe);
    border: 0.5px solid #bfdbfe;
  }

  .analytics-hero-banner.green {
    background: var(--success-light, #dcfce7);
    border: 0.5px solid #bbf7d0;
  }

  .analytics-hero-banner.amber {
    background: var(--warning-light, #fef3c7);
    border: 0.5px solid #fde68a;
  }

  .analytics-hero-banner-val {
    font-size: 32px;
    font-weight: 500;
    line-height: 1;
    margin-bottom: 4px;
  }

  .analytics-hero-banner.blue .analytics-hero-banner-val {
    color: var(--info-dark, #1e40af);
  }

  .analytics-hero-banner.green .analytics-hero-banner-val {
    color: var(--success-dark, #166534);
  }

  .analytics-hero-banner.amber .analytics-hero-banner-val {
    color: var(--warning-dark, #92400e);
  }

  .analytics-hero-banner-label {
    font-size: 13px;
    color: var(--muted-foreground, #64748b);
  }

  .analytics-hero-banner-icon {
    font-size: 32px;
    opacity: .3;
  }

  .analytics-divider {
    height: 0.5px;
    background: var(--border, #e2e8f0);
  }

  .analytics-maint-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }

  .analytics-maint-box {
    border-radius: 8px;
    border: 0.5px solid;
    padding: 14px;
    text-align: center;
  }

  .analytics-maint-box.green {
    background: var(--success-light, #dcfce7);
    border-color: #bbf7d0;
  }

  .analytics-maint-box.amber {
    background: var(--warning-light, #fef3c7);
    border-color: #fde68a;
  }

  .analytics-maint-val {
    font-size: 22px;
    font-weight: 500;
  }

  .analytics-maint-box.green .analytics-maint-val {
    color: var(--success-dark, #166534);
  }

  .analytics-maint-box.amber .analytics-maint-val {
    color: var(--warning-dark, #92400e);
  }

  .analytics-maint-sub {
    font-size: 11px;
    color: var(--muted-foreground, #64748b);
    margin-top: 2px;
  }
`;

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

  return (
    <div className="analytics-container">
      <style>{styles}</style>

      {/* Top Bar */}
      <div className="analytics-topbar">
        <div className="analytics-topbar-row">
          <div>
            <div className="analytics-topbar-title">Analytics</div>
            <div className="analytics-topbar-sub">
              {branchLabel} • {buildRangeLabel(range)}
            </div>
          </div>
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
                  className="analytics-kpi-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleTabChange("occupancy")}
                >
                  <div className="analytics-kpi-icon blue">
                    <Bed size={15} strokeWidth={1.5} />
                  </div>
                  <div className="analytics-kpi-label">Occupancy rate</div>
                  <div className="analytics-kpi-value">
                    {occupancyQuery.isLoading ? "..." : occupancyKpis.occupancyRateLabel || "0%"}
                  </div>
                  <div className="analytics-kpi-change up">↑ 5.2% vs prev period</div>
                </div>
                <div
                  className="analytics-kpi-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleTabChange("revenue")}
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
                  <div className="analytics-kpi-change up">↑ 12.3% vs prev period</div>
                </div>
                <div
                  className="analytics-kpi-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleTabChange("operations")}
                >
                  <div className="analytics-kpi-icon amber">
                    <CalendarDays size={15} strokeWidth={1.5} />
                  </div>
                  <div className="analytics-kpi-label">Reservations</div>
                  <div className="analytics-kpi-value">
                    {operationsQuery.isLoading ? "..." : operationsKpis.reservations || 0}
                  </div>
                  <div className="analytics-kpi-change up">↑ 8.1% vs prev period</div>
                </div>
                <div
                  className="analytics-kpi-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleTabChange("operations")}
                >
                  <div className="analytics-kpi-icon purple">
                    <Wrench size={15} strokeWidth={1.5} />
                  </div>
                  <div className="analytics-kpi-label">Maintenance</div>
                  <div className="analytics-kpi-value">
                    {operationsQuery.isLoading ? "..." : operationsKpis.maintenanceRequests || 0}
                  </div>
                  <div className="analytics-kpi-change down">↓ 4.2% vs prev period</div>
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
                          style={{ color: "var(--success)" }}
                        >
                          ↑ 12 pp
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
                          style={{ color: "var(--success)" }}
                        >
                          ↑ 24%
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
                          style={{ color: "var(--success)" }}
                        >
                          ↑ 14
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
                          style={{ color: "var(--danger)" }}
                        >
                          ↓ 3
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
