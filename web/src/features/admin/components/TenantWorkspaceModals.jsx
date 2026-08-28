import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRooms } from "../../../shared/hooks/queries/useRooms";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import { formatBranch } from "../utils/formatters";
import { resolveDepositFromPaymentInfo } from "../../../shared/utils/depositUtils";
import { formatBedPosition, getBedDisplayLabel, getBedShortCode } from "../../../shared/utils/bedIdentifier";
import { reservationApi } from "../../../shared/api/reservationApi";
import { contractApi } from "../../../shared/api/contractApi";
import { showNotification } from "../../../shared/utils/notification";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import {
  Clock,
  History,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
  LogOut,
  LoaderCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  Upload,
  Printer,
  FileCheck2,
  Info,
} from "lucide-react";

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const fmtMoney = (value) =>
  typeof value === "number"
    ? `PHP ${value.toLocaleString(undefined, {
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })}`
    : "—";

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

function TenantModalShell({ open, title, children, footer, onClose }) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="tenant-workspace-modal__overlay" onClick={onClose}>
      <div
        className="tenant-workspace-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tenant-workspace-modal__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="tenant-workspace-modal__close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="tenant-workspace-modal__body">{children}</div>
        {footer ? <div className="tenant-workspace-modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function RenewLeaseModal({
  open,
  tenant,
  detail,
  context,
  loading,
  onClose,
  onSubmit,
  onOfferSubmit,
}) {
  const [mode, setMode] = useState("direct"); // "direct" or "offer"
  const [selectedDuration, setSelectedDuration] = useState(6); // 1, 3, 6, 12, or "custom"
  const [newLeaseStartDate, setNewLeaseStartDate] = useState("");
  const [newLeaseEndDate, setNewLeaseEndDate] = useState("");
  const [offerMonths, setOfferMonths] = useState(6);
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  // Canonical room-type + duration pricing, resolved server-side from the
  // SAME resolver createRenewalOffer itself uses — never computed here.
  // proposedRent is not user-editable: custom/negotiated renewal pricing is
  // not a supported workflow (see server tenancyActionsController.js).
  const [pricingPreview, setPricingPreview] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState(null);
  const [showOfferConfirm, setShowOfferConfirm] = useState(false);

  const currentEndRaw =
    context?.currentStay?.leaseEndDate ||
    detail?.leaseInfo?.leaseEndDate ||
    tenant?.leaseEndDate;

  const calculateTargetEnd = (months) => {
    const base = currentEndRaw ? new Date(currentEndRaw) : new Date();
    const validBase = isNaN(base.getTime()) ? new Date() : base;
    const target = new Date(validBase);
    target.setMonth(target.getMonth() + Number(months));
    return toDateInputValue(target);
  };

  useEffect(() => {
    if (!open) return;

    const base = currentEndRaw ? new Date(currentEndRaw) : new Date();
    const validBase = isNaN(base.getTime()) ? new Date() : base;
    const nextStart = new Date(validBase);
    nextStart.setDate(nextStart.getDate() + 1);

    const initialEnd = calculateTargetEnd(6);

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 14);

    setNewLeaseStartDate(toDateInputValue(nextStart));
    setNewLeaseEndDate(initialEnd);
    setSelectedDuration(6);
    setOfferMonths(6);
    setExpiresAt(toDateInputValue(expiry));
    setNotes("");
    setMode("direct");
    setPricingPreview(null);
    setPricingError(null);
  }, [open, detail, context, tenant, currentEndRaw]);

  // Fetch the canonical pricing preview whenever the offer duration changes
  // — the admin never types a rate; the backend resolves it from room type
  // + duration (resolveAuthoritativeLeasePricing), the same resolver that
  // creates the offer and later the successor Contract.
  useEffect(() => {
    if (!open || mode !== "offer" || !tenant?.reservationId) return;
    const months = Number(offerMonths);
    if (!Number.isFinite(months) || months < 1 || months > 12) {
      setPricingPreview(null);
      setPricingError(months > 12 ? "Renewal offers support 1–12 months." : null);
      return;
    }
    let cancelled = false;
    setPricingLoading(true);
    setPricingError(null);
    reservationApi
      .previewRenewalPricing(tenant.reservationId, months)
      .then((data) => {
        if (!cancelled) setPricingPreview(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setPricingPreview(null);
          setPricingError(err?.message || "Could not resolve pricing for this room/duration.");
        }
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, offerMonths, tenant?.reservationId]);

  const handleSelectDuration = (months) => {
    if (months === "custom") {
      setSelectedDuration("custom");
      return;
    }
    const durationNum = Number(months);
    setSelectedDuration(durationNum);
    const newEnd = calculateTargetEnd(durationNum);
    setNewLeaseEndDate(newEnd);
    setOfferMonths(durationNum);
  };

  const handleDateChange = (val) => {
    setNewLeaseEndDate(val);
    setSelectedDuration("custom");
  };

  const extensionHistory =
    context?.renewalHistory || detail?.leaseInfo?.extensionHistory || [];

  const submitOffer = () => {
    if (onOfferSubmit) {
      onOfferSubmit({
        months: Number(offerMonths) || 6,
        expiresAt,
        notes,
      });
    }
    setShowOfferConfirm(false);
  };

  const handleConfirm = () => {
    if (mode === "offer") {
      setShowOfferConfirm(true);
    } else {
      onSubmit({ newLeaseStartDate, newLeaseEndDate, notes });
    }
  };

  return (
    <TenantModalShell
      open={open}
      title={`Extend Reservation • ${tenant?.tenantName || detail?.basicInfo?.tenantName || "Tenant"}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--primary"
            disabled={
              loading ||
              (mode === "direct" && !newLeaseEndDate) ||
              (mode === "offer" && (pricingLoading || !pricingPreview))
            }
            onClick={handleConfirm}
          >
            {loading ? (
              <>
                <LoaderCircle className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : mode === "offer" ? (
              "Send Extension Offer"
            ) : (
              "Extend Reservation"
            )}
          </button>
        </>
      }
    >
      <div className="flex gap-2.5 mb-5">
        <button
          type="button"
          className={`flex-1 py-2 px-3.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer text-center ${
            mode === "direct"
              ? "border-primary bg-primary text-primary-foreground shadow-xs"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          onClick={() => setMode("direct")}
        >
          Direct Extension
        </button>
        <button
          type="button"
          className={`flex-1 py-2 px-3.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer text-center ${
            mode === "offer"
              ? "border-primary bg-primary text-primary-foreground shadow-xs"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          onClick={() => setMode("offer")}
        >
          Send Extension Offer
        </button>
      </div>

      {/* Duration Preset Selector */}
      <div className="mb-5 space-y-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
          Extended Term Duration
        </span>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "+1 Month", value: 1 },
            { label: "+3 Months", value: 3 },
            { label: "+6 Months", value: 6 },
            { label: "+1 Year", value: 12 },
            { label: "Custom", value: "custom" },
          ].map((opt) => {
            const isSelected = selectedDuration === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer text-center ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                    : "border-border bg-card text-foreground hover:bg-muted hover:border-border-strong"
                }`}
                onClick={() => handleSelectDuration(opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Extension Preview Card */}
      <div className="bg-muted/40 border border-border/80 rounded-xl p-3.5 mb-5 flex items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="text-[11px] text-muted-foreground font-medium">Current End Date</div>
          <div className="text-sm text-foreground font-bold">{fmtDate(currentEndRaw)}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground font-medium">New Extended End Date</div>
          <div className="text-sm text-foreground font-bold">
            {mode === "offer" ? `+${offerMonths} Months from end` : fmtDate(newLeaseEndDate)}
          </div>
        </div>
      </div>

      {mode === "direct" ? (
        <div className="tenant-modal-grid">
          <label className="tenant-modal-field">
            <span>Current Reservation End</span>
            <input
              type="text"
              value={fmtDate(currentEndRaw)}
              readOnly
              className="bg-muted/50"
            />
          </label>
          <label className="tenant-modal-field">
            <span>New Extended End Date</span>
            <input
              type="date"
              value={newLeaseEndDate}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <div className="tenant-modal-grid">
          <label className="tenant-modal-field">
            <span>Offer Extension (Months)</span>
            <select
              value={offerMonths}
              onChange={(e) => {
                const val = Number(e.target.value);
                setOfferMonths(val);
                handleSelectDuration(val);
              }}
            >
              <option value={1}>1 Month</option>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months (1 Year)</option>
            </select>
          </label>
          <label className="tenant-modal-field">
            <span>Offer Expiry Date</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
        </div>
      )}

      {mode === "offer" && (
        <div className="bg-muted/40 border border-border/80 rounded-xl p-3.5 mb-5 space-y-1.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Canonical Renewal Pricing
          </div>
          {pricingLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> Resolving pricing…
            </div>
          ) : pricingError ? (
            <div className="text-xs text-destructive">{pricingError}</div>
          ) : pricingPreview ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Room Type</span>
                <span className="font-semibold text-foreground capitalize">
                  {String(pricingPreview.roomType || "").replace(/-/g, " ")}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pricing Tier</span>
                <span className="font-semibold text-foreground">
                  {pricingPreview.pricingTier === "long_term" ? "Long Term" : "Short Term"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Regular Monthly Rate</span>
                <span className="text-foreground">{fmtMoney(pricingPreview.regularMonthlyRate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-foreground">{pricingPreview.discountPercentage || 0}%</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-border/60">
                <span className="font-semibold text-foreground">Final Monthly Rate</span>
                <span className="font-bold text-primary">{fmtMoney(pricingPreview.finalMonthlyRate)}</span>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">Select a duration to resolve pricing.</div>
          )}
        </div>
      )}

      <label className="tenant-modal-field">
        <span>Notes / Message to Tenant</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={mode === "offer" ? "Message for tenant in extension offer notification..." : "Optional stay extension notes..."}
        />
      </label>

      <div className="mt-5 space-y-2.5">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Extension History
        </h4>
        {extensionHistory.length === 0 ? (
          <div className="bg-muted/20 border border-dashed border-border rounded-xl p-4 text-center text-muted-foreground text-xs space-y-1">
            <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 mx-auto mb-1 block" />
            No previous stay extensions recorded for this tenant.
          </div>
        ) : (
          <div className="space-y-2">
            {extensionHistory.map((entry, idx) => {
              const startDate = entry.leaseStartDate ? fmtDate(entry.leaseStartDate) : null;
              const endDate = entry.leaseEndDate ? fmtDate(entry.leaseEndDate) : null;
              
              let durationText = null;
              if (entry.addedMonths) {
                durationText = `+${entry.addedMonths} Month${entry.addedMonths === 1 ? "" : "s"}`;
              } else if (entry.leaseStartDate && entry.leaseEndDate) {
                const start = new Date(entry.leaseStartDate);
                const end = new Date(entry.leaseEndDate);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  const diffMonths = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.4375)));
                  durationText = `${diffMonths} Month${diffMonths === 1 ? "" : "s"} Stay`;
                }
              }

              const dateRangeText = startDate && endDate
                ? `${startDate} – ${endDate}`
                : entry.extendedAt
                ? fmtDate(entry.extendedAt)
                : `Stay Term #${idx + 1}`;

              const statusBadge = entry.status ? String(entry.status).toUpperCase() : "EXTENDED";

              return (
                <div
                  key={entry.id || idx}
                  className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
                      <History className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {dateRangeText}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {entry.notes ? entry.notes : `Term #${idx + 1} • ${statusBadge}`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {durationText && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-foreground border border-border/80">
                        {durationText}
                      </span>
                    )}
                    {entry.monthlyRent ? (
                      <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                        {fmtMoney(entry.monthlyRent)}/mo
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={showOfferConfirm}
        onClose={() => setShowOfferConfirm(false)}
        onConfirm={submitOffer}
        loading={loading}
        variant="info"
        title="Create Renewal Offer?"
        confirmText="Create Offer"
        message={
          pricingPreview
            ? `${String(pricingPreview.roomType || "").replace(/-/g, " ")} • ${offerMonths} month${offerMonths === 1 ? "" : "s"} (${pricingPreview.pricingTier === "long_term" ? "Long Term" : "Short Term"}) • Regular ${fmtMoney(pricingPreview.regularMonthlyRate)} → Final ${fmtMoney(pricingPreview.finalMonthlyRate)} (${pricingPreview.discountPercentage || 0}% off). The tenant will be offered this exact rate.`
            : "The tenant will be offered the canonical rate resolved above."
        }
      />
    </TenantModalShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shared helper: Wizard Step Indicator
   ───────────────────────────────────────────────────────────────────────────── */
function WizardStepper({ steps, currentStep }) {
  return (
    <div className="twm-stepper">
      {steps.map((label, i) => {
        const num = i + 1;
        const state = num < currentStep ? "done" : num === currentStep ? "active" : "idle";
        return (
          <div key={num} className={`twm-step twm-step--${state}`}>
            <div className="twm-step__num">{state === "done" ? "✓" : num}</div>
            <span className="twm-step__label">{label}</span>
            {i < steps.length - 1 && <div className="twm-step__line" />}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Searchable Room Dropdown Component
   ───────────────────────────────────────────────────────────────────────────── */
function SearchableRoomSelect({ rooms, value, onChange, disabled, placeholder = "Select a room...", fmtMoney, isInvalid }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  const selectedRoom = useMemo(
    () => rooms.find((r) => String(r._id || r.id) === String(value)),
    [rooms, value],
  );

  useEffect(() => {
    if (!isOpen) {
      if (selectedRoom) {
        setSearchTerm(
          `${selectedRoom.name || selectedRoom.roomNumber} (${fmtMoney(selectedRoom.monthlyPrice || selectedRoom.price)})`,
        );
      } else {
        setSearchTerm("");
      }
    }
  }, [value, selectedRoom, isOpen, fmtMoney]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRooms = useMemo(() => {
    const selectedLabel = selectedRoom
      ? `${selectedRoom.name || selectedRoom.roomNumber} (${fmtMoney(selectedRoom.monthlyPrice || selectedRoom.price)})`
      : "";
    if (!searchTerm || (selectedRoom && searchTerm === selectedLabel)) {
      return rooms;
    }
    const q = searchTerm.toLowerCase().trim();
    return rooms.filter((r) => {
      const name = String(r.name || r.roomNumber || "").toLowerCase();
      const price = String(r.monthlyPrice || r.price || "").toLowerCase();
      const floor = String(r.floor || "").toLowerCase();
      return name.includes(q) || price.includes(q) || floor.includes(q);
    });
  }, [rooms, searchTerm, selectedRoom, fmtMoney]);

  return (
    <div className="twm-search-select" ref={containerRef}>
      <div className="twm-search-select__input-wrap">
        <input
          type="text"
          className={`twm-search-select__input ${isInvalid ? "tenant-modal-field--invalid" : ""}`}
          placeholder={disabled ? "Loading available rooms..." : placeholder}
          value={searchTerm}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
        />
        <span className={`twm-search-select__arrow ${isOpen ? "twm-search-select__arrow--open" : ""}`}>
          ▼
        </span>
      </div>

      {isOpen && !disabled && (
        <div className="twm-search-select__dropdown">
          {filteredRooms.length === 0 ? (
            <div className="twm-search-select__empty">No matching rooms found</div>
          ) : (
            filteredRooms.map((room) => {
              const rId = String(room._id || room.id);
              const isSelected = String(value) === rId;
              const hasAvail =
                Array.isArray(room.beds) &&
                room.beds.some(
                  (b) => b.status === "available" || (b.status === undefined && b.available !== false),
                );
              const roomLabel = `${room.name || room.roomNumber} (${fmtMoney(room.monthlyPrice || room.price)})`;

              return (
                <div
                  key={rId}
                  className={`twm-search-select__option ${isSelected ? "twm-search-select__option--selected" : ""} ${!hasAvail ? "twm-search-select__option--disabled" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasAvail) {
                      showNotification(
                        `Room ${room.name || room.roomNumber} has no available beds.`,
                        "warning",
                      );
                      return;
                    }
                    onChange(rId);
                    setIsOpen(false);
                    if (containerRef.current) {
                      const inputEl = containerRef.current.querySelector("input");
                      if (inputEl) inputEl.blur();
                    }
                  }}
                >
                  <span style={{ fontWeight: isSelected ? 700 : 500 }}>{roomLabel}</span>
                  <span
                    className={`twm-search-select__badge ${
                      hasAvail ? "twm-search-select__badge--avail" : "twm-search-select__badge--full"
                    }`}
                  >
                    {hasAvail ? "Available" : "Full"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Transfer Tenant Modal — 3-Step Guided Wizard
   Step 1: Target Room & Paperwork (Select room/bed, calculate financial summary, prepare replacement contract)
   Step 2: Sign & Upload Contract (Download draft, upload wet-signed/notarized PDF, verify)
   Step 3: Meter Readings & Review (Departure/destination kWh meters, live settlement, confirm transfer)
   ───────────────────────────────────────────────────────────────────────────── */
export function TransferTenantModal({
  open,
  tenant,
  detail,
  loading,
  onClose,
  onSubmit,
  sourceRoomLatestReading,
  electricityRatePerUnit,
}) {
  const branch = detail?.basicInfo?.branch || tenant?.branch || "";
  const { data: roomsData = [], isLoading: roomsLoading } = useRooms(
    open && branch ? { branch } : {},
  );
  const rooms = Array.isArray(roomsData) ? roomsData : roomsData.rooms || [];

  // ── Wizard step state ─────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [attemptedStep1, setAttemptedStep1] = useState(false);
  const [attemptedStep3, setAttemptedStep3] = useState(false);

  // ── Step 1 Form state (Target Room & Paperwork) ───────────────────────────
  const [roomId, setRoomId] = useState("");
  const [bedId, setBedId] = useState("");
  const [effectiveTransferDate, setEffectiveTransferDate] = useState("");
  const [forceOverride, setForceOverride] = useState(false);
  const [preparingContract, setPreparingContract] = useState(false);
  const [preparedContractId, setPreparedContractId] = useState(null);
  const [preparedContractNumber, setPreparedContractNumber] = useState(null);
  const [contractStatus, setContractStatus] = useState("draft");
  const [contractIncomplete, setContractIncomplete] = useState(false);

  // ── Step 2 Form state (Sign & Upload Contract) ────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [downloadingDraft, setDownloadingDraft] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contractUploaded, setContractUploaded] = useState(false);

  // ── Step 3 Form state (Meter Readings & Review) ───────────────────────────
  const [sourceRoomMeterReading, setSourceRoomMeterReading] = useState("");
  const [targetRoomMeterReading, setTargetRoomMeterReading] = useState("");
  const [reason, setReason] = useState("Room transfer");
  const [targetRoomBaseline, setTargetRoomBaseline] = useState(null);
  const [targetBaselineLoading, setTargetBaselineLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Cancellation & confirmation tracking ──────────────────────────────────
  const transferConfirmedRef = useRef(false);
  const preparedContractIdRef = useRef(null);

  useEffect(() => {
    preparedContractIdRef.current = preparedContractId;
  }, [preparedContractId]);

  const outstandingBalance = Number(detail?.billingInfo?.currentBalance || 0);
  const hasOutstanding = outstandingBalance > 0;

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setAttemptedStep1(false);
    setAttemptedStep3(false);
    setRoomId("");
    setBedId("");
    setEffectiveTransferDate(new Date().toISOString().slice(0, 10));
    setForceOverride(false);
    setPreparingContract(false);
    setPreparedContractId(null);
    setPreparedContractNumber(null);
    setContractStatus("draft");
    setContractIncomplete(false);
    setSelectedFile(null);
    setDownloadingDraft(false);
    setUploadingContract(false);
    setContractUploaded(false);
    setReason("Room transfer");
    setTargetRoomBaseline(null);
    setTargetRoomMeterReading("");
    transferConfirmedRef.current = false;
    preparedContractIdRef.current = null;
    setSourceRoomMeterReading(
      sourceRoomLatestReading?.reading != null
        ? String(sourceRoomLatestReading.reading)
        : "",
    );
  }, [open, sourceRoomLatestReading]);

  // ── Fetch target room baseline when room changes ───────────────────────────
  const fetchTargetBaseline = useCallback(async (selectedRoomId) => {
    if (!selectedRoomId) {
      setTargetRoomBaseline(null);
      setTargetRoomMeterReading("");
      return;
    }
    setTargetBaselineLoading(true);
    try {
      const result = await reservationApi.getRoomMeterBaseline(selectedRoomId);
      const baseline = result?.data?.latestReading ?? result?.latestReading ?? null;
      setTargetRoomBaseline(baseline);
      setTargetRoomMeterReading(
        baseline?.reading != null ? String(baseline.reading) : "",
      );
    } catch {
      setTargetRoomBaseline(null);
      setTargetRoomMeterReading("");
    } finally {
      setTargetBaselineLoading(false);
    }
  }, []);

  // ── Derived room / bed data ───────────────────────────────────────────────
  const currentRoomType =
    detail?.roomInfo?.type ||
    detail?.roomInfo?.roomType ||
    detail?.basicInfo?.roomType ||
    tenant?.roomType ||
    tenant?.roomId?.type ||
    "";
  const targetRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          String(r._id || r.id) !== String(tenant?.roomId) &&
          (!currentRoomType || (r.type || r.roomType) === currentRoomType),
      ),
    [rooms, tenant?.roomId, currentRoomType],
  );
  const selectedRoom = targetRooms.find(
    (r) => String(r._id || r.id) === String(roomId),
  );
  const roomBeds = selectedRoom?.beds || [];
  const currentPrice = Number(detail?.basicInfo?.monthlyRent || tenant?.monthlyRent || 0);
  const newPrice = Number(selectedRoom?.monthlyPrice || selectedRoom?.price || 0);
  const priceDiff = newPrice - currentPrice;

  const securityDeposit =
    resolveDepositFromPaymentInfo(
      detail?.paymentInfo || tenant?.paymentInfo || tenant?.deposit,
    ) || Number(detail?.billingInfo?.securityDeposit || tenant?.securityDeposit || 0);

  // ── Meter delta & anomaly guards ──────────────────────────────────────────
  const sourceBaseline = sourceRoomLatestReading?.reading != null
    ? Number(sourceRoomLatestReading.reading)
    : null;
  const sourceEntered = sourceRoomMeterReading !== "" ? Number(sourceRoomMeterReading) : null;
  const sourceDelta = sourceBaseline !== null && sourceEntered !== null
    ? sourceEntered - sourceBaseline
    : null;
  const sourceBelowBaseline = sourceDelta !== null && sourceDelta < 0;

  const targetBaseline = targetRoomBaseline?.reading != null
    ? Number(targetRoomBaseline.reading)
    : null;
  const targetEntered = targetRoomMeterReading !== "" ? Number(targetRoomMeterReading) : null;
  const targetBelowBaseline = targetBaseline !== null && targetEntered !== null && targetEntered < targetBaseline;

  // ── Live settlement preview math ──────────────────────────────────────────
  const cycleStart = detail?.billingInfo?.cycleStart || detail?.billingInfo?.billingCycleStart || null;
  const transferDateObj = effectiveTransferDate ? new Date(effectiveTransferDate) : new Date();
  const daysInMonth = new Date(
    transferDateObj.getFullYear(),
    transferDateObj.getMonth() + 1,
    0,
  ).getDate();
  const daysSinceCycleStart = cycleStart
    ? Math.max(1, Math.ceil((transferDateObj - new Date(cycleStart)) / 86400000))
    : null;
  const proRataPreview =
    daysSinceCycleStart != null && currentPrice > 0
      ? Math.round((currentPrice / daysInMonth) * daysSinceCycleStart * 100) / 100
      : null;

  // Electricity cost estimate
  const kwhPreview =
    sourceDelta !== null && sourceDelta > 0 ? Math.round(sourceDelta * 100) / 100 : null;
  const rate = electricityRatePerUnit != null ? Number(electricityRatePerUnit) : null;
  const estimatedElectricityCost =
    kwhPreview !== null && rate !== null && rate > 0
      ? Math.round(kwhPreview * rate * 100) / 100
      : null;
  const estimatedTotal =
    (proRataPreview || 0) +
    (estimatedElectricityCost || 0) +
    (outstandingBalance || 0);

  // ── Input filtering & validation gates ────────────────────────────────────
  const handleFloatKeyDown = (e) => {
    if (["e", "E", "-", "+"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const step1Valid = !!roomId && !!bedId && (!hasOutstanding || forceOverride);
  const step2Ready = contractStatus === "published" || contractUploaded;

  const sourceValid =
    sourceRoomMeterReading.trim() !== "" &&
    !isNaN(Number(sourceRoomMeterReading)) &&
    Number(sourceRoomMeterReading) >= 0;
  const targetValid =
    targetRoomMeterReading.trim() !== "" &&
    !isNaN(Number(targetRoomMeterReading)) &&
    Number(targetRoomMeterReading) >= 0;
  const step3Valid =
    sourceValid &&
    targetValid &&
    !sourceBelowBaseline &&
    !targetBelowBaseline &&
    reason.trim().length > 0;

  // ── Cancel & cleanup handler ──────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    if (preparedContractIdRef.current && !transferConfirmedRef.current) {
      const resId = tenant?.reservationId || tenant?._id || tenant?.id;
      if (resId) {
        try {
          await reservationApi.cancelTransfer(resId);
          showNotification("Pending transfer contract voided and bed lock released.", "info");
        } catch (err) {
          console.error("Failed to cancel pending transfer on close:", err);
        }
      }
    }
    onClose();
  }, [tenant, onClose]);

  // ── Step 1: Prepare Replacement Contract ──────────────────────────────────
  const handlePrepareContract = async () => {
    setAttemptedStep1(true);
    if (!roomId) {
      showNotification("Please select a target room for the transfer.", "warning");
      return;
    }
    if (!bedId) {
      showNotification("Please select an available bed in the target room.", "warning");
      return;
    }
    if (hasOutstanding && !forceOverride) {
      showNotification(
        "Please acknowledge the tenant's outstanding balance before proceeding.",
        "warning",
      );
      return;
    }
    const resId = tenant?.reservationId || tenant?._id || tenant?.id;
    if (!resId) {
      showNotification("Missing reservation identifier for tenant.", "error");
      return;
    }

    setPreparingContract(true);
    try {
      const res = await reservationApi.prepareTransferContract(resId, {
        targetRoomId: roomId,
        targetBedId: bedId,
        effectiveTransferDate: effectiveTransferDate || toDateInputValue(new Date()),
      });
      const contractId = res?.contractId || res?.data?.contractId || res?.data?.id;
      const contractNum = res?.contractNumber || res?.data?.contractNumber || "Pending";
      const status = res?.status || res?.data?.status || "draft";
      setPreparedContractId(contractId);
      setPreparedContractNumber(contractNum);
      setContractStatus(status);
      setContractIncomplete(Boolean(res?.incomplete || res?.data?.incomplete));
      showNotification("Replacement contract draft prepared successfully.", "success");
      setStep(2);
    } catch (err) {
      console.error("Contract preparation failed:", err);
      showNotification(err?.message || "Failed to prepare room transfer contract.", "error");
    } finally {
      setPreparingContract(false);
    }
  };

  // ── Step 2: Download / Print Contract Draft ───────────────────────────────
  const handleDownloadContractDraft = async () => {
    if (!preparedContractId) return;
    setDownloadingDraft(true);
    try {
      const fetcher = contractApi.getPreparedContractPdfBlob || contractApi.getPreparedContractFile;
      const blob = await fetcher(preparedContractId, 1);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contract-Draft-${preparedContractNumber || preparedContractId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification("Contract draft downloaded.", "success");
    } catch (err) {
      console.error("Draft download failed:", err);
      showNotification(err?.message || "Failed to download contract draft.", "error");
    } finally {
      setDownloadingDraft(false);
    }
  };

  // ── Step 2: Upload Wet-Signed / Notarized Contract ────────────────────────
  const handleUploadSignedContract = async () => {
    if (!preparedContractId) {
      showNotification("No active replacement contract found.", "error");
      return;
    }
    if (!selectedFile) {
      showNotification("Please select a signed contract PDF file to upload.", "warning");
      return;
    }
    setUploadingContract(true);
    try {
      await contractApi.uploadFinalNotarizedContract({
        contractId: preparedContractId,
        file: selectedFile,
        preparedDocumentVersion: 1,
      });
      setContractStatus("published");
      setContractUploaded(true);
      showNotification("Wet-signed contract uploaded and verified successfully.", "success");
    } catch (err) {
      console.error("Signed contract upload failed:", err);
      showNotification(err?.message || "Failed to upload signed contract.", "error");
    } finally {
      setUploadingContract(false);
    }
  };

  // ── Step 3: PDF Settlement Download ───────────────────────────────────────
  const handleDownloadTransferPDF = async () => {
    setPdfLoading(true);
    try {
      const { generateSettlementReceiptPDF } = await import("../../../shared/utils/receiptGenerator.js");
      await generateSettlementReceiptPDF({
        type: "transfer",
        tenantName: tenant?.tenantName || "",
        branch: detail?.basicInfo?.branch || tenant?.branch || "",
        fromRoom: tenant?.room || "",
        fromBed: formatBedPosition(tenant?.bed) || "",
        toRoom: selectedRoom?.name || selectedRoom?.roomNumber || "",
        toBed: selectedBedLabel,
        effectiveDate: effectiveTransferDate,
        daysSinceCycleStart,
        daysInMonth,
        currentRent: currentPrice,
        newRent: newPrice,
        proRataPreview,
        kwhPreview,
        electricityRate: rate,
        estimatedElectricityCost,
        outstandingBalance,
        estimatedTotal,
      });
    } catch (err) {
      console.error("Settlement PDF generation failed:", err);
      showNotification("Failed to generate settlement receipt PDF.", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Step 3: Confirm Transfer Submit ───────────────────────────────────────
  const handleConfirmTransfer = () => {
    setAttemptedStep3(true);
    if (!step3Valid) {
      if (!sourceValid) {
        showNotification("Please enter a valid final meter reading (kWh) for the current room.", "warning");
        return;
      }
      if (!targetValid) {
        showNotification("Please enter a valid opening meter reading (kWh) for the new room.", "warning");
        return;
      }
      if (sourceBelowBaseline) {
        showNotification(
          `Current room meter reading (${sourceEntered?.toLocaleString()} kWh) cannot be lower than the recorded baseline (${sourceBaseline?.toLocaleString()} kWh).`,
          "warning",
        );
        return;
      }
      if (targetBelowBaseline) {
        showNotification(
          `New room opening meter reading (${targetEntered?.toLocaleString()} kWh) cannot be lower than the recorded baseline (${targetBaseline?.toLocaleString()} kWh).`,
          "warning",
        );
        return;
      }
      if (!reason.trim()) {
        showNotification("Please enter a reason for the room transfer.", "warning");
        return;
      }
      return;
    }

    transferConfirmedRef.current = true;
    onSubmit({
      roomId,
      bedId,
      reason,
      forceOverride,
      effectiveTransferDate: effectiveTransferDate || undefined,
      sourceRoomMeterReading: sourceRoomMeterReading ? Number(sourceRoomMeterReading) : null,
      targetRoomMeterReading: targetRoomMeterReading ? Number(targetRoomMeterReading) : null,
      contractId: preparedContractId,
    });
  };

  // ── Bed label helper ─────────────────────────────────────────────────────
  const selectedBed = roomBeds.find((b) => String(b.id || b._id) === String(bedId));
  const selectedBedLabel = selectedBed
    ? getBedDisplayLabel(selectedBed, roomBeds.indexOf(selectedBed), selectedRoom?.type || selectedRoom?.roomType)
    : bedId || "—";

  // ── Footer renderer ──────────────────────────────────────────────────────
  const renderFooter = () => (
    <div className="twm-footer">
      <button
        type="button"
        className="tenant-modal-btn tenant-modal-btn--ghost"
        onClick={handleClose}
        disabled={loading || preparingContract || uploadingContract}
      >
        Cancel
      </button>
      <div className="twm-footer__spacer" />
      <div className="twm-footer__actions">
        {step === 2 && (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--back"
            onClick={() => setStep(1)}
            disabled={uploadingContract || downloadingDraft}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        )}
        {step === 3 && (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--back"
            onClick={() => setStep(2)}
            disabled={loading}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        )}
        {step === 1 ? (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--primary"
            disabled={preparingContract || !step1Valid}
            onClick={handlePrepareContract}
          >
            {preparingContract ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                <span>Preparing Contract...</span>
              </>
            ) : (
              <>
                <span>Prepare Replacement Contract</span>
                <ChevronRight size={16} />
              </>
            )}
          </button>
        ) : step === 2 ? (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--primary"
            disabled={!step2Ready}
            onClick={() => setStep(3)}
          >
            <span>Next: Meter Readings</span>
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--success"
            disabled={loading || !step1Valid || !step3Valid}
            onClick={handleConfirmTransfer}
          >
            {loading ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Confirm Transfer</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <TenantModalShell
      open={open}
      title={`Transfer Tenant${tenant?.tenantName ? ` • ${tenant.tenantName}` : ""}`}
      onClose={handleClose}
      footer={renderFooter()}
    >
      <WizardStepper
        steps={[
          "Target Room & Paperwork",
          "Sign & Upload Contract",
          "Meter Readings & Review",
        ]}
        currentStep={step}
      />

      {/* ── STEP 1: Target Room & Paperwork ───────────────────────────── */}
      {step === 1 && (
        <>
          <div className="twm-callout twm-callout--info">
            Transfers are restricted to available same-branch rooms of the same room type{currentRoomType ? ` (${currentRoomType.replace(/-/g, " ")})` : ""}. To change room types, a contract termination and new lease booking is required.
          </div>

          {hasOutstanding && (
            <div className="twm-callout twm-callout--danger">
              <strong>⚠ Outstanding Balance: {fmtMoney(outstandingBalance)}</strong>
              <p style={{ margin: "4px 0 8px", fontSize: 13 }}>
                This tenant has unpaid bills. Settle them first, or acknowledge and force-proceed.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={forceOverride}
                  onChange={(e) => setForceOverride(e.target.checked)}
                />
                I acknowledge the outstanding balance and confirm this transfer
              </label>
            </div>
          )}

          <div className="tenant-modal-grid">
            <label className="tenant-modal-field">
              <span>Current Assignment</span>
              <input
                type="text"
                value={`${tenant?.room || "Unknown room"} • ${formatBedPosition(tenant?.bed) || "No bed"}`}
                readOnly
              />
            </label>
            <label className="tenant-modal-field">
              <span>Branch</span>
              <input type="text" value={formatBranch(branch) || "—"} readOnly />
            </label>
          </div>

          <div className="tenant-modal-grid">
            <div className={`tenant-modal-field ${attemptedStep1 && !roomId ? "tenant-modal-field--invalid" : ""}`}>
              <span>New Room</span>
              <SearchableRoomSelect
                rooms={targetRooms}
                value={roomId}
                onChange={(newRoomId) => {
                  setRoomId(newRoomId);
                  setBedId("");
                  fetchTargetBaseline(newRoomId);
                }}
                disabled={roomsLoading}
                placeholder="Search and select room..."
                fmtMoney={fmtMoney}
                isInvalid={attemptedStep1 && !roomId}
              />
            </div>

            <label className={`tenant-modal-field ${attemptedStep1 && !bedId ? "tenant-modal-field--invalid" : ""}`}>
              <span>New Bed</span>
              <select
                value={bedId}
                onChange={(event) => setBedId(event.target.value)}
                disabled={!roomId}
                className={attemptedStep1 && !bedId ? "tenant-modal-field--invalid" : ""}
              >
                <option value="">Select a bed</option>
                {roomBeds.map((bed, index) => {
                  const isAvailable = bed.status ? bed.status === "available" : bed.available !== false;
                  const bedCode = getBedShortCode(selectedRoom?.roomNumber || selectedRoom?.name, bed, index);
                  const displayLabel = getBedDisplayLabel(bed, index, selectedRoom?.type || selectedRoom?.roomType);
                  const statusTag = isAvailable ? "" : ` — (${(bed.status || "unavailable").replace("_", " ")})`;
                  return (
                    <option key={bed.id || bed._id || index} value={bed.id || bed._id} disabled={!isAvailable}>
                      {bedCode ? `${bedCode} (${displayLabel})` : displayLabel}{statusTag}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="tenant-modal-field">
            <span>Effective Transfer Date</span>
            <input
              type="date"
              value={effectiveTransferDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setEffectiveTransferDate(e.target.value)}
            />
            <span className="twm-meter-hint">
              <Clock size={14} style={{ flexShrink: 0, marginTop: 2, color: "#2563eb" }} />
              <span>
                Future dates cannot be selected because room transfers take effect immediately upon administrative confirmation. Partial rent and utility usage are calculated up to today.
              </span>
            </span>
          </div>

          {/* Financial Summary Callout */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2.5 shadow-2xs">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Financial Summary & Terms
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Current Monthly Rent:</span>
                <span className="font-semibold text-foreground">{fmtMoney(currentPrice)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">New Monthly Rent:</span>
                <span className="font-semibold text-primary">{fmtMoney(newPrice)}</span>
              </div>
              {priceDiff !== 0 && (
                <div className="flex justify-between py-1 border-b border-border/50 sm:col-span-2">
                  <span className="text-muted-foreground">Monthly Rent Adjustment:</span>
                  <span className={`font-semibold ${priceDiff > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {priceDiff > 0 ? `+${fmtMoney(priceDiff)}/mo` : `-${fmtMoney(Math.abs(priceDiff))}/mo`}
                  </span>
                </div>
              )}
              {proRataPreview != null && (
                <div className="flex justify-between py-1 border-b border-border/50 sm:col-span-2">
                  <span className="text-muted-foreground">Estimated Cycle Proration:</span>
                  <span className="font-medium text-foreground">{fmtMoney(proRataPreview)} ({daysSinceCycleStart}d / {daysInMonth}d)</span>
                </div>
              )}
              <div className="flex justify-between py-1 sm:col-span-2">
                <span className="text-muted-foreground">Security Deposit Carryover:</span>
                <span className="font-medium text-foreground">
                  {securityDeposit > 0 ? `${fmtMoney(securityDeposit)} will carry over to the new room assignment` : "Transfers to new room assignment"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 2: Sign & Upload Contract ────────────────────────────── */}
      {step === 2 && (
        <>
          <div className="twm-callout twm-callout--info">
            Download and print the official replacement contract draft. Have the tenant and dorm owner/lessor sign the document, then upload the wet-signed / notarized PDF copy.
          </div>

          {/* Contract Summary Card */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <span className="font-semibold text-sm text-foreground">
                  {preparedContractNumber || "Draft Replacement Contract"}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-foreground bg-transparent">
                <span
                  className={`w-2 h-2 rounded-full ${
                    step2Ready ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {step2Ready ? "Signed & Published" : "Draft Prepared"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/60 pt-2.5">
              <div>
                <span className="text-muted-foreground block text-[11px]">Target Assignment</span>
                <span className="font-medium text-foreground">
                  {selectedRoom?.name || selectedRoom?.roomNumber || "Target Room"} • {selectedBedLabel}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">New Monthly Rent</span>
                <span className="font-semibold text-foreground">{fmtMoney(newPrice)}/mo</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Effective Date</span>
                <span className="font-medium text-foreground">{fmtDate(effectiveTransferDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Contract Status</span>
                <span className="font-medium text-foreground capitalize">{contractStatus.replace(/_/g, " ")}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="tenant-modal-btn tenant-modal-btn--ghost text-xs inline-flex items-center gap-1.5"
                onClick={handleDownloadContractDraft}
                disabled={downloadingDraft}
              >
                {downloadingDraft ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Download / Print Contract Draft</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Signed Contract Upload Dropzone */}
          <div className="bg-card border border-dashed border-border rounded-xl p-5 text-center space-y-3 shadow-2xs">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Upload size={20} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">Upload Wet-Signed / Notarized Contract PDF</div>
                <div className="text-[11px] text-muted-foreground">Select scanned document (PDF, PNG, JPG up to 15MB)</div>
              </div>
            </div>

            <input
              type="file"
              id="signed-contract-file-input"
              accept=".pdf,application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
              }}
            />

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <label
                htmlFor="signed-contract-file-input"
                className="tenant-modal-btn tenant-modal-btn--ghost text-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <FileText size={14} />
                <span>{selectedFile ? "Choose Different File" : "Browse Signed PDF"}</span>
              </label>

              {selectedFile && (
                <button
                  type="button"
                  className="tenant-modal-btn tenant-modal-btn--primary text-xs inline-flex items-center gap-1.5"
                  onClick={handleUploadSignedContract}
                  disabled={uploadingContract}
                >
                  {uploadingContract ? (
                    <>
                      <LoaderCircle size={14} className="animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload Signed Contract</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {selectedFile && (
              <div className="text-[11px] text-foreground font-medium pt-1">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}

            {step2Ready && (
              <div className="border border-border rounded-lg p-2.5 bg-muted/40 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Wet-signed contract uploaded and verified. Ready to proceed to meter readings.</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── STEP 3: Meter Readings & Review ───────────────────────────── */}
      {step === 3 && (
        <>
          <div className="twm-callout twm-callout--info">
            Record the final kWh reading for the current room and the opening reading for the new room. These anchor the billing segments.
          </div>

          <div className="tenant-modal-grid">
            {/* Source Room Meter */}
            <div className={`tenant-modal-field ${attemptedStep3 && (!sourceValid || sourceBelowBaseline) ? "tenant-modal-field--invalid" : ""}`}>
              <span>Current Room — Final Meter (kWh)</span>
              <input
                type="number"
                min="0"
                step="any"
                onKeyDown={handleFloatKeyDown}
                placeholder="e.g. 1455.50"
                value={sourceRoomMeterReading}
                onChange={(e) => setSourceRoomMeterReading(e.target.value)}
              />
              <div className="twm-meter-wrap">
                {sourceBaseline !== null ? (
                  <span className="twm-meter-hint">
                    Last recorded: {sourceBaseline.toLocaleString()} kWh on {fmtDate(sourceRoomLatestReading?.date)}
                    {" "}({sourceRoomLatestReading?.eventType || "baseline"})
                  </span>
                ) : (
                  <span className="twm-meter-hint twm-meter-hint--none">No prior reading — enter manually</span>
                )}
                {sourceDelta !== null && !sourceBelowBaseline && (
                  <span className="twm-meter-hint twm-meter-hint--delta">+{sourceDelta.toFixed(2)} kWh consumed</span>
                )}
                {sourceBelowBaseline && (
                  <span className="twm-meter-hint twm-meter-hint--warn">
                    ⚠ Reading ({sourceEntered?.toLocaleString()} kWh) cannot be lower than recorded baseline ({sourceBaseline?.toLocaleString()} kWh). Please check the meter.
                  </span>
                )}
              </div>
            </div>

            {/* Target Room Meter */}
            <div className={`tenant-modal-field ${attemptedStep3 && (!targetValid || targetBelowBaseline) ? "tenant-modal-field--invalid" : ""}`}>
              <span>New Room — Opening Meter (kWh)</span>
              <input
                type="number"
                min="0"
                step="any"
                onKeyDown={handleFloatKeyDown}
                placeholder="e.g. 890.00"
                value={targetRoomMeterReading}
                onChange={(e) => setTargetRoomMeterReading(e.target.value)}
              />
              <div className="twm-meter-wrap">
                {targetBaselineLoading ? (
                  <div className="twm-meter-skeleton" />
                ) : targetBaseline !== null ? (
                  <span className="twm-meter-hint">
                    Last recorded: {targetBaseline.toLocaleString()} kWh on {fmtDate(targetRoomBaseline?.date)}
                    {" "}({targetRoomBaseline?.eventType || "baseline"})
                  </span>
                ) : roomId ? (
                  <span className="twm-meter-hint twm-meter-hint--none">No prior reading — enter manually</span>
                ) : null}
                {targetBelowBaseline && (
                  <span className="twm-meter-hint twm-meter-hint--warn">
                    ⚠ Opening reading ({targetEntered?.toLocaleString()} kWh) cannot be lower than recorded baseline ({targetBaseline?.toLocaleString()} kWh).
                  </span>
                )}
              </div>
            </div>
          </div>

          <label className={`tenant-modal-field ${attemptedStep3 && !reason.trim() ? "tenant-modal-field--invalid" : ""}`}>
            <span>Reason for Transfer</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Required — describe the reason for this transfer"
            />
          </label>

          <div className="twm-review-summary">
            <div className="twm-review-field">
              <span className="twm-review-field__label">From</span>
              <span className="twm-review-field__value">{tenant?.room || "—"} • {formatBedPosition(tenant?.bed) || "—"}</span>
            </div>
            <div className="twm-review-field">
              <span className="twm-review-field__label">To</span>
              <span className="twm-review-field__value">{selectedRoom?.name || selectedRoom?.roomNumber || "—"} • {selectedBedLabel}</span>
            </div>
            <div className="twm-review-field">
              <span className="twm-review-field__label">Effective Date</span>
              <span className="twm-review-field__value">{fmtDate(effectiveTransferDate)}</span>
            </div>
            <div className="twm-review-field">
              <span className="twm-review-field__label">New Rent</span>
              <span className="twm-review-field__value">
                {fmtMoney(newPrice)}/mo
                {priceDiff !== 0 && (
                  <span style={{ fontSize: 11, fontWeight: 400, color: priceDiff > 0 ? "var(--danger)" : "var(--success)" }}>
                    {" "}({priceDiff > 0 ? `+${fmtMoney(priceDiff)}` : `-${fmtMoney(Math.abs(priceDiff))}`})
                  </span>
                )}
              </span>
            </div>
            <div className="twm-review-field twm-review-field--wide">
              <span className="twm-review-field__label">Replacement Contract</span>
              <span className="twm-review-field__value font-mono text-xs">{preparedContractNumber || "Attached"}</span>
            </div>
          </div>

          <div className="twm-settlement-card">
            <div className="twm-settlement-card__header">
              <p className="twm-settlement-card__title">Transfer Settlement Estimate</p>
              <button
                type="button"
                className="twm-settlement-card__download-btn"
                disabled={pdfLoading}
                onClick={handleDownloadTransferPDF}
                title="Download printable settlement estimate"
              >
                <Download size={13} />
                <span>{pdfLoading ? "Generating..." : "Download Estimate PDF"}</span>
              </button>
            </div>
            <div className="twm-settlement-card__body">
              {daysSinceCycleStart != null && (
                <div className="twm-settlement-row">
                  <span className="twm-settlement-row__label">Days in old room this cycle</span>
                  <span className="twm-settlement-row__value">{daysSinceCycleStart} day{daysSinceCycleStart !== 1 ? "s" : ""}</span>
                </div>
              )}
              {proRataPreview != null && (
                <div className="twm-settlement-row">
                  <span className="twm-settlement-row__label">
                    Prorated Old Room Rent
                    {daysSinceCycleStart != null && <span style={{ fontSize: 11, fontWeight: 400, display: "block", color: "var(--text-muted)" }}>
                      {daysSinceCycleStart}d / {daysInMonth}d × {fmtMoney(currentPrice)}
                    </span>}
                  </span>
                  <span className="twm-settlement-row__value">{fmtMoney(proRataPreview)}</span>
                </div>
              )}
              {kwhPreview != null && (
                <div className="twm-settlement-row">
                  <span className="twm-settlement-row__label">
                    Estimated Electricity Usage
                    <span style={{ fontSize: 11, fontWeight: 400, display: "block", color: "var(--text-muted)" }}>
                      {estimatedElectricityCost !== null
                        ? `${kwhPreview.toLocaleString()} kWh × ₱${rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kWh`
                        : `${kwhPreview.toLocaleString()} kWh — rate applied at generation`}
                    </span>
                  </span>
                  <span className="twm-settlement-row__value">
                    {estimatedElectricityCost !== null
                      ? fmtMoney(estimatedElectricityCost)
                      : `${kwhPreview.toLocaleString()} kWh`}
                  </span>
                </div>
              )}
              {outstandingBalance > 0 && (
                <div className="twm-settlement-row twm-settlement-row--danger">
                  <span className="twm-settlement-row__label">Prior Outstanding Balance</span>
                  <span className="twm-settlement-row__value">{fmtMoney(outstandingBalance)}</span>
                </div>
              )}
              {proRataPreview != null && (
                <div className="twm-settlement-row twm-settlement-row--total">
                  <span className="twm-settlement-row__label">Estimated Settlement Total</span>
                  <span className="twm-settlement-row__value">{fmtMoney(estimatedTotal)}</span>
                </div>
              )}
            </div>
            <p className="twm-settlement-card__note">
              {estimatedElectricityCost !== null
                ? `Rate: ₱${rate?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kWh (active billing period). Final amount confirmed at billing generation.`
                : "Final electricity amount is calculated at billing generation time using the current room rate."}
            </p>
          </div>

          {hasOutstanding && forceOverride && (
            <div className="twm-callout twm-callout--warning">
              ⚠ You have acknowledged the outstanding balance of {fmtMoney(outstandingBalance)} and are force-proceeding.
            </div>
          )}
        </>
      )}
    </TenantModalShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Move-Out Modal — 3-Step Wizard
   Step 1: Date & Time
   Step 2: Final Meter & Room Condition
   Step 3: Review & Deposit Clearance
   ───────────────────────────────────────────────────────────────────────────── */
export function MoveOutModal({ open, tenant, detail, loading, onClose, onSubmit, sourceRoomLatestReading, electricityRatePerUnit }) {
  // ── Wizard step state ─────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Form state ────────────────────────────────────────────────────────────
  const [moveOutDate, setMoveOutDate] = useState("");
  const [moveOutTime, setMoveOutTime] = useState("10:00");
  const [meterReading, setMeterReading] = useState("");
  const [keyReturned, setKeyReturned] = useState(true);
  const [damageDeductions, setDamageDeductions] = useState("");
  const [notes, setNotes] = useState("");

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMoveOutDate(toDateInputValue(new Date()));
    setMoveOutTime("10:00");
    setMeterReading("");
    setKeyReturned(true);
    setDamageDeductions("");
    setNotes("");
  }, [open]);

  // ── Derived values ────────────────────────────────────────────────────────
  const moveOutReason = tenant?.allowedActions?.moveOut?.reason || "";
  const leaseEndDate = detail?.leaseInfo?.leaseEndDate || tenant?.leaseEndDate;
  const isEarlyVacancy = Boolean(
    leaseEndDate && moveOutDate && new Date(moveOutDate) < new Date(leaseEndDate),
  );
  const securityDeposit = resolveDepositFromPaymentInfo(
    detail?.paymentInfo,
    detail?.basicInfo?.monthlyRent ?? tenant?.monthlyRent ?? 0,
  );
  const outstandingBal = Number(detail?.paymentInfo?.currentBalance ?? tenant?.currentBalance ?? 0);
  const damageFee = Number(damageDeductions || 0);
  const keyFee = keyReturned ? 0 : 500;
  // ── Baseline & electricity estimates ───────────────────────────────────────
  const moveOutBaseline = sourceRoomLatestReading?.reading != null
    ? Number(sourceRoomLatestReading.reading)
    : null;
  const meterEntered = meterReading !== "" ? Number(meterReading) : null;
  const moveOutDelta = moveOutBaseline !== null && meterEntered !== null
    ? meterEntered - moveOutBaseline
    : null;
  const moveOutBelowBaseline = moveOutDelta !== null && moveOutDelta < 0;
  const moveOutKwh = moveOutDelta !== null && moveOutDelta > 0
    ? Math.round(moveOutDelta * 100) / 100
    : null;
  const moveOutRate = electricityRatePerUnit != null ? Number(electricityRatePerUnit) : null;
  const estimatedElectricityCostMoveOut =
    moveOutKwh !== null && moveOutRate !== null && moveOutRate > 0
      ? Math.round(moveOutKwh * moveOutRate * 100) / 100
      : null;

  // ── Deposit clearance math ────────────────────────────────────────────────
  const electricityDeduction = estimatedElectricityCostMoveOut ?? 0;
  const totalDeductions = outstandingBal + damageFee + keyFee + electricityDeduction;
  const netSettlement = isEarlyVacancy
    ? 0
    : Math.max(0, securityDeposit - totalDeductions);
  const hasDebt = !isEarlyVacancy && netSettlement === 0 &&
    totalDeductions > securityDeposit;
  const remainingDebt = hasDebt
    ? Math.round((totalDeductions - securityDeposit) * 100) / 100
    : 0;

  // ── Step gate validation ──────────────────────────────────────────────────
  const step1Valid = !!moveOutDate && !!moveOutTime;
  const step2Valid = !!meterReading && !moveOutBelowBaseline;

  // -- MoveOut PDF download handler (lazy-import) -----------------------
  const [pdfLoading, setPdfLoading] = useState(false);
  const handleDownloadMoveOutPDF = async () => {
    setPdfLoading(true);
    try {
      const { generateSettlementReceiptPDF } = await import("../../../shared/utils/receiptGenerator.js");
      await generateSettlementReceiptPDF({
        type: "moveOut",
        tenantName: tenant?.tenantName || "",
        branch: detail?.basicInfo?.branch || tenant?.branch || "",
        fromRoom: tenant?.room || "",
        fromBed: formatBedPosition(tenant?.bed) || "",
        effectiveDate: moveOutDate,
        moveOutTime,
        finalMeterReading: meterReading,
        securityDeposit,
        outstandingBal,
        keyFee,
        damageFee,
        electricityDeduction,
        kwhPreview: moveOutKwh,
        electricityRate: moveOutRate,
        netSettlement,
        remainingDebt,
        isEarlyVacancy,
      });
    } catch (err) {
      console.error("Settlement PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };


  // -- Footer renderer ------------------------------------------------------
  const renderFooter = () => (
    <div className="twm-footer">
      <button type="button" className="tenant-modal-btn tenant-modal-btn--ghost" onClick={onClose}>
        Cancel
      </button>
      <div className="twm-footer__spacer" />
      <div className="twm-footer__actions">
        {step > 1 && (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--back"
            onClick={() => setStep((s) => s - 1)}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--primary"
            disabled={step === 1 ? !step1Valid : !step2Valid}
            onClick={() => setStep((s) => s + 1)}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--danger"
            disabled={loading || !step1Valid || !step2Valid}
            onClick={() =>
              onSubmit({
                moveOutDate,
                moveOutTime,
                meterReading: Number(meterReading),
                keyReturned,
                damageDeductions: Number(damageDeductions || 0),
                notes,
              })
            }
          >
            {loading ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <LogOut size={16} />
                <span>Confirm Move-Out</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <TenantModalShell
      open={open}
      title={`Process Move-Out${tenant?.tenantName ? ` • ${tenant.tenantName}` : ""}`}
      onClose={onClose}
      footer={renderFooter()}
    >
      <WizardStepper
        steps={["Date & Time", "Meter & Condition", "Review"]}
        currentStep={step}
      />

      {/* ── STEP 1: Date & Time ───────────────────────────────────────── */}
      {step === 1 && (
        <>
          <div className="tenant-modal-grid">
            <label className="tenant-modal-field">
              <span>Lease End Date</span>
              <input type="text" value={fmtDate(leaseEndDate)} readOnly />
            </label>
            <label className="tenant-modal-field">
              <span>Current Outstanding Balance</span>
              <input type="text" value={fmtMoney(outstandingBal)} readOnly />
            </label>
          </div>

          {moveOutReason && (
            <div className="twm-callout twm-callout--warning">{moveOutReason}</div>
          )}

          <div className="tenant-modal-grid">
            <label className="tenant-modal-field">
              <span>Move-Out Date</span>
              <input
                type="date"
                value={moveOutDate}
                onChange={(event) => setMoveOutDate(event.target.value)}
              />
            </label>
            <label className="tenant-modal-field">
              <span>Move-Out Time</span>
              <input
                type="time"
                value={moveOutTime}
                onChange={(event) => setMoveOutTime(event.target.value)}
              />
            </label>
          </div>

          {isEarlyVacancy && (
            <div className="twm-callout twm-callout--danger">
              ⚠ Early Vacancy Detected: Moving out before lease end ({fmtDate(leaseEndDate)}) will result in automatic deposit forfeiture per contract Section 4.
            </div>
          )}
        </>
      )}

      {/* ── STEP 2: Final Meter & Room Condition ──────────────────────── */}
      {step === 2 && (
        <>
          <div className="twm-callout twm-callout--info">
            Record the final meter reading and note any deductions before proceeding to the financial summary.
          </div>

          <div className="tenant-modal-grid">
            <label className="tenant-modal-field">
              <span>Final Meter Reading (kWh)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 1,450.50"
                value={meterReading}
                onChange={(event) => setMeterReading(event.target.value)}
              />
              {moveOutBaseline !== null ? (
                <span className={`twm-meter-hint ${
                  moveOutBelowBaseline ? "twm-meter-hint--warn" : moveOutDelta !== null ? "twm-meter-hint--delta" : "twm-meter-hint--none"
                }`}>
                  {moveOutBelowBaseline
                    ? `⚠ Reading cannot be below last recorded baseline of ${moveOutBaseline.toLocaleString()} kWh`
                    : moveOutDelta !== null
                      ? `Last recorded: ${moveOutBaseline.toLocaleString()} kWh on ${fmtDate(sourceRoomLatestReading.date)} (${sourceRoomLatestReading.eventType}) — +${moveOutDelta.toLocaleString()} kWh since last reading`
                      : `Last recorded: ${moveOutBaseline.toLocaleString()} kWh on ${fmtDate(sourceRoomLatestReading.date)}`}
                </span>
              ) : (
                <span className="twm-meter-hint">Enter the current kWh reading from the room meter.</span>
              )}
            </label>
            <label className="tenant-modal-field">
              <span>Key / Access Card Returned</span>
              <select
                value={keyReturned ? "yes" : "no"}
                onChange={(e) => setKeyReturned(e.target.value === "yes")}
              >
                <option value="yes">Yes — Key Handed Over</option>
                <option value="no">No — ₱500 Replacement Deduction</option>
              </select>
            </label>
          </div>

          <label className="tenant-modal-field">
            <span>Damage / Cleaning Fee Deductions (₱)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={damageDeductions}
              onChange={(e) => setDamageDeductions(e.target.value)}
            />
            <span className="twm-meter-hint">Leave 0 if no damages. This amount will be deducted from the security deposit.</span>
          </label>

          <label className="tenant-modal-field">
            <span>Final Move-Out Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional — include inspection notes, condition remarks, or handover details"
            />
          </label>
        </>
      )}

      {/* ── STEP 3: Review & Deposit Clearance ────────────────────────── */}
      {step === 3 && (
        <>
          <div className="twm-review-summary">
            <div className="twm-review-field">
              <span className="twm-review-field__label">Move-Out Date</span>
              <span className="twm-review-field__value">{fmtDate(moveOutDate)}</span>
            </div>
            <div className="twm-review-field">
              <span className="twm-review-field__label">Move-Out Time</span>
              <span className="twm-review-field__value">{moveOutTime}</span>
            </div>
            <div className="twm-review-field">
              <span className="twm-review-field__label">Final Meter Reading</span>
              <span className="twm-review-field__value">{Number(meterReading).toLocaleString()} kWh</span>
            </div>
            <div className="twm-review-field">
              <span className="twm-review-field__label">Key Returned</span>
              <span className="twm-review-field__value">{keyReturned ? "Yes" : "No — ₱500 deducted"}</span>
            </div>
            {notes && (
              <div className="twm-review-field twm-review-field--wide">
                <span className="twm-review-field__label">Notes</span>
                <span className="twm-review-field__value">{notes}</span>
              </div>
            )}
          </div>

          {isEarlyVacancy && (
            <div className="twm-callout twm-callout--danger">
              ⚠ Early Vacancy — The security deposit will be forfeited per the lease contract.
            </div>
          )}

          <div className="twm-settlement-card">
            <div className="twm-settlement-card__header">
              <p className="twm-settlement-card__title">Deposit Clearance Summary</p>
              <button
                type="button"
                className="twm-settlement-card__download-btn"
                disabled={pdfLoading}
                onClick={handleDownloadMoveOutPDF}
                title="Download printable settlement estimate"
              >
                <Download size={13} />
                <span>{pdfLoading ? "Generating..." : "Download Estimate PDF"}</span>
              </button>
            </div>
            <div className="twm-settlement-card__body">
              <div className="twm-settlement-row">
                <span className="twm-settlement-row__label">Security Deposit Held</span>
                <span className="twm-settlement-row__value">{fmtMoney(securityDeposit)}</span>
              </div>
              {outstandingBal > 0 && (
                <div className="twm-settlement-row twm-settlement-row--danger">
                  <span className="twm-settlement-row__label">Less: Unpaid Balance</span>
                  <span className="twm-settlement-row__value">({fmtMoney(outstandingBal)})</span>
                </div>
              )}
              {keyFee > 0 && (
                <div className="twm-settlement-row twm-settlement-row--danger">
                  <span className="twm-settlement-row__label">Less: Key Replacement Fee</span>
                  <span className="twm-settlement-row__value">({fmtMoney(keyFee)})</span>
                </div>
              )}
              {damageFee > 0 && (
                <div className="twm-settlement-row twm-settlement-row--danger">
                  <span className="twm-settlement-row__label">Less: Damage / Cleaning Fee</span>
                  <span className="twm-settlement-row__value">({fmtMoney(damageFee)})</span>
                </div>
              )}
              {estimatedElectricityCostMoveOut !== null && estimatedElectricityCostMoveOut > 0 && (
                <div className="twm-settlement-row twm-settlement-row--danger">
                  <span className="twm-settlement-row__label">
                    Less: Est. Electricity Charge
                    <span style={{ fontSize: 11, fontWeight: 400, display: "block", color: "var(--text-muted)" }}>
                      {moveOutKwh?.toLocaleString()} kWh × ₱{moveOutRate?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kWh
                    </span>
                  </span>
                  <span className="twm-settlement-row__value">({fmtMoney(estimatedElectricityCostMoveOut)})</span>
                </div>
              )}
              {isEarlyVacancy ? (
                <div className="twm-settlement-row twm-settlement-row--total twm-settlement-row--forfeited">
                  <span className="twm-settlement-row__label">Deposit Status</span>
                  <span className="twm-settlement-row__value">Forfeited — Early Vacancy</span>
                </div>
              ) : hasDebt ? (
                <div className="twm-settlement-row twm-settlement-row--total twm-settlement-row--danger">
                  <span className="twm-settlement-row__label">Remaining Balance Due</span>
                  <span className="twm-settlement-row__value">{fmtMoney(remainingDebt)}</span>
                </div>
              ) : (
                <div className="twm-settlement-row twm-settlement-row--total twm-settlement-row--success">
                  <span className="twm-settlement-row__label">Estimated Refundable Deposit</span>
                  <span className="twm-settlement-row__value">{fmtMoney(netSettlement)}</span>
                </div>
              )}
            </div>
            <p className="twm-settlement-card__note">
              {estimatedElectricityCostMoveOut !== null
                ? `Electricity estimate uses rate ₱${moveOutRate?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kWh. Final charges confirmed at billing generation.`
                : "Final utility charges are applied separately at billing generation time."}
            </p>
          </div>
        </>
      )}
    </TenantModalShell>
  );
}
