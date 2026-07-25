import mongoose from "mongoose";
import dotenv from "dotenv";
import { Room } from "../models/index.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/lilycrest-dormitory";

export const healBedIdentifiers = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const rooms = await Room.find({ isArchived: { $ne: true } });
    let updatedRooms = 0;
    let updatedBeds = 0;

    for (const room of rooms) {
      if (!Array.isArray(room.beds) || room.beds.length === 0) continue;

      let roomModified = false;
      const upperBeds = room.beds.filter((b) => b.position === "upper");
      const lowerBeds = room.beds.filter((b) => b.position === "lower");

      let upperIdx = 0;
      let lowerIdx = 0;

      for (let i = 0; i < room.beds.length; i++) {
        const bed = room.beds[i];
        let bunkBlock = bed.bunkBlock;
        let code = bed.code;

        if (bed.position === "single") {
          bunkBlock = "none";
          code = `${room.roomNumber}-S1`;
        } else {
          let bunkIndex = 0;
          if (bed.position === "upper") {
            bunkIndex = upperIdx;
            upperIdx++;
          } else if (bed.position === "lower") {
            bunkIndex = lowerIdx;
            lowerIdx++;
          } else {
            bunkIndex = Math.floor(i / 2);
          }

          bunkBlock = String.fromCharCode(65 + bunkIndex); // A, B, C...
          const tierCode = bed.position === "upper" ? "U" : "L";
          code = `${room.roomNumber}-${bunkBlock}-${tierCode}`;
        }

        if (bed.bunkBlock !== bunkBlock || bed.code !== code) {
          bed.bunkBlock = bunkBlock;
          bed.code = code;
          roomModified = true;
          updatedBeds++;
        }
      }

      if (roomModified) {
        room.markModified("beds");
        await room.save();
        updatedRooms++;
      }
    }

    console.log(`HEAL COMPLETE: Updated ${updatedBeds} beds across ${updatedRooms} rooms.`);
    process.exit(0);
  } catch (error) {
    console.error("Heal failed:", error);
    process.exit(1);
  }
};

healBedIdentifiers();
