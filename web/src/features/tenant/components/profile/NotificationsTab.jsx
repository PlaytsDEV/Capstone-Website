/**
 * ============================================================================
 * NotificationsTab — Real Notification Display
 * ============================================================================
 *
 * Connects to the existing notification backend via useNotifications hooks.
 *
 * Features:
 * - Paginated notification list
 * - Unread dot indicator
 * - "Mark all as read" button
 * - Type-based icons
 * - Grouped by date
 * - Empty state
 * - Filter tabs by category + unread toggle
 *
 * ============================================================================
 */

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
	Bell,
	Check,
	CheckCheck,
	Calendar,
	CreditCard,
	Wrench,
	Home,
	Megaphone,
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	Filter,
} from "lucide-react";
import {
	useNotifications,
	useMarkAsRead,
	useMarkAllAsRead,
} from "../../../../shared/hooks/queries/useNotifications";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { ListSkeleton } from "../../../../shared/components/LoadingSkeletons";
import { getVisibleNotificationsForUser } from "../../../../shared/utils/notificationVisibility";
import {
	formatNotificationTitle,
	cleanNotificationMessage,
} from "../../../../shared/utils/notification";
import "../../../admin/styles/design-tokens.css";

// ── Filter tabs per role ──
const ALL_FILTER_TABS = [
	{ key: "all", label: "All", roles: ["applicant", "tenant"] },
	{ key: "reservation", label: "Reservations", roles: ["applicant"] },
	{ key: "application", label: "Applications", roles: ["applicant"] },
	{ key: "visit", label: "Visits", roles: ["applicant"] },
	{ key: "payment", label: "Payments", roles: ["applicant", "tenant"] },
	{ key: "billing", label: "Billing", roles: ["tenant"] },
	{ key: "maintenance", label: "Maintenance", roles: ["tenant"] },
	{ key: "announcement", label: "Announcements", roles: ["tenant"] },
];

// ── Filter matcher ──
function matchesFilter(notification, filter) {
	if (filter === "all") return true;
	if (filter === "reservation") {
		return notification.type.startsWith("reservation_");
	}
	if (filter === "application") {
		return notification.type === "general" && notification.title?.toLowerCase().includes("application");
	}
	if (filter === "visit") {
		return notification.type.startsWith("visit_") ||
			notification.title?.toLowerCase().includes("viewing") ||
			notification.title?.toLowerCase().includes("visit");
	}
	if (filter === "payment") {
		return notification.type === "payment_approved" || notification.type === "payment_rejected";
	}
	if (filter === "billing") {
		return ["bill_generated", "bill_due_reminder", "penalty_applied",
			"contract_expiring", "grace_period_warning"].includes(notification.type);
	}
	if (filter === "maintenance") {
		return notification.type === "maintenance_update";
	}
	if (filter === "announcement") {
		return notification.type === "announcement";
	}
	return notification.type === filter;
}

// ── Notification semantic color schemes (Strict Standard Objectives) ──
const NOTIFICATION_COLOR_SCHEMES = {
	success: {
		icon: "#059669",
		dot: "#059669",
	},
	danger: {
		icon: "#DC2626",
		dot: "#DC2626",
	},
	warning: {
		icon: "#D97706",
		dot: "#D97706",
	},
	info: {
		icon: "#2563EB",
		dot: "#2563EB",
	},
	neutral: {
		icon: "#64748B",
		dot: "#64748B",
	},
};

