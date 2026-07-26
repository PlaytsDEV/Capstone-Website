import { useState } from "react";
import BaseModal from "../../../../shared/components/BaseModal";

const ACTION_CONFIG = {
  suspend: {
    title: "Suspend Account",
    subtitle: "Temporarily disable access for this user",
    description:
      "This will temporarily disable the user's access. They won't be able to log in or use any features until reactivated.",
    confirmLabel: "Suspend Account",
    variant: "warning",
    showReason: true,
    reasonPlaceholder: "Reason for suspension (e.g., policy violation, non-payment)...",
  },
  ban: {
    title: "Ban Account",
    subtitle: "Permanently disable user access across the system",
    description:
      "This will permanently disable the user's access. This is a severe action and only an owner can reverse it.",
    confirmLabel: "Ban Account",
    variant: "danger",
    showReason: true,
    reasonPlaceholder: "Reason for ban (e.g., repeated violations, fraud)...",
  },
  reactivate: {
    title: "Reactivate Account",
    subtitle: "Restore full account functionality",
    description:
      "This will restore the user's access. They'll be able to log in and use all features again.",
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
  const [loading, setLoading] = useState(false);

  if (!action || !user) return null;

  const config = ACTION_CONFIG[action];
  if (!config) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(action, user._id, reason);
      onClose();
    } catch (err) {
      console.error(`Account action '${action}' failed:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={Boolean(action && user)}
      onClose={onClose}
      title={config.title}
      subtitle={config.subtitle}
      variant={config.variant}
      size="sm"
      onConfirm={handleConfirm}
      confirmText={config.confirmLabel}
      cancelText="Cancel"
      loading={loading}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 2px", fontWeight: 600, color: "var(--text-heading, #0f172a)", fontSize: 15 }}>
            {user.firstName} {user.lastName}
          </p>
          <p style={{ margin: 0, color: "var(--text-muted, #64748b)", fontSize: 13 }}>
            @{user.username || "user"} · {user.email}
          </p>
        </div>

        <p style={{ margin: 0, color: "var(--text-secondary, #475569)", fontSize: 13, lineHeight: 1.5 }}>
          {config.description}
        </p>

        {config.showReason && (
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary, #475569)" }}>
              Reason for action (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.reasonPlaceholder}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 12px",
                border: "1px solid var(--border-card, #cbd5e1)",
                borderRadius: 8,
                fontSize: 13,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        )}
      </div>
    </BaseModal>
  );
}
