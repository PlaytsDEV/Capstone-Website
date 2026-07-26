import { useState } from "react";
import { reservationApi } from "../../../shared/api/reservationApi.js";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock.js";

export default function RoomSwapModal({ open, activeTenants = [], onClose, onSuccess }) {
  useBodyScrollLock(open);

  const [tenantAId, setTenantAId] = useState("");
  const [tenantBId, setTenantBId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantAId || !tenantBId) {
      setError("Please select two distinct tenants to perform a room swap.");
      return;
    }
    if (tenantAId === tenantBId) {
      setError("Tenant A and Tenant B must be different individuals.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await reservationApi.swapRooms(tenantAId, tenantBId);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to execute direct room swap.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenant-workspace-modal__overlay" onClick={onClose}>
      <div className="tenant-workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tenant-workspace-modal__header">
          <h3>Direct Tenant Room Swap</h3>
          <button type="button" className="tenant-workspace-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tenant-workspace-modal__body">
          {error && <div className="tenant-workspace-modal__error">{error}</div>}

          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary, #64748b)" }}>
            Select two active tenants to simultaneously swap their room assignments, beds, and ledger rates atomically.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                First Tenant (Tenant A)
              </label>
              <select
                value={tenantAId}
                onChange={(e) => setTenantAId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="">-- Select Tenant A --</option>
                {activeTenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name || t.userName} - Room {t.roomNumber || t.roomName || "N/A"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Second Tenant (Tenant B)
              </label>
              <select
                value={tenantBId}
                onChange={(e) => setTenantBId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="">-- Select Tenant B --</option>
                {activeTenants.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name || t.userName} - Room {t.roomNumber || t.roomName || "N/A"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tenant-workspace-modal__actions" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Swapping..." : "Execute Room Swap"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
