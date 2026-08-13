/**
 * ============================================================================
 * MOBILE POLICY DOCUMENT BRIDGE
 * ============================================================================
 *
 * Canonical content backing GET /api/m/documents/:docId.
 *
 * Audit context: the frontend calls this generic endpoint with exactly five
 * static keys (house_rules, curfew_policy, visitor_policy, payment_terms,
 * emergency_procedures) from the "My Documents" and "House Rules & Documents"
 * screens — never with a per-user or per-record id, and never for contracts
 * (those use /api/m/contracts/:id/documents/{prepared,final}) or bills (those
 * use /api/m/billing/:id/pdf). It was previously served by TWO independently
 * drifted, hardcoded copies (this repo's server/mobile/controllers/
 * documents.controller.js and the standalone mobile backend's own copy) plus
 * a sixth "valid_id" key that fabricated a per-tenant "ID verification
 * status" with no actual verification check behind it — never called by the
 * frontend, so it is deliberately NOT carried forward here.
 *
 * There is no admin-editable Policy/CMS content model in this system, so
 * "canonical" here means: ONE structured content source (this file, on the
 * canonical backend), superseding the vendored duplicate, containing no
 * per-tenant fabricated claims — not "pulled from a database record". A
 * future phase could introduce a real editable Policy model if the business
 * wants these documents to be live-editable without a code deploy.
 */

import { buildBrandedPdf as buildBrandedPdfCjs } from "../mobile/utils/pdfBuilder.js";

// server/mobile/utils/pdfBuilder.js is CommonJS (module.exports = { buildBrandedPdf, esc }).
// Node's ESM/CJS interop resolves a named import of a CJS module's
// module.exports properties via cjs-module-lexer static analysis, but fall
// back defensively in case that analysis ever fails to pick up the named
// export (e.g. after an unrelated edit to that file).
import pdfBuilderDefault from "../mobile/utils/pdfBuilder.js";
const buildBrandedPdf = buildBrandedPdfCjs || pdfBuilderDefault.buildBrandedPdf;

function normalizeLine(line) {
  if (!line) return "";
  return String(line)
    .replace(/•/g, "-")
    .replace(/₱/g, "PHP ")
    .replace(/✓/g, "Yes")
    .replace(/[–—]/g, "-")
    .trimEnd();
}

export const POLICY_DOCUMENT_IDS = Object.freeze([
  "house_rules", "curfew_policy", "visitor_policy", "payment_terms", "emergency_procedures",
]);

