import mongoose from "mongoose";
import {
  ChatConversation,
  ChatMessage,
  Reservation,
  User,
} from "../models/index.js";
import { ROOM_BRANCHES } from "../config/branches.js";
import { CURRENT_RESIDENT_STATUS_QUERY } from "../utils/lifecycleNaming.js";
import { notify } from "../utils/notificationService.js";
import { emitToChatAdmins, emitToUser } from "../utils/socket.js";
import { ADMIN_ROLE_VALUES, OWNER_ROLE_VALUES, isOwnerRole } from "../config/roles.js";

const MAX_MESSAGE_CHARS = 1000;
const ADMIN_ROLES = new Set(ADMIN_ROLE_VALUES);
const ACTIVE_CONVERSATION_STATUSES = [
  "open",
  "in_review",
  "waiting_tenant",
  "resolved",
];
const VALID_STATUSES = new Set([...ACTIVE_CONVERSATION_STATUSES, "closed"]);
const VALID_CATEGORIES = new Set([
  "billing_concern",
  "maintenance_concern",
  "reservation_concern",
  "payment_concern",
  "general_inquiry",
  "urgent_issue",
]);
const CATEGORY_ALIASES = {
  "billing concern": "billing_concern",
  billing: "billing_concern",
  "maintenance concern": "maintenance_concern",
  maintenance: "maintenance_concern",
  "reservation concern": "reservation_concern",
  reservation: "reservation_concern",
  "payment concern": "payment_concern",
  payment: "payment_concern",
  "general inquiry": "general_inquiry",
  general: "general_inquiry",
  "urgent issue": "urgent_issue",
  urgent: "urgent_issue",
};
const VALID_PRIORITIES = new Set(["normal", "high", "urgent"]);
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2 };

function createHttpError(message, statusCode = 400, code = "CHAT_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function sendError(res, error, fallback = "Failed to process chat request.") {
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallback : error.message;

  if (statusCode >= 500) {
    console.error("Chat controller error:", error);
  }

  return res.status(statusCode).json({
    error: message,
    code: error.code || "CHAT_ERROR",
  });
}

function normalizeMessage(rawMessage) {
  if (typeof rawMessage !== "string") {
    throw createHttpError("Message cannot be empty.", 400, "EMPTY_MESSAGE");
  }

  const message = rawMessage.replace(/\r\n?/g, "\n").replace(/\t/g, " ").trim();
  if (!message) {
    throw createHttpError("Message cannot be empty.", 400, "EMPTY_MESSAGE");
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    throw createHttpError(
      `Message must be ${MAX_MESSAGE_CHARS} characters or fewer.`,
      400,
      "MESSAGE_TOO_LONG",
    );
  }

  return message;
}

function normalizeCategory(rawCategory, { required = false } = {}) {
  if (rawCategory === undefined || rawCategory === null || rawCategory === "") {
    if (required) {
      throw createHttpError("Category is required.", 400, "CATEGORY_REQUIRED");
    }
    return null;
  }

  const categoryKey = String(rawCategory)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const category = VALID_CATEGORIES.has(categoryKey)
    ? categoryKey
    : CATEGORY_ALIASES[String(rawCategory).trim().toLowerCase()];

  if (!category) {
    throw createHttpError("Category is required.", 400, "CATEGORY_REQUIRED");
  }

  return category;
}

function normalizePriority(rawPriority, category = "") {
  if (rawPriority !== undefined && rawPriority !== null && rawPriority !== "") {
    const priority = String(rawPriority).trim().toLowerCase();
    if (!VALID_PRIORITIES.has(priority)) {
      throw createHttpError("Invalid priority.", 400, "INVALID_PRIORITY");
    }
    return priority;
  }

  return category === "urgent_issue" ? "urgent" : "normal";
}

function normalizeNote(rawNote, errorMessage = "Note is required.") {
  if (typeof rawNote !== "string") {
    throw createHttpError(errorMessage, 400, "NOTE_REQUIRED");
  }

  const note = rawNote.replace(/\r\n?/g, "\n").replace(/\t/g, " ").trim();
  if (!note) {
    throw createHttpError(errorMessage, 400, "NOTE_REQUIRED");
  }

  if (note.length > MAX_MESSAGE_CHARS) {
    throw createHttpError(
      `Note must be ${MAX_MESSAGE_CHARS} characters or fewer.`,
      400,
      "NOTE_TOO_LONG",
    );
  }

  return note;
}

function normalizeOptionalNote(rawNote) {
  if (rawNote === undefined || rawNote === null || rawNote === "") {
    return "";
  }

  return normalizeNote(rawNote, "Note is required.");
}

function ensureObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw createHttpError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  }
  return new mongoose.Types.ObjectId(value);
}

function displayName(user, fallback = "User") {
  if (!user) return fallback;
  return (
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.name ||
    user.fullName ||
    user.email ||
    fallback
  );
}

function selectedBedLabel(reservation = {}) {
  const selectedBed = reservation.selectedBed || {};
  const parts = [selectedBed.position, selectedBed.id].filter(Boolean);
  return parts.join(" ").trim();
}

/**
 * Auto-assign a newly created conversation to the most appropriate admin.
 *
 * Rules (applied in order, first match wins):
 *  1. maintenance_concern → admin with `manageMaintenance` permission on the branch
 *  2. Any category       → admin on the branch with the fewest open assigned conversations
 *
 * Silent failure: never throws — a missing assignee is non-fatal.
 */
