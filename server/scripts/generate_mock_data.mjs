import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONFIG = {
  seed: 20260506,
  rooms: 24,
  tenants: 48,
  applicants: 8,
  reservations: 40,
  billsPerTenant: 2,
  maintenance: 18,
  inquiries: 14,
  utilityPeriods: 8,
  utilityReadingsPerPeriod: 4,
  includeEdgeCases: true,
  output: path.resolve(process.cwd(), "scripts", "mock-data", "mock-data.json"),
};

const ROOM_BRANCHES = ["gil-puyat", "guadalupe"];
const ROOM_TYPES = ["private", "double-sharing", "quadruple-sharing"];
const ROOM_CAPACITY = {
  private: 1,
  "double-sharing": 2,
  "quadruple-sharing": 4,
};
const PAYMENT_METHODS = [
  "bank",
  "gcash",
  "card",
  "check",
  "paymongo",
  "paymaya",
  "grab_pay",
  "maya",
  "online",
];
const MAINTENANCE_REQUEST_TYPES = [
  "maintenance",
  "plumbing",
  "electrical",
  "aircon",
  "cleaning",
  "pest",
  "furniture",
  "other",
];
const MAINTENANCE_STATUSES = [
  "pending",
  "viewed",
  "in_progress",
  "waiting_tenant",
  "resolved",
  "completed",
  "rejected",
  "cancelled",
  "closed",
];
const MAINTENANCE_URGENCY_LEVELS = ["low", "normal", "high"];
const RESERVATION_STATUSES = [
  "pending",
  "visit_pending",
  "visit_approved",
  "payment_pending",
  "reserved",
  "moveIn",
  "moveOut",
  "cancelled",
];
const BILL_STATUSES = ["draft", "pending", "paid", "overdue", "partially-paid"];
const UTILITY_EVENT_TYPES = [
  "periodStart",
  "regularBilling",
  "moveIn",
  "moveOut",
  "periodEnd",
];

const FIRST_NAMES = [
  "Ava",
  "Liam",
  "Noah",
  "Mia",
  "Zoe",
  "Emma",
  "Lucas",
  "Aiden",
  "Ivy",
  "Mila",
  "Kai",
  "Elena",
  "Nico",
  "Sage",
  "Aria",
  "Leo",
  "Theo",
  "Luna",
  "Iris",
  "Jude",
];
const LAST_NAMES = [
  "Santos",
  "Reyes",
  "Cruz",
  "Garcia",
  "Ramos",
  "Torres",
  "Flores",
  "Lopez",
  "Rivera",
  "Mendoza",
  "Navarro",
  "Dizon",
  "Lim",
  "Castillo",
  "Aguirre",
];
const CITY_NAMES = ["Makati", "Taguig", "Mandaluyong", "Pasig", "Manila", "Quezon City"];
const PROVINCES = ["Metro Manila", "Cavite", "Laguna", "Rizal", "Bulacan"];
const OCCUPATIONS = ["Analyst", "Engineer", "Designer", "Student", "Nurse", "Teacher", "Developer"];
const INQUIRY_SUBJECTS = [
  "Room availability",
  "Pricing and rates",
  "Move-in requirements",
  "Payment options",
  "Maintenance follow-up",
  "General inquiry",
];
const INQUIRY_TAGS = [
  "room-inquiry",
  "pricing",
  "availability",
  "amenities",
  "location",
  "booking",
  "complaint",
  "feedback",
  "maintenance",
  "billing",
  "general",
  "urgent",
];

function parseArgs(argv) {
  const config = { ...DEFAULT_CONFIG };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, rawValue] = arg.replace(/^--/, "").split("=");
    const value = rawValue ?? argv[i + 1];
    switch (key) {
      case "out":
        config.output = path.resolve(process.cwd(), value);
        if (!rawValue) i += 1;
        break;
      case "seed":
      case "rooms":
      case "tenants":
      case "applicants":
      case "reservations":
      case "billsPerTenant":
      case "maintenance":
      case "inquiries":
      case "utilityPeriods":
      case "utilityReadingsPerPeriod":
        config[key] = Number(value);
        if (!rawValue) i += 1;
        break;
      case "includeEdgeCases":
        config.includeEdgeCases = value !== "false";
        if (!rawValue) i += 1;
        break;
      default:
        break;
    }
  }
  return config;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    bool(chance = 0.5) {
      return next() < chance;
    },
  };
}

function randomHex(rng, length = 24) {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(rng.next() * chars.length)];
  }
  return out;
}

function makeId(prefix, index, width = 4) {
  return `${prefix}-${String(index).padStart(width, "0")}`;
}

function toIsoDate(value) {
  return new Date(value).toISOString();
}

function randomDateBetween(rng, start, end) {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const delta = endMs - startMs;
  return new Date(startMs + rng.next() * delta);
}

