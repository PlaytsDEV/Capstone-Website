import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      required: true,
      enum: ["gil-puyat", "guadalupe"],
    },
    type: {
      type: String,
      required: true,
      enum: ["private", "double-sharing", "quadruple-sharing"],
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    amenities: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
    },
    images: [
      {
        type: String,
      },
    ],
    available: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Virtual for checking if room is full
roomSchema.virtual("isFull").get(function () {
  return this.currentOccupancy >= this.capacity;
});

// Index for faster queries
roomSchema.index({ branch: 1, type: 1 });
roomSchema.index({ available: 1 });

const Room = mongoose.model("Room", roomSchema);

export default Room;
