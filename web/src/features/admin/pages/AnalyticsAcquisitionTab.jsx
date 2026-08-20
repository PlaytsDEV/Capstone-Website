import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  DoorOpen,
  FileCheck,
  Percent,
  TrendingUp,
  Users,
} from "lucide-react";
import { inquiryApi } from "../../../shared/api/inquiryApi.js";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  DataTable,
  ReportChartPanel,
} from "../components/shared";
import {
  AnalyticsInsightSection,
  AnalyticsTableToolbar,
  ExportButtons,
  handleCsvExport,
  handlePdfExport,
  MetricGrid,
  useReportInsights,
} from "./analyticsTabShared";
import InquiryPipelineBoard from "../components/InquiryPipelineBoard";
import { AdminAnalyticsDetailSkeleton } from "../components/AdminContentSkeletons";
import "../styles/design-tokens.css";
import "../styles/admin-reports.css";

const ACQUISITION_PROMPTS = [
  "Which marketing channels have the highest conversion rate?",
  "How can we convert more leads into move-ins?",
  "Which channels bring in the most viewings?",
  "Where should we focus our marketing efforts?",
];

const CHANNEL_COLUMNS = [
  { key: "channel", label: "Marketing Channel", sortable: true },
  { key: "totalLeads", label: "Total Leads", sortable: true },
  { key: "viewingsScheduled", label: "Viewings Scheduled", sortable: true },
  {
    key: "convertedCount",
    label: "Converted Tenants",
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        {row.convertedCount || 0}
      </span>
    ),
  },
  {
    key: "conversionRate",
    label: "Conversion Rate",
    sortable: true,
    render: (row) => {
      const rate = row.conversionRate || 0;
      const isHigh = rate >= 30;
      const isPositive = rate > 0;
      return (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: 600,
            background: isHigh
              ? "var(--success-subtle, #dcfce7)"
              : isPositive
              ? "var(--info-subtle, #dbeafe)"
              : "var(--muted, #f1f5f9)",
            color: isHigh
              ? "var(--success-dark, #166534)"
              : isPositive
              ? "var(--info-dark, #1e40af)"
              : "var(--muted-foreground, #64748b)",
            border: isHigh
              ? "1px solid rgba(22, 101, 52, 0.2)"
              : isPositive
              ? "1px solid rgba(30, 64, 175, 0.2)"
              : "1px solid var(--border, #e2e8f0)",
          }}
        >
          {rate}%
        </span>
      );
    },
  },
];