function buildEmail(firstName, lastName, index) {
  const handle = `${firstName}.${lastName}.${index}`.toLowerCase();
  return `${handle}@example.com`;
}

function buildPhone(rng) {
  return `09${rng.int(10, 99)}${rng.int(1000000, 9999999)}`;
}

function createBeds(type, capacity) {
  const positions = type === "private" ? ["single"] : ["upper", "lower"];
  const beds = [];
  for (let i = 0; i < capacity; i += 1) {
    beds.push({
      id: `bed-${i + 1}`,
      position: positions[i % positions.length],
      status: "available",
      lockExpiresAt: null,
      lockedBy: null,
      occupiedBy: {
        userId: null,
        reservationId: null,
        occupiedSince: null,
      },
    });
  }
  return beds;
}

function makeStatusHistory(rng, status, createdAt, actor) {
  const timeline = [];
  timeline.push({
    event: "created",
    status: "pending",
    actor_id: actor?.id ?? null,
    actor_name: actor?.name ?? null,
    actor_role: actor?.role ?? null,
    note: "Request created",
    timestamp: createdAt,
  });
  if (status !== "pending") {
    timeline.push({
      event: "updated",
      status,
      actor_id: actor?.id ?? null,
      actor_name: actor?.name ?? null,
      actor_role: actor?.role ?? null,
      note: rng.bool(0.5) ? "Reviewed by staff" : "Status updated",
      timestamp: new Date(new Date(createdAt).getTime() + rng.int(2, 48) * 60 * 60 * 1000),
    });
  }
  return timeline;
}

function normalizeRoomNumber(branch, index) {
  const prefix = branch === "gil-puyat" ? "GP" : "GD";
  const number = String(100 + index).padStart(3, "0");
  return `${prefix}-${number}`;
}

function buildReservationSummary(rng, tenant, room, status, dates, bed) {
  const billingEmail = rng.bool(0.1) ? `billing+${tenant.email}` : tenant.email;
  return {
    _id: randomHex(rng),
    reservationCode: `RES-${rng.int(100000, 999999)}`,
    visitCode: `VIS-${rng.int(100000, 999999)}`,
    paymentReference: `PAY-${rng.int(100000, 999999)}`,
    userId: tenant._id,
    roomId: room._id,
    currentStayId: null,
    latestStayStatus: "",
    selectedBed: bed ? { id: bed.id, position: bed.position } : undefined,
    targetMoveInDate: dates.moveInDate,
    leaseDuration: rng.pick([1, 3, 6, 12]),
    billingEmail,
    roomConfirmed: status !== "pending",
    viewingType: rng.pick(["inperson", "online"]),
    visitDate: dates.visitDate,
    visitTime: rng.pick(["9:00 AM", "10:30 AM", "1:00 PM", "3:30 PM"]),
    visitScheduledAt: dates.visitScheduledAt,
    isOutOfTown: rng.bool(0.2),
    isOutOfTownApproved: rng.bool(0.5),
    currentLocation: rng.bool(0.4) ? rng.pick(CITY_NAMES) : null,
    scheduleApproved: status !== "visit_pending",
    visitApproved: status === "visit_approved" || status === "payment_pending" || status === "reserved" || status === "moveIn" || status === "moveOut",
    scheduleApprovedAt: status !== "visit_pending" ? dates.visitApprovedAt : null,
    scheduleRejected: false,
    scheduleRejectionReason: null,
    scheduleRejectedAt: null,
    scheduleRejectedBy: null,
    visitHistory: [],
    selfiePhotoUrl: rng.bool(0.4) ? "https://cdn.example.com/mock/selfie.jpg" : "",
    firstName: tenant.firstName,
    lastName: tenant.lastName,
    middleName: rng.bool(0.2) ? "D." : "",
    nickname: rng.bool(0.2) ? tenant.firstName : "",
    mobileNumber: tenant.phone,
    birthday: tenant.dateOfBirth,
    maritalStatus: rng.pick(["single", "married", "divorced", "widowed"]),
    nationality: "Filipino",
    educationLevel: rng.pick(["highschool", "college", "graduate", "other"]),
    address: {
      region: "NCR",
      unitHouseNo: String(rng.int(100, 999)),
      street: `${rng.pick(LAST_NAMES)} St.`,
      barangay: `Brgy ${rng.int(1, 60)}`,
      city: rng.pick(CITY_NAMES),
      province: rng.pick(PROVINCES),
    },
    validIDFrontUrl: "https://cdn.example.com/mock/id-front.jpg",
    validIDBackUrl: "https://cdn.example.com/mock/id-back.jpg",
    validIDType: "national_id",
    idType: "national_id",
    nbiClearanceUrl: rng.bool(0.2) ? "https://cdn.example.com/mock/nbi.jpg" : "",
    nbiReason: rng.bool(0.2) ? "For tenant onboarding" : "",
    companyIDUrl: rng.bool(0.2) ? "https://cdn.example.com/mock/company-id.jpg" : "",
    companyIDReason: rng.bool(0.2) ? "Employer verification" : "",
    personalNotes: rng.bool(0.1) ? "Prefers lower bed." : "",
    emergencyContact: {
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      relationship: rng.pick(["Parent", "Sibling", "Friend"]),
      contactNumber: buildPhone(rng),
    },
    healthConcerns: rng.bool(0.1) ? "Asthma" : "",
    employment: {
      employerSchool: rng.bool(0.6) ? "Lilycrest Partners" : "",
      employerAddress: rng.bool(0.6) ? "Makati" : "",
      employerContact: rng.bool(0.6) ? buildPhone(rng) : "",
      startDate: dates.moveInDate,
      occupation: rng.pick(OCCUPATIONS),
      previousEmployment: rng.bool(0.3) ? "Student" : "",
    },
    preferredRoomType: room.type,
    preferredRoomNumber: room.name,
    referralSource: rng.pick(["facebook", "friend", "google", "walk-in"]),
    referrerName: rng.bool(0.2) ? "Referral Buddy" : "",
    estimatedMoveInTime: rng.pick(["morning", "afternoon", "evening"]),
    workSchedule: rng.pick(["day", "night", "variable", "others"]),
    checkInDate: dates.moveInDate,
    checkOutDate: dates.moveOutDate,
    status,
    paymentStatus: status === "reserved" || status === "moveIn" || status === "moveOut" ? "paid" : "pending",
    isArchived: status === "cancelled",
    archivedAt: status === "cancelled" ? dates.moveOutDate : null,
    createdAt: dates.createdAt,
    updatedAt: dates.updatedAt,
  };
}

