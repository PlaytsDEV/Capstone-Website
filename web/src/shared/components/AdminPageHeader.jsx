import React from "react";
import AdminTabs from "./AdminTabs";
import "./AdminPageHeader.css";

/**
 * AdminPageHeader — Pattern 1 Unified Sticky Sub-Header Component (Lilycrest DMS)
 *
 * Integrates 2-tier layout standard:
 * - Tier 1: Title and Subtitle on Left; Controls and Actions on Right.
 * - Tier 2 (Conditional): Full-width horizontal Underline Navigation Tabs.
 *
 * Enforces strict solid HSL tokens, zero gradients, 1px border-bottom, and accessibility.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.title] - Section heading
 * @param {React.ReactNode} [props.subtitle] - Section metadata or descriptive text
 * @param {Array} [props.tabs] - Tab navigation item definitions
 * @param {string} [props.activeTab] - Active tab identifier
 * @param {(tabId: string) => void} [props.onTabChange] - Tab change callback
 * @param {number} [props.maxVisibleTabs] - Limit tabs before collapsing into More dropdown
 * @param {React.ReactNode} [props.controls] - Contextual filters (Branch, Date Range, etc.)
 * @param {React.ReactNode} [props.actions] - Action triggers (Export CSV/PDF, Add, etc.)
 * @param {boolean} [props.sticky=true] - Pin sub-header below TopBar on scroll
 * @param {string} [props.className] - Additional class names
 * @param {string} [props.ariaLabel] - Accessible label for navigation tabs
 * @param {React.ReactNode} [props.children] - Additional sub-header content
 */
export default function AdminPageHeader({
  title,
  subtitle,
  tabs = [],
  activeTab,
  onTabChange,
  maxVisibleTabs,
  controls,
  actions,
  sticky = true,
  className = "",
  ariaLabel,
  children,
}) {
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;
  const hasHeading = Boolean(title || subtitle);
  const hasSide = Boolean(controls || actions);
  const hasTopRow = hasHeading || hasSide;

  return (
    <div
      className={`admin-page-header ${
        sticky ? "admin-page-header--sticky" : ""
      } ${hasTabs ? "admin-page-header--with-tabs" : ""} ${className}`.trim()}
    >
      {hasTopRow && (
        <div className="admin-page-header-top">
          {hasHeading && (
            <div className="admin-page-header-heading">
              {title && <h1 className="admin-page-header-title">{title}</h1>}
              {subtitle && (
                <p className="admin-page-header-subtitle">{subtitle}</p>
              )}
            </div>
          )}

          {hasSide && (
            <div className="admin-page-header-side">
              {controls && (
                <div className="admin-page-header-controls">{controls}</div>
              )}
              {actions && (
                <div className="admin-page-header-actions">{actions}</div>
              )}
            </div>
          )}
        </div>
      )}

      {hasTabs && (
        <div className="admin-page-header-tabs-row">
          <AdminTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            maxVisibleTabs={maxVisibleTabs}
            ariaLabel={ariaLabel}
            className="admin-page-header-tabs"
          />
        </div>
      )}

      {children && <div className="admin-page-header-extra">{children}</div>}
    </div>
  );
}
