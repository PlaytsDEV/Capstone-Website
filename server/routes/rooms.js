import express from "express";
import Room from "../models/Room.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// Get all rooms
router.get("/", async (req, res) => {
  try {
    const { branch, type, available } = req.query;
    const filter = {};

    if (branch) filter.branch = branch;
    if (type) filter.type = type;
    if (available !== undefined) filter.available = available === "true";

    const rooms = await Room.find(filter).select("-__v");
    res.json(rooms);
  } catch (error) {
    console.error("Fetch rooms error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new room (admin only)
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const room = new Room(req.body);
    await room.save();

    res.status(201).json({
      message: "Room created successfully",
      roomId: room._id,
      room,
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update room (admin only)
router.put("/:roomId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.roomId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({ message: "Room updated successfully", room });
  } catch (error) {
    console.error("Update room error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete room (admin only)
router.delete("/:roomId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Delete room error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