async function autoAssignConversation(conversation) {
  try {
    const { branch } = conversation;
    if (!branch) return;

    let candidates = [];

    if (conversation.category === "maintenance_concern") {
      candidates = await User.find({
        role: { $in: ["branch_admin", "owner"] },
        branch,
        isArchived: false,
        "permissions.manageMaintenance": true,
      })
        .select("_id firstName lastName")
        .lean();
    }

    // Fallback: all branch admins on this branch
    if (candidates.length === 0) {
      candidates = await User.find({
        role: { $in: ["branch_admin", "owner"] },
        branch,
        isArchived: false,
      })
        .select("_id firstName lastName")
        .lean();
    }

    if (candidates.length === 0) return;

    // Pick the admin with the fewest currently open assigned conversations
    const candidateIds = candidates.map((c) => c._id);
    const loadCounts = await ChatConversation.aggregate([
      {
        $match: {
          assignedAdminId: { $in: candidateIds.map(String) },
          status: { $in: ["open", "in_review", "waiting_tenant"] },
        },
      },
      { $group: { _id: "$assignedAdminId", count: { $sum: 1 } } },
    ]);

    const loadMap = new Map(loadCounts.map((l) => [String(l._id), l.count]));
    const sorted = candidates.sort(
      (a, b) => (loadMap.get(String(a._id)) || 0) - (loadMap.get(String(b._id)) || 0),
    );
    const { _id: chosenId, firstName = "", lastName = "" } = sorted[0];

    conversation.assignedAdminId = String(chosenId);
    conversation.assignedAdminName =
      `${firstName} ${lastName}`.trim() || "Admin";
    await conversation.save();
  } catch (err) {
    // Non-fatal — log and continue
    console.error("autoAssignConversation failed (non-fatal):", err.message);
  }
}

/**
 * Resolves the tenant's profile image with fallback cascade:
 *  1. Live User.profileImage
 *  2. Reservation.selfiePhotoUrl / documentPrechecks.selfiePhoto.fileUrl
 *  3. Explicit/cached tenantProfileImage
 */
