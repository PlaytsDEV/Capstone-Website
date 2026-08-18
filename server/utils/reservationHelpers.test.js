import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import dayjs from "dayjs";

const userFindById = jest.fn();
const userFind = jest.fn();
const roomFindById = jest.fn();
const reservationFind = jest.fn();
const reservationFindOne = jest.fn();
const reservationFindById = jest.fn();
const setCustomUserClaims = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  User: {
    findById: userFindById,
    find: userFind,
  },
  Room: {
    findById: roomFindById,
  },
  Reservation: {
    find: reservationFind,
    findOne: reservationFindOne,
    findById: reservationFindById,
  },
}));

await jest.unstable_mockModule("../config/firebase.js", () => ({
  getAuth: () => ({
    setCustomUserClaims,
  }),
}));

const {
  buildUserUpdatePayload,
  getForbiddenTenantUpdateFields,
  syncReservationUserLifecycle,
  reconcileTenantUsersForScope,
  getMoveInBlockers,
  validateMoveInDate,
} = await import("./reservationHelpers.js");

const createUser = (overrides = {}) => ({
  firebaseUid: "firebase-user-1",
  role: "applicant",
  tenantStatus: "applicant",
  branch: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const mockRoomBranch = (branch) => {
  const select = jest.fn().mockResolvedValue({ branch });
  roomFindById.mockReturnValue({ select });
  return select;
};

const mockNoFallbackReservations = () => {
  reservationFind.mockImplementation(() => ({
    sort: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    }),
  }));
  reservationFindOne.mockImplementation(() => ({
    sort: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    }),
  }));
};

const mockFindOneReservation = (reservation = null) => {
  reservationFindOne.mockImplementation(() => ({
    sort: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(reservation),
    }),
  }));
};

const mockReservationById = ({ moveOutDate = null, branch = "gil-puyat" } = {}) => {
  reservationFindById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        _id: "reservation-1",
        moveOutDate,
        roomId: { _id: "room-1", branch },
      }),
    }),
  });
};

describe("tenant reservation update helpers", () => {
  test("detects protected tenant update fields before mutation", () => {
    expect(
      getForbiddenTenantUpdateFields({
        firstName: "Tala",
        status: "reserved",
        proofOfPaymentUrl: "https://example.test/proof.jpg",
        visitApproved: true,
        paymentStatus: "paid",
      }),
    ).toEqual(["status", "proofOfPaymentUrl", "visitApproved", "paymentStatus"]);
  });

  test("normalizes accepted mobile formats and omits protected fields from update payload", () => {
    const updates = buildUserUpdatePayload({
      firstName: "Tala",
      mobileNumber: "+639171234567",
      emergencyContactNumber: "09181234567",
      status: "reserved",
      proofOfPaymentUrl: "https://example.test/proof.jpg",
      paymentMethod: "gcash",
    });

    expect(updates).toEqual({
      firstName: "Tala",
      mobileNumber: "09171234567",
      "emergencyContact.contactNumber": "09181234567",
    });
  });

  test("converts name fields and emergency contacts to proper case with first letters capitalized", () => {
    const updates = buildUserUpdatePayload({
      firstName: "vince",
      lastName: "palicpic",
      middleName: "santos",
      nickname: "vin",
      referrerName: "juan dela cruz",
      emergencyContactName: "maria clara",
      occupation: "software engineer",
    });

    expect(updates).toEqual({
      firstName: "Vince",
      lastName: "Palicpic",
      middleName: "Santos",
      nickname: "Vin",
      referrerName: "Juan Dela Cruz",
      "emergencyContact.name": "Maria Clara",
      "employment.occupation": "Software Engineer",
    });
  });
});

