import express from "express";
import User from "../models/User.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// Get all users (admin only)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select("-__v");
    res.json(users);
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID (admin only)
router.get("/:userId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-__v");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Fetch user error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
