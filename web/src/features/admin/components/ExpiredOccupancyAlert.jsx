import React, { useState } from "react";
import { reservationApi } from "../../../shared/api/reservationApi.js";

/**
 * ExpiredOccupancyAlert - Persistent admin dashboard banner for stays in "expired_occupancy_continuing" status.
 * Provides a month-to-month billing approval sign-off drawer.
 */
export default function ExpiredOccupancyAlert({ expiredStays = [], onApproved }) {
  const [loadingStayId, setLoadingStayId] = useState(null);

  if (!expiredStays || expiredStays.length === 0) return null;

  const handleApproveMonthToMonth = async (stayId) => {
    try {
      setLoadingStayId(stayId);
      await reservationApi.approveExpiredOccupancyMonthToMonth(stayId);
      if (onApproved) onApproved(stayId);
    } catch (err) {
      alert(err.message || "Failed to approve month-to-month billing.");
    } finally {
      setLoadingStayId(null);
    }
  };

  return (
    <div className="w-full p-4 mb-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
          <span>ATTENTION: {expiredStays.length} Occupancy Stays Expired (Month-to-Month Review Required)</span>
        </div>
      </div>

      <p className="text-xs text-amber-800">
        Tenants are continuing occupancy past their contract end date. Explicit admin authorization is required to approve month-to-month billing.
      </p>

      <div className="space-y-2">
        {expiredStays.map((stay) => (
          <div key={stay._id} className="p-2.5 bg-white border border-amber-200 rounded flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-gray-900">{stay.tenantName || stay.tenantId}</span>
              <span className="text-gray-500 ml-2">Room {stay.roomId} (Bed {stay.bedId})</span>
              <span className="text-amber-800 ml-2 italic">Expired on {new Date(stay.endDate).toLocaleDateString()}</span>
            </div>
            <button
              onClick={() => handleApproveMonthToMonth(stay._id)}
              disabled={loadingStayId === stay._id}
              className="px-3 py-1 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {loadingStayId === stay._id ? "Approving..." : "Approve Month-to-Month"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
