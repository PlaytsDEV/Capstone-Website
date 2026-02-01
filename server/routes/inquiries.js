/**
 * =============================================================================
 * INQUIRY MANAGEMENT ROUTES
 * =============================================================================
 *
 * Routes for managing customer inquiries and contact form submissions.
 *
 * Available Endpoints:
 * - GET /api/inquiries - Get all inquiries (admin only)
 * - POST /api/inquiries - Submit new inquiry (public, no auth required)
 * - PUT /api/inquiries/:inquiryId - Update inquiry status/response (admin only)
 *
 * Business Rules:
 * - Anyone can submit an inquiry (public endpoint)
 * - Only admins can view and respond to inquiries
 * - Inquiries are sorted by newest first
 */

import express from "express";
import Inquiry from "../models/Inquiry.js";
import User from "../models/User.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/inquiries
 *
 * Retrieve all inquiries with respondent information.
 *
 * Access: Admin only
 *
 * @returns {Array} List of all inquiries, sorted by newest first
 */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Fetch all inquiries, sorted by creation date (newest first)
    const inquiries = await Inquiry.find({})
      .sort({ createdAt: -1 })
      .populate("respondedBy", "firstName lastName email") // Include admin who responded
      .select("-__v"); // Exclude version key

    console.log(`✅ Retrieved ${inquiries.length} inquiries`);
    res.json(inquiries);
  } catch (error) {
    console.error("❌ Fetch inquiries error:", error);
    res.status(500).json({
      error: "Failed to fetch inquiries",
      details: error.message,
      code: "FETCH_INQUIRIES_ERROR",
    });
  }
});

/**
 * POST /api/inquiries
 *
 * Submit a new inquiry from the contact form.
 *
 * Access: Public (no authentication required)
 *
 * @body {Object} Inquiry data (name, email, phone, subject, message, branch)
 * @returns {Object} Created inquiry with success message
 */
router.post("/", async (req, res) => {
  try {
    // Validate required fields
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error:
          "Missing required fields: name, email, subject, and message are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Validate email format (basic validation)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      });
    }

    // Create new inquiry with "pending" status
    const inquiry = new Inquiry({
      ...req.body,
      status: "pending",
    });

    // Save to database
    await inquiry.save();

    console.log(`✅ Inquiry submitted: ${inquiry._id} from ${inquiry.email}`);
    res.status(201).json({
      message: "Inquiry submitted successfully. We will get back to you soon!",
      inquiryId: inquiry._id,
      inquiry,
    });
  } catch (error) {
    console.error("❌ Create inquiry error:", error);

    // Handle validation errors
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
});

/**
 * PUT /api/inquiries/:inquiryId
 *
 * Update an inquiry's status, response, or other details.
 *
 * Access: Admin only
 *
 * Typical use cases:
 * - Change status (pending → in-progress → resolved)
 * - Add admin response
 * - Mark as closed
 *
 * @param {string} inquiryId - MongoDB ObjectId of the inquiry
 * @body {Object} Updated inquiry data (status, response, etc.)
 * @returns {Object} Updated inquiry with success message
 */
router.put("/:inquiryId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { inquiryId } = req.params;

    // Validate inquiryId format
    if (!inquiryId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid inquiry ID format",
        code: "INVALID_INQUIRY_ID",
      });
    }

    // If adding a response, track who responded and when
    const updateData = { ...req.body };
    if (req.body.response) {
      // Find admin user to set respondedBy field
      const adminUser = await User.findOne({ firebaseUid: req.user.uid });
      if (adminUser) {
        updateData.respondedBy = adminUser._id;
        updateData.respondedAt = new Date();
      }
    }

    // Update inquiry and return the updated document
    const inquiry = await Inquiry.findByIdAndUpdate(inquiryId, updateData, {
      new: true, // Return updated document
      runValidators: true, // Validate against schema
    }).populate("respondedBy", "firstName lastName email");

    if (!inquiry) {
      return res.status(404).json({
        error: "Inquiry not found",
        code: "INQUIRY_NOT_FOUND",
      });
    }

    console.log(
      `✅ Inquiry updated: ${inquiry._id} - Status: ${inquiry.status}`,
    );
    res.json({
      message: "Inquiry updated successfully",
      inquiry,
    });
  } catch (error) {
    console.error("❌ Update inquiry error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    // Handle cast errors (invalid ID)
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
});

export default router;
