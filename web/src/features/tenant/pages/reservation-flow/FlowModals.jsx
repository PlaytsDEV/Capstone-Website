import React from "react";
import { LogIn, AlertTriangle, Home, CheckCircle } from "lucide-react";
import useEscapeClose from "../../../../shared/hooks/useEscapeClose";

/**
 * Inline confirmation modals for the reservation flow:
 * - LoginConfirmModal — prompts unauthenticated users to sign in
 * - CancelConfirmModal — confirms discard of unsaved changes
 * - StageConfirmModal — confirms room selection / reservation submission
 */

// ── Shared overlay + card styles ────────────────────────────
const overlayStyle = {
 position: "fixed",
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 background: "rgba(0, 0, 0, 0.5)",
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 zIndex: 1000,
};

const cardStyle = {
 background: "white",
 borderRadius: "12px",
 padding: "32px",
 maxWidth: "400px",
 boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
 textAlign: "center",
};

const btnLight = {
 padding: "10px 24px",
 border: "2px solid #ddd",
 background: "white",
 borderRadius: "6px",
 cursor: "pointer",
 fontWeight: "500",
 color: "#333",
};

// ── Login Confirm ────────────────────────────────────────────
export const LoginConfirmModal = ({ show, onLogin, onDismiss }) => {
 useEscapeClose(show, onDismiss);
 if (!show) return null;
 return (
 <div style={overlayStyle} onClick={onDismiss}>
 <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
 <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}><LogIn size={28} color="#2563EB" /></div></div>
 <h2
 style={{ marginBottom: "12px", fontSize: "20px", fontWeight: "600" }}
 >
 Login Required
 </h2>
 <p style={{ marginBottom: "24px", color: "#666", lineHeight: "1.6" }}>
 You need to be logged in to complete your reservation. Your
 reservation data will be saved.
 </p>
 <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
 <button onClick={onDismiss} style={btnLight}>
 Go Back
 </button>
 <button
 onClick={onLogin}
 style={{
 ...btnLight,
 background: "#4CAF50",
 color: "white",
 border: "none",
 }}
 >
 Go to Login
 </button>
 </div>
 </div>
 </div>
 );
};

// ── Cancel Confirm ───────────────────────────────────────────
export const CancelConfirmModal = ({ show, onConfirm, onDismiss }) => {
 useEscapeClose(show, onDismiss);
 if (!show) return null;
 return (
 <div style={overlayStyle} onClick={onDismiss}>
 <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
 <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}><div style={{ width: 52, height: 52, borderRadius: "50%", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}><AlertTriangle size={26} color="#D97706" /></div></div>
 <h2
 style={{ marginBottom: "12px", fontSize: "20px", fontWeight: "600" }}
 >
 Discard Changes?
 </h2>
 <p style={{ marginBottom: "24px", color: "#666", lineHeight: "1.6" }}>
 Are you sure you want to go back? Your current progress will be lost
 and you'll need to start over.
 </p>
 <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
 <button onClick={onDismiss} style={btnLight}>
 Continue
 </button>
 <button
 onClick={onConfirm}
 style={{
 ...btnLight,
 background: "#FF6B6B",
 color: "white",
 border: "none",
 }}
 >
 Go Back
 </button>
 </div>
 </div>
 </div>
 );
};

