/**
 * Inquiry Controllers
 */

import dayjs from "dayjs";
import { Inquiry, User } from "../models/index.js";
import { sendInquiryResponseEmail } from "../config/email.js";
import auditLogger from "../utils/auditLogger.js";
import { createNotification, notifyBranchAdmins } from "../services/notifications/notificationService.js";
import {
  sendSuccess,
  sendError,
  AppError,
} from "../middleware/errorHandler.js";

export const getInquiryStats = async (req, res, next) => {
  try {
    const matchQuery = { isArchived: { $ne: true } };
    const targetBranch = req.branchFilter || req.query?.branch;
    if (targetBranch && targetBranch !== "all") {
      matchQuery.$or = [
        { preferredBranch: targetBranch },
        { branch: targetBranch },
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
      timeframe,
      startDate,
      endDate,
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

    if (timeframe && timeframe !== "all") {
      const now = dayjs();
      let fromDate;
      if (timeframe === "7d") fromDate = now.subtract(7, "day").startOf("day").toDate();
      else if (timeframe === "30d") fromDate = now.subtract(30, "day").startOf("day").toDate();
      else if (timeframe === "90d") fromDate = now.subtract(90, "day").startOf("day").toDate();
      else if (timeframe === "365d") fromDate = now.subtract(365, "day").startOf("day").toDate();

      if (fromDate) {
        queryConditions.push({
          createdAt: { $gte: fromDate },
        });
      }
    } else if (startDate || endDate) {
      const dateCond = {};
      if (startDate) dateCond.$gte = dayjs(startDate).startOf("day").toDate();
      if (endDate) dateCond.$lte = dayjs(endDate).endOf("day").toDate();
      queryConditions.push({ createdAt: dateCond });
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

const formatChannelLabel = (value) => {
  if (!value) return "Direct";
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const getKanbanBoard = async (req, res, next) => {
  try {
    const matchQuery = { isArchived: { $ne: true } };
    if (req.branchFilter) {
      matchQuery.$or = [
        { preferredBranch: req.branchFilter },
        { branch: req.branchFilter },
      ];
    }

    const inquiries = await Inquiry.find(matchQuery)
      .sort({ createdAt: -1 })
      .lean();

    const board = {
      new: [],
      viewing: [],
      converted: [],
    };

    inquiries.forEach((inq) => {
      const formatted = {
        _id: String(inq._id),
        name:
          inq.name ||
          inq.fullName ||
          `${inq.firstName || ""} ${inq.lastName || ""}`.trim() ||
          "Guest",
        fullName: inq.fullName || inq.name,
        email: inq.email || "",
        phone: inq.phone || inq.contactNumber || "N/A",
        contactNumber: inq.contactNumber || inq.phone,
        channel: formatChannelLabel(inq.source || "website"),
        source: inq.source || "website",
        message: inq.message || inq.notes || "",
        status: inq.status || "pending",
        viewingStatus: inq.viewingStatus || "new",
        branch: inq.branch || inq.preferredBranch || "general",
        preferredBranch: inq.preferredBranch || inq.branch,
        preferredRoomType: inq.preferredRoomType,
        createdAt: inq.createdAt,
      };

      const viewingStatus = inq.viewingStatus || "new";
      const status = inq.status || "pending";

      if (
        viewingStatus === "converted_to_application" ||
        status === "resolved" ||
        status === "closed"
      ) {
        board.converted.push(formatted);
      } else if (
        viewingStatus === "viewing_scheduled" ||
        viewingStatus === "viewing_completed" ||
        viewingStatus === "viewing_waived" ||
        status === "in-progress"
      ) {
        board.viewing.push(formatted);
      } else {
        board.new.push(formatted);
      }
    });

    res.json({
      success: true,
      data: board,
    });
  } catch (error) {
    next(error);
  }
};

export const getMarketingRoi = async (req, res, next) => {
  try {
    const matchQuery = { isArchived: { $ne: true } };
    if (req.branchFilter) {
      matchQuery.$or = [
        { preferredBranch: req.branchFilter },
        { branch: req.branchFilter },
      ];
    }

    const inquiries = await Inquiry.find(matchQuery).lean();

    const channelMap = new Map();
    const standardChannels = [
      "website",
      "facebook",
      "tiktok",
      "instagram",
      "text_message",
      "walk_in",
      "building_signage",
      "referral",
      "other",
    ];

    standardChannels.forEach((ch) => {
      channelMap.set(ch, {
        channel: formatChannelLabel(ch),
        source: ch,
        totalLeads: 0,
        viewingsScheduled: 0,
        convertedCount: 0,
      });
    });

    inquiries.forEach((inq) => {
      const sourceKey = (inq.source || "website").toLowerCase();
      if (!channelMap.has(sourceKey)) {
        channelMap.set(sourceKey, {
          channel: formatChannelLabel(sourceKey),
          source: sourceKey,
          totalLeads: 0,
          viewingsScheduled: 0,
          convertedCount: 0,
        });
      }
      const ch = channelMap.get(sourceKey);
      ch.totalLeads += 1;

      const vStatus = inq.viewingStatus || "";
      if (
        vStatus === "viewing_scheduled" ||
        vStatus === "viewing_completed" ||
        inq.viewingDate
      ) {
        ch.viewingsScheduled += 1;
      }
      if (
        vStatus === "converted_to_application" ||
        inq.status === "resolved"
      ) {
        ch.convertedCount += 1;
      }
    });

    const report = Array.from(channelMap.values())
      .map((item) => {
        const conversionRate =
          item.totalLeads > 0
            ? Math.round((item.convertedCount / item.totalLeads) * 100)
            : 0;
        return {
          ...item,
          conversionRate,
        };
      })
      .filter((item) => item.totalLeads > 0 || standardChannels.slice(0, 5).includes(item.source))
      .sort((a, b) => b.totalLeads - a.totalLeads);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

export const convertToApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "The specified inquiry identifier is invalid.",
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
        error: "The requested inquiry record could not be found or you do not have permission to access it.",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    const adminUser = await User.findOne({ firebaseUid: req.user.uid });

    inquiry.viewingStatus = "converted_to_application";
    inquiry.status = "resolved";
    inquiry.convertedToApplicationAt = new Date();
    inquiry.convertedBy = adminUser?._id || null;
    await inquiry.save();

    await auditLogger.logUpdate(
      req,
      "inquiry",
      id,
      { viewingStatus: "converted_to_application", status: "resolved" },
      "Inquiry converted to application",
    );

    res.json({
      success: true,
      message: "Inquiry successfully converted to tenant application.",
      inquiry,
    });
  } catch (error) {
    next(error);
  }
};

export const scheduleViewing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { viewingDate, viewingTime, notes } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "The specified inquiry identifier is invalid.",
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
        error: "The requested inquiry record could not be found or you do not have permission to access it.",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    inquiry.viewingStatus = "viewing_scheduled";
    inquiry.status = "in-progress";
    if (viewingDate) inquiry.viewingDate = new Date(viewingDate);
    if (viewingTime) inquiry.viewingTime = viewingTime;
    if (notes) inquiry.notes = notes;
    await inquiry.save();

    res.json({
      success: true,
      message: "Viewing schedule successfully recorded.",
      inquiry,
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
        error: "The specified inquiry identifier is invalid.",
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
        error: "The requested inquiry record could not be found or you do not have permission to access it.",
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

    let authUserId = req.authUser?._id || null;
    if (!authUserId && req.user?.uid) {
      const foundUser = await User.findOne({ firebaseUid: req.user.uid }).select("_id").lean();
      if (foundUser?._id) authUserId = foundUser._id;
    }

    const inquiry = new Inquiry({
      user: authUserId,
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
      const userTag = authUserId ? " (Registered User)" : "";
      await notifyBranchAdmins(
        branch,
        "inquiry_new",
        "New Customer Inquiry Received",
        `New inquiry from ${name.trim()}${userTag} (${email.toLowerCase().trim()}) regarding "${subject.trim()}".`,
        {
          actionUrl: "/admin/reservations?tab=inquiries",
          entityType: "Inquiry",
          entityId: inquiry._id,
        }
      );
    } catch (notifErr) {
      console.error("⚠️ Failed to create admin inquiry notification:", notifErr);
    }

    res.status(201).json({
      success: true,
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
        error: "The specified inquiry identifier is invalid.",
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
        error: "The requested inquiry record could not be found or you do not have permission to access it.",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;

    let emailSent = null; // null = no email attempted
    let emailErrorDetails = null;

    // Handle response submission using the model's respond method
    if (req.body.response && req.body.response.trim()) {
      const adminUser = await User.findOne({ firebaseUid: req.user.uid });
      if (!adminUser) {
        return res.status(403).json({
          error: "Your staff account record could not be found. Please verify your session and try again.",
          code: "ADMIN_NOT_FOUND",
        });
      }

      // Send email notification to customer
      const branchNameMap = {
        "gil-puyat": "Gil Puyat",
        guadalupe: "Guadalupe",
        general: "Lilycrest",
      };
      const branchName =
        branchNameMap[existingInquiry.branch] ||
        branchNameMap[existingInquiry.preferredBranch] ||
        "Lilycrest";

      emailSent = false;
      const attemptTime = new Date();
      try {
        const emailResult = await sendInquiryResponseEmail({
          to: existingInquiry.email,
          customerName: existingInquiry.name || existingInquiry.fullName || "Valued Customer",
          inquirySubject: existingInquiry.subject || "General Inquiry",
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

      // Use the model's respond method which sets status to "resolved" and tracks email outcome
      await existingInquiry.respond(req.body.response.trim(), adminUser._id, {
        emailDeliveryStatus: emailSent ? "sent" : "failed",
        emailDeliveryError: emailSent
          ? null
          : (emailErrorDetails || "Automated email could not be delivered to the recipient address."),
        emailLastAttemptAt: attemptTime,
      });

      // Remove response from updateData since it's already handled
      delete updateData.response;
      delete updateData.status; // Status is set by respond() method
    }

    // Apply any remaining updates (excluding response which is handled above)
    if (Object.keys(updateData).length > 0) {
      if (updateData.status) {
        const validStatuses = ["pending", "in-progress", "resolved", "closed"];
        if (!validStatuses.includes(updateData.status)) {
          return res.status(400).json({
            error:
              "The specified status is invalid. Please select from: pending, in-progress, resolved, or closed.",
            code: "INVALID_STATUS",
          });
        }
      }

      await Inquiry.findByIdAndUpdate(id, updateData, {
        runValidators: true,
      });
    }

    // Fetch the updated inquiry with populated fields
    const rawInquiry = await Inquiry.findById(id).populate(
      "respondedBy",
      "firstName lastName email",
    );

    const inquiry = rawInquiry?.toObject ? rawInquiry.toObject({ virtuals: true }) : rawInquiry;
    if (inquiry) {
      inquiry.name = inquiry.name || inquiry.fullName || `${inquiry.firstName || ""} ${inquiry.lastName || ""}`.trim() || "Unknown";
      inquiry.fullName = inquiry.fullName || inquiry.name;
      inquiry.phone = inquiry.phone || inquiry.contactNumber || "N/A";
      inquiry.contactNumber = inquiry.contactNumber || inquiry.phone;
      inquiry.response = inquiry.response || inquiry.adminResponse || "";
    }

    res.json({
      message: "Inquiry updated successfully",
      inquiry,
      emailSent,
      emailError: emailSent === false ? (emailErrorDetails || "Automated email could not be delivered to the recipient address.") : undefined,
    });

    try {
      const { emitToAdmins } = await import("../utils/socket.js");
      emitToAdmins("inquiry:updated", {
        inquiryId: String(id),
        status: inquiry?.status,
        emailDeliveryStatus: inquiry?.emailDeliveryStatus,
      });
    } catch (socketErr) {
      // non-fatal
    }
  } catch (error) {
    next(error);
  }
};

export const retryInquiryEmail = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "The specified inquiry identifier is invalid.",
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
        error: "The requested inquiry record could not be found or you do not have permission to access it.",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    const responseText = (inquiry.adminResponse || inquiry.response || "").trim();
    if (!responseText) {
      return res.status(400).json({
        error: "No official response has been recorded for this inquiry yet. Please write a response first.",
        code: "NO_RESPONSE_RECORDED",
      });
    }

    if (!inquiry.email || !inquiry.email.includes("@")) {
      return res.status(400).json({
        error: "The inquiry does not contain a valid recipient email address.",
        code: "INVALID_RECIPIENT_EMAIL",
      });
    }

    const branchNameMap = {
      "gil-puyat": "Gil Puyat",
      guadalupe: "Guadalupe",
      general: "Lilycrest",
    };
    const branchKey = inquiry.branch || inquiry.preferredBranch || "general";
    const branchName = branchNameMap[branchKey] || "Lilycrest";

    let emailSent = false;
    let emailErrorDetails = null;
    const attemptTime = new Date();

    try {
      const emailResult = await sendInquiryResponseEmail({
        to: inquiry.email,
        customerName: inquiry.name || inquiry.fullName || "Valued Customer",
        inquirySubject: inquiry.subject || "General Inquiry",
        response: responseText,
        branchName,
      });

      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailErrorDetails = emailResult.error || emailResult.message;
      }
    } catch (emailErr) {
      emailErrorDetails = emailErr.message;
    }

    inquiry.emailLastAttemptAt = attemptTime;
    inquiry.emailDeliveryStatus = emailSent ? "sent" : "failed";
    inquiry.emailDeliveryError = emailSent
      ? null
      : (emailErrorDetails || "Automated email could not be delivered to the recipient address.");
    await inquiry.save();

    await auditLogger.logModification(
      req,
      "inquiry",
      id,
      null,
      {
        emailDeliveryStatus: inquiry.emailDeliveryStatus,
        emailLastAttemptAt: attemptTime,
      },
      emailSent ? "Inquiry response email re-sent successfully" : "Inquiry response email retry failed",
    );

    const populatedInquiry = await Inquiry.findById(id).populate(
      "respondedBy",
      "firstName lastName email",
    );

    const formattedInquiry = populatedInquiry?.toObject
      ? populatedInquiry.toObject({ virtuals: true })
      : populatedInquiry;
    if (formattedInquiry) {
      formattedInquiry.name =
        formattedInquiry.name ||
        formattedInquiry.fullName ||
        `${formattedInquiry.firstName || ""} ${formattedInquiry.lastName || ""}`.trim() ||
        "Unknown";
      formattedInquiry.fullName = formattedInquiry.fullName || formattedInquiry.name;
      formattedInquiry.phone =
        formattedInquiry.phone || formattedInquiry.contactNumber || "N/A";
      formattedInquiry.contactNumber =
        formattedInquiry.contactNumber || formattedInquiry.phone;
      formattedInquiry.response =
        formattedInquiry.response || formattedInquiry.adminResponse || "";
    }

    try {
      const { emitToAdmins } = await import("../utils/socket.js");
      emitToAdmins("inquiry:updated", {
        inquiryId: String(id),
        status: formattedInquiry?.status,
        emailDeliveryStatus: formattedInquiry?.emailDeliveryStatus,
      });
    } catch (socketErr) {
      // non-fatal
    }

    res.json({
      success: true,
      emailSent,
      message: emailSent
        ? "Official response email dispatched successfully."
        : "Email delivery attempt recorded. Note: Automated email could not be delivered.",
      emailError: emailSent ? undefined : inquiry.emailDeliveryError,
      inquiry: formattedInquiry,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInquiry = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "The specified inquiry identifier is invalid.",
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
        error: "The requested inquiry record could not be found or you do not have permission to access it.",
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
