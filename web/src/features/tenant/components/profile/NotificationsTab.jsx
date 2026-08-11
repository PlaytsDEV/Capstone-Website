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
	RotateCcw,
	ArrowRight,
	Bed,
} from "lucide-react";
import {
	useNotifications,
	useMarkAsRead,
	useMarkAllAsRead,
} from "../../../../shared/hooks/queries/useNotifications";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { ListSkeleton } from "../../../../shared/components/LoadingSkeletons";
import { getVisibleNotificationsForUser } from "../../../../shared/utils/notificationVisibility";

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

// ── Notification type → icon + color mapping ──
const TYPE_CONFIG = {
	reservation_confirmed: { icon: Calendar, color: "#10B981", label: "Reservation" },
	reservation_cancelled: { icon: Calendar, color: "#EF4444", label: "Reservation" },
	visit_approved: { icon: Home, color: "#10B981", label: "Visit" },
	visit_rejected: { icon: Home, color: "#EF4444", label: "Visit" },
	payment_approved: { icon: CreditCard, color: "#10B981", label: "Payment" },
	payment_rejected: { icon: CreditCard, color: "#EF4444", label: "Payment" },
	bill_generated: { icon: CreditCard, color: "#F59E0B", label: "Billing" },
	bill_due_reminder: { icon: AlertCircle, color: "#EF4444", label: "Billing" },
	grace_period_warning: { icon: AlertCircle, color: "#EF4444", label: "Warning" },
	move_in_reminder: { icon: Home, color: "#6366F1", label: "Move-in" },
	account_suspended: { icon: AlertCircle, color: "#EF4444", label: "Account" },
	account_reactivated: { icon: Check, color: "#10B981", label: "Account" },
	maintenance_update: { icon: Wrench, color: "#8B5CF6", label: "Maintenance" },
	announcement: { icon: Megaphone, color: "#FF8C42", label: "Announcement" },
	general: { icon: Bell, color: "#6B7280", label: "General" },
};

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

// ── Filter pill styles ──
const getFilterPillStyle = (isActive, accentColor) => ({
	padding: "6px 14px",
	borderRadius: "20px",
	border: "1px solid",
	fontSize: "12px",
	fontWeight: 500,
	cursor: "pointer",
	backgroundColor: isActive ? (accentColor || "var(--text-heading, #1F2937)") : "var(--surface-card, #fff)",
	color: isActive ? "#fff" : "var(--text-secondary, #6B7280)",
	borderColor: isActive ? (accentColor || "var(--text-heading, #1F2937)") : "var(--border-card, #E8EBF0)",
	transition: "all 0.18s ease",
	whiteSpace: "nowrap",
});

// ── Component ──

