import React, { useState, useEffect, useMemo } from "react";
import {
  Shield, Save, Loader,
  CalendarCheck, Users, Receipt, BedDouble,
  Wrench, Megaphone, BarChart2, KeyRound,
  CheckCircle2, Sparkles, SlidersHorizontal, AlertCircle
} from "lucide-react";
import ToggleSwitch from "../../../shared/components/ToggleSwitch";
import "../styles/permission-editor.css";

/**
 * Categorized permission schema with metadata & icons
 */
export const PERMISSION_CATEGORIES = [
  {
    id: "operations",
    title: "Operations & Occupancy",
    description: "Manage bookings, check-ins, and room allocations",
    icon: BedDouble,
    permissions: [
      {
        key: "manageReservations",
        label: "Manage Reservations",
        description: "View, update, approve, and cancel bookings",
        icon: CalendarCheck,
      },
      {
        key: "manageRooms",
        label: "Manage Rooms & Beds",
        description: "Edit room inventory, beds, rates, and availability",
        icon: BedDouble,
      },
    ],
  },
  {
    id: "financials",
    title: "Financials & Billing",
    description: "Utility bills, payments, and financial insights",
    icon: Receipt,
    permissions: [
      {
        key: "manageBilling",
        label: "Manage Billing & Payments",
        description: "Generate utility bills, verify payments, apply penalties",
        icon: Receipt,
      },
      {
        key: "viewReports",
        label: "View Reports & Analytics",
        description: "Access revenue, occupancy, and financial audit logs",
        icon: BarChart2,
      },
    ],
  },
  {
    id: "maintenance",
    title: "Communications & Maintenance",
    description: "Tenant support requests and property-wide announcements",
    icon: Wrench,
    permissions: [
      {
        key: "manageMaintenance",
        label: "Manage Maintenance",
        description: "Assign, update, and resolve tenant repair requests",
        icon: Wrench,
      },
      {
        key: "manageAnnouncements",
        label: "Manage Announcements",
        description: "Publish and edit news broadcasts to tenants",
        icon: Megaphone,
      },
    ],
  },
  {
    id: "admin",
    title: "Administration & Security",
    description: "Tenant profiles and user account management",
    icon: Users,
    permissions: [
      {
        key: "manageTenants",
        label: "Manage Tenants",
        description: "View/edit tenant profiles, stays, and contract status",
        icon: Users,
      },
      {
        key: "manageUsers",
        label: "Manage Users & Staff",
        description: "Create, edit, and manage branch staff accounts",
        icon: KeyRound,
      },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.key)
);

/**
 * PermissionEditor — Modern toggle-based workspace for admin permissions.
 *
 * @param {Object} props
 * @param {string[]} [props.permissions=[]] - Currently assigned permission keys
 * @param {Function} [props.onChange] - Triggered when permissions change
 * @param {boolean} [props.isOwnerTarget=false] - Read-only for Owner accounts
 * @param {boolean} [props.saving=false] - Save button loading state
 * @param {Function} [props.onSave] - Triggered on save click
 */
export default function PermissionEditor({
  permissions = [],
  onChange,
  isOwnerTarget = false,
  saving = false,
  onSave,
}) {
  const [localPermissions, setLocalPermissions] = useState(permissions);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalPermissions(permissions || []);
    setHasChanges(false);
  }, [permissions]);

  const activeCount = useMemo(() => {
    return isOwnerTarget ? ALL_PERMISSION_KEYS.length : localPermissions.length;
  }, [isOwnerTarget, localPermissions]);

  const handleToggle = (key) => {
    if (isOwnerTarget) return;

    const updated = localPermissions.includes(key)
      ? localPermissions.filter((p) => p !== key)
      : [...localPermissions, key];

    setLocalPermissions(updated);
    setHasChanges(true);
    if (onChange) onChange(updated);
  };

  const applyPreset = (presetKeys) => {
    if (isOwnerTarget) return;
    setLocalPermissions(presetKeys);
    setHasChanges(true);
    if (onChange) onChange(presetKeys);
  };

  const handleSave = () => {
    if (onSave) onSave(localPermissions);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalPermissions(permissions || []);
    setHasChanges(false);
    if (onChange) onChange(permissions || []);
  };

  return (
    <div className="permission-editor">
      {/* Header */}
      <div className="pe-header">
        <div className="pe-title-block">
          <div className="pe-icon-badge">
            <Shield size={18} />
          </div>
          <div>
            <h4 className="pe-title">Access Control & Permissions</h4>
            <p className="pe-subtitle">
              Toggle specific capabilities assigned to this account
            </p>
          </div>
        </div>

        {isOwnerTarget ? (
          <span className="pe-badge pe-badge-full">
            <CheckCircle2 size={13} /> Full Owner Access
          </span>
        ) : (
          <div className="pe-active-indicator">
            <span className="pe-count-badge">
              <strong>{activeCount}</strong> / {ALL_PERMISSION_KEYS.length} Enabled
            </span>
          </div>
        )}
      </div>

      {/* Quick Role Presets Toolbar */}
      {!isOwnerTarget && (
        <div className="pe-presets-bar">
          <span className="pe-presets-label">
            <Sparkles size={14} /> Quick Presets:
          </span>
          <div className="pe-preset-chips">
            <button
              type="button"
              className="pe-preset-chip"
              onClick={() => applyPreset(ALL_PERMISSION_KEYS)}
            >
              Full Access
            </button>
            <button
              type="button"
              className="pe-preset-chip"
              onClick={() =>
                applyPreset([
                  "manageReservations",
                  "manageRooms",
                  "manageMaintenance",
                  "manageTenants",
                ])
              }
            >
              Operations Only
            </button>
            <button
              type="button"
              className="pe-preset-chip"
              onClick={() => applyPreset(["manageBilling", "viewReports"])}
            >
              Financials Only
            </button>
            <button
              type="button"
              className="pe-preset-chip pe-preset-chip-danger"
              onClick={() => applyPreset([])}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Categorized Permission Groups */}
      <div className="pe-categories">
        {PERMISSION_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const categoryActiveCount = category.permissions.filter(
            (p) => isOwnerTarget || localPermissions.includes(p.key)
          ).length;

          return (
            <div key={category.id} className="pe-category-group">
              <div className="pe-category-header">
                <div className="pe-category-title flex items-center gap-2">
                  <CategoryIcon size={16} className="pe-category-icon" />
                  <h5>{category.title}</h5>
                </div>
                <span className="pe-category-badge">
                  {categoryActiveCount} of {category.permissions.length} active
                </span>
              </div>
              <p className="pe-category-desc">{category.description}</p>

              <div className="pe-grid">
                {category.permissions.map((perm) => {
                  const PermIcon = perm.icon;
                  const isActive =
                    isOwnerTarget || localPermissions.includes(perm.key);

                  return (
                    <div
                      key={perm.key}
                      className={`pe-item ${isActive ? "active" : ""} ${
                        isOwnerTarget ? "readonly" : ""
                      }`}
                      onClick={() => handleToggle(perm.key)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="pe-item-icon">
                        <PermIcon size={16} />
                      </div>

                      <div className="pe-item-content">
                        <div className="pe-item-title-row">
                          <span className="pe-item-label">{perm.label}</span>
                          <span
                            className={`pe-status-pill ${
                              isActive ? "pill-active" : "pill-inactive"
                            }`}
                          >
                            {isActive ? "ON" : "OFF"}
                          </span>
                        </div>
                        <span className="pe-item-desc">{perm.description}</span>
                      </div>

                      <div className="pe-item-toggle">
                        <ToggleSwitch
                          checked={isActive}
                          onChange={() => handleToggle(perm.key)}
                          disabled={isOwnerTarget}
                          ariaLabel={`Toggle ${perm.label}`}
                          size="md"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer & Dirty State Notification */}
      {!isOwnerTarget && onSave && (
        <div className={`pe-footer ${hasChanges ? "pe-footer-dirty" : ""}`}>
          {hasChanges ? (
            <div className="pe-dirty-alert">
              <AlertCircle size={15} />
              <span>Unsaved permission changes</span>
            </div>
          ) : (
            <span className="pe-clean-text">All permissions up to date</span>
          )}

          <div className="pe-footer-actions">
            {hasChanges && (
              <button
                type="button"
                className="pe-cancel-btn"
                onClick={handleReset}
                disabled={saving}
              >
                Discard
              </button>
            )}
            <button
              className="pe-save-btn"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              type="button"
            >
              {saving ? (
                <>
                  <Loader size={14} className="pe-spinner" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save Permissions
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
