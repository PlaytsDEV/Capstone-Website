import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Calendar,
  DoorOpen,
  GraduationCap,
  Users,
} from "lucide-react";
import { useDemographicsReport } from "../../../shared/hooks/queries/useAnalyticsReports";
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsTabLayout,
  AnalyticsToolbar,
  DataTable,
  DetailDrawer,
  ReportChartPanel,
} from "../components/shared";
import { AdminAnalyticsDetailSkeleton } from "../components/AdminContentSkeletons";
import { buildRangeLabel, formatBranch } from "./reportCommon";
import {
  AnalyticsInsightSection,
  AnalyticsTableToolbar,
  buildInsightPdfSections,
  buildBranchControl,
  ExportButtons,
  handleCsvExport,
  handlePdfExport,
  MetricGrid,
  RANGE_OPTIONS_LONG,
  unwrapTableRows,
  useReportInsights,
  getDynamicDemographicsPrompts,
} from "./analyticsTabShared";

const GEO_COLUMNS = [
  { key: "province", label: "Province", sortable: true },
  { key: "city", label: "City", sortable: true },
  { key: "count", label: "Tenants", sortable: true },
];

const DRILLDOWN_COLUMNS = [
  { key: "name", label: "Tenant Name", sortable: true },
  { key: "room", label: "Room", sortable: true },
  { key: "roomType", label: "Room Type", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "createdAt", label: "Reserved On", sortable: true, render: (row) => row.createdAt ? dayjs(row.createdAt).format("MMM D, YYYY") : "—" },
];

