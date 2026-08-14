import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Wrench,
  Receipt,
  MessageSquareText,
  CalendarCheck,
  ShieldAlert,
  Info,
  Loader2,
  Inbox,
} from "lucide-react";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useUnreadCount,
} from "../../../shared/hooks/queries/useNotifications";
import { ListSkeleton } from "../../../shared/components/LoadingSkeletons";
import { cleanNotificationMessage } from "../../../shared/utils/notification";
import "../styles/design-tokens.css";
import "../styles/admin-notifications.css";

// ── Priority metadata per notification type ──────────────────────────────────

const TYPE_META = {
  sla_breach:          { label: "SLA Breach",       icon: AlertTriangle,    priority: "critical" },
  account_suspended:   { label: "Account",          icon: ShieldAlert,      priority: "critical" },
  grace_period_warning:{ label: "Grace Period",      icon: AlertTriangle,    priority: "high"     },
  maintenance_update:  { label: "Maintenance",       icon: Wrench,           priority: "high"     },
  maintenance_new:     { label: "Maintenance",       icon: Wrench,           priority: "high"     },
  penalty_applied:     { label: "Penalty",           icon: Receipt,          priority: "high"     },
  chat_unresponded:    { label: "Chat",              icon: MessageSquareText, priority: "high"    },
  inquiry_new:         { label: "Inquiry",           icon: MessageSquareText, priority: "high"    },
  bill_due_reminder:   { label: "Bill Reminder",     icon: Receipt,          priority: "medium"   },
  bill_generated:      { label: "Bill",              icon: Receipt,          priority: "medium"   },
  payment_proof_submitted: { label: "Payment Proof", icon: Receipt,          priority: "high"     },
  application_submitted:  { label: "Application",   icon: CalendarCheck,    priority: "high"     },
  contract_signed:     { label: "Contract Signed",   icon: CalendarCheck,    priority: "medium"   },
  contract_expiring:   { label: "Contract",          icon: CalendarCheck,    priority: "medium"   },
  contract_prepared:   { label: "Contract",          icon: CalendarCheck,    priority: "medium"   },
  contract_incomplete: { label: "Contract",          icon: AlertTriangle,    priority: "high"     },
  contract_error:      { label: "Contract",          icon: AlertTriangle,    priority: "high"     },
  payment_approved:    { label: "Payment",           icon: Receipt,          priority: "low"      },
  payment_rejected:    { label: "Payment",           icon: Receipt,          priority: "high"     },
  reservation_confirmed:{ label: "Reservation",     icon: CalendarCheck,    priority: "low"      },
  reservation_cancelled:{ label: "Reservation",     icon: CalendarCheck,    priority: "medium"   },
  reservation_cancellation_requested:{ label: "Cancellation", icon: AlertTriangle, priority: "high" },
  reservation_cancellation_rejected:{ label: "Cancellation", icon: CalendarCheck, priority: "medium" },
  reservation_expired: { label: "Reservation",      icon: CalendarCheck,    priority: "medium"   },
  reservation_noshow:  { label: "No-Show",           icon: CalendarCheck,    priority: "high"     },
  visit_requested:     { label: "Visit Request",     icon: CalendarCheck,    priority: "medium"   },
  visit_approved:      { label: "Visit",             icon: CalendarCheck,    priority: "low"      },
  visit_rejected:      { label: "Visit",             icon: CalendarCheck,    priority: "medium"   },
  account_reactivated: { label: "Account",           icon: ShieldAlert,      priority: "low"      },
  general:             { label: "General",           icon: Info,             priority: "low"      },
};

const FILTER_TYPES = [
  { key: "all",              label: "All" },
  { key: "sla_breach",       label: "SLA Breach" },
  { key: "maintenance_update", label: "Maintenance" },
  { key: "bill_generated",   label: "Billing" },
  { key: "reservation",      label: "Reservations" },
  { key: "chat_unresponded", label: "Chat" },
  { key: "general",          label: "General" },
];

const ACTION_URLS = {
  sla_breach:          "/admin/maintenance?quickFilter=delayed",
  maintenance_update:  "/admin/maintenance",
  maintenance_new:     "/admin/maintenance",
  chat_unresponded:    "/admin/chat",
  inquiry_new:         "/admin/reservations?tab=inquiries",
  bill_generated:      "/admin/billing",
  bill_due_reminder:   "/admin/billing",
  penalty_applied:     "/admin/billing",
  payment_approved:    "/admin/billing",
  payment_rejected:    "/admin/billing",
  payment_proof_submitted: "/admin/billing",
  application_submitted:  "/admin/reservations",
  contract_signed:     "/admin/contracts",
  visit_requested:     "/admin/reservations?tab=visits",
  reservation_confirmed:"/admin/reservations",
  reservation_cancelled:"/admin/reservations",
  reservation_cancellation_requested:"/admin/reservations",
  reservation_cancellation_rejected:"/admin/reservations",
  reservation_expired: "/admin/reservations",
  reservation_noshow:  "/admin/reservations",
  visit_approved:      "/admin/reservations",
  visit_rejected:      "/admin/reservations",
  contract_expiring:   "/admin/tenants",
  grace_period_warning:"/admin/reservations",
  account_suspended:   "/admin/users",
  account_reactivated: "/admin/users",
};

function getMeta(type) {
  return TYPE_META[type] || { label: "Notification", icon: Bell, priority: "low" };
}