// ── Stage Confirm ────────────────────────────────────────────
export const StageConfirmModal = ({
 show,
 pendingAction,
 onConfirm,
 onCancel,
}) => {
 useEscapeClose(show, onCancel);
 if (!show) return null;

 const isStage1 = pendingAction === "stage1";
 const title = isStage1
 ? "Confirm Room Selection"
 : "Confirm Reservation Submission";
 const message = isStage1
 ? "Are you sure you want to proceed with this room selection? A reservation draft will be created."
 : "Are you sure you want to submit your reservation? Once submitted, you will need to wait for admin confirmation.";
 const IconComponent = isStage1 ? Home : CheckCircle;
 const iconBg = isStage1 ? "var(--info-light, #dbeafe)" : "var(--success-light, #dcfce7)";
 const iconColor = isStage1 ? "var(--info, #2563eb)" : "var(--success, #16a34a)";
 const confirmButtonBg = "var(--success, #16a34a)";

 return (
 <div style={overlayStyle} onClick={onCancel}>
 <div
 onClick={(e) => e.stopPropagation()}
 style={{
 ...cardStyle,
 borderRadius: "16px",
 width: "90%",
 boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
 }}
 >
 <div
 style={{
 width: "56px",
 height: "56px",
 borderRadius: "50%",
 background: iconBg,
 display: "flex",
 alignItems: "center",
 justifyContent: "center",
 margin: "0 auto 16px",
 }}
 >
 <IconComponent size={26} color={iconColor} />
 </div>
 <h3
 style={{
 fontSize: "18px",
 fontWeight: "700",
 color: "#1F2937",
 margin: "0 0 8px",
 }}
 >
 {title}
 </h3>
 <p
 style={{
 fontSize: "14px",
 color: "#6B7280",
 margin: "0 0 24px",
 lineHeight: "1.5",
 }}
 >
 {message}
 </p>
 <div style={{ display: "flex", gap: "12px" }}>
 <button
 onClick={onCancel}
 style={{
 flex: 1,
 padding: "12px",
 background: "var(--danger, #ef4444)",
 color: "white",
 border: "none",
 borderRadius: "8px",
 cursor: "pointer",
 fontWeight: "700",
 fontSize: "14px",
 boxShadow: "0 8px 18px rgba(239, 68, 68, 0.22)",
 transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.transform = "translateY(-1px)";
 e.currentTarget.style.boxShadow = "0 12px 24px rgba(239, 68, 68, 0.28)";
 e.currentTarget.style.filter = "brightness(0.98)";
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.transform = "translateY(0)";
 e.currentTarget.style.boxShadow = "0 8px 18px rgba(239, 68, 68, 0.22)";
 e.currentTarget.style.filter = "none";
 }}
 onMouseDown={(e) => {
 e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
 e.currentTarget.style.boxShadow = "0 4px 10px rgba(239, 68, 68, 0.2)";
 }}
 onMouseUp={(e) => {
 e.currentTarget.style.transform = "translateY(-1px)";
 e.currentTarget.style.boxShadow = "0 12px 24px rgba(239, 68, 68, 0.28)";
 }}
 onFocus={(e) => {
 e.currentTarget.style.outline = "none";
 e.currentTarget.style.boxShadow = "0 10px 22px rgba(239, 68, 68, 0.26)";
 }}
 onBlur={(e) => {
 e.currentTarget.style.outline = "none";
 e.currentTarget.style.boxShadow = "0 8px 18px rgba(239, 68, 68, 0.22)";
 }}
 >
 Cancel
 </button>
 <button
 onClick={onConfirm}
 style={{
 flex: 1,
 padding: "12px",
 background: confirmButtonBg,
 color: "white",
 border: "none",
 borderRadius: "8px",
 cursor: "pointer",
 fontWeight: "700",
 fontSize: "14px",
 boxShadow: "0 8px 18px rgba(22, 163, 74, 0.24)",
 transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
 }}
 onMouseEnter={(e) => {
 e.currentTarget.style.transform = "translateY(-1px)";
 e.currentTarget.style.boxShadow = "0 12px 24px rgba(22, 163, 74, 0.3)";
 e.currentTarget.style.filter = "brightness(0.98)";
 }}
 onMouseLeave={(e) => {
 e.currentTarget.style.transform = "translateY(0)";
 e.currentTarget.style.boxShadow = "0 8px 18px rgba(22, 163, 74, 0.24)";
 e.currentTarget.style.filter = "none";
 }}
 onMouseDown={(e) => {
 e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
 e.currentTarget.style.boxShadow = "0 4px 10px rgba(22, 163, 74, 0.22)";
 }}
 onMouseUp={(e) => {
 e.currentTarget.style.transform = "translateY(-1px)";
 e.currentTarget.style.boxShadow = "0 12px 24px rgba(22, 163, 74, 0.3)";
 }}
 onFocus={(e) => {
 e.currentTarget.style.outline = "none";
 e.currentTarget.style.boxShadow = "0 10px 22px rgba(22, 163, 74, 0.28)";
 }}
 onBlur={(e) => {
 e.currentTarget.style.outline = "none";
 e.currentTarget.style.boxShadow = "0 8px 18px rgba(22, 163, 74, 0.24)";
 }}
 >
 Proceed
 </button>
 </div>
 </div>
 </div>
 );
};
