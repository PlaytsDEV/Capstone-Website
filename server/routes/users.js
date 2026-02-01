/**
 * =============================================================================
 * USER MANAGEMENT ROUTES
 * =============================================================================
 *
 * Routes for managing users in the system with branch-based access control.
 *
 * Available Endpoints:
 * - GET    /api/users                    - Get all users (filtered by branch)
 * - GET    /api/users/stats              - Get user statistics
 * - GET    /api/users/branch/:branch     - Get users for specific branch (super admin)
 * - GET    /api/users/email-by-username  - Get email by username (public)
 * - GET    /api/users/:userId            - Get specific user by ID
 * - PUT    /api/users/:userId            - Update user
 * - DELETE /api/users/:userId            - Delete user (super admin only)
 *
 * Branch Access Rules:
 * - Regular admins: Can only access users from their assigned branch
 * - Super admins: Can access users from ALL branches
 */

import express from "express";
import { User } from "../models/index.js";
import {
  verifyToken,
  verifyAdmin,
  verifySuperAdmin,
} from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";

const router = express.Router();

// ============================================================================
// STATISTICS ENDPOINT (must be before /:userId route)
// ============================================================================

/**
 * GET /api/users/stats
 *
 * Get user statistics for dashboard.
 *
 * Access: Admin (filtered by branch) | Super Admin (all branches)
 */
router.get(
  "/stats",
  verifyToken,
  verifyAdmin,
  filterByBranch,
  async (req, res) => {
    try {
      const matchQuery = req.branchFilter ? { branch: req.branchFilter } : {};

      // Get counts by role
      const roleCounts = await User.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]);

      // Get counts by branch (for super admin)
      let branchCounts = [];
      if (req.isSuperAdmin) {
        branchCounts = await User.aggregate([
          { $group: { _id: "$branch", count: { $sum: 1 } } },
        ]);
      }

      // Get total and active counts
      const total = await User.countDocuments(matchQuery);
      const activeCount = await User.countDocuments({
        ...matchQuery,
        isActive: true,
      });
      const verifiedCount = await User.countDocuments({
        ...matchQuery,
        isEmailVerified: true,
      });

      // Format response
      const stats = {
        total,
        activeCount,
        verifiedCount,
        byRole: { user: 0, tenant: 0, admin: 0, superAdmin: 0 },
        byBranch: {},
      };

      roleCounts.forEach((item) => {
        if (item._id) stats.byRole[item._id] = item.count;
      });
      branchCounts.forEach((item) => {
        if (item._id) stats.byBranch[item._id] = item.count;
      });

      console.log(
        `✅ Retrieved user stats for ${req.userBranch || "all"} branch(es)`,
      );
      res.json(stats);
    } catch (error) {
      console.error("❌ Fetch user stats error:", error);
      res.status(500).json({
        error: "Failed to fetch user statistics",
        details: error.message,
        code: "FETCH_STATS_ERROR",
      });
    }
  },
);

// ============================================================================
// GET USERS BY BRANCH (Super Admin only)
// ============================================================================

/**
 * GET /api/users/branch/:branch
 *
 * Get all users for a specific branch.
 *
 * Access: Super Admin only
 */
router.get(
  "/branch/:branch",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    try {
      const { branch } = req.params;

      const validBranches = ["gil-puyat", "guadalupe", ""];
      if (!validBranches.includes(branch)) {
        return res.status(400).json({
          error: "Invalid branch. Must be 'gil-puyat', 'guadalupe', or empty",
          code: "INVALID_BRANCH",
        });
      }

      const users = await User.find({ branch })
        .sort({ createdAt: -1 })
        .select("-__v");

      console.log(
        `✅ Super Admin retrieved ${users.length} users for ${branch || "no"} branch`,
      );
      res.json(users);
    } catch (error) {
      console.error("❌ Fetch branch users error:", error);
      res.status(500).json({
        error: "Failed to fetch branch users",
        details: error.message,
        code: "FETCH_BRANCH_USERS_ERROR",
      });
    }
  },
);

// ============================================================================
// PUBLIC ENDPOINT - Email by Username
// ============================================================================

/**
 * GET /api/users/email-by-username
 *
 * Get user email by username (for login with username).
 * This endpoint is public to allow username-based login.
 */
router.get("/email-by-username", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        error: "Username is required",
        code: "MISSING_USERNAME",
      });
    }

    const trimmedUsername = username.trim();
    console.log(`🔍 Looking up username: "${trimmedUsername}"`);

    const user = await User.findOne({
      username: { $regex: new RegExp(`^${trimmedUsername}$`, "i") },
    }).select("email username");

    if (!user) {
      console.log(`❌ Username not found: "${trimmedUsername}"`);
      return res.status(404).json({
        error: "Username not found",
        code: "USERNAME_NOT_FOUND",
      });
    }

    console.log(
      `✅ Email lookup for username: ${trimmedUsername} -> ${user.email}`,
    );
    res.json({ email: user.email });
  } catch (error) {
    console.error("❌ Username lookup error:", error);
    res.status(500).json({
      error: "Failed to lookup username",
      details: error.message,
      code: "USERNAME_LOOKUP_ERROR",
    });
  }
});

