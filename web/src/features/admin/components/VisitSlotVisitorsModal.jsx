import React from "react";
import {
  Users,
  X,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Building2,
  Video,
  Eye,
  Loader2,
} from "lucide-react";
import { useVisitSlotVisitors } from "../../../shared/hooks/queries/useReservations";

function formatFormattedDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SlotVisitorsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
          <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export default function VisitSlotVisitorsModal({
  isOpen,
  onClose,
  branch,
  date,
  slot,
  onInspectReservation,
}) {
  if (!isOpen || !date || !slot) return null;

  const { data, isLoading, isError } = useVisitSlotVisitors(branch, date, slot, {
    enabled: isOpen && Boolean(branch) && Boolean(date) && Boolean(slot),
  });

  const payload = data?.data || data || {};
  const visitors = payload.visitors || [];
  const totalBooked = payload.totalBooked || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slot-visitors-modal-title"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="slot-visitors-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {slot} Booked Visitors
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatFormattedDate(date)}</span>
                <span>&bull;</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {totalBooked} {totalBooked === 1 ? "visitor" : "visitors"} scheduled
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close visitor list modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {isLoading ? (
            <SlotVisitorsSkeleton />
          ) : isError ? (
            <div className="p-6 text-center text-slate-500 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/40">
              <p className="font-semibold text-red-700 dark:text-red-400">
                Failed to load visitor list
              </p>
              <p className="text-[11px] mt-1">Please try closing and re-opening the window.</p>
            </div>
          ) : visitors.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <Clock className="w-7 h-7 text-slate-400 mx-auto opacity-70" />
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                No Bookings for this Slot
              </h4>
              <p className="text-slate-500 text-[11px]">
                There are currently no active visitor reservations scheduled for {slot} on{" "}
                {formatFormattedDate(date)}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visitors.map((visitor, idx) => (
                <div
                  key={visitor.reservationId || idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700">
                        {visitor.tenantName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {visitor.tenantName}
                        </h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>Room: {visitor.roomNumber}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Viewing Type Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                          visitor.viewingType === "remote_2d_viewing"
                            ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50"
                            : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                        }`}
                      >
                        {visitor.viewingType === "remote_2d_viewing" ? (
                          <>
                            <Video className="w-3 h-3" />
                            2D Remote
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            In-Person
                          </>
                        )}
                      </span>

                      {/* Status Badge */}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {visitor.status}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info Footer */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex flex-wrap items-center gap-3">
                      {visitor.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {visitor.email}
                        </span>
                      )}
                      {visitor.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {visitor.phone}
                        </span>
                      )}
                    </div>

                    {onInspectReservation && (
                      <button
                        type="button"
                        onClick={() => {
                          onInspectReservation(visitor.reservationId);
                          onClose();
                        }}
                        className="text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        View Full Card &rarr;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
