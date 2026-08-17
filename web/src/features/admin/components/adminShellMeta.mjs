const PAGE_META = {
  "/admin/dashboard": {
    title: "Dashboard",
    description:
      "Monitor branch activity, queue pressure, and urgent follow-up from one operations view.",
  },
  "/admin/reservations": {
    title: "Reservations",
    description:
      "Review applications, confirm documents, and move accepted residents toward assignment.",
  },
  "/admin/tenants": {
    title: "Tenants",
    description:
      "Handle renewals, transfers, move-out actions, and current-stay visibility in one workspace.",
  },
  "/admin/contracts": {
    title: "Contracts",
    description:
      "Create, verify, generate, and review versioned prepared Contract copies from official templates.",
  },
  "/admin/users": {
    title: "Accounts & Access",
    description:
      "Manage user accounts, credentials, and configure granular branch admin access permissions.",
  },
  "/admin/room-availability": {
    title: "Room Management",
    description:
      "Track available capacity, assignments, and turnover across rooms without leaving operations.",
  },
  "/admin/audit-logs": {
    title: "Audit & Security",
    description:
      "Review audit events, trace administrative changes, and inspect security-relevant activity.",
  },
  "/admin/billing": {
    title: "Billing",
    description:
      "Generate statements, review balances, and follow payment progress without leaving the admin workspace.",
  },
  "/admin/analytics": {
    title: "Analytics",
    description:
      "Review occupancy, billing, operations, and owner-level indicators from one consolidated analytics overview.",
  },
  "/admin/analytics/details": {
    title: "Analytics Details",
    description:
      "Review detailed analytics tabs, exports, and deeper operational breakdowns.",
  },

  "/admin/maintenance": {
    title: "Maintenance",
    description:
      "Review tenant repair requests, assign work, and keep the tenant-visible admin response up to date.",
  },
  "/admin/chat": {
    title: "Support Chat",
    description:
      "View tenant conversations, respond from the dashboard, and keep branch messages moving.",
  },
  "/admin/announcements": {
    title: "Announcements",
    description:
      "Publish notices with clearer targeting and follow-up visibility.",
  },
  "/admin/notifications": {
    title: "Notifications",
    description:
      "Review SLA breaches, billing alerts, maintenance updates, and all system events in one place.",
  },
  "/admin/branches": {
    title: "Branches",
    description:
      "Manage branch-level details that affect room inventory and resident operations.",
  },
  "/admin/roles": {
    title: "Roles & Permissions",
    description:
      "Adjust branch admin capabilities carefully so access stays predictable and auditable.",
  },
  "/admin/settings": {
    title: "Policies & Maintenance",
    description:
      "Control platform policies, defaults, branch overrides, and manage database backup and recovery.",
  },
};

const ANALYTICS_DETAILS_META = {
  occupancy: {
    title: "Analytics Details - Occupancy",
    description:
      "Track room utilization, capacity shifts, and current availability from the detailed analytics workspace.",
  },
  billing: {
    title: "Analytics Details - Billing",
    description:
      "Monitor collections, overdue balances, and branch billing performance without leaving detailed analytics.",
  },
  operations: {
    title: "Analytics Details - Operations",
    description:
      "Inspect reservation flow, inquiry timing, and maintenance workload in the detailed analytics workspace.",
  },
  financials: {
    title: "Analytics Details - Financials",
    description:
      "Review owner financial performance, overdue exposure, and collection trends across branches.",
  },
  monitoring: {
    title: "Analytics Details - System Monitoring",
    description:
      "Inspect owner-level audit activity, security signals, and operational anomalies from detailed analytics.",
  },
};

