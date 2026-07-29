import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRooms } from "../../../shared/hooks/queries/useRooms";
import useBodyScrollLock from "../../../shared/hooks/useBodyScrollLock";
import { formatBranch } from "../utils/formatters";
import { resolveDepositFromPaymentInfo } from "../../../shared/utils/depositUtils";

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
  const [newLeaseStartDate, setNewLeaseStartDate] = useState("");
  const [newLeaseEndDate, setNewLeaseEndDate] = useState("");
  const [offerMonths, setOfferMonths] = useState(6);
  const [proposedRent, setProposedRent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;

    const currentEnd =
      context?.currentStay?.leaseEndDate || detail?.leaseInfo?.leaseEndDate;
    const nextStart = currentEnd ? new Date(currentEnd) : new Date();
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = currentEnd ? new Date(currentEnd) : new Date();
    nextEnd.setMonth(nextEnd.getMonth() + 12);

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 14);

    setNewLeaseStartDate(toDateInputValue(nextStart));
    setNewLeaseEndDate(toDateInputValue(nextEnd));
    setOfferMonths(6);
    setProposedRent(detail?.basicInfo?.monthlyRent || tenant?.monthlyRent || "");
    setExpiresAt(toDateInputValue(expiry));
    setNotes("");
    setMode("direct");
  }, [open, detail, context, tenant]);

  const extensionHistory =
    context?.renewalHistory || detail?.leaseInfo?.extensionHistory || [];

  const handleConfirm = () => {
    if (mode === "offer") {
      if (onOfferSubmit) {
        onOfferSubmit({
          months: Number(offerMonths) || 6,
          proposedRent: proposedRent ? Number(proposedRent) : null,
          expiresAt,
          notes,
        });
      }
    } else {
      onSubmit({ newLeaseStartDate, newLeaseEndDate, notes });
    }
  };

  return (
    <TenantModalShell
      open={open}
      title={`Renew Lease / Offer${tenant?.tenantName ? ` • ${tenant.tenantName}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--primary"
            disabled={loading || (mode === "direct" && !newLeaseEndDate)}
            onClick={handleConfirm}
          >
            {loading ? "Processing..." : mode === "offer" ? "Send Renewal Offer" : "Renew Lease"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: mode === "direct" ? "2px solid #E8734A" : "1px solid #CBD5E1",
            background: mode === "direct" ? "#FFF7ED" : "#fff",
            color: mode === "direct" ? "#E8734A" : "#64748B",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
          onClick={() => setMode("direct")}
        >
          Direct Renewal
        </button>
        <button
          type="button"
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: mode === "offer" ? "2px solid #E8734A" : "1px solid #CBD5E1",
            background: mode === "offer" ? "#FFF7ED" : "#fff",
            color: mode === "offer" ? "#E8734A" : "#64748B",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
          onClick={() => setMode("offer")}
        >
          Send Official Offer
        </button>
      </div>

      {mode === "direct" ? (
        <div className="tenant-modal-grid">
          <label className="tenant-modal-field">
            <span>Current Lease End</span>
            <input
              type="text"
              value={fmtDate(detail?.leaseInfo?.leaseEndDate || tenant?.leaseEndDate)}
              readOnly
            />
          </label>
          <label className="tenant-modal-field">
            <span>New Lease End Date</span>
            <input
              type="date"
              value={newLeaseEndDate}
              onChange={(event) => setNewLeaseEndDate(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <div className="tenant-modal-grid">
          <label className="tenant-modal-field">
            <span>Offer Duration (Months)</span>
            <select
              value={offerMonths}
              onChange={(e) => setOfferMonths(e.target.value)}
            >
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months (1 Year)</option>
              <option value={24}>24 Months (2 Years)</option>
            </select>
          </label>
          <label className="tenant-modal-field">
            <span>Proposed Monthly Rent (₱)</span>
            <input
              type="number"
              placeholder="Leave blank for current rent"
              value={proposedRent}
              onChange={(e) => setProposedRent(e.target.value)}
            />
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

      <label className="tenant-modal-field">
        <span>Notes / Message to Tenant</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={mode === "offer" ? "Message for tenant in renewal notification..." : "Optional renewal notes"}
        />
      </label>

      <div className="tenant-modal-section">
        <h4>Extension History</h4>
        {extensionHistory.length === 0 ? (
          <p className="tenant-modal-empty">No previous extensions recorded.</p>
        ) : (
          <div className="tenant-history-list">
            {extensionHistory.map((entry) => (
              <div key={entry.id} className="tenant-history-item">
                <strong>
                  +{entry.addedMonths} month{entry.addedMonths === 1 ? "" : "s"}
                </strong>
                <span>
                  {entry.previousDuration} → {entry.newDuration} months
                </span>
                <span>{fmtDate(entry.extendedAt)}</span>
                {entry.notes ? <span>{entry.notes}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </TenantModalShell>
  );
}

export function TransferTenantModal({ open, tenant, detail, loading, onClose, onSubmit }) {
  const branch = detail?.basicInfo?.branch || tenant?.branch || "";
  const { data: roomsData = [], isLoading: roomsLoading } = useRooms(
    open && branch ? { branch } : {},
  );
  const rooms = Array.isArray(roomsData) ? roomsData : roomsData.rooms || [];
  const [roomId, setRoomId] = useState("");
  const [bedId, setBedId] = useState("");
  const [sourceRoomMeterReading, setSourceRoomMeterReading] = useState("");
  const [targetRoomMeterReading, setTargetRoomMeterReading] = useState("");
  const [reason, setReason] = useState("Room transfer");

  useEffect(() => {
    if (!open) return;
    setRoomId("");
    setBedId("");
    setSourceRoomMeterReading("");
    setTargetRoomMeterReading("");
    setReason("Room transfer");
  }, [open]);

  const availableRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          String(room._id || room.id) !== String(tenant?.roomId) &&
          Array.isArray(room.beds) &&
          room.beds.some((bed) => bed.status === "available"),
      ),
    [rooms, tenant?.roomId],
  );

  const selectedRoom = availableRooms.find(
    (room) => String(room._id || room.id) === String(roomId),
  );
  const availableBeds = selectedRoom?.beds?.filter((bed) => bed.status === "available") || [];

  const currentPrice = Number(detail?.basicInfo?.monthlyRent || tenant?.monthlyRent || 0);
  const newPrice = Number(selectedRoom?.monthlyPrice || selectedRoom?.price || 0);
  const priceDiff = newPrice - currentPrice;

  return (
    <TenantModalShell
      open={open}
      title={`Transfer Tenant${tenant?.tenantName ? ` • ${tenant.tenantName}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--primary"
            disabled={loading || !roomId || !bedId}
            onClick={() =>
              onSubmit({
                roomId,
                bedId,
                reason,
                sourceRoomMeterReading: sourceRoomMeterReading ? Number(sourceRoomMeterReading) : null,
                targetRoomMeterReading: targetRoomMeterReading ? Number(targetRoomMeterReading) : null,
              })
            }
          >
            {loading ? "Saving..." : "Transfer Tenant"}
          </button>
        </>
      }
    >
      <div className="tenant-modal-callout">
        Transfers are limited to the same branch. Old bed will automatically enter turnover status.
      </div>

      <div className="tenant-modal-grid">
        <label className="tenant-modal-field">
          <span>Current Assignment</span>
          <input
            type="text"
            value={`${tenant?.room || "Unknown room"} • ${tenant?.bed || "No bed"}`}
            readOnly
          />
        </label>
        <label className="tenant-modal-field">
          <span>Branch</span>
          <input type="text" value={formatBranch(branch) || "—"} readOnly />
        </label>
      </div>

      <div className="tenant-modal-grid">
        <label className="tenant-modal-field">
          <span>New Room</span>
          <select
            value={roomId}
            onChange={(event) => {
              setRoomId(event.target.value);
              setBedId("");
            }}
            disabled={roomsLoading}
          >
            <option value="">Select a room</option>
            {availableRooms.map((room) => (
              <option key={room._id || room.id} value={room._id || room.id}>
                {room.name || room.roomNumber} ({fmtMoney(room.monthlyPrice || room.price)})
              </option>
            ))}
          </select>
        </label>

        <label className="tenant-modal-field">
          <span>New Bed</span>
          <select
            value={bedId}
            onChange={(event) => setBedId(event.target.value)}
            disabled={!roomId}
          >
            <option value="">Select a bed</option>
            {availableBeds.map((bed) => (
              <option key={bed._id || bed.id} value={bed._id || bed.id}>
                {(bed.position || bed.id || "Bed").replace("-", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      {roomId && priceDiff !== 0 && (
        <div className="tenant-modal-callout" style={{ background: "#EFF6FF", borderLeftColor: "#3B82F6", color: "#1E40AF" }}>
          Monthly Rent Adjustment: {priceDiff > 0 ? `+${fmtMoney(priceDiff)}/mo` : `-${fmtMoney(Math.abs(priceDiff))}/mo`} (Old: {fmtMoney(currentPrice)} → New: {fmtMoney(newPrice)})
        </div>
      )}

      <div className="tenant-modal-grid">
        <label className="tenant-modal-field">
          <span>Current Room Final Meter (kWh)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Optional departing meter reading"
            value={sourceRoomMeterReading}
            onChange={(e) => setSourceRoomMeterReading(e.target.value)}
          />
        </label>
        <label className="tenant-modal-field">
          <span>New Room Opening Meter (kWh)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Optional target meter reading"
            value={targetRoomMeterReading}
            onChange={(e) => setTargetRoomMeterReading(e.target.value)}
          />
        </label>
      </div>

      <label className="tenant-modal-field">
        <span>Reason</span>
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Required transfer reason"
        />
      </label>
    </TenantModalShell>
  );
}

export function MoveOutModal({ open, tenant, detail, loading, onClose, onSubmit }) {
  const [moveOutDate, setMoveOutDate] = useState("");
  const [moveOutTime, setMoveOutTime] = useState("10:00");
  const [meterReading, setMeterReading] = useState("");
  const [keyReturned, setKeyReturned] = useState(true);
  const [damageDeductions, setDamageDeductions] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setMoveOutDate(toDateInputValue(new Date()));
    setMoveOutTime("10:00");
    setMeterReading("");
    setKeyReturned(true);
    setDamageDeductions("");
    setNotes("");
  }, [open]);

  const moveOutReason = tenant?.allowedActions?.moveOut?.reason || "";
  const leaseEndDate = detail?.leaseInfo?.leaseEndDate || tenant?.leaseEndDate;
  const isEarlyVacancy = Boolean(
    leaseEndDate && moveOutDate && new Date(moveOutDate) < new Date(leaseEndDate)
  );

  // Read the deposit locked at booking time; fall back to monthlyRent only for legacy records
  const securityDeposit = resolveDepositFromPaymentInfo(
    detail?.paymentInfo,
    detail?.basicInfo?.monthlyRent ?? tenant?.monthlyRent ?? 0,
  );
  const outstandingBal = Number(detail?.paymentInfo?.currentBalance ?? tenant?.currentBalance ?? 0);
  const damageFee = Number(damageDeductions || 0);
  const keyFee = keyReturned ? 0 : 500;
  const netSettlement = isEarlyVacancy
    ? 0
    : Math.max(0, securityDeposit - outstandingBal - damageFee - keyFee);

  return (
    <TenantModalShell
      open={open}
      title={`Process Move-Out${tenant?.tenantName ? ` • ${tenant.tenantName}` : ""}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="tenant-modal-btn tenant-modal-btn--danger"
            disabled={loading || !moveOutDate || !moveOutTime || !meterReading}
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
            {loading ? "Saving..." : "Confirm Move-Out"}
          </button>
        </>
      }
    >
      <div className="tenant-modal-grid">
        <label className="tenant-modal-field">
          <span>Lease End</span>
          <input
            type="text"
            value={fmtDate(leaseEndDate)}
            readOnly
          />
        </label>
        <label className="tenant-modal-field">
          <span>Current Balance</span>
          <input
            type="text"
            value={fmtMoney(outstandingBal)}
            readOnly
          />
        </label>
      </div>

      {moveOutReason ? (
        <div className="tenant-modal-callout tenant-modal-callout--danger">
          {moveOutReason}
        </div>
      ) : null}

      {isEarlyVacancy && (
        <div className="tenant-modal-callout tenant-modal-callout--danger">
          ⚠️ Early Vacancy Detected: Moving out before lease end date ({fmtDate(leaseEndDate)}) will result in automatic deposit forfeiture (Section 4).
        </div>
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

      <div className="tenant-modal-grid">
        <label className="tenant-modal-field">
          <span>Final Meter Reading (kWh)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1450.50"
            value={meterReading}
            onChange={(event) => setMeterReading(event.target.value)}
          />
        </label>
        <label className="tenant-modal-field">
          <span>Key / Access Card Returned</span>
          <select
            value={keyReturned ? "yes" : "no"}
            onChange={(e) => setKeyReturned(e.target.value === "yes")}
          >
            <option value="yes">Yes (Key Handed Over)</option>
            <option value="no">No (₱500 Replacement Deduction)</option>
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
      </label>

      {/* Live Financial Clearance Calculator */}
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14, marginTop: 10, marginBottom: 15 }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: 13, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Financial Settlement Calculator
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 12, color: "#475569" }}>
          <span>Security Deposit Held:</span>
          <strong style={{ textAlign: "right" }}>{fmtMoney(securityDeposit)}</strong>
          <span>Less: Unpaid Balance:</span>
          <span style={{ textAlign: "right", color: outstandingBal > 0 ? "#DC2626" : "#64748B" }}>
            -{fmtMoney(outstandingBal)}
          </span>
          {keyFee > 0 && (
            <>
              <span>Less: Key Fee:</span>
              <span style={{ textAlign: "right", color: "#DC2626" }}>-{fmtMoney(keyFee)}</span>
            </>
          )}
          {damageFee > 0 && (
            <>
              <span>Less: Damage Fee:</span>
              <span style={{ textAlign: "right", color: "#DC2626" }}>-{fmtMoney(damageFee)}</span>
            </>
          )}
          <div style={{ gridColumn: "span 2", borderTop: "1px solid #CBD5E1", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 13, color: "#0F172A" }}>
              {isEarlyVacancy ? "Deposit Status:" : "Estimated Refundable Deposit:"}
            </strong>
            <strong style={{ fontSize: 14, color: isEarlyVacancy ? "#DC2626" : "#16A34A" }}>
              {isEarlyVacancy ? "FORFEITED (Early Vacancy)" : fmtMoney(netSettlement)}
            </strong>
          </div>
        </div>
      </div>

      <label className="tenant-modal-field">
        <span>Final Notes</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional move-out clearance notes"
        />
      </label>
    </TenantModalShell>
  );
}
