import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useUnreadCount,
} from "../../../shared/hooks/queries/useNotifications";
import { useAuth } from "../../../shared/hooks/useAuth";
import { ListSkeleton } from "../../../shared/components/LoadingSkeletons";
import { getVisibleNotificationsForUser } from "../../../shared/utils/notificationVisibility";

const ALL_FILTER_TABS = [
  { key: "all",                   label: "All" },
  { key: "reservation_confirmed", label: "Reservations" },
  { key: "payment_approved",      label: "Payments",      tenantOnly: false },
  { key: "bill_generated",        label: "Billing",       tenantOnly: true },
  { key: "maintenance_update",    label: "Maintenance",   tenantOnly: true },
  { key: "announcement",          label: "Announcements" },
];

const TYPE_ICONS = {
  reservation_confirmed:  "✅",
  reservation_cancelled:  "❌",
  reservation_expired:    "⏰",
  reservation_noshow:     "🚫",
  visit_approved:         "🏠",
  visit_rejected:         "🚫",
  payment_approved:       "💳",
  payment_rejected:       "💳",
  bill_generated:         "📄",
  bill_due_reminder:      "⏰",
  penalty_applied:        "⚠️",
  contract_expiring:      "📋",
  grace_period_warning:   "⚠️",
  move_in_reminder:       "🏠",
  maintenance_update:     "🔧",
  account_suspended:      "🔒",
  account_reactivated:    "🔓",
  announcement:           "📢",
  general:                "ℹ️",
};


function matchesFilter(notification, filter) {
  if (filter === "all") return true;
  if (filter === "reservation_confirmed") {
    return notification.type.startsWith("reservation_") || notification.type.startsWith("visit_");
  }
  if (filter === "payment_approved") {
    return notification.type === "payment_approved" || notification.type === "payment_rejected";
  }
  if (filter === "bill_generated") {
    return ["bill_generated", "bill_due_reminder", "penalty_applied",
            "contract_expiring", "grace_period_warning"].includes(notification.type);
  }
  return notification.type === filter;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isApplicant = user?.role === "applicant";
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useNotifications(page, { unreadOnly });
  const { data: countData } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();

  const filterTabs = ALL_FILTER_TABS.filter((t) => !isApplicant || !t.tenantOnly);

  const allNotifications = getVisibleNotificationsForUser(data?.notifications || [], user);
  const totalPages = data?.pagination?.totalPages || 1;
  const unreadCount = countData?.unreadCount ?? 0;

  const filtered = allNotifications.filter((n) => matchesFilter(n, typeFilter));

  const handleClick = (notification) => {
    if (!notification.isRead) markAsRead.mutate(String(notification._id));
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
        <div>
          <h1
            style={{
              fontSize: 22, fontWeight: 700, color: "#0A1628",
              margin: 0, display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Bell size={20} color="#0A1628" />
            Notifications
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: "#D4AF37", color: "white",
                  fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "2px 8px",
                }}
              >
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>
            Reservation updates, billing alerts, and announcements
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8,
              border: "1px solid #E5E7EB", backgroundColor: "white",
              fontSize: 13, color: "#374151", cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setTypeFilter(tab.key); setPage(1); }}
            style={{
              padding: "5px 14px", borderRadius: 20, border: "1px solid",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              backgroundColor: typeFilter === tab.key ? "#0A1628" : "white",
              color: typeFilter === tab.key ? "white" : "#374151",
              borderColor: typeFilter === tab.key ? "#0A1628" : "#D1D5DB",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => { setUnreadOnly((prev) => !prev); setPage(1); }}
          style={{
            padding: "5px 14px", borderRadius: 20, border: "1px solid",
            fontSize: 12, fontWeight: 500, cursor: "pointer",
            backgroundColor: unreadOnly ? "#D4AF37" : "white",
            color: unreadOnly ? "white" : "#374151",
            borderColor: unreadOnly ? "#D4AF37" : "#D1D5DB",
            transition: "all 0.15s",
          }}
        >
          Unread only
        </button>
      </div>

      {/* List */}
      <div style={{ backgroundColor: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 12 }}>
            <ListSkeleton rows={5} avatar />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center" }}>
            <Bell size={36} style={{ color: "#D1D5DB", margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 15, fontWeight: 500, color: "#374151", margin: "0 0 4px" }}>
              No notifications
            </p>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>
              {unreadOnly ? "No unread notifications in this category." : "Nothing here yet — updates will appear as they happen."}
            </p>
          </div>
        ) : (
          filtered.map((n, index) => (
            <div
              key={n._id}
              onClick={() => handleClick(n)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(n); }}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 16px",
                borderBottom: index < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
                cursor: "pointer",
                backgroundColor: n.isRead ? "white" : "#FFFBEB",
                transition: "background-color 0.15s",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>
                {TYPE_ICONS[n.type] || "🔔"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: n.isRead ? 500 : 700, color: "#111827", margin: 0 }}>
                  {n.title}
                </p>
                <p style={{ fontSize: 13, color: "#6B7280", margin: "3px 0 0", lineHeight: 1.5 }}>
                  {n.message}
                </p>
                <span style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5, display: "block" }}>
                  {timeAgo(n.createdAt)}
                </span>
              </div>
              {!n.isRead && (
                <span
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    backgroundColor: "#D4AF37", flexShrink: 0, marginTop: 6,
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 20 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid #E5E7EB", backgroundColor: "white",
              fontSize: 13, color: "#374151",
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.4 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid #E5E7EB", backgroundColor: "white",
              fontSize: 13, color: "#374151",
              cursor: page === totalPages ? "not-allowed" : "pointer",
              opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
