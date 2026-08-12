import React, { useState, useEffect } from "react";
import { billingApi } from "../../../shared/api/billingApi.js";
import StatusBadge from "./shared/StatusBadge.jsx";

/**
 * TerminationReviewBoard - Case management modal/board for notice exhaustion or severe violations.
 */
export default function TerminationReviewBoard() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getTerminationCases();
      setCases(res.data || []);
    } catch (err) {
      console.error("Termination board fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  if (loading) {
    return <div className="p-4 text-xs text-gray-500 italic">Loading termination review board cases...</div>;
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Administrative Termination Review Board</h3>
          <p className="text-xs text-gray-500 font-normal">Review board cases for notice exhaustion and severe rule breaches.</p>
        </div>
        <button
          onClick={fetchCases}
          className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
        >
          Refresh Cases
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 font-semibold">
              <th className="p-2.5">Case Reference</th>
              <th className="p-2.5">Tenant Name</th>
              <th className="p-2.5">Reason for Review</th>
              <th className="p-2.5">Balance Snapshot</th>
              <th className="p-2.5">Board Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                  No pending termination cases under review.
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 font-mono text-gray-800">#{c.caseNumber || c._id?.slice(-6)}</td>
                  <td className="p-2.5 font-bold text-gray-900">{c.tenantName || "Tenant"}</td>
                  <td className="p-2.5 text-gray-700">{c.reason || "Notice 3 Exhaustion"}</td>
                  <td className="p-2.5 font-semibold text-red-700">₱{c.balanceSnapshot?.toLocaleString() || "0"}</td>
                  <td className="p-2.5">
                    <StatusBadge status={c.outcome || "pending"} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
