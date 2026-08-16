import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockSave = jest.fn();
const mockInquiryConstructor = jest.fn();

class MockInquiry {
  constructor(data) {
    mockInquiryConstructor(data);
    Object.assign(this, data);
    this._id = "mockInquiryId456";
  }
  save() {
    return mockSave();
  }
}

const mockUserFindOne = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  Inquiry: MockInquiry,
  User: {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    }),
    findOne: mockUserFindOne,
  },
}));

await jest.unstable_mockModule("../services/notifications/notificationService.js", () => ({
  createNotification: jest.fn().mockResolvedValue(true),
  notifyBranchAdmins: jest.fn().mockResolvedValue([]),
}));

const { createInquiry } = await import("./inquiriesController.js");

describe("inquiriesController - createInquiry authenticated vs guest", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(true);
    req = {
      body: {
        name: "Test Tenant",
        email: "tenant@example.com",
        phone: "+639123456789",
        subject: "Room Inquiry — Private Room",
        message: "Question about availability",
        branch: "guadalupe",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test("should associate authenticated user when req.authUser exists", async () => {
    req.authUser = { _id: "mongoUserId123" };
    req.user = { uid: "firebaseUid123" };

    await createInquiry(req, res, next);

    expect(mockInquiryConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "mongoUserId123",
        fullName: "Test Tenant",
        email: "tenant@example.com",
        branch: "guadalupe",
        status: "pending",
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining("successfully"),
        inquiryId: "mockInquiryId456",
      })
    );
  });

  test("should lookup user by firebaseUid when req.user is set but authUser is omitted", async () => {
    req.user = { uid: "firebaseUid999" };
    mockUserFindOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "lookedUpMongoId999" }),
      }),
    });

    await createInquiry(req, res, next);

    expect(mockInquiryConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "lookedUpMongoId999",
      })
    );
  });

  test("should set user to null for unauthenticated guest inquiries", async () => {
    req.user = null;
    req.authUser = null;

    await createInquiry(req, res, next);

    expect(mockInquiryConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        user: null,
        fullName: "Test Tenant",
        email: "tenant@example.com",
        branch: "guadalupe",
      })
    );
  });
});
