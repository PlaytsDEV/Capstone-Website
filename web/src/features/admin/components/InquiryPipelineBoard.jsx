import React, { useState, useEffect } from "react";
import { inquiryApi } from "../../../shared/api/inquiryApi.js";
import StatusBadge from "./shared/StatusBadge.jsx";
import { InquiryPipelineSkeleton } from "../../../shared/components/LoadingSkeletons.jsx";

/**
 * InquiryPipelineBoard - Kanban Lead Intake & Marketing Conversion Board.
 * Features 8 marketing channels and 1-Click "Convert to Application" action.
 */
export default function InquiryPipelineBoard() {
  const [boardData, setBoardData] = useState({ new: [], viewing: [], converted: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchBoard = async () => {
    try {
      setLoading(true);
      const res = await inquiryApi.getKanbanBoard();
      if (res.data) {
        setBoardData(res.data);
      }
    } catch (err) {
      console.error("Kanban fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, []);

  const handleConvert = async (inquiryId) => {
    try {
      setActionLoading(inquiryId);
      await inquiryApi.convertToApplication(inquiryId);
      await fetchBoard();
    } catch (err) {
      alert(err.message || "Failed to convert inquiry to application.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <InquiryPipelineSkeleton />;

  const columns = [
    { key: "new", title: "New Leads", items: boardData.new || [] },
    { key: "viewing", title: "Viewing Scheduled", items: boardData.viewing || [] },
    { key: "converted", title: "Converted to Tenant", items: boardData.converted || [] },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Inquiry & Marketing Pipeline</h2>
          <p className="text-xs text-gray-500">Track lead progression from initial inquiry to room reservation.</p>
        </div>
        <button
          onClick={fetchBoard}
          className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
        >
          Refresh Board
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => (
          <div key={col.key} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">{col.title}</h3>
              <span className="px-2 py-0.5 text-xs font-bold text-slate-800 bg-white border rounded">
                {col.items.length}
              </span>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {col.items.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 italic">No inquiries</div>
              ) : (
                col.items.map((item) => (
                  <div
                    key={item._id}
                    className="p-3 bg-white border border-slate-200 rounded shadow-2xs space-y-2 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-gray-900">{item.name || item.email}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 border border-indigo-200 rounded text-indigo-700">
                        {item.channel || "Direct"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 line-clamp-2">{item.message || "No message body."}</p>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <StatusBadge status={item.status} />
                      {col.key !== "converted" && (
                        <button
                          onClick={() => handleConvert(item._id)}
                          disabled={actionLoading === item._id}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {actionLoading === item._id ? "Converting..." : "1-Click Convert"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