function policyDocuments(today) {
  return {
    house_rules: {
      title: "House Rules",
      docType: "POLICY DOCUMENT",
      date: `Effective as of: ${today}`,
      sections: [
        { heading: "Quiet Hours", lines: ["10:00 PM - 7:00 AM; keep noise to a minimum and respect neighbors."] },
        { heading: "Visitors", lines: [
          "Visiting hours: 8:00 AM - 9:00 PM.",
          "Register with valid ID at the front desk.",
          "Maximum 2 visitors at a time; no overnight guests.",
        ] },
        { heading: "Curfew", lines: [
          "Main gate closes at 11:00 PM.",
          "Coordinate in advance for late entry.",
          "Late entry fee: PHP 100.",
        ] },
        { heading: "Cleanliness", lines: [
          "Keep rooms tidy at all times.",
          "No food waste in rooms; report pests immediately.",
          "No pets allowed.",
        ] },
        { heading: "Prohibited Items", lines: [
          "Cooking appliances in rooms.",
          "Smoking inside the premises.",
          "Illegal substances of any kind.",
        ] },
        { heading: "Common Areas", lines: [
          "Kitchen hours: 6:00 AM - 10:00 PM.",
          "Clean up after use; label personal food items.",
        ] },
        { heading: "Payments", lines: [
          "Due on the 5th; grace period until the 7th.",
          "Late fee: PHP 50 per day.",
        ] },
        { heading: "Violations", lines: ["May incur written warnings, fines, or tenancy review."] },
      ],
    },
    curfew_policy: {
      title: "Curfew Policy",
      docType: "POLICY DOCUMENT",
      date: `Effective as of: ${today}`,
      sections: [
        { heading: "Gate Hours", lines: ["Main gate closes at 11:00 PM and opens at 5:00 AM.", "Quiet hours: 10:00 PM - 7:00 AM."] },
        { heading: "Late Entry", lines: ["Coordinate before 9:00 PM if expecting to arrive after 11:00 PM.", "Emergency late entry fee: PHP 100 (waived for documented emergencies)."] },
        { heading: "Escalation", lines: ["- 1st offense: Verbal warning", "- 2nd offense: Written warning", "- 3rd offense: PHP 500 fine", "- Repeated: Tenancy review"] },
        { heading: "Exceptions", lines: ["Medical emergencies.", "Work-related with employer letter.", "Pre-approved events."] },
      ],
    },
    visitor_policy: {
      title: "Visitor Policy",
      docType: "POLICY DOCUMENT",
      date: `Effective as of: ${today}`,
      sections: [
        { heading: "Visiting Hours", lines: ["Daily: 8:00 AM - 9:00 PM."] },
        { heading: "Registration", lines: ["Valid ID required at the front desk.", "Tenant must receive visitor in person.", "Sign in and out required."] },
        { heading: "Limits", lines: ["Maximum 2 visitors at a time.", "No overnight guests permitted.", "Rooms closed to visitors after 8:00 PM."] },
        { heading: "Prohibited", lines: ["- Unregistered visitors", "- Visitors during quiet hours (10 PM - 7 AM)", "- Leaving visitors unattended"] },
        { heading: "Responsibilities", lines: ["Tenant is liable for visitor behavior and any damages caused."] },
        { heading: "Events", lines: ["Request admin approval at least 3 days in advance."] },
      ],
    },
    payment_terms: {
      title: "Payment Terms",
      docType: "PAYMENT POLICY",
      date: `Effective as of: ${today}`,
      sections: [
        { heading: "Due Dates", lines: ["5th of each month; grace period through the 7th.", "Late fee: PHP 50/day after grace; maximum PHP 1,500/month."] },
        { heading: "Accepted Payment Methods", lines: ["- Online: PayMongo (GCash, Maya, Card) via the app"] },
        { heading: "Important Notes", lines: ["Always upload proof of payment in the app.", "Verification takes 24-48 hours."] },
        { heading: "Utilities", lines: ["Water and WiFi included.", "Electricity billed separately (sub-metered)."] },
        { heading: "Non-Payment Escalation", lines: ["- 15 days: Final notice", "- 30 days: Service restriction", "- 45 days: Tenancy review"] },
      ],
    },
    emergency_procedures: {
      title: "Emergency Procedures",
      docType: "SAFETY DOCUMENT",
      date: `Effective as of: ${today}`,
      sections: [
        { heading: "Emergency Contacts", lines: [
          "- Admin: Contact the admin office during business hours.",
          "- Security: Available 24/7 on-site.",
        ] },
        { heading: "Fire", lines: ["Sound the alarm immediately.", "Avoid elevators; use emergency exits.", "Assembly point: Parking lot.", "Call 911."] },
        { heading: "Earthquake", lines: ["Drop, cover, and hold on.", "Stay away from windows.", "Evacuate if structural damage is visible.", "Meet at the assembly point."] },
        { heading: "Medical Emergency", lines: ["Call building security immediately.", "Do not move the injured person.", "Admin will coordinate ambulance dispatch."] },
        { heading: "Safety Equipment", lines: ["Fire extinguishers: Hallways, kitchen, lobby."] },
      ],
    },
  };
}

/**
 * Build the branded PDF for a static policy document id, or null if docId
 * isn't one of the five known policy keys.
 */
export function buildPolicyDocumentPdf(docId) {
  if (!POLICY_DOCUMENT_IDS.includes(docId)) return null;

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const payload = policyDocuments(today)[docId];
  if (!payload) return null;

  const normalizedSections = (payload.sections || []).map((s) => ({
    heading: s.heading,
    lines: (s.lines || []).map(normalizeLine),
  }));

  return buildBrandedPdf({
    title: payload.title,
    subtitle: payload.subtitle || "",
    docType: payload.docType || "",
    date: payload.date || "",
    infoRows: [],
    sections: normalizedSections,
  });
}