async function resolveTenantProfileImage({
  tenantId = null,
  tenantEmail = "",
  tenantUserId = "",
  tenantProfileImage = "",
  user = null,
  reservation = null,
} = {}) {
  try {
    if (user?.profileImage && typeof user.profileImage === "string" && user.profileImage.trim()) {
      return user.profileImage.trim();
    }

    const resPhoto = reservation?.selfiePhotoUrl || reservation?.documentPrechecks?.selfiePhoto?.fileUrl;
    if (resPhoto && typeof resPhoto === "string" && resPhoto.trim()) {
      return resPhoto.trim();
    }

    if (tenantProfileImage && typeof tenantProfileImage === "string" && tenantProfileImage.trim()) {
      return tenantProfileImage.trim();
    }

    const mongoId = tenantId && mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : null;
    const normalizedEmail = tenantEmail ? String(tenantEmail).trim().toLowerCase() : "";

    let dbUser = null;
    if (mongoId && typeof User?.findById === "function") {
      dbUser = await User.findById(mongoId).select("profileImage email").lean();
    }
    if (!dbUser && normalizedEmail && typeof User?.findOne === "function") {
      dbUser = await User.findOne({ email: normalizedEmail }).select("profileImage email").lean();
    }
    if (dbUser?.profileImage && typeof dbUser.profileImage === "string" && dbUser.profileImage.trim()) {
      return dbUser.profileImage.trim();
    }

    const resConditions = [];
    if (mongoId) resConditions.push({ userId: mongoId });
    if (dbUser?._id) resConditions.push({ userId: dbUser._id });
    if (normalizedEmail) resConditions.push({ email: normalizedEmail });

    if (resConditions.length > 0 && typeof Reservation?.findOne === "function") {
      const resDoc = await Reservation.findOne({
        $or: resConditions,
        $and: [
          {
            $or: [
              { selfiePhotoUrl: { $exists: true, $ne: null, $ne: "" } },
              { "documentPrechecks.selfiePhoto.fileUrl": { $exists: true, $ne: null, $ne: "" } },
            ],
          },
        ],
      })
        .sort({ createdAt: -1 })
        .select("selfiePhotoUrl documentPrechecks.selfiePhoto.fileUrl")
        .lean();

      const photo = resDoc?.selfiePhotoUrl || resDoc?.documentPrechecks?.selfiePhoto?.fileUrl;
      if (photo && typeof photo === "string" && photo.trim()) {
        return photo.trim();
      }
    }

    // 6. Name-based Reservation fallback for legacy/orphaned chat records
    const targetName = String(user?.name || user?.fullName || "").trim();
    if (targetName && typeof Reservation?.findOne === "function") {
      const firstWord = targetName.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 2) {
        const resByName = await Reservation.findOne({
          firstName: new RegExp(`^${firstWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
          selfiePhotoUrl: { $exists: true, $ne: null, $ne: "" },
        })
          .sort({ createdAt: -1 })
          .select("selfiePhotoUrl")
          .lean();

        if (resByName?.selfiePhotoUrl && typeof resByName.selfiePhotoUrl === "string" && resByName.selfiePhotoUrl.trim()) {
          return resByName.selfiePhotoUrl.trim();
        }
      }
    }

    return "";
  } catch (_) {
    return "";
  }
}

/**
 * Efficiently batch-resolves tenant profile photos across an array of conversation docs.
 */
async function batchResolveConversationPhotos(conversations = []) {
  try {
    if (!Array.isArray(conversations) || conversations.length === 0) return conversations;
    if (typeof User?.find !== "function" || typeof Reservation?.find !== "function") return conversations;

  const unresolved = conversations.filter((c) => {
    const tenantObj = c.tenantId && typeof c.tenantId === "object" ? c.tenantId : null;
    const currentPhoto = (tenantObj && tenantObj.profileImage) || c.tenantProfileImage || "";
    return !currentPhoto;
  });

  if (unresolved.length === 0) return conversations;

  const unresolvedEmails = [
    ...new Set(
      unresolved
        .map((c) => String(c.tenantEmail || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const unresolvedUserIds = [
    ...new Set(
      unresolved
        .map((c) => (c.tenantId && typeof c.tenantId === "object" ? c.tenantId._id : c.tenantId))
        .filter(Boolean)
        .map(String),
    ),
  ];
  const unresolvedFirstNames = [
    ...new Set(
      unresolved
        .map((c) => String(c.tenantName || "").trim().split(/\s+/)[0])
        .filter((name) => Boolean(name) && name.length >= 2),
    ),
  ];

  const [usersByEmail, reservations, reservationsByName] = await Promise.all([
    unresolvedEmails.length > 0
      ? User.find({
          email: { $in: unresolvedEmails },
          profileImage: { $exists: true, $ne: "" },
        })
          .select("_id email profileImage")
          .lean()
      : [],
    Reservation.find({
      $or: [
        ...(unresolvedUserIds.length > 0
          ? [{ userId: { $in: unresolvedUserIds.map((id) => new mongoose.Types.ObjectId(id)) } }]
          : []),
        ...(unresolvedEmails.length > 0 ? [{ email: { $in: unresolvedEmails } }] : []),
      ],
      $and: [
        {
          $or: [
            { selfiePhotoUrl: { $exists: true, $ne: null, $ne: "" } },
            { "documentPrechecks.selfiePhoto.fileUrl": { $exists: true, $ne: null, $ne: "" } },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .select("userId email selfiePhotoUrl documentPrechecks.selfiePhoto.fileUrl")
      .lean(),
    unresolvedFirstNames.length > 0
      ? Reservation.find({
          firstName: { $in: unresolvedFirstNames.map((fn) => new RegExp(`^${fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")) },
          selfiePhotoUrl: { $exists: true, $ne: null, $ne: "" },
        })
          .sort({ createdAt: -1 })
          .select("firstName selfiePhotoUrl")
          .lean()
      : [],
  ]);

  const userEmailMap = new Map(usersByEmail.map((u) => [String(u.email).toLowerCase(), u.profileImage]));
  const resUserIdMap = new Map();
  const resEmailMap = new Map();
  const resNameMap = new Map();

  reservations.forEach((r) => {
    const photo = r.selfiePhotoUrl || r.documentPrechecks?.selfiePhoto?.fileUrl;
    if (photo && typeof photo === "string" && photo.trim()) {
      const cleanPhoto = photo.trim();
      if (r.userId && !resUserIdMap.has(String(r.userId))) {
        resUserIdMap.set(String(r.userId), cleanPhoto);
      }
      if (r.email && !resEmailMap.has(String(r.email).toLowerCase())) {
        resEmailMap.set(String(r.email).toLowerCase(), cleanPhoto);
      }
    }
  });

  reservationsByName.forEach((r) => {
    const fn = String(r.firstName || "").trim().toLowerCase();
    if (fn && r.selfiePhotoUrl && !resNameMap.has(fn)) {
      resNameMap.set(fn, r.selfiePhotoUrl.trim());
    }
  });

  unresolved.forEach((c) => {
    const tenantIdStr = c.tenantId && typeof c.tenantId === "object" ? String(c.tenantId._id) : String(c.tenantId || "");
    const emailStr = String(c.tenantEmail || "").trim().toLowerCase();
    const firstNameStr = String(c.tenantName || "").trim().split(/\s+/)[0].toLowerCase();
    const resolved =
      (emailStr && userEmailMap.get(emailStr)) ||
      (tenantIdStr && resUserIdMap.get(tenantIdStr)) ||
      (emailStr && resEmailMap.get(emailStr)) ||
      (firstNameStr && resNameMap.get(firstNameStr)) ||
      "";

    if (resolved) {
      c.tenantProfileImage = resolved;
      if (c.tenantId && typeof c.tenantId === "object" && !c.tenantId.profileImage) {
        c.tenantId.profileImage = resolved;
      }
      ChatConversation.updateOne({ _id: c._id }, { $set: { tenantProfileImage: resolved } }).catch(() => {});
    }
  });

    return conversations;
  } catch (_) {
    return conversations;
  }
}

function serializeConversation(conversation) {
  if (!conversation) return null;
  const doc =
    typeof conversation.toObject === "function"
      ? conversation.toObject()
      : conversation;

  const tenantObj =
    doc.tenantId && typeof doc.tenantId === "object" ? doc.tenantId : null;
  const tenantIdStr = tenantObj
    ? String(tenantObj._id || tenantObj.id)
    : doc.tenantId
    ? String(doc.tenantId)
    : "";

  return {
    id: String(doc._id || doc.id),
    tenantId: tenantIdStr,
    tenantName:
      doc.tenantName ||
      (tenantObj ? displayName(tenantObj, "Tenant") : "Tenant"),
    tenantEmail: doc.tenantEmail || tenantObj?.email || "",
    tenantProfileImage:
      doc.tenantProfileImage || tenantObj?.profileImage || "",
    branch: doc.branch || "",
    roomNumber: doc.roomNumber || "",
    roomBed: doc.roomBed || "",
    status: doc.status || "open",
    category: doc.category || "general_inquiry",
    priority: doc.priority || "normal",
    assignedAdminId: doc.assignedAdminId ? String(doc.assignedAdminId) : "",
    assignedAdminName: doc.assignedAdminName || "",
    lastMessage: doc.lastMessage || "",
    lastMessageAt: doc.lastMessageAt || doc.updatedAt || doc.createdAt || null,
    unreadAdminCount: doc.unreadAdminCount || 0,
    unreadTenantCount: doc.unreadTenantCount || 0,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    closedAt: doc.closedAt || null,
    closedBy: doc.closedBy ? String(doc.closedBy) : null,
    closingNote: doc.closingNote || "",
    statusHistory: Array.isArray(doc.statusHistory)
      ? doc.statusHistory.map((entry) => ({
          status: entry.status || "",
          note: entry.note || "",
          actorId: entry.actorId ? String(entry.actorId) : "",
          actorName: entry.actorName || "",
          createdAt: entry.createdAt || null,
        }))
      : [],
  };
}

function serializeMessage(message) {
  if (!message) return null;
  const doc =
    typeof message.toObject === "function" ? message.toObject() : message;

  const senderObj =
    doc.senderId && typeof doc.senderId === "object" ? doc.senderId : null;
  const senderIdStr = senderObj
    ? String(senderObj._id || senderObj.id)
    : doc.senderId
    ? String(doc.senderId)
    : "";

  return {
    id: String(doc._id || doc.id),
    conversationId: doc.conversationId ? String(doc.conversationId) : "",
    senderId: senderIdStr,
    senderName:
      doc.senderName || (senderObj ? displayName(senderObj, "User") : ""),
    senderRole: doc.senderRole || "tenant",
    senderProfileImage:
      doc.senderProfileImage || senderObj?.profileImage || "",
    message: doc.message || "",
    readAt: doc.readAt || null,
    createdAt: doc.createdAt || null,
  };
}

async function getDbUser(req) {
  if (!req.authUser?._id) {
    throw createHttpError("Authentication failed.", 401, "AUTHENTICATION_FAILED");
  }

  const dbUser = await User.findById(req.authUser._id).lean();
  if (!dbUser) {
    throw createHttpError("Authentication failed.", 401, "AUTHENTICATION_FAILED");
  }
  return dbUser;
}

async function resolveTenantContext(req) {
  const dbUser = await getDbUser(req);
  const role = String(req.authUser?.role || "").toLowerCase();

  if (ADMIN_ROLES.has(role)) {
    throw createHttpError("No active tenant.", 403, "NO_ACTIVE_TENANT");
  }

  const activeReservation = await Reservation.findOne({
    userId: dbUser._id,
    status: { $in: CURRENT_RESIDENT_STATUS_QUERY },
    isArchived: false,
  })
    .sort({ moveInDate: -1, createdAt: -1 })
    .populate("roomId", "name roomNumber branch type floor")
    .lean();

  const room = activeReservation?.roomId || null;
  const branch = room?.branch || dbUser.branch || "";
  const hasTenantAccess =
    role === "tenant" ||
    dbUser.tenantStatus === "active" ||
    Boolean(activeReservation);

  if (!hasTenantAccess || !ROOM_BRANCHES.includes(branch)) {
    throw createHttpError("No active tenant.", 400, "NO_ACTIVE_TENANT");
  }

  return {
    user: dbUser,
    activeReservation,
    branch,
    roomNumber: room?.roomNumber || room?.name || "",
    roomBed: selectedBedLabel(activeReservation),
  };
}

async function resolveAdminContext(req) {
  const dbUser = req.authUser;
  const normalizedRole = String(dbUser?.role || "").toLowerCase();
  const isOwnerLike = isOwnerRole(normalizedRole);
  const isBranchAdmin = normalizedRole === "branch_admin";

  if (!isOwnerLike && !isBranchAdmin) {
    throw createHttpError(
      "Access denied. Admin privileges required.",
      403,
      "ADMIN_ACCESS_DENIED",
    );
  }

  const branch = isOwnerLike ? null : (req.branchFilter ?? dbUser?.branch);
  if (!isOwnerLike && (!ROOM_BRANCHES.includes(branch) || branch !== dbUser?.branch)) {
    throw createHttpError(
      "Admin branch is not assigned.",
      403,
      "ADMIN_BRANCH_REQUIRED",
    );
  }

  return {
    user: dbUser,
    role: normalizedRole,
    senderRole: isOwnerRole(normalizedRole) ? "owner" : "admin",
    branch,
    isOwnerLike,
    displayName: displayName(dbUser, "Admin"),
  };
}

async function findConversationForTenant(conversationId, tenantUser) {
  const conversation = await ChatConversation.findById(ensureObjectId(conversationId));
  if (!conversation) {
    throw createHttpError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  }

  if (String(conversation.tenantId) !== String(tenantUser._id)) {
    throw createHttpError(
      "You do not have access to this conversation.",
      403,
      "CONVERSATION_ACCESS_DENIED",
    );
  }

  return conversation;
}

function assertAdminConversationAccess(conversation, adminContext) {
  if (!conversation) {
    throw createHttpError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  }

  if (!adminContext.isOwnerLike && conversation.branch !== adminContext.branch) {
    throw createHttpError(
      "Conversation not found.",
      404,
      "CONVERSATION_NOT_FOUND",
    );
  }
}

async function findConversationForAdmin(conversationId, adminContext) {
  const filter = { _id: ensureObjectId(conversationId) };
  if (!adminContext.isOwnerLike) filter.branch = adminContext.branch;

  const conversation = await ChatConversation.findOne(filter);
  assertAdminConversationAccess(conversation, adminContext);
  return conversation;
}

async function createMessageAndUpdateConversation({
  conversation,
  sender,
  senderRole,
  message,
  unreadTarget,
  nextStatus = null,
  statusNote = "",
}) {
  const now = new Date();
  let senderPhoto = sender?.profileImage || "";
  if (!senderPhoto && senderRole === "tenant") {
    senderPhoto = await resolveTenantProfileImage({
      tenantId: sender?._id || conversation.tenantId,
      tenantEmail: sender?.email || conversation.tenantEmail,
      tenantUserId: sender?.user_id || conversation.tenantUserId,
      tenantProfileImage: conversation.tenantProfileImage,
      user: sender,
    });
  }

  const chatMessage = await ChatMessage.create({
    conversationId: conversation._id,
    senderId: sender?._id || null,
    senderUserId: sender?.user_id || "",
    senderName: sender?.name || sender?.displayName || displayName(sender, "User"),
    senderRole,
    senderProfileImage: senderPhoto,
    message,
    createdAt: now,
    updatedAt: now,
  });

  const update = {
    $set: {
      lastMessage: message,
      lastMessageAt: now,
      ...(senderPhoto && !conversation.tenantProfileImage ? { tenantProfileImage: senderPhoto } : {}),
    },
  };

  if (nextStatus && conversation.status !== nextStatus) {
    update.$set.status = nextStatus;
    update.$push = {
      statusHistory: {
        $each: [
          {
            status: nextStatus,
            note: statusNote,
            actorId: sender?._id || null,
            actorName: sender?.name || sender?.displayName || displayName(sender, "User"),
            createdAt: now,
          },
        ],
        $slice: -25,
      },
    };
  }

  if (unreadTarget === "admin") {
    update.$inc = { unreadAdminCount: 1 };
  } else if (unreadTarget === "tenant") {
    update.$inc = { unreadTenantCount: 1 };
  }

  const updatedConversation = await ChatConversation.findByIdAndUpdate(
    conversation._id,
    update,
    { new: true },
  );

  return { chatMessage, conversation: updatedConversation };
}

async function notifyAdminsOfTenantMessage(conversation) {
  try {
    const admins = await User.find({
      isArchived: false,
      accountStatus: "active",
      $or: [
        { role: { $in: OWNER_ROLE_VALUES } },
        { role: "branch_admin", branch: conversation.branch },
      ],
    })
      .select("_id")
      .lean();

    await Promise.all(
      admins.map(async (admin) => {
        const notification = await notify.general(
          admin._id,
          conversation.priority === "urgent"
            ? "Urgent Tenant Message"
            : "New Tenant Message",
          conversation.priority === "urgent"
            ? `${conversation.tenantName} sent an urgent support message.`
            : `${conversation.tenantName} sent a message.`,
          {
            actionUrl: "/admin/chat",
            entityId: String(conversation._id),
          },
        );
        if (notification) {
          emitToUser(admin._id, "notification:new", notification);
        }
      }),
    );
  } catch (error) {
    console.warn("Chat admin notification failed:", error.message);
  }
}

async function notifyTenantOfAdminReply(conversation) {
  try {
    const notification = await notify.general(
      conversation.tenantId,
      "New Admin Reply",
      "You received a reply from LilyCrest Admin.",
      {
        actionUrl: "/(tabs)/chatbot",
        entityId: String(conversation._id),
      },
    );
    if (notification) {
      emitToUser(conversation.tenantId, "notification:new", notification);
    }
  } catch (error) {
    console.warn("Chat tenant notification failed:", error.message);
  }
}

async function markTenantMessagesRead(conversationId) {
  const now = new Date();
  await Promise.all([
    ChatConversation.findByIdAndUpdate(conversationId, {
      $set: { unreadAdminCount: 0 },
    }),
    ChatMessage.updateMany(
      { conversationId, senderRole: "tenant", readAt: null },
      { $set: { readAt: now } },
    ),
  ]);
}

async function markAdminMessagesRead(conversationId) {
  const now = new Date();
  await Promise.all([
    ChatConversation.findByIdAndUpdate(conversationId, {
      $set: { unreadTenantCount: 0 },
    }),
    ChatMessage.updateMany(
      {
        conversationId,
        senderRole: { $in: ["admin", ...OWNER_ROLE_VALUES] },
        readAt: null,
      },
      { $set: { readAt: now } },
    ),
  ]);
}

/**
 * POST /chat/:conversationId/typing
 *
 * Lightweight endpoint — no DB write.
 * Resolves the caller's role and name, then emits chat:typing to all branch
 * admins so the other side can render a "… is typing" indicator.
 * Fire-and-forget from the client every ~2s while composing.
 */
export async function broadcastTyping(req, res) {
  try {
    const { conversationId } = req.params;
    if (!conversationId) return res.status(400).json({ error: "Missing conversationId." });

    // Determine caller identity without heavy DB work —
    // the token already carries the role and we only need displayName.
    const dbUser = await getDbUser(req);
    const conversation = await ChatConversation.findById(
      ensureObjectId(conversationId),
    );
    if (!conversation) {
      throw createHttpError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
    }

    const role = String(req.authUser?.role || "").toLowerCase();
    const isAdmin = ADMIN_ROLES.has(role);
    if (isAdmin) {
      const adminContext = await resolveAdminContext(req);
      assertAdminConversationAccess(conversation, adminContext);
    } else if (String(conversation.tenantId) !== String(dbUser._id)) {
      throw createHttpError(
        "You do not have access to this conversation.",
        403,
        "CONVERSATION_ACCESS_DENIED",
      );
    }

    const senderName = displayName(dbUser, isAdmin ? "Admin" : "Tenant");
    const senderRole = isAdmin ? role : "tenant";

    emitToChatAdmins(conversation.branch, "chat:typing", {
      conversationId,
      senderRole,
      senderName,
    });

    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error, "Failed to broadcast typing event.");
  }
}

