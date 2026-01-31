import express from "express";
import { auth } from "../config/firebase.js";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Register new user
router.post("/register", verifyToken, async (req, res) => {
  try {
    const { email, firstName, lastName, phone, branch } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !branch) {
      return res.status(400).json({
        error:
          "Missing required fields: firstName, lastName, and branch are required",
      });
    }

    // Validate branch
    if (!["gil-puyat", "guadalupe"].includes(branch)) {
      return res.status(400).json({
        error: "Invalid branch. Must be 'gil-puyat' or 'guadalupe'",
      });
    }

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ firebaseUid: req.user.uid });

    if (existingUser) {
      return res.status(400).json({
        error: "User already registered",
        user: {
          id: existingUser._id,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          branch: existingUser.branch,
          role: existingUser.role,
        },
      });
    }

    // Save user data to MongoDB
    const user = new User({
      firebaseUid: req.user.uid,
      email: email || req.user.email,
      firstName,
      lastName,
      phone,
      branch,
      role: "tenant",
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      userId: req.user.uid,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        branch: user.branch,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed. Please try again.",
      details: error.message,
    });
  }
});

// Login - verify user exists in MongoDB and return user data
router.post("/login", verifyToken, async (req, res) => {
  try {
    // Find user by Firebase UID (already verified by verifyToken middleware)
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({
        error: "User not found in database. Please register first.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: "Your account is inactive. Please contact support.",
      });
    }

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        branch: user.branch,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Login failed. Please try again.",
      details: error.message,
    });
  }
});

// Get current user profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user._id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      { firstName, lastName, phone },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Set user role (admin only)
router.post("/set-role", verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.body;

    // Set custom claims
    const claims = {};
    if (role === "admin") {
      claims.admin = true;
    } else if (role === "superAdmin") {
      claims.superAdmin = true;
      claims.admin = true;
    }

    // Find user by MongoDB _id
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await auth.setCustomUserClaims(user.firebaseUid, claims);

    // Update role in MongoDB
    user.role = role;
    await user.save();

    res.json({ message: "User role updated successfully" });
  } catch (error) {
    console.error("Role update error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
