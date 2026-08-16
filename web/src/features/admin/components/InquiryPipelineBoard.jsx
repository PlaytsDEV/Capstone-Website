import React, { useState, useEffect } from "react";
import { RefreshCw, UserCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { inquiryApi } from "../../../shared/api/inquiryApi.js";
import StatusBadge from "./shared/StatusBadge.jsx";
import { InquiryPipelineSkeleton } from "../../../shared/components/LoadingSkeletons.jsx";
import { getFriendlyError } from "../../../shared/utils/friendlyError.js";

/**
 * InquiryPipelineBoard - Kanban Lead Intake & Marketing Conversion Board.
 * Modernized with clean 1px borders, solid surfaces, and high-contrast styling.
 */
export default function InquiryPipelineBoard() {
  const [boardData, setBoardData] = useState({ new: [], viewing: [], converted: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchBoard = async () => {
    try {
      setLoading(true);
      const res = await inquiryApi.getKanbanBoard();
      if (res.data) {
        setBoardData(res.data);
      }
    } catch (err) {
      console.error("Kanban fetch error:", err);
      setFeedback({
        type: "error",
        message: getFriendlyError(err, "Unable to load the inquiry pipeline records at this time. Please refresh or try again later."),
      });
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
      setFeedback(null);
      await inquiryApi.convertToApplication(inquiryId);
      setFeedback({
        type: "success",
        message: "Inquiry successfully converted to a reservation application.",
      });
      await fetchBoard();
    } catch (err) {
      setFeedback({
        type: "error",
        message: getFriendlyError(err, "Unable to convert this inquiry to a tenant application. Please verify the inquiry details and try again."),
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <InquiryPipelineSkeleton />;

  const columns = [
    { key: "new", title: "New Leads", items: boardData.new || [], tone: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "viewing", title: "Viewing Scheduled", items: boardData.viewing || [], tone: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "converted", title: "Converted to Tenant", items: boardData.converted || [], tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ];

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`flex items-center justify-between p-3 rounded-lg border text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline hover:opacity-75 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground tracking-tight">Lead Conversion Pipeline</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track prospective resident journey from inquiry capture to tenant conversion</p>
          </div>
          <button
            onClick={fetchBoard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col.key} className="bg-muted/20 border border-border rounded-xl p-3 space-y-3 flex flex-col min-h-[320px]">
              <div className="flex justify-between items-center pb-2 border-b border-border/80">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{col.title}</h3>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${col.tone}`}>
                  {col.items.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1 flex-1">
                {col.items.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground italic">No inquiries in this stage</div>
                ) : (
                  col.items.map((item) => (
                    <div
                      key={item._id}
                      className="p-3 bg-card border border-border rounded-lg space-y-2 hover:border-primary/40 transition-colors shadow-2xs"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold text-foreground line-clamp-1">{item.name || item.fullName || item.email}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300 shrink-0">
                          {item.channel || "Direct"}
                        </span>
                      </div>

                      {item.email && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.email}</p>
                      )}

                      <p className="text-xs text-muted-foreground line-clamp-2">{item.message || "No message body."}</p>

                      <div className="flex justify-between items-center pt-2 border-t border-border/50">
                        <StatusBadge status={item.status} />
                        {col.key !== "converted" && (
                          <button
                            onClick={() => handleConvert(item._id)}
                            disabled={actionLoading === item._id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-primary rounded hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                          >
                            {actionLoading === item._id ? (
                              <Loader2 size={12} className="animate-spin shrink-0" />
                            ) : (
                              <UserCheck size={12} />
                            )}
                            <span>{actionLoading === item._id ? "Converting..." : "Convert"}</span>
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
    </div>
  );
}
