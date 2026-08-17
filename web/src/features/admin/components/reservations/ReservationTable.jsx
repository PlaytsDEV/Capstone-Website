import { formatDate } from "../../utils/formatters";
import {
  normalizeReservationStatus,
  readMoveInDate,
  getReservationStatusLabel,
} from "../../../../shared/utils/lifecycleNaming";
import { TableSkeleton } from "../../../../shared/components/LoadingSkeletons";
import StatusBadge from "../shared/StatusBadge.jsx";

const toStatusKey = (status) =>
  String(normalizeReservationStatus(status) || status || "")
    .trim()
    .toLowerCase();

export function statusBadgeClass(status) {
  const key = toStatusKey(status);
  switch (key) {
    case "pending":
    case "pending_application_review":
    case "needs_revision":
    case "payment_pending":
    case "visit_pending":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
    case "viewing_preference_selected":
    case "visit_approved":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-300";
    case "approved_for_payment":
    case "reserved":
    case "confirmed":
    case "movein":
    case "moved_in":
    case "month":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "moveout":
    case "moved_out":
    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
    case "cancelled":
    case "rejected":
    case "overdue":
    case "no-show":
    case "no_show":
    case "noshow":
      return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300";
  }
}

export function statusLabel(status) {
  return getReservationStatusLabel(status);
}

export function checkOverdue(r) {
 if (!["pending", "reserved", "payment_pending"].includes(r.status)) return false;
 const moveIn = new Date(readMoveInDate(r));
 return !isNaN(moveIn.getTime()) && moveIn < new Date();
}

export default function ReservationTable({
  reservations,
  loading,
  error,
  LoadingComponent,
  onView,
  onDelete,
}) {
  if (loading) return LoadingComponent ? <LoadingComponent /> : <TableSkeleton rows={6} columns={6} />;
  if (error) return <div className="ar-error">Error: {error}</div>;
  if (!reservations || reservations.length === 0) {
    return (
      <div className="ar-empty">
        <p className="ar-empty-title">No reservations found</p>
        <p className="ar-empty-sub">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        className="ar-table"
        style={{ tableLayout: "fixed", width: "100%" }}
      >
        <thead>
          <tr>
            <th style={{ width: "12%" }}>Code</th>
            <th style={{ width: "24%" }}>Customer</th>
            <th style={{ width: "18%" }}>Room / Branch</th>
            <th style={{ width: "14%" }}>Move-in</th>
            <th style={{ width: "12%" }}>Status</th>
            <th style={{ width: "20%" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((r) => {
            const overdue = checkOverdue(r);
            return (
              <tr
                key={r.id}
                className={overdue ? "ar-row-overdue" : ""}
                onClick={() => onView(r.id)}
              >
                <td>
                  <span className="ar-cell-code">{r.reservationCode}</span>
                </td>
                <td>
                  <p className="ar-cell-name">{r.customer}</p>
                  <p className="ar-cell-sub">{r.email}</p>
                </td>
                <td>
                  <p className="ar-cell-name">{r.room}</p>
                  <p className="ar-cell-sub">{r.branch}</p>
                </td>
                <td>
                  <span className={`ar-cell-date ${overdue ? "overdue" : ""}`}>
                    {formatDate(readMoveInDate(r))}
                  </span>
                  {overdue && (
                    <span className="ar-badge ar-badge-overdue">Overdue</span>
                  )}
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="ar-actions">
                    <button
                      className="ar-btn ar-btn-view"
                      onClick={() => onView(r.id)}
                    >
                      View
                    </button>
                    {onDelete && (
                      <button
                        className="ar-btn ar-btn-delete"
                        onClick={() => onDelete(r.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
