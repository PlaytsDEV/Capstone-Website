import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const reservationFindById = jest.fn();
const reservationFindByIdAndUpdate = jest.fn();
const reservationFind = jest.fn();
const reservationFindOne = jest.fn();
const userFindOne = jest.fn();
const roomFind = jest.fn();
const roomFindById = jest.fn();
const visitAvailabilityFindOne = jest.fn();
const visitAvailabilityCreate = jest.fn();
const utilityReadingFindOne = jest.fn();
const ensureCurrentCycleRentBill = jest.fn();
const moveOutStayWorkflow = jest.fn();
const notifyGeneral = jest.fn();
const buildUserUpdatePayload = jest.fn(() => ({}));
const sendPhysicalVisitStatusEmail = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  Reservation: {
    find: reservationFind,
    findById: reservationFindById,
    findByIdAndUpdate: reservationFindByIdAndUpdate,
    findOne: reservationFindOne,
  },
  User: { findOne: userFindOne },
  Room: { find: roomFind, findById: roomFindById },
  VisitAvailability: { findOne: visitAvailabilityFindOne, create: visitAvailabilityCreate },
  Bill: { countDocuments: jest.fn(), deleteMany: jest.fn() },
  UtilityReading: { findOne: utilityReadingFindOne },
  BedHistory: {},
  Stay: {},
  ROOM_BRANCHES: ["gil-puyat", "guadalupe"],
}));

await jest.unstable_mockModule("../config/constants.js", () => ({
  BUSINESS: { DEPOSIT_AMOUNT: 2000 },
}));
await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: { logError: jest.fn(), logModification: jest.fn() },
}));
await jest.unstable_mockModule("../utils/occupancyManager.js", () => ({
  updateOccupancyOnReservationChange: jest.fn(),
}));
await jest.unstable_mockModule("../utils/tenantActionService.js", () => ({
  getTenantActionContext: jest.fn(),
  moveOutStayWorkflow,
  renewStayWorkflow: jest.fn(),
  transferStayWorkflow: jest.fn(),
}));
await jest.unstable_mockModule("../utils/rentGenerator.js", () => ({
  ensureCurrentCycleRentBill,
}));
await jest.unstable_mockModule("../utils/reservationHelpers.js", () => ({
  isValidObjectId: jest.fn(() => true),
  invalidIdResponse: jest.fn(),
  handleReservationError: jest.fn(),
  checkBranchAccess: jest.fn(() => null),
  validateMoveInDate: jest.fn(() => true),
  handleStatusTransition: jest.fn(),
  syncReservationUserLifecycle: jest.fn(),
  reconcileTenantUsersForScope: jest.fn(async () => []),
  buildUserUpdatePayload,
  getMoveInBlockers: jest.fn(() => []),
}));
await jest.unstable_mockModule("../utils/lifecycleNaming.js", () => ({
  ACTIVE_OCCUPANCY_STATUS_QUERY: ["reserved", "moveIn"],
  ACTIVE_STAY_STATUS_QUERY: ["reserved", "moveIn"],
  CURRENT_RESIDENT_STATUS_QUERY: ["moveIn"],
  canTransitionReservationStatus: jest.fn((current, next) => {
    if (current === next) return true;
    if (current === "pending") {
      return ["visit_pending", "viewing_preference_selected", "pending_application_review"].includes(next);
    }
    return true;
  }),
  hasReservationStatus: jest.fn((status, expected) => {
    const values = Array.isArray(expected) ? expected : [expected];
    return values.includes(status);
  }),
  normalizeReservationPayload: jest.fn((payload) => payload),
  normalizeReservationStatus: jest.fn((status) => status),
  readMoveInDate: jest.fn(() => null),
  readMoveOutDate: jest.fn(() => null),
  reservationStatusesForQuery: jest.fn((...statuses) => statuses.flat()),
  serializeReservation: jest.fn((value) => value),
  serializeReservations: jest.fn((values) => values),
  utilityEventTypesForQuery: jest.fn((...types) => types.flat()),
}));
await jest.unstable_mockModule("../config/email.js", () => ({
  sendReservationConfirmedEmail: jest.fn(),
  sendVisitApprovedEmail: jest.fn(),
  sendPhysicalVisitStatusEmail,
  sendDocumentsRejectedEmail: jest.fn(),
}));
await jest.unstable_mockModule("../services/reservationDocumentPrecheckService.js", () => ({
  isAllowedReservationDocumentUrl: jest.fn(() => true),
  runReservationDocumentPrecheck: jest.fn(),
}));
await jest.unstable_mockModule("../middleware/errorHandler.js", () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
  AppError: class AppError extends Error {},
}));
await jest.unstable_mockModule("../utils/notificationService.js", () => ({
  notify: { general: notifyGeneral },
}));

