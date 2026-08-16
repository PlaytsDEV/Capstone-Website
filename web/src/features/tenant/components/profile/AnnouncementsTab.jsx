import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
 Bell,
 Check,
 FileText,
 LoaderCircle,
 Megaphone,
 ShieldAlert,
 TriangleAlert,
 Wrench,
} from "lucide-react";
import { announcementApi } from "../../../../shared/api/apiClient";
import {
 useAcknowledgeAnnouncement,
 useAnnouncements,
} from "../../../../shared/hooks/queries/useAnnouncements";
import {
 formatAnnouncementCategory,
 getAnnouncementCategoryMeta,
} from "../../../../shared/utils/announcementConfig";
import { showNotification } from "../../../../shared/utils/notification";
import { AnnouncementListSkeleton } from "../../../../shared/components/LoadingSkeletons";
import "../../../admin/styles/design-tokens.css";

const CATEGORY_ICONS = {
 general: Megaphone,
 reminder: Bell,
 maintenance: Wrench,
 policy: FileText,
 alert: TriangleAlert,
 event: Megaphone,
};

const FILTER_CATEGORIES = ["all", "general", "reminder", "maintenance", "policy", "event", "alert"];

const CATEGORY_COLORS = {
 slate: { color: "var(--muted-foreground)", bg: "var(--muted)" },
 teal: {
 color: "var(--chart-2)",
 bg: "color-mix(in srgb, var(--chart-2) 14%, var(--card))",
 },
 orange: {
 color: "var(--chart-3)",
 bg: "color-mix(in srgb, var(--chart-3) 14%, var(--card))",
 },
 blue: {
 color: "var(--info-dark)",
 bg: "color-mix(in srgb, var(--info) 14%, var(--card))",
 },
 purple: {
 color: "var(--chart-4)",
 bg: "color-mix(in srgb, var(--chart-4) 14%, var(--card))",
 },
 green: {
 color: "var(--success-dark)",
 bg: "color-mix(in srgb, var(--success) 14%, var(--card))",
 },
 red: {
 color: "var(--danger-dark)",
 bg: "color-mix(in srgb, var(--danger) 14%, var(--card))",
 },
};

const fmtDate = (value) =>
 new Date(value).toLocaleDateString("en-PH", {
 year: "numeric",
 month: "short",
 day: "numeric",
 });

const getAnnouncementId = (announcement) => announcement.id || announcement._id;

const LoadingState = () => (
 <div style={{ width: "100%" }}>
 <div style={s.heading}>
 <div>
 <h1 style={s.title}>Announcements</h1>
 <p style={s.subtitle}>
 Stay updated with branch notices, policy versions, and required acknowledgments.
 </p>
 </div>
 <div
 className="sk-shimmer"
 style={{ width: 68, height: 26, borderRadius: 999, flexShrink: 0 }}
 />
 </div>
 <AnnouncementListSkeleton count={3} />
 </div>
);

