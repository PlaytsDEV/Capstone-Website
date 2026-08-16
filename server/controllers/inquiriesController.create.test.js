import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockSave = jest.fn();
const mockInquiryConstructor = jest.fn();

class MockInquiry {
  constructor(data) {
    mockInquiryConstructor(data);
    Object.assign(this, data);
    this._id = "mockInquiryId123";
  }
  save() {
    return mockSave();
  }
}

await jest.unstable_mockModule("../models/index.js", () => ({
  Inquiry: MockInquiry,
  User: {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    }),
  },
}));

await jest.unstable_mockModule("../services/notifications/notificationService.js", () => ({
  createNotification: jest.fn().mockResolvedValue(true),
  notifyBranchAdmins: jest.fn().mockResolvedValue([]),
}));

const { createInquiry } = await import("./inquiriesController.js");

describe("inquiriesController - createInquiry", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(true);
    req = {
      body: {
        name: "Rio Mercotila",
        email: "riomercotila0@gmail.com",
        phone: "+639876253441",
        subject: "Room Inquiry — Double Occupancy",
        message: "probleeeeeem ko po",
        branch: "gil-puyat",
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test("should default source to 'website' when source is omitted by public form", async () => {
    await createInquiry(req, res, next);

    expect(mockInquiryConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Rio Mercotila",
        email: "riomercotila0@gmail.com",
        contactNumber: "+639876253441",
        subject: "Room Inquiry — Double Occupancy",
        message: "probleeeeeem ko po",
        branch: "gil-puyat",
        source: "website",
        status: "pending",
      })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Inquiry submitted successfully. We will get back to you soon!",
        inquiryId: "mockInquiryId123",
      })
    );
  });

  test("should preserve explicit source if provided in body", async () => {
    req.body.source = "facebook";
    await createInquiry(req, res, next);

    expect(mockInquiryConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "facebook",
      })
    );
  });

  test("should return user-friendly error message when required fields are missing", async () => {
    delete req.body.email;
    await createInquiry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Missing required fields. Please fill out your name, email, subject, message, and preferred branch.",
        code: "MISSING_REQUIRED_FIELDS",
      })
    );
  });

  test("should return user-friendly error message when email is invalid", async () => {
    req.body.email = "not-an-email";
    await createInquiry(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Please enter a valid email address.",
        code: "INVALID_EMAIL",
      })
    );
  });
});