export default function AnalyticsDemographicsTab({
  branch,
  range,
  isOwner,
  onBranchChange,
  onRangeChange,
  registerExport,
}) {
  const [page, setPage] = useState(1);
  const [geoSearch, setGeoSearch] = useState("");
  const [geoMinCount, setGeoMinCount] = useState("all");
  const [drilldown, setDrilldown] = useState(null);
  const [drilldownPage, setDrilldownPage] = useState(1);
  const [drilldownSearch, setDrilldownSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [drilldownPageSize, setDrilldownPageSize] = useState(5);

  const params = useMemo(
    () => ({
      range,
      ...(isOwner ? { branch } : {}),
    }),
    [branch, isOwner, range],
  );
  const { data, isLoading, isError } = useDemographicsReport(params);

  const {
    data: insightData,
    isLoading: isInsightLoading,
    isError: isInsightError,
  } = useReportInsights({
    reportType: "demographics",
    range,
    branch: isOwner ? branch : undefined,
  });

  const kpis = data?.kpis || {};
  const kpiDetails = data?.kpiDetails || {};
  const occupationMix = data?.series?.occupationMix || [];
  const genderDistribution = data?.series?.genderDistribution || [];
  const reservationsByMonth = data?.series?.reservationsByMonth || [];
  const roomTypePref = data?.series?.roomTypePreference || [];
  const bookingByHour = data?.series?.bookingByHour || [];
  const bookingByWeekday = data?.series?.bookingByWeekday || [];
  const referralSources = data?.series?.referralSources || [];
  const workScheduleMix = data?.series?.workScheduleMix || [];
  const ageDistribution = data?.series?.ageDistribution || [];
  const leaseDuration = data?.series?.leaseDuration || [];
  const geographicOrigin = unwrapTableRows(data?.tables?.geographicOrigin);

  const filteredGeographicOrigin = useMemo(() => {
    return geographicOrigin.filter((item) => {
      const matchSearch =
        !geoSearch ||
        (item.province && String(item.province).toLowerCase().includes(geoSearch.toLowerCase())) ||
        (item.city && String(item.city).toLowerCase().includes(geoSearch.toLowerCase()));

      const count = Number(item.count || 0);
      const matchCount =
        geoMinCount === "all" ||
        (geoMinCount === "5+" && count >= 5) ||
        (geoMinCount === "2+" && count >= 2);

      return matchSearch && matchCount;
    });
  }, [geographicOrigin, geoSearch, geoMinCount]);

  const filteredDrilldownRows = useMemo(() => {
    if (!drilldown?.rows) return [];
    if (!drilldownSearch) return drilldown.rows;
    return drilldown.rows.filter((row) =>
      (row.name && String(row.name).toLowerCase().includes(drilldownSearch.toLowerCase())) ||
      (row.room && String(row.room).toLowerCase().includes(drilldownSearch.toLowerCase())) ||
      (row.roomType && String(row.roomType).toLowerCase().includes(drilldownSearch.toLowerCase()))
    );
  }, [drilldown?.rows, drilldownSearch]);

  const demographicsPrompts = useMemo(
    () => getDynamicDemographicsPrompts(data),
    [data],
  );

  const openDrilldown = (title, rows, subtitle) => {
    setDrilldown({ title, rows: rows || [], subtitle });
    setDrilldownPage(1);
    setDrilldownSearch("");
  };

  const metricCards = [
    {
      icon: Users,
      tone: "blue",
      label: "Tenants Analyzed",
      value: kpis.totalAnalyzed || 0,
      trend: "Confirmed profiles",
      onClick: () => openDrilldown(
        "All Analyzed Tenants",
        kpiDetails.allTenants,
        `${kpis.totalAnalyzed || 0} confirmed tenants in this period`,
      ),
    },
    {
      icon: GraduationCap,
      tone: "green",
      label: "Student Ratio",
      value: kpis.studentPercentageLabel || "0%",
      trend: "Academic tenants",
      onClick: () => openDrilldown(
        "Student Tenants",
        kpiDetails.students,
        `${kpiDetails.students?.length || 0} tenants classified as students`,
      ),
    },
    {
      icon: DoorOpen,
      tone: "amber",
      label: "Top Room Preference",
      value: kpis.topRoomType || "N/A",
      trend: "Most selected category",
      onClick: () => openDrilldown(
        `${kpis.topRoomType || "Room Type"} Reservations`,
        kpiDetails.topRoomType,
        `${kpiDetails.topRoomType?.length || 0} tenants preferred ${kpis.topRoomType || "this room type"}`,
      ),
    },
    {
      icon: Calendar,
      tone: "amber",
      label: "Peak Move-in Month",
      value: kpis.peakMonth || "N/A",
      trend: "High reservation volume",
      onClick: () => openDrilldown(
        `Reservations in ${kpis.peakMonth || "Peak Month"}`,
        kpiDetails.peakMonth,
        `${kpiDetails.peakMonth?.length || 0} reservations created in ${kpis.peakMonth || "the peak month"}`,
      ),
    },
  ];

  const exportCsv = () => {
    handleCsvExport(
      filteredGeographicOrigin,
      [
        { key: "province", label: "Province" },
        { key: "city", label: "City" },
        { key: "count", label: "Tenant Count" },
      ],
      `lilycrest-demographics-${branch || "all"}-${range}`,
    );
  };

  const exportPdf = () => {
    const insight = insightData?.insight;
    handlePdfExport({
      title: "Tenant Demographics Analytics Report",
      subtitle: `${buildRangeLabel(range)} • ${formatBranch(data?.scope?.branch || branch)}`,
      filename: `lilycrest-demographics-${branch || "all"}-${range}.pdf`,
      reportType: "Demographics",
      kpis: metricCards.map((item, i) => ({
        label: item.label,
        value: item.value,
        sub: "",
        highlight: i === 0,
      })),
      aiInsight: {
        headline: insight?.headline || "Demographics summary",
        summary: insight?.summary || "",
        confidence: insight?.confidence === "high" ? 85
          : insight?.confidence === "medium" ? 60
          : insight?.confidence === "low" ? 35
          : 0,
        confidenceLabel: insight?.confidence
          ? `${insight.confidence.charAt(0).toUpperCase() + insight.confidence.slice(1)}`
          : "",
        standout: insight?.keyFindings || [],
        watch: insight?.riskAlerts || [],
        nextSteps: insight?.recommendedActions || [],
      },
      sections: [
        {
          title: "Occupation Mix",
          type: "table",
          headers: ["Segment", "Tenants"],
          rows: occupationMix.map((item) => ({
            Segment: item.label,
            Tenants: item.value,
          })),
        },
        {
          title: "Gender Distribution",
          type: "table",
          headers: ["Gender", "Tenants"],
          rows: genderDistribution.map((item) => ({
            Gender: item.label,
            Tenants: item.value,
          })),
        },
        {
          title: "Reservation Volume by Month",
          type: "table",
          headers: ["Month", "Reservations"],
          rows: reservationsByMonth
            .filter((item) => item.count > 0)
            .map((item) => ({
              Month: item.label,
              Reservations: item.count,
            })),
        },
        {
          title: "Top Geographic Origins",
          type: "table",
          headers: ["Province", "City", "Tenants"],
          rows: geographicOrigin
            .slice(0, 10)
            .map((item) => ({
              Province: item.province || "-",
              City: item.city || "-",
              Tenants: item.count || 0,
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

  if (isLoading && !data) {
    return <AdminAnalyticsDetailSkeleton tab="demographics" isOwner={isOwner} />;
  }

  const handleExecuteAction = (action) => {
    if (!action) return;
    if (action.actionType === "SEARCH" && action.filterValue) {
      setGeoSearch(action.filterValue);
      setPage(1);
    }
  };

  return (
    <div className="analytics-tab-content flex flex-col gap-6 w-full pt-1">
      <MetricGrid items={metricCards} />

      <AnalyticsInsightSection
        reportLabel="demographics"
        summaryTitle="Tenant Demographics Intelligence"
        reportType="demographics"
        range={range}
        branch={branch}
        data={insightData}
        isLoading={isInsightLoading}
        isError={isInsightError}
        suggestedPrompts={demographicsPrompts}
        onExecuteAction={handleExecuteAction}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel title="Occupation mix" subtitle="Student vs professional vs unspecified breakdown">
          <AnalyticsDonutChart
            data={occupationMix}
            centerLabel={{ value: kpis.totalAnalyzed || 0, label: "Total" }}
            emptyTitle="No occupation data"
            emptyDescription="Occupation data will appear once tenant applications include employment details."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Gender distribution" subtitle="Tenant gender ratio (Male vs Female vs Unspecified)">
          <AnalyticsDonutChart
            data={genderDistribution}
            centerLabel={{ value: genderDistribution.reduce((sum, item) => sum + item.value, 0), label: "Tenants" }}
            emptyTitle="No gender data"
            emptyDescription="Gender demographic distribution will appear as tenants register."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel title="Room type preferences" subtitle="What room types tenants prefer when booking">
          <AnalyticsDonutChart
            data={roomTypePref}
            centerLabel={{ value: roomTypePref.reduce((sum, item) => sum + item.value, 0), label: "Bookings" }}
            emptyTitle="No room preference data"
            emptyDescription="Room type preferences will appear once reservations include preferred room type."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Peak reservation months" subtitle="Which months have the most reservation activity (all reservations)">
          <AnalyticsBarChart
            data={reservationsByMonth}
            bars={[{ key: "count", label: "Reservations", color: "#f59e0b" }]}
            emptyTitle="No monthly data"
            emptyDescription="Monthly reservation volumes will appear once booking history exists."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel title="Booking time of day" subtitle="When applicants create their reservations (2-hour windows)">
          <AnalyticsBarChart
            data={bookingByHour}
            bars={[{ key: "count", label: "Bookings", color: "#0284c7" }]}
            emptyTitle="No timing data"
            emptyDescription="Booking time patterns require reservation history."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Booking day of week" subtitle="Which days applicants tend to create reservations">
          <AnalyticsBarChart
            data={bookingByWeekday}
            bars={[{ key: "count", label: "Bookings", color: "#0ea5e9" }]}
            emptyTitle="No weekday data"
            emptyDescription="Day-of-week patterns require reservation history."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel title="Referral sources" subtitle="How confirmed tenants discovered Lilycrest">
          <AnalyticsDonutChart
            data={referralSources}
            centerLabel={{ value: referralSources.reduce((sum, item) => sum + item.value, 0), label: "Referrals" }}
            emptyTitle="No referral data"
            emptyDescription="Referral sources will appear once tenants fill in this field."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Work schedule" subtitle="Day, night, or variable shift distribution among tenants">
          <AnalyticsDonutChart
            data={workScheduleMix}
            centerLabel={{ value: workScheduleMix.reduce((sum, item) => sum + item.value, 0), label: "Tenants" }}
            emptyTitle="No schedule data"
            emptyDescription="Work schedule data requires tenant application details."
          />
        </ReportChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportChartPanel title="Age distribution" subtitle="Age bracket breakdown from application birthday fields">
          <AnalyticsBarChart
            data={ageDistribution}
            bars={[{ key: "count", label: "Tenants", color: "#f59e0b" }]}
            emptyTitle="No age data"
            emptyDescription="Age distribution requires birthday data in tenant applications."
          />
        </ReportChartPanel>

        <ReportChartPanel title="Lease duration" subtitle="How long tenants commit to when reserving">
          <AnalyticsBarChart
            data={leaseDuration}
            bars={[{ key: "count", label: "Tenants", color: "#10b981" }]}
            emptyTitle="No lease data"
            emptyDescription="Lease duration data will appear once reservations include duration."
          />
        </ReportChartPanel>
      </div>

      <ReportChartPanel title="Geographic origin" subtitle="Where tenants come from — top provinces and cities">
        <AnalyticsTableToolbar
          searchQuery={geoSearch}
          onSearchChange={(val) => {
            setGeoSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Search province or city..."
          filters={[
            {
              key: "geoMinCount",
              label: "Minimum Count",
              value: geoMinCount,
              onChange: (val) => {
                setGeoMinCount(val);
                setPage(1);
              },
              options: [
                { value: "all", label: "All Origins" },
                { value: "2+", label: "2+ Tenants" },
                { value: "5+", label: "5+ Tenants (Major Origin)" },
              ],
            },
          ]}
          hasActiveFilters={Boolean(geoSearch || geoMinCount !== "all")}
          onResetFilters={() => {
            setGeoSearch("");
            setGeoMinCount("all");
            setPage(1);
          }}
          extraActions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                Showing {filteredGeographicOrigin.length} of {geographicOrigin.length} locations
              </span>
              <ExportButtons onCsv={exportCsv} onPdf={exportPdf} />
            </div>
          }
        />
        <DataTable
          columns={GEO_COLUMNS}
          data={filteredGeographicOrigin}
          loading={isLoading}
          pagination={{
            page,
            pageSize,
            total: filteredGeographicOrigin.length,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyState={{
            title: isError ? "Demographics report unavailable" : "No geographic data",
            description: isError
              ? "The demographics report could not be loaded."
              : "No locations match the selected filter.",
          }}
        />
      </ReportChartPanel>

      <DetailDrawer
        isOpen={Boolean(drilldown)}
        onClose={() => setDrilldown(null)}
        title={drilldown?.title || "Tenant Breakdown"}
        subtitle={drilldown?.subtitle}
      >
        <AnalyticsTableToolbar
          searchQuery={drilldownSearch}
          onSearchChange={(val) => {
            setDrilldownSearch(val);
            setDrilldownPage(1);
          }}
          searchPlaceholder="Search tenant name, room, or type..."
          hasActiveFilters={Boolean(drilldownSearch)}
          onResetFilters={() => {
            setDrilldownSearch("");
            setDrilldownPage(1);
          }}
          extraActions={
            <span className="text-xs font-medium text-muted-foreground">
              {filteredDrilldownRows.length} tenants found
            </span>
          }
        />
        <DataTable
          columns={DRILLDOWN_COLUMNS}
          data={filteredDrilldownRows}
          pagination={{
            page: drilldownPage,
            pageSize: drilldownPageSize,
            total: filteredDrilldownRows.length,
            onPageChange: setDrilldownPage,
            onPageSizeChange: setDrilldownPageSize,
          }}
          emptyState={{
            title: "No matching tenants",
            description: drilldownSearch ? "No tenants match your search filter." : "No tenant records found.",
          }}
        />
      </DetailDrawer>
    </div>
  );
}