function buildBill(rng, tenant, reservation, room, billingMonth, status) {
  const rent = room.monthlyPrice ?? room.price;
  const electricity = Number((rng.int(200, 800) + rng.next()).toFixed(2));
  const water = rng.int(150, 450);
  const penalty = status === "overdue" ? rng.int(50, 200) : 0;
  const discount = rng.bool(0.15) ? rng.int(100, 300) : 0;
  const total = Math.max(0, rent + electricity + water + penalty - discount);

  const paidAmount = status === "paid" ? total : status === "partially-paid" ? Number((total * 0.5).toFixed(2)) : 0;
  const remainingAmount = Number((total - paidAmount).toFixed(2));

  const dueDate = new Date(new Date(billingMonth).getTime() + 10 * 24 * 60 * 60 * 1000);
  const paymentDate = status === "paid" ? new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000) : null;

  return {
    _id: randomHex(rng),
    reservationId: reservation?._id ?? null,
    userId: tenant._id,
    branch: tenant.branch,
    roomBillId: null,
    roomId: room?._id ?? null,
    proRataDays: rng.bool(0.2) ? rng.int(10, 25) : null,
    additionalCharges: rng.bool(0.2) ? [{ name: "Appliance Fee", amount: 150 }] : [],
    billingMonth,
    dueDate,
    billingCycleStart: new Date(new Date(billingMonth).getTime() - 30 * 24 * 60 * 60 * 1000),
    billingCycleEnd: billingMonth,
    utilityCycleStart: new Date(new Date(billingMonth).getTime() - 30 * 24 * 60 * 60 * 1000),
    utilityCycleEnd: billingMonth,
    utilityReadingDate: new Date(new Date(billingMonth).getTime() - 2 * 24 * 60 * 60 * 1000),
    isFirstCycleBill: rng.bool(0.2),
    charges: {
      rent,
      electricity,
      water,
      applianceFees: 0,
      corkageFees: 0,
      penalty,
      discount,
    },
    totalAmount: total,
    grossAmount: total + discount,
    reservationCreditApplied: 0,
    remainingAmount,
    status,
    paidAmount,
    paymentDate,
    paymentMethod: status === "paid" || status === "partially-paid" ? rng.pick(PAYMENT_METHODS) : null,
    paymongoSessionId: status === "paid" ? `pm_sess_${rng.int(100000, 999999)}` : null,
    paymongoPaymentId: status === "paid" ? `pm_pay_${rng.int(100000, 999999)}` : null,
    notes: rng.bool(0.1) ? "Discount applied" : "",
    isManuallyAdjusted: rng.bool(0.1),
    sentAt: new Date(new Date(billingMonth).getTime() - 1 * 24 * 60 * 60 * 1000),
    issuedAt: new Date(new Date(billingMonth).getTime() - 2 * 24 * 60 * 60 * 1000),
    utilityDispatch: {
      electricity: {
        state: "sent",
        periodId: null,
        publishedAt: new Date(new Date(billingMonth).getTime() - 2 * 24 * 60 * 60 * 1000),
        issuedAt: new Date(new Date(billingMonth).getTime() - 2 * 24 * 60 * 60 * 1000),
        dueDate,
        amount: electricity,
      },
      water: {
        state: "sent",
        periodId: null,
        publishedAt: new Date(new Date(billingMonth).getTime() - 2 * 24 * 60 * 60 * 1000),
        issuedAt: new Date(new Date(billingMonth).getTime() - 2 * 24 * 60 * 60 * 1000),
        dueDate,
        amount: water,
      },
    },
    delivery: {
      email: {
        status: "sent",
        sentAt: new Date(new Date(billingMonth).getTime() - 1 * 24 * 60 * 60 * 1000),
        error: "",
      },
      notification: {
        status: rng.bool(0.7) ? "sent" : "not_attempted",
        sentAt: rng.bool(0.7)
          ? new Date(new Date(billingMonth).getTime() - 1 * 24 * 60 * 60 * 1000)
          : null,
        error: "",
      },
    },
    isArchived: false,
    createdAt: new Date(new Date(billingMonth).getTime() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(new Date(billingMonth).getTime() - 1 * 24 * 60 * 60 * 1000),
  };
}

