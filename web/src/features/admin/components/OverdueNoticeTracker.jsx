import React, { useState, useEffect } from "react";
import { billingApi } from "../../../shared/api/billingApi.js";
import StatusBadge from "./shared/StatusBadge.jsx";

/**
 * OverdueNoticeTracker - Admin interface for 3-notice escalation machine.
 * Tracks delivery logs, frozen balances, and manual notice dispatch.
 */
export default function OverdueNoticeTracker() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatchLoading, setDispatchLoading] = useState(null);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getOverdueNotices();
      setNotices(res.data || []);
    } catch (err) {
      console.error("Notices fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSendNotice = async (billId, noticeType) => {
    try {
      setDispatchLoading(`${billId}-${noticeType}`);
      await billingApi.sendOverdueNotice(billId, noticeType);
      await fetchNotices();
    } catch (err) {
      alert(err.message || "Failed to dispatch overdue notice.");
    } finally {
      setDispatchLoading(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-xs text-gray-500 italic">Loading overdue notice logs...</div>;
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-900">3-Notice Overdue Escalation Tracker</h3>
          <p className="text-xs text-gray-500 font-normal">Automated & manual notice delivery receipts (Notice 1 → 2 → 3 Final).</p>
        </div>
        <button
          onClick={fetchNotices}
          className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 font-semibold">
              <th className="p-2.5">Tenant / Room</th>
              <th className="p-2.5">Bill Number</th>
              <th className="p-2.5">Current Notice Stage</th>
              <th className="p-2.5">Frozen Balance</th>
              <th className="p-2.5">Delivery Status</th>
              <th className="p-2.5 text-right">Dispatch Notice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {notices.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400 italic">
                  No active overdue notices recorded.
                </td>
              </tr>
            ) : (
              notices.map((n) => (
                <tr key={n._id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 font-bold text-gray-900">
                    {n.tenantName || "Tenant"} ({n.roomId || "N/A"})
                  </td>
                  <td className="p-2.5 font-mono text-gray-600">#{n.billNumber || n.billId?.slice(-6)}</td>
                  <td className="p-2.5">
                    <StatusBadge status={n.noticeType || `notice_${n.noticeCount || 1}`} />
                  </td>
                  <td className="p-2.5 font-semibold text-gray-900">₱{n.frozenAmount?.toLocaleString() || "0"}</td>
                  <td className="p-2.5 text-gray-600">
                    {n.deliveredAt ? `Delivered: ${new Date(n.deliveredAt).toLocaleTimeString()}` : "Pending Email"}
                  </td>
                  <td className="p-2.5 text-right space-x-1">
                    <button
                      onClick={() => handleSendNotice(n.billId, "notice_1")}
                      disabled={dispatchLoading === `${n.billId}-notice_1`}
                      className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
                    >
                      N1
                    </button>
                    <button
                      onClick={() => handleSendNotice(n.billId, "notice_2")}
                      disabled={dispatchLoading === `${n.billId}-notice_2`}
                      className="px-2 py-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-300 rounded hover:bg-amber-100"
                    >
                      N2
                    </button>
                    <button
                      onClick={() => handleSendNotice(n.billId, "notice_3")}
                      disabled={dispatchLoading === `${n.billId}-notice_3`}
                      className="px-2 py-1 text-[11px] font-medium text-red-800 bg-red-50 border border-red-300 rounded hover:bg-red-100"
                    >
                      N3 (Final)
                    </button>
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