const NotificationsTab = ({ onTabChange }) => {
	const { user } = useAuth();
	const navigate = useNavigate();
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

	// Compute category notification counts
	const categoryCounts = useMemo(() => {
		const counts = { all: notifications.length };
		filterTabs.forEach((tab) => {
			if (tab.key !== "all") {
				counts[tab.key] = notifications.filter((n) => matchesFilter(n, tab.key)).length;
			}
		});
		return counts;
	}, [notifications, filterTabs]);

	// Navigation Handlers
	const handleBrowseRooms = () => {
		navigate("/applicant/check-availability");
	};

	const handleCheckReservation = () => {
		if (onTabChange) {
			onTabChange("reservation");
		} else {
			navigate("/applicant/profile", { state: { tab: "reservation" } });
		}
	};

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

	const handleFilterChange = (key) => {
		setTypeFilter(key);
		setPage(1);
	};

	const handleToggleUnread = () => {
		setUnreadOnly((prev) => !prev);
		setPage(1);
	};

	const handleResetFilters = () => {
		setTypeFilter("all");
		setUnreadOnly(false);
		setPage(1);
	};

	// ── Styles ──
	const cardStyle = {
		backgroundColor: "var(--surface-card, #fff)",
		borderRadius: "12px",
		border: "1px solid var(--border-card, #E8EBF0)",
		overflow: "hidden",
	};

	return (
		<div style={{ width: "100%" }}>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "16px",
					flexWrap: "wrap",
					gap: "12px",
				}}
			>
				<div>
					<h1
						style={{
							fontSize: "22px",
							fontWeight: 700,
							color: "var(--text-heading, #1F2937)",
							margin: "0 0 4px 0",
						}}
					>
						Notifications
					</h1>
					<p style={{ fontSize: "14px", color: "var(--text-muted, #94A3B8)", margin: 0 }}>
						{isApplicant
							? "Stay updated on your reservation, visit, and application progress"
							: "Stay updated on billing, maintenance, contracts, and account notices"}
					</p>
				</div>

				{unreadCount > 0 && (
					<button
						onClick={handleMarkAllRead}
						disabled={markAllAsRead.isPending}
						style={{
							display: "flex",
							alignItems: "center",
							gap: "6px",
							backgroundColor: "var(--surface-card, #fff)",
							border: "1px solid var(--border-card, #E8EBF0)",
							borderRadius: "8px",
							padding: "8px 14px",
							fontSize: "13px",
							fontWeight: 500,
							color: "var(--text-secondary, #6B7280)",
							cursor: "pointer",
							transition: "all 0.18s ease",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = "var(--surface-muted, #F8FAFC)";
							e.currentTarget.style.borderColor = "#CBD5E1";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "var(--surface-card, #fff)";
							e.currentTarget.style.borderColor = "var(--border-card, #E8EBF0)";
						}}
					>
						<CheckCheck style={{ width: "14px", height: "14px", color: "#10B981" }} />
						Mark all as read
					</button>
				)}
			</div>

			{/* Filter pills */}
			<div
				style={{
					display: "flex",
					gap: "8px",
					marginBottom: "20px",
					flexWrap: "wrap",
					alignItems: "center",
				}}
			>
				{filterTabs.map((tab) => {
					const isActive = typeFilter === tab.key;
					const count = categoryCounts[tab.key] || 0;
					return (
						<button
							key={tab.key}
							onClick={() => handleFilterChange(tab.key)}
							style={getFilterPillStyle(isActive)}
						>
							{tab.label}
							<span
								style={{
									marginLeft: "5px",
									fontSize: "11px",
									opacity: isActive ? 0.9 : 0.6,
									fontWeight: isActive ? 600 : 400,
								}}
							>
								({count})
							</span>
						</button>
					);
				})}

				{/* Separator */}
				<span
					style={{
						width: "1px",
						height: "20px",
						backgroundColor: "var(--border-card, #E8EBF0)",
						margin: "0 2px",
					}}
				/>

				{/* Unread only toggle */}
				<button
					onClick={handleToggleUnread}
					style={getFilterPillStyle(unreadOnly, "#1F2937")}
				>
					<span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
						<Filter style={{ width: "12px", height: "12px" }} />
						Unread only ({unreadCount})
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
					<AlertCircle style={{ width: "32px", height: "32px", color: "#EF4444", margin: "0 auto 12px" }} />
					<p style={{ color: "#EF4444", fontSize: "14px" }}>Failed to load notifications</p>
				</div>
			)}

			{/* Empty state */}
			{!isLoading && !error && filtered.length === 0 && (
				<div
					style={{
						...cardStyle,
						padding: "56px 32px",
						textAlign: "center",
					}}
				>
					<div
						style={{
							width: "60px",
							height: "60px",
							borderRadius: "50%",
							backgroundColor: "#F1F5F9",
							border: "1px solid #E2E8F0",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							margin: "0 auto 16px",
						}}
					>
						<Bell style={{ width: "26px", height: "26px", color: "#64748B" }} />
					</div>
					<p style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-heading, #1F2937)", margin: "0 0 6px" }}>
						{typeFilter !== "all" || unreadOnly
							? "No matching notifications"
							: "No notifications yet"}
					</p>
					<p style={{ fontSize: "14px", color: "var(--text-muted, #94A3B8)", margin: "0 0 20px", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
						{typeFilter !== "all"
							? `No ${filterTabs.find((t) => t.key === typeFilter)?.label?.toLowerCase() || ""} notifications found.`
							: unreadOnly
								? "No unread notifications — you're all caught up!"
								: "You're all caught up! We'll notify you when something happens with your reservations or stay."}
					</p>

					{/* Active Filter Reset */}
					{(typeFilter !== "all" || unreadOnly) && (
						<button
							onClick={handleResetFilters}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: "6px",
								padding: "8px 16px",
								borderRadius: "8px",
								border: "1px solid var(--border-card, #E8EBF0)",
								backgroundColor: "var(--surface-card, #fff)",
								color: "var(--text-heading, #1F2937)",
								fontSize: "13px",
								fontWeight: 500,
								cursor: "pointer",
								transition: "all 0.18s ease",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = "var(--surface-muted, #F8FAFC)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = "var(--surface-card, #fff)";
							}}
						>
							<RotateCcw style={{ width: "14px", height: "14px" }} />
							Reset Filters
						</button>
					)}

					{/* Actionable Quick Links when inbox is completely empty */}
					{typeFilter === "all" && !unreadOnly && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "12px",
								flexWrap: "wrap",
							}}
						>
							{isApplicant ? (
								<>
									<button
										onClick={handleBrowseRooms}
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: "8px",
											padding: "9px 18px",
											borderRadius: "8px",
											border: "1px solid #1F2937",
											backgroundColor: "#1F2937",
											color: "#FFFFFF",
											fontSize: "13px",
											fontWeight: 600,
											cursor: "pointer",
											transition: "all 0.18s ease",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor = "#111827";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = "#1F2937";
										}}
									>
										<Bed style={{ width: "15px", height: "15px" }} />
										Browse Available Rooms
										<ArrowRight style={{ width: "14px", height: "14px" }} />
									</button>
									<button
										onClick={handleCheckReservation}
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: "8px",
											padding: "9px 18px",
											borderRadius: "8px",
											border: "1px solid var(--border-card, #E8EBF0)",
											backgroundColor: "var(--surface-card, #fff)",
											color: "var(--text-heading, #1F2937)",
											fontSize: "13px",
											fontWeight: 600,
											cursor: "pointer",
											transition: "all 0.18s ease",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor = "var(--surface-muted, #F8FAFC)";
											e.currentTarget.style.borderColor = "#CBD5E1";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = "var(--surface-card, #fff)";
											e.currentTarget.style.borderColor = "var(--border-card, #E8EBF0)";
										}}
									>
										<Calendar style={{ width: "15px", height: "15px", color: "#6B7280" }} />
										Check Reservation
									</button>
								</>
							) : (
								<>
									<button
										onClick={() => navigate("/applicant/billing")}
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: "8px",
											padding: "9px 18px",
											borderRadius: "8px",
											border: "1px solid #1F2937",
											backgroundColor: "#1F2937",
											color: "#FFFFFF",
											fontSize: "13px",
											fontWeight: 600,
											cursor: "pointer",
											transition: "all 0.18s ease",
										}}
									>
										<CreditCard style={{ width: "15px", height: "15px" }} />
										View My Bills
										<ArrowRight style={{ width: "14px", height: "14px" }} />
									</button>
									<button
										onClick={() => navigate("/applicant/maintenance")}
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: "8px",
											padding: "9px 18px",
											borderRadius: "8px",
											border: "1px solid var(--border-card, #E8EBF0)",
											backgroundColor: "var(--surface-card, #fff)",
											color: "var(--text-heading, #1F2937)",
											fontSize: "13px",
											fontWeight: 500,
											cursor: "pointer",
											transition: "all 0.18s ease",
										}}
									>
										<Wrench style={{ width: "15px", height: "15px" }} />
										Request Maintenance
									</button>
								</>
							)}
						</div>
					)}
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
									color: "#94A3B8",
									textTransform: "uppercase",
									letterSpacing: "0.5px",
									margin: "0 0 8px",
								}}
							>
								{dateLabel}
							</p>
							<div style={{ ...cardStyle, overflow: "hidden" }}>
								{items.map((notification, idx) => {
									const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.general;
									const Icon = config.icon;

									return (
										<div
											key={notification._id}
											onClick={() => !notification.isRead && handleMarkRead(notification._id)}
											style={{
												display: "flex",
												alignItems: "flex-start",
												gap: "12px",
												padding: "16px 20px",
												borderBottom:
													idx < items.length - 1 ? "1px solid var(--border-subtle, #F1F5F9)" : "none",
												backgroundColor: notification.isRead ? "var(--surface-card, #fff)" : "rgba(255, 140, 66, 0.04)",
												cursor: notification.isRead ? "default" : "pointer",
												transition: "background-color 0.15s",
											}}
										>
											{/* Icon */}
											<div
												style={{
													width: "36px",
													height: "36px",
													borderRadius: "10px",
													backgroundColor: `${config.color}10`,
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													flexShrink: 0,
												}}
											>
												<Icon
													style={{
														width: "18px",
														height: "18px",
														color: config.color,
													}}
												/>
											</div>

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
															color: "var(--text-heading, #1F2937)",
														}}
													>
														{notification.title}
													</span>
													<span
														style={{
															fontSize: "11px",
															fontWeight: 500,
															color: config.color,
															backgroundColor: `${config.color}15`,
															padding: "1px 6px",
															borderRadius: "4px",
														}}
													>
														{config.label}
													</span>
												</div>
												<p
													style={{
														fontSize: "13px",
														color: "var(--text-secondary, #6B7280)",
														margin: "0 0 4px",
														lineHeight: 1.4,
													}}
												>
													{notification.message}
												</p>
												<span
													style={{
														fontSize: "12px",
														color: "#94A3B8",
													}}
												>
													{formatTime(notification.createdAt)}
												</span>
											</div>

											{/* Unread dot */}
											{!notification.isRead && (
												<div
													style={{
														width: "8px",
														height: "8px",
														borderRadius: "50%",
														backgroundColor: "#FF8C42",
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
									border: "1px solid var(--border-card, #E8EBF0)",
									borderRadius: "8px",
									backgroundColor: "var(--surface-card, #fff)",
									fontSize: "13px",
									color: page <= 1 ? "#CBD5E1" : "#6B7280",
									cursor: page <= 1 ? "not-allowed" : "pointer",
								}}
							>
								<ChevronLeft style={{ width: "14px", height: "14px" }} />
								Previous
							</button>
							<span style={{ fontSize: "13px", color: "#6B7280" }}>
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
									border: "1px solid var(--border-card, #E8EBF0)",
									borderRadius: "8px",
									backgroundColor: "var(--surface-card, #fff)",
									fontSize: "13px",
									color: page >= pagination.totalPages ? "#CBD5E1" : "#6B7280",
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

