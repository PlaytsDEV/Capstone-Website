import {
 CartesianGrid,
 Line,
 LineChart,
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

export default function AnalyticsLineChart({
 data = [],
 lines = [],
 xKey = "label",
 height = 320,
 emptyTitle,
 emptyDescription,
 valueFormatter,
 yAxisTickFormatter,
 margin = { top: 8, right: 16, left: 4, bottom: 8 },
}) {
 if (!data.length || !lines.length) {
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

 const legendItems = lines.map((line, index) => ({
 key: line.key,
 label: line.label || line.key,
 color: line.color || ANALYTICS_CHART_COLORS[index % ANALYTICS_CHART_COLORS.length],
 }));

 return (
 <div className="analytics-chart" style={{ "--analytics-chart-height": `${height}px` }}>
 <div className="analytics-chart__surface">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={data} margin={margin}>
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
 {lines.map((line, index) => (
 <Line
 key={line.key}
 type={line.type || "monotone"}
 dataKey={line.key}
 name={line.label || line.key}
 stroke={line.color || ANALYTICS_CHART_COLORS[index % ANALYTICS_CHART_COLORS.length]}
 strokeWidth={line.strokeWidth || 3}
 dot={line.dot ?? false}
 activeDot={{ r: 5 }}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 <AnalyticsLegend items={legendItems} />
 </div>
 );
}
