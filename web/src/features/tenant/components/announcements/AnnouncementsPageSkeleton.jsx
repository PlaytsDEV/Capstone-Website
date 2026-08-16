import React from "react";
import { AnnouncementListSkeleton } from "../../../../shared/components/LoadingSkeletons";
import "../../../admin/styles/design-tokens.css";
import "../../styles/tenant-announcements.css";

/**
 * AnnouncementsPageSkeleton — unified shimmer skeleton that mirrors AnnouncementsTab 1:1.
 */
export default function AnnouncementsPageSkeleton() {
  return (
    <div className="tenant-page">
      <div className="tenant-announcements-root">
        <div className="tenant-announcements-header">
          <div className="tenant-announcements-header__text">
            <h1>Announcements</h1>
            <p>
              Stay updated with branch notices, policy versions, and required acknowledgments.
            </p>
          </div>
          <div
            className="sk-shimmer"
            style={{ width: 140, height: 36, borderRadius: 8, flexShrink: 0 }}
          />
        </div>
        <AnnouncementListSkeleton count={4} />
      </div>
    </div>
  );
}