describe("syncReservationUserLifecycle", () => {
  beforeEach(() => {
    userFindById.mockReset();
    userFind.mockReset();
    roomFindById.mockReset();
    reservationFindOne.mockReset();
    reservationFindById.mockReset();
    setCustomUserClaims.mockReset();
  });

  test("promotes a moved-in reservation user to active tenant and syncs branch", async () => {
    const user = createUser();
    userFindById.mockResolvedValue(user);
    mockRoomBranch("gil-puyat");
    mockReservationById({ branch: "gil-puyat" });

    await syncReservationUserLifecycle({
      status: "moveIn",
      previousStatus: "reserved",
      userId: "user-1",
      roomId: "room-1",
      reservationId: "reservation-1",
    });

    expect(user.role).toBe("tenant");
    expect(user.tenantStatus).toBe("active");
    expect(user.branch).toBe("gil-puyat");
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaims).toHaveBeenCalledWith("firebase-user-1", {
      role: "tenant",
      tenantStatus: "active",
    });
  });

  test("resets archived tenant with no valid fallback to applicant with no branch", async () => {
    const user = createUser({ role: "tenant", tenantStatus: "active", branch: "gil-puyat" });
    userFindById.mockResolvedValue(user);
    mockNoFallbackReservations();

    await syncReservationUserLifecycle({
      status: "archived",
      previousStatus: "moveIn",
      userId: "user-1",
      roomId: "room-1",
      reservationId: "reservation-1",
    });

    expect(user.role).toBe("applicant");
    expect(user.tenantStatus).toBe("applicant");
    expect(user.branch).toBeNull();
    expect(setCustomUserClaims).toHaveBeenCalledWith("firebase-user-1", {
      role: "applicant",
      tenantStatus: "applicant",
    });
  });

  test("force sync updates branch on same-status transfer", async () => {
    const user = createUser({ role: "tenant", tenantStatus: "active", branch: "gil-puyat" });
    userFindById.mockResolvedValue(user);
    mockRoomBranch("guadalupe");
    mockReservationById({ branch: "guadalupe" });

    await syncReservationUserLifecycle({
      status: "moveIn",
      previousStatus: "moveIn",
      userId: "user-1",
      roomId: "room-2",
      reservationId: "reservation-1",
      force: true,
    });

    expect(user.role).toBe("tenant");
    expect(user.tenantStatus).toBe("active");
    expect(user.branch).toBe("guadalupe");
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  test("resets cancelled reservations with no fallback stay to applicant with no branch", async () => {
    const user = createUser({ role: "tenant", tenantStatus: "active", branch: "gil-puyat" });
    userFindById.mockResolvedValue(user);
    mockNoFallbackReservations();

    await syncReservationUserLifecycle({
      status: "cancelled",
      previousStatus: "reserved",
      userId: "user-1",
      roomId: "room-1",
      reservationId: "reservation-1",
    });

    expect(user.role).toBe("applicant");
    expect(user.tenantStatus).toBe("applicant");
    expect(user.branch).toBeNull();
  });

  test("moveOut now reverts tenant lifecycle back to applicant when no fallback exists", async () => {
    const user = createUser({ role: "tenant", tenantStatus: "active", branch: "gil-puyat" });
    userFindById.mockResolvedValue(user);
    mockNoFallbackReservations();

    await syncReservationUserLifecycle({
      status: "moveOut",
      previousStatus: "moveIn",
      userId: "user-1",
      roomId: "room-1",
      reservationId: "reservation-1",
    });

    expect(user.role).toBe("applicant");
    expect(user.tenantStatus).toBe("applicant");
    expect(user.branch).toBeNull();
  });

  test("expired moved-in reservation falls back to reserved applicant lifecycle", async () => {
    const user = createUser({ role: "tenant", tenantStatus: "active", branch: "gil-puyat" });
    userFindById.mockResolvedValue(user);

    reservationFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "reservation-1",
          moveOutDate: new Date("2026-01-01T00:00:00.000Z"),
          roomId: { branch: "gil-puyat" },
        }),
      }),
    });

    reservationFindOne
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      })
      .mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: "reservation-2",
            roomId: { _id: "room-2", branch: "guadalupe" },
          }),
        }),
      });

    await syncReservationUserLifecycle({
      status: "moveIn",
      previousStatus: "moveIn",
      userId: "user-1",
      roomId: "room-1",
      reservationId: "reservation-1",
      force: true,
    });

    expect(user.role).toBe("applicant");
    expect(user.tenantStatus).toBe("applicant");
    expect(user.branch).toBe("guadalupe");
  });
});

