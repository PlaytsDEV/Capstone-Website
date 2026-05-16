/**
 * Seed analytics-friendly demo data for trends and AI insights.
 *
 * What it does:
 * - Removes the previous analytics seed dataset created by this script.
 * - Creates deterministic seed tenants and applicants.
 * - Seeds historical and current reservations across both branches.
 * - Seeds 6 months of billing activity with paid, partial, pending, and overdue states.
 * - Seeds inquiry and maintenance activity so operations reports have real signal.
 *
 * Safe to re-run:
 * - This script only deletes records created with the `seed.analytics.*` namespace.
 * - Rooms are not created or deleted here. Run `seed_rooms.mjs` first if needed.
 *
 * Usage:
 *   node scripts/seed_analytics_demo.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import dayjs from "dayjs";

import {
  Bill,
  Inquiry,
  MaintenanceRequest,
  Reservation,
  Room,
  User,
} from "../models/index.js";
import { MAINTENANCE_REQUEST_TYPES } from "../config/maintenance.js";
import { ACTIVE_OCCUPANCY_STATUS_QUERY } from "../utils/lifecycleNaming.js";
import { recalculateRoomOccupancy } from "../utils/occupancyManager.js";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest-dormitory";
const SEED_EMAIL_PREFIX = "seed.analytics.";
const SEED_EMAIL_REGEX = /^seed\.analytics\./i;
const SEED_BILL_MARKER = "[analytics-seed-v1]";
const SEED_MAINTENANCE_PREFIX = "maint_seedanalytics_";
const SEED_BILL_REGEX = /\[analytics-seed-v1\]/i;
const ROOM_LIMITS = Object.freeze({
  "gil-puyat": 16,
  guadalupe: 10,
});
const RESERVED_EMPTY_ROOMS = Object.freeze({
  "gil-puyat": 15,
  guadalupe: 10,
});

const PERSONAS = Object.freeze([
  {
    firstName: "Aira",
    lastName: "Santos",
    occupation: "College Student",
    employerSchool: "Mapua University",
    educationLevel: "college",
    workSchedule: "day",
    referralSource: "facebook",
    age: 20,
    city: "Makati",
    province: "Metro Manila",
    nationality: "Filipino",
  },
  {
    firstName: "Jules",
    lastName: "Reyes",
    occupation: "Architecture Student",
    employerSchool: "FEU Institute of Technology",
    educationLevel: "college",
    workSchedule: "day",
    referralSource: "google",
    age: 22,
    city: "Pasay",
    province: "Metro Manila",
    nationality: "Filipino",
  },
  {
    firstName: "Mika",
    lastName: "Torres",
    occupation: "Call Center Agent",
    employerSchool: "Concentrix Makati",
    educationLevel: "college",
    workSchedule: "night",
    referralSource: "tiktok",
    age: 24,
    city: "Taguig",
    province: "Metro Manila",
    nationality: "Filipino",
  },
  {
    firstName: "Paolo",
    lastName: "Garcia",
    occupation: "Accounting Staff",
    employerSchool: "Ayala Corp",
    educationLevel: "college",
    workSchedule: "day",
    referralSource: "referral",
    age: 27,
    city: "Mandaluyong",
    province: "Metro Manila",
    nationality: "Filipino",
  },
  {
    firstName: "Trish",
    lastName: "Velasco",
    occupation: "Nursing Student",
    employerSchool: "Centro Escolar University",
    educationLevel: "college",
    workSchedule: "day",
    referralSource: "facebook",
    age: 21,
    city: "Manila",
    province: "Metro Manila",
    nationality: "Filipino",
  },
  {
    firstName: "Ken",
    lastName: "Dizon",
    occupation: "Graphic Designer",
    employerSchool: "Freelance Studio",
    educationLevel: "college",
    workSchedule: "variable",
    referralSource: "google",
    age: 29,
    city: "Pasig",
    province: "Metro Manila",
    nationality: "Filipino",
  },
  {
    firstName: "Yna",
    lastName: "Lopez",
    occupation: "Pharmacy Intern",
    employerSchool: "University of the East",
    educationLevel: "college",
    workSchedule: "day",
    referralSource: "walk_in",
    age: 23,
    city: "Quezon City",
    province: "Metro Manila",
    nationality: "Filipino",
  },
  {
    firstName: "Marco",
    lastName: "Fernandez",
    occupation: "Restaurant Supervisor",
    employerSchool: "Glorietta Food Hall",
    educationLevel: "college",
    workSchedule: "night",
    referralSource: "referral",
    age: 31,
    city: "Paranaque",
    province: "Metro Manila",
    nationality: "Filipino",
  },
]);

const INQUIRY_TOPICS = Object.freeze([
  { subject: "Room availability for next month", tags: ["availability", "booking"] },
  { subject: "How much is the monthly rate?", tags: ["pricing", "room-inquiry"] },
  { subject: "Do you allow night-shift tenants?", tags: ["general", "amenities"] },
  { subject: "Need help with billing details", tags: ["billing", "urgent"] },
  { subject: "Can I schedule a site visit?", tags: ["booking", "general"] },
]);

const MAINTENANCE_DESCRIPTIONS = Object.freeze([
  "Aircon is not cooling consistently during the evening shift.",
  "Bathroom faucet keeps dripping and the sink area stays wet.",
  "Ceiling light flickers after a few minutes of use.",
  "Upper bunk frame is loose and needs tightening.",
  "Drain near the shower is slow and starts to pool water.",
  "Common hallway outlet smells like it is overheating.",
]);

const line = (char = "=") => char.repeat(72);
const ok = (message) => console.log(`  OK   ${message}`);
const info = (message) => console.log(`  INFO ${message}`);

function getMongoConnectOptions() {
  return process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};
}

function makeSeedId(prefix, index) {
  return `${prefix}_${String(index).padStart(4, "0")}`;
}

function makeSeedEmail(kind, branch, index) {
  return `${SEED_EMAIL_PREFIX}${kind}.${branch}.${String(index).padStart(4, "0")}@example.com`;
}

function buildFirebaseUid(email) {
  return `seed-${email.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function buildPhone(index) {
  return `09${String(100000000 + index).slice(-9)}`;
}

function buildBirthday(age) {
  return dayjs().subtract(age, "year").month(5).date(15).toDate();
}

function choosePersona(index) {
  return PERSONAS[index % PERSONAS.length];
}

function compareRoomNumbers(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortRooms(rooms) {
  return [...rooms].sort(
    (left, right) =>
      String(left.branch || "").localeCompare(String(right.branch || "")) ||
      Number(left.floor || 0) - Number(right.floor || 0) ||
      compareRoomNumbers(left.roomNumber, right.roomNumber),
  );
}

function buildTenantUserDoc({
  seedIndex,
  branch,
  persona,
  createdAt,
  tenantStatus,
}) {
  const email = makeSeedEmail("tenant", branch, seedIndex);
  return {
    _id: new mongoose.Types.ObjectId(),
    firebaseUid: buildFirebaseUid(email),
    email,
    username: `seed_analytics_tenant_${branch.replace(/-/g, "_")}_${String(seedIndex).padStart(4, "0")}`,
    user_id: makeSeedId("seed_analytics_tenant", seedIndex),
    firstName: persona.firstName,
    lastName: `${persona.lastName}${seedIndex}`,
    phone: buildPhone(seedIndex),
    occupation: persona.occupation,
    nationality: persona.nationality,
    address: `${persona.city}, ${persona.province}`,
    city: persona.city,
    province: persona.province,
    dateOfBirth: buildBirthday(persona.age),
    branch,
    role: "tenant",
    tenantStatus,
    permissions: [],
    accountStatus: "active",
    isActive: true,
    isEmailVerified: true,
    isArchived: false,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildApplicantUserDoc({ seedIndex, branch, persona, createdAt }) {
  const email = makeSeedEmail("applicant", branch, seedIndex);
  return {
    _id: new mongoose.Types.ObjectId(),
    firebaseUid: buildFirebaseUid(email),
    email,
    username: `seed_analytics_applicant_${branch.replace(/-/g, "_")}_${String(seedIndex).padStart(4, "0")}`,
    user_id: makeSeedId("seed_analytics_applicant", seedIndex),
    firstName: persona.firstName,
    lastName: `${persona.lastName}${seedIndex}`,
    phone: buildPhone(seedIndex + 7000),
    occupation: persona.occupation,
    nationality: persona.nationality,
    address: `${persona.city}, ${persona.province}`,
    city: persona.city,
    province: persona.province,
    dateOfBirth: buildBirthday(persona.age),
    branch,
    role: "applicant",
    tenantStatus: "applicant",
    permissions: [],
    accountStatus: "active",
    isActive: true,
    isEmailVerified: true,
    isArchived: false,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildReservationDoc({
  user,
  room,
  bed = null,
  createdAt,
  moveInDate,
  moveOutDate = null,
  status,
  leaseDuration,
  persona,
}) {
  const isConfirmed = ["reserved", "moveIn", "moveOut"].includes(status);
  const isApplicantPipeline = !isConfirmed && status !== "cancelled";

  return {
    _id: new mongoose.Types.ObjectId(),
    userId: user._id,
    roomId: room._id,
    selectedBed: bed
      ? {
          id: bed.id,
          position: bed.position || "single",
        }
      : undefined,
    targetMoveInDate: moveInDate,
    leaseDuration,
    billingEmail: user.email,
    roomConfirmed: isConfirmed,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: "",
    nickname: user.firstName,
    mobileNumber: user.phone,
    birthday: buildBirthday(persona.age),
    maritalStatus: "single",
    nationality: persona.nationality,
    educationLevel: persona.educationLevel,
    address: {
      region: "NCR",
      unitHouseNo: "12",
      street: "Seed Street",
      barangay: "Bel-Air",
      city: persona.city,
      province: persona.province,
    },
    emergencyContact: {
      name: "Maria Seed",
      relationship: "Parent",
      contactNumber: "09171234567",
    },
    employment: {
      employerSchool: persona.employerSchool,
      employerAddress: `${persona.city}, ${persona.province}`,
      employerContact: "09175551234",
      startDate: moveInDate,
      occupation: persona.occupation,
      previousEmployment: "",
    },
    preferredRoomType: room.type,
    preferredRoomNumber: room.name || room.roomNumber,
    referralSource: persona.referralSource,
    estimatedMoveInTime: "morning",
    workSchedule: persona.workSchedule,
    agreedToPrivacy: true,
    agreedToCertification: true,
    applicationSubmittedAt: createdAt,
    finalMoveInDate: isConfirmed ? moveInDate : null,
    moveInDate,
    checkInDate: moveInDate,
    moveOutDate,
    checkOutDate: moveOutDate,
    totalPrice: Number(room.monthlyPrice || room.price || 0),
    monthlyRent: Number(room.monthlyPrice || room.price || 0),
    reservationFeeAmount: 2000,
    status,
    paymentStatus: isApplicantPipeline || status === "cancelled" ? "pending" : "paid",
    isArchived: false,
    createdAt,
    updatedAt: moveOutDate && dayjs(moveOutDate).isAfter(createdAt)
      ? moveOutDate
      : createdAt,
  };
}

function buildRoomContexts(rooms, activeReservations) {
  const activeCountByRoom = new Map();
  const activeBedIdsByRoom = new Map();

  for (const reservation of activeReservations) {
    const roomId = String(reservation.roomId);
    activeCountByRoom.set(roomId, (activeCountByRoom.get(roomId) || 0) + 1);

    if (reservation.selectedBed?.id) {
      if (!activeBedIdsByRoom.has(roomId)) {
        activeBedIdsByRoom.set(roomId, new Set());
      }
      activeBedIdsByRoom.get(roomId).add(reservation.selectedBed.id);
    }
  }

  return sortRooms(rooms)
    .map((room) => {
      const roomId = String(room._id);
      const blockedBedIds = activeBedIdsByRoom.get(roomId) || new Set();
      const availableBeds = (room.beds || []).filter(
        (bed) =>
          bed?.id &&
          bed.status === "available" &&
          !blockedBedIds.has(bed.id),
      );

      return {
        ...room,
        activeCount: activeCountByRoom.get(roomId) || 0,
        isFullyEmpty:
          (activeCountByRoom.get(roomId) || 0) === 0 &&
          availableBeds.length === (room.beds || []).length,
        availableBeds,
        availableSlots: Math.max(
          0,
          Math.min(
            availableBeds.length,
            Number(room.capacity || 0) - (activeCountByRoom.get(roomId) || 0),
          ),
        ),
      };
    })
    .filter((room) => room.availableSlots > 0);
}

function pickSeedRooms(roomContexts) {
  return Object.entries(ROOM_LIMITS).flatMap(([branch, limit]) => {
    const branchRooms = roomContexts
      .filter((room) => room.branch === branch)
      .sort(
        (left, right) =>
          right.availableSlots - left.availableSlots ||
          compareRoomNumbers(left.roomNumber, right.roomNumber),
      );
    const reserveCount = RESERVED_EMPTY_ROOMS[branch] || 0;
    const fullyEmptyRooms = branchRooms.filter((room) => room.isFullyEmpty);
    const nonEmptyCandidates = branchRooms.filter((room) => !room.isFullyEmpty);

    if (fullyEmptyRooms.length < reserveCount) {
      throw new Error(
        `Branch ${branch} only has ${fullyEmptyRooms.length} fully empty room(s), which is below the required reserve of ${reserveCount}.`,
      );
    }

    const keepEmptyRooms = fullyEmptyRooms
      .sort((left, right) => compareRoomNumbers(left.roomNumber, right.roomNumber))
      .slice(0, reserveCount);
    const keptEmptyRoomIds = new Set(
      keepEmptyRooms.map((room) => String(room._id)),
    );
    const emptyCandidates = fullyEmptyRooms.filter(
      (room) => !keptEmptyRoomIds.has(String(room._id)),
    );

    return [...nonEmptyCandidates, ...emptyCandidates].slice(0, limit);
  });
}

function generateReservationDataset(seedRooms) {
  const userDocs = [];
  const reservationDocs = [];
  const currentTenants = [];
  const billableStays = [];
  const touchedRoomIds = new Set();

  let tenantSeedIndex = 1;
  let applicantSeedIndex = 1;

  for (const [roomIndex, room] of seedRooms.entries()) {
    const desiredCurrentBeds =
      room.type === "quadruple-sharing"
        ? 2 + (roomIndex % 3 === 0 ? 1 : 0)
        : room.type === "double-sharing"
          ? 1 + (roomIndex % 2 === 0 ? 1 : 0)
          : 1;
    const currentBedCount = Math.min(room.availableSlots, desiredCurrentBeds);
    const activeBeds = room.availableBeds.slice(0, currentBedCount);

    for (const [laneIndex, bed] of activeBeds.entries()) {
      const currentPersona = choosePersona(tenantSeedIndex + roomIndex + laneIndex);
      const currentMoveIn = dayjs()
        .subtract(18 + ((tenantSeedIndex * 11) % 95), "day")
        .hour(9)
        .minute(0)
        .second(0)
        .millisecond(0);
      const currentCreatedAt = currentMoveIn.subtract(10 + (tenantSeedIndex % 7), "day");
      const currentMoveOut = currentMoveIn.add(4 + (tenantSeedIndex % 5), "month");

      const currentUser = buildTenantUserDoc({
        seedIndex: tenantSeedIndex,
        branch: room.branch,
        persona: currentPersona,
        createdAt: currentCreatedAt.toDate(),
        tenantStatus: "active",
      });
      const currentReservation = buildReservationDoc({
        user: currentUser,
        room,
        bed,
        createdAt: currentCreatedAt.toDate(),
        moveInDate: currentMoveIn.toDate(),
        moveOutDate: currentMoveOut.toDate(),
        status: "moveIn",
        leaseDuration: 4 + (tenantSeedIndex % 5),
        persona: currentPersona,
      });

      userDocs.push(currentUser);
      reservationDocs.push(currentReservation);
      currentTenants.push({ user: currentUser, reservation: currentReservation, room });
      billableStays.push({
        seedIndex: tenantSeedIndex,
        user: currentUser,
        reservation: currentReservation,
        room,
      });
      touchedRoomIds.add(String(room._id));
      tenantSeedIndex += 1;

      const previousPersona = choosePersona(tenantSeedIndex + roomIndex);
      const previousMoveOut = currentMoveIn.subtract(2, "day");
      const previousMoveIn = previousMoveOut.subtract(
        55 + ((tenantSeedIndex * 5) % 40),
        "day",
      );
      const previousCreatedAt = previousMoveIn.subtract(
        8 + (tenantSeedIndex % 5),
        "day",
      );

      const previousUser = buildTenantUserDoc({
        seedIndex: tenantSeedIndex,
        branch: room.branch,
        persona: previousPersona,
        createdAt: previousCreatedAt.toDate(),
        tenantStatus: "inactive",
      });
      const previousReservation = buildReservationDoc({
        user: previousUser,
        room,
        bed,
        createdAt: previousCreatedAt.toDate(),
        moveInDate: previousMoveIn.toDate(),
        moveOutDate: previousMoveOut.toDate(),
        status: "moveOut",
        leaseDuration: 3 + (tenantSeedIndex % 4),
        persona: previousPersona,
      });

      userDocs.push(previousUser);
      reservationDocs.push(previousReservation);
      billableStays.push({
        seedIndex: tenantSeedIndex,
        user: previousUser,
        reservation: previousReservation,
        room,
      });
      touchedRoomIds.add(String(room._id));
      tenantSeedIndex += 1;

      if ((laneIndex + roomIndex) % 4 === 0) {
        const olderPersona = choosePersona(tenantSeedIndex + laneIndex);
        const olderMoveOut = previousMoveIn.subtract(3, "day");
        const olderMoveIn = olderMoveOut.subtract(
          45 + ((tenantSeedIndex * 3) % 25),
          "day",
        );
        const olderCreatedAt = olderMoveIn.subtract(
          6 + (tenantSeedIndex % 4),
          "day",
        );

        const olderUser = buildTenantUserDoc({
          seedIndex: tenantSeedIndex,
          branch: room.branch,
          persona: olderPersona,
          createdAt: olderCreatedAt.toDate(),
          tenantStatus: "inactive",
        });
        const olderReservation = buildReservationDoc({
          user: olderUser,
          room,
          bed,
          createdAt: olderCreatedAt.toDate(),
          moveInDate: olderMoveIn.toDate(),
          moveOutDate: olderMoveOut.toDate(),
          status: "moveOut",
          leaseDuration: 2 + (tenantSeedIndex % 3),
          persona: olderPersona,
        });

        userDocs.push(olderUser);
        reservationDocs.push(olderReservation);
        billableStays.push({
          seedIndex: tenantSeedIndex,
          user: olderUser,
          reservation: olderReservation,
          room,
        });
        touchedRoomIds.add(String(room._id));
        tenantSeedIndex += 1;
      }
    }

    for (let offset = 0; offset < 2; offset += 1) {
      const persona = choosePersona(applicantSeedIndex + roomIndex + offset);
      const createdAt = dayjs()
        .subtract(4 + ((applicantSeedIndex + offset) * 2) % 42, "day")
        .hour(10 + ((roomIndex + offset) % 7));
      const moveInDate = dayjs()
        .add(7 + ((applicantSeedIndex + offset) * 3) % 30, "day")
        .hour(9);
      const status =
        ["pending", "visit_pending", "visit_approved", "payment_pending", "cancelled"][
          (applicantSeedIndex + offset) % 5
        ];

      const applicantUser = buildApplicantUserDoc({
        seedIndex: applicantSeedIndex,
        branch: room.branch,
        persona,
        createdAt: createdAt.toDate(),
      });
      const applicantReservation = buildReservationDoc({
        user: applicantUser,
        room,
        createdAt: createdAt.toDate(),
        moveInDate: moveInDate.toDate(),
        moveOutDate: null,
        status,
        leaseDuration: 6,
        persona,
      });

      userDocs.push(applicantUser);
      reservationDocs.push(applicantReservation);
      applicantSeedIndex += 1;
    }
  }

  return {
    userDocs,
    reservationDocs,
    currentTenants,
    billableStays,
    touchedRoomIds,
  };
}

function buildBillDocs(billableStays) {
  const monthStarts = Array.from({ length: 6 }, (_, index) =>
    dayjs()
      .startOf("month")
      .subtract(5 - index, "month"),
  );
  const bills = [];

  for (const stay of billableStays) {
    const moveIn = dayjs(stay.reservation.moveInDate).startOf("day");
    const moveOut = stay.reservation.moveOutDate
      ? dayjs(stay.reservation.moveOutDate).endOf("day")
      : null;

    for (const monthStart of monthStarts) {
      const monthEnd = monthStart.endOf("month");
      if (moveIn.isAfter(monthEnd)) continue;
      if (moveOut && moveOut.isBefore(monthStart)) continue;

      const ageInMonths = dayjs().startOf("month").diff(monthStart, "month");
      const rent = Number(stay.room.monthlyPrice || stay.room.price || 0);
      const electricity = 650 + ((stay.seedIndex * 37 + monthStart.month()) % 620);
      const water = 180 + ((stay.seedIndex * 13 + monthStart.month()) % 140);
      const penalty = ageInMonths >= 2 && stay.seedIndex % 6 === 0 ? 250 : 0;
      const totalAmount = rent + electricity + water + penalty;

      let status = "paid";
      let paidAmount = totalAmount;

      if (ageInMonths === 0) {
        if (stay.seedIndex % 4 === 0) {
          status = "pending";
          paidAmount = 0;
        } else if (stay.seedIndex % 3 === 0) {
          status = "partially-paid";
          paidAmount = Math.round(totalAmount * 0.6);
        }
      } else if (ageInMonths === 1) {
        if (stay.seedIndex % 5 === 0) {
          status = "overdue";
          paidAmount = 0;
        } else if (stay.seedIndex % 4 === 0) {
          status = "partially-paid";
          paidAmount = Math.round(totalAmount * 0.55);
        }
      } else if (ageInMonths === 2 && stay.seedIndex % 7 === 0) {
        status = "overdue";
        paidAmount = Math.round(totalAmount * 0.35);
      }

      const rawPaymentDate =
        status === "paid" || paidAmount > 0
          ? monthStart.add(12 + (stay.seedIndex % 8), "day")
          : null;
      const paymentDate = rawPaymentDate ? rawPaymentDate.toDate() : null;
      const safePaymentDate =
        paymentDate && dayjs(paymentDate).isAfter(dayjs())
          ? dayjs().subtract(1, "day").toDate()
          : paymentDate;

      bills.push({
        _id: new mongoose.Types.ObjectId(),
        reservationId: stay.reservation._id,
        userId: stay.user._id,
        branch: stay.room.branch,
        roomId: stay.room._id,
        billingMonth: monthStart.toDate(),
        dueDate: monthStart.add(10, "day").toDate(),
        billingCycleStart: monthStart.toDate(),
        billingCycleEnd: monthEnd.toDate(),
        charges: {
          rent,
          electricity,
          water,
          applianceFees: 0,
          corkageFees: 0,
          penalty,
          discount: 0,
        },
        totalAmount,
        grossAmount: totalAmount,
        remainingAmount: Math.max(totalAmount - paidAmount, 0),
        status,
        paidAmount,
        paymentDate: safePaymentDate,
        notes: `${SEED_BILL_MARKER} ${stay.room.branch} ${stay.room.roomNumber}`,
        isManuallyAdjusted: false,
        isArchived: false,
        createdAt: monthStart.add(1, "day").toDate(),
        updatedAt: safePaymentDate || monthStart.add(14, "day").toDate(),
      });
    }
  }

  return bills;
}

function buildInquiryDocs() {
  const docs = [];
  let seedIndex = 1;

  for (const branch of Object.keys(ROOM_LIMITS)) {
    for (let index = 0; index < 18; index += 1) {
      const topic = INQUIRY_TOPICS[index % INQUIRY_TOPICS.length];
      const createdAt = dayjs()
        .subtract(2 + index * 2, "day")
        .hour(8 + ((index * 3) % 10))
        .minute(index % 2 === 0 ? 15 : 45);
      const status = ["pending", "in-progress", "resolved", "closed"][index % 4];
      const response =
        status === "resolved" || status === "closed"
          ? "Thanks for reaching out. Our team has already followed up with the latest update."
          : "";
      const respondedAt =
        response ? createdAt.add(6 + (index % 5), "hour").toDate() : null;

      docs.push({
        _id: new mongoose.Types.ObjectId(),
        name: `Seed Inquiry ${branch} ${seedIndex}`,
        email: makeSeedEmail("inquiry", branch, seedIndex),
        phone: buildPhone(seedIndex + 3000),
        subject: topic.subject,
        message:
          "Hello, I would like to ask about room availability, pricing, and move-in timing for the upcoming weeks.",
        branch,
        status,
        priority: ["medium", "high", "low", "urgent"][index % 4],
        tags: topic.tags,
        response,
        respondedBy: null,
        respondedAt,
        isRead: status !== "pending",
        isArchived: false,
        createdAt: createdAt.toDate(),
        updatedAt: respondedAt || createdAt.add(2, "hour").toDate(),
      });

      seedIndex += 1;
    }
  }

  return docs;
}

function buildMaintenanceDocs(currentTenants) {
  return currentTenants.slice(0, 28).map((entry, index) => {
    const createdAt = dayjs()
      .subtract(2 + index * 2, "day")
      .hour(9 + (index % 7))
      .minute(index % 2 === 0 ? 10 : 35);
    const urgency = ["high", "normal", "low"][index % 3];
    const requestType =
      MAINTENANCE_REQUEST_TYPES[index % MAINTENANCE_REQUEST_TYPES.length];

    let status = "pending";
    let assignedAt = null;
    let workStartedAt = null;
    let resolvedAt = null;
    let closedAt = null;

    switch (index % 5) {
      case 0:
        status = "pending";
        break;
      case 1:
        status = "in_progress";
        assignedAt = createdAt.add(2, "hour").toDate();
        workStartedAt = createdAt.add(5, "hour").toDate();
        break;
      case 2:
        status = "waiting_tenant";
        assignedAt = createdAt.add(3, "hour").toDate();
        workStartedAt = createdAt.add(8, "hour").toDate();
        break;
      case 3:
        status = "resolved";
        assignedAt = createdAt.add(1, "hour").toDate();
        workStartedAt = createdAt.add(4, "hour").toDate();
        resolvedAt = createdAt.add(18 + (index % 4) * 6, "hour").toDate();
        break;
      default:
        status = "completed";
        assignedAt = createdAt.add(2, "hour").toDate();
        workStartedAt = createdAt.add(6, "hour").toDate();
        resolvedAt = createdAt.add(42 + (index % 3) * 10, "hour").toDate();
        closedAt = dayjs(resolvedAt).add(4, "hour").toDate();
        break;
    }

    return {
      _id: new mongoose.Types.ObjectId(),
      request_id: `${SEED_MAINTENANCE_PREFIX}${String(index + 1).padStart(4, "0")}`,
      user_id: entry.user.user_id,
      request_type: requestType,
      description: MAINTENANCE_DESCRIPTIONS[index % MAINTENANCE_DESCRIPTIONS.length],
      urgency,
      status,
      assigned_to: assignedAt ? "Maintenance Team" : null,
      notes: SEED_BILL_MARKER,
      attachments: [],
      reopen_history: [],
      statusHistory: [
        {
          event: "created",
          status: "pending",
          actor_id: "system-seed",
          actor_name: "System Seed",
          actor_role: "system",
          note: "Seeded analytics maintenance request.",
          timestamp: createdAt.toDate(),
        },
      ],
      work_log:
        workStartedAt
          ? [
              {
                note: "Assigned for field inspection.",
                actor_id: "system-seed",
                actor_name: "System Seed",
                actor_role: "system",
                logged_at: workStartedAt,
              },
            ]
          : [],
      assigned_at: assignedAt,
      work_started_at: workStartedAt,
      closed_at: closedAt,
      resolved_at: resolvedAt,
      resolution_note:
        resolvedAt || closedAt ? "Issue was addressed during the seeded maintenance cycle." : null,
      branch: entry.room.branch,
      userId: entry.user._id,
      reservationId: entry.reservation._id,
      roomId: entry.room._id,
      isArchived: false,
      slaBreachNotified: false,
      created_at: createdAt.toDate(),
      updated_at: closedAt || resolvedAt || workStartedAt || assignedAt || createdAt.toDate(),
    };
  });
}

async function cleanupPreviousSeedData() {
  const seedUsers = await User.find({
    email: { $regex: SEED_EMAIL_REGEX },
  })
    .select("_id")
    .lean();
  const userIds = seedUsers.map((user) => user._id);

  const seededReservations = userIds.length
    ? await Reservation.find({
        userId: { $in: userIds },
      })
        .select("roomId")
        .lean()
    : [];
  const touchedRoomIds = new Set(
    seededReservations.map((reservation) => String(reservation.roomId)),
  );

  if (userIds.length > 0) {
    await Promise.all([
      Bill.deleteMany({
        $or: [
          { userId: { $in: userIds } },
          { notes: { $regex: SEED_BILL_REGEX } },
        ],
      }),
      Reservation.deleteMany({ userId: { $in: userIds } }),
      MaintenanceRequest.deleteMany({
        $or: [
          { userId: { $in: userIds } },
          { request_id: { $regex: `^${SEED_MAINTENANCE_PREFIX}` } },
        ],
      }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
  } else {
    await Promise.all([
      Bill.deleteMany({ notes: { $regex: SEED_BILL_REGEX } }),
      MaintenanceRequest.deleteMany({
        request_id: { $regex: `^${SEED_MAINTENANCE_PREFIX}` },
      }),
    ]);
  }

  await Inquiry.deleteMany({
    email: { $regex: SEED_EMAIL_REGEX },
  });

  return [...touchedRoomIds];
}

async function recalculateRooms(roomIds) {
  for (const roomId of roomIds) {
    await recalculateRoomOccupancy(roomId);
  }
}

async function main() {
  console.log(`\n${line()}`);
  console.log("  Analytics Demo Seed");
  console.log(line());

  await mongoose.connect(MONGODB_URI, getMongoConnectOptions());
  info("Connected to MongoDB");

  const cleanedRoomIds = await cleanupPreviousSeedData();
  if (cleanedRoomIds.length > 0) {
    await recalculateRooms(cleanedRoomIds);
  }
  ok("Removed previous analytics seed dataset");

  const rooms = await Room.find({
    isArchived: false,
  })
    .select("_id branch type name roomNumber floor capacity beds monthlyPrice price")
    .lean();

  if (rooms.length === 0) {
    throw new Error(
      "No rooms were found. Seed room inventory first before running analytics demo seeding.",
    );
  }

  const activeReservations = await Reservation.find({
    isArchived: false,
    status: { $in: ACTIVE_OCCUPANCY_STATUS_QUERY },
    roomId: { $in: rooms.map((room) => room._id) },
  })
    .select("roomId selectedBed status")
    .lean();

  const roomContexts = buildRoomContexts(rooms, activeReservations);
  const seedRooms = pickSeedRooms(roomContexts);

  if (seedRooms.length === 0) {
    throw new Error(
      "No rooms with available seedable beds were found. Free up at least one available bed in the inventory before running this script.",
    );
  }

  info(`Using ${seedRooms.length} rooms to generate analytics seed history`);

  const {
    userDocs,
    reservationDocs,
    currentTenants,
    billableStays,
    touchedRoomIds,
  } = generateReservationDataset(seedRooms);
  const billDocs = buildBillDocs(billableStays);
  const inquiryDocs = buildInquiryDocs();
  const maintenanceDocs = buildMaintenanceDocs(currentTenants);

  await User.insertMany(userDocs, { ordered: true });
  await Reservation.insertMany(reservationDocs, { ordered: true });
  await Bill.insertMany(billDocs, { ordered: true });
  await Inquiry.insertMany(inquiryDocs, { ordered: true });
  await MaintenanceRequest.insertMany(maintenanceDocs, { ordered: true });
  await recalculateRooms([...touchedRoomIds]);

  ok(`Created ${userDocs.length} users`);
  ok(`Created ${reservationDocs.length} reservations`);
  ok(`Created ${billDocs.length} bills`);
  ok(`Created ${inquiryDocs.length} inquiries`);
  ok(`Created ${maintenanceDocs.length} maintenance requests`);

  console.log(`\n${line("-")}`);
  console.log("  Next steps");
  console.log(line("-"));
  console.log("  1. Start the app and open the admin analytics pages.");
  console.log("  2. Check Dashboard, Analytics Overview, Billing, Operations, and Demographics.");
  console.log("  3. Use the AI insights endpoints after the seed data is loaded.");
  console.log(line());
}

main()
  .catch((error) => {
    console.error("\n[seed-analytics-demo] ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
