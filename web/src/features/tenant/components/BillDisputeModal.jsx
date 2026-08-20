import React, { useState } from "react";
import BaseModal from "../../../shared/components/BaseModal.jsx";
import { billingApi } from "../../../shared/api/billingApi.js";

/**
 * BillDisputeModal - Allows tenants to contest line items on a bill.
 * Automatically notifies backend to set disputeState="disputed" and freeze late penalties.
 */
export default function BillDisputeModal({ isOpen, onClose, bill, onDisputeSubmitted }) {
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!bill) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for disputing this bill.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await billingApi.submitDispute(bill._id || bill.id, {
        disputeReason: reason,
        evidenceUrl,
      });
      if (onDisputeSubmitted) onDisputeSubmitted();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit bill dispute.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Contest Bill #${bill.billNumber || bill._id?.slice(-6)}`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <strong>Notice:</strong> Submitting a dispute pauses late fee penalties for this bill while our administrative team reviews your request.
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="dispute-reason" className="block text-xs font-semibold text-gray-700 mb-1">
            Reason for Dispute <span className="text-red-500">*</span>
          </label>
          <textarea
            id="dispute-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you are contesting this charge (e.g. meter reading discrepancy, incorrect rate)..."
            className="w-full p-2.5 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-[#0A1628]/20 focus:border-[#0A1628]"
            required
          />
        </div>

        <div>
          <label htmlFor="evidence-url" className="block text-xs font-semibold text-gray-700 mb-1">
            Evidence Photo URL (Optional)
          </label>
          <input
            id="evidence-url"
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://example.com/meter-photo.jpg"
            className="w-full p-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-[#0A1628]/20 focus:border-[#0A1628]"
          />
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
            className="px-4 py-2 text-xs font-medium text-white bg-[#0A1628] border border-[#0A1628] rounded hover:bg-[#13243D] disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Dispute"}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
