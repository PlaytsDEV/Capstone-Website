import React, { useState } from "react";
import dayjs from "dayjs";
import { moveOutApi } from "../../../shared/api/moveOutApi.js";
import BaseModal from "../../../shared/components/BaseModal.jsx";

/**
 * MoveOutClearanceCalculator - Admin deposit settlement calculator (P6-01).
 * Features inspection checklist, RFID keycard toggle, itemized deductions formula, and final clearance sign-off.
 */
export default function MoveOutClearanceCalculator({ isOpen, onClose, reservation, onClearanceCompleted }) {
  const [initialDeposit, setInitialDeposit] = useState(reservation?.securityDeposit || 5000);
  const [rentDeduction, setRentDeduction] = useState(0);
  const [utilityDeduction, setUtilityDeduction] = useState(0);
  const [damageDeduction, setDamageDeduction] = useState(0);
  const [rfidReturned, setRfidReturned] = useState(true);
  const [waiveEarlyForfeiture, setWaiveEarlyForfeiture] = useState(false);
  const [adminRemarks, setAdminRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rawLeaseEnd = reservation?.leaseEndDate || reservation?.endDate;
  const leaseEnd = rawLeaseEnd ? dayjs(rawLeaseEnd) : null;
  const isEarlyPreTermination = leaseEnd ? dayjs().startOf("day").isBefore(leaseEnd.startOf("day")) : false;
  const effectiveEarlyTermination = isEarlyPreTermination && !waiveEarlyForfeiture;

  const rfidFee = rfidReturned ? 0 : 300;
  const totalDeductions = Number(rentDeduction) + Number(utilityDeduction) + Number(damageDeduction) + rfidFee;
  const netRefund = effectiveEarlyTermination ? 0 : Math.max(0, Number(initialDeposit) - totalDeductions);

  const handleSubmitSignOff = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await moveOutApi.submitClearanceSignOff(reservation._id || reservation.id, {
        initialDeposit: Number(initialDeposit),
        rentDeduction: Number(rentDeduction),
        utilityDeduction: Number(utilityDeduction),
        damageDeduction: Number(damageDeduction),
        rfidReturned,
        adminRemarks: effectiveEarlyTermination
          ? `[Early Pre-Termination - Deposit 100% Forfeited] ${adminRemarks}`.trim()
          : waiveEarlyForfeiture && isEarlyPreTermination
          ? `[Early Move-Out - Deposit Forfeiture Waived by Admin] ${adminRemarks}`.trim()
          : adminRemarks,
        netRefundAmount: netRefund,
        isEarlyPreTermination: effectiveEarlyTermination,
      });
      if (onClearanceCompleted) onClearanceCompleted();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to finalize move-out clearance.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Move-Out Deposit Settlement — ${reservation?.tenantName || "Tenant"}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmitSignOff} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Room & Bed:</span>
            <span className="font-semibold text-gray-900">{reservation?.roomId || "Unassigned"} / Bed {reservation?.bedId || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Move-In Date:</span>
            <span className="font-medium text-gray-900">{reservation?.startDate ? new Date(reservation.startDate).toLocaleDateString() : "N/A"}</span>
          </div>
          {leaseEnd && (
            <div className="flex justify-between">
              <span className="text-gray-500">Agreed Contract End Date:</span>
              <span className="font-medium text-gray-900">{leaseEnd.format("MM/DD/YYYY")}</span>
            </div>
          )}
        </div>

        {isEarlyPreTermination && (
          <div className="p-3 bg-card border border-border rounded text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-600 dark:text-rose-400">Early Move-Out Detected</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  checked={waiveEarlyForfeiture}
                  onChange={(e) => setWaiveEarlyForfeiture(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-[11px] font-medium">Waive Forfeiture (Mutual Agreement)</span>
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {waiveEarlyForfeiture
                ? "Deposit forfeiture has been waived by administrator. Security deposit balance will be calculated and refunded normally after deductions."
                : "Departing before the scheduled lease end date forfeits 100% of the security deposit as an early termination penalty. Net refund is set to ₱0.00."}
            </p>
          </div>
        )}

        {/* Itemized Deductions Form */}
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Security Deposit Held (₱)</label>
              <input
                type="number"
                required
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Pending Rent Deductions (₱)</label>
              <input
                type="number"
                min="0"
                value={rentDeduction}
                onChange={(e) => setRentDeduction(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Utility Pro-Rata Deductions (₱)</label>
              <input
                type="number"
                min="0"
                value={utilityDeduction}
                onChange={(e) => setUtilityDeduction(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Room Damage Deductions (₱)</label>
              <input
                type="number"
                min="0"
                value={damageDeduction}
                onChange={(e) => setDamageDeduction(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          </div>

          {/* RFID Keycard Check */}
          <div className="p-3 bg-card border border-border rounded flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground">RFID Keycard Returned?</span>
              <p className="text-[11px] text-muted-foreground">Unreturned RFID card adds a ₱300 replacement fee.</p>
            </div>
            <button
              type="button"
              onClick={() => setRfidReturned(!rfidReturned)}
              className={`px-3 py-1.5 text-xs font-bold rounded border border-border transition-colors ${
                rfidReturned
                  ? "bg-card text-emerald-600 dark:text-emerald-400"
                  : "bg-card text-rose-600 dark:text-rose-400"
              }`}
            >
              {rfidReturned ? "Returned (₱0)" : "Missing (+₱300)"}
            </button>
          </div>

          {/* Admin Remarks */}
          <div>
            <label className="block font-semibold text-foreground mb-1">Inspection Remarks & Sign-off Notes</label>
            <textarea
              rows={2}
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              placeholder="Record room condition notes, paint touch-ups, or meter read details..."
              className="w-full p-2 border border-border rounded bg-background text-foreground"
            />
          </div>
        </div>

        {/* Calculation Summary Box */}
        <div className="p-4 bg-card border border-border rounded-lg space-y-1 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Total Deductions:</span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">₱{totalDeductions.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border">
            <span>Net Deposit Refund:</span>
            <span className="text-base text-emerald-600 dark:text-emerald-400">₱{netRefund.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 border border-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Finalizing Clearance..." : "Finalize Clearance & Convert to Former Tenant"}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
