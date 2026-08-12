import React, { useState } from "react";
import BaseModal from "../../../shared/components/BaseModal.jsx";
import { reservationApi } from "../../../shared/api/reservationApi.js";

/**
 * LeaseRenewalModal - Displays proposed contract extension and rent adjustment details.
 * Prevents rent updates from applying until the tenant reviews and digitally accepts.
 */
export default function LeaseRenewalModal({ isOpen, onClose, renewalOffer, reservationId, onResponseComplete }) {
  const [tenantNotes, setTenantNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!renewalOffer) return null;

  const handleRespond = async (action) => {
    try {
      setLoading(true);
      setError(null);
      await reservationApi.respondToRenewalOffer(
        reservationId,
        renewalOffer._id || renewalOffer.id,
        action,
        tenantNotes
      );
      if (onResponseComplete) onResponseComplete(action);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit response to renewal offer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Lease Renewal Proposal"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Current Monthly Rent:</span>
            <span className="font-semibold text-gray-900">₱{renewalOffer.previousRent?.toLocaleString() || "0"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Proposed Monthly Rent:</span>
            <span className="font-bold text-indigo-600">₱{renewalOffer.proposedRent?.toLocaleString() || "0"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Proposed Lease Term:</span>
            <span className="font-semibold text-gray-900">
              {new Date(renewalOffer.proposedStartDate).toLocaleDateString()} to {new Date(renewalOffer.proposedEndDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="tenant-notes" className="block text-xs font-semibold text-gray-700 mb-1">
            Comments / Notes (Optional)
          </label>
          <textarea
            id="tenant-notes"
            rows={3}
            value={tenantNotes}
            onChange={(e) => setTenantNotes(e.target.value)}
            placeholder="Add any questions or remarks regarding the proposed lease renewal..."
            className="w-full p-2.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => handleRespond("decline")}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
          >
            Decline Proposal
          </button>
          <button
            type="button"
            onClick={() => handleRespond("accept")}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 border border-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Sign & Accept Renewal"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
