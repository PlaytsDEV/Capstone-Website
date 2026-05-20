import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const maintenanceFind = jest.fn();
const maintenanceFindOne = jest.fn();
const maintenanceSave = jest.fn();
const userFind = jest.fn();
const userFindOne = jest.fn();
const reservationFindOne = jest.fn();
const roomFindById = jest.fn();
const stayFindOne = jest.fn();
const bedHistoryFindOne = jest.fn();
const chatConversationFindById = jest.fn();
const sendSuccess = jest.fn();
const maintenanceUpdated = jest.fn();
let lastCreatedMaintenanceRequest = null;

class MockMaintenanceRequest {
  constructor(data) {
    Object.assign(this, data);
    this._id = data._id || "created_request_id";
    this.save = maintenanceSave;
    lastCreatedMaintenanceRequest = this;
  }

  toObject() {
    return { ...this, save: undefined };
  }

  static find(...args) {
    return maintenanceFind(...args);
  }

  static findOne(...args) {
    return maintenanceFindOne(...args);
  }
}

await jest.unstable_mockModule("../models/index.js", () => ({
  MaintenanceRequest: MockMaintenanceRequest,
  Reservation: {
    findOne: reservationFindOne,
  },
  Room: {
    findById: roomFindById,
  },
  Stay: {
    findOne: stayFindOne,
  },
  BedHistory: {
    findOne: bedHistoryFindOne,
  },
  ChatConversation: {
    findById: chatConversationFindById,
  },
  User: {
    find: userFind,
    findOne: userFindOne,
  },
}));
await jest.unstable_mockModule("../utils/sanitize.js", () => ({
  clean: (value) => value,
}));
await jest.unstable_mockModule("../utils/notificationService.js", () => ({
  notify: {
    maintenanceUpdated,
  },
}));
await jest.unstable_mockModule("../middleware/errorHandler.js", () => ({
  sendSuccess,
  AppError: class AppError extends Error {
    constructor(message, statusCode, code, details) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.details = details;
    }
  },
}));
await jest.unstable_mockModule("../utils/lifecycleNaming.js", () => ({
  CURRENT_RESIDENT_STATUS_QUERY: ["reserved", "moveIn"],
  hasReservationStatus: jest.fn(),
}));

const {
  getAdminAll,
  getMyRequests,
  createRequest,
  reopenMyRequest,
  sendAdminReply,
  sendTenantReply,
  uploadAdminMaintenanceAttachment,
  updateAdminRequestStatus,
} = await import("./maintenanceController.js");
const {
  resolveMaintenanceRequestBranch,
  resolveMaintenanceRequestStorageBranch,
  resolveUploadBranch,
} = await import("../services/attachmentUploadService.js");

const buildLeanQuery = (result) => ({
  select: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue(result),
  })),
  lean: jest.fn().mockResolvedValue(result),
});

const buildListQuery = (result) => ({
  select: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue(result),
  })),
  sort: jest.fn(() => ({
    limit: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(result),
    })),
  })),
});

const buildSortedLeanQuery = (result) => ({
  sort: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue(result),
  })),
});

const buildSortSelectLeanQuery = (result) => ({
  sort: jest.fn(() => ({
    select: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue(result),
    })),
  })),
});

const buildSortPopulateSelectLeanQuery = (result) => ({
  sort: jest.fn(() => ({
    populate: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(result),
      })),
    })),
  })),
});

const buildSelectLeanQuery = (result) => ({
  select: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue(result),
  })),
});

const buildRequestDoc = (overrides = {}) => {
  const doc = {
    _id: "507f1f77bcf86cd799439011",
    request_id: "maint_a1b2c3d4e5f6",
    user_id: "user_95f39d5b4ea4",
    request_type: "plumbing",
    description: "Faucet leaking in bathroom.",
    urgency: "high",
    status: "pending",
    assigned_to: null,
    notes: null,
    attachments: [],
    conversation: [],
    reopen_note: null,
    reopen_history: [],
    statusHistory: [],
    work_log: [],
    created_at: new Date("2026-04-08T10:30:00.000Z"),
    updated_at: new Date("2026-04-08T10:30:00.000Z"),
    cancelled_at: null,
    reopened_at: null,
    resolved_at: null,
    branch: "gil-puyat",
    roomId: "room_1",
    reservationId: "reservation_1",
    isArchived: false,
    save: jest.fn().mockResolvedValue(undefined),
    toObject() {
      return {
        _id: this._id,
        request_id: this.request_id,
        user_id: this.user_id,
        request_type: this.request_type,
        description: this.description,
        urgency: this.urgency,
        status: this.status,
        assigned_to: this.assigned_to,
        notes: this.notes,
        attachments: this.attachments,
        conversation: this.conversation,
        reopen_note: this.reopen_note,
        reopen_history: this.reopen_history,
        statusHistory: this.statusHistory,
        work_log: this.work_log,
        created_at: this.created_at,
        updated_at: this.updated_at,
        cancelled_at: this.cancelled_at,
        reopened_at: this.reopened_at,
        resolved_at: this.resolved_at,
        branch: this.branch,
        roomId: this.roomId,
        reservationId: this.reservationId,
      };
    },
    ...overrides,
  };

  return doc;
};