export async function startConversation(req, res) {
  try {
    const tenantContext = await resolveTenantContext(req);
    const tenantName = displayName(tenantContext.user, "Tenant");
    const tenantProfileImage = await resolveTenantProfileImage({
      tenantId: tenantContext.user._id,
      tenantEmail: tenantContext.user.email,
      tenantUserId: tenantContext.user.user_id,
      tenantProfileImage: tenantContext.user.profileImage,
      user: tenantContext.user,
      reservation: tenantContext.activeReservation,
    });

    let conversation = await ChatConversation.findOne({
      tenantId: tenantContext.user._id,
      status: { $in: ACTIVE_CONVERSATION_STATUSES },
    }).sort({ updatedAt: -1 });

    if (conversation) {
      conversation.tenantName = tenantName;
      conversation.tenantEmail = tenantContext.user.email || "";
      if (tenantProfileImage) {
        conversation.tenantProfileImage = tenantProfileImage;
      }
      conversation.branch = tenantContext.branch;
      conversation.roomNumber = tenantContext.roomNumber;
      conversation.roomBed = tenantContext.roomBed;
      if (!conversation.category) conversation.category = "general_inquiry";
      if (!conversation.priority) conversation.priority = "normal";
      await conversation.save();
    } else {
      const category = normalizeCategory(req.body?.category, { required: true });
      const priority = normalizePriority(req.body?.priority, category);
      conversation = await ChatConversation.create({
        tenantId: tenantContext.user._id,
        tenantUserId: tenantContext.user.user_id || "",
        tenantName,
        tenantEmail: tenantContext.user.email || "",
        tenantProfileImage,
        branch: tenantContext.branch,
        roomNumber: tenantContext.roomNumber,
        roomBed: tenantContext.roomBed,
        status: "open",
        category,
        priority,
        statusHistory: [
          {
            status: "open",
            note: "Conversation started.",
            actorId: tenantContext.user._id,
            actorName: tenantName,
            createdAt: new Date(),
          },
        ],
      });

      // Auto-assign based on category — reduces manual assignment workload
      await autoAssignConversation(conversation);
    }

    return res.json({ conversation: serializeConversation(conversation) });
  } catch (error) {
    return sendError(res, error, "Failed to start chat.");
  }
}

