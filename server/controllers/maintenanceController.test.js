import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const maintenanceFind = jest.fn();
const maintenanceFindOne = jest.fn();
const maintenanceSave = jest.fn();
const userFind = jest.fn();
const userFindOne = jest.fn();
const reservationFind = jest.fn();
const reservationFindOne = jest.fn();
const roomFindById = jest.fn();
const stayFindOne = jest.fn();
const bedHistoryFindOne = jest.fn();
const chatConversationFindById = jest.fn();
const serviceProviderFind = jest.fn();
const serviceProviderFindById = jest.fn();
const serviceProviderCreate = jest.fn();
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
    find: reservationFind,
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
  ServiceProvider: {
    find: serviceProviderFind,
    findById: serviceProviderFindById,
    create: serviceProviderCreate,
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
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: {
    log: jest.fn().mockResolvedValue(undefined),
    logModification: jest.fn().mockResolvedValue(undefined),
    logDeletion: jest.fn().mockResolvedValue(undefined),
    logError: jest.fn().mockResolvedValue(undefined),
  },
}));

const {
  getAdminAll,
  getAdminMaintenanceAnalytics,
  getAdminMaintenanceBranchReport,
  getAdminMaintenanceProviderReport,
  getMyRequests,
  createRequest,
  reopenMyRequest,
  sendAdminReply,
  assignAdminMaintenanceBranch,
  assignAdminMaintenanceProvider,
  suggestAdminMaintenanceProvider,
  generateAdminMaintenanceReport,
  sendAdminTenantSummary,
  sendTenantReply,
  uploadAdminMaintenanceAttachment,
  removeAdminMaintenanceAttachment,
  updateAdminRequestStatus,
  confirmResolution,
  requestMaintenanceReschedule,
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

const buildListQuery = (result) => {
  const query = {};
  query.populate = jest.fn(() => query);
  query.select = jest.fn(() => query);
  query.sort = jest.fn(() => query);
  query.limit = jest.fn(() => query);
  query.lean = jest.fn().mockResolvedValue(result);
  return query;
};

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
    assignedProviderId: null,
    assignedProviderName: null,
    assignedProviderContact: null,
    assignedProviderCategory: null,
    assignedProviderNotes: null,
    assignedProviderSource: null,
    assignedBy: null,
    assignedByName: null,
    assignedByRole: null,
    notes: null,
    attachments: [],
    conversation: [],
    publicReplies: [],
    tenantReplies: [],
    reopen_note: null,
    reopen_history: [],
    statusHistory: [],
    work_log: [],
    created_at: new Date("2026-04-08T10:30:00.000Z"),
    updated_at: new Date("2026-04-08T10:30:00.000Z"),
    cancelled_at: null,
    reopened_at: null,
    resolved_at: null,
    closed_at: null,
    work_started_at: null,
    resolution_note: null,
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
        assignedProviderId: this.assignedProviderId,
        assignedProviderName: this.assignedProviderName,
        assignedProviderContact: this.assignedProviderContact,
        assignedProviderCategory: this.assignedProviderCategory,
        assignedProviderNotes: this.assignedProviderNotes,
        assignedProviderSource: this.assignedProviderSource,
        assignedBy: this.assignedBy,
        assignedByName: this.assignedByName,
        assignedByRole: this.assignedByRole,
        notes: this.notes,
        attachments: this.attachments,
        conversation: this.conversation,
        publicReplies: this.publicReplies,
        tenantReplies: this.tenantReplies,
        reopen_note: this.reopen_note,
        reopen_history: this.reopen_history,
        statusHistory: this.statusHistory,
        work_log: this.work_log,
        created_at: this.created_at,
        updated_at: this.updated_at,
        cancelled_at: this.cancelled_at,
        reopened_at: this.reopened_at,
        resolved_at: this.resolved_at,
        closed_at: this.closed_at,
        work_started_at: this.work_started_at,
        resolution_note: this.resolution_note,
        branch: this.branch,
        roomId: this.roomId,
        reservationId: this.reservationId,
        isArchived: this.isArchived,
        archivedAt: this.archivedAt,
        archivedBy: this.archivedBy,
        restoredAt: this.restoredAt,
        restoredBy: this.restoredBy,
      };
    },
    ...overrides,
  };

  return doc;
};

