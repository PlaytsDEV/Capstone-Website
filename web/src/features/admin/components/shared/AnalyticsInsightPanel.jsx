import React, { useState } from "react";
import {
  Sparkles,
  Search,
  RotateCcw,
  LoaderCircle,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import "./AnalyticsInsightPanel.css";

function SectionList({ title, items, icon: Icon, tone = "default" }) {
  return (
    <section className={`analytics-insight-panel__section analytics-insight-panel__section--${tone}`}>
      <div className="analytics-insight-panel__section-header">
        {Icon && <Icon size={14} className="analytics-insight-panel__section-icon" />}
        <h4 className="analytics-insight-panel__section-title">{title}</h4>
      </div>
      {items?.length ? (
        <ul className="analytics-insight-panel__list">
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="analytics-insight-panel__hint">No items to highlight for this section right now.</p>
      )}
    </section>
  );
}

export default function AnalyticsInsightPanel({
  title = "AI Executive Summary",
  subtitle = "Helpful summary and recommendations based on current report data",
  data,
  isLoading = false,
  isError = false,
  onAskQuestion = null,
  onClearQuestion = null,
  onExecuteAction = null,
  activeQuestion = "",
  isAsking = false,
  suggestedPrompts = [],
}) {
  const [inputQuestion, setInputQuestion] = useState("");
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!activeQuestion) {
      setInputQuestion("");
    } else {
      setInputQuestion(activeQuestion);
    }
  }, [activeQuestion]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const query = inputQuestion.trim();
    if (!query || isAsking) return;
    if (typeof onAskQuestion === "function") {
      onAskQuestion(query);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputQuestion(val);
    if (!val.trim() && activeQuestion && typeof onClearQuestion === "function") {
      onClearQuestion();
    }
  };

  const handleClearInput = () => {
    setInputQuestion("");
    if (activeQuestion && typeof onClearQuestion === "function") {
      onClearQuestion();
    }
    inputRef.current?.focus();
  };

  const handlePromptClick = (prompt) => {
    setInputQuestion(prompt);
    inputRef.current?.focus();
  };

  if (isLoading) {
    return (
      <div className="analytics-insight-panel__state">
        <LoaderCircle size={16} className="animate-spin text-primary" />
        <span>Reviewing report data and preparing helpful insights...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="analytics-insight-panel__state analytics-insight-panel__state--error">
        <span>AI insights are currently unavailable. The metrics and charts below show your live dorm data.</span>
      </div>
    );
  }

  const insight = data?.insight;
  const snapshotMeta = data?.snapshotMeta;

  if (!insight) {
    return (
      <div className="analytics-insight-panel__state">
        <span>No AI summary is available for this report yet.</span>
      </div>
    );
  }

  const providerLabel = snapshotMeta?.usedFallback
    ? "AI Summary"
    : "AI Insights";
  const confidenceLabel = insight.confidence || "standard";
  const actionableItems = insight.actionableItems || [];

  return (
    <div className="analytics-insight-panel">
      {/* Interactive "Ask AI About This Report" Query Bar */}
      {typeof onAskQuestion === "function" && (
        <div className="analytics-insight-panel__ask-bar">
          <form onSubmit={handleSubmit} className="analytics-insight-panel__ask-form">
            <div className="analytics-insight-panel__ask-input-wrap">
              <Sparkles size={14} className="analytics-insight-panel__ask-icon" />
              <input
                ref={inputRef}
                type="text"
                value={inputQuestion}
                onChange={handleInputChange}
                placeholder="Ask a question about your dorm data (Press '/' to focus)"
                className="analytics-insight-panel__ask-input"
                disabled={isAsking}
              />
              {inputQuestion && (
                <button
                  type="button"
                  onClick={handleClearInput}
                  className="analytics-insight-panel__ask-clear-input"
                  aria-label="Clear text"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isAsking || !inputQuestion.trim()}
              className="analytics-insight-panel__ask-submit"
            >
              <Search size={13} />
              <span>Ask AI</span>
            </button>
          </form>

          {/* Active Question Bar & Clear Reset */}
          {activeQuestion && (
            <div className="analytics-insight-panel__active-query">
              <span className="analytics-insight-panel__active-query-label">Active Question:</span>
              <span className="analytics-insight-panel__active-query-text">"{activeQuestion}"</span>
              {typeof onClearQuestion === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    setInputQuestion("");
                    onClearQuestion();
                  }}
                  className="analytics-insight-panel__active-query-reset"
                  title="Reset to default report summary"
                >
                  <RotateCcw size={11} />
                  <span>Back to Overview</span>
                </button>
              )}
            </div>
          )}

          {/* Suggested Quick Prompt Chips */}
          {suggestedPrompts?.length > 0 && !activeQuestion && (
            <div className="analytics-insight-panel__prompt-chips">
              <span className="analytics-insight-panel__prompt-label">Suggested Questions:</span>
              <div className="analytics-insight-panel__prompt-list">
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePromptClick(prompt)}
                    disabled={isAsking}
                    className="analytics-insight-panel__prompt-chip"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Executive Banner */}
      <div className="analytics-insight-panel__banner">
        <div className="analytics-insight-panel__banner-header">
          <span className="analytics-insight-panel__eyebrow">
            {activeQuestion ? `AI Answer` : title}
          </span>
          <div className="analytics-insight-panel__badges">
            <span className="analytics-insight-panel__badge analytics-insight-panel__badge--provider">
              {providerLabel.toUpperCase()}
            </span>
            <span className="analytics-insight-panel__badge analytics-insight-panel__badge--confidence">
              {confidenceLabel.toUpperCase()} CONFIDENCE
            </span>
          </div>
        </div>

        {isAsking ? (
          <div className="flex items-center gap-2.5 py-3 text-xs text-muted-foreground">
            <LoaderCircle size={15} className="animate-spin text-primary" />
            <span>Checking report metrics to answer "{activeQuestion}"...</span>
          </div>
        ) : (
          <>
            <h3 className="analytics-insight-panel__headline">{insight.headline}</h3>
            <p className="analytics-insight-panel__summary">{insight.summary}</p>
          </>
        )}
      </div>

      {/* Quick Action Triggers */}
      {actionableItems.length > 0 && (
        <div className="analytics-insight-panel__action-triggers">
          <div className="analytics-insight-panel__action-triggers-header">
            <Sparkles size={13} className="text-primary" />
            <span className="analytics-insight-panel__action-triggers-label">
              Quick Actions:
            </span>
          </div>
          <div className="analytics-insight-panel__action-triggers-list">
            {actionableItems.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => typeof onExecuteAction === "function" && onExecuteAction(act)}
                className="analytics-insight-panel__action-btn"
                title={`Execute action: ${act.label}`}
              >
                <span>{act.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Structured Insight Sections Grid */}
      <div className="analytics-insight-panel__grid">
        <SectionList
          title="What Stands Out"
          items={insight.keyFindings}
          icon={CheckCircle2}
          tone="findings"
        />
        <SectionList
          title="Things to Watch"
          items={insight.riskAlerts?.length ? insight.riskAlerts : insight.anomalies}
          icon={AlertTriangle}
          tone="risks"
        />
        {insight.forecastHighlights?.length > 0 && (
          <SectionList
            title="Upcoming Trends"
            items={insight.forecastHighlights}
            icon={TrendingUp}
            tone="forecast"
          />
        )}
        <SectionList
          title="Suggested Next Steps"
          items={insight.recommendedActions}
          icon={HelpCircle}
          tone="actions"
        />
      </div>

      {/* Disclaimer */}
      {insight.disclaimer && (
        <p className="analytics-insight-panel__disclaimer">{insight.disclaimer}</p>
      )}
    </div>
  );
}
