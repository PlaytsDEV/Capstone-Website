/**
 * ============================================================================
 * MAINTENANCE REQUEST CONTROLLER
 * ============================================================================
 *
 * Handles maintenance requests with branch isolation and predictive analytics.
 * Supports request tracking and completion metrics for forecasting.
 *
 * ============================================================================
 */

import { MaintenanceRequest, Reservation } from "../models/index.js";

/**
 * Get maintenance requests for logged-in tenant
 * @route GET /api/maintenance/my-requests?limit=50&status=pending
 * @access Private (Tenant only)
 */
export const getMyRequests = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { branch } = req.user;
    const { limit = 50, status } = req.query;

    const query = {
      userId,
      branch,
      isArchived: false,
    };

    if (status) {
      query.status = status;
    }

    const requests = await MaintenanceRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 100))
      .lean();

    res.json({
      count: requests.length,
      requests: requests.map((r) => ({
        id: r._id,
        title: r.title,
        category: r.category,
        description: r.description,
        status: r.status,
        urgency: r.urgency,
        date: r.createdAt,
        completedAt: r.completedAt,
      })),
    });
  } catch (error) {
    console.error("❌ Get my requests error:", error);
    res.status(500).json({ error: "Failed to fetch maintenance requests" });
  }
};

/**
 * Get all maintenance requests by branch (Admin/Staff)
 * @route GET /api/maintenance/branch?limit=50&status=pending
 * @access Private (Admin only)
 */
export const getByBranch = async (req, res) => {
  try {
    const { branch } = req.user;
    const { limit = 50, status, category } = req.query;

    const query = {
      branch,
      isArchived: false,
    };

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    const requests = await MaintenanceRequest.find(query)
      .sort({ urgency: -1, createdAt: 1 })
      .limit(Math.min(parseInt(limit), 100))
      .lean();

    res.json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("❌ Get branch requests error:", error);
    res.status(500).json({ error: "Failed to fetch maintenance requests" });
  }
};

/**
 * Create maintenance request
 * @route POST /api/maintenance/requests
 * @access Private (Tenant only)
 */
export const createRequest = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { branch } = req.user;
    const { category, title, description, urgency } = req.body;

    // Validate inputs
    if (!category || !title || !description) {
      return res.status(400).json({
        error: "Missing required fields: category, title, description",
      });
    }

    // Find user's active stay to get reservation ID
    const reservation = await Reservation.findOne({
      userId,
      branch,
      status: "checked-in",
    });

    if (!reservation) {
      return res.status(404).json({
        error: "No active stay found",
      });
    }

    const request = new MaintenanceRequest({
      reservationId: reservation._id,
      userId,
      branch,
      category,
      title,
      description,
      urgency: urgency || "medium",
    });

    await request.save();

    res.status(201).json({
      success: true,
      request: {
        id: request._id,
        title: request.title,
        category: request.category,
        status: request.status,
        date: request.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Create request error:", error);
    res.status(500).json({ error: "Failed to create maintenance request" });
  }
};

/**
 * Get maintenance request details
 * @route GET /api/maintenance/requests/:requestId
 * @access Private
 */
export const getRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.uid;

    const request = await MaintenanceRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    // Users can only view their own requests if not admin
    if (
      request.userId.toString() !== userId &&
      req.user.role !== "admin" &&
      req.user.role !== "superAdmin"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      id: request._id,
      title: request.title,
      category: request.category,
      description: request.description,
      status: request.status,
      urgency: request.urgency,
      date: request.createdAt,
      completedAt: request.completedAt,
      completionNote: request.completionNote,
      assignedTo: request.assignedTo,
    });
  } catch (error) {
    console.error("❌ Get request error:", error);
    res.status(500).json({ error: "Failed to fetch maintenance request" });
  }
};

/**
 * Update maintenance request status (Admin/Staff)
 * @route PATCH /api/maintenance/requests/:requestId
 * @access Private (Admin only)
 */
export const updateRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, completionNote } = req.body;
    const staffId = req.user.uid;
    const { branch } = req.user;

    const request = await MaintenanceRequest.findById(requestId);

    if (!request || request.branch !== branch) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (status === "in-progress" && !request.assignedTo) {
      await request.start(staffId);
    } else if (status === "completed") {
      await request.complete(completionNote);
    } else if (status) {
      request.status = status;
      await request.save();
    }

    res.json({
      success: true,
      request: {
        id: request._id,
        status: request.status,
        completedAt: request.completedAt,
      },
    });
  } catch (error) {
    console.error("❌ Update request error:", error);
    res.status(500).json({ error: "Failed to update maintenance request" });
  }
};

/**
 * Get completion statistics by branch (for forecasting)
 * @route GET /api/maintenance/stats/completion
 * @access Private (Admin only)
 */
export const getCompletionStats = async (req, res) => {
  try {
    const { branch } = req.user;
    const { days = 30 } = req.query;

    const stats = await MaintenanceRequest.getCompletionStats(
      branch,
      parseInt(days),
    );

    res.json({
      branch,
      period: `${days} days`,
      stats,
    });
  } catch (error) {
    console.error("❌ Get completion stats error:", error);
    res.status(500).json({ error: "Failed to fetch completion statistics" });
  }
};

/**
 * Get issue frequency for predictive maintenance
 * @route GET /api/maintenance/stats/issue-frequency
 * @access Private (Admin only)
 */
export const getIssueFrequency = async (req, res) => {
  try {
    const { branch } = req.user;
    const { limit = 12, months = 6 } = req.query;

    const frequency = await MaintenanceRequest.getIssueFrequency(
      branch,
      parseInt(limit),
      parseInt(months),
    );

    res.json({
      branch,
      period: `${months} months`,
      frequency,
    });
  } catch (error) {
    console.error("❌ Get issue frequency error:", error);
    res.status(500).json({ error: "Failed to fetch issue frequency" });
  }
};

export default {
  getMyRequests,
  getByBranch,
  createRequest,
  getRequest,
  updateRequest,
  getCompletionStats,
  getIssueFrequency,
};
