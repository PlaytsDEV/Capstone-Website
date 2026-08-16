import React, { useRef } from "react";
import "./AdminTabs.css";

/**
 * AdminTabs — Unified Underline Navigation Tab Standard (Lilycrest DMS)
 *
 * Provides a crisp, high-contrast, accessible tab bar with solid HSL tokens,
 * active indicator border, optional Lucide icons, badge counters, and WAI-ARIA
 * keyboard navigation.
 *
 * @param {Object} props
 * @param {Array<{ id?: string, key?: string, label: string, icon?: React.ComponentType, badge?: number|string, badgeVariant?: string, disabled?: boolean }>} props.tabs
 * @param {string} props.activeTab
 * @param {(tabId: string) => void} props.onTabChange
 * @param {string} [props.ariaLabel="Section navigation tabs"]
 * @param {string} [props.className]
 */
export default function AdminTabs({
  tabs = [],
  activeTab,
  onTabChange,
  ariaLabel = "Section navigation tabs",
  className = "",
}) {
  const tabListRef = useRef(null);

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const handleKeyDown = (event, currentIndex) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    if (enabledTabs.length <= 1) return;

    let targetIndex = -1;

    switch (event.key) {
      case "ArrowRight": {
        event.preventDefault();
        targetIndex = (currentIndex + 1) % tabs.length;
        while (tabs[targetIndex]?.disabled && targetIndex !== currentIndex) {
          targetIndex = (targetIndex + 1) % tabs.length;
        }
        break;
      }
      case "ArrowLeft": {
        event.preventDefault();
        targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        while (tabs[targetIndex]?.disabled && targetIndex !== currentIndex) {
          targetIndex = (targetIndex - 1 + tabs.length) % tabs.length;
        }
        break;
      }
      case "Home": {
        event.preventDefault();
        targetIndex = tabs.findIndex((t) => !t.disabled);
        break;
      }
      case "End": {
        event.preventDefault();
        for (let i = tabs.length - 1; i >= 0; i--) {
          if (!tabs[i].disabled) {
            targetIndex = i;
            break;
          }
        }
        break;
      }
      default:
        return;
    }

    if (targetIndex >= 0 && targetIndex < tabs.length && !tabs[targetIndex].disabled) {
      const nextTab = tabs[targetIndex];
      const nextTabId = nextTab.id || nextTab.key;
      onTabChange?.(nextTabId);

      // Focus the new tab button
      const buttons = tabListRef.current?.querySelectorAll("button[role='tab']");
      if (buttons && buttons[targetIndex]) {
        buttons[targetIndex].focus();
      }
    }
  };

  return (
    <div
      ref={tabListRef}
      className={`admin-tabs-bar ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab, index) => {
        const tabId = tab.id || tab.key;
        const isActive = activeTab === tabId;
        const IconComponent = tab.icon;
        const hasBadge =
          tab.badge !== undefined && tab.badge !== null && tab.badge !== "";
        const badgeVariant = tab.badgeVariant || "warning";

        return (
          <button
            key={tabId}
            id={`admin-tab-${tabId}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`admin-tabpanel-${tabId}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            className={`admin-tab-btn ${
              isActive ? "admin-tab-btn--active" : ""
            } ${tab.disabled ? "admin-tab-btn--disabled" : ""}`}
            onClick={() => {
              if (!tab.disabled && !isActive) {
                onTabChange?.(tabId);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {IconComponent && (
              <IconComponent className="admin-tab-icon" aria-hidden="true" />
            )}
            <span>{tab.label}</span>
            {hasBadge && (
              <span
                className={`admin-tab-badge admin-tab-badge--${badgeVariant}`}
                aria-label={`Count: ${tab.badge}`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
