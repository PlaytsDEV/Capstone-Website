import React, { useState } from "react";
import { X } from "lucide-react";

export function PoliciesTermsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
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
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: "32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>
            Policies & Terms
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#333" }}>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: "700",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            Dormitory Policies
          </h3>
          <ul style={{ marginLeft: "20px", marginBottom: "16px" }}>
            <li style={{ marginBottom: "8px" }}>
              Curfew time is strictly observed
            </li>
            <li style={{ marginBottom: "8px" }}>
              No smoking or illegal substances allowed
            </li>
            <li style={{ marginBottom: "8px" }}>
              Guests must be approved by management
            </li>
            <li style={{ marginBottom: "8px" }}>
              All facilities must be used responsibly
            </li>
            <li style={{ marginBottom: "8px" }}>
              Quiet hours enforced from 10 PM to 8 AM
            </li>
            <li style={{ marginBottom: "8px" }}>
              Monthly dues must be paid on time
            </li>
            <li style={{ marginBottom: "8px" }}>
              Room inspections conducted monthly
            </li>
          </ul>

          <h3
            style={{
              fontSize: "14px",
              fontWeight: "700",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            House Rules
          </h3>
          <ul style={{ marginLeft: "20px", marginBottom: "16px" }}>
            <li style={{ marginBottom: "8px" }}>
              Keep common areas clean and organized
            </li>
            <li style={{ marginBottom: "8px" }}>
              Respect privacy of other residents
            </li>
            <li style={{ marginBottom: "8px" }}>
              No loud music or activities after 10 PM
            </li>
            <li style={{ marginBottom: "8px" }}>Lock your room when leaving</li>
            <li style={{ marginBottom: "8px" }}>
              Report maintenance issues immediately
            </li>
          </ul>

          <h3
            style={{
              fontSize: "14px",
              fontWeight: "700",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            Lease Agreement
          </h3>
          <p style={{ marginBottom: "12px" }}>
            By applying to our dormitory, you agree to abide by all policies and
            rules set forth by Lilycrest / First JRAC Partnership Co. The lease
            agreement is binding and must be honored for the duration as
            specified. Any violations may result in termination of lease without
            notice.
          </p>

          <p style={{ marginBottom: "12px" }}>
            Security deposit is non-refundable in case of early termination.
            Damage charges will be deducted from your deposit if applicable.
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: "24px",
            width: "100%",
            padding: "12px",
            background: "#333333",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          I Understand
        </button>
      </div>
    </div>
  );
}

export function PrivacyConsentModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
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
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: "32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>
            Privacy Consent & Certification
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ fontSize: "13px", lineHeight: "1.8", color: "#333" }}>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: "700",
              marginTop: "0",
              marginBottom: "12px",
            }}
          >
            Privacy Policy
          </h3>
          <p style={{ marginBottom: "12px" }}>
            By submitting this application, you grant Lilycrest / First JRAC
            Partnership Co. permission to collect and use your personal
            information for dormitory operations and services. This includes:
          </p>
          <ul style={{ marginLeft: "20px", marginBottom: "16px" }}>
            <li style={{ marginBottom: "8px" }}>
              Contact and residence information
            </li>
            <li style={{ marginBottom: "8px" }}>
              Identification documents for verification
            </li>
            <li style={{ marginBottom: "8px" }}>Emergency contact details</li>
            <li style={{ marginBottom: "8px" }}>
              Employment and education records
            </li>
            <li style={{ marginBottom: "8px" }}>
              Payment and billing information
            </li>
          </ul>

          <p style={{ marginBottom: "12px" }}>
            We understand the importance of your privacy. All information will
            be kept confidential and will not be shared with third parties
            without your explicit consent, except as required by law or for
            dormitory operations.
          </p>

          <h3
            style={{
              fontSize: "14px",
              fontWeight: "700",
              marginTop: "20px",
              marginBottom: "12px",
            }}
          >
            Data Protection
          </h3>
          <p style={{ marginBottom: "12px" }}>
            Your data is protected and securely stored. Access is restricted to
            authorized personnel only. You have the right to request access to
            your information or request deletion, subject to legal obligations.
          </p>

          <h3
            style={{
              fontSize: "14px",
              fontWeight: "700",
              marginTop: "20px",
              marginBottom: "12px",
            }}
          >
            Certification Statement
          </h3>
          <p style={{ marginBottom: "12px" }}>
            I hereby certify that the information provided in this application
            is true, accurate, and complete to the best of my knowledge and
            belief. I understand that any false information, misrepresentation,
            or omission of facts may be grounds for:
          </p>
          <ul style={{ marginLeft: "20px", marginBottom: "16px" }}>
            <li style={{ marginBottom: "8px" }}>Rejection of application</li>
            <li style={{ marginBottom: "8px" }}>
              Termination of lease agreement
            </li>
            <li style={{ marginBottom: "8px" }}>
              Legal action as deemed appropriate
            </li>
          </ul>

          <p style={{ marginBottom: "12px", fontStyle: "italic" }}>
            I have read and understand the contents of this agreement and
            consent to the collection and use of my personal information as
            outlined above.
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: "24px",
            width: "100%",
            padding: "12px",
            background: "#333333",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          I Acknowledge
        </button>
      </div>
    </div>
  );
}
