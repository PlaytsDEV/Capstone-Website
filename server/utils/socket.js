/**
 * ============================================================================
 * SOCKET.IO SERVER
 * ============================================================================
 *
 * Real-time event broadcasting for:
 * - New notifications (bell icon updates instantly)
 * - Reservation status changes (admin ↔ tenant)
 * - Maintenance request updates
 *
 * USAGE (from any controller/service):
 *   import { getIO } from "../utils/socket.js";
 *   getIO().to(`user:${userId}`).emit("notification:new", payload);
 *
 * ============================================================================
 */

import { Server } from "socket.io";
import logger from "../middleware/logger.js";
import { getAuth } from "../config/firebase.js";
import { User } from "../models/index.js";
import { ROOM_BRANCHES, isValidRoomBranch } from "../config/branches.js";
import { isOwnerRole } from "../config/roles.js";
import { normalizePermissions } from "../config/accessControl.js";

let io = null;

const CHAT_ADMIN_PERMISSION = "manageUsers";

const adminBranchRoom = (branch) => `admins:branch:${branch}`;

const getSocketOrigin = (socket) => socket.handshake.headers?.origin || "";
const getSocketTransport = (socket) =>
  socket.conn?.transport?.name ||
  socket.handshake.query?.transport ||
  "unknown";

export function createSocketAuthenticator({ getFirebaseAuth = getAuth, findUser } = {}) {
  const loadUser = findUser || (async (uid) => User.findOne({ firebaseUid: uid })
    .select("_id role permissions branch accountStatus isActive isArchived")
    .lean());
  return async (socket, next) => {
    const origin = getSocketOrigin(socket);
    const transport = getSocketTransport(socket);
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const auth = getFirebaseAuth();
      if (!auth) return next(new Error("Authentication unavailable"));
      const decoded = await auth.verifyIdToken(token, true);
      const dbUser = await loadUser(decoded.uid);
      if (!dbUser || dbUser.isArchived || dbUser.isActive === false || dbUser.accountStatus !== "active") {
        logger.warn({ socketId: socket.id, origin, transport, firebaseUid: decoded.uid, userId: dbUser?._id ? String(dbUser._id) : null }, "Socket authentication rejected user");
        return next(new Error("User not allowed"));
      }
      socket.data.authUser = {
        userId: dbUser._id ? String(dbUser._id) : "",
        role: String(dbUser.role || "").toLowerCase(),
        permissions: normalizePermissions(dbUser.permissions),
        branch: isValidRoomBranch(dbUser.branch) ? dbUser.branch : null,
        accountStatus: dbUser.accountStatus,
      };
      return next();
    } catch (error) {
      logger.warn({ err: error, socketId: socket.id, origin, transport }, "Socket authentication failed");
      return next(new Error("Authentication failed"));
    }
  };
}

export function joinAuthorizedSocketRooms(socket) {
  const authUser = socket.data.authUser;
  const userId = authUser?.userId || "";
  const role = authUser?.role || "";

  if (userId) socket.join(`user:${userId}`);

  if (isOwnerRole(role)) {
    socket.join("admins");
    socket.join("admins:all");
    return;
  }

  const canManageChat =
    role === "branch_admin" &&
    authUser.permissions.includes(CHAT_ADMIN_PERMISSION);
  if (!canManageChat) return;

  if (!isValidRoomBranch(authUser.branch)) {
    logger.warn(
      { socketId: socket.id, userId, role },
      "Socket admin room access rejected invalid database branch",
    );
    return;
  }

  socket.join("admins");
  socket.join(adminBranchRoom(authUser.branch));
}

/**
 * Initialize Socket.IO on an existing HTTP server
 * @param {import("http").Server} httpServer
 * @param {Object} options
 * @param {string[]} options.allowedOrigins - CORS origins for logging/debug
 * @param {(origin?: string) => boolean} options.isOriginAllowed - shared CORS matcher
 */
export function initSocket(httpServer, options = {}) {
  const {
    allowedOrigins = [],
    isOriginAllowed = () => true,
  } = Array.isArray(options)
    ? { allowedOrigins: options, isOriginAllowed: (origin) => !origin || options.includes(origin) }
    : options;

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        logger.warn({ origin }, "Socket.IO CORS rejected origin");
        callback(new Error("Not allowed by Socket.IO CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  io.engine.on("connection_error", (error) => {
    logger.warn(
      {
        code: error.code,
        message: error.message,
        context: error.context,
        origin: error.req?.headers?.origin,
        transport: error.req?._query?.transport,
      },
      "Socket.IO engine connection error",
    );
  });

  io.use(createSocketAuthenticator());

  io.on("connection", (socket) => {
    const authUser = socket.data.authUser;
    const userId = authUser?.userId || "";
    const role = authUser?.role || "";
    const origin = getSocketOrigin(socket);

    joinAuthorizedSocketRooms(socket);

    logger.info(
      {
        socketId: socket.id,
        userId,
        role,
        branch: authUser?.branch || null,
        origin,
        transport: getSocketTransport(socket),
      },
      "Socket connected",
    );

    socket.conn.once("upgrade", (transport) => {
      logger.info(
        {
          socketId: socket.id,
          userId,
          origin,
          transport: transport.name,
        },
        "Socket transport upgraded",
      );
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        {
          socketId: socket.id,
          userId,
          origin,
          transport: getSocketTransport(socket),
          reason,
        },
        "Socket disconnected",
      );
      // Cleanup handled automatically by Socket.IO
    });

    socket.on("error", (error) => {
      logger.warn(
        {
          err: error,
          socketId: socket.id,
          userId,
          origin,
          transport: getSocketTransport(socket),
        },
        "Socket error",
      );
    });
  });

  logger.info({ allowedOrigins }, "Socket.IO initialized");
  return io;
}

/**
 * Get the Socket.IO instance (use after initSocket)
 * @returns {Server|null}
 */
export function getIO() {
  return io;
}

/**
 * Emit a notification to a specific user
 * @param {string} userId - MongoDB user _id
 * @param {Object} notification - The notification payload
 */
export function emitToUser(userId, event, payload) {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

/**
 * Emit an event to all admins
 * @param {string} event - Event name
 * @param {Object} payload - Data to send
 */
export function emitToAdmins(event, payload) {
  if (io) {
    io.to("admins").emit(event, payload);
  }
}

export function emitToChatAdminRooms(ioServer, branch, event, payload) {
  if (ioServer && ROOM_BRANCHES.includes(branch)) {
    ioServer.to(adminBranchRoom(branch)).to("admins:all").emit(event, payload);
  }
}

/**
 * Emit a sensitive admin event to only the conversation branch plus owners.
 * Branch admins receive only their assigned branch; owner-like users receive all.
 */
export function emitToChatAdmins(branch, event, payload) {
  emitToChatAdminRooms(io, branch, event, payload);
}

/**
 * Broadcast room availability update to ALL connected clients.
 * Called after any occupancy change so every open browser refreshes
 * the affected room card without needing a manual page reload.
 *
 * @param {string|ObjectId} roomId - The room that changed
 * @param {Object} data - Partial room data to attach (occupancy, available, capacity)
 */
export function emitRoomUpdate(roomId, data = {}) {
  if (io) {
    io.emit("room:updated", { roomId: String(roomId), ...data });
  }
}