// ── Notification type → icon + color mapping ──
const TYPE_CONFIG = {
	reservation_confirmed: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.success, label: "Confirmed" },
	reservation_cancelled: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.danger, label: "Cancelled" },
	reservation_expired: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.warning, label: "Expired" },
	reservation_noshow: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.danger, label: "No-Show" },
	reservation_cancellation_requested: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.warning, label: "Under Review" },
	reservation_cancellation_rejected: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.danger, label: "Rejected" },
	visit_requested: { icon: Home, colors: NOTIFICATION_COLOR_SCHEMES.warning, label: "Scheduled" },
	visit_approved: { icon: Home, colors: NOTIFICATION_COLOR_SCHEMES.success, label: "Confirmed" },
	visit_rejected: { icon: Home, colors: NOTIFICATION_COLOR_SCHEMES.danger, label: "Rejected" },
	payment_approved: { icon: CreditCard, colors: NOTIFICATION_COLOR_SCHEMES.success, label: "Approved" },
	payment_rejected: { icon: CreditCard, colors: NOTIFICATION_COLOR_SCHEMES.danger, label: "Rejected" },
	bill_generated: { icon: CreditCard, colors: NOTIFICATION_COLOR_SCHEMES.info, label: "Bill Issued" },
	bill_due_reminder: { icon: AlertCircle, colors: NOTIFICATION_COLOR_SCHEMES.warning, label: "Due Soon" },
	grace_period_warning: { icon: AlertCircle, colors: NOTIFICATION_COLOR_SCHEMES.warning, label: "Grace Period" },
	penalty_applied: { icon: AlertCircle, colors: NOTIFICATION_COLOR_SCHEMES.warning, label: "Penalty Applied" },
	contract_expiring: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.warning, label: "Expiring Soon" },
	contract_document_ready: { icon: Calendar, colors: NOTIFICATION_COLOR_SCHEMES.info, label: "Ready for Signing" },
	move_in_reminder: { icon: Home, colors: NOTIFICATION_COLOR_SCHEMES.info, label: "Move-In Notice" },
	account_suspended: { icon: AlertCircle, colors: NOTIFICATION_COLOR_SCHEMES.danger, label: "Suspended" },
	account_reactivated: { icon: Check, colors: NOTIFICATION_COLOR_SCHEMES.success, label: "Reactivated" },
	maintenance_update: { icon: Wrench, colors: NOTIFICATION_COLOR_SCHEMES.info, label: "Update" },
	announcement: { icon: Megaphone, colors: NOTIFICATION_COLOR_SCHEMES.info, label: "Announcement" },
	general: { icon: Bell, colors: NOTIFICATION_COLOR_SCHEMES.neutral, label: "Notice" },
};

/**
 * Resolves notification icon, verb label, and color object scheme.
 * Dynamically detects action verbs and lifecycle states from title/message content.
 */
function getNotificationConfig(notification = {}) {
	const type = notification.type;
	const baseConfig = TYPE_CONFIG[type] || TYPE_CONFIG.general;

	let label = baseConfig.label;
	let colors = baseConfig.colors;

	const title = (notification.title || "").toLowerCase();
	const message = (notification.message || "").toLowerCase();

	// Priority 1: Specific Under Review / In-Progress states (Amber)
	if (
		title.includes("pending review") ||
		title.includes("under review") ||
		title.includes("application pending") ||
		title.includes("in progress") ||
		title.includes("awaiting")
	) {
		label = "Under Review";
		colors = NOTIFICATION_COLOR_SCHEMES.warning;
	} else if (
		title.includes("revision") ||
		title.includes("needs revision") ||
		message.includes("does not meet the requirements") ||
		message.includes("please upload a clear") ||
		message.includes("re-upload")
	) {
		label = "Needs Revision";
		colors = NOTIFICATION_COLOR_SCHEMES.warning;
	} else if (
		title.includes("visit complete") ||
		title.includes("physical visit complete") ||
		title.includes("move-in complete") ||
		title.includes("move-out complete") ||
		title.includes("resolved") ||
		title.includes("completed")
	) {
		label = "Completed";
		colors = NOTIFICATION_COLOR_SCHEMES.success;
	} else if (
		title.includes("approved") ||
		title.includes("confirmed")
	) {
		label = title.includes("confirmed") ? "Confirmed" : "Approved";
		colors = NOTIFICATION_COLOR_SCHEMES.success;
	} else if (
		title.includes("rejected") ||
		title.includes("declined") ||
		title.includes("cancelled") ||
		title.includes("canceled") ||
		title.includes("suspended")
	) {
		label = title.includes("cancelled") || title.includes("canceled") ? "Cancelled" : "Rejected";
		colors = NOTIFICATION_COLOR_SCHEMES.danger;
	} else if (
		title.includes("scheduled")
	) {
		label = "Scheduled";
		colors = NOTIFICATION_COLOR_SCHEMES.warning;
	} else if (
		type === "announcement" ||
		title.includes("announcement") ||
		title.includes("broadcast")
	) {
		label = "Announcement";
		colors = NOTIFICATION_COLOR_SCHEMES.info;
	} else if (
		type === "chat_reply" ||
		title.includes("admin reply") ||
		title.includes("inquiry")
	) {
		label = "Inquiry";
		colors = NOTIFICATION_COLOR_SCHEMES.info;
	}

	return {
		icon: baseConfig.icon,
		colors,
		label,
	};
}

