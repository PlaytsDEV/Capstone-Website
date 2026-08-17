import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import "./AnalyticsInsightsHub.css";

function HubList({ icon: Icon, title, items, emptyText }) {
  return (
    <section className="analytics-insights-hub__section">
      <div className="analytics-insights-hub__section-header">
        <Icon size={16} />
        <h3>{title}</h3>
      </div>
      {items?.length ? (
        <ul className="analytics-insights-hub__list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="analytics-insights-hub__empty">{emptyText}</p>
      )}
    </section>
  );
}

export default function AnalyticsInsightsHub({
  data,
  isLoading,
  isError,
  title = "AI Insights Hub",
  heading = "Key highlights, trends, and suggested actions",
  loadingText = "Reviewing dorm data and preparing insights...",
  emptyText = "No AI summary is available for this view yet.",
  onExecuteAction = null,
}) {
  const insight = data?.insight;
  const snapshotMeta = data?.snapshotMeta || {};
  const providerLabel = snapshotMeta.usedFallback
    ? "AI Summary"
    : "AI Insights";
  const actionableItems = insight?.actionableItems || [];

  return (
    <section className="analytics-insights-hub" data-ai-insights-hub="true">
      <header className="analytics-insights-hub__header">
        <div className="analytics-insights-hub__title">
          <span className="analytics-insights-hub__eyebrow">
            <Sparkles size={14} />
            {title}
          </span>
          <h2>{heading}</h2>
        </div>
        <div className="analytics-insights-hub__meta">
          <span>{providerLabel}</span>
          {insight?.confidence ? <span>Confidence: {insight.confidence}</span> : null}
        </div>
      </header>

      {isLoading ? (
        <div className="analytics-insights-hub__state">
          {loadingText}
        </div>
      ) : isError ? (
        <div className="analytics-insights-hub__state analytics-insights-hub__state--warning">
          AI insights are currently unavailable. The charts and tables below still show your live dorm data.
        </div>
      ) : !insight ? (
        <div className="analytics-insights-hub__state">
          {emptyText}
        </div>
      ) : (
        <>
          <div className="analytics-insights-hub__summary">
            <div>
              <span className="analytics-insights-hub__summary-label">Summary</span>
              <h3>{insight.headline}</h3>
            </div>
            <p>{insight.summary}</p>
          </div>

          {actionableItems.length > 0 && (
            <div className="analytics-insights-hub__actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem", background: "var(--muted-surface, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: "8px", margin: "0.5rem 0" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--foreground, #0f172a)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Sparkles size={12} className="text-primary" />
                Quick Actions:
              </span>
              {actionableItems.map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => typeof onExecuteAction === "function" && onExecuteAction(act)}
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    padding: "0.25rem 0.6rem",
                    borderRadius: "6px",
                    background: "var(--card-bg, #ffffff)",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    color: "var(--foreground, #0f172a)",
                    cursor: "pointer",
                  }}
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}

          <div className="analytics-insights-hub__grid">
            <HubList
              icon={Lightbulb}
              title="What Stands Out"
              items={insight.keyFindings}
              emptyText="No major highlights to show right now."
            />
            <HubList
              icon={AlertTriangle}
              title="Things to Watch"
              items={insight.riskAlerts?.length ? insight.riskAlerts : insight.anomalies}
              emptyText="Everything looks good—no immediate issues detected."
            />
            <HubList
              icon={TrendingUp}
              title="Upcoming Trends"
              items={insight.forecastHighlights}
              emptyText="More history is needed to show upcoming trends."
            />
            <HubList
              icon={CheckCircle2}
              title="Suggested Next Steps"
              items={insight.recommendedActions}
              emptyText="No specific action needed right now."
            />
          </div>

          <p className="analytics-insights-hub__disclaimer">{insight.disclaimer}</p>
        </>
      )}
    </section>
  );
}
