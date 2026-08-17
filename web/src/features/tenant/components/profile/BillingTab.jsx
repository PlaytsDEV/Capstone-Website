import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { billingApi } from "../../../../shared/api/apiClient";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { formatPaymentMethod } from "../../../../shared/utils/formatPaymentMethod";
import SkeletonPulse from "../../../../shared/components/SkeletonPulse";
import StatusChip from "../../../../shared/components/StatusChip";
import DeadlineBadge from "../../../../shared/components/DeadlineBadge";
import { useMyUtilityBreakdownByBillId } from "../../../../shared/hooks/queries/useUtility";
import { showNotification } from "../../../../shared/utils/notification";
import BillingPageSkeleton from "../billing/BillingPageSkeleton";
import "../../styles/tenant-billing.css";
import {
  Zap,
  Droplets,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Download,
  Activity,
  Home,
  X,
  ShieldCheck,
  LoaderCircle,
  Receipt,
  FileText,
  Filter,
} from "lucide-react";

/* ── Helpers & Formatting ───────────────────────────── */

const fmt = (n) =>
  `₱${(Number(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtMonth = (d) => {
  if (!d) return "Statement";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long" });
};

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const fmtDateOnly = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
};

const fmtCycle = (item) => {
  if (item?.cycleText) return item.cycleText;
  const start = item?.billingCycleStart || item?.startDate;
  const end = item?.billingCycleEnd || item?.endDate;
  if (start && end) {
    const formattedStart = fmtDate(start);
    const formattedEnd = fmtDate(end);
    if (formattedStart === formattedEnd) {
      return formattedStart;
    }
    return `${formattedStart} – ${formattedEnd}`;
  }
  if (start) return fmtDate(start);
  if (item?.billingMonth) return fmtMonth(item.billingMonth);
  return null;
};

const fmtKwh = (n) =>
  `${(Number(n) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} kWh`;

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getOutstandingAmount = (bill) =>
  roundMoney(bill?.remainingAmount ?? bill?.totalAmount ?? 0);

const isPaidBill = (bill) =>
  bill?.status === "paid" || getOutstandingAmount(bill) <= 0;

const getBillSortTimestamp = (bill = {}) => {
  const candidates = [
    bill?.dueDate,
    bill?.billingCycleStart,
    bill?.billingMonth,
    bill?.createdAt,
  ];

  for (const value of candidates) {
    const timestamp = value ? new Date(value).getTime() : Number.NaN;
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return Number.POSITIVE_INFINITY;
};

const sortBillsOldestFirst = (left, right) =>
  getBillSortTimestamp(left) - getBillSortTimestamp(right);

const getBillChargeSummary = (bill = {}) => {
  const charges = bill?.charges || {};
  const isInitialPayment = bill?.billType === "initial_payment";
  const rentAndFeesTotal = isInitialPayment
    ? roundMoney(Number(bill?.totalAmount || 0))
    : roundMoney(
        Math.max(
          Number(charges.rent || 0) +
            Number(charges.applianceFees || 0) +
            Number(charges.corkageFees || 0) +
            Number(charges.penalty || 0) -
            Number(charges.discount || 0) -
            Number(bill?.reservationCreditApplied || 0),
          0,
        ),
      );
  const electricityTotal = roundMoney(Number(charges.electricity || 0));
  const waterTotal = roundMoney(Number(charges.water || 0));
  const utilitiesTotal = roundMoney(electricityTotal + waterTotal);
  const statementTotal = roundMoney(
    Number(bill?.totalAmount ?? rentAndFeesTotal + utilitiesTotal),
  );
  const remaining = roundMoney(getOutstandingAmount(bill));
  const chargeSections = [
    { key: "rent", amount: rentAndFeesTotal },
    { key: "electricity", amount: electricityTotal },
    { key: "water", amount: waterTotal },
  ];
  const populatedSections = chargeSections.filter((section) => section.amount > 0);
  const allocationBasis = roundMoney(
    chargeSections.reduce((sum, section) => sum + section.amount, 0) || statementTotal,
  );
  const outstandingBySection = { rent: 0, electricity: 0, water: 0 };

  if (remaining > 0 && allocationBasis > 0 && populatedSections.length > 0) {
    let unallocated = remaining;

    populatedSections.forEach((section, index) => {
      const allocated =
        index === populatedSections.length - 1
          ? unallocated
          : roundMoney((remaining * section.amount) / allocationBasis);
      const safeAllocated = roundMoney(
        Math.min(Math.max(allocated, 0), unallocated),
      );

      outstandingBySection[section.key] = safeAllocated;
      unallocated = roundMoney(unallocated - safeAllocated);
    });
  }

  return {
    rentAndFeesTotal,
    electricityTotal,
    waterTotal,
    utilitiesTotal,
    statementTotal,
    remaining,
    outstandingBySection,
    hasRentCharges: rentAndFeesTotal > 0 || isInitialPayment || bill?.billType === "monthly" || (!charges.electricity && !charges.water),
    hasElectricityCharge: electricityTotal > 0 || bill?.billType === "electricity" || Boolean(bill?.utilityBreakdowns?.electricity),
    hasWaterCharge: waterTotal > 0 || bill?.billType === "water" || Boolean(bill?.utilityBreakdowns?.water),
    hasUtilityCharges: utilitiesTotal > 0,
    isCombinedStatement: populatedSections.length > 1,
  };
};

/* ── Electricity Reference Breakdown Sub-Component ── */

const ElectricityReferenceSegmentCard = ({ seg, ratePerKwh }) => {
  const totalConsumption = Number(
    seg.segmentTotalKwh ?? seg.kwhConsumed ?? ((seg.readingTo || 0) - (seg.readingFrom || 0)),
  );
  const tenantsSharing = Number(seg.activeTenantCount || 0);
  const segmentRoomTotal = totalConsumption * Number(ratePerKwh || 0);
  const segmentShare = Number(
    seg.sharePerTenantCost ?? (tenantsSharing > 0 ? segmentRoomTotal / tenantsSharing : 0),
  );

  return (
    <div style={elecS.referenceCard}>
      <div style={elecS.referenceIntro}>Segment billing details</div>
      <table style={elecS.referenceTable}>
        <tbody>
          <tr>
            <td style={{ ...elecS.referenceLabelCell, ...elecS.referenceSectionCell }} colSpan={2}>
              No. of occupants in the room:
            </td>
            <td style={{ ...elecS.referenceValueCell, ...elecS.referenceSectionCell }}>
              {seg.activeTenantCount}
            </td>
          </tr>
          <tr>
            <td style={elecS.referenceSpacerCell} />
            <td style={elecS.referenceHeaderCell}>Date</td>
            <td style={elecS.referenceHeaderCell}>kWh</td>
          </tr>
          <tr>
            <td style={elecS.referenceLabelCell}>1st reading</td>
            <td style={elecS.referenceValueCell}>{fmtDateOnly(seg.startDate)}</td>
            <td style={elecS.referenceValueCell}>
              {Number(seg.readingFrom || 0).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
          </tr>
          <tr>
            <td style={elecS.referenceLabelCell}>2nd reading</td>
            <td style={elecS.referenceValueCell}>{fmtDateOnly(seg.endDate)}</td>
            <td style={elecS.referenceValueCell}>
              {Number(seg.readingTo || 0).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
          </tr>
          <tr>
            <td style={{ ...elecS.referenceLabelCell, fontStyle: "italic" }}>Total consumption</td>
            <td style={elecS.referenceValueCell} />
            <td style={elecS.referenceValueCell}>
              {totalConsumption.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
          </tr>
          <tr>
            <td style={elecS.referenceLabelCell} colSpan={2}>
              Room total (kWh × ₱{ratePerKwh}/kWh)
            </td>
            <td style={elecS.referenceValueCell}>{fmt(segmentRoomTotal)}</td>
          </tr>
          <tr>
            <td style={elecS.referenceLabelCell} colSpan={2}>
              Your share for this segment (room total / {tenantsSharing || 0})
            </td>
            <td style={{ ...elecS.referenceValueCell, fontWeight: 700 }}>
              {fmt(segmentShare)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const ElectricityFinalBreakdownCard = ({ data, period, electricityAmount }) => {
  const segments = data?.segments || [];
  const segmentTotals = segments.map((seg, idx) => {
    const totalConsumption = Number(
      seg.segmentTotalKwh ?? seg.kwhConsumed ?? ((seg.readingTo || 0) - (seg.readingFrom || 0)),
    );
    const tenantsSharing = Number(seg.activeTenantCount || 0);
    const segmentRoomTotal = totalConsumption * Number(data?.ratePerKwh || 0);
    const share = Number(seg.sharePerTenantCost ?? (tenantsSharing > 0 ? segmentRoomTotal / tenantsSharing : 0));
    return {
      key: `${seg.startDate || "seg"}-${idx}`,
      share,
    };
  });

  const subtotal = segmentTotals.reduce((sum, item) => sum + item.share, 0);
  const finalDue = electricityAmount || data?.myBillAmount || subtotal;

  return (
    <div style={elecS.finalBreakdownCard}>
      <div style={elecS.finalBreakdownHeader}>Overall Electricity Summary</div>
      <div style={elecS.finalBreakdownBody}>
        <div style={elecS.finalBreakdownRow}>
          <span style={elecS.finalBreakdownLabel}>Total Individual Share:</span>
          <span style={elecS.finalBreakdownValue}>{fmt(finalDue)}</span>
        </div>
      </div>
      <div style={elecS.finalBreakdownFooter}>
        <span>Electricity Amount:</span>
        <span style={elecS.finalBreakdownTotal}>{fmt(finalDue)}</span>
      </div>
    </div>
  );
};

/* ── Pre-Checkout Review Modal (Choice 2: B) ────────── */

const PreCheckoutModal = ({
  isOpen,
  onClose,
  billsToPay = [],
  onConfirm,
  isSubmitting = false,
}) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || billsToPay.length === 0) return null;

  const totalAmount = roundMoney(
    billsToPay.reduce((sum, b) => sum + getOutstandingAmount(b), 0),
  );

  return (
    <div
      className="precheckout-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="precheckout-modal-title"
    >
      <div className="precheckout-modal" ref={modalRef}>
        <div className="precheckout-modal__header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Receipt size={20} color="#0A1628" />
            <h3 id="precheckout-modal-title" className="precheckout-modal__title">
              Review Selected Statements for Payment
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: "none",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              color: "#64748b",
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="precheckout-modal__body">
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Please confirm the statements you wish to settle. You will be redirected to the secure <strong>PayMongo</strong> gateway to complete your payment.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {billsToPay.map((bill, index) => {
              const summary = getBillChargeSummary(bill);
              const isInitial = bill.billType === "initial_payment";
              const isElecOnly = summary.hasElectricityCharge && !summary.hasRentCharges && !summary.hasWaterCharge && !isInitial;
              const isWaterOnly = summary.hasWaterCharge && !summary.hasRentCharges && !summary.hasElectricityCharge && !isInitial;
              const isCombined = (summary.hasRentCharges || isInitial) && summary.hasUtilityCharges;
              const title = isInitial
                ? "Initial Move-In Settlement"
                : isCombined
                  ? `${fmtMonth(bill.billingMonth)} Rent & Utilities Statement`
                  : isElecOnly
                    ? `${fmtMonth(bill.billingMonth)} Electricity Statement`
                    : isWaterOnly
                      ? `${fmtMonth(bill.billingMonth)} Water Statement`
                      : `${fmtMonth(bill.billingMonth)} Rent Statement`;
              const remaining = getOutstandingAmount(bill);

              return (
                <div key={bill.id || bill._id || index} className="precheckout-item-row">
                  <div>
                    <div className="precheckout-item-title">
                      {index + 1}. {title}
                    </div>
                    <div className="precheckout-item-meta">
                      {bill.dueDate ? `Due: ${fmtDate(bill.dueDate)}` : "No due date"}
                      {summary.hasRentCharges && summary.hasUtilityCharges && " • Rent & Utilities"}
                    </div>
                  </div>
                  <div className="precheckout-item-amount">{fmt(remaining)}</div>
                </div>
              );
            })}
          </div>

          <div className="precheckout-summary-box">
            <div className="precheckout-summary-row">
              <span>Selected Statements</span>
              <strong style={{ color: "var(--text-heading)" }}>{billsToPay.length} invoice(s)</strong>
            </div>
            <div className="precheckout-summary-row">
              <span>Payment Gateway</span>
              <span>PayMongo (GCash, Maya, Cards, Online Banking)</span>
            </div>
            <div className="precheckout-summary-total">
              <span>Total Payable Amount</span>
              <span>{fmt(totalAmount)}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 8,
              fontSize: 12,
              color: "#1e40af",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldCheck size={16} color="#2563eb" style={{ flexShrink: 0 }} />
            <span>
              Transactions are encrypted and settled automatically once completed on PayMongo.
            </span>
          </div>
        </div>

        <div className="precheckout-modal__footer">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: "#ffffff",
              border: "1px solid var(--border-card)",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(billsToPay)}
            disabled={isSubmitting}
            className="btn-review-pay"
            style={{ padding: "9px 20px" }}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle size={15} className="animate-spin" />
                Initiating Secure Checkout...
              </>
            ) : (
              <>
                <CreditCard size={15} />
                Proceed to PayMongo ({fmt(totalAmount)})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Hero Category Breakdown Tray Component (Option A) ─ */

const HeroCategoryCard = ({
  title,
  icon: Icon,
  bills = [],
  unpaidTotal = 0,
  selectedBillIds = [],
  onToggleSelectBill,
  onToggleCategory,
  onPayCategory,
  onPaySingle,
}) => {
  const unpaidBills = useMemo(() => bills.filter((b) => !isPaidBill(b)), [bills]);
  const paidBills = useMemo(
    () =>
      bills
        .filter((b) => isPaidBill(b))
        .sort((a, b) => getBillSortTimestamp(b) - getBillSortTimestamp(a)),
    [bills],
  );

  const isAllPaid = unpaidBills.length === 0;
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(!isAllPaid);

  const isCategoryAllSelected =
    unpaidBills.length > 0 &&
    unpaidBills.every((b) => selectedBillIds.includes(b.id || b._id));
  const isCategoryIndeterminate =
    unpaidBills.some((b) => selectedBillIds.includes(b.id || b._id)) &&
    !isCategoryAllSelected;

  const checkboxRef = useRef(null);
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isCategoryIndeterminate;
    }
  }, [isCategoryIndeterminate]);

  if (bills.length === 0) {
    return (
      <div className="hero-category-card" style={{ borderStyle: "dashed", background: "#fcfdfe" }}>
        <div className="hero-category-header" style={{ background: "transparent" }}>
          <div className="hero-category-header__left">
            <Icon size={16} color="#94a3b8" />
            <span className="hero-category-header__title" style={{ color: "#64748b" }}>{title}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 12,
                background: "#f1f5f9",
                color: "#64748b",
              }}
            >
              No Statements
            </span>
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>₱0.00</span>
        </div>
      </div>
    );
  }

  // Strictly cap paid statements to at most 1 recent statement to keep the overview minimal
  const displayedPaidBills = paidBills.slice(0, 1);
  const displayedBills = isAllPaid
    ? displayedPaidBills
    : [...unpaidBills, ...displayedPaidBills];
  const olderPaidCount = Math.max(0, paidBills.length - displayedPaidBills.length);

  return (
    <div className="hero-category-card">
      <div className="hero-category-header">
        <div className="hero-category-header__left">
          {!isAllPaid ? (
            <input
              type="checkbox"
              ref={checkboxRef}
              className="ledger-custom-checkbox"
              checked={isCategoryAllSelected}
              onChange={() => onToggleCategory(unpaidBills)}
              aria-label={`Select all ${title}`}
              style={{ width: 16, height: 16, accentColor: "#0A1628", cursor: "pointer" }}
            />
          ) : (
            <CheckCircle size={16} color="#059669" />
          )}
          <Icon size={16} color="#0A1628" />
          <span className="hero-category-header__title">{title}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 12,
              background: isAllPaid ? "#ecfdf5" : "#fffbeb",
              color: isAllPaid ? "#059669" : "#d97706",
              border: `1px solid ${isAllPaid ? "#a7f3d0" : "#fde68a"}`,
            }}
          >
            {isAllPaid ? "All Settled" : `${unpaidBills.length} unpaid`}
          </span>
        </div>

        <div className="hero-category-header__actions">
          <span
            className="hero-category-header__amount"
            style={{ color: isAllPaid ? "#059669" : "#0A1628" }}
          >
            {fmt(isAllPaid ? bills.reduce((sum, b) => sum + (Number(b.paidAmount || b.totalAmount) || 0), 0) : unpaidTotal)}
          </span>

          {!isAllPaid && (
            <button
              type="button"
              className="hero-category-pay-btn"
              onClick={() => onPayCategory(unpaidBills)}
              title={`Pay all ${title}`}
            >
              <CreditCard size={12} />
              Pay Category ({fmt(unpaidTotal)})
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: "#64748b",
              display: "flex",
              alignItems: "center",
            }}
            aria-label={isCategoryExpanded ? "Collapse category" : "Expand category"}
          >
            {isCategoryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isCategoryExpanded && (
        <div className="hero-category-list">
          {displayedBills.map((bill) => {
            const billId = bill.id || bill._id;
            const isPaid = isPaidBill(bill);
            const isSelected = selectedBillIds.includes(billId);
            const remaining = getOutstandingAmount(bill);
            const isInitial = bill.billType === "initial_payment";
            const summary = getBillChargeSummary(bill);
            const isElecOnly = summary.hasElectricityCharge && !summary.hasRentCharges && !summary.hasWaterCharge && !isInitial;
            const isWaterOnly = summary.hasWaterCharge && !summary.hasRentCharges && !summary.hasElectricityCharge && !isInitial;
            const isCombined = (summary.hasRentCharges || isInitial) && summary.hasUtilityCharges;
            const itemTitle = isInitial
              ? "Initial Move-In Settlement"
              : isCombined
                ? `${fmtMonth(bill.billingMonth)} Rent & Utilities Statement`
                : isElecOnly
                  ? `${fmtMonth(bill.billingMonth)} Electricity Statement`
                  : isWaterOnly
                    ? `${fmtMonth(bill.billingMonth)} Water Statement`
                    : `${fmtMonth(bill.billingMonth)} Rent Statement`;
            const displayAmt = isPaid ? (Number(bill.paidAmount || bill.totalAmount) || 0) : remaining;

            return (
              <div key={billId} className="hero-category-item">
                <div className="hero-category-item__left">
                  {isPaid ? (
                    <CheckCircle size={15} color="#059669" />
                  ) : (
                    <input
                      type="checkbox"
                      className="ledger-custom-checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectBill(billId)}
                      aria-label={`Select ${itemTitle}`}
                      style={{ width: 15, height: 15, accentColor: "#0A1628", cursor: "pointer" }}
                    />
                  )}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span className="hero-category-item__title">{itemTitle}</span>
                      <StatusChip status={bill.status || "pending"} variant="text" />
                    </div>
                    <div className="hero-category-item__cycle">
                      {isInitial ? "Advance rent & deposit" : `Cycle: ${fmtCycle(bill) || "—"}`}
                    </div>
                  </div>
                </div>

                <div className="hero-category-item__right">
                  <span style={{ color: isPaid ? "#64748b" : "#0A1628" }}>{fmt(displayAmt)}</span>
                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => onPaySingle(bill)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #0A1628",
                        borderRadius: 4,
                        padding: "3px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#0A1628",
                        cursor: "pointer",
                      }}
                    >
                      Pay
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Clean limit note if older statements exist in history */}
          {olderPaidCount > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: 6,
                padding: "6px 10px",
                marginTop: 4,
                textAlign: "center",
                border: "1px dashed #e2e8f0",
              }}
            >
              Showing latest settled statement • {olderPaidCount} older statement{olderPaidCount === 1 ? "" : "s"} available in Paid History below
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Top Statement Ledger Hero Component ───────────── */

const StatementLedgerHero = ({
  totalBalance,
  unpaidRent,
  unpaidElec,
  unpaidWater,
  hasWaterBilling,
  onPayAll,
  unpaidCount = 0,
  bills = [],
  selectedBillIds = [],
  onToggleSelectBill,
  onToggleCategory,
  onPayCategory,
  onPaySingle,
}) => {
  const [isHeroBreakdownOpen, setIsHeroBreakdownOpen] = useState(false);
  const isAllCaughtUp = totalBalance <= 0;

  const rentBills = useMemo(
    () =>
      bills.filter(
        (b) =>
          getBillChargeSummary(b).hasRentCharges ||
          b.billType === "initial_payment" ||
          b.billType === "monthly" ||
          (!b.charges?.electricity && !b.charges?.water),
      ),
    [bills],
  );

  const electricityBills = useMemo(
    () =>
      bills.filter(
        (b) =>
          getBillChargeSummary(b).hasElectricityCharge ||
          b.billType === "electricity" ||
          Boolean(b.utilityBreakdowns?.electricity),
      ),
    [bills],
  );

  const waterBills = useMemo(
    () =>
      bills.filter(
        (b) =>
          getBillChargeSummary(b).hasWaterCharge ||
          b.billType === "water" ||
          Boolean(b.utilityBreakdowns?.water),
      ),
    [bills],
  );

  return (
    <div className="statement-ledger-hero" style={dash.wrapper}>
      <div className="statement-ledger-hero__top" style={dash.heroTop}>
        <div>
          <div className="statement-ledger-hero__label" style={dash.heroLabel}>
            <Receipt size={15} color="#0A1628" />
            Total Outstanding Balance
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div className="statement-ledger-hero__amount" style={dash.heroAmount}>{fmt(totalBalance)}</div>
            {isAllCaughtUp ? (
              <span style={dash.allCaughtUpBadge}>
                <CheckCircle size={14} color="#059669" /> All Caught Up • No Pending Balance
              </span>
            ) : (
              <span style={dash.unpaidBadge}>
                <Clock size={13} color="#d97706" /> {unpaidCount} unpaid statement{unpaidCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="hero-toggle-btn"
            onClick={() => setIsHeroBreakdownOpen(!isHeroBreakdownOpen)}
            aria-expanded={isHeroBreakdownOpen}
          >
            <ChevronDown
              size={15}
              style={{
                transform: isHeroBreakdownOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
              }}
            />
            {isHeroBreakdownOpen ? "Hide Category Breakdown" : "View Category Breakdown"}
          </button>

          {!isAllCaughtUp && (
            <button
              type="button"
              onClick={onPayAll}
              className="btn-review-pay"
              style={dash.payAllBtn}
            >
              <CreditCard size={17} />
              Pay All Statements ({fmt(totalBalance)})
            </button>
          )}
        </div>
      </div>

      <div className="statement-ledger-hero__chips" style={dash.chipsContainer}>
        <div className="statement-ledger-hero__chip-item" style={dash.chipItem}>
          <Home size={15} color="#0A1628" />
          <span>Rent:</span>
          <strong style={{ color: "#0A1628", fontWeight: 700 }}>{fmt(unpaidRent)}</strong>
        </div>
        <div style={dash.chipDivider} />
        <div className="statement-ledger-hero__chip-item" style={dash.chipItem}>
          <Zap size={15} color="#d97706" />
          <span>Electricity:</span>
          <strong style={{ color: "#0A1628", fontWeight: 700 }}>{fmt(unpaidElec)}</strong>
        </div>
        {hasWaterBilling && (
          <>
            <div style={dash.chipDivider} />
            <div className="statement-ledger-hero__chip-item" style={dash.chipItem}>
              <Droplets size={15} color="#2563eb" />
              <span>Water:</span>
              <strong style={{ color: "#0A1628", fontWeight: 700 }}>{fmt(unpaidWater)}</strong>
            </div>
          </>
        )}
      </div>

      {/* Hero Category Breakdown Tray (Option A) */}
      {isHeroBreakdownOpen && (
        <div className="hero-breakdown-tray">
          {bills.length === 0 ? (
            <div style={dash.trayEmptyBox}>
              <FileText size={28} color="#94a3b8" />
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginTop: 8 }}>
                No Billing Statements Issued Yet
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", maxWidth: 440 }}>
                Once dormitory management issues your monthly rent or utility statements, their itemized category breakdowns will appear here.
              </p>
            </div>
          ) : (
            <>
              {isAllCaughtUp && (
                <div style={dash.trayAllCaughtUpBanner}>
                  <CheckCircle size={16} color="#059669" style={{ flexShrink: 0 }} />
                  <span>
                    All statement categories are fully paid and up to date! You can review your statement history in each category below.
                  </span>
                </div>
              )}

              <HeroCategoryCard
                title="Rent Statements"
                icon={Home}
                bills={rentBills}
                unpaidTotal={unpaidRent}
                selectedBillIds={selectedBillIds}
                onToggleSelectBill={onToggleSelectBill}
                onToggleCategory={onToggleCategory}
                onPayCategory={onPayCategory}
                onPaySingle={onPaySingle}
              />

              <HeroCategoryCard
                title="Electricity Utilities"
                icon={Zap}
                bills={electricityBills}
                unpaidTotal={unpaidElec}
                selectedBillIds={selectedBillIds}
                onToggleSelectBill={onToggleSelectBill}
                onToggleCategory={onToggleCategory}
                onPayCategory={onPayCategory}
                onPaySingle={onPaySingle}
              />

              {hasWaterBilling && (
                <HeroCategoryCard
                  title="Water Utilities"
                  icon={Droplets}
                  bills={waterBills}
                  unpaidTotal={unpaidWater}
                  selectedBillIds={selectedBillIds}
                  onToggleSelectBill={onToggleSelectBill}
                  onToggleCategory={onToggleCategory}
                  onPayCategory={onPayCategory}
                  onPaySingle={onPaySingle}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Dual Filter Toolbar (Status & Category Dropdown) ─ */

const StatementFilters = ({
  bills = [],
  statusFilter = "all",
  setStatusFilter,
  categoryFilter = "all",
  setCategoryFilter,
  hasWaterBilling = false,
}) => {
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsCategoryMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unpaidCount = bills.filter((b) => !isPaidBill(b)).length;
  const paidCount = bills.filter((b) => isPaidBill(b)).length;

  const statusOptions = [
    { value: "all", label: "All Statements", count: bills.length },
    { value: "unpaid", label: "Unpaid", count: unpaidCount },
    { value: "paid", label: "Paid History", count: paidCount },
  ];

  const rentCount = bills.filter((b) => {
    const s = getBillChargeSummary(b);
    return (
      s.hasRentCharges ||
      b.billType === "initial_payment" ||
      b.billType === "monthly" ||
      (!b.charges?.electricity && !b.charges?.water)
    );
  }).length;

  const elecCount = bills.filter((b) => {
    const s = getBillChargeSummary(b);
    return (
      s.hasElectricityCharge ||
      b.billType === "electricity" ||
      Boolean(b.utilityBreakdowns?.electricity)
    );
  }).length;

  const waterCount = bills.filter((b) => {
    const s = getBillChargeSummary(b);
    return (
      s.hasWaterCharge ||
      b.billType === "water" ||
      Boolean(b.utilityBreakdowns?.water)
    );
  }).length;

  const categoryOptions = [
    { value: "all", label: "All Kinds", count: bills.length },
    { value: "rent", label: "Rent", icon: Home, count: rentCount },
    { value: "electricity", label: "Electricity", icon: Zap, count: elecCount },
    ...(hasWaterBilling ? [{ value: "water", label: "Water", icon: Droplets, count: waterCount }] : []),
  ];

  const activeCategory = categoryOptions.find((c) => c.value === categoryFilter);

  return (
    <div className="statement-filters-container" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        {/* Status Pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`ledger-filter-chip ${statusFilter === opt.value ? "is-active" : ""}`}
            >
              {opt.label}
              <span style={s.chipCount}>{opt.count}</span>
            </button>
          ))}
        </div>

        {/* Clickable Filter Category Dropdown Toggle */}
        <div style={{ position: "relative" }} ref={filterMenuRef}>
          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
            className={`ledger-filter-category-btn ${categoryFilter !== "all" ? "is-active" : ""}`}
            aria-expanded={isCategoryMenuOpen}
            aria-haspopup="true"
          >
            {categoryFilter !== "all" && activeCategory?.icon ? (
              <activeCategory.icon size={13} color="#ffffff" />
            ) : (
              <Filter size={13} color={categoryFilter !== "all" ? "#ffffff" : "#64748b"} />
            )}
            <span>
              {categoryFilter !== "all" ? activeCategory?.label || "Filtered" : "Filter Category"}
            </span>

            {categoryFilter !== "all" ? (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCategoryFilter("all");
                  setIsCategoryMenuOpen(false);
                }}
                className="category-clear-btn"
                title="Clear category filter"
              >
                <X size={10} color="#ffffff" strokeWidth={2.5} />
              </span>
            ) : (
              <ChevronDown
                size={13}
                style={{
                  transform: isCategoryMenuOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                  color: "#94a3b8",
                }}
              />
            )}
          </button>

          {/* Category Dropdown Menu */}
          {isCategoryMenuOpen && (
            <div className="category-dropdown-menu">
              <div
                style={{
                  padding: "6px 10px 6px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid #f1f5f9",
                  marginBottom: 2,
                }}
              >
                Filter by Category
              </div>
              {categoryOptions.map((cat) => {
                const Icon = cat.icon;
                const isActive = categoryFilter === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(cat.value);
                      setIsCategoryMenuOpen(false);
                    }}
                    className={`category-dropdown-item ${isActive ? "is-active" : ""}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {Icon ? (
                        <Icon size={15} color={isActive ? "#0A1628" : "#64748b"} />
                      ) : (
                        <Filter size={14} color={isActive ? "#0A1628" : "#94a3b8"} />
                      )}
                      <span>{cat.label}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: isActive ? "#0A1628" : "#f1f5f9",
                        color: isActive ? "#ffffff" : "#64748b",
                      }}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Unified Statement Ledger Card ─────────────────── */

