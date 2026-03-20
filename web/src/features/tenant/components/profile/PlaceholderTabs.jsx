import React from "react";
import { Bell, Settings, Mail, Calendar, CreditCard, Shield, Moon, BellRing, Lock, Palette } from "lucide-react";

/**
 * Polished placeholder tabs for Notifications and Settings.
 * Designed to look intentionally "coming soon" — not broken.
 */

/* ── Shared ToggleRow (visual-only, disabled) ─────────────── */
const ToggleRow = ({ icon: Icon, iconColor, label, sublabel, checked = false }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 0",
      borderBottom: "1px solid #F1F5F9",
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: `${iconColor}14`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon size={18} color={iconColor} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#1F2937" }}>{label}</p>
      {sublabel && (
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>{sublabel}</p>
      )}
    </div>
    {/* Fake toggle — non-interactive */}
    <div
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? "#FF8C42" : "#E2E8F0",
        position: "relative",
        opacity: 0.5,
        cursor: "not-allowed",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "left 0.2s",
        }}
      />
    </div>
  </div>
);

/* ── NotificationsTab ─────────────────────────────────────── */
export const NotificationsTab = () => (
  <div style={{ width: "100%" }}>
    <div style={{ marginBottom: 24 }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#1F2937",
          margin: "0 0 4px",
          letterSpacing: "-0.01em",
        }}
      >
        Notifications
      </h1>
      <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
        Stay updated on your reservation and account activity
      </p>
    </div>

    {/* Coming soon card */}
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E8EBF0",
        padding: "28px 24px",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#FFF7ED",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BellRing size={20} color="#FF8C42" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1F2937" }}>
            Smart Notifications
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>
            Coming soon
          </p>
        </div>
      </div>

      <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
        We'll notify you when:
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { icon: Calendar, color: "#2563EB", text: "Your visit schedule is approved or needs rescheduling" },
          { icon: CreditCard, color: "#059669", text: "A new bill is generated or a payment is confirmed" },
          { icon: Shield, color: "#7C3AED", text: "Your application status changes" },
          { icon: Mail, color: "#E8734A", text: "Your contract is expiring or requires renewal" },
        ].map(({ icon: Icon, color, text }, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              background: "#F8FAFC",
              borderRadius: 8,
              border: "1px solid #F1F5F9",
            }}
          >
            <Icon size={16} color={color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#475569" }}>{text}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Notification preferences (visual-only) */}
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E8EBF0",
        padding: "24px",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: "#1F2937", margin: "0 0 4px" }}>
        Notification Preferences
      </p>
      <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 12px" }}>
        Configure how you receive notifications (available soon)
      </p>
      <ToggleRow icon={Mail} iconColor="#2563EB" label="Email notifications" sublabel="Receive updates via email" checked />
      <ToggleRow icon={BellRing} iconColor="#FF8C42" label="Push notifications" sublabel="Browser push alerts" checked={false} />
      <ToggleRow icon={CreditCard} iconColor="#059669" label="Payment reminders" sublabel="Get reminded before due dates" checked />
    </div>
  </div>
);

/* ── SettingsTab ───────────────────────────────────────────── */
export const SettingsTab = () => (
  <div style={{ width: "100%" }}>
    <div style={{ marginBottom: 24 }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#1F2937",
          margin: "0 0 4px",
          letterSpacing: "-0.01em",
        }}
      >
        Settings
      </h1>
      <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
        Manage your account preferences
      </p>
    </div>

    {/* Security */}
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E8EBF0",
        padding: "24px",
        marginBottom: 16,
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: "#1F2937", margin: "0 0 16px" }}>
        Security
      </p>
      <ToggleRow icon={Lock} iconColor="#0F172A" label="Change password" sublabel="Update your login credentials" />
      <ToggleRow icon={Shield} iconColor="#7C3AED" label="Two-factor authentication" sublabel="Add an extra layer of security" checked={false} />
    </div>

    {/* Appearance */}
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E8EBF0",
        padding: "24px",
        marginBottom: 16,
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: "#1F2937", margin: "0 0 16px" }}>
        Appearance
      </p>
      <ToggleRow icon={Moon} iconColor="#6366F1" label="Dark mode" sublabel="Switch to a darker color scheme" checked={false} />
      <ToggleRow icon={Palette} iconColor="#E8734A" label="Compact layout" sublabel="Reduce spacing for denser views" checked={false} />
    </div>

    {/* Data & Privacy */}
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E8EBF0",
        padding: "24px",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: "#1F2937", margin: "0 0 16px" }}>
        Data & Privacy
      </p>
      <ToggleRow icon={Mail} iconColor="#2563EB" label="Marketing emails" sublabel="Receive promotional content" checked={false} />

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
        <button
          disabled
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1.5px solid #E2E8F0",
            background: "transparent",
            color: "#94A3B8",
            fontSize: 13,
            fontWeight: 600,
            cursor: "not-allowed",
            opacity: 0.6,
          }}
        >
          Export My Data
        </button>
        <p style={{ fontSize: 11, color: "#CBD5E1", margin: "8px 0 0" }}>
          Download a copy of your account data (available soon)
        </p>
      </div>
    </div>
  </div>
);
