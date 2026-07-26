import { useState } from "react";
import BaseModal from "../../../../shared/components/BaseModal";

export default function RestoreUserModal({ user, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error("Restore account action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={Boolean(user)}
      onClose={onClose}
      title="Restore Archived Account"
      subtitle={`${user?.firstName || ""} ${user?.lastName || ""} (@${user?.username || "user"})`}
      variant="success"
      size="sm"
      onConfirm={handleConfirm}
      confirmText="Restore Account"
      cancelText="Cancel"
      loading={loading}
    >
      <div style={{ display: "grid", gap: 12, textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(5, 150, 105, 0.1)",
            color: "#059669",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {(user?.firstName?.[0] || "U").toUpperCase()}
        </div>

        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-heading, #0f172a)", fontSize: 15 }}>
            {user?.firstName} {user?.lastName}
          </p>
          <p style={{ margin: 0, color: "var(--text-muted, #64748b)", fontSize: 13 }}>
            @{user?.username || "user"} · {user?.email}
          </p>
        </div>

        <p style={{ margin: "4px 0 0", color: "var(--text-secondary, #475569)", fontSize: 13, lineHeight: 1.5 }}>
          This restores the archived account and returns it to active status.
          Permanently deleted accounts cannot be restored.
        </p>
      </div>
    </BaseModal>
  );
}
