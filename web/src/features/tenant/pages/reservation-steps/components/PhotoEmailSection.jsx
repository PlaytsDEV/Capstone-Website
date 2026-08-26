import React from "react";
import { Mail, Lock } from "lucide-react";
import FileUploadField from "./FileUploadField";

/**
 * Section 1: Email & Photo — Locked Verified Account Email + Selfie upload.
 */
const PhotoEmailSection = ({
  billingEmail,
  setBillingEmail,
  accountEmail,
  selfiePhoto,
  setSelfiePhoto,
  showValidationErrors,
}) => {
  const effectiveEmail = String(accountEmail || billingEmail || "").trim().toLowerCase();

  // Ensure parent billingEmail state matches the verified account email if not set
  React.useEffect(() => {
    if (effectiveEmail && billingEmail !== effectiveEmail) {
      setBillingEmail?.(effectiveEmail);
    }
  }, [effectiveEmail, billingEmail, setBillingEmail]);

  return (
    <>
      <div className="form-group" data-field="billingEmail">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="form-label mb-0" htmlFor="billingEmailInput">
            Billing &amp; Notification Email Address
          </label>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-transparent flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span>Verified Account</span>
          </span>
        </div>

        <div className="relative flex items-center">
          <div className="absolute left-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Mail size={16} aria-hidden="true" />
          </div>
          <input
            id="billingEmailInput"
            type="email"
            name="email"
            readOnly
            disabled
            className="form-input bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 cursor-not-allowed border-slate-200 dark:border-slate-700 font-medium text-sm"
            style={{ paddingLeft: "38px", paddingRight: "38px" }}
            value={effectiveEmail}
            aria-readonly="true"
            aria-describedby="billingEmailHelper"
          />
          <div
            className="absolute right-3 flex items-center text-slate-400 dark:text-slate-500 cursor-help"
            title="Verified account email is locked and cannot be edited"
            aria-label="Verified account email is locked and cannot be edited"
          >
            <Lock size={15} />
          </div>
        </div>

        <div id="billingEmailHelper" className="form-helper mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Official receipts, reservation updates, and monthly rent billing statements will be sent to your verified account email address.
        </div>
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

