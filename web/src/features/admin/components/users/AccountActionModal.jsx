import { useState, useEffect } from "react";
import BaseModal from "../../../../shared/components/BaseModal";

const REASON_PRESETS = {
  suspend: [
    "Administrative Review",
    "Violation of Dormitory Rules",
    "End of Tenancy / Contract Expired",
    "Non-payment / Outstanding Arrears",
    "Safety & Security Concern",
    "Temporary Leave of Absence",
    "Other",
  ],
  ban: [
    "Severe Dormitory Policy Breach",
    "Fraudulent Account / Identity Misrepresentation",
    "Security Threat / Physical Property Damage",
    "Repeated Disciplinary Violations",
    "Unauthorized Facility Access",
    "Other",
  ],
};

const ACTION_CONFIG = {
  suspend: {
    title: "Suspend Account",
    subtitle: "Temporarily restrict account access",
    description:
      "This will immediately restrict the user from logging in, accessing dormitory mobile features, and checking in. Active reservations and records are preserved.",
    confirmLabel: "Suspend Account",
    variant: "warning",
    showReason: true,
    reasonPlaceholder: "Provide a detailed reason or select a preset chip above...",
  },
  ban: {
    title: "Restrict / Ban Account",
    subtitle: "Permanently restrict user access across Lilycrest DMS",
    description:
      "This will restrict the user's access across all services. Only an Owner can reverse a ban.",
    confirmLabel: "Confirm Ban",
    variant: "danger",
    showReason: true,
    reasonPlaceholder: "Provide a formal reason for this restriction...",
  },
  reactivate: {
    title: "Reactivate Account",
    subtitle: "Restore full account access",
    description:
      "This will immediately restore the user's access to the portal and mobile application with their previous permissions.",
    confirmLabel: "Reactivate Account",
    variant: "success",
    showReason: false,
  },
};

export default function AccountActionModal({
  action,
  user,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setReason("");
    setSelectedPreset("");
  }, [action, user]);

  if (!action || !user) return null;

  const config = ACTION_CONFIG[action];
  if (!config) return null;

  const presets = REASON_PRESETS[action] || [];

  const handleSelectPreset = (preset) => {
    if (preset === "Other") {
      setSelectedPreset("Other");
      if (reason === preset) setReason("");
    } else {
      setSelectedPreset(preset);
      setReason(preset);
    }
  };

  const handleConfirm = async () => {
    if (config.showReason && !reason.trim()) {
      return;
    }
    setLoading(true);
    try {
      await onConfirm(action, user._id, reason.trim());
      onClose();
    } catch (err) {
      console.error(`Account action '${action}' failed:`, err);
    } finally {
      setLoading(false);
    }
  };

  const isConfirmDisabled = loading || (config.showReason && !reason.trim());

  return (
    <BaseModal
      isOpen={Boolean(action && user)}
      onClose={onClose}
      title={config.title}
      subtitle={config.subtitle}
      variant={config.variant}
      size="sm"
      onConfirm={handleConfirm}
      confirmText={loading ? "Processing..." : config.confirmLabel}
      cancelText="Cancel"
      loading={loading}
      disabled={isConfirmDisabled}
    >
      <div style={{ display: "grid", gap: 16 }}>
        {/* User Summary Card */}
        <div
          className="rounded-lg p-3 text-center"
          style={{
            backgroundColor: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          <p style={{ margin: "0 0 3px", fontWeight: 600, color: "var(--foreground)", fontSize: 14 }}>
            {user.firstName} {user.lastName}
          </p>
          <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 12 }}>
            @{user.username || "user"} · {user.email}
          </p>
        </div>

        <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5 }}>
          {config.description}
        </p>

        {config.showReason && (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="flex items-center justify-between">
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                Reason for Action <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                {reason.length}/300
              </span>
            </div>

            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {presets.map((preset) => {
                  const isSelected = selectedPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="px-2.5 py-1 text-xs rounded-md transition-colors"
                      style={{
                        backgroundColor: isSelected ? "var(--primary)" : "var(--muted)",
                        color: isSelected ? "var(--primary-foreground)" : "var(--foreground)",
                        border: isSelected
                          ? "1px solid var(--primary)"
                          : "1px solid var(--border)",
                        cursor: "pointer",
                        fontWeight: isSelected ? 600 : 500,
                      }}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            )}

            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (selectedPreset && e.target.value !== selectedPreset) {
                  setSelectedPreset("");
                }
              }}
              placeholder={config.reasonPlaceholder}
              rows={3}
              maxLength={300}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                backgroundColor: "var(--input-background, var(--card))",
                color: "var(--foreground)",
              }}
            />
            {reason.trim().length === 0 && (
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Please select a preset reason chip or type a formal explanation.
              </span>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