function buildPayment(rng, tenant, bill, amount, status) {
  return {
    _id: randomHex(rng),
    paymentId: `PAY-${rng.int(100000, 999999)}`,
    tenantId: tenant._id,
    billId: bill._id,
    amount,
    method: bill.paymentMethod ?? rng.pick(PAYMENT_METHODS),
    source: rng.pick(["admin-manual", "tenant-proof", "paymongo-webhook"]),
    referenceNumber: `REF-${rng.int(100000, 999999)}`,
    externalPaymentId: status === "paid" ? `ext_${rng.int(100000, 999999)}` : null,
    processedAt: new Date(),
    metadata: {},
    proofImageUrl: rng.bool(0.3) ? "https://cdn.example.com/mock/proof.jpg" : null,
    status,
    verifiedBy: null,
    verifiedAt: null,
    rejectionReason: status === "rejected" ? "Mismatch in amount" : null,
    branch: tenant.branch,
    notes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function buildMaintenanceRequest(rng, tenant, room, admin) {
  const status = rng.pick(MAINTENANCE_STATUSES);
  const createdAt = randomDateBetween(rng, "2026-02-01", "2026-05-05");
  const actor = admin
    ? { id: admin._id, name: `${admin.firstName} ${admin.lastName}`, role: admin.role }
    : null;

  return {
    _id: randomHex(rng),
    request_id: `maint_${randomHex(rng, 12)}`,
    user_id: tenant.user_id,
    request_type: rng.pick(MAINTENANCE_REQUEST_TYPES),
    description: rng.pick([
      "Aircon is not cooling properly.",
      "Leaking faucet in the bathroom.",
      "Light switch sparks when used.",
      "Need help with cabinet hinges.",
      "Room smells damp after rain.",
    ]),
    urgency: rng.pick(MAINTENANCE_URGENCY_LEVELS),
    status,
    assigned_to: rng.bool(0.5) ? actor?.name ?? null : null,
    notes: rng.bool(0.3) ? "Tenant requested follow-up." : null,
    attachments: rng.bool(0.3)
      ? [{ name: "photo.jpg", uri: "https://cdn.example.com/mock/maintenance.jpg", type: "image/jpeg" }]
      : [],
    reopen_note: rng.bool(0.1) ? "Issue reoccurred." : null,
    reopen_history: [],
    statusHistory: makeStatusHistory(rng, status, createdAt, actor),
    cancelled_at: status === "cancelled" ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
    reopened_at: null,
    assigned_at: status === "in_progress" ? new Date(createdAt.getTime() + 4 * 60 * 60 * 1000) : null,
    work_started_at: status === "in_progress" ? new Date(createdAt.getTime() + 6 * 60 * 60 * 1000) : null,
    closed_at: status === "completed" || status === "closed" ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
    resolution_note: status === "resolved" || status === "completed" ? "Issue fixed." : null,
    work_log: status === "in_progress"
      ? [{ note: "Initial inspection done.", actor_id: actor?.id ?? null, actor_name: actor?.name ?? null, actor_role: actor?.role ?? null, logged_at: new Date(createdAt.getTime() + 5 * 60 * 60 * 1000) }]
      : [],
    resolved_at: status === "resolved" || status === "completed" ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
    branch: tenant.branch,
    userId: tenant._id,
    reservationId: tenant.latestReservationId ?? null,
    roomId: room?._id ?? null,
    isArchived: false,
    createdAt,
    updatedAt: new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000),
  };
}

function buildInquiry(rng) {
  const subject = rng.pick(INQUIRY_SUBJECTS);
  const createdAt = randomDateBetween(rng, "2026-03-01", "2026-05-05");
  const priority = rng.pick(["low", "medium", "high", "urgent"]);
  const tags = Array.from(new Set([rng.pick(INQUIRY_TAGS), rng.pick(INQUIRY_TAGS)]));

  return {
    _id: randomHex(rng),
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    email: buildEmail(rng.pick(FIRST_NAMES), rng.pick(LAST_NAMES), rng.int(1, 99)),
    phone: rng.bool(0.6) ? buildPhone(rng) : "",
    subject,
    message: `${subject} - I would like more details about the dorm.`,
    branch: rng.pick([...ROOM_BRANCHES, "general"]),
    status: rng.pick(["pending", "in-progress", "resolved", "closed"]),
    priority,
    tags,
    response: rng.bool(0.3) ? "Thanks for reaching out. We'll follow up shortly." : "",
    respondedBy: null,
    respondedAt: rng.bool(0.3) ? new Date(createdAt.getTime() + 1 * 24 * 60 * 60 * 1000) : null,
    isRead: rng.bool(0.6),
    isArchived: false,
    archivedAt: null,
    archivedBy: null,
    createdAt,
    updatedAt: new Date(createdAt.getTime() + 6 * 60 * 60 * 1000),
  };
}

function buildUtilityPeriod(rng, room, utilityType, admin) {
  const startDate = randomDateBetween(rng, "2026-03-15", "2026-04-01");
  const endDate = new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000);
  const startReading = rng.int(800, 1400);
  const endReading = startReading + rng.int(80, 220);

  return {
    _id: randomHex(rng),
    utilityType,
    roomId: room._id,
    branch: room.branch,
    startDate,
    endDate,
    startReading,
    endReading,
    ratePerUnit: Number((rng.int(14, 19) + rng.next()).toFixed(2)),
    computedTotalUsage: endReading - startReading,
    computedTotalCost: Number(((endReading - startReading) * 16).toFixed(2)),
    verified: true,
    segments: [],
    tenantSummaries: [],
    status: "closed",
    closedAt: endDate,
    closedBy: admin?._id ?? null,
    revised: false,
    revisionNote: null,
    revisedAt: null,
    isArchived: false,
    createdAt: new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: endDate,
  };
}

