import React, { useState, useEffect } from "react";
import { moveOutApi } from "../../../shared/api/moveOutApi.js";
import StatusBadge from "../../admin/components/shared/StatusBadge.jsx";
import { MoveOutClearanceSkeleton } from "../../../shared/components/LoadingSkeletons.jsx";

/**
 * ClearanceSummaryView - Read-Only portal view for former tenants.
 * Preserves historical viewing of final bills, deposit deductions, and refund status.
 */
export default function ClearanceSummaryView() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await moveOutApi.getFormerTenantSummary();
        setSummary(res.data);
      } catch (err) {
        setError(err.message || "Failed to load clearance summary.");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) return <MoveOutClearanceSkeleton />;

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const clearance = summary?.clearance || {};
  const reservation = summary?.reservation || {};

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Move-Out Clearance Statement</h1>
          <p className="text-xs text-gray-500">Read-Only Former Tenant Account Record</p>
        </div>
        <StatusBadge status="former_tenant" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tenancy Overview */}
        <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-2 text-xs">
          <h3 className="font-semibold text-gray-800 text-sm">Tenancy Information</h3>
          <div className="flex justify-between">
            <span className="text-gray-500">Room & Bed:</span>
            <span className="font-medium text-gray-900">{reservation.roomId} / Bed {reservation.bedId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Move-Out Date:</span>
            <span className="font-medium text-gray-900">{clearance.moveOutDate ? new Date(clearance.moveOutDate).toLocaleDateString() : "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">RFID Keycard Returned:</span>
            <span className={`font-medium ${clearance.rfidReturned ? "text-emerald-700" : "text-red-600"}`}>
              {clearance.rfidReturned ? "Yes (Cleared)" : "No (Fee Deducted)"}
            </span>
          </div>
        </div>

        {/* Deposit Settlement Calculation */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
          <h3 className="font-semibold text-slate-800 text-sm">Deposit Settlement Summary</h3>
          <div className="flex justify-between">
            <span className="text-gray-500">Initial Security Deposit:</span>
            <span className="font-medium text-gray-900">₱{clearance.initialDeposit?.toLocaleString() || "0"}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Pending Rent Deductions:</span>
            <span>- ₱{clearance.rentDeduction?.toLocaleString() || "0"}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Utility Pro-Rata Deductions:</span>
            <span>- ₱{clearance.utilityDeduction?.toLocaleString() || "0"}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Damage & RFID Fees:</span>
            <span>- ₱{clearance.damageDeduction?.toLocaleString() || "0"}</span>
          </div>
          <div className="pt-2 border-t border-slate-300 flex justify-between font-bold text-sm text-slate-900">
            <span>Net Deposit Refund:</span>
            <span className="text-emerald-700">₱{clearance.netRefundAmount?.toLocaleString() || "0"}</span>
          </div>
        </div>
      </div>

      {/* Admin Sign-Off Remarks */}
      {clearance.adminRemarks && (
        <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-1">
          <h4 className="text-xs font-semibold text-gray-700">Administrative Sign-Off Remarks</h4>
          <p className="text-xs text-gray-600 italic">{clearance.adminRemarks}</p>
        </div>
      )}
    </div>
  );
}
