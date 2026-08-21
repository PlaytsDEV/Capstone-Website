// Shared canonical address normalization. This is the ONLY place that
// dedupes/cleans an address string — every write path that persists a
// tenant/applicant address (registration, admin edit, tenant self-service
// edit, Contract creation) must route through normalizeAddress() rather than
// reimplementing its own join/cleanup logic.
//
// Design constraint: only exact (case-insensitive, whitespace-normalized)
// segment or segment-sequence equality is ever collapsed. Fuzzy/substring/
// prefix matching is deliberately never used for dedup, because that is
// exactly what would incorrectly collapse legitimately similar but distinct
// place names, e.g. "San Jose, San Jose del Monte" or
// "General Trias, General Trias City" — those are prefix relationships, not
// exact-equality duplicates, so this algorithm structurally leaves them
// unchanged.

export const ADDRESS_NORMALIZE_STATUS = Object.freeze({
  AUTO_FIXED: "AUTO_FIXED",
  UNCHANGED: "UNCHANGED",
  ALREADY_CLEAN: "ALREADY_CLEAN",
});

const collapseWhitespace = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// Strips a trailing region qualifier (e.g. ", National Capital Region (NCR)",
// ", NCR", ", Region IV-A") — a distinct concern from dedup, applied as its
// own step by callers that need it (Contract-facing address resolution).
export const stripRegionSuffix = (input) => {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/,\s*(National Capital Region\s*(\(NCR\))?|NCR|Region\s+[IVXLCDM\d\-A-Za-z]+(\s*\([^)]+\))?)\s*$/i, "")
    .trim();
};

// Joins a Reservation/User-shaped structured address object into a single
// display string. Individual structured fields are never normalized in
// place — normalization only applies at this joined-string boundary.
export const joinAddressParts = (address) => {
  if (!address || typeof address !== "object") return "";
  const hasValue = (value) =>
    value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
  return [address.unitHouseNo, address.street, address.barangay, address.city, address.province]
    .filter(hasValue)
    .map(collapseWhitespace)
    .join(", ");
};

const SHORT_TOKEN = /^[A-Za-z0-9-]{1,6}$/;

const sharesWordBoundaryPrefix = (a, b) => {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 4 || shorter === longer) return false;
  if (!longer.startsWith(shorter)) return false;
  // Only a genuine word boundary counts (e.g. "san jose" -> "san jose del
  // monte"); "general trias" -> "general triassic" would fail this check.
  const nextChar = longer[shorter.length];
  return nextChar === " " || nextChar === undefined;
};

export const normalizeAddress = (input) => {
  if (input === null || input === undefined || typeof input !== "string") {
    return { value: "", status: ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN, reasons: [] };
  }

  const original = input;
  const reasons = [];

  // Global punctuation/whitespace pass.
  let cleaned = collapseWhitespace(original)
    .replace(/,\s*,+/g, ",")
    .replace(/\.\s*\.+/g, ".")
    .replace(/^[,\s]+|[,\s]+$/g, "");

  if (!cleaned) {
    return { value: "", status: ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN, reasons: [] };
  }

  if (cleaned !== collapseWhitespace(original).replace(/^[,\s]+|[,\s]+$/g, "")) {
    reasons.push("PUNCTUATION_NORMALIZED");
  } else if (cleaned !== original) {
    reasons.push("WHITESPACE_NORMALIZED");
  }

  let segments = cleaned.split(",").map((s) => collapseWhitespace(s)).filter(Boolean);

  // 1. Duplicate leading house number: "17, 17 St. Mary St." -> "17 St. Mary St."
  if (
    segments.length >= 2 &&
    SHORT_TOKEN.test(segments[0]) &&
    segments[1].toLowerCase().startsWith(`${segments[0].toLowerCase()} `)
  ) {
    segments = segments.slice(1);
    reasons.push("DUPLICATE_LEADING_NUMBER");
  }

  // 2. Adjacent exact-segment dedup (whole-segment equality only): "Molino IV, Molino IV" -> "Molino IV"
  const afterAdjacentDedup = [];
  for (const segment of segments) {
    const prev = afterAdjacentDedup[afterAdjacentDedup.length - 1];
    if (prev && prev.toLowerCase() === segment.toLowerCase()) {
      reasons.push("REPEATED_SEGMENT");
      continue;
    }
    afterAdjacentDedup.push(segment);
  }
  segments = afterAdjacentDedup;

  // 3. Repeated trailing segment-sequence: "City of Bacoor, Cavite, City of Bacoor, Cavite" -> "City of Bacoor, Cavite"
  for (let k = Math.floor(segments.length / 2); k >= 1; k -= 1) {
    if (segments.length < 2 * k) continue;
    const tail = segments.slice(segments.length - k);
    const beforeTail = segments.slice(segments.length - 2 * k, segments.length - k);
    const matches = tail.every((seg, idx) => seg.toLowerCase() === beforeTail[idx].toLowerCase());
    if (matches) {
      segments = segments.slice(0, segments.length - k);
      reasons.push("REPEATED_SEQUENCE");
      break;
    }
  }

  // Ambiguous-similarity detection (never collapsed, only flagged): two
  // adjacent segments share a word-boundary prefix but are not exactly
  // equal, e.g. "San Jose" / "San Jose del Monte".
  let ambiguous = false;
  for (let i = 1; i < segments.length; i += 1) {
    if (
      segments[i].toLowerCase() !== segments[i - 1].toLowerCase() &&
      sharesWordBoundaryPrefix(segments[i].toLowerCase(), segments[i - 1].toLowerCase())
    ) {
      ambiguous = true;
      reasons.push("AMBIGUOUS_PREFIX_SIMILAR_SEGMENTS");
    }
  }

  const value = segments.join(", ");

  let status;
  if (value !== original) {
    status = ADDRESS_NORMALIZE_STATUS.AUTO_FIXED;
  } else if (ambiguous) {
    status = ADDRESS_NORMALIZE_STATUS.UNCHANGED;
  } else {
    status = ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN;
  }

  return { value, status, reasons };
};

// Convenience composition for a Reservation/User-shaped structured address:
// join -> strip region suffix -> normalize.
export const normalizeReservationAddress = (address) =>
  normalizeAddress(stripRegionSuffix(joinAddressParts(address))).value;
