import { useState, useMemo } from "react";
import { Clock, CheckCircle2, DollarSign } from "lucide-react";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import RejectPaymentModal from "./RejectPaymentModal";
import PaymentTable from "./PaymentTable";
import { useReservations } from "../../../shared/hooks/queries/useReservations";
import { useQueryClient } from "@tanstack/react-query";
import { readMoveInDate } from "../../../shared/utils/lifecycleNaming";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import { exportReportPdf } from "../../../shared/utils/reportPdf";
import { useAuth } from "../../../shared/hooks/useAuth";
import {
 StatGridSkeleton,
 TableSkeleton,
} from "../../../shared/components/LoadingSkeletons";

function formatUpdatedAt(ts) {
 if (!ts) return "";
 const diff = Date.now() - ts;
 const secs = Math.floor(diff / 1000);
 if (secs < 10) return "just now";
 if (secs < 60) return `${secs}s ago`;
 const mins = Math.floor(secs / 60);
 if (mins < 60) return `${mins}m ago`;
 return `${Math.floor(mins / 60)}h ago`;
}

function PaymentRequestsTab() {
 const queryClient = useQueryClient();
 const { user } = useAuth();
 const isOwner = user?.role === "owner";
 const [actionLoading, setActionLoading] = useState(null);
 // Branch admins are scoped to their branch — owners can filter across all branches
 const [branchFilter, setBranchFilter] = useState(isOwner ? "all" : (user?.branch || "all"));
 const [confirmModal, setConfirmModal] = useState({
 open: false,
 title: "",
 message: "",
 variant: "info",
 onConfirm: null,
 });
 const [rejectModal, setRejectModal] = useState({ open: false, paymentId: null });

 const { data: rawReservations = [], isLoading: loading, dataUpdatedAt } = useReservations();

 const payments = useMemo(
 () =>
 rawReservations
 .filter((r) => Boolean(r.proofOfPaymentUrl))
 .map((res) => ({
 id: res._id,
 reservationCode: res.reservationCode || "N/A",
 customer:
 `${res.userId?.firstName || ""} ${res.userId?.lastName || ""}`.trim() ||
 "Unknown",
 email: res.userId?.email || res.billingEmail || "N/A",
 phone: res.mobileNumber || res.userId?.phone || "N/A",
 room: res.roomId?.name || res.roomId?.roomNumber || "Unknown",
 branch:
 res.roomId?.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe",
 totalPrice: res.totalPrice || 0,
 paymentStatus: res.paymentStatus || "pending",
 proofOfPaymentUrl: res.proofOfPaymentUrl,
 status: res.status,
 submittedDate: res.updatedAt,
 moveInDate: readMoveInDate(res),
 isOnlinePayment: Boolean(
  res.paymongoSessionId || res.paymongoPaymentId || res.paymentMethod === "paymongo",
 ),
 })),
 [rawReservations],
 );

 const refetchAll = () => {
 queryClient.invalidateQueries({ queryKey: ["reservations"] });
 };

 const handleVerifyPayment = (paymentId) => {
 if (actionLoading) return;
 setConfirmModal({
 open: true,
 title: "Verify Payment",
 message:
 "This will mark the payment as paid and confirm the reservation.",
 variant: "info",
 confirmText: "Verify Payment",
 onConfirm: async () => {
 setConfirmModal((p) => ({ ...p, open: false }));
 if (actionLoading) return;
 try {
 setActionLoading(paymentId);
 await reservationApi.update(paymentId, {
 paymentStatus: "paid",
 status: "reserved",
 });
 showNotification(
 "Payment verified! Reservation confirmed.",
 "success",
 3000,
 );
 refetchAll();
 } catch (error) {
 console.error("Error verifying payment:", error);
 showNotification("Failed to verify payment", "error", 3000);
 } finally {
 setActionLoading(null);
 }
 },
 });
 };

 const handleRejectPayment = (paymentId) => {
 if (actionLoading) return;
 setRejectModal({ open: true, paymentId });
 };

 const handleRejectConfirm = async (reason) => {
 const { paymentId } = rejectModal;
 setRejectModal({ open: false, paymentId: null });
 try {
 setActionLoading(paymentId);
 await reservationApi.update(paymentId, {
 paymentStatus: "pending",
 proofOfPaymentUrl: null,
 notes: `Payment rejected: ${reason}`,
 });
 showNotification(
 "Payment rejected. Tenant will need to resubmit proof.",
 "warning",
 3000,
 );
 refetchAll();
 } catch (error) {
 console.error("Error rejecting payment:", error);
 showNotification("Failed to reject payment", "error", 3000);
 } finally {
 setActionLoading(null);
 }
 };

 const handleViewProof = (url) => {
 if (url) window.open(url, "_blank");
 };

 const PAYMENT_CSV_COLUMNS = [
 { key: "reservationCode", label: "Reservation Code" },
 { key: "customer", label: "Tenant" },
 { key: "email", label: "Email" },
 { key: "phone", label: "Phone" },
 { key: "room", label: "Room" },
 { key: "branch", label: "Branch" },
 { key: "totalPrice", label: "Amount (₱)", formatter: (v) => (v || 0).toFixed(2) },
 { key: "paymentStatus", label: "Payment Status" },
 { key: "isOnlinePayment", label: "Source", formatter: (v) => (v ? "Online" : "Manual") },
 { key: "moveInDate", label: "Move-in Date", formatter: (v) => v ? new Date(v).toLocaleDateString("en-PH") : "" },
 { key: "submittedDate", label: "Submitted", formatter: (v) => v ? new Date(v).toLocaleDateString("en-PH") : "" },
 ];

 const handleExportCSV = () => {
 const rows = byBranch(payments);
 exportToCSV(rows, PAYMENT_CSV_COLUMNS, `payment_requests_${new Date().toISOString().slice(0, 10)}`);
 };

 const handleExportPDF = async () => {
 const branchLabel = branchFilter === "all" ? "All Branches" : branchFilter;
 await exportReportPdf({
 title: "Payment Requests Report",
 subtitle: `Scope: ${branchLabel} • ${new Date().toLocaleDateString("en-PH")}`,
 filename: `payment_requests_${branchFilter.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
 reportType: "Payments",
 kpis: [
 { label: "Pending Verification", value: pendingPayments.length },
 { label: "Verified Payments", value: verifiedPayments.length },
 { label: "Total Revenue", value: `₱${verifiedPayments.reduce((s, p) => s + p.totalPrice, 0).toLocaleString()}` },
 ],
 sections: [
 {
 title: "Pending Verifications",
 headers: ["Code", "Tenant", "Room", "Branch", "Amount", "Status"],
 rows: pendingPayments.map((p) => ({
 Code: p.reservationCode,
 Tenant: p.customer,
 Room: p.room,
 Branch: p.branch,
 Amount: `₱${(p.totalPrice || 0).toLocaleString()}`,
 Status: p.paymentStatus,
 })),
 type: "table",
 },
 {
 title: "Verified Payments",
 headers: ["Code", "Tenant", "Room", "Branch", "Amount", "Status"],
 rows: verifiedPayments.map((p) => ({
 Code: p.reservationCode,
 Tenant: p.customer,
 Room: p.room,
 Branch: p.branch,
 Amount: `₱${(p.totalPrice || 0).toLocaleString()}`,
 Status: p.paymentStatus,
 })),
 type: "table",
 },
 ],
 });
 };

 const byBranch = (list) =>
 branchFilter === "all" ? list : list.filter((p) => p.branch === branchFilter);

 const pendingPayments = byBranch(
 payments.filter((p) => p.paymentStatus === "pending" || p.paymentStatus === "partial"),
 );
 const verifiedPayments = byBranch(
 payments.filter((p) => p.paymentStatus === "paid"),
 );

 if (loading)
 return (
 <div style={{ display: "grid", gap: 20 }}>
 <StatGridSkeleton count={3} />
 <TableSkeleton rows={5} columns={7} />
 <TableSkeleton rows={4} columns={7} />
 </div>
 );

 return (
 <>
 <div>
 {/* Branch filter + export */}
 <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
   {isOwner && ["all", "Gil Puyat", "Guadalupe"].map((b) => (
   <button
    key={b}
    onClick={() => setBranchFilter(b)}
    style={{
    padding: "6px 16px",
    borderRadius: "20px",
    border: "1px solid",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    backgroundColor: branchFilter === b ? "#0A1628" : "white",
    color: branchFilter === b ? "white" : "#374151",
    borderColor: branchFilter === b ? "#0A1628" : "#D1D5DB",
    transition: "all 0.15s",
    }}
   >
    {b === "all" ? "All Branches" : b}
   </button>
   ))}
   </div>
  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
  {dataUpdatedAt > 0 && (
   <span style={{ fontSize: "12px", color: "#9CA3AF" }}>
   Updated {formatUpdatedAt(dataUpdatedAt)}
   </span>
  )}
  <button
   onClick={() => queryClient.invalidateQueries({ queryKey: ["reservations"] })}
   title="Refresh"
   style={{
   padding: "6px 10px",
   borderRadius: "8px",
   border: "1px solid #D1D5DB",
   fontSize: "13px",
   cursor: "pointer",
   backgroundColor: "white",
   color: "#374151",
   display: "flex",
   alignItems: "center",
   }}
  >
   ↻
  </button>
  <button
  onClick={handleExportCSV}
  disabled={payments.length === 0}
  style={{
   padding: "6px 16px",
   borderRadius: "8px",
   border: "1px solid #D1D5DB",
   fontSize: "13px",
   fontWeight: "500",
   cursor: payments.length === 0 ? "not-allowed" : "pointer",
   backgroundColor: "white",
   color: "#374151",
   opacity: payments.length === 0 ? 0.5 : 1,
   display: "flex",
   alignItems: "center",
   gap: "6px",
  }}
  >
  ⬇ Export CSV
  </button>
  <button
              onClick={handleExportPDF}
              disabled={payments.length === 0}
              style={{
                padding: "6px 16px",
                borderRadius: "8px",
                border: "1px solid #D1D5DB",
                fontSize: "13px",
                fontWeight: "500",
                cursor: payments.length === 0 ? "not-allowed" : "pointer",
                backgroundColor: "#0A1628",
                color: "white",
                opacity: payments.length === 0 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              📄 Export PDF
            </button>
  </div>
 </div>

  {/* Stats */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
    <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          Pending Verification
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          <Clock size={15} />
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-2">
        {pendingPayments.length}
      </div>
    </div>

    <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          Verified Payments
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 size={15} />
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2">
        {verifiedPayments.length}
      </div>
    </div>

    <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          Total Revenue
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
          <DollarSign size={15} />
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
        ₱{verifiedPayments.reduce((s, p) => s + p.totalPrice, 0).toLocaleString()}
      </div>
    </div>
  </div>

 <PaymentTable
 title={`💳 Pending Payment Verification (${pendingPayments.length})`}
 subtitle="Review payment proofs and verify to confirm reservations"
 headerBg="#FFFBEB"
 headerColor="#92400E"
 subColor="#B45309"
 emptyText="No pending payment verifications"
 payments={pendingPayments}
 showActions
 showSource
 actionLoading={actionLoading}
 onVerify={handleVerifyPayment}
 onReject={handleRejectPayment}
 onViewProof={handleViewProof}
 />

 <PaymentTable
 title={`✓ Verified Payments (${verifiedPayments.length})`}
 subtitle="Successfully verified and confirmed reservations"
 headerBg="#F0FDF4"
 headerColor="#047857"
 subColor="#059669"
 emptyText="No verified payments yet"
 payments={verifiedPayments}
 />
 </div>

 <ConfirmModal
 isOpen={confirmModal.open}
 onClose={() => !actionLoading && setConfirmModal((p) => ({ ...p, open: false }))}
 onConfirm={confirmModal.onConfirm}
 title={confirmModal.title}
 message={confirmModal.message}
 variant={confirmModal.variant}
 confirmText={confirmModal.confirmText || "Confirm"}
 loading={actionLoading !== null}
 />
 <RejectPaymentModal
 isOpen={rejectModal.open}
 onClose={() => !actionLoading && setRejectModal({ open: false, paymentId: null })}
 onConfirm={handleRejectConfirm}
 loading={actionLoading !== null}
 />
 </>
 );
}

export default PaymentRequestsTab;
