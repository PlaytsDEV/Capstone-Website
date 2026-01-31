import express from "express";
import Inquiry from "../models/Inquiry.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// Get all inquiries (admin only)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const inquiries = await Inquiry.find({})
      .sort({ createdAt: -1 })
      .populate("respondedBy", "firstName lastName email")
      .select("-__v");

    res.json(inquiries);
  } catch (error) {
    console.error("Fetch inquiries error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new inquiry (public - no auth required)
router.post("/", async (req, res) => {
  try {
    const inquiry = new Inquiry({
      ...req.body,
      status: "pending",
    });

    await inquiry.save();

    res.status(201).json({
      message: "Inquiry submitted successfully",
      inquiryId: inquiry._id,
      inquiry,
    });
  } catch (error) {
    console.error("Create inquiry error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update inquiry status (admin only)
router.put("/:inquiryId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const inquiry = await Inquiry.findByIdAndUpdate(
      req.params.inquiryId,
      req.body,
      { new: true, runValidators: true },
    );

    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    res.json({ message: "Inquiry updated successfully", inquiry });
  } catch (error) {
    console.error("Update inquiry error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
