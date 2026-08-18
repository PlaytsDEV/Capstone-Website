import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";

const PAYMENT_REJECT_PRESETS = [
  { label: "Amount mismatch", text: "Payment amount does not match the required reservation fee. Please review and resubmit." },
  { label: "Illegible receipt", text: "The uploaded payment proof image is blurry or unreadable. Please attach a clearer receipt." },
  { label: "Invalid reference", text: "The transaction reference number could not be verified with our records." },
  { label: "Duplicate submission", text: "This payment reference number has already been used for another transaction." },
];

/**
 * RejectPaymentModal — requires an admin-typed reason before confirming.
 *
 * Props:
 * isOpen   – boolean
 * onClose  – () => void
 * onConfirm – (reason: string) => void
 * loading  – boolean (disables buttons while the API call is in flight)
 */
export default function RejectPaymentModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    const handler = (e) => { if (e.key === "Escape" && !loading) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, loading, onClose]);

  useBodyScrollLock(isOpen);

  const canSubmit = reason.trim().length > 0 && !loading;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(reason.trim());
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.4)",
        animation: "cmFadeIn 0.15s ease",
      }}
      onClick={() => { if (!loading) onClose(); }}
    >
      <style>{`
        @keyframes cmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-card, #fff)",
          borderRadius: 12,
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
          width: "100%",
          maxWidth: 460,
          margin: "0 16px",
          animation: "cmSlideIn 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 24px 16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#DC2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-heading, #0f172a)",
                }}
              >
                Reject Payment
              </h3>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "var(--text-muted, #64748b)",
                  lineHeight: 1.4,
                }}
              >
                Select a preset or type a specific reason for rejection.
              </p>
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "14px 0 10px" }}>
            {PAYMENT_REJECT_PRESETS.map((p) => {
              const isActive = reason === p.text;
              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={loading}
                  onClick={() => setReason(isActive ? "" : p.text)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: "1px solid var(--border-card, #e2e8f0)",
                    background: isActive ? "#DC2626" : "var(--surface-muted, #f8fafc)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? "#FFFFFF" : "var(--text-heading, #1e293b)",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            disabled={loading}
            placeholder="Type specific reason for rejection..."
            maxLength={500}
            rows={4}
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-card, #e2e8f0)",
              fontSize: 13,
              color: "var(--text-heading, #0f172a)",
              lineHeight: 1.5,
              resize: "vertical",
              background: loading
                ? "var(--surface-muted, #f1f5f9)"
                : "#ffffff",
              outline: "none",
              fontFamily: "inherit",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#DC2626";
              e.target.style.boxShadow = "0 0 0 2px rgba(220, 38, 38, 0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-card, #e2e8f0)";
              e.target.style.boxShadow = "none";
            }}
          />
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: reason.length >= 480 ? "#DC2626" : "var(--text-muted, #94a3b8)",
              textAlign: "right",
              marginTop: 4,
            }}
          >
            {reason.length}/500
          </div>
        </div>

        <div
          style={{
            height: 1,
            background: "var(--border-subtle, #f1f5f9)",
            margin: "0 24px",
          }}
        />

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 24px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: "8px 18px",
              border: "1px solid var(--border-card, #e2e8f0)",
              borderRadius: 6,
              background: "var(--surface-card, #fff)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary, #475569)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            title={
              !reason.trim()
                ? "Please type or select a rejection reason before confirming"
                : loading
                ? "Rejecting payment..."
                : "Reject this payment"
            }
            style={{
              padding: "8px 18px",
              border: "none",
              borderRadius: 6,
              background: canSubmit ? "#DC2626" : "#CBD5E1",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: canSubmit ? "pointer" : "not-allowed",
              minWidth: 96,
              transition: "background 0.15s",
            }}
          >
            {loading ? "Rejecting…" : "Reject Payment"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
