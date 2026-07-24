import React, { useState, useEffect } from "react";
import { FileText, Download, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import dayjs from "dayjs";
import { reservationApi } from "../../../../shared/api/reservationApi";
import { showNotification } from "../../../../shared/utils/notification";
import {
  CardSkeleton,
  StatGridSkeleton,
} from "../../../../shared/components/LoadingSkeletons";

/* ─── Circular Progress Ring ─────────────────────────── */
const ProgressRing = ({ percent, monthsCompleted, totalMonths }) => {
  const radius = 58;
  const stroke = 6;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ position: "relative", width: radius * 2, height: radius * 2 }}>
      <svg width={radius * 2} height={radius * 2} style={{ transform: "rotate(-90deg)" }}>
        <circle
          stroke="#E8EBF0"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#E8734A"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transition: "stroke-dashoffset 0.8s ease" }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 28, fontWeight: 700, color: "#0A1628", lineHeight: 1 }}>
          {monthsCompleted}/{totalMonths}
        </span>
        <span style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>months</span>
      </div>
    </div>
  );
};

/* ─── Status Badge ───────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const config = {
    active: { bg: "#ECFDF5", color: "#059669", label: "Active" },
    expiring: { bg: "#FFF7ED", color: "#EA580C", label: "Expiring Soon" },
    expired: { bg: "#FEF2F2", color: "#DC2626", label: "Expired" },
  };
  const { bg, color, label } = config[status] || config.active;

  return (
    <span
      style={{
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 12px",
        borderRadius: 20,
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
};

/* ─── Info Block ─────────────────────────────────────── */
const InfoBlock = ({ label, value, highlight = false }) => (
  <div style={{ borderTop: "2.5px solid #E8734A", paddingTop: 12 }}>
    <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4, fontWeight: 500 }}>{label}</p>
    <p
      style={{
        fontSize: 15,
        fontWeight: highlight ? 700 : 600,
        color: highlight ? "#E8734A" : "#0A1628",
        margin: 0,
      }}
    >
      {value}
    </p>
  </div>
);

