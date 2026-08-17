import {
 Bar,
 BarChart,
 CartesianGrid,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import AnalyticsEmptyState from "./AnalyticsEmptyState";
import {
 ANALYTICS_CHART_COLORS,
 AnalyticsLegend,
 AnalyticsTooltip,
} from "./analyticsChartUtils";
import "./AnalyticsCharts.css";

export default function AnalyticsBarChart({
  data = [],
  bars = [],
  xKey = "label",
  height = 320,
  stacked = false,
  maxBarSize = 36,
  barSize,
  barGap = 6,
  barCategoryGap = "20%",
  emptyTitle,
  emptyDescription,
  valueFormatter,
  yAxisTickFormatter,
  margin = { top: 8, right: 16, left: 4, bottom: 8 },
}) {
  if (!data.length || !bars.length) {
    return (
      <AnalyticsEmptyState
        title={emptyTitle}
        description={emptyDescription}
        compact
      />
    );
  }

  const defaultYAxisTickFormatter = (value) => {
    if (typeof yAxisTickFormatter === "function") {
      return yAxisTickFormatter(value);
    }
    if (typeof value !== "number") return value;
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
    }
    return value.toLocaleString("en-US");
  };

  const legendItems = bars.map((bar, index) => ({
    key: bar.key,
    label: bar.label || bar.key,
    color: bar.color || ANALYTICS_CHART_COLORS[index % ANALYTICS_CHART_COLORS.length],
  }));

  return (
    <div className="analytics-chart" style={{ "--analytics-chart-height": `${height}px` }}>
      <div className="analytics-chart__surface">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={margin}
            maxBarSize={maxBarSize}
            barGap={barGap}
            barCategoryGap={barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={defaultYAxisTickFormatter}
              width={48}
            />
            <Tooltip content={<AnalyticsTooltip formatter={valueFormatter} />} />
            {bars.map((bar, index) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label || bar.key}
                fill={bar.color || ANALYTICS_CHART_COLORS[index % ANALYTICS_CHART_COLORS.length]}
                radius={bar.radius || [4, 4, 0, 0]}
                maxBarSize={bar.maxBarSize || maxBarSize}
                barSize={bar.barSize || barSize}
                stackId={stacked ? "analytics-stack" : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <AnalyticsLegend items={legendItems} />
    </div>
  );
}
