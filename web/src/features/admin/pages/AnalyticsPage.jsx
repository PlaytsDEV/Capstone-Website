import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Bed,
  DollarSign,
  Shield,
  TrendingUp,
  Wrench,
  LayoutGrid,
  PhilippinePeso,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import {
  useBillingReport,
  useOccupancyReport,
  useOperationsReport,
} from "../../../shared/hooks/queries/useAnalyticsReports";
import "../styles/design-tokens.css";
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
} from "./analyticsTabShared";
import { buildRangeLabel, formatBranch, formatPeso } from "./reportCommon";

// Inline styles matching the HTML
const styles = `
  .analytics-container {
    font-family: var(--font-sans, system-ui, sans-serif);
    background: #f1f5f9);
    color: var(--foreground, #1e293b);
    font-size: 13px;
    min-height: 100vh;
    margin: 0px;        /* ← add */
    padding: 0px;       /* ← add */
  }

  .analytics-topbar {
    background: var(--card, #ffffff);
    border-bottom: 0.5px solid var(--border, #e2e8f0);
    top: 0;
    z-index: 10;
    margin: 0;
    padding: 16px 24px 0; /* ← add this */
  }

  .analytics-topbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .analytics-topbar-title {
    font-size: 18px;
    font-weight: 500;
    color: var(--foreground, #1e293b);
  }

  .analytics-topbar-sub {
    font-size: 12px;
    color: var(--muted-foreground, #64748b);
    margin-top: 2px;
  }

  .analytics-topbar-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .analytics-filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .analytics-filter-label {
    font-size: 12px;
    color: var(--muted-foreground, #64748b);
  }

  .analytics-select {
    font-size: 12px;
    padding: 5px 10px;
    border: 0.5px solid var(--border, #e2e8f0);
    border-radius: 6px;
    background: var(--card, #ffffff);
    color: var(--foreground, #1e293b);
    cursor: pointer;
    outline: none;
  }

  .analytics-select:focus {
    border-color: var(--info, #2563eb);
  }

  .analytics-btn {
    font-size: 12px;
    padding: 5px 12px;
    border: 0.5px solid var(--border, #e2e8f0);
    border-radius: 6px;
    background: var(--card, #ffffff);
    color: var(--foreground, #1e293b);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .analytics-btn:hover {
    background: var(--muted, #f1f5f9);
  }

  .analytics-btn-primary {
    background: var(--info, #2563eb);
    color: #fff;
    border-color: var(--info, #2563eb);
  }

  .analytics-btn-primary:hover {
    background: var(--info-dark, #1e40af);
  }

  .analytics-tabs {
    display: flex;
    gap: 0;
    border-bottom: none;
    margin-top: 12px;
    overflow-x: auto;
    white-space: nowrap;
  }

  .analytics-tab {
    font-size: 13px;
    padding: 8px 16px;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--muted-foreground, #64748b);
    border-bottom: 2px solid transparent;
    transition: color .15s, border-color .15s;
    font-weight: 400;
  }

  .analytics-tab:hover {
    color: var(--foreground, #1e293b);
  }

 .analytics-tab.active {
  color: var(--primary, #d4af37);
  border-bottom-color: var(--primary, #d4af37);
  font-weight: 500;
}

  .analytics-layout {
    display: flex;
  }

  .analytics-sidebar {
      width: 280px;
  flex-shrink: 0;
  background: var(--bg-sidebar, var(--card, #ffffff));
  border-right: 0.5px solid var(--color-border-subtle, var(--border, #e2e8f0));
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: calc(100vh - 113px); /* adjust 113px to match your topbar height */
  }

  .analytics-sidebar-section-label {
    font-size: var(--font-size-sm, 12px);
    font-weight: 500;
    color: var(--color-text-secondary, var(--muted-foreground, #64748b));
    text-transform: uppercase;
    letter-spacing: .06em;
    margin-bottom: 8px;
  }

  .analytics-quick-links {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .analytics-quick-link {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--color-border-subtle, var(--border, #e2e8f0));
    border-radius: var(--radius-md, 8px);
    text-decoration: none;
    background: var(--color-bg-surface, var(--card, #ffffff));
    color: var(--color-text-primary, var(--foreground, #1e293b));
    font-size: var(--font-size-md, 14px);
    font-weight: var(--font-weight-medium, 500);
    transition:
      background var(--duration-fast, 0.15s) var(--ease-out, ease),
      border-color var(--duration-fast, 0.15s) var(--ease-out, ease),
      color var(--duration-fast, 0.15s) var(--ease-out, ease);
  }

.analytics-quick-link:hover {
  background: var(--bg-hover, var(--muted, #f1f5f9));
  border-color: #d4af37;
  color: #d4af37;
}

  .analytics-quick-link-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: var(--color-text-secondary, var(--muted-foreground, #64748b));
  }

  .analytics-quick-link:hover .analytics-quick-link-icon {
  color: #d4af37;
}

  .analytics-quick-link-label {
    line-height: 1.2;
  }

  .analytics-quick-link-tag {
    margin-left: auto;
    font-size: var(--font-size-xs, 11px);
    font-weight: var(--font-weight-medium, 500);
    color: var(--color-text-secondary, var(--muted-foreground, #64748b));
    background: var(--status-neutral-bg, rgba(100, 116, 139, 0.1));
    padding: 2px 6px;
    border-radius: var(--radius-sm, 5px);
  }

  .analytics-quick-link.is-disabled {
    opacity: 0.68;
    cursor: not-allowed;
    pointer-events: none;
  }

  .analytics-insight-card {
    border-radius: 8px;
    border: 0.5px solid;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.5;
  }

  .analytics-insight-card .ic-title {
    font-weight: 500;
    margin-bottom: 2px;
  }

  .analytics-insight-card.green {
    background: var(--success-light, #dcfce7);
    border-color: #bbf7d0;
    color: var(--success-dark, #166534);
  }

  .analytics-insight-card.amber {
    background: var(--warning-light, #fef3c7);
    border-color: #fde68a;
    color: var(--warning-dark, #92400e);
  }

  .analytics-insight-card.blue {
    background: var(--info-light, #dbeafe);
    border-color: #bfdbfe;
    color: var(--info-dark, #1e40af);
  }

  .analytics-main {
  flex: 1;
  padding: 24px; /* keep or adjust as needed */
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
  const [activeTab, setActiveTab] = useState("overview");

  const isOwner = user?.role === "owner";
  const canViewSurveyAnalytics = can("viewSurveyAnalytics");
  const requestedRange = searchParams.get("range");
  const requestedBranch = searchParams.get("branch");
  const { range, branch } = normalizeAnalyticsSummaryState({
    requestedRange,
    requestedBranch,
    isOwner,
    userBranch: user?.branch || "gil-puyat",
  });

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
    setSearchParams(nextParams, { replace: true });
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

  const occupancyQuery = useOccupancyReport(sharedDayParams);
  const billingQuery = useBillingReport(billingParams);
  const operationsQuery = useOperationsReport(sharedDayParams);

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

  const hasPartialError = [
    occupancyQuery.isError,
    billingQuery.isError,
    operationsQuery.isError,
  ].some(Boolean);

  const handleRangeChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("range", value);
    setSearchParams(nextParams, { replace: true });
  };

  const handleBranchChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("branch", value);
    setSearchParams(nextParams, { replace: true });
  };

  const occupancyRate = parseFloat(occupancyKpis.occupancyRateLabel || "0");
  const isHighOccupancy = occupancyRate > 85;
  const allDataLoaded = !hasPartialError;

  const occupancyDetailHref = buildAnalyticsDetailsHref({
    tab: "occupancy",
    range,
    branch,
    isOwner,
  });
  const billingDetailHref = buildAnalyticsDetailsHref({
    tab: "billing",
    range,
    branch,
    isOwner,
  });
  const operationsDetailHref = buildAnalyticsDetailsHref({
    tab: "operations",
    range,
    branch,
    isOwner,
  });
  const consolidatedDetailHref = buildAnalyticsDetailsHref({
    tab: "consolidated",
    range,
    branch,
    isOwner,
  });
  const financialsDetailHref = buildAnalyticsDetailsHref({
    tab: "financials",
    range,
    branch,
    isOwner,
  });
  const monitoringDetailHref = buildAnalyticsDetailsHref({
    tab: "monitoring",
    range,
    branch,
    isOwner,
  });
  const surveyParams = new URLSearchParams(
    isOwner && branch !== "all" ? { branch } : {},
  );
  const surveyAnalyticsHref = `/admin/analytics/feedback-surveys${surveyParams.size ? `?${surveyParams}` : ""}`;

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
          <div className="analytics-topbar-actions">
            <div className="analytics-filter-row">
              <span className="analytics-filter-label">Range</span>
              <select
                className="analytics-select"
                value={range}
                onChange={(e) => handleRangeChange(e.target.value)}
              >
                {RANGE_OPTIONS_SHORT.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {isOwner && (
                <>
                  <span className="analytics-filter-label">Branch</span>
                  <select
                    className="analytics-select"
                    value={branch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                  >
                    <option value="all">All branches</option>
                    <option value="gil-puyat">Gil Puyat</option>
                    <option value="makati">Makati</option>
                  </select>
                </>
              )}
            </div>
            <button className="analytics-btn analytics-btn-primary">
              ↓ Export
            </button>
          </div>
        </div>
        <div className="analytics-tabs">
          <button
            className={`analytics-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`analytics-tab ${activeTab === "occupancy" ? "active" : ""}`}
            onClick={() => setActiveTab("occupancy")}
          >
            Occupancy
          </button>
          <button
            className={`analytics-tab ${activeTab === "revenue" ? "active" : ""}`}
            onClick={() => setActiveTab("revenue")}
          >
            Revenue
          </button>
          <button
            className={`analytics-tab ${activeTab === "operations" ? "active" : ""}`}
            onClick={() => setActiveTab("operations")}
          >
            Operations
          </button>
          {canViewSurveyAnalytics && (
            <button
              className="analytics-tab"
              onClick={() => navigate(surveyAnalyticsHref)}
            >
              Feedback &amp; Surveys
            </button>
          )}
        </div>
      </div>

      <div className="analytics-layout">
        {/* Sidebar */}
        <aside className="analytics-sidebar">
          <div>
            <div className="analytics-sidebar-section-label">Insights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {isHighOccupancy && (
                <div className="analytics-insight-card green">
                  <div className="ic-title">High occupancy</div>
                  Above 85% — consider reviewing pricing.
                </div>
              )}
              {allDataLoaded && (
                <div className="analytics-insight-card blue">
                  <div className="ic-title">All data loaded</div>
                  All three reports loaded successfully.
                </div>
              )}
            </div>
          </div>
          <div className="analytics-divider"></div>
          <div>
            <div className="analytics-sidebar-section-label">Quick links</div>
            <div className="analytics-quick-links">
              <a
                href={occupancyDetailHref}
                className="analytics-quick-link"
              >
                <Bed className="analytics-quick-link-icon" aria-hidden="true" />
                <span className="analytics-quick-link-label">Occupancy Analytics</span>
              </a>
              <a
                href={billingDetailHref}
                className="analytics-quick-link"
              >
                <DollarSign className="analytics-quick-link-icon" aria-hidden="true" />
                <span className="analytics-quick-link-label">Billing Analytics</span>
              </a>
              <a
                href={operationsDetailHref}
                className="analytics-quick-link"
              >
                <Wrench className="analytics-quick-link-icon" aria-hidden="true" />
                <span className="analytics-quick-link-label">Operations Analytics</span>
              </a>
              <a
                href={consolidatedDetailHref}
                className={`analytics-quick-link ${!isOwner ? "is-disabled" : ""}`}
                aria-disabled={!isOwner}
              >
                <BarChart3 className="analytics-quick-link-icon" aria-hidden="true" />
                <span className="analytics-quick-link-label">Consolidated Reports</span>
                {!isOwner && <span className="analytics-quick-link-tag">Owner</span>}
              </a>
              {canViewSurveyAnalytics && (
                <a
                  href={surveyAnalyticsHref}
                  className="analytics-quick-link"
                >
                  <ClipboardList className="analytics-quick-link-icon" aria-hidden="true" />
                  <span className="analytics-quick-link-label">Feedback &amp; Surveys</span>
                </a>
              )}
              <a
                href={financialsDetailHref}
                className={`analytics-quick-link ${!isOwner ? "is-disabled" : ""}`}
                aria-disabled={!isOwner}
              >
                <TrendingUp className="analytics-quick-link-icon" aria-hidden="true" />
                <span className="analytics-quick-link-label">Financial Analytics</span>
                {!isOwner && <span className="analytics-quick-link-tag">Owner</span>}
              </a>
              <a
                href={monitoringDetailHref}
                className={`analytics-quick-link ${!isOwner ? "is-disabled" : ""}`}
                aria-disabled={!isOwner}
              >
                <Shield className="analytics-quick-link-icon" aria-hidden="true" />
                <span className="analytics-quick-link-label">System Monitoring</span>
                {!isOwner && <span className="analytics-quick-link-tag">Owner</span>}
              </a>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="analytics-main">
          {/* Overview Tab */}
          <div className={`analytics-tab-content ${activeTab === "overview" ? "active" : ""}`}>
            <div className="analytics-kpi-grid">
              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon blue">
                    <Bed size={15} strokeWidth={1.5} />
                </div>
                <div className="analytics-kpi-label">Occupancy rate</div>
                <div className="analytics-kpi-value">
                  {occupancyQuery.isLoading ? "..." : occupancyKpis.occupancyRateLabel || "0%"}
                </div>
                <div className="analytics-kpi-change up">↑ 5.2% vs prev period</div>
              </div>
              <div className="analytics-kpi-card">
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
              <div className="analytics-kpi-card">
                <div className="analytics-kpi-icon amber">
                    <CalendarDays size={15} strokeWidth={1.5} />
                </div>
                <div className="analytics-kpi-label">Reservations</div>
                <div className="analytics-kpi-value">
                  {operationsQuery.isLoading ? "..." : operationsKpis.reservations || 0}
                </div>
                <div className="analytics-kpi-change up">↑ 8.1% vs prev period</div>
              </div>
              <div className="analytics-kpi-card">
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
                  <div className="analytics-chart-card-title">Occupancy trend</div>
                  <div className="analytics-chart-card-sub">
                    Daily rate — {buildRangeLabel(range).toLowerCase()}
                  </div>
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
                  <div className="analytics-chart-card-title">Revenue collections</div>
                  <div className="analytics-chart-card-sub">Billed vs collected — monthly</div>
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
                  <div className="analytics-chart-card-title">Reservation activity</div>
                  <div className="analytics-chart-card-sub">Bookings per week</div>
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

          {/* Occupancy Tab */}
          <div className={`analytics-tab-content ${activeTab === "occupancy" ? "active" : ""}`}>
            <div className="analytics-hero-banner blue">
              <div>
                <div className="analytics-hero-banner-val">
                  {occupancyQuery.isLoading ? "..." : occupancyKpis.occupancyRateLabel || "0%"}
                </div>
                <div className="analytics-hero-banner-label">Current occupancy rate</div>
                <div style={{ fontSize: "12px", color: "var(--info)", marginTop: "6px" }}>
                  ↑ 5.2% from previous period
                </div>
              </div>
              <div className="analytics-hero-banner-icon">⊞</div>
            </div>
            <div className="analytics-chart-card">
              <div className="analytics-chart-card-header">
                <div className="analytics-chart-card-title">Occupancy trend — detailed</div>
                <div className="analytics-chart-card-sub">
                  Daily rate for {buildRangeLabel(range).toLowerCase()}
                </div>
              </div>
              <div className="analytics-chart-card-body">
                <AnalyticsLineChart
                  data={occupancyTrend.map((item) => ({
                    label: item.label,
                    occupancy: item.totalRate,
                  }))}
                  lines={[{ key: "occupancy", label: "Occupancy rate" }]}
                  height={200}
                  valueFormatter={(value) => `${value}%`}
                  emptyTitle="No occupancy trend"
                  emptyDescription="The selected scope does not yet have sufficient occupancy history."
                />
              </div>
            </div>
          </div>

          {/* Revenue Tab */}
          <div className={`analytics-tab-content ${activeTab === "revenue" ? "active" : ""}`}>
            <div className="analytics-hero-banner green">
              <div>
                <div className="analytics-hero-banner-val">
                  {billingQuery.isLoading
                    ? "..."
                    : billingKpis.collectedRevenueLabel?.replace("PHP ", "₱") || "₱0"}
                </div>
                <div className="analytics-hero-banner-label">Total revenue collected</div>
                <div style={{ fontSize: "12px", color: "var(--success)", marginTop: "6px" }}>
                  ↑ 12.3% from previous period
                </div>
              </div>
              <div className="analytics-hero-banner-icon">₱</div>
            </div>
            <div className="analytics-chart-card">
              <div className="analytics-chart-card-header">
                <div className="analytics-chart-card-title">Revenue breakdown</div>
                <div className="analytics-chart-card-sub">
                  Billed vs collected — {buildRangeLabel(billingParams.range).toLowerCase()}
                </div>
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
                  height={180}
                  valueFormatter={(value) => formatPeso(value)}
                  emptyTitle="No billing collection data"
                  emptyDescription="Collection history will appear once billing data is available for this scope."
                />
              </div>
            </div>
          </div>

          {/* Operations Tab */}
          <div className={`analytics-tab-content ${activeTab === "operations" ? "active" : ""}`}>
            <div className="analytics-hero-banner amber">
              <div>
                <div className="analytics-hero-banner-val">
                  {operationsQuery.isLoading ? "..." : operationsKpis.reservations || 0}
                </div>
                <div className="analytics-hero-banner-label">Total reservations</div>
                <div
                  style={{ fontSize: "12px", color: "var(--warning-dark)", marginTop: "6px" }}
                >
                  ↑ 8.1% from previous period
                </div>
              </div>
              <div className="analytics-hero-banner-icon">📅</div>
            </div>
            <div className="analytics-charts-grid">
              <div className="analytics-chart-card">
                <div className="analytics-chart-card-header">
                  <div className="analytics-chart-card-title">Reservation trends</div>
                  <div className="analytics-chart-card-sub">Bookings per week</div>
                </div>
                <div className="analytics-chart-card-body">
                  <AnalyticsBarChart
                    data={reservationsByPeriod.map((item) => ({
                      label: item.label,
                      count: item.count,
                    }))}
                    bars={[{ key: "count", label: "Reservations", color: "#f59e0b" }]}
                    height={160}
                    emptyTitle="No reservation trend"
                    emptyDescription="Reservation activity will appear once data is available for the selected period."
                  />
                </div>
              </div>
              <div className="analytics-chart-card">
                <div className="analytics-chart-card-header">
                  <div className="analytics-chart-card-title">Maintenance overview</div>
                  <div className="analytics-chart-card-sub">Active requests</div>
                </div>
                <div className="analytics-chart-card-body">
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: "48px", fontWeight: "500", color: "#7c3aed" }}>
                      {operationsQuery.isLoading ? "..." : operationsKpis.maintenanceRequests || 0}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--muted-foreground)",
                        marginTop: "4px",
                      }}
                    >
                      Active requests
                    </div>
                  </div>
                  <div className="analytics-maint-grid">
                    <div className="analytics-maint-box green">
                      <div className="analytics-maint-val">12</div>
                      <div className="analytics-maint-sub">Resolved this week</div>
                    </div>
                    <div className="analytics-maint-box amber">
                      <div className="analytics-maint-val">5</div>
                      <div className="analytics-maint-sub">Avg. resolution days</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AnalyticsPageFinal() {
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");

  if (legacyTab && legacyTab !== "overview") {
    return (
      <Navigate
        to={`${ANALYTICS_DETAILS_PATH}?${searchParams.toString()}`}
        replace
      />
    );
  }

  return <AnalyticsFinalLayout clearLegacyOverview={legacyTab === "overview"} />;
}
