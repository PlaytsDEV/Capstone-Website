import express from "express";
import Reservation from "../models/Reservation.js";
import User from "../models/User.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// Get all reservations (admin) or user's reservations (tenant)
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = req.user;
    let filter = {};

    // If not admin, only show user's own reservations
    if (!user.admin) {
      const dbUser = await User.findOne({ firebaseUid: user.uid });
      if (!dbUser) {
        return res.status(404).json({ error: "User not found" });
      }
      filter.userId = dbUser._id;
    }

    const reservations = await Reservation.find(filter)
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name branch type price")
      .select("-__v");

    res.json(reservations);
  } catch (error) {
    console.error("Fetch reservations error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new reservation
router.post("/", verifyToken, async (req, res) => {
  try {
    const dbUser = await User.findOne({ firebaseUid: req.user.uid });
    if (!dbUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const reservation = new Reservation({
      ...req.body,
      userId: dbUser._id,
      status: "pending",
    });

    await reservation.save();

    res.status(201).json({
      message: "Reservation created successfully",
      reservationId: reservation._id,
      reservation,
    });
  } catch (error) {
    console.error("Create reservation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update reservation status (admin only)
router.put("/:reservationId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.reservationId,
      req.body,
      { new: true, runValidators: true },
    );

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    res.json({ message: "Reservation updated successfully", reservation });
  } catch (error) {
    console.error("Update reservation error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
