import React from "react";
import FileUploadField from "./FileUploadField";

const isEmailValid = (val) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val || "").trim());

/**
 * Section 1: Email & Photo — Editable Billing Email with Account Suggestion + Selfie upload.
 */
const PhotoEmailSection = ({
  billingEmail,
  setBillingEmail,
  accountEmail,
  selfiePhoto,
  setSelfiePhoto,
  showValidationErrors,
  fieldErrors = {},
  validateField,
}) => {
  const normalizedBillingEmail = String(billingEmail || "").trim();
  const normalizedAccountEmail = String(accountEmail || "").trim();
  const hasDiffFromAccount =
    Boolean(normalizedAccountEmail) &&
    normalizedBillingEmail.toLowerCase() !== normalizedAccountEmail.toLowerCase();
  const showAccountSuggestion =
    Boolean(normalizedAccountEmail) &&
    (!normalizedBillingEmail || hasDiffFromAccount);

  const handleEmailChange = (e) => {
    const nextVal = e.target.value;
    setBillingEmail?.(nextVal);
    if (validateField) {
      validateField("billingEmail", nextVal, (v) => {
        const trimmed = String(v || "").trim();
        if (!trimmed) {
          return { valid: false, error: "Billing email address is required" };
        }
        const valid = isEmailValid(trimmed);
        return {
          valid,
          error: valid ? null : "Please enter a valid email address (e.g. name@example.com)",
        };
      });
    }
  };

  const handleEmailBlur = () => {
    if (validateField) {
      validateField("billingEmail", billingEmail, (v) => {
        const trimmed = String(v || "").trim();
        if (!trimmed) {
          return { valid: false, error: "Billing email address is required" };
        }
        const valid = isEmailValid(trimmed);
        return {
          valid,
          error: valid ? null : "Please enter a valid email address (e.g. name@example.com)",
        };
      });
    }
  };

  const handleApplyAccountSuggestion = () => {
    if (!normalizedAccountEmail) return;
    setBillingEmail?.(normalizedAccountEmail);
    if (validateField) {
      validateField("billingEmail", normalizedAccountEmail, () => ({
        valid: true,
        error: null,
      }));
    }
  };

  const hasEmailError =
    (showValidationErrors && (!normalizedBillingEmail || !isEmailValid(normalizedBillingEmail))) ||
    Boolean(fieldErrors?.billingEmail);

  return (
    <>
      <div className="form-group" data-field="billingEmail">
        <label className="form-label" htmlFor="billingEmailInput">
          Billing & Notification Email Address <span className="rf-required">*</span>
        </label>
        <input
          id="billingEmailInput"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          className="form-input"
          value={billingEmail || ""}
          placeholder="e.g. name@example.com"
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          style={{
            border: hasEmailError ? "1.5px solid var(--danger)" : undefined,
          }}
          aria-invalid={hasEmailError}
          aria-describedby="billingEmailHelper billingEmailError"
        />

        {showAccountSuggestion && (
          <div className="rf-suggestion-row">
            <button
              type="button"
              className="rf-suggestion-chip"
              onClick={handleApplyAccountSuggestion}
              title="Click to use your account login email"
            >
              <span className="rf-suggestion-chip__icon" aria-hidden="true">💡</span>
              <span>Use account email: <strong>{normalizedAccountEmail}</strong></span>
            </button>
          </div>
        )}

        <div id="billingEmailHelper" className="form-helper">
          Official receipts and monthly billing statements will be sent to this email address. You may update this freely.
        </div>

        {hasEmailError && (
          <div id="billingEmailError" className="rf-field-error">
            {fieldErrors?.billingEmail || "Billing email address is required"}
          </div>
        )}
      </div>

      <div data-field="selfiePhoto">
        <FileUploadField
          label="2x2 Photo or Selfie Photo"
          value={selfiePhoto}
          onChange={setSelfiePhoto}
          accept="image/*"
          hint="Clear 2x2 or selfie photo"
          documentType="selfie-photo"
          hasError={showValidationErrors && !selfiePhoto}
          required
        />
      </div>
    </>
  );
};

export default PhotoEmailSection;
