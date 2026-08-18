/**
 * =============================================================================
 * PRIVACY POLICY MODAL - Lilycrest DMS
 * =============================================================================
 *
 * Full-screen accessible modal displaying the Privacy Policy for user registration
 * and tenant onboarding as clean, plain structured legal text with WCAG compliance.
 */

import React from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck,
  X,
  CheckCircle2,
  Mail,
  Phone,
} from "lucide-react";
import "./TermsModal.css";
import useEscapeClose from "../../../shared/hooks/useEscapeClose";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";

const PRIVACY_SECTIONS = [
  {
    id: "collection",
    title: "1. Information We Collect",
    content: (
      <p>
        We collect information you provide directly to us when you fill out an inquiry form, create an account, make a reservation, or contact us. This may include your name, email address, phone number, preferred accommodation details, and payment information.
      </p>
    ),
  },
  {
    id: "usage",
    title: "2. How We Use Your Information",
    content: (
      <p>
        We use the information we collect to process your inquiries and reservations, manage your accommodation, communicate with you about your account and our services, improve our website and services, and comply with legal obligations.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "3. Information Sharing",
    content: (
      <p>
        We do not sell, trade, or rent your personal information to third parties. We may share your information only with service providers who assist us in operating our website and services, or when required by law.
      </p>
    ),
  },
  {
    id: "security",
    title: "4. Data Security",
    content: (
      <p>
        We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "5. Cookies",
    content: (
      <p>
        Our website uses cookies to enhance your browsing experience. Cookies are small files stored on your device that help us understand how you use our website and improve our services.
      </p>
    ),
  },
  {
    id: "rights",
    title: "6. Your Rights",
    content: (
      <p>
        You have the right to access, correct, or delete your personal information at any time. You may also opt out of receiving communications from us. To exercise these rights, please contact us at{" "}
        <a href="mailto:lilycrestadmin@gmail.com" className="terms-link">
          lilycrestadmin@gmail.com
        </a>
        .
      </p>
    ),
  },
  {
    id: "contact",
    title: "7. Contact Us",
    content: (
      <p>
        If you have any questions about this Privacy Policy, please contact us at{" "}
        <a href="mailto:lilycrestadmin@gmail.com" className="terms-link">
          <Mail size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 3 }} />
          lilycrestadmin@gmail.com
        </a>{" "}
        or call us at{" "}
        <a href="tel:+639123456789" className="terms-link">
          <Phone size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 3 }} />
          +63 912 345 6789
        </a>
        .
      </p>
    ),
  },
];

function PrivacyModal({ isOpen, onClose }) {
  useEscapeClose(isOpen, onClose);
  useBodyScrollLock(isOpen);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="terms-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div className="terms-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="terms-modal-header">
          <div className="terms-header-info">
            <div className="terms-header-icon">
              <ShieldCheck size={20} />
            </div>
            <div className="terms-header-text">
              <h2 id="privacy-modal-title">Privacy Policy</h2>
              <div className="terms-header-meta">
                <span>Lilycrest Dormitory Management System</span>
                <span>•</span>
                <span>Last Updated: March 1, 2026</span>
                <span className="terms-header-badge">v2.4</span>
              </div>
            </div>
          </div>

          <div className="terms-header-actions">
            <button
              type="button"
              className="terms-modal-close"
              onClick={onClose}
              aria-label="Close Privacy Policy modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body - Clean Plain Text */}
        <div className="terms-modal-body">
          <div className="terms-intro-card">
            We are committed to protecting your personal information and your right to privacy under Philippine data privacy laws and standards.
          </div>

          <div className="terms-sections-list">
            {PRIVACY_SECTIONS.map((section) => (
              <div key={section.id} id={`privacy-section-${section.id}`} className="terms-section-block">
                <h3 className="terms-section-title">{section.title}</h3>
                <div className="terms-section-content">{section.content}</div>
              </div>
            ))}
          </div>

          {/* Neutral Acceptance Card */}
          <div className="terms-acceptance-card">
            <ShieldCheck size={20} className="terms-acceptance-icon" />
            <p className="terms-acceptance-text">
              By clicking <strong>"I Understand"</strong> or continuing to use our services, you acknowledge that you have read, understood, and agree to the Lilycrest Privacy Policy.
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
            Official Document • 7 Standard Clauses
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

export default PrivacyModal;

