import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Room from '../models/Room.js';

await mongoose.connect(process.env.MONGODB_URI);

const allRecent = await Room.find({ isArchived: { $ne: true } }).sort({ createdAt: -1 }).limit(10).lean();
console.log('Recent rooms:', allRecent.map(r => ({ id: r._id, name: r.name, roomNumber: r.roomNumber, branch: r.branch, type: r.type, floor: r.floor })));

await mongoose.disconnect();