export async function getMyConversations(req, res) {
  try {
    const tenantContext = await resolveTenantContext(req);
    const conversations = await ChatConversation.find({
      tenantId: tenantContext.user._id,
    })
      .populate("tenantId", "profileImage firstName lastName email user_id")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(50)
      .lean();

    await batchResolveConversationPhotos(conversations);

    return res.json({
      conversations: conversations.map(serializeConversation),
    });
  } catch (error) {
    return sendError(res, error, "Failed to load conversations.");
  }
}

export async function getConversationMessages(req, res) {
  try {
    const tenantContext = await resolveTenantContext(req);
    const conversation = await findConversationForTenant(
      req.params.conversationId,
      tenantContext.user,
    );

    await markAdminMessagesRead(conversation._id);

    const messages = await ChatMessage.find({ conversationId: conversation._id })
      .populate("senderId", "profileImage firstName lastName role")
      .sort({ createdAt: 1 })
      .lean();

    const tenantPhoto = conversation.tenantProfileImage || (await resolveTenantProfileImage({
      tenantId: conversation.tenantId,
      tenantEmail: conversation.tenantEmail,
      tenantUserId: conversation.tenantUserId,
      tenantProfileImage: conversation.tenantProfileImage,
    }));

    if (tenantPhoto && !conversation.tenantProfileImage) {
      conversation.tenantProfileImage = tenantPhoto;
      ChatConversation.updateOne({ _id: conversation._id }, { $set: { tenantProfileImage: tenantPhoto } }).catch(() => {});
    }

    messages.forEach((m) => {
      if (m.senderRole === "tenant" && !m.senderProfileImage && tenantPhoto) {
        m.senderProfileImage = tenantPhoto;
      }
    });

    return res.json({ messages: messages.map(serializeMessage) });
  } catch (error) {
    return sendError(res, error, "Failed to load messages.");
  }
}