const StatementLedgerCard = ({
  bill,
  isSelected = false,
  onToggleSelect,
  onPaySingle,
  isOpen = false,
  onToggleOpen,
}) => {
  const charges = bill.charges || {};
  const summary = getBillChargeSummary(bill);
  const isInitialPayment = bill.billType === "initial_payment";
  const initial = bill.initialPaymentBreakdown || {};
  const isPaid = isPaidBill(bill);
  const remaining = getOutstandingAmount(bill);
  const totalDisplayAmount = isPaid
    ? Number(bill.totalAmount || bill.paidAmount || summary.statementTotal || 0)
    : remaining;

  // Hook for utility breakdown if electricity or water is present
  const { data: elecData, isLoading: elecLoading } = useMyUtilityBreakdownByBillId(
    "electricity",
    isOpen && summary.hasElectricityCharge ? (bill.id || bill._id) : null,
  );
  const resolvedElecData = bill.utilityBreakdowns?.electricity || elecData;

  const { data: waterData, isLoading: waterLoading } = useMyUtilityBreakdownByBillId(
    "water",
    isOpen && summary.hasWaterCharge ? (bill.id || bill._id) : null,
  );
  const resolvedWaterData = bill.utilityBreakdowns?.water || waterData;

  const isElecOnly = summary.hasElectricityCharge && !summary.hasRentCharges && !summary.hasWaterCharge && !isInitialPayment;
  const isWaterOnly = summary.hasWaterCharge && !summary.hasRentCharges && !summary.hasElectricityCharge && !isInitialPayment;
  const isCombined = (summary.hasRentCharges || isInitialPayment) && summary.hasUtilityCharges;

  const cardTitle = isInitialPayment
    ? "Initial Move-In Settlement"
    : isCombined
      ? `${fmtMonth(bill.billingMonth)} Rent & Utilities Statement`
      : isElecOnly
        ? `${fmtMonth(bill.billingMonth)} Electricity Statement`
        : isWaterOnly
          ? `${fmtMonth(bill.billingMonth)} Water Statement`
          : `${fmtMonth(bill.billingMonth)} Rent Statement`;

  return (
    <div
      className={`statement-card ${bill.status === "overdue" ? "is-overdue" : ""} ${isSelected ? "is-selected" : ""}`}
      style={{
        background: isSelected ? "#f8fafc" : "#ffffff",
        border: `1px solid ${isSelected ? "#0A1628" : bill.status === "overdue" ? "#fca5a5" : "#e2e8f0"}`,
        borderLeft: bill.status === "overdue" ? "4px solid #DC2626" : undefined,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        marginBottom: 12,
        transition: "border-color 0.15s ease",
      }}
    >
      <div
        className="statement-card__header"
        onClick={onToggleOpen}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "16px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          gap: 14,
        }}
      >
        {/* Checkbox / Status Icon */}
        <div
          className="statement-card__check-wrap"
          onClick={(e) => {
            e.stopPropagation();
            if (!isPaid) onToggleSelect(bill.id || bill._id);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isPaid ? "default" : "pointer",
            flexShrink: 0,
          }}
        >
          {isPaid ? (
            <CheckCircle size={20} color="#059669" />
          ) : (
            <input
              type="checkbox"
              className="ledger-custom-checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(bill.id || bill._id)}
              aria-label={`Select ${cardTitle}`}
              style={{
                width: 18,
                height: 18,
                accentColor: "#0A1628",
                cursor: "pointer",
              }}
            />
          )}
        </div>

        {/* Category Icon */}
        <div
          style={{
            color: isPaid ? "#059669" : "#0A1628",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 8,
            background: isPaid ? "#ecfdf5" : "#f1f5f9",
            flexShrink: 0,
          }}
        >
          {isInitialPayment ? (
            <Package size={17} color={isPaid ? "#059669" : "#0A1628"} />
          ) : isElecOnly ? (
            <Zap size={17} color="#d97706" />
          ) : isWaterOnly ? (
            <Droplets size={17} color="#2563eb" />
          ) : isCombined ? (
            <Receipt size={17} color={isPaid ? "#059669" : "#0A1628"} />
          ) : (
            <Home size={17} color={isPaid ? "#059669" : "#0A1628"} />
          )}
        </div>

        {/* Title & Metadata */}
        <div className="statement-card__info" style={{ flex: 1, minWidth: 160 }}>
          <div className="statement-card__title-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span className="statement-card__title" style={{ fontSize: 14, fontWeight: 700, color: "#0A1628" }}>
              {cardTitle}
            </span>
            <StatusChip status={bill.status || "pending"} variant="text" />
            {isInitialPayment && <span className="statement-type-badge type-movein">Move-In</span>}
            {!isInitialPayment && isCombined && <span className="statement-type-badge type-combined">Combined</span>}
            {!isInitialPayment && isElecOnly && <span className="statement-type-badge type-electricity">Electricity</span>}
            {!isInitialPayment && isWaterOnly && <span className="statement-type-badge type-water">Water</span>}
            {!isInitialPayment && !isCombined && !isElecOnly && !isWaterOnly && (
              <span className="statement-type-badge type-rent">Rent</span>
            )}
          </div>
          <div className="statement-card__cycle" style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
            {isInitialPayment
              ? "Advance rent, security deposit, and initial charges"
              : `Cycle: ${fmtCycle(bill) || "—"}`}
          </div>
          {bill.dueDate && (
            <div style={{ marginTop: 2 }}>
              <DeadlineBadge
                dueDate={bill.dueDate}
                status={bill.status}
                type="bill"
                penaltyRate={bill.penaltyDetails?.ratePerDay || 50}
              />
            </div>
          )}
        </div>

        {/* Amount & Actions */}
        <div
          className="statement-card__actions"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}
        >
          <div style={{ textAlign: "right" }}>
            <span className="statement-card__amount" style={{ fontSize: 15, fontWeight: 800, color: "#0A1628", display: "block" }}>
              {fmt(totalDisplayAmount)}
            </span>
            {isPaid && (
              <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                Settled
              </span>
            )}
          </div>

          {!isPaid && (
            <button
              type="button"
              className="statement-card__pay-btn"
              onClick={() => onPaySingle(bill)}
              title="Pay this statement only"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#ffffff",
                color: "#0A1628",
                border: "1px solid #0A1628",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <CreditCard size={13} />
              Pay
            </button>
          )}

          <button
            type="button"
            className="statement-card__toggle-btn"
            onClick={onToggleOpen}
            aria-label={isOpen ? "Collapse breakdown" : "Expand breakdown"}
            style={{
              background: "none",
              border: "none",
              padding: 4,
              color: "#64748b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Accordion Body Breakdown */}
      {isOpen && (
        <div className="statement-card__body" style={{ padding: "0 20px 20px", borderTop: "1px solid #f1f5f9" }}>
          {/* Rent Breakdown */}
          {(summary.hasRentCharges || isInitialPayment) && (
            <div style={{ ...elecS.segmentCard, marginBottom: 16, marginTop: 12 }}>
              <div style={elecS.segmentHeader}>
                <span>Rental Statement Breakdown</span>
                <span style={{ fontWeight: 700 }}>{fmtMonth(bill.billingMonth)}</span>
              </div>
              <div style={{ padding: "0 16px" }}>
                <div style={elecS.tableHeader}>
                  <span style={{ ...elecS.tableHeaderCell, gridColumn: "span 2" }}>Charge Type</span>
                  <span style={{ ...elecS.tableHeaderCell, textAlign: "right" }}>Amount</span>
                </div>
                {isInitialPayment ? (
                  <>
                    {[
                      ["Advance Rent", initial.advanceRent],
                      ["Security Deposit", initial.securityDeposit],
                      ["Approved Initial Charges", initial.approvedInitialCharges],
                    ].map(([label, amount]) => (
                      <div style={elecS.tableRow2} key={label}>
                        <span style={elecS.tableCell2}>{label}</span>
                        <span style={{ ...elecS.tableCell2, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(amount)}
                        </span>
                      </div>
                    ))}
                    <div style={elecS.tableRow2}>
                      <span style={elecS.tableCell2}>Less: Reservation Fee Credit</span>
                      <span style={{ ...elecS.tableCell2, color: "#059669", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        -{fmt(initial.reservationFeeCredit)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={elecS.tableRow2}>
                    <span style={elecS.tableCell2}>Base Rent & Fees</span>
                    <span style={{ ...elecS.tableCell2, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {fmt(summary.rentAndFeesTotal)}
                    </span>
                  </div>
                )}

                {charges.penalty > 0 && (() => {
                  const daysLate = Number(bill.penaltyDetails?.daysLate || 0);
                  const ratePerDay = Number(bill.penaltyDetails?.ratePerDay || 0);
                  return (
                    <>
                      <div style={elecS.tableRow2}>
                        <span style={{ ...elecS.tableCell2, color: "#DC2626" }}>
                          Late Payment Penalty
                          {daysLate > 0 && ratePerDay > 0 && (
                            <span style={{ fontWeight: 400, fontSize: 11, color: "#ef4444", marginLeft: 4 }}>
                              ({daysLate}d × ₱{ratePerDay.toLocaleString("en-PH")}/day)
                            </span>
                          )}
                        </span>
                        <span style={{ ...elecS.tableCell2, color: "#DC2626", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(charges.penalty)}
                        </span>
                      </div>
                      <div style={{
                        display: "flex", alignItems: "flex-start", gap: 6,
                        padding: "8px 12px", margin: "4px 0 2px",
                        background: "#fef2f2", borderRadius: 8,
                        fontSize: 11, lineHeight: 1.5, color: "#991b1b",
                      }}>
                        <AlertCircle size={13} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>
                          {daysLate > 0 && ratePerDay > 0
                            ? `This bill is ${daysLate} day${daysLate === 1 ? "" : "s"} past due. A late fee of ₱${ratePerDay.toLocaleString("en-PH")} per day applies until settled.`
                            : "A late payment penalty has been applied to this bill."}
                        </span>
                      </div>
                    </>
                  );
                })()}

                {charges.discount > 0 && (
                  <div style={elecS.tableRow2}>
                    <span style={{ ...elecS.tableCell2, color: "#059669" }}>Applied Discount</span>
                    <span style={{ ...elecS.tableCell2, color: "#059669", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      -{fmt(charges.discount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Electricity Breakdown */}
          {summary.hasElectricityCharge && (
            <div style={{ marginBottom: 16 }}>
              {elecLoading ? (
                <div style={elecS.loadingRow}>
                  <Activity size={14} /> Loading electricity breakdown...
                </div>
              ) : resolvedElecData ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b", padding: "4px 0" }}>
                    <span>Rate: <strong style={{ color: "var(--text-heading)" }}>₱{resolvedElecData.ratePerKwh}/kWh</strong></span>
                    <span>Your Share: <strong style={{ color: "var(--text-heading)" }}>{fmtKwh(resolvedElecData.myTotalKwh)}</strong></span>
                    <span>Total Electricity Due: <strong style={{ color: "#d97706" }}>{fmt(summary.electricityTotal)}</strong></span>
                  </div>
                  {(resolvedElecData.segments || []).map((seg, i) => (
                    <ElectricityReferenceSegmentCard key={i} seg={seg} ratePerKwh={resolvedElecData.ratePerKwh} />
                  ))}
                  <ElectricityFinalBreakdownCard
                    data={resolvedElecData}
                    period={bill}
                    electricityAmount={summary.electricityTotal}
                  />
                </div>
              ) : (
                <div style={{ ...elecS.segmentCard, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>Electricity Charge</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#d97706" }}>{fmt(summary.electricityTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Water Breakdown */}
          {summary.hasWaterCharge && (
            <div style={{ marginBottom: 16 }}>
              {waterLoading ? (
                <div style={elecS.loadingRow}>
                  <Activity size={14} /> Loading water breakdown...
                </div>
              ) : resolvedWaterData?.record ? (
                <div style={elecS.segmentCard}>
                  <div style={elecS.segmentHeader}>
                    <span>Water Utility Breakdown</span>
                    <span>{resolvedWaterData.record.tenantsSharing} Occupants</span>
                  </div>
                  <div style={{ padding: "0 16px" }}>
                    <div style={elecS.tableRow2}>
                      <span style={elecS.tableCell2}>Total Room Usage</span>
                      <span style={{ ...elecS.tableCell2, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {Number(resolvedWaterData.record.usage || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })} units
                      </span>
                    </div>
                    <div style={elecS.tableRow2}>
                      <span style={elecS.tableCell2}>Rate per Unit</span>
                      <span style={{ ...elecS.tableCell2, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(resolvedWaterData.record.ratePerUnit)}
                      </span>
                    </div>
                    <div style={elecS.tableRow2}>
                      <span style={elecS.tableCell2}>Total Room Cost</span>
                      <span style={{ ...elecS.tableCell2, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(resolvedWaterData.record.roomTotal)}
                      </span>
                    </div>
                    <div style={{ ...elecS.segmentFooter, borderTop: "1px solid #f1f5f9", marginTop: 4 }}>
                      <span>Your Share</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{fmt(summary.waterTotal)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ ...elecS.segmentCard, padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>Water Utility Charge</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{fmt(summary.waterTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Download Statement Action */}
          <button
            type="button"
            style={s.downloadBtn}
            onClick={async () => {
              try {
                const { generateBillingPDF } = await import("../../../../shared/utils/pdfUtils");
                await generateBillingPDF(bill);
              } catch (error) {
                showNotification(error?.message || "Could not download this billing statement.", "error", 4000);
              }
            }}
          >
            <Download size={13} /> Download Statement (PDF)
          </button>

          {isPaid && (
            <button
              type="button"
              style={s.downloadBtn}
              onClick={async () => {
                try {
                  const { generateBillingReceipt } = await import("../../../../shared/utils/pdfReceipt");
                  await generateBillingReceipt(bill);
                } catch (error) {
                  showNotification(error?.message || "Could not download this payment receipt.", "error", 4000);
                }
              }}
            >
              <Receipt size={13} /> Download Payment Receipt (PDF)
            </button>
          )}

          {/* Paid banner */}
          {isPaid && bill.paymentDate && (
            <div style={s.paidInfo}>
              <CheckCircle size={14} color="#059669" />
              <span>
                Paid on {fmtDate(bill.paymentDate)}
                {bill.paymentMethod ? ` via ${formatPaymentMethod(bill.paymentMethod)}` : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main BillingTab Component ─────────────────────── */

export default function BillingTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all"); // all | unpaid | paid
  const [categoryFilter, setCategoryFilter] = useState("all"); // all | rent | electricity | water
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [expandedBillIds, setExpandedBillIds] = useState(new Set());
  const [payingOnline, setPayingOnline] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [billsToCheckout, setBillsToCheckout] = useState([]);
  const masterCheckboxRef = useRef(null);

  const [verifyingPayment, setVerifyingPayment] = useState(
    searchParams.get("payment") === "success" && Boolean(searchParams.get("session_id")),
  );

  // Load Bills
  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await billingApi.getMyBills();
      const loadedBills = data.bills || [];
      setBills(loadedBills);

      // Auto-expand unpaid bills by default
      const defaultExpanded = new Set();
      loadedBills.forEach((b) => {
        if (!isPaidBill(b)) {
          defaultExpanded.add(b.id || b._id);
        }
      });
      setExpandedBillIds(defaultExpanded);
    } catch (err) {
      console.error("Failed to load bills:", err);
      showNotification("Could not load your bills. Please refresh the page.", "error", 5000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // Handle PayMongo return redirect
  useEffect(() => {
    if (authLoading) return;

    const paymentStatus = searchParams.get("payment");
    const rawUrlSessionId = searchParams.get("session_id");
    const storedSessionId = sessionStorage.getItem("activeBillPaymongoSessionId");
    const urlSessionId = rawUrlSessionId === "{id}" ? null : rawUrlSessionId;
    const sessionId = urlSessionId || storedSessionId;

    if (paymentStatus === "success" && sessionId) {
      billingApi
        .checkPaymentStatus(sessionId)
        .then((result) => {
          if (result?.status === "paid" || result?.paid) {
            showNotification("Payment successful! Your statement balance has been settled.", "success", 5000);
            loadBills();
          } else if (result?.status === "unpaid") {
            showNotification("Payment was not completed. You can try again anytime.", "info", 4000);
          } else {
            showNotification("Payment is being verified. Refreshing records...", "info", 4000);
            loadBills();
          }
        })
        .catch((err) => {
          console.warn("[BILLING] Payment verification warning:", err);
          showNotification("Payment completed. Refreshing statements.", "success", 5000);
          loadBills();
        })
        .finally(() => {
          sessionStorage.removeItem("activeBillPaymongoSessionId");
          setVerifyingPayment(false);
        });
      setSearchParams({}, { replace: true });
    } else {
      sessionStorage.removeItem("activeBillPaymongoSessionId");
      setVerifyingPayment(false);
      if (paymentStatus === "cancelled") {
        showNotification("Payment was cancelled.", "info", 3000);
      }
      if (paymentStatus) {
        setSearchParams({}, { replace: true });
      }
    }
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculations
  const billSummaries = useMemo(
    () => bills.map((bill) => ({ bill, summary: getBillChargeSummary(bill) })),
    [bills],
  );

  const unpaidBillSummaries = useMemo(
    () => billSummaries.filter(({ bill }) => !isPaidBill(bill)),
    [billSummaries],
  );

  const unpaidBills = useMemo(
    () => unpaidBillSummaries.map(({ bill }) => bill).sort(sortBillsOldestFirst),
    [unpaidBillSummaries],
  );

  const totalUnpaidBalance = useMemo(
    () => roundMoney(unpaidBillSummaries.reduce((sum, { summary }) => sum + summary.remaining, 0)),
    [unpaidBillSummaries],
  );

  const unpaidRent = useMemo(
    () => roundMoney(unpaidBillSummaries.reduce((sum, { summary }) => sum + summary.outstandingBySection.rent, 0)),
    [unpaidBillSummaries],
  );

  const unpaidElec = useMemo(
    () => roundMoney(unpaidBillSummaries.reduce((sum, { summary }) => sum + summary.outstandingBySection.electricity, 0)),
    [unpaidBillSummaries],
  );

  const unpaidWater = useMemo(
    () => roundMoney(unpaidBillSummaries.reduce((sum, { summary }) => sum + summary.outstandingBySection.water, 0)),
    [unpaidBillSummaries],
  );

  const hasWaterBilling = useMemo(
    () => billSummaries.some(({ summary }) => summary.hasWaterCharge),
    [billSummaries],
  );

  // Combined Filtered Bills
  const filteredBills = useMemo(() => {
    return bills
      .filter((b) => {
        // 1. Status Filter
        if (statusFilter === "unpaid" && isPaidBill(b)) return false;
        if (statusFilter === "paid" && !isPaidBill(b)) return false;

        // 2. Category Filter
        if (categoryFilter === "rent") {
          const s = getBillChargeSummary(b);
          return (
            s.hasRentCharges ||
            b.billType === "initial_payment" ||
            b.billType === "monthly" ||
            (!b.charges?.electricity && !b.charges?.water)
          );
        }
        if (categoryFilter === "electricity") {
          const s = getBillChargeSummary(b);
          return (
            s.hasElectricityCharge ||
            b.billType === "electricity" ||
            Boolean(b.utilityBreakdowns?.electricity)
          );
        }
        if (categoryFilter === "water") {
          const s = getBillChargeSummary(b);
          return (
            s.hasWaterCharge ||
            b.billType === "water" ||
            Boolean(b.utilityBreakdowns?.water)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (statusFilter === "unpaid") return sortBillsOldestFirst(a, b);
        return getBillSortTimestamp(b) - getBillSortTimestamp(a);
      });
  }, [bills, statusFilter, categoryFilter]);

  // Selection Logic
  const allUnpaidSelected =
    unpaidBills.length > 0 &&
    unpaidBills.every((b) => selectedBillIds.includes(b.id || b._id));

  const isIndeterminate =
    selectedBillIds.length > 0 && !allUnpaidSelected;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleToggleSelectAll = () => {
    if (allUnpaidSelected) {
      setSelectedBillIds([]);
    } else {
      setSelectedBillIds(unpaidBills.map((b) => b.id || b._id));
    }
  };

  const handleToggleSelectBill = (id) => {
    setSelectedBillIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleCategory = (categoryBills) => {
    const categoryUnpaidIds = categoryBills
      .filter((b) => !isPaidBill(b))
      .map((b) => b.id || b._id);
    const allSelected = categoryUnpaidIds.every((id) => selectedBillIds.includes(id));

    if (allSelected) {
      setSelectedBillIds((prev) => prev.filter((id) => !categoryUnpaidIds.includes(id)));
    } else {
      setSelectedBillIds((prev) => Array.from(new Set([...prev, ...categoryUnpaidIds])));
    }
  };

  const handleToggleOpenCard = (id) => {
    setExpandedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selected Total
  const selectedBills = useMemo(
    () => unpaidBills.filter((b) => selectedBillIds.includes(b.id || b._id)),
    [unpaidBills, selectedBillIds],
  );

  const selectedTotal = useMemo(
    () => roundMoney(selectedBills.reduce((sum, b) => sum + getOutstandingAmount(b), 0)),
    [selectedBills],
  );

  // Checkout Triggers
  const handleOpenReviewForSelected = () => {
    if (selectedBills.length === 0) {
      showNotification("Please select at least one unpaid statement to pay.", "info");
      return;
    }
    setBillsToCheckout(selectedBills);
    setIsReviewModalOpen(true);
  };

  const handleOpenReviewForSingle = (bill) => {
    setBillsToCheckout([bill]);
    setIsReviewModalOpen(true);
  };

  const handleOpenReviewForCategory = (categoryBills) => {
    const targetBills = categoryBills.filter((b) => !isPaidBill(b));
    if (targetBills.length === 0) {
      showNotification("All statements in this category are already settled.", "info");
      return;
    }
    setBillsToCheckout(targetBills);
    setIsReviewModalOpen(true);
  };

  const handleOpenReviewForAll = () => {
    if (unpaidBills.length === 0) {
      showNotification("You have no unpaid statements.", "info");
      return;
    }
    setBillsToCheckout(unpaidBills);
    setIsReviewModalOpen(true);
  };

  // Execute PayMongo Checkout (from Modal)
  const handleExecuteCheckout = async (targetBills) => {
    try {
      setPayingOnline(true);
      const validIds = targetBills.map((b) => b.id || b._id);

      let checkoutUrl, sessionId;
      if (validIds.length === 1) {
        const res = await billingApi.createCheckout(validIds[0]);
        checkoutUrl = res.checkoutUrl;
        sessionId = res.sessionId;
      } else {
        const res = await billingApi.createBatchCheckout(validIds);
        checkoutUrl = res.checkoutUrl;
        sessionId = res.sessionId;
      }

      if (sessionId) {
        sessionStorage.setItem("activeBillPaymongoSessionId", sessionId);
      }

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No checkout URL returned from payment server.");
      }
    } catch (err) {
      console.error("PayMongo Checkout error:", err);
      const errCode = err?.response?.data?.error?.code || err?.code;
      if (errCode === "ALREADY_PAID") {
        showNotification("Selected statement is already settled! Refreshing...", "success", 4000);
        loadBills();
        setIsReviewModalOpen(false);
      } else {
        showNotification(
          err?.response?.data?.error || err.message || "Failed to start online payment checkout.",
          "error",
          4000,
        );
      }
      setPayingOnline(false);
    }
  };

  if (loading || verifyingPayment) {
    return <BillingPageSkeleton />;
  }

  return (
    <div className="tenant-billing">
      {/* 1. Account Summary Ledger Hero with Category Breakdown Tray (Option A) */}
      <StatementLedgerHero
        totalBalance={totalUnpaidBalance}
        unpaidRent={unpaidRent}
        unpaidElec={unpaidElec}
        unpaidWater={unpaidWater}
        hasWaterBilling={hasWaterBilling}
        unpaidCount={unpaidBills.length}
        onPayAll={handleOpenReviewForAll}
        bills={bills}
        selectedBillIds={selectedBillIds}
        onToggleSelectBill={handleToggleSelectBill}
        onToggleCategory={handleToggleCategory}
        onPayCategory={handleOpenReviewForCategory}
        onPaySingle={handleOpenReviewForSingle}
      />

      {/* 2. Dual Filter Toolbar (Status & Clickable Category Dropdown) */}
      <StatementFilters
        bills={bills}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        hasWaterBilling={hasWaterBilling}
      />

      {/* 3. Selection Toolbar (only when unpaid statements exist and not viewing paid history) */}
      {unpaidBills.length > 0 && statusFilter !== "paid" && (
        <div
          className="ledger-selection-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "12px 16px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <label
            className="ledger-select-all-label"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 600,
              color: "#0A1628",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              ref={masterCheckboxRef}
              className="ledger-custom-checkbox"
              checked={allUnpaidSelected}
              onChange={handleToggleSelectAll}
              aria-label="Select all unpaid statements"
              style={{
                width: 18,
                height: 18,
                accentColor: "#0A1628",
                cursor: "pointer",
              }}
            />
            <span>Select All Unpaid Invoices ({unpaidBills.length})</span>
          </label>

          <div
            className="ledger-selection-actions"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {selectedBillIds.length > 0 && (
              <div
                className="ledger-selected-summary"
                style={{ fontSize: 13, color: "#64748b" }}
              >
                Selected: <strong style={{ color: "#0A1628" }}>{selectedBillIds.length}</strong> invoice{selectedBillIds.length === 1 ? "" : "s"} • <strong style={{ color: "#0A1628" }}>{fmt(selectedTotal)}</strong>
              </div>
            )}

            <button
              type="button"
              className="btn-review-pay"
              onClick={handleOpenReviewForSelected}
              disabled={selectedBillIds.length === 0 || payingOnline}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#0A1628",
                color: "#ffffff",
                border: "1px solid transparent",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: selectedBillIds.length === 0 || payingOnline ? "not-allowed" : "pointer",
                opacity: selectedBillIds.length === 0 || payingOnline ? 0.5 : 1,
              }}
            >
              <CreditCard size={15} />
              Review & Pay Selected ({fmt(selectedTotal)})
            </button>
          </div>
        </div>
      )}

      {/* 4. Unified Statement Stream */}
      {filteredBills.length === 0 ? (
        <div style={s.emptyState}>
          <CreditCard size={40} color="#D1D5DB" />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "16px 0 8px" }}>
            {categoryFilter !== "all"
              ? `No ${categoryFilter === "rent" ? "Rent" : categoryFilter === "electricity" ? "Electricity" : "Water"} statements found`
              : statusFilter === "unpaid"
                ? "No unpaid statements found"
                : statusFilter === "paid"
                  ? "No paid history records found"
                  : "No statements found"}
          </h3>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#94a3b8", maxWidth: 420 }}>
            {categoryFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters above to see more statement records."
              : "Rent and utility statements will appear here once issued by management. All payments are recorded into your permanent ledger."}
          </p>
          {(categoryFilter !== "all" || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setCategoryFilter("all");
              }}
              style={{
                marginTop: 14,
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredBills.map((bill) => {
            const billId = bill.id || bill._id;
            return (
              <StatementLedgerCard
                key={billId}
                bill={bill}
                isSelected={selectedBillIds.includes(billId)}
                onToggleSelect={handleToggleSelectBill}
                onPaySingle={handleOpenReviewForSingle}
                isOpen={expandedBillIds.has(billId)}
                onToggleOpen={() => handleToggleOpenCard(billId)}
              />
            );
          })}
        </div>
      )}

      {/* 5. Floating Checkout Dock (visible on mobile / scroll when items selected) */}
      {selectedBillIds.length > 0 && !isReviewModalOpen && (
        <div className="floating-checkout-dock">
          <div className="floating-checkout-dock__info">
            <span className="floating-checkout-dock__badge">{selectedBillIds.length} Selected</span>
            <span className="floating-checkout-dock__amount">{fmt(selectedTotal)}</span>
          </div>
          <button
            type="button"
            className="floating-checkout-dock__btn"
            onClick={handleOpenReviewForSelected}
            disabled={payingOnline}
          >
            <CreditCard size={14} />
            Review & Pay
          </button>
        </div>
      )}

      {/* 6. Pre-Checkout Review Modal (Choice 2: B) */}
      <PreCheckoutModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        billsToPay={billsToCheckout}
        onConfirm={handleExecuteCheckout}
        isSubmitting={payingOnline}
      />
    </div>
  );
}

/* ── Inline Styles for Breakdowns & Components ──────── */

const dash = {
  wrapper: {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
    marginBottom: 24,
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 18,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: 800,
    color: "#0A1628",
    lineHeight: 1.1,
  },
  allCaughtUpBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: "#059669",
    background: "#ecfdf5",
    padding: "4px 10px",
    borderRadius: 20,
    border: "1px solid #a7f3d0",
  },
  unpaidBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: "#d97706",
    background: "#fffbeb",
    padding: "4px 10px",
    borderRadius: 20,
    border: "1px solid #fcd34d",
  },
  payAllBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#0A1628",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "12px 22px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  chipsContainer: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    padding: "12px 16px",
    background: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #f1f5f9",
  },
  chipItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#64748b",
  },
  chipDivider: {
    width: 1,
    height: 18,
    background: "#e2e8f0",
  },
  trayEmptyBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "28px 16px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
  },
  trayAllCaughtUpBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: 8,
    fontSize: 13,
    color: "#065f46",
    fontWeight: 600,
  },
};

const s = {
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 20,
    border: "1px solid #E5E7EB",
    background: "#fff",
    color: "var(--text-secondary, #4b5563)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  chipActive: {
    background: "#0A1628",
    color: "#fff",
    border: "1px solid #0A1628",
  },
  chipCount: {
    background: "rgba(255,255,255,0.2)",
    padding: "1px 7px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  downloadBtn: {
    width: "100%",
    padding: "10px 0",
    background: "#f8fafc",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  paidInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    fontSize: 12,
    color: "#059669",
    fontWeight: 600,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "50px 24px",
    background: "#fff",
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
  },
};

const elecS = {
  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#64748b",
    padding: "16px",
    justifyContent: "center",
  },
  segmentCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  segmentHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 16px",
    background: "#0A1628",
    color: "#fff",
    fontSize: 13,
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    padding: "8px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  tableHeaderCell: { fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" },
  tableRow2: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    padding: "8px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  tableCell2: { fontSize: 13, color: "#475569" },
  segmentFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0 16px",
    color: "#FF8C42",
    fontSize: 13,
  },
  referenceCard: {
    background: "#fffdf7",
    border: "1px solid #ead7bc",
    borderRadius: 10,
    padding: "12px",
  },
  referenceIntro: {
    fontSize: 13,
    color: "#334155",
    marginBottom: 8,
  },
  referenceTable: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  referenceSectionCell: {
    background: "#f7e3c8",
    fontWeight: 700,
  },
  referenceHeaderCell: {
    border: "1px solid #7c6b58",
    background: "#f3f4f6",
    color: "#1e293b",
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 8px",
    textAlign: "center",
  },
  referenceSpacerCell: {
    border: "1px solid #7c6b58",
    background: "#f9fafb",
    padding: "6px 8px",
  },
  referenceLabelCell: {
    border: "1px solid #7c6b58",
    color: "#1f2937",
    fontSize: 13,
    padding: "6px 8px",
  },
  referenceValueCell: {
    border: "1px solid #7c6b58",
    color: "#111827",
    fontSize: 13,
    padding: "6px 8px",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  finalBreakdownCard: {
    border: "1px solid #f1e2c8",
    borderRadius: 10,
    background: "#fffaf0",
    overflow: "hidden",
  },
  finalBreakdownHeader: {
    padding: "10px 12px",
    background: "#f7e3c8",
    color: "#7c2d12",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  finalBreakdownBody: {
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  finalBreakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  finalBreakdownLabel: {
    color: "#475569",
    fontSize: 13,
  },
  finalBreakdownValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  finalBreakdownFooter: {
    borderTop: "1px solid #f1e2c8",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#7c2d12",
    fontSize: 13,
    fontWeight: 700,
  },
  finalBreakdownTotal: {
    color: "#9a3412",
    fontSize: 16,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  },
};
