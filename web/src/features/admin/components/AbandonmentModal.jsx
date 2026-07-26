import { useState } from "react";
import { reservationApi } from "../../../shared/api/reservationApi.js";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock.js";

export default function AbandonmentModal({ open, reservation, onClose, onSuccess }) {
  useBodyScrollLock(open);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("Unannounced departure / tenant disappeared without notice");

  if (!open || !reservation) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await reservationApi.triggerAbandonment(reservation._id, { reason });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to execute abandonment protocol.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenant-workspace-modal__overlay" onClick={onClose}>
      <div className="tenant-workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tenant-workspace-modal__header">
          <h3 style={{ color: "#dc2626" }}>Trigger Abandonment Protocol</h3>
          <button type="button" className="tenant-workspace-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tenant-workspace-modal__body">
          {error && <div className="tenant-workspace-modal__error">{error}</div>}

          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", padding: "0.75rem", borderRadius: "6px", color: "#991b1b", fontSize: "0.875rem", marginBottom: "1rem" }}>
            <strong>Warning:</strong> Triggering the abandonment protocol will mark this tenant as <em>abandoned</em>, forfeit their security deposit, and immediately release room inventory.
          </div>

          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary, #64748b)" }}>
            Tenant: <strong>{reservation.userName || reservation.userId?.firstName}</strong> | Room: <strong>{reservation.roomNumber || reservation.roomId?.name}</strong>
          </p>

          <div style={{ marginTop: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              Abandonment Reason / Administrative Notes
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div className="tenant-workspace-modal__actions" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" style={{ backgroundColor: "#dc2626", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer" }} disabled={loading}>
              {loading ? "Processing..." : "Confirm Abandonment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
