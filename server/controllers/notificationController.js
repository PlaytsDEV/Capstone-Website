/**
 * ============================================================================
 * NOTIFICATION CONTROLLER
 * ============================================================================
 *
 * Handles notification retrieval and management for users.
 *
 * ============================================================================
 */

import Notification from "../models/Notification.js";
import { User } from "../models/index.js";
import { getNotificationVisibilityFilterForUser } from "../utils/notificationVisibility.js";
import {
  sendSuccess,
  AppError,
} from "../middleware/errorHandler.js";

const getNotificationVisibilityOptions = (user) => ({
  visibilityFilter: getNotificationVisibilityFilterForUser(user),
});

/**
 * GET /api/notifications
 * Get notifications for the authenticated user (paginated).
 */
export const getMyNotifications = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const { page = 1, limit = 20, unreadOnly } = req.query;
    const result = await Notification.getForUser(dbUser._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === "true",
      ...getNotificationVisibilityOptions(dbUser),
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:notificationId/read
 * Mark a single notification as read.
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: dbUser._id,
      ...getNotificationVisibilityFilterForUser(dbUser),
    });
    if (!notification) throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");

    await notification.markAsRead();
    sendSuccess(res, { message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the authenticated user.
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const result = await Notification.markAllAsRead(
      dbUser._id,
      getNotificationVisibilityOptions(dbUser),
    );
    sendSuccess(res, { message: "All notifications marked as read", modifiedCount: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the authenticated user.
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).lean();
    if (!dbUser) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const visibilityOptions = getNotificationVisibilityOptions(dbUser);
    const filter = {
      $and: [
        { userId: dbUser._id, isRead: false },
        visibilityOptions.visibilityFilter,
      ],
    };
    const count = await Notification.countDocuments(filter);
    sendSuccess(res, { unreadCount: count });
  } catch (error) {
    next(error);
  }
};
