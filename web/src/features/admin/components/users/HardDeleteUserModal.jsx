import { useState } from "react";
import BaseModal from "../../../../shared/components/BaseModal";

export default function HardDeleteUserModal({
  user,
  isOwner = false,
  onDelete,
  onClose,
}) {
  const [forceDelete, setForceDelete] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const confirmDisabled = forceDelete && confirmationText !== "DELETE";

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    setLoading(true);
    try {
      await onDelete({ hardDelete: true, forceDelete, confirmationText });
    } catch (err) {
      console.error("Hard delete user failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={Boolean(user)}
      onClose={onClose}
      title="Permanently Delete User"
      subtitle={`${user?.firstName || ""} ${user?.lastName || ""} (@${user?.username || "user"})`}
      variant="danger"
      size="sm"
      onConfirm={handleConfirm}
      confirmText={forceDelete ? "Force Delete" : "Permanently Delete"}
      cancelText="Cancel"
      loading={loading}
      confirmDisabled={confirmDisabled}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, color: "var(--text-primary, #334155)", lineHeight: 1.5 }}>
          Are you sure you want to permanently delete{" "}
          <strong>
            {user?.firstName} {user?.lastName}
          </strong>
          ?
        </p>

        <p style={{ margin: 0, color: "var(--text-muted, #64748b)", fontSize: 13, lineHeight: 1.5 }}>
          This action cannot be undone. Accounts with significant history are blocked by default unless the owner explicitly force deletes them.
        </p>

        {isOwner && (
          <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--surface-muted, #f8fafc)",
                border: "1px solid var(--border-card, #e2e8f0)",
                fontSize: 13,
                color: "var(--text-primary, #334155)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(event) => {
                  setForceDelete(event.target.checked);
                  if (!event.target.checked) setConfirmationText("");
                }}
                style={{ marginTop: 2 }}
              />
              <span>
                Force delete even if the account has significant history. Historical records will display <strong>Deleted account</strong>.
              </span>
            </label>

            {forceDelete && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary, #475569)" }}>
                  Type <strong>DELETE</strong> to confirm force delete
                </span>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  placeholder="DELETE"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-card, #cbd5e1)",
                    fontSize: 13,
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
              </label>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
}
