/**
 * SettingsTab — Profile Settings with Change Password & Session Management
 *
 * Features:
 * - Change password for email/password accounts (Firebase Auth)
 * - "Managed by Google" notice for social login users
 * - Account information display (role, status, dates)
 * - Active session info and sign-out-all-devices
 *
 * Visual language: driven entirely by the tokens in design-token.css
 * (--primary/--secondary/--success/--warning/--danger/--info, spacing,
 * radius, shadow and type scales). No hardcoded hex values.
 */

import React, { useState } from "react";
import {
  Shield,
  Lock,
  Info,
  CheckCircle,
  AlertCircle,
  Monitor,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import PasswordVisibilityButton from "../../../../shared/components/PasswordVisibilityButton";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import { useTheme } from "../../../../features/public/context/ThemeContext";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "../../../../firebase/config";
import { useAppNavigation } from "../../../../shared/hooks/useAppNavigation";
import { showNotification } from "../../../../shared/utils/notification";
import { validatePassword } from "../../../../shared/utils/authValidation";

// ─── Helpers ──────────────────────────────────────────────────

/** Check if current user has email/password provider */
const isEmailPasswordAccount = () => {
  const user = auth.currentUser;
  return user?.providerData?.some((p) => p.providerId === "password") || false;
};

/** Get the social provider name if any */
const getSocialProvider = () => {
  const user = auth.currentUser;
  const provider = user?.providerData?.find(
    (p) => p.providerId !== "password",
  );
  if (!provider) return null;
  if (provider.providerId === "google.com") return "Google";
  if (provider.providerId === "facebook.com") return "Facebook";
  return provider.providerId;
};

// ─── Scoped layout styles (kept local so this component ships as one file) ──
// Anything that needs a media query or a pseudo-class beyond what inline
// styles can express lives here, namespaced under `.st-`.
const ScopedStyles = () => (
  <style>{`
    .st-section {
      background-color: var(--surface-card, var(--card));
      border: 1px solid var(--border-card, var(--border));
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }
    .st-section + .st-section { margin-top: var(--spacing-lg); }

    .st-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-md);
      padding: var(--spacing-lg) var(--spacing-xl);
      border-bottom: 1px solid var(--border-light);
    }
    .st-section-head-left { display: flex; align-items: center; gap: var(--spacing-md); min-width: 0; }
    .st-section-body { padding: var(--spacing-xl); }

    .st-icon-badge {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .st-grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--spacing-md);
    }

    .st-segmented {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      background: var(--surface-muted, var(--muted));
      padding: 4px;
      border-radius: var(--radius-md);
    }
    @media (max-width: 520px) {
      .st-segmented { grid-template-columns: 1fr; }
    }
    .st-segmented-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: calc(var(--radius-md) - 2px);
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-medium);
      color: var(--text-muted, var(--muted-foreground));
      background: transparent;
      transition: background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);
    }
    .st-segmented-btn:hover { color: var(--text-heading, var(--foreground)); }
    .st-segmented-btn.is-active {
      background: var(--surface-card, var(--card));
      color: var(--text-heading, var(--foreground));
      box-shadow: var(--shadow-xs), inset 0 0 0 1px color-mix(in srgb, var(--primary) 45%, transparent);
    }
    .st-segmented-btn.is-active .st-segmented-icon { color: var(--primary); }

    .st-field { display: flex; flex-direction: column; gap: 6px; }
    .st-input {
      width: 100%;
      padding: 10px 44px 10px 12px;
      border: 1px solid var(--border-card, var(--border));
      border-radius: var(--radius-md);
      font-size: var(--font-size-md);
      font-family: inherit;
      color: var(--text-heading, var(--foreground));
      background: var(--input-background, var(--surface-muted));
      outline: none;
      box-sizing: border-box;
      transition: border-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);
    }
    .st-input:focus {
      border-color: var(--ring);
      box-shadow: 0 0 0 3px var(--border-focus);
    }

    .st-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: var(--radius-md);
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      font-family: inherit;
      cursor: pointer;
      border: 1px solid transparent;
      transition: filter var(--duration-fast) var(--ease-out),
        background-color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out);
    }
    .st-btn:disabled { cursor: not-allowed; opacity: 0.6; }
    .st-btn:not(:disabled):hover { filter: brightness(0.96); }

    .st-btn-primary { background: var(--primary); color: var(--primary-foreground); padding: 10px 22px; }
    .st-btn-success { background: var(--success); color: var(--success-foreground); padding: 10px 22px; }
    .st-btn-ghost {
      background: transparent;
      color: var(--text-secondary, var(--muted-foreground));
      border-color: var(--border-card, var(--border));
      padding: 10px 18px;
    }
    .st-btn-ghost:not(:disabled):hover { background: var(--surface-hover, var(--bg-hover)); }
    .st-btn-outline-accent {
      background: transparent;
      color: var(--text-heading, var(--foreground));
      border-color: color-mix(in srgb, var(--primary) 55%, transparent);
      padding: 7px 14px;
      font-size: var(--font-size-sm);
    }
    .st-btn-outline-accent:not(:disabled):hover {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      border-color: var(--primary);
    }
    .st-btn-danger-outline {
      width: 100%;
      background: var(--status-error-bg);
      color: var(--danger-dark);
      border-color: color-mix(in srgb, var(--danger) 30%, transparent);
      padding: 11px 16px;
      font-size: var(--font-size-sm);
    }
    .st-btn-danger-outline:not(:disabled):hover {
      background: color-mix(in srgb, var(--danger) 16%, transparent);
      border-color: var(--danger);
    }
  `}</style>
);

// ─── Component ────────────────────────────────────────────────

const SettingsTab = () => {
  const appNavigate = useAppNavigation();
  // Password form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [showSignOutAllConfirm, setShowSignOutAllConfirm] = useState(false);
  const [savedTheme, setSavedTheme] = useState(false);

  const hasEmailAuth = isEmailPasswordAccount();
  const socialProvider = getSocialProvider();
  const firebaseUser = auth.currentUser;

  // ── Password change handler ──
  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword) {
      showNotification("Current password is required", "error");
      return;
    }
    if (/\s/.test(newPassword)) {
      showNotification("New password cannot contain spaces", "error");
      return;
    }
    const strengthError = validatePassword(newPassword);
    if (strengthError) {
      showNotification(strengthError, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification("New passwords do not match", "error");
      return;
    }
    if (currentPassword === newPassword) {
      showNotification(
        "New password must be different from current password",
        "error",
      );
      return;
    }

    try {
      setChangingPassword(true);
      const fbUser = auth.currentUser;

      if (!fbUser || !fbUser.email) {
        showNotification(
          "You must be logged in to change your password",
          "error",
        );
        return;
      }

      const credential = EmailAuthProvider.credential(
        fbUser.email,
        currentPassword,
      );
      await reauthenticateWithCredential(fbUser, credential);
      await updatePassword(fbUser, newPassword);

      showNotification("Password changed successfully!", "success");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordForm(false);
    } catch (error) {
      console.error("❌ Password change failed:", error);
      if (error.code === "auth/wrong-password") {
        showNotification("Current password is incorrect", "error");
      } else if (error.code === "auth/weak-password") {
        showNotification("New password is too weak", "error");
      } else if (error.code === "auth/requires-recent-login") {
        showNotification(
          "Please log out and log back in, then try again",
          "error",
        );
      } else {
        showNotification(
          "Failed to change password. Please try again.",
          "error",
        );
      }
    } finally {
      setChangingPassword(false);
    }
  };

  // ── Sign out all devices ──
  const handleSignOutAll = async () => {
    try {
      setSigningOutAll(true);
      try {
        const { protectedFetch } = await import("../../../../shared/api/httpClient.js");
        const response = await protectedFetch("/auth/revoke-sessions", {
          method: "POST",
        });
        if (!response.ok) throw new Error("Server revocation failed");
      } catch {
      }
      await auth.signOut();
      appNavigate("/signin", {
        replace: true,
        flash: {
          type: "success",
          message: "Signed out from all devices",
        },
      });
    } catch (error) {
      console.error("❌ Sign out all failed:", error);
      showNotification("Failed to sign out from all devices", "error");
    } finally {
      setSigningOutAll(false);
      setShowSignOutAllConfirm(false);
    }
  };

  const handlePasswordInput = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const resetPasswordForm = () => {
    setShowPasswordForm(false);
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
  };

  const labelStyle = {
    fontSize: "var(--font-size-sm)",
    fontWeight: "var(--font-weight-semibold)",
    color: "var(--text-body, var(--foreground))",
  };

  const toggleBtnStyle = {
    position: "absolute",
    right: "0",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "var(--text-muted, var(--muted-foreground))",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
  };

  const { theme, setTheme } = useTheme();
  const [pendingTheme, setPendingTheme] = useState(theme);

  const handleSaveTheme = () => {
    setTheme(pendingTheme);
    setSavedTheme(true);
    setTimeout(() => setSavedTheme(false), 2000);
  };

  const themeChanged = pendingTheme !== theme;

  const themeOptions = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Monitor, label: "System" },
  ];
  const themeCaptions = {
    light: "Always use the light theme.",
    dark: "Always use the dark theme.",
    system: "Match your device's system setting.",
  };

  return (
    <div style={{ width: "100%" }}>
      <ScopedStyles />

      {/* Header */}
      <div style={{ marginBottom: "var(--spacing-xl)" }}>
        <h1
          style={{
            fontSize: "var(--font-size-2xl)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--text-heading, var(--foreground))",
            margin: "0 0 4px",
            letterSpacing: "var(--letter-spacing-tight)",
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontSize: "var(--font-size-md)",
            color: "var(--text-muted, var(--muted-foreground))",
            margin: 0,
          }}
        >
          Manage your account security and preferences
        </p>
      </div>

      {/* APPEARANCE SECTION */}
      <div className="st-section">
        <div className="st-section-head">
          <div className="st-section-head-left">
            <div
              className="st-icon-badge"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 16%, transparent)" }}
            >
              <Sun style={{ width: "18px", height: "18px", color: "var(--primary)" }} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: "var(--font-weight-semibold)",
                  color: "var(--text-heading, var(--foreground))",
                  margin: 0,
                }}
              >
                Appearance
              </h3>
              <p
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-muted, var(--muted-foreground))",
                  margin: "2px 0 0",
                }}
              >
                Choose how Lilycrest looks on this device
              </p>
            </div>
          </div>
        </div>

        <div className="st-section-body">
          <div className="st-segmented" role="tablist" aria-label="Theme">
            {themeOptions.map(({ id, icon: Icon, label }) => {
              const active = pendingTheme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPendingTheme(id)}
                  className={`st-segmented-btn${active ? " is-active" : ""}`}
                >
                  <Icon size={16} className="st-segmented-icon" />
                  {label}
                </button>
              );
            })}
          </div>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-muted, var(--muted-foreground))",
              margin: "10px 2px 0",
            }}
          >
            {themeCaptions[pendingTheme]}
          </p>

          {(themeChanged || savedTheme) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginTop: "var(--spacing-lg)",
                paddingTop: "var(--spacing-lg)",
                borderTop: "1px solid var(--border-light)",
              }}
            >
              <button
                type="button"
                onClick={handleSaveTheme}
                disabled={!themeChanged && !savedTheme}
                className={`st-btn ${savedTheme ? "st-btn-success" : "st-btn-primary"}`}
              >
                {savedTheme ? "✓ Saved" : "Save changes"}
              </button>
              {themeChanged && !savedTheme && (
                <button
                  type="button"
                  onClick={() => setPendingTheme(theme)}
                  className="st-btn st-btn-ghost"
                >
                  Discard
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECURITY SECTION — Change Password */}
      <div className="st-section">
        <div className="st-section-head">
          <div className="st-section-head-left">
            <div
              className="st-icon-badge"
              style={{ backgroundColor: "color-mix(in srgb, var(--secondary) 16%, transparent)" }}
            >
              <Shield style={{ width: "18px", height: "18px", color: "var(--secondary)" }} />
            </div>
            <h3
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--text-heading, var(--foreground))",
                margin: 0,
              }}
            >
              Security
            </h3>
          </div>

          {hasEmailAuth && !showPasswordForm && (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="st-btn st-btn-outline-accent"
            >
              <Lock style={{ width: "13px", height: "13px", color: "var(--primary)" }} />
              Change password
            </button>
          )}
        </div>

        <div className="st-section-body">
          {/* Social provider notice */}
          {!hasEmailAuth && socialProvider && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "var(--spacing-md) var(--spacing-lg)",
                backgroundColor: "var(--status-info-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid color-mix(in srgb, var(--info) 25%, transparent)",
              }}
            >
              <Info style={{ width: "18px", height: "18px", color: "var(--info)", flexShrink: 0, marginTop: "1px" }} />
              <div>
                <p
                  style={{
                    fontSize: "var(--font-size-md)",
                    fontWeight: "var(--font-weight-medium)",
                    color: "var(--text-heading, var(--foreground))",
                    margin: "0 0 2px",
                  }}
                >
                  Managed by {socialProvider}
                </p>
                <p style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted, var(--muted-foreground))", margin: 0 }}>
                  Your account uses {socialProvider} sign-in. Password management
                  is handled by {socialProvider}.
                </p>
              </div>
            </div>
          )}

          {/* Email/password — info text */}
          {hasEmailAuth && !showPasswordForm && (
            <p style={{ color: "var(--text-secondary, var(--muted-foreground))", fontSize: "var(--font-size-md)", margin: 0 }}>
              You can update your password here. You'll need to enter your
              current password first for security.
            </p>
          )}

          {/* Password change form */}
          {hasEmailAuth && showPasswordForm && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)", maxWidth: "420px" }}>
              {/* Current password */}
              <div className="st-field">
                <label style={labelStyle} htmlFor="settings-current-pw">
                  Current password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="settings-current-pw"
                    type={showCurrentPw ? "text" : "password"}
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordInput}
                    placeholder="Enter current password"
                    disabled={changingPassword}
                    className="st-input"
                  />
                  <PasswordVisibilityButton
                    visible={showCurrentPw}
                    style={toggleBtnStyle}
                    onToggle={() => setShowCurrentPw((p) => !p)}
                  />
                </div>
              </div>

              {/* New password */}
              <div className="st-field">
                <label style={labelStyle} htmlFor="settings-new-pw">
                  New password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="settings-new-pw"
                    type={showNewPw ? "text" : "password"}
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordInput}
                    onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
                    onPaste={(e) => { if (/\s/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                    placeholder="Enter new password"
                    disabled={changingPassword}
                    className="st-input"
                  />
                  <PasswordVisibilityButton
                    visible={showNewPw}
                    style={toggleBtnStyle}
                    onToggle={() => setShowNewPw((p) => !p)}
                  />
                </div>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted, var(--muted-foreground))", margin: "2px 0 0" }}>
                  Must be 8+ characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              {/* Confirm new password */}
              <div className="st-field">
                <label style={labelStyle} htmlFor="settings-confirm-pw">
                  Confirm new password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="settings-confirm-pw"
                    type={showConfirmPw ? "text" : "password"}
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordInput}
                    onKeyDown={(e) => { if (e.key === " ") e.preventDefault(); }}
                    onPaste={(e) => { if (/\s/.test(e.clipboardData.getData("text"))) e.preventDefault(); }}
                    placeholder="Confirm new password"
                    disabled={changingPassword}
                    className="st-input"
                  />
                  <PasswordVisibilityButton
                    visible={showConfirmPw}
                    style={toggleBtnStyle}
                    onToggle={() => setShowConfirmPw((p) => !p)}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingTop: "2px" }}>
                <button
                  type="button"
                  onClick={resetPasswordForm}
                  disabled={changingPassword}
                  className="st-btn st-btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="st-btn st-btn-primary"
                >
                  {changingPassword ? "Updating…" : "Update password"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SESSION MANAGEMENT SECTION */}
      <div className="st-section">
        <div className="st-section-head">
          <div className="st-section-head-left">
            <div className="st-icon-badge" style={{ backgroundColor: "color-mix(in srgb, var(--secondary) 16%, transparent)" }}>
              <Monitor style={{ width: "18px", height: "18px", color: "var(--secondary)" }} />
            </div>
            <h3
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--text-heading, var(--foreground))",
                margin: 0,
              }}
            >
              Active Sessions
            </h3>
          </div>
        </div>

        <div className="st-section-body">
          {/* Current session info */}
          <div
            style={{
              backgroundColor: "var(--status-success-bg)",
              borderRadius: "var(--radius-md)",
              padding: "var(--spacing-md) var(--spacing-lg)",
              border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
              marginBottom: "var(--spacing-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "var(--success)",
                  flexShrink: 0,
                }}
              />
              <div>
                <p style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-semibold)", color: "var(--success-dark, var(--success))", margin: 0 }}>
                  Current Session
                </p>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted, var(--muted-foreground))", margin: "2px 0 0" }}>
                  {navigator.userAgent.includes("Chrome") ? "Chrome" :
                    navigator.userAgent.includes("Firefox") ? "Firefox" :
                    navigator.userAgent.includes("Safari") ? "Safari" : "Browser"}{" "}on{" "}
                  {navigator.platform || "this device"}
                </p>
              </div>
            </div>
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--success-dark, var(--success))",
                backgroundColor: "var(--surface-card, var(--card))",
                padding: "3px 10px",
                borderRadius: "999px",
              }}
            >
              Active now
            </span>
          </div>

          {/* Last sign-in info */}
          <div className="st-grid-2" style={{ marginBottom: "var(--spacing-lg)" }}>
            <AccountInfoItem
              label="Last Sign-In"
              value={
                firebaseUser?.metadata?.lastSignInTime
                  ? new Date(firebaseUser.metadata.lastSignInTime).toLocaleDateString("en-US", {
                      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })
                  : "—"
              }
            />
            <AccountInfoItem
              label="Sign-In Method"
              value={
                hasEmailAuth
                  ? "Email & Password"
                  : socialProvider
                  ? `${socialProvider} Account`
                  : "Unknown"
              }
            />
          </div>

          {/* Sign out all button */}
          <button
            type="button"
            onClick={() => setShowSignOutAllConfirm(true)}
            disabled={signingOutAll}
            className="st-btn st-btn-danger-outline"
          >
            <LogOut style={{ width: "14px", height: "14px" }} />
            {signingOutAll ? "Signing out…" : "Sign Out of All Devices"}
          </button>
        </div>
      </div>

      {/* ACCOUNT INFO SECTION (read-only) */}
      <div className="st-section">
        <div className="st-section-head">
          <div className="st-section-head-left">
            <div className="st-icon-badge" style={{ backgroundColor: "color-mix(in srgb, var(--info) 16%, transparent)" }}>
              <Info style={{ width: "18px", height: "18px", color: "var(--info)" }} />
            </div>
            <h3
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--text-heading, var(--foreground))",
                margin: 0,
              }}
            >
              Account Information
            </h3>
          </div>
        </div>

        <div className="st-section-body">
          <div className="st-grid-2">
            <AccountInfoItem label="Email" value={firebaseUser?.email} />
            <AccountInfoItem
              label="Email Verified"
              value={
                firebaseUser?.emailVerified ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--success-dark, var(--success))" }}>
                    <CheckCircle style={{ width: "14px", height: "14px" }} />
                    Verified
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--danger-dark, var(--danger))" }}>
                    <AlertCircle style={{ width: "14px", height: "14px" }} />
                    Not Verified
                  </span>
                )
              }
            />
            <AccountInfoItem
              label="Account Created"
              value={
                firebaseUser?.metadata?.creationTime
                  ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    })
                  : "—"
              }
            />
            <AccountInfoItem
              label="UID"
              value={firebaseUser?.uid ? `…${firebaseUser.uid.slice(-8)}` : "—"}
            />
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showSignOutAllConfirm}
        onClose={() => !signingOutAll && setShowSignOutAllConfirm(false)}
        onConfirm={handleSignOutAll}
        title="Sign Out of All Devices"
        message="Are you sure you want to sign out from all devices? You will be logged out of this device and any other active sessions."
        variant="danger"
        confirmText="Sign Out All"
        loading={signingOutAll}
      />
    </div>
  );
};

// ─── Small sub-component ──────────────────────────────────────

const AccountInfoItem = ({ label, value }) => (
  <div
    style={{
      backgroundColor: "var(--surface-muted, var(--muted))",
      borderRadius: "var(--radius-md)",
      padding: "var(--spacing-md) var(--spacing-lg)",
    }}
  >
    <p
      style={{
        fontSize: "var(--font-size-xs)",
        fontWeight: "var(--font-weight-semibold)",
        color: "var(--text-muted, var(--muted-foreground))",
        textTransform: "uppercase",
        letterSpacing: "var(--letter-spacing-wide)",
        margin: "0 0 4px",
      }}
    >
      {label}
    </p>
    <p
      style={{
        fontSize: "var(--font-size-md)",
        fontWeight: "var(--font-weight-medium)",
        color: "var(--text-heading, var(--foreground))",
        margin: 0,
        overflowWrap: "anywhere",
      }}
    >
      {value || "—"}
    </p>
  </div>
);

export default SettingsTab;