function buildUtilityReading(rng, period, admin, eventType, date, reading, tenantId, activeTenantIds) {
  return {
    _id: randomHex(rng),
    utilityType: period.utilityType,
    roomId: period.roomId,
    branch: period.branch,
    reading,
    date,
    eventType,
    readingStatus: "recorded",
    tenantId,
    activeTenantIds,
    recordedBy: admin?._id ?? null,
    utilityPeriodId: period._id,
    isArchived: false,
    createdAt: date,
    updatedAt: date,
  };
}

function buildBillingPeriod(rng, room, admin) {
  const startDate = randomDateBetween(rng, "2026-03-15", "2026-04-01");
  const endDate = new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000);
  const startReading = rng.int(900, 1500);
  const endReading = startReading + rng.int(90, 200);

  return {
    _id: randomHex(rng),
    roomId: room._id,
    branch: room.branch,
    startDate,
    endDate,
    startReading,
    endReading,
    ratePerKwh: Number((rng.int(14, 18) + rng.next()).toFixed(2)),
    status: "closed",
    closedAt: endDate,
    closedBy: admin?._id ?? null,
    revised: false,
    revisionNote: null,
    revisedAt: null,
    isArchived: false,
    createdAt: new Date(startDate.getTime() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: endDate,
  };
}

