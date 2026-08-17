import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUp, ArrowDown, DollarSign } from "lucide-react";

/**
 * RevenueTrendCard — Monthly billing and collections trend chart
 * Shows billed amounts vs collected payments using real report history.
 */
export default function RevenueTrendCard({ data = {} }) {
  const revenueTrendData = useMemo(
    () =>
      (data.revenueTrend || []).slice(-6).map((item) => ({
        period: item.label || "",
        billed: Number(item.billedAmount || 0),
        collected: Number(item.actualRevenue || item.collectedRevenue || 0),
      })),
    [data.revenueTrend],
  );

  const latestMonth = revenueTrendData[revenueTrendData.length - 1] || null;
  const previousMonth =
    revenueTrendData.length > 1
      ? revenueTrendData[revenueTrendData.length - 2]
      : null;
  const currentMonthRevenue = latestMonth?.collected ?? Number(data.revenueCollected || 0);
  const lastMonthRevenue = previousMonth?.collected ?? null;
  const revenueChange =
    lastMonthRevenue == null ? 0 : currentMonthRevenue - lastMonthRevenue;
  const changePercentage =
    lastMonthRevenue && lastMonthRevenue > 0
      ? Math.round((revenueChange / lastMonthRevenue) * 100 * 10) / 10
      : null;
  const collectionRate =
    latestMonth?.billed > 0
      ? Math.round((currentMonthRevenue / latestMonth.billed) * 100)
      : null;
  const hasTrend = revenueTrendData.length > 0;
  const insightText =
    latestMonth && previousMonth
      ? `Collected payments moved from ${formatPeso(previousMonth.collected)} to ${formatPeso(latestMonth.collected)} in the latest visible month.`
      : "More than one billing month is needed before month-over-month movement can be called confidently.";

  const isNegativeRevenue = changePercentage != null && changePercentage < 0;

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderColor: "var(--color-border-default)",
      }}
    >
      <div
        className="p-6 border-b"
        style={{
          borderColor: "var(--color-border-default)",
          backgroundColor: "var(--color-bg-elevated)",
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign
                className="w-4 h-4 text-sky-600 dark:text-sky-400"
              />
              <h3
                className="text-sm font-semibold text-foreground"
              >
                Revenue Trend
              </h3>
            </div>
            <p
              className="text-xs font-normal text-muted-foreground mb-4"
            >
              Monthly billed amounts vs collected payments
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p
                  className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1"
                >
                  Latest Collections
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl font-bold tracking-tight text-foreground tabular-nums"
                  >
                    {formatPeso(currentMonthRevenue)}
                  </span>
                  {changePercentage != null && changePercentage !== 0 ? (
                    <span
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{
                        color: isNegativeRevenue ? "var(--danger)" : "var(--success)",
                      }}
                    >
                      {isNegativeRevenue ? (
                        <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUp className="w-3 h-3" />
                      )}
                      {Math.abs(changePercentage).toFixed(1)}%
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <p
                  className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1"
                >
                  Latest Collection Rate
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl font-bold tracking-tight text-foreground tabular-nums"
                  >
                    {collectionRate == null ? "--" : `${collectionRate}%`}
                  </span>
                  <span
                    className="text-[11px] font-normal text-muted-foreground"
                  >
                    {latestMonth?.billed
                      ? `from ${formatPeso(latestMonth.billed)} billed`
                      : "No billed month yet"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6">
        {hasTrend ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueTrendData} maxBarSize={36} barGap={6}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-default)"
                key="dashboard-revenue-grid"
              />
              <XAxis
                dataKey="period"
                stroke="var(--color-text-muted)"
                style={{ fontSize: "12px" }}
                key="dashboard-revenue-xaxis"
              />
              <YAxis
                stroke="var(--color-text-muted)"
                style={{ fontSize: "12px" }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `₱${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `₱${(value / 1000).toFixed(0)}K`;
                  return `₱${value}`;
                }}
                key="dashboard-revenue-yaxis"
              />
              <Tooltip
                key="dashboard-revenue-tooltip"
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                formatter={(value) => formatPeso(value)}
              />
              <Legend
                payload={[
                  { value: "Billed", color: "var(--chart-blue)" },
                  { value: "Collected", color: "var(--chart-gold)" },
                ]}
                wrapperStyle={{ fontSize: "12px" }}
                key="dashboard-revenue-legend"
              />
              <Bar
                dataKey="billed"
                fill="var(--chart-blue)"
                name="Billed"
                radius={[8, 8, 0, 0]}
                key="dashboard-revenue-bar-billed"
              />
              <Bar
                dataKey="collected"
                fill="var(--chart-gold)"
                name="Collected"
                radius={[8, 8, 0, 0]}
                key="dashboard-revenue-bar-collected"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex h-[280px] items-center justify-center rounded-lg text-sm"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--color-bg-elevated) 60%, transparent)",
              color: "var(--color-text-muted)",
            }}
          >
            No billing history is available for the selected range yet.
          </div>
        )}
        <div
          className="mt-4 p-3 rounded-lg"
          style={{ backgroundColor: "var(--color-bg-elevated)" }}
        >
          <p
            className="text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span
              className="font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Insight:
            </span>{" "}
            {insightText}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatPeso(value) {
  if (value >= 1000000) {
    return `PHP ${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `PHP ${(value / 1000).toFixed(1)}K`;
  }
  return `PHP ${Number(value || 0)}`;
}
