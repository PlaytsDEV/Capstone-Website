import React from "react";
import { createPortal } from "react-dom";
import { X, FileText, ShieldCheck, CheckCircle2 } from "lucide-react";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";

/* ─── Shared modal wrapper ─── */
const ModalOverlay = ({ isOpen, onClose, children }) => {
  useEscapeClose(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "20px",
        animation: "termsModalFadeIn 0.2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface-card, #ffffff)",
          border: "1px solid var(--border-card, #e2e8f0)",
          borderRadius: "16px",
          maxWidth: "640px",
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          animation: "termsModalSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

const SectionTitle = ({ children }) => (
  <h3
    style={{
      fontSize: "14px",
      fontWeight: "700",
      color: "var(--text-heading, #0f172a)",
      margin: "18px 0 8px",
      paddingBottom: "6px",
      borderBottom: "1px solid var(--border-subtle, #f1f5f9)",
    }}
  >
    {children}
  </h3>
);

const PolicyList = ({ items }) => (
  <ul
    style={{
      margin: "0 0 14px 0",
      paddingLeft: "20px",
      listStyleType: "disc",
    }}
  >
    {items.map((item, i) => (
      <li
        key={i}
        style={{
          marginBottom: "6px",
          color: "var(--text-body, #334155)",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
      >
        {item}
      </li>
    ))}
  </ul>
);

/* ─── Policies & Terms Modal ─── */
export function PoliciesTermsModal({ isOpen, onClose }) {
  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-subtle, #f1f5f9)",
          flexShrink: 0,
          background: "var(--surface-card, #ffffff)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--surface-muted, #f8fafc)",
              border: "1px solid var(--border-subtle, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#D4AF37",
            }}
          >
            <FileText size={18} />
          </div>
          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                margin: 0,
                color: "var(--text-heading, #0f172a)",
                lineHeight: "1.3",
              }}
            >
              Policies & Terms of Service
            </h2>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted, #64748b)",
              }}
            >
              Lilycrest Dormitory Management System
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "6px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted, #64748b)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-muted, #f1f5f9)";
            e.currentTarget.style.color = "var(--text-heading, #0f172a)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted, #64748b)";
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          padding: "20px 24px",
          overflowY: "auto",
          fontSize: "13px",
          lineHeight: "1.65",
          color: "var(--text-body, #334155)",
          flex: 1,
        }}
      >
        <SectionTitle>Dormitory Policies</SectionTitle>
        <PolicyList
          items={[
            "Curfew time is strictly observed.",
            "No smoking or illegal substances allowed within the premises.",
            "Guests must be approved by management in advance.",
            "All facilities must be used responsibly.",
            "Quiet hours are enforced from 10:00 PM to 8:00 AM.",
            "Monthly dues must be paid on or before the due date.",
            "Room inspections may be conducted on a monthly basis.",
          ]}
        />

        <SectionTitle>House Rules</SectionTitle>
        <PolicyList
          items={[
            "Keep common areas clean and organized at all times.",
            "Respect the privacy and personal space of other tenants.",
            "No loud music or disruptive activities after quiet hours.",
            "Lock your room when leaving the premises.",
            "Report maintenance issues to the management immediately.",
          ]}
        />

        <SectionTitle>Lease Agreement</SectionTitle>
        <p style={{ marginBottom: "10px", textAlign: "left" }}>
          By applying, you agree to abide by all policies and rules set forth by Lilycrest / First JRAC Partnership Co. The lease agreement is binding for the specified duration. Violations may result in lease termination without prior notice.
        </p>
        <p style={{ marginBottom: "0", textAlign: "left" }}>
          The security deposit is non-refundable in the event of early termination. Any property damage charges will be deducted from the deposit accordingly.
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--border-subtle, #f1f5f9)",
          background: "var(--surface-muted, #f8fafc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "9px 24px",
            background: "#D4AF37",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: "600",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#bfa135";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#D4AF37";
          }}
        >
          <CheckCircle2 size={15} />
          I Understand
        </button>
      </div>
    </ModalOverlay>
  );
}

/* ─── Privacy Consent & Certification Modal ─── */
export function PrivacyConsentModal({ isOpen, onClose }) {
  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 24px",
          borderBottom: "1px solid var(--border-subtle, #f1f5f9)",
          flexShrink: 0,
          background: "var(--surface-card, #ffffff)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--surface-muted, #f8fafc)",
              border: "1px solid var(--border-subtle, #e2e8f0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#D4AF37",
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2
              style={{
                fontSize: "16px",
                fontWeight: "700",
                margin: 0,
                color: "var(--text-heading, #0f172a)",
                lineHeight: "1.3",
              }}
            >
              Privacy Consent & Certification
            </h2>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted, #64748b)",
              }}
            >
              Lilycrest Dormitory Management System
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "6px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted, #64748b)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-muted, #f1f5f9)";
            e.currentTarget.style.color = "var(--text-heading, #0f172a)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted, #64748b)";
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          padding: "20px 24px",
          overflowY: "auto",
          fontSize: "13px",
          lineHeight: "1.65",
          color: "var(--text-body, #334155)",
          flex: 1,
        }}
      >
        <SectionTitle>Privacy Policy</SectionTitle>
        <p style={{ marginBottom: "10px", textAlign: "left" }}>
          By submitting this application, you grant Lilycrest / First JRAC Partnership Co. permission to collect and process your personal information for dormitory operations and services, including:
        </p>
        <PolicyList
          items={[
            "Contact and residence information",
            "Identification documents for verification",
            "Emergency contact details",
            "Employment and education records",
            "Payment and billing information",
          ]}
        />
        <p style={{ marginBottom: "14px", textAlign: "left" }}>
          All information is kept confidential and will not be shared with third parties without explicit consent, except as required by law or for dormitory operations.
        </p>

        <SectionTitle>Data Protection</SectionTitle>
        <p style={{ marginBottom: "14px", textAlign: "left" }}>
          Your data is securely stored with access restricted to authorized personnel only. You have the right to request access to your information or request its deletion, subject to applicable legal obligations.
        </p>

        <SectionTitle>Certification Statement</SectionTitle>
        <p style={{ marginBottom: "10px", textAlign: "left" }}>
          I hereby certify that the information provided in this application is true, accurate, and complete to the best of my knowledge and belief. I understand that any false information, misrepresentation, or omission of facts may be grounds for:
        </p>
        <PolicyList
          items={[
            "Rejection of this application",
            "Termination of lease agreement",
            "Legal action as deemed appropriate",
          ]}
        />
        <p
          style={{
            marginBottom: "0",
            fontStyle: "italic",
            color: "var(--text-muted, #64748b)",
            fontSize: "12px",
            textAlign: "left",
          }}
        >
          I have read and understand the contents of this agreement and consent to the collection and use of my personal information as outlined above.
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--border-subtle, #f1f5f9)",
          background: "var(--surface-muted, #f8fafc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "9px 24px",
            background: "#D4AF37",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13.5px",
            fontWeight: "600",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#bfa135";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#D4AF37";
          }}
        >
          <CheckCircle2 size={15} />
          I Acknowledge
        </button>
      </div>
    </ModalOverlay>
  );
}

