import { useState } from "react";
import { billingApi } from "../../../shared/api/billingApi.js";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock.js";

export default function PaymentArrangementModal({ open, bill, onClose, onSuccess }) {
  useBodyScrollLock(open);

  const [milestone1Amount, setMilestone1Amount] = useState("");
  const [milestone1Date, setMilestone1Date] = useState("");
  const [milestone2Amount, setMilestone2Amount] = useState("");
  const [milestone2Date, setMilestone2Date] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open || !bill) return null;

  const totalBillAmount = Number(bill.totalAmount || bill.grossAmount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const m1 = Number(milestone1Amount || 0);
    const m2 = Number(milestone2Amount || 0);
    const sum = m1 + m2;

    if (Math.abs(sum - totalBillAmount) > 0.01) {
      setError(`Sum of milestone payments (₱${sum.toFixed(2)}) must exactly equal master bill total (₱${totalBillAmount.toFixed(2)}).`);
      return;
    }

    if (!milestone1Date || !milestone2Date) {
      setError("Please specify due dates for both milestone sub-invoices.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await billingApi.createMilestoneArrangement(bill._id, [
        { amount: m1, dueDate: milestone1Date },
        { amount: m2, dueDate: milestone2Date }
      ]);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create payment arrangement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenant-workspace-modal__overlay" onClick={onClose}>
      <div className="tenant-workspace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tenant-workspace-modal__header">
          <h3>Create Payment Arrangement (Milestone Invoices)</h3>
          <button type="button" className="tenant-workspace-modal__close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tenant-workspace-modal__body">
          {error && <div className="tenant-workspace-modal__error">{error}</div>}

          <div style={{ backgroundColor: "#eff6ff", border: "1px solid #93c5fd", padding: "0.75rem", borderRadius: "6px", color: "#1e40af", fontSize: "0.875rem", marginBottom: "1rem" }}>
            Master Invoice Total: <strong>PHP {totalBillAmount.toLocaleString()}</strong>.
            Voiding this bill will generate 2 exact-amount milestone sub-invoices.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Milestone 1 Amount (PHP)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2500"
                value={milestone1Amount}
                onChange={(e) => setMilestone1Amount(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                Milestone 1 Due Date
              </label>
              <input
                type="date"
                value={milestone1Date}
                onChange={(e) => setMilestone1Date(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                Milestone 2 Amount (PHP)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 2500"
                value={milestone2Amount}
                onChange={(e) => setMilestone2Amount(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                Milestone 2 Due Date
              </label>
              <input
                type="date"
                value={milestone2Date}
                onChange={(e) => setMilestone2Date(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          <div className="tenant-workspace-modal__actions" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Issue Milestone Invoices"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
