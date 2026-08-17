/**
 * adminKnowledgeBase.js
 * Lilycrest Dormitory Operations Manual data for Admin Operations Assistant.
 */

export const adminSOPs = [
  {
    category: "Move-In & Key Handover Protocol",
    section: "§2.3",
    content: "Before key issuance, the branch admin must verify full payment of 1-month advance rent and 1-month security deposit, signed lease contract, and submitted KYC identification. Tenant and admin complete the digital Room Inventory Checklist prior to physical key handover.",
    tags: ["move-in", "check-in", "key handover", "onboarding", "inventory", "checklist"]
  },
  {
    category: "Move-Out & Clearance Protocol",
    section: "§3.1",
    content: "Deposit refund settlement processing takes 15 to 30 days after move-out. A room inspection checklist must be completed and signed by both the tenant and the admin prior to clearance. Any damages or unpaid utility bills are deducted from the security deposit.",
    tags: ["move-out", "clearance", "deposit", "refund", "inspection", "checkout"]
  },
  {
    category: "Urgent Maintenance Escalation",
    section: "§4.2",
    content: "Urgent plumbing and electrical issues have a 4-hour target turnaround time. Standard repairs have a 24 to 48-hour target turnaround time. If the in-house technician is unavailable for an emergency, the on-call third-party contractor must be dispatched immediately.",
    tags: ["maintenance", "urgent", "turnaround time", "plumbing", "electrical", "emergency", "technician"]
  },
  {
    category: "Utility Billing Disputes & Payment Grace Periods",
    section: "§5.4",
    content: "Billing disputes must be raised within 3 days of invoice issuance. Meter re-check procedures involve taking a new physical photo of the submeter. Payment grace periods are 5 days past due date before a 5% late penalty is applied. Rent follows individual move-in cycle; electricity is computed on the 15th.",
    tags: ["billing", "dispute", "grace period", "penalty", "meter", "submeter", "electricity", "rent"]
  },
  {
    category: "Room Swap & Bed Relocation Governance",
    section: "§6.1",
    content: "Room swap requests must be submitted through the admin portal and are subject to room availability and branch admin approval. A standard administrative cleaning fee of ₱500 applies for non-emergency room transfers. Both affected rooms must pass inspection.",
    tags: ["room swap", "bed swap", "relocation", "transfer", "change room"]
  },
  {
    category: "Key & Lock Governance",
    section: "§7.2",
    content: "Lost key replacement requires a fee of ₱250. A temporary master key may be issued but must be logged in the temporary master key log. Tenants must surrender the temporary key within 24 hours. Lock replacement due to security breach is assessed at ₱750.",
    tags: ["key", "lost key", "fee", "lockout", "master key", "lock replacement"]
  },
  {
    category: "Visitor & Overnight Guest Governance",
    section: "§8.1",
    content: "Visiting hours in common lounges are from 8:00 AM to 8:00 PM daily. Visitors must log in at the front desk and surrender a valid ID. Overnight guests require 48 hours advance notice, branch admin approval, and an overnight fee of ₱300 per night. Unregistered guests incur a violation notice.",
    tags: ["visitor", "guest", "curfew", "log", "overnight", "lounge"]
  },
  {
    category: "Curfew & Night-Shift Late Entry Protocol",
    section: "§9.1",
    content: "Main dormitory entrance gates lock at 11:00 PM and reopen at 5:00 AM. 24/7 late entry is permitted for working professionals and students holding night-shift company badges, student IDs with late lab schedules, or prior written logs with front desk security.",
    tags: ["curfew", "night shift", "late entry", "gate", "hours", "access"]
  }
];

export const getRelevantAdminSOPs = (query) => {
  if (!query) return adminSOPs;
  const lowercaseQuery = query.toLowerCase();
  return adminSOPs.filter((sop) =>
    sop.category.toLowerCase().includes(lowercaseQuery) ||
    sop.content.toLowerCase().includes(lowercaseQuery) ||
    sop.tags.some((tag) => lowercaseQuery.includes(tag))
  );
};

export const formatSOPContext = (sops) => {
  return sops.map((sop) => `${sop.section} - ${sop.category}:\n${sop.content}`).join("\n\n");
};