export async function sendTenantMessage(req, res) {
  try {
    const tenantContext = await resolveTenantContext(req);
    const conversation = await findConversationForTenant(
      req.params.conversationId,
      tenantContext.user,
    );

    if (conversation.status === "closed") {
      throw createHttpError("This conversation is closed.", 400, "CONVERSATION_CLOSED");
    }

    const message = normalizeMessage(req.body?.message);
    const result = await createMessageAndUpdateConversation({
      conversation,
      sender: tenantContext.user,
      senderRole: "tenant",
      message,
      unreadTarget: "admin",
      nextStatus: "open",
      statusNote: "Tenant replied.",
    });

    await notifyAdminsOfTenantMessage(result.conversation);

    const serializedMessage = serializeMessage(result.chatMessage);
    const serializedConversation = serializeConversation(result.conversation);

    // Emit both the lightweight message payload and the full conversation update.
    // message-new lets admin chat panels append the message without a full reload.
    // conversation-updated refreshes unread counts and list ordering.
    emitToChatAdmins(result.conversation.branch, "chat:message-new", {
      message: serializedMessage,
      conversationId: String(result.conversation._id),
    });
    emitToChatAdmins(
      result.conversation.branch,
      "chat:conversation-updated",
      serializedConversation,
    );

    return res.json({
      message: serializedMessage,
      conversation: serializedConversation,
    });
  } catch (error) {
    return sendError(res, error, "Failed to send message.");
  }
}

