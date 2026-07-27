import React, { useMemo } from "react";
import { AlertTriangle, Clock, CreditCard, FileCheck, Sparkles } from "lucide-react";
import {
  checkOverdueReservation,
  hasPendingCancellationRequest,
} from "../utils/reservationRows";

export default function ReservationQuickChips({
  reservations = [],
  activeChip = null,
  onSelectChip,
}) {
  const counts = useMemo(() => {
    let overdue = 0;
    let isNew = 0;
    let cancellation = 0;
    let awaitingPayment = 0;
    let proofUploaded = 0;

    reservations.forEach((r) => {
      if (r.isArchived) return;
      if (checkOverdueReservation(r)) overdue++;
      if (r.isNew) isNew++;
      if (hasPendingCancellationRequest(r)) cancellation++;
      if (r.paymentStatus === "pending" && r.status === "approved_for_payment") awaitingPayment++;
      if (r.paymentStatus === "proof_uploaded") proofUploaded++;
    });

    return { overdue, isNew, cancellation, awaitingPayment, proofUploaded };
  }, [reservations]);

  const chips = [
    {
      id: "overdue",
      label: "Overdue Move-In",
      count: counts.overdue,
      icon: AlertTriangle,
      color: "var(--danger)",
    },
    {
      id: "new",
      label: "New Applications",
      count: counts.isNew,
      icon: Sparkles,
      color: "var(--success)",
    },
    {
      id: "cancellation",
      label: "Cancellation Requested",
      count: counts.cancellation,
      icon: Clock,
      color: "var(--warning)",
    },
    {
      id: "awaiting_payment",
      label: "Awaiting Payment",
      count: counts.awaitingPayment,
      icon: CreditCard,
      color: "var(--info)",
    },
    {
      id: "proof_uploaded",
      label: "Proof Uploaded",
      count: counts.proofUploaded,
      icon: FileCheck,
      color: "var(--primary)",
    },
  ];

  return (
    <div className="res-chip-strip">
      <span className="res-chip-strip__title">Quick Filter:</span>
      <div className="res-chip-strip__list">
        {chips.map((chip) => {
          const isActive = activeChip === chip.id;
          const Icon = chip.icon;

          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSelectChip(isActive ? null : chip.id)}
              className={`res-chip ${isActive ? "res-chip--active" : ""}`}
            >
              <Icon size={14} style={{ color: isActive ? "currentColor" : chip.color }} />
              <span>{chip.label}</span>
              <span className="res-chip__count">{chip.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