const PAGE_TAB_META = {
  "/admin/analytics": {
    overview: "Overview",
    occupancy: "Occupancy",
    billing: "Billing & Revenue",
    operations: "Operations",
    demographics: "Demographics",
    acquisition: "Lead Acquisition",
    financials: "Financials",
    monitoring: "Monitoring",
    consolidated: "Consolidated",
  },
  "/admin/billing": {
    electricity: "Electricity",
    water: "Water",
    rent: "Rent",
    "reservation-payments": "Reservation Payments",
    "overdue-notices": "Overdue Notices",
    violations: "Violations",
  },
  "/admin/room-availability": {
    rooms: "Room Inventory",
    occupancy: "Occupancy",
    forecast: "Vacancy Forecast",
    blackout: "Blackout Dates",
  },
  "/admin/tenants": {
    active: "Active Tenants",
    renewals: "Lease Renewals",
    transfers: "Room Transfers",
    moveouts: "Move-Outs",
    violations: "Violations",
  },
  "/admin/users": {
    accounts: "User Accounts",
    roles: "Roles & Permissions",
    permissions: "Roles & Permissions",
    activity: "Activity Logs",
  },
  "/admin/reservations": {
    applications: "Applications",
    pipeline: "Visit Pipeline",
    schedules: "Visit Schedules",
    availability: "Availability Slots",
    conflicts: "Conflict Warnings",
    blackout: "Blackout Dates",
  },
  "/admin/audit-logs": {
    events: "Event Log",
    security: "Security Alerts",
    actions: "Admin Actions",
  },
  "/admin/maintenance": {
    active: "Active Tickets",
    history: "Service History",
    schedules: "Schedules",
  },
  "/admin/announcements": {
    published: "Published",
    drafts: "Drafts",
    scheduled: "Scheduled",
    archived: "Archive",
  },
  "/admin/notifications": {
    all: "All Alerts",
    sla: "SLA Breaches",
    system: "System Events",
  },
};

export function getPageMeta(pathname, search = "") {
  const params = new URLSearchParams(search);

  if (pathname.startsWith("/admin/contracts/")) {
    const base = PAGE_META["/admin/contracts"];
    return {
      ...base,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Contracts", href: "/admin/contracts" },
        { label: "Contract Details" },
      ],
    };
  }

  if (pathname === "/admin/analytics/details") {
    const tab = params.get("tab") || "occupancy";
    const detailMeta = ANALYTICS_DETAILS_META[tab] || ANALYTICS_DETAILS_META.occupancy;
    const tabLabel = PAGE_TAB_META["/admin/analytics"]?.[tab] || "Occupancy";
    return {
      ...detailMeta,
      activeTab: tab,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Analytics", href: "/admin/analytics" },
        { label: `Details - ${tabLabel}` },
      ],
    };
  }

  if (pathname === "/admin/room-availability") {
    const tab = params.get("tab") || "rooms";
    let subTitle = "Room Management";
    let subDesc = PAGE_META["/admin/room-availability"].description;

    if (tab === "occupancy") {
      subTitle = "Room Occupancy";
      subDesc = "See who is assigned where and catch room-level conflicts early.";
    } else if (tab === "forecast") {
      subTitle = "Vacancy Forecast";
      subDesc = "Plan around expected openings, pending reservations, and room turnover.";
    }

    const tabLabel = PAGE_TAB_META["/admin/room-availability"]?.[tab] || "Room Inventory";

    return {
      title: subTitle,
      description: subDesc,
      activeTab: tab,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Room Management", href: "/admin/room-availability" },
        { label: tabLabel },
      ],
    };
  }

  const baseMeta = PAGE_META[pathname] || {
    title: "Admin",
    description: "Manage daily operations, resident workflows, and branch performance.",
  };

  // Dashboard route
  if (pathname === "/admin/dashboard") {
    return {
      ...baseMeta,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Dashboard" },
      ],
    };
  }

  // Check if page has sub-tabs defined
  const tabMap = PAGE_TAB_META[pathname];
  if (tabMap) {
    const defaultTabKey = Object.keys(tabMap)[0];
    const tabParam = params.get("tab");
    const activeTabKey = tabParam && tabMap[tabParam] ? tabParam : defaultTabKey;
    const activeTabLabel = tabMap[activeTabKey] || tabMap[defaultTabKey];

    return {
      ...baseMeta,
      activeTab: activeTabKey,
      breadcrumbs: [
        { label: "Admin", href: "/admin/dashboard" },
        { label: baseMeta.title, href: pathname },
        { label: activeTabLabel },
      ],
    };
  }

  return {
    ...baseMeta,
    breadcrumbs: [
      { label: "Admin", href: "/admin/dashboard" },
      { label: baseMeta.title },
    ],
  };
}

export { PAGE_META, ANALYTICS_DETAILS_META, PAGE_TAB_META };
