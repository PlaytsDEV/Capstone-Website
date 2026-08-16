import React, { useState, useEffect, useMemo } from "react";
import {
  Shield, Save, Loader2,
  CalendarCheck, Users, Receipt, BedDouble,
  Wrench, Megaphone, BarChart2, KeyRound,
  CheckCircle2, Sparkles, AlertCircle, RotateCcw,
  CheckSquare, Square
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
    description: "Manage bookings, check-ins, room inventories, and allocations",
    icon: BedDouble,
    permissions: [
      {
        key: "manageReservations",
        label: "Manage Reservations",
        description: "Review booking requests, approve check-ins, and manage guest stay schedules",
        icon: CalendarCheck,
      },
      {
        key: "manageRooms",
        label: "Manage Rooms & Beds",
        description: "Configure room inventory, bed capacities, pricing rates, and maintenance lockouts",
        icon: BedDouble,
      },
    ],
  },
  {
    id: "financials",
    title: "Financials & Billing",
    description: "Utility billings, payment verification, and audit reports",
    icon: Receipt,
    permissions: [
      {
        key: "manageBilling",
        label: "Manage Billing & Payments",
        description: "Generate monthly utility billings, verify resident payment receipts, and assess penalties",
        icon: Receipt,
      },
      {
        key: "viewReports",
        label: "View Reports & Analytics",
        description: "Access financial revenue analytics, occupancy breakdown reports, and transaction audit logs",
        icon: BarChart2,
      },
    ],
  },
  {
    id: "maintenance",
    title: "Communications & Maintenance",
    description: "Tenant repair dispatches and broadcast announcements",
    icon: Wrench,
    permissions: [
      {
        key: "manageMaintenance",
        label: "Manage Maintenance",
        description: "Dispatch work orders, assign technicians, and track resolution statuses",
        icon: Wrench,
      },
      {
        key: "manageAnnouncements",
        label: "Manage Announcements",
        description: "Compose, publish, and schedule broadcast notices to resident portals",
        icon: Megaphone,
      },
    ],
  },
  {
    id: "admin",
    title: "Administration & Security",
    description: "Resident directory and branch staff user accounts",
    icon: Users,
    permissions: [
      {
        key: "manageTenants",
        label: "Manage Tenants",
        description: "Access resident directories, lease agreements, emergency contacts, and move-out records",
        icon: Users,
      },
      {
        key: "manageUsers",
        label: "Manage Staff & Users",
        description: "Create and manage operational staff credentials within the assigned branch",
        icon: KeyRound,
      },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.key)
);

export const PRESET_DEFINITIONS = [
  {
    id: "full",
    label: "Full Access",
    keys: ALL_PERMISSION_KEYS,
  },
  {
    id: "operations",
    label: "Operations Only",
    keys: ["manageReservations", "manageRooms", "manageMaintenance", "manageTenants"],
  },
  {
    id: "financials",
    label: "Financials Only",
    keys: ["manageBilling", "viewReports"],
  },
  {
    id: "clear",
    label: "Clear All",
    keys: [],
    danger: true,
  },
];

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

  // Compute active preset match if any
  const activePresetId = useMemo(() => {
    if (isOwnerTarget) return "full";
    const currentSet = new Set(localPermissions);
    for (const preset of PRESET_DEFINITIONS) {
      if (
        preset.keys.length === currentSet.size &&
        preset.keys.every((k) => currentSet.has(k))
      ) {
        return preset.id;
      }
    }
    return null;
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

  const handleCategoryBatchToggle = (categoryPerms, grantAll) => {
    if (isOwnerTarget) return;
    const catKeys = categoryPerms.map((p) => p.key);
    let updated;
    if (grantAll) {
      const merged = new Set([...localPermissions, ...catKeys]);
      updated = Array.from(merged);
    } else {
      updated = localPermissions.filter((k) => !catKeys.includes(k));
    }
    setLocalPermissions(updated);
    setHasChanges(true);
    if (onChange) onChange(updated);
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
            <h4 className="pe-title">Access Control & Capabilities</h4>
            <p className="pe-subtitle">
              Configure granular administrative privileges assigned to this branch administrator account.
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
              <strong>{activeCount}</strong> / {ALL_PERMISSION_KEYS.length} Capabilities Granted
            </span>
          </div>
        )}
      </div>

      {/* Quick Role Presets Toolbar */}
      {!isOwnerTarget && (
        <div className="pe-presets-bar">
          <div className="flex items-center gap-2">
            <span className="pe-presets-label">
              <Sparkles size={13} /> Quick Presets:
            </span>
            <div className="pe-preset-chips">
              {PRESET_DEFINITIONS.map((preset) => {
                const isSelected = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`pe-preset-chip ${
                      preset.danger ? "pe-preset-chip-danger" : ""
                    } ${isSelected ? "pe-preset-chip--active" : ""}`}
                    onClick={() => applyPreset(preset.keys)}
                    title={`Apply ${preset.label} preset`}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <span className="pe-preset-dot" />}
                  </button>
                );
              })}
            </div>
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
          const isAllCategoryActive =
            categoryActiveCount === category.permissions.length;

          return (
            <div key={category.id} className="pe-category-group">
              <div className="pe-category-header">
                <div className="pe-category-title flex items-center gap-2">
                  <div className="pe-category-icon-box">
                    <CategoryIcon size={15} />
                  </div>
                  <div>
                    <h5>{category.title}</h5>
                    <p className="pe-category-desc">{category.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="pe-category-badge">
                    {categoryActiveCount} of {category.permissions.length} active
                  </span>

                  {!isOwnerTarget && (
                    <button
                      type="button"
                      className="pe-category-batch-btn"
                      onClick={() =>
                        handleCategoryBatchToggle(
                          category.permissions,
                          !isAllCategoryActive
                        )
                      }
                      title={
                        isAllCategoryActive
                          ? `Revoke all ${category.title} permissions`
                          : `Grant all ${category.title} permissions`
                      }
                    >
                      {isAllCategoryActive ? (
                        <>
                          <Square size={12} />
                          <span>Clear Section</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare size={12} />
                          <span>Grant Section</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

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
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleToggle(perm.key);
                        }
                      }}
                      aria-label={`${perm.label}: ${isActive ? "Granted" : "Restricted"}`}
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
                            {isActive ? "Granted" : "Restricted"}
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
              <span>Pending unsaved permission changes</span>
            </div>
          ) : (
            <span className="pe-clean-text">
              All administrative permissions are synchronized and up to date.
            </span>
          )}

          <div className="pe-footer-actions">
            {hasChanges && (
              <button
                type="button"
                className="pe-cancel-btn"
                onClick={handleReset}
                disabled={saving}
                title="Discard pending changes and restore original permissions"
              >
                <RotateCcw size={13} />
                <span>Discard Changes</span>
              </button>
            )}
            <button
              className="pe-save-btn"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              type="button"
              title={
                !hasChanges
                  ? "No unsaved permission changes to save"
                  : saving
                  ? "Saving changes…"
                  : "Save permission updates"
              }
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="pe-spinner" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Permissions</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