describe("reconcileTenantUsersForScope", () => {
  beforeEach(() => {
    userFindById.mockReset();
    userFind.mockReset();
    roomFindById.mockReset();
    reservationFind.mockReset();
    reservationFindOne.mockReset();
    reservationFindById.mockReset();
    setCustomUserClaims.mockReset();
  });

  test("downgrades stale tenant-role users with no qualifying stay", async () => {
    userFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "user-1",
            role: "tenant",
            tenantStatus: "active",
            branch: "gil-puyat",
          },
        ]),
      }),
    });

    const user = createUser({ role: "tenant", tenantStatus: "active", branch: "gil-puyat" });
    userFindById.mockResolvedValue(user);
    mockNoFallbackReservations();

    await reconcileTenantUsersForScope({ branch: "gil-puyat" });

    expect(user.role).toBe("applicant");
    expect(user.tenantStatus).toBe("applicant");
    expect(user.branch).toBeNull();
  });

  test("syncs branch when active stay has a different branch", async () => {
    userFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: "user-1",
            role: "tenant",
            tenantStatus: "active",
            branch: "gil-puyat",
          },
        ]),
      }),
    });

    reservationFind.mockImplementation(() => ({
      sort: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: "res-1",
              userId: "user-1",
              status: "checked-in",
              roomId: { _id: "room-1", branch: "guadalupe" },
            },
          ]),
        }),
      }),
    }));

    const user = createUser({ role: "tenant", tenantStatus: "active", branch: "gil-puyat" });
    userFindById.mockResolvedValue(user);
    mockFindOneReservation({
      _id: "res-1",
      status: "checked-in",
      roomId: { _id: "room-1", branch: "guadalupe" },
    });

    await reconcileTenantUsersForScope({ branch: "gil-puyat" });

    expect(user.role).toBe("tenant");
    expect(user.tenantStatus).toBe("active");
    expect(user.branch).toBe("guadalupe");
  });
});

describe("getMoveInBlockers", () => {
  test("returns empty blockers when reservation is reserved and paid", () => {
    expect(
      getMoveInBlockers({
        status: "reserved",
        paymentStatus: "paid",
      }),
    ).toEqual([]);
  });

  test("allows move-in when paymentStatus is paid_in_full", () => {
    expect(
      getMoveInBlockers({
        status: "reserved",
        paymentStatus: "paid_in_full",
      }),
    ).toEqual([]);
  });

  test("allows move-in when initialPaymentStatus is paid", () => {
    expect(
      getMoveInBlockers({
        status: "reserved",
        initialPaymentStatus: "paid",
        paymentStatus: "pending",
      }),
    ).toEqual([]);
  });

  test("allows move-in when reservationFeePaymentStatus is verified", () => {
    expect(
      getMoveInBlockers({
        status: "reserved",
        reservationFeePaymentStatus: "verified",
        paymentStatus: "pending",
      }),
    ).toEqual([]);
  });

  test("flags blocker when reservation is not in reserved state", () => {
    const blockers = getMoveInBlockers({
      status: "pending",
      paymentStatus: "paid",
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatch(/Reservation must be in "Reserved" state/);
  });

  test("flags blocker when reservation is unpaid", () => {
    const blockers = getMoveInBlockers({
      status: "reserved",
      paymentStatus: "pending",
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toBe(
      "Payment must be confirmed (status: Paid) before move-in.",
    );
  });
});

describe("validateMoveInDate", () => {
  test("rejects empty, null, or invalid dates", () => {
    expect(validateMoveInDate(null)).toBe(false);
    expect(validateMoveInDate("")).toBe(false);
    expect(validateMoveInDate("invalid-date")).toBe(false);
  });

  test("rejects dates earlier than 3 days from today", () => {
    const today = dayjs().format("YYYY-MM-DD");
    const tomorrow = dayjs().add(1, "day").format("YYYY-MM-DD");
    const twoDaysLater = dayjs().add(2, "day").format("YYYY-MM-DD");
    expect(validateMoveInDate(today)).toBe(false);
    expect(validateMoveInDate(tomorrow)).toBe(false);
    expect(validateMoveInDate(twoDaysLater)).toBe(false);
  });

  test("accepts dates starting exactly 3 days from today", () => {
    const threeDaysLater = dayjs().add(3, "day").format("YYYY-MM-DD");
    expect(validateMoveInDate(threeDaysLater)).toBe(true);
  });

  test("accepts dates within 1-2 months from today", () => {
    const oneMonthLater = dayjs().add(1, "month").format("YYYY-MM-DD");
    const twoMonthsLater = dayjs().add(2, "month").format("YYYY-MM-DD");
    expect(validateMoveInDate(oneMonthLater)).toBe(true);
    expect(validateMoveInDate(twoMonthsLater)).toBe(true);
  });

  test("accepts date exactly 3 months from today", () => {
    const threeMonthsLater = dayjs().add(3, "month").format("YYYY-MM-DD");
    expect(validateMoveInDate(threeMonthsLater)).toBe(true);
  });

  test("rejects dates beyond 3 months from today", () => {
    const beyondThreeMonths = dayjs().add(3, "month").add(2, "day").format("YYYY-MM-DD");
    expect(validateMoveInDate(beyondThreeMonths)).toBe(false);
  });
});

