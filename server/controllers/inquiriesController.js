/**
 * Inquiry Controllers
 */

import dayjs from "dayjs";
import { Inquiry, User } from "../models/index.js";
import { sendInquiryResponseEmail } from "../config/email.js";
import auditLogger from "../utils/auditLogger.js";
import { createNotification } from "../services/notifications/notificationService.js";
import {
  sendSuccess,
  sendError,
  AppError,
} from "../middleware/errorHandler.js";

export const getInquiryStats = async (req, res, next) => {
  try {
    const matchQuery = { isArchived: { $ne: true } };
    if (req.branchFilter) {
      matchQuery.$or = [
        { preferredBranch: req.branchFilter },
        { branch: req.branchFilter },
      ];
    }

    // Get counts by status
    const statusCounts = await Inquiry.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Owners can request branch-wide counts across all branches.
    let branchCounts = [];
    if (req.isOwner) {
      branchCounts = await Inquiry.aggregate([
        { $match: { isArchived: { $ne: true } } },
        {
          $group: {
            _id: { $ifNull: ["$preferredBranch", "$branch"] },
            count: { $sum: 1 },
          },
        },
      ]);
    }

    // Get total and recent counts
    const total = await Inquiry.countDocuments(matchQuery);
    const sevenDaysAgo = dayjs().subtract(7, "day").toDate();
    const recentCount = await Inquiry.countDocuments({
      ...matchQuery,
      createdAt: { $gte: sevenDaysAgo },
    });

    // Format response
    const stats = {
      total,
      recentCount,
      byStatus: { pending: 0, "in-progress": 0, resolved: 0, closed: 0 },
      byBranch: {},
    };

    statusCounts.forEach((item) => {
      if (item._id) stats.byStatus[item._id] = item.count;
    });
    branchCounts.forEach((item) => {
      if (item._id) stats.byBranch[item._id] = item.count;
    });

    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getInquiriesByBranch = async (req, res, next) => {
  try {
    const { branch } = req.params;

    const validBranches = ["gil-puyat", "guadalupe", "general"];
    if (!validBranches.includes(branch)) {
      return res.status(400).json({
        error: "Invalid branch. Must be 'gil-puyat', 'guadalupe', or 'general'",
        code: "INVALID_BRANCH",
      });
    }

    const inquiries = await Inquiry.find({
      $or: [{ preferredBranch: branch }, { branch }],
    })
      .sort({ createdAt: -1 })
      .populate("respondedBy", "firstName lastName email")
      .select("-__v");

    const formatted = inquiries.map((inq) => {
      const item = inq.toObject ? inq.toObject({ virtuals: true }) : { ...inq };
      item.name = item.name || item.fullName || `${item.firstName || ""} ${item.lastName || ""}`.trim() || "Unknown";
      item.fullName = item.fullName || item.name;
      item.phone = item.phone || item.contactNumber || "N/A";
      item.contactNumber = item.contactNumber || item.phone;
      return item;
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getInquiries = async (req, res, next) => {
  try {
    const {
      status,
      branch,
      search,
      page = 1,
      limit = 20,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    // Build query with branch filter
    const queryConditions = [{ isArchived: { $ne: true } }];

    const targetBranch = req.branchFilter || branch;
    if (targetBranch) {
      queryConditions.push({
        $or: [
          { preferredBranch: targetBranch },
          { branch: targetBranch },
        ],
      });
    }

    if (status) {
      // Map frontend "responded" to backend "resolved"
      queryConditions.push({
        status: status === "responded" ? "resolved" : status,
      });
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      queryConditions.push({
        $or: [
          { name: regex },
          { fullName: regex },
          { email: regex },
          { subject: regex },
        ],
      });
    }

    const query =
      queryConditions.length === 1
        ? queryConditions[0]
        : { $and: queryConditions };

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOrder = order === "asc" ? 1 : -1;
    const sortOptions = { [sort]: sortOrder };

    const [inquiries, total] = await Promise.all([
      Inquiry.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("respondedBy", "firstName lastName email")
        .select("-__v"),
      Inquiry.countDocuments(query),
    ]);

    const formattedInquiries = inquiries.map((inq) => {
      const item = inq.toObject ? inq.toObject({ virtuals: true }) : { ...inq };
      item.name = item.name || item.fullName || `${item.firstName || ""} ${item.lastName || ""}`.trim() || "Unknown";
      item.fullName = item.fullName || item.name;
      item.phone = item.phone || item.contactNumber || "N/A";
      item.contactNumber = item.contactNumber || item.phone;
      return item;
    });

    res.json({
      inquiries: formattedInquiries,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getInquiryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid inquiry ID format",
        code: "INVALID_INQUIRY_ID",
      });
    }

    const query = { _id: id };
    if (req.branchFilter) {
      query.$or = [
        { preferredBranch: req.branchFilter },
        { branch: req.branchFilter },
      ];
    }

    const inquiry = await Inquiry.findOne(query)
      .populate("respondedBy", "firstName lastName email")
      .select("-__v");

    if (!inquiry) {
      return res.status(404).json({
        error: "Inquiry not found or access denied",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    const item = inquiry.toObject ? inquiry.toObject({ virtuals: true }) : { ...inquiry };
    item.name = item.name || item.fullName || `${item.firstName || ""} ${item.lastName || ""}`.trim() || "Unknown";
    item.fullName = item.fullName || item.name;
    item.phone = item.phone || item.contactNumber || "N/A";
    item.contactNumber = item.contactNumber || item.phone;

    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const createInquiry = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message, branch, source, sourceNote } = req.body;

    if (!name || !email || !subject || !message || !branch) {
      return res.status(400).json({
        error:
          "Missing required fields. Please fill out your name, email, subject, message, and preferred branch.",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
        code: "INVALID_EMAIL",
      });
    }

    const validBranches = ["gil-puyat", "guadalupe", "general"];
    if (!validBranches.includes(branch)) {
      return res.status(400).json({
        error: "Please select a valid branch (Gil Puyat or Guadalupe).",
        code: "INVALID_BRANCH",
      });
    }

    const inquirySource = source || "website";
    const resolvedSourceNote =
      inquirySource === "other"
        ? (sourceNote?.trim() || "Website Contact Form")
        : (sourceNote?.trim() || null);

    const inquiry = new Inquiry({
      fullName: name.trim(),
      name: name.trim(),
      contactNumber: phone?.trim() || "N/A",
      phone: phone?.trim() || "N/A",
      email: email.toLowerCase().trim(),
      subject: subject.trim(),
      message: message.trim(),
      branch,
      preferredBranch: branch,
      source: inquirySource,
      sourceNote: resolvedSourceNote,
      status: "pending",
    });

    await inquiry.save();

    // Create automated notification for admin users
    try {
      const adminUsers = await User.find({
        role: { $in: ["admin", "super-admin"] },
        isActive: { $ne: false },
      }).select("_id branch role");

      for (const admin of adminUsers) {
        if (
          admin.role === "super-admin" ||
          !admin.branch ||
          admin.branch === branch ||
          branch === "general"
        ) {
          await createNotification(
            admin._id,
            "inquiry_new",
            "New Customer Inquiry Received",
            `New inquiry from ${name.trim()} (${email.toLowerCase().trim()}) regarding "${subject.trim()}".`,
            {
              actionUrl: "/admin/reservations?tab=inquiries",
              entityType: "Inquiry",
              entityId: inquiry._id,
            }
          );
        }
      }
    } catch (notifErr) {
      console.error("⚠️ Failed to create admin inquiry notification:", notifErr);
    }

    res.status(201).json({
      message: "Inquiry submitted successfully. We will get back to you soon!",
      inquiryId: inquiry._id,
      inquiry,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Unable to submit inquiry. Please check all fields and try again.",
        code: "VALIDATION_ERROR",
      });
    }
    next(error);
  }
};

export const updateInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid inquiry ID format",
        code: "INVALID_INQUIRY_ID",
      });
    }

    const query = { _id: id };
    if (req.branchFilter) {
      query.$or = [
        { preferredBranch: req.branchFilter },
        { branch: req.branchFilter },
      ];
    }

    const existingInquiry = await Inquiry.findOne(query);
    if (!existingInquiry) {
      return res.status(404).json({
        error: "Inquiry not found or access denied",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;

    let emailSent = null; // null = no email attempted

    // Handle response submission using the model's respond method
    if (req.body.response && req.body.response.trim()) {
      const adminUser = await User.findOne({ firebaseUid: req.user.uid });
      if (!adminUser) {
        return res.status(403).json({
          error: "Admin user not found",
          code: "ADMIN_NOT_FOUND",
        });
      }

      // Use the model's respond method which sets status to "resolved"
      await existingInquiry.respond(req.body.response.trim(), adminUser._id);

      // Remove response from updateData since it's already handled
      delete updateData.response;
      delete updateData.status; // Status is set by respond() method

      // Send email notification to customer
      const branchNameMap = {
        "gil-puyat": "Gil Puyat",
        guadalupe: "Guadalupe",
        general: "Lilycrest",
      };
      const branchName =
        branchNameMap[existingInquiry.branch] || "Lilycrest";

      emailSent = false;
      let emailErrorDetails = null;
      try {
        const emailResult = await sendInquiryResponseEmail({
          to: existingInquiry.email,
          customerName: existingInquiry.name,
          inquirySubject: existingInquiry.subject,
          response: req.body.response.trim(),
          branchName,
        });

        emailSent = emailResult.success;
        if (!emailResult.success) {
          emailErrorDetails = emailResult.error || emailResult.message;
          console.error(
            `[INQUIRY] Email failed for inquiry ${id} to ${existingInquiry.email}:`,
            emailErrorDetails,
          );
        }
      } catch (emailErr) {
        emailErrorDetails = emailErr.message;
        console.error(
          `[INQUIRY] Email error for inquiry ${id}:`,
          emailErr.message,
        );
      }

    }

    // Apply any remaining updates (excluding response which is handled above)
    if (Object.keys(updateData).length > 0) {
      if (updateData.status) {
        const validStatuses = ["pending", "in-progress", "resolved", "closed"];
        if (!validStatuses.includes(updateData.status)) {
          return res.status(400).json({
            error:
              "Invalid status. Must be: pending, in-progress, resolved, or closed",
            code: "INVALID_STATUS",
          });
        }
      }

      await Inquiry.findByIdAndUpdate(id, updateData, {
        runValidators: true,
      });
    }

    // Fetch the updated inquiry with populated fields
    const inquiry = await Inquiry.findById(id).populate(
      "respondedBy",
      "firstName lastName email",
    );

    res.json({
      message: "Inquiry updated successfully",
      inquiry,
      emailSent,
      emailError: emailSent === false ? (emailErrorDetails || "Failed to deliver email to customer address.") : undefined,
    });

    try {
      const { emitToAdmins } = await import("../utils/socket.js");
      emitToAdmins("inquiry:updated", {
        inquiryId: String(id),
        status: inquiry?.status,
      });
    } catch (socketErr) {
      // non-fatal
    }
  } catch (error) {
    next(error);
  }
};

export const deleteInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid inquiry ID format",
        code: "INVALID_INQUIRY_ID",
      });
    }

    const query = { _id: id };
    if (req.branchFilter) {
      query.$or = [
        { preferredBranch: req.branchFilter },
        { branch: req.branchFilter },
      ];
    }

    const inquiry = await Inquiry.findOne(query);
    if (!inquiry) {
      return res.status(404).json({
        error: "Inquiry not found or access denied",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    // Store data for audit log before archiving
    const inquiryDataBeforeArchive = inquiry.toObject();

    // Soft delete using isArchived flag
    // Find the admin user for archivedBy reference
    const adminUser = await User.findOne({ firebaseUid: req.user.uid });

    inquiry.isArchived = true;
    inquiry.archivedAt = new Date();
    inquiry.archivedBy = adminUser?._id || null;
    await inquiry.save();

    // Log inquiry deletion/archive
    await auditLogger.logDeletion(
      req,
      "inquiry",
      id,
      inquiryDataBeforeArchive,
      "Inquiry archived",
    );

    res.json({
      message: "Inquiry archived successfully",
      archivedId: id,
      branch: inquiry.branch,
    });
  } catch (error) {
    await auditLogger.logError(req, error, "Failed to archive inquiry");
    next(error);
  }
};
