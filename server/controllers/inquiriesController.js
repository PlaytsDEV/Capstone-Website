/**
 * Inquiry Controllers
 */

import { Inquiry, User } from "../models/index.js";
import { sendInquiryResponseEmail } from "../config/email.js";
import auditLogger from "../utils/auditLogger.js";

export const getInquiryStats = async (req, res) => {
  try {
    const matchQuery = req.branchFilter
      ? { branch: req.branchFilter, isArchived: { $ne: true } }
      : { isArchived: { $ne: true } };

    // Get counts by status
    const statusCounts = await Inquiry.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get counts by branch (for super admin)
    let branchCounts = [];
    if (req.isSuperAdmin) {
      branchCounts = await Inquiry.aggregate([
        { $match: { isArchived: { $ne: true } } },
        { $group: { _id: "$branch", count: { $sum: 1 } } },
      ]);
    }

    // Get total and recent counts
    const total = await Inquiry.countDocuments(matchQuery);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
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

    console.log(
      `✅ Retrieved inquiry stats for ${req.userBranch || "all"} branch(es)`,
    );
    res.json(stats);
  } catch (error) {
    console.error("❌ Fetch inquiry stats error:", error);
    res.status(500).json({
      error: "Failed to fetch inquiry statistics",
      details: error.message,
      code: "FETCH_STATS_ERROR",
    });
  }
};

export const getInquiriesByBranch = async (req, res) => {
  try {
    const { branch } = req.params;

    const validBranches = ["gil-puyat", "guadalupe", "general"];
    if (!validBranches.includes(branch)) {
      return res.status(400).json({
        error: "Invalid branch. Must be 'gil-puyat', 'guadalupe', or 'general'",
        code: "INVALID_BRANCH",
      });
    }

    const inquiries = await Inquiry.find({ branch })
      .sort({ createdAt: -1 })
      .populate("respondedBy", "firstName lastName email")
      .select("-__v");

    console.log(
      `✅ Super Admin retrieved ${inquiries.length} inquiries for ${branch}`,
    );
    res.json(inquiries);
  } catch (error) {
    console.error("❌ Fetch branch inquiries error:", error);
    res.status(500).json({
      error: "Failed to fetch branch inquiries",
      details: error.message,
      code: "FETCH_BRANCH_INQUIRIES_ERROR",
    });
  }
};

export const getInquiries = async (req, res) => {
  try {
    const {
      status,
      branch,
      page = 1,
      limit = 20,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    // Build query with branch filter
    const query = { isArchived: { $ne: true } }; // Exclude archived inquiries

    if (req.branchFilter) {
      query.branch = req.branchFilter;
    } else if (branch) {
      query.branch = branch;
    }

    if (status) {
      // Map frontend "responded" to backend "resolved"
      query.status = status === "responded" ? "resolved" : status;
    }

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

    console.log(
      `✅ Retrieved ${inquiries.length} inquiries for ${req.userBranch || "all"} branch(es)`,
    );

    res.json({
      inquiries,
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
    console.error("❌ Fetch inquiries error:", error);
    res.status(500).json({
      error: "Failed to fetch inquiries",
      details: error.message,
      code: "FETCH_INQUIRIES_ERROR",
    });
  }
};

export const getInquiryById = async (req, res) => {
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
      query.branch = req.branchFilter;
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

    console.log(`✅ Retrieved inquiry: ${inquiry._id}`);
    res.json(inquiry);
  } catch (error) {
    console.error("❌ Fetch inquiry error:", error);
    res.status(500).json({
      error: "Failed to fetch inquiry",
      details: error.message,
      code: "FETCH_INQUIRY_ERROR",
    });
  }
};

export const createInquiry = async (req, res) => {
  try {
    const { name, email, phone, subject, message, branch } = req.body;

    if (!name || !email || !subject || !message || !branch) {
      return res.status(400).json({
        error:
          "Missing required fields: name, email, subject, message, and branch are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    const validBranches = ["gil-puyat", "guadalupe", "general"];
    if (!validBranches.includes(branch)) {
      return res.status(400).json({
        error: "Invalid branch. Must be 'gil-puyat', 'guadalupe', or 'general'",
        code: "INVALID_BRANCH",
      });
    }

    const inquiry = new Inquiry({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      subject: subject.trim(),
      message: message.trim(),
      branch,
      status: "pending",
    });

    await inquiry.save();

    console.log(`✅ Inquiry created: ${inquiry._id} for ${branch} branch`);
    res.status(201).json({
      message: "Inquiry submitted successfully. We will get back to you soon!",
      inquiryId: inquiry._id,
      inquiry,
    });
  } catch (error) {
    console.error("❌ Create inquiry error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      error: "Failed to submit inquiry",
      details: error.message,
      code: "CREATE_INQUIRY_ERROR",
    });
  }
};

export const updateInquiry = async (req, res) => {
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
      query.branch = req.branchFilter;
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
      const branchName =
        existingInquiry.branch === "gil-puyat" ? "Gil Puyat" : "Guadalupe";
      const emailResult = await sendInquiryResponseEmail({
        to: existingInquiry.email,
        customerName: existingInquiry.name,
        inquirySubject: existingInquiry.message,
        response: req.body.response.trim(),
        branchName: branchName,
      });

      if (emailResult.success) {
        console.log(`📧 Email sent to ${existingInquiry.email}`);
      } else {
        console.log(
          `⚠️ Email not sent: ${emailResult.message || emailResult.error}`,
        );
      }

      console.log(
        `✅ Inquiry responded: ${existingInquiry._id} by ${adminUser.firstName} ${adminUser.lastName}`,
      );
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

    console.log(
      `✅ Inquiry updated: ${inquiry._id} - Status: ${inquiry.status}`,
    );
    res.json({
      message: "Inquiry updated successfully",
      inquiry,
    });
  } catch (error) {
    console.error("❌ Update inquiry error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid inquiry ID format",
        code: "INVALID_INQUIRY_ID",
      });
    }

    res.status(500).json({
      error: "Failed to update inquiry",
      details: error.message,
      code: "UPDATE_INQUIRY_ERROR",
    });
  }
};

export const deleteInquiry = async (req, res) => {
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
      query.branch = req.branchFilter;
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

    console.log(`✅ Inquiry archived: ${id}`);
    res.json({
      message: "Inquiry archived successfully",
      archivedId: id,
      branch: inquiry.branch,
    });
  } catch (error) {
    console.error("❌ Archive inquiry error:", error);
    await auditLogger.logError(req, error, "Failed to archive inquiry");

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid inquiry ID format",
        code: "INVALID_INQUIRY_ID",
      });
    }

    res.status(500).json({
      error: "Failed to archive inquiry",
      details: error.message,
      code: "ARCHIVE_INQUIRY_ERROR",
    });
  }
};