const withoutGeminiEnv = async (callback) => {
  const previous = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  };

  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.GEMINI_MODEL;

  try {
    await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

describe("maintenanceController", () => {
  beforeEach(() => {
    maintenanceFind.mockReset();
    maintenanceFindOne.mockReset();
    maintenanceSave.mockReset();
    maintenanceSave.mockResolvedValue(undefined);
    userFind.mockReset();
    userFindOne.mockReset();
    reservationFind.mockReset();
    reservationFind.mockReturnValue(buildListQuery([]));
    reservationFindOne.mockReset();
    roomFindById.mockReset();
    stayFindOne.mockReset();
    bedHistoryFindOne.mockReset();
    chatConversationFindById.mockReset();
    serviceProviderFind.mockReset();
    serviceProviderFindById.mockReset();
    serviceProviderCreate.mockReset();
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
        source: "maintenance_tenant_profile",
      }),
    );
  });

  test("resolveMaintenanceRequestStorageBranch resolves legacy request branch from active stay room", async () => {
    const storedRequest = buildRequestDoc({
      branch: null,
      branchId: null,
      roomId: null,
      reservationId: null,
    });
    userFindOne.mockReturnValue(
      buildSelectLeanQuery({
        _id: "507f1f77bcf86cd799439021",
        user_id: storedRequest.user_id,
        role: "tenant",
        branch: "",
      }),
    );
    stayFindOne.mockReturnValue(
      buildSortSelectLeanQuery({
        branch: "",
        roomId: "room_legacy_1",
        reservationId: "reservation_legacy_1",
      }),
    );
    roomFindById.mockReturnValue(
      buildSelectLeanQuery({
        _id: "room_legacy_1",
        branch: "Guadalupe",
      }),
    );

    const resolution = await resolveMaintenanceRequestStorageBranch(storedRequest);

    expect(resolution).toEqual(
      expect.objectContaining({
        branch: "guadalupe",
        source: "maintenance_active_stay",
        roomId: "room_legacy_1",
        reservationId: "reservation_legacy_1",
      }),
    );
  });

  test("resolveMaintenanceRequestStorageBranch does not use manual fallback branches", async () => {
    const storedRequest = buildRequestDoc({
      branch: null,
      branchId: null,
      roomId: null,
      reservationId: null,
    });
    userFindOne.mockReturnValue(buildSelectLeanQuery(null));

    const resolution = await resolveMaintenanceRequestStorageBranch(storedRequest, {
      fallbackBranch: "Guadalupe",
    });

    expect(resolution).toEqual(
      expect.objectContaining({
        branch: "",
        source: "unresolved",
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
    expect(request.statusHistory).toEqual([]);
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

  test("getMyRequests hides request-scope removed attachments from tenants", async () => {
    const storedRequest = buildRequestDoc({
      attachments: [
        {
          name: "initial-removed.jpg",
          uri: "https://storage.example.com/maintenance/initial-removed.jpg",
          type: "image/jpeg",
          isRemoved: true,
          removedScope: "request",
          removedReason: "Wrong file attached",
        },
        {
          name: "initial-active.jpg",
          uri: "https://storage.example.com/maintenance/initial-active.jpg",
          type: "image/jpeg",
        },
      ],
      conversation: [
        {
          message: "Here are the repair photos.",
          sender_side: "admin",
          created_at: new Date("2026-04-09T10:30:00.000Z"),
          attachments: [
            {
              name: "tenant-removed.jpg",
              uri: "https://storage.example.com/maintenance/tenant-removed.jpg",
              type: "image/jpeg",
              isRemoved: true,
              removedScope: "tenant_only",
              removedReason: "Sensitive information visible",
            },
            {
              name: "request-removed.jpg",
              uri: "https://storage.example.com/maintenance/request-removed.jpg",
              type: "image/jpeg",
              isRemoved: true,
              removedScope: "request",
              removedReason: "Attached to the wrong request",
            },
            {
              name: "tenant-active.jpg",
              uri: "https://storage.example.com/maintenance/tenant-active.jpg",
              type: "image/jpeg",
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
    expect(request.attachments).toHaveLength(1);
    expect(request.attachments[0].name).toBe("initial-active.jpg");
    expect(request.conversation[0].attachments).toHaveLength(1);
    expect(request.conversation[0].attachments[0].name).toBe("tenant-active.jpg");
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

  test("updateAdminRequestStatus allows transition from resolved to completed without requiring extra notes", async () => {
    const requestDoc = buildRequestDoc({
      status: "resolved",
      resolution_note: "Technician fixed the leaking faucet and tested drainage.",
      resolved_at: new Date("2026-08-17T10:00:00Z"),
    });
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
      return buildLeanQuery(null);
    });

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

    expect(requestDoc.status).toBe("completed");
    expect(requestDoc.resolution_note).toBe("Technician fixed the leaking faucet and tested drainage.");
    expect(requestDoc.closed_at).toBeDefined();
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledTimes(1);
  });

  test("updateAdminRequestStatus rejects transition to resolved from in_progress when no resolution notes exist", async () => {
    const requestDoc = buildRequestDoc({
      status: "in_progress",
      assigned_to: "Technician",
      resolution_note: null,
      notes: null,
      work_log: [],
    });
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
      body: { status: "resolved" },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await updateAdminRequestStatus(req, res, next);

    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe("RESOLUTION_NOTE_REQUIRED");
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
    expect(requestDoc.publicReplies).toHaveLength(1);
    expect(requestDoc.tenantReplies).toHaveLength(1);
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
    const responseRequest = sendSuccess.mock.calls[0][1].request;
    expect(responseRequest.thread).toHaveLength(1);
    expect(responseRequest.thread[0]).toEqual(
      expect.objectContaining({
        message: "We uploaded the repair progress photo.",
        type: "admin_reply",
        senderRole: "owner",
        sentAt: expect.any(Date),
        attachments: [
          expect.objectContaining({
            name: "progress.jpg",
            url: "https://storage.example.com/maintenance/progress.jpg",
            downloadUrl: "https://storage.example.com/maintenance/progress.jpg",
            mimeType: "image/jpeg",
            size: 123456,
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

  test("removeAdminMaintenanceAttachment requires a removal reason", async () => {
    const requestDoc = buildRequestDoc({
      attachments: [
        {
          id: "attachment_1",
          name: "wrong-photo.jpg",
          uri: "https://storage.example.com/wrong-photo.jpg",
          type: "image/jpeg",
        },
      ],
      markModified: jest.fn(),
    });
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
        source: "request",
        attachmentIndex: 0,
        scope: "tenant_only",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await removeAdminMaintenanceAttachment(req, res, next);

    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(requestDoc.attachments[0].isRemoved).toBeUndefined();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "REMOVAL_REASON_REQUIRED",
        statusCode: 400,
      }),
    );
  });

  test("removeAdminMaintenanceAttachment logs request-scope removals", async () => {
    const markModified = jest.fn();
    const requestDoc = buildRequestDoc({
      conversation: [
        {
          message: "Photo attached.",
          sender_side: "admin",
          created_at: new Date("2026-04-09T10:30:00.000Z"),
          attachments: [
            {
              id: "attachment_1",
              name: "wrong-request.jpg",
              uri: "https://storage.example.com/wrong-request.jpg",
              type: "image/jpeg",
            },
          ],
        },
      ],
      statusHistory: [],
      markModified,
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation((query) => {
      if (query.firebaseUid === "firebase-admin-1") {
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

      if (query.user_id === requestDoc.user_id) {
        return buildLeanQuery({
          _id: "tenant_user_1",
          user_id: requestDoc.user_id,
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
        source: "conversation",
        entryIndex: 0,
        attachmentIndex: 0,
        scope: "request",
        removedReason: "Attached to the wrong request",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await removeAdminMaintenanceAttachment(req, res, next);

    const attachment = requestDoc.conversation[0].attachments[0];
    expect(attachment.isRemoved).toBe(true);
    expect(attachment.removedScope).toBe("request");
    expect(attachment.removedReason).toBe("Attached to the wrong request");
    expect(requestDoc.statusHistory).toEqual([
      expect.objectContaining({
        event: "attachment_removed_request",
        note: "Attached to the wrong request",
        removedScope: "request",
        source: "conversation",
        attachmentName: "wrong-request.jpg",
      }),
    ]);
    expect(markModified).toHaveBeenCalledWith("conversation");
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("assignAdminMaintenanceBranch lets owner assign a missing branch and logs timeline", async () => {
    const requestDoc = buildRequestDoc({
      branch: null,
      roomId: null,
      reservationId: null,
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation((query) => {
      if (query.firebaseUid === "firebase-owner-1") {
        return buildLeanQuery({
          _id: "owner_user_1",
          user_id: "owner_1",
          firstName: "Dorm",
          lastName: "Owner",
          email: "owner@example.com",
          phone: "0918",
          branch: null,
          role: "owner",
        });
      }

      if (query.user_id === requestDoc.user_id) {
        return buildLeanQuery({
          _id: "tenant_user_1",
          user_id: requestDoc.user_id,
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
      user: { uid: "firebase-owner-1" },
      params: { requestId: requestDoc.request_id },
      body: { branch: "guadalupe" },
      branchFilter: null,
      isOwner: true,
    };
    const res = {};
    const next = jest.fn();

    await assignAdminMaintenanceBranch(req, res, next);

    expect(requestDoc.branch).toBe("guadalupe");
    expect(requestDoc.statusHistory).toEqual([
      expect.objectContaining({
        event: "branch_assigned_manually",
        actor_name: "Dormitory Owner",
        actor_role: "owner",
        branch: "guadalupe",
        note: "Branch: Guadalupe",
      }),
    ]);
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        message: "Branch assigned manually: Guadalupe.",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("assignAdminMaintenanceBranch rejects branch admins", async () => {
    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: "maint_a1b2c3d4e5f6" },
      body: { branch: "gil-puyat" },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await assignAdminMaintenanceBranch(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "OWNER_ONLY",
        statusCode: 403,
      }),
    );
    expect(maintenanceFindOne).not.toHaveBeenCalled();
    expect(sendSuccess).not.toHaveBeenCalled();
  });

  test("assignAdminMaintenanceBranch does not overwrite an existing valid branch", async () => {
    const requestDoc = buildRequestDoc({
      branch: "gil-puyat",
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);

    const req = {
      user: { uid: "firebase-owner-1" },
      params: { requestId: requestDoc.request_id },
      body: { branch: "guadalupe" },
      branchFilter: null,
      isOwner: true,
    };
    const res = {};
    const next = jest.fn();

    await assignAdminMaintenanceBranch(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "REQUEST_BRANCH_ALREADY_ASSIGNED",
        statusCode: 409,
      }),
    );
    expect(requestDoc.branch).toBe("gil-puyat");
    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(sendSuccess).not.toHaveBeenCalled();
  });

  test("assignAdminMaintenanceProvider assigns a saved provider and logs timeline", async () => {
    const requestDoc = buildRequestDoc({
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    const provider = {
      _id: "507f1f77bcf86cd799439012",
      providerName: "Makati Plumbing Services",
      contactNumber: "09171234567",
      serviceCategories: ["Plumbing"],
      serviceCategoryKeys: ["plumbing"],
      branchCoverage: ["gil-puyat"],
      status: "active",
      notes: "Usually available within the day.",
    };
    serviceProviderFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue(provider),
    });
    userFindOne.mockImplementation((query) => {
      if (query.firebaseUid === "firebase-admin-1") {
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

      if (query.user_id === requestDoc.user_id) {
        return buildLeanQuery({
          _id: "tenant_user_1",
          user_id: requestDoc.user_id,
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
        providerSource: "directory",
        providerId: provider._id,
        notes: "Called provider for inspection.",
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await assignAdminMaintenanceProvider(req, res, next);

    expect(requestDoc.assigned_to).toBe("Makati Plumbing Services");
    expect(requestDoc.assignedProviderContact).toBe("09171234567");
    expect(requestDoc.assignedProviderSource).toBe("directory");
    expect(requestDoc.statusHistory).toEqual([
      expect.objectContaining({
        event: "service_provider_assigned",
        providerName: "Makati Plumbing Services",
        note: "Called provider for inspection.",
      }),
    ]);
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("assignAdminMaintenanceProvider accepts a general maintenance provider for generic maintenance requests", async () => {
    const requestDoc = buildRequestDoc({
      request_type: "maintenance",
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    const provider = {
      _id: "507f1f77bcf86cd799439099",
      providerName: "Lilycrest General Maintenance Provider Placeholder",
      contactNumber: "09XX XXX XXXX",
      serviceCategories: ["General Maintenance"],
      serviceCategoryKeys: ["general-maintenance"],
      branchCoverage: ["gil-puyat"],
      status: "active",
      notes: "General maintenance placeholder.",
    };
    serviceProviderFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue(provider),
    });
    userFindOne.mockImplementation((query) => {
      if (query.firebaseUid === "firebase-admin-1") {
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

      if (query.user_id === requestDoc.user_id) {
        return buildLeanQuery({
          _id: "tenant_user_1",
          user_id: requestDoc.user_id,
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
        providerSource: "directory",
        providerId: provider._id,
      },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await assignAdminMaintenanceProvider(req, res, next);

    expect(requestDoc.assignedProviderName).toBe(
      "Lilycrest General Maintenance Provider Placeholder",
    );
    expect(requestDoc.assignedProviderCategory).toBe("General Maintenance");
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("assignAdminMaintenanceProvider treats unassigning an already unassigned request as a no-op", async () => {
    const requestDoc = buildRequestDoc({
      assigned_to: null,
      assignedProviderName: null,
      assignedProviderId: null,
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockImplementation((query) => {
      if (query.firebaseUid === "firebase-admin-1") {
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

      if (query.user_id === requestDoc.user_id) {
        return buildLeanQuery({
          _id: "tenant_user_1",
          user_id: requestDoc.user_id,
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
      body: { providerSource: "none" },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await assignAdminMaintenanceProvider(req, res, next);

    expect(requestDoc.statusHistory).toEqual([]);
    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(res, expect.objectContaining({
      message: "No service provider is assigned yet.",
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test("assignAdminMaintenanceProvider rejects saving a future provider when request branch is missing", async () => {
    const requestDoc = buildRequestDoc({
      branch: null,
      roomId: null,
      reservationId: null,
      save: jest.fn().mockResolvedValue(undefined),
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    userFindOne.mockReturnValue(
      buildLeanQuery({
        _id: "owner_user_1",
        user_id: "owner_1",
        firstName: "Dorm",
        lastName: "Owner",
        email: "owner@example.com",
        phone: "0918",
        branch: null,
        role: "owner",
      }),
    );

    const req = {
      user: { uid: "firebase-owner-1" },
      params: { requestId: requestDoc.request_id },
      body: {
        providerSource: "manual",
        providerName: "Manual Plumbing Co.",
        contactNumber: "09171234567",
        serviceType: "Plumbing",
        saveForFuture: true,
      },
      branchFilter: null,
      isOwner: true,
    };
    const res = {};
    const next = jest.fn();

    await assignAdminMaintenanceProvider(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "PROVIDER_BRANCH_REQUIRED",
        statusCode: 400,
      }),
    );
    expect(serviceProviderCreate).not.toHaveBeenCalled();
    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(sendSuccess).not.toHaveBeenCalled();
  });

  test("suggestAdminMaintenanceProvider does not suggest providers for branchless requests", async () => {
    const requestDoc = buildRequestDoc({
      branch: null,
      roomId: null,
      reservationId: null,
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);

    const req = {
      user: { uid: "firebase-owner-1" },
      params: { requestId: requestDoc.request_id },
      branchFilter: null,
      isOwner: true,
    };
    const res = {};
    const next = jest.fn();

    await suggestAdminMaintenanceProvider(req, res, next);

    expect(serviceProviderFind).not.toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        recommendation: null,
        unavailableReason: "missing_branch",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("suggestAdminMaintenanceProvider falls back to general maintenance providers for generic requests", async () => {
    const requestDoc = buildRequestDoc({
      request_type: "maintenance",
      branch: "gil-puyat",
    });
    maintenanceFindOne.mockResolvedValue(requestDoc);
    const generalProvider = {
      _id: "507f1f77bcf86cd799439099",
      providerName: "Lilycrest General Maintenance Provider Placeholder",
      contactNumber: "09XX XXX XXXX",
      serviceCategories: ["General Maintenance"],
      serviceCategoryKeys: ["general-maintenance"],
      branchCoverage: ["gil-puyat"],
      status: "active",
      notes: "General maintenance placeholder.",
    };
    serviceProviderFind
      .mockReturnValueOnce(buildSelectLeanQuery([]))
      .mockReturnValueOnce(buildSelectLeanQuery([generalProvider]));

    const req = {
      user: { uid: "firebase-owner-1" },
      params: { requestId: requestDoc.request_id },
      branchFilter: null,
      isOwner: true,
    };
    const res = {};
    const next = jest.fn();

    await suggestAdminMaintenanceProvider(req, res, next);

    expect(serviceProviderFind).toHaveBeenCalledTimes(2);
    expect(serviceProviderFind.mock.calls[0][0]).toMatchObject({
      status: "active",
      branchCoverage: "gil-puyat",
    });
    expect(serviceProviderFind.mock.calls[1][0]).toMatchObject({
      status: "active",
      branchCoverage: "gil-puyat",
    });
    expect(serviceProviderFind.mock.calls[1][0].$or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceCategoryKeys: {
            $in: expect.arrayContaining(["maintenance", "general-maintenance"]),
          },
        }),
      ]),
    );
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        recommendedProviderName: "Lilycrest General Maintenance Provider Placeholder",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("generateAdminMaintenanceReport includes admin-only case file details", async () => {
    await withoutGeminiEnv(async () => {
      const requestDoc = buildRequestDoc({
        status: "completed",
        assigned_to: "Makati Plumbing Services",
        assignedProviderName: "Makati Plumbing Services",
        assignedProviderContact: "09171234567",
        assignedProviderCategory: "Plumbing",
        assignedProviderNotes: "Internal provider note",
        assignedProviderSource: "directory",
        notes: "Internal admin note",
        resolution_note: "Leak repaired and area checked.",
        resolved_at: new Date("2026-04-09T11:00:00.000Z"),
        attachments: [
          {
            name: "tenant-leak.jpg",
            uri: "https://storage.example.com/tenant-leak.jpg",
            visibility: "tenant_admin",
          },
          {
            name: "old-photo.jpg",
            uri: "https://storage.example.com/old-photo.jpg",
            visibility: "tenant_admin",
            isRemoved: true,
            removedAt: new Date("2026-04-09T09:00:00.000Z"),
            removedReason: "Wrong file attached",
            removedByName: "Branch Admin",
            removedByRole: "branch_admin",
            removedScope: "request",
          },
        ],
        statusHistory: [
          {
            event: "note_updated",
            status: "pending",
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            note: "Internal admin note",
            timestamp: new Date("2026-04-08T11:00:00.000Z"),
          },
          {
            event: "service_provider_assigned",
            status: "pending",
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            providerName: "Makati Plumbing Services",
            note: "Internal provider assignment",
            timestamp: new Date("2026-04-08T12:00:00.000Z"),
          },
        ],
        work_log: [
          {
            logged_at: new Date("2026-04-09T10:00:00.000Z"),
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            note: "Admin-only proof note",
            attachments: [
              {
                name: "proof.jpg",
                uri: "https://storage.example.com/proof.jpg",
                visibility: "admin_only",
              },
            ],
          },
        ],
        conversation: [
          {
            created_at: new Date("2026-04-08T13:00:00.000Z"),
            sender_name: "Branch Admin",
            sender_role: "branch_admin",
            message: "We have received your maintenance request.",
            attachments: [],
          },
        ],
      });
      maintenanceFindOne.mockResolvedValue(requestDoc);
      userFindOne.mockImplementation((query) => {
        if (query.firebaseUid === "firebase-admin-1") {
          return buildLeanQuery({
            _id: "admin_user_1",
            user_id: "admin_1",
            firstName: "Branch",
            lastName: "Admin",
            email: "admin@example.com",
            branch: "gil-puyat",
            role: "branch_admin",
          });
        }

        if (query.user_id === requestDoc.user_id) {
          return buildLeanQuery({
            _id: "tenant_user_1",
            user_id: requestDoc.user_id,
            firstName: "Lily",
            lastName: "Tenant",
            email: "lily@example.com",
            branch: "gil-puyat",
            role: "tenant",
          });
        }

        return buildLeanQuery(null);
      });

      const req = {
        user: { uid: "firebase-admin-1" },
        params: { requestId: requestDoc.request_id },
        body: { reportType: "admin" },
        branchFilter: "gil-puyat",
        isOwner: false,
      };
      const res = {};
      const next = jest.fn();

      await generateAdminMaintenanceReport(req, res, next);

      const report = sendSuccess.mock.calls[0][1];
      expect(report).toEqual(
        expect.objectContaining({
          reportType: "admin",
          title: `Maintenance Admin Report - ${requestDoc.request_id}`,
          provider: "rule-based",
          unavailable: true,
        }),
      );
      expect(report.summary).toContain("Makati Plumbing Services");
      expect(report.summary).toContain("09171234567");
      expect(report.summary).toContain("Internal provider note");
      expect(report.summary).toContain("Internal admin note");
      expect(report.summary).toContain("proof.jpg");
      expect(report.summary).toContain("Wrong file attached");
      expect(report.summary).toContain("We have received your maintenance request.");
      expect(next).not.toHaveBeenCalled();
    });
  });

  test("generateAdminMaintenanceReport filters tenant summaries server-side", async () => {
    await withoutGeminiEnv(async () => {
      const requestDoc = buildRequestDoc({
        status: "in_progress",
        assigned_to: "Makati Plumbing Services",
        assignedProviderName: "Makati Plumbing Services",
        assignedProviderContact: "09171234567",
        assignedProviderCategory: "Plumbing",
        assignedProviderNotes: "Internal provider note",
        notes: "Internal admin note",
        attachments: [
          {
            name: "tenant-leak.jpg",
            uri: "https://storage.example.com/tenant-leak.jpg",
            visibility: "tenant_admin",
          },
          {
            name: "removed-tenant-file.jpg",
            uri: "https://storage.example.com/removed-tenant-file.jpg",
            visibility: "tenant_admin",
            isRemoved: true,
            removedAt: new Date("2026-04-09T09:00:00.000Z"),
            removedReason: "Sensitive information visible",
            removedByName: "Branch Admin",
            removedByRole: "branch_admin",
            removedScope: "tenant_only",
          },
        ],
        statusHistory: [
          {
            event: "note_updated",
            status: "pending",
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            note: "Internal admin note",
            timestamp: new Date("2026-04-08T11:00:00.000Z"),
          },
          {
            event: "service_provider_assigned",
            status: "pending",
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            providerName: "Makati Plumbing Services",
            note: "Internal provider assignment",
            timestamp: new Date("2026-04-08T12:00:00.000Z"),
          },
          {
            event: "status_changed",
            status: "in_progress",
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            note: "Internal status note",
            timestamp: new Date("2026-04-08T12:30:00.000Z"),
          },
        ],
        work_log: [
          {
            logged_at: new Date("2026-04-09T10:00:00.000Z"),
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            note: "Admin-only proof note",
            attachments: [
              {
                name: "proof.jpg",
                uri: "https://storage.example.com/proof.jpg",
                visibility: "admin_only",
              },
            ],
          },
        ],
        conversation: [
          {
            created_at: new Date("2026-04-08T13:00:00.000Z"),
            sender_name: "Branch Admin",
            sender_role: "branch_admin",
            message: "We have received your maintenance request.",
            attachments: [
              {
                name: "tenant-visible-update.jpg",
                uri: "https://storage.example.com/tenant-visible-update.jpg",
                visibility: "tenant_admin",
              },
            ],
          },
        ],
      });
      maintenanceFindOne.mockResolvedValue(requestDoc);
      userFindOne.mockImplementation((query) => {
        if (query.firebaseUid === "firebase-admin-1") {
          return buildLeanQuery({
            _id: "admin_user_1",
            user_id: "admin_1",
            firstName: "Branch",
            lastName: "Admin",
            email: "admin@example.com",
            branch: "gil-puyat",
            role: "branch_admin",
          });
        }

        if (query.user_id === requestDoc.user_id) {
          return buildLeanQuery({
            _id: "tenant_user_1",
            user_id: requestDoc.user_id,
            firstName: "Lily",
            lastName: "Tenant",
            email: "lily@example.com",
            branch: "gil-puyat",
            role: "tenant",
          });
        }

        return buildLeanQuery(null);
      });

      const req = {
        user: { uid: "firebase-admin-1" },
        params: { requestId: requestDoc.request_id },
        body: { reportType: "tenant" },
        branchFilter: "gil-puyat",
        isOwner: false,
      };
      const res = {};
      const next = jest.fn();

      await generateAdminMaintenanceReport(req, res, next);

      const report = sendSuccess.mock.calls[0][1];
      expect(report).toEqual(
        expect.objectContaining({
          reportType: "tenant",
          title: `Maintenance Tenant Summary - ${requestDoc.request_id}`,
          provider: "rule-based",
          unavailable: true,
        }),
      );
      expect(report.summary).toContain("A service provider has been assigned.");
      expect(report.summary).toContain("We have received your maintenance request.");
      expect(report.summary).toContain("tenant-visible-update.jpg");
      expect(report.summary).not.toContain("09171234567");
      expect(report.summary).not.toContain("Makati Plumbing Services");
      expect(report.summary).not.toContain("Internal provider note");
      expect(report.summary).not.toContain("Internal admin note");
      expect(report.summary).not.toContain("Admin-only proof note");
      expect(report.summary).not.toContain("proof.jpg");
      expect(report.summary).not.toContain("removed-tenant-file.jpg");
      expect(report.summary).not.toContain("Sensitive information visible");
      expect(next).not.toHaveBeenCalled();
    });
  });

  test("sendAdminTenantSummary sends only tenant-safe report content", async () => {
    await withoutGeminiEnv(async () => {
      const requestDoc = buildRequestDoc({
        status: "in_progress",
        assigned_to: "Makati Plumbing Services",
        assignedProviderName: "Makati Plumbing Services",
        assignedProviderContact: "09171234567",
        assignedProviderCategory: "Plumbing",
        assignedProviderNotes: "Internal provider note",
        notes: "Internal admin note",
        resolution_note: "Private completion decision",
        attachments: [
          {
            name: "tenant-leak.jpg",
            uri: "https://storage.example.com/tenant-leak.jpg",
            visibility: "tenant_admin",
          },
        ],
        statusHistory: [
          {
            event: "note_updated",
            status: "pending",
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            note: "Internal admin note",
            timestamp: new Date("2026-04-08T11:00:00.000Z"),
          },
          {
            event: "service_provider_assigned",
            status: "pending",
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            providerName: "Makati Plumbing Services",
            note: "Internal provider assignment",
            timestamp: new Date("2026-04-08T12:00:00.000Z"),
          },
        ],
        work_log: [
          {
            logged_at: new Date("2026-04-09T10:00:00.000Z"),
            actor_name: "Branch Admin",
            actor_role: "branch_admin",
            note: "Admin-only proof note",
            attachments: [
              {
                name: "proof.jpg",
                uri: "https://storage.example.com/proof.jpg",
                visibility: "admin_only",
              },
            ],
          },
        ],
        conversation: [
          {
            created_at: new Date("2026-04-08T13:00:00.000Z"),
            sender_name: "Branch Admin",
            sender_role: "branch_admin",
            message: "We have received your maintenance request.",
            attachments: [],
          },
        ],
      });
      maintenanceFindOne.mockResolvedValue(requestDoc);
      userFindOne.mockImplementation((query) => {
        if (query.firebaseUid === "firebase-admin-1") {
          return buildLeanQuery({
            _id: "admin_user_1",
            user_id: "admin_1",
            firstName: "Branch",
            lastName: "Admin",
            email: "admin@example.com",
            branch: "gil-puyat",
            role: "branch_admin",
          });
        }

        if (query.user_id === requestDoc.user_id) {
          return buildLeanQuery({
            _id: "tenant_user_1",
            user_id: requestDoc.user_id,
            firstName: "Lily",
            lastName: "Tenant",
            email: "lily@example.com",
            branch: "gil-puyat",
            role: "tenant",
          });
        }

        return buildLeanQuery(null);
      });

      const req = {
        user: { uid: "firebase-admin-1" },
        params: { requestId: requestDoc.request_id },
        body: {},
        branchFilter: "gil-puyat",
        isOwner: false,
      };
      const res = {};
      const next = jest.fn();

      await sendAdminTenantSummary(req, res, next);

      expect(requestDoc.conversation).toHaveLength(2);
      const sentMessage = requestDoc.conversation[1].message;
      expect(sentMessage).toContain("A service provider has been assigned.");
      expect(sentMessage).toContain("We have received your maintenance request.");
      expect(sentMessage).toContain("tenant-leak.jpg");
      expect(sentMessage).not.toContain("09171234567");
      expect(sentMessage).not.toContain("Makati Plumbing Services");
      expect(sentMessage).not.toContain("Internal provider note");
      expect(sentMessage).not.toContain("Internal admin note");
      expect(sentMessage).not.toContain("Private completion decision");
      expect(sentMessage).not.toContain("Admin-only proof note");
      expect(sentMessage).not.toContain("proof.jpg");
      expect(requestDoc.conversation[1]).toEqual(
        expect.objectContaining({
          type: "tenant_summary",
          kind: "tenant_summary",
          sender_id: "admin_1",
          sender_name: "Branch Admin",
          sender_role: "branch_admin",
          sender_side: "admin",
          attachments: [],
        }),
      );
      expect(requestDoc.save).toHaveBeenCalledTimes(1);
      expect(maintenanceUpdated).toHaveBeenCalledWith(
        "tenant_user_1",
        "plumbing",
        "in_progress",
        requestDoc.request_id,
        {
          statusChanged: false,
          hasAdminNote: true,
          hasProgressEntry: false,
          hasProgressAttachments: false,
        },
      );
      expect(sendSuccess.mock.calls[0][1].report).toEqual(
        expect.objectContaining({
          reportType: "tenant",
          title: `Maintenance Tenant Summary - ${requestDoc.request_id}`,
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  test("sendAdminTenantSummary denies branch admin access to another branch request", async () => {
    const requestDoc = buildRequestDoc({ branch: "guadalupe" });
    maintenanceFindOne.mockResolvedValue(requestDoc);

    const req = {
      user: { uid: "firebase-admin-1" },
      params: { requestId: requestDoc.request_id },
      branchFilter: "gil-puyat",
      isOwner: false,
    };
    const res = {};
    const next = jest.fn();

    await sendAdminTenantSummary(req, res, next);

    expect(requestDoc.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].code).toBe("FORBIDDEN");
  });

  test("getMyRequests does not expose provider contact details to tenants", async () => {
    const storedRequest = buildRequestDoc({
      assigned_to: "Makati Plumbing Services",
      assignedProviderName: "Makati Plumbing Services",
      assignedProviderContact: "09171234567",
      assignedProviderCategory: "Plumbing",
      assignedProviderSource: "directory",
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
    expect(request.assigned_to).toBeNull();
    expect(request.assignedProviderContact).toBeNull();
    expect(request.assignedProvider).toBeNull();
    expect(next).not.toHaveBeenCalled();
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
        message: "This maintenance request has no branch assigned. Please check the tenant’s room or branch details before uploading.",
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

  test("confirmResolution: confirms resolution and records 5-star tenant rating", async () => {
    const requestDoc = buildRequestDoc({
      status: "resolved",
      resolved_at: new Date("2026-08-18T00:00:00.000Z"),
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
      body: {
        action: "confirm",
        confirmed: true,
        feedback: "Air conditioner works perfectly now!",
        rating: 5,
      },
    };
    const res = {};
    const next = jest.fn();

    await confirmResolution(req, res, next);

    expect(requestDoc.status).toBe("resolved");
    expect(requestDoc.resolutionConfirmation).toEqual(
      expect.objectContaining({
        action: "confirm",
        tenantFeedback: "Air conditioner works perfectly now!",
        rating: 5,
      }),
    );
    expect(requestDoc.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "tenant_confirmed_resolved",
          status: "resolved",
        }),
      ]),
    );
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("confirmResolution: tenant reports issue unresolved ('no show naman') returning ticket to in_progress", async () => {
    const requestDoc = buildRequestDoc({
      status: "resolved",
      resolved_at: new Date("2026-08-18T00:00:00.000Z"),
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
      body: {
        action: "reopen",
        confirmed: false,
        feedback: "no show naman",
      },
    };
    const res = {};
    const next = jest.fn();

    await confirmResolution(req, res, next);

    expect(requestDoc.status).toBe("in_progress");
    expect(requestDoc.resolved_at).toBeNull();
    expect(requestDoc.resolutionConfirmation).toEqual(
      expect.objectContaining({
        action: "rejected_back_to_in_progress",
        tenantFeedback: "no show naman",
      }),
    );
    expect(requestDoc.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "tenant_rejected_resolution",
          status: "in_progress",
          note: expect.stringContaining("no show naman"),
        }),
      ]),
    );
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  test("confirmResolution: rejects confirmation on non-resolved tickets with 409", async () => {
    const requestDoc = buildRequestDoc({
      status: "pending",
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
      body: {
        action: "confirm",
        confirmed: true,
      },
    };
    const res = {};
    const next = jest.fn();

    await confirmResolution(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: "INVALID_CONFIRMATION_STATE",
      }),
    );
    expect(requestDoc.save).not.toHaveBeenCalled();
  });

  test("requestMaintenanceReschedule: records reschedule request and notifies facilities", async () => {
    const requestDoc = buildRequestDoc({
      status: "scheduled",
      scheduledDate: new Date("2026-08-20T10:00:00.000Z"),
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
      body: {
        proposedDate: "2026-08-22T14:00:00.000Z",
        reason: "I will be in class during the original schedule.",
      },
    };
    const res = {};
    const next = jest.fn();

    await requestMaintenanceReschedule(req, res, next);

    expect(requestDoc.rescheduleRequest).toEqual(
      expect.objectContaining({
        status: "pending",
        reason: "I will be in class during the original schedule.",
      }),
    );
    expect(requestDoc.save).toHaveBeenCalledTimes(1);
    expect(sendSuccess).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });
});
