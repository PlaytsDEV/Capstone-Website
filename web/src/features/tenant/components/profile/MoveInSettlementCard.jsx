import React, { useState } from "react";
import {
  CreditCard,
  Download,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { billingApi } from "../../../../shared/api/billingApi";
import { showNotification } from "../../../../shared/utils/notification";
import {
  generateMoveInStatementPDF,
  generateMoveInReceipt,
  viewMoveInReceipt,
} from "../../../../shared/utils/receiptGenerator";
import { resolveReservationFinancials } from "../../../../shared/utils/depositUtils";

const fmt = (val) =>
  `PHP ${Number.isFinite(Number(val)) ? Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;

export default function MoveInSettlementCard({
  reservation,
  profileData,
  defaultExpanded = false,
}) {
  const [payingOnline, setPayingOnline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);

  if (!reservation) return null;

  const {
    monthlyRent,
    advanceRent,
    securityDeposit,
    grossTotal,
    reservationFeeAmount,
    remainingDue,
    isSettled,
  } = resolveReservationFinancials(reservation, profileData);

  const handlePayOnline = async (e) => {
    if (e) e.stopPropagation();
    if (payingOnline) return;
    setPayingOnline(true);
    try {
      const res = await billingApi.createMoveInCheckout(reservation._id);
      if (res?.checkoutUrl) {
        if (res?.sessionId) {
          try {
            sessionStorage.setItem("lilycrest_movein_session_id", res.sessionId);
            localStorage.setItem("lilycrest_movein_session_id", res.sessionId);
          } catch {}
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
        window.location.href = res.checkoutUrl;
      } else {
        throw new Error("Unable to obtain PayMongo checkout URL");
      }
    } catch (err) {
      console.error("PayMongo move-in checkout error:", err);
      showNotification(
        err?.message || "Failed to initiate PayMongo online checkout.",
        "error",
        5000,
      );
      setPayingOnline(false);
    }
  };

  const handleViewReceipt = async (e) => {
    if (e) e.stopPropagation();
    if (viewingReceipt) return;
    setViewingReceipt(true);
    try {
      await viewMoveInReceipt(reservation, profileData);
    } catch (err) {
      console.error("View move-in receipt error:", err);
      showNotification("Failed to open receipt preview.", "error", 4000);
    } finally {
      setViewingReceipt(false);
    }
  };

  const handleDownloadReceipt = async (e) => {
    if (e) e.stopPropagation();
    if (downloadingReceipt) return;
    setDownloadingReceipt(true);
    try {
      await generateMoveInReceipt(reservation, profileData);
      showNotification("Official Receipt downloaded successfully!", "success", 3000);
    } catch (err) {
      console.error("Download move-in receipt error:", err);
      showNotification("Failed to download official receipt.", "error", 4000);
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handleDownloadStatement = async (e) => {
    if (e) e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await generateMoveInStatementPDF(reservation, profileData);
      showNotification("Move-In Statement downloaded successfully!", "success", 3000);
    } catch (err) {
      console.error("Download statement error:", err);
      showNotification("Failed to download statement.", "error", 4000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        background: "var(--surface-card, #ffffff)",
        border: "1px solid var(--border-card, #E2E8F0)",
        borderRadius: 10,
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
        transition: "box-shadow 0.15s ease",
      }}
    >
      {/* Interactive Header Bar */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        aria-expanded={isExpanded}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 16px",
          background: "var(--surface-card, #FFFFFF)",
          borderBottom: isExpanded ? "1px solid var(--border-divider, #E2E8F0)" : "none",
          cursor: "pointer",
          userSelect: "none",
          gap: 10,
          flexWrap: "wrap",
          transition: "background-color 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 220, flex: "1 1 auto" }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: isSettled
                ? "rgba(5, 150, 105, 0.1)"
                : "rgba(212, 175, 55, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isSettled
                ? "var(--color-success, #059669)"
                : "var(--color-accent, #D4AF37)",
              flexShrink: 0,
            }}
          >
            <CreditCard size={16} />
          </div>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--text-heading, #0F172A)",
                }}
              >
                Move-In Financial Schedule
              </h3>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                color: "var(--text-secondary, #64748B)",
              }}
            >
              1-Mo Advance Rent + 1-Mo Security Deposit less Slot Credit
            </p>
          </div>
        </div>

        {/* Right side status badge, quick actions & collapse toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              background: isSettled ? "var(--color-success-bg, #ECFDF5)" : "var(--color-warning-bg, #FFFBEB)",
              color: isSettled ? "var(--color-success, #059669)" : "var(--color-warning-text, #D97706)",
              border: `1px solid ${isSettled ? "rgba(5, 150, 105, 0.25)" : "rgba(245, 158, 11, 0.25)"}`,
              whiteSpace: "nowrap",
            }}
          >
            {isSettled ? <CheckCircle2 size={13} /> : <Clock size={13} />}
            <span>{isSettled ? "Settled" : "Due Before Move-In"}</span>
          </div>

          {/* Quick Action in Header (only shown when collapsed to prevent redundancy with expanded actions) */}
          {!isExpanded && (
            isSettled ? (
              <button
                onClick={handleViewReceipt}
                disabled={viewingReceipt}
                title="View Official Receipt"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  background: "var(--color-success, #059669)",
                  color: "#ffffff",
                  border: "1px solid #047857",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: viewingReceipt ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!viewingReceipt) e.currentTarget.style.background = "#047857";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--color-success, #059669)";
                }}
              >
                <FileText size={13} />
                <span>{viewingReceipt ? "Opening..." : "View Receipt"}</span>
              </button>
            ) : (
              <button
                onClick={handlePayOnline}
                disabled={payingOnline}
                title={`Pay ${fmt(remainingDue)} Online`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  background: "var(--color-success, #059669)",
                  color: "#ffffff",
                  border: "1px solid #047857",
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: payingOnline ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!payingOnline) e.currentTarget.style.background = "#047857";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--color-success, #059669)";
                }}
              >
                <CreditCard size={13} />
                <span>{payingOnline ? "Connecting..." : `Pay ${fmt(remainingDue)}`}</span>
              </button>
            )
          )}

          {/* Expand/Collapse Chevron Button */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "4px 8px",
              background: "var(--surface-card, #FFFFFF)",
              color: "var(--text-secondary, #64748B)",
              border: "1px solid var(--border-card, #E2E8F0)",
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-muted, #F1F5F9)";
              e.currentTarget.style.color = "var(--text-heading, #0F172A)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--surface-card, #FFFFFF)";
              e.currentTarget.style.color = "var(--text-secondary, #64748B)";
            }}
          >
            <span>{isExpanded ? "Hide" : "Details"}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div style={{ padding: "14px 16px", background: "var(--surface-card, #FFFFFF)" }}>
          {/* Itemized Breakdown Table (Clean white container with crisp high-contrast lines) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
              marginBottom: 12,
              background: "var(--surface-card, #FFFFFF)",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--border-card, #E2E8F0)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ color: "var(--text-heading, #1E293B)", fontWeight: 500 }}>
                  • 1-Month Advance Rent <span style={{ fontSize: 11, color: "var(--text-muted, #64748B)", fontWeight: 400 }}>(Month 1 Rent)</span>
                </span>
                {isSettled && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      background: "#DCFCE7",
                      color: "#15803D",
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: "1px solid #BBF7D0",
                    }}
                  >
                    PAID
                  </span>
                )}
              </div>
              <span style={{ fontWeight: 600, color: "var(--text-heading, #0F172A)" }}>{fmt(advanceRent)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ color: "var(--text-heading, #1E293B)", fontWeight: 500 }}>
                  • 1-Month Security Deposit <span style={{ fontSize: 11, color: "var(--text-muted, #64748B)", fontWeight: 400 }}>(Refundable)</span>
                </span>
                {isSettled && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      background: "#DCFCE7",
                      color: "#15803D",
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: "1px solid #BBF7D0",
                    }}
                  >
                    PAID
                  </span>
                )}
              </div>
              <span style={{ fontWeight: 600, color: "var(--text-heading, #0F172A)" }}>{fmt(securityDeposit)}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12.5,
                paddingTop: 6,
                borderTop: "1px dashed var(--border-divider, #E2E8F0)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text-heading, #0F172A)" }}>Total Move-In Requirements:</span>
              <span style={{ fontWeight: 700, color: "var(--text-heading, #0F172A)" }}>{fmt(grossTotal)}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <span style={{ color: "var(--color-success, #059669)", fontWeight: 600 }}>
                  Less: Slot Reservation Fee Credit <span style={{ fontSize: 11, fontWeight: 400 }}>(Online)</span>
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    background: "#DCFCE7",
                    color: "#15803D",
                    padding: "1px 6px",
                    borderRadius: 4,
                    border: "1px solid #BBF7D0",
                  }}
                >
                  CREDITED
                </span>
              </div>
              <span style={{ color: "var(--color-success, #059669)", fontWeight: 700 }}>-{fmt(reservationFeeAmount)}</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 7,
                marginTop: 2,
                borderTop: "1px solid var(--border-divider, #E2E8F0)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-heading, #0F172A)" }}>
                Remaining Balance (Due Before Move-In):
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: isSettled ? "var(--color-success, #059669)" : "var(--text-heading, #0F172A)",
                }}
              >
                {isSettled ? "Settled in Full" : fmt(remainingDue)}
              </span>
            </div>
          </div>

          {/* Settled Compact Confirmation Banner */}
          {isSettled && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
                padding: "8px 12px",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#15803D" }}>
                <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>
                  Advance rent & deposit verified with zero remaining balance.
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 11.5,
                  color: "#475569",
                  flexWrap: "wrap",
                }}
              >
                <span><strong>• Move-In Day:</strong> Valid ID required</span>
                <span><strong>• Turnover:</strong> Meter baseline logged</span>
              </div>
            </div>
          )}

          {/* Action Controls Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            {!isSettled ? (
              <>
                <button
                  onClick={handlePayOnline}
                  disabled={payingOnline}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    background: "var(--color-success, #059669)",
                    color: "#ffffff",
                    border: "1px solid #047857",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: payingOnline ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(5, 150, 105, 0.2)",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!payingOnline) e.currentTarget.style.background = "#047857";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--color-success, #059669)";
                  }}
                >
                  <CreditCard size={14} />
                  {payingOnline ? "Connecting..." : `Pay ${fmt(remainingDue)} Online`}
                </button>

                <button
                  onClick={handleDownloadStatement}
                  disabled={downloading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    background: "var(--surface-card, #FFFFFF)",
                    color: "var(--text-heading, #0F172A)",
                    border: "1px solid var(--border-card, #CBD5E1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: downloading ? "not-allowed" : "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!downloading) e.currentTarget.style.background = "var(--surface-muted, #F8FAFC)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--surface-card, #FFFFFF)";
                  }}
                >
                  <Download size={13} />
                  {downloading ? "Preparing PDF..." : "Download Schedule"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleViewReceipt}
                  disabled={viewingReceipt}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 16px",
                    background: "var(--color-success, #059669)",
                    color: "#ffffff",
                    border: "1px solid #047857",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: viewingReceipt ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(5, 150, 105, 0.2)",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!viewingReceipt) e.currentTarget.style.background = "#047857";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--color-success, #059669)";
                  }}
                >
                  <FileText size={14} />
                  {viewingReceipt ? "Opening..." : "View Official Receipt"}
                </button>

                <button
                  onClick={handleDownloadReceipt}
                  disabled={downloadingReceipt}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    background: "var(--surface-card, #FFFFFF)",
                    color: "var(--text-heading, #0F172A)",
                    border: "1px solid var(--border-card, #CBD5E1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: downloadingReceipt ? "not-allowed" : "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!downloadingReceipt) e.currentTarget.style.background = "var(--surface-muted, #F8FAFC)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--surface-card, #FFFFFF)";
                  }}
                >
                  <Download size={13} />
                  {downloadingReceipt ? "Preparing..." : "Download Official Receipt"}
                </button>

                <button
                  onClick={handleDownloadStatement}
                  disabled={downloading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    background: "var(--surface-card, #FFFFFF)",
                    color: "var(--text-secondary, #475569)",
                    border: "1px solid var(--border-card, #CBD5E1)",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: downloading ? "not-allowed" : "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!downloading) e.currentTarget.style.background = "var(--surface-muted, #F8FAFC)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--surface-card, #FFFFFF)";
                  }}
                >
                  <Download size={13} />
                  {downloading ? "Preparing..." : "Download Statement"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* PayMongo Gateway Transition Overlay */}
      {payingOnline && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--surface-card, #FFFFFF)",
              border: "1px solid var(--border-card, #E2E8F0)",
              borderRadius: 14,
              padding: "24px 28px",
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: "rgba(5, 150, 105, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-success, #059669)",
              }}
            >
              <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} />
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--text-heading, #0F172A)",
                }}
              >
                Redirecting to PayMongo
              </h3>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: "var(--text-secondary, #64748B)",
                  lineHeight: 1.5,
                }}
              >
                Opening PayMongo secure checkout for <strong>{fmt(remainingDue)}</strong>.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted, #94A3B8)",
                background: "var(--surface-muted, #F8FAFC)",
                padding: "5px 10px",
                borderRadius: 20,
                border: "1px solid var(--border-card, #E2E8F0)",
              }}
            >
              <ShieldCheck size={14} color="#059669" />
              <span>256-Bit SSL Encrypted Payment Gateway</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
