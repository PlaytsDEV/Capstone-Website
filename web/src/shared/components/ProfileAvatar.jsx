import React from "react";

export function getProfileInitials(user = {}, fallback = "U") {
  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();
  const username = String(user?.username || "").trim();
  const email = String(user?.email || "").trim();
  const displayName = String(user?.name || user?.fullName || "").trim();

  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const first = firstName[0] || nameParts[0]?.[0] || username[0] || email[0];
  const last = lastName[0] || nameParts[1]?.[0] || "";

  return `${first || fallback[0] || "U"}${last}`.toUpperCase();
}

export default function ProfileAvatar({
  user,
  initials,
  src,
  alt,
  size = 32,
  className = "",
  style,
  ...props
}) {
  const label = initials || getProfileInitials(user);
  const imageSrc = src || user?.profileImage || user?.profileImageUrl || user?.avatar;

  const baseStyle = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #D4AF37 0%, #B88A1A 100%)",
    color: "#0F172A",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.max(11, Math.round(size * 0.34)),
    fontWeight: 700,
    lineHeight: 1,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(184, 138, 26, 0.28)",
    flexShrink: 0,
    ...style,
  };

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={alt || "Profile"}
        className={className}
        style={{ ...baseStyle, objectFit: "cover" }}
        {...props}
      />
    );
  }

  return (
    <span className={className} style={baseStyle} aria-hidden="true" {...props}>
      {label}
    </span>
  );
}
