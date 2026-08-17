import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Skull, X, LoaderCircle, Check, ArrowRight, ArrowLeft } from "lucide-react";

/**
 * ForceDeleteModal
 * ─────────────────────────────────────────────────────────────────────────────
 * 3-step safety confirmation modal for owner-only force deletion of a tenant
 * account that has significant history (reservations, billing records, etc.)
 *
 * Step 1 — Impact summary (active reservations, beds to release, paid deposits)
 * Step 2 — Type the tenant's full name to confirm identity
 * Step 3 — Type "FORCE DELETE" as the final irrevocable confirmation code
 *
 * Props:
 *   open         {boolean}   — whether the modal is visible
 *   tenant       {object}    — tenant row data (name, safeguards, paymentInfo)
 *   safeguards   {object}    — { reservations, activeReservations, issuedBills,
 *                                draftBills, utilityReadings, maintenanceRequests,
 *                                occupiedBeds }
 *   loading      {boolean}   — true while the delete API call is in-flight
 *   onClose      {function}  — called when the user cancels or ESC
 *   onConfirm    {function}  — called when the user completes all 3 steps;
 *                              receives no arguments — caller owns the API call
 */
export default function ForceDeleteModal({
  open,
  tenant,
  safeguards = {},
  loading = false,
  onClose,
  onConfirm,
}) {
  const [step, setStep] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");

  // Reset to step 1 each time the modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setNameInput("");
      setCodeInput("");
    }
  }, [open]);

  // ESC key closes
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open || typeof document === "undefined") return null;

  const tenantName = tenant?.name || tenant?.tenantName || "this tenant";
  const userId =
    tenant?.tenantId?._id ||
    tenant?.tenantId ||
    tenant?.userId?._id ||
    tenant?.userId;

  // Derived safeguard values
  const activeRes = Number(safeguards.activeReservations ?? 0);
  const totalRes = Number(safeguards.reservations ?? 0);
  const issuedBills = Number(safeguards.issuedBills ?? 0);
  const occupiedBeds = Number(safeguards.occupiedBeds ?? 0);
  // Priority: stored booking-time deposit → legacy securityDeposit field → formula fallback (monthlyRate)
  const paidDeposit = Number(
    tenant?.paymentInfo?.securityDeposit ??
    tenant?.securityDeposit ??
    tenant?.monthlyRate ??
    0,
  );
  const hasPaidDeposit = paidDeposit > 0;

  // Validation guards
  const nameMatches = nameInput.trim().toLowerCase() === tenantName.toLowerCase();
  const codeMatches = codeInput.trim() === "FORCE DELETE";

  // ─── Step indicators ────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: "Impact" },
    { n: 2, label: "Confirm Name" },
    { n: 3, label: "Final Code" },
  ];

  return createPortal(
    <div className="force-delete-modal__overlay" onClick={!loading ? onClose : undefined}>
      <div className="force-delete-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="force-delete-modal__header">
          <div className="force-delete-modal__header-icon">
            <Skull size={18} />
          </div>
          <h3>Force Delete Account</h3>
          <button
            type="button"
            className="force-delete-modal__close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="force-delete-modal__steps">
          {steps.map(({ n, label }) => (
            <div
              key={n}
              className={`force-delete-modal__step${step === n ? " force-delete-modal__step--active" : ""}${step > n ? " force-delete-modal__step--done" : ""}`}
            >
              <span className="force-delete-modal__step-num">{step > n ? "✓" : n}</span>
              <span className="force-delete-modal__step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="force-delete-modal__body">

          {/* ── Step 1: Impact Summary ── */}
          {step === 1 && (
            <div className="force-delete-modal__section">
              <p className="force-delete-modal__lead">
                You are about to <strong>permanently delete</strong> the account for{" "}
                <strong>{tenantName}</strong>. This action cannot be undone.
              </p>

              <div className="force-delete-modal__impact-grid">
                <div className="force-delete-modal__impact-row">
                  <span>Active reservations to cancel</span>
                  <strong className={activeRes > 0 ? "force-delete-modal__count--warn" : ""}>
                    {activeRes}
                  </strong>
                </div>
                <div className="force-delete-modal__impact-row">
                  <span>Total reservations to archive</span>
                  <strong>{totalRes}</strong>
                </div>
                <div className="force-delete-modal__impact-row">
                  <span>Beds to release</span>
                  <strong className={occupiedBeds > 0 ? "force-delete-modal__count--warn" : ""}>
                    {occupiedBeds}
                  </strong>
                </div>
                <div className="force-delete-modal__impact-row">
                  <span>Billing records (kept as "Deleted account")</span>
                  <strong>{issuedBills}</strong>
                </div>
              </div>

              {hasPaidDeposit && (
                <div className="force-delete-modal__callout force-delete-modal__callout--warn">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    This tenant has a paid security deposit of{" "}
                    <strong>₱{paidDeposit.toLocaleString()}</strong>. Force deleting
                    cancels the reservation <em>without</em> processing a refund.
                    Ensure any deposit refund is handled manually before proceeding.
                  </span>
                </div>
              )}

              <div className="force-delete-modal__callout force-delete-modal__callout--info">
                <span>
                  Issued billing records are <strong>preserved</strong> and will display
                  "Deleted account" in the billing module — no financial audit trail is lost.
                </span>
              </div>
            </div>
          )}

          {/* ── Step 2: Type Tenant Name ── */}
          {step === 2 && (
            <div className="force-delete-modal__section">
              <p className="force-delete-modal__lead">
                Type the tenant's full name to confirm you have selected the correct account.
              </p>
              <div className="force-delete-modal__name-target">
                {tenantName}
              </div>
              <label className="force-delete-modal__label">
                <span>Tenant name</span>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className={`force-delete-modal__input w-full pr-8 ${nameMatches ? "force-delete-modal__input--match" : ""}`}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Type exact name here"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {nameMatches && (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-2.5 pointer-events-none" />
                  )}
                </div>
              </label>
              {nameInput.length > 0 && !nameMatches && (
                <p className="force-delete-modal__mismatch">Name does not match — check spelling and capitalization</p>
              )}
            </div>
          )}

          {/* ── Step 3: Type FORCE DELETE ── */}
          {step === 3 && (
            <div className="force-delete-modal__section">
              <p className="force-delete-modal__lead">
                This is the final confirmation. Type{" "}
                <strong className="force-delete-modal__code-hint">FORCE DELETE</strong>{" "}
                exactly to permanently remove this account from the system.
              </p>
              <label className="force-delete-modal__label">
                <span>Confirmation code</span>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className={`force-delete-modal__input w-full pr-8 ${codeMatches ? "force-delete-modal__input--match" : ""}`}
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="FORCE DELETE"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {codeMatches && (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-2.5 pointer-events-none" />
                  )}
                </div>
              </label>
              {codeInput.length > 0 && !codeMatches && (
                <p className="force-delete-modal__mismatch">Type exactly: FORCE DELETE</p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="force-delete-modal__footer">
          {step === 1 && (
            <>
              <button
                type="button"
                className="force-delete-modal__btn force-delete-modal__btn--ghost"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="force-delete-modal__btn force-delete-modal__btn--next"
                onClick={() => setStep(2)}
              >
                <span>I Understand, Continue</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                className="force-delete-modal__btn force-delete-modal__btn--ghost"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="button"
                className="force-delete-modal__btn force-delete-modal__btn--next"
                onClick={() => setStep(3)}
                disabled={!nameMatches}
              >
                <span>Confirm Name & Continue</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                className="force-delete-modal__btn force-delete-modal__btn--ghost"
                onClick={() => setStep(2)}
                disabled={loading}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="button"
                className="force-delete-modal__btn force-delete-modal__btn--destroy"
                onClick={onConfirm}
                disabled={!codeMatches || loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Force Delete Now</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
