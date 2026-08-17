/**
 * =============================================================================
 * TERMS AND CONDITIONS MODAL - Lilycrest DMS
 * =============================================================================
 *
 * Full-screen accessible modal displaying the Terms and Conditions for user registration
 * and tenant onboarding as clean, plain structured legal text with WCAG compliance.
 */

import React from "react";
import { createPortal } from "react-dom";
import { FileText, X, ShieldCheck, CheckCircle2 } from "lucide-react";
import "./TermsModal.css";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";

const TERMS_SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content: (
      <p>
        By accessing and using the Lilycrest Dormitory Management System, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
      </p>
    ),
  },
  {
    id: "license",
    title: "2. Use License",
    content: (
      <>
        <p>
          Permission is granted to temporarily use the Lilycrest Dormitory Management System for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
        </p>
        <ul>
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose or for any public display</li>
          <li>Attempt to reverse engineer any software contained on the Lilycrest website</li>
          <li>Remove any copyright or other proprietary notations from the materials</li>
          <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
        </ul>
      </>
    ),
  },
  {
    id: "registration",
    title: "3. User Registration",
    content: (
      <p>
        You must provide accurate, current, and complete information during the registration process. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
      </p>
    ),
  },
  {
    id: "verification",
    title: "4. Email Verification",
    content: (
      <p>
        All users must verify their email address before accessing the system. Registration is not complete until email verification is confirmed.
      </p>
    ),
  },
  {
    id: "branch",
    title: "5. Branch Assignment",
    content: (
      <p>
        Users will be assigned to either the Gil Puyat or Guadalupe branch during registration. This assignment determines access to branch-specific resources and information.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "6. Privacy and Data Protection",
    content: (
      <p>
        Your privacy is important to us. We collect and use your personal information solely for the purpose of providing dormitory management services. We will not share your information with third parties without your consent, except as required by law.
      </p>
    ),
  },
  {
    id: "conduct",
    title: "7. User Conduct",
    content: (
      <>
        <p>You agree not to use the service to:</p>
        <ul>
          <li>Upload or transmit any harmful, threatening, abusive, or defamatory content</li>
          <li>Violate any applicable local, state, national, or international law</li>
          <li>Impersonate any person or entity</li>
          <li>Interfere with or disrupt the service or servers</li>
        </ul>
      </>
    ),
  },
  {
    id: "reservation",
    title: "8. Reservation and Booking",
    content: (
      <p>
        All room reservations are subject to availability and confirmation by Lilycrest management. We reserve the right to cancel or modify reservations in exceptional circumstances.
      </p>
    ),
  },
  {
    id: "payment",
    title: "9. Payment Terms",
    content: (
      <p>
        Payment details and terms will be communicated separately for confirmed reservations. All fees must be paid according to the agreed schedule.
      </p>
    ),
  },
  {
    id: "liability",
    title: "10. Limitation of Liability",
    content: (
      <p>
        In no event shall Lilycrest or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Lilycrest's website.
      </p>
    ),
  },
  {
    id: "revisions",
    title: "11. Revisions and Errata",
    content: (
      <p>
        The materials appearing on Lilycrest's website may include technical, typographical, or photographic errors. Lilycrest does not warrant that any of the materials on its website are accurate, complete, or current.
      </p>
    ),
  },
  {
    id: "termination",
    title: "12. Account Termination",
    content: (
      <p>
        Lilycrest reserves the right to terminate or suspend your account at any time, with or without notice, for conduct that we believe violates these Terms and Conditions or is harmful to other users, us, or third parties, or for any other reason.
      </p>
    ),
  },
  {
    id: "changes",
    title: "13. Changes to Terms",
    content: (
      <p>
        Lilycrest may revise these Terms and Conditions at any time without notice. By using this website, you agree to be bound by the current version of these Terms and Conditions.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "14. Governing Law",
    content: (
      <p>
        These terms and conditions are governed by and construed in accordance with the laws of the Philippines, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
      </p>
    ),
  },
  {
    id: "contact",
    title: "15. Contact Information",
    content: (
      <p>
        If you have any questions about these Terms and Conditions, please contact us through our inquiry form or visit our branch offices.
      </p>
    ),
  },
];

function TermsModal({ isOpen, onClose }) {
  useEscapeClose(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="terms-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="terms-modal-header">
          <div className="terms-header-info">
            <div className="terms-header-icon">
              <FileText size={20} />
            </div>
            <div className="terms-header-text">
              <h2 id="terms-modal-title">Terms and Conditions</h2>
              <div className="terms-header-meta">
                <span>Lilycrest Dormitory Management System</span>
                <span>•</span>
                <span>Last Updated: February 1, 2026</span>
                <span className="terms-header-badge">v2.4</span>
              </div>
            </div>
          </div>

          <div className="terms-header-actions">
            <button
              type="button"
              className="terms-modal-close"
              onClick={onClose}
              aria-label="Close Terms and Conditions modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body - Clean Plain Text */}
        <div className="terms-modal-body">
          <div className="terms-intro-card">
            Please read these terms and conditions carefully before using our platform or confirming your dormitory reservation. By registering an account, you agree to these legal stipulations.
          </div>

          <div className="terms-sections-list">
            {TERMS_SECTIONS.map((section) => (
              <div key={section.id} id={`terms-section-${section.id}`} className="terms-section-block">
                <h3 className="terms-section-title">{section.title}</h3>
                <div className="terms-section-content">{section.content}</div>
              </div>
            ))}
          </div>

          {/* Neutral Acceptance Card */}
          <div className="terms-acceptance-card">
            <ShieldCheck size={20} className="terms-acceptance-icon" />
            <p className="terms-acceptance-text">
              By clicking <strong>"I Understand"</strong> or continuing to use our services, you acknowledge that you have read, understood, and agree to be bound by the Lilycrest Dormitory Terms and Conditions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="terms-modal-footer">
          <div className="terms-footer-meta">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#059669",
                display: "inline-block",
              }}
            />
            Official Document • 15 Standard Clauses
          </div>

          <div className="terms-footer-actions">
            <button type="button" className="terms-secondary-btn" onClick={onClose}>
              Close
            </button>
            <button type="button" className="terms-accept-btn" onClick={onClose}>
              <CheckCircle2 size={16} />
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default TermsModal;

