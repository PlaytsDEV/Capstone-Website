import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ProfileAvatar from "../../../../shared/components/ProfileAvatar";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount || 0);

export default function AdminTenantInfoCard({ tenant, onCloseDrawer }) {
  const navigate = useNavigate();
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  if (!tenant) return null;

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "phone") {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleOpenChat = () => {
    if (onCloseDrawer) onCloseDrawer();
    navigate(`/admin/chat?tenantId=${tenant._id}`);
  };

  const handleOpenBilling = () => {
    if (onCloseDrawer) onCloseDrawer();
    navigate(`/admin/billing?search=${encodeURIComponent(tenant.fullName)}`);
  };

  const handleOpenProfile = () => {
    if (onCloseDrawer) onCloseDrawer();
    navigate(`/admin/tenants?search=${encodeURIComponent(tenant.fullName)}`);
  };

  const branchLabel =
    tenant.branch === "gil-puyat"
      ? "Gil Puyat"
      : tenant.branch === "guadalupe"
      ? "Guadalupe"
      : tenant.branch || "General";

  const isOverdue = tenant.hasOverdue || (tenant.balance > 0 && !tenant.isSettled);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-xs text-xs">
      {/* Card Header: Avatar, Name & Status */}
      <div className="flex items-start justify-between gap-2.5 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <ProfileAvatar
            src={tenant.profileImage}
            user={{ name: tenant.fullName, firstName: tenant.firstName, lastName: tenant.lastName }}
            size={36}
            className="shrink-0 ring-1 ring-border/50"
          />
          <div className="min-w-0 space-y-0.5">
            <h4 className="font-bold text-sm text-foreground truncate">{tenant.fullName}</h4>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-medium">ID: {tenant.userId}</span>
              <span>·</span>
              <span className="truncate">{branchLabel}</span>
            </div>
          </div>
        </div>

        {/* Transparent Status Badge with Colored Dot */}
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-[11px] font-semibold bg-transparent text-foreground shrink-0">
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
              tenant.tenantStatus === "Active Tenant"
                ? "bg-emerald-500"
                : tenant.tenantStatus === "Applicant"
                ? "bg-sky-500"
                : tenant.tenantStatus === "Moved Out"
                ? "bg-slate-400"
                : "bg-amber-500"
            }`}
          />
          <span>{tenant.tenantStatus}</span>
        </span>
      </div>

      {/* Grid: Room & Bed + Billing & Rent */}
      <div className="grid grid-cols-2 gap-2">
        {/* Room Info Box */}
        <div className="p-2.5 rounded-lg bg-muted/30 border border-border space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Room & Unit
          </div>
          <div className="font-bold text-foreground text-xs">
            {tenant.roomNumber !== "Unassigned" ? `Room ${tenant.roomNumber}` : "Unassigned"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{tenant.bedLabel}</div>
        </div>

        {/* Billing Info Box */}
        <div className="p-2.5 rounded-lg bg-muted/30 border border-border space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Outstanding Balance
          </div>
          <div className={`font-bold text-xs ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {formatCurrency(tenant.balance)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {tenant.isSettled ? "Settled (No Balance)" : "Pending Payment"}
          </div>
        </div>
      </div>

      {/* Additional Stats: Monthly Rent & Maintenance Tickets */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Monthly Rent:</span>
          <span className="font-semibold text-foreground">
            {tenant.monthlyRent > 0 ? formatCurrency(tenant.monthlyRent) : "N/A"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Open Tickets:</span>
          <span className={`font-semibold ${tenant.openMaintenanceCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
            {tenant.openMaintenanceCount}
          </span>
        </div>
      </div>

      {/* Contact Details with 1-Click Copy */}
      <div className="space-y-1.5 pt-1">
        {tenant.phone && tenant.phone !== "No phone on file" && (
          <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/20 border border-border/50">
            <div className="text-foreground truncate min-w-0">
              <span className="text-muted-foreground mr-1">Phone:</span>
              <span className="truncate">{tenant.phone}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(tenant.phone, "phone")}
              className="text-[10px] text-muted-foreground hover:text-foreground font-medium shrink-0 cursor-pointer ml-2"
              title="Copy phone"
            >
              <span>{copiedPhone ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}

        {tenant.email && tenant.email !== "No email on file" && (
          <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/20 border border-border/50">
            <div className="text-foreground truncate min-w-0">
              <span className="text-muted-foreground mr-1">Email:</span>
              <span className="truncate">{tenant.email}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(tenant.email, "email")}
              className="text-[10px] text-muted-foreground hover:text-foreground font-medium shrink-0 cursor-pointer ml-2"
              title="Copy email"
            >
              <span>{copiedEmail ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>

      {/* 1-Click Action Buttons */}
      <div className="grid grid-cols-3 gap-1.5 pt-1">
        <button
          type="button"
          onClick={handleOpenChat}
          className="flex items-center justify-center py-1.5 px-2 rounded-lg bg-primary text-primary-foreground font-semibold text-[11px] hover:bg-primary/90 transition-colors cursor-pointer shadow-2xs"
        >
          <span>Chat</span>
        </button>

        <button
          type="button"
          onClick={handleOpenBilling}
          className="flex items-center justify-center py-1.5 px-2 rounded-lg bg-card border border-border text-foreground font-semibold text-[11px] hover:bg-muted transition-colors cursor-pointer"
        >
          <span>Billing</span>
        </button>

        <button
          type="button"
          onClick={handleOpenProfile}
          className="flex items-center justify-center py-1.5 px-2 rounded-lg bg-card border border-border text-foreground font-semibold text-[11px] hover:bg-muted transition-colors cursor-pointer"
        >
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}