export default function AnnouncementsTab() {
  const [filter, setFilter] = useState("all");
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const queryClient = useQueryClient();
  const acknowledgeAnnouncement = useAcknowledgeAnnouncement();
  const markReadAttemptsRef = useRef(new Set());

  const { data: announcementData, isLoading } = useAnnouncements(50);
  const announcements = announcementData?.announcements || [];

  const filters = useMemo(() => {
    const values = [
      ...FILTER_CATEGORIES,
      ...new Set(
        announcements
          .map((announcement) => announcement.category)
          .filter(Boolean),
      ),
    ];

    return [...new Set(values)].map((value) => ({
      value,
      label: value === "all" ? "All" : formatAnnouncementCategory(value),
    }));
  }, [announcements]);

  const filtered = useMemo(
    () =>
      announcements.filter(
        (announcement) =>
          filter === "all" || announcement.category === filter,
      ),
    [announcements, filter],
  );

  useEffect(() => {
    const unreadIds = announcements
      .map((announcement) => getAnnouncementId(announcement))
      .filter(
        (announcementId, index) =>
          announcements[index].unread &&
          !markReadAttemptsRef.current.has(announcementId),
      );

    if (unreadIds.length === 0) return undefined;

    unreadIds.forEach((announcementId) =>
      markReadAttemptsRef.current.add(announcementId),
    );

    let cancelled = false;
    Promise.allSettled(
      unreadIds.map((announcementId) => announcementApi.markAsRead(announcementId)),
    ).then((results) => {
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          markReadAttemptsRef.current.delete(unreadIds[index]);
        }
      });
      if (!cancelled) {
        queryClient.invalidateQueries({ queryKey: ["announcements"] });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [announcements, queryClient]);

  const handleAcknowledge = async (announcementId) => {
    setAcknowledgingId(announcementId);
    try {
      await acknowledgeAnnouncement.mutateAsync(announcementId);
      showNotification("Notice acknowledged successfully.", "success", 3500);
    } catch (error) {
      showNotification(error.message || "Failed to acknowledge notice.", "error", 4000);
    } finally {
      setAcknowledgingId(null);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

 return (
 <div style={{ width: "100%" }}>
 <div style={s.heading}>
 <div>
 <h1 style={s.title}>Announcements</h1>
 <p style={s.subtitle}>
 Stay updated with branch notices, policy versions, and required acknowledgments.
 </p>
 </div>
 <span style={s.countBadge}>{filtered.length} shown</span>
 </div>

 <div style={s.filterRow} aria-label="Filter announcements">
 {filters.map((item) => (
 <button
 key={item.value}
 onClick={() => setFilter(item.value)}
 style={{
 ...s.chip,
 ...(filter === item.value ? s.chipActive : {}),
 }}
 >
 {item.label}
 </button>
 ))}
 </div>

 {filtered.length === 0 ? (
 <div style={s.emptyState}>
 <Megaphone size={48} color="var(--neutral)" />
 <h3 style={s.emptyTitle}>No announcements</h3>
 <p style={s.emptyBody}>
 {filter === "all"
 ? "There are no announcements yet."
 : `No ${formatAnnouncementCategory(filter).toLowerCase()} announcements to show.`}
 </p>
 </div>
 ) : (
 <div style={s.list}>
 {filtered.map((announcement) => {
 const categoryMeta = getAnnouncementCategoryMeta(announcement.category);
 const tone =
 CATEGORY_COLORS[categoryMeta.tone] || CATEGORY_COLORS.slate;
 const CategoryIcon =
 CATEGORY_ICONS[announcement.category] || Megaphone;

 return (
 <div
 key={getAnnouncementId(announcement)}
 style={{
 ...s.card,
 ...(announcement.unread ? { background: "var(--card)", boxShadow: "var(--shadow-sm)" } : {}),
 }}
 >
 <div style={s.cardTop}>
 <div style={s.cardHeading}>
 {announcement.unread ? <div style={s.unreadDot} /> : null}
 <h3 style={s.cardTitle}>{announcement.title}</h3>
 </div>

 <div style={s.cardMeta}>
 <span
 style={{
 ...s.categoryBadge,
 background: tone.bg,
 color: tone.color,
 }}
 >
 <CategoryIcon size={11} />
 {categoryMeta.label}
 </span>
 <span style={s.dateText}>{fmtDate(announcement.date)}</span>
 </div>
 </div>

 <p style={s.cardBody}>{announcement.content}</p>

 {announcement.contentType === "policy" ? (
 <div style={{ marginTop: 10, color: "var(--muted-foreground)", fontSize: 12 }}>
 Version {announcement.version || 1}
 {announcement.effectiveDate
 ? ` • Effective ${fmtDate(announcement.effectiveDate)}`
 : ""}
 </div>
 ) : null}

 {announcement.requiresAck ? (
 <div style={s.actionRow}>
 {announcement.acknowledged ? (
 <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
 <span style={s.ackBadge}>
 <Check size={13} /> Acknowledged
 </span>
 {announcement.acknowledgedAt ? (
 <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
 Acknowledged {fmtDate(announcement.acknowledgedAt)}
 </span>
 ) : null}
 </div>
 ) : (
 <button
   onClick={() => handleAcknowledge(getAnnouncementId(announcement))}
   style={{
     ...s.ackButton,
     ...(acknowledgingId === getAnnouncementId(announcement) ? { opacity: 0.75, cursor: "not-allowed" } : {}),
   }}
   disabled={Boolean(acknowledgingId)}
 >
   {acknowledgingId === getAnnouncementId(announcement) ? (
     <>
       <LoaderCircle size={12} className="animate-spin" />
       Acknowledging...
     </>
   ) : (
     <>
       <ShieldAlert size={12} />
       Acknowledge
     </>
   )}
 </button>
 )}
 </div>
 ) : null}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}

const s = {
 root: { width: "100%", maxWidth: 920, margin: "0 auto" },
 heading: {
 display: "flex",
 justifyContent: "space-between",
 alignItems: "flex-start",
 gap: 16,
 marginBottom: 20,
 },
 title: {
 fontSize: 22,
 fontWeight: 700,
 color: "var(--text-heading)",
 margin: 0,
 },
 subtitle: { fontSize: 13, color: "var(--muted-foreground)", margin: "4px 0 0", lineHeight: 1.5 },
 countBadge: {
 flexShrink: 0,
 padding: "5px 10px",
 borderRadius: 999,
 background: "var(--muted)",
 color: "var(--muted-foreground)",
 fontSize: 12,
 fontWeight: 600,
 },
 filterRow: {
 display: "flex",
 gap: 8,
 marginBottom: 16,
 paddingBottom: 4,
 overflowX: "auto",
 flexWrap: "wrap",
 },
 chip: {
 display: "inline-flex",
 alignItems: "center",
 gap: 6,
 padding: "6px 14px",
 borderRadius: 20,
 border: "1px solid var(--border-card)",
 background: "var(--card)",
 color: "var(--muted-foreground)",
 fontSize: 13,
 fontWeight: 500,
 cursor: "pointer",
 transition: "all 0.15s",
 },
 chipActive: {
 background: "var(--primary)",
 color: "var(--primary-foreground)",
 border: "1px solid var(--primary)",
},
 list: { display: "flex", flexDirection: "column", gap: 12 },
 card: {
 padding: "16px 18px",
 background: "var(--card)",
 border: "1px solid var(--border)",
 borderRadius: 12,
 boxShadow: "var(--shadow-xs)",
 },
 cardTop: {
 display: "flex",
 justifyContent: "space-between",
 alignItems: "flex-start",
 gap: 12,
 marginBottom: 8,
 },
 cardHeading: {
 display: "flex",
 alignItems: "center",
 gap: 8,
 flex: 1,
 minWidth: 0,
 },
 unreadDot: {
 width: 7,
 height: 7,
 borderRadius: "50%",
 background: "var(--primary)",
 flexShrink: 0,
 },
 cardTitle: {
 fontSize: 14,
 fontWeight: 600,
 color: "var(--text-heading)",
 margin: 0,
 overflow: "hidden",
 textOverflow: "ellipsis",
 whiteSpace: "nowrap",
 },
 cardMeta: {
 display: "flex",
 alignItems: "center",
 gap: 8,
 flexShrink: 0,
 },
 categoryBadge: {
 display: "inline-flex",
 alignItems: "center",
 gap: 4,
 padding: "3px 10px",
 borderRadius: 20,
 fontSize: 11,
 fontWeight: 600,
 },
 dateText: {
 fontSize: 11,
 color: "var(--neutral)",
 },
 cardBody: {
 fontSize: 13,
 color: "var(--text-secondary)",
 margin: 0,
 lineHeight: 1.5,
 },
 actionRow: {
 marginTop: 12,
 },
 ackBadge: {
 display: "inline-flex",
 alignItems: "center",
 gap: 5,
 fontSize: 12,
 fontWeight: 600,
 color: "var(--success)",
 },
 ackButton: {
 display: "inline-flex",
 alignItems: "center",
 gap: 5,
 padding: "6px 14px",
 background: "var(--primary)",
 color: "var(--primary-foreground)",
 border: "none",
 borderRadius: 6,
 fontSize: 12,
 fontWeight: 600,
 cursor: "pointer",
 },
 emptyState: {
 display: "flex",
 flexDirection: "column",
 alignItems: "center",
 justifyContent: "center",
 textAlign: "center",
 padding: "56px 24px",
 background: "var(--card)",
 borderRadius: 10,
 border: "1px solid var(--border)",
 },
 emptyTitle: {
 fontSize: 16,
 fontWeight: 600,
 color: "var(--foreground)",
 margin: "16px 0 8px",
 },
 emptyBody: {
 fontSize: 13,
 color: "var(--muted-foreground)",
 maxWidth: 280,
 },
};
