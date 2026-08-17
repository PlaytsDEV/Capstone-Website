/**
 * adminKnowledgeBase.js
 * Lilycrest Dormitory Operations Manual data for Admin Copilot.
 */

export const adminSOPs = [
  {
    category: "Key & Lock Governance",
    section: "§7.2",
    content: "Lost key replacement requires a fee of ₱250. A temporary master key may be issued but must be logged in the temporary master key log. Tenants must surrender the temporary key within 24 hours.",
    tags: ["key", "lost key", "fee", "lockout"]
  },
  {
    category: "Move-Out & Clearance Protocol",
    section: "§3.1",
    content: "Deposit refund settlement processing takes 15-30 days after move-out. A room inspection checklist must be completed and signed by both the tenant and the admin prior to clearance.",
    tags: ["move-out", "clearance", "deposit", "refund", "inspection"]
  },
  {
    category: "Utility Billing Disputes & Payment Grace Periods",
    section: "§5.4",
    content: "Billing disputes must be raised within 3 days of invoice issuance. Meter re-check procedures involve taking a new photo of the meter. Payment grace periods are 5 days past due date before a 5% penalty is applied.",
    tags: ["billing", "dispute", "grace period", "penalty", "meter"]
  },
  {
    category: "Visitor & Overnight Guest Governance",
    section: "§8.1",
    content: "Visiting hours are from 8:00 AM to 10:00 PM. Curfew hours are strictly enforced. All visitors must log in at the front desk and leave an ID in the visitor registration log. Overnight guests require 48 hours prior approval and an overnight fee of ₱300 per night.",
    tags: ["visitor", "guest", "curfew", "log", "overnight"]
  },
  {
    category: "Urgent Maintenance Escalation",
    section: "§4.2",
    content: "Urgent plumbing and electrical issues have a 4-hour SLA (Service Level Agreement). Emergency protocols dictate that if the in-house technician is unavailable, the on-call third-party contractor must be dispatched immediately.",
    tags: ["maintenance", "urgent", "SLA", "plumbing", "electrical", "emergency"]
  }
];

export const getRelevantAdminSOPs = (query) => {
  if (!query) return adminSOPs;
  const lowercaseQuery = query.toLowerCase();
  return adminSOPs.filter(sop => 
    sop.category.toLowerCase().includes(lowercaseQuery) || 
    sop.content.toLowerCase().includes(lowercaseQuery) ||
    sop.tags.some(tag => lowercaseQuery.includes(tag))
  );
};

export const formatSOPContext = (sops) => {
  return sops.map(sop => `${sop.section} - ${sop.category}:\n${sop.content}`).join('\n\n');
};
