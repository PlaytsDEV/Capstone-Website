import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, ArrowUp, ArrowDown } from "lucide-react";

/**
 * OccupancyTrendCard — Weekly occupancy trend chart
 * Shows occupied beds and occupancy rate over the selected dashboard range.
 */
export default function OccupancyTrendCard({ data = {} }) {
  const occupancyTrendData = useMemo(
    () =>
      (data.trend || []).map((item) => ({
        period: item.label || "",
        occupied: Number(item.occupiedBeds || 0),
        rate: Number(item.occupancyRate || item.totalRate || 0),
      })),
    [data.trend],
  );

  const totalCapacity = Number(data.totalCapacity || 0);
  const currentBeds = Number(data.totalOccupancy || 0);
  const currentRate =
    totalCapacity > 0 ? Math.round((currentBeds / totalCapacity) * 100) : 0;
  const previousRate =
    occupancyTrendData.length > 1
      ? occupancyTrendData[occupancyTrendData.length - 2]?.rate || 0
      : null;
  const trendChange =
    previousRate == null ? null : Number((currentRate - previousRate).toFixed(1));
  const hasTrend = occupancyTrendData.length > 0;
  const insightText =
    occupancyTrendData.length > 1
      ? `Occupancy moved from ${previousRate}% to ${currentRate}% across the selected window.`
      : "More than one occupancy snapshot is needed before a trend direction can be called confidently.";

  const isPositiveTrend = trendChange != null && trendChange > 0;
  const isNegativeTrend = trendChange != null && trendChange < 0;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-light)",
      }}
    >
      <div className="p-6 border-b border-border bg-muted/20">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5" style={{ color: "var(--success)" }} />
              <h3 className="text-lg font-semibold text-foreground">
                Occupancy Trend
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Weekly occupancy rate across the selected scope
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Current Rate
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold" style={{ color: "var(--success)" }}>
                    {currentRate}%
                  </span>
                  {trendChange != null && trendChange !== 0 ? (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold"
                      style={{
                        color: isNegativeTrend ? "var(--danger)" : "var(--success)",
                      }}
                    >
                      {isNegativeTrend ? (
                        <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUp className="w-3 h-3" />
                      )}
                      {Math.abs(trendChange).toFixed(1)}%
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Occupied Beds
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-foreground">
                    {currentBeds}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {totalCapacity}
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
            <AreaChart data={occupancyTrendData}>
              <defs>
                <linearGradient id="colorOccupied" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--chart-gold)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--chart-gold)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--success)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--success)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                key="dashboard-occupancy-grid"
              />
              <XAxis
                dataKey="period"
                stroke="var(--muted-foreground)"
                style={{ fontSize: "12px" }}
                key="dashboard-occupancy-xaxis"
              />
              <YAxis
                stroke="var(--muted-foreground)"
                style={{ fontSize: "12px" }}
                key="dashboard-occupancy-yaxis"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--muted-foreground)"
                style={{ fontSize: "12px" }}
                key="dashboard-occupancy-yaxis-right"
              />
              <Tooltip
                key="dashboard-occupancy-tooltip"
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                key="dashboard-occupancy-legend"
              />
              <Area
                type="monotone"
                dataKey="occupied"
                stroke="var(--chart-gold)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOccupied)"
                name="Occupied Beds"
                key="dashboard-occupancy-area-occupied"
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="var(--success)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRate)"
                name="Occupancy Rate (%)"
                yAxisId="right"
                key="dashboard-occupancy-area-rate"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
            No occupancy history is available for the selected range yet.
          </div>
        )}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Insight:</span>{" "}
            {insightText}
          </p>
        </div>
      </div>
    </div>
  );
}
