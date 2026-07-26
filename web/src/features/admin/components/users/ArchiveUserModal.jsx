import { useState } from "react";
import BaseModal from "../../../../shared/components/BaseModal";

export default function ArchiveUserModal({ user, isOwner, onDelete, onClose }) {
  const [hardDelete, setHardDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onDelete({ hardDelete });
    } catch (err) {
      console.error("Archive/Delete user action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={Boolean(user)}
      onClose={onClose}
      title={hardDelete ? "Permanently Delete Account" : "Archive User Account"}
      subtitle={`${user?.firstName || ""} ${user?.lastName || ""} (@${user?.username || "user"})`}
      variant={hardDelete ? "danger" : "warning"}
      size="sm"
      onConfirm={handleConfirm}
      confirmText={hardDelete ? "Permanently Delete" : "Archive User"}
      cancelText="Cancel"
      loading={loading}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0, color: "var(--text-primary, #334155)", lineHeight: 1.5 }}>
          This will archive{" "}
          <strong>
            {user?.firstName} {user?.lastName}
          </strong>
          . Archived users cannot sign in, but their financial and reservation records stay intact.
        </p>
        <p style={{ margin: 0, color: "var(--text-muted, #64748b)", fontSize: 13 }}>
          Archived accounts can be restored later from the Archived status filter.
        </p>

        {isOwner && (
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 8,
              background: hardDelete ? "rgba(220, 38, 38, 0.05)" : "var(--surface-muted, #f8fafc)",
              border: `1px solid ${hardDelete ? "#fecaca" : "var(--border-card, #e2e8f0)"}`,
              fontSize: 13,
              color: hardDelete ? "#991b1b" : "var(--text-secondary, #475569)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={hardDelete}
              onChange={(e) => setHardDelete(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              <strong>Permanently delete instead</strong> (Owner-only). Leave unchecked to archive this account so it can be restored later.
            </span>
          </label>
        )}
      </div>
    </BaseModal>
  );
}
