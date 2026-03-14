import React from "react";

/**
 * Section 6: Agreements & Consent — privacy consent + certification checkboxes
 * with links to policy modals.
 * Flat layout (no card wrapper — the parent handles section header).
 */
const AgreementsSection = ({
  agreedToPrivacy,
  setAgreedToPrivacy,
  agreedToCertification,
  setAgreedToCertification,
  showValidationErrors,
  onShowPolicies,
  onShowPrivacy,
}) => {
  const allAgreed = agreedToPrivacy && agreedToCertification;
  const hasError = showValidationErrors && !allAgreed;

  return (
    <div style={{ paddingBottom: "4px" }}>
      {hasError && (
        <div
          style={{
            fontSize: "12px",
            color: "#DC2626",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          Please agree to both consent items to continue.
        </div>
      )}

      {/* Privacy Consent */}
      <ConsentCheckbox
        id="privacy-consent"
        checked={agreedToPrivacy}
        onChange={(e) => setAgreedToPrivacy(e.target.checked)}
        title="Privacy Policy & Data Protection Consent"
        description="I consent to the collection and use of my personal data for dormitory services."
      />

      {/* Certification */}
      <ConsentCheckbox
        id="certification"
        checked={agreedToCertification}
        onChange={(e) => setAgreedToCertification(e.target.checked)}
        title="Information Accuracy Certification"
        description="I certify all information is true and accurate. False information may result in rejection."
      />

      {/* Policy links */}
      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
        By proceeding, you agree to our{" "}
        <PolicyLink onClick={onShowPolicies}>
          Policies & Terms of Service
        </PolicyLink>{" "}
        and <PolicyLink onClick={onShowPrivacy}>Privacy Policy</PolicyLink>.
      </div>
    </div>
  );
};

const ConsentCheckbox = ({ id, checked, onChange, title, description }) => (
  <div
    style={{
      display: "flex",
      gap: "10px",
      marginBottom: "12px",
      alignItems: "flex-start",
    }}
  >
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={onChange}
      style={{ marginTop: "3px", cursor: "pointer" }}
    />
    <label
      htmlFor={id}
      style={{
        margin: 0,
        fontSize: "13px",
        color: "#374151",
        cursor: "pointer",
      }}
    >
      <strong>{title}</strong> <span style={{ color: "#dc2626" }}>*</span>
      <span
        style={{
          display: "block",
          fontSize: "12px",
          color: "#6b7280",
          marginTop: "2px",
        }}
      >
        {description}
      </span>
    </label>
  </div>
);

const PolicyLink = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      color: "#1E40AF",
      fontWeight: "500",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
      fontSize: "12px",
      textDecoration: "underline",
    }}
  >
    {children}
  </button>
);

export default AgreementsSection;