describe("maintenanceController", () => {
  beforeEach(() => {
    maintenanceFind.mockReset();
    maintenanceFindOne.mockReset();
    maintenanceSave.mockReset();
    maintenanceSave.mockResolvedValue(undefined);
    userFind.mockReset();
    userFindOne.mockReset();
    reservationFindOne.mockReset();
    roomFindById.mockReset();
    stayFindOne.mockReset();
    bedHistoryFindOne.mockReset();
    chatConversationFindById.mockReset();
    sendSuccess.mockReset();
    maintenanceUpdated.mockReset();
    lastCreatedMaintenanceRequest = null;
  });

  test("getAdminAll applies branch and contract filters", async () => {
    const storedRequest = buildRequestDoc();
    maintenanceFind.mockReturnValue(buildListQuery([storedRequest]));
    userFind.mockReturnValue(
      buildListQuery([
        {
          user_id: "user_95f39d5b4ea4",
          firstName: "Lily",
          lastName: "Tenant",
          email: "lily@example.com",
          phone: "0917",
          branch: "gil-puyat",
          role: "tenant",
        },
      ]),
    );

    const req = {
      query: {
        status: "pending",
        request_type: "plumbing",
        urgency: "high",
        date_from: "2026-04-01",
        date_to: "2026-04-13",
        limit: "20",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await getAdminAll(req, res, next);

    expect(maintenanceFind).toHaveBeenCalledWith(
      expect.objectContaining({
        isArchived: false,
        branch: "gil-puyat",
        status: "pending",
        request_type: "plumbing",
        urgency: "high",
        created_at: expect.objectContaining({
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        }),
      }),
    );
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(sendSuccess.mock.calls[0][1].requests[0].tenant.full_name).toBe("Lily Tenant");
    expect(next).not.toHaveBeenCalled();
  });

  test("resolveUploadBranch uses admin maintenance request context from requestId", async () => {
    const storedRequest = buildRequestDoc({
      branch: "gil-puyat",
      branchId: "gil-puyat",
    });
    userFindOne.mockReturnValue(
      buildSelectLeanQuery({
        _id: "admin_user_1",
        user_id: "admin_1",
        firebaseUid: "admin_firebase_uid",
        role: "branch_admin",
        branch: "gil-puyat",
      }),
    );
    maintenanceFindOne.mockReturnValue(buildLeanQuery(storedRequest));

    const resolution = await resolveUploadBranch({
      user: { uid: "admin_firebase_uid" },
      body: {
        documentType: "maintenance-reply-attachment",
        requestId: storedRequest.request_id,
        relatedId: storedRequest.request_id,
        branchId: "gil-puyat",
      },
      query: {},
      headers: {},
    });

    expect(maintenanceFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([{ request_id: storedRequest.request_id }]),
      }),
    );
    expect(resolution.branch).toBe("gil-puyat");
    expect(resolution.context).toBe("maintenance_reply");
    expect(resolution.relatedId).toBe(storedRequest.request_id);
  });

  test("resolveUploadBranch resolves legacy maintenance request branch from tenant profile", async () => {
    const storedRequest = buildRequestDoc({
      branch: null,
      branchId: null,
      roomId: null,
      reservationId: null,
    });
    userFindOne
      .mockReturnValueOnce(
        buildSelectLeanQuery({
          _id: "admin_user_1",
          user_id: "admin_1",
          firebaseUid: "admin_firebase_uid",
          role: "branch_admin",
          branch: "guadalupe",
        }),
      )
      .mockReturnValueOnce(
        buildSelectLeanQuery({
          _id: "tenant_user_1",
          user_id: storedRequest.user_id,
          role: "tenant",
          branch: "Guadalupe",
        }),
      );
    maintenanceFindOne.mockReturnValue(buildLeanQuery(storedRequest));

    const resolution = await resolveUploadBranch({
      user: { uid: "admin_firebase_uid" },
      body: {
        context: "maintenance_internal_note",
        relatedType: "maintenance_request",
        relatedId: storedRequest.request_id,
      },
      query: {},
      headers: {},
    });

    expect(resolution.branch).toBe("guadalupe");
    expect(resolution.context).toBe("maintenance_internal_note");
    expect(resolution.relatedId).toBe(storedRequest.request_id);
  });

  test("resolveUploadBranch accepts display-name branch values on legacy maintenance requests", async () => {
    const storedRequest = buildRequestDoc({
      branch: "Gil Puyat Branch",
      branchId: null,
      roomId: null,
      reservationId: null,
    });
    userFindOne.mockReturnValue(
      buildSelectLeanQuery({
        _id: "admin_user_1",
        user_id: "admin_1",
        firebaseUid: "admin_firebase_uid",
        role: "branch_admin",
        branch: "Gil Puyat Branch",
      }),
    );
    maintenanceFindOne.mockReturnValue(buildLeanQuery(storedRequest));

    const resolution = await resolveUploadBranch({
      user: { uid: "admin_firebase_uid" },
      body: {
        context: "maintenance_internal_note",
        requestId: storedRequest.request_id,
        relatedId: storedRequest.request_id,
      },
      query: {},
      headers: {},
    });

    expect(resolution.branch).toBe("gil-puyat");
    expect(resolution.context).toBe("maintenance_internal_note");
  });

  test("resolveUploadBranch lets owners use an explicit branch for branchless legacy maintenance requests", async () => {
    const storedRequest = buildRequestDoc({
      branch: null,
      branchId: null,
      roomId: null,
      reservationId: null,
    });
    userFindOne
      .mockReturnValueOnce(
        buildSelectLeanQuery({
          _id: "owner_user_1",
          user_id: "owner_1",
          firebaseUid: "owner_firebase_uid",
          role: "owner",
          branch: "",
        }),
      )
      .mockReturnValueOnce(buildSelectLeanQuery(null));
    maintenanceFindOne.mockReturnValue(buildLeanQuery(storedRequest));

    const resolution = await resolveUploadBranch({
      user: { uid: "owner_firebase_uid" },
      body: {
        context: "maintenance_internal_note",
        requestId: storedRequest.request_id,
        relatedId: storedRequest.request_id,
        branchId: "guadalupe",
      },
      query: {},
      headers: {},
    });

    expect(resolution.branch).toBe("guadalupe");
    expect(resolution.source).toBe("maintenance_request");
  });

  test("resolveUploadBranch supports Mongo id maintenanceRequestId", async () => {
    const storedRequest = buildRequestDoc({
      _id: "507f1f77bcf86cd799439099",
      branch: "gil-puyat",
    });
    userFindOne.mockReturnValue(
      buildSelectLeanQuery({
        _id: "owner_user_1",
        user_id: "owner_1",
        firebaseUid: "owner_firebase_uid",
        role: "owner",
        branch: "",
      }),
    );
    maintenanceFindOne.mockReturnValue(buildLeanQuery(storedRequest));

    const resolution = await resolveUploadBranch({
      user: { uid: "owner_firebase_uid" },
      body: {
        context: "maintenance_reply",
        maintenanceRequestId: storedRequest._id,
        requestId: storedRequest.request_id,
        relatedId: storedRequest._id,
      },
      query: {},
      headers: {},
    });

    expect(maintenanceFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { _id: storedRequest._id },
          { request_id: storedRequest._id },
        ]),
      }),
    );
    expect(resolution.branch).toBe("gil-puyat");
  });

  test("resolveUploadBranch falls back from missing Mongo id to custom request code", async () => {
    const storedRequest = buildRequestDoc({
      branch: "gil-puyat",
    });
    userFindOne.mockReturnValue(
      buildSelectLeanQuery({
        _id: "owner_user_1",
        user_id: "owner_1",
        firebaseUid: "owner_firebase_uid",
        role: "owner",
        branch: "",
      }),
    );
    maintenanceFindOne
      .mockReturnValueOnce(buildLeanQuery(null))
      .mockReturnValueOnce(buildLeanQuery(storedRequest));

    const resolution = await resolveUploadBranch({
      user: { uid: "owner_firebase_uid" },
      body: {
        context: "maintenance_reply",
        maintenanceRequestId: "507f1f77bcf86cd799439000",
        requestId: storedRequest.request_id,
        relatedId: storedRequest.request_id,
      },
      query: {},
      headers: {},
    });

    expect(maintenanceFindOne).toHaveBeenCalledTimes(2);
    expect(maintenanceFindOne.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        $or: expect.arrayContaining([{ request_id: storedRequest.request_id }]),
      }),
    );
    expect(resolution.branch).toBe("gil-puyat");
  });

  test("resolveUploadBranch rejects mismatched branchId for a maintenance request", async () => {
    const storedRequest = buildRequestDoc({
      branch: "gil-puyat",
      branchId: "gil-puyat",
    });
    userFindOne.mockReturnValue(
      buildSelectLeanQuery({
        _id: "admin_user_1",
        user_id: "admin_1",
        firebaseUid: "admin_firebase_uid",
        role: "branch_admin",
        branch: "gil-puyat",
      }),
    );
    maintenanceFindOne.mockReturnValue(buildLeanQuery(storedRequest));

    await expect(
      resolveUploadBranch({
        user: { uid: "admin_firebase_uid" },
        body: {
          context: "maintenance_internal_note",
          maintenanceRequestId: storedRequest.request_id,
          relatedId: storedRequest.request_id,
          branchId: "guadalupe",
        },
        query: {},
        headers: {},
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "UPLOAD_BRANCH_FORBIDDEN",
    });
  });

  test("resolveMaintenanceRequestBranch only derives branch from the maintenance request record", () => {
    expect(resolveMaintenanceRequestBranch({ branch: "Gil Puyat Branch" })).toBe("gil-puyat");
    expect(resolveMaintenanceRequestBranch({ branchId: "guadalupe" })).toBe("guadalupe");
    expect(resolveMaintenanceRequestBranch({ tenant: { branch: "gil-puyat" } })).toBe("");
  });

  test("resolveMaintenanceRequestStorageBranch resolves legacy request branch from tenant profile", async () => {
    const storedRequest = buildRequestDoc({
      branch: null,
      branchId: null,
      roomId: null,
      reservationId: null,
    });
    userFindOne.mockReturnValue(
      buildSelectLeanQuery({
        _id: "tenant_user_1",
        user_id: storedRequest.user_id,
        role: "tenant",
        branch: "Gil Puyat Branch",
      }),
    );

    const resolution = await resolveMaintenanceRequestStorageBranch(storedRequest);

    expect(userFindOne).toHaveBeenCalledWith({ user_id: storedRequest.user_id });
    expect(resolution).toEqual(
      expect.objectContaining({
        branch: "gil-puyat",
        source: "maintenance_tenant",
      }),
    );
  });

  test("getAdminAll exposes remote attachment URL aliases", async () => {
    const storedRequest = buildRequestDoc({
      attachments: [
        {
          fileName: "leak-photo.jpg",
          downloadUrl: "https://storage.example.com/maintenance/leak-photo.jpg?token=abc",
          contentType: "image/jpeg",
        },
        {
          name: "device-only.jpg",
          uri: "file:///local/device/photo.jpg",
          type: "image/jpeg",
        },
      ],
      work_log: [
        {
          logged_at: new Date("2026-04-09T10:30:00.000Z"),
          note: "Added progress photo",
          attachments: [
            {
              originalName: "repair.pdf",
              secure_url: "https://cdn.example.com/maintenance/repair.pdf",
            },
          ],
        },
      ],
    });
    maintenanceFind.mockReturnValue(buildListQuery([storedRequest]));
    userFind.mockReturnValue(buildListQuery([]));

    const req = {
      query: {},
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await getAdminAll(req, res, next);

    const request = sendSuccess.mock.calls[0][1].requests[0];
    expect(request.attachments).toEqual([
      expect.objectContaining({
        name: "leak-photo.jpg",
        uri: "https://storage.example.com/maintenance/leak-photo.jpg?token=abc",
        type: "image/jpeg",
        url: "https://storage.example.com/maintenance/leak-photo.jpg?token=abc",
        filename: "leak-photo.jpg",
        mimeType: "image/jpeg",
        fileType: "image",
      }),
      expect.objectContaining({
        name: "device-only.jpg",
        uri: null,
        type: "image/jpeg",
        url: null,
        filename: "device-only.jpg",
        mimeType: "image/jpeg",
        fileType: "image",
      }),
    ]);
    expect(request.workLog[0].attachments).toEqual([
      expect.objectContaining({
        name: "repair.pdf",
        uri: "https://cdn.example.com/maintenance/repair.pdf",
        type: "application/pdf",
        url: "https://cdn.example.com/maintenance/repair.pdf",
        filename: "repair.pdf",
        mimeType: "application/pdf",
        fileType: "pdf",
      }),
    ]);
    expect(next).not.toHaveBeenCalled();
  });

  test("getMyRequests hides internal progress fields from tenants", async () => {
    const storedRequest = buildRequestDoc({
      notes: "Internal resolution note",
      statusHistory: [
        {
          event: "note_updated",
          status: "pending",
          actor_role: "branch_admin",
          actor_name: "Branch Admin",
          note: "Internal status note",
          timestamp: new Date("2026-04-09T10:30:00.000Z"),
        },
      ],
      work_log: [
        {
          logged_at: new Date("2026-04-09T10:30:00.000Z"),
          note: "Internal work log",
          attachments: [
            {
              name: "internal.jpg",
              uri: "https://storage.example.com/maintenance/internal.jpg",
              type: "image/jpeg",
            },
          ],
        },
      ],
    });
    maintenanceFind.mockReturnValue(buildListQuery([storedRequest]));
    userFindOne.mockImplementation(({ firebaseUid }) =>
      buildLeanQuery(
        firebaseUid === "firebase-tenant-1"
          ? {
              _id: "tenant_user_1",
              user_id: "user_95f39d5b4ea4",
              firstName: "Lily",
              lastName: "Tenant",
              email: "lily@example.com",
              phone: "0917",
              branch: "gil-puyat",
              role: "tenant",
            }
          : null,
      ),
    );

    const req = {
      user: { uid: "firebase-tenant-1" },
      query: {},
    };
    const res = {};
    const next = jest.fn();

    await getMyRequests(req, res, next);

    const request = sendSuccess.mock.calls[0][1].requests[0];
    expect(request.notes).toBeNull();
    expect(request.workLog).toEqual([]);
    expect(request.resolutionNote).toBeNull();
    expect(request.completionNote).toBeNull();
    expect(request.statusHistory[0].note).toBeNull();
    expect(next).not.toHaveBeenCalled();
  });

  test("getMyRequests filters admin-only attachments from tenant-visible conversation", async () => {
    const storedRequest = buildRequestDoc({
      conversation: [
        {
          message: "Internal photo should not leak.",
          sender_side: "admin",
          created_at: new Date("2026-04-09T10:30:00.000Z"),
          attachments: [
            {
              name: "internal.jpg",
              uri: "https://storage.example.com/maintenance/internal.jpg",
              type: "image/jpeg",
              visibility: "admin_only",
            },
            {
              name: "tenant-visible.jpg",
              uri: "https://storage.example.com/maintenance/tenant-visible.jpg",
              type: "image/jpeg",
              visibility: "tenant_admin",
            },
          ],
        },
      ],
    });
    maintenanceFind.mockReturnValue(buildListQuery([storedRequest]));
    userFindOne.mockReturnValue(
      buildLeanQuery({
        _id: "tenant_user_1",
        user_id: "user_95f39d5b4ea4",
        firstName: "Lily",
        lastName: "Tenant",
        email: "lily@example.com",
        phone: "0917",
        branch: "gil-puyat",
        role: "tenant",
      }),
    );

    const req = {
      user: { uid: "firebase-tenant-1" },
      query: {},
    };
    const res = {};
    const next = jest.fn();

    await getMyRequests(req, res, next);

    const request = sendSuccess.mock.calls[0][1].requests[0];
    expect(request.conversation[0].attachments).toHaveLength(1);
    expect(request.conversation[0].attachments[0].name).toBe("tenant-visible.jpg");
    expect(next).not.toHaveBeenCalled();
  });

  test("createRequest resolves missing reservation branch from assigned room and stamps attachments", async () => {
    maintenanceFindOne.mockReturnValue(buildSortedLeanQuery(null));
    userFindOne.mockReturnValue(
      buildLeanQuery({
        _id: "tenant_user_1",
        user_id: "user_95f39d5b4ea4",
        firstName: "Lily",
        lastName: "Tenant",
        email: "lily@example.com",
        phone: "0917",
        branch: "",
        role: "tenant",
      }),
    );
    stayFindOne.mockReturnValue(buildSortSelectLeanQuery(null));
    reservationFindOne.mockReturnValue(
      buildSortPopulateSelectLeanQuery({
        _id: "reservation_1",
        roomId: "room_1",
      }),
    );
    roomFindById.mockReturnValue(buildSelectLeanQuery({ branch: "guadalupe" }));

    const req = {
      user: { uid: "firebase-tenant-1" },
      body: {
        request_type: "plumbing",
        description: "Bathroom faucet is leaking heavily.",
        urgency: "normal",
        attachments: [
          {
            name: "leak.jpg",
            uri: "https://storage.example.com/maintenance/leak.jpg",
            type: "image/jpeg",
          },
        ],
      },
    };
    const res = {};
    const next = jest.fn();

    await createRequest(req, res, next);

    expect(lastCreatedMaintenanceRequest.branch).toBe("guadalupe");
    expect(lastCreatedMaintenanceRequest.reservationId).toBe("reservation_1");
    expect(lastCreatedMaintenanceRequest.roomId).toBe("room_1");
    expect(lastCreatedMaintenanceRequest.attachments[0]).toEqual(
      expect.objectContaining({
        name: "leak.jpg",
        branchId: "guadalupe",
        context: "maintenance_request",
        visibility: "tenant_admin",
        uploadedBy: "user_95f39d5b4ea4",
        senderRole: "tenant",
        relatedId: expect.stringMatching(/^maint_/),
      }),
    );
    expect(maintenanceSave).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("createRequest returns a friendly branch error when branch cannot be resolved", async () => {
    maintenanceFindOne.mockReturnValue(buildSortedLeanQuery(null));
    userFindOne.mockReturnValue(
      buildLeanQuery({
        _id: "tenant_user_1",
        user_id: "user_95f39d5b4ea4",
        firstName: "Lily",
        lastName: "Tenant",
        email: "lily@example.com",
        phone: "0917",
        branch: "",
        role: "tenant",
      }),
    );
    stayFindOne.mockReturnValue(buildSortSelectLeanQuery(null));
    reservationFindOne.mockReturnValue(buildSortPopulateSelectLeanQuery(null));
    bedHistoryFindOne.mockReturnValue(buildSortSelectLeanQuery(null));

    const req = {
      user: { uid: "firebase-tenant-1" },
      body: {
        request_type: "plumbing",
        description: "Bathroom faucet is leaking heavily.",
        urgency: "normal",
      },
    };
    const res = {};
    const next = jest.fn();

    await createRequest(req, res, next);

    expect(maintenanceSave).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe("UPLOAD_BRANCH_UNRESOLVED");
    expect(next.mock.calls[0][0].message).toBe(
      "Unable to determine the assigned branch for this upload. Please refresh and try again or contact support.",
    );
  });

  test("updateAdminRequestStatus updates a request and notifies the tenant on status change", async () => {
    const requestDoc = buildRequestDoc();
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation(({ firebaseUid, user_id }) => {
      if (firebaseUid === "firebase-admin-1") {
        return buildLeanQuery({
          _id: "admin_user_1",
          user_id: "admin_1",
          firstName: "Branch",
          lastName: "Admin",
          email: "admin@example.com",
          phone: "0918",
          branch: "gil-puyat",
          role: "branch_admin",
        });
      }

      if (user_id === "user_95f39d5b4ea4") {
        return buildLeanQuery({
          _id: "mongo_user_1",
          user_id: "user_95f39d5b4ea4",
          firstName: "Lily",
          lastName: "Tenant",
          email: "lily@example.com",
          phone: "0917",
          branch: "gil-puyat",
          role: "tenant",
        });
      }

      return buildLeanQuery(null);
    });

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        status: "viewed",
        notes: "Plumber scheduled for tomorrow",
        assigned_to: "Juan (Maintenance)",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await updateAdminRequestStatus(req, res, next);

    expect(requestDoc.status).toBe("viewed");
    expect(requestDoc.notes).toBe("Plumber scheduled for tomorrow");
    expect(requestDoc.assigned_to).toBe("Juan (Maintenance)");
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(maintenanceUpdated).toHaveBeenCalledWith(
      "mongo_user_1",
      "plumbing",
      "viewed",
      requestDoc.request_id,
      {
        statusChanged: true,
        hasAdminNote: true,
        hasProgressEntry: false,
        hasProgressAttachments: false,
      },
    );
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("updateAdminRequestStatus saves progress attachments without changing the request status", async () => {
    const requestDoc = buildRequestDoc({ status: "pending", work_log: [] });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation(({ firebaseUid, user_id }) => {
      if (firebaseUid === "firebase-admin-1") {
        return buildLeanQuery({
          _id: "admin_user_1",
          user_id: "admin_1",
          firstName: "Branch",
          lastName: "Admin",
          email: "admin@example.com",
          phone: "0918",
          branch: "gil-puyat",
          role: "branch_admin",
        });
      }

      if (user_id === "user_95f39d5b4ea4") {
        return buildLeanQuery({
          _id: "mongo_user_1",
          user_id: "user_95f39d5b4ea4",
          firstName: "Lily",
          lastName: "Tenant",
          email: "lily@example.com",
          phone: "0917",
          branch: "gil-puyat",
          role: "tenant",
        });
      }

      return buildLeanQuery(null);
    });

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        status: "pending",
        notes: "",
        assigned_to: "",
        work_log_attachments: [
          {
            name: "progress.jpg",
            uri: "https://storage.example.com/maintenance/progress.jpg",
            type: "image/jpeg",
          },
        ],
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await updateAdminRequestStatus(req, res, next);

    expect(requestDoc.status).toBe("pending");
    expect(requestDoc.work_log).toHaveLength(1);
    expect(requestDoc.work_log[0]).toEqual(
      expect.objectContaining({
        note: "Progress attachment added.",
        attachments: [
          expect.objectContaining({
            name: "progress.jpg",
            uri: "https://storage.example.com/maintenance/progress.jpg",
            type: "image/jpeg",
            url: "https://storage.example.com/maintenance/progress.jpg",
            filename: "progress.jpg",
            mimeType: "image/jpeg",
            fileType: "image",
            context: "maintenance_internal_note",
            visibility: "admin_only",
            branchId: "gil-puyat",
            uploadedBy: "admin_1",
            senderRole: "branch_admin",
            relatedId: requestDoc.request_id,
          }),
        ],
      }),
    );
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(maintenanceUpdated).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("updateAdminRequestStatus rejects invalid transitions", async () => {
    const requestDoc = buildRequestDoc({ status: "pending" });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation(({ firebaseUid }) =>
      buildLeanQuery(
        firebaseUid === "firebase-admin-1"
          ? {
              _id: "admin_user_1",
              user_id: "admin_1",
              firstName: "Branch",
              lastName: "Admin",
              email: "admin@example.com",
              phone: "0918",
              branch: "gil-puyat",
              role: "branch_admin",
            }
          : null,
      ),
    );

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: { status: "completed" },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await updateAdminRequestStatus(req, res, next);

    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(maintenanceUpdated).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("updateAdminRequestStatus saves same-status internal progress without tenant reply notification", async () => {
    const requestDoc = buildRequestDoc({ status: "pending" });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation(({ firebaseUid, user_id }) => {
      if (firebaseUid === "firebase-admin-1") {
        return buildLeanQuery({
          _id: "admin_user_1",
          user_id: "admin_1",
          firstName: "Branch",
          lastName: "Admin",
          email: "admin@example.com",
          phone: "0918",
          branch: "gil-puyat",
          role: "branch_admin",
        });
      }

      if (user_id === "user_95f39d5b4ea4") {
        return buildLeanQuery({
          _id: "mongo_user_1",
          user_id: "user_95f39d5b4ea4",
          firstName: "Lily",
          lastName: "Tenant",
          email: "lily@example.com",
          phone: "0917",
          branch: "gil-puyat",
          role: "tenant",
        });
      }

      return buildLeanQuery(null);
    });

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        status: "pending",
        notes: "Queued for morning inspection",
        assigned_to: "Morning team",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await updateAdminRequestStatus(req, res, next);

    expect(requestDoc.status).toBe("pending");
    expect(requestDoc.notes).toBe("Queued for morning inspection");
    expect(requestDoc.assigned_to).toBe("Morning team");
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(maintenanceUpdated).not.toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("updateAdminRequestStatus requires assignment before in progress", async () => {
    const requestDoc = buildRequestDoc({ status: "pending" });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation(({ firebaseUid }) =>
      buildLeanQuery(
        firebaseUid === "firebase-admin-1"
          ? {
              _id: "admin_user_1",
              user_id: "admin_1",
              firstName: "Branch",
              lastName: "Admin",
              email: "admin@example.com",
              phone: "0918",
              branch: "gil-puyat",
              role: "branch_admin",
            }
          : null,
      ),
    );

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        status: "in_progress",
        assigned_to: "",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await updateAdminRequestStatus(req, res, next);

    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe("ASSIGNEE_REQUIRED");
    expect(next.mock.calls[0][0].details[0].field).toBe("assigned_to");
  });

  test("sendAdminReply stores tenant-facing message attachments and notifies tenant", async () => {
    const requestDoc = buildRequestDoc({ conversation: [] });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation(({ firebaseUid, user_id }) => {
      if (firebaseUid === "firebase-admin-1") {
        return buildLeanQuery({
          _id: "admin_user_1",
          user_id: "admin_1",
          firstName: "Dormitory",
          lastName: "Owner",
          email: "owner@example.com",
          phone: "0918",
          branch: "gil-puyat",
          role: "owner",
        });
      }

      if (user_id === "user_95f39d5b4ea4") {
        return buildLeanQuery({
          _id: "mongo_user_1",
          user_id: "user_95f39d5b4ea4",
          firstName: "Lily",
          lastName: "Tenant",
          email: "lily@example.com",
          phone: "0917",
          branch: "gil-puyat",
          role: "tenant",
        });
      }

      return buildLeanQuery(null);
    });

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        message: "We uploaded the repair progress photo.",
        attachments: [
          {
            url: "https://storage.example.com/maintenance/progress.jpg",
            filename: "progress.jpg",
            originalName: "progress.jpg",
            mimeType: "image/jpeg",
            fileType: "image",
            size: 123456,
          },
        ],
      },
      branchFilter: "gil-puyat",
      isOwner: true,
    };
    const res = {};
    const next = jest.fn();

    await sendAdminReply(req, res, next);

    expect(requestDoc.conversation).toHaveLength(1);
    expect(requestDoc.conversation[0]).toEqual(
      expect.objectContaining({
        message: "We uploaded the repair progress photo.",
        sender_id: "admin_1",
        sender_name: "Dormitory Owner",
        sender_role: "owner",
        sender_side: "admin",
        attachments: [
          expect.objectContaining({
            name: "progress.jpg",
            uri: "https://storage.example.com/maintenance/progress.jpg",
            type: "image/jpeg",
            url: "https://storage.example.com/maintenance/progress.jpg",
            filename: "progress.jpg",
            originalName: "progress.jpg",
            mimeType: "image/jpeg",
            fileType: "image",
            size: 123456,
            context: "maintenance_reply",
            visibility: "tenant_admin",
            branchId: "gil-puyat",
            uploadedBy: "admin_1",
            senderRole: "owner",
            relatedId: requestDoc.request_id,
          }),
        ],
      }),
    );
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(maintenanceUpdated).toHaveBeenCalledWith(
      "mongo_user_1",
      "plumbing",
      "pending",
      requestDoc.request_id,
      {
        statusChanged: false,
        hasAdminNote: true,
        hasProgressEntry: false,
        hasProgressAttachments: false,
      },
    );
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("sendAdminReply requires a message or attachment", async () => {
    const requestDoc = buildRequestDoc({ conversation: [] });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation(({ firebaseUid }) =>
      buildLeanQuery(
        firebaseUid === "firebase-admin-1"
          ? {
              _id: "admin_user_1",
              user_id: "admin_1",
              firstName: "Branch",
              lastName: "Admin",
              email: "admin@example.com",
              phone: "0918",
              branch: "gil-puyat",
              role: "branch_admin",
            }
          : null,
      ),
    );

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        message: "",
        reply_attachments: [],
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await sendAdminReply(req, res, next);

    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe("REPLY_REQUIRED");
    expect(next.mock.calls[0][0].details[0].field).toBe("message");
  });

  test("uploadAdminMaintenanceAttachment returns clear error when request has no branch", async () => {
    const requestDoc = buildRequestDoc({
      branch: null,
      branchId: null,
      roomId: null,
      reservationId: null,
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockReturnValue(buildSelectLeanQuery(null));

    const req = {
      params: { requestId: requestDoc.request_id },
      body: { maintenanceRequestId: requestDoc.request_id, visibility: "tenant_visible" },
      user: { uid: "admin-firebase-1" },
      isOwner: true,
      branchFilter: null,
    };
    const res = {};
    const next = jest.fn();

    await uploadAdminMaintenanceAttachment(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Maintenance request has no branch assigned.",
        statusCode: 400,
        code: "MAINTENANCE_REQUEST_BRANCH_REQUIRED",
      }),
    );
    expect(sendSuccess).not.toHaveBeenCalled();
  });

  test("sendAdminReply denies branch admin access to another branch request", async () => {
    const requestDoc = buildRequestDoc({ branch: "guadalupe", conversation: [] });
    maintenanceFindOne.mockResolvedValue(requestDoc);

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        message: "Cross-branch reply",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await sendAdminReply(req, res, next);

    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe("FORBIDDEN");
  });

  test("sendTenantReply stores tenant-visible attachment metadata from maintenance request branch", async () => {
    const requestDoc = buildRequestDoc({ conversation: [] });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockReturnValue(
      buildLeanQuery({
        _id: "mongo_user_1",
        user_id: "user_95f39d5b4ea4",
        firstName: "Lily",
        lastName: "Tenant",
        email: "lily@example.com",
        phone: "0917",
        branch: "gil-puyat",
        role: "tenant",
      }),
    );

    const req = {
      user: { uid: "firebase-tenant-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        message: "",
        attachments: [
          {
            name: "follow-up.jpg",
            uri: "https://storage.example.com/maintenance/follow-up.jpg",
            type: "image/jpeg",
          },
        ],
      },
    };
    const res = {};
    const next = jest.fn();

    await sendTenantReply(req, res, next);

    expect(requestDoc.conversation).toHaveLength(1);
    expect(requestDoc.conversation[0]).toEqual(
      expect.objectContaining({
        sender_side: "tenant",
        sender_role: "tenant",
        attachments: [
          expect.objectContaining({
            name: "follow-up.jpg",
            branchId: "gil-puyat",
            context: "maintenance_reply",
            visibility: "tenant_admin",
            uploadedBy: "user_95f39d5b4ea4",
            senderRole: "tenant",
            relatedId: requestDoc.request_id,
          }),
        ],
      }),
    );
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("reopenMyRequest returns resolved work to pending and records reopen history", async () => {
    const requestDoc = buildRequestDoc({
      status: "completed",
      resolved_at: new Date("2026-04-10T08:00:00.000Z"),
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockReturnValue(
      buildLeanQuery({
        _id: "mongo_user_1",
        user_id: "user_95f39d5b4ea4",
        firstName: "Lily",
        lastName: "Tenant",
        email: "lily@example.com",
        phone: "0917",
        branch: "gil-puyat",
        role: "tenant",
      }),
    );

    const req = {
      user: { uid: "firebase_uid_1" },
      params: { requestId: requestDoc.request_id },
      body: { note: "Still leaking" },
    };
    const res = {};
    const next = jest.fn();

    await reopenMyRequest(req, res, next);

    expect(requestDoc.status).toBe("pending");
    expect(requestDoc.reopen_note).toBe("Still leaking");
    expect(requestDoc.reopen_history).toHaveLength(1);
    expect(requestDoc.reopen_history[0]).toEqual(
      expect.objectContaining({
        previous_status: "completed",
        note: "Still leaking",
      }),
    );
    expect(requestDoc.resolved_at).toBeNull();
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });
});