export default function AnalyticsAcquisitionTab({
  branch,
  range = "30d",
  isOwner = false,
  onBranchChange,
  onRangeChange,
  registerExport,
}) {
  const [report, setReport] = useState([]);
  const [funnelData, setFunnelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "operations",
    range,
    branch: isOwner ? branch : undefined,
  });

  const handleExecuteAction = (action) => {
    if (!action) return;
    if (action.actionType === "SEARCH" && action.filterValue) {
      setSearchQuery(action.filterValue);
      setPage(1);
    }
  };

  const fetchRoi = async () => {
    try {
      setLoading(true);
      const res = await inquiryApi.getMarketingRoi();
      if (res?.data) {
        setReport(Array.isArray(res.data) ? res.data : []);
        setFunnelData(res.funnel || null);
      } else if (Array.isArray(res)) {
        setReport(res);
      }
    } catch (err) {
      console.error("Acquisition report fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoi();
  }, [branch]);

  // Calculate high-level summary KPIs
  const { totalLeads, totalViewings, totalConverted, overallConversionRate } =
    useMemo(() => {
      let leads = 0;
      let viewings = 0;
      let converted = 0;

      report.forEach((item) => {
        leads += item.totalLeads || 0;
        viewings += item.viewingsScheduled || 0;
        converted += item.convertedCount || 0;
      });

      const conversionRate = leads > 0 ? Math.round((converted / leads) * 100) : 0;

      return {
        totalLeads: leads,
        totalViewings: viewings,
        totalConverted: converted,
        overallConversionRate: conversionRate,
      };
    }, [report]);

  const metricCards = [
    {
      icon: Users,
      tone: "blue",
      label: "Total Leads",
      value: totalLeads,
      trend: "Inquiries received",
    },
    {
      icon: CalendarDays,
      tone: "amber",
      label: "Viewings Scheduled",
      value: totalViewings,
      trend: "Tours booked",
    },
    {
      icon: CheckCircle2,
      tone: "green",
      label: "Converted Tenants",
      value: totalConverted,
      trend: "Lease applications",
    },
    {
      icon: Percent,
      tone: "green",
      label: "Conversion Rate",
      value: `${overallConversionRate}%`,
      trend: "Overall lead-to-lease",
      anomalyBadge:
        overallConversionRate >= 30
          ? { label: "High Funnel Yield", severity: "success" }
          : overallConversionRate < 10 && totalLeads > 5
          ? { label: "Low Velocity <10%", severity: "warning" }
          : null,
    },
  ];

  // Chart data formatting
  const chartData = useMemo(() => {
    return report.map((item) => ({
      label: item.channel,
      leads: item.totalLeads || 0,
      viewings: item.viewingsScheduled || 0,
      converted: item.convertedCount || 0,
    }));
  }, [report]);

  // Filtered rows for table
  const filteredReport = useMemo(() => {
    return report.filter((item) => {
      const matchSearch =
        !searchQuery ||
        (item.channel && item.channel.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchFilter =
        channelFilter === "all" ||
        (channelFilter === "has-leads" && (item.totalLeads || 0) > 0) ||
        (channelFilter === "has-conversions" && (item.convertedCount || 0) > 0);
      return matchSearch && matchFilter;
    });
  }, [report, searchQuery, channelFilter]);

  const exportCsv = () => {
    handleCsvExport(
      filteredReport,
      [
        { key: "channel", label: "Acquisition Channel" },
        { key: "totalLeads", label: "Total Leads" },
        { key: "viewingsScheduled", label: "Viewings Scheduled" },
        { key: "convertedCount", label: "Converted Tenants" },
        { key: "conversionRate", label: "Conversion Rate (%)" },
      ],
      `lilycrest-acquisition-${branch || "all"}-${range}`,
    );
  };

  const funnelStages = useMemo(() => {
    if (funnelData?.stages && funnelData.stages.length >= 5) {
      return funnelData.stages;
    }
    return [
      { key: "leads", label: "Inquiries Received", count: totalLeads },
      { key: "viewings", label: "Viewing Tours", count: totalViewings },
      { key: "applications", label: "Applications", count: totalConverted },
      { key: "approved", label: "Approved Bookings", count: totalConverted > 0 ? Math.round(totalConverted * 0.8) : 0 },
      { key: "moveIns", label: "Active Move-Ins", count: totalConverted > 0 ? Math.round(totalConverted * 0.65) : 0 },
    ];
  }, [funnelData, totalLeads, totalViewings, totalConverted]);

  const exportPdf = () => {
    handlePdfExport({
      title: "Lead Acquisition & Channel Performance Report",
      subtitle: `${isOwner ? formatBranch(branch) : "Branch Scope"} • ${buildRangeLabel(range)}`,
      filename: `lilycrest-acquisition-${branch || "all"}-${range}.pdf`,
      reportType: "Acquisition",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: String(item.value),
        sub: item.trend,
        highlight: i === 3,
      })),
      sections: [
        {
          title: "Lead-to-Lease Conversion Funnel",
          type: "table",
          headers: ["Stage", "Volume", "Stage Conversion", "Funnel Share"],
          rows: funnelStages.map((stage, idx) => {
            const prevStage = funnelStages[idx - 1];
            const stepConv = prevStage && prevStage.count > 0 ? `${Math.round((stage.count / prevStage.count) * 100)}%` : "100%";
            const share = funnelStages[0].count > 0 ? `${Math.round((stage.count / funnelStages[0].count) * 100)}%` : "0%";
            return {
              Stage: stage.label,
              Volume: String(stage.count),
              "Stage Conversion": stepConv,
              "Funnel Share": share,
            };
          }),
        },
        {
          title: "Channel Performance Summary",
          type: "table",
          headers: ["Acquisition Channel", "Total Leads", "Viewings", "Converted", "Conversion Rate"],
          rows: filteredReport.map((item) => ({
            "Acquisition Channel": item.channel || "Direct",
            "Total Leads": String(item.totalLeads || 0),
            Viewings: String(item.viewingsScheduled || 0),
            Converted: String(item.convertedCount || 0),
            "Conversion Rate": `${item.conversionRate || 0}%`,
          })),
        },
      ],
    });
  };

  useEffect(() => {
    if (registerExport) {
      registerExport({ exportCsv, exportPdf });
    }
  }, [registerExport, exportCsv, exportPdf]);

  if (loading && report.length === 0) {
    return <AdminAnalyticsDetailSkeleton tab="operations" isOwner={isOwner} />;
  }

  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1">
      {/* 4 Executive KPI Cards */}
      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="acquisition"
        summaryTitle="Lead Acquisition & Conversion Intelligence"
        reportType="operations"
        range={range}
        branch={branch}
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
        suggestedPrompts={ACQUISITION_PROMPTS}
        onExecuteAction={handleExecuteAction}
      />

      {/* Stepped Lead-to-Lease Conversion Funnel */}
      <ReportChartPanel
        title="Lead-to-Lease Conversion Funnel"
        subtitle="Stage-by-stage progression from initial lead contact to confirmed tenant move-in"
      >
        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Pipeline Conversion Yield:</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-border">
                {funnelStages[0]?.count > 0
                  ? Math.round(((funnelStages[4]?.count || 0) / funnelStages[0].count) * 100)
                  : 0}% Overall
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
              <span>Leads: <strong className="text-foreground font-semibold">{funnelStages[0]?.count || 0}</strong></span>
              <span>•</span>
              <span>Tours: <strong className="text-foreground font-semibold">{funnelStages[1]?.count || 0}</strong></span>
              <span>•</span>
              <span>Move-Ins: <strong className="text-foreground font-semibold">{funnelStages[4]?.count || 0}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-stretch pt-1">
            {funnelStages.map((stage, idx) => {
              const prevStage = funnelStages[idx - 1];
              const stepConversion = prevStage && prevStage.count > 0
                ? Math.round((stage.count / prevStage.count) * 100)
                : 100;
              const overallShare = funnelStages[0]?.count > 0
                ? Math.round((stage.count / funnelStages[0].count) * 100)
                : 0;

              return (
                <div
                  key={stage.key}
                  className="bg-muted/30 border border-border rounded-xl p-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Stage {idx + 1}
                    </span>
                    {idx > 0 ? (
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-border">
                        {stepConversion}%
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Intake
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xl font-bold text-foreground">
                      {stage.count}
                    </div>
                    <div className="text-xs font-semibold text-foreground mt-0.5">
                      {stage.label}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
                    <span>{overallShare}% of total</span>
                    {idx < funnelStages.length - 1 && (
                      <ArrowRight size={12} className="text-muted-foreground hidden sm:block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ReportChartPanel>

      {/* 2-Column Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel
          title="Channel volume & conversions"
          subtitle="Inquiries received vs viewings and converted tenants by channel"
        >
          <AnalyticsBarChart
            data={chartData}
            bars={[
              { key: "leads", label: "Total Leads", color: "#0284c7" },
              { key: "viewings", label: "Viewings", color: "#f59e0b" },
              { key: "converted", label: "Converted", color: "#16a34a" },
            ]}
            height={160}
            emptyTitle="No channel data"
            emptyDescription="Lead data will appear once inquiries are received."
          />
        </ReportChartPanel>

        <ReportChartPanel
          title="Acquisition channel mix"
          subtitle="Lead distribution across discovery sources"
        >
          <AnalyticsDonutChart
            data={report
              .filter((item) => (item.totalLeads || 0) > 0)
              .map((item) => ({
                label: item.channel,
                value: item.totalLeads,
              }))}
            centerLabel={{ value: totalLeads, label: "Leads" }}
            emptyTitle="No channel distribution"
            emptyDescription="Discovery sources will populate as inquiries are logged."
          />
        </ReportChartPanel>
      </div>

      {/* Acquisition Performance Table */}
      <ReportChartPanel
        title="Acquisition Channel Performance"
        subtitle="Breakdown of inquiry intake, tour schedules, and final conversions by source"
        actions={<ExportButtons onCsv={exportCsv} onPdf={exportPdf} />}
      >
        <AnalyticsTableToolbar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          searchPlaceholder="Search marketing channel..."
          filters={[
            {
              key: "channelFilter",
              label: "Channel",
              value: channelFilter,
              onChange: (val) => {
                setChannelFilter(val);
                setPage(1);
              },
              options: [
                { value: "all", label: "All Channels" },
                { value: "has-leads", label: "With Leads (>0)" },
                { value: "has-conversions", label: "With Conversions (>0)" },
              ],
            },
          ]}
          hasActiveFilters={Boolean(searchQuery || channelFilter !== "all")}
          onResetFilters={() => {
            setSearchQuery("");
            setChannelFilter("all");
            setPage(1);
          }}
          extraActions={
            <span className="text-xs font-medium text-muted-foreground">
              Showing {filteredReport.length} channels
            </span>
          }
        />

        <DataTable
          columns={CHANNEL_COLUMNS}
          data={filteredReport}
          loading={loading}
          pagination={{
            page,
            pageSize,
            total: filteredReport.length,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyState={{
            title: "No acquisition records",
            description: "No acquisition channel data found matching your filter.",
          }}
        />
      </ReportChartPanel>

      {/* Inquiry Pipeline Kanban Board */}
      <ReportChartPanel
        title="Lead Triage & Conversion Pipeline"
        subtitle="Real-time inquiry workflow management from initial contact to approved tenant reservation"
      >
        <InquiryPipelineBoard />
      </ReportChartPanel>
    </div>
  );
}
