import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://admin:pass@cluster.mongodb.net/test", { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Room = mongoose.model("Room", new mongoose.Schema({}, { strict: false }));
    const room = await Room.findOne({ roomNumber: "GD-102" }).lean();
    console.log(JSON.stringify(room, null, 2));
    process.exit(0);
  });
