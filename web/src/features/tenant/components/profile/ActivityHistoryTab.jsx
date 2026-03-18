import React, { useMemo, useState } from "react";
import {
  Calendar,
  CreditCard,
  FileText,
  CheckCircle,
  Home,
  UserCheck,
  ClipboardCheck,
  Clock,
  History,
  XCircle,
} from "lucide-react";

/**
 * Activity History tab — derives a real timeline from the user's reservation data.
 * Receives the reservation object as a prop to avoid duplicate API calls.
 */

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const fmtDateTime = (d) =>
  new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatMethod = (m) => {
  const map = {
    gcash: "GCash",
    maya: "Maya",
    paymaya: "PayMaya",
    grab_pay: "GrabPay",
    card: "Credit/Debit Card",
    bank: "Bank Transfer",
    paymongo: "PayMongo",
    cash: "Cash",
    online: "Online Payment",
  };
  return map[m] || m || "Online";
};

/* ── Build timeline from reservation ─────────────── */
const buildTimeline = (r) => {
  if (!r) return [];
  const events = [];

  // 1. Reservation created
  if (r.createdAt) {
    events.push({
      id: "created",
      icon: Home,
      iconBg: "#EEF2FF",
      iconColor: "#0A1628",
      title: "Reservation Created",
      description: `Room ${r.roomId?.name || r.roomId?.roomNumber || "—"} selected`,
      date: r.createdAt,
      status: "Completed",
      statusColor: "#059669",
      statusBg: "#F0FDF4",
    });
  }

  // 2. Visit scheduled
  if (r.visitDate) {
    events.push({
      id: "visit-scheduled",
      icon: Calendar,
      iconBg: "#DBEAFE",
      iconColor: "#2563EB",
      title: "Visit Scheduled",
      description: `${r.viewingType === "virtual" ? "Virtual" : "In-person"} visit on ${fmtDate(r.visitDate)}${r.visitTime ? ` at ${r.visitTime}` : ""}`,
      date: r.visitDate,
      status: r.scheduleRejected ? "Rejected" : r.scheduleApproved ? "Approved" : "Pending",
      statusColor: r.scheduleRejected ? "#DC2626" : r.scheduleApproved ? "#059669" : "#D97706",
      statusBg: r.scheduleRejected ? "#FEF2F2" : r.scheduleApproved ? "#F0FDF4" : "#FFFBEB",
    });
  }

  // 3. Schedule rejected
  if (r.scheduleRejected && r.scheduleRejectedAt) {
    events.push({
      id: "schedule-rejected",
      icon: XCircle,
      iconBg: "#FEF2F2",
      iconColor: "#DC2626",
      title: "Visit Schedule Rejected",
      description: r.scheduleRejectionReason || "Admin requested reschedule",
      date: r.scheduleRejectedAt,
      status: "Rejected",
      statusColor: "#DC2626",
      statusBg: "#FEF2F2",
    });
  }

  // 4. Visit approved
  if (r.visitApproved) {
    events.push({
      id: "visit-approved",
      icon: CheckCircle,
      iconBg: "#F0FDF4",
      iconColor: "#059669",
      title: "Visit Completed & Approved",
      description: "Admin confirmed your visit — proceed to application",
      date: r.updatedAt,
      status: "Completed",
      statusColor: "#059669",
      statusBg: "#F0FDF4",
    });
  }

  // 5. Application submitted
  if (r.firstName && r.lastName && r.agreedToCertification) {
    events.push({
      id: "application",
      icon: ClipboardCheck,
      iconBg: "#F5F3FF",
      iconColor: "#7C3AED",
      title: "Application Submitted",
      description: `Personal details and documents submitted`,
      date: r.updatedAt,
      status: "Completed",
      statusColor: "#059669",
      statusBg: "#F0FDF4",
    });
  }

  // 6. Payment completed
  if (r.paymentDate) {
    events.push({
      id: "payment",
      icon: CreditCard,
      iconBg: "#ECFDF5",
      iconColor: "#059669",
      title: "Payment Confirmed",
      description: `Deposit paid via ${formatMethod(r.paymentMethod)}`,
      date: r.paymentDate,
      status: "Paid",
      statusColor: "#059669",
      statusBg: "#F0FDF4",
    });
  }

  // 7. Checked in
  if ((r.status === "checked-in" || r.reservationStatus === "checked-in") && r.checkInDate) {
    events.push({
      id: "checked-in",
      icon: UserCheck,
      iconBg: "#ECFDF5",
      iconColor: "#059669",
      title: "Checked In",
      description: `Moved in on ${fmtDate(r.checkInDate)}`,
      date: r.checkInDate,
      status: "Active",
      statusColor: "#059669",
      statusBg: "#F0FDF4",
    });
  }

  // Sort oldest first (chronological)
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
};

/* ── Main Component ──────────────────────────────── */
const ActivityHistoryTab = ({ reservation }) => {
  const events = useMemo(() => buildTimeline(reservation), [reservation]);

  if (events.length === 0) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <div style={s.heading}>
          <h1 style={s.title}>Activity Log</h1>
          <p style={s.subtitle}>Your reservation journey at a glance</p>
        </div>
        <div style={s.emptyState}>
          <History size={48} color="#D1D5DB" />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#374151", margin: "16px 0 8px" }}>
            No activity yet
          </h3>
          <p style={{ fontSize: 13, color: "#9CA3AF", maxWidth: 280 }}>
            Your reservation milestones will appear here once you start your journey.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={s.heading}>
        <h1 style={s.title}>Activity Log</h1>
        <p style={s.subtitle}>Your reservation journey at a glance</p>
      </div>

      {/* Timeline */}
      <div style={s.timeline}>
        {events.map((ev, i) => (
          <div key={ev.id} style={s.timelineItem}>
            {/* Connector line */}
            {i < events.length - 1 && <div style={s.connector} />}

            {/* Icon */}
            <div style={{ ...s.iconCircle, background: ev.iconBg }}>
              <ev.icon size={18} color={ev.iconColor} />
            </div>

            {/* Content */}
            <div style={s.content}>
              <div style={s.contentHeader}>
                <div style={{ flex: 1 }}>
                  <h4 style={s.eventTitle}>{ev.title}</h4>
                  <p style={s.eventDesc}>{ev.description}</p>
                </div>
                <span
                  style={{
                    ...s.badge,
                    background: ev.statusBg,
                    color: ev.statusColor,
                  }}
                >
                  {ev.status}
                </span>
              </div>
              <p style={s.eventDate}>
                <Clock size={12} style={{ marginRight: 4, opacity: 0.6 }} />
                {fmtDateTime(ev.date)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Styles ───────────────────────────────────────── */
const s = {
  heading: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: "#0A1628", margin: 0 },
  subtitle: { fontSize: 13, color: "#9CA3AF", marginTop: 4 },

  timeline: { position: "relative" },
  timelineItem: {
    display: "flex",
    gap: 14,
    position: "relative",
    paddingBottom: 24,
  },
  connector: {
    position: "absolute",
    left: 19,
    top: 44,
    bottom: 0,
    width: 2,
    background: "#E8EBF0",
    borderRadius: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
    zIndex: 1,
  },
  content: {
    flex: 1,
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #E8EBF0",
    padding: "14px 18px",
  },
  contentHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0A1628",
    margin: 0,
  },
  eventDesc: {
    fontSize: 13,
    color: "#6B7280",
    margin: "3px 0 0",
    lineHeight: 1.4,
  },
  eventDate: {
    display: "flex",
    alignItems: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 10,
  },
  badge: {
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 24px",
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #E8EBF0",
  },
};

export default ActivityHistoryTab;
