import { ATTACHMENT_REMOVAL_REASONS } from "../maintenanceUtils";
import BaseModal from "../../../../../shared/components/BaseModal";

export function AttachmentRemovalModal({
  open,
  scope,
  reason,
  customReason,
  error,
  isPending = false,
  onScopeChange,
  onReasonChange,
  onCustomReasonChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const hasScope = Boolean(scope);
  const hasReason = reason && (reason !== "Other" || Boolean(customReason.trim()));
  const canSubmit = hasScope && hasReason && !isPending;
  const options = [
    {
      value: "tenant_only",
      title: "Remove for Tenant",
      description:
        "The tenant will no longer be able to view or download this attachment. Admins can still see the removal record in the maintenance timeline.",
    },
    {
      value: "request",
      title: "Remove from Request",
      description:
        "This attachment will be hidden from normal admin and tenant attachment displays. A removal record will still remain in the admin timeline.",
    },
  ];

  return (
    <BaseModal
      isOpen={open}
      onClose={onCancel}
      title="Remove Attachment"
      subtitle="Select visibility scope and reason for removing this file"
      variant="danger"
      size="md"
      onConfirm={onConfirm}
      confirmText={isPending ? "Removing..." : "Remove Attachment"}
      cancelText="Cancel"
      loading={isPending}
      confirmDisabled={!canSubmit}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted, #64748b)", display: "block", marginBottom: 8 }}>
            Scope of Removal
          </span>
          <div style={{ display: "grid", gap: 10 }}>
            {options.map((option) => {
              const selected = scope === option.value;
              return (
                <label
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${selected ? "#dc2626" : "var(--border-card, #e2e8f0)"}`,
                    background: selected ? "rgba(220, 38, 38, 0.04)" : "var(--surface-card, #fff)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="attachment-removal-scope"
                    value={option.value}
                    checked={selected}
                    onChange={() => onScopeChange(option.value)}
                    style={{ marginTop: 3, accentColor: "#dc2626" }}
                    disabled={isPending}
                  />
                  <span>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text-heading, #0f172a)" }}>
                      {option.title}
                    </span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--text-secondary, #475569)", marginTop: 2, lineHeight: 1.45 }}>
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted, #64748b)" }}>
            Reason for removal
          </span>
          <select
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            disabled={isPending}
            style={{
              height: 40,
              width: "100%",
              borderRadius: 8,
              border: "1px solid var(--border-card, #cbd5e1)",
              padding: "0 12px",
              fontSize: 13,
              background: "var(--surface-card, #fff)",
              outline: "none",
            }}
          >
            <option value="">Select a reason</option>
            {ATTACHMENT_REMOVAL_REASONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        {reason === "Other" && (
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted, #64748b)" }}>
              Please specify reason
            </span>
            <textarea
              rows={3}
              value={customReason}
              onChange={(event) => onCustomReasonChange(event.target.value)}
              disabled={isPending}
              placeholder="Enter a clear removal reason."
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid var(--border-card, #cbd5e1)",
                padding: 10,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </label>
        )}

        {error && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
