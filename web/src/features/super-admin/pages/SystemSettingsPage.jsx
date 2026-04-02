import { useEffect, useState } from "react";
import { DollarSign, Clock, Database, AlertTriangle, Info, Save, Zap } from "lucide-react";
import "../styles/superadmin-dashboard.css";
import "../styles/superadmin-settings.css";
import { settingsApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";

/**
 * Current system constants â€” displayed read-only.
 * Source of truth: server/config/constants.js
 */
const BUSINESS_RULES = [
  {
    key: "deposit",
    label: "Reservation Deposit",
    value: "â‚±2,000",
    description: "Required deposit amount when confirming a reservation.",
    icon: DollarSign,
    env: "DEPOSIT_AMOUNT",
  },
  {
    key: "penalty",
    label: "Late Payment Penalty",
    value: "â‚±50 / day",
    description: "Daily penalty applied to overdue bills after due date.",
    icon: AlertTriangle,
    env: "PENALTY_RATE",
  },
  {
    key: "noshow",
    label: "No-Show Grace Period",
    value: "7 days",
    description: "Days before a reserved (no-show) reservation is auto-cancelled.",
    icon: Clock,
  },
  {
    key: "stale_pending",
    label: "Stale Pending Timeout",
    value: "2 hours",
    description: "Hours before an unscheduled pending reservation expires.",
    icon: Clock,
  },
  {
    key: "stale_visit_pending",
    label: "Visit Pending Timeout",
    value: "24 hours",
    description: "Hours before a visit_pending reservation expires.",
    icon: Clock,
  },
  {
    key: "stale_visit_approved",
    label: "Visit Approved Timeout",
    value: "48 hours",
    description: "Hours past visit date before a visit_approved reservation expires.",
    icon: Clock,
  },
  {
    key: "stale_payment",
    label: "Payment Pending Timeout",
    value: "48 hours",
    description: "Hours before a payment_pending reservation expires.",
    icon: Clock,
  },
];

const CACHE_SETTINGS = [
  {
    key: "token_ttl",
    label: "Token Cache TTL",
    value: "5 minutes",
    description: "How long Firebase token verifications are cached.",
    icon: Database,
  },
  {
    key: "status_ttl",
    label: "Account Status Cache TTL",
    value: "2 minutes",
    description: "How long account suspension/ban checks are cached.",
    icon: Database,
  },
  {
    key: "max_tokens",
    label: "Max Token Cache Entries",
    value: "500",
    description: "Maximum entries in the LRU token verification cache.",
    icon: Database,
  },
  {
    key: "max_status",
    label: "Max Status Cache Entries",
    value: "500",
    description: "Maximum entries in the account status cache.",
    icon: Database,
  },
];

const DEFAULT_BRANCH_OVERRIDES = {
  "gil-puyat": {
    isApplianceFeeEnabled: false,
    applianceFeeAmountPerUnit: 0,
  },
  guadalupe: {
    isApplianceFeeEnabled: true,
    applianceFeeAmountPerUnit: 200,
  },
};

export default function SystemSettingsPage() {
  const [form, setForm] = useState({
    reservationFeeAmount: 2000,
    penaltyRatePerDay: 50,
    defaultElectricityRatePerKwh: 0,
    defaultWaterRatePerUnit: 0,
    branchOverrides: DEFAULT_BRANCH_OVERRIDES,
  });
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBranch, setSavingBranch] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await settingsApi.getBusinessSettings();
        if (!mounted) return;
        setForm({
          reservationFeeAmount: data.reservationFeeAmount ?? 2000,
          penaltyRatePerDay: data.penaltyRatePerDay ?? 50,
          defaultElectricityRatePerKwh: data.defaultElectricityRatePerKwh ?? 0,
          defaultWaterRatePerUnit: data.defaultWaterRatePerUnit ?? 0,
          branchOverrides: {
            ...DEFAULT_BRANCH_OVERRIDES,
            ...(data.branchOverrides || {}),
          },
        });
        setUpdatedAt(data.updatedAt || null);
      } catch (error) {
        showNotification("Failed to load business settings.", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const saveBusinessSettings = async () => {
    try {
      setSaving(true);
      const data = await settingsApi.updateBusinessSettings({
        reservationFeeAmount: Number(form.reservationFeeAmount),
        penaltyRatePerDay: Number(form.penaltyRatePerDay),
        defaultElectricityRatePerKwh: Number(form.defaultElectricityRatePerKwh),
        defaultWaterRatePerUnit: Number(form.defaultWaterRatePerUnit),
      });
      setForm({
        reservationFeeAmount: data.reservationFeeAmount ?? 2000,
        penaltyRatePerDay: data.penaltyRatePerDay ?? 50,
        defaultElectricityRatePerKwh: data.defaultElectricityRatePerKwh ?? 0,
        defaultWaterRatePerUnit: data.defaultWaterRatePerUnit ?? 0,
        branchOverrides: {
          ...DEFAULT_BRANCH_OVERRIDES,
          ...(data.branchOverrides || form.branchOverrides),
        },
      });
      setUpdatedAt(data.updatedAt || null);
      showNotification("Business settings updated.", "success");
    } catch (error) {
      showNotification(error.message || "Failed to update business settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key) => (e) =>
    setForm((current) => ({
      ...current,
      [key]: e.target.value,
    }));

  const updateBranchField = (branch, key, value) =>
    setForm((current) => ({
      ...current,
      branchOverrides: {
        ...current.branchOverrides,
        [branch]: {
          ...current.branchOverrides?.[branch],
          [key]: value,
        },
      },
    }));

  const saveBranchSettings = async (branch) => {
    try {
      setSavingBranch(branch);
      const data = await settingsApi.updateBranchSettings(
        branch,
        form.branchOverrides?.[branch] || DEFAULT_BRANCH_OVERRIDES[branch],
      );
      setForm((current) => ({
        ...current,
        branchOverrides: {
          ...current.branchOverrides,
          ...(data.branchOverrides || {}),
        },
      }));
      setUpdatedAt(data.updatedAt || null);
      showNotification(`Branch billing settings updated for ${branch}.`, "success");
    } catch (error) {
      showNotification(error.message || "Failed to update branch billing settings.", "error");
    } finally {
      setSavingBranch("");
    }
  };

  const displayBusinessRules = BUSINESS_RULES.map((rule) =>
    rule.key === "deposit"
      ? {
          ...rule,
          value: `PHP ${Number(form.reservationFeeAmount || 0).toLocaleString("en-PH")}`,
        }
      : rule.key === "penalty"
        ? {
            ...rule,
            value: `PHP ${Number(form.penaltyRatePerDay || 0).toLocaleString("en-PH")} / day`,
          }
        : rule,
  );


  return (
    <div className="sa2">
      <div className="sa2-header">
        <div>
          <p className="sa2-eyebrow">Super Admin</p>
          <h1 className="sa2-title">System Settings</h1>
        </div>
      </div>

      <div className="sa2-alert">
        <Info size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
        Reservation fee, penalties, billing-rate defaults, and branch billing overrides are configurable here.
      </div>

      {/* Business Rules Section */}
      <div className="sa2-card sa-settings-section">
        <h2 className="sa2-card-title">
          <DollarSign size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Business Rules
        </h2>
        <div className="sa-settings-grid">
          {displayBusinessRules.map((setting) => (
            <div key={setting.key} className="sa-setting-item">
              <div className="sa-setting-icon">
                <setting.icon size={16} />
              </div>
              <div className="sa-setting-content">
                <div className="sa-setting-header">
                  <span className="sa-setting-label">{setting.label}</span>
                  <span className="sa-setting-value">{setting.value}</span>
                </div>
                <p className="sa-setting-desc">{setting.description}</p>
                {setting.env && (
                  <span className="sa-setting-env">
                    ENV: <code>{setting.env}</code>
                  </span>
                )}
                {(setting.key === "deposit" || setting.key === "penalty") && (
                  <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="number"
                      min="0"
                      step={setting.key === "deposit" ? "100" : "1"}
                      value={setting.key === "deposit" ? form.reservationFeeAmount : form.penaltyRatePerDay}
                      disabled={loading || saving}
                      onChange={updateField(setting.key === "deposit" ? "reservationFeeAmount" : "penaltyRatePerDay")}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid #D1D5DB",
                        borderRadius: "10px",
                        minWidth: "180px",
                        fontSize: "14px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={saveBusinessSettings}
                      disabled={loading || saving}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#111827",
                        color: "#fff",
                        cursor: loading || saving ? "not-allowed" : "pointer",
                      }}
                    >
                      <Save size={14} />
                      {saving ? "Saving..." : "Save"}
                    </button>
                    {updatedAt && (
                      <span className="sa-setting-env">
                        Updated: <code>{new Date(updatedAt).toLocaleString("en-PH")}</code>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sa2-card sa-settings-section">
        <h2 className="sa2-card-title">
          <Zap size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Billing Defaults
        </h2>
        <div className="sa-settings-grid">
          <div className="sa-setting-item">
            <div className="sa-setting-icon">
              <Zap size={16} />
            </div>
            <div className="sa-setting-content">
              <div className="sa-setting-header">
                <span className="sa-setting-label">Default Electricity Rate</span>
                <span className="sa-setting-value">
                  PHP {Number(form.defaultElectricityRatePerKwh || 0).toLocaleString("en-PH")} / kWh
                </span>
              </div>
              <p className="sa-setting-desc">
                Prefills the electricity billing form for admins. The rate is still reviewable per billing period.
              </p>
              <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.defaultElectricityRatePerKwh}
                  disabled={loading || saving}
                  onChange={updateField("defaultElectricityRatePerKwh")}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "10px",
                    minWidth: "180px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="sa-setting-item">
            <div className="sa-setting-icon">
              <Database size={16} />
            </div>
            <div className="sa-setting-content">
              <div className="sa-setting-header">
                <span className="sa-setting-label">Default Water Rate</span>
                <span className="sa-setting-value">
                  PHP {Number(form.defaultWaterRatePerUnit || 0).toLocaleString("en-PH")} / unit
                </span>
              </div>
              <p className="sa-setting-desc">
                Prefills the water billing form for admins. The rate remains editable before finalization.
              </p>
              <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.defaultWaterRatePerUnit}
                  disabled={loading || saving}
                  onChange={updateField("defaultWaterRatePerUnit")}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "10px",
                    minWidth: "180px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sa2-card sa-settings-section">
        <h2 className="sa2-card-title">
          <AlertTriangle size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Branch Billing Overrides
        </h2>
        <div className="sa-settings-grid">
          {Object.entries(form.branchOverrides || {}).map(([branch, branchSettings]) => (
            <div key={branch} className="sa-setting-item">
              <div className="sa-setting-icon">
                <Info size={16} />
              </div>
              <div className="sa-setting-content">
                <div className="sa-setting-header">
                  <span className="sa-setting-label">{branch}</span>
                  <span className="sa-setting-value">
                    {branchSettings?.isApplianceFeeEnabled ? "Appliance fees enabled" : "Appliance fees disabled"}
                  </span>
                </div>
                <p className="sa-setting-desc">
                  Controls whether the reservation flow shows appliance charges for this branch and what fee is used per selected unit.
                </p>
                <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={!!branchSettings?.isApplianceFeeEnabled}
                      disabled={loading || savingBranch === branch}
                      onChange={(event) =>
                        updateBranchField(branch, "isApplianceFeeEnabled", event.target.checked)
                      }
                    />
                    Enable appliance fees
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={branchSettings?.applianceFeeAmountPerUnit ?? 0}
                    disabled={loading || savingBranch === branch}
                    onChange={(event) =>
                      updateBranchField(branch, "applianceFeeAmountPerUnit", event.target.value)
                    }
                    style={{
                      padding: "10px 12px",
                      border: "1px solid #D1D5DB",
                      borderRadius: "10px",
                      minWidth: "180px",
                      fontSize: "14px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => saveBranchSettings(branch)}
                    disabled={loading || savingBranch === branch}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#111827",
                      color: "#fff",
                      cursor: loading || savingBranch === branch ? "not-allowed" : "pointer",
                    }}
                  >
                    <Save size={14} />
                    {savingBranch === branch ? "Saving..." : "Save Branch"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cache Tuning Section */}
      <div className="sa2-card sa-settings-section">
        <h2 className="sa2-card-title">
          <Database size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Cache Tuning
        </h2>
        <div className="sa-settings-grid">
          {CACHE_SETTINGS.map((setting) => (
            <div key={setting.key} className="sa-setting-item">
              <div className="sa-setting-icon">
                <setting.icon size={16} />
              </div>
              <div className="sa-setting-content">
                <div className="sa-setting-header">
                  <span className="sa-setting-label">{setting.label}</span>
                  <span className="sa-setting-value">{setting.value}</span>
                </div>
                <p className="sa-setting-desc">{setting.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
