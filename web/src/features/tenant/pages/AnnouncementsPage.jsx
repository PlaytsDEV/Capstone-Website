import React, { useState, useEffect } from "react";
import { announcementApi } from "../../../shared/api/apiClient";
import TenantLayout from "../../../shared/layouts/TenantLayout";
import "../styles/tenant-common.css";

const AnnouncementsPage = () => {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [announcements, setAnnouncements] = useState([]);
  const [acknowledged, setAcknowledged] = useState(new Set());

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementApi.getAll(50);
      setAnnouncements(data.announcements || []);
    } catch (error) {
      console.error("Failed to load announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnouncements = announcements.filter(
    (a) => filter === "all" || a.category.toLowerCase() === filter,
  );

  const handleAcknowledge = async (id) => {
    try {
      await announcementApi.acknowledge(id);
      setAcknowledged((prev) => new Set(prev).add(id));
    } catch (error) {
      console.error("Failed to acknowledge announcement:", error);
    }
  };

  const getCategoryClass = (category) => {
    const classes = {
      Reminder: "category-reminder",
      Maintenance: "category-maintenance",
      Policy: "category-policy",
      Utilities: "category-utilities",
    };
    return classes[category] || "category-default";
  };

  return (
    <TenantLayout>
      <div className="tenant-page">
        <div className="page-header">
          <div>
            <h1>
              <i className="fas fa-bullhorn"></i> Announcements
            </h1>
            <p>Stay updated with important notices and announcements</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            className={`tab ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`tab ${filter === "maintenance" ? "active" : ""}`}
            onClick={() => setFilter("maintenance")}
          >
            Maintenance
          </button>
          <button
            className={`tab ${filter === "utilities" ? "active" : ""}`}
            onClick={() => setFilter("utilities")}
          >
            Utilities
          </button>
          <button
            className={`tab ${filter === "policy" ? "active" : ""}`}
            onClick={() => setFilter("policy")}
          >
            Policy
          </button>
          <button
            className={`tab ${filter === "reminder" ? "active" : ""}`}
            onClick={() => setFilter("reminder")}
          >
            Reminder
          </button>
        </div>

        {/* Announcements List */}
        <div className="announcements-list">
          {filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className={`announcement-card ${announcement.unread ? "unread" : ""}`}
            >
              <div className="announcement-header">
                <div className="announcement-title-row">
                  {announcement.unread && (
                    <span className="unread-indicator"></span>
                  )}
                  <h3>{announcement.title}</h3>
                </div>
                <div className="announcement-meta">
                  <span
                    className={`category-badge ${getCategoryClass(announcement.category)}`}
                  >
                    {announcement.category}
                  </span>
                  <span className="announcement-date">
                    {new Date(announcement.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="announcement-content">{announcement.content}</p>
              {announcement.requiresAck && (
                <div className="announcement-actions">
                  {announcement.acknowledged ? (
                    <span className="badge badge-success">
                      <i className="fas fa-check"></i> Acknowledged
                    </span>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAcknowledge(announcement.id)}
                    >
                      <i className="fas fa-check"></i> Acknowledge
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </TenantLayout>
  );
};

export default AnnouncementsPage;
