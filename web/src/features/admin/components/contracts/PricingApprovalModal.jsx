import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const hasAmount = (value) => value !== null && value !== undefined && value !== "" &&
  Number.isFinite(Number(value));
const peso = (value) => hasAmount(value)
  ? `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : "Not available";

const PricingValue = ({ label, value, emphasis = false }) =>
  <div className={`pricing-value${emphasis ? " pricing-value--emphasis" : ""}`}>
    <span>{label}</span><strong>{value}</strong>
  </div>;

export default function PricingApprovalModal({
  open, contract, busy, error, onCancel, onApprove, onCorrectSource,
}) {
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef(null);
  const noteRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setNotes("");
    setConfirmed(false);
    const restoreFocus = document.activeElement;
    const drawer = document.querySelector(".contract-detail-drawer");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (drawer) {
      drawer.setAttribute("inert", "");
      drawer.setAttribute("aria-hidden", "true");
    }
    const focusTimer = window.setTimeout(() => noteRef.current?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (drawer) {
        drawer.removeAttribute("inert");
        drawer.removeAttribute("aria-hidden");
      }
      restoreFocus?.focus?.();
    };
  }, [open, onCancel]);

  const pricing = useMemo(() => {
    const advanceSource = contract?.advanceRentAmount;
    const depositSource = contract?.securityDepositAmount;
    const creditSource = contract?.initialPaymentSummary?.reservationFeeCreditApplied ??
      contract?.reservationFeeCreditAmount;
    const advance = hasAmount(advanceSource) ? Number(advanceSource) : null;
    const deposit = hasAmount(depositSource) ? Number(depositSource) : null;
    const credit = hasAmount(creditSource) ? Number(creditSource) : null;
    const total = hasAmount(advance) && hasAmount(deposit) ? advance + deposit : null;
    const remaining = hasAmount(total) && hasAmount(credit) ? total - credit : null;
    return { advance, deposit, credit, total, remaining };
  }, [contract]);

  if (!open) return null;
  const requiredValues = [
    contract?.regularMonthlyRate, contract?.approvedMonthlyRate,
    pricing.advance, pricing.deposit, contract?.reservationFeeAmount, pricing.credit,
  ];
  const hasMissingValues = requiredValues.some((value) => !hasAmount(value));
  const hasDiscount = Number(contract?.discountPercentage) > 0 ||
    Number(contract?.discountAmount) > 0 ||
    Number(contract?.approvedMonthlyRate) !== Number(contract?.regularMonthlyRate);
  const noteRequired = hasDiscount;
  const disabledReason = hasMissingValues
    ? "Required pricing values are missing."
    : noteRequired && !notes.trim()
      ? "Enter an approval note for the discounted or special rate."
      : !confirmed ? "Select the confirmation checkbox to continue." : "";
  const discount = contract?.discountType === "none"
    ? "No discount"
    : `${contract?.discountPercentage ?? 0}% (${peso(contract?.discountAmount)})`;

  const content = <div className="pricing-modal-backdrop" role="presentation">
    <section ref={dialogRef} className="pricing-modal" role="dialog" aria-modal="true"
      aria-labelledby="pricing-modal-title" aria-describedby="pricing-modal-description">
      <header><div><h2 id="pricing-modal-title">Review Pricing</h2>
        <p id="pricing-modal-description">Confirm the Reservation pricing before approving it for Contract use.</p></div>
        <button type="button" onClick={onCancel} aria-label="Close pricing review">×</button>
      </header>
      <div className="pricing-modal__body">
        <div className="pricing-metadata">
          <span><strong>Source:</strong> Approved Reservation pricing</span>
          <span><strong>Approval status:</strong> {contract?.pricingApprovedAt
            ? `Approved on ${new Date(contract.pricingApprovedAt).toLocaleString("en-PH")}`
            : "Awaiting approval"}</span>
        </div>
        {hasMissingValues && <div className="contract-alert contract-alert--warning" role="alert">
          Required pricing values are missing. Correct the Reservation pricing source before approval.
        </div>}
        <div className="pricing-groups">
          <section><h3>Monthly pricing</h3><div className="pricing-grid">
            <PricingValue label="Regular rate" value={peso(contract?.regularMonthlyRate)}/>
            <PricingValue label="Discount" value={discount}/>
            <PricingValue label="Approved rate" value={peso(contract?.approvedMonthlyRate)} emphasis/>
          </div></section>
          <section><h3>Initial charges</h3><div className="pricing-grid">
            <PricingValue label="Advance rent" value={peso(pricing.advance)}/>
            <PricingValue label="Security deposit" value={peso(pricing.deposit)}/>
            <PricingValue label="Total initial charges" value={peso(pricing.total)} emphasis/>
          </div></section>
          <section><h3>Reservation credit</h3><div className="pricing-grid">
            <PricingValue label="Fee paid" value={peso(contract?.reservationFeeAmount)}/>
            <PricingValue label="Fee credit" value={peso(pricing.credit)}/>
            <PricingValue label="Remaining due" value={peso(pricing.remaining)} emphasis/>
          </div></section>
        </div>
        <p className="pricing-source-note">Incorrect amount? Update the Reservation pricing source instead of editing the Contract.</p>
        <label className="contract-field pricing-note"><span>Approval note</span>
          <small>Add a short reason for approving this pricing{noteRequired ? "." : " (optional)."}</small>
          <textarea ref={noteRef} rows="3" maxLength="300" value={notes}
            onChange={(event) => setNotes(event.target.value)}/><small>{notes.length}/300</small>
        </label>
        <label className="contract-check"><input type="checkbox" checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}/>
          I confirm that these Reservation pricing values are correct and approved for this Contract.
        </label>
        <p className="pricing-server-note">Your account and the server timestamp will be recorded automatically.</p>
        {disabledReason && <p className="pricing-disabled-reason" role="status">{disabledReason}</p>}
        {error && <div className="contract-alert contract-alert--error" role="alert">{error}</div>}
      </div>
      <footer>
        <button className="contract-link-button" type="button" onClick={onCorrectSource}>Correct Pricing Source</button>
        <div><button className="contract-button contract-button--secondary" type="button" onClick={onCancel}>Cancel</button>
          <button className="contract-button" type="button" disabled={Boolean(disabledReason) || busy}
            onClick={() => onApprove({ decision: "approve", notes: notes.trim() })}>
            {busy ? "Approving…" : "Approve Pricing"}
          </button></div>
      </footer>
    </section>
  </div>;
  return createPortal(content, document.body);
}