// ============================================================================
// GET ALL USERS
// ============================================================================

/**
 * GET /api/users
 *
 * Retrieve all users from the database.
 * Results are filtered by the admin's assigned branch.
 *
 * Access: Admin (filtered by branch) | Super Admin (all branches)
 *
 * Query Parameters:
 * - role: Filter by role (user, tenant, admin, superAdmin)
 * - branch: Filter by branch (super admin only)
 * - isActive: Filter by active status (true/false)
 * - page: Page number for pagination (default: 1)
 * - limit: Items per page (default: 20)
 * - sort: Sort field (default: createdAt)
 * - order: Sort order (asc/desc, default: desc)
 */
router.get("/", verifyToken, verifyAdmin, filterByBranch, async (req, res) => {
  try {
    const {
      role,
      branch,
      isActive,
      page = 1,
      limit = 20,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    // Build query with branch filter
    const query = {};

    if (req.branchFilter) {
      query.branch = req.branchFilter;
    } else if (branch) {
      query.branch = branch;
    }

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sortOrder = order === "asc" ? 1 : -1;
    const sortOptions = { [sort]: sortOrder };

    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select("-__v"),
      User.countDocuments(query),
    ]);

    console.log(
      `✅ Retrieved ${users.length} users for ${req.userBranch || "all"} branch(es)`,
    );

    res.json({
      users,
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
    console.error("❌ Fetch users error:", error);
    res.status(500).json({
      error: "Failed to fetch users",
      details: error.message,
      code: "FETCH_USERS_ERROR",
    });
  }
});

// ============================================================================
// GET SINGLE USER
// ============================================================================

/**
 * GET /api/users/:userId
 *
 * Retrieve a specific user by their MongoDB ID.
 *
 * Access: Admin (must be from their branch) | Super Admin (any user)
 */
router.get(
  "/:userId",
  verifyToken,
  verifyAdmin,
  filterByBranch,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          error: "Invalid user ID format",
          code: "INVALID_USER_ID",
        });
      }

      const query = { _id: userId };
      if (req.branchFilter) {
        query.branch = req.branchFilter;
      }

      const user = await User.findOne(query).select("-__v");

      if (!user) {
        return res.status(404).json({
          error: "User not found or access denied",
          code: "USER_NOT_FOUND",
        });
      }

      console.log(`✅ Retrieved user: ${user.email}`);
      res.json(user);
    } catch (error) {
      console.error("❌ Fetch user error:", error);

      if (error.name === "CastError") {
        return res.status(400).json({
          error: "Invalid user ID format",
          code: "INVALID_USER_ID",
        });
      }

      res.status(500).json({
        error: "Failed to fetch user",
        details: error.message,
        code: "FETCH_USER_ERROR",
      });
    }
  },
);

// ============================================================================
// UPDATE USER
// ============================================================================

/**
 * PUT /api/users/:userId
 *
 * Update a user's information.
 *
 * Access: Admin (must be from their branch) | Super Admin (any user)
 */
router.put(
  "/:userId",
  verifyToken,
  verifyAdmin,
  filterByBranch,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          error: "Invalid user ID format",
          code: "INVALID_USER_ID",
        });
      }

      const query = { _id: userId };
      if (req.branchFilter) {
        query.branch = req.branchFilter;
      }

      const existingUser = await User.findOne(query);
      if (!existingUser) {
        return res.status(404).json({
          error: "User not found or access denied",
          code: "USER_NOT_FOUND",
        });
      }

      const updateData = { ...req.body };

      // Prevent changing sensitive fields
      delete updateData._id;
      delete updateData.firebaseUid;
      delete updateData.createdAt;

      // Only super admins can change roles
      if (updateData.role && !req.isSuperAdmin) {
        delete updateData.role;
      }

      // Only super admins can change branch assignment
      if (updateData.branch !== undefined && !req.isSuperAdmin) {
        delete updateData.branch;
      }

      const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      }).select("-__v");

      console.log(`✅ User updated: ${user.email}`);
      res.json({
        message: "User updated successfully",
        user,
      });
    } catch (error) {
      console.error("❌ Update user error:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          error: "Validation failed",
          details: error.message,
          code: "VALIDATION_ERROR",
        });
      }

      if (error.name === "CastError") {
        return res.status(400).json({
          error: "Invalid user ID format",
          code: "INVALID_USER_ID",
        });
      }

      res.status(500).json({
        error: "Failed to update user",
        details: error.message,
        code: "UPDATE_USER_ERROR",
      });
    }
  },
);

// ============================================================================
// DELETE USER (Super Admin only)
// ============================================================================

/**
 * DELETE /api/users/:userId
 *
 * Delete a user permanently.
 *
 * Access: Super Admin only
 */
router.delete("/:userId", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid user ID format",
        code: "INVALID_USER_ID",
      });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    console.log(`✅ User deleted: ${user.email}`);
    res.json({
      message: "User deleted successfully",
      deletedId: userId,
    });
  } catch (error) {
    console.error("❌ Delete user error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid user ID format",
        code: "INVALID_USER_ID",
      });
    }

    res.status(500).json({
      error: "Failed to delete user",
      details: error.message,
      code: "DELETE_USER_ERROR",
    });
  }
});

export default router;