function getActionUrl(notification) {
  if (
    notification.type === "reservation_cancellation_requested" &&
    notification.entityId
  ) {
    return `/admin/reservations?reservationId=${encodeURIComponent(
      notification.entityId,
    )}&focus=cancellation`;
  }
  return notification.actionUrl || ACTION_URLS[notification.type] || null;
}

function fmtRelative(dateValue) {
  if (!dateValue) return "";
  const diff = Date.now() - new Date(dateValue).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateValue).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export default function AdminNotificationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useNotifications(page, { unreadOnly });
  const { data: countData } = useUnreadCount();
  const markAsReadMutation = useMarkAsRead();
  const markAllMutation = useMarkAllAsRead();

  const notifications = data?.notifications || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const unreadCount = countData?.unreadCount ?? 0;

  // Client-side type filter
  const filtered =
    typeFilter === "all"
      ? notifications
      : notifications.filter((n) => {
          if (typeFilter === "bill_generated") {
            return ["bill_generated", "bill_due_reminder", "penalty_applied",
                    "payment_approved", "payment_rejected", "payment_proof_submitted"].includes(n.type);
          }
          if (typeFilter === "maintenance_update") {
            return ["maintenance_update", "maintenance_new", "sla_breach"].includes(n.type);
          }
          if (typeFilter === "reservation") {
            return [
              "reservation_confirmed",
              "reservation_cancelled",
              "reservation_cancellation_requested",
              "reservation_cancellation_rejected",
              "reservation_expired",
              "reservation_noshow",
              "application_submitted",
              "contract_signed",
              "visit_requested",
              "visit_approved",
              "visit_rejected",
              "grace_period_warning",
              "inquiry_new",
            ].includes(n.type);
          }
          return n.type === typeFilter;
        });

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(String(notification._id));
    }
    const url = getActionUrl(notification);
    if (url) navigate(url);
  };

  const handleMarkAllRead = () => {
    markAllMutation.mutate();
  };

  return (
    <div className="admin-notif-page">
      {/* ── Header ── */}
      <div className="admin-notif-page__header">
        <div className="admin-notif-page__title-group">
          <h1 className="admin-notif-page__title">
            Notifications
          </h1>
          <p className="admin-notif-page__subtitle">
            System alerts, SLA breaches, billing events, and workflow updates.
          </p>
        </div>
        <button
          type="button"
          className="admin-notif-page__mark-all-btn"
          onClick={handleMarkAllRead}
          disabled={markAllMutation.isPending || unreadCount === 0}
        >
          {markAllMutation.isPending ? (
            <Loader2 size={14} className="admin-notif__spin" />
          ) : (
            <CheckCheck size={14} />
          )}
          Mark all read
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="admin-notif-page__filters">
        <div className="admin-notif-page__type-tabs">
          {FILTER_TYPES.map((ft) => (
            <button
              key={ft.key}
              type="button"
              className={`admin-notif-page__type-tab ${typeFilter === ft.key ? "is-active" : ""}`}
              onClick={() => { setTypeFilter(ft.key); setPage(1); }}
            >
              {ft.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`admin-notif-page__unread-toggle ${unreadOnly ? "is-active" : ""}`}
          onClick={() => { setUnreadOnly((v) => !v); setPage(1); }}
        >
          Unread only
        </button>
      </div>

      {/* ── List ── */}
      <div className="admin-notif-page__list">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={`notif-skel-${i}`} className="admin-notif-page__item opacity-60 p-4 border-b border-border flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-48 rounded bg-muted animate-pulse mb-2" />
                <div className="h-3 w-3/4 rounded bg-muted animate-pulse mb-2" />
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="admin-notif-page__state">
            <Inbox size={28} />
            <strong>No notifications</strong>
            <span>
              {unreadOnly ? "No unread notifications." : "Nothing to show for the current filter."}
            </span>
          </div>
        ) : (
          filtered.map((notification) => {
            const meta = getMeta(notification.type);
            const Icon = meta.icon;
            const isUnread = !notification.isRead;
            const isClickable = !!getActionUrl(notification);

            return (
              <div
                key={notification._id || notification.id}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                className={[
                  "admin-notif-item",
                  `admin-notif-item--${meta.priority}`,
                  isUnread ? "admin-notif-item--unread" : "",
                  isClickable ? "admin-notif-item--clickable" : "",
                ].join(" ")}
                onClick={isClickable ? () => handleNotificationClick(notification) : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => e.key === "Enter" && handleNotificationClick(notification)
                    : undefined
                }
              >
                <div className={`admin-notif-item__icon-wrap admin-notif-item__icon-wrap--${meta.priority}`}>
                  <Icon size={16} />
                </div>

                <div className="admin-notif-item__body">
                  <div className="admin-notif-item__top">
                    <span className="admin-notif-item__title">{notification.title}</span>
                    <time className="admin-notif-item__time">
                      {fmtRelative(notification.createdAt)}
                    </time>
                  </div>
                  <p className="admin-notif-item__message">{cleanNotificationMessage(notification.message)}</p>
                  <span className={`admin-notif-item__type-tag admin-notif-item__type-tag--${meta.priority}`}>
                    {meta.label}
                  </span>
                </div>

                {isUnread && <span className="admin-notif-item__dot" aria-label="Unread" />}
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="admin-notif-page__pagination">
          <button
            type="button"
            className="admin-notif-page__page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="admin-notif-page__page-label">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="admin-notif-page__page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