// ── Date grouping helper ──
const getDateLabel = (dateStr) => {
	const date = new Date(dateStr);
	const now = new Date();
	const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

	if (diff === 0) return "Today";
	if (diff === 1) return "Yesterday";
	if (diff < 7) return `${diff} days ago`;
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
	});
};

const formatTime = (dateStr) => {
	return new Date(dateStr).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

// ── Filter pill styles (High Contrast Minimalist) ──
const getFilterPillStyle = (isActive) => ({
	padding: "6px 14px",
	borderRadius: "20px",
	border: "1px solid",
	fontSize: "12px",
	fontWeight: isActive ? 600 : 500,
	cursor: "pointer",
	backgroundColor: isActive ? "#0F172A" : "var(--card)",
	color: isActive ? "#FFFFFF" : "var(--text-secondary)",
	borderColor: isActive ? "#0F172A" : "var(--border)",
	transition: "all 0.18s ease",
	whiteSpace: "nowrap",
});

// ── Component ──

const NotificationsTab = () => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const [page, setPage] = useState(1);
	const [typeFilter, setTypeFilter] = useState("all");
	const [unreadOnly, setUnreadOnly] = useState(false);
	const { data, isLoading, error } = useNotifications(page, { unreadOnly });
	const markAsRead = useMarkAsRead();
	const markAllAsRead = useMarkAllAsRead();

	const notifications = getVisibleNotificationsForUser(data?.notifications || [], user);
	const pagination = data?.pagination || {};
	const unreadCount = data?.unreadCount || 0;
	const isApplicant = user?.role === "applicant";

	const currentRole = isApplicant ? "applicant" : "tenant";
	const filterTabs = ALL_FILTER_TABS.filter((t) => t.roles.includes(currentRole));

	// Apply type filter
	const filtered = useMemo(
		() => notifications.filter((n) => matchesFilter(n, typeFilter)),
		[notifications, typeFilter],
	);

	// Group filtered notifications by date
	const grouped = useMemo(() => {
		const groups = {};
		filtered.forEach((n) => {
			const label = getDateLabel(n.createdAt);
			if (!groups[label]) groups[label] = [];
			groups[label].push(n);
		});
		return groups;
	}, [filtered]);

	const handleMarkRead = (id) => {
		markAsRead.mutate(id);
	};

	const handleMarkAllRead = () => {
		markAllAsRead.mutate();
	};

	const handleNotificationClick = (notification) => {
		if (!notification.isRead) {
			markAsRead.mutate(notification._id);
		}
		if (notification.type === "announcement") {
			navigate("/applicant/announcements");
		} else if (notification.actionUrl) {
			navigate(notification.actionUrl);
		}
	};

	const handleFilterChange = (key) => {
		setTypeFilter(key);
		setPage(1);
	};

	const handleToggleUnread = () => {
		setUnreadOnly((prev) => !prev);
		setPage(1);
	};

	// ── Styles ──
	const cardStyle = {
		backgroundColor: "var(--card)",
		borderRadius: "12px",
		border: "1px solid var(--border)",
		overflow: "hidden",
	};

	return (
		<div style={{ width: "100%", maxWidth: "100%" }}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "16px",
				}}
			>
				<div>
					<h1
						style={{
							fontSize: "22px",
							fontWeight: 700,
							color: "var(--foreground)",
							margin: "0 0 4px",
						}}
					>
						Notifications
					</h1>
					<p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
						{isApplicant
							? "Stay updated on your reservation, visit, and application progress"
							: "Stay updated on billing, maintenance, contracts, and account notices"}
					</p>
				</div>

				<button
					onClick={handleMarkAllRead}
					disabled={markAllAsRead.isPending || unreadCount === 0}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "6px",
						backgroundColor: "transparent",
						border: "1px solid var(--border)",
						borderRadius: "8px",
						padding: "8px 14px",
						fontSize: "13px",
						fontWeight: 500,
						color: "var(--text-secondary)",
						cursor: unreadCount === 0 ? "default" : "pointer",
						opacity: unreadCount === 0 ? 0 : 1,
						visibility: unreadCount === 0 ? "hidden" : "visible",
						transition: "all 0.2s",
					}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = "var(--muted)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
						}}
					>
						<CheckCheck style={{ width: "14px", height: "14px" }} />
						Mark all as read
					</button>
			</div>

			{/* Filter pills */}
			<div
				className="notif-filter-scroll"
				style={{
					display: "flex",
					gap: "8px",
					marginBottom: "20px",
					flexWrap: "nowrap",
					alignItems: "center",
					overflowX: "auto",
					paddingBottom: "4px",
					scrollbarWidth: "none",
					WebkitOverflowScrolling: "touch",
				}}
			>
				{filterTabs.map((tab) => (
					<button
						key={tab.key}
						onClick={() => handleFilterChange(tab.key)}
						style={getFilterPillStyle(typeFilter === tab.key)}
					>
						{tab.label}
					</button>
				))}

				{/* Separator */}
				<span
					style={{
						width: "1px",
						height: "20px",
						backgroundColor: "var(--border)",
						margin: "0 2px",
					}}
				/>

				{/* Unread only toggle */}
				<button
					onClick={handleToggleUnread}
					style={getFilterPillStyle(unreadOnly)}
				>
					<span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
						<Filter style={{ width: "12px", height: "12px" }} />
						Unread only
					</span>
				</button>
			</div>


			{/* Loading */}
			{isLoading && (
				<ListSkeleton rows={5} avatar />
			)}

			{/* Error */}
			{error && (
				<div style={{ ...cardStyle, padding: "48px", textAlign: "center" }}>
					<AlertCircle style={{ width: "32px", height: "32px", color: "var(--danger)", margin: "0 auto 12px" }} />
					<p style={{ color: "var(--danger)", fontSize: "14px" }}>Failed to load notifications</p>
				</div>
			)}

			{/* Empty state */}
			{!isLoading && !error && filtered.length === 0 && (
				<div
					style={{
						...cardStyle,
						padding: "64px 32px",
						textAlign: "center",
					}}
				>
					<div
						style={{
							width: "64px",
							height: "64px",
							borderRadius: "50%",
							backgroundColor: "var(--muted)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							margin: "0 auto 16px",
						}}
					>
						<Bell style={{ width: "28px", height: "28px", color: "var(--neutral)" }} />
					</div>
					<p style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>
						{typeFilter !== "all" || unreadOnly
							? "No matching notifications"
							: "No notifications yet"}
					</p>
					<p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
						{typeFilter !== "all"
							? `No ${filterTabs.find((t) => t.key === typeFilter)?.label?.toLowerCase() || ""} notifications found.`
							: unreadOnly
								? "No unread notifications — you're all caught up!"
								: "You're all caught up! We'll notify you when something happens."}
					</p>
				</div>
			)}

			{/* Notification list grouped by date */}
			{!isLoading && !error && filtered.length > 0 && (
				<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
					{Object.entries(grouped).map(([dateLabel, items]) => (
						<div key={dateLabel}>
							<p
								style={{
									fontSize: "12px",
									fontWeight: 600,
									color: "var(--text-muted)",
									textTransform: "uppercase",
									letterSpacing: "0.5px",
									margin: "0 0 8px",
								}}
							>
								{dateLabel}
							</p>
							<div style={{ ...cardStyle, overflow: "hidden" }}>
								{items.map((notification, idx) => {
									const config = getNotificationConfig(notification);
									const Icon = config.icon;
									const isAnnouncement = notification.type === "announcement";

									return (
										<div
											key={notification._id}
											onClick={() => handleNotificationClick(notification)}
											role="button"
											tabIndex={0}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													handleNotificationClick(notification);
												}
											}}
											aria-label={
												isAnnouncement
													? `Open announcement: ${notification.title}`
													: !notification.isRead
														? `Mark "${notification.title}" as read`
														: undefined
											}
											style={{
												display: "flex",
												alignItems: "flex-start",
												gap: "12px",
												padding: "16px 20px",
												borderBottom:
													idx < items.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
												backgroundColor: notification.isRead
													? "var(--card)"
													: "color-mix(in srgb, var(--foreground) 3%, var(--card))",
												cursor: "pointer",
												transition: "background-color 0.15s",
												outlineOffset: "-2px",
											}}
										>
											{/* Icon */}
											<span
												style={{
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													marginTop: "2px",
													flexShrink: 0,
												}}
											>
												<Icon
													style={{
														width: "18px",
														height: "18px",
														color: config.colors.icon,
													}}
												/>
											</span>

											{/* Content */}
											<div style={{ flex: 1, minWidth: 0 }}>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "8px",
														marginBottom: "2px",
													}}
												>
													<span
														style={{
															fontSize: "14px",
															fontWeight: notification.isRead ? 500 : 600,
															color: "var(--foreground)",
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
															minWidth: 0,
														}}
													>
														{formatNotificationTitle(notification.title)}
													</span>
													<span
														style={{
															display: "inline-flex",
															alignItems: "center",
															gap: "5px",
															fontSize: "11px",
															fontWeight: 600,
															color: "var(--foreground)",
															backgroundColor: "transparent",
															border: "1px solid var(--border)",
															padding: "1px 8px",
															borderRadius: "999px",
															flexShrink: 0,
														}}
													>
														<span
															style={{
																width: "6px",
																height: "6px",
																borderRadius: "50%",
																backgroundColor: config.colors.dot,
																flexShrink: 0,
															}}
														/>
														<span>{config.label}</span>
													</span>
												</div>
												<p
													style={{
														fontSize: "13px",
														color: "var(--text-secondary)",
														margin: "0 0 4px",
														lineHeight: 1.4,
													}}
												>
													{cleanNotificationMessage(notification.message)}
												</p>
												<div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
													<span
														style={{
															fontSize: "12px",
															color: "var(--text-muted)",
														}}
													>
														{formatTime(notification.createdAt)}
													</span>
												</div>
											</div>

											{/* Unread dot */}
											{!notification.isRead && (
												<div
													style={{
														width: "7px",
														height: "7px",
														borderRadius: "50%",
														backgroundColor: "var(--foreground, #0A1628)",
														flexShrink: 0,
														marginTop: "6px",
													}}
												/>
											)}
										</div>
									);
								})}
							</div>
						</div>
					))}

					{/* Pagination */}
					{pagination.totalPages > 1 && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "16px",
								paddingTop: "8px",
							}}
						>
							<button
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "4px",
									padding: "6px 12px",
									border: "1px solid var(--border)",
									borderRadius: "8px",
									backgroundColor: "var(--card)",
									fontSize: "13px",
									color: page <= 1 ? "var(--neutral-light)" : "var(--text-secondary)",
									cursor: page <= 1 ? "not-allowed" : "pointer",
								}}
							>
								<ChevronLeft style={{ width: "14px", height: "14px" }} />
								Previous
							</button>
							<span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
								Page {page} of {pagination.totalPages}
							</span>
							<button
								onClick={() =>
									setPage((p) => Math.min(pagination.totalPages, p + 1))
								}
								disabled={page >= pagination.totalPages}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "4px",
									padding: "6px 12px",
									border: "1px solid var(--border)",
									borderRadius: "8px",
									backgroundColor: "var(--card)",
									fontSize: "13px",
									color: page >= pagination.totalPages ? "var(--neutral-light)" : "var(--text-secondary)",
									cursor: page >= pagination.totalPages ? "not-allowed" : "pointer",
								}}
							>
								Next
								<ChevronRight style={{ width: "14px", height: "14px" }} />
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default NotificationsTab;