const {
  manageReservationVisit,
  moveOutReservation,
  updateReservation,
  updateReservationByUser,
  updateVisitAvailabilityRules,
} = await import("./reservationsController.js");

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

describe("reservationsController.updateReservation access hardening", () => {
  beforeEach(() => {
    reservationFindById.mockReset();
    reservationFindByIdAndUpdate.mockReset();
    reservationFind.mockReset();
    reservationFindOne.mockReset();
    userFindOne.mockReset();
    roomFind.mockReset();
    roomFindById.mockReset();
    utilityReadingFindOne.mockReset();
    visitAvailabilityFindOne.mockReset();
    visitAvailabilityCreate.mockReset();
    ensureCurrentCycleRentBill.mockReset();
    moveOutStayWorkflow.mockReset();
    notifyGeneral.mockReset();
    sendPhysicalVisitStatusEmail.mockReset();
    sendPhysicalVisitStatusEmail.mockResolvedValue({ success: true });
    buildUserUpdatePayload.mockReset();
    buildUserUpdatePayload.mockReturnValue({});
    userFindOne.mockResolvedValue(null);
  });

  test("rejects invalid lifecycle jumps before mutating reservation", async () => {
    reservationFindById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: "507f1f77bcf86cd799439011",
        status: "pending",
        userId: "user-1",
        roomId: { _id: "room-1", branch: "gil-puyat" },
        toObject: () => ({
          status: "pending",
          userId: "user-1",
          roomId: { _id: "room-1", branch: "gil-puyat" },
        }),
      }),
    });

    const req = {
      params: { reservationId: "507f1f77bcf86cd799439011" },
      body: { status: "moveOut" },
      branchFilter: "gil-puyat",
    };
    const res = createResponse();
    const next = jest.fn();

    await updateReservation(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_RESERVATION_STATUS_TRANSITION");
    expect(next).not.toHaveBeenCalled();
  });

  test("move-out reads meterReading from request body before running workflow", async () => {
    const reservation = {
      _id: "507f1f77bcf86cd799439011",
      status: "moveIn",
      userId: { _id: "tenant-1", firstName: "Tala", lastName: "Tenant", email: "tala@example.com" },
      roomId: { _id: "room-1", branch: "gil-puyat", name: "Room 1" },
      toObject: () => ({
        _id: "507f1f77bcf86cd799439011",
        status: "moveIn",
        userId: "tenant-1",
        roomId: { _id: "room-1", branch: "gil-puyat", name: "Room 1" },
      }),
    };
    const populatedQuery = {
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(reservation)),
    };
    reservationFindById.mockReturnValue(populatedQuery);
    moveOutStayWorkflow.mockResolvedValue({
      reservation,
      stay: { _id: "stay-1", status: "completed" },
      billingSummary: { outstandingBalance: 0 },
    });

    const req = {
      params: { reservationId: "507f1f77bcf86cd799439011" },
      body: { meterReading: 128, moveOutDate: "2026-05-02" },
      branchFilter: "gil-puyat",
      user: { uid: "admin-uid" },
    };
    const res = createResponse();
    const next = jest.fn();

    await moveOutReservation(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(moveOutStayWorkflow).toHaveBeenCalledWith({
      reservationId: "507f1f77bcf86cd799439011",
      payload: req.body,
      actorId: null,
    });
    expect(res.body.message).toBe("Tenant moved out successfully");
    expect(next).not.toHaveBeenCalled();
  });

  test("branch admins cannot update another branch visit availability", async () => {
    userFindOne.mockResolvedValue({
      _id: "admin-1",
      role: "branch_admin",
      branch: "gil-puyat",
      email: "admin@example.com",
    });

    const req = {
      query: { branch: "guadalupe" },
      body: { enabledWeekdays: [1, 2, 3, 4, 5] },
      user: { uid: "admin-uid" },
    };
    const res = createResponse();
    const next = jest.fn();

    await updateVisitAvailabilityRules(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("BRANCH_ACCESS_DENIED");
    expect(visitAvailabilityFindOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("owners can update any branch visit availability", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    userFindOne.mockResolvedValue({
      _id: "owner-1",
      role: "owner",
      branch: null,
      email: "owner@example.com",
    });
    visitAvailabilityFindOne.mockResolvedValue({
      branch: "guadalupe",
      enabledWeekdays: [1, 2, 3, 4, 5],
      slots: [{ label: "09:00 AM", enabled: true, capacity: 5 }],
      blackoutDates: [],
      save,
    });

    const req = {
      query: { branch: "guadalupe" },
      body: { enabledWeekdays: [1, 3, 5] },
      user: { uid: "owner-uid" },
    };
    const res = createResponse();
    const next = jest.fn();

    await updateVisitAvailabilityRules(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("visit management stays unavailable for non-physical viewing preferences", async () => {
    const reservation = {
      _id: "507f1f77bcf86cd799439011",
      status: "pending_application_review",
      viewingPreference: "remote_2d_viewing",
      visitDate: null,
      visitTime: "",
      roomId: { _id: "room-1", branch: "gil-puyat" },
      userId: { _id: "tenant-1", email: "tala@example.com" },
      toObject: () => ({
        _id: "507f1f77bcf86cd799439011",
        status: "pending_application_review",
        viewingPreference: "remote_2d_viewing",
        roomId: { _id: "room-1", branch: "gil-puyat" },
      }),
      populate: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
    };
    reservationFindById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(reservation)),
    });

    const req = {
      params: { reservationId: "507f1f77bcf86cd799439011" },
      body: { action: "mark_visited" },
      branchFilter: "gil-puyat",
      user: { uid: "admin-uid", email: "admin@example.com" },
    };
    const res = createResponse();
    const next = jest.fn();

    await manageReservationVisit(req, res, next);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("VISIT_MANAGEMENT_NOT_APPLICABLE");
    expect(reservation.save).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("tenant can switch to remote viewing without sending a physical visit schedule", async () => {
    const updatedReservation = {
      _id: "507f1f77bcf86cd799439011",
      status: "viewing_preference_selected",
      userId: { _id: "tenant-1", email: "tala@example.com" },
      roomId: { _id: "room-1", branch: "gil-puyat", name: "Room 1" },
      viewingPreference: "remote_2d_viewing",
      visitDate: null,
      visitTime: "",
      populate: jest.fn().mockResolvedValue(undefined),
    };

    reservationFindById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      userId: "tenant-1",
      roomId: "room-1",
      status: "pending",
      visitDate: new Date("2026-05-15T00:00:00.000Z"),
      visitTime: "09:00 AM",
      remoteViewingAcknowledged: false,
      agreedToPrivacy: false,
      scheduleRejected: false,
      validIDFrontUrl: null,
      nbiClearanceUrl: null,
      companyIDUrl: null,
      emergencyContact: {},
      employment: {},
      idType: null,
      validIDType: null,
    });
    buildUserUpdatePayload.mockReturnValue({
      agreedToPrivacy: true,
      remoteViewingAcknowledged: true,
      remoteViewingQuestions: "",
    });
    reservationFindByIdAndUpdate.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(updatedReservation)),
    });

    const req = {
      params: { reservationId: "507f1f77bcf86cd799439011" },
      user: { uid: "tenant-firebase-uid" },
      body: {
        agreedToPrivacy: true,
        viewingPreference: "remote_2d_viewing",
        remoteViewingAcknowledged: true,
        remoteViewingQuestions: "",
      },
    };
    const res = createResponse();
    const next = jest.fn();

    userFindOne.mockResolvedValue({
      _id: "tenant-1",
      firebaseUid: "tenant-firebase-uid",
      role: "applicant",
    });

    await updateReservationByUser(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body?.reservation?.viewingPreference).toBe("remote_2d_viewing");
    expect(reservationFindByIdAndUpdate).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      expect.objectContaining({
        $set: expect.objectContaining({
          viewingPreference: "remote_2d_viewing",
          viewingType: "remote_2d",
          visitDate: null,
          visitTime: "",
          visitCode: null,
          remoteViewingAcknowledged: true,
        }),
      }),
      { new: true, runValidators: true },
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("physical-visit applicants cannot submit the tenant application before visit clearance", async () => {
    reservationFindById.mockResolvedValue({
      _id: "507f1f77bcf86cd799439012",
      userId: "tenant-1",
      roomId: "room-1",
      status: "viewing_preference_selected",
      viewingPreference: "physical_visit",
      visitDate: new Date("2026-05-18T00:00:00.000Z"),
      visitTime: "10:00 AM",
      visitStatus: "physical_visit_scheduled",
      agreedToPrivacy: true,
      agreedToCertification: true,
      firstName: null,
      lastName: null,
      mobileNumber: null,
      selfiePhotoUrl: null,
      emergencyContact: {},
      validIDFrontUrl: null,
      nbiClearanceUrl: null,
      companyIDUrl: null,
      idType: null,
      validIDType: null,
      applicationSubmittedAt: null,
    });
    buildUserUpdatePayload.mockReturnValue({
      firstName: "Tala",
      lastName: "Applicant",
      mobileNumber: "09123456789",
      agreedToPrivacy: true,
      agreedToCertification: true,
      selfiePhotoUrl: "https://example.com/selfie.jpg",
      validIDFrontUrl: "https://example.com/id-front.jpg",
      validIDBackUrl: "https://example.com/id-back.jpg",
      nbiReason: "To follow",
      companyIDReason: "Student applicant",
      idType: "Passport",
      validIDType: "Passport",
      "emergencyContact.name": "Parent Contact",
      "emergencyContact.contactNumber": "09123456789",
    });

    const req = {
      params: { reservationId: "507f1f77bcf86cd799439012" },
      user: { uid: "tenant-firebase-uid" },
      body: {
        submitApplication: true,
        firstName: "Tala",
        lastName: "Applicant",
        mobileNumber: "09123456789",
        agreedToPrivacy: true,
        agreedToCertification: true,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    userFindOne.mockResolvedValue({
      _id: "tenant-1",
      firebaseUid: "tenant-firebase-uid",
      role: "applicant",
    });

    await updateReservationByUser(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body?.code).toBe("PHYSICAL_VISIT_APPLICATION_LOCKED");
    expect(reservationFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("admin can allow application progress without a completed physical visit", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const populate = jest.fn().mockResolvedValue(undefined);
    const reservation = {
      _id: "507f1f77bcf86cd799439013",
      status: "viewing_preference_selected",
      viewingPreference: "physical_visit",
      visitDate: new Date("2026-05-20T00:00:00.000Z"),
      visitTime: "01:00 PM",
      visitCode: "VIS-123456",
      visitHistory: [],
      roomId: { _id: "room-1", branch: "gil-puyat", roomNumber: "301", name: "Room 301" },
      userId: {
        _id: "tenant-1",
        firstName: "Tala",
        lastName: "Applicant",
        email: "tala@example.com",
      },
      toObject: () => ({
        _id: "507f1f77bcf86cd799439013",
        status: "viewing_preference_selected",
        viewingPreference: "physical_visit",
      }),
      populate,
      save,
    };
    reservationFindById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(reservation)),
    });
    userFindOne.mockResolvedValue({
      _id: "admin-1",
      firebaseUid: "admin-uid",
      role: "branch_admin",
      firstName: "Branch",
      lastName: "Admin",
      email: "admin@example.com",
    });

    const req = {
      params: { reservationId: "507f1f77bcf86cd799439013" },
      body: { action: "allow_without_visit", note: "Proceed with documents first." },
      branchFilter: "gil-puyat",
      user: { uid: "admin-uid", email: "admin@example.com" },
    };
    const res = createResponse();
    const next = jest.fn();

    await manageReservationVisit(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body?.reservation?.visitStatus).toBe("allowed_without_visit");
    expect(sendPhysicalVisitStatusEmail).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("admin can reschedule a physical visit using the reservation room branch", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const populate = jest.fn().mockResolvedValue(undefined);
    const reservation = {
      _id: "507f1f77bcf86cd799439014",
      status: "viewing_preference_selected",
      viewingPreference: "physical_visit",
      viewingType: "inperson",
      visitDate: new Date("2026-05-20T00:00:00.000Z"),
      visitTime: "01:00 PM",
      visitScheduledAt: new Date("2026-05-12T00:00:00.000Z"),
      visitHistory: [],
      roomId: { _id: "room-1", branch: "gil-puyat", roomNumber: "301", name: "Room 301" },
      userId: {
        _id: "tenant-1",
        firstName: "Tala",
        lastName: "Applicant",
        email: "tala@example.com",
      },
      toObject: () => ({
        _id: "507f1f77bcf86cd799439014",
        status: "viewing_preference_selected",
        viewingPreference: "physical_visit",
      }),
      populate,
      save,
    };
    reservationFindById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve(resolve(reservation)),
    });
    userFindOne.mockResolvedValue({
      _id: "admin-1",
      firebaseUid: "admin-uid",
      role: "branch_admin",
      firstName: "Branch",
      lastName: "Admin",
      email: "admin@example.com",
    });
    visitAvailabilityFindOne.mockResolvedValue({
      branch: "gil-puyat",
      enabledWeekdays: [1, 2, 3, 4, 5],
      slots: [{ label: "02:00 PM", enabled: true, capacity: 5 }],
      blackoutDates: [],
    });
    roomFind.mockReturnValue({
      distinct: jest.fn().mockResolvedValue(["room-1"]),
    });
    reservationFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const req = {
      params: { reservationId: "507f1f77bcf86cd799439014" },
      body: {
        action: "reschedule",
        visitDate: "2026-05-21",
        visitTime: "02:00 PM",
        note: "Move to the afternoon slot.",
      },
      branchFilter: "gil-puyat",
      user: { uid: "admin-uid", email: "admin@example.com" },
    };
    const res = createResponse();
    const next = jest.fn();

    await manageReservationVisit(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body?.reservation?.visitStatus).toBe("rescheduled");
    expect(visitAvailabilityFindOne).toHaveBeenCalledWith({ branch: "gil-puyat" });
    expect(reservation.visitTime).toBe("02:00 PM");
    expect(save).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
