import React from "react";
import { AnnouncementListSkeleton } from "../../../../shared/components/LoadingSkeletons";
import "../../../admin/styles/design-tokens.css";

/**
 * AnnouncementsPageSkeleton — unified shimmer skeleton that mirrors AnnouncementsTab 1:1.
 */
export default function AnnouncementsPageSkeleton() {
  return (
    <div className="tenant-page">
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-heading)",
                margin: 0,
              }}
            >
              Announcements
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "var(--muted-foreground)",
                margin: "4px 0 0",
                lineHeight: 1.5,
              }}
            >
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
    </div>
  );
}
