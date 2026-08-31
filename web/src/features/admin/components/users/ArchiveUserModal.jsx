import { useState } from "react";
import BaseModal from "../../../../shared/components/BaseModal";

export default function ArchiveUserModal({ user, onDelete, onClose }) {
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onDelete({ hardDelete: false });
    } catch (err) {
      console.error("Archive user action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={Boolean(user)}
      onClose={onClose}
      title="Archive User Account"
      subtitle={`${user?.firstName || ""} ${user?.lastName || ""} (@${user?.username || "user"})`}
      variant="warning"
      size="sm"
      onConfirm={handleConfirm}
      confirmText="Archive User"
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
      </div>
    </BaseModal>
  );
}

