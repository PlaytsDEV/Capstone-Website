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
import { ROOM_BRANCHES } from "../config/branches.js";
import { ADMIN_ROLE_VALUES, isOwnerRole } from "../config/roles.js";

let io = null;

const ADMIN_ROLES = new Set(ADMIN_ROLE_VALUES);

const adminBranchRoom = (branch) => `admins:branch:${branch}`;
const isOwnerLike = (role, claims = {}) =>
  isOwnerRole(role) || Boolean(claims.owner || claims.superadmin);

const getSocketOrigin = (socket) => socket.handshake.headers?.origin || "";
const getSocketTransport = (socket) =>
  socket.conn?.transport?.name ||
  socket.handshake.query?.transport ||
  "unknown";

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

  io.use(async (socket, next) => {
    const origin = getSocketOrigin(socket);
    const transport = getSocketTransport(socket);

    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        logger.warn(
          { socketId: socket.id, origin, transport },
          "Socket authentication missing token",
        );
        return next(new Error("Authentication required"));
      }

      const auth = getAuth();
      if (!auth) {
        logger.warn(
          { socketId: socket.id, origin, transport },
          "Socket authentication unavailable",
        );
        return next(new Error("Authentication unavailable"));
      }

      const decoded = await auth.verifyIdToken(token);
      const dbUser = await User.findOne({ firebaseUid: decoded.uid })
        .select("_id role branch accountStatus isArchived")
        .lean();

      if (!dbUser || dbUser.isArchived || dbUser.accountStatus !== "active") {
        logger.warn(
          {
            socketId: socket.id,
            origin,
            transport,
            firebaseUid: decoded.uid,
            userId: dbUser?._id ? String(dbUser._id) : null,
            accountStatus: dbUser?.accountStatus,
            isArchived: dbUser?.isArchived,
          },
          "Socket authentication rejected user",
        );
        return next(new Error("User not allowed"));
      }

      socket.data.user = dbUser;
      socket.data.claims = decoded;
      return next();
    } catch (error) {
      logger.warn(
        { err: error, socketId: socket.id, origin, transport },
        "Socket authentication failed",
      );
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const dbUser = socket.data.user;
    const claims = socket.data.claims || {};
    const userId = dbUser?._id ? String(dbUser._id) : "";
    const role = String(dbUser?.role || "").toLowerCase();
    const origin = getSocketOrigin(socket);

    if (userId) {
      socket.join(`user:${userId}`);
    }

    if (ADMIN_ROLES.has(role) || claims.branch_admin || claims.owner || claims.superadmin /* legacy */) {
      socket.join("admins");

      if (isOwnerLike(role, claims)) {
        socket.join("admins:all");
      } else if (ROOM_BRANCHES.includes(dbUser.branch)) {
        socket.join(adminBranchRoom(dbUser.branch));
      }
    }

    logger.info(
      {
        socketId: socket.id,
        userId,
        role,
        branch: dbUser?.branch || null,
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

/**
 * Emit a sensitive admin event to only the conversation branch plus owners.
 * Branch admins receive only their assigned branch; owner-like users receive all.
 */
export function emitToChatAdmins(branch, event, payload) {
  if (io && ROOM_BRANCHES.includes(branch)) {
    io.to(adminBranchRoom(branch)).to("admins:all").emit(event, payload);
  }
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

