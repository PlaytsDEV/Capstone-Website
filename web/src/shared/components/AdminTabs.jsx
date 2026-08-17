import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import "./AdminTabs.css";

/**
 * AdminTabs — Unified Underline Navigation Tab Standard (Lilycrest DMS)
 *
 * Provides a crisp, high-contrast, accessible tab bar with solid HSL tokens,
 * active indicator border, optional Lucide icons, badge counters, overflow
 * "More" dropdown support, and WAI-ARIA keyboard navigation.
 *
 * @param {Object} props
 * @param {Array<{ id?: string, key?: string, label: string, icon?: React.ComponentType, badge?: number|string, badgeVariant?: string, disabled?: boolean, isOverflow?: boolean }>} props.tabs
 * @param {string} props.activeTab
 * @param {(tabId: string) => void} props.onTabChange
 * @param {number} [props.maxVisibleTabs]
 * @param {string} [props.ariaLabel="Section navigation tabs"]
 * @param {string} [props.className]
 */
export default function AdminTabs({
  tabs = [],
  activeTab,
  onTabChange,
  maxVisibleTabs,
  ariaLabel = "Section navigation tabs",
  className = "",
}) {
  const tabListRef = useRef(null);
  const moreMenuRef = useRef(null);
  const moreButtonRef = useRef(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Partition tabs into visible and overflow tabs
  const { visibleTabs, overflowTabs } = React.useMemo(() => {
    if (!tabs || tabs.length === 0) return { visibleTabs: [], overflowTabs: [] };

    if (maxVisibleTabs && maxVisibleTabs > 0 && tabs.length > maxVisibleTabs) {
      return {
        visibleTabs: tabs.slice(0, maxVisibleTabs),
        overflowTabs: tabs.slice(maxVisibleTabs),
      };
    }

    const explicitOverflow = tabs.filter((t) => t.isOverflow);
    if (explicitOverflow.length > 0) {
      return {
        visibleTabs: tabs.filter((t) => !t.isOverflow),
        overflowTabs: explicitOverflow,
      };
    }

    return { visibleTabs: tabs, overflowTabs: [] };
  }, [tabs, maxVisibleTabs]);

  const activeInOverflow = React.useMemo(() => {
    return overflowTabs.find(
      (t) => (t.id || t.key) === activeTab,
    );
  }, [overflowTabs, activeTab]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(event.target)
      ) {
        setShowMoreMenu(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowMoreMenu(false);
        moreButtonRef.current?.focus();
      }
    };

    if (showMoreMenu) {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
    return undefined;
  }, [showMoreMenu]);

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const handleKeyDown = (event, currentIndex) => {
    const enabledVisible = visibleTabs.filter((t) => !t.disabled);
    if (enabledVisible.length <= 1) return;

    let targetIndex = -1;

    switch (event.key) {
      case "ArrowRight": {
        event.preventDefault();
        targetIndex = (currentIndex + 1) % visibleTabs.length;
        while (visibleTabs[targetIndex]?.disabled && targetIndex !== currentIndex) {
          targetIndex = (targetIndex + 1) % visibleTabs.length;
        }
        break;
      }
      case "ArrowLeft": {
        event.preventDefault();
        targetIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
        while (visibleTabs[targetIndex]?.disabled && targetIndex !== currentIndex) {
          targetIndex = (targetIndex - 1 + visibleTabs.length) % visibleTabs.length;
        }
        break;
      }
      case "Home": {
        event.preventDefault();
        targetIndex = visibleTabs.findIndex((t) => !t.disabled);
        break;
      }
      case "End": {
        event.preventDefault();
        for (let i = visibleTabs.length - 1; i >= 0; i--) {
          if (!visibleTabs[i].disabled) {
            targetIndex = i;
            break;
          }
        }
        break;
      }
      default:
        return;
    }

    if (targetIndex >= 0 && targetIndex < visibleTabs.length && !visibleTabs[targetIndex].disabled) {
      const nextTab = visibleTabs[targetIndex];
      const nextTabId = nextTab.id || nextTab.key;
      onTabChange?.(nextTabId);

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
      <div className="admin-tabs-scroll-area">
        {visibleTabs.map((tab, index) => {
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
                <IconComponent
                  className={`admin-tab-icon ${tab.iconClassName || ""}`.trim()}
                  style={tab.iconColor ? { color: tab.iconColor } : undefined}
                  aria-hidden="true"
                />
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

      {overflowTabs.length > 0 && (
        <div className="admin-tabs-more-wrapper">
          <button
            ref={moreButtonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={showMoreMenu}
            aria-label="More tabs"
            className={`admin-tab-btn admin-tab-more-btn ${
              activeInOverflow ? "admin-tab-btn--active admin-tab-more-btn--active" : ""
            }`}
            onClick={() => setShowMoreMenu((prev) => !prev)}
          >
            <span>{activeInOverflow ? activeInOverflow.label : "More"}</span>
            <ChevronDown className="admin-tab-more-chevron" aria-hidden="true" />
          </button>

          {showMoreMenu && (
            <div
              ref={moreMenuRef}
              role="menu"
              className="admin-tabs-more-menu"
              aria-orientation="vertical"
            >
              {overflowTabs.map((tab) => {
                const tabId = tab.id || tab.key;
                const isActive = activeTab === tabId;
                const IconComponent = tab.icon;
                const hasBadge =
                  tab.badge !== undefined && tab.badge !== null && tab.badge !== "";
                const badgeVariant = tab.badgeVariant || "warning";

                return (
                  <button
                    key={tabId}
                    type="button"
                    role="menuitem"
                    disabled={tab.disabled}
                    className={`admin-tabs-more-item ${
                      isActive ? "admin-tabs-more-item--active" : ""
                    }`}
                    onClick={() => {
                      if (!tab.disabled) {
                        onTabChange?.(tabId);
                        setShowMoreMenu(false);
                      }
                    }}
                  >
                    {IconComponent && (
                      <IconComponent
                        className={`admin-tab-icon ${tab.iconClassName || ""}`.trim()}
                        style={tab.iconColor ? { color: tab.iconColor } : undefined}
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex-1 text-left">{tab.label}</span>
                    {hasBadge && (
                      <span
                        className={`admin-tab-badge admin-tab-badge--${badgeVariant}`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