export async function getAdminConversations(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const filter = {};

    if (adminContext.isOwnerLike) {
      if (ROOM_BRANCHES.includes(req.query.branch)) {
        filter.branch = req.query.branch;
      }
    } else {
      filter.branch = adminContext.branch;
    }

    if (VALID_STATUSES.has(req.query.status)) {
      filter.status = req.query.status;
    }

    if (VALID_PRIORITIES.has(req.query.priority)) {
      filter.priority = req.query.priority;
    }

    if (VALID_CATEGORIES.has(req.query.category)) {
      filter.category = req.query.category;
    }

    if (req.query.assigned === "me" && adminContext.user?._id) {
      filter.assignedAdminId = adminContext.user._id;
    }

    if (req.query.unread === "true") {
      filter.unreadAdminCount = { $gt: 0 };
    }

    const search = String(req.query.search || "").trim();
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { tenantName: regex },
        { tenantEmail: regex },
        { roomNumber: regex },
        { roomBed: regex },
        { lastMessage: regex },
      ];
    }

    const conversations = await ChatConversation.find(filter)
      .populate("tenantId", "profileImage firstName lastName email user_id")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(200)
      .lean();

    await batchResolveConversationPhotos(conversations);

    conversations.sort((left, right) => {
      const priorityDiff =
        (PRIORITY_RANK[left.priority || "normal"] ?? 2) -
        (PRIORITY_RANK[right.priority || "normal"] ?? 2);
      if (priorityDiff !== 0) return priorityDiff;

      const unreadDiff =
        (right.unreadAdminCount || 0) - (left.unreadAdminCount || 0);
      if (unreadDiff !== 0) return unreadDiff;

      const leftDate = new Date(left.lastMessageAt || left.updatedAt || 0).getTime();
      const rightDate = new Date(right.lastMessageAt || right.updatedAt || 0).getTime();
      return rightDate - leftDate;
    });

    return res.json({
      conversations: conversations.map(serializeConversation),
      access: {
        role: adminContext.role,
        branch: adminContext.branch,
        canViewAllBranches: adminContext.isOwnerLike,
        adminId: adminContext.user?._id ? String(adminContext.user._id) : "",
        adminName: adminContext.displayName,
      },
    });
  } catch (error) {
    return sendError(res, error, "Failed to load admin conversations.");
  }
}

export async function getAdminConversationMessages(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const conversation = await findConversationForAdmin(
      req.params.conversationId,
      adminContext,
    );

    await markTenantMessagesRead(conversation._id);

    const messages = await ChatMessage.find({ conversationId: conversation._id })
      .populate("senderId", "profileImage firstName lastName role")
      .sort({ createdAt: 1 })
      .lean();

    const tenantPhoto = conversation.tenantProfileImage || (await resolveTenantProfileImage({
      tenantId: conversation.tenantId,
      tenantEmail: conversation.tenantEmail,
      tenantUserId: conversation.tenantUserId,
      tenantProfileImage: conversation.tenantProfileImage,
    }));

    if (tenantPhoto && !conversation.tenantProfileImage) {
      conversation.tenantProfileImage = tenantPhoto;
      ChatConversation.updateOne({ _id: conversation._id }, { $set: { tenantProfileImage: tenantPhoto } }).catch(() => {});
    }

    messages.forEach((m) => {
      if (m.senderRole === "tenant" && !m.senderProfileImage && tenantPhoto) {
        m.senderProfileImage = tenantPhoto;
      }
    });

    return res.json({ messages: messages.map(serializeMessage) });
  } catch (error) {
    return sendError(res, error, "Failed to load messages.");
  }
}

