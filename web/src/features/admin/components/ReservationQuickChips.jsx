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
  showTitle = true,
}) {
  const counts = useMemo(() => {
    let overdue = 0;
    let isNew = 0;
    let awaitingPayment = 0;
    let proofUploaded = 0;

    reservations.forEach((r) => {
      if (r.isArchived) return;
      if (checkOverdueReservation(r)) overdue++;
      if (r.isNew) isNew++;
      if (r.paymentStatus === "pending" && r.status === "approved_for_payment") awaitingPayment++;
      if (r.paymentStatus === "proof_uploaded") proofUploaded++;
    });

    return { overdue, isNew, awaitingPayment, proofUploaded };
  }, [reservations]);

  const chips = [
    {
      id: "new",
      label: "New Applications",
      count: counts.isNew,
      icon: Sparkles,
      color: "var(--success)",
      description: "Newly submitted applicant reservations",
    },
    {
      id: "overdue",
      label: "Overdue Move-In",
      count: counts.overdue,
      icon: AlertTriangle,
      color: "var(--danger)",
      description: "Reservations past scheduled move-in date",
    },
    {
      id: "awaiting_payment",
      label: "Awaiting Payment",
      count: counts.awaitingPayment,
      icon: CreditCard,
      color: "var(--info)",
      description: "Approved applications waiting for initial fee payment",
    },
    {
      id: "proof_uploaded",
      label: "Proof Uploaded",
      count: counts.proofUploaded,
      icon: FileCheck,
      color: "var(--primary)",
      description: "Payment proof uploaded, pending verification",
    },
  ];

  return (
    <div className="res-chip-strip" role="region" aria-label="Quick Filters">
      {showTitle && <span className="res-chip-strip__title">Quick Filters:</span>}
      <div className="res-chip-strip__list">
        {chips.map((chip) => {
          const isActive = activeChip === chip.id;
          const Icon = chip.icon;
          const hasItems = chip.count > 0;

          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSelectChip(isActive ? null : chip.id)}
              className={`res-chip ${isActive ? "res-chip--active" : ""}`}
              style={{ "--chip-accent": chip.color }}
              title={`${chip.label}: ${chip.count} reservation${chip.count === 1 ? "" : "s"} (${chip.description})`}
              aria-pressed={isActive}
            >
              <Icon
                size={14}
                style={{ color: isActive ? "currentColor" : chip.color }}
                aria-hidden="true"
              />
              <span>{chip.label}</span>
              <span
                className={`res-chip__count ${
                  hasItems ? "res-chip__count--highlight" : "res-chip__count--zero"
                }`}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

