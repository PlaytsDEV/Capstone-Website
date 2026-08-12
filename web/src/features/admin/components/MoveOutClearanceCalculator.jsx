import React, { useState } from "react";
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
  const [adminRemarks, setAdminRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!reservation) return null;

  const rfidFee = rfidReturned ? 0 : 300;
  const totalDeductions = Number(rentDeduction) + Number(utilityDeduction) + Number(damageDeduction) + rfidFee;
  const netRefund = Math.max(0, Number(initialDeposit) - totalDeductions);

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
        adminRemarks,
        netRefundAmount: netRefund,
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
      title={`Move-Out Deposit Settlement — ${reservation.tenantName || "Tenant"}`}
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
            <span className="font-semibold text-gray-900">{reservation.roomId} / Bed {reservation.bedId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Move-In Date:</span>
            <span className="font-medium text-gray-900">{new Date(reservation.startDate).toLocaleDateString()}</span>
          </div>
        </div>

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
          <div className="p-3 bg-white border border-gray-200 rounded flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-800">RFID Keycard Returned?</span>
              <p className="text-[11px] text-gray-500">Unreturned RFID card adds a ₱300 replacement fee.</p>
            </div>
            <button
              type="button"
              onClick={() => setRfidReturned(!rfidReturned)}
              className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors ${
                rfidReturned
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-red-50 border-red-300 text-red-800"
              }`}
            >
              {rfidReturned ? "Returned (₱0)" : "Missing (+₱300)"}
            </button>
          </div>

          {/* Admin Remarks */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Inspection Remarks & Sign-off Notes</label>
            <textarea
              rows={2}
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              placeholder="Record room condition notes, paint touch-ups, or meter read details..."
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
        </div>

        {/* Calculation Summary Box */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Total Deductions:</span>
            <span className="font-semibold text-red-600">₱{totalDeductions.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-sm text-emerald-900 pt-1 border-t border-emerald-200">
            <span>Net Deposit Refund:</span>
            <span className="text-base">₱{netRefund.toLocaleString()}</span>
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