export async function sendAdminMessage(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const conversation = await findConversationForAdmin(
      req.params.conversationId,
      adminContext,
    );

    if (conversation.status === "closed") {
      throw createHttpError("This conversation is closed.", 400, "CONVERSATION_CLOSED");
    }

    const message = normalizeMessage(req.body?.message);
    const result = await createMessageAndUpdateConversation({
      conversation,
      sender: {
        ...adminContext.user,
        displayName: adminContext.displayName,
      },
      senderRole: adminContext.senderRole,
      message,
      unreadTarget: "tenant",
      nextStatus: "waiting_tenant",
      statusNote: "Admin replied and is waiting for tenant response.",
    });

    await notifyTenantOfAdminReply(result.conversation);
    emitToChatAdmins(
      result.conversation.branch,
      "chat:conversation-updated",
      serializeConversation(result.conversation),
    );

    return res.json({
      message: serializeMessage(result.chatMessage),
      conversation: serializeConversation(result.conversation),
    });
  } catch (error) {
    return sendError(res, error, "Failed to send message.");
  }
}

export async function markAdminConversationRead(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const conversation = await findConversationForAdmin(
      req.params.conversationId,
      adminContext,
    );

    await markTenantMessagesRead(conversation._id);
    const updated = await ChatConversation.findById(conversation._id);

    return res.json({ conversation: serializeConversation(updated) });
  } catch (error) {
    return sendError(res, error, "Failed to mark conversation as read.");
  }
}

export async function assignAdminConversation(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const conversation = await findConversationForAdmin(
      req.params.conversationId,
      adminContext,
    );

    let targetAdmin = adminContext.user;
    const requestedAdminId = req.body?.assignedAdminId;
    if (requestedAdminId && requestedAdminId !== "me") {
      if (!mongoose.Types.ObjectId.isValid(requestedAdminId)) {
        throw createHttpError("Assigned admin not found.", 404, "ADMIN_NOT_FOUND");
      }

      targetAdmin = await User.findById(requestedAdminId)
        .select("_id firstName lastName name fullName email role branch accountStatus isArchived")
        .lean();

      const targetRole = String(targetAdmin?.role || "").toLowerCase();
      if (
        !targetAdmin ||
        targetAdmin.isArchived ||
        targetAdmin.accountStatus === "banned" ||
        !ADMIN_ROLES.has(targetRole)
      ) {
        throw createHttpError("Assigned admin not found.", 404, "ADMIN_NOT_FOUND");
      }

      if (!adminContext.isOwnerLike && targetAdmin.branch !== adminContext.branch) {
        throw createHttpError(
          "You do not have access to assign this admin.",
          403,
          "ADMIN_ASSIGNMENT_DENIED",
        );
      }
    }

    conversation.assignedAdminId = targetAdmin?._id || null;
    conversation.assignedAdminName = displayName(targetAdmin, "Admin");
    await conversation.save();

    emitToChatAdmins(
      conversation.branch,
      "chat:conversation-updated",
      serializeConversation(conversation),
    );

    return res.json({ conversation: serializeConversation(conversation) });
  } catch (error) {
    return sendError(res, error, "Failed to assign conversation.");
  }
}

export async function updateAdminConversationStatus(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const conversation = await findConversationForAdmin(
      req.params.conversationId,
      adminContext,
    );

    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!VALID_STATUSES.has(status)) {
      throw createHttpError("Invalid conversation status.", 400, "INVALID_STATUS");
    }
    if (status === "closed") {
      throw createHttpError(
        "Use close conversation to close this chat.",
        400,
        "USE_CLOSE_ENDPOINT",
      );
    }
    if (conversation.status === "closed") {
      throw createHttpError("This conversation is closed.", 400, "CONVERSATION_CLOSED");
    }

    const note = normalizeOptionalNote(req.body?.note);
    if (conversation.status !== status) {
      conversation.status = status;
      conversation.statusHistory.push({
        status,
        note,
        actorId: adminContext.user?._id || null,
        actorName: adminContext.displayName,
        createdAt: new Date(),
      });
      await conversation.save();
    }

    emitToChatAdmins(
      conversation.branch,
      "chat:conversation-updated",
      serializeConversation(conversation),
    );

    return res.json({ conversation: serializeConversation(conversation) });
  } catch (error) {
    return sendError(res, error, "Failed to update conversation status.");
  }
}

export async function updateAdminConversationPriority(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const conversation = await findConversationForAdmin(
      req.params.conversationId,
      adminContext,
    );

    const priority = normalizePriority(req.body?.priority);
    conversation.priority = priority;
    await conversation.save();

    emitToChatAdmins(
      conversation.branch,
      "chat:conversation-updated",
      serializeConversation(conversation),
    );

    return res.json({ conversation: serializeConversation(conversation) });
  } catch (error) {
    return sendError(res, error, "Failed to update conversation priority.");
  }
}

export async function closeAdminConversation(req, res) {
  try {
    const adminContext = await resolveAdminContext(req);
    const conversation = await findConversationForAdmin(
      req.params.conversationId,
      adminContext,
    );
    const closingNote = normalizeNote(
      req.body?.note,
      "Please enter a closing note.",
    );

    if (conversation.status !== "closed") {
      conversation.status = "closed";
      conversation.closedAt = new Date();
      conversation.closedBy = adminContext.user?._id || null;
      conversation.closingNote = closingNote;
      conversation.statusHistory.push({
        status: "closed",
        note: closingNote,
        actorId: adminContext.user?._id || null,
        actorName: adminContext.displayName,
        createdAt: new Date(),
      });
      await conversation.save();
    }

    emitToChatAdmins(
      conversation.branch,
      "chat:conversation-updated",
      serializeConversation(conversation),
    );

    return res.json({ conversation: serializeConversation(conversation) });
  } catch (error) {
    return sendError(res, error, "Failed to close conversation.");
  }
}
