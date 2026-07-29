import { useState } from "react";
import { Eye, FileText, ArrowRight, Download, Loader } from "lucide-react";
import { fmtCurrency, fmtDate, fmtMonth } from "../../utils/formatters";
import { TableSkeleton } from "../../../../../shared/components/LoadingSkeletons";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function downloadTransferSettlementPdf(billId) {
  const res = await fetch(`${API_BASE}/api/billing/transfer-settlement/${billId}/pdf`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("PDF generation failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transfer-settlement-${billId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function RoomTag({ name, type }) {
  if (!name) return null;
  return (
    <span
      title={type ? `${name} (${type})` : name}
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 600,
        padding: "1px 6px",
        borderRadius: 4,
        background: "hsl(220 14% 93%)",
        color: "hsl(220 14% 35%)",
        marginTop: 2,
        maxWidth: 120,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

function TransferPdfButton({ billId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await downloadTransferSettlementPdf(billId);
    } catch {
      setError("PDF failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="action-btn"
      title={error || "Download Transfer Settlement PDF"}
      onClick={handleClick}
      disabled={loading}
      style={{ color: error ? "hsl(0 72% 51%)" : "hsl(210 60% 45%)" }}
    >
      {loading ? <Loader size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={15} />}
    </button>
  );
}

export default function BillsTable({ bills, loading, onViewBill }) {
  if (loading) {
    return (
      <div className="table-container">
        <TableSkeleton rows={6} columns={10} style={{ border: 0 }} />
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="table-container">
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileText size={32} />
          </div>
          <p>No bills found</p>
          <p className="empty-state-hint">
            Click a room above to generate bills
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Month</th>
            <th>Cycle</th>
            <th>Rent</th>
            <th>Utilities</th>
            <th>Credit</th>
            <th>Total</th>
            <th>Status</th>
            <th>Due</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => {
            const utilities =
              (bill.charges?.electricity || 0) +
              (bill.charges?.water || 0) +
              (bill.charges?.applianceFees || 0) +
              (bill.charges?.corkageFees || 0);
            const isTransferSettlement = bill.billType === "transfer_settlement";
            const snap = bill.transferSnapshot;

            // Resolve room tag: prefer roomId.name, fall back to snap.fromRoomName
            const roomTagName = bill.roomId?.name || bill.roomId?.roomNumber || snap?.fromRoomName || null;
            const roomTagType = bill.roomId?.type || snap?.fromRoomType || null;

            return (
              <tr
                key={bill._id}
                style={isTransferSettlement ? { background: "hsl(210 40% 98%)" } : undefined}
              >
                <td>
                  <div className="tenant-cell">
                    <span className="tenant-name">
                      {bill.userId?.firstName} {bill.userId?.lastName}
                    </span>
                    <span className="tenant-email">{bill.userId?.email}</span>
                    {/* Room tag on every bill */}
                    <RoomTag name={roomTagName} type={roomTagType} />
                    {/* Transfer direction indicator */}
                    {isTransferSettlement && snap?.fromRoomName && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          color: "hsl(220 14% 50%)",
                          marginTop: 2,
                        }}
                      >
                        {snap.fromRoomName}
                        <ArrowRight size={10} />
                        {snap.toRoomName}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {isTransferSettlement ? (
                    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "hsl(210 60% 92%)",
                          color: "hsl(210 60% 30%)",
                          width: "fit-content",
                        }}
                      >
                        TRANSFER
                      </span>
                      <span style={{ fontSize: 12 }}>{fmtDate(bill.billingCycleEnd)}</span>
                    </span>
                  ) : (
                    fmtMonth(bill.billingMonth)
                  )}
                </td>
                <td>
                  {bill.billingCycleStart && bill.billingCycleEnd
                    ? `${fmtDate(bill.billingCycleStart)} - ${fmtDate(bill.billingCycleEnd)}`
                    : "—"}
                </td>
                <td className="amount-cell">
                  {fmtCurrency(bill.charges?.rent)}
                  {isTransferSettlement && bill.proRataDays ? (
                    <span style={{ display: "block", fontSize: 10, color: "hsl(220 14% 55%)" }}>
                      {bill.proRataDays}d pro-rata
                    </span>
                  ) : null}
                </td>
                <td className="amount-cell">
                  {fmtCurrency(utilities)}
                  {/* Show electricity kWh estimate on transfer bills */}
                  {isTransferSettlement && snap?.estimatedElectricityKwh != null && (
                    <span style={{ display: "block", fontSize: 10, color: "hsl(220 14% 55%)" }}>
                      {snap.estimatedElectricityKwh.toLocaleString()} kWh
                    </span>
                  )}
                </td>
                <td className="amount-cell">
                  {bill.reservationCreditApplied
                    ? `-${fmtCurrency(bill.reservationCreditApplied)}`
                    : "—"}
                </td>
                <td className="amount-cell">{fmtCurrency(bill.totalAmount)}</td>
                <td>
                  <span className={`badge status-${bill.status}`}>
                    {bill.status}
                  </span>
                </td>
                <td>{fmtDate(bill.dueDate)}</td>
                <td style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button
                    className="action-btn"
                    title="View details"
                    onClick={() => onViewBill(bill)}
                  >
                    <Eye size={16} />
                  </button>
                  {isTransferSettlement && (
                    <TransferPdfButton billId={bill._id} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
