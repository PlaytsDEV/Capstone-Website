import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import BaseModal from "../../../../shared/components/BaseModal";

export default function DeleteRoomModal({ room, onDelete, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const hasOccupants = room?.currentOccupancy > 0;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(room._id);
    } catch (err) {
      console.error("Failed to delete room:", err);
    } finally {
      setDeleting(false);
    }
  };

  if (!room) return null;

  return (
    <BaseModal
      isOpen={Boolean(room)}
      onClose={onClose}
      title="Delete Room"
      subtitle={`Room: ${room?.name || "Unnamed Room"}`}
      variant="danger"
      size="sm"
      onConfirm={handleDelete}
      confirmText={deleting ? "Deleting..." : "Delete Room"}
      cancelText="Cancel"
      loading={deleting}
    >
      <div style={{ display: "grid", gap: 12 }}>
        {hasOccupants && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 8,
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              color: "#92400e",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2, color: "#d97706" }} />
            <span>
              This room currently has <strong>{room.currentOccupancy}</strong> occupant(s). Deleting it may result in orphaned tenant room associations.
            </span>
          </div>
        )}
        <p style={{ margin: 0, color: "var(--text-secondary, #475569)", lineHeight: 1.6 }}>
          Are you sure you want to delete room <strong>{room?.name}</strong>? This action cannot be undone.
        </p>
      </div>
    </BaseModal>
  );
}
