import express from "express";
import { auth } from "../config/firebase.js";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js";
import crypto from "crypto";

const router = express.Router();

// Helper function to generate OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Helper function to send OTP email (placeholder - will implement with email service)
const sendOTPEmail = async (email, otp, userName) => {
  // TODO: Implement actual email sending with SendGrid, Nodemailer, etc.
  console.log(`\n======================`);
  console.log(`OTP for ${email}: ${otp}`);
  console.log(`User: ${userName}`);
  console.log(`======================\n`);
  // For now, just log to console for testing
  // In production, use an email service:
  // await emailService.send({
  //   to: email,
  //   subject: 'Verify Your Lilycrest Account',
  //   html: `Your verification code is: ${otp}. Valid for 10 minutes.`
  // });
};

// Register new user
router.post("/register", verifyToken, async (req, res) => {
  try {
    const { email, username, firstName, lastName, phone, branch } = req.body;

    // Validate required fields
    if (!username || !firstName || !lastName || !branch) {
      return res.status(400).json({
        error:
          "Missing required fields: username, firstName, lastName, and branch are required",
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
          username: existingUser.username,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          branch: existingUser.branch,
          role: existingUser.role,
        },
      });
    }

    // Check if username is already taken
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        error: "Username already taken. Please choose another one.",
      });
    }

    // Save user data to MongoDB
    // NOTE: Firebase Auth is the source of truth for email verification
    // We sync the verification status from Firebase (req.user.email_verified)
    const user = new User({
      firebaseUid: req.user.uid,
      email: email || req.user.email,
      username,
      firstName,
      lastName,
      phone,
      branch,
      role: "tenant",
      isEmailVerified: req.user.email_verified || false, // Synced from Firebase
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      userId: req.user.uid,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        branch: user.branch,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
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

// Verify OTP
router.post("/verify-otp", verifyToken, async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    // Find user by Firebase UID
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    // Check if OTP matches
    if (user.verificationToken !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if OTP has expired
    if (new Date() > user.verificationTokenExpiry) {
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    res.json({
      message: "Email verified successfully",
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// Resend OTP
router.post("/resend-otp", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.verificationToken = otp;
    user.verificationTokenExpiry = otpExpiry;
    await user.save();

    // Send OTP via email
    await sendOTPEmail(user.email, otp, `${user.firstName} ${user.lastName}`);

    res.json({ message: "OTP sent successfully. Please check your email." });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: "Failed to resend OTP. Please try again." });
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

    // Sync email verification status from Firebase (source of truth)
    // This ensures our database stays in sync with Firebase
    const firebaseEmailVerified = req.user.email_verified || false;
    if (user.isEmailVerified !== firebaseEmailVerified) {
      user.isEmailVerified = firebaseEmailVerified;
      await user.save();
      console.log(
        `✅ Synced email verification status for ${user.email}: ${firebaseEmailVerified}`,
      );
    }

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        branch: user.branch,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
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
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      branch: user.branch,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
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
