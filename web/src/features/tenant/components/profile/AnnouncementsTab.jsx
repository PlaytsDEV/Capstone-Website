import React, { useState } from "react";
import { announcementApi } from "../../../../shared/api/apiClient";
import { useAnnouncements } from "../../../../shared/hooks/queries/useAnnouncements";
import {
  Megaphone,
  Check,
  Clock,
  Wrench,
  Zap,
  FileText,
  Bell,
} from "lucide-react";

/* ── Helpers ───────────────────────────────────────── */

const CATEGORY_MAP = {
  Reminder: { color: "#0A1628", bg: "#F1F5F9", icon: Bell },
  Maintenance: { color: "#D97706", bg: "#FFFBEB", icon: Wrench },
  Utilities: { color: "#F59E0B", bg: "#FFF7ED", icon: Zap },
  Policy: { color: "#7C3AED", bg: "#F5F3FF", icon: FileText },
};

const FILTERS = ["all", "maintenance", "utilities", "policy", "reminder"];

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

/* ── Main Component ────────────────────────────────── */

const AnnouncementsTab = () => {
  const [filter, setFilter] = useState("all");
  const [acknowledged, setAcknowledged] = useState(new Set());

  const { data: announcementData, isLoading } = useAnnouncements(50);
  const announcements = announcementData?.announcements || [];

  const filtered = announcements.filter(
    (a) => filter === "all" || a.category.toLowerCase() === filter
  );

  const handleAcknowledge = async (id) => {
    try {
      await announcementApi.acknowledge(id);
      setAcknowledged((prev) => new Set(prev).add(id));
    } catch (error) {
      console.error("Failed to acknowledge announcement:", error);
    }
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div style={{ width: "100%" }}>
        <div style={s.heading}>
          <h1 style={s.title}>Announcements</h1>
          <p style={s.subtitle}>Loading announcements...</p>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              ...s.card,
              height: 80,
              background: "#F3F4F6",
              animation: "pulse 1.5s ease-in-out infinite",
              marginBottom: 10,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={s.heading}>
        <h1 style={s.title}>Announcements</h1>
        <p style={s.subtitle}>
          Stay updated with important notices and announcements
        </p>
      </div>

      {/* Filter chips */}
      <div style={s.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...s.chip,
              ...(filter === f ? s.chipActive : {}),
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={s.emptyState}>
          <Megaphone size={48} color="#D1D5DB" />
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#374151",
              margin: "16px 0 8px",
            }}
          >
            No announcements
          </h3>
          <p style={{ fontSize: 13, color: "#9CA3AF", maxWidth: 280 }}>
            {filter === "all"
              ? "There are no announcements yet."
              : `No ${filter} announcements to show.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((ann) => {
            const cat = CATEGORY_MAP[ann.category] || CATEGORY_MAP.Reminder;
            const CatIcon = cat.icon;
            const isAcked =
              ann.acknowledged || acknowledged.has(ann.id || ann._id);

            return (
              <div
                key={ann.id || ann._id}
                style={{
                  ...s.card,
                  borderLeft: `3px solid ${cat.color}`,
                  ...(ann.unread
                    ? { background: "var(--surface-page)" }
                    : {}),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {ann.unread && (
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#FF8C42",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text-heading)",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ann.title}
                    </h3>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        background: cat.bg,
                        color: cat.color,
                      }}
                    >
                      <CatIcon size={11} />
                      {ann.category}
                    </span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {fmtDate(ann.date || ann.createdAt)}
                    </span>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {ann.content}
                </p>

                {ann.requiresAck && (
                  <div style={{ marginTop: 12 }}>
                    {isAcked ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#059669",
                        }}
                      >
                        <Check size={13} /> Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          handleAcknowledge(ann.id || ann._id)
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "6px 14px",
                          background: "#FF8C42",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Check size={12} /> Acknowledge
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Styles ─────────────────────────────────────────── */
const s = {
  heading: { marginBottom: 24 },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text-heading)",
    margin: 0,
  },
  subtitle: { fontSize: 13, color: "var(--text-muted)", marginTop: 4 },

  filterRow: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 20,
    border: "1px solid var(--border-card)",
    background: "var(--surface-card)",
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  chipActive: {
    background: "#0A1628",
    color: "#fff",
    border: "1px solid #0A1628",
  },

  card: {
    padding: "16px 18px",
    background: "var(--surface-card)",
    border: "1px solid var(--border-card)",
    borderRadius: 10,
  },

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "56px 24px",
    background: "var(--surface-card)",
    borderRadius: 10,
    border: "1px solid var(--border-card)",
  },
};

export default AnnouncementsTab;