function buildMeterReading(rng, period, admin, eventType, date, reading, tenantId, activeTenantIds) {
  return {
    _id: randomHex(rng),
    roomId: period.roomId,
    branch: period.branch,
    reading,
    date,
    eventType,
    tenantId,
    activeTenantIds,
    recordedBy: admin?._id ?? null,
    billingPeriodId: period._id,
    isArchived: false,
    createdAt: date,
    updatedAt: date,
  };
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const rng = createRng(config.seed);

  const users = [];
  const rooms = [];
  const reservations = [];
  const bills = [];
  const payments = [];
  const maintenanceRequests = [];
  const inquiries = [];
  const utilityPeriods = [];
  const utilityReadings = [];
  const billingPeriods = [];
  const meterReadings = [];

  // Admin users
  const owner = {
    _id: randomHex(rng),
    firebaseUid: `mock-owner-${rng.int(1000, 9999)}`,
    email: "owner@lilycrest.test",
    username: "owner",
    user_id: makeId("USER", 1),
    firstName: "System",
    lastName: "Owner",
    phone: buildPhone(rng),
    profileImage: "",
    gender: "",
    civilStatus: "",
    nationality: "Filipino",
    occupation: "Owner",
    address: "",
    city: "Makati",
    province: "Metro Manila",
    zipCode: "1200",
    dateOfBirth: new Date("1985-01-15"),
    emergencyContact: "",
    emergencyPhone: "",
    emergencyRelationship: "",
    studentId: "",
    school: "",
    yearLevel: "",
    branch: "gil-puyat",
    role: "owner",
    tenantStatus: "applicant",
    permissions: [],
    accountStatus: "active",
    statusChangedAt: null,
    statusChangedBy: null,
    statusReason: null,
    isActive: true,
    isEmailVerified: true,
    isArchived: false,
    archivedAt: null,
    archivedBy: null,
    createdAt: new Date("2025-11-15"),
    updatedAt: new Date("2026-05-01"),
  };
  users.push(owner);

  ROOM_BRANCHES.forEach((branch, index) => {
    users.push({
      _id: randomHex(rng),
      firebaseUid: `mock-admin-${branch}-${rng.int(1000, 9999)}`,
      email: `admin.${branch}@lilycrest.test`,
      username: `admin_${branch}`,
      user_id: makeId("USER", index + 2),
      firstName: "Branch",
      lastName: branch === "gil-puyat" ? "Admin" : "Lead",
      phone: buildPhone(rng),
      profileImage: "",
      gender: "",
      civilStatus: "",
      nationality: "Filipino",
      occupation: "Branch Admin",
      address: "",
      city: "Makati",
      province: "Metro Manila",
      zipCode: "1200",
      dateOfBirth: new Date("1990-06-12"),
      emergencyContact: "",
      emergencyPhone: "",
      emergencyRelationship: "",
      studentId: "",
      school: "",
      yearLevel: "",
      branch,
      role: "branch_admin",
      tenantStatus: "applicant",
      permissions: [],
      accountStatus: "active",
      statusChangedAt: null,
      statusChangedBy: null,
      statusReason: null,
      isActive: true,
      isEmailVerified: true,
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date("2025-11-18"),
      updatedAt: new Date("2026-05-01"),
    });
  });

  // Rooms
  for (let i = 0; i < config.rooms; i += 1) {
    const branch = ROOM_BRANCHES[i % ROOM_BRANCHES.length];
    const type = rng.pick(ROOM_TYPES);
    const capacity = ROOM_CAPACITY[type];
    const roomNumber = normalizeRoomNumber(branch, i + 1);

    rooms.push({
      _id: randomHex(rng),
      name: `${branch === "gil-puyat" ? "GP" : "GD"} - Room ${roomNumber.split("-")[1]}`,
      roomNumber,
      description: rng.bool(0.15) ? "Private Premium" : "",
      floor: rng.int(1, 10),
      branch,
      type,
      capacity,
      currentOccupancy: 0,
      price: type === "private" ? 14000 : type === "double-sharing" ? 8000 : 6300,
      monthlyPrice: type === "private" ? 13000 : type === "double-sharing" ? 7200 : 5400,
      amenities: ["Air Conditioning", "WiFi", "Cabinet", "Double Decker Bed"],
      policies: ["No smoking", "Keep noise down after 10PM"],
      intendedTenant: "",
      images: [],
      beds: createBeds(type, capacity),
      available: true,
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      createdAt: new Date("2025-10-01"),
      updatedAt: new Date("2026-05-01"),
    });
  }

  // Applicants and tenants
  const totalUsers = config.tenants + config.applicants;
  for (let i = 0; i < totalUsers; i += 1) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const isApplicant = i < config.applicants;
    const branch = isApplicant ? "" : rng.pick(ROOM_BRANCHES);
    const tenantStatus = isApplicant ? "applicant" : rng.pick(["active", "inactive", "moved_out"]);

    users.push({
      _id: randomHex(rng),
      firebaseUid: `mock-${i + 100}-${rng.int(1000, 9999)}`,
      email: buildEmail(firstName, lastName, i + 1),
      username: `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${i + 1}`,
      user_id: makeId("USER", i + 4),
      firstName,
      lastName,
      phone: buildPhone(rng),
      profileImage: "",
      gender: rng.pick(["male", "female", "other", "prefer-not-to-say", ""]),
      civilStatus: rng.pick(["single", "married", "", "divorced"]),
      nationality: "Filipino",
      occupation: rng.pick(OCCUPATIONS),
      address: `${rng.int(100, 999)} ${rng.pick(LAST_NAMES)} St.`,
      city: rng.pick(CITY_NAMES),
      province: rng.pick(PROVINCES),
      zipCode: String(rng.int(1000, 1899)),
      dateOfBirth: randomDateBetween(rng, "1985-01-01", "2004-12-31"),
      emergencyContact: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
      emergencyPhone: buildPhone(rng),
      emergencyRelationship: rng.pick(["Parent", "Sibling", "Friend"]),
      studentId: "",
      school: rng.bool(0.2) ? "Local University" : "",
      yearLevel: rng.bool(0.2) ? "3" : "",
      branch,
      role: isApplicant ? "applicant" : "tenant",
      tenantStatus,
      permissions: [],
      accountStatus: rng.bool(0.05) ? "suspended" : "active",
      statusChangedAt: null,
      statusChangedBy: null,
      statusReason: null,
      isActive: true,
      isEmailVerified: rng.bool(0.85),
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      createdAt: randomDateBetween(rng, "2025-09-01", "2026-04-15"),
      updatedAt: randomDateBetween(rng, "2026-04-16", "2026-05-05"),
    });
  }

  if (config.includeEdgeCases) {
    users.push({
      _id: randomHex(rng),
      firebaseUid: `mock-archived-${rng.int(1000, 9999)}`,
      email: "archived.user@example.com",
      username: "archived_user",
      user_id: makeId("USER", 9999),
      firstName: "Archived",
      lastName: "User",
      phone: buildPhone(rng),
      profileImage: "",
      gender: "",
      civilStatus: "",
      nationality: "Filipino",
      occupation: "",
      address: "",
      city: "Makati",
      province: "Metro Manila",
      zipCode: "1200",
      dateOfBirth: new Date("1992-02-02"),
      emergencyContact: "",
      emergencyPhone: "",
      emergencyRelationship: "",
      studentId: "",
      school: "",
      yearLevel: "",
      branch: "gil-puyat",
      role: "tenant",
      tenantStatus: "blacklisted",
      permissions: [],
      accountStatus: "banned",
      statusChangedAt: new Date("2026-02-10"),
      statusChangedBy: owner._id,
      statusReason: "Policy violation",
      isActive: false,
      isEmailVerified: false,
      isArchived: true,
      archivedAt: new Date("2026-02-10"),
      archivedBy: owner._id,
      createdAt: new Date("2025-05-10"),
      updatedAt: new Date("2026-02-10"),
    });
  }

  const tenants = users.filter((user) => user.role === "tenant");
  const admins = users.filter((user) => user.role === "branch_admin");

  // Reservations with bed assignments
  const availableBeds = new Map();
  for (const room of rooms) {
    availableBeds.set(room._id, room.beds.map((bed) => ({ ...bed })));
  }

  for (let i = 0; i < Math.min(config.reservations, tenants.length); i += 1) {
    const tenant = tenants[i];
    const status = rng.pick(RESERVATION_STATUSES);
    const room = rng.pick(rooms.filter((r) => r.branch === tenant.branch));
    const bedList = availableBeds.get(room._id) || [];
    const bedIndex = bedList.findIndex((bed) => bed.status === "available");
    const bed = bedIndex >= 0 && (status === "reserved" || status === "moveIn" || status === "moveOut")
      ? bedList[bedIndex]
      : null;

    const createdAt = randomDateBetween(rng, "2026-01-01", "2026-04-15");
    const moveInDate = randomDateBetween(rng, "2026-02-01", "2026-04-10");
    const moveOutDate = status === "moveOut" ? new Date(new Date(moveInDate).getTime() + 40 * 24 * 60 * 60 * 1000) : null;

    if (bed) {
      bed.status = status === "reserved" ? "reserved" : "occupied";
      bed.occupiedBy = {
        userId: tenant._id,
        reservationId: null,
        occupiedSince: moveInDate,
      };
    }

    const reservation = buildReservationSummary(
      rng,
      tenant,
      room,
      status,
      {
        createdAt,
        updatedAt: new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000),
        moveInDate,
        moveOutDate,
        visitDate: randomDateBetween(rng, "2026-01-01", "2026-02-15"),
        visitScheduledAt: randomDateBetween(rng, "2026-01-01", "2026-02-15"),
        visitApprovedAt: randomDateBetween(rng, "2026-01-10", "2026-02-20"),
      },
      bed,
    );

    if (bed) {
      bed.occupiedBy.reservationId = reservation._id;
    }

    reservations.push(reservation);
    tenant.latestReservationId = reservation._id;
  }

  // Update rooms with assigned beds and occupancy
  for (const room of rooms) {
    const beds = availableBeds.get(room._id) || room.beds;
    room.beds = beds;
    room.currentOccupancy = beds.filter((bed) => bed.status === "occupied").length;
    room.available = room.currentOccupancy < room.capacity;
    room.updatedAt = new Date();
  }

  // Bills and payments
  const billedTenants = tenants.filter((tenant) => tenant.latestReservationId);
  for (const tenant of billedTenants) {
    const reservation = reservations.find((res) => res._id === tenant.latestReservationId);
    const room = rooms.find((r) => r._id === reservation.roomId);
    for (let i = 0; i < config.billsPerTenant; i += 1) {
      const billingMonth = new Date(`2026-${String(3 + i).padStart(2, "0")}-01T00:00:00.000Z`);
      const status = rng.pick(BILL_STATUSES);
      const bill = buildBill(rng, tenant, reservation, room, billingMonth, status);
      bills.push(bill);

      if (bill.status === "paid" || bill.status === "partially-paid") {
        const paymentCount = bill.status === "paid" ? 1 : 2;
        let remaining = bill.paidAmount;
        for (let p = 0; p < paymentCount; p += 1) {
          const amount = p === paymentCount - 1 ? remaining : Number((remaining / paymentCount).toFixed(2));
          remaining = Number((remaining - amount).toFixed(2));
          payments.push(buildPayment(rng, tenant, bill, amount, bill.status === "paid" ? "paid" : "approved"));
        }
      }
    }
  }

  // Maintenance requests
  for (let i = 0; i < config.maintenance; i += 1) {
    const tenant = rng.pick(billedTenants);
    const room = rooms.find((r) => r.branch === tenant.branch) || rooms[0];
    const admin = admins.find((a) => a.branch === tenant.branch) || owner;
    maintenanceRequests.push(buildMaintenanceRequest(rng, tenant, room, admin));
  }

  // Inquiries
  for (let i = 0; i < config.inquiries; i += 1) {
    inquiries.push(buildInquiry(rng));
  }

  // Utility periods, readings, billing periods, meter readings
  const utilityRooms = rooms.slice(0, Math.min(config.utilityPeriods, rooms.length));
  for (const room of utilityRooms) {
    const admin = admins.find((a) => a.branch === room.branch) || owner;
    const electricityPeriod = buildUtilityPeriod(rng, room, "electricity", admin);
    utilityPeriods.push(electricityPeriod);

    const activeTenantIds = reservations
      .filter((reservation) => reservation.roomId === room._id)
      .map((reservation) => reservation.userId);

    const startDate = electricityPeriod.startDate;
    const endDate = electricityPeriod.endDate;
    const stepDays = Math.max(1, Math.floor(30 / config.utilityReadingsPerPeriod));
    let readingValue = electricityPeriod.startReading;

    for (let i = 0; i < config.utilityReadingsPerPeriod; i += 1) {
      const date = new Date(new Date(startDate).getTime() + i * stepDays * 24 * 60 * 60 * 1000);
      const eventType = UTILITY_EVENT_TYPES[i % UTILITY_EVENT_TYPES.length];
      readingValue += rng.int(10, 40);
      utilityReadings.push(
        buildUtilityReading(
          rng,
          electricityPeriod,
          admin,
          eventType,
          date,
          readingValue,
          activeTenantIds[i % Math.max(activeTenantIds.length, 1)] ?? null,
          activeTenantIds,
        ),
      );
    }

    const billingPeriod = buildBillingPeriod(rng, room, admin);
    billingPeriods.push(billingPeriod);
    const meterReadingDate = new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    meterReadings.push(
      buildMeterReading(
        rng,
        billingPeriod,
        admin,
        "regularBilling",
        meterReadingDate,
        billingPeriod.startReading + rng.int(10, 40),
        activeTenantIds[0] ?? null,
        activeTenantIds,
      ),
    );
    meterReadings.push(
      buildMeterReading(
        rng,
        billingPeriod,
        admin,
        "periodEnd",
        endDate,
        billingPeriod.endReading,
        activeTenantIds[0] ?? null,
        activeTenantIds,
      ),
    );
  }

  const output = {
    generatedAt: toIsoDate(new Date()),
    config: {
      ...config,
      output: path.relative(process.cwd(), config.output),
    },
    collections: {
      users,
      rooms,
      reservations,
      bills,
      payments,
      maintenanceRequests,
      inquiries,
      utilityPeriods,
      utilityReadings,
      billingPeriods,
      meterReadings,
    },
  };

  await fs.mkdir(path.dirname(config.output), { recursive: true });
  await fs.writeFile(config.output, JSON.stringify(output, null, 2));

  const summary = [
    `Users: ${users.length}`,
    `Rooms: ${rooms.length}`,
    `Reservations: ${reservations.length}`,
    `Bills: ${bills.length}`,
    `Payments: ${payments.length}`,
    `Maintenance: ${maintenanceRequests.length}`,
    `Inquiries: ${inquiries.length}`,
    `Utility periods: ${utilityPeriods.length}`,
    `Utility readings: ${utilityReadings.length}`,
    `Billing periods: ${billingPeriods.length}`,
    `Meter readings: ${meterReadings.length}`,
  ].join("\n");

  console.log(`Mock data written to ${config.output}`);
  console.log(summary);
}

main().catch((error) => {
  console.error("Mock data generation failed:", error);
  process.exit(1);
});
