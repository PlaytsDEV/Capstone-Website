import { formatDate } from "../../utils/formatters";
import {
 normalizeReservationStatus,
 readMoveInDate,
} from "../../../../shared/utils/lifecycleNaming";
import { TableSkeleton } from "../../../../shared/components/LoadingSkeletons";

const toStatusKey = (status) =>
 String(normalizeReservationStatus(status) || status || "")
 .trim()
 .replace(/\s+/g, "_");

export function statusBadgeClass(status) {
 switch (toStatusKey(status)) {
 case "pending":
 return "ar-badge-pending";
 case "viewing_preference_selected":
  return "ar-badge-default";
 case "visit_pending":
 return "ar-badge-default";
 case "visit_approved":
 return "ar-badge-confirmed";
 case "pending_application_review":
  return "ar-badge-pending";
 case "needs_revision":
  return "ar-badge-pending";
 case "approved_for_payment":
  return "ar-badge-confirmed";
 case "payment_pending":
 return "ar-badge-pending";
 case "reserved":
 case "confirmed":
 return "ar-badge-confirmed";
 case "moveIn":
 return "ar-badge-checkedin";
 case "moveOut":
 return "ar-badge-checkedout";
 case "cancelled":
 return "ar-badge-cancelled";
 case "rejected":
 return "ar-badge-rejected";
 default:
 return "ar-badge-default";
 }
}

export function statusLabel(status) {
 switch (toStatusKey(status)) {
 case "pending":
 return "Pending";
 case "viewing_preference_selected":
  return "Viewing Preference Selected";
 case "visit_pending":
 return "Visit Pending";
 case "visit_approved":
 return "Visit Approved";
 case "pending_application_review":
  return "Pending Review";
 case "needs_revision":
  return "Needs Revision";
 case "approved_for_payment":
  return "Approved for Payment";
 case "payment_pending":
 return "Payment Pending";
 case "reserved":
 return "Reserved";
 case "confirmed":
 return "Confirmed";
 case "moveIn":
 return "Moved In";
 case "moveOut":
 return "Moved Out";
 case "cancelled":
 return "Cancelled";
 case "rejected":
 return "Rejected";
 default:
 return status || "Unknown";
 }
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
 <span className={`ar-badge ${statusBadgeClass(r.status)}`}>
 {statusLabel(r.status)}
 </span>
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
