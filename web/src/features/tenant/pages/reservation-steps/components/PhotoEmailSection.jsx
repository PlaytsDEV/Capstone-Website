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
    const cleaned = String(billingEmail || "").trim().toLowerCase();
    if (cleaned !== billingEmail) {
      setBillingEmail?.(cleaned);
    }
    if (validateField) {
      validateField("billingEmail", cleaned, (v) => {
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
          list={normalizedAccountEmail ? "billingEmail-suggestions" : undefined}
          value={billingEmail || ""}
          placeholder="e.g. name@example.com"
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
          style={{
            border: hasEmailError ? "1px solid var(--danger)" : undefined,
          }}
          aria-invalid={hasEmailError}
          aria-describedby="billingEmailHelper billingEmailError"
        />

        {normalizedAccountEmail && (
          <datalist id="billingEmail-suggestions">
            <option value={normalizedAccountEmail} />
          </datalist>
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