/* ─── Main Component ─────────────────────────────────── */
const ContractTab = () => {
  const [contract, setContract] = useState(null);
  const [renewalOffers, setRenewalOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [responding, setResponding] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const { authFetch } = await import("../../../../shared/api/apiClient");
      const [contractData, offersData] = await Promise.all([
        authFetch("/api/reservations/my-contract"),
        reservationApi.getMyRenewalOffers().catch(() => ({ offers: [] })),
      ]);
      setContract(contractData);
      setRenewalOffers(offersData?.offers || []);
    } catch (err) {
      console.error("Contract fetch error:", err);
      setError(err.message || "Could not load contract");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingOffer = renewalOffers.find((o) => o.status === "pending");

  const handleRespond = async (action, offer = pendingOffer) => {
    if (!offer) return;
    try {
      setResponding(true);
      const res = await reservationApi.respondToRenewalOffer(
        offer.reservationId,
        offer.offerId,
        action,
        action === "decline" ? declineReason : ""
      );
      showNotification(
        res.message || (action === "accept" ? "Renewal accepted!" : "Renewal declined."),
        action === "accept" ? "success" : "info"
      );
      setDeclineModalOpen(false);
      setDeclineReason("");
      await fetchData();
    } catch (err) {
      console.error("Error responding to renewal offer:", err);
      showNotification(err.message || "Failed to respond to offer", "error");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>My Contract</h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>Your lease agreement and progress</p>
        </div>
        <CardSkeleton lines={2} height={100} style={{ marginBottom: 20 }} />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 20, marginBottom: 20 }}>
          <StatGridSkeleton count={4} minWidth={160} />
          <CardSkeleton lines={3} height={180} />
        </div>
        <CardSkeleton lines={3} height={140} />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0A1628", margin: "0 0 4px" }}>My Contract</h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>Your lease agreement and progress</p>
        </div>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: "56px 24px",
          background: "#fff", borderRadius: 10, border: "1px solid #E8EBF0",
        }}>
          <FileText size={48} color="#D1D5DB" />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#374151", margin: "16px 0 8px" }}>
            No Active Contract
          </h3>
          <p style={{ fontSize: 13, color: "#9CA3AF", maxWidth: 320, margin: 0 }}>
            Your lease contract will appear here once you've been moved in by the admin. If you have questions, contact your branch manager.
          </p>
        </div>
      </div>
    );
  }

  const monthsLeft = contract.leaseDuration - contract.monthsCompleted;

  return (
    <div style={{ width: "100%" }}>
      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E8EBF0",
          padding: "24px 28px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0A1628", margin: 0 }}>My Contract</h2>
              <StatusBadge status={contract.contractStatus} />
            </div>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
              Your lease agreement and progress
            </p>
          </div>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, fontWeight: 500 }}>
            {contract.room} · {contract.bed} · {contract.branch}
          </p>
        </div>
      </div>

      {/* ── Active Renewal Offer Alert Card ────────────── */}
      {pendingOffer && (
        <div
          style={{
            background: "linear-gradient(135deg, #0A1628 0%, #1E293B 100%)",
            borderRadius: 14,
            padding: "24px 28px",
            color: "#fff",
            marginBottom: 20,
            boxShadow: "0 10px 25px -5px rgba(10, 22, 40, 0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <AlertCircle size={20} color="#E8734A" />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#E8734A" }}>
                  Official Lease Renewal Offer
                </span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#fff" }}>
                {pendingOffer.months}-Month Lease Extension Offer
              </h3>
              <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 12px", maxWidth: 540 }}>
                {pendingOffer.notes || `Management has offered you a ${pendingOffer.months}-month lease extension for ${pendingOffer.roomName || "your room"}.`}
              </p>
              <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#CBD5E1" }}>
                {pendingOffer.proposedRent && (
                  <span>Rate: <strong style={{ color: "#fff" }}>₱{pendingOffer.proposedRent.toLocaleString()}/mo</strong></span>
                )}
                <span>Offer Expires: <strong style={{ color: "#FDBA74" }}>{dayjs(pendingOffer.expiresAt).format("MMM D, YYYY")}</strong></span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
              <button
                disabled={responding}
                onClick={() => handleRespond("accept", pendingOffer)}
                style={{
                  background: "#E8734A",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: responding ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 12px rgba(232, 115, 74, 0.35)",
                }}
              >
                <CheckCircle2 size={16} />
                {responding ? "Processing..." : "Accept Renewal"}
              </button>
              <button
                disabled={responding}
                onClick={() => setDeclineModalOpen(true)}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#FCA5A5",
                  border: "1px solid rgba(252, 165, 165, 0.3)",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: responding ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <XCircle size={16} />
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body (2 columns) ────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #E8EBF0",
          padding: "28px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A1628", marginBottom: 20 }}>Lease Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>
              <InfoBlock label="Start Date" value={contract.leaseStart} />
              <InfoBlock label="End Date" value={contract.leaseEnd} />
              <InfoBlock label="Duration" value={`${contract.leaseDuration} months`} />
              <InfoBlock label="Monthly Rent" value={`₱${contract.monthlyRent.toLocaleString()}`} highlight />
            </div>
          </div>

          <div
            style={{
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 16,
            }}
          >
            <ProgressRing
              percent={contract.progressPercent}
              monthsCompleted={contract.monthsCompleted}
              totalMonths={contract.leaseDuration}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "#94A3B8" }}>
              <Clock className="w-3.5 h-3.5" />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {contract.daysRemaining} days remaining
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Renewal Nudge Card (if no pending offer) ──── */}
      {!pendingOffer && (
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 12,
            border: "1px solid #E8EBF0",
            padding: "24px 28px",
          }}
        >
          <p style={{ color: "#334155", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            {contract.contractStatus === "expired"
              ? "Your lease has expired. Please contact your admin for renewal options."
              : contract.contractStatus === "expiring"
              ? `Your lease expires in ${contract.daysRemaining} days. Consider renewing early for the best rates.`
              : `Your lease expires in ${monthsLeft} month${monthsLeft !== 1 ? "s" : ""}. Consider renewing early for the best rates.`}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => showNotification("Renewal request registered. Admin will issue an official renewal offer soon.", "info")}
              style={{
                background: "#E8734A",
                color: "#fff",
                border: "none",
                padding: "10px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Request Renewal
            </button>
          </div>
        </div>
      )}

      {/* ── Decline Reason Modal ──────────────────────── */}
      {declineModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 22, 40, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0A1628", margin: "0 0 8px" }}>
              Decline Renewal Offer
            </h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
              Please let management know why you are declining (e.g. graduating, relocating, moving out at lease end).
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Optional reason for declining..."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #CBD5E1",
                fontSize: 14,
                marginBottom: 20,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                disabled={responding}
                onClick={() => setDeclineModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  background: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                disabled={responding}
                onClick={() => handleRespond("decline")}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#DC2626",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: responding ? "wait" : "pointer",
                }}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractTab;
