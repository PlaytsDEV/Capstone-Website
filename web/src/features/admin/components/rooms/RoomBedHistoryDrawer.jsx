import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Layers,
  GraduationCap,
  Briefcase,
  Wrench,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useRoomBedHistory } from "../../../../shared/hooks/queries/useAnalyticsReports";
import { getBedDisplayLabel, getBedShortCode } from "../../../../shared/utils/bedIdentifier";
import RoomBedHistoryDrawerSkeleton from "./RoomBedHistoryDrawerSkeleton";

export default function RoomBedHistoryDrawer({ roomId, onClose }) {
  const { data, isLoading, isError, refetch, isFetching } = useRoomBedHistory(roomId);
  const [expandedBeds, setExpandedBeds] = useState({});

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Body scroll lock
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!roomId) return null;

  const room = data?.room || {};
  const beds = data?.beds || [];
  const summary = data?.summary || {};

  const toggleBed = (bedId) => {
    setExpandedBeds((prev) => ({
      ...prev,
      [bedId]: !prev[bedId],
    }));
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return "Present";
    return new Date(dateVal).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-bed-history-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div className="w-screen max-w-xl bg-card text-foreground shadow-2xl border-l border-border flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="room-bed-history-title"
                  className="text-lg font-bold tracking-tight text-foreground"
                >
                  Room {room.roomNumber || room.name || ""} History
                </h2>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 capitalize">
                  {room.type ? room.type.replace("-", " ") : "Room"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bed-level tenure history, turnaround metrics & tenant profile log
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {isLoading ? (
              <RoomBedHistoryDrawerSkeleton />
            ) : isError ? (
              <div className="p-6 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-card text-foreground text-sm space-y-3">
                <div className="flex justify-center text-rose-500">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Failed to load history for this room
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please verify your network connection or permissions and try again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  {isFetching ? "Retrying..." : "Try Again"}
                </button>
              </div>
            ) : (
              <>
                {/* Summary KPI Strip */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-border bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground block">
                      Total Historical Stays
                    </span>
                    <span className="text-2xl font-bold text-foreground mt-1 block">
                      {summary.totalStays || 0}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Recorded bed assignments
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-border bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground block">
                      Active Tenants
                    </span>
                    <span className="text-2xl font-bold text-foreground mt-1 block">
                      {summary.activeStaysCount || 0} / {room.capacity || 0}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Currently in bed units
                    </span>
                  </div>
                </div>

                {/* Bed Accordions */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Bed Units & History Timeline
                  </h3>

                  {beds.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      No bed units configured for this room.
                    </div>
                  ) : (
                    beds.map((bed, index) => {
                      const isExpanded = expandedBeds[bed.bedId] !== false; // Default expanded
                      const historyCount = (bed.history || []).length;
                      const shortCode = getBedShortCode(room.roomNumber, bed, index);
                      const displayLabel = getBedDisplayLabel(bed, index, room.type);

                      return (
                        <div
                          key={bed.bedId}
                          className="rounded-xl border border-border bg-card overflow-hidden transition-colors"
                        >
                          {/* Accordion Header */}
                          <div
                            onClick={() => toggleBed(bed.bedId)}
                            className="p-3.5 bg-muted/40 hover:bg-muted/70 cursor-pointer flex items-center justify-between border-b border-border/60 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                {shortCode}
                              </span>
                              <span className="text-xs font-medium text-muted-foreground">
                                {displayLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-muted-foreground">
                                {historyCount} {historyCount === 1 ? "stay" : "stays"}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>

                          {/* Accordion Content */}
                          {isExpanded && (
                            <div className="p-3">
                              {historyCount === 0 ? (
                                <p className="text-xs text-muted-foreground py-3 text-center italic">
                                  No previous move-in history recorded for Bed {bed.bedId}.
                                </p>
                              ) : (
                                <div className="space-y-2.5">
                                  {bed.history.map((record) => {
                                    const isMaint =
                                      record.status === "maintenance" ||
                                      record.closedByAction === "restored" ||
                                      Boolean(record.reason && /maintenance/i.test(record.reason));

                                    if (isMaint) {
                                      return (
                                        <div
                                          key={record.id}
                                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-muted/20 text-xs space-y-2"
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <div className="flex shrink-0 items-center justify-center text-amber-500">
                                                <Wrench className="w-4 h-4" />
                                              </div>
                                              <div>
                                                <span className="font-bold text-foreground">
                                                  {record.reason || "Maintenance Period"}
                                                </span>
                                                {record.notes && (
                                                  <span className="text-[11px] text-muted-foreground block">
                                                    {record.notes}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                                              <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                  record.status === "maintenance"
                                                    ? "bg-amber-500"
                                                    : "bg-slate-400"
                                                }`}
                                              />
                                              {record.status === "maintenance"
                                                ? "Under Maintenance"
                                                : "Maintenance Resolved"}
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
                                            <div>
                                              <span className="text-muted-foreground block">
                                                Downtime:
                                              </span>
                                              <span className="font-medium text-foreground">
                                                {formatDate(record.moveInDate)} –{" "}
                                                {formatDate(record.moveOutDate)}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground block">
                                                Duration:
                                              </span>
                                              <span className="font-medium text-foreground">
                                                {record.stayDurationDays
                                                  ? `${record.stayDurationDays} days`
                                                  : "Ongoing"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div
                                        key={record.id}
                                        className="p-3 rounded-lg border border-border/80 bg-muted/20 text-xs space-y-2"
                                      >
                                        {/* Row Header */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-foreground font-bold text-[10px]">
                                              {record.tenant?.name
                                                ? record.tenant.name.charAt(0)
                                                : "U"}
                                            </div>
                                            <div>
                                              <span className="font-bold text-foreground">
                                                {record.tenant?.name || "Unspecified Tenant"}
                                              </span>
                                              {record.tenant?.email && (
                                                <span className="text-[11px] text-muted-foreground block">
                                                  {record.tenant.email}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                                            <span
                                              className={`w-1.5 h-1.5 rounded-full ${
                                                record.status === "active"
                                                  ? "bg-emerald-500"
                                                  : "bg-slate-400"
                                              }`}
                                            />
                                            {record.status === "active"
                                              ? "Active Tenant"
                                              : "Completed Stay"}
                                          </span>
                                        </div>

                                        {/* Demographic Pill Tag */}
                                        {record.tenant?.tenantType && (
                                          <div className="flex items-center gap-1.5 pt-0.5">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                              {record.tenant.tenantType === "Student" ? (
                                                <GraduationCap className="w-3 h-3 text-sky-500" />
                                              ) : (
                                                <Briefcase className="w-3 h-3 text-sky-500" />
                                              )}
                                              {record.tenant.tenantType}
                                            </span>

                                            {(record.tenant.school ||
                                              record.tenant.occupation) && (
                                              <span className="text-[10px] text-muted-foreground truncate max-w-[240px]">
                                                {record.tenant.school ||
                                                  record.tenant.occupation}
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {/* Dates & Duration Bar */}
                                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-[11px]">
                                          <div>
                                            <span className="text-muted-foreground block">
                                              Period:
                                            </span>
                                            <span className="font-medium text-foreground">
                                              {formatDate(record.moveInDate)} –{" "}
                                              {formatDate(record.moveOutDate)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground block">
                                              Duration:
                                            </span>
                                            <span className="font-medium text-foreground">
                                              {record.stayDurationDays
                                                ? `${record.stayDurationDays} days`
                                                : "N/A"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
